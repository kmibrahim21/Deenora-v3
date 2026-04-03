import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mic, 
  Upload, 
  CreditCard, 
  Play, 
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
  RefreshCw
} from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language, Class, Student, Profile, UserRole } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';
import { normalizePhone } from 'utils/smsUtils';

interface VoiceBroadcastProps {
  lang: Language;
  madrasah: Institution | null;
  triggerRefresh: () => void;
  dataVersion: number;
  isEmbedded?: boolean;
  role: UserRole;
  profile?: Profile | null;
  onBack: () => void;
}

const VoiceBroadcast: React.FC<VoiceBroadcastProps> = ({ lang, madrasah, triggerRefresh, dataVersion, isEmbedded = false, role, profile, onBack }) => {
  const isTeacher = role === 'teacher';
  const canUseVoice = !isTeacher || profile?.permissions?.can_use_voice_call;

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

  // Broadcast state
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // History state
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyDetails, setHistoryDetails] = useState<any | null>(null);
  const [studentNamesMap, setStudentNamesMap] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Upload state
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Recharge state
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [rechargePhone, setRechargePhone] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');
  const [voiceRate, setVoiceRate] = useState(1.00);

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
    if (!madrasah) return;
    fetchWalletBalance();
    if (activeTab === 'templates') fetchVoices();
    if (activeTab === 'broadcast') { fetchClasses(); fetchVoices(); fetchSenders(); }
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'recharge') fetchSystemSettings();
  }, [activeTab, madrasah?.id, dataVersion]);

  const fetchSystemSettings = async () => {
    const { data } = await supabase.from('system_settings').select('bkash_number, voice_rate').single();
    if (data?.bkash_number) setAdminBkash(data.bkash_number);
    if (data?.voice_rate) setVoiceRate(data.voice_rate);
  };

  const fetchWalletBalance = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('institutions').select('balance').eq('id', madrasah.id).single();
    if (data) setWalletBalance(data.balance);
  };

  const fetchVoices = async () => {
    if (!madrasah) return;
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
      const { data: localVoices } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });
      
      if (localVoices) {
        // Sync statuses and IDs from Awaj API
        const syncedVoices = [];
        for (const localVoice of localVoices) {
          // Try to find matching voice in API by ID or Name
          const awajVoice = apiVoices.find(v => 
            (localVoice.provider_voice_id && v.id && v.id.toString() === localVoice.provider_voice_id.toString()) || 
            (v.name && v.name.toLowerCase() === localVoice.title.toLowerCase())
          );

          if (awajVoice) {
            const newStatus = awajVoice.status || 'approved';
            const newProviderId = awajVoice.id ? awajVoice.id.toString() : localVoice.provider_voice_id;
            const newProviderName = awajVoice.name || localVoice.provider_voice_name;
            
            if (localVoice.provider_status !== newStatus || localVoice.provider_voice_id !== newProviderId || localVoice.provider_voice_name !== newProviderName) {
              await supabase.from('voice_templates').update({ 
                provider_status: newStatus,
                provider_voice_id: newProviderId,
                provider_voice_name: newProviderName
              }).eq('id', localVoice.id);
              
              localVoice.provider_status = newStatus;
              localVoice.provider_voice_id = newProviderId;
              localVoice.provider_voice_name = newProviderName;
            }
          }
          syncedVoices.push(localVoice);
        }
        setVoices(syncedVoices);
      }

    } catch (error) {
      console.error('Error fetching voices:', error);
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
        sendersList = Array.isArray(data) ? data : (data.senders || data.data || []);
        console.log('Awaj Senders List:', sendersList);
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
    } catch (error) {
      console.error('Error fetching senders:', error);
    }
  };

  useEffect(() => {
    if (madrasah) {
      fetchSenders();
    }
  }, [madrasah]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchHistory = async () => {
    if (!madrasah) return;
    setLoading(true);
    const { data } = await supabase.from('voice_broadcasts').select('*, voice_templates(title)').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setBroadcastHistory(data);
    
    // Track results for pending/sending broadcasts
    if (data) {
      data.filter(b => b.status === 'sending' || b.status === 'pending').forEach(async (broadcast) => {
        if (!broadcast.provider_campaign_id) return;
        try {
          const response = await fetch(`/api/awaj/broadcast/${broadcast.provider_campaign_id}`);
          if (response.ok) {
            const result = await response.json();
            // Map Awaj status to our internal status
            let newStatus = broadcast.status; // Default to current status if unknown
            const providerStatus = (result.broadcast?.status || result.status || result.state || '').toLowerCase();
            
            if (['pending', 'queued', 'scheduled'].includes(providerStatus)) {
              newStatus = 'pending';
            } else if (['sending', 'processing', 'running'].includes(providerStatus)) {
              newStatus = 'sending';
            } else if (['failed', 'error', 'cancelled'].includes(providerStatus)) {
              newStatus = 'failed';
            } else if (['completed', 'done', 'success'].includes(providerStatus)) {
              newStatus = 'completed';
            }

            if (newStatus !== broadcast.status) {
              await supabase.from('voice_broadcasts').update({ status: newStatus }).eq('id', broadcast.id);
              // Refresh history
              const { data: updatedData } = await supabase.from('voice_broadcasts').select('*, voice_templates(title)').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
              if (updatedData) setBroadcastHistory(updatedData);
            }
          }
        } catch (error) {
          console.error('Error tracking broadcast result:', error);
        }
      });
    }
    setLoading(false);
  };

  const handleRetryFailed = async (broadcast: any, failedLogs: any[]) => {
    if (!failedLogs.length) return;
    
    // Extract phone numbers from failed logs
    const phoneNumbers = failedLogs.map(log => log.phone || log.number || log.to || log.msisdn).filter(Boolean);
    
    if (!phoneNumbers.length) {
      setStatusModal({ show: true, title: 'Error', type: 'error', message: 'No valid phone numbers found to retry.' });
      return;
    }

    if (!confirm(`Are you sure you want to retry ${phoneNumbers.length} failed calls? This will deduct from your balance.`)) {
      return;
    }

    try {
      // Get voice and sender IDs from the original broadcast
      const voiceId = broadcast.voice_id;
      const senderId = broadcast.sender_id;
      
      if (!voiceId || !senderId) {
        setStatusModal({ show: true, title: 'Error', type: 'error', message: 'Original voice or sender information is missing.' });
        return;
      }

      // Find the actual voice name and sender number from the state
      const voice = voices.find(v => v.id === voiceId);
      const sender = senders.find(s => s.id === senderId);

      if (!voice || !sender) {
        setStatusModal({ show: true, title: 'Error', type: 'error', message: 'Voice template or sender is no longer available.' });
        return;
      }

      const voiceName = voice.name || voice.voice_name || voice.id;
      const sNumber = sender.number || sender.sender_id || sender.id;

      // Calculate cost
      const estimatedCost = phoneNumbers.length * 0.5; // Assuming 0.5 per call

      if (walletBalance < estimatedCost) {
        setStatusModal({
          show: true,
          type: 'balance',
          title: lang === 'bn' ? 'অপর্যাপ্ত ব্যালেন্স' : 'Insufficient Balance',
          message: lang === 'bn' ? `রিচার্জ প্রয়োজন: ${estimatedCost} ৳` : `Recharge needed: ${estimatedCost} ৳`
        });
        return;
      }

      const requestId = 'retry_' + Math.random().toString(36).substr(2, 9);
      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: phoneNumbers,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to send retry broadcast via Awaj API');
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // Save to Supabase
      const { error } = await supabase.from('voice_broadcasts').insert({
        institution_id: madrasah?.id,
        voice_id: voiceId,
        sender_id: senderId,
        target_type: 'retry',
        target_id: broadcast.id, // Link to original broadcast
        total_numbers: phoneNumbers.length,
        estimated_cost: estimatedCost,
        status: 'sending',
        provider_campaign_id: campaignId
      });

      if (error) throw error;

      // Deduct balance
      const newBalance = walletBalance - estimatedCost;
      const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', madrasah?.id);
      
      if (balanceError) {
        console.error('Failed to deduct balance:', balanceError);
      } else {
        setWalletBalance(newBalance);
      }

      setStatusModal({ show: true, title: 'Success', type: 'success', message: `Successfully initiated retry for ${phoneNumbers.length} calls.` });
      fetchHistory();
      
    } catch (err: any) {
      console.error('Error retrying broadcast:', err);
      setStatusModal({ show: true, title: 'Error', type: 'error', message: err.message || 'Failed to retry broadcast' });
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
      const response = await fetch(`/api/awaj/broadcast/${broadcast.provider_campaign_id}`);
      if (response.ok) {
        try {
          const result = await response.json();
          console.log('Broadcast Details API Response:', result);
          setHistoryDetails(result);
          
          // Fetch student names to map phone numbers
          if (madrasah?.id) {
            const { data: students } = await supabase
              .from('students')
              .select('student_name, roll, guardian_phone, guardian_phone_2')
              .eq('institution_id', madrasah.id);
              
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
              setStudentNamesMap(newMap as any);
            }
          }
        } catch (parseErr) {
          console.error('Error parsing broadcast details JSON:', parseErr);
          setHistoryDetails({ error: 'Invalid response format from server' });
        }
      } else {
        let errorMsg = 'Failed to load details';
        try {
          const errData = await response.json();
          errorMsg = errData.error || errData.message || errorMsg;
        } catch (e) {
          // Ignore
        }
        setHistoryDetails({ error: errorMsg });
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

  const handleBroadcast = async () => {
    if (!madrasah || !selectedVoiceId || !selectedClassId || !selectedSenderId) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Info',
        message: lang === 'bn' ? 'অনুগ্রহ করে ভয়েস, সেন্ডার আইডি এবং ক্লাস নির্বাচন করুন।' : 'Please select a voice, sender ID, and class.'
      });
      return;
    }
    
    // Get student count for selected class
    const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', selectedClassId);
    if (!count || count === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ছাত্রছাত্রী পাওয়া যায়নি' : 'No Students',
        message: lang === 'bn' ? 'এই ক্লাসে কোনো ছাত্রছাত্রী পাওয়া যায়নি।' : 'No students found in this class.'
      });
      return;
    }

    const estimatedCost = count * voiceRate;

    if (walletBalance < estimatedCost) {
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
      // Get the actual students to get their phone numbers
      const { data: students, error: studentError } = await supabase.from('students').select('guardian_phone, guardian_phone_2').eq('class_id', selectedClassId);
      
      if (studentError) {
        throw new Error('Error fetching students: ' + studentError.message);
      }

      if (!students || students.length === 0) {
        throw new Error('No students found for this class.');
      }

      // Collect primary phone numbers - use 11 digits (01...) for Awaj API
      const phoneNumbers = students
        .map(s => {
          const phone = s.guardian_phone || s.guardian_phone_2;
          if (!phone) return '';
          const digits = phone.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        })
        .filter(p => p && p.length === 11 && p.startsWith('01'));
      
      if (phoneNumbers.length === 0) {
        throw new Error('No valid 11-digit phone numbers (01...) found for the selected class.');
      }

      // Get the selected template to get the awaj_voice_id
      const voice = voices.find(v => v.id === selectedVoiceId);
      if (!voice) throw new Error('Selected voice not found.');

      if (!voice.provider_voice_id) {
        throw new Error('This voice is not yet linked to Awaj Digital. Please try refreshing the page.');
      }

      if (voice.provider_status !== 'approved' && voice.status !== 'approved') {
        throw new Error('This voice is not yet approved by Awaj Digital.');
      }

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
      
      // Documentation says 'voice' must be the Name of your approved voice
      // We prefer provider_voice_name (synced from API) over local title
      const voiceName = voice.provider_voice_name || voice.title;

      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: phoneNumbers,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      console.log('Sending broadcast payload (strictly following docs):', payload);

      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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
      const { error } = await supabase.from('voice_broadcasts').insert({
        institution_id: madrasah.id,
        voice_template_id: selectedVoiceId,
        target_type: 'students',
        total_numbers: phoneNumbers.length,
        estimated_cost: estimatedCost,
        provider_campaign_id: campaignId,
        status: 'sending'
      });

      if (error) throw error;

      // 3. Deduct balance from institution
      const newBalance = walletBalance - estimatedCost;
      const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', madrasah.id);
      
      if (balanceError) throw balanceError;

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ব্রডকাস্ট সফলভাবে শুরু হয়েছে!' : 'Broadcast started successfully!'
      });
      setSelectedClassId('');
      setSelectedVoiceId('');
      fetchWalletBalance();
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
    setIsUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${madrasah.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('voice-templates')
        .upload(`voices/${fileName}`, uploadFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice-templates')
        .getPublicUrl(`voices/${fileName}`);

      const { error: dbError } = await supabase.from('voice_templates').insert({
        institution_id: madrasah.id,
        title: uploadName,
        file_url: publicUrl,
        admin_status: 'draft',
        provider_status: 'draft'
      });

      if (dbError) throw dbError;

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ভয়েস সফলভাবে আপলোড হয়েছে! এখন অনুমোদনের অনুরোধ করতে পারেন।' : 'Voice uploaded successfully! You can now request approval.'
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
        admin_status: 'pending',
        provider_status: 'pending'
      }).eq('id', voiceId);
      
      if (error) throw error;
      
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'অনুমোদনের অনুরোধ সফলভাবে পাঠানো হয়েছে।' : 'Approval requested successfully.'
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

  const handleRecharge = async () => {
    if (!madrasah || !rechargeAmount || !rechargeTrx || !rechargePhone) return;
    setIsRecharging(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: parseInt(rechargeAmount),
        transaction_id: rechargeTrx.trim().toUpperCase(),
        sender_phone: rechargePhone.trim(),
        description: 'Voice Recharge Request',
        type: 'credit',
        status: 'pending',
        module: 'voice'
      });
      if (error) throw error;
      setRequestSuccess(true);
      setRechargeAmount('');
      setRechargeTrx('');
      setRechargePhone('');
      
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'অনুরোধ পাঠানো হয়েছে' : 'Request Sent',
        message: lang === 'bn' ? 'আপনার রিচার্জ অনুরোধটি সফলভাবে পাঠানো হয়েছে। অ্যাডমিন ভেরিফাই করার পর ব্যালেন্স যোগ হবে।' : 'Your recharge request has been sent successfully. Balance will be added after admin verification.'
      });
      
      setTimeout(() => setRequestSuccess(false), 5000);
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
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">{t('step_1_class', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                        <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {classes.map(cls => (
                            <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                              <span className="font-black font-noto">{cls.class_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                          {voices.filter(v => v.admin_status === 'approved' && v.provider_status === 'approved').map(v => (
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
                    disabled={!selectedVoiceId || !selectedClassId || !selectedSenderId || isBroadcasting}
                    className="w-full h-[64px] bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all mt-auto"
                  >
                    {isBroadcasting ? <Loader2 className="animate-spin" size={24} /> : <><Send size={20} /> {t('start_broadcast', lang)}</>}
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
                              <audio controls src={v.file_url} className="h-8 w-32 sm:w-48" />
                            )}
                            <button 
                              onClick={() => setShowDeleteConfirm({ id: v.id, providerId: v.provider_voice_id, fileUrl: v.file_url, title: v.title })}
                              className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={14} />
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
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {h.status}
                          </span>
                          <ChevronDown size={16} className={`text-slate-300 transition-transform ${expandedHistoryId === h.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('target', lang)}</p>
                          <p className="text-xs font-black text-[#1E3A8A] capitalize">{h.target_type}</p>
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
                                return ['failed', 'no answer', 'busy', 'cancelled', 'error'].includes(status);
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
                                    <div className="flex justify-end">
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
                                        let phone = log.phone || log.number || log.to || log.msisdn || log.recipient || log.mobile || log.destination || log.phone_number || log.to_number || log.receiver || log.phone_no || log.mobile_no || log.to_msisdn || log.to_mobile;
                                        
                                        if (!phone) {
                                          // Try to find any property that looks like a phone number
                                          for (const key in log) {
                                            if (typeof log[key] === 'string' && log[key].replace(/[^0-9]/g, '').length >= 10) {
                                              phone = log[key];
                                              break;
                                            }
                                          }
                                        }
                                        
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
                                        else if (['failed', 'no answer', 'busy', 'cancelled'].includes(status)) statusColor = 'text-red-700 bg-red-100';
                                        
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
                                                      {rollNo && <span className="ml-2 text-[10px] text-slate-400 font-bold">(রোল: {rollNo})</span>}
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
          <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-5 duration-500">
             <div className="bg-white p-8 rounded-[3rem] shadow-bubble border border-slate-100 space-y-6">
                <div className="text-center">
                  <div className="inline-flex p-3 bg-emerald-50 rounded-2xl text-emerald-600 mb-3"><CreditCard size={32} /></div>
                  <h3 className="text-xl font-black text-[#1E3A8A]">{t('recharge_request', lang)}</h3>
                  <p className="text-xs font-bold text-slate-400 font-noto">{t('recharge_desc', lang)}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-6 rounded-[2.2rem] text-center border border-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Mic size={60} />
                    </div>
                    <p className="text-[10px] font-black text-[#2563EB] uppercase tracking-[0.2em] mb-1 relative z-10">Voice Rate</p>
                    <h3 className="text-3xl font-black text-[#1E3A8A] relative z-10">{voiceRate} ৳</h3>
                  </div>

                  <div className="bg-emerald-50 p-6 rounded-[2.2rem] text-center border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Smartphone size={60} />
                    </div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1 relative z-10">{t('bkash_personal', lang)}</p>
                    <h3 className="text-3xl font-black text-[#1E3A8A] relative z-10">{adminBkash}</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {requestSuccess && (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 text-emerald-600 text-sm font-black animate-in slide-in-from-top-2">
                       <CheckCircle2 size={20} /> {t('recharge_success_msg', lang)}
                    </div>
                  )}
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('amount', lang)}</label>
                    <input type="number" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-full font-black text-lg" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('bkash_number', lang)}</label>
                    <input type="tel" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-full font-black text-lg" value={rechargePhone} onChange={(e) => setRechargePhone(e.target.value)} placeholder="017XXXXXXXX" />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TrxID</label>
                    <input type="text" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-full font-black text-lg uppercase" value={rechargeTrx} onChange={(e) => setRechargeTrx(e.target.value.toUpperCase())} placeholder="8X23M1..." />
                  </div>
                  <button onClick={handleRecharge} disabled={isRecharging || !rechargeAmount || !rechargeTrx || !rechargePhone} className="w-full h-16 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg mt-4 disabled:opacity-40 active:scale-95 transition-all">
                    {isRecharging ? <Loader2 className="animate-spin" size={24} /> : t('send_request', lang)}
                  </button>
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
                      <Zap size={18} fill="currentColor" /> রিচার্জ করুন
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
    </>
  );
};

export default VoiceBroadcast;
