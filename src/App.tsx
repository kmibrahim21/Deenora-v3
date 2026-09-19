import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { OfflineService } from "services/OfflineService";
import { useSyncEngine } from "hooks/useOffline";
import { useAndroidBackHandler } from "hooks/useAndroidBackHandler";
import { OfflineIndicator } from "components/OfflineIndicator";
import { useAuth } from "hooks/useAuth";
import { hardReload } from "utils/reloadUtils";
import { hasAdmissionFormAccess } from "utils/packageUtils";
import Layout from "components/Layout";
import { View, Class, Student, Language } from "types";
import { t } from "translations";
import {
  BookOpen,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  RefreshCw
} from "lucide-react";
import { AcademicYearSetupRequired } from "components/AcademicYearSetupRequired";
import { useGlobalUpdate } from "hooks/useGlobalUpdate";
import { useGlobalNotifications } from "hooks/useGlobalNotifications";
import { requestManager } from "services/RequestManager";
import { useVoiceCall } from "context/CallContext";

const Auth = React.lazy(() => import("pages/Auth"));
const Home = React.lazy(() => import("pages/Home"));
const Classes = React.lazy(() => import("pages/Classes"));
const Students = React.lazy(() => import("pages/Students"));
const StudentDetails = React.lazy(() => import("pages/StudentDetails"));
const StudentForm = React.lazy(() => import("pages/StudentForm"));
const Account = React.lazy(() => import("pages/Account"));
const TeacherAccount = React.lazy(() => import("pages/TeacherAccount"));
const SuperAccount = React.lazy(() => import("pages/SuperAccount"));
const AdminPanel = React.lazy(() => import("pages/AdminPanel"));
const WalletSMS = React.lazy(() => import("pages/WalletSMS"));
const TeacherManagement = React.lazy(() => import("pages/TeacherManagement"));
const DataManagement = React.lazy(() => import("pages/DataManagement"));
const AcademicYearManager = React.lazy(() => import("components/AcademicYearManager").then(module => ({ default: module.AcademicYearManager })));
const Accounting = React.lazy(() => import("pages/Accounting"));
const Attendance = React.lazy(() => import("pages/Attendance"));
const Exams = React.lazy(() => import("pages/Exams"));
const FinalResults = React.lazy(() => import("pages/FinalResults"));
const VoiceBroadcast = React.lazy(() => import("pages/VoiceBroadcast"));
const SmsVoiceMenu = React.lazy(() => import("pages/SmsVoiceMenu"));
const MessagesPattern = React.lazy(() => import("pages/Messages"));
const LibraryPattern = React.lazy(() => import("pages/Library"));
const AcademicCalendarPage = React.lazy(
  () => import("pages/AcademicCalendarPage"),
);
const AcademicDocuments = React.lazy(() => import("pages/AcademicDocuments"));
const Donations = React.lazy(() => import("pages/Donations"));
const Tutorials = React.lazy(() => import("pages/Tutorials"));
const ClassRoutine = React.lazy(() => import("pages/ClassRoutine"));
const Certificates = React.lazy(() => import("pages/Certificates"));
const IdCards = React.lazy(() => import("pages/IdCards"));
const ProfileSettings = React.lazy(() => import("pages/ProfileSettings"));
const ChatApp = React.lazy(() => import("pages/ChatApp").then(m => ({ default: m.ChatApp })));
const VoiceServiceDashboard = React.lazy(() =>
  import("components/VoiceServiceDashboard").then((module) => ({
    default: module.VoiceServiceDashboard,
  })),
);
const TutorialsManager = React.lazy(() =>
  import("components/TutorialsManager").then((module) => ({
    default: module.TutorialsManager,
  })),
);
const AdmissionFormPage = React.lazy(() => import("components/admission_form/AdmissionFormPage"));
const ParentPortal = React.lazy(() => import("pages/ParentPortal"));

