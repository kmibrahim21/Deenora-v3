import React from 'react';
import { createRoot } from 'react-dom/client';
import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { Exam, Student } from '../types';
import QRCode from 'react-qr-code';
import { User, FileText, Calendar, GraduationCap, Clock, Home, BookOpen, AlertTriangle, MapPin } from 'lucide-react';

interface AdmitCardProps {
  exam: any;
  student: Student;
  madrasah: any;
  templateId?: string;
  lang: 'en' | 'bn';
}

const AdmitCardTemplate: React.FC<AdmitCardProps> = ({ exam, student, madrasah, templateId = 'modern', lang }) => {
  const isBangla = lang === 'bn';
  const fontFamily = isBangla ? "'Noto Serif Bengali', serif" : "'Times New Roman', serif";

  const toBanglaNum = (num: any) => {
    if (num === undefined || num === null || num === '') return '';
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (digit: string) => banglaDigits[parseInt(digit)]);
  };

  const getNameStyles = (name: string) => {
    const len = name ? name.length : 0;
    // Keep the name bold and beautiful on a single line with larger sizes, without truncation unless absolutely extreme
    if (len > 45) {
      return {
        h1Class: 'text-[22px] sm:text-[23px] font-black text-[#0c4a7e] tracking-tight leading-tight pt-[3px] mb-0.5 whitespace-normal break-words line-clamp-2 max-w-full mx-auto',
        addrClass: 'text-[11.5px] font-bold text-[#0c4a7e]/85 max-w-[95%] mx-auto mb-0.5 leading-normal pt-[1px] break-words line-clamp-1',
        infoClass: 'flex items-center justify-center whitespace-nowrap flex-nowrap gap-x-2 gap-y-0.5 text-[10.5px] font-bold text-[#0c4a7e]/80 max-w-full mx-auto leading-normal pt-[1px]'
      };
    }
    if (len > 35) {
      return {
        h1Class: 'text-[24px] sm:text-[25px] font-black text-[#0c4a7e] tracking-tight leading-tight pt-[3px] mb-0.5 whitespace-normal break-words line-clamp-2 max-w-full mx-auto',
        addrClass: 'text-[12px] font-bold text-[#0c4a7e]/85 max-w-[95%] mx-auto mb-0.5 leading-normal pt-[1px] break-words line-clamp-1',
        infoClass: 'flex items-center justify-center whitespace-nowrap flex-nowrap gap-x-2 gap-y-0.5 text-[11px] font-bold text-[#0c4a7e]/80 max-w-full mx-auto leading-normal pt-[1px]'
      };
    }
    if (len > 26) {
      return {
        h1Class: 'text-[28px] sm:text-[29px] font-black text-[#0c4a7e] tracking-tight leading-tight pt-[3px] mb-0.5 whitespace-normal break-words line-clamp-2 max-w-full mx-auto',
        addrClass: 'text-[12.5px] font-bold text-[#0c4a7e]/85 max-w-[95%] mx-auto mb-0.5 leading-normal pt-[1px] break-words line-clamp-1',
        infoClass: 'flex items-center justify-center whitespace-nowrap flex-nowrap gap-x-2 gap-y-0.5 text-[11.5px] font-bold text-[#0c4a7e]/80 max-w-full mx-auto leading-normal pt-[1px]'
      };
    }
    if (len > 18) {
      return {
        h1Class: 'text-[33px] sm:text-[34px] font-black text-[#0c4a7e] tracking-tight leading-tight pt-[4px] mb-1 whitespace-normal break-words line-clamp-2 max-w-full mx-auto',
        addrClass: 'text-[13px] font-bold text-[#0c4a7e]/85 max-w-[95%] mx-auto mb-1 leading-normal pt-[1px] break-words line-clamp-1',
        infoClass: 'flex items-center justify-center whitespace-nowrap flex-nowrap gap-x-2 gap-y-0.5 text-[12px] font-bold text-[#0c4a7e]/80 max-w-full mx-auto leading-normal py-0.5 pt-[2px]'
      };
    }
    return {
      h1Class: 'text-[36px] sm:text-[38px] font-black text-[#0c4a7e] tracking-tight leading-tight pt-[4px] mb-1 whitespace-normal break-words line-clamp-2 max-w-full mx-auto',
      addrClass: 'text-[14px] font-bold text-[#0c4a7e]/85 max-w-[95%] mx-auto mb-1 leading-normal pt-[1px] break-words line-clamp-1',
      infoClass: 'flex items-center justify-center whitespace-nowrap flex-nowrap gap-x-2 gap-y-0.5 text-[13px] font-bold text-[#0c4a7e]/80 max-w-full mx-auto leading-normal py-0.5 pt-[2px]'
    };
  };
  
  if (templateId === 'admission') {
    const headerStyles = getNameStyles(madrasah.name);
    const studentData = {
      roll: student.roll || '-',
      application: student.registration_number || student.roll?.toString() || '-',
      name: student.student_name,
      father: student.guardian_name || '-',
      mother: student.mother_name || '-',
      dob: student.date_of_birth || '-',
      class: student.classes?.class_name || '-',
      group: student.department || (isBangla ? 'সাধারণ' : 'General'),
      shift: (student as any).shift || (isBangla ? 'দিবা' : 'Day'),
      examDate: exam.exam_date || '-',
      examTime: exam.start_time || (isBangla ? '১০:০০ টা' : '10:00 AM'),
      examCenter: exam.exam_center || madrasah.name,
      mobile: student.guardian_phone || '-',
      bloodGroup: student.blood_group || '-'
    };

    return (
      <div className="w-[190mm] h-[135mm] bg-white border-[3.5px] border-[#0c4a7e] rounded-[16px] overflow-hidden relative shadow-md flex flex-col justify-between p-[3.5mm] pb-[8mm]" style={{ fontFamily }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Charm:wght@400;700&family=Noto+Serif+Bengali:wght@400;700;900&family=Tiro+Bangla:ital@0;1&display=swap');
        `}</style>
        
        {/* Background Watermark */}
        {madrasah.logo_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
            <img src={madrasah.logo_url} className="w-[85mm] h-[85mm] object-contain" crossOrigin="anonymous" />
          </div>
        )}

        {/* Top Header Section */}
        <div className="flex items-center justify-between w-full h-[28mm] z-10 relative">
          {/* Left: Beautiful Shield Crest Logo on white background */}
          <div className="w-[24mm] flex items-center justify-start flex-shrink-0 pl-[2mm]">
            {madrasah.logo_url ? (
              <div className="w-[22mm] h-[22mm] flex items-center justify-center p-0.5 border border-slate-200/50 rounded-md bg-white shadow-3xs">
                <img src={madrasah.logo_url} className="w-full h-full object-contain" crossOrigin="anonymous" />
              </div>
            ) : (
              /* Fallback: Matching SVG Shield Crest exactly matching the reference style */
              <div className="w-[22mm] h-[22mm] flex items-center justify-center relative">
                <svg viewBox="0 0 100 100" className="w-full h-full text-[#0c4a7e]">
                  <path d="M50,8 C75,8 85,18 85,42 C85,72 50,88 50,88 C50,88 15,72 15,42 C15,18 25,8 50,8 Z" fill="#0c4a7e" stroke="#0c4a7e" strokeWidth="2" />
                  <path d="M50,12 C72,12 81,21 81,42 C81,68 50,83 50,83 C50,83 19,68 19,42 C19,21 28,12 50,12 Z" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="50" cy="38" r="8" fill="#FFF" />
                  <path d="M50,22 L50,27 M50,49 L50,54 M34,38 L39,38 M61,38 L66,38 M38,26 L42,30 M62,26 L58,30 M38,50 L42,46 M62,50 L58,46" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M50,51 C46,47 36,47 32,49 L32,61 C36,59 46,59 50,62 C54,59 64,59 68,61 L68,49 C64,47 54,47 50,51 Z" fill="#FFF" />
                  <path d="M50,51 L50,62" stroke="#0c4a7e" strokeWidth="1" />
                  <path d="M10,76 L25,72 L50,77 L75,72 L90,76 L80,84 L50,80 L20,84 Z" fill="#FFF" stroke="#0c4a7e" strokeWidth="0.8" />
                  <text x="50" y="81" fill="#0c4a7e" fontSize="5" fontWeight="black" textAnchor="middle" fontFamily="'Noto Serif Bengali', sans-serif">শিক্ষাই আলো</text>
                </svg>
              </div>
            )}
          </div>

          {/* Center: Madrasah Name & Subtitles */}
          <div className="flex-1 text-center pr-[42mm] pl-[2mm] flex flex-col justify-center h-full">
            <h1 className={headerStyles.h1Class} style={{ fontFamily: isBangla ? "'Tiro Bangla', 'Noto Serif Bengali', serif" : "'Times New Roman', serif" }}>
              {madrasah.name}
            </h1>
            <p className={headerStyles.addrClass}>
              {isBangla ? 'ঠিকানা : ' : 'Address: '}{madrasah.address || (isBangla ? 'কয়রাবাজার, উপজেলা : কয়রা, জেলা : খুলনা ।' : 'Koyrabazar, Koyra, Khulna')}
            </p>
            <div className={headerStyles.infoClass}>
              <span className="flex items-center gap-1">
                <span>{isBangla ? 'ইমেইল : ' : 'Email: '}</span>
                <span>{madrasah.email || 'info@madrasah.com'}</span>
              </span>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1">
                <span>{isBangla ? 'মোবাইল : ' : 'Mobile: '}</span>
                <span>{isBangla ? toBanglaNum(madrasah.phone || '01700000000') : (madrasah.phone || '01700000000')}</span>
              </span>
            </div>
          </div>

          {/* Right: Beautiful Dark Blue Slanted Polygon Title Panel */}
          <div 
            className="w-[42mm] h-[26mm] bg-[#0c4a7e] text-white flex flex-col items-center justify-center px-4 pl-5 absolute top-0 right-0 z-20 shadow-sm"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 15% 100%)' }}
          >
             <div className="text-center w-full pt-[3px]">
                <h2 className="text-[19px] font-black tracking-wide leading-normal pt-1.5 mb-[1px]">{isBangla ? 'এডমিট কার্ড' : 'ADMIT CARD'}</h2>
                
                {/* Underline decorative lines with central diamond */}
                <div className="w-[30mm] flex items-center justify-center my-[3px] opacity-75 mx-auto">
                  <div className="h-[0.5px] bg-white flex-1"></div>
                  <div className="mx-1 text-[8.5px] leading-none">◇</div>
                  <div className="h-[0.5px] bg-white flex-1"></div>
                </div>
                
                <p className="text-[12px] font-bold tracking-wide truncate leading-normal pt-[2px]">
                  {isBangla ? 'শ্রেণি : ' : 'Class : '}{studentData.class}
                </p>
                <p className="text-[12px] font-bold tracking-wide mt-0.5 truncate leading-normal pt-[2px]">
                  {isBangla ? 'শিক্ষাবর্ষ : ' : 'Session : '}{isBangla ? toBanglaNum(exam.exam_year || new Date().getFullYear()) : (exam.exam_year || new Date().getFullYear())}
                </p>
             </div>
          </div>
        </div>

        {/* Horizontal Divider with Decorative Diamond & Centered Exam Name */}
        <div className="flex items-center justify-center my-1 relative z-10 w-full">
          <div className="h-[1px] bg-[#0c4a7e]/30 flex-1"></div>
          <div className="mx-3 bg-[#0c4a7e]/10 border border-[#0c4a7e]/30 px-5 py-1 pt-1.5 pb-1 rounded-full text-[14.5px] font-black text-[#0c4a7e] tracking-wide shadow-3xs flex items-center gap-1.5 leading-normal">
            <span>★</span>
            <span>{exam.exam_name || (isBangla ? 'বার্ষিক পরীক্ষা' : 'Annual Examination')}</span>
            <span>★</span>
          </div>
          <div className="h-[1px] bg-[#0c4a7e]/30 flex-1"></div>
        </div>

        {/* Candidate Information Card */}
        <div className="border-[1.2px] border-[#0c4a7e]/45 rounded-[12px] p-[3mm] pt-[5mm] relative bg-white z-10 w-full flex h-[52mm] mb-[2.5mm] shadow-3xs">
          {/* Overlapping Badge Header */}
          <div className="absolute -top-3 left-5 bg-[#0c4a7e] text-white px-3.5 pt-1.5 pb-1 rounded-[6px] text-[12.5px] font-black flex items-center gap-1.5 shadow-sm z-20 leading-normal">
            <User size={11.5} className="text-white fill-white/10" />
            <span>{isBangla ? 'পরীক্ষার্থীর তথ্য' : 'Candidate Information'}</span>
          </div>

          {/* Two Candidate Data Columns */}
          <div className="flex-1 grid grid-cols-2 gap-x-5 gap-y-1 pr-3 h-full">
            {/* Left Column */}
            <div className="flex flex-col justify-between h-full">
              {[
                { label: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name', value: studentData.name, icon: <User size={11} /> },
                { label: isBangla ? 'রোল নম্বর' : 'Roll No', value: isBangla ? toBanglaNum(studentData.roll) : studentData.roll, icon: <User size={11} /> },
                { label: isBangla ? 'রেজিস্ট্রেশন নম্বর' : 'Reg No', value: isBangla ? toBanglaNum(studentData.application) : studentData.application, icon: <FileText size={11} /> },
                { label: isBangla ? 'শ্রেণি' : 'Class', value: studentData.class, icon: <GraduationCap size={11} /> },
                { label: isBangla ? 'শাখা' : 'Section', value: studentData.group, icon: <BookOpen size={11} /> },
              ].map((row, idx) => (
                <div key={idx} className="flex items-center text-[12.5px] border-b border-dashed border-[#0c4a7e]/15 pb-[1px] min-h-[7.5mm] h-auto py-[1px]">
                  <div className="w-[6.2mm] h-[6.2mm] bg-[#0c4a7e] text-white rounded-full flex items-center justify-center flex-shrink-0 mr-2.5 shadow-3xs">
                    {row.icon}
                  </div>
                  <div className="w-[27mm] font-extrabold text-[#0c4a7e]/85 text-[12px] truncate leading-normal pt-[2px]">{row.label}</div>
                  <div className="w-2.5 font-black text-[#0c4a7e] text-[12.5px]">:</div>
                  <div className="font-extrabold text-[#0c4a7e] flex-1 ml-1 line-clamp-2 break-words leading-normal pt-[1px]" style={{ fontSize: row.value && row.value.length > 24 ? '11px' : row.value && row.value.length > 15 ? '12px' : '13.5px' }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Center/Right Column */}
            <div className="flex flex-col justify-between h-full">
              {[
                { label: isBangla ? 'পিতার নাম' : 'Father Name', value: studentData.father, icon: <User size={11} /> },
                { label: isBangla ? 'মাতার নাম' : 'Mother Name', value: studentData.mother, icon: <User size={11} /> },
                { label: isBangla ? 'জন্ম তারিখ' : 'Date of Birth', value: isBangla ? toBanglaNum(studentData.dob) : studentData.dob, icon: <Calendar size={11} /> },
                { label: isBangla ? 'পরীক্ষার তারিখ' : 'Exam Date', value: isBangla ? toBanglaNum(studentData.examDate) : studentData.examDate, icon: <Clock size={11} /> },
                { label: isBangla ? 'পরীক্ষা কেন্দ্র' : 'Exam Center', value: studentData.examCenter, icon: <MapPin size={11} /> },
              ].map((row, idx) => (
                <div key={idx} className="flex items-center text-[12.5px] border-b border-dashed border-[#0c4a7e]/15 pb-[1px] min-h-[7.5mm] h-auto py-[1px]">
                  <div className="w-[6.2mm] h-[6.2mm] bg-[#0c4a7e] text-white rounded-full flex items-center justify-center flex-shrink-0 mr-2.5 shadow-3xs">
                    {row.icon}
                  </div>
                  <div className="w-[27mm] font-extrabold text-[#0c4a7e]/85 text-[12px] truncate leading-normal pt-[2px]">{row.label}</div>
                  <div className="w-2.5 font-black text-[#0c4a7e] text-[12.5px]">:</div>
                  <div className="font-extrabold text-[#0c4a7e] flex-1 ml-1 line-clamp-2 break-words leading-normal pt-[1px]" style={{ fontSize: row.value && row.value.length > 24 ? '11px' : row.value && row.value.length > 15 ? '12px' : '13.5px' }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Far Right: Candidate Photo & Signature Box */}
          <div className="w-[34mm] border-l border-[#0c4a7e]/15 pl-4 flex flex-col items-center justify-between h-full flex-shrink-0">
            <div className="w-[24mm] h-[25mm] border-[1.2px] border-[#0c4a7e]/50 p-0.5 rounded bg-white overflow-hidden shadow-3xs flex-shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} className="w-full h-full object-cover rounded-3xs" crossOrigin="anonymous" />
              ) : (
                <div className="w-full h-full bg-slate-50 flex items-center justify-center text-[11px] text-slate-400 font-bold leading-normal pt-[2px]">
                  {isBangla ? 'ছবি' : 'PHOTO'}
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-center w-full mt-auto mb-1">
              <div className="h-4 w-[26mm] border-b border-dashed border-[#0c4a7e]/35"></div>
              <p className="text-[10.5px] font-black text-[#0c4a7e]/85 text-center leading-normal mt-2 pt-[3px]">{isBangla ? 'শিক্ষার্থীর স্বাক্ষর' : 'Student Signature'}</p>
            </div>
          </div>
        </div>

        {/* Instructions Box */}
        <div className="border-[1.2px] border-[#0c4a7e]/45 rounded-[12px] p-[3mm] pt-[5mm] relative bg-white z-10 w-full flex h-[33mm] shadow-3xs mb-[1mm]">
          {/* Overlapping Badge Header */}
          <div className="absolute -top-3 left-5 bg-[#0c4a7e] text-white px-3.5 pt-1.5 pb-1 rounded-[6px] text-[12.5px] font-black flex items-center gap-1.5 shadow-sm z-20 leading-normal">
            <FileText size={11.5} className="text-white fill-white/10" />
            <span>{isBangla ? 'পরীক্ষার্থীদের জন্য নির্দেশাবলী' : 'Instructions for Candidates'}</span>
          </div>

          {/* Left: Bullet Points List */}
          <div className="w-[58%] text-[10px] font-bold text-[#0c4a7e]/95 space-y-[2px] leading-normal flex flex-col justify-center pt-1">
            <div className="flex items-start gap-1">
              <span className="text-[#0c4a7e] text-[11px] leading-normal">•</span>
              <span className="leading-normal pt-[1px]">{isBangla ? 'পরীক্ষার হলে প্রবেশের সময় এডমিট কার্ড অবশ্যই সাথে আনতে হবে।' : 'Candidates must bring the admit card to enter the exam hall.'}</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-[#0c4a7e] text-[11px] leading-normal">•</span>
              <span className="leading-normal pt-[1px]">{isBangla ? 'পরীক্ষা শুরু ৩০ মিনিট পূর্বে কেন্দ্রে উপস্থিত থাকতে হবে।' : 'Arrive at the center at least 30 minutes before exam starts.'}</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-[#0c4a7e] text-[11px] leading-normal">•</span>
              <span className="leading-normal pt-[1px]">{isBangla ? 'কোন প্রকার মোবাইল ফোন, ক্যালকুলেটর বা ইলেকট্রনিক ডিভাইস বহন করা যাবে না।' : 'Mobile phones, calculators, or any electronic devices are strictly prohibited.'}</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-[#0c4a7e] text-[11px] leading-normal">•</span>
              <span className="leading-normal pt-[1px]">{isBangla ? 'নকল বা অসদুপায় অবলম্বন করলে সংশ্লিষ্ট পরীক্ষার্থীর বিরুদ্ধে আইনানুগ ব্যবস্থা নেওয়া হবে।' : 'Any unfair means adopted will result in direct cancellation and action.'}</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-[#0c4a7e] text-[11px] leading-normal">•</span>
              <span className="leading-normal pt-[1px]">{isBangla ? 'এডমিট কার্ড হারালে বা নষ্ট হলে সংশ্লিষ্ট অফিস থেকে সংগ্রহ করতে হবে।' : 'In case of loss/damage, collect duplicate card from the office.'}</span>
            </div>
          </div>

          {/* Right: Signatures Columns */}
          <div className="w-[42%] border-l border-[#0c4a7e]/15 pl-4 flex items-end justify-around h-full py-0.5 gap-3 flex-shrink-0">
            <div className="flex flex-col items-center flex-1 text-center">
              <div className="h-6 flex items-end justify-center mb-[1px]">
                {/* Blank space for manual signature */}
              </div>
              <div className="w-full border-t border-[#0c4a7e]/40 mb-[1px]"></div>
              <p className="text-[10px] font-black text-[#0c4a7e] text-center leading-normal pt-1">{isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Exam Controller'}</p>
            </div>

            <div className="flex flex-col items-center flex-1 text-center">
              <div className="h-6 flex items-end justify-center mb-[1px]">
                {madrasah?.config_json?.signature_url && (
                  <img src={madrasah.config_json.signature_url} className="h-6 object-contain mix-blend-multiply" crossOrigin="anonymous" />
                )}
              </div>
              <div className="w-full border-t border-[#0c4a7e]/40 mb-[1px]"></div>
              <p className="text-[10px] font-black text-[#0c4a7e] text-center leading-normal pt-1">{(madrasah.institution_type === 'school') ? (isBangla ? 'প্রধান শিক্ষক' : 'Principal / Headmaster') : (isBangla ? 'অধ্যক্ষ' : 'Principal')}</p>
            </div>
          </div>
        </div>

        {/* Bottom Warning Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#0c4a7e] text-white py-1 px-4 text-center text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 z-10 rounded-b-[12px] h-[6mm] leading-normal pt-[1px]">
          <AlertTriangle size={13} className="text-[#FBBF24] fill-[#FBBF24] text-black" />
          <span className="leading-normal pt-[1px]">{isBangla ? 'বি. দ্র.: এডমিট কার্ড ছাড়া পরীক্ষায় অংশগ্রহণ করা যাবে না।' : 'N.B.: No candidate will be allowed to sit for the exam without Admit Card.'}</span>
        </div>
      </div>
    );
  }


  const isSchool = madrasah.institution_type === 'school';

  if (templateId === 'classic') {
    return (
      <div className="w-[900px] h-[600px] relative font-sans bg-white border-[3px] border-black p-4" style={{ fontFamily }}>
        <div className="border border-black w-full h-full p-6 flex flex-col pt-4">
          {/* Header */}
          <div className="relative border-b-2 border-black pb-4 mb-4">
            {/* Centered Logo & Name */}
            <div className="flex flex-col items-center text-center px-16">
              {madrasah.logo_url && (
                <img src={madrasah.logo_url} className="w-[70px] h-[70px] object-contain mb-2" crossOrigin="anonymous" />
              )}
              <h1 className="text-[40px] leading-[1.1] font-black text-black tracking-wide break-words w-full" style={{ fontFamily: isBangla ? "'Tiro Bangla', serif" : "'Times New Roman', serif" }}>
                {madrasah.name}
              </h1>
              {madrasah.address && (
                <p className="text-[17px] text-black mt-1 font-medium break-words w-full leading-tight">
                  {madrasah.address}
                </p>
              )}
            </div>
          </div>
          
          <div className="text-center mb-4 relative">
            <h2 className="inline-block border-2 border-black px-8 py-2 text-3xl font-bold uppercase tracking-widest bg-gray-100">
               {isBangla ? 'প্রবেশ পত্র' : 'ADMIT CARD'}
            </h2>
            {/* Date positioned right of the title box */}
            <div className="absolute top-2 right-4">
               <p className="font-bold text-[20px] border-b-2 border-dotted border-black pb-0.5 min-w-[150px] text-left">
                 {isBangla ? 'তারিখ:' : 'Date:'}
               </p>
            </div>
            <div className="mt-3 text-3xl font-bold">{exam.exam_name}</div>
          </div>
          
          <div className="flex-1 px-8 pt-4">
            <div className="flex gap-10">
              {/* Left Column */}
              <div className="w-[55%]">
                <table className="w-full text-left text-[22px] border-separate" style={{ borderSpacing: '0 12px' }}>
                  <tbody>
                    <tr>
                      <td className="py-1 font-bold w-[30%] align-top">{isBangla ? 'নাম' : 'Name'}</td>
                      <td className="py-1 font-semibold">:<span className="ml-3">{student.student_name}</span></td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold align-top">{isBangla ? 'পিতা' : 'Father'}</td>
                      <td className="py-1 font-semibold">:<span className="ml-3">{student.guardian_name || '-'}</span></td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold align-top">{isBangla ? 'মাতা' : 'Mother'}</td>
                      <td className="py-1 font-semibold">:<span className="ml-3">{student.mother_name || student.department || '-'}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Column */}
              <div className="w-[45%] border-l-2 border-black/10 pl-8">
                <table className="w-full text-left text-[22px] border-separate" style={{ borderSpacing: '0 12px' }}>
                  <tbody>
                    <tr>
                      <td className="py-1 font-bold w-[35%] align-top">{isBangla ? 'শ্রেণি' : 'Class'}</td>
                      <td className="py-1 font-semibold">:<span className="ml-3">{student.classes?.class_name || '-'}</span></td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold align-top">{isBangla ? 'রোল' : 'Roll'}</td>
                      <td className="py-1 font-black text-[38px] text-black italic">:<span className="ml-3">{student.roll || '-'}</span></td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold align-top">{isBangla ? 'শিক্ষাবর্ষ' : 'Session'}</td>
                      <td className="py-1 font-semibold">:<span className="ml-3">{exam.exam_year || new Date().getFullYear().toString()}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="mt-auto flex justify-between items-end pb-4 pt-12 px-12">
            <div className="text-center">
               <div className="w-56 border-b-2 border-black mb-2"></div>
               <p className="font-bold text-[20px]">{isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Controller of Exams'}</p>
            </div>
            <div className="text-center relative">
               <div className="flex items-end justify-center relative mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 35}px` }}>
                  {madrasah?.config_json?.signature_url && (
                    <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 35}px` }} className="object-contain mix-blend-multiply absolute bottom-0" alt="Sig" crossOrigin="anonymous" />
                  )}
               </div>
               <div className="w-56 border-b-2 border-black mb-2"></div>
               <p className="font-bold text-[20px]">{isBangla ? 'অধ্যক্ষ' : 'Principal'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Fallback to modern design
  return (
    <div className="w-[850px] h-[550px] relative font-sans overflow-hidden bg-[#eff8fc]" style={{ fontFamily }}>
      {/* Top Curves */}
      <svg viewBox="0 0 850 200" className="absolute top-0 left-0 w-full" preserveAspectRatio="none">
        <path d="M0,0 L850,0 L850,140 Q425,250 0,140 Z" fill="#248ab3" />
        <path d="M0,0 L850,0 L850,110 Q425,220 0,110 Z" fill="#054569" />
      </svg>
      
      {/* Bottom Curve */}
      <svg viewBox="0 0 850 120" className="absolute bottom-0 left-0 w-full" preserveAspectRatio="none">
        <path d="M0,120 L850,120 L850,40 Q425,120 0,0 Z" fill="#054569" opacity="0.9" />
      </svg>

      {/* Decorative Watermark inside Body */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
         {madrasah.logo_url && <img src={madrasah.logo_url} className="w-96 h-96 object-contain" crossOrigin="anonymous" />}
      </div>
      
      {/* Header */}
      <div className="relative z-10 w-full pt-8 px-10 flex items-center justify-center text-white pb-6">
        <div className="flex items-center gap-6">
          {madrasah.logo_url && (
            <div className="bg-white p-1 rounded-full drop-shadow-md shrink-0">
              <img src={madrasah.logo_url} alt="Logo" className="w-[84px] h-[84px] object-contain rounded-full" crossOrigin="anonymous" />
            </div>
          )}
          <div className="text-left">
            <h1 className="text-[44px] font-black drop-shadow-md tracking-wide leading-none" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
              {madrasah.name}
            </h1>
            <p className="text-[14px] mt-2.5 text-blue-50 drop-shadow flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-medium">
              <span>{madrasah.address || ''}</span>
              <div className="flex items-center gap-4">
                {madrasah.email && <span>Email: {madrasah.email}</span>}
                {madrasah.phone && <span>Mobile: {madrasah.phone}</span>}
              </div>
            </p>
          </div>
        </div>
      </div>

      {/* Middle Banner */}
      <div className="relative z-10 mt-1 flex flex-col items-center">
        <div className="bg-white px-10 py-1.5 border-l-8 border-r-8 border-[#054569] font-black text-2xl text-[#054569] shadow-sm tracking-widest rounded-sm border-double">
          {isBangla ? 'প্রবেশ পত্র' : 'Admit Card'}
        </div>
        
        {/* Exam Type */}
        <div className="mt-4 flex items-center justify-center">
           <div className="bg-white/90 px-6 py-1.5 rounded-full border border-blue-200 shadow-sm flex items-center gap-2">
             <div className="flex items-center justify-center w-4 h-4 border-2 border-[#054569] text-[#054569] bg-blue-50 rounded-sm">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <span className="text-[#054569] text-base font-black tracking-wide">{exam.exam_name}</span>
           </div>
        </div>
      </div>

      {/* Grid Inputs */}
      <div className="relative z-10 mt-5 px-16 flex flex-col gap-[7px]">
        {[
          { label: isBangla ? 'নাম' : 'Name', value: student.student_name },
          { label: isBangla ? 'পিতা' : 'Father', value: student.guardian_name || '-' },
          { label: isBangla ? 'মাতা' : 'Mother', value: student.mother_name || student.department || '-' },
          { label: isBangla ? 'শ্রেণি' : 'Class', value: student.classes?.class_name || '-' },
          { 
            label: isBangla ? 'রোল' : 'Roll', 
            value: student.roll || '-', 
            half: true, 
            label2: isBangla ? 'শিক্ষাবর্ষ' : 'Session', 
            value2: exam.exam_year || new Date().getFullYear().toString()
          }
        ].map((row, i) => (
          <div key={i} className="flex h-[38px] gap-2">
            <div className="w-28 bg-white border border-[#248ab3]/20 flex items-center justify-center font-bold text-[#054569] text-sm shadow-sm ring-1 ring-black/5 rounded-sm">
              {row.label}
            </div>
            <div className="flex-1 bg-white border border-[#248ab3]/20 flex items-center px-4 font-bold text-slate-800 text-[16px] shadow-sm ring-1 ring-black/5 rounded-sm tracking-wide">
              {row.value}
            </div>
            {row.half && (
              <>
                <div className="w-32 bg-white border border-[#248ab3]/20 flex items-center justify-center font-bold text-[#054569] text-sm shadow-sm ring-1 ring-black/5 rounded-sm">
                  {row.label2}
                </div>
                <div className="w-48 bg-white border border-[#248ab3]/20 flex items-center px-4 font-bold text-slate-800 text-[16px] shadow-sm ring-1 ring-black/5 rounded-sm">
                  {row.value2}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer Signatures */}
      <div className="absolute bottom-6 right-16 z-20 text-center flex flex-col items-center">
         <div className="flex items-center justify-center relative mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 35}px` }}>
            {madrasah?.config_json?.signature_url && (
              <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 35}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
            )}
         </div>
        <div className="w-36 border-b border-blue-200 mb-1.5 opacity-50"></div>
        <p className="text-white text-[11px] font-bold tracking-widest">{isBangla ? 'অধ্যক্ষ' : 'Principal'}</p>
      </div>
      
    </div>
  );
};

