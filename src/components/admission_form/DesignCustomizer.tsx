
import React from 'react';
import { AdmissionFormConfig, AdmissionFormLang } from './types';
import { Palette, Type, Image, Shield, Layout, Settings2, Check, X, Save, RotateCcw, PenTool, CheckCircle2, Sparkles } from 'lucide-react';
import { ADMISSION_T } from './constants';

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
  onReset 
}) => {
  const t = ADMISSION_T[lang];

  const updateConfig = (key: keyof AdmissionFormConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateHeading = (key: keyof AdmissionFormConfig['sectionHeadings'], value: string) => {
    setConfig(prev => ({
      ...prev,
      sectionHeadings: { ...prev.sectionHeadings, [key]: value }
    }));
  };

  const updateSignatureLabel = (key: keyof AdmissionFormConfig['signatureLabels'], value: string) => {
    setConfig(prev => ({
      ...prev,
      signatureLabels: { ...prev.signatureLabels, [key]: value }
    }));
  };

  const toggleVisibility = (field: string) => {
    setConfig(prev => ({
      ...prev,
      fieldVisibility: {
        ...prev.fieldVisibility,
        [field]: !prev.fieldVisibility[field]
      }
    }));
  };

  const fieldLabels: Record<string, { bn: string; en: string }> = {
    studentNameEn: { bn: 'ইংরেজি নাম (English Name)', en: 'English Name' },
    dateOfBirth: { bn: 'জন্ম তারিখ (Date of Birth)', en: 'Date of Birth' },
    gender: { bn: 'লিঙ্গ (Gender)', en: 'Gender' },
    nationality: { bn: 'জাতীয়তা (Nationality)', en: 'Nationality' },
    religion: { bn: 'ধর্ম (Religion)', en: 'Religion' },
    bloodGroup: { bn: 'রক্তের গ্রুপ (Blood Group)', en: 'Blood Group' },
    admissionClass: { bn: 'ভর্তির শ্রেণি (Admission Class)', en: 'Admission Class' },
    fatherName: { bn: 'পিতার নাম (Father Name)', en: 'Father Name' },
    fatherOccupation: { bn: 'পিতার পেশা (Father Occupation)', en: 'Father Occupation' },
    motherName: { bn: 'মাতার নাম (Mother Name)', en: 'Mother Name' },
    motherOccupation: { bn: 'মাতার পেশা (Mother Occupation)', en: 'Mother Occupation' },
    guardianName: { bn: 'অভিভাবকের নাম (Guardian Name)', en: 'Guardian Name' },
    guardianRelation: { bn: 'সম্পর্ক (Relation)', en: 'Relation' },
    guardianPhone: { bn: 'অভিভাবকের ফোন (Guardian Phone)', en: 'Guardian Phone' },
    presentAddress: { bn: 'বর্তমান ঠিকানা (Present Address)', en: 'Present Address' },
    permanentAddress: { bn: 'স্থায়ী ঠিকানা (Permanent Address)', en: 'Permanent Address' },
    previousInstitution: { bn: 'পূর্ববর্তী প্রতিষ্ঠান ও শ্রেণি', en: 'Previous Institution & Class' },
  };

  return (
    <div className="space-y-6 bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm relative">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Settings2 size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm font-noto">
              {lang === 'bn' ? 'ডিজাইন কাস্টমাইজেশন' : 'Design Customization'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400">
              {lang === 'bn' ? 'পছন্দমতো ফরমের ডিজাইন সাজিয়ে নিন' : 'Customize your admission form template'}
            </p>
          </div>
        </div>
      </div>

      {/* Colors */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
            <Palette size={14} className="text-blue-600" />
            {lang === 'bn' ? 'থিম কালার' : 'Theme Color'}
          </label>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            {config.themeColor}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          {themeColors.map(theme => (
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
              className="w-9 h-9 rounded-xl cursor-pointer p-0 border border-slate-200 bg-transparent rounded-xl overflow-hidden"
              title={lang === 'bn' ? 'কাস্টম কালার বেছে নিন' : 'Choose custom color'}
            />
          </div>
        </div>
      </section>

      {/* Font Scale */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
          <Type size={14} className="text-blue-600" />
          {lang === 'bn' ? 'ফন্ট সাইজ / জুম স্কেল' : 'Font Size / Scale'}
        </label>
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <input 
            type="range" 
            min="0.8" 
            max="1.3" 
            step="0.05"
            value={config.fontScale}
            onChange={(e) => updateConfig('fontScale', parseFloat(e.target.value))}
            className="flex-1 accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <span className="text-xs font-black text-blue-600 bg-white px-2.5 py-1 rounded-xl shadow-xs border border-slate-200 w-14 text-center">
            {Math.round(config.fontScale * 100)}%
          </span>
        </div>
      </section>

      {/* Branding */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
          <Image size={14} className="text-blue-600" />
          {lang === 'bn' ? 'ব্র্যান্ডিং ও লোগো' : 'Branding & Logo'}
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => updateConfig('showLogo', !config.showLogo)}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-black tracking-wide transition-all cursor-pointer ${
              config.showLogo 
                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs' 
                : 'bg-slate-50 border-slate-200 text-slate-500'
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
                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs' 
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            {config.showWatermark ? <Check size={14} className="text-blue-600" strokeWidth={3} /> : <X size={14} />}
            {lang === 'bn' ? 'জলছাপ (Watermark)' : 'Watermark'}
          </button>
        </div>
        {config.showWatermark && (
          <div className="space-y-1 mt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">
              {lang === 'bn' ? 'জলছাপ টেক্সট' : 'Watermark Text'}
            </label>
            <input 
              type="text" 
              value={config.watermarkText || ''}
              onChange={(e) => updateConfig('watermarkText', e.target.value)}
              placeholder={lang === 'bn' ? 'জলছাপ টেক্সট' : 'Watermark Text'}
              className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50"
            />
          </div>
        )}
      </section>

      {/* Headings */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
          <Layout size={14} className="text-blue-600" />
          {lang === 'bn' ? 'বিভাগীয় শিরোনামসমূহ' : 'Section Headings'}
        </label>
        <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">১. {lang === 'bn' ? 'শিক্ষার্থীর তথ্য' : 'Student Info'}</label>
            <input 
              type="text" 
              value={config.sectionHeadings.studentInfo || ''}
              onChange={(e) => updateHeading('studentInfo', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">২. {lang === 'bn' ? 'পিতামাতা/অভিভাবকের তথ্য' : 'Parent Info'}</label>
            <input 
              type="text" 
              value={config.sectionHeadings.parentInfo || ''}
              onChange={(e) => updateHeading('parentInfo', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">৩. {lang === 'bn' ? 'ঠিকানা' : 'Address Info'}</label>
            <input 
              type="text" 
              value={config.sectionHeadings.addressInfo || ''}
              onChange={(e) => updateHeading('addressInfo', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">৪. {lang === 'bn' ? 'পূর্ববর্তী প্রতিষ্ঠান' : 'Previous Institution'}</label>
            <input 
              type="text" 
              value={config.sectionHeadings.prevInstInfo || ''}
              onChange={(e) => updateHeading('prevInstInfo', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">৫. {lang === 'bn' ? 'অঙ্গীকারনামা শিরোনাম' : 'Declaration'}</label>
            <input 
              type="text" 
              value={config.sectionHeadings.declaration || ''}
              onChange={(e) => updateHeading('declaration', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">৬. {lang === 'bn' ? 'অফিস ব্যবহারের বক্স' : 'Office Use'}</label>
            <input 
              type="text" 
              value={config.sectionHeadings.officeUse || ''}
              onChange={(e) => updateHeading('officeUse', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Signature Labels */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
          <PenTool size={14} className="text-blue-600" />
          {lang === 'bn' ? 'স্বাক্ষর ও পদবী' : 'Signature Labels'}
        </label>
        <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">{lang === 'bn' ? 'শিক্ষার্থীর স্বাক্ষর' : 'Student Signature'}</label>
            <input 
              type="text" 
              value={config.signatureLabels.student || ''}
              onChange={(e) => updateSignatureLabel('student', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">{lang === 'bn' ? 'অভিভাবকের স্বাক্ষর' : 'Parent Signature'}</label>
            <input 
              type="text" 
              value={config.signatureLabels.parent || ''}
              onChange={(e) => updateSignatureLabel('parent', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 ml-1">{lang === 'bn' ? 'প্রধানের স্বাক্ষর ও সীল' : 'Principal Signature & Seal'}</label>
            <input 
              type="text" 
              value={config.signatureLabels.principal || ''}
              onChange={(e) => updateSignatureLabel('principal', e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Field Visibility */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
            <Shield size={14} className="text-blue-600" />
            {lang === 'bn' ? 'তথ্য ফিল্ড প্রদর্শন / লুকান' : 'Field Visibility'}
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {Object.entries(fieldLabels).map(([field, labels]) => {
            const isVisible = config.fieldVisibility[field] !== false;
            return (
              <label 
                key={field} 
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isVisible ? 'bg-slate-50 border-slate-200 hover:bg-blue-50/50' : 'bg-slate-100/60 border-slate-200 opacity-60'
                }`}
              >
                <span className="text-[11px] font-bold text-slate-700">
                  {lang === 'bn' ? labels.bn : labels.en}
                </span>
                <input 
                  type="checkbox" 
                  checked={isVisible}
                  onChange={() => toggleVisibility(field)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* Bottom Sticky Action Buttons */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
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
              className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title={lang === 'bn' ? 'ডিফল্ট ডিজাইনে ফিরুন' : 'Reset to default design'}
            >
              <RotateCcw size={15} />
              <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
          <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-blue-900 leading-tight">
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
