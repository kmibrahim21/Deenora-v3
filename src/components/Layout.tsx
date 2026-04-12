
import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock, Calculator, ClipboardList, GraduationCap, Banknote, MessageSquare, Users, Mic, Play, UserCheck } from 'lucide-react';
import { Language, Institution, Transaction, Profile } from 'types';
import { t } from 'translations';
import { supabase } from 'supabase';
import { useOfflineStatus } from '../hooks/useOffline';
import MultiCalendarHeader from './MultiCalendarHeader';
import { useMadrasah } from '../contexts/MadrasahContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

interface AppNotification {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'error' | 'warning';
  time: string;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { madrasah, profile, lang, role, isSuperAdmin } = useMadrasah();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOfflineStatus();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const currentPath = location.pathname;
  
  const canAccess = (module: string) => {
    if (profile?.role === 'super_admin') return true;
    return false;
  };
  
  // Dynamic module configuration
  const modules = React.useMemo(() => {
    console.log('Layout: Recomputing modules, madrasah:', madrasah);
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const configObj: any = (typeof config === 'object' && config !== null) ? config : {};
    
    const result = {
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
    console.log('Layout: Computed modules:', result);
    return result;
  }, [madrasah]) as any;

  const fetchDynamicNotifications = async () => {
    if (!madrasah?.id) return;
    const newNotifications: AppNotification[] = [];
    if (madrasah.sms_balance < 50) {
      newNotifications.push({ id: 'low-bal', title: t('low_balance_title', lang), desc: t('low_balance_msg', lang), type: 'error', time: 'Active' });
    }
    setNotifications(newNotifications);
  };

  useEffect(() => { if (showNotifications) fetchDynamicNotifications(); }, [showNotifications, madrasah?.id]);

  const hasPermission = (perm: keyof NonNullable<Profile['permissions']>) => {
    if (isSuperAdmin || role === 'madrasah_admin') return true;
    return !!profile?.permissions?.[perm];
  };

  const isTabActive = (tab: string) => {
    if (tab === 'home' && currentPath === '/') return true;
    if (tab === 'account' && (currentPath === '/account' || currentPath === '/super-account' || currentPath === '/admin-voice-service' || currentPath === '/admin-tutorials')) return true;
    if (tab === 'list' && currentPath === '/admin-panel') return true;
    if (tab === 'dashboard' && currentPath === '/admin-dashboard') return true;
    if (tab === 'approvals' && currentPath === '/admin-approvals') return true;
    if (tab === 'accounting' && currentPath === '/accounting') return true;
    if (tab === 'attendance' && currentPath === '/attendance') return true;
    if (tab === 'exams' && currentPath === '/exams') return true;
    if (tab === 'wallet' && currentPath === '/wallet-sms') return true;
    if (tab === 'voice-broadcast' && currentPath === '/voice-broadcast') return true;
    if (tab === 'sms-voice-menu' && currentPath === '/sms-voice-menu') return true;
    if (tab === 'teachers' && currentPath === '/teachers') return true;
    if (tab === 'classes' && (currentPath.startsWith('/classes') || currentPath.startsWith('/students'))) return true;
    return false;
  };

  const activeColor = '#2563EB';
  const inactiveColor = '#94A3B8';

  return (
    <div className={`flex flex-col md:flex-row w-full h-full relative overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC]'}`}>
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-72 border-r z-20 shrink-0 transition-all duration-300 ${madrasah?.theme === 'dark' ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-8 flex items-center gap-4 border-b border-inherit">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-premium border overflow-hidden transition-transform hover:scale-105 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
              {isSuperAdmin ? <ShieldCheck size={28} className="text-[#2563EB]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <BookOpen size={28} className="text-[#2563EB]" />)}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${madrasah?.theme === 'dark' ? 'border-[#0F172A]' : 'border-white'} ${isOnline ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'}`}></div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`text-xl font-black leading-tight tracking-tight font-noto line-clamp-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || (madrasah?.institution_type === 'school' ? 'School Portal' : 'Madrasah Portal'))}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5 font-noto opacity-70">
              {role === 'super_admin' ? 'Super Admin' : role === 'teacher' ? 'Teacher' : role === 'accountant' ? 'Accounts' : 'Administrator'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-5 space-y-1.5 custom-scrollbar">
          {isSuperAdmin ? (
            <>
              {canAccess('dashboard') && (
                <button onClick={() => navigate('/admin-dashboard')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('dashboard') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <BarChart3 size={22} strokeWidth={isTabActive('dashboard') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{t('dashboard', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {canAccess('institutions') && (
                <button onClick={() => navigate('/admin-panel')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('list') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <Users size={22} strokeWidth={isTabActive('list') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'}</span>
                </button>
              )}
              {canAccess('approvals') && (
                <button onClick={() => navigate('/admin-approvals')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('approvals') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <CreditCard size={22} strokeWidth={isTabActive('approvals') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{t('approvals', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {isSuperAdmin && (
                <>
                  <button onClick={() => navigate('/sms-voice-menu')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                    <MessageSquare size={22} strokeWidth={isTabActive('sms-voice-menu') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black font-noto uppercase tracking-wider">{t('sms_voice', lang)}</span>
                  </button>
                </>
              )}
              <button onClick={() => navigate(isSuperAdmin ? '/super-account' : '/account')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black font-noto uppercase tracking-wider">{t('account', lang, madrasah?.institution_type)}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('home') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                <Home size={22} strokeWidth={isTabActive('home') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black font-noto uppercase tracking-wider">{t('home', lang, madrasah?.institution_type)}</span>
              </button>
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_students')) && (
                <button onClick={() => navigate('/classes')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('classes') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <BookOpen size={22} strokeWidth={isTabActive('classes') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{t('menu_students', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_send_sms') || hasPermission('can_use_voice_call')) && (modules.modules.sms !== false || modules.modules.voice_broadcast) && (
                <button 
                  onClick={() => {
                    if (modules.modules.sms !== false && modules.modules.voice_broadcast) {
                      navigate('/sms-voice-menu');
                    } else if (modules.modules.sms !== false) {
                      navigate('/wallet-sms');
                    } else if (modules.modules.voice_broadcast) {
                      navigate('/voice-broadcast');
                    }
                  }} 
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}
                >
                  <MessageSquare size={22} strokeWidth={isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">
                    {modules.modules.sms !== false && modules.modules.voice_broadcast ? t('sms_voice', lang) : modules.modules.sms !== false ? t('sms', lang) : t('voice', lang)}
                  </span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_attendance')) && modules.modules.attendance && (
                <button onClick={() => navigate('/attendance')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('attendance') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <ClipboardList size={22} strokeWidth={isTabActive('attendance') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{t('menu_attendance', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_accounting')) && modules.modules.accounting && (role === 'madrasah_admin' || role === 'accountant' || hasPermission('can_manage_accounting')) && (
                <button onClick={() => navigate('/accounting')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('accounting') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <Banknote size={22} strokeWidth={isTabActive('accounting') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{t('menu_accounting', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_results') || hasPermission('can_manage_exams')) && modules.modules.results && (
                <button onClick={() => navigate('/exams')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('exams') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                  <GraduationCap size={22} strokeWidth={isTabActive('exams') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black font-noto uppercase tracking-wider">{t('menu_exams', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              <button onClick={() => navigate('/account')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}`}>
                <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black font-noto uppercase tracking-wider">{t('account', lang, madrasah?.institution_type)}</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 w-full h-full relative overflow-hidden">
        {/* Mobile Header */}
        <header className={`md:hidden flex-none px-6 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 flex items-center justify-between relative z-10 ${madrasah?.theme === 'dark' ? 'bg-[#0F172A]/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl border-b`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-premium border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
                {isSuperAdmin ? <ShieldCheck size={26} className="text-[#2563EB]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <BookOpen size={24} className="text-[#2563EB]" />)}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${madrasah?.theme === 'dark' ? 'border-[#0F172A]' : 'border-white'} ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={`text-[17px] font-black leading-tight tracking-tight font-noto line-clamp-1 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || (madrasah?.institution_type === 'school' ? 'School Portal' : 'Madrasah Portal'))}
              </h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto opacity-70">
                {role === 'super_admin' ? 'Super Admin' : role === 'teacher' ? 'Teacher' : role === 'accountant' ? 'Accounts' : 'Administrator'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => setShowNotifications(true)} className={`relative p-2.5 rounded-2xl active:scale-95 border shadow-soft transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-white text-[#2563EB] border-slate-200'}`}>
              <Bell size={20} />
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
          </div>
        </header>

        {/* Desktop Top Bar */}
        <header className={`hidden md:flex flex-none h-20 px-10 items-center justify-between relative z-10 border-b ${madrasah?.theme === 'dark' ? 'bg-[#0F172A]/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl`}>
          <div className="flex-1">
             {/* Optional: Add breadcrumbs or page title here in the future */}
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => setShowNotifications(true)} className={`relative p-3 rounded-2xl active:scale-95 border shadow-soft transition-all hover:shadow-md ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-[#2563EB] border-slate-200 hover:bg-slate-50'}`}>
              <Bell size={22} />
              {notifications.length > 0 && <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button onClick={() => window.location.reload()} className={`p-3 rounded-2xl active:scale-95 transition-all border shadow-soft hover:shadow-md ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              <RefreshCw size={22} />
            </button>
          </div>
        </header>

        {(currentPath === '/' || currentPath === '/admin-dashboard') && <MultiCalendarHeader madrasah={madrasah} />}

        <main className="flex-1 overflow-y-auto px-5 md:px-10 pt-6 pb-44 md:pb-10 w-full scroll-smooth custom-scrollbar">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <div className="fixed md:hidden bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-[200]">
        <nav className={`backdrop-blur-[30px] border flex justify-around items-center py-4 px-2 rounded-[2rem] shadow-bubble ${madrasah?.theme === 'dark' ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>

          {isSuperAdmin ? (
            <>
              {canAccess('dashboard') && (
                <button onClick={() => navigate('/admin-dashboard')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('dashboard') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <BarChart3 size={22} strokeWidth={isTabActive('dashboard') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('dashboard', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {canAccess('institutions') && (
                <button onClick={() => navigate('/admin-panel')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('list') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <Users size={22} strokeWidth={isTabActive('list') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'}</span>
                </button>
              )}
              {canAccess('approvals') && (
                <button onClick={() => navigate('/admin-approvals')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('approvals') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <CreditCard size={22} strokeWidth={isTabActive('approvals') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('approvals', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {isSuperAdmin && (
                <>
                  <button onClick={() => navigate('/sms-voice-menu')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                    <MessageSquare size={22} strokeWidth={isTabActive('sms-voice-menu') ? 2.5 : 2} />
                    <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{lang === 'bn' ? 'এসএমএস' : 'SMS'}</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={() => navigate('/')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('home') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                <Home size={22} strokeWidth={isTabActive('home') ? 3 : 2} />
                <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('home', lang, madrasah?.institution_type)}</span>
              </button>
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_students')) && (
                <button onClick={() => navigate('/classes')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('classes') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-[#94A3B8]')}`}>
                  <BookOpen size={22} strokeWidth={isTabActive('classes') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('menu_students', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_send_sms') || hasPermission('can_use_voice_call')) && (modules.modules.sms !== false || modules.modules.voice_broadcast) && (
                <div className="relative flex-1 flex justify-center">
                  <button 
                    onClick={() => {
                      if (modules.modules.sms !== false && modules.modules.voice_broadcast) {
                        navigate('/sms-voice-menu');
                      } else if (modules.modules.sms !== false) {
                        navigate('/wallet-sms');
                      } else if (modules.modules.voice_broadcast) {
                        navigate('/voice-broadcast');
                      }
                    }} 
                    className={`relative flex flex-col items-center gap-1.5 transition-all w-full ${isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-[#94A3B8]')}`}
                  >
                    <MessageSquare size={22} strokeWidth={isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? 2.5 : 2} />
                    <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90 whitespace-nowrap">
                      {modules.modules.sms !== false && modules.modules.voice_broadcast ? t('sms_voice', lang) : modules.modules.sms !== false ? t('sms', lang) : t('voice', lang)}
                    </span>
                  </button>
                </div>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_attendance')) && modules.modules.attendance && (
                <button onClick={() => navigate('/attendance')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('attendance') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-[#94A3B8]')}`}>
                  <ClipboardList size={22} strokeWidth={isTabActive('attendance') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('menu_attendance', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_accounting')) && modules.modules.accounting && (role === 'madrasah_admin' || role === 'accountant' || hasPermission('can_manage_accounting')) && (
                <button onClick={() => navigate('/accounting')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('accounting') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-[#94A3B8]')}`}>
                  <Banknote size={22} strokeWidth={isTabActive('accounting') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('menu_accounting', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_results') || hasPermission('can_manage_exams')) && modules.modules.results && (
                <button onClick={() => navigate('/exams')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('exams') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-[#94A3B8]')}`}>
                  <GraduationCap size={22} strokeWidth={isTabActive('exams') ? 2.5 : 2} />
                  <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('menu_exams', lang, madrasah?.institution_type)}</span>
                </button>
              )}
            </>
          )}
          
          <button onClick={() => navigate(isSuperAdmin ? '/super-account' : '/account')} className={`relative flex flex-col items-center gap-1.5 transition-all flex-1 ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
            <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} />
            <span className="text-[10px] font-black font-noto uppercase tracking-wider opacity-90">{t('account', lang, madrasah?.institution_type)}</span>
          </button>

        </nav>
      </div>

      </div>

      {showNotifications && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-start justify-center p-4 pt-12">
           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[3rem] shadow-2xl border overflow-hidden flex flex-col max-h-[80vh]`}>
              <div className={`p-6 border-b flex items-center justify-between shrink-0 ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                 <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#2E0B5E]'}`}>{t('notifications', lang)}</h3>
                 <button onClick={() => setShowNotifications(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                 {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className={`p-4 rounded-2xl border flex gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                       <div className="min-w-0 flex-1">
                          <h4 className={`text-[13px] font-black truncate ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#2E0B5E]'}`}>{n.title}</h4>
                          <p className={`text-[11px] font-bold font-noto leading-relaxed ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{n.desc}</p>
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

export default Layout;
