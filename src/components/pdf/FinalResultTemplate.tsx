import React from 'react';

interface FinalResultProps {
  title: string;
  className: string;
  subjects: string[];
  students: any[];
  madrasah: { name: string };
  lang: 'en' | 'bn';
}

export const FinalResultTemplate: React.FC<FinalResultProps> = ({ title, className, subjects, students, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const t = {
    class: isBangla ? 'শ্রেণি' : 'Class',
    rank: isBangla ? 'মেধা' : 'Rank',
    roll: isBangla ? 'রোল' : 'Roll',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    total: isBangla ? 'মোট' : 'Total',
    gpa: isBangla ? 'জিপিএ' : 'GPA',
    grade: isBangla ? 'গ্রেড' : 'Grade',
    date: isBangla ? 'তারিখ' : 'Date'
  };

  return (
    <div className="w-[1123px] min-h-[794px] p-10 bg-white font-noto text-slate-800 border-[8px] border-slate-100">
      {/* Header */}
      <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
        <h1 className="text-4xl font-black text-slate-900 mb-1 uppercase tracking-tight">{madrasah.name}</h1>
        <div className="text-xl font-bold text-[#2563EB] mb-2">{title}</div>
        <div className="flex justify-center gap-6 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span>{t.class}: {className}</span>
          <span>{t.date}: {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-3 text-center font-black uppercase tracking-widest border-r border-slate-700 w-12">{t.rank}</th>
              <th className="p-3 text-center font-black uppercase tracking-widest border-r border-slate-700 w-16">{t.roll}</th>
              <th className="p-3 text-left font-black uppercase tracking-widest border-r border-slate-700 min-w-[150px]">{t.name}</th>
              {subjects.map(s => (
                <th key={s} className="p-3 text-center font-black uppercase tracking-widest border-r border-slate-700">
                  {s.substring(0, 15)}
                </th>
              ))}
              <th className="p-3 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800">{t.total}</th>
              <th className="p-3 text-center font-black uppercase tracking-widest border-r border-slate-700 bg-slate-800">{t.gpa}</th>
              <th className="p-3 text-center font-black uppercase tracking-widest bg-slate-800">{t.grade}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((std, idx) => (
              <tr key={std.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="p-3 text-center font-black text-[#2563EB] border-r border-slate-100 bg-blue-50/20">#{std.rank}</td>
                <td className="p-3 text-center font-mono font-bold text-slate-500 border-r border-slate-100">{std.roll || '-'}</td>
                <td className="p-3 font-bold text-slate-700 border-r border-slate-100">{std.student_name}</td>
                {subjects.map(sub => (
                  <td key={sub} className="p-3 text-center font-mono text-slate-600 border-r border-slate-100">
                    {std.marks[sub] || '-'}
                  </td>
                ))}
                <td className="p-3 text-center font-mono font-bold text-[#2563EB] border-r border-slate-100 bg-blue-50/30">{std.total}</td>
                <td className="p-3 text-center font-mono font-bold text-slate-700 border-r border-slate-100 bg-slate-50/30">{std.gpa}</td>
                <td className={`p-3 text-center font-black bg-slate-50/30 ${std.grade === 'F' ? 'text-red-600' : 'text-green-600'}`}>
                  {std.grade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-12 flex justify-between items-end px-4">
        <div className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">
          Deenora Management System
        </div>
        <div className="flex gap-12">
          <div className="text-center">
            <div className="w-32 border-t border-slate-200 pt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Exam Controller</div>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-slate-200 pt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Principal</div>
          </div>
        </div>
      </div>
    </div>
  );
};
