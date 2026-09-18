import React, { useRef, useEffect, useState } from 'react';
import { Conversation, ChatMessage, Profile } from '../../types';
import { ChatComposer } from './ChatComposer';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageInfoModal } from './MessageInfoModal';
import { ForwardModal } from './ForwardModal';
import { MessageSettingsModal } from './MessageSettingsModal';
import { StarredMessagesModal } from './StarredMessagesModal';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { 
  getNotificationPermissionState, 
  requestPushNotificationPermission, 
  sendPushNotification, 
  playNotificationSound 
} from '../../lib/pushNotifications';
import { 
  Users, 
  Megaphone, 
  Check, 
  CheckCheck, 
  ArrowLeft, 
  Pin, 
  Search, 
  MoreVertical, 
  X, 
  Star, 
  Reply, 
  Copy, 
  Forward, 
  Trash2, 
  Settings, 
  CheckSquare,
  Smile,
  PhoneCall,
  Video,
  Bell,
  BellRing
} from 'lucide-react';

interface ChatWindowProps {
  conversation: Conversation | null;
  conversations?: Conversation[];
  messages: ChatMessage[];
  loading?: boolean;
  currentUser: Profile | null;
  userRole?: string;
  onSendMessage: (text: string, replyToMessageId?: string) => void;
  onOpenInfo?: () => void;
  onBackMobile?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  conversations = [],
  messages: initialMessages,
  loading = false,
  currentUser,
  userRole,
  onSendMessage,
  onOpenInfo,
  onBackMobile,
  lang = 'bn',
  isDark = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Local state for interactive message capabilities
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(initialMessages);
  
  // UI Modals & Menus
  const [contextMenuMsg, setContextMenuMsg] = useState<ChatMessage | null>(null);
  const [infoMsg, setInfoMsg] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [replyingToMsg, setReplyingToMsg] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [showPinnedAnnouncement, setShowPinnedAnnouncement] = useState(true);

