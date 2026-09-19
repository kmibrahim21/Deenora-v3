import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Sparkles, FileText, X, Reply, Edit3, Mic } from 'lucide-react';
import { ChatMessage } from '../../types';

interface ChatComposerProps {
  onSendMessage: (text: string, replyToMessageId?: string) => void;
  replyingToMessage?: ChatMessage | null;
  onCancelReply?: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onEditSubmit?: (msgId: string, newText: string) => void;
  onStartVoice?: () => void;
  disabled?: boolean;
  isAnnouncementOnly?: boolean;
  userRole?: string;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  replyingToMessage,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onEditSubmit,
  onStartVoice,
  disabled = false,
  isAnnouncementOnly = false,
  userRole,
  lang = 'bn',
  isDark = false,
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAttachmentTray, setShowAttachmentTray] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.message);
    }
  }, [editingMessage]);

  const canPost = !isAnnouncementOnly || userRole === 'super_admin' || userRole === 'madrasah_admin' || userRole === 'teacher';

  const popularEmojis = [
    '😊', '👍', '❤️', '🙏', '👏', '😂',
    '🕌', '📚', '✨', '🤲', '🎉', '📌',
    '📝', '💡', '📢', '💚', '🎯', '🔥',
    '🏆', '🌟', '⏱️', '📋', '✅', '⭐'
  ];

  const quickTemplates = [
    'আগামীকাল সকাল ১০টায় অভিভাবক সভা অনুষ্ঠিত হবে।',
    'সম্মানিত অভিভাবক, আপনার সন্তানের নিয়মিত উপস্থিতি নিশ্চিত করুন।',
    'আসন্ন পরীক্ষার রুটিন ও নোটিশ ড্যাশবোর্ডে প্রকাশ করা হয়েছে।',
    'সম্মানিত শিক্ষকবৃন্দ, আজকের হাজিরা শীট সময়মতো আপডেট করুন।',
  ];

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      setText((prev) => (prev ? `${prev} 📄 [${file.name}]` : `📄 [${file.name}]`));
      setShowAttachmentTray(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled || !canPost) return;

    if (editingMessage && onEditSubmit) {
      onEditSubmit(editingMessage.id, text.trim());
      onCancelEdit?.();
    } else {
      onSendMessage(text, replyingToMessage?.id);
      onCancelReply?.();
    }

    setText('');
    setSelectedFileName(null);
    setShowEmojiPicker(false);
    setShowTemplates(false);
    setShowAttachmentTray(false);
  };

  if (!canPost) {
    return (
      <div className={`p-4 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-t ${isDark ? 'border-amber-900/40' : 'border-amber-200'}`}>
        🔒 {lang === 'bn' ? 'শুধুমাত্র শিক্ষক ও এডমিন এই গ্রুপে বার্তা পাঠাতে পারেন।' : 'Only Teachers & Admins can post in this channel.'}
      </div>
    );
  }

  return (
    <div 
      className={`p-2 sm:p-3 border-t relative space-y-2 transition-all ${
        isDark ? 'bg-[#202C33] border-[#2A3942]' : 'bg-[#F0F2F5] border-[#E9EDEF]'
      }`}
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      
      {/* Hidden File Input for Documents */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        className="hidden"
      />

      {/* Real Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className={`absolute bottom-full left-2 right-2 sm:left-4 sm:right-4 mb-3 p-3.5 rounded-3xl shadow-2xl border z-30 backdrop-blur-2xl animate-in slide-in-from-bottom-3 duration-200 ${
          isDark ? 'bg-slate-800/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              😊 {lang === 'bn' ? 'ইমোজি রিএকশন' : 'Select Emoji'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  setShowEmojiPicker(false);
                }}
                className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'টেমপ্লেট' : 'Templates'}
              </button>
              <button onClick={() => setShowEmojiPicker(false)} className="text-xs text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">
            {popularEmojis.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-transform active:scale-125 flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Message Templates Popup */}
      {showTemplates && (
        <div className={`absolute bottom-full left-2 right-2 sm:left-4 sm:right-4 mb-3 p-3.5 rounded-3xl shadow-2xl border z-30 space-y-2 max-h-56 overflow-y-auto backdrop-blur-2xl ${
          isDark ? 'bg-slate-800/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> {lang === 'bn' ? 'দ্রুত বার্তা টেমপ্লেট' : 'Quick Templates'}
            </span>
            <button onClick={() => setShowTemplates(false)} className="text-xs text-slate-400 hover:text-slate-600 font-bold p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          {quickTemplates.map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setText(template);
                setShowTemplates(false);
              }}
              className="w-full text-left p-2.5 text-xs font-medium rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700/80 transition-colors"
            >
              • {template}
            </button>
          ))}
        </div>
      )}

      {/* Replying Message Preview Banner */}
      {replyingToMessage && (
        <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border-l-4 border-l-emerald-600 border border-emerald-100 dark:border-emerald-900 text-xs animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Reply className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                {lang === 'bn' ? 'রিপ্লাই দেওয়া হচ্ছে:' : 'Replying to'} {replyingToMessage.sender_profile?.full_name || (lang === 'bn' ? 'সদস্য' : 'User')}
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium truncate">
                {replyingToMessage.message || (lang === 'bn' ? '[সংযুক্ত ফাইল]' : '[Attachment]')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border-l-4 border-l-amber-500 border border-amber-100 dark:border-amber-900 text-xs animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                {lang === 'bn' ? 'মেসেজ এডিট করা হচ্ছে...' : 'Editing Message'}
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium truncate">
                {editingMessage.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected File Indicator Banner */}
      {selectedFileName && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-xs text-purple-700 dark:text-purple-300">
          <span className="flex items-center gap-1.5 truncate">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="font-semibold truncate">{selectedFileName}</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedFileName(null)}
            className="text-purple-500 hover:text-purple-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* WhatsApp Native Composer Form Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        
        {/* Rounded Input Pill */}
        <div className={`flex-1 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-[24px] shadow-xs border transition-all ${
          isDark
            ? 'bg-[#2A3942] border-[#384A54] text-[#E9EDEF]'
            : 'bg-white border-[#E9EDEF] text-[#111B21]'
        }`}>
          {/* Interactive Emoji Button */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowTemplates(false);
              setShowAttachmentTray(false);
            }}
            className="text-[#8696A0] hover:text-[#00A884] transition-colors shrink-0 active:scale-90"
            title={lang === 'bn' ? 'ইমোজি' : 'Emojis'}
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'bn' ? 'মেসেজ লিখুন...' : 'Type a message...'}
            className="flex-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none placeholder-[#8696A0] font-normal py-0.5"
          />

          {/* Attachment Paperclip */}
          <button
            type="button"
            onClick={() => {
              setShowAttachmentTray(!showAttachmentTray);
              setShowEmojiPicker(false);
              setShowTemplates(false);
            }}
            className="text-[#8696A0] hover:text-[#00A884] transition-colors shrink-0 -rotate-45 active:scale-90"
            title={lang === 'bn' ? 'ডকুমেন্ট ফাইল সংযুক্তি' : 'Attach Document'}
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Circular Action Button (Mic / Send) */}
        <button
          type={text.trim() ? "submit" : "button"}
          onClick={() => {
            if (!text.trim() && onStartVoice) {
              onStartVoice();
            }
          }}
          disabled={disabled}
          className="w-11 h-11 rounded-full bg-[#00A884] hover:bg-[#008F6F] text-white flex items-center justify-center shadow-md shrink-0 active:scale-90 transition-all"
        >
          {text.trim() ? (
            <Send className="w-5 h-5 ml-0.5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </form>

      {/* Attachment Tray: ONLY Document Option (As Requested) */}
      {showAttachmentTray && (
        <div className="flex justify-start pt-2 px-1 animate-in slide-in-from-bottom-2 duration-300">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-all border border-purple-200/80 dark:border-purple-800 shadow-xs group"
          >
            <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold block">{lang === 'bn' ? 'ডকুমেন্ট ফাইল (Document)' : 'Document File'}</span>
              <span className="text-[10px] text-purple-500 dark:text-purple-400">PDF, DOCX, XLSX, TXT</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
