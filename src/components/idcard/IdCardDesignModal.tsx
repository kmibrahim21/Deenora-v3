import React, { useState } from 'react';
import { 
  Sliders, 
  Palette, 
  Type, 
  Image as ImageIcon, 
  Layout, 
  Eye, 
  Save, 
  RotateCcw, 
  X, 
  Check, 
  Shield, 
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';
import { IdCardDesignSettings, DEFAULT_ID_CARD_DESIGN } from '../../types/idCardDesign';
import { Language } from '../../types';

interface IdCardDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IdCardDesignSettings;
  onUpdate: (newSettings: IdCardDesignSettings) => void;
  onSaveToCloud?: (newSettings: IdCardDesignSettings) => Promise<void>;
  isSavingCloud?: boolean;
  lang: Language;
  cardType?: 'student' | 'teacher';
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

export const IdCardDesignModal: React.FC<IdCardDesignModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdate,
  onSaveToCloud,
  isSavingCloud = false,
  lang,
  cardType = 'student'
}) => {
  const [activeTab, setActiveTab] = useState<'layout' | 'header' | 'photo' | 'fields' | 'backside'>('layout');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isBn = lang === 'bn';

  if (!isOpen) return null;

  const handleChange = <K extends keyof IdCardDesignSettings>(key: K, value: IdCardDesignSettings[K]) => {
    onUpdate({
      ...settings,
      [key]: value
    });
  };

  const handleReset = () => {
    if (confirm(isBn ? 'আপনি কি সমস্ত ডিজাইন ডিফল্ট মানে রিসেট করতে চান?' : 'Do you want to reset all design settings to default?')) {
      onUpdate({ ...DEFAULT_ID_CARD_DESIGN });
    }
  };

  const handleSave = async () => {
    if (onSaveToCloud) {
      await onSaveToCloud(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1E3A8A] text-white flex items-center justify-center shadow-md">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-solaiman">
                {isBn ? 'আইডি কার্ড ডিজাইন কাস্টমাইজার' : 'ID Card Design Customizer'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-solaiman">
                {isBn ? 'প্রতিষ্ঠানের নাম, লোগো, ছবি, ফন্ট ও লেআউট নিখুঁতভাবে কাস্টমাইজ করুন' : 'Customize institution name, logo, photo size, typography and layout'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none text-xs font-bold font-solaiman">
          <button
            onClick={() => setActiveTab('layout')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'layout' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <Layout size={15} />
            <span>{isBn ? 'লেআউট ও থিম' : 'Layout & Theme'}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('header')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'header' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <Type size={15} />
            <span>{isBn ? 'প্রতিষ্ঠান ও লোগো' : 'Header & Logo'}</span>
          </button>

          <button
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'photo' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <ImageIcon size={15} />
            <span>{isBn ? 'ছবি ও ব্যাজ' : 'Photo & Badge'}</span>
          </button>

          <button
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'fields' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <Layers size={15} />
            <span>{isBn ? 'তথ্য ও ফিল্ডস' : 'Info Fields'}</span>
          </button>

          <button
            onClick={() => setActiveTab('backside')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'backside' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <FileCheck size={15} />
            <span>{isBn ? 'পিছন ভাগ ও স্বাক্ষর' : 'Back & Signature'}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 font-solaiman text-sm">
          
          {/* TAB 1: LAYOUT & THEME */}
          {activeTab === 'layout' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                  {isBn ? 'কার্ড লেআউট স্টাইল নির্বাচন করুন' : 'Select Card Layout Style'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => handleChange('layoutStyle', opt.id as any)}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${settings.layoutStyle === opt.id ? 'border-[#1E3A8A] bg-blue-50/50 dark:bg-blue-950/20 shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {isBn ? opt.nameBn : opt.nameEn}
                        </span>
                        {settings.layoutStyle === opt.id && (
                          <div className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isBn ? opt.descBn : opt.descEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                  {isBn ? 'থিম কালার প্যালেট' : 'Theme Color Palette'}
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleChange('themeColor', c.hex)}
                      className={`h-10 rounded-xl border-2 transition-all flex items-center justify-center ${settings.themeColor === c.hex ? 'border-white ring-2 ring-blue-600 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {settings.themeColor === c.hex && <Check size={14} className="text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Palette size={18} className="text-slate-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'কাস্টম কালার কোড (Hex):' : 'Custom Color Code (Hex):'}
                  </span>
                  <input
                    type="color"
                    value={settings.themeColor}
                    onChange={(e) => handleChange('themeColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings.themeColor}
                    onChange={(e) => handleChange('themeColor', e.target.value)}
                    className="w-24 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border rounded-lg uppercase"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HEADER & LOGO */}
          {activeTab === 'header' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Institution Name Font Size */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {isBn ? 'প্রতিষ্ঠানের নামের ফন্ট সাইজ' : 'Institution Name Size'}
                    </span>
                    <p className="text-xs text-slate-500">
                      {isBn ? 'কার্ডের হেডার টেক্সট ছোট-বড় করুন' : 'Adjust institution header font size'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-[#1E3A8A]">
                    {settings.instNameSize} px
                  </span>
                </div>
                <input
                  type="range"
                  min="11"
                  max="24"
                  step="0.5"
                  value={settings.instNameSize}
                  onChange={(e) => handleChange('instNameSize', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                />
              </div>

              {/* Institution Address Font Size */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {isBn ? 'প্রতিষ্ঠানের ঠিকানার ফন্ট সাইজ' : 'Institution Address Size'}
                    </span>
                    <p className="text-xs text-slate-500">
                      {isBn ? 'হেডারের নিচের ঠিকানার টেক্সট সাইজ' : 'Adjust institution address font size'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-[#1E3A8A]">
                    {settings.instAddressSize} px
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="12"
                  step="0.5"
                  value={settings.instAddressSize}
                  onChange={(e) => handleChange('instAddressSize', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                />
              </div>

              {/* Logo Settings */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {isBn ? 'লোগো প্রদর্শন ও সাইজ' : 'Logo Display & Size'}
                    </span>
                    <p className="text-xs text-slate-500">
                      {isBn ? 'হেডারের বামপাশে লোগো বড় বা ছোট করুন' : 'Control header logo presence and diameter'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showLogo}
                      onChange={(e) => handleChange('showLogo', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                  </label>
                </div>

                {settings.showLogo && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <span>{isBn ? 'লোগোর ব্যাস (ডায়ামিটার):' : 'Logo Diameter:'}</span>
                      <span className="text-[#1E3A8A] font-black">{settings.logoSize} px</span>
                    </div>
                    <input
                      type="range"
                      min="32"
                      max="64"
                      step="2"
                      value={settings.logoSize}
                      onChange={(e) => handleChange('logoSize', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PHOTO & BADGE */}
          {activeTab === 'photo' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Photo Display Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {cardType === 'student' ? (isBn ? 'শিক্ষার্থীর ছবি প্রদর্শন' : 'Student Photo Display') : (isBn ? 'শিক্ষকের ছবি প্রদর্শন' : 'Teacher Photo Display')}
                  </span>
                  <p className="text-xs text-slate-500">
                    {isBn ? 'কার্ডে ছবি ফ্রেম চালু বা বন্ধ রাখুন' : 'Toggle photo frame on ID card'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPhoto}
                    onChange={(e) => handleChange('showPhoto', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                </label>
              </div>

              {settings.showPhoto && (
                <>
                  {/* Photo Width & Height */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between text-xs font-black text-slate-900 dark:text-white">
                        <span>{isBn ? 'ছবির প্রস্থ (Width):' : 'Photo Width:'}</span>
                        <span className="text-[#1E3A8A] font-bold">{settings.photoWidth} px</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="95"
                        step="1"
                        value={settings.photoWidth}
                        onChange={(e) => handleChange('photoWidth', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                      />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between text-xs font-black text-slate-900 dark:text-white">
                        <span>{isBn ? 'ছবির উচ্চতা (Height):' : 'Photo Height:'}</span>
                        <span className="text-[#1E3A8A] font-bold">{settings.photoHeight} px</span>
                      </div>
                      <input
                        type="range"
                        min="70"
                        max="115"
                        step="1"
                        value={settings.photoHeight}
                        onChange={(e) => handleChange('photoHeight', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  {/* Photo Corner Curvature (Radius) */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {isBn ? 'ছবির কোনা গোলত্ব (Border Radius)' : 'Photo Corner Radius'}
                        </span>
                        <p className="text-xs text-slate-500">
                          {isBn ? '0 = চারকোনা বক্স, 12 = মসৃণ কার্ভ, 45 = ওভাল/রাউন্ড' : '0 = Square Box, 12 = Smooth Curve, 45 = Oval Frame'}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-[#1E3A8A]">
                        {settings.photoRadius} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="45"
                      step="1"
                      value={settings.photoRadius}
                      onChange={(e) => handleChange('photoRadius', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                    />
                  </div>
                </>
              )}

              {/* Badge Text Customization */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {isBn ? 'আইডি কার্ড ব্যাজের লেখা (Badge Title)' : 'ID Card Badge Title'}
                </label>
                <input
                  type="text"
                  placeholder={cardType === 'student' ? (isBn ? 'পরিচয় পত্র' : 'STUDENT ID CARD') : (isBn ? 'শিক্ষক পরিচয়পত্র' : 'TEACHER ID CARD')}
                  value={settings.badgeText}
                  onChange={(e) => handleChange('badgeText', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              {/* Student/Teacher Name Font Size */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {cardType === 'student' ? (isBn ? 'শিক্ষার্থীর নামের ফন্ট সাইজ' : 'Student Name Font Size') : (isBn ? 'শিক্ষকের নামের ফন্ট সাইজ' : 'Teacher Name Font Size')}
                  </span>
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-[#1E3A8A]">
                    {settings.nameSize} px
                  </span>
                </div>
                <input
                  type="range"
                  min="13"
                  max="22"
                  step="0.5"
                  value={settings.nameSize}
                  onChange={(e) => handleChange('nameSize', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                />
              </div>
            </div>
          )}

          {/* TAB 4: INFO FIELDS */}
          {activeTab === 'fields' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Field Label and Value Font Sizing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{isBn ? 'লেবেল সাইজ:' : 'Label Size:'}</span>
                    <span className="text-[#1E3A8A] font-black">{settings.fieldFontSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="8.5"
                    max="13"
                    step="0.5"
                    value={settings.fieldFontSize}
                    onChange={(e) => handleChange('fieldFontSize', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{isBn ? 'ভ্যালু সাইজ:' : 'Value Size:'}</span>
                    <span className="text-[#1E3A8A] font-black">{settings.fieldValueSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="9.5"
                    max="14"
                    step="0.5"
                    value={settings.fieldValueSize}
                    onChange={(e) => handleChange('fieldValueSize', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{isBn ? 'লেবেল স্পেস:' : 'Label Width:'}</span>
                    <span className="text-[#1E3A8A] font-black">{settings.labelWidth} px</span>
                  </div>
                  <input
                    type="range"
                    min="55"
                    max="95"
                    step="2"
                    value={settings.labelWidth}
                    onChange={(e) => handleChange('labelWidth', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                  />
                </div>
              </div>

              {/* Toggle Specific Fields */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {isBn ? 'কোন কোন তথ্য কার্ডে প্রদর্শন করবেন:' : 'Choose which fields to display:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { key: 'showClass', labelBn: 'শ্রেণি', labelEn: 'Class' },
                    { key: 'showSection', labelBn: 'বিভাগ/শাখা', labelEn: 'Section' },
                    { key: 'showId', labelBn: 'আইডি/রেজি নম্বর', labelEn: 'ID / Reg' },
                    { key: 'showDob', labelBn: 'জন্ম তারিখ', labelEn: 'Date of Birth' },
                    { key: 'showBlood', labelBn: 'রক্তের গ্রুপ', labelEn: 'Blood Group' },
                    { key: 'showFather', labelBn: 'পিতার নাম', labelEn: 'Father Name' },
                    { key: 'showMother', labelBn: 'মাতার নাম', labelEn: 'Mother Name' },
                    { key: 'showPhone', labelBn: 'মোবাইল নম্বর', labelEn: 'Phone Number' },
                    { key: 'showAddress', labelBn: 'ঠিকানা', labelEn: 'Address' },
                  ].map((f) => (
                    <label key={f.key} className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400">
                      <input
                        type="checkbox"
                        checked={(settings as any)[f.key]}
                        onChange={(e) => handleChange(f.key as any, e.target.checked)}
                        className="rounded text-[#1E3A8A] focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isBn ? f.labelBn : f.labelEn}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BACKSIDE & SIGNATURE */}
          {activeTab === 'backside' && (
            <div className="space-y-5 animate-fadeIn">
              {/* QR Code Settings */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {isBn ? 'QR কোড ভেরিফিকেশন' : 'QR Code Verification'}
                    </span>
                    <p className="text-xs text-slate-500">
                      {isBn ? 'পিছন ভাগে কিউআর কোড প্রদর্শন করুন' : 'Show biometric QR code on card back'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showQrCode}
                      onChange={(e) => handleChange('showQrCode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A8A]"></div>
                  </label>
                </div>
                {settings.showQrCode && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isBn ? 'QR কোড সাইজ:' : 'QR Code Size:'}
                    </span>
                    <input
                      type="range"
                      min="45"
                      max="90"
                      step="5"
                      value={settings.qrSize}
                      onChange={(e) => handleChange('qrSize', parseInt(e.target.value))}
                      className="w-36 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                    />
                  </div>
                )}
              </div>

              {/* Principal Signature Height */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {isBn ? 'প্রধানের স্বাক্ষরের উচ্চতা (Signature Height)' : 'Principal Signature Height'}
                    </span>
                    <p className="text-xs text-slate-500">
                      {isBn ? 'ডিজিটাল স্বাক্ষরের সাইজ নিয়ন্ত্রণ করুন' : 'Adjust signature image scale'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-[#1E3A8A]">
                    {settings.signatureHeight} px
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="45"
                  step="1"
                  value={settings.signatureHeight}
                  onChange={(e) => handleChange('signatureHeight', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                />
              </div>

              {/* Principal Title Customization */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {isBn ? 'প্রধানের পদবী নাম (Signatory Title)' : 'Signatory Title'}
                </label>
                <input
                  type="text"
                  placeholder={isBn ? 'প্রতিষ্ঠান প্রধান' : 'Principal'}
                  value={settings.principalTitle}
                  onChange={(e) => handleChange('principalTitle', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 font-solaiman">
          <button
            onClick={handleReset}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw size={15} />
            <span>{isBn ? 'ডিফল্ট রিসেট' : 'Reset to Default'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onSaveToCloud && (
              <button
                onClick={handleSave}
                disabled={isSavingCloud}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isSavingCloud ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : saveSuccess ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}
                <span>
                  {saveSuccess 
                    ? (isBn ? 'সংরক্ষিত হয়েছে!' : 'Saved to Cloud!')
                    : (isBn ? 'ডিফল্ট সেভ করুন' : 'Save as Default')}
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 text-white font-black text-xs shadow-md transition-all"
            >
              <span>{isBn ? 'প্রিভিউ দেখুন' : 'Apply & View'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default IdCardDesignModal;
