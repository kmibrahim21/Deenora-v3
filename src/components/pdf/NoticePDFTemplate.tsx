import React from 'react';
import { Institution } from '../../types';

interface NoticePDFTemplateProps {
  madrasah: Institution | null;
  notice: {
    id?: string;
    title: string;
    message: string | any;
    class_name?: string;
    created_at?: string;
    author_name?: string;
    author_role?: string;
  };
  lang?: 'en' | 'bn';
  themeColor?: string;
}

export const NoticePDFTemplate: React.FC<NoticePDFTemplateProps> = ({
  madrasah,
  notice,
  lang = 'bn',
  themeColor = '#0f172a'
}) => {
  const isBn = lang === 'bn';

  let parsed: any = {};
  if (typeof notice.message === 'string') {
    try {
      parsed = JSON.parse(notice.message);
    } catch (e) {
      parsed = { desc: notice.message };
    }
  } else {
    parsed = notice.message || {};
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
      return isBn ? `${getBanglaNumber(day)} ${month}, ${getBanglaNumber(year)}` : d.toLocaleDateString('en-GB');
    } catch (e) {
      return dateStr;
    }
  };

  // Determine notice category title & styling
  const rawType = (notice.class_name || '').toUpperCase();
  let categoryLabel = 'জরুরি বিজ্ঞপ্তি';
  let categoryTheme = 'border-slate-800 text-slate-900 bg-slate-100';
  let bannerColor = 'from-slate-800 to-slate-950';

  if (rawType === 'APP_HOLIDAY' || rawType.includes('HOLIDAY')) {
    categoryLabel = 'ছুটির বিজ্ঞপ্তি';
    categoryTheme = 'border-emerald-800 text-emerald-900 bg-emerald-50';
    bannerColor = 'from-emerald-800 to-emerald-950';
  } else if (rawType === 'APP_PTM' || rawType.includes('PTM') || rawType.includes('MEETING')) {
    categoryLabel = 'অভিভাবক সমাবেশ / মিটিং বিজ্ঞপ্তি';
    categoryTheme = 'border-indigo-800 text-indigo-900 bg-indigo-50';
    bannerColor = 'from-indigo-800 to-indigo-950';
  } else if (rawType === 'APP_EXAM' || rawType.includes('EXAM')) {
    categoryLabel = 'পরীক্ষা সংক্রান্ত বিজ্ঞপ্তি';
    categoryTheme = 'border-purple-800 text-purple-900 bg-purple-50';
    bannerColor = 'from-purple-800 to-purple-950';
  } else if (rawType.includes('FEES') || rawType.includes('FEE')) {
    categoryLabel = 'ফি ও বকেয়া সংক্রান্ত বিজ্ঞপ্তি';
    categoryTheme = 'border-amber-800 text-amber-900 bg-amber-50';
    bannerColor = 'from-amber-800 to-amber-950';
  }

  const targetClass = parsed?.target_class || parsed?.class || (
    notice.class_name && !notice.class_name.startsWith('APP_') ? notice.class_name : 'সকল শিক্ষার্থী ও সম্মানিত অভিভাবকবৃন্দ'
  );

  const noticeDate = parsed?.date ? formatDate(parsed.date) : formatDate(notice.created_at || new Date().toISOString());
  const refNo = parsed?.ref_no || `স্মারক নং: ${madrasah?.id?.substring(0, 4) || 'NOT'}/${new Date().getFullYear()}/${(notice.id || '101').substring(0, 4)}`;

  const instType = (madrasah?.institution_type as string);
  const isIslamic = instType === 'madrasah' || instType === 'qawmi' || !instType;

  return (
    <div className="pdf-page-container w-[794px] min-h-[1123px] p-12 bg-white text-slate-900 font-noto relative flex flex-col justify-between box-border border border-slate-200 shadow-sm mx-auto my-0">
      
      {/* Decorative Outer Certificate/Official Frame */}
      <div className="absolute inset-4 border-2 border-slate-800 pointer-events-none rounded-md">
        <div className="absolute inset-1 border border-slate-300 pointer-events-none"></div>
      </div>

      {/* Decorative Corner Ornaments */}
      <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-slate-900 pointer-events-none"></div>
      <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-slate-900 pointer-events-none"></div>
      <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-slate-900 pointer-events-none"></div>
      <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-slate-900 pointer-events-none"></div>

      {/* Main Content Area */}
      <div className="relative z-10 px-4 pt-2">

        {/* Islamic Header (Bismillah) */}
        {isIslamic && (
          <div className="text-center mb-2">
            <p className="text-sm font-serif font-bold text-slate-700 tracking-wider">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
            <p className="text-[10px] text-slate-500 font-semibold">পরম করুণাময় অসীম দয়ালু আল্লাহর নামে শুরু করছি</p>
          </div>
        )}

        {/* Institution Letterhead Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b-2 border-slate-800">
          {madrasah?.logo_url ? (
            <img 
              src={madrasah.logo_url} 
              alt="Logo" 
              className="w-20 h-20 object-contain rounded-full border border-slate-200 p-1 shadow-sm shrink-0" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-md">
              {madrasah?.name?.charAt(0) || 'ম'}
            </div>
          )}

          <div className="flex-1 text-center px-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {madrasah?.name || 'শিক্ষা প্রতিষ্ঠান'}
            </h1>
            {madrasah?.address && (
              <p className="text-xs font-semibold text-slate-600 mt-1">
                {madrasah.address}
              </p>
            )}
            <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-slate-500 mt-1">
              {madrasah?.phone && <span>মোবাইল: {getBanglaNumber(madrasah.phone)}</span>}
              {madrasah?.contact_email && <span>ইমেইল: {madrasah.contact_email}</span>}
              {(madrasah as any)?.code && <span>EIIN / কোড: {getBanglaNumber((madrasah as any).code)}</span>}
            </div>
          </div>

          <div className="w-16 shrink-0 text-right">
            <div className="inline-block p-1.5 border border-slate-300 rounded bg-slate-50 text-[9px] font-bold text-slate-500 text-center leading-tight">
              <span>অফিসিয়াল</span><br />
              <span className="text-slate-800 font-black">বিজ্ঞপ্তি</span>
            </div>
          </div>
        </div>

        {/* Notice Meta Bar: Ref No and Date */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 py-3 border-b border-slate-200">
          <div>
            <span className="text-slate-500 font-semibold">{refNo}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-semibold">তারিখ: </span>
            <span className="text-slate-900 font-black">{noticeDate}</span>
          </div>
        </div>

        {/* Notice Title Ribbon Badge */}
        <div className="my-5 text-center">
          <div className="inline-block relative">
            <div className="px-8 py-2 bg-slate-900 text-white rounded-lg shadow-md border-2 border-slate-800">
              <span className="text-base font-black tracking-wider uppercase font-noto">
                {categoryLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Target Audience / Recipient Line */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-5 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-500">প্রাপক / আওতাভুক্ত: </span>
            <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 ml-1">
              {targetClass}
            </span>
          </div>
          {parsed?.author && (
            <div className="text-slate-600 font-semibold">
              প্রকাশক: <span className="font-bold text-slate-900">{parsed.author}</span>
            </div>
          )}
        </div>

        {/* Subject Heading */}
        <div className="mb-4 pb-2 border-b border-dashed border-slate-300">
          <h2 className="text-lg font-black text-slate-900 leading-snug">
            <span className="text-slate-600 font-bold">বিষয়: </span>
            {notice.title}
          </h2>
        </div>

        {/* Notice Body Content */}
        <div className="space-y-4 text-[13px] leading-relaxed text-slate-800 text-justify font-normal min-h-[300px]">
          {parsed.desc ? (
            <div className="whitespace-pre-wrap leading-7 text-slate-800 font-medium">
              {parsed.desc}
            </div>
          ) : (
            <p className="text-slate-500 italic">কোনো বিবরণ পাওয়া যায়নি।</p>
          )}

          {/* Activities / Class details if any */}
          {parsed.activities && (
            <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
              <p className="text-xs font-black text-blue-900 mb-1">কার্যক্রম ও সূচি:</p>
              <p className="text-xs text-blue-800 whitespace-pre-wrap leading-relaxed">{parsed.activities}</p>
            </div>
          )}

          {/* Homework / Student task if any */}
          {parsed.homework && (
            <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <p className="text-xs font-black text-emerald-900 mb-1">বাড়ির কাজ / প্রস্তুতি:</p>
              <p className="text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed">{parsed.homework}</p>
            </div>
          )}

          {/* Important Note Box */}
          {parsed.note && (
            <div className="mt-4 p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
              <p className="text-xs font-black text-amber-900 mb-0.5">বিশেষ দ্রষ্টব্য / জরুরি নির্দেশ:</p>
              <p className="text-xs text-amber-900 font-medium whitespace-pre-wrap leading-relaxed">{parsed.note}</p>
            </div>
          )}
        </div>

      </div>

      {/* Signature and Seal Section */}
      <div className="relative z-10 px-4 pt-6 border-t border-slate-200 mt-auto">
        <div className="grid grid-cols-3 items-end gap-6 text-center">
          {/* Left Signature */}
          <div className="space-y-1">
            <div className="h-12 flex items-end justify-center">
              <div className="w-32 border-b border-slate-400 border-dashed"></div>
            </div>
            <p className="text-xs font-bold text-slate-800">প্রস্তুতকারক / সহকারী</p>
            <p className="text-[10px] text-slate-500">নোটিশ শাখা</p>
          </div>

          {/* Center Official Seal */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] font-bold text-center p-2 leading-tight">
              প্রতিষ্ঠান প্রধানের<br />অফিসিয়াল সিল
            </div>
          </div>

          {/* Right Principal / Muhtamim Signature */}
          <div className="space-y-1">
            <div className="h-12 flex items-end justify-center">
              <div className="w-36 border-b-2 border-slate-800"></div>
            </div>
            <p className="text-xs font-black text-slate-900">
              {isIslamic ? 'মুহতামিম / অধ্যক্ষ' : 'প্রধান শিক্ষক / অধ্যক্ষ'}
            </p>
            <p className="text-[10px] font-bold text-slate-600">{madrasah?.name}</p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-semibold text-slate-400">
          <span>কম্পিউটার জেনারেটেড কপি — কোনো ধরনের কাটাকাটি গ্রহণযোগ্য নয়</span>
          <span>প্রিন্টের সময়: {new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-GB')} {new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

    </div>
  );
};
