/**
 * Deenora Chat Backup Cryptography Engine (V2)
 *
 * Implements authenticated client-side encryption using the standard Web Crypto API.
 * - Authenticated Encryption: AES-256-GCM (128-bit MAC authentication tag)
 * - Key Derivation: PBKDF2 with SHA-256, 100,000 iterations, 16-byte cryptographically secure salt
 * - Compression: Deflate/Gzip compression applied BEFORE encryption to minimize payload size and hide structural patterns
 * - Security Assurance: Zero plaintext data or raw encryption keys are stored in IndexedDB, localStorage, or exported files
 */

export interface BackupCryptoMetadata {
  algorithm: 'AES-GCM';
  key_length: 256;
  kdf: 'PBKDF2';
  kdf_hash: 'SHA-256';
  kdf_iterations: number;
  salt_base64: string;
  iv_base64: string;
  tag_length: number;
}

export interface EncryptedBackupPackage {
  format: 'DEENORA_CHAT_BACKUP';
  version: 2;
  created_at: string;
  institution_id: string;
  user_id: string;
  user_role?: string;
  account_email?: string;
  device_info: string;
  backup_type: 'full' | 'incremental';
  base_backup_timestamp?: string;
  stats: {
    conversation_count: number;
    message_count: number;
    compressed_bytes?: number;
    uncompressed_bytes?: number;
  };
  crypto: BackupCryptoMetadata;
  encrypted_payload_base64: string;
}

export interface BackupPayloadData {
  format: 'DEENORA_CHAT_BACKUP_PAYLOAD';
  version: 2;
  created_at: string;
  institution_id: string;
  user_id: string;
  account_email?: string;
  conversations: any[];
  messages: any[];
  user_safe_metadata?: {
    app_version?: string;
    classes_included?: string[];
  };
}

// Utility: Uint8Array to Base64 and vice versa
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compresses an ArrayBuffer/Uint8Array using browser CompressionStream
 */
export async function compressData(dataBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(dataBytes);
          controller.close();
        }
      });
      const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
      const response = new Response(compressedStream);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (e) {
      console.warn('[ChatBackupCrypto] CompressionStream fallback to raw bytes:', e);
      return dataBytes;
    }
  }
  return dataBytes;
}

/**
 * Decompresses an ArrayBuffer/Uint8Array using browser DecompressionStream
 */
export async function decompressData(compressedBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(compressedBytes);
          controller.close();
        }
      });
      const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
      const response = new Response(decompressedStream);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (e) {
      console.warn('[ChatBackupCrypto] DecompressionStream error, returning raw bytes:', e);
      return compressedBytes;
    }
  }
  return compressedBytes;
}

/**
 * Derives a 256-bit AES-GCM key from a user passphrase using PBKDF2-SHA256
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import raw passphrase material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: iterations,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false, // Key is non-extractable from memory
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypts a BackupPayloadData object with AES-256-GCM and returns an EncryptedBackupPackage
 */
