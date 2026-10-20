import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing app or initialize if not present
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account'
});

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
 * Friendly error message parser for Google/Firebase authentication
 */
export function getFriendlyAuthErrorMessage(err: any, lang: 'bn' | 'en' = 'bn'): { message: string; isPopupBlockedOrClosed: boolean } {
  const code = err?.code || '';
  const isPopupBlockedOrClosed = 
    code === 'auth/popup-closed-by-user' || 
    code === 'auth/popup-blocked' || 
    code === 'auth/cancelled-popup-request';
  
  if (code === 'auth/popup-closed-by-user') {
    return {
      message: lang === 'bn'
        ? 'গুগল সাইন-ইন পপআপ উইন্ডোটি বন্ধ করা হয়েছে বা ব্রাউজার কর্তৃক আটকে দেওয়া হয়েছে। আপনি সরাসরি "রিডাইরেক্ট করে সাইন ইন করুন" বোতাম ব্যবহার করতে পারেন।'
        : 'Google Sign-In popup was closed or blocked. You can use "Sign in with Redirect" instead.',
      isPopupBlockedOrClosed: true
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      message: lang === 'bn'
        ? 'আপনার ব্রাউজার গুগল সাইন-ইন পপআপ ব্লক করেছে। অনুগ্রহ করে ব্রাউজার অ্যাড্রেস বার থেকে পপআপ এলাউ (Allow) করুন অথবা "রিডাইরেক্ট করে সাইন ইন করুন" বোতাম ব্যবহার করুন।'
        : 'Your browser blocked the Google Sign-In popup. Please allow popups or use "Sign in with Redirect".',
      isPopupBlockedOrClosed: true
    };
  }
  if (code === 'auth/cancelled-popup-request') {
    return {
      message: lang === 'bn'
        ? 'পূর্বের সাইন-ইন অনুরোধটি বাতিল হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
        : 'Previous sign-in request was cancelled. Please try again.',
      isPopupBlockedOrClosed: true
    };
  }
  if (code === 'auth/unauthorized-domain') {
    return {
      message: lang === 'bn'
        ? 'এই ওয়েবসাইট ডোমেইনটি Firebase Auth Authorized Domains তালিকায় অনুমোদিত নয়।'
        : 'This domain is not authorized in Firebase Auth.',
      isPopupBlockedOrClosed: false
    };
  }
  return {
    message: err?.message || (lang === 'bn' ? 'গুগল অ্যাকাউন্ট কানেক্ট করতে ব্যর্থ হয়েছে।' : 'Failed to connect Google account.'),
    isPopupBlockedOrClosed
  };
}

/**
 * Initialize OAuth Auth state listener and resolve any pending redirect sign-in.
 */
export const initAuth = (
  onAuthChange?: (user: User | null, token: string | null) => void
) => {
  // Check for redirect result on page load / return from Google redirect
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          try {
            localStorage.setItem(ACCESS_TOKEN_KEY, credential.accessToken);
            const expiryTime = Date.now() + 55 * 60 * 1000;
            localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
          } catch (e) {
            console.error('Error saving access token to localStorage:', e);
          }
          if (onAuthChange) onAuthChange(result.user, credential.accessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Google getRedirectResult error:', err);
    });

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
 * Authenticate with Google Drive scopes via Popup.
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
 * Authenticate with Google Drive scopes via Full Page Redirect.
 * Recommended for mobile browsers, PWAs, or when popups are blocked/closed.
 */
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Google sign-in redirect error:', error);
    throw error;
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
