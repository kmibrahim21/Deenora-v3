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
    <div className={`w-full md:w-80 lg:w-96 flex flex-col h-full md:border-r ${isDark ? 'bg-[#111B21] border-[#222D34] text-[#E9EDEF]' : 'bg-white border-[#E9EDEF] text-[#111B21]'}`}>
      
      {/* WhatsApp Signature Header */}
      <div 
        className={`px-4 py-3 flex items-center justify-between gap-3 text-white shadow-xs shrink-0 ${
          isDark ? 'bg-[#1F2C34]' : 'bg-[#008069]'
        }`}
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            {lang === 'bn' ? 'দ্বীনোরা চ্যাট' : 'Deenora Chat'}
          </h2>
          <p className="text-[11px] text-emerald-100 font-normal">
            {lang === 'bn' ? 'মাদরাসা ও ক্লাসরুম বার্তা' : 'Madrasah & Classroom Messages'}
          </p>
        </div>

        {onNewDirectChat && (
          <button
            onClick={onNewDirectChat}
            className="p-2.5 rounded-full hover:bg-white/15 text-white transition-all shrink-0 active:scale-95"
            title={lang === 'bn' ? 'নতুন মেসেজ' : 'New Message'}
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className={`p-2.5 border-b ${isDark ? 'bg-[#111B21] border-[#222D34]' : 'bg-white border-[#E9EDEF]'}`}>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isDark ? 'bg-[#202C33]' : 'bg-[#F0F2F5]'}`}>
          <Search className="w-4 h-4 text-[#8696A0] shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'bn' ? 'খুঁজুন বা নতুন চ্যাট শুরু করুন...' : 'Search or start new chat...'}
            className="w-full bg-transparent text-xs sm:text-sm border-none focus:outline-none placeholder-[#8696A0] text-[#111B21] dark:text-[#E9EDEF]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar pb-0.5 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap text-xs ${
              filter === 'all'
                ? 'bg-[#008069] dark:bg-[#00A884] text-white shadow-xs'
                : isDark
                ? 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]'
                : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
            }`}
          >
            {lang === 'bn' ? 'সব' : 'All'}
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap text-xs ${
              filter === 'direct'
                ? 'bg-[#008069] dark:bg-[#00A884] text-white shadow-xs'
                : isDark
                ? 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]'
                : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
            }`}
          >
            {lang === 'bn' ? 'ব্যক্তিগত' : 'Direct'}
          </button>
          <button
            onClick={() => setFilter('class')}
            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap text-xs ${
              filter === 'class'
                ? 'bg-[#008069] dark:bg-[#00A884] text-white shadow-xs'
                : isDark
                ? 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]'
                : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
            }`}
          >
            {lang === 'bn' ? 'ক্লাস গ্রুপ' : 'Class Groups'}
          </button>
          <button
            onClick={() => setFilter('announcement')}
            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap text-xs ${
              filter === 'announcement'
                ? 'bg-[#008069] dark:bg-[#00A884] text-white shadow-xs'
                : isDark
                ? 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]'
                : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
            }`}
          >
            {lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'}
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
                className={`w-full px-3 py-3 flex items-center gap-3 text-left transition-colors relative border-b ${
                  isDark ? 'border-[#222D34]' : 'border-[#F0F2F5]'
                } ${
                  isActive
                    ? isDark
                      ? 'bg-[#2A3942]'
                      : 'bg-[#F0F2F5]'
                    : isDark
                    ? 'hover:bg-[#202C33]'
                    : 'hover:bg-[#F5F6F6]'
                }`}
              >
                {/* Avatar Icon */}
                <div className="relative shrink-0">
                  {getGroupIcon(c.type, c.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-sm text-[#111B21] dark:text-[#E9EDEF] truncate flex items-center gap-1">
                      {c.name}
                      {c.type === 'teacher_staff' && <Shield className="w-3.5 h-3.5 text-[#00A884] fill-[#00A884] shrink-0" />}
                    </h3>
                    {c.last_message?.created_at && (
                      <span className={`text-[11px] font-normal shrink-0 ml-1 ${
                        c.unread_count && c.unread_count > 0 ? 'text-[#25D366] font-semibold' : 'text-[#8696A0]'
                      }`}>
                        {new Date(c.last_message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] truncate leading-snug">
                        {c.last_message ? c.last_message.message : (lang === 'bn' ? 'বার্তা পাঠান...' : 'Start conversation...')}
                      </p>
                      {c.members && c.members.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {lang === 'bn' ? 'শিক্ষক' : 'Teachers'}: {c.members.filter(m => m.profile?.role === 'teacher' || m.profile?.role === 'madrasah_admin').length}
                          </span>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            {lang === 'bn' ? 'অভিভাবক' : 'Guardians'}: {c.members.filter(m => m.profile?.role === 'parent').length}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right Badge / Checkmark */}
                    <div className="shrink-0 ml-2 flex items-center self-start mt-1">
                      {c.unread_count && c.unread_count > 0 ? (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center">
                          {c.unread_count}
                        </span>
                      ) : (
                        <CheckCheck className="w-4 h-4 text-[#53BDEB]" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
