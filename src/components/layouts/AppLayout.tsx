import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock, Calculator, ClipboardList, GraduationCap, Banknote, MessageSquare, Users, Mic } from 'lucide-react';
import { View, Language, Institution, Transaction, Profile } from 'types';
import { t } from 'translations';
import { supabase } from 'supabase';
import MultiCalendarHeader from '../MultiCalendarHeader';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  setView: (view: View) => void;
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
}

interface AppNotification {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'error' | 'warning';
  time: string;
}

const AppLayout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, profile }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isSuperAdmin = profile?.role === 'super_admin';
  const role = profile?.role || 'madrasah_admin';
  
  const canAccess = (module: string) => {
    if (profile?.role !== 'super_admin') return true;
    if (!profile.permissions) return true;
    return profile.permissions[module as keyof typeof profile.permissions] !== false;
  };
  
  const modules = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    const configObj: any = (typeof config === 'object' && config !== null) ? config : {};
    
    return {
      modules: {
        attendance: configObj.modules?.attendance ?? true,
        results: configObj.modules?.results ?? true,
        admit_card: configObj.modules?.admit_card ?? true,
        seat_plan: configObj.modules?.seat_plan ?? true,
        accounting: configObj.modules?.accounting ?? true,
        academic_year_promotion: configObj.modules?.academic_year_promotion ?? false,
        voice_broadcast: configObj.modules?.voice_broadcast ?? true,
        sms: configObj.modules?.sms ?? true,
      },
      result_engine: configObj.result_engine || 'school',
      result_system: configObj.result_system || 'grading',
      attendance_type: configObj.attendance_type || 'daily',
      fee_structure: configObj.fee_structure || 'monthly',
      ui_mode: configObj.ui_mode || 'madrasah'
    } as any;
  }, [madrasah]);

  const fetchDynamicNotifications = async () => {
    if (!madrasah?.id) return;
    const newNotifications: AppNotification[] = [];
    if (madrasah.sms_balance < 50) {
      newNotifications.push({ id: 'low-bal', title: t('low_balance_title', lang), desc: t('low_balance_msg', lang), type: 'error', time: 'Active' });
    }
    setNotifications(newNotifications);
  };

  useEffect(() => { if (showNotifications) fetchDynamicNotifications(); }, [showNotifications, madrasah?.id]);

  const isTabActive = (tab: string) => {
    if (tab === 'home' && currentView === 'home') return true;
    if (tab === 'account' && currentView === 'account') return true;
    if (tab === 'list' && currentView === 'admin-panel') return true;
    if (tab === 'dashboard' && currentView === 'admin-dashboard') return true;
    if (tab === 'approvals' && currentView === 'admin-approvals') return true;
    if (tab === 'accounting' && currentView === 'accounting') return true;
    if (tab === 'attendance' && currentView === 'attendance') return true;
    if (tab === 'exams' && currentView === 'exams') return true;
    if (tab === 'wallet' && currentView === 'wallet-sms') return true;
    if (tab === 'voice-broadcast' && currentView === 'voice-broadcast') return true;
    if (tab === 'sms-voice-menu' && currentView === 'sms-voice-menu') return true;
    if (tab === 'classes' && (currentView === 'classes' || currentView === 'students' || currentView === 'student-details' || currentView === 'student-form')) return true;
    return false;
  };

  return (
    <div className={`flex flex-col w-full h-full relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white'}`}>
      <header className={`flex-none px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 flex items-center justify-between relative z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100'} backdrop-blur-md border-b`}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm border shrink-0 overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
            {isSuperAdmin ? <ShieldCheck size={24} className="text-[#2563EB]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <BookOpen size={22} className="text-[#2563EB]" />)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`text-[16px] font-black leading-[1.2] tracking-tight font-noto line-clamp-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || (madrasah?.institution_type === 'school' ? 'School Portal' : 'Madrasah Portal'))}
            </h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto">
              {role === 'super_admin' ? 'Super Admin Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotifications(true)} className={`relative p-2.5 rounded-[1rem] active:scale-95 border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
            <Bell size={18} />
            {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
          </button>
          <button onClick={() => window.location.reload()} className={`p-2.5 rounded-[1rem] active:scale-95 transition-all border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {(currentView === 'home' || currentView === 'admin-dashboard') && <MultiCalendarHeader madrasah={madrasah} />}

      <main className="flex-1 overflow-y-auto px-5 pt-4 pb-44 w-full max-w-md mx-auto scroll-smooth custom-scrollbar">
        {children}
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[200]">
        <nav className={`backdrop-blur-[25px] border flex justify-around items-center py-4 px-1 rounded-[2.5rem] shadow-bubble ${madrasah?.theme === 'dark' ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}>

          {isSuperAdmin ? (
            <>
              {canAccess('results') && (
                <button onClick={() => setView('admin-dashboard')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('dashboard') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                  <BarChart3 size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('dashboard', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {canAccess('accounting') && (
                <button onClick={() => setView('admin-panel')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('list') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                  <Users size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'}</span>
                </button>
              )}
              {canAccess('fees') && (
                <button onClick={() => setView('admin-approvals')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('approvals') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                  <CreditCard size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('approvals', lang, madrasah?.institution_type)}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setView('home')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('home') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                <Home size={20} strokeWidth={isTabActive('home') ? 3 : 2} />
                <span className="text-[9px] font-black font-noto opacity-80">{t('home', lang, madrasah?.institution_type)}</span>
              </button>
              {modules.modules.attendance && (
                <button onClick={() => setView('attendance')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('attendance') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                  <ClipboardList size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('menu_attendance', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {modules.modules.results && (
                <button onClick={() => setView('exams')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('exams') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                  <GraduationCap size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('menu_exams', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {modules.modules.accounting && (role === 'madrasah_admin' || role === 'accountant') && (
                <button onClick={() => setView('accounting')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('accounting') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                  <Banknote size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('menu_accounting', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              <button onClick={() => setView('classes')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('classes') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                <BookOpen size={20} />
                <span className="text-[9px] font-black font-noto opacity-80">{t('menu_students', lang, madrasah?.institution_type)}</span>
              </button>
              {(modules.modules.sms !== false || modules.modules.voice_broadcast) && (
                <div className="relative flex-1 flex justify-center">
                  <button 
                    onClick={() => {
                      if (modules.modules.sms !== false && modules.modules.voice_broadcast) {
                        setView('sms-voice-menu');
                      } else if (modules.modules.sms !== false) {
                        setView('wallet-sms');
                      } else if (modules.modules.voice_broadcast) {
                        setView('voice-broadcast');
                      }
                    }} 
                    className={`relative flex flex-col items-center gap-1 transition-all w-full ${isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}
                  >
                    <MessageSquare size={20} />
                    <span className="text-[9px] font-black font-noto opacity-80 whitespace-nowrap">
                      {modules.modules.sms !== false && modules.modules.voice_broadcast ? 'SMS & Voice' : modules.modules.sms !== false ? 'SMS' : 'Voice'}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
          
          <button onClick={() => setView('account')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('account') ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
            <User size={20} />
            <span className="text-[9px] font-black font-noto opacity-80">{t('account', lang, madrasah?.institution_type)}</span>
          </button>

        </nav>
      </div>

      {showNotifications && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-start justify-center p-4 pt-12">
           <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                 <h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('notifications', lang)}</h3>
                 <button onClick={() => setShowNotifications(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                 {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-4">
                       <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                       <div className="min-w-0 flex-1">
                          <h4 className="text-[13px] font-black text-[#2E0B5E] truncate">{n.title}</h4>
                          <p className="text-[11px] font-bold text-slate-500 font-noto leading-relaxed">{n.desc}</p>
                       </div>
                    </div>
                 )) : <div className="py-12 text-center text-slate-400 text-xs font-black uppercase">No Alerts</div>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
