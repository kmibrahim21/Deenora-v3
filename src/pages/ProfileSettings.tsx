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
  Smartphone
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
  const [logoUrl, setLogoUrl] = useState(madrasah?.logo_url || '');
  const [voiceSenderId, setVoiceSenderId] = useState(madrasah?.voice_sender_id || '');
  const [newPin, setNewPin] = useState(madrasah?.config_json?.user_pin || '');
  const [saving, setSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(madrasah?.config_json?.signature_url || '');
  const [signatureHeight, setSignatureHeight] = useState(madrasah?.config_json?.signature_height || 30);

  const [featureStudentAttSms, setFeatureStudentAttSms] = useState((madrasah?.config_json as any)?.features?.student_attendance_sms ?? false);
  const [featureFeeSms, setFeatureFeeSms] = useState((madrasah?.config_json as any)?.features?.fee_collection_sms ?? false);
  const [featureTeacherDeduction, setFeatureTeacherDeduction] = useState((madrasah?.config_json as any)?.features?.teacher_attendance_deduction ?? false);

  const isDark = madrasah?.theme === 'dark';
  const modules = (madrasah?.config_json as any)?.modules || {};
  const packageRaw = madrasah?.config_json?.package_name || madrasah?.config_json?.subscription?.package_name || '1';
  const packageNumber = String(packageRaw);

  const isPremiumPackage = 
    ['FINANCE', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE PLUS', 'ফিনান্স', 'প্রফেশনাল', 'এন্টারপ্রাইজ'].includes(packageNumber.toUpperCase()) ||
    ['7', '8', '9'].includes(packageNumber) ||
    packageNumber.toUpperCase().includes('ENTERPRISE PLUS');

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
        features: {
          ...((madrasah.config_json as any)?.features || {}),
          student_attendance_sms: featureStudentAttSms,
          fee_collection_sms: featureFeeSms,
          teacher_attendance_deduction: featureTeacherDeduction
        }
      };
      
      requestManager.invalidatePattern(`institution:${madrasah.id}`);
      
      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
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
           OfflineService.setCache('profile', { ...cachedMadrasah, name: newName.trim(), address: newAddress.trim(), phone: newPhone.trim(), config_json: updatedConfig });
         }
      } catch(e) {}

      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      // Delete old file if exists
      const oldUrl = type === 'logo' ? logoUrl : signatureUrl;
      if (oldUrl && oldUrl.includes('madrasah-assets/')) {
        const oldFileName = oldUrl.split('madrasah-assets/').pop();
        if (oldFileName) {
          await supabase.storage.from('madrasah-assets').remove([oldFileName]);
        }
      }

      const size = type === 'signature' ? 200 : 600;
      const compressedBlob = await compressAndResizeImage(file, size, size);
      const fileName = `${type}_${madrasah.id}_${Date.now()}.webp`;
      try { await supabase.storage.createBucket('madrasah-assets', { public: true }); } catch (bucketError) {}
      const { error: uploadError } = await supabase.storage.from('madrasah-assets').upload(fileName, compressedBlob, { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('madrasah-assets').getPublicUrl(fileName);
      
      if (type === 'logo') setLogoUrl(publicUrl);
      else if (type === 'signature') setSignatureUrl(publicUrl);
    } catch (error: any) {
      alert("Error uploading photo: " + error.message);
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

                {modules.voice_broadcast && (
                   <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">{lang === 'bn' ? 'ভয়েস সেন্ডার আইডি' : 'Voice Sender ID'}</label>
                    <div className="relative group">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isDark ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-300 group-focus-within:text-[#2563EB]'}`}>
                        <Smartphone size={16} />
                      </div>
                      <input 
                        type="text" 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                        value={voiceSenderId} 
                        onChange={(e) => setVoiceSenderId(e.target.value)} 
                        placeholder="e.g. 88017..."
                      />
                    </div>
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
                    { label: lang === 'bn' ? 'শিক্ষক বেতন কর্তন' : 'Teacher Deduction', description: lang === 'bn' ? 'হাজিরার উপর ভিত্তি করে বেতন কর্তন' : 'Auto-deduct by attendance', checked: featureTeacherDeduction, setter: setFeatureTeacherDeduction },
                  ].map((feature, idx) => (
                    <label key={idx} className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.02] ${feature.checked ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white border-blue-100 shadow-md shadow-blue-500/5') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/60 border-transparent')}`}>
                      <div className="relative inline-flex items-center">
                        <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => feature.setter(e.target.checked)} />
                        <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-[#2563EB] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-blue-400' : 'text-[#2563EB]') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
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
