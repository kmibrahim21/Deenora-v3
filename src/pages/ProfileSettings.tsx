import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Edit3, 
  Loader2, 
  Key, 
  Image as ImageIcon, 
  Upload, 
  MessageSquare, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Fingerprint, 
  Zap, 
  Settings2,
  Check,
  Smartphone,
  Trash2,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Institution, Language } from '../types';
import { requestManager } from '../services/RequestManager';

interface Props {
  madrasah: Institution | null;
  lang: Language;
  onBack: () => void;
  onProfileUpdate?: () => void;
  setStatusModal: (s: any) => void;
}

const ProfileSettings: React.FC<Props> = ({ madrasah, lang, onBack, onProfileUpdate, setStatusModal }) => {
  const [newName, setNewName] = useState(madrasah?.name || '');
  const [newAddress, setNewAddress] = useState(madrasah?.address || '');
  const [newPhone, setNewPhone] = useState(madrasah?.phone || '');
  const [newContactEmail, setNewContactEmail] = useState(madrasah?.contact_email || '');
  const [logoUrl, setLogoUrl] = useState(madrasah?.logo_url || '');
  const [arabicCalligraphyUrl, setArabicCalligraphyUrl] = useState(madrasah?.config_json?.arabic_calligraphy_url || '');
  const [arabicCalligraphyWidth, setArabicCalligraphyWidth] = useState((madrasah?.config_json as any)?.arabic_calligraphy_width || 100);
  const [voiceSenderId, setVoiceSenderId] = useState(madrasah?.voice_sender_id || '');
  const [newPin, setNewPin] = useState(madrasah?.config_json?.user_pin || '');
  const [saving, setSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(madrasah?.config_json?.signature_url || '');
  const [signatureHeight, setSignatureHeight] = useState(madrasah?.config_json?.signature_height || 30);
  const [nameEnglish, setNameEnglish] = useState((madrasah?.config_json as any)?.name_english || '');
  const [biometricDevicesStr, setBiometricDevicesStr] = useState(((madrasah?.config_json as any)?.biometric_devices || []).map((d: any) => d.sn).join(', '));

  const [featureStudentAttSms, setFeatureStudentAttSms] = useState((madrasah?.config_json as any)?.features?.student_attendance_sms ?? false);
  const [featureFeeSms, setFeatureFeeSms] = useState((madrasah?.config_json as any)?.features?.fee_collection_sms ?? false);
  const [featureTeacherSalarySms, setFeatureTeacherSalarySms] = useState((madrasah?.config_json as any)?.features?.teacher_salary_sms ?? false);
  const [featureTeacherDeduction, setFeatureTeacherDeduction] = useState((madrasah?.config_json as any)?.features?.teacher_attendance_deduction ?? false);
  const [receiptPrintMode, setReceiptPrintMode] = useState((madrasah?.config_json as any)?.features?.receipt_print_mode ?? false);
  const [printerPaperSize, setPrinterPaperSize] = useState((madrasah?.config_json as any)?.features?.printer_paper_size ?? 'A4');

  const [featureDeleteClass, setFeatureDeleteClass] = useState((madrasah?.config_json as any)?.features?.delete_class ?? false);
  const [featureDeleteAccounting, setFeatureDeleteAccounting] = useState((madrasah?.config_json as any)?.features?.delete_accounting ?? false);

  const isDark = madrasah?.theme === 'dark';
  const modules = (madrasah?.config_json as any)?.modules || {};
  const packageRaw = madrasah?.config_json?.package_name || madrasah?.config_json?.subscription?.package_name || '1';
  const packageNumber = String(packageRaw);

  const getPackageLevel = (pkg: string): number => {
    const name = pkg.trim().toUpperCase();
    if (name === '1' || name === 'STARTER' || name === 'স্টার্টার') return 1;
    if (name === '2' || name === 'BASIC' || name === 'বেসিক') return 2;
    if (name === '3' || name === 'SMART' || name === 'স্মার্ট') return 3;
    if (name === '4' || name === 'ACADEMIC' || name === 'একাডেমিক') return 4;
    if (name === '5' || name === 'STANDARD' || name === 'স্ট্যান্ডার্ড') return 5;
    if (name === '6' || name === 'FINANCE' || name === 'ফিনান্স') return 6;
    if (name === '7' || name === 'PROFESSIONAL' || name === 'প্রফেশনাল') return 7;
    if (name === '8' || name === 'ENTERPRISE' || name === 'এন্টারপ্রাইজ') return 8;
    if (name === '9' || name === 'ENTERPRISE PLUS' || name === 'এন্টারপ্রাইজ প্লাস') return 9;
    if (name === '10' || name === 'ULTIMATE' || name === 'আল্টিমেট') return 10;
    
    const num = parseInt(name);
    if (!isNaN(num)) return num;

    if (name.includes('ULTIMATE') || name.includes('আল্টিমেট')) return 10;
    if (name.includes('ENTERPRISE') || name.includes('এন্টারপ্রাইজ')) return 8;
    if (name.includes('PROFESSIONAL') || name.includes('প্রফেশনাল')) return 7;
    if (name.includes('FINANCE') || name.includes('ফিনান্স')) return 6;
    if (name.includes('STANDARD') || name.includes('স্ট্যান্ডার্ড')) return 5;
    if (name.includes('ACADEMIC') || name.includes('একাডেমিক')) return 4;

    return 1;
  };

  const isPremiumPackage = getPackageLevel(packageNumber) >= 4;

  const compressAndResizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height *= maxWidth / width)); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width *= maxHeight / height)); height = maxHeight; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get context'));
          
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Failed to create blob')); }, 'image/webp', 0.9);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const updatedConfig = { 
        ...madrasah.config_json, 
        user_pin: newPin.trim(), 
        signature_url: signatureUrl,
        signature_height: signatureHeight,
        arabic_calligraphy_url: arabicCalligraphyUrl,
        arabic_calligraphy_width: arabicCalligraphyWidth,
        name_english: nameEnglish.trim(),
        biometric_devices: biometricDevicesStr.split(',').map(s => s.trim()).filter(Boolean).map(sn => ({ sn, name: "Device " + sn })),
        features: {
          ...((madrasah.config_json as any)?.features || {}),
          student_attendance_sms: featureStudentAttSms,
          fee_collection_sms: featureFeeSms,
          teacher_salary_sms: featureTeacherSalarySms,
          teacher_attendance_deduction: featureTeacherDeduction,
          receipt_print_mode: receiptPrintMode,
          printer_paper_size: printerPaperSize,
          delete_class: featureDeleteClass,
          delete_accounting: featureDeleteAccounting
        }
      };
      
      requestManager.invalidatePattern(`institution:${madrasah.id}`);
      
      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        contact_email: newContactEmail.trim() || null,
        voice_sender_id: voiceSenderId.trim() || null,
        logo_url: logoUrl,
        config_json: updatedConfig
      }).eq('id', madrasah.id);
      
      if (error) throw error;
      
      // Update local cache so UI doesn't bounce
      try {
         const { OfflineService } = await import('../services/OfflineService');
         const cachedMadrasah = OfflineService.getCache('profile');
         if (cachedMadrasah && cachedMadrasah.id === madrasah.id) {
           OfflineService.setCache('profile', { ...cachedMadrasah, name: newName.trim(), address: newAddress.trim(), phone: newPhone.trim(), contact_email: newContactEmail.trim(), config_json: updatedConfig });
         }
      } catch(e) {}

      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature' | 'calligraphy') => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      // Delete old file if exists if it belongs to this madrasah
      const oldUrl = type === 'logo' ? logoUrl : (type === 'signature' ? signatureUrl : arabicCalligraphyUrl);
      if (oldUrl && oldUrl.includes('madrasah-assets/')) {
        try {
          const oldFileName = oldUrl.split('madrasah-assets/').pop();
          if (oldFileName) {
            await supabase.storage.from('madrasah-assets').remove([oldFileName]);
          }
        } catch (e) { console.error("Error removing old file", e); }
      }

      const size = type === 'logo' ? 600 : (type === 'calligraphy' ? 1200 : 250);
      const compressedBlob = await compressAndResizeImage(file, size, size);
      
      const fileExt = 'webp';
      const fileName = `${type}_${madrasah.id}_${Date.now()}.${fileExt}`;
      
      // Ensure bucket exists (ignoring errors if it does)
      await supabase.storage.createBucket('madrasah-assets', { public: true }).catch(() => {});
      
      const { data, error: uploadError } = await supabase.storage.from('madrasah-assets').upload(fileName, compressedBlob, { 
        contentType: `image/${fileExt}`,
        upsert: true 
      });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('madrasah-assets').getPublicUrl(fileName);
      
      if (type === 'logo') setLogoUrl(publicUrl);
      else if (type === 'signature') setSignatureUrl(publicUrl);
      else if (type === 'calligraphy') setArabicCalligraphyUrl(publicUrl);
      
      // Auto-save the URL to database to prevent loss on refresh
      try {
        const { data: currentData } = await supabase.from('institutions').select('config_json').eq('id', madrasah.id).single();
        const currentConfig = (typeof currentData?.config_json === 'string' ? JSON.parse(currentData.config_json) : currentData?.config_json) || {};
        
        let updatedConfig = { ...currentConfig };
        let updateData: any = {};

        if (type === 'logo') {
          updateData.logo_url = publicUrl;
        } else {
          const updateKey = type === 'signature' ? 'signature_url' : 'arabic_calligraphy_url';
          updatedConfig[updateKey] = publicUrl;
          updateData.config_json = updatedConfig;
        }

        const { error: autoSaveError } = await supabase.from('institutions').update(updateData).eq('id', madrasah.id);
        
        if (!autoSaveError) {
          // Update local cache so refresh doesn't show old data
          try {
            const { OfflineService } = await import('../services/OfflineService');
            const cachedMadrasah = OfflineService.getCache('profile');
            if (cachedMadrasah && cachedMadrasah.id === madrasah.id) {
              const newCachedData = { 
                ...cachedMadrasah, 
                logo_url: type === 'logo' ? publicUrl : cachedMadrasah.logo_url,
                config_json: type !== 'logo' ? updatedConfig : cachedMadrasah.config_json 
              };
              OfflineService.setCache('profile', newCachedData);
            }
          } catch(e) { console.error("Error updating offline cache", e); }
          
          if (onProfileUpdate) onProfileUpdate();
        }
      } catch (e) {
        console.error("Auto-save failed", e);
      }

      console.log(`${type} uploaded and auto-saved successfully:`, publicUrl);
    } catch (error: any) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Error uploading ${type}: ` + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
      // Reset input value so same file can be selected again
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteCalligraphy = async () => {
    if (!madrasah || !arabicCalligraphyUrl) return;
    
    const confirmDelete = window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি ক্যালিগ্রাফি ছবিটি ডিলিট করতে চান?' : 'Are you sure you want to delete the calligraphy image?');
    if (!confirmDelete) return;

    setSaving(true);
    try {
      // 1. Remove from storage if it belongs to this madrasah
      if (arabicCalligraphyUrl.includes('madrasah-assets/')) {
        try {
          const fileName = arabicCalligraphyUrl.split('madrasah-assets/').pop();
          if (fileName) {
            await supabase.storage.from('madrasah-assets').remove([fileName]);
          }
        } catch (e) { console.error("Error removing file from storage", e); }
      }

      // 2. Update state
      setArabicCalligraphyUrl('');

      // 3. Update Database
      const { data: currentData } = await supabase.from('institutions').select('config_json').eq('id', madrasah.id).single();
      const currentConfig = (typeof currentData?.config_json === 'string' ? JSON.parse(currentData.config_json) : currentData?.config_json) || {};
      
      let updatedConfig = { ...currentConfig };
      delete updatedConfig.arabic_calligraphy_url;

      const { error } = await supabase.from('institutions').update({ 
        config_json: updatedConfig 
      }).eq('id', madrasah.id);

      if (error) throw error;

      // 4. Update local cache
      try {
        const { OfflineService } = await import('../services/OfflineService');
        const cachedMadrasah = OfflineService.getCache('profile');
        if (cachedMadrasah && cachedMadrasah.id === madrasah.id) {
          OfflineService.setCache('profile', { ...cachedMadrasah, config_json: updatedConfig });
        }
      } catch(e) {}

      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: lang === 'bn' ? 'ক্যালিগ্রাফি ডিলিট করা হয়েছে' : 'Calligraphy deleted successfully' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-60px)] md:h-screen w-full relative overflow-hidden ${isDark ? 'bg-[#0f172a] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
      {/* Header */}
      <div className={`p-4 md:p-6 flex items-center justify-between sticky top-0 z-50 transition-all ${isDark ? 'bg-[#1e293b]/90 backdrop-blur-md border-b border-slate-800' : 'bg-white/80 backdrop-blur-md border-b border-slate-200/60'}`}>
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack} 
            className={`w-10 h-10 rounded-[1.1rem] border flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} shadow-sm`}
          >
            <ChevronLeft size={20} />
          </motion.button>
          <div className="min-w-0">
            <h1 className="text-xl font-black font-noto tracking-tight truncate">{lang === 'bn' ? 'প্রোফাইল সেটিংস' : 'Profile Settings'}</h1>
            <p className="text-[10px] font-bold text-slate-400 font-noto uppercase tracking-wider">{lang === 'bn' ? 'ব্র্যান্ডিং এবং তথ্য আপডেট' : 'Edit branding and info'}</p>
          </div>
        </div>
        <div className="hidden md:block">
           <button onClick={handleUpdate} disabled={saving} className={`px-6 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-black rounded-xl text-xs uppercase shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}>
             {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
             {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
           </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-32 space-y-8">
          
          {/* Logo Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative p-8 rounded-[2.5rem] border overflow-hidden flex flex-col items-center text-center space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="relative group">
              <div className={`w-32 h-32 rounded-[2.2rem] border-4 flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-500 group-hover:scale-105 ${isDark ? 'bg-slate-800 border-slate-700 shadow-black/50' : 'bg-slate-50 border-white shadow-slate-200'}`}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="text-slate-300 flex flex-col items-center gap-2">
                    <ImageIcon size={40} className="opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Logo</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-[2px]">
                  <Upload className="text-white mb-1" size={24} />
                  <span className="text-[10px] text-white font-black uppercase tracking-widest">{lang === 'bn' ? 'পরিবর্তন' : 'Change'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'logo')} disabled={saving} />
                </label>
              </div>
              {saving && <div className="absolute inset-0 bg-white/20 dark:bg-black/20 backdrop-blur-sm rounded-[2.2rem] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
            </div>

            <div className="space-y-1">
              <h2 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{newName || 'Institution Name'}</h2>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'প্রতিষ্ঠানের ব্র্যান্ডিং' : 'Institution Branding'}</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Info Card */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <Building2 size={20} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'সাধারণ তথ্য' : 'General Info'}</h3>
              </div>

              <div className="space-y-5">
                {[
                  { label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name', value: newName, setter: setNewName, icon: Building2, type: 'text' },
                  { label: lang === 'bn' ? 'ঠিকানা' : 'Address', value: newAddress, setter: setNewAddress, icon: MapPin, type: 'text' },
                  { label: lang === 'bn' ? 'মোবাইল নাম্বার' : 'Phone Number', value: newPhone, setter: setNewPhone, icon: Phone, type: 'tel' },
                  { label: lang === 'bn' ? 'অফিসিয়াল ইমেইল (PDF-এর জন্য)' : 'Official Email (For PDFs)', value: newContactEmail, setter: setNewContactEmail, icon: Mail, type: 'email' },
                ].map((field, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">{field.label}</label>
                    <div className="relative group">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isDark ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-300 group-focus-within:text-[#2563EB]'}`}>
                        <field.icon size={16} />
                      </div>
                      <input 
                        type={field.type} 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                        value={field.value} 
                        onChange={(e) => field.setter(e.target.value)} 
                        placeholder="..."
                      />
                    </div>
                  </div>
                ))}

                {madrasah?.institution_type === 'madrasah' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                        {lang === 'bn' ? 'প্রতিষ্ঠানের নাম (ইংরেজি) - ঐচ্ছিক' : 'Institution Name (English) - Optional'}
                      </label>
                      <div className="relative group">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isDark ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-300 group-focus-within:text-[#2563EB]'}`}>
                          <Building2 size={16} />
                        </div>
                        <input 
                          type="text" 
                          className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                          value={nameEnglish} 
                          onChange={(e) => setNameEnglish(e.target.value)} 
                          placeholder={lang === 'bn' ? 'ইংরেজি নাম লিখুন' : 'Enter English name'}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                        {lang === 'bn' ? 'আরবি ক্যালিগ্রাফি ইমেজ (ঐচ্ছিক)' : 'Arabic Calligraphy Image (Optional)'}
                      </label>
                      <div className={`relative p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        {arabicCalligraphyUrl ? (
                          <div className="relative group/calligraphy w-full flex flex-col items-center">
                            <div className={`p-4 rounded-xl border mb-4 flex items-center justify-center bg-white ${isDark ? 'border-slate-700' : 'border-slate-100'}`} style={{ width: '100%', height: '120px' }}>
                              <img 
                                src={arabicCalligraphyUrl} 
                                alt="Calligraphy" 
                                className="max-h-full object-contain" 
                                crossOrigin="anonymous" 
                                style={{ width: `${arabicCalligraphyWidth}%` }} 
                              />
                            </div>
                            
                            <div className="w-full space-y-3 mb-4">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ক্যালিগ্রাফির সাইজ (প্রস্থ)' : 'Calligraphy Scale (Width)'}</label>
                                <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{arabicCalligraphyWidth}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="30" 
                                max="100" 
                                value={arabicCalligraphyWidth} 
                                onChange={(e) => setArabicCalligraphyWidth(Number(e.target.value))} 
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>

                            <div className="flex items-center gap-4">
                              <button 
                                onClick={handleDeleteCalligraphy}
                                className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                              >
                                <Trash2 size={12} />
                                {lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                              </button>
                              <label className="text-[10px] font-black text-blue-500 cursor-pointer uppercase tracking-widest hover:underline">
                                {lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change Image'}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'calligraphy')} disabled={saving} />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Upload size={24} className="text-slate-300" />
                            <label className="text-center cursor-pointer">
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">
                                {lang === 'bn' ? 'ক্যালিগ্রাফি ছবি আপলোড করুন' : 'Upload Calligraphy Image'}
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                                {lang === 'bn' ? 'PDF রিপোর্টে নামের পরিবর্তে এটি ব্যবহার হবে' : 'This will be used instead of text in PDF reports'}
                              </span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'calligraphy')} disabled={saving} />
                            </label>
                          </>
                        )}
                        {saving && <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm rounded-2xl flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={24} /></div>}
                      </div>
                    </div>
                  </>
                )}

                {modules?.biometric_device_sync && (
                  <div className="space-y-1.5 mt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex justify-between items-center">
                      <span>{lang === 'bn' ? 'হাজিরা মেশিনের সিরিয়াল নাম্বার' : 'Biometric Machine SNs'}</span>
                      <span className="text-[9px] font-normal lowercase bg-blue-100 text-blue-600 px-1.5 rounded">Optional</span>
                    </label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        className={`w-full h-12 border-2 rounded-2xl px-4 font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                        value={biometricDevicesStr} 
                        onChange={(e) => setBiometricDevicesStr(e.target.value)} 
                        placeholder={lang === 'bn' ? 'যেমন: ABCD12345, XYZ987' : 'e.g. ABCD12345, XYZ987'}
                      />
                    </div>
                    <p className={`text-[10px] mt-1 ml-1 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {lang === 'bn' ? 'একাধিক মেশিন থাকলে কমা (,) দিয়ে সিরিয়াল নাম্বারগুলো লিখুন। মেশিনের Cloud/ADMS সেটিংসে সার্ভার লিংক হিসেবে আপনার বর্তমান ডোমেইনের সাথে /iclock/cdata যুক্ত করে ব্যবহার করুন।' : 'Comma separated machine Serial Numbers. Use your current domain with /iclock/cdata as ADMS Server URL.'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Account & Security Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'অ্যাকাউন্ট ও নিরাপত্তা' : 'Account & Security'}</h3>
                </div>

                <div className="space-y-5">
                   <div className="space-y-1.5 opacity-80">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center justify-between">
                      {lang === 'bn' ? 'ইমেইল এড্রেস' : 'Email Address'}
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-400/5 px-2 py-0.5 rounded-full border border-red-400/10">read-only</span>
                    </label>
                    <div className="relative group grayscale pointer-events-none">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Mail size={16} />
                      </div>
                      <input 
                        type="email" 
                        readOnly 
                        disabled 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none cursor-not-allowed ${isDark ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400 shadow-inner'}`} 
                        value={madrasah?.email || ''} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 opacity-80">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center justify-between">
                      {lang === 'bn' ? 'অ্যাকাউন্ট পিন' : 'Account PIN'}
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-400/5 px-2 py-0.5 rounded-full border border-red-400/10">read-only</span>
                    </label>
                    <div className="relative group grayscale pointer-events-none">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Fingerprint size={16} />
                      </div>
                      <input 
                        type="text" 
                        readOnly 
                        disabled 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none cursor-not-allowed font-mono ${isDark ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400 shadow-inner'}`} 
                        value={madrasah?.config_json?.user_pin || ''} 
                      />
                    </div>
                  </div>
                </div>
              </div>

               {/* Features Toggle Card */}
               <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#F1F5F9] border-slate-200/50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                    <Zap size={20} />
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'স্মার্ট অটোমেশন' : 'Smart Automation'}</h3>
                </div>

                <div className="space-y-4">
                  {[
                    { label: lang === 'bn' ? 'হাজিরা SMS' : 'Attendance SMS', description: lang === 'bn' ? 'শিক্ষার্থীদের হাজিরার পর SMS যাবে' : 'Auto SMS on attendance', checked: featureStudentAttSms, setter: setFeatureStudentAttSms },
                    { label: lang === 'bn' ? 'বেতন আদায় SMS' : 'Fee SMS', description: lang === 'bn' ? 'বেতন আদায়ের পর SMS যাবে' : 'Auto SMS on fee collection', checked: featureFeeSms, setter: setFeatureFeeSms },
                    { label: lang === 'bn' ? 'শিক্ষক বেতন SMS' : 'Teacher Salary SMS', description: lang === 'bn' ? 'শিক্ষক বেতন প্রদানের পর SMS যাবে' : 'Auto SMS on teacher salary', checked: featureTeacherSalarySms, setter: setFeatureTeacherSalarySms },
                    { label: lang === 'bn' ? 'শিক্ষক বেতন কর্তন' : 'Teacher Deduction', description: lang === 'bn' ? 'হাজিরার উপর ভিত্তি করে বেতন কর্তন' : 'Auto-deduct by attendance', checked: featureTeacherDeduction, setter: setFeatureTeacherDeduction },
                    { label: lang === 'bn' ? 'রশিদ প্রিন্ট মোড' : 'Receipt Print Mode', description: lang === 'bn' ? 'ডাউনলোডের পরিবর্তে সরাসরি প্রিন্ট করুন' : 'Direct print instead of download', checked: receiptPrintMode, setter: setReceiptPrintMode },
                  ].map((feature, idx) => (
                    <div key={idx} className="space-y-3">
                      <label className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.02] ${feature.checked ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white border-blue-100 shadow-md shadow-blue-500/5') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/60 border-transparent')}`}>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => feature.setter(e.target.checked)} />
                          <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-[#2563EB] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-blue-400' : 'text-[#2563EB]') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{feature.description}</p>
                        </div>
                      </label>
                      
                      {feature.label === (lang === 'bn' ? 'রশিদ প্রিন্ট মোড' : 'Receipt Print Mode') && feature.checked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-3"
                        >
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'প্রিন্ট পেপার সাইজ' : 'Printer Paper Size'}</label>
                          <div className="grid grid-cols-4 gap-2">
                            {['58mm', '80mm', 'A4', 'A5'].map((size) => (
                              <button
                                key={size}
                                onClick={() => setPrinterPaperSize(size)}
                                className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                                  printerPaperSize === size 
                                    ? (isDark ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600')
                                    : (isDark ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white border-slate-100 text-slate-400')
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

               {/* Admin Permissions Card */}
               <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#FFF1F2] border-rose-200/50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'অ্যাডমিন পারমিশন' : 'Admin Permissions'}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'bn' ? 'সতর্কতার সাথে ব্যবহার করুন' : 'Use with caution'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: lang === 'bn' ? 'ক্লাস ডিলিট' : 'Delete Class', description: lang === 'bn' ? 'ক্লাস ডিলিট করার অপশন চালু করুন' : 'Enable option to delete classes', checked: featureDeleteClass, setter: setFeatureDeleteClass },
                    { label: lang === 'bn' ? 'হিসাব ইতিহাস ডিলিট' : 'Delete Accounting History', description: lang === 'bn' ? 'হিসাবের লেনদেন ডিলিট করুন' : 'Enable option to delete transactions', checked: featureDeleteAccounting, setter: setFeatureDeleteAccounting },
                  ].map((feature, idx) => (
                    <label key={idx} className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.02] ${feature.checked ? (isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white border-rose-200 shadow-md shadow-rose-500/5') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/60 border-transparent')}`}>
                      <div className="relative inline-flex items-center">
                        <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => feature.setter(e.target.checked)} />
                        <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-rose-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-rose-400' : 'text-rose-600') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{feature.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Premium Branding Section */}
          {isPremiumPackage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-6 md:p-8 rounded-[2.5rem] border space-y-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden'}`}
            >
              <div className="absolute top-0 right-0">
                <div className="bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-[1.5rem] shadow-sm">Premium Feature</div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{lang === 'bn' ? 'ডিজিটাল স্বাক্ষর স্টুডিও' : 'Digital Signature Studio'}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{lang === 'bn' ? 'অফিসিয়াল রিপোর্টে ব্যবহারের জন্য' : 'For usage in official reports'}</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                 <div className={`w-full md:w-64 aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center relative group transition-all duration-500 overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/30' : 'bg-slate-50 border-slate-200 hover:border-emerald-500/30'}`}>
                    {signatureUrl ? (
                      <div className="p-4 w-full h-full flex items-center justify-center">
                        <img src={signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain filter " crossOrigin="anonymous" style={{ height: `${signatureHeight * 1.8}px` }} />
                      </div>
                    ) : (
                      <div className="text-slate-300 flex flex-col items-center gap-2">
                        <Edit3 size={32} className="opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Signature</span>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-emerald-500/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                      <Upload className="text-white mb-1" size={24} />
                      <span className="text-[10px] text-white font-black uppercase tracking-widest">{lang === 'bn' ? 'পরিবর্তন' : 'Change'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'signature')} disabled={saving} />
                    </label>
                 </div>

                 <div className="flex-1 w-full space-y-6">
                    <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'স্বাক্ষরের সাইজ' : 'Signature Scale'}</label>
                        <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{signatureHeight}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="15" 
                        max="80" 
                        value={signatureHeight} 
                        onChange={(e) => setSignatureHeight(Number(e.target.value))} 
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">{lang === 'bn' ? '* একটি স্বচ্ছ ব্যাকগ্রাউন্ড সহ সাদা বা কালো স্বাক্ষর ব্যবহার করুন' : '* Use a clean signature with a transparent background'}</p>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {/* Action Area Mobile Only show */}
          <div className="md:hidden">
             <button onClick={handleUpdate} disabled={saving} className="w-full h-16 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-black rounded-[1.8rem] text-sm uppercase shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-blue-500/20">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
