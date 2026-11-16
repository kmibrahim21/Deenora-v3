import React, { useRef, useState, useEffect } from 'react';
import { ADMISSION_T, DEFAULT_RULES_BN, DEFAULT_RULES_EN, DEFAULT_DECLARATION_BN, DEFAULT_DECLARATION_EN } from './constants';
import { AdmissionFormData, AdmissionFormLang, AdmissionFormConfig } from './types';
import { Institution } from '../../types';
import { Download, Printer, Scissors } from 'lucide-react';
import { getBase64Image, exportAdmissionFormHeadless } from '../../utils/admissionFormPdf';

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
  isBlank?: boolean;
  onDownloadRequest?: (isBlank: boolean) => void;
}

const AdmissionFormPreview: React.FC<Props> = ({
  formData,
  madrasah,
  lang,
  config,
  isPrint = false,
  hideButtons = false,
  isBlank = false,
  onDownloadRequest,
}) => {
  const t = ADMISSION_T[lang];
  const printRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isGeneratingBlank] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const isTwoPage = config.layoutMode === '2-page';
  const fontScale = config.fontScale || 1;

  useEffect(() => {
    let active = true;
    if (madrasah?.logo_url) {
      setLogoError(false);
      getBase64Image(madrasah.logo_url).then((base64) => {
        if (active && base64) setLogoBase64(base64);
      });
    } else {
      setLogoBase64(null);
      setLogoError(false);
    }
    return () => {
      active = false;
    };
  }, [madrasah?.logo_url]);

  useEffect(() => {
    let active = true;
    if (formData.photoUrl && !isBlank) {
      setPhotoError(false);
      getBase64Image(formData.photoUrl).then((base64) => {
        if (active && base64) setPhotoBase64(base64);
      });
    } else {
      setPhotoBase64(null);
      setPhotoError(false);
    }
    return () => {
      active = false;
    };
  }, [formData.photoUrl, isBlank]);

  useEffect(() => {
    if (isPrint || !containerRef.current) return;

    const updateScale = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      if (width < 820) {
        setScale(Math.max(0.35, (width - 16) / 794));
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
    if (onDownloadRequest) {
      onDownloadRequest(forceBlank);
      return;
    }

    setIsCapturing(true);
    try {
      const safeStudentName = forceBlank
        ? 'Blank_Form'
        : (formData.studentNameEn || formData.studentName || 'Form')
            .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')
            .replace(/\s+/g, '_');

      await exportAdmissionFormHeadless({
        formData,
        madrasah,
        lang,
        config,
        isBlank: forceBlank,
        fileName: forceBlank ? 'Admission_Form_Blank.pdf' : `Admission_Form_${safeStudentName}.pdf`,
      });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Failed to generate PDF. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const isBlankMode = isBlank || isGeneratingBlank;

  const formatGender = (g?: string) => {
    if (!g) return '';
    if (lang === 'bn') {
      if (g.toLowerCase() === 'male' || g === 'পুরুষ' || g === 'ছাত্র') return t.male;
      if (g.toLowerCase() === 'female' || g === 'মহিলা' || g === 'ছাত্রী') return t.female;
      return g;
    }
    return g;
  };

  const Field = ({
    label,
    value,
    fieldKey,
    className = '',
    compact = false,
  }: {
    label: string;
    value?: string | number;
    fieldKey?: string;
    className?: string;
    compact?: boolean;
  }) => {
    if (fieldKey && config.fieldVisibility[fieldKey] === false) return null;
    const displayValue = isBlankMode ? '' : value !== undefined && value !== null ? String(value) : '';
    const labelFontPx = (compact ? 10.4 : 11.6) * fontScale;
    const baseValueFontPx = (compact ? 11.4 : 12.6) * fontScale;
    const lengthFactor = displayValue.length > 36 ? 0.86 : displayValue.length > 24 ? 0.92 : 1;
    const valueFontPx = baseValueFontPx * lengthFactor;

    return (
      <div
        className={`flex items-baseline gap-1.5 border-b ${
          compact ? 'pb-[2.5px] min-h-[22px]' : 'pb-1.5 min-h-[29px]'
        } ${className}`}
        style={{
          borderColor: isBlankMode ? `${config.themeColor}45` : `${config.themeColor}35`,
          borderBottomStyle: isBlankMode ? 'dotted' : 'solid',
        }}
      >
        <span
          className="font-black whitespace-nowrap shrink-0 select-none"
          style={{ fontSize: `${labelFontPx}px`, color: config.themeColor }}
        >
          {label}:
        </span>
        <span
          className={`font-bold text-slate-900 flex-1 min-w-0 break-words leading-tight min-h-[1.15em] ${
            isBlankMode ? 'border-b border-dotted border-slate-400/70' : ''
          }`}
          style={{ fontSize: `${valueFontPx}px` }}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  const SectionHeading = ({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) => (
    <div
      className={`px-3 ${compact ? 'py-[2.5px] mb-1' : 'py-1.5 mb-2'} flex items-center justify-between rounded-r-md`}
      style={{
        backgroundColor: `${config.themeColor}12`,
        borderLeft: `4px solid ${config.themeColor}`,
      }}
    >
      <h2
        className="font-black uppercase tracking-wider"
        style={{ fontSize: `${(compact ? 10.8 : 12.4) * fontScale}px`, color: config.themeColor }}
      >
        {children}
      </h2>
    </div>
  );

  const PageDecorations = () => (
    <>
      <div
        className="absolute inset-0 border-[6px] pointer-events-none opacity-[0.08]"
        style={{ borderColor: config.themeColor }}
      />
      <div
        className="absolute inset-[7px] border-[1px] pointer-events-none"
        style={{ borderColor: config.themeColor }}
      />
      <div
        className="absolute inset-[10px] border-[2px] border-double pointer-events-none"
        style={{ borderColor: config.themeColor }}
      />
      {config.showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.035]">
          <span
            className="font-black -rotate-45 uppercase whitespace-nowrap text-center px-6"
            style={{ fontSize: '62px', color: config.themeColor }}
          >
            {config.watermarkText || madrasah?.name || t.title}
          </span>
        </div>
      )}
    </>
  );

  const InstitutionalHeader = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={`flex justify-between items-center gap-3.5 border-b-2 ${compact ? 'pb-1.5' : 'pb-3'}`}
      style={{ borderColor: config.themeColor }}
    >
      {/* Left: Official Logo */}
      {config.showLogo ? (
        <div
          className={`${compact ? 'w-[70px] h-[82px]' : 'w-[84px] h-[98px]'} bg-white border-2 rounded-xl flex items-center justify-center overflow-hidden shadow-xs p-1 shrink-0`}
          style={{ borderColor: config.themeColor }}
        >
          {(logoBase64 || madrasah?.logo_url) && !logoError ? (
            <img
              src={getProxiedUrl(logoBase64 || madrasah?.logo_url)}
              alt="Logo"
              className="w-full h-full object-contain rounded-lg"
              onError={() => setLogoError(true)}
              crossOrigin="anonymous"
            />
          ) : (
            <span className="text-[11px] font-black text-slate-300">LOGO</span>
          )}
        </div>
      ) : (
        <div className={`${compact ? 'w-[70px] h-[82px]' : 'w-[84px] h-[98px]'} shrink-0`} />
      )}

      {/* Center: Institution Name, Address, Phone & Form Title Pill */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-2 space-y-0.5">
        <h1
          className="font-black leading-tight uppercase tracking-tight text-center"
          style={{ fontSize: `${(compact ? 17.0 : 20.0) * fontScale}px`, color: config.themeColor }}
        >
          {madrasah?.name || (lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name')}
        </h1>
        <p
          className="font-bold text-slate-600 max-w-[490px] leading-snug text-center"
          style={{ fontSize: `${(compact ? 10.0 : 11.2) * fontScale}px` }}
        >
          {madrasah?.address || (lang === 'bn' ? 'প্রতিষ্ঠানের ঠিকানা' : 'Address of the Institution')}
        </p>
        {madrasah?.phone && (
          <p
            className="font-black opacity-90 text-center"
            style={{ fontSize: `${(compact ? 9.5 : 10.6) * fontScale}px`, color: config.themeColor }}
          >
            {lang === 'bn' ? 'মোবাইল:' : 'Phone:'} {madrasah.phone}
          </p>
        )}
        <div className="pt-0.5">
          <div
            className="inline-flex items-center justify-center text-white px-6 py-0.5 rounded-full shadow-xs"
            style={{ backgroundColor: config.themeColor }}
          >
            <span
              className="font-black uppercase tracking-widest whitespace-nowrap"
              style={{ fontSize: `${(compact ? 10.6 : 12.2) * fontScale}px` }}
            >
              {t.title}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Passport Size Photo Box */}
      <div
        className={`${compact ? 'w-[70px] h-[82px]' : 'w-[84px] h-[98px]'} border-2 bg-slate-50/70 overflow-hidden shadow-xs flex flex-col items-center justify-center p-1 rounded-xl text-center shrink-0`}
        style={{ borderColor: config.themeColor, borderStyle: isBlankMode ? 'dashed' : 'solid' }}
      >
        {(photoBase64 || formData.photoUrl) && !isBlankMode && !photoError ? (
          <img
            src={getProxiedUrl(photoBase64 || formData.photoUrl)}
            alt="Student"
            className="w-full h-full object-cover rounded-lg"
            onError={() => setPhotoError(true)}
            crossOrigin="anonymous"
          />
        ) : (
          <div className="text-center p-0.5 flex flex-col items-center justify-center h-full">
            <span
              className="text-[10px] font-black uppercase leading-tight"
              style={{ color: config.themeColor }}
            >
              {lang === 'bn' ? 'ছবি' : 'Photo'}
            </span>
            <span className="text-[8.5px] font-bold text-slate-500 uppercase leading-tight mt-0.5">
              {lang === 'bn' ? 'পাসপোর্ট সাইজ' : 'Passport Size'}
            </span>
            <span className="text-[8px] font-semibold text-slate-400 mt-0.5 leading-tight">
              {lang === 'bn' ? '(এখানে লাগান)' : '(Attach Here)'}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const rulesList = (config.rulesText || (lang === 'bn' ? DEFAULT_RULES_BN : DEFAULT_RULES_EN))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const declarationContent =
    config.declarationText || (lang === 'bn' ? DEFAULT_DECLARATION_BN : DEFAULT_DECLARATION_EN);

  const docsChecklist = [
    { id: 'birth', label: t.docBirthCert },
    { id: 'parentNID', label: t.docParentNID },
    { id: 'photos', label: t.docPhotos },
    { id: 'tc', label: t.docPrevTC },
  ];

  const pageStyleBase: React.CSSProperties = {
    width: '210mm',
    height: '297mm',
    boxSizing: 'border-box',
    fontFamily: "'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', 'Inter', sans-serif",
    backgroundColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-slate-50/50 pb-20">
      {/* Top Capturing Overlay */}
      {isCapturing && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4 border border-slate-100 dark:border-slate-800">
            <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <p className="text-base font-black text-slate-800 dark:text-slate-100 font-noto">
                {lang === 'bn' ? 'ভর্তি ফরম পিডিএফ প্রস্তুত করা হচ্ছে...' : 'Preparing Admission Form PDF...'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'bn' ? 'নিখুঁত প্রিন্ট কোয়ালিটি ও ফন্ট তৈরি হচ্ছে' : 'Preserving print layout & SolaimanLipi font'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!isPrint && !hideButtons && (
        <div className="flex flex-wrap gap-3 mb-6 justify-center w-full px-4 pt-4 sticky top-0 z-50 bg-slate-50/90 backdrop-blur-md pb-4">
          <button
            onClick={() => downloadPDF(false)}
            disabled={isCapturing}
            className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl flex items-center gap-2.5 shadow-lg shadow-blue-500/25 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
          >
            <Download size={18} />
            <span>{t.downloadPdf}</span>
          </button>
          <button
            onClick={() => downloadPDF(true)}
            disabled={isCapturing}
            className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl flex items-center gap-2.5 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
          >
            <Download size={18} />
            <span>{lang === 'bn' ? 'ব্ল্যাঙ্ক ফরম ডাউনলোড (অফলাইন প্রিন্ট)' : 'Download Blank Form'}</span>
          </button>
          <button
            onClick={() => window.print()}
            disabled={isCapturing}
            className="px-5 py-2.5 sm:px-6 sm:py-3 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl flex items-center gap-2.5 shadow-lg shadow-slate-900/20 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
          >
            <Printer size={18} />
            <span>{lang === 'bn' ? 'প্রিন্ট করুন' : 'Print Now'}</span>
          </button>
        </div>
      )}

      {/* A4 Page Scaling Container */}
      <div
        ref={containerRef}
        className={isPrint ? 'w-full' : 'w-full flex flex-col items-center overflow-hidden'}
      >
        <div
          style={
            isPrint
              ? {
                  width: '210mm',
                  height: isTwoPage ? '594mm' : '297mm',
                  position: 'relative',
                }
              : {
                  width: '100%',
                  maxWidth: '794px',
                  height: `${(isTwoPage ? 2246 + 24 : 1123) * scale}px`,
                  position: 'relative',
                  overflow: 'hidden',
                }
          }
          className="flex justify-center items-start"
        >
          <div
            ref={printRef}
            id="print-area"
            className={`flex flex-col ${isPrint ? 'gap-0' : 'gap-6'}`}
            style={
              isPrint
                ? {
                    width: '210mm',
                    margin: 0,
                    padding: 0,
                  }
                : {
                    width: '210mm',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    position: 'absolute',
                    top: 0,
                  }
            }
          >
            {/* ========================================================================= */}
            {/* MODE 1: 1-PAGE COMPACT FULL-BLEED A4 LAYOUT                               */}
            {/* ========================================================================= */}
            {!isTwoPage && (
              <div
                id="print-page-1"
                className="bg-white font-noto flex flex-col justify-between shadow-2xl"
                style={{
                  ...pageStyleBase,
                  padding: '8.5mm 11mm 8.5mm 11mm',
                }}
              >
                <PageDecorations />

                {/* Direct flex-col justify-between across the ENTIRE 297mm page so there is ZERO blank space at bottom */}
                <div className="relative z-10 flex flex-col justify-between h-full">
                  {/* 1. Institutional Header */}
                  <InstitutionalHeader compact={true} />

                  {/* 2. Institutional & Metadata Row */}
                  <div
                    className="grid grid-cols-12 gap-3 px-3 py-1 rounded-lg border"
                    style={{
                      backgroundColor: `${config.themeColor}08`,
                      borderColor: `${config.themeColor}30`,
                    }}
                  >
                    <Field compact label={t.formNumber} value={formData.formNumber || formData.admission_number} className="col-span-3" />
                    <Field compact label={t.admissionDate} value={formData.admissionDate} className="col-span-3" />
                    <Field compact label={t.academicYear} value={formData.academicYear} className="col-span-3" />
                    <Field compact label={t.session} value={formData.session} className="col-span-3" />
                  </div>

                  {/* 3. Student Information */}
                  <section>
                    <SectionHeading compact>{config.sectionHeadings.studentInfo}</SectionHeading>
                    <div className="grid grid-cols-12 gap-x-3 gap-y-1 px-1">
                      <Field
                        compact
                        label={t.studentName}
                        value={formData.studentName}
                        className={config.fieldVisibility.studentNameEn === false ? 'col-span-12' : 'col-span-6'}
                      />
                      <Field
                        compact
                        label={t.studentNameEn}
                        value={formData.studentNameEn}
                        fieldKey="studentNameEn"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.username}
                        value={formData.username || formData.admission_number}
                        fieldKey="username"
                        className="col-span-3"
                      />
                      <Field
                        compact
                        label={t.biometricId}
                        value={formData.biometricId || formData.biometric_id}
                        fieldKey="biometricId"
                        className="col-span-3"
                      />
                      <Field
                        compact
                        label={t.birthRegNo}
                        value={formData.birthRegNo}
                        fieldKey="birthRegNo"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.dateOfBirth}
                        value={formData.date_of_birth}
                        fieldKey="dateOfBirth"
                        className="col-span-3"
                      />
                      <Field
                        compact
                        label={t.gender}
                        value={formatGender(formData.gender)}
                        fieldKey="gender"
                        className="col-span-2"
                      />
                      <Field
                        compact
                        label={t.bloodGroup}
                        value={formData.blood_group}
                        fieldKey="bloodGroup"
                        className="col-span-2"
                      />
                      <Field
                        compact
                        label={t.religion}
                        value={formData.religion}
                        fieldKey="religion"
                        className="col-span-2"
                      />
                      <Field
                        compact
                        label={t.nationality}
                        value={formData.nationality}
                        fieldKey="nationality"
                        className="col-span-3"
                      />
                      <Field
                        compact
                        label={t.admissionClass}
                        value={formData.admissionClass}
                        fieldKey="admissionClass"
                        className="col-span-5"
                      />
                      <Field
                        compact
                        label={t.department}
                        value={formData.department}
                        fieldKey="department"
                        className="col-span-3"
                      />
                      <Field
                        compact
                        label={t.residentialStatus}
                        value={formData.residentialStatus}
                        fieldKey="residentialStatus"
                        className="col-span-4"
                      />
                    </div>
                  </section>

                  {/* 4. Parents & Guardian Information */}
                  <section>
                    <SectionHeading compact>{config.sectionHeadings.parentInfo}</SectionHeading>
                    <div className="grid grid-cols-12 gap-x-3 gap-y-1 px-1">
                      <Field
                        compact
                        label={t.fatherName}
                        value={formData.fatherName}
                        fieldKey="fatherName"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.fatherOccupation}
                        value={formData.fatherOccupation}
                        fieldKey="fatherOccupation"
                        className="col-span-2"
                      />
                      <Field
                        compact
                        label={t.fatherNid}
                        value={formData.fatherNid}
                        fieldKey="fatherNid"
                        className="col-span-4"
                      />
                      <Field
                        compact
                        label={t.motherName}
                        value={formData.motherName}
                        fieldKey="motherName"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.motherOccupation}
                        value={formData.motherOccupation}
                        fieldKey="motherOccupation"
                        className="col-span-2"
                      />
                      <Field
                        compact
                        label={t.motherNid}
                        value={formData.motherNid}
                        fieldKey="motherNid"
                        className="col-span-4"
                      />
                      <Field
                        compact
                        label={t.guardianName}
                        value={formData.guardian_name}
                        fieldKey="guardianName"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.guardianRelation}
                        value={formData.guardianRelation}
                        fieldKey="guardianRelation"
                        className="col-span-2"
                      />
                      <Field
                        compact
                        label={t.guardianPhone}
                        value={formData.guardian_phone}
                        fieldKey="guardianPhone"
                        className="col-span-4"
                      />
                      <Field
                        compact
                        label={t.whatsappNumber}
                        value={formData.whatsappNumber || formData.guardian_phone}
                        fieldKey="whatsappNumber"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.emergencyPhone}
                        value={formData.emergencyPhone}
                        fieldKey="emergencyPhone"
                        className="col-span-6"
                      />
                    </div>
                  </section>

                  {/* 5. Address & Academic History */}
                  <section>
                    <SectionHeading compact>{config.sectionHeadings.addressInfo}</SectionHeading>
                    <div className="grid grid-cols-12 gap-x-3 gap-y-1 px-1">
                      <Field
                        compact
                        label={t.presentAddress}
                        value={formData.presentAddress}
                        fieldKey="presentAddress"
                        className="col-span-6"
                      />
                      <Field
                        compact
                        label={t.permanentAddress}
                        value={formData.permanentAddress}
                        fieldKey="permanentAddress"
                        className="col-span-6"
                      />
                      {config.fieldVisibility.previousInstitution !== false && (
                        <>
                          <Field
                            compact
                            label={t.previousInstitution}
                            value={formData.previousInstitution}
                            className="col-span-6"
                          />
                          <Field
                            compact
                            label={t.previousClass}
                            value={formData.previousClass}
                            className="col-span-3"
                          />
                          <Field
                            compact
                            label={t.tcNumber}
                            value={formData.tcNumber}
                            fieldKey="tcNumber"
                            className="col-span-3"
                          />
                        </>
                      )}
                    </div>
                  </section>

                  {/* 6. Fees & Financials (Full 12-Col Row so amounts are never cut off) */}
                  {config.fieldVisibility.financialInfo !== false && (
                    <section>
                      <SectionHeading compact>
                        {config.sectionHeadings.financialInfo || t.financialInfo}
                      </SectionHeading>
                      <div className="grid grid-cols-12 gap-x-3.5 gap-y-1 px-1">
                        <Field
                          compact
                          label={t.admissionFee}
                          value={formData.admissionFee}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.monthlyFee}
                          value={formData.monthlyFee}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.receiptNumber}
                          value={formData.receiptNumber}
                          className="col-span-4"
                        />
                      </div>
                    </section>
                  )}

                  {/* 7. Documents Verification Checklist (Full 12-Col Row) */}
                  {config.fieldVisibility.documentsChecklist !== false && (
                    <section>
                      <SectionHeading compact>
                        {config.sectionHeadings.documentsInfo || t.documents}
                      </SectionHeading>
                      <div className="grid grid-cols-4 gap-2 py-0.5 px-1">
                        {docsChecklist.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-1.5">
                            <div
                              className="w-3.5 h-3.5 border-2 flex items-center justify-center rounded-xs bg-white shrink-0"
                              style={{ borderColor: config.themeColor }}
                            >
                              {!isBlankMode && formData.documentsChecked?.includes(doc.id) && (
                                <div
                                  className="w-2 h-2"
                                  style={{ backgroundColor: config.themeColor }}
                                />
                              )}
                            </div>
                            <span
                              className="font-bold text-slate-800 leading-tight break-words"
                              style={{ fontSize: `${9.6 * fontScale}px` }}
                            >
                              {doc.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 8. Undertaking Box */}
                  <div
                    className="px-3 py-1.5 rounded-lg border bg-slate-50/50"
                    style={{ borderColor: `${config.themeColor}30` }}
                  >
                    <p
                      className="font-bold text-slate-800 leading-snug text-justify"
                      style={{ fontSize: `${9.6 * fontScale}px` }}
                    >
                      <span className="font-black mr-1.5" style={{ color: config.themeColor }}>
                        {config.sectionHeadings.declaration || t.declaration}:
                      </span>
                      {declarationContent}
                    </p>
                  </div>

                  {/* 9. Office Use Box */}
                  {config.fieldVisibility.officeUseBox !== false && (
                    <div
                      className="border-2 px-3.5 py-2 relative bg-slate-50/35 rounded-lg"
                      style={{ borderColor: config.themeColor }}
                    >
                      <div className="absolute -top-2.5 left-3 bg-white px-2">
                        <span
                          className="font-black uppercase tracking-wider"
                          style={{ fontSize: `${9.5 * fontScale}px`, color: config.themeColor }}
                        >
                          {config.sectionHeadings.officeUse}
                        </span>
                      </div>
                      <div className="grid grid-cols-12 gap-x-3.5 gap-y-1 items-center pt-0.5">
                        <div className="col-span-4 flex items-center gap-2.5">
                          <span
                            className="font-black text-slate-700"
                            style={{ fontSize: `${9.5 * fontScale}px` }}
                          >
                            {t.admissionStatus}:
                          </span>
                          <div className="flex items-center gap-1">
                            <div
                              className="w-3.5 h-3.5 border-2 rounded-xs"
                              style={{ borderColor: config.themeColor }}
                            />
                            <span
                              className="font-black uppercase text-slate-800"
                              style={{ fontSize: `${9.2 * fontScale}px` }}
                            >
                              {t.approved}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div
                              className="w-3.5 h-3.5 border-2 rounded-xs"
                              style={{ borderColor: config.themeColor }}
                            />
                            <span
                              className="font-black uppercase text-slate-800"
                              style={{ fontSize: `${9.2 * fontScale}px` }}
                            >
                              {t.pending}
                            </span>
                          </div>
                        </div>
                        <Field
                          compact
                          label={lang === 'bn' ? 'বরাদ্দকৃত শ্রেণি' : 'Class'}
                          value={formData.admissionClass}
                          className="col-span-5"
                        />
                        <Field
                          compact
                          label={lang === 'bn' ? 'রোল নং' : 'Roll No'}
                          value={formData.roll}
                          className="col-span-3"
                        />
                        <Field
                          compact
                          label={lang === 'bn' ? 'শাখা/বিভাগ' : 'Section'}
                          value={formData.department}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={lang === 'bn' ? 'নির্ধারিত বেতন (৳)' : 'Monthly Fee'}
                          value={formData.monthlyFee}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={lang === 'bn' ? 'যাচাইকারী' : 'Verified By'}
                          value=""
                          className="col-span-4"
                        />
                      </div>
                    </div>
                  )}

                  {/* 10. Bottom Pinned 3-Column Signatures */}
                  <div className="grid grid-cols-3 gap-10 pt-4">
                    <div className="text-center border-t-2 pt-1" style={{ borderColor: config.themeColor }}>
                      <span
                        className="font-black uppercase tracking-wider block"
                        style={{ fontSize: `${10.0 * fontScale}px`, color: config.themeColor }}
                      >
                        {config.signatureLabels.student}
                      </span>
                    </div>
                    <div className="text-center border-t-2 pt-1" style={{ borderColor: config.themeColor }}>
                      <span
                        className="font-black uppercase tracking-wider block"
                        style={{ fontSize: `${10.0 * fontScale}px`, color: config.themeColor }}
                      >
                        {config.signatureLabels.parent}
                      </span>
                    </div>
                    <div className="text-center border-t-2 pt-1" style={{ borderColor: config.themeColor }}>
                      <span
                        className="font-black uppercase tracking-wider block"
                        style={{ fontSize: `${10.0 * fontScale}px`, color: config.themeColor }}
                      >
                        {config.signatureLabels.principal}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MODE 2: 2-PAGE DOUBLE-SIDED FULL-BLEED A4 LAYOUT                          */}
            {/* ========================================================================= */}
            {isTwoPage && (
              <>
                {/* --------------------- PAGE 1: FRONT SIDE (BIO-DATA) --------------------- */}
                <div
                  id="print-page-1"
                  className="bg-white font-noto flex flex-col justify-between shadow-2xl"
                  style={{
                    ...pageStyleBase,
                    padding: '10mm 12mm 10mm 12mm',
                  }}
                >
                  <PageDecorations />

                  {/* Direct flex-col justify-between across Page 1 so it fills 100% of A4 height */}
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    {/* 1. Header */}
                    <InstitutionalHeader compact={false} />

                    {/* 2. Top Metadata Row */}
                    <div
                      className="grid grid-cols-12 gap-3.5 px-3.5 py-2 rounded-xl border"
                      style={{
                        backgroundColor: `${config.themeColor}08`,
                        borderColor: `${config.themeColor}30`,
                      }}
                    >
                      <Field label={t.formNumber} value={formData.formNumber || formData.admission_number} className="col-span-3" />
                      <Field label={t.admissionDate} value={formData.admissionDate} className="col-span-3" />
                      <Field label={t.academicYear} value={formData.academicYear} className="col-span-3" />
                      <Field label={t.session} value={formData.session} className="col-span-3" />
                    </div>

                    {/* 3. Section 1: Student Info */}
                    <section>
                      <SectionHeading>{config.sectionHeadings.studentInfo}</SectionHeading>
                      <div className="grid grid-cols-12 gap-x-4 gap-y-2 px-1">
                        <Field
                          label={t.studentName}
                          value={formData.studentName}
                          className={config.fieldVisibility.studentNameEn === false ? 'col-span-12' : 'col-span-6'}
                        />
                        <Field
                          label={t.studentNameEn}
                          value={formData.studentNameEn}
                          fieldKey="studentNameEn"
                          className="col-span-6"
                        />
                        <Field
                          label={t.username}
                          value={formData.username || formData.admission_number}
                          fieldKey="username"
                          className="col-span-3"
                        />
                        <Field
                          label={t.biometricId}
                          value={formData.biometricId || formData.biometric_id}
                          fieldKey="biometricId"
                          className="col-span-3"
                        />
                        <Field
                          label={t.birthRegNo}
                          value={formData.birthRegNo}
                          fieldKey="birthRegNo"
                          className="col-span-6"
                        />
                        <Field
                          label={t.dateOfBirth}
                          value={formData.date_of_birth}
                          fieldKey="dateOfBirth"
                          className="col-span-3"
                        />
                        <Field
                          label={t.gender}
                          value={formatGender(formData.gender)}
                          fieldKey="gender"
                          className="col-span-2"
                        />
                        <Field
                          label={t.bloodGroup}
                          value={formData.blood_group}
                          fieldKey="bloodGroup"
                          className="col-span-2"
                        />
                        <Field
                          label={t.religion}
                          value={formData.religion}
                          fieldKey="religion"
                          className="col-span-2"
                        />
                        <Field
                          label={t.nationality}
                          value={formData.nationality}
                          fieldKey="nationality"
                          className="col-span-3"
                        />
                        <Field
                          label={t.admissionClass}
                          value={formData.admissionClass}
                          fieldKey="admissionClass"
                          className="col-span-5"
                        />
                        <Field
                          label={t.department}
                          value={formData.department}
                          fieldKey="department"
                          className="col-span-3"
                        />
                        <Field
                          label={t.residentialStatus}
                          value={formData.residentialStatus}
                          fieldKey="residentialStatus"
                          className="col-span-4"
                        />
                      </div>
                    </section>

                    {/* 4. Section 2: Parents & Guardian Info */}
                    <section>
                      <SectionHeading>{config.sectionHeadings.parentInfo}</SectionHeading>
                      <div className="grid grid-cols-12 gap-x-4 gap-y-2 px-1">
                        <Field
                          label={t.fatherName}
                          value={formData.fatherName}
                          fieldKey="fatherName"
                          className="col-span-6"
                        />
                        <Field
                          label={t.fatherOccupation}
                          value={formData.fatherOccupation}
                          fieldKey="fatherOccupation"
                          className="col-span-2"
                        />
                        <Field
                          label={t.fatherNid}
                          value={formData.fatherNid}
                          fieldKey="fatherNid"
                          className="col-span-4"
                        />
                        <Field
                          label={t.motherName}
                          value={formData.motherName}
                          fieldKey="motherName"
                          className="col-span-6"
                        />
                        <Field
                          label={t.motherOccupation}
                          value={formData.motherOccupation}
                          fieldKey="motherOccupation"
                          className="col-span-2"
                        />
                        <Field
                          label={t.motherNid}
                          value={formData.motherNid}
                          fieldKey="motherNid"
                          className="col-span-4"
                        />
                        <Field
                          label={t.guardianName}
                          value={formData.guardian_name}
                          fieldKey="guardianName"
                          className="col-span-6"
                        />
                        <Field
                          label={t.guardianRelation}
                          value={formData.guardianRelation}
                          fieldKey="guardianRelation"
                          className="col-span-2"
                        />
                        <Field
                          label={t.guardianPhone}
                          value={formData.guardian_phone}
                          fieldKey="guardianPhone"
                          className="col-span-4"
                        />
                        <Field
                          label={t.whatsappNumber}
                          value={formData.whatsappNumber || formData.guardian_phone}
                          fieldKey="whatsappNumber"
                          className="col-span-6"
                        />
                        <Field
                          label={t.emergencyPhone}
                          value={formData.emergencyPhone}
                          fieldKey="emergencyPhone"
                          className="col-span-6"
                        />
                      </div>
                    </section>

                    {/* 5. Section 3: Address & Academic History */}
                    <section>
                      <SectionHeading>{config.sectionHeadings.addressInfo}</SectionHeading>
                      <div className="grid grid-cols-12 gap-x-4 gap-y-2 px-1">
                        <Field
                          label={t.presentAddress}
                          value={formData.presentAddress}
                          fieldKey="presentAddress"
                          className="col-span-12"
                        />
                        <Field
                          label={t.permanentAddress}
                          value={formData.permanentAddress}
                          fieldKey="permanentAddress"
                          className="col-span-12"
                        />
                        {config.fieldVisibility.previousInstitution !== false && (
                          <>
                            <Field
                              label={t.previousInstitution}
                              value={formData.previousInstitution}
                              className="col-span-6"
                            />
                            <Field
                              label={t.previousClass}
                              value={formData.previousClass}
                              className="col-span-3"
                            />
                            <Field
                              label={t.tcNumber}
                              value={formData.tcNumber}
                              fieldKey="tcNumber"
                              className="col-span-3"
                            />
                          </>
                        )}
                      </div>
                    </section>

                    {/* 6. Section 4: Fees & Financials */}
                    {config.fieldVisibility.financialInfo !== false && (
                      <section>
                        <SectionHeading>
                          {config.sectionHeadings.financialInfo || t.financialInfo}
                        </SectionHeading>
                        <div className="grid grid-cols-12 gap-x-4 gap-y-2 px-1">
                          <Field
                            label={t.admissionFee}
                            value={formData.admissionFee}
                            className="col-span-4"
                          />
                          <Field
                            label={t.monthlyFee}
                            value={formData.monthlyFee}
                            className="col-span-4"
                          />
                          <Field
                            label={t.receiptNumber}
                            value={formData.receiptNumber}
                            className="col-span-4"
                          />
                        </div>
                      </section>
                    )}

                    {/* 7. Section 5: Document Verification Checklist */}
                    {config.fieldVisibility.documentsChecklist !== false && (
                      <section>
                        <SectionHeading>
                          {config.sectionHeadings.documentsInfo || t.documents}
                        </SectionHeading>
                        <div
                          className="grid grid-cols-2 gap-x-6 gap-y-2 py-2.5 px-3 rounded-xl border bg-slate-50/40"
                          style={{ borderColor: `${config.themeColor}25` }}
                        >
                          {docsChecklist.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-2.5">
                              <div
                                className="w-4 h-4 border-2 flex items-center justify-center rounded-xs bg-white shrink-0"
                                style={{ borderColor: config.themeColor }}
                              >
                                {!isBlankMode && formData.documentsChecked?.includes(doc.id) && (
                                  <div
                                    className="w-2.5 h-2.5"
                                    style={{ backgroundColor: config.themeColor }}
                                  />
                                )}
                              </div>
                              <span
                                className="font-bold text-slate-800 break-words"
                                style={{ fontSize: `${11.2 * fontScale}px` }}
                              >
                                {doc.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 8. Page 1 Footer */}
                    <div
                      className="flex items-center justify-between border-t-2 pt-2.5"
                      style={{ borderColor: `${config.themeColor}45` }}
                    >
                      <span
                        className="font-black tracking-wider"
                        style={{ fontSize: `${10.5 * fontScale}px`, color: config.themeColor }}
                      >
                        {lang === 'bn'
                          ? 'পৃষ্ঠা ১/২ - শিক্ষার্থীর জীবনবৃত্তান্ত'
                          : 'Page 1/2 - Student Bio-Data'}
                      </span>
                      <span
                        className="font-bold text-slate-600 italic"
                        style={{ fontSize: `${10.0 * fontScale}px` }}
                      >
                        {lang === 'bn'
                          ? 'অপর পৃষ্ঠায় নিয়মাবলি, অঙ্গীকারনামা ও ভর্তি রসিদ স্লিপ দেখুন →'
                          : 'See Back Page for Rules, Undertaking & Admission Receipt Slip →'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* --------------------- PAGE 2: BACK SIDE (RULES, UNDERTAKING, OFFICE & SLIP) --------------------- */}
                <div
                  id="print-page-2"
                  className="bg-white font-noto flex flex-col justify-between shadow-2xl"
                  style={{
                    ...pageStyleBase,
                    padding: '10mm 12mm 10mm 12mm',
                  }}
                >
                  <PageDecorations />

                  {/* Direct flex-col justify-between across Page 2 so it fills 100% of A4 height */}
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    {/* 1. Compact Top Header */}
                    <div
                      className="flex items-center justify-between border-b-2 pb-2.5"
                      style={{ borderColor: config.themeColor }}
                    >
                      <div className="flex items-center gap-3">
                        {config.showLogo && (logoBase64 || madrasah?.logo_url) && !logoError && (
                          <img
                            src={getProxiedUrl(logoBase64 || madrasah?.logo_url)}
                            alt="Logo"
                            className="w-10 h-10 object-contain"
                            crossOrigin="anonymous"
                          />
                        )}
                        <div>
                          <h2
                            className="font-black uppercase leading-tight"
                            style={{ fontSize: `${15.5 * fontScale}px`, color: config.themeColor }}
                          >
                            {madrasah?.name || (lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name')}
                          </h2>
                          <p
                            className="font-bold text-slate-500 leading-tight"
                            style={{ fontSize: `${10.2 * fontScale}px` }}
                          >
                            {madrasah?.address || ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className="px-4 py-1.5 rounded-full text-white font-black tracking-wider"
                        style={{
                          backgroundColor: config.themeColor,
                          fontSize: `${10.2 * fontScale}px`,
                        }}
                      >
                        {lang === 'bn' ? 'ফরমের উল্টো পিঠ (পৃষ্ঠা ২/২)' : 'Back Side of Form (Page 2/2)'}
                      </span>
                    </div>

                    {/* 2. Part A: প্রতিষ্ঠানের সাধারণ নিয়মাবলি ও নির্দেশিকা */}
                    <section>
                      <SectionHeading>
                        {config.sectionHeadings.rulesHeading || t.rulesHeading}
                      </SectionHeading>
                      <div
                        className="p-4 rounded-xl border bg-slate-50/45 space-y-2"
                        style={{ borderColor: `${config.themeColor}30` }}
                      >
                        {rulesList.map((rule, idx) => (
                          <p
                            key={idx}
                            className="font-bold text-slate-800 leading-relaxed"
                            style={{ fontSize: `${11.4 * fontScale}px` }}
                          >
                            {rule}
                          </p>
                        ))}
                      </div>
                    </section>

                    {/* 3. Part B: শিক্ষার্থী ও অভিভাবকের যৌথ অঙ্গীকারনামা */}
                    <section>
                      <SectionHeading>
                        {config.sectionHeadings.declaration || t.declaration}
                      </SectionHeading>
                      <div
                        className="p-4 rounded-xl border bg-slate-50/35 flex flex-col justify-between space-y-8"
                        style={{ borderColor: `${config.themeColor}30` }}
                      >
                        <p
                          className="font-bold text-slate-800 leading-relaxed text-justify"
                          style={{ fontSize: `${11.4 * fontScale}px` }}
                        >
                          {declarationContent}
                        </p>

                        <div className="grid grid-cols-2 gap-10 pt-5">
                          <div className="flex items-end justify-between gap-3">
                            <div
                              className="flex-1 text-center border-t-2 pt-1.5"
                              style={{ borderColor: config.themeColor }}
                            >
                              <span
                                className="font-black uppercase tracking-wider block"
                                style={{ fontSize: `${10.8 * fontScale}px`, color: config.themeColor }}
                              >
                                {config.signatureLabels.student}
                              </span>
                            </div>
                            <div className="w-28 text-center border-t border-dotted border-slate-400 pt-1.5">
                              <span
                                className="font-bold text-slate-600 block"
                                style={{ fontSize: `${9.8 * fontScale}px` }}
                              >
                                {lang === 'bn' ? 'তারিখ' : 'Date'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-end justify-between gap-3">
                            <div
                              className="flex-1 text-center border-t-2 pt-1.5"
                              style={{ borderColor: config.themeColor }}
                            >
                              <span
                                className="font-black uppercase tracking-wider block"
                                style={{ fontSize: `${10.8 * fontScale}px`, color: config.themeColor }}
                              >
                                {config.signatureLabels.parent}
                              </span>
                            </div>
                            <div className="w-28 text-center border-t border-dotted border-slate-400 pt-1.5">
                              <span
                                className="font-bold text-slate-600 block"
                                style={{ fontSize: `${9.8 * fontScale}px` }}
                              >
                                {lang === 'bn' ? 'তারিখ' : 'Date'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 4. Part C: অফিস অনুমোদন ও চূড়ান্ত বরাদ্দ */}
                    <section>
                      <div
                        className="border-2 p-4 rounded-xl relative bg-slate-50/35"
                        style={{ borderColor: config.themeColor }}
                      >
                        <div className="absolute -top-3 left-4 bg-white px-2.5">
                          <span
                            className="font-black uppercase tracking-wider"
                            style={{ fontSize: `${11.2 * fontScale}px`, color: config.themeColor }}
                          >
                            {config.sectionHeadings.officeUse || t.officeUse}
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-x-4 gap-y-2.5 pt-1.5 items-center">
                          <div className="col-span-5 flex items-center gap-2.5">
                            <span
                              className="font-black text-slate-700"
                              style={{ fontSize: `${10.6 * fontScale}px` }}
                            >
                              {t.admissionStatus}:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-4 h-4 border-2 rounded-xs"
                                style={{ borderColor: config.themeColor }}
                              />
                              <span
                                className="font-bold text-slate-800"
                                style={{ fontSize: `${10.2 * fontScale}px` }}
                              >
                                {t.approved}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-4 h-4 border-2 rounded-xs"
                                style={{ borderColor: config.themeColor }}
                              />
                              <span
                                className="font-bold text-slate-800"
                                style={{ fontSize: `${10.2 * fontScale}px` }}
                              >
                                {t.pending}
                              </span>
                            </div>
                          </div>

                          <Field
                            compact
                            label={lang === 'bn' ? 'বরাদ্দকৃত শ্রেণি' : 'Allocated Class'}
                            value={formData.admissionClass}
                            className="col-span-7"
                          />
                          <Field
                            compact
                            label={lang === 'bn' ? 'শাখা / বিভাগ' : 'Section / Dept'}
                            value={formData.department}
                            className="col-span-4"
                          />
                          <Field
                            compact
                            label={lang === 'bn' ? 'চূড়ান্ত রোল নং' : 'Roll Number'}
                            value={formData.roll}
                            className="col-span-4"
                          />
                          <Field
                            compact
                            label={lang === 'bn' ? 'নির্ধারিত বেতন (৳)' : 'Monthly Fee'}
                            value={formData.monthlyFee}
                            className="col-span-4"
                          />
                          <Field
                            compact
                            label={lang === 'bn' ? 'হল / রুম নং' : 'Room / Hall No'}
                            value=""
                            className="col-span-4"
                          />
                          <Field
                            compact
                            label={lang === 'bn' ? 'যাচাইকারী' : 'Verified By'}
                            value=""
                            className="col-span-3"
                          />
                          <div className="col-span-5 pt-4">
                            <div
                              className="text-center border-t-2 pt-1.5"
                              style={{ borderColor: config.themeColor }}
                            >
                              <span
                                className="font-black uppercase tracking-wider block"
                                style={{ fontSize: `${10.2 * fontScale}px`, color: config.themeColor }}
                              >
                                {config.signatureLabels.principal}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 5. Part D: Perforated Scissor Cut Divider */}
                    <div className="relative flex items-center justify-center my-1">
                      <div
                        className="w-full border-t-2 border-dashed"
                        style={{ borderColor: `${config.themeColor}75` }}
                      />
                      <div className="absolute bg-white px-3.5 flex items-center gap-1.5">
                        <Scissors size={14} style={{ color: config.themeColor }} />
                        <span
                          className="font-black tracking-wider whitespace-nowrap"
                          style={{ fontSize: `${10.2 * fontScale}px`, color: config.themeColor }}
                        >
                          {lang === 'bn'
                            ? '✂ - - - - কেটে শিক্ষার্থীকে প্রদান করুন (Student Copy) - - - - ✂'
                            : '✂ - - - - Cut Here & Hand Over to Student (Student Copy) - - - - ✂'}
                        </span>
                      </div>
                    </div>

                    {/* 6. Part E: শিক্ষার্থীর সাময়িক ভর্তি রসিদ স্লিপ (Tear-off Student Admission Slip Card) */}
                    <div
                      className="border-2 rounded-2xl p-4 bg-slate-50/45 relative overflow-hidden"
                      style={{ borderColor: config.themeColor }}
                    >
                      {/* Slip Header */}
                      <div
                        className="flex items-center justify-between border-b pb-2.5 mb-3"
                        style={{ borderColor: `${config.themeColor}35` }}
                      >
                        <div className="flex items-center gap-3">
                          {config.showLogo && (logoBase64 || madrasah?.logo_url) && !logoError && (
                            <img
                              src={getProxiedUrl(logoBase64 || madrasah?.logo_url)}
                              alt="Logo"
                              className="w-11 h-11 object-contain rounded-md border p-0.5 bg-white"
                              style={{ borderColor: `${config.themeColor}40` }}
                              crossOrigin="anonymous"
                            />
                          )}
                          <div>
                            <h3
                              className="font-black uppercase leading-tight"
                              style={{ fontSize: `${14.5 * fontScale}px`, color: config.themeColor }}
                            >
                              {madrasah?.name || (lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name')}
                            </h3>
                            <p
                              className="font-bold text-slate-600 leading-tight"
                              style={{ fontSize: `${9.8 * fontScale}px` }}
                            >
                              {madrasah?.address || ''}{' '}
                              {madrasah?.phone ? `• ${lang === 'bn' ? 'ফোন:' : 'Tel:'} ${madrasah.phone}` : ''}
                            </p>
                          </div>
                        </div>

                        <div
                          className="px-4 py-1.5 rounded-full text-white font-black tracking-wide shrink-0"
                          style={{
                            backgroundColor: config.themeColor,
                            fontSize: `${10.5 * fontScale}px`,
                          }}
                        >
                          {config.sectionHeadings.slipHeading || t.slipHeading}
                        </div>
                      </div>

                      {/* Slip Body Fields */}
                      <div className="grid grid-cols-12 gap-x-4 gap-y-2">
                        <Field
                          compact
                          label={t.formNumber}
                          value={formData.formNumber || formData.admission_number}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.admissionDate}
                          value={formData.admissionDate}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.receiptNumber}
                          value={formData.receiptNumber}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.studentName}
                          value={formData.studentName}
                          className="col-span-6"
                        />
                        <Field
                          compact
                          label={t.fatherName}
                          value={formData.fatherName}
                          className="col-span-6"
                        />
                        <Field
                          compact
                          label={t.admissionClass}
                          value={formData.admissionClass}
                          className="col-span-5"
                        />
                        <Field
                          compact
                          label={t.department}
                          value={formData.department}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={lang === 'bn' ? 'রোল নং' : 'Roll No'}
                          value={formData.roll || formData.username}
                          className="col-span-3"
                        />
                        <Field
                          compact
                          label={t.guardianPhone}
                          value={formData.guardian_phone}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.admissionFee}
                          value={formData.admissionFee}
                          className="col-span-4"
                        />
                        <Field
                          compact
                          label={t.monthlyFee}
                          value={formData.monthlyFee}
                          className="col-span-4"
                        />
                      </div>

                      {/* Slip Signatures & Note */}
                      <div className="flex items-end justify-between gap-6 pt-6 mt-1">
                        <p
                          className="font-bold text-slate-600 italic flex-1"
                          style={{ fontSize: `${9.2 * fontScale}px` }}
                        >
                          {lang === 'bn'
                            ? '* এই রসিদ স্লিপটি সংরক্ষণ করুন এবং ক্লাস শুরুর দিন প্রদর্শন করুন।'
                            : '* Please preserve this receipt slip and present it on the first day of class.'}
                        </p>
                        <div className="w-40 text-center border-t-2 pt-1" style={{ borderColor: config.themeColor }}>
                          <span
                            className="font-black uppercase tracking-wider block"
                            style={{ fontSize: `${9.8 * fontScale}px`, color: config.themeColor }}
                          >
                            {config.signatureLabels.student}
                          </span>
                        </div>
                        <div className="w-44 text-center border-t-2 pt-1" style={{ borderColor: config.themeColor }}>
                          <span
                            className="font-black uppercase tracking-wider block"
                            style={{ fontSize: `${9.8 * fontScale}px`, color: config.themeColor }}
                          >
                            {config.signatureLabels.collector || t.signatureCollector}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Print Media CSS for exact 1-Page or 2-Page A4 Output */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          html, body {
            width: 210mm;
            margin: 0 !important;
            padding: 0 !important;
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
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            gap: 0 !important;
          }
          #print-page-1, #print-page-2 {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #print-page-1 {
            page-break-after: ${isTwoPage ? 'always' : 'auto'} !important;
            break-after: ${isTwoPage ? 'page' : 'auto'} !important;
          }
          #print-page-2 {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdmissionFormPreview;
