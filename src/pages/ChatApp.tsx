import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Institution, Profile, Class, Conversation, ChatMessage } from '../types';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ClassGroupInfoModal } from '../components/chat/ClassGroupInfoModal';
import { ChatBackupModal } from '../components/chat/ChatBackupModal';
import { ChatService, formatRowToChatMessage, getCleanClassName } from '../services/chatService';
import { ChatLocalStore } from '../services/chatLocalStore';
import { useChatRealtime } from '../hooks/useChatRealtime';
import { useBackHandler } from '../utils/backHandler';

interface ChatAppProps {
  institution: Institution | null;
  profile: Profile | null;
  classes?: Class[];
  teachersList?: Profile[];
  lang?: 'bn' | 'en';
  isDark?: boolean;
  onMobileChatStateChange?: (showMobileChat: boolean) => void;
  onStartVoiceCall?: (targetName?: string) => void;
}

export const ChatApp: React.FC<ChatAppProps> = ({
  institution,
  profile,
  classes = [],
  teachersList = [],
  lang = 'bn',
  isDark = false,
  onMobileChatStateChange,
  onStartVoiceCall,
}) => {
  // Ensure institutionId, currentUserId, and userRole are always reliably resolved
  const institutionId = institution?.id || profile?.institution_id || null;
  const currentUserId = profile?.id || (profile as any)?.user_id || institution?.id || 'admin-user';
  const userRole = profile?.role || 'madrasah_admin';
  const isAdmin = userRole === 'super_admin' || userRole === 'madrasah_admin';
  const userClassId = (profile as any)?.class_id || (classes && classes.length === 1 ? classes[0]?.id : null);
  const userClassName = (profile as any)?.class_name || (classes && classes.length === 1 ? (classes[0]?.class_name || (classes[0] as any)?.name) : null);

  const isClassForMe = (targetClass: string | null | undefined): boolean => {
    if (!targetClass) return false;
    if (isAdmin || userRole === 'teacher') return true; // Admins & Teachers access all class groups
    if (userRole === 'parent' && !userClassId && !userClassName) return true; // Parent fallback

    const cleanT = getCleanClassName(targetClass, targetClass);
    const norm = (s: string) => (s || '')
      .replace(/class[-_]?group[-_]?/gi, '')
      .replace(/\(অভিভাবক\s*ও\s*শিক্ষক\s*গ্রুপ\)/gi, '')
      .replace(/শ্রেণী/g, 'শ্রেণি')
      .replace(/[\s_-]+/g, '')
      .toLowerCase();

    const tNorm = norm(targetClass);
    const cleanTNorm = norm(cleanT);
    const uId = norm(userClassId || '');
    const uName = norm(userClassName || '');

    if (tNorm === 'all' || tNorm === 'সকল' || tNorm === 'সকলশ্রেণি' || tNorm === 'সবশ্রেণি') return true;
    if (cleanTNorm === 'all' || cleanTNorm === 'সকল') return true;

    // Direct match against user student's class ID or class Name
    if (uId && (tNorm === uId || tNorm.includes(uId) || uId.includes(tNorm))) return true;
    if (uName && (tNorm === uName || tNorm.includes(uName) || uName.includes(tNorm) || cleanTNorm === uName)) return true;

    // Match against any class in provided classes prop
    if (classes && classes.length > 0) {
      for (const c of classes) {
        const cId = norm(c.id);
        const cName = norm(c.class_name || (c as any).name);
        const isMyClass = (uId && cId === uId) || (uName && cName === uName);

        if (isMyClass || !userClassId) {
          if (cId && (tNorm === cId || tNorm.includes(cId) || cId.includes(tNorm))) return true;
          if (cName && (tNorm === cName || tNorm.includes(cName) || cName.includes(tNorm) || cleanTNorm === cName)) return true;
        }
      }
    }

    if (userClassId && (targetClass.includes(userClassId) || (userClassId.length > 8 && targetClass.includes(userClassId.substring(0, 8))))) {
      return true;
    }

    return false;
  };

  // Instant local cache initialization for 0-latency startup
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (institutionId) {
      try {
        const cached = localStorage.getItem(`cached_convs_${institutionId}_${currentUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return [];
  });

  const [conversationsLoading, setConversationsLoading] = useState<boolean>(() => {
    if (institutionId) {
      const cached = localStorage.getItem(`cached_convs_${institutionId}_${currentUserId}`);
      return !cached;
    }
    return true;
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (institutionId) {
      try {
        const cached = localStorage.getItem(`cached_convs_${institutionId}_${currentUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const parentClassGroup = userRole === 'parent' ? parsed.find((c: any) => c.type === 'class_group') : null;
            return parentClassGroup ? parentClassGroup.id : parsed[0].id;
          }
        }
      } catch {}
    }
    return null;
  });

  const [showGroupInfo, setShowGroupInfo] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);

  // Hardware/Gesture Back-Button Handlers for Chat Module
  useBackHandler('chat-group-info-modal', () => {
    if (showGroupInfo) {
      setShowGroupInfo(false);
      return true;
    }
    return false;
  }, Boolean(showGroupInfo), 10);

  useBackHandler('chat-backup-modal', () => {
    if (showBackupModal) {
      setShowBackupModal(false);
      return true;
    }
    return false;
  }, Boolean(showBackupModal), 10);

  useBackHandler('chat-mobile-window', () => {
    if (showMobileChat) {
      setShowMobileChat(false);
      return true;
    }
    return false;
  }, Boolean(showMobileChat), 8);

  // Notify parent of mobile chat view state change
  useEffect(() => {
    onMobileChatStateChange?.(showMobileChat);
  }, [showMobileChat, onMobileChatStateChange]);

  // Load conversations on mount or institution change
  useEffect(() => {
    if (!institutionId) return;

    let isMounted = true;

    const loadData = async () => {
      let activeClasses = classes;

      // 1. Check local cache for classes first to avoid redundant network query
      if ((!activeClasses || activeClasses.length === 0) && institutionId) {
        try {
          const cachedCls = localStorage.getItem(`cached_classes_${institutionId}`);
          if (cachedCls) {
            const parsed = JSON.parse(cachedCls);
            if (Array.isArray(parsed) && parsed.length > 0) {
              activeClasses = parsed as Class[];
            }
          }
        } catch {}
      }

      // 2. Fetch classes from DB if not available
      if ((!activeClasses || activeClasses.length === 0) && institutionId) {
        try {
          const { data } = await supabase
            .from('classes')
            .select('*')
            .eq('institution_id', institutionId);
          if (data && data.length > 0) {
            activeClasses = data as Class[];
            try {
              localStorage.setItem(`cached_classes_${institutionId}`, JSON.stringify(data));
            } catch {}
          }
        } catch (err) {
          console.warn('[ChatApp] Class list fetch fallback:', err);
        }
      }

      const classList = (activeClasses || []).map((c) => ({
        id: c.id,
        name: c.class_name || (c as any).name || 'ক্লাস',
      }));

      try {
        if (conversations.length === 0) {
          setConversationsLoading(true);
        }

        const convs = await ChatService.getConversations(
          institutionId,
          currentUserId,
          classList,
          userRole || undefined,
          userClassId || undefined
        );

        if (isMounted) {
          setConversations(convs);
          if (convs.length > 0 && !activeConversationId) {
            // If parent, prioritize selecting their student's class group first
            const parentClassGroup = userRole === 'parent' ? convs.find(c => c.type === 'class_group') : null;
            setActiveConversationId(parentClassGroup ? parentClassGroup.id : convs[0].id);
          }
        }
      } catch (err) {
        console.error('[ChatApp] Conversations load error:', err);
      } finally {
        if (isMounted) {
          setConversationsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [institutionId, currentUserId, userRole, userClassId]);

  // Hook into Realtime chat for active conversation
  const { messages, loading, error: chatError, sendMessage, retryMessage } = useChatRealtime(activeConversationId, institutionId);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setShowMobileChat(true);
    
    // Mark as read
    if (institutionId && currentUserId) {
      ChatService.markAsRead(institutionId, convId, currentUserId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    }
  };

  // Mark active conversation as read when messages change
  useEffect(() => {
    if (activeConversationId && messages.length > 0 && institutionId && currentUserId) {
      ChatService.markAsRead(institutionId, activeConversationId, currentUserId);
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, unread_count: 0 } : c));
    }
  }, [activeConversationId, messages.length, institutionId, currentUserId]);

  // Global Realtime listener for all conversations to update unread counts & last messages
  useEffect(() => {
    if (!institutionId) return;

    const handleGlobalIncoming = (msg: ChatMessage) => {
      if (!msg) return;

      // 1. Strict filtering for Parents:
      if (userRole === 'parent') {
        // Disallow staff room messages
        if (msg.conversation_id?.startsWith('staff-')) return;

        // Class group messages MUST belong to the parent's actual class
        const isClassGroup = msg.conversation_id?.startsWith('class-group-') || Boolean(msg.class_name);
        if (isClassGroup) {
          const matchConv = msg.conversation_id ? isClassForMe(msg.conversation_id) : false;
          const matchName = msg.class_name ? isClassForMe(msg.class_name) : false;
          if (!matchConv && !matchName) {
            return; // Not my class -> silently ignore!
          }
        }

        // Direct chats MUST involve the parent
        if (msg.conversation_id?.startsWith('direct-')) {
          const isMyDirect = 
            (currentUserId && msg.conversation_id.includes(currentUserId)) ||
            msg.sender_id === currentUserId;
          if (!isMyDirect) return;
        }

        // Disallow any other unrecognized conversations
        if (!isClassGroup && !msg.conversation_id?.startsWith('direct-') && !msg.conversation_id?.startsWith('announcement-')) {
          return;
        }
      }

      // 2. Strict filtering for Teachers:
      if (userRole === 'teacher') {
        if (msg.conversation_id?.startsWith('direct-')) {
          const isMyDirect = 
            (currentUserId && msg.conversation_id.includes(currentUserId)) ||
            msg.sender_id === currentUserId;
          if (!isMyDirect) return;
        }
      }

      // Note: Admins (super_admin / madrasah_admin) bypass filters to inspect & supervise everything

      setConversations(prev => {
        let matched = false;
        const updated = prev.map(conv => {
          const normBengali = (s?: string) => (s || '').replace(/[\s_()-]+/g, '').toLowerCase();

          let isMatch = conv.id === msg.conversation_id;

          // Class group matching logic
          const isConvClass = conv.type === 'class_group' || conv.id.startsWith('class-group-');
          const isMsgClass = msg.conversation_id?.startsWith('class-group-') || Boolean(msg.class_name);

          if (!isMatch && isConvClass && isMsgClass) {
            if (conv.class_id && (msg.class_name === conv.class_id || msg.conversation_id?.includes(conv.class_id))) {
              isMatch = true;
            }
            const cRaw = conv.id.replace('class-group-', '');
            const mRaw = (msg.conversation_id || '').replace('class-group-', '');
            if (cRaw && mRaw && (cRaw === mRaw || cRaw === msg.class_name || mRaw === conv.class_id)) {
              isMatch = true;
            }
            const cleanC = getCleanClassName(conv.name, '');
            const cleanM = getCleanClassName(msg.class_name || msg.conversation_id, '');
            if (cleanC && cleanM && (cleanC === cleanM || normBengali(cleanC) === normBengali(cleanM))) {
              isMatch = true;
            }
          }

          // Direct chat matching logic
          if (!isMatch && conv.type === 'direct' && msg.conversation_id?.startsWith('direct-')) {
            const p1 = conv.id.replace('direct-', '').split('-').sort().join('-');
            const p2 = msg.conversation_id.replace('direct-', '').split('-').sort().join('-');
            if (p1 === p2) isMatch = true;
          }

          // Announcement matching logic
          if (!isMatch && (conv.type === 'announcement' || conv.id.startsWith('announcement-')) && msg.conversation_id?.startsWith('announcement-')) {
            isMatch = true;
          }

          // Staff room matching logic
          if (!isMatch && (conv.type === 'teacher_staff' || conv.id.startsWith('staff-')) && msg.conversation_id?.startsWith('staff-')) {
            isMatch = true;
          }

          if (isMatch) {
            matched = true;
            const isNotActive = conv.id !== activeConversationId;
            const isNotMe = msg.sender_id !== currentUserId;
            
            return {
              ...conv,
              last_message: msg,
              unread_count: (isNotActive && isNotMe) ? (conv.unread_count || 0) + 1 : 0
            };
          }
          return conv;
        });

        // If conversation is brand new and not yet in list:
        if (!matched && msg.conversation_id) {
          const isMsgClassGroup = msg.conversation_id.startsWith('class-group-') || Boolean(msg.class_name);

          if (!isAdmin) {
            if (msg.conversation_id.startsWith('direct-')) {
              const isMyDirect = (currentUserId && msg.conversation_id.includes(currentUserId)) || msg.sender_id === currentUserId;
              if (!isMyDirect) return updated;
            } else if (msg.conversation_id.startsWith('staff-') && userRole === 'parent') {
              return updated;
            }
          }

          const isNotMe = msg.sender_id !== currentUserId;
          let newConvType: 'class_group' | 'direct' | 'announcement' | 'teacher_staff' = 'direct';
          let newConvName = msg.sender_name || (msg.sender_profile as any)?.full_name || 'নতুন কথোপকথন';

          if (isMsgClassGroup) {
            newConvType = 'class_group';
            const cleanCls = getCleanClassName(msg.class_name || msg.conversation_id, 'ক্লাস');
            newConvName = `${cleanCls} (অভিভাবক ও শিক্ষক গ্রুপ)`;
          } else if (msg.conversation_id.startsWith('announcement-')) {
            newConvType = 'announcement';
            newConvName = 'প্রতিষ্ঠান নোটিশ বোর্ড (অফিসিয়াল)';
          } else if (msg.conversation_id.startsWith('staff-')) {
            newConvType = 'teacher_staff';
            newConvName = 'শিক্ষক ও স্টাফ কামরা';
          }

          const newConvId = isMsgClassGroup && !msg.conversation_id.startsWith('class-group-') ? `class-group-${msg.conversation_id}` : msg.conversation_id;

          const newConv: Conversation = {
            id: newConvId,
            institution_id: institutionId,
            type: newConvType,
            name: newConvName,
            class_id: isMsgClassGroup ? (msg.class_name || msg.conversation_id.replace('class-group-', '')) : undefined,
            last_message: msg,
            unread_count: isNotMe ? 1 : 0,
            created_at: msg.created_at,
            updated_at: msg.created_at
          };
          return [newConv, ...updated];
        }

        // Sort conversations with most recent last_message on top
        return updated.sort((a, b) => {
          const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at || 0).getTime();
          const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });
      });
    };

    const channelName = `global_notifs_${institutionId}`;
    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'new_message' }, (p) => p.payload && handleGlobalIncoming(p.payload as ChatMessage))
      .on('broadcast', { event: 'message_read' }, (p) => {
        if (p?.payload?.conversation_id) {
          setConversations(prev => prev.map(c => c.id === p.payload.conversation_id ? { ...c, unread_count: 0 } : c));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        if (p?.new) {
          handleGlobalIncoming(formatRowToChatMessage(p.new));
        }
      })
      .subscribe();

    // Cross-tab broadcast listener
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(`deenora_msg_channel_${institutionId}`);
      bc.onmessage = (event) => {
        if (event.data?.type === 'NEW_MESSAGE' && event.data.payload) {
          handleGlobalIncoming(event.data.payload);
        }
      };
    }

    return () => {
      supabase.removeChannel(channel);
      if (bc) bc.close();
    };
  }, [institutionId, activeConversationId, currentUserId, userRole, userClassId]);

  const handleSendMessage = (
    text: string, 
    replyToId?: string, 
    messageType: 'text' | 'image' | 'document' | 'voice' = 'text',
    attachmentUrl?: string,
    voiceDuration?: number,
    attachmentName?: string,
    attachmentSize?: number
  ) => {
    const senderId = currentUserId || 'admin-user';
    const senderName = profile?.full_name || (profile as any)?.name || (userRole === 'parent' ? 'অভিভাবক' : 'এডমিন / শিক্ষক');
    const rawClassName = activeConversation?.name || activeConversation?.class_id || undefined;
    const className = rawClassName ? getCleanClassName(rawClassName, rawClassName) : undefined;
    const replyTarget = replyToId ? messages.find(m => m.id === replyToId || m.client_message_id === replyToId) : undefined;
    const replyToMsg = replyTarget ? { id: replyTarget.id, sender_name: replyTarget.sender_name || (replyTarget.sender_profile as any)?.full_name || 'User', message: replyTarget.message, message_type: replyTarget.message_type } : undefined;
    sendMessage(senderId, text, senderName, className, messageType, attachmentUrl, voiceDuration, attachmentName, attachmentSize, replyToId, replyToMsg);
  };

  return (
    <div className={`h-full w-full flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      <div className={`flex-1 flex overflow-hidden w-full h-full ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        {/* Left Sidebar (Visible on Desktop OR when mobile chat is NOT active) */}
        <div className={`w-full md:w-auto ${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col h-full shrink-0`}>
          <ChatSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onOpenBackup={() => setShowBackupModal(true)}
            lang={lang}
            isDark={isDark}
            loading={conversationsLoading}
            userRole={userRole}
            isAdmin={isAdmin}
          />
        </div>

        {/* Right Chat Window (Visible on Desktop OR when mobile chat IS active) */}
        <div className={`flex-1 ${!showMobileChat ? 'hidden md:flex' : 'flex'} flex-col h-full min-w-0`}>
          <ChatWindow
            conversation={activeConversation}
            conversations={conversations}
            messages={messages}
            loading={loading || (conversationsLoading && !activeConversation)}
            currentUser={profile}
            userRole={profile?.role}
            onSendMessage={handleSendMessage}
            onOpenInfo={() => setShowGroupInfo(true)}
            onOpenBackup={() => setShowBackupModal(true)}
            onBackMobile={() => setShowMobileChat(false)}
            onStartVoiceCall={
              onStartVoiceCall && userRole !== 'parent' && activeConversation?.type !== 'class_group'
                ? () => onStartVoiceCall(activeConversation?.name)
                : undefined
            }
            onRetryMessage={retryMessage}
            lang={lang}
            isDark={isDark}
            isAdmin={isAdmin}
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

      {/* Encrypted Chat Backup & Restore Modal */}
      <ChatBackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        institutionId={institutionId || 'default-inst'}
        userId={currentUserId}
        userEmail={profile?.email || institution?.email}
        onRestoreComplete={async () => {
          // Refresh conversations and active chat messages from IndexedDB
          if (institutionId) {
            const localConvs = await ChatLocalStore.getCachedConversations(institutionId);
            if (localConvs && localConvs.length > 0) {
              setConversations(localConvs);
            }
          }
        }}
        lang={lang}
        isDark={isDark}
      />
    </div>
  );
};
