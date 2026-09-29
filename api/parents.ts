
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

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
    const supabase = getSupabaseAdmin();
    
    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try { req.body = JSON.parse(req.body); } catch (e) {}
    }
    
    const body = req.body || {};
    const { phone, reg_no, student_id } = body;
    const qPhone = String(phone || req.query.phone || url.searchParams.get('phone') || '').trim();
    const qRegNo = String(reg_no || req.query.reg_no || url.searchParams.get('reg_no') || '').trim();
    const qStudentId = String(student_id || req.query.student_id || url.searchParams.get('student_id') || '').trim();

    if (!qPhone || (!qRegNo && !qStudentId)) {
      console.warn('Parents API: Missing credentials', { qPhone, qRegNo, qStudentId });
      return res.status(400).json({ error: 'Phone and Registration Number or Student ID are required' });
    }

    console.log(`Parents API: Looking up student with Phone: ${qPhone}, Reg No: ${qRegNo}, Student ID: ${qStudentId}`);

    // Lookup student by student_id or registration_number
    let student: any = null;
    let studentError: any = null;

    if (qStudentId) {
      const res = await supabase
        .from('students')
        .select('*, institutions(*), classes(*)')
        .or(`guardian_phone.eq.${qPhone},guardian_phone_2.eq.${qPhone}`)
        .eq('id', qStudentId)
        .maybeSingle();
      student = res.data;
      studentError = res.error;
    }

    if (!student && qStudentId) {
      const cleanPhone = qPhone.replace(/\D/g, '');
      const last10Digits = cleanPhone.slice(-10);
      if (last10Digits) {
        const res = await supabase
          .from('students')
          .select('*, institutions(*), classes(*)')
          .eq('id', qStudentId)
          .or(`guardian_phone.ilike.%${last10Digits},guardian_phone_2.ilike.%${last10Digits}`)
          .maybeSingle();
        if (res.data) {
          student = res.data;
        }
      }
    }

    if (!student && qRegNo) {
      const res = await supabase
        .from('students')
        .select('*, institutions(*), classes(*)')
        .or(`guardian_phone.eq.${qPhone},guardian_phone_2.eq.${qPhone}`)
        .eq('registration_number', qRegNo)
        .maybeSingle();
      student = res.data;
      studentError = res.error;
    }

    // Secondary fallback without phone filter if phone matching with leading zero differences
    if (!student && qRegNo) {
      const cleanPhone = qPhone.replace(/\D/g, '');
      const last10Digits = cleanPhone.slice(-10);
      if (last10Digits) {
        const res = await supabase
          .from('students')
          .select('*, institutions(*), classes(*)')
          .eq('registration_number', qRegNo)
          .or(`guardian_phone.ilike.%${last10Digits},guardian_phone_2.ilike.%${last10Digits}`)
          .maybeSingle();
        if (res.data) {
          student = res.data;
        }
      }
    }

    if (studentError) {
      console.error('Parents API: Supabase error looking up student:', studentError);
      throw studentError;
    }

    if (!student) {
      console.warn('Parents API: Student not found');
      return res.status(404).json({ error: 'Student not found with provided credentials' });
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
      const { data: feeStructures } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('institution_id', student.institution_id)
        .or(`class_id.eq.${student.class_id},class_id.is.null`);

      const { data: studentFeeSettings } = await supabase
        .from('student_fee_settings')
        .select('*')
        .eq('student_id', studentId);

      // 3. Exam Results
      const engine = config.result_engine || 'school';
      let resultsData: any[] = [];
      let allSubjects: any[] = [];
      const allClassStudentsMarks = new Map();
      let isBefaq = engine === 'befaq';
      
      if (isBefaq) {
        const { data: befaqData } = await supabase
          .from('befaq_results')
          .select('*, befaq_exams(exam_name, exam_year, created_at, is_published), befaq_subjects(subject_name, total_marks, passing_marks)')
          .eq('student_id', studentId);
        resultsData = befaqData || [];
        
        const examIds = Array.from(new Set(resultsData.map(r => r.exam_id).filter(Boolean)));
        if (examIds.length > 0) {
          const { data: subjects } = await supabase
            .from('befaq_subjects')
            .select('*')
            .in('exam_id', examIds);
          allSubjects = subjects || [];
          
          const { data: studentsInClass } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', student.class_id);
          const classStudentIds = studentsInClass?.map(s => s.id) || [];
          
          if (classStudentIds.length > 0) {
            const { data: classMarks } = await supabase
              .from('befaq_results')
              .select('student_id, exam_id, marks_obtained')
              .in('exam_id', examIds)
              .in('student_id', classStudentIds);
            
            classMarks?.forEach(m => {
              if (!allClassStudentsMarks.has(m.exam_id)) {
                allClassStudentsMarks.set(m.exam_id, new Map());
              }
              const studentSumMap = allClassStudentsMarks.get(m.exam_id);
              studentSumMap.set(m.student_id, (studentSumMap.get(m.student_id) || 0) + Number(m.marks_obtained || 0));
            });
          }
        }
      } else {
        const { data: schoolData } = await supabase
          .from('exam_marks')
          .select('*, exams(exam_name, exam_date, is_published), exam_subjects(subject_name, full_marks, pass_marks)')
          .eq('student_id', studentId);
        resultsData = schoolData || [];
        
        const examIds = Array.from(new Set(resultsData.map(r => r.exam_id).filter(Boolean)));
        if (examIds.length > 0) {
          const { data: subjects } = await supabase
            .from('exam_subjects')
            .select('*')
            .in('exam_id', examIds);
          allSubjects = subjects || [];
          
          const { data: studentsInClass } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', student.class_id);
          const classStudentIds = studentsInClass?.map(s => s.id) || [];
          
          if (classStudentIds.length > 0) {
            const { data: classMarks } = await supabase
              .from('exam_marks')
              .select('student_id, exam_id, marks_obtained')
              .in('exam_id', examIds)
              .in('student_id', classStudentIds);
            
            classMarks?.forEach(m => {
              if (!allClassStudentsMarks.has(m.exam_id)) {
                allClassStudentsMarks.set(m.exam_id, new Map());
              }
              const studentSumMap = allClassStudentsMarks.get(m.exam_id);
              studentSumMap.set(m.student_id, (studentSumMap.get(m.student_id) || 0) + Number(m.marks_obtained || 0));
            });
          }
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

      // Group results by exam
      const examMap = new Map();
      
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

      // Also get all subjects for these exams to ensure we show everything even if marks are missing
      const examIds = Array.from(new Set((resultsData || []).map(r => r.exam_id).filter(Boolean)));

      resultsData?.forEach(r => {
        const examRecord = isBefaq ? r.befaq_exams : r.exams;
        if (examRecord && examRecord.is_published !== false) {
          const examId = r.exam_id;
          if (!examMap.has(examId)) {
            examMap.set(examId, {
              id: examId,
              name: examRecord.exam_name,
              date: isBefaq ? (examRecord.created_at || new Date().toISOString()) : examRecord.exam_date,
              marks: [],
              gpa: '0.00',
              gpa_grade: 'F',
              total_marks: 0,
              total_full: 0
            });
          }
          
          const subjectRecord = isBefaq ? r.befaq_subjects : r.exam_subjects;
          const subInfo = Array.isArray(subjectRecord) ? subjectRecord[0] : subjectRecord;
          const obtained = Number(r.marks_obtained) || 0;
          const full = isBefaq ? (subInfo?.total_marks || 100) : (subInfo?.full_marks || 100);
          const pass = isBefaq ? (subInfo?.passing_marks || 33) : (subInfo?.pass_marks || 33);
          const { gpa, grade } = getSubjectGpaAndGrade(obtained, full, pass);

          examMap.get(examId).marks.push({
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

      // Fill in missing subjects for each exam
      examMap.forEach((exam, examId) => {
        const examSubjects = allSubjects.filter(s => s.exam_id === examId);
        examSubjects.forEach(s => {
          const hasMark = exam.marks.some((m: any) => m.subject_id === s.id);
          if (!hasMark) {
            exam.marks.push({
              subject_id: s.id,
              subject: s.subject_name || 'অজানা বিষয়',
              obtained: 0,
              full: isBefaq ? (s.total_marks || 100) : (s.full_marks || 100),
              pass: isBefaq ? (s.passing_marks || 33) : (s.pass_marks || 33),
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
        if (allClassStudentsMarks.has(examId)) {
          const studentMarksMap = allClassStudentsMarks.get(examId);
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
      });

      const examResults = Array.from(examMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
          .eq('institution_id', student.institution_id)
          .eq('is_active', true)
          .order('roll', { ascending: true });

        if (siblings && siblings.length > 0) {
          children = siblings.map((s: any) => ({
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

      return res.status(200).json({
        student,
        children,
        attendance: attendance || [],
        fees: fees || [],
        feeStructures: feeStructures || [],
        studentFeeSettings: studentFeeSettings || [],
        examResults: examResults,
        notices: notices || [],
        events: upcomingEvents || [],
        classTotal: classTotal || 0,
        institution: student.institutions
      });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err: any) {
    console.error(`Parents API error:`, err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
