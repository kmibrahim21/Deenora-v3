import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mic, 
  Upload, 
  CreditCard, 
  Play,
  Pause,
  Send, 
  History, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ChevronDown, 
  Trash2, 
  Smartphone,
  Zap,
  AlertTriangle,
  RefreshCw,
  Users,
  Check,
  Building2,
  X,
  ExternalLink,
  Copy,
  ArrowRight,
  ChevronLeft
} from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language, Class, Student, Profile, UserRole, Transaction } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';
import { normalizePhone } from 'utils/smsUtils';
import { useOfflineStatus } from 'hooks/useOffline';
import PaymentCheckout from '../components/PaymentCheckout';

import { requestManager } from 'services/RequestManager';
import { isValidUUID } from 'utils/validation';

interface VoiceBroadcastProps {
  lang: Language;
  madrasah: Institution | null;
  triggerRefresh: () => void;
  dataVersion: number;
  isEmbedded?: boolean;
  role: UserRole;
  profile?: Profile | null;
  onBack: () => void;
  preSelectedStudentIds?: string[];
  preSelectedInstitutionIds?: string[];
}

const VoiceBroadcast: React.FC<VoiceBroadcastProps> = ({ lang, madrasah, triggerRefresh, dataVersion, isEmbedded = false, role, profile, onBack, preSelectedStudentIds = [], preSelectedInstitutionIds = [] }) => {
  const isOnline = useOfflineStatus();
  const isTeacher = role === 'teacher';
  const canUseVoice = role !== 'teacher' || profile?.permissions?.can_use_voice_call || profile?.permissions?.voice_dashboard;
  const isPreSelected = preSelectedStudentIds.length > 0;
  const isInstPreSelected = preSelectedInstitutionIds.length > 0;
  const isSuperAdmin = role === 'super_admin';

  if (!canUseVoice) {
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

  const [activeTab, setActiveTab] = useState<'templates' | 'broadcast' | 'recharge' | 'history'>('broadcast');
  const [loading, setLoading] = useState(false);
  
  const modules = useMemo(() => ({
    voice_broadcast: true,
    ...(madrasah?.config_json?.modules || {})
  }), [madrasah?.config_json?.modules]);

  const availableTabs = useMemo(() => {
    return (['templates', 'broadcast', 'history', 'recharge'] as const).filter(tab => {
      if (tab === 'recharge' && role === 'teacher') return false;
      if (tab === 'templates' || tab === 'broadcast') return modules.voice_broadcast !== false;
      return true;
    });
  }, [role, modules.voice_broadcast]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'broadcast');
    }
  }, [availableTabs, activeTab]);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  
  // Voices state
  const [voices, setVoices] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Transaction state
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);

  // Broadcast state
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<Institution[]>([]);
  const [targetType, setTargetType] = useState<'all' | 'class' | 'teachers' | 'all_institutions' | 'specific_institution'>(isSuperAdmin ? 'all_institutions' : 'class');
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<string[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [classStudents, setClassStudents] = useState<any[]>([]);

  useEffect(() => {
    if (selectedClassId) fetchClassStudents(selectedClassId); else setClassStudents([]);
  }, [selectedClassId]);

  const fetchClassStudents = async (cid: string) => {
    let query = supabase.from('students').select('id, guardian_phone, guardian_phone_2').eq('class_id', cid);
    if ((window as any)._hasIsActive !== false) {
      query = query.eq('is_active', true);
    }
    const { data } = await query;
    if (data) setClassStudents(data);
  };

  useEffect(() => {
    if (isInstPreSelected && isSuperAdmin) {
      setTargetType('specific_institution');
      setSelectedInstitutionIds(preSelectedInstitutionIds);
    }
  }, [isInstPreSelected, preSelectedInstitutionIds, isSuperAdmin]);

  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (id: string, url: string) => {
    if (!audioRef.current) return;
    
    // Stop current playback
    audioRef.current.pause();
    
    if (playingId === id) {
      setPlayingId(null);
    } else {
      // Small delay to ensure previous state is cleared
      setPlayingId(null);
      
      try {
        if (!url) {
          throw new Error('Audio URL is empty');
        }

        const isExternal = url.startsWith('http') && !url.includes(window.location.hostname) && !url.includes('supabase.co');
        const finalUrl = isExternal ? `/api/proxy-audio?url=${encodeURIComponent(url)}` : url;

        audioRef.current.src = finalUrl;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setPlayingId(id);
            })
            .catch(err => {
              console.error('Playback Error details:', {
                error: err,
                url: url,
                id: id
              });
              
              setPlayingId(null);
              
              let errorMsg = err.message || 'Unknown playback error';
              if (err.name === 'NotSupportedError') {
                errorMsg = lang === 'bn' ? 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে সাপোর্ট করছে না।' : 'This audio format is not supported by your browser.';
              } else if (err.name === 'NotAllowedError') {
                errorMsg = lang === 'bn' ? 'ব্রাউজার অডিও প্লে করার অনুমতি দিচ্ছে না। দয়া করে পেজটি রিফ্রেশ করুন।' : 'Playback was blocked by the browser. Please refresh and try again.';
              }
              
              setStatusModal({
                show: true,
                type: 'error',
                title: lang === 'bn' ? 'প্লেব্যাক এরর' : 'Playback Error',
                message: lang === 'bn' 
                  ? `অডিও প্লে করতে সমস্যা হচ্ছে: ${errorMsg} (URL: ${url.substring(0, 30)}...)` 
                  : `Failed to play audio: ${errorMsg} (URL: ${url.substring(0, 30)}...)`
              });
            });
        }
      } catch (err: any) {
        console.error('Audio initialization error:', err);
        setStatusModal({
          show: true,
          type: 'error',
          title: 'Error',
          message: err.message
        });
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setPlayingId(null);
      const handlePause = () => setPlayingId(null);
      const handlePlay = () => {
        // Find which ID is currently playing by matching src if needed, 
        // but togglePlay handles this.
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('pause', handlePause);
      return () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
      };
    }
  }, []);

  // History state
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyDetails, setHistoryDetails] = useState<any | null>(null);
  const [studentNamesMap, setStudentNamesMap] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [retryModal, setRetryModal] = useState<{
    show: boolean,
    broadcast: any,
    failedLogs: any[],
    voiceId: string,
    senderId: string,
    phoneNumbers: string[]
  }>({
    show: false,
    broadcast: null,
    failedLogs: [],
    voiceId: '',
    senderId: '',
    phoneNumbers: []
  });

  const handleClaimRefund = async (broadcastId: string) => {
    setRefundingId(broadcastId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/voice-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ broadcast_id: broadcastId })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.already_refunded) {
           setStatusModal({ show: true, type: 'balance', title: lang === 'bn' ? 'অলরেডি রিফান্ডেড' : 'Already Refunded', message: lang === 'bn' ? 'এই ব্রডকাস্টের রিফান্ড আগেই নেওয়া হয়েছে।' : 'Refund for this broadcast has already been claimed.' });
        } else {
           throw new Error(result.error || 'Failed to claim refund');
        }
      } else {
        setStatusModal({ show: true, type: 'success', title: lang === 'bn' ? 'রিফান্ড সফল!' : 'Refund Successful!', message: lang === 'bn' ? `${result.refunded_calls} টি আনরিসিভ কলের জন্য ${result.refund_amount} ৳ আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।` : `${result.refund_amount} ৳ has been refunded to your wallet for ${result.refunded_calls} unreceived calls.` });
        fetchWalletBalance();
        triggerRefresh();
        fetchUserTransactions();
      }
    } catch (err: any) {
      console.error('Refund claim error:', err);
      setStatusModal({ show: true, type: 'error', title: 'Error', message: err.message || 'Error processing refund' });
    } finally {
      setRefundingId(null);
    }
  };

  const handleClaimRefundAuto = async (broadcastId: string, campaignId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload: any = { broadcast_id: broadcastId };
      if (campaignId) payload.campaign_id = campaignId;

      const response = await fetch('/api/voice-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && !result.already_refunded && result.refund_amount > 0) {
        // Show a small success toast for auto-refund
        setStatusModal({ 
          show: true, 
          type: 'success', 
          title: lang === 'bn' ? 'অটো রিফান্ড সফল' : 'Auto Refund Successful', 
          message: lang === 'bn' ? `${result.refund_amount} ৳ রিফান্ড দেওয়া হয়েছে।` : `${result.refund_amount} ৳ has been refunded automatically.` 
        });
        // Automatically fetch wallet balance if a refund occurred in the background
        fetchWalletBalance();
        triggerRefresh();
        fetchUserTransactions();
      }
    } catch (err: any) {
      console.error('Auto refund claim error:', err);
    }
  };

  const [historyDeleteConfirm, setHistoryDeleteConfirm] = useState<string | null>(null);

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryDeleteConfirm(id);
  };

  const confirmDeleteHistory = async () => {
    if (!historyDeleteConfirm) return;
    setIsDeleting(true);
    
    try {
      const { error } = await supabase.from('voice_broadcasts').delete().eq('id', historyDeleteConfirm);
      if (error) throw error;
      
      setBroadcastHistory(prev => prev.filter(h => h.id !== historyDeleteConfirm));
      if (expandedHistoryId === historyDeleteConfirm) {
        setExpandedHistoryId(null);
        setHistoryDetails(null);
      }
      
      setHistoryDeleteConfirm(null);
      
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফলভাবে মুছে ফেলা হয়েছে' : 'Deleted Successfully',
        message: lang === 'bn' ? 'ব্রডকাস্ট ইতিহাস তালিকা থেকে মুছে দেওয়া হয়েছে।' : 'The broadcast history has been removed from the list.'
      });
    } catch (err: any) {
      console.error('Delete history error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'মুছে ফেলা ব্যর্থ' : 'Delete Failed',
        message: err.message
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Upload state
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Recharge state
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeStep, setRechargeStep] = useState<1 | 2>(1);
  const [isRecharging, setIsRecharging] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');
  const [adminNagad, setAdminNagad] = useState('০১৭৬৬-XXXXXX');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [pendingTrxId, setPendingTrxId] = useState<string | null>(null);
  const [voiceRate, setVoiceRate] = useState(madrasah?.voice_rate || 0.50);

  useEffect(() => {
    const initRate = async () => {
      let r = madrasah?.voice_rate;
      if (!r) {
        try {
          const { data } = await supabase.from('system_settings').select('voice_rate').eq('id', '00000000-0000-0000-0000-000000000001').single();
          r = data?.voice_rate || 0.50;
        } catch(e) {
          r = 0.50;
        }
      }
      setVoiceRate(r);
    };
    if (madrasah) {
      initRate();
    }
  }, [madrasah]);

  // Error/Status Modal
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'error' | 'balance' | 'success', title: string, message: string}>({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, providerId: string | null, fileUrl: string | null, title: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!madrasah && !isSuperAdmin) return;
    fetchWalletBalance();
    if (activeTab === 'templates') fetchVoices();
    if (activeTab === 'broadcast') { 
      if (madrasah && isValidUUID(madrasah.id)) {
        fetchClasses();
        fetchTeachers();
      } 
      fetchVoices(); 
      fetchSenders(); 
    }
    if (activeTab === 'history') {
      fetchHistory();
      fetchVoices();
      fetchSenders();
    }
    if (activeTab === 'recharge') {
      fetchSystemSettings();
      fetchUserTransactions();
    }
  }, [activeTab, madrasah?.id, madrasah?.balance, madrasah?.sms_balance, dataVersion]);

  const fetchSystemSettings = async () => {
    const { data } = await supabase.from('system_settings').select('bkash_number, nagad_number, voice_rate').single();
    if (data?.bkash_number) setAdminBkash(data.bkash_number);
    if ((data as any)?.nagad_number) setAdminNagad((data as any).nagad_number);
    if (data?.voice_rate) setVoiceRate(data.voice_rate);
  };

  const fetchWalletBalance = async () => {
    if (!madrasah && !isSuperAdmin) return;
    
    let targetId = madrasah?.id;
    if (isSuperAdmin && (!targetId || !isValidUUID(targetId))) {
       const { data: sysInst } = await supabase.from('institutions').select('id, balance').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
       if (sysInst && sysInst.length > 0) {
         setWalletBalance(sysInst[0].balance || 0);
         return;
       }
       setWalletBalance(999999);
       return;
    }
    
    if (targetId && isValidUUID(targetId)) {
      const { data } = await supabase.from('institutions').select('balance').eq('id', targetId).single();
      if (data) setWalletBalance(data.balance);
    }
  };

  const fetchUserTransactions = async () => {
    if (!madrasah && !isSuperAdmin) return;
    setIsFetchingTransactions(true);
    try {
      let query = supabase.from('transactions')
        .select('*');
      
      if (madrasah?.id && isValidUUID(madrasah.id)) {
        query = query.eq('institution_id', madrasah.id);
      }
      
      const { data } = await query
        .eq('module', 'voice')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setUserTransactions(data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsFetchingTransactions(false);
    }
  };

  const fetchVoices = async () => {
    if (!madrasah && !isSuperAdmin) return;
    setLoading(true);
    try {
      setApiError(null);
      // Fetch from Awaj API
      let apiVoices: any[] = [];
      const response = await fetch('/api/awaj/voices');
      if (response.ok) {
        const data = await response.json();
        apiVoices = Array.isArray(data) ? data : (data.voices || data.data || []);
        console.log('Awaj Voices List:', apiVoices);
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(errData.error || `Awaj API Error: ${response.status}`);
      }

      // First, get local voices
      let systemId = null;
      try {
        const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
        if (sysInst && sysInst.length > 0) systemId = sysInst[0].id;
      } catch (e) {
        console.warn("Could not fetch system institution ID:", e);
      }

      let templateQuery = supabase.from('voice_templates').select('*');
      
      if (isSuperAdmin) {
        // Super Admin can see system, their own, and unassigned templates
        if (systemId && madrasah?.id && madrasah.id !== systemId) {
          templateQuery = templateQuery.or(`institution_id.eq.${systemId},institution_id.eq.${madrasah.id},institution_id.is.null`);
        } else if (madrasah?.id) {
          templateQuery = templateQuery.or(`institution_id.eq.${madrasah.id},institution_id.is.null`);
        } else {
          templateQuery = templateQuery.is('institution_id', null);
        }
      } else {
        // Regular institutions see their own templates, global system templates, and unassigned templates
        if (systemId && madrasah?.id) {
          templateQuery = templateQuery.or(`institution_id.eq.${madrasah.id},institution_id.eq.${systemId},institution_id.is.null`);
        } else if (madrasah?.id) {
          templateQuery = templateQuery.or(`institution_id.eq.${madrasah.id},institution_id.is.null`);
        }
      }

      const { data: localVoices } = await templateQuery.order('created_at', { ascending: false });
      
      if (localVoices) {
        // Sync statuses and IDs from Awaj API, ensuring auto-approval
        const syncedVoices = [];
        for (const localVoice of localVoices) {
          // Try to find matching voice in API by ID or Name
          const awajVoice = apiVoices.find(v => 
            (localVoice.provider_voice_id && v.id && v.id.toString() === localVoice.provider_voice_id.toString()) || 
            (v.name && v.name.toLowerCase() === (localVoice.title || '').toLowerCase())
          );

          const newProviderId = awajVoice?.id ? awajVoice.id.toString() : localVoice.provider_voice_id;
          const newProviderName = awajVoice?.name || localVoice.provider_voice_name;
          
          // Auto-approve voice locally and in DB so Direct Broadcast API works seamlessly
          if (localVoice.provider_status !== 'approved' || localVoice.admin_status !== 'approved' || (newProviderId && localVoice.provider_voice_id !== newProviderId)) {
            await supabase.from('voice_templates').update({ 
              admin_status: 'approved',
              provider_status: 'approved',
              provider_voice_id: newProviderId || localVoice.provider_voice_id,
              provider_voice_name: newProviderName || localVoice.provider_voice_name
            }).eq('id', localVoice.id);
            
            localVoice.admin_status = 'approved';
            localVoice.provider_status = 'approved';
            localVoice.provider_voice_id = newProviderId || localVoice.provider_voice_id;
            localVoice.provider_voice_name = newProviderName || localVoice.provider_voice_name;
          }
          syncedVoices.push(localVoice);
        }
        setVoices(syncedVoices);
      }

    } catch (error: any) {
      console.error('Error fetching voices:', error);
      setApiError(error.message || 'Failed to fetch voices. Please check your internet connection or server status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoice = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const { id, providerId, fileUrl } = showDeleteConfirm;
      // 1. Delete from Awaj Digital if linked
      if (providerId) {
        await fetch(`/api/awaj/voices/${providerId}`, { method: 'DELETE' });
      }
      
      if (fileUrl && fileUrl.includes('supabase.co')) {
        const fileName = fileUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('voice-templates').remove([`voices/${fileName}`]);
        }
      }

      const { error } = await supabase.from('voice_templates').delete().eq('id', id);
      if (error) throw error;
      
      setVoices(voices.filter(v => v.id !== id));
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ভয়েস সফলভাবে ডিলিট করা হয়েছে' : 'Voice deleted successfully.'
      });
      setShowDeleteConfirm(null);
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchSenders = async () => {
    try {
      setApiError(null);
      // Fetch default senders from Awaj API
      const response = await fetch('/api/awaj/senders');
      let sendersList: any[] = [];
      
      if (response.ok) {
        const data = await response.json();
        let fetchedList = Array.isArray(data) ? data : (data.senders || data.data || []);
        
        // Filter out old senders and keep only +880 9610-993084 (or its variations)
        sendersList = fetchedList.filter(s => {
          const num = String(s.callingNumber || s.caller_id || s.id || '');
          return num.includes('9610993084') || num.includes('9610-993084');
        });

        console.log('Awaj Senders List (Filtered):', sendersList);
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(errData.error || `Awaj API Error: ${response.status}`);
      }

      if (madrasah?.voice_sender_id) {
        // Check if it's already in the list
        const exists = sendersList.some(s => 
          (s.callingNumber === madrasah.voice_sender_id) || 
          (s.caller_id === madrasah.voice_sender_id) || 
          (s.id === madrasah.voice_sender_id)
        );

        if (!exists) {
          sendersList.unshift({
            id: madrasah.voice_sender_id,
            callingNumber: madrasah.voice_sender_id,
            name: 'Dedicated Sender ID'
          });
        }
      }

      setSenders(sendersList);
      if (sendersList.length > 0 && !selectedSenderId) {
        setSelectedSenderId(sendersList[0].id || sendersList[0].callingNumber || sendersList[0].caller_id);
      }
    } catch (error: any) {
      console.error('Error fetching senders:', error);
      setApiError(error.message || 'Failed to fetch senders.');
    }
  };

  useEffect(() => {
    if (madrasah) {
      fetchSenders();
    }
  }, [madrasah]);

  
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
      console.error('Error fetching teachers in VoiceBroadcast:', e);
    }
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
      console.error('Error fetching classes in VoiceBroadcast:', e);
    }
  };

  const fetchHistory = async (isBackground = false) => {
    if (!madrasah && !isSuperAdmin) return;
    if (!isBackground) setLoading(true);
    
    let query = supabase.from('voice_broadcasts').select('*, voice_templates(title)');
    
    // For super admins, show all history if they are in the super admin panel (madrasah.id is 'super_admin')
    // Otherwise filter by institution
    if (!isSuperAdmin || (madrasah && isValidUUID(madrasah.id))) {
      if (madrasah?.id && isValidUUID(madrasah.id)) {
        query = query.eq('institution_id', madrasah.id);
      }
    }
    
    const { data } = await query.order('created_at', { ascending: false }).limit(200);
    if (data) setBroadcastHistory(data);
    
    // Track results for pending/sending broadcasts
    if (data) {
      data.filter(b => b.status === 'sending' || b.status === 'pending').forEach(async (broadcast) => {
        // Track the latest campaign (either the original or the latest retry)
        const activeCampaignId = (broadcast.retries && broadcast.retries.length > 0) 
          ? broadcast.retries[broadcast.retries.length - 1] 
          : broadcast.provider_campaign_id;
          
        if (!activeCampaignId) return;
        try {
          const response = await fetch(`/api/awaj/broadcast/${activeCampaignId}`);
          if (response.ok) {
            const result = await response.json();
            // Map Awaj status to our internal status
            let newStatus = broadcast.status; // Default to current status if unknown
            const providerStatus = (result.broadcast?.status || result.status || result.state || '').toLowerCase();
            
            if (['pending', 'queued', 'scheduled'].includes(providerStatus)) {
              newStatus = 'pending';
            } else if (['sending', 'processing', 'running', 'broadcasting'].includes(providerStatus)) {
              newStatus = 'sending';
            } else if (['failed', 'error', 'cancelled'].includes(providerStatus)) {
              newStatus = 'failed';
            } else if (['completed', 'done', 'success', 'complete', 'finished', 'finished_success'].includes(providerStatus)) {
              newStatus = 'completed';
            }

            if (newStatus !== broadcast.status) {
              await supabase.from('voice_broadcasts').update({ status: newStatus }).eq('id', broadcast.id);
              
              if (newStatus === 'completed' || newStatus === 'failed') {
                 handleClaimRefundAuto(broadcast.id, activeCampaignId);
              }
              
              // Refresh history if status changed
              fetchHistory(true);
            }
          }
        } catch (error) {
          console.error('Error tracking broadcast result:', error);
        }
      });
    }
    setLoading(false);
  };

  // Background polling for pending/sending broadcasts
  useEffect(() => {
    if (!madrasah && !isSuperAdmin) return;
    
    const pollInterval = setInterval(() => {
      const hasPending = broadcastHistory.some(b => b.status === 'sending' || b.status === 'pending');
      if (hasPending || activeTab === 'history') {
        fetchHistory(true);
      }
    }, 7000); // Every 7 seconds instead of 15s

    return () => clearInterval(pollInterval);
  }, [madrasah?.id, broadcastHistory, activeTab]);

  const extractPhoneFromLog = (log: any) => {
    if (!log) return null;
    let p = log.phoneNumber || log.phone || log.number || log.to || log.msisdn || log.recipient || log.mobile || log.destination || log.phone_number || log.to_number || log.receiver || log.phone_no || log.mobile_no || log.to_msisdn || log.to_mobile;
    
    if (!p) {
      for (const key in log) {
        if (typeof log[key] === 'string' && log[key].replace(/[^0-9]/g, '').length >= 10) {
          p = log[key];
          break;
        }
      }
    }
    return p;
  };

  const handleRetryFailed = async (broadcast: any, failedLogs: any[]) => {
    if (!failedLogs.length) return;
    
    // Extract phone numbers from failed logs using a more robust method
    const phoneNumbers = failedLogs.map(log => extractPhoneFromLog(log)).filter(Boolean);
    
    if (!phoneNumbers.length) {
      console.log('Failed logs missing phone numbers:', failedLogs);
      setStatusModal({ show: true, title: 'Error', type: 'error', message: 'No valid phone numbers found to retry.' });
      return;
    }

    setRetryModal({
      show: true,
      broadcast,
      failedLogs,
      voiceId: broadcast.voice_template_id || '',
      senderId: '', // sender_id was removed from DB, user should select from the list in popup
      phoneNumbers
    });
  };

  const [isRetrying, setIsRetrying] = useState(false);

  const executeRetry = async () => {
    const { broadcast, voiceId, senderId, phoneNumbers } = retryModal;
    
    if (!voiceId || !senderId) {
      setStatusModal({ show: true, title: 'Error', type: 'error', message: 'Please select a voice and sender.' });
      return;
    }

    try {
      setIsRetrying(true);
      
      // Find the actual voice name and sender number from the state
      const voice = voices.find(v => v.id?.toString() === voiceId?.toString());
      const sender = senders.find(s => {
        const sId = (s.id || s.callingNumber || s.caller_id || '').toString();
        return sId === senderId?.toString();
      });

      if (!voice || !sender) {
        console.log('Retry Modal Info:', { voiceId, senderId, voicesCount: voices.length, sendersCount: senders.length });
        setStatusModal({ show: true, title: 'Error', type: 'error', message: 'Selected voice template or sender is no longer available.' });
        return;
      }

      const voiceName = voice.provider_voice_name || voice.title || voice.name || voice.voice_name || voice.id;
      let sNumber = (sender.callingNumber || sender.caller_id || sender.number || sender.sender_id || sender.id).toString();

      // Ensure sender is in 8801... format
      const digits = sNumber.replace(/[^0-9]/g, '');
      if (digits.length === 11 && digits.startsWith('01')) {
        sNumber = '88' + digits;
      } else if (digits.length === 13 && digits.startsWith('8801')) {
        sNumber = digits;
      } else if (digits.length === 10 && digits.startsWith('1')) {
        sNumber = '880' + digits;
      }

      // Normalize phone numbers: 11 digits (01...) for Awaj API
      const uniqueNormalizedPhoneNumbers = [...new Set(phoneNumbers
        .map(p => {
          if (!p) return '';
          const digits = p.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        })
        .filter(p => p && p.length === 11 && p.startsWith('01')))];

      if (uniqueNormalizedPhoneNumbers.length === 0) {
        throw new Error('No valid 11-digit phone numbers found to retry.');
      }

      // Calculate cost based on normalized subscribers
      const estimatedCost = uniqueNormalizedPhoneNumbers.length * voiceRate;

      if (walletBalance < estimatedCost) {
        setStatusModal({
          show: true,
          type: 'balance',
          title: lang === 'bn' ? 'অপর্যাপ্ত ব্যালেন্স' : 'Insufficient Balance',
          message: lang === 'bn' ? `রিচার্জ প্রয়োজন: ${estimatedCost} ৳` : `Recharge needed: ${estimatedCost} ৳`
        });
        return;
      }

      const requestId = crypto.randomUUID();
      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: uniqueNormalizedPhoneNumbers,
        voices: voice.file_url ? [voice.file_url] : undefined,
        file_url: voice.file_url,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      console.log('Sending retry payload:', payload);

      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send retry broadcast via Awaj API');
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // Save to Supabase (update existing record to include new retry campaign and add cost/numbers)
      // We will append the new campaign ID to the retries array
      const currentRetries = broadcast.retries || [];
      const newRetries = [...currentRetries, campaignId];

      const { error } = await supabase.from('voice_broadcasts')
        .update({
          status: 'sending',
          estimated_cost: broadcast.estimated_cost + estimatedCost,
          retries: newRetries
        })
        .eq('id', broadcast.id);

      if (error) throw error;

      // Deduct balance
      const { error: deductError } = await supabase.rpc('deduct_balance', {
        p_institution_id: madrasah?.id,
        p_amount: estimatedCost
      });
      
      if (deductError) {
        console.error('Failed to deduct balance:', deductError);
      } else {
        setWalletBalance(prev => prev - estimatedCost);
      }

      setStatusModal({ show: true, title: 'Success', type: 'success', message: `Successfully initiated retry for ${phoneNumbers.length} calls.` });
      setRetryModal({ ...retryModal, show: false });
      fetchHistory();
      
    } catch (err: any) {
      console.error('Error retrying broadcast:', err);
      setStatusModal({ show: true, title: 'Error', type: 'error', message: err.message || 'Failed to retry broadcast' });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleExpandHistory = async (broadcast: any) => {
    if (expandedHistoryId === broadcast.id) {
      setExpandedHistoryId(null);
      setHistoryDetails(null);
      return;
    }
    
    setExpandedHistoryId(broadcast.id);
    setLoadingDetails(true);
    setHistoryDetails(null);
    
    if (!broadcast.provider_campaign_id) {
      setHistoryDetails({ error: 'No campaign ID found for this broadcast' });
      setLoadingDetails(false);
      return;
    }

    try {
      // Gather all campaign IDs related to this broadcast
      const campaignIds = [broadcast.provider_campaign_id, ...(broadcast.retries || [])].filter(Boolean);
      
      const results = await Promise.all(
        campaignIds.map(async (cid) => {
          const resp = await fetch(`/api/awaj/broadcast/${cid}`);
          if (resp.ok) {
            try {
              const data = await resp.json();
              data._campaignId = cid;
              return data;
            } catch (e) {
               return null;
            }
          }
          return null;
        })
      );
      
      const validResults = results.filter(Boolean);
      
      if (validResults.length > 0) {
        // Use the first one as base object, but combined all calls together
        let mergedResult = { ...validResults[0] };
        let allCalls: any[] = [];
        
        validResults.forEach(res => {
          const extracted = extractCallLogs(res);
          allCalls = [...allCalls, ...extracted];
          
          // trigger auto-refund check
          try {
            const providerStatus = (res.broadcast?.status || res.status || res.state || '').toLowerCase();
            if (['completed', 'done', 'success', 'complete', 'finished', 'failed', 'error', 'cancelled'].includes(providerStatus)) {
              handleClaimRefundAuto(broadcast.id, res._campaignId);
            }
          } catch(e) {}
        });
        
        // Deduplicate calls by phone, keeping the latest status
        const deduplicatedCallsMap = new Map();
        allCalls.forEach(call => {
           let p = extractPhoneFromLog(call);
           if (p) {
             deduplicatedCallsMap.set(p, call);
           }
        });
        
        mergedResult.calls = Array.from(deduplicatedCallsMap.values());
        console.log('Combined and Deduplicated Broadcast Details API Responses:', mergedResult);
        setHistoryDetails(mergedResult);

        // Fetch student names to map phone numbers
        const targetInstId = broadcast.institution_id || madrasah?.id;
        if (targetInstId && isValidUUID(targetInstId)) {
          const { data: students } = await supabase
            .from('students')
            .select('student_name, roll, guardian_phone, guardian_phone_2')
            .eq('institution_id', targetInstId);
              
          if (students) {
            console.log(`Fetched ${students.length} students for mapping`);
            const newMap: Record<string, { name: string, roll: string }> = {};
            
            const normalizePhone = (p: string) => {
              if (!p) return '';
              const digits = p.replace(/[^0-9]/g, '');
              if (digits.length === 11 && digits.startsWith('01')) return digits;
              if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
              if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
              return digits;
            };

            students.forEach(s => {
              const info = { name: s.student_name, roll: s.roll ? s.roll.toString() : '' };
              if (s.guardian_phone) {
                const norm = normalizePhone(s.guardian_phone);
                if (norm) newMap[norm] = info;
              }
              if (s.guardian_phone_2) {
                const norm2 = normalizePhone(s.guardian_phone_2);
                if (norm2) newMap[norm2] = info;
              }
            });
            
            // Also map institutions for super admin global broadcasts
            if (isSuperAdmin && allInstitutions.length > 0) {
              allInstitutions.forEach(inst => {
                if (inst.phone) {
                  const norm = normalizePhone(inst.phone);
                  if (norm) newMap[norm] = { name: inst.name, roll: 'ID: ' + inst.id.substring(0, 4) };
                }
              });
            }
            
            setStudentNamesMap(newMap as any);
          }
        }
      } else {
        setHistoryDetails({ error: 'Failed to load details' });
      }
    } catch (err: any) {
      console.error('Error fetching broadcast details:', err);
      setHistoryDetails({ error: err.message || 'Error loading details' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const extractCallLogs = (details: any) => {
    if (!details) return [];
    if (Array.isArray(details)) return details;
    if (details.calls && Array.isArray(details.calls)) return details.calls;
    if (details.logs && Array.isArray(details.logs)) return details.logs;
    if (details.recipients && Array.isArray(details.recipients)) return details.recipients;
    if (details.data && Array.isArray(details.data)) return details.data;
    if (details.results && Array.isArray(details.results)) return details.results;
    if (details.details && Array.isArray(details.details)) return details.details;
    if (details.broadcast && details.broadcast.calls) return details.broadcast.calls;
    
    // Search for any array in the object that looks like call logs
    for (const key in details) {
      if (Array.isArray(details[key]) && details[key].length > 0 && typeof details[key][0] === 'object') {
        const firstItem = details[key][0];
        if (firstItem.phone || firstItem.number || firstItem.to || firstItem.msisdn || firstItem.recipient || firstItem.mobile || firstItem.destination) {
          return details[key];
        }
      }
    }
    
    // Fallback: return the first array found
    for (const key in details) {
      if (Array.isArray(details[key]) && details[key].length > 0) {
        return details[key];
      }
    }
    
    return [];
  };

  const isTargetingInstitutions = isSuperAdmin && (targetType === 'all_institutions' || targetType === 'specific_institution');
  const isTargetingAllStudents = !isSuperAdmin && targetType === 'all';

  const handleBroadcast = async () => {
    if (!madrasah || !selectedVoiceId || (!selectedClassId && targetType === 'class' && !isPreSelected && !isTargetingInstitutions && !isTargetingAllStudents) || (targetType === 'teachers' && teachers.length === 0) || !selectedSenderId) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Info',
        message: lang === 'bn' ? 'অনুগ্রহ করে ভয়েস, সেন্ডার আইডি এবং লক্ষ্য নির্বাচন করুন।' : 'Please select a voice, sender ID, and target.'
      });
      return;
    }
    
    // Get count
    let count = 0;
    if (isTargetingInstitutions) {
      if (targetType === 'all_institutions') {
        count = allInstitutions.length;
      } else {
        count = selectedInstitutionIds.length; // Specific institutions
      }
    } else if (isPreSelected) {
      count = preSelectedStudentIds.length;
    } else if (targetType === 'teachers') {
      count = teachers.length;
    } else if (isTargetingAllStudents) {
      let q = supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
      if ((window as any)._hasIsActive !== false) q = q.eq('is_active', true);
      const { count: c } = await q;
      count = c || 0;
    } else {
      let q = supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', selectedClassId);
      if ((window as any)._hasIsActive !== false) q = q.eq('is_active', true);
      const { count: c } = await q;
      count = c || 0;
    }

    if (count === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'লক্ষ্য পাওয়া যায়নি' : 'No Targets',
        message: lang === 'bn' ? 'কোনো লক্ষ্য পাওয়া যায়নি।' : 'No targets found.'
      });
      return;
    }

    const estimatedCost = count * voiceRate;

    if (!isSuperAdmin && walletBalance < estimatedCost) {
      setStatusModal({
        show: true,
        type: 'balance',
        title: lang === 'bn' ? 'ব্যালেন্স শেষ!' : 'Out of Balance!',
        message: lang === 'bn' ? `ব্যালেন্স পর্যাপ্ত নয়। আনুমানিক খরচ: ${estimatedCost} টাকা। বর্তমান ব্যালেন্স: ${walletBalance} টাকা।` : `Insufficient balance. Estimated cost: ${estimatedCost} BDT. Current balance: ${walletBalance} BDT.`
      });
      return;
    }

    setIsBroadcasting(true);
    try {
      if (!isOnline) {
        setStatusModal({
          show: true,
          type: 'error',
          title: 'Offline',
          message: 'Internet required to send voice broadcast.'
        });
        setIsBroadcasting(false);
        return;
      }

      // Determine target class name
      let targetClassName = null;
      if (!isTargetingInstitutions && !isPreSelected) {
        if (targetType === 'teachers') {
          targetClassName = lang === 'bn' ? 'সকল শিক্ষক' : 'All Teachers';
        } else if (isTargetingAllStudents) {
          targetClassName = lang === 'bn' ? 'সকল শিক্ষার্থী' : 'All Students';
        } else {
          const cls = classes.find(c => c.id === selectedClassId);
          if (cls) targetClassName = cls.class_name;
        }
      } else if (isPreSelected) {
        targetClassName = 'Selected Students';
      } else if (isTargetingInstitutions) {
        targetClassName = targetType === 'all_institutions' ? 'All Institutions' : 'Selected Institutions';
      }

      // Get phone numbers
      let phoneNumbers: string[] = [];
      if (isTargetingInstitutions) {
        if (targetType === 'all_institutions') {
          phoneNumbers = allInstitutions.map(inst => inst.phone);
        } else {
          phoneNumbers = allInstitutions.filter(inst => selectedInstitutionIds.includes(inst.id)).map(inst => inst.phone);
        }
      } else if (targetType === 'teachers') {
        phoneNumbers = teachers.map(t => t.phone).filter(p => !!p);
      } else {
        let students: any[] = [];
        if (isPreSelected) {
          let q = supabase.from('students').select('guardian_phone, guardian_phone_2').in('id', preSelectedStudentIds);
          if ((window as any)._hasIsActive !== false) q = q.eq('is_active', true);
          const { data, error } = await q;
          if (error) throw error;
          students = data || [];
        } else if (isTargetingAllStudents) {
          let q = supabase.from('students').select('guardian_phone, guardian_phone_2').eq('institution_id', madrasah.id);
          if ((window as any)._hasIsActive !== false) q = q.eq('is_active', true);
          const { data, error } = await q;
          if (error) throw error;
          students = data || [];
        } else {
          let q = supabase.from('students').select('guardian_phone, guardian_phone_2').eq('class_id', selectedClassId);
          if ((window as any)._hasIsActive !== false) q = q.eq('is_active', true);
          const { data, error } = await q;
          if (error) throw error;
          students = data || [];
        }
        
        phoneNumbers = students.map(s => s.guardian_phone || s.guardian_phone_2).filter(p => !!p);
      }
      
      // Normalize phone numbers: 11 digits (01...) for Awaj API
      const bnToEn = (str: string) => {
        const numbers: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
        return str.replace(/[০-৯]/g, match => numbers[match]);
      };
      
      const normalizedPhoneNumbers = phoneNumbers
        .map(phone => {
          if (!phone) return '';
          const enPhone = bnToEn(String(phone));
          const digits = enPhone.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        })
        .filter(p => p && p.length === 11 && p.startsWith('01'));
      
      // De-duplicate phone numbers
      const uniqueNormalizedPhoneNumbers = [...new Set(normalizedPhoneNumbers)];
      const finalCount = uniqueNormalizedPhoneNumbers.length;
      const finalEstimatedCost = finalCount * voiceRate;
      
      if (finalCount === 0) {
        throw new Error('No valid 11-digit phone numbers (01...) found.');
      }

      if (!isSuperAdmin && walletBalance < finalEstimatedCost) {
        throw new Error(lang === 'bn' ? `ব্যালেন্স পর্যাপ্ত নয়। খরচ: ${finalEstimatedCost} টাকা।` : `Insufficient balance. Estimated cost: ${finalEstimatedCost} BDT.`);
      }

      // Get the selected template to get the awaj_voice_id or file_url
      const voice = voices.find(v => v.id === selectedVoiceId);
      if (!voice) throw new Error('Selected voice not found.');

      // 1. Send to Awaj Digital API
      const requestId = crypto.randomUUID();
      
      // Find the actual sender object to get the calling number
      const senderObj = senders.find(s => 
        (s.id && s.id.toString() === selectedSenderId.toString()) || 
        (s.callingNumber && s.callingNumber.toString() === selectedSenderId.toString()) || 
        (s.caller_id && s.caller_id.toString() === selectedSenderId.toString())
      );
      
      // Documentation says 'sender' must be the active caller sender number (e.g. 8801234567890)
      let sNumber = senderObj ? (senderObj.callingNumber || senderObj.caller_id || senderObj.id).toString() : selectedSenderId.toString();
      
      // Ensure sender is in 8801... format
      const digits = sNumber.replace(/[^0-9]/g, '');
      if (digits.length === 11 && digits.startsWith('01')) {
        sNumber = '88' + digits;
      } else if (digits.length === 13 && digits.startsWith('8801')) {
        sNumber = digits;
      } else if (digits.length === 10 && digits.startsWith('1')) {
        sNumber = '880' + digits;
      }
      
      // Voice name and CDN URL for Awaj Direct Broadcast API
      const voiceName = voice.provider_voice_name || voice.title;

      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: uniqueNormalizedPhoneNumbers,
        voices: voice.file_url ? [voice.file_url] : undefined,
        file_url: voice.file_url,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      console.log('Sending broadcast payload (strictly following docs):', { ...payload, phone_numbers: `[${uniqueNormalizedPhoneNumbers.length} numbers]` });

      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...payload,
          phone_numbers: uniqueNormalizedPhoneNumbers
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to send broadcast via Awaj API';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            const details = typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details);
            errorMessage += ` - ${details}`;
          }
        } catch (e) {
          // If response is not JSON
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Broadcast creation result:', result);
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // 2. Save to Supabase
      let saveInstId = madrasah.id;
      if (isSuperAdmin && !isValidUUID(saveInstId)) {
        // Find system institution ID as fallback
        const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').limit(1);
        if (sysInst && sysInst.length > 0) {
          saveInstId = sysInst[0].id;
        }
      }

      const { error } = await supabase.from('voice_broadcasts').insert({
        institution_id: saveInstId,
        voice_template_id: selectedVoiceId,
        target_type: 'students',
        target_class_name: targetClassName,
        total_numbers: finalCount,
        estimated_cost: finalEstimatedCost,
        provider_campaign_id: campaignId,
        status: 'sending'
      });

      if (error) throw error;

      // 3. Deduct balance from institution
      const { error: deductError } = await supabase.rpc('deduct_balance', {
        p_institution_id: saveInstId,
        p_amount: finalEstimatedCost
      });
      
      if (deductError) throw deductError;

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ব্রডকাস্ট সফলভাবে শুরু হয়েছে!' : 'Broadcast started successfully!'
      });
      setSelectedClassId('');
      setSelectedVoiceId('');
      fetchWalletBalance();
      triggerRefresh();
      fetchHistory(); // Refresh history
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleVoiceUpload = async () => {
    if (!madrasah || !uploadName || !uploadFile) return;

    const validExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac', 'mpeg', 'mp4'];
    const fileExtLower = (uploadFile.name.split('.').pop() || '').toLowerCase();
    const isAudioType = uploadFile.type ? uploadFile.type.startsWith('audio/') : false;

    if (!isAudioType && !validExts.includes(fileExtLower)) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ভুল ফাইল' : 'Invalid File',
        message: lang === 'bn' ? 'দয়া করে একটি সঠিক অডিও ফাইল (MP3, WAV, OGG, M4A, AAC, WebM, FLAC) সিলেক্ট করুন।' : 'Please select a valid audio file (MP3, WAV, OGG, M4A, AAC, WebM, FLAC).'
      });
      return;
    }

    setIsUploading(true);
    try {
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('অডিও ফাইল পড়তে সমস্যা হয়েছে'));
        reader.readAsDataURL(uploadFile);
      });

      const encodedName = encodeURIComponent(uploadName);
      const response = await fetch(`/api/voices/upload?name=${encodedName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Voice-Name': encodedName
        },
        body: JSON.stringify({
          name: uploadName,
          voice_name: uploadName,
          title: uploadName,
          audio_base64: base64Audio,
          filename: uploadFile.name
        })
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || resData.error || 'Failed to upload voice to Awaj Digital server.');
      }

      const providerVoiceId = resData.id || resData.voice_id || resData.data?.id || resData.result?.id || '';
      const providerVoiceName = resData.name || resData.title || uploadName;
      const audioUrl = resData.file_url || resData.preview_url || resData.url || resData.data?.file_url || resData.data?.url || '';

      const { error: dbError } = await supabase.from('voice_templates').insert({
        institution_id: madrasah.id,
        title: uploadName,
        file_url: audioUrl,
        admin_status: 'approved',
        provider_status: 'approved',
        provider_voice_name: providerVoiceName,
        provider_voice_id: providerVoiceId ? String(providerVoiceId) : null
      });

      if (dbError) console.warn('Warning saving template metadata:', dbError.message);

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ভয়েস Awaj Digital সার্ভারে সফলভাবে আপলোড ও অনুমোদন হয়েছে! আপনি সরাসরি ব্রডকাস্ট পাঠাতে পারবেন।' : 'Voice uploaded to Awaj Digital server and approved successfully! You can send broadcasts now.'
      });
      setUploadName('');
      setUploadFile(null);
      fetchVoices();
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRequestApproval = async (voiceId: string) => {
    try {
      const { error } = await supabase.from('voice_templates').update({
        admin_status: 'approved',
        provider_status: 'approved'
      }).eq('id', voiceId);
      
      if (error) throw error;
      
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ভয়েস অটো-অনুমোদিত করা হয়েছে।' : 'Voice auto-approved successfully.'
      });
      fetchVoices();
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    }
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

  const handleRecharge = async () => {
    if (!madrasah || !rechargeAmount) return;
    setIsRecharging(true);
    try {
      const { data, error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: parseInt(rechargeAmount),
        transaction_id: `PENDING_${Date.now()}`,
        description: `${paymentMethod.toUpperCase()} Voice Recharge Request`,
        type: 'credit',
        status: 'pending',
        module: 'voice',
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
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsRecharging(false);
    }
  };

  const getSelectedClassName = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    return cls ? cls.class_name : (lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class');
  };

  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showSenderDropdown, setShowSenderDropdown] = useState(false);

  const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-emerald-600 p-6 rounded-[2.2rem] shadow-premium border border-emerald-100 flex items-center justify-between text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Mic size={120} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">{t('available_balance', lang)}</p>
          <h3 className="text-4xl font-black flex items-baseline gap-2">
            {walletBalance.toFixed(2)} <span className="text-lg opacity-60">৳</span>
          </h3>
        </div>
        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
          <Mic size={28} className="text-white" />
        </div>
      </div>

      <div className="relative h-[60px] bg-white rounded-[2.5rem] p-1.5 shadow-bubble border border-slate-100 flex items-center mb-8">
        <div 
          className="absolute h-[48px] bg-[#2563EB] rounded-[2.5rem] transition-all duration-500 shadow-premium"
          style={{ 
            width: availableTabs.length > 0 ? `${100 / availableTabs.length}%` : '0',
            left: availableTabs.length > 0 ? `${(Math.max(0, availableTabs.indexOf(activeTab)) * 100) / availableTabs.length}%` : '0',
            transform: 'translateX(0)'
          }}
        />
        {availableTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 h-full rounded-[2.5rem] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all z-10 ${activeTab === tab ? 'text-white' : 'text-slate-400'}`}>
            {tab === 'broadcast' ? <Send size={16} /> : 
             tab === 'templates' ? <Mic size={16} /> : 
             tab === 'history' ? <History size={16} /> :
             <CreditCard size={16} />}
            <span className="font-noto">
              {tab === 'broadcast' ? t('broadcast', lang) : 
               tab === 'templates' ? t('voice', lang) : 
               tab === 'history' ? t('history', lang) :
               t('recharge', lang)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'broadcast' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-bubble border border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="space-y-7">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">
                      {isSuperAdmin ? 'লক্ষ্য নির্বাচন করুন (Target)' : t('step_1_class', lang)}
                    </h4>
                    
                    {!isPreSelected && !isInstPreSelected ? (
                      <div className="relative">
                        {!isSuperAdmin ? (
                          <>
                            <div className="flex bg-slate-100 p-1 rounded-[1.5rem] mb-4">
                              <button
                                onClick={() => setTargetType('class')}
                                className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'class' || targetType === 'all' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
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

                            {targetType === 'class' || targetType === 'all' ? (
                              <>
                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                
                                {selectedClassId && targetType === 'class' && (
                                  <div className="flex items-center gap-2 px-4 py-2 mt-2 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                    <Users size={16} className="text-[#2563EB]" />
                                    <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-wider">
                                      {lang === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}: {classStudents.length} {lang === 'bn' ? 'জন' : ''}
                                    </p>
                                  </div>
                                )}
                                {showClassDropdown && (
                                  <div className="absolute top-[120px] left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    <button onClick={() => { setTargetType('all'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${targetType === 'all' ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                      <span className="font-black font-noto">{lang === 'bn' ? 'সকল শিক্ষার্থী (সম্পূর্ণ প্রতিষ্ঠান)' : 'All Students (Entire Institution)'}</span>
                                    </button>
                                    {classes.map(cls => (
                                      <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setTargetType('class'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                        <span className="font-black font-noto">{cls.class_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : targetType === 'teachers' ? (
                              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-indigo-600" />
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                  {lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}: {teachers.length}
                                </p>
                              </div>
                            ) : null}
                          </>
                        ) : (targetType === 'specific_institution' && isSuperAdmin) ? (
                              <>
                                <button onClick={() => setShowInstitutionDropdown(!showInstitutionDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                                  <span className={`text-base font-black font-noto ${selectedInstitutionIds.length > 0 ? 'text-[#1E3A8A]' : 'text-slate-400'}`}>
                                    {selectedInstitutionIds.length > 0 ? `${selectedInstitutionIds.length} টি প্রতিষ্ঠান নির্বাচিত` : 'প্রতিষ্ঠান নির্বাচন করুন'}
                                  </span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showInstitutionDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
    
                                {selectedInstitutionIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1">
                                    {allInstitutions.filter(i => selectedInstitutionIds.includes(i.id)).slice(0, 5).map(inst => (
                                      <div key={inst.id} className="bg-blue-50 text-[#2563EB] px-3 py-1 rounded-lg text-[10px] font-black border border-blue-100 flex items-center gap-1.5">
                                        {inst.name}
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedInstitutionIds(prev => prev.filter(id => id !== inst.id)); }} className="hover:text-red-500 transition-colors">
                                          <X size={10} />
                                        </button>
                                      </div>
                                    ))}
                                    {selectedInstitutionIds.length > 5 && (
                                      <div className="bg-slate-50 text-slate-400 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-100">
                                        + {selectedInstitutionIds.length - 5} More
                                      </div>
                                    )}
                                  </div>
                                )}
    
                                {showInstitutionDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                    <div className="p-2 border-b border-slate-50 mb-2 flex items-center justify-between">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">প্রতিষ্ঠানের তালিকা ({allInstitutions.length})</span>
                                      <button 
                                        onClick={() => {
                                          if (selectedInstitutionIds.length === allInstitutions.length) {
                                            setSelectedInstitutionIds([]);
                                          } else {
                                            setSelectedInstitutionIds(allInstitutions.map(i => i.id));
                                          }
                                        }}
                                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline px-2"
                                      >
                                        {selectedInstitutionIds.length === allInstitutions.length ? 'Deselect All' : 'Select All'}
                                      </button>
                                    </div>
                                    {allInstitutions.map(inst => (
                                      <button 
                                        key={inst.id} 
                                        onClick={() => { 
                                          const isSelected = selectedInstitutionIds.includes(inst.id);
                                          if (isSelected) {
                                            setSelectedInstitutionIds(prev => prev.filter(id => id !== inst.id));
                                          } else {
                                            setSelectedInstitutionIds(prev => [...prev, inst.id]);
                                          }
                                        }} 
                                        className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 flex items-center justify-between group transition-all ${selectedInstitutionIds.includes(inst.id) ? 'bg-[#2563EB] text-white shadow-md scale-[1.02] z-10 relative' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedInstitutionIds.includes(inst.id) ? 'bg-white/20' : 'bg-slate-100'}`}>
                                            <Building2 size={16} />
                                          </div>
                                          <span className="font-black font-noto">{inst.name}</span>
                                        </div>
                                        {selectedInstitutionIds.includes(inst.id) && <Check size={16} strokeWidth={4} />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="bg-blue-50 p-6 rounded-[1.8rem] border border-blue-100 flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#2563EB] shadow-sm">
                                  <Users size={24} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-widest mb-1">Targeting All (Default)</p>
                                  <p className="text-sm font-black text-[#1E3A8A]">System-wide broadcast</p>
                                </div>
                              </div>
                            )}
                      </div>
                    ) : (
                      <div className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-blue-50 border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center">
                            {isInstPreSelected ? <Building2 size={16} /> : <Users size={16} />}
                          </div>
                          <span className="text-base font-black font-noto text-[#1E3A8A]">
                            {isInstPreSelected 
                              ? `${preSelectedInstitutionIds.length} ${lang === 'bn' ? 'টি প্রতিষ্ঠান নির্বাচিত' : 'Institutions Selected'}`
                              : `${preSelectedStudentIds.length} ${lang === 'bn' ? 'জন শিক্ষার্থী নির্বাচিত' : 'Students Selected'}`
                            }
                          </span>
                        </div>
                        <button onClick={() => onBack()} className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest hover:underline">
                          {lang === 'bn' ? 'পরিবর্তন' : 'Change'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">{t('select_voice', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowVoiceDropdown(!showVoiceDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#1E3A8A]">
                          {selectedVoiceId ? voices.find(v => v.id === selectedVoiceId)?.title : t('select_voice', lang)}
                        </span>
                        <ChevronDown className={`text-slate-300 transition-all ${showVoiceDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showVoiceDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {voices.filter(v => (v.admin_status === 'approved' || v.provider_status === 'approved' || !!v.file_url)).map(v => (
                            <button key={v.id} onClick={() => { setSelectedVoiceId(v.id); setShowVoiceDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedVoiceId === v.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                              <span className="font-black font-noto">{v.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-7 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">{t('select_sender_id', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowSenderDropdown(!showSenderDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#1E3A8A]">
                          {selectedSenderId ? (senders.find(s => (s.id || s.callingNumber || s.caller_id) === selectedSenderId)?.callingNumber || selectedSenderId) : t('select_sender_id', lang)}
                        </span>
                        <ChevronDown className={`text-slate-300 transition-all ${showSenderDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showSenderDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {senders.map(s => (
                            <button key={s.id || s.callingNumber || s.caller_id} onClick={() => { setSelectedSenderId(s.id || s.callingNumber || s.caller_id); setShowSenderDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${(s.id || s.callingNumber || s.caller_id) === selectedSenderId ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                              <span className="font-black font-noto">{s.callingNumber || s.caller_id || s.id || s.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={handleBroadcast}
                    disabled={!selectedVoiceId || (targetType === 'class' && !selectedClassId && !isPreSelected && !isTargetingInstitutions) || (targetType === 'teachers' && teachers.length === 0) || (targetType === 'specific_institution' && selectedInstitutionIds.length === 0) || !selectedSenderId || isBroadcasting}
                    className="w-full h-[64px] bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all mt-auto"
                  >
                    {isBroadcasting ? <Loader2 className="animate-spin" size={24} /> : (
                      <>
                        <Send size={20} /> 
                        {targetType === 'all_institutions' ? 'Broadcasting to All Institutions' : 
                         targetType === 'specific_institution' ? `Calling ${selectedInstitutionIds.length} Institutions` :
                         t('start_broadcast', lang)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('your_voices', lang)}</h2>
              <button onClick={fetchVoices} disabled={loading} className="bg-blue-50 text-[#2563EB] px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-2 active:scale-95 transition-all border border-blue-100">
                 {loading ? <Loader2 className="animate-spin" size={14} /> : <History size={14} />} {t('sync_voices', lang)}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
               {loading ? (
                  <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" size={30} /></div>
               ) : voices.length > 0 ? (
                  voices.map(v => (
                    <div key={v.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                <Mic size={18} />
                             </div>
                             <div>
                               <h4 className="font-black text-[#1E3A8A] text-[15px] font-noto">{v.title}</h4>
                               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${v.admin_status === 'approved' && v.provider_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                 {v.provider_status === 'approved' ? t('approved', lang) : t('pending', lang)}
                               </span>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.file_url && (
                              <button 
                                onClick={() => togglePlay(v.id, v.file_url)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingId === v.id ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-[#2563EB] hover:bg-blue-100'}`}
                              >
                                {playingId === v.id ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                              </button>
                            )}
                            <button 
                              onClick={() => setShowDeleteConfirm({ id: v.id, providerId: v.provider_voice_id, fileUrl: v.file_url, title: v.title })}
                              className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                       </div>
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

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-5">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 flex items-center gap-2">
               <History size={12} /> {t('history', lang)}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" size={32} /></div>
              ) : broadcastHistory.length > 0 ? (
                broadcastHistory.map(h => (
                  <div key={h.id} className="bg-white rounded-[2.2rem] border border-slate-100 shadow-bubble overflow-hidden transition-all">
                    <div className="p-5 cursor-pointer" onClick={() => handleExpandHistory(h)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB]">
                            <Send size={18} />
                          </div>
                          <div>
                            <h3 className="font-black text-[#1E3A8A] text-[15px] font-noto">{h.voice_templates?.title || 'Unknown Voice'}</h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(h.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => handleDeleteHistory(h.id, e)}
                              className="w-7 h-7 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all active:scale-90"
                              title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                              {h.status}
                            </span>
                            {h.status === 'completed' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClaimRefund(h.id);
                                }}
                                className={`w-7 h-7 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-all active:scale-90 ${refundingId === h.id ? 'animate-pulse' : ''}`}
                                title={lang === 'bn' ? 'রিফান্ড নিন' : 'Claim Refund'}
                              >
                                <Zap size={14} />
                              </button>
                            )}
                          </div>
                          <ChevronDown size={16} className={`text-slate-300 transition-transform ${expandedHistoryId === h.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('target', lang)}</p>
                          <p className="text-xs font-black text-[#1E3A8A] capitalize">
                            {h.target_class_name ? h.target_class_name : (
                              h.target_type === 'students' ? t('students', lang, madrasah?.institution_type) :
                              h.target_type === 'staff' ? t('teachers', lang, madrasah?.institution_type) :
                              h.target_type
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('numbers', lang)}</p>
                          <p className="text-xs font-black text-[#1E3A8A]">{h.total_numbers}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost', lang)}</p>
                          <p className="text-xs font-black text-red-500">{h.estimated_cost} ৳</p>
                        </div>
                      </div>
                    </div>
                    
                    {expandedHistoryId === h.id && (
                      <div className="bg-slate-50 p-5 border-t border-slate-100 animate-in slide-in-from-top-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Smartphone size={12} /> {t('call_details', lang)}
                        </h4>
                        
                        {loadingDetails ? (
                          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#2563EB]" size={24} /></div>
                        ) : historyDetails?.error ? (
                          <div className="text-red-500 text-[11px] font-black bg-red-50 p-4 rounded-2xl border border-red-100">
                            {historyDetails.error}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {(() => {
                              const logs = extractCallLogs(historyDetails);
                              const failedLogs = logs.filter((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase();
                                return ['failed', 'no answer', 'notanswered', 'not_answered', 'busy', 'cancelled', 'error', 'rejected', 'declined'].includes(status);
                              });
                              const answeredLogs = logs.filter((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase();
                                return ['answered', 'success', 'completed'].includes(status);
                              });
                              
                              return (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                      <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Calls</div>
                                      <div className="text-lg font-black text-blue-900">{logs.length || h.total_numbers}</div>
                                    </div>
                                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                      <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Answered</div>
                                      <div className="text-lg font-black text-emerald-900">{answeredLogs.length}</div>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                      <div className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Failed</div>
                                      <div className="text-lg font-black text-red-900">{failedLogs.length}</div>
                                    </div>
                                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                                      <div className="text-lg font-black text-slate-900">
                                        {logs.reduce((acc: number, l: any) => acc + (parseInt(l.duration || l.billsec) || 0), 0)}s
                                      </div>
                                    </div>
                                  </div>

                                  {failedLogs.length > 0 && (
                                    <div className="flex justify-end mt-4 gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleClaimRefund(h.id);
                                        }}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                      >
                                        <Zap size={14} />
                                        {lang === 'bn' ? 'রিফান্ড নিন' : 'Claim Refund'}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRetryFailed(h, failedLogs);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                      >
                                        <RefreshCw size={14} />
                                        Retry {failedLogs.length} Failed Calls
                                      </button>
                                    </div>
                                  )}

                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {logs.length > 0 ? (
                                      logs.map((log: any, idx: number) => {
                                        let phone = extractPhoneFromLog(log);
                                        
                                        if (!phone) phone = 'Unknown';
                                        
                                        if (phone === 'Unknown') {
                                          console.log('Could not find phone in log object:', log);
                                        }
                                        
                                        const normalizePhone = (p: string) => {
                                          if (!p || p === 'Unknown') return '';
                                          const digits = p.replace(/[^0-9]/g, '');
                                          if (digits.length === 11 && digits.startsWith('01')) return digits;
                                          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
                                          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
                                          return digits;
                                        };
                                        
                                        const normPhone = normalizePhone(phone);
                                        const studentInfo = (studentNamesMap as any)[normPhone];
                                        const studentName = studentInfo?.name || '';
                                        const rollNo = studentInfo?.roll || '';
                                        const status = (log.status || log.state || log.call_status || 'Unknown').toLowerCase();
                                        const duration = log.duration || log.billsec || 0;
                                        
                                        let statusColor = 'text-slate-500 bg-slate-100';
                                        if (['answered', 'success', 'completed'].includes(status)) statusColor = 'text-emerald-700 bg-emerald-100';
                                        else if (['failed', 'no answer', 'busy', 'cancelled', 'rejected', 'declined'].includes(status)) statusColor = 'text-red-700 bg-red-100';
                                        
                                        return (
                                          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColor.replace('text-', 'bg-').replace('700', '100').replace('bg-', 'text-')}`}>
                                                {['answered', 'success', 'completed'].includes(status) ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                              </div>
                                              <div>
                                                <p className="font-black text-[#1E3A8A] text-xs">
                                                  {studentName ? (
                                                    <>
                                                      {studentName}
                                                      {rollNo && <span className="ml-2 text-[10px] text-slate-400 font-bold">({lang === 'bn' ? 'রোল' : 'Roll'}: {rollNo})</span>}
                                                    </>
                                                  ) : phone}
                                                </p>
                                                {(studentName || duration > 0) && (
                                                  <p className="text-[9px] text-slate-400 font-bold">
                                                    {studentName ? phone : ''}
                                                    {studentName && duration > 0 ? ' • ' : ''}
                                                    {duration > 0 ? `${duration} sec` : ''}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${statusColor}`}>
                                              {status}
                                            </span>
                                          </div>
                                        );
                                      })
                                    ) : historyDetails?.broadcast && !historyDetails.isComplete ? (
                                      <div className="bg-amber-50 p-6 border border-amber-100 rounded-2xl text-center space-y-3">
                                        <div className="text-amber-500 font-black mb-1">
                                          <Loader2 className="w-8 h-8 mx-auto animate-spin" />
                                        </div>
                                        <p className="text-amber-700 font-bold text-sm">
                                          {lang === 'bn' ? 'ব্রডকাস্টটি এখনও চলছে...' : 'Broadcast is still in progress...'}
                                        </p>
                                        {historyDetails.broadcast.listenerCount !== undefined && (
                                          <div className="text-amber-800 text-xs font-black bg-amber-100/50 inline-block px-3 py-1.5 rounded-full">
                                            {historyDetails.broadcast.completeCount} / {historyDetails.broadcast.listenerCount} {lang === 'bn' ? 'কল সম্পন্ন হয়েছে' : 'calls completed'}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                        {t('no_logs', lang)}
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_history', lang)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <PaymentCheckout 
              lang={lang}
              madrasah={madrasah!}
              module="voice"
              onSuccess={(trx) => {
                fetchWalletBalance();
                fetchUserTransactions();
                if (triggerRefresh) triggerRefresh();
                setActiveTab('history');
              }}
              onCancel={() => setActiveTab('broadcast')}
              metadata={{ source: 'voice_broadcast_page' }}
            />
            
            <div className="mt-12 space-y-4">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 flex items-center gap-2">
                  <History size={12} /> {t('recharge_history', lang)}
               </h2>
               <div className="grid grid-cols-1 gap-2.5">
                 {isFetchingTransactions ? (
                   <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>
                 ) : userTransactions.length > 0 ? userTransactions.map(tr => (
                   <div key={tr.id} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 flex items-center justify-between shadow-bubble">
                     <div className="min-w-0 flex-1">
                       <div className="flex items-center gap-2">
                         <p className="text-[15px] font-black leading-none text-slate-800">{tr.amount} ৳</p>
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
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter opacity-60">TrxID: {tr.transaction_id}</p>
                     </div>
                   </div>
                 )) : (
                   <div className="text-center py-10 rounded-[2.5rem] border border-dashed bg-slate-50 border-slate-200">
                      <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">No history records</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </div>

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
                      className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-xl shadow-blue-100 active:scale-95 transition-all text-sm uppercase tracking-[0.1em] flex items-center justify-center gap-3"
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
                    className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-xl shadow-blue-100 active:scale-95 transition-all text-sm uppercase tracking-[0.1em]"
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'Got it'}
                  </button>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}

      {retryModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-[0_40px_100px_rgba(37,99,235,0.15)] animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-inner border border-blue-100">
                <RefreshCw size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-800 font-noto">
                  {lang === 'bn' ? 'পুনরায় কল করুন' : 'Retry Call'}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4">
                  {lang === 'bn' ? `${retryModal.phoneNumbers.length} টি ব্যর্থ কল আবার করা হবে` : `Will retry ${retryModal.phoneNumbers.length} failed calls`}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                  {lang === 'bn' ? 'ভয়েস টেম্পলেট' : 'Voice Template'}
                </label>
                <div className="relative group">
                  <select 
                    value={retryModal.voiceId} 
                    onChange={(e) => setRetryModal({...retryModal, voiceId: e.target.value})}
                    className="w-full h-14 pl-6 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:border-blue-200 transition-all cursor-pointer group-hover:border-slate-200"
                  >
                    <option value="">{lang === 'bn' ? 'ভয়েস সিলেক্ট করুন' : 'Select Voice'}</option>
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.title || v.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" size={20} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                  {lang === 'bn' ? 'সেন্ডার আইডি' : 'Sender ID'}
                </label>
                <div className="relative group">
                  <select 
                    value={retryModal.senderId} 
                    onChange={(e) => setRetryModal({...retryModal, senderId: e.target.value})}
                    className="w-full h-14 pl-6 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:border-blue-200 transition-all cursor-pointer group-hover:border-slate-200"
                  >
                    <option value="">{lang === 'bn' ? 'সেন্ডার সিলেক্ট করুন' : 'Select Sender'}</option>
                    {senders.map(s => (
                      <option 
                        key={s.id || s.callingNumber || s.caller_id} 
                        value={s.id || s.callingNumber || s.caller_id}
                      >
                        {s.callingNumber || s.caller_id || s.sender_id || s.name || s.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" size={20} />
                </div>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-50 text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  {lang === 'bn' ? 'মোট আনুমানিক খরচ' : 'Total Estimated Cost'}
                </span>
                <span className="text-xl font-black text-blue-600">
                  {Number(retryModal.phoneNumbers.length * voiceRate).toFixed(2)} ৳
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={executeRetry}
                disabled={isRetrying}
                className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-xl shadow-blue-100 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isRetrying ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <><Send size={18} /> {lang === 'bn' ? 'Retry কল শুরু করুন' : 'Start Retry'}</>
                )}
              </button>
              <button 
                onClick={() => setRetryModal({ ...retryModal, show: false })} 
                disabled={isRetrying}
                className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full text-sm uppercase tracking-widest active:scale-95 transition-all"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
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
                  {lang === 'bn' ? `আপনি কি নিশ্চিত যে আপনি "${showDeleteConfirm.title}" ডিলিট করতে চান?` : `Are you sure you want to delete "${showDeleteConfirm.title}"?`}
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleDeleteVoice} 
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

      {historyDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 font-noto">{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4 leading-relaxed">
                  {lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই ব্রডকাস্ট ইতিহাস ডিলিট করতে চান?' : 'Are you sure you want to delete this broadcast history?'}
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={confirmDeleteHistory} 
                  disabled={isDeleting} 
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={22} /> : (
                    <><Trash2 size={20} /> {t('delete', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setHistoryDeleteConfirm(null)} 
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

      {/* Hidden audio element for custom player */}
      <audio ref={audioRef} className="hidden" preload="metadata" />
    </>
  );
};

export default VoiceBroadcast;
