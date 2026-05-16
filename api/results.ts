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

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    // 1. Get student to find institution_id
    const studentRes = await fetch(`${SUPABASE_URL}/rest/v1/students?select=institution_id&id=eq.${student_id}`, { headers });
    if (!studentRes.ok) {
      const errTxt = await studentRes.text();
      console.error('Student lookup failed:', studentRes.status, errTxt);
      return res.status(500).json({ success: false, message: `Student lookup failed (${studentRes.status})` });
    }
    const studentData = await studentRes.json();
    if (!studentData || studentData.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const institution_id = studentData[0].institution_id;

    // 2. Get institution result config
    const instRes = await fetch(`${SUPABASE_URL}/rest/v1/institutions?select=config_json&id=eq.${institution_id}`, { headers });
    if (!instRes.ok) {
        const errTxt = await instRes.text();
        console.error('Institution lookup failed:', instRes.status, errTxt);
        return res.status(500).json({ success: false, message: `Institution lookup failed (${instRes.status})` });
    }
    const instData = await instRes.json();
    const config = instData[0]?.config_json || {};
    const engine = config.result_engine || 'school';

    let results = [];

    // 3. Fetch based on engine
    if (engine === 'befaq') {
      const marksRes = await fetch(`${SUPABASE_URL}/rest/v1/befaq_results?select=exam_id,subject_id,marks_obtained&student_id=eq.${student_id}&limit=500`, { headers });
      if (marksRes.ok) {
        const marks = await marksRes.json();
        
        // Also fetch subjects to join
        const examIds = [...new Set(marks.map((m: any) => m.exam_id))];
        let allSubjects: any[] = [];
        if (examIds.length > 0) {
           const subRes = await fetch(`${SUPABASE_URL}/rest/v1/befaq_subjects?select=id,subject_name,passing_marks,total_marks&exam_id=in.(${examIds.join(',')})&limit=500`, { headers });
           if (subRes.ok) allSubjects.push(...await subRes.json());
        }

        results = marks.map((m: any) => {
          const subject = allSubjects.find(s => s.id === m.subject_id);
          const isPass = m.marks_obtained >= (subject?.passing_marks || 0);
          return {
            exam_id: m.exam_id,
            subject: subject?.subject_name || 'Unknown',
            marks_obtained: m.marks_obtained,
            total_marks: subject?.total_marks || 100,
            passing_marks: subject?.passing_marks || 33,
            status: isPass ? 'Pass' : 'Fail'
          };
        });
      }
    } else {
      // School engine
      const marksRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_marks?select=exam_id,subject_id,marks_obtained&student_id=eq.${student_id}&limit=500`, { headers });
      if (marksRes.ok) {
        const marks = await marksRes.json();
        
        const examIds = [...new Set(marks.map((m: any) => m.exam_id))];
        let allSubjects: any[] = [];
        let allExams: any[] = [];
        
        if (examIds.length > 0) {
          const subRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_subjects?select=id,subject_name,full_marks&exam_id=in.(${examIds.join(',')})&limit=500`, { headers });
          if (subRes.ok) allSubjects.push(...await subRes.json());
          
          const exRes = await fetch(`${SUPABASE_URL}/rest/v1/exams?select=id,exam_name&id=in.(${examIds.join(',')})&limit=50`, { headers });
          if (exRes.ok) allExams.push(...(await exRes.json()));
        }

        results = marks.map((m: any) => {
          const subject = allSubjects.find(s => s.id === m.subject_id);
          const exam = allExams.find(e => e.id === m.exam_id);
          const percent = (m.marks_obtained / (subject?.full_marks || 100)) * 100;
          let grade = 'F';
          if (percent >= 80) grade = 'A+';
          else if (percent >= 70) grade = 'A';
          else if (percent >= 60) grade = 'A-';
          else if (percent >= 50) grade = 'B';
          else if (percent >= 40) grade = 'C';
          else if (percent >= 33) grade = 'D';

          return {
            exam: exam?.exam_name || 'Unknown',
            subject: subject?.subject_name || 'Unknown',
            marks_obtained: m.marks_obtained,
            full_marks: subject?.full_marks || 100,
            grade
          };
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: results
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
