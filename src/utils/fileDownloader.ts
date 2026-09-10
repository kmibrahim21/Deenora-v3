/**
 * Universal File Downloader
 * Seamlessly handles file & PDF downloads across:
 * 1. Google Chrome & Web Browsers / PWAs (direct attachment download, never opens new URLs)
 * 2. Android Studio WebView (via native AndroidInterface bridge with Scoped Storage support)
 */

declare global {
  interface Window {
    AndroidInterface?: {
      downloadFile?: (base64: string, fileName: string, mimeType: string) => void;
    };
    Android?: {
      downloadFile?: (base64: string, fileName: string, mimeType: string) => void;
    };
  }
}

/**
 * Download a Blob as a file
 */
export async function downloadBlob(blob: Blob, fileName: string, mimeType: string = 'application/pdf'): Promise<void> {
  const androidBridge = window.AndroidInterface?.downloadFile || window.Android?.downloadFile;

  // 1. If running inside Android WebView with Native Download Bridge
  if (typeof androidBridge === 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const resultStr = (reader.result as string) || '';
          const base64Content = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          androidBridge(base64Content, fileName, mimeType);
          resolve();
        } catch (e) {
          console.error('AndroidInterface download failed:', e);
          reject(e);
        }
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(blob);
    });
  }

  // 2. Standard Web Browser / Chrome / PWA direct download
  // Uses Blob URL with HTML5 download attribute - will NEVER open a new tab/URL
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    try {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Ignore cleanup error
    }
  }, 1000);
}

/**
 * Download a file from a URL (e.g. Supabase signed URL) directly without opening a new tab or navigating
 */
export async function downloadFromUrl(url: string, fileName: string, mimeType: string = 'application/pdf'): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
    }
    const blob = await res.blob();
    await downloadBlob(blob, fileName, mimeType);
    return true;
  } catch (err) {
    console.warn('downloadFromUrl direct blob fetch failed, trying fallback:', err);
    // Fallback: If fetch is blocked, attempt anchor tag
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (e) {
        // ignore
      }
    }, 1000);
    return false;
  }
}

/**
 * Save a jsPDF document directly via downloadBlob
 */
export async function saveJsPdf(doc: any, fileName: string): Promise<void> {
  const blob = doc.output('blob');
  await downloadBlob(blob, fileName, 'application/pdf');
}
