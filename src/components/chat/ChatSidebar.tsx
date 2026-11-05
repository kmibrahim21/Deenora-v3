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

  // Render Class Story Circular Ring (Matches Design 2: প্রতিষ্ঠান, হিফজ, One, প্রথম)
  const renderStoryRing = (c: Conversation, idx: number, isSelected: boolean) => {
    const cleanLabel = (c.name || '')
      .replace(/\(.*?\)/g, '')
      .replace(/শ্রেণি|শ্রেণী|গ্রুপ|অভিভাবক|শিক্ষক/g, '')
      .trim()
      .split(' ')[0] || 'Class';

    if (c.type === 'announcement' || idx === 0 && c.name?.includes('প্রতিষ্ঠান')) {
      return (
        <div
          className={`w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-400 via-teal-400 to-emerald-600 shadow-lg shadow-emerald-500/20 transition-transform duration-200 ${
            isSelected ? 'scale-105 ring-2 ring-emerald-300/80' : 'group-hover:scale-105'
          }`}
        >
          <div className="w-full h-full rounded-full bg-[#09223B] border-2 border-[#071B36] flex items-center justify-center text-emerald-300">
            <BookOpen className="w-6 h-6 stroke-[2]" />
          </div>
        </div>
      );
    }

    const ringStyles = [
      {
        ring: 'from-blue-400 via-indigo-400 to-blue-600 shadow-blue-500/25',
        inner: 'bg-gradient-to-b from-[#173D7A] to-[#0D254C] text-blue-100',
      },
      {
        ring: 'from-amber-300 via-yellow-400 to-amber-600 shadow-amber-500/20',
        inner: 'bg-gradient-to-b from-[#4A3B22] to-[#2B2315] text-amber-100',
      },
      {
        ring: 'from-teal-300 via-cyan-400 to-teal-600 shadow-teal-500/20',
        inner: 'bg-gradient-to-b from-[#0F3F4C] to-[#082630] text-teal-100',
      },
      {
        ring: 'from-indigo-400 via-purple-400 to-indigo-600 shadow-indigo-500/20',
        inner: 'bg-gradient-to-b from-[#282663] to-[#16153B] text-indigo-100',
      },
    ];

    const style = ringStyles[idx % ringStyles.length];

    return (
      <div
        className={`w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr ${style.ring} shadow-lg transition-transform duration-200 ${
          isSelected ? 'scale-105 ring-2 ring-blue-400' : 'group-hover:scale-105'
        }`}
      >
        <div
          className={`w-full h-full rounded-full ${style.inner} border-2 border-[#071B36] flex items-center justify-center px-1 text-center`}
        >
          <span className="text-[11px] font-extrabold tracking-tight leading-none truncate max-w-[44px]">
            {cleanLabel}
          </span>
        </div>
      </div>
    );
  };

  // Render Circular Conversation Avatar for Midnight Navy Sidebar
  const getDeenoraAvatar = (c: Conversation) => {
    const { type, name } = c;
    if (type === 'announcement') {
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/50 ring-2 ring-emerald-400/30">
          <Megaphone className="w-5 h-5" />
        </div>
      );
    }
    if (type === 'class_group') {
      const gradients = [
        'from-blue-500 to-indigo-600 ring-blue-400/30',
        'from-cyan-500 to-blue-600 ring-cyan-400/30',
        'from-emerald-500 to-teal-600 ring-emerald-400/30',
        'from-indigo-500 to-purple-600 ring-indigo-400/30',
      ];
      const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const chosen = gradients[hash % gradients.length];
      const shortBadge = name.replace(/[^0-9A-Za-z]/g, '').slice(0, 3) || 'CLS';

      return (
        <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${chosen} text-white flex flex-col items-center justify-center shrink-0 shadow-md ring-2 relative`}>
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
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-md ring-2 ring-blue-400/30 relative">
          {initial}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#071B36] flex items-center justify-center text-[8px] text-white">
            <Shield className="w-2.5 h-2.5 fill-current" />
          </span>
        </div>
      );
    }

    const initial = name ? name.charAt(0) : 'U';
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-600 to-slate-800 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/15">
        {initial}
      </div>
    );
  };

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }, [conversations]);

  return (
    <div
      className="w-full md:w-88 lg:w-96 flex flex-col h-full bg-gradient-to-b from-[#071B36] via-[#0A2246] to-[#06152D] text-white md:border-r border-[#1B3868]/70 select-none shadow-xl"
    >
      {/* Top Header: Deenora Midnight Navy Branding */}
      <div 
        className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between gap-3"
        style={{ paddingTop: 'calc(1.15rem + env(safe-area-inset-top, 0px))' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {lang === 'bn' ? 'মেসেজ (Live Chat)' : 'Live Chat'}
            </h1>
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[11px] font-extrabold shadow-sm shadow-blue-500/40">
                {totalUnreadCount}
              </span>
            )}
            {loading && conversations.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold animate-pulse border border-blue-400/30 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-blue-200/70 font-medium mt-0.5">
            {lang === 'bn' ? 'আপনার মাদরাসা ও ক্লাসের সাথে সার্বক্ষণিক যোগাযোগ' : 'Stay connected with your institution'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenBackup && (
            <button
              onClick={onOpenBackup}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-blue-200 hover:text-white border border-white/10 transition-all shrink-0 active:scale-95"
              title={lang === 'bn' ? 'এনক্রিপ্টেড ব্যাকআপ ও রিস্টোর' : 'Encrypted Chat Backup & Restore'}
            >
              <HardDriveDownload className="w-4 h-4" />
            </button>
          )}

          {onNewDirectChat ? (
            <button
              onClick={onNewDirectChat}
              className="p-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 hover:text-white border border-blue-400/30 transition-all shrink-0 active:scale-95"
              title={lang === 'bn' ? 'নতুন মেসেজ' : 'New Message'}
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setFilter(filter === 'all' ? 'class' : 'all')}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-blue-200 hover:text-white border border-white/10 transition-all shrink-0 active:scale-95"
              title={lang === 'bn' ? 'ফিল্টার' : 'Filter'}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Midnight Navy Translucent Search Bar */}
      <div className="px-5 pb-3.5 shrink-0">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#0F2952]/90 border border-[#234882]/80 focus-within:border-blue-400 focus-within:bg-[#133263] focus-within:shadow-md focus-within:shadow-blue-500/10 transition-all">
          <Search className="w-4 h-4 text-blue-300/70 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'bn' ? 'খুঁজুন (শ্রেণি, শিক্ষক, বার্তা)...' : 'Search messages, classes, teachers...'}
            className="w-full bg-transparent text-xs sm:text-sm border-none focus:outline-none placeholder:text-blue-200/50 text-white"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="p-0.5 rounded-full hover:bg-white/10 text-blue-200/70 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Class Story Horizontal Circular Rings (Matches Design 2) */}
      {!searchTerm && storyItems.length > 0 && (
        <div className="px-5 pb-3.5 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold tracking-wide text-blue-100/90">
              Class Story
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
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
                  className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
                  title={c.name}
                >
                  <div className="relative">
                    {renderStoryRing(c, idx, isSelected)}
                    {c.unread_count && c.unread_count > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-[#071B36]" />
                    ) : null}
                  </div>
                  <span className={`text-[11px] font-semibold max-w-[60px] truncate text-center transition-colors ${
                    isSelected ? 'text-white font-bold' : 'text-blue-200/80 group-hover:text-white'
                  }`}>
                    {shortTitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rounded Filter Pills (সব | ব্যক্তিগত | আমার ক্লাস | নোটিশ) */}
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
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/35 ring-1 ring-blue-400/60'
                    : 'bg-[#102A52]/80 text-blue-200/80 border border-[#234882]/70 hover:bg-[#16376B] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation Cards List on Midnight Navy Background */}
      <div className="flex-1 overflow-y-auto px-3.5 pb-24 md:pb-6 space-y-1.5 custom-scrollbar">
        {filteredConversations.length === 0 ? (
          loading ? (
            <div className="py-4 px-1 space-y-3">
              <div className="p-3 rounded-2xl bg-[#102A52]/90 border border-blue-400/30 text-blue-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-400" />
                  <span className="text-xs font-bold">
                    {lang === 'bn' ? 'কনভারসেশন লোড হচ্ছে...' : 'Loading conversations...'}
                  </span>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200">
                  {lang === 'bn' ? 'অপেক্ষা করুন' : 'Please wait'}
                </span>
              </div>

              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className="w-full px-3.5 py-3.5 flex items-center gap-3.5 rounded-2xl bg-[#0E2448]/60 border border-white/5 animate-pulse"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-900/50 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`h-3.5 rounded-md bg-blue-800/50 ${i % 2 === 0 ? 'w-28' : 'w-36'}`} />
                        <div className="h-2.5 w-10 rounded-md bg-blue-900/50" />
                      </div>
                      <div className={`h-3 rounded-md bg-blue-900/40 ${i % 2 === 0 ? 'w-44' : 'w-32'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#102A52] border border-blue-400/20 text-blue-300 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {lang === 'bn' ? 'কোনো বার্তা পাওয়া যায়নি' : 'No conversations found'}
              </h4>
              <p className="text-xs text-blue-200/60 max-w-xs mx-auto">
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
                className={`w-full px-3.5 py-3 flex items-center gap-3.5 text-left rounded-2xl transition-all duration-200 relative group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#133266] via-[#163B75] to-[#112C59] border border-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.35)]'
                    : 'bg-[#0C2142]/55 hover:bg-[#112B54]/80 border border-white/[0.06]'
                }`}
              >
                {/* Avatar with Online/Status Dot */}
                <div className="relative shrink-0">
                  {getDeenoraAvatar(c)}
                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#071B36] ${
                      index % 4 === 3 ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                  />
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className="font-bold text-sm truncate flex items-center gap-1.5 text-white">
                      <span className="truncate">{c.name}</span>
                      {c.type === 'teacher_staff' && (
                        <Shield className="w-3.5 h-3.5 text-blue-400 fill-blue-400 shrink-0" />
                      )}
                    </h3>

                    {/* Timestamp */}
                    {c.last_message?.created_at && (
                      <span className={`text-[11px] font-medium shrink-0 ${
                        hasUnread 
                          ? 'text-blue-300 font-bold' 
                          : 'text-blue-200/60'
                      }`}>
                        {formatTime(c.last_message.created_at)}
                      </span>
                    )}
                  </div>

                  {/* Subtitle / Last message preview */}
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate leading-relaxed ${
                      hasUnread
                        ? 'text-white font-semibold'
                        : isActive
                        ? 'text-blue-100/90'
                        : 'text-blue-200/65'
                    }`}>
                      {c.last_message ? (
                        c.last_message.message_type === 'voice' 
                          ? (lang === 'bn' ? '🎙️ ভয়েস বার্তা' : '🎙️ Voice note')
                          : c.last_message.message_type === 'document'
                          ? (lang === 'bn' ? '📄 ডকুমেন্ট ফাইল' : '📄 Document')
                          : c.last_message.message
                      ) : (
                        <span className="italic text-blue-200/50">
                          {lang === 'bn' ? 'বার্তা পাঠান...' : 'Start conversation...'}
                        </span>
                      )}
                    </p>

                    {/* Unread Badge or Delivery status */}
                    <div className="shrink-0 flex items-center">
                      {hasUnread ? (
                        <span
                          className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-sm ${
                            index % 3 === 2 ? 'bg-rose-500 shadow-rose-500/30' : 'bg-blue-500 shadow-blue-500/40'
                          }`}
                        >
                          {c.unread_count}
                        </span>
                      ) : (
                        <CheckCheck className={`w-3.5 h-3.5 ${
                          isActive ? 'text-blue-300' : 'text-blue-300/40'
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
