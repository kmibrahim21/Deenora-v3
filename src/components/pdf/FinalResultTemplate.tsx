import React from 'react';

interface FinalResultProps {
  title: string;
  className: string;
  subjects: string[];
  students: any[];
  madrasah: any;
  lang: 'en' | 'bn';
  includeBreakdown?: boolean;
}

export const FinalResultTemplate: React.FC<FinalResultProps> = ({ title, className, subjects, students, madrasah, lang, includeBreakdown = false }) => {
  const isBangla = lang === 'bn';
  const toBnNum = (n: number | string) => isBangla ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : String(n);
  const config = madrasah?.config_json || {};
  const t = {
    class: isBangla ? 'শ্রেণি' : 'Class',
    rank: 'Merit Position',
    roll: isBangla ? 'রোল' : 'Roll',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    total: isBangla ? 'মোট' : 'Total',
    grade: isBangla ? 'গ্রেড' : 'GRADE',
    gpa: 'GPA',
    date: isBangla ? 'তারিখ' : 'Date',
    examController: isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Exam Controller',
    principal: isBangla ? 'প্রতিষ্ঠান প্রধান' : 'Principal',
    page: isBangla ? 'পৃষ্ঠা' : 'Page'
  };

  const ROWS_PER_PAGE = includeBreakdown ? 7 : 10;
  const totalPages = Math.ceil(students.length / ROWS_PER_PAGE) || 1;

  return (
    <>
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
        .font-solaiman, .font-solaiman * {
          font-family: 'SolaimanLipi', 'Noto Sans Bengali', sans-serif !important;
        }
      `}</style>
      {Array.from({ length: totalPages }).map((_, pageIndex) => {
        const pageData = students.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
        
        return (
          <div key={pageIndex} className="page-container relative font-solaiman" style={{ width: '1123px', height: '794px', padding: '30px 35px 70px 35px', backgroundColor: '#fff', color: '#000', fontFamily: isBangla ? "'SolaimanLipi', 'Noto Sans Bengali', sans-serif" : 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box', overflow: 'hidden', border: '8px solid #f1f5f9' }}>
            {/* Header */}
            <div className="text-center mb-4 border-b-2 border-slate-900 pb-3">
              <h1 className="text-3xl font-black text-slate-900 mb-1 uppercase tracking-tight leading-normal">{madrasah.name}</h1>
              <div className="text-lg font-bold text-[#2563EB] mb-1">{title} {includeBreakdown ? (isBangla ? '(টার্মভিত্তিক বিস্তৃত)' : '(Term Breakdown)') : ''}</div>
              <div className="flex justify-center gap-6 text-xs font-bold uppercase tracking-widest text-slate-900">
                <span>{t.class}: {className}</span>
                <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-hidden rounded-sm border border-slate-200 shadow-sm relative z-10 bg-white min-h-[380px]">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 w-12">{t.roll}</th>
                    <th className="px-2 py-2 text-left font-black uppercase tracking-widest border-r border-slate-700 w-32">{t.name}</th>
                    {subjects.map(s => (
                      <th key={s} className="px-1 py-1 text-center border-r border-slate-700">
                        <div className="mx-auto font-black uppercase tracking-widest text-[8px] max-w-[85px] leading-tight break-words whitespace-normal text-center">
                          {s}
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800 w-10">{t.total}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800 w-10">{t.grade}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800 w-10">{t.gpa}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-amber-900 w-10">{isBangla ? 'উপস্থিতি' : 'Att.'}</th>
                    <th className="px-2 py-2 text-center font-black uppercase tracking-widest bg-slate-800 w-10">{t.rank}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pageData.map((std, idx) => (
                    <tr key={std.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200 text-[13px]">{std.roll || '-'}</td>
                      <td className="px-2 py-1.5 font-bold text-slate-900 border-r border-slate-200 max-w-[120px] text-[12px] leading-snug">{std.student_name}</td>
                      {subjects.map(sub => (
                        <td key={sub} className="px-1 py-1 text-center font-mono text-slate-900 border-r border-slate-200 align-middle">
                          {includeBreakdown && std.termBreakdown?.[sub] ? (
                            <div className="text-[9px] space-y-0.5 py-0.5">
                              {std.termBreakdown[sub].map((tb: any, i: number) => (
                                <div key={i} className="flex justify-between text-[8px] text-slate-600 gap-1 font-mono">
                                  <span className="truncate max-w-[50px]" title={tb.examName}>{tb.examName.slice(0, 6)} ({tb.weight}%):</span>
                                  <span className="font-bold">{tb.weightedMark}</span>
                                </div>
                              ))}
                              <div className="border-t border-slate-300 pt-0.5 font-bold text-blue-900 flex justify-between text-[10px] font-mono">
                                <span>{t.total}:</span>
                                <span>{std.marks[sub] || '-'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[13px] font-bold">{std.marks[sub] || '-'}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-blue-900 border-r border-slate-200 bg-blue-50/30 text-[13px]">{std.total}</td>
                      <td className={`px-2 py-1.5 text-center font-black border-r border-slate-200 bg-slate-50/30 text-[13px] ${std.grade === 'F' ? 'text-red-800' : 'text-emerald-800'}`}>
                        {std.grade}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50/30 text-[13px]">{std.gpa}</td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-900 border-r border-slate-200 bg-amber-50/30 text-[12px]">{std.attendance ? (isBangla ? toBnNum(std.attendance) : std.attendance) : '-'}</td>
                      <td className="px-2 py-1.5 text-center font-black text-[#2563EB] bg-blue-50/20 text-[13px]">#{std.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 left-9 right-9 flex justify-between items-end px-2 z-10">
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
