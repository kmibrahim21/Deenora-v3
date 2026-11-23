import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  User,
  UserCheck,
  X,
  XCircle,
  AlertCircle,
  Calendar,
  Building2,
  Clock,
} from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language } from 'types';
import { packStudentNotesWithExtra } from 'utils/studentExtraFields';
import { isValidUUID } from 'utils/validation';
import { toBnDigit } from 'utils/calendarUtils';
import { requestManager } from 'services/RequestManager';

interface PublicSiteFormState {
  admission_open: boolean;
  admission_note: string;
  tagline: string;
  about: string;
  established_year: string;
  office_hours: string;
  facebook_url: string;
  youtube_url: string;
  map_url: string;
}

const DEFAULT_PUBLIC_SITE_FORM: PublicSiteFormState = {
  admission_open: true,
  admission_note: '',
  tagline: '',
  about: '',
  established_year: '',
  office_hours: '',
  facebook_url: '',
  youtube_url: '',
  map_url: '',
};

function parseConfigJson(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function extractPublicSiteForm(rawConfig: any): PublicSiteFormState {
  const cfg = parseConfigJson(rawConfig);
  const ps = cfg?.public_site && typeof cfg.public_site === 'object' ? cfg.public_site : {};
  return {
    admission_open: ps.admission_open !== false,
    admission_note: typeof ps.admission_note === 'string' ? ps.admission_note : '',
    tagline: typeof ps.tagline === 'string' ? ps.tagline : '',
    about: typeof ps.about === 'string' ? ps.about : '',
    established_year: typeof ps.established_year === 'string' ? ps.established_year : '',
    office_hours: typeof ps.office_hours === 'string' ? ps.office_hours : '',
    facebook_url: typeof ps.facebook_url === 'string' ? ps.facebook_url : '',
    youtube_url: typeof ps.youtube_url === 'string' ? ps.youtube_url : '',
    map_url: typeof ps.map_url === 'string' ? ps.map_url : '',
  };
}

function validateOptionalHttpUrl(raw: string): { valid: boolean; cleaned: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, cleaned: '' };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return { valid: true, cleaned: parsed.toString() };
    }
    return { valid: false, cleaned: trimmed };
  } catch {
    return { valid: false, cleaned: trimmed };
  }
}

export interface OnlineAdmissionRow {
  id: string;
  institution_id: string;
  class_id: string;
  student_name: string;
  name_en?: string | null;
  student_name_en?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  father_name?: string | null;
  guardian_name?: string | null;
  guardian_phone: string;
  address?: string | null;
  previous_institution?: string | null;
  photo_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

interface PublicSiteManagerProps {
  madrasah: Institution | null;
  lang: Language;
  activeYear?: { id?: string } | null;
  classesList?: Array<{ id: string; class_name: string }>;
  onApproved?: (admittedClassId: string) => void;
  onPendingCountChange?: (count: number) => void;
}

function isSafeImageSrc(src?: string | null): boolean {
  if (!src) return false;
  return src.startsWith('https://') || src.startsWith('http://') || src.startsWith('data:image/');
}

function formatDateBn(iso?: string | null, isBn = true): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return isBn ? toBnDigit(iso) : iso;
    return d.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isBn ? toBnDigit(iso) : iso;
  }
}

