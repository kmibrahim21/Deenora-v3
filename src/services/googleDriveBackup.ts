import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleDriveUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  uid?: string;
}

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
const GOOGLE_USER_KEY = 'deenora_gdrive_user';
const CUSTOM_CLIENT_ID_KEY = 'deenora_custom_google_client_id';

// Cache the access token and user in memory
let cachedAccessToken: string | null = null;
let cachedGoogleUser: GoogleDriveUser | null = null;

try {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const userJson = localStorage.getItem(GOOGLE_USER_KEY);
  if (token && expiry && Date.now() < parseInt(expiry, 10)) {
    cachedAccessToken = token;
    if (userJson) {
      cachedGoogleUser = JSON.parse(userJson);
    }
  }
} catch (e) {
  console.error('Error loading cached GDrive token:', e);
}

let isSigningIn = false;

// Encryption Configuration
const ENCRYPTION_KEY = 'deenora_secure_backup_key_2026_and_beyond_system';

/**
 * Get the active Google OAuth Client ID.
 * Priority:
 * 1. User/Institution custom Client ID from localStorage (for custom domains like deenora.app)
 * 2. Vite environment variable VITE_GOOGLE_CLIENT_ID
 * 3. Default built-in Client ID from firebase-applet-config.json
 */
export function getGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch (e) {}

  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) {
    return (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
  }

  return (firebaseConfig as any).oAuthClientId || '212679814097-9rm5bijd4crrtcmgg2atn1ppcnd8lau8.apps.googleusercontent.com';
}

export function setCustomGoogleClientId(clientId: string | null) {
  if (clientId && clientId.trim()) {
    localStorage.setItem(CUSTOM_CLIENT_ID_KEY, clientId.trim());
  } else {
    localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
  }
}

/**
 * Ensures the Google Identity Services client script is loaded
 */
function loadGsiScript(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services library.')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services library.'));
    document.head.appendChild(script);
  });
}

/**
 * Helper to fetch Google User profile info using the access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleDriveUser> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        displayName: data.name || data.email || 'Google User',
        email: data.email,
        photoURL: data.picture,
        uid: data.sub
      };
    }
  } catch (e) {
    console.warn('Could not fetch userinfo, using fallback user profile:', e);
  }
  return {
    displayName: 'Google Drive User',
    email: '',
    uid: 'google-drive-user'
  };
}

function saveTokenAndUser(token: string, user: GoogleDriveUser, expiresInSeconds?: number | string) {
  cachedAccessToken = token;
  cachedGoogleUser = user;
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    const secs = Number(expiresInSeconds) || 3500;
    const expiryTime = Date.now() + Math.max(secs - 300, 600) * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Error saving access token to localStorage:', e);
  }
}

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
 * Friendly error message parser for Google/Firebase authentication with explicit domain advice
 */
