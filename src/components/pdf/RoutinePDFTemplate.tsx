import React from 'react';
import { Institution, ClassRoutine, Teacher, Class } from '../../types';

interface RoutinePDFTemplateProps {
  madrasah: Institution | null;
  routines: ClassRoutine[];
  classes: Class[];
  days: any[];
  lang: 'en' | 'bn';
}

export const RoutinePDFTemplate: React.FC<RoutinePDFTemplateProps> = ({ madrasah, routines, classes, days, lang }) => {
  const getBanglaNumber = (str: string) => {
    const englishDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return str.replace(/[0-9]/g, d => englishDigits[d]);
  };

  return (
    <div className="bg-white">
      {classes.map((cls) => {
        const classRoutines = routines.filter(r => r.class_id === cls.id);
        if (classRoutines.length === 0) return null;

        const timeSlots = Array.from(new Set(classRoutines.map((r: any) => `${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}`))).sort();

        return (
          <div key={cls.id} className="pdf-page-container w-[794px] h-[1123px] p-10 bg-white border-2 border-slate-900 mx-auto overflow-hidden flex flex-col relative">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-4 mb-4">
                {madrasah?.logo_url && <img src={madrasah.logo_url} className="w-16 h-16 object-contain" alt="Logo" />}
                <div className="text-left">
                  <h1 className="text-xl font-black text-emerald-800">{madrasah?.name}</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{madrasah?.address}</p>
                </div>
              </div>
              <div className="bg-slate-900 text-white px-8 py-1.5 rounded-full inline-block text-sm font-black">
                {lang === 'bn' ? 'ক্লাস রুটিন - ২০২৫' : 'Class Routine - 2025'}
              </div>
              <div className="mt-2 text-xl font-black text-slate-700">
                {lang === 'bn' ? `শ্রেণি: ${cls.class_name}` : `Class: ${cls.class_name}`}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
              <table className="w-full border-collapse border-2 border-slate-900">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-900">
                    <th className="border-r-2 border-slate-900 p-3 text-sm font-black w-24">সময়</th>
                    {days.map((d: any) => d.id !== 'Friday' && (
                      <th key={d.id} className="border-r-2 border-slate-900 p-3 text-sm font-black">{d.bn}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((slot: any) => (
                    <tr key={slot} className="border-b-2 border-slate-900 last:border-0 h-16">
                      <td className="border-r-2 border-slate-900 p-3 text-center text-[11px] font-black bg-slate-50">
                        {lang === 'bn' ? getBanglaNumber(slot) : slot}
                      </td>
                      {days.map((d: any) => d.id !== 'Friday' && (
                        <td key={d.id} className="border-r-2 border-slate-900 p-1 text-center relative">
                          {(() => {
                            const r = classRoutines.find((item: any) => item.day === d.id && `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` === slot);
                            if (!r) return null;
                            return (
                              <div className="space-y-0.5">
                                <p className={`text-xs font-black ${r.is_break ? 'text-amber-600' : 'text-slate-900'}`}>{r.subject_name}</p>
                                {!r.is_break && (r.teachers as any)?.teacher_name && (
                                  <p className="text-[9px] font-bold text-slate-400 capitalize">{(r.teachers as any).teacher_name}</p>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer / Signatures */}
            <div className="mt-8 flex justify-between items-end px-10">
              <div className="text-center border-t border-slate-400 pt-1 min-w-[150px]">
                <p className="text-[10px] font-bold">{lang === 'bn' ? 'সহকারী শিক্ষক' : 'Assistant Teacher'}</p>
              </div>
              <div className="text-center min-w-[150px] relative">
                <div className="flex items-center justify-center relative mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 40}px` }}>
                   {madrasah?.config_json?.signature_url && (
                     <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 40}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                   )}
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="text-[10px] font-bold">{lang === 'bn' ? 'অধ্যক্ষ / মুহতামিম' : 'Principal / Muhtamim'}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
