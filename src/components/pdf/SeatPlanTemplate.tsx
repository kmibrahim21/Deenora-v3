import React from 'react';

interface SeatPlanProps {
  assignments: any[];
  madrasah: { name: string };
  templateId: string;
  lang: 'en' | 'bn';
}

export const SeatPlanTemplate: React.FC<SeatPlanProps> = ({ assignments, madrasah, templateId, lang }) => {
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

  return (
    <div className="w-[794px] bg-white font-noto text-black">
      {Object.keys(rooms).map((roomName, index) => (
        <div key={roomName} className={`p-10 ${index > 0 ? 'page-break-before' : ''}`} style={{ minHeight: '1123px' }}>
          {/* Header Section */}
          <div className="text-center border-b-2 border-double border-gray-800 pb-6 mb-8">
            <h1 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight">{madrasah.name}</h1>
            <div className="inline-block bg-gray-900 text-white px-6 py-1 rounded-full text-sm font-bold tracking-widest uppercase mb-4">
              {t.title}
            </div>
            <div className="flex justify-center items-center gap-4 text-xl font-bold text-gray-700">
              <span className="bg-gray-100 px-4 py-1 rounded-lg border border-gray-200">
                {t.room}: {roomName}
              </span>
            </div>
          </div>
          
          {templateId === 'grid' ? (
            <div className="grid grid-cols-4 gap-4">
              {rooms[roomName].map((a: any, idx: number) => (
                <div key={a.id || idx} className="relative border-2 border-gray-300 rounded-xl p-4 flex flex-col justify-between h-32 shadow-sm hover:shadow-md transition-shadow bg-slate-50/30">
                  <div className="absolute top-0 right-0 bg-gray-800 text-white px-2 py-0.5 rounded-tr-lg rounded-bl-lg text-[10px] font-bold">
                    #{a.seat_number}
                  </div>
                  
                  <div className="mt-1">
                    <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">{t.name}</div>
                    <div className="text-sm font-black text-gray-800 leading-tight truncate">{a.student_name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-2 mt-auto">
                    <div>
                      <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">{t.class}</div>
                      <div className="text-[11px] font-bold text-gray-700 truncate">{a.class_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">{t.roll}</div>
                      <div className="text-[11px] font-bold text-gray-700">{a.roll}</div>
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
                    <th className="p-4 text-left text-xs font-bold uppercase tracking-widest border-r border-gray-700">{t.seat}</th>
                    <th className="p-4 text-left text-xs font-bold uppercase tracking-widest border-r border-gray-700">{t.name}</th>
                    <th className="p-4 text-left text-xs font-bold uppercase tracking-widest border-r border-gray-700">{t.class}</th>
                    <th className="p-4 text-left text-xs font-bold uppercase tracking-widest">{t.roll}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rooms[roomName].map((a: any, idx: number) => (
                    <tr key={a.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-4 font-black text-gray-900 border-r border-gray-100">{a.seat_number}</td>
                      <td className="p-4 font-bold text-gray-800 border-r border-gray-100">{a.student_name}</td>
                      <td className="p-4 text-gray-600 border-r border-gray-100">{a.class_name}</td>
                      <td className="p-4 font-mono font-bold text-gray-700">{a.roll}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-end text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <div>Generated by Madrasah Management System</div>
            <div>{new Date().toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
