import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const student_id = req.query.student_id || req.query.studentId || req.query.student || req.query.id;

    if (!student_id) {
      console.error('API Error: Missing student_id. Received query:', req.query);
      return res.status(400).json({ 
        success: false, 
        message: 'Missing student_id query parameter',
        received_params: req.query
      });
    }

    // Basic UUID validation - make it slightly more lenient or log if it fails
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(student_id))) {
      console.warn('API Warning: student_id is not a standard UUID format:', student_id);
      // We will still try the query, but log the warning. Some systems might use different IDs.
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase configuration in environment variables.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // Fetch attendance from Supabase, order by date desc. Optimize select to prevent huge payloads
    const url = `${SUPABASE_URL}/rest/v1/attendance?select=id,date,status,session,late_minutes&student_id=eq.${student_id}&order=date.desc&limit=100`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase Attendance Query Error:', response.status, errorText);
        return res.status(500).json({ 
          success: false, 
          message: `Database query failed (${response.status})`,
          debug: process.env.NODE_ENV !== 'production' ? errorText : undefined
        });
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
