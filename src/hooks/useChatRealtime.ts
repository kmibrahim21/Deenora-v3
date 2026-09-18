import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { ChatMessage } from '../types';
import { ChatService } from '../services/chatService';
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
    setLoading(true);
    setError(null);

    ChatService.getMessages(conversationId, institutionId || undefined)
      .then(res => {
        if (isMounted) {
          setMessages(res.messages || []);
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

    const handleIncoming = (newMsg: ChatMessage) => {
      if (!newMsg || !newMsg.message) return;

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
        newMsg.message || 'নতুন মেসেজ এসেছে',
        '/icon.png'
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
      .on('broadcast', { event: 'new_message' }, (p) => p?.payload && handleIncoming(p.payload as ChatMessage))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => p?.new && handleIncoming(p.new as ChatMessage))
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
  const sendMessage = useCallback(async (senderId: string, text: string, senderName?: string, className?: string) => {
    if (!conversationId || !institutionId || !text.trim()) return;

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
      message: text.trim(),
      message_type: 'text',
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
      const sentMsg = await ChatService.sendMessage(institutionId, conversationId, senderId, text, clientMsgId, senderName, className);
      
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