export async function encryptBackupPayload(
  payload: BackupPayloadData,
  passphrase: string,
  options: {
    backup_type?: 'full' | 'incremental';
    base_backup_timestamp?: string;
  } = {}
): Promise<EncryptedBackupPackage> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('একটি নিরাপদ পাসওয়ার্ড বা পিন প্রয়োজন (ন্যূনতম ৪ অক্ষর)');
  }

  // 1. Serialize JSON payload to UTF-8 bytes
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(jsonStr);

  // 2. Compress data before encryption
  const compressedBytes = await compressData(rawBytes);

  // 3. Generate cryptographically secure random salt (16 bytes) and IV (12 bytes)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const iterations = 100000;

  // 4. Derive AES-GCM CryptoKey from passphrase
  const key = await deriveKeyFromPassphrase(passphrase, salt, iterations);

  // 5. Encrypt with AES-GCM (128-bit tag appended automatically by Web Crypto)
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      tagLength: 128
    },
    key,
    compressedBytes as any
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  // 6. Gather device info safely without revealing sensitive PII
  const deviceInfo = navigator.userAgent.includes('Mobile')
    ? `Mobile Browser (${navigator.platform || 'Device'})`
    : `Desktop Browser (${navigator.platform || 'Device'})`;

  const encryptedPackage: EncryptedBackupPackage = {
    format: 'DEENORA_CHAT_BACKUP',
    version: 2,
    created_at: new Date().toISOString(),
    institution_id: payload.institution_id,
    user_id: payload.user_id,
    user_role: payload.messages[0]?.sender_role || 'user',
    account_email: payload.account_email,
    device_info: deviceInfo,
    backup_type: options.backup_type || 'full',
    base_backup_timestamp: options.base_backup_timestamp,
    stats: {
      conversation_count: payload.conversations.length,
      message_count: payload.messages.length,
      compressed_bytes: compressedBytes.byteLength,
      uncompressed_bytes: rawBytes.byteLength
    },
    crypto: {
      algorithm: 'AES-GCM',
      key_length: 256,
      kdf: 'PBKDF2',
      kdf_hash: 'SHA-256',
      kdf_iterations: iterations,
      salt_base64: uint8ArrayToBase64(salt),
      iv_base64: uint8ArrayToBase64(iv),
      tag_length: 128
    },
    encrypted_payload_base64: uint8ArrayToBase64(ciphertextBytes)
  };

  return encryptedPackage;
}

/**
 * Decrypts an EncryptedBackupPackage using the user's passphrase.
 * Authenticated encryption ensures any tampering, corrupted bits, or wrong keys are caught immediately.
 */
export async function decryptBackupPayload(
  pkg: EncryptedBackupPackage,
  passphrase: string
): Promise<BackupPayloadData> {
  if (!pkg || pkg.format !== 'DEENORA_CHAT_BACKUP') {
    throw new Error('অবৈধ ব্যাকআপ ফাইল ফরম্যাট। অনুগ্রহ করে একটি সঠিক Deenora ব্যাকআপ ফাইল নির্বাচন করুন।');
  }

  if (pkg.version > 2) {
    throw new Error(`ব্যাকআপ ফাইলটি অ্যাপের বর্তমান ভার্সন থেকে নতুন (ভার্সন ${pkg.version})। অ্যাপটি আপডেট করুন।`);
  }

  if (!passphrase) {
    throw new Error('ব্যাকআপ ডিক্রিপ্ট করতে পাসওয়ার্ড বা পিন প্রদান করুন।');
  }

  try {
    const salt = base64ToUint8Array(pkg.crypto.salt_base64);
    const iv = base64ToUint8Array(pkg.crypto.iv_base64);
    const ciphertext = base64ToUint8Array(pkg.encrypted_payload_base64);

    // 1. Derive CryptoKey using saved salt & iterations
    const key = await deriveKeyFromPassphrase(
      passphrase,
      salt,
      pkg.crypto.kdf_iterations || 100000
    );

    // 2. Decrypt with AES-GCM (Verifies 128-bit MAC tag)
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        tagLength: pkg.crypto.tag_length || 128
      },
      key,
      ciphertext as any
    );

    // 3. Decompress the decrypted bytes
    const decompressedBytes = await decompressData(new Uint8Array(decryptedBuffer));

    // 4. Parse UTF-8 JSON
    const decoder = new TextDecoder('utf-8');
    const jsonStr = decoder.decode(decompressedBytes);
    const payload: BackupPayloadData = JSON.parse(jsonStr);

    return payload;
  } catch (err: any) {
    console.error('[ChatBackupCrypto] Decryption failure:', err);
    // If Web Crypto fails with OperationError, the MAC tag mismatch indicates wrong passphrase or corrupted file
    if (err.name === 'OperationError' || err.message?.includes('OperationError')) {
      throw new Error('ভুল পাসওয়ার্ড অথবা ব্যাকআপ ফাইলটি পরিবর্তিত/ত্রুটিযুক্ত (Invalid Passphrase or Corrupted File)');
    }
    throw new Error(`ডিক্রিপশন ব্যর্থ হয়েছে: ${err.message || 'অজানা ত্রুটি'}`);
  }
}
