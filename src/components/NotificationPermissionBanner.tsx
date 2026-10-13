import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check, X } from 'lucide-react';
import { requestPushNotificationPermission, getNotificationPermissionState } from '../lib/pushNotifications';

export const NotificationPermissionBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isGranted, setIsGranted] = useState<boolean>(false);

  useEffect(() => {
    // Disabled auto-prompting on initial app open to prevent annoying popups for users.
    // Permissions are requested contextually when initiating or receiving a voice call.
    setShowBanner(false);
  }, []);

  const handleEnable = async () => {
    try {
      const res = await requestPushNotificationPermission();
      if (res === 'granted') {
        setIsGranted(true);
        setShowBanner(false);
      } else {
        setShowBanner(false);
      }
    } catch {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('deenora_notif_banner_dismissed', 'true');
    } catch {}
  };

  if (!showBanner || isGranted) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9990] w-[95%] max-w-md bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-blue-500/60 shadow-2xl rounded-2xl p-3 text-white backdrop-blur-xl animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-blue-600/80 border border-blue-400/50 flex items-center justify-center shrink-0 text-white shadow-md animate-pulse">
            <BellRing size={18} />
          </div>
          <div className="text-left overflow-hidden">
            <h4 className="text-xs font-bold text-blue-200 tracking-wide font-noto">
              মোবাইল লক-স্ক্রিন নোটিফিকেশন 🔔
            </h4>
            <p className="text-[11px] text-slate-300 truncate font-noto">
              কল ও মেসেজ সরাসরি মোবাইলের লক স্ক্রিনে পেতে চালু করুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleEnable}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg active:scale-95 transition-all border border-blue-300/40 flex items-center gap-1 font-noto"
          >
            <Check size={14} />
            <span>চালু করুন</span>
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center active:scale-90 transition-all"
            title="পরেরবার"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
