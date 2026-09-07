
import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock, Calculator, ClipboardList, GraduationCap, Banknote, MessageSquare, Users, Mic, Play, UserCheck, Building2, MessageCircle, Library, LayoutDashboard, FileText, Radio, Heart } from 'lucide-react';
import { View, Language, Institution, Transaction, Profile } from 'types';
import { t } from 'translations';
import { supabase } from 'supabase';
import { hardReload } from 'utils/reloadUtils';
import { hasAdmissionFormAccess } from 'utils/packageUtils';
import { useOfflineStatus } from '../hooks/useOffline';
import MultiCalendarHeader from './MultiCalendarHeader';

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

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, profile }) => {
  const isOnline = useOfflineStatus();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = profile?.role === 'manager';
  const isSystemStaff = isSuperAdmin || isManager;
  const role = profile?.role || 'teacher';
  
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
        library: configObj.modules?.library ?? false,
        academic_year_promotion: configObj.modules?.academic_year_promotion ?? false,
        voice_broadcast: configObj.modules?.voice_broadcast ?? true,
        sms: configObj.modules?.sms ?? true,
        messages: configObj.modules?.messages ?? true,
        class_routine: configObj.modules?.class_routine ?? false,
        certificates: configObj.modules?.certificates ?? true,
        id_cards: configObj.modules?.id_cards ?? false,
        exam_routine: configObj.modules?.exam_routine ?? true,
        donations: configObj.modules?.donations === true,
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

  const canAccess = (module: string) => {
    if (isSuperAdmin) return true;
    
    // For managers, check their specific permissions for system views
    if (isManager) {
      if (module === 'dashboard') return profile?.permissions?.dashboard !== false;
      if (module === 'institutions') return profile?.permissions?.institutions !== false;
      if (module === 'approvals') return profile?.permissions?.approvals !== false;
      if (module === 'tutorials') return profile?.permissions?.tutorials !== false;
      if (module === 'voice-service' || module === 'voice_dashboard') return true;
    }
    
    // For regular admins, check module permissions
    const moduleMap: Record<string, boolean> = {
      'dashboard': true,
      'attendance': modules.modules.attendance,
      'exams': modules.modules.results,
      'accounting': modules.modules.accounting,
      'library': modules.modules.library,
      'sms-voice-menu': modules.modules.sms || modules.modules.voice_broadcast,
      'teachers': true,
      'classes': true,
      'students': true,
      'settings': true,
      'academic-year': true,
      'class-routine': modules.modules.class_routine,
      'certificates': modules.modules.certificates,
      'donations': modules.modules.donations
    };

    return moduleMap[module] ?? true;
  };

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
    if (isSuperAdmin || role === 'madrasah_admin' || role === 'manager') return true;
    return !!profile?.permissions?.[perm];
  };

  const isTabActive = (tab: string) => {
    if (tab === 'home' && currentView === 'home') return true;
    if (tab === 'account' && (currentView === 'account' || currentView === 'teacheraccount' || currentView === 'super-account' || currentView === 'admin-tutorials' || currentView === 'tutorials' || currentView === 'academic-documents' || currentView === 'academic-calendar')) return true;
    if (tab === 'voice-service' && currentView === 'admin-voice-service') return true;
    if (tab === 'list' && (currentView === 'admin-panel' || currentView === 'admin-institutions')) return true;
    if (tab === 'institutions' && currentView === 'admin-institutions') return true;
    if (tab === 'dashboard' && currentView === 'admin-dashboard') return true;
    if (tab === 'approvals' && currentView === 'admin-approvals') return true;
    if (tab === 'accounting' && currentView === 'accounting') return true;
    if (tab === 'donations' && currentView === 'donations') return true;
    if (tab === 'attendance' && currentView === 'attendance') return true;
    if (tab === 'exams' && currentView === 'exams') return true;
    if (tab === 'wallet' && currentView === 'wallet-sms') return true;
    if (tab === 'voice-broadcast' && currentView === 'voice-broadcast') return true;
    if (tab === 'sms-voice-menu' && currentView === 'sms-voice-menu') return true;
    if (tab === 'teachers' && currentView === 'teachers') return true;
    if (tab === 'classes' && (currentView === 'classes' || currentView === 'students' || currentView === 'student-details' || currentView === 'student-form')) return true;
    if (tab === 'certificates' && currentView === 'certificates') return true;
    if (tab === 'admission-form' && currentView === 'admission-form') return true;
    if (tab === 'library' && currentView === 'library') return true;
    if (tab === 'class-routine' && currentView === 'class-routine') return true;
    if (tab === 'id-cards' && currentView === 'id-cards') return true;
    if (tab === 'messages' && currentView === 'messages') return true;
    if (tab === 'data-management' && currentView === 'data-management') return true;
    if (tab === 'academic-year' && currentView === 'academic-year') return true;
    return false;
  };

  const activeColor = '#2563EB';
  const inactiveColor = '#94A3B8';

  return (
    <div className={`flex flex-col md:flex-row w-full h-full relative overflow-hidden ${(role === 'parent' || madrasah?.theme === 'dark') ? 'bg-[#0F172A] text-white' : 'bg-[#EBF5FF]'}`}>
      
      {/* Desktop Sidebar */}
      {role !== 'parent' && (
        <aside className={`hidden md:flex flex-col w-72 border-r z-20 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-blue-100'}`}>
          <div className="p-6 flex items-center gap-4 border-b border-inherit">
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              {isSuperAdmin ? <ShieldCheck size={24} className="text-[#2563EB]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <BookOpen size={24} className="text-[#2563EB]" />)}
            </div>
            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${madrasah?.theme === 'dark' ? 'border-slate-900' : 'border-white'} ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`text-lg font-black leading-tight tracking-tight font-noto line-clamp-3 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
              {isSystemStaff ? (lang === 'bn' ? (isSuperAdmin ? 'সুপার অ্যাডমিন' : 'ম্যানেজার') : (isSuperAdmin ? 'Super Admin' : 'Manager')) : (madrasah?.name || (madrasah?.institution_type === 'school' ? 'Deenora' : 'Deenora'))}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto">
              {role === 'super_admin' ? 'Super Admin Portal' : role === 'manager' ? 'Manager Portal' : role === 'teacher' ? 'Teacher Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {isSystemStaff ? (
            <>
              {canAccess('dashboard') && (
                <button onClick={() => setView('admin-dashboard')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('dashboard') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <BarChart3 size={22} strokeWidth={isTabActive('dashboard') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('dashboard', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {canAccess('institutions') && (
                <button onClick={() => setView('admin-panel')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('list') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Users size={22} strokeWidth={isTabActive('list') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'}</span>
                </button>
              )}
              {canAccess('approvals') && (
                <button onClick={() => setView('admin-approvals')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('approvals') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <CreditCard size={22} strokeWidth={isTabActive('approvals') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('approvals', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {isSystemStaff && (
                <>
                  <button onClick={() => setView('sms-voice-menu')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                    <MessageSquare size={22} strokeWidth={isTabActive('sms-voice-menu') ? 2.5 : 2} />
                    <span className="text-sm font-bold font-noto">{t('sms_voice', lang)}</span>
                  </button>
                  {(isSuperAdmin || canAccess('voice-service')) && (
                    <button onClick={() => setView('admin-voice-service')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('voice-service') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                      <Radio size={22} strokeWidth={isTabActive('voice-service') ? 2.5 : 2} />
                      <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'ভয়েস গেটওয়ে' : 'Voice Gateway'}</span>
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setView(isSuperAdmin ? 'super-account' : (role === 'teacher' ? 'teacheraccount' : 'account'))} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{t('account', lang, madrasah?.institution_type)}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setView('home')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('home') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <Home size={22} strokeWidth={isTabActive('home') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{t('home', lang, madrasah?.institution_type)}</span>
              </button>
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_students')) && (
                <button onClick={() => setView('classes')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('classes') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <BookOpen size={22} strokeWidth={isTabActive('classes') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('menu_students', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_send_sms') || hasPermission('can_use_voice_call')) && (modules.modules.sms !== false || modules.modules.voice_broadcast) && (
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
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}
                >
                  <MessageSquare size={22} strokeWidth={isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">
                    {modules.modules.sms !== false && modules.modules.voice_broadcast ? t('sms_voice', lang) : modules.modules.sms !== false ? t('sms', lang) : t('voice', lang)}
                  </span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_attendance')) && modules.modules.attendance && (
                <button onClick={() => setView('attendance')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('attendance') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <ClipboardList size={22} strokeWidth={isTabActive('attendance') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('menu_attendance', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_accounting')) && modules.modules.accounting && (role === 'madrasah_admin' || role === 'accountant' || hasPermission('can_manage_accounting')) && (
                <button onClick={() => setView('accounting')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('accounting') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Banknote size={22} strokeWidth={isTabActive('accounting') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('menu_accounting', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_accounting')) && modules.modules.donations && (
                <button onClick={() => setView('donations')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('donations') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Heart size={22} strokeWidth={isTabActive('donations') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'দান ও অনুদান' : 'Donations'}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin') && modules.modules.library && (
                <button onClick={() => setView('library')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('library') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Library size={22} strokeWidth={isTabActive('library') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'লাইব্রেরী' : 'Library'}</span>
                </button>
              )}
              {modules.modules.messages && (isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_send_messages')) && (
                <button onClick={() => setView('messages')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('messages') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <MessageCircle size={22} strokeWidth={isTabActive('messages') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">বার্তা</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_results') || hasPermission('can_manage_exams')) && modules.modules.results && (
                <button onClick={() => setView('exams')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('exams') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <GraduationCap size={22} strokeWidth={isTabActive('exams') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('menu_exams', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_students')) && hasAdmissionFormAccess(madrasah, isSuperAdmin) && (
                <button onClick={() => setView('admission-form')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('admission-form') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <FileText size={22} strokeWidth={isTabActive('admission-form') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'ভর্তি ফরম' : 'Admission Form'}</span>
                </button>
              )}
              <button onClick={() => setView(role === 'teacher' ? 'teacheraccount' : 'account')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{t('account', lang, madrasah?.institution_type)}</span>
              </button>
            </>
          )}
        </nav>
      </aside>
      )}

      <div className="flex flex-col flex-1 w-full h-full relative overflow-hidden">
        {/* Mobile Header */}
        {role !== 'parent' && (
          <header className={`md:hidden flex-none px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 flex items-center justify-between relative z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-[#EBF5FF]/80 border-blue-100'} backdrop-blur-md border-b`}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {isSystemStaff ? <ShieldCheck size={24} className="text-[#2563EB]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <BookOpen size={22} className="text-[#2563EB]" />)}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${madrasah?.theme === 'dark' ? 'border-slate-900' : 'border-white'} ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={`text-[16px] font-black leading-[1.2] tracking-tight font-noto line-clamp-3 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
                {isSystemStaff ? (lang === 'bn' ? (isSuperAdmin ? 'সুপার অ্যাডমিন' : 'ম্যানেজার') : (isSuperAdmin ? 'Super Admin' : 'Manager')) : (madrasah?.name || (madrasah?.institution_type === 'school' ? 'Deenora' : 'Deenora'))}
              </h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto">
                {role === 'super_admin' ? 'Super Admin Portal' : role === 'manager' ? 'Manager Portal' : role === 'teacher' ? 'Teacher Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications(true)} className={`relative p-2.5 rounded-[1rem] active:scale-95 border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-slate-50 text-[#2563EB] border-slate-100'}`}>
              <Bell size={18} />
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button onClick={hardReload} className={`p-2.5 rounded-[1rem] active:scale-95 transition-all border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              <RefreshCw size={18} />
            </button>
          </div>
        </header>
        )}

        {/* Desktop Top Bar */}
        {role !== 'parent' && (
          <header className={`hidden md:flex flex-none h-20 px-8 items-center justify-between relative z-10 border-b ${madrasah?.theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-[#EBF5FF]/80 border-blue-100'} backdrop-blur-md`}>
            <div className="flex-1">
             {/* Optional: Add breadcrumbs or page title here in the future */}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowNotifications(true)} className={`relative p-3 rounded-xl active:scale-95 border shadow-sm transition-all hover:shadow-md ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-[#2563EB] border-slate-100 hover:bg-slate-100'}`}>
              <Bell size={20} />
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button onClick={hardReload} className={`p-3 rounded-xl active:scale-95 transition-all border shadow-sm hover:shadow-md ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
              <RefreshCw size={20} />
            </button>
          </div>
        </header>
        )}

        {(currentView === 'home' || currentView === 'admin-dashboard') && role !== 'parent' && <MultiCalendarHeader madrasah={madrasah} />}

        <main className={`flex-1 overflow-y-auto w-full scroll-smooth custom-scrollbar ${role === 'parent' ? 'p-0' : 'px-5 md:px-8 pt-4 pb-44 md:pb-8'}`}>
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        {role !== 'parent' && (
          <div className="fixed md:hidden bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-lg z-[200]">
            <nav className={`backdrop-blur-[25px] border py-2.5 rounded-[2.5rem] shadow-2xl flex justify-around items-end px-2 overflow-visible relative gap-1 ${madrasah?.theme === 'dark' ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>

          {isSystemStaff ? (
            <>
              {canAccess('dashboard') && (
                <button 
                  onClick={() => setView('admin-dashboard')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('dashboard') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <BarChart3 size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {t('dashboard', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <BarChart3 size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('dashboard', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {canAccess('institutions') && (
                <button 
                  onClick={() => setView('admin-panel')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('list') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <Users size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <Users size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {canAccess('approvals') && (
                <button 
                  onClick={() => setView('admin-approvals')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('approvals') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <CreditCard size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {t('approvals', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <CreditCard size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('approvals', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {isSystemStaff && (
                <>
                  <button 
                    onClick={() => setView('sms-voice-menu')} 
                    className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                  >
                    {isTabActive('sms-voice-menu') ? (
                      <div className="flex flex-col items-center">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                          madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                        }`}>
                          <MessageSquare size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                        </div>
                        <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                          {lang === 'bn' ? 'এসএমএস' : 'SMS'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <MessageSquare size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                        </div>
                        <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {lang === 'bn' ? 'এসএমএস' : 'SMS'}
                        </span>
                      </div>
                    )}
                  </button>

                  {(isSuperAdmin || canAccess('voice-service')) && (
                    <button 
                      onClick={() => setView('admin-voice-service')} 
                      className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                    >
                      {isTabActive('voice-service') ? (
                        <div className="flex flex-col items-center">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                            madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                          }`}>
                            <Radio size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                          </div>
                          <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                            {lang === 'bn' ? 'ভয়েস' : 'Voice'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <Radio size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                          </div>
                          <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {lang === 'bn' ? 'ভয়েস' : 'Voice'}
                          </span>
                        </div>
                      )}
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Home */}
              <button 
                onClick={() => setView('home')} 
                className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
              >
                {isTabActive('home') ? (
                  <div className="flex flex-col items-center">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                      madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                    }`}>
                      <Home size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                    </div>
                    <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                      {t('home', lang, madrasah?.institution_type)}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-8 h-8 flex items-center justify-center">
                      <Home size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                    </div>
                    <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t('home', lang, madrasah?.institution_type)}
                    </span>
                  </div>
                )}
              </button>

              {/* Students / Classes */}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_students')) && (
                <button 
                  onClick={() => setView('classes')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('classes') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <BookOpen size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {t('menu_students', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <BookOpen size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('menu_students', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {/* SMS & Voice */}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_send_sms') || hasPermission('can_use_voice_call')) && (modules.modules.sms !== false || modules.modules.voice_broadcast) && (
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
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <MessageSquare size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {modules.modules.sms !== false && modules.modules.voice_broadcast ? t('sms_voice', lang) : modules.modules.sms !== false ? t('sms', lang) : t('voice', lang)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <MessageSquare size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {modules.modules.sms !== false && modules.modules.voice_broadcast ? t('sms_voice', lang) : modules.modules.sms !== false ? t('sms', lang) : t('voice', lang)}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {/* Attendance */}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_attendance')) && modules.modules.attendance && (
                <button 
                  onClick={() => setView('attendance')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('attendance') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <ClipboardList size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {t('menu_attendance', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <ClipboardList size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('menu_attendance', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {/* Accounting */}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_accounting')) && modules.modules.accounting && (role === 'madrasah_admin' || role === 'accountant' || hasPermission('can_manage_accounting')) && (
                <button 
                  onClick={() => setView('accounting')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('accounting') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <Banknote size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {t('menu_accounting', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <Banknote size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('menu_accounting', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {/* Library */}
              {(isSuperAdmin || role === 'madrasah_admin') && modules.modules.library && (
                <button 
                  onClick={() => setView('library')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('library') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <Library size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {lang === 'bn' ? 'লাইব্রেরী' : 'Library'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <Library size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {lang === 'bn' ? 'লাইব্রেরী' : 'Library'}
                      </span>
                    </div>
                  )}
                </button>
              )}

              {/* Exams */}
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_results') || hasPermission('can_manage_exams')) && modules.modules.results && (
                <button 
                  onClick={() => setView('exams')} 
                  className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
                >
                  {isTabActive('exams') ? (
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                        madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                      }`}>
                        <GraduationCap size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                      </div>
                      <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                        {t('menu_exams', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <GraduationCap size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('menu_exams', lang, madrasah?.institution_type)}
                      </span>
                    </div>
                  )}
                </button>
              )}
            </>
          )}
          
          {/* Account */}
          <button 
            onClick={() => setView(isSystemStaff ? 'super-account' : (role === 'teacher' ? 'teacheraccount' : 'account'))} 
            className="relative flex flex-col items-center justify-end flex-1 min-w-[44px] cursor-pointer group py-0.5"
          >
            {isTabActive('account') ? (
              <div className="flex flex-col items-center">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                  madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-4 ring-white'
                }`}>
                  <User size={21} strokeWidth={2.5} className="animate-in zoom-in-75 duration-200" />
                </div>
                <span className={`text-[9.5px] font-black font-noto tracking-tight whitespace-nowrap ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                  {t('account', lang, madrasah?.institution_type)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-8 h-8 flex items-center justify-center">
                  <User size={20} strokeWidth={1.8} className={madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} />
                </div>
                <span className={`text-[9.5px] font-bold font-noto tracking-tight whitespace-nowrap opacity-80 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('account', lang, madrasah?.institution_type)}
                </span>
              </div>
            )}
          </button>

        </nav>
      </div>
      )}

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
