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
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  History,
  DollarSign,
  Download,
  CalendarOff,
  AlertTriangle,
  Camera,
  ListOrdered
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
import { requestManager } from "services/RequestManager";
import { useOfflineStatus } from "hooks/useOffline";
import { CacheService } from "services/cacheService";
import { generateAttendanceReportPDF } from "../utils/pdfGenerator";
import { getEventsForDate, getTodayDateString, getTodayMonthString } from "../utils/calendarUtils";

import { sortMadrasahClasses } from "pages/Classes";

import { TeacherProfile } from '../components/TeacherProfile';

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
  can_upload_student_photos: false,
  can_send_messages: false,
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
  const [viewProfile, setViewProfile] = useState<Teacher | null>(null);
  const [showPassword, setShowPassword] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    pin: "",
    designation: "",
    basic_salary: "",
    address: "",
    join_date: getTodayDateString(),
    leave_date: "",
    sort_order: 0,
    is_active: true,
  });

  const [permissions, setPermissions] =
    useState<Partial<TeacherPermissions>>(initialPermissions);

  const formatSalaryMonth = (monthStr: string) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split('-');
    const monthIndex = parseInt(month) - 1;
    
    const bnMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const monthName = lang === 'bn' ? bnMonths[monthIndex] : enMonths[monthIndex];
    return `${monthName} ${year}`;
  };
  const [activeTab, setActiveTab] = useState<'teachers' | 'salary' | 'attendance'>('teachers');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'take' | 'report'>('take');
  const [salaryMonth, setSalaryMonth] = useState(() => getTodayMonthString());
  const [attendanceMonth, setAttendanceMonth] = useState(() => getTodayMonthString());
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear().toString());
  const [reportDate, setReportDate] = useState(() => getTodayDateString());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [reportData, setReportData] = useState<Record<string, Record<string, string>>>({});
  const [attendanceDate, setAttendanceDate] = useState(() => getTodayDateString());
  const [isHoliday, setIsHoliday] = useState(false);
  const [dayEvents, setDayEvents] = useState<any[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<Record<string, string>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [paidSalaries, setPaidSalaries] = useState<Record<string, number>>({});
  const [paymentHistory, setPaymentHistory] = useState<Record<string, any[]>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{show: boolean, teacher: Teacher | null, amount: string}>({show: false, teacher: null, amount: ""});

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, [madrasah?.id]);

  const [salaryMonthAttendance, setSalaryMonthAttendance] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (activeTab === 'salary' && madrasah?.id) {
       fetchPaidSalaries();
       fetchSalaryMonthAttendance();
    }
    if (activeTab === 'attendance' && attendanceSubTab === 'take' && madrasah?.id) {
       fetchTeacherAttendance();
       fetchDayEvents();
    }
    if (activeTab === 'attendance' && attendanceSubTab === 'report' && madrasah?.id) {
       fetchAttendanceReport();
    }
  }, [salaryMonth, attendanceDate, attendanceMonth, activeTab, attendanceSubTab, reportType, reportYear, reportDate, madrasah?.id]);

  const fetchSalaryMonthAttendance = async () => {
    try {
      const res = await fetch(`/api/teachers/attendance-report?institute_id=${madrasah!.id}&month=${salaryMonth}`);
      const data = await res.json();
      if (data.report) setSalaryMonthAttendance(data.report);
      else setSalaryMonthAttendance({});
    } catch(err) {}
  };

  const fetchAttendanceReport = async () => {
    let filter = '';
    if (reportType === 'daily') {
      filter = reportDate;
    } else if (reportType === 'monthly') {
      filter = attendanceMonth;
    } else {
      filter = reportYear;
    }
    try {
      const res = await fetch(`/api/teachers/attendance-report?institute_id=${madrasah!.id}&month=${filter}`);
      const data = await res.json();
      if (data.report) {
        setReportData(data.report);
      } else {
        setReportData({});
      }
    } catch(err) {
      console.error("Error fetching attendance report:", err);
    }
  };

  const fetchTeacherAttendance = async () => {
    try {
      const res = await fetch(`/api/teachers/attendance?institute_id=${madrasah!.id}&date=${attendanceDate}`);
      const data = await res.json();
      if (data.attendance && Object.keys(data.attendance).length > 0) {
        setTeacherAttendance(data.attendance);
      } else {
        const initial: Record<string, string> = {};
        teachers.forEach(t => {
          initial[t.id] = 'present';
        });
        setTeacherAttendance(initial);
      }
    } catch(err) {
      console.error("Error fetching teacher attendance:", err);
    }
  };

  const fetchDayEvents = async () => {
    if (!madrasah) return;
    try {
      const { data: customEvents } = await supabase
        .from('calendar_events')
        .select('id, institution_id, event_date, title, type')
        .eq('institution_id', madrasah.id)
        .eq('event_date', attendanceDate);
      
      let events = getEventsForDate(new Date(attendanceDate), customEvents || []);
      
      const weeklyHolidays = madrasah.config_json?.weekly_holidays || [5];
      const dayIndex = new Date(attendanceDate).getDay();
      const isWeeklyHoliday = weeklyHolidays.includes(dayIndex);
      
      if (isWeeklyHoliday) {
        const dayNamesBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
        const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        events.push({
          title: lang === 'bn' ? `সাপ্তাহিক ছুটি (${dayNamesBn[dayIndex]})` : `Weekly Holiday (${dayNamesEn[dayIndex]})`,
          type: 'holiday',
          id: 'weekly-holiday',
        });
      }
      
      setDayEvents(events);
      setIsHoliday(events.length > 0);
    } catch (e) {
      console.error('Error fetching day events:', e);
    }
  };

  const saveTeacherAttendance = async () => {
    if (!madrasah?.id) return;
    setSavingAttendance(true);

    const finalAttendance = { ...teacherAttendance };
    teachers.forEach(t => {
      if (!finalAttendance[t.id]) finalAttendance[t.id] = 'present';
    });

    try {
      const res = await fetch('/api/teachers/save-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institute_id: madrasah.id,
          date: attendanceDate,
          attendance: finalAttendance
        })
      });
      if (!res.ok) throw new Error("Failed to save attendance");
      alert(lang === 'bn' ? 'হাজিরা সফলভাবে সংরক্ষণ করা হয়েছে' : 'Attendance saved successfully');
    } catch(err) {
      console.error(err);
      setError("Failed to save attendance");
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    let titleStr = '';
    if (reportType === 'daily') titleStr = reportDate;
    else if (reportType === 'monthly') titleStr = attendanceMonth;
    else titleStr = reportYear;

    const mappedData = teachers.map(teacher => {
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let holidayCount = 0;
      let totalDays = 0;
      
      if (reportData) {
        Object.keys(reportData).forEach(dateStr => {
          totalDays++;
          const dayData = reportData[dateStr] || {};
          const status = dayData[teacher.id];
          if (status === 'present') presentCount++;
          else if (status === 'absent') absentCount++;
          else if (status === 'late') lateCount++;
          else if (status === 'half_day') halfDayCount++;
          else if (status === 'holiday') holidayCount++;
        });
      }
      
      return {
        roll: '-',
        student_name: teacher.name,
        total_days: totalDays,
        present_days: presentCount,
        absent_days: absentCount,
        late_days: lateCount,
        half_day: halfDayCount,
        holiday_days: holidayCount
      };
    });

    console.log("Generating PDf with mapped data:", mappedData);

    try {
      if (mappedData.length === 0) {
        alert(lang === 'bn' ? 'কোনো শিক্ষক পাওয়া যায়নি' : 'No teachers found to generate report');
        return;
      }
      console.log("Calling generateAttendanceReportPDF...");
      await generateAttendanceReportPDF(mappedData, madrasah, lang === 'bn' ? 'শিক্ষক' : 'Teachers', titleStr, lang);
      console.log("PDF generated successfully!");
    } catch (error: any) {
      console.error("PDF generation failed:", error);
      alert(lang === 'bn' ? `পিডিএফ তৈরি করতে ব্যর্থ হয়েছে। ত্রুটি: ${error?.message || 'Unknown'}` : `Failed to generate PDF. Error: ${error?.message || 'Unknown'}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const fetchPaidSalaries = async () => {
    if (!madrasah?.id) return;
    try {
       // Search ledger for records where description contains the salaryMonth
       const { data, error } = await supabase
         .from('ledger')
         .select('description, amount, transaction_date, id')
         .eq('institution_id', madrasah.id)
         .eq('type', 'expense')
         .ilike('description', `%Salary paid for ${salaryMonth}%`);
       
       if (error) throw error;

       const paidList: Record<string, number> = {};
       const historyList: Record<string, any[]> = {};

       if (data) {
         data.forEach(item => {
            const match = item.description.match(/\[ID:(.*?)\]/) || item.description.match(/\(([^)]+)\)$/);
            if (match && match[1]) {
               const tid = match[1];
               const key = `${tid}_${salaryMonth}`;
               paidList[key] = (paidList[key] || 0) + (item.amount || 0);
               
               if (!historyList[key]) historyList[key] = [];
               historyList[key].push(item);
            }
         });
       }
       setPaidSalaries(paidList);
       setPaymentHistory(historyList);
    } catch(err) {
       console.error("Error fetching paid salaries", err);
    }
  };

  const handlePaySalary = async () => {
    if (!madrasah?.id) {
       alert(lang === 'bn' ? 'মাদরাসা তথ্য পাওয়া যায়নি। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।' : 'Institution information not found. Please refresh the page.');
       return;
    }
    if (!paymentModal.teacher || !paymentModal.amount) {
       alert(lang === 'bn' ? 'দয়া করে পরিমাণ লিখুন।' : 'Please enter an amount.');
       return;
    }
    const teacher = paymentModal.teacher;
    const amountToPay = parseFloat(paymentModal.amount);
    if(isNaN(amountToPay) || amountToPay <= 0) {
       alert(lang === 'bn' ? 'সঠিক পরিমাণ লিখুন।' : 'Please enter a valid amount.');
       return;
    }

    setPayingId(teacher.id);

    // Invalidate dashboard stats & ledger Pattern-based caches
    requestManager.invalidatePattern(`stats:${madrasah.id}`);
    requestManager.invalidatePattern('fetch:ledger:');
    requestManager.invalidatePattern(`dashboard_`);

    try {
      const description = `Salary paid for ${salaryMonth} to ${teacher.name} [ID:${teacher.id}]`;
      
      const payload: any = {
        institution_id: madrasah.id,
        category: lang === 'bn' ? 'শিক্ষক বেতন' : 'Teacher Salary',
        amount: amountToPay,
        type: 'expense',
        description: description,
        transaction_date: new Date().toISOString().split('T')[0]
      };

      if (madrasah.config_json?.active_academic_year_id) {
        payload.academic_year_id = madrasah.config_json.active_academic_year_id;
      }

      const { data, error } = await supabase.from('ledger').insert(payload).select();

      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      const key = `${teacher.id}_${salaryMonth}`;
      setPaidSalaries(prev => ({
        ...prev,
        [key]: (prev[key] || 0) + amountToPay
      }));

      if (data && data[0]) {
        setPaymentHistory(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), data[0]]
        }));
      }

      // Auto Send SMS
      if ((madrasah.config_json as any)?.features?.teacher_salary_sms) {
        try {
          const smsApiModule = await import('../supabase').then(res => res.smsApi);
          const templates = (madrasah.config_json as any)?.features?.sms_templates || {};
          let template = templates.teacher_salary || (lang === 'bn' 
            ? `আস-সালামু আলাইকুম, আপনার {month} মাসের বেতন বাবদ {amount} টাকা প্রদান করা হয়েছে।`
            : `As-salamu Alaikum, {amount} BDT has been paid as your salary for {month}.`);
          
          let smsText = template
             .replace(/\{month\}/g, formatSalaryMonth(salaryMonth))
             .replace(/\{amount\}/g, amountToPay.toString());
             
          await smsApiModule.sendBulk(madrasah.id, [{ id: teacher.id, guardian_phone: teacher.phone, student_name: teacher.name } as any], smsText);
        } catch (smsError) {
          console.error("Teacher salary SMS error:", smsError);
        }
      }

      setPaymentModal({show: false, teacher: null, amount: ""});
      alert(lang === 'bn' ? 'বেতন পরিশোধ সফল হয়েছে' : 'Salary paid successfully');
    } catch(err: any) {
      console.error("Error paying salary:", err);
      alert(lang === 'bn' ? `বেতন পরিশোধ ব্যর্থ: ${err.message || 'unknown error'}` : `Failed to pay salary: ${err.message || 'unknown error'}`);
    } finally {
      setPayingId(null);
    }
  };

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("institution_id", madrasah.id);
      if (error) throw error;
      setClasses(sortMadrasahClasses(data || []));
    } catch (err: any) {
      console.error("Fetch classes error:", err);
    }
  };

  const fetchTeachers = async (forceRefresh = false) => {
    if (!madrasah?.id) return;
    
    // Load from cache first for instant UI
    const cachedTeachers = forceRefresh ? null : await CacheService.getCachedData('teachers', madrasah.id);
    if (cachedTeachers && cachedTeachers.length > 0) {
      setTeachers(cachedTeachers);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      if (!isOnline) {
        if (!cachedTeachers || cachedTeachers.length === 0) {
          setTeachers([]);
          setLoading(false);
        }
        return;
      }

      const response = await fetch(
        `/api/teachers/list?institute_id=${madrasah.id}&t=${Date.now()}`,
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
      // Fallback to cache if network fails and we haven't already loaded it
      if (!teachers || teachers.length === 0) {
        const fallbackCache = await CacheService.getCachedData('teachers', madrasah.id);
        setTeachers(fallbackCache || []);
      }
      if (!err.message?.includes('fetch') && err.name !== 'TypeError' && navigator.onLine) {
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

      // Optimistic Update
      const tempId = crypto.randomUUID();
      const optimisticTeacher: any = {
        id: tempId,
        institution_id: madrasah.id,
        ...formData,
        permissions,
        created_at: new Date().toISOString()
      };
      setTeachers(prev => [optimisticTeacher, ...prev]);

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

      // Invalidate caches
      requestManager.invalidatePattern(`teachers:${madrasah.id}`);
      requestManager.invalidatePattern(`stats:${madrasah.id}`);
      requestManager.invalidatePattern(`dashboard_`);
      await CacheService.clearCache('teachers', madrasah.id);

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

      // Optimistic Update
      setTeachers(prev => prev.map(t => t.id === selectedTeacher.id ? { 
        ...t, 
        ...formData, 
        basic_salary: Number(formData.basic_salary),
        permissions 
      } : t));

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

      // Invalidate caches
      requestManager.invalidatePattern(`teachers:${madrasah?.id}`);
      requestManager.invalidatePattern(`profile:${selectedTeacher.id}`);
      requestManager.invalidatePattern(`dashboard_`);
      if (madrasah?.id) {
        await CacheService.clearCache('teachers', madrasah.id);
      }

      await fetchTeachers(true);
      if (viewProfile && viewProfile.id === selectedTeacher.id) {
        // Find the updated teacher in the new list to be safe, or just merge
        setViewProfile(prev => prev ? { 
          ...prev, 
          ...formData, 
          basic_salary: Number(formData.basic_salary),
          permissions 
        } : null);
      }
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
      // Optimistic Update
      setTeachers(prev => prev.filter(t => t.id !== id));

      const response = await fetch(`/api/teachers/delete?id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete teacher");
      }

      // Invalidate caches
      requestManager.invalidatePattern(`teachers:${madrasah?.id}`);
      requestManager.invalidatePattern(`profile:${id}`);
      requestManager.invalidatePattern(`stats:${madrasah?.id}`);
      requestManager.invalidatePattern(`dashboard_`);
      if (madrasah?.id) {
        await CacheService.clearCache('teachers', madrasah.id);
      }

      await fetchTeachers(true);
      setDeleteModal({ show: false, teacherId: null });
    } catch (err: any) {
      alert(err.message);
      fetchTeachers(); // Revert on failure
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      pin: "",
      designation: "",
      basic_salary: "",
      address: "",
      join_date: getTodayDateString(),
      leave_date: "",
      sort_order: 0,
      is_active: true,
    });
    setPermissions(initialPermissions);
    setShowPassword(true);
  };

  const openEditModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      name: teacher.name || "",
      phone: teacher.phone || "",
      pin: teacher.pin || "", 
      designation: teacher.designation || "",
      basic_salary: (teacher.basic_salary || teacher.monthly_salary) ? (teacher.basic_salary || teacher.monthly_salary)!.toString() : "",
      address: teacher.address || "",
      join_date: teacher.join_date || getTodayDateString(),
      leave_date: teacher.leave_date || "",
      sort_order: teacher.sort_order || 0,
      is_active: teacher.is_active,
    });
    setPermissions({ ...initialPermissions, ...(teacher.permissions || {}) });
    setShowPassword(true);
    setShowEditModal(true);
  };


  const filteredTeachers = React.useMemo(() => {
    return teachers.filter(
      (t) =>
        (t.name || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (t.phone && t.phone.includes(searchQuery)),
    ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [teachers, searchQuery]);

  const isDark = madrasah?.theme === "dark";

  return (
    <div
      className={`min-h-screen pb-20 ${isDark ? "bg-slate-950 text-white" : "text-slate-900"}`}
    >
      {/* Header */}
      <div
        className={`px-4 py-2.5 border-b ${isDark ? "bg-slate-900 border-slate-800" : "bg-transparent border-blue-100"}`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? "bg-slate-800 text-blue-400 border-slate-700" : "bg-blue-50 text-[#2563EB] border-blue-100"}`}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1
                className={`text-lg font-black font-noto ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {t("teacher_management", lang)}
              </h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
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
            className={`px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all ${!isOnline ? "bg-slate-400 text-white cursor-not-allowed shadow-none" : "bg-blue-600 text-white shadow-blue-600/20"}`}
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">{t("add_teacher", lang)}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {viewProfile ? (
          <TeacherProfile 
            teacher={viewProfile} 
            madrasah={madrasah!} 
            lang={lang} 
            onBack={() => setViewProfile(null)} 
            onTeacherUpdate={(updatedTeacher) => {
              setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
              setViewProfile(updatedTeacher);
            }} 
            onEdit={(teacher) => {
              openEditModal(teacher);
            }}
            onDelete={(teacherId) => {
              setDeleteModal({ show: true, teacherId });
            }}
          />
        ) : (
          <>
            {/* Tabs */}
            <div className={`p-1 flex gap-1 rounded-xl w-fit mx-auto sm:mx-0 ${isDark ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200/50"}`}>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'teachers' ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-blue-600 shadow-sm") : "text-slate-500 hover:text-slate-700"}`}
          >
            {lang === 'bn' ? 'শিক্ষক তালিকা' : 'Teachers List'}
          </button>
          {madrasah?.config_json?.modules?.attendance !== false && (
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'attendance' ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-blue-600 shadow-sm") : "text-slate-500 hover:text-slate-700"}`}
            >
              {lang === 'bn' ? 'হাজিরা' : 'Attendance'}
            </button>
          )}
          {madrasah?.config_json?.modules?.accounting !== false && (
            <button
              onClick={() => setActiveTab('salary')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'salary' ? (isDark ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-blue-600 shadow-sm") : "text-slate-500 hover:text-slate-700"}`}
            >
              {lang === 'bn' ? 'বেতন প্রদান' : 'Pay Salary'}
            </button>
          )}
        </div>

        {activeTab === 'teachers' ? (
          <>
            {/* Search Bar */}
            <div className="relative group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder={
                  lang === "bn"
                    ? "শিক্ষকের নাম বা মোবাইল দিয়ে খুঁজুন..."
                    : "Search by teacher name or mobile..."
                }
                className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-[13px] font-bold transition-all focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 ${isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Teachers List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                  Loading Teachers...
                </p>
              </div>
            ) : filteredTeachers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTeachers.map((teacher) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setViewProfile(teacher)}
                className={`border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group flex items-center justify-between cursor-pointer ${isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-blue-200"}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border overflow-hidden shrink-0 ${isDark ? "bg-blue-900/20 text-blue-400 border-blue-900/30" : "bg-blue-50 text-blue-600 border-blue-100"}`}
                  >
                    {teacher.photo_url ? (
                       <img src={teacher.photo_url} alt={teacher.name} className="w-full h-full object-cover" />
                    ) : (
                       <User size={24} />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`text-[15px] font-black font-noto leading-tight group-hover:text-blue-500 transition-colors ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {teacher.name}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                      <Briefcase size={12} /> {teacher.designation || (lang === "bn" ? "শিক্ষক" : "Teacher")}
                      {teacher.leave_date && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] border border-red-200">
                          {lang === 'bn' ? `বিদায়: ${teacher.leave_date}` : `Left: ${teacher.leave_date}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {teacher.phone && (
                  <a
                    href={`tel:${teacher.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`p-3 rounded-2xl flex items-center justify-center transition-all shrink-0 ${isDark ? "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
                  >
                    <Phone size={18} className="animate-pulse" />
                  </a>
                )}
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
        </>
      ) : activeTab === 'attendance' ? (
        <div className="space-y-4 animate-in fade-in">
          {/* Sub-Tabs Switcher */}
          <div className={`flex p-0.5 rounded-xl border w-fit mx-auto ${isDark ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/20' : 'bg-slate-100 border-slate-200'}`}>
            <button 
              onClick={() => setAttendanceSubTab('take')}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${attendanceSubTab === 'take' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-lg' : 'bg-white text-[#2563EB] shadow-md') : 'text-slate-400'}`}
            >
              {lang === 'bn' ? 'প্রতিদিনের হাজিরা' : 'Daily Attendance'}
            </button>
            <button 
              onClick={() => setAttendanceSubTab('report')}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${attendanceSubTab === 'report' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-lg' : 'bg-white text-[#2563EB] shadow-md') : 'text-slate-400'}`}
            >
              {lang === 'bn' ? 'হাজিরা রিপোর্ট' : 'Attendance Report'}
            </button>
          </div>

          {attendanceSubTab === 'take' ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
                <div className="w-full relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1 block text-center sm:text-left">
                    {lang === 'bn' ? 'তারিখ নির্বাচন করুন' : 'Select Date'}
                  </label>
                  <div className="relative max-w-xs mx-auto sm:mx-0">
                    <input 
                      type="date" 
                      className={`w-full h-11 pl-9 pr-2 border-2 rounded-xl font-black outline-none focus:border-[#2563EB]/20 transition-all text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-100 text-[#1E3A8A]'}`} 
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                    />
                    <Calendar className="absolute left-3 top-3 text-[#2563EB]" size={16}/>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {isHoliday ? (
                  <div className={`p-10 border-2 border-dashed rounded-[3rem] flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-500 ${isDark ? 'bg-slate-900 border-slate-700 shadow-slate-950/50' : 'bg-blue-50 border-blue-200 shadow-blue-900/5'}`}>
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
                      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner border ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-100 text-[#2563EB] border-blue-200'}`}>
                        <AlertTriangle size={40} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-blue-900'}`}>{lang === 'bn' ? 'আজ হাজিরা বন্ধ' : 'Attendance Closed Today'}</h3>
                      <p className={`text-sm font-bold max-w-[250px] ${isDark ? 'text-slate-400' : 'text-blue-700/70'}`}>
                        {dayEvents.map(e => e.title).join(', ') || (lang === 'bn' ? 'আজকের দিনে বিশেষ ইভেন্ট বা ছুটি রয়েছে।' : 'There is a special event or holiday today.')}
                      </p>
                      <p className={`text-[10px] font-black uppercase tracking-widest pt-2 ${isDark ? 'text-blue-400' : 'text-blue-400'}`}>{lang === 'bn' ? 'ক্যালেন্ডার অনুযায়ী আজ হাজিরা গ্রহণ করা সম্ভব নয়' : 'Based on the calendar, attendance cannot be taken today'}</p>
                    </div>
                  </div>
                ) : teachers.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-2 pt-1">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'শিক্ষক তালিকা' : 'Teacher List'}</h4>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'উপস্থিতি' : 'Attendance'}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {teachers.map(teacher => {
                        // Filter by join date and leave date
                        if (teacher.join_date && attendanceDate < teacher.join_date) {
                          return null;
                        }
                        if (teacher.leave_date && attendanceDate > teacher.leave_date) {
                          return null;
                        }
                        const status = teacherAttendance[teacher.id] || 'present';
                        return (
                          <div key={teacher.id} className={`p-3 rounded-2xl border shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center border shrink-0 shadow-inner ${isDark ? 'bg-slate-900 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
                                <User size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className={`font-black font-noto text-xs break-words whitespace-normal leading-tight ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{teacher.name}</h5>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{teacher.designation || (lang === 'bn' ? 'শিক্ষক' : 'Teacher')}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-1.5 shrink-0 ml-2">
                              <button onClick={() => setTeacherAttendance({...teacherAttendance, [teacher.id]: 'present'})} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${status === 'present' ? 'bg-emerald-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Present"><CheckCircle size={14}/></button>
                              <button onClick={() => setTeacherAttendance({...teacherAttendance, [teacher.id]: 'absent'})} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${status === 'absent' ? 'bg-red-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Absent"><XCircle size={14}/></button>
                              <button onClick={() => setTeacherAttendance({...teacherAttendance, [teacher.id]: 'late'})} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${status === 'late' ? 'bg-amber-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Late"><Clock size={14}/></button>
                              <button onClick={() => setTeacherAttendance({...teacherAttendance, [teacher.id]: 'half_day'})} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${status === 'half_day' ? 'bg-purple-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Half Day"><span className="text-[10px] font-black">1/2</span></button>
                              <button onClick={() => setTeacherAttendance({...teacherAttendance, [teacher.id]: 'holiday'})} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${status === 'holiday' ? 'bg-blue-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Holiday"><CalendarOff size={14}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-center mt-4">
                      <button
                        onClick={saveTeacherAttendance}
                        disabled={savingAttendance}
                        className={`w-full h-11 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${savingAttendance ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-[#2563EB] text-white hover:bg-blue-700 shadow-blue-500/30"}`}
                      >
                        {savingAttendance ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        <span>{lang === 'bn' ? 'হাজিরা সংরক্ষণ করুন' : 'Save Attendance'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={`p-10 rounded-[3rem] border flex flex-col items-center justify-center text-center space-y-3 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <Users size={32} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                    <p className={`text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {lang === 'bn' ? 'কোনো শিক্ষক পাওয়া যায়নি' : 'No teachers found'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className={`p-4 rounded-2xl border shadow-bubble space-y-4 transition-all ${isDark ? 'bg-slate-800/50 border-slate-700 shadow-black/20' : 'bg-white border-slate-100'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                      {lang === 'bn' ? 'রিপোর্টের ধরন' : 'Report Type'}
                    </label>
                    <div className={`flex p-0.5 rounded-lg border transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <button onClick={() => setReportType('daily')} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'daily' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'দৈনিক' : 'Daily'}</button>
                      <button onClick={() => setReportType('monthly')} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'monthly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'মাসিক' : 'Monthly'}</button>
                      <button onClick={() => setReportType('yearly')} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'yearly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'বাৎসরিক' : 'Yearly'}</button>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                      {lang === 'bn' ? 'নির্বাচন করুন' : 'Select'}
                    </label>
                    <div className="relative">
                      {reportType === 'daily' ? (
                        <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={`w-full h-11 pl-9 pr-4 border-2 rounded-xl font-black outline-none focus:border-[#2563EB]/20 transition-all text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} />
                      ) : reportType === 'monthly' ? (
                        <input type="month" value={attendanceMonth} onChange={(e) => setAttendanceMonth(e.target.value)} className={`w-full h-11 pl-9 pr-4 border-2 rounded-xl font-black outline-none focus:border-[#2563EB]/20 transition-all text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} />
                      ) : (
                        <select value={reportYear} onChange={(e) => setReportYear(e.target.value)} className={`w-full h-11 pl-9 pr-4 border-2 rounded-xl font-black outline-none focus:border-[#2563EB]/20 transition-all text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                          {Array.from({length: 5}).map((_, i) => {
                            const y = (new Date().getFullYear() - i).toString();
                            return <option key={y} value={y}>{y}</option>;
                          })}
                        </select>
                      )}
                      <Calendar className="absolute left-3 top-3 text-[#2563EB]" size={14}/>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isGeneratingPDF || Object.keys(reportData).length === 0}
                      className={`w-full h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                        isGeneratingPDF || Object.keys(reportData).length === 0
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          : isDark
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50'
                          : 'bg-[#2563EB] hover:bg-blue-600 text-white shadow-blue-500/30'
                      }`}
                    >
                      {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : 
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      }
                      <span>{lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {teachers.length === 0 ? (
                  <div className={`p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <Users size={32} className="text-slate-400/20 mb-3" />
                    <p className="text-[13px] font-black text-slate-500 uppercase tracking-widest">{lang === 'bn' ? 'কোনো শিক্ষক পাওয়া যায়নি' : 'No teachers found'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teachers.map(teacher => {
                      // Filter by join date and leave date
                      if (teacher.join_date) {
                        const [joinYear, joinMonth] = teacher.join_date.split('-').map(Number);
                        let filterYear, filterMonth;
                        
                        if (reportType === 'daily') {
                          if (reportDate < teacher.join_date) return null;
                        } else if (reportType === 'monthly') {
                          [filterYear, filterMonth] = attendanceMonth.split('-').map(Number);
                          const isJoined = (filterYear > joinYear) || (filterYear === joinYear && filterMonth >= joinMonth);
                          if (!isJoined) return null;
                        } else if (reportType === 'yearly') {
                          filterYear = parseInt(reportYear);
                          if (filterYear < joinYear) return null;
                        }
                      }

                      if (teacher.leave_date) {
                        const [leaveYear, leaveMonth] = teacher.leave_date.split('-').map(Number);
                        let filterYear, filterMonth;

                        if (reportType === 'daily') {
                          if (reportDate > teacher.leave_date) return null;
                        } else if (reportType === 'monthly') {
                          [filterYear, filterMonth] = attendanceMonth.split('-').map(Number);
                          const isLeft = (filterYear > leaveYear) || (filterYear === leaveYear && filterMonth > leaveMonth);
                          if (isLeft) return null;
                        } else if (reportType === 'yearly') {
                          filterYear = parseInt(reportYear);
                          if (filterYear > leaveYear) return null;
                        }
                      }

                      let presentCount = 0;
                      let absentCount = 0;
                      let lateCount = 0;
                      let halfDayCount = 0;
                      let holidayCount = 0;
                      
                      Object.values(reportData).forEach(dailyRecord => {
                        const status = dailyRecord[teacher.id];
                        if (status === 'present') presentCount++;
                        else if (status === 'absent') absentCount++;
                        else if (status === 'late') lateCount++;
                        else if (status === 'half_day') halfDayCount++;
                        else if (status === 'holiday') holidayCount++;
                      });
                      
                      return (
                        <div key={teacher.id} className={`p-3 rounded-xl border shadow-bubble flex flex-col sm:flex-row gap-3 items-center justify-between group transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                            <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center border shrink-0 shadow-inner ${isDark ? 'bg-slate-900 text-blue-400 border-slate-700' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              <User size={16} />
                            </div>
                            <div className="min-w-0">
                              <h5 className={`font-black font-noto text-xs truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{teacher.name}</h5>
                              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{teacher.designation || (lang === 'bn' ? 'শিক্ষক' : 'Teacher')}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-1 w-full sm:w-44">
                            <div className={`px-1 py-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>P</span>
                              <span className="text-[11px] font-black text-emerald-500">{presentCount}</span>
                            </div>
                            <div className={`px-1 py-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>A</span>
                              <span className="text-[11px] font-black text-red-500">{absentCount}</span>
                            </div>
                            <div className={`px-1 py-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>L</span>
                              <span className="text-[11px] font-black text-amber-500">{lateCount}</span>
                            </div>
                            <div className={`px-1 py-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>H</span>
                              <span className="text-[11px] font-black text-purple-500">{halfDayCount}</span>
                            </div>
                            <div className={`px-1 py-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>O</span>
                              <span className="text-[11px] font-black text-blue-500">{holidayCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`p-4 rounded-[2rem] space-y-3 transition-all ${isDark ? 'bg-slate-800/50 border border-slate-700 shadow-bubble' : 'bg-transparent'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex-1 w-full relative animate-in fade-in">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 mb-1.5 block">
                {lang === 'bn' ? 'মাস নির্বাচন' : 'Select Month'}
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 z-10 pointer-events-none group-focus-within:scale-110 transition-transform">
                  <Calendar size={18} strokeWidth={2.5} />
                </div>
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className={`w-full pl-11 pr-5 py-3 rounded-[1.4rem] border-2 font-black text-xs transition-all outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none ${
                    isDark 
                      ? "bg-slate-900 border-slate-800 text-white placeholder-slate-600 focus:border-blue-500/50" 
                      : "bg-white border-slate-100 text-[#1E3A8A] placeholder-slate-300 focus:border-blue-500"
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {teachers.map(teacher => {
                // Filter by join date
                if (teacher.join_date) {
                  const [joinYear, joinMonth] = teacher.join_date.split('-').map(Number);
                  const [selectedYear, selectedMonth] = salaryMonth.split('-').map(Number);
                  
                  const isJoined = (selectedYear > joinYear) || (selectedYear === joinYear && selectedMonth >= joinMonth);
                  if (!isJoined) return null;
                }

                if (teacher.leave_date) {
                  const [leaveYear, leaveMonth] = teacher.leave_date.split('-').map(Number);
                  const [selectedYear, selectedMonth] = salaryMonth.split('-').map(Number);

                  const isLeft = (selectedYear > leaveYear) || (selectedYear === leaveYear && selectedMonth > leaveMonth);
                  if (isLeft) return null;
                }

                const paidKey = `${teacher.id}_${salaryMonth}`;
                const paidSoFar = paidSalaries[paidKey] || 0;
                let totalSalary = Number(teacher.basic_salary) || Number(teacher.monthly_salary) || 0;
                
                let absentCount = 0;
                let deductionAmt = 0;
                const isDeductionEnabled = (madrasah as any)?.config_json?.features?.teacher_attendance_deduction;
                if (isDeductionEnabled) {
                   const attData = salaryMonthAttendance;
                   Object.keys(attData).forEach(dateStr => {
                       if (dateStr.startsWith(salaryMonth)) {
                          if (attData[dateStr][teacher.id] === 'absent') absentCount++;
                       }
                   });
                   if (absentCount > 0 && totalSalary > 0) {
                      const [yearStr, monthStr] = salaryMonth.split('-');
                      const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
                      deductionAmt = Math.round((totalSalary / daysInMonth) * absentCount);
                      totalSalary = Math.max(0, totalSalary - deductionAmt);
                   }
                }

                const due = Math.max(0, totalSalary - paidSoFar);
                const percentage = totalSalary > 0 ? Math.min(100, (paidSoFar / totalSalary) * 100) : 0;
                const isFullyPaid = paidSoFar >= totalSalary && totalSalary > 0;
                
                return (
                  <div key={teacher.id} className={`p-3 rounded-2xl border shadow-bubble flex flex-col gap-3 group transition-all relative overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/80 backdrop-blur-sm border-slate-200/50 hover:bg-white hover:border-blue-200'}`}>
                    {/* Background accent */}
                    <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full blur-3xl opacity-20 pointer-events-none ${isFullyPaid ? 'bg-emerald-500' : 'bg-blue-500'}`} />

                    <div className="flex items-center justify-between gap-3 z-10">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 shadow-inner ${isDark ? 'bg-slate-900 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
                          <User size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className={`font-black font-noto text-xs truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{teacher.name}</h5>
                            {totalSalary > 0 && (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${isDark ? 'bg-blue-900/30 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                ৳{totalSalary}
                              </span>
                            )}
                            {deductionAmt > 0 && (
                               <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border ${isDark ? 'bg-rose-900/30 border-rose-800 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                                 - ৳{deductionAmt} ({absentCount}d)
                               </span>
                            )}
                          </div>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{teacher.designation || (lang === 'bn' ? 'শিক্ষক' : 'Teacher')}</p>
                        </div>
                      </div>
                    </div>

                    {totalSalary > 0 && (
                      <div className="space-y-2.5 z-10">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between px-1">
                             <div className="flex flex-col">
                               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                               <span className="text-xs font-black text-emerald-500">৳ {paidSoFar}</span>
                             </div>
                             <div className="flex flex-col items-end">
                               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{lang === 'bn' ? 'বকেয়া' : 'Due'}</span>
                               <span className={`text-xs font-black ${due > 0 ? 'text-red-500' : 'text-slate-400'}`}>৳ {due}</span>
                             </div>
                          </div>
                          <div className={`w-full h-2 rounded-full p-0.5 overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${percentage}%` }}
                               transition={{ duration: 1, ease: "circOut" }}
                               className={`h-full rounded-full shadow-lg ${isFullyPaid ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-[#2563EB]'}`}
                             />
                          </div>
                        </div>

                        {paymentHistory[paidKey] && paymentHistory[paidKey].length > 0 && (
                          <div className={`p-2 rounded-xl border ${isDark ? 'bg-slate-900/30 border-slate-700/40' : 'bg-slate-50/30 border-slate-200/50'} backdrop-blur-sm`}>
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                              <History size={10} className="text-blue-500" />
                              {lang === 'bn' ? 'পেমেন্ট হিস্ট্রি' : 'Payment History'}
                            </p>
                            <div className="space-y-1.5">
                              {paymentHistory[paidKey].slice().reverse().map((p, idx) => (
                                <div key={p.id || idx} className="flex items-center justify-between text-[10px] font-black">
                                  <span className="text-slate-500 flex items-center gap-1.5 text-[9px]">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
                                    {new Date(p.transaction_date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-md transition-all ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-emerald-600 shadow-sm border border-slate-100'}`}>৳ {p.amount}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-0.5 z-10">
                      {!totalSalary && (
                        <div className="text-[9px] font-bold text-slate-400 italic">
                          {lang === 'bn' ? 'স্যালারি সেট নেই' : 'No salary set'}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 w-full">
                        <button
                          onClick={async () => {
                            if (!totalSalary) {
                               alert(lang === 'bn' ? 'দয়া করে এই শিক্ষকের প্রোফাইলে গিয়ে মাসিক বেতন সেট করুন।' : 'Please set the monthly salary in the teacher\'s profile first.');
                               return;
                            }
                            if (due <= 0) return;
                            
                            setPayingId(teacher.id);

                            // Invalidate caches
                            requestManager.invalidatePattern(`stats:${madrasah?.id}`);
                            requestManager.invalidatePattern('fetch:ledger:');
                            requestManager.invalidatePattern(`dashboard_`);

                            try {
                              const description = `Salary paid for ${salaryMonth} to ${teacher.name} [ID:${teacher.id}]`;
                              const payload: any = {
                                institution_id: madrasah!.id,
                                category: lang === 'bn' ? 'শিক্ষক বেতন' : 'Teacher Salary',
                                amount: due,
                                type: 'expense',
                                description: description,
                                transaction_date: new Date().toISOString().split('T')[0]
                              };
                              if (madrasah?.config_json?.active_academic_year_id) {
                                payload.academic_year_id = madrasah.config_json.active_academic_year_id;
                              }
                              const { data, error } = await supabase.from('ledger').insert(payload).select().single();
                              if (error) throw error;
                              
                              const key = `${teacher.id}_${salaryMonth}`;
                              setPaidSalaries(prev => ({ ...prev, [key]: (prev[key] || 0) + due }));
                              if (data) {
                                 setPaymentHistory(prev => ({
                                    ...prev,
                                    [key]: [...(prev[key] || []), data]
                                 }));
                              }

                              // Auto Send SMS
                              if ((madrasah.config_json as any)?.features?.teacher_salary_sms) {
                                try {
                                  const smsApiModule = await import('../supabase').then(res => res.smsApi);
                                  const templates = (madrasah.config_json as any)?.features?.sms_templates || {};
                                  let template = templates.teacher_salary || (lang === 'bn' 
                                    ? `আস-সালামু আলাইকুম, আপনার {month} মাসের বেতন বাবদ {amount} টাকা প্রদান করা হয়েছে।`
                                    : `As-salamu Alaikum, {amount} BDT has been paid as your salary for {month}.`);
                                  
                                  let smsText = template
                                     .replace(/\{month\}/g, formatSalaryMonth(salaryMonth))
                                     .replace(/\{amount\}/g, due.toString());
                                     
                                  await smsApiModule.sendBulk(madrasah.id, [{ id: teacher.id, guardian_phone: teacher.phone, student_name: teacher.name } as any], smsText);
                                } catch (smsError) {
                                  console.error("Teacher salary SMS error:", smsError);
                                }
                              }

                              alert(lang === 'bn' ? 'বেতন পরিশোধ হয়েছে' : 'Salary paid successfully');
                            } catch (err: any) {
                              alert(lang === 'bn' ? `ব্যর্থ: ${err.message}` : `Failed: ${err.message}`);
                            } finally {
                              setPayingId(null);
                            }
                          }}
                          disabled={isFullyPaid || payingId === teacher.id}
                          className={`flex-1 px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 ${
                            isFullyPaid 
                              ? "bg-slate-100 text-slate-400 shadow-none cursor-default border border-slate-200" 
                              : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/30"
                          }`}
                        >
                          {payingId === teacher.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          {isFullyPaid ? (lang === 'bn' ? 'পরিশোধিত' : 'Paid') : (lang === 'bn' ? 'পুরো পরিশোধ' : 'Full Pay')}
                        </button>

                        {!isFullyPaid && (
                          <button
                            onClick={() => setPaymentModal({show: true, teacher: teacher, amount: ""})}
                            className={`flex-1 px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-2 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                          >
                            <span className="opacity-50 font-bold text-[10px]">৳</span>
                            {lang === 'bn' ? 'আংশিক' : 'Partial'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </>
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

                <div className="space-y-5">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
                    <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>
                      {lang === 'bn' ? 'প্রাথমিক তথ্য' : 'Basic Information'}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <User size={11} className="text-[#2563EB]" /> 
                        {t("teacher_name", lang)}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Full Name"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.name || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <Briefcase size={11} className="text-[#2563EB]" /> 
                        {t("designation", lang)}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Teacher"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.designation || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            designation: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <span className="font-bold text-[#2563EB]">৳</span> 
                        {lang === 'bn' ? 'বেসিক স্যালারি' : 'Basic Salary'}
                      </label>
                      <input
                        type="number"
                        placeholder="Amount"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.basic_salary || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            basic_salary: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <Smartphone size={11} className="text-[#2563EB]" /> 
                        {t("phone", lang)}
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Mobile Number"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <Check size={11} className="text-[#2563EB]" /> 
                        {lang === 'bn' ? 'ঠিকানা' : 'Address'}
                      </label>
                      <input
                        type="text"
                        placeholder="Full Address"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.address || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: e.target.value,
                          })
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <Calendar size={11} className="text-[#2563EB]" /> 
                        {lang === 'bn' ? 'জয়েন ডেট' : 'Join Date'}
                      </label>
                      <input
                        type="date"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.join_date || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            join_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <Calendar size={11} className="text-[#2563EB]" /> 
                        {lang === 'bn' ? 'বিদায়ের তারিখ (যদি থাকে)' : 'Leave Date (Optional)'}
                      </label>
                      <input
                        type="date"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.leave_date || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            leave_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <ListOrdered size={11} className="text-[#2563EB]" /> 
                        {lang === 'bn' ? 'সিরিয়াল' : 'Sort Order'}
                      </label>
                      <input
                        type="number"
                        className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                        value={formData.sort_order ?? 0}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sort_order: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                        <Lock size={11} className="text-[#2563EB]" /> 
                        {t("password", lang)}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required={showAddModal}
                          placeholder={
                            showEditModal ? "Leave blank to keep current" : "Set password"
                          }
                          className={`w-full h-[54px] px-5 pr-12 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`}
                          value={formData.pin || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, pin: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}
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
                        key: "can_upload_student_photos",
                        label:
                          lang === "bn"
                            ? "শিক্ষার্থীর ছবি আপলোড"
                            : "Upload Student Photos",
                        icon: <Camera size={14} />,
                        module: "student_photo",
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
                        key: "can_send_messages",
                        label: lang === "bn" ? "বার্তা পাঠান" : "Send Messages",
                        icon: <MessageSquare size={14} />,
                        module: "parent_portal",
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

      {/* Salary Payment Modal */}
      <AnimatePresence>
        {paymentModal.show && paymentModal.teacher && (
          <div key="salary-payment-modal" className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setPaymentModal({show: false, teacher: null, amount: ""})}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className={`w-full max-w-sm rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col z-10 ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white"}`}
             >
                <div className={`p-8 pb-6 border-b text-center ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                   <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border-4 border-emerald-100 shadow-inner flex items-center justify-center mx-auto mb-4">
                      <DollarSign size={28} strokeWidth={2.5} />
                   </div>
                   <h2 className={`text-xl font-black font-noto ${isDark ? "text-white" : "text-[#1E3A8A]"}`}>
                     {lang === 'bn' ? 'বেতন পরিশোধ' : 'Pay Salary'}
                   </h2>
                   <p className="text-xs font-bold text-slate-400 mt-2">
                     {paymentModal.teacher.name}
                   </p>
                </div>
                <div className="p-8 space-y-6">
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block text-center">
                       {lang === 'bn' ? 'পরিমাণ (৳)' : 'Amount (৳)'}
                     </label>
                     <input
                       type="number"
                       min="0"
                       autoFocus
                       value={paymentModal.amount}
                       onChange={(e) => setPaymentModal(p => ({...p, amount: e.target.value}))}
                       className={`w-full h-16 text-center text-3xl font-black rounded-3xl outline-none transition-all ${isDark ? 'bg-slate-800 border-2 border-slate-700 text-emerald-400 focus:border-emerald-500/50' : 'bg-slate-50 border-2 border-slate-100 text-emerald-600 focus:border-emerald-400'}`}
                     />
                     <p className="text-[9px] text-center text-slate-400 mt-2 font-bold uppercase tracking-widest">
                       {lang === 'bn' ? 'পরিশোধের পরিমাণ লিখুন' : 'Enter payment amount'}
                     </p>
                   </div>
                   <div className="flex gap-3">
                     <button
                       onClick={() => setPaymentModal({show: false, teacher: null, amount: ""})}
                       className={`flex-1 py-4 font-black rounded-2xl text-xs uppercase tracking-widest transition-all ${isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                     >
                       {lang === "bn" ? "বাতিল" : "Cancel"}
                     </button>
                     <button
                       onClick={handlePaySalary}
                       disabled={payingId === paymentModal.teacher.id || !paymentModal.amount || parseFloat(paymentModal.amount) <= 0}
                       className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:active:scale-100 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                     >
                       {payingId === paymentModal.teacher.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                       {lang === "bn" ? "নিশ্চিত করুন" : "Confirm"}
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

export default TeacherManagement;
