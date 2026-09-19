/**
 * Deenora Encrypted Chat Backup Service (V2)
 *
 * Coordinates data extraction from IndexedDB, compression, AES-256-GCM authenticated encryption,
 * backup package creation, export/download, and safe conflict-free restoration.
 */

import { offlineDb, LocalConversation, LocalChatMessage } from './offlineDb';
import { ChatLocalStore } from './chatLocalStore';
import { Conversation, ChatMessage } from '../types';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  EncryptedBackupPackage,
  BackupPayloadData
} from './chatBackupCrypto';

export interface BackupPreferences {
  frequency: 'manual' | 'weekly' | 'monthly';
  last_backup_at?: string;
  last_backup_size?: number;
  last_backup_msg_count?: number;
  last_backup_conv_count?: number;
  last_backup_type?: 'full' | 'incremental';
  auto_backup_enabled?: boolean;
  google_account?: string; // Active connected Gmail account
  linked_google_accounts?: string[]; // List of all added Gmail accounts
  email_backup_recipient?: string; // Primary recipient email
}

export interface BackupProgressCallback {
  (step: 'preparing' | 'compressing' | 'encrypting' | 'saving' | 'completed' | 'error', details?: string): void;
}

export interface RestorePreview {
  created_at: string;
  device_info: string;
  institution_id: string;
  user_id: string;
  account_email?: string;
  conversation_count: number;
  message_count: number;
  backup_type: 'full' | 'incremental';
  package_size_bytes: number;
  version: number;
}

export interface RestoreResult {
  success: boolean;
  restored_conversations_count: number;
  restored_messages_count: number;
  skipped_existing_count: number;
  error?: string;
}

const BACKUP_PREF_KEY = 'deenora_chat_backup_preferences';
const RECENT_BACKUPS_KEY = 'deenora_recent_encrypted_backups';

