
import { supabase } from 'lib/supabase';

export const ShortcodeService = {
  /**
   * Replaces shortcodes in a message with student-specific data.
   */
  replaceShortcodes: (message: string, data: any): string => {
    if (!message) return '';
    
    const shortcodes: Record<string, any> = {
      '{student_name}': data.student_name || '-',
      '{father_name}': data.guardian_name || '-',
      '{class}': data.class_name || '-',
      '{roll}': data.roll || '-',
      '{due_amount}': data.due_amount !== undefined ? data.due_amount : '-',
      '{paid_amount}': data.paid_amount !== undefined ? data.paid_amount : '-',
      '{result_grade}': data.result_grade || '-',
      '{exam_name}': data.exam_name || '-',
      '{attendance_percentage}': data.attendance_percentage !== undefined ? `${data.attendance_percentage}%` : '-',
      '{institution_name}': data.institution_name || '-',
      '{month}': data.month || '-',
    };

    let finalMessage = message;
    Object.entries(shortcodes).forEach(([code, value]) => {
      const regex = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      finalMessage = finalMessage.replace(regex, String(value));
    });

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

    // 2. Fetch Fees (Current Month)
    const { data: fees } = await supabase
      .from('fees')
      .select('student_id, amount_due, amount_paid')
      .eq('month', currentMonth)
      .in('student_id', studentIds);

    // 3. Fetch Latest Exam Results
    // This is a bit complex to do in one query for all students.
    // We'll fetch the latest exam for the institution first.
    const { data: latestExam } = await supabase
      .from('exams')
      .select('id, exam_name')
      .eq('institution_id', institutionId)
      .order('exam_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    let marks: any[] = [];
    if (latestExam) {
      const { data: marksData } = await supabase
        .from('exam_marks')
        .select('student_id, marks_obtained, exam_subjects(full_marks)')
        .eq('exam_id', latestExam.id)
        .in('student_id', studentIds);
      marks = marksData || [];
    }

    // 4. Fetch Attendance (Current Month)
    const { data: attendance } = await supabase
      .from('attendance')
      .select('student_id, status')
      .gte('date', `${currentMonth}-01`)
      .in('student_id', studentIds);

    // Combine all data
    return students.map(s => {
      const studentFees = fees?.find(f => f.student_id === s.id);
      
      // Calculate Grade (Simple logic: marks / total * 100)
      const studentMarks = marks.filter(m => m.student_id === s.id);
      let totalObtained = 0;
      let totalFull = 0;
      studentMarks.forEach(m => {
        totalObtained += Number(m.marks_obtained);
        totalFull += Number(m.exam_subjects?.full_marks || 100);
      });
      const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
      
      let grade = '-';
      if (totalFull > 0) {
        if (percentage >= 80) grade = 'A+';
        else if (percentage >= 70) grade = 'A';
        else if (percentage >= 60) grade = 'A-';
        else if (percentage >= 50) grade = 'B';
        else if (percentage >= 40) grade = 'C';
        else if (percentage >= 33) grade = 'D';
        else grade = 'F';
      }

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
        due_amount: studentFees?.amount_due,
        paid_amount: studentFees?.amount_paid,
        exam_name: latestExam?.exam_name,
        result_grade: grade,
        attendance_percentage: attPercentage,
        month: currentMonth
      };
    });
  }
};
