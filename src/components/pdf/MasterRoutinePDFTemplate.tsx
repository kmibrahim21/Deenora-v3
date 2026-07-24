import React from 'react';
import { Institution, ClassRoutine, Class, Teacher } from '../../types';

interface MasterRoutinePDFTemplateProps {
  madrasah: Institution | null;
  routines: ClassRoutine[];
  classes: Class[];
  days: any[];
  lang: 'en' | 'bn';
}

export const MasterRoutinePDFTemplate: React.FC<MasterRoutinePDFTemplateProps> = ({ madrasah, routines, classes, days, lang }) => {
  const getBanglaNumber = (str: string) => {
    const englishDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return str.replace(/[0-9]/g, d => englishDigits[d]);
  };

  // Get unique time slots across all routines to build columns
  const timeSlots = Array.from(new Set(routines.map(r => `${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}`))).sort();

  return (
    <div className="bg-white">
      <div className="pdf-page-container w-[1123px] h-[794px] p-6 bg-white border border-slate-300 mx-auto overflow-hidden flex flex-col relative">
        {/* Header Section */}
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold font-noto tracking-tight text-slate-900">{madrasah?.name}</h1>
          <p className="text-[10px] font-bold text-slate-500 font-noto mt-1">{madrasah?.address}</p>
          <p className="text-[10px] font-bold text-slate-400 font-noto">স্থাপিত-২০০৯ ইং</p>
          
          <div className="mt-2 inline-block border-[1px] border-slate-500 px-12 py-0.5 bg-slate-50">
            <h2 className="text-lg font-bold font-noto text-slate-800 tracking-widest">ক্লাস রুটিন-২০২৫</h2>
          </div>
        </div>

        {/* Master Table */}
        <div className="flex-1 mt-2">
          <table className="w-full border-collapse border-[1px] border-slate-500 text-[10px]">
            <thead>
              <tr className="bg-slate-50 h-10">
                <th className="border-[1px] border-slate-500 p-1 font-bold font-noto w-12 text-center">শ্রেণি</th>
                {timeSlots.map((slot, index) => {
                  const startTime = slot.split(' - ')[0];
                  const endTime = slot.split(' - ')[1];
                  
                  return (
                    <React.Fragment key={slot}>
                      <th className="border-[1px] border-slate-500 p-1 font-bold font-noto min-w-[70px] text-center">
                        <div className="text-[10px]">{getBanglaNumber((index + 1).toString())}ম ঘণ্টা</div>
                        <div className="text-[9px] font-normal">({getBanglaNumber(startTime)}-{getBanglaNumber(endTime)})</div>
                      </th>
                      
                      {index === 2 && (
                         <th className="border-[1px] border-slate-500 p-1 font-bold font-noto w-6 bg-slate-100">
                           বিরতি
                         </th>
                      )}
                      {index === 5 && (
                         <th className="border-[1px] border-slate-500 p-1 font-bold font-noto w-6 bg-slate-100">
                           বিরতি
                         </th>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => {
                const classRoutines = routines.filter(r => r.class_id === cls.id);
                if (classRoutines.length === 0) return null;

                return (
                  <tr key={cls.id} className="h-12">
                    <td className="border-[1px] border-slate-500 p-1 font-bold font-noto text-center bg-slate-50">
                      {cls.class_name}
                    </td>
                    {timeSlots.map((slot, index) => {
                      const r = classRoutines.find(item => `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` === slot);
                      
                      return (
                        <React.Fragment key={slot}>
                          <td className="border-[1px] border-slate-500 p-1 text-center align-middle">
                            {r ? (
                              <div className="leading-tight">
                                <p className="font-bold text-slate-800 text-[10px]">{r.subject_name}</p>
                                {r.teacher_id && (r.teachers as any)?.teacher_name && (
                                  <p className="text-[8px] font-medium text-slate-500 mt-0.5">মো: {(r.teachers as any).teacher_name}</p>
                                )}
                              </div>
                            ) : '-'}
                          </td>

                          {index === 2 && (
                            <td className="border-[1px] border-slate-500 p-0 text-center align-middle bg-white relative overflow-hidden">
                               <div className="[writing-mode:vertical-lr] rotate-180 text-[7px] font-bold tracking-widest leading-none mx-auto py-1">
                                 পানি বিরতি : ২০ মিনিট
                               </div>
                            </td>
                          )}
                          {index === 5 && (
                            <td className="border-[1px] border-slate-500 p-0 text-center align-middle bg-white relative">
                               <div className="[writing-mode:vertical-lr] rotate-180 text-[6px] font-bold leading-tight mx-auto py-1">
                                 জোহরের নামাজ ও দুপুরের খাবার
                               </div>
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
        </div>

        {/* Note/Signature Section */}
        <div className="mt-2 flex justify-between items-end px-4 text-[9px] font-medium text-slate-600">
           <div className="flex gap-4">
              <span>* রুটিন অনুযায়ী ক্লাস হবে।</span>
              <span>* সময় পরিবর্তন সাপেক্ষে জানানো হবে।</span>
           </div>
           <div className="text-center min-w-[120px] relative">
              <div className="flex items-center justify-center relative mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 35}px` }}>
                {madrasah?.config_json.signature_url && (
                  <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 35}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                )}
              </div>
              <div className="border-t border-slate-400 pt-1">
                <p className="font-bold">অধ্যক্ষ / মুহতামিম</p>
              </div>
           </div>
        </div>

        {/* System Tagline */}
        <div className="text-center mt-auto pt-2 text-[9px] font-bold text-slate-300 border-t border-slate-100 tracking-wider font-mono uppercase">
          Institute Management System
        </div>
      </div>
    </div>
  );
};
