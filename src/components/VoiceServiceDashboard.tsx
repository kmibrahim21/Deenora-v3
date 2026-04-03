import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, Loader2, Mic, Trash2, CheckCircle2, Smartphone, PhoneCall, ChevronRight, X } from 'lucide-react';
import { supabase } from 'supabase';

interface VoiceServiceDashboardProps {
  onBack: () => void;
  madrasah: any;
  setStatusModal: (modal: any) => void;
}

export const VoiceServiceDashboard: React.FC<VoiceServiceDashboardProps> = ({ onBack, madrasah, setStatusModal }) => {
  const [activeTab, setActiveTab] = useState<'voices' | 'assigned_voices' | 'senders' | 'broadcasts'>('voices');
  const [voices, setVoices] = useState<any[]>([]);
  const [assignedVoices, setAssignedVoices] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemResult, setItemResult] = useState<any>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningVoice, setAssigningVoice] = useState<any>(null);
  const [assignInstitutionId, setAssignInstitutionId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);

  useEffect(() => {
    const fetchInstitutions = async () => {
      const { data } = await supabase.from('institutions').select('id, name').eq('is_super_admin', false).order('name');
      if (data) setInstitutions(data);
    };
    fetchInstitutions();
  }, []);

  const handleAssignVoice = async () => {
    if (!assigningVoice || !assignInstitutionId) return;
    setIsAssigning(true);
    try {
      const { error } = await supabase.from('voice_templates').insert({
        institution_id: assignInstitutionId,
        title: assigningVoice.name,
        file_url: assigningVoice.previewUrl || '', 
        admin_status: 'approved',
        provider_status: 'approved',
        provider_voice_id: assigningVoice.id.toString(),
        provider_voice_name: assigningVoice.name
      });

      if (error) throw error;

      setStatusModal({
        show: true,
        type: 'success',
        title: 'Assigned',
        message: 'Voice assigned to user successfully!'
      });
      setShowAssignModal(false);
      setAssigningVoice(null);
      setAssignInstitutionId('');
    } catch (error: any) {
      console.error("Assign error:", error);
      setStatusModal({ show: true, type: 'error', title: 'Error', message: error.message || "Failed to assign voice" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignVoice = async (id: string) => {
    if (!window.confirm('Are you sure you want to unassign this voice from the user?')) return;
    try {
      const { error } = await supabase.from('voice_templates').delete().eq('id', id);
      if (error) throw error;
      
      setStatusModal({
        show: true,
        type: 'success',
        title: 'Unassigned',
        message: 'Voice unassigned successfully!'
      });
      fetchData();
    } catch (error: any) {
      console.error("Unassign error:", error);
      setStatusModal({ show: true, type: 'error', title: 'Error', message: error.message || "Failed to unassign voice" });
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm('Are you sure you want to delete this voice from Awaj API?')) return;
    try {
      const response = await fetch(`/api/awaj/voices/${voiceId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete voice');
      }
      
      // Also delete from local assignments
      await supabase.from('voice_templates').delete().eq('provider_voice_id', voiceId.toString());
      
      setStatusModal({
        show: true,
        type: 'success',
        title: 'Deleted',
        message: 'Voice deleted successfully!'
      });
      fetchData();
    } catch (error: any) {
      console.error("Delete error:", error);
      setStatusModal({ show: true, type: 'error', title: 'Error', message: error.message || "Failed to delete voice" });
    }
  };

  const fetchData = async (retryCount = 0) => {
    setLoading(true);
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

      const [voicesRes, sendersRes, broadcastsRes] = await Promise.all([
        fetchJson('/api/awaj/voices'),
        fetchJson('/api/awaj/senders'),
        fetchJson('/api/awaj/broadcasts')
      ]);

      if (voicesRes.error || sendersRes.error || broadcastsRes.error) {
        setApiError(voicesRes.error || sendersRes.error || broadcastsRes.error);
      }

      const apiVoices = voicesRes.voices || voicesRes.data || [];
      setVoices(apiVoices);
      setSenders(sendersRes.senders || sendersRes.data || []);
      setBroadcasts(broadcastsRes.broadcasts || broadcastsRes.data || []);

      // Fetch assigned voices from Supabase
      const { data: assignedData, error: assignedError } = await supabase
        .from('voice_templates')
        .select(`
          *,
          institutions (
            id,
            name
          )
        `)
        .not('institution_id', 'is', null)
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

  return (
    <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-10 h-10 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'} rounded-full flex items-center justify-center transition-colors`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>Voice Service Dashboard</h1>
        </div>
        <button onClick={() => fetchData()} className={`p-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-xl active:scale-95 transition-all border shadow-sm`}>
          <RefreshCw size={18} />
        </button>
      </div>

      <div className={`flex ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-sm'} p-1.5 rounded-[2rem] border overflow-x-auto hide-scrollbar`}>
        {(['voices', 'assigned_voices', 'senders', 'broadcasts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-none px-4 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#2563EB] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {apiError && (
        <div className={`${madrasah?.theme === 'dark' ? 'bg-red-900/30 border-red-900/50 text-red-400' : 'bg-red-50 border-red-200 text-red-700'} p-4 rounded-2xl flex items-start gap-3 border`}>
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold">API Connection Error</h4>
            <p className="text-sm mt-1">{apiError}</p>
            <p className="text-xs mt-2 opacity-80">Make sure AWAJ_API_TOKEN is set in your Vercel Environment Variables.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest">Fetching Awaj Data...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'voices' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {voices.length > 0 ? (
                  voices.map((voice) => (
                    <div key={voice.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2rem] border flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-500'} rounded-2xl flex items-center justify-center shadow-inner shrink-0`}>
                          <Mic size={20} />
                        </div>
                        <div>
                          <h4 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{voice.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            Created: {new Date(voice.createdAt || voice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                        {voice.previewUrl && (
                          <audio controls src={voice.previewUrl} className="h-8 w-full sm:w-48 sm:mr-2" />
                        )}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${voice.status === 'approved' ? (madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (madrasah?.theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50' : 'bg-yellow-50 text-yellow-600 border-yellow-100')}`}>
                            {voice.status}
                          </span>
                          <div className="flex items-center gap-2">
                            {voice.status === 'approved' && (
                              <button
                                onClick={() => {
                                  setAssigningVoice(voice);
                                  setShowAssignModal(true);
                                }}
                                className={`px-3 py-1 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} rounded-full text-[8px] font-black uppercase tracking-widest transition-colors`}
                              >
                                Assign
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteVoice(voice.id)}
                              className={`px-3 py-1 ${madrasah?.theme === 'dark' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'} rounded-full text-[8px] font-black uppercase tracking-widest transition-colors flex items-center gap-1`}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                <div className={`text-center py-16 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[3rem] border-2 border-dashed`}>
                  <div className={`w-16 h-16 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Mic size={32} />
                  </div>
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No Voices Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {activeTab === 'assigned_voices' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {assignedVoices.length > 0 ? (
                assignedVoices.map((voice) => (
                  <div key={voice.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2rem] border flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'} rounded-2xl flex items-center justify-center shadow-inner shrink-0`}>
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{voice.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          User: <span className={madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>{voice.institutions?.name || 'Unknown'}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          Assigned: {new Date(voice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                      {voice.file_url && (
                        <audio controls src={voice.file_url} className="h-8 w-full sm:w-48" />
                      )}
                      <button
                        onClick={() => handleUnassignVoice(voice.id)}
                        className={`px-4 py-2 ${madrasah?.theme === 'dark' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'} rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full sm:w-auto`}
                      >
                        <Trash2 size={14} /> Unassign
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`text-center py-16 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[3rem] border-2 border-dashed`}>
                  <div className={`w-16 h-16 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Mic size={32} />
                  </div>
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No Assigned Voices Found</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'senders' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {senders.length > 0 ? (
                senders.map((sender) => (
                  <div key={sender.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2rem] border flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'} rounded-2xl flex items-center justify-center shadow-inner shrink-0`}>
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <h4 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{sender.number}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Caller ID</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${sender.status === 'active' ? (madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (madrasah?.theme === 'dark' ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-600 border-red-100')}`}>
                      {sender.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className={`text-center py-16 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[3rem] border-2 border-dashed`}>
                  <div className={`w-16 h-16 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Smartphone size={32} />
                  </div>
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No Senders Found</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'broadcasts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {broadcasts.length > 0 ? (
                broadcasts.map((b) => (
                  <div key={b.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2rem] border`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-500'} rounded-2xl flex items-center justify-center shadow-inner shrink-0`}>
                          <PhoneCall size={20} />
                        </div>
                        <div>
                          <h4 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{b.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {new Date(b.createdAt || b.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedItem(b); fetchBroadcastResult(b.id); }}
                        className={`p-2 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} rounded-xl transition-colors self-end sm:self-auto`}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-50 mt-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                        <p className="font-black text-slate-700">{b.totalNumbers || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Success</p>
                        <p className="font-black text-emerald-600">{b.successCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Failed</p>
                        <p className="font-black text-red-600">{b.failedCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Cost</p>
                        <p className="font-black text-slate-700">{b.cost || 0} ৳</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PhoneCall size={32} />
                  </div>
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No Broadcasts Found</p>
                </div>
              )}
            </div>
          )}
          
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-white/50'} rounded-[2.5rem] p-6 sm:p-8 w-full max-w-2xl shadow-2xl border animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col`}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className={`text-lg sm:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto truncate pr-4`}>Campaign Result: {selectedItem.name}</h2>
              <button onClick={() => { setSelectedItem(null); setItemResult(null); }} className={`w-10 h-10 rounded-full ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'} flex items-center justify-center transition-colors shrink-0`}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 hide-scrollbar">
              {loadingResult ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Loading Results...</p>
                </div>
              ) : itemResult && itemResult.length > 0 ? (
                <div className="space-y-3">
                  {itemResult.map((res: any, idx: number) => (
                    <div key={idx} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'} p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                      <div>
                        <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{res.phone}</p>
                        <p className="text-[10px] font-bold text-slate-400">Duration: {res.duration}s</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest self-start sm:self-auto ${res.status === 'answered' ? (madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (madrasah?.theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')}`}>
                        {res.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-300">
                  <p className="text-xs font-black uppercase tracking-widest">No results found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAssignModal && assigningVoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-white/50'} rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border animate-in zoom-in-95 duration-200`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>Assign Voice to User</h2>
              <button onClick={() => { setShowAssignModal(false); setAssigningVoice(null); }} className={`w-10 h-10 rounded-full ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'} flex items-center justify-center transition-colors`}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Voice</label>
                <div className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'} border rounded-xl px-4 flex items-center font-black text-sm mt-1`}>
                  {assigningVoice.name}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Institution</label>
                <select
                  value={assignInstitutionId}
                  onChange={(e) => setAssignInstitutionId(e.target.value)}
                  className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'} border rounded-xl px-4 font-black text-sm mt-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
                >
                  <option value="">Select an institution...</option>
                  {institutions.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssignVoice}
                disabled={isAssigning || !assignInstitutionId}
                className="w-full h-12 bg-[#2563EB] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
              >
                {isAssigning ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {isAssigning ? 'Assigning...' : 'Assign Voice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
