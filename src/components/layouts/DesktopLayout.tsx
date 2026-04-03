import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock, Calculator, ClipboardList, GraduationCap, Banknote, MessageSquare, Users, Mic, LogOut, Menu, UserCheck } from 'lucide-react';
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

const DesktopLayout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, profile }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isSuperAdmin = profile?.role === 'super_admin';
  const role = profile?.role || 'madrasah_admin';
  
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

  const hasPermission = (perm: keyof NonNullable<Profile['permissions']>) => {
    if (isSuperAdmin || role === 'madrasah_admin') return true;
    return !!profile?.permissions?.[perm];
  };

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
    if (tab === 'teachers' && currentView === 'teachers') return true;
    return false;
  };

  const NavItem = ({ icon: Icon, label, tab, onClick }: any) => (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isTabActive(tab) ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      <Icon size={20} strokeWidth={isTabActive(tab) ? 2.5 : 2} />
      <span className="text-sm font-noto">{label}</span>
    </button>
  );

  const getViewTitle = (view: string) => {
    const titles: Record<string, string> = {
      'home': t('home', lang, madrasah?.institution_type),
      'classes': t('classes', lang, madrasah?.institution_type),
      'account': t('account', lang, madrasah?.institution_type),
      'wallet': t('wallet', lang, madrasah?.institution_type),
      'admin-dashboard': 'Admin Dashboard',
      'data-management': 'Data Management',
      'accounting': t('accounting', lang, madrasah?.institution_type) || 'Accounting',
      'attendance': t('attendance', lang, madrasah?.institution_type) || 'Attendance',
      'exams': t('exams', lang, madrasah?.institution_type) || 'Exams',
      'results': t('exam_results', lang, madrasah?.institution_type) || 'Results',
      'voice-broadcast': 'Voice Broadcast',
      'sms-voice-menu': 'SMS & Voice',
      'academic-calendar': 'Academic Calendar',
      'tutorials': 'Tutorials',
      'student-details': t('student_info', lang, madrasah?.institution_type) || 'Student Details',
      'student-form': t('add_student', lang, madrasah?.institution_type) || 'Add Student',
      'teachers': lang === 'bn' ? 'শিক্ষক/স্টাফ' : 'Teachers & Staff',
    };
    return titles[view] || view.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`flex w-full h-screen overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white'}`}>
      {/* Sidebar */}
      <aside className={`w-64 flex-none flex flex-col border-r ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border shrink-0 overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
            {isSuperAdmin ? <ShieldCheck size={22} className="text-[#2563EB]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <BookOpen size={20} className="text-[#2563EB]" />)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`text-sm font-black leading-tight tracking-tight font-noto truncate ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || (madrasah?.institution_type === 'school' ? 'School Portal' : 'Madrasah Portal'))}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-noto">
              {role === 'super_admin' ? 'Super Admin Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {isSuperAdmin ? (
            <>
              <NavItem icon={BarChart3} label={t('dashboard', lang, madrasah?.institution_type)} tab="dashboard" onClick={() => setView('admin-dashboard')} />
              <NavItem icon={Users} label={lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institutions'} tab="list" onClick={() => setView('admin-panel')} />
              <NavItem icon={CreditCard} label={t('approvals', lang, madrasah?.institution_type)} tab="approvals" onClick={() => setView('admin-approvals')} />
            </>
          ) : (
            <>
              <NavItem icon={Home} label={t('home', lang, madrasah?.institution_type)} tab="home" onClick={() => setView('home')} />
              
              {modules.modules.attendance && (role !== 'teacher' || hasPermission('can_manage_attendance')) && (
                <NavItem icon={ClipboardList} label={t('menu_attendance', lang, madrasah?.institution_type)} tab="attendance" onClick={() => setView('attendance')} />
              )}
              
              {modules.modules.results && (role !== 'teacher' || hasPermission('can_manage_results')) && (
                <NavItem icon={GraduationCap} label={t('menu_exams', lang, madrasah?.institution_type)} tab="exams" onClick={() => setView('exams')} />
              )}
              
              {modules.modules.accounting && (role === 'madrasah_admin' || role === 'accountant' || (role === 'teacher' && hasPermission('can_manage_accounting'))) && (
                <NavItem icon={Banknote} label={t('menu_accounting', lang, madrasah?.institution_type)} tab="accounting" onClick={() => setView('accounting')} />
              )}
              
              {(role !== 'teacher' || hasPermission('can_manage_students') || hasPermission('can_manage_classes')) && (
                <NavItem icon={BookOpen} label={t('menu_students', lang, madrasah?.institution_type)} tab="classes" onClick={() => setView('classes')} />
              )}
              
              {(isSuperAdmin || role === 'madrasah_admin' || hasPermission('can_manage_teachers')) && (
                <NavItem icon={UserCheck} label={lang === 'bn' ? 'শিক্ষক/স্টাফ' : 'Teachers'} tab="teachers" onClick={() => setView('teachers')} />
              )}
              
              {(modules.modules.sms !== false || modules.modules.voice_broadcast) && 
               (role !== 'teacher' || hasPermission('can_send_sms') || hasPermission('can_send_free_sms') || hasPermission('can_use_voice_call')) && (
                <NavItem 
                  icon={MessageSquare} 
                  label={modules.modules.sms !== false && modules.modules.voice_broadcast ? 'SMS & Voice' : modules.modules.sms !== false ? 'SMS' : 'Voice'} 
                  tab="sms-voice-menu" 
                  onClick={() => {
                    if (modules.modules.sms !== false && modules.modules.voice_broadcast) {
                      setView('sms-voice-menu');
                    } else if (modules.modules.sms !== false) {
                      setView('wallet-sms');
                    } else if (modules.modules.voice_broadcast) {
                      setView('voice-broadcast');
                    }
                  }} 
                />
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <NavItem icon={User} label={t('account', lang, madrasah?.institution_type)} tab="account" onClick={() => setView('account')} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className={`flex-none h-16 px-8 flex items-center justify-between border-b ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex-1">
            <h2 className={`text-lg font-bold font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              {getViewTitle(currentView)}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNotifications(true)} className={`relative p-2.5 rounded-xl transition-all border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <Bell size={18} />
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button onClick={() => window.location.reload()} className={`p-2.5 rounded-xl transition-all border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {(currentView === 'home' || currentView === 'admin-dashboard') && <MultiCalendarHeader madrasah={madrasah} />}

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <h3 className="text-lg font-bold text-slate-900 font-noto">{t('notifications', lang)}</h3>
                 <button onClick={() => setShowNotifications(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X size={20} /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                 {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex gap-4">
                       <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shrink-0"><AlertTriangle size={20} /></div>
                       <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{n.title}</h4>
                          <p className="text-xs text-slate-600 font-noto mt-1">{n.desc}</p>
                       </div>
                    </div>
                 )) : <div className="py-12 text-center text-slate-500 text-sm font-medium">No Alerts</div>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DesktopLayout;
