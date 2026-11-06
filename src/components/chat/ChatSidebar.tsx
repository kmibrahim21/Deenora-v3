import React, { useState, useMemo } from 'react';
import { Conversation } from '../../types';
import { 
  Search, 
  Users, 
  Megaphone, 
  MessageSquarePlus, 
  CheckCheck, 
  Shield, 
  GraduationCap, 
  X, 
  BookOpen,
  Loader2,
  HardDriveDownload,
  SlidersHorizontal
} from 'lucide-react';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewDirectChat?: () => void;
  onOpenBackup?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
  loading?: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewDirectChat,
  onOpenBackup,
  lang = 'bn',
  isDark = false,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'class' | 'announcement'>('all');

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.last_message?.message?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === 'class') return c.type === 'class_group';
      if (filter === 'announcement') return c.type === 'announcement';
      if (filter === 'direct') return c.type === 'direct' || c.type === 'teacher_staff';
      return true;
    });
  }, [conversations, searchTerm, filter]);

  // Class Story horizontal rings: top active / pinned classes & announcement
  const storyItems = useMemo(() => {
    return conversations.slice(0, 8);
  }, [conversations]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      if (isToday) {
        return date.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      if (isYesterday) {
        return lang === 'bn' ? 'গতকাল' : 'Yesterday';
      }
      return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Render Class Story Circular Ring
  const renderStoryRing = (c: Conversation, idx: number, isSelected: boolean) => {
    const cleanLabel = (c.name || '')
      .replace(/\(.*?\)/g, '')
      .replace(/শ্রেণি|শ্রেণী|গ্রুপ|অভিভাবক|শিক্ষক/g, '')
      .trim()
      .split(' ')[0] || 'Class';

    if (c.type === 'announcement' || (idx === 0 && c.name?.includes('প্রতিষ্ঠান'))) {
      return (
        <div
          className={`w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-400 via-teal-400 to-emerald-600 shadow-sm transition-transform duration-200 ${
            isSelected ? 'scale-105 ring-2 ring-emerald-400' : 'group-hover:scale-105'
          }`}
        >
          <div className={`w-full h-full rounded-full border-2 flex items-center justify-center ${
            isDark ? 'bg-slate-900 border-slate-950 text-emerald-300' : 'bg-emerald-50 border-white text-emerald-600 shadow-2xs'
          }`}>
            <BookOpen className="w-5 h-5 stroke-[2]" />
          </div>
        </div>
      );
    }

    const ringStyles = [
      {
        ring: 'from-blue-400 via-indigo-500 to-blue-600',
        inner: isDark ? 'bg-slate-800 text-blue-200' : 'bg-blue-50 text-blue-700',
      },
      {
        ring: 'from-amber-400 via-yellow-400 to-amber-600',
        inner: isDark ? 'bg-slate-800 text-amber-200' : 'bg-amber-50 text-amber-700',
      },
      {
        ring: 'from-teal-400 via-cyan-400 to-teal-600',
        inner: isDark ? 'bg-slate-800 text-teal-200' : 'bg-teal-50 text-teal-700',
      },
      {
        ring: 'from-indigo-400 via-purple-400 to-indigo-600',
        inner: isDark ? 'bg-slate-800 text-indigo-200' : 'bg-indigo-50 text-indigo-700',
      },
    ];

    const style = ringStyles[idx % ringStyles.length];

    return (
      <div
        className={`w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr ${style.ring} shadow-sm transition-transform duration-200 ${
          isSelected ? 'scale-105 ring-2 ring-blue-500' : 'group-hover:scale-105'
        }`}
      >
        <div
          className={`w-full h-full rounded-full ${style.inner} border-2 ${isDark ? 'border-slate-900' : 'border-white'} flex items-center justify-center px-1 text-center font-bold`}
        >
          <span className="text-[11px] font-extrabold tracking-tight leading-none truncate max-w-[44px]">
            {cleanLabel}
          </span>
        </div>
      </div>
    );
  };

  // Render Circular Conversation Avatar
  const getDeenoraAvatar = (c: Conversation) => {
    const { type, name } = c;
    if (type === 'announcement') {
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Megaphone className="w-5 h-5" />
        </div>
      );
    }
    if (type === 'class_group') {
      const gradients = [
        'from-blue-500 to-indigo-600',
        'from-cyan-500 to-blue-600',
        'from-emerald-500 to-teal-600',
        'from-indigo-500 to-purple-600',
      ];
      const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const chosen = gradients[hash % gradients.length];
      const shortBadge = name.replace(/[^0-9A-Za-z]/g, '').slice(0, 3) || 'CLS';

      return (
        <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${chosen} text-white flex flex-col items-center justify-center shrink-0 shadow-sm relative`}>
          <GraduationCap className="w-4 h-4" />
          <span className="text-[8px] font-black uppercase tracking-tighter opacity-95 leading-none mt-0.5">
            {shortBadge}
          </span>
        </div>
      );
    }
    if (type === 'teacher_staff') {
      const initial = name ? name.charAt(0) : 'T';
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm relative">
          {initial}
          <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full border-2 ${isDark ? 'border-slate-900' : 'border-white'} flex items-center justify-center text-[8px] text-white`}>
            <Shield className="w-2.5 h-2.5 fill-current" />
          </span>
        </div>
      );
    }

    const initial = name ? name.charAt(0) : 'U';
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-600 to-slate-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
        {initial}
      </div>
    );
  };

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }, [conversations]);

  return (
    <div
      className={`w-full md:w-84 lg:w-96 flex flex-col h-full md:border-r transition-colors duration-200 select-none ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-900'
      }`}
    >
      {/* Top Header */}
      <div 
        className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between gap-3"
        style={{ paddingTop: 'calc(1.15rem + env(safe-area-inset-top, 0px))' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'bn' ? 'মেসেজ (Live Chat)' : 'Live Chat'}
            </h1>
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-extrabold shadow-sm">
                {totalUnreadCount}
              </span>
            )}
            {loading && conversations.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold animate-pulse border border-blue-200 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            )}
          </div>
          <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {lang === 'bn' ? 'আপনার মাদরাসা ও ক্লাসের সাথে সার্বক্ষণিক যোগাযোগ' : 'Stay connected with your institution'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenBackup && (
            <button
              onClick={onOpenBackup}
              className={`p-2.5 rounded-xl border transition-all shrink-0 active:scale-95 cursor-pointer ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-blue-600'
              }`}
              title={lang === 'bn' ? 'এনক্রিপ্টেড ব্যাকআপ ও রিস্টোর' : 'Encrypted Chat Backup & Restore'}
            >
              <HardDriveDownload className="w-4 h-4" />
            </button>
          )}

          {onNewDirectChat ? (
            <button
              onClick={onNewDirectChat}
              className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shrink-0 active:scale-95 shadow-sm shadow-blue-500/20 cursor-pointer"
              title={lang === 'bn' ? 'নতুন মেসেজ' : 'New Message'}
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setFilter(filter === 'all' ? 'class' : 'all')}
              className={`p-2.5 rounded-xl border transition-all shrink-0 active:scale-95 cursor-pointer ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-blue-600'
              }`}
              title={lang === 'bn' ? 'ফিল্টার' : 'Filter'}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Modern Search Bar */}
      <div className="px-5 pb-3.5 shrink-0">
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-slate-800/90 border-slate-700/80 focus-within:border-blue-500 text-white'
            : 'bg-slate-50 border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white text-slate-900 shadow-2xs'
        }`}>
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'bn' ? 'খুঁজুন (শ্রেণি, শিক্ষক, বার্তা)...' : 'Search messages, classes, teachers...'}
            className={`w-full bg-transparent text-xs sm:text-sm border-none focus:outline-none ${
              isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-400'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Class Story Horizontal Circular Rings */}
      {!searchTerm && storyItems.length > 0 && (
        <div className="px-5 pb-3.5 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-bold tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Class Story
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`text-[11px] font-semibold transition-colors cursor-pointer ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              See All
            </button>
          </div>

          <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pb-1">
            {storyItems.map((c, idx) => {
              const isSelected = c.id === activeConversationId;
              const shortTitle = c.type === 'announcement'
                ? (lang === 'bn' ? 'প্রতিষ্ঠান' : 'Notice')
                : (c.name || '')
                    .replace(/\(.*?\)/g, '')
                    .replace(/শ্রেণি|শ্রেণী|গ্রুপ/g, '')
                    .trim()
                    .split(' ')[0] || c.name;

              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none cursor-pointer"
                  title={c.name}
                >
                  <div className="relative">
                    {renderStoryRing(c, idx, isSelected)}
                    {c.unread_count && c.unread_count > 0 ? (
                      <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 ${
                        isDark ? 'border-slate-900' : 'border-white'
                      }`} />
                    ) : null}
                  </div>
                  <span className={`text-[11px] font-semibold max-w-[60px] truncate text-center transition-colors ${
                    isSelected
                      ? isDark ? 'text-blue-400 font-bold' : 'text-blue-600 font-bold'
                      : isDark
                      ? 'text-slate-400 group-hover:text-white'
                      : 'text-slate-600 group-hover:text-slate-900'
                  }`}>
                    {shortTitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rounded Filter Pills */}
      <div className="px-5 pb-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: 'all', label: lang === 'bn' ? 'সব' : 'All' },
            { key: 'direct', label: lang === 'bn' ? 'ব্যক্তিগত' : 'Personal' },
            { key: 'class', label: lang === 'bn' ? 'আমার ক্লাস' : 'My Classes' },
            { key: 'announcement', label: lang === 'bn' ? 'নোটিশ' : 'Notice' },
          ].map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : isDark
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation Cards List */}
      <div className={`flex-1 overflow-y-auto px-3.5 pb-24 md:pb-6 space-y-1.5 custom-scrollbar ${
        isDark ? 'bg-slate-900' : 'bg-slate-50/50'
      }`}>
        {filteredConversations.length === 0 ? (
          loading ? (
            <div className="py-4 px-1 space-y-3">
              <div className={`p-3 rounded-2xl border flex items-center justify-between animate-pulse ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-blue-50/70 border-blue-100 text-blue-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600" />
                  <span className="text-xs font-bold font-noto">
                    {lang === 'bn' ? 'কনভারসেশন লোড হচ্ছে...' : 'Loading conversations...'}
                  </span>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-slate-700 text-blue-300' : 'bg-blue-100 text-blue-700'
                }`}>
                  {lang === 'bn' ? 'অপেক্ষা করুন' : 'Please wait'}
                </span>
              </div>

              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className={`w-full px-3.5 py-3.5 flex items-center gap-3.5 rounded-2xl border animate-pulse ${
                      isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`h-3.5 rounded-md ${isDark ? 'bg-slate-700' : 'bg-slate-200'} ${i % 2 === 0 ? 'w-28' : 'w-36'}`} />
                        <div className={`h-2.5 w-10 rounded-md ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      </div>
                      <div className={`h-3 rounded-md ${isDark ? 'bg-slate-700' : 'bg-slate-200'} ${i % 2 === 0 ? 'w-44' : 'w-32'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 px-4 text-center">
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-3 ${
                isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-blue-600 shadow-2xs'
              }`}>
                <Users className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h4 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {lang === 'bn' ? 'কোনো বার্তা পাওয়া যায়নি' : 'No conversations found'}
              </h4>
              <p className={`text-xs max-w-xs mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {searchTerm 
                  ? (lang === 'bn' ? 'অন্য কোনো নাম বা শব্দ দিয়ে খুঁজুন' : 'Try searching with a different name')
                  : (lang === 'bn' ? 'আপনার প্রতিষ্ঠানের সকল যোগাযোগ এখানে প্রদর্শিত হবে' : "Your institution's conversations will appear here.")}
              </p>
            </div>
          )
        ) : (
          filteredConversations.map((c, index) => {
            const isActive = c.id === activeConversationId;
            const hasUnread = Boolean(c.unread_count && c.unread_count > 0);

            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`w-full px-3.5 py-3 flex items-center gap-3.5 text-left rounded-2xl transition-all duration-150 relative group cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'bg-slate-800/90 ring-1 ring-blue-500/30'
                      : 'bg-blue-50 text-slate-900 border border-blue-200/90 shadow-2xs'
                    : isDark
                    ? 'hover:bg-slate-800/50 text-slate-200'
                    : 'bg-white hover:bg-slate-100/70 border border-slate-200/70 text-slate-800 shadow-2xs'
                }`}
              >
                {/* Avatar with Online/Status Dot */}
                <div className="relative shrink-0">
                  {getDeenoraAvatar(c)}
                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${
                      isDark ? 'border-slate-900' : 'border-white'
                    } ${index % 4 === 3 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  />
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className={`font-bold text-sm truncate flex items-center gap-1.5 ${
                      isActive
                        ? isDark ? 'text-blue-400' : 'text-blue-700'
                        : isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      <span className="truncate">{c.name}</span>
                      {c.type === 'teacher_staff' && (
                        <Shield className={`w-3.5 h-3.5 fill-current shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      )}
                    </h3>

                    {/* Timestamp */}
                    {c.last_message?.created_at && (
                      <span className={`text-[11px] font-medium shrink-0 ${
                        hasUnread 
                          ? isDark ? 'text-blue-400 font-bold' : 'text-blue-600 font-bold' 
                          : 'text-slate-400'
                      }`}>
                        {formatTime(c.last_message.created_at)}
                      </span>
                    )}
                  </div>

                  {/* Subtitle / Last message preview */}
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate leading-relaxed ${
                      hasUnread
                        ? isDark ? 'text-slate-100 font-semibold' : 'text-slate-900 font-semibold'
                        : isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {c.last_message ? (
                        c.last_message.message_type === 'voice' 
                          ? (lang === 'bn' ? '🎙️ ভয়েস বার্তা' : '🎙️ Voice note')
                          : c.last_message.message_type === 'document'
                          ? (lang === 'bn' ? '📄 ডকুমেন্ট ফাইল' : '📄 Document')
                          : c.last_message.message
                      ) : (
                        <span className="italic text-slate-400">
                          {lang === 'bn' ? 'বার্তা পাঠান...' : 'Start conversation...'}
                        </span>
                      )}
                    </p>

                    {/* Unread Badge or Delivery status */}
                    <div className="shrink-0 flex items-center">
                      {hasUnread ? (
                        <span
                          className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-xs ${
                            index % 3 === 2 ? 'bg-rose-500' : 'bg-blue-600'
                          }`}
                        >
                          {c.unread_count}
                        </span>
                      ) : (
                        <CheckCheck className={`w-3.5 h-3.5 ${
                          isActive ? 'text-blue-500' : (isDark ? 'text-slate-600' : 'text-slate-300')
                        }`} />
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
