
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, PhoneCall, X, MessageCircle, Phone, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy, Zap, Mic } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Student, Language, Institution } from 'types';
import { t } from 'translations';
import StudentRiskAnalysis from 'components/StudentRiskAnalysis';
import AttendanceAnalyticsDashboard from 'components/AttendanceAnalyticsDashboard';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import SmartResultAnalytics from 'components/SmartResultAnalytics';
import { isValidUUID } from 'utils/validation';
import { CacheService } from 'services/cacheService';
import { getTodayDateString, getTodayMonthString } from 'utils/calendarUtils';
import { requestManager, CACHE_TTLS } from 'services/RequestManager';

interface HomeProps {
  onStudentClick: (student: Student) => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  institutionId?: string;
  madrasah: Institution | null;
  profile?: any;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToExams?: () => void;
  onNavigateToClasses?: () => void;
  onNavigateToTeachers?: () => void;
  onNavigateToVoiceBroadcast?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToCertificates?: () => void;
}

const Home: React.FC<HomeProps> = ({ onStudentClick, lang, dataVersion, triggerRefresh, institutionId, madrasah, profile, onNavigateToWallet, onNavigateToAccounting, onNavigateToAttendance, onNavigateToExams, onNavigateToClasses, onNavigateToTeachers, onNavigateToVoiceBroadcast, onNavigateToMessages, onNavigateToCertificates }) => {
  const role = profile?.role || 'teacher';
  const isAdmin = role === 'madrasah_admin' || role === 'super_admin';
  const canSendSMS = isAdmin || !!profile?.permissions?.can_send_sms;
  const canUseVoice = isAdmin || !!profile?.permissions?.can_use_voice_call;
  const canManageStudents = isAdmin || !!profile?.permissions?.can_manage_students;
  const canManageAttendance = isAdmin || !!profile?.permissions?.can_manage_attendance;
  const canManageAccounting = isAdmin || !!profile?.permissions?.can_manage_accounting;
  const canManageExams = isAdmin || !!profile?.permissions?.can_manage_exams || !!profile?.permissions?.can_manage_results;
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalTeachers: 0,
    smsBalance: 0,
    voiceBalance: 0,
    attendanceToday: 0,
    totalIncome: 0,
    totalExpense: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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
      modules: {
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
      },
      result_engine: configObj.result_engine || 'school',
      result_system: configObj.result_system || 'grading',
      attendance_type: configObj.attendance_type || 'daily',
      fee_structure: configObj.fee_structure || 'monthly',
      ui_mode: configObj.ui_mode || 'madrasah'
    } as any;
  }, [madrasah]) as any;

  const activeYearId = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    return config?.active_academic_year_id;
  }, [madrasah]);

  const [isRevalidating, setIsRevalidating] = useState(false);

  const fetchDashboardStats = async (isBackground = false) => {
    if (!isValidUUID(institutionId)) {
      setLoadingStats(false);
      return;
    }
    if (!isBackground) setLoadingStats(true);
    else setIsRevalidating(true);

    try {
      if (!navigator.onLine && !isBackground) {
        const cachedStats = await CacheService.getCachedData('stats', institutionId);
        if (cachedStats && cachedStats.length > 0) {
          setStats(cachedStats[0]);
          setLoadingStats(false);
          return;
        }
      }

      const today = getTodayDateString();
      const currentMonth = getTodayMonthString();
      const allowedClasses = profile?.permissions?.allowed_classes;
      const isTeacher = role === 'teacher';

      // 1. Students Count (Cached)
      const stdProm = requestManager.cachedFetch(
        'students',
        (q) => {
          let query = q.select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
          if (activeYearId) {
            query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
          }
          if (isTeacher && allowedClasses?.length) query = query.in('class_id', allowedClasses);
          return query;
        },
        `dashboard_students:${institutionId}:${activeYearId || 'all'}`,
        CACHE_TTLS.LONG
      );

      // 2. Classes Count (Cached)
      const clsProm = requestManager.cachedFetch(
        'classes',
        (q) => {
          let query = q.select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
          if (isTeacher && allowedClasses?.length) query = query.in('id', allowedClasses);
          return query;
        },
        `dashboard_classes:${institutionId}`,
        CACHE_TTLS.LONG
      );

      // 3. Teachers Count (Cached)
      const teacherProm = requestManager.cachedFetch(
        'teachers',
        (q) => q.select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
        `dashboard_teachers:${institutionId}`,
        CACHE_TTLS.LONG
      );

      // 4. Institution Balance (Always fetch fresh for UI responsiveness)
      const instProm = requestManager.cachedFetch(
        'institutions',
        (q) => q.select('sms_balance, balance').eq('id', institutionId),
        `dashboard_balance:${institutionId}`,
        0
      );

      // 5. Ledger (Current Month)
      const ledgerProm = requestManager.cachedFetch(
        'ledger',
        (q) => {
          let query = q.select('type, amount').eq('institution_id', institutionId).gte('transaction_date', currentMonth + '-01');
          if (activeYearId) query = query.eq('academic_year_id', activeYearId);
          return query;
        },
        `dashboard_ledger:${institutionId}:${activeYearId || 'all'}`,
        CACHE_TTLS.MEDIUM
      );

      // 6. Attendance Today (Optimized with RPC to count unique students)
      const attProm = modules.modules.attendance 
        ? requestManager.cachedRpc(
            'get_today_attendance_count',
            {
              p_institution_id: institutionId,
              p_date: today,
              p_academic_year_id: activeYearId,
              p_allowed_classes: isTeacher && allowedClasses?.length ? allowedClasses : null
            },
            CACHE_TTLS.SHORT
          )
        : Promise.resolve({ data: 0 });

      const [stdRes, clsRes, teacherRes, mRes, ledgerRes, attRes] = await Promise.all([
        stdProm, clsProm, teacherProm, instProm, ledgerProm, attProm
      ]);

      const income = Array.isArray(ledgerRes.data) 
        ? ledgerRes.data.filter((e: any) => e.type === 'income').reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) 
        : 0;
      const expense = Array.isArray(ledgerRes.data) 
        ? ledgerRes.data.filter((e: any) => e.type === 'expense').reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) 
        : 0;

      const singleInst = Array.isArray(mRes.data) ? mRes.data[0] : mRes.data;

      const newStats = {
        totalStudents: stdRes.count || 0,
        totalClasses: clsRes.count || 0,
        totalTeachers: teacherRes.count || 0,
        smsBalance: singleInst?.sms_balance || 0,
        voiceBalance: singleInst?.balance || 0,
        attendanceToday: Number(attRes.data) || 0,
        totalIncome: income,
        totalExpense: expense
      };

      setStats(newStats);
      await CacheService.cacheData('stats', institutionId, newStats);
    } catch (e: any) {
      console.error("Dashboard Stats Error:", e);
    } finally {
      setLoadingStats(false);
      setIsRevalidating(false);
    }
  };

  useEffect(() => { 
    if (institutionId && madrasah) {
      fetchDashboardStats();

      // Only subscribe to critical updates to prevent "Data Storms"
      // We limit re-validation frequency to at most once every 30 seconds for non-critical stats
      let lastRevalidate = 0;
      const THROTTLE = 30000;

      const throttledRefresh = () => {
        const now = Date.now();
        if (now - lastRevalidate > THROTTLE) {
          lastRevalidate = now;
          fetchDashboardStats(true);
        }
      };

      const keysToWatch = [
        { table: 'institutions', key: `dashboard_balance:${institutionId}` },
        { table: 'ledger', key: `dashboard_ledger:${institutionId}:${activeYearId || 'all'}` },
        { table: 'attendance', key: `dashboard_attendance:${institutionId}:${getTodayDateString()}` }
      ];

      const unsubscribers = keysToWatch.map(cfg => 
        requestManager.subscribe(`fetch:${cfg.table}:${cfg.key}`, throttledRefresh)
      );

      return () => unsubscribers.forEach(unsub => unsub());
    }
  }, [dataVersion, institutionId, madrasah?.id, activeYearId]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-6 px-1">

        {canManageStudents && (
          <button onClick={onNavigateToClasses} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Users size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.totalStudents}</h4>
             <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">শিক্ষার্থী</p>
          </button>
        )}
        {canManageStudents && (
          <button onClick={onNavigateToClasses} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><BookOpen size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.totalClasses}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>শ্রেনী</p>
          </button>
        )}
        <button onClick={onNavigateToTeachers} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-100 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><UserIcon size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.totalTeachers}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>শিক্ষক</p>
        </button>
        {canSendSMS && (
          <button onClick={onNavigateToWallet} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-150 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Zap size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.smsBalance}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>এসএমএস</p>
          </button>
        )}
        {canUseVoice && modules.modules.voice_broadcast && (
          <button onClick={onNavigateToVoiceBroadcast} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-175 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Mic size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : (stats.voiceBalance || 0).toFixed(2)}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>ভয়েস</p>
          </button>
        )}
        {canManageAttendance && modules.modules.attendance && (
          <button onClick={onNavigateToAttendance} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-200 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><CheckCircle2 size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.attendanceToday}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>আজকের হাজিরা</p>
          </button>
        )}
        {canManageAccounting && modules.modules.accounting && (
          <button onClick={onNavigateToAccounting} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-225 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><TrendingUp size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-emerald-600'}`}>{loadingStats ? '...' : stats.totalIncome.toLocaleString()}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>চলতি মাসের আয়</p>
          </button>
        )}
        {canManageAccounting && modules.modules.accounting && (
          <button onClick={onNavigateToAccounting} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-250 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><TrendingUp size={20} className="lg:w-6 lg:h-6" style={{ transform: 'rotate(180deg)' }} /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-red-600'}`}>{loadingStats ? '...' : stats.totalExpense.toLocaleString()}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>চলতি মাসের ব্যয়</p>
          </button>
        )}
      </div>

      {institutionId && (
        <div className="space-y-10 lg:space-y-12">
          {/* Accounting Section */}
          {canManageAccounting && modules.modules.accounting && (
            <div className="px-1 space-y-4">
               <div className="flex items-center gap-3 px-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                  <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    হিসাব রিপোর্ট
                  </h2>
               </div>
               <SmartFeeAnalytics 
                 institutionId={institutionId} 
                 lang={lang} 
                 month={new Date().toISOString().slice(0, 7)}
                 madrasah={madrasah}
                 role={role}
                 profile={profile}
               />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-6 lg:gap-8">
            {/* Attendance Section */}
            {canManageAttendance && modules.modules.attendance && (
              <div className="space-y-6 lg:space-y-8 xl:col-span-7">
                <div className="px-1 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-3">
                       <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                       <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                         ঝুঁকি বিশ্লেষণ
                       </h2>
                    </div>
                    <StudentRiskAnalysis 
                      institutionId={institutionId} 
                      lang={lang} 
                      onStudentClick={onStudentClick} 
                      madrasah={madrasah}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-3">
                       <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                       <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                         হাজিরা অ্যানালিটিক্স
                       </h2>
                    </div>
                    <AttendanceAnalyticsDashboard 
                      institutionId={institutionId} 
                      lang={lang} 
                      madrasah={madrasah}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Result Section */}
            <div className="space-y-6 lg:space-y-8 xl:col-span-5">
              {canManageExams && modules.modules.results && (
                <div className="px-1 space-y-4">
                   <div className="flex items-center gap-3 px-3">
                      <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
                      <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        রেজাল্ট রিপোর্ট
                      </h2>
                   </div>
                   <SmartResultAnalytics 
                     institutionId={institutionId} 
                     lang={lang} 
                     madrasah={madrasah}
                   />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
