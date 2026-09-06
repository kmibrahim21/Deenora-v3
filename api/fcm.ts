import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let appInitialized = false;

function initFirebase() {
  if (appInitialized && getApps().length > 0) return true;
  if (getApps().length > 0) {
    appInitialized = true;
    return true;
  }

  try {
    let serviceAccount: any = null;
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_CONFIG;
    
    if (serviceAccountStr) {
      const trimmed = serviceAccountStr.trim();
      if (trimmed.startsWith('{')) {
        serviceAccount = JSON.parse(trimmed);
      } else if (trimmed.startsWith('ey')) {
        // Base64 encoded
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      } else if (fs.existsSync(trimmed)) {
        serviceAccount = JSON.parse(fs.readFileSync(trimmed, 'utf8'));
      }
    } else {
      // Check local files if present
      const possiblePaths = [
        path.join(process.cwd(), 'firebase-service-account.json'),
        path.join(process.cwd(), 'serviceAccountKey.json')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        }
      }
    }

    if (serviceAccount && (serviceAccount.project_id || serviceAccount.projectId)) {
      initializeApp({
        credential: cert(serviceAccount)
      });
      appInitialized = true;
      console.log(`[FCM] Firebase Admin successfully initialized for project: ${serviceAccount.project_id || serviceAccount.projectId}`);
      return true;
    } else {
      console.log(`[FCM] FIREBASE_SERVICE_ACCOUNT not configured. Preview simulation active.`);
    }
  } catch (error: any) {
    console.error("[FCM] Firebase Admin Init Error:", error.message);
  }
  return false;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const isConfigured = initFirebase();

  // Support GET request for diagnostics & connection check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: isConfigured ? 'ready' : 'preview_mode',
      configured: isConfigured,
      message: isConfigured 
        ? 'Firebase Cloud Messaging is initialized and ready to send push notifications.' 
        : 'Firebase Cloud Messaging is running in preview mode. Push notifications are processed and logged. To send to real Android devices, add FIREBASE_SERVICE_ACCOUNT JSON to your environment variables.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const { title, body: notificationBody, data = {} } = body;
    let topics: string[] = [];
    if (Array.isArray(body.topics)) {
      topics = body.topics.filter(Boolean);
    } else if (typeof body.topic === 'string' && body.topic.trim()) {
      topics = [body.topic.trim()];
    }

    let tokens: string[] = [];
    if (Array.isArray(body.tokens)) {
      tokens = body.tokens.filter(Boolean);
    } else if (typeof body.token === 'string' && body.token.trim()) {
      tokens = [body.token.trim()];
    }

    if (topics.length === 0 && tokens.length === 0) {
      return res.status(400).json({ error: 'At least one topic or token is required' });
    }

    if (!isConfigured) {
      console.log(`[FCM Notification Simulated] Title: "${title}", Topics: [${topics.join(', ')}], Body: "${notificationBody}"`);
      return res.status(200).json({
        success: true,
        status: 'simulated',
        message: 'Push notification received and processed in preview mode.',
        topics,
        tokens,
        sent: topics.length + tokens.length,
        total: topics.length + tokens.length
      });
    }

    const messaging = getMessaging();
    const promises: Promise<any>[] = [];

    // Stringify any non-string values in data payload as FCM requires string values in data
    const stringData: Record<string, string> = {};
    if (data && typeof data === 'object') {
      for (const [key, val] of Object.entries(data)) {
        stringData[key] = typeof val === 'string' ? val : JSON.stringify(val);
      }
    }
    stringData['click_action'] = stringData['click_action'] || 'FLUTTER_NOTIFICATION_CLICK';

    // 1. Send to topics
    for (const topic of topics) {
      const cleanTopic = topic.replace(/[^a-zA-Z0-9-_.~%]+/g, '_');
      promises.push(
        messaging.send({
          topic: cleanTopic,
          notification: {
            title: String(title || 'Deenora Notification'),
            body: String(notificationBody || '')
          },
          data: stringData
        })
      );
    }

    // 2. Send to tokens (if any)
    for (const token of tokens) {
      promises.push(
        messaging.send({
          token: token,
          notification: {
            title: String(title || 'Deenora Notification'),
            body: String(notificationBody || '')
          },
          data: stringData
        })
      );
    }

    const results = await Promise.allSettled(promises);
    const sentCount = results.filter(r => r.status === 'fulfilled').length;
    const errors = results
      .filter(r => r.status === 'rejected')
      .map((r: any) => r.reason?.message || 'Unknown error');

    if (errors.length > 0) {
      console.warn(`[FCM] Errors sending some notifications:`, errors);
    }

    console.log(`[FCM] Sent ${sentCount}/${promises.length} notifications successfully for "${title}"`);

    return res.status(200).json({
      success: sentCount > 0,
      sent: sentCount,
      total: promises.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err: any) {
    console.error(`[FCM] API handler error:`, err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
