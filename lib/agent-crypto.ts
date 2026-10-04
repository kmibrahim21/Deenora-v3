import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a 32-byte key for AES-256 encryption.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 
                 process.env.DEENORA_AGENT_SECRET || 
                 process.env.SUPABASE_SERVICE_ROLE_KEY || 
                 'deenora-admin-agent-default-secret-salt-32';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plain API key string into an AES-256-GCM string (iv:authTag:ciphertext).
 */
export function encryptApiKey(plainKey: string): string {
  if (!plainKey || typeof plainKey !== 'string') return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string back to plaintext.
 */
export function decryptApiKey(encryptedData: string): string | null {
  if (!encryptedData || typeof encryptedData !== 'string') return null;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt custom API key:', err);
    return null;
  }
}

/**
 * Masks an API key for safe frontend display: e.g. AIza...abcd or ****abcd
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') return '';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return '****' + trimmed.slice(-4);
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}
