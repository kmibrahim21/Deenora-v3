import React from 'react';

interface AccountingReportProps {
  madrasah: any;
  lang: 'en' | 'bn';
  period: string;
  stats: {
    expected_income: number;
    prediction: number;
    total_expense: number;
    total_income: number;
    net_income: number;
    collection_rate: string | number;
  };
  breakdown: any[];
  ledger: any[];
}

export const AccountingReportTemplate: React.FC<AccountingReportProps> = ({ madrasah, lang, period, stats, breakdown, ledger }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'হিসাব ও ফি রিপোর্ট' : 'Accounting & Fee Report',
    period: isBangla ? 'সময়কাল' : 'Period',
    summary: isBangla ? 'সারসংক্ষেপ' : 'Summary',
    expected: isBangla ? 'প্রত্যাশিত ফি' : 'Expected Fee',
    collected: isBangla ? 'সংগৃহীত ফি' : 'Collected Fee',
    totalIncome: isBangla ? 'মোট আয়' : 'Total Income',
    expense: isBangla ? 'মোট ব্যয়' : 'Total Expense',
    net: isBangla ? 'নিট আয়' : 'Net Income',
    rate: isBangla ? 'সংগ্রহের হার' : 'Collection Rate',
    breakdown: isBangla ? 'ফি ব্রেকডাউন' : 'Fee Breakdown',
    ledger: isBangla ? 'অন্যান্য লেনদেনের ইতিহাস' : 'Other Transactions History',
    feeName: isBangla ? 'ফির নাম' : 'Fee Name',
    students: isBangla ? 'শিক্ষার্থী' : 'Students',
    paid: isBangla ? 'পরিশোধ' : 'Paid',
    due: isBangla ? 'বকেয়া' : 'Due',
    sl: isBangla ? 'নং' : 'SL',
    date: isBangla ? 'তারিখ' : 'Date',
    category: isBangla ? 'ক্যাটাগরি' : 'Category',
    description: isBangla ? 'বিবরণ' : 'Description',
    amount: isBangla ? 'পরিমাণ' : 'Amount',
    type: isBangla ? 'ধরণ' : 'Type',
    signature: isBangla ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authorized Signature',
  };

  // Filter out student fees from ledger to show only manual entries as requested
  const manualEntries = ledger.filter(entry => entry.category !== 'Student Fee');

  return (
    <div className="w-[794px] min-h-[1123px] p-12 bg-white font-noto text-slate-800 relative flex flex-col">
      {/* Decorative Border */}
      <div className="absolute inset-4 border-2 border-slate-100 pointer-events-none rounded-sm" />
      
      {/* Header */}
      <div className="text-center mb-10 relative">
        <div className="inline-block px-6 py-2 bg-blue-50 rounded-2xl mb-4">
          <h1 className="text-3xl font-black text-blue-900 tracking-tight">{madrasah.name}</h1>
        </div>
        <h2 className="text-xl font-bold text-slate-600 uppercase tracking-[0.2em] mb-1">{t.title}</h2>
        <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full" />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.period}:</span>
          <span className="text-sm font-black text-slate-700">{period}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.date}:</span>
          <span className="text-sm font-black text-slate-700">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
        </div>
      </div>

  {/* Summary Cards */}
  <div className="grid grid-cols-2 gap-4 mb-8">
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.expected}</p>
       <p className="text-lg font-black text-blue-600">৳{stats.expected_income?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
    </div>
    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
       <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">{t.collected}</p>
       <p className="text-lg font-black text-blue-600">৳{stats.prediction?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
    </div>
    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
       <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t.totalIncome}</p>
       <p className="text-lg font-black text-emerald-600">৳{stats.total_income?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
    </div>
    <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
       <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">{t.expense}</p>
       <p className="text-lg font-black text-red-600">৳{stats.total_expense?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
    </div>
    <div className={`p-4 rounded-2xl border ${stats.net_income >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
       <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${stats.net_income >= 0 ? 'text-indigo-400' : 'text-orange-400'}`}>{t.net}</p>
       <p className={`text-lg font-black ${stats.net_income >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>৳{stats.net_income?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
    </div>
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.rate}</p>
       <p className="text-lg font-black text-slate-600">{stats.collection_rate}%</p>
    </div>
  </div>

      {/* Breakdown Table */}
      <div className="mb-8">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">{t.breakdown}</h3>
        <table className="w-full border-collapse rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-center w-10">{t.sl}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-left">{t.feeName}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-center">{t.students}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-right">{t.expected}</th>
              <th className="border-r border-slate-700 p-2 text-[10px] font-black uppercase text-right">{t.collected}</th>
              <th className="p-2 text-[10px] font-black uppercase text-right">{t.due}</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="border-r border-slate-100 p-2 text-xs font-bold text-center text-slate-400">{index + 1}</td>
                <td className="border-r border-slate-100 p-2 text-xs font-black text-slate-700">{item.name}</td>
                <td className="border-r border-slate-100 p-2 text-xs font-bold text-center">{item.students}</td>
                <td className="border-r border-slate-100 p-2 text-xs font-bold text-right">৳{item.expected?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</td>
                <td className="border-r border-slate-100 p-2 text-xs font-bold text-right text-emerald-600">৳{item.collected?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</td>
                <td className="p-2 text-xs font-bold text-right text-red-600">৳{Math.max(0, item.expected - item.collected).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manual Transactions Ledger */}
      {manualEntries.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">{t.ledger}</h3>
          <table className="w-full border-collapse rounded-xl overflow-hidden shadow-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="border-r border-slate-600 p-2 text-[10px] font-black uppercase text-center w-10">{t.sl}</th>
                <th className="border-r border-slate-600 p-2 text-[10px] font-black uppercase text-left w-24">{t.date}</th>
                <th className="border-r border-slate-600 p-2 text-[10px] font-black uppercase text-left">{t.category} / {t.description}</th>
                <th className="border-r border-slate-600 p-2 text-[10px] font-black uppercase text-center w-20">{t.type}</th>
                <th className="p-2 text-[10px] font-black uppercase text-right w-28">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {manualEntries.map((entry, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="border-r border-slate-100 p-2 text-[10px] font-bold text-center text-slate-400">{index + 1}</td>
                  <td className="border-r border-slate-100 p-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                    {new Date(entry.transaction_date).toLocaleDateString(isBangla ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="border-r border-slate-100 p-2">
                    <div className="text-[11px] font-black text-slate-700 leading-tight">{entry.category}</div>
                    {entry.description && (
                      <div className="text-[9px] text-slate-400 font-bold mt-0.5 line-clamp-1">{entry.description}</div>
                    )}
                  </td>
                  <td className="border-r border-slate-100 p-2 text-center">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${entry.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {entry.type === 'income' ? (isBangla ? 'আয়' : 'In') : (isBangla ? 'ব্যয়' : 'Out')}
                    </span>
                  </td>
                  <td className={`p-2 text-[11px] font-black text-right ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    ৳{entry.amount?.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-10 flex justify-between items-end">
        <div className="text-[10px] text-slate-300 font-bold italic uppercase tracking-widest">
          Accounting Summary Report
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
