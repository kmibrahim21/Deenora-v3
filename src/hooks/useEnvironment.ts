import { useState, useEffect } from 'react';

export type Environment = 'desktop' | 'mobile' | 'webview';

export function useEnvironment(): Environment {
  const [environment, setEnvironment] = useState<Environment>('desktop');

  useEffect(() => {
    const checkEnvironment = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      
      // Check for WebView
      const isWebView = 
        /(iphone|ipod|ipad).*applewebkit(?!.*safari)/i.test(userAgent) || 
        /android.*version\/[0-9].[0-9]/.test(userAgent) ||
        /wv/.test(userAgent) ||
        (window.navigator as any).standalone ||
        window.matchMedia('(display-mode: standalone)').matches;

      if (isWebView) {
        setEnvironment('webview');
        return;
      }

      // Check screen width for mobile vs desktop
      if (window.innerWidth < 768) {
        setEnvironment('mobile');
      } else {
        setEnvironment('desktop');
      }
    };

    checkEnvironment();

    window.addEventListener('resize', checkEnvironment);
    return () => window.removeEventListener('resize', checkEnvironment);
  }, []);

  return environment;
}