export function getFriendlyAuthErrorMessage(err: any, lang: 'bn' | 'en' = 'bn'): { message: string; isPopupBlockedOrClosed: boolean; isDomainError: boolean } {
  const code = err?.code || '';
  const rawMsg = (err?.message || '').toLowerCase();
  
  const isDomainError = 
    code === 'auth/unauthorized-domain' || 
    rawMsg.includes('unauthorized domain') || 
    rawMsg.includes('origin_mismatch') || 
    rawMsg.includes('redirect_uri_mismatch') ||
    rawMsg.includes('not authorized for oauth');

  const isPopupBlockedOrClosed = 
    code === 'auth/popup-closed-by-user' || 
    code === 'auth/popup-blocked' || 
    code === 'auth/cancelled-popup-request' ||
    rawMsg.includes('popup');
  
  if (isDomainError) {
    const domain = typeof window !== 'undefined' ? window.location.hostname : 'deenora.app';
    return {
      message: lang === 'bn'
        ? `ডোমেন অনুমোদন প্রয়োজন: "${domain}" ডোমেনটি Firebase Console (Authentication > Settings > Authorized Domains) তালিকায় যুক্ত থাকতে হবে। নিচের "deenora.app / Vercel ডোমেন ও ক্লাউড কনফিগারেশন" নির্দেশিকা দেখুন।`
        : `Domain authorization required: "${domain}" is not in Firebase Authorized Domains. Check the setup guide below.`,
      isPopupBlockedOrClosed: false,
      isDomainError: true
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      message: lang === 'bn'
        ? 'গুগল সাইন-ইন পপআপ উইন্ডোটি বন্ধ করা হয়েছে বা ব্রাউজার কর্তৃক আটকে দেওয়া হয়েছে। আপনি সরাসরি "রিডাইরেক্ট করে সাইন ইন করুন" বোতাম ব্যবহার করতে পারেন।'
        : 'Google Sign-In popup was closed or blocked. You can use "Sign in with Redirect" instead.',
      isPopupBlockedOrClosed: true,
      isDomainError: false
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      message: lang === 'bn'
        ? 'আপনার ব্রাউজার গুগল সাইন-ইন পপআপ ব্লক করেছে। অনুগ্রহ করে ব্রাউজার অ্যাড্রেস বার থেকে পপআপ এলাউ (Allow) করুন অথবা "রিডাইরেক্ট করে সাইন ইন করুন" বোতাম ব্যবহার করুন।'
        : 'Your browser blocked the Google Sign-In popup. Please allow popups or use "Sign in with Redirect".',
      isPopupBlockedOrClosed: true,
      isDomainError: false
    };
  }
  if (code === 'auth/cancelled-popup-request') {
    return {
      message: lang === 'bn'
        ? 'পূর্বের সাইন-ইন অনুরোধটি বাতিল হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
        : 'Previous sign-in request was cancelled. Please try again.',
      isPopupBlockedOrClosed: true,
      isDomainError: false
    };
  }

  return {
    message: err?.message || (lang === 'bn' ? 'গুগল অ্যাকাউন্ট কানেক্ট করতে ব্যর্থ হয়েছে।' : 'Failed to connect Google account.'),
    isPopupBlockedOrClosed,
    isDomainError
  };
}

/**
 * Initialize OAuth Auth state listener and resolve any pending redirect sign-in.
 * Handles both Direct Google OAuth URL redirect and Firebase redirect.
 */
export const initAuth = (
  onAuthChange?: (user: GoogleDriveUser | null, token: string | null) => void
) => {
  // 1. Check for Direct Google OAuth 2.0 Redirect Hash in URL bar:
  // e.g. https://deenora.app/settings#access_token=ya29...&token_type=Bearer&expires_in=3599
  if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
    try {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      const expiresIn = params.get('expires_in') || '3599';
      
      if (token) {
        // Clean URL cleanly without triggering page reload
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        
        // Fetch user profile from Google
        fetchGoogleUserInfo(token).then((user) => {
          saveTokenAndUser(token, user, expiresIn);
          if (onAuthChange) onAuthChange(user, token);
        }).catch(() => {
          const fallbackUser: GoogleDriveUser = { displayName: 'Google Drive User', email: '' };
          saveTokenAndUser(token, fallbackUser, expiresIn);
          if (onAuthChange) onAuthChange(fallbackUser, token);
        });
        return () => {};
      }
    } catch (e) {
      console.error('Error parsing OAuth redirect hash:', e);
    }
  }

  // 2. Check for Firebase getRedirectResult fallback
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          const user: GoogleDriveUser = {
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            uid: result.user.uid
          };
          saveTokenAndUser(credential.accessToken, user);
          if (onAuthChange) onAuthChange(user, credential.accessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Google getRedirectResult error:', err);
    });

  // 3. Check for existing cached token in localStorage
  if (cachedAccessToken && cachedGoogleUser) {
    if (onAuthChange) onAuthChange(cachedGoogleUser, cachedAccessToken);
  }

  // 4. Firebase onAuthStateChanged listener
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
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
      const u: GoogleDriveUser = {
        displayName: fbUser.displayName,
        email: fbUser.email,
        photoURL: fbUser.photoURL,
        uid: fbUser.uid
      };
      cachedGoogleUser = u;
      if (onAuthChange) onAuthChange(u, token);
    } else if (!cachedAccessToken) {
      cachedGoogleUser = null;
      if (onAuthChange) onAuthChange(null, null);
    }
  });
};

