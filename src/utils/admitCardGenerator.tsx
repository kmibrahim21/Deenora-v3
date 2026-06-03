import React from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { Exam, Student } from '../types';

interface AdmitCardProps {
  exam: any;
  student: Student;
  madrasah: { name: string; logo_url?: string; institution_type?: string; phone?: string; address?: string };
  templateId?: string;
  lang: 'en' | 'bn';
}

const AdmitCardTemplate: React.FC<AdmitCardProps> = ({ exam, student, madrasah, templateId = 'modern', lang }) => {
  const isBangla = lang === 'bn';
  const fontFamily = isBangla ? "'Noto Serif Bengali', serif" : "'Times New Roman', serif";
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
            <div className="text-center">
               <div className="w-56 border-b-2 border-black mb-2"></div>
               <p className="font-bold text-[20px]">{isBangla ? 'অধ্যক্ষ' : 'Principal'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'minimal') {
    return (
      <div className="w-[850px] h-[550px] relative font-sans bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-8" style={{ fontFamily }}>
        {madrasah.logo_url && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
              <img src={madrasah.logo_url} className="w-[400px] h-[400px] object-contain grayscale" crossOrigin="anonymous" />
            </div>
        )}
        
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-100 shadow-sm p-8 z-10 relative">
          {/* Header */}
          <div className="flex flex-col items-center justify-center text-center pb-6 border-b border-slate-100 mb-6">
            <div className="flex items-center justify-center gap-5 mb-3 w-full">
              {madrasah.logo_url && (
                <img src={madrasah.logo_url} className="w-[70px] h-[70px] object-contain" crossOrigin="anonymous" />
              )}
              <div className="text-center">
                <h1 className="text-[32px] font-black text-slate-800 tracking-tight leading-none">{madrasah.name}</h1>
                {madrasah.address && <p className="text-[14px] text-slate-500 font-medium mt-1.5">{madrasah.address}</p>}
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-4">
               <span className="h-[1.5px] w-12 bg-slate-200"></span>
               <h2 className="text-xl font-black uppercase tracking-[0.25em] text-[#2563EB]">
                 {isBangla ? 'প্রবেশ পত্র' : 'Admit Card'}
               </h2>
               <span className="h-[1.5px] w-12 bg-slate-200"></span>
            </div>
            <div className="mt-3 text-[15px] font-bold text-slate-600 bg-slate-50 px-5 py-1.5 rounded-full ring-1 ring-slate-200/60">{exam.exam_name}</div>
          </div>
          
          <div className="flex-1 flex flex-col gap-y-3.5 px-8">
             <div className="flex border-b border-slate-50 pb-2.5">
                <div className="w-[120px] text-slate-400 font-bold text-xs uppercase tracking-widest">{isBangla ? 'নাম' : 'Name'}</div>
                <div className="flex-1 text-slate-800 font-black text-lg">: <span className="ml-2">{student.student_name}</span></div>
             </div>
             <div className="flex border-b border-slate-50 pb-2.5">
                <div className="w-[120px] text-slate-400 font-bold text-xs uppercase tracking-widest">{isBangla ? 'পিতা' : 'Father'}</div>
                <div className="flex-1 text-slate-800 font-bold text-[17px] text-slate-600">: <span className="ml-2">{student.guardian_name || '-'}</span></div>
             </div>
             <div className="flex border-b border-slate-50 pb-2.5">
                <div className="w-[120px] text-slate-400 font-bold text-xs uppercase tracking-widest">{isBangla ? 'মাতা' : 'Mother'}</div>
                <div className="flex-1 text-slate-800 font-bold text-[17px] text-slate-600">: <span className="ml-2">{student.mother_name || student.department || '-'}</span></div>
             </div>
             <div className="flex border-b border-slate-50 pb-2.5">
                <div className="w-[120px] text-slate-400 font-bold text-xs uppercase tracking-widest">{isBangla ? 'শ্রেণি' : 'Class'}</div>
                <div className="flex-1 text-slate-800 font-black text-[19px] text-[#2563EB]">: <span className="ml-2">{student.classes?.class_name || '-'}</span></div>
             </div>
             <div className="flex pt-1 gap-10 border-b border-slate-50 pb-2">
                <div className="flex-1 flex items-center bg-blue-50/50 py-2 px-4 rounded-lg">
                    <div className="w-[60px] text-blue-400 font-bold text-xs uppercase tracking-widest">{isBangla ? 'রোল' : 'Roll'}</div>
                    <div className="flex-1 text-slate-800 font-black text-[22px] text-[#2563EB]">: <span className="ml-2">{student.roll || '-'}</span></div>
                </div>
                <div className="flex-[1.5] flex items-center">
                    <div className="w-[100px] text-slate-400 font-bold text-xs uppercase tracking-widest pt-0.5">{isBangla ? 'শিক্ষাবর্ষ' : 'Session'}</div>
                    <div className="flex-1 text-slate-700 font-bold text-[17px]">: <span className="ml-2">{exam.exam_year || new Date().getFullYear().toString()}</span></div>
                </div>
             </div>
          </div>
          
          <div className="mt-auto flex justify-between items-end pt-8 px-8">
            <div className="text-left">
               <div className="w-48 border-b-2 border-slate-200 mb-2.5 opacity-70"></div>
               <p className="font-bold text-xs text-slate-400 uppercase tracking-widest">{isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Controller of Exams'}</p>
            </div>
            {madrasah.phone && (
                <div className="text-[11px] font-bold tracking-widest text-[#2563EB] bg-blue-50 px-4 py-1.5 rounded-full">
                   CONTACT: {madrasah.phone}
                </div>
            )}
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
            <p className="text-[14px] mt-2.5 text-blue-50 drop-shadow flex items-center gap-2 font-medium">
              <span>{madrasah.address || ''}</span>
              {(madrasah.address && madrasah.phone) && <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>}
              {madrasah.phone && <span>Mobile: {madrasah.phone}</span>}
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
      <div className="absolute bottom-6 right-16 z-20 text-center">
        <div className="w-36 border-b border-blue-200 mb-1.5 opacity-50"></div>
        <p className="text-white text-[11px] font-bold tracking-widest">{isBangla ? 'পরীক্ষা নিয়ন্ত্রক' : 'Controller of Exams'}</p>
      </div>
      
    </div>
  );
};

export const generateAdmitCardPDF = async (
  exam: any,
  students: Student[],
  madrasah: { name: string; logo_url?: string; institution_type?: string; phone?: string; address?: string },
  templateId: string = 'modern',
  lang: 'en' | 'bn' = 'en'
) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.zIndex = '-9999';
  container.style.overflow = 'auto';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  document.body.appendChild(container);

  const root = createRoot(container);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const cardWidthMm = 142; 
  const cardHeightMm = 95;
  
  const gapX = 6;
  const gapY = 6;
  
  const marginX = (pageWidth - (cardWidthMm * 2 + gapX)) / 2;
  const marginY = (pageHeight - (cardHeightMm * 2 + gapY)) / 2;

  // Render all cards at once for better efficiency
  await new Promise<void>((resolve) => {
    root.render(
      <div id="admit-cards-wrapper">
        {students.map((student, index) => (
          <div key={student.id || index} className="admit-card-item inline-block">
            <AdmitCardTemplate exam={exam} student={student} madrasah={madrasah} templateId={templateId} lang={lang} />
          </div>
        ))}
      </div>
    );
    
    // Safety timeout + image check
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 30000); // 30s max for all cards

    const checkReady = () => {
      if (resolved) return;
      const imgs = container.querySelectorAll('img');
      const allDone = Array.from(imgs).every(img => img.complete);
      if (allDone && imgs.length > 0) {
        resolved = true;
        clearTimeout(timeout);
        setTimeout(resolve, 2000); // Small grace period for fonts and rendering
      } else if (imgs.length === 0) {
        resolved = true;
        clearTimeout(timeout);
        setTimeout(resolve, 2500);
      } else {
        setTimeout(checkReady, 500);
      }
    };
    // Start checking after a short delay
    setTimeout(checkReady, 500);
  });

  const cardElements = container.querySelectorAll('.admit-card-item > div');
  
  for (let i = 0; i < cardElements.length; i++) {
    const element = cardElements[i] as HTMLElement;
    
    try {
      const imgData = await toPng(element, {
        pixelRatio: 1.5, 
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: false
      });

      if (i > 0 && i % 4 === 0) {
        pdf.addPage();
      }
      
      const posOnPage = i % 4;
      const col = posOnPage % 2;
      const row = Math.floor(posOnPage / 2);

      const xPos = marginX + col * (cardWidthMm + gapX);
      const yPos = marginY + row * (cardHeightMm + gapY);

      pdf.addImage(imgData, 'PNG', xPos, yPos, cardWidthMm, cardHeightMm, undefined, 'FAST');
    } catch (err) {
      console.error('Error generating image for card:', i, err);
    }
  }

  const safeExamName = (exam.exam_name || 'Exam').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  pdf.save(`Admit_Cards_${safeExamName}.pdf`);

  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, 1000);
};

