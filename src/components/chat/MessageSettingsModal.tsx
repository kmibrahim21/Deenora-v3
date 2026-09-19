import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  Star, 
  Archive, 
  ShieldAlert, 
  X,
  Volume2,
  Trash2,
  Info,
  CheckSquare,
  HardDriveDownload
} from 'lucide-react';
import { Conversation, ConversationSettings } from '../../types';

interface MessageSettingsModalProps {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenStarredMessages?: () => void;
  onSelectMode?: () => void;
  onClearChat?: () => void;
  onOpenBackup?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const MessageSettingsModal: React.FC<MessageSettingsModalProps> = ({
  conversation,
  isOpen,
  onClose,
  onOpenStarredMessages,
  onSelectMode,
  onClearChat,
  onOpenBackup,
  lang = 'bn',
  isDark = false,
}) => {
  const [settings, setSettings] = useState<ConversationSettings>(() => {
    const saved = localStorage.getItem(`chat_settings_${conversation?.id}`);
    return saved ? JSON.parse(saved) : {
      isMuted: false,
    };
  });

  if (!isOpen || !conversation) return null;

  const updateSetting = (key: keyof ConversationSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem(`chat_settings_${conversation.id}`, JSON.stringify(updated));
  };

  const menuItems = [
    {
      id: 'info',
      icon: <Info className="w-5 h-5" />,
      label: lang === 'bn' ? 'গ্রুপের তথ্য' : 'Group Info',
      onClick: onClose
    },
    {
      id: 'mute',
      icon: settings.isMuted ? <BellOff className="w-5 h-5 text-rose-500" /> : <Bell className="w-5 h-5 text-emerald-600" />,
      label: settings.isMuted ? (lang === 'bn' ? 'আনমিউট করুন' : 'Unmute') : (lang === 'bn' ? 'মিউট করুন' : 'Mute Notifications'),
      onClick: () => updateSetting('isMuted', !settings.isMuted)
    },
    {
      id: 'backup',
      icon: <HardDriveDownload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      label: lang === 'bn' ? 'চ্যাট ব্যাকআপ ও রিস্টোর' : 'Chat Backup & Restore',
      onClick: () => {
        onOpenBackup?.();
        onClose();
      }
    },
    {
      id: 'select',
      icon: <CheckSquare className="w-5 h-5 text-blue-500" />,
      label: lang === 'bn' ? 'মেসেজ নির্বাচন করুন' : 'Select Messages',
      onClick: () => {
        onSelectMode?.();
        onClose();
      }
    },
    {
      id: 'starred',
      icon: <Star className="w-5 h-5 text-amber-500 fill-amber-400" />,
      label: lang === 'bn' ? 'স্টার চিহ্নিত মেসেজ' : 'Starred Messages',
      onClick: () => {
        onOpenStarredMessages?.();
        onClose();
      }
    },
    {
      id: 'clear',
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      label: lang === 'bn' ? 'চ্যাট পরিষ্কার করুন' : 'Clear Chat',
      onClick: () => {
        onClearChat?.();
        onClose();
      }
    },
    {
      id: 'archive',
      icon: <Archive className="w-5 h-5 text-slate-500" />,
      label: settings.isArchived ? (lang === 'bn' ? 'আনআর্কাইভ' : 'Unarchive') : (lang === 'bn' ? 'আর্কাইভ' : 'Archive Chat'),
      onClick: () => updateSetting('isArchived', !settings.isArchived)
    }
  ];

  return (
    <div className="fixed inset-0 z-[240] flex items-end sm:items-start sm:justify-end p-0 sm:p-4 bg-slate-950/20 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className={`relative z-10 w-full sm:w-72 flex flex-col bg-white dark:bg-slate-800 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-top-4 duration-200 text-slate-800 dark:text-slate-100`}
      >
        <div className="p-2 space-y-0.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors rounded-xl text-sm font-medium"
            >
              <div className="shrink-0">{item.icon}</div>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-2 pt-0 border-t border-slate-100 dark:border-slate-700/50">
          <button
            onClick={() => updateSetting('isBlocked', !settings.isBlocked)}
            className="w-full flex items-center gap-3.5 px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 transition-colors rounded-xl text-sm font-bold"
          >
            <ShieldAlert className="w-5 h-5" />
            <span>{settings.isBlocked ? (lang === 'bn' ? 'আনব্লক করুন' : 'Unblock') : (lang === 'bn' ? 'ব্লক করুন' : 'Block')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
