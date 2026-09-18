import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  CheckCheck, 
  Download, 
  CornerDownLeft, 
  Palette, 
  Star, 
  Archive, 
  ShieldAlert, 
  X,
  Check,
  Volume2,
  Smartphone
} from 'lucide-react';
import { Conversation, ConversationSettings } from '../../types';
import { 
  getNotificationPermissionState, 
  requestPushNotificationPermission, 
  playNotificationSound,
  sendPushNotification 
} from '../../lib/pushNotifications';

interface MessageSettingsModalProps {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenStarredMessages?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const MessageSettingsModal: React.FC<MessageSettingsModalProps> = ({
  conversation,
  isOpen,
  onClose,
  onOpenStarredMessages,
  lang = 'bn',
  isDark = false,
}) => {
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setPushPermission(getNotificationPermissionState());
  }, []);

  const handleEnablePush = async () => {
    await requestPushNotificationPermission();
    setPushPermission('granted');
  };

  const handleTestChime = () => {
    playNotificationSound();
    sendPushNotification(
      'Deenora Test Push Notification 🔔',
      'আপনার ব্রাউজারে চ্যাট পুশ নোটিফিকেশন সফলভাবে কাজ করছে!'
    );
  };

  const [settings, setSettings] = useState<ConversationSettings>(() => {
    const saved = localStorage.getItem(`chat_settings_${conversation?.id}`);
    return saved ? JSON.parse(saved) : {
      isMuted: false,
      readReceipts: true,
      mediaAutoDownload: 'wifi',
      enterKeySends: true,
      wallpaper: 'default',
      isArchived: false,
      isBlocked: false,
    };
  });

  if (!isOpen || !conversation) return null;

  const updateSetting = (key: keyof ConversationSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem(`chat_settings_${conversation.id}`, JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Settings Modal Container */}
      <div 
        className={`relative z-10 w-full sm:max-w-md max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-250 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        {/* Handle Bar */}
        <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base leading-tight">
              {lang === 'bn' ? 'মেসেজ সেটিংস (Message Settings)' : 'Message Settings'}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {conversation.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Settings Options */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* Notifications & Push Settings */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {lang === 'bn' ? 'নোটিফিকেশন ও পুশ অ্যালার্ট' : 'Push Notifications & Alerts'}
            </h4>

            {/* System Push Notification Switch Card */}
            <div className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {lang === 'bn' ? 'ব্রাউজার পুশ নোটিফিকেশন' : 'Browser Push Notifications'}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {pushPermission === 'granted'
                        ? (lang === 'bn' ? 'পুশ নোটিফিকেশন চালু আছে ✅' : 'Push notifications active ✅')
                        : pushPermission === 'denied'
                        ? (lang === 'bn' ? 'নোটিফিকেশন ব্লক করা রয়েছে ❌' : 'Blocked in browser settings')
                        : (lang === 'bn' ? 'নতুন মেসেজের ইনস্ট্যান্ট অ্যালার্ট' : 'Instant message alerts')}
                    </p>
                  </div>
                </div>

                {pushPermission === 'granted' ? (
                  <button
                    type="button"
                    onClick={handleTestChime}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'টেস্ট সাউন্ড' : 'Test Sound'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shrink-0 active:scale-95 shadow-xs"
                  >
                    {lang === 'bn' ? 'অনুমতি দিন' : 'Enable'}
                  </button>
                )}
              </div>
            </div>

            {/* Mute Conversation Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                {settings.isMuted ? (
                  <BellOff className="w-5 h-5 text-rose-500 shrink-0" />
                ) : (
                  <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'bn' ? 'এই চ্যাট মিউট করুন (Mute Chat)' : 'Mute Conversation'}
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    {settings.isMuted
                      ? (lang === 'bn' ? 'নোটিফিকেশন শব্দ বন্ধ রাখা হয়েছে' : 'Notifications muted')
                      : (lang === 'bn' ? 'নতুন মেসেজে রিং টোন বাজবে' : 'Sound notifications enabled')}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={!!settings.isMuted}
                onChange={(e) => updateSetting('isMuted', e.target.checked)}
                className="w-5 h-5 accent-emerald-600 cursor-pointer rounded-md"
              />
            </div>
          </div>

          {/* Preferences (Read Receipts, Enter Sends) */}
          <div className="space-y-3 pt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {lang === 'bn' ? 'চ্যাট সুবিধা' : 'Chat Options'}
            </h4>

            {/* Read Receipts */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <CheckCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'bn' ? 'পড়ার তথ্য পাঠান (Read Receipts)' : 'Read Receipts'}
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'bn' ? 'ব্লু টিক বা রিড স্ট্যাটাস প্রদর্শন করুন' : 'Show blue checkmarks when read'}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={settings.readReceipts !== false}
                onChange={(e) => updateSetting('readReceipts', e.target.checked)}
                className="w-5 h-5 accent-blue-600 cursor-pointer rounded-md"
              />
            </div>

            {/* Enter key sends */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <CornerDownLeft className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'bn' ? 'Enter চাপলে মেসেজ যাবে' : 'Enter key sends message'}
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'bn' ? 'কীবোর্ডের Enter বোতামে সেন্ড করুন' : 'Press Enter to send message'}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={settings.enterKeySends !== false}
                onChange={(e) => updateSetting('enterKeySends', e.target.checked)}
                className="w-5 h-5 accent-blue-600 cursor-pointer rounded-md"
              />
            </div>
          </div>

          {/* Media & Storage */}
          <div className="space-y-3 pt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {lang === 'bn' ? 'মিডিয়া ডাউনলোড' : 'Media Auto-Download'}
            </h4>

            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {lang === 'bn' ? 'স্বয়ংক্রিয় অটো-ডাউনলোড' : 'Auto-Download Media'}
                </h5>
              </div>

              <select
                value={settings.mediaAutoDownload || 'wifi'}
                onChange={(e) => updateSetting('mediaAutoDownload', e.target.value)}
                className="w-full mt-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none"
              >
                <option value="all">{lang === 'bn' ? 'সব সময় (Mobile Data & Wi-Fi)' : 'All Network Data'}</option>
                <option value="wifi">{lang === 'bn' ? 'শুধুমাত্র Wi-Fi সংযোগে' : 'Wi-Fi Only'}</option>
                <option value="never">{lang === 'bn' ? 'কখনোই নয় (Never)' : 'Never Auto-Download'}</option>
              </select>
            </div>
          </div>

          {/* Starred Messages View */}
          <div className="space-y-3 pt-4">
            <button
              type="button"
              onClick={() => {
                onOpenStarredMessages?.();
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                <div className="text-left">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'bn' ? 'স্টার চিহ্নিত মেসেজসমূহ' : 'Starred Messages'}
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'bn' ? 'বুকমার্ক করা মেসেজের তালিকা' : 'View all bookmarked messages'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">➔</span>
            </button>
          </div>

          {/* Archive & Danger Zone */}
          <div className="space-y-2 pt-4">
            <button
              type="button"
              onClick={() => {
                updateSetting('isArchived', !settings.isArchived);
              }}
              className="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Archive className="w-4 h-4 text-slate-500" />
              <span>
                {settings.isArchived
                  ? (lang === 'bn' ? 'আনআর্কাইভ করুন (Unarchive)' : 'Unarchive Conversation')
                  : (lang === 'bn' ? 'আর্কাইভ করুন (Archive Chat)' : 'Archive Conversation')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                updateSetting('isBlocked', !settings.isBlocked);
              }}
              className="w-full p-3 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/60 flex items-center gap-3 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>
                {settings.isBlocked
                  ? (lang === 'bn' ? 'আনব্লক করুন (Unblock)' : 'Unblock Conversation')
                  : (lang === 'bn' ? 'ব্লক / রিপোর্ট করুন (Block)' : 'Block / Report')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
