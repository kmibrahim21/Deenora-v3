import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "lib/supabase";
import { requestManager } from "services/RequestManager";
import { hardReload } from "utils/reloadUtils";
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
  RefreshCw,
} from "lucide-react";

import { sortMadrasahClasses } from "pages/Classes";

interface AcademicYearManagerProps {
  institution: Institution;
  onClose: () => void;
  onUpdate?: () => void;
  lang?: "en" | "bn";
  selectedViewingYear?: AcademicYear | null;
  onSelectViewingYear?: (year: AcademicYear | null) => void;
  onResetViewingYear?: () => void;
}

export const AcademicYearManager: React.FC<AcademicYearManagerProps> = ({
  institution,
  onClose,
  onUpdate,
  lang = "en",
  selectedViewingYear,
  onSelectViewingYear,
  onResetViewingYear,
}) => {
  const isDark = institution?.theme === "dark";
  const isPromotionActive = React.useMemo(() => {
    let configObj: any = {};
    if (institution?.config_json) {
      if (typeof institution.config_json === 'string') {
        try { configObj = JSON.parse(institution.config_json); } catch (e) { configObj = {}; }
      } else {
        configObj = institution.config_json;
      }
    }
    return configObj.modules?.academic_year_promotion ?? false;
  }, [institution]);

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
  const [hijriStartDate, setHijriStartDate] = useState("");
  const [hijriEndDate, setHijriEndDate] = useState("");
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
  const [viewConfirmYear, setViewConfirmYear] = useState<AcademicYear | null>(null);
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

      // Fetch student count & list
      const { data: yearStudents, count: studentCount } = await supabase
        .from("students")
        .select("id, student_name, name_en, roll, class_id, guardian_phone, classes(class_name)", { count: 'exact' })
        .eq("academic_year_id", year.id)
        .order("roll", { ascending: true })
        .limit(100);

      // Fetch exams summary
      const { data: yearExams } = await supabase
        .from("exams")
        .select("id, name, exam_date, is_published")
        .eq("academic_year_id", year.id);

      setReportData({
        income,
        expense,
        totalPaid,
        totalDue,
        studentCount: studentCount || 0,
        students: yearStudents || [],
        exams: yearExams || []
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
        const sorted = sortMadrasahClasses(cls);
        setClasses(sorted);
        // Auto-populate promotion map
        const map: any = {};
        sorted.forEach((c, idx) => {
          const nextClass = sorted[idx + 1];
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
    if (!isPromotionActive) return;
    if (!newYearName || !startDate || !endDate) return;
    setIsCreatingYear(true);
    try {
      const isFirstYear = academicYears.length === 0;
      const { data, error } = await supabase
        .from("academic_years")
        .insert({
          institution_id: institution.id,
          year_name: newYearName,
          start_date: startDate,
          end_date: endDate,
          hijri_start_date: hijriStartDate || null,
          hijri_end_date: hijriEndDate || null,
          status: isFirstYear ? "active" : "archived",
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidate Pattern-based caches
      requestManager.invalidatePattern(`academic_years:${institution.id}`);
      requestManager.invalidatePattern(`stats:${institution.id}`);
      requestManager.invalidatePattern(`dashboard_`);

      if (isFirstYear) {
        // Update institution config if it's the first year
        const updatedConfig = {
          ...(institution.config_json || {}),
          academic_year_start: data.start_date,
          active_academic_year_id: data.id,
        };

        await supabase
          .from("institutions")
          .update({ config_json: updatedConfig })
          .eq("id", institution.id);
          
        setCurrentYear(data);
      }

      setAcademicYears([data, ...academicYears]);
      setShowNewYearModal(false);
      setNewYearName("");
      setStartDate("");
      setEndDate("");
      setHijriStartDate("");
      setHijriEndDate("");

      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsCreatingYear(false);
    }
  };

  const handleSetActive = async (yearId: string) => {
    if (!isPromotionActive) return;
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

      // Invalidate ALL caches as active year affects everything
      requestManager.invalidatePattern(`academic_years:${institution.id}`);
      requestManager.invalidatePattern(`students:${institution.id}`);
      requestManager.invalidatePattern(`fees:${institution.id}`);
      requestManager.invalidatePattern(`stats:${institution.id}`);
      requestManager.invalidatePattern('fetch:ledger:');
      requestManager.invalidatePattern(`dashboard_`);

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
    if (!isPromotionActive) return;
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

      // Invalidate caches
      requestManager.invalidatePattern(`academic_years:${institution.id}`);
      requestManager.invalidatePattern(`dashboard_`);

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
    if (!isPromotionActive) return;
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

      // Invalidate caches
      requestManager.invalidatePattern(`academic_years:${institution.id}`);
      requestManager.invalidatePattern(`dashboard_`);

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
    if (!isPromotionActive) return;
    if (!newYearName || !startDate || !endDate) {
      alert(
        lang === "bn"
          ? "অনুগ্রহ করে নতুন শিক্ষাবর্ষের নাম, শুরুর তারিখ এবং শেষের তারিখ লিখুন।"
          : "Please enter new year name, start date, and end date.",
      );
      return;
    }

    setLoading(true);
    try {
      const promotions: any[] = [];

      // Fetch all students
      const { data: students, error: stdErr } = await supabase
        .from("students")
        .select("*")
        .eq("institution_id", institution.id);

      if (stdErr) throw stdErr;
      if (!students) {
        setPreviewData([]);
        setStep("preview");
        return;
      }

      // Collect selected exam IDs
      const selectedExamIds = Object.values(promotionMap)
        .map((m) => m.examId)
        .filter((id) => id && id.trim() !== "");

      let marks: any[] = [];
      let subjects: any[] = [];

      if (selectedExamIds.length > 0) {
        const { data: marksData } = await supabase
          .from("exam_marks")
          .select("*")
          .in("exam_id", selectedExamIds);
        marks = marksData || [];

        const { data: subjectsData } = await supabase
          .from("exam_subjects")
          .select("*")
          .in("exam_id", selectedExamIds);
        subjects = subjectsData || [];
      }

      // Process each class
      for (const cls of classes) {
        const config = promotionMap[cls.id];
        const targetNextClassId = config?.nextClassId || cls.id;
        const classStudents = students.filter((s) => s.class_id === cls.id);

        const hasExam = Boolean(config?.examId && config.examId.trim() !== "");
        const passMarkVal =
          config?.passMark !== undefined &&
          config?.passMark !== null &&
          !isNaN(config.passMark)
            ? Number(config.passMark)
            : 0;

        const examSubjects = hasExam
          ? subjects.filter((s) => s.exam_id === config.examId)
          : [];

        for (const student of classStudents) {
          let isPassed = true;
          let percentageStr = "-";
          let failedSubjects = 0;

          if (hasExam) {
            const studentMarks = marks.filter(
              (m) => m.student_id === student.id && m.exam_id === config.examId,
            );

            let totalObtained = 0;
            let totalFull = 0;

            examSubjects.forEach((sub) => {
              const mark = studentMarks.find((m) => m.subject_id === sub.id);
              const obtained = mark ? Number(mark.marks_obtained || 0) : 0;
              totalObtained += obtained;
              totalFull += Number(sub.full_marks || 0);

              if (sub.pass_marks && obtained < Number(sub.pass_marks)) {
                failedSubjects++;
              }
            });

            const percentage =
              totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
            percentageStr = percentage.toFixed(2);

            if (failedSubjects > 0 || (passMarkVal > 0 && percentage < passMarkVal)) {
              isPassed = false;
            }
          }

          const finalNextClassId = isPassed ? targetNextClassId : cls.id;
          let nextClassName = cls.class_name;
          if (isPassed) {
            if (targetNextClassId === "graduated") {
              nextClassName = lang === "bn" ? "বিদায় (গ্র্যাজুয়েট)" : "Graduated";
            } else {
              nextClassName =
                classes.find((c) => c.id === targetNextClassId)?.class_name ||
                cls.class_name;
            }
          }

          promotions.push({
            student_id: student.id,
            student_name: student.student_name,
            roll: student.roll,
            current_class_id: cls.id,
            current_class_name: cls.class_name,
            next_class_id: finalNextClassId,
            next_class_name: nextClassName,
            result_status: isPassed
              ? targetNextClassId === "graduated"
                ? "graduated"
                : targetNextClassId === cls.id
                  ? "retained"
                  : "promoted"
              : "retained",
            percentage: percentageStr,
            failed_subjects: failedSubjects,
            has_exam: hasExam,
          });
        }
      }

      setPreviewData(promotions);
      setStep("preview");
    } catch (error: any) {
      console.error("Error generating promotion preview:", error);
      alert(
        error.message ||
          (lang === "bn"
            ? "প্রিভিউ তৈরি করতে সমস্যা হয়েছে"
            : "Error generating preview"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePromotion = async () => {
    if (!isPromotionActive) return;
    setConfirmModal({
      show: true,
      type: "promotion",
      yearId: "",
      title: lang === "bn" ? "প্রমোশন নিশ্চিত করুন" : "Confirm Promotion",
      message:
        lang === "bn"
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
      // Step 1: Ensure new academic year record exists and is set to active
      let newYearId = "";
      
      const { data: existingYears } = await supabase
        .from("academic_years")
        .select("*")
        .eq("institution_id", institution.id)
        .eq("year_name", newYearName);

      if (existingYears && existingYears.length > 0) {
        newYearId = existingYears[0].id;
        // Archive all other years
        await supabase
          .from("academic_years")
          .update({ status: "archived" })
          .eq("institution_id", institution.id);

        // Activate matching year
        await supabase
          .from("academic_years")
          .update({
            status: "active",
            start_date: startDate,
            end_date: endDate,
            hijri_start_date: hijriStartDate || null,
            hijri_end_date: hijriEndDate || null,
          })
          .eq("id", newYearId);
      } else {
        // Archive all existing years first
        await supabase
          .from("academic_years")
          .update({ status: "archived" })
          .eq("institution_id", institution.id);

        // Insert new active year
        const { data: createdYear, error: createError } = await supabase
          .from("academic_years")
          .insert({
            institution_id: institution.id,
            year_name: newYearName,
            start_date: startDate,
            end_date: endDate,
            hijri_start_date: hijriStartDate || null,
            hijri_end_date: hijriEndDate || null,
            status: "active",
          })
          .select()
          .single();

        if (createError) throw createError;
        if (createdYear) newYearId = createdYear.id;
      }

      setExecutingLog((prev) => [
        ...prev,
        lang === "bn"
          ? `নতুন শিক্ষাবর্ষ "${newYearName}" তৈরি ও সক্রিয় করা হয়েছে।`
          : `New academic year "${newYearName}" created and activated.`,
      ]);

      // Step 2: Prepare promotions payload (filter non-graduated)
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
          ? `${payload.length} জন শিক্ষার্থীর তথ্য আপডেট করা হচ্ছে...`
          : `Updating ${payload.length} students...`,
      ]);

      // Attempt RPC first
      let rpcSuccess = false;
      try {
        const { error: rpcErr } = await supabase.rpc("promote_students", {
          p_institution_id: institution.id,
          p_new_year_name: newYearName,
          p_start_date: startDate,
          p_end_date: endDate,
          p_hijri_start_date: hijriStartDate || null,
          p_hijri_end_date: hijriEndDate || null,
          p_promotions: payload,
        });

        if (!rpcErr) {
          rpcSuccess = true;
        } else {
          console.warn("promote_students RPC error, using direct table updates:", rpcErr);
        }
      } catch (e) {
        console.warn("promote_students RPC call failed, using direct table updates:", e);
      }

      // Direct fallback update if RPC didn't process
      if (!rpcSuccess) {
        // Update promoted students class_id & academic_year_id
        for (const promo of validPromotions) {
          const updateObj: any = { class_id: promo.next_class_id };
          if (newYearId) updateObj.academic_year_id = newYearId;

          await supabase
            .from("students")
            .update(updateObj)
            .eq("id", promo.student_id);
        }

        // Handle graduated students
        const graduatedPromotions = previewData.filter(
          (p) => p.next_class_id === "graduated",
        );
        for (const promo of graduatedPromotions) {
          const noteText = lang === "bn" ? `বিদায়ী শিক্ষার্থী (${newYearName})` : `Graduated (${newYearName})`;
          await supabase
            .from("students")
            .update({ notes: noteText })
            .eq("id", promo.student_id);
        }
      }

      // Step 3: Update institution config_json with active_academic_year_id & academic_year_start
      const updatedConfig = {
        ...(institution.config_json || {}),
        academic_year_start: startDate,
        ...(newYearId ? { active_academic_year_id: newYearId } : {}),
      };

      const { error: configError } = await supabase
        .from("institutions")
        .update({ config_json: updatedConfig })
        .eq("id", institution.id);

      if (configError) console.warn("Error updating institution config:", configError);

      // Step 4: Clear caches
      requestManager.invalidatePattern(`academic_years:${institution.id}`);
      requestManager.invalidatePattern(`students:${institution.id}`);
      requestManager.invalidatePattern(`fees:${institution.id}`);
      requestManager.invalidatePattern(`stats:${institution.id}`);
      requestManager.invalidatePattern(`dashboard_`);
      requestManager.invalidatePattern(`fetch:ledger:`);

      setExecutingLog((prev) => [
        ...prev,
        lang === "bn"
          ? "প্রমোশন ও সকল ডেটা আপডেট সফলভাবে সম্পন্ন হয়েছে!"
          : "Promotion and data update completed successfully!",
      ]);

      setTimeout(() => {
        onClose();
        hardReload(); // Refresh app to load new active academic year
      }, 1500);
    } catch (error: any) {
      console.error(error);
      setExecutingLog((prev) => [...prev, `Error: ${error.message}`]);
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-6 pb-12 ${isDark ? "text-white" : "text-slate-900"}`}>
      {/* Header */}
      <div
        className={`p-4 md:p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-2 z-20 shadow-sm ${isDark ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"}`}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={onClose}
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors shadow-sm border touch-manipulation ${
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
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 touch-pan-x">
          <div
            className={`flex p-1 rounded-xl md:rounded-2xl border min-w-max ${isDark ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-200"}`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("years")}
              className={`px-3 md:px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all touch-manipulation flex items-center gap-2 ${activeTab === "years" ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-[#2563EB] shadow-sm") : "text-slate-400"}`}
            >
              <List size={14} />{" "}
              {lang === "bn" ? "শিক্ষাবর্ষ তালিকা" : "Years List"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("promotion")}
              className={`px-3 md:px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all touch-manipulation flex items-center gap-2 ${activeTab === "promotion" ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-[#2563EB] shadow-sm") : "text-slate-400"}`}
            >
              <GraduationCap size={14} />{" "}
              {lang === "bn" ? "প্রমোশন উইজার্ড" : "Promotion"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reports")}
              className={`px-3 md:px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all touch-manipulation flex items-center gap-2 ${activeTab === "reports" ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-[#2563EB] shadow-sm") : "text-slate-400"}`}
            >
              <BarChart3 size={14} /> {lang === "bn" ? "রিপোর্ট" : "Reports"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 w-full">
        {!isPromotionActive && (
          <div className={`mb-6 p-5 rounded-[2rem] border flex flex-col sm:flex-row sm:items-center gap-4 ${isDark ? "bg-amber-950/20 border-amber-900/40 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
            <AlertTriangle className="shrink-0" size={24} />
            <div className="space-y-1">
              <h4 className="font-black text-xs uppercase tracking-widest">
                {lang === "bn" ? "রিড-অনলি মোড সক্রিয়" : "Read-Only Mode Active"}
              </h4>
              <p className="text-xs font-semibold leading-relaxed">
                {lang === "bn"
                  ? "সুপার এডমিন প্যানেল থেকে এই মডিউলটি নিষ্ক্রিয় করা হয়েছে। আপনি তথ্য দেখতে পারবেন কিন্তু কোন পরিবর্তন বা প্রমোশন করতে পারবেন না।"
                  : "This module has been deactivated from the Super Admin panel. You can view the information, but cannot make any changes or execute promotions."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "years" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3
                className={`text-lg font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {lang === "bn" ? "সকল শিক্ষাবর্ষ" : "All Academic Years"}
              </h3>
              <button
                onClick={() => {
                  if (!isPromotionActive) return;
                  setShowNewYearModal(true);
                }}
                disabled={!isPromotionActive}
                className={`px-4 py-2 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-premium ${!isPromotionActive ? "opacity-50 cursor-not-allowed bg-slate-400" : "bg-[#2563EB]"}`}
              >
                <Plus size={14} />{" "}
                {lang === "bn" ? "নতুন শিক্ষাবর্ষ" : "New Year"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {academicYears.map((year) => {
                const isCurrentlyViewing = selectedViewingYear ? selectedViewingYear.id === year.id : year.status === "active";
                const isPastViewing = isCurrentlyViewing && year.status !== "active";

                return (
                  <div
                    key={year.id}
                    className={`p-6 rounded-[2rem] border relative group transition-all ${
                      isPastViewing
                        ? (isDark ? "bg-amber-950/20 border-amber-500/50" : "bg-amber-50/50 border-amber-200")
                        : (isDark ? "bg-slate-800/50 border-slate-800 hover:border-blue-500/30" : "bg-white border-slate-100 hover:border-blue-200")
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          year.status === "active" 
                            ? "bg-emerald-50 text-emerald-600" 
                            : isPastViewing
                              ? "bg-amber-100 text-amber-600"
                              : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        <Calendar size={24} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isPastViewing && (
                          <div className="px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-500 text-white animate-pulse">
                            {lang === "bn" ? "দেখা হচ্ছে (Read Only)" : "Viewing (Read Only)"}
                          </div>
                        )}
                        <div
                          className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                            year.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                          }`}
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
                    </div>
                    <h4
                      className={`text-xl font-black ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
                    >
                      {year.year_name}
                    </h4>
                    <div className="flex flex-col gap-1 mt-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <span>{year.start_date}</span>
                        <ArrowRight size={10} />
                        <span>{year.end_date}</span>
                      </div>
                      {(year.hijri_start_date || year.hijri_end_date) && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/70">
                          <span>{year.hijri_start_date || "—"}</span>
                          <ArrowRight size={10} />
                          <span>{year.hijri_end_date || "—"}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                      {year.status !== "active" && (
                        <button
                          onClick={() => {
                            if (!isPromotionActive) return;
                            handleSetActive(year.id);
                          }}
                          disabled={!isPromotionActive}
                          className={`flex-1 py-2.5 px-3 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 ${!isPromotionActive ? "opacity-40 bg-slate-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20"}`}
                          title={lang === "bn" ? "সক্রিয় করুন" : "Set Active"}
                        >
                          <Check size={14} />
                          <span>{lang === "bn" ? "সক্রিয় করুন" : "Set Active"}</span>
                        </button>
                      )}
                      {year.status === "active" && (
                        <button
                          onClick={() => {
                            if (!isPromotionActive) return;
                            handleArchive(year.id);
                          }}
                          disabled={!isPromotionActive}
                          className={`flex-1 py-2.5 px-3 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 ${!isPromotionActive ? "opacity-40 bg-slate-500 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20"}`}
                          title={lang === "bn" ? "আর্কাইভ করুন" : "Archive"}
                        >
                          <Archive size={14} />
                          <span>{lang === "bn" ? "আর্কাইভ করুন" : "Archive"}</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (!isPromotionActive) return;
                          handleDeleteYear(year.id);
                        }}
                        disabled={!isPromotionActive}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border shrink-0 ${
                          !isPromotionActive
                            ? "opacity-40 bg-slate-400 text-slate-200 border-slate-300 cursor-not-allowed"
                            : isDark
                              ? "bg-red-900/20 text-red-400 border-red-900/30 hover:bg-red-900/40"
                              : "bg-red-50 text-red-500 border-red-100 hover:bg-red-100"
                        }`}
                        title={lang === "bn" ? "ডিলিট করুন" : "Delete"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
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
                      setViewConfirmYear(year);
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
            {/* Header / Nav */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button 
                onClick={() => setSelectedReportYear(null)}
                className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <ArrowRight size={16} className="rotate-180" />
                {lang === "bn" ? "অন্যান্য শিক্ষাবর্ষে ফিরুন" : "Back to Years List"}
              </button>
              <h3 className={`text-lg font-black ${isDark ? "text-white" : "text-[#1E3A8A]"}`}>
                {selectedReportYear.year_name} {lang === "bn" ? "শিক্ষাবর্ষের ফুল রিপোর্ট (Read-Only)" : "Academic Year Report"}
              </h3>
            </div>

            {/* Read-Only Status Banner */}
            <div className="p-5 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm font-noto text-purple-900 dark:text-purple-200">
                    {selectedReportYear.year_name} {lang === 'bn' ? 'শিক্ষাবর্ষ দেখছেন (Read-Only Mode)' : 'Viewing Historical Academic Year'}
                  </h4>
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-noto">
                    {lang === 'bn' ? 'এই শিক্ষাবর্ষের সকল ডাটা সংরক্ষিত ও রিড-অনলি মোডে আছে। নতুন কিছু যোগ/এডিট করা যাবে না।' : 'All historical records are strictly read-only.'}
                  </p>
                </div>
              </div>
              {onResetViewingYear && (
                <button
                  onClick={() => {
                    onResetViewingYear();
                    setSelectedReportYear(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 shrink-0 flex items-center gap-1.5 font-noto shadow-sm"
                >
                  <RefreshCw size={14} />
                  <span>{lang === 'bn' ? 'বর্তমান শিক্ষাবর্ষে ফিরুন' : 'Return to Current Year'}</span>
                </button>
              )}
            </div>

            {fetchingReport ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="text-purple-500 animate-spin" />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                  {lang === "bn" ? "ডাটা লোড হচ্ছে..." : "Fetching Data..."}
                </p>
              </div>
            ) : reportData ? (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Student Count */}
                  <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <GraduationCap size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {lang === "bn" ? "মোট শিক্ষার্থী" : "Total Students"}
                        </p>
                        <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>{reportData.studentCount}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Income */}
                  <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {lang === "bn" ? "মোট আয়" : "Total Income"}
                        </p>
                        <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.income.toLocaleString()}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Expense */}
                  <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                        <TrendingUp size={24} className="rotate-180" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {lang === "bn" ? "মোট ব্যয়" : "Total Expense"}
                        </p>
                        <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.expense.toLocaleString()}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Fees Paid */}
                  <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {lang === "bn" ? "সংগৃহীত ফি" : "Fees Collected"}
                        </p>
                        <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.totalPaid.toLocaleString()}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Fees Due */}
                  <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {lang === "bn" ? "মোট বকেয়া" : "Total Due"}
                        </p>
                        <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{reportData.totalDue.toLocaleString()}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Net Balance */}
                  <div className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <List size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {lang === "bn" ? "নীট ব্যালেন্স" : "Net Balance"}
                        </p>
                        <h4 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>৳{(reportData.income - reportData.expense).toLocaleString()}</h4>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enrolled Students Table */}
                {reportData.students && reportData.students.length > 0 && (
                  <div className={`p-6 rounded-[2rem] border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} shadow-sm`}>
                    <h4 className={`text-base font-black font-noto mb-4 ${isDark ? "text-white" : "text-[#1E3A8A]"}`}>
                      {lang === "bn" ? `${selectedReportYear.year_name} শিক্ষাবর্ষের এনরোল্ড শিক্ষার্থী (তখনকার ক্লাস ও রোল)` : `Enrolled Students in ${selectedReportYear.year_name}`}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-bold">
                        <thead>
                          <tr className={`border-b ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                            <th className="py-3 px-4">{lang === "bn" ? "রোল" : "Roll"}</th>
                            <th className="py-3 px-4">{lang === "bn" ? "শিক্ষার্থীর নাম" : "Student Name"}</th>
                            <th className="py-3 px-4">{lang === "bn" ? "তখনকার ক্লাস" : "Class"}</th>
                            <th className="py-3 px-4">{lang === "bn" ? "অভিভাবকের মোবাইল" : "Guardian Phone"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {reportData.students.map((st: any) => (
                            <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="py-3 px-4 font-black text-purple-600 dark:text-purple-400">{st.roll || "—"}</td>
                              <td className="py-3 px-4 font-black">{st.student_name}</td>
                              <td className="py-3 px-4">{st.classes?.class_name || "—"}</td>
                              <td className="py-3 px-4 text-slate-500">{st.guardian_phone || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 font-bold">No data found for this year.</div>
            )}
          </div>
        )}

        {step === "config" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <div className="space-y-2 max-w-sm">
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
                    placeholder="e.g. 2026"
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label
                      className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      {lang === "bn" ? "ইংরেজি শুরুর তারিখ" : "English Start Date"}
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
                      {lang === "bn" ? "ইংরেজি শেষের তারিখ" : "English End Date"}
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
                  {!(institution?.institution_type === "school" || institution?.institution_type === "choching" || institution?.institution_type === "kindergarten") && (
                    <>
                      <div className="space-y-2">
                        <label
                          className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                        >
                          {lang === "bn" ? "আরবি শুরুর তারিখ (ঐচ্ছিক)" : "Arabic Start Date (Optional)"}
                        </label>
                        <input
                          type="text"
                          placeholder={lang === "bn" ? "যেমন: ০১ মুহাররম ১৪৪৬" : "e.g. 01 Muharram 1446"}
                          className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-slate-300"
                              : "bg-slate-50 border-slate-100 text-slate-700"
                          }`}
                          value={hijriStartDate}
                          onChange={(e) => setHijriStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                        >
                          {lang === "bn" ? "আরবি শেষের তারিখ (ঐচ্ছিক)" : "Arabic End Date (Optional)"}
                        </label>
                        <input
                          type="text"
                          placeholder={lang === "bn" ? " যেমন: ৩০ জিলহজ ১৪৪৬" : "e.g. 30 Dhul Hijjah 1446"}
                          className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-slate-300"
                              : "bg-slate-50 border-slate-100 text-slate-700"
                          }`}
                          value={hijriEndDate}
                          onChange={(e) => setHijriEndDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
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
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                      {lang === "bn" ? "পরীক্ষা (ঐচ্ছিক)" : "Exam (Optional)"}
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
                          ? "পরীক্ষা ছাড়া (সরাসরি প্রমোশন)"
                          : "Without Exam (Direct Promotion)"}
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
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                      {lang === "bn" ? "পাস মার্ক % (ঐচ্ছিক)" : "Pass Mark % (Optional)"}
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
                        value={promotionMap[cls.id]?.passMark ?? ""}
                        onChange={(e) =>
                          setPromotionMap({
                            ...promotionMap,
                            [cls.id]: {
                              ...promotionMap[cls.id],
                              passMark: e.target.value === "" ? 0 : parseFloat(e.target.value),
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
                disabled={loading || !isPromotionActive}
                className={`px-8 py-4 text-white font-black rounded-2xl shadow-premium flex items-center gap-2 ${
                  !isPromotionActive
                    ? "bg-slate-400 cursor-not-allowed opacity-50"
                    : "bg-[#2563EB] hover:scale-105 transition-transform"
                } disabled:opacity-50`}
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
                          className={`text-xs font-black ${
                            !p.has_exam
                              ? "text-blue-500"
                              : p.result_status === "promoted" || p.result_status === "graduated"
                                ? "text-emerald-500"
                                : "text-red-500"
                          }`}
                        >
                          {p.has_exam
                            ? `${p.percentage}% (${p.failed_subjects} ${lang === "bn" ? "টি ফেল" : "failed"})`
                            : (lang === "bn" ? "পরীক্ষা ছাড়া" : "Without Exam")}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                            p.result_status === "promoted"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : p.result_status === "graduated"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                          }`}
                        >
                          {p.result_status === "promoted"
                            ? (lang === "bn" ? "প্রমোশন" : "Promoted")
                            : p.result_status === "graduated"
                              ? (lang === "bn" ? "বিদায়" : "Graduated")
                              : (lang === "bn" ? "পুনরাবৃত্তি" : "Retained")}
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
                disabled={!isPromotionActive}
                className={`px-8 py-4 text-white font-black rounded-2xl shadow-premium flex items-center gap-2 ${!isPromotionActive ? "opacity-50 cursor-not-allowed bg-slate-400" : "bg-emerald-500 hover:scale-105 transition-transform"}`}
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
                  placeholder="e.g. 2026"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {lang === "bn" ? "ইংরেজি শুরুর তারিখ" : "English Start Date"}
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
                    {lang === "bn" ? "ইংরেজি শেষের তারিখ" : "English End Date"}
                  </label>
                  <input
                    type="date"
                    className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-[#1E3A8A]"}`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              {!(institution?.institution_type === "school" || institution?.institution_type === "choching" || institution?.institution_type === "kindergarten") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      {lang === "bn" ? "আরবি শুরুর তারিখ (ঐচ্ছিক)" : "Arabic Start Date (Opt.)"}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "bn" ? "০১ মুহাররম ১৪৪৬" : "e.g. 01 Muharram"}
                      className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-[#1E3A8A]"}`}
                      value={hijriStartDate}
                      onChange={(e) => setHijriStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      {lang === "bn" ? "আরবি শেষের তারিখ (ঐচ্ছিক)" : "Arabic End Date (Opt.)"}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "bn" ? "৩০ জিলহজ ১৪৪৬" : "e.g. 30 Dhul Hijjah"}
                      className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-[#1E3A8A]"}`}
                      value={hijriEndDate}
                      onChange={(e) => setHijriEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handleCreateYear}
                disabled={isCreatingYear || !isPromotionActive}
                className={`w-full h-14 text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 transition-all ${!isPromotionActive ? "bg-slate-400 cursor-not-allowed opacity-50" : "bg-[#2563EB] active:scale-95"}`}
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

        {viewConfirmYear && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewConfirmYear(null)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-md rounded-[2.5rem] shadow-2xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"}`}
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-purple-200/50">
                  <BarChart3 size={36} />
                </div>

                <h3 className="text-xl font-black font-noto">
                  {lang === "bn" ? "বিগত শিক্ষাবর্ষের ডাটা দেখার নিশ্চিতকরণ" : "Confirm Historical Year View"}
                </h3>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold text-left space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <span>{viewConfirmYear.year_name} {lang === "bn" ? "শিক্ষাবর্ষ (রিড-অনলি মোড)" : "Academic Year (Read-Only)"}</span>
                  </p>
                  <p className="leading-relaxed font-noto">
                    {lang === "bn" 
                      ? `কনফার্ম করলে ${viewConfirmYear.year_name} শিক্ষাবর্ষের ফুল রিপোর্ট (শিক্ষার্থী সংখ্যা, ফি সংগ্রহ, বাৎসরিক বিবরণী ইত্যাদি) ওপেন হবে এবং সমগ্র অ্যাপস রিড-অনলি (Read-Only) মোডে সেট হবে। কোনো নতুন শিক্ষার্থী ভর্তি, পরীক্ষা তৈরি বা ডাটা পরিবর্তন করা যাবে না।`
                      : `Confirming will load all reports for ${viewConfirmYear.year_name} in Read-Only Mode. All historical records will be viewable, but no additions, edits, or deletions will be allowed.`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setViewConfirmYear(null)}
                    className={`py-3.5 rounded-2xl font-black text-xs transition-all active:scale-95 ${isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    onClick={() => {
                      const targetYear = viewConfirmYear;
                      setViewConfirmYear(null);
                      setSelectedReportYear(targetYear);
                      fetchReportData(targetYear);
                      if (onSelectViewingYear) {
                        onSelectViewingYear(targetYear);
                      }
                    }}
                    className="py-3.5 rounded-2xl font-black text-xs text-white bg-purple-600 hover:bg-purple-700 transition-all active:scale-95 shadow-lg shadow-purple-500/30 font-noto"
                  >
                    {lang === "bn" ? "হ্যাঁ, ডাটা দেখুন (Read-Only)" : "Confirm & View Data"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
