
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from 'App';
import './index.css';

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
      msg.includes('[vite] failed to connect to websocket') ||
      msg.includes('WebSocket connection to') ||
      msg.includes('WebSocket closed without opened') ||
      msg.includes('HMR') ||
      msg.includes('connection refused')
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

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

;
