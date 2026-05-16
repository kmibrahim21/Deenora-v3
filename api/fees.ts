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

    const url = `${SUPABASE_URL}/rest/v1/fees?select=id,month,amount_paid,amount_due,discount,status,paid_at&student_id=eq.${student_id}&order=month.desc&limit=100`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase Fees Query Error:', response.status, errorText);
        return res.status(500).json({ 
          success: false, 
          message: `Database query failed (${response.status})`,
          debug: process.env.NODE_ENV !== 'production' ? errorText : undefined
        });
    }

    const rawData = await response.json();
    const data = Array.isArray(rawData) ? rawData.map(f => ({
      id: f.id,
      month: f.month,
      total_amount: (Number(f.amount_paid) || 0) + (Number(f.amount_due) || 0),
      discount: f.discount,
      paid_amount: f.amount_paid,
      status: f.status,
      payment_date: f.paid_at
    })) : [];

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
