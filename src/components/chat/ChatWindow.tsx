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
  Download,
  File,
  FileText,
  ExternalLink,
  MicOff,
  Square,
  Bell,
  BellRing,
  Send,
  Play,
  Pause,
  Mic,
  Volume2,
  VolumeX,
  Loader2,
  MessageSquare,
  Clock,
  AlertCircle,
  RefreshCw,
  Archive
} from 'lucide-react';
import { ChatArchiveService } from '../../services/chatArchiveService';

interface ChatWindowProps {
  conversation: Conversation | null;
  conversations?: Conversation[];
  messages: ChatMessage[];
  loading?: boolean;
  currentUser: Profile | null;
  userRole?: string;
  onSendMessage: (
    text: string, 
    replyToMessageId?: string,
    messageType?: 'text' | 'image' | 'document' | 'voice',
    attachmentUrl?: string,
    voiceDuration?: number,
    attachmentName?: string,
    attachmentSize?: number
  ) => void;
  onOpenInfo?: () => void;
  onBackMobile?: () => void;
  onStartVoiceCall?: () => void;
  onRetryMessage?: (clientMessageId: string) => void;
  onOpenBackup?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

const AudioPlayer: React.FC<{ url: string; duration?: number; isDark?: boolean; lang?: string; isMe?: boolean }> = ({ url, duration, isDark, lang, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDur, setTotalDur] = useState<number>(duration && duration > 0 ? duration : 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (duration && duration > 0) {
      setTotalDur(duration);
    }
  }, [duration]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !url) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Audio play error:", err);
        setIsPlaying(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const effectiveDuration = totalDur || (audioRef.current?.duration && isFinite(audioRef.current.duration) ? audioRef.current.duration : 1);
  const progressRatio = Math.min(1, Math.max(0, currentTime / effectiveDuration));

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !effectiveDuration || effectiveDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * effectiveDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 16 stylized waveform bar heights
  const waveformBars = [40, 65, 30, 85, 95, 55, 75, 45, 90, 60, 35, 80, 100, 70, 50, 65];

  if (!url) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-xl text-xs ${
        isMe ? 'bg-white/10 text-white/70' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
      }`}>
        <VolumeX className="w-4 h-4 text-slate-400" />
        <span>{lang === 'bn' ? 'অডিও ফাইল উপলব্ধ নয়' : 'Audio unavailable'}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl min-w-[180px] sm:min-w-[240px] max-w-full overflow-hidden select-none ${
      isMe ? 'bg-white/15 text-white' : 'bg-slate-100/90 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100'
    }`}>
      <button 
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer ${
          isMe 
            ? 'bg-white text-blue-600' 
            : 'bg-blue-600 text-white'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5 cursor-pointer" onClick={handleSeek}>
        {/* Waveform Visualization Bars */}
        <div className="flex items-center gap-0.5 sm:gap-1 h-6">
          {waveformBars.map((heightPercent, idx) => {
            const barProgress = idx / waveformBars.length;
            const isFilled = barProgress <= progressRatio;
            return (
              <div
                key={idx}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isMe
                    ? isFilled ? 'bg-white' : 'bg-white/40'
                    : isFilled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                style={{ height: `${heightPercent}%`, minWidth: '2px' }}
              />
            );
          })}
        </div>

        {/* Time duration indicator */}
        <div className={`flex justify-between text-[10px] font-medium font-mono ${
          isMe ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
        }`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDur || (audioRef.current?.duration && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0))}</span>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={(e) => setCurrentTime((e.target as any).currentTime)}
        onLoadedMetadata={(e) => {
          const d = (e.target as any).duration;
          if (d && isFinite(d) && d > 0) {
            setTotalDur(Math.round(d));
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => setIsPlaying(false)}
        className="hidden"
        preload="metadata"
      />
    </div>
  );
};

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
  onStartVoiceCall,
  onRetryMessage,
  onOpenBackup,
  lang = 'bn',
  isDark = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

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

