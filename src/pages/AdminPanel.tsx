
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
// Fix: Import icons from lucide-react instead of ../supabase
import { Loader2, Search, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, ArrowRight, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History, Download, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Trash2, Edit2, Sliders, ToggleLeft, ToggleRight, GraduationCap, Banknote, PhoneCall, Mic, Plus, Play, Building2, Camera, MessageCircle, Send, BookOpen, Megaphone } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { requestManager } from '../services/RequestManager';
import { Institution, Language, Transaction, AdminSMSStock } from 'types';
import { generateSystemPaymentReportPDF, generateSubscriptionMatrixPDF } from '../utils/pdfGenerator';

interface InstitutionWithStats extends Institution {
  student_count?: number;
  class_count?: number;
}

interface AdminPanelProps {
  lang: Language;
  currentView?: 'list' | 'dashboard' | 'approvals' | 'institutions';
  dataVersion?: number;
  onProfileUpdate?: () => void;
  triggerRefresh?: () => void;
  madrasah?: Institution | null;
  profile?: any;
  setStatusModal: (modal: {show: boolean, type: 'success' | 'error', title: string, message: string}) => void;
  onNavigateToVoiceBroadcast?: (ids: string[]) => void;
  onNavigateToSMSBroadcast?: (ids: string[], initialMessage?: string) => void;
}

// Global caching structure for Super Admin panel to prevent redundant loading when switching tabs or exiting institution details.
const adminPanelCache = {
  madrasahs: null as any[] | null,
  globalStats: null as any | null,
  recentInstitutions: null as any[] | null,
  transactionHistory: null as any[] | null,
  pendingTrans: null as any[] | null,
  detailedReport: {} as Record<string, any>,
  lastFetched: 0,
};

// Helper function to clear cache when a mutation occurs.
const clearAdminPanelCache = () => {
  adminPanelCache.madrasahs = null;
  adminPanelCache.globalStats = null;
  adminPanelCache.recentInstitutions = null;
  adminPanelCache.transactionHistory = null;
  adminPanelCache.pendingTrans = null;
  adminPanelCache.detailedReport = {};
  adminPanelCache.lastFetched = 0;
};

const filterTransactionByTab = (tr: Transaction, tab: 'sms' | 'voice' | 'subscription') => {
  const desc = (tr.description || '').toLowerCase();
  const mod = (tr.module || '').toLowerCase();
  const isRefund = desc.includes('refund');
  if (isRefund) return false;

  // Strict check based on module first
  if (mod === 'subscription') return tab === 'subscription';
  if (mod === 'voice') return tab === 'voice';
  if (mod === 'sms') return tab === 'sms';

  // Fallback to description if module is missing
  const isSubscription = desc.includes('subscription') || desc.includes('মাসিক ফি') || desc.includes('সাবস্ক্রিপশন');
  const isVoice = desc.includes('voice') || desc.includes('ভয়েস');
  
  if (tab === 'subscription') return isSubscription;
  if (tab === 'voice') return isVoice && !isSubscription;
  if (tab === 'sms') return !isSubscription && !isVoice;
  
  return false;
};

