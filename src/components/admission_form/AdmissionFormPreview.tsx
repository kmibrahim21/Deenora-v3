import React, { useRef, useState, useEffect } from 'react';
import { ADMISSION_T } from './constants';
import { AdmissionFormData, AdmissionFormLang, AdmissionFormConfig } from './types';
import { Institution } from '../../types';
import { Download, Printer } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

const getBase64Image = async (url: string): Promise<string | null> => {
  try {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    
    // Fetch through local secure proxy to completely avoid any CORS block or canvas taint!
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      console.warn('Failed to fetch image via local proxy, status:', response.status);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64 via proxy:', error);
    return null;
  }
};

const getProxiedUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('blob:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

interface Props {
  formData: AdmissionFormData;
  madrasah: Institution | null;
  lang: AdmissionFormLang;
  config: AdmissionFormConfig;
  isPrint?: boolean;
  hideButtons?: boolean;
}

const AdmissionFormPreview: React.FC<Props> = ({ formData, madrasah, lang, config, isPrint = false, hideButtons = false }) => {
  const t = ADMISSION_T[lang];
  const printRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isGeneratingBlank, setIsGeneratingBlank] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    let active = true;
    if (madrasah?.logo_url) {
      setLogoError(false);
      getBase64Image(madrasah.logo_url).then(base64 => {
        if (active && base64) setLogoBase64(base64);
      });
    } else {
      setLogoBase64(null);
      setLogoError(false);
    }
    return () => { active = false; };
  }, [madrasah?.logo_url]);

  useEffect(() => {
    let active = true;
    if (formData.photoUrl) {
      setPhotoError(false);
      getBase64Image(formData.photoUrl).then(base64 => {
        if (active && base64) setPhotoBase64(base64);
      });
    } else {
      setPhotoBase64(null);
      setPhotoError(false);
    }
    return () => { active = false; };
  }, [formData.photoUrl]);

  useEffect(() => {
    if (isPrint || !containerRef.current) return;
    
    const updateScale = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      if (width < 830) {
        setScale(width / 830);
      } else {
        setScale(1);
      }
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    window.addEventListener('resize', updateScale);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isPrint]);

  const downloadPDF = async (forceBlank = false) => {
    if (!printRef.current) return;

    // Set blank form state if requested
    if (forceBlank) {
      setIsGeneratingBlank(true);
    }

    setIsCapturing(true);

    try {
      // 1. Ensure all fonts are fully loaded to prevent boxes or missing text
      if (document.fonts) {
        await document.fonts.ready;
      }
      
      // 2. Extra delay for font rendering and image stability
      await new Promise(resolve => setTimeout(resolve, 800));

      const captureElement = printRef.current;
      if (!captureElement) return;

      // 3. Robust Capture - specifically targeting the fixed width A4 layout
      const canvas = await html2canvas(captureElement, {
        scale: 2.5, // High resolution for print
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794, // Force A4 width in pixels
        height: 1123, // Force A4 height in pixels
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('print-area');
          if (clonedEl) {
            clonedEl.style.transform = 'none';
            clonedEl.style.position = 'relative';
            clonedEl.style.top = '0';
            clonedEl.style.left = '0';
            clonedEl.style.margin = '0';
            clonedEl.style.padding = '12mm 15mm 12mm 15mm';
            clonedEl.style.visibility = 'visible';
            clonedEl.style.display = 'flex';
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      
      const safeStudentName = forceBlank 
        ? 'Blank_Form'
        : (formData.studentNameEn || formData.studentName || 'Form')
            .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')
            .replace(/\s+/g, '_');
      pdf.save(`Admission_Form_${safeStudentName}.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingBlank(false);
      setIsCapturing(false);
    }
  };

  const Field = ({ label, value, fieldKey, className = "", isFull = false }: { label: string, value?: string, fieldKey?: string, className?: string, isFull?: boolean }) => {
    if (fieldKey && config.fieldVisibility[fieldKey] === false) return null;
    const displayValue = isGeneratingBlank ? '' : (value || '');

    return (
      <div className={`flex items-center gap-1.5 border-b pb-0.5 min-h-[1.4em] ${isFull ? 'col-span-full' : ''} ${className}`} style={{ borderColor: `${config.themeColor}35` }}>
        <span 
          className="font-black whitespace-nowrap shrink-0" 
          style={{ fontSize: `${8.5 * config.fontScale}px`, color: config.themeColor }}
        >
          {label}:
        </span>
        <span 
          className="font-bold text-slate-900 flex-1 truncate min-h-[1.1em] border-dotted border-b-0"
          style={{ fontSize: `${9.5 * config.fontScale}px` }}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 py-1 mb-3 flex items-center justify-between" style={{ backgroundColor: `${config.themeColor}08`, borderLeft: `4px solid ${config.themeColor}` }}>
      <h2 
        className="font-black uppercase tracking-widest italic"
        style={{ fontSize: `${10 * config.fontScale}px`, color: config.themeColor }}
      >
        {children}
      </h2>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-slate-50/50 pb-20">
      {/* Top Banner Indicator */}
      {isCapturing && (
        <div className="fixed inset-0 z-[9999] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-black text-blue-900 animate-pulse">
            {lang === 'bn' ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating PDF...'}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {!isPrint && !hideButtons && (
        <div className="flex flex-wrap gap-4 mb-8 justify-center w-full px-4 pt-8 sticky top-0 z-50 bg-slate-50/80 backdrop-blur-md pb-4">
          <button
            onClick={() => downloadPDF(false)}
            disabled={isCapturing}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 text-sm sm:text-base cursor-pointer disabled:opacity-50"
          >
            <Download size={20} />
            {t.downloadPdf}
          </button>
          <button
            onClick={() => downloadPDF(true)}
            disabled={isCapturing}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 text-sm sm:text-base cursor-pointer disabled:opacity-50"
          >
            <Download size={20} />
            {lang === 'bn' ? 'ব্ল্যাঙ্ক ফরম ডাউনলোড' : 'Download Blank Form'}
          </button>
          <button
            onClick={() => window.print()}
            disabled={isCapturing}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-slate-800 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl hover:bg-slate-900 transition-all active:scale-95 text-sm sm:text-base cursor-pointer disabled:opacity-50"
          >
            <Printer size={20} />
            {lang === 'bn' ? 'প্রিন্ট করুন' : 'Print Now'}
          </button>
        </div>
      )}

      {/* A4 Page Container */}
      <div 
        ref={containerRef}
        className={isPrint ? "w-full" : "w-full flex flex-col items-center overflow-hidden"}
      >
        <div 
          style={isPrint ? {
            width: '210mm',
            height: '297mm',
            position: 'relative',
            overflow: 'hidden'
          } : { 
            width: '100%',
            maxWidth: '794px',
            height: `${1123 * scale}px`, 
            position: 'relative',
            overflow: 'hidden'
          }}
          className="flex justify-center items-start"
        >
          <div 
            ref={printRef}
            id="print-area"
            className="bg-white font-solaiman flex flex-col relative overflow-hidden shrink-0 shadow-2xl"
            style={isPrint || isCapturing ? {
              width: '210mm', 
              height: '297mm', 
              padding: '12mm 15mm 12mm 15mm',
              boxSizing: 'border-box'
            } : { 
              width: '210mm', 
              height: '297mm', 
              padding: '12mm 15mm 12mm 15mm',
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              position: 'absolute',
              top: 0,
              boxSizing: 'border-box'
            }}
          >
          {/* Marksheet Style Borders */}
          <div className="absolute inset-0 border-[10px] pointer-events-none opacity-[0.08]" style={{ borderColor: config.themeColor }}></div>
          <div className="absolute inset-[10px] border-[1px] pointer-events-none" style={{ borderColor: config.themeColor }}></div>
          <div className="absolute inset-[13px] border-[2.5px] border-double pointer-events-none" style={{ borderColor: config.themeColor }}></div>

          {/* Watermark */}
          {config.showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.03]">
              <span 
                className="text-9xl font-black -rotate-45 uppercase whitespace-nowrap"
                style={{ fontSize: '70px', color: config.themeColor }}
              >
                {config.watermarkText}
              </span>
            </div>
          )}

          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 pb-3 mb-6" style={{ borderColor: config.themeColor }}>
              <div className="flex items-center gap-4">
                {config.showLogo && (
                  <div className="w-20 h-20 bg-white border border-slate-100 rounded-xl flex items-center justify-center overflow-hidden shadow-sm">
                    {((logoBase64 || madrasah?.logo_url) && !logoError) ? (
                      <img 
                        src={getProxiedUrl(logoBase64 || madrasah?.logo_url)} 
                        alt="Logo" 
                        className="max-w-full max-h-full object-contain"
                        onError={() => setLogoError(true)}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-xs font-black text-slate-300">LOGO</span>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <h1 
                    className="font-black leading-tight uppercase tracking-tight"
                    style={{ fontSize: `${18 * config.fontScale}px`, color: config.themeColor }}
                  >
                    {madrasah?.name || 'Institution Name'}
                  </h1>
                  <p 
                    className="font-bold text-slate-600 max-w-[400px] leading-snug"
                    style={{ fontSize: `${9 * config.fontScale}px` }}
                  >
                    {madrasah?.address || 'Address of the Institution'}
                  </p>
                  {madrasah?.phone && (
                    <p 
                      className="font-black opacity-80"
                      style={{ fontSize: `${8.5 * config.fontScale}px`, color: config.themeColor }}
                    >
                      Phone: {madrasah?.phone}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                <div className="w-24 h-28 border-2 bg-slate-50 overflow-hidden shadow-inner flex items-center justify-center p-1 rounded-sm" style={{ borderColor: config.themeColor }}>
                  {((photoBase64 || formData.photoUrl) && !isGeneratingBlank && !photoError) ? (
                    <img 
                      src={getProxiedUrl(photoBase64 || formData.photoUrl)} 
                      alt="Student" 
                      className="w-full h-full object-cover border border-white"
                      onError={() => setPhotoError(true)}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="text-center p-1">
                       <span className="text-[9px] font-black text-slate-300 uppercase leading-tight">Student<br/>Photo</span>
                    </div>
                  )}
                </div>
                <div className="text-white px-4 py-1 rounded-full shadow-sm" style={{ backgroundColor: config.themeColor }}>
                  <span className="font-black uppercase tracking-widest" style={{ fontSize: `${11 * config.fontScale}px` }}>{t.title}</span>
                </div>
              </div>
            </div>

            {/* Form Top Statistics Row */}
            <div className="grid grid-cols-4 gap-4 mb-6 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
              <Field label={t.formNumber} value={formData.formNumber || formData.admission_number} />
              <Field label={t.admissionDate} value={formData.admissionDate} />
              <Field label={t.academicYear} value={formData.academicYear} />
              <Field label={t.session} value={formData.session} />
            </div>

            {/* Content Sections */}
            <div className="flex-1 space-y-5">
              {/* Student Info Section */}
              <section>
                <SectionHeading>{config.sectionHeadings.studentInfo}</SectionHeading>
                <div className="grid grid-cols-12 gap-x-6 gap-y-3 px-1">
                  <Field label={t.studentName} value={formData.studentName} className="col-span-12" />
                  <Field label={t.studentNameEn} value={formData.studentNameEn} fieldKey="studentNameEn" className="col-span-12" />
                  <Field label={t.dateOfBirth} value={formData.date_of_birth} fieldKey="dateOfBirth" className="col-span-6" />
                  <Field label={t.gender} value={formData.gender ? (lang === 'bn' ? (formData.gender === 'male' ? t.male : (formData.gender === 'female' ? t.female : t.other)) : formData.gender) : ''} fieldKey="gender" className="col-span-6" />
                  <Field label={t.nationality} value={formData.nationality} fieldKey="nationality" className="col-span-4" />
                  <Field label={t.religion} value={formData.religion} fieldKey="religion" className="col-span-4" />
                  <Field label={t.bloodGroup} value={formData.blood_group} fieldKey="bloodGroup" className="col-span-4" />
                  <Field label={t.admissionClass} value={formData.admissionClass} fieldKey="admissionClass" className="col-span-12" />
                </div>
              </section>

              {/* Parent Info Section */}
              <section>
                <SectionHeading>{config.sectionHeadings.parentInfo}</SectionHeading>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-1">
                  <Field label={t.fatherName} value={formData.fatherName} fieldKey="fatherName" />
                  <Field label={t.fatherOccupation} value={formData.fatherOccupation} fieldKey="fatherOccupation" />
                  <Field label={t.motherName} value={formData.motherName} fieldKey="motherName" />
                  <Field label={t.motherOccupation} value={formData.motherOccupation} fieldKey="motherOccupation" />
                  <Field label={t.guardianName} value={formData.guardian_name} fieldKey="guardianName" />
                  <Field label={t.guardianRelation} value={formData.guardianRelation} fieldKey="guardianRelation" />
                  <Field label={t.guardianPhone} value={formData.guardian_phone} fieldKey="guardianPhone" className="col-span-2" />
                </div>
              </section>

              {/* Address Section */}
              <section>
                <SectionHeading>{config.sectionHeadings.addressInfo}</SectionHeading>
                <div className="space-y-3 px-1">
                  <Field label={t.presentAddress} value={formData.presentAddress} fieldKey="presentAddress" />
                  <Field label={t.permanentAddress} value={formData.permanentAddress} fieldKey="permanentAddress" />
                </div>
              </section>

              {/* Previous Institution Section */}
              {config.fieldVisibility.previousInstitution && (
                <section>
                  <SectionHeading>{config.sectionHeadings.prevInstInfo}</SectionHeading>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-1">
                    <Field label={t.previousInstitution} value={formData.previousInstitution} />
                    <Field label={t.previousClass} value={formData.previousClass} />
                  </div>
                </section>
              )}

              {/* Documents Checklist Section */}
              <section>
                <SectionHeading>{t.documents}</SectionHeading>
                <div className="flex flex-wrap gap-x-8 gap-y-3 py-1 px-1">
                  {[
                    { id: 'birth', label: t.docBirthCert },
                    { id: 'parentNID', label: (t as any).docParentNID || 'Parent NID' },
                    { id: 'photos', label: t.docPhotos },
                  ].map(doc => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 flex items-center justify-center rounded-sm" style={{ borderColor: config.themeColor }}>
                        {(formData.documentsChecked?.includes(doc.id) && !isGeneratingBlank) && <div className="w-2 h-2" style={{ backgroundColor: config.themeColor }}></div>}
                      </div>
                      <span className="font-bold text-slate-800" style={{ fontSize: `${9 * config.fontScale}px` }}>{doc.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Office Use Section - Marksheet Style Box */}
              <div className="mt-4 border-2 p-4 relative bg-slate-50/30 rounded-lg" style={{ borderColor: config.themeColor }}>
                <div className="absolute -top-3 left-4 bg-white px-2">
                  <span className="font-black uppercase tracking-widest italic" style={{ fontSize: `${9 * config.fontScale}px`, color: config.themeColor }}>
                    {config.sectionHeadings.officeUse}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 rounded-sm" style={{ borderColor: config.themeColor }}></div>
                      <span className="font-black uppercase text-slate-600" style={{ fontSize: `${8.5 * config.fontScale}px` }}>{t.approved}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 rounded-sm" style={{ borderColor: config.themeColor }}></div>
                      <span className="font-black uppercase text-slate-600" style={{ fontSize: `${8.5 * config.fontScale}px` }}>{t.pending}</span>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-3">
                    <div className="border-b-2 border-dotted border-slate-300 pb-1 flex justify-between">
                      <span className="font-black uppercase text-slate-400" style={{ fontSize: `${8.5 * config.fontScale}px` }}>Roll Number:</span>
                      <span className="flex-1"></span>
                    </div>
                    <div className="border-b-2 border-dotted border-slate-300 pb-1 flex justify-between">
                      <span className="font-black uppercase text-slate-400" style={{ fontSize: `${8.5 * config.fontScale}px` }}>Section/Group:</span>
                      <span className="flex-1"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-3 gap-12 mt-12 mb-4">
              <div className="text-center border-t-2 pt-1.5" style={{ borderColor: config.themeColor }}>
                <span className="font-black uppercase tracking-wider" style={{ fontSize: `${9 * config.fontScale}px`, color: config.themeColor }}>{config.signatureLabels.student}</span>
              </div>
              <div className="text-center border-t-2 pt-1.5" style={{ borderColor: config.themeColor }}>
                <span className="font-black uppercase tracking-wider" style={{ fontSize: `${9 * config.fontScale}px`, color: config.themeColor }}>{config.signatureLabels.parent}</span>
              </div>
              <div className="text-center border-t-2 pt-1.5" style={{ borderColor: config.themeColor }}>
                <span className="font-black uppercase tracking-wider" style={{ fontSize: `${9 * config.fontScale}px`, color: config.themeColor }}>{config.signatureLabels.principal}</span>
              </div>
            </div>
          </div> {/* closes relative content area */}
        </div> {/* closes #print-area */}
      </div> {/* closes A4 scaling wrapper */}
    </div>
 {/* closes containerRef */}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { 
            visibility: hidden; 
          }
          #print-area, #print-area * { 
            visibility: visible; 
          }
          #print-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            transform: none !important;
            transform-origin: none !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 12mm 15mm 12mm 15mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            background-color: white !important;
          }
          @page { 
            size: A4 portrait; 
            margin: 0 !important; 
          }
        }
      `}} />
    </div>
  );
};

export default AdmissionFormPreview;
