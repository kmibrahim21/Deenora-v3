
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Loader2, User as UserIcon, ShieldCheck, ChevronRight, Smartphone, Save, Sliders, CreditCard, LayoutDashboard, X, Play, Mic, Moon, Sun, Languages, Globe, CheckCircle2 } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View } from 'types';
import { t } from 'translations';

interface SuperAccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  setView: (view: View) => void;
  onLogout: () => void;
  onProfileUpdate?: () => void;
  initialMadrasah: Institution | null;
}

const SuperAccount: React.FC<SuperAccountProps> = ({ lang, setLang, setView, onLogout, onProfileUpdate, initialMadrasah }) => {
  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingBulkSMS, setIsEditingBulkSMS] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });

  const [globalSettings, setGlobalSettings] = useState({
    reve_api_key: '',
    reve_secret_key: '',
    reve_caller_id: '',
    bkash_number: '',
    sms_rate: 0.50,
    voice_rate: 1.00
  });

  useEffect(() => {
    fetchGlobalSettings();
  }, []);

  const fetchGlobalSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    setGlobalSettings({
      reve_api_key: settings.reve_api_key,
      reve_secret_key: settings.reve_secret_key,
      reve_caller_id: settings.reve_caller_id,
      bkash_number: settings.bkash_number,
      sms_rate: settings.sms_rate || 0.50,
      voice_rate: settings.voice_rate || 1.00
    });
  };

  const handleSaveBulkSMS = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('system_settings').update({
        reve_api_key: (globalSettings.reve_api_key || '').trim(),
        reve_secret_key: (globalSettings.reve_secret_key || '').trim(),
        sms_rate: Number(globalSettings.sms_rate),
        voice_rate: Number(globalSettings.voice_rate)
      }).eq('id', '00000000-0000-0000-0000-000000000001');
      if (error) throw error;
      setIsEditingBulkSMS(false);
      setShowSuccessModal({ show: true, title: 'Bulk SMS আপডেট', message: 'Bulk SMS ও রেট সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('system_settings').update({
        bkash_number: (globalSettings.bkash_number || '').trim()
      }).eq('id', '00000000-0000-0000-0000-000000000001');
      if (error) throw error;
      setIsEditingPayment(false);
      setShowSuccessModal({ show: true, title: 'পেমেন্ট আপডেট', message: 'পেমেন্ট সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const toggleTheme = async () => {
    const currentTheme = madrasah?.theme || localStorage.getItem('super_admin_theme') || 'default';
    const newTheme = currentTheme === 'dark' ? 'default' : 'dark';
    localStorage.setItem('super_admin_theme', newTheme);
    setMadrasah(prev => prev ? { ...prev, theme: newTheme } : { id: 'super_admin', name: 'Super Admin', theme: newTheme } as any);
    if (onProfileUpdate) onProfileUpdate();
  };

  const displayName = lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin';

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
                <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><UserIcon size={70} strokeWidth={1.5} /></div>
              </div>
            </div>
          </div>
          <div className="space-y-6 mt-4">
             <div className="space-y-1">
               <div className="px-4 pb-3">
                 <h2 className={`text-[22px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{displayName}</h2>
               </div>
               <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">System Controller</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-1">
        <button 
          onClick={() => setView('admin-tutorials')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'টিউটোরিয়াল ম্যানেজ' : 'Manage Tutorials'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Video Guides</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-voice-service')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Mic size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ভয়েস ড্যাশবোর্ড' : 'Voice Dashboard'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Service Control</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingBulkSMS(true)} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sliders size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'রেট ম্যানেজমেন্ট' : 'Rates Management'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">SMS & Voice Rates</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingBulkSMS(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Bulk SMS</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Master Gateway</p>
          </div>
        </button>
        
        <button 
          onClick={() => setIsEditingPayment(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CreditCard size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Master Payment</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{globalSettings.bkash_number || 'N/A'}</p>
          </div>
        </button>

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
            <button onClick={() => setLang('bn')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>ENG</button>
          </div>
        </div>

        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-blue-50 text-[#2563EB]'}`}>
              {madrasah?.theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}</p>
            </div>
          </div>
          <button onClick={toggleTheme} className={`w-14 h-8 rounded-full relative transition-all duration-300 ${madrasah?.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${madrasah?.theme === 'dark' ? 'left-7' : 'left-1'}`} />
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

      {isEditingBulkSMS && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}><LayoutDashboard size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Bulk SMS</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Master Gateway</p></div>
                    </div>
                    <button onClick={() => setIsEditingBulkSMS(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Gateway Protocols</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Master API Key</label><input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} /></div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Encryption Token</label><input type="password" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} /></div>
                    </div>
                 </div>
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Service Rates (Per Unit)</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Bulk SMS Rate (TK)</label><input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.sms_rate} onChange={(e) => setGlobalSettings({...globalSettings, sms_rate: parseFloat(e.target.value)})} /></div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Voice Call Rate (TK)</label><input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.voice_rate} onChange={(e) => setGlobalSettings({...globalSettings, voice_rate: parseFloat(e.target.value)})} /></div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button onClick={handleSaveBulkSMS} disabled={saving} className="relative w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]">
                       {saving ? <Loader2 className="animate-spin" size={22} /> : <>Save Settings</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {isEditingPayment && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400 border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><CreditCard size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Master Payment</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Global Gateway</p></div>
                    </div>
                    <button onClick={() => setIsEditingPayment(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Global Identities</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Master Payment Number</label><input type="text" className={`w-full h-11 rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/50'}`} value={globalSettings.bkash_number} onChange={(e) => setGlobalSettings({...globalSettings, bkash_number: e.target.value})} /></div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button onClick={handleSavePayment} disabled={saving} className="relative w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]">
                       {saving ? <Loader2 className="animate-spin" size={22} /> : <>Save Settings</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showSuccessModal.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-500 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
            <div className="space-y-1"><h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{showSuccessModal.title}</h3><p className="text-slate-400 font-bold text-sm">{showSuccessModal.message}</p></div>
            <button onClick={() => setShowSuccessModal({ ...showSuccessModal, show: false })} className="w-full py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium active:scale-95 transition-all">ঠিক আছে</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SuperAccount;
