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
  routinePrincipalMobile = ''
}) => {
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

  return (
    <div className="bg-white font-noto">
      <div className="pdf-page-container w-[794px] h-[1123px] p-10 bg-white mx-auto overflow-hidden flex flex-col justify-between relative border-[12px] border-emerald-800/10">
        
        {/* Frame Design corners */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-emerald-800 rounded-tl-xl m-2"></div>
        <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-emerald-800 rounded-tr-xl m-2"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-emerald-800 rounded-bl-xl m-2"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-emerald-800 rounded-br-xl m-2"></div>

        <div className="flex-1 flex flex-col justify-between">
          
          {/* Header Bismillah Line */}
          <div className="text-center mb-1">
            <p className="text-sm font-bold text-emerald-950" style={{ fontFamily: 'serif' }}>بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰনِ ٱلرَّحِيمِ</p>
          </div>

          {/* Banner Container: Logo, Center Title, Right Calendar Tag */}
          <div className="flex justify-between items-center w-full px-2 py-3 bg-[#E6F4EA]/40 rounded-3xl border border-emerald-800/10 mb-4 relative" style={{ backgroundImage: 'linear-gradient(to right, #F4FBF7, #EBF8F1)' }}>
            
            {/* Left Column: Round Logo */}
            <div className="flex-shrink-0 flex items-center justify-center pl-4">
              <div className="relative p-1 rounded-full border border-emerald-800 bg-white shadow-sm">
                {madrasah?.logo_url ? (
                  <img src={madrasah.logo_url} className="w-[85px] h-[85px] object-contain rounded-full bg-white" alt="Logo" />
                ) : (
                  <div className="w-[85px] h-[85px] bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-900 font-black text-[10px]">LOGO</div>
                )}
              </div>
            </div>

            {/* Center Column: Name and subtitle metadata */}
            <div className="flex-1 text-center px-3 leading-normal">
              <h1 className="text-[28px] font-black text-[#013c28] tracking-tight leading-none mb-1 font-noto">
                {madrasah?.name || 'মাদরাসার নাম'}
              </h1>
              
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-black text-[#475569] leading-tight flex-wrap">
                <span className="inline-flex items-center gap-0.5 text-emerald-900">
                  📍 {madrasah?.address || 'ঠিকানা'}
                </span>
                <span className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-0.5 text-emerald-950">
                  📞 {isBn ? 'মোবাইলঃ ' : 'Mobile: '} {madrasah?.phone || '০১৭XXXXXXXX'}
                </span>
              </div>

              {/* Central pill badge matching bottom-center of image */}
              <div className="mt-2 inline-block">
                <div className="bg-[#023c28] text-white px-5 py-1.5 rounded-full shadow-sm text-[11px] font-black tracking-wide border border-emerald-700/50">
                  {isBn 
                    ? `${examName} সময়সূচি - ২০২৫` 
                    : `${examName} Schedule - 2025`}
                </div>
              </div>
            </div>

            {/* Right Column: Solid Premium Calendar Box matching top-right box exactly */}
            <div className="flex-shrink-0 w-[160px] h-[120px] bg-[#013c28] text-white rounded-2xl flex flex-col justify-between p-3 border border-emerald-700 shadow mr-4 hover:scale-[1.02] transition-transform">
              <div className="flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[#013c28] font-black text-sm">
                  📅
                </div>
              </div>
              <div className="text-center mt-1 leading-normal">
                <p className="text-[11px] font-black text-[#E2F7E7] leading-none mb-0.5 whitespace-nowrap overflow-hidden">
                  {examName ? examName.replace(/পরীক্ষা|Exam/g, '').trim() : (isBn ? 'সাময়িক' : 'Term')}
                </p>
                <p className="text-[11px] font-extrabold text-[#99F6E4] block mb-0.5">
                  পরীক্ষার সময়সূচি
                </p>
                <p className="text-[10px] font-semibold text-white/70 block">
                  ২০২৫ইং
                </p>
              </div>
            </div>
          </div>

          {/* Main Grid Table matching image perfectly */}
          <div className="flex-1 mt-2">
            
            {routineSelectionMode === 'all' ? (
              /* FORMAT A: ALL CLASSES TOGETHER GRID */
              <table className="w-full border-collapse border-2 border-emerald-950 rounded-xl overflow-hidden shadow-sm text-center">
                <thead>
                  {/* First row of Table Header: Days/Dates */}
                  <tr className="bg-[#013c28] text-white h-11 border-b border-emerald-950">
                    <th className="border-r border-emerald-900 px-2 py-1.5 text-xs font-black w-24 bg-[#013c28]" rowSpan={2}>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[11px] tracking-wider leading-none mb-1 border-b border-emerald-600 pb-0.5">{isBn ? 'বার' : 'DAY'}</span>
                        <span className="text-[10px] tracking-widest opacity-80 leading-none">{isBn ? 'তারিখ' : 'DATE'}</span>
                      </div>
                    </th>
                    {routineData.map((col, idx) => (
                      <th key={idx} className="border-r border-emerald-900 p-1 text-xs font-black bg-[#013c28] min-w-[100px]" colSpan={2}>
                        <p className="text-[11px] font-black leading-tight text-white">{col.day}</p>
                        <p className="text-[9px] font-bold text-emerald-200 mt-0.5">
                          {isBn ? getBanglaNumber(col.date) : col.date}
                        </p>
                      </th>
                    ))}
                  </tr>
                  
                  {/* Second row of Table Header: Morning/Afternoon Shifts */}
                  <tr className="bg-emerald-50 text-emerald-950 h-9 border-b border-emerald-950">
                    {routineData.map((_, idx) => (
                      <React.Fragment key={idx}>
                        <th className="border-r border-emerald-200 p-1 text-[9px] font-black font-noto tracking-tighter w-[55px] bg-[#EAF7EE] text-emerald-900">
                          {isBn ? 'সকাল' : 'Morning'}
                          <span className="block text-[8px] font-bold text-[#475569] mt-0.5 leading-none">
                            {isBn ? getBanglaNumber(routineMorningTime.split(' ')[0]) : routineMorningTime.split(' ')[0]}
                          </span>
                        </th>
                        <th className="border-r border-emerald-200 p-1 text-[9px] font-black font-noto tracking-tighter w-[55px] bg-[#EAF7EE] text-emerald-900">
                          {isBn ? 'বিকাল' : 'Afternoon'}
                          <span className="block text-[8px] font-bold text-[#475569] mt-0.5 leading-none">
                            {isBn ? getBanglaNumber(routineAfternoonTime.split(' ')[0]) : routineAfternoonTime.split(' ')[0]}
                          </span>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                
                <tbody>
                  {/* Classes display rows */}
                  {displayClasses.map((cls, idx) => (
                    <tr key={cls.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/10'} hover:bg-emerald-50/30 transition-colors border-b border-emerald-950/20 h-13`}>
                      {/* Leftmost column showing class label with cute small ribbon or text */}
                      <td className="border-r-2 border-emerald-950 p-2 font-black text-xs text-center bg-[#E6F4EA]/40 text-emerald-950">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[12px] font-black text-emerald-950 tracking-tight">{cls.class_name}</span>
                        </div>
                      </td>

                      {/* Map days */}
                      {routineData.map((_, dayIdx) => {
                        const mrnSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'morning');
                        const aftSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'afternoon');

                        return (
                          <React.Fragment key={dayIdx}>
                            {/* Morning Shift subject cell */}
                            <td className="border-r border-emerald-200 p-1.5 align-middle text-center">
                              <span className={`text-[11px] font-black tracking-tight leading-tight block ${mrnSub === '*****' ? 'text-slate-300 tracking-wider font-mono' : 'text-emerald-950'}`}>
                                {mrnSub}
                              </span>
                            </td>
                            {/* Afternoon Shift subject cell */}
                            <td className="border-r border-emerald-200 p-1.5 align-middle text-center">
                              <span className={`text-[11px] font-black tracking-tight leading-tight block ${aftSub === '*****' ? 'text-slate-300 tracking-wider font-mono' : 'text-emerald-900'}`}>
                                {aftSub}
                              </span>
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* FORMAT B: CLASS-WISE SINGLE ROUTINE */
              <table className="w-full border-collapse border-2 border-emerald-950 rounded-xl overflow-hidden shadow-sm text-center">
                <thead>
                  <tr className="bg-[#013c28] text-white h-11">
                    <th className="border-r border-emerald-900 p-2 text-xs font-black w-32">
                      {isBn ? 'বার / তারিখ' : 'Day / Date'}
                    </th>
                    <th className="border-r border-emerald-900 p-2 text-xs font-black">
                      {isBn ? `সকাল (${getBanglaNumber(routineMorningTime)})` : `Morning (${routineMorningTime})`}
                    </th>
                    <th className="p-2 text-xs font-black w-48">
                      {isBn ? `বিকাল (${getBanglaNumber(routineAfternoonTime)})` : `Afternoon (${routineAfternoonTime})`}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {routineData.map((row, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/20'} border-b border-emerald-950/20 h-16`}>
                      <td className="border-r border-emerald-950/20 p-2 text-center bg-emerald-50/30">
                        <p className="text-xs font-black text-emerald-950 mb-0.5">{row.day}</p>
                        <p className="text-[10px] font-bold text-slate-500">{isBn ? getBanglaNumber(row.date) : row.date}</p>
                      </td>
                      
                      {/* Morning subject for selected class */}
                      <td className="border-r border-emerald-950/20 p-2 align-middle">
                        <div className="text-center font-black text-xs text-emerald-950">
                          {getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'morning')}
                        </div>
                      </td>

                      {/* Afternoon items */}
                      <td className="p-2 align-middle">
                        <div className="text-center font-black text-xs text-slate-800">
                          {getSubjectForClassAndDayAndShift(displayClasses[0], idx, 'afternoon')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Natural Watermark stamp */}
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none -rotate-12 select-none">
              {madrasah?.logo_url ? (
                <img src={madrasah.logo_url} className="w-[330px] h-[330px] object-contain" alt="" />
              ) : (
                <div className="text-9xl font-black text-emerald-900">{madrasah?.name?.slice(0, 1) || 'ম'}</div>
              )}
            </div>
          </div>

          {/* Footer Block matching image exactly */}
          <div className="mt-4 flex justify-between items-end pt-4 border-t border-emerald-950/10">
            
            {/* Left Column: Special Instructions list */}
            <div className="max-w-[430px] text-left leading-relaxed">
              <div className="bg-[#013c28] text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-[11px] font-black mb-2 shadow-sm uppercase font-noto">
                <span>📖</span>
                {isBn ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}
              </div>
              <ul className="space-y-1 max-h-[160px] overflow-hidden pr-2">
                {instructionsToShow.map((inst, i) => (
                  <li key={i} className="flex gap-1.5 text-[10px] font-bold text-slate-600 leading-normal">
                    <span className="text-emerald-800 font-extrabold">{isBn ? getBanglaNumber((i + 1).toString()) : i + 1} ।</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Sign Box matching bottom-right of image */}
            <div className="text-center min-w-[200px]">
              <div className="border border-emerald-800/20 rounded-xl p-4 bg-emerald-50/15 relative">
                <p className="text-[11px] font-black text-emerald-800/90 mb-6">{isBn ? 'ধন্যবাদান্তে,' : 'Best Regards,'}</p>
                <div className="h-px bg-slate-200 w-full mb-1"></div>
                <p className="text-[11px] font-black text-emerald-950">
                  {routinePrincipalName || (isBn ? 'প্রতিষ্ঠাতা পরিচালক' : 'Founding Director')}
                </p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{madrasah?.name}</p>
                {routinePrincipalMobile && (
                  <p className="text-[9px] font-black text-emerald-700/80 mt-0.5 inline-flex items-center gap-0.5">
                    📞 {routinePrincipalMobile}
                  </p>
                )}
                
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t border-r border-emerald-800 rounded-tr-md"></div>
              </div>
            </div>
          </div>

          {/* Deenora Portal bottom tagline */}
          <div className="text-center mt-3 pt-1 text-[8px] font-bold text-slate-300 border-t border-slate-100 tracking-wider font-mono">
            {isBn ? 'দ্বীনোরা শিক্ষাবর্ষ ২০২৬ • তৈরি করতে ভিজিট করুন deenora.com' : 'DEENORA PORTAL • POWERED BY DEENORA'}
          </div>
        </div>
      </div>
    </div>
  );
};
