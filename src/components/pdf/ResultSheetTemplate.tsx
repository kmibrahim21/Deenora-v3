import React from "react";

interface ResultSheetProps {
  student: any;
  exam: any;
  marks: any[];
  madrasah: any;
  lang: "en" | "bn";
}

export const ResultSheetTemplate: React.FC<ResultSheetProps> = ({
  student,
  exam,
  marks,
  madrasah,
  lang,
}) => {
  const isBangla = lang === "bn";
  const config = React.useMemo(() => {
    let cfg = madrasah?.config_json || {};
    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch (e) {
        cfg = {};
      }
    }
    return cfg;
  }, [madrasah?.config_json]);

  const isHighSchool = config?.result_system === "high_school";

  const toBnNum = (n: number | string) => isBangla ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : String(n);

  const t = {
    marksheet: isBangla ? "একাডেমিক ট্রান্সক্রিপ্ট" : "ACADEMIC TRANSCRIPT",
    name: isBangla ? "শিক্ষার্থীর নাম" : "Student Name",
    fname: isBangla ? "পিতার নাম" : "Father Name",
    mname: isBangla ? "মাতার নাম" : "Mother Name",
    roll: isBangla ? "রোল নম্বর" : "Roll No",
    reg: isBangla ? "রেজিঃ নম্বর" : "Reg No",
    class: isBangla ? "শ্রেণি" : "Class",
    section: isBangla ? "শাখা" : "Section",
    group: isBangla ? "বিভাগ" : "Group",
    shift: isBangla ? "শিফট" : "Shift",
    dob: isBangla ? "জন্ম তারিখ" : "Date of Birth",
    session: isBangla ? "শিক্ষাবর্ষ" : "Session",
    exam: isBangla ? "পরীক্ষার নাম" : "Exam",
    sno: isBangla ? "ক্রমিক" : "SL",
    subject: isBangla ? "বিষয়ের নাম" : "Subject Name",
    code: isBangla ? "কোড" : "Code",
    fullMarks: isBangla ? "পূর্ণমান" : "Full Marks",
    passMarks: isBangla ? "পাস মার্ক" : "Pass Marks",
    obtainedMarks: isBangla ? "প্রাপ্ত নম্বর" : "Obtained",
    total: isBangla ? "মোট" : "Total",
    grade: isBangla ? "গ্রেড" : "Grade",
    gp: isBangla ? "পয়েন্ট" : "GPA",
    summary: isBangla ? "ফলাফল সংক্ষেপ" : "Result Summary",
    totalMarks: isBangla ? "মোট প্রাপ্ত নম্বর" : "Total Marks",
    avg: isBangla ? "গড় নম্বর" : "Average",
    gpa: "GPA",
    status: isBangla ? "অবস্থা" : "Status",
    passed: isBangla ? "উত্তীর্ণ" : "PASSED",
    failed: isBangla ? "অনুত্তীর্ণ" : "FAILED",
    rank: isBangla ? "মেধাক্রম" : "Merit Position",
    attendance: isBangla ? "উপস্থিতি" : "Attendance",
    issueDate: isBangla ? "ইস্যু তারিখ" : "Date of Issue",
    principalSign: isBangla ? "প্রতিষ্ঠান প্রধানের স্বাক্ষর" : "Head of Institution",
    controllerSign: isBangla ? "পরীক্ষা নিয়ন্ত্রক" : "Exam Controller",
    guardianSign: isBangla ? "অভিভাবকের স্বাক্ষর" : "Guardian Signature",
    eiin: isBangla ? "ইআইআইএন" : "EIIN",
    classHighest: isBangla ? "শ্রেণি সর্বোচ্চ" : "Highest",
  };

  const sessionYear = React.useMemo(() => {
    let yr = student.academic_year || exam?.academic_year || String(new Date().getFullYear());
    if (yr === '2025-2026' || yr === '২০২৫-২০২৬') {
      yr = '2026';
    } else if (typeof yr === 'string' && (yr.includes('2025-2026') || yr.includes('২০২৫-২০২৬'))) {
      yr = yr.replace(/2025-2026/g, '2026').replace(/২০২৫-২০২৬/g, '২০২৬');
    }
    return yr;
  }, [student.academic_year, exam?.academic_year]);

  const hasAnyMark = marks.some(m => m.marks_obtained !== undefined && m.marks_obtained !== null && m.marks_obtained !== '');

  const optTotalMode = (config?.optional_subject_total_mode) || 'include';
  
  const totalObtained = hasAnyMark ? marks.filter(m => optTotalMode !== 'exclude' || !m.is_optional).reduce((sum, m) => sum + Number(m.marks_obtained || 0), 0) : '';
  const totalFull = marks.filter(m => optTotalMode !== 'exclude' || !m.is_optional).reduce((sum, m) => sum + Number(m.full_marks || 100), 0);
  
  const averageGpa = hasAnyMark ? (
    student.gpa && student.gpa !== "0.00" 
      ? student.gpa 
      : marks.length > 0 
        ? marks.some(m => m.grade === 'F') ? '0.0' : (marks.reduce((sum, m) => sum + Number(m.grade_point || 0), 0) / marks.length).toFixed(1)
        : '0.0'
  ) : '';

  const finalGrade = hasAnyMark ? (
    student.grade && student.grade !== 'F' && student.grade !== 'রাসিব' && student.grade !== 'Failed'
      ? student.grade 
      : (student.grade === 'রাসিব' || student.grade === 'Failed') ? student.grade
      : averageGpa === '5.0' ? 'A+' : Number(averageGpa) >= 4.0 ? 'A' : Number(averageGpa) >= 3.5 ? 'A-' : Number(averageGpa) >= 3.0 ? 'B' : Number(averageGpa) >= 2.0 ? 'C' : Number(averageGpa) >= 1.0 ? 'D' : 'F'
  ) : '';

  const isPassed = hasAnyMark && finalGrade !== 'F' && finalGrade !== 'রাসিব' && finalGrade !== 'Failed';

  const formattedAttendance = React.useMemo(() => {
    const att = student.attendance;
    if (!att || att === 'N/A' || att === 'null' || att === 'undefined') {
      return 'N/A';
    }
    return String(att);
  }, [student.attendance]);

  const assessmentText = React.useMemo(() => {
    if (!hasAnyMark) return '-';
    if (isBangla) {
      if (finalGrade === 'A+' || finalGrade === 'মুমতাজ') return 'চমৎকার';
      if (finalGrade === 'A' || finalGrade === 'জায়্যিদ জিদ্দান') return 'উত্তম';
      if (finalGrade === 'জায়্যিদ') return 'সন্তোষজনক';
      if (finalGrade === 'মকবুল') return 'সাধারণ';
      if (isPassed) return 'সন্তোষজনক';
      return 'প্রচেষ্টা প্রয়োজন';
    }
    if (finalGrade === 'A+' || finalGrade === 'মুমতাজ') return 'Outstanding';
    if (finalGrade === 'A' || finalGrade === 'জায়্যিদ জিদ্দান') return 'Very Good';
    if (finalGrade === 'জায়্যিদ') return 'Good';
    if (finalGrade === 'মকবুল') return 'Satisfactory';
    if (isPassed) return 'Satisfactory';
    return 'Needs Improvement';
  }, [isBangla, finalGrade, isPassed, hasAnyMark]);

  return (
    <div 
      className={`w-[794px] h-[1123px] bg-white p-0 m-0 ${isBangla ? 'font-solaiman' : 'font-inter font-sans'} text-slate-900 relative overflow-hidden print-container shadow-2xl`} 
      style={{ 
        boxSizing: 'border-box', 
        fontFamily: isBangla 
          ? "'SolaimanLipi', 'Hind Siliguri', sans-serif" 
          : "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
      }}
    >
      
      {/* Premium Border Decor */}
      <div className="absolute inset-0 border-[10px] border-[#1E3A8A]/10 pointer-events-none"></div>
      <div className="absolute inset-[10px] border-[1px] border-[#1E3A8A] pointer-events-none"></div>
      <div className="absolute inset-[13px] border-[2px] border-[#1E3A8A] border-double pointer-events-none"></div>

      {/* Fonts Import & Print Styles */}
      <style>{`
        @font-face {
          font-family: 'SolaimanLipi';
          src: url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-normal-v1.0.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'SolaimanLipi';
          src: url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-bold-v1.0.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;700;900&family=Inter:wght@400;600;700;800&family=Tiro+Bangla&family=JetBrains+Mono:wght@500;700&display=swap');
        .font-solaiman, .font-solaiman * { font-family: 'SolaimanLipi', 'Hind Siliguri', sans-serif !important; }
        .font-tiro { font-family: 'Tiro Bangla', serif; }
        .font-noto { font-family: 'SolaimanLipi', 'Hind Siliguri', sans-serif; }
        .font-noto-serif { font-family: 'Noto Serif Bengali', serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-inter { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        
        @media print {
          body { margin: 0; padding: 0; }
          .print-container { box-shadow: none !important; }
        }
      `}</style>

      {/* Watermark Logo */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
        {madrasah.logo_url ? (
          <img src={madrasah.logo_url} className="w-1/2 object-contain grayscale" crossOrigin="anonymous" />
        ) : (
          <h1 className="text-8xl font-black uppercase text-[#1E3A8A] -rotate-45">{madrasah.name}</h1>
        )}
      </div>

      <div className="relative z-10 px-8 pt-7 pb-3 h-full flex flex-col justify-between">
        {/* Top Header & Student Info Area */}
        <div>
          {/* Header Section */}
          <div className="flex justify-between items-center border-b-2 border-double border-[#1E3A8A] pb-2 mb-2">
            {/* Institution Logo */}
            <div className="w-20 h-20 shrink-0 flex items-center justify-center border-2 border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
              {madrasah.logo_url ? (
                <img src={madrasah.logo_url} className="max-w-full max-h-full object-contain" crossOrigin="anonymous" />
              ) : (
                <span className="text-3xl font-black text-[#1E3A8A]">{madrasah.name?.charAt(0)}</span>
              )}
            </div>

            {/* School Name & Transcript Title */}
            <div className="flex-1 text-center px-3 min-w-0">
              <h1 className="text-[21px] font-black text-[#1E3A8A] font-noto-serif leading-tight mb-1 uppercase drop-shadow-sm max-w-[520px] mx-auto break-words">
                {madrasah.name}
              </h1>
              <p className="text-[13px] font-bold text-slate-600 mb-1.5 leading-tight max-w-[520px] mx-auto">
                {madrasah.address}
              </p>
              {madrasah.institute_code && (
                <p className="text-[12px] font-black text-[#1E3A8A]/80 uppercase tracking-widest mb-1.5">
                  {t.eiin}: {madrasah.institute_code}
                </p>
              )}
              <div className={`inline-flex items-center justify-center h-9 px-6 border-2 border-[#1E3A8A] bg-blue-50/90 text-[#1E3A8A] rounded-full text-[15.5px] font-black uppercase ${isBangla ? 'tracking-normal min-w-[280px]' : 'tracking-wide'} shadow-sm text-center whitespace-nowrap`}>
                {t.marksheet}
              </div>
            </div>

            {/* Student Photo */}
            <div className="w-20 shrink-0 flex flex-col items-center">
              <div className="w-20 h-24 border-2 border-[#1E3A8A] bg-white overflow-hidden shadow-sm rounded-lg p-0.5">
                 <div className="w-full h-full bg-slate-50 overflow-hidden rounded-md border border-slate-100 flex items-center justify-center">
                  {((madrasah?.config_json?.modules?.student_photo === true) && student.photo_url) ? (
                    <img 
                      src={student.photo_url} 
                      className="w-full h-full object-cover" 
                      alt={student.student_name}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 border border-dashed border-slate-200">
                      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                  )}
                 </div>
              </div>
              <p className="mt-1 text-[11px] font-black uppercase text-slate-700 tracking-wider leading-none">{isBangla ? 'রোল' : 'ROLL'}: {toBnNum(student.roll)}</p>
            </div>
          </div>

          {/* Student Information - Clean Non-Overlapping Grid */}
          <div className="bg-slate-50/90 px-3.5 py-2.5 rounded-xl border border-slate-200 mb-3 grid grid-cols-12 gap-x-3 text-[13.5px] shadow-sm">
            {/* First Column: Personal Info (col-span-5) */}
            <div className="space-y-1.5 border-r border-slate-200 pr-2.5 col-span-5">
              <div className="flex items-center">
                <span className="w-[96px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.name}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-[#1E3A8A] text-[14.5px] truncate">{student.student_name}</span>
              </div>
              <div className="flex items-center">
                <span className="w-[96px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.fname}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px] truncate">{student.guardian_name || '-'}</span>
              </div>
              <div className="flex items-center">
                <span className="w-[96px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.mname}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px] truncate">{student.mother_name || '-'}</span>
              </div>
            </div>

            {/* Middle Column: Academic Info (col-span-4) */}
            <div className="space-y-1.5 border-r border-slate-200 pr-2.5 col-span-4">
              <div className="flex items-center">
                <span className="w-[78px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.class}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px] truncate">{student.classes?.class_name || student.class_name || '-'}</span>
              </div>
              <div className="flex items-center">
                <span className="w-[78px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.roll}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px]">{toBnNum(student.roll)}</span>
              </div>
              <div className="flex items-center">
                <span className="w-[78px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.dob}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px]">{isBangla ? toBnNum(student.date_of_birth || '-') : (student.date_of_birth || '-')}</span>
              </div>
            </div>

            {/* Last Column: Other Info (col-span-3) */}
            <div className="space-y-1.5 pl-0.5 col-span-3">
              <div className="flex items-center">
                <span className="w-[66px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.session}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px]">{toBnNum(sessionYear)}</span>
              </div>
              <div className="flex items-center">
                <span className="w-[66px] whitespace-nowrap text-slate-600 font-bold uppercase text-[11px] shrink-0 leading-tight">{t.reg}</span>
                <span className="text-slate-400 font-bold mx-1">:</span>
                <span className="flex-1 font-black text-slate-900 text-[14px]">{toBnNum(student.registration_number || '-')}</span>
              </div>
            </div>
          </div>

          {/* Exam Title */}
          <div className="mb-2.5 text-center">
              <h4 className={`text-[18px] font-black text-[#1E3A8A] uppercase ${isBangla ? 'tracking-normal font-noto-serif' : 'tracking-wide font-sans'} italic leading-tight`}>
                  {exam.exam_name}
              </h4>
          </div>

          {/* Results Table Area */}
          <div className="mb-2">
            <table className="w-full border-collapse border-2 border-slate-800">
              <thead>
                <tr className="bg-[#1E3A8A] text-white text-[12px] font-black uppercase text-center leading-tight">
                  <th className="border border-slate-700 py-1.5 px-1 w-10">{t.sno}</th>
                  <th className="border border-slate-700 py-1.5 px-2.5 text-left">{t.subject}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[68px]">{t.fullMarks}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[68px]">{t.passMarks}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[68px]">{t.classHighest}</th>
                  {isHighSchool && (
                    <>
                      <th className="border border-slate-700 py-1.5 px-1 w-[50px]">CQ</th>
                      <th className="border border-slate-700 py-1.5 px-1 w-[50px]">MCQ</th>
                      <th className="border border-slate-700 py-1.5 px-1 w-[50px]">Prac.</th>
                    </>
                  )}
                  <th className="border border-slate-700 py-1.5 px-1 w-[72px] bg-blue-900">{t.obtainedMarks}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[58px]">{t.grade}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[58px]">{t.gp}</th>
                </tr>
              </thead>
              <tbody className="text-[14px]">
                {(() => {
                  const rows: any[] = [];
                  let rowCount = 1;

                  marks.forEach((m) => {
                    const children = isHighSchool ? marks.filter(child => child.pair_with_id === m.id) : [];
                    const isParent = children.length > 0;
                    const isChild = isHighSchool && !!m.pair_with_id;

                    rows.push({
                      sl: rowCount++,
                      name: m.subject_name,
                      is_optional: m.is_optional,
                      cq: m.cq_marks,
                      mcq: m.mcq_marks,
                      pr: m.practical_marks,
                      full: m.full_marks || 100,
                      pass: m.pass_marks || 33,
                      highest: m.class_highest || '-',
                      obtained: (m.marks_obtained !== undefined && m.marks_obtained !== null && m.marks_obtained !== '') ? m.marks_obtained : '',
                      gp: isParent ? '-' : (m.grade_point || '0.00'),
                      grade: isParent ? '-' : (m.grade || '-'),
                      isChild: isChild,
                      isParentRow: false
                    });

                    if (isParent && isHighSchool) {
                      let cCQ = Number(m.cq_marks || 0);
                      let cMCQ = Number(m.mcq_marks || 0);
                      let cPR = Number(m.practical_marks || 0);
                      let cFull = Number(m.full_marks || 100);
                      let cObtained = Number(m.marks_obtained || 0);
                      let cFailed = false;

                      if (m.cq_full_marks && cCQ < Math.ceil(m.cq_full_marks * 0.33)) cFailed = true;
                      if (m.mcq_full_marks && cMCQ < Math.ceil(m.mcq_full_marks * 0.33)) cFailed = true;
                      if (m.practical_full_marks && cPR < Math.ceil(m.practical_full_marks * 0.33)) cFailed = true;

                      children.forEach(child => {
                          cCQ += Number(child.cq_marks || 0);
                          cMCQ += Number(child.mcq_marks || 0);
                          cPR += Number(child.practical_marks || 0);
                          cFull += Number(child.full_marks || 100);
                          cObtained += Number(child.marks_obtained || 0);
                          
                          if (child.cq_full_marks && Number(child.cq_marks || 0) < Math.ceil(child.cq_full_marks * 0.33)) cFailed = true;
                          if (child.mcq_full_marks && Number(child.mcq_marks || 0) < Math.ceil(child.mcq_full_marks * 0.33)) cFailed = true;
                          if (child.practical_full_marks && Number(child.practical_marks || 0) < Math.ceil(child.practical_full_marks * 0.33)) cFailed = true;
                      });

                      if (cObtained < Math.ceil(cFull * 0.33)) cFailed = true;

                      const pct = (cObtained / cFull) * 100;
                      let cGrade = 'F';
                      let cGp = '0.00';
                      if (!cFailed) {
                          if (pct >= 80) { cGrade = 'A+'; cGp = '5.00'; }
                          else if (pct >= 70) { cGrade = 'A'; cGp = '4.00'; }
                          else if (pct >= 60) { cGrade = 'A-'; cGp = '3.50'; }
                          else if (pct >= 50) { cGrade = 'B'; cGp = '3.00'; }
                          else if (pct >= 40) { cGrade = 'C'; cGp = '2.00'; }
                          else if (pct >= 33) { cGrade = 'D'; cGp = '1.00'; }
                      }

                      rows.push({
                        sl: rowCount++,
                        name: `${m.subject_name.replace(/1st|2nd|Paper/gi, '').trim()} (Combined)`,
                        is_optional: m.is_optional,
                        cq: cCQ,
                        mcq: cMCQ,
                        pr: cPR,
                        full: cFull,
                        obtained: cObtained,
                        gp: cGp,
                        grade: cGrade,
                        isChild: false,
                        isParentRow: true
                      });
                    }
                  });

                  return rows.map((row, i) => (
                    <tr key={i} className={`${row.isParentRow ? "bg-blue-50/60 font-black" : (i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}`}>
                      <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[13.5px]">{toBnNum(row.sl)}</td>
                      <td className={`border border-slate-300 py-1 px-2.5 font-bold ${isBangla ? 'font-tiro' : 'font-sans'} text-slate-950 text-[14px] leading-normal ${row.isParentRow ? 'text-[#1E3A8A]' : ''}`}>
                        {row.name} {row.is_optional ? <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-1 rounded-sm ml-1 uppercase leading-none border border-blue-200">Optional</span> : ''}
                      </td>
                      <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[14.5px]">{toBnNum(row.full)}</td>
                      <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[14.5px]">{toBnNum(row.pass)}</td>
                      <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[14.5px]">{toBnNum(row.highest)}</td>
                      {isHighSchool && (
                        <>
                          <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[14.5px]">{toBnNum(row.cq ?? '-')}</td>
                          <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[14.5px]">{toBnNum(row.mcq ?? '-')}</td>
                          <td className="border border-slate-300 py-1 px-1 text-center font-bold text-slate-950 text-[14.5px]">{toBnNum(row.pr ?? '-')}</td>
                        </>
                      )}
                      <td className="border border-slate-300 py-1 px-1 text-center font-black text-slate-950 bg-blue-50/40 text-[16px]">{row.obtained !== '' && row.obtained !== undefined && row.obtained !== null ? toBnNum(row.obtained) : ''}</td>
                      <td className={`border border-slate-300 py-1 px-1 text-center font-black text-[16px] ${row.grade === 'F' ? 'text-red-700 bg-red-50/50' : 'text-slate-950'}`}>{row.grade}</td>
                      <td className={`border border-slate-300 py-1 px-1 text-center font-bold text-[15px] ${row.grade === 'F' ? 'text-red-700 bg-red-50/50' : 'text-slate-950'}`}>{toBnNum(row.gp)}</td>
                    </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 text-[13px] font-black border-t-2 border-slate-800">
                  <td colSpan={2} className="border border-slate-300 py-1 px-2.5 text-right uppercase tracking-wider text-[12.5px] text-slate-700">{t.totalMarks}:</td>
                  <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[15px]">{toBnNum(totalFull)}</td>
                  <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[15px]">-</td>
                  <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[15px]">-</td>
                  {isHighSchool && (
                    <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[15px]" colSpan={3}>-</td>
                  )}
                  <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[#1E3A8A] text-[17px] bg-blue-100/60">{toBnNum(totalObtained)}</td>
                  <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[17px] bg-blue-100/60 text-[#1E3A8A]">{finalGrade}</td>
                  <td className="border border-slate-300 py-1 px-1 text-center font-bold text-[17px] bg-blue-100/60 text-[#1E3A8A]">{toBnNum(averageGpa)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Area with Summary & Signatures - Always anchored at bottom */}
        <div className="mt-auto">
          {/* GPA, Merit & Summary Cards */}
          <div className="grid grid-cols-12 gap-3 mb-2.5">
            <div className="col-span-8 bg-slate-50/90 rounded-xl p-3 border border-slate-200/90 flex flex-col justify-between shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-1.5">
                <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="text-xl">🏆</span>
                  <span className="text-[14.5px] font-black text-[#1E3A8A] uppercase whitespace-nowrap">
                    {t.rank}: <span className="text-[#1E3A8A] font-black text-[18px] ml-1">{hasAnyMark && student.merit_position && student.merit_position !== "null" && student.merit_position !== "-" ? toBnNum(student.merit_position) : '-'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span className={`text-xl ${hasAnyMark ? (isPassed ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`}>{hasAnyMark ? (isPassed ? '✓' : '✗') : '-'}</span>
                  <span className={`text-[15.5px] font-black ${hasAnyMark ? (isPassed ? 'text-emerald-700' : 'text-red-700') : 'text-slate-400'} uppercase whitespace-nowrap`}>{hasAnyMark ? (isPassed ? t.passed : t.failed) : '-'}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[12.5px] font-bold text-slate-600 px-0.5 gap-3">
                <span className="whitespace-nowrap shrink-0">{t.attendance}: <strong className="text-slate-900 font-bold text-[14px] ml-1">{toBnNum(formattedAttendance)}</strong></span>
                <span className="whitespace-nowrap shrink-0">{isBangla ? 'মূল্যায়ন' : 'Evaluation'}: <strong className="text-[#1E3A8A] font-black text-[14px] ml-1">{assessmentText}</strong></span>
              </div>
            </div>

            <div className="col-span-4 bg-[#1E3A8A] text-white rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[12px] font-black uppercase tracking-wider text-blue-100 mb-1 whitespace-nowrap">{isBangla ? 'সর্বমোট ফলাফল' : 'Final Grade & GPA'}</p>
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <h2 className="text-[34px] font-black text-white leading-none">{hasAnyMark ? finalGrade : '-'}</h2>
                {hasAnyMark && averageGpa ? <span className="text-[19px] font-black text-blue-200">({toBnNum(averageGpa)})</span> : null}
              </div>
            </div>
          </div>

          {/* Smart Teacher Remarks & Guidance */}
          {(student.smart_remarks || student.teacher_remarks || student.remarks) && (
            <div className="mb-2 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-blue-50/80 rounded-xl px-3.5 py-2 border border-blue-200/80 text-left shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-black text-[#1E3A8A] uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-amber-500">✍️</span>
                  <span>{isBangla ? 'শ্রেণি শিক্ষকের মূল্যায়ন ও দিকনির্দেশনা:' : "Teacher's Evaluation & Progress Remark:"}</span>
                </span>
                <span className="text-[9.5px] font-mono text-blue-800/80 font-bold">Deenora Academic Evaluation</span>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-800 font-medium italic bg-white/70 px-2.5 py-1.5 rounded-lg border border-blue-100/60">
                "{student.smart_remarks || student.teacher_remarks || student.remarks}"
              </p>
            </div>
          )}

          <div className="pt-2 pb-2 flex justify-between items-end gap-x-4">
            {/* Issue Date - Left Side */}
            <div className="w-36 shrink-0 border-l-4 border-[#1E3A8A]/30 pl-3 py-0.5">
                <p className="text-[11px] font-black text-slate-500 uppercase leading-none mb-1">{t.issueDate}</p>
                <p className="text-[14px] font-black text-[#1E3A8A]">{isBangla ? toBnNum(new Date().toLocaleDateString('en-GB')) : new Date().toLocaleDateString('en-GB')}</p>
            </div>

            {/* Signatures - Right Side */}
            <div className="flex-1 flex justify-end items-end gap-x-5">
              <div className="text-center w-36">
                <div className="mb-1 flex items-center justify-center" style={{ height: `${config.signature_height || 28}px` }}>
                    <span className="text-[12px] opacity-10 select-none uppercase font-black text-slate-400">Guardian</span>
                </div>
                <div className="border-t-[1.5px] border-slate-800 pt-1">
                  <p className="text-[11px] font-black uppercase tracking-normal text-slate-800 leading-tight">{t.guardianSign}</p>
                </div>
              </div>

              <div className="text-center w-36">
                <div className="mb-1 flex items-center justify-center" style={{ height: `${config.signature_height || 28}px` }}>
                    <span className="text-[12px] opacity-10 select-none uppercase font-black text-[#1E3A8A]">Academic</span>
                </div>
                <div className="border-t-[1.5px] border-[#1E3A8A] pt-1">
                  <p className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-normal leading-tight">{t.controllerSign}</p>
                </div>
              </div>

              <div className="text-center w-36 relative">
                <div className="mb-1 flex items-center justify-center relative" style={{ height: `${config.signature_height || 28}px` }}>
                  {config.signature_url ? (
                      <img src={config.signature_url} style={{ height: `${config.signature_height || 28}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                  ) : (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                          <div className="w-6 h-6 border border-slate-400 rounded-full flex items-center justify-center -rotate-12">
                              <span className="text-[4px] font-black uppercase">Sig</span>
                          </div>
                      </div>
                  )}
                </div>
                <div className="border-t-[1.5px] border-[#1E3A8A] pt-1">
                  <p className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-normal leading-tight">{t.principalSign}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Decorative Line */}
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-[#1E3A8A]/30 pointer-events-none"></div>
      </div>
    </div>
  );
};


