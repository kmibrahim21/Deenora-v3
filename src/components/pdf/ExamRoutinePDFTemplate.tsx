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
    isBn ? 'পরীক্ষায় নকল বা অসদুপায় অবলম্বন করা হলে কঠোর শাস্তির ব্যবস্থা নেওয়া হবে।' : 'Cheating or copying will lead to severe punishment.',
    isBn ? 'পরীক্ষা চলাকালীন সময় কোনো অভিভাবক পরীক্ষা হলে প্রবেশ করতে পারবেন না।' : 'Guardians are strictly forbidden from entering the halls.'
  ];

  const SingleRoutineContent = () => {
    const isClassMode = routineSelectionMode === 'class';
    const paddingClass = isClassMode ? 'p-4' : 'p-8';
    
    // Madrasah name font size - dynamically small if class mode or name is very long
    const nameFontSize = isClassMode 
      ? (madrasah?.name && madrasah.name.length > 25 ? 'text-[14px]' : 'text-[16px]') 
      : (madrasah?.name && madrasah.name.length > 25 ? 'text-[20px]' : 'text-[24px]');
    
    const logoSizeClass = isClassMode ? 'w-[48px] h-[48px]' : 'w-[66px] h-[66px]';
    const calendarBoxClass = isClassMode ? 'w-[125px] h-[82px] p-1.5' : 'w-[155px] h-[95px] p-2.5';
    const calendarIconClass = isClassMode ? 'w-4 h-4 text-[10px]' : 'w-6 h-6 text-[12px]';
    
    const processedExamName = examName ? examName.replace(/পরীক্ষা|Exam/g, '').trim() : (isBn ? 'সাময়িক' : 'Term');
    const getDynamicExamNameFontSize = () => {
      const len = processedExamName.length;
      if (isClassMode) {
        if (len > 15) return 'text-[7.5px]';
        if (len > 10) return 'text-[8.5px]';
        return 'text-[9.5px]';
      } else {
        if (len > 15) return 'text-[9px]';
        if (len > 10) return 'text-[10.5px]';
        return 'text-[12px]';
      }
    };
    const dynamicExamNameFontSize = getDynamicExamNameFontSize();

    const calendarTextClass1 = dynamicExamNameFontSize;
    const calendarTextClass2 = isClassMode ? 'text-[8.5px]' : 'text-[11px]';
    const calendarTextClass3 = isClassMode ? 'text-[8px]' : 'text-[9.5px]';
    
    const contactTextClass = isClassMode ? 'text-[10px]' : 'text-[12px]';
    const pillBadgeClass = isClassMode ? 'px-3 py-1 text-[10px]' : 'px-5 py-1.5 text-[12px]';
    
    // Dynamic table sizing to prevent overflow
    const tableRowHeight = isClassMode 
      ? (routineData.length > 7 ? 'h-[30px]' : routineData.length > 5 ? 'h-[36px]' : 'h-[44px]') 
      : 'h-[44px]';
    
    const tableCellPaddingClass = isClassMode 
      ? (routineData.length > 7 ? 'p-0.5 text-[9.5px]' : routineData.length > 5 ? 'p-1 text-[10.5px]' : 'p-1.5 text-[11.5px]') 
      : 'p-1 align-middle text-center';

    const tableHeaderHeight = isClassMode && routineData.length > 5 ? 'h-8' : 'h-11';
    
    // Footer elements sizing
    const footerInstructionsMaxWidth = isClassMode ? 'max-w-[250px]' : 'max-w-[420px]';
    const footerInstructionsBadgeClass = isClassMode ? 'px-2 py-1 text-[9.5px] mb-1' : 'px-3.5 py-1.5 text-[11.5px] mb-2';
    const footerInstructionsTextClass = isClassMode ? 'text-[9px] space-y-0.5 font-bold text-slate-600' : 'text-[11.2px] space-y-1 font-bold text-slate-600';
    
    const footerSignBoxMinWidth = isClassMode ? 'min-w-[150px] p-2' : 'min-w-[220px] p-3';
    const footerSignTextClass = isClassMode ? 'text-[10px]' : 'text-[11.5px]';
    const footerSignSubtextClass = isClassMode ? 'text-[9px]' : 'text-[10.5px]';
    const signatureHeight = isClassMode ? 32 : (madrasah?.config_json?.signature_height || 50);

    return (
      <div className={`w-full h-full ${paddingClass} flex flex-col justify-between relative border-[8px] bg-white overflow-hidden`} style={{ borderColor: `${primary}1a` }}>
        {/* Frame Design corners */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 rounded-tl-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>
        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 rounded-tr-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 rounded-bl-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 rounded-br-xl m-1.5 opacity-80" style={{ borderColor: primary }}></div>

        <div className="flex-1 flex flex-col justify-between relative z-10 w-full h-full max-h-full">
          {/* Banner Container */}
          <div className="flex justify-between items-center w-full px-3 py-2 rounded-2xl border mb-2 relative" style={{ backgroundColor: `${light}66`, borderColor: `${primary}1a`, backgroundImage: `linear-gradient(to right, ${light}33, ${accent}66)` }}>
            
            {/* Left Column: Round Logo */}
            <div className="flex-shrink-0 flex items-center justify-center pl-2">
              <div className="relative p-1 rounded-full border bg-white shadow-sm" style={{ borderColor: primary }}>
                {madrasah?.logo_url ? (
                  <img src={madrasah.logo_url} className={`${logoSizeClass} object-contain rounded-full bg-white`} alt="Logo" />
                ) : (
                  <div className={`${logoSizeClass} bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-900 font-black text-[10px]`}>LOGO</div>
                )}
              </div>
            </div>

            {/* Center Column */}
            <div className="flex-1 text-center px-3 leading-tight">
              <h1 className={`${nameFontSize} font-black tracking-tight leading-normal mb-1 font-serif-bn italic`} style={{ color: primary }}>
                {madrasah?.name || 'মাদরাসার নাম'}
              </h1>
              
              <div className={`flex items-center justify-center gap-1.5 ${contactTextClass} font-bold text-[#475569] leading-tight flex-wrap font-noto`}>
                <span className="inline-flex items-center gap-0.5 italic" style={{ color: primary }}>
                  {madrasah?.address || 'ঠিকানা'}
                </span>
                <span className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-0.5" style={{ color: primary }}>
                  {isBn ? 'মোবাইলঃ ' : 'Mobile: '} {madrasah?.phone || '০১৭XXXXXXXX'}
                </span>
              </div>

              {/* Central pill badge */}
              <div className="mt-1.5 inline-block">
                <div className={`text-white ${pillBadgeClass} rounded-full shadow-sm font-black tracking-wide border`} style={{ backgroundColor: secondary, borderColor: `${primary}80` }}>
                  {isBn 
                    ? `${examName} সময়সূচি - ${isBn ? getBanglaNumber(examYear) : examYear}` 
                    : `${examName} Schedule - ${examYear}`}
                </div>
              </div>
            </div>

            {/* Right Column: Calendar Box */}
            <div className={`flex-shrink-0 ${calendarBoxClass} text-white rounded-xl flex flex-col justify-between border shadow mr-2`} style={{ backgroundColor: primary, borderColor: `${primary}b3` }}>
              <div className="flex items-center justify-center">
                <div className={`${calendarIconClass} rounded-full bg-white flex items-center justify-center font-black`} style={{ color: primary }}>
                  📅
                </div>
              </div>
              <div className="text-center mt-0.5 leading-normal">
                <p className={`${calendarTextClass1} font-black leading-tight mb-0.5 whitespace-normal break-words px-1`} style={{ color: accent }}>
                  {processedExamName}
                </p>
                <p className={`${calendarTextClass2} font-extrabold block mb-0.5`} style={{ color: `${accent}cc` }}>
                  পরীক্ষার সময়সূচি
                </p>
                <p className={`${calendarTextClass3} font-semibold text-white/70 block`}>
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
                  {displayClasses.map((cls, idx) => {
                    const rowHeightFormatA = displayClasses.length > 8 ? 'h-7' : displayClasses.length > 5 ? 'h-9' : 'h-11';
                    const cellPaddingFormatA = displayClasses.length > 8 ? 'p-0.5 text-[10.5px]' : displayClasses.length > 5 ? 'p-1 text-[11.5px]' : 'p-1 py-1.5 text-[12.5px]';

                    return (
                      <tr key={cls.id} className={`${idx % 2 === 0 ? 'bg-white' : `${accent}1a`} border-b ${rowHeightFormatA}`} style={{ borderColor: `${primary}33` }}>
                        <td className={`border-r-2 ${cellPaddingFormatA} font-black text-center`} style={{ borderColor: primary, backgroundColor: `${light}66`, color: primary }}>
                          <span className="tracking-tight">{cls.class_name}</span>
                        </td>
                        {routineData.map((_, dayIdx) => {
                          const mrnSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'morning');
                          const aftSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'afternoon');
                          return (
                            <React.Fragment key={dayIdx}>
                              <td className={`border-r ${cellPaddingFormatA} align-middle text-center overflow-hidden`} style={{ borderColor: `${primary}33` }}>
                                <span className={`font-black tracking-tight leading-[1.1] block max-h-full whitespace-normal break-words ${mrnSub === '*****' ? 'text-slate-300 tracking-wider font-mono font-bold' : ''}`} style={{ color: mrnSub === '*****' ? undefined : primary }}>
                                  {mrnSub}
                                </span>
                              </td>
                              {showRoutineAfternoon && (
                                <td className={`border-r ${cellPaddingFormatA} align-middle text-center overflow-hidden`} style={{ borderColor: `${primary}33` }}>
                                  <span className={`font-black tracking-tight leading-[1.1] block max-h-full whitespace-normal break-words ${aftSub === '*****' ? 'text-slate-300 tracking-wider font-mono font-bold' : ''}`} style={{ color: aftSub === '*****' ? undefined : primary }}>
                                    {aftSub}
                                  </span>
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* FORMAT B: CLASS-WISE SINGLE ROUTINE */
              <table className="w-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: primary }}>
                <thead>
                  <tr className={`text-white ${tableHeaderHeight}`} style={{ backgroundColor: primary }}>
                    <th className="border-r p-1 text-[12px] font-black w-24" style={{ borderColor: `${primary}b3` }}>
                      {isBn ? 'বার / তারিখ' : 'Day / Date'}
                    </th>
                    <th className="border-r p-1 text-[12px] font-black" style={{ borderColor: `${primary}b3` }}>
                      {isBn ? `সকাল (${getBanglaNumber(routineMorningTime.split(' - ')[0])})` : `Morning (${routineMorningTime.split(' - ')[0]})`}
                    </th>
                    {showRoutineAfternoon && (
                      <th className="p-1 text-[12px] font-black w-36">
                        {isBn ? `বিকাল (${getBanglaNumber(routineAfternoonTime.split(' - ')[0])})` : `Afternoon (${routineAfternoonTime.split(' - ')[0]})`}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {routineData.map((row, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : `${light}33`} border-b ${tableRowHeight}`} style={{ borderColor: `${primary}33` }}>
                      <td className="border-r p-1 text-center" style={{ borderColor: `${primary}33`, backgroundColor: `${light}4d` }}>
                        <p className="font-black mb-0 leading-tight text-[11px]" style={{ color: primary }}>{row.day}</p>
                        <p className="text-[9.5px] font-bold text-slate-500 mt-0.5 leading-none">{isBn ? getBanglaNumber(row.date) : row.date}</p>
                      </td>
                      
                      {/* Morning subject for selected class */}
                      <td className={`border-r ${tableCellPaddingClass} align-middle`} style={{ borderColor: `${primary}33` }}>
                        <div className="text-center font-black whitespace-normal break-words leading-tight" style={{ color: primary }}>
                          {getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'morning')}
                        </div>
                      </td>
                      
                      {/* Afternoon items */}
                      {showRoutineAfternoon && (
                        <td className={`${tableCellPaddingClass} align-middle`}>
                          <div className="text-center font-black text-slate-800 whitespace-normal break-words leading-tight">
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
          <div className="mt-2 flex justify-between items-end pt-2 border-t" style={{ borderColor: `${primary}1a` }}>
            
            {/* Left Column: Special Instructions */}
            <div className={`${footerInstructionsMaxWidth} text-left leading-relaxed`}>
              <div className={`text-white ${footerInstructionsBadgeClass} rounded-md inline-flex items-center gap-1.5 font-black shadow-sm uppercase font-noto`} style={{ backgroundColor: primary }}>
                <span>📖</span>
                {isBn ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}
              </div>
              <ul className={`${footerInstructionsTextClass} max-h-[140px] overflow-hidden pr-2`}>
                {instructionsToShow.map((inst, i) => (
                  <li key={i} className="flex gap-1.5 leading-normal">
                    <span className="font-extrabold shrink-0" style={{ color: primary }}>{isBn ? getBanglaNumber((i + 1).toString()) : i + 1} ।</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Sign Box */}
            <div className="text-center">
              <div className={`border rounded-xl ${footerSignBoxMinWidth} relative`} style={{ borderColor: `${primary}33`, backgroundColor: `${light}26` }}>
                <div className="relative flex flex-col items-center justify-center mb-0.5" style={{ height: `${signatureHeight}px` }}>
                  {madrasah?.config_json?.signature_url && (
                      <img src={madrasah.config_json.signature_url} style={{ height: `${signatureHeight}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                  )}
                </div>
                <p className={`${footerSignTextClass} font-black mb-0.5`} style={{ color: `${primary}e6` }}>{isBn ? 'ধন্যবাদান্তে,' : 'Best Regards,'}</p>
                <div className="h-px bg-slate-200 w-full mb-1"></div>
                <p className={`${footerSignTextClass} font-black leading-tight`} style={{ color: primary }}>
                  {routinePrincipalName || (isBn ? 'প্রতিষ্ঠাতা পরিচালক' : 'Founding Director')}
                </p>
                <p className={`${footerSignSubtextClass} font-bold text-slate-400 mt-0.5 truncate max-w-[150px]`}>{madrasah?.name}</p>
                {routinePrincipalMobile && (
                  <p className={`${footerSignSubtextClass} font-black mt-0.5 inline-flex items-center gap-0.5`} style={{ color: `${primary}cc` }}>
                    📞 {routinePrincipalMobile}
                  </p>
                )}
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t border-r rounded-tr-md" style={{ borderColor: primary }}></div>
              </div>
            </div>
          </div>

          {/* Deenora Portal bottom tagline */}
          <div className="text-center mt-1.5 pt-1 text-[9px] font-bold text-slate-300 border-t border-slate-100 tracking-wider font-mono">
            {isBn ? `দ্বীনোরা শিক্ষাবর্ষ ${isBn ? getBanglaNumber(examYear) : examYear} • তৈরি করতে ভিজিট করুন deenora.com` : `DEENORA PORTAL • POWERED BY DEENORA ${examYear}`}
          </div>
        </div>
      </div>
    );
  };

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
