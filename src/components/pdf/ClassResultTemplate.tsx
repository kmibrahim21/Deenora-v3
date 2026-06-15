import React from 'react';

interface ClassResultProps {
  exam: any;
  subjects: any[];
  students: any[];
  marksData: any;
  madrasah: any;
  lang: 'en' | 'bn';
}

export const ClassResultTemplate: React.FC<ClassResultProps> = ({ exam, subjects, students, marksData, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const config = madrasah?.config_json || {};
  const t = {
    title: isBangla ? 'শ্রেণি ভিত্তিক ফলাফল বিবরণী' : 'Class Result Summary',
    rank: isBangla ? 'মেধাস্থান' : 'Rank',
    roll: isBangla ? 'রোল' : 'Roll',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    total: isBangla ? 'মোট' : 'Total',
    avg: isBangla ? 'গড়' : 'Avg',
    gpa: isBangla ? 'জিপিএ' : 'GPA',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    exam: isBangla ? 'পরীক্ষা' : 'Exam',
    date: isBangla ? 'তারিখ' : 'Date',
    examController: isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Exam Controller',
    principal: isBangla ? 'অধ্যক্ষ' : 'Principal',
    signature: isBangla ? 'স্বাক্ষর' : 'Signature'
  };

  const ROWS_PER_PAGE = 20;
  const totalPages = Math.ceil(students.length / ROWS_PER_PAGE) || 1;

  return (
    <>
      {Array.from({ length: totalPages }).map((_, pageIndex) => {
        const pageData = students.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
        
        return (
          <div key={pageIndex} className="page-container" style={{ width: '1123px', height: '794px', padding: '40px', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] -rotate-12 select-none px-20">
              <h1 className="text-[8rem] font-black uppercase tracking-[0.2em] text-center leading-tight">{madrasah.name}</h1>
            </div>

            {/* Header */}
            <div className="text-center mb-6 relative z-10 px-20">
              <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight leading-tight">{madrasah.name}</h1>
              <div className="inline-flex items-center gap-4 mb-2">
                  <div className="h-[1px] w-12 bg-slate-200"></div>
                  <div className="px-8 py-2 bg-blue-600 rounded-full text-sm font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-blue-100">
                      {t.title}
                  </div>
                  <div className="h-[1px] w-12 bg-slate-200"></div>
              </div>
              <div className="flex justify-center gap-12 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span>{t.exam}: {exam.exam_name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                    <span>{isBangla ? 'শ্রেণি' : 'Class'}: {exam.classes?.class_name || exam.class_id || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
                </div>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-hidden rounded-sm border border-slate-200 shadow-sm relative z-10 bg-white min-h-[450px]">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-[#1E3A8A] text-white">
                    <th className="px-2 py-2 text-left font-black uppercase tracking-widest border-r border-white/10 w-12">{t.roll}</th>
                    <th className="px-2 py-2 text-left font-black uppercase tracking-widest border-r border-white/10 w-32">{t.name}</th>
                    {subjects.map(s => (
                      <th key={s.id} className="px-1 py-1 text-center border-r border-white/10">
                        <div className="mx-auto font-black uppercase tracking-widest text-[8px] max-w-[75px] leading-tight break-words whitespace-normal text-center">
                          {s.subject_name}
                        </div>
                      </th>
                    ))}
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-10">{t.total}</th>
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-10">{t.avg}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-12">{t.gpa}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-12">{t.grade}</th>
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest bg-blue-900 w-10">{t.rank}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageData.map((student, idx) => {
                    const studentMarks = marksData[student.id] || {};
                    const total = student._total || 0;
                    const avg = student._avg || '0.00';
                    const gpa = student._gpa || '0.00';
                    const grade = student._grade || 'F';
                    const rank = student._rank || '-';

                    return (
                      <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                        <td className="px-2 py-1 font-mono font-black text-slate-400 border-r border-slate-100 text-[14px]">{student.roll}</td>
                        <td className="px-2 py-1 font-black text-slate-700 border-r border-slate-100 uppercase tracking-tight break-words max-w-[200px] text-[13px] leading-tight">{student.student_name}</td>
                        {subjects.map(s => (
                          <td key={s.id} className="px-1 py-1 text-center font-mono font-bold text-slate-600 border-r border-slate-100 text-[14px]">
                            {studentMarks[s.id] || '0'}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center font-mono font-black text-[#2563EB] border-r border-slate-100 bg-blue-50/30 text-[14px]">{total}</td>
                        <td className="px-1 py-1 text-center font-mono font-black text-slate-700 border-r border-slate-100 bg-slate-50/30 text-[14px]">{avg}%</td>
                        <td className="px-2 py-1 text-center font-mono font-black text-slate-700 border-r border-slate-100 bg-slate-50/30 text-[14px]">{gpa}</td>
                        <td className={`px-2 py-1 text-center font-black border-r border-white/10 bg-slate-50/30 text-[14px] ${grade === 'F' ? 'text-red-500' : 'text-emerald-600'}`}>
                          <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-white border border-slate-100 shadow-sm">
                              {grade}
                          </span>
                        </td>
                        <td className="px-1 py-1 text-center font-mono font-black text-[#2563EB] bg-blue-50/20 text-[14px]">{rank}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 left-10 right-10 flex justify-between items-end px-8 z-10">
              <div className="flex flex-col items-center gap-2">
                  <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
                      Deenora Management System
                  </div>
              </div>

              <div className="text-[10px] font-black text-slate-400">
                 {isBangla ? 'পৃষ্ঠা' : 'Page'} {pageIndex + 1} / {totalPages}
              </div>

              <div className="flex gap-20 items-end">
                <div className="text-center flex flex-col items-center">
                  <div className="w-44 border-t border-slate-400 pt-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.examController}</div>
                  </div>
                </div>
                <div className="text-center flex flex-col items-center">
                  <div className="flex items-center justify-center relative mb-1 w-44" style={{ height: `${config.signature_height || 30}px` }}>
                      {config.signature_url && (
                          <img src={config.signature_url} style={{ height: `${config.signature_height || 30}px` }} className="object-contain mix-blend-multiply absolute bottom-0" alt="Sig" crossOrigin="anonymous" />
                      )}
                  </div>
                  <div className="w-44 border-t border-slate-400 pt-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.principal}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
