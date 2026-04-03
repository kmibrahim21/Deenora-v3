import React from 'react';

interface FeeReceiptProps {
  student: any;
  month: string;
  madrasah: { name: string; address?: string; phone?: string };
  lang: 'en' | 'bn';
}

export const FeeReceiptTemplate: React.FC<FeeReceiptProps> = ({ student, month, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'ফি পেমেন্ট রিসিট' : 'FEE PAYMENT RECEIPT',
    receiptNo: isBangla ? 'রিসিট নং' : 'Receipt No',
    date: isBangla ? 'তারিখ' : 'Date',
    studentDetails: isBangla ? 'ছাত্রের বিবরণ:' : 'Student Details:',
    name: isBangla ? 'নাম' : 'Name',
    class: isBangla ? 'শ্রেণি' : 'Class',
    roll: isBangla ? 'রোল' : 'Roll',
    month: isBangla ? 'মাস' : 'Month',
    description: isBangla ? 'বিবরণ' : 'Description',
    amount: isBangla ? 'পরিমাণ' : 'Amount',
    monthlyFees: isBangla ? 'মাসিক ফি ও অন্যান্য চার্জ' : 'Monthly Fees & Other Charges',
    discount: isBangla ? 'ডিসকাউন্ট' : 'Discount Applied',
    totalPaid: isBangla ? 'মোট জমা (এই মাসে)' : 'Total Paid (This Month)',
    balanceDue: isBangla ? 'বকেয়া' : 'Balance Due',
    studentSignature: isBangla ? 'ছাত্র/অভিভাবকের স্বাক্ষর' : 'Student/Guardian Signature',
    authSignature: isBangla ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authorized Signature',
    computerGenerated: isBangla ? 'এটি একটি কম্পিউটার জেনারেটেড রিসিট।' : 'This is a computer-generated receipt.',
    currency: isBangla ? '৳' : 'BDT',
    officeCopy: isBangla ? 'অফিস কপি' : 'Office Copy',
    studentCopy: isBangla ? 'ছাত্র কপি' : 'Student Copy'
  };

  const ReceiptContent = ({ copyType }: { copyType: string }) => (
    <div className="flex-1 p-10 border-2 border-slate-100 rounded-[2rem] relative overflow-hidden bg-white">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none -rotate-45">
        <h1 className="text-9xl font-black uppercase">{madrasah.name}</h1>
      </div>

      {/* Copy Indicator */}
      <div className="absolute top-6 right-6 px-3 py-1 bg-slate-100 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-400">
        {copyType}
      </div>

      {/* Header */}
      <div className="flex items-center gap-6 mb-8 border-b border-slate-100 pb-6">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
          <span className="text-2xl font-black">{madrasah.name.charAt(0)}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-blue-900 truncate leading-tight">{madrasah.name}</h1>
          {madrasah.address && <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{madrasah.address}</p>}
          {madrasah.phone && <p className="text-[10px] font-bold text-slate-400 uppercase">Phone: {madrasah.phone}</p>}
        </div>
      </div>

      <h2 className="text-center text-lg font-black text-slate-700 mb-6 tracking-[0.2em] uppercase">{t.title}</h2>

      <div className="flex justify-between items-center mb-8 px-2">
        <div className="space-y-1">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.receiptNo}</p>
          <p className="text-sm font-black text-blue-600">#REC-{Date.now().toString().slice(-6)}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.date}</p>
          <p className="text-sm font-black text-slate-700">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
        <div className="space-y-3">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.name}</p>
            <p className="text-sm font-black text-slate-700">{student.student_name}</p>
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.class}</p>
            <p className="text-sm font-black text-slate-700">{student.class_name || '-'}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.roll}</p>
            <p className="text-sm font-black text-slate-700">{student.roll || '-'}</p>
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.month}</p>
            <p className="text-sm font-black text-slate-700">{month}</p>
          </div>
        </div>
      </div>

      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{t.description}</th>
            <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">{t.amount}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr>
            <td className="py-4 text-sm font-black text-slate-700">{t.monthlyFees}</td>
            <td className="py-4 text-right text-sm font-black text-slate-900">৳{Number(student.total_payable).toLocaleString()}</td>
          </tr>
          {Number(student.discount) > 0 && (
            <tr>
              <td className="py-4 text-sm font-bold text-orange-500 italic">{t.discount}</td>
              <td className="py-4 text-right text-sm font-bold text-orange-500">-৳{Number(student.discount).toLocaleString()}</td>
            </tr>
          )}
          <tr className="bg-emerald-50/50">
            <td className="py-4 px-2 text-sm font-black text-emerald-700">{t.totalPaid}</td>
            <td className="py-4 px-2 text-right text-sm font-black text-emerald-700">৳{Number(student.total_paid).toLocaleString()}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="py-6 text-right text-xs font-black uppercase tracking-widest text-slate-400 pr-4">{t.balanceDue}:</td>
            <td className="py-6 text-right text-xl font-black text-red-600">৳{Math.max(0, Number(student.balance_due)).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div className="flex justify-between mt-12 pt-12 border-t border-dashed border-slate-200">
        <div className="text-center">
          <div className="w-32 h-px bg-slate-200 mb-2" />
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.studentSignature}</p>
        </div>
        <div className="text-center">
          <div className="w-32 h-px bg-slate-200 mb-2" />
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.authSignature}</p>
        </div>
      </div>

      <p className="text-center text-slate-300 text-[8px] font-bold mt-10 uppercase tracking-widest">{t.computerGenerated}</p>
    </div>
  );

  return (
    <div className="w-[794px] min-h-[1123px] p-8 bg-slate-50 font-noto flex flex-col gap-8">
      <ReceiptContent copyType={t.officeCopy} />
      <div className="border-t-2 border-dashed border-slate-300 relative">
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 px-4 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">
          ✂️ Cut Here
        </div>
      </div>
      <ReceiptContent copyType={t.studentCopy} />
    </div>
  );
};
