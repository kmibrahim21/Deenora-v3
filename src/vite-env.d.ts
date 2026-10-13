/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VERCEL_URL: string
  readonly VITE_APP_URL: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  AndroidInterface?: {
    downloadFile?: (base64: string, fileName: string, mimeType: string) => void;
    getFcmToken?: () => string;
    stopRinging?: () => void;
    callStarted?: () => void;
    callEnded?: () => void;
    onIncomingCall?: (callerName: string, callId: string) => void;
    [key: string]: any;
  };
  Android?: {
    downloadFile?: (base64: string, fileName: string, mimeType: string) => void;
    [key: string]: any;
  };
}
