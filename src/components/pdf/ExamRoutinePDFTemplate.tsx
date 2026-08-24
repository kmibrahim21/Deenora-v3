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
  fontScale?: number;
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
  themeColor = '#013c28',
  fontScale = 1.2
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

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const cleanTime = timeStr.replace(/\s*(am|pm|AM|PM)\s*/g, '').trim();
    if (isBn) {
      return getBanglaNumber(cleanTime);
    }
    return cleanTime;
  };

  const isBn = lang === 'bn';

  // Parse config_json if it's a string
  let config: any = madrasah?.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      config = {} as any;
    }
  }
  const configObj = (config || {}) as any;

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

  const SingleRoutineContent = ({ copyTitle }: { copyTitle?: string } = {}) => {
    const isClassMode = routineSelectionMode === 'class';
    const numClasses = displayClasses.length;
    const numDays = routineData.length;
    
    // Dynamic proportioning based on class count & day count
    const isVeryFewClasses = !isClassMode && numClasses <= 3;
    const isMediumClasses = !isClassMode && numClasses > 3 && numClasses <= 6;
    const isManyClasses = !isClassMode && numClasses > 7;

    const paddingClass = isClassMode 
      ? 'p-2.5 sm:p-3' 
      : 'p-4 sm:p-5';
    
    // Madrasah name font size - prominent, large & bold
    const nameFontSize = isClassMode 
      ? (madrasah?.name && madrasah.name.length > 25 ? 'text-[20px]' : 'text-[23px]') 
      : (madrasah?.name && madrasah.name.length > 25 ? 'text-[28px]' : 'text-[34px]');
    
    const logoSizeClass = isClassMode 
      ? 'w-[52px] h-[52px]' 
      : 'w-[78px] h-[78px]';

    const calendarBoxClass = isClassMode 
      ? 'w-[124px] h-[82px] p-1.5' 
      : 'w-[160px] h-[98px] p-2';
    
    const processedExamName = examName ? examName.replace(/পরীক্ষার|পরীক্ষা|Exam|সময়সূচি|Schedule/g, '').trim() : (isBn ? 'সাময়িক' : 'Term');
    const getDynamicExamNameFontSize = () => {
      const len = processedExamName.length;
      if (isClassMode) {
        if (len > 15) return 'text-[9px]';
        if (len > 10) return 'text-[10.5px]';
        return 'text-[12px]';
      } else {
        if (len > 15) return 'text-[12px]';
        if (len > 10) return 'text-[14px]';
        return 'text-[15.5px]';
      }
    };
    const dynamicExamNameFontSize = getDynamicExamNameFontSize();

    const calendarTextClass1 = dynamicExamNameFontSize;
    const calendarTextClass2 = isClassMode ? 'text-[9.5px]' : 'text-[12px]';
    const calendarTextClass3 = isClassMode ? 'text-[8.5px]' : 'text-[10.5px]';
    
    const contactTextClass = isClassMode ? 'text-[10px]' : 'text-[12.5px]';
    const pillBadgeClass = isClassMode 
      ? 'px-3 py-0.5 text-[10px]' 
      : 'px-6 py-1 text-[12.5px]';
    
    // Direct font scale multiplier so 'অনেক বড়' (1.4) visibly scales up prominently
    const effectiveScale = fontScale || 1.0;

    // Row font sizes
    let cellFontSizePx: number;
    let classNameFontSizePx: number;
    let headerDayFontPx: number;
    let headerDateFontPx: number;
    let shiftTitleFontPx: number;
    let shiftTimeFontPx: number;
    let rowPaddingClass: string;
    
    if (isClassMode) {
      cellFontSizePx = Math.round(14 * effectiveScale);
      classNameFontSizePx = Math.round(13.5 * effectiveScale);
      headerDayFontPx = Math.round(12.5 * effectiveScale);
      headerDateFontPx = Math.round(11 * effectiveScale);
      shiftTitleFontPx = Math.round(12 * effectiveScale);
      shiftTimeFontPx = Math.round(11 * effectiveScale);
      rowPaddingClass = numDays <= 5 ? 'py-2.5 px-2' : 'py-1.5 px-1.5';
    } else {
      if (numClasses <= 3) {
        cellFontSizePx = Math.round(16 * effectiveScale);
        classNameFontSizePx = Math.round(15.5 * effectiveScale);
        headerDayFontPx = Math.round(13.5 * effectiveScale);
        headerDateFontPx = Math.round(12 * effectiveScale);
        shiftTitleFontPx = Math.round(13.5 * effectiveScale);
        shiftTimeFontPx = Math.round(12.5 * effectiveScale);
        rowPaddingClass = 'py-3 px-2';
      } else if (numClasses <= 5) {
        cellFontSizePx = Math.round(14.5 * effectiveScale);
        classNameFontSizePx = Math.round(14 * effectiveScale);
        headerDayFontPx = Math.round(13 * effectiveScale);
        headerDateFontPx = Math.round(11.5 * effectiveScale);
        shiftTitleFontPx = Math.round(13 * effectiveScale);
        shiftTimeFontPx = Math.round(12 * effectiveScale);
        rowPaddingClass = 'py-2.5 px-1.5';
      } else if (numClasses <= 7) {
        cellFontSizePx = Math.round(13 * effectiveScale);
        classNameFontSizePx = Math.round(13 * effectiveScale);
        headerDayFontPx = Math.round(12 * effectiveScale);
        headerDateFontPx = Math.round(10.5 * effectiveScale);
        shiftTitleFontPx = Math.round(12 * effectiveScale);
        shiftTimeFontPx = Math.round(11 * effectiveScale);
        rowPaddingClass = 'py-2 px-1.5';
      } else if (numClasses <= 9) {
        cellFontSizePx = Math.round(11.5 * effectiveScale);
        classNameFontSizePx = Math.round(11.5 * effectiveScale);
        headerDayFontPx = Math.round(11 * effectiveScale);
        headerDateFontPx = Math.round(9.5 * effectiveScale);
        shiftTitleFontPx = Math.round(11 * effectiveScale);
        shiftTimeFontPx = Math.round(10 * effectiveScale);
        rowPaddingClass = 'py-1.5 px-1';
      } else {
        cellFontSizePx = Math.round(10.5 * effectiveScale);
        classNameFontSizePx = Math.round(10.5 * effectiveScale);
        headerDayFontPx = Math.round(10 * effectiveScale);
        headerDateFontPx = Math.round(9 * effectiveScale);
        shiftTitleFontPx = Math.round(10 * effectiveScale);
        shiftTimeFontPx = Math.round(9 * effectiveScale);
        rowPaddingClass = 'py-1 px-1';
      }
    }

    // Footer elements sizing
    const footerInstructionsMaxWidth = isClassMode 
      ? 'max-w-[220px]' 
      : isVeryFewClasses 
        ? 'max-w-[460px]' 
        : 'max-w-[420px]';

    const footerInstructionsBadgeClass = isClassMode 
      ? 'px-2 py-0.5 text-[8.5px] mb-1' 
      : isVeryFewClasses
        ? 'px-3 py-1 text-[11px] mb-1.5'
        : 'px-3 py-1 text-[10px] mb-1';

    const footerInstructionsTextClass = isClassMode 
      ? 'text-[8px] space-y-0.5 font-bold text-slate-600' 
      : isVeryFewClasses
        ? 'text-[10.5px] space-y-1 font-bold text-slate-600'
        : isManyClasses
          ? 'text-[8.5px] space-y-0.5 font-bold text-slate-600'
          : 'text-[9.5px] space-y-0.5 font-bold text-slate-600';
    
    const footerSignBoxMinWidth = isClassMode 
      ? 'min-w-[130px] p-1.5' 
      : isVeryFewClasses
        ? 'min-w-[210px] p-2.5'
        : 'min-w-[190px] p-2';

    const footerSignTextClass = isClassMode ? 'text-[9px]' : isVeryFewClasses ? 'text-[11px]' : 'text-[10px]';
    const footerSignSubtextClass = isClassMode ? 'text-[8px]' : isVeryFewClasses ? 'text-[10px]' : 'text-[9px]';
    const signatureHeight = isClassMode 
      ? 24 
      : isVeryFewClasses
        ? Math.min(Math.max(Number(configObj?.signature_height) || 42, 32), 48)
        : isManyClasses
          ? Math.min(Math.max(Number(configObj?.signature_height) || 28, 22), 34)
          : Math.min(Math.max(Number(configObj?.signature_height) || 36, 26), 40);

    const bannerPadding = isVeryFewClasses ? 'px-3 py-2 mb-2' : isManyClasses ? 'px-2 py-1 mb-1' : 'px-2.5 py-1.5 mb-1.5';

    return (
      <div 
        className={`w-full h-full ${paddingClass} flex flex-col justify-between relative border-[4px] bg-white overflow-hidden font-solaiman`} 
        style={{ borderColor: primary, fontFamily: "'SolaimanLipi', 'Hind Siliguri', sans-serif" }}
      >
        {/* Inner fine border for official certificate feel */}
        <div className="absolute inset-[3px] border border-dashed pointer-events-none opacity-40 z-0" style={{ borderColor: primary }}></div>

        {/* Decorative corner motifs */}
        <div className="absolute top-1.5 left-1.5 w-6 h-6 border-t-2 border-l-2 pointer-events-none z-10" style={{ borderColor: primary }}></div>
        <div className="absolute top-1.5 right-1.5 w-6 h-6 border-t-2 border-r-2 pointer-events-none z-10" style={{ borderColor: primary }}></div>
        <div className="absolute bottom-1.5 left-1.5 w-6 h-6 border-b-2 border-l-2 pointer-events-none z-10" style={{ borderColor: primary }}></div>
        <div className="absolute bottom-1.5 right-1.5 w-6 h-6 border-b-2 border-r-2 pointer-events-none z-10" style={{ borderColor: primary }}></div>

        {/* Copy badge for 2-in-1 layout */}
        {copyTitle && (
          <div className="absolute top-2 right-4 z-20">
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs font-solaiman text-white" style={{ backgroundColor: secondary, borderColor: primary }}>
              {copyTitle}
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between relative z-10 w-full h-full max-h-full">
          {/* Banner Container */}
          <div className={`flex justify-between items-center w-full ${bannerPadding} rounded-xl border relative shrink-0 shadow-2xs`} style={{ backgroundColor: `${light}80`, borderColor: `${primary}26`, backgroundImage: `linear-gradient(135deg, ${light}99 0%, #ffffff 50%, ${accent}99 100%)` }}>
            
            {/* Left Column: Round Logo */}
            <div className="flex-shrink-0 flex items-center justify-center pl-1">
              <div className="relative p-1 rounded-full border-2 bg-white shadow-xs" style={{ borderColor: primary }}>
                {madrasah?.logo_url ? (
                  <img src={madrasah.logo_url} className={`${logoSizeClass} object-contain rounded-full bg-white`} alt="Logo" crossOrigin="anonymous" />
                ) : (
                  <div className={`${logoSizeClass} bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-900 font-black text-[10px]`}>LOGO</div>
                )}
              </div>
            </div>

            {/* Center Column */}
            <div className="flex-1 text-center px-2 leading-tight">
              <h1 className={`${nameFontSize} font-black tracking-tight leading-tight mb-0.5 font-solaiman drop-shadow-2xs`} style={{ color: primary }}>
                {madrasah?.name || 'প্রতিষ্ঠানের নাম'}
              </h1>
              
              <div className={`flex items-center justify-center gap-2 ${contactTextClass} font-bold text-slate-700 leading-tight flex-wrap font-solaiman`}>
                <span className="inline-flex items-center gap-0.5">
                  📍 {madrasah?.address || 'ঠিকানা'}
                </span>
                {(madrasah?.phone) && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-0.5" style={{ color: primary }}>
                      📞 {isBn ? 'মোবাইল: ' : 'Mobile: '} {isBn ? getBanglaNumber(madrasah.phone) : madrasah.phone}
                    </span>
                  </>
                )}
              </div>

              {/* Central pill badge */}
              <div className="mt-1 inline-block">
                <div className={`text-white ${pillBadgeClass} rounded-full shadow-xs font-black tracking-wide border font-solaiman`} style={{ backgroundColor: secondary, borderColor: primary }}>
                  {isBn 
                    ? (examName.includes('সময়সূচি') || examName.includes('Schedule') ? examName : `${examName} সময়সূচি - ${isBn ? getBanglaNumber(examYear) : examYear}`)
                    : (examName.includes('সময়সূচি') || examName.includes('Schedule') ? examName : `${examName} Schedule - ${examYear}`)}
                </div>
              </div>
            </div>

            {/* Right Column: Calendar Box */}
            <div className={`flex-shrink-0 ${calendarBoxClass} text-white rounded-xl flex flex-col justify-center border shadow-xs mr-1`} style={{ backgroundColor: primary, borderColor: primary }}>
              <div className="text-center leading-tight">
                <p className={`${calendarTextClass1} font-black leading-tight mb-0.5 whitespace-normal break-words px-1 font-solaiman`} style={{ color: '#fef08a' }}>
                  {processedExamName}
                </p>
                <p className={`${calendarTextClass2} font-extrabold block mb-0.5 font-solaiman text-white/95`}>
                  {isBn ? 'পরীক্ষা সময়সূচি' : 'Exam Routine'}
                </p>
                <p className={`${calendarTextClass3} font-bold text-white/80 block font-solaiman`}>
                  {isBn ? getBanglaNumber(examYear) : examYear} {isBn ? 'ইং' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Main Grid Table - Clean, top-aligned closer to upper header */}
          <div className="flex-1 flex flex-col justify-start mt-2 mb-auto overflow-hidden relative">
            {routineSelectionMode === 'all' ? (
              /* FORMAT A: ALL CLASSES TOGETHER GRID */
              <table className="w-full border-collapse border-2 rounded-lg overflow-hidden shadow-xs text-center font-solaiman table-fixed" style={{ borderColor: primary }}>
                <thead className="shrink-0">
                  {/* First row of Table Header: Days/Dates */}
                  <tr className="text-white border-b" style={{ backgroundColor: primary, borderColor: primary }}>
                    <th className="border-r px-1.5 py-1.5 font-black w-24 align-middle" rowSpan={2} style={{ borderColor: `${primary}cc`, backgroundColor: primary }}>
                      <div className="flex flex-col items-center justify-center">
                        <span className="tracking-wider leading-none mb-0.5 border-b pb-0.5 font-solaiman" style={{ borderColor: `${primary}66`, fontSize: `${headerDayFontPx}px` }}>{isBn ? 'বার' : 'DAY'}</span>
                        <span className="tracking-widest opacity-80 leading-none font-solaiman" style={{ fontSize: `${headerDateFontPx}px` }}>{isBn ? 'তারিখ' : 'DATE'}</span>
                      </div>
                    </th>
                    {routineData.map((col, idx) => (
                      <th key={idx} className="border-r px-1 py-1 font-black" colSpan={showRoutineAfternoon ? 2 : 1} style={{ borderColor: `${primary}cc`, backgroundColor: primary }}>
                        <p className="font-black leading-tight text-white font-solaiman" style={{ fontSize: `${headerDayFontPx}px` }}>{col.day}</p>
                        <p className="font-bold mt-0.5 font-solaiman" style={{ color: '#fef08a', fontSize: `${headerDateFontPx}px` }}>
                          {isBn ? getBanglaNumber(col.date) : col.date}
                        </p>
                      </th>
                    ))}
                  </tr>
                  
                  {/* Second row of Table Header: Morning/Afternoon Shifts */}
                  <tr className="border-b" style={{ backgroundColor: accent, borderColor: primary }}>
                    {routineData.map((_, idx) => (
                      <React.Fragment key={idx}>
                        <th className="border-r px-1 py-1 font-black font-solaiman tracking-tighter" style={{ borderColor: `${primary}33`, backgroundColor: accent, color: primary }}>
                          <span className="block font-black leading-tight font-solaiman" style={{ fontSize: `${shiftTitleFontPx}px` }}>
                            {isBn ? 'সকাল' : 'Morning'}
                          </span>
                          <span className="block font-black text-slate-800 mt-0.5 leading-tight px-0.5 font-solaiman" style={{ fontSize: `${shiftTimeFontPx}px` }}>
                            {formatTime(routineMorningTime)}
                          </span>
                        </th>
                        {showRoutineAfternoon && (
                          <th className="border-r px-1 py-1 font-black font-solaiman tracking-tighter" style={{ borderColor: `${primary}33`, backgroundColor: accent, color: primary }}>
                            <span className="block font-black leading-tight font-solaiman" style={{ fontSize: `${shiftTitleFontPx}px` }}>
                              {isBn ? 'বিকাল' : 'Afternoon'}
                            </span>
                            <span className="block font-black text-slate-800 mt-0.5 leading-tight px-0.5 font-solaiman" style={{ fontSize: `${shiftTimeFontPx}px` }}>
                              {formatTime(routineAfternoonTime)}
                            </span>
                          </th>
                        )}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                
                <tbody>
                  {/* Classes display rows with balanced vertical padding */}
                  {displayClasses.map((cls, idx) => (
                    <tr key={cls.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} border-b`} style={{ borderColor: `${primary}26` }}>
                      <td className={`border-r-2 ${rowPaddingClass} font-black text-center align-middle`} style={{ borderColor: primary, backgroundColor: `${light}80`, color: primary, fontSize: `${classNameFontSizePx}px` }}>
                        <span className="tracking-tight font-solaiman block leading-tight">{cls.class_name}</span>
                      </td>
                      {routineData.map((_, dayIdx) => {
                        const mrnSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'morning');
                        const aftSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'afternoon');
                        const isMrnEmpty = !mrnSub || mrnSub === '*****' || mrnSub.trim() === '';
                        const isAftEmpty = !aftSub || aftSub === '*****' || aftSub.trim() === '';

                        return (
                          <React.Fragment key={dayIdx}>
                            <td className={`border-r ${rowPaddingClass} align-middle text-center`} style={{ borderColor: `${primary}26` }}>
                              {isMrnEmpty ? (
                                <span className="text-slate-300 font-bold block text-sm select-none">—</span>
                              ) : (
                                <span className="font-black tracking-tight leading-snug block whitespace-normal break-words font-solaiman" style={{ color: primary, fontSize: `${cellFontSizePx}px` }}>
                                  {mrnSub}
                                </span>
                              )}
                            </td>
                            {showRoutineAfternoon && (
                              <td className={`border-r ${rowPaddingClass} align-middle text-center`} style={{ borderColor: `${primary}26` }}>
                                {isAftEmpty ? (
                                  <span className="text-slate-300 font-bold block text-sm select-none">—</span>
                                ) : (
                                  <span className="font-black tracking-tight leading-snug block whitespace-normal break-words font-solaiman text-slate-800" style={{ fontSize: `${cellFontSizePx}px` }}>
                                    {aftSub}
                                  </span>
                                )}
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
              <table className="w-full border-collapse border-2 rounded-lg overflow-hidden shadow-xs text-center font-solaiman table-fixed" style={{ borderColor: primary }}>
                <thead className="shrink-0">
                  <tr className="text-white" style={{ backgroundColor: primary }}>
                    <th className="border-r p-1.5 font-black w-28 align-middle" style={{ borderColor: `${primary}cc`, fontSize: `${headerDayFontPx}px` }}>
                      {isBn ? 'বার / তারিখ' : 'Day / Date'}
                    </th>
                    <th className="border-r p-1.5 font-black align-middle" style={{ borderColor: `${primary}cc` }}>
                      <div className="font-solaiman leading-tight" style={{ fontSize: `${shiftTitleFontPx}px` }}>{isBn ? 'সকাল' : 'Morning'}</div>
                      <div className="font-bold opacity-90 text-[10px] mt-0.5 font-solaiman" style={{ color: '#fef08a' }}>{routineMorningTime}</div>
                    </th>
                    {showRoutineAfternoon && (
                      <th className="p-1.5 font-black align-middle" style={{ fontSize: `${shiftTitleFontPx}px` }}>
                        <div className="font-solaiman leading-tight">{isBn ? 'বিকাল' : 'Afternoon'}</div>
                        <div className="font-bold opacity-90 text-[10px] mt-0.5 font-solaiman" style={{ color: '#fef08a' }}>{routineAfternoonTime}</div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {routineData.map((row, idx) => {
                    const mrnSub = getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'morning');
                    const aftSub = getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'afternoon');
                    const isMrnEmpty = !mrnSub || mrnSub === '*****' || mrnSub.trim() === '';
                    const isAftEmpty = !aftSub || aftSub === '*****' || aftSub.trim() === '';

                    return (
                      <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} border-b`} style={{ borderColor: `${primary}26` }}>
                        <td className={`border-r ${rowPaddingClass} align-middle text-center`} style={{ borderColor: `${primary}26`, backgroundColor: `${light}66` }}>
                          <p className="font-black leading-tight font-solaiman" style={{ color: primary, fontSize: `${headerDayFontPx}px` }}>{row.day}</p>
                          <p className="font-bold text-slate-600 mt-0.5 leading-none font-solaiman" style={{ fontSize: `${headerDateFontPx}px` }}>{isBn ? getBanglaNumber(row.date) : row.date}</p>
                        </td>
                        
                        {/* Morning subject for selected class */}
                        <td className={`border-r ${rowPaddingClass} align-middle`} style={{ borderColor: `${primary}26` }}>
                          {isMrnEmpty ? (
                            <span className="text-slate-300 font-bold block text-sm select-none">—</span>
                          ) : (
                            <div className="text-center font-black whitespace-normal break-words leading-snug font-solaiman" style={{ color: primary, fontSize: `${cellFontSizePx}px` }}>
                              {mrnSub}
                            </div>
                          )}
                        </td>
                        
                        {/* Afternoon items */}
                        {showRoutineAfternoon && (
                          <td className={`px-2 ${rowPaddingClass} align-middle`}>
                            {isAftEmpty ? (
                              <span className="text-slate-300 font-bold block text-sm select-none">—</span>
                            ) : (
                              <div className="text-center font-black text-slate-800 whitespace-normal break-words leading-snug font-solaiman" style={{ fontSize: `${cellFontSizePx}px` }}>
                                {aftSub}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Natural Watermark stamp */}
            <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none select-none z-[-1]">
              {madrasah?.logo_url ? (
                <img src={madrasah.logo_url} className="w-[280px] h-[280px] object-contain" alt="" crossOrigin="anonymous" />
              ) : (
                <div className="text-9xl font-black font-solaiman" style={{ color: primary }}>{madrasah?.name?.slice(0, 1) || 'ম'}</div>
              )}
            </div>
          </div>

          {/* Footer Block */}
          <div className="mt-1 flex justify-between items-end pt-1.5 border-t shrink-0" style={{ borderColor: `${primary}26` }}>
            
            {/* Left Column: Special Instructions */}
            <div className={`${footerInstructionsMaxWidth} text-left leading-tight`}>
              <div className={`text-white ${footerInstructionsBadgeClass} rounded-md inline-flex items-center gap-1.5 font-black shadow-2xs uppercase font-solaiman`} style={{ backgroundColor: primary }}>
                <span>📋</span>
                {isBn ? 'বিশেষ নির্দেশাবলী' : 'Special Instructions'}
              </div>
              <ul className={`${footerInstructionsTextClass} max-h-[110px] overflow-hidden pr-1 font-solaiman`}>
                {instructionsToShow.map((inst, i) => (
                  <li key={i} className="flex gap-1 leading-snug font-solaiman">
                    <span className="font-extrabold shrink-0" style={{ color: primary }}>{isBn ? getBanglaNumber((i + 1).toString()) : i + 1}।</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Sign Box */}
            <div className="text-center">
              <div className={`border-2 rounded-xl ${footerSignBoxMinWidth} relative font-solaiman shadow-2xs`} style={{ borderColor: `${primary}40`, backgroundColor: `${light}33` }}>
                <div className="relative flex flex-col items-center justify-center mb-0.5" style={{ height: `${signatureHeight}px` }}>
                  {configObj?.signature_url && (
                    <img src={configObj.signature_url} style={{ height: `${signatureHeight}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                  )}
                </div>
                <p className={`${footerSignTextClass} font-black mb-0.5 font-solaiman`} style={{ color: primary }}>{isBn ? 'স্বাক্ষর ও সিল' : 'Signature & Seal'}</p>
                <div className="h-px w-full mb-1" style={{ backgroundColor: `${primary}33` }}></div>
                <p className={`${footerSignTextClass} font-black leading-tight font-solaiman`} style={{ color: primary }}>
                  {routinePrincipalName || (isBn ? 'পরীক্ষা নিয়ন্ত্রক / প্রতিষ্ঠান প্রধান' : 'Controller of Exams / Principal')}
                </p>
                <p className={`${footerSignSubtextClass} font-bold text-slate-500 mt-0.5 truncate max-w-[170px] font-solaiman`}>{madrasah?.name}</p>
                {routinePrincipalMobile && (
                  <p className={`${footerSignSubtextClass} font-black mt-0.5 inline-flex items-center gap-0.5 font-solaiman`} style={{ color: primary }}>
                    📞 {routinePrincipalMobile}
                  </p>
                )}
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 rounded-tr-md" style={{ borderColor: primary }}></div>
              </div>
            </div>
          </div>

          {/* Institute Management System bottom tagline */}
          <div className="text-center mt-0.5 pt-0.5 text-[8px] font-bold text-slate-400 border-t border-slate-100 tracking-wider font-mono uppercase">
            Official Examination Schedule • Institute Management System
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white font-solaiman" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
      <div className="pdf-page-container w-[1123px] h-[794px] bg-white mx-auto overflow-hidden flex relative flex-row">
        {routineSelectionMode === 'all' ? (
          <div className="w-full h-full p-2">
            <SingleRoutineContent />
          </div>
        ) : (
          <div className="w-full h-full flex flex-row">
            {/* Left Copy */}
            <div className="w-1/2 h-full border-r-2 border-dashed border-slate-300 p-2 relative">
              <SingleRoutineContent copyTitle={isBn ? 'শিক্ষার্থী কপি' : 'Student Copy'} />
            </div>
            {/* Right Copy */}
            <div className="w-1/2 h-full p-2 relative">
              <SingleRoutineContent copyTitle={isBn ? 'অভিভাবক কপি' : 'Guardian Copy'} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
