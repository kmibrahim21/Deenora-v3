import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

// In-memory rate limiting map: ip/secret -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Clean up old entries if map is large
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
  }

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetInSec: 60 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.ceil((entry.resetTime - now) / 1000)
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetInSec: Math.ceil((entry.resetTime - now) / 1000)
  };
}

/**
 * Timing-safe string comparison to prevent timing side-channel attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Constant-time check against dummy buffer to mitigate timing variance
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Standard UUID validation regex (8-4-4-4-12 hex format).
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safe public feature label mapping.
 * Internal or unapproved feature keys MUST NOT be exposed.
 */
const PUBLIC_FEATURE_MAPPING: Record<string, string> = {
  attendance: 'স্মার্ট অ্যাটেনডেন্স',
  accounting: 'ফি ও হিসাব ব্যবস্থাপনা',
  fees: 'ফি ও হিসাব ব্যবস্থাপনা',
  results: 'রেজাল্ট ব্যবস্থাপনা',
  exam: 'রেজাল্ট ব্যবস্থাপনা',
  sms: 'কল, WhatsApp ও SMS যোগাযোগ',
  voice_broadcast: 'কল, WhatsApp ও SMS যোগাযোগ',
  messages: 'কল, WhatsApp ও SMS যোগাযোগ',
  communication: 'কল, WhatsApp ও SMS যোগাযোগ',
  routine: 'রুটিন ব্যবস্থাপনা',
  class_routine: 'রুটিন ব্যবস্থাপনা',
  exam_routine: 'রুটিন ব্যবস্থাপনা',
  diary: 'ডায়েরি ও সিলেবাস',
  syllabus: 'ডায়েরি ও সিলেবাস',
  diary_syllabus: 'ডায়েরি ও সিলেবাস',
  parent_portal: 'প্যারেন্ট পোর্টাল',
  certificates: 'সার্টিফিকেট ও প্রশংসাপত্র',
  id_cards: 'স্মার্ট আইডি কার্ড ও এডমিট কার্ড'
};

/**
 * Extract city or district safely from the address text without leaking full granular private address details.
 */
function extractDistrictOrCity(address?: string | null): string | null {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  // Split by comma or semicolon
  const parts = trimmed.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  // If multi-part address, the last segment usually represents the District/City (e.g. "মিরপুর-১০, ঢাকা" -> "ঢাকা")
  const lastPart = parts[parts.length - 1];
  return lastPart || parts[0] || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    // 2. Rate limiting check
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     (req.headers['x-real-ip'] as string) || 
                     'unknown-client';
    const rateLimit = checkRateLimit(clientIp);
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', rateLimit.resetInSec.toString());
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests: Rate limit exceeded. Please try again later.'
      });
    }

    // 3. Authenticate with server-side DEENORA_AGENT_SECRET
    const expectedSecret = process.env.DEENORA_AGENT_SECRET;
    if (!expectedSecret) {
      console.error('CRITICAL: DEENORA_AGENT_SECRET environment variable is not configured on the server.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Gateway authentication configuration missing'
      });
    }

    let suppliedSecret = '';
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-deenora-agent-secret'];

    if (typeof customHeader === 'string' && customHeader.trim()) {
      suppliedSecret = customHeader.trim();
    } else if (typeof authHeader === 'string' && authHeader.trim()) {
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        suppliedSecret = authHeader.slice(7).trim();
      } else {
        suppliedSecret = authHeader.trim();
      }
    }

    if (!suppliedSecret || !secureCompare(suppliedSecret, expectedSecret)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing secret'
      });
    }

    // 4. Extract institutionId from URL path or query parameters
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname;
    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

    let institutionId = '';

    // Match path pattern: /api/agent/institutions/:institutionId/summary or /api/agent/institutions/:institutionId
    const pathMatch = pathname.match(/\/institutions\/([^\/]+)(?:\/summary)?$/);
    if (pathMatch && pathMatch[1]) {
      institutionId = pathMatch[1].trim();
    } else if (req.query?.institutionId && typeof req.query.institutionId === 'string') {
      institutionId = req.query.institutionId.trim();
    } else if (url.searchParams.get('institutionId')) {
      institutionId = url.searchParams.get('institutionId')!.trim();
    }

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request: Institution ID is required'
      });
    }

    // 5. Validate UUID format
    if (!UUID_REGEX.test(institutionId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request: Invalid institution ID format'
      });
    }

    // 6. Fetch only explicitly allowlisted columns server-side via Supabase Admin
    const supabase = getSupabaseAdmin();
    const { data: inst, error: dbError } = await supabase
      .from('institutions')
      .select('id, name, address, logo_url, institution_type, config_json, is_active, status, is_super_admin')
      .eq('id', institutionId)
      .maybeSingle();

    if (dbError) {
      console.error('Agent Gateway: Database error fetching institution');
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error'
      });
    }

    // 7. Verify institution existence and authorization
    // Super admin accounts or internal system records are not valid customer institutions
    if (!inst || inst.is_super_admin || inst.name === 'SYSTEM_GLOBAL_INTERNAL') {
      return res.status(404).json({
        success: false,
        error: 'Institution not found or unavailable'
      });
    }

    // 8. Verify active status
    const isActive = inst.is_active === true && (inst.status === 'active' || !inst.status);
    if (!isActive) {
      return res.status(403).json({
        success: false,
        error: 'Institution is inactive or suspended'
      });
    }

    // 9. Parse config_json safely
    let configObj: any = {};
    if (inst.config_json) {
      if (typeof inst.config_json === 'string') {
        try {
          configObj = JSON.parse(inst.config_json);
        } catch {
          configObj = {};
        }
      } else if (typeof inst.config_json === 'object') {
        configObj = inst.config_json;
      }
    }

    // 10. Map enabled features to safe public labels
    const rawModules = configObj.modules || {};
    const featureLabelsSet = new Set<string>();

    for (const [key, enabled] of Object.entries(rawModules)) {
      if (enabled === true) {
        const publicLabel = PUBLIC_FEATURE_MAPPING[key];
        if (publicLabel) {
          featureLabelsSet.add(publicLabel);
        }
      }
    }

    const enabledPublicFeatures = Array.from(featureLabelsSet);

    // 11. Extract English name safely if present
    const rawNameEnglish = configObj.name_english;
    const institutionNameEn = typeof rawNameEnglish === 'string' && rawNameEnglish.trim() 
      ? rawNameEnglish.trim() 
      : null;

    // 12. Build sanitized DTO
    const sanitizedDto = {
      institution_name: inst.name || '',
      institution_name_en: institutionNameEn,
      institution_type: inst.institution_type || 'madrasah',
      district_or_city: extractDistrictOrCity(inst.address),
      enabled_public_features: enabledPublicFeatures,
      verified_active_status: true,
      public_logo_url: inst.logo_url || null,
      retrieved_at: new Date().toISOString()
    };

    // Return sanitized DTO with cache control headers
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      data: sanitizedDto
    });

  } catch (error: any) {
    console.error('Agent Gateway: Unexpected error in handler');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
}
