/**
 * Universal File Downloader
 * Seamlessly handles file & PDF downloads across:
 * 1. Google Chrome & Web Browsers / PWAs (direct attachment download)
 * 2. Android Studio WebView (via native AndroidInterface bridge with Scoped Storage support)
 * 3. Android WebView with native DownloadManager fallback (/api/download endpoint)
 */

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && (
    /wv/i.test(ua) || 
    /Version\/[\d.]+/i.test(ua) || 
    (window as any).Android !== undefined || 
    (window as any).AndroidInterface !== undefined
  );
}

/**
 * Download a Blob as a file
 */
export async function downloadBlob(blob: Blob, fileName: string, mimeType: string = 'application/pdf'): Promise<void> {
  const win = window as any;
  const androidBridge = 
    win.AndroidInterface?.downloadFile || 
    win.Android?.downloadFile || 
    win.AndroidInterface?.saveFile || 
    win.Android?.saveFile;

  // 1. If running inside Android WebView with Native Download Bridge (Android Studio app)
  if (typeof androidBridge === 'function') {
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

  // 2. If inside Android WebView without custom JS interface, route through /api/download
  // Android WebView's DownloadListener triggers natively on HTTP attachment headers!
  if (isAndroidWebView()) {
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
          // Direct navigation to HTTP attachment triggers Android DownloadListener
          window.location.assign(data.downloadUrl);
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
  }, 1500);
}

/**
 * Download a file from a URL (e.g. Supabase signed URL or API endpoint)
 */
export async function downloadFromUrl(url: string, fileName: string, mimeType: string = 'application/pdf'): Promise<boolean> {
  const win = window as any;
  const androidBridge = 
    win.AndroidInterface?.downloadFile || 
    win.Android?.downloadFile || 
    win.AndroidInterface?.saveFile || 
    win.Android?.saveFile;

  // 1. Android Native Bridge: Fetch blob and forward base64 to native bridge
  if (typeof androidBridge === 'function') {
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

  // 2. Android WebView without custom bridge: navigate to real HTTPS URL with Content-Disposition
  if (isAndroidWebView()) {
    try {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 1000);
      return true;
    } catch (err) {
      console.warn('[FileDownloader] Android WebView URL navigation failed:', err);
    }
  }

  // 3. Standard Browser: fetch blob for clean silent download
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
    }
    const blob = await res.blob();
    await downloadBlob(blob, fileName, mimeType);
    return true;
  } catch (err) {
    console.warn('[FileDownloader] downloadFromUrl direct blob fetch failed, falling back to anchor tag:', err);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (e) {}
    }, 1000);
    return false;
  }
}

/**
 * Save a jsPDF document directly via universal downloadBlob
 */
export async function saveJsPdf(doc: any, fileName: string): Promise<void> {
  const blob = doc.output('blob');
  await downloadBlob(blob, fileName, 'application/pdf');
}
