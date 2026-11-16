import React from 'react';
import { AdmissionFormConfig, AdmissionFormLang } from './types';
import {
  Palette,
  Type,
  Image,
  Shield,
  Layout,
  Settings2,
  Check,
  X,
  Save,
  RotateCcw,
  PenTool,
  CheckCircle2,
  Sparkles,
  FileText,
  Layers,
  BookOpen,
} from 'lucide-react';

interface Props {
  config: AdmissionFormConfig;
  setConfig: React.Dispatch<React.SetStateAction<AdmissionFormConfig>>;
  lang: AdmissionFormLang;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  onReset?: () => void;
}

const themeColors = [
  { name: 'Navy Blue', color: '#1e3a8a' },
  { name: 'Royal Blue', color: '#2563eb' },
  { name: 'Emerald Green', color: '#064e3b' },
  { name: 'Forest Green', color: '#15803d' },
  { name: 'Slate Gray', color: '#334155' },
  { name: 'Rose Red', color: '#881337' },
  { name: 'Royal Violet', color: '#4c1d95' },
  { name: 'Teal Blue', color: '#0f766e' },
];

const DesignCustomizer: React.FC<Props> = ({
  config,
  setConfig,
  lang,
  onSave,
  isSaving = false,
  isSaved = false,
  onReset,
}) => {
  const updateConfig = (key: keyof AdmissionFormConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updateHeading = (key: keyof AdmissionFormConfig['sectionHeadings'], value: string) => {
    setConfig((prev) => ({
      ...prev,
      sectionHeadings: { ...prev.sectionHeadings, [key]: value },
    }));
  };

  const updateSignatureLabel = (key: keyof AdmissionFormConfig['signatureLabels'], value: string) => {
    setConfig((prev) => ({
      ...prev,
      signatureLabels: { ...prev.signatureLabels, [key]: value },
    }));
  };

  const toggleVisibility = (field: string) => {
    setConfig((prev) => ({
      ...prev,
      fieldVisibility: {
        ...prev.fieldVisibility,
        [field]: prev.fieldVisibility[field] === false ? true : false,
      },
    }));
  };

  const fieldLabels: Record<string, { bn: string; en: string }> = {
    studentNameEn: { bn: 'ইংরেজি নাম (English Name)', en: 'Student Name (English)' },
    username: { bn: 'ইউজারনেম / আইডি (Username/ID)', en: 'Username / Student ID' },
    biometricId: { bn: 'বায়োমেট্রিক হাজিরা আইডি (Biometric ID)', en: 'Biometric Attendance ID' },
    birthRegNo: { bn: '১৭-ডিজিট জন্ম নিবন্ধন নম্বর', en: '17-Digit Birth Reg. No' },
    dateOfBirth: { bn: 'জন্ম তারিখ (Date of Birth)', en: 'Date of Birth' },
    gender: { bn: 'লিঙ্গ (Gender)', en: 'Gender' },
    bloodGroup: { bn: 'রক্তের গ্রুপ (Blood Group)', en: 'Blood Group' },
    religion: { bn: 'ধর্ম (Religion)', en: 'Religion' },
    nationality: { bn: 'জাতীয়তা (Nationality)', en: 'Nationality' },
    admissionClass: { bn: 'ভর্তির শ্রেণি (Admission Class)', en: 'Admission Class' },
    department: { bn: 'শাখা / বিভাগ (Department/Section)', en: 'Department / Section' },
    residentialStatus: { bn: 'শিক্ষার্থীর ধরন (আবাসিক/অনাবাসিক)', en: 'Residential Status' },
    fatherName: { bn: 'পিতার নাম (Father Name)', en: 'Father Name' },
    fatherOccupation: { bn: 'পিতার পেশা (Father Occupation)', en: 'Father Occupation' },
    fatherNid: { bn: 'পিতার এনআইডি (Father NID)', en: 'Father NID Number' },
    motherName: { bn: 'মাতার নাম (Mother Name)', en: 'Mother Name' },
    motherOccupation: { bn: 'মাতার পেশা (Mother Occupation)', en: 'Mother Occupation' },
    motherNid: { bn: 'মাতার এনআইডি (Mother NID)', en: 'Mother NID Number' },
    guardianName: { bn: 'অভিভাবকের নাম (Guardian Name)', en: 'Guardian Name' },
    guardianRelation: { bn: 'সম্পর্ক (Relation)', en: 'Guardian Relation' },
    guardianPhone: { bn: 'মোবাইল নম্বর (Mobile No)', en: 'Mobile Number' },
    whatsappNumber: { bn: 'হোয়াটসঅ্যাপ নম্বর (WhatsApp No)', en: 'WhatsApp Number' },
    emergencyPhone: { bn: 'জরুরি যোগাযোগ নম্বর (Emergency Phone)', en: 'Emergency Contact No' },
    presentAddress: { bn: 'বর্তমান ঠিকানা (Present Address)', en: 'Present Address' },
    permanentAddress: { bn: 'স্থায়ী ঠিকানা (Permanent Address)', en: 'Permanent Address' },
    previousInstitution: { bn: 'পূর্ববর্তী প্রতিষ্ঠান ও শ্রেণি', en: 'Previous Institution & Class' },
    tcNumber: { bn: 'ছাড়পত্র / টিসি নম্বর (TC No)', en: 'TC Number' },
    financialInfo: { bn: 'ভর্তি ফি, মাসিক বেতন ও রসিদ নম্বর', en: 'Admission Fee, Monthly Fee & Receipt' },
    documentsChecklist: { bn: 'প্রয়োজনীয় নথিপত্র চেকলিস্ট', en: 'Document Verification Checklist' },
    officeUseBox: { bn: 'অফিস অনুমোদন বক্স (Office Use Box)', en: 'Office Use Box' },
  };

  return (
    <div className="space-y-6 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Settings2 size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm font-noto">
              {lang === 'bn' ? 'ডিজাইন ও লেআউট কাস্টমাইজার' : 'Design & Layout Customizer'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {lang === 'bn' ? '১-পৃষ্ঠা বা ২-পৃষ্ঠা লেআউট ও থিম সাজিয়ে নিন' : 'Customize layout mode, colors & fields'}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Layout Mode Switcher */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <Layers size={14} className="text-blue-600" />
          {lang === 'bn' ? 'ফরমের লেআউট মোড (A4 Layout)' : 'Form Layout Mode (A4)'}
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => updateConfig('layoutMode', '1-page')}
            className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
              config.layoutMode === '1-page'
                ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-600 text-blue-900 dark:text-blue-200 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-black font-noto">
                {lang === 'bn' ? '১-পৃষ্ঠা (কমপ্যাক্ট)' : '1-Page (Compact)'}
              </span>
              {config.layoutMode === '1-page' && <CheckCircle2 size={15} className="text-blue-600 shrink-0" />}
            </div>
            <span className="text-[10px] font-medium opacity-80 leading-tight">
              {lang === 'bn' ? 'সব তথ্য এক পৃষ্ঠায় স্মার্ট গ্রিডে আঁটবে' : 'All fields fit on a single A4 page'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => updateConfig('layoutMode', '2-page')}
            className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
              config.layoutMode === '2-page'
                ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-600 text-blue-900 dark:text-blue-200 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-black font-noto">
                {lang === 'bn' ? '২-পৃষ্ঠা (উভয় পিঠ)' : '2-Page (Double-Sided)'}
              </span>
              {config.layoutMode === '2-page' && <CheckCircle2 size={15} className="text-blue-600 shrink-0" />}
            </div>
            <span className="text-[10px] font-medium opacity-80 leading-tight">
              {lang === 'bn' ? 'সামনে বায়ো-ডাটা, পেছনে নিয়মাবলি ও রসিদ স্লিপ' : 'Bio-data front + Rules & Receipt slip back'}
            </span>
          </button>
        </div>
      </section>

      {/* 2. Colors */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <Palette size={14} className="text-blue-600" />
            {lang === 'bn' ? 'থিম কালার' : 'Theme Color'}
          </label>
          <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            {config.themeColor}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          {themeColors.map((theme) => (
            <button
              key={theme.name}
              title={theme.name}
              onClick={() => updateConfig('themeColor', theme.color)}
              className={`w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center cursor-pointer ${
                config.themeColor.toLowerCase() === theme.color.toLowerCase()
                  ? 'scale-110 shadow-md ring-2 ring-blue-400 border-white'
                  : 'border-transparent hover:scale-105 opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: theme.color }}
            >
              {config.themeColor.toLowerCase() === theme.color.toLowerCase() && (
                <Check size={16} className="text-white drop-shadow" strokeWidth={3} />
              )}
            </button>
          ))}
          <div className="relative flex items-center">
            <input
              type="color"
              value={config.themeColor}
              onChange={(e) => updateConfig('themeColor', e.target.value)}
              className="w-9 h-9 rounded-xl cursor-pointer p-0 border border-slate-200 bg-transparent overflow-hidden"
              title={lang === 'bn' ? 'কাস্টম কালার বেছে নিন' : 'Choose custom color'}
            />
          </div>
        </div>
      </section>

      {/* 3. Font Scale */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <Type size={14} className="text-blue-600" />
          {lang === 'bn' ? 'ফন্ট সাইজ স্কেল (0.8x - 1.3x)' : 'Font Scale (0.8x - 1.3x)'}
        </label>
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
          <input
            type="range"
            min="0.8"
            max="1.3"
            step="0.05"
            value={config.fontScale}
            onChange={(e) => updateConfig('fontScale', parseFloat(e.target.value))}
            className="flex-1 accent-blue-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
          <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 w-16 text-center">
            {config.fontScale.toFixed(2)}x
          </span>
        </div>
      </section>

      {/* 4. Branding */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <Image size={14} className="text-blue-600" />
          {lang === 'bn' ? 'ব্র্যান্ডিং ও লোগো' : 'Branding & Logo'}
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => updateConfig('showLogo', !config.showLogo)}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-black tracking-wide transition-all cursor-pointer ${
              config.showLogo
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500'
            }`}
          >
            {config.showLogo ? <Check size={14} className="text-blue-600" strokeWidth={3} /> : <X size={14} />}
            {lang === 'bn' ? 'লোগো প্রদর্শন' : 'Show Logo'}
          </button>
          <button
            type="button"
            onClick={() => updateConfig('showWatermark', !config.showWatermark)}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-black tracking-wide transition-all cursor-pointer ${
              config.showWatermark
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500'
            }`}
          >
            {config.showWatermark ? <Check size={14} className="text-blue-600" strokeWidth={3} /> : <X size={14} />}
            {lang === 'bn' ? 'জলছাপ (Watermark)' : 'Watermark'}
          </button>
        </div>
        {config.showWatermark && (
          <div className="space-y-1 mt-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
              {lang === 'bn' ? 'জলছাপ টেক্সট' : 'Watermark Text'}
            </label>
            <input
              type="text"
              value={config.watermarkText || ''}
              onChange={(e) => updateConfig('watermarkText', e.target.value)}
              placeholder={lang === 'bn' ? 'জলছাপ টেক্সট' : 'Watermark Text'}
              className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        )}
      </section>

      {/* 5. Field Visibility */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <Shield size={14} className="text-blue-600" />
            {lang === 'bn' ? 'তথ্য ফিল্ড প্রদর্শন / লুকান' : 'Field Visibility Toggles'}
          </label>
        </div>
        <div className="grid grid-cols-1 gap-1.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
          {Object.entries(fieldLabels).map(([field, labels]) => {
            const isVisible = config.fieldVisibility[field] !== false;
            return (
              <label
                key={field}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isVisible
                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                    : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-noto">
                  {lang === 'bn' ? labels.bn : labels.en}
                </span>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleVisibility(field)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* 6. Rules & Undertaking Editable Textareas */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <BookOpen size={14} className="text-blue-600" />
          {lang === 'bn' ? 'নিয়মাবলি ও অঙ্গীকারনামা সম্পাদনা' : 'Rules & Undertaking Text'}
        </label>
        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
              {lang === 'bn' ? 'প্রতিষ্ঠানের সাধারণ নিয়মাবলি (প্রতি লাইনে ১টি নিয়ম - ২য় পৃষ্ঠা)' : 'General Rules (One rule per line - Page 2)'}
            </label>
            <textarea
              rows={5}
              value={config.rulesText || ''}
              onChange={(e) => updateConfig('rulesText', e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-noto leading-relaxed"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
              {lang === 'bn' ? 'শিক্ষার্থী ও অভিভাবকের যৌথ অঙ্গীকারনামা' : 'Student & Guardian Undertaking'}
            </label>
            <textarea
              rows={4}
              value={config.declarationText || ''}
              onChange={(e) => updateConfig('declarationText', e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-noto leading-relaxed"
            />
          </div>
        </div>
      </section>

      {/* 7. Section Headings */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <Layout size={14} className="text-blue-600" />
          {lang === 'bn' ? 'বিভাগীয় শিরোনামসমূহ' : 'Section Headings'}
        </label>
        <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[240px] overflow-y-auto custom-scrollbar">
          {[
            { key: 'studentInfo' as const, labelBn: '১. শিক্ষার্থীর তথ্য', labelEn: '1. Student Info' },
            { key: 'parentInfo' as const, labelBn: '২. পিতামাতা ও অভিভাবকের তথ্য', labelEn: '2. Parent Info' },
            { key: 'addressInfo' as const, labelBn: '৩. ঠিকানা ও পূর্ববর্তী প্রতিষ্ঠান', labelEn: '3. Address & History' },
            { key: 'financialInfo' as const, labelBn: '৪. ভর্তি ফি ও হিসাব', labelEn: '4. Fees & Financials' },
            { key: 'documentsInfo' as const, labelBn: '৫. প্রয়োজনীয় নথিপত্র চেকলিস্ট', labelEn: '5. Documents Checklist' },
            { key: 'rulesHeading' as const, labelBn: '৬. সাধারণ নিয়মাবলি শিরোনাম', labelEn: '6. Rules Heading' },
            { key: 'declaration' as const, labelBn: '৭. অঙ্গীকারনামা শিরোনাম', labelEn: '7. Undertaking Heading' },
            { key: 'officeUse' as const, labelBn: '৮. অফিস অনুমোদন বক্স', labelEn: '8. Office Approval Box' },
            { key: 'slipHeading' as const, labelBn: '৯. ভর্তি রসিদ স্লিপ শিরোনাম', labelEn: '9. Admission Slip Heading' },
          ].map((item) => (
            <div key={item.key} className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
                {lang === 'bn' ? item.labelBn : item.labelEn}
              </label>
              <input
                type="text"
                value={config.sectionHeadings[item.key] || ''}
                onChange={(e) => updateHeading(item.key, e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* 8. Signature Labels */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <PenTool size={14} className="text-blue-600" />
          {lang === 'bn' ? 'স্বাক্ষর ও পদবী' : 'Signature Labels'}
        </label>
        <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
              {lang === 'bn' ? 'শিক্ষার্থীর স্বাক্ষর' : 'Student Signature'}
            </label>
            <input
              type="text"
              value={config.signatureLabels.student || ''}
              onChange={(e) => updateSignatureLabel('student', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
              {lang === 'bn' ? 'অভিভাবকের স্বাক্ষর' : 'Guardian Signature'}
            </label>
            <input
              type="text"
              value={config.signatureLabels.parent || ''}
              onChange={(e) => updateSignatureLabel('parent', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
              {lang === 'bn' ? 'প্রধানের স্বাক্ষর ও সীল' : 'Principal Signature & Seal'}
            </label>
            <input
              type="text"
              value={config.signatureLabels.principal || ''}
              onChange={(e) => updateSignatureLabel('principal', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
              {lang === 'bn' ? 'রসিদ স্লিপ আদায়কারীর স্বাক্ষর' : 'Receipt Slip Collector Signature'}
            </label>
            <input
              type="text"
              value={config.signatureLabels.collector || ''}
              onChange={(e) => updateSignatureLabel('collector', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Bottom Sticky Action Buttons */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex gap-2">
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...'}</span>
                </>
              ) : isSaved ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>{lang === 'bn' ? 'ডিজাইন সেভ হয়েছে!' : 'Design Saved!'}</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{lang === 'bn' ? 'ডিজাইন সেভ করুন' : 'Save Design'}</span>
                </>
              )}
            </button>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              title={lang === 'bn' ? 'ডিফল্ট ডিজাইনে ফিরুন' : 'Reset to default design'}
            >
              <RotateCcw size={15} />
              <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
          <Sparkles size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-blue-900 dark:text-blue-200 leading-tight">
            {lang === 'bn'
              ? 'ডিজাইন পরিবর্তন করে সেভ করলে যেকোনো শিক্ষার্থীর ভর্তি ফরম বা ব্ল্যাঙ্ক ফরম ডাউনলোড করার সময় এই সংরক্ষিত ডিজাইন স্বয়ংক্রিয়ভাবে কার্যকর হবে।'
              : 'Saving the design will permanently apply this layout and styling to all student admission form downloads and blank forms.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DesignCustomizer;
