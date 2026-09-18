import { supabase } from '../supabase';
import { Conversation, ConversationMember, ChatMessage } from '../types';

export class ChatService {
  /**
   * Fetches or initializes all conversations accessible by a user in an institution.
   * Dynamically ensures class groups exist for the institution's classes.
   */
  static async getConversations(
    institutionId: string,
    userId: string,
    classesList: Array<{ id: string; name: string }> = [],
    userRole?: string,
    userClassId?: string
  ): Promise<Conversation[]> {
    if (!institutionId) return [];

    try {
      // 1. Fetch conversations from Supabase if table exists
      const { data: userMemberships, error: memberErr } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at, is_muted, is_pinned')
        .eq('user_id', userId)
        .is('left_at', null);

      if (memberErr && memberErr.code !== 'PGRST116') {
        console.warn('[ChatService] Database conversation_members table query notice:', memberErr.message);
      }

      const conversationIds = userMemberships ? userMemberships.map((m: any) => m.conversation_id) : [];

      let dbConversations: Conversation[] = [];
      if (conversationIds.length > 0) {
        const { data: convData } = await supabase
          .from('conversations')
          .select('*')
          .in('id', conversationIds)
          .eq('institution_id', institutionId);

        if (convData) {
          dbConversations = convData as Conversation[];
        }
      }

      // Filter classes for parent if userRole is parent and userClassId is specified
      let filteredClasses = classesList;
      if (userRole === 'parent' && userClassId) {
        const matching = classesList.filter(c => c.id === userClassId || c.id.includes(userClassId) || userClassId.includes(c.id));
        if (matching.length > 0) {
          filteredClasses = matching;
        }
      }

      // 2. Build or merge default/auto-generated class groups & announcements
      const mappedConversations: Conversation[] = [...dbConversations];

      // Auto-generate Class Group conversations for active classes if not present
      for (const cls of filteredClasses) {
        const classGroupId = `class-group-${cls.id}`;
        const exists = mappedConversations.some(
          c => c.class_id === cls.id || c.id === classGroupId || c.name?.includes(cls.name)
        );

        if (!exists) {
          mappedConversations.push({
            id: classGroupId,
            institution_id: institutionId,
            type: 'class_group',
            name: `${cls.name} (অভিভাবক ও শিক্ষক গ্রুপ)`,
            class_id: cls.id,
            is_announcement_only: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            unread_count: 0
          });
        }
      }

      // Ensure Institution Announcement Channel exists
      if (!mappedConversations.some(c => c.type === 'announcement')) {
        mappedConversations.unshift({
          id: `announcement-${institutionId}`,
          institution_id: institutionId,
          type: 'announcement',
          name: 'প্রতিষ্ঠান নোটিশ বোর্ড (অফিসিয়াল)',
          is_announcement_only: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unread_count: 0
        });
      }

      // Ensure Staff Group exists (ONLY for teachers/staff/admin, NOT for parents)
      if (userRole !== 'parent' && !mappedConversations.some(c => c.type === 'teacher_staff')) {
        mappedConversations.push({
          id: `staff-${institutionId}`,
          institution_id: institutionId,
          type: 'teacher_staff',
          name: 'শিক্ষক ও স্টাফ কামরা',
          is_announcement_only: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unread_count: 0
        });
      }

      // Filter conversations for parent role to hide irrelevant staff/class groups
      let finalConversations = mappedConversations;
      if (userRole === 'parent') {
        finalConversations = mappedConversations.filter(c => {
          if (c.type === 'teacher_staff') return false;
          if (c.type === 'class_group' && userClassId) {
            return c.class_id === userClassId || c.id === `class-group-${userClassId}` || c.id.includes(userClassId);
          }
          return true;
        });
      }

      // Fetch last message for each conversation
      for (const conv of finalConversations) {
        conv.last_message = await this.getLastMessage(conv.id);
      }

      return finalConversations;
    } catch (err) {
      console.error('[ChatService] Failed to load conversations, using fallback:', err);
      return this.getFallbackConversations(institutionId, classesList, userRole, userClassId);
    }
  }

