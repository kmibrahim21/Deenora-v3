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
      // Ensure all fonts are loaded
      if (document.fonts) {
        await document.fonts.ready;
      }
      
      // Small delay to allow react to render the blank/capturing state
      await new Promise(resolve => setTimeout(resolve, 500));

      const captureElement = printRef.current;
      if (!captureElement) return;

      let canvas;
      let imgData;
      try {
        canvas = await html2canvas(captureElement, {
          scale: 2.5, // Reduced from 3.0 to 2.5 for better mobile memory safety while keeping extreme crispness
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794, // Fixed A4 width in pixels at 96 DPI
          windowHeight: 1123, // Fixed A4 height
          onclone: (clonedDoc) => {
            const clonedEl = clonedDoc.getElementById('print-area');
            if (clonedEl) {
              clonedEl.style.transform = 'none';
              clonedEl.style.position = 'relative';
              clonedEl.style.top = '0';
              clonedEl.style.left = '0';
              clonedEl.style.margin = '0';
              clonedEl.style.padding = '12mm 15mm 12mm 15mm';
            }
          }
        });
        imgData = canvas.toDataURL('image/jpeg', 0.95);
      } catch (err1) {
        console.warn("Primary render failed, attempting safe fallback...", err1);
        canvas = await html2canvas(captureElement, {
          scale: 1.5,
          useCORS: false,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        imgData = canvas.toDataURL('image/jpeg', 0.9);
      }

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
    } finally {
      setIsGeneratingBlank(false);
      setIsCapturing(false);
    }
  };

  const Field = ({ label, value, fieldKey, className = "" }: { label: string, value?: string, fieldKey?: string, className?: string }) => {
    if (fieldKey && config.fieldVisibility[fieldKey] === false) return null;
    
    // For blank form or unfilled fields, leave value empty so the bottom border provides a clean writing space
    const displayValue = isGeneratingBlank ? '' : (value || '');

    return (
      <div className={`flex items-baseline gap-2 border-b pb-0.5 min-h-[1.4em] ${className}`} style={{ borderColor: `${config.themeColor}35` }}>
        <span 
          className="font-black whitespace-nowrap opacity-85 shrink-0" 
          style={{ fontSize: `${8.5 * config.fontScale}px`, color: config.themeColor }}
        >
          {label}:
        </span>
        <span 
          className="font-bold text-slate-900 flex-1 truncate min-h-[1.1em] inline-block"
          style={{ fontSize: `${9 * config.fontScale}px` }}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <div className="px-2 py-1 mb-2 flex items-center justify-between animate-none" style={{ backgroundColor: `${config.themeColor}10`, borderLeft: `3px solid ${config.themeColor}` }}>
      <h2 
        className="font-black uppercase tracking-wider"
        style={{ fontSize: `${9 * config.fontScale}px`, color: config.themeColor }}
      >
        {children}
      </h2>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full">
      {/* Action Buttons */}
      {!isPrint && !hideButtons && (
        <div className="flex flex-wrap gap-4 mb-8 justify-center w-full px-4">
          <button
            onClick={() => downloadPDF(false)}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 text-sm sm:text-base cursor-pointer"
          >
            <Download size={20} />
            {t.downloadPdf}
          </button>
          <button
            onClick={() => downloadPDF(true)}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 text-sm sm:text-base cursor-pointer"
          >
            <Download size={20} />
            {lang === 'bn' ? 'ব্ল্যাঙ্ক ফরম ডাউনলোড' : 'Download Blank Form'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-slate-800 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl hover:bg-slate-900 transition-all active:scale-95 text-sm sm:text-base cursor-pointer"
          >
            <Printer size={20} />
            {lang === 'bn' ? 'প্রিন্ট' : 'Print'}
          </button>
        </div>
      )}

      {/* A4 Page Container */}
      <div 
        ref={containerRef}
        className={isPrint ? "w-full" : "bg-slate-300 p-2 sm:p-6 rounded-2xl sm:rounded-[3rem] w-full flex flex-col items-center overflow-hidden"}
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
            className="bg-white shadow-2xl font-solaiman flex flex-col relative overflow-hidden shrink-0"
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
          {/* Watermark */}
          {config.showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
              <span 
                className="text-9xl font-black opacity-[0.02] -rotate-45 uppercase whitespace-nowrap"
                style={{ fontSize: '80px', color: config.themeColor }}
              >
                {config.watermarkText}
              </span>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-start border-b-2 pb-2 mb-4" style={{ borderColor: config.themeColor }}>
            <div className="flex items-center gap-3">
              {config.showLogo && (
                ((logoBase64 || madrasah?.logo_url) && !logoError) ? (
                  <img 
                    src={getProxiedUrl(logoBase64 || madrasah?.logo_url)} 
                    alt="Logo" 
                    className="w-14 h-14 object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
                    <span className="text-[8px] font-black text-slate-400">LOGO</span>
                  </div>
                )
              )}
              <div className="space-y-0.5">
                <h1 
                  className="font-black leading-tight uppercase"
                  style={{ fontSize: `${16 * config.fontScale}px`, color: config.themeColor }}
                >
                  {madrasah?.name || 'Institution Name'}
                </h1>
                <p 
                  className="font-bold text-slate-500 max-w-[340px] leading-tight"
                  style={{ fontSize: `${8.5 * config.fontScale}px` }}
                >
                  {madrasah?.address || 'Address of the Institution'}
                </p>
                <p 
                  className="font-black opacity-85 text-xs"
                  style={{ fontSize: `${8 * config.fontScale}px`, color: config.themeColor }}
                >
                  Phone: {madrasah?.phone || 'Contact Number'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
              <div className="w-16 h-20 border flex items-center justify-center text-center overflow-hidden bg-slate-50" style={{ borderColor: config.themeColor }}>
                {((photoBase64 || formData.photoUrl) && !isGeneratingBlank && !photoError) ? (
                  <img 
                    src={getProxiedUrl(photoBase64 || formData.photoUrl)} 
                    alt="Student" 
                    className="w-full h-full object-cover"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <span className="text-[8px] font-black text-slate-400 uppercase leading-none p-1">
                    Student Photo
                  </span>
                )}
              </div>
              <div className="text-white px-2.5 py-0.5 rounded-sm" style={{ backgroundColor: config.themeColor }}>
                <span className="font-black uppercase tracking-widest text-[10px]" style={{ fontSize: `${9 * config.fontScale}px` }}>{t.title}</span>
              </div>
            </div>
          </div>

          {/* Form Top Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Field label={t.formNumber} value={formData.formNumber || formData.admission_number} />
            <Field label={t.admissionDate} value={formData.admissionDate} />
            <Field label={t.academicYear} value={formData.academicYear} />
            <Field label={t.session} value={formData.session} />
          </div>

          {/* Student Info Section */}
          <div className="mb-4">
            <SectionHeading>{config.sectionHeadings.studentInfo}</SectionHeading>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <Field label={t.studentName} value={formData.studentName} className="col-span-2" />
              <Field label={t.studentNameEn} value={formData.studentNameEn} fieldKey="studentNameEn" className="col-span-2" />
              <Field label={t.dateOfBirth} value={formData.date_of_birth} fieldKey="dateOfBirth" />
              <Field label={t.gender} value={lang === 'bn' ? (formData.gender === 'male' ? t.male : t.female) : formData.gender} fieldKey="gender" />
              <Field label={t.nationality} value={formData.nationality} fieldKey="nationality" />
              <Field label={t.religion} value={formData.religion} fieldKey="religion" />
              <Field label={t.bloodGroup} value={formData.blood_group} fieldKey="bloodGroup" />
              <Field label={t.admissionClass} value={formData.admissionClass} fieldKey="admissionClass" />
            </div>
          </div>

          {/* Parent Info Section */}
          <div className="mb-4">
            <SectionHeading>{config.sectionHeadings.parentInfo}</SectionHeading>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <Field label={t.fatherName} value={formData.fatherName} fieldKey="fatherName" />
              <Field label={t.fatherOccupation} value={formData.fatherOccupation} fieldKey="fatherOccupation" />
              <Field label={t.motherName} value={formData.motherName} fieldKey="motherName" />
              <Field label={t.motherOccupation} value={formData.motherOccupation} fieldKey="motherOccupation" />
              <Field label={t.guardianName} value={formData.guardian_name} fieldKey="guardianName" />
              <Field label={t.guardianRelation} value={formData.guardianRelation} fieldKey="guardianRelation" />
              <Field label={t.guardianPhone} value={formData.guardian_phone} fieldKey="guardianPhone" className="col-span-2" />
            </div>
          </div>

          {/* Address Section */}
          <div className="mb-4">
            <SectionHeading>{config.sectionHeadings.addressInfo}</SectionHeading>
            <div className="space-y-2.5">
              <Field label={t.presentAddress} value={formData.presentAddress} fieldKey="presentAddress" />
              <Field label={t.permanentAddress} value={formData.permanentAddress} fieldKey="permanentAddress" />
            </div>
          </div>

          {/* Previous Institution Section */}
          {config.fieldVisibility.previousInstitution && (
            <div className="mb-4">
              <SectionHeading>{config.sectionHeadings.prevInstInfo}</SectionHeading>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                <Field label={t.previousInstitution} value={formData.previousInstitution} />
                <Field label={t.previousClass} value={formData.previousClass} />
              </div>
            </div>
          )}

          {/* Documents Checklist Section */}
          <div className="mb-4">
            <SectionHeading>{t.documents}</SectionHeading>
            <div className="flex flex-wrap gap-x-6 gap-y-2 py-0.5">
              {[
                { id: 'birth', label: t.docBirthCert },
                { id: 'parentNID', label: (t as any).docParentNID },
                { id: 'photos', label: t.docPhotos },
              ].map(doc => (
                <div key={doc.id} className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border flex items-center justify-center" style={{ borderColor: config.themeColor }}>
                    {(formData.documentsChecked?.includes(doc.id) && !isGeneratingBlank) && <div className="w-2 h-2" style={{ backgroundColor: config.themeColor }}></div>}
                  </div>
                  <span className="font-bold text-slate-800" style={{ fontSize: `${8 * config.fontScale}px` }}>{doc.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Declaration Section */}
          <div className="mb-4">
            <SectionHeading>{config.sectionHeadings.declaration}</SectionHeading>
            <p className="leading-relaxed text-slate-700 italic border p-2 bg-slate-50/50" style={{ fontSize: `${7.5 * config.fontScale}px`, borderColor: `${config.themeColor}20` }}>
              {t.declarationText}
            </p>
          </div>

          {/* Office Use Section */}
          <div className="mb-5 border p-2.5 relative" style={{ borderColor: config.themeColor }}>
            <div className="absolute -top-2 left-3 bg-white px-1.5">
              <span className="font-black uppercase tracking-widest" style={{ fontSize: `${8 * config.fontScale}px`, color: config.themeColor }}>
                {config.sectionHeadings.officeUse}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-6 pt-0.5">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border" style={{ borderColor: config.themeColor }}></div>
                  <span className="font-black uppercase" style={{ fontSize: `${7.5 * config.fontScale}px` }}>{t.approved}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border" style={{ borderColor: config.themeColor }}></div>
                  <span className="font-black uppercase" style={{ fontSize: `${7.5 * config.fontScale}px` }}>{t.pending}</span>
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <div className="flex items-baseline gap-1.5 border-b border-slate-100">
                  <span className="font-black uppercase opacity-50" style={{ fontSize: `${7.5 * config.fontScale}px` }}>Roll No:</span>
                  <span className="flex-1"></span>
                </div>
                <div className="flex items-baseline gap-1.5 border-b border-slate-100">
                  <span className="font-black uppercase opacity-50" style={{ fontSize: `${7.5 * config.fontScale}px` }}>Section:</span>
                  <span className="flex-1"></span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Area */}
          <div className="grid grid-cols-3 gap-6 mt-auto pt-2.5">
            <div className="text-center border-t pt-1" style={{ borderColor: config.themeColor }}>
              <span className="font-black" style={{ fontSize: `${8 * config.fontScale}px`, color: config.themeColor }}>{config.signatureLabels.student}</span>
            </div>
            <div className="text-center border-t pt-1" style={{ borderColor: config.themeColor }}>
              <span className="font-black" style={{ fontSize: `${8 * config.fontScale}px`, color: config.themeColor }}>{config.signatureLabels.parent}</span>
            </div>
            <div className="text-center border-t pt-1" style={{ borderColor: config.themeColor }}>
              <span className="font-black" style={{ fontSize: `${8 * config.fontScale}px`, color: config.themeColor }}>{config.signatureLabels.principal}</span>
            </div>
          </div>
        </div> {/* closes #print-area */}
      </div> {/* closes A4 scaling wrapper */}
    </div> {/* closes containerRef */}

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
