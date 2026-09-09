import { Request, Response } from 'express';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase admin client
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory set to prevent duplicate generation
const generatingPdfs = new Set<string>();

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { html, format = 'a4', orientation = 'portrait', entity_type, entity_id, filename = true } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required.' });
    }

    // Step 4: Calculate SHA-256 hash of the HTML
    const dataHash = crypto.createHash('sha256').update(html).digest('hex');
    const entityKey = entity_type && entity_id 
      ? `${entity_type}_${entity_id}` 
      : `uncategorized_${dataHash}`;
    const storagePath = entity_type && entity_id 
      ? `${entity_type}/${entity_id}.pdf` 
      : `uncategorized/${dataHash}.pdf`;

    // Step 5, 6, 7: Caching logic with Database check
    const { data: cacheRecord, error: dbError } = await supabase
      .from('pdf_cache')
      .select('*')
      .eq('entity_key', entityKey)
      .single();

    // Check if we should serve from cache
    let shouldServeFromCache = false;
    
    if (cacheRecord) {
      if (entity_type === 'fee_receipt') {
        // Fee Receipts are strictly immutable. Once generated, never regenerate even if data hash changes.
        shouldServeFromCache = true;
      } else if (entity_type === 'result' && req.body.is_published === true) {
        // Published results are cached. If hash matches, serve it.
        // If data is corrected, the frontend will send a new hash, triggering regeneration.
        if (cacheRecord.data_hash === dataHash) {
          shouldServeFromCache = true;
        }
      } else {
        // Default behavior (Admit Cards, etc.): Serve from cache ONLY if the data hash matches.
        // This ensures if relevant data changes, a new PDF is generated.
        if (cacheRecord.data_hash === dataHash) {
          shouldServeFromCache = true;
        }
      }
    }

    if (shouldServeFromCache) {
      // CACHE HIT! Generate signed URL
      const { data: signedUrlData } = await supabase.storage
        .from('pdf_cache')
        .createSignedUrl(cacheRecord.pdf_url, 60 * 60, { download: filename });

      if (signedUrlData?.signedUrl) {
        return res.status(200).json({ 
          url: signedUrlData.signedUrl, 
          cached: true, 
          message: 'Served from cache' 
        });
      }
    }

    // Step 8: Duplicate-generation protection
    const generationKey = `${entityKey}_${dataHash}`;
    if (generatingPdfs.has(generationKey)) {
       for (let i = 0; i < 30; i++) {
         await new Promise(r => setTimeout(r, 500));
         if (!generatingPdfs.has(generationKey)) {
            // It finished! Fetch the URL and return
            const { data: signedUrlData } = await supabase.storage
              .from('pdf_cache')
              .createSignedUrl(storagePath, 60 * 60, { download: filename });
            if (signedUrlData?.signedUrl) {
              return res.status(200).json({ url: signedUrlData.signedUrl, cached: true });
            }
         }
       }
    }
    generatingPdfs.add(generationKey);

    // Step 1: Optimize PDF Generation (CPU & Memory)
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 } as any,
      executablePath: executablePath || '/usr/bin/google-chrome',
      headless: true,
    });
    const page = await browser.newPage();
    
    // Set HTML content - using networkidle0 to ensure Tailwind CDN finishes injecting CSS
    await page.setContent(html, {
      waitUntil: 'networkidle0' as any,
    });
    await page.emulateMediaType('print');
    const pdfBuffer = await page.pdf({
      format: format as any,
      landscape: orientation === 'landscape',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });
    await browser.close();

    // Step 3: Supabase Storage private bucket upload
    await supabase.storage
      .from('pdf_cache')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    // Save to Postgres
    await supabase
      .from('pdf_cache')
      .upsert({
        entity_key: entityKey,
        data_hash: dataHash,
        pdf_url: storagePath,
        updated_at: new Date().toISOString()
      }, { onConflict: 'entity_key' });

    // Unlock
    generatingPdfs.delete(generationKey);

    const { data: newSignedUrlData } = await supabase.storage
      .from('pdf_cache')
      .createSignedUrl(storagePath, 60 * 60, { download: filename });

    return res.status(200).json({ 
      url: newSignedUrlData?.signedUrl, 
      cached: false,
      message: 'Generated new PDF'
    });

  } catch (error: any) {
    console.error('PDF generation error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
}
