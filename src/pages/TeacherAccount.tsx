import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, User as UserIcon, ShieldCheck, Key, Copy, Activity, Calendar as CalendarIcon, MapPin, Play, MessageCircle, Headset, Check, X, CheckCircle2, Loader2, CreditCard, GraduationCap, LayoutDashboard, Smartphone, Mail, Box, ArrowLeft, ArrowRight, ChevronRight, Languages, Clock, AlertCircle, Percent, ChevronDown, ChevronUp, Info, TrendingUp } from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language, View, Profile } from 'types';
import { t } from 'translations';

interface TeacherAccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  madrasah: Institution | null;
  setView: (view: View) => void;
  onLogout: () => void;
  profile: Profile | null;
  dataVersion: number;
}

interface ActionCardProps {
  icon: React.ComponentType<any>;
  title: string;
  subtitle: string;
  colorClass: string;
  onClick: () => void;
  dark: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon: Icon, title, subtitle, colorClass, onClick, dark }) => (
  <button 
    onClick={onClick}
    className={`w-full p-4 sm:p-6 rounded-[2rem] border shadow-sm transition-all flex flex-col items-center justify-center text-center gap-3 active:scale-95 duration-300 hover:scale-[1.03] hover:shadow-md ${
      dark 
        ? 'bg-slate-800/80 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800' 
        : 'bg-white border-slate-100 hover:bg-slate-50/50 hover:border-slate-200 shadow-slate-100'
    }`}
  >
    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 ${colorClass}`}>
      <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.5} />
    </div>
    <div className="flex-1 w-full flex flex-col items-center justify-center">
      <h5 className={`text-xs sm:text-sm font-black font-noto leading-[1.3] text-balance tracking-tight ${dark ? 'text-white' : 'text-[#1E3A8A]'}`}>
        {title}
      </h5>
      {subtitle && (
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest leading-none">
          {subtitle}
        </p>
      )}
    </div>
  </button>
);

const TeacherAccount: React.FC<TeacherAccountProps> = ({
  lang,
  setLang,
  madrasah,
  setView,
  onLogout,
  profile,
  dataVersion
}) => {
  const [loadingTeacher, setLoadingTeacher] = useState(true);
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [teacherLedgerLogs, setTeacherLedgerLogs] = useState<any[]>([]);

  // Sub-view state
  const [activeSection, setActiveSection] = useState<'main' | 'attendance' | 'salary'>('main');

  // Password / Pin state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Support / Help state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [copiedSupport, setCopiedSupport] = useState(false);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });

  // Filter states
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [salaryMonthFilter, setSalaryMonthFilter] = useState<string>('all');
  const [expandedSalaryMonth, setExpandedSalaryMonth] = useState<string | null>(null);
  const [salaryTab, setSalaryTab] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedSalaryYear, setSelectedSalaryYear] = useState<string>(new Date().getFullYear().toString());
  const [expandedSalaryYear, setExpandedSalaryYear] = useState<string | null>(null);

  const [attendanceTab, setAttendanceTab] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedAttendanceYear, setSelectedAttendanceYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>('all');

  const supportNumber = '01629780297';

  // Extract academic and display config
  const modules = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const configObj = config || {};
    return {
      class_routine: configObj.modules?.class_routine ?? false,
      messages: configObj.modules?.messages ?? true,
      teacher_attendance: configObj.teacher_attendance || {}
    };
  }, [madrasah?.config_json]);

  useEffect(() => {
    if (profile?.id && madrasah?.id) {
      const fetchTeacherDashboardData = async () => {
        setLoadingTeacher(true);
        try {
          // 1. Fetch teacher profile details
          const { data: teacher, error: teacherError } = await supabase
            .from('teachers')
            .select('*')
            .eq('id', profile.id)
            .maybeSingle();

          if (teacherError) throw teacherError;
          
          if (teacher) {
            let parsedPermissions = teacher.permissions || {};
            if (typeof teacher.permissions === 'string') {
              try {
                parsedPermissions = JSON.parse(teacher.permissions);
              } catch (e) {
                parsedPermissions = {};
              }
            }
            setTeacherInfo({
              ...teacher,
              name: teacher.teacher_name,
              phone: teacher.mobile,
              pin: parsedPermissions.raw_password,
              address: parsedPermissions.address,
              join_date: parsedPermissions.join_date,
              leave_date: parsedPermissions.leave_date,
              permissions: parsedPermissions
            });
          }

          // 2. Fetch teacher salary payment logs from ledger
          const { data: salaryLogs, error: salaryError } = await supabase
            .from('ledger')
            .select('*')
            .eq('institution_id', madrasah.id)
            .eq('type', 'expense')
            .ilike('description', `%[ID:${profile.id}]%`)
            .order('transaction_date', { ascending: false });

          if (salaryError) throw salaryError;
          setTeacherLedgerLogs(salaryLogs || []);

        } catch (err) {
          console.error("Error fetching teacher dashboard data:", err);
        } finally {
          setLoadingTeacher(false);
        }
      };

      fetchTeacherDashboardData();
    }
  }, [profile?.id, madrasah?.id, dataVersion]);

  // Attendance Calculations
  const teacherAttendanceStats = React.useMemo(() => {
    if (!madrasah || !profile?.id) return { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0, total: 0, logs: [] };
    
    const allAttendance = modules.teacher_attendance;
    
    let present = 0;
    let absent = 0;
    let late = 0;
    let half_day = 0;
    let holiday = 0;
    
    const logs: any[] = [];
    
    Object.keys(allAttendance).forEach(date => {
      const dayData = allAttendance[date] || {};
      const status = dayData[profile.id];
      if (status) {
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') late++;
        else if (status === 'half_day') half_day++;
        else if (status === 'holiday') holiday++;
        
        logs.push({ date, status });
      }
    });
    
    // Sort logs by date descending
    logs.sort((a, b) => b.date.localeCompare(a.date));
    
    return {
      present,
      absent,
      late,
      half_day,
      holiday,
      total: present + absent + late + half_day,
      logs
    };
  }, [madrasah?.config_json, profile?.id, modules.teacher_attendance]);

  // Salary Calculations
  const teacherMonthlySalaries = React.useMemo(() => {
    if (!teacherInfo) return [];
    
    const basicSalary = Number(teacherInfo.basic_salary) || 0;
    const salariesByMonth: Record<string, { month: string, paid: number, transactions: any[] }> = {};
    
    // Group transaction logs from ledger by salaryMonth
    teacherLedgerLogs.forEach(log => {
      const monthMatch = log.description.match(/Salary paid for (\d{4}-\d{2})/);
      if (monthMatch && monthMatch[1]) {
        const month = monthMatch[1];
        if (!salariesByMonth[month]) {
          salariesByMonth[month] = { month, paid: 0, transactions: [] };
        }
        salariesByMonth[month].paid += Number(log.amount) || 0;
        salariesByMonth[month].transactions.push(log);
      }
    });

    const list: any[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    let joinYear: number | null = null;
    let joinMonth: number | null = null;
    if (teacherInfo?.join_date) {
      const parts = teacherInfo.join_date.split('-');
      if (parts.length >= 2) {
        joinYear = parseInt(parts[0]);
        joinMonth = parseInt(parts[1]);
      }
    }

    const selectedYearInt = parseInt(selectedSalaryYear);

    // If selected year is older than the joining year, don't generate any months
    if (joinYear !== null && selectedYearInt < joinYear) {
      return [];
    }

    let startMonth = 12;
    if (selectedSalaryYear === currentYear.toString()) {
      startMonth = currentMonth;
    } else if (selectedYearInt > currentYear) {
      startMonth = 0; // Don't show future years' months
    }
    
    // Minimum month to generate based on joining date
    const minMonth = (joinYear !== null && joinMonth !== null && selectedYearInt === joinYear) ? joinMonth : 1;
    
    // Generate months from startMonth down to minMonth
    for (let m = startMonth; m >= minMonth; m--) {
      const mStr = `${selectedSalaryYear}-${m.toString().padStart(2, '0')}`;
      
      const monthData = salariesByMonth[mStr] || { month: mStr, paid: 0, transactions: [] };
      const due = Math.max(0, basicSalary - monthData.paid);
      
      let status = 'unpaid';
      if (basicSalary > 0) {
        if (monthData.paid >= basicSalary) status = 'paid';
        else if (monthData.paid > 0) status = 'partial';
      } else {
        if (monthData.paid > 0) status = 'paid';
      }
      
      list.push({
        month: mStr,
        basicSalary,
        paid: monthData.paid,
        due,
        status,
        transactions: monthData.transactions
      });
    }

    return list;
  }, [teacherInfo, teacherLedgerLogs, selectedSalaryYear]);

  const availableSalaryYears = React.useMemo(() => {
    const yearsSet = new Set<string>();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear.toString());
    
    teacherLedgerLogs.forEach(log => {
      const monthMatch = log.description.match(/Salary paid for (\d{4}-\d{2})/);
      if (monthMatch && monthMatch[1]) {
        const year = monthMatch[1].split('-')[0];
        yearsSet.add(year);
      }
    });

    let joinYear: number | null = null;
    if (teacherInfo?.join_date) {
      const parts = teacherInfo.join_date.split('-');
      if (parts.length >= 1) {
        joinYear = parseInt(parts[0]);
      }
    }

    let years = Array.from(yearsSet);
    if (joinYear !== null) {
      // Filter out years strictly before joinYear
      years = years.filter(yr => parseInt(yr) >= joinYear!);
      // Ensure joinYear is in the available list so they can select it
      if (!yearsSet.has(joinYear.toString())) {
        years.push(joinYear.toString());
      }
    }
    
    return years.sort((a, b) => b.localeCompare(a));
  }, [teacherLedgerLogs, teacherInfo]);

  const teacherYearlySalaries = React.useMemo(() => {
    if (!teacherInfo) return [];
    
    const basicSalary = Number(teacherInfo.basic_salary) || 0;
    const salariesByMonth: Record<string, { month: string, paid: number, transactions: any[] }> = {};
    
    teacherLedgerLogs.forEach(log => {
      const monthMatch = log.description.match(/Salary paid for (\d{4}-\d{2})/);
      if (monthMatch && monthMatch[1]) {
        const month = monthMatch[1];
        if (!salariesByMonth[month]) {
          salariesByMonth[month] = { month, paid: 0, transactions: [] };
        }
        salariesByMonth[month].paid += Number(log.amount) || 0;
        salariesByMonth[month].transactions.push(log);
      }
    });

    const today = new Date();
    const currentYear = today.getFullYear();

    let joinYear: number | null = null;
    let joinMonth: number | null = null;
    if (teacherInfo?.join_date) {
      const parts = teacherInfo.join_date.split('-');
      if (parts.length >= 2) {
        joinYear = parseInt(parts[0]);
        joinMonth = parseInt(parts[1]);
      }
    }
    
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    
    Object.keys(salariesByMonth).forEach(mStr => {
      const yr = parseInt(mStr.split('-')[0]);
      if (!isNaN(yr)) {
        yearsSet.add(yr);
      }
    });

    if (joinYear !== null) {
      yearsSet.add(joinYear);
    }
    
    let sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    if (joinYear !== null) {
      sortedYears = sortedYears.filter(y => y >= joinYear!);
    }
    
    return sortedYears.map(year => {
      let totalBasic = 0;
      let totalPaid = 0;
      let totalDue = 0;
      const allTransactions: any[] = [];
      
      const maxMonth = year === currentYear ? today.getMonth() + 1 : 12;
      const minMonth = (joinYear !== null && joinMonth !== null && year === joinYear) ? joinMonth : 1;
      
      for (let m = 1; m <= 12; m++) {
        const mStr = `${year}-${m.toString().padStart(2, '0')}`;
        const monthData = salariesByMonth[mStr] || { month: mStr, paid: 0, transactions: [] };
        
        if (m >= minMonth && (year < currentYear || m <= maxMonth)) {
          totalBasic += basicSalary;
          totalDue += Math.max(0, basicSalary - monthData.paid);
        }
        
        totalPaid += monthData.paid;
        
        if (monthData.transactions.length > 0) {
          allTransactions.push(...monthData.transactions);
        }
      }
      
      return {
        year: year.toString(),
        basicSalary: totalBasic,
        paid: totalPaid,
        due: totalDue,
        transactions: allTransactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      };
    });
  }, [teacherInfo, teacherLedgerLogs]);

  const formatSalaryMonth = (monthStr: string) => {
    if (!monthStr) return "";
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const year = parts[0];
    const month = parts[1];
    const monthIndex = parseInt(month) - 1;
    
    const bnMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const monthName = lang === 'bn' ? bnMonths[monthIndex] : enMonths[monthIndex];
    return `${monthName} ${year}`;
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert(lang === 'bn' ? 'পাসওয়ার্ড মিলছে না।' : 'Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      // Force session hydration
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          throw new Error(lang === 'bn' ? 'আপনার লগইন সেশন শেষ হয়ে গেছে। দয়া করে আবার লগইন করুন।' : 'Auth session expired. Please log out and log in again.');
        }
      }

      const response = await fetch('/api/teachers/update-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile?.id, pin: newPassword })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update PIN');
      }
      
      setShowSuccessModal({ 
        show: true, 
        title: lang === 'bn' ? 'সফল' : 'Success', 
        message: lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।' : 'Password changed successfully.' 
      });
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message || 'Error changing password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Attendance calculations & helpers
  const availableAttendanceYears = React.useMemo(() => {
    const yearsSet = new Set<string>();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear.toString());
    
    teacherAttendanceStats.logs.forEach(log => {
      const parts = log.date.split('-');
      if (parts.length >= 1) {
        yearsSet.add(parts[0]);
      }
    });

    let joinYear: number | null = null;
    if (teacherInfo?.join_date) {
      const parts = teacherInfo.join_date.split('-');
      if (parts.length >= 1) {
        joinYear = parseInt(parts[0]);
      }
    }

    let years = Array.from(yearsSet);
    if (joinYear !== null) {
      // Filter out years strictly before joinYear
      years = years.filter(yr => parseInt(yr) >= joinYear!);
      // Ensure joinYear is in the available list so they can select it
      if (!yearsSet.has(joinYear.toString())) {
        years.push(joinYear.toString());
      }
    }
    
    return years.sort((a, b) => b.localeCompare(a));
  }, [teacherAttendanceStats.logs, teacherInfo]);

  const availableAttendanceMonths = React.useMemo(() => {
    const list: { monthKey: string, label: string }[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    let joinYear: number | null = null;
    let joinMonth: number | null = null;
    if (teacherInfo?.join_date) {
      const parts = teacherInfo.join_date.split('-');
      if (parts.length >= 2) {
        joinYear = parseInt(parts[0]);
        joinMonth = parseInt(parts[1]);
      }
    }

    const selectedYearInt = parseInt(selectedAttendanceYear);

    // If selected year is older than joining year, no months
    if (joinYear !== null && selectedYearInt < joinYear) {
      return [];
    }

    let startMonth = 12;
    if (selectedAttendanceYear === currentYear.toString()) {
      startMonth = currentMonth;
    } else if (selectedYearInt > currentYear) {
      startMonth = 0; // future years
    }

    const minMonth = (joinYear !== null && joinMonth !== null && selectedYearInt === joinYear) ? joinMonth : 1;

    for (let m = startMonth; m >= minMonth; m--) {
      const mStr = `${selectedAttendanceYear}-${m.toString().padStart(2, '0')}`;
      const monthDate = new Date(selectedYearInt, m - 1, 1);
      const label = monthDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });
      list.push({ monthKey: mStr, label });
    }

    return list;
  }, [selectedAttendanceYear, teacherInfo, lang]);

  const attendanceMonthOptions = React.useMemo(() => {
    return [
      { monthKey: 'all', label: lang === 'bn' ? 'সকল মাস' : 'All Months' },
      ...availableAttendanceMonths
    ];
  }, [availableAttendanceMonths, lang]);

  // Keep selectedAttendanceMonth synchronized with available months of the selected year
  useEffect(() => {
    const validKeys = attendanceMonthOptions.map(o => o.monthKey);
    if (!validKeys.includes(selectedAttendanceMonth)) {
      // Default to the running month (latest month of that year) if available, otherwise 'all'
      const defaultMonth = attendanceMonthOptions.length > 1 ? attendanceMonthOptions[1].monthKey : 'all';
      setSelectedAttendanceMonth(defaultMonth);
    }
  }, [attendanceMonthOptions, selectedAttendanceMonth]);

  const currentFilteredAttendanceStats = React.useMemo(() => {
    const logs = teacherAttendanceStats.logs || [];
    let filtered = logs;
    
    if (attendanceTab === 'monthly') {
      // Filter by year
      filtered = filtered.filter(log => {
        const parts = log.date.split('-');
        return parts[0] === selectedAttendanceYear;
      });
      
      // Filter by month
      if (selectedAttendanceMonth !== 'all') {
        filtered = filtered.filter(log => {
          const parts = log.date.split('-');
          const mStr = `${parts[0]}-${parts[1]}`;
          return mStr === selectedAttendanceMonth;
        });
      }
    }
    
    // Calculate stats before applying status filters so card details reflect overall selection
    let present = 0;
    let absent = 0;
    let late = 0;
    let half_day = 0;
    let holiday = 0;
    
    filtered.forEach(log => {
      if (log.status === 'present') present++;
      else if (log.status === 'absent') absent++;
      else if (log.status === 'late') late++;
      else if (log.status === 'half_day') half_day++;
      else if (log.status === 'holiday') holiday++;
    });
    
    const totalWorking = present + absent + late + half_day;
    const score = totalWorking > 0 
      ? Math.round(((present + late + (half_day * 0.5)) / totalWorking) * 100) 
      : 100;
      
    // Apply status filter for flat rendered logs list
    let renderLogs = filtered;
    if (attendanceFilter === 'present') {
      renderLogs = filtered.filter(l => l.status === 'present');
    } else if (attendanceFilter === 'absent') {
      renderLogs = filtered.filter(l => l.status === 'absent');
    } else if (attendanceFilter === 'late') {
      renderLogs = filtered.filter(l => l.status === 'late');
    }
    
    return {
      present,
      absent,
      late,
      half_day,
      holiday,
      totalWorking,
      score,
      renderLogs
    };
  }, [teacherAttendanceStats.logs, attendanceTab, selectedAttendanceYear, selectedAttendanceMonth, attendanceFilter]);

  const yearlyAttendanceStats = React.useMemo(() => {
    const logs = teacherAttendanceStats.logs || [];
    const statsByYear: Record<string, { year: string, present: number, absent: number, late: number, half_day: number, holiday: number, totalWorking: number, score: number, logs: any[] }> = {};
    
    let joinYear: number | null = null;
    if (teacherInfo?.join_date) {
      const parts = teacherInfo.join_date.split('-');
      if (parts.length >= 1) {
        joinYear = parseInt(parts[0]);
      }
    }

    logs.forEach(log => {
      const parts = log.date.split('-');
      if (parts.length >= 1) {
        const year = parts[0];
        const yearInt = parseInt(year);
        // Do not process years strictly before joinYear
        if (joinYear !== null && yearInt < joinYear) {
          return;
        }

        if (!statsByYear[year]) {
          statsByYear[year] = { year, present: 0, absent: 0, late: 0, half_day: 0, holiday: 0, totalWorking: 0, score: 0, logs: [] };
        }
        
        const yrObj = statsByYear[year];
        yrObj.logs.push(log);
        
        if (log.status === 'present') yrObj.present++;
        else if (log.status === 'absent') yrObj.absent++;
        else if (log.status === 'late') yrObj.late++;
        else if (log.status === 'half_day') yrObj.half_day++;
        else if (log.status === 'holiday') yrObj.holiday++;
      }
    });
    
    // Sort years descending
    const sortedYears = Object.keys(statsByYear).sort((a, b) => b.localeCompare(a));
    
    return sortedYears.map(yr => {
      const yrObj = statsByYear[yr];
      const totalWorking = yrObj.present + yrObj.absent + yrObj.late + yrObj.half_day;
      const score = totalWorking > 0 
        ? Math.round(((yrObj.present + yrObj.late + (yrObj.half_day * 0.5)) / totalWorking) * 100) 
        : 100;
        
      return {
        ...yrObj,
        totalWorking,
        score
      };
    });
  }, [teacherAttendanceStats.logs, teacherInfo]);

  const groupedAttendanceLogs = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    const logs = currentFilteredAttendanceStats.renderLogs || [];
    logs.forEach(log => {
      const parts = log.date.split('-');
      if (parts.length >= 2) {
        const monthKey = `${parts[0]}-${parts[1]}`; // "YYYY-MM"
        if (!groups[monthKey]) {
          groups[monthKey] = [];
        }
        groups[monthKey].push(log);
      }
    });
    return groups;
  }, [currentFilteredAttendanceStats.renderLogs]);

  const sortedGroupedMonthKeys = React.useMemo(() => {
    return Object.keys(groupedAttendanceLogs).sort((a, b) => b.localeCompare(a));
  }, [groupedAttendanceLogs]);

  const convertDigits = React.useCallback((val: string | number) => {
    if (lang !== 'bn') return val.toString();
    return val.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);
  }, [lang]);

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-36 relative z-10 font-noto">
      {/* Profile Header Block */}
      {activeSection === 'main' && (
        <div className="relative pt-12 px-1">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] sm:rounded-[4rem] p-6 sm:p-10 pt-24 md:pt-32 shadow-bubble border relative text-center`}>
            <div className="absolute inset-0 overflow-hidden rounded-[3rem] sm:rounded-[4rem]">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-[0.03]" />
            </div>
            
            {/* Avatar Icon */}
            <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-20">
              <div className="relative group">
                <div className={`w-32 h-32 sm:w-40 sm:h-40 p-3 sm:p-4 rounded-full shadow-bubble border-[8px] sm:border-[12px] flex items-center justify-center overflow-hidden ${isDark ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                  {teacherInfo?.photo_url ? (
                    <img src={teacherInfo.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" />
                  ) : (
                    <div className={`w-full h-full rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}>
                      <UserIcon size={50} className="sm:w-[70px] sm:h-[70px]" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Teacher Identity Details */}
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <div className="px-4">
                  <h2 className={`text-[20px] sm:text-[32px] font-black tracking-tight leading-tight break-words whitespace-normal ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {teacherInfo?.teacher_name || profile?.full_name || 'Teacher'}
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-1.5 px-2">
                  {teacherInfo?.designation && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Box size={11} className="shrink-0" />
                      <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{teacherInfo.designation}</p>
                    </div>
                  )}
                  {teacherInfo?.mobile && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Smartphone size={11} className="shrink-0" />
                      <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{teacherInfo.mobile}</p>
                    </div>
                  )}
                  {teacherInfo?.address && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={11} className="shrink-0" />
                      <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{teacherInfo.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Joining Date, Salary and Madrasah Info */}
              <div className="pt-2 flex flex-wrap gap-3 items-center justify-center">
                {teacherInfo?.join_date && (
                  <div className={`p-3 rounded-2xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-teal-400' : 'bg-white border-slate-100 text-teal-600'}`}>
                      <CalendarIcon size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}</p>
                      <p className={`text-[11px] font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{teacherInfo.join_date}</p>
                    </div>
                  </div>
                )}

                {teacherInfo?.basic_salary && (
                  <div className={`p-3 rounded-2xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-100 text-amber-600'}`}>
                      <CreditCard size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{lang === 'bn' ? 'মূল বেতন' : 'Basic Salary'}</p>
                      <p className={`text-[11px] font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{teacherInfo.basic_salary} ৳</p>
                    </div>
                  </div>
                )}

                <div className={`p-3 rounded-2xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-100 text-blue-600'}`}>
                    <GraduationCap size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{lang === 'bn' ? 'মাদরাসা / প্রতিষ্ঠান' : 'Institution'}</p>
                    <p className={`text-[11px] font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{madrasah?.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area with Section Transitions */}
      <div className="space-y-6 mx-1 text-left">
        {loadingTeacher ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
            <p className="text-xs text-slate-400 font-bold">
              {lang === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Loading teacher details...'}
            </p>
          </div>
        ) : (
          <>
            {/* View 1: Main Dashboard Grid of Modules */}
            {activeSection === 'main' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  
                  {/* Attendance Card */}
                  <ActionCard
                    icon={Activity}
                    title={lang === 'bn' ? 'হাজিরা বিবরণী' : 'Attendance Report'}
                    subtitle={lang === 'bn' ? 'হাজিরার ইতিহাস' : 'Logs & Statistics'}
                    colorClass="bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400"
                    onClick={() => setActiveSection('attendance')}
                    dark={isDark}
                  />

                  {/* Salary Details Card */}
                  <ActionCard
                    icon={CreditCard}
                    title={lang === 'bn' ? 'বেতন বিবরণী' : 'Salary Details'}
                    subtitle={lang === 'bn' ? 'বেতন ও ট্রানজেকশন' : 'Payroll Trails'}
                    colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    onClick={() => setActiveSection('salary')}
                    dark={isDark}
                  />

                  {/* Academic Calendar Card */}
                  <ActionCard
                    icon={CalendarIcon}
                    title={lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
                    subtitle={lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
                    colorClass="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                    onClick={() => setView('academic-calendar')}
                    dark={isDark}
                  />

                  {/* Class Routine Card (Conditional) */}
                  {modules.class_routine && (
                    <ActionCard
                      icon={LayoutDashboard}
                      title={lang === 'bn' ? 'ক্লাস রুটিন' : 'Class Routine'}
                      subtitle={lang === 'bn' ? 'সময়সূচী' : 'Schedule'}
                      colorClass="bg-[#EBF5FF] text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                      onClick={() => setView('class-routine')}
                      dark={isDark}
                    />
                  )}

                  {/* Message Card (Conditional) */}
                  {modules.messages && teacherInfo?.permissions?.can_send_messages && (
                    <ActionCard
                      icon={MessageCircle}
                      title={lang === 'bn' ? 'বার্তা পাঠান' : 'Send Message'}
                      subtitle={lang === 'bn' ? 'বার্তা' : 'Messages'}
                      colorClass="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                      onClick={() => setView('messages')}
                      dark={isDark}
                    />
                  )}

                  {/* Tutorials Card */}
                  <ActionCard
                    icon={Play}
                    title={lang === 'bn' ? 'টিউটোরিয়াল' : 'Video Tutorials'}
                    subtitle={lang === 'bn' ? 'সহায়তা ভিডিও' : 'Help Videos'}
                    colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    onClick={() => setView('tutorials')}
                    dark={isDark}
                  />

                  {/* Change Password Card */}
                  <ActionCard
                    icon={Key}
                    title={lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
                    subtitle={lang === 'bn' ? 'নিরাপত্তা' : 'Security PIN'}
                    colorClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                    onClick={() => setIsChangingPassword(true)}
                    dark={isDark}
                  />

                  {/* Help Support Card */}
                  <ActionCard
                    icon={Headset}
                    title={lang === 'bn' ? 'হেল্প ডেস্ক' : 'Support Desk'}
                    subtitle={lang === 'bn' ? 'সাপোর্ট টিম' : 'Assistance'}
                    colorClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    onClick={() => setShowSupportModal(true)}
                    dark={isDark}
                  />

                  {/* Language Card */}
                  <div className={`col-span-2 md:col-span-3 p-4 sm:p-5 rounded-[2rem] border shadow-sm flex items-center justify-between gap-3 ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-100 shadow-slate-100'}`}>
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Languages className="w-6 h-6" strokeWidth={1.5} />
                      </div>
                      <div className="text-left min-w-0 pr-2">
                        <h5 className={`text-xs sm:text-sm font-black font-noto leading-[1.3] ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('language', lang)}</h5>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5">{t('change_lang', lang)}</p>
                      </div>
                    </div>
                    <div className={`flex p-1 rounded-xl border shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <button 
                        onClick={() => setLang('bn')} 
                        className={`px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg text-[10px] font-black transition-all ${lang === 'bn' ? (isDark ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
                      >
                        বাংলা
                      </button>
                      <button 
                        onClick={() => setLang('en')} 
                        className={`px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? (isDark ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
                      >
                        ENG
                      </button>
                    </div>
                  </div>

                </div>

                {/* Log Out Option Button Card */}
                <div className="pt-2">
                  <button
                    onClick={onLogout}
                    className={`w-full py-5 rounded-[2rem] border font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-sm ${
                      isDark 
                        ? 'bg-rose-500/15 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                        : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    <LogOut size={18} />
                    <span>{lang === 'bn' ? 'লগ আউট করুন' : 'Log Out'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* View 2: Detailed Attendance Page */}
            {activeSection === 'attendance' && (() => {
              const totalWorking = currentFilteredAttendanceStats.totalWorking;
              const attendanceScore = currentFilteredAttendanceStats.score;

              return (
                <div className="space-y-5 sm:space-y-6 animate-in slide-in-from-right duration-300">
                  {/* Section Header with Back button matching AcademicCalendarPage */}
                  <div
                    className={`-mx-4 -mt-6 px-4 py-4 flex items-center justify-between border-b mb-6 ${isDark ? "bg-slate-900 border-slate-800" : "bg-transparent border-blue-100"}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setActiveSection('main')}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? "bg-slate-800 text-blue-400 border-slate-700" : "bg-blue-50 text-[#2563EB] border-blue-100"}`}
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <div className="text-left">
                        <h1
                          className={`text-lg font-black font-noto ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
                        >
                          {lang === 'bn' ? 'হাজিরা বিবরণী' : 'Attendance Details'}
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                          {madrasah?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly vs Yearly Toggle Navigation */}
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <div className={`p-1 rounded-2xl flex border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-100 border-slate-200'} w-full sm:w-auto`}>
                      <button
                        onClick={() => setAttendanceTab('monthly')}
                        className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
                          attendanceTab === 'monthly'
                            ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-[#2563EB] shadow-sm')
                            : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {lang === 'bn' ? 'মাসিক রিপোর্ট' : 'Monthly Report'}
                      </button>
                      <button
                        onClick={() => setAttendanceTab('yearly')}
                        className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
                          attendanceTab === 'yearly'
                            ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-[#2563EB] shadow-sm')
                            : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {lang === 'bn' ? 'বাৎসরিক রিপোর্ট' : 'Yearly Report'}
                      </button>
                    </div>

                    {/* Quick year pill filter only for Monthly View */}
                    {attendanceTab === 'monthly' && availableAttendanceYears.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                        {availableAttendanceYears.map(yr => {
                          const isSelected = selectedAttendanceYear === yr;
                          return (
                            <button
                              key={yr}
                              onClick={() => setSelectedAttendanceYear(yr)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all shrink-0 active:scale-95 ${
                                isSelected
                                  ? (isDark ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-100 text-[#2563EB]')
                                  : (isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                              }`}
                            >
                              {convertDigits(yr)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Month Filter pills only for Monthly View */}
                  {attendanceTab === 'monthly' && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block px-1">
                        {lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1.5 max-w-full no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        {attendanceMonthOptions.map(opt => {
                          const isSelected = selectedAttendanceMonth === opt.monthKey;
                          return (
                            <button
                              key={opt.monthKey}
                              onClick={() => setSelectedAttendanceMonth(opt.monthKey)}
                              className={`px-4 py-2 rounded-xl text-xs font-black border transition-all shrink-0 active:scale-95 ${
                                isSelected
                                  ? (isDark ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600')
                                  : (isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Monthly View Content */}
                  {attendanceTab === 'monthly' && (
                    <>
                      {/* Attendance Performance Panel */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Circle Score Card */}
                        <div className={`p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border flex flex-col sm:flex-col xs:flex-row items-center justify-center text-center xs:text-left sm:text-center gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'}`}>
                          <div className="flex-1 xs:flex-none sm:flex-1 flex flex-col items-center xs:items-start sm:items-center">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3">{lang === 'bn' ? 'হাজিরার পারফরম্যান্স' : 'Attendance Performance'}</span>
                            <div className="relative flex items-center justify-center">
                              <svg className="w-24 h-24 sm:w-28 sm:h-28 transform -rotate-90">
                                <circle cx="48" cy="48" r="40" strokeWidth="6" stroke={isDark ? '#1e293b' : '#f1f5f9'} fill="transparent" />
                                <circle cx="48" cy="48" r="40" strokeWidth="6" stroke="#10b981" fill="transparent" 
                                  strokeDasharray={2 * Math.PI * 40} 
                                  strokeDashoffset={2 * Math.PI * 40 * (1 - attendanceScore / 100)} 
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-out"
                                  style={{
                                    strokeDasharray: `${2 * Math.PI * 40}`,
                                    strokeDashoffset: `${2 * Math.PI * 40 * (1 - attendanceScore / 100)}`
                                  }}
                                />
                              </svg>
                              <div className="absolute flex flex-col items-center justify-center">
                                <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{convertDigits(attendanceScore)}%</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'উপস্থিতি হার' : 'Present Rate'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="hidden xs:block sm:hidden flex-1">
                            <h4 className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>
                              {attendanceScore >= 90 
                                ? (lang === 'bn' ? 'চমৎকার উপস্থিতি!' : 'Excellent Attendance!') 
                                : attendanceScore >= 75 
                                  ? (lang === 'bn' ? 'খুব ভালো উপস্থিতি রেকর্ড' : 'Very good attendance record') 
                                  : (lang === 'bn' ? 'উপস্থিতি বৃদ্ধি করা প্রয়োজন' : 'Needs improvement')}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">
                              {lang === 'bn' 
                                ? 'মাদরাসার নিয়ম অনুযায়ী নিয়মিত ও সময়মতো হাজির হওয়া প্রতিটি শিক্ষকের নৈতিক দায়িত্ব।' 
                                : 'Every teacher is encouraged to maintain punctual attendance for the conduct of academic routine.'}
                            </p>
                          </div>
                        </div>

                        {/* Stat Cards Row */}
                        <div className="md:col-span-2 grid grid-cols-2 gap-2 sm:gap-3">
                          <div className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border flex items-center gap-2.5 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-emerald-50/30 border-emerald-100/60 shadow-sm shadow-emerald-100/10'}`}>
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                              <CheckCircle2 size={18} className="sm:w-6 sm:h-6" />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === 'bn' ? 'মোট উপস্থিত' : 'Total Present'}</p>
                              <p className={`text-lg sm:text-2xl font-black mt-0.5 truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                {convertDigits(currentFilteredAttendanceStats.present + currentFilteredAttendanceStats.late)} <span className="text-[10px] sm:text-xs font-bold text-slate-400">{lang === 'bn' ? 'দিন' : 'Days'}</span>
                              </p>
                            </div>
                          </div>

                          <div className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border flex items-center gap-2.5 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-rose-50/30 border-rose-100/60 shadow-sm shadow-rose-100/10'}`}>
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                              <X size={18} className="sm:w-6 sm:h-6" />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === 'bn' ? 'মোট অনুপস্থিত' : 'Total Absent'}</p>
                              <p className={`text-lg sm:text-2xl font-black mt-0.5 truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                {convertDigits(currentFilteredAttendanceStats.absent)} <span className="text-[10px] sm:text-xs font-bold text-slate-400">{lang === 'bn' ? 'দিন' : 'Days'}</span>
                              </p>
                            </div>
                          </div>

                          <div className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border flex items-center gap-2.5 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-amber-50/30 border-amber-100/60 shadow-sm shadow-amber-100/10'}`}>
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                              <Clock size={18} className="sm:w-6 sm:h-6" />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === 'bn' ? 'বিলম্ব আগমন' : 'Late Arrival'}</p>
                              <p className={`text-lg sm:text-2xl font-black mt-0.5 truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                {convertDigits(currentFilteredAttendanceStats.late)} <span className="text-[10px] sm:text-xs font-bold text-slate-400">{lang === 'bn' ? 'বার' : 'Times'}</span>
                              </p>
                            </div>
                          </div>

                          <div className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border flex items-center gap-2.5 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-indigo-50/30 border-indigo-100/60 shadow-sm shadow-indigo-100/10'}`}>
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                              <Activity size={18} className="sm:w-6 sm:h-6" strokeWidth={1.5} />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === 'bn' ? 'অর্ধ-ছুটি ও অন্যান্য' : 'Half Leave'}</p>
                              <p className={`text-lg sm:text-2xl font-black mt-0.5 truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                {convertDigits(currentFilteredAttendanceStats.half_day)} <span className="text-[10px] sm:text-xs font-bold text-slate-400">{lang === 'bn' ? 'দিন' : 'Days'}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Filter Interactive Row with sleek touch layout */}
                      <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className={`p-1.5 rounded-2xl border flex flex-row flex-nowrap w-max sm:w-full gap-1.5 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-100 shadow-inner'}`}>
                          {[
                            { id: 'all', label: lang === 'bn' ? 'সকল রেকর্ড' : 'All Logs', count: currentFilteredAttendanceStats.present + currentFilteredAttendanceStats.absent + currentFilteredAttendanceStats.late + currentFilteredAttendanceStats.half_day + currentFilteredAttendanceStats.holiday },
                            { id: 'present', label: lang === 'bn' ? 'উপস্থিত' : 'Present', count: currentFilteredAttendanceStats.present },
                            { id: 'absent', label: lang === 'bn' ? 'অনুপস্থিত' : 'Absent', count: currentFilteredAttendanceStats.absent },
                            { id: 'late', label: lang === 'bn' ? 'বিলম্ব' : 'Late', count: currentFilteredAttendanceStats.late }
                          ].map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setAttendanceFilter(tab.id as any)}
                              className={`px-3.5 py-2 rounded-xl text-[10px] sm:text-[11px] font-black tracking-wide uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                                attendanceFilter === tab.id
                                  ? (isDark ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-md shadow-blue-500/5')
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <span>{tab.label}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                                attendanceFilter === tab.id
                                  ? (isDark ? 'bg-slate-600 text-blue-200' : 'bg-blue-50 text-blue-600')
                                  : (isDark ? 'bg-slate-800/50 text-slate-500' : 'bg-slate-200/50 text-slate-500')
                              }`}>{convertDigits(tab.count)}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Grouped Attendance List */}
                      {sortedGroupedMonthKeys.length === 0 ? (
                        <div className={`p-8 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border text-center ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-100'}`}>
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="text-slate-400" size={24} />
                          </div>
                          <h4 className={`text-sm sm:text-base font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {lang === 'bn' ? 'কোনো হাজিরার রেকর্ড পাওয়া যায়নি' : 'No attendance logs found.'}
                          </h4>
                          <p className="text-[10px] sm:text-xs text-slate-400 font-bold mt-1">
                            {lang === 'bn' ? 'নির্বাচিত ফিল্টারের জন্য কোনো উপস্থিতি ডাটা নেই' : 'There is no data matching your selection.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-5 sm:space-y-6">
                          {sortedGroupedMonthKeys.map(monthKey => {
                            const logs = groupedAttendanceLogs[monthKey] || [];
                            const monthNameFormatted = formatSalaryMonth(monthKey);
                            
                            return (
                              <div key={monthKey} className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                  <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {monthNameFormatted}
                                  </h4>
                                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                                    {convertDigits(logs.length)} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                                  {logs.map(log => {
                                    const logDate = new Date(log.date);
                                    const dayNum = logDate.getDate();
                                    const weekday = logDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long' });
                                    const monthAbbr = logDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short' });
                                    
                                    // Status-specific decorations
                                    let statusColor = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                                    let statusText = lang === 'bn' ? 'ছুটি' : 'Holiday';
                                    let descText = lang === 'bn' ? 'মাদরাসা ছুটির দিন' : 'Madrasah official holiday';
                                    
                                    if (log.status === 'present') {
                                      statusColor = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 border-emerald-500/30';
                                      statusText = lang === 'bn' ? 'উপস্থিত' : 'Present';
                                      descText = lang === 'bn' ? 'নির্ধারিত রুটিন অনুযায়ী সময়মতো উপস্থিত ছিলেন' : 'Present on scheduled classes';
                                    } else if (log.status === 'absent') {
                                      statusColor = 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 border-rose-500/30';
                                      statusText = lang === 'bn' ? 'অনুপস্থিত' : 'Absent';
                                      descText = lang === 'bn' ? 'অনুমতি ছাড়াই বা ছুটি ব্যতীত অনুপস্থিত ছিলেন' : 'Absent without prior approved leave';
                                    } else if (log.status === 'late') {
                                      statusColor = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 border-amber-500/30';
                                      statusText = lang === 'bn' ? 'বিলম্ব' : 'Late';
                                      descText = lang === 'bn' ? 'নির্ধারিত সময়ের পরে উপস্থিত হয়েছেন' : 'Reported after scheduled start time';
                                    } else if (log.status === 'half_day') {
                                      statusColor = 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 border-indigo-500/30';
                                      statusText = lang === 'bn' ? 'অর্ধ-ছুটি' : 'Half Day';
                                      descText = lang === 'bn' ? 'অর্ধদিবস ছুটি বা বিশেষ ক্লাসের দায়িত্ব পালন' : 'Approved leave for half of the day';
                                    }

                                    return (
                                      <div 
                                        key={log.date}
                                        className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border flex items-center justify-between gap-3 sm:gap-4 transition-all duration-200 hover:scale-[1.01] ${
                                          isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/40'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                                          {/* Date Box */}
                                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border shrink-0 ${
                                            isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                                          }`}>
                                            <span className={`text-sm sm:text-base font-black leading-none ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{convertDigits(dayNum)}</span>
                                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{monthAbbr}</span>
                                          </div>

                                          <div className="text-left min-w-0 flex-1">
                                            <span className="text-[10px] font-black block text-slate-400 uppercase tracking-widest leading-none mb-1">{weekday}</span>
                                            <p className={`text-[11px] sm:text-xs font-bold leading-tight text-balance break-words ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{descText}</p>
                                          </div>
                                        </div>

                                        <span className={`px-2.5 py-1 rounded-full text-[8px] sm:text-[9px] font-black border uppercase tracking-wider shrink-0 ${statusColor}`}>
                                          {statusText}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Yearly View Content */}
                  {attendanceTab === 'yearly' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                      <div className="flex items-center justify-between px-2">
                        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {lang === 'bn' ? 'বাৎসরিক হাজিরা বিবরণী' : 'Yearly Attendance Reports'}
                        </h4>
                      </div>
                      
                      <div className="space-y-4">
                        {yearlyAttendanceStats.length === 0 ? (
                          <div className={`p-8 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border text-center ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-100'}`}>
                            <AlertCircle className="text-slate-400 mx-auto mb-3" size={24} />
                            <h4 className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {lang === 'bn' ? 'কোনো রেকর্ড পাওয়া যায়নি' : 'No records found.'}
                            </h4>
                          </div>
                        ) : (
                          yearlyAttendanceStats.map(stat => (
                            <div
                              key={stat.year}
                              className={`p-5 sm:p-6 rounded-[2rem] border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 transition-all duration-300 ${
                                isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'
                              }`}
                            >
                              {/* Year & Score block */}
                              <div className="flex items-center gap-4">
                                <div className="relative flex items-center justify-center shrink-0">
                                  <svg className="w-16 h-16 transform -rotate-90">
                                    <circle cx="32" cy="32" r="26" strokeWidth="4" stroke={isDark ? '#1e293b' : '#f1f5f9'} fill="transparent" />
                                    <circle cx="32" cy="32" r="26" strokeWidth="4" stroke="#10b981" fill="transparent" 
                                      strokeDasharray={2 * Math.PI * 26} 
                                      strokeDashoffset={2 * Math.PI * 26 * (1 - stat.score / 100)} 
                                      strokeLinecap="round"
                                      className="transition-all duration-1000 ease-out"
                                      style={{
                                        strokeDasharray: `${2 * Math.PI * 26}`,
                                        strokeDashoffset: `${2 * Math.PI * 26 * (1 - stat.score / 100)}`
                                      }}
                                    />
                                  </svg>
                                  <div className="absolute flex flex-col items-center justify-center">
                                    <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{convertDigits(stat.score)}%</span>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{lang === 'bn' ? 'বছর' : 'Year'}</span>
                                  <h5 className={`text-base sm:text-lg font-black leading-none mt-0.5 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                    {convertDigits(stat.year)}
                                  </h5>
                                </div>
                              </div>

                              {/* Stats block */}
                              <div className="grid grid-cols-4 gap-2 flex-1 md:max-w-md">
                                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                                  <span className="text-[8px] font-bold text-slate-400 block truncate">{lang === 'bn' ? 'উপস্থিত' : 'Present'}</span>
                                  <span className={`text-xs font-black block mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{convertDigits(stat.present + stat.late)} {lang === 'bn' ? 'দিন' : 'd'}</span>
                                </div>
                                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                                  <span className="text-[8px] font-bold text-slate-400 block truncate">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                                  <span className={`text-xs font-black block mt-0.5 text-rose-500`}>{convertDigits(stat.absent)} {lang === 'bn' ? 'দিন' : 'd'}</span>
                                </div>
                                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                                  <span className="text-[8px] font-bold text-slate-400 block truncate">{lang === 'bn' ? 'বিলম্ব' : 'Late'}</span>
                                  <span className={`text-xs font-black block mt-0.5 text-amber-500`}>{convertDigits(stat.late)} {lang === 'bn' ? 'বার' : 't'}</span>
                                </div>
                                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                                  <span className="text-[8px] font-bold text-slate-400 block truncate">{lang === 'bn' ? 'ছুটি/অন্যান্য' : 'Leave/Other'}</span>
                                  <span className={`text-xs font-black block mt-0.5 text-indigo-500`}>{convertDigits(stat.half_day + stat.holiday)} {lang === 'bn' ? 'দিন' : 'd'}</span>
                                </div>
                              </div>

                              {/* Action button */}
                              <div className="flex items-center justify-end shrink-0">
                                <button
                                  onClick={() => {
                                    setAttendanceTab('monthly');
                                    setSelectedAttendanceYear(stat.year);
                                    setSelectedAttendanceMonth('all');
                                  }}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all active:scale-95 ${
                                    isDark 
                                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/15' 
                                      : 'bg-blue-50 border-blue-100 text-[#2563EB] hover:bg-blue-100/60'
                                  }`}
                                >
                                  <span>{lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}</span>
                                  <ArrowRight size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer alert */}
                  <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border flex gap-3 text-left ${isDark ? 'bg-blue-500/5 border-blue-500/10 text-blue-300' : 'bg-blue-50/40 border-blue-100 text-blue-700'}`}>
                    <Info size={18} className="shrink-0 mt-0.5 text-blue-500" />
                    <div className="space-y-1">
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider leading-none">{lang === 'bn' ? 'জরুরি নির্দেশনা' : 'Guideline Notice'}</p>
                      <p className="text-[10px] sm:text-[11px] font-bold leading-relaxed opacity-95">
                        {lang === 'bn' 
                          ? 'হাজিরা বা ছুটির রিপোর্টে কোনো অসঙ্গতি বা তথ্যের সংশোধন প্রয়োজন হলে দয়া করে মাদরাসার প্রধান পরিচালক অথবা অ্যাডমিন প্যানেলের সাথে সরাসরি যোগাযোগ করুন।'
                          : 'If you notice any discrepancy or mismatch in your attendance data, please contact the institution head or admin office directly for corrections.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* View 3: Detailed Salary Page */}
            {activeSection === 'salary' && (() => {
              const basicSalary = Number(teacherInfo?.basic_salary) || 0;
              const totalPaid = salaryTab === 'monthly'
                ? teacherMonthlySalaries.reduce((sum, s) => sum + s.paid, 0)
                : teacherYearlySalaries.reduce((sum, y) => sum + y.paid, 0);
              const totalDue = salaryTab === 'monthly'
                ? teacherMonthlySalaries.reduce((sum, s) => sum + s.due, 0)
                : teacherYearlySalaries.reduce((sum, y) => sum + y.due, 0);

              return (
                <div className="space-y-5 sm:space-y-6 animate-in slide-in-from-right duration-300">
                  {/* Section Header with Back button matching AcademicCalendarPage */}
                  <div
                    className={`-mx-4 -mt-6 px-4 py-4 flex items-center justify-between border-b mb-4 ${isDark ? "bg-slate-900 border-slate-800" : "bg-transparent border-blue-100"}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setActiveSection('main')}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? "bg-slate-800 text-blue-400 border-slate-700" : "bg-blue-50 text-[#2563EB] border-blue-100"}`}
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <div className="text-left">
                        <h1
                          className={`text-lg font-black font-noto ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
                        >
                          {lang === 'bn' ? 'বেতন বিবরণী' : 'Salary Details'}
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                          {madrasah?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly vs Yearly Toggle Navigation */}
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <div className={`p-1 rounded-2xl flex border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-100 border-slate-200'} w-full sm:w-auto`}>
                      <button
                        onClick={() => setSalaryTab('monthly')}
                        className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
                          salaryTab === 'monthly'
                            ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-[#2563EB] shadow-sm')
                            : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {lang === 'bn' ? 'মাসিক পেমেন্ট' : 'Monthly Payments'}
                      </button>
                      <button
                        onClick={() => setSalaryTab('yearly')}
                        className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
                          salaryTab === 'yearly'
                            ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-[#2563EB] shadow-sm')
                            : 'text-slate-400 hover:text-slate-500'
                        }`}
                      >
                        {lang === 'bn' ? 'বাৎসরিক বিবরণী' : 'Yearly Ledger'}
                      </button>
                    </div>

                    {/* Quick year pill filter only for Monthly View */}
                    {salaryTab === 'monthly' && availableSalaryYears.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                        {availableSalaryYears.map(yr => {
                          const isSelected = selectedSalaryYear === yr;
                          return (
                            <button
                              key={yr}
                              onClick={() => {
                                setSelectedSalaryYear(yr);
                                setExpandedSalaryMonth(null);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all shrink-0 active:scale-95 ${
                                isSelected
                                  ? (isDark ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-100 text-[#2563EB]')
                                  : (isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                              }`}
                            >
                              {convertDigits(yr)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Financial KPI Grid with ultra-responsive dual stacking */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {/* Basic Salary Card */}
                    <div className={`p-3 sm:p-5 rounded-2xl sm:rounded-[2.5rem] border relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'}`}>
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <CreditCard size={18} className="sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-tight truncate">
                          {lang === 'bn' ? 'মাসিক মূল বেতন' : 'Basic Salary'}
                        </span>
                        <p className={`text-sm sm:text-2xl font-black mt-0.5 sm:mt-1 truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {convertDigits(basicSalary)}
                          <span className="text-[10px] sm:text-xs font-black text-slate-400 ml-0.5">৳</span>
                        </p>
                      </div>
                    </div>

                    {/* Total Paid Card */}
                    <div className={`p-3 sm:p-5 rounded-2xl sm:rounded-[2.5rem] border relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'}`}>
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <TrendingUp size={18} className="sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-tight truncate">
                          {salaryTab === 'monthly' ? (lang === 'bn' ? 'প্রাপ্তি (বাৎসরিক)' : 'Paid (Annual)') : (lang === 'bn' ? 'সর্বমোট প্রাপ্তি' : 'Total Paid')}
                        </span>
                        <p className="text-sm sm:text-2xl font-black text-emerald-500 mt-0.5 sm:mt-1 truncate">
                          {convertDigits(totalPaid)}
                          <span className="text-[10px] sm:text-xs font-black text-emerald-400 ml-0.5">৳</span>
                        </p>
                      </div>
                    </div>

                    {/* Total Due Card */}
                    <div className={`p-3 sm:p-5 rounded-2xl sm:rounded-[2.5rem] border relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-4 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'}`}>
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                        <AlertCircle size={18} className="sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-tight truncate">
                          {salaryTab === 'monthly' ? (lang === 'bn' ? 'বকেয়া (বাৎসরিক)' : 'Due (Annual)') : (lang === 'bn' ? 'সর্বমোট বকেয়া' : 'Total Due')}
                        </span>
                        <p className={`text-sm sm:text-2xl font-black mt-0.5 sm:mt-1 truncate ${totalDue > 0 ? 'text-rose-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                          {convertDigits(totalDue)}
                          <span className="text-[10px] sm:text-xs font-black text-slate-400 ml-0.5">৳</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly View */}
                  {salaryTab === 'monthly' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {lang === 'bn' 
                            ? `${convertDigits(selectedSalaryYear)} সালের মাসিক পেমেন্ট লেজার` 
                            : `Monthly Payment Ledger for ${selectedSalaryYear}`}
                        </h4>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                          {lang === 'bn' ? '১২ মাসের রেকর্ড' : '12 Months Record'}
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        {teacherMonthlySalaries.map(sal => {
                          const isExpanded = expandedSalaryMonth === sal.month;
                          const percentPaid = sal.basicSalary > 0 
                            ? Math.min(100, Math.round((sal.paid / sal.basicSalary) * 100)) 
                            : sal.paid > 0 ? 100 : 0;

                          // Status decor
                          let badgeColor = 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 border-rose-500/30';
                          let badgeText = lang === 'bn' ? 'অপরিশোধিত' : 'Unpaid';
                          if (sal.status === 'paid') {
                            badgeColor = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 border-emerald-500/30';
                            badgeText = lang === 'bn' ? 'পরিশোধিত' : 'Paid';
                          } else if (sal.status === 'partial') {
                            badgeColor = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 border-amber-500/30';
                            badgeText = lang === 'bn' ? 'আংশিক পরিশোধ' : 'Partial Paid';
                          }

                          return (
                            <div 
                              key={sal.month}
                              className={`rounded-2xl sm:rounded-[2.5rem] border overflow-hidden transition-all duration-300 ${
                                isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'
                              }`}
                            >
                              {/* Card Header (Click to expand) */}
                              <button
                                onClick={() => setExpandedSalaryMonth(isExpanded ? null : sal.month)}
                                className="w-full p-4 sm:p-6 text-left flex items-center justify-between gap-3 sm:gap-4 select-none focus:outline-none"
                              >
                                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">
                                    {lang === 'bn' ? 'বেতন মাস' : 'Payroll Month'}
                                  </span>
                                  <h5 className={`text-sm sm:text-base font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                    {formatSalaryMonth(sal.month)}
                                  </h5>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className={`px-2.5 py-1 rounded-full text-[8px] sm:text-[9px] font-black border uppercase tracking-wider shrink-0 ${badgeColor}`}>
                                    {badgeText}
                                  </span>
                                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all ${
                                    isExpanded 
                                      ? (isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-100 border-slate-200 text-[#1E3A8A]')
                                      : (isDark ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400')
                                  }`}>
                                    {isExpanded ? <ChevronUp size={14} className="sm:w-4 sm:h-4" /> : <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
                                  </div>
                                </div>
                              </button>

                              {/* Card Details Panel */}
                              <div className={`transition-all duration-300 border-t border-slate-100 dark:border-slate-800/60 overflow-hidden ${
                                isExpanded ? 'max-h-[1000px] p-4 sm:p-6 opacity-100 bg-slate-50/20 dark:bg-slate-900/10' : 'max-h-0 opacity-0 pointer-events-none'
                              }`}>
                                <div className="space-y-4 sm:space-y-5">
                                  {/* Sleek Progress Bar */}
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                                      <span>{lang === 'bn' ? 'পরিশোধের অগ্রগতি' : 'Payment Progress'}</span>
                                      <span className="font-mono text-xs font-black">{convertDigits(percentPaid)}%</span>
                                    </div>
                                    <div className="w-full h-2.5 sm:h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                                          sal.status === 'paid' ? 'bg-emerald-500' : sal.status === 'partial' ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${percentPaid}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Metrics Row - High-density design */}
                                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                                    <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center border ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">{lang === 'bn' ? 'মূল বেতন' : 'Salary target'}</span>
                                      <p className={`text-xs sm:text-sm font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{convertDigits(sal.basicSalary)} ৳</p>
                                    </div>
                                    <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center border ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50/20 border-emerald-100/30'}`}>
                                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">{lang === 'bn' ? 'প্রাপ্তি' : 'Received'}</span>
                                      <p className="text-xs sm:text-sm font-black text-emerald-500 mt-1">{convertDigits(sal.paid)} ৳</p>
                                    </div>
                                    <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center border ${sal.due > 0 ? (isDark ? 'bg-rose-500/5 border-rose-500/10' : 'bg-rose-50/20 border-rose-100/30') : (isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-slate-100')}`}>
                                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">{lang === 'bn' ? 'বকেয়া' : 'Remaining Due'}</span>
                                      <p className={`text-xs sm:text-sm font-black mt-1 ${sal.due > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{convertDigits(sal.due)} ৳</p>
                                    </div>
                                  </div>

                                  {/* Transactions timeline */}
                                  <div className="pt-1.5">
                                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2.5">
                                      {lang === 'bn' ? 'পেমেন্ট ট্রানজেকশন ট্রেইল' : 'Payment Transaction Trails'}
                                    </p>
                                    
                                    {sal.transactions.length === 0 ? (
                                      <div className="text-center py-3.5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl text-[11px] text-slate-400 font-bold">
                                        {lang === 'bn' ? 'এই মাসে এখনো কোনো বেতন প্রদান করা হয়নি।' : 'No payments transaction found for this month.'}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {sal.transactions.map((t: any) => {
                                          const formattedDate = new Date(t.transaction_date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                                          
                                          return (
                                            <div 
                                              key={t.id} 
                                              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border flex items-center justify-between gap-3 ${
                                                isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/10'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                  <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                                                </div>
                                                <div className="text-left min-w-0 flex-1">
                                                  <span className={`text-[11px] sm:text-xs font-black block leading-snug break-words ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                    {t.description?.replace(/\[ID:.*?\]\s*/g, '') || (lang === 'bn' ? 'বেতন ফান্ড বিতরণ' : 'Salary Fund Disbursement')}
                                                  </span>
                                                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono font-bold leading-none mt-0.5 block">{formattedDate}</span>
                                                </div>
                                              </div>
                                              <span className="text-xs sm:text-sm font-black text-emerald-500 font-mono shrink-0">+{convertDigits(t.amount)} ৳</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Yearly View */}
                  {salaryTab === 'yearly' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {lang === 'bn' ? 'বাৎসরিক বেতন বিবরণী তালিকা' : 'Annual Ledger Statements'}
                        </h4>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                          {lang === 'bn' ? `${convertDigits(teacherYearlySalaries.length)} বছর` : `${teacherYearlySalaries.length} Years`}
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        {teacherYearlySalaries.map(yrData => {
                          const isExpanded = expandedSalaryYear === yrData.year;
                          const percentPaid = yrData.basicSalary > 0 
                            ? Math.min(100, Math.round((yrData.paid / yrData.basicSalary) * 100)) 
                            : yrData.paid > 0 ? 100 : 0;

                          // Status decor
                          let badgeColor = 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 border-rose-500/30';
                          let badgeText = lang === 'bn' ? 'অপরিশোধিত' : 'Unpaid';
                          if (percentPaid === 100) {
                            badgeColor = 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 border-emerald-500/30';
                            badgeText = lang === 'bn' ? 'পরিশোধিত' : 'Fully Paid';
                          } else if (percentPaid > 0) {
                            badgeColor = 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 border-amber-500/30';
                            badgeText = lang === 'bn' ? 'আংশিক পরিশোধ' : 'Partially Paid';
                          }

                          return (
                            <div 
                              key={yrData.year}
                              className={`rounded-2xl sm:rounded-[2.5rem] border overflow-hidden transition-all duration-300 ${
                                isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/50'
                              }`}
                            >
                              {/* Card Header */}
                              <button
                                onClick={() => setExpandedSalaryYear(isExpanded ? null : yrData.year)}
                                className="w-full p-4 sm:p-6 text-left flex items-center justify-between gap-3 sm:gap-4 select-none focus:outline-none"
                              >
                                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">
                                    {lang === 'bn' ? 'হিসাব বছর' : 'Account Year'}
                                  </span>
                                  <h5 className={`text-sm sm:text-base font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                    {lang === 'bn' ? `${convertDigits(yrData.year)} সাল` : `${yrData.year} Fiscal Year`}
                                  </h5>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className={`px-2.5 py-1 rounded-full text-[8px] sm:text-[9px] font-black border uppercase tracking-wider shrink-0 ${badgeColor}`}>
                                    {badgeText}
                                  </span>
                                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all ${
                                    isExpanded 
                                      ? (isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-100 border-slate-200 text-[#1E3A8A]')
                                      : (isDark ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400')
                                  }`}>
                                    {isExpanded ? <ChevronUp size={14} className="sm:w-4 sm:h-4" /> : <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
                                  </div>
                                </div>
                              </button>

                              {/* Card Details Panel */}
                              <div className={`transition-all duration-300 border-t border-slate-100 dark:border-slate-800/60 overflow-hidden ${
                                isExpanded ? 'max-h-[1000px] p-4 sm:p-6 opacity-100 bg-slate-50/20 dark:bg-slate-900/10' : 'max-h-0 opacity-0 pointer-events-none'
                              }`}>
                                <div className="space-y-4 sm:space-y-5">
                                  {/* Progress bar */}
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                                      <span>{lang === 'bn' ? 'বাৎসরিক পরিশোধের অগ্রগতি' : 'Annual Payment Progress'}</span>
                                      <span className="font-mono text-xs font-black">{convertDigits(percentPaid)}%</span>
                                    </div>
                                    <div className="w-full h-2.5 sm:h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                                          percentPaid === 100 ? 'bg-emerald-500' : percentPaid > 0 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${percentPaid}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Metrics Row */}
                                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                                    <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center border ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">{lang === 'bn' ? 'মোট বাৎসরিক লক্ষ্য' : 'Annual target'}</span>
                                      <p className={`text-xs sm:text-sm font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{convertDigits(yrData.basicSalary)} ৳</p>
                                    </div>
                                    <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center border ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50/20 border-emerald-100/30'}`}>
                                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">{lang === 'bn' ? 'প্রাপ্তি' : 'Received'}</span>
                                      <p className="text-xs sm:text-sm font-black text-emerald-500 mt-1">{convertDigits(yrData.paid)} ৳</p>
                                    </div>
                                    <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center border ${yrData.due > 0 ? (isDark ? 'bg-rose-500/5 border-rose-500/10' : 'bg-rose-50/20 border-rose-100/30') : (isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-slate-100')}`}>
                                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight truncate">{lang === 'bn' ? 'বকেয়া' : 'Remaining Due'}</span>
                                      <p className={`text-xs sm:text-sm font-black mt-1 ${yrData.due > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{convertDigits(yrData.due)} ৳</p>
                                    </div>
                                  </div>

                                  {/* Switch to monthly filter action */}
                                  <div className="flex justify-end pt-1">
                                    <button
                                      onClick={() => {
                                        setSelectedSalaryYear(yrData.year);
                                        setSalaryTab('monthly');
                                        setExpandedSalaryYear(null);
                                        setExpandedSalaryMonth(null);
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider border shadow-sm active:scale-95 transition-all ${
                                        isDark 
                                          ? 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400' 
                                          : 'bg-blue-50 hover:bg-blue-100/60 border-blue-100 text-[#2563EB]'
                                      }`}
                                    >
                                      {lang === 'bn' ? 'এই বছরের মাসিক বিবরণী দেখুন' : 'View Monthly Breakdown'}
                                    </button>
                                  </div>

                                  {/* Annual Transactions List */}
                                  <div className="pt-2">
                                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2.5">
                                      {lang === 'bn' ? 'বাৎসরিক ট্রানজেকশন হিস্ট্রি' : 'Annual Transaction History'}
                                    </p>
                                    {yrData.transactions.length === 0 ? (
                                      <div className="text-center py-3.5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl text-[11px] text-slate-400 font-bold">
                                        {lang === 'bn' ? 'এই বছরে কোনো বেতন লেনদেন পাওয়া যায়নি।' : 'No payments found for this year.'}
                                      </div>
                                    ) : (
                                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 no-scrollbar">
                                        {yrData.transactions.map((t: any) => {
                                          const formattedDate = new Date(t.transaction_date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                                          return (
                                            <div 
                                              key={t.id}
                                              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border flex items-center justify-between gap-3 ${
                                                isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white border-slate-100 shadow-sm shadow-slate-100/10'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                  <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                                                </div>
                                                <div className="text-left min-w-0 flex-1">
                                                  <span className={`text-[11px] sm:text-xs font-black block leading-snug break-words ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                    {t.description?.replace(/\[ID:.*?\]\s*/g, '') || (lang === 'bn' ? 'বেতন বিতরণ' : 'Disbursement')}
                                                  </span>
                                                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono font-bold leading-none mt-0.5 block">{formattedDate}</span>
                                                </div>
                                              </div>
                                              <span className="text-xs sm:text-sm font-black text-emerald-500 font-mono shrink-0">+{convertDigits(t.amount)} ৳</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Salary and Payment Disclaimer */}
                  <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border flex gap-3 text-left ${isDark ? 'bg-blue-500/5 border-blue-500/10 text-blue-300' : 'bg-blue-50/40 border-blue-100 text-blue-700'}`}>
                    <Info size={18} className="shrink-0 mt-0.5 text-blue-500" />
                    <div className="space-y-1">
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider leading-none">{lang === 'bn' ? 'জরুরি নির্দেশনা' : 'Guideline Notice'}</p>
                      <p className="text-[10px] sm:text-[11px] font-bold leading-relaxed opacity-95">
                        {lang === 'bn' 
                          ? 'বেতন ও অন্যান্য ভাতার পেমেন্ট ট্রানজেকশনে কোনো অসঙ্গতি বা তথ্যের সংশোধনের প্রয়োজন হলে মাদরাসার প্রধান পরিচালক অথবা অ্যাকাউন্টিং বিভাগে যোগাযোগ করুন।'
                          : 'For any queries regarding payroll transactions, voucher references, or monthly disbursement amounts, please contact the Accounting section or the head director.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Change Password / Pin Modal */}
      {isChangingPassword && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
                  </h3>
                </div>
                <button onClick={() => setIsChangingPassword(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={newPassword} 
                     onChange={(e) => setNewPassword(e.target.value)} 
                     placeholder="••••••••"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={confirmPassword} 
                     onChange={(e) => setConfirmPassword(e.target.value)} 
                     placeholder="••••••••"
                   />
                 </div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsChangingPassword(false)} className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                 <button onClick={handleChangePassword} disabled={changingPassword} className="flex-[2] py-4 bg-[#2563EB] text-white font-black rounded-2xl text-[10px] uppercase shadow-premium flex items-center justify-center gap-2">
                   {changingPassword ? <Loader2 className="animate-spin" size={16} /> : (lang === 'bn' ? 'পরিবর্তন করুন' : 'Change')}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* 2. Support Info Modal */}
      {showSupportModal && createPortal(
         <div className="modal-overlay bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 z-[100]">
            <div className={`w-[90%] max-w-[340px] rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500 border overflow-hidden relative p-8 md:p-10 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
               <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto transition-transform hover:rotate-12 duration-500 ${isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                       <Headset size={48} strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 border-4 border-white dark:border-slate-900 rounded-full flex items-center justify-center animate-pulse">
                       <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                     <h3 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                        {lang === 'bn' ? 'সাপোর্ট ডেস্ক' : 'Support Desk'}
                     </h3>
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Always here to help</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className={`w-full py-5 rounded-3xl border font-mono font-black text-[22px] tracking-widest transition-all relative overflow-hidden flex items-center justify-center gap-3 ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#2563EB]'}`}>
                       {supportNumber}
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(supportNumber);
                           setCopiedSupport(true);
                           setTimeout(() => setCopiedSupport(false), 2000);
                         }}
                         className={`p-2 rounded-xl transition-all active:scale-75 ${copiedSupport ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                       >
                          {copiedSupport ? <Check size={20} /> : <Copy size={20} />}
                       </button>
                    </div>
                    
                    <div className="pt-2">
                       <a 
                         href={`https://wa.me/${supportNumber.replace(/[^0-9]/g, '')}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 border ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-white border-emerald-400 hover:bg-emerald-600'}`}
                       >
                         <MessageCircle size={22} strokeWidth={2.5} />
                         <span className="text-xs font-black uppercase tracking-[0.15em]">Chat on WhatsApp</span>
                       </a>
                    </div>
                  </div>

                  <div className="pt-4">
                     <button 
                       onClick={() => setShowSupportModal(false)}
                       className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                     >
                       {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                     </button>
                  </div>
               </div>
            </div>
         </div>,
         document.body
      )}

      {/* 3. Success Notification Modal */}
      {showSuccessModal.show && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 animate-in zoom-in-95 duration-500 p-10 text-center relative ${isDark ? 'bg-slate-900 border-slate-800 shadow-emerald-500/10' : 'bg-white border-white shadow-emerald-200/50'}`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            
            <div className="relative">
              <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-[2rem] animate-ping duration-1000"></div>
                <CheckCircle2 size={48} strokeWidth={3} className="relative z-10" />
              </div>
              
              <h2 className={`text-3xl font-black mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {showSuccessModal.title}
              </h2>
              
              <p className={`text-sm font-bold leading-relaxed px-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {showSuccessModal.message}
              </p>
              
              <button 
                onClick={() => setShowSuccessModal({ ...showSuccessModal, show: false })}
                className="mt-10 w-full h-16 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-90 hover:scale-[1.02] transition-all text-sm uppercase tracking-[0.2em]"
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'Awesome'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TeacherAccount;
