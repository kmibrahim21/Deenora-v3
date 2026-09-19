import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Sparkles, FileText, X, Reply, Edit3, Mic, Plus } from 'lucide-react';
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
      <div className={`p-4 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/20 border-t ${
        isDark ? 'border-amber-900/30' : 'border-amber-200/60'
      }`}>
        🔒 {lang === 'bn' ? 'শুধুমাত্র শিক্ষক ও এডমিন এই চ্যানেলে বার্তা পাঠাতে পারেন।' : 'Only Teachers & Admins can post in this channel.'}
      </div>
    );
  }

  const isTextPresent = Boolean(text.trim());

  return (
    <div 
      className={`px-3 sm:px-4 py-2.5 sm:py-3 border-t relative space-y-2 transition-all ${
        isDark 
          ? 'bg-slate-900/90 backdrop-blur-md border-slate-800' 
          : 'bg-white/90 backdrop-blur-md border-slate-200/80'
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
        <div className={`absolute bottom-full left-3 right-3 sm:left-4 sm:right-auto sm:w-80 mb-3 p-3.5 rounded-3xl shadow-xl border z-30 backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200 ${
          isDark ? 'bg-slate-800/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              😊 {lang === 'bn' ? 'ইমোজি রিএকশন' : 'Select Emoji'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  setShowEmojiPicker(false);
                }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'টেমপ্লেট' : 'Templates'}
              </button>
              <button 
                onClick={() => setShowEmojiPicker(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
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
        <div className={`absolute bottom-full left-3 right-3 sm:left-4 sm:right-auto sm:w-96 mb-3 p-3.5 rounded-3xl shadow-xl border z-30 space-y-2 max-h-56 overflow-y-auto backdrop-blur-xl ${
          isDark ? 'bg-slate-800/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> {lang === 'bn' ? 'দ্রুত বার্তা টেমপ্লেট' : 'Quick Templates'}
            </span>
            <button 
              onClick={() => setShowTemplates(false)} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
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
                className="w-full text-left p-2.5 text-xs font-medium rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700/80 transition-colors text-slate-700 dark:text-slate-200 border border-transparent hover:border-blue-100 dark:hover:border-slate-600"
              >
                • {template}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Replying Message Preview Banner */}
      {replyingToMessage && (
        <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border-l-4 border-l-blue-600 border border-blue-100 dark:border-blue-900/60 text-xs animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Reply className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
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
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border-l-4 border-l-amber-500 border border-amber-100 dark:border-amber-900/60 text-xs animate-in slide-in-from-bottom-2 duration-150">
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
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attached File Indicator Banner */}
      {attachedFile && (
        <div className="flex items-center justify-between p-2 sm:p-2.5 px-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs truncate block select-all">{attachedFile.name}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                {(attachedFile.size / 1024).toFixed(0)} KB • {lang === 'bn' ? 'সংযুক্ত ডকুমেন্ট' : 'Attached Document'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            title={lang === 'bn' ? 'ফাইল বাদ দিন' : 'Remove file'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Modern Pill Input Surface */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-2.5">
        
        {/* Main Floating Pill Surface */}
        <div className={`flex-1 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl border transition-all ${
          isDark
            ? 'bg-slate-800/80 border-slate-700/70 focus-within:border-blue-500 focus-within:bg-slate-800'
            : 'bg-slate-50 border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-blue-500/5'
        }`}>
          
          {/* Attachment Button (+) */}
          <button
            type="button"
            onClick={() => {
              setShowAttachmentTray(!showAttachmentTray);
              setShowEmojiPicker(false);
              setShowTemplates(false);
            }}
            className={`p-1 rounded-xl transition-colors shrink-0 active:scale-95 ${
              showAttachmentTray
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/50'
                : 'text-slate-400 hover:text-blue-600'
            }`}
            title={lang === 'bn' ? 'ফাইল সংযুক্তি' : 'Attach Document'}
          >
            <Plus className="w-5 h-5" />
          </button>

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
            className="flex-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100 font-normal py-1"
          />

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowTemplates(false);
              setShowAttachmentTray(false);
            }}
            className={`p-1 rounded-xl transition-colors shrink-0 active:scale-95 ${
              showEmojiPicker 
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' 
                : 'text-slate-400 hover:text-blue-600'
            }`}
            title={lang === 'bn' ? 'ইমোজি' : 'Emojis'}
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        {/* Refined Deenora Action Button (Mic when empty / Send when typing or file attached) */}
        {(() => {
          const isSendActive = Boolean(text.trim() || attachedFile);
          return (
            <button
              type={isSendActive ? "submit" : "button"}
              onClick={() => {
                if (!isSendActive && onStartVoice) {
                  onStartVoice();
                }
              }}
              disabled={disabled}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 active:scale-90 ${
                isSendActive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/30'
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100/80 dark:hover:bg-blue-900/60'
              }`}
              title={isSendActive ? (lang === 'bn' ? 'পাঠান' : 'Send') : (lang === 'bn' ? 'ভয়েস রেকর্ড' : 'Voice Record')}
            >
              {isSendActive ? (
                <Send className="w-5 h-5 ml-0.5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          );
        })()}
      </form>

      {/* Attachment Tray: Document Option */}
      {showAttachmentTray && (
        <div className="flex justify-start pt-1.5 animate-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 transition-all border border-blue-200/60 dark:border-blue-800 shadow-xs group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold block">{lang === 'bn' ? 'ডকুমেন্ট ফাইল (PDF, Doc)' : 'Document File'}</span>
              <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">PDF, DOCX, XLSX, TXT</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

