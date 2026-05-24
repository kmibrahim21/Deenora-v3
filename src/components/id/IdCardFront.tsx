import React from 'react';
import { Student, Institution } from '../../types';

interface IdCardFrontProps {
  student: Student;
  madrasah: Institution | null;
  themeColor: string;
  t: any;
}

export const IdCardFront: React.FC<IdCardFrontProps> = ({ student, madrasah, themeColor, t }) => {
  return (
    <div
      className="relative overflow-hidden bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl border border-slate-200 transition-all shrink-0 flex flex-col"
      style={{ 
        width: "280px", 
        height: "448px"
      }}
    >
      {/* Top Modern Header Shape */}
      <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[140px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 280 140"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <path d="M0,0 L280,0 L280,110 Q140,140 0,110 Z" fill={themeColor}></path>
          <path d="M0,0 L280,0 L280,105 Q140,135 0,105 Z" fill="white" opacity="0.15"></path>
          <path d="M0,0 L280,0 L280,100 Q140,130 0,100 Z" fill="black" opacity="0.05"></path>
        </svg>
      </div>

      {/* Bottom Wave Vector */}
      <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[60px]">
        <svg 
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 280 60" 
          preserveAspectRatio="none" 
          className="w-full h-full"
        >
          <path d="M0,60 L280,60 L280,30 Q180,0 0,20 Z" fill={themeColor} opacity="0.8"></path>
          <path d="M0,60 L280,60 L280,40 Q140,-10 0,25 Z" fill={themeColor}></path>
        </svg>
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col h-full w-full">
        {/* Header - Logo & Madrasah Info */}
        <div className="flex items-center gap-3 pt-4 px-5">
          <div className="w-[50px] h-[50px] bg-white rounded-full p-[2px] shadow-sm flex items-center justify-center shrink-0">
            {madrasah?.logo_url ? (
              <img src={madrasah.logo_url} alt="Logo" className="w-full h-full object-contain rounded-full" crossOrigin="anonymous" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center text-[20px] font-black" style={{ color: themeColor }}>
                {madrasah?.name?.charAt(0) || "M"}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-[15px] leading-tight font-noto tracking-wide drop-shadow-md">
              {madrasah?.name || "Institution Name"}
            </h3>
            <p className="text-white/95 text-[8px] font-medium tracking-wide mt-[2px]">
              {madrasah?.address || "Dhaka, Bangladesh"}
            </p>
          </div>
        </div>

        {/* Photo & Title Section */}
        <div className="flex flex-col items-center mt-3.5 w-full relative z-10 px-5">
          {/* Photo Frame */}
          <div className="w-[75px] h-[85px] bg-white border-[2.5px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            {student.photo_url ? (
              <img src={student.photo_url} alt="Photo" className="w-full h-full object-cover" crossOrigin="anonymous"/>
            ) : (
              <svg className="text-slate-200 w-[36px] h-[36px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            )}
          </div>

          {/* Title */}
          <div className="mt-2 px-3 py-0.5 rounded-full text-white text-[8.5px] font-bold shadow-sm tracking-widest border border-white/20 uppercase inline-block" style={{ backgroundColor: themeColor }}>
            {t.idBadge}
          </div>

          {/* Name */}
          <div className="mt-1.5 text-center px-2">
            <h2 className="font-extrabold text-[18px] font-noto leading-[1.1] tracking-tight" style={{ color: themeColor }}>
              {student.student_name || 'Student Name'}
            </h2>
          </div>
        </div>

        {/* Data Fields */}
        <div className="px-5 w-full flex flex-col gap-[5px] mt-2.5 z-10 relative">
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.class}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none font-noto">{(student as any).classes?.class_name || (student as any).class_name || "-"}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.id}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none font-sans tracking-wide">{student.admission_number || student.registration_number || student.id.substring(0, 8)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.dob}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none font-sans tracking-wide">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : "-"}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.blood}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-black text-red-600 leading-none font-sans">{student.blood_group || "-"}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.father}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none truncate block max-w-[155px] font-noto">{student.guardian_name || "-"}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.mother}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none truncate block max-w-[155px] font-noto">{student.mother_name || "-"}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.address}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none truncate block max-w-[155px] font-noto">{student.address || "-"}</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-noto">{t.issueDate}</span>
            <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
            <span className="text-[11.5px] font-extrabold text-slate-800 leading-none font-sans tracking-wide">{new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full flex justify-between items-end mt-auto px-5 pb-3 relative z-10">
          {/* Signature */}
          <div className="text-center w-[70px]">
            <div className="h-[20px] flex items-end justify-center mb-[2px]">
              <img
                src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgNDAiPjxwYXRoIGQ9Ik0xMCAzMGM1LTUgMTAtMTAgMTEtMTVzLTIgMTAtNSAxNWMyLTUgNS0xMCAxMC0xNCA1LTMgOC01IDEwLTJzLTEgNS0zIDEwYzIgMCA0LTIgNi0zIDItejIgNCAwLTUgOC01IDQgMyAyIDEwLTMgMTRjLTIgMi01IDUtOCAxLTItMy0xLTYgMi04cyA1LTIgNyAwbDEgM2MyLTIgMy01IDUtNyAyLTIgNCAwIDUtMnMyIDEwLTMgMTQtMSA0IDMgNSA2IDVjLTItNSA1LTIgNyAwczIgNiAwIDEwIiBmaWxsPSJub25lIiBzdHJva2U9IiM0NzU1NjkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+"
                className="w-[38px] opacity-70 mix-blend-multiply"
                alt="Sig"
              />
            </div>
            <div className="w-full h-[1px] bg-white/50 mb-0.5" />
            <p className="text-[6.5px] font-bold text-white font-noto uppercase tracking-wider shadow-sm">
              {t.principal}
            </p>
          </div>
          {/* Expiry */}
          <div className="text-right flex flex-col items-end">
            <p className="text-[7.5px] font-black tracking-widest text-white px-1 shadow-sm">
              {t.validity}: {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
