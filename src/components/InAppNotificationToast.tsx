import React, { useState, useEffect } from 'react';
import { Bell, X, MessageSquare, ChevronRight } from 'lucide-react';
import { DEENORA_NOTIF_EVENT, InAppNotificationPayload } from '../lib/pushNotifications';

interface ToastItem extends InAppNotificationPayload {
  visible: boolean;
}

interface InAppNotificationToastProps {
  onOpenItem?: (item: InAppNotificationPayload) => void;
}

export const InAppNotificationToast: React.FC<InAppNotificationToastProps> = ({ onOpenItem }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent<InAppNotificationPayload>;
      if (!customEvent.detail) return;

      const newItem: ToastItem = {
        ...customEvent.detail,
        visible: true
      };

      setToasts((prev) => [newItem, ...prev.slice(0, 2)]);

      // Auto-hide after 6 seconds
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === newItem.id ? { ...t, visible: false } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newItem.id));
        }, 300);
      }, 6000);
    };

    window.addEventListener(DEENORA_NOTIF_EVENT, handleNotification);
    return () => {
      window.removeEventListener(DEENORA_NOTIF_EVENT, handleNotification);
    };
  }, []);

  const handleClose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClick = (item: ToastItem) => {
    setToasts((prev) => prev.filter((t) => t.id !== item.id));
    if (onOpenItem) {
      onOpenItem(item);
    }
  };

  if (toasts.length === 0) return null;

  return (
    <aside aria-label="Notifications" className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[99999] pointer-events-none flex flex-col gap-2.5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          id={`toast-${toast.id}`}
          onClick={() => handleClick(toast)}
          className={`pointer-events-auto cursor-pointer transform transition-all duration-300 ease-out flex items-start gap-3 p-3.5 bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md hover:bg-slate-900 active:scale-98 ${
            toast.visible
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 -translate-y-4 scale-95'
          }`}
        >
          {/* Bell Icon badge */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full animate-ping" />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <h4 className="text-sm font-bold text-slate-100 truncate leading-tight">
                {toast.title}
              </h4>
              <span className="text-[10px] text-emerald-400 font-medium whitespace-nowrap bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                এখনই
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {toast.body}
            </p>
          </div>

          {/* Close button */}
          <button
            id={`btn-close-toast-${toast.id}`}
            type="button"
            onClick={(e) => handleClose(toast.id, e)}
            className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </aside>
  );
};