/**
 * Authenticate with Google Drive scopes via Google Identity Services (GIS) Token Client.
 * Directly bypasses Firebase cross-domain iframe storage restrictions on custom domains like deenora.app.
 */
export const signInWithGis = async (): Promise<{ user: GoogleDriveUser; accessToken: string }> => {
  await loadGsiScript();
  const clientId = getGoogleClientId();

  return new Promise((resolve, reject) => {
    try {
      if (!(window as any).google?.accounts?.oauth2) {
        throw new Error('Google Identity Services library not available');
      }

      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (resp: any) => {
          if (resp.error) {
            console.error('GIS token error:', resp);
            reject(new Error(resp.error_description || resp.error || 'Google sign-in was closed or rejected'));
            return;
          }
          if (resp.access_token) {
            const user = await fetchGoogleUserInfo(resp.access_token);
            saveTokenAndUser(resp.access_token, user, resp.expires_in);
            resolve({ user, accessToken: resp.access_token });
          } else {
            reject(new Error('No access token received from Google'));
          }
        },
        error_callback: (err: any) => {
          console.error('GIS error callback:', err);
          reject(err);
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Unified Google Sign-In with Popup.
 * Tries Google Identity Services (GIS) first for maximum domain compatibility.
 * Falls back to Firebase Auth popup if GIS is not supported.
 */
export const googleSignIn = async (): Promise<{ user: GoogleDriveUser; accessToken: string } | null> => {
  isSigningIn = true;
  
  // Strategy 1: Firebase Auth Popup directly (synchronous user gesture, never blocked by browser popup blocker)
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Sign-In');
    }

    const user: GoogleDriveUser = {
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      uid: result.user.uid
    };
    saveTokenAndUser(credential.accessToken, user);
    
    return { user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.warn('Firebase popup sign-in encountered an issue:', error);
    
    // If it's a domain error or popup blocked, attempt GIS Token Client as secondary alternative
    const code = error?.code || '';
    if (code === 'auth/unauthorized-domain' || code === 'auth/popup-blocked') {
      try {
        console.info('Attempting Google Identity Services (GIS) fallback...');
        const res = await signInWithGis();
        return res;
      } catch (gisError) {
        console.warn('GIS Token Client fallback failed:', gisError);
      }
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Direct Google OAuth 2.0 Web Redirect Flow.
 * Cleans the redirect URI and triggers direct Google OAuth URL.
 */
export const googleSignInDirectRedirect = (): void => {
  const clientId = getGoogleClientId();
  // Clear any hash and trailing slash to produce a clean redirect URI
  const cleanPath = typeof window !== 'undefined' 
    ? (window.location.pathname.replace(/\/$/, '') || '/')
    : '/';
  const redirectUri = window.location.origin + cleanPath;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('include_granted_scopes', 'true');

  window.location.href = authUrl.toString();
};

/**
 * Full Page Redirect for Google Sign-in.
 * Primary: Firebase Auth signInWithRedirect (uses verified Firebase auth handler).
 * Fallback: Direct OAuth redirect if Firebase redirect throws.
 */
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    await signInWithRedirect(auth, provider);
  } catch (err: any) {
    console.warn('Firebase signInWithRedirect failed, attempting direct Google OAuth redirect:', err);
    googleSignInDirectRedirect();
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
  try {
    await signOut(auth);
  } catch (e) {}
  
  cachedAccessToken = null;
  cachedGoogleUser = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(GOOGLE_USER_KEY);
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
