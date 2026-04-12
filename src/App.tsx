import React, { useState, useEffect, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { OfflineService } from "services/OfflineService";
import { useSyncEngine } from "hooks/useOffline";
import { useAndroidBackHandler } from "hooks/useAndroidBackHandler";
import { OfflineIndicator } from "components/OfflineIndicator";
import Layout from "components/Layout";
import { Class, Student } from "types";
import { t } from "translations";
import {
  BookOpen,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useMadrasah } from "contexts/MadrasahContext";

import { AcademicYearSetupRequired } from "components/AcademicYearSetupRequired";

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
const AcademicCalendarPage = React.lazy(
  () => import("pages/AcademicCalendarPage"),
);
const Tutorials = React.lazy(() => import("pages/Tutorials"));
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
    triggerRefresh,
    lang,
    setLang,
    role,
    isAdmin,
    isSuperAdmin,
    dataVersion,
    statusModal,
    setStatusModal,
  } = useMadrasah();
  
  const location = useLocation();
  useAndroidBackHandler();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      if (loading) {
        themeColorMeta.setAttribute("content", "#0F172A"); // Splash screen color
      } else {
        // Use a dark color for the status bar in both modes to ensure white icons are always visible
        themeColorMeta.setAttribute("content", "#0F172A");
      }
    }
  }, [loading, session, madrasah, madrasah?.theme]);

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
            onClick={() => window.location.reload()}
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
              window.location.reload();
            }}
            className="px-10 py-4 bg-slate-800 text-white rounded-full font-black shadow-lg active:scale-95 transition-all w-full border border-white/10"
          >
            ক্যাশ ক্লিয়ার করুন
          </button>
        </div>
      </div>
    );

  if (!session && !madrasah) return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0F172A]"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}><Auth /></Suspense>;

  const activeYearId = activeYear?.id;

  // Views that are allowed even without an academic year
  const allowedPaths = [
    "/account",
    "/super-account",
    "/admin-dashboard",
    "/admin-panel",
    "/tutorials",
    "/admin-tutorials",
    "/admin-voice-service",
    "/academic-year"
  ];

  const isPathAllowed = allowedPaths.includes(location.pathname);

  if (
    !activeYearId &&
    !isPathAllowed &&
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

  return (
    <Layout>
      <OfflineIndicator />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={
            isSuperAdmin ? <Navigate to="/admin-dashboard" replace /> :
            <Home />
          } />
          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/:classId/students" element={<Students />} />
          <Route path="/students/:studentId" element={<StudentDetails />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/:studentId/edit" element={<StudentForm />} />
          
          <Route path="/teachers" element={<TeacherManagement />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/final-results" element={<FinalResults />} />
          
          <Route path="/wallet-sms" element={<WalletSMS />} />
          <Route path="/voice-broadcast" element={<VoiceBroadcast />} />
          <Route path="/sms-voice-menu" element={<SmsVoiceMenu />} />
          
          <Route path="/academic-calendar" element={<AcademicCalendarPage />} />
          <Route path="/tutorials" element={<Tutorials />} />
          <Route path="/data-management" element={<DataManagement />} />
          <Route path="/academic-year" element={<AcademicYearManager />} />
          
          <Route path="/account" element={<Account />} />
          
          {isSuperAdmin && (
            <>
              <Route path="/admin-dashboard" element={<AdminPanel />} />
              <Route path="/admin-panel" element={<AdminPanel />} />
              <Route path="/admin-approvals" element={<AdminPanel />} />
              <Route path="/super-account" element={<SuperAccount />} />
              <Route path="/admin-voice-service" element={<VoiceServiceDashboard />} />
              <Route path="/admin-tutorials" element={<TutorialsManager />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Status Modal - PORTALED */}
      {statusModal.show &&
        createPortal(
          <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 z-[100]">
            <div
              className={`${madrasah?.theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-50"} w-full max-w-sm rounded-[2.5rem] p-10 text-center shadow-2xl border animate-in zoom-in-95 duration-500 relative overflow-hidden`}
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
