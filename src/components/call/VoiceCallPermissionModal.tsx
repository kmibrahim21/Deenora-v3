import React, { useState } from 'react';
import { Mic, Bell, ShieldCheck, Check, X, PhoneCall } from 'lucide-react';

interface VoiceCallPermissionModalProps {
  isOpen: boolean;
  onGrant: () => void;
  onCancel: () => void;
  title?: string;
  calleeName?: string;
}

export const VoiceCallPermissionModal: React.FC<VoiceCallPermissionModalProps> = ({
  isOpen,
  onGrant,
  onCancel,
  title = 'ভয়েস কল পারমিশন প্রয়োজন',
  calleeName,
}) => {
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleGrant = async () => {
    setIsRequesting(true);
    try {
      // 1. Request microphone permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop stream immediately after acquiring permission so mic indicator turns off
          stream.getTracks().forEach((track) => track.stop());
        } catch (e) {
          console.warn('[CallPermission] Mic prompt error:', e);
        }
      }

      // 2. Request notification permission if available
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (e) {
          console.warn('[CallPermission] Notification prompt error:', e);
        }
      }

      try {
        localStorage.setItem('deenora_call_permission_granted', 'true');
      } catch {}

      onGrant();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-white text-center flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition-colors"
          title="বাতিল করুন"
        >
          <X size={18} />
        </button>

        {/* Animated Icon Avatar */}
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/25 ring-4 ring-blue-500/20">
          <PhoneCall size={28} className="text-white animate-pulse" />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white">
            <Mic size={12} />
          </span>
        </div>

        <h3 className="text-lg font-bold font-noto text-white mb-1">
          {title}
        </h3>

        {calleeName && (
          <p className="text-xs font-semibold text-blue-300 font-noto mb-3 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/40">
            কল প্রাপক: {calleeName}
          </p>
        )}

        <p className="text-xs text-slate-300 font-noto leading-relaxed mb-5">
          এইচডি কোয়ালিটিতে কথা বলার জন্য এবং কল চলাকালীন সাউন্ড আদান-প্রদানের জন্য মাইক্রোফোন ও অডিও পারমিশন প্রয়োজন।
        </p>

        {/* Feature Highlights */}
        <div className="w-full bg-slate-950/50 rounded-2xl p-3.5 border border-slate-800/80 mb-6 flex flex-col gap-2.5 text-left text-xs font-noto text-slate-300">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Mic size={14} />
            </div>
            <span>স্পষ্ট অডিওর জন্য মাইক্রোফোন সক্রিয় থাকবে</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck size={14} />
            </div>
            <span>এন্ড-টু-এন্ড সুরক্ষিত ও গোপনীয় ভয়েস কল</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onCancel}
            disabled={isRequesting}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs transition-all font-noto border border-slate-700"
          >
            পরে
          </button>
          <button
            onClick={handleGrant}
            disabled={isRequesting}
            className="flex-[1.5] py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:opacity-95 active:scale-95 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all font-noto flex items-center justify-center gap-1.5"
          >
            {isRequesting ? (
              <span className="animate-pulse">অনুমতি নেওয়া হচ্ছে...</span>
            ) : (
              <>
                <Check size={16} />
                <span>অনুমতি দিন ও কল করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
