
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2, Lock, Terminal, Cpu, Calendar as CalendarIcon, MapPin, Play, Moon, Sun, PhoneCall, UserCheck, MessageCircle, MessageSquareText, Headset, Phone, Package, ExternalLink, FileText, Clock, Heart } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { requestManager, CACHE_TTLS } from 'services/RequestManager';
import { Institution, Language, View, Profile } from 'types';
import { t } from 'translations';
import { AcademicYearManager } from 'components/AcademicYearManager';
import MultiCalendar from 'components/MultiCalendar';
import PaymentCheckout from '../components/PaymentCheckout';
import { hasAdmissionFormAccess } from 'utils/packageUtils';

const compressAndResizeImage = (file: File, maxWidth = 300, maxHeight = 300): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const ActionCard = ({ icon: Icon, title, subtitle, colorClass, onClick, dark }: any) => (
  <button 
    onClick={onClick}
    className={`w-full p-4 sm:p-5 rounded-[2rem] border shadow-sm transition-all flex flex-col items-center justify-center text-center gap-3 active:scale-95 duration-300 hover:scale-[1.03] hover:shadow-md ${
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

interface AccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  onProfileUpdate?: () => void;
  setView: (view: View) => void;
  initialMadrasah: Institution | null;
  onLogout: () => void;
  profile?: Profile | null;
  dataVersion?: number;
}

const Account: React.FC<AccountProps> = ({ lang, setLang, onProfileUpdate, setView, initialMadrasah, onLogout, profile, dataVersion = 0 }) => {
  const getEnglishPkgName = (name: string) => {
    if (!name) return '';
    const mapping: { [key: string]: string } = {
      'স্টার্টার': 'Starter',
      'বেসিক': 'Basic',
      'স্মার্ট': 'Smart',
      'একাডেমিক': 'Academic',
      'স্ট্যান্ডার্ড': 'Standard',
      'ফিনান্স': 'Finance',
      'প্রফেশনাল': 'Professional',
      'এন্টারপ্রাইজ': 'Enterprise'
    };
    return mapping[name] || name;
  };

  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Teacher-specific states
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [teacherLedgerLogs, setTeacherLedgerLogs] = useState<any[]>([]);
  const [isEditingSubscription, setIsEditingSubscription] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');
  const [adminNagad, setAdminNagad] = useState('০১৭৬৬-XXXXXX');
  const [paymentStep, setPaymentStep] = useState<1 | 2>(1);
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [pendingTrxId, setPendingTrxId] = useState<string | null>(null);
  const [supportNumber, setSupportNumber] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [copiedSupport, setCopiedSupport] = useState(false);
  const [copiedBkash, setCopiedBkash] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');

  const [stats, setStats] = useState({ students: 0, classes: 0, teachers: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [showPackageDetails, setShowPackageDetails] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newAddress, setNewAddress] = useState(initialMadrasah?.address || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [newContactEmail, setNewContactEmail] = useState(initialMadrasah?.contact_email || '');
  const [voiceSenderId, setVoiceSenderId] = useState(initialMadrasah?.voice_sender_id || '');
  const [newPin, setNewPin] = useState((initialMadrasah?.config_json as any)?.user_pin || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');

  const [featureStudentAttSms, setFeatureStudentAttSms] = useState((initialMadrasah?.config_json as any)?.features?.student_attendance_sms ?? false);
  const [featureFeeSms, setFeatureFeeSms] = useState((initialMadrasah?.config_json as any)?.features?.fee_collection_sms ?? false);
  const [featureTeacherDeduction, setFeatureTeacherDeduction] = useState((initialMadrasah?.config_json as any)?.features?.teacher_attendance_deduction ?? false);
  
  const [copiedId, setCopiedId] = useState(false);
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [rechargePhone, setRechargePhone] = useState('');
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAdminSettings = async () => {
      try {
        // Use cachedFetch for global admin settings to prevent redundant loads
        const { data } = await requestManager.cachedFetch(
          'system_settings',
          (q) => q.select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
          'global_admin_settings',
          CACHE_TTLS.LONG // 10 mins cache for fixed settings
        );

        if (data) {
          if (data.bkash_number) setAdminBkash(data.bkash_number);
          // @ts-ignore
          if (data.nagad_number) setAdminNagad(data.nagad_number);
          // @ts-ignore
          if (data.support_number) setSupportNumber(data.support_number);
          else setSupportNumber('01766326edcba');
        } else {
          setSupportNumber('01766326edcba');
        }
      } catch (err) {
        console.error('Error fetching admin settings:', err);
        setSupportNumber('01766326edcba');
      }
    };
    fetchAdminSettings();
  }, [dataVersion]);

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
      attendance: configObj.modules?.attendance ?? true,
      results: configObj.modules?.results ?? true,
      admit_card: configObj.modules?.admit_card ?? true,
      seat_plan: configObj.modules?.seat_plan ?? true,
      accounting: configObj.modules?.accounting ?? true,
      academic_year_promotion: configObj.modules?.academic_year_promotion ?? false,
      voice_broadcast: configObj.modules?.voice_broadcast ?? true,
      sms: configObj.modules?.sms ?? true,
      messages: configObj.modules?.messages ?? true,
      class_routine: configObj.modules?.class_routine ?? false,
      certificates: configObj.modules?.certificates ?? true,
      id_cards: configObj.modules?.id_cards ?? false,
      exam_routine: configObj.modules?.exam_routine ?? true,
    };
  }, [madrasah]);

  useEffect(() => {
    let interval: any;
    if (isWaitingPayment && pendingTrxId) {
      interval = setInterval(async () => {
        const { data, error } = await supabase
          .from('transactions')
          .select('status')
          .eq('id', pendingTrxId)
          .single();
        
        if (data?.status === 'approved') {
          setIsWaitingPayment(false);
          setPendingTrxId(null);
          setShowSuccessModal({ 
            show: true, 
            title: lang === 'bn' ? 'পেমেন্ট সফল' : 'Payment Successful', 
            message: lang === 'bn' ? 'আপনার পেমেন্ট সফলভাবে যাচাই করা হয়েছে এবং আপনার সাবস্ক্রিপশন আপডেট করা হয়েছে।' : 'Your payment has been successfully verified and your subscription has been updated.' 
          });
          if (madrasah?.id) requestManager.invalidatePattern(`institution:${madrasah.id}`);
          if (onProfileUpdate) onProfileUpdate();
          fetchPaymentHistory();
        } else if (data?.status === 'rejected') {
          setIsWaitingPayment(false);
          setPendingTrxId(null);
          alert(lang === 'bn' ? 'পেমেন্ট বাতিল করা হয়েছে।' : 'Your payment has been rejected.');
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isWaitingPayment, pendingTrxId]);

  const handleCopyNumber = (num: string) => {
    const cleanNum = num.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(cleanNum);
  };

  const handleOpenApp = (method: 'bkash' | 'nagad') => {
    if (method === 'bkash') {
      // Standard deep link for bKash
      window.location.href = 'bkash://';
      // Fallback for Android intent if standard fails
      setTimeout(() => {
        window.location.href = 'intent://#Intent;scheme=bkash;package=com.bKash.customerapp;end';
      }, 500);
    } else {
      window.location.href = 'intent://#Intent;scheme=nagad;package=com.konasl.nagad;end';
    }
  };

  const handleUpgradeRequest = async () => {
    if (!selectedPackage || !madrasah) return;
    setRequestingUpgrade(true);
    try {
      const selectedMonthsForPayment = selectedMonths.length > 0 ? [...selectedMonths] : [];
      if (selectedMonthsForPayment.length === 0) {
        const duration = subscriptionType === 'monthly' ? 1 : subscriptionType === 'quarterly' ? 3 : 12;
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed
        
        for (let i = 0; i < duration; i++) {
          const d = new Date(currentYear, currentMonth + i, 1);
          selectedMonthsForPayment.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
        }
      }
      
      const duration = selectedMonthsForPayment.length;
      const effectiveRate = madrasah.custom_subscription_fee || (stats.students > 0 && stats.students <= 200 ? selectedPackage.rate : stats.students * 1);
      const amount = effectiveRate * duration;

      const { data, error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: amount,
        transaction_id: `PENDING_${Date.now()}`,
        description: `Subscription Upgrade: ${selectedPackage.name} (${subscriptionType}) via ${paymentMethod.toUpperCase()}`,
        type: 'credit',
        status: 'pending',
        module: 'subscription',
        metadata: {
          months: selectedMonthsForPayment,
          package_name: selectedPackage.name,
          subscription_type: subscriptionType,
          discount: 0,
          base_amount: amount,
          payment_method: paymentMethod
        }
      }).select().single();

      if (error) throw error;

      setPendingTrxId(data.id);
      setIsWaitingPayment(true);
      setPaymentStep(1);
      fetchPaymentHistory();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRequestingUpgrade(false);
    }
  };

  const toggleTheme = async () => {
    if (!madrasah) return;
    const newTheme = madrasah.theme === 'dark' ? 'default' : 'dark';
    
    try {
      if (madrasah?.id) {
        requestManager.invalidatePattern(`institution:${madrasah.id}`);
        // Profile/Institution updates might affect dashboard context/branding
        requestManager.invalidatePattern('dashboard_');
      }
      const { error } = await supabase.from('institutions').update({ theme: newTheme }).eq('id', madrasah.id);
      if (error) throw error;
      setMadrasah({ ...madrasah, theme: newTheme });
      if (onProfileUpdate) onProfileUpdate();
    } catch (err: any) {
      console.error('Error toggling theme:', err);
    }
  };

  useEffect(() => {
    if (initialMadrasah) {
      setMadrasah(initialMadrasah);
      setNewName(initialMadrasah.name || '');
      setNewAddress(initialMadrasah.address || '');
      setNewPhone(initialMadrasah.phone || '');
      setNewContactEmail(initialMadrasah.contact_email || '');
      setVoiceSenderId(initialMadrasah.voice_sender_id || '');
      setNewPin((initialMadrasah.config_json as any)?.user_pin || '');
      setLogoUrl(initialMadrasah.logo_url || '');
      
      if (initialMadrasah) {
        fetchStats();
        fetchPackages();
        
        // Set subscription type based on config if available
        const config = initialMadrasah.config_json as any;
        if (config?.subscription_type) {
          setSubscriptionType(config.subscription_type);
        }
        fetchPaymentHistory();
      }
    }
  }, [initialMadrasah]);

  useEffect(() => {
    const isTeacherUser = profile?.role === 'teacher';
    if (isTeacherUser && profile?.id && madrasah?.id) {
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
  }, [profile?.role, profile?.id, madrasah?.id]);

  const teacherAttendanceStats = React.useMemo(() => {
    if (!madrasah || !profile?.id) return { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0, total: 0, logs: [] };
    
    const config = madrasah.config_json as any;
    const allAttendance = config?.teacher_attendance || {};
    
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
  }, [madrasah?.config_json, profile?.id]);

  const teacherMonthlySalaries = React.useMemo(() => {
    if (!teacherInfo) return [];
    
    const basicSalary = Number(teacherInfo.basic_salary) || 0;
    const salariesByMonth: Record<string, { month: string, paid: number, transactions: any[] }> = {};
    
    // 1. Group transaction logs from ledger by salaryMonth
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

    // 2. Generate a list of recent months to show, ensuring at least the last 6 months are represented
    const list: any[] = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      
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

  const fetchPaymentHistory = async () => {
    if (!initialMadrasah) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', initialMadrasah.id)
        .eq('module', 'subscription')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setPackages(data);
        // Robust current package search
        const currentPkgName = (madrasah?.config_json as any)?.package_name || (madrasah?.config_json as any)?.subscription?.package_name;
        const currentPkg = data.find(p => p.name === currentPkgName);
        if (currentPkg) {
          setSelectedPackage(currentPkg);
        } else {
          setSelectedPackage(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  const fetchStats = async () => {
    if (!initialMadrasah) return;
    setLoadingStats(true);
    try {
      const { data: profile } = await supabase.from('institutions').select('*').eq('id', initialMadrasah.id).maybeSingle();
      if (profile) setMadrasah(profile);
      const [stdRes, clsRes, teacherRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id)
      ]);
      setStats({ students: stdRes.count || 0, classes: clsRes.count || 0, teachers: teacherRes.count || 0 });
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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
      // Force session hydration to prevent "Auth session missing" errors
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        // Try to refresh if session is missing
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          throw new Error(lang === 'bn' ? 'আপনার লগইন সেশন শেষ হয়ে গেছে। দয়া করে আবার লগইন করুন।' : 'Auth session expired. Please log out and log in again.');
        }
      }

      // Special handling for teachers changing their PIN
      if (profile?.role === 'teacher') {
         const response = await fetch('/api/teachers/update-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: profile.id, pin: newPassword })
         });
         
         if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update PIN');
         }
      } else {
        // For Admin users, we update their Supabase auth password
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      
      setShowSuccessModal({ show: true, title: lang === 'bn' ? 'সফল' : 'Success', message: lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।' : 'Password changed successfully.' });
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message || 'Error changing password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const currentConfig = (madrasah.config_json as any) || {};
      const updatedConfig = { 
        ...currentConfig, 
        user_pin: newPin.trim(),
        features: {
          ...(currentConfig.features || {}),
          student_attendance_sms: featureStudentAttSms,
          fee_collection_sms: featureFeeSms,
          teacher_attendance_deduction: featureTeacherDeduction
        }
      };
      
      if (madrasah?.id) {
        requestManager.invalidatePattern(`institution:${madrasah.id}`);
        requestManager.invalidatePattern('dashboard_');
      }

      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        contact_email: newContactEmail.trim() || null,
        voice_sender_id: voiceSenderId.trim() || null,
        logo_url: logoUrl,
        config_json: updatedConfig
      }).eq('id', madrasah.id);
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      setMadrasah(prev => prev ? { ...prev, name: newName, address: newAddress, phone: newPhone, contact_email: newContactEmail, voice_sender_id: voiceSenderId, config_json: updatedConfig } : null);
      setShowSuccessModal({ show: true, title: t('success', lang), message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      // Compress and resize the image (e.g., max 400x400 for a crisp logo)
      const compressedBlob = await compressAndResizeImage(file, 400, 400);
      const fileName = `logo_${madrasah.id}_${Date.now()}.webp`;
      
      // Try to create bucket if it doesn't exist
      try {
        await supabase.storage.createBucket('madrasah-assets', { public: true });
      } catch (bucketError) {}

      // Try to delete old logo first if it exists, to optimize storage space
      const oldLogoUrl = logoUrl || madrasah.logo_url;
      if (oldLogoUrl) {
        try {
          const urlWithoutQuery = oldLogoUrl.split('?')[0];
          const marker = 'logos/';
          const markerIndex = urlWithoutQuery.indexOf(marker);
          if (markerIndex !== -1) {
            const storagePath = urlWithoutQuery.substring(markerIndex);
            
            // Delete from madrasah-assets
            await supabase.storage.from('madrasah-assets').remove([storagePath]).catch(() => {});
            
            // Delete from voice-templates
            await supabase.storage.from('voice-templates').remove([storagePath]).catch(() => {});
          }
        } catch (delErr) {
          console.error('Failed to clean up old logo:', delErr);
        }
      }

      let uploadError;
      let publicUrl;

      // Try madrasah-assets first
      const { error: err1 } = await supabase.storage.from('madrasah-assets').upload(`logos/${fileName}`, compressedBlob, {
        cacheControl: '3600',
        contentType: 'image/webp',
        upsert: false
      });

      if (err1) {
        // Fallback to voice-templates bucket which we know exists and is often pre-configured
        const { error: err2 } = await supabase.storage.from('voice-templates').upload(`logos/${fileName}`, compressedBlob, {
          cacheControl: '3600',
          contentType: 'image/webp',
          upsert: false
        });
        uploadError = err2;
        if (!err2) {
          const { data } = supabase.storage.from('voice-templates').getPublicUrl(`logos/${fileName}`);
          publicUrl = data.publicUrl;
        }
      } else {
        const { data } = supabase.storage.from('madrasah-assets').getPublicUrl(`logos/${fileName}`);
        publicUrl = data.publicUrl;
      }

      if (uploadError && uploadError.message !== 'Bucket not found') throw uploadError;
      
      // If both failed due to bucket issues, we might need to inform the user or use a different strategy
      if (!publicUrl) throw new Error('Could not upload logo. Please ensure storage buckets are configured.');

      if (madrasah?.id) {
        requestManager.invalidatePattern(`institution:${madrasah.id}`);
        requestManager.invalidatePattern('dashboard_');
      }

      const { error: updateErr } = await supabase.from('institutions').update({ logo_url: publicUrl }).eq('id', madrasah.id);
      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      setMadrasah(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      if (onProfileUpdate) onProfileUpdate();
      setShowSuccessModal({ 
        show: true, 
        title: lang === 'bn' ? 'সফল' : 'Success', 
        message: lang === 'bn' ? 'লোগো সফলভাবে আপলোড এবং অপ্টিমাইজ করা হয়েছে।' : 'Logo uploaded and optimized successfully.' 
      });
    } catch (e: any) { 
      console.error('Upload error:', e);
      alert('Logo upload failed: ' + e.message); 
    } finally { setSaving(false); }
  };

  if (!madrasah) return null;

  const displayName = madrasah?.name || 'User';
  const isTeacher = profile?.role === 'teacher';
  const role = profile?.role || 'teacher';
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'madrasah_admin' || isSuperAdmin;
  const canSendSMS = isAdmin || !!profile?.permissions?.can_send_sms;
  const canSendMessages = isAdmin || !!profile?.permissions?.can_send_messages;

  if (isEditingSubscription) {
    const currentRate = selectedPackage ? selectedPackage.rate : (Number((madrasah?.config_json as any)?.package_rate) || 0);
    const effectiveRate = madrasah.custom_subscription_fee || (stats.students > 0 && stats.students <= 200 ? currentRate : stats.students * 1);
    const durationMonths = selectedMonths.length > 0 ? selectedMonths.length : (subscriptionType === 'monthly' ? 1 : subscriptionType === 'quarterly' ? 3 : 12);
    const calculatedFee = effectiveRate * durationMonths;

    const paidMonths = (madrasah?.config_json as any)?.paid_months || [];
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthKey = `${currentYear}-${monthNum.toString().padStart(2, '0')}`;
      const name = new Date(currentYear, i).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long' });
      return { key: monthKey, name, isPaid: paidMonths.includes(monthKey) };
    });

    const toggleMonth = (key: string, isPaid: boolean) => {
      if (isPaid) return;
      setSelectedMonths(prev => 
        prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key].sort()
      );
    };

    const formatSubscriptionEnd = (dateStr: string | null | undefined) => {
      if (!dateStr) return lang === 'bn' ? 'অনির্দিষ্ট' : 'N/A';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        return dateStr;
      }
    };

    const handleCopyBkash = (num: string) => {
      navigator.clipboard.writeText(num);
      setCopiedBkash(true);
      setTimeout(() => setCopiedBkash(false), 2000);
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-36 relative z-10">
        {/* Top Header with Back Button */}
        <div className="flex items-center gap-3.5 px-1">
          <button 
            type="button"
            onClick={() => setIsEditingSubscription(false)} 
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all active:scale-95 cursor-pointer ${
              madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-[#1E3A8A]'
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className={`text-xl sm:text-2xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'সাবস্ক্রিপশন ম্যানেজমেন্ট' : 'Subscription'}
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold">
              {lang === 'bn' ? 'প্যাকেজ পরিবর্তন ও চার্জ পরিশোধ করুন' : 'Change package and pay subscription fees'}
            </p>
          </div>
        </div>

        {/* Dynamic Dual-Column Layout on Large Screen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-1">
          
          {/* Left Column: Current Package and Packages Selection (8 Cols onlg) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Current Package Card */}
            <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border relative overflow-hidden transition-all ${
              madrasah?.theme === 'dark' ? 'bg-[#1E293B] border-slate-700' : 'bg-[#EEF2FF] border-blue-100 shadow-sm'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center animate-pulse">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black text-blue-600/60 dark:text-blue-400/60 uppercase tracking-widest leading-none mb-1">
                        {lang === 'bn' ? 'বর্তমান প্যাকেজ' : 'Current Package'}
                      </p>
                      <h4 className={`text-base sm:text-lg font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                        {lang === 'bn' ? ((madrasah?.config_json as any)?.package_name || 'None') : getEnglishPkgName((madrasah?.config_json as any)?.package_name || 'None')}
                      </h4>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    madrasah?.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {madrasah?.status === 'active' ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'ট্রায়াল' : 'Trial')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-700/10 dark:border-slate-700/40">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}</p>
                    <p className={`text-lg sm:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{stats.students}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'বিলিং সাইকেল' : 'Billing Cycle'}</p>
                    <p className={`text-lg sm:text-xl font-black capitalize ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {lang === 'bn' 
                        ? (((madrasah?.config_json as any)?.subscription_type || 'monthly') === 'monthly' ? 'মাসিক' : ((madrasah?.config_json as any)?.subscription_type || 'monthly') === 'quarterly' ? 'ত্রৈমাসিক' : 'বার্ষিক')
                        : ((madrasah?.config_json as any)?.subscription_type || 'Monthly')}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'প্যাকেজ রেট' : 'Package Rate'}</p>
                    <p className={`text-lg sm:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {(madrasah?.config_json as any)?.package_rate || 0} ৳
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider">{lang === 'bn' ? 'মেয়াদ শেষ' : 'Expires At'}</p>
                    <p className={`text-[12px] sm:text-[13px] font-black leading-normal text-emerald-500`}>
                      {formatSubscriptionEnd(madrasah?.subscription_end)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Select Package Container */}
            <div className="space-y-3.5">
              <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
                {lang === 'bn' ? '১. প্যাকেজ নির্বাচন করুন' : '1. Select Subscription Package'}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {packages.map((pkg) => {
                  const isCurrent = pkg.name === (madrasah?.config_json as any)?.package_name;
                  const isSelected = selectedPackage?.id === pkg.id;
                  
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`p-4 rounded-[1.5rem] border cursor-pointer transition-all relative overflow-hidden flex flex-col items-center justify-center text-center active:scale-[0.98] ${
                        isSelected 
                          ? (madrasah?.theme === 'dark' ? 'bg-blue-950/30 border-blue-500 ring-2 ring-blue-500/20' : 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/10 shadow-sm')
                          : (madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-bubble')
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute top-0 right-0 bg-blue-500 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-bl-lg z-20">
                          {lang === 'bn' ? 'বর্তমান' : 'Current'}
                        </div>
                      )}
                      
                      <h4 className={`text-[11px] sm:text-[13px] font-black font-noto leading-tight ${isSelected ? 'text-blue-500' : (madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]')}`}>
                        {lang === 'bn' ? pkg.name : getEnglishPkgName(pkg.name)}
                      </h4>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPackageDetails(pkg);
                        }}
                        className="mt-2 text-[9px] font-bold text-slate-400 hover:text-blue-500 underline"
                      >
                        {lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Month-wise Payment Status */}
            <div className="space-y-3.5">
              <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 flex justify-between items-center">
                <span>{lang === 'bn' ? '২. মাসের পেমেন্ট স্ট্যাটাস' : '2. Monthly Payment Status'}</span>
                <span className="text-[9px] text-blue-500 font-black">{currentYear}</span>
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {months.map((m) => {
                  const isSelected = selectedMonths.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleMonth(m.key, m.isPaid)}
                      disabled={m.isPaid}
                      className={`p-3 rounded-2xl border text-center transition-all relative ${
                        m.isPaid 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-600 opacity-80 cursor-default'
                          : isSelected
                            ? 'bg-blue-500 border-blue-500 text-white shadow-md active:scale-95'
                            : (madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 active:scale-95')
                      }`}
                    >
                      <p className="text-[10px] sm:text-[11px] font-black font-noto truncate">{m.name}</p>
                      <div className={`mt-1 h-1 w-full rounded-full ${m.isPaid ? 'bg-emerald-500' : isSelected ? 'bg-white' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      {m.isPaid && <CheckCircle2 size={10} className="absolute top-1 right-1 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] font-bold text-slate-400 italic">
                {lang === 'bn' ? '* যে মাসের পেমেন্ট করতে চান সেই মাসগুলো সিলেক্ট করুন।' : '* Select the months you want to pay for.'}
              </p>
            </div>

            {/* Select Billing Cycle Container (Removed) */}

          </div>

          {/* Right Column: Payment Instructions and Form (5 Cols on lg) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* bKash/Nagad/Bank Instructions Card */}
            <div className={`p-5 rounded-[2.2rem] border relative overflow-hidden text-center flex flex-col items-center justify-center ${
              madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-[#F4F7FF] border-[#E2E8F0]'
            }`}>
              <div className="absolute -top-12 -left-12 w-28 h-28 bg-[#2563EB]/5 rounded-full"></div>
              
              <div className="z-10 w-full animate-in fade-in slide-in-from-bottom-6 duration-700">
                {selectedMonths.length > 0 ? (
                  <PaymentCheckout 
                    lang={lang}
                    madrasah={madrasah!}
                    module="subscription"
                    onSuccess={(trx) => {
                      setShowSuccessModal({ 
                        show: true, 
                        title: lang === 'bn' ? 'পেমেন্ট সফল' : 'Payment Successful', 
                        message: lang === 'bn' ? 'আপনার পেমেন্ট সফলভাবে যাচাই করা হয়েছে এবং আপনার সাবস্ক্রিপশন আপডেট করা হয়েছে।' : 'Your payment has been successfully verified and your subscription has been updated.' 
                      });
                      if (madrasah?.id) requestManager.invalidatePattern(`institution:${madrasah.id}`);
                      if (onProfileUpdate) onProfileUpdate();
                      fetchPaymentHistory();
                    }}
                    onCancel={() => setPaymentStep(1)}
                    metadata={{
                      months: selectedMonths,
                      package_name: selectedPackage?.name,
                      subscription_type: subscriptionType,
                      source: 'account_subscription_page',
                      expected_amount: calculatedFee
                    }}
                    fixedAmount={calculatedFee > 0 ? calculatedFee : undefined}
                  />
                ) : (
                  <div className="py-10 px-6 space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="text-blue-500 animate-pulse" size={32} />
                    </div>
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Months'}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                      {lang === 'bn' 
                        ? 'পেমেন্ট করার জন্য উপরে ২ নম্বর ধাপে অন্তত একটি মাস সিলেক্ট করুন।' 
                        : 'Please select at least one month from step 2 above to proceed with payment.'}
                    </p>
                    <div className="pt-4 flex justify-center">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500/20"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-500/40"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-500/60"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment History List */}
            <div className="space-y-3.5">
              <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
                {lang === 'bn' ? 'সাবস্ক্রিপশন পেমেন্ট হিস্ট্রি' : 'Subscription Payment History'}
              </label>

              <div className={`rounded-[2rem] border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800/20 border-slate-700/50' : 'bg-white border-slate-100 shadow-bubble'}`}>
                {loadingHistory ? (
                  <div className="p-10 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading History...'}</p>
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <History size={32} className="mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'কোনো পেমেন্ট হিস্ট্রি পাওয়া যায়নি' : 'No payment history found'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                    {paymentHistory.map((tr) => (
                      <div key={tr.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tr.status === 'approved' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : tr.status === 'pending' ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>
                            <CreditCard size={16} />
                          </div>
                          <div>
                            <h5 className={`text-[11px] sm:text-[13px] font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                              {tr.amount} ৳
                            </h5>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                              {new Date(tr.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })} • {tr.transaction_id}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            tr.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 
                            tr.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {tr.status === 'approved' ? (lang === 'bn' ? 'সফল' : 'Success') : 
                             tr.status === 'pending' ? (lang === 'bn' ? 'অপেক্ষা' : 'Pending') : 
                             (lang === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected')}
                          </span>
                          {tr.metadata?.months && (
                            <p className="text-[8px] font-bold text-slate-400 mt-1 truncate max-w-[80px]">
                              {tr.metadata.months.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Package Details Modal */}
        {showPackageDetails && createPortal(
          <div className="modal-overlay bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className={`w-full max-w-md rounded-[2.5rem] border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-6 relative">
                <button 
                  onClick={() => setShowPackageDetails(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all"
                >
                  <X size={20} />
                </button>
                
                <div className="flex flex-col items-center text-center mt-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-4">
                    <Package size={32} />
                  </div>
                  <h3 className={`text-xl sm:text-2xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {showPackageDetails.name}
                  </h3>
                  <div className="mt-2 px-4 py-1 bg-blue-500/10 rounded-full">
                    <p className="text-sm font-black text-blue-600">
                      {showPackageDetails.rate.toFixed(2)} ৳ {stats.students <= 200 ? `(${lang === 'bn' ? 'ফিক্সড' : 'Flat'})` : `/ ${lang === 'bn' ? 'ছাত্র' : 'Student'}`}
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">
                    {lang === 'bn' ? 'প্যাকেজের ফিচারসমূহ' : 'Package Features'}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {showPackageDetails.features?.map((f: string, i: number) => (
                      <div key={i} className={`p-3 rounded-xl border flex items-center gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className="text-xs sm:text-sm font-bold font-noto">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedPackage(showPackageDetails);
                    setShowPackageDetails(null);
                  }}
                  className="w-full h-14 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium mt-8 active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  {lang === 'bn' ? 'প্যাকেজটি সিলেক্ট করুন' : 'Select This Package'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-36 relative z-10">

      <div className="relative pt-12 px-1">
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] sm:rounded-[4rem] p-6 sm:p-10 pt-24 md:pt-32 shadow-bubble border relative text-center`}>
          <div className="absolute inset-0 overflow-hidden rounded-[3rem] sm:rounded-[4rem]">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-[0.03]" />
          </div>
          <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className={`w-32 h-32 sm:w-40 sm:h-40 p-3 sm:p-4 rounded-full shadow-bubble border-[8px] sm:border-[12px] flex items-center justify-center overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                {isTeacher && teacherInfo?.photo_url ? (
                  <img src={teacherInfo.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" />
                ) : logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-cover rounded-full" alt="Profile" />
                ) : (
                  <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><UserIcon size={50} className="sm:w-[70px] sm:h-[70px]" strokeWidth={1.5} /></div>
                )}
              </div>
              {madrasah && madrasah.id !== 'super_admin' && !isTeacher && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-9 h-9 sm:w-11 sm:h-11 bg-[#2563EB] text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-premium border-4 border-white active:scale-90 transition-all z-30"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} className="sm:w-5 sm:h-5" />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>
          <div className="space-y-4 mt-2">
             <div className="space-y-1">
               <div className="px-4">
                 <h2 className={`text-[20px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                   {isTeacher ? (teacherInfo?.teacher_name || profile?.full_name || 'Teacher') : (madrasah?.name || 'User')}
                 </h2>
               </div>
               
               <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-1.5 px-2">
                 {isTeacher ? (
                   <>
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
                   </>
                 ) : (
                   <>
                     {madrasah?.address && (
                       <div className="flex items-center gap-1.5 text-slate-400">
                         <MapPin size={11} className="shrink-0" />
                         <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{madrasah.address}</p>
                       </div>
                     )}
                     {madrasah?.phone && (
                       <div className="flex items-center gap-1.5 text-slate-400">
                         <Smartphone size={11} className="shrink-0" />
                         <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{madrasah.phone}</p>
                       </div>
                     )}
                     {madrasah?.email && (
                       <div className="flex items-center gap-1.5 text-slate-400">
                         <Mail size={11} className="shrink-0" />
                         <p className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{madrasah.email}</p>
                       </div>
                     )}
                   </>
                 )}
               </div>
             </div>
             
             {isTeacher && (
               <div className="pt-2 flex flex-wrap gap-3 items-center justify-center">
                 {teacherInfo?.join_date && (
                   <div className={`p-3 rounded-2xl border flex items-center gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-teal-400' : 'bg-white border-slate-100 text-teal-600'}`}>
                       <CalendarIcon size={16} />
                     </div>
                     <div className="text-left">
                       <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}</p>
                       <p className={`text-[11px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{teacherInfo.join_date}</p>
                     </div>
                   </div>
                 )}

                 {teacherInfo?.basic_salary && (
                   <div className={`p-3 rounded-2xl border flex items-center gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-100 text-amber-600'}`}>
                       <CreditCard size={16} />
                     </div>
                     <div className="text-left">
                       <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{lang === 'bn' ? 'मूल वेतन' : 'Basic Salary'}</p>
                       <p className={`text-[11px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{teacherInfo.basic_salary} ৳</p>
                     </div>
                   </div>
                 )}

                 <div className={`p-3 rounded-2xl border flex items-center gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shadow-sm border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-100 text-blue-600'}`}>
                     <GraduationCap size={16} />
                   </div>
                   <div className="text-left">
                     <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{lang === 'bn' ? 'মাদরাসা / প্রতিষ্ঠান' : 'Institution'}</p>
                     <p className={`text-[11px] font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{madrasah?.name}</p>
                   </div>
                 </div>
               </div>
             )}

             {madrasah && madrasah.id !== 'super_admin' && !isTeacher && (
               <div className="pt-2">
                  {(madrasah.config_json as any)?.institute_code && (
                    <div className={`p-4 rounded-[2rem] border flex items-center justify-center gap-4 inline-flex ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-100 text-amber-600'}`}>
                        <Box size={20} />
                       </div>
                       <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{lang === 'bn' ? 'ইনস্টিটিউট কোড' : 'Institute Code'}</p>
                          <p className={`text-[12px] font-black ${madrasah?.theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>{(madrasah.config_json as any).institute_code}</p>
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>
      </div>



      {/* Main Options Grid */}
      {isTeacher ? (
         <div className="space-y-6 mx-1 text-left">
            {/* Loading Indicator */}
            {loadingTeacher ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
                <p className="text-xs text-slate-400 font-bold">{lang === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Loading teacher details...'}</p>
              </div>
            ) : (
              <>
                {/* DUAL CARD LAYOUT: Attendance Stats & Basic Salary Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Attendance Summary */}
                  <div className={`p-6 rounded-[2.5rem] border ${madrasah?.theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center shrink-0">
                        <Activity size={20} />
                      </div>
                      <div className="text-left">
                        <h4 className={`text-base font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {lang === 'bn' ? 'চলতি শিক্ষাবর্ষের হাজিরা' : 'Attendance Summary'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {lang === 'bn' ? 'আজ পর্যন্ত আপনার হাজিরা স্ট্যাটাস' : 'Your attendance summary up to today'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center mb-5">
                      <div className={`p-2.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{lang === 'bn' ? 'উপস্থিতি' : 'Present'}</p>
                        <p className="text-base font-black text-emerald-500">{teacherAttendanceStats.present}</p>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</p>
                        <p className="text-base font-black text-rose-500">{teacherAttendanceStats.absent}</p>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{lang === 'bn' ? 'বিলম্ব' : 'Late'}</p>
                        <p className="text-base font-black text-amber-500">{teacherAttendanceStats.late}</p>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{lang === 'bn' ? 'অর্ধ-ছুটি' : 'Half Day'}</p>
                        <p className="text-base font-black text-indigo-500">{teacherAttendanceStats.half_day}</p>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{lang === 'bn' ? 'সরকারি ছুটি' : 'Holiday'}</p>
                        <p className="text-base font-black text-slate-400">{teacherAttendanceStats.holiday}</p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="space-y-1 text-left">
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase">
                        <span>{lang === 'bn' ? 'উপস্থিতির হার' : 'Attendance Rate'}</span>
                        <span className="text-emerald-500 font-mono">
                          {teacherAttendanceStats.total > 0 
                            ? `${Math.round(((teacherAttendanceStats.present + teacherAttendanceStats.late) / teacherAttendanceStats.total) * 100)}%`
                            : '০%'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all" 
                          style={{ 
                            width: teacherAttendanceStats.total > 0 
                              ? `${Math.round(((teacherAttendanceStats.present + teacherAttendanceStats.late) / teacherAttendanceStats.total) * 100)}%`
                              : '0%' 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Salary Summary Overview */}
                  <div className={`p-6 rounded-[2.5rem] border ${madrasah?.theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                        <CreditCard size={20} />
                      </div>
                      <div className="text-left">
                        <h4 className={`text-base font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {lang === 'bn' ? 'বেতন রেকর্ড সারসংক্ষেপ' : 'Salary Overview'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {lang === 'bn' ? 'আপনার বেতন প্রাপ্তির সংক্ষিপ্ত পরিসংখ্যান' : 'A quick glance at your salary payment records'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                      <div className={`p-4 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lang === 'bn' ? 'মোট প্রাপ্ত বেতন (চলতি ৬ মাস)' : 'Total Paid (Last 6 Months)'}</p>
                        <p className="text-xl font-black text-emerald-500">
                          {teacherMonthlySalaries.reduce((sum, item) => sum + item.paid, 0)} ৳
                        </p>
                      </div>
                      <div className={`p-4 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lang === 'bn' ? 'বকেয়া বেতন (চলতি ৬ মাস)' : 'Total Due (Last 6 Months)'}</p>
                        <p className="text-xl font-black text-rose-500">
                          {teacherMonthlySalaries.reduce((sum, item) => sum + item.due, 0)} ৳
                        </p>
                      </div>
                    </div>

                    <div className="text-left p-3 rounded-2xl border text-[11px] font-extrabold text-slate-400 bg-slate-50/30 dark:bg-slate-900/20 leading-relaxed">
                      {lang === 'bn' 
                        ? 'আপনার যদি বেতন বা বকেয়া নিয়ে কোনো অমিল পাওয়া যায়, তাহলে মাদরাসা একাউন্ট্যান্ট বা প্রধান এডমিনের সাথে যোগাযোগ করুন।'
                        : 'If there is any discrepancy in your salary payments or dues, please contact the institution accountant or chief administrator.'}
                    </div>
                  </div>

                </div>

                {/* DETAILED MONTHLY SALARY LOG */}
                <div className={`p-6 rounded-[2.5rem] border ${madrasah?.theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 text-[#2563EB] dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
                        <History size={20} />
                      </div>
                      <div className="text-left">
                        <h4 className={`text-base font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {lang === 'bn' ? 'মাসিক বেতন ও পেমেন্ট হিস্ট্রি' : 'Monthly Salary & Payment History'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {lang === 'bn' ? 'মাসভিত্তিক বেতন পরিশোধ, আংশিক গ্রহণ ও বকেয়া স্ট্যাটাস' : 'Monthly basic salary, paid, due and transactions'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'মাস' : 'Month'}</th>
                          <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">{lang === 'bn' ? 'মূল বেতন' : 'Basic Salary'}</th>
                          <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">{lang === 'bn' ? 'প্রাপ্তি' : 'Received (Paid)'}</th>
                          <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">{lang === 'bn' ? 'বকেয়া' : 'Due'}</th>
                          <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teacherMonthlySalaries.map((sal) => (
                          <React.Fragment key={sal.month}>
                            <tr className="border-b border-slate-100/50 dark:border-slate-800/30 hover:bg-slate-50/10 transition-all">
                              <td className="py-4 text-xs font-black text-slate-800 dark:text-slate-200">
                                <div className="flex flex-col text-left">
                                  <span>{formatSalaryMonth(sal.month)}</span>
                                  <span className="text-[9px] text-slate-400 font-bold mt-0.5">{sal.month}</span>
                                </div>
                              </td>
                              <td className="py-4 text-xs font-black text-slate-800 dark:text-slate-200 text-right font-mono">{sal.basicSalary} ৳</td>
                              <td className="py-4 text-xs font-black text-emerald-500 text-right font-mono">{sal.paid} ৳</td>
                              <td className={`py-4 text-xs font-black text-right font-mono ${sal.due > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                {sal.due} ৳
                              </td>
                              <td className="py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-block ${
                                  sal.status === 'paid' 
                                    ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' 
                                    : sal.status === 'partial' 
                                      ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' 
                                      : 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20'
                                }`}>
                                  {sal.status === 'paid' 
                                    ? (lang === 'bn' ? 'পরিশোধিত' : 'Paid') 
                                    : sal.status === 'partial' 
                                      ? (lang === 'bn' ? 'আংশিক পরিশোধ' : 'Partial') 
                                      : (lang === 'bn' ? 'অপরিশোধিত' : 'Unpaid')}
                                </span>
                              </td>
                            </tr>
                            
                            {/* Sub-Rows for individual transaction details if paid > 0 */}
                            {sal.transactions.length > 0 && (
                              <tr key={`${sal.month}-transactions`}>
                                <td colSpan={5} className="p-0 bg-slate-50/30 dark:bg-slate-900/10">
                                  <div className="px-6 py-3 space-y-2 border-l-2 border-blue-500 text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                      {lang === 'bn' ? 'পেমেন্ট ট্রানজেকশন ট্রেইল' : 'Payment Transaction Trails'}
                                    </p>
                                    {sal.transactions.map((t: any) => (
                                      <div key={t.id} className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400 py-1.5 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-0">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">{t.description}</span>
                                          <span className="text-[10px] text-slate-400 font-mono font-medium">{t.transaction_date}</span>
                                        </div>
                                        <span className="text-xs font-black text-emerald-500 font-mono shrink-0 ml-4">+{t.amount} ৳</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DETAILED ATTENDANCE LOG */}
                <div className={`p-6 rounded-[2.5rem] border ${madrasah?.theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center shrink-0">
                        <CalendarIcon size={20} />
                      </div>
                      <div className="text-left">
                        <h4 className={`text-base font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {lang === 'bn' ? 'বিস্তারিত হাজিরা খাতা' : 'Detailed Attendance Logs'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {lang === 'bn' ? 'তারিখ ভিত্তিক হাজিরা তালিকা' : 'Detailed log of your attendance dates'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {teacherAttendanceStats.logs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-bold text-xs">
                      {lang === 'bn' ? 'কোনো হাজিরার রেকর্ড পাওয়া যায়নি' : 'No attendance logs found.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                      {teacherAttendanceStats.logs.slice(0, 18).map((log) => {
                        const dayName = new Date(log.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long' });
                        const dateFormatted = new Date(log.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                        
                        return (
                          <div 
                            key={log.date}
                            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                              madrasah?.theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/40 border-slate-100'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200">{dateFormatted}</span>
                              <span className="text-[10px] text-slate-400 font-bold mt-0.5">{dayName}</span>
                            </div>
                            
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              log.status === 'present' 
                                ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' 
                                : log.status === 'absent' 
                                  ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20' 
                                  : log.status === 'late' 
                                    ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' 
                                    : log.status === 'half_day'
                                      ? 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20'
                                      : 'bg-slate-500/10 text-slate-400 dark:bg-slate-500/20'
                            }`}>
                              {log.status === 'present' 
                                ? (lang === 'bn' ? 'উপস্থিত' : 'Present') 
                                : log.status === 'absent' 
                                  ? (lang === 'bn' ? 'অনুপস্থিত' : 'Absent') 
                                  : log.status === 'late' 
                                    ? (lang === 'bn' ? 'বিলম্ব' : 'Late') 
                                    : log.status === 'half_day'
                                      ? (lang === 'bn' ? 'অর্ধ-ছুটি' : 'Half Day')
                                      : (lang === 'bn' ? 'ছুটি' : 'Holiday')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* OPTIONS ROW (Academic Calendar & Change Password are safe to expose to teachers) */}
                <div className="grid grid-cols-2 gap-3">
                  <ActionCard
                    icon={CalendarIcon}
                    title={lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
                    subtitle={lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
                    colorClass="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                    onClick={() => setView('academic-calendar')}
                    dark={madrasah?.theme === 'dark'}
                  />

                  <ActionCard
                    icon={Sparkles}
                    title={lang === 'bn' ? 'একাডেমিক ডকুমেন্টস' : 'Academic Documents'}
                    subtitle={lang === 'bn' ? 'ফরম, সনদ, রুটিন ও আইডি' : 'Forms, Certs, Routine & ID'}
                    colorClass="bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400"
                    onClick={() => setView('academic-documents')}
                    dark={madrasah?.theme === 'dark'}
                  />

                  <ActionCard
                    icon={Key}
                    title={lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
                    subtitle={lang === 'bn' ? 'নিরাপত্তা' : 'Security'}
                    colorClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                    onClick={() => setIsChangingPassword(true)}
                    dark={madrasah?.theme === 'dark'}
                  />

                  {/* Log Out Option for convenience */}
                  <ActionCard
                    icon={LogOut}
                    title={lang === 'bn' ? 'লগ আউট' : 'Log Out'}
                    subtitle={lang === 'bn' ? 'সেশন শেষ' : 'Sign Out'}
                    colorClass="bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400"
                    onClick={onLogout}
                    dark={madrasah?.theme === 'dark'}
                  />
                </div>
              </>
            )}
         </div>
      ) : (
      <div className="grid grid-cols-2 gap-3 mx-1">
        {/* Academic Calendar Card */}
        <ActionCard
          icon={CalendarIcon}
          title={lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
          subtitle={lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
          colorClass="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          onClick={() => setView('academic-calendar')}
          dark={madrasah?.theme === 'dark'}
        />

        {/* Academic Documents Card */}
        <ActionCard
          icon={Sparkles}
          title={lang === 'bn' ? 'একাডেমিক ডকুমেন্টস' : 'Academic Documents'}
          subtitle={lang === 'bn' ? 'ভর্তি ফরম, সনদ, রুটিন ও আইডি' : 'Forms, Certs, Routine & ID'}
          colorClass="bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400"
          onClick={() => setView('academic-documents')}
          dark={madrasah?.theme === 'dark'}
        />

        {!isTeacher && (
          <>
            <ActionCard
              icon={Edit3}
              title={t('profile_settings', lang)}
              subtitle={t('branding', lang)}
              colorClass="bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400"
              onClick={() => setView('profile-settings')}
              dark={madrasah?.theme === 'dark'}
            />
            
            <ActionCard
              icon={GraduationCap}
              title={lang === 'bn' ? 'শিক্ষাবর্ষ' : 'Academic Year'}
              subtitle={lang === 'bn' ? 'সেটআপ ও প্রমোশন' : 'Setup & Promotion'}
              colorClass="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
              onClick={() => setView('academic-year')}
              dark={madrasah?.theme === 'dark'}
            />

            {/* Donations Card */}
            {((madrasah?.config_json as any)?.modules?.donations === true || isSuperAdmin) && (
              <ActionCard
                icon={Heart}
                title={lang === 'bn' ? 'দান ও অনুদান' : 'Donations'}
                subtitle={lang === 'bn' ? 'তহবিল ও রসিদ' : 'Funds & Receipts'}
                colorClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                onClick={() => setView('donations')}
                dark={madrasah?.theme === 'dark'}
              />
            )}

            {/* Subscription Card */}
            <ActionCard
              icon={CreditCard}
              title={lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
              subtitle={lang === 'bn' ? 'প্যাকেজ ও পেমেন্ট' : 'Plans & Billing'}
              colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              onClick={() => setIsEditingSubscription(true)}
              dark={madrasah?.theme === 'dark'}
            />

            <ActionCard
              icon={Database}
              title={t('backup_restore', lang)}
              subtitle="Excel Tools"
              colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              onClick={() => setView('data-management')}
              dark={madrasah?.theme === 'dark'}
            />


            {/* Teacher Management Card */}
            <ActionCard
              icon={UserCheck}
              title={lang === 'bn' ? 'শিক্ষক ব্যবস্থাপনা' : 'Teacher Management'}
              subtitle={lang === 'bn' ? 'শিক্ষক ও স্টাফ' : 'Teachers & Staff'}
              colorClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              onClick={() => setView('teachers')}
              dark={madrasah?.theme === 'dark'}
            />
          </>
        )}

        {/* Live Chat Card */}
        <ActionCard
          icon={MessageSquareText}
          title={lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
          subtitle={lang === 'bn' ? 'গ্রুপ ও ডিরেক্ট মেসেজ' : 'Group & Direct Chat'}
          colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          onClick={() => setView('chat')}
          dark={madrasah?.theme === 'dark'}
        />

        {/* Message Card */}
        {(isAdmin || canSendMessages) && modules.messages && (
          <ActionCard
            icon={MessageCircle}
            title={lang === 'bn' ? 'বার্তা পাঠান' : 'Send Message'}
            subtitle={lang === 'bn' ? 'বার্তা' : 'Messages'}
            colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            onClick={() => setView('messages')}
            dark={madrasah?.theme === 'dark'}
          />
        )}

        {/* Video Tutorial Card */}
        <ActionCard
          icon={Play}
          title={lang === 'bn' ? 'টিউটোরিয়াল' : 'Video Tutorials'}
          subtitle={lang === 'bn' ? 'সহায়তা' : 'Help & Support'}
          colorClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
          onClick={() => setView('tutorials')}
          dark={madrasah?.theme === 'dark'}
        />

        {/* Change Password Card */}
        <ActionCard
          icon={Key}
          title={lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
          subtitle={lang === 'bn' ? 'নিরাপত্তা' : 'Security'}
          colorClass="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
          onClick={() => setIsChangingPassword(true)}
          dark={madrasah?.theme === 'dark'}
        />


        {/* Language Card */}
        {!isTeacher && (
          <div className={`col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble flex items-center justify-between gap-2.5 sm:gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 rounded-[0.85rem] sm:rounded-[1rem] flex items-center justify-center shrink-0">
                <Languages className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
              </div>
              <div className="text-left min-w-0 pr-1 sm:pr-2 hidden sm:block">
                <h5 className={`text-[11px] sm:text-[13px] font-black font-noto leading-[1.3] break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{t('language', lang)}</h5>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 break-words whitespace-normal">{t('change_lang', lang)}</p>
              </div>
            </div>
            <div className={`flex p-1 rounded-xl border shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <button 
                onClick={() => setLang('bn')} 
                className={`px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
              >
                বাংলা
              </button>
              <button 
                onClick={() => setLang('en')} 
                className={`px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
              >
                ENG
              </button>
            </div>
          </div>
        )}

        {/* Theme Switcher Card */}
        {!isTeacher && (
          <div className={`col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble flex items-center justify-between gap-3 sm:gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[0.85rem] sm:rounded-[1rem] flex items-center justify-center shrink-0 ${madrasah?.theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-400'}`}>
                {madrasah?.theme === 'dark' ? <Moon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} /> : <Sun className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />}
              </div>
              <div className="text-left min-w-0 pr-1 sm:pr-2">
                <h5 className={`text-[11px] sm:text-[13px] font-black font-noto leading-[1.3] break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                  {lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}
                </h5>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 break-words whitespace-normal">
                  {lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}
                </p>
              </div>
            </div>
            <button 
              onClick={toggleTheme}
              className={`w-11 h-6 sm:w-14 sm:h-8 shrink-0 rounded-full p-1 transition-colors relative ${madrasah?.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-white shadow-sm transition-transform ${madrasah?.theme === 'dark' ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        )}

        <button 
          onClick={onLogout} 
          className={`col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-bubble flex items-center justify-between gap-3 sm:gap-4 group active:scale-[0.98] transition-all min-w-0 ${madrasah?.theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[0.85rem] sm:rounded-[1rem] flex items-center justify-center shrink-0 ${madrasah?.theme === 'dark' ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-600'}`}>
              <LogOut className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
            </div>
            <div className="text-left min-w-0 pr-1 sm:pr-2">
              <h5 className={`text-[11px] sm:text-[13px] font-black font-noto leading-[1.3] break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{t('logout', lang)}</h5>
              <p className="text-[9px] sm:text-[10px] font-bold text-red-300 mt-0.5 break-words whitespace-normal">{t('logout_system', lang)}</p>
            </div>
          </div>
          <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${madrasah?.theme === 'dark' ? 'text-red-900/50' : 'text-red-200'}`} />
        </button>
      </div>
      )}

      {/* Edit Profile Modal - PORTALED */}


      {/* Subscription Modal */}
      {false && isEditingSubscription && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-lg rounded-[2.5rem] sm:rounded-[3.5rem] p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-500 relative max-h-[92vh] overflow-y-auto custom-scrollbar ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <CreditCard size={20} />
                  </div>
                  <h3 className={`text-lg sm:text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'সাবস্ক্রিপশন ম্যানেজমেন্ট' : 'Subscription Management'}
                  </h3>
                </div>
                <button onClick={() => setIsEditingSubscription(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5 sm:space-y-6">
                {/* Current Package Details */}
                <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border relative overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-blue-900/10 border-blue-500/30' : 'bg-blue-50/50 border-blue-200'}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-5 sm:mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <p className="text-[9px] sm:text-[10px] font-black text-blue-600/60 uppercase tracking-widest">Current Package</p>
                          <h4 className={`text-lg sm:text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                            {lang === 'bn' ? ((madrasah?.config_json as any)?.package_name || 'None') : getEnglishPkgName((madrasah?.config_json as any)?.package_name || 'None')}
                          </h4>
                        </div>
                      </div>
                      <span className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${madrasah?.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {madrasah?.status || 'Trial'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6">
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Students</p>
                        <p className={`text-xl sm:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{stats.students}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing Cycle</p>
                        <p className={`text-xl sm:text-2xl font-black capitalize ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {(madrasah?.config_json as any)?.subscription_type || 'Monthly'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Package Rate</p>
                        <p className={`text-xl sm:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                          {(madrasah?.config_json as any)?.package_rate || 0} ৳
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] sm:text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Cost</p>
                        <p className={`text-xl sm:text-2xl font-black text-blue-600`}>
                          {((stats.students > 0 && stats.students <= 200 ? (Number((madrasah?.config_json as any)?.package_rate) || 0) : stats.students * 1) * (subscriptionType === 'monthly' ? 1 : subscriptionType === 'quarterly' ? 3 : 12)).toLocaleString()} ৳
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Packages */}
                <div className="space-y-3 sm:space-y-4">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {lang === 'bn' ? 'সকল সাবস্ক্রিপশন প্যাকেজ' : 'All Subscription Packages'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {packages.map((pkg) => {
                      const isCurrent = pkg.name === (madrasah?.config_json as any)?.package_name;
                      return (
                        <div
                          key={pkg.id}
                          className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border transition-all relative overflow-hidden flex flex-col ${
                            isCurrent 
                              ? (madrasah?.theme === 'dark' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-blue-50 border-blue-200')
                              : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100')
                          }`}
                        >
                          {isCurrent && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                              Current
                            </div>
                          )}
                          <div className="mb-3">
                            <h4 className={`text-xs sm:text-sm font-black font-noto ${isCurrent ? 'text-blue-600' : (madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]')}`}>{lang === 'bn' ? pkg.name : getEnglishPkgName(pkg.name)}</h4>
                            <p className={`text-[9px] sm:text-[10px] font-bold mt-1 ${isCurrent ? 'text-blue-500/80' : 'text-slate-400'}`}>{pkg.rate.toFixed(2)} ৳ {stats.students <= 200 ? '(Flat)' : '/ Student'}</p>
                          </div>
                          <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-100/10">
                            {pkg.features?.map((f: string, i: number) => (
                              <div key={i} className={`flex items-center gap-2 text-[9px] sm:text-[10px] font-bold ${isCurrent ? 'text-blue-600/70' : 'text-slate-500'}`}>
                                <CheckCircle2 size={10} className={isCurrent ? 'text-blue-500' : 'text-emerald-500'} />
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-dashed ${madrasah?.theme === 'dark' ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/30'} text-center`}>
                  <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 leading-relaxed">
                    {lang === 'bn' ? 'সাবস্ক্রিপশন পরিবর্তন বা আপগ্রেড করতে অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' : 'To change or upgrade your subscription, please contact the administrator.'}
                  </p>
                </div>
              </div>
           </div>
        </div>,
        document.body
      )}
      {isEditingProfile && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><Edit3 size={20} /></div><h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>অ্যাকাউন্ট আপডেট</h3></div>
                <button onClick={() => setIsEditingProfile(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_name', lang)}</label><input type="text" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newName || ''} onChange={(e) => setNewName(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'ঠিকানা' : 'Address'}</label><input type="text" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newAddress || ''} onChange={(e) => setNewAddress(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_phone', lang)}</label><input type="tel" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newPhone || ''} onChange={(e) => setNewPhone(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'অফিসিয়াল ইমেইল (PDF-এর জন্য)' : 'Official Email (For PDFs)'}</label><input type="email" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={newContactEmail || ''} onChange={(e) => setNewContactEmail(e.target.value)} placeholder={lang === 'bn' ? 'যেমন: info@madrasah.com' : 'e.g. info@madrasah.com'} /></div>
                 


                 <div className="space-y-1 opacity-70 cursor-not-allowed">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                      Gmail / Email
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                    </label>
                    <input type="email" readOnly disabled className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} value={madrasah?.email || (lang === 'bn' ? 'অ্যাসাইন করা হয়নি' : 'Not assigned')} />
                 </div>
                 <div className="space-y-1 opacity-70 cursor-not-allowed">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                      {lang === 'bn' ? 'অ্যাকাউন্ট পিন' : 'Account PIN'}
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                    </label>
                    <input 
                      type="text" 
                      readOnly 
                      disabled
                      className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} 
                      value={newPin || ''} 
                    />
                 </div>

                 {/* Feature Toggles */}
                 <div className={`mt-4 p-4 rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'} space-y-3`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {lang === 'bn' ? 'অতিরিক্ত ফিচার সমূহ' : 'Extra Features'}
                    </h4>
                    
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="mt-0.5 relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={featureStudentAttSms}
                          onChange={(e) => setFeatureStudentAttSms(e.target.checked)}
                        />
                        <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center transition-all">
                          {featureStudentAttSms && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                          {lang === 'bn' ? 'হাজিরা SMS' : 'Attendance SMS'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {lang === 'bn' ? 'শিক্ষার্থীদের হাজিরা নেওয়ার সাথে সাথে অভিভাবকদের নাম্বারে SMS যাবে' : 'Send SMS to parents on student attendance'}
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="mt-0.5 relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={featureFeeSms}
                          onChange={(e) => setFeatureFeeSms(e.target.checked)}
                        />
                        <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center transition-all">
                          {featureFeeSms && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                          {lang === 'bn' ? 'বেতন আদায় SMS' : 'Fee Collection SMS'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {lang === 'bn' ? 'শিক্ষার্থীদের বেতন নেওয়ার সাথে সাথে নাম্বারে SMS যাবে' : 'Send SMS on fee collection'}
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="mt-0.5 relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={featureTeacherDeduction}
                          onChange={(e) => setFeatureTeacherDeduction(e.target.checked)}
                        />
                        <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center transition-all">
                          {featureTeacherDeduction && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                          {lang === 'bn' ? 'অনুপস্থিতিতে বেতন কর্তন' : 'Deduct Salary on Absence'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {lang === 'bn' ? 'শিক্ষকদের হাজিরার উপর ভিত্তি করে বেতন কর্তন হবে' : 'Deduct teacher salary based on attendance'}
                        </p>
                      </div>
                    </label>
                 </div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsEditingProfile(false)} className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>বাতিল</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-4 bg-[#2563EB] text-white font-black rounded-2xl text-[10px] uppercase shadow-premium flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : 'সংরক্ষণ করুন'}</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {isChangingPassword && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
                  </h3>
                </div>
                <button onClick={() => setIsChangingPassword(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={newPassword} 
                     onChange={(e) => setNewPassword(e.target.value)} 
                     placeholder="••••••••"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                     value={confirmPassword} 
                     onChange={(e) => setConfirmPassword(e.target.value)} 
                     placeholder="••••••••"
                   />
                 </div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsChangingPassword(false)} className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                 <button onClick={handleChangePassword} disabled={changingPassword} className="flex-[2] py-4 bg-[#2563EB] text-white font-black rounded-2xl text-[10px] uppercase shadow-premium flex items-center justify-center gap-2">
                   {changingPassword ? <Loader2 className="animate-spin" size={16} /> : (lang === 'bn' ? 'পরিবর্তন করুন' : 'Change')}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showSuccessModal.show && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 animate-in zoom-in-95 duration-500 p-10 text-center relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-emerald-500/10' : 'bg-white border-white shadow-emerald-200/50'}`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            
            <div className="relative">
              <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-[2rem] animate-ping duration-1000"></div>
                <CheckCircle2 size={48} strokeWidth={3} className="relative z-10" />
              </div>
              
              <h2 className={`text-3xl font-black mb-3 tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {showSuccessModal.title}
              </h2>
              
              <p className={`text-sm font-bold leading-relaxed px-4 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
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

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>

      {/* Floating Support Icon */}
      {supportNumber && (
        <div className="fixed bottom-24 right-5 md:right-8 z-50 animate-in slide-in-from-bottom-10 fade-in duration-700">
           <div className={`absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none ${madrasah?.theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'}`} style={{ animation: 'pulse-ring 2s infinite' }}></div>
           <button 
             onClick={() => setShowSupportModal(true)}
             className={`w-14 h-14 md:w-16 md:h-16 rounded-[2rem] shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-center transition-all active:scale-90 animate-bounce-subtle border-4 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-blue-400' : 'bg-white border-blue-50 text-blue-600'}`}
           >
              <Headset size={28} className="md:w-8 md:h-8" />
           </button>
        </div>
      )}

      {/* Support Info Modal */}
      {showSupportModal && createPortal(
         <div className="modal-overlay bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 z-[100]">
            <div className={`w-[90%] max-w-[340px] rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500 border overflow-hidden relative p-8 md:p-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
               <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto transition-transform hover:rotate-12 duration-500 ${madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                       <Headset size={48} strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 border-4 border-white dark:border-slate-900 rounded-full flex items-center justify-center animate-pulse">
                       <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                     <h3 className={`text-2xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                        {lang === 'bn' ? 'সাপোর্ট ডেস্ক' : 'Support Desk'}
                     </h3>
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Always here to help</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div 
                      className={`w-full py-5 rounded-3xl border font-mono font-black text-[22px] tracking-widest transition-all relative overflow-hidden flex items-center justify-center gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#2563EB]'}`} 
                    >
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
                         className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 border ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600'}`}
                       >
                         <MessageCircle size={22} strokeWidth={2.5} />
                         <span className="text-xs font-black uppercase tracking-[0.15em]">Chat on WhatsApp</span>
                       </a>
                    </div>
                  </div>

                  <div className="pt-4">
                     <button 
                       onClick={() => setShowSupportModal(false)}
                       className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                     >
                       {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                     </button>
                  </div>
               </div>
            </div>
         </div>,

         document.body
      )}
    </div>
  );
};

export default Account;
