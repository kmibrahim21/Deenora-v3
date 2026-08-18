import React from 'react';

interface SubscriptionMatrixProps {
  year: string;
  lang: 'en' | 'bn';
  institutions: any[];
}

const bnMonths = [
  { key: '01', name: 'জানু' },
  { key: '02', name: 'ফেব্রু' },
  { key: '03', name: 'মার্চ' },
  { key: '04', name: 'এপ্রিল' },
  { key: '05', name: 'মে' },
  { key: '06', name: 'জুন' },
  { key: '07', name: 'জুলাই' },
  { key: '08', name: 'আগস্ট' },
  { key: '09', name: 'সেপ্টে' },
  { key: '10', name: 'অক্টো' },
  { key: '11', name: 'নভে' },
  { key: '12', name: 'ডিসে' }
];

const enMonths = [
  { key: '01', name: 'Jan' },
  { key: '02', name: 'Feb' },
  { key: '03', name: 'Mar' },
  { key: '04', name: 'Apr' },
  { key: '05', name: 'May' },
  { key: '06', name: 'Jun' },
  { key: '07', name: 'Jul' },
  { key: '08', name: 'Aug' },
  { key: '09', name: 'Sep' },
  { key: '10', name: 'Oct' },
  { key: '11', name: 'Nov' },
  { key: '12', name: 'Dec' }
];

