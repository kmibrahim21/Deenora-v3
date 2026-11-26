import { supabase } from '../supabase';
import { Institution } from '../types';

export interface InternetVoiceFeatureConfig {
  attendanceEnabled: boolean;
  attendanceAutoSend: boolean;
  attendanceTemplateId: string;
  dueFeeEnabled: boolean;
  dueFeeTemplateId: string;
}

export function parseConfigJson(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

export function normalizeVoiceAudioUrl(raw: any): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^https?:\/\/t2\.tenbytecloud\.com\//i, 'https://s3.eslcloud.io/');
}

export function isBulkInternetVoiceIdentifier(callId?: string | null, payload?: any): boolean {
  const cleanId = String(callId || payload?.call_id || payload?.callId || '').trim();
  if (cleanId.startsWith('ivc_')) return true;
  if (payload?.type === 'auto_voice_alert' || payload?.call_mode === 'internet_voice_broadcast') return true;
  if (Boolean(payload?.audio_url) && payload?.type !== 'incoming_call') return true;
  return false;
}

export function hasInternetVoicePermission(
  madrasah: Institution | null | undefined,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin || (madrasah as any)?.is_super_admin) return true;
  if (!madrasah) return false;
  const cfg = parseConfigJson(madrasah.config_json);
  const cfgMods = cfg.modules || {};
  return (
    cfgMods.internet_voice_call === true ||
    (madrasah as any)?.internet_voice_call === true ||
    cfg.internet_voice_call === true
  );
}

export function getInternetVoiceFeatureConfig(
  madrasah: Institution | null | undefined
): InternetVoiceFeatureConfig {
  const cfg = parseConfigJson(madrasah?.config_json);
  const features = cfg.features || {};
  return {
    attendanceEnabled: features.internet_voice_attendance_enabled === true,
    attendanceAutoSend: features.internet_voice_attendance_auto_send === true,
    attendanceTemplateId: String(features.internet_voice_attendance_template_id || '').trim(),
    dueFeeEnabled: features.internet_voice_due_fee_enabled === true,
    dueFeeTemplateId: String(features.internet_voice_due_fee_template_id || '').trim(),
  };
}

export interface SendInternetVoiceBroadcastParams {
  institutionId: string;
  voiceTemplateId: string;
  studentIds?: string[];
  targetPhones?: string[];
  classId?: string;
  targetAllStudents?: boolean;
  title?: string;
  body?: string;
}

export interface SendInternetVoiceBroadcastResult {
  success: boolean;
  call_id?: string;
  total_targets: number;
  pushed_devices_count: number;
}

const SESSION_EXPIRED_ERROR =
  'আপনার লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে লগআউট করে পুনরায় লগইন করুন।';

export async function getFreshAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const isExpiringSoon =
      typeof session?.expires_at === 'number' &&
      session.expires_at * 1000 < Date.now() + 60_000;

    if (session?.access_token && !isExpiringSoon) {
      return session.access_token;
    }
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed?.session?.access_token) {
    throw new Error(SESSION_EXPIRED_ERROR);
  }
  return refreshed.session.access_token;
}

export async function sendInternetVoiceBroadcast(
  params: SendInternetVoiceBroadcastParams
): Promise<SendInternetVoiceBroadcastResult> {
  const payloadBody = JSON.stringify({
    institution_id: params.institutionId,
    voice_template_id: params.voiceTemplateId,
    student_ids: params.studentIds,
    target_phones: params.targetPhones,
    class_id: params.classId,
    target_all_students: params.targetAllStudents,
    title: params.title,
    body: params.body,
  });

  const doBroadcastFetch = (token: string) =>
    fetch('/api/call?action=broadcast_internet_voice_call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payloadBody,
    });

  let accessToken = await getFreshAccessToken();
  let res = await doBroadcastFetch(accessToken);

  if (res.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session?.access_token) {
      throw new Error(SESSION_EXPIRED_ERROR);
    }
    accessToken = refreshed.session.access_token;
    res = await doBroadcastFetch(accessToken);
  }

  if (res.status === 401) {
    throw new Error(SESSION_EXPIRED_ERROR);
  }

  const resJson = await res.json().catch(() => ({}));
  if (!res.ok || !resJson.success) {
    throw new Error(resJson.error || 'ইন্টারনেট ভয়েস কল পাঠানো যায়নি।');
  }

  return {
    success: true,
    call_id: resJson.call_id,
    total_targets: Number(resJson.total_targets || 0),
    pushed_devices_count: Number(resJson.pushed_devices_count || 0),
  };
}

export async function uploadInternetVoiceTemplate(params: {
  institutionId: string;
  title: string;
  file: File;
  duration?: number;
  isSuperAdmin?: boolean;
  isManager?: boolean;
}): Promise<any> {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    throw new Error('ভয়েসের শিরোনাম লিখুন।');
  }

  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('অডিও ফাইল পড়তে সমস্যা হয়েছে।'));
    reader.readAsDataURL(params.file);
  });

  const encodedName = encodeURIComponent(cleanTitle);
  const uploadPayloadBody = JSON.stringify({
    name: cleanTitle,
    voice_name: cleanTitle,
    title: cleanTitle,
    audio_base64: base64Audio,
    filename: params.file.name,
    institution_id: params.institutionId,
    is_super_admin: Boolean(params.isSuperAdmin),
    is_manager: Boolean(params.isManager),
    upload_mode: 'internet_only',
    duration: params.duration || 0,
  });

  const doUploadFetch = (token: string) =>
    fetch(`/api/voices/upload?name=${encodedName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Voice-Name': encodedName,
        Authorization: `Bearer ${token}`,
      },
      body: uploadPayloadBody,
    });

  let accessToken = await getFreshAccessToken();
  let res = await doUploadFetch(accessToken);

  if (res.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session?.access_token) {
      throw new Error(SESSION_EXPIRED_ERROR);
    }
    accessToken = refreshed.session.access_token;
    res = await doUploadFetch(accessToken);
  }

  if (res.status === 401) {
    throw new Error(SESSION_EXPIRED_ERROR);
  }

  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || resData.error || 'ভয়েস আপলোড করতে সমস্যা হয়েছে।');
  }

  const audioUrl = normalizeVoiceAudioUrl(
    resData.file_url || resData.preview_url || resData.url || resData.data?.file_url || ''
  );

  if (resData.voice_template) {
    return {
      ...resData.voice_template,
      file_url: normalizeVoiceAudioUrl(resData.voice_template.file_url || audioUrl),
    };
  }

  const initialStatus = params.isSuperAdmin ? 'approved' : 'pending';
  const { data: dbItem, error: dbErr } = await supabase
    .from('voice_templates')
    .insert({
      institution_id: params.institutionId,
      title: cleanTitle,
      file_url: audioUrl,
      admin_status: initialStatus,
      provider_status: 'internet_only',
      provider_voice_name: cleanTitle,
      duration: params.duration || 0,
    })
    .select()
    .single();

  if (dbErr) {
    throw new Error(dbErr.message || 'ভয়েস টেমপ্লেট সংরক্ষণ করা যায়নি।');
  }

  return dbItem;
}
