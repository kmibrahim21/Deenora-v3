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
  Minimize2,
  Maximize2,
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

  if (status === 'idle' || !callData) return null;

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const student = callData.student || { id: '', name: 'শিক্ষার্থী' };
  const caller = callData.caller || { id: '', name: 'মাদরাসা' };
  const effectiveIsCaller = Boolean(isCaller && callData?.role !== 'callee' && callData?.isCaller !== false);

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
  const displayInstName = isGenericOrEmail(rawInstName) ? 'Deenora Madrasa' : rawInstName.trim();
  const callerPersonName = !isGenericOrEmail(caller?.name) ? caller?.name?.trim() : '';

  const getInitials = (name?: string) => {
    if (!name) return 'DM';
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

  // Primary & secondary titles matching Design 1
  const primaryTitle = effectiveIsCaller
    ? student.name || 'শিক্ষার্থী'
    : callerPersonName || displayInstName;

  const secondarySubtitle = effectiveIsCaller
    ? `${student.guardian_name || 'অভিভাবক'}${student.class_name ? ` • ${student.class_name}` : ''}`
    : callerPersonName
    ? displayInstName
    : student.name
    ? `শিক্ষার্থী: ${student.name}`
    : 'মাদরাসা ভয়েস কল';

  const statusLineText =
    status === 'connected'
      ? `Deenora Voice Call • ${formatDuration(duration)}`
      : status === 'ringing'
      ? 'Deenora Voice Call • Ringing...'
      : status === 'connecting' || status === 'reconnecting'
      ? 'Deenora Voice Call • Connecting...'
      : status === 'busy'
      ? 'Deenora Voice Call • Busy'
      : status === 'rejected'
      ? 'Deenora Voice Call • Declined'
      : status === 'ended'
      ? 'Deenora Voice Call • Ended'
      : status === 'failed'
      ? 'Deenora Voice Call • Failed'
      : 'Deenora Voice Call • Ringing...';

  // 1. FLOATING NOTIFICATION BANNER (Design 1 Top Card Style when Minimized)
  if (isMinimized) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[94%] max-w-[400px] animate-in slide-in-from-top-5 duration-300">
        <div className="flex items-center gap-3.5 px-4 py-3.5 rounded-[24px] bg-gradient-to-br from-[#D8E8E3]/95 via-[#C3DCD4]/95 to-[#B2CFC6]/95 border border-white/70 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl text-[#042F26]">
          {/* Left Avatar with Green Call Badge */}
          <div className="relative w-14 h-14 shrink-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#0A3F32] to-[#04241C] border border-[#6EE7B7]/40 overflow-hidden flex items-center justify-center text-[#6EE7B7] font-bold text-base shadow-md">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={primaryTitle}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <GraduationCap className="w-7 h-7 text-[#6EE7B7]" />
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#16A34A] border-2 border-[#D8E8E3] flex items-center justify-center shadow">
              <Phone size={10} className="text-white fill-current" />
            </span>
          </div>

          {/* Right Info + Pill Action Buttons */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-2">
              <p className="text-xs sm:text-[13px] font-bold text-[#042F26] truncate font-noto">
                {displayInstName}{' '}
                <span className="font-normal text-[#1E4E42]">
                  • {status === 'connected' ? formatDuration(duration) : 'Incoming Voice Call'}
                </span>
              </p>
              <button
                onClick={() => setIsMinimized(false)}
                className="p-1 rounded-full hover:bg-black/10 text-[#042F26]/70 transition-colors shrink-0"
                title="ফুল স্ক্রিন"
              >
                <Maximize2 size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={status === 'incoming' ? onReject : onEnd}
                className="flex-1 py-2 rounded-full bg-gradient-to-b from-[#F87171] to-[#EF4444] text-white font-bold text-xs shadow-md shadow-red-500/25 active:scale-95 transition-all"
              >
                {status === 'incoming' ? 'Decline' : 'End Call'}
              </button>

              {status === 'incoming' ? (
                <button
                  onClick={onAccept}
                  className="flex-1 py-2 rounded-full bg-gradient-to-b from-[#A7F3D0] to-[#6EE7B7] text-[#042F26] font-bold text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition-all"
                >
                  Answer
                </button>
              ) : (
                <button
                  onClick={onToggleMute}
                  className={`flex-1 py-2 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all ${
                    isMuted
                      ? 'bg-[#042F26] text-white'
                      : 'bg-gradient-to-b from-[#A7F3D0] to-[#6EE7B7] text-[#042F26]'
                  }`}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTerminated =
    status === 'rejected' || status === 'ended' || status === 'busy' || status === 'failed';

  // 2. FULL-SCREEN CALL UI — Design 1: Emerald Glassmorphism (WhatsApp Inspired Premium)
  return (
    <div className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen bg-gradient-to-b from-[#064235] via-[#042F25] to-[#021914] text-white flex flex-col items-center justify-between pt-6 pb-0 px-0 select-none animate-in fade-in duration-300 overflow-hidden">
      {/* Ambient Radial Emerald Glow */}
      <div
        className="pointer-events-none absolute top-[18%] left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full opacity-35 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(52,211,153,0.55) 0%, rgba(4,47,38,0) 70%)',
        }}
      />

      {/* Subtle Islamic Geometric Arch / Dome Silhouette at Bottom (Design 1 Motif) */}
      <svg
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] h-[260px] opacity-25"
        viewBox="0 0 400 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M200 18C165 55 110 75 110 140C110 165 65 180 35 215H365C335 180 290 165 290 140C290 75 235 55 200 18Z"
          stroke="url(#goldGlow)"
          strokeWidth="2.5"
          fill="url(#domeFill)"
        />
        <path
          d="M200 42C173 72 132 88 132 142C132 164 95 178 70 210H330C305 178 268 164 268 142C268 88 227 72 200 42Z"
          stroke="#6EE7B7"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <defs>
          <linearGradient id="goldGlow" x1="200" y1="18" x2="200" y2="215" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#34D399" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#042F26" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="domeFill" x1="200" y1="18" x2="200" y2="215" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#10B981" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#021914" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Bar: Encrypted Badge + Info & Minimize Controls */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-between px-6 pt-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-[#6EE7B7]/25 text-[11px] text-[#A7F3D0] font-medium shadow-sm">
          <Lock size={12} className="text-[#34D399]" />
          <span>{displayInstName}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStudentDetails((prev) => !prev)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white/85 hover:text-white transition-all"
            title="বিস্তারিত তথ্য"
          >
            <Info size={16} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white/85 hover:text-white transition-all"
            title="মিনিমাইজ"
          >
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      {/* Expandable Student / Institution Info Card */}
      {showStudentDetails && (
        <div className="relative z-20 w-[90%] max-w-sm rounded-2xl bg-[#0A3A2E]/90 backdrop-blur-2xl border border-[#6EE7B7]/30 p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200 text-xs mt-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <span className="font-bold text-[#6EE7B7] flex items-center gap-1.5">
              <Sparkles size={14} /> {effectiveIsCaller ? 'শিক্ষার্থী পরিচিতি' : 'কলের বিবরণ'}
            </span>
            <button onClick={() => setShowStudentDetails(false)} className="text-white/60 hover:text-white">
              ✕
            </button>
          </div>
          <div className="space-y-1.5 text-white/90 font-noto">
            <p>
              <span className="text-[#A7F3D0]/70">প্রতিষ্ঠান:</span> {displayInstName}
            </p>
            {student.name && (
              <p>
                <span className="text-[#A7F3D0]/70">শিক্ষার্থী:</span> {student.name}
              </p>
            )}
            {student.class_name && (
              <p>
                <span className="text-[#A7F3D0]/70">শ্রেণি:</span> {student.class_name}
              </p>
            )}
            {student.roll && (
              <p>
                <span className="text-[#A7F3D0]/70">রোল:</span> {student.roll}
              </p>
            )}
            {(student.guardian_phone || callData.calleePhone) && (
              <p>
                <span className="text-[#A7F3D0]/70">মোবাইল:</span>{' '}
                <span className="font-mono">{student.guardian_phone || callData.calleePhone}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Center Section: Glowing Concentric Emerald Wave Rings + Avatar + Caller Hierarchy */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full max-w-md px-6 my-auto">
        {/* Avatar with Design 1 Neon Emerald Segmented Arc Rings */}
        <div className="relative w-56 h-56 flex items-center justify-center mb-5">
          {/* Animated Concentric Segmented Emerald Arcs (Design 1 Signature Ring) */}
          <svg
            className={`absolute inset-0 w-full h-full ${!isTerminated ? 'animate-pulse' : 'opacity-40'}`}
            viewBox="0 0 240 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.75))' }}
          >
            {/* Outer Arcs */}
            <circle
              cx="120"
              cy="120"
              r="108"
              stroke="#34D399"
              strokeOpacity="0.65"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="115 55 95 75"
            />
            {/* Middle Glowing Arcs */}
            <circle
              cx="120"
              cy="120"
              r="93"
              stroke="#6EE7B7"
              strokeOpacity="0.85"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="140 45 110 55"
              transform="rotate(35 120 120)"
            />
            {/* Inner Bright Arcs */}
            <circle
              cx="120"
              cy="120"
              r="79"
              stroke="#A7F3D0"
              strokeOpacity="0.95"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="90 35 120 45"
              transform="rotate(-25 120 120)"
            />
          </svg>

          {/* Soft Pulse Halo when Ringing/Connected */}
          {!isTerminated && (
            <div
              className="absolute w-36 h-36 rounded-full bg-[#34D399]/25 animate-ping"
              style={{ animationDuration: '2.4s' }}
            />
          )}

          {/* Circular Portrait / Avatar */}
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-[#10B981] via-[#059669] to-[#042F26] flex items-center justify-center text-white font-bold text-4xl shadow-[0_0_35px_rgba(16,185,129,0.5)] overflow-hidden border-[3.5px] border-[#D1FAE5] shrink-0">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={primaryTitle}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : effectiveIsCaller ? (
              <span>{getInitials(student.name)}</span>
            ) : (
              <GraduationCap className="text-[#D1FAE5] w-14 h-14" />
            )}
          </div>
        </div>

        {/* Caller Primary Name */}
        <h2 className="text-white text-2xl sm:text-[28px] font-bold text-center font-noto tracking-tight leading-snug px-4 drop-shadow">
          {primaryTitle}
        </h2>

        {/* Caller Secondary Subtitle (Bengali Name / Madrasa / Student) */}
        <p className="text-[#A7F3D0]/85 text-base sm:text-[17px] font-noto text-center mt-1 px-4">
          {secondarySubtitle}
        </p>

        {/* Status / Timer Line ("Deenora Voice Call • Ringing...") */}
        <p className="text-[#34D399] text-sm sm:text-[15px] font-medium text-center mt-2 tracking-wide">
          {statusLineText}
        </p>

        {/* Optional Interactive DTMF Keypad Drawer */}
        {showKeypad && (
          <div className="w-full max-w-[280px] bg-[#0B3B2E]/90 backdrop-blur-2xl border border-[#6EE7B7]/30 rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 duration-200 mt-4">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span className="text-xs text-[#A7F3D0] font-mono tracking-wider min-h-[18px]">
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
                  className="py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-base transition-colors active:scale-95"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Frosted Glass Control Dock (Design 1 Signature Frosted Panel) */}
      <div className="relative z-10 w-full max-w-md rounded-t-[38px] bg-[#2A4D44]/60 backdrop-blur-2xl border-t border-white/20 shadow-[0_-12px_45px_rgba(0,0,0,0.45)] px-8 pt-7 pb-9">
        {/* Top Row of Dock: Mute & Speaker (and Keypad when connected) */}
        <div className="flex items-center justify-around max-w-[270px] mx-auto mb-7">
          {/* Mute Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border shadow-lg active:scale-95 ${
                isMuted
                  ? 'bg-white text-[#042F26] border-white'
                  : 'bg-white/15 text-white border-white/30 hover:bg-white/25'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            <span className="text-white/90 text-xs sm:text-[13px] font-medium">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>

          {/* Optional Keypad Button during Connected Call */}
          {status === 'connected' && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setShowKeypad((prev) => !prev)}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border shadow-lg active:scale-95 ${
                  showKeypad
                    ? 'bg-white text-[#042F26] border-white'
                    : 'bg-white/15 text-white border-white/30 hover:bg-white/25'
                }`}
                title="Keypad"
              >
                <Grid className="w-7 h-7" />
              </button>
              <span className="text-white/90 text-xs sm:text-[13px] font-medium">Keypad</span>
            </div>
          )}

          {/* Speaker Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleSpeaker}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border shadow-lg active:scale-95 ${
                isSpeakerOn
                  ? 'bg-white/25 text-white border-white/40 hover:bg-white/35'
                  : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
              }`}
              title={isSpeakerOn ? 'Speaker' : 'Earpiece'}
            >
              {isSpeakerOn ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
            </button>
            <span className="text-white/90 text-xs sm:text-[13px] font-medium">Speaker</span>
          </div>
        </div>

        {/* Bottom Row of Dock: Decline / End & Answer */}
        {status === 'incoming' && !effectiveIsCaller ? (
          <div className="flex items-center justify-around max-w-[270px] mx-auto">
            {/* Glowing Red Decline Button */}
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={onReject}
                className="w-[72px] h-[72px] rounded-full bg-gradient-to-b from-[#F87171] to-[#EF4444] border border-red-300/50 flex items-center justify-center shadow-[0_0_28px_rgba(239,68,68,0.65)] active:scale-95 hover:brightness-110 transition-all"
                title="Decline"
              >
                <PhoneOff className="text-white w-8 h-8" />
              </button>
              <span className="text-white/90 text-xs sm:text-[13px] font-medium">Decline</span>
            </div>

            {/* Glowing Mint-Emerald Answer Button with Soundwave Arcs (Design 1 Signature) */}
            <div className="flex flex-col items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                {/* Left & Right Glowing Wave Arcs around Answer Button */}
                <svg
                  className="pointer-events-none absolute -inset-3 w-[96px] h-[96px] animate-pulse"
                  viewBox="0 0 96 96"
                  fill="none"
                >
                  <path
                    d="M16 30C9 40 9 56 16 66"
                    stroke="#6EE7B7"
                    strokeOpacity="0.65"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 24C1 38 1 58 10 72"
                    stroke="#6EE7B7"
                    strokeOpacity="0.35"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M80 30C87 40 87 56 80 66"
                    stroke="#6EE7B7"
                    strokeOpacity="0.65"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M86 24C95 38 95 58 86 72"
                    stroke="#6EE7B7"
                    strokeOpacity="0.35"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <button
                  onClick={onAccept}
                  className="relative w-[72px] h-[72px] rounded-full bg-gradient-to-b from-[#A7F3D0] via-[#6EE7B7] to-[#34D399] border border-emerald-100/70 flex items-center justify-center shadow-[0_0_32px_rgba(52,211,153,0.75)] active:scale-95 hover:brightness-105 transition-all"
                  title="Answer"
                >
                  <Phone className="text-[#042F26] w-8 h-8 fill-current" />
                </button>
              </div>
              <span className="text-white/90 text-xs sm:text-[13px] font-medium">Answer</span>
            </div>
          </div>
        ) : (
          /* Single Centered Red Decline/End Button for Connected or Outgoing Call */
          <div className="flex flex-col items-center justify-center">
            <button
              onClick={onEnd}
              className="w-[74px] h-[74px] rounded-full bg-gradient-to-b from-[#F87171] to-[#EF4444] border border-red-300/50 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.65)] active:scale-95 hover:brightness-110 transition-all"
              title="End Call"
            >
              <PhoneOff className="text-white w-8 h-8" />
            </button>
            <span className="text-white/90 text-xs sm:text-[13px] font-medium mt-2.5">
              {status === 'connected' ? 'End Call' : 'Decline'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};