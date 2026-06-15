import React from 'react';

interface FinalResultProps {
  title: string;
  className: string;
  subjects: string[];
  students: any[];
  madrasah: any;
  lang: 'en' | 'bn';
}

export const FinalResultTemplate: React.FC<FinalResultProps> = ({ title, className, subjects, students, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const config = madrasah?.config_json || {};
  const t = {
    class: isBangla ? 'শ্রেণি' : 'Class',
    rank: isBangla ? 'মেধা' : 'Rank',
    roll: isBangla ? 'রোল' : 'Roll',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    total: isBangla ? 'মোট' : 'Total',
    gpa: isBangla ? 'জিপিএ' : 'GPA',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    date: isBangla ? 'তারিখ' : 'Date',
    examController: isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Exam Controller',
    principal: isBangla ? 'অধ্যক্ষ' : 'Principal',
    page: isBangla ? 'পৃষ্ঠা' : 'Page'
  };

  const ROWS_PER_PAGE = 20;
  const totalPages = Math.ceil(students.length / ROWS_PER_PAGE) || 1;

  return (
    <>
      {Array.from({ length: totalPages }).map((_, pageIndex) => {
        const pageData = students.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
        
        return (
          <div key={pageIndex} className="page-container" style={{ width: '1123px', height: '794px', padding: '40px', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box', overflow: 'hidden', border: '8px solid #f1f5f9' }}>
            {/* Header */}
            <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
              <h1 className="text-4xl font-black text-slate-900 mb-1 uppercase tracking-tight">{madrasah.name}</h1>
              <div className="text-xl font-bold text-[#2563EB] mb-2">{title}</div>
              <div className="flex justify-center gap-6 text-xs font-bold uppercase tracking-widest text-slate-400">
                <span>{t.class}: {className}</span>
                <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-hidden rounded-sm border border-slate-200 shadow-sm relative z-10 bg-white min-h-[450px]">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 w-12">{t.roll}</th>
                    <th className="px-2 py-2 text-left font-black uppercase tracking-widest border-r border-slate-700 w-32">{t.name}</th>
                    {subjects.map(s => (
                      <th key={s} className="px-1 py-1 text-center border-r border-slate-700">
                        <div className="mx-auto font-black uppercase tracking-widest text-[8px] max-w-[75px] leading-tight break-words whitespace-normal text-center">
                          {s}
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800 w-10">{t.total}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800 w-10">{t.gpa}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800 w-10">{t.grade}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest bg-slate-800 w-10">{t.rank}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageData.map((std, idx) => (
                    <tr key={std.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-500 border-r border-slate-100 text-[14px]">{std.roll || '-'}</td>
                      <td className="px-2 py-1.5 font-bold text-slate-700 border-r border-slate-100 truncate max-w-[120px] text-[13px]">{std.student_name}</td>
                      {subjects.map(sub => (
                        <td key={sub} className="px-1 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100 text-[14px]">
                          {std.marks[sub] || '-'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-[#2563EB] border-r border-slate-100 bg-blue-50/30 text-[14px]">{std.total}</td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-700 border-r border-slate-100 bg-slate-50/30 text-[14px]">{std.gpa}</td>
                      <td className={`px-2 py-1.5 text-center font-black border-r border-slate-100 bg-slate-50/30 text-[14px] ${std.grade === 'F' ? 'text-red-600' : 'text-green-600'}`}>
                        {std.grade}
                      </td>
                      <td className="px-2 py-1.5 text-center font-black text-[#2563EB] bg-blue-50/20 text-[14px]">#{std.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 left-10 right-10 flex justify-between items-end px-4 z-10">
              <div className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">
                Deenora Management System
              </div>
              
              <div className="text-[10px] font-black text-slate-400">
                {t.page} {pageIndex + 1} / {totalPages}
              </div>

              <div className="flex gap-12 items-end">
                <div className="text-center flex flex-col items-center">
                  <div className="w-32 border-t border-slate-400 pt-1">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{t.examController}</div>
                  </div>
                </div>
                <div className="text-center flex flex-col items-center">
                  <div className="flex items-center justify-center relative mb-1 w-32" style={{ height: `${config.signature_height || 30}px` }}>
                      {config.signature_url && (
                          <img src={config.signature_url} style={{ height: `${config.signature_height || 30}px` }} className="object-contain mix-blend-multiply absolute bottom-0" alt="Sig" crossOrigin="anonymous" />
                      )}
                  </div>
                  <div className="w-32 border-t border-slate-400 pt-1">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{t.principal}</div>
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
