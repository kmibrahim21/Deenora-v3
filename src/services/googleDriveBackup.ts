import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing app or initialize if not present
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

const ACCESS_TOKEN_KEY = 'deenora_gdrive_access_token';
const TOKEN_EXPIRY_KEY = 'deenora_gdrive_token_expiry';

// Cache the access token in memory/localStorage
let cachedAccessToken: string | null = null;
try {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (token && expiry && Date.now() < parseInt(expiry, 10)) {
    cachedAccessToken = token;
  }
} catch (e) {
  console.error('Error loading cached GDrive token:', e);
}

let isSigningIn = false;

// Encryption Configuration
const ENCRYPTION_KEY = 'deenora_secure_backup_key_2026_and_beyond_system';

/**
 * Encrypt backup data using XOR and Base64 encoding.
 * Fast, highly compatible, and converts readable JSON to .deenora encrypted file content.
 */
export function encryptData(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  // Convert binary string to UTF-8-safe Base64
  return btoa(encodeURIComponent(result));
}

/**
 * Decrypt .deenora encrypted content back to JSON.
 */
export function decryptData(base64: string): string {
  const binaryStr = decodeURIComponent(atob(base64));
  let result = '';
  for (let i = 0; i < binaryStr.length; i++) {
    result += String.fromCharCode(binaryStr.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return result;
}

/**
 * Initialize OAuth Auth state listener.
 */
export const initAuth = (
  onAuthChange?: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      let token = cachedAccessToken;
      if (!token) {
        try {
          const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
          if (storedToken && expiry && Date.now() < parseInt(expiry, 10)) {
            token = storedToken;
            cachedAccessToken = storedToken;
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (onAuthChange) onAuthChange(user, token);
    } else {
      cachedAccessToken = null;
      if (onAuthChange) onAuthChange(null, null);
    }
  });
};

/**
 * Authenticate with Google Drive scopes.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Sign-In');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, credential.accessToken);
      // Access tokens usually expire in 3600 seconds (1 hour).
      // Let's set the expiry to 55 minutes from now to be safe.
      const expiryTime = Date.now() + 55 * 60 * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    } catch (e) {
      console.error('Error saving access token to localStorage:', e);
    }
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached Google Access Token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Disconnect/Logout from Google
 */
export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (e) {
    console.error('Error removing token from localStorage:', e);
  }
};

/**
 * Checks if the "Deenora Backups" folder exists in Google Drive.
 * If not, creates it and returns its folder ID.
 */
export async function findOrCreateDeenoraFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent("name='Deenora Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to search Deenora backup folder in Drive: ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Folder does not exist, let's create it
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Deenora Backups',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create Deenora backups folder: ${errText}`);
  }

  const folderData = await createResponse.json();
  return folderData.id;
}

/**
 * Lists all .deenora files inside the specified Google Drive folder.
 */
export async function listBackups(accessToken: string, folderId: string) {
  const query = encodeURIComponent(`'${folderId}' in parents and name contains '.deenora' and trashed=false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=name%20desc&fields=files(id,name,createdTime,size)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to list backup files: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Performs a multipart upload to upload a backup file (.deenora) to Google Drive.
 */
export async function uploadBackupToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  encryptedContent: string
) {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'text/plain'
  };

  const boundary = 'deenora_multipart_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    encryptedContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to upload to Google Drive: ${errText}`);
  }

  return await response.json();
}

/**
 * Downloads a backup file content from Google Drive
 */
export async function downloadBackupFromDrive(accessToken: string, fileId: string): Promise<string> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to download backup data: ${errText}`);
  }

  return await response.text();
}

/**
 * Deletes a backup file from Google Drive
 */
export async function deleteBackupFromDrive(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete backup file: ${errText}`);
  }
}
