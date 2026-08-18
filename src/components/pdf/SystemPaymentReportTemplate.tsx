import React from 'react';

interface SystemPaymentReportProps {
  period: string;
  lang: 'en' | 'bn';
  report: {
    smsRechargeTotal: number;
    voiceRechargeTotal: number;
    subRechargeTotal: number;
    smsSentNum: number;
    voiceCallsNum: number;
    transactions: any[];
  };
}

export const SystemPaymentReportTemplate: React.FC<SystemPaymentReportProps> = ({ period, lang = 'bn', report }) => {
  const isBangla = lang === 'bn';
  
  const t = {
    title: isBangla ? 'সিস্টেম সাবস্ক্রিপশন পেমেন্ট হিস্ট্রি' : 'System Subscription Payment History',
    period: isBangla ? 'সময়কাল' : 'Period',
    date: isBangla ? 'তৈরির তারিখ' : 'Generation Date',
    summary: isBangla ? 'আয় ও ব্যবহার সারসংক্ষেপ' : 'Revenue & Usage Summary',
    subRecharge: isBangla ? 'সাবস্ক্রিপশন ফি' : 'Subscription Fees',
    smsRecharge: isBangla ? 'SMS রিচার্জ' : 'SMS Recharges',
    voiceRecharge: isBangla ? 'VOICE রিচার্জ' : 'VOICE Recharges',
    totalSMS: isBangla ? 'মোট পাঠানো SMS' : 'Total Sent SMS',
    totalVoice: isBangla ? 'মোট ভয়েস কল' : 'Total Voice Calls',
    payments: isBangla ? 'সাবস্ক্রিপশন ফি পেমেন্ট লেনদেনের বিস্তারিত বিবরণ' : 'Detailed Subscription Fee Transactions',
    sl: isBangla ? 'ক্রঃ নং' : 'SL',
    txDate: isBangla ? 'তারিখ' : 'Date',
    institution: isBangla ? 'প্রতিষ্ঠানের নাম' : 'Institution',
    description: isBangla ? 'বিবরণ' : 'Description',
    module: isBangla ? 'মডিউল' : 'Module',
    amount: isBangla ? 'পরিমাণ' : 'Amount',
    signature: isBangla ? 'সুপার এডমিন স্বাক্ষর' : 'Super Admin Signature',
    totalRevenue: isBangla ? 'সর্বমোট আয়' : 'Total Revenue'
  };

  const totalRevenue = (report.subRechargeTotal || 0) + (report.smsRechargeTotal || 0) + (report.voiceRechargeTotal || 0);

  // Filter transactions to show ONLY subscription fees as requested by the user
  const filteredTransactions = (report.transactions || []).filter(tr => {
    const desc = (tr.description || '').toLowerCase();
    const mod = (tr.module || '').toLowerCase();
    const isRefund = desc.includes('refund');
    if (isRefund) return false;
    if (mod === 'subscription') return true;
    if (mod === 'voice') return false;
    if (mod === 'sms') return false;
    return desc.includes('subscription') || desc.includes('মাসিক ফি') || desc.includes('সাবস্ক্রিপশন');
  });

  // Pagination bounds
  const FIRST_PAGE_LIMIT = 8;
  const SUBSEQUENT_PAGE_LIMIT = 18;

  const pagesData: any[][] = [];
  if (filteredTransactions.length > 0) {
    // First page
    pagesData.push(filteredTransactions.slice(0, FIRST_PAGE_LIMIT));
    // Subsequent pages
    let index = FIRST_PAGE_LIMIT;
    while (index < filteredTransactions.length) {
      pagesData.push(filteredTransactions.slice(index, index + SUBSEQUENT_PAGE_LIMIT));
      index += SUBSEQUENT_PAGE_LIMIT;
    }
  } else {
    pagesData.push([]);
  }

  return (
    <>
      {pagesData.map((pageTransactions, pageIdx) => {
        // Calculate dynamic serial number offset for table
        const slOffset = pageIdx === 0 ? 0 : FIRST_PAGE_LIMIT + (pageIdx - 1) * SUBSEQUENT_PAGE_LIMIT;

        return (
          <div 
            key={pageIdx} 
            className="w-[794px] min-h-[1123px] p-12 bg-white font-noto text-slate-800 relative flex flex-col mb-4" 
            style={{ boxSizing: 'border-box' }}
          >
            {/* Decorative Border */}
            <div className="absolute inset-4 border-2 border-slate-100 pointer-events-none rounded-sm" />

            {pageIdx === 0 ? (
              // --- FIRST PAGE HEADER & META ---
              <>
                <div className="text-center mb-10 relative">
                  <div className="inline-block px-6 py-2 bg-blue-50 rounded-2xl mb-4">
                    <h1 className="text-2xl font-black text-blue-900 tracking-tight">দীনোরা সিস্টেম এডমিন প্যানেল</h1>
                  </div>
                  <h2 className="text-lg font-black text-slate-600 uppercase tracking-wider mb-1">{t.title}</h2>
                  <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full" />
                </div>

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

                {/* Summary Section */}
                <div className="mb-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{t.summary}</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                       <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">{t.subRecharge}</p>
                       <p className="text-base font-black text-slate-800">৳ {(report.subRechargeTotal || 0).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                       <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">{t.smsRecharge}</p>
                       <p className="text-base font-black text-slate-800">৳ {(report.smsRechargeTotal || 0).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                       <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">{t.voiceRecharge}</p>
                       <p className="text-base font-black text-slate-800">৳ {(report.voiceRechargeTotal || 0).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                       <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-1">{t.totalSMS}</p>
                       <p className="text-base font-black text-slate-800">{(report.smsSentNum || 0).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                       <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">{t.totalVoice}</p>
                       <p className="text-base font-black text-slate-800">{(report.voiceCallsNum || 0).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                       <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">{t.totalRevenue}</p>
                       <p className="text-base font-black text-indigo-700">৳ {totalRevenue.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // --- SUBSEQUENT PAGES MINI-HEADER ---
              <div className="flex justify-between items-center border-b pb-4 mb-6 relative">
                <div className="text-left">
                  <h1 className="text-base font-black text-blue-900 tracking-tight">দীনোরা সিস্টেম এডমিন প্যানেল</h1>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-700">{period}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">পাতা {pageIdx + 1} / {pagesData.length}</p>
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="flex-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{t.payments}</h3>
              {pageTransactions.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm font-black text-slate-400">{isBangla ? 'কোনো সাবস্ক্রিপশন লেনদেনের তথ্য পাওয়া যায়নি' : 'No subscription transactions found'}</p>
                </div>
              ) : (
                <table className="w-full border-collapse rounded-xl overflow-hidden border border-slate-200">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="border-r border-slate-700 p-2.5 text-[10px] font-black uppercase text-center w-10">{t.sl}</th>
                      <th className="border-r border-slate-700 p-2.5 text-[10px] font-black uppercase text-left w-24">{t.txDate}</th>
                      <th className="border-r border-slate-700 p-2.5 text-[10px] font-black uppercase text-left">{t.institution}</th>
                      <th className="border-r border-slate-700 p-2.5 text-[10px] font-black uppercase text-left">{t.description}</th>
                      <th className="border-r border-slate-700 p-2.5 text-[10px] font-black uppercase text-center w-20">{t.module}</th>
                      <th className="p-2.5 text-[10px] font-black uppercase text-right w-24">{t.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTransactions.map((tr, index) => (
                      <tr key={tr.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="border-r border-slate-100 p-2 text-[10px] font-bold text-center text-slate-400">{slOffset + index + 1}</td>
                        <td className="border-r border-slate-100 p-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                          {new Date(tr.created_at).toLocaleDateString(isBangla ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="border-r border-slate-100 p-2 text-[11px] font-black text-slate-700">
                          {tr.institutions?.name || 'Unknown Institution'}
                        </td>
                        <td className="border-r border-slate-100 p-2">
                          <div className="text-[10px] font-bold text-slate-600 leading-tight">{tr.description}</div>
                          {tr.transaction_id && (
                            <div className="text-[8px] font-mono text-slate-400 mt-0.5">ID: {tr.transaction_id}</div>
                          )}
                        </td>
                        <td className="border-r border-slate-100 p-2 text-center">
                          <span className="text-[8px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-600 uppercase tracking-wider">
                            {tr.module || 'subscription'}
                          </span>
                        </td>
                        <td className="p-2 text-[11px] font-black text-right text-emerald-600">
                          ৳ {(Number(tr.amount) || 0).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-10 flex justify-between items-end">
              <div className="text-[10px] text-slate-300 font-bold italic uppercase tracking-widest">
                Deenora System Dashboard Report - Page {pageIdx + 1} of {pagesData.length}
              </div>
              <div className="text-center relative">
                <div className="w-48 h-px bg-slate-300 mb-2" />
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.signature}</p>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
