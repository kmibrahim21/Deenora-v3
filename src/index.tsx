
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { checkOAuthRedirectToken } from './services/googleDriveBackup';

// Instantly capture Google OAuth redirect token from hash if returning from redirect
if (typeof window !== 'undefined') {
  checkOAuthRedirectToken();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Suppress benign Vite HMR/WebSocket errors that are expected in this environment
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const isBenignError = (message: any) => {
    const msg = String(message);
    return (
      msg.includes('[vite]') ||
      msg.includes('WebSocket') ||
      msg.includes('HMR') ||
      msg.includes('connection refused') ||
      msg.includes('The operation is insecure')
    );
  };

  console.error = (...args: any[]) => {
    if (args.length > 0 && isBenignError(args[0])) return;
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    if (args.length > 0 && isBenignError(args[0])) return;
    originalWarn.apply(console, args);
  };

  // Prevent "Unhandled Rejection" overlays for these specific errors
  window.addEventListener('unhandledrejection', (event) => {
    if (isBenignError(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

import { ErrorBoundary } from './components/ErrorBoundary';
import { CallProvider } from './context/CallContext';

const root = createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <CallProvider>
      <App />
    </CallProvider>
  </ErrorBoundary>
);

// Register PWA service worker explicitly for Mobile & Desktop Push Notifications
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] ServiceWorker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] ServiceWorker registration notice:', err);
      });
  }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  registerServiceWorker();
} else {
  window.addEventListener('load', registerServiceWorker);
}