const isWithinLast30Days = (dateStr?: string) => {
  if (!dateStr) return true;
  const trDate = new Date(dateStr).getTime();
  const thirtyDaysAgoTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return trDate >= thirtyDaysAgoTime;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ lang, currentView = 'list', dataVersion = 0, onProfileUpdate, triggerRefresh, madrasah, profile, setStatusModal, onNavigateToVoiceBroadcast, onNavigateToSMSBroadcast }) => {
  const [madrasahs, setMadrasahs] = useState<InstitutionWithStats[]>([]);
  const [pendingTrans, setPendingTrans] = useState<Transaction[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'madrasah' | 'school' | 'kindergarten' | 'choching' | '200plus'>('all');
  const [visibleCount, setVisibleCount] = useState(30);

  const [view, setView] = useState<'list' | 'approvals' | 'details' | 'dashboard' | 'institutions'>(
    currentView === 'approvals' ? 'approvals' : currentView === 'dashboard' ? 'dashboard' : currentView === 'institutions' ? 'institutions' : 'list'
  );
  const [paymentTab, setPaymentTab] = useState<'sms' | 'voice' | 'subscription'>('sms');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = profile?.role === 'manager';

  const [managerPermissions, setManagerPermissions] = useState<Record<string, boolean>>({});

  const canWrite = (moduleKey: string) => {
    if (isSuperAdmin) return true;
    if (isManager) {
      return !!managerPermissions[moduleKey] || !!profile?.permissions?.[moduleKey];
    }
    return false;
  };

  const canSaveCurrentTab = () => {
    if (isSuperAdmin) return true;
    if (detailsTab === 'institution') return canWrite('institution_info');
    if (detailsTab === 'api') return canWrite('api_security');
    if (detailsTab === 'permissions') return canWrite('permissions');
    if (detailsTab === 'subscription') return canWrite('subscription');
    if (detailsTab === 'history') return canWrite('history');
    return false;
  };






  const [isFetchingAwajVoices, setIsFetchingAwajVoices] = useState(false);
  const [awajVoices, setAwajVoices] = useState<any[]>([]);

  const handleFetchAwajVoices = useCallback(async () => {
    setIsFetchingAwajVoices(true);
    try {
      // 1. Get the system institution ID - ensure we find it correctly
      const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
      
      let sysId = null;
      if (sysInst && sysInst.length > 0) {
        sysId = sysInst[0].id;
      }

      // 2. Fetch voices - either assigned to system ID or null (legacy)
      let query = supabase.from('voice_templates').select('*');
      
      if (sysId) {
         query = query.or(`institution_id.is.null,institution_id.eq.${sysId}`);
      } else {
         query = query.is('institution_id', null);
      }

      const { data, error } = await query.eq('provider_status', 'approved').order('created_at', { ascending: false });

      if (error) throw error;
      setAwajVoices(data || []);
      
      if (!data || data.length === 0) {
         console.warn("No system voices found even after fallback check");
      }
    } catch (err: any) {
      console.error('Error fetching system voices:', err);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সিস্টেম ভয়েস লোড করা সম্ভব হয়নি।' });
    } finally {
      setIsFetchingAwajVoices(false);
    }
  }, []);

  const [smsToCredit, setSmsToCredit] = useState<{ [key: string]: string }>({});
  const [correctionAmounts, setCorrectionAmounts] = useState<{ [key: string]: string }>({});
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  
  const [smsEnabledMap, setSmsEnabledMap] = useState<{ [key: string]: boolean }>({});

  const [rejectConfirm, setRejectConfirm] = useState<Transaction | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const [globalStats, setGlobalStats] = useState({ 
    totalStudents: 0, 
    totalClasses: 0, 
    totalTeachers: 0,
    totalDistributedSMS: 0,
    totalSentSMS: 0,
    currentInUserWallets: 0,
    smsRevenue: 0,
    voiceRevenue: 0,
    subscriptionRevenue: 0,
    monthlySubscriptionRevenue: {} as Record<string, number>,
    totalRevenue: 0,
    pendingApprovals: 0,
    totalInstitutions: 0,
    activeInstitutions: 0,
    totalVoiceBalance: 0,
    adminSMSStock: 0,
    typeBreakdown: { madrasah: 0, school: 0, kindergarten: 0, choching: 0, system: 0 }
  });
  const [detailedFilterMode, setDetailedFilterMode] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [detailedMonth, setDetailedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [detailedYear, setDetailedYear] = useState(new Date().getFullYear().toString());
  const [detailedStartDate, setDetailedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [detailedEndDate, setDetailedEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [detailedReport, setDetailedReport] = useState({
    smsRechargeTotal: 0,
    voiceRechargeTotal: 0,
    subRechargeTotal: 0,
    smsSentNum: 0,
    voiceCallsNum: 0,
    transactions: [] as any[],
    loading: false
  });
  const [recentInstitutions, setRecentInstitutions] = useState<Institution[]>([]);
  const [selectedUser, setSelectedUser] = useState<InstitutionWithStats | null>(null);
  const [selectedRevMonth, setSelectedRevMonth] = useState<string>('all');
  const [userStats, setUserStats] = useState({ students: 0, classes: 0 });
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editVoiceSenderId, setEditVoiceSenderId] = useState('');
  const [editModules, setEditModules] = useState<{ [key: string]: boolean }>({
    attendance: true,
    exam: true,
    accounting: true,
    library: false,
    academic_year_promotion: false,
    voice_broadcast: false,
    sms: true,
    messages: false,
    class_routine: true,
    certificates: false,
    student_photo: false,
    id_cards: false,
    parent_portal: false,
    backup_restore: false
  });
  const [editSubscriptionEnd, setEditSubscriptionEnd] = useState('');
  const [editSubscriptionType, setEditSubscriptionType] = useState<'monthly' | 'quarterly' | 'yearly' | 'lifetime'>('monthly');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'trial'>('active');
  const [editResultEngine, setEditResultEngine] = useState<'school' | 'befaq' | 'qawmi_custom'>('school');
  const [editResultSystem, setEditResultSystem] = useState<'grading' | 'marks' | 'grading_optional' | 'high_school'>('grading');
  const [editFeeStructure, setEditFeeStructure] = useState<'monthly' | 'session'>('monthly');
  const [editInstitutionType, setEditInstitutionType] = useState<'madrasah' | 'school' | 'kindergarten' | 'choching' | 'system'>('madrasah');
  const [editFeeEngine, setEditFeeEngine] = useState<'school' | 'qawmi' | 'kindergarten' | 'simple'>('school');
  const [editAccountingMode, setEditAccountingMode] = useState<'qawmi_flexible' | 'school_system'>('school_system');
  const [editSmsBalance, setEditSmsBalance] = useState<number>(0);
  const [editBalance, setEditBalance] = useState<number>(0);
  const [editReveApiKey, setEditReveApiKey] = useState('');
  const [editReveSecretKey, setEditReveSecretKey] = useState('');
  const [editReveClientId, setEditReveClientId] = useState('');
  const [editInstituteCode, setEditInstituteCode] = useState('');
  const [editSmsRate, setEditSmsRate] = useState<number>(0.50);
  const [editVoiceRate, setEditVoiceRate] = useState<number>(0.50);
  const [editPaidMonths, setEditPaidMonths] = useState<string[]>([]);
  const [editPackageRate, setEditPackageRate] = useState<number>(0);
  const [editPackageName, setEditPackageName] = useState<string>('');
  const [editSubscriptionNote, setEditSubscriptionNote] = useState<string>('');
  const [editDueAmount, setEditDueAmount] = useState<number>(0);
  const [editStudentLimit, setEditStudentLimit] = useState<number>(0);

  const formatMonthsRange = (months: string[]) => {
    if (!months || months.length === 0) return '';
    
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Sort months chronologically: '2024-05' matches string sorting
    const sortedMonths = [...months].sort();
    
    let range = '';
    if (sortedMonths.length === 1) {
      const [_, month] = sortedMonths[0].split('-');
      range = monthNames[parseInt(month) - 1];
    } else {
      const start = sortedMonths[0];
      const end = sortedMonths[sortedMonths.length - 1];
      
      const startMonth = monthNames[parseInt(start.split('-')[1]) - 1];
      const endMonth = monthNames[parseInt(end.split('-')[1]) - 1];
      
      range = `${startMonth} to ${endMonth}`;
    }

    return `'${range}'`;
  };

  const getEnglishPkgName = (name: string) => {
    const mapping: { [key: string]: string } = {
      'স্টার্টার': 'STARTER',
      'বেসিক': 'BASIC',
      'স্মার্ট': 'SMART',
      'একাডেমিক': 'ACADEMIC',
      'স্ট্যান্ডার্ড': 'STANDARD',
      'ফিনান্স': 'FINANCE',
      'প্রফেশনাল': 'PROFESSIONAL',
      'এন্টারপ্রাইজ': 'ENTERPRISE'
    };
    const mapped = mapping[name] || name;
    return mapped.toUpperCase();
  };

  const [selectedInstIds, setSelectedInstIds] = useState<string[]>([]);
  const [commsModal, setCommsModal] = useState<{
    show: boolean,
    institutions: Institution[],
    type: 'sms' | 'voice'
  }>({ show: false, institutions: [], type: 'sms' });
  const [commMessage, setCommMessage] = useState('');
  const [selectedCommVoiceId, setSelectedCommVoiceId] = useState('');
  const [isSendingComm, setIsSendingComm] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthsForPayment, setSelectedMonthsForPayment] = useState<string[]>([]);
  const [instSmsTemplates, setInstSmsTemplates] = useState<any[]>([]);
  const [instVoiceTemplates, setInstVoiceTemplates] = useState<any[]>([]);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [globalDeactivationMode, setGlobalDeactivationMode] = useState(false);
  const [isProcessingDeactivationToggle, setIsProcessingDeactivationToggle] = useState(false);

  const fetchPackages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('name, rate, sort_order')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setPackages([...data, { name: 'Custom', rate: 0 }]);
      } else {
        const defaults = [
          { name: 'STARTER', rate: 0.50, sort_order: 1 },
          { name: 'BASIC', rate: 0.75, sort_order: 2 },
          { name: 'SMART', rate: 1.00, sort_order: 3 },
          { name: 'ACADEMIC', rate: 1.00, sort_order: 4 },
          { name: 'STANDARD', rate: 1.50, sort_order: 5 },
          { name: 'FINANCE', rate: 1.50, sort_order: 6 },
          { name: 'PROFESSIONAL', rate: 1.75, sort_order: 7 },
          { name: 'ENTERPRISE', rate: 2.50, sort_order: 8 },
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
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages, dataVersion]);

  useEffect(() => {
    if (commsModal.show && commsModal.institutions.length > 0) {
      // Reset selection when modal opens
      setSelectedCommVoiceId('');
      
      const fetchTemplates = async () => {
        setFetchingTemplates(true);
        try {
          const instIds = commsModal.institutions.map(i => i.id);
          
          if (commsModal.type === 'sms') {
             // 1. Get system institution ID
             const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
             const sysId = sysInst?.[0]?.id;
             
             // 2. Build template query
             let query = supabase.from('sms_templates').select('*');
             
             // Logic to fetch:
             // - Institution specific templates (if instIds is not empty)
             // - System global templates (institution_id is null)
             // - Internal global templates (institution_id is sysId)
             
             const orConditions = ['institution_id.is.null'];
             if (sysId) orConditions.push(`institution_id.eq.${sysId}`);
             if (instIds.length > 0) orConditions.push(`institution_id.in.(${instIds.join(',')})`);
             
             query = query.or(orConditions.join(','));
             
             const { data, error } = await query.order('created_at', { ascending: false });
             
             if (error) throw error;
             setInstSmsTemplates(data || []);
          } else {
             // 1. Fetch institution-specific voices
             const { data } = await supabase.from('voice_templates').select('*').in('institution_id', instIds).eq('provider_status', 'approved').order('created_at', { ascending: false });
             setInstVoiceTemplates(data || []);
             
             // 2. Fetch global system voices
             handleFetchAwajVoices();
          }
        } catch (e) {
          console.error("Error fetching templates:", e);
        } finally {
          setFetchingTemplates(false);
        }
      };
      fetchTemplates();
    }
  }, [commsModal.show, commsModal.institutions, commsModal.type, handleFetchAwajVoices]);

  const fetchPaymentHistory = async (institutionId: string) => {
    setIsLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'get_payment_history',
          institution_id: institutionId
        })
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setPaymentHistory(result.history || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteHistory = async (transaction: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowConfirm({
      show: true,
      title: 'ইতিহাস মুছে ফেলুন',
      message: `${transaction.amount} ৳ এর এই পেমেন্ট রেকর্ডটি কি মুছে ফেলতে চান? এটি প্রতিষ্ঠানের ব্যালেন্সে কোনো প্রভাব ফেলবে না।`,
      onConfirm: async () => {
        setIsLoadingHistory(true);
        try {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transaction.id);
          
          if (error) throw error;
          
          if (selectedUser) fetchPaymentHistory(selectedUser.id);
          setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'ইতিহাস মুছে ফেলা হয়েছে।' });
        } catch (err: any) {
          setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
        } finally {
          setIsLoadingHistory(false);
        }
      }
    });
  };

  const handleDownloadReceipt = async (transaction: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);
      const root = createRoot(container);
      
      const ReceiptComponent = () => {
      const metadata = transaction.metadata || {};
      const months = metadata.months || [];
      const isCustomPayment = !metadata.package_name && !transaction.description?.includes('Package');
      
      return (
      <div style={{ width: '794px', minHeight: '1123px', padding: '50px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#1e293b', backgroundColor: '#fff' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f1f5f9', paddingBottom: '30px', marginBottom: '40px' }}>
          <div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#2563eb', letterSpacing: '-0.5px' }}>Deenora</div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Management System</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>Receipt</div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>#{transaction.transaction_id}</div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>{new Date(transaction.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        {/* Institution Info */}
        <div style={{ marginBottom: '40px', padding: '25px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#64748b', fontWeight: 700, marginBottom: '15px' }}>Billed To</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>{selectedUser?.name || 'Institution Name'}</div>
          <div style={{ fontSize: '15px', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px' }}>
             <span>Phone: {selectedUser?.phone || 'N/A'}</span>
          </div>
        </div>

        {/* Subscription Details Table */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: '2px solid #cbd5e1', paddingBottom: '12px', marginBottom: '16px', fontWeight: 700, color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <div>Description</div>
            <div style={{ textAlign: 'center' }}>Details</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                Subscription Payment
              </div>
              {!isCustomPayment && metadata.package_name && (
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                  Package: <span style={{ color: '#0f172a', fontWeight: 600 }}>{metadata.package_name}</span>
                </div>
              )}
              {!isCustomPayment && metadata.subscription_type && (
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                  Type: <span style={{ color: '#0f172a', fontWeight: 600, textTransform: 'capitalize' }}>{metadata.subscription_type}</span>
                </div>
              )}
              {isCustomPayment && (
                 <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                   {transaction.description}
                 </div>
              )}
            </div>
            <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 600, color: '#475569' }}>
               {!isCustomPayment && months.length > 0 ? `${months.length} Month${months.length > 1 ? 's' : ''}` : '-'}
            </div>
            <div style={{ textAlign: 'right', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
               {metadata.base_amount ? `${metadata.base_amount.toLocaleString('bn-BD')} ৳` : `${transaction.amount.toLocaleString('bn-BD')} ৳`}
            </div>
          </div>

          {months.length > 0 && !isCustomPayment && (
            <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '12px', marginTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Covered Months</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {months.map((m: string) => {
                  const [year, month] = m.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1);
                  return (
                    <span key={m} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Totals */}
        <div style={{ width: '350px', marginLeft: 'auto' }}>
          {metadata.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '15px' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{metadata.base_amount.toLocaleString('bn-BD')} ৳</span>
            </div>
          )}
          {metadata.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', color: '#ef4444', fontSize: '15px' }}>
              <span>Discount</span>
              <span style={{ fontWeight: 600 }}>-{metadata.discount.toLocaleString('bn-BD')} ৳</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: '20px', borderRadius: '12px', marginTop: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a' }}>Total Paid</span>
            <span style={{ fontSize: '24px', fontWeight: 900, color: '#2563eb' }}>{transaction.amount.toLocaleString('bn-BD')} ৳</span>
          </div>

          {metadata.due_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', marginTop: '10px', color: '#dc2626', fontSize: '15px', border: '1px dashed #fca5a5', borderRadius: '10px' }}>
              <span style={{ fontWeight: 700 }}>Due Amount (বকেয়া)</span>
              <span style={{ fontWeight: 800 }}>{metadata.due_amount.toLocaleString('bn-BD')} ৳</span>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Status</span>
            <span style={{ fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>{transaction.status}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: '50px', left: '50px', right: '50px', textAlign: 'center', borderTop: '2px solid #f1f5f9', paddingTop: '30px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Thank you for your business!</div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>This is a computer-generated receipt and requires no physical signature.</div>
        </div>
      </div>
    )};

    await new Promise<void>((resolve) => {
      root.render(<ReceiptComponent />);
      setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
    });

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      
      root.unmount();
      document.body.removeChild(container);
      
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
    } catch(err: any) {
      console.error(err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message || 'Failed to download receipt' });
    }
  };

  const [editCustomSubscriptionFee, setEditCustomSubscriptionFee] = useState<number | ''>('');
  const [editPassword, setEditPassword] = useState('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [overrideTotal, setOverrideTotal] = useState<number | ''>('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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
  const [detailsTab, setDetailsTab] = useState<'institution' | 'api' | 'permissions' | 'subscription' | 'history'>('institution');

  useEffect(() => {
    if (selectedUser?.id && (detailsTab === 'history' || view === 'details')) {
      fetchPaymentHistory(selectedUser.id);
    }
  }, [selectedUser?.id, detailsTab, view]);
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState<{show: boolean, institution: any}>({show: false, institution: null});
  const [rechargeAmount, setRechargeAmount] = useState<string>('');
  const [rechargeSmsCount, setRechargeSmsCount] = useState<string>('');
  const [isProcessingRecharge, setIsProcessingRecharge] = useState(false);
  
  const handleQuickRecharge = async (type: 'sms' | 'voice') => {
    if (!showRechargeModal.institution) return;
    setIsProcessingRecharge(true);
    try {
      const amount = type === 'voice' ? (Number(rechargeAmount) || 0) : (Number(rechargeSmsCount) || 0);
      if (amount <= 0) throw new Error('পরিমাণ সঠিক নয়');

      const { data: { session } } = await supabase.auth.getSession();
      
        const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'quick_recharge',
          id: showRechargeModal.institution.id,
          type,
          amount
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setStatusModal({
        show: true,
        type: 'success',
        title: 'সফল হয়েছে',
        message: `${type === 'voice' ? amount + ' ৳' : amount + ' SMS'} সফলভাবে যোগ করা হয়েছে।`
      });
      
      setShowRechargeModal({ show: false, institution: null });
      setRechargeAmount('');
      setRechargeSmsCount('');
      handleRefresh();
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: err.message });
    } finally {
      setIsProcessingRecharge(false);
    }
  };
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Create Institution State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstPhone, setNewInstPhone] = useState('');
  const [newInstEmail, setNewInstEmail] = useState('');
  const [newInstPassword, setNewInstPassword] = useState('');
  const [newInstType, setNewInstType] = useState<'madrasah' | 'school' | 'kindergarten' | 'choching'>('madrasah');
  const [isCreatingInst, setIsCreatingInst] = useState(false);

  const fetchDetailedReport = async (force = false) => {
    const cacheKey = `${detailedFilterMode}_${detailedMonth}_${detailedYear}_${detailedStartDate}_${detailedEndDate}`;
    if (!force && adminPanelCache.detailedReport[cacheKey]) {
      setDetailedReport(adminPanelCache.detailedReport[cacheKey]);
      return;
    }

    setDetailedReport(prev => ({ ...prev, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'get_detailed_report',
          filterMode: detailedFilterMode,
          month: detailedMonth,
          year: detailedYear,
          startDate: detailedStartDate,
          endDate: detailedEndDate
        })
      });

      if (!response.ok) throw new Error('Failed to fetch detailed report from API');
      const reportData = await response.json();
      
      const fullReport = { ...reportData, loading: false };
      adminPanelCache.detailedReport[cacheKey] = fullReport;
      setDetailedReport(fullReport);
    } catch (err) {
      console.error('Error in fetchDetailedReport API call:', err);
      // Fallback to client-side (might return 0 due to RLS)
      let startDate: Date;
      let endDate: Date;
      
      if (detailedFilterMode === 'monthly') {
        const [year, month] = detailedMonth.split('-');
        startDate = new Date(Number(year), Number(month) - 1, 1);
        endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      } else if (detailedFilterMode === 'custom') {
        startDate = new Date(detailedStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(detailedEndDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(Number(detailedYear), 0, 1);
        endDate = new Date(Number(detailedYear), 11, 31, 23, 59, 59);
      }

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const [txRes, smsLogsRes, voiceBroadcastsRes] = await Promise.all([
        supabase.from('transactions').select('id, amount, description, module, metadata, created_at, transaction_id, status, institution_id, institutions(name)').eq('status', 'approved').gte('created_at', startISO).lte('created_at', endISO).limit(10000),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('voice_broadcasts').select('total_numbers').gte('created_at', startISO).lte('created_at', endISO).limit(10000)
      ]);
      
      const transactions = txRes.data || [];
      const subRechargeTotal = transactions.filter(t => t.module === 'subscription').reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const smsRechargeTotal = transactions.filter(t => t.module === 'sms').reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const voiceRechargeTotal = transactions.filter(t => t.module === 'voice').reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const smsSentNum = smsLogsRes.count || 0;
      const voiceCallsNum = (voiceBroadcastsRes.data || []).reduce((sum, t) => sum + (Number(t.total_numbers) || 0), 0) || 0;

      const reportData = {
        smsRechargeTotal,
        voiceRechargeTotal,
        subRechargeTotal,
        smsSentNum,
        voiceCallsNum,
        transactions,
        loading: false
      };

      adminPanelCache.detailedReport[cacheKey] = reportData;
      setDetailedReport(reportData);
    }
  };

  useEffect(() => {
    if (view === 'dashboard') {
      fetchDetailedReport();
    }
  }, [detailedFilterMode, detailedMonth, detailedYear, detailedStartDate, detailedEndDate, view]);

  const handleDownloadDetailedPDF = async () => {
    let period = '';
    if (detailedFilterMode === 'monthly') {
      try {
        const [year, month] = detailedMonth.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        period = date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long' });
      } catch (e) {
        period = detailedMonth;
      }
    } else if (detailedFilterMode === 'yearly') {
      period = `${detailedYear} সাল`;
    } else if (detailedFilterMode === 'custom') {
      try {
        const startFormatted = new Date(detailedStartDate).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
        const endFormatted = new Date(detailedEndDate).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
        period = `${startFormatted} থেকে ${endFormatted}`;
      } catch (e) {
        period = `${detailedStartDate} - ${detailedEndDate}`;
      }
    }

    try {
      setStatusModal({ show: true, type: 'success', title: 'অপেক্ষা করুন', message: 'পিডিএফ রিপোর্ট তৈরি করা হচ্ছে...' });
      await generateSystemPaymentReportPDF(
        period,
        {
          smsRechargeTotal: detailedReport.smsRechargeTotal || 0,
          voiceRechargeTotal: detailedReport.voiceRechargeTotal || 0,
          subRechargeTotal: detailedReport.subRechargeTotal || 0,
          smsSentNum: detailedReport.smsSentNum || 0,
          voiceCallsNum: detailedReport.voiceCallsNum || 0,
          transactions: detailedReport.transactions || []
        },
        lang === 'bn' ? 'bn' : 'en'
      );
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'রিপোর্ট সফলভাবে ডাউনলোড করা হয়েছে।' });
    } catch (err) {
      console.error("Failed to generate detailed report PDF:", err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: 'রিপোর্ট তৈরি করতে সমস্যা হয়েছে।' });
    }
  };

  const handleDownloadSubscriptionMatrixPDF = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const [matrixYear] = (selectedMonthForReminder || '').split('-');
    const yearStr = matrixYear || new Date().getFullYear().toString();
    try {
      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: lang === 'bn' ? 'অপেক্ষা করুন' : 'Please Wait', 
        message: lang === 'bn' ? 'সাবস্ক্রিপশন ম্যাট্রিক্স পিডিএফ তৈরি করা হচ্ছে...' : 'Generating Subscription Matrix PDF...' 
      });
      await generateSubscriptionMatrixPDF(
        yearStr,
        madrasahs,
        lang === 'bn' ? 'bn' : 'en',
        (progress) => {
          setStatusModal({
            show: true,
            type: 'success',
            title: lang === 'bn' ? 'অপেক্ষা করুন' : 'Please Wait',
            message: lang === 'bn' 
              ? `সাবস্ক্রিপশন ম্যাট্রিক্স পিডিএফ তৈরি করা হচ্ছে... (${progress}%)` 
              : `Generating Subscription Matrix PDF... (${progress}%)`
          });
        }
      );
      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: lang === 'bn' ? 'সফল' : 'Success', 
        message: lang === 'bn' ? 'ম্যাট্রিক্স রিপোর্ট সফলভাবে ডাউনলোড করা হয়েছে।' : 'Matrix report downloaded successfully.' 
      });
    } catch (err: any) {
      console.error("Failed to generate subscription matrix PDF:", err);
      setStatusModal({ 
        show: true, 
        type: 'error', 
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed', 
        message: lang === 'bn' 
          ? `ম্যাট্রিক্স রিপোর্ট তৈরি করতে সমস্যা হয়েছে: ${err?.message || err || 'Unknown Error'}` 
          : `Failed to generate matrix report: ${err?.message || err || 'Unknown Error'}`
      });
    }
  };

  const fetchGlobalCounts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'get_global_stats' })
      });

      if (!response.ok) throw new Error('Failed to fetch global stats from API');
      const data = await response.json();
      
      // Also fetch pending approvals via client-side head query (usually allowed for admin/manager)
      const { count: pendingCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending').not('transaction_id', 'like', 'PENDING_%');
      
      return {
        ...data,
        pendingApprovals: pendingCount || 0
      };
    } catch (err) {
      console.error('Error in fetchGlobalCounts API call:', err);
      // Fallback to client-side (might return 0 due to RLS)
      const [studentsRes, classesRes, teachersRes, smsAllocRes, currentBalRes, pendingRes, instsRes, stockRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('sms_count, amount, module, description, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(10000),
        supabase.from('institutions').select('sms_balance, balance, is_active, institution_type').eq('is_super_admin', false),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending').not('transaction_id', 'like', 'PENDING_%'),
        supabase.from('institutions').select('*', { count: 'exact', head: true }).eq('is_super_admin', false),
        supabase.from('admin_sms_stock').select('remaining_sms').single()
      ]);

      const totalAllocated = smsAllocRes.data?.reduce((sum, t) => sum + (Number(t.sms_count) || 0), 0) || 0;
      const totalInWallets = currentBalRes.data?.reduce((sum, m) => sum + (Number(m.sms_balance) || 0), 0) || 0;
      const sentCount = Math.max(0, totalAllocated - totalInWallets);
      const activeInsts = currentBalRes.data?.filter(m => m.is_active).length || 0;

      return {
        totalStudents: studentsRes.count || 0,
        totalClasses: classesRes.count || 0,
        totalTeachers: teachersRes.count || 0,
        totalDistributedSMS: totalAllocated,
        totalSentSMS: sentCount,
        currentInUserWallets: totalInWallets,
        smsRevenue: Math.round(sentCount * 0.10),
        voiceRevenue: 0,
        subscriptionRevenue: 0,
        monthlySubscriptionRevenue: {},
        totalRevenue: 0,
        pendingApprovals: pendingRes.count || 0,
        totalInstitutions: instsRes.count || 0,
        activeInstitutions: activeInsts,
        totalVoiceBalance: 0,
        adminSMSStock: stockRes.data?.remaining_sms || 0,
        typeBreakdown: { madrasah: 0, school: 0, kindergarten: 0, choching: 0, system: 0 }
      };
    }
  };

  const fetchAllMadrasahs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'get_all_institutions' })
      });

      if (!response.ok) throw new Error('Failed to fetch institutions from API');
      const data = await response.json();
      const mList = data.institutions || [];

      return mList.map(m => ({
        ...m,
        student_count: (m as any).student_count?.[0]?.count || 0,
        class_count: (m as any).class_count?.[0]?.count || 0
      }));
    } catch (err) {
      console.error('Error in fetchAllMadrasahs API call:', err);
      // Fallback
      const { data, error } = await supabase.from('institutions')
        .select('*, student_count:students(count), class_count:classes(count)')
        .eq('is_super_admin', false)
        .neq('name', 'SYSTEM_GLOBAL_INTERNAL')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(m => ({
        ...m,
        student_count: (m as any).student_count?.[0]?.count || 0,
        class_count: (m as any).class_count?.[0]?.count || 0
      }));
    }
  };

  const fetchPendingTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*, institutions(*)').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
  };

  const fetchTransactionHistory = async (modules?: string[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    let query = supabase.from('transactions')
      .select('*, institutions(*)')
      .neq('status', 'pending')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10000);
      
    if (modules && modules.length > 0) {
      query = query.in('module', modules);
    }
    
    const { data } = await query;
    return data || [];
  };

  const enforceAutoDeactivation = async (force: boolean = false) => {
    const today = new Date();
    
    if (!force) {
      // Start from May 2026 onwards
      if (today.getFullYear() < 2026 || (today.getFullYear() === 2026 && today.getMonth() < 4)) {
         return;
      }
      // Only deactivate after the 15th
      if (today.getDate() <= 15) return;
    }
    
    const currentMonthStr = today.toISOString().slice(0, 7);
    
    const { data: allActive, error: fetchError } = await supabase
      .from('institutions')
      .select('id, config_json, name')
      .eq('is_active', true)
      .eq('is_super_admin', false)
      .neq('name', 'SYSTEM_GLOBAL_INTERNAL');
      
    if (fetchError || !allActive) return;
    
    const idsToDeactivate: string[] = [];
    for (const inst of allActive) {
      const config = typeof inst.config_json === 'string' ? JSON.parse(inst.config_json) : (inst.config_json || {});
      const paidMonths = config.paid_months || [];
      const manualActivationMonth = config.manual_activation_month;

      // Skip deactivation if manually activated this month
      if (manualActivationMonth === currentMonthStr) {
         continue;
      }

      if (!paidMonths.includes(currentMonthStr)) {
         idsToDeactivate.push(inst.id);
      }
    }

    if (idsToDeactivate.length > 0) {
      await supabase.from('institutions').update({ is_active: false }).in('id', idsToDeactivate);
    }
  };

  const toggleDeactivationMode = async () => {
    const oldVal = globalDeactivationMode;
    const newVal = !oldVal;

    // Optimistic UI update
    setGlobalDeactivationMode(newVal);
    setIsProcessingDeactivationToggle(true);

    try {
      const { data: sysInsts, error: fetchErr } = await supabase.from('institutions').select('*').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
      if (fetchErr) throw fetchErr;
      
      let sysId = sysInsts?.[0]?.id;
      if (!sysId) {
         // Create if missing
         const { data: newSys, error: insErr } = await supabase.from('institutions').insert([{
           name: 'SYSTEM_GLOBAL_INTERNAL',
           institution_type: 'system',
           is_active: true,
           is_super_admin: false,
           config_json: { auto_deactivation_enabled: newVal },
           theme: 'default'
         }]).select('id').single();
         if (insErr) throw insErr;
         sysId = newSys?.id;
      } else {
         const conf = typeof sysInsts![0].config_json === 'string' ? JSON.parse(sysInsts![0].config_json) : (sysInsts![0].config_json || {});
         conf.auto_deactivation_enabled = newVal;
         const { error: updErr } = await supabase.from('institutions').update({ config_json: conf }).eq('id', sysId);
         if (updErr) throw updErr;
      }
      
      if (newVal) {
         await enforceAutoDeactivation(true);
         await handleRefresh();
      } else {
         // Activate all when turned off
         await supabase.from('institutions').update({ is_active: true }).eq('is_super_admin', false);
         await handleRefresh();
      }
    } catch(err: any) {
      setGlobalDeactivationMode(oldVal);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: err.message || 'Error updating deactivation mode' });
    } finally {
      setIsProcessingDeactivationToggle(false);
    }
  };

  const initData = useCallback(async (silent = false, forceRefresh = false) => {
    if (forceRefresh) {
      clearAdminPanelCache();
    }

    let isMounted = true;

    // Check if we can serve from cache
    if (!forceRefresh && (view === 'list' || view === 'dashboard' || view === 'institutions')) {
      if (adminPanelCache.madrasahs && adminPanelCache.globalStats && adminPanelCache.recentInstitutions && adminPanelCache.transactionHistory) {
        setMadrasahs(adminPanelCache.madrasahs);
        setGlobalStats(adminPanelCache.globalStats);
        setRecentInstitutions(adminPanelCache.recentInstitutions);
        setTransactionHistory(adminPanelCache.transactionHistory);
        setLoading(false);
        silent = true; // Still update silently in background
      }
    } else if (!forceRefresh && view === 'approvals') {
      if (adminPanelCache.pendingTrans && adminPanelCache.transactionHistory) {
        setPendingTrans(adminPanelCache.pendingTrans);
        setTransactionHistory(adminPanelCache.transactionHistory);
        setLoading(false);
        silent = true; // Still update silently in background
      }
    }

    if (!silent) setLoading(true);
    try {
      // Always fetch packages to ensure latest rates
      fetchPackages();

      if (isManager && isMounted) {
        try {
          const settings = await smsApi.getGlobalSettings();
          if (settings && settings.manager_permissions) {
            setManagerPermissions(settings.manager_permissions);
          }
        } catch (err) {
          console.error("Error loading manager permissions in initData:", err);
        }
      }

      const { data: sysInst } = await supabase.from('institutions').select('config_json').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
      let isAutoDeact = false;
      if (sysInst && sysInst[0]) {
         const conf = typeof sysInst[0].config_json === 'string' ? JSON.parse(sysInst[0].config_json) : (sysInst[0].config_json || {});
         isAutoDeact = !!conf.auto_deactivation_enabled;
         if (isMounted) setGlobalDeactivationMode(isAutoDeact);
      }
      
      if (isAutoDeact) {
         await enforceAutoDeactivation();
      }

      if (view === 'list' || view === 'dashboard' || view === 'institutions') {
        const [mList, gStats, recent, history] = await Promise.all([
          fetchAllMadrasahs(),
          fetchGlobalCounts(),
          supabase.from('institutions').select('*, student_count:students(count)').eq('is_super_admin', false).neq('name', 'SYSTEM_GLOBAL_INTERNAL').order('created_at', { ascending: false }).limit(5),
          fetchTransactionHistory(['subscription']) // Dashboard only shows subscriptions
        ]);
        if (isMounted) {
          const mappedRecent = (recent.data || []).map(m => ({
            ...m,
            student_count: (m as any).student_count?.[0]?.count || 0
          }));

          // Update Cache
          adminPanelCache.madrasahs = mList;
          adminPanelCache.globalStats = gStats;
          adminPanelCache.recentInstitutions = mappedRecent;
          adminPanelCache.transactionHistory = history;
          adminPanelCache.lastFetched = Date.now();

          setMadrasahs(mList);
          setGlobalStats(gStats);
          setRecentInstitutions(mappedRecent);
          setTransactionHistory(history);
        }
      }
      if (view === 'approvals') {
        const [pTrans, tHist] = await Promise.all([
          fetchPendingTransactions(),
          fetchTransactionHistory() // Fetch all requests from last 30 days
        ]);
        if (isMounted) {
          // Update Cache
          adminPanelCache.pendingTrans = pTrans;
          adminPanelCache.transactionHistory = tHist;
          adminPanelCache.lastFetched = Date.now();

          setPendingTrans(pTrans);
          setTransactionHistory(tHist);
          const newSmsMap = { ...smsEnabledMap };
          const newSmsToCredit = { ...smsToCredit };
          pTrans.forEach(tr => {
            if (newSmsMap[tr.id] === undefined) newSmsMap[tr.id] = true;
            if (!newSmsToCredit[tr.id] && tr.module === 'sms') {
              const rate = Number(tr.institutions?.sms_rate || 0.50);
              newSmsToCredit[tr.id] = String(Math.ceil(tr.amount / rate));
            }
          });
          setSmsEnabledMap(newSmsMap);
          setSmsToCredit(newSmsToCredit);
        }
      }
      if (view === 'details' && selectedUser) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ action: 'get_user_stats', id: selectedUser.id })
          });
          const result = await res.json();
          if (isMounted && result.students !== undefined) {
            setUserStats({
              students: result.students,
              classes: result.classes
            });
          }
        } catch (e) {
          console.error("Error fetching user stats in initData:", e);
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
      await initData(true, true); // silent refresh, bypass/clear cache
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
    else if (currentView === 'institutions') setView('institutions');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

  const [expandedInstituteId, setExpandedInstituteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [instFilterMonth, setInstFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [instPaymentFilter, setInstPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, filterType, instFilterMonth, instPaymentFilter]);

  // Bulk Communication State
  const [bulkMessage, setBulkMessage] = useState('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkType, setBulkType] = useState<'sms' | 'voice'>('sms');
  const [selectedMonthForReminder, setSelectedMonthForReminder] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [smsTarget, setSmsTarget] = useState<'admin' | 'students'>('admin');
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  const unpaidInstitutions = useMemo(() => {
    return madrasahs.filter(m => {
      let config: any = m.config_json;
      if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch (e) { config = {}; }
      }
      const paidMonths = config?.paid_months || [];
      return !paidMonths.includes(selectedMonthForReminder);
    });
  }, [madrasahs, selectedMonthForReminder]);

  const handleSendBulk = async () => {
    if (!bulkMessage.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'বার্তা লিখুন' });
      return;
    }

    const targets = madrasahs.filter(m => m.phone).map(m => m.phone as string);
    if (targets.length === 0) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'কোনো বৈধ ফোন নম্বর পাওয়া যায়নি' });
      return;
    }

    setIsSendingBulk(true);
    try {
      if (bulkType === 'sms') {
        const sendPromises = targets.map(phone => smsApi.sendDirect(phone, bulkMessage, madrasah?.id));
        await Promise.all(sendPromises);
        setStatusModal({ show: true, type: 'success', title: 'সফল', message: `${targets.length} টি প্রতিষ্ঠানে এসএমএস পাঠানো হয়েছে` });
      } else {
        setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'ভয়েস কল রিকোয়েস্ট পাঠানো হয়েছে (সিস্টেম প্রসেস করবে)' });
      }
      setBulkMessage('');
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsSendingBulk(false);
    }
  };

  const handleSendSpecificComm = async () => {
    if (commsModal.institutions.length === 0) return;
    
    if (commsModal.type === 'sms' && !commMessage.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'বার্তা লিখুন' });
      return;
    }
    
    if (commsModal.type === 'voice' && !selectedCommVoiceId) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'ভয়েস টেমপ্লেট নির্বাচন করুন' });
      return;
    }

    setIsSendingComm(true);
    try {
      const targets = commsModal.institutions.filter(inst => !!inst.phone);
      if (targets.length === 0) throw new Error('কোনো বৈধ ফোন নম্বর পাওয়া যায়নি');

      if (commsModal.type === 'sms') {
        let allStudents: any[] = [];
        if (smsTarget === 'students') {
          // Fetch all students for targeted institutions
          const instIds = targets.map(t => t.id);
          const { data, error: studentsError } = await supabase
            .from('profiles')
            .select('phone, full_name, father_name, class_id')
            .in('institution_id', instIds)
            .eq('role', 'student');
          
          if (studentsError) throw studentsError;
          allStudents = data || [];
          
          if (allStudents.length === 0) {
            throw new Error('নির্বাচিত প্রতিষ্ঠানে কোনো শিক্ষার্থী পাওয়া যায়নি');
          }
        }

        const sendPromises = [];
        const CHUNK_SIZE = 25; // Send in chunks to avoid browser/API rate limits
        
        if (smsTarget === 'admin') {
          // Process in chunks
          for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
            const chunk = targets.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(inst => {
              const personalizedMsg = commMessage.replace(/{{name}}/g, inst.name || '');
              return smsApi.sendDirect(inst.phone!, personalizedMsg, madrasah?.id);
            });
            await Promise.all(chunkPromises);
          }
        } else {
          // Chunked send to students
          for (let i = 0; i < allStudents.length; i += CHUNK_SIZE) {
            const chunk = allStudents.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(student => {
              if (student.phone) {
                const personalizedMsg = commMessage
                  .replace(/{{name}}/g, student.full_name || '')
                  .replace(/{{father}}/g, student.father_name || '');
                return smsApi.sendDirect(student.phone, personalizedMsg, madrasah?.id);
              }
              return Promise.resolve();
            });
            await Promise.all(chunkPromises);
          }
        }

        setStatusModal({ 
          show: true, 
          type: 'success', 
          title: 'সফল', 
          message: smsTarget === 'admin' 
            ? `${targets.length} টি প্রতিষ্ঠানে এসএমএস পাঠানো হয়েছে` 
            : `${allStudents.length} জন শিক্ষার্থীর কাছে এসএমএস পাঠানো হয়েছে`
        });
      } else {
        // Voice Broadcast for multiple institutions
        let voiceName = '';
        if (selectedCommVoiceId.startsWith('inst_')) {
          const instVoiceId = selectedCommVoiceId.replace('inst_', '');
          const voice = instVoiceTemplates.find(v => v.id === instVoiceId);
          if (!voice) throw new Error('Selected institution voice not found.');
          voiceName = voice.provider_voice_name || voice.title;
        } else {
          const voice = awajVoices.find(v => v.id.toString() === selectedCommVoiceId);
          if (!voice) throw new Error('Selected system voice not found.');
          voiceName = voice.provider_voice_name || voice.title;
        }

        const targetPhones = [...new Set(targets.map(inst => {
          const digits = inst.phone!.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('880')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        }).filter(p => p.length === 11))];

        const payload = {
          request_id: crypto.randomUUID(),
          voice: voiceName,
          sender: '8804445629106', // Default sender for admin
          phone_numbers: targetPhones
        };

        const response = await fetch('/api/awaj/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          let errMessage = errData.error || errData.message || 'Failed to initiate voice call';
          if (errData.details) {
              errMessage += ' - ' + (typeof errData.details === 'string' ? errData.details : JSON.stringify(errData.details));
          }
          throw new Error(errMessage);
        }

        setStatusModal({ 
          show: true, 
          type: 'success', 
          title: 'সফল', 
          message: `${targets.length} টি প্রতিষ্ঠানে ভয়েস কল পাঠানো হয়েছে` 
        });
      }
      setCommsModal({ ...commsModal, show: false });
      setCommMessage('');
      setSelectedCommVoiceId('');
      setSelectedInstIds([]);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsSendingComm(false);
    }
  };

  // Sorting for Institutes Tab
  const sortedInstitutions = useMemo(() => {
    return [...madrasahs].filter(m => {
      const search = searchTerm.toLowerCase();
      const code = (m.config_json as any)?.institute_code || '';
      
      const matchesSearch = (m.name?.toLowerCase().includes(search) || 
                             m.phone?.includes(search) || 
                             code.includes(search));
                             
      if (!matchesSearch) return false;

      // Payment Filter logic
      if (instPaymentFilter !== 'all') {
        let config: any = m.config_json;
        if (typeof config === 'string') {
          try { config = JSON.parse(config); } catch (e) { config = {}; }
        }
        const paidMonths = config?.paid_months || [];
        const isPaid = paidMonths.includes(instFilterMonth);
        
        if (instPaymentFilter === 'paid' && !isPaid) return false;
        if (instPaymentFilter === 'unpaid' && isPaid) return false;
      }
      
      return true;
    }).sort((a, b) => {
      const codeA = (a.config_json as any)?.institute_code || '';
      const codeB = (b.config_json as any)?.institute_code || '';
      return codeA.localeCompare(codeB, 'en', { numeric: true });
    });
  }, [madrasahs, searchTerm, instFilterMonth, instPaymentFilter]);

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

    setEditStudentLimit(userConfig?.student_limit !== undefined ? Number(userConfig.student_limit) : 200);
    setEditPassword(userConfig?.user_pin || '');

    const userModules = { ...(userConfig?.modules || {}) };
    delete userModules.fees;
    delete userModules.results;
    delete userModules.admit_card;
    delete userModules.seat_plan;
    delete userModules.exam_routine;
    delete userModules.sensitive;

    const isExamActive = 
      userConfig?.modules?.exam ?? 
      userConfig?.modules?.results ?? 
      userConfig?.modules?.admit_card ?? 
      userConfig?.modules?.seat_plan ?? 
      userConfig?.modules?.exam_routine ?? 
      true;

    setEditModules({
      attendance: true,
      exam: isExamActive,
      accounting: true,
      library: false,
      academic_year_promotion: false,
      voice_broadcast: true,
      sms: true,
      messages: false,
      class_routine: false,
      certificates: true,
      id_cards: false,
      student_photo: false,
      parent_portal: false,
      backup_restore: false,
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
    setEditFeeStructure(userConfig?.fee_structure || 'monthly');
    setEditInstitutionType(user.institution_type || 'madrasah');
    setEditFeeEngine(userConfig?.fee_engine || 'school');
    setEditAccountingMode(userConfig?.accounting_mode || 'school_system');
    setEditReveApiKey(user.reve_api_key || '');
    setEditReveSecretKey(user.reve_secret_key || '');
    setEditReveClientId(user.reve_client_id || '');
    setEditInstituteCode(userConfig?.institute_code || '');
    setEditSmsRate(user.sms_rate || 0.50);
    setEditVoiceRate(user.voice_rate || 0.50);
    setEditPaidMonths(userConfig?.paid_months || []);
    setEditPackageRate(userConfig?.package_rate || 0);
    setEditPackageName(userConfig?.package_name || '');
    setEditSubscriptionNote(userConfig?.subscription_note || '');
    setEditCustomSubscriptionFee(user.custom_subscription_fee || '');
    setEditDueAmount(userConfig?.due_amount || 0);
    setEditDiscount(0);
    setOverrideTotal('');
    
    // Refresh packages to ensure they match Super Admin settings
    fetchPackages();
    
    setView('details');
    fetchPaymentHistory(user.id);
    
    // Fetch user stats
    setUserStats({ 
      students: (user as any).student_count || 0, 
      classes: (user as any).class_count || 0 
    });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
        const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'get_user_stats', id: user.id })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.students !== undefined) {
          setUserStats({
            students: result.students,
            classes: result.classes
          });
        }
      }
    } catch (e) {
      console.error("Error fetching user stats:", e);
    }
  };

  // Fix: Add missing handleUserUpdate function to save changes to madrasah profile
  const handleUserUpdate = async () => {
    if (!selectedUser) return;
    setIsUpdatingUser(true);
    try {
      // Fetch latest config_json to avoid overwriting academic year setup
      const { data: latestInst, error: fetchError } = await supabase
        .from('institutions')
        .select('config_json')
        .eq('id', selectedUser.id)
        .single();
        
      if (fetchError) throw fetchError;
      
      let latestConfig: any = latestInst?.config_json;
      if (typeof latestConfig === 'string') {
        try { latestConfig = JSON.parse(latestConfig); } catch (e) { latestConfig = {}; }
      }
      latestConfig = typeof latestConfig === 'object' && latestConfig !== null ? latestConfig : {};

      if (!selectedUser.is_active && editActive) {
         latestConfig.manual_activation_month = new Date().toISOString().slice(0, 7);
      }

      const syncedModules = { ...editModules };
      delete syncedModules.sensitive;
      if (syncedModules.exam !== undefined) {
        syncedModules.results = syncedModules.exam;
        syncedModules.admit_card = syncedModules.exam;
        syncedModules.seat_plan = syncedModules.exam;
        syncedModules.exam_routine = syncedModules.exam;
      }

      console.log('Saving config_json:', {
        modules: syncedModules,
        result_engine: editResultEngine,
        result_system: editResultSystem,
        fee_structure: editFeeStructure,
        fee_engine: editFeeEngine,
        accounting_mode: editAccountingMode
      });
      const { data: { session } } = await supabase.auth.getSession();
      
        const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_institution',
          id: selectedUser.id,
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
          address: editAddress.trim() || null,
          is_active: editActive,
          sms_balance: Math.floor(Number(editSmsBalance) || 0),
          balance: Number(editBalance) || 0,
          voice_sender_id: editVoiceSenderId.trim() || null,
          institution_type: editInstitutionType,
          subscription_end: editSubscriptionEnd || null,
          status: editStatus,
          reve_api_key: editReveApiKey.trim() || null,
          reve_secret_key: editReveSecretKey.trim() || null,
          reve_client_id: editReveClientId.trim() || null,
          sms_rate: Number(editSmsRate) || 0.50,
          voice_rate: Number(editVoiceRate) || 0.50,
          custom_subscription_fee: editCustomSubscriptionFee === '' ? null : Number(editCustomSubscriptionFee),
          institute_code: editInstituteCode.trim(),
          config_json: {
            ...latestConfig,
            modules: syncedModules,
            result_engine: editResultEngine,
            result_system: editResultSystem,
            fee_structure: editFeeStructure,
            subscription_type: editSubscriptionType,
            fee_engine: editFeeEngine,
            accounting_mode: editAccountingMode,
            paid_months: editPaidMonths,
            package_rate: editPackageRate,
            package_name: editPackageName,
            subscription_note: editSubscriptionNote,
            due_amount: editDueAmount,
            student_limit: editStudentLimit,
            institute_code: editInstituteCode.trim(),
            user_pin: editPassword.trim()
          }
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
      const data = result.data ? [result.data] : [];
      
      console.log('Update result data:', data);
      
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
      
      // Invalidate cache for this institution
      if (selectedUser?.id) {
          requestManager.invalidate(`institution:${selectedUser.id}`);
      }

      setEditPassword('');
      initData(true, true);
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
          initData(false, true);
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
    const isSubscription = tr.module === 'subscription';
    const sms = Math.ceil(Number(smsToCredit[tr.id]) || 0);
    
    // Check for corrected amount
    const finalAmount = correctionAmounts[tr.id] ? Number(correctionAmounts[tr.id]) : Number(tr.amount);

    if (!isVoice && !isSubscription && (!sms || sms <= 0)) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সঠিক SMS সংখ্যা লিখুন' });
      return;
    }
    
    setApprovingIds(prev => new Set(prev).add(tr.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
        const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'approve_transaction',
          id: tr.id,
          status: 'approved',
          amount: isSubscription || isVoice ? finalAmount : sms,
          institution_id: tr.institution_id,
          module: isSubscription ? 'subscription' : (isVoice ? 'voice' : 'sms'),
          metadata: tr.metadata
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      // SMS Notification
      // ৩. লোকাল স্টেট আপডেট করা (সফল হলে সাথে সাথে লিস্ট থেকে সরিয়ে দেয়া)
      setPendingTrans(prev => prev.filter(p => p.id !== tr.id));
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'পেমেন্ট রিকোয়েস্ট অনুমোদন করা হয়েছে' });
      initData(true, true);
    } catch (err: any) {
      console.error('Error approving transaction:', err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
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
      const { data: { session } } = await supabase.auth.getSession();
      
        const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'approve_transaction',
          id: rejectConfirm.id,
          status: 'rejected'
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
      const userPhone = rejectConfirm.institutions?.phone || rejectConfirm.sender_phone;
      if (userPhone) {
        const msg = `Assalamu Alaikum, Sorry, your payment request of (${rejectConfirm.amount}tk) has been rejected. Please contact for details. Thank you.`;
        smsApi.sendDirect(userPhone, msg, madrasah?.id).catch(err => console.error("SMS Send Error:", err));
      }

      setPendingTrans(prev => prev.filter(p => p.id !== rejectConfirm.id));
      setRejectConfirm(null);
      setStatusModal({ show: true, type: 'success', title: 'বাতিল', message: 'পেমেন্ট রিকোয়েস্ট বাতিল করা হয়েছে' });
      initData(true, true);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsRejecting(false);
    }
  };

  const toggleSmsForRequest = (id: string) => {
    setSmsEnabledMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  const handleSyncToSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'sync_all_to_sheet'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync with Google Sheet');
      }
      
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: `মোট ${result.count || 0} টি প্রতিষ্ঠানের ডাটা গুগল শিটে পাঠানো হয়েছে।` });
    } catch (err: any) {
      console.error("Sync Error:", err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const activateRoutineForAll = async () => {
    if (!confirm('Are you sure you want to activate Class Routine for ALL institutions?')) return;
    setIsRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'activate_module_for_all',
          module_name: 'class_routine'
        })
      });
  
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to activate module');
      
      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: 'সফল', 
        message: `সবার জন্য ক্লাস রুটিন মডিউল অ্যাক্টিভ করা হয়েছে। (আপডেট করা হয়েছে: ${result.updated} টি প্রতিষ্ঠান)` 
      });
      initData(true, true);
    } catch (err: any) {
       setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
       setIsRefreshing(false);
    }
  };

  const handleCreateInstitution = async () => {
    if (!newInstName.trim() || !newInstPhone.trim() || !newInstEmail.trim() || !newInstPassword.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'নাম, ফোন, ইমেইল এবং পাসওয়ার্ড আবশ্যক' });
      return;
    }
    
    setIsCreatingInst(true);
    try {
      // Use the Admin API for reliable user creation without affecting current session
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'create_institution',
          name: newInstName.trim(),
          phone: newInstPhone.trim(),
          email: newInstEmail.trim(),
          password: newInstPassword.trim(),
          institution_type: newInstType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create institution');
      }
      
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'নতুন প্রতিষ্ঠান এবং ইউজার তৈরি করা হয়েছে।' });
      setShowCreateModal(false);
      setNewInstName('');
      setNewInstPhone('');
      setNewInstEmail('');
      setNewInstPassword('');
      initData(true, true);
    } catch (err: any) {
      console.error("Create Error:", err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsCreatingInst(false);
    }
  };

  const filtered = useMemo(() => madrasahs.filter(m => {
    const query = (searchQuery || '').toLowerCase();
    const config = m.config_json as any || {};
    const matchesSearch = 
      (m.name || '').toLowerCase().includes(query) || 
      (m.phone || '').toLowerCase().includes(query) || 
      (config?.institute_code || '').toLowerCase().includes(query);
    const matchesType = filterType === 'all' || 
                        (filterType === '200plus' ? (m.student_count || 0) >= 200 : (m.institution_type || 'madrasah') === filterType);
    
    let matchesPayment = true;
    if (instPaymentFilter !== 'all') {
      const paidMonths = config.paid_months || [];
      const isPaid = paidMonths.includes(instFilterMonth);
      if (instPaymentFilter === 'paid' && !isPaid) matchesPayment = false;
      if (instPaymentFilter === 'unpaid' && isPaid) matchesPayment = false;
    }

    return matchesSearch && matchesType && matchesPayment;
  }), [madrasahs, searchQuery, filterType, instFilterMonth, instPaymentFilter]);

  return (
    <div className={`min-h-screen pb-24 animate-in fade-in relative ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
          <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">System Initializing...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          {view === 'dashboard' && (
            <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-10">
              <div className="flex items-center justify-between gap-4">
                 <div>
                    <h1 className={`text-xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto tracking-tight`}>সিস্টেম ড্যাশবোর্ড</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time System Overview</p>
                 </div>
                 <button onClick={handleRefresh} disabled={isRefreshing} className={`w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-white text-blue-600 border-slate-200'} rounded-xl md:rounded-2xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                 </button>
              </div>

              {/* Core System-wide Entity Metrics (All At Top) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                {/* Portals count */}
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border flex items-center gap-3 md:gap-4 group hover:border-blue-500/30 transition-all duration-300`}>
                   <div className={`w-10 h-10 md:w-12 md:h-12 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-500'} rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                     <Building2 size={20} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Portals</p>
                     <h4 className={`text-lg md:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{globalStats.totalInstitutions.toLocaleString('bn-BD')}</h4>
                   </div>
                </div>

                {/* Active count */}
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border flex items-center gap-3 md:gap-4 group hover:border-emerald-500/30 transition-all duration-300`}>
                   <div className={`w-10 h-10 md:w-12 md:h-12 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'} rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                     <Activity size={20} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Active</p>
                     <h4 className={`text-lg md:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{globalStats.activeInstitutions.toLocaleString('bn-BD')}</h4>
                   </div>
                </div>

                {/* Total System Students */}
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border flex items-center gap-3 md:gap-4 group hover:border-blue-500/30 transition-all duration-300`}>
                   <div className={`w-10 h-10 md:w-12 md:h-12 ${madrasah?.theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-500'} rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                     <GraduationCap size={20} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Students</p>
                     <h4 className={`text-lg md:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{globalStats.totalStudents.toLocaleString('bn-BD')}</h4>
                   </div>
                </div>

                {/* Total Classrooms */}
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border flex items-center gap-3 md:gap-4 group hover:border-orange-500/30 transition-all duration-300`}>
                   <div className={`w-10 h-10 md:w-12 md:h-12 ${madrasah?.theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-50 text-orange-500'} rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                     <Layers size={20} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Classrooms</p>
                     <h4 className={`text-lg md:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{globalStats.totalClasses.toLocaleString('bn-BD')}</h4>
                   </div>
                </div>

                {/* Registered Teachers */}
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border flex items-center gap-3 md:gap-4 col-span-2 md:col-span-1 group hover:border-emerald-500/30 transition-all duration-300`}>
                   <div className={`w-10 h-10 md:w-12 md:h-12 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'} rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                     <BookOpen size={20} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Teachers</p>
                     <h4 className={`text-lg md:text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{globalStats.totalTeachers.toLocaleString('bn-BD')}</h4>
                   </div>
                </div>
              </div>

              {/* Bento Grid layout for Revenue and Approvals */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Revenue Overview - Span 8 */}
                {isSuperAdmin && (
                  <div className={`lg:col-span-8 ${madrasah?.theme === 'dark' ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-800' : 'bg-gradient-to-br from-blue-900 to-[#1E3A8A] border-blue-800 shadow-xl'} p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border flex flex-col justify-between overflow-hidden relative group`}>
                    {/* Decorative circle */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>
                    
                    <div className="mb-8 relative z-10">
                      <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-blue-200'}`}>Total System Revenue (Net)</p>
                      <h2 className={`text-3xl md:text-5xl font-black mt-2 text-white tabular-nums`}>৳ {globalStats.totalRevenue?.toLocaleString('bn-BD') || 0}</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 relative z-10 w-full">
                       <div className={`p-4 md:p-5 rounded-2xl md:rounded-3xl ${madrasah?.theme === 'dark' ? 'bg-slate-900/50' : 'bg-white/10 backdrop-blur-md'} border ${madrasah?.theme === 'dark' ? 'border-slate-700' : 'border-white/10'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare size={14} className={madrasah?.theme === 'dark' ? 'text-purple-400' : 'text-purple-300'} />
                            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-300">SMS Profit</p>
                          </div>
                          <h4 className="text-xl md:text-2xl font-bold text-white tabular-nums">৳ {globalStats.smsRevenue?.toLocaleString('bn-BD') || 0}</h4>
                       </div>
                       <div className={`p-4 md:p-5 rounded-2xl md:rounded-3xl ${madrasah?.theme === 'dark' ? 'bg-slate-900/50' : 'bg-white/10 backdrop-blur-md'} border ${madrasah?.theme === 'dark' ? 'border-slate-700' : 'border-white/10'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Mic size={14} className={madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-300'} />
                            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-300">Voice Profit</p>
                          </div>
                          <h4 className="text-xl md:text-2xl font-bold text-white tabular-nums">৳ {globalStats.voiceRevenue?.toLocaleString('bn-BD') || 0}</h4>
                       </div>
                       <div className={`p-4 md:p-5 rounded-2xl md:rounded-3xl ${madrasah?.theme === 'dark' ? 'bg-slate-900/50' : 'bg-white/10 backdrop-blur-md'} border ${madrasah?.theme === 'dark' ? 'border-slate-700' : 'border-white/10'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Banknote size={14} className={madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-300'} />
                            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-300">Sub. Revenue</p>
                          </div>
                          <h4 className="text-xl md:text-2xl font-bold text-white tabular-nums">৳ {globalStats.subscriptionRevenue?.toLocaleString('bn-BD') || 0}</h4>
                       </div>
                    </div>
                  </div>
                )}

                {/* Approvals - Span 4 */}
                <div className={`${isSuperAdmin ? 'lg:col-span-4' : 'lg:col-span-12'} flex flex-col justify-stretch`}>
                  <div onClick={() => setView('approvals')} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none hover:border-yellow-900' : 'bg-white border-slate-100 shadow-premium hover:border-yellow-200 hover:shadow-xl'} p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border flex flex-col justify-between cursor-pointer transition-all active:scale-95 group h-full`}>
                      <div className="flex items-start justify-between w-full">
                        <div>
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Requests</p>
                          <h4 className={`text-3xl md:text-5xl font-black ${globalStats.pendingApprovals > 0 ? 'text-yellow-500' : (madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>{globalStats.pendingApprovals}</h4>
                        </div>
                        <div className={`w-12 h-12 md:w-16 md:h-16 ${madrasah?.theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-500'} rounded-[1rem] md:rounded-[1.5rem] flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all`}>
                          <CreditCard size={24} className="md:size-7" />
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-dashed border-slate-200/50 w-full flex items-center justify-between text-slate-400 group-hover:text-amber-500 transition-colors">
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">পেন্ডিং পেমেন্ট আ্যপ্রুভ করুন</span>
                        <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                      </div>
                  </div>
                </div>
              </div>

              {/* Detailed Filter Section */}
              {!isManager && (
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-premium'} p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border space-y-6`}>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1 w-full md:w-auto text-center md:text-left">
                      <h3 className={`text-lg md:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>সিস্টেম আয় রিপোর্ট</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1">
                        {detailedReport.loading && <RefreshCw size={12} className="animate-spin text-blue-500" />}
                        <span>System Revenue & Usage Report</span>
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                      <select
                        value={detailedFilterMode}
                        onChange={(e) => setDetailedFilterMode(e.target.value as 'monthly' | 'yearly' | 'custom')}
                        className={`w-full sm:w-auto text-[11px] font-black py-2.5 px-3 rounded-xl border cursor-pointer outline-none transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'}`}
                      >
                        <option value="monthly">মাসিক (Monthly)</option>
                        <option value="yearly">বাৎসরিক (Yearly)</option>
                        <option value="custom">কাস্টম (Custom)</option>
                      </select>
                      {detailedFilterMode === 'monthly' && (
                        <input
                          type="month"
                          value={detailedMonth}
                          onChange={(e) => setDetailedMonth(e.target.value)}
                          className={`w-full sm:w-auto text-[11px] font-black py-2.5 px-3 rounded-xl border cursor-pointer outline-none transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'}`}
                        />
                      )}
                      {detailedFilterMode === 'yearly' && (
                        <select
                          value={detailedYear}
                          onChange={(e) => setDetailedYear(e.target.value)}
                          className={`w-full sm:w-auto text-[11px] font-black py-2.5 px-3 rounded-xl border cursor-pointer outline-none transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'}`}
                        >
                          {Array.from({ length: 5 }).map((_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <option key={year} value={year}>{year}</option>;
                          })}
                        </select>
                      )}
                      {detailedFilterMode === 'custom' && (
                        <div className="flex items-center gap-1 w-full sm:w-auto">
                          <input
                            type="date"
                            value={detailedStartDate}
                            onChange={(e) => setDetailedStartDate(e.target.value)}
                            className={`w-full sm:w-auto text-[11px] font-black py-2 px-2.5 rounded-xl border cursor-pointer outline-none transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'}`}
                          />
                          <span className={`text-[10px] font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>থেকে</span>
                          <input
                            type="date"
                            value={detailedEndDate}
                            onChange={(e) => setDetailedEndDate(e.target.value)}
                            className={`w-full sm:w-auto text-[11px] font-black py-2 px-2.5 rounded-xl border cursor-pointer outline-none transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'}`}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleDownloadDetailedPDF}
                        disabled={detailedReport.loading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 text-[11px] font-black py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        <Download size={14} />
                        <span>PDF ডাউনলোড</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] border flex flex-col gap-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-amber-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-wider">সাবস্ক্রিপশন ফি</span>
                      </div>
                      <p className={`text-base md:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} tabular-nums`}>৳ {(detailedReport.subRechargeTotal || 0).toLocaleString('bn-BD')}</p>
                    </div>
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] border flex flex-col gap-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-blue-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-wider">SMS রিচার্জ</span>
                      </div>
                      <p className={`text-base md:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} tabular-nums`}>৳ {detailedReport.smsRechargeTotal.toLocaleString('bn-BD')}</p>
                    </div>
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] border flex flex-col gap-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <Mic size={14} className="text-emerald-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-wider">VOICE রিচার্জ</span>
                      </div>
                      <p className={`text-base md:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} tabular-nums`}>৳ {detailedReport.voiceRechargeTotal.toLocaleString('bn-BD')}</p>
                    </div>
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] border flex flex-col gap-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-purple-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-wider">মোট SMS</span>
                      </div>
                      <p className={`text-base md:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} tabular-nums`}>{detailedReport.smsSentNum.toLocaleString('bn-BD')}</p>
                    </div>
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] border flex flex-col gap-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} col-span-2 md:col-span-1`}>
                      <div className="flex items-center gap-2">
                        <Megaphone size={14} className="text-orange-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-wider">ভয়েস কল</span>
                      </div>
                      <p className={`text-base md:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} tabular-nums`}>{detailedReport.voiceCallsNum.toLocaleString('bn-BD')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Subscription tracking and SMS Inventory Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                   <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>সাবস্ক্রিপশন রিমাইন্ডার</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subscription Tracking</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="month" 
                          value={selectedMonthForReminder}
                          onChange={(e) => setSelectedMonthForReminder(e.target.value)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'} outline-none border focus:border-blue-500/50 transition-all`}
                        />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-emerald-50 border-emerald-100'} p-5 rounded-3xl border text-center`}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">পেইড হয়েছে</p>
                        <h5 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{globalStats.totalInstitutions - unpaidInstitutions.length}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-red-50 border-red-100'} p-5 rounded-3xl border text-center shadow-inner`}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">বাকি আছে</p>
                        <h5 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{unpaidInstitutions.length}</h5>
                      </div>
                   </div>

                    <button 
                      type="button"
                      onClick={(e) => handleDownloadSubscriptionMatrixPDF(e)}
                      className="w-full min-h-[48px] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-md hover:shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mb-2"
                    >
                      <Download size={14} />
                      <span>পেমেন্ট ও বকেয়া ম্যাট্রিক্স (PDF)</span>
                    </button>

                   {unpaidInstitutions.length > 0 && (
                     <div className="flex gap-3 relative z-[100]">
                       <button 
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           if (!unpaidInstitutions || unpaidInstitutions.length === 0) return;
                           
                           let monthLabel = '';
                           try {
                              const [rYear, rMonth] = selectedMonthForReminder.split('-');
                              const date = new Date(parseInt(rYear), parseInt(rMonth) - 1);
                              monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                           } catch (e) {
                              monthLabel = selectedMonthForReminder;
                           }
                           
                           const msg = `Assalamu Alaikum, {{name}}. Your institution's subscription fee for ${monthLabel} has not been paid yet. Please pay as soon as possible. Thank you.`;
                           
                           if (onNavigateToSMSBroadcast) {
                             onNavigateToSMSBroadcast(unpaidInstitutions.map(inst => inst.id), msg);
                           } else {
                             setCommMessage(msg);
                             setCommsModal({ show: true, institutions: [...unpaidInstitutions], type: 'sms' });
                           }
                         }}
                         className="flex-1 min-h-[56px] py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer relative z-[110]"
                       >
                         <MessageSquare size={16} /> SMS রিমাইন্ডার
                       </button>
                       <button 
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           if (!unpaidInstitutions || unpaidInstitutions.length === 0) return;
                           
                           if (onNavigateToVoiceBroadcast) {
                             onNavigateToVoiceBroadcast(unpaidInstitutions.map(inst => inst.id));
                           } else {
                             if (awajVoices.length === 0) handleFetchAwajVoices();
                             setCommsModal({ show: true, institutions: [...unpaidInstitutions], type: 'voice' });
                           }
                         }}
                         className="flex-1 min-h-[56px] py-4 bg-orange-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer relative z-[110]"
                       >
                         <Mic size={16} /> ভয়েস রিমাইন্ডার
                       </button>
                     </div>
                   )}
                </div>

                {/* SMS Inventory */}
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
              </div>

              {/* Side-by-side Layout of System Breakdown and Monthly Income histories (With Recent Portals and Transactions cleanly removed) */}
              <div className={`grid grid-cols-1 ${isSuperAdmin ? 'md:grid-cols-2' : ''} gap-4`}>
                {/* System Breakdown */}
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

                {/* Monthly Subscription Income */}
                {isSuperAdmin && (
                  <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>মাসিক সাবস্ক্রিপশন আয়</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">সাবস্ক্রিপশন পেমেন্ট হিস্ট্রি</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select 
                        value={selectedRevMonth}
                        onChange={(e) => setSelectedRevMonth(e.target.value)}
                        className={`text-[10px] font-black py-2 px-3 rounded-xl border appearance-none cursor-pointer transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}
                      >
                        <option value="all">{lang === 'bn' ? 'সকল মাস' : 'All Months'}</option>
                        {Object.keys(globalStats.monthlySubscriptionRevenue)
                          .sort((a, b) => b.localeCompare(a))
                          .map(monthKey => {
                            const [year, month] = monthKey.split('-');
                            const date = new Date(parseInt(year), parseInt(month) - 1);
                            const monthName = date.toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' });
                            return <option key={monthKey} value={monthKey}>{monthName}</option>;
                          })
                        }
                      </select>
                      <TrendingUp size={20} className="text-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(globalStats.monthlySubscriptionRevenue)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .filter(([monthKey]) => selectedRevMonth === 'all' || monthKey === selectedRevMonth)
                      .map(([monthKey, amount]) => {
                        const [year, month] = monthKey.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1);
                        const monthName = date.toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' });
                        return (
                          <div key={monthKey} className={`flex items-center justify-between p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
                                <Calendar size={18} />
                              </div>
                              <p className={`text-xs font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>{monthName}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>৳ {amount.toLocaleString('bn-BD')}</p>
                            </div>
                          </div>
                        );
                      })}
                    {Object.keys(globalStats.monthlySubscriptionRevenue).length === 0 && (
                      <p className="text-center py-10 text-slate-400 text-xs font-bold italic">কোন লেনদেন পাওয়া যায়নি</p>
                    )}
                    {selectedRevMonth !== 'all' && !globalStats.monthlySubscriptionRevenue[selectedRevMonth] && (
                      <p className="text-center py-10 text-slate-400 text-xs font-bold italic">এই মাসের জন্য কোন ডাটা নেই</p>
                    )}
                  </div>
                </div>
              )}
              </div>

            </div>
          )}

          {view === 'list' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
              {/* Refined Header - Mobile Optimized */}
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto tracking-tight`}>মাদরাসা লিস্ট</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage {madrasahs.length} Institutions</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    {isSuperAdmin && (
                      <button 
                        onClick={toggleDeactivationMode} 
                        disabled={isProcessingDeactivationToggle}
                        title="Turn ON to auto deactivate unpaid institutions after 15th"
                        className={`h-12 px-4 font-black rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest border ${globalDeactivationMode ? 'bg-red-50 text-red-600 border-red-200' : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200')} disabled:opacity-50`}
                      >
                        {isProcessingDeactivationToggle ? <Loader2 size={16} className="animate-spin" /> : (globalDeactivationMode ? <ToggleRight size={16} className="text-red-600" /> : <ToggleLeft size={16} />)}
                        Deactivated Mode
                      </button>
                    )}
                    <button onClick={handleRefresh} disabled={isRefreshing} className={`w-12 h-12 flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-white text-blue-600 border-slate-200'} rounded-2xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                      <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button 
                      onClick={() => {
                        if (canWrite('institutions')) {
                          setShowCreateModal(true);
                        } else {
                          setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার নতুন পোর্টাল তৈরি করার অনুমতি নেই।' });
                        }
                      }} 
                      className={`h-12 px-6 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest ${!canWrite('institutions') ? 'opacity-50' : ''}`}
                    >
                      <Plus size={20} /> New Portal
                    </button>
                  </div>
                </div>

                {/* Mobile & Tablet Tools Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                   {/* Institutions Counts */}
                   <div className={`flex flex-1 items-center gap-3 p-3 rounded-[2rem] ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-premium'} border`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${madrasah?.theme === 'dark' ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
                        <Users2 size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">মোট প্রতিষ্ঠান</p>
                        <p className={`text-base font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{madrasahs.length} টি</p>
                      </div>
                   </div>

                   {/* Quick Action Icons */}
                   <div className="flex flex-wrap items-center gap-2">
                     {isSuperAdmin && (
                       <>
                         <button 
                             onClick={toggleDeactivationMode} 
                             disabled={isProcessingDeactivationToggle}
                             className={`sm:hidden flex-1 h-12 px-4 flex items-center justify-center gap-2 font-black rounded-[1.5rem] active:scale-95 transition-all text-[10px] uppercase tracking-widest border ${globalDeactivationMode ? 'bg-red-50 text-red-600 border-red-200' : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200')} disabled:opacity-50`}
                         >
                            {isProcessingDeactivationToggle ? <Loader2 size={16} className="animate-spin" /> : (globalDeactivationMode ? <ToggleRight size={18} /> : <ToggleLeft size={18} />)}
                            Mode
                         </button>
                         <button onClick={handleSyncToSheet} disabled={isSyncingSheet} className={`w-12 h-12 flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} rounded-[1.5rem] active:scale-95 transition-all border shadow-sm disabled:opacity-50`} title="Sync All to Google Sheet">
                            {isSyncingSheet ? <Loader2 size={24} className="animate-spin" /> : <Database size={24} />}
                         </button>
                       </>
                     )}
                     <button onClick={handleRefresh} className="sm:hidden w-12 h-12 flex items-center justify-center bg-white border border-slate-100 text-blue-500 rounded-[1.5rem] active:scale-95 transition-all">
                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                     </button>
                     <button 
                       onClick={() => {
                         if (canWrite('institutions')) {
                           setShowCreateModal(true);
                         } else {
                           setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার নতুন পোর্টাল তৈরি করার অনুমতি নেই।' });
                         }
                       }} 
                       className={`sm:hidden flex-1 h-12 bg-blue-600 text-white font-black rounded-[1.5rem] flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 ${!canWrite('institutions') ? 'opacity-50' : ''}`}
                     >
                        <Plus size={18} /> New
                     </button>
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative group flex-1 w-full shadow-premium rounded-3xl overflow-hidden">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Search size={20} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="মাদরাসার নাম, ফোন বা কোড দিয়ে খুঁজুন..." 
                      className={`w-full h-16 pl-14 pr-6 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:bg-slate-800' : 'bg-white border-slate-100/50 text-slate-800 focus:bg-slate-50'} border-0 outline-none font-bold transition-all text-sm sm:text-base`} 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                    <div className="relative shrink-0">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="month" 
                        className={`h-14 pl-12 pr-4 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-700'} font-bold text-xs outline-none shadow-premium focus:border-blue-500/50 transition-all`}
                        value={instFilterMonth}
                        onChange={(e) => setInstFilterMonth(e.target.value)}
                      />
                    </div>

                    <div className={`p-1.5 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-premium'} border flex gap-1 items-center shrink-0`}>
                      {[
                        { id: 'all', label: 'All', icon: <Layers size={14} /> },
                        { id: 'paid', label: 'Paid', icon: <CheckCircle2 size={14} /> },
                        { id: 'unpaid', label: 'Unpaid', icon: <AlertCircle size={14} /> }
                      ].map(btn => (
                        <button
                          key={btn.id}
                          onClick={() => setInstPaymentFilter(btn.id as any)}
                          className={`px-4 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${instPaymentFilter === btn.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          {btn.icon}
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'madrasah', label: 'Madrasah' },
                    { id: 'school', label: 'School' },
                    { id: 'kindergarten', label: 'KG' },
                    { id: 'choching', label: 'Choching' },
                    { id: '200plus', label: '২০০+ শিক্ষার্থী' }
                  ].map(type => (
                    <button 
                      key={type.id}
                      onClick={() => setFilterType(type.id as any)}
                      className={`h-14 px-6 rounded-[1.5rem] whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center border-2 ${filterType === type.id ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-lg shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500 shadow-sm')}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length > 0 ? filtered.slice(0, visibleCount).map(m => (
                  <div key={m.id} onClick={() => handleUserClick(m)} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-100 shadow-premium hover:border-blue-500/30'} p-6 rounded-[2.5rem] border active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-16 h-16 relative ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} rounded-[1.5rem] flex items-center justify-center text-slate-300 border shadow-inner shrink-0 overflow-hidden group-hover:scale-105 transition-transform`}>
                          {m.logo_url ? <img src={m.logo_url} className="w-full h-full object-contain" /> : <UserIcon size={28} />}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const isSelected = selectedInstIds.includes(m.id);
                              if (isSelected) {
                                setSelectedInstIds(prev => prev.filter(id => id !== m.id));
                              } else {
                                setSelectedInstIds(prev => [...prev, m.id]);
                              }
                            }}
                            className={`absolute top-0 left-0 w-6 h-6 rounded-tl-[1.5rem] rounded-br-[1.5rem] z-10 flex items-center justify-center transition-all shadow-sm ${selectedInstIds.includes(m.id) ? 'bg-blue-500 text-white' : 'bg-white/80 text-slate-300 backdrop-blur-sm opacity-0 group-hover:opacity-100'}`}
                          >
                            <Check size={12} strokeWidth={4} />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Code: {(m.config_json as any)?.institute_code || 'N/A'}</p>
                          <h3 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} truncate font-noto text-lg leading-tight`}>{m.name}</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">{m.phone || 'No Phone'}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${m.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {m.is_active ? 'Active' : 'Blocked'}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          {m.institution_type === 'choching' ? 'Choching' : (m.institution_type || 'madrasah')}
                        </span>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          {m.student_count || 0} Students
                        </span>
                        <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600">
                          {m.balance || 0} ৳
                        </span>
                        {m.config_json?.modules?.voice_broadcast !== false && (
                          <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500">
                            Voice
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 relative z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigateToVoiceBroadcast) onNavigateToVoiceBroadcast([m.id]);
                          }} 
                          className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
                        >
                          <Mic size={14} />
                        </button>
                        <a href={`tel:${m.phone}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors">
                          <PhoneCall size={14} />
                        </a>
                        <a href={`https://wa.me/${m.phone?.replace('+', '')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                          <MessageCircle size={14} />
                        </a>
                      </div>
                    </div>

                    <div className="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={20} className="text-blue-500" />
                    </div>
                  </div>
                )) : (
                  <div className={`col-span-full text-center py-24 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[3rem] border-2 border-dashed`}>
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={32} className="text-slate-300" />
                    </div>
                    <h4 className="text-lg font-black text-slate-900">No Madrasahs Found</h4>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Try adjusting your search or filter</p>
                  </div>
                )}
              </div>
              
              {filtered.length > visibleCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 30)}
                    className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-premium active:scale-95 flex items-center justify-center gap-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-white text-blue-600 hover:bg-slate-50'}`}
                  >
                    <RefreshCw size={16} /> Load More ({filtered.length - visibleCount} left)
                  </button>
                </div>
              )}

              {/* Floating Multi-select Action Bar */}
              <AnimatePresence>
                {selectedInstIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-28 sm:bottom-10 left-1/2 -translate-x-1/2 z-[500] w-[92%] max-w-2xl"
                  >
                    <div className="bg-[#1E3A8A] text-white p-4 sm:p-6 rounded-[2.5rem] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-blue-400/20 backdrop-blur-md">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center font-black text-lg">
                          {selectedInstIds.length}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">নির্বাচিত প্রতিষ্ঠান</p>
                          <h4 className="font-bold text-base leading-tight">গ্রুপ কমিউনিকেশন</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => {
                            const selected = madrasahs.filter(m => selectedInstIds.includes(m.id));
                            setCommsModal({ show: true, institutions: selected, type: 'sms' });
                          }}
                          className="flex-1 sm:flex-none h-12 px-6 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <MessageSquare size={16} /> SMS পাঠান
                        </button>
                        <button 
                          onClick={() => {
                            if (onNavigateToVoiceBroadcast) {
                              onNavigateToVoiceBroadcast(selectedInstIds);
                            } else {
                              if (awajVoices.length === 0) handleFetchAwajVoices();
                              const selected = madrasahs.filter(m => selectedInstIds.includes(m.id));
                              setCommsModal({ show: true, institutions: selected, type: 'voice' });
                            }
                          }}
                          className="flex-1 sm:flex-none h-12 px-6 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <Mic size={16} /> ভয়েস কল
                        </button>
                        <button 
                          onClick={() => setSelectedInstIds([])}
                          className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 text-xs font-black"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {false && view === 'institutions' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto tracking-tight`}>প্রতিষ্ঠানের তালিকা</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institute Management & Communication</p>
                </div>
                <button onClick={handleRefresh} disabled={isRefreshing} className={`w-12 h-12 flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-white text-blue-600 border-slate-200'} rounded-2xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                  <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative group flex-1 w-full">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by Institute Code, Name or Phone..." 
                    className={`w-full h-14 pl-14 pr-6 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:bg-slate-800' : 'bg-white border-slate-100 text-slate-800 focus:bg-slate-50'} border rounded-2xl outline-none font-bold shadow-premium transition-all focus:border-blue-500/50`} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                  <div className="relative shrink-0">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="month" 
                      className={`h-14 pl-12 pr-4 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-700'} font-bold text-xs outline-none shadow-premium focus:border-blue-500/50 transition-all`}
                      value={instFilterMonth}
                      onChange={(e) => setInstFilterMonth(e.target.value)}
                    />
                  </div>

                  <div className={`p-1.5 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-premium'} border flex gap-1 items-center shrink-0`}>
                    {[
                      { id: 'all', label: 'All', icon: <Layers size={14} /> },
                      { id: 'paid', label: 'Paid', icon: <CheckCircle2 size={14} /> },
                      { id: 'unpaid', label: 'Unpaid', icon: <AlertCircle size={14} /> }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => setInstPaymentFilter(btn.id as any)}
                        className={`px-4 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${instPaymentFilter === btn.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        {btn.icon}
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Institute List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedInstitutions.map(inst => {
                  const config = (inst.config_json || {}) as any;
                  const isExpanded = expandedInstituteId === inst.id;
                  const instCode = config.institute_code || 'N/A';
                  
                  return (
                    <motion.div 
                      key={inst.id}
                      layout
                      className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-premium'} rounded-[2.5rem] border overflow-hidden transition-all`}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-500'} relative`}>
                              {inst.logo_url ? <img src={inst.logo_url} className="w-full h-full object-contain rounded-2xl" referrerPolicy="no-referrer" /> : <Building2 size={24} />}
                              
                              {/* Multi-select Checkbox Overlay */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const isSelected = selectedInstIds.includes(inst.id);
                                  if (isSelected) {
                                    setSelectedInstIds(prev => prev.filter(id => id !== inst.id));
                                  } else {
                                    setSelectedInstIds(prev => [...prev, inst.id]);
                                  }
                                }}
                                className={`absolute -top-2 -left-2 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-white shadow-sm ${selectedInstIds.includes(inst.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 text-transparent'}`}
                              >
                                <Check size={14} strokeWidth={4} />
                              </button>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Code: {instCode}</p>
                              <h3 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto text-base leading-tight`}>{inst.name}</h3>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (onNavigateToVoiceBroadcast) {
                                   onNavigateToVoiceBroadcast([inst.id]);
                                 }
                               }} 
                               className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
                             >
                               <Mic size={18} />
                             </button>
                             <a href={`tel:${inst.phone}`} onClick={e => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors">
                               <PhoneCall size={18} />
                             </a>
                             <a href={`https://wa.me/${inst.phone?.replace('+', '')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                               <MessageCircle size={18} />
                             </a>
                          </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{inst.phone || 'No Phone'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{inst.institution_type === 'choching' ? 'Choching' : inst.institution_type}</p>
                          </div>
                          <button 
                            onClick={() => setExpandedInstituteId(isExpanded ? null : inst.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isExpanded ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                          >
                            {isExpanded ? 'Hide Details' : 'Subscription'}
                          </button>
                        </div>

                        {isExpanded && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-6 pt-6 border-t border-slate-100 space-y-4"
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Package</p>
                                <p className="text-xs font-black text-slate-700">{(config as any).subscription_type || 'N/A'}</p>
                              </div>
                              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                <p className={`text-xs font-black ${inst.is_active ? 'text-emerald-500' : 'text-red-500'}`}>{inst.is_active ? 'Active' : 'Expired/Blocked'}</p>
                              </div>
                            </div>
                            
                            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Subscription & Balance</span>
                                <CreditCard size={14} className="text-blue-400" />
                              </div>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                                      <span className="text-sm font-black text-emerald-600">৳ {inst.balance || 0}</span>
                                      <button 
                                        onClick={() => setShowRechargeModal({ show: true, institution: inst })}
                                        className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SMS Balance</p>
                                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                                      <span className="text-sm font-black text-blue-600">{inst.sms_balance || 0}</span>
                                      <button 
                                        onClick={() => setShowRechargeModal({ show: true, institution: inst })}
                                        className="w-6 h-6 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 bg-slate-100/50 p-2 rounded-xl">
                                  <span>Expires On:</span>
                                  <span className="text-blue-600">{inst.subscription_end ? new Date(inst.subscription_end).toLocaleDateString('bn-BD') : 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => handleUserClick(inst as any)}
                              className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                            >
                              Manage Full Details
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Floating Multi-select Action Bar */}
              <AnimatePresence>
                {selectedInstIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-28 sm:bottom-10 left-1/2 -translate-x-1/2 z-[500] w-[92%] max-w-2xl"
                  >
                    <div className="bg-[#1E3A8A] text-white p-4 sm:p-6 rounded-[2.5rem] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-blue-400/20 backdrop-blur-md">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center font-black text-lg">
                          {selectedInstIds.length}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">নির্বাচিত প্রতিষ্ঠান</p>
                          <h4 className="font-bold text-base leading-tight">গ্রুপ কমিউনিকেশন</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => {
                            const selected = madrasahs.filter(m => selectedInstIds.includes(m.id));
                            setCommsModal({ show: true, institutions: selected, type: 'sms' });
                          }}
                          className="flex-1 sm:flex-none h-12 px-6 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <MessageSquare size={16} /> SMS পাঠান
                        </button>
                        <button 
                          onClick={() => {
                            if (onNavigateToVoiceBroadcast) {
                              onNavigateToVoiceBroadcast(selectedInstIds);
                            } else {
                              if (awajVoices.length === 0) handleFetchAwajVoices();
                              const selected = madrasahs.filter(m => selectedInstIds.includes(m.id));
                              setCommsModal({ show: true, institutions: selected, type: 'voice' });
                            }
                          }}
                          className="flex-1 sm:flex-none h-12 px-6 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <Mic size={16} /> ভয়েস কল
                        </button>
                        <button 
                          onClick={() => setSelectedInstIds([])}
                          className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 text-xs font-black"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {view === 'approvals' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto tracking-tight`}>পেমেন্ট ম্যানেজমেন্ট</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Approve and Manage Transactions</p>
                </div>
                <button onClick={handleRefresh} disabled={isRefreshing} className={`w-12 h-12 flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-white text-blue-600 border-slate-200'} rounded-2xl active:scale-95 transition-all border shadow-sm disabled:opacity-50`}>
                   <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className={`p-5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-blue-900/20 border-blue-800/50 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={24} className="text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black mb-1">অটোমেটিক পেমেন্ট সিস্টেম</h4>
                    <p className="text-xs font-bold opacity-80 leading-relaxed font-noto">
                      ইউজাররা যখন পেমেন্ট পেজে গিয়ে পরিমাণ লেখে, তখন একটি "অটো-পেমেন্টের অপেক্ষায়" রিকোয়েস্ট তৈরি হয়। তারা পেমেন্ট সম্পন্ন করলে Android Gateway অ্যাপের মাধ্যমে সেটি স্বয়ংক্রিয়ভাবে Approve হয়ে যাবে। 
                      <strong> আপনার ম্যানুয়ালি Approve করার দরকার নেই।</strong> শুধুমাত্র যদি কোনো কারণে Gateway কাজ না করে এবং ইউজার আপনাকে জানায়, তবেই TrxID মিলিয়ে ম্যানুয়ালি Approve করুন।
                    </p>
                  </div>
                </div>
              </div>

              <div className={`flex ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} p-1.5 rounded-2xl`}>
                <button 
                  onClick={() => setPaymentTab('sms')}
                  className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTab === 'sms' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}
                >
                  SMS Recharge
                </button>
                <button 
                  onClick={() => setPaymentTab('voice')}
                  className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTab === 'voice' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}
                >
                  Voice Recharge
                </button>
                <button 
                  onClick={() => setPaymentTab('subscription')}
                  className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTab === 'subscription' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}
                >
                  Subscription
                </button>
              </div>
              
              <div className="space-y-6">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                   <AlertCircle size={14} className="text-amber-400" /> Pending Requests ({paymentTab === 'sms' ? 'SMS' : paymentTab === 'voice' ? 'Voice' : 'Subscription'})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingTrans.filter(tr => filterTransactionByTab(tr, paymentTab)).length > 0 ? pendingTrans.filter(tr => filterTransactionByTab(tr, paymentTab)).map(tr => (
                    <div key={tr.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-premium'} p-6 rounded-[2.5rem] border space-y-5 animate-in slide-in-from-left-4`}>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <div className="bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-2xl text-lg font-black">
                                {correctionAmounts[tr.id] ? correctionAmounts[tr.id] : tr.amount} ৳
                            </div>
                            {tr.metadata?.expected_amount && Number(tr.metadata.expected_amount) !== (correctionAmounts[tr.id] ? Number(correctionAmounts[tr.id]) : Number(tr.amount)) && (
                              <div className="text-[9px] font-black text-rose-500 mt-1 px-1">
                                Expected Fee: {tr.metadata.expected_amount} ৳
                              </div>
                            )}
                            {tr.metadata?.requested_amount && Number(tr.metadata.requested_amount) !== (correctionAmounts[tr.id] ? Number(correctionAmounts[tr.id]) : Number(tr.amount)) && (
                              <div className="text-[9px] font-black text-slate-400 mt-0.5 px-1">
                                Requested: {tr.metadata.requested_amount} ৳
                              </div>
                            )}
                            {tr.module === 'subscription' && tr.institutions?.custom_subscription_fee && (
                              <div className="text-[9px] font-black text-blue-500 mt-0.5 px-1">
                                Fee: {tr.institutions.custom_subscription_fee} ৳ / month
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                             <Clock size={12} /> {new Date(tr.created_at).toLocaleDateString('bn-BD')}
                          </div>
                        </div>
                      <div className="px-1 space-y-2">
                        <div className={`flex items-start justify-between gap-2`}>
                          <p className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto leading-tight`}>
                            {tr.institutions?.config_json?.institute_code ? `[${tr.institutions.config_json.institute_code}] ` : ''}{tr.institutions?.name}
                          </p>
                          {tr.institutions?.reve_api_key && (
                            <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-100'} whitespace-nowrap`}>
                              Masking
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                           {tr.description && (
                             <p className={`text-[10px] font-bold ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} uppercase tracking-tight mb-1`}>
                                {tr.description}
                             </p>
                           )}
                           {tr.module === 'subscription' && tr.metadata?.months && (
                             <div className="flex flex-wrap gap-1 mb-2">
                               {tr.metadata.months.map((m: string) => (
                                 <span key={m} className={`px-1.5 py-0.5 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-600 border-blue-100'} text-[8px] font-black rounded-md border uppercase`}>
                                   {m}
                                 </span>
                               ))}
                             </div>
                           )}
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TrxID: <span className="text-blue-500 font-mono">{tr.transaction_id}</span></p>
                           <p className={`text-xs font-black flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                               <Smartphone size={14} className="text-blue-500" /> 
                               বিকাশ নম্বর: <span className="font-mono">{tr.sender_phone || 'N/A'}</span>
                           </p>
                        </div>
                      </div>
                      
                      <div className={`flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-4 rounded-2xl border`}>
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${smsEnabledMap[tr.id] ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-200 text-slate-400'}`}>
                              <MessageSquare size={16} />
                           </div>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">অ্যাপ্রুভ হলে SMS পাঠান</span>
                        </div>
                        <button onClick={() => toggleSmsForRequest(tr.id)} className="transition-all active:scale-90">
                           {smsEnabledMap[tr.id] ? (
                             <ToggleRight className="text-blue-500" size={32} />
                           ) : (
                             <ToggleLeft className="text-slate-300" size={32} />
                           )}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                           <div className="space-y-1">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">টাকার পরিমাণ সংশোধন (প্রয়োজন হলে)</p>
                              <input 
                                type="number" 
                                disabled={approvingIds.has(tr.id)}
                                className={`w-full h-12 px-6 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'} border rounded-2xl font-black text-sm text-center outline-none focus:border-blue-500/30 disabled:opacity-50 transition-all`} 
                                value={correctionAmounts[tr.id] || ''} 
                                onChange={(e) => setCorrectionAmounts({...correctionAmounts, [tr.id]: e.target.value})} 
                                placeholder={`Amount Correction (Original: ${tr.amount})`} 
                              />
                           </div>
                           {paymentTab === 'sms' && !tr.description?.toLowerCase().includes('subscription') && tr.module !== 'subscription' && (
                             <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">SMS সংখ্যা</p>
                                <input 
                                  type="number" 
                                  disabled={approvingIds.has(tr.id)}
                                  className={`w-full h-12 px-6 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'} border rounded-2xl font-black text-sm text-center outline-none focus:border-blue-500/30 disabled:opacity-50 transition-all`} 
                                  value={smsToCredit[tr.id] || ''} 
                                  onChange={(e) => setSmsToCredit({...smsToCredit, [tr.id]: e.target.value})} 
                                  placeholder="SMS Quantity" 
                                />
                             </div>
                           )}
                        </div>
                        <button 
                          onClick={() => approveTransaction(tr)} 
                          disabled={approvingIds.has(tr.id) || (paymentTab === 'sms' && !tr.description?.toLowerCase().includes('subscription') && tr.module !== 'subscription' && !smsToCredit[tr.id])}
                          className={`w-full h-14 font-black rounded-2xl text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${tr.transaction_id?.startsWith('PENDING_') ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-sm border border-amber-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 disabled:bg-slate-300 disabled:shadow-none'}`}
                        >
                          {approvingIds.has(tr.id) ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={18} /> {tr.transaction_id?.startsWith('PENDING_') ? 'ম্যানুয়ালি অনুমোদন দিন' : 'অনুমোদন দিন'}</>}
                        </button>
                        {tr.transaction_id?.startsWith('PENDING_') && (
                          <p className="text-[9px] font-bold text-amber-600/80 text-center uppercase tracking-wider">অটো-পেমেন্টের অপেক্ষায়</p>
                        )}
                        <button 
                          onClick={() => setRejectConfirm(tr)} 
                          disabled={approvingIds.has(tr.id)}
                          className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-500 border-red-100'} font-black rounded-2xl text-xs active:scale-95 transition-all border disabled:opacity-50`}
                        >
                          রিকোয়েস্ট বাতিল করুন
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className={`col-span-full text-center py-24 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[3rem] border-2 border-dashed`}>
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No Pending Requests</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between px-2">
                   <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 font-noto">
                      <History size={14} className="text-blue-400" /> বিগত ৩০ দিনের ইতিহাস ({paymentTab === 'sms' ? 'SMS' : paymentTab === 'voice' ? 'Voice' : 'Subscription'})
                   </h2>
                   <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border dark:border-slate-700 font-noto">
                      গত ৩০ দিন
                   </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {transactionHistory.filter(tr => filterTransactionByTab(tr, paymentTab) && isWithinLast30Days(tr.created_at)).length > 0 ? transactionHistory.filter(tr => filterTransactionByTab(tr, paymentTab) && isWithinLast30Days(tr.created_at)).map(tr => (
                    <div key={tr.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-premium'} p-5 rounded-[2rem] border flex items-center justify-between group hover:border-blue-500/30 transition-all`}>
                       <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <p className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} leading-none`}>{tr.amount} ৳</p>
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {tr.status}
                             </span>
                          </div>
                          <p className={`text-xs font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-noto truncate`}>
                             {tr.institutions?.config_json?.institute_code ? `[${tr.institutions.config_json.institute_code}] ` : ''}{tr.institutions?.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                             <Smartphone size={10} /> {tr.sender_phone || 'N/A'}
                             {tr.sms_count && <span className="text-blue-500 font-black">({tr.sms_count} SMS)</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-slate-400">
                             <Clock size={10} />
                             <p className="text-[9px] font-bold">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                          </div>
                       </div>
                       <div className="text-right ml-4 shrink-0">
                          <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">TrxID</p>
                          <p className="text-[10px] font-black text-blue-500 font-mono uppercase leading-tight">{tr.transaction_id}</p>
                       </div>
                    </div>
                  )) : (
                    <div className={`col-span-full text-center py-20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[2.5rem] border-2 border-dashed`}>
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest font-noto">বিগত ৩০ দিনে কোনো ইতিহাস পাওয়া যায়নি</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'details' && selectedUser && (
             <div className="animate-in slide-in-from-right-10 duration-500 pb-24 space-y-8 pt-2">
                {/* Header */}
                <div className="flex items-center gap-4">
                   <button onClick={() => setView('list')} className={`w-12 h-12 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-blue-600 border-slate-200 hover:bg-slate-50'} rounded-2xl flex items-center justify-center active:scale-95 transition-all border shadow-sm`}>
                      <ArrowLeft size={24} strokeWidth={2.5} />
                   </button>
                   <div className="min-w-0 flex-1">
                      <h1 className={`text-2xl md:text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto truncate tracking-tight`}>Institution Details</h1>
                      <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">ID: {selectedUser.id}</p>
                   </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-200 shadow-premium'} rounded-[3rem] p-6 md:p-10 border space-y-10`}>
                   {/* Profile Header */}
                   <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                      <div className={`w-32 h-32 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-white'} rounded-[2.5rem] flex items-center justify-center border-4 shadow-xl overflow-hidden relative group`}>
                         {selectedUser.logo_url ? <img src={selectedUser.logo_url} className="w-full h-full object-contain" /> : <UserIcon size={56} className="text-slate-300" />}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm cursor-pointer">
                            <Camera size={24} className="text-white" />
                         </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <h2 className={`text-3xl md:text-4xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'} font-noto leading-tight tracking-tight`}>{selectedUser.name}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                          <div className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border ${editActive ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200') : (madrasah?.theme === 'dark' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200')}`}>
                             <Activity size={14} /> {editActive ? 'Active Portal' : 'Access Restricted'}
                          </div>
                          <div className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                             {editInstitutionType || 'Institution'}
                          </div>
                        </div>
                      </div>
                   </div>

                   {/* Stats Grid */}
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 rounded-[2rem] border flex flex-col justify-center group hover:border-blue-500/30 transition-all`}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</p>
                         <h5 className={`text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{userStats.students}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 rounded-[2rem] border flex flex-col justify-center group hover:border-blue-500/30 transition-all`}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classes</p>
                         <h5 className={`text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{userStats.classes}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'} p-6 rounded-[2rem] border flex flex-col justify-center group hover:border-blue-500/50 transition-all`}>
                         <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">SMS Balance</p>
                         <h5 className={`text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{selectedUser.sms_balance || 0}</h5>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'} p-6 rounded-[2rem] border flex flex-col justify-center group hover:border-emerald-500/50 transition-all`}>
                         <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Voice Balance</p>
                         <h5 className={`text-3xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>৳ {Number(selectedUser.balance || 0).toFixed(2)}</h5>
                      </div>
                   </div>

                   {/* Tab Navigation */}
                   <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6 md:mx-0 md:px-0">
                      <button 
                        onClick={() => setDetailsTab('institution')}
                        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3 shrink-0 ${detailsTab === 'institution' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <Building2 size={18} /> {lang === 'bn' ? 'প্রতিষ্ঠান তথ্য' : 'Institution Info'}
                      </button>
                      <button 
                        onClick={() => setDetailsTab('api')}
                        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3 shrink-0 ${detailsTab === 'api' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <Key size={18} /> {lang === 'bn' ? 'এপিআই সিকিউরিটি' : 'API Security'}
                      </button>
                      <button 
                        onClick={() => setDetailsTab('permissions')}
                        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3 shrink-0 ${detailsTab === 'permissions' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <Shield size={18} /> {lang === 'bn' ? 'পারমিশন' : 'Permissions'}
                      </button>
                      <button 
                        onClick={() => setDetailsTab('subscription')}
                        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3 shrink-0 ${detailsTab === 'subscription' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <CreditCard size={18} /> {lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
                      </button>
                      <button 
                        onClick={() => {
                          setDetailsTab('history');
                          if (selectedUser) fetchPaymentHistory(selectedUser.id);
                        }}
                        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-3 shrink-0 ${detailsTab === 'history' ? (madrasah?.theme === 'dark' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')}`}
                      >
                         <History size={18} /> {lang === 'bn' ? 'ইতিহাস' : 'History'}
                      </button>
                   </div>

                   <div className={`space-y-6 pt-4 border-t ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                      {!isSuperAdmin && isManager && !canSaveCurrentTab() && (
                        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                          madrasah?.theme === 'dark' 
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          <AlertTriangle size={20} className="shrink-0" />
                          <div className="text-xs font-bold font-noto">
                            {lang === 'bn' ? 'রিড-অনলি মোড: আপনার এই তথ্য পরিবর্তন করার অনুমতি নেই।' : 'Read-Only Mode: You do not have permission to modify this section.'}
                          </div>
                        </div>
                      )}
                      {detailsTab === 'institution' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institution Name</label>
                                 <input type="text" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gmail / Email</label>
                                 <input type="email" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Phone</label>
                                 <input type="tel" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">User PIN / Password</label>
                                 <div className="relative">
                                    <input type="text" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Enter new PIN/Password" />
                                    <Shield className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2">SMS Balance</label>
                                 <div className="relative">
                                    <input type="number" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editSmsBalance} onChange={(e) => setEditSmsBalance(Number(e.target.value))} />
                                    <MessageSquare className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-400" size={20} />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-2">Voice Balance (৳)</label>
                                 <div className="relative">
                                    <input type="number" step="0.01" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editBalance} onChange={(e) => setEditBalance(Number(e.target.value))} />
                                    <Mic className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-400" size={20} />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institute Code</label>
                                 <input type="text" readOnly={!canWrite('institution_info')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editInstituteCode} onChange={(e) => setEditInstituteCode(e.target.value)} placeholder="Enter Institute Code" />
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institution Address</label>
                                 <textarea readOnly={!canWrite('institution_info')} className={`w-full h-28 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-6 py-4 font-black outline-none focus:border-blue-500 transition-all resize-none ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Enter full address..." />
                              </div>
                           </div>

                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Sliders size={16} className={madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} /> Basic Config
                                 </h4>
                                 <button 
                                   onClick={() => {
                                     if (canWrite('institution_info')) {
                                       setEditActive(!editActive);
                                     } else {
                                       setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পরিবর্তন করার অনুমতি নেই।' });
                                     }
                                   }} 
                                   className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all w-full md:w-auto ${editActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'} ${!canWrite('institution_info') ? 'opacity-80 cursor-not-allowed' : ''}`}
                                 >
                                    {editActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{editActive ? 'Active' : 'Inactive'}</span>
                                 </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Institution Type</label>
                                    <select 
                                      disabled={!canWrite('institution_info')}
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`}
                                      value={editInstitutionType}
                                      onChange={(e) => setEditInstitutionType(e.target.value as any)}
                                    >
                                      <option value="madrasah">Madrasah</option>
                                      <option value="school">School</option>
                                      <option value="kindergarten">Kindergarten</option>
                                      <option value="choching">Choching</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center justify-between">
                                      <span>Student Limit (0 for unlimited)</span>
                                    </label>
                                    <input 
                                      type="number" 
                                      readOnly={!canWrite('institution_info')}
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`}
                                      value={editStudentLimit}
                                      onChange={(e) => setEditStudentLimit(Math.max(0, Number(e.target.value)))}
                                      placeholder="0 for unlimited"
                                    />
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
                                      disabled={!canWrite('institution_info')}
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`}
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
                                      disabled={!canWrite('institution_info')}
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`}
                                      value={editResultSystem}
                                      onChange={(e) => setEditResultSystem(e.target.value as any)}
                                    >
                                      <option value="grading">Grading (GPA)</option>
                                      <option value="grading_optional">Grading (+ 4th Sub)</option>
                                      <option value="high_school">High School (CQ/MCQ)</option>
                                      <option value="marks">Marks Only</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Accounting Mode</label>
                                    <select 
                                      disabled={!canWrite('institution_info')}
                                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('institution_info') ? 'cursor-not-allowed opacity-85' : ''}`}
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
                                    <input type="text" readOnly={!canWrite('api_security')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}`} value={editVoiceSenderId} onChange={(e) => setEditVoiceSenderId(e.target.value)} placeholder="e.g. 8801..." />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">REVE API Key</label>
                                    <input type="text" readOnly={!canWrite('api_security')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}`} value={editReveApiKey} onChange={(e) => setEditReveApiKey(e.target.value)} placeholder="API Key" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Secret Key</label>
                                    <input type="text" readOnly={!canWrite('api_security')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}`} value={editReveSecretKey} onChange={(e) => setEditReveSecretKey(e.target.value)} placeholder="Secret Key" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Masking / Sender ID</label>
                                    <input type="text" readOnly={!canWrite('api_security')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}`} value={editReveClientId} onChange={(e) => setEditReveClientId(e.target.value)} placeholder="e.g. DEENORA" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">SMS Rate (BDT)</label>
                                    <input type="number" step="0.01" readOnly={!canWrite('api_security')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}`} value={editSmsRate} onChange={(e) => setEditSmsRate(Number(e.target.value))} placeholder="0.50" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Voice Rate (BDT)</label>
                                    <input type="number" step="0.01" readOnly={!canWrite('api_security')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}`} value={editVoiceRate} onChange={(e) => setEditVoiceRate(Number(e.target.value))} placeholder="0.50" />
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
                                {Object.entries(editModules)
                                  .filter(([key]) => key !== 'sensitive')
                                  .map(([key, value]) => (
                                  <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{key.replace(/_/g, ' ')}</span>
                                    <button 
                                      onClick={() => {
                                        if (canWrite('permissions')) {
                                          setEditModules({...editModules, [key]: !value});
                                        } else {
                                          setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার মডিউল পারমিশন পরিবর্তন করার অনুমতি নেই।' });
                                        }
                                      }}
                                      className={`w-12 h-6 rounded-full transition-all relative ${value ? 'bg-emerald-500' : (madrasah?.theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')} ${!canWrite('permissions') ? 'cursor-not-allowed opacity-80' : ''}`}
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
                                    <select disabled={!canWrite('subscription')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('subscription') ? 'cursor-not-allowed opacity-85' : ''}`} value={editSubscriptionType} onChange={(e) => setEditSubscriptionType(e.target.value as any)}>
                                       <option value="monthly">Monthly Subscription</option>
                                       <option value="quarterly">Quarterly Subscription</option>
                                       <option value="yearly">Yearly Subscription</option>
                                       <option value="lifetime">Lifetime Access</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Portal Status</label>
                                    <select disabled={!canWrite('subscription')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('subscription') ? 'cursor-not-allowed opacity-85' : ''}`} value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                                       <option value="active">Active</option>
                                       <option value="suspended">Suspended</option>
                                       <option value="trial">Trial Period</option>
                                    </select>
                                    {editStatus === 'trial' && selectedUser?.created_at && (
                                      <p className="text-[9px] font-black text-amber-500 mt-2 px-2 uppercase tracking-tighter">
                                        Trial expires 3 days after creation ({new Date(new Date(selectedUser.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()})
                                      </p>
                                    )}
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Subscription End</label>
                                    <input type="date" readOnly={!canWrite('subscription')} className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('subscription') ? 'cursor-not-allowed opacity-85' : ''}`} value={editSubscriptionEnd} onChange={(e) => setEditSubscriptionEnd(e.target.value)} />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2">Custom Monthly Rate (৳)</label>
                                    <input 
                                       type="number" 
                                       readOnly={!canWrite('subscription')}
                                       placeholder="Set Custom Rate"
                                       className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all ${!canWrite('subscription') ? 'cursor-not-allowed opacity-85' : ''}`} 
                                       value={editCustomSubscriptionFee} 
                                       onChange={(e) => setEditCustomSubscriptionFee(e.target.value === '' ? '' : Number(e.target.value))} 
                                    />
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
                                           if (canWrite('payment')) {
                                             setEditPackageName(pkg.name);
                                             setEditPackageRate(pkg.rate);
                                           } else {
                                             setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                           }
                                         }}
                                         className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${editPackageName === pkg.name ? (madrasah?.theme === 'dark' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/10' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-lg shadow-blue-500/10') : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')} ${!canWrite('payment') ? 'opacity-80 cursor-not-allowed' : ''}`}
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
                                       <button 
                                         onClick={() => {
                                           if (canWrite('payment')) {
                                             setSelectedYear(selectedYear - 1);
                                           } else {
                                             setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                           }
                                         }} 
                                         className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} ${!canWrite('payment') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                       >
                                         <ArrowLeft size={16} />
                                       </button>
                                       <span className="text-sm font-black text-blue-500">{selectedYear}</span>
                                       <button 
                                         onClick={() => {
                                           if (canWrite('payment')) {
                                             setSelectedYear(selectedYear + 1);
                                           } else {
                                             setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                           }
                                         }} 
                                         className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} ${!canWrite('payment') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                       >
                                         <ArrowRight size={16} />
                                       </button>
                                    </div>
                                 </div>

                                 {/* Quick Selection */}
                                 <div className="flex flex-wrap items-center gap-2 px-1">
                                    <button 
                                      onClick={() => {
                                        if (canWrite('payment')) {
                                          const currentYear = new Date().getFullYear();
                                          const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
                                          setSelectedMonthsForPayment([`${currentYear}-${currentMonth}`]);
                                        } else {
                                          setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                        }
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${selectedMonthsForPayment.length === 1 ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')} ${!canWrite('payment') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Monthly
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (canWrite('payment')) {
                                          const currentYear = new Date().getFullYear();
                                          const currentMonth = new Date().getMonth(); // 0-indexed
                                          const months = [];
                                          for (let i = 0; i < 3; i++) {
                                            const d = new Date(currentYear, currentMonth + i, 1);
                                            months.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
                                          }
                                          setSelectedMonthsForPayment(months);
                                        } else {
                                          setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                        }
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${selectedMonthsForPayment.length === 3 ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')} ${!canWrite('payment') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Quarterly
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (canWrite('payment')) {
                                          const currentYear = new Date().getFullYear();
                                          const months = [];
                                          for (let i = 1; i <= 12; i++) {
                                            months.push(`${currentYear}-${i.toString().padStart(2, '0')}`);
                                          }
                                          setSelectedMonthsForPayment(months);
                                        } else {
                                          setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                        }
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${selectedMonthsForPayment.length === 12 ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')} ${!canWrite('payment') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Yearly
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (canWrite('payment')) {
                                          setSelectedMonthsForPayment([]);
                                        } else {
                                          setStatusModal({ show: true, type: 'error', title: 'অনুমতি নেই', message: 'আপনার পেমেন্ট করার অনুমতি নেই।' });
                                        }
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'} ${!canWrite('payment') ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                          {overrideTotal !== '' ? overrideTotal.toLocaleString('bn-BD') : Math.max(0, ((userStats.students > 0 && userStats.students <= 200 ? editPackageRate : userStats.students * 1) * selectedMonthsForPayment.length) - editDiscount).toLocaleString('bn-BD')} ৳
                                       </p>
                                       {editDiscount > 0 && (
                                         <p className="text-[10px] font-bold text-emerald-500">
                                           Discount: -{editDiscount.toLocaleString('bn-BD')} ৳
                                         </p>
                                       )}
                                    </div>
                                 </div>

                                 <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                       <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Discount (৳)</p>
                                       <input 
                                         type="number" 
                                         readOnly={!canWrite('payment')}
                                         value={editDiscount || ''} 
                                         onChange={(e) => {
                                           setEditDiscount(Number(e.target.value) || 0);
                                           setOverrideTotal('');
                                         }}
                                         placeholder="0"
                                         className={`w-full h-12 rounded-xl px-4 font-black outline-none border-2 transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500'} ${!canWrite('payment') ? 'cursor-not-allowed opacity-85' : ''}`}
                                       />
                                    </div>
                                    <div>
                                       <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>বকেয়া (Due ৳)</p>
                                       <input 
                                         type="number" 
                                         readOnly={!canWrite('payment')}
                                         value={editDueAmount || ''} 
                                         onChange={(e) => setEditDueAmount(Number(e.target.value))}
                                         placeholder="0"
                                         className={`w-full h-12 rounded-xl px-4 font-black outline-none border-2 transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500'} ${!canWrite('payment') ? 'cursor-not-allowed opacity-85' : ''}`}
                                       />
                                    </div>
                                    <div>
                                       <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Custom Total (৳)</p>
                                       <input 
                                         type="number" 
                                         readOnly={!canWrite('payment')}
                                         value={overrideTotal} 
                                         onChange={(e) => setOverrideTotal(e.target.value === '' ? '' : Number(e.target.value))}
                                         placeholder="Auto"
                                         className={`w-full h-12 rounded-xl px-4 font-black outline-none border-2 transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500'} ${!canWrite('payment') ? 'cursor-not-allowed opacity-85' : ''}`}
                                       />
                                    </div>
                                 </div>
                              </div>

                              {/* Payment Button */}
                              <button 
                                onClick={async () => {
                                  const effectiveAmount = userStats.students > 0 && userStats.students <= 200 ? editPackageRate : userStats.students * 1;
                                  const baseAmount = effectiveAmount * selectedMonthsForPayment.length;
                                  const calculatedAmount = Math.floor(Math.max(0, baseAmount - editDiscount));
                                  const amount = overrideTotal !== '' ? Number(overrideTotal) : calculatedAmount;
                                  if (amount < 0) {
                                    setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'পেমেন্ট অ্যামাউন্ট ০ এর কম হতে পারে না।' });
                                    return;
                                  }
                                  
                                  setIsUpdatingUser(true);
                                  try {
                                     const { data: { session } } = await supabase.auth.getSession();
                                     
                                      // Get latest config from selectedUser
                                      let currentConfig: any = {};
                                      try {
                                        currentConfig = typeof selectedUser.config_json === 'string' 
                                          ? JSON.parse(selectedUser.config_json) 
                                          : (selectedUser.config_json || {});
                                      } catch (e) {
                                        currentConfig = {};
                                      }
                                      const latestConfig = typeof currentConfig === 'object' && currentConfig !== null ? currentConfig : {};
                                      
                                      const res = await fetch('/api/admin', {
                                       method: 'POST',
                                       headers: {
                                         'Content-Type': 'application/json',
                                         'Authorization': `Bearer ${session?.access_token}`
                                       },
                                       body: JSON.stringify({
                                         action: 'payment_update',
                                         id: selectedUser.id,
                                         amount: Number(amount),
                                         description: `Subscription Payment (${editPackageName})`,
                                         metadata: {
                                           months: selectedMonthsForPayment,
                                           package_name: editPackageName,
                                           subscription_type: editSubscriptionType,
                                           discount: editDiscount,
                                           base_amount: baseAmount,
                                           due_amount: editDueAmount,
                                           payment_method: 'Admin Direct'
                                         },
                                         updated_config: {
                                           ...latestConfig,
                                           paid_months: Array.from(new Set([...editPaidMonths, ...selectedMonthsForPayment])),
                                           package_rate: editPackageRate,
                                           package_name: editPackageName,
                                           subscription_note: editSubscriptionNote,
                                           due_amount: editDueAmount,
                                           subscription_type: editSubscriptionType
                                         }
                                       })
                                     });

                                     const result = await res.json();
                                     if (result.error) throw new Error(result.error);

                                     setEditPaidMonths(Array.from(new Set([...editPaidMonths, ...selectedMonthsForPayment])));
                                     // Send Notification SMS
                                     if (selectedUser.phone) {
                                       const pkgName = getEnglishPkgName(editPackageName);
                                       const monthRange = formatMonthsRange(selectedMonthsForPayment);
                                       const msg = `Assalamu Alaikum, Your payment for '${pkgName}' subscription ${monthRange ? '(' + monthRange + ') ' : ''}(${amount}tk) has been received and approved. ${editDueAmount > 0 ? `Due Amount: ${editDueAmount}tk. ` : ''}Thank you.`;
                                       smsApi.sendDirect(selectedUser.phone, msg, madrasah?.id).catch(err => console.error("SMS Send Error:", err));
                                     }

                                    setSelectedMonthsForPayment([]);
                                    setEditDiscount(0);
                                    setOverrideTotal('');
                                    setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'পেমেন্ট রিসিভ করা হয়েছে এবং প্রোফাইল আপডেট হয়েছে।' });
                                    initData(true, true);
                                  } catch (err: any) {
                                    setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
                                  } finally {
                                    setIsUpdatingUser(false);
                                  }
                                }}
                                disabled={isUpdatingUser || !canWrite('payment') || (overrideTotal !== '' ? overrideTotal : ((userStats.students > 0 && userStats.students <= 200 ? 1 : userStats.students) * editPackageRate * selectedMonthsForPayment.length)) <= 0}
                                className={`w-full h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${isUpdatingUser || !canWrite('payment') || (overrideTotal !== '' ? overrideTotal : ((userStats.students > 0 && userStats.students <= 200 ? 1 : userStats.students) * editPackageRate * selectedMonthsForPayment.length)) <= 0 ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed') : 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 active:scale-95'}`}
                              >
                                <Banknote size={24} /> Receive Payment
                              </button>

                                <div className="mt-8">
                                  <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>সাবস্ক্রিপশন নোট (Subscription Note)</label>
                                  <textarea 
                                    readOnly={!canWrite('subscription')}
                                    value={editSubscriptionNote}
                                    onChange={(e) => setEditSubscriptionNote(e.target.value)}
                                    placeholder="এখানে কিছু লিখে রাখুন..."
                                    className={`w-full h-32 rounded-2xl border p-5 font-bold text-sm outline-none transition-all resize-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500'} ${!canWrite('subscription') ? 'cursor-not-allowed opacity-85' : ''}`}
                                  />
                                </div>
                           </div>
                        </div>
                      )}

                      {detailsTab === 'history' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-8`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <History size={16} className={madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-500'} /> Payment History
                                 </h4>
                              </div>

                              <div className="overflow-y-auto custom-scrollbar max-h-[500px] pr-2">
                                 {isLoadingHistory ? (
                                   <div className="flex flex-col items-center justify-center py-12">
                                      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                                      <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Loading history...</p>
                                   </div>
                                 ) : paymentHistory.length === 0 ? (
                                   <div className="flex flex-col items-center justify-center py-12 text-center">
                                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                         <History size={32} />
                                      </div>
                                      <h4 className={`text-lg font-black mb-1 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Payments Found</h4>
                                      <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>এই প্রতিষ্ঠানের কোনো লেনদেনের ইতিহাস পাওয়া যায়নি।</p>
                                   </div>
                                 ) : (
                                   <div className="space-y-4">
                                      {paymentHistory.map((tr) => (
                                        <div key={tr.id} className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                                           <div className="space-y-2">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                 <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${tr.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : tr.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    {tr.status}
                                                 </span>
                                                 {tr.module && (
                                                   <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-blue-100 text-blue-700">
                                                      {tr.module}
                                                   </span>
                                                 )}
                                                 <span className={`text-[10px] font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    {new Date(tr.created_at).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                 </span>
                                              </div>
                                              <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{tr.description}</p>
                                              <p className={`text-[10px] font-mono ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>ID: {tr.transaction_id}</p>
                                           </div>
                                           <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0">
                                              <p className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                 +{(Number(tr.amount || 0)).toLocaleString('bn-BD')} ৳
                                              </p>
                                              <div className="flex items-center gap-2">
                                                <button 
                                                  onClick={(e) => handleDownloadReceipt(tr, e)}
                                                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                  <Download size={14} /> Receipt
                                                </button>
                                                {canWrite('history') && (
                                                  <button 
                                                    onClick={(e) => handleDeleteHistory(tr, e)}
                                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                                    title="Delete history"
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                )}
                                              </div>
                                           </div>
                                        </div>
                                      ))}
                                   </div>
                                 )}
                              </div>
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
        </div>
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
                  <option value="choching">Choching</option>
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


      {showConfirm.show && (
          <div key="confirm-modal" className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-500 border border-amber-50 relative z-[10000]">
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
          </div>
      )}

      <AnimatePresence>
        {commsModal.show && createPortal(
          <div key="comms-modal" className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 pb-28 sm:pb-4 pointer-events-auto">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
               onClick={() => setCommsModal({ ...commsModal, show: false })}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl overflow-hidden z-[5010]"
             >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
                
                <div className="flex items-center justify-between p-6 sm:p-8 pb-4 sm:pb-6 shrink-0">
                  <div className="pr-4">
                    <h3 className="text-lg sm:text-xl font-black text-[#1E3A8A] font-noto tracking-tight">
                      {commsModal.type === 'sms' ? 'এসএমএস পাঠান (SMS)' : 'ভয়েস কল (Voice)'}
                    </h3>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {commsModal.institutions.length === 1 ? `প্রাপক: ${commsModal.institutions[0].name}` : `${commsModal.institutions.length}টি প্রতিষ্ঠান নির্বাচিত`}
                    </p>
                  </div>
                  <button onClick={() => setCommsModal({ ...commsModal, show: false })} className="w-10 h-10 shrink-0 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="overflow-y-auto px-6 sm:px-8 pb-6 flex-grow custom-scrollbar">
                  {commsModal.type === 'sms' ? (
                    <div className="space-y-4">
                      {/* Target Selection for SMS */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">কাকে পাঠাবেন?</label>
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                          <button 
                            onClick={() => setSmsTarget('admin')}
                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${smsTarget === 'admin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white'}`}
                          >
                            অ্যাডমিনদের (Admins)
                          </button>
                          <button 
                            onClick={() => setSmsTarget('students')}
                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${smsTarget === 'students' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white'}`}
                          >
                            শিক্ষার্থীদের (Students)
                          </button>
                        </div>
                        {smsTarget === 'students' && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-100 animate-in fade-in zoom-in-95">
                            <AlertCircle size={14} className="text-yellow-600 shrink-0" />
                            <p className="text-[10px] font-black text-yellow-700 leading-tight">
                              সতর্কতা: এটি নির্বাচিত সকল প্রতিষ্ঠানের সকল শিক্ষার্থীর কাছে এসএমএস পাঠাবে। এটি অনেক এসএমএস খরচ করবে।
                            </p>
                          </div>
                        )}
                      </div>

                      {fetchingTemplates ? (
                        <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
                      ) : instSmsTemplates.length > 0 ? (
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">টেমপ্লেট নির্বাচন করুন (SMS)</label>
                           <select 
                             className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-bold text-[#1E3A8A] outline-none focus:border-blue-200 transition-all text-sm"
                             onChange={(e) => {
                               const tmpl = instSmsTemplates.find(t => t.id === e.target.value);
                               if (tmpl) setCommMessage(tmpl.body);
                             }}
                           >
                             <option value="">-- টেমপ্লেট নির্বাচন করুন --</option>
                             {instSmsTemplates.map(t => (
                               <option key={t.id} value={t.id}>{t.title}</option>
                             ))}
                           </select>
                        </div>
                      ) : (
                        <div className="space-y-2 pb-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">টেমপ্লেট</label>
                           <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">এই প্রতিষ্ঠানের কোনো সেভ করা টেমপ্লেট নেই</p>
                           </div>
                        </div>
                      )}
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">মেসেজ লিখুন</label>
                         <textarea 
                           className="w-full min-h-[120px] sm:min-h-[140px] bg-slate-50 border border-slate-100 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 font-bold text-slate-700 outline-none focus:border-blue-200 transition-all resize-none text-sm sm:text-base"
                           placeholder="এখানে আপনার মেসেজ লিখুন..."
                           value={commMessage}
                           onChange={(e) => setCommMessage(e.target.value)}
                         />
                         <div className="flex justify-end px-2">
                           <span className="text-[10px] font-black text-blue-500">{commMessage.length} Characters</span>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fetchingTemplates ? (
                        <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
                      ) : (
                        <div className="space-y-4">
                          {instVoiceTemplates.length > 0 && (
                            <div>
                              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2 mb-2 block">প্রতিষ্ঠানের ভয়েস টেমপ্লেট</label>
                              <div className="grid grid-cols-1 gap-2 p-1 max-h-32 sm:max-h-40 overflow-y-auto custom-scrollbar">
                                {instVoiceTemplates.map(v => (
                                  <button 
                                    key={v.id} 
                                    onClick={() => setSelectedCommVoiceId('inst_' + v.id)}
                                    className={`w-full p-3 rounded-2xl border-2 text-left transition-all ${selectedCommVoiceId === 'inst_' + v.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50 bg-slate-50 hover:border-slate-100'}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[#1E3A8A] text-xs sm:text-sm">{v.title}</span>
                                      {selectedCommVoiceId === 'inst_' + v.id && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 ml-2" />}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">সিস্টেম ভয়েস টেমপ্লেট</label>
                            <div className="grid grid-cols-1 gap-2 max-h-40 sm:max-h-60 overflow-y-auto p-1 custom-scrollbar">
                              {awajVoices.length > 0 ? awajVoices.map(v => (
                                <button 
                                  key={v.id} 
                                  onClick={() => setSelectedCommVoiceId(v.id.toString())}
                                  className={`w-full p-3 sm:p-4 rounded-2xl border-2 text-left transition-all ${selectedCommVoiceId === v.id.toString() ? 'border-[#2563EB] bg-blue-50' : 'border-slate-50 bg-slate-50 hover:border-slate-100'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[#1E3A8A] text-xs sm:text-sm">{v.title || v.provider_voice_name}</span>
                                    {selectedCommVoiceId === v.id.toString() && <CheckCircle2 size={18} className="text-[#2563EB] shrink-0 ml-2" />}
                                  </div>
                                </button>
                              )) : (
                                <div className="text-center p-6 bg-slate-50 rounded-2xl">
                                   <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-slate-200 mx-auto mb-3" />
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">কোনো টেমপ্লেট পাওয়া যায়নি।<br/>অনুগ্রহ করে সিঙ্ক করুন।</p>
                                   <button onClick={handleFetchAwajVoices} className="mt-4 text-blue-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mx-auto hover:underline">
                                     <RefreshCw size={12} className={isFetchingAwajVoices ? 'animate-spin' : ''} /> Sync Now
                                   </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 sm:p-8 pt-4 sm:pt-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 shrink-0">
                  <button 
                    onClick={() => setCommsModal({ ...commsModal, show: false })}
                    className="flex-1 h-12 sm:h-14 bg-white border border-slate-200 text-slate-500 font-black rounded-full text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                  >
                    বাতিল
                  </button>
                  <button 
                    onClick={handleSendSpecificComm}
                    disabled={isSendingComm || (commsModal.type === 'sms' ? !commMessage.trim() : !selectedCommVoiceId)}
                    className="flex-[2] h-12 sm:h-14 bg-[#2563EB] text-white font-black rounded-full shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {isSendingComm ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> পাঠাতে ক্লিক করুন</>}
                  </button>
                </div>
             </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showRefreshPopup && createPortal(
          <div key="refresh-popup" className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
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

      <AnimatePresence mode="wait">
        {showRechargeModal.show && createPortal(
          <div key="recharge-modal" className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
               onClick={() => !isProcessingRecharge && setShowRechargeModal({ show: false, institution: null })}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="relative bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl overflow-hidden"
             >
                <div className="text-center mb-6">
                   <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Zap size={32} />
                   </div>
                   <h3 className="text-xl font-black text-[#1E3A8A] font-noto">Quick Assign Balance</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{showRechargeModal.institution?.name}</p>
                </div>

                <div className="space-y-5">
                   <div>
                      <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2 mb-2 block">ভয়েস রিচার্জ (৳)</label>
                      <div className="relative">
                         <input 
                           type="number" 
                           placeholder="0.00"
                           className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-slate-700 outline-none focus:border-emerald-200 transition-all"
                           value={rechargeAmount}
                           onChange={(e) => setRechargeAmount(e.target.value)}
                         />
                         <button 
                           onClick={() => handleQuickRecharge('voice')}
                           disabled={isProcessingRecharge || !rechargeAmount}
                           className="absolute right-2 top-2 h-10 px-4 bg-emerald-500 text-white font-black rounded-xl text-[10px] uppercase active:scale-95 transition-all disabled:opacity-50"
                         >
                           Add ৳
                         </button>
                      </div>
                   </div>

                   <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-slate-100"></div>
                      <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300">OR</span>
                      <div className="flex-grow border-t border-slate-100"></div>
                   </div>

                   <div>
                      <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 mb-2 block">SMS রিচার্জ (Count)</label>
                      <div className="relative">
                         <input 
                           type="number" 
                           placeholder="0"
                           className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-slate-700 outline-none focus:border-blue-200 transition-all"
                           value={rechargeSmsCount}
                           onChange={(e) => setRechargeSmsCount(e.target.value)}
                         />
                         <button 
                           onClick={() => handleQuickRecharge('sms')}
                           disabled={isProcessingRecharge || !rechargeSmsCount}
                           className="absolute right-2 top-2 h-10 px-4 bg-blue-500 text-white font-black rounded-xl text-[10px] uppercase active:scale-95 transition-all disabled:opacity-50"
                         >
                           Add SMS
                         </button>
                      </div>
                   </div>

                   <button 
                     onClick={() => setShowRechargeModal({ show: false, institution: null })}
                     disabled={isProcessingRecharge}
                     className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                   >
                     Cancel
                   </button>
                </div>
             </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
