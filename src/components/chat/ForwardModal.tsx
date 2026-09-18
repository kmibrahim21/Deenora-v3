import React, { useState } from 'react';
import { Search, Send, X, Check, Users, Megaphone, CheckSquare } from 'lucide-react';
import { Conversation, ChatMessage } from '../../types';

interface ForwardModalProps {
  message: ChatMessage | null;
  conversations: Conversation[];
  isOpen: boolean;
  onClose: () => void;
  onSendForward: (selectedConversationIds: string[], message: ChatMessage) => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  message,
  conversations,
  isOpen,
  onClose,
  onSendForward,
  lang = 'bn',
  isDark = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen || !message) return null;

  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = () => {
    if (selectedIds.length === 0) return;
    onSendForward(selectedIds, message);
    setSelectedIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Forward Container */}
      <div 
        className={`relative z-10 w-full sm:max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-250 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        {/* Handle Bar */}
        <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base leading-tight">
              {lang === 'bn' ? 'মেসেজ ফরোয়ার্ড করুন (Forward Message)' : 'Forward Message'}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {lang === 'bn' ? 'এক বা একাধিক চ্যাট নির্বাচন করুন' : 'Select one or more chats'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Forward Preview Snippet */}
        <div className="p-3.5 px-5 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100/80 dark:border-blue-900/40 text-xs flex items-center gap-2">
          <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">
            {lang === 'bn' ? 'ফরোয়ার্ড প্রিভিউ:' : 'Forwarding:'}
          </span>
          <span className="text-slate-700 dark:text-slate-300 truncate italic">
            "{message.message || (lang === 'bn' ? 'সংযুক্ত ফাইল' : 'Attachment')}"
          </span>
        </div>

        {/* Search Bar */}
        <div className="p-3 px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === 'bn' ? 'চ্যাট খুঁজুন...' : 'Search conversation...'}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/80"
            />
          </div>
        </div>

        {/* Conversation Picker List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {lang === 'bn' ? 'কোনো চ্যাট পাওয়া যায়নি' : 'No conversation found'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedIds.includes(conv.id);

              return (
                <div
                  key={conv.id}
                  onClick={() => toggleSelect(conv.id)}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                        conv.type === 'announcement'
                          ? 'bg-rose-500'
                          : conv.type === 'class_group'
                          ? 'bg-teal-600'
                          : 'bg-blue-600'
                      }`}
                    >
                      {conv.type === 'announcement' ? (
                        <Megaphone className="w-4 h-4" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>

                    <div className="truncate">
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {conv.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {conv.type === 'class_group'
                          ? (lang === 'bn' ? 'ক্লাস গ্রুপ' : 'Class Group')
                          : conv.type === 'announcement'
                          ? (lang === 'bn' ? 'নোটিশ চ্যানেল' : 'Announcement')
                          : (lang === 'bn' ? 'ব্যক্তিগত কথা' : 'Direct Chat')}
                      </p>
                    </div>
                  </div>

                  {/* Selection Checkbox Pill */}
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Action Button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-500">
            {selectedIds.length} {lang === 'bn' ? 'টি নির্বাচিত' : 'selected'}
          </span>

          <button
            type="button"
            onClick={handleSend}
            disabled={selectedIds.length === 0}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold text-white flex items-center gap-2 shadow-md transition-all active:scale-95 ${
              selectedIds.length > 0
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'ফরোয়ার্ড পাঠান' : 'Send Forward'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
