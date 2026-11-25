import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Phone,
  Quote,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toBnDigit } from 'utils/calendarUtils';

interface PublicInstitution {
  id: string;
  name: string;
  address: string;
  phone: string;
  contact_email: string;
  logo_url: string;
  institute_code: string;
  institution_type: string;
  public_site: {
    slug?: string;
    tagline?: string;
    about?: string;
    ticker_text?: string;
    banner_text?: string;
    admission_open?: boolean;
    admission_note?: string;
    established_year?: string;
    office_hours?: string;
    principal_name?: string;
    principal_title?: string;
    principal_message?: string;
    principal_photo_url?: string;
    hero_image_url?: string;
    gallery_urls?: string[];
    facebook_url?: string;
    youtube_url?: string;
    website_url?: string;
    map_url?: string;
  };
}

interface PublicClass {
  id: string;
  class_name: string;
}

interface PublicNotice {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

interface PublicExam {
  id: string;
  exam_name: string;
  exam_year: string;
  class_id?: string | null;
}

interface PublicTeacher {
  id: string;
  teacher_name: string;
  designation?: string;
  photo_url?: string;
}

interface PublicSitePayload {
  institution: PublicInstitution;
  classes: PublicClass[];
  notices: PublicNotice[];
  exams: PublicExam[];
  teachers?: PublicTeacher[];
  stats: {
    student_count: number;
    teacher_count: number;
  };
}

interface ResultResponse {
  student_name: string;
  roll: number;
  class_name: string;
  exam_name?: string;
  marks: Array<{
    subject_name: string;
    marks_obtained: number;
    full_marks: number;
    pass_marks?: number;
  }>;
  total_marks: number;
  max_total: number;
}

interface PublicInstitutionSiteProps {
  code: string;
}

const NAV_ITEMS = [
  { id: 'home', label: 'হোম' },
  { id: 'about', label: 'পরিচিতি' },
  { id: 'departments', label: 'বিভাগসমূহ' },
  { id: 'teachers', label: 'শিক্ষকমণ্ডলী' },
  { id: 'gallery', label: 'গ্যালারি' },
  { id: 'contact', label: 'যোগাযোগ' },
];

const HIGHLIGHTS = [
  {
    title: 'মানসম্মত পাঠদান',
    description: 'অভিজ্ঞ আলেম-ওলামা ও দক্ষ শিক্ষকমণ্ডলীর নিবিড় তত্ত্বাবধানে আধুনিক ও দ্বীনি শিক্ষা।',
    icon: GraduationCap,
    accent: 'bg-blue-50 text-[#2563EB] border-blue-100',
  },
  {
    title: 'আবাসিক ও অনাবাসিক',
    description: 'শৃঙ্খলাবদ্ধ, নিরাপদ ও মনোরম পরিবেশে আবাসিক ও অনাবাসিক পড়াশোনার সুব্যবস্থা।',
    icon: Home,
    accent: 'bg-emerald-50 text-[#059669] border-emerald-100',
  },
  {
    title: 'ডিজিটাল হাজিরা ও অ্যাপ',
    description: 'অভিভাবকদের জন্য দৈনিক উপস্থিতি, নোটিশ ও ফলাফলের রিয়েল-টাইম আপডেট।',
    icon: Smartphone,
    accent: 'bg-indigo-50 text-[#4F46E5] border-indigo-100',
  },
  {
    title: 'হিফজ ও নিয়মিত মূল্যায়ন',
    description: 'প্রতিটি শিক্ষার্থীর সাপ্তাহিক ও মাসিক পাঠ-অগ্রগতি এবং নিয়মিত পরীক্ষার মূল্যায়ন।',
    icon: BookOpen,
    accent: 'bg-amber-50 text-amber-700 border-amber-100',
  },
];

const DEPARTMENT_BADGES = [
  { label: 'বিভাগ', cls: 'bg-blue-50 text-[#2563EB] border-blue-100' },
  { label: 'জামাত', cls: 'bg-indigo-50 text-[#4F46E5] border-indigo-100' },
  { label: 'চলমান', cls: 'bg-emerald-50 text-[#059669] border-emerald-100' },
];

const FALLBACK_CAMPUS_CARDS = [
  {
    title: 'মনোরম শ্রেণিকক্ষ ও পাঠদান',
    subtitle: 'নিরিবিলি ও পরিচ্ছন্ন একাডেমিক পরিবেশ',
    gradient: 'from-[#1E3A8A] to-[#2563EB]',
    icon: BookOpen,
  },
  {
    title: 'আবাসিক ও নৈতিক চরিত্র গঠন',
    subtitle: 'সুন্নাহসম্মত ও শৃঙ্খলাবদ্ধ জীবনযাপন',
    gradient: 'from-[#059669] to-teal-700',
    icon: Home,
  },
  {
    title: 'হিফজুল কুরআন ও তাজবীদ',
    subtitle: 'দক্ষ হাফেজ ও কারীদের সরাসরি তত্ত্বাবধান',
    gradient: 'from-[#4F46E5] to-indigo-800',
    icon: Sparkles,
  },
  {
    title: 'ডিজিটাল রেজাল্ট ও অভিভাবক পোর্টাল',
    subtitle: 'যেকোনো সময় উপস্থিতি ও ফলাফল যাচাই',
    gradient: 'from-[#0F172A] to-slate-800',
    icon: Smartphone,
  },
];

function isSafeImageSrc(src?: string | null): boolean {
  if (!src) return false;
  return src.startsWith('https://') || src.startsWith('http://') || src.startsWith('data:image/');
}

function getSafeExternalUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function formatBnDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return toBnDigit(isoDate);
    return d.toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return toBnDigit(isoDate);
  }
}

async function compressPhotoUnder70KB(file: File): Promise<{ dataUrl: string; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ছবি পড়া সম্ভব হয়নি'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('সঠিক ছবি ফাইল নির্বাচন করুন'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('ব্রাউজার ক্যানভাস সাপোর্ট করছে না'));
          return;
        }

        let maxDim = 420;
        let quality = 0.82;
        let dataUrl = '';
        let byteSize = Infinity;

        for (let step = 0; step < 8; step++) {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(120, Math.round(img.width * scale));
          const h = Math.max(120, Math.round(img.height * scale));
          canvas.width = w;
          canvas.height = h;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          dataUrl = canvas.toDataURL('image/jpeg', quality);
          const commaIdx = dataUrl.indexOf(',');
          const b64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
          byteSize = Math.ceil((b64.length * 3) / 4);

          if (byteSize <= 70 * 1024) break;

          if (quality > 0.45) {
            quality = Number((quality - 0.12).toFixed(2));
          } else {
            maxDim = Math.round(maxDim * 0.78);
          }
        }

        resolve({ dataUrl, sizeKB: Math.max(1, Math.round(byteSize / 1024)) });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function generateCaptcha() {
  return {
    a: Math.floor(Math.random() * 8) + 2,
    b: Math.floor(Math.random() * 7) + 1,
  };
}

