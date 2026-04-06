
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2, Lock, Terminal, Cpu, Calendar as CalendarIcon, MapPin, Play, Moon, Sun, PhoneCall, UserCheck } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View, Profile } from 'types';
import { t } from 'translations';
import { AcademicYearManager } from 'components/AcademicYearManager';
import MultiCalendar from 'components/MultiCalendar';

interface AccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  onProfileUpdate?: () => void;
  setView: (view: View) => void;
  initialMadrasah: Institution | null;
  onLogout: () => void;
  profile?: Profile | null;
}

const Account: React.FC<AccountProps> = ({ lang, setLang, onProfileUpdate, setView, initialMadrasah, onLogout, profile }) => {
  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAcademicYearManager, setShowAcademicYearManager] = useState(false);
  const [showStartNewYear, setShowStartNewYear] = useState(false);
  const [newYearStartDate, setNewYearStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  
  const [stats, setStats] = useState({ students: 0, classes: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newAddress, setNewAddress] = useState(initialMadrasah?.address || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');
  
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = async () => {
    if (!madrasah) return;
    const newTheme = madrasah.theme === 'dark' ? 'default' : 'dark';
    
    try {
      const { error } = await supabase.from('institutions').update({ theme: newTheme }).eq('id', madrasah.id);
      if (error) throw error;
      setMadrasah({ ...madrasah, theme: newTheme });
      if (onProfileUpdate) onProfileUpdate();
    } catch (err: any) {
      console.error('Error toggling theme:', err);
    }
  };

  useEffect(() => {
    if (initialMadrasah) {
      setMadrasah(initialMadrasah);
      setNewName(initialMadrasah.name || '');
      setNewAddress(initialMadrasah.address || '');
      setNewPhone(initialMadrasah.phone || '');
      setLogoUrl(initialMadrasah.logo_url || '');
      
      if (initialMadrasah) fetchStats();
    }
  }, [initialMadrasah]);

  const fetchStats = async () => {
    if (!initialMadrasah) return;
    setLoadingStats(true);
    try {
      const { data: profile } = await supabase.from('institutions').select('*').eq('id', initialMadrasah.id).maybeSingle();
      if (profile) setMadrasah(profile);
      const [stdRes, clsRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id)
      ]);
      setStats({ students: stdRes.count || 0, classes: clsRes.count || 0 });
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        logo_url: logoUrl
      }).eq('id', madrasah.id);
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      setMadrasah(prev => prev ? { ...prev, name: newName, address: newAddress, phone: newPhone } : null);
      setShowSuccessModal({ show: true, title: t('success', lang), message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      const fileName = `logo_${madrasah.id}_${Date.now()}`;
      
      // Try to create bucket if it doesn't exist
      try {
        await supabase.storage.createBucket('madrasah-assets', { public: true });
      } catch (bucketError) {}

      let uploadError;
      let publicUrl;

      // Try madrasah-assets first
      const { error: err1 } = await supabase.storage.from('madrasah-assets').upload(`logos/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (err1) {
        // Fallback to voice-templates bucket which we know exists and is often pre-configured
        const { error: err2 } = await supabase.storage.from('voice-templates').upload(`logos/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });
        uploadError = err2;
        if (!err2) {
          const { data } = supabase.storage.from('voice-templates').getPublicUrl(`logos/${fileName}`);
          publicUrl = data.publicUrl;
        }
      } else {
        const { data } = supabase.storage.from('madrasah-assets').getPublicUrl(`logos/${fileName}`);
        publicUrl = data.publicUrl;
      }

      if (uploadError && uploadError.message !== 'Bucket not found') throw uploadError;
      
      // If both failed due to bucket issues, we might need to inform the user or use a different strategy
      if (!publicUrl) throw new Error('Could not upload logo. Please ensure storage buckets are configured.');

      const { error: updateErr } = await supabase.from('institutions').update({ logo_url: publicUrl }).eq('id', madrasah.id);
      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      setMadrasah(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      if (onProfileUpdate) onProfileUpdate();
      setShowSuccessModal({ show: true, title: 'সফল', message: 'লোগো আপডেট হয়েছে।' });
    } catch (e: any) { 
      console.error('Upload error:', e);
      alert('Logo upload failed: ' + e.message); 
    } finally { setSaving(false); }
  };

  const handleChangePin = async () => {
    if (!newPin || !confirmPin) {
      setPinError(lang === 'bn' ? 'পিন প্রদান করুন' : 'Please enter PIN');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(lang === 'bn' ? 'পিন মিলছে না' : 'PINs do not match');
      return;
    }
    if (newPin.length < 4) {
      setPinError(lang === 'bn' ? 'পিন কমপক্ষে ৪ অক্ষরের হতে হবে' : 'PIN must be at least 4 characters');
      return;
    }

    setSaving(true);
    setPinError('');
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ pin: newPin })
        .eq('user_id', profile?.id);

      if (error) throw error;
      
      setShowChangePin(false);
      setNewPin('');
      setConfirmPin('');
      setShowSuccessModal({ show: true, title: lang === 'bn' ? 'সফল' : 'Success', message: lang === 'bn' ? 'পিন সফলভাবে আপডেট হয়েছে' : 'PIN updated successfully' });
    } catch (err: any) {
      setPinError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartNewYear = async () => {
    if (!madrasah || !newYearStartDate) return;
    
    if (!confirm(lang === 'bn' 
      ? `আপনি কি নিশ্চিত যে আপনি ${newYearStartDate} তারিখ থেকে নতুন শিক্ষাবর্ষ শুরু করতে চান? এর ফলে আগের সকল হিসাব ও পরীক্ষার তথ্য বর্তমান ভিউ থেকে হাইড হয়ে যাবে।` 
      : `Are you sure you want to start a new academic year from ${newYearStartDate}? This will hide previous accounting and exam data from the current view.`)) {
      return;
    }

    setSaving(true);
    try {
      const updatedConfig = {
        ...madrasah.config_json,
        academic_year_start: newYearStartDate
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;
      
      if (onProfileUpdate) onProfileUpdate();

      setMadrasah({ ...madrasah, config_json: updatedConfig });
      setShowStartNewYear(false);
      setShowSuccessModal({ 
        show: true, 
        title: lang === 'bn' ? 'সফল' : 'Success', 
        message: lang === 'bn' ? 'নতুন শিক্ষাবর্ষ সফলভাবে শুরু হয়েছে।' : 'New academic year started successfully.' 
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      if (onProfileUpdate) onProfileUpdate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!madrasah) return null;

  const displayName = madrasah?.name || 'User';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-36 relative z-10">

      <div className="relative pt-20 px-1">
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[4rem] p-6 sm:p-10 pt-28 md:pt-36 shadow-bubble border relative text-center`}>
          <div className="absolute inset-0 overflow-hidden rounded-[4rem]">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-[0.03]" />
          </div>
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className={`w-40 h-40 p-4 rounded-full shadow-bubble border-[12px] flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                {logoUrl ? <img src={logoUrl} className="w-full h-full object-contain" alt="Profile" /> : <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><UserIcon size={70} strokeWidth={1.5} /></div>}
              </div>
              {madrasah && madrasah.id !== 'super_admin' && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute bottom-2 right-2 w-11 h-11 bg-[#2563EB] text-white rounded-2xl flex items-center justify-center shadow-premium border-4 border-white active:scale-90 transition-all z-30"
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>
          <div className="space-y-6 mt-4">
             <div className="space-y-1">
               <div className="px-4 pb-3">
                 <h2 className={`text-[22px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{displayName}</h2>
               </div>
               
               <div className="flex flex-col items-center gap-1 mt-3">
                 {madrasah?.address && (
                   <div className="flex items-center justify-center gap-1.5 text-slate-400">
                     <MapPin size={14} />
                     <p className="text-xs font-bold">{madrasah.address}</p>
                   </div>
                 )}
                 {madrasah?.phone && (
                   <div className="flex items-center justify-center gap-1.5 text-slate-400">
                     <Smartphone size={14} />
                     <p className="text-xs font-bold">{madrasah.phone}</p>
                   </div>
                 )}
                 {madrasah?.email && (
                   <div className="flex items-center justify-center gap-1.5 text-slate-400">
                     <Mail size={14} />
                     <p className="text-xs font-bold">{madrasah.email}</p>
                   </div>
                 )}
               </div>
             </div>
             
             {madrasah && madrasah.id !== 'super_admin' && (
               <>
                 <div className="pt-4 space-y-3">
                    <div onClick={() => copyToClipboard(madrasah.id)} className={`p-5 rounded-[2.5rem] border flex items-center gap-5 active:scale-[0.98] cursor-pointer group ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-100 text-[#2563EB]'}`}>
                        <Fingerprint size={24} />
                       </div>
                       <div className="flex-1 text-left min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{t('madrasah_uuid', lang)}</p>
                          <p className={`text-[12px] font-black truncate ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>{madrasah.id}</p>
                       </div>
                       {copiedId ? <Check size={22} className="text-emerald-500 shrink-0" /> : <Copy size={20} className="text-slate-200 shrink-0" />}
                    </div>
                    
                    <div className={`p-5 rounded-[2.5rem] border flex items-center gap-5 ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-purple-400' : 'bg-white border-slate-100 text-purple-600'}`}>
                        <Key size={24} />
                       </div>
                       <div className="flex-1 text-left min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'bn' ? 'অ্যাকাউন্ট পিন' : 'Account PIN'}</p>
                          <p className={`text-[14px] font-black tracking-widest ${madrasah?.theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                            {madrasah?.config_json?.user_pin || '****'}
                          </p>
                       </div>
                    </div>
                 </div>
               </>
             )}
          </div>
        </div>
      </div>

      {/* Main Options Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-1">
        {/* Academic Calendar Card */}
        <button 
          onClick={() => setView('academic-calendar')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
            </p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingProfile(true)} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Edit3 size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('profile_settings', lang)}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('branding', lang)}</p>
          </div>
        </button>

        {madrasah?.config_json?.modules?.academic_year_promotion && (
          <button 
            onClick={() => setShowAcademicYearManager(true)} 
            className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <GraduationCap size={24} />
            </div>
            <div>
              <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'শিক্ষাবর্ষ' : 'Academic Year'}</h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'প্রমোশন' : 'Promotion'}</p>
            </div>
          </button>
        )}

        <button 
          onClick={() => setView('data-management')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Database size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('backup_restore', lang)}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Excel Tools</p>
          </div>
        </button>

        {/* Teacher Management Card */}
        <button 
          onClick={() => setView('teachers')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserCheck size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'শিক্ষক ব্যবস্থাপনা' : 'Teacher Management'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'শিক্ষক ও স্টাফ' : 'Teachers & Staff'}
            </p>
          </div>
        </button>

        {/* Video Tutorial Card */}
        <button 
          onClick={() => setView('tutorials')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'টিউটোরিয়াল' : 'Video Tutorials'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'সহায়তা' : 'Help & Support'}
            </p>
          </div>
        </button>

        {/* Start New Academic Year Card */}
        <button 
          onClick={() => setShowStartNewYear(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <RefreshCw size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'নতুন শিক্ষাবর্ষ' : 'Start New Year'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'হিসাব ও পরীক্ষা রিসেট' : 'Reset Accounting'}
            </p>
          </div>
        </button>

        {profile?.role === 'teacher' && (
          <button 
            onClick={() => setShowChangePin(true)} 
            className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Key size={24} />
            </div>
            <div>
              <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'পিন পরিবর্তন' : 'Change PIN'}</h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'নিরাপত্তা' : 'Security'}</p>
            </div>
          </button>
        )}

        {/* Language Card */}
        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Languages size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className={`flex p-1 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <button 
              onClick={() => setLang('bn')} 
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
            >
              বাংলা
            </button>
            <button 
              onClick={() => setLang('en')} 
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
            >
              ENG
            </button>
          </div>
        </div>

        {/* Theme Switcher Card */}
        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-blue-50 text-[#2563EB]'}`}>
              {madrasah?.theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}
              </h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                {lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className={`w-14 h-8 rounded-full p-1 transition-colors relative ${madrasah?.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${madrasah?.theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <button 
          onClick={onLogout} 
          className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all ${madrasah?.theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <LogOut size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{t('logout', lang)}</h5>
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-widest mt-1.5">{t('logout_system', lang)}</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-red-900/50' : 'bg-white text-red-200'}`}>
            <ChevronRight size={20} />
          </div>
        </button>
      </div>

      {/* Academic Year Manager - PORTALED */}
      {showAcademicYearManager && madrasah && createPortal(
        <AcademicYearManager 
          institution={madrasah} 
          onClose={() => setShowAcademicYearManager(false)} 
          onUpdate={onProfileUpdate}
          lang={lang}
        />,
        document.body
      )}

      {/* Start New Year Modal - PORTALED */}
      {showStartNewYear && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <RefreshCw size={20} />
                  </div>
                  <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'নতুন শিক্ষাবর্ষ শুরু' : 'Start New Year'}
                  </h3>
                </div>
                <button onClick={() => setShowStartNewYear(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-4">
                 <div className={`p-4 rounded-2xl border text-xs font-bold leading-relaxed ${madrasah?.theme === 'dark' ? 'bg-amber-900/20 border-amber-900/30 text-amber-500' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} />
                      <span className="font-black uppercase tracking-widest">{lang === 'bn' ? 'সতর্কবার্তা' : 'Warning'}</span>
                    </div>
                    {lang === 'bn' 
                      ? 'নতুন শিক্ষাবর্ষ শুরু করলে আগের সকল হিসাব ও পরীক্ষার তথ্য বর্তমান ভিউ থেকে হাইড হয়ে যাবে। তবে ডাটাবেজে তথ্যগুলো সংরক্ষিত থাকবে।' 
                      : 'Starting a new year will hide previous accounting and exam data from the current view. Data will remain in the database.'}
                 </div>

                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'শুরুর তারিখ' : 'Start Date'}</label>
                   <input 
                     type="date" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={newYearStartDate} 
                     onChange={(e) => setNewYearStartDate(e.target.value)} 
                   />
                 </div>
                 
                 <button 
                   onClick={handleStartNewYear} 
                   disabled={saving}
                   className="w-full h-12 bg-[#2563EB] text-white font-bold rounded-2xl shadow-premium active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                 >
                   {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                   {lang === 'bn' ? 'নতুন শিক্ষাবর্ষ শুরু করুন' : 'Start New Year'}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Change PIN Modal - PORTALED */}
      {showChangePin && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'পিন পরিবর্তন' : 'Change PIN'}
                  </h3>
                </div>
                <button onClick={() => { setShowChangePin(false); setPinError(''); setNewPin(''); setConfirmPin(''); }} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'নতুন পিন' : 'New PIN'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={newPin} 
                     onChange={(e) => setNewPin(e.target.value)} 
                     placeholder="****"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'পিন নিশ্চিত করুন' : 'Confirm PIN'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={confirmPin} 
                     onChange={(e) => setConfirmPin(e.target.value)} 
                     placeholder="****"
                   />
                 </div>
                 
                 {pinError && <p className="text-xs text-red-500 font-bold px-1">{pinError}</p>}
                 
                 <button 
                   onClick={handleChangePin} 
                   disabled={saving}
                   className="w-full h-12 bg-[#2563EB] text-white font-bold rounded-2xl shadow-premium active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                 >
                   {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                   {lang === 'bn' ? 'আপডেট করুন' : 'Update PIN'}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Edit Profile Modal - PORTALED */}
      {isEditingProfile && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><Edit3 size={20} /></div><h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>অ্যাকাউন্ট আপডেট</h3></div>
                <button onClick={() => setIsEditingProfile(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_name', lang)}</label><input type="text" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newName || ''} onChange={(e) => setNewName(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'ঠিকানা' : 'Address'}</label><input type="text" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newAddress || ''} onChange={(e) => setNewAddress(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_phone', lang)}</label><input type="tel" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newPhone || ''} onChange={(e) => setNewPhone(e.target.value)} /></div>
                 <div className="space-y-1 opacity-70 cursor-not-allowed">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                      Gmail / Email
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                    </label>
                    <input type="email" readOnly disabled className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} value={madrasah?.email || (lang === 'bn' ? 'অ্যাসাইন করা হয়নি' : 'Not assigned')} />
                 </div>
                 <div className="space-y-1 opacity-70 cursor-not-allowed">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                    </label>
                    {/* removed */}
                 </div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsEditingProfile(false)} className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>বাতিল</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-4 bg-[#2563EB] text-white font-black rounded-2xl text-[10px] uppercase shadow-premium flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : 'সংরক্ষণ করুন'}</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default Account;
