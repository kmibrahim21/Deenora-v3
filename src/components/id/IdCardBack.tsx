import React from 'react';
import { Student, Institution } from '../../types';
import QRCode from "react-qr-code";

interface IdCardBackProps {
  student: Student;
  madrasah: Institution | null;
  themeColor: string;
  t: any;
}

export const IdCardBack: React.FC<IdCardBackProps> = ({ student, madrasah, themeColor, t }) => {
  return (
    <div
      className="relative overflow-hidden bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl border border-slate-200 transition-all shrink-0 flex flex-col"
      style={{ width: "280px", height: "448px" }}
    >
      {/* Background Watermark */}
      {madrasah?.logo_url && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none mix-blend-multiply z-0">
          <img
            src={madrasah.logo_url}
            alt="Logo Watermark"
            className="w-[180px] h-[180px] object-contain grayscale"
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* Back Header - Elegant Curve */}
      <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[80px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 280 80"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <path d="M0,0 L280,0 L280,50 Q140,80 0,50 Z" fill={themeColor} opacity={0.1}></path>
        </svg>
      </div>

      {/* Back Header Content */}
      <div className="w-full pt-5 pb-1 px-4 text-center z-10 relative">
        <div className="flex items-center justify-center gap-2">
          {madrasah?.logo_url && (
            <img
              src={madrasah.logo_url}
              className="w-[24px] h-[24px] object-contain rounded-full"
              alt="logo"
              crossOrigin="anonymous"
            />
          )}
          <h3 className="font-bold text-[13px] leading-tight font-noto" style={{ color: themeColor }}>
            {madrasah?.name}
          </h3>
        </div>
        <div className="w-[100px] h-[1px] bg-slate-200 mx-auto mt-2 opacity-50" />
      </div>

      <div className="px-4 py-1.5 flex-1 flex flex-col z-10 relative">
        {/* Rules Section */}
        <div className="mb-2">
          <div
            className="inline-block px-3 py-0.5 rounded-sm text-white text-[9.5px] font-bold font-noto mb-1.5 shadow-sm"
            style={{ backgroundColor: themeColor }}
          >
            {t.instructions}
          </div>
          <ul className="text-[9px] text-slate-700 font-medium font-noto list-disc pl-4 space-y-1 pr-1">
            {t.rules.map((rule: string, idx: number) => (
              <li key={idx} className="leading-tight">
                {rule}
              </li>
            ))}
          </ul>
        </div>

        {/* QR Code Segment - Compact */}
        <div className="my-auto py-1 flex flex-col items-center w-full">
          <div className="p-1 px-1.5 bg-white rounded-lg shadow-sm border border-slate-100 inline-block mb-1">
            <QRCode
              value={`ID:${student.id}|A:${student.admission_number}`}
              size={60}
            />
          </div>
          <p className="text-[9px] font-bold tracking-widest text-slate-500 font-sans">
            {student.admission_number ||
              student.registration_number ||
              student.id.substring(0, 8)}
          </p>
        </div>

        {/* Emergency Contact */}
        <div className="mt-1 w-full bg-slate-50 border border-slate-100/60 rounded-xl p-2">
          <div
            className="inline-block px-2 py-0.5 rounded text-white text-[8px] font-bold font-noto mb-1"
            style={{ backgroundColor: themeColor }}
          >
            {t.emergency}
          </div>
          <div className="flex flex-col gap-1 text-[9px] font-medium text-slate-700 font-sans">
            <div className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-2.5 h-2.5 text-emerald-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              <span className="font-bold tracking-wide">
                {madrasah?.phone || "০১৭XX-XXXXXX"}
              </span>
            </div>
            {madrasah?.email && (
              <div className="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-2.5 h-2.5 text-emerald-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                <span className="font-bold tracking-wide break-all">
                  {madrasah.email}
                </span>
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-2.5 h-2.5 text-emerald-600 mt-[1px] shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="leading-snug flex-1 font-noto">
                {madrasah?.address || "Institution Address Here"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Curve Design */}
      <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[80px]">
        <svg 
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 280 80" 
          preserveAspectRatio="none" 
          className="w-full h-full"
        >
          <path d="M0,80 L280,80 L280,40 Q140,10 0,40 Z" fill={themeColor} opacity={0.08}></path>
          <path d="M0,80 L280,80 L280,30 Q140,0 0,30 Z" fill={themeColor} opacity={0.12}></path>
        </svg>
      </div>

      {/* Bottom Motto Styled */}
      <div className="w-full pb-3.5 pt-1 text-center z-10 relative mt-auto px-5">
        <div className="px-4 py-1 rounded-lg inline-block mx-auto shadow-sm border border-white/50" style={{ backgroundColor: themeColor }}>
          <p className="text-[8.5px] font-bold text-white font-noto tracking-[0.2em] uppercase">
            {t.motto}
          </p>
        </div>
      </div>
    </div>
  );
};
