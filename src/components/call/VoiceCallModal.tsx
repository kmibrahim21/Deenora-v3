import React, { useEffect, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Grid,
  GraduationCap,
  User,
  Minimize2,
  Maximize2,
  X,
  Lock,
  Sparkles,
  Info
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
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [keypadDigits, setKeypadDigits] = useState<string>('');
  const [showStudentDetails, setShowStudentDetails] = useState<boolean>(false);

  // Prevent background scrolling while in full-screen call mode
  useEffect(() => {
    if (status !== 'idle' && !isMinimized) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [status, isMinimized]);

  // Reset states when call terminates
  useEffect(() => {
    if (status === 'idle') {
      setIsMinimized(false);
      setShowKeypad(false);
      setKeypadDigits('');
      setShowStudentDetails(false);
    }
  }, [status]);

  // Defense-in-depth: If native call UI mode is active and user role is parent/guardian, do NOT render web modal
  const isNativeUi =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('native_ui') === '1' ||
      (window as any).__nativeCallUi === true ||
      (window as any).__NATIVE_UI_MODE__ === true ||
      (window as any).AndroidInterface?.isNativeCallUi?.() === true ||
      (window as any).AndroidInterface?.isNativeUi?.() === true ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('deenora_native_ui') === '1'));

  const isParentRole =
    !isCaller ||
    (typeof window !== 'undefined' &&
      (Boolean(localStorage.getItem('parent_session')) ||
        Boolean(localStorage.getItem('parent_phone')) ||
        (() => {
          try {
            const u = localStorage.getItem('user_profile');
            return u ? JSON.parse(u).role === 'parent' : false;
          } catch {
            return false;
          }
        })()));

  if (status === 'idle' || !callData || (isNativeUi && isParentRole && !isCaller)) return null;

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const student = callData.student || { id: '', name: 'শিক্ষার্থী' };
  const caller = callData.caller || { id: '', name: 'মাদরাসা' };
  const isIncoming = status === 'incoming' && !isCaller;

  const isGenericOrEmail = (str?: string) => {
    if (!str) return true;
    const s = str.trim().toLowerCase();
    return (
      s === 'user' ||
      s === 'user-caller' ||
      s === 'admin-user' ||
      s === 'parent-user' ||
      s === 'admin' ||
      s === 'teacher' ||
      s.includes('@') ||
      s.includes('gmail') ||
      s.includes('.com')
    );
  };

  const rawInstName = callData.institutionName || caller?.institutionName || '';
  const displayInstName = isGenericOrEmail(rawInstName) ? 'শিক্ষা প্রতিষ্ঠান' : rawInstName.trim();
  const callerPersonName = !isGenericOrEmail(caller?.name) ? caller?.name?.trim() : '';

  const getInitials = (name?: string) => {
    if (!name) return 'DH';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const playTone = (digit: string) => {
    setKeypadDigits((prev) => (prev.length < 16 ? prev + digit : prev));
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 400 + (digit.charCodeAt(0) % 10) * 80;
        gain.gain.value = 0.08;
        osc.start();
        setTimeout(() => {
          osc.stop();
          ctx.close();
        }, 120);
      }
    } catch {}
  };

  // 1. MINIMIZED FLOATING VIEW (Compact Dock)
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[99999] animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center gap-3.5 px-4 py-3 rounded-3xl bg-[#071B36]/95 border border-white/10 shadow-2xl backdrop-blur-2xl text-white ring-1 ring-white/10">
          {/* Mini Avatar */}
          <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 overflow-hidden flex items-center justify-center shrink-0 font-bold text-sm shadow-md">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span>{getInitials(student.name)}</span>
            )}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#071B36] ${
                status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-ping'
              }`}
            />
          </div>

          {/* Mini Info */}
          <div className="flex flex-col min-w-[120px]">
            <span className="text-xs font-bold font-noto truncate max-w-[150px]">{student.name}</span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              {status === 'connected'
                ? formatDuration(duration)
                : status === 'ringing'
                ? 'রিং বাজছে...'
                : status === 'busy'
                ? 'ব্যস্ত আছেন'
                : 'কল হচ্ছে...'}
            </span>
          </div>

          {/* Controls */}
          {status === 'connected' && (
            <button
              onClick={onToggleMute}
              className={`p-2.5 rounded-full transition-all border ${
                isMuted ? 'bg-white text-[#10233F] border-white' : 'bg-white/10 text-white border-white/20'
              }`}
              title={isMuted ? 'আনমিউট' : 'মিউট'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button
            onClick={status === 'incoming' ? onReject : onEnd}
            className="p-2.5 rounded-full bg-[#EF4444] text-white hover:bg-red-600 transition-all shadow-md shadow-red-500/30"
            title="কল শেষ করুন"
          >
            <PhoneOff size={16} />
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-2.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all ml-1"
            title="ফুল স্ক্রিন"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  // 2. ADMIN CONNECTED CALL SCREEN (matches ScreenConnected from prototype)
  if (status === 'connected') {
    return (
      <div className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen bg-gradient-to-b from-[#071B36] to-[#1a4185] text-white flex flex-col items-center justify-between py-10 px-6 select-none animate-in fade-in duration-300 overflow-hidden">
        
        {/* Top Header Controls (Minimize & Encryption Badge) */}
        <div className="w-full flex items-center justify-between max-w-md pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-[11px] text-white/80 font-medium">
            <Lock size={12} className="text-emerald-400" />
            <span>HD Voice Encrypted</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStudentDetails((prev) => !prev)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white transition-all text-xs flex items-center gap-1"
              title="শিক্ষার্থীর তথ্য"
            >
              <Info size={16} />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white transition-all"
              title="মিনিমাইজ"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Student Quick Details Overlay (if expanded) */}
        {showStudentDetails && (
          <div className="w-full max-w-sm rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200 text-xs mt-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <span className="font-bold text-[#60A5FA] flex items-center gap-1.5">
                <Sparkles size={14} /> শিক্ষার্থী পরিচিতি
              </span>
              <button onClick={() => setShowStudentDetails(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="space-y-1.5 text-white/90">
              <p><span className="text-white/60">শ্রেণি:</span> {student.class_name || 'N/A'}</p>
              <p><span className="text-white/60">রোল:</span> {student.roll || 'N/A'}</p>
              <p><span className="text-white/60">অভিভাবক:</span> {student.guardian_name || 'N/A'}</p>
              <p><span className="text-white/60">মোবাইল:</span> <span className="font-mono">{student.guardian_phone || callData.calleePhone || 'N/A'}</span></p>
            </div>
          </div>
        )}

        {/* Center: Avatar, Student Name, Class/Roll, and Digital Timer Pill */}
        <div className="flex flex-col items-center mt-4 sm:mt-8">
          {/* Avatar (lg: w-24 h-24 text-3xl) */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-3xl shadow-xl overflow-hidden border-2 border-white/20 shrink-0">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span>{getInitials(student.name)}</span>
            )}
          </div>

          <h2 className="text-white text-2xl font-semibold mt-4 mb-1 text-center font-noto">
            {student.name || 'শিক্ষার্থী'}
          </h2>

          <p className="text-white/60 text-sm mb-4 font-noto">
            {student.class_name ? `${student.class_name}` : ''}
            {student.class_name && student.roll ? ' • ' : ''}
            {student.roll ? `Roll ${student.roll}` : ''}
          </p>

          {/* Timer Pill */}
          <div className="bg-white/10 px-5 py-1.5 rounded-full backdrop-blur-sm border border-white/10 flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-white font-mono text-lg tracking-wider font-bold">
              {formatDuration(duration)}
            </p>
          </div>
        </div>

        {/* Optional Interactive DTMF Keypad Drawer */}
        {showKeypad && (
          <div className="w-full max-w-[280px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 duration-200 my-2">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span className="text-xs text-white/60 font-mono tracking-wider min-h-[18px]">
                {keypadDigits || 'Dial DTMF'}
              </span>
              <button
                onClick={() => {
                  setShowKeypad(false);
                  setKeypadDigits('');
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  onClick={() => playTone(d)}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-base transition-colors active:scale-95"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3-Column Action Grid: Mute, Keypad, Speaker */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-8 gap-x-4 mb-6">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-md active:scale-90 ${
                isMuted ? 'bg-white text-[#10233F]' : 'bg-white/20 text-white backdrop-blur hover:bg-white/30'
              }`}
              title={isMuted ? 'আনমিউট' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className="text-white/70 text-xs font-noto">{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          {/* Keypad */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setShowKeypad((prev) => !prev)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-md active:scale-90 ${
                showKeypad ? 'bg-white text-[#10233F]' : 'bg-white/20 text-white backdrop-blur hover:bg-white/30'
              }`}
              title="Keypad"
            >
              <Grid className="w-6 h-6" />
            </button>
            <span className="text-white/70 text-xs font-noto">Keypad</span>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleSpeaker}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-md active:scale-90 ${
                isSpeakerOn ? 'bg-white text-[#10233F]' : 'bg-white/20 text-white backdrop-blur hover:bg-white/30'
              }`}
              title={isSpeakerOn ? 'স্পিকার' : 'ইয়ারপিস'}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <span className="text-white/70 text-xs font-noto">{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
          </div>
        </div>

        {/* Bottom Red End Call Button */}
        <div className="mb-4 w-full flex justify-center">
          <button
            onClick={onEnd}
            className="w-20 h-20 bg-[#EF4444] rounded-full flex items-center justify-center shadow-[0_0_24px_rgba(239,68,68,0.45)] hover:bg-red-600 transition-colors active:scale-95"
            title="কল শেষ করুন"
          >
            <PhoneOff className="text-white w-10 h-10" />
          </button>
        </div>
      </div>
    );
  }

  // 3. ADMIN OUTGOING CALL SCREEN (matches ScreenAdminOutgoing from prototype)
  // Handles: 'calling', 'ringing', 'connecting', 'reconnecting', and terminal states
  if (isCaller || (!isIncoming && status !== 'incoming')) {
    const isTerminated = status === 'rejected' || status === 'ended' || status === 'busy' || status === 'failed';
    const statusText =
      status === 'ringing'
        ? 'অভিভাবকের ফোনে রিং বাজছে... (Ringing)'
        : status === 'connecting'
        ? 'সংযোগ স্থাপন হচ্ছে... (Connecting)'
        : status === 'reconnecting'
        ? 'পুনরায় সংযোগ করা হচ্ছে... (Reconnecting)'
        : status === 'busy'
        ? 'অভিভাবক অন্য কলে ব্যস্ত আছেন (Busy)'
        : status === 'rejected'
        ? 'কলটি কেটে দেওয়া হয়েছে (Declined)'
        : status === 'ended'
        ? 'কল সমাপ্ত হয়েছে (Call Ended)'
        : status === 'failed'
        ? 'সংযোগ স্থাপন ব্যর্থ হয়েছে (Failed)'
        : 'Calling guardian...';

    return (
      <div className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen bg-gradient-to-b from-[#071B36] to-[#2563EB] text-white flex flex-col items-center justify-between py-10 px-6 select-none animate-in fade-in duration-300 overflow-hidden">
        
        {/* Top Bar with Minimal Controls */}
        <div className="w-full flex items-center justify-between max-w-md pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-[11px] text-white/80 font-medium">
            <Lock size={12} className="text-emerald-400" />
            <span>End-to-End Secure Call</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStudentDetails((prev) => !prev)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white transition-all text-xs flex items-center gap-1"
              title="শিক্ষার্থীর তথ্য"
            >
              <Info size={16} />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white transition-all"
              title="মিনিমাইজ"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Student Quick Profile Summary (if toggled) */}
        {showStudentDetails && (
          <div className="w-full max-w-sm rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200 text-xs mt-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <span className="font-bold text-[#60A5FA] flex items-center gap-1.5">
                <Sparkles size={14} /> শিক্ষার্থী পরিচিতি
              </span>
              <button onClick={() => setShowStudentDetails(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="space-y-1.5 text-white/90">
              <p><span className="text-white/60">শ্রেণি:</span> {student.class_name || 'N/A'}</p>
              <p><span className="text-white/60">রোল:</span> {student.roll || 'N/A'}</p>
              <p><span className="text-white/60">অভিভাবক:</span> {student.guardian_name || 'N/A'}</p>
              <p><span className="text-white/60">মোবাইল:</span> <span className="font-mono">{student.guardian_phone || callData.calleePhone || 'N/A'}</span></p>
            </div>
          </div>
        )}

        {/* Center Section: Calling Status, Ripple Avatar, Student Info & Guardian Card */}
        <div className="flex flex-col items-center mt-6 w-full max-w-sm">
          {/* Status Label ("Calling guardian...") */}
          <p className="text-[#60A5FA] text-sm font-medium tracking-wide uppercase mb-8 text-center font-noto">
            {statusText}
          </p>

          {/* Ripple Avatar (xl: w-32 h-32 text-4xl) */}
          <div className="relative mb-6">
            {!isTerminated && (
              <>
                <div className="absolute inset-0 rounded-full bg-[#60A5FA] animate-ripple" />
                <div
                  className="absolute inset-0 rounded-full bg-[#60A5FA] animate-ripple"
                  style={{ animationDelay: '1s' }}
                />
              </>
            )}

            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-4xl shadow-2xl overflow-hidden border-2 border-white/25 shrink-0">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{getInitials(student.name)}</span>
              )}
            </div>
          </div>

          {/* Student Full Name */}
          <h2 className="text-white text-3xl font-bold mb-2 text-center font-noto tracking-tight">
            {student.name || 'শিক্ষার্থী'}
          </h2>

          {/* Class & Roll */}
          <p className="text-white/70 text-base mb-8 font-noto text-center">
            {student.class_name ? `${student.class_name}` : ''}
            {student.class_name && student.roll ? ' • ' : ''}
            {student.roll ? `রোল ${student.roll}` : ''}
          </p>

          {/* Guardian Glass Panel Card */}
          <div className="w-full rounded-2xl p-4 flex flex-col items-center gap-1 shadow-xl bg-white/10 backdrop-blur-md border border-white/20">
            <User className="text-[#60A5FA] w-6 h-6 mb-1" />
            <p className="text-white/90 font-medium font-noto text-center">
              {student.guardian_name || 'অভিভাবক'} (অভিভাবক)
            </p>
            <p className="text-white/60 text-sm font-mono tracking-widest mt-1">
              {student.guardian_phone || callData.calleePhone || 'N/A'}
            </p>
          </div>
        </div>

        {/* Bottom Red End Call Button */}
        <div className="mb-6">
          <button
            onClick={onEnd}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-[#EF4444] rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors active:scale-95"
            title="কল শেষ করুন"
          >
            <PhoneOff className="text-white w-8 h-8" />
          </button>
        </div>
      </div>
    );
  }

  // 4. PARENT INCOMING CALL SCREEN (Web fallback matching ScreenParentIncoming from prototype)
  return (
    <div className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen bg-gradient-to-b from-[#071B36] via-[#0a2347] to-[#071B36] text-white flex flex-col items-center justify-between py-14 px-6 select-none animate-in fade-in duration-300 overflow-hidden">
      
      {/* Top Header */}
      <div className="w-full flex items-center justify-end max-w-md pt-2">
        <button
          onClick={() => setIsMinimized(true)}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white transition-all"
          title="মিনিমাইজ"
        >
          <Minimize2 size={16} />
        </button>
      </div>

      {/* Center Details */}
      <div className="flex flex-col items-center mt-6 w-full max-w-sm">
        <p className="text-white/60 text-sm uppercase tracking-widest mb-10 font-noto">
          Incoming Call
        </p>

        {/* Institution Badge / Icon with Pulsing Effect */}
        <div className="w-28 h-28 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-2xl relative">
          <div className="absolute inset-0 rounded-3xl bg-white/10 animate-pulse" />
          <GraduationCap className="text-[#60A5FA] w-14 h-14" />
        </div>

        <h2 className="text-white text-3xl font-bold mb-3 text-center px-4 leading-tight font-noto">
          {displayInstName}
        </h2>

        {callerPersonName && (
          <p className="text-white/80 text-sm font-noto mb-1">
            {callerPersonName}
          </p>
        )}

        <p className="text-[#60A5FA] text-lg font-mono tracking-wider">
          {student.guardian_phone || callData.calleePhone || student.name || '09638-Deenora'}
        </p>
      </div>

      {/* Decline and Accept Buttons (Matching prototype: Red & Green) */}
      <div className="flex w-full justify-between max-w-xs px-4 mb-8">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onReject}
            className="w-[72px] h-[72px] bg-[#EF4444] rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-95 hover:bg-red-600 transition-all"
            title="কেটে দিন"
          >
            <PhoneOff className="text-white w-8 h-8" />
          </button>
          <span className="text-white/70 text-sm font-medium font-noto">Decline</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onAccept}
            className="w-[72px] h-[72px] bg-[#16A34A] rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 animate-bounce active:scale-95 hover:bg-green-700 transition-all"
            title="রিসিভ করুন"
          >
            <Phone className="text-white w-8 h-8 fill-current" />
          </button>
          <span className="text-white/70 text-sm font-medium font-noto">Accept</span>
        </div>
      </div>
    </div>
  );
};
