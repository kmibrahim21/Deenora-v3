/**
 * Universal File Downloader
 * Seamlessly handles file & PDF downloads across:
 * 1. Google Chrome & Web Browsers / PWAs (direct attachment download)
 * 2. Android Studio WebView (via native AndroidInterface bridge with Scoped Storage support)
 * 3. Android WebView with native DownloadManager fallback (/api/download endpoint)
 */

export function isAndroid(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const win = window as any;
  return /Android/i.test(ua) && (
    /wv/i.test(ua) || 
    /Version\/[\d.]+/i.test(ua) || 
    win.Android !== undefined || 
    win.AndroidInterface !== undefined ||
    win.Capacitor !== undefined ||
    win.cordova !== undefined
  );
}

/**
 * Get native Android bridge method if available in the WebView
 */
function getAndroidBridge(): ((base64: string, fileName: string, mimeType: string) => void) | null {
  const win = window as any;
  const bridge = 
    win.AndroidInterface?.downloadFile || 
    win.Android?.downloadFile || 
    win.AndroidInterface?.saveFile || 
    win.Android?.saveFile ||
    win.AndroidInterface?.download || 
    win.Android?.download ||
    win.AndroidInterface?.saveBase64 || 
    win.Android?.saveBase64 ||
    win.AndroidInterface?.downloadBlob ||
    win.Android?.downloadBlob;

  return typeof bridge === 'function' ? bridge.bind(win.AndroidInterface || win.Android) : null;
}

/**
 * Download a Blob as a file
 */
export async function downloadBlob(blob: Blob, fileName: string, mimeType: string = 'application/pdf'): Promise<void> {
  const win = window as any;
  const androidBridge = getAndroidBridge();

  // 1. If running inside Android WebView with Native Download Bridge (Android Studio app)
  if (androidBridge) {
    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const resultStr = (reader.result as string) || '';
            const base64Content = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
            androidBridge(base64Content, fileName, mimeType);
            resolve();
          } catch (e) {
            console.error('[FileDownloader] AndroidInterface download failed inside reader:', e);
            reject(e);
          }
        };
        reader.onerror = (err) => {
          console.error('[FileDownloader] FileReader error:', err);
          reject(err);
        };
        reader.readAsDataURL(blob);
      });
      return; // Succeeded using Android Native Bridge
    } catch (androidErr) {
      console.warn('[FileDownloader] Native Android bridge failed, attempting HTTP fallback:', androidErr);
    }
  }

  // 2. Android WebView without custom JS interface, route through /api/download
  // Android WebView's DownloadListener triggers natively on HTTP attachment headers!
  if (isAndroidWebView() || isAndroid()) {
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = (reader.result as string) || '';
          resolve(resultStr.includes(',') ? resultStr.split(',')[1] : resultStr);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: base64Content, filename: fileName, mimeType })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl) {
          // Trigger download in same frame without target="_blank"
          // This allows Android WebView's DownloadListener to intercept the Content-Disposition attachment
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = data.downloadUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();

          // Use hidden iframe as fallback in case anchor click doesn't trigger WebView listener
          setTimeout(() => {
            try {
              document.body.removeChild(a);
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = data.downloadUrl;
              document.body.appendChild(iframe);
              setTimeout(() => {
                try { document.body.removeChild(iframe); } catch {}
              }, 4000);
            } catch {}
          }, 300);

          return;
        }
      }
    } catch (webViewErr) {
      console.warn('[FileDownloader] /api/download fallback error:', webViewErr);
    }
  }

  // 3. Standard Web Browser / Chrome / PWA direct download
  // Uses Blob URL with HTML5 download attribute
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
  }, 2000);
}

/**
 * Download a file from a URL (e.g. Supabase signed URL or API endpoint)
 */
export async function downloadFromUrl(url: string, fileName: string, mimeType: string = 'application/pdf'): Promise<boolean> {
  const win = window as any;

  // 1. Android Native Bridge with URL support (e.g. downloadFromUrl)
  if (typeof win.AndroidInterface?.downloadFromUrl === 'function') {
    try {
      win.AndroidInterface.downloadFromUrl(url, fileName, mimeType);
      return true;
    } catch (e) {
      console.warn('[FileDownloader] AndroidInterface.downloadFromUrl error:', e);
    }
  }
  if (typeof win.Android?.downloadFromUrl === 'function') {
    try {
      win.Android.downloadFromUrl(url, fileName, mimeType);
      return true;
    } catch (e) {
      console.warn('[FileDownloader] Android.downloadFromUrl error:', e);
    }
  }

  // 2. Android Native Bridge with Blob / Base64 support
  const androidBridge = getAndroidBridge();
  if (androidBridge) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        await downloadBlob(blob, fileName, mimeType);
        return true;
      }
    } catch (bridgeErr) {
      console.warn('[FileDownloader] downloadFromUrl bridge fetch failed:', bridgeErr);
    }
  }

  // 3. Direct Anchor Click without target="_blank"
  // CRITICAL: NEVER set target="_blank" in Android WebViews because links with target="_blank"
  // are ignored if WebChromeClient.onCreateWindow is not implemented in the Android app.
  // Direct same-frame click with download attribute triggers Android WebView's native DownloadListener!
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
    }, 1000);
  } catch (err) {
    console.warn('[FileDownloader] Direct anchor download failed:', err);
  }

  // 4. In case of Android WebView or cross-origin restrictions, also fetch blob and stage via /api/download
  if (isAndroidWebView() || isAndroid()) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        await downloadBlob(blob, fileName, mimeType);
        return true;
      }
    } catch (fetchErr) {
      console.warn('[FileDownloader] Blob fetch fallback failed:', fetchErr);
    }
  }

  return true;
}

/**
 * Save a jsPDF document directly via universal downloadBlob
 */
export async function saveJsPdf(doc: any, fileName: string): Promise<void> {
  const blob = doc.output('blob');
  await downloadBlob(blob, fileName, 'application/pdf');
}
