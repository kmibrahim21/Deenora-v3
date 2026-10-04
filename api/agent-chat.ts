import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../lib/agent-crypto.js';
import {
  AGENT_TOOLS_DECLARATIONS,
  CONFIRM_REQUIRED_TOOLS,
  buildAgentSystemPrompt,
  executeAgentTool
} from './agent-tools.js';

const SHARED_DAILY_CAP = 50;
const MAX_TOOL_ROUNDS = 3;

/**
 * Gets today's date string in Asia/Dhaka timezone: YYYY-MM-DD
 */
function getDhakaDate(): string {
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return d;
}

/**
 * Safe generation helper that tries gemini-3.1-flash-lite, gemini-3.8-flash, gemini-flash-latest
 */
async function generateContentSafe(ai: GoogleGenAI, requestOptions: any) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        ...requestOptions,
        model
      });
      return res;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err);
      if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('429')) {
        console.warn(`Model ${model} unavailable, falling back to next model...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Key selector supporting dual-mode (BYOK or Shared with daily quota)
 */
async function getKeyForInstitute(
  supabase: any,
  institute: any
): Promise<{ key?: string; mode: 'byok' | 'shared'; error?: string; used?: number }> {
  const encryptedKey =
    institute.custom_gemini_key_encrypted ||
    (institute.config_json as any)?.custom_gemini_key_encrypted;

  if (encryptedKey) {
    const customKey = decryptApiKey(encryptedKey);
    if (customKey && customKey.trim().length > 10) {
      return { key: customKey.trim(), mode: 'byok' };
    }
  }

  // Shared mode: check daily quota
  const today = getDhakaDate();
  let used = 0;

  try {
    const { data: usageRow } = await supabase
      .from('agent_usage')
      .select('requests')
      .eq('institute_id', institute.id)
      .eq('usage_date', today)
      .maybeSingle();

    if (usageRow) {
      used = Number(usageRow.requests || 0);
    }
  } catch {
    // Fallback: check config_json
    const fallbackUsage = (institute.config_json as any)?.agent_usage?.[today] || 0;
    used = fallbackUsage;
  }

  if (used >= SHARED_DAILY_CAP) {
    return {
      error: 'QUOTA_EXCEEDED',
      mode: 'shared',
      used
    };
  }

  const sharedKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!sharedKey) {
    return {
      error: 'SERVER_KEY_NOT_CONFIGURED',
      mode: 'shared',
      used
    };
  }

  return { key: sharedKey, mode: 'shared', used };
}

/**
 * Increments shared-key usage counter for an institute
 */
async function incrementSharedUsage(supabase: any, instituteId: string, currentInst: any) {
  const today = getDhakaDate();
  try {
    const { data: existing } = await supabase
      .from('agent_usage')
      .select('requests')
      .eq('institute_id', instituteId)
      .eq('usage_date', today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('agent_usage')
        .update({ requests: (existing.requests || 0) + 1 })
        .eq('institute_id', instituteId)
        .eq('usage_date', today);
    } else {
      await supabase
        .from('agent_usage')
        .insert({ institute_id: instituteId, usage_date: today, requests: 1 });
    }
  } catch {
    // Fallback: update in config_json
    try {
      const cfg = (currentInst?.config_json && typeof currentInst.config_json === 'object') ? currentInst.config_json : {};
      const usageMap = cfg.agent_usage || {};
      usageMap[today] = (usageMap[today] || 0) + 1;
      cfg.agent_usage = usageMap;
      await supabase.from('institutions').update({ config_json: cfg }).eq('id', instituteId);
    } catch {}
  }
}

/**
 * Audit log recording helper
 */
async function recordAuditAction(
  supabase: any,
  entry: {
    institute_id: string;
    admin_id: string;
    tool_name: string;
    params: any;
    result_summary: string;
    mode: string;
  }
) {
  try {
    await supabase.from('agent_actions').insert({
      institute_id: entry.institute_id,
      admin_id: entry.admin_id,
      tool_name: entry.tool_name,
      params: entry.params || {},
      result_summary: entry.result_summary,
      mode: entry.mode,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    // Graceful fallback if table is not migrated yet
    console.warn('Agent audit table insert fallback:', e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-deenora-agent-secret, x-institute-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseAdmin();

  // --------------------------------------------------------------------------
  // ROUTE A: SETTINGS - GET STATUS (Key status, quota info)
  // --------------------------------------------------------------------------
  if ((pathname.includes('status') || pathname.includes('/settings/status')) && req.method === 'GET') {
    const instituteId = (req.query?.instituteId as string) || 
                        url.searchParams.get('instituteId') || 
                        (req.headers['x-institute-id'] as string);
    if (!instituteId) {
      return res.status(400).json({ error: 'Institute ID is required' });
    }

    const { data: inst } = await supabase
      .from('institutions')
      .select('id, name, config_json')
      .eq('id', instituteId)
      .maybeSingle();

    if (!inst) {
      return res.status(404).json({ error: 'Institute not found' });
    }

    const encryptedKey = (inst.config_json as any)?.custom_gemini_key_encrypted || (inst as any).custom_gemini_key_encrypted;
    let hasCustomKey = false;
    let maskedKey = '';

    if (encryptedKey) {
      const decrypted = decryptApiKey(encryptedKey);
      if (decrypted) {
        hasCustomKey = true;
        maskedKey = maskApiKey(decrypted);
      }
    }

    const today = getDhakaDate();
    let usedToday = 0;
    try {
      const { data: u } = await supabase
        .from('agent_usage')
        .select('requests')
        .eq('institute_id', instituteId)
        .eq('usage_date', today)
        .maybeSingle();
      if (u) usedToday = u.requests || 0;
    } catch {
      usedToday = (inst.config_json as any)?.agent_usage?.[today] || 0;
    }

    return res.status(200).json({
      success: true,
      mode: hasCustomKey ? 'byok' : 'shared',
      has_custom_key: hasCustomKey,
      masked_key: maskedKey,
      shared_usage: {
        today_used: usedToday,
        daily_cap: SHARED_DAILY_CAP,
        remaining: Math.max(0, SHARED_DAILY_CAP - usedToday)
      }
    });
  }

  // --------------------------------------------------------------------------
  // ROUTE B: SETTINGS - SAVE & VERIFY CUSTOM KEY (BYOK)
  // --------------------------------------------------------------------------
  if ((pathname.includes('key') || pathname.includes('/settings/key')) && req.method === 'POST') {
    const { apiKey, instituteId } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || !instituteId) {
      return res.status(400).json({ error: 'API Key ও Institute ID আবশ্যক' });
    }

    const cleanedKey = apiKey.trim();
    if (cleanedKey.length < 15) {
      return res.status(400).json({ error: 'সঠিক Gemini API Key দিন' });
    }

    // Verify key with Gemini test call
    try {
      const testAi = new GoogleGenAI({ apiKey: cleanedKey });
      await testAi.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'ping'
      });
    } catch (testErr: any) {
      console.error('Gemini Key verification failed:', testErr);
      return res.status(400).json({
        error: 'API Key সঠিক নয় অথবা মেয়াদ উত্তীর্ণ হয়েছে। অনুগ্রহ করে aistudio.google.com থেকে সঠিক Key সংগ্রহ করুন।'
      });
    }

    // Encrypt key
    const encrypted = encryptApiKey(cleanedKey);

    // Save to institutions
    const { data: inst } = await supabase
      .from('institutions')
      .select('id, config_json')
      .eq('id', instituteId)
      .maybeSingle();

    if (!inst) {
      return res.status(404).json({ error: 'Institute not found' });
    }

    const currentConfig = (inst.config_json && typeof inst.config_json === 'object') ? inst.config_json : {};
    currentConfig.custom_gemini_key_encrypted = encrypted;

    // Update config_json and custom_gemini_key_encrypted column if present
    const updatePayload: any = { config_json: currentConfig };
    try {
      updatePayload.custom_gemini_key_encrypted = encrypted;
      await supabase.from('institutions').update(updatePayload).eq('id', instituteId);
    } catch {
      delete updatePayload.custom_gemini_key_encrypted;
      await supabase.from('institutions').update(updatePayload).eq('id', instituteId);
    }

    return res.status(200).json({
      success: true,
      message: 'আপনার ব্যক্তিগত Gemini API Key সফলভাবে যাচাই ও সংরক্ষণ করা হয়েছে ✅',
      masked_key: maskApiKey(cleanedKey)
    });
  }

  // --------------------------------------------------------------------------
  // ROUTE C: SETTINGS - REMOVE CUSTOM KEY
  // --------------------------------------------------------------------------
  if ((pathname.includes('key') || pathname.includes('/settings/key')) && req.method === 'DELETE') {
    const instituteId = (req.query?.instituteId as string) || 
                        url.searchParams.get('instituteId') || 
                        (req.body && req.body.instituteId);
    if (!instituteId) {
      return res.status(400).json({ error: 'Institute ID is required' });
    }

    const { data: inst } = await supabase
      .from('institutions')
      .select('id, config_json')
      .eq('id', instituteId)
      .maybeSingle();

    if (inst) {
      const currentConfig = (inst.config_json && typeof inst.config_json === 'object') ? inst.config_json : {};
      delete currentConfig.custom_gemini_key_encrypted;

      const updatePayload: any = { config_json: currentConfig };
      try {
        updatePayload.custom_gemini_key_encrypted = null;
        await supabase.from('institutions').update(updatePayload).eq('id', instituteId);
      } catch {
        delete updatePayload.custom_gemini_key_encrypted;
        await supabase.from('institutions').update(updatePayload).eq('id', instituteId);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'ব্যক্তিগত API Key মুছে ফেলা হয়েছে। প্রতিষ্ঠানটি এখন শেয়ার্ড লিমিট মোডে ফিরে গেছে।'
    });
  }

  // --------------------------------------------------------------------------
  // ROUTE D: MAIN AGENT CHAT - POST /api/agent/chat
  // --------------------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      message,
      history = [],
      confirmedCall,
      instituteId: bodyInstituteId,
      adminId: bodyAdminId,
      adminName: bodyAdminName,
      userRole: bodyUserRole
    } = req.body || {};

    if (!message && !confirmedCall) {
      return res.status(400).json({ error: 'বার্তা বা কনফার্মেশন প্রদান করুন' });
    }

    const adminId = bodyAdminId || 'admin-user';
    let userRole = bodyUserRole || req.headers['x-user-role'] || 'madrasah_admin';
    let instituteId = bodyInstituteId || req.headers['x-institute-id'];
    let dbProfile: any = null;

    // Strict Server-Side Tenant & Role Verification
    if (adminId && adminId !== 'admin-user' && adminId !== 'super_admin') {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, role, institution_id')
        .eq('id', adminId)
        .maybeSingle();

      if (prof) {
        dbProfile = prof;
        if (prof.role) userRole = prof.role;
        // Bound non-super_admin/manager users strictly to their own institution_id
        if (userRole !== 'super_admin' && userRole !== 'manager' && prof.institution_id) {
          instituteId = prof.institution_id;
        }
      }
    }

    // Strict Role Restriction: Agent is ONLY for super_admin and manager
    if (userRole !== 'super_admin' && userRole !== 'manager') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        reply: 'AI সহকারী বর্তমানে শুধুমাত্র সুপার অ্যাডমিন ও ম্যানেজারের জন্য সক্রিয় রয়েছে।'
      });
    }

    // Resolve institution from database using final verified instituteId
    let institute: any = null;
    if (instituteId && instituteId !== 'system_super_admin') {
      const { data: inst } = await supabase
        .from('institutions')
        .select('id, name, address, phone, email, config_json, is_active, status')
        .eq('id', instituteId)
        .maybeSingle();
      institute = inst;
    }

    if (!institute) {
      instituteId = 'system_super_admin';
      institute = {
        id: 'system_super_admin',
        name: 'Deenora Super Admin System',
        address: 'Dhaka, Bangladesh',
        config_json: {},
        is_active: true,
        status: 'active'
      };
    }

    // Dual-mode Key resolution
    const keyResolution = await getKeyForInstitute(supabase, institute);
    if (keyResolution.error === 'QUOTA_EXCEEDED') {
      return res.status(200).json({
        reply: 'আজকের ফ্রি ব্যবহারের লিমিট (৫০ টি প্রশ্ন) শেষ হয়েছে। অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।'
      });
    }

    if (keyResolution.error || !keyResolution.key) {
      return res.status(500).json({
        reply: 'AI সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে কিছু সময় পর চেষ্টা করুন।'
      });
    }

    const adminName = bodyAdminName || dbProfile?.full_name || institute.name || 'Admin';
    const todayStr = getDhakaDate();

    // Initialize Gemini AI with active key
    const ai = new GoogleGenAI({ apiKey: keyResolution.key });
    const systemPrompt = buildAgentSystemPrompt({
      instituteName: institute.name || 'প্রতিষ্ঠানের নাম',
      adminName: adminName,
      currentDateStr: todayStr
    });

    // ------------------------------------------------------------------------
    // CASE 1: USER DIRECTLY CONFIRMED A PREVIOUS CONFIRMATION-REQUIRED TOOL CALL
    // ------------------------------------------------------------------------
    if (confirmedCall && confirmedCall.name && confirmedCall.args) {
      const toolResult = await executeAgentTool(confirmedCall.name, confirmedCall.args, institute.id, userRole);

      await recordAuditAction(supabase, {
        institute_id: institute.id,
        admin_id: adminId,
        tool_name: confirmedCall.name,
        params: confirmedCall.args,
        result_summary: JSON.stringify(toolResult).slice(0, 300),
        mode: keyResolution.mode
      });

      if (keyResolution.mode === 'shared') {
        await incrementSharedUsage(supabase, institute.id, institute);
      }

      // Format clean feedback with Gemini
      const followupResponse = await generateContentSafe(ai, {
        contents: [
          {
            role: 'user',
            parts: [{ text: `Admin বলেছে 'হ্যাঁ' এবং কাজটি সম্পন্ন হয়েছে। Tool: ${confirmedCall.name}, Tool Result: ${JSON.stringify(toolResult)}। এডমিনকে বাংলায় সংক্ষেপে নিশ্চিত করো কাজ হয়ে গেছে ✅ এবং মূল তথ্য দাও।` }]
          }
        ],
        config: {
          systemInstruction: systemPrompt
        }
      });

      return res.status(200).json({
        reply: followupResponse.text || 'কাজটি সফলভাবে সম্পন্ন হয়েছে ✅',
        tool_executed: confirmedCall.name,
        result: toolResult
      });
    }

    // ------------------------------------------------------------------------
    // CASE 2: REGULAR CHAT MESSAGE WITH GEMINI FUNCTION CALLING LOOP
    // ------------------------------------------------------------------------
    // Prepare contents array
    const contents: any[] = [];

    // Append history
    if (Array.isArray(history)) {
      history.slice(-10).forEach((h: any) => {
        const rawRole = String(h.role || '').toLowerCase();
        const role = (rawRole === 'ai' || rawRole === 'assistant' || rawRole === 'model') ? 'model' : 'user';
        const text = String(h.text || h.content || h.message || h.summary || '').trim();
        if (text) {
          contents.push({
            role,
            parts: [{ text }]
          });
        }
      });
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: String(message) }]
    });

    let currentResponse = await generateContentSafe(ai, {
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{
          functionDeclarations: AGENT_TOOLS_DECLARATIONS as any
        }]
      }
    });

    let executedToolsCount = 0;

    // Tool execution loop (up to MAX_TOOL_ROUNDS)
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const functionCalls = currentResponse.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        break;
      }

      const call = functionCalls[0]; // Process primary call
      const toolName = call.name;
      const toolArgs = call.args || {};

      // Check if confirmation is required
      if (CONFIRM_REQUIRED_TOOLS.has(toolName)) {
        // Build clear Bangla confirmation prompt
        let confirmText = '';
        if (toolName === 'record_fee_payment') {
          confirmText = `ফি জমা দেওয়ার নিশ্চিতকরণ:\nটাকার পরিমাণ: ${toolArgs.amount} টাকা\nফি টাইপ: ${toolArgs.fee_head || 'মাসিক বেতন'}\nপেমেন্ট মেথড: ${toolArgs.payment_method || 'নগদ'}\n\nটাকা জমা করবো?`;
        } else if (toolName === 'delete_student') {
          confirmText = `⚠️ সতর্কবার্তা: আপনি কি এই শিক্ষার্থীকে স্থায়ীভাবে ডিলিট করতে চান?\n\nডিলিট করবো?`;
        } else if (toolName === 'delete_notice') {
          confirmText = `⚠️ সতর্কবার্তা: নোটিশটি মুছে ফেলতে চান? ডিলিট করবো?`;
        } else if (toolName === 'publish_result') {
          confirmText = `পরীক্ষার ফলাফল অভিভাবক ও শিক্ষার্থীদের জন্য উন্মুক্ত (Publish) করতে চান? করবো?`;
        } else {
          confirmText = `এই কাজটি সম্পাদন করতে নিশ্চিত করুন। করবো?`;
        }

        return res.status(200).json({
          confirmation_required: true,
          confirmation_call: {
            name: toolName,
            args: toolArgs,
            id: call.id
          },
          reply: confirmText
        });
      }

      // Execute tool
      const toolResult = await executeAgentTool(toolName, toolArgs, institute.id, userRole);
      executedToolsCount++;

      await recordAuditAction(supabase, {
        institute_id: institute.id,
        admin_id: adminId,
        tool_name: toolName,
        params: toolArgs,
        result_summary: JSON.stringify(toolResult).slice(0, 300),
        mode: keyResolution.mode
      });

      // Append assistant's functionCall and tool's response to contents
      if (currentResponse.candidates?.[0]?.content) {
        contents.push(currentResponse.candidates[0].content);
      } else {
        contents.push({
          role: 'model',
          parts: [{ functionCall: call }]
        });
      }

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: { result: toolResult }
            }
          }
        ]
      });

      // Call Gemini again with the tool result
      currentResponse = await generateContentSafe(ai, {
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{
            functionDeclarations: AGENT_TOOLS_DECLARATIONS as any
          }]
        }
      });
    }

    if (keyResolution.mode === 'shared' && executedToolsCount > 0) {
      await incrementSharedUsage(supabase, institute.id, institute);
    }

    const finalReply = currentResponse.text || 'কাজটি সম্পন্ন হয়েছে ✅';

    return res.status(200).json({
      reply: finalReply,
      executed_tools: executedToolsCount
    });

  } catch (error: any) {
    console.error('Agent chat API error:', error);
    return res.status(500).json({
      reply: 'দুঃখিত, নির্দেশটি কার্যকর করার সময় একটি সমস্যা দেখা দিয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
      error: error?.message || String(error)
    });
  }
}
