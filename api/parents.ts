
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const supabase = getSupabaseAdmin();

function toEnDigits(str: string): string {
  const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  return String(str || '').replace(/[০-৯]/g, d => String(bn.indexOf(d)));
}

export default async function handler(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;
  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  
  let action = url.searchParams.get('action') || (req.query?.action as string);
  
  if (!action) {
    const parts = pathname.split('/');
    action = parts.pop();
    if (action === 'parents' || action === 'parents.ts' || !action) {
      action = 'data';
    }
  }

  console.log(`Parents API: ${req.method} ${pathname} (action: ${action})`);

  try {
    
    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try { req.body = JSON.parse(req.body); } catch (e) {}
    }
    
    const body = req.body || {};

    if (action === 'mark_notifications_read' || action === 'mark_read') {
      const { notification_ids, guardian_phone, student_id } = body;
      try {
        if (Array.isArray(notification_ids) && notification_ids.length > 0) {
          await supabase
            .from('app_notifications')
            .update({ is_read: true })
            .in('id', notification_ids);
        } else if (guardian_phone || student_id) {
          let q = supabase.from('app_notifications').update({ is_read: true }).eq('is_read', false);
          if (student_id) q = q.eq('student_id', student_id);
          else if (guardian_phone) q = q.eq('guardian_phone', guardian_phone);
          await q;
        }
        return res.status(200).json({ success: true });
      } catch (markErr: any) {
        return res.status(500).json({ error: markErr.message });
      }
    }

    const { phone, reg_no, student_id } = body;
    const rawPhone = String(phone || req.query.phone || url.searchParams.get('phone') || '').trim();
    const rawRegNo = String(reg_no || req.query.reg_no || url.searchParams.get('reg_no') || '').trim();
    const qPhone = toEnDigits(rawPhone);
    const qRegNo = toEnDigits(rawRegNo);
    const qStudentId = String(student_id || req.query.student_id || url.searchParams.get('student_id') || '').trim();

    if (!qPhone || (!qRegNo && !qStudentId)) {
      console.warn('Parents API: Missing credentials', { qPhone, qRegNo, qStudentId });
      return res.status(400).json({ error: 'Phone and Registration Number or Student ID are required' });
    }

    console.log(`Parents API: Looking up student with Phone: ${qPhone}, Reg No: ${qRegNo}, Student ID: ${qStudentId}`);

    // Lookup student by student_id or credentials (registration_number, roll, or PIN)
    let student: any = null;

    // Query students matching guardian phone and ID/RegNo
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('*, institutions(*), classes(*)')
      .or(`guardian_phone.eq.${qPhone},guardian_phone_2.eq.${qPhone}`)
      .eq(qRegNo ? 'registration_number' : 'id', qRegNo || qStudentId);

    if (studentError) {
      console.warn('Parents API: student query error:', studentError);
    }

    if (students && students.length > 0) {
      student = students[0];
    } else if (qPhone) {
      // Fallback: match by last 10 digits of phone
      const last10 = qPhone.replace(/\D/g, '').slice(-10);
      const { data: fallbackStudents } = await supabase
        .from('students')
        .select('*, institutions(*), classes(*)')
        .or(`guardian_phone.ilike.%${last10},guardian_phone_2.ilike.%${last10}`)
        .eq(qRegNo ? 'registration_number' : 'id', qRegNo || qStudentId);
      if (fallbackStudents && fallbackStudents.length > 0) {
        student = fallbackStudents[0];
      }
    }

    // Additional fallback: match by roll number or admission number if reg_no was not found
    if (!student && qPhone && qRegNo) {
      const cleanPhone = qPhone.replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);
      const rollNum = parseInt(qRegNo, 10);
      const phoneFilter = [
        `guardian_phone.eq.${qPhone}`,
        `guardian_phone_2.eq.${qPhone}`,
        last10 ? `guardian_phone.ilike.%${last10}` : null,
        last10 ? `guardian_phone_2.ilike.%${last10}` : null
      ].filter(Boolean).join(',');

      if (!isNaN(rollNum)) {
        const { data: rollStudents } = await supabase
          .from('students')
          .select('*, institutions(*), classes(*)')
          .or(phoneFilter)
          .or(`roll.eq.${rollNum},admission_number.eq.${qRegNo}`)
          .limit(5);
        if (rollStudents && rollStudents.length > 0) {
          student = rollStudents[0];
        }
      }

      // If entered 4-digit PIN is last 4 digits of phone
      if (!student && cleanPhone.slice(-4) === qRegNo) {
        const { data: pinStudents } = await supabase
          .from('students')
          .select('*, institutions(*), classes(*)')
          .or(phoneFilter)
          .limit(5);
        if (pinStudents && pinStudents.length > 0) {
          student = pinStudents[0];
        }
      }
    }

    if (!student) {
      return res.status(404).json({ 
        error: 'প্রদত্ত মোবাইল নম্বর বা আইডি দিয়ে কোনো শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে সঠিক তথ্য দিন।' 
      });
    }

    if (student.is_active === false) {
      console.warn('Parents API: Student is deactivated');
      return res.status(401).json({ 
        error: 'আপনার শিক্ষার্থীর একাউন্টটি ইন-অ্যাক্টিভ অবস্থায় আছে। বিস্তারিত জানতে প্রতিষ্ঠানের সাথে যোগাযোগ করুন।',
        code: 'STUDENT_DEACTIVATED'
      });
    }

    if (student.institutions?.is_active === false) {
      console.warn('Parents API: Institution is deactivated');
      return res.status(401).json({ 
        error: 'আপনার প্রতিষ্ঠানটির অ্যাক্সেস বন্ধ করা হয়েছে। দয়া করে অ্যাডমিনের সাথে যোগাযোগ করুন।',
        code: 'INSTITUTION_DEACTIVATED',
        institution_phone: student.institutions?.phone || '+8801629780297'
      });
    }

    let config: any = student.institutions?.config_json || {};
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    const modules = config.modules || {};
    
    if (modules.parent_portal !== true) {
      console.warn('Parents API: Parent portal deactivated for this institution');
      const instPhone = student.institutions?.phone || '';
      return res.status(400).json({ 
        error: `এই প্রতিষ্ঠানের জন্য প্যারেন্ট পোর্টাল বন্ধ রয়েছে।${instPhone ? ` বিস্তারিত জানতে প্রতিষ্ঠানের সাথে যোগাযোগ করুন: ${instPhone}` : ''}`,
        code: 'PORTAL_DEACTIVATED',
        institution_phone: instPhone
      });
    }

    console.log(`Parents API: Found student ${student.student_name} (${student.id})`);

    if (action === 'login' || action === 'data') {
      // Fetch everything for this student
      const studentId = student.id;

      // 1. Attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      // 2. Fees
      const { data: fees } = await supabase
        .from('fees')
        .select('*')
        .eq('student_id', studentId)
        .order('month', { ascending: false });

      // 2.1 Fee Structures & Settings (New for correct calculations)
      let feeStructuresQuery = supabase
        .from('fee_structures')
        .select('*')
        .eq('institution_id', student.institution_id);

      if (student.class_id) {
        feeStructuresQuery = feeStructuresQuery.or(`class_id.eq.${student.class_id},class_id.is.null`);
      } else {
        feeStructuresQuery = feeStructuresQuery.is('class_id', null);
      }

      const { data: feeStructures } = await feeStructuresQuery;

      const { data: studentFeeSettings } = await supabase
        .from('student_fee_settings')
        .select('*')
        .eq('student_id', studentId);

      // 3. Exam Results (Fetch and merge BOTH Befaq and standard exam_marks regardless of result_engine)
      type NormalizedResultRow = {
        source: 'befaq' | 'school';
        exam_id: string;
        subject_id: string;
        marks_obtained: number;
        examRecord: any;
        subjectRecord: any;
      };

      const mergedResultRows: NormalizedResultRow[] = [];
      let befaqSubjectsAll: any[] = [];
      let schoolSubjectsAll: any[] = [];
      const befaqClassStudentsMarks = new Map<string, Map<string, number>>();
      const schoolClassStudentsMarks = new Map<string, Map<string, number>>();

      // Fetch class peer IDs once (strictly scoped to student's class & institution)
      let classStudentIds: string[] = [];
      if (student.class_id) {
        const { data: studentsInClass } = await supabase
          .from('students')
          .select('id')
          .eq('class_id', student.class_id)
          .eq('institution_id', student.institution_id);
        classStudentIds = studentsInClass?.map(s => s.id) || [];
      }

      // 3A. Fetch Befaq results (befaq_results, with safe fallback to befaq_exam_marks if table exists)
      let befaqRows: any[] = [];
      let befaqMarksTable: 'befaq_results' | 'befaq_exam_marks' = 'befaq_results';
      try {
        const { data: befaqData, error: befaqErr } = await supabase
          .from('befaq_results')
          .select('*, befaq_exams(exam_name, exam_year, created_at, is_published, institution_id), befaq_subjects(subject_name, total_marks, passing_marks)')
          .eq('student_id', studentId);
        if (!befaqErr && Array.isArray(befaqData) && befaqData.length > 0) {
          befaqRows = befaqData;
          befaqMarksTable = 'befaq_results';
        } else {
          const { data: altBefaqData, error: altBefaqErr } = await supabase
            .from('befaq_exam_marks')
            .select('*, befaq_exams(exam_name, exam_year, created_at, is_published, institution_id), befaq_subjects(subject_name, total_marks, passing_marks)')
            .eq('student_id', studentId);
          if (!altBefaqErr && Array.isArray(altBefaqData) && altBefaqData.length > 0) {
            befaqRows = altBefaqData;
            befaqMarksTable = 'befaq_exam_marks';
          }
        }
      } catch (befaqFetchErr) {
        console.warn('Parents API: optional befaq marks lookup skipped:', befaqFetchErr);
      }

      befaqRows.forEach(r => {
        const examRec = Array.isArray(r.befaq_exams) ? r.befaq_exams[0] : r.befaq_exams;
        const subRec = Array.isArray(r.befaq_subjects) ? r.befaq_subjects[0] : r.befaq_subjects;
        if (examRec && (!examRec.institution_id || examRec.institution_id === student.institution_id)) {
          mergedResultRows.push({
            source: 'befaq',
            exam_id: r.exam_id,
            subject_id: r.subject_id,
            marks_obtained: Number(r.marks_obtained) || 0,
            examRecord: examRec,
            subjectRecord: subRec,
          });
        }
      });

      const befaqExamIds = Array.from(new Set(befaqRows.map(r => r.exam_id).filter(Boolean)));
      if (befaqExamIds.length > 0) {
        try {
          const { data: subjects } = await supabase
            .from('befaq_subjects')
            .select('*')
            .in('exam_id', befaqExamIds);
          befaqSubjectsAll = subjects || [];

          if (classStudentIds.length > 0) {
            const { data: classMarks } = await supabase
              .from(befaqMarksTable)
              .select('student_id, exam_id, marks_obtained')
              .in('exam_id', befaqExamIds)
              .in('student_id', classStudentIds);

            classMarks?.forEach(m => {
              if (!befaqClassStudentsMarks.has(m.exam_id)) {
                befaqClassStudentsMarks.set(m.exam_id, new Map());
              }
              const studentSumMap = befaqClassStudentsMarks.get(m.exam_id)!;
              studentSumMap.set(m.student_id, (studentSumMap.get(m.student_id) || 0) + Number(m.marks_obtained || 0));
            });
          }
        } catch (befaqMetaErr) {
          console.warn('Parents API: befaq subjects/ranks fetch error:', befaqMetaErr);
        }
      }

      // 3B. Always also fetch standard exam_marks (exams + exam_subjects)
      let schoolRows: any[] = [];
      try {
        const { data: schoolData, error: schoolErr } = await supabase
          .from('exam_marks')
          .select('*, exams(exam_name, exam_date, is_published, institution_id), exam_subjects(subject_name, full_marks, pass_marks)')
          .eq('student_id', studentId);
        if (!schoolErr && Array.isArray(schoolData)) {
          schoolRows = schoolData;
        }
      } catch (schoolFetchErr) {
        console.warn('Parents API: exam_marks lookup error:', schoolFetchErr);
      }

      schoolRows.forEach(r => {
        const examRec = Array.isArray(r.exams) ? r.exams[0] : r.exams;
        const subRec = Array.isArray(r.exam_subjects) ? r.exam_subjects[0] : r.exam_subjects;
        if (examRec && (!examRec.institution_id || examRec.institution_id === student.institution_id)) {
          mergedResultRows.push({
            source: 'school',
            exam_id: r.exam_id,
            subject_id: r.subject_id,
            marks_obtained: Number(r.marks_obtained) || 0,
            examRecord: examRec,
            subjectRecord: subRec,
          });
        }
      });

      const schoolExamIds = Array.from(new Set(schoolRows.map(r => r.exam_id).filter(Boolean)));
      if (schoolExamIds.length > 0) {
        try {
          const { data: subjects } = await supabase
            .from('exam_subjects')
            .select('*')
            .in('exam_id', schoolExamIds);
          schoolSubjectsAll = subjects || [];

          if (classStudentIds.length > 0) {
            const { data: classMarks } = await supabase
              .from('exam_marks')
              .select('student_id, exam_id, marks_obtained')
              .in('exam_id', schoolExamIds)
              .in('student_id', classStudentIds);

            classMarks?.forEach(m => {
              if (!schoolClassStudentsMarks.has(m.exam_id)) {
                schoolClassStudentsMarks.set(m.exam_id, new Map());
              }
              const studentSumMap = schoolClassStudentsMarks.get(m.exam_id)!;
              studentSumMap.set(m.student_id, (studentSumMap.get(m.student_id) || 0) + Number(m.marks_obtained || 0));
            });
          }
        } catch (schoolMetaErr) {
          console.warn('Parents API: school subjects/ranks fetch error:', schoolMetaErr);
        }
      }

      // 4. Notices & Diaries (Filtered by student's class or all classes)
      const { data: rawNotices } = await supabase
        .from('messages')
        .select('*')
        .eq('institution_id', student.institution_id)
        .order('created_at', { ascending: false })
        .limit(100);

      const studentClassName = (student.classes?.class_name || student.class_name || student.class || '').trim().toLowerCase();
      const studentClassId = String(student.class_id || student.classes?.id || '').trim().toLowerCase();

      const isForStudentClass = (targetClass: string | null | undefined): boolean => {
        if (!targetClass) return true;
        const norm = targetClass.trim().toLowerCase();
        if (
          norm === 'all' || 
          norm === 'all classes' || 
          norm === 'all_classes' || 
          norm === 'সকল' || 
          norm === 'সকল শ্রেণী' || 
          norm === 'সকল শ্রেণি' || 
          norm === 'সকলের জন্য' || 
          norm === 'সব' || 
          norm === 'সব শ্রেণি' || 
          norm === 'সব শ্রেণী' ||
          norm === 'all parents' ||
          norm === 'all students'
        ) {
          return true;
        }

        if (!studentClassName && !studentClassId) return true;

        if (studentClassName && norm === studentClassName) return true;
        if (studentClassId && (norm === studentClassId || norm.includes(studentClassId) || studentClassId.includes(norm))) return true;

        const normBengali = (str: string) => str.replace(/শ্রেণী/g, 'শ্রেণি').replace(/[\s_-]+/g, '').toLowerCase();
        const cleanNorm = normBengali(norm);
        const cleanSName = normBengali(studentClassName || '');

        if (cleanNorm && cleanSName && (cleanNorm === cleanSName || cleanNorm.includes(cleanSName) || cleanSName.includes(cleanNorm))) return true;

        return false;
      };

      const notices = (rawNotices || []).filter(n => {
        try {
          let payload: any = {};
          if (typeof n.message === 'string') {
            try { payload = JSON.parse(n.message); } catch (e) { payload = { desc: n.message }; }
          } else {
            payload = n.message || {};
          }

          if (payload && payload.status === 'draft') return false;

          const msgClass = (n.class_name || '').trim();
          const targetClassGroup = (payload?.classGroup || payload?.target_class || payload?.class || '').trim();

          // 1. Notice types (APP_NOTICE, APP_HOLIDAY, APP_PTM, APP_EVENT, APP_DIARY, all, সকলের জন্য)
          if (
            msgClass === 'APP_NOTICE' || 
            msgClass === 'APP_HOLIDAY' || 
            msgClass === 'APP_PTM' || 
            msgClass === 'APP_EVENT' ||
            msgClass === 'APP_DIARY' ||
            msgClass === 'all' || 
            msgClass === 'সকলের জন্য'
          ) {
            return isForStudentClass(targetClassGroup);
          }

                    // 2. Syllabus type (APP_SYLLABUS_...)
          if (msgClass.startsWith('APP_SYLLABUS_')) {
            const syllabusClass = msgClass.replace('APP_SYLLABUS_', '').trim();
            return isForStudentClass(syllabusClass);
          }
          if (msgClass.startsWith('APP_SUGGESTION_')) {
            const suggestionClass = msgClass.replace('APP_SUGGESTION_', '').trim();
            return isForStudentClass(suggestionClass);
          }

          // 3. Routine type (APP_ROUTINE_...)
          if (msgClass.startsWith('APP_ROUTINE_')) {
            const routineClass = msgClass.replace('APP_ROUTINE_', '').trim();
            return isForStudentClass(routineClass);
          }

          // 4. Diary / Specific class message (class_name is the target class)
          return isForStudentClass(msgClass);
        } catch (e) {
          return true;
        }
      }).slice(0, 50);

      // 5. Class Total
      const { count: classTotal } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', student.class_id);

      // 6. Upcoming Events (from calendar_events + notices)
      // Only fetch future events
      const todayString = new Date().toISOString().split('T')[0];
      const { data: upcomingEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('institution_id', student.institution_id)
        .gte('event_date', todayString)
        .order('event_date', { ascending: true })
        .limit(10);

      // Group merged results by exam (supporting both Befaq and standard exam_marks simultaneously)
      const examMap = new Map<string, any>();
      
      const getSubjectGpaAndGrade = (obtained: number, full: number, pass: number) => {
        if (obtained < pass) return { gpa: 0, grade: 'F' };
        const pct = full > 0 ? (obtained / full) * 100 : 0;
        if (pct >= 80) return { gpa: 5.0, grade: 'A+' };
        if (pct >= 70) return { gpa: 4.0, grade: 'A' };
        if (pct >= 60) return { gpa: 3.5, grade: 'A-' };
        if (pct >= 50) return { gpa: 3.0, grade: 'B' };
        if (pct >= 40) return { gpa: 2.0, grade: 'C' };
        if (pct >= 33) return { gpa: 1.0, grade: 'D' };
        return { gpa: 0.0, grade: 'F' };
      };

      mergedResultRows.forEach(r => {
        const isBefaqRow = r.source === 'befaq';
        const examRecord = r.examRecord;
        if (examRecord && examRecord.is_published !== false) {
          const examKey = `${r.source}:${r.exam_id}`;
          if (!examMap.has(examKey)) {
            examMap.set(examKey, {
              id: r.exam_id,
              _source: r.source,
              name: examRecord.exam_name,
              date: isBefaqRow
                ? (examRecord.created_at || new Date().toISOString())
                : (examRecord.exam_date || examRecord.created_at || new Date().toISOString()),
              marks: [],
              gpa: '0.00',
              gpa_grade: 'F',
              total_marks: 0,
              total_full: 0
            });
          }
          
          const subInfo = r.subjectRecord;
          const obtained = Number(r.marks_obtained) || 0;
          const full = isBefaqRow ? (subInfo?.total_marks || 100) : (subInfo?.full_marks || 100);
          const pass = isBefaqRow ? (subInfo?.passing_marks || 33) : (subInfo?.pass_marks || 33);
          const { gpa, grade } = getSubjectGpaAndGrade(obtained, full, pass);

          examMap.get(examKey).marks.push({
            subject_id: r.subject_id,
            subject: subInfo?.subject_name || 'অজানা বিষয়',
            obtained,
            full,
            pass,
            gpa,
            grade
          });
        }
      });

      // Fill in missing subjects and compute GPA / Position for each exam
      examMap.forEach((exam) => {
        const isBefaqExam = exam._source === 'befaq';
        const examId = exam.id;
        const subjectsPool = isBefaqExam ? befaqSubjectsAll : schoolSubjectsAll;
        const classMarksPool = isBefaqExam ? befaqClassStudentsMarks : schoolClassStudentsMarks;

        const examSubjects = subjectsPool.filter(s => s.exam_id === examId);
        examSubjects.forEach(s => {
          const hasMark = exam.marks.some((m: any) => m.subject_id === s.id);
          if (!hasMark) {
            exam.marks.push({
              subject_id: s.id,
              subject: s.subject_name || 'অজানা বিষয়',
              obtained: 0,
              full: isBefaqExam ? (s.total_marks || 100) : (s.full_marks || 100),
              pass: isBefaqExam ? (s.passing_marks || 33) : (s.pass_marks || 33),
              gpa: 0,
              grade: 'F'
            });
          }
        });

        // Calculate summary stats
        let totalPoints = 0;
        let numSubjects = 0;
        let hasFailedClass = false;
        let totalObtained = 0;
        let totalFullMarks = 0;

        exam.marks.forEach((m: any) => {
          totalPoints += m.gpa;
          numSubjects++;
          totalObtained += m.obtained;
          totalFullMarks += m.full;
          if (m.obtained < m.pass) {
            hasFailedClass = true;
          }
        });

        exam.total_marks = totalObtained;
        exam.total_full = totalFullMarks;

        // Calculate Position
        if (classMarksPool.has(examId)) {
          const studentMarksMap = classMarksPool.get(examId)!;
          const sortedStudents = Array.from(studentMarksMap.entries())
            .sort((a: any, b: any) => b[1] - a[1]);
          
          const rank = sortedStudents.findIndex(s => s[0] === studentId) + 1;
          exam.position = rank > 0 ? rank.toString() : '--';
        } else {
          exam.position = '--';
        }

        // Add dynamic remarks based on result
        const isPassed = !hasFailedClass;
        exam.remarks = student.remarks || (isPassed ? 'অভিনন্দন! চমৎকার ফলাফল।' : 'অধ্যবসায়ে মনোযোগী হও।');

        if (numSubjects > 0) {
          if (hasFailedClass) {
            exam.gpa = '0.00';
            exam.gpa_grade = 'F';
          } else {
            let avgGp = totalPoints / numSubjects;
            if (avgGp > 5.0) avgGp = 5.0;
            exam.gpa = avgGp.toFixed(2);

            if (avgGp >= 5.0) exam.gpa_grade = 'A+';
            else if (avgGp >= 4.0) exam.gpa_grade = 'A';
            else if (avgGp >= 3.5) exam.gpa_grade = 'A-';
            else if (avgGp >= 3.0) exam.gpa_grade = 'B';
            else if (avgGp >= 2.0) exam.gpa_grade = 'C';
            else if (avgGp >= 1.0) exam.gpa_grade = 'D';
            else exam.gpa_grade = 'F';
          }
        }

        delete exam._source;
      });

      const examResults = Array.from(examMap.values()).sort((a, b) => {
        const tB = new Date(b.date || 0).getTime() || 0;
        const tA = new Date(a.date || 0).getTime() || 0;
        return tB - tA;
      });

      // Lookup all children associated with this guardian phone (siblings)
      let children: any[] = [];
      try {
        const cleanPhone = qPhone.replace(/\D/g, '');
        const last10Digits = cleanPhone.slice(-10);
        const sPhone = (student.guardian_phone || '').replace(/\D/g, '').slice(-10);
        const sPhone2 = (student.guardian_phone_2 || '').replace(/\D/g, '').slice(-10);

        const conds = new Set<string>();
        if (qPhone) {
          conds.add(`guardian_phone.eq.${qPhone}`);
          conds.add(`guardian_phone_2.eq.${qPhone}`);
        }
        if (last10Digits) {
          conds.add(`guardian_phone.ilike.%${last10Digits}`);
          conds.add(`guardian_phone_2.ilike.%${last10Digits}`);
        }
        if (sPhone) {
          conds.add(`guardian_phone.ilike.%${sPhone}`);
          conds.add(`guardian_phone_2.ilike.%${sPhone}`);
        }
        if (sPhone2) {
          conds.add(`guardian_phone.ilike.%${sPhone2}`);
          conds.add(`guardian_phone_2.ilike.%${sPhone2}`);
        }

        const orFilter = Array.from(conds).join(',');

        const { data: siblings } = await supabase
          .from('students')
          .select('id, student_name, name_en, roll, registration_number, admission_number, photo_url, class_id, is_active, institution_id, guardian_phone, guardian_phone_2, section, classes(id, class_name), institutions(id, name, logo_url, is_active, config_json, phone)')
          .or(orFilter)
          .eq('is_active', true)
          .order('roll', { ascending: true });

        if (siblings && siblings.length > 0) {
          const activeSiblings = siblings.filter((s: any) => {
            if (s.institutions?.is_active === false) return false;
            let cfg: any = s.institutions?.config_json || {};
            if (typeof cfg === 'string') {
              try { cfg = JSON.parse(cfg); } catch (e) { cfg = {}; }
            }
            return cfg.modules?.parent_portal !== false;
          });

          children = activeSiblings.map((s: any) => ({
            id: s.id,
            student_name: s.student_name,
            name_en: s.name_en,
            roll: s.roll,
            registration_number: s.registration_number,
            admission_number: s.admission_number,
            class_id: s.class_id,
            class_name: s.classes?.class_name || '',
            section: s.section || '',
            photo_url: s.photo_url,
            institution_id: s.institution_id,
            institution_name: s.institutions?.name || '',
            institution_logo: s.institutions?.logo_url || '',
            guardian_phone: s.guardian_phone || qPhone
          }));
        }
      } catch (childErr) {
        console.warn('Error fetching siblings in parents API:', childErr);
      }

      const currentChildObj = {
        id: student.id,
        student_name: student.student_name,
        name_en: student.name_en,
        roll: student.roll,
        registration_number: student.registration_number,
        admission_number: student.admission_number,
        class_id: student.class_id,
        class_name: student.classes?.class_name || '',
        section: student.section || '',
        photo_url: student.photo_url,
        institution_id: student.institution_id,
        institution_name: student.institutions?.name || '',
        institution_logo: student.institutions?.logo_url || '',
        guardian_phone: student.guardian_phone || qPhone
      };

      if (!children.some(c => c.id === student.id)) {
        children.unshift(currentChildObj);
      }

      // Fetch In-App Notifications
      let notifications: any[] = [];
      try {
        const cleanPhone = qPhone.replace(/\D/g, '');
        const last10 = cleanPhone.slice(-10);
        const conds = new Set<string>();
        if (student.id) conds.add(`student_id.eq.${student.id}`);
        if (qPhone) conds.add(`guardian_phone.eq.${qPhone}`);
        if (last10) conds.add(`guardian_phone.ilike.%${last10}`);
        if (student.guardian_phone) conds.add(`guardian_phone.eq.${student.guardian_phone}`);

        const { data: notifData } = await supabase
          .from('app_notifications')
          .select('*')
          .or(Array.from(conds).join(','))
          .order('created_at', { ascending: false })
          .limit(50);

        if (notifData && Array.isArray(notifData)) {
          notifications = notifData;
        }
      } catch (notifErr) {
        console.warn('Error fetching notifications in parents API:', notifErr);
      }

      // 7. Hifz & Sabaq Records (Strictly scoped to verified student & institution)
      let hifzRecords: any[] = [];
      try {
        const { data: hifzData } = await supabase
          .from('hifz_records')
          .select('*')
          .eq('student_id', studentId)
          .eq('institution_id', student.institution_id)
          .order('record_date', { ascending: false })
          .limit(180);

        if (hifzData && Array.isArray(hifzData)) {
          hifzRecords = hifzData;
        }
      } catch (hifzErr) {
        console.warn('Error fetching hifz_records in parents API:', hifzErr);
      }

      // 8. Hostel Allocation (with room/warden details) & Recent Gate Passes / Leaves (Strictly scoped to verified student & institution)
      let hostelAllocation: any = null;
      let hostelLeaves: any[] = [];
      try {
        const { data: allocRows } = await supabase
          .from('hostel_allocations')
          .select('id, institution_id, student_id, room_id, seat_number, residential_type, fee_category, monthly_boarding_fee, status, allocated_at')
          .eq('student_id', studentId)
          .eq('institution_id', student.institution_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(2);

        if (allocRows && allocRows.length > 0) {
          const activeAlloc = allocRows.find((a: any) => !!a.room_id) || allocRows[0];
          let roomDetails: any = null;
          if (activeAlloc.room_id) {
            const { data: roomRow } = await supabase
              .from('hostel_rooms')
              .select('id, building_name, floor_name, room_number, room_title, warden_name, warden_phone')
              .eq('id', activeAlloc.room_id)
              .eq('institution_id', student.institution_id)
              .maybeSingle();
            if (roomRow) {
              roomDetails = roomRow;
            }
          }
          hostelAllocation = {
            ...activeAlloc,
            room: roomDetails,
            hostel_rooms: roomDetails,
          };
        }
      } catch (hostelAllocErr) {
        console.warn('Error fetching hostel_allocations in parents API:', hostelAllocErr);
      }

      try {
        const { data: leaveRows } = await supabase
          .from('hostel_leaves')
          .select('*')
          .eq('student_id', studentId)
          .eq('institution_id', student.institution_id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (leaveRows && Array.isArray(leaveRows)) {
          hostelLeaves = leaveRows;
        }
      } catch (hostelLeaveErr) {
        console.warn('Error fetching hostel_leaves in parents API:', hostelLeaveErr);
      }

      // Strip large public_site content (e.g. base64 gallery_urls) from returned institution payload
      let sanitizedInstitution = student.institutions;
      if (sanitizedInstitution && typeof sanitizedInstitution === 'object') {
        const instClone = { ...sanitizedInstitution };
        if (instClone.config_json) {
          let parsedCfg: any = instClone.config_json;
          if (typeof parsedCfg === 'string') {
            try {
              parsedCfg = JSON.parse(parsedCfg);
            } catch {
              parsedCfg = {};
            }
          }
          if (parsedCfg && typeof parsedCfg === 'object' && 'public_site' in parsedCfg) {
            const { public_site: _omittedPublicSite, ...restCfg } = parsedCfg;
            instClone.config_json = restCfg;
          }
        }
        sanitizedInstitution = instClone;
      }
      const sanitizedStudent = {
        ...student,
        institutions: sanitizedInstitution,
      };

      return res.status(200).json({
        student: sanitizedStudent,
        children,
        attendance: attendance || [],
        fees: fees || [],
        feeStructures: feeStructures || [],
        studentFeeSettings: studentFeeSettings || [],
        examResults: examResults,
        notices: notices || [],
        events: upcomingEvents || [],
        classTotal: classTotal || 0,
        institution: sanitizedInstitution,
        notifications: notifications || [],
        hifz_records: hifzRecords || [],
        hostel_allocation: hostelAllocation,
        hostel_leaves: hostelLeaves || []
      });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err: any) {
    console.error(`Parents API error:`, err);
    let msg = err.message || 'Internal server error';
    if (msg.includes('JSON object') || msg.includes('multiple (or no) rows') || msg.includes('PGRST116')) {
      msg = 'প্রদত্ত মোবাইল নম্বর বা আইডি দিয়ে একাধিক শিক্ষার্থী পাওয়া গেছে অথবা তথ্য মেলেনি। অনুগ্রহ করে শিক্ষার্থীর সঠিক রোল নম্বর বা রেজিস্ট্রেশন নম্বর দিয়ে চেষ্টা করুন।';
    }
    return res.status(500).json({ error: msg });
  }
}

