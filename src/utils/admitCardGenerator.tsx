import React from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { Exam, Student } from '../types';

interface AdmitCardProps {
  exam: any;
  student: Student;
  madrasah: { name: string; logo_url?: string };
  templateId: string;
  lang: 'en' | 'bn';
}

const AdmitCardTemplate: React.FC<AdmitCardProps> = ({ exam, student, madrasah, templateId, lang }) => {
  const isBangla = lang === 'bn';
  const fontFamily = isBangla ? "'Noto Sans Bengali', sans-serif" : "sans-serif";

  if (templateId === 'modern') {
    return (
      <div className="w-[800px] h-[450px] border-2 rounded-2xl overflow-hidden flex flex-col relative font-sans" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#1e3a8a' }}>
        {/* Header */}
        <div className="p-6 flex items-center justify-between" style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
          <div className="flex items-center gap-4">
            {madrasah.logo_url && (
              <img src={madrasah.logo_url} alt="Logo" className="w-16 h-16 rounded-full p-1 object-contain" style={{ backgroundColor: '#ffffff' }} crossOrigin="anonymous" />
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight">{madrasah.name}</h1>
              <p className="text-sm font-bold mt-1 uppercase tracking-widest" style={{ color: '#bfdbfe' }}>{exam.exam_name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="px-4 py-2 rounded-xl backdrop-blur-sm border" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderColor: 'rgba(255, 255, 255, 0.3)' }}>
              <h2 className="text-xl font-black tracking-widest uppercase">Admit Card</h2>
              <p className="text-xs mt-1" style={{ color: '#dbeafe' }}>{isBangla ? 'প্রবেশপত্র' : 'Entry Pass'}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-8 flex gap-8">
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{student.student_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'শ্রেণী' : 'Class'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{student.classes?.class_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'রোল নম্বর' : 'Roll Number'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{student.roll || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{isBangla ? 'পরীক্ষার তারিখ' : 'Exam Date'}</p>
                <p className="text-xl font-black border-b-2 pb-2" style={{ color: '#1e293b', borderColor: '#f1f5f9' }}>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : exam.exam_year}</p>
              </div>
            </div>
          </div>

          <div className="w-32 flex flex-col items-center gap-4">
            <div className="w-32 h-40 border-2 border-dashed rounded-xl flex items-center justify-center" style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}>
              <span className="font-bold text-sm uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'ছবি' : 'Photo'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-end px-8" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
          <div className="text-xs font-bold max-w-md" style={{ color: '#64748b' }}>
            <p className="mb-1" style={{ color: '#ef4444' }}>{isBangla ? 'নির্দেশনা:' : 'Instructions:'}</p>
            <p>{isBangla ? '১. পরীক্ষার হলে অবশ্যই প্রবেশপত্র সাথে আনতে হবে।' : '1. Must bring this admit card to the exam hall.'}</p>
            <p>{isBangla ? '২. মোবাইল ফোন বা কোনো ইলেকট্রনিক ডিভাইস আনা সম্পূর্ণ নিষেধ।' : '2. Mobile phones or electronic devices are strictly prohibited.'}</p>
          </div>
          <div className="text-center">
            <div className="w-32 border-b-2 mb-2" style={{ borderColor: '#1e293b' }}></div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{isBangla ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authority Signature'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'minimal') {
    return (
      <div className="w-[800px] h-[450px] border p-8 flex flex-col relative font-sans" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
        <div className="text-center mb-8">
          {madrasah.logo_url && (
            <img src={madrasah.logo_url} alt="Logo" className="w-12 h-12 mx-auto mb-3 object-contain grayscale" crossOrigin="anonymous" />
          )}
          <h1 className="text-2xl font-black tracking-widest uppercase" style={{ color: '#0f172a' }}>{madrasah.name}</h1>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="h-[1px] w-12" style={{ backgroundColor: '#cbd5e1' }}></div>
            <p className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: '#64748b' }}>{exam.exam_name}</p>
            <div className="h-[1px] w-12" style={{ backgroundColor: '#cbd5e1' }}></div>
          </div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div className="px-6 py-2" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
            <h2 className="text-lg font-black tracking-widest uppercase">Admit Card</h2>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'তারিখ' : 'Date'}</p>
            <p className="text-sm font-black" style={{ color: '#1e293b' }}>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : exam.exam_year}</p>
          </div>
        </div>

        <div className="flex-1 flex gap-12">
          <div className="flex-1 space-y-4">
            <div className="flex border-b pb-2" style={{ borderColor: '#e2e8f0' }}>
              <span className="w-32 text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'নাম' : 'Name'}</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{student.student_name}</span>
            </div>
            <div className="flex border-b pb-2" style={{ borderColor: '#e2e8f0' }}>
              <span className="w-32 text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'শ্রেণী' : 'Class'}</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{student.classes?.class_name || '-'}</span>
            </div>
            <div className="flex border-b pb-2" style={{ borderColor: '#e2e8f0' }}>
              <span className="w-32 text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{isBangla ? 'রোল' : 'Roll'}</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{student.roll || '-'}</span>
            </div>
          </div>

          <div className="w-28 h-32 border flex items-center justify-center" style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}>
            <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#cbd5e1' }}>{isBangla ? 'ছবি' : 'Photo'}</span>
          </div>
        </div>

        <div className="mt-auto flex justify-between items-end pt-8">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
            <p>• {isBangla ? 'প্রবেশপত্র ছাড়া পরীক্ষা দেওয়া নিষেধ।' : 'Entry without admit card is prohibited.'}</p>
            <p>• {isBangla ? 'মোবাইল ফোন নিষিদ্ধ।' : 'Mobile phones prohibited.'}</p>
          </div>
          <div className="text-center">
            <div className="w-32 border-b mb-2" style={{ borderColor: '#0f172a' }}></div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>{isBangla ? 'স্বাক্ষর' : 'Signature'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'premium') {
    return (
      <div className="w-[800px] h-[450px] border-8 rounded-[2.5rem] overflow-hidden flex flex-col relative font-sans shadow-2xl" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#1e3a8a' }}>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/5 rounded-full -ml-24 -mb-24"></div>
        
        {/* Header */}
        <div className="p-8 flex items-center justify-between relative z-10" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', color: '#ffffff' }}>
          <div className="flex items-center gap-6">
            {madrasah.logo_url && (
              <div className="w-20 h-20 bg-white rounded-2xl p-2 shadow-lg flex items-center justify-center">
                <img src={madrasah.logo_url} alt="Logo" className="w-full h-full object-contain" crossOrigin="anonymous" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight leading-tight">{madrasah.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-[2px] w-8 bg-blue-300"></span>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-100">{exam.exam_name}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="px-6 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
              <h2 className="text-2xl font-black tracking-widest uppercase leading-none">Admit Card</h2>
              <p className="text-xs mt-1 font-bold text-blue-200 tracking-widest">{isBangla ? 'প্রবেশপত্র' : 'Entry Pass'}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-10 flex gap-12 relative z-10">
          <div className="flex-1 grid grid-cols-2 gap-x-12 gap-y-8">
            <div className="relative group">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">{isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name'}</p>
              <p className="text-2xl font-black text-slate-800 border-b-2 border-slate-100 pb-2 group-hover:border-blue-200 transition-colors">{student.student_name}</p>
            </div>
            <div className="relative group">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">{isBangla ? 'শ্রেণী' : 'Class'}</p>
              <p className="text-2xl font-black text-slate-800 border-b-2 border-slate-100 pb-2 group-hover:border-blue-200 transition-colors">{student.classes?.class_name || '-'}</p>
            </div>
            <div className="relative group">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">{isBangla ? 'রোল নম্বর' : 'Roll Number'}</p>
              <p className="text-2xl font-black text-slate-800 border-b-2 border-slate-100 pb-2 group-hover:border-blue-200 transition-colors">{student.roll || '-'}</p>
            </div>
            <div className="relative group">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">{isBangla ? 'পরীক্ষার তারিখ' : 'Exam Date'}</p>
              <p className="text-2xl font-black text-slate-800 border-b-2 border-slate-100 pb-2 group-hover:border-blue-200 transition-colors">{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : exam.exam_year}</p>
            </div>
          </div>

          <div className="w-40 flex flex-col items-center gap-6">
            <div className="w-36 h-44 border-4 border-slate-100 rounded-3xl flex items-center justify-center bg-slate-50 shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors"></div>
              <span className="font-black text-xs uppercase tracking-[0.3em] text-slate-300">{isBangla ? 'ছবি' : 'Photo'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-end px-10 relative z-10">
          <div className="text-[10px] font-bold text-slate-400 max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <p className="uppercase tracking-widest text-red-500 font-black">{isBangla ? 'নির্দেশনা:' : 'Instructions:'}</p>
            </div>
            <div className="space-y-1 pl-4 border-l-2 border-slate-200">
              <p>• {isBangla ? 'পরীক্ষার হলে অবশ্যই প্রবেশপত্র সাথে আনতে হবে।' : 'Must bring this admit card to the exam hall.'}</p>
              <p>• {isBangla ? 'মোবাইল ফোন বা কোনো ইলেকট্রনিক ডিভাইস আনা সম্পূর্ণ নিষেধ।' : 'Mobile phones or electronic devices are strictly prohibited.'}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="w-48 h-1 bg-slate-800 mb-3 rounded-full"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">{isBangla ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authority Signature'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Classic Template
  return (
    <div className="w-[800px] h-[450px] border-[12px] border-double p-8 flex flex-col relative font-sans" style={{ fontFamily, backgroundColor: '#ffffff', borderColor: '#1e293b' }}>
      <div className="flex justify-between items-center border-b-4 pb-6 mb-8" style={{ borderColor: '#1e293b' }}>
        <div className="flex items-center gap-6">
          {madrasah.logo_url && (
            <div className="w-20 h-20 flex items-center justify-center border-2 rounded-xl p-1" style={{ borderColor: '#e2e8f0' }}>
              <img src={madrasah.logo_url} alt="Logo" className="w-full h-full object-contain" crossOrigin="anonymous" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight" style={{ color: '#0f172a' }}>{madrasah.name}</h1>
            <p className="font-black mt-1 text-xl uppercase tracking-widest" style={{ color: '#475569' }}>{exam.exam_name}</p>
          </div>
        </div>
        <div className="text-center border-4 p-4 bg-slate-50" style={{ borderColor: '#1e293b' }}>
          <h2 className="text-2xl font-black uppercase tracking-[0.2em]">Admit Card</h2>
          <p className="text-sm font-bold mt-1 tracking-widest">{isBangla ? 'প্রবেশপত্র' : 'Entry Pass'}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-12">
        <div className="flex-1 space-y-8">
          <div className="flex items-end gap-4">
            <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap text-slate-500">{isBangla ? 'শিক্ষার্থীর নাম :' : 'Student Name :'}</span>
            <span className="flex-1 border-b-4 border-dotted text-2xl font-black px-4 pb-1 uppercase" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>{student.student_name}</span>
          </div>
          <div className="flex gap-12">
            <div className="flex items-end gap-4 flex-1">
              <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap text-slate-500">{isBangla ? 'শ্রেণী :' : 'Class :'}</span>
              <span className="flex-1 border-b-4 border-dotted text-2xl font-black px-4 pb-1 uppercase" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>{student.classes?.class_name || '-'}</span>
            </div>
            <div className="flex items-end gap-4 flex-1">
              <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap text-slate-500">{isBangla ? 'রোল নম্বর :' : 'Roll No :'}</span>
              <span className="flex-1 border-b-4 border-dotted text-2xl font-black px-4 pb-1 uppercase" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>{student.roll || '-'}</span>
            </div>
          </div>
          <div className="flex gap-12">
            <div className="flex items-end gap-4 flex-1">
              <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap text-slate-500">{isBangla ? 'পরীক্ষার তারিখ :' : 'Exam Date :'}</span>
              <span className="flex-1 border-b-4 border-dotted text-2xl font-black px-4 pb-1 uppercase" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : exam.exam_year}</span>
            </div>
            <div className="flex items-end gap-4 flex-1">
              <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap text-slate-500">{isBangla ? 'শাখা :' : 'Section :'}</span>
              <span className="flex-1 border-b-4 border-dotted text-2xl font-black px-4 pb-1 uppercase" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>-</span>
            </div>
          </div>
        </div>

        <div className="w-40 h-48 border-4 flex items-center justify-center bg-slate-50" style={{ borderColor: '#1e293b' }}>
          <span className="font-black text-xs uppercase tracking-[0.3em] text-slate-300">{isBangla ? 'ছবি' : 'Photo'}</span>
        </div>
      </div>

      <div className="mt-auto flex justify-between items-end pt-8">
        <div className="text-[10px] font-black uppercase tracking-widest leading-relaxed" style={{ color: '#475569' }}>
          <p className="underline mb-2 text-red-600">{isBangla ? 'নিয়মাবলী:' : 'Rules:'}</p>
          <p>১. {isBangla ? 'পরীক্ষার হলে প্রবেশপত্র আনা বাধ্যতামূলক।' : 'Admit card is mandatory in the exam hall.'}</p>
          <p>২. {isBangla ? 'অসদুপায় অবলম্বন করলে পরীক্ষা বাতিল হবে।' : 'Adopting unfair means will cancel the exam.'}</p>
        </div>
        <div className="text-center">
          <div className="w-56 border-b-4 mb-3" style={{ borderColor: '#1e293b' }}></div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-800">{isBangla ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal Signature'}</p>
        </div>
      </div>
    </div>
  );
};

export const generateAdmitCardPDF = async (
  exam: any,
  students: Student[],
  madrasah: { name: string; logo_url?: string },
  templateId: string = 'classic',
  lang: 'en' | 'bn' = 'en'
) => {
  // Create a hidden container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const root = createRoot(container);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const cardWidthMm = 190; // Almost full width with 10mm margins
  const cardHeightMm = (450 / 800) * cardWidthMm; // Maintain aspect ratio
  
  const marginX = (pageWidth - cardWidthMm) / 2;
  const marginY = 15;
  const gapY = 15;

  await document.fonts.ready;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    console.log(`Generating admit card for: ${student.student_name} (${i + 1}/${students.length})`);
    
    // Render the component for this student
    await new Promise<void>((resolve) => {
      root.render(<AdmitCardTemplate exam={exam} student={student} madrasah={madrasah} templateId={templateId} lang={lang} />);
      
      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      }, 5000); // Max wait 5 seconds

      const checkImages = () => {
        if (isResolved) return;
        
        const imgs = container.querySelectorAll('img');
        const allLoaded = Array.from(imgs).every(img => img.complete && img.naturalHeight !== 0);
        
        if (allLoaded && imgs.length > 0) {
          isResolved = true;
          clearTimeout(timeout);
          setTimeout(resolve, 500); // Small extra buffer
        } else if (imgs.length === 0 && document.body.contains(container)) {
           // If no images, just wait a bit for render
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
        console.error('Admit card element not found in container');
        continue;
      }

      const imgData = await toPng(element, {
        pixelRatio: 1.5, // Balanced quality
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      // Calculate position
      const isSecondOnPage = i % 2 !== 0;
      
      if (i > 0 && !isSecondOnPage) {
        pdf.addPage();
      }

      const yPos = isSecondOnPage ? marginY + cardHeightMm + gapY : marginY;

      pdf.addImage(imgData, 'PNG', marginX, yPos, cardWidthMm, cardHeightMm, undefined, 'FAST');
    } catch (err) {
      console.error('Error generating image for student:', student.student_name, err);
    }
  }

  console.log('Finalizing PDF...');
  root.unmount();
  document.body.removeChild(container);

  pdf.save(`Admit_Cards_${exam.exam_name.replace(/\s+/g, '_')}.pdf`);
  console.log('PDF saved successfully');
};
