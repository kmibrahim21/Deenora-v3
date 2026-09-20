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
  Radio
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
  const [waveHeights, setWaveHeights] = useState<number[]>([40, 65, 30, 80, 50, 90, 45, 70, 35, 60]);

  // Audio wave pulsation effect when connected
  useEffect(() => {
    if (status !== 'connected' || isMuted) return;
    const interval = setInterval(() => {
      setWaveHeights(prev => prev.map(() => Math.floor(Math.random() * 65) + 20));
    }, 150);
    return () => clearInterval(interval);
  }, [status, isMuted]);

  if (status === 'idle' || !callData) return null;

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const student = callData.student;
  const caller = callData.caller;
  const isIncoming = status === 'incoming' && !isCaller;

  // Clean caller and institution name logic: ensure no 'user', email, or generic strings are shown
  const isGenericOrEmail = (str?: string) => {
    if (!str) return true;
    const s = str.trim().toLowerCase();
    return s === 'user' || s === 'user-caller' || s === 'admin-user' || s === 'parent-user' || s === 'admin' || s === 'teacher' || s.includes('@') || s.includes('gmail') || s.includes('.com');
  };

  const rawInstName = callData.institutionName || caller?.institutionName || '';
  const displayInstName = isGenericOrEmail(rawInstName) ? 'শিক্ষা প্রতিষ্ঠান' : rawInstName.trim();
  const callerPersonName = !isGenericOrEmail(caller?.name) ? caller?.name?.trim() : '';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[120px] transition-all duration-700 ${
          status === 'connected' ? 'bg-emerald-600/20' : isIncoming ? 'bg-blue-600/25' : 'bg-indigo-600/20'
        }`} />
      </div>

      <div className="relative w-full max-w-sm rounded-[2.5rem] bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 shadow-2xl p-6 md:p-8 flex flex-col items-center text-center overflow-hidden">
        
        {/* Top Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs font-semibold tracking-wide mb-6 shadow-inner">
          <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${
            status === 'connected' ? 'bg-emerald-400 animate-ping' : isIncoming ? 'bg-blue-400 animate-pulse' : 'bg-amber-400 animate-ping'
          }`} />
          <span className="font-noto">
            {status === 'connected'
              ? 'কথা বলা হচ্ছে (HD Voice Active)'
              : status === 'calling'
              ? 'কল বাজছে (Ringing...)'
              : isIncoming
              ? 'ইনকামিং ভয়েস কল (Incoming Call)'
              : status === 'rejected'
              ? 'কলটি কেটে দেওয়া হয়েছে'
              : 'কল শেষ হয়েছে'}
          </span>
        </div>

        {/* Avatar / Photo with pulsating multi-layer rings */}
        <div className="relative mb-6">
          {/* Animated multi-layer ripple rings for incoming call */}
          {(status === 'calling' || status === 'incoming') && (
            <>
              <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping duration-1000" />
              <div className="absolute -inset-8 rounded-full border border-blue-400/30 animate-pulse duration-700" />
              <div className="absolute -inset-12 rounded-full border border-indigo-500/15 animate-pulse duration-1000" />
            </>
          )}

          {status === 'connected' && (
            <>
              <div className="absolute -inset-3 rounded-full border-2 border-emerald-500/40 animate-pulse" />
              <div className="absolute -inset-6 rounded-full border border-emerald-500/20 animate-ping duration-1000" />
            </>
          )}

          <div className="relative w-28 h-28 rounded-full bg-slate-800 border-2 border-slate-600 shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-slate-900/80">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 flex items-center justify-center text-white text-3xl font-black font-noto">
                {student.name ? student.name.charAt(0) : <User size={40} />}
              </div>
            )}
          </div>
        </div>

        {/* Student & Caller Details */}
        <div className="space-y-1.5 mb-6 w-full">
          <h3 className="text-xl font-black text-white font-noto tracking-tight">
            {student.name || 'শিক্ষার্থী'}
          </h3>
          
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            {student.class_name && (
              <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                <GraduationCap size={13} className="text-blue-400" />
                {student.class_name}
              </span>
            )}
            {student.roll && (
              <span className="bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40 font-mono">
                রোল: {student.roll}
              </span>
            )}
          </div>

          {/* Caller / Callee context */}
          <div className="mt-2 pt-2 border-t border-slate-800/60 text-xs text-slate-300">
            {isIncoming ? (
              <p className="flex items-center justify-center gap-1.5 text-blue-300">
                <ShieldCheck size={14} className="text-blue-400 shrink-0" />
                <span>প্রতিষ্ঠান থেকে কল: <strong>{displayInstName}{callerPersonName ? ` (${callerPersonName})` : ''}</strong></span>
              </p>
            ) : (
              <p className="text-slate-400">
                অভিভাবক: <strong className="text-slate-200">{student.guardian_name || student.guardian_phone || 'সম্মানিত অভিভাবক'}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Audio Wave Visualizer or Call Timer */}
        {status === 'connected' ? (
          <div className="w-full bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 mb-8 flex flex-col items-center gap-3">
            <div className="text-2xl font-mono font-black text-emerald-400 tracking-wider">
              {formatDuration(duration)}
            </div>

            {/* Pulsing Audio Wave */}
            <div className="flex items-center justify-center gap-1.5 h-10 w-full px-4">
              {waveHeights.map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${isMuted ? 4 : h}%` }}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isMuted ? 'bg-slate-700' : 'bg-gradient-to-t from-emerald-500 to-teal-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-medium">
              {isMuted && (
                <span className="text-amber-400 flex items-center gap-1">
                  <MicOff size={12} /> মাইক্রোফোন মিউট
                </span>
              )}
              <span className={`flex items-center gap-1 ${isSpeakerOn ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
                {isSpeakerOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
                {isSpeakerOn ? 'স্পিকার অন' : 'স্পিকার অফ'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-8 flex items-center gap-2 text-slate-400 text-xs animate-pulse">
            <Radio size={14} className="text-blue-400 animate-spin" />
            <span>{isIncoming ? 'কল রিসিভ করতে নিচের বাটনে চাপ দিন' : 'সংযোগ স্থাপন করা হচ্ছে...'}</span>
          </div>
        )}

        {/* Control Buttons */}
        {isIncoming ? (
          /* Incoming Call Actions: Accept or Reject */
          <div className="grid grid-cols-2 gap-4 w-full">
            <button
              onClick={onReject}
              className="flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-3xl bg-slate-900/80 text-rose-300 border border-rose-500/30 font-bold text-xs hover:bg-rose-950/40 active:scale-95 transition-all shadow-lg"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-rose-700 to-red-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/40 border border-rose-400/40">
                <PhoneOff size={24} />
              </div>
              <span className="font-noto text-rose-200">কেটে দিন</span>
            </button>

            <button
              onClick={onAccept}
              className="flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-3xl bg-slate-900/80 text-emerald-300 border border-emerald-500/30 font-bold text-xs hover:bg-emerald-950/40 active:scale-95 transition-all shadow-lg"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-500/50 border border-emerald-300/40 animate-bounce">
                <PhoneCall size={24} />
              </div>
              <span className="font-noto text-emerald-200">রিসিভ করুন</span>
            </button>
          </div>
        ) : (
          /* Active Call or Outgoing Actions: Mute, Speaker & End */
          <div className="flex items-center justify-center gap-5 w-full">
            {status === 'connected' && (
              <>
                <button
                  onClick={onToggleMute}
                  className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all border active:scale-90 ${
                    isMuted
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                  title={isMuted ? 'আনমিউট করুন' : 'মিউট করুন'}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  <span className="text-[9px] font-bold mt-0.5">{isMuted ? 'মিউট' : 'মাইক'}</span>
                </button>

                <button
                  onClick={onToggleSpeaker}
                  className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all border active:scale-90 ${
                    isSpeakerOn
                      ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                  title={isSpeakerOn ? 'স্পিকার বন্ধ করুন' : 'স্পিকার চালু করুন'}
                >
                  {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  <span className="text-[9px] font-bold mt-0.5">{isSpeakerOn ? 'স্পিকার অন' : 'স্পিকার অফ'}</span>
                </button>
              </>
            )}

            <button
              onClick={onEnd}
              className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 active:scale-90 hover:scale-105 transition-all"
              title="কল শেষ করুন"
            >
              <PhoneOff size={28} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
