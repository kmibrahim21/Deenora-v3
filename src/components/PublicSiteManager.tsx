import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Share2,
  User,
  UserCheck,
  XCircle,
  AlertCircle,
  Calendar,
  Building2,
} from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language } from 'types';
import { packStudentNotesWithExtra } from 'utils/studentExtraFields';
import { isValidUUID } from 'utils/validation';
import { toBnDigit } from 'utils/calendarUtils';
import { requestManager } from 'services/RequestManager';

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
  const [classesMap, setClassesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const publicCode = useMemo(() => {
    if (!madrasah) return '';
    let cfg: any = madrasah.config_json;
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    }
    const configObj = cfg && typeof cfg === 'object' ? cfg : {};
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
    }, 3500);
  }, []);

  const fetchPendingApplications = useCallback(async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [appsRes, clsRes] = await Promise.all([
        supabase
          .from('online_admissions')
          .select('*')
          .eq('institution_id', madrasah.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100),
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
      onPendingCountChange?.(list.length);

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
            : 'Failed to load pending online admissions.'
        );
      }
      setApplications([]);
      onPendingCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [madrasah?.id, classesList, isBn, onPendingCountChange]);

  useEffect(() => {
    fetchPendingApplications();
  }, [fetchPendingApplications]);

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
        const next = prev.filter((item) => item.id !== app.id);
        onPendingCountChange?.(next.length);
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
    try {
      const { error } = await supabase
        .from('online_admissions')
        .update({ status: 'rejected' })
        .eq('id', app.id)
        .eq('institution_id', madrasah.id);

      if (error) throw error;

      setApplications((prev) => {
        const next = prev.filter((item) => item.id !== app.id);
        onPendingCountChange?.(next.length);
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

      {/* Pending Online Admissions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {isBn ? 'অপেক্ষমাণ অনলাইন ভর্তি আবেদন' : 'Pending Online Admissions'}
            </h4>
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-black tabular-nums">
              {isBn ? toBnDigit(applications.length) : applications.length}
            </span>
          </div>
          <button
            type="button"
            onClick={fetchPendingApplications}
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
        ) : applications.length === 0 ? (
          <div
            className={`p-8 rounded-3xl border border-dashed text-center space-y-2 ${
              isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <UserCheck size={28} className="mx-auto text-slate-400" />
            <p className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {isBn ? 'কোনো পেন্ডিং অনলাইন আবেদন নেই' : 'No pending online applications'}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              {isBn
                ? 'উপরের পাবলিক ওয়েবসাইট লিংক শেয়ার করলে নতুন ভর্তি আবেদনগুলো এখানে দেখাবে।'
                : 'Share your public portal link above to start receiving online applications here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const isBusy = processingId === app.id;
              const isConfirmingReject = confirmRejectId === app.id;
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
                        <span className="text-[11px] font-black text-[#2563EB] dark:text-blue-400 shrink-0">
                          {className}
                        </span>
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
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleApprove(app)}
                      className="flex-1 h-10 px-3.5 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
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
                          className="h-10 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer whitespace-nowrap"
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
                        onClick={() => setConfirmRejectId(app.id)}
                        className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap ${
                          isDark
                            ? 'bg-rose-950/30 border-rose-800/60 text-rose-300 hover:bg-rose-950/60'
                            : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                      >
                        <XCircle size={15} />
                        <span>{isBn ? 'বাতিল' : 'Reject'}</span>
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
