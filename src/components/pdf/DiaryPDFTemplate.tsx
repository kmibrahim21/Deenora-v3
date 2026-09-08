import React from 'react';
import { Institution } from '../../types';

interface DiaryPDFTemplateProps {
  madrasah: Institution | null;
  diary: {
    id?: string;
    title?: string;
    class_name?: string;
    message: string | any;
    created_at?: string;
  };
  lang?: 'en' | 'bn';
}

export const DiaryPDFTemplate: React.FC<DiaryPDFTemplateProps> = ({
  madrasah,
  diary,
  lang = 'bn'
}) => {
  const isBn = lang === 'bn';

  let parsed: any = {};
  if (typeof diary.message === 'string') {
    try {
      parsed = JSON.parse(diary.message);
    } catch (e) {
      parsed = { desc: diary.message };
    }
  } else {
    parsed = diary.message || {};
  }

  const getBanglaNumber = (str: string | number) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const bnDigits: { [key: string]: string } = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return s.replace(/[0-9]/g, d => bnDigits[d] || d);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate();
      const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
      const month = monthsBn[d.getMonth()];
      const year = d.getFullYear();
      const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      const dayName = daysBn[d.getDay()];
      return isBn ? `${dayName}, ${getBanglaNumber(day)} ${month}, ${getBanglaNumber(year)}` : d.toLocaleDateString('en-GB');
    } catch (e) {
      return dateStr;
    }
  };

  const rawClass = (diary.class_name || '').replace(/^APP_DIARY/i, '').trim();
  const className = parsed?.classGroup || parsed?.class || rawClass || 'নির্দিষ্ট শ্রেণি';
  const diaryDate = parsed?.date ? formatDate(parsed.date) : formatDate(diary.created_at || new Date().toISOString());
  const subjects: Array<{ subject: string; details: string }> = Array.isArray(parsed?.subjects)
    ? parsed.subjects
    : parsed?.activities || parsed?.homework
    ? [
        ...(parsed.activities ? [{ subject: 'ক্লাসের পড়া', details: parsed.activities }] : []),
        ...(parsed.homework ? [{ subject: 'বাড়ির কাজ', details: parsed.homework }] : [])
      ]
    : parsed?.desc
    ? [{ subject: 'দৈনিক পড়া', details: parsed.desc }]
    : [];

  const instType = (madrasah?.institution_type as string);
  const isIslamic = instType === 'madrasah' || instType === 'qawmi' || !instType;

  return (
    <div className="pdf-page-container w-[794px] min-h-[1123px] p-10 bg-white text-slate-900 font-noto relative flex flex-col justify-between box-border border border-slate-200 shadow-sm mx-auto my-0">
      
      {/* Outer Border */}
      <div className="absolute inset-4 border-2 border-slate-800 pointer-events-none rounded-md">
        <div className="absolute inset-1 border border-blue-200 pointer-events-none"></div>
      </div>

      <div className="relative z-10 px-3 pt-2">
        {/* Bismillah */}
        {isIslamic && (
          <div className="text-center mb-2">
            <p className="text-sm font-serif font-bold text-slate-700 tracking-wider">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
          </div>
        )}

        {/* Institution Header */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b-2 border-slate-800">
          {madrasah?.logo_url ? (
            <img 
              src={madrasah.logo_url} 
              alt="Logo" 
              className="w-16 h-16 object-contain rounded-full border border-slate-200 p-1 shadow-sm shrink-0" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md">
              {madrasah?.name?.charAt(0) || 'ড'}
            </div>
          )}

          <div className="flex-1 text-center px-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {madrasah?.name || 'শিক্ষা প্রতিষ্ঠান'}
            </h1>
            {madrasah?.address && (
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {madrasah.address}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-500 mt-1">
              {madrasah?.phone && <span>মোবাইল: {getBanglaNumber(madrasah.phone)}</span>}
              {madrasah?.contact_email && <span>ইমেইল: {madrasah.contact_email}</span>}
            </div>
          </div>

          <div className="w-16 shrink-0 text-right">
            <div className="inline-block p-1.5 border border-blue-300 rounded-lg bg-blue-50 text-[9px] font-black text-blue-800 text-center leading-tight">
              <span>দৈনিক</span><br />
              <span className="text-blue-950 font-black">ডায়েরি</span>
            </div>
          </div>
        </div>

        {/* Title Ribbon */}
        <div className="my-3 text-center">
          <div className="inline-block px-8 py-1.5 bg-blue-800 text-white rounded-lg shadow-sm border border-blue-900">
            <h2 className="text-sm font-black tracking-wider uppercase font-noto">
              দৈনিক পড়া ও বাড়ির কাজের ডায়েরি (DAILY DIARY)
            </h2>
          </div>
        </div>

        {/* Meta Bar */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">শ্রেণি:</span>
            <span className="text-slate-900 font-black bg-white px-2.5 py-0.5 rounded border border-slate-200">
              {className}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-slate-500 font-semibold">তারিখ:</span>
            <span className="text-slate-900 font-black bg-white px-2.5 py-0.5 rounded border border-slate-200">
              {diaryDate}
            </span>
          </div>
        </div>

        {diary.title && (
          <div className="mb-3 px-3 py-2 bg-blue-50/50 border-l-4 border-blue-600 rounded-r-lg">
            <h3 className="text-xs font-black text-blue-950">
              {diary.title}
            </h3>
          </div>
        )}

        {/* Subjects & Homework Table */}
        <div className="overflow-hidden rounded-xl border-2 border-slate-800 shadow-sm mb-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="py-2.5 px-3 font-black text-center w-12 border-r border-slate-700">নং</th>
                <th className="py-2.5 px-4 font-black w-44 border-r border-slate-700">বিষয় (Subject)</th>
                <th className="py-2.5 px-4 font-black">আজকের ক্লাসের পড়া ও বাড়ির কাজ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjects.length > 0 ? (
                subjects.map((sub, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-3 px-2 font-bold text-center text-slate-700 border-r border-slate-200 align-top">
                      {getBanglaNumber(idx + 1)}
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900 border-r border-slate-200 align-top">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                        <span>{sub.subject || 'সাধারণ বিষয়'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium leading-relaxed align-top">
                      <div className="whitespace-pre-wrap leading-5 text-[11px]">
                        {sub.details || '-'}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400 font-medium italic">
                    আজকের ডায়েরির কোনো বিষয় পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Special Note / Instructions */}
        {parsed.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-2 text-xs">
            <p className="font-black text-amber-950 mb-0.5">বিশেষ দ্রষ্টব্য / শিক্ষক নির্দেশ:</p>
            <p className="text-[11px] text-amber-900 whitespace-pre-wrap leading-relaxed">{parsed.note}</p>
          </div>
        )}

      </div>

      {/* Footer Signatures */}
      <div className="relative z-10 px-3 pt-4 border-t border-slate-200 mt-auto">
        <div className="grid grid-cols-2 items-end gap-12 text-center">
          <div className="space-y-1">
            <div className="h-10 flex items-end justify-center">
              <div className="w-36 border-b border-slate-400 border-dashed"></div>
            </div>
            <p className="text-xs font-bold text-slate-800">অভিভাবকের স্বাক্ষর</p>
            <p className="text-[10px] text-slate-500">গৃহশিক্ষক / পিতা / মাতা</p>
          </div>

          <div className="space-y-1">
            <div className="h-10 flex items-end justify-center">
              <div className="w-36 border-b-2 border-slate-800"></div>
            </div>
            <p className="text-xs font-black text-slate-900">শ্রেণি শিক্ষকের স্বাক্ষর</p>
            <p className="text-[10px] font-bold text-slate-600">{madrasah?.name}</p>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-semibold text-slate-400">
          <span>দৈনিক পড়ালেখা মূল্যায়ন ও ডায়েরি</span>
          <span>প্রিন্টের সময়: {new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-GB')}</span>
        </div>
      </div>

    </div>
  );
};
