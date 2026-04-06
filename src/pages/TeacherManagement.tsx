import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Shield,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  User,
  Briefcase,
  Lock,
  X,
  Save,
  Check,
  BookOpen,
  GraduationCap,
  Settings,
  MessageSquare,
  Calendar,
  ClipboardCheck,
  Layout,
  TrendingUp,
  UserCheck,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Teacher,
  TeacherPermissions,
  Language,
  Institution,
  Class,
} from "types";
import { t } from "translations";
import { supabase } from "supabase";
import { useOfflineStatus } from "hooks/useOffline";
import { CacheService } from "services/cacheService";

interface TeacherManagementProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role?: string;
  profile?: any;
}

const initialPermissions: TeacherPermissions = {
  can_manage_students: false,
  can_manage_attendance: false,
  can_manage_exams: false,
  can_manage_accounting: false,
  can_send_sms: false,
  can_manage_classes: false,
  can_send_free_sms: false,
  can_use_voice_call: false,
  can_manage_settings: false,
  can_view_reports: false,
  can_manage_teachers: false,
  allowed_classes: [],
};

const TeacherManagement: React.FC<TeacherManagementProps> = ({
  lang,
  madrasah,
  onBack,
  role,
  profile,
}) => {
  const isTeacher = role === "teacher";
  const canManageTeachers =
    !isTeacher || profile?.permissions?.can_manage_teachers;

  if (!canManageTeachers) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === "bn" ? "আপনার অনুমতি নেই" : "Access Denied"}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === "bn"
            ? "আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।"
            : "You do not have permission to access this module. Please contact your administrator."}
        </p>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-slate-800 text-white rounded-full font-black"
        >
          {lang === "bn" ? "ফিরে যান" : "Go Back"}
        </button>
      </div>
    );
  }
  const isOnline = useOfflineStatus();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    teacherId: string | null;
  }>({ show: false, teacherId: null });
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    pin: "",
    designation: "",
    is_active: true,
  });

  const [permissions, setPermissions] =
    useState<Partial<TeacherPermissions>>(initialPermissions);

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, [madrasah?.id]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("institution_id", madrasah.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setClasses(data || []);
    } catch (err: any) {
      console.error("Fetch classes error:", err);
    }
  };

  const fetchTeachers = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      if (!isOnline) {
        const cachedTeachers = await CacheService.getCachedData('teachers', madrasah.id);
        setTeachers(cachedTeachers);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `/api/teachers/list?institute_id=${madrasah.id}`,
      );
      if (!response.ok) throw new Error("Failed to fetch teachers");
      const data = await response.json();
      setTeachers(data.teachers || []);
      
      // Cache the fetched teachers
      if (data.teachers) {
        await CacheService.cacheData('teachers', madrasah.id, data.teachers);
      }
    } catch (err: any) {
      console.error("Fetch teachers error:", err);
      // Fallback to cache if network fails
      if (err.message?.includes('fetch') || err.name === 'TypeError' || !navigator.onLine) {
        console.log("Network error in fetchTeachers, falling back to cache...");
        const cachedTeachers = await CacheService.getCachedData('teachers', madrasah.id);
        setTeachers(cachedTeachers);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id) return;
    setSaving(true);
    setError(null);

    try {
      console.log("Adding teacher with data:", {
        ...formData,
        institute_id: madrasah.id,
        permissions,
      });

      const response = await fetch("/api/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          institute_id: madrasah.id,
          permissions,
        }),
      });

      const data = await response.json();
      console.log("Create teacher response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to add teacher");
      }

      await fetchTeachers();
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      console.error("Create teacher error details:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    setSaving(true);
    setError(null);

    try {
      console.log("Updating teacher with data:", {
        id: selectedTeacher.id,
        ...formData,
        permissions,
      });

      const response = await fetch("/api/teachers/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTeacher.id,
          ...formData,
          permissions,
        }),
      });

      const data = await response.json();
      console.log("Update teacher response:", data);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to update teacher",
        );
      }

      await fetchTeachers();
      setShowEditModal(false);
      setSelectedTeacher(null);
      resetForm();
    } catch (err: any) {
      console.error("Update teacher error details:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    try {
      const response = await fetch(`/api/teachers/delete?id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete teacher");
      }
      await fetchTeachers();
      setDeleteModal({ show: false, teacherId: null });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      pin: "",
      designation: "",
      is_active: true,
    });
    setPermissions(initialPermissions);
    setShowPassword(false);
  };

  const openEditModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      name: teacher.name || "",
      phone: teacher.phone || "",
      pin: "", // Don't show pin
      designation: teacher.designation || "",
      is_active: teacher.is_active,
    });
    setPermissions({ ...initialPermissions, ...(teacher.permissions || {}) });
    setShowEditModal(true);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      (t.name || "")
        .toLowerCase()
        .includes((searchQuery || "").toLowerCase()) ||
      (t.phone && t.phone.includes(searchQuery)),
  );

  const isDark = madrasah?.theme === "dark";

  return (
    <div
      className={`min-h-screen pb-20 ${isDark ? "bg-slate-950 text-white" : "text-slate-900"}`}
    >
      {/* Header */}
      <div
        className={`px-4 py-4 border-b ${isDark ? "bg-slate-900 border-slate-800" : "bg-transparent border-blue-100"}`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? "bg-slate-800 text-blue-400 border-slate-700" : "bg-blue-50 text-[#2563EB] border-blue-100"}`}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1
                className={`text-xl font-black font-noto ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {t("teacher_management", lang)}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {madrasah?.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!isOnline) {
                setError("Internet required to add teachers.");
                return;
              }
              resetForm();
              setShowAddModal(true);
            }}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all ${!isOnline ? "bg-slate-400 text-white cursor-not-allowed shadow-none" : "bg-blue-600 text-white shadow-blue-600/20"}`}
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">{t("add_teacher", lang)}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Search Bar */}
        <div className="relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
            size={20}
          />
          <input
            type="text"
            placeholder={
              lang === "bn"
                ? "শিক্ষকের নাম বা মোবাইল দিয়ে খুঁজুন..."
                : "Search by teacher name or mobile..."
            }
            className={`w-full pl-12 pr-4 py-4 border rounded-2xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 ${isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Teachers List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-blue-500 animate-spin" />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">
              Loading Teachers...
            </p>
          </div>
        ) : filteredTeachers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeachers.map((teacher) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-3xl p-4 shadow-sm hover:shadow-md transition-all group ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isDark ? "bg-blue-900/20 text-blue-400 border-blue-900/30" : "bg-blue-50 text-blue-600 border-blue-100"}`}
                    >
                      <User size={24} />
                    </div>
                    <div>
                      <h3
                        className={`text-sm font-black font-noto leading-tight ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {teacher.name}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {teacher.designation ||
                          (lang === "bn" ? "শিক্ষক" : "Teacher")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(teacher)}
                      className={`p-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteModal({ show: true, teacherId: teacher.id })
                      }
                      className={`p-2 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all ${isDark ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div
                    className={`flex items-center gap-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    <Smartphone size={14} />
                    <span className="text-xs font-bold">{teacher.phone}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.permissions &&
                      Object.entries(teacher.permissions)
                        .filter(
                          ([key, val]) =>
                            key.startsWith("can_") && val === true,
                        )
                        .map(([key]) => (
                          <div
                            key={key}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}
                          >
                            <Shield size={8} />
                            {key
                              .replace("can_manage_", "")
                              .replace("can_send_", "")
                              .replace("can_use_", "")
                              .replace("_", " ")}
                          </div>
                        ))}
                    {teacher.permissions?.allowed_classes &&
                      teacher.permissions.allowed_classes.length > 0 && (
                        <div
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${isDark ? "bg-blue-900/20 text-blue-400" : "bg-blue-50 text-blue-600"}`}
                        >
                          <BookOpen size={8} />
                          {teacher.permissions.allowed_classes.length}{" "}
                          {lang === "bn" ? "টি শ্রেণি" : "Classes"}
                        </div>
                      )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div
            className={`border rounded-[3rem] p-12 text-center space-y-4 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
          >
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isDark ? "bg-slate-800 text-slate-700" : "bg-slate-50 text-slate-300"}`}
            >
              <Users size={40} />
            </div>
            <div>
              <h3
                className={`text-xl font-black font-noto ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {lang === "bn"
                  ? "কোনো শিক্ষক পাওয়া যায়নি"
                  : "No teachers found"}
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-2">
                {lang === "bn"
                  ? "নতুন শিক্ষক যোগ করতে উপরের বাটনে ক্লিক করুন"
                  : "Click the button above to add a new teacher"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-lg rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] ${isDark ? "bg-slate-900" : "bg-white"}`}
            >
              <div
                className={`p-6 border-b flex items-center justify-between shrink-0 ${isDark ? "border-slate-800" : "border-slate-100"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-blue-900/20 text-blue-400" : "bg-blue-50 text-blue-600"}`}
                  >
                    {showAddModal ? (
                      <UserPlus size={20} />
                    ) : (
                      <Edit3 size={20} />
                    )}
                  </div>
                  <h2
                    className={`text-xl font-black font-noto ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {showAddModal
                      ? t("add_teacher", lang)
                      : t("edit_teacher", lang)}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className={`w-10 h-10 rounded-xl text-slate-400 flex items-center justify-center active:scale-90 transition-all ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={showAddModal ? handleAddTeacher : handleUpdateTeacher}
                className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-20"
              >
                {error && (
                  <div
                    className={`border p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${isDark ? "bg-red-900/20 border-red-900/30 text-red-400" : "bg-red-50 border-red-100 text-red-600"}`}
                  >
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          {t("teacher_name", lang)}
                        </label>
                        <div className="relative">
                          <User
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                          />
                          <input
                            type="text"
                            required
                            className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"}`}
                            value={formData.name || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          {t("designation", lang)}
                        </label>
                        <div className="relative">
                          <Briefcase
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                          />
                          <input
                            type="text"
                            className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"}`}
                            value={formData.designation || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                designation: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          {t("phone", lang)}
                        </label>
                        <div className="relative">
                          <Smartphone
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                          />
                          <input
                            type="tel"
                            required
                            className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"}`}
                            value={formData.phone || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                phone: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          {t("password", lang)}
                        </label>
                        <div className="relative">
                          <Lock
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                          />
                          <input
                            type={showPassword ? "text" : "password"}
                            required={showAddModal}
                            placeholder={
                              showEditModal ? "Leave blank to keep current" : ""
                            }
                            className={`w-full pl-11 pr-12 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"}`}
                            value={formData.pin || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, pin: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                    {t("permissions", lang)}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        key: "can_manage_students",
                        label: t("permissions_students", lang),
                        icon: <Users size={14} />,
                      },
                      {
                        key: "can_manage_attendance",
                        label: t("permissions_attendance", lang),
                        icon: <ClipboardCheck size={14} />,
                        module: "attendance",
                      },
                      {
                        key: "can_manage_exams",
                        label: t("permissions_exams", lang),
                        icon: <GraduationCap size={14} />,
                        module: "results",
                      },
                      {
                        key: "can_manage_accounting",
                        label: t("permissions_accounting", lang),
                        icon: <Save size={14} />,
                        module: "accounting",
                      },
                      {
                        key: "can_send_sms",
                        label: t("permissions_sms", lang),
                        icon: <MessageSquare size={14} />,
                        module: "sms",
                      },
                      {
                        key: "can_manage_classes",
                        label:
                          lang === "bn"
                            ? "শ্রেণি ব্যবস্থাপনা"
                            : "Manage Classes",
                        icon: <Layout size={14} />,
                      },
                      {
                        key: "can_use_voice_call",
                        label:
                          lang === "bn" ? "ভয়েস কল ব্যবহার" : "Use Voice Call",
                        icon: <Smartphone size={14} />,
                        module: "voice_broadcast",
                      },
                      {
                        key: "can_manage_teachers",
                        label:
                          lang === "bn"
                            ? "শিক্ষক ব্যবস্থাপনা"
                            : "Manage Teachers",
                        icon: <UserCheck size={14} />,
                      },
                      {
                        key: "can_manage_settings",
                        label:
                          lang === "bn"
                            ? "সেটিংস ব্যবস্থাপনা"
                            : "Manage Settings",
                        icon: <Settings size={14} />,
                      },
                      {
                        key: "can_view_reports",
                        label: lang === "bn" ? "রিপোর্ট দেখা" : "View Reports",
                        icon: <TrendingUp size={14} />,
                      },
                    ].filter((perm: any) => {
                      if (role === 'super_admin') return true;

                      // 1. Check Institution Modules
                      const modules = madrasah?.config_json?.modules || {};
                      if (perm.module && modules[perm.module as keyof typeof modules] === false) {
                        return false;
                      }

                      // 2. Check current user's permissions
                      // If the current user is a teacher, they can only grant what they have.
                      if (role === 'teacher') {
                        return !!profile?.permissions?.[perm.key as keyof TeacherPermissions];
                      }
                      
                      // If the current user is a madrasah_admin, they are restricted by modules (already checked)
                      // and potentially by their own profile.permissions if the Super Admin set them.
                      if (role === 'madrasah_admin') {
                        if (profile?.permissions && typeof profile.permissions === 'object' && perm.key in profile.permissions) {
                           return !!(profile.permissions as any)[perm.key];
                        }
                        return true;
                      }

                      return true;
                    }).map((perm) => (
                      <motion.label
                        key={perm.key}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${permissions[perm.key as keyof TeacherPermissions] ? (isDark ? "bg-blue-900/20 border-blue-900/50" : "bg-blue-50 border-blue-200 shadow-sm") : isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${permissions[perm.key as keyof TeacherPermissions] ? (isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600") : isDark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"}`}
                          >
                            {perm.icon}
                          </div>
                          <span
                            className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}
                          >
                            {perm.label}
                          </span>
                        </div>
                        <div
                          className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${permissions[perm.key as keyof TeacherPermissions] ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}
                        >
                          <div
                            className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${permissions[perm.key as keyof TeacherPermissions] ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={
                            !!permissions[perm.key as keyof TeacherPermissions]
                          }
                          onChange={(e) =>
                            setPermissions({
                              ...permissions,
                              [perm.key]: e.target.checked,
                            })
                          }
                        />
                      </motion.label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                    {lang === "bn"
                      ? "শ্রেণি ভিত্তিক পারমিশন"
                      : "Class Based Permissions"}
                  </h3>
                  <div
                    className={`p-4 rounded-[2rem] border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}
                  >
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">
                      {lang === "bn"
                        ? "শিক্ষক কোন কোন শ্রেণির তথ্য দেখতে পারবেন?"
                        : "Which classes can this teacher access?"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {classes.filter(cls => {
                        if (role === 'super_admin' || role === 'madrasah_admin') return true;
                        if (!profile?.permissions?.allowed_classes || profile.permissions.allowed_classes.length === 0) return true;
                        return profile.permissions.allowed_classes.includes(cls.id);
                      }).map((cls) => {
                        const isSelected =
                          permissions.allowed_classes?.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => {
                              const current = permissions.allowed_classes || [];
                              const next = isSelected
                                ? current.filter((id) => id !== cls.id)
                                : [...current, cls.id];
                              setPermissions({
                                ...permissions,
                                allowed_classes: next,
                              });
                            }}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${isSelected ? (isDark ? "bg-blue-900/30 border-blue-500 text-blue-400" : "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20") : isDark ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-600"}`}
                          >
                            {isSelected ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <BookOpen size={14} />
                            )}
                            <span className="truncate">{cls.class_name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {classes.length === 0 && (
                      <p className="text-center py-4 text-xs font-bold text-slate-400 italic">
                        {lang === "bn"
                          ? "কোনো শ্রেণি পাওয়া যায়নি"
                          : "No classes found"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 shrink-0">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 text-sm uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Save size={20} /> {t("save", lang)}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal - PORTALED */}
      {deleteModal.show &&
        createPortal(
          <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 z-[100]">
            <div
              className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-50"} w-full max-w-sm rounded-[3.5rem] p-8 text-center shadow-2xl border animate-in zoom-in-95 duration-500 relative overflow-hidden`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-red-50 text-red-500 border-red-100 border-4 shadow-inner`}
              >
                <Trash2 size={32} strokeWidth={2.5} />
              </div>
              <h3
                className={`text-xl font-black font-noto leading-tight tracking-tight mb-2 ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
              >
                {lang === "bn" ? "শিক্ষক ডিলিট করবেন?" : "Delete Teacher?"}
              </h3>
              <p className="text-xs font-bold text-slate-400 font-noto px-2 leading-relaxed mb-8">
                {lang === "bn"
                  ? "এই শিক্ষকের সমস্ত তথ্য মুছে যাবে। এই কাজটি আর পরিবর্তন করা যাবে না।"
                  : "All information for this teacher will be deleted. This action cannot be undone."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setDeleteModal({ show: false, teacherId: null })
                  }
                  className={`flex-1 py-4 font-black rounded-2xl text-xs uppercase tracking-widest transition-all ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  onClick={() =>
                    deleteModal.teacherId &&
                    handleDeleteTeacher(deleteModal.teacherId)
                  }
                  className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-red-500/30 transition-all active:scale-95"
                >
                  {lang === "bn" ? "ডিলিট করুন" : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default TeacherManagement;
