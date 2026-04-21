import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
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
    const { institute, student } = req.query;

    if (!institute || !student) {
      return res.status(400).json({ success: false, message: 'Missing institute or student query parameters' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase configuration in environment variables.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // First query institute
    const instUrl = `${SUPABASE_URL}/rest/v1/institutions?select=id,name,logo_url&config_json->>institute_code=eq.${encodeURIComponent(String(institute))}`;
    const instResponse = await fetch(instUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!instResponse.ok) {
      return res.status(500).json({ success: false, message: 'Institution query failed' });
    }

    const institutions = await instResponse.json();
    if (!institutions || institutions.length === 0) {
      return res.status(404).json({ success: false, message: 'Institution not found: Institute Code mismatch' });
    }

    const institutionId = institutions[0].id;

    // Next query student table by admission_number OR roll
    const studentQueryValue = encodeURIComponent(String(student));
    const stdUrl = `${SUPABASE_URL}/rest/v1/students?select=*,classes(class_name)&institution_id=eq.${institutionId}&or=(admission_number.eq.${studentQueryValue},roll.eq.${studentQueryValue})`;
    const stdResponse = await fetch(stdUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!stdResponse.ok) {
        return res.status(500).json({ success: false, message: 'Student query failed' });
    }

    const students = await stdResponse.json();
    if (!students || students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentData = students[0];

    return res.status(200).json({
      success: true,
      data: {
        id: studentData.id,
        name: studentData.student_name,
        roll: studentData.roll,
        admission_number: studentData.admission_number,
        guardian_name: studentData.guardian_name,
        guardian_phone: studentData.guardian_phone,
        class_name: studentData.classes?.class_name || null,
        photo_url: studentData.photo_url,
        institution: institutions[0]
      }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