const PublicInstitutionSite: React.FC<PublicInstitutionSiteProps> = ({ code }) => {
  const [siteData, setSiteData] = useState<PublicSitePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>('home');

  // Modals
  const [activeNotice, setActiveNotice] = useState<PublicNotice | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Quick Result Checker state
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedResultClassId, setSelectedResultClassId] = useState<string>('');
  const [rollInput, setRollInput] = useState<string>('');
  const [checkingResult, setCheckingResult] = useState<boolean>(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ResultResponse | null>(null);

  // Online Admission Form state
  const [studentName, setStudentName] = useState('');
  const [studentNameEn, setStudentNameEn] = useState('');
  const [admissionClassId, setAdmissionClassId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('male');
  const [fatherName, setFatherName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');
  const [previousInstitution, setPreviousInstitution] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [photoSizeKB, setPhotoSizeKB] = useState<number>(0);
  const [photoCompressing, setPhotoCompressing] = useState<boolean>(false);
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<{
    applicationId: string;
    studentName: string;
    className: string;
  } | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Unlock native mobile & desktop scrolling while this public page is mounted
  useEffect(() => {
    document.documentElement.classList.add('public-site-scroll');
    return () => {
      document.documentElement.classList.remove('public-site-scroll');
    };
  }, []);

  const fetchSite = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorCode(null);
    try {
      const res = await fetch(`/api/public-site?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) {
        if (json?.code) setLoadErrorCode(String(json.code));
        throw new Error(json?.error || 'প্রতিষ্ঠানের তথ্য লোড করা যায়নি।');
      }
      setSiteData(json);
      if (json?.institution?.name) {
        document.title = `${json.institution.name} | অফিসিয়াল ওয়েবসাইট`;
      }
      if (json?.classes?.length > 0) {
        setSelectedResultClassId((prev) => prev || json.classes[0].id);
        setAdmissionClassId((prev) => prev || json.classes[0].id);
      }
      if (json?.exams?.length > 0) {
        setSelectedExamId((prev) => prev || json.exams[0].id);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'নেটওয়ার্ক ত্রুটি হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchSite();
  }, [fetchSite]);

  const filteredExams = useMemo(() => {
    if (!siteData?.exams) return [];
    if (!selectedResultClassId) return siteData.exams;
    const matching = siteData.exams.filter(
      (ex) => !ex.class_id || ex.class_id === selectedResultClassId
    );
    return matching.length > 0 ? matching : siteData.exams;
  }, [siteData?.exams, selectedResultClassId]);

  useEffect(() => {
    if (filteredExams.length > 0 && !filteredExams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(filteredExams[0].id);
    }
  }, [filteredExams, selectedExamId]);

  const visibleNavItems = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => item.id !== 'teachers' || (siteData?.teachers?.length ?? 0) > 0
      ),
    [siteData?.teachers?.length]
  );

  const scrollToSection = useCallback((id: string) => {
    setMobileMenuOpen(false);
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleCheckResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setResultError(null);
    setResultData(null);

    if (!selectedExamId || !selectedResultClassId || !rollInput.trim()) {
      setResultError('পরীক্ষা, শ্রেণি এবং রোল নম্বর প্রদান করুন।');
      return;
    }

    setCheckingResult(true);
    try {
      const qs = new URLSearchParams({
        action: 'result',
        code,
        examId: selectedExamId,
        classId: selectedResultClassId,
        roll: rollInput.trim(),
      });
      const res = await fetch(`/api/public-site?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'ফলাফল পাওয়া যায়নি।');
      }
      setResultData(json);
    } catch (err: any) {
      setResultError(err?.message || 'ফলাফল অনুসন্ধানে সমস্যা হয়েছে।');
    } finally {
      setCheckingResult(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError('শুধুমাত্র ছবি (JPG/PNG/WebP) আপলোড করুন।');
      return;
    }
    setSubmitError(null);
    setPhotoCompressing(true);
    try {
      const { dataUrl, sizeKB } = await compressPhotoUnder70KB(file);
      setPhotoDataUrl(dataUrl);
      setPhotoSizeKB(sizeKB);
    } catch (err: any) {
      setSubmitError(err?.message || 'ছবি প্রসেস করতে সমস্যা হয়েছে।');
    } finally {
      setPhotoCompressing(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSubmitAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteData?.institution?.id) return;
    setSubmitError(null);

    if (!studentName.trim() || studentName.trim().length < 2) {
      setSubmitError('শিক্ষার্থীর নাম সঠিকভাবে লিখুন।');
      return;
    }
    if (!admissionClassId) {
      setSubmitError('ভর্তিচ্ছু শ্রেণি নির্বাচন করুন।');
      return;
    }
    const cleanPhone = guardianPhone.trim();
    if (!cleanPhone || cleanPhone.replace(/[^\d০-৯]/g, '').length < 10) {
      setSubmitError('অভিভাবকের সঠিক মোবাইল নম্বর দিন।');
      return;
    }
    if (!captchaAnswer.trim()) {
      setSubmitError('অনুগ্রহ করে নিচের যোগফলটি লিখুন।');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_admission',
          institution_id: siteData.institution.id,
          class_id: admissionClassId,
          student_name: studentName.trim(),
          student_name_en: studentNameEn.trim(),
          date_of_birth: dateOfBirth,
          gender,
          father_name: fatherName.trim(),
          guardian_phone: cleanPhone,
          address: address.trim(),
          previous_institution: previousInstitution.trim(),
          photo_url: photoDataUrl || '',
          captchaA: captcha.a,
          captchaB: captcha.b,
          captchaAnswer: captchaAnswer.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'আবেদন জমা দেওয়া যায়নি।');
      }

      const matchedClass = siteData.classes.find((c) => c.id === admissionClassId);
      setSubmittedApplication({
        applicationId: json.applicationId || '',
        studentName: studentName.trim(),
        className: matchedClass?.class_name || '',
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'আবেদন জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      setCaptcha(generateCaptcha());
      setCaptchaAnswer('');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAdmissionForm = () => {
    setSubmittedApplication(null);
    setStudentName('');
    setStudentNameEn('');
    setDateOfBirth('');
    setGender('male');
    setFatherName('');
    setGuardianPhone('');
    setAddress('');
    setPreviousInstitution('');
    setPhotoDataUrl('');
    setPhotoSizeKB(0);
    setCaptcha(generateCaptcha());
    setCaptchaAnswer('');
    setSubmitError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-noto">
        <div className="w-12 h-12 rounded-2xl bg-[#1E3A8A]/10 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-600">প্রতিষ্ঠানের ওয়েবসাইট লোড হচ্ছে...</p>
      </div>
    );
  }

  if (loadError || !siteData) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-6 font-noto">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm space-y-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
              loadErrorCode === 'SITE_DISABLED'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <AlertCircle size={28} />
          </div>
          <h1 className="text-xl font-black text-slate-900">
            {loadErrorCode === 'SITE_DISABLED'
              ? 'পাবলিক ওয়েবসাইট চালু নেই'
              : 'প্রতিষ্ঠান খুঁজে পাওয়া যায়নি'}
          </h1>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{loadError}</p>
          <button
            type="button"
            onClick={fetchSite}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <RefreshCw size={16} />
            <span>আবার চেষ্টা করুন</span>
          </button>
        </div>
      </div>
    );
  }

  const { institution, classes, notices, exams, teachers = [], stats } = siteData;
  const ps = institution.public_site || {};
  const hasSafeLogo = isSafeImageSrc(institution.logo_url) && !logoError;
  const headerAddress = (institution.address || '').trim();
  const isAdmissionOpen = ps.admission_open !== false;
  const admissionNote = (ps.admission_note || '').trim();
  const aboutText = (ps.about || '').trim();
  const establishedYear = (ps.established_year || '').trim();
  const officeHours = (ps.office_hours || '').trim();
  const tickerText =
    (ps.ticker_text || '').trim() ||
    notices[0]?.title ||
    (isAdmissionOpen
      ? 'অনলাইন ভর্তি কার্যক্রম চলছে — ঘরে বসেই আবেদন করুন'
      : 'প্রতিষ্ঠানের অফিসিয়াল পোর্টালে স্বাগতম');

  const heroImageUrl = isSafeImageSrc(ps.hero_image_url) ? ps.hero_image_url!.trim() : '';
  const principalName = (ps.principal_name || '').trim();
  const principalTitle = (ps.principal_title || '').trim() || 'মুহতামিম / অধ্যক্ষ';
  const principalMessage = (ps.principal_message || '').trim();
  const principalPhotoUrl = isSafeImageSrc(ps.principal_photo_url)
    ? ps.principal_photo_url!.trim()
    : '';
  const galleryUrls = Array.isArray(ps.gallery_urls)
    ? ps.gallery_urls.filter((u) => isSafeImageSrc(u)).slice(0, 4)
    : [];

  const facebookUrl = getSafeExternalUrl(ps.facebook_url);
  const youtubeUrl = getSafeExternalUrl(ps.youtube_url);
  const mapUrl = getSafeExternalUrl(ps.map_url);
  const googleMapFallbackUrl =
    mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [institution.name, institution.address].filter(Boolean).join(' ')
    )}`;

  const resultPercentage =
    resultData && resultData.max_total > 0
      ? Math.round((resultData.total_marks / resultData.max_total) * 100)
      : 0;

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-slate-900 font-noto overflow-x-clip selection:bg-[#2563EB]/15 selection:text-[#1E3A8A]">
      {/* Section 1A — Slim Dark Notice Ticker Bar */}
      <div className="w-full bg-[#0B1736] text-white text-xs py-2 px-3 sm:px-6 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <button
            type="button"
            onClick={() => (notices[0] ? setActiveNotice(notices[0]) : scrollToSection('notices'))}
            className="inline-flex items-center justify-center gap-2 sm:gap-2.5 min-w-0 max-w-full group cursor-pointer"
          >
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#0F9D6E] text-white text-[11px] font-bold shrink-0 shadow-xs">
              নোটিশ
            </span>
            <span className="truncate text-[12px] sm:text-[13px] font-medium text-white/95 group-hover:text-white transition-colors">
              {tickerText}
            </span>
          </button>
        </div>
      </div>

      {/* Section 1B — Minimal Premium Single-Row Glass Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.14)]">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2.5 lg:py-3 flex items-center justify-between gap-2.5 lg:gap-6">
          {/* Brand Zone — Circular Logo + 2-Line Title + Green Address */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('home');
            }}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 lg:flex-initial lg:max-w-[320px]"
          >
            {hasSafeLogo ? (
              <img
                src={institution.logo_url}
                alt={institution.name}
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-slate-200/90 bg-white shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#1D4ED8] text-white flex items-center justify-center shrink-0 shadow-xs">
                <GraduationCap size={20} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="block text-[13.5px] sm:text-[15px] font-extrabold text-[#0F172A] leading-[1.2] line-clamp-2">
                {institution.name}
              </span>
              {headerAddress && (
                <span className="mt-0.5 block text-[10.5px] sm:text-[11.5px] font-bold text-[#059669] leading-tight truncate">
                  {headerAddress}
                </span>
              )}
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-[14px] font-bold">
            {visibleNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.id);
                }}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                  activeNav === item.id
                    ? 'text-[#1D4ED8]'
                    : 'text-slate-800 hover:text-[#1D4ED8]'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Primary Pill CTA + Mobile Hamburger Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scrollToSection('admission')}
              className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-[#1D4ED8] hover:bg-[#1E3A8A] text-white text-[13px] sm:text-sm font-bold shadow-sm shadow-blue-700/25 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer inline-flex items-center justify-center"
            >
              <span className="sm:hidden">ভর্তি</span>
              <span className="hidden sm:inline">অনলাইন ভর্তি</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="মেনু"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-9 h-9 rounded-xl border border-slate-200/90 bg-white text-slate-700 hover:text-[#1D4ED8] hover:border-blue-200 shadow-2xs inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Quick Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
              {visibleNavItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(item.id);
                  }}
                  className={`h-10 px-3 rounded-xl text-xs font-black flex items-center justify-center transition-colors whitespace-nowrap ${
                    activeNav === item.id
                      ? 'bg-blue-50 text-[#1D4ED8]'
                      : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1D4ED8]'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Section 2 — Split Editorial Hero (#home) + Live Quick Result Checker Widget (#results) */}
      <section
        id="home"
        className="relative w-full overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/70 border-b border-slate-200/70 scroll-mt-16"
      >
        {/* Subtle decorative background accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-200/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-emerald-200/25 blur-3xl"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left Column — Editorial Pitch & KPI Stats */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">
              {/* Top Meta Pills */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-bold">
                {isAdmissionOpen ? (
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#059669] shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span>অনলাইন ভর্তি চলছে</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shadow-xs">
                    <Lock size={12} className="shrink-0" />
                    <span>ভর্তি বর্তমানে বন্ধ</span>
                  </span>
                )}

                {establishedYear && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[#1E3A8A] shadow-xs">
                    <span>স্থাপিত: {toBnDigit(establishedYear)}</span>
                  </span>
                )}

                {institution.address && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200/80 text-slate-600 max-w-full">
                    <MapPin size={13} className="text-[#2563EB] shrink-0" />
                    <span className="truncate">{institution.address}</span>
                  </span>
                )}
              </div>

              {/* Bold Headline */}
              <h1
                className="text-center lg:text-left text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-[1.18] tracking-tight text-[#0F172A]"
                style={{ textWrap: 'balance' }}
              >
                {institution.name}
              </h1>

              {/* Tagline */}
              <p className="text-center lg:text-left mx-auto lg:mx-0 text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-2xl font-medium">
                {ps.tagline ||
                  'দ্বীনি ও আধুনিক শিক্ষার সমন্বয়ে নৈতিক ও আদর্শ মানুষ গড়ার নির্ভরযোগ্য প্রতিষ্ঠান। অনলাইনে ভর্তি আবেদন, সর্বশেষ নোটিশ ও পরীক্ষার ফলাফল জানুন মুহূর্তেই।'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center lg:justify-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => scrollToSection('admission')}
                  className="w-full sm:w-auto justify-center h-12 px-6 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-black text-sm inline-flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  <UserPlus size={18} />
                  <span>{isAdmissionOpen ? 'অনলাইন ভর্তি আবেদন' : 'ভর্তি তথ্য দেখুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('notices')}
                  className="w-full sm:w-auto justify-center h-12 px-6 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#1E3A8A] font-black text-sm inline-flex items-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  <Bell size={18} className="text-[#059669]" />
                  <span>নোটিশ দেখুন</span>
                </button>
              </div>

              {/* 3 Compact Stat Pills */}
              <div className="pt-2 grid grid-cols-3 gap-2.5 sm:gap-4 max-w-xl mx-auto lg:mx-0">
                <div className="rounded-2xl bg-white border border-slate-200/80 p-3 sm:p-4 shadow-xs text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-between gap-2">
                    <span className="text-lg sm:text-2xl font-black tabular-nums leading-none text-[#1E3A8A]">
                      {toBnDigit(stats.student_count)}+
                    </span>
                    <Users size={17} className="hidden sm:block text-[#2563EB] shrink-0" />
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-slate-500 mt-1.5">
                    মোট শিক্ষার্থী
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200/80 p-3 sm:p-4 shadow-xs text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-between gap-2">
                    <span className="text-lg sm:text-2xl font-black tabular-nums leading-none text-[#059669]">
                      {toBnDigit(stats.teacher_count)}+
                    </span>
                    <GraduationCap size={17} className="hidden sm:block text-[#10B981] shrink-0" />
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-slate-500 mt-1.5">
                    অভিজ্ঞ শিক্ষক
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200/80 p-3 sm:p-4 shadow-xs text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-between gap-2">
                    <span className="text-lg sm:text-2xl font-black tabular-nums leading-none text-[#4F46E5]">
                      {toBnDigit(classes.length)}
                    </span>
                    <BookOpen size={17} className="hidden sm:block text-[#4F46E5] shrink-0" />
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-slate-500 mt-1.5">
                    বিভাগ ও শ্রেণি
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column — Campus Visual Card + Live Quick Result Checker Widget */}
            <div className="lg:col-span-5 space-y-4">
              {/* Campus Visual Card */}
              <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 shadow-xl shadow-blue-950/10 bg-white">
                {heroImageUrl ? (
                  <div className="relative aspect-[16/10] w-full bg-slate-100">
                    <img
                      src={heroImageUrl}
                      alt={institution.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 via-[#0F172A]/20 to-transparent" />
                    <div className="absolute bottom-3.5 left-4 right-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 text-white">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-300">অফিসিয়াল ক্যাম্পাস</p>
                        <p className="text-sm font-black leading-snug line-clamp-2 sm:truncate">{institution.name}</p>
                      </div>
                      {institution.phone && (
                        <a
                          href={`tel:${institution.phone}`}
                          className="self-start sm:self-auto h-8 px-3 rounded-xl bg-white/95 hover:bg-white text-[#1E3A8A] text-xs font-black inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm"
                        >
                          <Phone size={12} className="text-[#059669]" />
                          <span className="tabular-nums">কল করুন</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative p-6 sm:p-7 bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#4F46E5] text-white overflow-hidden">
                    <svg
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.12]"
                      xmlns="http://www.w3.org/2000/svg"
                      preserveAspectRatio="xMidYMid slice"
                      viewBox="0 0 400 240"
                    >
                      <defs>
                        <pattern id="hero-card-arch" width="80" height="100" patternUnits="userSpaceOnUse">
                          <path
                            d="M40 10 C60 28 72 50 72 95 L8 95 C8 50 20 28 40 10 Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#hero-card-arch)" />
                    </svg>
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-black text-emerald-200">
                          <ShieldCheck size={13} />
                          <span>ডিজিটাল শিক্ষাঙ্গন</span>
                        </span>
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-black leading-snug">
                          {institution.name}
                        </h2>
                        {institution.address && (
                          <p className="text-xs text-blue-100/90 mt-1 flex items-start gap-1.5 leading-relaxed">
                            <MapPin size={13} className="shrink-0 mt-0.5 text-emerald-300" />
                            <span>{institution.address}</span>
                          </p>
                        )}
                      </div>
                      {institution.phone && (
                        <div className="pt-1 flex flex-wrap items-center gap-2.5">
                          <a
                            href={`tel:${institution.phone}`}
                            className="h-9 px-4 rounded-xl bg-white hover:bg-emerald-50 text-[#1E3A8A] text-xs font-black inline-flex items-center gap-1.5 shadow-sm transition-colors"
                          >
                            <Phone size={13} className="text-[#059669]" />
                            <span className="tabular-nums">{institution.phone}</span>
                          </a>
                          {officeHours && (
                            <span className="text-[11px] font-bold text-blue-100 inline-flex items-center gap-1">
                              <Clock size={12} className="text-emerald-300" />
                              <span>{officeHours}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Quick Result Checker Widget (#results) */}
              <div
                id="results"
                className="scroll-mt-20 bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-900/5 p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-[#059669] flex items-center justify-center shrink-0">
                      <Award size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-black text-[#1E3A8A]">
                        অনলাইন রেজাল্ট চেকার
                      </h2>
                      <p className="text-[11px] text-slate-500 font-medium">
                        শ্রেণি, পরীক্ষা ও রোল দিয়ে তাৎক্ষণিক ফলাফল
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCheckResult} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        শ্রেণি / জামাত
                      </label>
                      <select
                        value={selectedResultClassId}
                        onChange={(e) => {
                          setSelectedResultClassId(e.target.value);
                          setResultData(null);
                          setResultError(null);
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      >
                        {classes.length === 0 ? (
                          <option value="">কোনো শ্রেণি পাওয়া যায়নি</option>
                        ) : (
                          classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.class_name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        পরীক্ষা নির্বাচন করুন
                      </label>
                      <select
                        value={selectedExamId}
                        onChange={(e) => {
                          setSelectedExamId(e.target.value);
                          setResultData(null);
                          setResultError(null);
                        }}
                        disabled={filteredExams.length === 0}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all disabled:opacity-60"
                      >
                        {filteredExams.length === 0 ? (
                          <option value="">পরীক্ষা প্রকাশিত নয়</option>
                        ) : (
                          filteredExams.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.exam_name}
                              {ex.exam_year ? ` (${toBnDigit(ex.exam_year)})` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rollInput}
                      onChange={(e) => setRollInput(e.target.value)}
                      placeholder="রোল নম্বর লিখুন (যেমন: ১)"
                      className="flex-1 min-w-0 h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white tabular-nums transition-all"
                    />
                    <button
                      type="submit"
                      disabled={checkingResult || exams.length === 0}
                      className="h-10 px-4 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      {checkingResult ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Search size={15} />
                      )}
                      <span>রেজাল্ট দেখুন</span>
                    </button>
                  </div>
                </form>

                {resultError && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{resultError}</span>
                  </div>
                )}

                {resultData && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-emerald-50/70 border border-blue-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-[#1E3A8A] truncate">
                          {resultData.student_name}
                        </h4>
                        <p className="text-[11px] text-slate-600 font-bold tabular-nums mt-0.5">
                          {resultData.class_name} · রোল: {toBnDigit(resultData.roll)}
                          {resultData.exam_name ? ` · ${resultData.exam_name}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm sm:text-base font-black text-[#059669] tabular-nums leading-tight">
                          {toBnDigit(resultData.total_marks)} / {toBnDigit(resultData.max_total)}
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 tabular-nums">
                          {toBnDigit(resultPercentage)}% নম্বর
                        </div>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
                      {resultData.marks.map((m, idx) => (
                        <div
                          key={`${m.subject_name}-${idx}`}
                          className="px-3.5 py-2 flex items-center justify-between text-xs bg-white odd:bg-slate-50/60"
                        >
                          <span className="font-bold text-slate-700 truncate pr-3">{m.subject_name}</span>
                          <span className="font-black text-slate-900 tabular-nums shrink-0">
                            {toBnDigit(m.marks_obtained)} / {toBnDigit(m.full_marks)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Why Choose Us (4 Pillars) + About & Principal's Message (#features & #about) */}
      <section id="features" className="w-full bg-white border-b border-slate-200/70 py-14 sm:py-18 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-14">
          {/* 4-Pillar Highlights */}
          <div>
            <div className="max-w-2xl mb-7 sm:mb-9">
              <h2 className="text-2xl sm:text-3xl font-black text-[#1E3A8A] tracking-tight">
                আমাদের বৈশিষ্ট্যসমূহ
              </h2>
              <p className="text-sm sm:text-base text-slate-500 font-medium mt-1.5 leading-relaxed">
                সুশৃঙ্খল শিক্ষা পরিবেশ, আধুনিক ডিজিটাল ব্যবস্থাপনা এবং শিক্ষার্থীদের সার্বিক মানোন্নয়নে আমাদের অঙ্গীকার।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="p-5 sm:p-6 rounded-3xl bg-[#F8FAFC] border border-slate-200/80 hover:border-blue-200 hover:bg-white hover:shadow-md hover:shadow-blue-900/5 transition-all space-y-3.5"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${item.accent}`}
                    >
                      <Icon size={21} />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-black text-slate-900">{item.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-Column About Institution + Principal's Message (#about) */}
          <div id="about" className="scroll-mt-20 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
            {/* Institution About Card */}
            <div
              className={`${
                principalMessage || principalName || principalPhotoUrl
                  ? 'lg:col-span-6'
                  : 'lg:col-span-12'
              } rounded-3xl bg-[#F8FAFC] border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between gap-5 relative overflow-hidden`}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#1E3A8A] via-[#2563EB] to-[#10B981]" />
              <div className="pl-2 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-[#1E3A8A]">
                        প্রতিষ্ঠান পরিচিতি
                      </h3>
                      {establishedYear && (
                        <p className="text-xs font-bold text-[#059669]">
                          স্থাপিত: {toBnDigit(establishedYear)}
                        </p>
                      )}
                    </div>
                  </div>

                  {officeHours && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600">
                      <Clock size={13} className="text-[#2563EB]" />
                      <span>{officeHours}</span>
                    </span>
                  )}
                </div>

                <p className="text-sm sm:text-[15px] text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                  {aboutText ||
                    `${institution.name} একটি আদর্শ দ্বীনি ও আধুনিক শিক্ষা প্রতিষ্ঠান। যোগ্য ও অভিজ্ঞ শিক্ষকমণ্ডলীর নিবিড় তত্ত্বাবধানে এখানে কুরআন-হাদিসের সহিহ তালিমের পাশাপাশি সময়োপযোগী সাধারণ শিক্ষা প্রদান করা হয়।`}
                </p>
              </div>
            </div>

            {/* Principal's Message & Portrait Card */}
            {(principalMessage || principalName || principalPhotoUrl) && (
              <div className="lg:col-span-6 rounded-3xl bg-gradient-to-br from-slate-50 via-white to-blue-50/50 border border-blue-100 p-6 sm:p-8 flex flex-col justify-between gap-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-blue-50 flex items-center justify-center shrink-0">
                    {principalPhotoUrl ? (
                      <img
                        src={principalPhotoUrl}
                        alt={principalName || principalTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={34} className="text-[#2563EB]" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#2563EB]">
                      <Quote size={14} />
                      <span>মুহতামিম / অধ্যক্ষের বাণী</span>
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                      {principalMessage
                        ? `"${principalMessage}"`
                        : 'জ্ঞান, আমল ও উত্তম চরিত্রের সমন্বয়ে একটি আদর্শ প্রজন্ম গড়ে তোলাই আমাদের মূল লক্ষ্য।'}
                    </p>
                  </div>
                </div>

                {(principalName || principalTitle) && (
                  <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <div>
                      {principalName && (
                        <div className="text-sm sm:text-base font-black text-[#1E3A8A]">
                          {principalName}
                        </div>
                      )}
                      <div className="text-xs font-bold text-[#059669]">{principalTitle}</div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 truncate max-w-[180px]">
                      {institution.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 4 — Departments Showcase (#departments) + Latest Notice Board (#notices) */}
      <section className="w-full bg-[#F8FAFC] py-14 sm:py-18 border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-14">
          {/* Departments & Classes Showcase (#departments) */}
          <div id="departments" className="scroll-mt-20">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7 sm:mb-9">
              <div className="max-w-2xl">
                <h2 className="text-2xl sm:text-3xl font-black text-[#1E3A8A] tracking-tight">
                  বিভাগ ও শ্রেণিসমূহ
                </h2>
                <p className="text-sm sm:text-base text-slate-500 font-medium mt-1.5 leading-relaxed">
                  আমাদের প্রতিষ্ঠানে চালু থাকা সকল শ্রেণি ও বিভাগ। পছন্দসই বিভাগে ১-ক্লিকে ভর্তি আবেদন করুন।
                </p>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-500 tabular-nums shrink-0">
                মোট {toBnDigit(classes.length)} টি শ্রেণি চালু রয়েছে
              </div>
            </div>

            {classes.length === 0 ? (
              <div className="py-12 rounded-3xl border border-dashed border-slate-200 bg-white text-center space-y-2">
                <BookOpen size={28} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-500">শ্রেণির তালিকা এখনো যুক্ত করা হয়নি।</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {classes.map((cls, idx) => {
                  const badge = DEPARTMENT_BADGES[idx % DEPARTMENT_BADGES.length];
                  return (
                    <div
                      key={cls.id}
                      className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 hover:border-[#2563EB] hover:shadow-md hover:shadow-blue-900/5 transition-all flex flex-col justify-between gap-4 group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                            <BookOpen size={17} />
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-slate-800 group-hover:text-[#1E3A8A] leading-snug">
                          {cls.class_name}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAdmissionClassId(cls.id);
                          scrollToSection('admission');
                        }}
                        className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 text-[#2563EB] text-xs font-black inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <span>ভর্তি আবেদন</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Latest Notice Board (#notices) */}
          <div
            id="notices"
            className="scroll-mt-20 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#1E3A8A]">সর্বশেষ নোটিশ বোর্ড</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    বিস্তারিত পড়তে যেকোনো নোটিশে ক্লিক করুন
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">
                মোট {toBnDigit(notices.length)} টি নোটিশ
              </span>
            </div>

            {notices.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <FileText size={30} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-500">এখনো কোনো পাবলিক নোটিশ প্রকাশিত হয়নি।</p>
                <p className="text-xs text-slate-400">নতুন ঘোষণা প্রকাশ হলে এখানে দেখতে পাবেন।</p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {notices.slice(0, 6).map((notice) => (
                  <button
                    key={notice.id}
                    type="button"
                    onClick={() => setActiveNotice(notice)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200/70 bg-[#F8FAFC] hover:bg-blue-50/50 hover:border-blue-200 transition-all group cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm sm:text-[15px] font-black text-slate-800 group-hover:text-[#1E3A8A] line-clamp-1">
                          {notice.title}
                        </h3>
                        <ChevronRight
                          size={16}
                          className="text-slate-300 group-hover:text-[#2563EB] shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5"
                        />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {notice.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#059669] tabular-nums pt-1">
                      <Clock size={12} />
                      <span>{formatBnDate(notice.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 5 — Teachers / Ustad Row (#teachers) + Campus Photo Gallery (#gallery) */}
      <section className="w-full bg-white border-b border-slate-200/70 py-14 sm:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-14">
          {/* Teachers / Ustad Row (#teachers) */}
          {teachers.length > 0 && (
            <div id="teachers" className="scroll-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1E3A8A] tracking-tight">
                    সম্মানিত শিক্ষকমণ্ডলী / উস্তাদবৃন্দ
                  </h2>
                  <p className="text-sm sm:text-base text-slate-500 font-medium mt-1.5">
                    অভিজ্ঞ ও নিবেদিতপ্রাণ শিক্ষকদের তত্ত্বাবধানে পরিচালিত পাঠদান।
                  </p>
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-500 tabular-nums shrink-0">
                  মোট {toBnDigit(stats.teacher_count)} জন শিক্ষক
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-5">
                {teachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="p-4 sm:p-5 rounded-3xl bg-[#F8FAFC] border border-slate-200/80 hover:border-blue-200 hover:bg-white hover:shadow-md hover:shadow-blue-900/5 transition-all text-center space-y-3"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto overflow-hidden border-2 border-white shadow-sm bg-blue-50 flex items-center justify-center">
                      {teacher.photo_url && isSafeImageSrc(teacher.photo_url) ? (
                        <img
                          src={teacher.photo_url}
                          alt={teacher.teacher_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={26} className="text-[#2563EB]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 line-clamp-1">
                        {teacher.teacher_name}
                      </h3>
                      <p className="text-xs font-bold text-[#059669] mt-0.5 line-clamp-1">
                        {teacher.designation || 'শিক্ষক'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campus Photo Gallery (#gallery) */}
          <div id="gallery" className="scroll-mt-20">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-[#1E3A8A] tracking-tight">
                  ক্যাম্পাস ফটো গ্যালারি
                </h2>
                <p className="text-sm sm:text-base text-slate-500 font-medium mt-1.5">
                  আমাদের মাদরাসা ভবন, শ্রেণিকক্ষ ও শিক্ষা কার্যক্রমের এক ঝলক।
                </p>
              </div>
              {galleryUrls.length > 0 && (
                <span className="text-xs font-bold text-slate-400">
                  বড় করে দেখতে যেকোনো ছবিতে ট্যাপ করুন
                </span>
              )}
            </div>

            {galleryUrls.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {galleryUrls.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxImage(imgUrl)}
                    className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs hover:shadow-lg transition-all cursor-pointer"
                  >
                    <img
                      src={imgUrl}
                      alt={`${institution.name} ক্যাম্পাস ${toBnDigit(idx + 1)}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/25 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-white/90 text-[#1E3A8A] flex items-center justify-center shadow-sm">
                        <ImageIcon size={17} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {FALLBACK_CAMPUS_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className={`p-5 rounded-2xl bg-gradient-to-br ${card.gradient} text-white flex flex-col justify-between gap-4 min-h-[140px] shadow-sm`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black leading-snug">{card.title}</h3>
                        <p className="text-[11px] text-white/80 font-medium mt-1 leading-relaxed">
                          {card.subtitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 6 — Online Admission Portal Card (#admission) */}
      <section id="admission" className="w-full bg-[#F8FAFC] py-14 sm:py-18 scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          {/* Gradient Banner Header matching Option 3 Design */}
          <div className="rounded-3xl bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#4F46E5] text-white p-6 sm:p-8 shadow-lg shadow-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-black text-emerald-200">
                <UserPlus size={12} />
                <span>{isAdmissionOpen ? 'অনলাইন ভর্তি আবেদন ফরম' : 'ভর্তি সংক্রান্ত তথ্য'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                অনলাইন ভর্তি পোর্টাল
              </h2>
              <p className="text-xs sm:text-sm text-blue-100/90 font-medium leading-relaxed">
                সঠিক তথ্য দিয়ে নিচের ফরমটি পূরণ করুন। অফিস থেকে যাচাই করে আপনার সাথে যোগাযোগ করা হবে।
              </p>
            </div>
            {institution.phone && (
              <a
                href={`tel:${institution.phone}`}
                className="h-11 px-5 rounded-xl bg-white hover:bg-emerald-50 text-[#1E3A8A] text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shrink-0 shadow-sm transition-colors"
              >
                <Phone size={15} className="text-[#059669]" />
                <span className="tabular-nums">{institution.phone}</span>
              </a>
            )}
          </div>

          {/* Form Body / Closed Gate */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-900/5 border border-slate-200/80 p-5 sm:p-8 lg:p-10">
            {!isAdmissionOpen ? (
              <div className="rounded-3xl bg-amber-50/70 border border-amber-200/80 p-6 sm:p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto">
                  <Lock size={28} />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    বর্তমানে অনলাইন ভর্তি কার্যক্রম বন্ধ রয়েছে
                  </h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    পরবর্তী ভর্তি বিজ্ঞপ্তি অথবা সরাসরি ভর্তি সংক্রান্ত তথ্যের জন্য প্রতিষ্ঠানের অফিসে যোগাযোগ করুন।
                  </p>
                </div>

                {admissionNote && (
                  <div className="max-w-md mx-auto px-4 py-3 rounded-2xl bg-white border border-amber-200 text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
                    {admissionNote}
                  </div>
                )}

                {institution.phone && (
                  <div className="pt-1">
                    <a
                      href={`tel:${institution.phone}`}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white text-sm font-black shadow-sm transition-colors"
                    >
                      <Phone size={16} />
                      <span>কল করুন:</span>
                      <span className="tabular-nums">{institution.phone}</span>
                    </a>
                  </div>
                )}
              </div>
            ) : submittedApplication ? (
              <div className="rounded-3xl bg-emerald-50/70 border border-emerald-200 p-6 sm:p-8 text-center space-y-5 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-[#059669] text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-600/20">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl sm:text-2xl font-black text-emerald-950">
                    আপনার ভর্তি আবেদন সফলভাবে জমা হয়েছে!
                  </h3>
                  <p className="text-sm text-emerald-800 font-medium">
                    শিক্ষার্থী: <span className="font-black">{submittedApplication.studentName}</span>
                    {submittedApplication.className ? ` · শ্রেণি: ${submittedApplication.className}` : ''}
                  </p>
                </div>

                {submittedApplication.applicationId && (
                  <div className="inline-block px-5 py-3 rounded-2xl bg-white border border-emerald-200">
                    <div className="text-[11px] font-bold text-slate-500">আবেদন আইডি (Application ID)</div>
                    <div className="text-base sm:text-lg font-black text-[#1E3A8A] font-mono tabular-nums mt-0.5">
                      {submittedApplication.applicationId.slice(0, 8).toUpperCase()}
                    </div>
                  </div>
                )}

                {institution.phone && (
                  <div className="pt-1">
                    <p className="text-xs font-bold text-slate-600 mb-2">
                      জরুরি প্রয়োজনে প্রতিষ্ঠানের সাথে যোগাযোগ করুন:
                    </p>
                    <a
                      href={`tel:${institution.phone}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white text-sm font-black transition-colors"
                    >
                      <Phone size={16} />
                      <span className="tabular-nums">{institution.phone}</span>
                    </a>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={resetAdmissionForm}
                    className="text-xs sm:text-sm font-black text-[#2563EB] hover:underline cursor-pointer"
                  >
                    আরেকজন শিক্ষার্থীর আবেদন করুন
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAdmission} className="space-y-7">
                {admissionNote && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/90 border border-blue-200/80 text-[#1E3A8A] text-xs sm:text-sm font-bold flex items-start gap-2.5 leading-relaxed">
                    <Info size={18} className="text-[#2563EB] shrink-0 mt-0.5" />
                    <span>{admissionNote}</span>
                  </div>
                )}

                {submitError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={17} className="shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Group 1 — ছবি আপলোড */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-[#1E3A8A] pb-2 border-b border-slate-100">
                    ১. শিক্ষার্থীর ছবি (ঐচ্ছিক)
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {photoDataUrl && isSafeImageSrc(photoDataUrl) ? (
                        <img
                          src={photoDataUrl}
                          alt="শিক্ষার্থীর ছবি"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera size={24} className="text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-600 font-medium">
                        পাসপোর্ট সাইজের পরিষ্কার ছবি দিন। আপলোডের আগে স্বয়ংক্রিয়ভাবে কমপ্রেস (৭০ KB-এর নিচে) করা হবে।
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                          id="public-admission-photo"
                        />
                        <label
                          htmlFor="public-admission-photo"
                          className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 hover:border-[#2563EB] text-xs font-black text-slate-700 hover:text-[#2563EB] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          {photoCompressing ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Camera size={14} />
                          )}
                          <span>{photoDataUrl ? 'ছবি পরিবর্তন করুন' : 'ছবি নির্বাচন করুন'}</span>
                        </label>
                        {photoDataUrl && (
                          <>
                            <span className="text-[11px] font-bold text-[#059669] tabular-nums">
                              প্রস্তুত ({toBnDigit(photoSizeKB)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoDataUrl('');
                                setPhotoSizeKB(0);
                              }}
                              className="h-9 px-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={14} />
                              <span>মুছুন</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 2 — শিক্ষার্থীর তথ্য */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-[#1E3A8A] pb-2 border-b border-slate-100">
                    ২. শিক্ষার্থীর তথ্য
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        শিক্ষার্থীর নাম <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="বাংলায় পূর্ণ নাম লিখুন"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        ইংরেজি নাম
                      </label>
                      <input
                        type="text"
                        value={studentNameEn}
                        onChange={(e) => setStudentNameEn(e.target.value)}
                        placeholder="Full Name in English"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        ভর্তিচ্ছু শ্রেণি <span className="text-rose-600">*</span>
                      </label>
                      <select
                        required
                        value={admissionClassId}
                        onChange={(e) => setAdmissionClassId(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      >
                        <option value="">শ্রেণি নির্বাচন করুন</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        জন্ম তারিখ
                      </label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white tabular-nums transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">লিঙ্গ</label>
                      <div className="grid grid-cols-2 gap-2.5 max-w-xs">
                        <button
                          type="button"
                          onClick={() => setGender('male')}
                          className={`h-10 rounded-xl border text-xs sm:text-sm font-black transition-all cursor-pointer ${
                            gender === 'male'
                              ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-200'
                          }`}
                        >
                          ছাত্র (পুরুষ)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender('female')}
                          className={`h-10 rounded-xl border text-xs sm:text-sm font-black transition-all cursor-pointer ${
                            gender === 'female'
                              ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-200'
                          }`}
                        >
                          ছাত্রী (মহিলা)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 3 — অভিভাবক ও ঠিকানা */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-[#1E3A8A] pb-2 border-b border-slate-100">
                    ৩. অভিভাবক ও ঠিকানা
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        পিতার নাম
                      </label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="পিতার পূর্ণ নাম"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        অভিভাবকের মোবাইল নম্বর <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        inputMode="tel"
                        value={guardianPhone}
                        onChange={(e) => setGuardianPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white tabular-nums transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        বর্তমান ঠিকানা
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="গ্রাম/মহল্লা, ডাকঘর, উপজেলা, জেলা"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        পূর্ববর্তী প্রতিষ্ঠান (যদি থাকে)
                      </label>
                      <input
                        type="text"
                        value={previousInstitution}
                        onChange={(e) => setPreviousInstitution(e.target.value)}
                        placeholder="পূর্ববর্তী মাদরাসা বা স্কুলের নাম"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Security Captcha & Submit */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      নিরাপত্তা যাচাই:
                    </span>
                    <span className="text-sm font-black text-[#1E3A8A] tabular-nums whitespace-nowrap">
                      {toBnDigit(captcha.a)} + {toBnDigit(captcha.b)} =
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="?"
                      aria-label="যোগফল লিখুন"
                      className="w-16 h-9 px-2.5 rounded-xl border border-slate-300 bg-white text-center text-sm font-black text-slate-900 tabular-nums outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCaptcha(generateCaptcha());
                        setCaptchaAnswer('');
                      }}
                      title="নতুন প্রশ্ন"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-white transition-colors cursor-pointer"
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || photoCompressing}
                    className="h-12 px-7 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-emerald-700 hover:to-emerald-600 text-white text-sm font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>জমা হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        <span>আবেদন জমা দিন</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Section 7 — Ultra-Compact 2-Column Dark Navy Footer (#contact) */}
      <footer id="contact" className="w-full bg-[#0F172A] text-slate-300 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-start">
            {/* Left Zone — Institution Brand, Summary & Action Pills */}
            <div className="lg:col-span-6 text-center lg:text-left flex flex-col items-center lg:items-start space-y-3.5">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {hasSafeLogo ? (
                  <img
                    src={institution.logo_url}
                    alt={institution.name}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-slate-700 bg-white shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <GraduationCap size={20} />
                  </div>
                )}
                <h3 className="text-base sm:text-lg font-black text-white leading-snug">
                  {institution.name}
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-2 max-w-lg">
                {aboutText ||
                  ps.tagline ||
                  'দ্বীনি ও আধুনিক শিক্ষার মানোন্নয়নে নিবেদিত একটি আদর্শ শিক্ষা প্রতিষ্ঠান।'}
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-[#1877F2] border border-slate-700/80 text-slate-200 hover:text-white text-xs font-bold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
                    </svg>
                    <span>ফেসবুক</span>
                  </a>
                )}
                {youtubeUrl && (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-[#FF0000] border border-slate-700/80 text-slate-200 hover:text-white text-xs font-bold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3.01 3.01 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.85 12 9.6 15.6Z" />
                    </svg>
                    <span>ইউটিউব</span>
                  </a>
                )}
                <a
                  href={googleMapFallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-600 border border-emerald-400/30 text-emerald-300 hover:text-white text-xs font-bold transition-colors"
                >
                  <MapPin size={13} className="shrink-0" />
                  <span>গুগল ম্যাপ</span>
                </a>
              </div>
            </div>

            {/* Right Zone — Quick Links & Direct Contact Side-by-Side */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-6">
              {/* Column A — Quick Links */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-white">গুরুত্বপূর্ণ লিংক</h4>
                <ul className="space-y-2 text-xs sm:text-sm font-medium text-slate-400">
                  <li>
                    <a
                      href="#home"
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection('home');
                      }}
                      className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                    >
                      <ChevronRight size={14} className="text-[#2563EB] shrink-0" />
                      <span>হোম</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#notices"
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection('notices');
                      }}
                      className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                    >
                      <ChevronRight size={14} className="text-[#2563EB] shrink-0" />
                      <span>নোটিশ বোর্ড</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#results"
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection('results');
                      }}
                      className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                    >
                      <ChevronRight size={14} className="text-[#2563EB] shrink-0" />
                      <span>ফলাফল</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#admission"
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection('admission');
                      }}
                      className="hover:text-emerald-300 text-emerald-400 font-bold transition-colors inline-flex items-center gap-1.5"
                    >
                      <ChevronRight size={14} className="shrink-0" />
                      <span>অনলাইন ভর্তি</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column B — Contact */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-white">যোগাযোগ</h4>
                <div className="space-y-2.5 text-xs sm:text-sm">
                  {institution.phone && (
                    <a
                      href={`tel:${institution.phone}`}
                      className="flex items-center gap-2 text-white font-bold hover:text-emerald-300 transition-colors"
                    >
                      <Phone size={14} className="text-emerald-400 shrink-0" />
                      <span className="tabular-nums truncate">{institution.phone}</span>
                    </a>
                  )}
                  {institution.contact_email && (
                    <a
                      href={`mailto:${institution.contact_email}`}
                      className="flex items-start gap-2 text-slate-300 hover:text-white transition-colors break-all"
                    >
                      <Mail size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <span>{institution.contact_email}</span>
                    </a>
                  )}
                  {officeHours && (
                    <div className="flex items-start gap-2 text-slate-300">
                      <Clock size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{officeHours}</span>
                    </div>
                  )}
                  {institution.address && (
                    <div className="flex items-start gap-2 text-slate-400">
                      <MapPin size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{institution.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Powered By Bar */}
        <div className="border-t border-slate-800/90">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-slate-400 text-center sm:text-left">
            <span>
              © {toBnDigit(new Date().getFullYear())} {institution.name}। সর্বস্বত্ব সংরক্ষিত।
            </span>
            <span className="font-bold">
              Powered by <span className="text-white font-black">Deenora</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Notice Reader Modal */}
      {activeNotice && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveNotice(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#1E3A8A]">{activeNotice.title}</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5 tabular-nums">
                  {formatBnDate(activeNotice.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                aria-label="বন্ধ করুন"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 max-h-[65vh] overflow-y-auto">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {activeNotice.message}
              </p>
            </div>
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="h-10 px-5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-xs font-black cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="বন্ধ করুন"
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-slate-950/75 hover:bg-slate-950 text-white flex items-center justify-center cursor-pointer"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxImage}
              alt={institution.name}
              className="w-full max-h-[82vh] object-contain bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicInstitutionSite;
