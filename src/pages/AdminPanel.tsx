
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
// Fix: Import icons from lucide-react instead of ../supabase
import { Loader2, Search, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, ArrowRight, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History as HistoryIcon, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Trash2, Edit2, Sliders, ToggleLeft, ToggleRight, GraduationCap, Banknote, PhoneCall, Mic, Plus, Play, Building2, Camera } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, Transaction, AdminSMSStock } from 'types';

interface InstitutionWithStats extends Institution {
  student_count?: number;
  class_count?: number;
}

interface AdminPanelProps {
  lang: Language;
  currentView?: 'list' | 'dashboard' | 'approvals';
  dataVersion?: number;
  onProfileUpdate?: () => void;
  madrasah?: Institution | null;
  profile?: any;
  setStatusModal: (modal: {show: boolean, type: 'success' | 'error', title: string, message: string}) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ lang, currentView = 'list', dataVersion = 0, onProfileUpdate, madrasah, profile, setStatusModal }) => {
  const [madrasahs, setMadrasahs] = useState<InstitutionWithStats[]>([]);
  const [pendingTrans, setPendingTrans] = useState<Transaction[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'madrasah' | 'school' | 'kindergarten' | 'nurani'>('all');
  const [view, setView] = useState<'list' | 'approvals' | 'details' | 'dashboard'>(
    currentView === 'approvals' ? 'approvals' : currentView === 'dashboard' ? 'dashboard' : 'list'
  );
  const [paymentTab, setPaymentTab] = useState<'sms' | 'voice'>('sms');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);






  const [isFetchingAwajVoices, setIsFetchingAwajVoices] = useState(false);
  const [awajVoices, setAwajVoices] = useState<any[]>([]);

  const handleFetchAwajVoices = async () => {
    setIsFetchingAwajVoices(true);
    try {
      const awajResponse = await fetch('/api/awaj/voices');
      if (awajResponse.ok) {
        const awajData = await awajResponse.json();
        // Assuming the API returns an array of voices or an object with a voices array
        const voicesList = Array.isArray(awajData) ? awajData : (awajData.voices || awajData.data || []);
        setAwajVoices(voicesList);
        if (voicesList.length === 0) {
          setStatusModal({
            show: true,
            type: 'error',
            title: 'No Voices Found',
            message: 'No approved voices found in your Awaj Digital account.'
          });
        }
      } else {
        let errorMsg = 'Unknown error occurred while fetching from Awaj Digital';
        try {
          const textData = await awajResponse.text();
          try {
            const errorData = JSON.parse(textData);
            errorMsg = errorData.message || errorData.error || errorMsg;
          } catch (e) {
            if (textData) errorMsg = textData;
          }
        } catch (e) {
          console.error("Failed to read error response", e);
        }
        throw new Error(`Awaj API Error: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error('Error fetching from Awaj:', err);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: err.message });
    } finally {
      setIsFetchingAwajVoices(false);
    }
  };

  const [smsToCredit, setSmsToCredit] = useState<{ [key: string]: string }>({});
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  
  const [smsEnabledMap, setSmsEnabledMap] = useState<{ [key: string]: boolean }>({});

  const [rejectConfirm, setRejectConfirm] = useState<Transaction | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const [globalStats, setGlobalStats] = useState({ 
    totalStudents: 0, 
    totalClasses: 0, 
    totalDistributedSMS: 0,
    totalSentSMS: 0,
    currentInUserWallets: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
    totalInstitutions: 0,
    activeInstitutions: 0,
    totalVoiceBalance: 0,
    adminSMSStock: 0,
    typeBreakdown: { madrasah: 0, school: 0, kindergarten: 0, nurani: 0, system: 0 }
  });
  const [recentInstitutions, setRecentInstitutions] = useState<Institution[]>([]);
  const [selectedUser, setSelectedUser] = useState<InstitutionWithStats | null>(null);
  const [userStats, setUserStats] = useState({ students: 0, classes: 0 });
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editVoiceSenderId, setEditVoiceSenderId] = useState('');
  const [editModules, setEditModules] = useState({
    attendance: true,
    results: true,
    admit_card: true,
    seat_plan: true,
    accounting: true,
    academic_year_promotion: true,
    voice_broadcast: false,
    sms: true
  });
  const [editSubscriptionEnd, setEditSubscriptionEnd] = useState('');
  const [editSubscriptionType, setEditSubscriptionType] = useState<'monthly' | 'quarterly' | 'yearly' | 'lifetime'>('monthly');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'trial'>('active');
  const [editResultEngine, setEditResultEngine] = useState<'school' | 'befaq' | 'qawmi_custom'>('school');
  const [editResultSystem, setEditResultSystem] = useState<'grading' | 'marks'>('grading');
  const [editAttendanceType, setEditAttendanceType] = useState<'daily' | 'period'>('daily');
  const [editFeeStructure, setEditFeeStructure] = useState<'monthly' | 'session'>('monthly');
  const [editInstitutionType, setEditInstitutionType] = useState<'madrasah' | 'school' | 'kindergarten' | 'nurani' | 'system'>('madrasah');
  const [editFeeEngine, setEditFeeEngine] = useState<'school' | 'qawmi' | 'kindergarten' | 'simple'>('school');
  const [editAccountingMode, setEditAccountingMode] = useState<'qawmi_flexible' | 'school_system'>('school_system');
  const [editSmsBalance, setEditSmsBalance] = useState<number>(0);
  const [editBalance, setEditBalance] = useState<number>(0);
  const [editReveApiKey, setEditReveApiKey] = useState('');
  const [editReveSecretKey, setEditReveSecretKey] = useState('');
  const [editReveClientId, setEditReveClientId] = useState('');
  const [editPaidMonths, setEditPaidMonths] = useState<string[]>([]);
  const [editPackageRate, setEditPackageRate] = useState<number>(0);
  const [editPackageName, setEditPackageName] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthsForPayment, setSelectedMonthsForPayment] = useState<string[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setPackages([...data, { name: 'Custom', rate: 0 }]);
      } else {
        const defaults = [
          { name: 'স্টার্টার', rate: 0.50, sort_order: 1 },
          { name: 'বেসিক', rate: 0.75, sort_order: 2 },
          { name: 'স্মার্ট', rate: 1.00, sort_order: 3 },
          { name: 'একাডেমিক', rate: 1.00, sort_order: 4 },
          { name: 'স্ট্যান্ডার্ড', rate: 1.50, sort_order: 5 },
          { name: 'ফিনান্স', rate: 1.50, sort_order: 6 },
          { name: 'প্রফেশনাল', rate: 1.75, sort_order: 7 },
          { name: 'এন্টারপ্রাইজ', rate: 2.50, sort_order: 8 },
          { name: 'Custom', rate: 0, sort_order: 99 }
        ];
        setPackages(defaults);
      }
    } catch (err) {
      const defaults = [
        { name: 'স্টার্টার', rate: 0.50, sort_order: 1 },
        { name: 'বেসিক', rate: 0.75, sort_order: 2 },
        { name: 'স্মার্ট', rate: 1.00, sort_order: 3 },
        { name: 'একাডেমিক', rate: 1.00, sort_order: 4 },
        { name: 'স্ট্যান্ডার্ড', rate: 1.50, sort_order: 5 },
        { name: 'ফিনান্স', rate: 1.50, sort_order: 6 },
        { name: 'প্রফেশনাল', rate: 1.75, sort_order: 7 },
        { name: 'এন্টারপ্রাইজ', rate: 2.50, sort_order: 8 },
        { name: 'Custom', rate: 0, sort_order: 99 }
      ];
      setPackages(defaults);
    }
  };

  const [editPassword, setEditPassword] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'institution' | 'api' | 'permissions' | 'subscription'>('institution');
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Create Institution State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstPhone, setNewInstPhone] = useState('');
  const [newInstEmail, setNewInstEmail] = useState('');
  const [newInstPassword, setNewInstPassword] = useState('');
  const [newInstType, setNewInstType] = useState<'madrasah' | 'school' | 'kindergarten' | 'nurani'>('madrasah');
  const [isCreatingInst, setIsCreatingInst] = useState(false);

  const fetchGlobalCounts = async () => {
    const [studentsRes, classesRes, smsAllocRes, currentBalRes, pendingRes, instsRes, stockRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('sms_count, amount').eq('status', 'approved'),
      supabase.from('institutions').select('sms_balance, balance, is_active, institution_type').eq('is_super_admin', false),
      supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('institutions').select('*', { count: 'exact', head: true }).eq('is_super_admin', false),
      supabase.from('admin_sms_stock').select('remaining_sms').single()
    ]);

    const totalAllocated = smsAllocRes.data?.reduce((sum, t) => sum + (Number(t.sms_count) || 0), 0) || 0;
    const totalRevenue = smsAllocRes.data?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
    const totalInWallets = currentBalRes.data?.reduce((sum, m) => sum + (Number(m.sms_balance) || 0), 0) || 0;
    const totalVoiceBalance = currentBalRes.data?.reduce((sum, m) => sum + (Number(m.balance) || 0), 0) || 0;
    const activeInsts = currentBalRes.data?.filter(m => m.is_active).length || 0;
    const sentCount = Math.max(0, totalAllocated - totalInWallets);
    const adminStock = stockRes.data?.remaining_sms || 0;

    const typeBreakdown = currentBalRes.data?.reduce((acc: any, m) => {
      const type = m.institution_type || 'madrasah';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, { madrasah: 0, school: 0, kindergarten: 0, nurani: 0, system: 0 });

    return {
      totalStudents: studentsRes.count || 0,
      totalClasses: classesRes.count || 0,
      totalDistributedSMS: totalAllocated,
      totalSentSMS: sentCount,
      currentInUserWallets: totalInWallets,
      totalRevenue,
      pendingApprovals: pendingRes.count || 0,
      totalInstitutions: instsRes.count || 0,
      activeInstitutions: activeInsts,
      totalVoiceBalance,
      adminSMSStock: adminStock,
      typeBreakdown
    };
  };

  const fetchAllMadrasahs = async () => {
    const { data, error } = await supabase.from('institutions')
      .select('*')
      .eq('is_super_admin', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  };

  const fetchPendingTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*, institutions(*)').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
  };

  const fetchTransactionHistory = async () => {
    const { data } = await supabase.from('transactions')
      .select('*, institutions(*)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  };

  const initData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    let isMounted = true;
    try {
      if (view === 'list' || view === 'dashboard') {
        const [mList, gStats, recent, history] = await Promise.all([
          fetchAllMadrasahs(),
          fetchGlobalCounts(),
          supabase.from('institutions').select('*').eq('is_super_admin', false).order('created_at', { ascending: false }).limit(5),
          fetchTransactionHistory()
        ]);
        if (isMounted) {
          setMadrasahs(mList.map(m => {
            const existing = madrasahs.find(ex => ex.id === m.id);
            return { 
              ...m, 
              student_count: existing?.student_count || 0, 
              class_count: existing?.class_count || 0 
            };
          }));
          setGlobalStats(gStats);
          setRecentInstitutions(recent.data || []);
          setTransactionHistory(history);
        }
      }
      if (view === 'approvals') {
        const [pTrans, tHist] = await Promise.all([
          fetchPendingTransactions(),
          fetchTransactionHistory()
        ]);
        if (isMounted) {
          setPendingTrans(pTrans);
          setTransactionHistory(tHist);
          const newSmsMap = { ...smsEnabledMap };
          pTrans.forEach(tr => {
            if (newSmsMap[tr.id] === undefined) newSmsMap[tr.id] = true;
          });
          setSmsEnabledMap(newSmsMap);
        }
      }
    } catch (err) { 
      console.error("AdminPanel Init Error:", err); 
    } finally { 
      if (isMounted && !silent) setLoading(false); 
    }
    return () => { isMounted = false; };
  }, [view, madrasahs.length]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await initData(true); // silent refresh to avoid full-page loader
      setShowRefreshPopup(true);
      setTimeout(() => setShowRefreshPopup(false), 3000);
    } catch (err) {
      setStatusModal({ 
        show: true, 
        type: 'error', 
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed', 
        message: lang === 'bn' ? 'ডাটা রিফ্রেশ করতে সমস্যা হয়েছে।' : 'Failed to refresh system data.' 
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => { 
    const cleanup = initData(); 
    return () => { cleanup.then(cb => cb && cb()); };
  }, [dataVersion, view]);

  useEffect(() => {
    if (currentView === 'approvals') setView('approvals');
    else if (currentView === 'dashboard') setView('dashboard');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

  // Fix: Add missing handleUserClick function to manage details view and stats
  const handleUserClick = async (user: InstitutionWithStats) => {
    setSelectedUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setEditEmail(user.email || '');
    setEditAddress(user.address || '');
    setEditSmsBalance(user.sms_balance || 0);
    setEditBalance(user.balance || 0);
    setEditActive(user.is_active);
    setEditVoiceSenderId(user.voice_sender_id || '');
    let userConfig: any = user.config_json;
    if (typeof userConfig === 'string') {
      try {
        userConfig = JSON.parse(userConfig);
      } catch (e) {
        userConfig = {};
      }
    }

    setEditPassword(userConfig?.user_pin || '');

    const userModules = { ...(userConfig?.modules || {}) };
    delete userModules.fees;

    setEditModules({
      attendance: true,
      results: true,
      admit_card: true,
      seat_plan: true,
      accounting: true,
      academic_year_promotion: true,
      voice_broadcast: true,
      sms: true,
      ...userModules
    });

    const createdAtDate = new Date(user.created_at);
    const oneYearLater = new Date(createdAtDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const defaultEndDate = oneYearLater.toISOString().split('T')[0];

    setEditSubscriptionEnd(user.subscription_end || defaultEndDate);
    setEditSubscriptionType(userConfig?.subscription_type || 'monthly');
    setEditStatus(user.status || 'active');
    setEditResultEngine(userConfig?.result_engine || 'school');
    setEditResultSystem(userConfig?.result_system || 'grading');
    setEditAttendanceType(userConfig?.attendance_type || 'daily');
    setEditFeeStructure(userConfig?.fee_structure || 'monthly');
    setEditInstitutionType(user.institution_type || 'madrasah');
    setEditFeeEngine(userConfig?.fee_engine || 'school');
    setEditAccountingMode(userConfig?.accounting_mode || 'school_system');
    setEditReveApiKey(user.reve_api_key || '');
    setEditReveSecretKey(user.reve_secret_key || '');
    setEditReveClientId(user.reve_client_id || '');
    setEditPaidMonths(userConfig?.paid_months || []);
    setEditPackageRate(userConfig?.package_rate || 0);
    setEditPackageName(userConfig?.package_name || '');
    
    // Refresh packages to ensure they match Super Admin settings
    fetchPackages();
    
    setView('details');
    
    // Fetch user stats
    setUserStats({ students: 0, classes: 0 });
    try {
      const [stdRes, clsRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', user.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', user.id)
      ]);
      setUserStats({
        students: stdRes.count || 0,
        classes: clsRes.count || 0
      });
    } catch (e) {
      console.error("Error fetching user stats:", e);
    }
  };

  // Fix: Add missing handleUserUpdate function to save changes to madrasah profile
  const handleUserUpdate = async () => {
    if (!selectedUser) return;
    setIsUpdatingUser(true);
    try {
      let userConfig: any = selectedUser.config_json;
      if (typeof userConfig === 'string') {
        try {
          userConfig = JSON.parse(userConfig);
        } catch (e) {
          userConfig = {};
        }
      }

      console.log('Saving config_json:', {
        modules: editModules,
        result_engine: editResultEngine,
        result_system: editResultSystem,
        attendance_type: editAttendanceType,
        fee_structure: editFeeStructure,
        fee_engine: editFeeEngine,
        accounting_mode: editAccountingMode
      });
      const { data, error } = await supabase.from('institutions').update({
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        address: editAddress.trim() || null,
        is_active: editActive,
        sms_balance: Number(editSmsBalance) || 0,
        balance: Number(editBalance) || 0,
        voice_sender_id: editVoiceSenderId.trim() || null,
        institution_type: editInstitutionType,
        subscription_end: editSubscriptionEnd || null,
        status: editStatus,
        reve_api_key: editReveApiKey.trim() || null,
        reve_secret_key: editReveSecretKey.trim() || null,
        reve_client_id: editReveClientId.trim() || null,
        config_json: {
          ...(typeof userConfig === 'object' && userConfig !== null ? userConfig : {}),
          modules: editModules,
          result_engine: editResultEngine,
          result_system: editResultSystem,
          attendance_type: editAttendanceType,
          fee_structure: editFeeStructure,
          subscription_type: editSubscriptionType,
          fee_engine: editFeeEngine,
          accounting_mode: editAccountingMode,
          paid_months: editPaidMonths,
          package_rate: editPackageRate,
          package_name: editPackageName,
          user_pin: editPassword.trim()
        }
      }).eq('id', selectedUser.id).select();
      
      console.log('Update result data:', data, 'error:', error);
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Update failed: No rows updated. Check permissions or if the institution exists.');
      
      // Update password if provided
      if (editPassword.trim()) {
        const { error: pwError } = await supabase.rpc(
          "update_user_by_admin",
          {
            p_user_id: selectedUser.id,
            p_password: editPassword.trim(),
          },
        );
        if (pwError) {
          console.error("Password update error:", pwError);
          // We don't throw here so the profile update still succeeds even if the RPC fails
          // because the user just wants to save the PIN for viewing.
        }
      }

      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'মাদরাসা প্রোফাইল আপডেট হয়েছে।' });
      setEditPassword('');
      initData(true);
      if (onProfileUpdate) onProfileUpdate();
      setView('list');
    } catch (err: any) {
      let message = err.message;
      if (message.includes("Could not find the 'email' column")) {
        message = "Database schema mismatch: 'email' column is missing in 'institutions' table. Please run the SQL migration script in Supabase SQL Editor: \n\nALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS email TEXT;\nNOTIFY pgrst, 'reload config';";
      } else if (message.includes("Could not find the 'reve_client_id' column")) {
        message = "Database schema mismatch: 'reve_client_id' column is missing in 'institutions' table. Please run the SQL migration script in Supabase SQL Editor: \n\nALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS reve_client_id TEXT;\nNOTIFY pgrst, 'reload config';";
      }
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: message });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setShowConfirm({
      show: true,
      title: "প্রতিষ্ঠান ডিলিট নিশ্চিত করুন",
      message: `আপনি কি নিশ্চিত যে "${selectedUser.name}" প্রতিষ্ঠানটি চিরতরে ডিলিট করতে চান? এটি আর ফিরিয়ে আনা যাবে না এবং এর সকল ডাটা মুছে যাবে।`,
      onConfirm: async () => {
        setIsDeletingUser(true);
        try {
          const { data: success, error } = await supabase.rpc(
            "delete_user_by_admin",
            {
              p_user_id: selectedUser.id,
            },
          );

          if (error) throw error;
          if (!success) throw new Error("User deletion failed via RPC");

          setStatusModal({
            show: true,
            type: "success",
            title: "সফল",
            message: "প্রতিষ্ঠানটি সফলভাবে ডিলিট হয়েছে",
          });
          setView('list');
          setSelectedUser(null);
          initData();
        } catch (err: any) {
          console.error("Error removing institution:", err);
          setStatusModal({
            show: true,
            type: "error",
            title: "ত্রুটি",
            message: "প্রতিষ্ঠান ডিলিট করতে সমস্যা হয়েছে",
          });
        } finally {
          setIsDeletingUser(false);
        }
      },
    });
  };

  const approveTransaction = async (tr: Transaction) => {
    const isVoice = (tr.description || '').toLowerCase().includes('voice') || tr.module === 'voice';
    const sms = Number(smsToCredit[tr.id]);
    
    if (!isVoice && (!sms || sms <= 0)) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সঠিক SMS সংখ্যা লিখুন' });
      return;
    }
    
    setApprovingIds(prev => new Set(prev).add(tr.id));
    try {
      if (isVoice) {
        // ১. ডাটাবেসে পেমেন্ট অনুমোদন করা (Manual update for Voice)
        const { error: updateError } = await supabase.from('transactions').update({ status: 'approved' }).eq('id', tr.id);
        if (updateError) throw updateError;
        
        const { data: instData, error: instError } = await supabase.from('institutions').select('balance').eq('id', tr.institution_id).single();
        if (instError) throw instError;
        
        const newBalance = (instData.balance || 0) + tr.amount;
        const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', tr.institution_id);
        if (balanceError) throw balanceError;
      } else {
        // ১. ডাটাবেসে পেমেন্ট অনুমোদন করা (RPC handles transactions, madrasahs balance and admin stock)
        const { data, error } = await supabase.rpc('approve_payment_with_sms', { 
          t_id: tr.id, 
          m_id: tr.institution_id, 
          sms_to_give: sms 
        });
        
        if (error) throw error;

        // RPC রেসপন্স চেক করা (Database level error capture)
        const res = data as { success: boolean, error?: string };
        if (res && res.success === false) {
          throw new Error(res.error || "Approval failed on server");
        }
      }
      
      // ২. ইউজারকে কনফার্মেশন SMS পাঠানো (যদি টগল চালু থাকে)
      const isSmsEnabled = smsEnabledMap[tr.id] !== false;
      if (isSmsEnabled) {
        const userPhone = tr.institutions?.phone || tr.sender_phone;
        if (userPhone) {
          const msg = isVoice 
            ? `আস-সালামু আলাইকুম, আপনার পেমেন্ট অনুমোদিত হয়েছে। আপনার অ্যাকাউন্টে ${tr.amount} ৳ ভয়েস ব্যালেন্স যোগ করা হয়েছে। ধন্যবাদ।`
            : `আস-সালামু আলাইকুম, আপনার পেমেন্ট অনুমোদিত হয়েছে। আপনার অ্যাকাউন্টে ${sms} টি SMS যোগ করা হয়েছে। ধন্যবাদ।`;
          // Fire and forget SMS to avoid blocking UI
          smsApi.sendDirect(userPhone, msg).catch(err => console.error("SMS Send Error:", err));
        }
      }

      // ৩. লোকাল স্টেট আপডেট করা (সফল হলে সাথে সাথে লিস্ট থেকে সরিয়ে দেয়া)
      setPendingTrans(prev => prev.filter(p => p.id !== tr.id));
      
      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: 'সফল', 
        message: isSmsEnabled ? 'রিচার্জ সফল হয়েছে এবং ইউজারকে SMS পাঠানো হয়েছে।' : 'রিচার্জ সফল হয়েছে (SMS পাঠানো হয়নি)।' 
      });
      
      // ব্যাকগ্রাউন্ডে ডাটা রিফ্রেশ করা
      initData(true);
    } catch (err: any) {
      console.error("Approve Error:", err);
      // Detailed error reporting for debugging
      const errorMessage = err.message || "অজানা ত্রুটি দেখা দিয়েছে।";
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: errorMessage });
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.delete(tr.id);
        return next;
      });
    }
  };

  const rejectTransaction = async () => {
    if (!rejectConfirm) return;
    setIsRejecting(true);
    try {
      const { error } = await supabase.from('transactions').update({ status: 'rejected' }).eq('id', rejectConfirm.id);
      if (error) throw error;
      
      const userPhone = rejectConfirm.institutions?.phone || rejectConfirm.sender_phone;
      if (userPhone) {
        const msg = `দুঃখিত, আপনার পেমেন্ট রিকোয়েস্টটি (${rejectConfirm.amount} ৳) বাতিল করা হয়েছে। বিস্তারিত জানতে যোগাযোগ করুন।`;
        smsApi.sendDirect(userPhone, msg).catch(err => console.error("SMS Send Error:", err));
      }

      setPendingTrans(prev => prev.filter(p => p.id !== rejectConfirm.id));
      setRejectConfirm(null);
      setStatusModal({ show: true, type: 'success', title: 'বাতিল', message: 'পেমেন্ট রিকোয়েস্ট বাতিল করা হয়েছে' });
      initData(true);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsRejecting(false);
    }
  };

  const toggleSmsForRequest = (id: string) => {
    setSmsEnabledMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateInstitution = async () => {
    if (!newInstName.trim() || !newInstPhone.trim() || !newInstEmail.trim() || !newInstPassword.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'নাম, ফোন, ইমেইল এবং পাসওয়ার্ড আবশ্যক' });
      return;
    }
    
    setIsCreatingInst(true);
    try {
      // First try to sign up the user normally to let Supabase handle the identities table
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newInstEmail.trim(),
        password: newInstPassword.trim(),
        options: {
          data: {
            name: newInstName.trim(),
            madrasah_name: newInstName.trim()
          }
        }
      });

      let newUserId = signUpData?.user?.id;

      // If signup fails (e.g., due to rate limits), fallback to RPC
      if (signUpError || !newUserId) {
        console.log("Signup failed, falling back to RPC:", signUpError);
        const { data: rpcUserId, error: rpcError } = await supabase.rpc('create_user_by_admin', {
          p_email: newInstEmail.trim(),
          p_password: newInstPassword.trim(),
          p_user_data: {
            name: newInstName.trim(),
            madrasah_name: newInstName.trim()
          }
        });

        if (rpcError) throw rpcError;
        if (!rpcUserId) throw new Error("User creation failed via RPC");
        newUserId = rpcUserId;
      }

      // Wait a moment for the trigger to create the initial record
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the institution record with specific details
      const { error: updateError } = await supabase.from('institutions').update({
        phone: newInstPhone.trim(),
        email: newInstEmail.trim(),
        institution_type: newInstType,
        status: 'active',
        is_active: true,
        config_json: {
          modules: {
            attendance: true,
            results: true,
            admit_card: true,
            seat_plan: true,
            accounting: true,
            academic_year_promotion: true,
            voice_broadcast: true,
            sms: true
          },
          result_engine: 'school',
          result_system: 'grading',
          attendance_type: 'daily',
          fee_structure: 'monthly',
          ui_mode: 'madrasah'
        }
      }).eq('id', newUserId);
      
      if (updateError) {
        // If update fails, try inserting (in case trigger failed or was slow)
        const { error: insertError } = await supabase.from('institutions').upsert({
          id: newUserId,
          name: newInstName.trim(),
          email: newInstEmail.trim(),
          phone: newInstPhone.trim(),
          institution_type: newInstType,
          is_active: true,
          is_super_admin: false,
          balance: 0,
          sms_balance: 0,
          status: 'active',
          config_json: {
            modules: {
              attendance: true,
              results: true,
              admit_card: true,
              seat_plan: true,
              accounting: true,
              academic_year_promotion: true,
              voice_broadcast: true,
              sms: true
            },
            result_engine: 'school',
            result_system: 'grading',
            attendance_type: 'daily',
            fee_structure: 'monthly',
            ui_mode: 'madrasah'
          }
        });
        if (insertError) throw insertError;
      }
      
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'নতুন প্রতিষ্ঠান এবং ইউজার তৈরি করা হয়েছে।' });
      setShowCreateModal(false);
      setNewInstName('');
      setNewInstPhone('');
      setNewInstEmail('');
      setNewInstPassword('');
      initData(true);
    } catch (err: any) {
      console.error("Create Error:", err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsCreatingInst(false);
    }
  };

  const filtered = useMemo(() => madrasahs.filter(m => {
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = (m.name || '').toLowerCase().includes(query);
    const matchesType = filterType === 'all' || (m.institution_type || 'madrasah') === filterType;
    return matchesSearch && matchesType;
  }), [madrasahs, searchQuery, filterType]);

  return (
    <div className={`space-y-6 pb-20 animate-in fade-in relative ${madrasah?.theme === 'dark' ? 'text-white' : ''}`}>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Loading System Data...</p>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between px-2">
                <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>সিস্টেম ড্যাশবোর্ড</h1>
                <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                   <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <Users2 size={20} />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.totalInstitutions}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Portals</p>
                </div>
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <Activity size={20} />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.activeInstitutions}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Active Portals</p>
                </div>
                <div onClick={() => setView('approvals')} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none hover:border-yellow-900' : 'bg-white border-slate-100 shadow-bubble hover:border-yellow-200'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center cursor-pointer transition-all active:scale-95`}>
                  <div className={`w-10 h-10 ${madrasah?.theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <CreditCard size={20} />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.pendingApprovals}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Pending Approvals</p>
                </div>
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 ${madrasah?.theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <Banknote size={20} />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.totalRevenue.toLocaleString('bn-BD')}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Revenue (৳)</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-4 rounded-[2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-8 h-8 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-500'} rounded-xl flex items-center justify-center mb-1 shadow-inner`}>
                    <GraduationCap size={16} />
                  </div>
                  <h4 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.totalStudents.toLocaleString('bn-BD')}</h4>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Students</p>
                </div>
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-4 rounded-[2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-8 h-8 ${madrasah?.theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-50 text-orange-500'} rounded-xl flex items-center justify-center mb-1 shadow-inner`}>
                    <Layers size={16} />
                  </div>
                  <h4 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.totalClasses.toLocaleString('bn-BD')}</h4>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Classes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>SMS Inventory</h3>
                    <Zap size={24} className={madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'} fill="currentColor" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">বিতরণকৃত SMS</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.totalDistributedSMS.toLocaleString('bn-BD')}</h5>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ব্যবহৃত SMS</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-500'}`}>{globalStats.totalSentSMS.toLocaleString('bn-BD')}</h5>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ইউজার ওয়ালেট (মোট SMS)</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-purple-400' : 'text-[#8D30F4]'}`}>{globalStats.currentInUserWallets.toLocaleString('bn-BD')}</h5>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">সিস্টেম স্টক (অবশিষ্ট SMS)</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`}>{globalStats.adminSMSStock.toLocaleString('bn-BD')}</h5>
                    </div>
                  </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>System Info</h3>
                    <AlertCircle size={24} className="text-slate-300" />
                  </div>
                  <div className="flex flex-col justify-center h-full pb-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Total Institutions</p>
                    <h5 className={`text-4xl font-black text-center ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{globalStats.totalInstitutions.toLocaleString('bn-BD')}</h5>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>System Breakdown</h3>
                    <PieChart size={24} className="text-slate-300" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(globalStats.typeBreakdown).map(([type, count]) => (
                      <div key={type} className={`p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border flex items-center justify-between`}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{type}</span>
                        <span className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>Recent Portals</h3>
                    <Building2 size={24} className="text-slate-300" />
                  </div>
                  <div className="space-y-3">
                    {recentInstitutions.map(inst => (
                      <div key={inst.id} className={`flex items-center justify-between p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
                            <Building2 size={18} />
                          </div>
                          <div>
                            <p className={`text-xs font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>{inst.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{inst.institution_type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-400">{new Date(inst.created_at).toLocaleDateString('bn-BD')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>সাম্প্রতিক লেনদেন</h3>
                  <HistoryIcon size={24} className="text-slate-300" />
                </div>
                <div className="space-y-3">
                  {transactionHistory.slice(0, 5).map(tr => (
                    <div key={tr.id} className={`flex items-center justify-between p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tr.status === 'approved' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                          {tr.status === 'approved' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        </div>
                        <div>
                          <p className={`text-xs font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>{tr.institutions?.name || 'Unknown'}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{tr.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>৳ {tr.amount}</p>
                        <p className="text-[8px] font-bold text-slate-400">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                      </div>
                    </div>
                  ))}
                  {transactionHistory.length === 0 && (
                    <p className="text-center py-10 text-slate-400 text-xs font-bold italic">কোন লেনদেন পাওয়া যায়নি</p>
                  )}
                </div>
                <button onClick={() => setView('approvals')} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-50/50 rounded-2xl transition-colors">
                  সকল লেনদেন দেখুন
                </button>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>মাদরাসা লিস্ট</h1>
                <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                   <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex gap-2 px-1">
                <div className="relative group flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type="text" placeholder="Search name or code..." className={`w-full h-14 pl-14 pr-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'} border rounded-[2rem] outline-none font-bold shadow-bubble`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <select 
                  className={`h-14 px-4 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'} border rounded-[2rem] outline-none font-bold shadow-bubble text-xs`}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="madrasah">Madrasah</option>
                  <option value="school">School</option>
                  <option value="kindergarten">Kindergarten</option>
                  <option value="nurani">Nurani</option>
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.length > 0 ? filtered.map(m => (
                  <div key={m.id} onClick={() => handleUserClick(m)} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none hover:border-blue-900' : 'bg-white border-slate-100 shadow-bubble hover:border-[#2563EB]/30'} p-5 rounded-[2.2rem] border active:scale-[0.98] transition-all cursor-pointer`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-14 h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} rounded-2xl flex items-center justify-center text-slate-300 border shadow-inner shrink-0 overflow-hidden`}>
                          {m.logo_url ? <img src={m.logo_url} className="w-full h-full object-contain" /> : <UserIcon size={24} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} truncate font-noto text-lg`}>{m.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {m.is_active ? 'Active' : 'Blocked'}
                            </p>
                            <span className="text-[10px] text-slate-300">•</span>
                            <p className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                              {m.institution_type || 'madrasah'}
                            </p>
                            {m.config_json?.modules?.voice_broadcast !== false && (
                              <p className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                                Voice
                              </p>
                            )}
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.phone || 'No Phone'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className={`text-center py-20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[2.5rem] border-2 border-dashed`}>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No Madrasahs Found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'approvals' && (
            <div className="space-y-8 px-1">
              <div className="flex items-center justify-between px-2">
                <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>পেমেন্ট ম্যানেজমেন্ট</h1>
                <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                   <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className={`flex ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} p-1 rounded-2xl`}>
                <button 
                  onClick={() => setPaymentTab('sms')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentTab === 'sms' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
                >
                  SMS Recharge
                </button>
                <button 
                  onClick={() => setPaymentTab('voice')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentTab === 'voice' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
                >
                  Voice Recharge
                </button>
              </div>
              
              <div className="space-y-6">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                   <AlertCircle size={14} className="text-amber-400" /> Pending Requests
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pendingTrans.filter(tr => {
                    const desc = (tr.description || '').toLowerCase();
                    return paymentTab === 'sms' ? (desc.includes('sms') || !desc.includes('voice')) : desc.includes('voice');
                  }).length > 0 ? pendingTrans.filter(tr => {
                    const desc = (tr.description || '').toLowerCase();
                    return paymentTab === 'sms' ? (desc.includes('sms') || !desc.includes('voice')) : desc.includes('voice');
                  }).map(tr => (
                    <div key={tr.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-4 animate-in slide-in-from-left-4">
                      <div className="flex items-center justify-between">
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[16px] font-black border border-emerald-100">{tr.amount} ৳</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                           <Clock size={12} /> {new Date(tr.created_at).toLocaleDateString('bn-BD')}
                        </div>
                      </div>
                      <div className="px-1 space-y-1">
                        <p className="text-[15px] font-black text-[#1E3A8A] font-noto">{tr.institutions?.name}</p>
                        <div className="flex flex-col gap-0.5">
                           <p className="text-[10px] font-bold text-slate-400">TrxID: <span className="text-[#2563EB]">{tr.transaction_id}</span></p>
                           <p className="text-[11px] font-black text-[#1E3A8A] flex items-center gap-1.5">
                               <Smartphone size={12} className="text-[#2563EB]" /> 
                               বিকাশ নম্বর: <span className="text-slate-800">{tr.sender_phone || 'N/A'}</span>
                           </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                           <MessageSquare size={16} className={smsEnabledMap[tr.id] ? "text-[#2563EB]" : "text-slate-300"} />
                           <span className="text-[10px] font-black text-slate-500 uppercase">অ্যাপ্রুভ হলে SMS পাঠান</span>
                        </div>
                        <button onClick={() => toggleSmsForRequest(tr.id)} className="transition-all active:scale-90">
                           {smsEnabledMap[tr.id] ? (
                             <ToggleRight className="text-[#2563EB]" size={28} />
                           ) : (
                             <ToggleLeft className="text-slate-300" size={28} />
                           )}
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2.5">
                          {paymentTab === 'sms' && (
                            <input 
                              type="number" 
                              disabled={approvingIds.has(tr.id)}
                              className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-base text-center outline-none focus:border-[#2563EB]/20 disabled:opacity-50" 
                              value={smsToCredit[tr.id] || ''} 
                              onChange={(e) => setSmsToCredit({...smsToCredit, [tr.id]: e.target.value})} 
                              placeholder="SMS Quantity" 
                            />
                          )}
                          <button 
                            onClick={() => approveTransaction(tr)} 
                            disabled={approvingIds.has(tr.id) || (paymentTab === 'sms' && !smsToCredit[tr.id])}
                            className="w-full h-14 bg-[#2563EB] text-white font-black rounded-[1.5rem] text-sm active:scale-95 transition-all shadow-premium disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center"
                          >
                            {approvingIds.has(tr.id) ? <Loader2 className="animate-spin" size={20} /> : 'অনুমোদন দিন'}
                          </button>
                        </div>
                        <button 
                          onClick={() => setRejectConfirm(tr)} 
                          disabled={approvingIds.has(tr.id)}
                          className="w-full h-12 bg-red-50 text-red-500 font-black rounded-[1.5rem] text-xs active:scale-95 transition-all border border-red-100 disabled:opacity-50"
                        >
                          রিকোয়েস্ট বাতিল করুন
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No Pending Requests</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-slate-100">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                   <HistoryIcon size={14} className="text-blue-400" /> Recent Transactions
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {transactionHistory.filter(tr => {
                    const desc = (tr.description || '').toLowerCase();
                    return paymentTab === 'sms' ? (desc.includes('sms') || !desc.includes('voice')) : desc.includes('voice');
                  }).length > 0 ? transactionHistory.filter(tr => {
                    const desc = (tr.description || '').toLowerCase();
                    return paymentTab === 'sms' ? (desc.includes('sms') || !desc.includes('voice')) : desc.includes('voice');
                  }).map(tr => (
                    <div key={tr.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                       <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <p className="text-[15px] font-black text-[#1E3A8A] leading-none">{tr.amount} ৳</p>
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {tr.status}
                             </span>
                          </div>
                          <p className="text-[12px] font-black text-[#1E3A8A] font-noto truncate">{tr.institutions?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                             <Smartphone size={10} /> বিকাশ: {tr.sender_phone || 'N/A'}
                             {tr.sms_count && <span className="text-[#2563EB] font-black">({tr.sms_count} SMS)</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-slate-400">
                             <Clock size={10} />
                             <p className="text-[9px] font-bold">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                          </div>
                       </div>
                       <div className="text-right ml-4">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">TrxID</p>
                          <p className="text-[10px] font-black text-[#2563EB] uppercase leading-tight">{tr.transaction_id}</p>
                       </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No History Found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'details' && selectedUser && (
             <div className="animate-in slide-in-from-right-10 duration-500 pb-24 space-y-6 pt-2 max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 px-2">
                   <button onClick={() => setView('list')} className={`w-12 h-12 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-[#2563EB] border-slate-200 hover:bg-slate-50'} rounded-2xl flex items-center justify-center active:scale-95 transition-all border shadow-sm`}>
                      <ArrowLeft size={24} strokeWidth={2.5} />
                   </button>
                   <div className="min-w-0 flex-1">
                      <h1 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto truncate tracking-tight`}>Institution Details</h1>
                      <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">ID: {selectedUser.id}</p>
                   </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/40'} rounded-[2.5rem] md:rounded-[3rem] p-5 md:p-8 border space-y-8`}>
                   {/* Profile Header */}
                   <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                      <div className={`w-28 h-28 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-white'} rounded-[2rem] flex items-center justify-center border-4 shadow-lg overflow-hidden relative group`}>
                         {selectedUser.logo_url ? <img src={selectedUser.logo_url} className="w-full h-full object-contain" /> : <UserIcon size={48} className="text-slate-300" />}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <Camera size={24} className="text-white" />
                         </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <h2 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto leading-tight`}>{selectedUser.name}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                          <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border ${editActive ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200') : (madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200')}`}>
                             <Activity size={14} /> {editActive ? 'Active Portal' : 'Access Restricted'}
                          </div>
                          <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                             {editInstitutionType || 'Institution'}
                          </div>
                        </div>
                      </div>
                   </div>

                   {/* Stats Grid */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'} p-5 rounded-3xl border flex flex-col justify-center`}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</p>
                         <h5 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{userStats.students}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'} p-5 rounded-3xl border flex flex-col justify-center`}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classes</p>
                         <h5 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{userStats.classes}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} p-5 rounded-3xl border flex flex-col justify-center`}>
                         <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">SMS Balance</p>
                         <h5 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{selectedUser.sms_balance || 0}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} p-5 rounded-3xl border flex flex-col justify-center`}>
                         <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Voice Balance</p>
                         <h5 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>৳ {Number(selectedUser.balance || 0).toFixed(2)}</h5>
                      </div>
                   </div>

                   {/* Tab Navigation */}
                   <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-5 px-5 md:mx-0 md:px-0">
                      <button 
                        onClick={() => setDetailsTab('institution')}
                        className={`px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2.5 shrink-0 ${detailsTab === 'institution' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <Building2 size={16} /> {lang === 'bn' ? 'প্রতিষ্ঠান তথ্য' : 'Institution Info'}
                      </button>
                      <button 
                        onClick={() => setDetailsTab('api')}
                        className={`px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2.5 shrink-0 ${detailsTab === 'api' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <Key size={16} /> {lang === 'bn' ? 'এপিআই সিকিউরিটি' : 'API Security'}
                      </button>
                      <button 
                        onClick={() => setDetailsTab('permissions')}
                        className={`px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2.5 shrink-0 ${detailsTab === 'permissions' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <ShieldCheck size={16} /> {lang === 'bn' ? 'পারমিশন' : 'Permissions'}
                      </button>
                      <button 
                        onClick={() => setDetailsTab('subscription')}
                        className={`px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2.5 shrink-0 ${detailsTab === 'subscription' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <CreditCard size={16} /> {lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
                      </button>
                   </div>

                   <div className={`space-y-6 pt-4 border-t ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                      {detailsTab === 'institution' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institution Name</label>
                                 <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gmail / Email</label>
                                 <input type="email" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all`} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Phone</label>
                                 <input type="tel" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">User PIN / Password</label>
                                 <div className="relative">
                                    <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all`} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Enter new PIN/Password" />
                                    <Shield className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2">SMS Balance</label>
                                 <div className="relative">
                                    <input type="number" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all`} value={editSmsBalance} onChange={(e) => setEditSmsBalance(Number(e.target.value))} />
                                    <MessageSquare className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-400" size={20} />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-2">Voice Balance (৳)</label>
                                 <div className="relative">
                                    <input type="number" step="0.01" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all`} value={editBalance} onChange={(e) => setEditBalance(Number(e.target.value))} />
                                    <Mic className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-400" size={20} />
                                 </div>
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institution Address</label>
                                 <textarea className={`w-full h-28 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 transition-all resize-none`} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Enter full address..." />
                              </div>
                           </div>

                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Sliders size={16} className={madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} /> Basic Config
                                 </h4>
                                 <button onClick={() => setEditActive(!editActive)} className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all w-full md:w-auto ${editActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}>
                                    {editActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{editActive ? 'Active' : 'Inactive'}</span>
                                 </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institution Type</label>
                                    <select 
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                                      value={editInstitutionType}
                                      onChange={(e) => setEditInstitutionType(e.target.value as any)}
                                    >
                                      <option value="madrasah">Madrasah</option>
                                      <option value="school">School</option>
                                      <option value="kindergarten">Kindergarten</option>
                                      <option value="nurani">Nurani</option>
                                    </select>
                                 </div>
                              </div>
                           </div>

                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Settings size={16} className={madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} /> System Settings
                                 </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Result Engine</label>
                                    <select 
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                                      value={editResultEngine}
                                      onChange={(e) => setEditResultEngine(e.target.value as any)}
                                    >
                                      <option value="school">School (GPA)</option>
                                      <option value="befaq">Befaq (Division)</option>
                                      <option value="qawmi_custom">Qawmi Custom</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Result System</label>
                                    <select 
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                                      value={editResultSystem}
                                      onChange={(e) => setEditResultSystem(e.target.value as any)}
                                    >
                                      <option value="grading">Grading (GPA)</option>
                                      <option value="marks">Marks Only</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Attendance Type</label>
                                    <select 
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                                      value={editAttendanceType}
                                      onChange={(e) => setEditAttendanceType(e.target.value as any)}
                                    >
                                      <option value="daily">Daily</option>
                                      <option value="period">Period Wise</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Accounting Mode</label>
                                    <select 
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                                      value={editAccountingMode}
                                      onChange={(e) => setEditAccountingMode(e.target.value as any)}
                                    >
                                      <option value="qawmi_flexible">Qawmi Flexible</option>
                                      <option value="school_system">School System</option>
                                    </select>
                                 </div>
                              </div>
                           </div>
                        </div>
                      )}

                      {detailsTab === 'api' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Key size={16} className={madrasah?.theme === 'dark' ? 'text-amber-400' : 'text-amber-500'} /> API & Security
                                 </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Voice Sender ID</label>
                                    <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editVoiceSenderId} onChange={(e) => setEditVoiceSenderId(e.target.value)} placeholder="e.g. 8801..." />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">REVE API Key</label>
                                    <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editReveApiKey} onChange={(e) => setEditReveApiKey(e.target.value)} placeholder="API Key" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Secret Key</label>
                                    <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editReveSecretKey} onChange={(e) => setEditReveSecretKey(e.target.value)} placeholder="Secret Key" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">REVE Client ID</label>
                                    <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editReveClientId} onChange={(e) => setEditReveClientId(e.target.value)} placeholder="Client ID" />
                                  </div>
                               </div>
                            </div>
                         </div>
                      )}
                      {detailsTab === 'permissions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <ShieldCheck size={16} className={madrasah?.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'} /> Module Permissions
                                 </h4>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.entries(editModules).map(([key, value]) => (
                                  <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{key.replace(/_/g, ' ')}</span>
                                    <button 
                                      onClick={() => setEditModules({...editModules, [key]: !value})}
                                      className={`w-12 h-6 rounded-full transition-all relative ${value ? 'bg-emerald-500' : (madrasah?.theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')}`}
                                    >
                                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${value ? 'left-7' : 'left-1'}`} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                           </div>
                        </div>
                      )}
                      {detailsTab === 'subscription' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-8`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <CreditCard size={16} className={madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'} /> Subscription Info
                                 </h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">System Type</label>
                                    <select className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editSubscriptionType} onChange={(e) => setEditSubscriptionType(e.target.value as any)}>
                                       <option value="monthly">Monthly Subscription</option>
                                       <option value="quarterly">Quarterly Subscription</option>
                                       <option value="yearly">Yearly Subscription</option>
                                       <option value="lifetime">Lifetime Access</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Portal Status</label>
                                    <select className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                                       <option value="active">Active</option>
                                       <option value="suspended">Suspended</option>
                                       <option value="trial">Trial Period</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Subscription End</label>
                                    <input type="date" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`} value={editSubscriptionEnd} onChange={(e) => setEditSubscriptionEnd(e.target.value)} />
                                 </div>
                              </div>

                              {/* Package Selection */}
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Select Package</label>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {packages.map(pkg => (
                                       <button 
                                         key={pkg.name}
                                         onClick={() => {
                                           setEditPackageName(pkg.name);
                                           setEditPackageRate(pkg.rate);
                                         }}
                                         className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${editPackageName === pkg.name ? (madrasah?.theme === 'dark' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/10' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-lg shadow-blue-500/10') : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                                       >
                                          <span className="text-[11px] font-black uppercase tracking-widest">{pkg.name}</span>
                                          {pkg.name === 'Custom' ? (
                                            <input 
                                              type="number" 
                                              className={`w-full text-center bg-transparent font-black outline-none text-lg ${editPackageName === pkg.name ? 'text-blue-600' : 'text-slate-400'}`}
                                              value={editPackageRate}
                                              onChange={(e) => setEditPackageRate(Number(e.target.value))}
                                              placeholder="Rate"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          ) : (
                                            <span className="text-lg font-black">{pkg.rate} ৳</span>
                                          )}
                                       </button>
                                    ))}
                                 </div>
                              </div>

                              {/* Month Selection */}
                              <div className="space-y-4">
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Months to Pay ({selectedYear})</label>
                                    <div className="flex items-center gap-3">
                                       <button onClick={() => setSelectedYear(selectedYear - 1)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><ArrowLeft size={16} /></button>
                                       <span className="text-sm font-black text-blue-500">{selectedYear}</span>
                                       <button onClick={() => setSelectedYear(selectedYear + 1)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><ArrowRight size={16} /></button>
                                    </div>
                                 </div>

                                 {/* Quick Selection */}
                                 <div className="flex flex-wrap items-center gap-2 px-1">
                                    <button 
                                      onClick={() => {
                                        const currentYear = new Date().getFullYear();
                                        const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
                                        setSelectedMonthsForPayment([`${currentYear}-${currentMonth}`]);
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${selectedMonthsForPayment.length === 1 ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                                    >
                                      Monthly
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const currentYear = new Date().getFullYear();
                                        const currentMonth = new Date().getMonth(); // 0-indexed
                                        const months = [];
                                        for (let i = 0; i < 3; i++) {
                                          const d = new Date(currentYear, currentMonth + i, 1);
                                          months.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
                                        }
                                        setSelectedMonthsForPayment(months);
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${selectedMonthsForPayment.length === 3 ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                                    >
                                      Quarterly
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const currentYear = new Date().getFullYear();
                                        const months = [];
                                        for (let i = 1; i <= 12; i++) {
                                          months.push(`${currentYear}-${i.toString().padStart(2, '0')}`);
                                        }
                                        setSelectedMonthsForPayment(months);
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${selectedMonthsForPayment.length === 12 ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                                    >
                                      Yearly
                                    </button>
                                    <button 
                                      onClick={() => setSelectedMonthsForPayment([])}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                      Clear
                                    </button>
                                 </div>

                                 <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {[
                                      { label: 'জানুয়ারি', value: '01' },
                                      { label: 'ফেব্রুয়ারি', value: '02' },
                                      { label: 'মার্চ', value: '03' },
                                      { label: 'এপ্রিল', value: '04' },
                                      { label: 'মে', value: '05' },
                                      { label: 'জুন', value: '06' },
                                      { label: 'জুলাই', value: '07' },
                                      { label: 'আগস্ট', value: '08' },
                                      { label: 'সেপ্টেম্বর', value: '09' },
                                      { label: 'অক্টোবর', value: '10' },
                                      { label: 'নভেম্বর', value: '11' },
                                      { label: 'ডিসেম্বর', value: '12' }
                                    ].map(month => {
                                      const yearMonth = `${selectedYear}-${month.value}`;
                                      const isPaidHistory = editPaidMonths.includes(yearMonth);
                                      const isSelectedNow = selectedMonthsForPayment.includes(yearMonth);
                                      
                                      return (
                                        <button 
                                          key={month.value}
                                          onClick={() => {
                                            if (isSelectedNow) {
                                              setSelectedMonthsForPayment(selectedMonthsForPayment.filter(m => m !== yearMonth));
                                            } else {
                                              setSelectedMonthsForPayment([...selectedMonthsForPayment, yearMonth]);
                                            }
                                          }}
                                          className={`p-4 rounded-2xl border text-[12px] font-black font-noto transition-all relative active:scale-95 ${isSelectedNow ? (madrasah?.theme === 'dark' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/10' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-lg shadow-blue-500/10') : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                                        >
                                          {month.label}
                                          {isPaidHistory && (
                                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-white dark:border-slate-900 flex items-center justify-center shadow-sm">
                                              <Check size={10} className="text-white" strokeWidth={3} />
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                 </div>
                              </div>

                              {/* Price Calculation */}
                              <div className={`${madrasah?.theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'} p-6 md:p-8 rounded-[2rem] border space-y-6`}>
                                 <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Total Students</p>
                                       <p className={`text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{userStats.students}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Months Selected</p>
                                       <p className={`text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedMonthsForPayment.length}</p>
                                    </div>
                                 </div>
                                 
                                 <div className={`pt-6 border-t ${madrasah?.theme === 'dark' ? 'border-blue-500/20' : 'border-blue-200'} flex items-center justify-between`}>
                                    <div className="space-y-1">
                                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Package Rate</p>
                                       <p className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editPackageRate} ৳</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Total Price</p>
                                       <p className={`text-4xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                          {(userStats.students * editPackageRate * selectedMonthsForPayment.length).toLocaleString('bn-BD')} ৳
                                       </p>
                                    </div>
                                 </div>
                              </div>

                              {/* Payment Button */}
                              <button 
                                onClick={async () => {
                                  const amount = userStats.students * editPackageRate * selectedMonthsForPayment.length;
                                  if (amount <= 0) {
                                    setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'পেমেন্ট অ্যামাউন্ট ০ হতে পারে না। অনুগ্রহ করে প্যাকেজ এবং মাস সিলেক্ট করুন।' });
                                    return;
                                  }
                                  
                                  setIsUpdatingUser(true);
                                  try {
                                    // 1. Record Transaction
                                    const { error: trError } = await supabase.from('transactions').insert({
                                      institution_id: selectedUser.id,
                                      amount,
                                      description: `Subscription Payment - ${editPackageName} Package (${selectedMonthsForPayment.length} Months)`,
                                      status: 'approved',
                                      transaction_id: `SUB-${Date.now()}`,
                                      sender_phone: 'ADMIN',
                                      type: 'credit',
                                      module: 'subscription'
                                    });
                                    if (trError) throw trError;

                                    // 2. Update Institution Profile (Save paid months and package info)
                                    let userConfig: any = selectedUser.config_json;
                                    if (typeof userConfig === 'string') {
                                      try { userConfig = JSON.parse(userConfig); } catch (e) { userConfig = {}; }
                                    }

                                    // Merge new paid months with history
                                    const updatedPaidMonths = Array.from(new Set([...editPaidMonths, ...selectedMonthsForPayment]));

                                    const { error: updateError } = await supabase.from('institutions').update({
                                      config_json: {
                                        ...(typeof userConfig === 'object' && userConfig !== null ? userConfig : {}),
                                        paid_months: updatedPaidMonths,
                                        package_rate: editPackageRate,
                                        package_name: editPackageName,
                                        subscription_type: editSubscriptionType
                                      }
                                    }).eq('id', selectedUser.id);

                                    if (updateError) throw updateError;

                                    setEditPaidMonths(updatedPaidMonths);
                                    setSelectedMonthsForPayment([]);
                                    setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'পেমেন্ট রিসিভ করা হয়েছে এবং প্রোফাইল আপডেট হয়েছে।' });
                                    initData(true);
                                  } catch (err: any) {
                                    setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
                                  } finally {
                                    setIsUpdatingUser(false);
                                  }
                                }}
                                disabled={isUpdatingUser || (userStats.students * editPackageRate * selectedMonthsForPayment.length) <= 0}
                                className={`w-full h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${isUpdatingUser || (userStats.students * editPackageRate * selectedMonthsForPayment.length) <= 0 ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400') : 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 active:scale-95'}`}
                              >
                                <Banknote size={24} /> Receive Payment
                              </button>
                           </div>
                        </div>
                      )}

                      <button onClick={handleUserUpdate} disabled={isUpdatingUser} className={`w-full h-16 ${madrasah?.theme === 'dark' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black rounded-[2rem] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg mt-8`}>
                         {isUpdatingUser ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Save Profile Changes</>}
                      </button>
                   </div>
                </div>
             </div>
          )}
        </>
      )}

      {/* Create Institution Modal - PORTALED */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-[#1E3A8A] font-noto">নতুন প্রতিষ্ঠান</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">প্রতিষ্ঠানের নাম</label>
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/20" 
                  value={newInstName} 
                  onChange={(e) => setNewInstName(e.target.value)} 
                  placeholder="Example Madrasah"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">মোবাইল নম্বর</label>
                <input 
                  type="tel" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/20" 
                  value={newInstPhone} 
                  onChange={(e) => setNewInstPhone(e.target.value)} 
                  placeholder="017..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ইমেইল</label>
                <input 
                  type="email" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/20" 
                  value={newInstEmail} 
                  onChange={(e) => setNewInstEmail(e.target.value)} 
                  placeholder="admin@madrasah.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">পাসওয়ার্ড</label>
                <input 
                  type="password" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/20" 
                  value={newInstPassword} 
                  onChange={(e) => setNewInstPassword(e.target.value)} 
                  placeholder="******"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ধরণ</label>
                <select 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/20"
                  value={newInstType}
                  onChange={(e) => setNewInstType(e.target.value as any)}
                >
                  <option value="madrasah">Madrasah</option>
                  <option value="school">School</option>
                  <option value="kindergarten">Kindergarten</option>
                  <option value="nurani">Nurani</option>
                </select>
              </div>

              <button 
                onClick={handleCreateInstitution} 
                disabled={isCreatingInst}
                className="w-full h-14 bg-[#2563EB] text-white font-black rounded-[1.5rem] mt-4 shadow-premium active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isCreatingInst ? <Loader2 className="animate-spin" /> : 'তৈরি করুন'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Confirmation Modal - PORTALED */}
      {rejectConfirm && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-500 border border-red-50">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-red-100">
                 <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1E3A8A] font-noto tracking-tight">আপনি কি নিশ্চিত?</h3>
              <p className="text-[12px] font-bold text-slate-400 mt-2 font-noto leading-relaxed">
                 <span className="text-red-500">{rejectConfirm.institutions?.name}</span> এর <span className="text-slate-800">{rejectConfirm.amount} ৳</span> রিচার্জ রিকোয়েস্ট বাতিল করতে চাচ্ছেন।
              </p>
              <div className="flex flex-col gap-2 mt-8">
                 <button onClick={rejectTransaction} disabled={isRejecting} className="w-full py-4 bg-red-500 text-white font-black rounded-full shadow-lg shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    {isRejecting ? <Loader2 className="animate-spin" size={18} /> : 'হ্যাঁ, বাতিল করুন'}
                 </button>
                 <button onClick={() => setRejectConfirm(null)} disabled={isRejecting} className="w-full py-3 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-[10px] uppercase tracking-widest">পিছনে যান</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showConfirm.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-500 border border-amber-50">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-amber-100">
                 <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1E3A8A] font-noto tracking-tight">{showConfirm.title}</h3>
              <p className="text-[12px] font-bold text-slate-400 mt-2 font-noto leading-relaxed px-4">
                 {showConfirm.message}
              </p>
              <div className="flex gap-3 mt-8">
                 <button onClick={() => setShowConfirm({ ...showConfirm, show: false })} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-[10px] uppercase tracking-widest">বাতিল</button>
                 <button 
                   onClick={() => {
                     setShowConfirm({ ...showConfirm, show: false });
                     showConfirm.onConfirm();
                   }} 
                   className="flex-1 py-4 bg-red-500 text-white font-black rounded-full shadow-lg shadow-red-100 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                 >
                    নিশ্চিত করুন
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      <AnimatePresence>
        {showRefreshPopup && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              className={`pointer-events-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-blue-100'} backdrop-blur-xl border-2 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-xs w-full relative overflow-hidden`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
              
              <motion.div 
                initial={{ rotate: -90, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2563EB]'} shadow-inner`}
              >
                <CheckCircle2 size={40} />
              </motion.div>
              
              <h3 className={`text-2xl font-black mb-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>সফল হয়েছে!</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                সিস্টেম ডাটা সফলভাবে রিফ্রেশ করা হয়েছে।
              </p>
              
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3 }}
                className="absolute bottom-0 left-0 h-1 bg-blue-500/20"
              />
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
