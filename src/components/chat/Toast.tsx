import React, { useEffect } from 'react';
import { CheckCircle2, Info } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 2500 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] max-w-sm px-4 py-2.5 bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 text-xs font-semibold rounded-full shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
      <span>{message}</span>
    </div>
  );
};
