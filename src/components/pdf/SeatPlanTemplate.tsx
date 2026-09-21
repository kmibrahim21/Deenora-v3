import React from 'react';

interface SeatPlanProps {
  assignments: any[];
  madrasah: any;
  templateId: string;
  lang: 'en' | 'bn';
  examName?: string;
}

export const SeatPlanTemplate: React.FC<SeatPlanProps> = ({ assignments, madrasah, templateId, lang, examName }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'আসন বিন্যাস' : 'Seat Plan',
    seat: isBangla ? 'আসন' : 'Seat',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    class: isBangla ? 'শ্রেণি' : 'Class',
    roll: isBangla ? 'রোল' : 'Roll',
    room: isBangla ? 'কক্ষ' : 'Room',
    signature: isBangla ? 'প্রধান শিক্ষকের স্বাক্ষর' : 'Principal Signature',
    seatCard: isBangla ? 'আসন কার্ড' : 'Seat Card',
  };

  // Group by Room
  const rooms: Record<string, any[]> = {};
  assignments.forEach((a) => {
    const roomKey = a.room_name || 'সাধারণ কক্ষ';
    if (!rooms[roomKey]) rooms[roomKey] = [];
    rooms[roomKey].push(a);
  });

  const config = madrasah?.config_json;
  let configObj: any = config;
  if (typeof config === 'string') {
    try {
      configObj = JSON.parse(config);
    } catch (e) {
      configObj = {} as any;
    }
  }
  const safeConfig = (configObj || {}) as any;

  // 12 cards per page (3 columns x 4 rows) for Grid view provides optimal card size on A4
  const ITEMS_PER_PAGE = templateId === 'grid' ? 12 : 18;

  const pages: any[] = [];
  
  Object.keys(rooms).forEach(roomName => {
    const students = rooms[roomName];
    for (let i = 0; i < students.length; i += ITEMS_PER_PAGE) {
      pages.push({
        roomName,
        students: students.slice(i, i + ITEMS_PER_PAGE),
        pageNumber: pages.length + 1
      });
    }
  });

  return (
    <div className="w-[794px] bg-white font-solaiman text-slate-900">
      {pages.map((page, index) => (
        <div 
          key={`${page.roomName}-${index}`} 
          className="p-8 flex flex-col justify-between page-break-after" 
          style={{ width: '794px', height: '1123px', boxSizing: 'border-box' }}
        >
          <div>
            {/* Header Section */}
            <div className="text-center border-b-2 border-double border-slate-800 pb-2 mb-3">
              <h1 className="text-2xl font-black text-slate-900 mb-1 leading-tight break-words px-2">
                {madrasah?.name || 'মাদরাসা নাম'}
              </h1>
              {examName && (
                <div className="text-base font-black text-[#2563EB] mb-1.5 leading-tight text-center">
                  {examName}
                </div>
              )}
              <div className="flex justify-center items-center gap-3 text-xs font-black text-slate-700 mb-1">
                <span className="bg-slate-900 text-white px-4 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase">
                  {t.title}
                </span>
                <span className="bg-slate-100 px-3 py-0.5 rounded-lg border border-slate-200">
                  {t.room}: {page.roomName}
                </span>
              </div>
            </div>
            
            {templateId === 'grid' ? (
              <div className="grid grid-cols-3 gap-3">
                {page.students.map((a: any, idx: number) => (
                  <div 
                    key={a.id || idx} 
                    className="relative border-2 border-slate-300 rounded-2xl p-2.5 flex flex-col justify-between h-[195px] bg-white shadow-xs box-border"
                  >
                    {/* Top Meta Bar: Seat Card Tag & Seat Number */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 shrink-0">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t.seatCard}</span>
                      <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-md text-[10.5px] font-black shadow-xs">
                        {isBangla ? `আসন ${a.seat_number}` : `Seat ${a.seat_number}`}
                      </span>
                    </div>

                    {/* Center: Institution Name & Exam Name (Centered, Full Width) */}
                    <div className="text-center pb-1.5 border-b border-dashed border-slate-200 shrink-0">
                      <div className="text-[12px] font-black text-slate-950 leading-tight break-words px-1">
                        {madrasah?.name || 'মাদরাসা নাম'}
                      </div>
                      <div className="text-[10px] font-black text-[#2563EB] leading-tight break-words mt-0.5 px-1">
                        {examName || t.seatCard}
                      </div>
                    </div>
                    
                    {/* Student Name Middle Section - Guaranteed visibility, no clipping */}
                    <div className="flex-1 flex flex-col justify-center py-1 px-0.5 min-h-[44px]">
                      <div className="text-[7.5px] uppercase font-bold text-slate-400 tracking-wider mb-0.5 leading-none">
                        {t.name}
                      </div>
                      <div className="text-[13px] font-black text-slate-950 leading-snug break-words">
                        {a.student_name}
                      </div>
                    </div>

                    {/* Bottom Class & Roll Row */}
                    <div className="grid grid-cols-2 gap-1.5 border-t border-slate-200 pt-1 shrink-0">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 min-w-0">
                        <div className="text-[7px] uppercase font-black text-slate-400 tracking-wider leading-none mb-0.5">{t.class}</div>
                        <div className="text-[11px] font-black text-slate-800 truncate leading-tight">{a.class_name}</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5 text-right min-w-0">
                        <div className="text-[7px] uppercase font-black text-blue-400 tracking-wider leading-none mb-0.5">{t.roll}</div>
                        <div className="text-[12px] font-black font-mono text-[#2563EB] truncate leading-tight">{a.roll}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-300 shadow-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700 w-20">{t.seat}</th>
                      <th className="p-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700">{t.name}</th>
                      <th className="p-3 text-left text-xs font-black uppercase tracking-widest border-r border-slate-700 w-36">{t.class}</th>
                      <th className="p-3 text-left text-xs font-black uppercase tracking-widest w-24">{t.roll}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {page.students.map((a: any, idx: number) => (
                      <tr key={a.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="p-3 font-black text-slate-900 border-r border-slate-200">{a.seat_number}</td>
                        <td className="p-3 font-black text-slate-800 border-r border-slate-200 break-words">{a.student_name}</td>
                        <td className="p-3 font-bold text-slate-700 border-r border-slate-200 break-words">{a.class_name}</td>
                        <td className="p-3 font-mono font-black text-[#2563EB]">{a.roll}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-400 font-black uppercase tracking-widest mt-auto shrink-0">
            <div>
               <div className="flex flex-col items-start mb-1">
                  <div className="flex items-center justify-center relative" style={{ height: `${safeConfig.signature_height || 30}px` }}>
                    {safeConfig.signature_url && (
                      <img src={safeConfig.signature_url} style={{ height: `${safeConfig.signature_height || 30}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                    )}
                  </div>
                  <div className="w-32 border-b border-slate-300 mt-1"></div>
                  <span className="mt-1 text-slate-600">{t.signature}</span>
               </div>
               Generated by Deenora Management System
            </div>
            <div>{new Date().toLocaleDateString('bn-BD')}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
