
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
  const [isEditingSubscription, setIsEditingSubscription] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  
  const [stats, setStats] = useState({ students: 0, classes: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newAddress, setNewAddress] = useState(initialMadrasah?.address || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [newPin, setNewPin] = useState((initialMadrasah?.config_json as any)?.user_pin || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');
  
  const [copiedId, setCopiedId] = useState(false);
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [rechargePhone, setRechargePhone] = useState('');
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic module configuration
  const modules = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const configObj: any = (typeof config === 'object' && config !== null) ? config : {};
    
    return {
      attendance: configObj.modules?.attendance ?? true,
      results: configObj.modules?.results ?? true,
      admit_card: configObj.modules?.admit_card ?? true,
      seat_plan: configObj.modules?.seat_plan ?? true,
      accounting: configObj.modules?.accounting ?? true,
      academic_year_promotion: configObj.modules?.academic_year_promotion ?? true,
      voice_broadcast: configObj.modules?.voice_broadcast ?? true,
      sms: configObj.modules?.sms ?? true,
    };
  }, [madrasah]);

  const handleUpgradeRequest = async () => {
    if (!selectedPackage || !madrasah || !rechargeTrx || !rechargePhone) return;
    setRequestingUpgrade(true);
    try {
      const duration = subscriptionType === 'monthly' ? 1 : subscriptionType === 'quarterly' ? 3 : 12;
      const amount = (selectedPackage.rate * stats.students) * duration;

      const { error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: amount,
        transaction_id: rechargeTrx.trim().toUpperCase(),
        sender_phone: rechargePhone.trim(),
        description: `Subscription Upgrade: ${selectedPackage.name} (${subscriptionType})`,
        type: 'credit',
        status: 'pending',
        module: 'subscription'
      });

      if (error) throw error;

      setShowSuccessModal({ 
        show: true, 
        title: lang === 'bn' ? 'অনুরোধ সফল' : 'Request Successful', 
        message: lang === 'bn' ? 'আপনার সাবস্ক্রিপশন আপগ্রেড অনুরোধটি গ্রহণ করা হয়েছে। অ্যাডমিন এটি যাচাই করে এপ্রুভ করবেন।' : 'Your subscription upgrade request has been received. Admin will verify and approve it.' 
      });
      setIsEditingSubscription(false);
      setRechargeTrx('');
      setRechargePhone('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRequestingUpgrade(false);
    }
  };

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
      setNewPin((initialMadrasah.config_json as any)?.user_pin || '');
      setLogoUrl(initialMadrasah.logo_url || '');
      
      if (initialMadrasah) {
        fetchStats();
        fetchPackages();
        
        // Set subscription type based on config if available
        const config = initialMadrasah.config_json as any;
        if (config?.subscription_type) {
          setSubscriptionType(config.subscription_type);
        }
      }
    }
  }, [initialMadrasah]);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setPackages(data);
        // Set default selected package if current madrasah has one
        const currentPkg = data.find(p => p.name === (madrasah?.config_json as any)?.subscription?.package_name);
        if (currentPkg) setSelectedPackage(currentPkg);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

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
      const currentConfig = (madrasah.config_json as any) || {};
      const updatedConfig = { ...currentConfig, user_pin: newPin.trim() };
      
      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        logo_url: logoUrl,
        config_json: updatedConfig
      }).eq('id', madrasah.id);
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      setMadrasah(prev => prev ? { ...prev, name: newName, address: newAddress, phone: newPhone, config_json: updatedConfig } : null);
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

  if (!madrasah) return null;

  const displayName = madrasah?.name || 'User';
  const isTeacher = profile?.role === 'teacher';

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
                 <h2 className={`text-[22px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{madrasah?.name || 'User'}</h2>
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
             
             {madrasah && madrasah.id !== 'super_admin' && !isTeacher && (
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

        {!isTeacher && (
          <>
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
            
            {modules.academic_year_promotion && (
              <button 
                onClick={() => setView('academic-year')} 
                className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
              >
                <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'শিক্ষাবর্ষ' : 'Academic Year'}</h5>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'সেটআপ ও প্রমোশন' : 'Setup & Promotion'}</p>
                </div>
              </button>
            )}

            {/* Subscription Card */}
            <button 
              onClick={() => setIsEditingSubscription(true)}
              className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
            >
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard size={24} />
              </div>
              <div>
                <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  {lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
                </h5>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {lang === 'bn' ? 'প্যাকেজ ও পেমেন্ট' : 'Plans & Billing'}
                </p>
              </div>
            </button>

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
          </>
        )}

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


        {/* Language Card */}
        {!isTeacher && (
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
        )}

        {/* Theme Switcher Card */}
        {!isTeacher && (
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
        )}

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

      {/* Edit Profile Modal - PORTALED */}


      {/* Subscription Modal */}
      {isEditingSubscription && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-lg rounded-[2.5rem] sm:rounded-[3.5rem] p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-500 relative max-h-[92vh] overflow-y-auto custom-scrollbar ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <CreditCard size={20} />
                  </div>
                  <h3 className={`text-lg sm:text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'সাবস্ক্রিপশন ম্যানেজমেন্ট' : 'Subscription Management'}
                  </h3>
                </div>
                <button onClick={() => setIsEditingSubscription(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {/* Current Package Details */}
                <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border relative overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-blue-900/10 border-blue-500/30' : 'bg-blue-50/50 border-blue-200'}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-5 sm:mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <p className="text-[9px] sm:text-[10px] font-black text-blue-600/60 uppercase tracking-widest">Current Package</p>
                          <h4 className={`text-lg sm:text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                            {(madrasah?.config_json as any)?.package_name || 'None'}
                          </h4>
                        </div>
                      </div>
                      <span className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${madrasah?.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {madrasah?.status || 'Trial'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6">
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Students</p>
                        <p className={`text-xl sm:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{stats.students}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing Cycle</p>
                        <p className={`text-xl sm:text-2xl font-black capitalize ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {(madrasah?.config_json as any)?.subscription_type || 'Monthly'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Package Rate</p>
                        <p className={`text-xl sm:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {(madrasah?.config_json as any)?.package_rate || 0} ৳
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Cost</p>
                        <p className={`text-xl sm:text-2xl font-black text-blue-600`}>
                          {((Number((madrasah?.config_json as any)?.package_rate) || 0) * (stats.students > 0 && stats.students <= 200 ? 1 : stats.students) * (subscriptionType === 'monthly' ? 1 : subscriptionType === 'quarterly' ? 3 : 12)).toLocaleString()} ৳
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other Packages */}
                <div className="space-y-3 sm:space-y-4">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Other Available Packages</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {packages.filter(pkg => pkg.name !== (madrasah?.config_json as any)?.package_name).map((pkg) => {
                      return (
                        <div
                          key={pkg.id}
                          className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border transition-all relative overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}
                        >
                          <h4 className={`text-xs sm:text-sm font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{pkg.name}</h4>
                          <p className={`text-[9px] sm:text-[10px] font-bold mt-1 text-slate-400`}>{pkg.rate.toFixed(2)} ৳ {stats.students <= 200 ? '(Flat)' : '/ Student'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-dashed ${madrasah?.theme === 'dark' ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/30'} text-center`}>
                  <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 leading-relaxed">
                    {lang === 'bn' ? 'সাবস্ক্রিপশন পরিবর্তন বা আপগ্রেড করতে অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' : 'To change or upgrade your subscription, please contact the administrator.'}
                  </p>
                </div>
              </div>
           </div>
        </div>,
        document.body
      )}
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
                      {lang === 'bn' ? 'অ্যাকাউন্ট পিন' : 'Account PIN'}
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                    </label>
                    <input 
                      type="text" 
                      readOnly 
                      disabled
                      className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} 
                      value={newPin || ''} 
                    />
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

      {showSuccessModal.show && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 animate-in zoom-in-95 duration-500 p-10 text-center relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-emerald-500/10' : 'bg-white border-white shadow-emerald-200/50'}`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            
            <div className="relative">
              <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-[2rem] animate-ping duration-1000"></div>
                <CheckCircle2 size={48} strokeWidth={3} className="relative z-10" />
              </div>
              
              <h2 className={`text-3xl font-black mb-3 tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {showSuccessModal.title}
              </h2>
              
              <p className={`text-sm font-bold leading-relaxed px-4 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {showSuccessModal.message}
              </p>
              
              <button 
                onClick={() => setShowSuccessModal({ ...showSuccessModal, show: false })}
                className="mt-10 w-full h-16 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-90 hover:scale-[1.02] transition-all text-sm uppercase tracking-[0.2em]"
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'Awesome'}
              </button>
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
