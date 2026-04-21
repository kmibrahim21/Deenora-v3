import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { class_name, institution_id, institute } = req.query;

    if (!class_name) {
      return res.status(400).json({ success: false, message: 'class_name query parameter is required' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    let resolvedInstitutionId = institution_id ? String(institution_id) : null;

    // If institute code provided, resolve to ID
    if (!resolvedInstitutionId && institute) {
      const instUrl = `${SUPABASE_URL}/rest/v1/institutions?select=id&institute_code=ilike.${encodeURIComponent(String(institute))}`;
      const instRes = await fetch(instUrl, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (instRes.ok) {
        const instData = await instRes.json();
        if (instData && instData.length > 0) {
          resolvedInstitutionId = instData[0].id;
        }
      }
    }

    const targetClass = String(class_name);
    // Include messages for the specific class OR messages for 'All'
    // Format for PostgREST: or=(class_name.eq.Target,class_name.eq.All)
    let filter = `or=(class_name.eq.${encodeURIComponent(targetClass)},class_name.eq.All)`;
    if (resolvedInstitutionId) {
      filter += `&institution_id=eq.${resolvedInstitutionId}`;
    }

    let apiUrl = `${SUPABASE_URL}/rest/v1/messages?${filter}&order=created_at.desc`;

    let response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let data = await response.json();

    // Fallback logic if table doesn't exist yet or if we want to merge with voice broadcasts
    if (!response.ok && data.code === '42P01') {
      // Table doesn't exist, use voice_broadcasts
      let vbFilter = `target_class_name=eq.${encodeURIComponent(targetClass)}`;
      if (resolvedInstitutionId) vbFilter += `&institution_id=eq.${resolvedInstitutionId}`;
      apiUrl = `${SUPABASE_URL}/rest/v1/voice_broadcasts?${vbFilter}&order=created_at.desc`;
      
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      data = await response.json();
    }

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: data.message || 'Error fetching messages' });
    }

    return res.status(200).json({ success: true, data: Array.isArray(data) ? data : [] });

  } catch (error: any) {
    console.error('API Error /messages:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