  // Quick Emoji Reactions
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Multi-Select Mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);

  // Toast & Confirm dialog
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pushState, setPushState] = useState<NotificationPermission>('default');

  useEffect(() => {
    setPushState(getNotificationPermissionState());
  }, []);

  const handleBellClick = async () => {
    if (pushState === 'granted') {
      playNotificationSound();
      sendPushNotification(
        'Deenora Live Chat 🔔',
        `পুশ নোটিফিকেশন সচল আছে। ${conversation?.name || ''} এ নতুন মেসেজ এলে আপনার ডিভাইসে পুশ নোটিফিকেশন পাবেন।`
      );
      setToastMessage(lang === 'bn' ? 'পুশ নোটিফিকেশন অ্যাক্টিভ আছে 🔔' : 'Push notifications active 🔔');
    } else {
      const res = await requestPushNotificationPermission();
      setPushState(res);
      if (res === 'granted') {
        setToastMessage(lang === 'bn' ? 'পুশ নোটিফিকেশন চালু করা হয়েছে!' : 'Push notifications enabled!');
      } else {
        setToastMessage(lang === 'bn' ? 'ব্রাউজারে নোটিফিকেশনের অনুমতি প্রদান করুন' : 'Please allow notifications in browser settings');
      }
    }
  };
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: '',
    onConfirm: () => {},
  });

  // Sync initialMessages to localMessages
  useEffect(() => {
    setLocalMessages(initialMessages);
  }, [initialMessages]);

  // Auto-scroll on message changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  if (!conversation) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
        isDark ? 'bg-[#0B141A] text-slate-400' : 'bg-[#EFEAE2] text-slate-500'
      }`}>
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm animate-pulse">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
          {lang === 'bn' ? 'যেকোনো চ্যাট নির্বাচন করুন' : 'Select a Conversation'}
        </h3>
        <p className="text-xs max-w-sm text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'ক্লাস গ্রুপ, শিক্ষক বা প্রতিষ্ঠানের নোটিশ বোর্ডের সাথে লাইভ যুক্ত থাকতে যেকোনো একটি চ্যাট নির্বাচন করুন।'
            : 'Select a conversation from the left menu to start messaging.'}
        </p>
      </div>
    );
  }

  const getRoleLabel = (role?: string) => {
    if (role === 'teacher' || role === 'madrasah_admin' || role === 'super_admin') {
      return lang === 'bn' ? 'শ্রেণি শিক্ষক' : 'Class Teacher';
    }
    if (role === 'parent' || role === 'guardian') {
      return lang === 'bn' ? 'অভিভাবক' : 'Parent';
    }
    return lang === 'bn' ? 'সদস্য' : 'Member';
  };

  // Quick Reaction Handler
  const handleToggleReaction = (msgId: string, emoji: string) => {
    setReactions(prev => {
      const existing = prev[msgId] || [];
      const updated = existing.includes(emoji)
        ? existing.filter(e => e !== emoji)
        : [...existing, emoji];
      return { ...prev, [msgId]: updated };
    });
    setActiveReactionMsgId(null);
  };

  // --- Handlers for Message Actions ---

  const handleCopyMessage = (msg: ChatMessage) => {
    if (msg.message) {
      navigator.clipboard.writeText(msg.message);
      setToastMessage(lang === 'bn' ? 'মেসেজ কপি করা হয়েছে' : 'Message copied');
    }
  };

  const handleStarMessage = (msg: ChatMessage) => {
    setLocalMessages(prev =>
      prev.map(m => (m.id === msg.id ? { ...m, is_starred: !m.is_starred } : m))
    );
    setToastMessage(
      msg.is_starred
        ? (lang === 'bn' ? 'স্টার রিমুভ করা হয়েছে' : 'Star removed')
        : (lang === 'bn' ? 'মেসেজে স্টার দেওয়া হয়েছে' : 'Message starred')
    );
  };

  const handleEditSubmit = (msgId: string, newText: string) => {
    setLocalMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? {
              ...m,
              message: newText,
              is_edited: true,
              edited_at: new Date().toISOString(),
            }
          : m
      )
    );
    setEditingMsg(null);
    setToastMessage(lang === 'bn' ? 'মেসেজ এডিট সফল হয়েছে' : 'Message edited');
  };

  const handleDeleteForMe = (msg: ChatMessage) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'bn' ? 'আমার জন্য মুছবেন?' : 'Delete for me?',
      description: lang === 'bn' ? 'এই মেসেজটি শুধুমাত্র আপনার চ্যাট স্ক্রিন থেকে মুছে ফেলা হবে।' : 'This message will be deleted from your chat screen only.',
      confirmLabel: lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete',
      onConfirm: () => {
        setLocalMessages(prev =>
          prev.map(m => (m.id === msg.id ? { ...m, deleted_for_me: true } : m))
        );
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setToastMessage(lang === 'bn' ? 'মেসেজটি মোছা হয়েছে' : 'Message deleted for you');
      },
    });
  };

  const handleDeleteForEveryone = (msg: ChatMessage) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'bn' ? 'সবার জন্য মুছবেন?' : 'Delete for everyone?',
      description: lang === 'bn' ? 'এই মেসেজটি গ্রুপের বা চ্যাটের সবার স্ক্রিন থেকে মুছে ফেলা হবে।' : 'This message will be deleted for everyone in this conversation.',
      confirmLabel: lang === 'bn' ? 'সবার জন্য মুছুন' : 'Delete for Everyone',
      onConfirm: () => {
        setLocalMessages(prev =>
          prev.map(m =>
            m.id === msg.id
              ? {
                  ...m,
                  is_deleted: true,
                  message: lang === 'bn' ? 'মেসেজটি মুছে ফেলা হয়েছে' : 'This message was deleted',
                }
              : m
          )
        );
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setToastMessage(lang === 'bn' ? 'সবার জন্য মেসেজটি মোছা হয়েছে' : 'Message deleted for everyone');
      },
    });
  };

  const handleForwardSend = (targetConvIds: string[], msg: ChatMessage) => {
    setToastMessage(
      lang === 'bn'
        ? `${targetConvIds.length} টি চ্যাটে মেসেজ ফরোয়ার্ড করা হয়েছে`
        : `Message forwarded to ${targetConvIds.length} chats`
    );
  };

  // Selection Mode Helpers
  const toggleSelectMessage = (msgId: string) => {
    setSelectedMsgIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  const handleBatchCopy = () => {
    const selectedTexts = localMessages
      .filter(m => selectedMsgIds.includes(m.id))
      .map(m => m.message)
      .join('\n');
    navigator.clipboard.writeText(selectedTexts);
    setToastMessage(lang === 'bn' ? `${selectedMsgIds.length} টি মেসেজ কপি করা হয়েছে` : 'Messages copied');
    setIsSelectMode(false);
    setSelectedMsgIds([]);
  };

  const handleBatchDelete = () => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'bn' ? 'নির্বাচিত মেসেজ মুছবেন?' : 'Delete selected messages?',
      description: lang === 'bn' ? 'নির্বাচিত মেসেজগুলো আপনার চ্যাট থেকে মুছে ফেলা হবে।' : 'Selected messages will be deleted from your view.',
      confirmLabel: lang === 'bn' ? 'মুছে ফেলুন' : 'Delete',
      onConfirm: () => {
        setLocalMessages(prev =>
          prev.map(m => (selectedMsgIds.includes(m.id) ? { ...m, deleted_for_me: true } : m))
        );
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setToastMessage(lang === 'bn' ? 'মেসেজ মোছা হয়েছে' : 'Messages deleted');
        setIsSelectMode(false);
        setSelectedMsgIds([]);
      },
    });
  };

  // Touch handlers for Long-Press on Mobile
  const handleTouchStart = (msg: ChatMessage) => {
    touchTimerRef.current = setTimeout(() => {
      setContextMenuMsg(msg);
    }, 450); // 450ms long press threshold
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  const visibleMessages = localMessages.filter(m => !m.deleted_for_me);
  const quickEmojiList = ['👍', '❤️', '😂', '😮', '🙏', '🕌'];

  return (
    <div className={`flex-1 flex flex-col h-full relative ${
      isDark
        ? 'bg-[#0B141A] text-slate-100 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px]'
        : 'bg-[#EFEAE2] text-slate-800 bg-[radial-gradient(#0000000a_1px,transparent_1px)] [background-size:20px_20px]'
    }`}>
      
      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Multi-Select Header (Replaces top bar in Select Mode) */}
      {isSelectMode ? (
        <div className="p-3.5 px-4 bg-emerald-700 text-white border-b border-emerald-800 flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedMsgIds([]);
              }}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm">
              {selectedMsgIds.length} {lang === 'bn' ? 'টি নির্বাচিত' : 'selected'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchCopy}
              disabled={selectedMsgIds.length === 0}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40"
              title={lang === 'bn' ? 'কপি করুন' : 'Copy'}
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={handleBatchDelete}
              disabled={selectedMsgIds.length === 0}
              className="p-2 rounded-xl hover:bg-white/10 text-rose-200 transition-colors disabled:opacity-40"
              title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Glassmorphic Native Top App Bar */
        <div className={`p-3 px-4 border-b flex items-center justify-between gap-3 backdrop-blur-xl sticky top-0 z-20 shadow-xs ${
          isDark ? 'bg-slate-900/90 border-slate-800/80' : 'bg-white/90 border-slate-200/80'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            {onBackMobile && (
              <button
                onClick={onBackMobile}
                className="md:hidden p-2 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-slate-800 dark:text-emerald-400 transition-colors shrink-0 active:scale-90"
                title={lang === 'bn' ? 'ফিরে যান' : 'Back'}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* Avatar with Status Ring */}
            <div className="relative shrink-0">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-500/80 ring-offset-2 ${
                  isDark ? 'ring-offset-slate-900' : 'ring-offset-white'
                } ${
                  conversation.type === 'announcement'
                    ? 'bg-rose-500'
                    : conversation.type === 'class_group'
                    ? 'bg-teal-600'
                    : 'bg-emerald-600'
                }`}
              >
                {conversation.type === 'announcement' ? (
                  <Megaphone className="w-5 h-5" />
                ) : (
                  <Users className="w-5 h-5" />
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate leading-tight flex items-center gap-1.5">
                {conversation.name}
              </h2>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {conversation.type === 'class_group'
                  ? lang === 'bn' ? 'অনলাইন • ১০০ জন সদস্য' : 'Online • 100 Members'
                  : conversation.type === 'announcement'
                  ? lang === 'bn' ? 'অফিসিয়াল নোটিশ বোর্ড' : 'Official Notice Board'
                  : lang === 'bn' ? 'অনলাইন' : 'Online'}
              </p>
            </div>
          </div>

          {/* Right Header App Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleBellClick}
              className={`p-2.5 rounded-full transition-all active:scale-90 relative ${
                pushState === 'granted'
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                pushState === 'granted'
                  ? (lang === 'bn' ? 'পুশ নোটিফিকেশন চালূ আছে (টেস্ট ক্লিক করুন)' : 'Push active (Click to test)')
                  : (lang === 'bn' ? 'পুশ নোটিফিকেশন চালু করুন' : 'Enable Push Notifications')
              }
            >
              {pushState === 'granted' ? (
                <BellRing className="w-5 h-5 animate-bounce text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 rounded-full text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
              title={lang === 'bn' ? 'মেনু সেটিংস' : 'Menu Settings'}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Pinned Announcement Card Banner */}
      {showPinnedAnnouncement && conversation.type === 'class_group' && !isSelectMode && (
        <div className="m-3 mb-0 p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 flex items-start justify-between gap-3 shadow-sm backdrop-blur-md animate-in fade-in duration-300 z-10">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
              <Pin className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {lang === 'bn' ? 'পিন করা ঘোষণা (Announcement)' : 'Pinned Announcement'}
              </h4>
              <p className="text-xs text-emerald-950 dark:text-emerald-100 mt-0.5 font-medium leading-relaxed">
                {lang === 'bn'
                  ? 'আগামীকাল সকাল ১০টায় অভিভাবক সভা অনুষ্ঠিত হবে। সকল অভিভাবকের উপস্থিতি কাম্য।'
                  : 'Parents meeting will be held tomorrow at 10:00 AM.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPinnedAnnouncement(false)}
            className="text-emerald-400 hover:text-emerald-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5">
        
        {/* Date Separator Pill */}
        <div className="flex justify-center my-2">
          <span className="px-4 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
            Today, 21 Apr 2025
          </span>
        </div>

        {loading ? (
          <div className="text-center p-8 text-xs text-slate-400">
            {lang === 'bn' ? 'মেসেজ লোড হচ্ছে...' : 'Loading messages...'}
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center p-12 text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 mx-auto flex items-center justify-center">
              💬
            </div>
            <p className="text-xs font-medium">
              {lang === 'bn' ? 'এখনো কোনো মেসেজ নেই। প্রথম মেসেজটি লিখুন!' : 'No messages yet. Send a message!'}
            </p>
          </div>
        ) : (
          visibleMessages.map((m) => {
            const isMe = m.sender_id === currentUser?.id;
            const senderName = m.sender_profile?.full_name || (lang === 'bn' ? 'শিক্ষক / সদস্য' : 'Teacher/Member');
            const roleBadge = getRoleLabel(m.sender_profile?.role);
            const isSelected = selectedMsgIds.includes(m.id);
            const msgReactions = reactions[m.id] || [];

            // Replied target message if any
            const repliedTarget = m.reply_to_message_id
              ? localMessages.find(msg => msg.id === m.reply_to_message_id)
              : m.reply_to_message;

            return (
              <div
                key={m.id}
                onTouchStart={() => handleTouchStart(m)}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                  if (isSelectMode) {
                    toggleSelectMessage(m.id);
                  }
                }}
                className={`flex items-start gap-2 max-w-[92%] sm:max-w-[80%] transition-all cursor-pointer group ${
                  isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                } ${isSelected ? 'scale-[1.01] opacity-90' : ''}`}
              >
                {/* Selection Checkbox in Select Mode */}
                {isSelectMode && (
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 self-center transition-all ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-400 dark:border-slate-600 bg-white/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                )}

                {/* Sender Avatar for incoming messages */}
                {!isMe && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs mt-1">
                    {senderName.charAt(0)}
                  </div>
                )}

                {/* Bubble Container */}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0 relative group/bubble`}>
                  
                  {/* Sender Name & Role Badge (Incoming only) */}
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {senderName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        • {roleBadge}
                      </span>
                    </div>
                  )}

                  {/* WhatsApp/Telegram Native Style Message Bubble */}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative break-words ${
                      isMe
                        ? 'bg-gradient-to-br from-[#DCF8C6] to-[#C7F3C1] dark:from-[#005C4B] dark:to-[#004B3E] text-slate-900 dark:text-emerald-50 rounded-tr-xs border border-emerald-300/40 dark:border-emerald-600/30'
                        : isDark
                        ? 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700/80'
                        : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/80'
                    }`}
                  >
                    {/* Embedded Replied Message Quote Box */}
                    {repliedTarget && (
                      <div className="mb-2 p-2 px-2.5 rounded-xl bg-black/5 dark:bg-black/20 border-l-4 border-l-emerald-600 dark:border-l-teal-400 text-xs space-y-0.5">
                        <span className="font-bold text-[10px] text-emerald-700 dark:text-emerald-300 block">
                          {'sender_name' in repliedTarget && repliedTarget.sender_name
                            ? repliedTarget.sender_name
                            : 'sender_profile' in repliedTarget && repliedTarget.sender_profile?.full_name
                            ? repliedTarget.sender_profile.full_name
                            : lang === 'bn' ? 'সদস্য' : 'User'}
                        </span>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] truncate">
                          {repliedTarget.message}
                        </p>
                      </div>
                    )}

                    {/* Main Message Text */}
                    <p className={`whitespace-pre-wrap font-normal ${m.is_deleted ? 'italic text-slate-500' : ''}`}>
                      {m.message}
                    </p>

                    {/* Quick Reaction Bar Trigger Button */}
                    {!isSelectMode && (
                      <div className="absolute -top-3 right-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 shadow-md z-10">
                        {quickEmojiList.slice(0, 4).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReaction(m.id, emoji);
                            }}
                            className="hover:scale-125 transition-transform text-xs p-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenuMsg(m);
                          }}
                          className="p-0.5 text-slate-400 hover:text-emerald-600"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Bottom Timestamp & Delivery Status */}
                    <div
                      className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-medium ${
                        isMe ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {/* Star Indicator */}
                      {m.is_starred && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                      )}

                      {/* Edited Badge */}
                      {m.is_edited && (
                        <span className="text-[9px] text-slate-400 italic">
                          {lang === 'bn' ? 'সম্পাদিত' : 'edited'}
                        </span>
                      )}

                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {/* Double Checkmarks */}
                      {isMe && (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-600 dark:text-teal-300" />
                      )}
                    </div>
                  </div>

                  {/* Attached Emoji Reactions Badge Box */}
                  {msgReactions.length > 0 && (
                    <div className={`flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs text-[11px] ${
                      isMe ? 'self-end' : 'self-start'
                    }`}>
                      {msgReactions.map(emoji => (
                        <span key={emoji}>{emoji}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Input Composer */}
      <ChatComposer
        onSendMessage={onSendMessage}
        replyingToMessage={replyingToMsg}
        onCancelReply={() => setReplyingToMsg(null)}
        editingMessage={editingMsg}
        onCancelEdit={() => setEditingMsg(null)}
        onEditSubmit={handleEditSubmit}
        isAnnouncementOnly={conversation.is_announcement_only}
        userRole={userRole}
        lang={lang}
        isDark={isDark}
      />

      {/* Message Context Action Menu */}
      <MessageContextMenu
        message={contextMenuMsg}
        isOpen={!!contextMenuMsg}
        isMe={contextMenuMsg?.sender_id === currentUser?.id}
        lang={lang}
        isDark={isDark}
        onClose={() => setContextMenuMsg(null)}
        onReply={(msg) => setReplyingToMsg(msg)}
        onCopy={handleCopyMessage}
        onForward={(msg) => setForwardMsg(msg)}
        onStar={handleStarMessage}
        onSelectMode={(msg) => {
          setIsSelectMode(true);
          setSelectedMsgIds([msg.id]);
        }}
        onInfo={(msg) => setInfoMsg(msg)}
        onEdit={(msg) => setEditingMsg(msg)}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />

      {/* Message Info Modal */}
      <MessageInfoModal
        message={infoMsg}
        conversation={conversation}
        isOpen={!!infoMsg}
        onClose={() => setInfoMsg(null)}
        lang={lang}
        isDark={isDark}
      />

      {/* Forward Modal */}
      <ForwardModal
        message={forwardMsg}
        conversations={conversations.length > 0 ? conversations : [conversation]}
        isOpen={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
        onSendForward={handleForwardSend}
        lang={lang}
        isDark={isDark}
      />

      {/* Message Settings Modal */}
      <MessageSettingsModal
        conversation={conversation}
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onOpenStarredMessages={() => setShowStarredModal(true)}
        lang={lang}
        isDark={isDark}
      />

      {/* Starred Messages Modal */}
      <StarredMessagesModal
        messages={localMessages}
        isOpen={showStarredModal}
        onClose={() => setShowStarredModal(false)}
        lang={lang}
        isDark={isDark}
      />
    </div>
  );
};
