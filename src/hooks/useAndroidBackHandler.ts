import { useEffect, useRef } from 'react';

/**
 * Android-like back button handler for SPAs
 * - Navigate to previous page using browser history
 * - Double back to exit on root page
 * - Mobile/WebView only
 * - Desktop behavior remains unchanged
 */
export const useAndroidBackHandler = (currentView: string, setView: (view: any) => void) => {
  const lastBackPress = useRef<number>(0);
  const isRoot = currentView === 'home' || currentView === 'admin-dashboard';

  useEffect(() => {
    // Only run on mobile/webview
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Push state when view changes to enable back button navigation
    // We only push if the current history state doesn't already match the current view
    if (window.history.state?.view !== currentView) {
      window.history.pushState({ view: currentView }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      // If we have a state in history, it means we can navigate back to a previous view
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else if (isRoot) {
        // We are on root and trying to go back further - handle double-back to exit
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          // Second press within 2 seconds - let it exit
          // This will go back to the browser's previous page or exit the WebView
          window.history.back();
        } else {
          // First press - show toast and stay
          lastBackPress.current = now;
          
          // Show toast
          const toast = document.createElement('div');
          toast.textContent = "Press back again to exit";
          toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 12px 24px;
            border-radius: 999px;
            z-index: 100000;
            font-size: 14px;
            font-weight: 600;
            transition: opacity 0.3s, transform 0.3s;
            pointer-events: none;
            font-family: 'Hind Siliguri', sans-serif;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            text-align: center;
            min-width: 200px;
          `;
          document.body.appendChild(toast);
          
          // Animate in
          toast.style.transform = 'translateX(-50%) translateY(10px)';
          requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
          });
          
          setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 300);
          }, 2000);

          // Push state back to stay on page and intercept next back press
          window.history.pushState({ view: currentView }, '');
        }
      } else {
        // No state in history, but not on root - go home
        setView('home');
        window.history.pushState({ view: 'home' }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, setView, isRoot]);
};
