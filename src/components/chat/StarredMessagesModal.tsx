import React from 'react';
import { Star, X, Calendar, User } from 'lucide-react';
import { ChatMessage } from '../../types';

interface StarredMessagesModalProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const StarredMessagesModal: React.FC<StarredMessagesModalProps> = ({
  messages,
  isOpen,
  onClose,
  lang = 'bn',
  isDark = false,
}) => {
  if (!isOpen) return null;

  const starredList = messages.filter(m => m.is_starred && !m.is_deleted);

  return (
    <div className="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className={`relative z-10 w-full sm:max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-250 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 sm:hidden shrink-0" />

        <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center font-bold">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {lang === 'bn' ? 'স্টার চিহ্নিত মেসেজসমূহ' : 'Starred Messages'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {starredList.length} {lang === 'bn' ? 'টি মেসেজ' : 'messages'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {starredList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 space-y-2">
              <Star className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
              <p className="text-xs font-medium">
                {lang === 'bn' ? 'এখনো কোনো স্টার চিহ্নিত মেসেজ নেই' : 'No starred messages found'}
              </p>
            </div>
          ) : (
            starredList.map((m) => (
              <div 
                key={m.id} 
                className={`p-3.5 rounded-2xl border ${
                  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {m.sender_profile?.full_name || (lang === 'bn' ? 'সদস্য' : 'User')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                  {m.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