export const SubscriptionMatrixTemplate: React.FC<SubscriptionMatrixProps> = ({ year, lang = 'bn', institutions }) => {
  const isBangla = lang === 'bn';
  const months = isBangla ? bnMonths : enMonths;

  const t = {
    title: isBangla ? 'প্রতিষ্ঠান সাবস্ক্রিপশন পেমেন্ট স্ট্যাটাস রিপোর্ট' : 'Institution Subscription Payment Status Report',
    yearLabel: isBangla ? 'বছর' : 'Year',
    date: isBangla ? 'তৈরির তারিখ' : 'Generation Date',
    summary: isBangla ? 'সাবস্ক্রিপশন সংক্ষিপ্ত বিবরণী' : 'Subscription Summary',
    totalInstitutions: isBangla ? 'মোট রেজিস্টার্ড প্রতিষ্ঠান' : 'Total Institutions',
    totalFullyPaid: isBangla ? 'সম্পূর্ণ পরিশোধিত (১২ মাস)' : 'Fully Paid (12 Months)',
    totalWithDues: isBangla ? 'বকেয়া আছে এমন প্রতিষ্ঠান' : 'Institutions with Dues',
    sl: isBangla ? 'ক্রঃ নং' : 'SL',
    institution: isBangla ? 'প্রতিষ্ঠানের নাম' : 'Institution',
    matrixHeader: isBangla ? '১২ মাসের পেমেন্ট বিবরণী (সবুজ = পরিশোধিত, লাল = বকেয়া)' : '12-Month Payment Matrix (Green = Paid, Red = Unpaid)',
    ratioHeader: isBangla ? 'পরিশোধের অনুপাত' : 'Paid Ratio',
    signature: isBangla ? 'সুপার এডমিন স্বাক্ষর' : 'Super Admin Signature',
    activeLabel: isBangla ? 'সক্রিয়' : 'Active',
    inactiveLabel: isBangla ? 'নিষ্ক্রিয়' : 'Inactive'
  };

  const getPaidMonthsForYear = (inst: any): string[] => {
    if (!inst) return [];
    let config: any = inst.config_json;
    if (typeof config === 'string') {
      try { 
        config = JSON.parse(config); 
      } catch (e) { 
        config = {}; 
      }
    }
    const rawPaidMonths = config?.paid_months || config?.subscription?.paid_months || [];
    const paidMonths = Array.isArray(rawPaidMonths) ? rawPaidMonths : [];
    
    // Filter paid months by the requested year (format YYYY-MM)
    return paidMonths
      .filter((m: any) => typeof m === 'string' && m.startsWith(`${year}-`))
      .map((m: string) => {
        const parts = m.split('-');
        return parts.length > 1 ? parts[1] : '';
      })
      .filter(Boolean);
  };

  // Pre-process institutions data for reporting
  const instList = Array.isArray(institutions) ? institutions.filter(Boolean) : [];
  const processedData = instList.map(inst => {
    const paidMonthKeys = getPaidMonthsForYear(inst);
    const paid = months.filter(m => paidMonthKeys.includes(m.key));
    const unpaid = months.filter(m => !paidMonthKeys.includes(m.key));
    
    let configObj: any = inst.config_json;
    if (typeof configObj === 'string') {
      try { 
        configObj = JSON.parse(configObj); 
      } catch (e) { 
        configObj = {}; 
      }
    }
    const code = configObj?.institute_code || inst.institute_code || 'N/A';
    
    return {
      id: inst.id,
      name: inst.name || 'Unnamed Institution',
      code,
      status: inst.status || 'active',
      paid,
      unpaid,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
    };
  });

  // Calculate summary stats
  const totalInsts = processedData.length;
  const fullyPaidCount = processedData.filter(d => d.paidCount === 12).length;
  const withDuesCount = totalInsts - fullyPaidCount;

  // Pagination constants - Adjusted for ultra safe heights with single-lined uniform cells
  const FIRST_PAGE_LIMIT = 12;
  const SUBSEQUENT_PAGE_LIMIT = 17;

  const pagesData: any[][] = [];
  if (processedData.length > 0) {
    // First page
    pagesData.push(processedData.slice(0, FIRST_PAGE_LIMIT));
    // Subsequent pages
    let index = FIRST_PAGE_LIMIT;
    while (index < processedData.length) {
      pagesData.push(processedData.slice(index, index + SUBSEQUENT_PAGE_LIMIT));
      index += SUBSEQUENT_PAGE_LIMIT;
    }
  } else {
    pagesData.push([]);
  }

  return (
    <>
      {pagesData.map((pageData, pageIdx) => {
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
              // --- FIRST PAGE HEADER ---
              <>
                <div className="text-center mb-8 relative">
                  <div className="inline-block px-6 py-2 bg-blue-50 rounded-2xl mb-3">
                    <h1 className="text-2xl font-black text-blue-900 tracking-tight">দীনোরা সিস্টেম এডমিন প্যানেল</h1>
                  </div>
                  <h2 className="text-base font-black text-slate-600 uppercase tracking-wider mb-1">{t.title}</h2>
                  <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full" />
                </div>

                <div className="grid grid-cols-2 gap-8 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.yearLabel}:</span>
                    <span className="text-sm font-black text-slate-700">{year} {isBangla ? 'সাল' : ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.date}:</span>
                    <span className="text-sm font-black text-slate-700">{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
                  </div>
                </div>

                {/* Summary Statistics Card */}
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{t.summary}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.totalInstitutions}</p>
                      <p className="text-base font-black text-slate-800">{totalInsts.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">{t.totalFullyPaid}</p>
                      <p className="text-base font-black text-emerald-700">{fullyPaidCount.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">{t.totalWithDues}</p>
                      <p className="text-base font-black text-amber-700">{withDuesCount.toLocaleString(isBangla ? 'bn-BD' : 'en-US')}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // --- SUBSEQUENT PAGES MINI HEADER ---
              <div className="flex justify-between items-center border-b pb-4 mb-6 relative">
                <div className="text-left">
                  <h1 className="text-base font-black text-blue-900 tracking-tight">দীনোরা সিস্টেম এডমিন প্যানেল</h1>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-700">{year} {isBangla ? 'সাল' : ''}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">পাতা {pageIdx + 1} / {pagesData.length}</p>
                </div>
              </div>
            )}

            {/* Matrix Table */}
            <div className="flex-1">
              <table className="w-full border-collapse rounded-xl overflow-hidden border border-slate-200" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-slate-900 text-white h-10">
                    <th className="border-r border-slate-700 p-1.5 text-[9px] font-black uppercase text-center w-10">{t.sl}</th>
                    <th className="border-r border-slate-700 p-1.5 text-[9px] font-black uppercase text-left w-44">{t.institution}</th>
                    <th className="border-r border-slate-700 p-1.5 text-[9px] font-black uppercase text-center">{t.matrixHeader}</th>
                    <th className="p-1.5 text-[9px] font-black uppercase text-center w-20">{t.ratioHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center bg-slate-50 text-sm font-black text-slate-400">
                        {isBangla ? 'কোনো প্রতিষ্ঠানের তথ্য পাওয়া যায়নি' : 'No institution details found'}
                      </td>
                    </tr>
                  ) : (
                    pageData.map((d, index) => (
                      <tr key={d.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} h-12`}>
                        <td className="border-r border-slate-100 p-1 text-[10px] font-bold text-center text-slate-400 w-10">{slOffset + index + 1}</td>
                        <td className="border-r border-slate-100 p-1.5 w-44">
                          <p className="text-[10px] font-black text-slate-800 leading-tight truncate" style={{ maxWidth: '160px' }}>{d.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[7px] font-mono text-slate-400">ID: {d.code}</span>
                            <span className={`text-[6px] font-black uppercase px-1 py-0.2 rounded-sm ${d.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {d.status === 'active' ? t.activeLabel : t.inactiveLabel}
                            </span>
                          </div>
                        </td>
                        <td className="border-r border-slate-100 p-1.5">
                          <div className="grid grid-cols-12 gap-1">
                            {months.map((m) => {
                              const isPaid = d.paid.some((p: any) => p.key === m.key);
                              return (
                                <div 
                                  key={m.key} 
                                  className={`py-1 text-center text-[8px] font-black rounded border whitespace-nowrap flex items-center justify-center transition-colors ${
                                    isPaid 
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' 
                                      : 'bg-rose-500 text-white border-rose-600 shadow-sm'
                                  }`}
                                >
                                  {m.name}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-1.5 text-center w-20">
                          <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-lg ${d.paidCount === 12 ? 'bg-emerald-100 text-emerald-800' : d.paidCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                            {d.paidCount.toLocaleString(isBangla ? 'bn-BD' : 'en-US')} / {Number(12).toLocaleString(isBangla ? 'bn-BD' : 'en-US')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-10 flex justify-between items-end">
              <div className="text-[10px] text-slate-300 font-bold italic uppercase tracking-widest">
                Deenora Subscription Matrix - Page {pageIdx + 1} of {pagesData.length}
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
