// Native Android push fan-out helper (WebView app).
//
// Background: parent "push" notifications today are LOCAL only — Supabase Realtime
// event -> Service Worker showNotification() while the page is open. Android WebView
// cannot render ServiceWorker notifications and cannot be woken when closed.
// This helper routes the same events through NATIVE FCM instead:
//
//  1. registerNativePushToken(...) — call once after parent login. Reads the native
//     FCM token via the Android JS bridge and registers it WITH the parent's
//     student_id + guardian phone, so the server can target this device later.
//  2. pushToParents(...) — call after creating a notice / diary / chat message /
//     result announcement. Fire-and-forget: the server resolves recipient phones,
//     matches registered device tokens, and sends FCM data messages.

export type PushTarget =
  | { type: 'class'; class_name: string }
  | { type: 'all' }
  | { type: 'students'; student_ids: string[] }
  | { type: 'phones'; phones: string[] };

export interface PushToParentsOptions {
  institution_id?: string;
  /** Explicit target. If omitted, conversation_id / class_name is used for targeting. */
  target?: PushTarget;
  /** Chat conversation id, e.g. "class-group-<id>", "general", or a student id / phone for direct chats */
  conversation_id?: string;
  /** Message class_name, e.g. "All", "APP_NOTICE", "APP_SYLLABUS_<class>", or a class name */
  class_name?: string;
  title: string;
  body: string;
  /** Sender's student id / phone — excluded from recipients */
  sender_id?: string;
}

/** Fire-and-forget: notify parent Android apps about a new notice/diary/chat/result. */
export function pushToParents(opts: PushToParentsOptions): void {
  try {
    if (typeof window === 'undefined' || !opts.institution_id) return;
    fetch('/api/call?action=send_notification_push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_notification_push', ...opts }),
    }).catch(() => {});
  } catch {}
}

let nativeTokenRegistered = false;

/**
 * Register the Android WebView app's native FCM token, linked to the parent.
 * Call after parent login (ParentPortal). Safe to call repeatedly — runs once.
 * Retries a few times because the native token may not be ready on first call.
 */
export function registerNativePushToken(
  student_id?: string,
  guardian_phone?: string,
  institution_id?: string
): void {
  try {
    if (nativeTokenRegistered || typeof window === 'undefined') return;
    const w = window as any;
    const bridge = w.AndroidInterface;
    if (!bridge || typeof bridge.getFcmToken !== 'function') return; // not in Android app
    let attempts = 0;
    const tryRegister = () => {
      attempts++;
      let token = '';
      try {
        token = bridge.getFcmToken() || '';
      } catch {}
      if (token) {
        nativeTokenRegistered = true;
        fetch('/api/call?action=register_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register_token',
            token,
            student_id: student_id || undefined,
            phone: guardian_phone || undefined,
            institution_id: institution_id || undefined,
          }),
        }).catch(() => {});
      } else if (attempts < 5) {
        setTimeout(tryRegister, 2000);
      }
    };
    tryRegister();
  } catch {}
}
