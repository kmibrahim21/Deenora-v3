import React from 'react';

interface SeatPlanProps {
  assignments: any[];
  madrasah: { name: string };
  templateId: string;
  lang: 'en' | 'bn';
  examName?: string;
}

export const SeatPlanTemplate: React.FC<SeatPlanProps> = ({ assignments, madrasah, templateId, lang, examName }) => {
  const isBangla = lang === 'bn';
  const t = {
    title: isBangla ? 'আসন বিন্যাস' : 'Seat Plan',
    seat: isBangla ? 'আসন' : 'Seat',
    name: isBangla ? 'নাম' : 'Name',
    class: isBangla ? 'শ্রেণি' : 'Class',
    roll: isBangla ? 'রোল' : 'Roll',
    room: isBangla ? 'কক্ষ' : 'Room'
  };

  // Group by Room
  const rooms: any = {};
  assignments.forEach((a) => {
    if (!rooms[a.room_name]) rooms[a.room_name] = [];
    rooms[a.room_name].push(a);
  });

  const config = (madrasah as any)?.config_json || {};

  const ITEMS_PER_PAGE = templateId === 'grid' ? 15 : 20;

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
    <div className="w-[794px] bg-white font-noto text-black">
      {pages.map((page, index) => (
        <div key={`${page.roomName}-${index}`} className="p-8 flex flex-col justify-between page-break-after" style={{ width: '794px', height: '1123px', boxSizing: 'border-box' }}>
          <div>
            {/* Header Section */}
            <div className="text-center border-b-2 border-double border-gray-800 pb-4 mb-6">
              <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight" style={{ lineHeight: '1.2' }}>{madrasah.name}</h1>
              <div className="inline-block bg-gray-900 text-white px-5 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-3 text-center">
                {t.title} {examName ? ` - ${examName}` : ''}
              </div>
              <div className="flex justify-center items-center gap-4 text-lg font-bold text-gray-700">
                <span className="bg-gray-100 px-4 py-1 rounded-lg border border-gray-200">
                  {t.room}: {page.roomName}
                </span>
              </div>
            </div>
            
            {templateId === 'grid' ? (
              <div className="grid grid-cols-3 gap-5">
                {page.students.map((a: any, idx: number) => (
                  <div key={a.id || idx} className="relative border-2 border-gray-300 rounded-xl p-3 flex flex-col justify-between h-[150px] shadow-sm bg-slate-50/30 overflow-hidden">
                    <div className="absolute top-0 right-0 bg-gray-800 text-white px-2.5 py-0.5 rounded-bl-xl text-[10px] font-black z-10">
                      {isBangla ? `আসন ${a.seat_number}` : `Seat ${a.seat_number}`}
                    </div>

                    <div className="border-b border-dashed border-gray-200 pb-1.5 px-6 text-center shrink-0">
                      <div className="text-[10px] font-black text-gray-900 leading-tight break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {madrasah.name}
                      </div>
                      {examName ? (
                        <div className="text-[9px] font-extrabold text-[#2563EB] truncate leading-none mt-1">
                          {examName}
                        </div>
                      ) : (
                        <div className="text-[9px] font-extrabold text-[#2563EB] truncate leading-none mt-1">
                          {isBangla ? 'আসন কার্ড' : 'Seat Card'}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-1 flex-1 min-h-0 relative z-0 pr-2">
                      <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{t.name}</div>
                      <div className="text-[13px] font-black text-gray-800 leading-snug break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.student_name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-1 shrink-0">
                      <div>
                        <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{t.class}</div>
                        <div className="text-xs font-bold text-gray-700 truncate">{a.class_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{t.roll}</div>
                        <div className="text-xs font-black font-mono text-gray-800 truncate">{a.roll}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      <th className="p-3 text-left text-xs font-bold uppercase tracking-widest border-r border-gray-700 w-20">{t.seat}</th>
                      <th className="p-3 text-left text-xs font-bold uppercase tracking-widest border-r border-gray-700">{t.name}</th>
                      <th className="p-3 text-left text-xs font-bold uppercase tracking-widest border-r border-gray-700 w-32">{t.class}</th>
                      <th className="p-3 text-left text-xs font-bold uppercase tracking-widest w-24">{t.roll}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {page.students.map((a: any, idx: number) => (
                      <tr key={a.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-3 font-black text-gray-900 border-r border-gray-100">{a.seat_number}</td>
                        <td className="p-3 font-bold text-gray-800 border-r border-gray-100 truncate max-w-[250px]">{a.student_name}</td>
                        <td className="p-3 text-gray-600 border-r border-gray-100 truncate max-w-[120px]">{a.class_name}</td>
                        <td className="p-3 font-mono font-black text-gray-800">{a.roll}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-gray-100 flex justify-between items-end text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-auto shrink-0">
            <div>
               <div className="flex flex-col items-start mb-1">
                  <div className="flex items-center justify-center relative" style={{ height: `${config.signature_height || 30}px` }}>
                    {config.signature_url && (
                      <img src={config.signature_url} style={{ height: `${config.signature_height || 30}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                    )}
                  </div>
                  <div className="w-32 border-b border-gray-200 mt-1"></div>
                  <span className="mt-1">{isBangla ? 'প্রধান শিক্ষকের স্বাক্ষর' : 'Principal Signature'}</span>
               </div>
               Generated by Madrasah Management System
            </div>
            <div>{new Date().toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
