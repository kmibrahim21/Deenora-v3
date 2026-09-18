import React from 'react';
import { 
  Reply, 
  Copy, 
  Forward, 
  Star, 
  CheckSquare, 
  Info, 
  Edit3, 
  Trash2, 
  X,
  Share2
} from 'lucide-react';
import { ChatMessage } from '../../types';

interface MessageContextMenuProps {
  message: ChatMessage | null;
  isOpen: boolean;
  isMe: boolean;
  lang?: 'bn' | 'en';
  isDark?: boolean;
  onClose: () => void;
  onReply: (msg: ChatMessage) => void;
  onCopy: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onStar: (msg: ChatMessage) => void;
  onSelectMode: (msg: ChatMessage) => void;
  onInfo: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onDeleteForMe: (msg: ChatMessage) => void;
  onDeleteForEveryone?: (msg: ChatMessage) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isOpen,
  isMe,
  lang = 'bn',
  isDark = false,
  onClose,
  onReply,
  onCopy,
  onForward,
  onStar,
  onSelectMode,
  onInfo,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  if (!isOpen || !message) return null;

  const isStarred = message.is_starred;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[220] flex flex-col justify-end md:justify-center md:items-center bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Click Outside Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container (Bottom sheet on Mobile, Popover modal on Desktop) */}
      <div 
        className={`relative z-10 w-full md:max-w-xs bg-white dark:bg-slate-900 border-t md:border border-slate-200/80 dark:border-slate-800 rounded-t-[2rem] md:rounded-3xl p-4 shadow-2xl space-y-1 animate-in slide-in-from-bottom-5 duration-250 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        {/* Mobile Handle Drag Bar */}
        <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3 md:hidden" />

        {/* Header Preview Snippet */}
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-slate-800 px-2">
          <div className="truncate pr-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
              {lang === 'bn' ? 'মেসেজ অ্যাকশন' : 'Message Actions'}
            </span>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
              "{message.message || (lang === 'bn' ? 'সংযুক্ত মিডিয়া' : 'Attachment')}"
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List Items (min 44px height for touch targets) */}
        <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
          {/* Reply */}
          <button
            type="button"
            onClick={() => handleAction(() => onReply(message))}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
          >
            <Reply className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{lang === 'bn' ? 'উত্তর দিন (Reply)' : 'Reply'}</span>
          </button>

          {/* Copy */}
          {message.message && (
            <button
              type="button"
              onClick={() => handleAction(() => onCopy(message))}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
            >
              <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>{lang === 'bn' ? 'কপি করুন (Copy)' : 'Copy'}</span>
            </button>
          )}

          {/* Forward */}
          <button
            type="button"
            onClick={() => handleAction(() => onForward(message))}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
          >
            <Forward className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{lang === 'bn' ? 'ফরোয়ার্ড করুন (Forward)' : 'Forward'}</span>
          </button>

          {/* Star / Unstar */}
          <button
            type="button"
            onClick={() => handleAction(() => onStar(message))}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-500' : 'text-slate-600 dark:text-slate-400'}`} />
            <span>
              {isStarred 
                ? (lang === 'bn' ? 'স্টার রিমুভ (Unstar)' : 'Unstar') 
                : (lang === 'bn' ? 'স্টার দিন (Star)' : 'Star')}
            </span>
          </button>

          {/* Select Mode */}
          <button
            type="button"
            onClick={() => handleAction(() => onSelectMode(message))}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
          >
            <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{lang === 'bn' ? 'সিলেক্ট করুন (Select)' : 'Select'}</span>
          </button>

          {/* Message Info */}
          <button
            type="button"
            onClick={() => handleAction(() => onInfo(message))}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
          >
            <Info className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{lang === 'bn' ? 'মেসেজ ইনফো (Message Info)' : 'Message Info'}</span>
          </button>

          {/* Edit (Sent messages only) */}
          {isMe && onEdit && !message.is_deleted && (
            <button
              type="button"
              onClick={() => handleAction(() => onEdit(message))}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
            >
              <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{lang === 'bn' ? 'এডিট করুন (Edit)' : 'Edit'}</span>
            </button>
          )}

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          {/* Delete for me */}
          <button
            type="button"
            onClick={() => handleAction(() => onDeleteForMe(message))}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
          >
            <Trash2 className="w-4 h-4" />
            <span>{lang === 'bn' ? 'আমার জন্য মুছুন (Delete for me)' : 'Delete for me'}</span>
          </button>

          {/* Delete for everyone (Sent messages only) */}
          {isMe && onDeleteForEveryone && !message.is_deleted && (
            <button
              type="button"
              onClick={() => handleAction(() => onDeleteForEveryone(message))}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-3 text-xs font-semibold transition-colors active:scale-98"
            >
              <Trash2 className="w-4 h-4" />
              <span>{lang === 'bn' ? 'সবার জন্য মুছুন (Delete for everyone)' : 'Delete for everyone'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
