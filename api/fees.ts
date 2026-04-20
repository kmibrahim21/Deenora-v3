import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { student_id } = req.query;

    if (!student_id) {
      return res.status(400).json({ success: false, message: 'Missing student_id query parameter' });
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const url = `${SUPABASE_URL}/rest/v1/fees?select=*&student_id=eq.${student_id}&order=month.desc`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        return res.status(500).json({ success: false, message: 'Database query failed' });
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