const App: React.FC = () => {
  useSyncEngine();
  const {
    session,
    profile,
    madrasah,
    activeYear,
    loading,
    authError,
    handleLogout,
    refreshMadrasah,
  } = useAuth();
  const [view, setView] = useState<View>("home");
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);
  useAndroidBackHandler(view, setView);
  const [walletTab, setWalletTab] = useState<
    "templates" | "bulk-sms" | "history" | "recharge"
  >("bulk-sms");
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [preSelectedStudentIds, setPreSelectedStudentIds] = useState<string[]>([]);
  const [preSelectedInstitutionIds, setPreSelectedInstitutionIds] = useState<string[]>([]);
  const [preSelectedMessage, setPreSelectedMessage] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [lang, setLang] = useState<Language>(
    () => (localStorage.getItem("app_lang") as Language) || "bn",
  );
  const [statusModal, setStatusModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  const { config: globalUpdate, showPopup: showUpdatePopup, dismissPopup: dismissUpdatePopup } = useGlobalUpdate();

  // Move useMemo to top level to avoid hook ordering issues
  const parsedConfig = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    return config || {};
  }, [madrasah?.config_json]);

  const isTrialExpired = React.useMemo(() => {
    if (madrasah && !madrasah.is_super_admin && madrasah.status === 'trial' && madrasah.created_at) {
      const createdDate = new Date(madrasah.created_at);
      const expiryDate = new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000);
      return new Date() > expiryDate;
    }
    return false;
  }, [madrasah]);

  const isLiveChatEnabled = useMemo(() => {
    if (madrasah?.is_super_admin || profile?.role === 'super_admin') return true;
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const configModules = config?.modules || {};
    return configModules.live_chat === true || (madrasah as any)?.live_chat === true || (config as any)?.live_chat === true;
  }, [madrasah, profile?.role]);

  // Mount global real-time notifications for institution staff/admins
  useGlobalNotifications({
    institutionId: madrasah?.id,
    userId: profile?.id,
    userRole: profile?.role
  });

  const { initSignaling: initVoiceSignaling } = useVoiceCall();

  // Initialize Voice Call signaling for admin/teacher only if live_chat is enabled
  useEffect(() => {
    if (isLiveChatEnabled && madrasah?.id && profile?.id) {
      const userPhone = (profile as any)?.phone || (profile as any)?.guardian_phone;
      initVoiceSignaling(madrasah.id, profile.id, userPhone);
    }
  }, [isLiveChatEnabled, madrasah?.id, profile?.id, profile, initVoiceSignaling]);

  const triggerRefresh = () => {
    // Instead of total invalidation, we increment dataVersion to trigger targeted effect hooks
    // requestManager.invalidate() is too aggressive and causes "loading storms"
    setDataVersion((prev) => prev + 1);
    refreshMadrasah();
  };

  const handleBack = (fallback: View = "home") => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setView(fallback);
    }
  };

  useEffect(() => {
    if ((profile?.role === "super_admin" || profile?.role === "manager") && view === "home") {
      setView("admin-dashboard");
    }
  }, [profile?.role, view]);

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      const scrollable = document.querySelector('main');
      if (scrollable) {
        scrollable.scrollTop = 0;
      }
    } catch (e) {}
  }, [view]);

  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const isAuth = !session && !madrasah;
    const isDark = madrasah?.theme === 'dark';
    const isSplash = loading || (session && !madrasah);
    const isParent = profile?.role === 'parent';
    const bgColor = (isSplash || isAuth || isDark || isParent) ? "#0F172A" : "#EBF5FF"; // Match Layout.tsx bg-[#EBF5FF]
    
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", bgColor);
    }
    document.body.style.backgroundColor = bgColor;

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [loading, madrasah?.theme, session, madrasah]);

  useEffect(() => {
    const handleStatusChange = () => {
      if (navigator.onLine) {
        OfflineService.processQueue();
        triggerRefresh();
      }
    };
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);
    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  if (loading || (session && !madrasah))
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000 z-10">
          <div className="relative flex items-center justify-center mb-8">
            {/* Outer glowing rings */}
            <div className="absolute w-24 h-24 border border-blue-500/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
            <div className="absolute w-32 h-32 border border-indigo-500/20 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>
            <div className="absolute w-16 h-16 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
            
            {/* Center Icon */}
            <div className="relative w-16 h-16 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <BookOpen size={28} className="text-blue-400 animate-pulse" strokeWidth={1.5} />
            </div>
          </div>
          
          <div className="space-y-3 text-center">
            <h1 className="text-white font-black tracking-[0.5em] text-sm uppercase opacity-90">
              DEENORA
            </h1>
            <div className="flex items-center justify-center gap-1.5 opacity-60">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );

  if (authError)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-500 p-10 text-center text-white font-noto">
        <ShieldAlert size={80} className="mb-6 animate-bounce" />
        <h1 className="text-3xl font-black mb-4">নিরাপত্তা সতর্কতা!</h1>
        <p className="text-lg opacity-80 mb-8">{authError}</p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={hardReload}
            className="px-10 py-4 bg-white text-red-600 rounded-full font-black shadow-2xl active:scale-95 transition-all w-full"
          >
            পুনরায় চেষ্টা করুন
          </button>
          <button
            onClick={handleLogout}
            className="px-10 py-4 bg-red-700 text-white rounded-full font-black shadow-lg active:scale-95 transition-all w-full border border-white/20"
          >
            লগ আউট করুন
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              hardReload();
            }}
            className="px-10 py-4 bg-slate-800 text-white rounded-full font-black shadow-lg active:scale-95 transition-all w-full border border-white/10"
          >
            ক্যাশ ক্লিয়ার করুন
          </button>
        </div>
      </div>
    );

  if (!session && !madrasah) return (
    <Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A]" />}>
      <Auth lang={lang} />
    </Suspense>
  );

  if (madrasah && !madrasah.is_super_admin && (!madrasah.is_active || isTrialExpired)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="text-red-500" size={32} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">
          {isTrialExpired ? 'Trial Period Expired' : 'Access Restricted'}
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm">
          {isTrialExpired 
            ? 'আপনার ট্রায়াল পিরিয়ড শেষ হয়ে গিয়েছে। সার্ভিসটি নিয়মিত ব্যবহার করতে দয়া করে সাবস্ক্রিপশন সম্পন্ন করুন।'
            : 'আপনার প্রতিষ্ঠানটির অ্যাক্সেস বন্ধ করা হয়েছে। দয়া করে অ্যাডমিনের সাথে যোগাযোগ করুন।'}
        </p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs mb-8">
          <a
            href={`tel:${profile?.role === 'parent' ? (madrasah?.phone || '+8801629780297') : '+8801629780297'}`}
            className="flex items-center justify-center gap-3 px-8 py-3 bg-slate-800 text-white rounded-full font-bold border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <Globe size={18} className="text-blue-400" />
            {profile?.role === 'parent' ? (madrasah?.phone || '+8801629780297') : '+8801629780297'}
          </a>
          <a
            href={`https://wa.me/${(profile?.role === 'parent' ? (madrasah?.phone || '8801629780297') : '8801629780297').replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 px-8 py-3 bg-[#25D366] text-white rounded-full font-bold hover:opacity-90 transition-all"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp Support
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="px-8 py-3 bg-red-500 text-white rounded-full font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all"
        >
          লগআউট করুন
        </button>
      </div>
    );
  }

  if (profile && profile.role !== 'super_admin' && profile.is_active === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="text-red-500" size={32} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Account Blocked</h2>
        <p className="text-slate-400 mb-8 max-w-sm">
          আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। দয়া করে আপনার প্রতিষ্ঠানের অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs mb-8">
          <a
            href={`tel:${profile?.role === 'parent' ? (madrasah?.phone || '+8801629780297') : '+8801629780297'}`}
            className="flex items-center justify-center gap-3 px-8 py-3 bg-slate-800 text-white rounded-full font-bold border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <Globe size={18} className="text-blue-400" />
            {profile?.role === 'parent' ? (madrasah?.phone || '+8801629780297') : '+8801629780297'}
          </a>
          <a
            href={`https://wa.me/${(profile?.role === 'parent' ? (madrasah?.phone || '8801629780297') : '8801629780297').replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 px-8 py-3 bg-[#25D366] text-white rounded-full font-bold hover:opacity-90 transition-all"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp Support
          </a>
        </div>
        
        <button
          onClick={handleLogout}
          className="px-8 py-3 bg-red-500 text-white rounded-full font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all"
        >
          লগআউট করুন
        </button>
      </div>
    );
  }

  const renderView = () => {
    const role = profile?.role || "accountant";
    
    // parsedConfig is now at top level
    const activeYearId = parsedConfig?.active_academic_year_id;
    
    const isAdmin = role === "madrasah_admin" || role === "super_admin" || role === "manager";

    if (role === "parent") {
      const parentSession = JSON.parse(localStorage.getItem('parent_session') || '{}');
      return (
        <ParentPortal
          lang={lang}
          studentId={parentSession.student_id}
          madrasah={madrasah}
        />
      );
    }

    // Views that are allowed even without an academic year
    const allowedViews = [
      "account",
      "super-account",
      "admin-dashboard",
      "admin-panel",
      "tutorials",
      "academic-documents",
      "admin-tutorials",
      "admin-voice-service",
      "messages",
      "academic-year"
    ];

    if (
      !activeYearId &&
      !allowedViews.includes(view) &&
      role !== "super_admin" &&
      role !== "manager" &&
      madrasah
    ) {
      return (
        <AcademicYearSetupRequired
          madrasah={madrasah}
          lang={lang}
          onUpdate={triggerRefresh}
          isAdmin={isAdmin}
        />
      );
    }

    switch (view) {
      case "home":
        return (
          <Home
            onStudentClick={(s) => {
              setSelectedStudent(s);
              setView("student-details");
            }}
            lang={lang}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            institutionId={madrasah?.id}
            madrasah={madrasah}
            profile={profile}
            onNavigateToWallet={() => {
              const modules = {
                voice_broadcast: true,
                sms: true,
                ...(madrasah?.config_json?.modules || {}),
              };
              if (modules.sms !== false || modules.voice_broadcast) {
                setWalletTab("bulk-sms");
                setView("wallet-sms");
              }
            }}
            onNavigateToAccounting={() => setView("accounting")}
            onNavigateToAttendance={() => setView("attendance")}
            onNavigateToExams={() => setView("exams")}
            onNavigateToClasses={() => setView("classes")}
            onNavigateToTeachers={() => setView("teachers")}
            onNavigateToVoiceBroadcast={() => {
              setView("voice-broadcast");
            }}
            onNavigateToMessages={() => setView("messages")}
            onNavigateToCertificates={() => setView("certificates")}
          />
        );
      case "classes":
        return (
          <Classes
            onClassClick={(cls) => {
              setSelectedClass(cls);
              setView("students");
            }}
            lang={lang}
            madrasah={madrasah}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            readOnly={
              role !== "madrasah_admin" &&
              role !== "super_admin" &&
              !profile?.permissions?.can_manage_classes
            }
            profile={profile}
          />
        );
      case "students":
        if (!selectedClass) {
          setView("classes");
          return null;
        }
        return (
          <Students
            selectedClass={selectedClass}
            madrasah={madrasah}
            profile={profile}
            onStudentClick={(s) => {
              setSelectedStudent(s);
              setView("student-details");
            }}
            onAddClick={() => {
              setIsEditing(false);
              setSelectedStudent(null);
              setView("student-form");
            }}
            onBack={() => setView("classes")}
            lang={lang}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            canAdd={
              role === "madrasah_admin" ||
              role === "super_admin" ||
              !!profile?.permissions?.can_manage_students
            }
            canSendSMS={
              role === "madrasah_admin" ||
              role === "super_admin" ||
              !!profile?.permissions?.can_send_sms
            }
            canUseVoice={
              role === "madrasah_admin" ||
              role === "super_admin" ||
              !!profile?.permissions?.can_use_voice_call
            }
            institutionId={madrasah?.id}
            onNavigateToVoiceBroadcast={(ids) => {
              setPreSelectedStudentIds(ids);
              setView("voice-broadcast");
            }}
          />
        );
      case "teachers":
        return (
          <TeacherManagement
            madrasah={madrasah}
            lang={lang}
            onBack={() => handleBack("home")}
            role={role}
            profile={profile}
          />
        );
      case "student-details":
        if (!selectedStudent) {
          setView("home");
          return null;
        }
        return (
          <StudentDetails
            student={selectedStudent}
            madrasah={madrasah}
            onEdit={() => {
              setIsEditing(true);
              setView("student-form");
            }}
            onBack={() => handleBack("students")}
            lang={lang}
            readOnly={
              role !== "madrasah_admin" &&
              role !== "super_admin" &&
              !profile?.permissions?.can_manage_students
            }
            institutionId={madrasah?.id}
            triggerRefresh={triggerRefresh}
            role={role}
            profile={profile}
            onStudentUpdate={(updated) => setSelectedStudent(updated)}
          />
        );
      case "student-form":
        return (
          <StudentForm
            student={selectedStudent}
            madrasah={madrasah}
            defaultClassId={selectedClass?.id}
            isEditing={isEditing}
            onSuccess={(updatedStudent) => {
              if (updatedStudent) {
                setSelectedStudent(updatedStudent);
              }
              triggerRefresh();
              setView("students");
            }}
            onCancel={() => setView("students")}
            lang={lang}
          />
        );
      case "account":
        return (
          <Account
            lang={lang}
            setLang={(l) => {
              setLang(l);
              localStorage.setItem("app_lang", l);
            }}
            initialMadrasah={madrasah}
            setView={setView}
            onLogout={handleLogout}
            onProfileUpdate={refreshMadrasah}
            profile={profile}
            dataVersion={dataVersion}
          />
        );
      case "teacheraccount":
        return (
          <TeacherAccount
            lang={lang}
            setLang={(l) => {
              setLang(l);
              localStorage.setItem("app_lang", l);
            }}
            madrasah={madrasah}
            setView={setView}
            onLogout={handleLogout}
            profile={profile}
            dataVersion={dataVersion}
          />
        );
      case "academic-year":
        return (
          <AcademicYearManager
            institution={madrasah}
            onClose={() => setView('account')}
            onUpdate={refreshMadrasah}
            lang={lang}
          />
        );
      case "super-account":
        if (role !== "super_admin" && role !== "manager") {
          setView("home");
          return null;
        }
        return (
          <SuperAccount
            lang={lang}
            setLang={(l) => {
              setLang(l);
              localStorage.setItem("app_lang", l);
            }}
            initialMadrasah={madrasah}
            setView={setView}
            onLogout={handleLogout}
            onProfileUpdate={triggerRefresh}
            setStatusModal={setStatusModal}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            profile={profile}
          />
        );
      case "admin-panel":
      case "admin-institutions":
      case "admin-approvals":
      case "admin-dashboard":
        if (role !== "super_admin" && role !== "manager") {
          setView("home");
          return null;
        }

        const permissions = profile?.permissions;
        if (view === "admin-dashboard" && permissions?.dashboard === false) {
          setView("home");
          return null;
        }
        if ((view === "admin-panel" || view === "admin-institutions") && permissions?.institutions === false) {
          setView("home");
          return null;
        }
        if (view === "admin-approvals" && permissions?.approvals === false) {
          setView("home");
          return null;
        }

        return (
          <AdminPanel
            lang={lang}
            currentView={
              view === "admin-approvals"
                ? "approvals"
                : view === "admin-dashboard"
                  ? "dashboard"
                  : "list"
            }
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            onProfileUpdate={refreshMadrasah}
            madrasah={madrasah}
            profile={profile}
            setStatusModal={setStatusModal}
            onNavigateToVoiceBroadcast={(ids) => {
              setPreSelectedInstitutionIds(ids);
              setView("voice-broadcast");
            }}
            onNavigateToSMSBroadcast={(ids, msg) => {
              setPreSelectedInstitutionIds(ids);
              if (msg) setPreSelectedMessage(msg);
              setView("wallet-sms");
            }}
          />
        );
      case "admin-voice-service":
        if (role !== "super_admin" && role !== "manager") {
          setView("home");
          return null;
        }
        return (
          <VoiceServiceDashboard
            onBack={() => handleBack("account")}
            madrasah={madrasah}
            setStatusModal={setStatusModal}
          />
        );
      case "admin-tutorials":
        if (role !== "super_admin" && role !== "manager") {
          setView("home");
          return null;
        }
        return (
          <TutorialsManager
            onBack={() => handleBack("account")}
            madrasah={madrasah}
            setStatusModal={setStatusModal}
          />
        );
      case "wallet-sms":
        return (
          <WalletSMS
            lang={lang}
            madrasah={madrasah}
            triggerRefresh={triggerRefresh}
            dataVersion={dataVersion}
            initialTab={walletTab}
            role={role}
            profile={profile}
            onBack={() => {
              setPreSelectedInstitutionIds([]);
              setPreSelectedMessage('');
              handleBack("home");
            }}
            preSelectedInstitutionIds={preSelectedInstitutionIds}
            initialMessage={preSelectedMessage}
          />
        );
      case "voice-broadcast":
        return (
          <VoiceBroadcast
            lang={lang}
            madrasah={madrasah}
            triggerRefresh={triggerRefresh}
            dataVersion={dataVersion}
            role={role}
            profile={profile}
            onBack={() => {
              setPreSelectedStudentIds([]);
              setPreSelectedInstitutionIds([]);
              handleBack("home");
            }}
            preSelectedStudentIds={preSelectedStudentIds}
            preSelectedInstitutionIds={preSelectedInstitutionIds}
          />
        );
      case "sms-voice-menu":
        return (
          <SmsVoiceMenu
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("home")}
            onNavigateToSms={() => setView("wallet-sms")}
            onNavigateToVoice={() => setView("voice-broadcast")}
            role={role}
            profile={profile}
          />
        );
      case "academic-calendar":
        return (
          <AcademicCalendarPage
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack(role === 'super_admin' ? 'super-account' : (role === 'teacher' ? 'teacheraccount' : 'account'))}
            role={role}
          />
        );
      case "tutorials":
        return (
          <Tutorials
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack(role === 'teacher' ? 'teacheraccount' : 'account')}
          />
        );
      case "academic-documents":
        return (
          <AcademicDocuments
            lang={lang}
            madrasah={madrasah}
            role={role}
            profile={profile}
            onBack={() => handleBack(role === 'super_admin' ? 'super-account' : (role === 'teacher' ? 'teacheraccount' : 'account'))}
            onNavigate={(newView) => setView(newView)}
            onUpgradeClick={() => {
              setView(role === 'teacher' ? 'teacheraccount' : 'account');
            }}
          />
        );
      case "data-management":
        return (
          <DataManagement
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("account")}
            triggerRefresh={triggerRefresh}
          />
        );
      case "accounting":
        return (
          <Accounting
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("home")}
            role={role}
            profile={profile}
            activeYear={activeYear}
            triggerRefresh={triggerRefresh}
          />
        );
      case "donations":
        if (role !== "super_admin" && (madrasah?.config_json as any)?.modules?.donations !== true) {
          setView("home");
          return null;
        }
        return (
          <Donations
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("home")}
            role={role}
            profile={profile}
            activeYear={activeYear}
            triggerRefresh={triggerRefresh}
          />
        );
      case "attendance":
        return (
          <Attendance
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("home")}
            userId={session?.user?.id}
            profile={profile}
            activeYear={activeYear}
            triggerRefresh={triggerRefresh}
          />
        );
      case "exams":
        return (
          <Exams
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("home")}
            role={role}
            onNavigateToFinalResults={() => setView("final-results")}
            profile={profile}
            activeYear={activeYear}
          />
        );
      case "final-results":
        return (
          <FinalResults
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("home")}
            role={role}
            profile={profile}
          />
        );
      case "library":
        return <LibraryPattern lang={lang} madrasah={madrasah} profile={profile} />;
      case "messages":
        return (
          <MessagesPattern lang={lang} madrasah={madrasah} profile={profile} />
        );
      case "class-routine":
        return (
          <ClassRoutine
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack('academic-documents')}
            profile={profile}
          />
        );
      case "profile-settings":
        return (
          <ProfileSettings
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack(role === 'super_admin' ? 'super-account' : (role === 'teacher' ? 'teacheraccount' : 'account'))}
            onProfileUpdate={refreshMadrasah}
            setStatusModal={setStatusModal}
          />
        );
      case "certificates":
        return (
          <Certificates
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack('academic-documents')}
            profile={profile}
          />
        );
      case "id-cards":
        return (
          <IdCards
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack('academic-documents')}
            profile={profile}
          />
        );
      case "admission-form":
        if (!hasAdmissionFormAccess(madrasah, role === 'super_admin')) {
          return (
            <div className="p-8 text-center max-w-md mx-auto my-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-lg font-black font-noto text-slate-800 dark:text-white">
                {lang === 'bn' ? 'ভর্তি ফরম ফিচারটি আপনার প্যাকেজে অন্তর্ভুক্ত নয়' : 'Admission Form Feature Not Included'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'এই ফিচারটি ব্যবহার করতে আপনার অ্যাকাউন্ট সক্রিয় থাকতে হবে এবং স্ট্যান্ডার্ড থেকে আল্টিমেট প্যাকেজে আপগ্রেড করতে হবে।'
                  : 'To use this feature, your account must be Active and upgraded to Standard or Ultimate Package.'}
              </p>
              <button
                onClick={() => setView('academic-documents')}
                className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all cursor-pointer text-sm"
              >
                {lang === 'bn' ? 'একাডেমিক ডকুমেন্টস পেজে ফিরে যান' : 'Back to Academic Documents'}
              </button>
            </div>
          );
        }
        return (
          <AdmissionFormPage
            madrasah={madrasah}
            onBack={() => handleBack("academic-documents")}
            lang={lang}
          />
        );
      case "chat":
        if (!isLiveChatEnabled) {
          return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-xl font-black text-slate-800">
                {lang === 'bn' ? 'অনুমতি নেই' : 'Permission Required'}
              </h2>
              <p className="text-slate-500 max-w-md text-sm">
                {lang === 'bn' 
                  ? 'আপনার প্রতিষ্ঠানের জন্য লাইভ চ্যাট ও ভয়েস কল ফিচারটি সক্রিয় নয়। সুপার এডমিনের সাথে যোগাযোগ করুন।' 
                  : 'Live Chat & Voice Call is not enabled for your institution. Please contact Super Admin.'}
              </p>
              <button 
                onClick={() => setView('home')} 
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
              >
                {lang === 'bn' ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}
              </button>
            </div>
          );
        }
        return (
          <ChatApp
            institution={madrasah}
            profile={profile}
            lang={lang}
            isDark={madrasah?.theme === "dark"}
            onMobileChatStateChange={setIsMobileChatActive}
          />
        );
      default:
        return (
          <Home
            onStudentClick={(s) => {
              setSelectedStudent(s);
              setView("student-details");
            }}
            lang={lang}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            institutionId={madrasah?.id}
            madrasah={madrasah}
            profile={profile}
            onNavigateToWallet={() => {
              const modules = {
                voice_broadcast: true,
                sms: true,
                ...(madrasah?.config_json?.modules || {}),
              };
              if (modules.sms !== false || modules.voice_broadcast) {
                setWalletTab("bulk-sms");
                setView("wallet-sms");
              }
            }}
            onNavigateToAccounting={() => setView("accounting")}
            onNavigateToAttendance={() => setView("attendance")}
            onNavigateToExams={() => setView("exams")}
            onNavigateToClasses={() => setView("classes")}
            onNavigateToTeachers={() => setView("teachers")}
            onNavigateToVoiceBroadcast={() => {
              setView("voice-broadcast");
            }}
            onNavigateToMessages={() => setView("messages")}
            onNavigateToCertificates={() => setView("certificates")}
            onNavigateToDonations={() => setView("donations")}
          />
        );
    }
  };

  return (
    <Layout
      currentView={view}
      setView={setView}
      lang={lang}
      madrasah={madrasah}
      profile={profile}
      isMobileChatActive={isMobileChatActive}
    >
      <OfflineIndicator />
      <Suspense
        fallback={
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute w-16 h-16 border-2 border-blue-500/20 rounded-full animate-spin"></div>
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" strokeWidth={3} />
            </div>
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] animate-pulse">লোড হচ্ছে...</p>
          </div>
        }
      >
        {renderView()}
      </Suspense>

      {/* Global Update Popup */}
      {showUpdatePopup && globalUpdate && profile?.role && (profile.role === 'madrasah_admin' || profile.role === 'super_admin') && createPortal(
        <div className="modal-overlay bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500 z-[110]">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'} w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl border animate-in zoom-in-95 duration-500 relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600"></div>
            
            <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-orange-100 shadow-inner relative">
              <Globe size={40} strokeWidth={2.5} className="animate-pulse" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">!</div>
            </div>

            <h3 className={`text-[22px] font-black font-noto leading-tight tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'নতুন আপডেট উপলব্ধ!' : 'Update Available!'}
            </h3>
            
            <div className={`mt-4 p-5 rounded-3xl text-[14px] font-black font-noto leading-relaxed break-words whitespace-normal border text-left max-h-[350px] overflow-y-auto custom-scrollbar transition-all ${
              madrasah?.theme === 'dark' 
                ? 'bg-slate-900 border-slate-700/60 text-slate-100 shadow-inner' 
                : 'bg-slate-50 border-slate-200/80 text-slate-900 shadow-inner'
            }`}>
              <article className="font-noto font-black">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className={`my-2 leading-relaxed text-[13px] sm:text-sm font-extrabold ${madrasah?.theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
                        {children}
                      </p>
                    ),
                    h1: ({ children }) => (
                      <h1 className={`text-base sm:text-lg font-black tracking-tight mt-4 mb-2 ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className={`text-sm sm:text-base font-black tracking-tight mt-4 mb-2 ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className={`text-xs sm:text-sm font-black tracking-tight mt-3 mb-1.5 ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                        {children}
                      </h3>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 my-2 space-y-1.5">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 my-2 space-y-1.5">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className={`text-[12px] sm:text-[13px] font-extrabold leading-relaxed ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className={`font-black px-1.5 py-0.5 rounded-[0.4rem] text-xs sm:text-[13px] inline-block shadow-sm ${
                        madrasah?.theme === 'dark' 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                          : 'bg-amber-100 text-amber-950 border border-amber-200/80'
                      }`}>
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic font-bold opacity-95">
                        {children}
                      </em>
                    ),
                    code: ({ children }) => (
                      <code className={`px-1.5 py-0.5 rounded font-mono text-xs ${
                        madrasah?.theme === 'dark' 
                          ? 'bg-slate-800 text-pink-400 border border-slate-700' 
                          : 'bg-slate-100 text-pink-600 border border-slate-200'
                      }`}>
                        {children}
                      </code>
                    )
                  }}
                >
                  {(() => {
                    const rawMsg = globalUpdate.global_update_message || (lang === 'bn' ? 'সিস্টেমে নতুন কিছু পরিবর্তন করা হয়েছে। আরও ভালো অভিজ্ঞতার জন্য এখনই আপডেট করুন।' : 'Some changes have been made to the system. Update now for a better experience.');
                    return rawMsg.replace(/\r?\n/g, '  \n');
                  })()}
                </ReactMarkdown>
              </article>
            </div>

            <div className="flex flex-col gap-3 mt-8">
              <button
                onClick={() => {
                  dismissUpdatePopup();
                  window.location.reload();
                }}
                className="w-full py-4 bg-orange-600 text-white font-black rounded-full text-sm uppercase tracking-[0.2em] transition-all shadow-premium active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} className="animate-spin" style={{ animationDuration: '3s' }} />
                {lang === 'bn' ? 'এখনই আপডেট করুন' : 'Update Now'}
              </button>
              
              <button
                onClick={dismissUpdatePopup}
                className={`w-full py-3 font-bold text-[11px] uppercase tracking-[0.1em] transition-all opacity-40 hover:opacity-100 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-500'}`}
              >
                {lang === 'bn' ? 'পরে করবো' : 'Maybe Later'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Status Modal - PORTALED */}
      {statusModal.show &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xl animate-in fade-in duration-300 z-[100] flex items-center justify-center p-4">
            <div
              className={`${madrasah?.theme === "dark" ? "bg-slate-900/95 border-slate-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]" : "bg-white/95 border-white shadow-[0_20px_60px_-15px_rgba(37,99,235,0.15)]"} w-full max-w-sm rounded-[2.5rem] p-8 text-center border backdrop-blur-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 relative overflow-hidden`}
            >
              {/* Top ambient highlight */}
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 ${statusModal.type === "success" ? "bg-emerald-500" : "bg-red-500"} rounded-b-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] shadow-${statusModal.type === "success" ? "emerald" : "red"}-500/50`}></div>

              <div
                className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transition-transform duration-700 ${statusModal.type === "success" ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30" : "bg-gradient-to-br from-red-400 to-red-600 text-white shadow-red-500/30"} shadow-xl relative rotate-3`}
              >
                <div className="absolute inset-0 bg-white/20 rounded-[2rem] blur animate-pulse"></div>
                {statusModal.type === "success" ? (
                  <CheckCircle2 size={36} strokeWidth={2.5} className="relative z-10" />
                ) : (
                  <AlertCircle size={36} strokeWidth={2.5} className="relative z-10" />
                )}
              </div>
              <h3
                className={`text-2xl font-black font-noto leading-tight tracking-tight mt-2 ${madrasah?.theme === "dark" ? "text-white" : "text-slate-800"}`}
              >
                {statusModal.title}
              </h3>
              <p className={`text-sm font-medium mt-3 font-noto leading-relaxed px-2 ${madrasah?.theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                {statusModal.message}
              </p>
              <button
                onClick={() => setStatusModal({ ...statusModal, show: false })}
                className={`w-full mt-8 py-4 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-[0.98] ${statusModal.type === "success" ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)]" : "bg-red-500 hover:bg-red-600 text-white shadow-[0_8px_20px_-6px_rgba(239,68,68,0.4)]"}`}
              >
                {lang === "bn" ? "ঠিক আছে" : "Continue"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </Layout>
  );
};

export default App;
