import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { institute, student } = req.query;

    if (!institute || !student) {
      return res.status(400).json({ success: false, message: 'Missing institute or student query parameters' });
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // First query institute
    const instUrl = `${SUPABASE_URL}/rest/v1/institutions?select=id,name,logo_url&config_json->>institute_code=eq.${institute}`;
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
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }

    const institutionId = institutions[0].id;

    // Next query student table
    const stdUrl = `${SUPABASE_URL}/rest/v1/students?select=*,classes(class_name)&institution_id=eq.${institutionId}&roll=eq.${student}`;
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
