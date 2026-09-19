import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Institution, Profile, Class, Conversation } from '../types';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ClassGroupInfoModal } from '../components/chat/ClassGroupInfoModal';
import { ChatService } from '../services/chatService';
import { useChatRealtime } from '../hooks/useChatRealtime';

interface ChatAppProps {
  institution: Institution | null;
  profile: Profile | null;
  classes?: Class[];
  teachersList?: Profile[];
  lang?: 'bn' | 'en';
  isDark?: boolean;
  onMobileChatStateChange?: (showMobileChat: boolean) => void;
}

export const ChatApp: React.FC<ChatAppProps> = ({
  institution,
  profile,
  classes = [],
  teachersList = [],
  lang = 'bn',
  isDark = false,
  onMobileChatStateChange,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

  // Notify parent of mobile chat view state change
  useEffect(() => {
    onMobileChatStateChange?.(showMobileChat);
  }, [showMobileChat, onMobileChatStateChange]);

  // Ensure institutionId, currentUserId, and userRole are always reliably resolved
  const institutionId = institution?.id || profile?.institution_id || null;
  const currentUserId = profile?.id || (profile as any)?.user_id || institution?.id || 'admin-user';
  const userRole = profile?.role || 'madrasah_admin';
  const userClassId = (profile as any)?.class_id || (classes && classes[0]?.id) || null;

  // Load conversations on mount or institution change
  useEffect(() => {
    if (!institutionId) return;

    const loadData = async () => {
      let activeClasses = classes;

      // Fetch official classes list from database to ensure identical class IDs across all roles
      if (institutionId) {
        try {
          const { data } = await supabase
            .from('classes')
            .select('*')
            .eq('institution_id', institutionId);
          if (data && data.length > 0) activeClasses = data as Class[];
        } catch (err) {
          console.warn('[ChatApp] Class list fetch fallback:', err);
        }
      }

      const classList = activeClasses.map((c) => ({
        id: c.id,
        name: c.class_name || (c as any).name || 'ক্লাস',
      }));

      try {
        const convs = await ChatService.getConversations(
          institutionId,
          currentUserId,
          classList,
          userRole || undefined,
          userClassId || undefined
        );
        setConversations(convs);
        if (convs.length > 0 && !activeConversationId) {
          // If parent, prioritize selecting their student's class group first
          const parentClassGroup = userRole === 'parent' ? convs.find(c => c.type === 'class_group') : null;
          setActiveConversationId(parentClassGroup ? parentClassGroup.id : convs[0].id);
        }
      } catch (err) {
        console.error('[ChatApp] Conversations load error:', err);
      }
    };

    loadData();
  }, [institutionId, currentUserId, userRole, userClassId]);

  // Hook into Realtime chat for active conversation
  const { messages, loading, error: chatError, sendMessage } = useChatRealtime(activeConversationId, institutionId);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setShowMobileChat(true);
  };

  const handleSendMessage = (text: string) => {
    const senderId = currentUserId || 'admin-user';
    const senderName = profile?.full_name || (profile as any)?.name || (userRole === 'parent' ? 'অভিভাবক' : 'এডমিন / শিক্ষক');
    const className = activeConversation?.class_id || undefined;
    sendMessage(senderId, text, senderName, className);
  };

  return (
    <div className={`h-full w-full flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="flex-1 flex overflow-hidden w-full h-full bg-white dark:bg-slate-900">
        {/* Left Sidebar (Visible on Desktop OR when mobile chat is NOT active) */}
        <div className={`w-full md:w-auto ${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col h-full shrink-0`}>
          <ChatSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            lang={lang}
            isDark={isDark}
          />
        </div>

        {/* Right Chat Window (Visible on Desktop OR when mobile chat IS active) */}
        <div className={`flex-1 ${!showMobileChat ? 'hidden md:flex' : 'flex'} flex-col h-full min-w-0`}>
          <ChatWindow
            conversation={activeConversation}
            conversations={conversations}
            messages={messages}
            loading={loading}
            currentUser={profile}
            userRole={profile?.role}
            onSendMessage={handleSendMessage}
            onOpenInfo={() => setShowGroupInfo(true)}
            onBackMobile={() => setShowMobileChat(false)}
            lang={lang}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Class Group Info Modal */}
      {showGroupInfo && (
        <ClassGroupInfoModal
          conversation={activeConversation}
          teachersList={teachersList}
          onClose={() => setShowGroupInfo(false)}
          lang={lang}
          isDark={isDark}
        />
      )}
    </div>
  );
};
