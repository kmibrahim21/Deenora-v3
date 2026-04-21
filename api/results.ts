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
    const { student_id } = req.query;

    if (!student_id) {
      return res.status(400).json({ success: false, message: 'Missing student_id query parameter' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase configuration in environment variables.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    // 1. Get student to find institution_id
    const studentRes = await fetch(`${SUPABASE_URL}/rest/v1/students?select=institution_id&id=eq.${student_id}`, { headers });
    if (!studentRes.ok) throw new Error('Student lookup failed');
    const studentData = await studentRes.json();
    if (!studentData || studentData.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const institution_id = studentData[0].institution_id;

    // 2. Get institution result config
    const instRes = await fetch(`${SUPABASE_URL}/rest/v1/institutions?select=config_json&id=eq.${institution_id}`, { headers });
    if (!instRes.ok) throw new Error('Institution lookup failed');
    const instData = await instRes.json();
    const config = instData[0]?.config_json || {};
    const engine = config.result_engine || 'school';

    let results = [];

    // 3. Fetch based on engine
    if (engine === 'befaq') {
      const marksRes = await fetch(`${SUPABASE_URL}/rest/v1/befaq_results?select=*&student_id=eq.${student_id}`, { headers });
      if (marksRes.ok) {
        const marks = await marksRes.json();
        
        // Also fetch subjects to join
        const examIds = [...new Set(marks.map((m: any) => m.exam_id))];
        let allSubjects: any[] = [];
        for (const exId of examIds) {
          const subRes = await fetch(`${SUPABASE_URL}/rest/v1/befaq_subjects?select=*&exam_id=eq.${exId}`, { headers });
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
      const marksRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_marks?select=*&student_id=eq.${student_id}`, { headers });
      if (marksRes.ok) {
        const marks = await marksRes.json();
        
        const examIds = [...new Set(marks.map((m: any) => m.exam_id))];
        let allSubjects: any[] = [];
        let allExams: any[] = [];
        
        for (const exId of examIds) {
          const subRes = await fetch(`${SUPABASE_URL}/rest/v1/exam_subjects?select=*&exam_id=eq.${exId}`, { headers });
          if (subRes.ok) allSubjects.push(...await subRes.json());
          
          const exRes = await fetch(`${SUPABASE_URL}/rest/v1/exams?select=id,exam_name&id=eq.${exId}`, { headers });
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
