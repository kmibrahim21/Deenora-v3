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
  ChevronLeft,
  Lock,
  Timer,
  ShieldCheck,
  Info,
  Plus,
  Square,
  Edit2
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
import { globalAudioPlayer } from '../utils/audioPlayer';

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
  const isManager = role === 'manager' || profile?.role === 'manager';
  const canApproveVoice = isSuperAdmin || isManager;

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
    const rawTabs = (['broadcast', 'templates', 'history', 'recharge'] as const);

    return rawTabs.filter(tab => {
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
  const processingRefundsRef = useRef<Set<string>>(new Set());
  const hasFetchedSendersRef = useRef(false);
  const isFetchingSendersRef = useRef(false);
  
  // Voices state
  const [voices, setVoices] = useState<any[]>([]);
  const [voiceStatusFilter, setVoiceStatusFilter] = useState<'pending' | 'approved' | 'awaj'>('pending');
  const [editingVoice, setEditingVoice] = useState<{ id: string; title: string } | null>(null);
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [voiceDurations, setVoiceDurations] = useState<{ [id: string]: number }>({});

  // Upload & Preview & Recording state
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Audio Preview & Speed Control state in modal
  const [previewSpeed, setPreviewSpeed] = useState<number>(1.0);
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [uploadedFileDuration, setUploadedFileDuration] = useState<number>(0);

  const previewObjectUrl = useMemo(() => {
    if (!uploadFile) return null;
    return URL.createObjectURL(uploadFile);
  }, [uploadFile]);

  useEffect(() => {
    if (uploadFile && previewObjectUrl) {
      const audio = new Audio(previewObjectUrl);
      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setUploadedFileDuration(Math.ceil(audio.duration));
        }
      };
    } else {
      setUploadedFileDuration(0);
    }
  }, [uploadFile, previewObjectUrl]);

  const originalDuration = useMemo(() => {
    if (recordingTime > 0) return recordingTime;
    return uploadedFileDuration;
  }, [recordingTime, uploadedFileDuration]);

  const effectiveDuration = useMemo(() => {
    if (!originalDuration) return 0;
    return Math.round(originalDuration / previewSpeed);
  }, [originalDuration, previewSpeed]);

  useEffect(() => {
    voices.forEach((v) => {
      const audioUrl = v.file_url || v.preview_url || v.url;
      if (v.id && audioUrl && !voiceDurations[v.id]) {
        const audio = new Audio(audioUrl);
        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            setVoiceDurations(prev => ({ ...prev, [v.id]: Math.ceil(audio.duration) }));
          }
        };
      }
    });
  }, [voices]);

  const handleUpdateVoiceTitle = async () => {
    if (!editingVoice || !editingVoice.title.trim()) return;
    setIsUpdatingTitle(true);
    try {
      const cleanTitle = editingVoice.title.trim();
      const { error } = await supabase
        .from('voice_templates')
        .update({ title: cleanTitle })
        .eq('id', editingVoice.id);

      if (error) throw error;

      setVoices(prev => prev.map(v => v.id === editingVoice.id ? { ...v, title: cleanTitle } : v));

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ভয়েসের নাম সফলভাবে পরিবর্তন করা হয়েছে।' : 'Voice title updated successfully.'
      });
      setEditingVoice(null);
    } catch (err: any) {
      console.error('Error updating voice title:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message || 'ভয়েসের নাম পরিবর্তন করতে সমস্যা হয়েছে।'
      });
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  const getPulsesForVoice = (voiceId: string) => {
    const vObj = voices.find(v => v.id === voiceId);
    const duration = vObj?.duration || voiceDurations[voiceId] || 0;
    if (duration > 30) {
      return Math.min(2, Math.ceil(duration / 30));
    }
    return 1;
  };

  const filteredVoices = useMemo(() => {
    return voices.filter(v => {
      const status = v.admin_status || v.provider_status || 'approved';
      if (voiceStatusFilter === 'pending') {
        return status === 'pending';
      }
      if (voiceStatusFilter === 'awaj') {
        return Boolean(v.provider_voice_id || v.provider_voice_name || !v.institution_id);
      }
      return status === 'approved';
    });
  }, [voices, voiceStatusFilter]);

  const selectableVoices = useMemo(() => {
    if (canApproveVoice) return voices;
    return voices.filter(v => (v.admin_status || v.provider_status || 'approved') === 'approved');
  }, [voices, canApproveVoice]);

  const pendingVoicesCount = useMemo(() => {
    return voices.filter(v => (v.admin_status || v.provider_status) === 'pending').length;
  }, [voices]);
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

  const togglePlay = (id: string, url: string) => {
    if (!url) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'অডিও পাওয়া যায়নি' : 'Audio Not Found',
        message: lang === 'bn' ? 'এই টেমপ্লেটের অডিও ফাইল পাওয়া যায়নি।' : 'No audio file found for this template.'
      });
      return;
    }

    globalAudioPlayer.toggle(
      id,
      url,
      (isPlaying) => {
        setPlayingId(isPlaying ? id : null);
      },
      (err) => {
        console.error('Audio playback error:', err);
        setPlayingId(null);
        setStatusModal({
          show: true,
          type: 'error',
          title: lang === 'bn' ? 'প্লেব্যাক এরর' : 'Playback Error',
          message: lang === 'bn' 
            ? 'অডিও প্লে করতে সমস্যা হচ্ছে। দয়া করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।' 
            : 'Failed to play audio. Please check your internet connection and try again.'
        });
      }
    );
  };

  useEffect(() => {
    return () => {
      globalAudioPlayer.stop();
    };
  }, []);

  // History state
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Real-time ticking timer for cooldown & countdown sync
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    if (processingRefundsRef.current.has(broadcastId)) {
      return; // Already checking this broadcast
    }
    processingRefundsRef.current.add(broadcastId);

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

      if (response.ok && (result.corrected || result.updated || (!result.already_refunded && result.refund_amount > 0))) {
        if (result.corrected) {
          console.log('Excess refund corrected automatically:', result.message);
        } else {
          console.log(`Auto-refund processed in background: ${result.refund_amount} BDT credited successfully.`);
        }
        // Automatically fetch wallet balance if a refund occurred in the background
        fetchWalletBalance();
        triggerRefresh();
        fetchUserTransactions();
        fetchHistory(true);
      }
    } catch (err: any) {
      console.error('Auto refund claim error:', err);
    } finally {
      processingRefundsRef.current.delete(broadcastId);
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

  // Recharge state
  const [rechargeAmount, setRechargeAmount] = useState('');
  const IS_VOICE_BROADCAST_DISABLED = false;
  const [rechargeStep, setRechargeStep] = useState<1 | 2>(1);
  const [isRecharging, setIsRecharging] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');
  const [adminNagad, setAdminNagad] = useState('০১৭৬৬-XXXXXX');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [pendingTrxId, setPendingTrxId] = useState<string | null>(null);
  const [voiceRate, setVoiceRate] = useState(madrasah?.voice_rate || 0.45);

  useEffect(() => {
    const initRate = async () => {
      let r = madrasah?.voice_rate;
      if (!r) {
        try {
          const { data } = await supabase.from('system_settings').select('voice_rate').eq('id', '00000000-0000-0000-0000-000000000001').single();
          r = data?.voice_rate || 0.45;
        } catch(e) {
          r = 0.45;
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

  // Sister Branches for Voice Assignment
  const [childBranches, setChildBranches] = useState<any[]>([]);
  const [assignModalVoice, setAssignModalVoice] = useState<any | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [assigningVoiceModal, setAssigningVoiceModal] = useState<boolean>(false);
  const [assignVoiceSuccess, setAssignVoiceSuccess] = useState<string>('');
  const [assignVoiceError, setAssignVoiceError] = useState<string>('');

  useEffect(() => {
    const fetchChildBranches = async () => {
      if (!madrasah?.id) return;
      try {
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-branches', institutionId: madrasah.id })
        });
        const data = await res.json();
        if (res.ok && data.branches) {
          setChildBranches(data.branches.filter((b: any) => !b.isMain));
        }
      } catch (err) {
        console.error("Failed to fetch branches for voice assign:", err);
      }
    };
    fetchChildBranches();
  }, [madrasah?.id]);

  const handleAssignVoiceToBranches = async () => {
    if (!assignModalVoice || selectedBranchIds.length === 0) return;

    setAssigningVoiceModal(true);
    setAssignVoiceError('');
    setAssignVoiceSuccess('');

    try {
      if (isSuperAdmin) {
        const targetId = selectedBranchIds[0];
        const { error } = await supabase.from('voice_templates').update({
          institution_id: targetId,
          admin_status: 'approved',
          provider_status: 'approved'
        }).eq('id', assignModalVoice.id);

        if (error) throw error;

        setAssignVoiceSuccess('ভয়েস বার্তাটি সফলভাবে প্রতিষ্ঠানে এসাইন করা হয়েছে!');
        setTimeout(() => {
          setAssignModalVoice(null);
          setSelectedBranchIds([]);
          setAssignVoiceSuccess('');
          fetchVoices();
        }, 1200);
      } else {
        if (!madrasah?.id) return;
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign-voice-template',
            parent_institution_id: madrasah.id,
            voice_template_id: assignModalVoice.id,
            target_branch_ids: selectedBranchIds
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to assign voice to branches');

        setAssignVoiceSuccess(data.message || 'ভয়েস মেসেজটি সফলভাবে শাখায় এসাইন করা হয়েছে!');
        setTimeout(() => {
          setAssignModalVoice(null);
          setSelectedBranchIds([]);
          setAssignVoiceSuccess('');
          fetchVoices();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error assigning voice to branches:', err);
      setAssignVoiceError(err.message || 'এসাইন করতে সমস্যা হয়েছে');
    } finally {
      setAssigningVoiceModal(false);
    }
  };

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
    if (data?.voice_rate && !madrasah?.voice_rate) setVoiceRate(data.voice_rate);
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
        .in('module', ['voice', 'wallet'])
        .not('transaction_id', 'like', 'REFUND_%')
        .not('transaction_id', 'like', 'ADD_REFUND_%')
        .not('transaction_id', 'like', 'CORRECT_VOICE_%')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setUserTransactions(data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsFetchingTransactions(false);
    }
  };

  const fetchVoices = async (forceSync: boolean = false) => {
    if (!madrasah && !isSuperAdmin) return;
    setLoading(true);
    try {
      setApiError(null);

      if (canApproveVoice && allInstitutions.length === 0) {
        const { data: insts } = await supabase.from('institutions').select('*').neq('name', 'SYSTEM_GLOBAL_INTERNAL');
        if (insts) setAllInstitutions(insts);
      }

      let fetchedVoices: any[] = [];
      let fetchSuccess = false;

      // 1. Fetch via backend service-role endpoint (immune to client-side RLS filtering)
      try {
        const params = new URLSearchParams({
          action: 'templates',
          institution_id: madrasah?.id || '',
          is_super_admin: isSuperAdmin ? 'true' : 'false',
          is_manager: isManager ? 'true' : 'false'
        });
        const res = await fetch(`/api/awaj?${params.toString()}`);
        if (res.ok) {
          const resJson = await res.json();
          if (resJson.templates && Array.isArray(resJson.templates)) {
            fetchedVoices = resJson.templates;
            fetchSuccess = true;
          }
        }
      } catch (backendErr) {
        console.warn('Backend templates fetch fallback:', backendErr);
      }

      // 2. Fallback to direct client query if backend endpoint was not available
      if (!fetchSuccess) {
        let templateQuery = supabase.from('voice_templates').select('*');
        if (!canApproveVoice && madrasah?.id) {
          templateQuery = templateQuery.eq('institution_id', madrasah.id);
        }
        const { data: localVoices } = await templateQuery.order('created_at', { ascending: false });
        if (localVoices) {
          fetchedVoices = localVoices;
        }
      }

      setVoices(fetchedVoices);

      // Only query Awaj API if forceSync is explicitly requested
      if (forceSync) {
        let apiVoices: any[] = [];
        const response = await fetch('/api/awaj/voices');
        if (response.ok) {
          const data = await response.json();
          apiVoices = Array.isArray(data) ? data : (data.voices || data.data || []);
        } else {
          const errData = await response.json().catch(() => ({}));
          setApiError(errData.error || (lang === 'bn' ? 'ভয়েস তালিকা সিঙ্ক করা সম্ভব হয়নি।' : 'Failed to sync voice list'));
        }

        if (fetchedVoices && fetchedVoices.length > 0 && apiVoices.length > 0) {
          const syncedVoices = [];
          for (const localVoice of fetchedVoices) {
            // Try to find matching voice in API by ID or Name
            const awajVoice = apiVoices.find(v => 
              (localVoice.provider_voice_id && v.id && v.id.toString() === localVoice.provider_voice_id.toString()) || 
              (v.name && v.name.toLowerCase() === (localVoice.title || '').toLowerCase()) ||
              (v.name && v.name.toLowerCase() === (localVoice.provider_voice_name || '').toLowerCase())
            );

            const newProviderId = awajVoice?.id ? awajVoice.id.toString() : localVoice.provider_voice_id;
            const newProviderName = awajVoice?.name || localVoice.provider_voice_name;
            const awajUrl = awajVoice?.file_url || awajVoice?.preview_url || awajVoice?.url || awajVoice?.path || '';
            
            // Sync provider metadata and file_url without overwriting admin_status
            const updatesToApply: any = {};
            if (newProviderId && localVoice.provider_voice_id !== newProviderId) {
              updatesToApply.provider_voice_id = newProviderId;
              localVoice.provider_voice_id = newProviderId;
            }
            if (newProviderName && localVoice.provider_voice_name !== newProviderName) {
              updatesToApply.provider_voice_name = newProviderName;
              localVoice.provider_voice_name = newProviderName;
            }
            if (awajUrl && (!localVoice.file_url || localVoice.file_url.trim() === '')) {
              let cleanAwajUrl = awajUrl.trim();
              if (!cleanAwajUrl.startsWith('http') && !cleanAwajUrl.startsWith('data:')) {
                const cleanPath = cleanAwajUrl.startsWith('/') ? cleanAwajUrl : `/${cleanAwajUrl}`;
                cleanAwajUrl = `https://api.awajdigital.com${cleanPath}`;
              }
              updatesToApply.file_url = cleanAwajUrl;
              localVoice.file_url = cleanAwajUrl;
            }

            if (Object.keys(updatesToApply).length > 0) {
              await supabase.from('voice_templates').update(updatesToApply).eq('id', localVoice.id);
            }
            syncedVoices.push(localVoice);
          }
          setVoices(syncedVoices);
        }
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

  const fetchSenders = async (force: boolean = false) => {
    if (hasFetchedSendersRef.current && !force) {
      return; // Already loaded, skip API call to optimize speed
    }
    if (isFetchingSendersRef.current) {
      return; // Fetch already in progress, avoid double calls
    }
    isFetchingSendersRef.current = true;
    try {
      setApiError(null);
      let sendersList: any[] = [];
      
      // Fetch default senders from Awaj API
      const response = await fetch('/api/awaj/senders').catch(() => null);
      
      if (response && response.ok) {
        const data = await response.json();
        let fetchedList = Array.isArray(data) ? data : (data.senders || data.data || []);
        
        // Keep only valid senders, specifically excluding the one ending in 98 and keeping 84
        sendersList = fetchedList.filter(s => {
          const num = String(s.callingNumber || s.caller_id || s.id || '');
          // Hide 98, show 84
          if (num.endsWith('98')) return false;
          return num.endsWith('84') || num.length > 5;
        });

        console.log('Awaj Senders List (Filtered):', sendersList);
      } else {
        // Safe local fallback list if API is unreachable or times out
        sendersList = [
          {
            id: '9610993084',
            callingNumber: '09610993084',
            name: 'Official Sender (09610993084)'
          }
        ];
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
      hasFetchedSendersRef.current = true;
    } catch (error: any) {
      console.error('Error fetching senders:', error);
      // Hard fallback
      const fallbackList = [
        {
          id: '9610993084',
          callingNumber: '09610993084',
          name: 'Official Sender (09610993084)'
        }
      ];
      if (madrasah?.voice_sender_id) {
        fallbackList.unshift({
          id: madrasah.voice_sender_id,
          callingNumber: madrasah.voice_sender_id,
          name: 'Dedicated Sender ID'
        });
      }
      setSenders(fallbackList);
      if (fallbackList.length > 0 && !selectedSenderId) {
        setSelectedSenderId(fallbackList[0].id || fallbackList[0].callingNumber);
      }
      // Mark as fetched so we don't spam if down
      hasFetchedSendersRef.current = true;
    } finally {
      isFetchingSendersRef.current = false;
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
    
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    let query = supabase
      .from('voice_broadcasts')
      .select('*, voice_templates(title)')
      .gte('created_at', fifteenDaysAgo.toISOString());
    
    // For super admins, show all history if they are in the super admin panel (madrasah.id is 'super_admin')
    // Otherwise filter by institution
    if (!isSuperAdmin || (madrasah && isValidUUID(madrasah.id))) {
      if (madrasah?.id && isValidUUID(madrasah.id)) {
        query = query.eq('institution_id', madrasah.id);
      }
    }
    
    const { data } = await query.order('created_at', { ascending: false }).limit(200);
    if (data) {
      let instIdToFilter = madrasah?.id;
      let txQuery = supabase.from('transactions').select('transaction_id, amount').eq('module', 'voice').eq('type', 'credit');
      if (instIdToFilter && isValidUUID(instIdToFilter)) {
        txQuery = txQuery.eq('institution_id', instIdToFilter);
      }
      const { data: refundTxs } = await txQuery;
      const refundMap: { [campId: string]: number } = {};
      if (refundTxs) {
        refundTxs.forEach(tx => {
          if (tx.transaction_id && tx.transaction_id.startsWith('REFUND_CAMP_')) {
            const campId = tx.transaction_id.replace('REFUND_CAMP_', '');
            refundMap[campId] = (refundMap[campId] || 0) + Number(tx.amount || 0);
          }
        });
      }

      const mappedData = data.map(item => {
        let totalTxRefund = refundMap[item.provider_campaign_id] || 0;
        if (item.retries && Array.isArray(item.retries)) {
          item.retries.forEach((rId: string) => {
            if (refundMap[rId]) totalTxRefund += refundMap[rId];
          });
        }
        const estCost = Number(item.estimated_cost || 0);
        const rawRefund = Number(item.refunded_amount || 0);
        const effectiveRefund = Math.min(estCost, Math.max(0, rawRefund));
        return {
          ...item,
          refunded_amount: effectiveRefund
        };
      });

      setBroadcastHistory(mappedData);
    }
    
    // Track results for pending/sending broadcasts and auto-check completed refunds
    if (data) {
      // Check completed broadcasts for refund accuracy (only if completed/failed and not already fully refunded)
      data.filter(b => (b.status === 'completed' || b.status === 'failed') && !b.is_refunded).forEach(async (broadcast) => {
        const activeCampaignId = (broadcast.retries && broadcast.retries.length > 0) 
          ? broadcast.retries[broadcast.retries.length - 1] 
          : broadcast.provider_campaign_id;
        if (activeCampaignId) {
          handleClaimRefundAuto(broadcast.id, activeCampaignId);
        }
      });

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
    
    // Check if broadcast is still running or in cooling period
    const isBroadcastRunning = ['sending', 'pending', 'processing', 'running', 'queued', 'scheduled', 'broadcasting'].includes(String(broadcast?.status || '').toLowerCase());
    const createdTime = new Date(broadcast?.created_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdTime) / 1000));
    const remainingWaitSeconds = Math.max(0, 120 - elapsedSeconds);

    if (isBroadcastRunning) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্রডকাস্ট চলমান রয়েছে' : 'Broadcast In Progress',
        message: lang === 'bn' 
          ? 'কল এখনও প্রসেসিং হচ্ছে। টেলিকম সার্ভার থেকে সব কলের রিপোর্ট চূড়ান্ত না হওয়া পর্যন্ত রিট্রাই করা যাবে না।' 
          : 'Broadcast is still in progress. Please wait until all calls are finalized.'
      });
      return;
    }

    if (remainingWaitSeconds > 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'চূড়ান্ত রিপোর্টের অপেক্ষা' : 'Waiting For Final Reports',
        message: lang === 'bn'
          ? `টেলিকম সার্ভার থেকে সব কলের চূড়ান্ত রিপোর্ট নিশ্চিত হওয়ার জন্য আরও ${remainingWaitSeconds} সেকেন্ড অপেক্ষা করুন।`
          : `Please wait ${remainingWaitSeconds}s for telecom server final delivery reports before retrying.`
      });
      return;
    }

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
    if (IS_VOICE_BROADCAST_DISABLED) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্রডকাস্ট বন্ধ আছে' : 'Broadcast Disabled',
        message: lang === 'bn' ? 'ভয়েস কল ব্রডকাস্ট বাটন টি অফ করে রাখা হয়েছে।' : 'Voice call broadcast button is turned off.'
      });
      return;
    }

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

      // For 096 IP telephony numbers, Awaj strictly expects 096... without 88 prefix
      if (sNumber.startsWith('88096')) {
        sNumber = sNumber.replace(/^88/, '');
      } else if (sNumber === '83') {
        sNumber = '09610993084';
      } else if (sNumber === '1') {
        sNumber = '09606990198';
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
      const pulses = getPulsesForVoice(voiceId || broadcast.voice_template_id || selectedVoiceId);
      const estimatedCost = uniqueNormalizedPhoneNumbers.length * voiceRate * pulses;

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

  const handleExpandHistory = async (broadcast: any, forceReload: boolean = false) => {
    if (expandedHistoryId === broadcast.id && !forceReload) {
      setExpandedHistoryId(null);
      setHistoryDetails(null);
      return;
    }
    
    setExpandedHistoryId(broadcast.id);
    setLoadingDetails(true);
    if (!forceReload) {
      setHistoryDetails(null);
    }
    
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
        const cleanPhoneForDeduplication = (phoneStr: string) => {
          if (!phoneStr) return '';
          let digits = phoneStr.replace(/[^0-9]/g, '');
          if (digits.startsWith('880')) {
            digits = digits.substring(2);
          }
          if (digits.startsWith('01') && digits.length === 11) {
            return digits;
          }
          if (digits.startsWith('1') && digits.length === 10) {
            return '0' + digits;
          }
          return digits;
        };

        const deduplicatedCallsMap = new Map();
        allCalls.forEach(call => {
           let p = extractPhoneFromLog(call);
           if (p) {
             const norm = cleanPhoneForDeduplication(p);
             deduplicatedCallsMap.set(norm || p, call);
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
    if (IS_VOICE_BROADCAST_DISABLED) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্রডকাস্ট বন্ধ আছে' : 'Broadcast Disabled',
        message: lang === 'bn' ? 'ভয়েস কল ব্রডকাস্ট বাটন টি অফ করে রাখা হয়েছে। পরবর্তীতে নির্দেশ দিলে আবার চালু করা হবে।' : 'Voice call broadcast button is turned off.'
      });
      return;
    }

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

    const pulses = getPulsesForVoice(selectedVoiceId);
    const estimatedCost = count * voiceRate * pulses;

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
        
        phoneNumbers = students.map(s => s.guardian_phone).filter(p => !!p);
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
      const pulses = getPulsesForVoice(selectedVoiceId);
      const finalEstimatedCost = finalCount * voiceRate * pulses;
      
      if (finalCount === 0) {
        throw new Error('No valid 11-digit phone numbers (01...) found.');
      }

      if (!isSuperAdmin && walletBalance < finalEstimatedCost) {
        throw new Error(lang === 'bn' ? `ব্যালেন্স পর্যাপ্ত নয়। খরচ: ${finalEstimatedCost} টাকা।` : `Insufficient balance. Estimated cost: ${finalEstimatedCost} BDT.`);
      }

      // Get the selected template to get the awaj_voice_id or file_url
      const voice = voices.find(v => v.id === selectedVoiceId);
      if (!voice) throw new Error('Selected voice not found.');

      if (!canApproveVoice) {
        const voiceStatus = voice.admin_status || voice.provider_status || 'approved';
        if (voiceStatus !== 'approved') {
          throw new Error(lang === 'bn' 
            ? 'এই ভয়েস বার্তাটি এখনো পেন্ডিং আছে। এডমিন বা ম্যানেজার অনুমোদন করার পরেই ব্রডকাস্ট করা সম্ভব।' 
            : 'This voice message is pending Admin/Manager approval.');
        }
      }

      // 1. Send to Awaj Digital API
      const requestId = crypto.randomUUID();
      
      // Find the actual sender object to get the calling number
      const senderObj = senders.find(s => 
        (s.id && s.id.toString() === selectedSenderId.toString()) || 
        (s.callingNumber && s.callingNumber.toString() === selectedSenderId.toString()) || 
        (s.caller_id && s.caller_id.toString() === selectedSenderId.toString())
      );
      
      // Documentation says 'sender' must be the active caller sender number (e.g. 09610993084)
      let sNumber = senderObj ? (senderObj.callingNumber || senderObj.caller_id || senderObj.id).toString() : selectedSenderId.toString();
      
      // For 096 IP telephony numbers, Awaj strictly expects 096... without 88 prefix
      if (sNumber.startsWith('88096')) {
        sNumber = sNumber.replace(/^88/, '');
      } else if (sNumber === '83') {
        sNumber = '09610993084';
      } else if (sNumber === '1') {
        sNumber = '09606990198';
      }
      
      // Voice name: Awaj Standard Broadcast API strictly requires the registered voice NAME (never a numeric ID)
      const preferredVoiceKey = voice.provider_voice_name || voice.title || voice.name || voice.voice_name || voice.provider_voice_id;

      const payload = {
        request_id: requestId,
        voice: preferredVoiceKey, 
        voice_name: voice.provider_voice_name || voice.title,
        voice_id: voice.provider_voice_id || voice.id,
        provider_voice_id: voice.provider_voice_id,
        provider_voice_name: voice.provider_voice_name,
        voice_template_id: voice.id,
        title: voice.title,
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([audioBlob], `recorded_voice_${Date.now()}.webm`, { type: 'audio/webm' });
        setUploadFile(recordedFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'মাইক্রোফোন সমস্যা' : 'Microphone Error',
        message: lang === 'bn' ? 'মাইক্রোফোন এক্সেস পাওয়া যায়নি। অনুগ্রহ করে পারমিশন চেক করুন।' : 'Microphone access denied. Please check permissions.'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleVoiceUpload = async () => {
    if (!madrasah || !uploadName.trim() || !uploadFile) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Form',
        message: lang === 'bn' ? 'অনুগ্রহ করে ভয়েসের শিরোনাম দিন এবং অডিও ফাইল নির্বাচন বা রেকর্ড করুন।' : 'Please provide a voice title and select or record an audio file.'
      });
      return;
    }

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

      const cleanTitle = uploadName.trim();
      const encodedName = encodeURIComponent(cleanTitle);
      const response = await fetch(`/api/voices/upload?name=${encodedName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Voice-Name': encodedName
        },
        body: JSON.stringify({
          name: cleanTitle,
          voice_name: cleanTitle,
          title: cleanTitle,
          audio_base64: base64Audio,
          filename: uploadFile.name,
          institution_id: madrasah.id,
          is_super_admin: isSuperAdmin,
          is_manager: isManager,
          duration: effectiveDuration
        })
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || resData.error || (lang === 'bn' ? 'ভয়েস ফাইল আপলোড করতে সমস্যা হয়েছে।' : 'Failed to upload voice audio.'));
      }

      const audioUrl = resData.file_url || resData.preview_url || resData.url || resData.data?.file_url || resData.data?.url || '';
      const providerVoiceId = resData.id || resData.voice_id || resData.data?.id || resData.result?.id || '';
      const providerVoiceName = resData.name || resData.title || cleanTitle;
      const initialStatus = canApproveVoice ? 'approved' : 'pending';

      let newVoiceRecord = resData.voice_template;
      if (newVoiceRecord) {
        if (!newVoiceRecord.file_url) newVoiceRecord.file_url = audioUrl;
        if (!newVoiceRecord.duration) newVoiceRecord.duration = effectiveDuration;
      }

      // Fallback: if not saved by backend endpoint, save directly
      if (!newVoiceRecord) {
        const { data: dbItem, error: dbError } = await supabase.from('voice_templates').insert({
          institution_id: madrasah.id,
          title: cleanTitle,
          file_url: audioUrl,
          admin_status: initialStatus,
          provider_status: initialStatus,
          provider_voice_name: providerVoiceName,
          provider_voice_id: providerVoiceId ? String(providerVoiceId) : null,
          duration: effectiveDuration
        }).select().single();

        if (dbError) {
          console.warn('Direct template save warning:', dbError.message);
        } else if (dbItem) {
          newVoiceRecord = dbItem;
        }
      }

      if (!newVoiceRecord) {
        newVoiceRecord = {
          id: crypto.randomUUID(),
          institution_id: madrasah.id,
          title: cleanTitle,
          file_url: audioUrl,
          admin_status: initialStatus,
          provider_status: initialStatus,
          provider_voice_name: providerVoiceName,
          provider_voice_id: providerVoiceId ? String(providerVoiceId) : null,
          duration: effectiveDuration,
          created_at: new Date().toISOString()
        };
      }

      // Immediately add to local state so user sees it right away!
      setVoices(prev => [newVoiceRecord, ...prev.filter(v => v.id !== newVoiceRecord.id)]);

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: canApproveVoice 
          ? (lang === 'bn' ? 'ভয়েস সফলভাবে সংরক্ষিত ও সরাসরি অনুমোদন হয়েছে।' : 'Voice uploaded and approved.')
          : (lang === 'bn' ? 'ভয়েস সফলভাবে সংরক্ষিত হয়েছে! এটি এখন পেন্ডিং অবস্থায় আছে। এডমিন / ম্যানেজার অনুমোদন দিলেই ব্রডকাস্টে ব্যবহার করা যাবে।' : 'Voice uploaded successfully! Pending approval from Admin / Manager.')
      });

      setUploadName('');
      setUploadFile(null);
      setShowUploadModal(false);
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

  const handleApproveVoice = async (voiceId: string) => {
    try {
      let isSuccess = false;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: 'approve_voice', id: voiceId, voice_id: voiceId })
        });
        if (res.ok) {
          isSuccess = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to approve voice');
        }
      } else {
        const { error } = await supabase.from('voice_templates').update({
          admin_status: 'approved',
          provider_status: 'approved'
        }).eq('id', voiceId);
        if (error) throw error;
        isSuccess = true;
      }

      if (isSuccess) {
        setStatusModal({
          show: true,
          type: 'success',
          title: lang === 'bn' ? 'সফল' : 'Success',
          message: lang === 'bn' ? 'ভয়েস সফলভাবে অনুমোদন করা হয়েছে।' : 'Voice approved successfully.'
        });
        fetchVoices();
      }
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    }
  };

  const handleRejectVoice = async (voiceId: string) => {
    try {
      let isSuccess = false;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: 'reject_voice', id: voiceId, voice_id: voiceId })
        });
        if (res.ok) {
          isSuccess = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to reject voice');
        }
      } else {
        const { error } = await supabase.from('voice_templates').update({
          admin_status: 'rejected',
          provider_status: 'rejected'
        }).eq('id', voiceId);
        if (error) throw error;
        isSuccess = true;
      }

      if (isSuccess) {
        setStatusModal({
          show: true,
          type: 'success',
          title: lang === 'bn' ? 'সফল' : 'Success',
          message: lang === 'bn' ? 'ভয়েসটি বাতিল করা হয়েছে।' : 'Voice rejected successfully.'
        });
        fetchVoices();
      }
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
    const targetNum = method === 'bkash' ? adminBkash : '';
    const cleanNum = targetNum.replace(/[^0-9]/g, '');
    if (cleanNum) {
      navigator.clipboard.writeText(cleanNum).catch(() => {});
    }

    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);

    if (method === 'bkash') {
      if (isAndroid) {
        window.location.href = 'bkash://';
        setTimeout(() => {
          window.location.href = 'intent://#Intent;package=com.bKash.customerapp;end';
        }, 800);
      } else if (isIOS) {
        window.location.href = 'bkash://';
        setTimeout(() => {
          window.location.href = 'https://apps.apple.com/app/bkash/id1454522436';
        }, 2000);
      } else {
        alert(lang === 'bn' 
          ? `বিকাশ পার্সোনাল নম্বর (${cleanNum || adminBkash}) কপি করা হয়েছে! আপনার মোবাইল থেকে বিকাশ অ্যাপ অথবা *247# ডায়াল করে Send Money করুন।`
          : `bKash personal number (${cleanNum || adminBkash}) copied! Please send money from your mobile app or dial *247#.`
        );
      }
    } else {
      if (isAndroid) {
        window.location.href = 'intent://#Intent;scheme=nagad;package=com.konasl.nagad;end';
      } else if (isIOS) {
        window.location.href = 'nagad://';
        setTimeout(() => {
          window.location.href = 'https://apps.apple.com/app/nagad/id1471844877';
        }, 2000);
      }
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

      <div className="relative h-[60px] bg-white rounded-[2.5rem] p-1.5 shadow-bubble border border-slate-100 flex items-center mb-8 overflow-hidden">
        <div 
          className="absolute h-[48px] bg-[#2563EB] rounded-[2.5rem] transition-all duration-500 shadow-premium"
          style={{ 
            width: availableTabs.length > 0 ? `${100 / availableTabs.length}%` : '0',
            left: availableTabs.length > 0 ? `${(Math.max(0, availableTabs.indexOf(activeTab)) * 100) / availableTabs.length}%` : '0',
            transform: 'translateX(0)'
          }}
        />
        {availableTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 h-full rounded-[2.5rem] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all z-10 ${activeTab === tab ? 'text-white' : 'text-slate-400'}`}>
            {tab === 'broadcast' ? <Send size={16} /> : 
             tab === 'templates' ? <Mic size={16} /> : 
             tab === 'history' ? <History size={16} /> :
             <CreditCard size={16} />}
            <span className="font-noto truncate">
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
            {IS_VOICE_BROADCAST_DISABLED && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700/50 rounded-2xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-200 shadow-xs">
                <AlertCircle className="shrink-0 text-amber-600 dark:text-amber-400" size={22} />
                <div className="text-xs sm:text-sm font-bold font-noto">
                  {lang === 'bn' 
                    ? 'ভয়েস কল ব্রডকাস্ট বাটন টি অফ করে রাখা হয়েছে। পরবর্তীতে নির্দেশ দিলে আবার চালু করা হবে।' 
                    : 'Voice call broadcast button is currently turned off.'}
                </div>
              </div>
            )}
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
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest">{t('select_voice', lang)}</h4>
                      {pendingVoicesCount > 0 && !canApproveVoice && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={10} /> {pendingVoicesCount} টি অপেক্ষমাণ
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <button onClick={() => setShowVoiceDropdown(!showVoiceDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#1E3A8A]">
                          {selectedVoiceId ? selectableVoices.find(v => v.id === selectedVoiceId)?.title : t('select_voice', lang)}
                        </span>
                        <ChevronDown className={`text-slate-300 transition-all ${showVoiceDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showVoiceDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {selectableVoices.length > 0 ? (
                            selectableVoices.map(v => (
                              <button key={v.id} onClick={() => { setSelectedVoiceId(v.id); setShowVoiceDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 flex items-center justify-between ${selectedVoiceId === v.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                <span className="font-black font-noto">{v.title}</span>
                                {voiceDurations[v.id] ? (
                                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedVoiceId === v.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                     {voiceDurations[v.id]}s ({getPulsesForVoice(v.id)} {getPulsesForVoice(v.id) === 1 ? 'Pulse' : 'Pulses'})
                                   </span>
                                ) : null}
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center">
                              <p className="text-xs font-bold text-slate-400 font-noto">
                                {pendingVoicesCount > 0 
                                  ? (lang === 'bn' ? 'আপনার আপলোডকৃত ভয়েসটি এডমিন / ম্যানেজারের অনুমোদনের অপেক্ষায় আছে।' : 'Your voice is pending Admin / Manager approval.')
                                  : (lang === 'bn' ? 'কোনো অনুমোদিত ভয়েস পাওয়া যায়নি।' : 'No approved voices found.')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {pendingVoicesCount > 0 && !canApproveVoice && (
                      <p className="text-[10px] font-bold text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-100 flex items-center gap-1.5 font-noto">
                        <Info size={12} className="shrink-0 text-amber-600" />
                        <span>{lang === 'bn' ? `${pendingVoicesCount} টি ভয়েস বার্তা পেন্ডিং অবস্থায় রয়েছে। এডমিন / ম্যানেজার অনুমোদন দিলে এখানে ব্যবহারের জন্য আসবে।` : `${pendingVoicesCount} voice(s) pending Admin / Manager approval.`}</span>
                      </p>
                    )}
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
                    disabled={IS_VOICE_BROADCAST_DISABLED || !selectedVoiceId || (targetType === 'class' && !selectedClassId && !isPreSelected && !isTargetingInstitutions) || (targetType === 'teachers' && teachers.length === 0) || (targetType === 'specific_institution' && selectedInstitutionIds.length === 0) || !selectedSenderId || isBroadcasting}
                    className={`w-full h-[64px] font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg transition-all mt-auto ${
                      IS_VOICE_BROADCAST_DISABLED
                        ? 'bg-slate-400 text-white cursor-not-allowed opacity-70'
                        : 'bg-[#2563EB] text-white active:scale-95 disabled:opacity-40'
                    }`}
                  >
                    {isBroadcasting ? <Loader2 className="animate-spin" size={24} /> : (
                      <>
                        <Send size={20} /> 
                        {IS_VOICE_BROADCAST_DISABLED
                          ? (lang === 'bn' ? 'ব্রডকাস্ট অফ আছে (OFF)' : 'Voice Broadcast Disabled')
                          : (targetType === 'all_institutions' ? 'Broadcasting to All Institutions' : 
                             targetType === 'specific_institution' ? `Calling ${selectedInstitutionIds.length} Institutions` :
                             t('start_broadcast', lang))}
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
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <div>
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('your_voices', lang)}</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5 font-noto">
                  {lang === 'bn' ? 'ব্রডকাস্টে ব্যবহারের জন্য অনুমোদিত ও পেন্ডিং ভয়েস বার্তা তালিকা' : 'List of approved and pending voice templates'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowUploadModal(true)} 
                  className="bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-blue-200 cursor-pointer"
                >
                  <Plus size={16} /> <span>{lang === 'bn' ? 'নতুন ভয়েস আপলোড / রেকর্ড' : 'Upload / Record Voice'}</span>
                </button>
                <button 
                  onClick={() => fetchVoices(true)} 
                  disabled={loading} 
                  className="bg-blue-50 text-[#2563EB] px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 active:scale-95 transition-all border border-blue-100 hover:bg-blue-100 cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <History size={14} />} {t('sync_voices', lang)}
                </button>
              </div>
            </div>

            {/* Super Admin / Manager Pending Voices Alert Banner */}
            {canApproveVoice && pendingVoicesCount > 0 && (
              <div className="bg-amber-500/10 border-2 border-amber-500/30 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Mic size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-amber-900 dark:text-amber-300 text-sm font-noto flex items-center gap-2">
                      <span>{pendingVoicesCount} টি নতুন ভয়েস বার্তা অনুমোদনের অপেক্ষায় জমা হয়েছে!</span>
                    </h4>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 font-noto mt-0.5">
                      ইউজারদের পাঠানো অডিওগুলো প্লে করে শুনুন এবং অনুমোদন বা নির্দিষ্ট প্রতিষ্ঠানে এসাইন করুন।
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVoiceStatusFilter('pending')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all shrink-0 active:scale-95 cursor-pointer flex items-center justify-center gap-2 font-noto"
                >
                  <Clock size={15} />
                  <span>পেন্ডিং ভয়েস পর্যালোচনা করুন ({pendingVoicesCount})</span>
                </button>
              </div>
            )}

            {/* Voice Status Filter Tabs */}
            <div className="flex items-center gap-2 px-1 overflow-x-auto py-1">
              {(canApproveVoice ? (['pending', 'approved', 'awaj'] as const) : (['pending', 'approved'] as const)).map(statusKey => {
                const count = voices.filter(v => {
                  const status = v.admin_status || v.provider_status || 'approved';
                  if (statusKey === 'pending') return status === 'pending';
                  if (statusKey === 'approved') return status === 'approved';
                  return Boolean(v.provider_voice_id || v.provider_voice_name || !v.institution_id);
                }).length;

                return (
                  <button
                    key={statusKey}
                    onClick={() => setVoiceStatusFilter(statusKey)}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 font-noto ${
                      voiceStatusFilter === statusKey 
                        ? 'bg-[#1E3A8A] text-white shadow-md' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>
                      {statusKey === 'pending' 
                        ? (canApproveVoice ? (lang === 'bn' ? 'ইউজার পেন্ডিং ভয়েস' : 'User Pending') : (lang === 'bn' ? 'পেন্ডিং (অপেক্ষমাণ)' : 'Pending'))
                        : statusKey === 'approved' 
                        ? (lang === 'bn' ? 'অনুমোদিত ভয়েস' : 'Approved') 
                        : (lang === 'bn' ? 'আওয়াজ রেজিস্টার্ড ভয়েস' : 'Awaj Register')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${voiceStatusFilter === statusKey ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
               {loading ? (
                  <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" size={30} /></div>
               ) : filteredVoices.length > 0 ? (
                  filteredVoices.map(v => {
                    const status = v.admin_status || v.provider_status || 'approved';
                    const isPending = status === 'pending';
                    const isRejected = status === 'rejected';
                    const audioTargetUrl = v.file_url || v.preview_url || v.url;

                    return (
                      <div key={v.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble space-y-3">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                 isPending ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                 isRejected ? 'bg-red-50 text-red-600 border-red-100' :
                                 'bg-emerald-50 text-emerald-600 border-emerald-100'
                               }`}>
                                  <Mic size={18} />
                               </div>
                               <div>
                                 <div className="flex items-center gap-1.5">
                                   <h4 className="font-black text-[#1E3A8A] text-[15px] font-noto">{v.title}</h4>
                                   <button
                                     onClick={() => setEditingVoice({ id: v.id, title: v.title })}
                                     className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                     title={lang === 'bn' ? 'ভয়েস নাম এডিট করুন' : 'Edit Title'}
                                   >
                                     <Edit2 size={13} />
                                   </button>
                                 </div>
                                 <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                   {isPending ? (
                                     <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit font-noto">
                                       <Clock size={10} /> {lang === 'bn' ? 'অপেক্ষমাণ (পেন্ডিং)' : 'Pending'}
                                     </span>
                                   ) : isRejected ? (
                                     <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 w-fit font-noto">
                                       <XCircle size={10} /> {lang === 'bn' ? 'বাতিলকৃত' : 'Rejected'}
                                     </span>
                                   ) : (
                                     <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit font-noto">
                                       <CheckCircle2 size={10} /> {lang === 'bn' ? 'অনুমোদিত' : 'Approved'}
                                     </span>
                                   )}
                                   <span className="text-[9px] font-black text-[#2563EB] bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit font-noto">
                                     <Clock size={10} className="text-blue-500" />
                                     {v.duration || voiceDurations[v.id] ? `${v.duration || voiceDurations[v.id]} সেকেন্ড` : 'ডিউরেশন...' }
                                   </span>
                                   {canApproveVoice && (
                                     <span className="text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit font-noto">
                                       <Building2 size={10} className="text-blue-500" />
                                       {allInstitutions.find(i => i.id === v.institution_id)?.name || 'সিস্টেম / গ্লোবাল'}
                                     </span>
                                   )}
                                 </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {audioTargetUrl && (
                                <button 
                                  onClick={() => togglePlay(v.id, audioTargetUrl)}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${playingId === v.id ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-[#2563EB] hover:bg-blue-100'}`}
                                  title={lang === 'bn' ? 'প্লে করে শুনুন' : 'Play Audio'}
                                >
                                  {playingId === v.id ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                                </button>
                              )}
                              <button 
                                onClick={() => setShowDeleteConfirm({ id: v.id, providerId: v.provider_voice_id, fileUrl: v.file_url, title: v.title })}
                                className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors cursor-pointer"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                         </div>

                         {/* Admin / Manager Approval Action Buttons if Pending */}
                         {isPending && canApproveVoice && (
                           <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                             <button
                               onClick={() => handleApproveVoice(v.id)}
                               className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                             >
                               <CheckCircle2 size={14} />
                               <span>{lang === 'bn' ? 'অনুমোদন করুন' : 'Approve'}</span>
                             </button>
                             <button
                               onClick={() => handleRejectVoice(v.id)}
                               className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all border border-red-200 cursor-pointer"
                             >
                               <XCircle size={14} />
                               <span>{lang === 'bn' ? 'বাতিল' : 'Reject'}</span>
                             </button>
                           </div>
                         )}


                         {/* Admin / Manager Re-approve Action if Rejected */}
                         {isRejected && canApproveVoice && (
                           <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                             <button
                               onClick={() => handleApproveVoice(v.id)}
                               className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                             >
                               <CheckCircle2 size={14} />
                               <span>{lang === 'bn' ? 'পুনরায় অনুমোদন দিন' : 'Re-Approve'}</span>
                             </button>
                           </div>
                         )}
                         {/* Info note for regular user when pending */}
                         {isPending && !canApproveVoice && (
                           <p className="text-[10px] font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-100 flex items-center gap-1.5 font-noto">
                             <Info size={13} className="shrink-0 text-amber-600" />
                             <span>{lang === 'bn' ? 'এটি এখন পেন্ডিং অবস্থায় আছে। এডমিন / ম্যানেজার অনুমোদন দিলেই ব্রডকাস্টে ব্যবহার করা যাবে।' : 'Pending approval from Admin / Manager.'}</span>
                           </p>
                         )}

                         {childBranches.length > 0 && !isPending && !isRejected && (
                           <div className="pt-2 border-t border-slate-100 flex justify-end">
                             <button 
                               onClick={() => {
                                 setAssignModalVoice(v);
                                 setSelectedBranchIds([]);
                                 setAssignVoiceSuccess('');
                                 setAssignVoiceError('');
                               }}
                               title="শাখা একাউন্টে এসাইন করুন"
                               className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-purple-100/60 shadow-sm active:scale-95"
                             >
                               <Building2 size={14} />
                               <span>{lang === 'bn' ? 'শাখায় এসাইন করুন' : 'Assign to Branch'}</span>
                             </button>
                           </div>
                         )}
                      </div>
                    );
                  })
               ) : (
                  <div className="col-span-full text-center py-16 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                     <Mic className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                     <p className="text-slate-400 font-black text-xs uppercase tracking-widest">{t('no_templates', lang)}</p>
                     <p className="text-slate-400 text-xs mt-1 font-noto">
                       {lang === 'bn' ? 'নতুন ভয়েস বার্তা আপলোড বা রেকর্ড করতে উপরের বোতামে চাপ দিন' : 'Click the button above to upload or record a new voice message'}
                     </p>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3.5 border-t border-slate-100/80">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('target', lang)}</p>
                          <p className="text-xs font-black text-[#1E3A8A] capitalize">
                            {h.target_class_name ? h.target_class_name : (
                              h.target_type === 'students' ? t('students', lang, madrasah?.institution_type) :
                              h.target_type === 'staff' ? t('teachers', lang, madrasah?.institution_type) :
                              h.target_type
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('numbers', lang)}</p>
                          <p className="text-xs font-black text-[#1E3A8A]">{h.total_numbers}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            {lang === 'bn' ? 'প্রাথমিক চার্জ' : 'Initial Charge'}
                          </p>
                          <p className="text-xs font-bold text-slate-600">{h.estimated_cost} ৳</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            {lang === 'bn' ? 'প্রকৃত খরচ (নিট)' : 'Actual Cost (Net)'}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-black text-emerald-700">
                              {Math.max(0, Number((h.estimated_cost - Number(h.refunded_amount || 0)).toFixed(2)))} ৳
                            </p>
                            {Number(h.refunded_amount || 0) > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                {lang === 'bn' ? `রিফান্ড: ${h.refunded_amount} ৳` : `Refund: ${h.refunded_amount} ৳`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {expandedHistoryId === h.id && (
                      <div className="bg-slate-50 p-5 border-t border-slate-100 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Smartphone size={12} /> {t('call_details', lang)}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExpandHistory(h, true);
                            }}
                            disabled={loadingDetails}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors border border-blue-100"
                            title={lang === 'bn' ? 'সর্বশেষ রিপোর্ট রিফ্রেশ করুন' : 'Refresh Report'}
                          >
                            <RefreshCw size={12} className={loadingDetails ? 'animate-spin' : ''} />
                            {lang === 'bn' ? 'রিপোর্ট রিফ্রেশ' : 'Refresh Report'}
                          </button>
                        </div>
                        
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
                              const successStatuses = ['answered', 'completed', 'delivered', 'accepted', 'success', 'picked', 'pickedup', 'picked_up', 'connected', 'complete', 'finished', 'finished_success', 'picked up'];
                              const failureStatuses = [
                                'failed', 'no answer', 'busy', 'cancelled', 'error', 'undelivered', 'rejected', 'declined', 
                                'unanswered', 'timeout', 'no-answer', 'abandoned', 'not_answered', 'notanswered', 
                                'notpicked', 'not_picked', 'missed', 'blocked', 'unavailable', 'not answered', 'not picked',
                                'no-picked', 'no_picked', 'noanswer', 'not-picked', 'reject', 'declined', 'failed-retry', 'failed_retry',
                                'no picked', 'no answered', 'no answer', 'not pick', 'not-pickedup', 'not_pickedup'
                              ];

                              const answeredLogs = logs.filter((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
                                const rawDuration = log.duration ?? log.billsec ?? log.duration_sec ?? log.talking_time ?? log.seconds ?? 0;
                                const duration = Number(rawDuration) || 0;
                                return successStatuses.includes(status) || duration > 0;
                              });

                              const failedLogs = logs.filter((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
                                const rawDuration = log.duration ?? log.billsec ?? log.duration_sec ?? log.talking_time ?? log.seconds ?? 0;
                                const duration = Number(rawDuration) || 0;
                                return failureStatuses.includes(status) || (duration === 0 && !successStatuses.includes(status) && !['pending', 'sending', 'processing', 'queued'].includes(status));
                              });

                              const isBroadcastRunning = ['sending', 'pending', 'processing', 'running', 'queued', 'scheduled', 'broadcasting'].includes(String(h.status || '').toLowerCase());
                              const providerStatus = String(historyDetails?.broadcast?.status || historyDetails?.status || historyDetails?.state || '').toLowerCase();
                              const isProviderRunning = ['sending', 'pending', 'processing', 'running', 'queued', 'scheduled', 'broadcasting'].includes(providerStatus);
                              const isAwajComplete = historyDetails?.isComplete !== false && (historyDetails?.statusDistribution?.pending === 0 || historyDetails?.statusDistribution?.pending === undefined);
                              const hasPendingLogs = logs.some((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase().trim();
                                return ['pending', 'sending', 'processing', 'queued', 'calling', 'ringing', 'dialing', 'in_progress', 'in-progress'].includes(status);
                              });

                              const isStillProcessing = isBroadcastRunning || isProviderRunning || !isAwajComplete || hasPendingLogs;

                              const createdTime = new Date(h.created_at).getTime();
                              const elapsedSeconds = Math.max(0, Math.floor((currentTime - createdTime) / 1000));
                              const COOLDOWN_SECONDS = 120; // 2 minutes wait for final telecom reports
                              const remainingWaitSeconds = Math.max(0, COOLDOWN_SECONDS - elapsedSeconds);
                              const isCooldownActive = remainingWaitSeconds > 0;
                              const canRetry = !isStillProcessing && !isCooldownActive;
                              
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

                                  {/* Telecom CDR Finalization & Processing Status Notifications */}
                                  {isStillProcessing ? (
                                    <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-amber-900">
                                      <Loader2 size={18} className="animate-spin text-amber-600 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1 text-xs">
                                        <p className="font-bold text-amber-950">
                                          {lang === 'bn' ? 'কল ব্রডকাস্ট চলমান রয়েছে (Processing)' : 'Voice broadcast is still running'}
                                        </p>
                                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                          {lang === 'bn'
                                            ? 'টেলিকম অপারেটর সার্ভার থেকে সব কলের চূড়ান্ত ডেলিভারি রিপোর্ট না পাওয়া পর্যন্ত রিট্রাই বাটন সাময়িকভাবে লক থাকবে।'
                                            : 'Retry is locked while calls are actively ringing and telecom CDR reports are finalizing.'}
                                        </p>
                                      </div>
                                    </div>
                                  ) : isCooldownActive ? (
                                    <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-blue-900">
                                      <Timer size={18} className="text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
                                      <div className="flex-1 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="font-bold text-blue-950">
                                            {lang === 'bn' ? 'টেলিকম সার্ভার থেকে চূড়ান্ত রিপোর্টের অপেক্ষা' : 'Waiting for telecom final CDR sync'}
                                          </p>
                                          <span className="font-mono font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md text-[11px]">
                                            {remainingWaitSeconds}s
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                                          {lang === 'bn'
                                            ? `সঠিক ডেলিভারি রিপোর্ট পেতে আরও ${remainingWaitSeconds} সেকেন্ড অপেক্ষা করুন। এরপর রিট্রাই বাটন সক্রিয় হবে।`
                                            : `To ensure accurate billing and delivery status, waiting ${remainingWaitSeconds}s for telecom server final sync.`}
                                        </p>
                                      </div>
                                    </div>
                                  ) : failedLogs.length > 0 ? (
                                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-2.5 text-emerald-900 text-xs">
                                      <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
                                      <p className="text-[11px] text-emerald-800">
                                        {lang === 'bn'
                                          ? `সব কলের চূড়ান্ত রিপোর্ট সম্পন্ন হয়েছে। আপনি চাইলে ব্যর্থ ${failedLogs.length}টি কলে পুনরায় কল করতে পারেন।`
                                          : `All telecom reports finalized. You can safely retry the ${failedLogs.length} failed calls.`}
                                      </p>
                                    </div>
                                  ) : null}

                                  {failedLogs.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-end mt-4 gap-2">
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

                                      {canRetry ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRetryFailed(h, failedLogs);
                                          }}
                                          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 animate-in fade-in"
                                        >
                                          <RefreshCw size={14} />
                                          {lang === 'bn' ? `ব্যর্থ ${failedLogs.length}টি কল পুনরায় করুন` : `Retry ${failedLogs.length} Failed Calls`}
                                        </button>
                                      ) : (
                                        <button
                                          disabled
                                          className="px-4 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-not-allowed shadow-none"
                                          title={isStillProcessing 
                                            ? (lang === 'bn' ? 'কল শেষ না হওয়া পর্যন্ত রিট্রাই লক' : 'Retry locked while processing') 
                                            : (lang === 'bn' ? `চূড়ান্ত রিপোর্টের অপেক্ষা: ${remainingWaitSeconds} সেকেন্ড` : `Waiting for report: ${remainingWaitSeconds}s`)}
                                        >
                                          <Lock size={13} className="text-slate-400" />
                                          {isStillProcessing ? (
                                            <span>{lang === 'bn' ? 'রিট্রাই লক (প্রসেসিং হচ্ছে)' : 'Retry Locked (Processing)'}</span>
                                          ) : (
                                            <span>{lang === 'bn' ? `রিট্রাই লক (${remainingWaitSeconds}s অপেক্ষা)` : `Retry Locked (${remainingWaitSeconds}s)`}</span>
                                          )}
                                        </button>
                                      )}
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
                 ) : (() => {
                   const rechargeTransactions = userTransactions.filter(tr => {
                     const txId = (tr.transaction_id || '').toUpperCase();
                     const desc = (tr.description || '').toLowerCase();
                     return !txId.startsWith('ADD_REFUND_') && 
                            !txId.startsWith('REFUND_') && 
                            !txId.startsWith('CORRECT_VOICE_') && 
                            !desc.includes('refund') && 
                            !desc.includes('correction') && 
                            !desc.includes('deducted');
                   });
                   
                   return rechargeTransactions.length > 0 ? rechargeTransactions.map(tr => (
                     <div key={tr.id} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 flex items-center justify-between shadow-bubble">
                       <div className="min-w-0 flex-1">
                         <div className="flex items-center gap-2 flex-wrap">
                           <p className="text-[15px] font-black leading-none text-slate-800">{tr.amount} ৳</p>
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === "approved" ? "bg-emerald-50 text-emerald-600" : tr.status === "pending" ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"}`}>
                             {tr.status === "approved" ? (lang === "bn" ? "অনুমোদিত" : "Approved") :
                              tr.status === "pending" ? (lang === "bn" ? "অপেক্ষমান" : "Pending") :
                              (lang === "bn" ? "প্রত্যাখ্যাত" : "Rejected")}
                           </span>
                           {tr.metadata?.payment_method && (
                             <span className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                               {tr.metadata.payment_method}
                             </span>
                           )}
                         </div>
                         <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Clock size={10} className="text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-400">{new Date(tr.created_at).toLocaleDateString("bn-BD")}</p>
                            {tr.metadata?.balance_after !== undefined && (
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {lang === "bn" ? `ব্যালেন্স: ${tr.metadata.balance_after} ৳` : `Bal: ${tr.metadata.balance_after} ৳`}
                              </span>
                            )}
                         </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter opacity-70">TrxID: {tr.transaction_id}</p>
                          {tr.sender_phone && tr.sender_phone !== "Admin" && tr.sender_phone !== "SYSTEM" ? (
                            <p className="text-[8px] font-bold text-slate-400 mt-0.5">{tr.sender_phone}</p>
                          ) : null}
                        </div>
                      </div>
                    )) : (
                     <div className="text-center py-10 rounded-[2.5rem] border border-dashed bg-slate-50 border-slate-200">
                        <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{lang === 'bn' ? 'কোনো রিচার্জ রেকর্ড নেই' : 'No recharge records'}</p>
                     </div>
                   );
                 })()}
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
                  {Number(retryModal.phoneNumbers.length * voiceRate * getPulsesForVoice(retryModal.voiceId)).toFixed(2)} ৳
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={executeRetry}
                disabled={IS_VOICE_BROADCAST_DISABLED || isRetrying}
                className={`w-full py-5 font-black rounded-full shadow-xl transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3 ${
                  IS_VOICE_BROADCAST_DISABLED
                    ? 'bg-slate-400 text-white cursor-not-allowed opacity-70'
                    : 'bg-[#2563EB] text-white shadow-blue-100 active:scale-95 disabled:opacity-50'
                }`}
              >
                {isRetrying ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <><Send size={18} /> {IS_VOICE_BROADCAST_DISABLED ? (lang === 'bn' ? 'ব্রডকাস্ট অফ আছে' : 'Broadcast Disabled') : (lang === 'bn' ? 'Retry কল শুরু করুন' : 'Start Retry')}</>
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

      {assignModalVoice && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 shadow-bubble border border-slate-100 space-y-6 animate-in zoom-in-95 duration-300 relative">
            <button 
              onClick={() => { setAssignModalVoice(null); setSelectedBranchIds([]); }} 
              className="absolute top-6 right-6 w-9 h-9 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 font-noto">
                  {lang === 'bn' ? 'শাখা একাউন্টে ভয়েস বার্তা এসাইন' : 'Assign Voice to Branch'}
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5 font-noto">
                  {assignModalVoice.title}
                </p>
              </div>
            </div>

            {assignVoiceSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <span>{assignVoiceSuccess}</span>
              </div>
            ) : null}

            {assignVoiceError ? (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                <span>{assignVoiceError}</span>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-noto">
                  {isSuperAdmin 
                    ? (lang === 'bn' ? 'প্রতিষ্ঠান নির্বাচন করুন' : 'Select Target Institution') 
                    : (lang === 'bn' ? 'শাখা নির্বাচন করুন' : 'Select Target Branches')}
                </label>
                {!isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBranchIds.length === childBranches.length) {
                        setSelectedBranchIds([]);
                      } else {
                        setSelectedBranchIds(childBranches.map(b => b.id));
                      }
                    }}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 cursor-pointer font-noto"
                  >
                    {selectedBranchIds.length === childBranches.length ? (lang === 'bn' ? 'সব আনসেলেক্ট করুন' : 'Deselect All') : (lang === 'bn' ? 'সবগুলো সিলেক্ট করুন' : 'Select All')}
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {(isSuperAdmin ? allInstitutions : childBranches).map(inst => {
                  const isChecked = selectedBranchIds.includes(inst.id);
                  return (
                    <div
                      key={inst.id}
                      onClick={() => {
                        if (isSuperAdmin) {
                          setSelectedBranchIds([inst.id]);
                        } else {
                          if (isChecked) {
                            setSelectedBranchIds(selectedBranchIds.filter(id => id !== inst.id));
                          } else {
                            setSelectedBranchIds([...selectedBranchIds, inst.id]);
                          }
                        }
                      }}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked ? 'bg-purple-50/70 border-purple-300 text-purple-900 shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'}`}>
                          {isChecked && <Check size={14} strokeWidth={3} />}
                        </div>
                        <div>
                          <p className="text-xs font-black font-noto">{inst.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">{inst.phone || inst.address || 'প্রতিষ্ঠান'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-noto">
                        {isSuperAdmin ? (lang === 'bn' ? 'প্রতিষ্ঠান' : 'Portal') : (lang === 'bn' ? 'শাখা' : 'Branch')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setAssignModalVoice(null); setSelectedBranchIds([]); }}
                className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleAssignVoiceToBranches}
                disabled={assigningVoiceModal || selectedBranchIds.length === 0}
                className="w-2/3 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs shadow-lg shadow-purple-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {assigningVoiceModal ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                <span>{lang === 'bn' ? `এসাইন করুন (${selectedBranchIds.length})` : `Assign (${selectedBranchIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showUploadModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/50 backdrop-blur-md animate-in fade-in duration-300 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 duration-300 relative">
            <button 
              onClick={() => {
                if (isRecording) stopRecording();
                setShowUploadModal(false);
              }} 
              className="absolute top-6 right-6 w-9 h-9 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center border border-blue-100">
                <Mic size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#1E3A8A] font-noto">
                  {lang === 'bn' ? 'নতুন ভয়েস বার্তা যোগ করুন' : 'Add New Voice Message'}
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5 font-noto">
                  {isSuperAdmin 
                    ? (lang === 'bn' ? 'সরাসরি আপলোড ও অনুমোদন' : 'Direct upload and approval') 
                    : (lang === 'bn' ? 'আপলোডকৃত ভয়েসটি সুপার এডমিন অনুমোদনের পর ব্যবহৃত হবে' : 'Uploaded voice will be pending Super Admin approval')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1.5 block font-noto">
                  {lang === 'bn' ? 'ভয়েস এর শিরোনাম / বিষয় *' : 'Voice Title / Subject *'}
                </label>
                <input 
                  type="text" 
                  placeholder={lang === 'bn' ? 'যেমন: ফি জমার তাগাদা বার্তা' : 'e.g. Fee Due Notice Voice'}
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full h-13 px-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-noto"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1 block font-noto">
                  {lang === 'bn' ? 'অডিও ইনপুট বা সরাসরি রেকর্ড করুন *' : 'Audio Input or Live Record *'}
                </label>

                {/* Sleek Recording & Upload Zone Card */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 p-5 rounded-[2rem] border-2 border-dashed border-blue-200/80 text-center space-y-4 shadow-xs">
                  <div className="flex items-center justify-center gap-3">
                    {!isRecording ? (
                      <button 
                        type="button" 
                        onClick={startRecording}
                        className="px-6 py-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-2.5 active:scale-95 transition-all shadow-md shadow-red-200 cursor-pointer font-noto"
                      >
                        <Mic size={18} className="animate-pulse" />
                        <span>{lang === 'bn' ? 'মাইক্রোফোনে রেকর্ড শুরু করুন' : 'Start Live Recording'}</span>
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={stopRecording}
                        className="px-6 py-3.5 rounded-full bg-red-700 hover:bg-red-800 text-white font-black text-xs flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer animate-pulse font-noto shadow-lg shadow-red-300"
                      >
                        <Square size={16} />
                        <span>{lang === 'bn' ? `রেকর্ডিং থামান (${Math.floor(recordingTime / 60)}:${('0' + (recordingTime % 60)).slice(-2)})` : `Stop Recording (${recordingTime}s)`}</span>
                      </button>
                    )}
                  </div>

                  {!uploadFile && (
                    <>
                      <div className="relative flex items-center justify-center my-2">
                        <div className="border-t border-slate-200 w-full" />
                        <span className="bg-slate-50 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest absolute font-noto">
                          {lang === 'bn' ? 'অথবা অডিও ফাইল আপলোড করুন' : 'OR Upload Audio File'}
                        </span>
                      </div>

                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white border-2 border-blue-100 hover:border-blue-400 text-slate-700 font-bold text-xs shadow-sm transition-all w-full font-noto group">
                        <Upload size={18} className="text-[#2563EB] group-hover:scale-110 transition-transform" />
                        <span>{lang === 'bn' ? 'কম্পিউটার/মোবাইল থেকে বাছুন (MP3, WAV, M4A, OGG)' : 'Choose Audio File (MP3, WAV, M4A, OGG)'}</span>
                        <input 
                          type="file" 
                          accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setUploadFile(e.target.files[0]);
                            }
                          }} 
                        />
                      </label>
                    </>
                  )}

                  {/* Recorded / Selected Audio Live Preview Player */}
                  {uploadFile && (
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/80 rounded-3xl border-2 border-blue-300/80 space-y-3 shadow-sm text-left animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-9 h-9 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-md">
                            <Mic size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate font-noto">{uploadFile.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 font-noto">
                              {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • {recordingTime > 0 ? `${recordingTime}s Recorded` : 'Audio File Loaded'}
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { setUploadFile(null); setPreviewAudioPlaying(false); }} 
                          className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                          title="বাতিল করুন"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Audio Player & Speed Controller */}
                      {previewObjectUrl && (
                        <div className="bg-white p-3.5 rounded-2xl border border-blue-100/90 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (previewAudioRef.current) {
                                  if (previewAudioPlaying) {
                                    previewAudioRef.current.pause();
                                    setPreviewAudioPlaying(false);
                                  } else {
                                    previewAudioRef.current.playbackRate = previewSpeed;
                                    previewAudioRef.current.play();
                                    setPreviewAudioPlaying(true);
                                  }
                                }
                              }}
                              className="w-10 h-10 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
                            >
                              {previewAudioPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                            </button>

                            {/* Simulated Waveform Visualizer */}
                            <div className="flex-1 flex items-center gap-1 h-6 px-2 overflow-hidden">
                              {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 65, 85, 40, 90, 50].map((h, i) => (
                                <div 
                                  key={i} 
                                  className={`flex-1 rounded-full transition-all duration-300 ${previewAudioPlaying ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`}
                                  style={{ height: previewAudioPlaying ? `${h}%` : '25%' }}
                                />
                              ))}
                            </div>

                            <audio 
                              ref={previewAudioRef}
                              src={previewObjectUrl}
                              onEnded={() => setPreviewAudioPlaying(false)}
                              onPause={() => setPreviewAudioPlaying(false)}
                              onPlay={() => setPreviewAudioPlaying(true)}
                              className="hidden"
                            />
                          </div>

                          {/* Speed Adjustment Badges & Duration Summary */}
                          <div className="space-y-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-noto flex items-center gap-1">
                                <Zap size={12} className="text-amber-500" />
                                <span>প্লেব্যাক গতি (Speed):</span>
                              </span>

                              <div className="flex items-center gap-1">
                                {[0.75, 1.0, 1.25, 1.5, 2.0].map(speedVal => (
                                  <button
                                    key={speedVal}
                                    type="button"
                                    onClick={() => {
                                      setPreviewSpeed(speedVal);
                                      if (previewAudioRef.current) {
                                        previewAudioRef.current.playbackRate = speedVal;
                                      }
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer font-noto ${
                                      previewSpeed === speedVal 
                                        ? 'bg-[#1E3A8A] text-white shadow-xs' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {speedVal}x
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Live Duration Summary Cards */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-blue-50/90 p-2.5 rounded-2xl border border-blue-100 text-center space-y-0.5">
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider block font-noto">
                                  মূল সময়
                                </span>
                                <span className="text-xs font-black text-[#1E3A8A] font-noto">
                                  {originalDuration} সেকেন্ড
                                </span>
                              </div>
                              <div className="bg-amber-50/90 p-2.5 rounded-2xl border border-amber-200/80 text-center space-y-0.5">
                                <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block font-noto">
                                  গতি পরিবর্তনের পর
                                </span>
                                <span className="text-xs font-black text-amber-900 font-noto">
                                  {effectiveDuration} সেকেন্ড
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isRecording) stopRecording();
                  setShowUploadModal(false);
                }}
                className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs transition-all cursor-pointer font-noto"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleVoiceUpload}
                disabled={isUploading || !uploadName.trim() || !uploadFile}
                className="w-2/3 py-3.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all cursor-pointer font-noto"
              >
                {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                <span>{lang === 'bn' ? 'জমা দিন' : 'Upload Voice'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {editingVoice && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-md animate-in fade-in duration-300 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-bubble border border-slate-100 space-y-5 animate-in zoom-in-95 duration-300 relative">
            <button 
              onClick={() => setEditingVoice(null)} 
              className="absolute top-6 right-6 w-9 h-9 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center border border-blue-100">
                <Edit2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 font-noto">
                  {lang === 'bn' ? 'ভয়েস বার্তার নাম পরিবর্তন' : 'Edit Voice Title'}
                </h3>
                <p className="text-xs font-bold text-slate-400 font-noto">
                  {lang === 'bn' ? 'নতুন শিরোনাম দিয়ে সেভ করুন' : 'Enter new title and save'}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1.5 block font-noto">
                {lang === 'bn' ? 'ভয়েস এর শিরোনাম / নাম' : 'Voice Title'}
              </label>
              <input 
                type="text" 
                value={editingVoice.title}
                onChange={(e) => setEditingVoice({ ...editingVoice, title: e.target.value })}
                className="w-full h-12 px-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-noto"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingVoice(null)}
                className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs transition-all cursor-pointer font-noto"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleUpdateVoiceTitle}
                disabled={isUpdatingTitle || !editingVoice.title.trim()}
                className="w-2/3 py-3 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all cursor-pointer font-noto"
              >
                {isUpdatingTitle ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                <span>{lang === 'bn' ? 'সেভ করুন' : 'Save Title'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default VoiceBroadcast;