export const generateAdmitCardPDF = async (
  exam: any,
  students: Student[],
  madrasah: any,
  templateId: string = 'modern',
  lang: 'en' | 'bn' = 'en',
  onProgress?: (progress: number) => void
) => {
  onProgress?.(2);
  const isAdmission = templateId === 'admission';
  
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const root = createRoot(container);

  const pdf = new jsPDF({
    orientation: isAdmission ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Card dimensions in mm
  const cardWidthMm = isAdmission ? 190 : 142; 
  const cardHeightMm = isAdmission ? 135 : 95;
  
  const gapY = isAdmission ? 8 : 6;
  const gapX = 6;
  
  const marginX = (pageWidth - (isAdmission ? cardWidthMm : (cardWidthMm * 2 + gapX))) / 2;
  const marginY = (pageHeight - (isAdmission ? (cardHeightMm * 2 + gapY) : (cardHeightMm * 2 + gapY))) / 2;

  await document.fonts.ready;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    console.log(`Generating admit card for: ${student.student_name} (${i + 1}/${students.length})`);
    
    await new Promise<void>((resolve) => {
      root.render(<AdmitCardTemplate exam={exam} student={student} madrasah={madrasah} templateId={templateId} lang={lang} />);
      
      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      }, 5000);

      const checkImages = () => {
        if (isResolved) return;
        
        const imgs = container.querySelectorAll('img');
        const allLoaded = Array.from(imgs).every(img => img.complete && img.naturalHeight !== 0);
        
        if (allLoaded && imgs.length > 0) {
          isResolved = true;
          clearTimeout(timeout);
          setTimeout(resolve, 500);
        } else if (imgs.length === 0 && document.body.contains(container)) {
           setTimeout(() => {
             if (!isResolved) {
               isResolved = true;
               clearTimeout(timeout);
               resolve();
             }
           }, 800);
        } else {
          setTimeout(checkImages, 200);
        }
      };
      
      checkImages();
    });

    try {
      const element = container.querySelector('div');
      if (!element) {
        console.error('Admit card element not found');
        continue;
      }

      const imgData = await toPng(element as HTMLElement, {
        pixelRatio: 3, 
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      if (isAdmission) {
        // 2 per page, top and bottom
        if (i > 0 && i % 2 === 0) {
          pdf.addPage();
        }
        const posOnPage = i % 2;
        const xPos = marginX;
        const yPos = marginY + posOnPage * (cardHeightMm + gapY);

        pdf.addImage(imgData, 'PNG', xPos, yPos, cardWidthMm, cardHeightMm, undefined, 'SLOW');
        
      } else {
        // 4 per page
        if (i > 0 && i % 4 === 0) {
          pdf.addPage();
        }
        const posOnPage = i % 4;
        const col = posOnPage % 2;
        const row = Math.floor(posOnPage / 2);

        const xPos = marginX + col * (cardWidthMm + gapX);
        const yPos = marginY + row * (cardHeightMm + gapY);

        pdf.addImage(imgData, 'PNG', xPos, yPos, cardWidthMm, cardHeightMm, undefined, 'SLOW');
      }

      onProgress?.(2 + Math.floor(((i + 1) / students.length) * 96));

      // Help GC and prevent UI freeze
      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error('Error generating image for student:', student.student_name, err);
    }
  }

  // Clear memory
  setTimeout(() => {
    root.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 1000);

  const safeExamName = (exam.exam_name || 'Exam').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  pdf.save(`Admit_Cards_${safeExamName}.pdf`);
  onProgress?.(100);
};
