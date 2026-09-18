import React, { useState } from 'react';
import { Conversation } from '../../types';
import { Search, Users, Megaphone, UserCheck, MessageSquarePlus, ChevronRight, SlidersHorizontal, CheckCheck, Check, Bell, Shield } from 'lucide-react';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewDirectChat?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewDirectChat,
  lang = 'bn',
  isDark = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'class' | 'announcement'>('all');

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'class') return c.type === 'class_group';
    if (filter === 'announcement') return c.type === 'announcement';
    if (filter === 'direct') return c.type === 'direct' || c.type === 'teacher_staff';
    return true;
  });

  const getGroupIcon = (type: string, name: string) => {
    if (type === 'announcement') {
      return (
        <div className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Megaphone className="w-6 h-6" />
        </div>
      );
    }
    if (type === 'class_group') {
      return (
        <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Users className="w-6 h-6" />
        </div>
      );
    }
    if (type === 'teacher_staff') {
      return (
        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <UserCheck className="w-6 h-6" />
        </div>
      );
    }

    // Default Avatar gradient or initial
    const initial = name ? name.charAt(0) : 'U';
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
        {initial}
      </div>
    );
  };

  return (
    <div className={`w-full md:w-80 lg:w-96 flex flex-col h-full md:border-r ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-900'}`}>
      
      {/* Title & Subtitle Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {lang === 'bn' ? 'মেসেজসমূহ' : 'Messages'}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {lang === 'bn' ? 'আপনার প্রতিষ্ঠানের সাথে যুক্ত থাকুন' : 'Stay connected with your institution'}
          </p>
        </div>

        {onNewDirectChat && (
          <button
            onClick={onNewDirectChat}
            className="p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-blue-400 transition-all shrink-0 active:scale-95 shadow-2xs"
            title={lang === 'bn' ? 'নতুন মেসেজ' : 'New Message'}
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="px-4 py-2">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === 'bn' ? 'কনভারসেশন খুঁজুন...' : 'Search conversations...'}
              className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200/80 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
          <button className={`p-2.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar pb-1 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${
              filter === 'all'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {lang === 'bn' ? 'সব' : 'All'}
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${
              filter === 'direct'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {lang === 'bn' ? 'ব্যক্তিগত' : 'Personal'}
          </button>
          <button
            onClick={() => setFilter('class')}
            className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${
              filter === 'class'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {lang === 'bn' ? 'আমার ক্লাস' : 'My Classes'}
          </button>
          <button
            onClick={() => setFilter('announcement')}
            className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${
              filter === 'announcement'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {lang === 'bn' ? 'নোটিশ' : 'Announcements'}
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 pb-24 md:pb-4 divide-y divide-slate-100/60 dark:divide-slate-800/60">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">{lang === 'bn' ? 'কোনো চ্যাট পাওয়া যায়নি' : 'No conversations found'}</p>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeConversationId;
            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`w-full p-3 my-0.5 rounded-2xl flex items-center gap-3 text-left transition-all relative ${
                  isActive
                    ? isDark
                      ? 'bg-slate-800/90 text-white shadow-sm border-l-4 border-l-emerald-500'
                      : 'bg-emerald-50/80 text-slate-900 shadow-xs border-l-4 border-l-emerald-600'
                    : isDark
                    ? 'hover:bg-slate-800/50'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Avatar Icon */}
                {getGroupIcon(c.type, c.name)}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate flex items-center gap-1">
                      {c.name}
                      {c.type === 'teacher_staff' && <Shield className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 shrink-0" />}
                    </h3>
                    {c.last_message?.created_at && (
                      <span className="text-[10px] font-medium text-slate-400 shrink-0 ml-1">
                        {new Date(c.last_message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-snug">
                    {c.last_message ? c.last_message.message : lang === 'bn' ? 'বার্তা পাঠান...' : 'Start conversation...'}
                  </p>
                </div>

                {/* Right Badge / Checkmark */}
                <div className="shrink-0 flex items-center justify-center">
                  {c.unread_count && c.unread_count > 0 ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm shadow-emerald-600/30">
                      {c.unread_count}
                    </span>
                  ) : (
                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
