import React from "react";

interface ResultSheetProps {
  student: any;
  exam: any;
  marks: any[];
  madrasah: { 
    name: string; 
    logo_url?: string; 
    address?: string;
    institute_code?: string;
    phone?: string;
    email?: string;
  };
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
  };

  const totalObtained = marks.reduce((sum, m) => sum + Number(m.marks_obtained || 0), 0);
  const totalFull = marks.reduce((sum, m) => sum + Number(m.full_marks || 100), 0);
  
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
            <p className="mt-1 text-[7px] font-black uppercase text-slate-400 tracking-[0.1em] leading-none">REG: {student.admission_number || student.roll}</p>
          </div>
        </div>

        {/* Student Information */}
        <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-200 mb-4 grid grid-cols-3 gap-x-6 text-[15px] shadow-sm">
          {/* First Column: Personal Info */}
          <div className="space-y-2 border-r border-slate-200 pr-5">
            <div className="flex items-center"><span className="w-28 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.name}</span><span className="flex-1 font-black text-[#1E3A8A] tracking-tight">: {student.student_name}</span></div>
            <div className="flex items-center"><span className="w-28 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.fname}</span><span className="flex-1 font-black text-slate-800 tracking-tight">: {student.guardian_name || '-'}</span></div>
            <div className="flex items-center"><span className="w-28 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.mname}</span><span className="flex-1 font-black text-slate-800 tracking-tight">: {student.mother_name || '-'}</span></div>
          </div>
          {/* Middle Column: Academic Info */}
          <div className="space-y-2 border-r border-slate-200 pr-5">
            <div className="flex items-center"><span className="w-24 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.class}</span><span className="flex-1 font-black text-slate-800 tracking-tight">: {student.classes?.class_name || student.class_name || '-'}</span></div>
            <div className="flex items-center"><span className="w-24 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.roll}</span><span className="flex-1 font-black text-slate-800">: {student.roll}</span></div>
            <div className="flex items-center"><span className="w-24 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.reg}</span><span className="flex-1 font-black text-slate-800">: {student.registration_number || '-'}</span></div>
          </div>
          {/* Last Column: Other Info */}
          <div className="space-y-2 pl-2">
            <div className="flex items-center"><span className="w-24 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.session}</span><span className="flex-1 font-black text-slate-800">: {student.academic_year || new Date().getFullYear()}</span></div>
            <div className="flex items-center"><span className="w-24 text-slate-500 font-bold uppercase text-[11px] leading-none">{t.dob}</span><span className="flex-1 font-black text-slate-800">: {student.date_of_birth || '-'}</span></div>
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
                <th className="border border-slate-900/20 py-2 px-1 w-[70px]">{t.fullMarks}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[70px]">{t.passMarks}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[80px] bg-blue-900 shadow-inner">{t.obtainedMarks}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[55px]">{t.grade}</th>
                <th className="border border-slate-900/20 py-2 px-1 w-[55px]">{t.gp}</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {marks.map((m, i) => (
                <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-blue-50/10"}`}>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[11px] font-bold text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                  <td className="border border-slate-900 py-1 px-4 font-bold font-tiro text-slate-800 leading-tight">
                    {m.subject_name} {m.is_optional ? <span className="text-[9px] font-black text-blue-400 bg-blue-50 px-1 rounded-sm ml-1 uppercase leading-none">Optional</span> : ''}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-600">{m.full_marks || '100'}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[13px] text-slate-600">{m.pass_marks || '33'}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-black font-mono text-[#1E3A8A] bg-blue-50/20 text-[15px]">{(m.marks_obtained || 0).toString().padStart(2, '0')}</td>
                  <td className={`border border-slate-900 py-1 px-1 text-center font-black text-[15px] ${m.grade === 'F' ? 'text-red-500 bg-red-50/20' : 'text-[#1E3A8A]'}`}>{m.grade || '-'}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-bold font-mono text-slate-700 text-[13px]">{m.grade_point || '0.00'}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - marks.length) }).map((_, i) => (
                <tr key={`pad-${i}`}>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                   <td className="border border-slate-900 py-2.5">&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 text-[13px] font-black">
                <td colSpan={2} className="border border-slate-900 py-2 px-4 text-right uppercase tracking-widest text-[11px] text-slate-500">{t.totalMarks}:</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[15px]">{totalFull}</td>
                <td className="border border-slate-900 py-2 px-1 text-center">-</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-mono text-[#1E3A8A] text-[18px] bg-blue-100/50">{totalObtained}</td>
                <td className="border border-slate-900 py-2 px-1 text-center font-serif text-[20px] bg-blue-100/50 text-[#1E3A8A]" colSpan={2}>{finalGrade}</td>
              </tr>
            </tfoot>
          </table>

          {/* Summary & Remarks Row */}
          <div className="flex gap-4 h-[80px]">
            <div className="flex-1 grid grid-cols-4 gap-3">
              <div className="p-2 border-2 border-blue-900 rounded-2xl bg-blue-50/20 text-center flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-blue-900/40 mb-0.5 leading-none">{t.gpa}</p>
                <h4 className="text-[22px] font-black font-mono text-blue-900 leading-tight">{averageGpa}</h4>
              </div>
              <div className="p-2 border border-slate-200 rounded-2xl bg-white text-center flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5 leading-none">{t.status}</p>
                <h4 className={`text-[14px] font-black ${isPassed ? 'text-emerald-600' : 'text-red-500'} leading-tight uppercase`}>{isPassed ? t.passed : t.failed}</h4>
              </div>
              <div className="p-2 border border-slate-200 rounded-2xl bg-white text-center flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5 leading-none">{t.rank}</p>
                <h4 className="text-[16px] font-black font-mono text-slate-700 leading-tight">#{student.merit_position || 'N/A'}</h4>
              </div>
              <div className="p-2 border border-slate-200 rounded-2xl bg-white text-center flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5 leading-none">{t.attendance}</p>
                <h4 className="text-[16px] font-black font-mono text-slate-700 leading-tight">{student.attendance ? `${student.attendance}%` : 'N/A'}</h4>
              </div>
            </div>
            
            <div className="w-[180px] border border-slate-200 rounded-2xl bg-white flex flex-col overflow-hidden shadow-sm">
                <div className="px-3 py-1 bg-slate-50 border-b border-slate-100">
                    <span className="text-[9px] font-black uppercase text-slate-500 leading-none">{isBangla ? 'মন্তব্য' : 'Remarks'}</span>
                </div>
                <div className="flex-1 p-2 text-[10px] font-noto text-slate-600 leading-tight">
                    {student.remarks || (isPassed ? (isBangla ? 'অভিনন্দন! চমৎকার ফলাফল।' : 'Great result!') : (isBangla ? 'অধ্যবসায়ে মনোযোগী হও।' : 'Need more effort.'))}
                </div>
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

            <div className="text-center w-36">
              <div className="h-8 mb-1 flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-8 h-8 border border-slate-400 rounded-full flex items-center justify-center -rotate-12">
                        <span className="text-[5px] font-black uppercase">Seal</span>
                    </div>
                </div>
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


