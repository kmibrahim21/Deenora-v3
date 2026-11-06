import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Sparkles, FileText, X, Reply, Edit3, Mic } from 'lucide-react';
import { ChatMessage } from '../../types';

interface ChatComposerProps {
  onSendMessage: (
    text: string, 
    replyToMessageId?: string,
    messageType?: 'text' | 'image' | 'document' | 'voice',
    attachmentUrl?: string,
    voiceDuration?: number,
    attachmentName?: string,
    attachmentSize?: number
  ) => void;
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
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    dataUrl: string;
    type: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.message);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const canPost = !isAnnouncementOnly || userRole === 'super_admin' || userRole === 'madrasah_admin' || userRole === 'teacher';

  const popularEmojis = [
    '😊', '👍', '❤️', '🙏', '👏', '😂',
    '🕌', '📚', '✨', '🤲', '🎉', '📌',
    '📝', '💡', '📢', '💚', '🎯', '🔥',
    '🏆', '🌟', '⏱️', '📋', '✅', '⭐'
  ];

  // Quick Reply Pills (Design 2 floating pills above input composer)
  const quickReplyChips = lang === 'bn'
    ? [
        'জাযাকাল্লাহু খাইরান 🙏',
        'ফি রশিদ পাঠানো হলো 📄',
        'আলহামদুলিল্লাহ, ভালো আছি',
        'আগামীকাল উপস্থিত থাকবে ইনশাআল্লাহ',
      ]
    : [
        'JazakAllahu Khairan 🙏',
        'Fee Receipt Sent 📄',
        'Alhamdulillah',
        'Will attend tomorrow InshaAllah',
      ];

  const quickTemplates = [
    'আগামীকাল সকাল ১০টায় অভিভাবক সভা অনুষ্ঠিত হবে।',
    'সম্মানিত অভিভাবক, আপনার সন্তানের নিয়মিত উপস্থিতি নিশ্চিত করুন।',
    'আসন্ন পরীক্ষার রুটিন ও নোটিশ ড্যাশবোর্ডে প্রকাশ করা হয়েছে।',
    'সম্মানিত শিক্ষকবৃন্দ, আজকের হাজিরা শীট সময়মতো আপডেট করুন।',
  ];

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({
          name: file.name,
          size: file.size,
          dataUrl: reader.result as string,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
      setShowAttachmentTray(false);
      inputRef.current?.focus();
    }
    e.target.value = '';
  };

  const handleQuickReplySend = (chipText: string) => {
    if (disabled || !canPost) return;
    onSendMessage(chipText, replyingToMessage?.id, 'text');
    onCancelReply?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = Boolean(text.trim());
    const hasFile = Boolean(attachedFile);
    if ((!hasText && !hasFile) || disabled || !canPost) return;

    if (editingMessage && onEditSubmit) {
      onEditSubmit(editingMessage.id, text.trim());
      onCancelEdit?.();
    } else if (hasFile && attachedFile) {
      onSendMessage(
        text.trim(),
        replyingToMessage?.id,
        'document',
        attachedFile.dataUrl,
        undefined,
        attachedFile.name,
        attachedFile.size
      );
      onCancelReply?.();
    } else {
      onSendMessage(text.trim(), replyingToMessage?.id, 'text');
      onCancelReply?.();
    }

    setText('');
    setAttachedFile(null);
    setShowEmojiPicker(false);
    setShowTemplates(false);
    setShowAttachmentTray(false);
  };

  if (!canPost) {
    return (
      <div className={`p-4 text-center text-xs ${
        isDark 
          ? 'text-amber-400 bg-amber-950/20 border-amber-900/30' 
          : 'text-amber-700 bg-amber-50/90 border-amber-200/60'
      } border-t`}>
        🔒 {lang === 'bn' ? 'শুধুমাত্র শিক্ষক ও এডমিন এই চ্যানেলে বার্তা পাঠাতে পারেন।' : 'Only Teachers & Admins can post in this channel.'}
      </div>
    );
  }

  const isSendActive = Boolean(text.trim() || attachedFile);

  return (
    <div 
      className={`px-3 sm:px-5 pt-2 pb-3 relative space-y-2.5 transition-all z-20 ${
        isDark 
          ? 'bg-[#081529]/95 backdrop-blur-md border-t border-slate-800/80' 
          : 'bg-white/95 backdrop-blur-md border-t border-slate-200/80'
      }`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
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
        <div className={`absolute bottom-full left-3 right-3 sm:left-5 sm:right-auto sm:w-80 mb-3 p-3.5 rounded-3xl shadow-xl border z-30 backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200 ${
          isDark ? 'bg-slate-800/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'
        }`}>
          <div className={`flex items-center justify-between pb-2 mb-2 border-b ${
            isDark ? 'border-slate-700/60' : 'border-slate-200/60'
          }`}>
            <span className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'} flex items-center gap-1.5`}>
              😊 {lang === 'bn' ? 'ইমোজি রিএকশন' : 'Select Emoji'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  setShowEmojiPicker(false);
                }}
                className={`text-[11px] font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'} hover:underline flex items-center gap-1`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'টেমপ্লেট' : 'Templates'}
              </button>
              <button 
                onClick={() => setShowEmojiPicker(false)} 
                className={`p-1 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1 custom-scrollbar">
            {popularEmojis.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className={`text-xl p-1.5 rounded-xl ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-transform active:scale-125 flex items-center justify-center`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Message Templates Popup */}
      {showTemplates && (
        <div className={`absolute bottom-full left-3 right-3 sm:left-5 sm:right-auto sm:w-96 mb-3 p-3.5 rounded-3xl shadow-xl border z-30 space-y-2 max-h-56 overflow-y-auto backdrop-blur-xl ${
          isDark ? 'bg-slate-800/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'
        }`}>
          <div className={`flex items-center justify-between pb-1.5 border-b ${
            isDark ? 'border-slate-700/60' : 'border-slate-200/60'
          }`}>
            <span className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'} flex items-center gap-1.5`}>
              <Sparkles className="w-4 h-4" /> {lang === 'bn' ? 'দ্রুত বার্তা টেমপ্লেট' : 'Quick Templates'}
            </span>
            <button 
              onClick={() => setShowTemplates(false)} 
              className={`p-1 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {quickTemplates.map((template, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setText(template);
                  setShowTemplates(false);
                  inputRef.current?.focus();
                }}
                className={`w-full text-left p-2.5 text-xs font-medium rounded-xl transition-colors border ${
                  isDark 
                    ? 'text-slate-200 hover:bg-slate-700/80 border-transparent hover:border-slate-600' 
                    : 'text-slate-700 hover:bg-blue-50 border-transparent hover:border-blue-100'
                }`}
              >
                • {template}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Replying Message Preview Banner */}
      {replyingToMessage && (
        <div className={`flex items-center justify-between p-2.5 px-3.5 rounded-2xl border-l-4 border-l-blue-600 border text-xs animate-in slide-in-from-bottom-2 duration-150 ${
          isDark
            ? 'bg-blue-950/50 border-blue-900/60'
            : 'bg-blue-50/95 border-blue-200/80'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Reply className={`w-4 h-4 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {lang === 'bn' ? 'রিপ্লাই দেওয়া হচ্ছে:' : 'Replying to'} {replyingToMessage.sender_profile?.full_name || (lang === 'bn' ? 'সদস্য' : 'User')}
              </span>
              <p className={`font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {replyingToMessage.message || (lang === 'bn' ? '[সংযুক্ত ফাইল]' : '[Attachment]')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className={`p-1 rounded-full ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className={`flex items-center justify-between p-2.5 px-3.5 rounded-2xl border-l-4 border-l-amber-500 border text-xs animate-in slide-in-from-bottom-2 duration-150 ${
          isDark
            ? 'bg-amber-950/40 border-amber-900/60'
            : 'bg-amber-50/95 border-amber-200'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Edit3 className={`w-4 h-4 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-amber-400' : 'text-amber-600'
              }`}>
                {lang === 'bn' ? 'মেসেজ এডিট করা হচ্ছে...' : 'Editing Message'}
              </span>
              <p className={`font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {editingMessage.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className={`p-1 rounded-full ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attached File Indicator Banner */}
      {attachedFile && (
        <div className={`flex items-center justify-between p-2 sm:p-2.5 px-3.5 rounded-2xl border text-xs animate-in slide-in-from-bottom-2 duration-150 ${
          isDark
            ? 'bg-blue-950/60 border-blue-800 text-blue-200'
            : 'bg-blue-50/95 border-blue-200/90 text-blue-900'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs font-extrabold text-[10px]">
              PDF
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs truncate block select-all">{attachedFile.name}</span>
              <span className={`text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {(attachedFile.size / 1024).toFixed(0)} KB • {lang === 'bn' ? 'সংযুক্ত ডকুমেন্ট' : 'Attached Document'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className={`p-1.5 rounded-full transition-colors ${
              isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200/50'
            }`}
            title={lang === 'bn' ? 'ফাইল বাদ দিন' : 'Remove file'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Design 2 Floating Quick-Reply Chips (জাযাকাল্লাহু খাইরান | ফি রশিদ পাঠানো হলো) */}
      {!editingMessage && !attachedFile && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {quickReplyChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickReplySend(chip)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 shadow-2xs border cursor-pointer ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-blue-950/60 hover:border-blue-500/50 hover:text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Pill Input Composer Bar */}
      <form onSubmit={handleSubmit} className="flex items-center">
        <div
          className={`w-full flex items-center gap-1.5 sm:gap-2 pl-4 pr-1.5 py-1.5 rounded-full border transition-all ${
            isDark
              ? 'bg-slate-900 border-slate-700/80 focus-within:border-blue-500 shadow-lg'
              : 'bg-slate-50 border-slate-200/80 focus-within:bg-white focus-within:border-blue-500 shadow-2xs'
          }`}
        >
          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              attachedFile
                ? (lang === 'bn' ? 'ক্যাপশন লিখুন (ঐচ্ছিক)...' : 'Add a caption (optional)...')
                : (lang === 'bn' ? 'বার্তা লিখুন...' : 'Type a message...')
            }
            className={`flex-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none placeholder:text-slate-400 font-medium py-1.5 min-w-0 ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}
          />

          {/* Voice Record Icon (Mic) */}
          {onStartVoice && (
            <button
              type="button"
              onClick={onStartVoice}
              className={`p-2 rounded-full transition-colors shrink-0 active:scale-95 cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
              }`}
              title={lang === 'bn' ? 'ভয়েস রেকর্ড' : 'Voice Record'}
            >
              <Mic className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            </button>
          )}

          {/* Paperclip Document Attachment Icon */}
          <button
            type="button"
            onClick={() => {
              setShowAttachmentTray(!showAttachmentTray);
              setShowEmojiPicker(false);
              setShowTemplates(false);
            }}
            className={`p-2 rounded-full transition-colors shrink-0 active:scale-95 cursor-pointer ${
              showAttachmentTray
                ? isDark ? 'text-blue-400 bg-blue-950/50' : 'text-blue-600 bg-blue-50'
                : isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
            }`}
            title={lang === 'bn' ? 'ফাইল সংযুক্তি (PDF/Doc)' : 'Attach Document'}
          >
            <Paperclip className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </button>

          {/* Emoji Picker Icon */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowTemplates(false);
              setShowAttachmentTray(false);
            }}
            className={`p-2 rounded-full transition-colors shrink-0 active:scale-95 cursor-pointer ${
              showEmojiPicker
                ? isDark ? 'text-blue-400 bg-blue-950/50' : 'text-blue-600 bg-blue-50'
                : isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
            }`}
            title={lang === 'bn' ? 'ইমোজি' : 'Emojis'}
          >
            <Smile className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </button>

          {/* Send Button */}
          <button
            type={isSendActive ? 'submit' : 'button'}
            onClick={() => {
              if (!isSendActive && onStartVoice) {
                onStartVoice();
              }
            }}
            disabled={disabled}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title={isSendActive ? (lang === 'bn' ? 'পাঠান' : 'Send') : (lang === 'bn' ? 'ভয়েস পাঠান' : 'Send Voice')}
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      </form>

      {/* Attachment Tray: Document Option */}
      {showAttachmentTray && (
        <div className="flex justify-start pt-1 animate-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all shadow-sm group cursor-pointer border ${
              isDark 
                ? 'bg-slate-800 text-blue-300 hover:bg-slate-700/80 border-blue-900/40' 
                : 'bg-white text-blue-700 hover:bg-blue-50 border-blue-200/80'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold block">{lang === 'bn' ? 'ডকুমেন্ট ফাইল (PDF, Fee Receipt, Doc)' : 'Document File'}</span>
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>PDF, DOCX, XLSX, TXT</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
