import React, { useState, useEffect, Suspense } from "react";
import { OfflineService } from "services/OfflineService";
import { useSyncEngine } from "hooks/useOffline";
import { useAndroidBackHandler } from "hooks/useAndroidBackHandler";
import { OfflineIndicator } from "components/OfflineIndicator";
import { useAuth } from "hooks/useAuth";
import { hardReload } from "utils/reloadUtils";
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
import { createPortal } from "react-dom";

import { AcademicYearSetupRequired } from "components/AcademicYearSetupRequired";
import { useGlobalUpdate } from "hooks/useGlobalUpdate";

const Auth = React.lazy(() => import("pages/Auth"));
const Home = React.lazy(() => import("pages/Home"));
const Classes = React.lazy(() => import("pages/Classes"));
const Students = React.lazy(() => import("pages/Students"));
const StudentDetails = React.lazy(() => import("pages/StudentDetails"));
const StudentForm = React.lazy(() => import("pages/StudentForm"));
const Account = React.lazy(() => import("pages/Account"));
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
const Tutorials = React.lazy(() => import("pages/Tutorials"));
const ClassRoutine = React.lazy(() => import("pages/ClassRoutine"));
const Certificates = React.lazy(() => import("pages/Certificates"));
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
  useAndroidBackHandler(view, setView);
  const [walletTab, setWalletTab] = useState<
    "templates" | "bulk-sms" | "history" | "recharge"
  >("bulk-sms");
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [preSelectedStudentIds, setPreSelectedStudentIds] = useState<string[]>([]);
  const [preSelectedInstitutionIds, setPreSelectedInstitutionIds] = useState<string[]>([]);
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

  const triggerRefresh = () => {
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
    if (profile?.role === "super_admin" && view === "home") {
      setView("admin-dashboard");
    }
  }, [profile?.role, view]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const isAuth = !session && !madrasah;
    const isDark = madrasah?.theme === 'dark';
    const bgColor = (loading || isAuth || isDark) ? "#0F172A" : "#EBF5FF"; // Match Layout.tsx bg-[#EBF5FF]
    
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", bgColor);
    }
    document.body.style.backgroundColor = bgColor;
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

  if (loading)
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

  if (madrasah && !madrasah.is_super_admin && !madrasah.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="text-red-500" size={32} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400 mb-8 max-w-sm">
          আপনার প্রতিষ্ঠানটির অ্যাক্সেস বন্ধ করা হয়েছে। দয়া করে অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>
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
    
    let parsedConfig = madrasah?.config_json as any;
    if (typeof parsedConfig === 'string') {
      try {
        parsedConfig = JSON.parse(parsedConfig);
      } catch (e) {
        parsedConfig = {};
      }
    }
    const activeYearId = parsedConfig?.active_academic_year_id;
    
    const isAdmin = role === "madrasah_admin" || role === "super_admin";

    // Views that are allowed even without an academic year
    const allowedViews = [
      "account",
      "super-account",
      "admin-dashboard",
      "admin-panel",
      "tutorials",
      "admin-tutorials",
      "admin-voice-service",
      "messages",
      "academic-year"
    ];

    if (
      !activeYearId &&
      !allowedViews.includes(view) &&
      role !== "super_admin" &&
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
          />
        );
      case "student-form":
        return (
          <StudentForm
            student={selectedStudent}
            madrasah={madrasah}
            defaultClassId={selectedClass?.id}
            isEditing={isEditing}
            onSuccess={() => {
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
        if (role !== "super_admin") {
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
          />
        );
      case "admin-panel":
      case "admin-institutions":
      case "admin-approvals":
      case "admin-dashboard":
        if (role !== "super_admin") {
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
          />
        );
      case "admin-voice-service":
        if (role !== "super_admin") {
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
        if (role !== "super_admin") {
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
            onBack={() => handleBack("home")}
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
            onBack={() => handleBack(role === 'super_admin' ? 'super-account' : 'account')}
            role={role}
          />
        );
      case "tutorials":
        return (
          <Tutorials
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack("account")}
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
            onBack={() => handleBack(role === 'super_admin' ? 'super-account' : 'account')}
            profile={profile}
          />
        );
      case "certificates":
        return (
          <Certificates
            lang={lang}
            madrasah={madrasah}
            onBack={() => handleBack(role === 'super_admin' ? 'super-account' : 'account')}
            profile={profile}
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
    >
      <OfflineIndicator />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        }
      >
        {renderView()}
      </Suspense>

      {/* Global Update Popup */}
      {showUpdatePopup && globalUpdate && createPortal(
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
            
            <div className={`mt-4 p-5 rounded-2xl text-[13px] font-bold font-noto leading-relaxed break-words whitespace-normal border ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-orange-50/30 border-orange-100 text-slate-600'}`}>
              {globalUpdate.global_update_message || (lang === 'bn' ? 'সিস্টেমে নতুন কিছু পরিবর্তন করা হয়েছে। আরও ভালো অভিজ্ঞতার জন্য এখনই আপডেট করুন।' : 'Some changes have been made to the system. Update now for a better experience.')}
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
          <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 z-[100]">
            <div
              className={`${madrasah?.theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-50"} w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-2xl border animate-in zoom-in-95 duration-500 relative overflow-hidden`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform duration-700 ${statusModal.type === "success" ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-red-50 text-red-500 border-red-100"} border-4 shadow-inner`}
              >
                {statusModal.type === "success" ? (
                  <CheckCircle2 size={40} strokeWidth={2.5} />
                ) : (
                  <AlertCircle size={40} strokeWidth={2.5} />
                )}
              </div>
              <h3
                className={`text-[22px] font-black font-noto leading-tight tracking-tight ${madrasah?.theme === "dark" ? "text-white" : "text-[#1E3A8A]"}`}
              >
                {statusModal.title}
              </h3>
              <p className="text-[13px] font-bold text-slate-400 mt-3 font-noto px-4 leading-relaxed">
                {statusModal.message}
              </p>
              <button
                onClick={() => setStatusModal({ ...statusModal, show: false })}
                className={`w-full mt-8 py-4 font-black rounded-full text-xs uppercase tracking-[0.2em] transition-all shadow-premium active:scale-95 ${statusModal.type === "success" ? "bg-[#2563EB] text-white" : "bg-red-500 text-white"}`}
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
