export const openWhatsAppChooser = (phone: string, text: string = '') => {
  const cleanPhone = phone.replace(/\D/g, '');
  const textParam = text ? `&text=${encodeURIComponent(text)}` : '';
  
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  if (isAndroid) {
    // Create an intent URL that does NOT specify a package.
    // This forces Android to scan for all apps that can handle the 'whatsapp://' scheme.
    // If both WhatsApp and WhatsApp Business are installed, it will show a bottom sheet chooser (if no default is set).
    // If only one is installed, it opens it directly.
    // We add a fallback to wa.me just in case neither is installed.
    const fallbackUrl = encodeURIComponent(`https://wa.me/88${cleanPhone}${textParam ? '?text=' + encodeURIComponent(text) : ''}`);
    const intentUrl = `intent://send?phone=88${cleanPhone}${textParam}#Intent;scheme=whatsapp;S.browser_fallback_url=${fallbackUrl};end`;
    window.location.href = intentUrl;
  } else {
    // For iOS, Desktop, etc. where intent:// is not supported
    window.location.href = `https://wa.me/88${cleanPhone}${textParam ? '?text=' + encodeURIComponent(text) : ''}`;
  }
};
