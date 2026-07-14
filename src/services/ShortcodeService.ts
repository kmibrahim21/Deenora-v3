
import { supabase } from 'lib/supabase';

export const ShortcodeService = {
  /**
   * Replaces shortcodes in a message with student-specific data.
   */
  replaceShortcodes: (message: string, data: any): string => {
    if (!message) return '';
    
    console.log('Replacing shortcodes in message:', message);
    console.log('Data for replacement:', data);
    
    const shortcodes: Record<string, any> = {
      '{student_name}': data.student_name || '-',
      '{father_name}': data.guardian_name || '-',
      '{class}': data.class_name || '-',
      '{roll}': data.roll || '-',
      '{due_amount}': data.due_amount !== undefined ? data.due_amount : '-',
      '{paid_amount}': data.paid_amount !== undefined ? data.paid_amount : '-',
      '{result_grade}': data.result_grade || '-',
      '{gpa}': data.result_gpa || '-',
      '{merit_position}': data.merit_position || '-',
      '{exam_name}': data.exam_name || '-',
      '{exam_subject}': data.exam_subject || '-',
      '{attendance_percentage}': data.attendance_percentage !== undefined ? `${data.attendance_percentage}%` : '-',
      '{institution_name}': data.institution_name || '-',
      '{month}': data.month || '-',
      '{date}': new Date().toLocaleDateString('bn-BD'),
    };

    let finalMessage = message;
    Object.entries(shortcodes).forEach(([code, value]) => {
      const regex = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      finalMessage = finalMessage.replace(regex, String(value));
    });

    console.log('Final message after replacement:', finalMessage);
    return finalMessage;
  },

  /**
   * Fetches all necessary data for shortcode replacement for a list of students.
   */
  fetchShortcodeData: async (institutionId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return [];

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 1. Fetch Students, Classes, and Institution Info
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        class_id,
        student_name,
        guardian_name,
        roll,
        classes (class_name),
        institutions (name)
      `)
      .in('id', studentIds);

    if (studentError) {
      console.error('Error fetching student data for shortcodes:', studentError);
      return [];
    }

    // 2. Fetch Accounting Data (Total Balance Calculation)
    const [allFeesRes, structuresRes, settingsRes] = await Promise.all([
      supabase.from('fees').select('student_id, amount_paid, discount').in('student_id', studentIds),
      supabase.from('fee_structures').select('*').eq('institution_id', institutionId),
      supabase.from('student_fee_settings').select('*').in('student_id', studentIds)
    ]);

    const allFees = allFeesRes.data || [];
    const structures = structuresRes.data || [];
    const settings = settingsRes.data || [];

    const feeTotals: Record<string, { paid: number }> = {};
    allFees.forEach(f => {
      if (!feeTotals[f.student_id]) feeTotals[f.student_id] = { paid: 0 };
      feeTotals[f.student_id].paid += Number(f.amount_paid || 0) + Number(f.discount || 0);
    });

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonthNum = now.getMonth() + 1; // Assuming English calendar 1-12

    const studentBalances: Record<string, { due: number, paid: number }> = {};
    
    students.forEach(s => {
      // Calculate monthly payable for this student
      const studentSettings = settings.filter(set => set.student_id === s.id);
      const studentStructures = structures.filter(fs => fs.class_id === s.class_id || fs.class_id === null);
      
      const monthlyPayable = studentStructures.reduce((sum, fs) => {
        const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
        const isEnabled = setting ? setting.is_enabled : true;
        const isExpired = fs.due_date && fs.due_date < today;
        const isNotStarted = fs.start_date && fs.start_date > today;
        
        if (!isEnabled || isExpired || isNotStarted) return sum;
        
        const amountToCharge = (setting?.custom_amount !== undefined && setting?.custom_amount !== null) 
          ? Number(setting.custom_amount) 
          : Number(fs.amount || 0);
        
        return sum + amountToCharge;
      }, 0);

      const totalPaid = feeTotals[s.id]?.paid || 0;
      const totalPayableToDate = monthlyPayable * currentMonthNum;
      const totalOutstanding = Math.max(0, totalPayableToDate - totalPaid);

      studentBalances[s.id] = {
        due: totalOutstanding,
        paid: totalPaid
      };
    });

    // 3. Fetch Latest Exam Results specific to each class
    const { data: inst } = await supabase.from('institutions').select('config_json').eq('id', institutionId).single();
    const resultEngine = inst?.config_json?.result_engine || 'school';

    const classIds = [...new Set(students.map(s => s.class_id).filter(Boolean))];
    let marks: any[] = [];
    let examsMap: Record<string, string> = {}; // student_id -> latest exam name
    let meritPositions: Record<string, number> = {}; // student_id -> rank

    if (resultEngine === 'school') {
      for (const cid of classIds) {
        const { data: latestExam } = await supabase
          .from('exams')
          .select('id, exam_name')
          .eq('class_id', cid)
          .order('exam_date', { ascending: false })
          .limit(1)
          .maybeSingle();

         if (latestExam) {
           // To calculate merit position, we need marks for ALL students in this class for this exam
           const { data: allMarksData } = await supabase
             .from('exam_marks')
             .select('student_id, marks_obtained, exam_subjects(full_marks, subject_name, pass_marks, is_optional)')
             .eq('exam_id', latestExam.id);
           
           if (allMarksData) {
             // Calculate totals for everyone in class to determine rank
             const totals: Record<string, { obtained: number, full: number }> = {};
             allMarksData.forEach(m => {
               if (!totals[m.student_id]) totals[m.student_id] = { obtained: 0, full: 0 };
               const fMarks = Array.isArray(m.exam_subjects) 
                 ? (m.exam_subjects[0]?.full_marks || 100) 
                 : ((m.exam_subjects as any)?.full_marks || 100);
               totals[m.student_id].obtained += Number(m.marks_obtained || 0);
               totals[m.student_id].full += Number(fMarks);
             });

             // Sort by obtained marks descending
             const sortedStudents = Object.entries(totals)
               .map(([id, t]) => ({ id, obtained: t.obtained }))
               .sort((a, b) => b.obtained - a.obtained);

             sortedStudents.forEach((st, index) => {
               meritPositions[st.id] = index + 1;
             });

             // Filter marks for requested students only to add to 'marks' array (for grade calculation later)
             const filteredMarks = allMarksData.filter(m => studentIds.includes(m.student_id));
             const normalizedMarks = filteredMarks.map(m => {
               const subjectObj: any = Array.isArray(m.exam_subjects) ? m.exam_subjects[0] : m.exam_subjects;
               return {
                 student_id: m.student_id,
                 marks_obtained: m.marks_obtained,
                 exam_subjects: { 
                   full_marks: subjectObj?.full_marks || 100,
                   subject_name: subjectObj?.subject_name || '',
                   pass_marks: subjectObj?.pass_marks || 33,
                   is_optional: subjectObj?.is_optional || false
                 }
               };
             });
             marks.push(...normalizedMarks);

             const classStudentsInReq = students.filter(s => s.class_id === cid);
             classStudentsInReq.forEach(s => examsMap[s.id] = latestExam.exam_name);
           }
        }
      }
    } else if (resultEngine === 'befaq') {
      for (const cid of classIds) {
        const { data: latestExam } = await supabase
          .from('befaq_exams')
          .select('id, exam_name')
          .eq('marhala_id', cid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestExam) {
           const { data: allMarksData } = await supabase
             .from('befaq_results')
             .select('student_id, marks_obtained, befaq_subjects(total_marks, subject_name)')
             .eq('exam_id', latestExam.id);
           
           if (allMarksData) {
             const totals: Record<string, { obtained: number, full: number }> = {};
             allMarksData.forEach(m => {
               if (!totals[m.student_id]) totals[m.student_id] = { obtained: 0, full: 0 };
               const fMarks = Array.isArray(m.befaq_subjects) 
                 ? (m.befaq_subjects[0]?.total_marks || 100) 
                 : ((m.befaq_subjects as any)?.total_marks || 100);
               totals[m.student_id].obtained += Number(m.marks_obtained || 0);
               totals[m.student_id].full += Number(fMarks);
             });

             const sortedStudents = Object.entries(totals)
               .map(([id, t]) => ({ id, obtained: t.obtained }))
               .sort((a, b) => b.obtained - a.obtained);

             sortedStudents.forEach((st, index) => {
               meritPositions[st.id] = index + 1;
             });

             const filteredMarks = allMarksData.filter(m => studentIds.includes(m.student_id));
             const normalizedMarks = filteredMarks.map(m => ({
               student_id: m.student_id,
               marks_obtained: m.marks_obtained,
               exam_subjects: { 
                 full_marks: Array.isArray(m.befaq_subjects) 
                   ? (m.befaq_subjects[0]?.total_marks || 100) 
                   : ((m.befaq_subjects as any)?.total_marks || 100),
                 subject_name: Array.isArray(m.befaq_subjects)
                   ? (m.befaq_subjects[0]?.subject_name || '')
                   : ((m.befaq_subjects as any)?.subject_name || '')
               }
             }));
             marks.push(...normalizedMarks);
           }
           const classStudentsInReq = students.filter(s => s.class_id === cid);
           classStudentsInReq.forEach(s => examsMap[s.id] = latestExam.exam_name);
        }
      }
    }

    // 4. Fetch Attendance (Current Month)
    const { data: attendance } = await supabase
      .from('attendance')
      .select('student_id, status')
      .gte('date', `${currentMonth}-01`)
      .in('student_id', studentIds);

    // Combine all data
    const combinedData = students.map(s => {
      const balance = studentBalances[s.id] || { due: 0, paid: 0 };
      
      const classStudentsMarks = marks.filter(m => {
        const sm = students.find(st => st.id === m.student_id);
        return sm?.class_id === s.class_id;
      });

      const uniqueSubjectsMap = new Map();
      classStudentsMarks.forEach(m => {
        if (m.exam_subjects && m.exam_subjects.subject_name) {
          if (!uniqueSubjectsMap.has(m.exam_subjects.subject_name)) {
            uniqueSubjectsMap.set(m.exam_subjects.subject_name, m.exam_subjects);
          }
        }
      });
      const allClassSubjects = Array.from(uniqueSubjectsMap.values());

      const studentMarks = marks.filter(m => m.student_id === s.id);
      
      let totalObtained = 0;
      let totalFull = 0;
      
      let pointsSum = 0;
      let numMainSubjects = 0;
      let hasFailedSub = false;
      const resultSystem = inst?.config_json?.result_system || 'grading';

      allClassSubjects.forEach(sub => {
         const m = studentMarks.find(sm => sm.exam_subjects?.subject_name === sub.subject_name);
         const obtained = m ? Number(m.marks_obtained || 0) : 0;
         const full = Number(sub.full_marks || 100);
         const pass = Number(sub.pass_marks || 33);
         const isOptional = Boolean(sub.is_optional);
         const isOptionalEffectively = isOptional && resultSystem === 'grading_optional';

         totalObtained += obtained;
         totalFull += full;

         const pct = full > 0 ? (obtained / full) * 100 : 0;
         const failed = obtained < pass;

         if (!isOptionalEffectively && failed) {
           hasFailedSub = true;
         }

         let gp = 0.00;
         if (!failed) {
           if (pct >= 80) gp = 5.00;
           else if (pct >= 70) gp = 4.00;
           else if (pct >= 60) gp = 3.50;
           else if (pct >= 50) gp = 3.00;
           else if (pct >= 40) gp = 2.00;
           else gp = 1.00;
         }

         if (resultSystem === 'grading_optional') {
           if (!isOptional) {
             pointsSum += gp;
             numMainSubjects++;
           } else {
             if (gp > 2) pointsSum += (gp - 2);
           }
         } else {
           pointsSum += gp;
           numMainSubjects++;
         }
      });

      const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
      
      let grade = '-';
      let gpa = '-';

      if (totalFull > 0) {
        if (resultEngine === 'befaq' || resultEngine === 'qawmi_custom') {
          if (percentage >= 80) grade = 'মুমতাজ';
          else if (percentage >= 65) grade = 'জায়্যিদ জিদ্দান';
          else if (percentage >= 50) grade = 'জায়্যিদ';
          else if (percentage >= 40) grade = 'মকবুল';
          else grade = 'রাসিব';
        } else {
          // School system logic
          if (resultSystem === 'hifz' || resultSystem === 'marks') {
            if (hasFailedSub) {
              grade = 'F';
              gpa = '0.00';
            } else {
              if (percentage >= 80) { grade = 'A+'; gpa = '5.00'; }
              else if (percentage >= 70) { grade = 'A'; gpa = '4.00'; }
              else if (percentage >= 60) { grade = 'A-'; gpa = '3.50'; }
              else if (percentage >= 50) { grade = 'B'; gpa = '3.00'; }
              else if (percentage >= 40) { grade = 'C'; gpa = '2.00'; }
              else if (percentage >= 33) { grade = 'D'; gpa = '1.00'; }
              else { grade = 'F'; gpa = '0.00'; }
            }
          } else { // grading or grading_optional
            if (numMainSubjects > 0) {
              if (hasFailedSub) {
                grade = 'F';
                gpa = '0.00';
              } else {
                let avgGp = pointsSum / numMainSubjects;
                if (avgGp > 5.0) avgGp = 5.0;
                gpa = avgGp.toFixed(2);
                
                if (avgGp >= 5.0) grade = 'A+';
                else if (avgGp >= 4.0) grade = 'A';
                else if (avgGp >= 3.5) grade = 'A-';
                else if (avgGp >= 3.0) grade = 'B';
                else if (avgGp >= 2.0) grade = 'C';
                else if (avgGp >= 1.0) grade = 'D';
                else grade = 'F';
              }
            }
          }
        }
      }

      // Calculate Subject-wise Marks String
      const subjectsStr = studentMarks
        .filter(m => m.exam_subjects?.subject_name)
        .map(m => `${m.exam_subjects.subject_name}: ${m.marks_obtained}`)
        .join(', ');

      // Calculate Attendance Percentage
      const studentAttendance = attendance?.filter(a => a.student_id === s.id) || [];
      const presentCount = studentAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
      const attPercentage = studentAttendance.length > 0 ? Math.round((presentCount / studentAttendance.length) * 100) : undefined;

      return {
        id: s.id,
        student_name: s.student_name,
        guardian_name: s.guardian_name,
        roll: s.roll,
        class_name: (s.classes as any)?.class_name,
        institution_name: (s.institutions as any)?.name,
        due_amount: balance.due,
        paid_amount: balance.paid,
        exam_name: examsMap[s.id] || '-',
        exam_subject: subjectsStr || '-',
        result_grade: grade || '-',
        result_gpa: gpa || '-',
        merit_position: meritPositions[s.id] ? String(meritPositions[s.id]) : '-',
        attendance_percentage: attPercentage || 0,
        month: currentMonth || '-'
      };
    });

    console.log('Fetched shortcode data:', combinedData);
    return combinedData;
  }
};
