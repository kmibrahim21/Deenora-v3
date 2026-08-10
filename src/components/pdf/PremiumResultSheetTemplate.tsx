import React from 'react';

export interface PremiumResultSheetProps {
  exam: any;
  subjects: any[];
  students: any[];
  marksData?: any;
  madrasah: any;
  lang: 'en' | 'bn';
  singleStudent?: any;
  singleStudentMarks?: any[];
}

export const PremiumResultSheetTemplate: React.FC<PremiumResultSheetProps> = ({
  exam,
  subjects,
  students,
  marksData = {},
  madrasah,
  lang,
  singleStudent,
  singleStudentMarks
}) => {
  const isBangla = lang === 'bn';

  // Config parsing
  const config = React.useMemo(() => {
    let cfg = madrasah?.config_json || {};
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch (e) {
        cfg = {};
      }
    }
    return cfg;
  }, [madrasah?.config_json]);

  // Language translations
  const t = {
    resultSheet: isBangla ? 'ফলাফল পত্র' : 'RESULT SHEET',
    academicYear: isBangla ? 'শিক্ষাবর্ষ' : 'Academic Year',
    annualExam: isBangla ? 'বার্ষিক পরীক্ষা' : 'Annual Examination',
    class: isBangla ? 'শ্রেণি' : 'Class',
    section: isBangla ? 'শাখা' : 'Section',
    group: isBangla ? 'বিভাগ' : 'Group',
    exam: isBangla ? 'পরীক্ষা' : 'Exam',
    subjects: isBangla ? 'বিষয়সমূহ' : 'Subjects',
    allSubjects: isBangla ? 'সকল বিষয়' : 'All Subjects',
    totalStudents: isBangla ? 'মোট শিক্ষার্থী' : 'Total Students',
    studentsPresent: isBangla ? 'উপস্থিত শিক্ষার্থী' : 'Students Present',
    resultPublishedOn: isBangla ? 'ফলাফল প্রকাশের তারিখ' : 'Result Published On',
    sl: isBangla ? 'ক্রঃ' : 'SL',
    studentName: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    subjectMarks: isBangla ? 'বিষয়ভিত্তিক নম্বর (পূর্ণমান: ১০০)' : 'SUBJECT MARKS (FULL MARK: 100)',
    total: isBangla ? 'মোট' : 'Total',
    average: isBangla ? 'গড়' : 'Average',
    gpa: 'GPA',
    percentage: isBangla ? 'শতকরা (%)' : 'Percentage (%)',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    rank: 'Merit Position',
    result: isBangla ? 'ফলাফল' : 'Result',
    pass: isBangla ? 'পাস' : 'Pass',
    fail: isBangla ? 'ফেল' : 'Fail',
    classSummary: isBangla ? 'শ্রেণি সংক্ষিপ্তসার' : 'CLASS SUMMARY',
    absent: isBangla ? 'অনুপস্থিত' : 'Absent',
    passed: isBangla ? 'উত্তীর্ণ' : 'Passed',
    failed: isBangla ? 'অনুত্তীর্ণ' : 'Failed',
    passPercentage: isBangla ? 'পাসের হার' : 'Pass Percentage',
    gradeScale: isBangla ? 'গ্রেড স্কেল' : 'GRADE SCALE',
    gradeDistribution: isBangla ? 'গ্রেড বন্টন' : 'GRADE DISTRIBUTION',
    remarks: isBangla ? 'মন্তব্য' : 'REMARKS',
    marksRange: isBangla ? 'নম্বর নম্বর সীমা' : 'Marks Range (Total)',
    remarksCol: isBangla ? 'মূল্যায়ন' : 'Remarks',
    noOfStudents: isBangla ? 'শিক্ষার্থী সংখ্যা' : 'No. of Students',
    classTeacher: isBangla ? 'শ্রেণি শিক্ষক' : 'Class Teacher',
    principal: isBangla ? 'অধ্যক্ষ / প্রতিষ্ঠান প্রধান' : 'Principal',
    knowledgeDisciplineSuccess: isBangla ? 'জ্ঞান | শৃঙ্খলা | সাফল্য' : 'Knowledge  |  Discipline  |  Success',
    congratulations: isBangla 
      ? 'সকল সফল শিক্ষার্থীদের তাদের কঠোর পরিশ্রম ও নিষ্ঠার জন্য অভিনন্দন। শুভকামনা রইল।' 
      : 'Congratulations to all successful students for their hard work and dedication. Keep it up and strive for greater success in the future.',
  };

  // Build full student list or single student row
  const studentList = React.useMemo(() => {
    let rawList: any[] = [];
    if (singleStudent && singleStudentMarks) {
      // Convert single student view into list format
      const markMap: Record<string, number> = {};
      let totalObtained = 0;
      let totalPossible = 0;
      let failed = false;

      const hasAnyMark = singleStudentMarks.some((m: any) => m.marks_obtained !== undefined && m.marks_obtained !== '' && m.marks_obtained !== null);

      singleStudentMarks.forEach((m: any) => {
        const markVal = m.marks_obtained;
        const hasMark = markVal !== undefined && markVal !== '' && markVal !== null;
        const val = hasMark ? Number(markVal) : 0;
        if (hasMark) markMap[m.subject_id || m.id] = val;
        totalObtained += val;
        totalPossible += Number(m.full_marks || 100);
        if (hasMark && (m.grade === 'F' || val < (m.pass_marks || 33))) failed = true;
      });

      const pct = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
      const grade = singleStudent.grade || (pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B+' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : 'F');
      const isPassed = hasAnyMark && !failed && grade !== 'F';

      rawList = [{
        id: singleStudent.id || '1',
        student_name: singleStudent.student_name || singleStudent.name || 'Student',
        roll: singleStudent.roll || '1',
        marks: markMap,
        total: hasAnyMark ? totalObtained : '',
        fullTotal: totalPossible,
        percentage: hasAnyMark ? pct.toFixed(1) : '',
        grade: hasAnyMark ? grade : '',
        isPassed,
        hasAnyMark,
        rawGpa: singleStudent._gpa || singleStudent.gpa,
        rawRank: singleStudent._rank || singleStudent.merit_position || singleStudent.rank
      }];
    } else {
      // Process array of students
      rawList = students.map((std, idx) => {
        const stdMarks = marksData[std.id || std.student_id] || std.marks || {};
        let total = 0;
        let fullTotal = 0;
        let failed = false;
        const markMap: Record<string, number> = {};

        const hasAnyMark = subjects.some((sub) => {
          const markVal = typeof stdMarks[sub.id] === 'object' ? stdMarks[sub.id]?.obtained : stdMarks[sub.id];
          return markVal !== undefined && markVal !== '' && markVal !== null;
        }) || (std._total !== undefined && std._total !== null && std._total !== '' && Number(std._total) > 0) || (std._hasAnyMark === true);

        subjects.forEach((sub) => {
          const markVal = typeof stdMarks[sub.id] === 'object' ? stdMarks[sub.id]?.obtained : stdMarks[sub.id];
          const hasMark = markVal !== undefined && markVal !== '' && markVal !== null;
          const numVal = hasMark ? Number(markVal) : 0;
          if (hasMark) markMap[sub.id] = numVal;
          total += numVal;
          const fMarks = Number(sub.full_marks || 100);
          fullTotal += fMarks;
          const pMarks = Number(sub.pass_marks || Math.ceil(fMarks * 0.33));
          if (hasMark && numVal < pMarks && !sub.is_optional) {
            failed = true;
          }
        });

        const pct = fullTotal > 0 ? (total / fullTotal) * 100 : 0;
        let grade = std._grade || std.grade;
        if (!grade) {
          if (failed) grade = 'F';
          else if (pct >= 80) grade = 'A+';
          else if (pct >= 70) grade = 'A';
          else if (pct >= 60) grade = 'B+';
          else if (pct >= 50) grade = 'B';
          else if (pct >= 40) grade = 'C';
          else grade = 'F';
        }

        const isPassed = hasAnyMark && grade !== 'F' && !failed;

        return {
          id: std.id || std.student_id || String(idx + 1),
          student_name: std.student_name || std.name || `Student ${idx + 1}`,
          roll: std.roll || String(idx + 1),
          marks: markMap,
          total: hasAnyMark ? (std._total !== undefined && std._total !== '' ? std._total : total) : '',
          fullTotal,
          percentage: hasAnyMark ? ((std._avg || pct).toFixed ? (std._avg || pct).toFixed(1) : String(std._avg || pct)) : '',
          grade: hasAnyMark ? grade : '',
          isPassed,
          hasAnyMark,
          rawGpa: std._gpa || std.gpa,
          rawRank: std._rank || std.merit_position || std.rank || std.position
        };
      });
    }

    // Rank calculation for passed students with marks
    const passedSorted = rawList.filter(s => s.hasAnyMark && s.isPassed)
      .sort((a, b) => (Number(b.total) - Number(a.total)) || (Number(b.percentage) - Number(a.percentage)));

    const rankMap = new Map<string, number>();
    passedSorted.forEach((s, idx) => {
      if (!rankMap.has(s.id)) {
        rankMap.set(s.id, idx + 1);
      }
    });

    const toBnNum = (n: number | string) => isBangla ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : String(n);

    return rawList.map((std) => {
      if (!std.hasAnyMark) {
        return {
          ...std,
          gpa: '',
          rank: ''
        };
      }

      // Calculate GPA
      let calculatedGpa = '0.0';
      if (std.rawGpa !== undefined && std.rawGpa !== null && std.rawGpa !== '') {
        calculatedGpa = Number(std.rawGpa).toFixed(1);
      } else if (!std.isPassed || std.grade === 'F') {
        calculatedGpa = '0.0';
      } else {
        const gMap: Record<string, number> = { 'A+': 5.0, 'A': 4.0, 'A-': 3.5, 'B+': 3.5, 'B': 3.0, 'C': 2.0, 'D': 1.0 };
        calculatedGpa = (gMap[std.grade] || 0.0).toFixed(1);
      }

      // Calculate Rank
      let displayRank = '';
      if (std.rawRank && std.rawRank !== 'null' && std.rawRank !== 'undefined' && std.rawRank !== '-') {
        displayRank = toBnNum(std.rawRank);
      } else if (std.isPassed && rankMap.has(std.id)) {
        displayRank = toBnNum(rankMap.get(std.id)!);
      }

      return {
        ...std,
        gpa: toBnNum(calculatedGpa),
        rank: displayRank
      };
    });
  }, [students, subjects, marksData, singleStudent, singleStudentMarks, isBangla]);

  // Overall Statistics
  const totalStudents = studentList.length;
  const studentsWithMarks = studentList.filter(s => s.hasAnyMark);
  const presentCount = studentsWithMarks.length;
  const absentCount = totalStudents - presentCount;
  const passedCount = studentList.filter(s => s.hasAnyMark && s.isPassed).length;
  const failedCount = studentsWithMarks.length - passedCount;
  const passPercentage = studentsWithMarks.length > 0 ? ((passedCount / studentsWithMarks.length) * 100).toFixed(1) : '0.0';

  const toBnNum = (n: number | string) => isBangla ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : String(n);

  // Grade Distribution
  const gradeCounts = React.useMemo(() => {
    const counts: Record<string, number> = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'F': 0 };
    studentList.forEach(s => {
      const g = s.grade || 'F';
      if (counts[g] !== undefined) counts[g]++;
      else counts['F']++;
    });
    return counts;
  }, [studentList]);

  // Total possible marks across all subjects
  const totalSubjectFullMarks = subjects.reduce((sum, s) => sum + Number(s.full_marks || 100), 0);

  // Paginate if > 30 students
  const STUDENTS_PER_PAGE = 30;
  const totalPages = Math.ceil(studentList.length / STUDENTS_PER_PAGE) || 1;

  // Grade scale reference table
  const gradeScaleData = [
    { grade: 'A+', range: '80% and above', remarks: isBangla ? 'চমৎকার' : 'Excellent' },
    { grade: 'A', range: '70% – 79%', remarks: isBangla ? 'উত্তম' : 'Very Good' },
    { grade: 'B+', range: '60% – 69%', remarks: isBangla ? 'ভালো' : 'Good' },
    { grade: 'B', range: '50% – 59%', remarks: isBangla ? 'গড়' : 'Average' },
    { grade: 'C', range: '40% – 49%', remarks: isBangla ? 'চলনসই' : 'Below Average' },
    { grade: 'F', range: 'Below 40%', remarks: isBangla ? 'অনুত্তীর্ণ' : 'Fail' },
  ];

  // Dynamic layout styling based on student count
  const isCompact = totalStudents > 20;

  return (
    <div className="pdf-template-wrapper bg-white text-slate-900 font-sans print:m-0 print:p-0">
      <style>{`
        .font-bangla { font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif; }
        .font-english { font-family: 'Inter', sans-serif; }
        @media print {
          .page-break { page-break-after: always; }
        }
      `}</style>

      {Array.from({ length: totalPages }).map((_, pageIdx) => {
        const pageStudents = studentList.slice(pageIdx * STUDENTS_PER_PAGE, (pageIdx + 1) * STUDENTS_PER_PAGE);
        const numStudentsOnPage = pageStudents.length;
        const isLastPage = pageIdx === totalPages - 1;

        return (
          <div
            key={pageIdx}
            className={`pdf-page-container w-[794px] h-[1123px] bg-white ${
              numStudentsOnPage > 22 ? 'p-3.5' : numStudentsOnPage > 14 ? 'p-4' : 'p-6'
            } relative flex flex-col justify-between border-[12px] border-[#1E3A8A]/10 box-border overflow-hidden shadow-2xl mx-auto ${isLastPage ? '' : 'page-break'}`}
            style={{ boxSizing: 'border-box' }}
          >
            {/* Inner Double Border Accent */}
            <div className="absolute inset-[6px] border border-[#1E3A8A] pointer-events-none z-0"></div>
            <div className="absolute inset-[9px] border-2 border-[#1E3A8A] border-dashed opacity-30 pointer-events-none z-0"></div>

            {/* Main Content Area */}
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                {/* ================= HEADER SECTION ================= */}
                <div className={`flex justify-between items-center border-b-2 border-[#1E3A8A] ${
                  numStudentsOnPage > 22 ? 'pb-2 mb-2' : 'pb-3 mb-3'
                }`}>
                  {/* Left: Institution Logo */}
                  <div className={`${
                    numStudentsOnPage > 22 ? 'w-16 h-16 rounded-xl' : 'w-20 h-20 rounded-2xl'
                  } shrink-0 flex items-center justify-center border-2 border-[#1E3A8A]/20 bg-gradient-to-b from-white to-blue-50/50 p-1 shadow-md overflow-hidden`}>
                    {madrasah?.logo_url ? (
                      <img src={madrasah.logo_url} className="max-w-full max-h-full object-contain" crossOrigin="anonymous" alt="Logo" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br from-[#1E3A8A] to-[#0f172a] text-white flex items-center justify-center rounded-lg font-black shadow-inner ${
                        numStudentsOnPage > 22 ? 'text-lg' : 'text-2xl'
                      }`}>
                        {madrasah?.name ? madrasah.name.charAt(0) : 'A'}
                      </div>
                    )}
                  </div>

                  {/* Center: Institution Details */}
                  <div className="text-center flex-1 px-3">
                    <h1 className={`${
                      numStudentsOnPage > 22 ? 'text-xl' : 'text-2.5xl'
                    } font-black text-[#1E3A8A] uppercase tracking-tight font-serif drop-shadow-sm leading-tight`}>
                      {madrasah?.name || 'AL HIKMAH ISLAMIC ACADEMY'}
                    </h1>
                    <p className={`${
                      numStudentsOnPage > 22 ? 'text-[9.5px]' : 'text-[11px]'
                    } font-bold text-slate-600 mt-0.5 leading-tight`}>
                      {madrasah?.address || 'Madrasa Road, Dhanmondi, Dhaka-1205, Bangladesh'}
                    </p>
                    <div className={`flex justify-center items-center gap-3 ${
                      numStudentsOnPage > 22 ? 'text-[9px] mt-0.5' : 'text-[10px] mt-1'
                    } font-semibold text-slate-700`}>
                      {madrasah?.phone && (
                        <span className="flex items-center gap-1">
                          📞 {madrasah.phone}
                        </span>
                      )}
                      {madrasah?.email && (
                        <span className="flex items-center gap-1">
                          ✉️ {madrasah.email}
                        </span>
                      )}
                      {(madrasah?.website || madrasah?.domain) && (
                        <span className="flex items-center gap-1">
                          🌐 {madrasah.website || madrasah.domain}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Result Sheet Card */}
                  <div className={`${
                    numStudentsOnPage > 22 ? 'w-44' : 'w-52'
                  } border-2 border-[#1E3A8A] rounded-xl overflow-hidden shadow-md bg-white shrink-0`}>
                    <div className={`bg-gradient-to-r from-[#1E3A8A] to-[#1e40af] text-white text-center font-black ${
                      numStudentsOnPage > 22 ? 'py-0.5 text-[10px]' : 'py-1 text-[11px]'
                    } uppercase tracking-wider`}>
                      {t.resultSheet}
                    </div>
                    <div className={`text-center ${
                      numStudentsOnPage > 22 ? 'py-0.5 text-[9.5px]' : 'py-1 text-[10px]'
                    } font-bold text-slate-800 border-b border-slate-200`}>
                      {t.academicYear}: {exam?.academic_year || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`}
                    </div>
                    <div className={`bg-[#1E3A8A]/90 text-white text-center font-extrabold ${
                      numStudentsOnPage > 22 ? 'py-0.5 text-[9.5px]' : 'py-1 text-[10px]'
                    } truncate px-1`}>
                      {exam?.exam_name || t.annualExam}
                    </div>
                  </div>
                </div>

                {/* ================= INSTITUTION INFORMATION PANEL ================= */}
                <div className={`border border-blue-200/80 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 rounded-xl ${
                  numStudentsOnPage > 22 ? 'p-2 mb-2 text-[9.5px]' : 'p-2.5 mb-3 text-[10.5px]'
                } flex justify-between items-center shadow-sm`}>
                  {/* Left Column */}
                  <div className="space-y-0.5 w-1/3">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[#1E3A8A] w-12">{t.class}</span>
                      <span className="font-bold text-slate-800">: {exam?.classes?.class_name || exam?.class_name || 'All'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[#1E3A8A] w-12">{t.section}</span>
                      <span className="font-bold text-slate-800">: {exam?.section || 'A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[#1E3A8A] w-12">{t.group}</span>
                      <span className="font-bold text-slate-800">: {exam?.group || 'General'}</span>
                    </div>
                  </div>

                  {/* Center Column */}
                  <div className="space-y-0.5 w-2/5 border-x border-slate-200 px-2">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[#1E3A8A] w-24">{t.exam}</span>
                      <span className="font-bold text-slate-800 truncate">: {exam?.exam_name || 'Annual Examination'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[#1E3A8A] w-24">{t.subjects}</span>
                      <span className="font-bold text-slate-800">: {t.allSubjects} ({subjects.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[#1E3A8A] w-24">{t.totalStudents}</span>
                      <span className="font-bold text-slate-800">: {totalStudents} | Present: {presentCount}</span>
                    </div>
                  </div>

                  {/* Right Column: Published Date */}
                  <div className="w-1/4 text-center pl-1 flex flex-col items-center justify-center">
                    <span className={`${numStudentsOnPage > 22 ? 'text-[8.5px]' : 'text-[9.5px]'} font-extrabold text-slate-500 uppercase tracking-wider`}>{t.resultPublishedOn}</span>
                    <span className={`${numStudentsOnPage > 22 ? 'text-[10px]' : 'text-[11.5px]'} font-black text-[#1E3A8A] mt-0.5`}>
                      {exam?.published_date || new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* ================= MAIN RESULT TABLE ================= */}
                <div className={`border border-slate-300 rounded-lg overflow-hidden ${
                  numStudentsOnPage > 22 ? 'mb-2' : 'mb-3'
                } shadow-sm`}>
                  <table className="w-full border-collapse text-center table-fixed">
                    <thead>
                      <tr className={`bg-[#1E3A8A] text-white ${
                        numStudentsOnPage > 22 ? 'text-[9.5px]' : 'text-[10.5px]'
                      } font-black uppercase tracking-wider`}>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} w-[32px] border-r border-white/20 align-middle`} rowSpan={2}>{t.sl}</th>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-1' : 'py-1.5 px-1.5'} w-[160px] border-r border-white/20 text-left align-middle truncate whitespace-nowrap`} rowSpan={2}>{t.studentName}</th>
                        <th className="py-1 px-0.5 border-r border-white/20 text-center align-middle" colSpan={subjects.length}>
                          {t.subjectMarks}
                        </th>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} w-[40px] border-r border-white/20 align-middle`} rowSpan={2}>
                          {t.total}
                        </th>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} w-[40px] border-r border-white/20 align-middle`} rowSpan={2}>
                          {t.average}
                        </th>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} w-[38px] border-r border-white/20 align-middle`} rowSpan={2}>
                          {t.gpa}
                        </th>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} w-[36px] border-r border-white/20 align-middle`} rowSpan={2}>
                          {t.grade}
                        </th>
                        <th className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} w-[40px] align-middle`} rowSpan={2}>
                          {t.rank}
                        </th>
                      </tr>
                      <tr className="bg-[#152e72] text-white font-bold">
                        {subjects.map((sub) => (
                          <th key={sub.id} className="py-1 px-0.5 border-r border-white/20 align-middle overflow-hidden">
                            <div 
                              className={`mx-auto font-bold leading-tight break-words text-center line-clamp-2 ${
                                subjects.length > 12 ? 'text-[7px]' :
                                subjects.length > 9 ? 'text-[7.5px]' :
                                subjects.length > 6 ? 'text-[8px]' :
                                'text-[9px]'
                              }`}
                              title={sub.subject_name || sub.name}
                            >
                              {sub.subject_name || sub.name}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`${
                      numStudentsOnPage > 22 ? 'text-[9.5px] leading-tight' : 'text-[10.5px]'
                    } font-semibold divide-y divide-slate-200`}>
                      {pageStudents.map((std, index) => {
                        const globalIndex = pageIdx * STUDENTS_PER_PAGE + index + 1;
                        const isEven = index % 2 === 0;

                        return (
                          <tr key={std.id} className={isEven ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5' : 'py-1.5 px-0.5'} font-bold text-slate-900 border-r border-slate-200 text-center truncate`}>
                              {toBnNum(globalIndex)}
                            </td>
                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-1' : 'py-1.5 px-1.5'} text-left font-bold text-slate-900 border-r border-slate-200 truncate whitespace-nowrap`} title={std.student_name}>
                              {std.student_name}
                            </td>

                            {subjects.map((sub) => {
                              const mark = std.marks[sub.id];
                              const hasMark = mark !== undefined && mark !== null && mark !== '';
                              const markNum = hasMark ? Number(mark) : null;
                              const isPass = hasMark ? markNum! >= Number(sub.pass_marks || Math.ceil((sub.full_marks || 100) * 0.33)) : true;

                              return (
                                <td
                                  key={sub.id}
                                  className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5 text-[11px]' : 'py-1.5 px-0.5 text-[13px]'} border-r border-slate-200 text-center truncate ${
                                    !hasMark ? 'text-slate-400 font-normal' : isPass ? 'text-slate-900 font-extrabold' : 'text-red-600 font-black bg-red-50/50'
                                  }`}
                                >
                                  {hasMark ? toBnNum(markNum!) : ''}
                                </td>
                              );
                            })}

                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5 text-[11px]' : 'py-1.5 px-0.5 text-[13px]'} font-black text-[#1E3A8A] bg-blue-50/30 border-r border-slate-200 text-center truncate`}>
                              {toBnNum(std.total)}
                            </td>
                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5 text-[11px]' : 'py-1.5 px-0.5 text-[13px]'} font-bold text-slate-900 border-r border-slate-200 text-center truncate`}>
                              {std.percentage !== '' && std.percentage !== undefined ? `${toBnNum(std.percentage)}%` : ''}
                            </td>
                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5 text-[11px]' : 'py-1.5 px-0.5 text-[13px]'} font-extrabold text-slate-900 border-r border-slate-200 text-center truncate`}>
                              {std.gpa}
                            </td>
                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5 text-[11px]' : 'py-1.5 px-0.5 text-[13px]'} font-black border-r border-slate-200 text-center truncate ${
                              std.grade === 'A+' ? 'text-blue-700' :
                              std.grade === 'F' ? 'text-red-600' : 'text-slate-800'
                            }`}>
                              {std.grade}
                            </td>
                            <td className={`${numStudentsOnPage > 22 ? 'py-1 px-0.5 text-[11px]' : 'py-1.5 px-0.5 text-[13px]'} font-mono font-black text-blue-900 bg-blue-50/20 text-center truncate`}>
                              {std.rank}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ================= BOTTOM SUMMARY CARDS (ON LAST PAGE) ================= */}
              {isLastPage && (
                <div>
                  <div className={`grid grid-cols-2 ${
                    numStudentsOnPage > 22 ? 'gap-3 mb-2' : 'gap-4 mb-3'
                  }`}>
                    {/* Card 1: CLASS SUMMARY */}
                    <div className={`border border-blue-200 rounded-xl ${
                      numStudentsOnPage > 22 ? 'p-2' : 'p-2.5'
                    } bg-[#F8FAFC] flex flex-col justify-between shadow-sm`}>
                      <div className={`bg-[#1E3A8A] text-white ${
                        numStudentsOnPage > 22 ? 'text-[8.5px] py-0.5 px-1.5' : 'text-[9.5px] py-1 px-2'
                      } font-black rounded-md uppercase tracking-wider mb-1 flex items-center gap-1`}>
                        📊 {t.classSummary}
                      </div>
                      <div className={`space-y-0.5 ${
                        numStudentsOnPage > 22 ? 'text-[8.5px]' : 'text-[9.5px]'
                      } font-semibold text-slate-700`}>
                        <div className="flex justify-between border-b border-slate-200 pb-0.5">
                          <span>{t.totalStudents}</span>
                          <span className="font-bold text-slate-900">: {toBnNum(totalStudents)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-0.5">
                          <span>{t.studentsPresent}</span>
                          <span className="font-bold text-slate-900">: {toBnNum(presentCount)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-0.5">
                          <span>{t.absent}</span>
                          <span className="font-bold text-slate-900">: {toBnNum(absentCount)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-0.5">
                          <span>{t.passed}</span>
                          <span className="font-bold text-emerald-700">: {toBnNum(passedCount)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-0.5">
                          <span>{t.failed}</span>
                          <span className="font-bold text-red-600">: {toBnNum(failedCount)}</span>
                        </div>
                      </div>
                      <div className="mt-1 text-center pt-0.5 border-t border-blue-200">
                        <span className={`${numStudentsOnPage > 22 ? 'text-[8px]' : 'text-[8.5px]'} font-extrabold uppercase text-slate-500 block`}>{t.passPercentage}</span>
                        <span className={`${numStudentsOnPage > 22 ? 'text-base' : 'text-lg'} font-black text-[#1E3A8A] leading-tight`}>{toBnNum(passPercentage)}%</span>
                      </div>
                    </div>

                    {/* Card 2: GRADE SCALE */}
                    <div className={`border border-blue-200 rounded-xl ${
                      numStudentsOnPage > 22 ? 'p-2' : 'p-2.5'
                    } bg-[#F8FAFC] flex flex-col justify-between shadow-sm`}>
                      <div className={`bg-[#1E3A8A] text-white ${
                        numStudentsOnPage > 22 ? 'text-[8.5px] py-0.5 px-1.5' : 'text-[9.5px] py-1 px-2'
                      } font-black rounded-md uppercase tracking-wider mb-1`}>
                        📜 {t.gradeScale}
                      </div>
                      <table className={`w-full ${
                        numStudentsOnPage > 22 ? 'text-[8px]' : 'text-[8.5px]'
                      } font-medium text-left border-collapse`}>
                        <thead>
                          <tr className="border-b border-slate-300 font-bold text-slate-700">
                            <th className="py-0.5">Grade</th>
                            <th className="py-0.5">Range</th>
                            <th className="py-0.5">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {gradeScaleData.map((row) => (
                            <tr key={row.grade}>
                              <td className="py-0.5 font-bold text-[#1E3A8A]">{row.grade}</td>
                              <td className="py-0.5">{row.range}</td>
                              <td className="py-0.5 text-slate-600">{row.remarks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SIGNATURE SECTION */}
                  <div className={`flex justify-between items-end border-t border-slate-300 ${
                    numStudentsOnPage > 22 ? 'pt-1.5 mt-1.5 mb-1 px-8' : 'pt-3 mt-2 mb-2 px-10'
                  }`}>
                    {/* Class Teacher */}
                    <div className="text-center w-40">
                      <div className={`${
                        numStudentsOnPage > 22 ? 'h-6 mb-0.5' : 'h-7 mb-1'
                      } border-b border-slate-400 border-dashed flex items-end justify-center`}>
                        {madrasah?.teacher_signature_url && (
                          <img src={madrasah.teacher_signature_url} className={`${numStudentsOnPage > 22 ? 'h-5' : 'h-6'} object-contain mx-auto`} alt="Signature" />
                        )}
                      </div>
                      <p className={`${numStudentsOnPage > 22 ? 'text-[9px]' : 'text-[10px]'} font-bold text-slate-800`}>{t.classTeacher}</p>
                      <p className={`${numStudentsOnPage > 22 ? 'text-[8px]' : 'text-[9px]'} font-semibold text-slate-500`}>{madrasah?.teacher_name || 'Class Teacher'}</p>
                    </div>

                    {/* Principal */}
                    <div className="text-center w-40">
                      <div className={`${
                        numStudentsOnPage > 22 ? 'h-6 mb-0.5' : 'h-7 mb-1'
                      } border-b border-slate-400 border-dashed flex items-end justify-center`}>
                        {madrasah?.principal_signature_url && (
                          <img src={madrasah.principal_signature_url} className={`${numStudentsOnPage > 22 ? 'h-5' : 'h-6'} object-contain mx-auto`} alt="Signature" />
                        )}
                      </div>
                      <p className={`${numStudentsOnPage > 22 ? 'text-[9px]' : 'text-[10px]'} font-bold text-slate-800`}>{t.principal}</p>
                      <p className={`${numStudentsOnPage > 22 ? 'text-[8px]' : 'text-[9px]'} font-semibold text-slate-500`}>{madrasah?.principal_name || 'Principal'}</p>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className={`text-center ${
                    numStudentsOnPage > 22 ? 'text-[8px] pt-0.5' : 'text-[9px] pt-1'
                  } font-extrabold text-[#1E3A8A] tracking-[0.2em] uppercase border-t border-slate-200`}>
                    {t.knowledgeDisciplineSuccess}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
