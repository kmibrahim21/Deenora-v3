
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2, Lock, Terminal, Cpu, Calendar as CalendarIcon, MapPin, Play, Moon, Sun, PhoneCall, UserCheck, MessageCircle } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { requestManager } from 'services/RequestManager';
import { Institution, Language, View, Profile } from 'types';
import { t } from 'translations';
import { AcademicYearManager } from 'components/AcademicYearManager';
import MultiCalendar from 'components/MultiCalendar';

const compressAndResizeImage = (file: File, maxWidth = 300, maxHeight = 300): Promise<Blob> => {
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
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const ActionCard = ({ icon: Icon, title, subtitle, colorClass, onClick, dark }: any) => (
  <button 
    onClick={onClick}
    className={`w-full p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble transition-all flex flex-col items-center justify-center text-center gap-2 sm:gap-3 active:scale-95 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
  >
    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[1rem] sm:rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
      <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.5} />
    </div>
    <div className="flex-1 w-full flex flex-col items-center justify-center">
      <h5 className={`text-[12px] sm:text-[14px] font-black font-noto leading-[1.3] text-balance ${dark ? 'text-white' : 'text-slate-800'}`}>
        {title}
      </h5>
      {subtitle && (
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 tracking-wide">
          {subtitle}
        </p>
      )}
    </div>
  </button>
);

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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  
  const [stats, setStats] = useState({ students: 0, classes: 0, teachers: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newAddress, setNewAddress] = useState(initialMadrasah?.address || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [voiceSenderId, setVoiceSenderId] = useState(initialMadrasah?.voice_sender_id || '');
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
      messages: configObj.modules?.messages ?? true,
      class_routine: configObj.modules?.class_routine ?? false,
      certificates: configObj.modules?.certificates ?? true,
      id_cards: configObj.modules?.id_cards ?? false,
      exam_routine: configObj.modules?.exam_routine ?? true,
    };
  }, [madrasah]);

  const handleUpgradeRequest = async () => {
    if (!selectedPackage || !madrasah || !rechargeTrx || !rechargePhone) return;
    setRequestingUpgrade(true);
    try {
      const duration = subscriptionType === 'monthly' ? 1 : subscriptionType === 'quarterly' ? 3 : 12;
      const amount = (selectedPackage.rate * stats.students) * duration;

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      const selectedMonthsForPayment = [];
      for (let i = 0; i < duration; i++) {
        const d = new Date(currentYear, currentMonth + i, 1);
        selectedMonthsForPayment.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
      }

      const { error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: amount,
        transaction_id: rechargeTrx.trim().toUpperCase(),
        sender_phone: rechargePhone.trim(),
        description: `Subscription Upgrade: ${selectedPackage.name} (${subscriptionType})`,
        type: 'credit',
        status: 'pending',
        module: 'subscription',
        metadata: {
          months: selectedMonthsForPayment,
          package_name: selectedPackage.name,
          subscription_type: subscriptionType,
          discount: 0,
          base_amount: amount
        }
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
      if (madrasah?.id) {
        requestManager.invalidatePattern(`institution:${madrasah.id}`);
        // Profile/Institution updates might affect dashboard context/branding
        requestManager.invalidatePattern('dashboard_');
      }
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
      setVoiceSenderId(initialMadrasah.voice_sender_id || '');
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
      const [stdRes, clsRes, teacherRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id)
      ]);
      setStats({ students: stdRes.count || 0, classes: clsRes.count || 0, teachers: teacherRes.count || 0 });
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert(lang === 'bn' ? 'পাসওয়ার্ড মিলছে না।' : 'Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      // Force session hydration to prevent "Auth session missing" errors
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        // Try to refresh if session is missing
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          throw new Error(lang === 'bn' ? 'আপনার লগইন সেশন শেষ হয়ে গেছে। দয়া করে আবার লগইন করুন।' : 'Auth session expired. Please log out and log in again.');
        }
      }

      // Special handling for teachers changing their PIN
      if (profile?.role === 'teacher') {
         const response = await fetch('/api/teachers/update-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: profile.id, pin: newPassword })
         });
         
         if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update PIN');
         }
      } else {
        // For Admin users, we update their Supabase auth password
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      
      setShowSuccessModal({ show: true, title: lang === 'bn' ? 'সফল' : 'Success', message: lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।' : 'Password changed successfully.' });
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message || 'Error changing password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const currentConfig = (madrasah.config_json as any) || {};
      const updatedConfig = { ...currentConfig, user_pin: newPin.trim() };
      
      if (madrasah?.id) {
        requestManager.invalidatePattern(`institution:${madrasah.id}`);
        requestManager.invalidatePattern('dashboard_');
      }

      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        voice_sender_id: voiceSenderId.trim() || null,
        logo_url: logoUrl,
        config_json: updatedConfig
      }).eq('id', madrasah.id);
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      setMadrasah(prev => prev ? { ...prev, name: newName, address: newAddress, phone: newPhone, voice_sender_id: voiceSenderId, config_json: updatedConfig } : null);
      setShowSuccessModal({ show: true, title: t('success', lang), message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      // Compress and resize the image (e.g., max 400x400 for a crisp logo)
      const compressedBlob = await compressAndResizeImage(file, 400, 400);
      const fileName = `logo_${madrasah.id}_${Date.now()}.webp`;
      
      // Try to create bucket if it doesn't exist
      try {
        await supabase.storage.createBucket('madrasah-assets', { public: true });
      } catch (bucketError) {}

      // Try to delete old logo first if it exists, to optimize storage space
      const oldLogoUrl = logoUrl || madrasah.logo_url;
      if (oldLogoUrl) {
        try {
          const urlWithoutQuery = oldLogoUrl.split('?')[0];
          const marker = 'logos/';
          const markerIndex = urlWithoutQuery.indexOf(marker);
          if (markerIndex !== -1) {
            const storagePath = urlWithoutQuery.substring(markerIndex);
            
            // Delete from madrasah-assets
            await supabase.storage.from('madrasah-assets').remove([storagePath]).catch(() => {});
            
            // Delete from voice-templates
            await supabase.storage.from('voice-templates').remove([storagePath]).catch(() => {});
          }
        } catch (delErr) {
          console.error('Failed to clean up old logo:', delErr);
        }
      }

      let uploadError;
      let publicUrl;

      // Try madrasah-assets first
      const { error: err1 } = await supabase.storage.from('madrasah-assets').upload(`logos/${fileName}`, compressedBlob, {
        cacheControl: '3600',
        contentType: 'image/webp',
        upsert: false
      });

      if (err1) {
        // Fallback to voice-templates bucket which we know exists and is often pre-configured
        const { error: err2 } = await supabase.storage.from('voice-templates').upload(`logos/${fileName}`, compressedBlob, {
          cacheControl: '3600',
          contentType: 'image/webp',
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

      if (madrasah?.id) {
        requestManager.invalidatePattern(`institution:${madrasah.id}`);
        requestManager.invalidatePattern('dashboard_');
      }

      const { error: updateErr } = await supabase.from('institutions').update({ logo_url: publicUrl }).eq('id', madrasah.id);
      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      setMadrasah(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      if (onProfileUpdate) onProfileUpdate();
      setShowSuccessModal({ show: true, title: 'সফল', message: 'লোগো সফলভাবে আপলোড এবং অপ্টিমাইজ করা হয়েছে।' });
    } catch (e: any) { 
      console.error('Upload error:', e);
      alert('Logo upload failed: ' + e.message); 
    } finally { setSaving(false); }
  };

  if (!madrasah) return null;

  const displayName = madrasah?.name || 'User';
  const isTeacher = profile?.role === 'teacher';
  const role = profile?.role || 'teacher';
  const isAdmin = role === 'madrasah_admin' || role === 'super_admin';
  const canSendSMS = isAdmin || !!profile?.permissions?.can_send_sms;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-36 relative z-10">

      <div className="relative pt-12 px-1">
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] sm:rounded-[4rem] p-6 sm:p-10 pt-24 md:pt-32 shadow-bubble border relative text-center`}>
          <div className="absolute inset-0 overflow-hidden rounded-[3rem] sm:rounded-[4rem]">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-[0.03]" />
          </div>
          <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className={`w-32 h-32 sm:w-40 sm:h-40 p-3 sm:p-4 rounded-full shadow-bubble border-[8px] sm:border-[12px] flex items-center justify-center overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-full" alt="Profile" /> : <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><UserIcon size={50} className="sm:w-[70px] sm:h-[70px]" strokeWidth={1.5} /></div>}
              </div>
              {madrasah && madrasah.id !== 'super_admin' && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-9 h-9 sm:w-11 sm:h-11 bg-[#2563EB] text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-premium border-4 border-white active:scale-90 transition-all z-30"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} className="sm:w-5 sm:h-5" />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>
          <div className="space-y-4 mt-2">
             <div className="space-y-1">
               <div className="px-4">
                 <h2 className={`text-[20px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{madrasah?.name || 'User'}</h2>
               </div>
               
               <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-1.5 px-2">
                 {madrasah?.address && (
                   <div className="flex items-center gap-1.5 text-slate-400">
                     <MapPin size={11} className="shrink-0" />
                     <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{madrasah.address}</p>
                   </div>
                 )}
                 {madrasah?.phone && (
                   <div className="flex items-center gap-1.5 text-slate-400">
                     <Smartphone size={11} className="shrink-0" />
                     <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{madrasah.phone}</p>
                   </div>
                 )}
                 {madrasah?.email && (
                   <div className="flex items-center gap-1.5 text-slate-400">
                     <Mail size={11} className="shrink-0" />
                     <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{madrasah.email}</p>
                   </div>
                 )}
               </div>
             </div>
             
             {madrasah && madrasah.id !== 'super_admin' && !isTeacher && (
               <div className="pt-2">
                  {(madrasah.config_json as any)?.institute_code && (
                    <div className={`p-4 rounded-[2rem] border flex items-center justify-center gap-4 inline-flex ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-100 text-amber-600'}`}>
                        <Box size={20} />
                       </div>
                       <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{lang === 'bn' ? 'ইনস্টিটিউট কোড' : 'Institute Code'}</p>
                          <p className={`text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>{(madrasah.config_json as any).institute_code}</p>
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>
      </div>



      {/* Main Options Grid */}
      <div className="grid grid-cols-2 gap-3 mx-1">
        {/* Academic Calendar Card */}
        <ActionCard
          icon={CalendarIcon}
          title={lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
          subtitle={lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
          colorClass="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          onClick={() => setView('academic-calendar')}
          dark={madrasah?.theme === 'dark'}
        />

        {!isTeacher && (
          <>
            <ActionCard
              icon={Edit3}
              title={t('profile_settings', lang)}
              subtitle={t('branding', lang)}
              colorClass="bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400"
              onClick={() => setIsEditingProfile(true)}
              dark={madrasah?.theme === 'dark'}
            />
            
            {modules.academic_year_promotion && (
              <ActionCard
                icon={GraduationCap}
                title={lang === 'bn' ? 'শিক্ষাবর্ষ' : 'Academic Year'}
                subtitle={lang === 'bn' ? 'সেটআপ ও প্রমোশন' : 'Setup & Promotion'}
                colorClass="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                onClick={() => setView('academic-year')}
                dark={madrasah?.theme === 'dark'}
              />
            )}

            {/* Subscription Card */}
            <ActionCard
              icon={CreditCard}
              title={lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
              subtitle={lang === 'bn' ? 'প্যাকেজ ও পেমেন্ট' : 'Plans & Billing'}
              colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              onClick={() => setIsEditingSubscription(true)}
              dark={madrasah?.theme === 'dark'}
            />

            <ActionCard
              icon={Database}
              title={t('backup_restore', lang)}
              subtitle="Excel Tools"
              colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              onClick={() => setView('data-management')}
              dark={madrasah?.theme === 'dark'}
            />


            {/* Teacher Management Card */}
            <ActionCard
              icon={UserCheck}
              title={lang === 'bn' ? 'শিক্ষক ব্যবস্থাপনা' : 'Teacher Management'}
              subtitle={lang === 'bn' ? 'শিক্ষক ও স্টাফ' : 'Teachers & Staff'}
              colorClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              onClick={() => setView('teachers')}
              dark={madrasah?.theme === 'dark'}
            />
          </>
        )}

        {/* Class Routine Card */}
        {modules.class_routine && (
          <ActionCard
            icon={LayoutDashboard}
            title={lang === 'bn' ? 'ক্লাস রুটিন' : 'Class Routine'}
            subtitle={lang === 'bn' ? 'সময়সূচী' : 'Schedule'}
            colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            onClick={() => setView('class-routine')}
            dark={madrasah?.theme === 'dark'}
          />
        )}

        {/* Message Card */}
        {(isAdmin || canSendSMS) && modules.messages && (
          <ActionCard
            icon={MessageCircle}
            title={lang === 'bn' ? 'বার্তা পাঠান' : 'Send Message'}
            subtitle={lang === 'bn' ? 'বার্তা' : 'Messages'}
            colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            onClick={() => setView('messages')}
            dark={madrasah?.theme === 'dark'}
          />
        )}

        {/* ID Cards Card */}
        {modules.id_cards && (
          <ActionCard
            icon={ShieldCheck}
            title={lang === 'bn' ? 'স্টুডেন্ট আইডি কার্ড' : 'Student ID Card'}
            subtitle={lang === 'bn' ? 'জেনারেটর' : 'Generator'}
            colorClass="bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400"
            onClick={() => setView('id-cards')}
            dark={madrasah?.theme === 'dark'}
          />
        )}

        {/* Certificate Card */}
        <ActionCard
          icon={Award}
          title={lang === 'bn' ? 'সার্টিফিকেট' : 'Certificates'}
          subtitle={lang === 'bn' ? 'জেনারেটর' : 'Generator'}
          colorClass="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          onClick={() => setView('certificates')}
          dark={madrasah?.theme === 'dark'}
        />

        {/* Video Tutorial Card */}
        <ActionCard
          icon={Play}
          title={lang === 'bn' ? 'টিউটোরিয়াল' : 'Video Tutorials'}
          subtitle={lang === 'bn' ? 'সহায়তা' : 'Help & Support'}
          colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
          onClick={() => setView('tutorials')}
          dark={madrasah?.theme === 'dark'}
        />

        {/* Change Password Card */}
        <ActionCard
          icon={Key}
          title={lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
          subtitle={lang === 'bn' ? 'নিরাপত্তা' : 'Security'}
          colorClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
          onClick={() => setIsChangingPassword(true)}
          dark={madrasah?.theme === 'dark'}
        />


        {/* Language Card */}
        {!isTeacher && (
          <div className={`col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble flex items-center justify-between gap-2.5 sm:gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 rounded-[0.85rem] sm:rounded-[1rem] flex items-center justify-center shrink-0">
                <Languages className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
              </div>
              <div className="text-left min-w-0 pr-1 sm:pr-2 hidden sm:block">
                <h5 className={`text-[11px] sm:text-[13px] font-black font-noto leading-[1.3] break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{t('language', lang)}</h5>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 break-words whitespace-normal">{t('change_lang', lang)}</p>
              </div>
            </div>
            <div className={`flex p-1 rounded-xl border shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <button 
                onClick={() => setLang('bn')} 
                className={`px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
              >
                বাংলা
              </button>
              <button 
                onClick={() => setLang('en')} 
                className={`px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
              >
                ENG
              </button>
            </div>
          </div>
        )}

        {/* Theme Switcher Card */}
        {!isTeacher && (
          <div className={`col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble flex items-center justify-between gap-3 sm:gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[0.85rem] sm:rounded-[1rem] flex items-center justify-center shrink-0 ${madrasah?.theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400'}`}>
                {madrasah?.theme === 'dark' ? <Moon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} /> : <Sun className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />}
              </div>
              <div className="text-left min-w-0 pr-1 sm:pr-2">
                <h5 className={`text-[11px] sm:text-[13px] font-black font-noto leading-[1.3] break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                  {lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}
                </h5>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 break-words whitespace-normal">
                  {lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}
                </p>
              </div>
            </div>
            <button 
              onClick={toggleTheme}
              className={`w-11 h-6 sm:w-14 sm:h-8 shrink-0 rounded-full p-1 transition-colors relative ${madrasah?.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-white shadow-sm transition-transform ${madrasah?.theme === 'dark' ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        )}

        <button 
          onClick={onLogout} 
          className={`col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble flex items-center justify-between gap-3 sm:gap-4 group active:scale-[0.98] transition-all min-w-0 ${madrasah?.theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[0.85rem] sm:rounded-[1rem] flex items-center justify-center shrink-0 ${madrasah?.theme === 'dark' ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-600'}`}>
              <LogOut className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
            </div>
            <div className="text-left min-w-0 pr-1 sm:pr-2">
              <h5 className={`text-[11px] sm:text-[13px] font-black font-noto leading-[1.3] break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{t('logout', lang)}</h5>
              <p className="text-[9px] sm:text-[10px] font-bold text-red-300 mt-0.5 break-words whitespace-normal">{t('logout_system', lang)}</p>
            </div>
          </div>
          <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${madrasah?.theme === 'dark' ? 'text-red-900/50' : 'text-red-200'}`} />
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

                {/* All Packages */}
                <div className="space-y-3 sm:space-y-4">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {lang === 'bn' ? 'সকল সাবস্ক্রিপশন প্যাকেজ' : 'All Subscription Packages'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {packages.map((pkg) => {
                      const isCurrent = pkg.name === (madrasah?.config_json as any)?.package_name;
                      return (
                        <div
                          key={pkg.id}
                          className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border transition-all relative overflow-hidden flex flex-col ${
                            isCurrent 
                              ? (madrasah?.theme === 'dark' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-blue-50 border-blue-200')
                              : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100')
                          }`}
                        >
                          {isCurrent && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                              Current
                            </div>
                          )}
                          <div className="mb-3">
                            <h4 className={`text-xs sm:text-sm font-black font-noto ${isCurrent ? 'text-blue-600' : (madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]')}`}>{pkg.name}</h4>
                            <p className={`text-[9px] sm:text-[10px] font-bold mt-1 ${isCurrent ? 'text-blue-500/80' : 'text-slate-400'}`}>{pkg.rate.toFixed(2)} ৳ {stats.students <= 200 ? '(Flat)' : '/ Student'}</p>
                          </div>
                          <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-100/10">
                            {pkg.features?.map((f: string, i: number) => (
                              <div key={i} className={`flex items-center gap-2 text-[9px] sm:text-[10px] font-bold ${isCurrent ? 'text-blue-600/70' : 'text-slate-500'}`}>
                                <CheckCircle2 size={10} className={isCurrent ? 'text-blue-500' : 'text-emerald-500'} />
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
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
                 
                 {modules.voice_broadcast && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {lang === 'bn' ? 'ভয়েস সেন্ডার আইডি' : 'Voice Sender ID'}
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. 8801700000000"
                        className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                        value={voiceSenderId || ''} 
                        onChange={(e) => setVoiceSenderId(e.target.value)} 
                      />
                      <p className="text-[9px] font-bold text-slate-400 px-1 mt-0.5">
                        {lang === 'bn' ? 'ভয়েস কলের জন্য অনুমোদিত সেন্ডার আইডি দিন।' : 'Provide approved sender ID for voice calls.'}
                      </p>
                    </div>
                 )}

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

      {isChangingPassword && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
                  </h3>
                </div>
                <button onClick={() => setIsChangingPassword(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={newPassword} 
                     onChange={(e) => setNewPassword(e.target.value)} 
                     placeholder="••••••••"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={confirmPassword} 
                     onChange={(e) => setConfirmPassword(e.target.value)} 
                     placeholder="••••••••"
                   />
                 </div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsChangingPassword(false)} className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                 <button onClick={handleChangePassword} disabled={changingPassword} className="flex-[2] py-4 bg-[#2563EB] text-white font-black rounded-2xl text-[10px] uppercase shadow-premium flex items-center justify-center gap-2">
                   {changingPassword ? <Loader2 className="animate-spin" size={16} /> : (lang === 'bn' ? 'পরিবর্তন করুন' : 'Change')}
                 </button>
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
