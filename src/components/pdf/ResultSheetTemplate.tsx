import React from 'react';

interface ResultSheetProps {
  student: any;
  exam: any;
  marks: any[];
  madrasah: { name: string };
  lang: 'en' | 'bn';
}

export const ResultSheetTemplate: React.FC<ResultSheetProps> = ({ student, exam, marks, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'একাডেমিক ট্রান্সক্রিপ্ট' : 'Academic Transcript',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    roll: isBangla ? 'রোল নম্বর' : 'Roll No',
    class: isBangla ? 'শ্রেণি' : 'Class',
    exam: isBangla ? 'পরীক্ষার নাম' : 'Examination',
    subject: isBangla ? 'বিষয়' : 'Subject',
    marks: isBangla ? 'প্রাপ্ত নম্বর' : 'Marks Obtained',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    total: isBangla ? 'মোট' : 'Total',
    date: isBangla ? 'তারিখ' : 'Date',
    signature: isBangla ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal\'s Signature',
    guardian: isBangla ? 'অভিভাবকের স্বাক্ষর' : 'Guardian\'s Signature',
  };

  const totalMarks = marks.reduce((sum, m) => sum + Number(m.marks_obtained || 0), 0);

  return (
    <div className="w-[794px] min-h-[1123px] p-12 bg-white font-noto text-slate-900 relative overflow-hidden">
      {/* Decorative Border */}
      <div className="absolute inset-4 border-[1px] border-slate-200 pointer-events-none"></div>
      <div className="absolute inset-6 border-[3px] border-double border-slate-100 pointer-events-none"></div>

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] -rotate-45 select-none">
        <h1 className="text-8xl font-black uppercase tracking-[0.5em]">{madrasah.name}</h1>
      </div>

      {/* Header Section */}
      <div className="text-center mb-12 relative">
        <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center border border-blue-100 shadow-sm">
                <span className="text-4xl font-black text-blue-600">{madrasah.name.charAt(0)}</span>
            </div>
        </div>
        <h1 className="text-4xl font-black text-[#1E3A8A] mb-3 uppercase tracking-tight leading-tight">{madrasah.name}</h1>
        <div className="inline-flex items-center gap-4 mb-6">
            <div className="h-[1px] w-12 bg-slate-200"></div>
            <div className="px-6 py-2 bg-[#1E3A8A] rounded-full text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-blue-100">
                {t.title}
            </div>
            <div className="h-[1px] w-12 bg-slate-200"></div>
        </div>
        <div className="flex justify-center gap-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              <span>{t.exam}: {exam.exam_name}</span>
          </div>
          <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
        </div>
      </div>
      
      {/* Student Info Grid */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-12 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16"></div>
        
        <div className="flex flex-col gap-1.5 relative z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t.name}</span>
          <span className="text-xl font-black text-slate-800 border-b-2 border-slate-200/50 pb-1">{student.student_name}</span>
        </div>
        <div className="flex flex-col gap-1.5 relative z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t.roll}</span>
          <span className="text-xl font-black text-slate-800 border-b-2 border-slate-200/50 pb-1">{student.roll}</span>
        </div>
        <div className="flex flex-col gap-1.5 relative z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t.class}</span>
          <span className="text-xl font-black text-slate-800 border-b-2 border-slate-200/50 pb-1">{student.classes?.class_name || ''}</span>
        </div>
        <div className="flex flex-col gap-1.5 relative z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t.total}</span>
          <span className="text-xl font-black text-[#2563EB] border-b-2 border-blue-100 pb-1">{totalMarks}</span>
        </div>
      </div>

      {/* Marks Table */}
      <div className="mb-12 overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#1E3A8A] text-white">
              <th className="p-5 text-left text-[11px] font-black uppercase tracking-[0.2em]">{t.subject}</th>
              <th className="p-5 text-center text-[11px] font-black uppercase tracking-[0.2em] w-32">{t.marks}</th>
              <th className="p-5 text-center text-[11px] font-black uppercase tracking-[0.2em] w-32">{t.grade}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {marks.map((m, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="p-5 font-black text-slate-700 text-sm uppercase tracking-tight">{m.subject_name}</td>
                <td className="p-5 text-center font-mono font-black text-slate-600 text-lg">{m.marks_obtained}</td>
                <td className="p-5 text-center">
                  <span className="inline-flex items-center justify-center w-12 h-10 bg-white border-2 border-slate-100 rounded-xl font-black text-sm text-[#2563EB] shadow-sm">
                    {m.grade || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/80 font-black">
              <td className="p-6 text-right uppercase tracking-[0.2em] text-[10px] text-slate-400">{t.total}</td>
              <td className="p-6 text-center font-mono text-2xl text-[#2563EB]">{totalMarks}</td>
              <td className="p-6"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatures Section */}
      <div className="grid grid-cols-2 gap-24 mt-auto pt-20 relative z-10">
        <div className="text-center">
          <div className="w-full h-12 mb-2 flex items-end justify-center">
              <div className="w-32 h-[1px] bg-slate-200"></div>
          </div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            {t.guardian}
          </div>
        </div>
        <div className="text-center">
          <div className="w-full h-12 mb-2 flex items-end justify-center">
              <div className="w-32 h-[1px] bg-slate-200"></div>
          </div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
            {t.signature}
          </div>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
          Generated by Deenora Management System
        </div>
      </div>
    </div>
  );
};
