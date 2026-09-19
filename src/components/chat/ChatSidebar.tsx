import React, { useState, useMemo } from 'react';
import { Conversation } from '../../types';
import { 
  Search, 
  Users, 
  Megaphone, 
  UserCheck, 
  MessageSquarePlus, 
  CheckCheck, 
  Check, 
  Shield, 
  GraduationCap, 
  X, 
  Sparkles, 
  BookOpen,
  School,
  ArrowRight,
  Loader2,
  HardDriveDownload
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

  // Quick horizontal jump items: top active / pinned classes
  const quickJumpItems = useMemo(() => {
    return conversations.slice(0, 6);
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

  const getDeenoraAvatar = (c: Conversation) => {
    const { type, name } = c;
    if (type === 'announcement') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/20 ring-2 ring-rose-100/60 dark:ring-rose-950/40">
          <Megaphone className="w-5 h-5" />
        </div>
      );
    }
    if (type === 'class_group') {
      // Distinct gradient tints for different classes
      const gradients = [
        'from-blue-600 to-cyan-500 ring-blue-100/70 dark:ring-blue-950/40 shadow-blue-500/15',
        'from-indigo-600 to-blue-500 ring-indigo-100/70 dark:ring-indigo-950/40 shadow-indigo-500/15',
        'from-teal-600 to-emerald-500 ring-teal-100/70 dark:ring-teal-950/40 shadow-teal-500/15',
        'from-sky-600 to-indigo-600 ring-sky-100/70 dark:ring-sky-950/40 shadow-sky-500/15',
      ];
      const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const chosen = gradients[hash % gradients.length];
      const shortBadge = name.replace(/[^0-9A-Za-z]/g, '').slice(0, 3) || 'CLS';

      return (
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${chosen} text-white flex flex-col items-center justify-center shrink-0 shadow-sm ring-2 relative`}>
          <GraduationCap className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter opacity-90 leading-none mt-0.5">
            {shortBadge}
          </span>
        </div>
      );
    }
    if (type === 'teacher_staff') {
      const initial = name ? name.charAt(0) : 'T';
      return (
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20 ring-2 ring-blue-100/70 dark:ring-blue-950/40 relative">
          {initial}
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] text-white shadow-xs">
            <Shield className="w-2.5 h-2.5 fill-current" />
          </span>
        </div>
      );
    }

    // Direct chat
    const initial = name ? name.charAt(0) : 'U';
    return (
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm ring-2 ring-slate-200/60 dark:ring-slate-800">
        {initial}
      </div>
    );
  };

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }, [conversations]);

  return (
    <div className={`w-full md:w-84 lg:w-96 flex flex-col h-full md:border-r transition-colors duration-200 ${
      isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-900'
    }`}>
      
      {/* Top Header: Deenora Branding & Context */}
      <div 
        className="px-5 pt-5 pb-3 shrink-0 flex items-start justify-between gap-3"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {lang === 'bn' ? 'মেসেজ' : 'Messages'}
            </h1>
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-xs">
                {totalUnreadCount}
              </span>
            )}
            {loading && conversations.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-semibold animate-pulse border border-blue-100 dark:border-blue-900/50 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {lang === 'bn' ? 'আপনার মাদরাসা ও ক্লাসের সাথে সার্বক্ষণিক যোগাযোগ' : 'Stay connected with your institution'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenBackup && (
            <button
              onClick={onOpenBackup}
              className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-all shrink-0 active:scale-95 shadow-xs"
              title={lang === 'bn' ? 'এনক্রিপ্টেড ব্যাকআপ ও রিস্টোর' : 'Encrypted Chat Backup & Restore'}
            >
              <HardDriveDownload className="w-5 h-5" />
            </button>
          )}

          {onNewDirectChat && (
            <button
              onClick={onNewDirectChat}
              className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 transition-all shrink-0 active:scale-95 shadow-xs"
              title={lang === 'bn' ? 'নতুন মেসেজ' : 'New Message'}
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Refined Modern Search Input */}
      <div className="px-5 pb-3 shrink-0">
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all ${
          isDark 
            ? 'bg-slate-800/80 border-slate-700/60 focus-within:border-blue-500 focus-within:bg-slate-800' 
            : 'bg-slate-50 border-slate-200/70 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-blue-500/5'
        }`}>
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'bn' ? 'খুঁজুন (শ্রেণি, শিক্ষক, বার্তা)...' : 'Search messages, classes, teachers...'}
            className="w-full bg-transparent text-xs sm:text-sm border-none focus:outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Quick Jump Avatars (Inspired by modern messaging designs) */}
      {!searchTerm && quickJumpItems.length > 0 && (
        <div className="px-5 pb-3 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3">
            {quickJumpItems.map((c) => {
              const isSelected = c.id === activeConversationId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none"
                  title={c.name}
                >
                  <div className={`relative p-0.5 rounded-2xl transition-all ${
                    isSelected 
                      ? 'ring-2 ring-blue-600 shadow-sm shadow-blue-500/20' 
                      : 'hover:scale-105'
                  }`}>
                    {getDeenoraAvatar(c)}
                    {c.unread_count && c.unread_count > 0 ? (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white dark:border-slate-900" />
                    ) : null}
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 max-w-[56px] truncate text-center group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {c.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightweight Elegant Filter Tabs */}
      <div className="px-5 pb-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { key: 'all', label: lang === 'bn' ? 'সব' : 'All' },
            { key: 'direct', label: lang === 'bn' ? 'ব্যক্তিগত' : 'Personal' },
            { key: 'class', label: lang === 'bn' ? 'আমার ক্লাস' : 'My Classes' },
            { key: 'announcement', label: lang === 'bn' ? 'নোটিশ' : 'Announcements' },
          ].map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation Rows List */}
      <div className="flex-1 overflow-y-auto px-3 pb-24 md:pb-6 divide-y divide-slate-100/80 dark:divide-slate-800/60 custom-scrollbar">
        {filteredConversations.length === 0 ? (
          loading ? (
            <div className="py-4 px-1 space-y-3">
              {/* Prominent Loading Alert Banner */}
              <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold font-noto">
                    {lang === 'bn' ? 'কনভারসেশন লোড হচ্ছে...' : 'Loading conversations...'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {lang === 'bn' ? 'অপেক্ষা করুন' : 'Please wait'}
                </span>
              </div>

              {/* 5 Sleek Skeleton Rows matching conversation list styling */}
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className={`w-full px-3.5 py-3.5 flex items-center gap-3.5 rounded-2xl border animate-pulse ${
                      isDark ? 'bg-slate-800/30 border-slate-800/80' : 'bg-slate-50/70 border-slate-100'
                    }`}
                  >
                    {/* Avatar Skeleton */}
                    <div className={`w-12 h-12 rounded-2xl shrink-0 ${isDark ? 'bg-slate-700/60' : 'bg-slate-200/80'}`} />
                    {/* Details Skeleton */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`h-3.5 rounded-md ${isDark ? 'bg-slate-700/80' : 'bg-slate-200'} ${i % 2 === 0 ? 'w-28' : 'w-36'}`} />
                        <div className={`h-2.5 w-10 rounded-md ${isDark ? 'bg-slate-700/50' : 'bg-slate-200/70'}`} />
                      </div>
                      <div className={`h-3 rounded-md ${isDark ? 'bg-slate-700/50' : 'bg-slate-200/60'} ${i % 2 === 0 ? 'w-44' : 'w-32'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {lang === 'bn' ? 'কোনো বার্তা পাওয়া যায়নি' : 'No conversations found'}
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                {searchTerm 
                  ? (lang === 'bn' ? 'অন্য কোনো নাম বা শব্দ দিয়ে খুঁজুন' : 'Try searching with a different name')
                  : (lang === 'bn' ? 'আপনার প্রতিষ্ঠানের সকল যোগাযোগ এখানে প্রদর্শিত হবে' : "Your institution's conversations will appear here.")}
              </p>
            </div>
          )
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeConversationId;
            const hasUnread = Boolean(c.unread_count && c.unread_count > 0);

            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`w-full px-3.5 py-3.5 flex items-center gap-3.5 text-left rounded-2xl transition-all duration-150 relative my-0.5 group ${
                  isActive
                    ? isDark
                      ? 'bg-slate-800/90 ring-1 ring-blue-500/30'
                      : 'bg-blue-50/90 ring-1 ring-blue-500/20'
                    : isDark
                    ? 'hover:bg-slate-800/50'
                    : 'hover:bg-slate-50/90'
                }`}
              >
                {/* Avatar with Status Ring */}
                <div className="relative shrink-0">
                  {getDeenoraAvatar(c)}
                  {c.type === 'class_group' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                  )}
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className={`font-bold text-sm truncate flex items-center gap-1.5 ${
                      isActive 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      <span className="truncate">{c.name}</span>
                      {c.type === 'teacher_staff' && (
                        <Shield className="w-3.5 h-3.5 text-blue-600 fill-blue-600 shrink-0" />
                      )}
                    </h3>

                    {/* Timestamp */}
                    {c.last_message?.created_at && (
                      <span className={`text-[11px] font-medium shrink-0 ${
                        hasUnread 
                          ? 'text-blue-600 dark:text-blue-400 font-bold' 
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
                        ? 'text-slate-900 dark:text-slate-100 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
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
                        <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                          {c.unread_count}
                        </span>
                      ) : (
                        <CheckCheck className={`w-3.5 h-3.5 ${
                          isActive ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'
                        }`} />
                      )}
                    </div>
                  </div>

                  {/* Class Group Member Summary */}
                  {c.members && c.members.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {c.members.length} {lang === 'bn' ? 'সদস্য' : 'members'}
                      </span>
                      <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">
                        • {c.members.filter(m => m.profile?.role === 'teacher' || m.profile?.role === 'madrasah_admin').length} {lang === 'bn' ? 'শিক্ষক' : 'teachers'}
                      </span>
                    </div>
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

