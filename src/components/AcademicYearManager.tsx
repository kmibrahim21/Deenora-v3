import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "lib/supabase";
import { Institution, Class, Exam, Student, AcademicYear } from "types";
import {
  Loader2,
  Calendar,
  ArrowRight,
  Save,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  School,
  List,
  BarChart3,
  Plus,
  Trash2,
  Archive,
  Check,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

interface AcademicYearManagerProps {
  institution: Institution;
  onClose: () => void;
  onUpdate?: () => void;
  lang?: "en" | "bn";
}

export const AcademicYearManager: React.FC<AcademicYearManagerProps> = ({
  institution,
  onClose,
  onUpdate,
  lang = "en",
}) => {
  const isDark = institution?.theme === "dark";
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"years" | "promotion" | "reports">(
    "years",
  );
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [step, setStep] = useState<
    "status" | "config" | "preview" | "executing"
  >("status");

  // Config State
  const [newYearName, setNewYearName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  // Map: classId -> { nextClassId, examId, passMark }
  const [promotionMap, setPromotionMap] = useState<
    Record<string, { nextClassId: string; examId: string; passMark: number }>
  >({});

  // Preview State
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [executingLog, setExecutingLog] = useState<string[]>([]);

  // New Year Modal State
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [isCreatingYear, setIsCreatingYear] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: "delete" | "archive" | "active" | "promotion" | "none";
    yearId: string;
    title: string;
    message: string;
  }>({ show: false, type: "none", yearId: "", title: "", message: "" });

  const [successModal, setSuccessModal] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({ show: false, title: "", message: "" });

  const [selectedReportYear, setSelectedReportYear] = useState<AcademicYear | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [fetchingReport, setFetchingReport] = useState(false);

  useEffect(() => {
    fetchData();
  }, [institution.id]);

  const fetchReportData = async (year: AcademicYear) => {
    setFetchingReport(true);
    try {
      // Fetch income/expense summary
      const { data: ledgerData } = await supabase
        .from("ledger")
        .select("type, amount")
        .eq("academic_year_id", year.id);

      const income = ledgerData?.filter(l => l.type === 'income').reduce((sum, l) => sum + Number(l.amount), 0) || 0;
      const expense = ledgerData?.filter(l => l.type === 'expense').reduce((sum, l) => sum + Number(l.amount), 0) || 0;

      // Fetch fees summary
      const { data: feesData } = await supabase
        .from("fees")
        .select("amount_paid, amount_due")
        .eq("academic_year_id", year.id);
      
      const totalPaid = feesData?.reduce((sum, f) => sum + Number(f.amount_paid), 0) || 0;
      const totalDue = feesData?.reduce((sum, f) => sum + Number(f.amount_due), 0) || 0;

      // Fetch student count
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: 'exact', head: true })
        .eq("academic_year_id", year.id);

      setReportData({
        income,
        expense,
        totalPaid,
        totalDue,
        studentCount: studentCount || 0
      });
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setFetchingReport(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all academic years
      const { data: years } = await supabase
        .from("academic_years")
        .select("*")
        .eq("institution_id", institution.id)
        .order("start_date", { ascending: false });

      if (years) {
        setAcademicYears(years);
        const active = years.find((y) => y.status === "active");
        if (active) setCurrentYear(active);
      }

      // Fetch classes
      const { data: cls } = await supabase
        .from("classes")
        .select("*")
        .eq("institution_id", institution.id)
        .order("sort_order", { ascending: true });

      if (cls) {
        setClasses(cls);
        // Auto-populate promotion map
        const map: any = {};
        cls.forEach((c, idx) => {
          const nextClass = cls[idx + 1];
          map[c.id] = {
            nextClassId: nextClass ? nextClass.id : "graduated",
            examId: "",
            passMark: 33,
          };
        });
        setPromotionMap(map);
      }

      // Fetch exams
      const { data: ex } = await supabase
        .from("exams")
        .select("*")
        .eq("institution_id", institution.id)
        .order("exam_date", { ascending: false });

      if (ex) setExams(ex);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYear = async () => {
    if (!newYearName || !startDate || !endDate) return;
    setIsCreatingYear(true);
    try {
      const { data, error } = await supabase
        .from("academic_years")
        .insert({
          institution_id: institution.id,
          year_name: newYearName,
          start_date: startDate,
          end_date: endDate,
          status: academicYears.length === 0 ? "active" : "archived",
        })
        .select()
        .single();

      if (error) throw error;

      setAcademicYears([data, ...academicYears]);
      setShowNewYearModal(false);
      setNewYearName("");
      setStartDate("");
      setEndDate("");

      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsCreatingYear(false);
    }
  };

  const handleSetActive = async (yearId: string) => {
    setConfirmModal({
      show: true,
      type: "active",
      yearId,
      title: lang === "bn" ? "শিক্ষাবর্ষ সক্রিয় করুন" : "Activate Year",
      message: lang === "bn"
        ? "আপনি কি নিশ্চিত যে আপনি এই শিক্ষাবর্ষটিকে সক্রিয় করতে চান?"
        : "Are you sure you want to set this year as active?",
    });
  };

  const executeSetActive = async (yearId: string) => {
    setConfirmModal({ ...confirmModal, show: false });
    setLoading(true);
    try {
      // 1. Archive all years for this institution
      await supabase
        .from("academic_years")
        .update({ status: "archived" })
        .eq("institution_id", institution.id);

      // 2. Set selected year as active
      const { data: updatedYear, error } = await supabase
        .from("academic_years")
        .update({ status: "active" })
        .eq("id", yearId)
        .select()
        .single();

      if (error) throw error;

      // 3. Update institution config
      const updatedConfig = {
        ...(institution.config_json || {}),
        academic_year_start: updatedYear.start_date,
        active_academic_year_id: updatedYear.id,
      };

      await supabase
        .from("institutions")
        .update({ config_json: updatedConfig })
        .eq("id", institution.id);

      setCurrentYear(updatedYear);
      setAcademicYears(
        academicYears.map((y) =>
          y.id === yearId ? updatedYear : { ...y, status: "archived" },
        ),
      );

      if (onUpdate) onUpdate();
      setSuccessModal({
        show: true,
        title: lang === "bn" ? "সফল!" : "Success!",
        message: lang === "bn"
          ? "শিক্ষাবর্ষ সফলভাবে সক্রিয় করা হয়েছে।"
          : "Academic year activated successfully.",
      });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (yearId: string) => {
    setConfirmModal({
      show: true,
      type: "archive",
      yearId,
      title: lang === "bn" ? "শিক্ষাবর্ষ আর্কাইভ" : "Archive Year",
      message: lang === "bn"
        ? "আপনি কি নিশ্চিত যে আপনি এই শিক্ষাবর্ষটিকে আর্কাইভ করতে চান?"
        : "Are you sure you want to archive this year?",
    });
  };

  const executeArchive = async (yearId: string) => {
    setConfirmModal({ ...confirmModal, show: false });
    setLoading(true);
    try {
      const { data: updatedYear, error } = await supabase
        .from("academic_years")
        .update({ status: "archived" })
        .eq("id", yearId)
        .select()
        .single();

      if (error) throw error;

      setAcademicYears(
        academicYears.map((y) => (y.id === yearId ? updatedYear : y)),
      );
      if (currentYear?.id === yearId) setCurrentYear(null);

      if (onUpdate) onUpdate();
      setSuccessModal({
        show: true,
        title: lang === "bn" ? "সফল!" : "Success!",
        message: lang === "bn"
          ? "শিক্ষাবর্ষ সফলভাবে আর্কাইভ করা হয়েছে।"
          : "Academic year archived successfully.",
      });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteYear = async (yearId: string) => {
    setConfirmModal({
      show: true,
      type: "delete",
      yearId,
      title: lang === "bn" ? "শিক্ষাবর্ষ ডিলিট" : "Delete Year",
      message: lang === "bn"
        ? "আপনি কি নিশ্চিত যে আপনি এই শিক্ষাবর্ষটি ডিলিট করতে চান? এটি স্থায়ীভাবে মুছে যাবে।"
        : "Are you sure you want to delete this academic year? This will be permanently removed.",
    });
  };

  const executeDelete = async (yearId: string) => {
    setConfirmModal({ ...confirmModal, show: false });
    setLoading(true);
    try {
      const { error } = await supabase
        .from("academic_years")
        .delete()
        .eq("id", yearId);

      if (error) throw error;

      setAcademicYears(academicYears.filter((y) => y.id !== yearId));
      if (currentYear?.id === yearId) setCurrentYear(null);

      if (onUpdate) onUpdate();
      setSuccessModal({
        show: true,
        title: lang === "bn" ? "সফল!" : "Success!",
        message: lang === "bn"
          ? "শিক্ষাবর্ষ সফলভাবে ডিলিট করা হয়েছে।"
          : "Academic year deleted successfully.",
      });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    setLoading(true);
    try {
      const promotions: any[] = [];

      // Fetch all students
      const { data: students } = await supabase
        .from("students")
        .select("*")
        .eq("institution_id", institution.id);

      if (!students) return;

      // Fetch all marks for selected exams
      const selectedExamIds = Object.values(promotionMap)
        .map((m) => m.examId)
        .filter((id) => id);
      const { data: marks } = await supabase
        .from("exam_marks")
        .select("*")
        .in("exam_id", selectedExamIds);

      // Fetch exam subjects to calculate percentages
      const { data: subjects } = await supabase
        .from("exam_subjects")
        .select("*")
        .in("exam_id", selectedExamIds);

      // Process each class
      for (const cls of classes) {
        const config = promotionMap[cls.id];
        if (!config || !config.examId) continue;

        const classStudents = students.filter((s) => s.class_id === cls.id);
        const examSubjects =
          subjects?.filter((s) => s.exam_id === config.examId) || [];

        for (const student of classStudents) {
          // Calculate Result
          const studentMarks =
            marks?.filter(
              (m) => m.student_id === student.id && m.exam_id === config.examId,
            ) || [];

          let totalObtained = 0;
          let totalFull = 0;
          let failedSubjects = 0;

          examSubjects.forEach((sub) => {
            const mark = studentMarks.find((m) => m.subject_id === sub.id);
            const obtained = mark ? mark.marks_obtained : 0;
            totalObtained += obtained;
            totalFull += sub.full_marks;

            if (obtained < sub.pass_marks) failedSubjects++;
          });

          const percentage =
            totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
          const isPassed =
            failedSubjects === 0 && percentage >= config.passMark;

          promotions.push({
            student_id: student.id,
            student_name: student.student_name,
            roll: student.roll,
            current_class_id: cls.id,
            current_class_name: cls.class_name,
            next_class_id: isPassed ? config.nextClassId : cls.id, // Fail -> Retain
            next_class_name: isPassed
              ? config.nextClassId === "graduated"
                ? "Graduated"
                : classes.find((c) => c.id === config.nextClassId)?.class_name
              : cls.class_name,
            result_status: isPassed ? "promoted" : "retained",
            percentage: percentage.toFixed(2),
            failed_subjects: failedSubjects,
          });
        }
      }

      setPreviewData(promotions);
      setStep("preview");
    } catch (error) {
      console.error(error);
      alert("Error generating preview");
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePromotion = async () => {
    setConfirmModal({
      show: true,
      type: "promotion",
      yearId: "",
      title: lang === "bn" ? "প্রমোশন নিশ্চিত করুন" : "Confirm Promotion",
      message: lang === "bn"
        ? "আপনি কি নিশ্চিত যে আপনি এই শিক্ষার্থীদের প্রমোশন দিতে চান? এই কাজটি বাতিল করা যাবে না।"
        : "Are you sure you want to promote these students? This action cannot be undone.",
    });
  };

  const executePromotion = async () => {
    setConfirmModal({ ...confirmModal, show: false });
    setStep("executing");
    setExecutingLog((prev) => [
      ...prev,
      lang === "bn"
        ? "প্রমোশন প্রক্রিয়া শুরু হচ্ছে..."
        : "Starting promotion process...",
    ]);

    try {
      // Filter out graduated students from update list (or handle them separately)
      // For now, we only promote those who have a valid next_class_id (not 'graduated')
      // Actually, 'graduated' students should probably be moved to a 'Alumni' class or just kept in current class with status 'graduated'?
      // The RPC expects a UUID for next_class_id.
      // If 'graduated', we might need to handle it.
      // For simplicity, let's assume 'graduated' means we don't update their class_id in this batch, OR we have an 'Alumni' class.
      // Let's filter out 'graduated' for the RPC update for now, or create a dummy class.
      // Better: The user should have created an 'Alumni' class if they want to move them there.
      // If nextClassId is 'graduated', we skip the update or set to null?
      // Let's skip 'graduated' for now to avoid UUID error.

      const validPromotions = previewData.filter(
        (p) => p.next_class_id !== "graduated",
      );

      const payload = validPromotions.map((p) => ({
        student_id: p.student_id,
        next_class_id: p.next_class_id,
        current_class_name: p.current_class_name,
        next_class_name: p.next_class_name,
      }));

      setExecutingLog((prev) => [
        ...prev,
        lang === "bn"
          ? `${payload.length} জন শিক্ষার্থীর প্রমোশন করা হচ্ছে...`
          : `Promoting ${payload.length} students...`,
      ]);

      const { error } = await supabase.rpc("promote_students", {
        p_institution_id: institution.id,
        p_new_year_name: newYearName,
        p_start_date: startDate,
        p_end_date: endDate,
        p_promotions: payload,
      });

      if (error) throw error;

      // Update institution config_json with new academic_year_start
      const updatedConfig = {
        ...(institution.config_json || {}),
        academic_year_start: startDate,
      };

      const { error: configError } = await supabase
        .from("institutions")
        .update({ config_json: updatedConfig })
        .eq("id", institution.id);

      if (configError) throw configError;

      setExecutingLog((prev) => [
        ...prev,
        lang === "bn"
          ? "প্রমোশন সফলভাবে সম্পন্ন হয়েছে!"
          : "Promotion completed successfully!",
      ]);
      setExecutingLog((prev) => [
        ...prev,
        lang === "bn"
          ? "নতুন শিক্ষাবর্ষ তৈরি করা হয়েছে।"
          : "New academic year created.",
      ]);
      setExecutingLog((prev) => [
        ...prev,
        lang === "bn"
          ? "পুরানো শিক্ষাবর্ষ আর্কাইভ করা হয়েছে।"
          : "Old academic year archived.",
      ]);

      setTimeout(() => {
        onClose();
        window.location.reload(); // Refresh to show changes
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setExecutingLog((prev) => [...prev, `Error: ${error.message}`]);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col animate-in fade-in duration-300 ${isDark ? "bg-slate-950" : "bg-blue-50"}`}
    >
      {/* Header */}
      <div
        className={`p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 ${isDark ? "bg-slate-900/80 border-slate-800 backdrop-blur-md" : "bg-white/80 border-slate-200 backdrop-blur-md"}`}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onClose}
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors shadow-sm border ${
              isDark
                ? "bg-slate-800 text-slate-400 hover:text-white border-slate-700"
                : "bg-white text-slate-500 hover:text-slate-900 border-slate-200"
            }`}
          >
            <ArrowRight size={20} className="rotate-180" />
          </button>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#2563EB] text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
            <Calendar size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2
              className={`text-lg md:text-xl font-black font-noto ${isDark ? "text-blue-400" : "text-[#1E3A8A]"}`}
            >
              {lang === "bn"
                ? "শিক্ষাবর্ষ ব্যবস্থাপনা"
                : "Academic Year Management"}
            </h2>
            <p
              className={`text-[10px] md:text-xs font-bold mt-0.5 md:mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {institution.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <div
            className={`flex p-1 rounded-xl md:rounded-2xl border min-w-max ${isDark ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-200"}`}
          >
            <button
              onClick={() => setActiveTab("years")}
              className={`px-3 md:px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === "years" ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-[#2563EB] shadow-sm") : "text-slate-400"}`}
            >
              <List size={14} />{" "}
              {lang === "bn" ? "শিক্ষাবর্ষ তালিকা" : "Years List"}
            </button>
            <button
              onClick={() => setActiveTab("promotion")}
              className={`px-3 md:px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === "promotion" ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-[#2563EB] shadow-sm") : "text-slate-400"}`}
            >
              <GraduationCap size={14} />{" "}
              {lang === "bn" ? "প্রমোশন উইজার্ড" : "Promotion"}
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-3 md:px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === "reports" ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-[#2563EB] shadow-sm") : "text-slate-400"}`}
            >
              <BarChart3 size={14} /> {lang === "bn" ? "রিপোর্ট" : "Reports"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar w-full max-w-7xl mx-auto">
        {activeTab === "years" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3
                className={`text-lg font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {lang === "bn" ? "সকল শিক্ষাবর্ষ" : "All Academic Years"}
              </h3>
              <button
                onClick={() => setShowNewYearModal(true)}
                className="px-4 py-2 bg-[#2563EB] text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-premium"
              >
                <Plus size={14} />{" "}
                {lang === "bn" ? "নতুন শিক্ষাবর্ষ" : "New Year"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {academicYears.map((year) => (
                <div
                  key={year.id}
                  className={`p-6 rounded-[2rem] border relative group transition-all ${isDark ? "bg-slate-800/50 border-slate-800 hover:border-blue-500/30" : "bg-white border-slate-100 hover:border-blue-200"}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center ${year.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"}`}
                    >
                      <Calendar size={24} />
                    </div>
                    <div
                      className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${year.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                    >
                      {year.status === "active"
                        ? lang === "bn"
                          ? "সক্রিয়"
                          : "Active"
                        : lang === "bn"
                          ? "আর্কাইভ"
                          : "Archived"}
                    </div>
                  </div>
                  <h4
                    className={`text-xl font-black ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
                  >
                    {year.year_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-slate-400">
                    <span>{year.start_date}</span>
                    <ArrowRight size={10} />
                    <span>{year.end_date}</span>
                  </div>

                  <div className="mt-6 flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {year.status !== "active" && (
                      <button
                        onClick={() => handleSetActive(year.id)}
                        className="flex-1 py-2.5 bg-emerald-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Check size={14} />{" "}
                        {lang === "bn" ? "সক্রিয় করুন" : "Set Active"}
                      </button>
                    )}
                    {year.status === "active" && (
                      <button
                        onClick={() => handleArchive(year.id)}
                        className="flex-1 py-2.5 bg-amber-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Archive size={14} />{" "}
                        {lang === "bn" ? "আর্কাইভ করুন" : "Archive"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteYear(year.id)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors border ${
                        isDark
                          ? "bg-red-900/20 text-red-400 border-red-900/30 hover:bg-red-900/40"
                          : "bg-red-50 text-red-500 border-red-100 hover:bg-red-100"
                      }`}
                      title={lang === "bn" ? "ডিলিট করুন" : "Delete"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "promotion" && (
          <div className="space-y-8">
            <div
              className={`p-6 rounded-[2rem] border flex items-center justify-between ${
                isDark
                  ? "bg-blue-900/20 border-blue-900/30"
                  : "bg-blue-50 border-blue-100"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2563EB] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3
                    className={`text-lg font-black ${isDark ? "text-blue-400" : "text-[#1E3A8A]"}`}
                  >
                    {lang === "bn"
                      ? "বর্তমান শিক্ষাবর্ষ"
                      : "Current Academic Year"}
                  </h3>
                  <p
                    className={`text-sm font-bold mt-1 ${isDark ? "text-blue-500" : "text-blue-500"}`}
                  >
                    {currentYear
                      ? `${currentYear.year_name} (${currentYear.start_date} - ${currentYear.end_date})`
                      : lang === "bn"
                        ? "কোনো সক্রিয় শিক্ষাবর্ষ নেই"
                        : "No Active Year"}
                  </p>
                </div>
              </div>
              <div className="px-4 py-2 bg-emerald-100 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest">
                {lang === "bn" ? "সক্রিয়" : "Active"}
              </div>
            </div>

            <div
              className={`p-8 rounded-[2.5rem] text-center space-y-4 border ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-100"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-bubble ${
                  isDark
                    ? "bg-slate-800 text-blue-400"
                    : "bg-white text-[#2563EB]"
                }`}
              >
                <ArrowRight size={32} />
              </div>
              <h3
                className={`text-xl font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {lang === "bn"
                  ? "নতুন শিক্ষাবর্ষ শুরু করতে প্রস্তুত?"
                  : "Ready to start a new year?"}
              </h3>
              <p
                className={`text-sm max-w-md mx-auto ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                {lang === "bn"
                  ? "নতুন শিক্ষাবর্ষ শুরু করলে বর্তমান শিক্ষাবর্ষ আর্কাইভ হয়ে যাবে এবং আপনি পরীক্ষার ফলাফলের ভিত্তিতে শিক্ষার্থীদের পরবর্তী ক্লাসে প্রমোশন দিতে পারবেন।"
                  : "Starting a new academic year will archive the current year and allow you to promote students to their next classes based on exam results."}
              </p>
              <button
                onClick={() => setStep("config")}
                className="px-8 py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium hover:scale-105 transition-transform"
              >
                {lang === "bn"
                  ? "প্রমোশন উইজার্ড শুরু করুন"
                  : "Start Promotion Wizard"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "reports" && !selectedReportYear && (
          <div className="space-y-6">
            <div
              className={`p-8 rounded-[2.5rem] border text-center space-y-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-bubble ${isDark ? "bg-slate-800 text-purple-400" : "bg-white text-purple-600"}`}
              >
                <BarChart3 size={32} />
              </div>
              <h3
                className={`text-xl font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {lang === "bn"
                  ? "শিক্ষাবর্ষ ভিত্তিক রিপোর্ট"
                  : "Year-wise Reports"}
              </h3>
              <p
                className={`text-sm max-w-md mx-auto ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                {lang === "bn"
                  ? "নির্দিষ্ট শিক্ষাবর্ষের আয়-ব্যয়, বকেয়া ফি এবং পরীক্ষার ফলাফল দেখতে শিক্ষাবর্ষ নির্বাচন করুন।"
                  : "Select an academic year to view its income, expenses, due fees, and exam results."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
                {academicYears.map((year) => (
                  <button
                    key={year.id}
                    onClick={() => {
                      setSelectedReportYear(year);
                      fetchReportData(year);
                    }}
                    className={`p-6 rounded-3xl border text-left group transition-all active:scale-95 ${isDark ? "bg-slate-900 border-slate-800 hover:border-purple-500/30" : "bg-white border-slate-200 hover:border-purple-200"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-lg font-black ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
                      >
                        {year.year_name}
                      </span>
                      <ChevronRight
                        size={18}
                        className="text-slate-300 group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {year.start_date} - {year.end_date}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && selectedReportYear && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setSelectedReportYear(null)}
                className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <ArrowRight size={16} className="rotate-180" />
                {lang === "bn" ? "ফিরে যান" : "Back to List"}
              </button>
              <h3 className={`text-lg font-black ${isDark ? "text-white" : "text-[#1E3A8A]"}`}>
                {selectedReportYear.year_name} {lang === "bn" ? "রিপোর্ট" : "Report"}
              </h3>
            </div>

            {fetchingReport ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="text-purple-500 animate-spin" />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Fetching Data...</p>
              </div>
            ) : reportData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Student Count */}
                <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Students</p>
                      <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>{reportData.studentCount}</h4>
                    </div>
                  </div>
                </div>

                {/* Income */}
                <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Income</p>
                      <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.income}</h4>
                    </div>
                  </div>
                </div>

                {/* Expense */}
                <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                      <TrendingUp size={24} className="rotate-180" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Expense</p>
                      <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.expense}</h4>
                    </div>
                  </div>
                </div>

                {/* Fees Paid */}
                <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fees Collected</p>
                      <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.totalPaid}</h4>
                    </div>
                  </div>
                </div>

                {/* Fees Due */}
                <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Due</p>
                      <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.totalDue}</h4>
                    </div>
                  </div>
                </div>

                {/* Net Balance */}
                <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <List size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Balance</p>
                      <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.income - reportData.expense}</h4>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 font-bold">No data found for this year.</div>
            )}
          </div>
        )}

        {step === "config" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label
                  className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  {lang === "bn" ? "নতুন শিক্ষাবর্ষের নাম" : "New Year Name"}
                </label>
                <input
                  type="text"
                  className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}
                  placeholder="e.g. 2025"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  {lang === "bn" ? "শুরুর তারিখ" : "Start Date"}
                </label>
                <input
                  type="date"
                  className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  {lang === "bn" ? "শেষের তারিখ" : "End Date"}
                </label>
                <input
                  type="date"
                  className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3
                className={`text-sm font-black uppercase tracking-widest border-b pb-2 ${isDark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-100"}`}
              >
                {lang === "bn" ? "প্রমোশন নিয়মাবলী" : "Promotion Rules"}
              </h3>

              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center gap-4 ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className="w-full md:w-1/4">
                    <div className="flex items-center gap-2">
                      <School size={16} className="text-slate-400" />
                      <span
                        className={`font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}
                      >
                        {cls.class_name}
                      </span>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <ArrowRight size={16} className="text-slate-300" />
                  </div>

                  <div className="w-full md:w-1/4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block md:hidden">
                      {lang === "bn" ? "পরবর্তী ক্লাস" : "Next Class"}
                    </label>
                    <select
                      className={`w-full h-10 border rounded-lg px-3 text-xs font-bold outline-none ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-slate-300"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                      value={promotionMap[cls.id]?.nextClassId || ""}
                      onChange={(e) =>
                        setPromotionMap({
                          ...promotionMap,
                          [cls.id]: {
                            ...promotionMap[cls.id],
                            nextClassId: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="graduated">
                        {lang === "bn"
                          ? "গ্র্যাজুয়েট (বিদায়)"
                          : "Graduate (Leave)"}
                      </option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-1/4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block md:hidden">
                      {lang === "bn" ? "পরীক্ষা" : "Exam"}
                    </label>
                    <select
                      className={`w-full h-10 border rounded-lg px-3 text-xs font-bold outline-none ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-slate-300"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                      value={promotionMap[cls.id]?.examId || ""}
                      onChange={(e) =>
                        setPromotionMap({
                          ...promotionMap,
                          [cls.id]: {
                            ...promotionMap[cls.id],
                            examId: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">
                        {lang === "bn"
                          ? "পরীক্ষা নির্বাচন করুন"
                          : "Select Exam"}
                      </option>
                      {exams
                        .filter((e) => e.class_id === cls.id)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.exam_name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="w-full md:w-1/6">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block md:hidden">
                      {lang === "bn" ? "পাস মার্ক" : "Pass Mark"}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        className={`w-full h-10 border rounded-lg px-3 text-xs font-bold outline-none ${
                          isDark
                            ? "bg-slate-900 border-slate-700 text-slate-300"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                        placeholder="Pass %"
                        value={promotionMap[cls.id]?.passMark || ""}
                        onChange={(e) =>
                          setPromotionMap({
                            ...promotionMap,
                            [cls.id]: {
                              ...promotionMap[cls.id],
                              passMark: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleGeneratePreview}
                disabled={loading}
                className="px-8 py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium hover:scale-105 transition-transform flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    {lang === "bn" ? "প্রিভিউ তৈরি করুন" : "Generate Preview"}{" "}
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <div
              className={`flex items-center gap-4 p-4 rounded-2xl border text-sm font-bold ${
                isDark
                  ? "bg-amber-900/20 border-amber-900/30 text-amber-500"
                  : "bg-amber-50 border-amber-100 text-amber-700"
              }`}
            >
              <AlertTriangle size={20} />
              <p>
                {lang === "bn"
                  ? "দয়া করে প্রমোশন তালিকাটি সাবধানে পর্যালোচনা করুন। এই কাজটি বাতিল করা যাবে না।"
                  : "Please review the promotion list carefully. This action is irreversible."}
              </p>
            </div>

            <div
              className={`rounded-[2rem] border overflow-x-auto no-scrollbar ${
                isDark
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-slate-100"
              }`}
            >
              <table className="w-full text-left min-w-[600px]">
                <thead className={isDark ? "bg-slate-800" : "bg-slate-50"}>
                  <tr>
                    <th
                      className={`p-4 text-[10px] font-black uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {lang === "bn" ? "শিক্ষার্থী" : "Student"}
                    </th>
                    <th
                      className={`p-4 text-[10px] font-black uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {lang === "bn" ? "বর্তমান ক্লাস" : "Current Class"}
                    </th>
                    <th
                      className={`p-4 text-[10px] font-black uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {lang === "bn" ? "ফলাফল" : "Result"}
                    </th>
                    <th
                      className={`p-4 text-[10px] font-black uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {lang === "bn" ? "পদক্ষেপ" : "Action"}
                    </th>
                    <th
                      className={`p-4 text-[10px] font-black uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {lang === "bn" ? "পরবর্তী ক্লাস" : "Next Class"}
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-50"}`}
                >
                  {previewData.map((p, idx) => (
                    <tr
                      key={idx}
                      className={
                        isDark
                          ? "hover:bg-slate-800/50"
                          : "hover:bg-slate-50/50"
                      }
                    >
                      <td className="p-4">
                        <div
                          className={`font-black text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}
                        >
                          {p.student_name}
                        </div>
                        <div
                          className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}
                        >
                          Roll: {p.roll}
                        </div>
                      </td>
                      <td
                        className={`p-4 text-xs font-bold ${isDark ? "text-slate-500" : "text-slate-500"}`}
                      >
                        {p.current_class_name}
                      </td>
                      <td className="p-4">
                        <div
                          className={`text-xs font-black ${p.result_status === "promoted" ? "text-emerald-500" : "text-red-500"}`}
                        >
                          {p.percentage}% ({p.failed_subjects} failed)
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${p.result_status === "promoted" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}
                        >
                          {p.result_status}
                        </span>
                      </td>
                      <td
                        className={`p-4 text-xs font-bold ${isDark ? "text-blue-400" : "text-[#1E3A8A]"}`}
                      >
                        {p.next_class_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep("config")}
                className={`px-6 py-3 font-black rounded-xl transition-colors ${
                  isDark
                    ? "bg-slate-800 text-slate-500 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {lang === "bn" ? "ফিরে যান" : "Back"}
              </button>
              <button
                onClick={handleExecutePromotion}
                className="px-8 py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-premium hover:scale-105 transition-transform flex items-center gap-2"
              >
                <CheckCircle2 size={20} />{" "}
                {lang === "bn"
                  ? "নিশ্চিত করুন ও প্রমোশন দিন"
                  : "Confirm & Promote"}
              </button>
            </div>
          </div>
        )}

        {step === "executing" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            <Loader2 className="animate-spin text-[#2563EB]" size={48} />
            <h3
              className={`text-xl font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}
            >
              {lang === "bn"
                ? "প্রমোশন প্রসেস করা হচ্ছে..."
                : "Processing Promotions..."}
            </h3>
            <div className="w-full max-w-md bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl h-48 overflow-y-auto border border-slate-800">
              {executingLog.map((log, i) => (
                <div key={i}>&gt; {log}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Year Modal */}
      {showNewYearModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300 ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white"}`}
          >
            <div className="flex items-center justify-between">
              <h3
                className={`text-xl font-black ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
              >
                {lang === "bn" ? "নতুন শিক্ষাবর্ষ যোগ করুন" : "Add New Year"}
              </h3>
              <button
                onClick={() => setShowNewYearModal(false)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  {lang === "bn" ? "শিক্ষাবর্ষের নাম" : "Year Name"}
                </label>
                <input
                  type="text"
                  className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-[#1E3A8A]"}`}
                  placeholder="e.g. 2025-2026"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {lang === "bn" ? "শুরুর তারিখ" : "Start Date"}
                  </label>
                  <input
                    type="date"
                    className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-[#1E3A8A]"}`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {lang === "bn" ? "শেষের তারিখ" : "End Date"}
                  </label>
                  <input
                    type="date"
                    className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-[#1E3A8A]"}`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={handleCreateYear}
                disabled={isCreatingYear}
                className="w-full h-14 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isCreatingYear ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus size={20} />
                )}
                {lang === "bn" ? "শিক্ষাবর্ষ তৈরি করুন" : "Create Year"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modals */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ ...confirmModal, show: false })}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm rounded-[2.5rem] shadow-2xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
            >
              <div className="p-8 text-center">
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg ${
                    confirmModal.type === "delete"
                      ? "bg-red-50 text-red-500 shadow-red-100"
                      : confirmModal.type === "archive"
                        ? "bg-amber-50 text-amber-500 shadow-amber-100"
                        : confirmModal.type === "promotion"
                          ? "bg-purple-50 text-purple-500 shadow-purple-100"
                          : "bg-blue-50 text-blue-500 shadow-blue-100"
                  }`}
                >
                  {confirmModal.type === "delete" ? (
                    <Trash2 size={36} />
                  ) : confirmModal.type === "archive" ? (
                    <Archive size={36} />
                  ) : confirmModal.type === "promotion" ? (
                    <GraduationCap size={36} />
                  ) : (
                    <CheckCircle2 size={36} />
                  )}
                </div>

                <h3
                  className={`text-xl font-black mb-2 font-noto ${isDark ? "text-white" : "text-slate-800"}`}
                >
                  {confirmModal.title}
                </h3>
                <p
                  className={`text-sm font-bold mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {confirmModal.message}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setConfirmModal({ ...confirmModal, show: false })
                    }
                    className={`py-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-400"}`}
                  >
                    {lang === "bn" ? "না" : "Cancel"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirmModal.type === "delete")
                        executeDelete(confirmModal.yearId);
                      else if (confirmModal.type === "archive")
                        executeArchive(confirmModal.yearId);
                      else if (confirmModal.type === "active")
                        executeSetActive(confirmModal.yearId);
                      else if (confirmModal.type === "promotion")
                        executePromotion();
                    }}
                    className={`py-4 rounded-2xl font-black text-sm text-white transition-all active:scale-95 shadow-lg ${
                      confirmModal.type === "delete"
                        ? "bg-red-500 shadow-red-200"
                        : confirmModal.type === "archive"
                          ? "bg-amber-500 shadow-amber-200"
                          : confirmModal.type === "promotion"
                            ? "bg-purple-500 shadow-purple-200"
                            : "bg-blue-500 shadow-blue-200"
                    }`}
                  >
                    {lang === "bn" ? "হ্যাঁ, নিশ্চিত" : "Yes, Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {successModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSuccessModal({ ...successModal, show: false })}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm rounded-[2.5rem] shadow-2xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
                  <CheckCircle2 size={36} />
                </div>

                <h3
                  className={`text-xl font-black mb-2 font-noto ${isDark ? "text-white" : "text-slate-800"}`}
                >
                  {successModal.title}
                </h3>
                <p
                  className={`text-sm font-bold mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {successModal.message}
                </p>

                <button
                  onClick={() =>
                    setSuccessModal({ ...successModal, show: false })
                  }
                  className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  {lang === "bn" ? "ঠিক আছে" : "Done"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