  // V3 Archive Integration: Track archived count and load into view
  const [archivedCountForConv, setArchivedCountForConv] = useState<number>(0);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [hasLoadedArchived, setHasLoadedArchived] = useState(false);

  useEffect(() => {
    if (conversation?.institution_id && conversation?.id) {
      ChatArchiveService.getArchivedMessageCountForConv(conversation.institution_id, conversation.id)
        .then(count => setArchivedCountForConv(count))
        .catch(() => setArchivedCountForConv(0));
      setHasLoadedArchived(false);
    }
  }, [conversation?.institution_id, conversation?.id]);

  const handleLoadArchivedHistory = async () => {
    if (!conversation?.institution_id || !conversation?.id) return;
    setIsLoadingArchived(true);
    try {
      const cached = await ChatArchiveService.getCachedArchivedMessages(
        conversation.institution_id,
        conversation.id
      );
      if (cached.length > 0) {
        setLocalMessages(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = cached.filter(c => !existingIds.has(c.id));
          return [...newUnique, ...prev].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
        setHasLoadedArchived(true);
        setToastMessage(lang === 'bn' ? `${cached.length} টি আর্কাইভকৃত বার্তা লোড করা হয়েছে` : `${cached.length} archived messages loaded`);
      } else {
        if (onOpenBackup) {
          onOpenBackup();
        } else {
          setToastMessage(lang === 'bn' ? 'আর্কাইভ ফাইল থেকে রিস্টোর করতে ব্যাকআপ মেনু খুলুন' : 'Open backup menu to restore archive');
        }
      }
    } catch (e) {
      setToastMessage(lang === 'bn' ? 'আর্কাইভ লোড করা সম্ভব হয়নি' : 'Could not load archive');
    } finally {
      setIsLoadingArchived(false);
    }
  };

  useEffect(() => {
    setPushState(getNotificationPermissionState());
  }, []);

  const handleBellClick = async () => {
    const res = await requestPushNotificationPermission();
    setPushState('granted');
    playNotificationSound();
    sendPushNotification(
      'Deenora Live Chat 🔔',
      `পুশ নোটিফিকেশন সচল করা হয়েছে। ${conversation?.name || ''} এর সকল মেসেজের অ্যালার্ট পাবেন।`
    );
    setToastMessage(lang === 'bn' ? 'পুশ নোটিফিকেশন চালু করা হয়েছে! 🔔' : 'Push notifications enabled! 🔔');
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

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingDurationRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType });
        const finalDuration = recordingDurationRef.current || 1;

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSendMessage(
            lang === 'bn' ? '🎤 ভয়েস মেসেজ' : '🎤 Voice message',
            undefined,
            'voice',
            base64Audio,
            finalDuration
          );
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setToastMessage(lang === 'bn' ? 'মাইক্রোফোন এক্সেস করা সম্ভব হয়নি' : 'Could not access microphone');
    }
  };

  const stopRecording = (cancel = false) => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.onstop = null;
      } else {
        try {
          if (typeof mediaRecorderRef.current.requestData === 'function') {
            mediaRecorderRef.current.requestData();
          }
        } catch {}
      }
      mediaRecorderRef.current.stop();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const linkify = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:no-underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
            <ExternalLink className="inline-block w-3 h-3 ml-1" />
          </a>
        );
      }
      return part;
    });
  };

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
  const handleTouchStart = (msg: ChatMessage, e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    }
    touchTimerRef.current = setTimeout(() => {
      setContextMenuMsg(msg);
      touchTimerRef.current = null;
    }, 500); // 500ms long press threshold
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        // User is scrolling: cancel long press immediately to avoid freezing screen
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = null;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    touchStartPos.current = null;
  };

  const visibleMessages = localMessages.filter(m => !m.deleted_for_me);
  const quickEmojiList = ['👍', '❤️', '😂', '😮', '🙏', '🕌'];

  const getMessageDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      if (isToday) return lang === 'bn' ? 'আজ' : 'TODAY';
      if (isYesterday) return lang === 'bn' ? 'গতকাল' : 'YESTERDAY';
      return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        day: 'numeric',
        month: 'short',
      }).toUpperCase();
    } catch {
      return lang === 'bn' ? 'আজ' : 'TODAY';
    }
  };

  let lastDateLabel = '';

  if (!conversation) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50/70 text-slate-800'
      }`}>
        {loading ? (
          <div className="flex flex-col items-center max-w-xs animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 ring-1 ring-blue-500/20 shadow-sm shadow-blue-500/10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
            </div>
            <h3 className="text-base font-bold font-noto text-slate-900 dark:text-slate-100 mb-1">
              {lang === 'bn' ? 'কনভারসেশন লোড হচ্ছে...' : 'Loading conversation...'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-noto">
              {lang === 'bn' ? 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন' : 'Please wait a moment...'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center max-w-xs">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold font-noto text-slate-800 dark:text-slate-200 mb-1">
              {lang === 'bn' ? 'কোনো চ্যাট নির্বাচন করা হয়নি' : 'No conversation selected'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-noto">
              {lang === 'bn' ? 'বাম পাশের তালিকা থেকে একটি গ্রুপ বা চ্যাট নির্বাচন করুন' : 'Select a group or chat from the sidebar to start messaging'}
            </p>
          </div>
        )}
      </div>
    );
  }

  const teacherCount = conversation.members?.filter(m => m.profile?.role === 'teacher' || m.profile?.role === 'madrasah_admin').length || 2;
  const guardianCount = conversation.members?.filter(m => m.profile?.role === 'parent').length || 98;

  return (
    <div className={`flex-1 flex flex-col h-full relative ${
      isDark
        ? 'bg-slate-950 text-slate-100'
        : 'bg-slate-50/70 text-slate-800'
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
        <div className="p-3 px-4 bg-blue-600 text-white flex items-center justify-between shadow-md z-30">
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
        /* Elegant Compact Header (No giant blue toolbar) */
        <div 
          className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sticky top-0 z-30 transition-colors backdrop-blur-md border-b shadow-2xs ${
            isDark 
              ? 'bg-slate-900/95 border-slate-800 text-slate-100' 
              : 'bg-white/95 border-slate-200/80 text-slate-800'
          }`}
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onBackMobile && (
              <button
                onClick={onBackMobile}
                className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all shrink-0"
                title={lang === 'bn' ? 'ফিরে যান' : 'Back'}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* Avatar */}
            <div className="relative shrink-0 cursor-pointer" onClick={onOpenInfo}>
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs ${
                  conversation.type === 'announcement'
                    ? 'bg-gradient-to-tr from-amber-500 to-rose-500'
                    : conversation.type === 'class_group'
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                    : 'bg-gradient-to-tr from-blue-500 to-cyan-500'
                }`}
              >
                {conversation.type === 'announcement' ? (
                  <Megaphone className="w-4 h-4" />
                ) : conversation.type === 'class_group' ? (
                  <Users className="w-4 h-4" />
                ) : (
                  conversation.name.charAt(0)
                )}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ${isDark ? 'ring-slate-900' : 'ring-white'}`} />
            </div>

            <div className="min-w-0 cursor-pointer" onClick={onOpenInfo}>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate leading-snug">
                {conversation.name}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                {conversation.type === 'class_group' ? (
                  <span>
                    {guardianCount} {lang === 'bn' ? 'অভিভাবক' : 'guardians'} · {teacherCount} {lang === 'bn' ? 'শিক্ষক' : 'teachers'}
                  </span>
                ) : conversation.type === 'announcement' ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {lang === 'bn' ? 'প্রাতিষ্ঠানিক নোটিশ বোর্ড' : 'Official Notice Board'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {lang === 'bn' ? 'সক্রিয় (Active)' : 'Active now'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 shrink-0">
            {onStartVoiceCall && (
              <button
                onClick={onStartVoiceCall}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                title={lang === 'bn' ? 'ভয়েস কল' : 'Voice Call'}
              >
                <PhoneCall className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleBellClick}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all relative"
              title={
                pushState === 'granted'
                  ? (lang === 'bn' ? 'নোটিফিকেশন সক্রিয়' : 'Push active')
                  : (lang === 'bn' ? 'নোটিফিকেশন চালু করুন' : 'Enable Push')
              }
            >
              {pushState === 'granted' ? (
                <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
              title={lang === 'bn' ? 'মেনু সেটিংস' : 'Menu Settings'}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pinned Announcement Card Banner */}
      {showPinnedAnnouncement && conversation.type === 'class_group' && !isSelectMode && (
        <div className="m-3 mb-0 p-3 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-start justify-between gap-3 shadow-2xs backdrop-blur-md animate-in fade-in duration-200 z-10">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
              <Pin className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300">
                {lang === 'bn' ? 'পিন করা ঘোষণা (Pinned Announcement)' : 'Pinned Announcement'}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 font-medium leading-relaxed">
                {lang === 'bn'
                  ? 'আগামীকাল সকাল ১০টায় অভিভাবক সভা অনুষ্ঠিত হবে। সকল অভিভাবকের উপস্থিতি কাম্য।'
                  : 'Parents meeting will be held tomorrow at 10:00 AM. All guardians are requested to attend.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPinnedAnnouncement(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div 
        ref={scrollRef} 
        className={`flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 relative ${
          isDark 
            ? 'bg-slate-950 text-slate-100' 
            : 'bg-slate-50/70 text-slate-800'
        }`}
        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="space-y-4 py-4 animate-pulse">
            <div className="flex items-start gap-2 max-w-[70%]">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="p-4 rounded-2xl rounded-tl-none bg-slate-200 dark:bg-slate-800 w-48 h-14" />
            </div>
            <div className="flex items-start gap-2 max-w-[70%] ml-auto flex-row-reverse">
              <div className="p-4 rounded-2xl rounded-tr-none bg-blue-100 dark:bg-blue-950/60 w-56 h-16" />
            </div>
            <div className="flex items-start gap-2 max-w-[70%]">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="p-4 rounded-2xl rounded-tl-none bg-slate-200 dark:bg-slate-800 w-64 h-12" />
            </div>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center shadow-xs">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {lang === 'bn' ? 'কোনো বার্তা নেই' : 'No messages yet'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {lang === 'bn' ? 'এই কথোপকথনে প্রথম বার্তাটি পাঠিয়ে আলোচনা শুরু করুন।' : "Your institution's conversations will appear here. Start the discussion!"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Archived Messages Banner (V3 Optimization) */}
            {archivedCountForConv > 0 && !hasLoadedArchived && (
              <div className="flex justify-center my-2">
                <button
                  type="button"
                  onClick={handleLoadArchivedHistory}
                  disabled={isLoadingArchived}
                  className="px-3 py-1.5 rounded-full bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {isLoadingArchived ? (
                    <span>{lang === 'bn' ? 'আর্কাইভ লোড হচ্ছে...' : 'Loading archive...'}</span>
                  ) : (
                    <span>
                      {lang === 'bn'
                        ? `${archivedCountForConv} টি পূর্ববর্তী বার্তা লোড করুন`
                        : `Load ${archivedCountForConv} archived messages`}
                    </span>
                  )}
                </button>
              </div>
            )}

            {visibleMessages.map((m) => {
            const isMe = m.sender_id === currentUser?.id;
            const senderName = m.sender_profile?.full_name || (m as any).sender_name || (lang === 'bn' ? 'শিক্ষক / সদস্য' : 'Teacher/Member');
            const role = m.sender_profile?.role || ((m as any).sender_id?.startsWith('parent') ? 'parent' : 'teacher');
            const isTeacherOrAdmin = role === 'teacher' || role === 'madrasah_admin' || role === 'super_admin';
            const roleBadge = getRoleLabel(role);
            const isSelected = selectedMsgIds.includes(m.id);
            const msgReactions = reactions[m.id] || [];

            // Replied target message if any
            const repliedTarget = m.reply_to_message_id
              ? localMessages.find(msg => msg.id === m.reply_to_message_id)
              : m.reply_to_message;

            const messageDateLabel = getMessageDateLabel(m.created_at);
            const showDateHeader = messageDateLabel !== lastDateLabel;
            if (showDateHeader) {
              lastDateLabel = messageDateLabel;
            }

            return (
              <React.Fragment key={m.id}>
                {showDateHeader && (
                  <div className="flex justify-center my-3 sticky top-2 z-10 pointer-events-none">
                    <span className="px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-2xs border border-slate-200/80 dark:border-slate-700/80">
                      {messageDateLabel}
                    </span>
                  </div>
                )}

                <div
                  onTouchStart={(e) => handleTouchStart(m, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelectMessage(m.id);
                    }
                  }}
                  className={`flex items-start gap-2 max-w-[85%] sm:max-w-[75%] md:max-w-[420px] transition-all cursor-pointer group ${
                    isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  } ${isSelected ? 'scale-[1.01] opacity-90' : ''}`}
                >
                  {/* Selection Checkbox in Select Mode */}
                  {isSelectMode && (
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 self-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-400 dark:border-slate-600 bg-white/50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  )}

                  {/* Sender Avatar for incoming messages */}
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-1">
                      {senderName.charAt(0)}
                    </div>
                  )}

                  {/* Bubble Container */}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0 max-w-full relative group/bubble`}>
                    
                    {/* Sender Name & Role Badge (Incoming only) */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {senderName}
                        </span>
                        {isTeacherOrAdmin ? (
                          <span className="px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[9px] font-bold border border-blue-100 dark:border-blue-900/40">
                            {roleBadge}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            • {roleBadge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Brand Style Message Bubble */}
                    <div
                      className={`px-3 sm:px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs relative break-words max-w-full overflow-hidden ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-xs ml-auto shadow-sm shadow-blue-500/20'
                          : isDark
                          ? 'bg-slate-850 border border-slate-800 text-slate-100 rounded-tl-xs'
                          : 'bg-white border border-slate-200/80 text-slate-900 rounded-tl-xs'
                      }`}
                    >
                      {/* Embedded Replied Message Quote Box */}
                      {repliedTarget && (
                        <div className={`mb-2 p-2 px-2.5 rounded-xl border-l-4 text-xs space-y-0.5 ${
                          isMe ? 'bg-white/15 border-l-white/60' : 'bg-slate-100 dark:bg-slate-800 border-l-blue-600 dark:border-l-blue-400'
                        }`}>
                          <span className={`font-bold text-[10px] block ${
                            isMe ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                          }`}>
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

                      {/* Main Message Content */}
                      <div className={`space-y-1.5 min-w-0 max-w-full overflow-hidden ${m.is_deleted ? 'italic text-slate-500' : ''}`}>
                        {(() => {
                          // Extract audio URL if stored in attachment_url or message JSON
                          const extractAudioUrl = (): string => {
                            if (m.attachment_url) return m.attachment_url;
                            if (typeof m.message === 'string' && (m.message.startsWith('{') || m.message.startsWith('['))) {
                              try {
                                const p = JSON.parse(m.message);
                                return p.attachment_url || p.voice_url || p.audio_url || '';
                              } catch {}
                            }
                            return '';
                          };

                          const voiceUrl = extractAudioUrl();
                          const isVoiceMessage = !m.is_deleted && (
                            m.message_type === 'voice' ||
                            Boolean(m.voice_duration) ||
                            Boolean(voiceUrl && (voiceUrl.startsWith('data:audio') || voiceUrl.includes('chat-audio') || voiceUrl.includes('.webm') || voiceUrl.includes('.mp3') || voiceUrl.includes('.ogg') || voiceUrl.includes('.wav') || voiceUrl.includes('.m4a'))) ||
                            (typeof m.message === 'string' && (m.message.includes('🎤 ভয়েস মেসেজ') || m.message.includes('🎤 Voice') || m.message.includes('"message_type":"voice"')))
                          );

                          const isDocMessage = !m.is_deleted && !isVoiceMessage && (
                            m.message_type === 'document' || 
                            Boolean(m.attachment_name) || 
                            m.message.includes('📄 [') || 
                            m.message.includes('.pdf') || 
                            m.message.includes('.docx') || 
                            m.message.includes('.xlsx') || 
                            m.message.startsWith('Receipt_') ||
                            Boolean(m.attachment_url)
                          );

                          const docFileName = m.attachment_name || 
                            m.message.match(/\[(.*?)\]/)?.[1] || 
                            (m.message.startsWith('Receipt_') || m.message.endsWith('.pdf') || m.message.endsWith('.docx') 
                              ? m.message.trim() 
                              : (lang === 'bn' ? 'ডকুমেন্ট ফাইল' : 'Document File'));

                          const fileExt = (docFileName.split('.').pop() || 'PDF').toUpperCase();

                          // Check if message is ONLY a document pointer/placeholder (like "📄 [Receipt...pdf]" or "[Receipt...pdf]" or "Receipt_...")
                          const rawCaption = m.message
                            .replace(/📄?\s*\[.*?\]/g, '')
                            .replace(docFileName, '')
                            .replace(/Receipt_[^\s]+/g, '')
                            .trim();

                          const hasRealCaption = !isDocMessage && !isVoiceMessage;

                          return (
                            <>
                              {/* Document Attachment Card */}
                              {isDocMessage && (
                                <div className={`flex items-center gap-2.5 sm:gap-3 p-2.5 rounded-xl border mb-1.5 w-full max-w-full overflow-hidden transition-all ${
                                  isMe 
                                    ? 'bg-black/15 border-white/20 hover:bg-black/25 text-white' 
                                    : isDark 
                                    ? 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800 text-slate-100' 
                                    : 'bg-slate-50 border-slate-200/90 hover:bg-slate-100/90 text-slate-800'
                                }`}>
                                  {/* File Type Icon Badge */}
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold shadow-xs ${
                                    fileExt === 'PDF'
                                      ? isMe ? 'bg-rose-500/30 text-rose-100 border border-rose-300/30' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50'
                                      : fileExt === 'DOC' || fileExt === 'DOCX'
                                      ? isMe ? 'bg-blue-500/30 text-blue-100 border border-blue-300/30' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/50'
                                      : fileExt === 'XLS' || fileExt === 'XLSX'
                                      ? isMe ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-300/30' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/50'
                                      : isMe ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'
                                  }`}>
                                    <FileText className="w-5 h-5 stroke-[2]" />
                                  </div>

                                  {/* File Metadata */}
                                  <div className="flex-1 min-w-0 pr-1 overflow-hidden">
                                    <p 
                                      className="text-xs sm:text-sm font-bold truncate leading-tight tracking-tight select-all block"
                                      title={docFileName}
                                    >
                                      {docFileName}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium opacity-75">
                                      <span className="font-mono uppercase font-bold text-[9px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                                        {fileExt}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {m.attachment_size 
                                          ? `${(m.attachment_size / 1024).toFixed(0)} KB` 
                                          : (lang === 'bn' ? 'ডকুমেন্ট ফাইল' : 'Document File')}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Download / Open Action */}
                                  <a
                                    href={m.attachment_url || '#'}
                                    download={docFileName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`w-9 h-9 rounded-xl shrink-0 transition-transform active:scale-90 flex items-center justify-center ${
                                      isMe 
                                        ? 'bg-white/20 hover:bg-white/30 text-white' 
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                    }`}
                                    title={lang === 'bn' ? 'ডাউনলোড করুন' : 'Download'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!m.attachment_url) {
                                        setToastMessage(lang === 'bn' ? 'ফাইল ডাউনলোড শুরু হচ্ছে...' : 'Starting download...');
                                      }
                                    }}
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              )}

                              {/* Voice Message Rendering */}
                              {isVoiceMessage && (
                                <AudioPlayer 
                                  url={voiceUrl} 
                                  duration={m.voice_duration} 
                                  isDark={isDark}
                                  lang={lang}
                                  isMe={isMe}
                                />
                              )}

                              {/* Caption / Text Rendering (Hidden if message is only the document placeholder or voice) */}
                              {hasRealCaption && (
                                <p className="whitespace-pre-wrap font-normal break-words leading-relaxed text-xs sm:text-sm">
                                  {m.is_deleted ? m.message : linkify(isDocMessage ? rawCaption : m.message)}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>

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
                            className="p-0.5 text-slate-400 hover:text-blue-600"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Bottom Timestamp & Delivery Status */}
                      <div
                        className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-medium ${
                          isMe ? 'text-blue-100/75' : 'text-slate-400'
                        }`}
                      >
                        {/* Star Indicator */}
                        {m.is_starred && (
                          <Star className={`w-3 h-3 fill-current shrink-0 ${isMe ? 'text-white' : 'text-amber-500'}`} />
                        )}

                        {/* Edited Badge */}
                        {m.is_edited && (
                          <span className={`text-[9px] italic ${isMe ? 'text-blue-100/60' : 'text-slate-400'}`}>
                            {lang === 'bn' ? 'সম্পাদিত' : 'edited'}
                          </span>
                        )}

                        <span>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {/* Delivery Status */}
                        {isMe && (
                          m.status === 'failed' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onRetryMessage && (m.client_message_id || m.id)) {
                                  onRetryMessage(m.client_message_id || m.id);
                                }
                              }}
                              className="flex items-center gap-1 text-rose-300 hover:text-white bg-rose-900/50 hover:bg-rose-800/80 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="পাঠানো যায়নি — পুনরায় চেষ্টা করতে ক্লিক করুন"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                              <span>পুনরায় পাঠান</span>
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          ) : (m.status === 'pending' || m.status === 'sending' || m.synced === 0) ? (
                            <span className="flex items-center gap-0.5 text-white/60" title="পাঠানো হচ্ছে...">
                              <Clock className="w-3.5 h-3.5 text-white/70 animate-pulse" />
                            </span>
                          ) : (m.status === 'read' || m.read_at) ? (
                            <span title="পড়া হয়েছে (Read)">
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                            </span>
                          ) : (m.status === 'delivered' || m.delivered_at) ? (
                            <span title="পৌঁছেছে (Delivered)">
                              <CheckCheck className="w-3.5 h-3.5 text-white" />
                            </span>
                          ) : (
                            <span title="সার্ভারে পাঠানো হয়েছে (Sent)">
                              <Check className="w-3.5 h-3.5 text-white/80" />
                            </span>
                          )
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
              </React.Fragment>
            );
          })}
          </>
        )}
      </div>

      {/* Floating Input Composer */}
      {isRecording ? (
        <div className={`p-3 px-4 border-t flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center gap-3 text-rose-500 font-bold animate-pulse">
            <div className="w-3 h-3 bg-rose-500 rounded-full" />
            <span className="text-sm font-mono">{formatDuration(recordingDuration)}</span>
          </div>
          <div className="flex-1 text-center text-xs text-slate-500">
            {lang === 'bn' ? 'ভয়েস রেকর্ড হচ্ছে...' : 'Recording voice message...'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => stopRecording(true)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => stopRecording(false)}
              className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <ChatComposer
          onSendMessage={onSendMessage}
          replyingToMessage={replyingToMsg}
          onCancelReply={() => setReplyingToMsg(null)}
          editingMessage={editingMsg}
          onCancelEdit={() => setEditingMsg(null)}
          onEditSubmit={handleEditSubmit}
          onStartVoice={() => startRecording()}
          isAnnouncementOnly={conversation.is_announcement_only}
          userRole={userRole}
          lang={lang}
          isDark={isDark}
        />
      )}

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
        onOpenBackup={onOpenBackup}
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
