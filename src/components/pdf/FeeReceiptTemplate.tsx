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
    discount: isBangla ? 'ডিসকাউন্ট (ছাড়)' : 'Discount Applied',
    totalPaid: isBangla ? 'মোট জমা (এই মাসে)' : 'Total Paid (This Month)',
    balanceDue: isBangla ? 'বকেয়া' : 'Balance Due',
    previousDue: isBangla ? 'পূর্বের বকেয়া' : 'Previous Due',
    authSignature: isBangla ? 'হিসাব রক্ষক' : 'Accounts Officer',
    principalSignature: isBangla ? 'প্রতিষ্ঠান প্রধান' : 'Head of Institution',
    computerGenerated: isBangla ? 'এটি একটি কম্পিউটার জেনারেটেড রিসিট।' : 'This is a computer-generated receipt.',
    currency: isBangla ? '৳' : 'BDT',
    officeCopy: isBangla ? 'অফিস কপি' : 'Office Copy',
    studentCopy: isBangla ? 'শিক্ষার্থী কপি' : 'Student Copy'
  };

  const ReceiptContent = ({ copyType }: { copyType: string }) => {
    const discountVal = Number(student?.discount ?? student?.total_discount ?? student?.discount_amount ?? student?.paymentDetails?.discount ?? 0);
    const paidVal = Number(student?.total_paid ?? 0);
    const prevDueVal = Number(student?.previous_due ?? 0);
    const balDueVal = Math.max(0, Number(student?.balance_due ?? 0));

    const fallbackPayable = Number(student?.total_payable ?? 0) > 0
      ? Number(student.total_payable)
      : Math.max(0, paidVal + discountVal + balDueVal - prevDueVal);

    const feeItems = (student?.fee_items && student.fee_items.length > 0)
      ? student.fee_items
      : [{ name: t.monthlyFees, amount: fallbackPayable || (paidVal + discountVal) }];

    return (
    <div className="flex-1 border-[2.5px] border-[#1E3A8A] border-dashed rounded-xl relative overflow-hidden bg-white shadow-xs flex flex-col justify-between p-3.5">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none -rotate-[30deg] px-10">
         {madrasah.logo_url ? (
           <img src={madrasah.logo_url} alt="Watermark" className="max-w-[70%] max-h-[70%] object-contain grayscale" crossOrigin="anonymous" />
         ) : (
           <h1 className="text-6xl font-black uppercase text-center text-slate-900 leading-tight">{madrasah.name}</h1>
         )}
      </div>

      {/* Copy Indicator */}
      <div className="absolute top-3 right-3 px-3 py-1 bg-[#1E3A8A] rounded text-[10px] font-black uppercase tracking-widest text-white shadow-sm z-20">
        {copyType}
      </div>

      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-1 border-b-2 border-blue-900/20 pb-1.5">
          <div className="w-13 h-13 bg-blue-50 border-2 border-[#1E3A8A]/40 rounded-lg flex items-center justify-center p-0.5 shrink-0 relative z-10">
            {madrasah.logo_url ? (
               <img src={madrasah.logo_url} alt="Logo" className="max-w-[95%] max-h-[95%] object-contain" crossOrigin="anonymous" />
            ) : (
               <span className="text-2xl font-black text-[#1E3A8A]">{madrasah.name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 relative z-10 min-w-0 pr-16">
            <h1 className={`text-xl font-black text-[#1E3A8A] leading-tight break-words whitespace-normal ${isBangla ? 'font-tiro' : ''}`}>{madrasah.name}</h1>
            {madrasah.address && <p className="text-[10px] font-extrabold text-slate-800 uppercase leading-normal mt-0.5 break-words whitespace-normal">{madrasah.address}</p>}
          </div>
        </div>

        {/* Title Badge */}
        <div className="flex justify-center mb-1.5 relative z-10">
           <h2 className="px-5 py-1 bg-[#1E3A8A] text-white rounded-full text-[11px] font-black tracking-[0.12em] shadow-sm uppercase">{t.title}</h2>
        </div>

        {/* Receipt No & Date Bar */}
        <div className="flex justify-between items-center mb-1.5 px-1 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">{t.receiptNo}:</span>
            <span className="text-[11px] font-black text-[#1E3A8A]">{receiptId}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">{t.date}:</span>
            <span className="text-[11px] font-black text-slate-900">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
        </div>

        {/* Student Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 mb-1.5 bg-slate-100/90 p-2.5 rounded-lg border-2 border-slate-300 relative z-10">
          <div className="col-span-1 sm:col-span-2 sm:border-r-2 border-slate-300 sm:pr-3 space-y-1">
            <div className="flex items-center">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider w-12">{t.name}:</span>
                <span className={`text-[12px] font-black text-slate-950 truncate ${isBangla ? 'font-tiro' : ''}`}>{student.student_name}</span>
            </div>
            <div className="flex items-center">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider w-12">{t.class}:</span>
                <span className="text-[12px] font-black text-slate-950">{student.class_name || student.classes?.class_name || '-'}</span>
            </div>
          </div>
          <div className="space-y-1 pl-1">
             <div className="flex items-center">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider w-10">{t.roll}:</span>
                <span className="text-[12px] font-black text-slate-950">{student.roll || '-'}</span>
            </div>
            <div className="flex items-center">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider w-10">{t.month}:</span>
                <span className="text-[11px] font-black text-[#1E3A8A] leading-none">{month}</span>
            </div>
          </div>
        </div>

        {/* Table of Fee Items */}
        <div className="border-2 border-slate-400 rounded overflow-hidden relative z-10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1E3A8A] text-white border-b-2 border-slate-400">
                <th className="py-1.5 px-3 text-left text-[10px] font-black uppercase tracking-widest text-white">{t.description}</th>
                <th className="py-1.5 px-3 text-right text-[10px] font-black uppercase tracking-widest text-white">{t.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {feeItems.map((item: any, idx: number) => (
                <tr key={idx} className="bg-white">
                  <td className="py-1.5 px-3 text-[11px] font-black text-slate-900">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{item.name}</span>
                      {item.category_name && item.category_name !== item.name && (
                        <span className="text-[9px] font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                          {item.category_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-right text-[11px] font-black text-slate-950">{t.currency}{Number(item.amount).toLocaleString()}</td>
                </tr>
              ))}
              {prevDueVal > 0 && (
                <tr className="bg-amber-100/80">
                  <td className="py-1 px-3 text-[11px] font-black text-amber-950 leading-none">{t.previousDue}</td>
                  <td className="py-1 px-3 text-right text-[11px] font-black text-amber-950 leading-none">{t.currency}{prevDueVal.toLocaleString()}</td>
                </tr>
              )}
              {discountVal > 0 && (
                <tr className="bg-orange-100/80">
                  <td className="py-1 px-3 text-[11px] font-black text-orange-950 italic leading-none">{t.discount}</td>
                  <td className="py-1 px-3 text-right text-[11px] font-black text-orange-950 leading-none">-{t.currency}{discountVal.toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-emerald-100/90 border-t-2 border-emerald-600">
                <td className="py-1.5 px-3 text-[12px] font-black text-emerald-950">{t.totalPaid}</td>
                <td className="py-1.5 px-3 text-right text-[12px] font-black text-emerald-950 font-mono">{t.currency}{paidVal.toLocaleString()}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-rose-100/90 border-t-2 border-rose-600">
                <td className="py-1.5 px-3 text-right text-[10px] font-black uppercase tracking-widest text-rose-950">{t.balanceDue}:</td>
                <td className="py-1.5 px-3 text-right text-[13px] font-black text-rose-950 font-mono">{t.currency}{balDueVal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="relative z-10 pt-2">
        <div className="flex justify-between items-end mb-3">
          <div className="text-center w-32">
            <div className="h-6 mb-1 flex items-end justify-center">
                <span className="text-[10px] font-noto opacity-10 select-none uppercase font-black text-slate-900">Officer</span>
            </div>
            <div className="border-t-2 border-slate-900 pt-1">
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em]">{t.authSignature}</p>
            </div>
          </div>

          <div className="text-center w-32 relative">
            <div className="mb-1 flex items-center justify-center relative" style={{ height: `${config.signature_height || 26}px` }}>
                {config.signature_url ? (
                  <img src={config.signature_url} style={{ height: `${config.signature_height || 26}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <div className="w-8 h-8 border border-slate-900 rounded-full flex items-center justify-center -rotate-12">
                          <span className="text-[4px] font-black uppercase text-slate-900">Sig</span>
                      </div>
                  </div>
                )}
            </div>
            <div className="border-t-2 border-slate-900 pt-1">
              <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em]">{t.principalSignature}</p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-700 text-[8px] font-black uppercase tracking-[0.2em] pb-1 border-t border-slate-300 mt-1 pt-1">{t.computerGenerated} - {madrasah.name}</p>
      </div>
    </div>
    );
  };

  return (
    <div className={`w-[794px] h-[1123px] box-border p-4 bg-white flex flex-col gap-4 ${isBangla ? 'font-noto' : 'font-hind'}`}>
      <ReceiptContent copyType={t.officeCopy} />
      <div className="flex items-center relative">
        <div className="w-full h-[2px] border-t-2 border-dashed border-slate-400"></div>
        <div className="absolute left-1/2 -translate-x-1/2 px-4 bg-white flex items-center gap-2">
           <span className="text-slate-700">✂️</span>
           <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Cut Here</span>
        </div>
      </div>
      <ReceiptContent copyType={t.studentCopy} />
    </div>
  );
};
