
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Loader2, Send, ChevronDown, BookOpen, Users, CheckCircle2, MessageSquare, Plus, Edit3, Trash2, Smartphone, X, Check, History, Zap, AlertTriangle, Clock, Save, AlertCircle, Mic, Info, XCircle, Building2, Copy, ExternalLink, Wallet, AppWindow, ArrowRight } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { SMSTemplate, Language, Institution, Class, Student, Transaction, Profile, UserRole } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from 'services/ShortcodeService';
import { useOfflineStatus } from 'hooks/useOffline';
import VoiceBroadcast from './VoiceBroadcast';
import PaymentCheckout from '../components/PaymentCheckout';

import { requestManager } from 'services/RequestManager';

interface WalletSMSProps {
  lang: Language;
  madrasah: Institution | null;
  triggerRefresh: () => void;
  dataVersion: number;
  initialTab?: 'templates' | 'bulk-sms' | 'history' | 'recharge';
  role: UserRole;
  profile?: Profile | null;
  onBack: () => void;
  preSelectedInstitutionIds?: string[];
  initialMessage?: string;
}

const WalletSMS: React.FC<WalletSMSProps> = ({ lang, madrasah, triggerRefresh, dataVersion, initialTab, role, profile, onBack, preSelectedInstitutionIds = [], initialMessage = '' }) => {
  const isOnline = useOfflineStatus();
  const isTeacher = role === 'teacher';
  const canSendSms = !isTeacher || profile?.permissions?.can_send_sms;
  const isSuperAdmin = role === 'super_admin';

  if (!canSendSms) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'templates' | 'bulk-sms' | 'history' | 'recharge'>(initialTab || 'bulk-sms');
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const isSendingBulkRef = useRef(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showTemplateDropdownBulk, setShowTemplateDropdownBulk] = useState(false);
  const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<Institution[]>([]);
  const [targetType, setTargetType] = useState<'class' | 'teachers' | 'all_institutions' | 'specific_institution'>(isSuperAdmin ? 'all_institutions' : 'class');
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<string[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<SMSTemplate | null>(null);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempBody, setTempBody] = useState('');
  const [tempSystemEvent, setTempSystemEvent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showShortcodes, setShowShortcodes] = useState(false);

  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{donor_name}', label: lang === 'bn' ? 'দাতার নাম' : 'Donor Name' },
    { code: '{teacher_name}', label: lang === 'bn' ? 'শিক্ষকের নাম' : 'Teacher Name' },
    { code: '{father_name}', label: lang === 'bn' ? 'পিতার নাম' : 'Father Name' },
    { code: '{class}', label: lang === 'bn' ? 'শ্রেণী' : 'Class' },
    { code: '{roll}', label: lang === 'bn' ? 'রোল' : 'Roll' },
    { code: '{due_amount}', label: lang === 'bn' ? 'বকেয়া টাকা' : 'Due Amount' },
    { code: '{paid_amount}', label: lang === 'bn' ? 'পরিশোধিত/অনুদানের টাকা' : 'Paid/Donation Amount' },
    { code: '{receipt_no}', label: lang === 'bn' ? 'রসিদ নং' : 'Receipt No' },
    { code: '{fund_name}', label: lang === 'bn' ? 'তহবিলের নাম' : 'Fund Name' },
    { code: '{month}', label: lang === 'bn' ? 'মাস' : 'Month' },
    { code: '{result_grade}', label: lang === 'bn' ? 'রেজাল্ট গ্রেড' : 'Result Grade' },
    { code: '{gpa}', label: lang === 'bn' ? 'জিপিএ' : 'GPA' },
    { code: '{exam_name}', label: lang === 'bn' ? 'পরীক্ষার নাম' : 'Exam Name' },
    { code: '{exam_subject}', label: lang === 'bn' ? 'পরীক্ষার বিষয় ও নম্বর' : 'Exam Subjects & Marks' },
    { code: '{merit_position}', label: lang === 'bn' ? 'মেধাস্থান' : 'Merit Position' },
    { code: '{attendance_percentage}', label: lang === 'bn' ? 'উপস্থিতি হার' : 'Attendance %' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },
    { code: '{date}', label: lang === 'bn' ? 'তারিখ' : 'Date' },
  ];

  // Error/Status Modal
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'error' | 'balance' | 'success', title: string, message: string}>({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // Recharge Form States
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeStep, setRechargeStep] = useState<1 | 2>(1);
  const [rechargeType, setRechargeType] = useState<'sms' | 'voice'>('sms');
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');
  const [adminNagad, setAdminNagad] = useState('০১৭৬৬-XXXXXX');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [pendingTrxId, setPendingTrxId] = useState<string | null>(null);
  const [smsRate, setSmsRate] = useState<number>(madrasah?.sms_rate || 0.55);

  const [voiceRate, setVoiceRate] = useState<number>(madrasah?.voice_rate || 0.45);
  const [smsBalance, setSmsBalance] = useState<number>(0);

  const fetchWalletBalance = async () => {
    if (!madrasah?.id) return;
    try {
      const { data, error } = await supabase.from('institutions').select('sms_balance').eq('id', madrasah.id).single();
      if (error) {
        console.error('[WalletSMS] Error fetching balance:', error);
        return;
      }
      if (data) {
        console.log('[WalletSMS] Fetched balance:', data.sms_balance);
        setSmsBalance(data.sms_balance || 0);
      }
    } catch (e) {
      console.error('[WalletSMS] Exception in fetchWalletBalance:', e);
    }
  };

  useEffect(() => {
    if (preSelectedInstitutionIds.length > 0 && isSuperAdmin) {
      setTargetType('specific_institution');
      setSelectedInstitutionIds(preSelectedInstitutionIds);
      setActiveTab('bulk-sms');
    }
  }, [preSelectedInstitutionIds, isSuperAdmin]);

  useEffect(() => {
    if (initialMessage && initialMessage.trim()) {
      setBulkMessage(initialMessage);
    }
  }, [initialMessage]);

  useEffect(() => {
    const initRates = async () => {
      let vRate = madrasah?.voice_rate;
      let sRate = madrasah?.sms_rate;
      
      try {
        const { data } = await supabase.from('system_settings').select('sms_rate, voice_rate, sms_provider_config').eq('id', '00000000-0000-0000-0000-000000000001').single();
        
        const providerConfig = (data?.sms_provider_config as any) || {};
        const defaultType = providerConfig.default_type || 'non_masking';
        
        // Prioritize specific masking/non-masking rate from provider config, then institution-specific rate, then system default
        const isMaskingAccount = !!madrasah?.reve_client_id;
        const instSmsType = isMaskingAccount ? 'masking' : ((madrasah as any)?.sms_type || defaultType);
        
        if (instSmsType === 'masking' && providerConfig.masking_rate) {
          sRate = providerConfig.masking_rate;
        } else if (instSmsType === 'non_masking' && providerConfig.non_masking_rate) {
          sRate = providerConfig.non_masking_rate;
        }
        
        if (!sRate || sRate <= 0) {
          sRate = madrasah?.sms_rate;
          if (!sRate || sRate <= 0) {
            sRate = data?.sms_rate || 0.55;
          }
        }
        
        if (!vRate) vRate = data?.voice_rate || 0.45;
      } catch(e) {
        if (!vRate) vRate = 1.00;
        if (!sRate) sRate = 0.55;
      }

      setVoiceRate(vRate);
      setSmsRate(sRate);
    };

    if (madrasah) {
      initRates();
      setSmsBalance(madrasah.sms_balance || 0);
      fetchWalletBalance();
    }
  }, [madrasah?.id, madrasah?.voice_rate, madrasah?.sms_rate, madrasah?.sms_balance]);

  useEffect(() => { 
    if (activeTab === 'templates') fetchTemplates(); 
    if (activeTab === 'bulk-sms') { fetchClasses(); fetchTeachers(); fetchTemplates(); }
    if (activeTab === 'history') fetchSmsHistory();
    if (activeTab === 'recharge') { fetchSystemSettings(); fetchUserTransactions(); }
    fetchWalletBalance();
  }, [activeTab, madrasah?.id, dataVersion]);

  useEffect(() => {
    if (selectedClassId) fetchClassStudents(selectedClassId); else setClassStudents([]);
  }, [selectedClassId]);

  useEffect(() => {
    if (targetType === 'all_institutions' && isSuperAdmin) {
      setSelectedClassId('all_institutions');
      // Mock class students with institutions for UI consistency if needed
    } else {
      setSelectedClassId('');
    }
  }, [targetType]);

  const fetchSystemSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    if (settings.bkash_number) setAdminBkash(settings.bkash_number);
    if ((settings as any).nagad_number) setAdminNagad((settings as any).nagad_number);
    
    // Determine the active SMS rate based on provider config
    const providerConfig = (settings.sms_provider_config as any) || {};
    const defaultType = providerConfig.default_type || 'non_masking';
    const isMaskingAccount = !!madrasah?.reve_client_id;
    const instSmsType = isMaskingAccount ? 'masking' : ((madrasah as any)?.sms_type || defaultType);
    let activeSmsRate = 0;

    if (instSmsType === 'masking' && providerConfig.masking_rate) {
      activeSmsRate = providerConfig.masking_rate;
    } else if (instSmsType === 'non_masking' && providerConfig.non_masking_rate) {
      activeSmsRate = providerConfig.non_masking_rate;
    }

    if (!activeSmsRate || activeSmsRate <= 0) {
      activeSmsRate = madrasah?.sms_rate;
      if (!activeSmsRate || activeSmsRate <= 0) {
        activeSmsRate = settings.sms_rate || 0.55;
      }
    }

    if (activeSmsRate) setSmsRate(activeSmsRate);
    if (settings.voice_rate && !madrasah?.voice_rate) setVoiceRate(settings.voice_rate);
  };

  const fetchClasses = async () => {
    if (!madrasah) return;
    
    if (isSuperAdmin) {
      const { data: insts } = await supabase.from('institutions').select('*').neq('name', 'SYSTEM_GLOBAL_INTERNAL');
      if (insts) setAllInstitutions(insts);
    }

    try {
      const { data } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
        `classes:${madrasah.id}`,
        30 * 60 * 1000 // 30 mins
      );

      if (data) {
        let filteredClasses = data;
        if (role === 'teacher' && profile?.permissions?.allowed_classes) {
          filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
        }
        setClasses(sortMadrasahClasses(filteredClasses));
      }
    } catch (e) {
      console.error('Error fetching classes in WalletSMS:', e);
    }
  };

  const fetchTeachers = async () => {
    if (!madrasah) return;
    try {
      const { data } = await supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true);
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const formattedTeachers = data.map(t => {
          let parsedPermissions: any = {};
          if (typeof t.permissions === 'string') {
            try { parsedPermissions = JSON.parse(t.permissions); } catch(e) {}
          } else {
            parsedPermissions = t.permissions || {};
          }
          return {
            ...t,
            name: t.teacher_name,
            phone: t.mobile,
            leave_date: parsedPermissions.leave_date
          };
        });
        
        const activeTeachers = formattedTeachers.filter(t => {
          if (!t.leave_date) return true;
          const ld = String(t.leave_date).trim();
          if (ld === '') return true;
          return ld > today;
        });
        setTeachers(activeTeachers);
      }
    } catch (e) {
      console.error('Error fetching teachers in WalletSMS:', e);
    }
  };

  const fetchClassStudents = async (cid: string) => {
    let query = supabase.from('students').select('*').eq('class_id', cid);
    if ((window as any)._hasIsActive !== false) {
      query = query.eq('is_active', true);
    }
    const { data } = await query;
    if (data) setClassStudents(data);
  };

  const fetchTemplates = async () => {
    if (!madrasah) return;
    setLoading(true);
    const { data } = await supabase.from('sms_templates').select('*').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setTemplates(data);
    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    console.log('Saving template:', { madrasah, tempTitle, tempBody });
    if (!madrasah || !tempTitle.trim() || !tempBody.trim()) {
      console.log('Missing madrasah or title/body');
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please login first');

      const { data: profile } = await supabase.from('profiles').select('role, institution_id').eq('id', user.id).single();
      if (!profile) throw new Error('Profile not found');
      if (profile.institution_id !== madrasah.id && profile.role !== 'super_admin') {
        throw new Error('Permission denied for this institution');
      }

      // Normalize line endings to avoid double-char issues from CRLF in different browsers/OS
      const cleanBody = tempBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      if (editingId) {
        const { error } = await supabase.from('sms_templates').update({ title: tempTitle, body: cleanBody }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sms_templates').insert({ institution_id: madrasah.id, title: tempTitle, body: cleanBody });
        if (error) throw error;
      }
      
      // Update config_json if a system event is selected
      if (tempSystemEvent) {
         const { requestManager } = await import('../services/RequestManager');
         const updatedConfig = {
           ...madrasah.config_json,
           features: {
             ...((madrasah.config_json as any)?.features || {}),
             sms_templates: {
               ...((madrasah.config_json as any)?.features?.sms_templates || {}),
               [tempSystemEvent]: cleanBody
             }
           }
         };
         
         requestManager.invalidatePattern(`institution:${madrasah.id}`);
         await supabase.from('institutions').update({ config_json: updatedConfig }).eq('id', madrasah.id);
         if (triggerRefresh) triggerRefresh();
      }
      
      setShowAddModal(false);
      setTempTitle('');
      setTempBody('');
      setTempSystemEvent('');
      setEditingId(null);
      fetchTemplates();
    } catch (e: any) { 
      console.error('Error saving template:', e);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: e.message
      });
    } finally { setIsSaving(false); }
  };

  const handleDeleteTemplate = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      await supabase.from('sms_templates').delete().eq('id', showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      fetchTemplates();
    } catch (e: any) { 
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: e.message
      });
    } finally { setIsDeleting(false); }
  };

  const fetchUserTransactions = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('transactions')
      .select('*')
      .eq('institution_id', madrasah.id)
      .eq('module', 'sms')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setUserTransactions(data);
  };

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
          setStatusModal({
            show: true,
            type: 'success',
            title: lang === 'bn' ? 'রিচার্জ সফল' : 'Recharge Successful',
            message: lang === 'bn' ? 'আপনার পেমেন্ট সফলভাবে যাচাই করা হয়েছে।' : 'Your payment has been successfully verified.'
          });
          fetchWalletBalance();
          fetchUserTransactions();
          if (triggerRefresh) triggerRefresh();
        } else if (data?.status === 'rejected') {
          setIsWaitingPayment(false);
          setPendingTrxId(null);
          setStatusModal({
            show: true,
            type: 'error',
            title: lang === 'bn' ? 'পেমেন্ট প্রত্যাখ্যান করা হয়েছে' : 'Payment Rejected',
            message: lang === 'bn' ? 'আপনার পেমেন্ট বাতিল করা হয়েছে।' : 'Your payment has been rejected.'
          });
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isWaitingPayment, pendingTrxId]);

  const handleCopyNumber = (num: string) => {
    const cleanNum = num.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(cleanNum);
    // Simple feedback could be added here
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

  const handleRechargeRequest = async () => {
    if (!rechargeAmount || !madrasah) return;
    setRequesting(true);
    try {
      const { data, error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: parseInt(rechargeAmount),
        transaction_id: `PENDING_${Date.now()}`,
        description: `${paymentMethod.toUpperCase()} Recharge Request`,
        type: 'credit',
        status: 'pending',
        module: rechargeType === 'sms' ? 'sms' : 'voice',
        metadata: { payment_method: paymentMethod }
      }).select().single();

      if (error) throw error;
      
      setPendingTrxId(data.id);
      setIsWaitingPayment(true);
      setRechargeAmount('');
      setRechargeStep(1);
      fetchUserTransactions();
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Request Failed',
        message: err.message
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleSendBulk = async () => {
    if (isSendingBulkRef.current) return;
    if (!bulkMessage.trim() || !madrasah) return;
    
    const isTargetingInstitutions = isSuperAdmin && (targetType === 'all_institutions' || targetType === 'specific_institution');
    if (!isTargetingInstitutions && targetType === 'class' && (!selectedClassId || classStudents.length === 0)) return;
    if (!isTargetingInstitutions && targetType === 'teachers' && teachers.length === 0) return;
    if (isTargetingInstitutions && allInstitutions.length === 0) return;
    if (targetType === 'specific_institution' && selectedInstitutionIds.length === 0) return;

    if (!isOnline) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Offline',
        message: 'Internet required to send SMS.'
      });
      return;
    }

    isSendingBulkRef.current = true;
    setSendingBulk(true);
    try {
      if (isTargetingInstitutions) {
        // Super Admin Bulk Messaging to ALL INSTITUTIONS or SPECIFIC INSTITUTIONS
        let targets = allInstitutions;
        if (targetType === 'all_institutions') {
          targets = allInstitutions;
        } else if (targetType === 'specific_institution') {
          targets = allInstitutions.filter(inst => selectedInstitutionIds.includes(inst.id));
        }

        const phones = targets.map(inst => inst.phone).filter(p => !!p);
        if (phones.length === 0) throw new Error('No institutions with valid phone numbers found.');
        
        await smsApi.sendBulk(madrasah.id, targets.map(inst => ({ guardian_phone: inst.phone, student_name: inst.name })) as any[], bulkMessage);
      } else if (targetType === 'teachers') {
        const teacherTargets = teachers.map(t => ({ ...t, guardian_phone: t.phone, student_name: t.name }));
        await smsApi.sendBulk(madrasah.id, teacherTargets, bulkMessage);
      } else {
        await smsApi.sendBulk(madrasah.id, classStudents, bulkMessage);
      }
      
      setBulkSuccess(true); 
      setShowSuccessPopup(true);
      setBulkMessage(''); 
      setSelectedClassId('');
      triggerRefresh();
      setTimeout(() => setBulkSuccess(false), 3000);
    } catch (err: any) { 
      const isBalanceError = err.message.toLowerCase().includes('balance');
      setStatusModal({
        show: true,
        type: isBalanceError ? 'balance' : 'error',
        title: isBalanceError ? (lang === 'bn' ? 'ব্যালেন্স শেষ!' : 'Out of Balance!') : (lang === 'bn' ? 'ব্যর্থ' : 'Failed'),
        message: err.message
      });
    } finally { 
      isSendingBulkRef.current = false;
      setSendingBulk(false); 
    }
  };

  const handleSendFreeBulk = () => {
    if (!bulkMessage.trim() || classStudents.length === 0) return;
    const phones = classStudents.map(s => s.guardian_phone).join(',');
    const encodedMsg = encodeURIComponent(bulkMessage);
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phones}${separator}body=${encodedMsg}`;
  };

  const getSelectedClassName = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    return cls ? cls.class_name : (lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class');
  };

  const modules = useMemo(() => ({
    sms: true,
    ...(madrasah?.config_json?.modules || {})
  }), [madrasah?.config_json?.modules]);

  const availableTabs = useMemo(() => {
    return (['templates', 'bulk-sms', 'history', 'recharge'] as const).filter(tab => {
      if (tab === 'recharge' && role === 'teacher') return false;
      if (tab === 'templates' || tab === 'bulk-sms' || tab === 'history') return modules.sms !== false;
      return true;
    });
  }, [role, modules.sms]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'bulk-sms');
    }
  }, [availableTabs, activeTab]);

  const fetchSmsHistory = async () => {
    if (!madrasah?.id) return;
    setLoadingHistory(true);
    try {
      const history = await smsApi.getHistory(madrasah.id);
      setSmsHistory(history || []);
    } catch (err) {
      console.error("Failed to fetch SMS history:", err);
      setSmsHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Removed redundant useEffect


  return (
    <>
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="bg-[#2563EB] p-6 rounded-[2.2rem] shadow-premium border border-blue-100 flex items-center justify-between text-white relative">
           <div className="relative z-10">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">{t('available_sms', lang)}</p>
             <h3 className="text-4xl font-black flex items-baseline gap-2">{smsBalance}</h3>
           </div>
           <Zap size={40} className="text-white opacity-20" />
        </div>

        <div className="relative p-1.5 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-sm flex items-center h-16 mb-2">
          <div 
            className="absolute h-[calc(100%-12px)] rounded-[2.5rem] bg-[#2563EB] shadow-md transition-all duration-500 z-0"
            style={{ 
              width: availableTabs.length > 0 ? `calc((100% - 12px) / ${availableTabs.length})` : '0',
              left: availableTabs.length > 0 ? `calc(6px + ${Math.max(0, availableTabs.indexOf(activeTab))} * (100% - 12px) / ${availableTabs.length})` : '0',
            }}
          />
          {availableTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 h-full rounded-[2.5rem] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all z-10 ${activeTab === tab ? 'text-white' : 'text-slate-400'}`}>
              {tab === 'templates' ? <MessageSquare size={16} /> : 
               tab === 'bulk-sms' ? <Send size={16} /> : 
               tab === 'history' ? <History size={16} /> :
               <CreditCard size={16} />}
              <span className="font-noto">
                {tab === 'templates' ? t('templates', lang) : 
                 tab === 'bulk-sms' ? t('bulk_sms', lang) : 
                 tab === 'history' ? t('sms_history', lang) :
                 t('recharge', lang)}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('saved_templates', lang)}</h2>
              <button onClick={() => { setEditingId(null); setTempTitle(''); setTempBody(''); setTempSystemEvent(''); setShowAddModal(true); }} className="bg-[#2563EB] text-white px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-2 active:scale-95 transition-all border border-blue-100 shadow-premium">
                 <Plus size={14} strokeWidth={4} /> {t('new_template', lang)}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
               {loading ? (
                  <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" size={30} /></div>
               ) : templates.length > 0 ? (
                  templates.map(tmp => (
                    <div key={tmp.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble relative group flex flex-col">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB] border border-blue-100 shrink-0">
                                <BookOpen size={18} />
                             </div>
                             <h4 className="font-black text-[#1E3A8A] text-[15px] font-noto line-clamp-1">{tmp.title}</h4>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                             <button onClick={() => { 
                               setEditingId(tmp.id); 
                               setTempTitle(tmp.title || ''); 
                               setTempBody(tmp.body || ''); 
                               // Find if this is a system template
                               const sysTemplates = (madrasah?.config_json as any)?.features?.sms_templates || {};
                               const eventKey = Object.keys(sysTemplates).find(k => sysTemplates[k] === tmp.id || sysTemplates[k] === tmp.body);
                               setTempSystemEvent(eventKey || '');
                               setShowAddModal(true); 
                             }} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center active:scale-90 transition-all"><Edit3 size={14}/></button>
                             <button onClick={() => setShowDeleteConfirm(tmp)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center active:scale-90 transition-all"><Trash2 size={14}/></button>
                          </div>
                       </div>
                       <p className="text-sm font-bold text-slate-500 font-noto leading-relaxed flex-1">{tmp.body}</p>
                    </div>
                  ))
               ) : (
                  <div className="col-span-full text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                     <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_templates', lang)}</p>
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'bulk-sms' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-bubble border border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="space-y-7">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">
                      {isSuperAdmin ? 'লক্ষ্য নির্বাচন করুন (Target)' : t('step_1_class', lang)}
                    </h4>
                    
                    {/* Only show targeting options for non-super admins or if you want to keep 'all' for super admin but hide others */}
                    {isSuperAdmin && targetType === 'specific_institution' && selectedInstitutionIds.length > 0 ? (
                      <div className="bg-orange-50 p-6 rounded-[1.8rem] border border-orange-100 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest mb-1">Target: {selectedInstitutionIds.length} Selected Schools</p>
                          <p className="text-lg font-black text-[#1E3A8A]">Subscription Reminders</p>
                          <button 
                            onClick={() => {
                              setSelectedInstitutionIds([]);
                              setTargetType('all_institutions');
                            }}
                            className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500"
                          >
                            Reset Selection
                          </button>
                        </div>
                      </div>
                    ) : !isSuperAdmin ? (
                      <div className="relative space-y-3">
                        <div className="flex bg-slate-100 p-1 rounded-[1.5rem] mb-4">
                          <button
                            onClick={() => setTargetType('class')}
                            className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'class' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
                          >
                            {lang === 'bn' ? 'শিক্ষার্থী' : 'Students'}
                          </button>
                          <button
                            onClick={() => { setTargetType('teachers'); setSelectedClassId(''); }}
                            className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'teachers' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
                          >
                            {lang === 'bn' ? 'শিক্ষক' : 'Teachers'}
                          </button>
                        </div>

                        {targetType === 'class' ? (
                          <>
                            <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                              <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                              <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                            </button>
                               
                            {selectedClassId && (
                              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-[#2563EB]" />
                                <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-wider">
                                  {t('total_students', lang)}: {classStudents.length} {t('students_count', lang)}
                                </p>
                              </div>
                            )}

                            {showClassDropdown && (
                              <div className="absolute top-[120px] left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                {classes.map(cls => (
                                  <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                    <span className="font-black font-noto">{cls.class_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                            <Users size={16} className="text-indigo-600" />
                            <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                              {lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}: {teachers.length}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-blue-50 p-6 rounded-[1.8rem] border border-blue-100 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#2563EB] shadow-sm">
                          <Users size={24} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-widest mb-1">Target: All Active Institutes</p>
                          <p className="text-lg font-black text-[#1E3A8A]">{allInstitutions.length} Institutions Selected</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">Note: Individual school broadcast is handled via Admin Panel</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">{t('step_2_template', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowTemplateDropdownBulk(!showTemplateDropdownBulk)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen size={18} className="text-[#2563EB]" />
                          <span className={`text-base font-black font-noto ${selectedTemplateId ? 'text-[#1E3A8A]' : 'text-slate-400'}`}>
                            {selectedTemplateId ? (templates.find(t => t.id === selectedTemplateId)?.title || t('template_title', lang)) : t('template_title', lang)}
                          </span>
                        </div>
                        <ChevronDown className={`text-slate-300 transition-all ${showTemplateDropdownBulk ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showTemplateDropdownBulk && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                          {templates.length > 0 ? templates.map(tmp => (
                            <button key={tmp.id} onClick={() => { 
                              setBulkMessage(tmp.body); 
                              setSelectedTemplateId(tmp.id);
                              setShowTemplateDropdownBulk(false); 
                            }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 transition-all ${selectedTemplateId === tmp.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                              <p className="text-[10px] font-black text-[#2563EB] uppercase mb-0.5">{tmp.title}</p>
                              <p className="text-xs font-bold text-[#1E3A8A] truncate">{tmp.body}</p>
                            </button>
                          )) : (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">{t('no_templates', lang)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-7 flex flex-col">
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest">{t('step_3_message', lang)}</h4>
                    </div>
                    <div className="flex items-center justify-end px-1 mt-1">
                      <button 
                        onClick={() => setShowShortcodes(!showShortcodes)}
                        className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                      >
                        <Info size={12} /> Shortcodes
                      </button>
                    </div>

                    {showShortcodes && (
                      <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 mb-2 animate-in slide-in-from-top-2">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {availableShortcodes.map(sc => (
                            <button
                              key={sc.code}
                              onClick={() => {
                                setBulkMessage(prev => prev + sc.code);
                              }}
                              className="px-2 py-1 bg-white border border-blue-100 rounded-lg text-[10px] font-bold text-[#1E3A8A] hover:bg-blue-100 transition-colors"
                            >
                              {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-start gap-1 p-1.5 rounded-lg bg-blue-100/50">
                          <Info size={12} className="text-blue-500 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-blue-700 font-medium font-noto">
                            {lang === 'bn' ? 'নোট: পরীক্ষার শর্টকোডগুলো ({exam_name}, {exam_subject}, {result_grade}, {gpa}, {merit_position}) ক্লাসের সর্বশেষ প্রকাশিত পরীক্ষার ফলাফল পাঠাবে। নির্দিষ্ট পরীক্ষার এসএমএস পাঠাতে পরীক্ষা সেকশন থেকে এসএমএস অপশন ব্যবহার করুন।' : 'Note: Exam shortcodes ({exam_name}, {exam_subject}, {result_grade}, {gpa}, {merit_position}) fetch the latest published exam for the class.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="relative flex-1 flex flex-col">
                      <textarea className="w-full flex-1 min-h-[128px] px-5 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] text-[#1E3A8A] font-bold outline-none font-noto resize-none" placeholder={t('sms', lang) + "..."} value={bulkMessage} onChange={(e) => {
                        setBulkMessage(e.target.value);
                        setSelectedTemplateId(null);
                      }} />
                      <div className="absolute bottom-4 right-5 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm flex gap-2">
                         {(() => {
                            const previewMsg = madrasah ? ShortcodeService.getPreviewMessage(bulkMessage, madrasah.name) : bulkMessage;
                            const info = getSmsLengthInfo(previewMsg);
                            return (
                              <>
                                <span className="text-[10px] font-black text-slate-400">{info.isBangla ? 'Bangla' : 'English'}</span>
                                <span className="text-[10px] font-black text-[#2563EB]">{info.length}/{info.maxAllowed} ({info.parts} SMS)</span>
                              </>
                            );
                         })()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mt-auto">
                    <button 
                      onClick={handleSendBulk} 
                      disabled={sendingBulk || !bulkMessage.trim() || (targetType === 'class' && (!selectedClassId || classStudents.length === 0)) || (targetType === 'teachers' && teachers.length === 0) || (targetType === 'all_institutions' && allInstitutions.length === 0) || (targetType === 'specific_institution' && selectedInstitutionIds.length === 0) || (madrasah ? getSmsLengthInfo(ShortcodeService.getPreviewMessage(bulkMessage, madrasah.name)) : getSmsLengthInfo(bulkMessage)).parts > 7} 
                      className="w-full h-[64px] bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {sendingBulk ? <Loader2 className="animate-spin" size={24} /> : bulkSuccess ? (lang === 'bn' ? 'সফল!' : 'Success!') : (
                        <>
                          <Send size={20} /> 
                          {targetType === 'all_institutions' ? 'Send to All Institutions' : 
                           targetType === 'specific_institution' ? `SMS to ${selectedInstitutionIds.length} Institutions` : 
                           t('send_bulk_sms', lang)}
                        </>
                      )}
                    </button>
                    
                    <button onClick={handleSendFreeBulk} disabled={sendingBulk || !bulkMessage.trim() || (targetType === 'class' && classStudents.length === 0) || (targetType === 'teachers' && teachers.length === 0) || (madrasah ? getSmsLengthInfo(ShortcodeService.getPreviewMessage(bulkMessage, madrasah.name)) : getSmsLengthInfo(bulkMessage)).parts > 7} className="w-full h-[54px] bg-slate-800 text-white font-black rounded-full shadow-lg flex items-center justify-center gap-3 text-sm disabled:opacity-40 active:scale-95 transition-all">
                      <Smartphone size={20} /> {t('free_sms_sim', lang)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('sms_history', lang)}</h2>
              <button onClick={fetchSmsHistory} className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-all">
                <History size={14} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
              </button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('date', lang)}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipient', lang)}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('message', lang)}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('status', lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center">
                          <Loader2 className="animate-spin text-[#2563EB] mx-auto" size={30} />
                        </td>
                      </tr>
                    ) : smsHistory.length > 0 ? (
                      smsHistory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-700">{new Date(item.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                              <span className="text-[10px] font-bold text-slate-400">{new Date(item.date).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-black text-[#1E3A8A]">{item.recipient}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-500 line-clamp-2 max-w-xs font-noto">{item.message}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {item.status === 'sent' || item.status === 'delivered' ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
                                  <CheckCircle2 size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">{t('sent', lang)}</span>
                                </div>
                              ) : item.status === 'pending' ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                                  <Clock size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">{t('pending', lang)}</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100 w-fit">
                                    <XCircle size={12} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">{t('failed', lang)}</span>
                                  </div>
                                  {item.reason && (
                                    <span className="text-[9px] font-bold text-red-400 px-1">{item.reason}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center">
                          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_history', lang)}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <PaymentCheckout 
              lang={lang}
              madrasah={madrasah!}
              module="sms"
              onSuccess={(trx) => {
                triggerRefresh();
                fetchUserTransactions();
                fetchWalletBalance();
                setActiveTab('history');
              }}
              onCancel={() => setActiveTab('bulk-sms')}
              metadata={{ source: 'wallet_sms_page' }}
            />
            
            <div className="mt-12 space-y-4">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 flex items-center gap-2">
                  <History size={12} /> {t('recharge_history', lang)}
               </h2>
               <div className="grid grid-cols-1 gap-2.5">
                 {userTransactions.length > 0 ? userTransactions.map(tr => (
                   <div key={tr.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-[1.8rem] border flex items-center justify-between shadow-bubble`}>
                     <div className="min-w-0 flex-1">
                       <div className="flex items-center gap-2">
                         <p className={`text-[15px] font-black leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{tr.amount} ৳</p>
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : tr.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                           {tr.status === 'approved' ? (lang === 'bn' ? 'অনুমোদিত' : 'Approved') :
                            tr.status === 'pending' ? (lang === 'bn' ? 'অপেক্ষমান' : 'Pending') :
                            (lang === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected')}
                         </span>
                       </div>
                       <div className="flex items-center gap-2 mt-1.5">
                          <Clock size={10} className="text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-400">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                       </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black text-[#2563EB] uppercase tracking-tighter opacity-60">TrxID: {tr.transaction_id}</p>
                     </div>
                   </div>
                 )) : (
                   <div className={`text-center py-10 rounded-[2.5rem] border border-dashed ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">No history records</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </div>

      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-[0_50px_120px_rgba(0,0,0,0.15)] border border-slate-50 animate-in zoom-in-95 duration-500 relative overflow-hidden">
             
             <div className="relative mb-8">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 shadow-inner relative z-10 transition-all duration-700 ${
                  statusModal.type === 'balance' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                  statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' :
                  'bg-red-50 text-red-500 border-red-100'
                }`}>
                  {statusModal.type === 'balance' ? <Zap size={54} strokeWidth={2.5} fill="currentColor" /> :
                   statusModal.type === 'success' ? <CheckCircle2 size={54} strokeWidth={2.5} /> :
                   <AlertCircle size={54} strokeWidth={2.5} />}
                </div>
                {statusModal.type !== 'success' && (
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-20 mx-auto w-24 h-24 ${statusModal.type === 'balance' ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                )}
             </div>

             <h3 className="text-[24px] font-black text-[#2E0B5E] font-noto leading-tight tracking-tight">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-500 mt-3 font-noto px-2 leading-relaxed">
               {statusModal.message}
             </p>
             
             <div className="flex flex-col gap-3 mt-10">
                {statusModal.type === 'balance' ? (
                  <>
                    <button 
                      onClick={() => { setStatusModal({ ...statusModal, show: false }); setActiveTab('recharge'); }} 
                      className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-full shadow-xl shadow-purple-100 active:scale-95 transition-all text-sm uppercase tracking-[0.1em] flex items-center justify-center gap-3"
                    >
                      <Zap size={18} fill="currentColor" /> {lang === 'bn' ? 'রিচার্জ করুন' : 'Recharge Now'}
                    </button>
                    <button 
                      onClick={() => setStatusModal({ ...statusModal, show: false })} 
                      className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setStatusModal({ ...statusModal, show: false })} 
                    className={`w-full py-5 font-black rounded-full text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${statusModal.type === 'success' ? 'bg-[#2E0B5E] text-white shadow-slate-200' : 'bg-red-500 text-white shadow-red-100'}`}
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
                  </button>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}

      {showSuccessPopup && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-12 text-center shadow-[0_40px_100px_rgba(141,48,244,0.3)] border border-[#8D30F4]/10 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-100">
                 <CheckCircle2 size={56} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 font-noto tracking-tight">{t('sent_successfully', lang)}</h3>
              <p className="text-[11px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">{t('sms_success', lang)}</p>
              <button 
                onClick={() => setShowSuccessPopup(false)} 
                className="w-full mt-10 py-5 premium-btn text-white font-black rounded-full shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                {t('ok', lang)}
              </button>
           </div>
        </div>,
        document.body
      )}
      
      {showAddModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(141,48,244,0.2)] border border-[#8D30F4]/5 relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#8D30F4] transition-all p-1">
                 <X size={26} strokeWidth={3} />
              </button>
              <div className="flex items-center gap-5 mb-8">
                 <div className="w-16 h-16 bg-[#8D30F4]/10 rounded-[1.8rem] flex items-center justify-center text-[#8D30F4] border border-[#8D30F4]/10 shadow-inner">
                    <MessageSquare size={32} />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('add_template', lang)}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SMS Template</p>
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">{t('name', lang)}</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] font-noto outline-none focus:border-[#8D30F4]/30" placeholder={t('name', lang)} value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} />
                 </div>
                 
                 <div className="space-y-2 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">
                      {lang === 'bn' ? 'সিস্টেম টেমপ্লেট হিসেবে সেট করুন (ঐচ্ছিক)' : 'Set as System Template (Optional)'}
                    </label>
                    <select 
                      value={tempSystemEvent} 
                      onChange={(e) => setTempSystemEvent(e.target.value)}
                      className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-slate-600 outline-none focus:border-[#8D30F4]/30"
                    >
                      <option value="">{lang === 'bn' ? '-- নির্বাচন করুন --' : '-- Select --'}</option>
                      <option value="attendance_present">{lang === 'bn' ? 'উপস্থিত SMS' : 'Attendance Present SMS'}</option>
                      <option value="attendance_absent">{lang === 'bn' ? 'অনুপস্থিত SMS' : 'Attendance Absent SMS'}</option>
                      <option value="attendance_late">{lang === 'bn' ? 'বিলম্ব SMS' : 'Attendance Late SMS'}</option>
                      <option value="fee_collection">{lang === 'bn' ? 'বেতন আদায় SMS' : 'Fee Collection SMS'}</option>
                      <option value="donation_collection">{lang === 'bn' ? 'দান আদায় SMS' : 'Donation Collection SMS'}</option>
                      <option value="teacher_salary">{lang === 'bn' ? 'শিক্ষক বেতন SMS' : 'Teacher Salary SMS'}</option>
                    </select>
                 </div>
                 <div className="space-y-2 px-1 relative">
                    <div className="flex items-center justify-between px-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{t('step_3_message', lang)}</label>
                       <button 
                         onClick={() => setShowShortcodes(!showShortcodes)}
                         className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                       >
                         <Info size={10} /> Shortcodes
                       </button>
                    </div>

                    {showShortcodes && (
                       <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100/50 mb-2 animate-in slide-in-from-top-2">
                         <div className="flex flex-wrap gap-1.5">
                           {availableShortcodes.map(sc => (
                             <button
                               key={sc.code}
                               onClick={() => {
                                 setTempBody(prev => prev + sc.code);
                               }}
                               className="px-2 py-1 bg-white border border-purple-100 rounded-lg text-[9px] font-bold text-[#2E0B5E] hover:bg-purple-100 transition-colors"
                             >
                               {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                             </button>
                           ))}
                         </div>
                       </div>
                    )}

                    <textarea className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] px-6 py-4 font-bold text-slate-600 font-noto outline-none focus:border-[#8D30F4]/30 resize-none" placeholder={t('sms', lang) + "..."} value={tempBody} onChange={(e) => setTempBody(e.target.value)} />
                    <div className="absolute bottom-4 right-5 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm flex gap-2">
                       {(() => {
                          const previewMsg = madrasah ? ShortcodeService.getPreviewMessage(tempBody, madrasah.name) : tempBody;
                          const info = getSmsLengthInfo(previewMsg);
                          return (
                            <>
                              <span className="text-[10px] font-black text-slate-400">{info.isBangla ? 'Bangla' : 'English'}</span>
                              <span className="text-[10px] font-black text-[#8D30F4]">{info.length}/{info.maxAllowed} ({info.parts} SMS)</span>
                            </>
                          );
                       })()}
                    </div>
                 </div>
                 <button onClick={handleSaveTemplate} disabled={isSaving || !tempTitle || !tempBody || (madrasah ? getSmsLengthInfo(ShortcodeService.getPreviewMessage(tempBody, madrasah.name)) : getSmsLengthInfo(tempBody)).parts > 7} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg">
                    {isSaving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> {editingId ? t('edit', lang) : t('save', lang)}</>}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 font-noto">{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4 leading-relaxed">
                  Are you sure you want to delete this template?
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleDeleteTemplate} 
                  disabled={isDeleting} 
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={22} /> : (
                    <><Trash2 size={20} /> {t('delete', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)} 
                  disabled={isDeleting}
                  className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  {t('cancel', lang)}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default WalletSMS;
