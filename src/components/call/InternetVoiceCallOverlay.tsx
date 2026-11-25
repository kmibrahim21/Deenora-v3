import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Building2,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface InternetVoiceCallOverlayProps {
  isOpen: boolean;
  audioUrl: string;
  institutionName: string;
  title: string;
  body?: string;
  autoPlay?: boolean;
  onAccept?: () => void;
  onClose: () => void;
}

const normalizeVoiceAudioUrl = (url: string): string => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^https?:\/\/t2\.tenbytecloud\.com\//i, 'https://s3.eslcloud.io/');
};

const isSafeAudioUrl = (url: string): boolean => {
  const trimmed = String(url || '').trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  );
};

export const InternetVoiceCallOverlay: React.FC<InternetVoiceCallOverlayProps> = ({
  isOpen,
  audioUrl,
  institutionName,
  title,
  body,
  autoPlay = false,
  onAccept,
  onClose,
}) => {
  const normalizedAudioUrl = normalizeVoiceAudioUrl(audioUrl);
  const [phase, setPhase] = useState<'ringing' | 'answered'>(autoPlay ? 'answered' : 'ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chimeIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopRingChime = useCallback(() => {
    if (chimeIntervalRef.current !== null) {
      window.clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close().catch(() => {});
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
  }, []);

  const stopVoiceAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
    }
    setIsPlaying(false);
  }, []);

  const handleClose = useCallback(() => {
    stopRingChime();
    stopVoiceAudio();
    onClose();
  }, [stopRingChime, stopVoiceAudio, onClose]);

  // Android / browser hardware back button closes overlay
  useEffect(() => {
    if (!isOpen) return;
    const onPopState = () => {
      handleClose();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [isOpen, handleClose]);

  // Synthetic ringtone chime while ringing
  useEffect(() => {
    if (!isOpen || phase !== 'ringing' || isMuted) {
      stopRingChime();
      return;
    }

    const playSingleChime = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);
          gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.14 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.14);
          osc.stop(now + idx * 0.14 + 0.36);
        });
      } catch {
        // autoplay may be blocked until gesture
      }
    };

    playSingleChime();
    chimeIntervalRef.current = window.setInterval(playSingleChime, 2600);

    return () => {
      stopRingChime();
    };
  }, [isOpen, phase, isMuted, stopRingChime]);

  // Call elapsed timer during answered phase
  useEffect(() => {
    if (!isOpen || phase !== 'answered') return;
    const t = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [isOpen, phase]);

  const startPlayback = useCallback(() => {
    if (!isSafeAudioUrl(normalizedAudioUrl)) {
      setAudioError('অডিও লিংকটি সঠিক নয়।');
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    setAudioError(null);
    setIsLoadingAudio(true);
    try {
      el.muted = isMuted;
      if (el.readyState === 0 || el.error) {
        el.load();
      }
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoadingAudio(false);
          })
          .catch(() => {
            setAudioError('অডিও চালু করতে "প্লে" বাটনে ট্যাপ করুন।');
            setIsPlaying(false);
            setIsLoadingAudio(false);
          });
      } else {
        setIsPlaying(true);
        setIsLoadingAudio(false);
      }
    } catch {
      setAudioError('অডিও চালু করতে "প্লে" বাটনে ট্যাপ করুন।');
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  }, [normalizedAudioUrl, isMuted]);

  // Auto-play immediately when opened in replay mode from Notification Center
  useEffect(() => {
    if (isOpen && autoPlay && phase === 'answered') {
      const id = window.setTimeout(() => {
        startPlayback();
      }, 150);
      return () => window.clearTimeout(id);
    }
  }, [isOpen, autoPlay, phase, startPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingChime();
      stopVoiceAudio();
    };
  }, [stopRingChime, stopVoiceAudio]);

  const handleAnswerCall = () => {
    stopRingChime();
    setPhase('answered');
    setElapsedSec(0);
    onAccept?.();
    // Play synchronously inside click user gesture for mobile browser compatibility
    startPlayback();
  };

  const handleTogglePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      startPlayback();
    }
  };

  const handleReplay = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    startPlayback();
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  };

  const formatSec = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[10000] flex flex-col justify-between bg-gradient-to-b from-slate-950 via-[#0b1f3a] to-emerald-950 text-white px-6 py-8 sm:py-12 select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'ইন্টারনেট ভয়েস কল'}
    >
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={isSafeAudioUrl(normalizedAudioUrl) ? normalizedAudioUrl : ''}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && !Number.isNaN(d) && Number.isFinite(d)) {
            setAudioDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          setAudioProgress(e.currentTarget.currentTime || 0);
        }}
        onPlay={() => {
          setIsPlaying(true);
          setIsLoadingAudio(false);
          setAudioError(null);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setIsLoadingAudio(false);
          setAudioError('অডিও লোড করতে সমস্যা হয়েছে। নিচের লিখিত বার্তাটি দেখুন।');
        }}
      />

      {/* Top Status Pill & Mute Button */}
      <div className="flex items-center justify-between max-w-md w-full mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full ${phase === 'ringing' ? 'bg-emerald-400 animate-ping' : 'bg-emerald-400'}`} />
          <span className="text-[11px] font-black font-noto tracking-wide text-emerald-100">
            {phase === 'ringing' ? 'প্রতিষ্ঠান থেকে কল এসেছে' : `ইন্টারনেট ভয়েস কল • ${formatSec(elapsedSec)}`}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleMute}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all cursor-pointer"
          title={isMuted ? 'সাউন্ড চালু করুন' : 'মিউট করুন'}
        >
          {isMuted ? <VolumeX size={18} className="text-red-300" /> : <Volume2 size={18} className="text-emerald-200" />}
        </button>
      </div>

      {/* Center Caller Identity & Waveform / Transcript */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto text-center py-6 space-y-6">
        <div className="relative flex items-center justify-center">
          {phase === 'ringing' && (
            <>
              <span className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-ping" />
              <span className="absolute w-28 h-28 rounded-full bg-emerald-400/25 animate-pulse" />
            </>
          )}
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30 border-4 border-white/20 flex items-center justify-center">
            <Building2 size={40} className="text-white" />
          </div>
        </div>

        <div className="space-y-1.5 px-2">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-300 font-noto">
            {institutionName || 'প্রতিষ্ঠান'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black font-noto leading-snug text-white">
            {title || 'জরুরি ভয়েস বার্তা'}
          </h2>
          <p className="text-xs font-bold text-slate-300 font-noto">
            {phase === 'ringing'
              ? 'ভয়েস বার্তাটি শুনতে সবুজ "রিসিভ করুন" বাটনে চাপ দিন'
              : isLoadingAudio
              ? 'অডিও লোড হচ্ছে...'
              : isPlaying
              ? 'ভয়েস বার্তা চলছে...'
              : 'ভয়েস প্লেব্যাক বিরতিতে আছে'}
          </p>
        </div>

        {phase === 'answered' && (
          <div className="w-full space-y-4">
            {/* Waveform & Audio Controls */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  {isLoadingAudio ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isPlaying ? (
                    <Pause size={20} />
                  ) : (
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-1 h-7">
                    {[35, 70, 45, 95, 60, 85, 40, 100, 55, 80, 45, 90, 65, 50, 75, 40, 85, 60].map((barH, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/25'
                        }`}
                        style={{ height: isPlaying ? `${barH}%` : '28%' }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                    <span>{formatSec(audioProgress)}</span>
                    <span>{audioDuration > 0 ? formatSec(audioDuration) : '--:--'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReplay}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer"
                  title="পুনরায় শুনুন"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {audioError && (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-200 bg-amber-500/20 border border-amber-400/30 rounded-xl px-3 py-2 font-noto text-left">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{audioError}</span>
                </div>
              )}
            </div>

            {/* Transcript / Message Fallback Card */}
            {body && (
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-left space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300 font-noto">
                  লিখিত বার্তা
                </p>
                <p className="text-xs sm:text-sm text-slate-100 font-noto leading-relaxed whitespace-pre-wrap">
                  {body}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Call Action Buttons */}
      <div className="max-w-md w-full mx-auto pb-2">
        {phase === 'ringing' ? (
          <div className="flex items-center justify-around gap-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 shadow-xl shadow-red-600/30 flex items-center justify-center transition-all active:scale-95">
                <PhoneOff size={26} />
              </div>
              <span className="text-xs font-black font-noto text-red-200">কেটে দিন</span>
            </button>

            <button
              type="button"
              onClick={handleAnswerCall}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-18 h-18 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-2xl shadow-emerald-500/40 flex items-center justify-center transition-all active:scale-95 animate-bounce">
                <PhoneCall size={28} />
              </div>
              <span className="text-xs font-black font-noto text-emerald-200">রিসিভ করুন</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleClose}
              className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-500 shadow-xl shadow-red-600/30 flex items-center justify-center gap-2.5 text-sm font-black font-noto transition-all active:scale-95 cursor-pointer"
            >
              <PhoneOff size={20} />
              <span>কল শেষ করুন</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};

export default InternetVoiceCallOverlay;