export class ChatBackupService {
  /**
   * Retrieves backup preferences (frequency, last backup date, stats)
   */
  static getPreferences(institutionId: string): BackupPreferences {
    try {
      const raw = localStorage.getItem(`${BACKUP_PREF_KEY}_${institutionId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      frequency: 'manual',
      auto_backup_enabled: false
    };
  }

  /**
   * Saves backup preferences
   */
  static savePreferences(institutionId: string, prefs: Partial<BackupPreferences>): void {
    try {
      const current = this.getPreferences(institutionId);
      const updated = { ...current, ...prefs };
      localStorage.setItem(`${BACKUP_PREF_KEY}_${institutionId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('[ChatBackupService] Failed to save preferences:', e);
    }
  }

  /**
   * Adds or links a Google / Gmail account for chat backups
   */
  static addGoogleAccount(institutionId: string, email: string): BackupPreferences {
    const normalized = email.trim().toLowerCase();
    const prefs = this.getPreferences(institutionId);
    const existing = new Set(prefs.linked_google_accounts || []);
    existing.add(normalized);
    
    const updated: BackupPreferences = {
      ...prefs,
      google_account: normalized,
      linked_google_accounts: Array.from(existing),
      email_backup_recipient: normalized
    };
    this.savePreferences(institutionId, updated);
    return updated;
  }

  /**
   * Removes a linked Google / Gmail account
   */
  static removeGoogleAccount(institutionId: string, email: string): BackupPreferences {
    const normalized = email.trim().toLowerCase();
    const prefs = this.getPreferences(institutionId);
    const filtered = (prefs.linked_google_accounts || []).filter(e => e !== normalized);
    
    let active = prefs.google_account;
    if (active === normalized) {
      active = filtered.length > 0 ? filtered[0] : undefined;
    }

    const updated: BackupPreferences = {
      ...prefs,
      google_account: active,
      linked_google_accounts: filtered,
      email_backup_recipient: active
    };
    this.savePreferences(institutionId, updated);
    return updated;
  }

  /**
   * Sets the active Google / Gmail account for chat backup
   */
  static setActiveGoogleAccount(institutionId: string, email: string): BackupPreferences {
    const normalized = email.trim().toLowerCase();
    const prefs = this.getPreferences(institutionId);
    const updated: BackupPreferences = {
      ...prefs,
      google_account: normalized,
      email_backup_recipient: normalized
    };
    this.savePreferences(institutionId, updated);
    return updated;
  }

  /**
   * Gathers all user-accessible conversations and messages from local IndexedDB.
   * Strictly respects multi-tenant boundaries (only the current institution).
   */
  static async prepareBackupData(
    institutionId: string,
    userId: string,
    sinceTimestamp?: string,
    accountEmail?: string
  ): Promise<BackupPayloadData> {
    if (!institutionId) {
      throw new Error('মাদরাসা / প্রতিষ্ঠান আইডি পাওয়া যায়নি');
    }

    // 1. Fetch conversations from IndexedDB for this institution
    const localConvs = await offlineDb.local_conversations
      .where('institution_id')
      .equals(institutionId)
      .toArray();

    // 2. Fetch messages from IndexedDB for this institution
    let msgQuery = offlineDb.local_messages.where('institution_id').equals(institutionId);
    let localMsgs = await msgQuery.toArray();

    // If incremental backup requested, filter messages created/updated after sinceTimestamp
    if (sinceTimestamp) {
      localMsgs = localMsgs.filter(m => (m.created_at >= sinceTimestamp || (m.updated_at && m.updated_at >= sinceTimestamp)));
    }

    // Filter out deleted messages for privacy
    const sanitizedMsgs = localMsgs
      .filter(m => !m.is_deleted && !m.deleted_for_me)
      .map(m => ({
        id: m.id,
        conversation_id: m.conversation_id,
        institution_id: m.institution_id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        class_name: m.class_name,
        client_message_id: m.client_message_id,
        message: m.message,
        message_type: m.message_type,
        attachment_url: m.attachment_url,
        attachment_name: m.attachment_name,
        attachment_size: m.attachment_size,
        voice_duration: m.voice_duration,
        reply_to_message_id: m.reply_to_message_id,
        reply_to_message: m.reply_to_message,
        is_edited: m.is_edited,
        edited_at: m.edited_at,
        is_starred: m.is_starred,
        is_parent: m.is_parent,
        sender_role: m.sender_role,
        delivered_at: m.delivered_at,
        read_at: m.read_at,
        created_at: m.created_at,
        updated_at: m.updated_at,
        status: m.status,
        synced: m.synced
      }));

    const sanitizedConvs = localConvs.map(c => ({
      id: c.id,
      institution_id: c.institution_id,
      type: c.type,
      name: c.name,
      class_id: c.class_id,
      is_announcement_only: c.is_announcement_only,
      created_at: c.created_at,
      updated_at: c.updated_at,
      pinned: c.pinned,
      muted: c.muted
    }));

    return {
      format: 'DEENORA_CHAT_BACKUP_PAYLOAD',
      version: 2,
      created_at: new Date().toISOString(),
      institution_id: institutionId,
      user_id: userId,
      account_email: accountEmail,
      conversations: sanitizedConvs,
      messages: sanitizedMsgs,
      user_safe_metadata: {
        app_version: '2.0.0',
        classes_included: Array.from(new Set(sanitizedConvs.map(c => c.name).filter(Boolean)))
      }
    };
  }

  /**
   * Executes the full encrypted backup pipeline:
   * IndexedDB -> Preparation -> Compression -> AES-256-GCM Encryption -> Encrypted Package
   */
  static async createEncryptedBackup(
    institutionId: string,
    userId: string,
    passphrase: string,
    backupType: 'full' | 'incremental' = 'full',
    onProgress?: BackupProgressCallback,
    accountEmail?: string
  ): Promise<{ pkg: EncryptedBackupPackage; jsonString: string; filename: string }> {
    try {
      onProgress?.('preparing', 'ডাটা প্রস্তুত করা হচ্ছে...');
      const prefs = this.getPreferences(institutionId);
      const sinceTimestamp = backupType === 'incremental' ? prefs.last_backup_at : undefined;
      const associatedEmail = accountEmail || prefs.google_account;

      const payload = await this.prepareBackupData(institutionId, userId, sinceTimestamp, associatedEmail);

      if (payload.conversations.length === 0 && payload.messages.length === 0) {
        throw new Error('ব্যাকআপ করার মতো কোনো মেসেজ বা চ্যাট ডাটা পাওয়া যায়নি।');
      }

      onProgress?.('compressing', 'ডাটা সংকুচিত করা হচ্ছে...');
      await new Promise(r => setTimeout(r, 100));

      onProgress?.('encrypting', 'AES-256-GCM দিয়ে এনক্রিপ্ট করা হচ্ছে...');
      const pkg = await encryptBackupPayload(payload, passphrase, {
        backup_type: backupType,
        base_backup_timestamp: sinceTimestamp
      });

      onProgress?.('saving', 'এনক্রিপ্টেড ব্যাকআপ প্যাকেজ তৈরি হচ্ছে...');
      const jsonString = JSON.stringify(pkg, null, 2);

      const datePart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `deenora_chat_backup_${backupType}_${datePart}.deenorabackup`;

      // Update preferences with last backup timestamp & stats
      this.savePreferences(institutionId, {
        last_backup_at: pkg.created_at,
        last_backup_size: jsonString.length,
        last_backup_conv_count: pkg.stats.conversation_count,
        last_backup_msg_count: pkg.stats.message_count,
        last_backup_type: backupType,
        google_account: associatedEmail
      });

      // Save a lightweight copy into recent backups store (encrypted only!)
      this.saveToRecentEncryptedBackups(institutionId, pkg, jsonString);

      onProgress?.('completed', 'এনক্রিপ্টেড ব্যাকআপ সফলভাবে প্রস্তুত হয়েছে।');
      return { pkg, jsonString, filename };
    } catch (err: any) {
      onProgress?.('error', err.message || 'ব্যাকআপ প্রক্রিয়া ব্যর্থ হয়েছে');
      throw err;
    }
  }

  /**
   * Triggers a browser download of the encrypted backup file
   */
  static downloadBackupFile(jsonString: string, filename: string): void {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Previews encrypted backup metadata before decryption
   */
  static parseBackupHeader(jsonContent: string): RestorePreview {
    try {
      const parsed = JSON.parse(jsonContent);
      if (parsed.format !== 'DEENORA_CHAT_BACKUP') {
        throw new Error('অবৈধ ফাইল ফরম্যাট। এটি Deenora এনক্রিপ্টেড ব্যাকআপ ফাইল নয়।');
      }

      return {
        created_at: parsed.created_at,
        device_info: parsed.device_info || 'Unknown Device',
        institution_id: parsed.institution_id,
        user_id: parsed.user_id,
        account_email: parsed.account_email,
        conversation_count: parsed.stats?.conversation_count || 0,
        message_count: parsed.stats?.message_count || 0,
        backup_type: parsed.backup_type || 'full',
        package_size_bytes: jsonContent.length,
        version: parsed.version || 2
      };
    } catch (err: any) {
      throw new Error(err.message || 'ব্যাকআপ ফাইলটি পড়তে ব্যর্থ হয়েছে।');
    }
  }

  /**
   * Decrypts and safely merges backup data into local IndexedDB.
   * Prevents duplicates by keying on `client_message_id` & `id`.
   * Preserves newer local messages and pending unsynced messages.
   */
  static async restoreFromEncryptedBackup(
    jsonContent: string,
    passphrase: string,
    currentInstitutionId: string,
    onProgress?: (msg: string) => void
  ): Promise<RestoreResult> {
    try {
      onProgress?.('ব্যাকআপ ফাইল বিশ্লেষণ করা হচ্ছে...');
      const pkg: EncryptedBackupPackage = JSON.parse(jsonContent);

      if (pkg.format !== 'DEENORA_CHAT_BACKUP') {
        throw new Error('অবৈধ ফাইল ফরম্যাট। এটি Deenora ব্যাকআপ ফাইল নয়।');
      }

      // Security Check: Institution ID boundary verification
      if (currentInstitutionId && pkg.institution_id && pkg.institution_id !== currentInstitutionId) {
        throw new Error('এই ব্যাকআপটি অন্য মাদরাসার। অন্য মাদরাসার ব্যাকআপ বর্তমান মাদরাসায় রিস্টোর করা যাবে না।');
      }

      onProgress?.('AES-256 দিয়ে ডিক্রিপ্ট এবং যাচাই করা হচ্ছে...');
      const payload = await decryptBackupPayload(pkg, passphrase);

      onProgress?.('মেসেজগুলো নিরাপদে মার্জ করা হচ্ছে...');

      let restoredConvs = 0;
      let restoredMsgs = 0;
      let skippedExisting = 0;

      // 1. Restore Conversations
      if (Array.isArray(payload.conversations) && payload.conversations.length > 0) {
        for (const conv of payload.conversations) {
          const existing = await offlineDb.local_conversations.get(conv.id);
          if (!existing) {
            await offlineDb.local_conversations.put({
              id: conv.id,
              institution_id: conv.institution_id || currentInstitutionId,
              type: conv.type,
              name: conv.name,
              class_id: conv.class_id,
              is_announcement_only: conv.is_announcement_only,
              created_at: conv.created_at || new Date().toISOString(),
              updated_at: conv.updated_at || new Date().toISOString(),
              pinned: conv.pinned,
              muted: conv.muted
            });
            restoredConvs++;
          } else {
            // Update metadata if backup has newer timestamp
            if (conv.updated_at && (!existing.updated_at || conv.updated_at > existing.updated_at)) {
              await offlineDb.local_conversations.update(conv.id, {
                name: conv.name,
                pinned: conv.pinned,
                muted: conv.muted,
                updated_at: conv.updated_at
              });
            }
          }
        }
      }

      // 2. Restore Messages with Duplicate Prevention
      if (Array.isArray(payload.messages) && payload.messages.length > 0) {
        for (const msg of payload.messages) {
          const clientMsgId = msg.client_message_id || msg.id;
          const targetId = msg.id || clientMsgId;

          // Check if message already exists by ID or by client_message_id
          const existingById = await offlineDb.local_messages.get(targetId);
          let existingByClientId: LocalChatMessage | undefined;
          if (!existingById && clientMsgId) {
            existingByClientId = await offlineDb.local_messages
              .where('client_message_id')
              .equals(clientMsgId)
              .first();
          }

          if (existingById || existingByClientId) {
            skippedExisting++;
            continue;
          }

          // Insert into local IndexedDB
          await ChatLocalStore.saveMessage({
            id: targetId,
            client_message_id: clientMsgId,
            conversation_id: msg.conversation_id,
            institution_id: msg.institution_id || currentInstitutionId,
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            class_name: msg.class_name,
            message: msg.message,
            message_type: msg.message_type || 'text',
            attachment_url: msg.attachment_url,
            attachment_name: msg.attachment_name,
            attachment_size: msg.attachment_size,
            voice_duration: msg.voice_duration,
            reply_to_message_id: msg.reply_to_message_id,
            reply_to_message: msg.reply_to_message,
            is_edited: msg.is_edited || false,
            edited_at: msg.edited_at,
            is_deleted: false,
            deleted_for_me: false,
            is_starred: msg.is_starred || false,
            is_parent: msg.is_parent,
            sender_role: msg.sender_role,
            delivered_at: msg.delivered_at,
            read_at: msg.read_at,
            created_at: msg.created_at || new Date().toISOString(),
            updated_at: msg.updated_at || new Date().toISOString(),
            status: msg.status || 'sent',
            synced: 1
          });

          restoredMsgs++;
        }
      }

      onProgress?.('রিস্টোর সফলভাবে সম্পন্ন হয়েছে!');

      return {
        success: true,
        restored_conversations_count: restoredConvs,
        restored_messages_count: restoredMsgs,
        skipped_existing_count: skippedExisting
      };
    } catch (err: any) {
      console.error('[ChatBackupService] Restore error:', err);
      return {
        success: false,
        restored_conversations_count: 0,
        restored_messages_count: 0,
        skipped_existing_count: 0,
        error: err.message || 'রিস্টোর করতে সমস্যা হয়েছে'
      };
    }
  }

  /**
   * Saves a lightweight copy of the encrypted package to localStorage for quick restore
   */
  private static saveToRecentEncryptedBackups(
    institutionId: string,
    pkg: EncryptedBackupPackage,
    jsonString: string
  ): void {
    try {
      const key = `${RECENT_BACKUPS_KEY}_${institutionId}`;
      const item = {
        created_at: pkg.created_at,
        backup_type: pkg.backup_type,
        conversation_count: pkg.stats.conversation_count,
        message_count: pkg.stats.message_count,
        size_bytes: jsonString.length,
        device_info: pkg.device_info,
        encrypted_package: jsonString
      };

      // Keep only the most recent 3 backups to conserve localStorage limits
      let recent: any[] = [];
      const stored = localStorage.getItem(key);
      if (stored) {
        recent = JSON.parse(stored);
      }
      recent.unshift(item);
      recent = recent.slice(0, 3);
      localStorage.setItem(key, JSON.stringify(recent));
    } catch (e) {
      console.warn('[ChatBackupService] Could not store recent backup snapshot in localStorage:', e);
    }
  }

  /**
   * Returns recent encrypted backup snapshots stored locally
   */
  static getRecentEncryptedBackups(institutionId: string): any[] {
    try {
      const key = `${RECENT_BACKUPS_KEY}_${institutionId}`;
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }
}