  /**
   * Get the latest message in a conversation.
   */
  static async getLastMessage(conversationId: string): Promise<ChatMessage | undefined> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // Check local storage fallback
        const localKey = `deenora_chat_msg_${conversationId}`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed[parsed.length - 1];
          }
        }
        return undefined;
      }

      return data as ChatMessage;
    } catch {
      return undefined;
    }
  }

  /**
   * Gets message history for a specific conversation.
   */
  static async getMessages(conversationId: string, limit = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error || !data || data.length === 0) {
        // Fallback to localStorage cache
        const localKey = `deenora_chat_msg_${conversationId}`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          return JSON.parse(stored);
        }
        return [];
      }

      return data as ChatMessage[];
    } catch (err) {
      console.warn('[ChatService] Supabase messages query fallback:', err);
      const localKey = `deenora_chat_msg_${conversationId}`;
      const stored = localStorage.getItem(localKey);
      return stored ? JSON.parse(stored) : [];
    }
  }

  /**
   * Sends a message in a conversation.
   */
  static async sendMessage(
    institutionId: string,
    conversationId: string,
    senderId: string,
    messageText: string,
    clientMessageId?: string
  ): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: clientMessageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      conversation_id: conversationId,
      institution_id: institutionId,
      sender_id: senderId,
      client_message_id: clientMessageId,
      message: messageText.trim(),
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_edited: false,
      is_deleted: false
    };

    // 1. Try Supabase insert
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          institution_id: institutionId,
          sender_id: senderId,
          client_message_id: clientMessageId || newMessage.id,
          message: messageText.trim(),
          message_type: 'text'
        }])
        .select()
        .single();

      if (!error && data) {
        newMessage.id = data.id;
      }
    } catch (err) {
      console.warn('[ChatService] Online insert notice, saved to local cache:', err);
    }

    // 2. Always persist to localStorage for instant local view & offline reliability
    const localKey = `deenora_chat_msg_${conversationId}`;
    const stored = localStorage.getItem(localKey);
    const existing: ChatMessage[] = stored ? JSON.parse(stored) : [];

    // Idempotent push (prevent duplicate clientMessageId)
    if (!existing.some(m => m.id === newMessage.id || (clientMessageId && m.client_message_id === clientMessageId))) {
      existing.push(newMessage);
      localStorage.setItem(localKey, JSON.stringify(existing));
    }

    return newMessage;
  }

  /**
   * Fallback conversations when offline or database tables are initializing.
   */
  private static getFallbackConversations(
    institutionId: string,
    classesList: Array<{ id: string; name: string }>,
    userRole?: string,
    userClassId?: string
  ): Conversation[] {
    const fallback: Conversation[] = [
      {
        id: `announcement-${institutionId}`,
        institution_id: institutionId,
        type: 'announcement',
        name: 'প্রতিষ্ঠান নোটিশ বোর্ড (অফিসিয়াল)',
        is_announcement_only: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    if (userRole !== 'parent') {
      fallback.push({
        id: `staff-${institutionId}`,
        institution_id: institutionId,
        type: 'teacher_staff',
        name: 'শিক্ষক ও স্টাফ কামরা',
        is_announcement_only: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const filtered = userRole === 'parent' && userClassId
      ? classesList.filter(c => c.id === userClassId || c.id.includes(userClassId) || userClassId.includes(c.id))
      : classesList;

    filtered.forEach(cls => {
      fallback.push({
        id: `class-group-${cls.id}`,
        institution_id: institutionId,
        type: 'class_group',
        name: `${cls.name} (অভিভাবক ও শিক্ষক গ্রুপ)`,
        class_id: cls.id,
        is_announcement_only: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    return fallback;
  }
}
