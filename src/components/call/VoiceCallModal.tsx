import React, { useEffect, useState } from 'react';
import { 
  Phone, 
  PhoneOff, 
  PhoneCall, 
  Mic, 
  MicOff, 
  Volume2, 
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
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  status,
  callData,
  isCaller,
  duration,
  isMuted,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-semibold tracking-wide mb-6">
          <span className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-400 animate-ping' : isIncoming ? 'bg-blue-400 animate-pulse' : 'bg-amber-400 animate-ping'
          }`} />
          <span>
            {status === 'connected'
              ? 'কথা বলা হচ্ছে (Active Voice Call)'
              : status === 'calling'
              ? 'কল বাজছে (Ringing...)'
              : isIncoming
              ? 'ইনকামিং ভয়েস কল (Incoming Call)'
              : status === 'rejected'
              ? 'কলটি কেটে দেওয়া হয়েছে'
              : 'কল শেষ হয়েছে'}
          </span>
        </div>

        {/* Avatar / Photo with pulsating rings */}
        <div className="relative mb-6">
          {/* Animated ripple rings */}
          {(status === 'calling' || status === 'incoming') && (
            <>
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-blue-500/30 animate-pulse" />
            </>
          )}

          {status === 'connected' && (
            <div className="absolute -inset-2 rounded-full border-2 border-emerald-500/40 animate-pulse" />
          )}

          <div className="relative w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 shadow-xl overflow-hidden flex items-center justify-center">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white text-2xl font-bold font-noto">
                {student.name ? student.name.charAt(0) : <User size={36} />}
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
                <span>মাদ্রাসা থেকে কল: <strong>{caller.name || 'শিক্ষক / এডমিন'}</strong></span>
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

            {isMuted && (
              <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                <MicOff size={12} /> আপনার মাইক্রোফোন মিউট করা আছে
              </span>
            )}
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
              className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-4 rounded-2xl bg-rose-600/20 text-rose-300 border border-rose-500/30 font-bold text-xs hover:bg-rose-600/30 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
                <PhoneOff size={22} />
              </div>
              <span>কেটে দিন (Decline)</span>
            </button>

            <button
              onClick={onAccept}
              className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-4 rounded-2xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs hover:bg-emerald-600/30 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40 animate-bounce">
                <PhoneCall size={22} />
              </div>
              <span>রিসিভ করুন (Answer)</span>
            </button>
          </div>
        ) : (
          /* Active Call or Outgoing Actions: Mute & End */
          <div className="flex items-center justify-center gap-6 w-full">
            {status === 'connected' && (
              <button
                onClick={onToggleMute}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border active:scale-90 ${
                  isMuted
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
                title={isMuted ? 'আনমিউট করুন' : 'মিউট করুন'}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
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
