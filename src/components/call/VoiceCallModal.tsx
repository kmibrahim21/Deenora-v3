import React, { useEffect, useState } from 'react';
import { 
  Phone, 
  PhoneOff, 
  PhoneCall, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  User, 
  GraduationCap, 
  ShieldCheck, 
  Radio,
  Lock,
  Wifi,
  Minimize2,
  Maximize2,
  Info,
  Sparkles,
  PhoneForwarded,
  CheckCircle2
} from 'lucide-react';
import { CallPayload, CallStatus } from '../../services/callService';

interface VoiceCallModalProps {
  status: CallStatus;
  callData: CallPayload | null;
  isCaller: boolean;
  duration: number;
  isMuted: boolean;
  isSpeakerOn?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker?: () => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  status,
  callData,
  isCaller,
  duration,
  isMuted,
  isSpeakerOn = true,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
}) => {
  // 24 animated wave bars for audio frequency effect
  const [waveHeights, setWaveHeights] = useState<number[]>([
    25, 45, 70, 35, 80, 55, 90, 65, 40, 85, 50, 95, 60, 45, 80, 35, 70, 55, 90, 40, 65, 30, 50, 20
  ]);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showStudentDetails, setShowStudentDetails] = useState<boolean>(false);

  // Prevent background scrolling while in full screen call mode
  useEffect(() => {
    if (status !== 'idle' && !isMinimized) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [status, isMinimized]);

  // Reset minimize state when call ends or changes
  useEffect(() => {
    if (status === 'idle') {
      setIsMinimized(false);
      setShowStudentDetails(false);
    }
  }, [status]);

  // Audio wave pulsation effect when connected
  useEffect(() => {
    if (status !== 'connected' || isMuted) return;
    const interval = setInterval(() => {
      setWaveHeights(prev => prev.map(() => Math.floor(Math.random() * 75) + 18));
    }, 130);
    return () => clearInterval(interval);
  }, [status, isMuted]);

  if (status === 'idle' || !callData) return null;

  // Suppress incoming web modal when Android Native Bridge handles incoming call UI
  const hasNativeBridge = typeof window !== 'undefined' && Boolean((window as any).AndroidInterface?.onIncomingCall);
  if (status === 'incoming' && !isCaller && hasNativeBridge) {
    return null;
  }

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const student = callData.student || { id: '', name: 'শিক্ষার্থী' };
  const caller = callData.caller || { id: '', name: 'মাদরাসা' };
  const isIncoming = status === 'incoming' && !isCaller;

  // Clean caller and institution name logic
  const isGenericOrEmail = (str?: string) => {
    if (!str) return true;
    const s = str.trim().toLowerCase();
    return s === 'user' || s === 'user-caller' || s === 'admin-user' || s === 'parent-user' || s === 'admin' || s === 'teacher' || s.includes('@') || s.includes('gmail') || s.includes('.com');
  };

  const rawInstName = callData.institutionName || caller?.institutionName || '';
  const displayInstName = isGenericOrEmail(rawInstName) ? 'শিক্ষা প্রতিষ্ঠান' : rawInstName.trim();
  const callerPersonName = !isGenericOrEmail(caller?.name) ? caller?.name?.trim() : '';

  const getStatusDisplay = () => {
    switch (status) {
      case 'connected':
        return {
          text: 'কথা বলা হচ্ছে (HD Voice Active)',
          dotClass: 'bg-emerald-400 animate-ping',
          badgeBorder: 'border-emerald-500/40 text-emerald-200',
        };
      case 'reconnecting':
        return {
          text: 'পুনরায় সংযোগ করা হচ্ছে... (Reconnecting)',
          dotClass: 'bg-amber-400 animate-ping',
          badgeBorder: 'border-amber-500/50 text-amber-200',
        };
      case 'calling':
        return {
          text: 'কল যাচ্ছে... (Calling)',
          dotClass: 'bg-blue-400 animate-pulse',
          badgeBorder: 'border-blue-500/40 text-blue-200',
        };
      case 'ringing':
        return {
          text: 'কল বাজছে... (Ringing)',
          dotClass: 'bg-emerald-400 animate-pulse',
          badgeBorder: 'border-emerald-500/40 text-emerald-200',
        };
      case 'connecting':
        return {
          text: 'সংযোগ স্থাপন হচ্ছে... (Connecting)',
          dotClass: 'bg-teal-400 animate-pulse',
          badgeBorder: 'border-teal-500/40 text-teal-200',
        };
      case 'incoming':
        return {
          text: 'ইনকামিং ভয়েস কল (Incoming Call)',
          dotClass: 'bg-blue-400 animate-pulse',
          badgeBorder: 'border-blue-500/40 text-blue-200',
        };
      case 'busy':
        return {
          text: 'অন্য কলে ব্যস্ত আছেন (Busy)',
          dotClass: 'bg-amber-500',
          badgeBorder: 'border-amber-500/60 text-amber-300',
        };
      case 'rejected':
        return {
          text: 'কলটি কেটে দেওয়া হয়েছে (Declined)',
          dotClass: 'bg-rose-500',
          badgeBorder: 'border-rose-500/50 text-rose-300',
        };
      case 'ended':
        return {
          text: 'কল সমাপ্ত হয়েছে (Call Ended)',
          dotClass: 'bg-rose-500',
          badgeBorder: 'border-rose-500/50 text-rose-300',
        };
      case 'failed':
        return {
          text: 'সংযোগ স্থাপন ব্যর্থ হয়েছে (Failed)',
          dotClass: 'bg-red-600',
          badgeBorder: 'border-red-500/60 text-red-300',
        };
      default:
        return {
          text: 'কল সক্রিয়',
          dotClass: 'bg-slate-400',
          badgeBorder: 'border-slate-600 text-slate-300',
        };
    }
  };

  const statusInfo = getStatusDisplay();

  // MINIMIZED PIP / DOCK VIEW
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[99999] animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center gap-3.5 px-4 py-3 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-2xl text-white ring-1 ring-white/10">
          {/* Mini Avatar */}
          <div className="relative w-11 h-11 rounded-full bg-slate-800 border border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-800 flex items-center justify-center text-white font-bold text-sm">
                {student.name ? student.name.charAt(0) : <User size={18} />}
              </div>
            )}
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
              status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-ping'
            }`} />
          </div>

          {/* Mini Info */}
          <div className="flex flex-col min-w-[120px]">
            <span className="text-xs font-bold font-noto truncate max-w-[150px]">{student.name}</span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              {status === 'connected'
                ? formatDuration(duration)
                : status === 'ringing'
                ? 'কল বাজছে...'
                : status === 'reconnecting'
                ? 'পুনরায় সংযোগ...'
                : status === 'busy'
                ? 'ব্যস্ত আছেন'
                : 'কল হচ্ছে...'}
            </span>
          </div>

          {/* Quick Controls */}
          {status === 'connected' && (
            <button
              onClick={onToggleMute}
              className={`p-2.5 rounded-full transition-all border ${
                isMuted ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title={isMuted ? 'আনমিউট করুন' : 'মিউট করুন'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button
            onClick={status === 'incoming' ? onReject : onEnd}
            className="p-2.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 border border-rose-400 transition-all shadow-md shadow-rose-600/30"
            title="কল শেষ করুন"
          >
            <PhoneOff size={16} />
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-2.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all ml-1"
            title="ফুল স্ক্রিন করুন"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  // FULL SCREEN IMMERSIVE CALLING LAYOUT
  return (
    <div className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-300">
      
      {/* Dynamic Ambient Background Illumination */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep background gradient layers */}
        <div className={`absolute inset-0 transition-colors duration-1000 ${
          status === 'connected'
            ? 'bg-gradient-to-b from-slate-950 via-[#071813] to-[#020b08]'
            : isIncoming
            ? 'bg-gradient-to-b from-slate-950 via-[#0a1829] to-[#030914]'
            : status === 'rejected' || status === 'ended'
            ? 'bg-gradient-to-b from-slate-950 via-[#1f0a0d] to-[#0b0304]'
            : 'bg-gradient-to-b from-slate-950 via-[#0f172a] to-[#020617]'
        }`} />

        {/* Ambient Glowing Orbs */}
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[160px] opacity-40 transition-all duration-1000 pointer-events-none ${
          status === 'connected'
            ? 'bg-emerald-600/35'
            : isIncoming
            ? 'bg-blue-600/40'
            : status === 'rejected' || status === 'ended'
            ? 'bg-rose-700/30'
            : 'bg-indigo-600/30'
        }`} />

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[140px] opacity-25 bg-blue-500/20 pointer-events-none" />

        {/* Subtle high-tech background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* TOP HEADER BAR */}
      <header className="relative z-10 w-full px-5 py-4 md:px-10 md:py-6 flex items-center justify-between border-b border-slate-800/40 bg-slate-950/40 backdrop-blur-md">
        {/* Left: Institution info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-slate-950/90 flex items-center justify-center">
              <GraduationCap size={20} className="text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm md:text-base font-bold font-noto text-white leading-tight">
                {displayInstName}
              </span>
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {isCaller ? 'মাদরাসা এডমিন ভয়েস পোর্টাল' : 'অভিভাবক ভয়েস সার্ভিস'}
            </p>
          </div>
        </div>

        {/* Center: HD Voice & Security Pill (Desktop & Tablet) */}
        <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/80 border border-slate-800/80 shadow-inner text-xs font-semibold text-slate-300">
          <Lock size={12} className="text-emerald-400" />
          <span>এন্ড-টু-এন্ড এনক্রিপ্টেড ভয়েস কল</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-0.5 text-emerald-400">
            <span className="w-1 h-2 bg-emerald-400 rounded-sm" />
            <span className="w-1 h-2.5 bg-emerald-400 rounded-sm" />
            <span className="w-1 h-3.5 bg-emerald-400 rounded-sm" />
            <span className="text-[10px] font-mono ml-1">HD</span>
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-2">
          {/* Quick info sheet toggle */}
          <button
            onClick={() => setShowStudentDetails(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold font-noto flex items-center gap-1.5 transition-all border ${
              showStudentDetails
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                : 'bg-slate-900/70 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title="শিক্ষার্থীর তথ্য দেখুন"
          >
            <Info size={15} />
            <span className="hidden sm:inline">শিক্ষার্থীর তথ্য</span>
          </button>

          {/* Minimize toggle */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 md:p-2.5 rounded-xl bg-slate-900/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all"
            title="মিনিমাইজ করুন (Compact view)"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </header>

      {/* STUDENT QUICK DETAILS OVERLAY DRAWER */}
      {showStudentDetails && (
        <div className="relative z-20 mx-auto w-full max-w-lg px-4 -mb-4 animate-in slide-in-from-top-4 duration-200">
          <div className="rounded-2xl bg-slate-900/95 border border-slate-700/80 p-4 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-400" />
                শিক্ষার্থী প্রোফাইল সামারি
              </span>
              <button
                onClick={() => setShowStudentDetails(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                বন্ধ করুন ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 text-[11px] block">শ্রেণি ও রোল</span>
                <span className="font-bold text-white font-noto">{student.class_name || 'নির্ধারিত নয়'} (রোল: {student.roll || 'N/A'})</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 text-[11px] block">অভিভাবকের মোবাইল</span>
                <span className="font-bold text-white font-mono">{student.guardian_phone || callData.calleePhone || 'N/A'}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 col-span-2">
                <span className="text-slate-400 text-[11px] block">অভিভাবকের নাম</span>
                <span className="font-bold text-white font-noto">{student.guardian_name || 'সম্মানিত অভিভাবক'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN HERO CENTER: AVATAR, NAME & AUDIO VISUALIZER */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-8 text-center max-w-2xl mx-auto w-full">
        
        {/* Dynamic Status Pill */}
        <div className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-slate-900/80 border text-xs md:text-sm font-semibold tracking-wide mb-6 md:mb-8 shadow-xl backdrop-blur-xl ${statusInfo.badgeBorder}`}>
          <span className={`w-3 h-3 rounded-full shadow-lg ${statusInfo.dotClass}`} />
          <span className="font-noto">
            {statusInfo.text}
          </span>
        </div>

        {/* Large Central Avatar with Dynamic Acoustic Waves */}
        <div className="relative mb-6 md:mb-8">
          {/* Animated concentric acoustic ripples when calling, ringing, or incoming */}
          {(status === 'calling' || status === 'ringing' || status === 'incoming' || status === 'reconnecting') && (
            <>
              <div className="absolute -inset-4 sm:-inset-6 md:-inset-8 rounded-full bg-blue-500/20 animate-ping duration-1000" />
              <div className="absolute -inset-8 sm:-inset-12 md:-inset-16 rounded-full border border-blue-400/30 animate-pulse duration-700" />
              <div className="absolute -inset-12 sm:-inset-16 md:-inset-24 rounded-full border border-indigo-500/15 animate-pulse duration-1000" />
            </>
          )}

          {/* Connected Voice Glow Rings */}
          {status === 'connected' && (
            <>
              <div className="absolute -inset-4 sm:-inset-6 rounded-full border-2 border-emerald-500/40 animate-pulse" />
              <div className="absolute -inset-8 sm:-inset-12 rounded-full border border-emerald-500/20 animate-ping duration-1000" />
            </>
          )}

          {/* Profile Photo Container */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-full bg-slate-900 border-4 border-slate-700/80 shadow-2xl shadow-black/80 overflow-hidden flex items-center justify-center ring-8 ring-slate-950/80">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.name}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-blue-700 via-indigo-800 to-slate-950 flex items-center justify-center text-white text-5xl md:text-6xl font-black font-noto">
                {student.name ? student.name.charAt(0) : <User size={64} />}
              </div>
            )}
          </div>
        </div>

        {/* Student Full Name & Information */}
        <div className="space-y-2 mb-6 w-full">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-noto tracking-tight drop-shadow-md">
            {student.name || 'শিক্ষার্থী'}
          </h2>

          <div className="flex items-center justify-center flex-wrap gap-2 text-xs md:text-sm text-slate-300 font-medium pt-1">
            {student.class_name && (
              <span className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800 shadow-sm">
                <GraduationCap size={15} className="text-blue-400" />
                <span className="font-noto">{student.class_name}</span>
              </span>
            )}
            {student.roll && (
              <span className="bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800 shadow-sm font-mono text-slate-200">
                রোল: {student.roll}
              </span>
            )}
          </div>

          {/* Context subtitle */}
          <div className="pt-2 text-xs md:text-sm text-slate-400">
            {isIncoming ? (
              <p className="flex items-center justify-center gap-2 text-blue-300 font-medium">
                <ShieldCheck size={16} className="text-blue-400 shrink-0" />
                <span>প্রতিষ্ঠান থেকে কল: <strong className="text-white">{displayInstName}{callerPersonName ? ` (${callerPersonName})` : ''}</strong></span>
              </p>
            ) : (
              <p className="text-slate-400">
                অভিভাবকের সাথে সংযোগ: <strong className="text-slate-200 font-noto">{student.guardian_name || student.guardian_phone || 'সম্মানিত অভিভাবক'}</strong>
                {student.guardian_phone && <span className="font-mono text-slate-400 ml-1.5">({student.guardian_phone})</span>}
              </p>
            )}
          </div>
        </div>

        {/* Connected State: Big Digital Timer & 24-Bar Audio Spectrum */}
        {status === 'connected' ? (
          <div className="w-full max-w-md bg-slate-950/80 rounded-3xl p-5 border border-slate-800/80 shadow-2xl backdrop-blur-2xl flex flex-col items-center gap-3.5 mb-2">
            
            {/* Big Monospace Timer */}
            <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tracking-widest drop-shadow-sm">
              {formatDuration(duration)}
            </div>

            {/* Dynamic 24-Bar Sound Visualizer */}
            <div className="flex items-center justify-center gap-1 md:gap-1.5 h-12 w-full px-2">
              {waveHeights.map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${isMuted ? 6 : h}%` }}
                  className={`w-1.5 md:w-2 rounded-full transition-all duration-150 ${
                    isMuted
                      ? 'bg-slate-800'
                      : 'bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-300 shadow-sm shadow-emerald-500/20'
                  }`}
                />
              ))}
            </div>

            {/* Audio Indicator Pills */}
            <div className="flex items-center gap-4 text-xs font-semibold pt-1">
              {isMuted ? (
                <span className="text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                  <MicOff size={13} /> মাইক্রোফোন মিউট
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  <Mic size={13} /> মাইক্রোফোন চালু
                </span>
              )}

              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                isSpeakerOn
                  ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                  : 'text-slate-400 bg-slate-800/40 border-slate-700/40'
              }`}>
                {isSpeakerOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {isSpeakerOn ? 'স্পিকার অন' : 'স্পিকার অফ'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs md:text-sm animate-pulse mb-2">
            {status === 'reconnecting' ? (
              <span className="text-amber-400 font-noto flex items-center gap-2">
                <Wifi size={16} className="animate-spin" />
                নেটওয়ার্ক স্যুইচিং - পুনরায় সংযোগ করা হচ্ছে...
              </span>
            ) : status === 'busy' ? (
              <span className="text-amber-400 font-noto flex items-center gap-2">
                <PhoneOff size={16} />
                অভিভাবক এই মুহূর্তে অন্য কলে ব্যস্ত আছেন
              </span>
            ) : status === 'ringing' ? (
              <span className="text-emerald-300 font-noto flex items-center gap-2">
                <Radio size={16} className="text-emerald-400 animate-spin" />
                অভিভাবকের ফোনে রিং বাজছে...
              </span>
            ) : isIncoming ? (
              <span className="text-blue-300 font-noto flex items-center gap-2">
                <Radio size={16} className="text-blue-400 animate-spin" />
                কল রিসিভ করতে নিচের সবুজ বাটনে চাপ দিন
              </span>
            ) : (
              <span className="text-slate-400 font-noto flex items-center gap-2">
                <Radio size={16} className="text-blue-400 animate-spin" />
                নেটওয়ার্ক সংযোগ স্থাপন করা হচ্ছে...
              </span>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM CONTROL SECTION / DIAL DECK */}
      <footer className="relative z-10 w-full px-6 py-6 md:px-12 md:py-8 flex flex-col items-center justify-center border-t border-slate-800/40 bg-slate-950/60 backdrop-blur-xl">
        {isIncoming ? (
          /* Incoming Call Actions: Accept or Reject */
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <div className="grid grid-cols-2 gap-8 md:gap-12 w-full">
              
              {/* Reject Button */}
              <button
                onClick={onReject}
                className="group flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-all"
              >
                <div className="w-20 h-20 md:w-22 md:h-22 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 flex items-center justify-center text-white shadow-2xl shadow-rose-600/50 border-2 border-rose-400/40 group-hover:scale-105 group-hover:shadow-rose-600/70 transition-all">
                  <PhoneOff size={32} />
                </div>
                <span className="font-noto font-bold text-sm text-rose-300">কেটে দিন</span>
              </button>

              {/* Accept Button */}
              <button
                onClick={onAccept}
                className="group flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-all"
              >
                <div className="w-20 h-20 md:w-22 md:h-22 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/60 border-2 border-emerald-300/40 animate-bounce group-hover:scale-105 transition-all">
                  <PhoneCall size={32} />
                </div>
                <span className="font-noto font-bold text-sm text-emerald-300">রিসিভ করুন</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 font-noto">
              কল রিসিভ করতে সবুজ বাটনে এবং বাতিল করতে লাল বাটনে চাপ দিন
            </p>
          </div>
        ) : (
          /* Calling / Connected Controls: Mute, Speaker & End Call */
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            <div className="flex items-center justify-center gap-6 sm:gap-8 w-full">
              
              {/* Mic Toggle Button */}
              {status === 'connected' && (
                <button
                  onClick={onToggleMute}
                  className={`group flex flex-col items-center gap-1.5 transition-all active:scale-90`}
                  title={isMuted ? 'আনমিউট করুন' : 'মিউট করুন'}
                >
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all border ${
                    isMuted
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xl shadow-amber-500/30'
                      : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800'
                  }`}>
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </div>
                  <span className="text-[11px] font-bold font-noto text-slate-300">
                    {isMuted ? 'আনমিউট' : 'মিউট'}
                  </span>
                </button>
              )}

              {/* End Call Button */}
              <button
                onClick={onEnd}
                className="group flex flex-col items-center gap-1.5 active:scale-90 hover:scale-105 transition-all"
                title="কল শেষ করুন"
              >
                <div className="w-20 h-20 md:w-22 md:h-22 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/60 border-2 border-rose-400/40">
                  <PhoneOff size={32} />
                </div>
                <span className="text-xs font-bold font-noto text-rose-300">কল শেষ করুন</span>
              </button>

              {/* Speaker Toggle Button */}
              {status === 'connected' && (
                <button
                  onClick={onToggleSpeaker}
                  className={`group flex flex-col items-center gap-1.5 transition-all active:scale-90`}
                  title={isSpeakerOn ? 'স্পিকার বন্ধ করুন' : 'স্পিকার চালু করুন'}
                >
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all border ${
                    isSpeakerOn
                      ? 'bg-blue-600 text-white border-blue-400 shadow-xl shadow-blue-600/30 ring-2 ring-blue-500/20'
                      : 'bg-slate-900/90 text-slate-400 border-slate-700/80 hover:bg-slate-800'
                  }`}>
                    {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                  </div>
                  <span className="text-[11px] font-bold font-noto text-slate-300">
                    {isSpeakerOn ? 'স্পিকার অন' : 'স্পিকার অফ'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
