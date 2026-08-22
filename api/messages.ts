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

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { id, class_name, title, message: msgBody, sender_name } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, message: 'id is required for update' });
      }

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, message: 'Server configuration error' });
      }

      const stringifiedMessage = typeof msgBody === 'string' ? msgBody : JSON.stringify(msgBody);

      // Perform update using fetch with service role key to bypass RLS
      const apiUrl = `${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`;
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          class_name,
          title,
          message: stringifiedMessage,
          sender_name: sender_name || 'Admin',
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to update message' }));
        return res.status(response.status).json({ success: false, message: errData.message });
      }

      const data = await response.json();
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error('API Error updating message:', error);
      return res.status(500).json({ success: false, message: error.message || 'Error updating message' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { class_name, institution_id, institute } = req.query;

    if (!class_name) {
      return res.status(400).json({ success: false, message: 'class_name query parameter is required' });
    }

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
    
    // Include messages for the specific class, 'All', and special app types
    const orConditions = [
      `class_name.eq.${encodeURIComponent(targetClass)}`,
      `class_name.eq.All`,
      `class_name.eq.APP_NOTICE`,
      `class_name.eq.APP_HOLIDAY`,
      `class_name.eq.APP_PTM`,
      `class_name.eq.APP_EVENT`,
      `class_name.eq.APP_ROUTINE_${encodeURIComponent(targetClass)}`,
      `class_name.eq.APP_SYLLABUS_${encodeURIComponent(targetClass)}`
    ];
    let filter = `or=(${orConditions.join(',')})`;

    if (resolvedInstitutionId) {
      filter += `&institution_id=eq.${resolvedInstitutionId}`;
    }

    let apiUrl = `${SUPABASE_URL}/rest/v1/messages?${filter}&order=created_at.desc&limit=50`;

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
      apiUrl = `${SUPABASE_URL}/rest/v1/voice_broadcasts?${vbFilter}&order=created_at.desc&limit=50`;
      
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      data = await response.json();
    }

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: data.message || 'Error fetching messages' });
    }

    let resultList = Array.isArray(data) ? data : [];
    if (class_name && String(class_name).toLowerCase() !== 'all') {
      const targetCls = String(class_name).trim().toLowerCase();
      resultList = resultList.filter((item: any) => {
        try {
          const payload = typeof item.message === 'string' ? JSON.parse(item.message) : (item.message || {});
          if (payload?.status === 'draft') return false;
          const classGroup = (payload?.classGroup || payload?.target_class || '').trim().toLowerCase();
          if (classGroup && classGroup !== 'all' && classGroup !== 'all classes' && classGroup !== 'সকল' && classGroup !== 'সকল শ্রেণী' && classGroup !== 'সকল শ্রেণি' && classGroup !== 'সকলের জন্য' && classGroup !== 'সব') {
            if (classGroup !== targetCls && classGroup.replace(/\s+/g, '') !== targetCls.replace(/\s+/g, '')) {
              return false;
            }
          }
        } catch (e) {}
        return true;
      });
    }

    return res.status(200).json({ success: true, data: resultList });

  } catch (error: any) {
    console.error('API Error /messages:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
