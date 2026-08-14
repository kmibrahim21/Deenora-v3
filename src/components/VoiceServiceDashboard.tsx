import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, RefreshCw, AlertCircle, Loader2, Mic, Trash2, CheckCircle2, 
  Smartphone, PhoneCall, ChevronRight, X, UploadCloud, FileAudio, Music, 
  Plus, Info, Search, Filter, Globe, Building2, Clock, Check, Copy,
  PhoneForwarded, ShieldCheck, Radio, Sparkles, XCircle, AlertTriangle,
  Play, Pause, Volume2, Wallet
} from 'lucide-react';
import { supabase } from 'supabase';

interface VoiceServiceDashboardProps {
  onBack: () => void;
  madrasah: any;
  setStatusModal: (modal: any) => void;
}

export const VoiceServiceDashboard: React.FC<VoiceServiceDashboardProps> = ({ onBack, madrasah, setStatusModal }) => {
  const isDark = madrasah?.theme === 'dark';

  const [activeTab, setActiveTab] = useState<'voices' | 'assigned_voices'>('voices');
  const [voices, setVoices] = useState<any[]>([]);
  const [assignedVoices, setAssignedVoices] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [voiceBalance, setVoiceBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemResult, setItemResult] = useState<any[] | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [resultFilter, setResultFilter] = useState<'all' | 'answered' | 'failed'>('all');

  const [apiError, setApiError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceStatusFilter, setVoiceStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [assignedVoiceSearchQuery, setAssignedVoiceSearchQuery] = useState('');
  const [broadcastSearchQuery, setBroadcastSearchQuery] = useState('');

  // Upload Voice to Awaj Digital State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assign Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningVoice, setAssigningVoice] = useState<any>(null);
  const [assignInstitutionId, setAssignInstitutionId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [instSearchInAssign, setInstSearchInAssign] = useState('');

  const filteredInstitutionsInAssign = useMemo(() => {
    const searchLower = instSearchInAssign.toLowerCase();
    return institutions.filter(inst => {
      const nameMatch = String(inst.name || '').toLowerCase().includes(searchLower);
      const codeMatch = String(inst.config_json?.institute_code || '').toLowerCase().includes(searchLower);
      return nameMatch || codeMatch;
    });
  }, [institutions, instSearchInAssign]);

  useEffect(() => {
    const fetchInstitutions = async () => {
      const { data } = await supabase
        .from('institutions')
        .select('id, name, config_json')
        .eq('is_super_admin', false)
        .order('name');
      if (data) setInstitutions(data);
    };
    fetchInstitutions();
  }, []);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const allowedExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      setUploadError(`অননুমোদিত অডিও ফরম্যাট। অনুমোদিত ফরম্যাট: ${allowedExtensions.join(', ')}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('ফাইল সাইজ ১০MB এর বেশি হতে পারবে না (Maximum size 10MB)');
      return;
    }

    setUploadFile(file);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }
    const newPreviewUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(newPreviewUrl);

    // Auto-fill voice name if empty
    if (!uploadName.trim()) {
      const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const cleanName = defaultName.replace(/[^\w\u0980-\u09FF\s-]/g, '').trim().substring(0, 100);
      if (cleanName) {
        setUploadName(cleanName);
      }
    }
  };

  const handleUploadVoice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUploadError(null);

    const trimmedName = uploadName.trim();
    if (!trimmedName) {
      setUploadError('ভয়েসের নাম দেওয়া আবশ্যক (1-255 অক্ষরের মধ্যে)');
      return;
    }
    if (trimmedName.length > 255) {
      setUploadError('ভয়েসের নাম ২৫৫ অক্ষরের বেশি হতে পারবে না');
      return;
    }
    if (!uploadFile) {
      setUploadError('অনুগ্রহ করে একটি অডিও ফাইল নির্বাচন করুন');
      return;
    }

    setIsUploading(true);
    try {
      // Build multipart/form-data for Awaj Digital API upload
      // Voice is uploaded directly to Awaj Digital and NOT to Supabase Storage!
      const formData = new FormData();
      formData.append('name', trimmedName);
      formData.append('voice_name', trimmedName);
      formData.append('title', trimmedName);
      formData.append('audio', uploadFile);

      const encodedName = encodeURIComponent(trimmedName);
      const response = await fetch(`/api/voices/upload?name=${encodedName}`, {
        method: 'POST',
        headers: {
          'X-Voice-Name': encodedName
        },
        body: formData
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        let msg = resData.message || resData.error || 'Failed to upload voice to Awaj Digital';
        if (response.status === 409) {
          msg = `"${trimmedName}" নামের ভয়েস ইতিমধ্যে অ্যাকাউন্টে বিদ্যমান। অন্য একটি নাম দিন।`;
        } else if (response.status === 413) {
          msg = 'ফাইল সাইজ ১০MB এর বেশি হতে পারবে না।';
        } else if (response.status === 415) {
          msg = 'অননুমোদিত অডিও ফরম্যাট। অনুমোদিত: mp3, wav, ogg, m4a, aac, webm, flac';
        }
        throw new Error(msg);
      }

      // Success
      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস সফলভাবে আপলোড হয়েছে!',
        message: `ভয়েস "${resData.name || trimmedName}" (ID: ${resData.id || '-'}) সরাসরি Awaj Digital API-তে আপলোড হয়েছে। বর্তমান স্ট্যাটাস: "${resData.status || 'pending'}"। Awaj Digital অ্যাডমিন অনুমোদন করার পর এটি ব্রডকাস্টে ব্যবহার করা যাবে।`
      });

      // Reset
      setShowUploadModal(false);
      setUploadName('');
      setUploadFile(null);
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
        setUploadPreviewUrl(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh voice list
      fetchData();
    } catch (err: any) {
      console.error('Awaj Voice Upload Error:', err);
      setUploadError(err.message || 'ভয়েস আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseUploadModal = () => {
    if (isUploading) return;
    setShowUploadModal(false);
    setUploadError(null);
    setUploadName('');
    setUploadFile(null);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAssignVoice = async () => {
    if (!assigningVoice || !assignInstitutionId) return;
    setIsAssigning(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'assign_voice',
          institution_id: assignInstitutionId,
          voice_id: assigningVoice.id,
          voice_name: assigningVoice.name,
          preview_url: assigningVoice.previewUrl || assigningVoice.preview_url || assigningVoice.file_url
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to assign voice via API');
      }

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস নির্ধারিত হয়েছে',
        message: assignInstitutionId === 'system' ? 'ভয়েসটি গ্লোবাল সিস্টেম ভয়েস হিসেবে সংরক্ষিত হয়েছে!' : 'প্রতিষ্ঠানকে ভয়েস সফলভাবে বরাদ্দ করা হয়েছে!'
      });
      setShowAssignModal(false);
      setAssigningVoice(null);
      setAssignInstitutionId('');
      fetchData();
    } catch (error: any) {
      console.error("Assign error:", error);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: error.message || "Failed to assign voice" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignVoice = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই ভয়েস অ্যাসাইনমেন্ট বাতিল করতে চান?')) return;
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'unassign_voice',
          id: id
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to unassign voice via API');
      }
      
      setStatusModal({
        show: true,
        type: 'success',
        title: 'অ্যাসাইনমেন্ট বাতিল',
        message: 'ভয়েস সফলভাবে আন-অ্যাসাইন করা হয়েছে!'
      });
      fetchData();
    } catch (error: any) {
      console.error("Unassign error:", error);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: error.message || "Failed to unassign voice" });
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই ভয়েসটি মুছে ফেলতে চান?')) return;
    try {
      // 1. Try deleting from Awaj Digital API
      try {
        const response = await fetch(`/api/awaj/voices/${voiceId}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.warn('Awaj API delete response not ok:', data);
        }
      } catch (awajErr) {
        console.warn('Error connecting to Awaj API for deletion:', awajErr);
      }
      
      // 2. Delete local voice assignments/templates in database
      try {
        const token = await getAuthToken();
        await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'delete_voice_assignments',
            voice_id: voiceId
          })
        });
      } catch (dbErr) {
        console.warn('Error deleting local voice assignments:', dbErr);
      }

      // 3. Optimistically remove from state
      setVoices(prev => prev.filter(v => String(v.id) !== String(voiceId)));
      setAssignedVoices(prev => prev.filter(v => String(v.provider_voice_id) !== String(voiceId) && String(v.id) !== String(voiceId)));

      setStatusModal({
        show: true,
        type: 'success',
        title: 'মুছে ফেলা হয়েছে',
        message: 'ভয়েসটি সফলভাবে মুছে ফেলা হয়েছে!'
      });
      fetchData();
    } catch (error: any) {
      console.error("Delete error:", error);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: error.message || "Failed to delete voice" });
    }
  };

  const fetchData = async (retryCount = 0) => {
    if (retryCount === 0) setRefreshing(true);
    setApiError(null);
    try {
      const fetchJson = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            const text = await res.text();
            let errorMsg = res.statusText;
            try {
              const json = JSON.parse(text);
              errorMsg = json.error || json.message || errorMsg;
            } catch (e) {}
            throw new Error(`API Error (${res.status}): ${errorMsg}`);
          }
          return res.json();
        } catch (e: any) {
          if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            throw new Error('Failed to connect to API. Please check if the server is running.');
          }
          throw e;
        }
      };

      const [voicesRes, sendersRes, balanceRes] = await Promise.all([
        fetchJson('/api/awaj/voices'),
        fetchJson('/api/awaj/senders'),
        fetchJson('/api/awaj/balance').catch(() => fetchJson('/api/balance')).catch(err => {
          console.warn('Failed to fetch balance:', err);
          return null;
        })
      ]);

      if (voicesRes.error || sendersRes.error) {
        setApiError(voicesRes.error || sendersRes.error);
      }

      if (balanceRes) {
        const rawBal = balanceRes.balance !== undefined ? balanceRes.balance : balanceRes.data?.balance;
        if (rawBal !== undefined && rawBal !== null) {
          const balVal = Number(rawBal);
          setVoiceBalance(isNaN(balVal) ? 0 : balVal);
        }
      }

      const rawApiVoices = voicesRes.voices || voicesRes.data || [];
      const apiVoices = Array.isArray(rawApiVoices)
        ? [...rawApiVoices]
            .sort((a: any, b: any) => {
              const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
              const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
              if (dateA !== dateB) return dateB - dateA;
              return Number(b.id || 0) - Number(a.id || 0);
            })
            .slice(0, 20)
        : [];
      setVoices(apiVoices);
      setSenders(sendersRes.senders || sendersRes.data || []);

      // Fetch broadcasts from Supabase
      const { data: broadcastsData, error: broadcastsError } = await supabase
        .from('voice_broadcasts')
        .select(`
          *,
          institutions (name),
          voice_templates (title)
        `)
        .order('created_at', { ascending: false });

      if (!broadcastsError && broadcastsData) {
        setBroadcasts(broadcastsData);
      }

      // Fetch assigned/system voices from Supabase
      const { data: assignedData, error: assignedError } = await supabase
        .from('voice_templates')
        .select(`
          *,
          institutions (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (!assignedError && assignedData) {
        setAssignedVoices(assignedData);
      }

      // Sync pending voices in Supabase
      if (apiVoices.length > 0) {
        const { data: pendingLocalVoices } = await supabase
          .from('voice_templates')
          .select('id, provider_voice_id, provider_status')
          .eq('provider_status', 'pending')
          .not('provider_voice_id', 'is', null);

        if (pendingLocalVoices && pendingLocalVoices.length > 0) {
          for (const localVoice of pendingLocalVoices) {
            const awajVoice = apiVoices.find((v: any) => v.id?.toString() === localVoice.provider_voice_id);
            if (awajVoice && awajVoice.status && awajVoice.status !== 'pending') {
              await supabase.from('voice_templates').update({ provider_status: awajVoice.status }).eq('id', localVoice.id);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching Awaj data:", error);
      if (retryCount < 2 && (error.message.includes('Failed to connect') || error.message.includes('Failed to fetch'))) {
        console.log(`Retrying fetch... (${retryCount + 1})`);
        setTimeout(() => fetchData(retryCount + 1), 2000);
        return;
      }
      setApiError(error.message || "Failed to fetch Awaj data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchBroadcastResult = async (id: string) => {
    setLoadingResult(true);
    try {
      const res = await fetch(`/api/awaj/broadcast-result?id=${id}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setItemResult(data);
      } else {
        setItemResult(data.results || data.data || []);
      }
    } catch (error) {
      console.error("Error fetching broadcast result:", error);
    } finally {
      setLoadingResult(false);
    }
  };

  // Stats Calculations
  const { approvedVoicesCount, pendingVoicesCount, totalBroadcastsCount, totalNumbersSent, totalSuccessfulCalls, totalCost } = useMemo(() => {
    let approved = 0;
    let pending = 0;
    for (let i = 0; i < voices.length; i++) {
      if (voices[i].status === 'approved') approved++;
      else if (voices[i].status === 'pending') pending++;
    }
    let numbersSent = 0;
    let successfulCalls = 0;
    let cost = 0;
    for (let i = 0; i < broadcasts.length; i++) {
      const b = broadcasts[i];
      numbersSent += (Number(b.total_numbers) || 0);
      successfulCalls += (Number(b.success_count) || 0);
      cost += (Number(b.estimated_cost) || 0);
    }
    return {
      approvedVoicesCount: approved,
      pendingVoicesCount: pending,
      totalBroadcastsCount: broadcasts.length,
      totalNumbersSent: numbersSent,
      totalSuccessfulCalls: successfulCalls,
      totalCost: cost
    };
  }, [voices, broadcasts]);

  // Filtered voice list
  const filteredVoices = useMemo(() => {
    const queryLower = voiceSearchQuery.toLowerCase();
    return voices.filter(v => {
      const matchesSearch = String(v.name || '').toLowerCase().includes(queryLower);
      const matchesStatus = voiceStatusFilter === 'all' || v.status === voiceStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [voices, voiceSearchQuery, voiceStatusFilter]);

  const filteredAssignedVoices = useMemo(() => {
    const q = assignedVoiceSearchQuery.toLowerCase();
    return assignedVoices.filter(v => {
      const titleMatch = String(v.title || '').toLowerCase().includes(q);
      const instMatch = String(v.institutions?.name || '').toLowerCase().includes(q);
      return titleMatch || instMatch;
    });
  }, [assignedVoices, assignedVoiceSearchQuery]);

  const filteredBroadcasts = useMemo(() => {
    const q = broadcastSearchQuery.toLowerCase();
    return broadcasts.filter(b => {
      const voiceMatch = String(b.voice_templates?.title || '').toLowerCase().includes(q);
      const instMatch = String(b.institutions?.name || '').toLowerCase().includes(q);
      const campaignMatch = String(b.provider_campaign_id || '').toLowerCase().includes(q);
      return voiceMatch || instMatch || campaignMatch;
    });
  }, [broadcasts, broadcastSearchQuery]);

  const filteredResults = useMemo(() => {
    if (!itemResult) return [];
    return itemResult.filter(item => {
      if (resultFilter === 'all') return true;
      if (resultFilter === 'answered') return item.status === 'answered' || item.status === 'success';
      if (resultFilter === 'failed') return item.status !== 'answered' && item.status !== 'success';
      return true;
    });
  }, [itemResult, resultFilter]);

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className={`p-4 sm:p-6 rounded-[2rem] border transition-all ${
        isDark 
          ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md shadow-xl' 
          : 'bg-white border-slate-200/80 shadow-sm backdrop-blur-md'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button 
              onClick={onBack} 
              id="voice-dashboard-back-btn"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                isDark 
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
              title="পিছনে ফিরে যান"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                  <Radio size={12} className="animate-pulse" /> Awaj Digital Gateway
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck size={12} /> Super Admin Level
                </span>
              </div>
              <h1 className={`text-xl sm:text-2xl font-black font-noto tracking-tight mt-1 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Voice Service Dashboard
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
            {/* Balance Badge */}
            <div className={`h-11 px-3.5 rounded-2xl flex items-center gap-2 border font-mono text-xs font-black shrink-0 ${
              isDark ? 'bg-slate-800/90 border-slate-700 text-emerald-400' : 'bg-emerald-50/80 border-emerald-200 text-emerald-700'
            }`}>
              <Wallet size={16} className="text-emerald-500" />
              <span>৳{voiceBalance !== null ? voiceBalance.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
            </div>

            <button
              onClick={() => {
                setUploadError(null);
                setShowUploadModal(true);
              }}
              id="voice-dashboard-upload-btn"
              className="flex-1 sm:flex-none h-11 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
            >
              <UploadCloud size={18} />
              <span>Awaj-এ আপলোড</span>
            </button>
            <button 
              onClick={() => fetchData()} 
              disabled={refreshing}
              id="voice-dashboard-refresh-btn"
              className={`h-11 w-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all border shrink-0 ${
                isDark 
                  ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' 
                  : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
              }`}
              title="রিফ্রেশ করুন"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* KPI 1: Awaj Voice Balance */}
        <div className={`p-2.5 sm:p-5 rounded-2xl sm:rounded-[1.75rem] border relative overflow-hidden transition-all ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900 to-emerald-950/30 border-slate-800' 
            : 'bg-gradient-to-br from-white to-emerald-50/50 border-emerald-200/60 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-1.5 sm:mb-3">
            <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <span className="hidden xs:inline-block text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono border border-emerald-500/20">
              Awaj
            </span>
          </div>
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 truncate">Balance</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <h3 className={`text-sm sm:text-2xl font-black font-mono truncate ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              ৳{voiceBalance !== null ? voiceBalance.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
            </h3>
          </div>
          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-1 truncate hidden sm:block">
            {voiceBalance !== null && voiceBalance > 0 ? '✓ Available' : '⚠️ Low balance'}
          </p>
        </div>

        {/* KPI 2: Awaj Voices */}
        <div className={`p-2.5 sm:p-5 rounded-2xl sm:rounded-[1.75rem] border relative overflow-hidden transition-all ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900 to-slate-900/60 border-slate-800' 
            : 'bg-gradient-to-br from-white to-blue-50/40 border-slate-200/80 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-1.5 sm:mb-3">
            <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-600'
            }`}>
              <Mic className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <span className="hidden xs:inline-block text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-mono">
              API
            </span>
          </div>
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 truncate">Total Voices</p>
          <div className="flex items-baseline gap-1 sm:gap-2 mt-0.5">
            <h3 className={`text-sm sm:text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {voices.length}
            </h3>
            <span className="text-[8px] sm:text-[10px] font-bold text-emerald-500 truncate">
              {approvedVoicesCount} ok
            </span>
          </div>
          {pendingVoicesCount > 0 && (
            <p className="text-[8px] sm:text-[10px] font-bold text-amber-500 mt-1 truncate hidden sm:block">
              ⏳ {pendingVoicesCount} pending
            </p>
          )}
        </div>

        {/* KPI 3: Assigned / System Voices */}
        <div className={`p-2.5 sm:p-5 rounded-2xl sm:rounded-[1.75rem] border relative overflow-hidden transition-all ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900 to-slate-900/60 border-slate-800' 
            : 'bg-gradient-to-br from-white to-emerald-50/40 border-slate-200/80 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-1.5 sm:mb-3">
            <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <Building2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <span className="hidden xs:inline-block text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-mono">
              Local
            </span>
          </div>
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 truncate">Assigned</p>
          <div className="flex items-baseline gap-1 sm:gap-2 mt-0.5">
            <h3 className={`text-sm sm:text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {assignedVoices.length}
            </h3>
            <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 truncate">
              inst
            </span>
          </div>
          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-1 truncate hidden sm:block">
            🌐 {assignedVoices.filter(v => v.institutions?.name === 'SYSTEM_GLOBAL_INTERNAL').length} Global
          </p>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className={`p-1.5 sm:p-2 rounded-[2rem] border grid grid-cols-2 items-center gap-1.5 sm:gap-2 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
      }`}>
        {[
          { key: 'voices', label: 'Awaj Voices', icon: Mic, count: voices.length },
          { key: 'assigned_voices', label: 'Assigned Voices', icon: Building2, count: assignedVoices.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              id={`tab-btn-${tab.key}`}
              className={`flex-1 py-3 px-3 sm:px-4 rounded-[1.5rem] text-xs font-black transition-colors duration-150 cursor-pointer flex items-center justify-between sm:justify-center gap-2 active:scale-95 ${
                isActive 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' 
                  : isDark 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/80 active:bg-slate-800' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                isActive 
                  ? 'bg-white/20 text-white' 
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/80 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* API Error Alert */}
      {apiError && (
        <div className={`p-4 sm:p-5 rounded-2xl flex items-start gap-3.5 border ${
          isDark ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={20} />
          <div className="space-y-1">
            <h4 className="font-black text-sm">Awaj Digital API Connection Alert</h4>
            <p className="text-xs">{apiError}</p>
            {apiError.toLowerCase().includes('token') && (
              <p className="text-[11px] font-bold text-red-500 bg-red-100/40 dark:bg-red-900/30 p-2 rounded-xl mt-2 border border-red-300/30">
                Action Required: AWAJ_API_TOKEN এনভায়রনমেন্ট ভেরিয়েবল সঠিকভাবে কনফিগার করা আছে কিনা চেক করুন।
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest">Awaj Digital ডেটা লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TAB 1: VOICES */}
          {activeTab === 'voices' && (
            <div className="space-y-4">
              {/* Controls Bar: Search & Status Filters */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ভয়েসের নাম দিয়ে খুঁজুন..."
                    value={voiceSearchQuery}
                    onChange={(e) => setVoiceSearchQuery(e.target.value)}
                    className={`w-full h-12 pl-11 pr-4 rounded-2xl border text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark 
                        ? 'bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500' 
                        : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                  {voiceSearchQuery && (
                    <button 
                      onClick={() => setVoiceSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Status Filter Chips / Toggles */}
                <div className={`p-1.5 rounded-2xl border grid grid-cols-2 xs:grid-cols-4 sm:flex items-center gap-1.5 w-full md:w-auto shrink-0 ${
                  isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
                }`}>
                  {[
                    { id: 'all', label: 'All', count: voices.length, dot: 'bg-blue-500' },
                    { id: 'approved', label: 'Approved', count: approvedVoicesCount, dot: 'bg-emerald-500' },
                    { id: 'pending', label: 'Pending', count: pendingVoicesCount, dot: 'bg-amber-500' },
                    { id: 'rejected', label: 'Rejected', count: voices.filter(v => v.status === 'rejected').length, dot: 'bg-rose-500' },
                  ].map((filter) => {
                    const isSelected = voiceStatusFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setVoiceStatusFilter(filter.id as any)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black transition-colors duration-150 flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/30'
                            : isDark 
                              ? 'bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:text-white hover:bg-slate-700/80' 
                              : 'bg-slate-100/90 text-slate-800 border border-slate-200/80 hover:text-slate-900 hover:bg-slate-200/90'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${filter.dot} shrink-0 ring-2 ring-white/20`} />
                        <span>{filter.label}</span>
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isSelected 
                            ? 'bg-white/25 text-white' 
                            : isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-200/90 text-slate-800 font-black'
                        }`}>
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct API Notice */}
              <div className={`p-3.5 sm:p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                isDark 
                  ? 'bg-blue-950/20 border-blue-800/40 text-blue-300' 
                  : 'bg-blue-50/60 border-blue-100 text-blue-800'
              }`}>
                <div className="flex items-center gap-2.5">
                  <Info size={18} className="shrink-0 text-blue-500" />
                  <span className="font-bold">
                    দ্রুততম স্পিডে লোড হওয়ার জন্য সর্বশেষ ২০টি ভয়েস প্রদর্শন করা হচ্ছে।
                  </span>
                </div>
                <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200 shrink-0">
                  Top 20 Voices
                </span>
              </div>

              {/* Voices Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredVoices.length > 0 ? (
                  filteredVoices.map((voice) => {
                    const isApproved = voice.status === 'approved';
                    const isPending = voice.status === 'pending';
                    const isRejected = voice.status === 'rejected';

                    return (
                      <div 
                        key={voice.id} 
                        className={`p-4 sm:p-5 rounded-[2rem] border transition-all flex flex-col justify-between gap-4 ${
                          isDark 
                            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' 
                            : 'bg-white border-slate-200/80 hover:border-blue-200 shadow-sm hover:shadow-md'
                        }`}
                      >
                        {/* Top: Icon + Name + Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                              isApproved 
                                ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                                : isPending
                                  ? (isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600')
                                  : (isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600')
                            }`}>
                              <Mic size={22} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-black text-sm sm:text-base truncate ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`} title={voice.name}>
                                {voice.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-bold">
                                <span className="flex items-center gap-1">
                                  <Clock size={11} /> {new Date(voice.createdAt || voice.created_at || Date.now()).toLocaleDateString('bn-BD')}
                                </span>
                                <span>•</span>
                                <button
                                  onClick={() => copyToClipboard(String(voice.id), `voice-${voice.id}`)}
                                  className="hover:text-blue-500 flex items-center gap-1 font-mono text-[10px]"
                                  title="Voice ID কপি করুন"
                                >
                                  ID: {voice.id}
                                  {copiedId === `voice-${voice.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                            isApproved 
                              ? (isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                              : isPending
                                ? (isDark ? 'bg-amber-950/40 text-amber-400 border-amber-800/60' : 'bg-amber-50 text-amber-700 border-amber-200')
                                : (isDark ? 'bg-rose-950/40 text-rose-400 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200')
                          }`}>
                            {voice.status}
                          </span>
                        </div>

                        {/* Middle: Audio Player */}
                        {(voice.previewUrl || voice.preview_url || voice.file_url) ? (
                          <div className={`p-2.5 rounded-2xl border ${
                            isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <Volume2 size={12} className="text-blue-500" />
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Audio Preview</span>
                            </div>
                            <audio 
                              controls 
                              src={voice.previewUrl || voice.preview_url || voice.file_url} 
                              className="w-full h-8 outline-none" 
                            />
                          </div>
                        ) : (
                          <div className={`p-2.5 rounded-2xl border text-[11px] font-bold text-slate-400 flex items-center gap-2 ${
                            isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200/60'
                          }`}>
                            <Info size={14} /> অডিও প্রিভিউ লিংক উপলব্ধ নেই
                          </div>
                        )}

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          {isApproved ? (
                            <button
                              onClick={() => {
                                setAssigningVoice(voice);
                                setShowAssignModal(true);
                              }}
                              className="flex-1 h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer"
                            >
                              <Building2 size={15} /> <span>Assign</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1 px-1">
                              <Clock size={12} /> অনুমোদনের পর বরাদ্দযোগ্য
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteVoice(voice.id)}
                            className="h-10 px-3.5 bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-500 dark:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm shadow-rose-600/20 active:scale-95 cursor-pointer"
                            title="Awaj থেকে মুছুন"
                          >
                            <Trash2 size={15} /> <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`col-span-full py-16 px-4 text-center rounded-[2.5rem] border-2 border-dashed ${
                    isDark ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50/80 border-slate-200 text-slate-400'
                  }`}>
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-3">
                      <Mic size={28} />
                    </div>
                    <h3 className="text-base font-black font-noto">কোনো ভয়েস পাওয়া যায়নি</h3>
                    <p className="text-xs font-bold mt-1">সার্চ ফিল্টার পরিবর্তন করুন অথবা নতুন ভয়েস আপলোড করুন।</p>
                    <button
                      onClick={() => {
                        setUploadError(null);
                        setShowUploadModal(true);
                      }}
                      className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-md"
                    >
                      <UploadCloud size={16} /> নতুন ভয়েস আপলোড করুন
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGNED / SYSTEM VOICES */}
          {activeTab === 'assigned_voices' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ভয়েস বা মাদরাসার নাম দিয়ে খুঁজুন..."
                  value={assignedVoiceSearchQuery}
                  onChange={(e) => setAssignedVoiceSearchQuery(e.target.value)}
                  className={`w-full h-12 pl-11 pr-4 rounded-2xl border text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark 
                      ? 'bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500' 
                      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredAssignedVoices.length > 0 ? (
                  filteredAssignedVoices.map((voice) => {
                    const isGlobal = voice.institutions?.name === 'SYSTEM_GLOBAL_INTERNAL';
                    return (
                      <div 
                        key={voice.id} 
                        className={`p-4 sm:p-5 rounded-[2rem] border transition-all flex flex-col justify-between gap-4 ${
                          isDark 
                            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' 
                            : 'bg-white border-slate-200/80 hover:border-emerald-200 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                              isGlobal 
                                ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')
                                : (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                            }`}>
                              {isGlobal ? <Globe size={22} /> : <Building2 size={22} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-black text-sm sm:text-base truncate ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}>
                                {voice.title}
                              </h4>
                              <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                                টার্গেট: <span className={isGlobal ? 'text-blue-500 font-extrabold' : (isDark ? 'text-slate-200' : 'text-slate-700')}>
                                  {isGlobal ? '🌐 Global System Voice' : (voice.institutions?.name || 'অনির্দিষ্ট')}
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock size={10} /> {new Date(voice.created_at).toLocaleDateString('bn-BD')}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                            isGlobal
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          }`}>
                            {isGlobal ? 'Global' : 'Institute'}
                          </span>
                        </div>

                        {/* Audio preview */}
                        {voice.file_url && (
                          <div className={`p-2.5 rounded-2xl border ${
                            isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                          }`}>
                            <audio controls src={voice.file_url} className="w-full h-8 outline-none" />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            onClick={() => handleUnassignVoice(voice.id)}
                            className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-500 dark:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/20 active:scale-95 cursor-pointer"
                          >
                            <Trash2 size={15} /> <span>Unassign</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`col-span-full py-16 px-4 text-center rounded-[2.5rem] border-2 border-dashed ${
                    isDark ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50/80 border-slate-200 text-slate-400'
                  }`}>
                    <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-black uppercase tracking-wider">কোনো নির্ধারিত ভয়েস পাওয়া যায়নি</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Broadcast Result Call Logs Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-[2.5rem] p-5 sm:p-7 border shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-500 font-mono">
                    Call Logs
                  </span>
                  <span className="text-xs font-mono text-slate-400 truncate">
                    Campaign: {selectedItem.provider_campaign_id || selectedItem.id}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black font-noto truncate mt-1">
                  {selectedItem.voice_templates?.title || selectedItem.name || 'ক্যাম্পেইন বিবরণ'}
                </h2>
              </div>
              <button 
                onClick={() => { setSelectedItem(null); setItemResult(null); }} 
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filters Bar inside Modal */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className={`p-1 rounded-xl border flex items-center gap-1 ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
              }`}>
                {(['all', 'answered', 'failed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setResultFilter(mode)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      resultFilter === mode
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {itemResult && (
                <span className="text-xs font-bold text-slate-400">
                  মোট: {filteredResults.length} টি কল
                </span>
              )}
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {loadingResult ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                  <Loader2 className="animate-spin text-blue-500" size={28} />
                  <p className="text-xs font-black uppercase tracking-wider">কল হিস্টোরি লোড হচ্ছে...</p>
                </div>
              ) : filteredResults.length > 0 ? (
                filteredResults.map((res: any, idx: number) => {
                  const isAnswered = res.status === 'answered' || res.status === 'success';
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                        isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isAnswered 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          <PhoneForwarded size={16} />
                        </div>
                        <div>
                          <p className={`text-sm font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {res.phone || res.number || res.msisdn || 'অজানা নম্বর'}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            স্থিতিকাল: {res.duration || res.billsec || 0} সেকেন্ড
                          </p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        isAnswered
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/60'
                      }`}>
                        {res.status}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-xs font-black uppercase tracking-wider">কোনো কল রেকর্ড পাওয়া যায়নি</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Voice to User Modal */}
      {showAssignModal && assigningVoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 border shadow-2xl animate-in zoom-in-95 duration-200 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black font-noto">ভয়েস বরাদ্দ করুন</h2>
                  <p className="text-[11px] font-bold text-slate-400">মাদরাসা বা গ্লোবাল সিস্টেম হিসেবে অ্যাসাইন</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowAssignModal(false); setAssigningVoice(null); }} 
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">
                  নির্বাচিত ভয়েস (Voice Name)
                </label>
                <div className={`w-full h-12 rounded-xl px-4 flex items-center font-black text-sm border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <Mic size={16} className="mr-2 text-blue-500 shrink-0" />
                  <span className="truncate">{assigningVoice.name}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">
                  প্রতিষ্ঠান নির্বাচন করুন (Target Institution)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="মাদরাসা সার্চ করুন..."
                    value={instSearchInAssign}
                    onChange={(e) => setInstSearchInAssign(e.target.value)}
                    className={`w-full h-10 rounded-xl px-4 font-bold text-xs outline-none border focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <select
                    value={assignInstitutionId}
                    onChange={(e) => setAssignInstitutionId(e.target.value)}
                    className={`w-full h-12 rounded-xl px-4 font-bold text-sm border outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">একটি প্রতিষ্ঠান বেছে নিন...</option>
                    <option value="system" className="font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-900/50">
                      🌐 Save as Global System Voice (সবার জন্য উন্মুক্ত)
                    </option>
                    {filteredInstitutionsInAssign.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.config_json?.institute_code ? `[${m.config_json.institute_code}] ` : ''}{m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAssignModal(false); setAssigningVoice(null); }}
                  className={`flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-wider border ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  বাতিল
                </button>
                <button
                  onClick={handleAssignVoice}
                  disabled={isAssigning || !assignInstitutionId}
                  className="flex-[2] h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-black uppercase tracking-wider text-xs hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isAssigning ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  <span>{isAssigning ? 'বরাদ্দ হচ্ছে...' : 'অ্যাসাইন সম্পন্ন করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Voice to Awaj Digital Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`rounded-[2.5rem] p-5 sm:p-8 w-full max-w-lg shadow-2xl border animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black font-noto">Awaj Digital-এ ভয়েস আপলোড</h2>
                  <p className="text-[11px] font-bold text-slate-400">Direct API Upload (No Supabase storage)</p>
                </div>
              </div>
              <button 
                onClick={handleCloseUploadModal} 
                disabled={isUploading}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 rounded-2xl text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="font-bold">{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadVoice} className="space-y-4">
              {/* Voice Name Field */}
              <div>
                <div className="flex justify-between items-center px-1 mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    ভয়েসের নাম (Voice Name) <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold ${uploadName.length > 255 ? 'text-red-500' : 'text-slate-400'}`}>
                    {uploadName.length}/255
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="যেমন: chuti_notice_2026 বা ছুটির নোটিশ"
                  disabled={isUploading}
                  className={`w-full h-12 px-4 rounded-xl border font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    isDark 
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
                <p className="text-[10px] text-slate-400 mt-1 px-1">
                  ইউনিক নাম দিন (Case-insensitive, 1-255 অক্ষর)।
                </p>
              </div>

              {/* Audio File Field */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">
                  অডিও ফাইল (Audio File) <span className="text-red-500">*</span>
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,.aac,.webm,.flac,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />

                {!uploadFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      isDark 
                        ? 'border-slate-700 hover:border-blue-500 bg-slate-800/40 hover:bg-slate-800/70' 
                        : 'border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <FileAudio size={24} />
                    </div>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                      অডিও ফাইল নির্বাচন করতে এখানে ক্লিক করুন
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      সমর্থিত ফরম্যাট: MP3, WAV, OGG, M4A, AAC, WEBM, FLAC (সর্বোচ্চ 10MB)
                    </p>
                  </div>
                ) : (
                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                          <Music size={18} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate">{uploadFile.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • {uploadFile.name.split('.').pop()?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null);
                          if (uploadPreviewUrl) {
                            URL.revokeObjectURL(uploadPreviewUrl);
                            setUploadPreviewUrl(null);
                          }
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        disabled={isUploading}
                        className="text-red-500 hover:text-red-600 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                      >
                        পরিবর্তন
                      </button>
                    </div>

                    {/* Instant Audio Preview */}
                    {uploadPreviewUrl && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">অডিও প্রিভিউ:</span>
                        </div>
                        <audio controls src={uploadPreviewUrl} className="w-full h-8 outline-none" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Note */}
              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                ⚠️ <span className="font-bold">নোট:</span> ভয়েসটি <strong>pending</strong> স্ট্যাটাসে তৈরি হবে। Awaj Digital অ্যাডমিন দ্বারা অনুমোদিত হওয়ার পরই এটি সিস্টেমে ব্রডকাস্টের জন্য কার্যকর হবে।
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseUploadModal}
                  disabled={isUploading}
                  className={`flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-wider border transition-colors disabled:opacity-50 ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadName.trim() || !uploadFile}
                  className="flex-[2] h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>আপলোড হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>Awaj Digital-এ আপলোড করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
