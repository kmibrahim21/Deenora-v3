import React from 'react';
import { Institution, Class } from '../../types';

interface ExamRoutineData {
  date: string;
  day: string;
  morning: {
    time: string;
    subjects: { className: string; subject: string; classId?: string }[];
  };
  afternoon: {
    time: string;
    subjects: { className: string; subject: string; classId?: string }[];
  };
}

interface ExamRoutinePDFTemplateProps {
  madrasah: Institution | null;
  examName: string;
  routineData: ExamRoutineData[];
  lang: 'en' | 'bn';
  routineSelectionMode?: 'all' | 'class';
  selectedRoutineClassId?: string;
  classesList?: Class[];
  routineMorningTime?: string;
  routineAfternoonTime?: string;
  routineInstructions?: string[];
  routinePrincipalName?: string;
  routinePrincipalMobile?: string;
  showRoutineAfternoon?: boolean;
  examYear?: string;
  themeColor?: string;
}

export const ExamRoutinePDFTemplate: React.FC<ExamRoutinePDFTemplateProps> = ({
  madrasah,
  examName,
  routineData,
  lang,
  routineSelectionMode = 'all',
  selectedRoutineClassId = '',
  classesList = [],
  routineMorningTime = '09:00 AM - 12:00 PM',
  routineAfternoonTime = '02:00 PM - 05:00 PM',
  routineInstructions = [],
  routinePrincipalName = '',
  routinePrincipalMobile = '',
  showRoutineAfternoon = true,
  examYear = '২০২৬',
  themeColor = '#013c28'
}) => {
  const themes: { [key: string]: { primary: string; secondary: string; light: string; accent: string } } = {
    'emerald': { primary: '#013c28', secondary: '#023c28', light: '#E6F4EA', accent: '#EAF7EE' },
    'blue': { primary: '#1e3a8a', secondary: '#1e40af', light: '#eff6ff', accent: '#f8fafc' },
    'slate': { primary: '#334155', secondary: '#475569', light: '#f1f5f9', accent: '#f8fafc' },
    'purple': { primary: '#581c87', secondary: '#6b21a8', light: '#faf5ff', accent: '#fdf4ff' },
    'rose': { primary: '#881337', secondary: '#9f1239', light: '#fff1f2', accent: '#fff5f5' }
  };

  const currentTheme = themes[themeColor] || themes['emerald'];
  const primary = currentTheme.primary;
  const secondary = currentTheme.secondary;
  const light = currentTheme.light;
  const accent = currentTheme.accent;

  const getBanglaNumber = (str: string) => {
    const englishDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return str.replace(/[0-9]/g, d => englishDigits[d]);
  };

  const isBn = lang === 'bn';

  // Determine classes to display
  const defaultClasses = [
    { id: '5', class_name: isBn ? '৫ম শ্রেণি' : 'Class 5' },
    { id: 'n', class_name: isBn ? 'নার্সারি' : 'Nursery' },
    { id: '1', class_name: isBn ? 'প্রথম শ্রেণি' : 'Class 1' },
    { id: '2', class_name: isBn ? 'দ্বিতীয় শ্রেণি' : 'Class 2' },
    { id: '3', class_name: isBn ? 'তৃতীয় শ্রেণি' : 'Class 3' }
  ];

  const displayClasses = routineSelectionMode === 'class'
    ? (classesList.filter(c => c.id === selectedRoutineClassId).length > 0 
        ? classesList.filter(c => c.id === selectedRoutineClassId)
        : [classesList[0] || defaultClasses[2]])
    : (classesList.length > 0 ? classesList : defaultClasses);

  // Helper check for subjects
  const getSubjectForClassAndDayAndShift = (cls: any, dayIdx: number, shift: 'morning' | 'afternoon') => {
    const dayObj = routineData[dayIdx];
    if (!dayObj) return '*****';
    const slots = dayObj[shift]?.subjects || [];
    const found = slots.find((s: any) => 
      s.classId === cls.id || 
      s.className === cls.class_name || 
      (s.className && cls.class_name && (s.className.includes(cls.class_name) || cls.class_name.includes(s.className)))
    );
    return found ? found.subject : '*****';
  };

  // Default instructions matching image if none is passed
  const instructionsToShow = routineInstructions.length > 0 ? routineInstructions.filter(Boolean) : [
    isBn ? 'পরীক্ষার ফি, রশিদ যোগ ও বকেয়ার রশিদ সংগ্রহে অনুরোধ রইল।' : 'Required exam fees and pending dues must be paid.',
    isBn ? 'প্রবেশ পত্র সংগ্রহ করতে হবে।' : 'Collect the exam admit card on time.',
    isBn ? 'পরীক্ষার শুরু ১৫ মিনিট পূর্বে উপস্থিত থাকতে হবে।' : 'Be present in the exam hall 15 minutes before.',
    isBn ? 'পরীক্ষার সময় কোনো প্রকার মোবাইল ব্যবহার সম্পূর্ণ নিষিদ্ধ থাকবে।' : 'Smartphones and electronical devices are strictly prohibited.',
    isBn ? 'পরীক্ষায় ইতালি কপি করা বা নকল করা হলে কঠোর শাস্তির ব্যবস্থা নেওয়া হবে।' : 'Cheating or copying will lead to severe punishment.',
    isBn ? 'পরীক্ষা চলাকালীন সময় কোনো অভিভাবক পরীক্ষা হলে প্রবেশ করতে পারবেন না।' : 'Guardians are strictly forbidden from entering the halls.'
  ];

  const SingleRoutineContent = () => (
    <div className="w-full h-full p-8 flex flex-col justify-between relative border-[8px] bg-white overflow-hidden" style={{ borderColor: `${primary}1a` }}>
      {/* Frame Design corners */}
      <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 rounded-tl-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>
      <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 rounded-tr-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 rounded-bl-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 rounded-br-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>

      <div className="flex-1 flex flex-col justify-between relative z-10 w-full h-full max-h-full">
        {/* Banner Container */}
        <div className="flex justify-between items-center w-full px-3 py-2.5 rounded-2xl border mb-3 relative" style={{ backgroundColor: `${light}66`, borderColor: `${primary}1a`, backgroundImage: `linear-gradient(to right, ${light}33, ${accent}66)` }}>
          
          {/* Left Column: Round Logo */}
          <div className="flex-shrink-0 flex items-center justify-center pl-2">
            <div className="relative p-1 rounded-full border bg-white shadow-sm" style={{ borderColor: primary }}>
              {madrasah?.logo_url ? (
                <img src={madrasah.logo_url} className="w-[66px] h-[66px] object-contain rounded-full bg-white" alt="Logo" />
              ) : (
                <div className="w-[66px] h-[66px] bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-900 font-black text-[12px]">LOGO</div>
              )}
            </div>
          </div>

          {/* Center Column */}
          <div className="flex-1 text-center px-4 leading-tight">
            <h1 className="text-[26px] font-black tracking-tight leading-none mb-1.5 font-serif-bn italic" style={{ color: primary }}>
              {madrasah?.name || 'মাদরাসার নাম'}
            </h1>
            
            <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-[#475569] leading-tight flex-wrap font-noto">
              <span className="inline-flex items-center gap-0.5 italic" style={{ color: primary }}>
                {madrasah?.address || 'ঠিকানা'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-0.5" style={{ color: primary }}>
                {isBn ? 'মোবাইলঃ ' : 'Mobile: '} {madrasah?.phone || '০১৭XXXXXXXX'}
              </span>
            </div>

            {/* Central pill badge */}
            <div className="mt-2 inline-block">
              <div className="text-white px-5 py-1.5 rounded-full shadow-sm text-[12px] font-black tracking-wide border animate-pulse" style={{ backgroundColor: secondary, borderColor: `${primary}80` }}>
                {isBn 
                  ? `${examName} সময়সূচি - ${isBn ? getBanglaNumber(examYear) : examYear}` 
                  : `${examName} Schedule - ${examYear}`}
              </div>
            </div>
          </div>

          {/* Right Column: Calendar Box */}
          <div className="flex-shrink-0 w-[125px] h-[95px] text-white rounded-xl flex flex-col justify-between p-2.5 border shadow mr-2" style={{ backgroundColor: primary, borderColor: `${primary}b3` }}>
            <div className="flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-black text-[12px]" style={{ color: primary }}>
                📅
              </div>
            </div>
            <div className="text-center mt-1 leading-normal">
              <p className="text-[11px] font-black leading-none mb-0.5 whitespace-nowrap overflow-hidden" style={{ color: accent }}>
                {examName ? examName.replace(/পরীক্ষা|Exam/g, '').trim() : (isBn ? 'সাময়িক' : 'Term')}
              </p>
              <p className="text-[11px] font-extrabold block mb-0.5" style={{ color: `${accent}cc` }}>
                পরীক্ষার সময়সূচি
              </p>
              <p className="text-[9.5px] font-semibold text-white/70 block">
                {isBn ? getBanglaNumber(examYear) : examYear}ইং
              </p>
            </div>
          </div>
        </div>

        {/* Main Grid Table */}
        <div className="flex-1 overflow-hidden">
          {routineSelectionMode === 'all' ? (
            /* FORMAT A: ALL CLASSES TOGETHER GRID */
            <table className="w-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: primary }}>
              <thead>
                {/* First row of Table Header: Days/Dates */}
                <tr className="text-white h-11 border-b" style={{ backgroundColor: primary, borderColor: primary }}>
                  <th className="border-r px-1 py-1 text-[12.5px] font-black w-24" rowSpan={2} style={{ borderColor: `${primary}b3`, backgroundColor: primary }}>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[12.5px] tracking-wider leading-none mb-0.5 border-b pb-0.5" style={{ borderColor: `${primary}66` }}>{isBn ? 'বার' : 'DAY'}</span>
                      <span className="text-[11px] tracking-widest opacity-80 leading-none">{isBn ? 'তারিখ' : 'DATE'}</span>
                    </div>
                  </th>
                  {routineData.map((col, idx) => (
                    <th key={idx} className="border-r p-1 text-[12.5px] font-black min-w-[85px]" colSpan={showRoutineAfternoon ? 2 : 1} style={{ borderColor: `${primary}b3`, backgroundColor: primary }}>
                      <p className="text-[12.5px] font-black leading-tight text-white">{col.day}</p>
                      <p className="text-[10px] font-bold mt-0.5" style={{ color: accent }}>
                        {isBn ? getBanglaNumber(col.date) : col.date}
                      </p>
                    </th>
                  ))}
                </tr>
                
                {/* Second row of Table Header: Morning/Afternoon Shifts */}
                <tr className="text-emerald-950 h-9 border-b" style={{ backgroundColor: accent, borderColor: primary }}>
                  {routineData.map((_, idx) => (
                    <React.Fragment key={idx}>
                      <th className="border-r p-1 text-[11px] font-black font-noto tracking-tighter w-[50px]" style={{ borderColor: `${primary}33`, backgroundColor: accent, color: primary }}>
                        {isBn ? 'সকাল' : 'Morning'}
                        <span className="block text-[9px] font-bold text-[#475569] mt-0.5 leading-none">
                          {isBn ? getBanglaNumber(routineMorningTime.split(' ')[0]) : routineMorningTime.split(' ')[0]}
                        </span>
                      </th>
                      {showRoutineAfternoon && (
                        <th className="border-r p-1 text-[11px] font-black font-noto tracking-tighter w-[50px]" style={{ borderColor: `${primary}33`, backgroundColor: accent, color: primary }}>
                          {isBn ? 'বিকাল' : 'Afternoon'}
                          <span className="block text-[9px] font-bold text-[#475569] mt-0.5 leading-none">
                            {isBn ? getBanglaNumber(routineAfternoonTime.split(' ')[0]) : routineAfternoonTime.split(' ')[0]}
                          </span>
                        </th>
                      )}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              
              <tbody>
                {/* Classes display rows */}
                {displayClasses.map((cls, idx) => (
                  <tr key={cls.id} className={`${idx % 2 === 0 ? 'bg-white' : `${accent}1a`} border-b h-11`} style={{ borderColor: `${primary}33` }}>
                    <td className="border-r-2 p-1 font-black text-[12.5px] text-center" style={{ borderColor: primary, backgroundColor: `${light}66`, color: primary }}>
                      <span className="text-[12.5px] font-black tracking-tight">{cls.class_name}</span>
                    </td>
                    {routineData.map((_, dayIdx) => {
                      const mrnSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'morning');
                      const aftSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'afternoon');
                      return (
                        <React.Fragment key={dayIdx}>
                          <td className="border-r p-1 align-middle text-center overflow-hidden animate-fade-in" style={{ borderColor: `${primary}33` }}>
                            <span className={`text-[11.5px] font-black tracking-tight leading-[1.1] block max-h-full whitespace-normal break-words ${mrnSub === '*****' ? 'text-slate-300 tracking-wider font-mono font-bold' : ''}`} style={{ color: mrnSub === '*****' ? undefined : primary }}>
                              {mrnSub}
                            </span>
                          </td>
                          {showRoutineAfternoon && (
                            <td className="border-r p-1 align-middle text-center overflow-hidden animate-fade-in" style={{ borderColor: `${primary}33` }}>
                              <span className={`text-[11.5px] font-black tracking-tight leading-[1.1] block max-h-full whitespace-normal break-words ${aftSub === '*****' ? 'text-slate-300 tracking-wider font-mono font-bold' : ''}`} style={{ color: aftSub === '*****' ? undefined : primary }}>
                                {aftSub}
                              </span>
                            </td>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* FORMAT B: CLASS-WISE SINGLE ROUTINE */
            <table className="w-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: primary }}>
              <thead>
                <tr className="text-white h-12" style={{ backgroundColor: primary }}>
                  <th className="border-r p-2 text-[13px] font-black w-28" style={{ borderColor: `${primary}b3` }}>
                    {isBn ? 'বার / তারিখ' : 'Day / Date'}
                  </th>
                  <th className="border-r p-2 text-[13px] font-black" style={{ borderColor: `${primary}b3` }}>
                    {isBn ? `সকাল (${getBanglaNumber(routineMorningTime)})` : `Morning (${routineMorningTime})`}
                  </th>
                  {showRoutineAfternoon && (
                    <th className="p-2 text-[13px] font-black w-44">
                      {isBn ? `বিকাল (${getBanglaNumber(routineAfternoonTime)})` : `Afternoon (${routineAfternoonTime})`}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {routineData.map((row, idx) => (
                  <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : `${light}33`} border-b h-[44px]`} style={{ borderColor: `${primary}33` }}>
                    <td className="border-r p-2 text-center" style={{ borderColor: `${primary}33`, backgroundColor: `${light}4d` }}>
                      <p className="text-[13px] font-black mb-0" style={{ color: primary }}>{row.day}</p>
                      <p className="text-[11.5px] font-bold text-slate-500 mt-0.5">{isBn ? getBanglaNumber(row.date) : row.date}</p>
                    </td>
                    
                    {/* Morning subject for selected class */}
                    <td className="border-r p-2 align-middle" style={{ borderColor: `${primary}33` }}>
                      <div className="text-center font-black text-[13px] whitespace-normal break-words leading-tight" style={{ color: primary }}>
                        {getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'morning')}
                      </div>
                    </td>
                    
                    {/* Afternoon items */}
                    {showRoutineAfternoon && (
                      <td className="p-2 align-middle">
                        <div className="text-center font-black text-[13px] text-slate-800 whitespace-normal break-words leading-tight">
                          {getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'afternoon')}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Natural Watermark stamp */}
          <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none -rotate-12 select-none z-[-1]">
            {madrasah?.logo_url ? (
              <img src={madrasah.logo_url} className="w-[300px] h-[300px] object-contain" alt="" />
            ) : (
              <div className="text-9xl font-black" style={{ color: primary }}>{madrasah?.name?.slice(0, 1) || 'ম'}</div>
            )}
          </div>
        </div>

        {/* Footer Block */}
        <div className="mt-2.5 flex justify-between items-end pt-2.5 border-t" style={{ borderColor: `${primary}1a` }}>
          
          {/* Left Column: Special Instructions */}
          <div className="max-w-[420px] text-left leading-relaxed">
            <div className="text-white px-3.5 py-1.5 rounded-md inline-flex items-center gap-1.5 text-[11.5px] font-black mb-2 shadow-sm uppercase font-noto" style={{ backgroundColor: primary }}>
              <span>📖</span>
              {isBn ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}
            </div>
            <ul className="space-y-1 max-h-[160px] overflow-hidden pr-2">
              {instructionsToShow.map((inst, i) => (
                <li key={i} className="flex gap-1.5 text-[11.2px] font-bold text-slate-600 leading-normal">
                  <span className="font-extrabold shrink-0" style={{ color: primary }}>{isBn ? getBanglaNumber((i + 1).toString()) : i + 1} ।</span>
                  <span>{inst}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Sign Box */}
          <div className="text-center min-w-[220px]">
            <div className="border rounded-xl p-3 relative" style={{ borderColor: `${primary}33`, backgroundColor: `${light}26` }}>
              <div className="relative flex flex-col items-center justify-center mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 50}px` }}>
                {madrasah?.config_json?.signature_url && (
                    <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 50}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                )}
              </div>
              <p className="text-[11.5px] font-black mb-1" style={{ color: `${primary}e6` }}>{isBn ? 'ধন্যবাদান্তে,' : 'Best Regards,'}</p>
              <div className="h-px bg-slate-200 w-full mb-1.5"></div>
              <p className="text-[11.5px] font-black" style={{ color: primary }}>
                {routinePrincipalName || (isBn ? 'প্রতিষ্ঠাতা পরিচালক' : 'Founding Director')}
              </p>
              <p className="text-[10.5px] font-bold text-slate-400 mt-1">{madrasah?.name}</p>
              {routinePrincipalMobile && (
                <p className="text-[10.5px] font-black mt-1 inline-flex items-center gap-0.5" style={{ color: `${primary}cc` }}>
                  📞 {routinePrincipalMobile}
                </p>
              )}
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t border-r rounded-tr-md" style={{ borderColor: primary }}></div>
            </div>
          </div>
        </div>

        {/* Deenora Portal bottom tagline */}
        <div className="text-center mt-2 pt-1 text-[9.5px] font-bold text-slate-300 border-t border-slate-100 tracking-wider font-mono">
          {isBn ? `দ্বীনোরা শিক্ষাবর্ষ ${isBn ? getBanglaNumber(examYear) : examYear} • তৈরি করতে ভিজিট করুন deenora.com` : `DEENORA PORTAL • POWERED BY DEENORA ${examYear}`}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white font-noto">
      <div className="pdf-page-container w-[1123px] h-[794px] bg-white mx-auto overflow-hidden flex relative flex-row">
        {routineSelectionMode === 'all' ? (
          <div className="w-full h-full p-2">
            <SingleRoutineContent />
          </div>
        ) : (
          <div className="w-full h-full flex flex-row">
            {/* Left Copy */}
            <div className="w-1/2 h-full border-r-2 border-dashed border-slate-300 p-2">
              <SingleRoutineContent />
            </div>
            {/* Right Copy */}
            <div className="w-1/2 h-full p-2">
              <SingleRoutineContent />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
