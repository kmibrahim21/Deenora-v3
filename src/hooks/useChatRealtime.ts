import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { ChatMessage } from '../types';
import { ChatService } from '../services/chatService';
import { sendPushNotification, playNotificationSound } from '../lib/pushNotifications';

export function useChatRealtime(conversationId: string | null, institutionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const activeConvRef = useRef<string | null>(conversationId);

  useEffect(() => {
    activeConvRef.current = conversationId;
  }, [conversationId]);

  // Load initial messages when active conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    ChatService.getMessages(conversationId)
      .then(msgs => {
        if (isMounted) {
          setMessages(msgs);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('[useChatRealtime] Load messages error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Subscribe to Supabase Realtime updates & active polling backup for live messages
  useEffect(() => {
    if (!conversationId || !institutionId) return;

    console.log(`[useChatRealtime] Subscribing to realtime for conv: ${conversationId}`);

    const handleIncoming = (newMsg: ChatMessage) => {
      if (!newMsg || !newMsg.message) return;

      // Check conversation match (or matching class group)
      const currentActive = activeConvRef.current;
      const isMatch =
        newMsg.conversation_id === currentActive ||
        (currentActive && currentActive.startsWith('class-group-') && newMsg.conversation_id.startsWith('class-group-'));

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

    // 1. Subscribe to Broadcast & Postgres Changes channels
    const channel = supabase.channel(`chat_realtime_${institutionId}_${conversationId}`)
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          if (payload?.payload) {
            handleIncoming(payload.payload as ChatMessage);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload?.new) {
            handleIncoming(payload.new as ChatMessage);
          }
        }
      )
      .subscribe();

    // 2. Active Polling Backup (every 3 seconds) for 100% message arrival guarantee
    const pollInterval = setInterval(() => {
      if (!activeConvRef.current) return;
      ChatService.getMessages(activeConvRef.current)
        .then(latestMsgs => {
          if (latestMsgs && latestMsgs.length > 0) {
            setMessages(prev => {
              const newItems = latestMsgs.filter(
                lm => !prev.some(pm => pm.id === lm.id || (lm.client_message_id && pm.client_message_id === lm.client_message_id))
              );
              if (newItems.length === 0) return prev;
              return [...prev, ...newItems];
            });
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      console.log(`[useChatRealtime] Cleaning up realtime channel for: ${conversationId}`);
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
    } catch (err) {
      console.error('[useChatRealtime] Send error:', err);
    }
  }, [conversationId, institutionId]);

  return {
    messages,
    loading,
    sendMessage
  };
}
