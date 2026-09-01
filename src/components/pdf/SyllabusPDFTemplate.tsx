import React from 'react';
import { Institution } from '../../types';

interface SyllabusPDFTemplateProps {
  madrasah: Institution | null;
  syllabus: {
    id?: string;
    title?: string;
    class_name?: string;
    message: string | any;
    created_at?: string;
  };
  lang?: 'en' | 'bn';
}

export const SyllabusPDFTemplate: React.FC<SyllabusPDFTemplateProps> = ({
  madrasah,
  syllabus,
  lang = 'bn'
}) => {
  const isBn = lang === 'bn';

  let parsed: any = {};
  if (typeof syllabus.message === 'string') {
    try {
      parsed = JSON.parse(syllabus.message);
    } catch (e) {
      parsed = { desc: syllabus.message };
    }
  } else {
    parsed = syllabus.message || {};
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

  const isSuggestion = (syllabus.class_name || '').toLowerCase().includes('suggestion');
  const rawClass = (syllabus.class_name || '')
      .replace(/^APP_SYLLABUS_/i, '')
      .replace(/^APP_SUGGESTION_/i, '')
      .trim();
  const className = parsed?.classGroup || parsed?.class || rawClass || 'নির্দিষ্ট শ্রেণি';
  const examName = parsed?.exam || (isSuggestion ? 'পরীক্ষার সাজেশন' : 'পরীক্ষার সিলেবাস ও পাঠ্যসূচি');
  const session = parsed?.session || '২০২৫-২৬';
  const subjects: Array<{ subject: string; details: string; marks?: string; book?: string }> = Array.isArray(parsed?.subjects)
    ? parsed.subjects
    : parsed?.desc
    ? [{ subject: 'সাধারণ পাঠ্যক্রম', details: parsed.desc }]
    : [];

  const instType = (madrasah?.institution_type as string);
  const isIslamic = instType === 'madrasah' || instType === 'qawmi' || !instType;

  return (
    <div className="pdf-page-container w-[794px] min-h-[1123px] p-10 bg-white text-slate-900 font-noto relative flex flex-col justify-between box-border border border-slate-200 shadow-sm mx-auto my-0">
      
      {/* Decorative Outer Double Border */}
      <div className="absolute inset-4 border-2 border-slate-800 pointer-events-none rounded-md">
        <div className="absolute inset-1 border border-orange-200 pointer-events-none"></div>
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-5 left-5 w-5 h-5 border-t-2 border-l-2 border-orange-600 pointer-events-none"></div>
      <div className="absolute top-5 right-5 w-5 h-5 border-t-2 border-r-2 border-orange-600 pointer-events-none"></div>
      <div className="absolute bottom-5 left-5 w-5 h-5 border-b-2 border-l-2 border-orange-600 pointer-events-none"></div>
      <div className="absolute bottom-5 right-5 w-5 h-5 border-b-2 border-r-2 border-orange-600 pointer-events-none"></div>

      {/* Main Content */}
      <div className="relative z-10 px-3 pt-2">
        
        {/* Bismillah Header */}
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
              className="w-18 h-18 object-contain rounded-full border border-slate-200 p-1 shadow-sm shrink-0" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-md">
              {madrasah?.name?.charAt(0) || 'স'}
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
              {madrasah?.email && <span>ইমেইল: {madrasah.email}</span>}
              {(madrasah as any)?.code && <span>EIIN/কোড: {getBanglaNumber((madrasah as any).code)}</span>}
            </div>
          </div>

          <div className="w-18 shrink-0 text-right">
            <div className="inline-block p-1.5 border border-orange-300 rounded-lg bg-orange-50 text-[9px] font-black text-orange-800 text-center leading-tight">
              <span>একাডেমিক</span><br />
              <span className="text-orange-950 font-black">{isSuggestion ? 'সাজেশন' : 'সিলেবাস'}</span>
            </div>
          </div>
        </div>

        {/* Syllabus Title Ribbon */}
        <div className="my-3 text-center">
          <div className="inline-block px-8 py-1.5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 text-white rounded-lg shadow-sm border border-orange-700">
            <h2 className="text-sm font-black tracking-wider uppercase font-noto">
              {isSuggestion ? 'পরীক্ষার সাজেশন (SUGGESTION)' : 'পাঠ্যক্রম ও পরীক্ষার সিলেবাস (SYLLABUS)'}
            </h2>
          </div>
        </div>

        {/* Meta Info Box */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">শ্রেণি:</span>
            <span className="text-slate-900 font-black bg-white px-2 py-0.5 rounded border border-slate-200">
              {className}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-slate-500 font-semibold">পরীক্ষা:</span>
            <span className="text-slate-900 font-black bg-white px-2 py-0.5 rounded border border-slate-200">
              {examName}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-slate-500 font-semibold">শিক্ষাবর্ষ:</span>
            <span className="text-slate-900 font-black bg-white px-2 py-0.5 rounded border border-slate-200">
              {getBanglaNumber(session)}
            </span>
          </div>
        </div>

        {/* Syllabus Table */}
        <div className="overflow-hidden rounded-xl border-2 border-slate-800 shadow-sm mb-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="py-2.5 px-3 font-black text-center w-12 border-r border-slate-700">নং</th>
                <th className="py-2.5 px-4 font-black w-44 border-r border-slate-700">বিষয় (Subject)</th>
                <th className="py-2.5 px-4 font-black">{isSuggestion ? "নির্ধারিত পরীক্ষার সাজেশন" : "নির্ধারিত পরীক্ষার সিলেবাস ও পাঠ্যক্রম"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjects.length > 0 ? (
                subjects.map((sub, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-2.5 px-2 font-bold text-center text-slate-700 border-r border-slate-200 align-top">
                      {getBanglaNumber(idx + 1)}
                    </td>
                    <td className="py-2.5 px-4 font-black text-slate-900 border-r border-slate-200 align-top">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></span>
                        <div>
                          <span>{sub.subject || 'সাধারণ বিষয়'}</span>
                          {sub.book && (
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5">বই: {sub.book}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 font-medium leading-relaxed align-top">
                      <div className="whitespace-pre-wrap leading-5 text-[11px]">
                        {sub.details || (isSuggestion ? 'সাজেশন অন্তর্ভুক্ত করা হয়নি।' : 'সিলেবাস অন্তর্ভুক্ত করা হয়নি।')}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400 font-medium italic">
                    কোনো বিষয় তালিকাভুক্ত নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* General Examination Guidelines */}
        <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3.5 mb-2 text-xs">
          <p className="font-black text-orange-950 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-600"></span>
            পরীক্ষার্থী ও অভিভাবকদের জন্য জরুরি নির্দেশনা:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700 font-medium">
            <li>পরীক্ষার সময়সূচি অনুযায়ী নির্ধারিত সময়ের ১৫ মিনিট পূর্বে পরীক্ষা কক্ষে উপস্থিত হতে হবে।</li>
            <li>সকল শিক্ষার্থীকে নিজ নিজ {isSuggestion ? 'সাজেশন' : 'সিলেবাস'} অনুযায়ী পড়ালেখা সম্পন্ন করার জন্য নির্দেশ দেওয়া হচ্ছে।</li>
            <li>পরীক্ষায় সকল প্রয়োজনীয় উপকরণ (কলম, পেন্সিল, জ্যামিতি বক্স ইত্যাদি) সাথে রাখা আবশ্যক।</li>
          </ul>
        </div>

      </div>

      {/* Footer & Signatures */}
      <div className="relative z-10 px-3 pt-4 border-t border-slate-200 mt-auto">
        <div className="grid grid-cols-3 items-end gap-6 text-center">
          {/* Class Teacher Signature */}
          <div className="space-y-1">
            <div className="h-10 flex items-end justify-center">
              <div className="w-32 border-b border-slate-400 border-dashed"></div>
            </div>
            <p className="text-xs font-bold text-slate-800">শ্রেণি শিক্ষকের স্বাক্ষর</p>
            <p className="text-[10px] text-slate-500">{className}</p>
          </div>

          {/* Academic Incharge */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-18 h-18 rounded-full border-2 border-dashed border-orange-300 flex items-center justify-center text-orange-700 text-[9px] font-bold text-center p-1 leading-tight">
              {isSuggestion ? 'সাজেশন' : 'সিলেবাস'} শাখা<br />অনুমোদিত সিল
            </div>
          </div>

          {/* Principal Signature */}
          <div className="space-y-1">
            <div className="h-10 flex items-end justify-center">
              <div className="w-36 border-b-2 border-slate-800"></div>
            </div>
            <p className="text-xs font-black text-slate-900">
              {isIslamic ? 'মুহতামিম / অধ্যক্ষ' : 'প্রধান শিক্ষক / অধ্যক্ষ'}
            </p>
            <p className="text-[10px] font-bold text-slate-600">{madrasah?.name}</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-semibold text-slate-400">
          <span>প্রকাশনা: পরীক্ষা ও শিক্ষা পরিচালনা বিভাগ</span>
          <span>প্রিন্টের সময়: {new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-GB')}</span>
        </div>
      </div>

    </div>
  );
};
