import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
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
    const { institute, student } = req.query;

    if (!institute || !student) {
      return res.status(400).json({ success: false, message: 'Missing institute or student query parameters' });
    }

    const cleanInstitute = String(institute).trim();
    const cleanStudent = String(student).trim();

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    // VERY IMPORTANT: Use Service Role Key to bypass RLS policies when fetching data server-side
    const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase configuration in environment variables.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // First query institute (case-insensitive for safety, using the new institute_code column)
    const instUrl = `${SUPABASE_URL}/rest/v1/institutions?select=id,name,logo_url&institute_code=ilike.${cleanInstitute}`;
    const instResponse = await fetch(instUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
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

    // Build the query. We test both admission_number and roll.
    // If cleanStudent is a valid number, we can search both.
    // If cleanStudent has letters/symbols, we should NOT search roll to avoid PostgREST integer syntax error.
    // Allow partial match (like '%1122%') using '*' prefix and suffix in Postgrest for ilike
    let orQuery = `admission_number.ilike.*${encodeURIComponent(cleanStudent)}*`;
    if (!isNaN(Number(cleanStudent))) {
      orQuery = `admission_number.ilike.*${encodeURIComponent(cleanStudent)}*,roll.eq.${cleanStudent}`;
    }

    const stdUrl = `${SUPABASE_URL}/rest/v1/students?select=id,student_name,roll,admission_number,guardian_name,guardian_phone,photo_url,institution_id,classes(class_name)&institution_id=eq.${institutionId}&or=(${orQuery})&limit=1`;
    
    // Add debugging console log
    console.log(`[Login Attempt] Institute: ${cleanInstitute}, Student: ${cleanStudent}, URL: ${stdUrl}`);

    const stdResponse = await fetch(stdUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!stdResponse.ok) {
        return res.status(500).json({ success: false, message: 'Student query failed' });
    }

    const students = await stdResponse.json();
    if (!students || students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found', 
        debug: { 
          searchedInstitute: cleanInstitute, 
          searchedStudent: cleanStudent,
          foundInstitutionId: institutionId,
          attemptedQueryUrl: stdUrl
        } 
      });
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
