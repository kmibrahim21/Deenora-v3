import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { class_name } = req.query;

    if (!class_name) {
      return res.status(400).json({ success: false, message: 'class_name query parameter is required' });
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // Try fetching from a 'messages' table
    let apiUrl = `${SUPABASE_URL}/rest/v1/messages?class_name=eq.${encodeURIComponent(String(class_name))}&order=created_at.desc`;

    let response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let data = await response.json();

    // If 'messages' table does not exist (PostgREST code 42P01), fallback to voice_broadcasts
    if (!response.ok && data.code === '42P01') {
      apiUrl = `${SUPABASE_URL}/rest/v1/voice_broadcasts?target_class_name=eq.${encodeURIComponent(String(class_name))}&order=created_at.desc`;
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      data = await response.json();
    }

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: data.message || 'Error fetching messages', error: data });
    }

    return res.status(200).json({ success: true, data });

  } catch (error: any) {
    console.error('API Error /messages:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
}
