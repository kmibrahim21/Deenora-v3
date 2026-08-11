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
    principal: isBangla ? 'অধ্যক্ষ' : 'Principal',
    signature: isBangla ? 'স্বাক্ষর' : 'Signature'
  };

  const toBnNum = (n: number | string) => isBangla ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : String(n);

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
              <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight leading-normal">{madrasah.name}</h1>
              <div className="inline-flex items-center gap-4 mb-2">
                  <div className="h-[1px] w-12 bg-slate-200"></div>
                  <div className="px-8 py-2 bg-blue-600 rounded-full text-sm font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-blue-100">
                      {t.title}
                  </div>
                  <div className="h-[1px] w-12 bg-slate-200"></div>
              </div>
              <div className="flex justify-center gap-12 text-[10px] font-black uppercase tracking-[0.4em] text-slate-900">
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
              <table className="w-full border-collapse text-[9px] table-fixed">
                <thead>
                  <tr className="bg-[#1E3A8A] text-white">
                    <th className="px-1 py-2 text-left font-black uppercase tracking-widest border-r border-white/10 w-10">{t.roll}</th>
                    <th className="px-2 py-2 text-left font-black uppercase tracking-widest border-r border-white/10 w-32">{t.name}</th>
                    {subjects.filter(s => {
                      return !isHighSchool || !s.pair_with_id;
                    }).map(s => {
                      return (
                        <th key={s.id} className="px-0.5 py-1 text-center border-r border-white/10">
                          <div className="mx-auto font-black uppercase tracking-widest text-[7px] max-w-[70px] leading-tight break-words whitespace-normal text-center">
                            {s.subject_name}
                            {isHighSchool && (
                              <div className="flex justify-center gap-0.5 mt-0.5 opacity-60 text-[5px]">
                                <span>C</span>
                                <span>M</span>
                                <span>P</span>
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-11">{t.total}</th>
                    <th className="px-0.5 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-12">{t.avg}</th>
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-10">{t.grade}</th>
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900 w-11">{t.gpa}</th>
                    <th className="px-1 py-2 text-center font-black uppercase tracking-widest bg-blue-900 w-11">{t.rank}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                      <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                        <td className="px-1 py-2 font-black text-slate-900 border-r border-slate-100 text-[11px]">{toBnNum(student.roll)}</td>
                        <td className="px-2 py-2 font-black text-slate-900 border-r border-slate-100 uppercase tracking-tight break-words max-w-[200px] text-[10px] leading-normal">{student.student_name}</td>
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
                            <td key={s.id} className="px-0.5 py-2 text-center font-bold text-slate-900 border-r border-slate-100 text-[10px]">
                              {isHighSchool ? (
                                <div className="flex flex-col leading-normal">
                                  <span>{toBnNum(totalVal)}</span>
                                  <div className="flex justify-center gap-0.5 text-[5px] opacity-40 font-normal">
                                    <span>{cqVal !== undefined && cqVal !== '' ? toBnNum(cqVal) : ''}</span>
                                    <span>{mcqVal !== undefined && mcqVal !== '' ? toBnNum(mcqVal) : ''}</span>
                                    <span>{prVal !== undefined && prVal !== '' ? toBnNum(prVal) : ''}</span>
                                  </div>
                                </div>
                              ) : toBnNum(totalVal)}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 text-center font-black text-blue-900 border-r border-slate-100 bg-blue-50/30 text-[11px]">{toBnNum(total)}</td>
                        <td className="px-0.5 py-1 text-center font-black text-slate-900 border-r border-slate-100 bg-slate-50/30 text-[11px]">{toBnNum(avg)}</td>
                        <td className={`px-1 py-1 text-center font-black border-r border-white/10 bg-slate-50/30 text-[11px] ${grade === 'F' ? 'text-red-800' : 'text-emerald-800'}`}>
                          {grade ? (
                            <span className="inline-flex items-center justify-center w-7 h-5 rounded bg-white border border-slate-100 shadow-sm">
                              {grade}
                            </span>
                          ) : ''}
                        </td>
                        <td className="px-1 py-1 text-center font-black text-slate-900 border-r border-slate-100 bg-slate-50/30 text-[11px]">{toBnNum(gpa)}</td>
                        <td className="px-1 py-1 text-center font-black text-[#2563EB] bg-blue-50/20 text-[11px]">{toBnNum(rank)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 left-10 right-10 flex justify-between items-end px-8 z-10">
              <div className="flex flex-col items-center gap-2">
                  <div className="text-[10px] font-black text-slate-400">
                     {isBangla ? 'পৃষ্ঠা' : 'Page'} {toBnNum(pageIndex + 1)} / {toBnNum(totalPages)}
                  </div>
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
