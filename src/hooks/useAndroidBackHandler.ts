import { useEffect, useRef } from 'react';
import { executeBackHandlerStack } from '../utils/backHandler';

declare global {
  interface Window {
    handleNativeBackPressed?: () => boolean;
  }
}

let lastRootBackPress = 0;

export const showExitToast = (message: string) => {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('deenora-exit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'deenora-exit-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    background-color: rgba(15, 23, 42, 0.92);
    color: #ffffff;
    padding: 10px 22px;
    border-radius: 9999px;
    z-index: 999999;
    font-size: 13px;
    font-weight: 700;
    transition: all 0.25s ease-out;
    pointer-events: none;
    font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3);
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.15);
  `;
  document.body.appendChild(toast);

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
};

export const useAndroidBackHandler = (
  currentView: string,
  setView: (view: any) => void,
  userRole?: string,
  lang: 'bn' | 'en' = 'bn'
) => {
  const currentViewRef = useRef(currentView);
  const userRoleRef = useRef(userRole);

  useEffect(() => {
    currentViewRef.current = currentView;
    userRoleRef.current = userRole;
  }, [currentView, userRole]);

  useEffect(() => {
    // Universal native back bridge function called directly by Android MainActivity
    window.handleNativeBackPressed = (): boolean => {
      // 1. Execute handlers from priority-sorted stack (modals, zoomed images, sub-tabs)
      const handledByStack = executeBackHandlerStack();
      if (handledByStack) {
        return true;
      }

      // 2. Fallback check: Close any open HTML modal/dialog overlay with a close button
      const modalCloseBtn = document.querySelector<HTMLElement>(
        '.modal-overlay button.close-modal, [data-modal-close], button[aria-label="Close"], button[aria-label="close"], button.close-btn'
      );
      if (modalCloseBtn) {
        try {
          modalCloseBtn.click();
          return true;
        } catch {}
      }

      // 3. Sub-view to Root Navigation (If not on root dashboard)
      const cView = currentViewRef.current;
      const uRole = userRoleRef.current;
      const isRoot = cView === 'home' || cView === 'admin-dashboard' || cView === 'parent-portal';

      if (!isRoot) {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          window.history.back();
        } else {
          setView(uRole === 'parent' ? 'parent-portal' : 'home');
        }
        return true;
      }

      // 4. Double-back to exit on root page
      const now = Date.now();
      if (now - lastRootBackPress < 2000) {
        return false; // Return false to signal Android native code to exit/minimize app
      }
      lastRootBackPress = now;

      const exitMsg = lang === 'bn' ? 'অ্যাপ থেকে বের হতে আবার ব্যাক চাপুন' : 'Press back again to exit';
      showExitToast(exitMsg);
      return true;
    };

    // Push browser history state on view change to intercept hardware/browser back actions
    if (typeof window !== 'undefined' && window.history.state?.view !== currentView) {
      window.history.pushState({ view: currentView }, '');
    }

    const handlePopState = (_event: PopStateEvent) => {
      if (window.handleNativeBackPressed) {
        const handled = window.handleNativeBackPressed();
        if (handled) {
          // Re-push state to keep history stack stable if user handled internal navigation
          window.history.pushState({ view: currentViewRef.current }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentView, setView, lang]);
};
