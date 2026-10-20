import React from 'react';

interface ClassFeeReportProps {
  className: string;
  month: string;
  students: any[];
  madrasah: any;
  lang: 'en' | 'bn';
  startIndex?: number;
  allTotals?: {
    totalPayable: number;
    totalPaid: number;
    totalDue: number;
  };
}

export const ClassFeeReportTemplate: React.FC<ClassFeeReportProps> = ({ className, month, students, madrasah, lang, allTotals, startIndex = 0 }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'মাসিক ফি কালেকশন রিপোর্ট' : 'Monthly Fee Collection Report',
    class: isBangla ? 'শ্রেণি' : 'Class',
    month: isBangla ? 'মাস' : 'Month',
    roll: isBangla ? 'রোল' : 'Roll',
    studentName: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    totalPayable: isBangla ? 'মোট প্রদেয়' : 'Total Payable',
    totalPaid: isBangla ? 'মোট জমা' : 'Total Paid',
    balanceDue: isBangla ? 'বকেয়া' : 'Balance Due',
    status: isBangla ? 'স্ট্যাটাস' : 'Status',
    sl: isBangla ? 'নং' : 'SL',
    date: isBangla ? 'তারিখ' : 'Date',
    signature: isBangla ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authorized Signature',
    paid: isBangla ? 'পরিশোধিত' : 'Paid',
    unpaid: isBangla ? 'বকেয়া' : 'Unpaid',
    partial: isBangla ? 'আংশিক' : 'Partial'
  };

  const currentPayable = students.reduce((sum, s) => sum + (Number(s.total_payable) || 0), 0);
  const currentPaid = students.reduce((sum, s) => sum + (Number(s.total_paid) || 0), 0);
  const currentDue = students.reduce((sum, s) => sum + (Number(s.balance_due) || 0), 0);

  const displayPayable = allTotals ? allTotals.totalPayable : currentPayable;
  const displayPaid = allTotals ? allTotals.totalPaid : currentPaid;
  const displayDue = allTotals ? allTotals.totalDue : currentDue;

  return (
    <div className="w-[794px] min-h-[1123px] p-12 bg-white font-noto text-slate-800 relative flex flex-col">
      {/* Decorative Border */}
      <div className="absolute inset-4 border-2 border-slate-100 pointer-events-none rounded-sm" />
      
      {/* Header */}
      <div className="text-center mb-6 relative">
        <div className="inline-block px-6 py-2 bg-blue-50 rounded-2xl mb-2">
          <h1 className="text-3xl font-black text-blue-900 tracking-tight">{madrasah.name}</h1>
        </div>
        <h2 className="text-xl font-bold text-slate-600 uppercase tracking-[0.2em] mb-1">{t.title}</h2>
        <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full" />
      </div>
      
      {/* Meta Info */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.class}:</span>
            <span className="text-sm font-black text-slate-700">{className}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.month}:</span>
            <span className="text-sm font-black text-slate-700">{month}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.date}:</span>
            <span className="text-sm font-black text-slate-700">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="flex-1">
        <table className="w-full border-collapse rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-center w-10">{t.sl}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-center w-12">{t.roll}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-left">{t.studentName}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-left w-24">{t.class}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-right">{t.totalPayable}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-right">{t.totalPaid}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-right">{t.balanceDue}</th>
              <th className="p-2 text-[10px] font-black uppercase text-center">{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const status = student.status?.toLowerCase();
              const statusText = status === 'paid' ? t.paid : status === 'partial' ? t.partial : t.unpaid;
              const statusColor = status === 'paid' ? 'text-emerald-600 bg-emerald-50' : status === 'partial' ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';

              return (
                <tr key={student.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="border-r border-slate-100 p-2 text-xs font-bold text-center text-slate-400">{startIndex + index + 1}</td>
                  <td className="border-r border-slate-100 p-2 text-xs font-black text-center text-blue-600">{student.roll}</td>
                  <td className="border-r border-slate-100 p-2 text-xs font-black text-slate-700">{student.student_name}</td>
                  <td className="border-r border-slate-100 p-2 text-[11px] font-bold text-slate-600">{student.class_name || className}</td>
                  <td className="border-r border-slate-100 p-2 text-xs font-bold text-right">৳{Number(student.total_payable || 0).toLocaleString()}</td>
                  <td className="border-r border-slate-100 p-2 text-xs font-bold text-right">
                    ৳{Number(student.total_paid || 0).toLocaleString()}
                    {Number(student.discount) > 0 && (
                      <span className="block text-[8px] text-orange-600 font-bold">
                        (ছাড়: ৳{Number(student.discount).toLocaleString()})
                      </span>
                    )}
                  </td>
                  <td className="border-r border-slate-100 p-2 text-xs font-bold text-right text-red-600">৳{Number(student.balance_due || 0).toLocaleString()}</td>
                  <td className="p-2 text-center">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${statusColor}`}>
                      {statusText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black">
              <td colSpan={4} className="p-4 text-right text-xs uppercase tracking-widest text-slate-500">Total / মোট:</td>
              <td className="p-4 text-right text-sm text-slate-900">৳{displayPayable.toLocaleString()}</td>
              <td className="p-4 text-right text-sm text-emerald-600">৳{displayPaid.toLocaleString()}</td>
              <td className="p-4 text-right text-sm text-red-600">৳{displayDue.toLocaleString()}</td>
              <td className="p-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-8 flex justify-between items-end">
        <div className="text-[10px] text-slate-300 font-bold italic">
          Generated by Smart Madrasah Result Engine
        </div>
        <div className="text-center relative">
          <div className="flex items-center justify-center relative mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 40}px` }}>
            {madrasah?.config_json?.signature_url && (
              <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 40}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
            )}
          </div>
          <div className="w-48 h-px bg-slate-300 mb-2" />
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.signature}</p>
        </div>
      </div>
    </div>
  );
};
