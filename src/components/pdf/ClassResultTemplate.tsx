import React from 'react';

interface ClassResultProps {
  exam: any;
  subjects: any[];
  students: any[];
  marksData: any;
  madrasah: { name: string };
  lang: 'en' | 'bn';
}

export const ClassResultTemplate: React.FC<ClassResultProps> = ({ exam, subjects, students, marksData, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'শ্রেণি ভিত্তিক ফলাফল বিবরণী' : 'Class Result Summary',
    roll: isBangla ? 'রোল' : 'Roll',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    total: isBangla ? 'মোট' : 'Total',
    gpa: isBangla ? 'জিপিএ' : 'GPA',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    exam: isBangla ? 'পরীক্ষা' : 'Exam',
    date: isBangla ? 'তারিখ' : 'Date'
  };

  return (
    <div className="w-[1123px] min-h-[794px] p-12 bg-white font-noto text-slate-800 relative overflow-hidden">
      {/* Decorative Border */}
      <div className="absolute inset-4 border border-slate-200 pointer-events-none"></div>
      <div className="absolute inset-6 border-2 border-slate-100 pointer-events-none"></div>

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] -rotate-12 select-none">
        <h1 className="text-[12rem] font-black uppercase tracking-[0.2em]">{madrasah.name}</h1>
      </div>

      {/* Header */}
      <div className="text-center mb-10 relative z-10">
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight leading-tight">{madrasah.name}</h1>
        <div className="inline-flex items-center gap-4 mb-4">
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
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm relative z-10 bg-white">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#1E3A8A] text-white">
              <th className="p-4 text-left font-black uppercase tracking-widest border-r border-white/10 w-16">{t.roll}</th>
              <th className="p-4 text-left font-black uppercase tracking-widest border-r border-white/10 min-w-[200px]">{t.name}</th>
              {subjects.map(s => (
                <th key={s.id} className="p-4 text-center font-black uppercase tracking-widest border-r border-white/10">
                  {s.subject_name}
                </th>
              ))}
              <th className="p-4 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900">{t.total}</th>
              <th className="p-4 text-center font-black uppercase tracking-widest border-r border-white/10 bg-blue-900">{t.gpa}</th>
              <th className="p-4 text-center font-black uppercase tracking-widest bg-blue-900">{t.grade}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((student, idx) => {
              const studentMarks = marksData[student.id] || {};
              let total = 0;
              let count = 0;
              subjects.forEach(s => {
                const m = studentMarks[s.id];
                if (m !== undefined && m !== '') {
                  total += Number(m);
                  count++;
                }
              });
              
              const avg = count > 0 ? total / count : 0;
              const getGradeInfo = (score: number) => {
                if (score >= 80) return { gpa: '5.00', grade: 'A+' };
                if (score >= 70) return { gpa: '4.00', grade: 'A' };
                if (score >= 60) return { gpa: '3.50', grade: 'A-' };
                if (score >= 50) return { gpa: '3.00', grade: 'B' };
                if (score >= 40) return { gpa: '2.00', grade: 'C' };
                if (score >= 33) return { gpa: '1.00', grade: 'D' };
                return { gpa: '0.00', grade: 'F' };
              };
              const { gpa, grade } = getGradeInfo(avg);

              return (
                <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className="p-4 font-mono font-black text-slate-400 border-r border-slate-100">{student.roll}</td>
                  <td className="p-4 font-black text-slate-700 border-r border-slate-100 uppercase tracking-tight">{student.student_name}</td>
                  {subjects.map(s => (
                    <td key={s.id} className="p-4 text-center font-mono font-bold text-slate-600 border-r border-slate-100">
                      {studentMarks[s.id] || '0'}
                    </td>
                  ))}
                  <td className="p-4 text-center font-mono font-black text-[#2563EB] border-r border-slate-100 bg-blue-50/30">{total}</td>
                  <td className="p-4 text-center font-mono font-black text-slate-700 border-r border-slate-100 bg-slate-50/30">{gpa}</td>
                  <td className={`p-4 text-center font-black bg-slate-50/30 ${grade === 'F' ? 'text-red-500' : 'text-emerald-600'}`}>
                    <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-white border border-slate-100 shadow-sm">
                        {grade}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-12 flex justify-between items-end px-8 relative z-10">
        <div className="flex flex-col items-center gap-2">
            <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
            <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
                Deenora Management System
            </div>
        </div>
        <div className="flex gap-16">
          <div className="text-center">
            <div className="w-40 h-16 mb-2 flex items-end justify-center">
                <div className="w-32 h-[1px] bg-slate-200"></div>
            </div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Exam Controller</div>
          </div>
          <div className="text-center">
            <div className="w-40 h-16 mb-2 flex items-end justify-center">
                <div className="w-32 h-[1px] bg-slate-200"></div>
            </div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Principal</div>
          </div>
        </div>
      </div>
    </div>
  );
};