export const PublicSiteManager: React.FC<PublicSiteManagerProps> = ({
  madrasah,
  lang,
  activeYear,
  classesList,
  onApproved,
  onPendingCountChange,
}) => {
  const isBn = lang === 'bn';
  const isDark = madrasah?.theme === 'dark';

  const [applications, setApplications] = useState<OnlineAdmissionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'rejected' | 'all'>('pending');
  const [classesMap, setClassesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editable Public Website Content State (slug is strictly Super Admin only)
  const [editorExpanded, setEditorExpanded] = useState<boolean>(false);
  const [siteForm, setSiteForm] = useState<PublicSiteFormState>(() =>
    extractPublicSiteForm(madrasah?.config_json)
  );
  const [savingSiteInfo, setSavingSiteInfo] = useState<boolean>(false);
  const [confirmResetSite, setConfirmResetSite] = useState<boolean>(false);

  useEffect(() => {
    setSiteForm(extractPublicSiteForm(madrasah?.config_json));
  }, [madrasah?.id, madrasah?.config_json]);

  useEffect(() => {
    if (!madrasah?.id) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('institutions')
          .select('config_json')
          .eq('id', madrasah.id)
          .maybeSingle();
        if (active && data?.config_json) {
          setSiteForm(extractPublicSiteForm(data.config_json));
        }
      } catch {
        // Fallback to prop config_json silently
      }
    })();
    return () => {
      active = false;
    };
  }, [madrasah?.id]);

  const publicCode = useMemo(() => {
    if (!madrasah) return '';
    const configObj = parseConfigJson(madrasah.config_json);
    return String(
      configObj?.public_site?.slug ||
        madrasah.institute_code ||
        configObj?.institute_code ||
        madrasah.id ||
        ''
    ).trim();
  }, [madrasah]);

  const shareableUrl = useMemo(() => {
    if (!publicCode) return '';
    return `https://deenora.app/m/${encodeURIComponent(publicCode)}`;
  }, [publicCode]);

  const previewHref = useMemo(() => {
    if (!publicCode) return '#';
    return `/m/${encodeURIComponent(publicCode)}`;
  }, [publicCode]);

  const whatsappHref = useMemo(() => {
    if (!shareableUrl || !madrasah) return '#';
    const text = isBn
      ? `${madrasah.name}-এর অফিসিয়াল ওয়েবসাইট, নোটিশ, রেজাল্ট ও অনলাইন ভর্তির জন্য নিচের লিংকে ভিজিট করুন:\n${shareableUrl}`
      : `Visit ${madrasah.name}'s official portal for notices, results & online admission:\n${shareableUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [shareableUrl, madrasah, isBn]);

  const showNotice = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 3800);
  }, []);

  const syncPendingCount = useCallback(
    (rows: OnlineAdmissionRow[]) => {
      const pendingCount = rows.filter((r) => r.status === 'pending').length;
      onPendingCountChange?.(pendingCount);
    },
    [onPendingCountChange]
  );

  const fetchApplications = useCallback(async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [appsRes, clsRes] = await Promise.all([
        supabase
          .from('online_admissions')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('created_at', { ascending: false })
          .limit(150),
        classesList && classesList.length > 0
          ? Promise.resolve({ data: classesList, error: null })
          : supabase
              .from('classes')
              .select('id, class_name')
              .eq('institution_id', madrasah.id),
      ]);

      if (appsRes.error) throw appsRes.error;

      const list = (appsRes.data || []) as OnlineAdmissionRow[];
      setApplications(list);
      syncPendingCount(list);

      const map: Record<string, string> = {};
      (clsRes.data || []).forEach((c: any) => {
        map[c.id] = c.class_name;
      });
      setClassesMap(map);
    } catch (err: any) {
      console.error('[PublicSiteManager] fetch error:', err);
      const raw = String(err?.message || '');
      if (/relation .*online_admissions.* does not exist|Could not find the table/i.test(raw)) {
        setErrorMsg(
          isBn
            ? 'ডাটাবেসে online_admissions টেবিল এখনো তৈরি করা হয়নি।'
            : 'The online_admissions table has not been created yet.'
        );
      } else {
        setErrorMsg(
          isBn
            ? 'অনলাইন আবেদন তালিকা লোড করতে সমস্যা হয়েছে।'
            : 'Failed to load online admissions.'
        );
      }
      setApplications([]);
      onPendingCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [madrasah?.id, classesList, isBn, onPendingCountChange, syncPendingCount]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const pendingCount = useMemo(
    () => applications.filter((a) => a.status === 'pending').length,
    [applications]
  );
  const rejectedCount = useMemo(
    () => applications.filter((a) => a.status === 'rejected').length,
    [applications]
  );
  const filteredApplications = useMemo(() => {
    if (statusFilter === 'all') return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  const persistPublicSiteConfig = async (nextFields: PublicSiteFormState, successMessage: string) => {
    if (!madrasah?.id) return;
    setSavingSiteInfo(true);
    try {
      const fbCheck = validateOptionalHttpUrl(nextFields.facebook_url);
      if (!fbCheck.valid) {
        throw new Error(
          isBn
            ? 'ফেসবুক লিংকটি https:// দিয়ে শুরু হতে হবে।'
            : 'Facebook URL must start with http:// or https://'
        );
      }
      const ytCheck = validateOptionalHttpUrl(nextFields.youtube_url);
      if (!ytCheck.valid) {
        throw new Error(
          isBn
            ? 'ইউটিউব লিংকটি https:// দিয়ে শুরু হতে হবে।'
            : 'YouTube URL must start with http:// or https://'
        );
      }
      const mapCheck = validateOptionalHttpUrl(nextFields.map_url);
      if (!mapCheck.valid) {
        throw new Error(
          isBn
            ? 'গুগল ম্যাপ লিংকটি https:// দিয়ে শুরু হতে হবে।'
            : 'Google Maps URL must start with http:// or https://'
        );
      }

      // Fetch latest config_json to strictly preserve Super Admin's slug & other settings
      const { data: latestRow } = await supabase
        .from('institutions')
        .select('config_json')
        .eq('id', madrasah.id)
        .maybeSingle();

      const latestConfig = parseConfigJson(latestRow?.config_json ?? madrasah.config_json);
      const latestPublicSite =
        latestConfig.public_site && typeof latestConfig.public_site === 'object'
          ? latestConfig.public_site
          : {};
      const preservedSlug = latestPublicSite.slug;

      const sanitizedForm: PublicSiteFormState = {
        admission_open: Boolean(nextFields.admission_open),
        admission_note: nextFields.admission_note.trim().slice(0, 240),
        tagline: nextFields.tagline.trim().slice(0, 300),
        about: nextFields.about.trim().slice(0, 2500),
        established_year: nextFields.established_year.trim().slice(0, 30),
        office_hours: nextFields.office_hours.trim().slice(0, 120),
        facebook_url: fbCheck.cleaned,
        youtube_url: ytCheck.cleaned,
        map_url: mapCheck.cleaned,
      };

      const mergedPublicSite: Record<string, any> = {
        ...latestPublicSite,
        ...sanitizedForm,
      };
      if (preservedSlug !== undefined) {
        mergedPublicSite.slug = preservedSlug;
      } else {
        delete mergedPublicSite.slug;
      }

      const nextConfig = {
        ...latestConfig,
        public_site: mergedPublicSite,
      };

      const { error: updateErr } = await supabase
        .from('institutions')
        .update({ config_json: nextConfig })
        .eq('id', madrasah.id);

      if (updateErr) {
        // Fallback for child branch accounts under strict client RLS
        const fallbackRes = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-settings',
            institutionId: madrasah.id,
            config_json: nextConfig,
          }),
        });
        const fallbackJson = await fallbackRes.json().catch(() => ({}));
        if (!fallbackRes.ok) {
          throw new Error(fallbackJson.error || updateErr.message);
        }
      }

      requestManager.invalidatePattern(`institution:${madrasah.id}`);
      setSiteForm(sanitizedForm);
      setConfirmResetSite(false);
      showNotice(successMessage, 'success');
    } catch (err: any) {
      console.error('[PublicSiteManager] Save website info error:', err);
      showNotice(
        err?.message ||
          (isBn ? 'ওয়েবসাইটের তথ্য সংরক্ষণ করা যায়নি।' : 'Failed to save website info.'),
        'error'
      );
    } finally {
      setSavingSiteInfo(false);
    }
  };

  const handleSaveSiteInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistPublicSiteConfig(
      siteForm,
      isBn
        ? 'ওয়েবসাইটের তথ্য সফলভাবে সংরক্ষণ করা হয়েছে!'
        : 'Website information saved successfully!'
    );
  };

  const handleResetSiteInfo = async () => {
    await persistPublicSiteConfig(
      { ...DEFAULT_PUBLIC_SITE_FORM },
      isBn
        ? 'ওয়েবসাইটের কাস্টম তথ্য মুছে ডিফল্ট করা হয়েছে।'
        : 'Website content reset to defaults.'
    );
  };

  const handleCopyLink = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showNotice(isBn ? 'লিংক কপি করা যায়নি।' : 'Could not copy link.', 'error');
    }
  };

  const getNextAvailableRoll = async (classId: string): Promise<number> => {
    const { data: maxRow } = await supabase
      .from('students')
      .select('roll')
      .eq('class_id', classId)
      .not('roll', 'is', null)
      .order('roll', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (Number(maxRow?.roll) || 0) + 1;
  };

  const handleApprove = async (app: OnlineAdmissionRow) => {
    if (!madrasah?.id) return;
    setProcessingId(app.id);
    setConfirmRejectId(null);

    try {
      const targetYearId =
        activeYear?.id || (madrasah.config_json as any)?.active_academic_year_id || null;
      const validYearId = targetYearId && isValidUUID(targetYearId) ? targetYearId : null;

      let nextRoll = await getNextAvailableRoll(app.class_id);

      const extraFields: Record<string, any> = {};
      if (app.father_name) extraFields.father_name = app.father_name;
      if (app.previous_institution) extraFields.previous_institution = app.previous_institution;
      if (app.gender) extraFields.gender = app.gender;

      const packedNotes =
        Object.keys(extraFields).length > 0 ? packStudentNotesWithExtra('', extraFields) : null;

      const englishName = (app.name_en || app.student_name_en || '').trim() || null;

      const basePayload: Record<string, any> = {
        institution_id: madrasah.id,
        class_id: app.class_id,
        academic_year_id: validYearId,
        student_name: app.student_name.trim(),
        name_en: englishName,
        guardian_name: (app.guardian_name || app.father_name || app.student_name).trim(),
        father_name: app.father_name?.trim() || null,
        gender: app.gender || null,
        guardian_phone: app.guardian_phone.trim(),
        date_of_birth: app.date_of_birth || null,
        address: app.address?.trim() || null,
        previous_institution: app.previous_institution?.trim() || null,
        photo_url: app.photo_url || null,
        roll: nextRoll,
        notes: packedNotes,
        is_active: true,
      };

      let attemptPayload = { ...basePayload };
      let insertSuccess = false;
      let lastError: any = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        const { error: insErr } = await supabase.from('students').insert(attemptPayload);
        if (!insErr) {
          insertSuccess = true;
          break;
        }
        lastError = insErr;
        const msg = String(insErr.message || '');

        // Roll conflict (students_class_id_roll_key / 23505): recompute next roll and retry
        if (
          insErr.code === '23505' ||
          msg.includes('students_class_id_roll_key') ||
          msg.includes('duplicate key')
        ) {
          nextRoll = Math.max(nextRoll + 1, await getNextAvailableRoll(app.class_id));
          attemptPayload.roll = nextRoll;
          continue;
        }

        // Foreign key violation on academic_year_id
        if (attemptPayload.academic_year_id && (insErr.code === '23503' || msg.includes('foreign key'))) {
          attemptPayload.academic_year_id = null;
          continue;
        }

        // Missing optional column in students table
        if (
          insErr.code === 'PGRST204' ||
          insErr.code === '42703' ||
          /column .* does not exist|Could not find the .* column/i.test(msg)
        ) {
          const missingCol =
            msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]?/)?.[1] ||
            msg.match(/Could not find the '([a-zA-Z0-9_]+)' column/)?.[1];
          if (missingCol && Object.prototype.hasOwnProperty.call(attemptPayload, missingCol)) {
            delete attemptPayload[missingCol];
            continue;
          }
          delete attemptPayload.father_name;
          delete attemptPayload.previous_institution;
          continue;
        }

        break;
      }

      if (!insertSuccess) {
        throw lastError || new Error('Failed to insert student');
      }

      // Mark online admission as approved (scoped to institution_id)
      const { error: updateErr } = await supabase
        .from('online_admissions')
        .update({ status: 'approved' })
        .eq('id', app.id)
        .eq('institution_id', madrasah.id);

      if (updateErr) throw updateErr;

      // Invalidate student & dashboard caches
      requestManager.invalidatePattern('fetch:students:');
      requestManager.invalidatePattern('v6_students:');
      requestManager.invalidatePattern('students');
      requestManager.invalidatePattern(`stats:${madrasah.id}`);
      requestManager.invalidatePattern('dashboard_');

      setApplications((prev) => {
        const next = prev.map((item) =>
          item.id === app.id ? { ...item, status: 'approved' as const } : item
        );
        syncPendingCount(next);
        return next;
      });

      const clsLabel = classesMap[app.class_id] || '';
      showNotice(
        isBn
          ? `${app.student_name}-কে ${clsLabel ? `${clsLabel} শ্রেণিতে ` : ''}রোল ${toBnDigit(attemptPayload.roll ?? nextRoll)} হিসেবে ভর্তি করা হয়েছে!`
          : `Admitted ${app.student_name}${clsLabel ? ` to ${clsLabel}` : ''} with Roll #${attemptPayload.roll ?? nextRoll}.`
      );
      onApproved?.(app.class_id);
    } catch (err: any) {
      console.error('[PublicSiteManager] Approve error:', err);
      showNotice(
        err?.message ||
          (isBn ? 'ভর্তি অ্যাপ্রুভ করতে সমস্যা হয়েছে।' : 'Failed to approve application.'),
        'error'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (app: OnlineAdmissionRow) => {
    if (!madrasah?.id) return;
    setProcessingId(app.id);
    setConfirmDeleteId(null);
    try {
      const { error } = await supabase
        .from('online_admissions')
        .update({ status: 'rejected' })
        .eq('id', app.id)
        .eq('institution_id', madrasah.id);

      if (error) throw error;

      setApplications((prev) => {
        const next = prev.map((item) =>
          item.id === app.id ? { ...item, status: 'rejected' as const } : item
        );
        syncPendingCount(next);
        return next;
      });
      setConfirmRejectId(null);
      showNotice(
        isBn
          ? `${app.student_name}-এর আবেদন বাতিল করা হয়েছে।`
          : `Rejected application for ${app.student_name}.`
      );
    } catch (err: any) {
      console.error('[PublicSiteManager] Reject error:', err);
      showNotice(
        isBn ? 'আবেদন বাতিল করতে সমস্যা হয়েছে।' : 'Failed to reject application.',
        'error'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteApplication = async (app: OnlineAdmissionRow) => {
    if (!madrasah?.id) return;
    setProcessingId(app.id);
    setConfirmRejectId(null);
    try {
      const { error } = await supabase
        .from('online_admissions')
        .delete()
        .eq('id', app.id)
        .eq('institution_id', madrasah.id);

      if (error) throw error;

      setApplications((prev) => {
        const next = prev.filter((item) => item.id !== app.id);
        syncPendingCount(next);
        return next;
      });
      setConfirmDeleteId(null);
      showNotice(
        isBn
          ? `${app.student_name}-এর আবেদন স্থায়ীভাবে মুছে ফেলা হয়েছে।`
          : `Permanently deleted application for ${app.student_name}.`
      );
    } catch (err: any) {
      console.error('[PublicSiteManager] Delete error:', err);
      showNotice(
        isBn ? 'আবেদনটি মুছে ফেলা যায়নি।' : 'Failed to delete application.',
        'error'
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (!madrasah) return null;

  return (
    <div className="space-y-5 font-noto">
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? isDark
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDark
                ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={17} className="shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle size={17} className="shrink-0 text-rose-500" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Shareable Public Website Link Card */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border space-y-3.5 ${
          isDark
            ? 'bg-slate-800/80 border-slate-700'
            : 'bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/40 border-blue-100'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Globe size={20} />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {isBn ? 'প্রতিষ্ঠানের পাবলিক ওয়েবসাইট লিংক' : 'Public Institution Website'}
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isBn
                  ? 'অভিভাবকদের সাথে শেয়ার করুন — নোটিশ, রেজাল্ট ও অনলাইন ভর্তির জন্য'
                  : 'Share with parents for notices, results & online admission'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Shareable URL */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-blue-300'
              : 'bg-white border-slate-200 text-[#1E3A8A]'
          }`}
        >
          <span className="text-xs sm:text-sm font-bold truncate font-mono">{shareableUrl}</span>
          <button
            type="button"
            onClick={handleCopyLink}
            className={`h-8 px-3 rounded-xl text-[11px] font-black inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-[#2563EB] hover:bg-[#1E3A8A] text-white'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? (isBn ? 'কপি হয়েছে' : 'Copied') : isBn ? 'কপি লিংক' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-3.5 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Share2 size={14} />
            <span>{isBn ? 'WhatsApp শেয়ার' : 'WhatsApp Share'}</span>
          </a>
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-blue-300 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-[#1E3A8A] hover:bg-blue-50'
            }`}
          >
            <ExternalLink size={14} />
            <span>{isBn ? 'প্রিভিউ দেখুন' : 'Open Preview'}</span>
          </a>
        </div>
      </div>

      {/* Expandable Edit Website Info Section */}
      <div
        className={`rounded-3xl border overflow-hidden transition-all ${
          isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200/90 shadow-sm'
        }`}
      >
        <button
          type="button"
          onClick={() => setEditorExpanded((prev) => !prev)}
          aria-expanded={editorExpanded}
          className={`w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
            isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-[#2563EB]'
              }`}
            >
              <Edit3 size={18} />
            </div>
            <div className="min-w-0">
              <h4 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {isBn ? 'ওয়েবসাইটের তথ্য এডিট করুন' : 'Edit Website Info'}
              </h4>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                {siteForm.admission_open
                  ? isBn
                    ? 'অনলাইন ভর্তি চালু আছে · ট্যাগলাইন, পরিচিতি ও যোগাযোগ লিংক আপডেট করুন'
                    : 'Admissions open · Update tagline, about & contact links'
                  : isBn
                    ? 'অনলাইন ভর্তি বর্তমানে বন্ধ · এখান থেকে স্ট্যাটাস ও তথ্য পরিবর্তন করুন'
                    : 'Admissions closed · Update status & website content'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`hidden sm:inline-block text-[11px] font-black ${
                siteForm.admission_open
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {siteForm.admission_open
                ? isBn
                  ? 'ভর্তি চালু'
                  : 'Open'
                : isBn
                  ? 'ভর্তি বন্ধ'
                  : 'Closed'}
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {editorExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </button>

        {editorExpanded && (
          <form
            onSubmit={handleSaveSiteInfo}
            className={`px-4 sm:px-5 pb-5 pt-4 border-t space-y-4 ${
              isDark ? 'border-slate-700' : 'border-slate-100'
            }`}
          >
            {/* 1. Admission Open Toggle */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isDark
                  ? 'bg-slate-900/70 border-slate-700'
                  : siteForm.admission_open
                    ? 'bg-emerald-50/50 border-emerald-200/80'
                    : 'bg-amber-50/60 border-amber-200/80'
              }`}
            >
              <div className="min-w-0">
                <div className={`text-xs sm:text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isBn ? 'ভর্তি স্ট্যাটাস' : 'Admission Status'}
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {siteForm.admission_open
                    ? isBn
                      ? 'অনলাইন ভর্তি চালু — অভিভাবকরা ওয়েবসাইট থেকে আবেদন করতে পারবেন'
                      : 'Online admission is open for parents'
                    : isBn
                      ? 'অনলাইন ভর্তি বন্ধ — ওয়েবসাইটে ভর্তি ফরমের বদলে বন্ধের নোটিশ দেখাবে'
                      : 'Online admission form is paused on the public site'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={siteForm.admission_open}
                onClick={() =>
                  setSiteForm((prev) => ({ ...prev, admission_open: !prev.admission_open }))
                }
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  siteForm.admission_open ? 'bg-[#059669]' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    siteForm.admission_open ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 2. Admission Note */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {isBn ? 'ভর্তি সংক্রান্ত নোট (ঐচ্ছিক)' : 'Admission Note (Optional)'}
                </label>
                {siteForm.admission_note && (
                  <button
                    type="button"
                    onClick={() => setSiteForm((prev) => ({ ...prev, admission_note: '' }))}
                    className="text-[11px] font-bold text-rose-500 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <X size={12} />
                    <span>{isBn ? 'মুছুন' : 'Clear'}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={siteForm.admission_note}
                onChange={(e) => setSiteForm((prev) => ({ ...prev, admission_note: e.target.value }))}
                placeholder={isBn ? 'যেমন: ২০২৬ শিক্ষাবর্ষের ভর্তি চলছে' : 'e.g., 2026 admissions are open'}
                className={`w-full h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                }`}
              />
            </div>

            {/* 3. Tagline */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {isBn ? 'প্রতিষ্ঠানের স্লোগান / ট্যাগলাইন' : 'Institution Tagline'}
                </label>
                {siteForm.tagline && (
                  <button
                    type="button"
                    onClick={() => setSiteForm((prev) => ({ ...prev, tagline: '' }))}
                    className="text-[11px] font-bold text-rose-500 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <X size={12} />
                    <span>{isBn ? 'মুছুন' : 'Clear'}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={siteForm.tagline}
                onChange={(e) => setSiteForm((prev) => ({ ...prev, tagline: e.target.value }))}
                placeholder={
                  isBn
                    ? 'যেমন: দ্বীনি ও আধুনিক শিক্ষার সমন্বয়ে আদর্শ মানুষ গড়ার নির্ভরযোগ্য প্রতিষ্ঠান'
                    : 'Short tagline displayed in hero section'
                }
                className={`w-full h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                }`}
              />
            </div>

            {/* 4. About Institution */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  {isBn ? 'প্রতিষ্ঠানের পরিচিতি / মুহতামিমের বাণী' : 'About Institution'}
                </label>
                {siteForm.about && (
                  <button
                    type="button"
                    onClick={() => setSiteForm((prev) => ({ ...prev, about: '' }))}
                    className="text-[11px] font-bold text-rose-500 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <X size={12} />
                    <span>{isBn ? 'মুছুন' : 'Clear'}</span>
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={siteForm.about}
                onChange={(e) => setSiteForm((prev) => ({ ...prev, about: e.target.value }))}
                placeholder={
                  isBn
                    ? 'প্রতিষ্ঠানের লক্ষ্য, শিক্ষা ব্যবস্থা, আবাসিক সুবিধা বা মুহতামিমের সংক্ষিপ্ত বাণী লিখুন...'
                    : 'Write a short introduction about your institution...'
                }
                className={`w-full p-3.5 rounded-xl border text-xs sm:text-sm font-medium leading-relaxed outline-none focus:ring-2 focus:ring-[#2563EB] transition-all resize-y ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                }`}
              />
            </div>

            {/* 5 & 6. Established Year & Office Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {isBn ? 'স্থাপিত সাল' : 'Established Year'}
                  </label>
                  {siteForm.established_year && (
                    <button
                      type="button"
                      onClick={() => setSiteForm((prev) => ({ ...prev, established_year: '' }))}
                      className="text-[11px] font-bold text-rose-500 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={siteForm.established_year}
                  onChange={(e) =>
                    setSiteForm((prev) => ({ ...prev, established_year: e.target.value }))
                  }
                  placeholder={isBn ? 'যেমন: ২০১০' : 'e.g., 2010'}
                  className={`w-full h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span>{isBn ? 'অফিস সময়' : 'Office Hours'}</span>
                  </label>
                  {siteForm.office_hours && (
                    <button
                      type="button"
                      onClick={() => setSiteForm((prev) => ({ ...prev, office_hours: '' }))}
                      className="text-[11px] font-bold text-rose-500 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={siteForm.office_hours}
                  onChange={(e) => setSiteForm((prev) => ({ ...prev, office_hours: e.target.value }))}
                  placeholder={isBn ? 'সকাল ৮:০০ – বিকাল ৪:০০' : '8:00 AM – 4:00 PM'}
                  className={`w-full h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* 7. Social & Map Links */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-300">
                <Link2 size={13} className="text-[#2563EB]" />
                <span>{isBn ? 'সোশ্যাল ও ম্যাপ লিংক (ঐচ্ছিক)' : 'Social & Map Links (Optional)'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isBn ? 'ফেসবুক পেজ লিংক' : 'Facebook URL'}
                    </label>
                    {siteForm.facebook_url && (
                      <button
                        type="button"
                        onClick={() => setSiteForm((prev) => ({ ...prev, facebook_url: '' }))}
                        className="text-[10px] font-bold text-rose-500 cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={siteForm.facebook_url}
                    onChange={(e) =>
                      setSiteForm((prev) => ({ ...prev, facebook_url: e.target.value }))
                    }
                    placeholder="https://facebook.com/..."
                    className={`w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isBn ? 'ইউটিউব লিংক' : 'YouTube URL'}
                    </label>
                    {siteForm.youtube_url && (
                      <button
                        type="button"
                        onClick={() => setSiteForm((prev) => ({ ...prev, youtube_url: '' }))}
                        className="text-[10px] font-bold text-rose-500 cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={siteForm.youtube_url}
                    onChange={(e) =>
                      setSiteForm((prev) => ({ ...prev, youtube_url: e.target.value }))
                    }
                    placeholder="https://youtube.com/..."
                    className={`w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isBn ? 'গুগল ম্যাপ লিংক' : 'Google Maps URL'}
                    </label>
                    {siteForm.map_url && (
                      <button
                        type="button"
                        onClick={() => setSiteForm((prev) => ({ ...prev, map_url: '' }))}
                        className="text-[10px] font-bold text-rose-500 cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={siteForm.map_url}
                    onChange={(e) => setSiteForm((prev) => ({ ...prev, map_url: e.target.value }))}
                    placeholder="https://maps.google.com/..."
                    className={`w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-[#2563EB] transition-all ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Save & Reset Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="submit"
                disabled={savingSiteInfo}
                className="h-10 px-5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {savingSiteInfo ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>{isBn ? 'তথ্য সংরক্ষণ করুন' : 'Save Website Info'}</span>
              </button>

              {confirmResetSite ? (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={savingSiteInfo}
                    onClick={handleResetSiteInfo}
                    className="h-10 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer whitespace-nowrap"
                  >
                    {isBn ? 'নিশ্চিত মুছুন' : 'Confirm Reset'}
                  </button>
                  <button
                    type="button"
                    disabled={savingSiteInfo}
                    onClick={() => setConfirmResetSite(false)}
                    className={`h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-300'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={savingSiteInfo}
                  onClick={() => setConfirmResetSite(true)}
                  className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    isDark
                      ? 'bg-rose-950/30 border-rose-800/60 text-rose-300 hover:bg-rose-950/60'
                      : 'bg-rose-50/70 border-rose-200 text-rose-600 hover:bg-rose-100'
                  }`}
                >
                  <RotateCcw size={14} />
                  <span>{isBn ? 'তথ্য মুছে ডিফল্ট করুন' : 'Reset to Default'}</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Online Admissions List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {isBn ? 'অনলাইন ভর্তি আবেদনসমূহ' : 'Online Admission Applications'}
            </h4>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums">
              ({isBn ? toBnDigit(pendingCount) : pendingCount} {isBn ? 'অপেক্ষমাণ' : 'pending'})
            </span>
          </div>
          <button
            type="button"
            onClick={fetchApplications}
            disabled={loading}
            className={`h-8 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{isBn ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
        </div>

        {/* Status Filter Segmented Bar */}
        <div
          className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100/90 border-slate-200/80'
          }`}
        >
          {[
            { id: 'pending' as const, label: isBn ? `অপেক্ষমাণ (${toBnDigit(pendingCount)})` : `Pending (${pendingCount})` },
            { id: 'rejected' as const, label: isBn ? `বাতিলকৃত (${toBnDigit(rejectedCount)})` : `Rejected (${rejectedCount})` },
            { id: 'all' as const, label: isBn ? `সকল (${toBnDigit(applications.length)})` : `All (${applications.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`h-8 px-3 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                statusFilter === tab.id
                  ? isDark
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'bg-white text-[#1E3A8A] shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-[#2563EB]" />
            <span className="text-xs font-bold text-slate-400">
              {isBn ? 'আবেদনগুলো লোড হচ্ছে...' : 'Loading applications...'}
            </span>
          </div>
        ) : errorMsg ? (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              isDark
                ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div
            className={`p-8 rounded-3xl border border-dashed text-center space-y-2 ${
              isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <UserCheck size={28} className="mx-auto text-slate-400" />
            <p className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {statusFilter === 'pending'
                ? isBn
                  ? 'কোনো পেন্ডিং অনলাইন আবেদন নেই'
                  : 'No pending online applications'
                : statusFilter === 'rejected'
                  ? isBn
                    ? 'কোনো বাতিলকৃত আবেদন নেই'
                    : 'No rejected applications'
                  : isBn
                    ? 'কোনো অনলাইন আবেদন পাওয়া যায়নি'
                    : 'No online applications found'}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              {isBn
                ? 'উপরের পাবলিক ওয়েবসাইট লিংক শেয়ার করলে নতুন ভর্তি আবেদনগুলো এখানে দেখাবে।'
                : 'Share your public portal link above to start receiving online applications here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApplications.map((app) => {
              const isBusy = processingId === app.id;
              const isConfirmingReject = confirmRejectId === app.id;
              const isConfirmingDelete = confirmDeleteId === app.id;
              const className = classesMap[app.class_id] || (isBn ? 'অনির্ধারিত শ্রেণি' : 'Unknown Class');

              return (
                <div
                  key={app.id}
                  className={`p-4 rounded-3xl border space-y-3 transition-all ${
                    isDark
                      ? 'bg-slate-800/70 border-slate-700'
                      : 'bg-white border-slate-200/80 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isSafeImageSrc(app.photo_url) ? (
                      <img
                        src={app.photo_url!}
                        alt={app.student_name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          isDark ? 'bg-slate-700 text-slate-300' : 'bg-blue-50 text-[#2563EB]'
                        }`}
                      >
                        <User size={20} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {app.student_name}
                          </h5>
                          {(app.name_en || app.student_name_en) && (
                            <p className="text-[11px] font-bold text-slate-400 truncate">
                              {app.name_en || app.student_name_en}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-black text-[#2563EB] dark:text-blue-400 block">
                            {className}
                          </span>
                          {app.status !== 'pending' && (
                            <span
                              className={`text-[10px] font-black ${
                                app.status === 'approved'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {app.status === 'approved'
                                ? isBn
                                  ? 'ভর্তি অনুমোদিত'
                                  : 'Approved'
                                : isBn
                                  ? 'বাতিলকৃত'
                                  : 'Rejected'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {app.father_name && (
                          <span>
                            {isBn ? 'পিতা:' : 'Father:'} {app.father_name}
                          </span>
                        )}
                        <a
                          href={`tel:${app.guardian_phone}`}
                          className="inline-flex items-center gap-1 text-[#059669] dark:text-emerald-400 hover:underline tabular-nums"
                        >
                          <Phone size={12} />
                          <span>{app.guardian_phone}</span>
                        </a>
                        {app.date_of_birth && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar size={12} />
                            <span>{isBn ? toBnDigit(app.date_of_birth) : app.date_of_birth}</span>
                          </span>
                        )}
                      </div>

                      {(app.address || app.previous_institution) && (
                        <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {app.address && (
                            <div className="flex items-center gap-1">
                              <MapPin size={11} className="shrink-0 text-slate-400" />
                              <span className="truncate">{app.address}</span>
                            </div>
                          )}
                          {app.previous_institution && (
                            <div className="flex items-center gap-1">
                              <Building2 size={11} className="shrink-0 text-slate-400" />
                              <span className="truncate">
                                {isBn ? 'পূর্ববর্তী প্রতিষ্ঠান:' : 'Previous:'} {app.previous_institution}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {app.created_at && (
                        <div className="mt-1.5 text-[10px] font-bold text-slate-400 tabular-nums">
                          {isBn ? 'আবেদনের তারিখ:' : 'Applied:'} {formatDateBn(app.created_at, isBn)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/70 flex flex-wrap items-center gap-2">
                    {app.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(app)}
                          className="flex-1 min-w-[140px] h-10 px-3.5 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {isBusy ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <UserCheck size={15} />
                          )}
                          <span>{isBn ? '১-ক্লিকে ভর্তি অ্যাপ্রুভ' : 'Approve & Admit'}</span>
                        </button>

                        {isConfirmingReject ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReject(app)}
                              className="h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer whitespace-nowrap"
                            >
                              {isBn ? 'নিশ্চিত বাতিল' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmRejectId(null)}
                              className={`h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                                isDark
                                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {isBn ? 'না' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setConfirmDeleteId(null);
                              setConfirmRejectId(app.id);
                            }}
                            className={`h-10 px-3 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap ${
                              isDark
                                ? 'bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-950/60'
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            <XCircle size={15} />
                            <span>{isBn ? 'বাতিল' : 'Reject'}</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Permanent Delete Button (Available on all cards) */}
                    {isConfirmingDelete ? (
                      <div className={`flex items-center gap-1.5 ${app.status !== 'pending' ? 'ml-auto' : ''}`}>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteApplication(app)}
                          className="h-10 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer whitespace-nowrap"
                        >
                          {isBn ? 'নিশ্চিত ডিলিট' : 'Confirm Delete'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteId(null)}
                          className={`h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-300'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {isBn ? 'না' : 'No'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        title={isBn ? 'স্থায়ীভাবে ডিলিট করুন' : 'Delete permanently'}
                        onClick={() => {
                          setConfirmRejectId(null);
                          setConfirmDeleteId(app.id);
                        }}
                        className={`h-10 px-3 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap ${
                          app.status !== 'pending' ? 'ml-auto' : ''
                        } ${
                          isDark
                            ? 'bg-rose-950/30 border-rose-800/60 text-rose-300 hover:bg-rose-950/60'
                            : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                      >
                        <Trash2 size={14} />
                        <span>{isBn ? 'ডিলিট' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicSiteManager;
