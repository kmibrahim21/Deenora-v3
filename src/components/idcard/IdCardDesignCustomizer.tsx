import React, { useState } from 'react';
import { 
  Palette, 
  Type, 
  Image as ImageIcon, 
  Layout, 
  Settings2, 
  Save, 
  RotateCcw, 
  Check, 
  Shield, 
  Sparkles,
  QrCode,
  Layers,
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { IdCardDesignSettings, DEFAULT_ID_CARD_DESIGN } from '../../types/idCardDesign';
import { Language } from '../../types';

interface IdCardDesignCustomizerProps {
  settings: IdCardDesignSettings;
  onUpdate: (newSettings: IdCardDesignSettings) => void;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  onReset?: () => void;
  lang: Language;
  cardType?: 'student' | 'teacher';
  isDark?: boolean;
}

const PRESET_COLORS = [
  { name: 'Navy Blue', hex: '#1E3A8A' },
  { name: 'Royal Emerald', hex: '#065F46' },
  { name: 'Deep Maroon', hex: '#881337' },
  { name: 'Crimson Red', hex: '#B91C1C' },
  { name: 'Royal Indigo', hex: '#4338CA' },
  { name: 'Dark Teal', hex: '#0F766E' },
  { name: 'Imperial Violet', hex: '#581C87' },
  { name: 'Dark Slate', hex: '#334155' },
  { name: 'Charcoal Black', hex: '#18181B' },
  { name: 'Golden Amber', hex: '#B45309' },
];

const LAYOUT_OPTIONS = [
  {
    id: 'modern_wave',
    nameBn: 'মডার্ন ওয়েভ (ডিফল্ট)',
    nameEn: 'Modern Wave (Default)',
    descBn: 'উপরে কার্ভ ও নিচে ওয়েভ প্যাটার্ন',
    descEn: 'Curved top with bottom wave vector'
  },
  {
    id: 'minimal_clean',
    nameBn: 'ফরমাল মিনিমালিস্ট',
    nameEn: 'Formal Minimalist',
    descBn: 'মার্জিত সলিড হেডার ও সূক্ষ্ম বর্ডার',
    descEn: 'Clean solid header with subtle borders'
  },
  {
    id: 'royal_arch',
    nameBn: 'রয়্যাল আর্চ (ইসলামিক)',
    nameEn: 'Royal Arch (Islamic)',
    descBn: 'খিলানযুক্ত ঐতিহ্যবাহী ডাবল আর্চ',
    descEn: 'Traditional arched frame pattern'
  },
  {
    id: 'bold_banner',
    nameBn: 'বোল্ড কর্পোরেট ব্যানার',
    nameEn: 'Bold Corporate Banner',
    descBn: 'গাঢ় ব্যানারের সাথে হাইলাইট প্যানেল',
    descEn: 'Deep header banner with high contrast'
  }
];

export const IdCardDesignCustomizer: React.FC<IdCardDesignCustomizerProps> = ({
  settings,
  onUpdate,
  onSave,
  isSaving = false,
  isSaved = false,
  onReset,
  lang,
  cardType = 'student',
  isDark = false
}) => {
  const [subTab, setSubTab] = useState<'layout' | 'header' | 'photo' | 'fields' | 'backside'>('layout');
  const isBn = lang === 'bn';

  const handleChange = <K extends keyof IdCardDesignSettings>(key: K, value: IdCardDesignSettings[K]) => {
    onUpdate({
      ...settings,
      [key]: value
    });
  };

  const handleReset = () => {
    if (confirm(isBn ? 'আপনি কি সমস্ত ডিজাইন ডিফল্ট মানে রিসেট করতে চান?' : 'Do you want to reset all design settings to default?')) {
      if (onReset) {
        onReset();
      } else {
        onUpdate(DEFAULT_ID_CARD_DESIGN);
      }
    }
  };

  return (
    <div className={`space-y-5 p-4 sm:p-6 rounded-[2rem] border shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
      {/* Header Info */}
      <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Settings2 size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider font-noto">
              {isBn ? 'আইডি কার্ড ডিজাইন কাস্টমাইজ' : 'ID Card Design Customization'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {cardType === 'teacher' 
                ? (isBn ? 'শিক্ষক পরিচয় পত্রের লেআউট ও সাইজ পরিবর্তন' : 'Customize teacher card layout & sizes')
                : (isBn ? 'শিক্ষার্থী পরিচয় পত্রের লেআউট ও সাইজ পরিবর্তন' : 'Customize student card layout & sizes')
              }
            </p>
          </div>
        </div>

        {onReset && (
          <button
            onClick={handleReset}
            className={`p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
            title={isBn ? 'ডিফল্ট রিসেট' : 'Reset to Default'}
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {/* Sub Category Switcher */}
      <div className={`flex p-1 rounded-2xl overflow-x-auto scrollbar-none gap-1 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
        <button
          type="button"
          onClick={() => setSubTab('layout')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            subTab === 'layout'
              ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layout size={14} />
          <span>{isBn ? 'লেআউট ও রং' : 'Layout & Color'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('header')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            subTab === 'header'
              ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Type size={14} />
          <span>{isBn ? 'প্রতিষ্ঠান ও লোগো' : 'Header & Logo'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('photo')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            subTab === 'photo'
              ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ImageIcon size={14} />
          <span>{isBn ? 'ছবি সাইজ' : 'Photo'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('fields')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            subTab === 'fields'
              ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers size={14} />
          <span>{isBn ? 'তথ্য ফিল্ড' : 'Fields'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('backside')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            subTab === 'backside'
              ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm')
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <QrCode size={14} />
          <span>{isBn ? 'পিছনের অংশ' : 'Backside'}</span>
        </button>
      </div>

      {/* SubTab Content */}
      <div className="space-y-4">
        {/* TAB 1: LAYOUT & THEME */}
        {subTab === 'layout' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Theme Colors */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette size={13} className="text-blue-500" />
                {isBn ? 'থিম কালার নির্বাচন' : 'Theme Color'}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => handleChange('themeColor', c.hex)}
                    className={`h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                      settings.themeColor?.toLowerCase() === c.hex.toLowerCase()
                        ? 'ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-md'
                        : 'hover:scale-100 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {settings.themeColor?.toLowerCase() === c.hex.toLowerCase() && (
                      <Check size={16} className="text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Picker */}
              <div className={`flex items-center justify-between p-3 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isBn ? 'কাস্টম হেক্স কোড:' : 'Custom Hex:'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.themeColor || '#1E3A8A'}
                    onChange={(e) => handleChange('themeColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings.themeColor || '#1E3A8A'}
                    onChange={(e) => handleChange('themeColor', e.target.value)}
                    className={`w-24 text-xs font-mono font-bold px-2 py-1 rounded-lg border text-center ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                  />
                </div>
              </div>
            </div>

            {/* Layout Options */}
            <div className="space-y-2.5 pt-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layout size={13} className="text-blue-500" />
                {isBn ? 'কার্ড ডিজাইন স্টাইল' : 'Card Layout Style'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChange('layoutStyle', opt.id as any)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      settings.layoutStyle === opt.id
                        ? (isDark ? 'border-blue-500 bg-blue-950/40 text-blue-200 ring-2 ring-blue-500/20 shadow-sm' : 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-600/10 shadow-sm')
                        : (isDark ? 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700' : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300')
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black">{isBn ? opt.nameBn : opt.nameEn}</span>
                      {settings.layoutStyle === opt.id && <Check size={14} className="text-blue-500" />}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{isBn ? opt.descBn : opt.descEn}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HEADER & LOGO */}
        {subTab === 'header' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Institution Name Font Size */}
            <div className={`p-4 rounded-2xl border space-y-2.5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  {isBn ? 'প্রতিষ্ঠানের নামের ফন্ট সাইজ' : 'Institution Name Font Size'}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.instNameSize || 16}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="24"
                step="1"
                value={settings.instNameSize || 16}
                onChange={(e) => handleChange('instNameSize', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Address Font Size */}
            <div className={`p-4 rounded-2xl border space-y-2.5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  {isBn ? 'ঠিকানা ও সাবটাইটেল সাইজ' : 'Address / Subtitle Font Size'}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.instAddressSize || 8}px</span>
              </div>
              <input
                type="range"
                min="6"
                max="12"
                step="0.5"
                value={settings.instAddressSize || 8}
                onChange={(e) => handleChange('instAddressSize', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Logo Settings */}
            <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black">{isBn ? 'লোগো প্রদর্শন' : 'Show Logo'}</h4>
                  <p className="text-[10px] text-slate-400">{isBn ? 'হেডারে প্রতিষ্ঠানের লোগো দেখান' : 'Display institution logo in header'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('showLogo', !settings.showLogo)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.showLogo !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showLogo !== false ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {settings.showLogo !== false && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-300">{isBn ? 'লোগো সাইজ' : 'Logo Size'}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.logoSize || 48}px</span>
                  </div>
                  <input
                    type="range"
                    min="32"
                    max="64"
                    step="2"
                    value={settings.logoSize || 48}
                    onChange={(e) => handleChange('logoSize', Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PHOTO SETTINGS */}
        {subTab === 'photo' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Show Photo Toggle */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <h4 className="text-xs font-black">{isBn ? 'শিক্ষার্থী/শিক্ষক ছবি' : 'Profile Photo'}</h4>
                <p className="text-[10px] text-slate-400">{isBn ? 'আইডি কার্ডে ছবি প্রদর্শন চালু/বন্ধ' : 'Toggle profile photo visibility'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('showPhoto', !settings.showPhoto)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.showPhoto !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showPhoto !== false ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {settings.showPhoto !== false && (
              <>
                {/* Photo Width & Height */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-200">{isBn ? 'ছবির প্রস্থ (Width)' : 'Photo Width'}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.photoWidth || 75}px</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="110"
                      step="2"
                      value={settings.photoWidth || 75}
                      onChange={(e) => handleChange('photoWidth', Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-200">{isBn ? 'ছবির উচ্চতা (Height)' : 'Photo Height'}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.photoHeight || 85}px</span>
                    </div>
                    <input
                      type="range"
                      min="55"
                      max="125"
                      step="2"
                      value={settings.photoHeight || 85}
                      onChange={(e) => handleChange('photoHeight', Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Photo Corner Radius / Shape */}
                <div className={`p-4 rounded-2xl border space-y-2.5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-200">{isBn ? 'ছবির কোনা বাঁকানো (Radius)' : 'Photo Corner Radius'}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-black">
                      {(settings.photoRadius || 12) >= 40 ? (isBn ? 'সম্পূর্ণ গোল' : 'Circle/Oval') : `${settings.photoRadius || 12}px`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={settings.photoRadius !== undefined ? settings.photoRadius : 12}
                    onChange={(e) => handleChange('photoRadius', Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 pt-1 font-bold">
                    <span>{isBn ? 'চারকোনা (0px)' : 'Square'}</span>
                    <span>{isBn ? 'রাউন্ডেড (12px)' : 'Rounded'}</span>
                    <span>{isBn ? 'বৃত্তাকার (50px)' : 'Circle'}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: FIELDS & LABELS */}
        {subTab === 'fields' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Font Sizes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">{isBn ? 'নামের সাইজ' : 'Name Size'}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.nameSize || 16}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="22"
                  step="1"
                  value={settings.nameSize || 16}
                  onChange={(e) => handleChange('nameSize', Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">{isBn ? 'তথ্য লেখার সাইজ' : 'Field Text Size'}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{settings.fieldFontSize || 10}px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="13"
                  step="0.5"
                  value={settings.fieldFontSize || 10}
                  onChange={(e) => handleChange('fieldFontSize', Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Field Visibility Toggles */}
            <div className={`p-4 rounded-2xl border space-y-2.5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                {isBn ? 'যেসব তথ্য দেখাবেন (অন/অফ)' : 'Visible Field Toggles'}
              </h4>
              
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                {[
                  { key: 'showClass', labelBn: cardType === 'teacher' ? 'পদবী' : 'শ্রেণী', labelEn: cardType === 'teacher' ? 'Designation' : 'Class' },
                  { key: 'showId', labelBn: 'রোল / আইডি', labelEn: 'Roll / ID' },
                  { key: 'showDob', labelBn: 'জন্ম তারিখ', labelEn: 'Date of Birth' },
                  { key: 'showBlood', labelBn: 'রক্তের গ্রুপ', labelEn: 'Blood Group' },
                  { key: 'showFather', labelBn: 'পিতার নাম', labelEn: 'Father Name' },
                  { key: 'showMother', labelBn: 'মাতার নাম', labelEn: 'Mother Name' },
                  { key: 'showPhone', labelBn: 'মোবাইল নম্বর', labelEn: 'Phone Number' },
                  { key: 'showAddress', labelBn: 'ঠিকানা', labelEn: 'Address' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleChange(f.key as any, !settings[f.key as keyof IdCardDesignSettings])}
                    className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      settings[f.key as keyof IdCardDesignSettings] !== false
                        ? (isDark ? 'bg-blue-950/40 border-blue-600/50 text-blue-200' : 'bg-blue-50/80 border-blue-300 text-blue-900')
                        : (isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400')
                    }`}
                  >
                    <span>{isBn ? f.labelBn : f.labelEn}</span>
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center ${settings[f.key as keyof IdCardDesignSettings] !== false ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-700'}`}>
                      {settings[f.key as keyof IdCardDesignSettings] !== false && <Check size={12} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BACKSIDE & QR */}
        {subTab === 'backside' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* QR Code */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <h4 className="text-xs font-black">{isBn ? 'কিউআর কোড (QR Code)' : 'QR Code'}</h4>
                <p className="text-[10px] text-slate-400">{isBn ? 'কার্ডের পিছনে ভেরিফিকেশন কিউআর কোড' : 'Verification QR code on back'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('showQrCode', !settings.showQrCode)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.showQrCode !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showQrCode !== false ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* Principal Signature */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <h4 className="text-xs font-black">{isBn ? 'প্রধানের স্বাক্ষর ও সিল' : 'Principal Signature & Seal'}</h4>
                <p className="text-[10px] text-slate-400">{isBn ? 'অনুমোদিত স্বাক্ষর স্থান' : 'Authorized signature space'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('showPrincipalSign', !settings.showPrincipalSign)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.showPrincipalSign !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${settings.showPrincipalSign !== false ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Action Bar */}
      {onSave && (
        <div className={`pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-60 ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-[0.99]'
            }`}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 size={18} className="text-white" />
            ) : (
              <Save size={18} />
            )}
            <span>
              {isSaving
                ? (isBn ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving...')
                : isSaved
                ? (isBn ? 'ডিজাইন সফলভাবে সংরক্ষিত!' : 'Design Saved Successfully!')
                : (isBn ? 'ডিজাইন সংরক্ষণ করুন' : 'Save Design Configuration')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default IdCardDesignCustomizer;
