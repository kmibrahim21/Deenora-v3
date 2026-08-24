import React from 'react';

interface FeeReceiptProps {
  student: any;
  month: string;
  madrasah: any;
  lang: 'en' | 'bn';
  receiptId?: string;
}

export const FeeReceiptTemplate: React.FC<FeeReceiptProps> = ({ student, month, madrasah, lang, receiptId: propReceiptId }) => {
  const isBangla = lang === 'bn';
  const config = madrasah?.config_json || {};
  const receiptId = React.useMemo(() => propReceiptId || `#REC-${Date.now().toString().slice(-6)}`, [propReceiptId]);
  const t = {
    title: isBangla ? 'ফি পেমেন্ট মানি রিসিট' : 'FEE PAYMENT RECEIPT',
    receiptNo: isBangla ? 'রিসিট নং' : 'Receipt No',
    date: isBangla ? 'তারিখ' : 'Date',
    studentDetails: isBangla ? 'শিক্ষার্থীর বিবরণ:' : 'Student Details:',
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
    authSignature: isBangla ? 'হিসাব রক্ষক' : 'Accounts Officer',
    principalSignature: isBangla ? 'প্রতিষ্ঠান প্রধান' : 'Head of Institution',
    computerGenerated: isBangla ? 'এটি একটি কম্পিউটার জেনারেটেড রিসিট।' : 'This is a computer-generated receipt.',
    currency: isBangla ? '৳' : 'BDT',
    officeCopy: isBangla ? 'অফিস কপি' : 'Office Copy',
    studentCopy: isBangla ? 'শিক্ষার্থী কপি' : 'Student Copy'
  };

  const ReceiptContent = ({ copyType }: { copyType: string }) => {
    const feeItems = student.fee_items || [
      { name: t.monthlyFees, amount: Number(student.total_payable) }
    ];

    return (
    <div className="flex-1 border-[2px] border-[#1E3A8A] border-dashed rounded-xl relative overflow-hidden bg-white shadow-sm flex flex-col justify-between p-3">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none -rotate-[30deg] px-10">
         {madrasah.logo_url ? (
           <img src={madrasah.logo_url} alt="Watermark" className="max-w-[70%] max-h-[70%] object-contain grayscale" crossOrigin="anonymous" />
         ) : (
           <h1 className="text-6xl font-black uppercase text-center text-slate-900 leading-tight">{madrasah.name}</h1>
         )}
      </div>

      {/* Copy Indicator */}
      <div className="absolute top-3 right-3 px-3 py-1 bg-[#1E3A8A] rounded text-[9px] font-black uppercase tracking-widest text-white shadow-md">
        {copyType}
      </div>

      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-0.5 border-b border-slate-100 pb-1">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded flex flex-col items-center justify-center overflow-hidden shrink-0 relative z-10">
            {madrasah.logo_url ? (
               <img src={madrasah.logo_url} alt="Logo" className="max-w-[90%] max-h-[90%] object-contain" crossOrigin="anonymous" />
            ) : (
               <span className="text-xl font-black text-[#1E3A8A]">{madrasah.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 relative z-10 min-w-0 pr-2">
            <h1 className={`text-lg font-black text-[#1E3A8A] leading-tight break-words whitespace-normal ${isBangla ? 'font-tiro' : ''}`}>{madrasah.name}</h1>
            {madrasah.address && <p className="text-[9px] font-bold text-slate-500 uppercase leading-normal mt-0.5 break-words whitespace-normal">{madrasah.address}</p>}
          </div>
        </div>

        <div className="flex justify-center mb-1 relative z-10">
           <h2 className="px-4 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-black text-slate-600 tracking-[0.1em] shadow-sm uppercase">{t.title}</h2>
        </div>

        <div className="flex justify-between items-center mb-1 px-0.5 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.receiptNo}:</span>
            <span className="text-[10px] font-black text-[#1E3A8A]">{receiptId}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.date}:</span>
            <span className="text-[10px] font-black text-slate-700">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 mb-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100 relative z-10">
          <div className="col-span-1 sm:col-span-2 sm:border-r border-slate-200 sm:pr-3 space-y-1">
            <div className="flex items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-10">{t.name}:</span>
                <span className={`text-[11px] font-bold text-slate-800 truncate ${isBangla ? 'font-tiro' : ''}`}>{student.student_name}</span>
            </div>
            <div className="flex items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-10">{t.class}:</span>
                <span className="text-[11px] font-bold text-slate-800">{student.class_name || student.classes?.class_name || '-'}</span>
            </div>
          </div>
          <div className="space-y-1 pl-1">
             <div className="flex items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-8">{t.roll}:</span>
                <span className="text-[11px] font-bold text-slate-800">{student.roll || '-'}</span>
            </div>
            <div className="flex items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest w-8">{t.month}:</span>
                <span className="text-[10px] font-black text-[#1E3A8A] leading-none">{month}</span>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded overflow-hidden relative z-10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="py-1 px-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">{t.description}</th>
                <th className="py-1 px-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-500">{t.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feeItems.map((item: any, idx: number) => (
                <tr key={idx} className="bg-white">
                  <td className="py-1 px-3 text-[11px] font-bold text-slate-700">{item.name}</td>
                  <td className="py-1 px-3 text-right text-[11px] font-bold text-slate-900">{t.currency}{Number(item.amount).toLocaleString()}</td>
                </tr>
              ))}
              {Number(student.discount) > 0 && (
                <tr className="bg-white">
                  <td className="py-0.5 px-3 text-[10px] font-bold text-orange-600 italic leading-none">{t.discount}</td>
                  <td className="py-0.5 px-3 text-right text-[10px] font-bold text-orange-600 leading-none">-{t.currency}{Number(student.discount).toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-emerald-50/50">
                <td className="py-1 px-3 text-[11px] font-black text-emerald-800">{t.totalPaid}</td>
                <td className="py-1 px-3 text-right text-[11px] font-black text-emerald-800">{t.currency}{Number(student.total_paid).toLocaleString()}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-red-50/30 border-t border-red-100">
                <td className="py-1 px-3 text-right text-[9px] font-black uppercase tracking-widest text-red-700">{t.balanceDue}:</td>
                <td className="py-1 px-3 text-right text-[12px] font-black text-red-600 font-mono">{t.currency}{Math.max(0, Number(student.balance_due)).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-end mb-4">
          <div className="text-center w-32">
            <div className="h-6 mb-1 flex items-end justify-center">
                <span className="text-[10px] font-noto opacity-5 select-none uppercase font-black text-slate-400">Officer</span>
            </div>
            <div className="border-t border-slate-900 pt-1">
              <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.15em]">{t.authSignature}</p>
            </div>
          </div>

          <div className="text-center w-32 relative">
            <div className="mb-1 flex items-center justify-center relative" style={{ height: `${config.signature_height || 26}px` }}>
                {config.signature_url ? (
                  <img src={config.signature_url} style={{ height: `${config.signature_height || 26}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <div className="w-8 h-8 border border-slate-400 rounded-full flex items-center justify-center -rotate-12">
                          <span className="text-[4px] font-black uppercase text-slate-400">Sig</span>
                      </div>
                  </div>
                )}
            </div>
            <div className="border-t border-slate-900 pt-1">
              <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.15em]">{t.principalSignature}</p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-300 text-[7px] font-bold uppercase tracking-[0.25em] pb-1 border-t border-slate-50 mt-2 pt-1">{t.computerGenerated} - {madrasah.name}</p>
      </div>
    </div>
    );
  };

  return (
    <div className={`w-[794px] h-[1123px] box-border p-4 bg-white flex flex-col gap-4 ${isBangla ? 'font-noto' : 'font-hind'}`}>
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
