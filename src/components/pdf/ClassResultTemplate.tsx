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

  const isHighSchool = config?.result_system === 'high_school';

  const t = {
    title: isBangla ? 'শ্রেণি ভিত্তিক ফলাফল বিবরণী' : 'Class Result Summary',
    rank: isBangla ? 'মেধা স্থান' : 'Merit Position',
    roll: isBangla ? 'রোল' : 'Roll',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    total: isBangla ? 'মোট' : 'Total',
    avg: isBangla ? 'গড়' : 'Avg',
    gpa: 'GPA',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    exam: isBangla ? 'পরীক্ষা' : 'Exam',
    date: isBangla ? 'তারিখ' : 'Date',
    examController: isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Exam Controller',
    principal: isBangla ? 'প্রতিষ্ঠান প্রধান' : 'Principal',
    signature: isBangla ? 'স্বাক্ষর' : 'Signature'
  };

  const toBnNum = (n: number | string) => isBangla ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : String(n);

  const ROWS_PER_PAGE = 18;
  const totalPages = Math.ceil(students.length / ROWS_PER_PAGE) || 1;

  return (
    <>
      {Array.from({ length: totalPages }).map((_, pageIndex) => {
        const pageData = students.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
        
        return (
          <div key={pageIndex} className="page-container" style={{ width: '1123px', height: '794px', padding: '24px 36px', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] -rotate-12 select-none px-20">
              <h1 className="text-[8rem] font-black uppercase tracking-[0.2em] text-center leading-tight">{madrasah.name}</h1>
            </div>

            <div className="flex flex-col justify-between h-full relative z-10">
              <div>
                {/* Header */}
                <div className="text-center mb-3 px-12">
                  <h1 className="text-[28px] font-black text-slate-900 mb-1 uppercase tracking-tight leading-tight">{madrasah.name}</h1>
                  <div className="inline-flex items-center gap-3 mb-1.5">
                      <div className="h-[1.5px] w-14 bg-slate-300"></div>
                      <div className="px-8 py-1 bg-blue-700 rounded-full text-[13.5px] font-black uppercase tracking-[0.25em] text-white shadow-sm">
                          {t.title}
                      </div>
                      <div className="h-[1.5px] w-14 bg-slate-300"></div>
                  </div>
                  <div className="flex justify-center gap-12 text-[12px] font-black uppercase tracking-[0.2em] text-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                        <span>{t.exam}: {exam.exam_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
                        <span>{isBangla ? 'শ্রেণি' : 'Class'}: {exam.classes?.class_name || exam.class_id || ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                        <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
                    </div>
                  </div>
                </div>
                
                {/* Table */}
                <div className="overflow-hidden rounded-sm border border-slate-300 shadow-sm bg-white">
                  <table className="w-full border-collapse text-[12.5px] table-fixed">
                    <thead>
                      <tr className="bg-[#1E3A8A] text-white">
                        <th className="px-1 py-2 text-left font-black uppercase tracking-widest border-r border-white/10 w-12 text-[12.5px]">{t.roll}</th>
                        <th className="px-2 py-2 text-left font-black uppercase tracking-widest border-r border-white/10 w-40 text-[12.5px]">{t.name}</th>
                        {subjects.filter(s => {
                          return !isHighSchool || !s.pair_with_id;
                        }).map(s => {
                          return (
                            <th key={s.id} className="px-0.5 py-1.5 text-center border-r border-white/10">
                              <div className="mx-auto font-black uppercase tracking-widest text-[10.5px] max-w-[85px] leading-tight break-words whitespace-normal text-center">
                                {s.subject_name}
                                {isHighSchool && (
                                  <div className="flex justify-center gap-0.5 mt-0.5 opacity-70 text-[6.5px]">
                                    <span>C</span>
                                    <span>M</span>
                                    <span>P</span>
                                  </div>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-13 text-[12.5px]">{t.total}</th>
                        <th className="px-0.5 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-14 text-[12.5px]">{t.avg}</th>
                        <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-12 text-[12.5px]">{t.grade}</th>
                        <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-13 text-[12.5px]">{t.gpa}</th>
                        <th className="px-1 py-2 text-center font-black uppercase tracking-widest bg-blue-900 w-13 text-[12.5px]">{t.rank}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pageData.map((student, idx) => {
                        const studentMarks = marksData[student.id] || {};
                        const hasAnyMark = subjects.some(s => {
                          const rawVal = typeof studentMarks[s.id] === 'object' ? studentMarks[s.id]?.obtained : studentMarks[s.id];
                          return rawVal !== undefined && rawVal !== '' && rawVal !== null;
                        }) || (student._total !== undefined && student._total !== null && student._total !== '' && Number(student._total) > 0) || student._hasAnyMark === true;

                        const total = hasAnyMark ? (student._total !== undefined && student._total !== '' ? student._total : 0) : '';
                        const avg = hasAnyMark ? `${student._avg || '0.0'}%` : '';
                        const gpa = hasAnyMark ? (student._gpa || '0.0') : '';
                        const grade = hasAnyMark ? (student._grade || 'F') : '';
                        const rank = hasAnyMark ? (student._rank && student._rank !== '-' ? student._rank : '') : '';

                        return (
                          <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className="px-1 py-[5px] font-black text-slate-900 border-r border-slate-200 text-[13.5px]">{toBnNum(student.roll)}</td>
                            <td className="px-2 py-[5px] font-black text-slate-900 border-r border-slate-200 uppercase tracking-tight break-words max-w-[210px] text-[13px] leading-tight">{student.student_name}</td>
                            {subjects.filter(sub => {
                              return !isHighSchool || !sub.pair_with_id;
                            }).map(s => {
                              const rawVal = typeof studentMarks[s.id] === 'object' ? studentMarks[s.id]?.obtained : studentMarks[s.id];
                              const hasMark = rawVal !== undefined && rawVal !== '' && rawVal !== null;
                              let totalVal: number | string = hasMark ? Number(rawVal) : '';
                              let cqVal = studentMarks[`${s.id}_cq`];
                              let mcqVal = studentMarks[`${s.id}_mcq`];
                              let prVal = studentMarks[`${s.id}_practical`];

                              if (isHighSchool) {
                                const children = subjects.filter(child => child.pair_with_id === s.id);
                                children.forEach(child => {
                                    const cVal = typeof studentMarks[child.id] === 'object' ? studentMarks[child.id]?.obtained : studentMarks[child.id];
                                    if (cVal !== undefined && cVal !== '' && cVal !== null) {
                                      totalVal = (typeof totalVal === 'number' ? totalVal : 0) + Number(cVal);
                                    }
                                });
                              }

                              return (
                                <td key={s.id} className="px-0.5 py-[5px] text-center font-bold text-slate-900 border-r border-slate-200 text-[13.5px]">
                                  {isHighSchool ? (
                                    <div className="flex flex-col leading-none">
                                      <span>{toBnNum(totalVal)}</span>
                                      <div className="flex justify-center gap-0.5 text-[6px] opacity-60 font-normal">
                                        <span>{cqVal !== undefined && cqVal !== '' ? toBnNum(cqVal) : ''}</span>
                                        <span>{mcqVal !== undefined && mcqVal !== '' ? toBnNum(mcqVal) : ''}</span>
                                        <span>{prVal !== undefined && prVal !== '' ? toBnNum(prVal) : ''}</span>
                                      </div>
                                    </div>
                                  ) : toBnNum(totalVal)}
                                </td>
                              );
                            })}
                            <td className="px-1 py-[5px] text-center font-black text-blue-900 border-r border-slate-200 bg-blue-50/40 text-[13.5px]">{toBnNum(total)}</td>
                            <td className="px-0.5 py-[5px] text-center font-black text-slate-900 border-r border-slate-200 bg-slate-50/40 text-[13px]">{toBnNum(avg)}</td>
                            <td className={`px-1 py-[5px] text-center font-black border-r border-slate-200 bg-slate-50/40 text-[13px] ${grade === 'F' ? 'text-red-800' : 'text-emerald-800'}`}>
                              {grade ? (
                                <span className="inline-flex items-center justify-center w-6 h-4.5 rounded bg-white border border-slate-200 shadow-xs text-[12px]">
                                  {grade}
                                </span>
                              ) : ''}
                            </td>
                            <td className="px-1 py-[5px] text-center font-black text-slate-900 border-r border-slate-200 bg-slate-50/40 text-[13.5px]">{toBnNum(gpa)}</td>
                            <td className="px-1 py-[5px] text-center font-black text-[#2563EB] bg-blue-50/30 text-[13.5px]">{toBnNum(rank)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end px-4 pt-2 pb-1 z-10">
                <div className="flex flex-col items-center gap-1">
                    <div className="text-[11.5px] font-black text-slate-400">
                       {isBangla ? 'পৃষ্ঠা' : 'Page'} {toBnNum(pageIndex + 1)} / {toBnNum(totalPages)}
                    </div>
                </div>

                <div className="flex gap-20 items-end">
                  <div className="text-center flex flex-col items-center">
                    <div className="w-48 border-t-2 border-slate-400 pt-1.5">
                      <div className="text-[11.5px] font-black uppercase tracking-widest text-slate-700">{t.examController}</div>
                    </div>
                  </div>
                  <div className="text-center flex flex-col items-center">
                    <div className="flex items-center justify-center relative mb-1 w-48" style={{ height: `${config.signature_height || 30}px` }}>
                        {config.signature_url && (
                            <img src={config.signature_url} style={{ height: `${config.signature_height || 30}px` }} className="object-contain mix-blend-multiply absolute bottom-0" alt="Sig" crossOrigin="anonymous" />
                        )}
                    </div>
                    <div className="w-48 border-t-2 border-slate-400 pt-1.5">
                      <div className="text-[11.5px] font-black uppercase tracking-widest text-slate-700">{t.principal}</div>
                    </div>
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
