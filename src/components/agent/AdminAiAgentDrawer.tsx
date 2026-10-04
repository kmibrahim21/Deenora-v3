import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Settings2, 
  MessageSquare, 
  Trash2, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  RefreshCw,
  HelpCircle,
  Check,
  Copy,
  Info,
  Mic,
  Plus,
  RotateCcw,
  Zap,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Institution, Profile, Language } from '../../types';
import mascotLogo from '../../assets/images/deenora_ai_logo_1791022053953.jpg';
import mascotThinking from '../../assets/images/deenora_ai_thinking_1791022076160.jpg';
import mascotHero from '../../assets/images/deenora_ai_hero_1791022090496.jpg';
import mascotSuccess from '../../assets/images/deenora_ai_success_1791022108521.jpg';
import AnimatedTypingMascot from './AnimatedTypingMascot';

// ========================================================
// 3D MASCOT AVATAR COMPONENT
// ========================================================
interface DeenoraMascotAvatarProps {
  size?: number;
  thinking?: boolean;
  success?: boolean;
  className?: string;
}

export const DeenoraMascotAvatar: React.FC<DeenoraMascotAvatarProps> = ({
  size = 32,
  thinking = false,
  success = false,
  className = ''
}) => {
  const imgSrc = thinking ? mascotThinking : (success ? mascotSuccess : mascotLogo);
  return (
    <div 
      className={`relative rounded-full overflow-hidden border border-indigo-400/30 shadow-md shrink-0 transition-all ${thinking ? 'ring-2 ring-cyan-400 animate-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <img 
        src={imgSrc} 
        alt="Deenora AI Mascot" 
        className="w-full h-full object-cover"
      />
    </div>
  );
};

// ========================================================
// ANIMATED "DEENORA SPARK" SVG LOGO COMPONENT
// ========================================================
interface DeenoraSparkLogoProps {
  size?: number;
  thinking?: boolean;
  isDark?: boolean;
  className?: string;
}

export const DeenoraSparkLogo: React.FC<DeenoraSparkLogoProps> = ({ 
  size = 32, 
  thinking = false,
  isDark = true,
  className = '' 
}) => {
  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${thinking ? 'deenora-thinking' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <radialGradient id={`sparkOrbGrad-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor={isDark ? "#0F172A" : "#1E293B"} />
          </radialGradient>
          <linearGradient id={`ringGrad1-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id={`ringGrad2-${size}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A3E635" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        
        {/* Floating Particle Dots */}
        <circle cx="50" cy="18" r="2.5" fill="#22D3EE" className="animate-pulse opacity-75" />
        <circle cx="78" cy="45" r="2" fill="#A3E635" className="animate-pulse opacity-70" style={{ animationDelay: '0.8s' }} />
        <circle cx="24" cy="65" r="1.8" fill="#6366F1" className="animate-pulse opacity-80" style={{ animationDelay: '1.4s' }} />

        {/* Orbit Ring 1 */}
        <ellipse 
          cx="50" 
          cy="50" 
          rx="42" 
          ry="16" 
          stroke={`url(#ringGrad1-${size})`} 
          strokeWidth="2" 
          fill="none" 
          strokeDasharray="18 8"
          style={{
            animation: thinking ? 'spinClockwise 3s linear infinite' : 'spinClockwise 12s linear infinite',
            transformOrigin: '50px 50px'
          }}
        />

        {/* Orbit Ring 2 (Counter-clockwise) */}
        <ellipse 
          cx="50" 
          cy="50" 
          rx="40" 
          ry="18" 
          stroke={`url(#ringGrad2-${size})`} 
          strokeWidth="1.8" 
          fill="none" 
          strokeDasharray="24 10" 
          transform="rotate(45 50 50)"
          style={{
            animation: thinking ? 'spinCounterClockwise 4.5s linear infinite' : 'spinCounterClockwise 18s linear infinite',
            transformOrigin: '50px 50px'
          }}
        />

        {/* Core Glow Orb */}
        <circle 
          cx="50" 
          cy="50" 
          r="22" 
          fill={`url(#sparkOrbGrad-${size})`} 
          style={{
            animation: thinking ? 'coreThinkingPulse 0.8s ease-in-out infinite' : 'coreGlowPulse 2.4s ease-in-out infinite',
            transformOrigin: '50px 50px'
          }}
        />
        <circle cx="45" cy="45" r="8" fill="#FFFFFF" opacity="0.45" filter="blur(2px)" />
      </svg>
    </div>
  );
};

// ========================================================
// MESSAGE PAYLOAD INTERFACES
// ========================================================
export type MessageType = 
  | 'text' 
  | 'tool_timeline' 
  | 'confirmation' 
  | 'result' 
  | 'clarification' 
  | 'error' 
  | 'quota_exceeded';

export interface MessagePayload {
  id: string;
  role: 'user' | 'ai';
  type: MessageType;
  text?: string;
  steps?: Array<{ label: string; status: 'working' | 'done'; detail?: string }>;
  summary?: string;
  call?: any;
  title?: string;
  rows?: Array<[string, string]>;
  question?: string;
  options?: Array<{ id: string; label: string }>;
  message?: string;
  time: string;
}

interface AdminAiAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  madrasah: Institution | null;
  profile: Profile | null;
  lang: Language;
}

const QUICK_SUGGESTIONS = [
  '💰 আজকের ফি কালেকশন কত?',
  '📝 নতুন ছাত্র ভর্তি করো',
  '📢 আগামীকালের নোটিশ দাও',
  '📊 দশম শ্রেণির হাজিরা দেখাও',
  '👨‍🏫 সকল শিক্ষকের তালিকা দেখাও'
];

export const AdminAiAgentDrawer: React.FC<AdminAiAgentDrawerProps> = ({
  isOpen,
  onClose,
  madrasah,
  profile,
  lang
}) => {
  const isDark = madrasah?.theme === 'dark';
  const isBn = lang === 'bn';
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');

  // Role authorization guard (Super Admin & Manager only)
  const isAuthorized = profile?.role === 'super_admin' || profile?.role === 'manager';
  if (!isAuthorized) return null;

  // Chat State
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastPendingCall, setLastPendingCall] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Settings State
  const [statusLoading, setStatusLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{
    mode: 'byok' | 'shared';
    has_custom_key: boolean;
    masked_key: string;
    shared_usage?: {
      today_used: number;
      daily_cap: number;
      remaining: number;
    };
  }>({
    mode: 'shared',
    has_custom_key: false,
    masked_key: ''
  });

  const [inputApiKey, setInputApiKey] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [keySaveLoading, setKeySaveLoading] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen && madrasah?.id) {
      fetchAgentStatus();
    }
  }, [isOpen, madrasah?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchAgentStatus = async () => {
    if (!madrasah?.id) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/agent/settings/status?instituteId=${madrasah.id}`);
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch agent settings status:', e);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Main Send Function conforming to API Contract
  const handleSendMessage = async (msgText?: string, confirmedCallPayload?: any) => {
    const textToSend = (msgText || inputMessage).trim();
    if (!textToSend && !confirmedCallPayload) return;

    const timeNow = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

    if (textToSend) {
      const userMsg: MessagePayload = {
        id: `u-${Date.now()}`,
        role: 'user',
        type: 'text',
        text: textToSend,
        time: timeNow
      };
      setMessages(prev => [...prev, userMsg]);
      setInputMessage('');
    }

    setLoading(true);

    try {
      const historyPayload = messages
        .map(m => ({
          role: ((m.role as string) === 'ai' || (m.role as string) === 'assistant' || (m.role as string) === 'model') ? 'model' : 'user',
          text: (m.text || m.summary || m.message || '').trim()
        }))
        .filter(m => m.text.length > 0)
        .slice(-10);

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instituteId: madrasah?.id || profile?.institution_id,
          adminId: profile?.id || 'admin',
          adminName: profile?.full_name || madrasah?.name || 'Admin',
          userRole: profile?.role || 'madrasah_admin',
          message: textToSend,
          history: historyPayload,
          confirmedCall: confirmedCallPayload || null
        })
      });

      const data = await res.json();

      if (res.status === 429 || data.error === 'QUOTA_EXCEEDED') {
        setQuotaExceeded(true);
        const quotaMsg: MessagePayload = {
          id: `q-${Date.now()}`,
          role: 'ai',
          type: 'quota_exceeded',
          message: 'আজকের free limit শেষ। Settings-এ নিজের API key বসিয়ে unlimited ব্যবহার করো।',
          time: timeNow
        };
        setMessages(prev => [...prev, quotaMsg]);
        return;
      }

      // Format payload according to API contract shape
      let aiMsg: MessagePayload;

      if (data.confirmation_required) {
        setLastPendingCall(data.confirmation_call);
        aiMsg = {
          id: `c-${Date.now()}`,
          role: 'ai',
          type: 'confirmation',
          summary: data.reply,
          call: data.confirmation_call,
          time: timeNow
        };
      } else if (data.type === 'tool_timeline') {
        aiMsg = {
          id: `t-${Date.now()}`,
          role: 'ai',
          type: 'tool_timeline',
          steps: data.steps || [],
          time: timeNow
        };
      } else if (data.type === 'result') {
        aiMsg = {
          id: `r-${Date.now()}`,
          role: 'ai',
          type: 'result',
          title: data.title || '✅ জমা সম্পন্ন',
          rows: data.rows || [],
          text: data.text || '',
          time: timeNow
        };
      } else if (data.type === 'clarification') {
        aiMsg = {
          id: `cl-${Date.now()}`,
          role: 'ai',
          type: 'clarification',
          question: data.question || '',
          options: data.options || [],
          time: timeNow
        };
      } else if (data.type === 'error' || data.error) {
        aiMsg = {
          id: `e-${Date.now()}`,
          role: 'ai',
          type: 'error',
          message: data.message || data.error || 'একটি সমস্যা দেখা দিয়েছে।',
          time: timeNow
        };
      } else {
        // Normal text response
        aiMsg = {
          id: `m-${Date.now()}`,
          role: 'ai',
          type: 'text',
          text: data.reply || data.text || 'কাজটি সম্পন্ন হয়েছে ✅',
          time: timeNow
        };
      }

      setMessages(prev => [...prev, aiMsg]);

      // Refresh status if usage changed in shared mode
      if (agentStatus.mode === 'shared') {
        fetchAgentStatus();
      }

    } catch (err: any) {
      console.error('Agent chat error:', err);
      const errMsg: MessagePayload = {
        id: `err-${Date.now()}`,
        role: 'ai',
        type: 'error',
        message: 'দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে পুনরায় চেষ্টা করুন।',
        time: timeNow
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    if (!lastPendingCall) return;
    const lastUserText = messages.filter(m => m.role === 'user').slice(-1)[0]?.text || '';
    handleSendMessage(lastUserText, lastPendingCall);
    setLastPendingCall(null);
  };

  const handleCancelAction = () => {
    setLastPendingCall(null);
    const cancelMsg: MessagePayload = {
      id: `cancel-${Date.now()}`,
      role: 'ai',
      type: 'text',
      text: '— কাজটি বাতিল করা হয়েছে —',
      time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, cancelMsg]);
  };

  const handleSaveApiKey = async () => {
    if (!inputApiKey.trim()) return;
    if (!madrasah?.id) return;

    setKeySaveLoading(true);
    setKeyFeedback(null);

    try {
      const res = await fetch('/api/agent/settings/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instituteId: madrasah.id,
          apiKey: inputApiKey.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setKeyFeedback({ type: 'success', msg: 'API Key সফলভাবে যুক্ত ও যাচাই হয়েছে ✅' });
        setInputApiKey('');
        setQuotaExceeded(false);
        fetchAgentStatus();
      } else {
        setKeyFeedback({ type: 'error', msg: data.error || 'Key টি সঠিক নয় বা মেয়াদ উত্তীর্ণ।' });
      }
    } catch (e: any) {
      setKeyFeedback({ type: 'error', msg: 'সার্ভারে সংযোগ বিচ্ছিন্ন হয়েছে।' });
    } finally {
      setKeySaveLoading(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!madrasah?.id) return;
    if (!confirm('আপনি কি নিজস্ব API Key মুছে দিয়ে ডিফল্ট শেয়ার্ড মোডে ফিরে যেতে চান?')) return;

    setKeySaveLoading(true);
    try {
      const res = await fetch(`/api/agent/settings/key?instituteId=${madrasah.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setKeyFeedback({ type: 'success', msg: 'API Key মুছে ফেলা হয়েছে এবং শেয়ার্ড মোড সক্রিয় হয়েছে।' });
        fetchAgentStatus();
      }
    } catch (e) {
      console.error('Delete key error:', e);
    } finally {
      setKeySaveLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setLastPendingCall(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 pt-3 pb-24 sm:p-5 md:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Centered Floating Modal Popup (Raised above mobile bottom nav bar) */}
      <div 
        className={`relative z-10 w-full max-w-xl sm:max-w-2xl h-[calc(100dvh-7.5rem)] sm:h-[86vh] max-h-[720px] rounded-3xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border transition-all duration-300 animate-in zoom-in-95 ${
          isDark 
            ? 'bg-[#0A0F1E] border-slate-800 text-slate-100 shadow-[0_25px_70px_rgba(0,0,0,0.8)]' 
            : 'bg-white border-slate-200/90 text-slate-800 shadow-[0_25px_70px_rgba(30,58,138,0.15)]'
        }`}
      >
        {/* Top Header Bar */}
        <div className={`px-4 py-3 sm:px-5 sm:py-3.5 border-b flex items-center justify-between shrink-0 transition-colors ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' 
            : 'bg-slate-50/95 border-slate-200 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* 3D Mascot Character Avatar */}
            <DeenoraMascotAvatar size={34} thinking={loading} />
            
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className={`font-black text-sm sm:text-base tracking-tight font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Deenora AI
                </h3>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-md font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-2xs">
                  সহকারী
                </span>
                <span className="flex items-center gap-1 text-[9.5px] font-solaiman text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>সক্রিয়</span>
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-solaiman truncate">
                {agentStatus.mode === 'byok' 
                  ? 'আপনার নিজস্ব API Key সক্রিয় (আনলিমিটেড) ⚡'
                  : `ফ্রি কোটা বাকি: ${agentStatus.shared_usage?.remaining ?? 50}/${agentStatus.shared_usage?.daily_cap ?? 50}`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* New Chat Button */}
            {messages.length > 0 && activeTab === 'chat' && (
              <button
                onClick={handleNewChat}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="নতুন চ্যাট"
              >
                <Plus size={17} />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
              }`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quota Exceeded Banner */}
        {quotaExceeded && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs flex items-center justify-between font-solaiman">
            <span>⚠️ আজকের ফ্রি ব্যবহারের লিমিট শেষ হয়েছে। আগামীকাল আবার চেষ্টা করুন।</span>
          </div>
        )}

        {/* ========================================================
            TAB 1: CHAT
            ======================================================== */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Messages Scroll Area */}
            <div className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 ${
              isDark ? 'bg-slate-900/30' : 'bg-slate-50/50'
            }`}>
              
              {/* Empty / Welcome Hero State */}
              {messages.length === 0 && (
                <div className="my-auto py-4 sm:py-6 text-center flex flex-col items-center justify-center animate-in fade-in duration-300">
                  {/* Live Animated Mascot Typing on Laptop */}
                  <div className="relative mb-2 flex items-center justify-center">
                    <AnimatedTypingMascot size={145} isDark={isDark} />
                  </div>

                  <h2 className={`text-xl sm:text-2xl font-black font-solaiman tracking-tight ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}>
                    Deenora AI-তে স্বাগতম
                  </h2>
                  <p className={`text-xs sm:text-sm font-solaiman max-w-sm mt-1 leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    ছাত্র, ফি, হাজিরা, পরীক্ষা, নোটিশ — বাংলায় নির্দেশ দিন, বাকিটা আমি পরিচালনা করছি।
                  </p>

                  {/* Suggestion Chips */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md text-left font-solaiman">
                    {QUICK_SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(s.replace(/^[^\s]+\s/, ''))}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 group ${
                          isDark 
                            ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white' 
                            : 'border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 shadow-2xs'
                        }`}
                      >
                        <span className="text-base group-hover:scale-110 transition-transform">
                          {s.split(' ')[0]}
                        </span>
                        <span className="truncate">{s.replace(/^[^\s]+\s/, '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Render Messages */}
              {messages.map((m) => {
                const isUser = m.role === 'user';

                // User Bubble
                if (isUser) {
                  return (
                    <div key={m.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="max-w-[85%] sm:max-w-[75%] space-y-1">
                        <div className="p-3.5 sm:p-4 rounded-2xl rounded-tr-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-xs sm:text-sm font-solaiman leading-relaxed shadow-md">
                          {m.text}
                        </div>
                        <div className="text-[9.5px] text-slate-400 text-right px-1 font-mono">{m.time}</div>
                      </div>
                    </div>
                  );
                }

                // AI Responses (Dedicated Component Cards)
                return (
                  <div key={m.id} className="flex items-start gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <DeenoraMascotAvatar size={30} success={m.type === 'result'} className="shrink-0 mt-0.5" />
                    <div className="flex-1 max-w-[92%] sm:max-w-[85%] space-y-1">
                      
                      {/* 1. Normal Text Bubble */}
                      {m.type === 'text' && (
                        <div className={`relative group p-3.5 sm:p-4 rounded-2xl rounded-tl-xs border text-xs sm:text-sm font-solaiman leading-relaxed shadow-xs ${
                          isDark 
                            ? 'bg-slate-800/80 border-slate-700/80 text-slate-100' 
                            : 'bg-white border-slate-200/90 text-slate-800 shadow-sm'
                        }`}>
                          <div className="whitespace-pre-wrap">{m.text}</div>
                          {m.text && (
                            <button
                              onClick={() => handleCopy(m.id, m.text!)}
                              className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-[10px] flex items-center gap-1 ${
                                isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title="কপি করুন"
                            >
                              {copiedId === m.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              <span>{copiedId === m.id ? 'কপি হয়েছে' : 'কপি'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* 2. Tool Timeline Card */}
                      {m.type === 'tool_timeline' && (
                        <div className={`p-4 rounded-2xl rounded-tl-xs border shadow-sm space-y-2.5 font-solaiman ${
                          isDark ? 'bg-cyan-950/20 border-cyan-800/40 text-slate-200' : 'bg-cyan-50/80 border-cyan-200 text-slate-800'
                        }`}>
                          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                            <span>লাইভ কার্যক্রম সম্পন্ন হচ্ছে</span>
                          </div>
                          <div className="space-y-2">
                            {(m.steps || []).map((st, i) => (
                              <div key={i} className={`flex items-start gap-2 text-xs p-2.5 rounded-xl border ${
                                isDark 
                                  ? (st.status === 'working' ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse' : 'bg-black/30 border-white/5')
                                  : (st.status === 'working' ? 'bg-cyan-100/70 border-cyan-300 animate-pulse' : 'bg-white border-cyan-100')
                              }`}>
                                <span>{st.status === 'done' ? '✅' : '⏳'}</span>
                                <div>
                                  <p className="font-bold">{st.label}</p>
                                  {st.detail && <p className="text-[11px] opacity-75 mt-0.5">{st.detail}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Confirmation Card (Amber border, Action summary, Lime Yes / Ghost Cancel) */}
                      {m.type === 'confirmation' && (
                        <div className={`p-4 sm:p-5 rounded-2xl rounded-tl-xs border-2 shadow-md space-y-3 font-solaiman ${
                          isDark ? 'bg-amber-950/20 border-amber-500/60 text-slate-100' : 'bg-amber-50 border-amber-300 text-slate-900'
                        }`}>
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                            <AlertCircle size={16} />
                            <span>অ্যাকশন নিশ্চিতকরণ প্রয়োজন</span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold whitespace-pre-wrap leading-relaxed">
                            {m.summary}
                          </p>
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              onClick={handleConfirmAction}
                              disabled={loading}
                              className="flex-1 py-2.5 px-4 bg-[#A3E635] hover:bg-lime-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check size={14} />
                              <span>✅ হ্যাঁ, করো</span>
                            </button>
                            <button
                              onClick={handleCancelAction}
                              disabled={loading}
                              className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                            >
                              বাতিল
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 4. Receipt-style Result Card */}
                      {m.type === 'result' && (
                        <div className={`p-4 sm:p-5 rounded-2xl rounded-tl-xs border shadow-lg space-y-3 font-solaiman ${
                          isDark ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100' : 'bg-emerald-50/80 border-emerald-200 text-slate-900'
                        }`}>
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                            <h4 className="font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400">{m.title}</h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                              সফল
                            </span>
                          </div>
                          {m.rows && m.rows.length > 0 && (
                            <div className={`space-y-1.5 p-3 rounded-xl border ${
                              isDark ? 'bg-black/30 border-white/5' : 'bg-white border-emerald-100'
                            }`}>
                              {m.rows.map(([k, v], i) => (
                                <div key={i} className="flex justify-between text-xs py-1 border-b border-emerald-500/10 last:border-0">
                                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                                  <span className="font-bold font-mono">{v}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {m.text && <p className="text-xs opacity-90 leading-relaxed">{m.text}</p>}
                        </div>
                      )}

                      {/* 5. Clarification Card */}
                      {m.type === 'clarification' && (
                        <div className={`p-4 rounded-2xl rounded-tl-xs border shadow-sm space-y-3 font-solaiman ${
                          isDark ? 'bg-indigo-950/20 border-indigo-500/40 text-slate-100' : 'bg-indigo-50/80 border-indigo-200 text-slate-900'
                        }`}>
                          <p className="text-xs sm:text-sm font-bold">{m.question}</p>
                          <div className="flex flex-wrap gap-2">
                            {(m.options || []).map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => handleSendMessage(opt.label)}
                                className={`px-3.5 py-2 rounded-full border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                                  isDark 
                                    ? 'bg-indigo-600/30 hover:bg-indigo-600 border-indigo-500/40 text-indigo-300 hover:text-white' 
                                    : 'bg-white hover:bg-indigo-600 border-indigo-300 text-indigo-700 hover:text-white shadow-2xs'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 6. Error Card */}
                      {m.type === 'error' && (
                        <div className="p-3.5 rounded-2xl rounded-tl-xs bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-solaiman space-y-2">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertCircle size={15} />
                            <span>{m.message}</span>
                          </div>
                          <button
                            onClick={() => {
                              const lastUserText = messages.filter(msg => msg.role === 'user').slice(-1)[0]?.text;
                              if (lastUserText) handleSendMessage(lastUserText);
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw size={12} />
                            <span>পুনরায় চেষ্টা করুন</span>
                          </button>
                        </div>
                      )}

                      <div className="text-[9.5px] text-slate-400 px-1 font-mono">{m.time}</div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {loading && (
                <div className="flex items-center gap-2.5 animate-in fade-in duration-200">
                  <DeenoraMascotAvatar size={30} thinking={true} className="shrink-0" />
                  <div className={`px-4 py-2.5 rounded-2xl rounded-tl-xs border text-xs font-solaiman flex items-center gap-2 ${
                    isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                  }`}>
                    <span>AI চিন্তা করছে</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Horizontal Scroll (when messages exist) */}
            {messages.length > 0 && messages.length <= 4 && (
              <div className={`px-3 py-2 border-t border-b overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0 font-solaiman ${
                isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-100/80'
              }`}>
                <span className="text-[10px] uppercase font-mono text-amber-500 font-bold px-1 shrink-0 flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>পরামর্শ:</span>
                </span>
                {QUICK_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s.replace(/^[^\s]+\s/, ''))}
                    disabled={loading}
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isDark 
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-indigo-500' 
                        : 'border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-2xs'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Sticky Input Bar */}
            <div className={`p-3 sm:p-4 border-t shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white'
            }`}>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className={`relative flex items-center gap-2 border rounded-full p-1.5 pl-3.5 focus-within:ring-2 focus-within:ring-blue-500/30 transition-all ${
                  isDark ? 'bg-slate-950/70 border-slate-800 focus-within:border-indigo-500' : 'bg-slate-50 border-slate-300 focus-within:border-blue-500'
                }`}
              >
                {/* Visual Mic Button */}
                <button
                  type="button"
                  onClick={() => alert('ভয়েস ইনপুট ফিচারটি শীঘ্রই যুক্ত করা হচ্ছে!')}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                  }`}
                  title="ভয়েস ইনপুট"
                >
                  <Mic size={16} />
                </button>

                {/* Auto Input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="কিছু জিজ্ঞেস করো বা কমান্ড দাও…"
                  disabled={loading}
                  className={`flex-1 bg-transparent border-none text-xs sm:text-sm font-solaiman focus:outline-none ${
                    isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                  }`}
                />

                {/* Clear text icon */}
                {inputMessage && (
                  <button
                    type="button"
                    onClick={() => setInputMessage('')}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-30 text-white flex items-center justify-center shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="মেসেজ পাঠান"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: SETTINGS (BYOK & Quota)
            ======================================================== */}
        {activeTab === 'settings' && (
          <div className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 font-solaiman ${
            isDark ? 'bg-slate-900/40' : 'bg-slate-50/50'
          }`}>
            <div>
              <h4 className={`font-black text-sm font-solaiman ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                AI Agent API Key সেটিংস (Dual-Mode)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                প্রতিষ্ঠান চাইলে নিজের ফ্রি Gemini API Key দিয়ে আনলিমিটেড প্রশ্ন করতে পারবে অথবা ডিফল্ট শেয়ার্ড ফ্রি লিমিট ব্যবহার করতে পারবে।
              </p>
            </div>

            {/* Mode Status Card */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">বর্তমান মোড:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  agentStatus.mode === 'byok'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                }`}>
                  <CheckCircle2 size={13} />
                  <span>{agentStatus.mode === 'byok' ? 'নিজস্ব কী (BYOK) - আনলিমিটেড' : 'শেয়ার্ড মোড (দৈনিক ৫০ প্রশ্ন)'}</span>
                </span>
              </div>

              {agentStatus.has_custom_key ? (
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400">সংরক্ষিত Key:</p>
                    <code className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{agentStatus.masked_key}</code>
                  </div>
                  <button
                    onClick={handleDeleteApiKey}
                    disabled={keySaveLoading}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer active:scale-95"
                    title="Key মুছুন"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400">আজকের ব্যবহৃত ফ্রি কোটা:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">
                      {agentStatus.shared_usage?.today_used || 0} / {agentStatus.shared_usage?.daily_cap || 50}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (((agentStatus.shared_usage?.today_used || 0) / (agentStatus.shared_usage?.daily_cap || 50)) * 100))}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Set Custom Key Form */}
            <div className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center gap-2">
                <Key size={16} className="text-blue-600 dark:text-blue-400" />
                <h5 className={`text-xs font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {agentStatus.has_custom_key ? 'নতুন API Key দিয়ে পরিবর্তন করুন' : 'নিজস্ব ফ্রি Gemini API Key যুক্ত করুন'}
                </h5>
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    disabled={keySaveLoading}
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark 
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showKeyText ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {keyFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    keyFeedback.type === 'success' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  }`}>
                    {keyFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{keyFeedback.msg}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  disabled={keySaveLoading || !inputApiKey.trim()}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 disabled:opacity-40 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {keySaveLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>যাচাই ও সংরক্ষণ করুন</span>
                </button>
              </div>
            </div>

            {/* Bangla Step-by-Step Setup Guide */}
            <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
              isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-blue-50/60 border-blue-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-2 font-black text-blue-600 dark:text-blue-400">
                <HelpCircle size={15} />
                <span>নিজের ফ্রি API key তৈরি করবেন যেভাবে:</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed opacity-85">
                <li>
                  <a 
                    href="https://aistudio.google.com" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 font-bold underline inline-flex items-center gap-1"
                  >
                    <span>aistudio.google.com</span>
                    <ExternalLink size={11} />
                  </a>
                  -এ আপনার Gmail দিয়ে লগইন করুন।
                </li>
                <li>বাম পাশের মেনু থেকে <strong>Get API Key</strong> এ ক্লিক করে <strong>Create API key</strong> চাপুন।</li>
                <li>যে গোপন Key-টি দেখাবে সেটি কপি করুন।</li>
                <li>উপরের বক্সে পেস্ট করে <strong>যাচাই ও সংরক্ষণ</strong> বাটনে চাপ দিন।</li>
              </ol>
              <div className="flex items-center gap-1.5 text-[10px] opacity-75 pt-1">
                <Info size={12} className="shrink-0 text-blue-500" />
                <span>নিজস্ব Key যুক্ত না করলেও প্রতিদিন ৫০টি ফ্রি কমান্ড পাবেন।</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spinClockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spinCounterClockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes coreGlowPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.6)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 14px rgba(34, 211, 238, 0.85)); }
        }
        @keyframes coreThinkingPulse {
          0%, 100% { transform: scale(0.96); filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.8)); }
          50% { transform: scale(1.16); filter: drop-shadow(0 0 20px rgba(34, 211, 238, 1)); }
        }
      `}</style>
    </div>
  );
};

export default AdminAiAgentDrawer;
