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
    fullMarks: isBangla ? "পূর্ণমান" : "Full Marks",
    passMarks: isBangla ? "পাস মার্ক" : "Pass Marks",
    obtainedMarks: isBangla ? "প্রাপ্ত নম্বর" : "Obtained",
    total: isBangla ? "মোট" : "Total",
    grade: isBangla ? "গ্রেড" : "Grade",
    gp: isBangla ? "পয়েন্ট" : "GPA",
    summary: isBangla ? "ফলাফল সংক্ষেপ" : "Result Summary",
    totalMarks: isBangla ? "মোট প্রাপ্ত নম্বর" : "Total Marks",
    avg: isBangla ? "গড় নম্বর" : "Average",
    gpa: isBangla ? "জিপিএ" : "GPA",
    status: isBangla ? "অবস্থা" : "Status",
    passed: isBangla ? "উত্তীর্ণ" : "PASSED",
    failed: isBangla ? "অনুত্তীর্ণ" : "FAILED",
    rank: isBangla ? "মেধা স্থান" : "Merit Position",
    attendance: isBangla ? "উপস্থিতি" : "Attendance",
    issueDate: isBangla ? "ইস্যু তারিখ" : "Date of Publication",
    principalSign: isBangla ? "অধ্যক্ষের স্বাক্ষর" : "Head of Institution",
    controllerSign: isBangla ? "পরীক্ষা নিয়ন্ত্রক" : "Controller of Exam",
    guardianSign: isBangla ? "অভিভাবকের স্বাক্ষর" : "Guardian's Signature",
    eiin: isBangla ? "ইআইআইএন" : "EIIN",
    classHighest: isBangla ? "শ্রেণী সর্বোচ্চ" : "Class Highest",
  };

  const totalObtained = marks.filter(m => !m.is_optional).reduce((sum, m) => sum + Number(m.marks_obtained || 0), 0);
  const totalFull = marks.filter(m => !m.is_optional).reduce((sum, m) => sum + Number(m.full_marks || 100), 0);
  
  const averageGpa = student.gpa && student.gpa !== "0.00" 
    ? student.gpa 
    : marks.length > 0 
      ? marks.some(m => m.grade === 'F') ? '0.00' : (marks.reduce((sum, m) => sum + Number(m.grade_point || 0), 0) / marks.length).toFixed(2)
      : '0.00';

  const finalGrade = student.grade && student.grade !== 'F' 
    ? student.grade 
    : averageGpa === '5.00' ? 'A+' : averageGpa >= '4.00' ? 'A' : averageGpa >= '3.50' ? 'A-' : averageGpa >= '3.00' ? 'B' : averageGpa >= '2.00' ? 'C' : averageGpa >= '1.00' ? 'D' : 'F';

  const isPassed = finalGrade !== 'F';

  return (
    <div className={`w-[794px] h-[1123px] bg-white p-0 m-0 ${isBangla ? 'font-noto' : 'font-hind'} text-slate-900 relative overflow-hidden print-container shadow-2xl`} style={{ boxSizing: 'border-box' }}>
      
      {/* Premium Border Decor */}
      <div className="absolute inset-0 border-[12px] border-[#1E3A8A]/10 pointer-events-none"></div>
      <div className="absolute inset-[12px] border-[1px] border-[#1E3A8A] pointer-events-none"></div>
      <div className="absolute inset-[15px] border-[3px] border-[#1E3A8A] border-double pointer-events-none"></div>

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

      <div className="relative z-10 px-10 py-10 h-full flex flex-col">
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-double border-[#1E3A8A] pb-6 mb-4">
          {/* Institution Logo */}
          <div className="w-24 h-24 shrink-0 flex items-center justify-center border-2 border-slate-100 rounded-xl bg-slate-50 overflow-hidden shadow-sm shadow-blue-900/10">
            {madrasah.logo_url ? (
              <img src={madrasah.logo_url} className="max-w-full max-h-full object-contain" crossOrigin="anonymous" />
            ) : (
              <span className="text-4xl font-black text-blue-900">{madrasah.name?.charAt(0)}</span>
            )}
          </div>

          {/* School Name & Transcript Title */}
          <div className="flex-1 text-center px-4 min-w-0">
            <h1 className="text-[24px] font-black text-[#1E3A8A] font-noto-serif leading-tight mb-1.5 uppercase drop-shadow-sm">
              {madrasah.name}
            </h1>
            <p className="text-[11px] font-bold text-slate-600 mb-3 leading-tight max-w-[480px] mx-auto">
              {madrasah.address}
            </p>
            {madrasah.institute_code && (
              <p className="text-[11px] font-black text-blue-900/60 uppercase tracking-[0.3em] mb-2">
                {t.eiin}: {madrasah.institute_code}
              </p>
            )}
            <div className={`inline-flex items-center justify-center min-h-[40px] px-10 border-2 border-[#1E3A8A] bg-blue-50 text-[#1E3A8A] rounded-full text-[18px] font-black uppercase ${isBangla ? 'tracking-normal min-w-[340px]' : 'tracking-[0.25em]'} shadow-sm text-center whitespace-nowrap`}>
              {t.marksheet}
            </div>
          </div>

          {/* Student Photo */}
          <div className="w-24 shrink-0 flex flex-col items-center">
            <div className="w-24 h-28 border-2 border-[#1E3A8A] bg-white overflow-hidden shadow-sm rounded-lg p-0.5">
               <div className="w-full h-full bg-slate-50 overflow-hidden rounded-md border border-slate-100 flex items-center justify-center">
                {student.photo_url ? (
                  <img 
                    src={student.photo_url} 
                    className="w-full h-full object-cover" 
                    alt={student.student_name}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                )}
               </div>
            </div>
            <p className="mt-1 text-[7px] font-black uppercase text-slate-400 tracking-[0.1em] leading-none">{isBangla ? 'রোল' : 'ROLL'}: {student.roll}</p>
          </div>
        </div>

        {/* Student Information */}
        <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-200 mb-4 grid grid-cols-12 gap-x-6 text-[15px] shadow-sm">
          {/* First Column: Personal Info */}
          <div className="space-y-2 border-r border-slate-200 pr-5 col-span-5">
            <div className="flex items-start"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] mt-0.5 leading-none shrink-0">{t.name}</span><span className="flex-1 font-black text-[#1E3A8A] tracking-tight line-clamp-2 leading-tight">: {student.student_name}</span></div>
            <div className="flex items-start"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] mt-0.5 leading-none shrink-0">{t.fname}</span><span className="flex-1 font-black text-slate-800 tracking-tight line-clamp-2 leading-tight">: {student.guardian_name || '-'}</span></div>
            <div className="flex items-start"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] mt-0.5 leading-none shrink-0">{t.mname}</span><span className="flex-1 font-black text-slate-800 tracking-tight line-clamp-2 leading-tight">: {student.mother_name || '-'}</span></div>
          </div>
          {/* Middle Column: Academic Info */}
          <div className="space-y-2 border-r border-slate-200 pr-5 col-span-4">
            <div className="flex items-center"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] leading-none shrink-0">{t.class}</span><span className="flex-1 font-black text-slate-800 tracking-tight">: {student.classes?.class_name || student.class_name || '-'}</span></div>
            <div className="flex items-center"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] leading-none shrink-0">{t.roll}</span><span className="flex-1 font-black text-slate-800">: {student.roll}</span></div>
            <div className="flex items-center"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] leading-none shrink-0">{t.dob}</span><span className="flex-1 font-black text-slate-800">: {student.date_of_birth || '-'}</span></div>
          </div>
          {/* Last Column: Other Info */}
          <div className="space-y-2 pl-2 col-span-3">
            <div className="flex items-center"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] leading-none shrink-0">{t.session}</span><span className="flex-1 font-black text-slate-800">: {student.academic_year || new Date().getFullYear()}</span></div>
            <div className="flex items-center"><span className="w-20 text-slate-500 font-bold uppercase text-[11px] leading-none shrink-0">{t.reg}</span><span className="flex-1 font-black text-slate-800">: {student.registration_number || '-'}</span></div>
          </div>
        </div>

        {/* Exam Title */}
        <div className="mb-3 text-center">
            <h4 className="text-[17px] font-black text-[#1E3A8A] uppercase tracking-[0.4em] font-noto-serif italic">
                {exam.exam_name}
            </h4>
        </div>

        {/* Results Table Area */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <table className="w-full border-collapse border-2 border-slate-900 mb-3">
            <thead>
              <tr className="bg-[#1E3A8A] text-white text-[11px] font-black uppercase text-center">
                <th className="border border-slate-900/20 py-2 px-1 w-10">{t.sno}</th>
                <th className="border border-slate-900/20 py-2 px-4 text-left">{t.subject}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[60px]">{t.fullMarks}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[60px]">{t.passMarks}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[70px]">{t.classHighest}</th>
                {isHighSchool && (
                  <>
                    <th className="border border-slate-900/20 py-2 px-1 w-[50px]">CQ</th>
                    <th className="border border-slate-900/20 py-2 px-1 w-[50px]">MCQ</th>
                    <th className="border border-slate-900/20 py-2 px-1 w-[50px]">Practical</th>
                  </>
                )}
                <th className="border border-slate-900/20 py-2 px-1 w-[60px] bg-blue-900 shadow-inner">{t.obtainedMarks}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[55px]">{t.gp}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[55px]">{t.grade}</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {(() => {
                const rows: any[] = [];
                let rowCount = 1;

                marks.forEach((m, i) => {
                  const children = isHighSchool ? marks.filter(child => child.pair_with_id === m.id) : [];
                  const isParent = children.length > 0;
                  const isChild = isHighSchool && !!m.pair_with_id;

                  // Add the current row (Individual Paper)
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
                    obtained: m.marks_obtained || 0,
                    gp: isParent ? '-' : (m.grade_point || '0.00'),
                    grade: isParent ? '-' : (m.grade || '-'),
                    isChild: isChild,
                    isParentRow: false
                  });

                  // If it's a parent, add the combined row after its children are processed? 
                  // In the image, Bangla 1st, Bangla 2nd, then Bangla (Combined).
                  // So we need to make sure we don't repeat children if they are already in the list.
                  // The loop iterates over all marks. If we hit a parent, we might want to group them.
                  
                  if (isParent && isHighSchool) {
                    let cCQ = Number(m.cq_marks || 0);
                    let cMCQ = Number(m.mcq_marks || 0);
                    let cPR = Number(m.practical_marks || 0);
                    let cFull = Number(m.full_marks || 100);
                    let cObtained = Number(m.marks_obtained || 0);
                    let cFailed = false;

                    // Breakdown fail check for parent
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
                  <tr key={i} className={`${row.isParentRow ? "bg-blue-50/50 font-black" : (i % 2 === 0 ? "bg-white" : "bg-slate-50/10")}`}>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[11px] font-bold text-slate-400">{String(row.sl).padStart(2, '0')}</td>
                    <td className={`border border-slate-900 py-1 px-4 font-bold font-tiro text-slate-800 leading-tight ${row.isParentRow ? 'text-blue-900' : ''}`}>
                      {row.name} {row.is_optional ? <span className="text-[9px] font-black text-blue-400 bg-blue-50 px-1 rounded-sm ml-1 uppercase leading-none">Optional</span> : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.full}</td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.pass}</td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.highest}</td>
                    {isHighSchool && (
                      <>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.cq ?? '-'}</td>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.mcq ?? '-'}</td>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.pr ?? '-'}</td>
                      </>
                    )}
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-900">{row.full}</td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-black font-mono text-blue-900 bg-blue-50/20 text-[15px]">{String(row.obtained).padStart(2, '0')}</td>
                    <td className={`border border-slate-900 py-1 px-1 text-center font-bold font-mono text-[13px] ${row.grade === 'F' ? 'text-red-800 bg-red-50/20' : 'text-slate-900'}`}>{row.gp}</td>
                    <td className={`border border-slate-900 py-1 px-1 text-center font-black text-[15px] ${row.grade === 'F' ? 'text-red-800 bg-red-50/20' : 'text-blue-900'}`}>{row.grade}</td>
                  </tr>
                ));
              })()}
              {Array.from({ length: Math.max(0, 12 - marks.length) }).map((_, i) => (
                <tr key={`pad-${i}`}>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   {isHighSchool && (
                     <>
                        <td className="border border-slate-900 py-2.5">&nbsp;</td>
                        <td className="border border-slate-900 py-2.5">&nbsp;</td>
                        <td className="border border-slate-900 py-2.5">&nbsp;</td>
                     </>
                   )}
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 text-[13px] font-black">
                <td colSpan={2} className="border border-slate-900 py-2 px-4 text-right uppercase tracking-[0.05em] text-[11px] text-slate-500">{t.totalMarks}:</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[15px]">{totalFull}</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[15px]">-</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[15px]">-</td>
                {isHighSchool && (
                  <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[15px]" colSpan={3}>-</td>
                )}
                <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[#1E3A8A] text-[18px] bg-blue-100/50">{totalObtained}</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-serif text-[20px] bg-blue-100/50 text-[#1E3A8A]" colSpan={2}>{finalGrade}</td>
              </tr>
            </tfoot>
          </table>

          {/* GPA & Merit Info */}
          <div className="space-y-1.5 mb-4">
              <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-6 py-2">
                  <span className="text-[14px] font-black text-slate-500 uppercase">{isBangla ? 'মোট নম্বর' : 'Total Obtained'}: <span className="text-blue-900 ml-2">{totalObtained}</span></span>
                  <span className="text-[14px] font-black text-slate-500 uppercase">{isBangla ? 'জিপিএ' : 'GPA'}: <span className="text-blue-900 ml-2">{averageGpa}</span></span>
              </div>
              
              {student.gpa_without_optional && (
                <div className="flex justify-between items-center border border-slate-100 rounded-lg px-6 py-1.5 text-slate-500">
                    <span className="text-[11px] font-bold uppercase">{isBangla ? '৪র্থ বিষয় ছাড়া জিপিএ' : 'GPA Without 4th Subject'}:</span>
                    <span className="text-[12px] font-black font-mono">{student.gpa_without_optional}</span>
                </div>
              )}

              <div className="flex justify-center items-center gap-6 py-2">
                  <div className="flex items-center gap-2">
                      <span className="text-2xl">🏆</span>
                      <span className="text-[15px] font-black text-[#1E3A8A] uppercase">{t.rank}: {student.merit_position || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className={`text-xl ${isPassed ? 'text-emerald-500' : 'text-red-500'}`}>{isPassed ? '✅' : '❌'}</span>
                      <span className={`text-[15px] font-black ${isPassed ? 'text-emerald-600' : 'text-red-600'} uppercase`}>{isPassed ? t.passed : t.failed}</span>
                  </div>
              </div>
          </div>

          {/* Remarks & Overall Grade */}
          <div className="grid grid-cols-12 gap-4 border-2 border-slate-900 rounded-xl overflow-hidden mb-4">
              <div className="col-span-8 p-3 border-r border-slate-200 bg-white">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1 leading-none">{isBangla ? 'উপস্থিতি' : 'Attendance'}: {student.attendance || '0'}/120</p>
                  <div className="border-t border-slate-100 pt-2">
                      <p className="text-[12px] font-black text-center text-slate-700 italic">
                        {isBangla ? 'সার্বিক মূল্যায়ন' : 'Overall Assessment'}: {finalGrade === 'A+' ? 'Excellent performance!' : finalGrade === 'A' ? 'Very good result.' : isPassed ? 'Satisfactory, keep it up.' : 'Hard work needed.'}
                      </p>
                  </div>
              </div>
              <div className="col-span-4 p-3 bg-slate-50 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1 leading-none">{isBangla ? 'সর্বমোট গ্রেড' : 'Overall Grade'}</p>
                  <h2 className="text-[32px] font-black text-[#1E3A8A] leading-none">{finalGrade}</h2>
              </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="mt-auto pb-6 flex justify-between items-end gap-x-6">
          {/* Issue Date - Left Side */}
          <div className="w-32 shrink-0 border-l-4 border-[#1E3A8A]/20 pl-4 py-1">
              <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{t.issueDate}</p>
              <p className="text-[12px] font-black text-blue-900 font-mono">{new Date().toLocaleDateString('en-GB')}</p>
          </div>

          {/* Signatures - Right Side */}
          <div className="flex-1 flex justify-end gap-x-8">
            <div className="text-center w-36">
              <div className="h-8 mb-1 flex items-center justify-center">
                  <span className="text-[12px] font-noto opacity-5 select-none uppercase font-black text-slate-400">Guardian</span>
              </div>
              <div className="border-t-[1.5px] border-slate-900 pt-1.5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-800">{t.guardianSign}</p>
              </div>
            </div>

            <div className="text-center w-36">
              <div className="h-8 mb-1 flex items-center justify-center">
                  <span className="text-[12px] font-noto opacity-5 select-none uppercase font-black text-[#1E3A8A]">Academic</span>
              </div>
              <div className="border-t-[1.5px] border-[#1E3A8A] pt-1.5 shadow-sm">
                <p className="text-[10px] font-black text-[#1E3A8A] uppercase tracking-wider">{t.controllerSign}</p>
              </div>
            </div>

            <div className="text-center w-36 relative">
              <div className="mb-1 flex items-center justify-center relative" style={{ height: `${config.signature_height || 36}px` }}>
                {config.signature_url ? (
                    <img src={config.signature_url} style={{ height: `${config.signature_height || 36}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                        <div className="w-8 h-8 border border-slate-400 rounded-full flex items-center justify-center -rotate-12">
                            <span className="text-[5px] font-black uppercase">Sig</span>
                        </div>
                    </div>
                )}
              </div>
              <div className="border-t-[1.5px] border-[#1E3A8A] pt-1.5 shadow-sm">
                <p className="text-[10px] font-black text-[#1E3A8A] uppercase tracking-wider">{t.principalSign}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Branding Footer */}
        <div className="mt-2 text-center border-t border-slate-50 pt-2 relative z-20">
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">Powered by Deenora SaaS • deenora.com</p>
        </div>

        {/* Bottom Curve Design */}
        <div className="absolute -bottom-8 -left-8 -right-8 h-24 bg-[#1E3A8A]/5 rounded-[100%] blur-xl pointer-events-none"></div>
        <div className="absolute -bottom-1 -left-0 -right-0 h-1 bg-[#1E3A8A]/20 pointer-events-none"></div>
      </div>
    </div>
  );
};


