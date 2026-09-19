import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { ChatMessage } from '../types';
import { ChatService, formatRowToChatMessage } from '../services/chatService';
import { ChatLocalStore } from '../services/chatLocalStore';
import { sendPushNotification, playNotificationSound } from '../lib/pushNotifications';

export function useChatRealtime(conversationId: string | null, institutionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const activeConvRef = useRef<string | null>(conversationId);

  useEffect(() => {
    activeConvRef.current = conversationId;
  }, [conversationId]);

  // Handle online event to auto-sync pending offline messages
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[useChatRealtime] Device is online, checking pending messages sync...');
      setIsSyncing(true);
      try {
        const syncedCount = await ChatService.syncPendingMessages(institutionId || undefined);
        if (syncedCount > 0 && activeConvRef.current) {
          const refreshed = await ChatService.getMessages(activeConvRef.current, institutionId || undefined);
          if (refreshed.messages && refreshed.messages.length > 0) {
            setMessages(refreshed.messages);
          }
        }
      } catch (e) {
        console.warn('[useChatRealtime] Online sync warning:', e);
      } finally {
        setIsSyncing(false);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [institutionId]);

  // Load initial messages with instant 0ms IndexedDB cache
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      return;
    }

    let isMounted = true;

    // 1. Instant 0ms read from IndexedDB
    ChatLocalStore.getCachedMessages(conversationId)
      .then(async cachedMsgs => {
        if (!isMounted) return;
        if (cachedMsgs && cachedMsgs.length > 0) {
          const pending = await ChatLocalStore.getPendingMessages(institutionId || undefined);
          const pendingForConv = pending.filter(p => p.conversation_id === conversationId);
          
          const mergedMap = new Map<string, ChatMessage>();
          cachedMsgs.forEach(m => mergedMap.set(m.client_message_id || m.id, m));
          pendingForConv.forEach(p => {
            if (!mergedMap.has(p.client_message_id)) {
              mergedMap.set(p.client_message_id, {
                id: p.client_message_id,
                client_message_id: p.client_message_id,
                conversation_id: p.conversation_id,
                institution_id: p.institution_id,
                sender_id: p.sender_id,
                sender_name: p.sender_name,
                class_name: p.class_name,
                message: p.message,
                message_type: p.message_type,
                attachment_url: p.attachment_url,
                attachment_name: p.attachment_name,
                attachment_size: p.attachment_size,
                voice_duration: p.voice_duration,
                created_at: p.created_at,
                status: p.status,
                synced: 0
              });
            }
          });
          
          setMessages(Array.from(mergedMap.values()));
        } else {
          setLoading(true);
        }
      })
      .catch(() => {
        setLoading(true);
      });

    setError(null);

    // 2. Query Supabase in background & merge seamlessly
    ChatService.getMessages(conversationId, institutionId || undefined)
      .then(res => {
        if (isMounted) {
          if (res.messages && res.messages.length > 0) {
            setMessages(res.messages);
          }
          if (res.error) setError(res.error);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('[useChatRealtime] Load messages error:', err);
        if (isMounted) {
          setError(err?.message || 'মেসেজ লোড করতে ব্যর্থ হয়েছে');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [conversationId, institutionId]);

  // Subscribe to Supabase Realtime updates & active polling backup for live messages
  useEffect(() => {
    if (!conversationId || !institutionId) return;

    const channelName = `chat_realtime_${institutionId}_${conversationId}`;

    const handleIncoming = async (rawMsg: any) => {
      if (!rawMsg) return;
      const newMsg = formatRowToChatMessage(rawMsg, activeConvRef.current);
      if (!newMsg || (!newMsg.message && !newMsg.attachment_url)) return;

      const currentActive = activeConvRef.current;
      if (!currentActive) return;

      const activeRaw = currentActive.replace('class-group-', '');

      const isMatch =
        newMsg.conversation_id === currentActive ||
        (newMsg.conversation_id && newMsg.conversation_id === activeRaw) ||
        (newMsg.class_name && (newMsg.class_name === currentActive || newMsg.class_name === activeRaw)) ||
        (currentActive.startsWith('class-group-') && (
          (newMsg.conversation_id && newMsg.conversation_id.startsWith('class-group-')) ||
          (newMsg.class_name && (newMsg.class_name.startsWith('class-group-') || newMsg.class_name === activeRaw))
        ));

      if (!isMatch) return;

      // Persist to local IndexedDB store
      await ChatLocalStore.saveMessage(newMsg);

      // Play chime & send push notification for incoming message
      playNotificationSound();
      sendPushNotification(
        newMsg.sender_profile?.full_name || (newMsg as any).sender_name || 'Deenora Chat',
        newMsg.message || (newMsg.message_type === 'voice' ? '🎤 ভয়েস মেসেজ' : 'নতুন মেসেজ এসেছে'),
        '/Deenora192.png'
      );

      setMessages(prev => {
        const exists = prev.some(
          m => m.id === newMsg.id || (newMsg.client_message_id && m.client_message_id === newMsg.client_message_id)
        );
        if (exists) {
          return prev.map(m => ((m.client_message_id && m.client_message_id === newMsg.client_message_id) || m.id === newMsg.id ? { ...m, ...newMsg } : m));
        }
        return [...prev, newMsg];
      });
    };

    // Single deterministic channel subscription
    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'new_message' }, (p) => p?.payload && handleIncoming(p.payload))
      .on('broadcast', { event: 'message_read' }, (p) => {
        if (p?.payload?.conversation_id === activeConvRef.current) {
          setMessages(prev => prev.map(m => ({ ...m, status: 'read' })));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => p?.new && handleIncoming(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        if (p?.new) {
          setMessages(prev => prev.map(m => m.id === p.new.id ? { ...m, ...formatRowToChatMessage(p.new, activeConvRef.current) } : m));
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useChatRealtime] SUBSCRIBED to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[useChatRealtime] CHANNEL_ERROR for ${channelName}:`, err);
        }
      });

    // Active Polling Backup (every 4 seconds) for guaranteed sync
    const pollInterval = setInterval(() => {
      if (!activeConvRef.current) return;
      ChatService.getMessages(activeConvRef.current, institutionId)
        .then(res => {
          if (res.messages && res.messages.length > 0) {
            setMessages(prev => {
              if (prev.length === 0) return res.messages;
              const map = new Map<string, ChatMessage>();
              prev.forEach(m => map.set(m.client_message_id || m.id, m));
              res.messages.forEach(m => {
                const key = m.client_message_id || m.id;
                const existing = map.get(key);
                if (!existing || existing.status === 'pending') {
                  map.set(key, m);
                } else {
                  map.set(key, { ...existing, ...m });
                }
              });
              return Array.from(map.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [conversationId, institutionId]);

  // Function to send a message
  const sendMessage = useCallback(async (
    senderId: string, 
    text: string, 
    senderName?: string, 
    className?: string,
    messageType: 'text' | 'image' | 'document' | 'voice' = 'text',
    attachmentUrl?: string,
    voiceDuration?: number,
    attachmentName?: string,
    attachmentSize?: number
  ) => {
    if (!conversationId || !institutionId || (!text.trim() && messageType === 'text' && !attachmentUrl)) return;

    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Optimistic UI update
    const optimisticMsg: ChatMessage = {
      id: clientMsgId,
      conversation_id: conversationId,
      institution_id: institutionId,
      sender_id: senderId,
      sender_name: senderName || 'User',
      class_name: className || undefined,
      client_message_id: clientMsgId,
      message: text ? text.trim() : (messageType === 'voice' ? '🎤 ভয়েস মেসেজ' : (messageType === 'document' ? (attachmentName || 'ডকুমেন্ট') : '')),
      message_type: messageType,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
      voice_duration: voiceDuration,
      created_at: new Date().toISOString(),
      status: 'pending',
      synced: 0,
      sender_profile: {
        id: senderId,
        institution_id: institutionId,
        full_name: senderName || 'User',
        role: senderId.startsWith('parent') ? 'parent' : 'teacher',
        is_active: true,
        created_at: new Date().toISOString()
      } as any
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const sentMsg = await ChatService.sendMessage(
        institutionId, 
        conversationId, 
        senderId, 
        text, 
        clientMsgId, 
        senderName, 
        className,
        messageType,
        attachmentUrl,
        voiceDuration,
        attachmentName,
        attachmentSize
      );
      
      // Reconcile optimistic message with server response
      setMessages(prev =>
        prev.map(m => (m.client_message_id === clientMsgId ? sentMsg : m))
      );
    } catch (err: any) {
      console.error('[useChatRealtime] Send error:', err);
      // Mark as failed in UI so user can retry rather than silently deleting it
      setMessages(prev =>
        prev.map(m => (m.client_message_id === clientMsgId ? { ...m, status: 'failed', error: err?.message || 'পাঠানো যায়নি' } : m))
      );
      setError(err?.message || 'মেসেজ পাঠানো সম্ভব হয়নি (অফলাইনে সেভ করা হয়েছে)');
    }
  }, [conversationId, institutionId]);

  // Function to retry a failed message
  const retryMessage = useCallback(async (clientMessageId: string) => {
    setMessages(prev =>
      prev.map(m => (m.client_message_id === clientMessageId ? { ...m, status: 'sending', error: undefined } : m))
    );

    const result = await ChatService.retryPendingMessage(clientMessageId);
    if (result) {
      setMessages(prev =>
        prev.map(m => (m.client_message_id === clientMessageId ? result : m))
      );
    } else {
      setMessages(prev =>
        prev.map(m => (m.client_message_id === clientMessageId ? { ...m, status: 'failed' } : m))
      );
    }
  }, []);

  return {
    messages,
    loading,
    error,
    isSyncing,
    sendMessage,
    retryMessage
  };
}
