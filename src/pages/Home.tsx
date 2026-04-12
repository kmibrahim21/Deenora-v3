
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy, Zap, Mic } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Student, Language, Institution } from 'types';
import { t } from 'translations';
import StudentRiskAnalysis from 'components/StudentRiskAnalysis';
import AttendanceAnalyticsDashboard from 'components/AttendanceAnalyticsDashboard';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import SmartResultAnalytics from 'components/SmartResultAnalytics';
import { isValidUUID } from 'utils/validation';
import { CacheService } from 'services/cacheService';
import { useMadrasah } from '../contexts/MadrasahContext';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const { madrasah, profile, lang, triggerRefresh, dataVersion, role, isAdmin } = useMadrasah();
  const navigate = useNavigate();
  const institutionId = madrasah?.id;
  const [fetchError, setFetchError] = useState<string | null>(null);
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
        voice_broadcast: configObj.modules?.voice_broadcast ?? true,
        sms: configObj.modules?.sms ?? true,
      },
      result_engine: configObj.result_engine || 'school',
      result_system: configObj.result_system || 'grading',
      attendance_type: configObj.attendance_type || 'daily',
      fee_structure: configObj.fee_structure || 'monthly',
      ui_mode: configObj.ui_mode || 'madrasah'
    } as any;
  }, [madrasah]) as any;

  const fetchDashboardStats = async () => {
    console.log("Fetching dashboard stats for institution:", institutionId);
    if (!isValidUUID(institutionId)) {
      console.warn("Invalid institutionId for dashboard stats:", institutionId);
      return;
    }
    setLoadingStats(true);
    try {
      if (!navigator.onLine) {
        const cachedStats = await CacheService.getCachedData('stats', institutionId);
        if (cachedStats && cachedStats.length > 0) {
          setStats(cachedStats[0]);
          setLoadingStats(false);
          return;
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const allowedClasses = profile?.permissions?.allowed_classes;
      const isTeacher = role === 'teacher';
      const activeYearId = madrasah?.config_json?.active_academic_year_id;

      let studentQuery = supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
      let classQuery = supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
      let attendanceQuery = supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('date', today).eq('status', 'present');

      if (activeYearId) {
        studentQuery = studentQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
        attendanceQuery = attendanceQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      if (isTeacher && allowedClasses && allowedClasses.length > 0) {
        studentQuery = studentQuery.in('class_id', allowedClasses);
        classQuery = classQuery.in('id', allowedClasses);
        attendanceQuery = attendanceQuery.in('class_id', allowedClasses);
      }

      const promises: any[] = [
        studentQuery,
        classQuery,
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
        supabase.from('institutions').select('sms_balance, balance').eq('id', institutionId).maybeSingle(),
        supabase.from('ledger').select('type, amount').eq('institution_id', institutionId).gte('transaction_date', new Date().toISOString().slice(0, 7) + '-01')
      ];

      if (modules.modules.attendance) {
        promises.push(attendanceQuery);
      } else {
        promises.push(Promise.resolve({ count: 0 }));
      }

      const [stdRes, clsRes, teacherRes, mRes, ledgerRes, attRes] = await Promise.all(promises);

      const income = ledgerRes.data?.filter((e: any) => e.type === 'income').reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) || 0;
      const expense = ledgerRes.data?.filter((e: any) => e.type === 'expense').reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) || 0;

      const newStats = {
        totalStudents: stdRes.count || 0,
        totalClasses: clsRes.count || 0,
        totalTeachers: teacherRes.count || 0,
        smsBalance: mRes.data?.sms_balance || 0,
        voiceBalance: mRes.data?.balance || 0,
        attendanceToday: attRes.count || 0,
        totalIncome: income,
        totalExpense: expense
      };

      setStats(newStats);
      
      // Cache stats
      await CacheService.cacheData('stats', institutionId, newStats);
    } catch (e: any) {
      console.error("Dashboard Stats Error:", e);
      // Fallback to cache if network fails
      if (e.message?.includes('fetch') || e.name === 'TypeError' || !navigator.onLine) {
        const cachedStats = await CacheService.getCachedData('stats', institutionId);
        if (cachedStats && cachedStats.length > 0) {
          setStats(cachedStats[0]);
        }
      }
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { 
    fetchDashboardStats();
  }, [dataVersion, institutionId, modules.modules.attendance]);

  const handleStudentClick = useCallback((s: any) => {
    navigate(`/students/${s.id}`);
  }, [navigate]);

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-500 pb-20 lg:pb-8">
      {/* Greeting Section */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl lg:text-3xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'আস-সালামু আলাইকুম' : 'Assalamu Alaikum'}, {profile?.full_name?.split(' ')[0] || (lang === 'bn' ? 'ইউজার' : 'User')}
            </h1>
            <p className="text-xs lg:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
              {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
              <Clock size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5 lg:gap-6 px-1">

        {canManageStudents && (
          <button onClick={() => navigate('/classes')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 active:scale-95 transition-all group border-transparent hover:border-purple-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><Users size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.totalStudents}</h4>
             <p className="text-[11px] lg:text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 lg:mt-3">শিক্ষার্থী</p>
          </button>
        )}
        {canManageStudents && (
          <button onClick={() => navigate('/classes')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75 active:scale-95 transition-all group border-transparent hover:border-blue-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><BookOpen size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.totalClasses}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>শ্রেনী</p>
          </button>
        )}
        <button onClick={() => navigate('/teachers')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-100 active:scale-95 transition-all group border-transparent hover:border-green-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><UserIcon size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.totalTeachers}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>শিক্ষক</p>
        </button>
        {canSendSMS && (
          <button onClick={() => navigate('/wallet-sms')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-150 active:scale-95 transition-all group border-transparent hover:border-amber-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><Zap size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.smsBalance}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>এসএমএস</p>
          </button>
        )}
        {canUseVoice && modules.modules.voice_broadcast && (
          <button onClick={() => navigate('/voice-broadcast')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-175 active:scale-95 transition-all group border-transparent hover:border-purple-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><Mic size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.voiceBalance.toFixed(2)}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>ভয়েস</p>
          </button>
        )}
        {canManageAttendance && modules.modules.attendance && (
          <button onClick={() => navigate('/attendance')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-200 active:scale-95 transition-all group border-transparent hover:border-emerald-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><CheckCircle2 size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{loadingStats ? '...' : stats.attendanceToday}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>আজকের হাজিরা</p>
          </button>
        )}
        {canManageAccounting && modules.modules.accounting && (
          <button onClick={() => navigate('/accounting')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-225 active:scale-95 transition-all group border-transparent hover:border-emerald-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><TrendingUp size={28} className="lg:w-8 lg:h-8" /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-emerald-600'}`}>{loadingStats ? '...' : stats.totalIncome.toLocaleString()}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>চলতি মাসের আয়</p>
          </button>
        )}
        {canManageAccounting && modules.modules.accounting && (
          <button onClick={() => navigate('/accounting')} className="glass-card p-6 lg:p-7 flex flex-col items-center text-center animate-in zoom-in duration-300 delay-250 active:scale-95 transition-all group border-transparent hover:border-red-500/20">
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 lg:mb-5 shadow-premium group-hover:scale-110 transition-transform"><TrendingUp size={28} className="lg:w-8 lg:h-8" style={{ transform: 'rotate(180deg)' }} /></div>
             <h4 className={`text-2xl lg:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-red-600'}`}>{loadingStats ? '...' : stats.totalExpense.toLocaleString()}</h4>
             <p className={`text-[11px] lg:text-[13px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-[0.2em] mt-2 lg:mt-3`}>চলতি মাসের ব্যয়</p>
          </button>
        )}
      </div>

      {institutionId && (
        <div className="space-y-12 lg:space-y-16">
          {/* Accounting Section */}
          {canManageAccounting && modules.modules.accounting && (
            <div className="px-1 space-y-4">
               <div className="section-header">
                  <div className="section-header-dot bg-blue-600"></div>
                  <h2 className="section-title">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-8 lg:gap-10">
            {/* Attendance Section */}
            {canManageAttendance && modules.modules.attendance && (
              <div className="space-y-8 lg:space-y-10 xl:col-span-7">
                <div className="px-1 space-y-10">
                  <div className="space-y-4">
                    <div className="section-header">
                       <div className="section-header-dot bg-emerald-600"></div>
                       <h2 className="section-title">
                         ঝুঁকি বিশ্লেষণ
                       </h2>
                    </div>
                    <StudentRiskAnalysis 
                      institutionId={institutionId} 
                      lang={lang} 
                      onStudentClick={handleStudentClick} 
                      madrasah={madrasah}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="section-header">
                       <div className="section-header-dot bg-blue-600"></div>
                       <h2 className="section-title">
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
            <div className="space-y-8 lg:space-y-10 xl:col-span-5">
              {canManageExams && modules.modules.results && (
                <div className="px-1 space-y-4">
                   <div className="section-header">
                      <div className="section-header-dot bg-purple-600"></div>
                      <h2 className="section-title">
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
