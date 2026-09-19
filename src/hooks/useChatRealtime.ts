import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { ChatMessage } from '../types';
import { ChatService, formatRowToChatMessage } from '../services/chatService';
import { sendPushNotification, playNotificationSound } from '../lib/pushNotifications';

export function useChatRealtime(conversationId: string | null, institutionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeConvRef = useRef<string | null>(conversationId);

  useEffect(() => {
    activeConvRef.current = conversationId;
  }, [conversationId]);

  // Load initial messages when active conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      return;
    }

    let isMounted = true;

    // Check local cache first so user sees messages immediately with 0ms delay!
    const localKey = `deenora_chat_msg_${conversationId}`;
    let hasCache = false;
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          hasCache = true;
        }
      }
    } catch {}

    if (!hasCache) {
      setLoading(true);
    }
    setError(null);

    ChatService.getMessages(conversationId, institutionId || undefined)
      .then(res => {
        if (isMounted) {
          if (res.messages && res.messages.length > 0) {
            setMessages(res.messages);
            try {
              localStorage.setItem(localKey, JSON.stringify(res.messages));
            } catch {}
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
    console.log(`[useChatRealtime] Subscribing to realtime channel: ${channelName}`);

    const handleIncoming = (rawMsg: any) => {
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
          return prev.map(m => (m.client_message_id && m.client_message_id === newMsg.client_message_id ? { ...m, ...newMsg } : m));
        }
        return [...prev, newMsg];
      });
    };

    // Single deterministic channel subscription
    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'new_message' }, (p) => p?.payload && handleIncoming(p.payload))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => p?.new && handleIncoming(p.new))
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useChatRealtime] SUBSCRIBED to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[useChatRealtime] CHANNEL_ERROR for ${channelName}:`, err);
        } else if (status === 'TIMED_OUT') {
          console.warn(`[useChatRealtime] TIMED_OUT for ${channelName}`);
        } else if (status === 'CLOSED') {
          console.log(`[useChatRealtime] CLOSED ${channelName}`);
        }
      });

    // Active Polling Backup (every 4 seconds) for guaranteed sync
    const pollInterval = setInterval(() => {
      if (!activeConvRef.current) return;
      ChatService.getMessages(activeConvRef.current, institutionId)
        .then(res => {
          if (res.messages && res.messages.length > 0) {
            setMessages(prev => {
              const newItems = res.messages.filter(
                lm => !prev.some(pm => pm.id === lm.id || (lm.client_message_id && pm.client_message_id === lm.client_message_id))
              );
              if (newItems.length === 0) return prev;
              return [...prev, ...newItems];
            });
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      console.log(`[useChatRealtime] Cleaning up realtime channel: ${channelName}`);
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
      // Remove failed optimistic message and set user-visible error
      setMessages(prev => prev.filter(m => m.client_message_id !== clientMsgId));
      setError(err?.message || 'মেসেজ পাঠানো সম্ভব হয়নি');
    }
  }, [conversationId, institutionId]);

  return {
    messages,
    loading,
    error,
    sendMessage
  };
}
