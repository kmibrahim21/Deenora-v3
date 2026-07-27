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

  const t = {
    marksheet: isBangla ? "একাডেমিক ট্রান্সক্রিপ্ট" : "ACADEMIC TRANSCRIPT",
    name: isBangla ? "শিক্ষার্থীর নাম" : "Student's Name",
    fname: isBangla ? "পিতার নাম" : "Father's Name",
    mname: isBangla ? "মাতার নাম" : "Mother's Name",
    roll: isBangla ? "রোল নম্বর" : "Roll Number",
    reg: isBangla ? "রেজিঃ নম্বর" : "Reg. Number",
    class: isBangla ? "শ্রেণি" : "Class",
    section: isBangla ? "শাখা" : "Section",
    group: isBangla ? "বিভাগ" : "Group",
    shift: isBangla ? "শিফট" : "Shift",
    dob: isBangla ? "জন্ম তারিখ" : "Date of Birth",
    session: isBangla ? "শিক্ষাবর্ষ" : "Academic Session",
    exam: isBangla ? "পরীক্ষার নাম" : "Name of Exam",
    sno: isBangla ? "ক্রমিক" : "S.L",
    subject: isBangla ? "বিষয়ের নাম" : "Name of Subjects",
    code: isBangla ? "কোড" : "Code",
    fullMarks: isBangla ? "পূর্ণমান" : "FULL MARKS",
    passMarks: isBangla ? "পাস মার্ক" : "PASS MARKS",
    obtainedMarks: isBangla ? "প্রাপ্ত নম্বর" : "OBTAINED",
    total: isBangla ? "মোট" : "Total",
    grade: isBangla ? "গ্রেড" : "GRADE",
    gp: isBangla ? "পয়েন্ট" : "GPA",
    summary: isBangla ? "ফলাফল সংক্ষেপ" : "Result Summary",
    totalMarks: isBangla ? "মোট প্রাপ্ত নম্বর" : "Total Marks",
    avg: isBangla ? "গড় নম্বর" : "Average",
    gpa: isBangla ? "জিপিএ" : "GPA",
    status: isBangla ? "অবস্থা" : "Status",
    passed: isBangla ? "উত্তীর্ণ" : "PASSED",
    failed: isBangla ? "অনুত্তীর্ণ" : "FAILED",
    rank: isBangla ? "মেধাস্থান" : "Merit Position",
    attendance: isBangla ? "উপস্থিতি" : "Attendance",
    issueDate: isBangla ? "ইস্যু তারিখ" : "Date of Publication",
    principalSign: isBangla ? "অধ্যক্ষের স্বাক্ষর" : "Head of Institution",
    controllerSign: isBangla ? "পরীক্ষা নিয়ন্ত্রক" : "Controller of Exam",
    guardianSign: isBangla ? "অভিভাবকের স্বাক্ষর" : "Guardian's Signature",
    eiin: isBangla ? "ইআইআইএন" : "EIIN",
    classHighest: isBangla ? "শ্রেণি সর্বোচ্চ" : "CLASS HIGHEST",
  };

  const hasAnyMark = marks.some(m => m.marks_obtained !== undefined && m.marks_obtained !== null && m.marks_obtained !== '');

  const totalObtained = hasAnyMark ? marks.filter(m => !m.is_optional).reduce((sum, m) => sum + Number(m.marks_obtained || 0), 0) : '';
  const totalFull = marks.filter(m => !m.is_optional).reduce((sum, m) => sum + Number(m.full_marks || 100), 0);
  
  const averageGpa = hasAnyMark ? (
    student.gpa && student.gpa !== "0.00" 
      ? student.gpa 
      : marks.length > 0 
        ? marks.some(m => m.grade === 'F') ? '0.00' : (marks.reduce((sum, m) => sum + Number(m.grade_point || 0), 0) / marks.length).toFixed(2)
        : '0.00'
  ) : '';

  const finalGrade = hasAnyMark ? (
    student.grade && student.grade !== 'F' 
      ? student.grade 
      : averageGpa === '5.00' ? 'A+' : averageGpa >= '4.00' ? 'A' : averageGpa >= '3.50' ? 'A-' : averageGpa >= '3.00' ? 'B' : averageGpa >= '2.00' ? 'C' : averageGpa >= '1.00' ? 'D' : 'F'
  ) : '';

  const isPassed = hasAnyMark && finalGrade !== 'F';

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
      if (finalGrade === 'A+') return 'চমৎকার';
      if (finalGrade === 'A') return 'উত্তম';
      if (isPassed) return 'সন্তোষজনক';
      return 'প্রচেষ্টা প্রয়োজন';
    }
    if (finalGrade === 'A+') return 'Outstanding';
    if (finalGrade === 'A') return 'Very Good';
    if (isPassed) return 'Satisfactory';
    return 'Needs Improvement';
  }, [isBangla, finalGrade, isPassed, hasAnyMark]);

  return (
    <div className={`w-[794px] h-[1123px] bg-white p-0 m-0 ${isBangla ? 'font-noto' : 'font-hind'} text-slate-900 relative overflow-hidden print-container shadow-2xl`} style={{ boxSizing: 'border-box' }}>
      
      {/* Premium Border Decor */}
      <div className="absolute inset-0 border-[10px] border-[#1E3A8A]/10 pointer-events-none"></div>
      <div className="absolute inset-[10px] border-[1px] border-[#1E3A8A] pointer-events-none"></div>
      <div className="absolute inset-[13px] border-[2px] border-[#1E3A8A] border-double pointer-events-none"></div>

      {/* Fonts Import & Print Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;700;900&family=Inter:wght@400;600;800&family=Tiro+Bangla&family=JetBrains+Mono:wght@500;700&display=swap');
        .font-tiro { font-family: 'Tiro Bangla', serif; }
        .font-noto { font-family: 'Hind Siliguri', sans-serif; }
        .font-noto-serif { font-family: 'Noto Serif Bengali', serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-inter { font-family: 'Inter', sans-serif; }
        
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

      <div className="relative z-10 px-8 py-7 h-full flex flex-col justify-between">
        {/* Top Header & Student Info Area */}
        <div>
          {/* Header Section */}
          <div className="flex justify-between items-center border-b-2 border-double border-[#1E3A8A] pb-3 mb-3">
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
              <h1 className="text-[21px] font-black text-[#1E3A8A] font-noto-serif leading-tight mb-1 uppercase drop-shadow-sm">
                {madrasah.name}
              </h1>
              <p className="text-[10px] font-bold text-slate-600 mb-1.5 leading-tight max-w-[450px] mx-auto">
                {madrasah.address}
              </p>
              {madrasah.institute_code && (
                <p className="text-[10px] font-black text-[#1E3A8A]/70 uppercase tracking-[0.25em] mb-1.5">
                  {t.eiin}: {madrasah.institute_code}
                </p>
              )}
              <div className={`inline-flex items-center justify-center h-8 px-7 border-2 border-[#1E3A8A] bg-blue-50/90 text-[#1E3A8A] rounded-full text-[14px] font-black uppercase ${isBangla ? 'tracking-normal min-w-[280px]' : 'tracking-[0.2em]'} shadow-sm text-center whitespace-nowrap`}>
                {t.marksheet}
              </div>
            </div>

            {/* Student Photo */}
            <div className="w-20 shrink-0 flex flex-col items-center">
              <div className="w-20 h-24 border-2 border-[#1E3A8A] bg-white overflow-hidden shadow-sm rounded-lg p-0.5">
                 <div className="w-full h-full bg-slate-50 overflow-hidden rounded-md border border-slate-100 flex items-center justify-center">
                  {student.photo_url ? (
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
              <p className="mt-1 text-[8px] font-black uppercase text-slate-500 tracking-wider leading-none">{isBangla ? 'রোল' : 'ROLL'}: {student.roll}</p>
            </div>
          </div>

          {/* Student Information */}
          <div className="bg-slate-50/80 px-4 py-2.5 rounded-xl border border-slate-200 mb-2.5 grid grid-cols-12 gap-x-4 text-[12px] shadow-sm">
            {/* First Column: Personal Info */}
            <div className="space-y-1 border-r border-slate-200 pr-3 col-span-5">
              <div className="flex items-start"><span className="w-20 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.name}</span><span className="flex-1 font-black text-[#1E3A8A] tracking-tight line-clamp-1 leading-tight">: {student.student_name}</span></div>
              <div className="flex items-start"><span className="w-20 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.fname}</span><span className="flex-1 font-black text-slate-800 tracking-tight line-clamp-1 leading-tight">: {student.guardian_name || '-'}</span></div>
              <div className="flex items-start"><span className="w-20 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.mname}</span><span className="flex-1 font-black text-slate-800 tracking-tight line-clamp-1 leading-tight">: {student.mother_name || '-'}</span></div>
            </div>
            {/* Middle Column: Academic Info */}
            <div className="space-y-1 border-r border-slate-200 pr-3 col-span-4">
              <div className="flex items-center"><span className="w-16 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.class}</span><span className="flex-1 font-black text-slate-800 tracking-tight">: {student.classes?.class_name || student.class_name || '-'}</span></div>
              <div className="flex items-center"><span className="w-16 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.roll}</span><span className="flex-1 font-black text-slate-800">: {student.roll}</span></div>
              <div className="flex items-center"><span className="w-16 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.dob}</span><span className="flex-1 font-black text-slate-800">: {student.date_of_birth || '-'}</span></div>
            </div>
            {/* Last Column: Other Info */}
            <div className="space-y-1 pl-1 col-span-3">
              <div className="flex items-center"><span className="w-16 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.session}</span><span className="flex-1 font-black text-slate-800">: {student.academic_year || new Date().getFullYear()}</span></div>
              <div className="flex items-center"><span className="w-16 text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.reg}</span><span className="flex-1 font-black text-slate-800">: {student.registration_number || '-'}</span></div>
            </div>
          </div>

          {/* Exam Title */}
          <div className="mb-2 text-center">
              <h4 className="text-[15px] font-black text-[#1E3A8A] uppercase tracking-[0.25em] font-noto-serif italic">
                  {exam.exam_name}
              </h4>
          </div>

          {/* Results Table Area */}
          <div className="mb-2">
            <table className="w-full border-collapse border-2 border-slate-800">
              <thead>
                <tr className="bg-[#1E3A8A] text-white text-[10px] font-black uppercase text-center">
                  <th className="border border-slate-700 py-1.5 px-1 w-8">{t.sno}</th>
                  <th className="border border-slate-700 py-1.5 px-3 text-left">{t.subject}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[55px]">{t.fullMarks}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[55px]">{t.passMarks}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[60px]">{t.classHighest}</th>
                  {isHighSchool && (
                    <>
                      <th className="border border-slate-700 py-1.5 px-1 w-[45px]">CQ</th>
                      <th className="border border-slate-700 py-1.5 px-1 w-[45px]">MCQ</th>
                      <th className="border border-slate-700 py-1.5 px-1 w-[45px]">Prac.</th>
                    </>
                  )}
                  <th className="border border-slate-700 py-1.5 px-1 w-[60px] bg-blue-900">{t.obtainedMarks}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[50px]">{t.grade}</th>
                  <th className="border border-slate-700 py-1.5 px-1 w-[50px]">{t.gp}</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {(() => {
                  const rows: any[] = [];
                  let rowCount = 1;

                  marks.forEach((m, i) => {
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
                      <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[11px] font-black text-slate-950">{String(row.sl).padStart(2, '0')}</td>
                      <td className={`border border-slate-300 py-1 px-3 font-bold font-tiro text-slate-950 leading-tight ${row.isParentRow ? 'text-[#1E3A8A]' : ''}`}>
                        {row.name} {row.is_optional ? <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1 rounded-sm ml-1 uppercase leading-none border border-blue-200">Optional</span> : ''}
                      </td>
                      <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[12px] font-bold text-slate-950">{row.full}</td>
                      <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[12px] font-bold text-slate-950">{row.pass}</td>
                      <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[12px] font-bold text-slate-950">{row.highest}</td>
                      {isHighSchool && (
                        <>
                          <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[12px] font-bold text-slate-950">{row.cq ?? '-'}</td>
                          <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[12px] font-bold text-slate-950">{row.mcq ?? '-'}</td>
                          <td className="border border-slate-300 py-1 px-1 text-center font-mono text-[12px] font-bold text-slate-950">{row.pr ?? '-'}</td>
                        </>
                      )}
                      <td className="border border-slate-300 py-1 px-1 text-center font-black font-mono text-slate-950 bg-blue-50/40 text-[13px]">{row.obtained !== '' && row.obtained !== undefined && row.obtained !== null ? String(row.obtained).padStart(2, '0') : ''}</td>
                      <td className={`border border-slate-300 py-1 px-1 text-center font-black text-[13px] ${row.grade === 'F' ? 'text-red-700 bg-red-50/50' : 'text-slate-950'}`}>{row.grade}</td>
                      <td className={`border border-slate-300 py-1 px-1 text-center font-bold font-mono text-[12px] ${row.grade === 'F' ? 'text-red-700 bg-red-50/50' : 'text-slate-950'}`}>{row.gp}</td>
                    </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 text-[12px] font-black border-t-2 border-slate-800">
                  <td colSpan={2} className="border border-slate-300 py-1.5 px-3 text-right uppercase tracking-wider text-[10px] text-slate-600">{t.totalMarks}:</td>
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-[13px]">{totalFull}</td>
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-[13px]">-</td>
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-[13px]">-</td>
                  {isHighSchool && (
                    <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-[13px]" colSpan={3}>-</td>
                  )}
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-[#1E3A8A] text-[15px] bg-blue-100/60">{totalObtained}</td>
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-bold text-[15px] bg-blue-100/60 text-[#1E3A8A]">{finalGrade}</td>
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-[15px] bg-blue-100/60 text-[#1E3A8A]">{averageGpa}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Area with Summary & Signatures - Always anchored at bottom */}
        <div className="mt-auto">
          {/* GPA, Merit & Summary Cards */}
          <div className="grid grid-cols-12 gap-3 mb-3">
            <div className="col-span-8 bg-slate-50/90 rounded-xl p-3 border border-slate-200/90 flex flex-col justify-between shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-1.5">
                <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="text-base">🏆</span>
                  <span className="text-[13px] font-black text-[#1E3A8A] uppercase whitespace-nowrap">
                    {t.rank}: <span className="text-[#1E3A8A] font-mono text-[15px] font-black ml-1">{hasAnyMark && student.merit_position && student.merit_position !== "null" && student.merit_position !== "-" ? student.merit_position : '-'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span className={`text-base ${hasAnyMark ? (isPassed ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`}>{hasAnyMark ? (isPassed ? '✓' : '✗') : '-'}</span>
                  <span className={`text-[13px] font-black ${hasAnyMark ? (isPassed ? 'text-emerald-700' : 'text-red-700') : 'text-slate-400'} uppercase whitespace-nowrap`}>{hasAnyMark ? (isPassed ? t.passed : t.failed) : '-'}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 px-0.5 gap-2">
                <span className="whitespace-nowrap shrink-0">{isBangla ? 'উপস্থিতি' : 'Attendance'}: <strong className="text-slate-900 font-mono text-[12px] ml-1">{formattedAttendance}</strong></span>
                <span className="whitespace-nowrap shrink-0">{isBangla ? 'মূল্যায়ন' : 'Assessment'}: <strong className="text-[#1E3A8A] font-black ml-1">{assessmentText}</strong></span>
              </div>
            </div>

            <div className="col-span-4 bg-[#1E3A8A] text-white rounded-xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-wider text-blue-100 mb-1 whitespace-nowrap">{isBangla ? 'সর্বমোট ফলাফল' : 'Final Grade & GPA'}</p>
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <h2 className="text-[28px] font-black text-white leading-none">{hasAnyMark ? finalGrade : '-'}</h2>
                {hasAnyMark && averageGpa ? <span className="text-[15px] font-black font-mono text-blue-200">({averageGpa})</span> : null}
              </div>
            </div>
          </div>

          <div className="pt-2 pb-2 flex justify-between items-end gap-x-4">
            {/* Issue Date - Left Side */}
            <div className="w-32 shrink-0 border-l-4 border-[#1E3A8A]/30 pl-3 py-0.5">
                <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{t.issueDate}</p>
                <p className="text-[11px] font-black text-[#1E3A8A] font-mono">{new Date().toLocaleDateString('en-GB')}</p>
            </div>

            {/* Signatures - Right Side */}
            <div className="flex-1 flex justify-end items-end gap-x-6">
              <div className="text-center w-32">
                <div className="mb-1 flex items-center justify-center" style={{ height: `${config.signature_height || 28}px` }}>
                    <span className="text-[11px] font-noto opacity-10 select-none uppercase font-black text-slate-400">Guardian</span>
                </div>
                <div className="border-t-[1.5px] border-slate-800 pt-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-800">{t.guardianSign}</p>
                </div>
              </div>

              <div className="text-center w-32">
                <div className="mb-1 flex items-center justify-center" style={{ height: `${config.signature_height || 28}px` }}>
                    <span className="text-[11px] font-noto opacity-10 select-none uppercase font-black text-[#1E3A8A]">Academic</span>
                </div>
                <div className="border-t-[1.5px] border-[#1E3A8A] pt-1">
                  <p className="text-[9px] font-black text-[#1E3A8A] uppercase tracking-wider">{t.controllerSign}</p>
                </div>
              </div>

              <div className="text-center w-32 relative">
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
                  <p className="text-[9px] font-black text-[#1E3A8A] uppercase tracking-wider">{t.principalSign}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Branding Footer */}
          <div className="mt-1 text-center border-t border-slate-100 pt-1.5 relative z-20">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Powered by Deenora SaaS • deenora.com</p>
          </div>
        </div>

        {/* Bottom Decorative Line */}
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-[#1E3A8A]/30 pointer-events-none"></div>
      </div>
    </div>
  );
};


