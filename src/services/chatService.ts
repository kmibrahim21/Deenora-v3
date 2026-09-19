import { supabase } from '../supabase';
import { Conversation, ConversationMember, ChatMessage } from '../types';

export function formatRowToChatMessage(row: any, fallbackConvId?: string): ChatMessage {
  if (!row) return row;

  let parsedPayload: any = null;
  if (typeof row.message === 'string') {
    const trimmed = row.message.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedPayload = JSON.parse(trimmed);
      } catch {}
    }
  }

  const isAudio = (u?: any) => typeof u === 'string' && (
    u.startsWith('data:audio') ||
    u.includes('chat-audio') ||
    u.includes('.webm') ||
    u.includes('.mp3') ||
    u.includes('.ogg') ||
    u.includes('.wav') ||
    u.includes('.m4a')
  );

  let rawAttachmentUrl =
    row.attachment_url ||
    parsedPayload?.attachment_url ||
    parsedPayload?.voice_url ||
    parsedPayload?.audio_url ||
    undefined;

  const rawVoiceDuration =
    row.voice_duration ??
    parsedPayload?.voice_duration ??
    parsedPayload?.duration ??
    undefined;

  const messageType =
    parsedPayload?.message_type ||
    row.message_type ||
    (
      isAudio(rawAttachmentUrl) ||
      (rawVoiceDuration && Number(rawVoiceDuration) > 0) ||
      (row.message && typeof row.message === 'string' && (row.message.includes('🎤 ভয়েস মেসেজ') || row.message.includes('🎤 Voice')))
        ? 'voice'
        : (rawAttachmentUrl || row.attachment_name || parsedPayload?.attachment_name ? 'document' : 'text')
    );

  const msgId = String(row.id || parsedPayload?.client_message_id || '');
  if (!rawAttachmentUrl && msgId && messageType === 'voice') {
    try {
      const localAudio = localStorage.getItem(`chat_audio_${msgId}`);
      if (localAudio) rawAttachmentUrl = localAudio;
    } catch {}
  }

  const attachmentName =
    row.attachment_name ||
    parsedPayload?.attachment_name ||
    undefined;

  const attachmentSize =
    row.attachment_size ||
    parsedPayload?.attachment_size ||
    undefined;

  let textMessage = '';
  if (parsedPayload) {
    textMessage = parsedPayload.text || parsedPayload.desc || (messageType === 'voice' ? '🎤 ভয়েস মেসেজ' : '');
  } else if (typeof row.message === 'string') {
    textMessage = row.message;
  }

  const senderId =
    row.sender_id ||
    parsedPayload?.sender_id ||
    (row.sender_name?.includes('অভিভাবক') ? 'parent-user' : 'teacher-user');

  const isParent =
    row.is_parent ??
    (row.sender_name?.includes('অভিভাবক') || (senderId && senderId.startsWith('parent')));

  return {
    id: msgId || `msg-${Date.now()}`,
    conversation_id: row.conversation_id || parsedPayload?.conversation_id || row.class_name || fallbackConvId || '',
    institution_id: row.institution_id || parsedPayload?.institution_id || '',
    sender_id: senderId,
    sender_name: row.sender_name || row.title || parsedPayload?.sender_name || (isParent ? 'অভিভাবক' : 'শিক্ষক / এডমিন'),
    class_name: row.class_name || parsedPayload?.class_name,
    client_message_id: row.client_message_id || parsedPayload?.client_message_id,
    message: textMessage || (messageType === 'voice' ? '🎤 ভয়েস মেসেজ' : ''),
    message_type: messageType,
    attachment_url: rawAttachmentUrl,
    attachment_name: attachmentName,
    attachment_size: attachmentSize,
    voice_duration: rawVoiceDuration ? Number(rawVoiceDuration) : undefined,
    created_at: row.created_at || new Date().toISOString(),
    is_edited: row.is_edited || false,
    is_deleted: row.is_deleted || false,
    is_parent: isParent,
    sender_role: isParent ? 'parent' : 'teacher',
    sender_profile: {
      id: senderId,
      institution_id: row.institution_id || '',
      full_name: row.sender_name || row.title || (isParent ? 'অভিভাবক' : 'শিক্ষক / এডমিন'),
      role: isParent ? 'parent' : 'teacher',
      is_active: true,
      created_at: row.created_at || new Date().toISOString()
    } as any
  };
}

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
      const normBengali = (str: string) => (str || '').replace(/শ্রেণী/g, 'শ্রেণি').replace(/[\s_-]+/g, '').toLowerCase();

      if (userRole === 'parent' && userClassId) {
        const matching = classesList.filter(c => {
          if (c.id === userClassId || c.id.includes(userClassId) || userClassId.includes(c.id)) return true;
          const normC = normBengali(c.name);
          const normU = normBengali(userClassId);
          return normC && normU && (normC === normU || normC.includes(normU) || normU.includes(normC));
        });
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
          c => c.class_id === cls.id || c.id === classGroupId || normBengali(c.name).includes(normBengali(cls.name))
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
            if (c.class_id === userClassId || c.id === `class-group-${userClassId}` || c.id.includes(userClassId)) return true;
            const normC = normBengali(c.name);
            const normU = normBengali(userClassId);
            return normC && normU && (normC === normU || normC.includes(normU) || normU.includes(normC));
          }
          return true;
        });
      }

      // Fetch last message & calculate unread count for each conversation concurrently in parallel
      await Promise.all(
        finalConversations.map(async (conv) => {
          try {
            // Check local cache first for immediate responsiveness
            const localKey = `deenora_chat_msg_${conv.id}`;
            const stored = localStorage.getItem(localKey);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  conv.last_message = parsed[parsed.length - 1];
                }
              } catch {}
            }

            const membership = userMemberships?.find((m: any) => m.conversation_id === conv.id);
            const lastReadAt = membership?.last_read_at || localStorage.getItem(`chat_last_read_${userId}_${conv.id}`) || conv.created_at;

            // Concurrently query last message and unread count
            const [lastMsgRes, unreadRes] = await Promise.all([
              supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id)
                .gt('created_at', lastReadAt)
                .neq('sender_id', userId),
            ]);

            if (lastMsgRes.data) {
              conv.last_message = lastMsgRes.data as ChatMessage;
            }
            if (typeof unreadRes.count === 'number') {
              conv.unread_count = unreadRes.count;
            }
          } catch (e) {
            console.warn('[ChatService] Metadata fetch warning for conv:', conv.id, e);
          }
        })
      );

      // Save to local cache so next time it loads with 0 latency
      try {
        localStorage.setItem(`cached_convs_${institutionId}_${userId}`, JSON.stringify(finalConversations));
      } catch {}

      return finalConversations;
    } catch (err) {
      console.error('[ChatService] Failed to load conversations, using fallback:', err);
      return this.getFallbackConversations(institutionId, classesList, userRole, userClassId);
    }
  }

  /**
   * Marks all messages in a conversation as read for a user.
   */
  static async markAsRead(institutionId: string, conversationId: string, userId: string) {
    if (!institutionId || !conversationId || !userId) return;

    const now = new Date().toISOString();
    
    // 1. Update database if possible
    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: now })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
    } catch (e) {
      console.warn('[ChatService] Failed to update read status in DB:', e);
    }

    // 2. Local fallback
    localStorage.setItem(`chat_last_read_${userId}_${conversationId}`, now);
  }

  /**
   * Attempts to upload audio (blob or base64 data URI) to Supabase Storage.
   * Returns public URL if successful, or null if storage is not available.
   */
  static async uploadAudioAttachment(
    blobOrBase64: string | Blob,
    institutionId: string,
    conversationId: string
  ): Promise<string | null> {
    try {
      let audioBlob: Blob;
      let extension = 'webm';
      let mimeType = 'audio/webm';

      if (typeof blobOrBase64 === 'string' && blobOrBase64.startsWith('data:')) {
        const parts = blobOrBase64.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
        if (mimeType.includes('mp4')) extension = 'mp4';
        else if (mimeType.includes('ogg')) extension = 'ogg';
        else if (mimeType.includes('aac')) extension = 'aac';
        else if (mimeType.includes('wav')) extension = 'wav';

        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        audioBlob = new Blob([u8arr], { type: mimeType });
      } else if (blobOrBase64 instanceof Blob) {
        audioBlob = blobOrBase64;
        mimeType = blobOrBase64.type || 'audio/webm';
        if (mimeType.includes('mp4')) extension = 'mp4';
      } else {
        return null;
      }

      const bucketsToTry = ['madrasah-assets', 'voice-templates'];
      const cleanFileName = `chat-audio/${institutionId}/${conversationId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${extension}`;

      for (const bucketName of bucketsToTry) {
        try {
          await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(cleanFileName, audioBlob, {
              contentType: mimeType,
              cacheControl: '3600',
              upsert: true
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(cleanFileName);

            if (publicUrlData?.publicUrl) {
              return publicUrlData.publicUrl;
            }
          } else {
            console.warn(`[ChatService] Upload notice for bucket ${bucketName}:`, uploadError.message);
          }
        } catch (bucketErr) {
          console.warn(`[ChatService] Bucket ${bucketName} exception:`, bucketErr);
        }
      }
    } catch (e) {
      console.warn('[ChatService] Storage audio upload notice:', e);
    }
    return null;
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
        // Fallback: try by class_name
        const isClassGroup = conversationId.startsWith('class-group-');
        const classIdRaw = isClassGroup ? conversationId.replace('class-group-', '') : '';
        if (classIdRaw) {
          const { data: classLast } = await supabase
            .from('messages')
            .select('*')
            .eq('class_name', classIdRaw)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (classLast) {
            return formatRowToChatMessage(classLast, conversationId);
          }
        }

        // Check local storage fallback
        const localKey = `deenora_chat_msg_${conversationId}`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return formatRowToChatMessage(parsed[parsed.length - 1], conversationId);
          }
        }
        return undefined;
      }

      return formatRowToChatMessage(data, conversationId);
    } catch {
      return undefined;
    }
  }

  /**
   * Gets message history for a specific conversation.
   */
  static async getMessages(
    conversationId: string,
    institutionId?: string,
    limit = 50
  ): Promise<{ messages: ChatMessage[]; error: string | null }> {
    if (!conversationId) {
      return { messages: [], error: null };
    }

    try {
      const isClassGroup = conversationId.startsWith('class-group-');
      const classIdRaw = isClassGroup ? conversationId.replace('class-group-', '') : '';

      // 1. Query by exact conversation_id
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }

      const { data: convData, error: convErr } = await query;

      if (!convErr && convData && convData.length > 0) {
        return { messages: convData.map(row => formatRowToChatMessage(row, conversationId)), error: null };
      }

      if (convErr) {
        console.warn('[ChatService] Notice querying messages by conversation_id:', convErr.message);
      }

      // 2. Fallback query by class_name or raw class ID if conversation_id query returned 0 rows
      const queryClass = classIdRaw || conversationId;
      let classQuery = supabase
        .from('messages')
        .select('*')
        .eq('class_name', queryClass)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (institutionId) {
        classQuery = classQuery.eq('institution_id', institutionId);
      }

      const { data: classData, error: classErr } = await classQuery;

      if (!classErr && classData && classData.length > 0) {
        return { messages: classData.map(row => formatRowToChatMessage(row, conversationId)), error: null };
      }

      if (classErr) {
        console.warn('[ChatService] Notice querying messages by class_name:', classErr.message);
      }

      // 3. Fallback to localStorage cache
      const localKey = `deenora_chat_msg_${conversationId}`;
      const stored = localStorage.getItem(localKey);
      const cached = stored ? JSON.parse(stored) : [];

      const queryError = convErr || classErr;
      return {
        messages: Array.isArray(cached) ? cached.map(row => formatRowToChatMessage(row, conversationId)) : [],
        error: queryError ? queryError.message : null
      };
    } catch (err: any) {
      console.error('[ChatService] Exception in getMessages:', err);
      const localKey = `deenora_chat_msg_${conversationId}`;
      const stored = localStorage.getItem(localKey);
      const cached = stored ? JSON.parse(stored) : [];
      return {
        messages: Array.isArray(cached) ? cached.map(row => formatRowToChatMessage(row, conversationId)) : [],
        error: err?.message || 'মেসেজ লোড করার সময় সমস্যা হয়েছে'
      };
    }
  }

  /**
   * Sends a message in a conversation using the canonical schema.
   */
  static async sendMessage(
    institutionId: string,
    conversationId: string,
    senderId: string,
    messageText: string,
    clientMessageId?: string,
    senderName?: string,
    className?: string,
    messageType: 'text' | 'image' | 'document' | 'voice' = 'text',
    attachmentUrl?: string,
    voiceDuration?: number,
    attachmentName?: string,
    attachmentSize?: number
  ): Promise<ChatMessage> {
    // Fail safely if institutionId or required parameters are missing
    if (!institutionId || !institutionId.trim()) {
      const errMsg = 'প্রতিষ্ঠানের আইডি (Institution ID) পাওয়া যায়নি। মেসেজ পাঠানো সম্ভব নয়।';
      console.error('[ChatService] Missing institutionId:', { institutionId, conversationId, senderId });
      throw new Error(errMsg);
    }

    if (!conversationId || !conversationId.trim()) {
      throw new Error('কনভারসেশন আইডি (Conversation ID) পাওয়া যায়নি।');
    }

    if (!messageText && messageType === 'text' && !attachmentUrl) {
      throw new Error('মেসেজের লেখা খালি হতে পারে না।');
    }

    const cleanInstitutionId = institutionId.trim();
    const cleanConversationId = conversationId.trim();
    const cleanSenderId = senderId ? senderId.trim() : 'parent-user';
    const cleanSenderName = senderName || 'User';

    const isSenderParent = cleanSenderId.startsWith('parent') || (senderName && senderName.includes('অভিভাবক'));

    // If audio is base64 data URI, attempt to upload to storage for efficient delivery
    let finalAttachmentUrl = attachmentUrl;
    if (attachmentUrl && attachmentUrl.startsWith('data:audio')) {
      try {
        const uploadedUrl = await ChatService.uploadAudioAttachment(attachmentUrl, cleanInstitutionId, cleanConversationId);
        if (uploadedUrl) {
          finalAttachmentUrl = uploadedUrl;
        }
      } catch (uploadErr) {
        console.warn('[ChatService] Audio upload fallback:', uploadErr);
      }
    }

    const hasSpecialPayload = Boolean(
      finalAttachmentUrl ||
      messageType === 'voice' ||
      messageType === 'document' ||
      attachmentName ||
      voiceDuration
    );

    const defaultText = messageText ? messageText.trim() : (messageType === 'voice' ? '🎤 ভয়েস মেসেজ' : (attachmentName || 'ডকুমেন্ট'));

    const dbMessageField = hasSpecialPayload
      ? JSON.stringify({
          text: defaultText,
          message_type: messageType,
          attachment_url: finalAttachmentUrl,
          attachment_name: attachmentName,
          attachment_size: attachmentSize,
          voice_duration: voiceDuration,
          conversation_id: cleanConversationId,
          sender_id: cleanSenderId,
          sender_name: cleanSenderName,
          client_message_id: clientMessageId || `client-${Date.now()}`
        })
      : defaultText;

    const newMessage: ChatMessage = {
      id: clientMessageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      conversation_id: cleanConversationId,
      institution_id: cleanInstitutionId,
      sender_id: cleanSenderId,
      sender_name: cleanSenderName,
      class_name: className || cleanConversationId,
      client_message_id: clientMessageId,
      message: defaultText,
      message_type: messageType,
      attachment_url: finalAttachmentUrl,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
      voice_duration: voiceDuration,
      created_at: new Date().toISOString(),
      is_edited: false,
      is_deleted: false,
      is_parent: isSenderParent,
      sender_role: isSenderParent ? 'parent' : 'teacher',
      sender_profile: {
        id: cleanSenderId,
        institution_id: cleanInstitutionId,
        full_name: cleanSenderName,
        role: isSenderParent ? 'parent' : 'teacher',
        is_active: true,
        created_at: new Date().toISOString()
      } as any
    };

    if (finalAttachmentUrl && (messageType === 'voice' || finalAttachmentUrl.startsWith('data:audio') || finalAttachmentUrl.includes('chat-audio'))) {
      try {
        if (clientMessageId) localStorage.setItem(`chat_audio_${clientMessageId}`, finalAttachmentUrl);
        if (newMessage.id) localStorage.setItem(`chat_audio_${newMessage.id}`, finalAttachmentUrl);
      } catch {}
    }

    // 1. Ensure conversation row exists in Supabase DB
    try {
      await supabase.from('conversations').upsert([
        {
          id: cleanConversationId,
          institution_id: cleanInstitutionId,
          type: cleanConversationId.startsWith('class-group-') ? 'class_group' : (cleanConversationId.startsWith('announcement-') ? 'announcement' : 'direct'),
          name: className ? `${className} (অভিভাবক ও শিক্ষক গ্রুপ)` : 'চ্যাট রুম',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'id' });
    } catch (e) {
      console.warn('[ChatService] Conversation upsert notice:', e);
    }

    // 2. Database Insertion with multi-schema resilience
    let isSavedToDB = false;
    
    // Attempt 1: Full chat payload
    try {
      const fullPayload: any = {
        conversation_id: cleanConversationId,
        institution_id: cleanInstitutionId,
        sender_id: cleanSenderId,
        sender_name: cleanSenderName,
        title: cleanSenderName || 'Chat Message',
        class_name: className || cleanConversationId,
        client_message_id: clientMessageId || newMessage.id,
        message: dbMessageField,
        message_type: messageType,
        attachment_url: finalAttachmentUrl,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
        voice_duration: voiceDuration
      };

      const { data: dbData1, error: dbError1 } = await supabase
        .from('messages')
        .insert([fullPayload])
        .select()
        .maybeSingle();

      if (!dbError1 && dbData1) {
        newMessage.id = dbData1.id;
        isSavedToDB = true;
      }
    } catch (e) {
      console.warn('[ChatService] Primary schema notice:', e);
    }

    // Attempt 2: Standard Deenora messages schema with extra columns
    if (!isSavedToDB) {
      try {
        const standardPayload: any = {
          institution_id: cleanInstitutionId,
          class_name: className || cleanConversationId,
          title: cleanSenderName || 'Chat Message',
          sender_name: cleanSenderName || 'Admin',
          message: dbMessageField,
          message_type: messageType,
          attachment_url: finalAttachmentUrl,
          attachment_name: attachmentName,
          attachment_size: attachmentSize,
          voice_duration: voiceDuration
        };

        const { data: dbData2, error: dbError2 } = await supabase
          .from('messages')
          .insert([standardPayload])
          .select()
          .maybeSingle();

        if (!dbError2 && dbData2) {
          newMessage.id = dbData2.id;
          isSavedToDB = true;
        }
      } catch (e) {
        console.warn('[ChatService] Secondary schema notice:', e);
      }
    }

    // Attempt 3: Core Deenora schema (Guaranteed to match any Supabase messages table)
    if (!isSavedToDB) {
      try {
        const basePayload: any = {
          institution_id: cleanInstitutionId,
          class_name: className || cleanConversationId,
          title: cleanSenderName || 'Chat Message',
          sender_name: cleanSenderName || 'Admin',
          message: dbMessageField
        };

        const { data: dbData3, error: dbError3 } = await supabase
          .from('messages')
          .insert([basePayload])
          .select()
          .maybeSingle();

        if (!dbError3 && dbData3) {
          newMessage.id = dbData3.id;
          isSavedToDB = true;
        } else if (dbError3) {
          console.error('[ChatService] Tertiary schema insert error:', dbError3.message);
        }
      } catch (e) {
        console.error('[ChatService] Tertiary schema exception:', e);
      }
    }

    if (isSavedToDB && finalAttachmentUrl && messageType === 'voice') {
      try {
        localStorage.setItem(`chat_audio_${newMessage.id}`, finalAttachmentUrl);
      } catch {}
    }

    // 3. Deterministic Realtime Broadcast (Broadcasts to active room & global notification subscribers)
    try {
      const roomChannelName = `chat_realtime_${cleanInstitutionId}_${cleanConversationId}`;
      const globalChannelName = `global_notifs_${cleanInstitutionId}`;

      const roomChannel = supabase.channel(roomChannelName);
      roomChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          roomChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: newMessage
          });
          setTimeout(() => {
            supabase.removeChannel(roomChannel);
          }, 2500);
        }
      });

      const globalChannel = supabase.channel(globalChannelName);
      globalChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          globalChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: newMessage
          });
          setTimeout(() => {
            supabase.removeChannel(globalChannel);
          }, 2500);
        }
      });
    } catch (broadcastErr) {
      console.warn('[ChatService] Realtime broadcast exception:', broadcastErr);
    }

    // Tab-to-tab instant BroadcastChannel dispatch
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(`deenora_msg_channel_${cleanInstitutionId}`);
        bc.postMessage({ type: 'NEW_MESSAGE', payload: newMessage });
        setTimeout(() => bc.close(), 1000);
      }
    } catch (e) {}

    // 4. Persist to localStorage for offline cache
    try {
      const localKey = `deenora_chat_msg_${cleanConversationId}`;
      const stored = localStorage.getItem(localKey);
      const existing: ChatMessage[] = stored ? JSON.parse(stored) : [];

      if (!existing.some(m => m.id === newMessage.id || (clientMessageId && m.client_message_id === clientMessageId))) {
        existing.push(newMessage);
        localStorage.setItem(localKey, JSON.stringify(existing));
      }
    } catch (e) {
      console.warn('[ChatService] localStorage caching notice:', e);
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
