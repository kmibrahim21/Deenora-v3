import React from 'react';

interface FeeReceiptProps {
  student: any;
  month: string;
  madrasah: { name: string; address?: string; phone?: string; logo_url?: string };
  lang: 'en' | 'bn';
}

export const FeeReceiptTemplate: React.FC<FeeReceiptProps> = ({ student, month, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'ফি পেমেন্ট মানি রিসিট' : 'FEE PAYMENT RECEIPT',
    receiptNo: isBangla ? 'রিসিট নং' : 'Receipt No',
    date: isBangla ? 'তারিখ' : 'Date',
    studentDetails: isBangla ? 'ছাত্রের বিবরণ:' : 'Student Details:',
    name: isBangla ? 'নাম' : 'Name',
    class: isBangla ? 'শ্রেণি' : 'Class',
    roll: isBangla ? 'রোল' : 'Roll',
    section: isBangla ? 'শাখা' : 'Section',
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
    <div className="flex-1 p-6 border-[2px] border-[#1E3A8A] border-dashed rounded-xl relative overflow-hidden bg-white shadow-sm flex flex-col justify-between">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none -rotate-[30deg]">
         {madrasah.logo_url ? (
           <img src={madrasah.logo_url} alt="Watermark" className="max-w-[70%] max-h-[70%] object-contain grayscale" crossOrigin="anonymous" />
         ) : (
           <h1 className="text-8xl font-black uppercase text-center text-slate-900 leading-none">{madrasah.name}</h1>
         )}
      </div>

      {/* Copy Indicator */}
      <div className="absolute top-4 right-4 px-4 py-1.5 bg-[#1E3A8A] rounded text-[10px] font-black uppercase tracking-widest text-white shadow-md">
        {copyType}
      </div>

      <div>
        {/* Header */}
        <div className="flex items-center gap-4 mb-4 border-b-2 border-slate-100 pb-3">
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-full flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-sm relative z-10">
            {madrasah.logo_url ? (
               <img src={madrasah.logo_url} alt="Logo" className="max-w-[80%] max-h-[80%] object-contain drop-shadow-sm" crossOrigin="anonymous" />
            ) : (
               <span className="text-3xl font-black text-[#1E3A8A]">{madrasah.name.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0 pr-24 relative z-10">
            <h1 className={`text-2xl font-black text-[#1E3A8A] truncate leading-tight ${isBangla ? 'font-tiro' : ''}`}>{madrasah.name}</h1>
            {madrasah.address && <p className="text-[11px] font-bold text-slate-500 uppercase truncate mt-0.5">{madrasah.address}</p>}
            {madrasah.phone && <p className="text-[10px] font-bold text-slate-500 uppercase">Phone: {madrasah.phone}</p>}
          </div>
        </div>

        <div className="flex justify-center mb-3 relative z-10">
           <h2 className="px-6 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-sm font-black text-slate-700 tracking-[0.2em] shadow-sm">{t.title}</h2>
        </div>

        <div className="flex justify-between items-center mb-4 px-1 relative z-10">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.receiptNo}:</span>
            <span className="text-[11px] font-black text-[#1E3A8A]">#REC-{Date.now().toString().slice(-6)}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.date}:</span>
            <span className="text-[11px] font-black text-slate-700">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 bg-slate-50/80 p-3 rounded-xl border border-slate-200 relative z-10">
          <div className="flex items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">{t.name}:</span>
            <span className={`text-sm font-bold text-slate-800 ${isBangla ? 'font-tiro' : ''}`}>{student.student_name}</span>
          </div>
          <div className="flex items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">{t.class}:</span>
            <span className="text-sm font-bold text-slate-800">{student.class_name || student.classes?.class_name || '-'}</span>
          </div>
          <div className="flex items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">{t.roll}:</span>
            <span className="text-sm font-bold text-slate-800">{student.roll || '-'}</span>
          </div>
          <div className="flex items-center border-b border-slate-200/60 pb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">{t.section}:</span>
            <span className="text-sm font-bold text-slate-800">{student.section || '-'}</span>
          </div>
          <div className="col-span-2 flex items-center pt-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2 whitespace-nowrap">{t.month}:</span>
            <span className="text-[13px] px-3 py-0.5 bg-white border border-slate-200 rounded font-bold text-[#1E3A8A] shadow-sm whitespace-nowrap">{month}</span>
          </div>
        </div>

        <div className="border border-slate-300 rounded-lg overflow-hidden relative z-10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="py-2.5 px-4 text-left text-[11px] font-black uppercase tracking-widest text-[#1E3A8A]">{t.description}</th>
                <th className="py-2.5 px-4 text-right text-[11px] font-black uppercase tracking-widest text-[#1E3A8A]">{t.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-white">
                <td className="py-2.5 px-4 text-[13px] font-bold text-slate-700">{t.monthlyFees}</td>
                <td className="py-2.5 px-4 text-right text-[13px] font-bold text-slate-900">{t.currency}{Number(student.total_payable).toLocaleString()}</td>
              </tr>
              {Number(student.discount) > 0 && (
                <tr className="bg-white">
                  <td className="py-2.5 px-4 text-[13px] font-bold text-orange-600 italic">{t.discount}</td>
                  <td className="py-2.5 px-4 text-right text-[13px] font-bold text-orange-600">-{t.currency}{Number(student.discount).toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-emerald-50/80">
                <td className="py-2.5 px-4 text-[13px] font-black text-emerald-800">{t.totalPaid}</td>
                <td className="py-2.5 px-4 text-right text-[13px] font-black text-emerald-800">{t.currency}{Number(student.total_paid).toLocaleString()}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-red-50/50 border-t-2 border-red-200">
                <td className="py-2.5 px-4 text-right text-[11px] font-black uppercase tracking-widest text-red-800">{t.balanceDue}:</td>
                <td className="py-2.5 px-4 text-right text-[14px] font-black text-red-600">{t.currency}{Math.max(0, Number(student.balance_due)).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex justify-between mt-6 pt-4">
          <div className="text-center px-4">
            <div className="w-36 h-px bg-slate-400 mb-1.5" />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.studentSignature}</p>
          </div>
          <div className="text-center px-4">
            <div className="w-36 h-px bg-slate-400 mb-1.5" />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.authSignature}</p>
          </div>
        </div>

        <p className="text-center text-slate-400 text-[8px] font-bold mt-3 uppercase tracking-[0.2em]">{t.computerGenerated} - {madrasah.name}</p>
      </div>
    </div>
  );

  return (
    <div className={`w-[794px] h-[1123px] box-border p-6 bg-white flex flex-col gap-6 ${isBangla ? 'font-noto' : 'font-hind'}`}>
      <ReceiptContent copyType={t.officeCopy} />
      <div className="flex items-center relative">
        <div className="w-full h-[2px] border-t-2 border-dashed border-slate-300"></div>
        <div className="absolute left-1/2 -translate-x-1/2 px-4 bg-white flex items-center gap-2">
           <span className="text-slate-400">✂️</span>
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Cut Here</span>
        </div>
      </div>
      <ReceiptContent copyType={t.studentCopy} />
    </div>
  );
};
