import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileText,
  Grid3X3,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  X,
  AlertCircle,
  Check,
} from 'lucide-react';
import { supabase } from 'supabase';
import { AcademicYear, Class, HifzRecord, Institution, Language, Profile, Student } from 'types';
import { sortMadrasahClasses } from 'pages/Classes';
import { getTodayDateString, toBnDigit } from 'utils/calendarUtils';
import { isValidUUID } from 'utils/validation';
import { useBackHandler } from 'utils/backHandler';
import {
  computeHifzParaProgress,
  extractStudentExtraFields,
  packStudentNotesWithExtra,
} from 'utils/studentExtraFields';
import {
  DEPT_LABELS,
  generateHifzReportPdf,
  GRADE_LABELS,
  HifzReportPeriod,
  SABQI_LABELS,
  TILAWAT_LABELS,
} from 'utils/hifzReportPdf';
import { NotificationService } from '../services/NotificationService';
import { SmartDatePicker } from '../components/common/SmartDatePicker';
import { CompactMonthPicker } from '../components/finance/CompactMonthPicker';

interface HifzTrackerProps {
  madrasah: Institution | null;
  onBack: () => void;
  lang: Language;
  activeYear?: AcademicYear | null;
  teacherInfo?: Profile | any | null;
}

type DeptType = 'hifz' | 'nazera' | 'qaida';
type ClassDeptSetting = DeptType | 'off';
type SabqiType = 'done' | 'partial' | 'missed';
type TilawatType = 'done' | 'partial' | 'none';
type GradeType = 'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'iada';

const detectDefaultClassDepartment = (className?: string | null): DeptType => {
  const name = className || '';
  if (/নাজেরা|nazera/i.test(name)) return 'nazera';
  if (/কায়দা|কায়দা|নূরানী|নুরানী|qaida|noorani|আমপারা/i.test(name)) return 'qaida';
  return 'hifz';
};

const parseConfigJson = (raw: any): Record<string, any> => {
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
};

const PARA_LIST = Array.from({ length: 30 }, (_, i) => i + 1);

const toEnDigits = (str: string): string =>
  String(str || '').replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

const clampInt = (val: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(val)));

const formatAmukhtaAmount = (from: number | '', to: number | '', isBn: boolean): string => {
  if (from === '' && to === '') return '';
  const f = clampInt(Number(from === '' ? to : from), 1, 20);
  const t = clampInt(Number(to === '' ? f : to), 1, 20);
  const lo = Math.min(f, t);
  const hi = Math.max(f, t);
  if (lo === 1 && hi === 10) return isBn ? 'পৃঃ ১–১০ (প্রথম অর্ধেক)' : 'P. 1-10 (First Half)';
  if (lo === 11 && hi === 20) return isBn ? 'পৃঃ ১১–২০ (শেষ অর্ধেক)' : 'P. 11-20 (Last Half)';
  if (lo === 1 && hi === 20) return isBn ? 'পৃঃ ১–২০ (পূর্ণ পারা)' : 'P. 1-20 (Full Para)';
  if (lo === hi) return `${isBn ? 'পৃঃ' : 'P.'} ${isBn ? toBnDigit(lo) : lo}`;
  return `${isBn ? 'পৃঃ' : 'P.'} ${isBn ? toBnDigit(lo) : lo}–${isBn ? toBnDigit(hi) : hi}`;
};

const parseAmukhtaFields = (
  paraRaw?: string | number | null,
  amountRaw?: string | null
): { para: number | ''; from: number | ''; to: number | '' } => {
  let para: number | '' = '';
  if (paraRaw != null && String(paraRaw).trim() !== '') {
    const enPara = toEnDigits(String(paraRaw));
    const m = enPara.match(/(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 30) para = n;
    }
  }

  let from: number | '' = '';
  let to: number | '' = '';
  const amt = toEnDigits(String(amountRaw || '')).trim();
  if (amt) {
    const rangeMatch = amt.match(/(\d+)\s*[–\-—]\s*(\d+)/);
    if (rangeMatch) {
      from = clampInt(parseInt(rangeMatch[1], 10), 1, 20);
      to = clampInt(parseInt(rangeMatch[2], 10), 1, 20);
    } else if (/আধা|half|প্রথম অর্ধেক|first half/i.test(amt)) {
      from = 1;
      to = 10;
    } else if (/শেষ অর্ধেক|last half/i.test(amt)) {
      from = 11;
      to = 20;
    } else if (/পূর্ণ|full|1\s*পারা|1\s*para/i.test(amt)) {
      from = 1;
      to = 20;
    } else {
      const singlePage = amt.match(/(?:পৃঃ|পৃষ্ঠা|p\.?)\s*(\d+)/i);
      if (singlePage) {
        const n = clampInt(parseInt(singlePage[1], 10), 1, 20);
        from = n;
        to = n;
      }
    }
  }

  return { para, from, to };
};

const formatTilawatAmount = (
  para: number | '',
  from: number | '',
  to: number | '',
  isBn: boolean
): string => {
  const paraPart =
    para !== '' ? `${isBn ? 'পারা' : 'Para'} ${isBn ? toBnDigit(para) : para}` : '';
  if (from === '' && to === '') return paraPart;
  const f = clampInt(Number(from === '' ? to : from), 1, 20);
  const t = clampInt(Number(to === '' ? f : to), 1, 20);
  const lo = Math.min(f, t);
  const hi = Math.max(f, t);
  let rangePart = '';
  if (lo === 1 && hi === 20) {
    rangePart = isBn ? 'পৃঃ ১–২০, পূর্ণ পারা' : 'P. 1-20, Full Para';
  } else if (lo === hi) {
    rangePart = `${isBn ? 'পৃঃ' : 'P.'} ${isBn ? toBnDigit(lo) : lo}`;
  } else {
    rangePart = `${isBn ? 'পৃঃ' : 'P.'} ${isBn ? toBnDigit(lo) : lo}–${isBn ? toBnDigit(hi) : hi}`;
  }
  return paraPart ? `${paraPart} (${rangePart})` : rangePart;
};

const parseTilawatFields = (
  amountRaw?: string | null
): { para: number | ''; from: number | ''; to: number | '' } => {
  const txt = toEnDigits(String(amountRaw || '')).trim();
  if (!txt) return { para: '', from: '', to: '' };

  let para: number | '' = '';
  const paraMatch = txt.match(/(?:পারা|para)\s*(\d+)/i);
  if (paraMatch) {
    const p = parseInt(paraMatch[1], 10);
    if (p >= 1 && p <= 30) para = p;
  }

  let from: number | '' = '';
  let to: number | '' = '';
  const rangeMatch = txt.match(/(?:পৃঃ|পৃষ্ঠা|p\.?)\s*(\d+)(?:\s*[–\-—]\s*(\d+))?/i);
  if (rangeMatch) {
    from = clampInt(parseInt(rangeMatch[1], 10), 1, 20);
    to = rangeMatch[2] ? clampInt(parseInt(rangeMatch[2], 10), 1, 20) : from;
  } else if (/পূর্ণ|full|1\s*পারা|1\s*para/i.test(txt)) {
    from = 1;
    to = 20;
  } else if (/10\s*(?:পৃষ্ঠা|page)/i.test(txt)) {
    from = 1;
    to = 10;
  } else if (/5\s*(?:পৃষ্ঠা|page)/i.test(txt)) {
    from = 1;
    to = 5;
  }

  return { para, from, to };
};

const calcSabinaParaCount = (from: number, to: number): number => {
  const f = clampInt(from, 1, 30);
  const t = clampInt(to, 1, 30);
  return t >= f ? t - f + 1 : 30 - f + 1 + t;
};

const formatSabinaRange = (
  from: number,
  to: number,
  isBn: boolean
): { text: string; shortRange: string; count: number } => {
  const f = clampInt(from, 1, 30);
  const t = clampInt(to, 1, 30);
  const count = calcSabinaParaCount(f, t);
  const fStr = isBn ? toBnDigit(f) : String(f);
  const tStr = isBn ? toBnDigit(t) : String(t);
  const cStr = isBn ? toBnDigit(count) : String(count);

  if (f === 1 && t === 30) {
    return {
      text: isBn ? 'পারা ১–৩০ (৩০ পারা খতম)' : 'Para 1-30 (30 Para Khatam)',
      shortRange: isBn ? 'পারা ১–৩০' : 'Para 1-30',
      count: 30,
    };
  }
  if (f === t) {
    return {
      text: isBn ? `পারা ${fStr} (১ পারা)` : `Para ${fStr} (1 Para)`,
      shortRange: isBn ? `পারা ${fStr}` : `Para ${fStr}`,
      count: 1,
    };
  }
  return {
    text: isBn ? `পারা ${fStr}–${tStr} (${cStr} পারা)` : `Para ${fStr}-${tStr} (${cStr} Paras)`,
    shortRange: isBn ? `পারা ${fStr}–${tStr}` : `Para ${fStr}-${tStr}`,
    count,
  };
};

const parseSabinaRange = (
  raw?: string | null
): { from: number; to: number; count: number } | null => {
  const txt = toEnDigits(String(raw || '')).trim();
  if (!txt) return null;
  if (/খতম|khatam/i.test(txt)) {
    return { from: 1, to: 30, count: 30 };
  }
  const rangeMatch = txt.match(/(\d+)\s*[–\-—]\s*(\d+)/);
  if (rangeMatch) {
    const f = clampInt(parseInt(rangeMatch[1], 10), 1, 30);
    const t = clampInt(parseInt(rangeMatch[2], 10), 1, 30);
    return { from: f, to: t, count: calcSabinaParaCount(f, t) };
  }
  const paraFirst = txt.match(/(?:পারা|para)\s*(\d+)/i);
  if (paraFirst) {
    const p = clampInt(parseInt(paraFirst[1], 10), 1, 30);
    return { from: p, to: p, count: 1 };
  }
  const countFirst = txt.match(/(\d+)\s*(?:পারা|para)/i);
  if (countFirst) {
    const cnt = clampInt(parseInt(countFirst[1], 10), 1, 30);
    return { from: 1, to: cnt, count: cnt };
  }
  return null;
};

const computeNextSabinaSerial = (prev: {
  from: number;
  to: number;
  count: number;
}): { from: number; to: number; count: number } => {
  if (prev.count >= 30) {
    return { from: 1, to: 30, count: 30 };
  }
  const span = clampInt(prev.count || 3, 1, 30);
  const nextFrom = (prev.to % 30) + 1;
  const nextTo = ((nextFrom + span - 2) % 30) + 1;
  return { from: nextFrom, to: nextTo, count: span };
};

interface EntryFormState {
  department: DeptType;
  para_no: number | '';
  surah_name: string;
  page_from: number | '';
  page_to: number | '';
  lines_count: number | '';
  sabqi_status: SabqiType;
  sabqi_pages: number | '';
  amukhta_para_num: number | '';
  amukhta_page_from: number | '';
  amukhta_page_to: number | '';
  tilawat_status: TilawatType;
  tilawat_para: number | '';
  tilawat_page_from: number | '';
  tilawat_page_to: number | '';
  sabina_completed: boolean;
  sabina_from_para: number;
  sabina_to_para: number;
  mistakes_lokma: number;
  mistakes_tajweed: number;
  grade: GradeType;
  remarks: string;
}

const DEFAULT_FORM: EntryFormState = {
  department: 'hifz',
  para_no: 1,
  surah_name: '',
  page_from: 1,
  page_to: 1,
  lines_count: 15,
  sabqi_status: 'done',
  sabqi_pages: '',
  amukhta_para_num: '',
  amukhta_page_from: '',
  amukhta_page_to: '',
  tilawat_status: 'none',
  tilawat_para: '',
  tilawat_page_from: '',
  tilawat_page_to: '',
  sabina_completed: false,
  sabina_from_para: 1,
  sabina_to_para: 3,
  mistakes_lokma: 0,
  mistakes_tajweed: 0,
  grade: 'mumtaz',
  remarks: '',
};

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LINE_OPTIONS = [5, 10, 15];

const shiftIsoDate = (isoDate: string, deltaDays: number): string => {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatFriendlyDateLabel = (isoDate: string, isBn: boolean): string => {
  const parts = (isoDate || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [y, m, d] = parts;
  const monthName = (isBn ? BN_MONTHS : EN_MONTHS)[m - 1] || '';
  const isToday = isoDate === getTodayDateString();
  const dayStr = isBn ? toBnDigit(d) : String(d);
  const yearStr = isBn ? toBnDigit(y) : String(y);
  const todayTag = isToday ? (isBn ? ' (আজ)' : ' (Today)') : '';
  return `${dayStr} ${monthName}, ${yearStr}${todayTag}`;
};

interface CompactParaPickerProps {
  value: number | '';
  onChange: (val: number | '') => void;
  isBn: boolean;
  isDark: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  title?: string;
  accent?: 'emerald' | 'blue' | 'amber';
}

const CompactParaPicker: React.FC<CompactParaPickerProps> = ({
  value,
  onChange,
  isBn,
  isDark,
  allowEmpty = true,
  placeholder,
  title,
  accent = 'emerald',
}) => {
  const [open, setOpen] = useState(false);

  const activeBtnClass =
    accent === 'blue'
      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
      : accent === 'amber'
        ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
        : 'bg-emerald-600 border-emerald-600 text-white shadow-sm';

  const triggerBorderClass =
    accent === 'amber'
      ? isDark
        ? 'bg-slate-900 border-slate-700 text-white hover:border-amber-500/60'
        : 'bg-white border-amber-200 text-slate-800 hover:border-amber-400'
      : isDark
        ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300';

  const displayLabel =
    value !== ''
      ? isBn
        ? `পারা ${toBnDigit(value)}`
        : `Para ${value}`
      : placeholder || (isBn ? 'নির্বাচন' : 'Select');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full h-10 px-2.5 rounded-xl border font-bold text-xs sm:text-sm tabular-nums flex items-center justify-between gap-1 active:scale-[0.98] transition-all cursor-pointer ${triggerBorderClass}`}
      >
        <span className={`truncate ${value === '' ? 'text-slate-400 font-semibold' : ''}`}>
          {displayLabel}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[190] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-[276px] max-w-[92vw] rounded-2xl border shadow-2xl p-3.5 space-y-2.5 font-noto animate-in zoom-in-95 duration-150 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  {title || (isBn ? 'পারা নির্বাচন করুন (১–৩০)' : 'Select Para (1-30)')}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {PARA_LIST.map((p) => {
                  const selected = value === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        onChange(p);
                        setOpen(false);
                      }}
                      className={`h-8 rounded-lg border text-xs font-black tabular-nums flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
                        selected
                          ? activeBtnClass
                          : isDark
                            ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-slate-500'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isBn ? toBnDigit(p) : p}
                    </button>
                  );
                })}
              </div>

              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className={`w-full h-8 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                    value === ''
                      ? isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-slate-200 border-slate-300 text-slate-800'
                      : isDark
                        ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {isBn ? 'নেই / খালি রাখুন' : 'None / Clear'}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

interface CompactStudentPickerProps {
  students: Student[];
  value: string;
  onChange: (val: string) => void;
  isBn: boolean;
  isDark: boolean;
  disabled?: boolean;
  includeAllOption?: boolean;
  allLabel?: string;
  emptyLabel?: string;
  title?: string;
}

const CompactStudentPicker: React.FC<CompactStudentPickerProps> = ({
  students,
  value,
  onChange,
  isBn,
  isDark,
  disabled = false,
  includeAllOption = false,
  allLabel,
  emptyLabel,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === value) || null,
    [students, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    const qEn = toEnDigits(q);
    return students.filter((s) => {
      const name = (s.student_name || '').toLowerCase();
      const roll = s.roll != null ? String(s.roll) : '';
      const rollBn = s.roll != null ? toBnDigit(s.roll) : '';
      return name.includes(q) || roll.includes(qEn) || rollBn.includes(q);
    });
  }, [students, query]);

  const handleOpen = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);
  };

  const triggerText =
    includeAllOption && value === 'all'
      ? allLabel || (isBn ? 'সকল শিক্ষার্থী (ক্লাস সামারি)' : 'All Students (Class Summary)')
      : selectedStudent
        ? selectedStudent.student_name
        : emptyLabel || (isBn ? 'কোনো শিক্ষার্থী নেই' : 'No students');

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`w-full h-11 px-3 rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-between gap-2 transition-all active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${
          isDark
            ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
            : 'bg-white border-slate-200 text-[#1E3A8A] hover:border-[#2563EB] shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedStudent && selectedStudent.roll != null ? (
            <span
              className={`h-6 min-w-[26px] px-1.5 rounded-lg text-[10px] font-black tabular-nums flex items-center justify-center shrink-0 ${
                isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {isBn ? toBnDigit(selectedStudent.roll) : selectedStudent.roll}
            </span>
          ) : (
            <User size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{triggerText}</span>
        </div>
        <ChevronDown size={15} className="text-slate-400 shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[190] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-[320px] max-w-[92vw] rounded-2xl border shadow-2xl p-3.5 space-y-2.5 font-noto animate-in zoom-in-95 duration-150 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {title || (isBn ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student')}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums shrink-0 ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isBn ? toBnDigit(students.length) : students.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search input */}
              {students.length > 5 && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isBn ? 'নাম বা রোল খুঁজুন...' : 'Search name or roll...'}
                    className={`w-full h-8 pl-8 pr-7 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Compact scrollable list */}
              <div className="max-h-[250px] overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                {includeAllOption && !query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('all');
                      setOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                      value === 'all'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : isDark
                          ? 'bg-slate-800/70 border-slate-700/80 text-slate-200 hover:border-slate-600'
                          : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          value === 'all'
                            ? 'bg-white/20 text-white'
                            : isDark
                              ? 'bg-slate-700 text-slate-300'
                              : 'bg-white text-emerald-600'
                        }`}
                      >
                        <User size={12} />
                      </span>
                      <span className="text-xs font-black truncate">
                        {allLabel || (isBn ? 'সকল শিক্ষার্থী (ক্লাস সামারি)' : 'All Students (Class Summary)')}
                      </span>
                    </div>
                    {value === 'all' && <Check size={14} className="shrink-0 stroke-[3]" />}
                  </button>
                )}

                {filtered.length === 0 ? (
                  <p className="text-[11px] font-bold text-slate-400 text-center py-6">
                    {isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}
                  </p>
                ) : (
                  filtered.map((s) => {
                    const active = value === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onChange(s.id);
                          setOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                          active
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                            : isDark
                              ? 'bg-slate-800/50 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700'
                              : 'bg-slate-50/80 border-slate-200/70 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-6 min-w-[26px] px-1 rounded-lg text-[10px] font-black tabular-nums flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-white/20 text-white'
                                : isDark
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-white border border-slate-200/80 text-[#1E3A8A]'
                            }`}
                          >
                            {s.roll != null ? (isBn ? toBnDigit(s.roll) : s.roll) : '—'}
                          </span>
                          <span className="text-xs font-bold truncate">{s.student_name}</span>
                        </div>
                        {active && <Check size={14} className="shrink-0 stroke-[3]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const HifzTracker: React.FC<HifzTrackerProps> = ({
  madrasah,
  onBack,
  lang,
  activeYear,
  teacherInfo,
}) => {
  const isDark = madrasah?.theme === 'dark';
  const isBn = lang === 'bn';
  const fmtNum = useCallback((val: number | string) => (isBn ? toBnDigit(val) : String(val)), [isBn]);

  const [activeTab, setActiveTab] = useState<'daily' | 'report'>('daily');
  const [activeDeptTab, setActiveDeptTab] = useState<DeptType>('hifz');
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Hifz Settings (per-class department mapping stored in institutions.config_json.hifz_settings)
  const [classDeptMap, setClassDeptMap] = useState<Record<string, ClassDeptSetting>>(() => {
    const cfg = parseConfigJson(madrasah?.config_json);
    return cfg?.hifz_settings?.class_departments && typeof cfg.hifz_settings.class_departments === 'object'
      ? { ...cfg.hifz_settings.class_departments }
      : {};
  });
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [draftClassDeptMap, setDraftClassDeptMap] = useState<Record<string, ClassDeptSetting>>({});
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  useEffect(() => {
    const cfg = parseConfigJson(madrasah?.config_json);
    if (cfg?.hifz_settings?.class_departments && typeof cfg.hifz_settings.class_departments === 'object') {
      setClassDeptMap({ ...cfg.hifz_settings.class_departments });
    }
  }, [madrasah?.config_json]);

  // Classes & Students
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'pending' | 'sabina'>('all');

  const [students, setStudents] = useState<Student[]>([]);
  const [dailyRecordsMap, setDailyRecordsMap] = useState<Record<string, HifzRecord>>({});
  const [loadingClasses, setLoadingClasses] = useState<boolean>(true);
  const [loadingDaily, setLoadingDaily] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({
    show: false,
    type: 'success',
    message: '',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, type, message });
  }, []);

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2800);
    return () => clearTimeout(timer);
  }, [toast.show]);

  // Entry Modal / Bottom Sheet state
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState>(DEFAULT_FORM);
  const [prefillInfo, setPrefillInfo] = useState<{ date: string; summary: string; paraNo?: number | null } | null>(null);
  const [lastSabinaHint, setLastSabinaHint] = useState<{
    prevRangeLabel: string;
    nextFrom: number;
    nextTo: number;
    nextCount: number;
  } | null>(null);
  const [loadingPrefill, setLoadingPrefill] = useState<boolean>(false);
  const [savingEntry, setSavingEntry] = useState<boolean>(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<boolean>(false);
  const [deletingEntry, setDeletingEntry] = useState<boolean>(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  // 30-Para Progress (inside Report tab) state
  const [progressClassId, setProgressClassId] = useState<string>('');
  const [progressClassStudents, setProgressClassStudents] = useState<Student[]>([]);
  const [progressStudentId, setProgressStudentId] = useState<string>('');
  const [studentHistory, setStudentHistory] = useState<HifzRecord[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [togglingPara, setTogglingPara] = useState<number | null>(null);
  const [confirmDeleteHistoryId, setConfirmDeleteHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);

  // Inline Report PDF state (inside Report tab)
  const [reportPeriod, setReportPeriod] = useState<HifzReportPeriod>('weekly');
  const [reportWeekEnd, setReportWeekEnd] = useState<string>(() => getTodayDateString());
  const [reportMonth, setReportMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(() => new Date().getFullYear());
  const [reportClassId, setReportClassId] = useState<string>('all');
  const [reportStudentId, setReportStudentId] = useState<string>('all');
  const [reportClassStudents, setReportClassStudents] = useState<Student[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);

  // Hardware back handlers for modals
  useBackHandler(
    'hifz-entry-modal',
    () => {
      if (activeStudent && !savingEntry) {
        setActiveStudent(null);
        return true;
      }
      return false;
    },
    Boolean(activeStudent),
    15
  );

  useBackHandler(
    'hifz-settings-modal',
    () => {
      if (showSettingsModal && !savingSettings) {
        setShowSettingsModal(false);
        return true;
      }
      return false;
    },
    showSettingsModal,
    15
  );

  // Effective department per class (saved setting or smart auto-detect fallback)
  const getEffectiveClassDept = useCallback(
    (cls: Class): ClassDeptSetting => {
      const saved = classDeptMap[cls.id];
      if (saved === 'hifz' || saved === 'nazera' || saved === 'qaida' || saved === 'off') {
        return saved;
      }
      return detectDefaultClassDepartment(cls.class_name);
    },
    [classDeptMap]
  );

  const activeTrackedClasses = useMemo(
    () => classes.filter((c) => getEffectiveClassDept(c) !== 'off'),
    [classes, getEffectiveClassDept]
  );

  const filteredClasses = useMemo(
    () => classes.filter((c) => getEffectiveClassDept(c) === activeDeptTab),
    [classes, activeDeptTab, getEffectiveClassDept]
  );

  const reportSelectableClasses = useMemo(
    () => (activeTrackedClasses.length > 0 ? activeTrackedClasses : classes),
    [activeTrackedClasses, classes]
  );

  // Auto-select first class in filteredClasses when switching department tabs or updating settings
  useEffect(() => {
    if (loadingClasses) return;
    if (filteredClasses.length === 0) {
      setSelectedClassId('');
      setStudents([]);
      setDailyRecordsMap({});
      return;
    }
    setSelectedClassId((prev) =>
      prev && filteredClasses.some((c) => c.id === prev) ? prev : filteredClasses[0].id
    );
  }, [filteredClasses, loadingClasses]);

  // Keep Report tab's 30-Para Progress class initialized cleanly
  useEffect(() => {
    if (loadingClasses) return;
    if (reportSelectableClasses.length === 0) {
      setProgressClassId('');
      setProgressClassStudents([]);
      setProgressStudentId('');
      return;
    }
    setProgressClassId((prev) => {
      if (prev && reportSelectableClasses.some((c) => c.id === prev)) return prev;
      if (selectedClassId && reportSelectableClasses.some((c) => c.id === selectedClassId)) {
        return selectedClassId;
      }
      return reportSelectableClasses[0].id;
    });
  }, [reportSelectableClasses, selectedClassId, loadingClasses]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const handleOpenSettingsModal = () => {
    const initialDraft: Record<string, ClassDeptSetting> = {};
    classes.forEach((cls) => {
      initialDraft[cls.id] = getEffectiveClassDept(cls);
    });
    setDraftClassDeptMap(initialDraft);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!madrasah?.id) return;
    setSavingSettings(true);
    try {
      // Fetch latest config_json to preserve all existing keys cleanly
      let latestConfig = parseConfigJson(madrasah.config_json);
      const { data: instRow } = await supabase
        .from('institutions')
        .select('config_json')
        .eq('id', madrasah.id)
        .maybeSingle();

      if (instRow?.config_json) {
        latestConfig = parseConfigJson(instRow.config_json);
      }

      const updatedConfig = {
        ...latestConfig,
        hifz_settings: {
          ...(latestConfig.hifz_settings || {}),
          class_departments: { ...draftClassDeptMap },
        },
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;

      // Sync local state & in-memory madrasah config_json
      setClassDeptMap({ ...draftClassDeptMap });
      if (madrasah) {
        (madrasah as any).config_json = updatedConfig;
      }

      setShowSettingsModal(false);
      showToast(isBn ? 'হিফজ সেটিংস সংরক্ষিত হয়েছে' : 'Hifz settings saved');
    } catch (err: any) {
      console.error('[HifzTracker] Error saving settings:', err);
      showToast(
        err?.message || (isBn ? 'সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে' : 'Failed to save settings'),
        'error'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // 1. Load classes on mount
  useEffect(() => {
    if (!madrasah?.id) return;
    let cancelled = false;

    const loadClasses = async () => {
      setLoadingClasses(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, institution_id, class_name, sort_order, created_at')
          .eq('institution_id', madrasah.id);

        if (error) throw error;
        let list = sortMadrasahClasses((data || []) as Class[]);

        const allowedClasses: string[] | undefined = teacherInfo?.permissions?.allowed_classes;
        if (Array.isArray(allowedClasses) && allowedClasses.length > 0) {
          const filtered = list.filter((c) => allowedClasses.includes(c.id));
          if (filtered.length > 0) list = filtered;
        }

        if (cancelled) return;
        setClasses(list);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[HifzTracker] Error loading classes:', err);
          setErrorMsg(isBn ? 'ক্লাস তালিকা লোড করতে সমস্যা হয়েছে।' : 'Failed to load classes.');
        }
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    };

    loadClasses();
    return () => {
      cancelled = true;
    };
  }, [madrasah?.id, teacherInfo?.permissions?.allowed_classes, isBn]);

  // Helper to fetch students for a class (or all allowed classes)
  const fetchStudentsForClass = useCallback(
    async (classId: string): Promise<Student[]> => {
      if (!madrasah?.id) return [];
      let query = supabase
        .from('students')
        .select('id, institution_id, class_id, student_name, roll, guardian_phone, section, notes, photo_url, is_active')
        .eq('institution_id', madrasah.id);

      if (classId && classId !== 'all') {
        query = query.eq('class_id', classId);
      } else if (classes.length > 0) {
        query = query.in(
          'class_id',
          classes.map((c) => c.id)
        );
      }

      const targetYearId = activeYear?.id || (madrasah?.config_json as any)?.active_academic_year_id;
      if (targetYearId && isValidUUID(targetYearId)) {
        query = query.or(`academic_year_id.eq.${targetYearId},academic_year_id.is.null`);
      }

      const { data, error } = await query.order('roll', { ascending: true });
      if (error) throw error;
      return ((data || []) as any[])
        .filter((s) => s.is_active !== false)
        .map((s) => {
          const extra = extractStudentExtraFields(s);
          return {
            ...s,
            department: extra?.department || s.section || '',
          } as Student;
        });
    },
    [madrasah?.id, madrasah?.config_json, activeYear?.id, classes]
  );

  // 2. Load students + daily hifz records when selectedClassId or selectedDate changes
  useEffect(() => {
    if (!madrasah?.id || !selectedClassId) return;
    let cancelled = false;

    const loadDailyData = async () => {
      setLoadingDaily(true);
      setErrorMsg(null);
      try {
        const [classStudents, recordsRes] = await Promise.all([
          fetchStudentsForClass(selectedClassId),
          supabase
            .from('hifz_records')
            .select('*')
            .eq('institution_id', madrasah.id)
            .eq('class_id', selectedClassId)
            .eq('record_date', selectedDate),
        ]);

        if (recordsRes.error) throw recordsRes.error;
        if (cancelled) return;

        setStudents(classStudents);
        const recMap: Record<string, HifzRecord> = {};
        for (const rec of (recordsRes.data || []) as HifzRecord[]) {
          recMap[rec.student_id] = rec;
        }
        setDailyRecordsMap(recMap);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[HifzTracker] Error loading daily data:', err);
          setErrorMsg(
            isBn
              ? 'সবক ডেটা লোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।'
              : 'Failed to load daily Hifz records.'
          );
        }
      } finally {
        if (!cancelled) setLoadingDaily(false);
      }
    };

    loadDailyData();
    return () => {
      cancelled = true;
    };
  }, [madrasah?.id, selectedClassId, selectedDate, fetchStudentsForClass, isBn, refreshTick]);

  // 3. Load students for 30-Para Progress class when Report tab is active
  useEffect(() => {
    if (activeTab !== 'report' || !progressClassId) return;
    if (progressClassId === selectedClassId && students.length > 0) {
      setProgressClassStudents(students);
      setProgressStudentId((prev) =>
        prev && students.some((s) => s.id === prev) ? prev : students[0]?.id || ''
      );
      return;
    }
    let cancelled = false;
    fetchStudentsForClass(progressClassId)
      .then((list) => {
        if (cancelled) return;
        setProgressClassStudents(list);
        setProgressStudentId((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : list[0]?.id || ''
        );
      })
      .catch(() => {
        if (!cancelled) {
          setProgressClassStudents([]);
          setProgressStudentId('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, progressClassId, selectedClassId, students, fetchStudentsForClass, refreshTick]);

  // 4. Load 30-Para Progress history when Report tab is active & student changes
  useEffect(() => {
    if (activeTab !== 'report' || !madrasah?.id || !progressStudentId) {
      if (!progressStudentId) setStudentHistory([]);
      return;
    }
    let cancelled = false;

    const loadStudentProgress = async () => {
      setLoadingProgress(true);
      try {
        const { data, error } = await supabase
          .from('hifz_records')
          .select('*')
          .eq('institution_id', madrasah.id)
          .eq('student_id', progressStudentId)
          .order('record_date', { ascending: false })
          .limit(365);

        if (error) throw error;
        if (!cancelled) {
          setStudentHistory((data || []) as HifzRecord[]);
        }
      } catch (err) {
        console.error('[HifzTracker] Error loading student progress:', err);
        if (!cancelled) setStudentHistory([]);
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    };

    loadStudentProgress();
    return () => {
      cancelled = true;
    };
  }, [activeTab, madrasah?.id, progressStudentId, dailyRecordsMap, refreshTick]);

  // 5. Sync inline PDF Report class students when reportClassId changes inside Report tab
  useEffect(() => {
    if (activeTab !== 'report') return;
    if (!reportClassId || reportClassId === 'all') {
      setReportClassStudents([]);
      setReportStudentId('all');
      return;
    }
    if (reportClassId === selectedClassId && students.length > 0) {
      setReportClassStudents(students);
      setReportStudentId((prev) =>
        prev === 'all' || students.some((s) => s.id === prev) ? prev : 'all'
      );
      return;
    }
    let cancelled = false;
    fetchStudentsForClass(reportClassId)
      .then((list) => {
        if (!cancelled) {
          setReportClassStudents(list);
          setReportStudentId((prev) =>
            prev === 'all' || list.some((s) => s.id === prev) ? prev : 'all'
          );
        }
      })
      .catch(() => {
        if (!cancelled) setReportClassStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, reportClassId, selectedClassId, students, fetchStudentsForClass, refreshTick]);

  // Derived stats & filtered students
  const { completedCount, pendingCount, sabinaCount, filteredStudents } = useMemo(() => {
    let completed = 0;
    let sabina = 0;
    for (const s of students) {
      const rec = dailyRecordsMap[s.id];
      if (rec) {
        completed++;
        if (rec.sabina_completed === true) sabina++;
      }
    }
    const pending = Math.max(0, students.length - completed);

    const q = searchQuery.trim().toLowerCase();
    const list = students.filter((s) => {
      const rec = dailyRecordsMap[s.id];
      const hasRec = Boolean(rec);
      if (statusFilter === 'done' && !hasRec) return false;
      if (statusFilter === 'pending' && hasRec) return false;
      if (statusFilter === 'sabina' && rec?.sabina_completed !== true) return false;
      if (!q) return true;
      const nameMatch = (s.student_name || '').toLowerCase().includes(q);
      const rollStr = s.roll != null ? String(s.roll) : '';
      const rollBn = s.roll != null ? toBnDigit(s.roll) : '';
      return nameMatch || rollStr.includes(q) || rollBn.includes(q);
    });

    return { completedCount: completed, pendingCount: pending, sabinaCount: sabina, filteredStudents: list };
  }, [students, dailyRecordsMap, searchQuery, statusFilter]);

  // Open Entry Modal with Smart Auto-Prefill & Sabina Serial Carryover
  const handleOpenEntryModal = async (student: Student) => {
    setActiveStudent(student);
    setEntryError(null);
    setPrefillInfo(null);
    setLastSabinaHint(null);
    setConfirmDeleteEntry(false);

    const selectedClassObj = classes.find((c) => c.id === selectedClassId);
    const classMappedDept = selectedClassObj ? getEffectiveClassDept(selectedClassObj) : activeDeptTab;
    const defaultDept: DeptType =
      activeTab === 'daily'
        ? activeDeptTab
        : classMappedDept !== 'off'
          ? classMappedDept
          : 'hifz';

    const fetchLastSabina = async () => {
      if (!madrasah?.id) return null;
      try {
        const { data: sabinaRows, error: sabinaErr } = await supabase
          .from('hifz_records')
          .select('record_date, sabina_paras, sabina_completed')
          .eq('institution_id', madrasah.id)
          .eq('student_id', student.id)
          .eq('sabina_completed', true)
          .lt('record_date', selectedDate)
          .order('record_date', { ascending: false })
          .limit(1);

        if (!sabinaErr && sabinaRows && sabinaRows.length > 0) {
          const parsed = parseSabinaRange(sabinaRows[0].sabina_paras);
          if (parsed) {
            const next = computeNextSabinaSerial(parsed);
            const prevFormatted = formatSabinaRange(parsed.from, parsed.to, isBn);
            return {
              prevRangeLabel: prevFormatted.shortRange,
              nextFrom: next.from,
              nextTo: next.to,
              nextCount: next.count,
            };
          }
        }
      } catch (e) {
        console.warn('[HifzTracker] Previous Sabina lookup skipped:', e);
      }
      return null;
    };

    const existing = dailyRecordsMap[student.id];
    if (existing) {
      const parsedAmukhta = parseAmukhtaFields(existing.amukhta_para, existing.amukhta_amount);
      const parsedTilawat = parseTilawatFields(existing.tilawat_amount);
      const parsedSabina = parseSabinaRange(existing.sabina_paras);

      setEntryForm({
        department: existing.department || defaultDept,
        para_no: existing.para_no ?? '',
        surah_name: existing.surah_name || '',
        page_from: existing.page_from ?? '',
        page_to: existing.page_to ?? '',
        lines_count: existing.lines_count ?? '',
        sabqi_status: existing.sabqi_status || 'done',
        sabqi_pages: existing.sabqi_pages ?? '',
        amukhta_para_num: parsedAmukhta.para,
        amukhta_page_from: parsedAmukhta.from,
        amukhta_page_to: parsedAmukhta.to,
        tilawat_status: existing.tilawat_status || 'none',
        tilawat_para: parsedTilawat.para,
        tilawat_page_from: parsedTilawat.from,
        tilawat_page_to: parsedTilawat.to,
        sabina_completed: existing.sabina_completed === true,
        sabina_from_para: parsedSabina ? parsedSabina.from : 1,
        sabina_to_para: parsedSabina ? parsedSabina.to : 3,
        mistakes_lokma: Number(existing.mistakes_lokma || 0),
        mistakes_tajweed: Number(existing.mistakes_tajweed || 0),
        grade: existing.grade || 'mumtaz',
        remarks: existing.remarks || '',
      });

      const hint = await fetchLastSabina();
      if (hint) {
        setLastSabinaHint(hint);
        if (!existing.sabina_completed) {
          setEntryForm((f) => ({
            ...f,
            sabina_from_para: hint.nextFrom,
            sabina_to_para: hint.nextTo,
          }));
        }
      }
      return;
    }

    // Automatically apply the active department tab for new entries
    setEntryForm({ ...DEFAULT_FORM, department: defaultDept });

    if (!madrasah?.id) return;
    setLoadingPrefill(true);
    try {
      const [prevRes, sabinaHint] = await Promise.all([
        supabase
          .from('hifz_records')
          .select('*')
          .eq('institution_id', madrasah.id)
          .eq('student_id', student.id)
          .lt('record_date', selectedDate)
          .order('record_date', { ascending: false })
          .limit(1),
        fetchLastSabina(),
      ]);

      if (sabinaHint) {
        setLastSabinaHint(sabinaHint);
      }

      const { data: prevRows, error } = prevRes;
      if (!error && prevRows && prevRows.length > 0) {
        const last = prevRows[0] as HifzRecord;
        const isIada = last.grade === 'iada';
        const isHifzDept = defaultDept === 'hifz';
        let nextParaNo: number | '' = last.para_no != null ? Number(last.para_no) : 1;
        let nextPageFrom = isIada
          ? (last.page_from ?? 1)
          : last.page_to != null
            ? Number(last.page_to) + 1
            : last.page_from != null
              ? Number(last.page_from) + 1
              : 1;
        let nextPageTo = isIada ? (last.page_to ?? nextPageFrom) : nextPageFrom;

        if (isHifzDept) {
          if (!isIada && nextPageFrom > 20) {
            if (typeof nextParaNo === 'number' && nextParaNo < 30) {
              nextParaNo = nextParaNo + 1;
              nextPageFrom = 1;
              nextPageTo = 1;
            } else {
              nextPageFrom = 20;
              nextPageTo = 20;
            }
          } else {
            nextPageFrom = clampInt(Number(nextPageFrom), 1, 20);
            nextPageTo = clampInt(Number(nextPageTo), nextPageFrom, 20);
          }
        }
        const parsedLastAmukhta = parseAmukhtaFields(last.amukhta_para, last.amukhta_amount);

        setEntryForm({
          department: defaultDept,
          para_no: nextParaNo,
          surah_name: last.surah_name || '',
          page_from: nextPageFrom,
          page_to: nextPageTo,
          lines_count: last.lines_count ?? 15,
          sabqi_status: 'done',
          sabqi_pages: last.sabqi_pages ?? '',
          amukhta_para_num: parsedLastAmukhta.para,
          amukhta_page_from: parsedLastAmukhta.from,
          amukhta_page_to: parsedLastAmukhta.to,
          tilawat_status: 'none',
          tilawat_para: '',
          tilawat_page_from: '',
          tilawat_page_to: '',
          sabina_completed: false,
          sabina_from_para: sabinaHint ? sabinaHint.nextFrom : 1,
          sabina_to_para: sabinaHint ? sabinaHint.nextTo : 3,
          mistakes_lokma: 0,
          mistakes_tajweed: 0,
          grade: 'mumtaz',
          remarks: '',
        });

        const parts = [
          last.para_no ? `${isBn ? 'পারা' : 'Para'} ${fmtNum(last.para_no)}` : '',
          last.page_from != null
            ? `${isBn ? 'পৃঃ' : 'P.'} ${fmtNum(last.page_from)}${last.page_to != null && last.page_to !== last.page_from ? `–${fmtNum(last.page_to)}` : ''}`
            : '',
          last.grade ? GRADE_LABELS[last.grade]?.[isBn ? 'bn' : 'en'] : '',
        ].filter(Boolean);

        setPrefillInfo({
          date: last.record_date,
          summary: parts.join(' · '),
          paraNo: last.para_no != null ? Number(last.para_no) : null,
        });
      } else if (sabinaHint) {
        setEntryForm((f) => ({
          ...f,
          sabina_from_para: sabinaHint.nextFrom,
          sabina_to_para: sabinaHint.nextTo,
        }));
      }
    } catch (err) {
      console.warn('[HifzTracker] Prefill lookup skipped:', err);
    } finally {
      setLoadingPrefill(false);
    }
  };

  // Save Entry (Upsert)
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || !madrasah?.id || !selectedClassId) return;
    setSavingEntry(true);
    setEntryError(null);

    const parsedPara = entryForm.para_no === '' ? null : Number(entryForm.para_no);
    const parsedFrom = entryForm.page_from === '' ? null : Number(entryForm.page_from);
    const parsedTo = entryForm.page_to === '' ? parsedFrom : Number(entryForm.page_to);
    const parsedLines = entryForm.lines_count === '' ? null : Number(entryForm.lines_count);
    const parsedSabqiPages = entryForm.sabqi_pages === '' ? null : Number(entryForm.sabqi_pages);

    const formattedAmukhtaPara =
      entryForm.amukhta_para_num !== '' ? String(entryForm.amukhta_para_num) : null;
    const formattedAmukhtaAmt =
      formatAmukhtaAmount(entryForm.amukhta_page_from, entryForm.amukhta_page_to, true) || null;
    const formattedTilawatAmt =
      entryForm.tilawat_status === 'none'
        ? null
        : formatTilawatAmount(
            entryForm.tilawat_para,
            entryForm.tilawat_page_from,
            entryForm.tilawat_page_to,
            true
          ) || null;
    const formattedSabinaParas = entryForm.sabina_completed
      ? formatSabinaRange(entryForm.sabina_from_para, entryForm.sabina_to_para, true).text
      : null;

    const yearId = activeYear?.id || (madrasah?.config_json as any)?.active_academic_year_id || null;
    const validYearId = yearId && isValidUUID(yearId) ? yearId : null;
    const validTeacherId = teacherInfo?.id && isValidUUID(teacherInfo.id) ? teacherInfo.id : null;

    const tilawatSabinaFields = {
      tilawat_status: entryForm.tilawat_status || 'none',
      tilawat_amount: formattedTilawatAmt,
      sabina_completed: Boolean(entryForm.sabina_completed),
      sabina_paras: formattedSabinaParas,
      sabina_grade: null,
    };

    const basePayload: Record<string, any> = {
      institution_id: madrasah.id,
      student_id: activeStudent.id,
      class_id: selectedClassId,
      academic_year_id: validYearId,
      teacher_id: validTeacherId,
      record_date: selectedDate,
      department: entryForm.department,
      para_no: parsedPara && !isNaN(parsedPara) ? parsedPara : null,
      surah_name: entryForm.surah_name.trim() || null,
      page_from: parsedFrom != null && !isNaN(parsedFrom) ? parsedFrom : null,
      page_to: parsedTo != null && !isNaN(parsedTo) ? parsedTo : null,
      lines_count: parsedLines != null && !isNaN(parsedLines) ? parsedLines : null,
      sabqi_status: entryForm.sabqi_status,
      sabqi_pages: parsedSabqiPages != null && !isNaN(parsedSabqiPages) ? parsedSabqiPages : null,
      amukhta_para: formattedAmukhtaPara,
      amukhta_amount: formattedAmukhtaAmt,
      mistakes_lokma: Math.max(0, Number(entryForm.mistakes_lokma) || 0),
      mistakes_tajweed: Math.max(0, Number(entryForm.mistakes_tajweed) || 0),
      grade: entryForm.grade,
      remarks: entryForm.remarks.trim() || null,
      ...tilawatSabinaFields,
    };

    try {
      let { data, error } = await supabase
        .from('hifz_records')
        .upsert(basePayload, { onConflict: 'student_id,record_date' })
        .select()
        .single();

      // Resilient retry if new tilawat/sabina columns are not migrated yet, amukhta_para is integer, or teacher_id FK mismatch
      let attemptPayload = { ...basePayload };
      for (let retry = 0; retry < 2 && error; retry++) {
        const errMsg = String(error.message || '');
        const isMissingCol =
          error.code === 'PGRST204' ||
          error.code === '42703' ||
          /column .* does not exist|Could not find the .* column/i.test(errMsg);
        const isTypeOrFk = error.code === '22P02' || error.code === '23503';

        if (!isMissingCol && !isTypeOrFk) break;

        if (isMissingCol) {
          delete attemptPayload.tilawat_status;
          delete attemptPayload.tilawat_amount;
          delete attemptPayload.sabina_completed;
          delete attemptPayload.sabina_paras;
          delete attemptPayload.sabina_grade;
        }
        if (error.code === '22P02' && typeof attemptPayload.amukhta_para === 'string') {
          const digits = parseInt(attemptPayload.amukhta_para.replace(/[^0-9]/g, ''), 10);
          attemptPayload.amukhta_para = isNaN(digits) ? null : digits;
        }
        if (error.code === '23503' && errMsg.includes('teacher_id')) {
          attemptPayload.teacher_id = null;
        }

        const retryRes = await supabase
          .from('hifz_records')
          .upsert(attemptPayload, { onConflict: 'student_id,record_date' })
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) throw error;

      const prevExistingRecord = dailyRecordsMap[activeStudent.id];
      const isUpdate = Boolean(prevExistingRecord);
      const savedRecord = {
        ...(data || { ...basePayload, id: `${activeStudent.id}_${selectedDate}` }),
        ...tilawatSabinaFields,
      } as HifzRecord;
      const notifiedStudent = activeStudent;

      // Auto-complete previous Para when student's Para updates (or when reaching Page 20 of current Para)
      const prevParaNum =
        prevExistingRecord?.para_no != null
          ? Number(prevExistingRecord.para_no)
          : prefillInfo?.paraNo != null
            ? Number(prefillInfo.paraNo)
            : null;
      const autoCompletedCandidates: number[] = [];
      if (
        prevParaNum != null &&
        prevParaNum >= 1 &&
        prevParaNum <= 30 &&
        parsedPara != null &&
        parsedPara >= 1 &&
        parsedPara <= 30 &&
        prevParaNum !== parsedPara
      ) {
        autoCompletedCandidates.push(prevParaNum);
      }
      if (parsedPara != null && parsedPara >= 1 && parsedPara <= 30 && parsedTo != null && parsedTo >= 20) {
        autoCompletedCandidates.push(parsedPara);
      }
      if (autoCompletedCandidates.length > 0) {
        try {
          const existingExtra = extractStudentExtraFields(activeStudent);
          const completedSet = new Set<number>(existingExtra.hifz_completed_paras || []);
          const uncompletedSet = new Set<number>(existingExtra.hifz_uncompleted_paras || []);
          let changed = false;
          for (const pNum of autoCompletedCandidates) {
            if (!completedSet.has(pNum)) {
              completedSet.add(pNum);
              changed = true;
            }
            if (uncompletedSet.has(pNum)) {
              uncompletedSet.delete(pNum);
              changed = true;
            }
          }
          if (changed) {
            const packedNotes = packStudentNotesWithExtra(activeStudent.notes, {
              ...existingExtra,
              hifz_completed_paras: Array.from(completedSet).sort((a, b) => a - b),
              hifz_uncompleted_paras: Array.from(uncompletedSet).sort((a, b) => a - b),
            });
            const { error: stuErr } = await supabase
              .from('students')
              .update({ notes: packedNotes })
              .eq('id', activeStudent.id)
              .eq('institution_id', madrasah.id);
            if (!stuErr) {
              const syncList = (list: Student[]) =>
                list.map((s) => (s.id === activeStudent.id ? { ...s, notes: packedNotes } : s));
              setStudents(syncList);
              setProgressClassStudents(syncList);
              setReportClassStudents(syncList);
            }
          }
        } catch (autoErr) {
          console.warn('[HifzTracker] Auto-mark completed para skipped:', autoErr);
        }
      }

      setDailyRecordsMap((prev) => ({ ...prev, [activeStudent.id]: savedRecord }));
      if (progressStudentId === activeStudent.id) {
        setStudentHistory((prev) => {
          const filtered = prev.filter((r) => r.id !== savedRecord.id && r.record_date !== savedRecord.record_date);
          return [savedRecord, ...filtered].sort((a, b) => b.record_date.localeCompare(a.record_date));
        });
      }
      setActiveStudent(null);
      showToast(
        isBn
          ? `${notifiedStudent.student_name}-এর সবক সংরক্ষিত হয়েছে`
          : `Saved Sabaq for ${notifiedStudent.student_name}`
      );

      // Fire-and-forget Parent Portal in-app & FCM push notification
      NotificationService.sendHifzNotification({
        institutionId: madrasah.id,
        institutionName: madrasah.name,
        institutionConfig: madrasah.config_json,
        student: {
          id: notifiedStudent.id,
          student_name: notifiedStudent.student_name,
          name_en: notifiedStudent.name_en,
          roll: notifiedStudent.roll,
          guardian_phone: notifiedStudent.guardian_phone,
          guardian_phone_2: (notifiedStudent as any).guardian_phone_2,
        },
        record: savedRecord,
        isUpdate,
      }).catch((pushErr) => console.warn('[HifzTracker] Parent notification notice:', pushErr));
    } catch (err: any) {
      console.error('[HifzTracker] Save error:', err);
      setEntryError(
        err?.message ||
          (isBn ? 'সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Failed to save entry.')
      );
    } finally {
      setSavingEntry(false);
    }
  };

  // Delete a Sabaq history record (with tenant isolation)
  const handleDeleteHifzRecord = async (rec: HifzRecord, closeModalOnDone = false) => {
    if (!madrasah?.id || !rec?.id) return;
    if (closeModalOnDone) {
      setDeletingEntry(true);
    } else {
      setDeletingHistoryId(rec.id);
    }
    try {
      const { error } = await supabase
        .from('hifz_records')
        .delete()
        .eq('id', rec.id)
        .eq('institution_id', madrasah.id);

      if (error) throw error;

      setStudentHistory((prev) => prev.filter((item) => item.id !== rec.id));
      setDailyRecordsMap((prev) => {
        const cur = prev[rec.student_id];
        if (!cur || (cur.id !== rec.id && rec.record_date !== selectedDate)) return prev;
        const next = { ...prev };
        delete next[rec.student_id];
        return next;
      });
      setConfirmDeleteHistoryId(null);
      setConfirmDeleteEntry(false);
      if (closeModalOnDone) {
        setActiveStudent(null);
      }
      showToast(isBn ? 'সবক রেকর্ড মুছে ফেলা হয়েছে' : 'Sabaq record deleted');
    } catch (err: any) {
      console.error('[HifzTracker] Delete error:', err);
      showToast(
        err?.message || (isBn ? 'রেকর্ড মুছতে সমস্যা হয়েছে' : 'Failed to delete record'),
        'error'
      );
    } finally {
      setDeletingEntry(false);
      setDeletingHistoryId(null);
    }
  };

  const selectedProgressStudent = useMemo(
    () => progressClassStudents.find((s) => s.id === progressStudentId) || null,
    [progressClassStudents, progressStudentId]
  );

  // Compute 30-Para Visual Progress (combines automatic Para-update completion + manual teacher ticks)
  const paraProgressData = useMemo(
    () => computeHifzParaProgress(studentHistory, selectedProgressStudent),
    [studentHistory, selectedProgressStudent]
  );

  // Toggle completed para checkmark (1-tap manual marking or unmarking even auto-completed paras)
  const handleToggleCompletedPara = async (paraNo: number) => {
    if (!madrasah?.id || !selectedProgressStudent || togglingPara !== null) return;
    setTogglingPara(paraNo);
    try {
      const existingExtra = extractStudentExtraFields(selectedProgressStudent);
      const completedSet = new Set<number>(existingExtra.hifz_completed_paras || []);
      const uncompletedSet = new Set<number>(existingExtra.hifz_uncompleted_paras || []);
      const paraItem = paraProgressData.paras[paraNo - 1];
      const currentlyCompleted = paraItem?.status === 'completed';
      const willBeCompleted = !currentlyCompleted;

      if (willBeCompleted) {
        completedSet.add(paraNo);
        uncompletedSet.delete(paraNo);
      } else {
        completedSet.delete(paraNo);
        if (paraItem?.isAutoCompleted) {
          uncompletedSet.add(paraNo);
        } else {
          uncompletedSet.delete(paraNo);
        }
      }

      const packedNotes = packStudentNotesWithExtra(selectedProgressStudent.notes, {
        ...existingExtra,
        hifz_completed_paras: Array.from(completedSet).sort((a, b) => a - b),
        hifz_uncompleted_paras: Array.from(uncompletedSet).sort((a, b) => a - b),
      });

      const { error } = await supabase
        .from('students')
        .update({ notes: packedNotes })
        .eq('id', selectedProgressStudent.id)
        .eq('institution_id', madrasah.id);

      if (error) throw error;

      const updateStuList = (list: Student[]) =>
        list.map((s) => (s.id === selectedProgressStudent.id ? { ...s, notes: packedNotes } : s));

      setProgressClassStudents(updateStuList);
      setStudents(updateStuList);
      setReportClassStudents(updateStuList);

      showToast(
        willBeCompleted
          ? isBn
            ? `পারা ${fmtNum(paraNo)} সম্পন্ন হিসেবে সংরক্ষিত হয়েছে`
            : `Para ${paraNo} marked as completed`
          : isBn
            ? `পারা ${fmtNum(paraNo)} বাকি হিসেবে চিহ্নিত হয়েছে`
            : `Para ${paraNo} marked as remaining`
      );
    } catch (err: any) {
      console.error('[HifzTracker] Toggle completed para error:', err);
      showToast(
        err?.message || (isBn ? 'পারা স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে' : 'Failed to update para status'),
        'error'
      );
    } finally {
      setTogglingPara(null);
    }
  };

  // Compute date range for inline PDF Report
  const computedReportRange = useMemo(() => {
    if (reportPeriod === 'weekly') {
      const end = reportWeekEnd || getTodayDateString();
      const start = shiftIsoDate(end, -6);
      return {
        startDate: start,
        endDate: end,
        label: isBn
          ? `সাপ্তাহিক (${toBnDigit(start)} থেকে ${toBnDigit(end)})`
          : `Weekly (${start} to ${end})`,
      };
    }
    if (reportPeriod === 'monthly') {
      const mStr = String(reportMonth).padStart(2, '0');
      const lastDay = new Date(reportYear, reportMonth, 0).getDate();
      const start = `${reportYear}-${mStr}-01`;
      const end = `${reportYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      const mName = isBn ? BN_MONTHS[reportMonth - 1] : EN_MONTHS[reportMonth - 1];
      return {
        startDate: start,
        endDate: end,
        label: `${mName} ${fmtNum(reportYear)}`,
      };
    }
    const start = `${reportYear}-01-01`;
    const end = `${reportYear}-12-31`;
    return {
      startDate: start,
      endDate: end,
      label: isBn ? `বাৎসরিক ${toBnDigit(reportYear)}` : `Yearly ${reportYear}`,
    };
  }, [reportPeriod, reportWeekEnd, reportMonth, reportYear, isBn, fmtNum]);

  // Download Report PDF
  const handleGeneratePdf = async () => {
    if (!madrasah?.id) return;
    setGeneratingPdf(true);
    try {
      const targetClassId = reportClassId || 'all';
      const targetStudents =
        targetClassId === selectedClassId
          ? students
          : await fetchStudentsForClass(targetClassId);

      const selectedStuObj =
        reportStudentId !== 'all'
          ? targetStudents.find((s) => s.id === reportStudentId) || null
          : null;

      let recQuery = supabase
        .from('hifz_records')
        .select('*')
        .eq('institution_id', madrasah.id)
        .gte('record_date', computedReportRange.startDate)
        .lte('record_date', computedReportRange.endDate);

      if (targetClassId !== 'all') {
        recQuery = recQuery.eq('class_id', targetClassId);
      } else if (classes.length > 0) {
        recQuery = recQuery.in(
          'class_id',
          classes.map((c) => c.id)
        );
      }

      if (selectedStuObj) {
        recQuery = recQuery.eq('student_id', selectedStuObj.id);
      }

      const { data: fetchedRecords, error } = await recQuery.order('record_date', { ascending: false });
      if (error) throw error;

      const classesMap: Record<string, string> = {};
      classes.forEach((c) => {
        classesMap[c.id] = c.class_name;
      });

      const classLabel =
        targetClassId === 'all'
          ? isBn ? 'সকল ক্লাস' : 'All Classes'
          : classesMap[targetClassId] || '';

      await generateHifzReportPdf({
        madrasah,
        periodType: reportPeriod,
        startDate: computedReportRange.startDate,
        endDate: computedReportRange.endDate,
        periodLabel: computedReportRange.label,
        classLabel,
        selectedStudent: selectedStuObj,
        students: selectedStuObj ? [selectedStuObj] : targetStudents,
        records: (fetchedRecords || []) as HifzRecord[],
        classesMap,
        lang,
      });

      showToast(isBn ? 'রিপোর্ট PDF ডাউনলোড শুরু হয়েছে' : 'Report PDF generated');
    } catch (err: any) {
      console.error('[HifzTracker] Report PDF error:', err);
      showToast(
        err?.message || (isBn ? 'রিপোর্ট PDF তৈরি করতে সমস্যা হয়েছে' : 'Failed to generate PDF'),
        'error'
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  const currentYearNum = new Date().getFullYear();
  const yearOptions = [currentYearNum, currentYearNum - 1, currentYearNum - 2, currentYearNum - 3];

  const getGradePillClass = (grade?: HifzRecord['grade']) => {
    switch (grade) {
      case 'mumtaz':
        return isDark
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'jayyid_jiddan':
        return isDark
          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'jayyid':
        return isDark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'iada':
        return isDark
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return isDark
          ? 'bg-slate-800 text-slate-300 border-slate-700'
          : 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-28 max-w-6xl mx-auto px-1 font-noto animate-in fade-in duration-300">
      {/* Clean Top Header (Attendance.tsx Style) */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onBack()}
            aria-label={isBn ? 'ফিরে যান' : 'Back'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'
            }`}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>
            {isBn ? 'হিফজ ও সবক ট্র্যাকার' : 'Hifz & Sabaq Tracker'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenSettingsModal}
            title={isBn ? 'হিফজ সেটিংস' : 'Hifz Settings'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400'
            }`}
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            title={isBn ? 'রিফ্রেশ' : 'Refresh'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400'
            }`}
          >
            <RefreshCw size={18} className={loadingDaily || loadingProgress ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Two Main Tabs (Attendance.tsx Tab Bar Style) */}
      <div
        className={`flex p-1 rounded-[1.5rem] border shadow-sm transition-all ${
          isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === 'daily' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'
          }`}
        >
          {isBn ? 'দৈনিক সবক এন্ট্রি' : 'Daily Sabaq Entry'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === 'report' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'
          }`}
        >
          {isBn ? 'হিফজ রিপোর্ট' : 'Hifz Report'}
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs sm:text-sm font-bold ${
            isDark
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <AlertCircle size={18} className="shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: DAILY ENTRY */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Filter Bar Card (Department Pills + Class + Date + Search + Summary) */}
          <div
            className={`p-3.5 sm:p-4 rounded-[2rem] border space-y-3 ${
              isDark
                ? 'bg-slate-900/90 border-slate-800'
                : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            {/* 3 Department Filter Pills */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'hifz' as DeptType, bn: 'হিফজ', en: 'Hifz' },
                  { key: 'nazera' as DeptType, bn: 'নাজেরা', en: 'Nazera' },
                  { key: 'qaida' as DeptType, bn: 'কায়দা', en: 'Qaida' },
                ] as const
              ).map((tab) => {
                const isActive = activeDeptTab === tab.key;
                const deptClassCount = classes.filter((c) => getEffectiveClassDept(c) === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveDeptTab(tab.key)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-2xl text-xs sm:text-sm font-black border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{isBn ? tab.bn : tab.en}</span>
                    {deptClassCount > 0 && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg tabular-nums ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : isDark
                              ? 'bg-slate-700 text-slate-300'
                              : 'bg-slate-200/80 text-slate-500'
                        }`}
                      >
                        {fmtNum(deptClassCount)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Class Selector */}
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'জামাত / শ্রেণি' : 'Class / Jammat'}
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={loadingClasses || filteredClasses.length === 0}
                  className={`w-full h-11 px-3.5 rounded-2xl border font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {filteredClasses.length === 0 ? (
                    <option value="">
                      {loadingClasses
                        ? isBn
                          ? 'লোড হচ্ছে...'
                          : 'Loading...'
                        : isBn
                          ? 'এই বিভাগে কোনো ক্লাস নেই'
                          : 'No classes in this department'}
                    </option>
                  ) : (
                    filteredClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date Selector with 1-tap prev/next */}
              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'তারিখ' : 'Date'}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => shiftIsoDate(d, -1))}
                    aria-label={isBn ? 'আগের দিন' : 'Previous day'}
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <SmartDatePicker
                    value={selectedDate}
                    onChange={(val) => val && setSelectedDate(val)}
                    lang={lang}
                    isDark={isDark}
                    minDate={activeYear?.start_date}
                    maxDate={activeYear?.end_date}
                    className="flex-1 min-w-0"
                    renderTrigger={(openPicker) => (
                      <button
                        type="button"
                        onClick={openPicker}
                        className={`w-full h-11 px-3 rounded-2xl border font-black text-xs sm:text-sm flex items-center justify-between gap-2 transition-all active:scale-[0.99] cursor-pointer ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                            : 'bg-white border-slate-200 text-[#1E3A8A] hover:border-[#2563EB] shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar size={15} className="text-[#2563EB] shrink-0" />
                          <span className="truncate tabular-nums">
                            {formatFriendlyDateLabel(selectedDate, isBn)}
                          </span>
                        </div>
                        <ChevronDown size={15} className="text-slate-400 shrink-0" />
                      </button>
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => shiftIsoDate(d, 1))}
                    aria-label={isBn ? 'পরের দিন' : 'Next day'}
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'দ্রুত খুঁজুন' : 'Quick Search'}
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isBn ? 'নাম বা রোল...' : 'Name or roll...'}
                    className={`w-full h-11 pl-10 pr-9 rounded-2xl border font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Strip (Interactive 1-tap filter buttons) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                  statusFilter === 'all'
                    ? isDark
                      ? 'bg-blue-500/15 border-blue-500/40'
                      : 'bg-blue-50/90 border-blue-200'
                    : isDark
                      ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                  {isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}
                </p>
                <p className={`text-lg sm:text-2xl font-black tabular-nums mt-0.5 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  {fmtNum(students.length)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === 'done' ? 'all' : 'done'))}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                  statusFilter === 'done'
                    ? isDark
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-emerald-50 border-emerald-300'
                    : isDark
                      ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {isBn ? 'আজ সবক দিয়েছে' : 'Completed'}
                </p>
                <p className="text-lg sm:text-2xl font-black tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {fmtNum(completedCount)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                  statusFilter === 'pending'
                    ? isDark
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-amber-50 border-amber-300'
                    : isDark
                      ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
                  {isBn ? 'বাকি আছে' : 'Remaining'}
                </p>
                <p className="text-lg sm:text-2xl font-black tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">
                  {fmtNum(pendingCount)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === 'sabina' ? 'all' : 'sabina'))}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                  statusFilter === 'sabina'
                    ? isDark
                      ? 'bg-yellow-500/20 border-yellow-500/50'
                      : 'bg-amber-100/80 border-amber-400'
                    : isDark
                      ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-yellow-400 truncate">
                  {isBn ? '🌟 সবিনা সম্পন্ন' : '🌟 Sabina Done'}
                </p>
                <p className="text-lg sm:text-2xl font-black tabular-nums mt-0.5 text-amber-700 dark:text-yellow-400">
                  {fmtNum(sabinaCount)}
                </p>
              </button>
            </div>
          </div>
          {loadingDaily || loadingClasses ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
              <p className="text-xs font-bold">{isBn ? 'শিক্ষার্থী তালিকা লোড হচ্ছে...' : 'Loading students...'}</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div
              className={`p-8 sm:p-10 rounded-[2rem] border-2 border-dashed text-center space-y-3 ${
                isDark ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Settings size={26} />
              </div>
              <div className="space-y-1">
                <p className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {isBn
                    ? `${DEPT_LABELS[activeDeptTab].bn} বিভাগে কোনো ক্লাস যুক্ত নেই`
                    : `No classes mapped to ${DEPT_LABELS[activeDeptTab].en}`}
                </p>
                <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto">
                  {isBn
                    ? 'সেটিংস থেকে আপনার পছন্দের ক্লাসগুলো এই বিভাগে যুক্ত করুন।'
                    : 'Assign classes to this department from Hifz Settings.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenSettingsModal}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Settings size={16} />
                <span>{isBn ? 'সেটিংস থেকে ক্লাস যোগ করুন' : 'Add Classes from Settings'}</span>
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div
              className={`p-10 rounded-[2rem] border-2 border-dashed text-center space-y-2 ${
                isDark ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <BookOpen size={32} className="mx-auto text-slate-400 opacity-60" />
              <p className="text-sm font-black">{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}</p>
              <p className="text-xs font-medium text-slate-400">
                {isBn ? 'অন্য জামাত নির্বাচন করুন বা সার্চ ফিল্টার ক্লিয়ার করুন।' : 'Try another class or clear the filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStudents.map((student) => {
                const record = dailyRecordsMap[student.id];
                const isDone = Boolean(record);
                const deptKey: DeptType = record?.department || activeDeptTab;
                const deptLabel = DEPT_LABELS[deptKey]?.[isBn ? 'bn' : 'en'];

                const paraText = record?.para_no
                  ? `${isBn ? 'পারা' : 'Para'} ${fmtNum(record.para_no)}`
                  : '';
                const pageText =
                  record?.page_from != null && record?.page_to != null
                    ? `${isBn ? 'পৃঃ' : 'P.'} ${fmtNum(record.page_from)}${record.page_to !== record.page_from ? `–${fmtNum(record.page_to)}` : ''}`
                    : record?.page_from != null
                      ? `${isBn ? 'পৃঃ' : 'P.'} ${fmtNum(record.page_from)}`
                      : '';
                const gradeLabel = record?.grade ? GRADE_LABELS[record.grade]?.[isBn ? 'bn' : 'en'] : '';
                const summaryLine = [paraText, pageText, record?.surah_name].filter(Boolean).join(' · ');
                const totalMistakes =
                  Number(record?.mistakes_lokma || 0) + Number(record?.mistakes_tajweed || 0);

                return (
                  <div
                    key={student.id}
                    className={`p-4 rounded-[2rem] border transition-colors flex flex-col justify-between gap-3 ${
                      isDone
                        ? isDark
                          ? 'bg-slate-900/90 border-emerald-500/30'
                          : 'bg-white border-emerald-200/80 shadow-sm'
                        : isDark
                          ? 'bg-slate-900/90 border-slate-800'
                          : 'bg-white border-slate-200/80 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm tabular-nums shrink-0 ${
                            isDone
                              ? isDark
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-emerald-50 text-emerald-700'
                              : isDark
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-slate-100 text-[#1E3A8A]'
                          }`}
                        >
                          {student.roll != null ? fmtNum(student.roll) : <User size={18} />}
                        </div>

                        <div className="min-w-0">
                          <h3
                            className={`text-sm sm:text-base font-black truncate ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {student.student_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mt-0.5 flex-wrap">
                            <span>{deptLabel}</span>
                            <span aria-hidden="true">·</span>
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={12} />
                                {isBn ? 'সম্পন্ন' : 'Done'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Clock size={12} />
                                {isBn ? 'বাকি' : 'Pending'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEntryModal(student)}
                        className={`min-h-[40px] px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-transform cursor-pointer ${
                          isDone
                            ? isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <Edit3 size={13} />
                            <span>{isBn ? 'এডিট' : 'Edit'}</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>{isBn ? 'সবক দিন' : 'Add Sabaq'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isDone && (
                      <div className="space-y-2">
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs flex items-center justify-between gap-2 ${
                            isDark ? 'bg-slate-800/70 text-slate-200' : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 truncate font-bold">
                            {summaryLine || (isBn ? 'সবক সংরক্ষিত' : 'Sabaq logged')}
                            {totalMistakes > 0 && (
                              <span className="text-rose-500 ml-1.5">
                                · {isBn ? 'ভুল' : 'Err'} {fmtNum(totalMistakes)}
                              </span>
                            )}
                          </div>
                          {gradeLabel && (
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border shrink-0 ${getGradePillClass(
                                record.grade
                              )}`}
                            >
                              {gradeLabel}
                            </span>
                          )}
                        </div>

                        {(record.tilawat_status === 'done' || record.tilawat_status === 'partial' || record.sabina_completed === true) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {record.tilawat_status === 'done' && (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-black border ${
                                  isDark
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}
                              >
                                {isBn ? 'তিলাওয়াত:' : 'Tilawat:'}{' '}
                                {record.tilawat_amount || (isBn ? 'সম্পন্ন' : 'Done')}
                              </span>
                            )}
                            {record.tilawat_status === 'partial' && (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-black border ${
                                  isDark
                                    ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                                    : 'bg-teal-50 border-teal-200 text-teal-700'
                                }`}
                              >
                                {isBn ? 'তিলাওয়াত:' : 'Tilawat:'}{' '}
                                {record.tilawat_amount || (isBn ? 'আংশিক' : 'Partial')}
                              </span>
                            )}
                            {record.sabina_completed === true && (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-black border ${
                                  isDark
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                    : 'bg-amber-50 border-amber-300 text-amber-800'
                                }`}
                              >
                                🌟 {isBn ? 'সবিনা:' : 'Sabina:'}{' '}
                                {record.sabina_paras || (isBn ? 'সম্পন্ন' : 'Completed')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HIFZ REPORT (Inline PDF Download + 30-Para Visual Progress) */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          {/* 1. PDF Report Download Card */}
          <div
            className={`p-4 sm:p-5 rounded-[2rem] border space-y-4 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h2 className={`text-sm sm:text-base font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  {isBn ? 'সাপ্তাহিক / মাসিক / বাৎসরিক রিপোর্ট PDF' : 'Weekly / Monthly / Yearly Report PDF'}
                </h2>
                <p className="text-[11px] font-bold text-slate-400 truncate">
                  {isBn ? 'সময়কাল ও ক্লাস নির্বাচন করে PDF ডাউনলোড করুন' : 'Select period & class to download PDF'}
                </p>
              </div>
            </div>

            {/* Period Type Pills */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'weekly' as HifzReportPeriod, bn: 'সাপ্তাহিক', en: 'Weekly' },
                  { id: 'monthly' as HifzReportPeriod, bn: 'মাসিক', en: 'Monthly' },
                  { id: 'yearly' as HifzReportPeriod, bn: 'বাৎসরিক', en: 'Yearly' },
                ] as const
              ).map((p) => {
                const active = reportPeriod === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReportPeriod(p.id)}
                    className={`min-h-[42px] rounded-2xl border text-xs sm:text-sm font-black active:scale-95 transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {isBn ? p.bn : p.en}
                  </button>
                );
              })}
            </div>

            {/* Period & Scope Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reportPeriod === 'weekly' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                    {isBn ? 'সপ্তাহের শেষ তারিখ (গত ৭ দিন)' : 'Week Ending Date (Last 7 Days)'}
                  </label>
                  <SmartDatePicker
                    value={reportWeekEnd}
                    onChange={(val) => val && setReportWeekEnd(val)}
                    lang={lang}
                    isDark={isDark}
                    minDate={activeYear?.start_date}
                    maxDate={activeYear?.end_date}
                    renderTrigger={(openPicker) => (
                      <button
                        type="button"
                        onClick={openPicker}
                        className={`w-full h-11 px-3.5 rounded-2xl border font-black text-xs sm:text-sm flex items-center justify-between gap-2 transition-all active:scale-[0.99] cursor-pointer ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                            : 'bg-white border-slate-200 text-[#1E3A8A] hover:border-[#2563EB] shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar size={15} className="text-[#2563EB] shrink-0" />
                          <span className="truncate tabular-nums">
                            {formatFriendlyDateLabel(reportWeekEnd, isBn)}
                          </span>
                        </div>
                        <ChevronDown size={15} className="text-slate-400 shrink-0" />
                      </button>
                    )}
                  />
                </div>
              )}

              {reportPeriod === 'monthly' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                    {isBn ? 'মাস ও সাল নির্বাচন' : 'Select Month & Year'}
                  </label>
                  <CompactMonthPicker
                    value={`${reportYear}-${String(reportMonth).padStart(2, '0')}`}
                    onChange={(val) => {
                      const [yStr, mStr] = val.split('-');
                      const yNum = parseInt(yStr, 10);
                      const mNum = parseInt(mStr, 10);
                      if (!Number.isNaN(yNum)) setReportYear(yNum);
                      if (!Number.isNaN(mNum)) setReportMonth(mNum);
                    }}
                    lang={lang}
                    isDark={isDark}
                    availableYears={yearOptions}
                  />
                </div>
              )}

              {reportPeriod === 'yearly' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                    {isBn ? 'সাল নির্বাচন করুন' : 'Select Year'}
                  </label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className={`w-full h-11 px-3.5 rounded-2xl border font-bold text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {fmtNum(y)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Class Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'ক্লাস / জামাত' : 'Class / Jammat'}
                </label>
                <select
                  value={reportClassId}
                  onChange={(e) => setReportClassId(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-2xl border font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="all">{isBn ? 'সকল ক্লাস' : 'All Classes'}</option>
                  {reportSelectableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Selector */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'শিক্ষার্থী' : 'Student'}
                </label>
                <CompactStudentPicker
                  students={reportClassStudents}
                  value={reportStudentId}
                  onChange={(val) => setReportStudentId(val)}
                  disabled={reportClassId === 'all'}
                  includeAllOption={true}
                  allLabel={isBn ? 'সকল শিক্ষার্থী (ক্লাস সামারি)' : 'All Students (Class Summary)'}
                  title={isBn ? 'রিপোর্টের শিক্ষার্থী নির্বাচন' : 'Select Report Student'}
                  isBn={isBn}
                  isDark={isDark}
                />
              </div>
            </div>

            {/* Range Summary + Download Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div
                className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                  isDark
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <Calendar size={15} className="shrink-0 text-emerald-500" />
                <span>{computedReportRange.label}</span>
              </div>

              <button
                type="button"
                disabled={generatingPdf}
                onClick={handleGeneratePdf}
                className="h-12 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{isBn ? 'PDF তৈরি হচ্ছে...' : 'Generating PDF...'}</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>{isBn ? 'রিপোর্ট PDF ডাউনলোড করুন' : 'Download Report PDF'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. 30-Para Visual Progress Map */}
          <div
            className={`p-4 sm:p-5 rounded-[2rem] border space-y-4 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Grid3X3 size={20} />
              </div>
              <div className="min-w-0">
                <h2 className={`text-sm sm:text-base font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  {isBn ? '৩০ পারা প্রগ্রেস ম্যাপ' : '30-Para Visual Progress'}
                </h2>
                <p className="text-[11px] font-bold text-slate-400 truncate">
                  {isBn ? 'শিক্ষার্থী ভিত্তিক পারা অগ্রগতি ও সাম্প্রতিক হিস্ট্রি' : 'Student-wise para completion & history'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'জামাত / শ্রেণি' : 'Class / Jammat'}
                </label>
                <select
                  value={progressClassId}
                  onChange={(e) => setProgressClassId(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-2xl border font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {reportSelectableClasses.length === 0 ? (
                    <option value="">{isBn ? 'কোনো শ্রেণি নেই' : 'No classes'}</option>
                  ) : (
                    reportSelectableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1 px-1">
                  {isBn ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student'}
                </label>
                <CompactStudentPicker
                  students={progressClassStudents}
                  value={progressStudentId}
                  onChange={(val) => setProgressStudentId(val)}
                  disabled={progressClassStudents.length === 0}
                  emptyLabel={isBn ? 'কোনো শিক্ষার্থী নেই' : 'No students'}
                  title={isBn ? 'প্রগ্রেস ম্যাপের শিক্ষার্থী' : 'Select Student for Progress'}
                  isBn={isBn}
                  isDark={isDark}
                />
              </div>
            </div>

            {/* Helper note + Compact legend */}
            <div className="space-y-2">
              <p
                className={`text-[11px] font-bold px-3 py-2 rounded-xl border ${
                  isDark
                    ? 'bg-emerald-950/25 border-emerald-800/40 text-emerald-300'
                    : 'bg-emerald-50/80 border-emerald-200/80 text-emerald-800'
                }`}
              >
                {isBn
                  ? 'পারা আপডেট হলে স্বয়ংক্রিয়ভাবে সবুজ টিক (✓) যুক্ত হয়; এছাড়া যেকোনো পারায় ট্যাপ করেও টিক (✓) দেওয়া বা বাদ দেওয়া যাবে'
                  : 'Completed Paras auto-tick (✓) when updated; you can also tap any Para to mark or unmark manually'}
              </p>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                  {isBn ? `সম্পন্ন (${fmtNum(paraProgressData.completedParasCount)})` : `Done (${paraProgressData.completedParasCount})`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-blue-600 inline-block" />
                  {isBn
                    ? `চলমান (${paraProgressData.currentPara ? fmtNum(paraProgressData.currentPara) : '—'})`
                    : `Current (${paraProgressData.currentPara || '—'})`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-md inline-block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  {isBn ? 'বাকি' : 'Remaining'}
                </span>
              </div>
            </div>

            {loadingProgress ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-emerald-500" />
                <span className="text-xs font-bold">{isBn ? 'প্রগ্রেস লোড হচ্ছে...' : 'Loading progress...'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 sm:gap-2">
                {paraProgressData.paras.map((p) => {
                  const isCompleted = p.status === 'completed';
                  const isCurrent = p.status === 'current';
                  const isBusy = togglingPara === p.paraNo;
                  return (
                    <button
                      key={p.paraNo}
                      type="button"
                      disabled={!selectedProgressStudent || togglingPara !== null}
                      onClick={() => handleToggleCompletedPara(p.paraNo)}
                      className={`relative h-10 sm:h-11 px-1 rounded-xl border text-center flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-60 ${
                        isCompleted
                          ? isDark
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                          : isCurrent
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/25'
                            : isDark
                              ? 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:border-emerald-500/50'
                              : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-black tabular-nums leading-none">
                        {fmtNum(p.paraNo)}
                      </span>
                      {isBusy ? (
                        <Loader2 size={10} className="mt-0.5 animate-spin" />
                      ) : isCompleted ? (
                        <Check size={10} className="mt-0.5 stroke-[3]" />
                      ) : isCurrent && p.maxPage > 0 ? (
                        <span className="text-[8.5px] font-bold opacity-90 mt-0.5 leading-none tabular-nums">
                          {isBn ? `পৃঃ${fmtNum(p.maxPage)}` : `P.${p.maxPage}`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Recent Sabaq History Timeline */}
          <div
            className={`p-4 sm:p-5 rounded-[2rem] border space-y-3 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {isBn ? 'সাম্প্রতিক সবক হিস্ট্রি' : 'Recent Sabaq History'}
              </h3>
              <span className="text-xs font-bold text-slate-400 tabular-nums">
                {isBn ? `মোট ${fmtNum(studentHistory.length)} দিন` : `${studentHistory.length} entries`}
              </span>
            </div>

            {studentHistory.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-8">
                {isBn ? 'এখনো কোনো সবক রেকর্ড পাওয়া যায়নি।' : 'No Sabaq history found yet.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentHistory.slice(0, 25).map((rec) => {
                  const gradeLabel = rec.grade ? GRADE_LABELS[rec.grade]?.[isBn ? 'bn' : 'en'] : '';
                  const deptLabel = DEPT_LABELS[rec.department]?.[isBn ? 'bn' : 'en'] || rec.department;
                  const sabqiLabel = rec.sabqi_status ? SABQI_LABELS[rec.sabqi_status]?.[isBn ? 'bn' : 'en'] : '';
                  const isConfirmingDel = confirmDeleteHistoryId === rec.id;
                  const isDeletingRec = deletingHistoryId === rec.id;
                  return (
                    <div key={rec.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {fmtNum(rec.record_date)}
                          </span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            · {deptLabel}
                          </span>
                          {rec.para_no && (
                            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              · {isBn ? 'পারা' : 'Para'} {fmtNum(rec.para_no)}
                              {rec.page_from != null &&
                                `, ${isBn ? 'পৃঃ' : 'P.'} ${fmtNum(rec.page_from)}${
                                  rec.page_to != null && rec.page_to !== rec.page_from
                                    ? `–${fmtNum(rec.page_to)}`
                                    : ''
                                }`}
                              {rec.lines_count ? ` (${fmtNum(rec.lines_count)} ${isBn ? 'লাইন' : 'lines'})` : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-slate-400 flex items-center gap-2 flex-wrap">
                          {rec.surah_name && <span>{rec.surah_name}</span>}
                          {sabqiLabel && (
                            <span>
                              {isBn ? 'সাত সবক:' : 'Sabqi:'} {sabqiLabel}
                              {rec.sabqi_pages ? ` (${fmtNum(rec.sabqi_pages)} ${isBn ? 'পৃঃ' : 'p'})` : ''}
                            </span>
                          )}
                          {(rec.amukhta_para || rec.amukhta_amount) && (
                            <span>
                              · {isBn ? 'আমুখতা:' : 'Amukhta:'}{' '}
                              {[
                                rec.amukhta_para ? `${isBn ? 'পারা' : 'P.'} ${fmtNum(String(rec.amukhta_para))}` : '',
                                rec.amukhta_amount ? fmtNum(rec.amukhta_amount) : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                          {(rec.tilawat_status === 'done' || rec.tilawat_status === 'partial') && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              · {isBn ? 'তিলাওয়াত:' : 'Tilawat:'}{' '}
                              {rec.tilawat_amount
                                ? fmtNum(rec.tilawat_amount)
                                : TILAWAT_LABELS[rec.tilawat_status]?.[isBn ? 'bn' : 'en']}
                            </span>
                          )}
                          {rec.sabina_completed === true && (
                            <span className="text-amber-600 dark:text-amber-400 font-black">
                              · 🌟 {isBn ? 'সবিনা:' : 'Sabina:'}{' '}
                              {rec.sabina_paras ? fmtNum(rec.sabina_paras) : isBn ? 'সম্পন্ন' : 'Completed'}
                            </span>
                          )}
                          {(Number(rec.mistakes_lokma || 0) > 0 || Number(rec.mistakes_tajweed || 0) > 0) && (
                            <span className="text-rose-500 font-bold">
                              · {isBn ? 'লোকমা' : 'Lokma'} {fmtNum(rec.mistakes_lokma || 0)}, {isBn ? 'তাজবীদ' : 'Tajweed'}{' '}
                              {fmtNum(rec.mistakes_tajweed || 0)}
                            </span>
                          )}
                          {rec.remarks && <span>· {rec.remarks}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                        {gradeLabel && (
                          <span
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black border shrink-0 ${getGradePillClass(
                              rec.grade
                            )}`}
                          >
                            {gradeLabel}
                          </span>
                        )}
                        {isConfirmingDel ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isDeletingRec}
                              onClick={() => handleDeleteHifzRecord(rec, false)}
                              className="h-7 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {isDeletingRec ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <span>{isBn ? 'মুছুন' : 'Delete'}</span>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={isDeletingRec}
                              onClick={() => setConfirmDeleteHistoryId(null)}
                              className={`h-7 px-2 rounded-lg border text-[11px] font-bold active:scale-95 transition-all cursor-pointer ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {isBn ? 'না' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteHistoryId(rec.id)}
                            aria-label={isBn ? 'সবক রেকর্ড মুছুন' : 'Delete Sabaq record'}
                            title={isBn ? 'মুছুন' : 'Delete'}
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
                              isDark
                                ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
                            }`}
                          >
                            <Trash2 size={14} />
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
      )}

      {/* ENTRY MODAL / BOTTOM SHEET (Positioned cleanly above mobile bottom nav bar) */}
      {activeStudent &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-2 pt-4 pb-[88px] sm:p-4 animate-in fade-in duration-200"
            onClick={() => !savingEntry && setActiveStudent(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full sm:max-w-lg rounded-[2rem] sm:rounded-[2.5rem] border shadow-2xl max-h-[calc(100dvh-110px)] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 font-noto ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Mobile drag handle */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                <div className={`w-10 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
              </div>

              {/* Header */}
              <div
                className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <h2 className={`text-base sm:text-lg font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {activeStudent.student_name}
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 tabular-nums">
                    {activeStudent.roll != null ? `${isBn ? 'রোল' : 'Roll'}: ${fmtNum(activeStudent.roll)} · ` : ''}
                    {fmtNum(selectedDate)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingEntry}
                  onClick={() => setActiveStudent(null)}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form id="hifz-entry-form" onSubmit={handleSaveEntry} className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-5 py-3.5 space-y-3.5 custom-scrollbar">
                {loadingPrefill && (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{isBn ? 'গত সবকের তথ্য আনা হচ্ছে...' : 'Loading previous entry...'}</span>
                  </div>
                )}

                {prefillInfo && (
                  <div
                    className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 ${
                      isDark
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <Sparkles size={14} className="shrink-0 text-emerald-500" />
                    <span className="font-bold">
                      {isBn ? `গত সবক (${fmtNum(prefillInfo.date)}): ` : `Last (${prefillInfo.date}): `}
                      {prefillInfo.summary}
                    </span>
                  </div>
                )}

                {entryError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{entryError}</span>
                  </div>
                )}

                {/* 1. Compact Department Indicator with optional quick override */}
                <div
                  className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                    isDark ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'বিভাগ:' : 'Dept:'}
                  </span>
                  <div className="flex items-center gap-1">
                    {(['hifz', 'nazera', 'qaida'] as DeptType[]).map((dept) => {
                      const active = entryForm.department === dept;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setEntryForm((f) => ({ ...f, department: dept }))}
                          className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : isDark
                                ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
                          }`}
                        >
                          {DEPT_LABELS[dept][isBn ? 'bn' : 'en']}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. New Sabaq */}
                <div className="space-y-2.5 pt-1">
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'নতুন সবক' : 'New Sabaq'}</span>
                  </h3>

                  <div className="grid grid-cols-12 gap-2">
                    {/* Para Selector */}
                    <div className="col-span-4">
                      <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'পারা (১–৩০)' : 'Para (1-30)'}
                      </label>
                      <CompactParaPicker
                        value={entryForm.para_no}
                        onChange={(val) => setEntryForm((f) => ({ ...f, para_no: val }))}
                        isBn={isBn}
                        isDark={isDark}
                        allowEmpty={true}
                        placeholder={isBn ? 'নেই' : 'None'}
                        title={isBn ? 'নতুন সবকের পারা নির্বাচন' : 'Select Sabaq Para'}
                        accent="emerald"
                      />
                    </div>

                    {/* Page From */}
                    <div className="col-span-4">
                      <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'পৃষ্ঠা শুরু' : 'Page From'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={entryForm.department === 'hifz' ? 20 : undefined}
                        inputMode="numeric"
                        value={entryForm.page_from}
                        onChange={(e) => {
                          const raw = e.target.value === '' ? '' : Number(e.target.value);
                          setEntryForm((f) => {
                            const val =
                              raw === ''
                                ? ''
                                : f.department === 'hifz'
                                  ? clampInt(raw, 1, 20)
                                  : Math.max(1, Math.round(raw));
                            const curTo =
                              f.page_to === ''
                                ? ''
                                : f.department === 'hifz'
                                  ? clampInt(Number(f.page_to), 1, 20)
                                  : Number(f.page_to);
                            return {
                              ...f,
                              page_from: val,
                              page_to:
                                val !== '' && (curTo === '' || curTo < val)
                                  ? val
                                  : curTo,
                            };
                          });
                        }}
                        placeholder="1"
                        className={`w-full h-10 px-3 rounded-xl border font-bold text-xs sm:text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Page To */}
                    <div className="col-span-4">
                      <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'পৃষ্ঠা শেষ' : 'Page To'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={entryForm.department === 'hifz' ? 20 : undefined}
                        inputMode="numeric"
                        value={entryForm.page_to}
                        onChange={(e) => {
                          const raw = e.target.value === '' ? '' : Number(e.target.value);
                          setEntryForm((f) => ({
                            ...f,
                            page_to:
                              raw === ''
                                ? ''
                                : f.department === 'hifz'
                                  ? clampInt(raw, 1, 20)
                                  : Math.max(1, Math.round(raw)),
                          }));
                        }}
                        placeholder="1"
                        className={`w-full h-10 px-3 rounded-xl border font-bold text-xs sm:text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Quick +1 Page & Lines Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEntryForm((f) => {
                          const base = Number(f.page_to || f.page_from || 0);
                          if (f.department === 'hifz') {
                            if (base >= 20) {
                              const curPara = Number(f.para_no || 0);
                              if (curPara >= 1 && curPara < 30) {
                                return {
                                  ...f,
                                  para_no: curPara + 1,
                                  page_from: 1,
                                  page_to: 1,
                                };
                              }
                              return {
                                ...f,
                                page_from: f.page_from === '' ? 1 : clampInt(Number(f.page_from), 1, 20),
                                page_to: 20,
                              };
                            }
                            const nextTo = clampInt(base + 1, 1, 20);
                            const nextFrom = f.page_from === '' ? 1 : clampInt(Number(f.page_from), 1, nextTo);
                            return {
                              ...f,
                              page_from: nextFrom,
                              page_to: nextTo,
                            };
                          }
                          return {
                            ...f,
                            page_from: f.page_from === '' ? 1 : f.page_from,
                            page_to: base + 1,
                          };
                        })
                      }
                      className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer ${
                        isDark
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      <Plus size={13} />
                      <span>{isBn ? '+১ পৃষ্ঠা' : '+1 Page'}</span>
                    </button>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'লাইন:' : 'Lines:'}
                      </span>
                      {LINE_OPTIONS.map((ln) => {
                        const active = entryForm.lines_count === ln;
                        return (
                          <button
                            key={ln}
                            type="button"
                            onClick={() =>
                              setEntryForm((f) => ({
                                ...f,
                                lines_count: f.lines_count === ln ? '' : ln,
                              }))
                            }
                            className={`h-8 min-w-[36px] px-2.5 rounded-xl border text-[11px] font-bold tabular-nums active:scale-95 transition-all cursor-pointer ${
                              active
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {fmtNum(ln)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Surah / Takhti optional */}
                  <input
                    type="text"
                    value={entryForm.surah_name}
                    onChange={(e) => setEntryForm((f) => ({ ...f, surah_name: e.target.value }))}
                    placeholder={isBn ? 'সূরা / তখতি (ঐচ্ছিক, যেমন: সূরা বাকারা)' : 'Surah / Takhti (optional)'}
                    className={`w-full h-10 px-3 rounded-xl border font-bold text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {/* 3. Sabqi (সাত সবক) */}
                <div className={`space-y-2.5 pt-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'সাত সবক' : 'Sabqi'}</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['done', 'partial', 'missed'] as SabqiType[]).map((st) => {
                      const active = entryForm.sabqi_status === st;
                      const activeColors =
                        st === 'done'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : st === 'partial'
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-rose-600 border-rose-600 text-white';
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setEntryForm((f) => ({ ...f, sabqi_status: st }))}
                          className={`h-9 px-3 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                            active
                              ? activeColors
                              : isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-300'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {SABQI_LABELS[st][isBn ? 'bn' : 'en']}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={entryForm.sabqi_pages}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        sabqi_pages: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    placeholder={isBn ? 'সাত সবক পৃষ্ঠা সংখ্যা (ঐচ্ছিক)' : 'Sabqi pages (optional)'}
                    className={`w-full h-10 px-3 rounded-xl border font-bold text-xs sm:text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {/* 4. Amukhta (আমুখতা) */}
                <div className={`space-y-2.5 pt-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'আমুখতা' : 'Amukhta / Manzil'}</span>
                  </h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isBn ? 'পারা' : 'Para'}
                        </label>
                        <CompactParaPicker
                          value={entryForm.amukhta_para_num}
                          onChange={(val) => setEntryForm((f) => ({ ...f, amukhta_para_num: val }))}
                          isBn={isBn}
                          isDark={isDark}
                          allowEmpty={true}
                          placeholder={isBn ? 'নির্বাচন' : 'None'}
                          title={isBn ? 'আমুখতার পারা নির্বাচন' : 'Select Amukhta Para'}
                          accent="blue"
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isBn ? 'পৃষ্ঠা থেকে' : 'Page From'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          inputMode="numeric"
                          value={entryForm.amukhta_page_from}
                          onChange={(e) =>
                            setEntryForm((f) => ({
                              ...f,
                              amukhta_page_from: e.target.value === '' ? '' : clampInt(Number(e.target.value), 1, 20),
                            }))
                          }
                          placeholder={isBn ? '১' : '1'}
                          className={`w-full h-10 px-2.5 rounded-xl border font-bold text-xs sm:text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isBn ? 'পৃষ্ঠা পর্যন্ত' : 'Page To'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          inputMode="numeric"
                          value={entryForm.amukhta_page_to}
                          onChange={(e) =>
                            setEntryForm((f) => ({
                              ...f,
                              amukhta_page_to: e.target.value === '' ? '' : clampInt(Number(e.target.value), 1, 20),
                            }))
                          }
                          placeholder={isBn ? '১০' : '10'}
                          className={`w-full h-10 px-2.5 rounded-xl border font-bold text-xs sm:text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                    </div>

                    {/* 3 Quick 1-Tap Amukhta Page-Range Presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { from: 1, to: 10, bn: 'প্রথম অর্ধেক (১–১০)', en: 'First Half (1-10)' },
                        { from: 11, to: 20, bn: 'শেষ অর্ধেক (১১–২০)', en: 'Last Half (11-20)' },
                        { from: 1, to: 20, bn: 'পূর্ণ পারা (১–২০)', en: 'Full Para (1-20)' },
                      ].map((chip) => {
                        const active =
                          entryForm.amukhta_page_from === chip.from && entryForm.amukhta_page_to === chip.to;
                        return (
                          <button
                            key={chip.bn}
                            type="button"
                            onClick={() =>
                              setEntryForm((f) => ({
                                ...f,
                                amukhta_page_from: active ? '' : chip.from,
                                amukhta_page_to: active ? '' : chip.to,
                              }))
                            }
                            className={`h-8 px-1.5 rounded-xl border text-[10.5px] font-bold active:scale-95 transition-all cursor-pointer truncate ${
                              active
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {isBn ? chip.bn : chip.en}
                          </button>
                        );
                      })}
                    </div>

                    {(entryForm.amukhta_para_num !== '' ||
                      entryForm.amukhta_page_from !== '' ||
                      entryForm.amukhta_page_to !== '') && (
                      <div
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between ${
                          isDark ? 'bg-blue-950/30 text-blue-300' : 'bg-blue-50 text-blue-800'
                        }`}
                      >
                        <span>
                          {[
                            entryForm.amukhta_para_num !== ''
                              ? `${isBn ? 'পারা' : 'Para'} ${fmtNum(entryForm.amukhta_para_num)}`
                              : '',
                            formatAmukhtaAmount(entryForm.amukhta_page_from, entryForm.amukhta_page_to, isBn),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              amukhta_para_num: '',
                              amukhta_page_from: '',
                              amukhta_page_to: '',
                            }))
                          }
                          className="text-[10px] underline opacity-75 hover:opacity-100 cursor-pointer"
                        >
                          {isBn ? 'মুছুন' : 'Clear'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4.5. Daily Tilawat (দৈনিক তেলাওয়াত) */}
                <div className={`space-y-2.5 pt-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'দৈনিক তেলাওয়াত' : 'Daily Tilawat'}</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['done', 'partial', 'none'] as TilawatType[]).map((st) => {
                      const active = entryForm.tilawat_status === st;
                      const activeColors =
                        st === 'done'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : st === 'partial'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                            : isDark
                              ? 'bg-slate-700 border-slate-600 text-white'
                              : 'bg-slate-700 border-slate-700 text-white';
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              tilawat_status: st,
                              ...(st === 'none'
                                ? { tilawat_para: '', tilawat_page_from: '', tilawat_page_to: '' }
                                : {}),
                            }))
                          }
                          className={`h-9 px-3 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                            active
                              ? activeColors
                              : isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-300'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {TILAWAT_LABELS[st][isBn ? 'bn' : 'en']}
                        </button>
                      );
                    })}
                  </div>

                  {(entryForm.tilawat_status === 'done' || entryForm.tilawat_status === 'partial') && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isBn ? 'পারা' : 'Para'}
                          </label>
                          <CompactParaPicker
                            value={entryForm.tilawat_para}
                            onChange={(val) => setEntryForm((f) => ({ ...f, tilawat_para: val }))}
                            isBn={isBn}
                            isDark={isDark}
                            allowEmpty={true}
                            placeholder={isBn ? 'নির্বাচন' : 'None'}
                            title={isBn ? 'তেলাওয়াতের পারা নির্বাচন' : 'Select Tilawat Para'}
                            accent="emerald"
                          />
                        </div>
                        <div>
                          <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isBn ? 'পৃষ্ঠা থেকে' : 'Page From'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            inputMode="numeric"
                            value={entryForm.tilawat_page_from}
                            onChange={(e) =>
                              setEntryForm((f) => ({
                                ...f,
                                tilawat_page_from: e.target.value === '' ? '' : clampInt(Number(e.target.value), 1, 20),
                              }))
                            }
                            placeholder={isBn ? '১' : '1'}
                            className={`w-full h-10 px-2.5 rounded-xl border font-bold text-xs sm:text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isBn ? 'পৃষ্ঠা পর্যন্ত' : 'Page To'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            inputMode="numeric"
                            value={entryForm.tilawat_page_to}
                            onChange={(e) =>
                              setEntryForm((f) => ({
                                ...f,
                                tilawat_page_to: e.target.value === '' ? '' : clampInt(Number(e.target.value), 1, 20),
                              }))
                            }
                            placeholder={isBn ? '১০' : '10'}
                            className={`w-full h-10 px-2.5 rounded-xl border font-bold text-xs sm:text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                            }`}
                          />
                        </div>
                      </div>

                      {/* 3 Quick 1-Tap Tilawat Page-Range Presets */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { from: 1, to: 10, bn: 'পৃঃ ১–১০', en: 'P. 1-10' },
                          { from: 11, to: 20, bn: 'পৃঃ ১১–২০', en: 'P. 11-20' },
                          { from: 1, to: 20, bn: 'পূর্ণ পারা (১–২০)', en: 'Full Para (1-20)' },
                        ].map((chip) => {
                          const active =
                            entryForm.tilawat_page_from === chip.from && entryForm.tilawat_page_to === chip.to;
                          return (
                            <button
                              key={chip.bn}
                              type="button"
                              onClick={() =>
                                setEntryForm((f) => ({
                                  ...f,
                                  tilawat_page_from: active ? '' : chip.from,
                                  tilawat_page_to: active ? '' : chip.to,
                                }))
                              }
                              className={`h-8 px-1.5 rounded-xl border text-[11px] font-bold active:scale-95 transition-all cursor-pointer truncate ${
                                active
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : isDark
                                    ? 'bg-slate-800 border-slate-700 text-slate-300'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              {isBn ? chip.bn : chip.en}
                            </button>
                          );
                        })}
                      </div>

                      {(entryForm.tilawat_para !== '' ||
                        entryForm.tilawat_page_from !== '' ||
                        entryForm.tilawat_page_to !== '') && (
                        <div
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                            isDark ? 'bg-emerald-950/30 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {formatTilawatAmount(
                            entryForm.tilawat_para,
                            entryForm.tilawat_page_from,
                            entryForm.tilawat_page_to,
                            isBn
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4.6. Weekly Sabina (সাপ্তাহিক সবিনা) */}
                <div className={`space-y-2.5 pt-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'সাপ্তাহিক সবিনা' : 'Weekly Sabina'}</span>
                  </h3>
                  <div
                    className={`p-3 rounded-2xl border space-y-2.5 transition-colors ${
                      entryForm.sabina_completed
                        ? isDark
                          ? 'bg-amber-950/25 border-amber-600/40'
                          : 'bg-amber-50/70 border-amber-200'
                        : isDark
                          ? 'bg-slate-800/50 border-slate-700/80'
                          : 'bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] sm:text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {isBn ? 'আজ সাপ্তাহিক সবিনা শুনিয়েছে?' : 'Completed Weekly Sabina today?'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              sabina_completed: false,
                            }))
                          }
                          className={`h-8 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                            !entryForm.sabina_completed
                              ? isDark
                                ? 'bg-slate-700 border-slate-600 text-white'
                                : 'bg-slate-700 border-slate-700 text-white'
                              : isDark
                                ? 'bg-slate-900/60 border-slate-700 text-slate-400'
                                : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          {isBn ? 'না' : 'No'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              sabina_completed: true,
                              ...(lastSabinaHint && !f.sabina_completed
                                ? {
                                    sabina_from_para: lastSabinaHint.nextFrom,
                                    sabina_to_para: lastSabinaHint.nextTo,
                                  }
                                : {}),
                            }))
                          }
                          className={`h-8 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                            entryForm.sabina_completed
                              ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                              : isDark
                                ? 'bg-slate-900/60 border-slate-700 text-slate-400'
                                : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          {isBn ? 'হ্যাঁ' : 'Yes'}
                        </button>
                      </div>
                    </div>

                    {entryForm.sabina_completed && (() => {
                      const sabinaSummary = formatSabinaRange(
                        entryForm.sabina_from_para,
                        entryForm.sabina_to_para,
                        isBn
                      );
                      return (
                        <div className="space-y-2.5 pt-0.5">
                          {/* Smart Serial Auto-Carryover Hint */}
                          {lastSabinaHint && (
                            <button
                              type="button"
                              onClick={() =>
                                setEntryForm((f) => ({
                                  ...f,
                                  sabina_from_para: lastSabinaHint.nextFrom,
                                  sabina_to_para: lastSabinaHint.nextTo,
                                }))
                              }
                              className={`w-full px-3 py-2 rounded-xl border text-left text-[11px] font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isDark
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-200 hover:bg-amber-500/20'
                                  : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-50'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <Sparkles size={13} className="text-amber-500 shrink-0" />
                                <span className="truncate">
                                  {isBn
                                    ? `গত সবিনা: ${lastSabinaHint.prevRangeLabel} → পরবর্তী সিরিয়াল: ${fmtNum(lastSabinaHint.nextFrom)}–${fmtNum(lastSabinaHint.nextTo)}`
                                    : `Last Sabina: ${lastSabinaHint.prevRangeLabel} → Next serial: ${lastSabinaHint.nextFrom}-${lastSabinaHint.nextTo}`}
                                </span>
                              </span>
                            </button>
                          )}

                          {/* Exact From / To Para Selectors */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-amber-900/80'}`}>
                                {isBn ? 'শুরু পারা' : 'Start Para'}
                              </label>
                              <CompactParaPicker
                                value={entryForm.sabina_from_para}
                                onChange={(val) => {
                                  if (val !== '') {
                                    setEntryForm((f) => ({
                                      ...f,
                                      sabina_from_para: val,
                                    }));
                                  }
                                }}
                                isBn={isBn}
                                isDark={isDark}
                                allowEmpty={false}
                                title={isBn ? 'সবিনা শুরু পারা নির্বাচন' : 'Select Sabina Start Para'}
                                accent="amber"
                              />
                            </div>
                            <div>
                              <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-amber-900/80'}`}>
                                {isBn ? 'শেষ পারা' : 'End Para'}
                              </label>
                              <CompactParaPicker
                                value={entryForm.sabina_to_para}
                                onChange={(val) => {
                                  if (val !== '') {
                                    setEntryForm((f) => ({
                                      ...f,
                                      sabina_to_para: val,
                                    }));
                                  }
                                }}
                                isBn={isBn}
                                isDark={isDark}
                                allowEmpty={false}
                                title={isBn ? 'সবিনা শেষ পারা নির্বাচন' : 'Select Sabina End Para'}
                                accent="amber"
                              />
                            </div>
                          </div>

                          {/* Auto-calculated Sabina Range Badge */}
                          <div
                            className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                              isDark
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                                : 'bg-amber-100/80 border-amber-300 text-amber-900'
                            }`}
                          >
                            <span className="text-xs font-black">
                              🌟 {sabinaSummary.shortRange}
                            </span>
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-500 text-white tabular-nums">
                              {isBn ? `মোট ${fmtNum(sabinaSummary.count)} পারা` : `Total ${sabinaSummary.count} Paras`}
                            </span>
                          </div>

                          {/* Quick Span Buttons */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { span: 2, bn: '+২ পারা', en: '+2 Paras' },
                              { span: 3, bn: '+৩ পারা', en: '+3 Paras' },
                              { span: 5, bn: '+৫ পারা', en: '+5 Paras' },
                              { span: 30, bn: '৩০ খতম', en: '30 Khatam' },
                            ].map((btn) => {
                              const isKhatam = btn.span === 30;
                              const active = isKhatam
                                ? entryForm.sabina_from_para === 1 && entryForm.sabina_to_para === 30
                                : sabinaSummary.count === btn.span;
                              return (
                                <button
                                  key={btn.span}
                                  type="button"
                                  onClick={() =>
                                    setEntryForm((f) =>
                                      isKhatam
                                        ? { ...f, sabina_from_para: 1, sabina_to_para: 30 }
                                        : {
                                            ...f,
                                            sabina_to_para: ((f.sabina_from_para + btn.span - 2) % 30) + 1,
                                          }
                                    )
                                  }
                                  className={`h-8 px-1.5 rounded-xl border text-[11px] font-bold active:scale-95 transition-all cursor-pointer truncate ${
                                    active
                                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                      : isDark
                                        ? 'bg-slate-900/80 border-slate-700 text-slate-200'
                                        : 'bg-white border-amber-200 text-amber-900'
                                  }`}
                                >
                                  {isBn ? btn.bn : btn.en}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 5. Mistake Counters (1-Tap Steppers) */}
                <div className={`space-y-2.5 pt-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'ভুল গণনা' : 'Mistake Counters'}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Lokma */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 ${
                        isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'লোকমা' : 'Lokma'}
                      </span>
                      <div className="flex items-center justify-between w-full gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              mistakes_lokma: Math.max(0, f.mistakes_lokma - 1),
                            }))
                          }
                          aria-label="Decrease Lokma"
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-90 transition-transform cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <Minus size={15} />
                        </button>
                        <span className="text-base font-black tabular-nums text-rose-600 dark:text-rose-400">
                          {fmtNum(entryForm.mistakes_lokma)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              mistakes_lokma: f.mistakes_lokma + 1,
                            }))
                          }
                          aria-label="Increase Lokma"
                          className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Tajweed */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 ${
                        isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'তাজবীদ ভুল' : 'Tajweed'}
                      </span>
                      <div className="flex items-center justify-between w-full gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              mistakes_tajweed: Math.max(0, f.mistakes_tajweed - 1),
                            }))
                          }
                          aria-label="Decrease Tajweed"
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-90 transition-transform cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <Minus size={15} />
                        </button>
                        <span className="text-base font-black tabular-nums text-amber-600 dark:text-amber-400">
                          {fmtNum(entryForm.mistakes_tajweed)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEntryForm((f) => ({
                              ...f,
                              mistakes_tajweed: f.mistakes_tajweed + 1,
                            }))
                          }
                          aria-label="Increase Tajweed"
                          className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Grade 1-Tap Pills */}
                <div className={`space-y-2.5 pt-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                  <h3 className={`text-[15px] sm:text-base font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    <span className="w-1.5 h-4 rounded-full bg-emerald-500 shrink-0" />
                    <span>{isBn ? 'সবকের মান' : 'Sabaq Grade'}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {
                          key: 'mumtaz' as GradeType,
                          label: isBn ? 'মুমতাজ' : 'Mumtaz',
                          activeClass: 'bg-emerald-600 border-emerald-600 text-white shadow-sm',
                          idleClass: isDark
                            ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                            : 'bg-emerald-50/70 border-emerald-200 text-emerald-800',
                        },
                        {
                          key: 'jayyid_jiddan' as GradeType,
                          label: isBn ? 'জায়্যিদ জিদ্দান' : 'Jayyid Jiddan',
                          activeClass: 'bg-blue-600 border-blue-600 text-white shadow-sm',
                          idleClass: isDark
                            ? 'bg-blue-950/30 border-blue-800/50 text-blue-300'
                            : 'bg-blue-50/70 border-blue-200 text-blue-800',
                        },
                        {
                          key: 'jayyid' as GradeType,
                          label: isBn ? 'জায়্যিদ' : 'Jayyid',
                          activeClass: 'bg-amber-500 border-amber-500 text-white shadow-sm',
                          idleClass: isDark
                            ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                            : 'bg-amber-50/70 border-amber-200 text-amber-800',
                        },
                        {
                          key: 'iada' as GradeType,
                          label: isBn ? "ই'আদাহ (পুনরায়)" : 'Iada (Repeat)',
                          activeClass: 'bg-rose-600 border-rose-600 text-white shadow-sm',
                          idleClass: isDark
                            ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                            : 'bg-rose-50/70 border-rose-200 text-rose-800',
                        },
                      ] as const
                    ).map((g) => {
                      const active = entryForm.grade === g.key;
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => setEntryForm((f) => ({ ...f, grade: g.key }))}
                          className={`h-9 px-3 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                            active ? g.activeClass : g.idleClass
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. Remarks */}
                <div className="pt-0.5">
                  <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Remarks (optional)'}
                  </label>
                  <input
                    type="text"
                    value={entryForm.remarks}
                    onChange={(e) => setEntryForm((f) => ({ ...f, remarks: e.target.value }))}
                    placeholder={isBn ? 'বিশেষ নোট লিখুন...' : 'Any notes...'}
                    className={`w-full h-10 px-3 rounded-xl border font-bold text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </form>

              {/* Sticky Footer Save CTA (+ Inline Delete for existing record) */}
              <div
                className={`px-4 sm:px-5 py-3 border-t flex items-center gap-2 shrink-0 ${
                  isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
                }`}
              >
                {dailyRecordsMap[activeStudent.id] && (
                  confirmDeleteEntry ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={deletingEntry || savingEntry}
                        onClick={() => handleDeleteHifzRecord(dailyRecordsMap[activeStudent.id], true)}
                        className="h-11 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {deletingEntry ? <Loader2 size={14} className="animate-spin" /> : <span>{isBn ? 'মুছুন' : 'Delete'}</span>}
                      </button>
                      <button
                        type="button"
                        disabled={deletingEntry}
                        onClick={() => setConfirmDeleteEntry(false)}
                        className={`h-11 px-2.5 rounded-xl border font-bold text-xs cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {isBn ? 'না' : 'No'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={savingEntry || deletingEntry}
                      onClick={() => setConfirmDeleteEntry(true)}
                      aria-label={isBn ? 'রেকর্ড মুছুন' : 'Delete entry'}
                      title={isBn ? 'রেকর্ড মুছুন' : 'Delete entry'}
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer ${
                        isDark
                          ? 'bg-rose-950/30 border-rose-800/50 text-rose-400 hover:bg-rose-950/60'
                          : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                      }`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )
                )}
                <button
                  type="button"
                  disabled={savingEntry || deletingEntry}
                  onClick={() => setActiveStudent(null)}
                  className={`flex-1 h-11 rounded-xl border font-black text-xs sm:text-sm active:scale-95 transition-transform cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  form="hifz-entry-form"
                  disabled={savingEntry || deletingEntry}
                  className="flex-[2] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingEntry ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Entry'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* HIFZ SETTINGS MODAL (Positioned cleanly above mobile bottom nav bar) */}
      {showSettingsModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-2 pt-4 pb-[88px] sm:p-4 animate-in fade-in duration-200"
            onClick={() => !savingSettings && setShowSettingsModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full sm:max-w-lg rounded-[2rem] sm:rounded-[2.5rem] border shadow-2xl max-h-[calc(100dvh-110px)] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 font-noto ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Mobile drag handle */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                <div className={`w-10 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
              </div>

              {/* Header */}
              <div
                className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Settings size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className={`text-base sm:text-lg font-black truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {isBn ? 'হিফজ ও সবক সেটিংস' : 'Hifz & Sabaq Settings'}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 truncate">
                      {isBn ? 'প্রতিটি ক্লাসের বিভাগ নির্ধারণ করুন' : 'Assign each class to a department'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => setShowSettingsModal(false)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3 custom-scrollbar">
                {classes.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-8">
                    {isBn ? 'কোনো ক্লাস পাওয়া যায়নি।' : 'No classes found.'}
                  </p>
                ) : (
                  classes.map((cls) => {
                    const currentVal: ClassDeptSetting =
                      draftClassDeptMap[cls.id] || getEffectiveClassDept(cls);
                    return (
                      <div
                        key={cls.id}
                        className={`p-3.5 rounded-2xl border space-y-2.5 ${
                          isDark ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50/90 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {cls.class_name}
                          </span>
                          {currentVal === 'off' && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                              {isBn ? 'বন্ধ' : 'Off'}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(
                            [
                              {
                                key: 'hifz' as ClassDeptSetting,
                                bn: 'হিফজ',
                                en: 'Hifz',
                                activeCls: 'bg-emerald-600 border-emerald-600 text-white shadow-sm',
                              },
                              {
                                key: 'nazera' as ClassDeptSetting,
                                bn: 'নাজেরা',
                                en: 'Nazera',
                                activeCls: 'bg-blue-600 border-blue-600 text-white shadow-sm',
                              },
                              {
                                key: 'qaida' as ClassDeptSetting,
                                bn: 'কায়দা',
                                en: 'Qaida',
                                activeCls: 'bg-amber-500 border-amber-500 text-white shadow-sm',
                              },
                              {
                                key: 'off' as ClassDeptSetting,
                                bn: 'বন্ধ',
                                en: 'Off',
                                activeCls: 'bg-rose-600 border-rose-600 text-white shadow-sm',
                              },
                            ] as const
                          ).map((opt) => {
                            const active = currentVal === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() =>
                                  setDraftClassDeptMap((prev) => ({
                                    ...prev,
                                    [cls.id]: opt.key,
                                  }))
                                }
                                className={`min-h-[40px] px-2 rounded-xl border text-xs font-black active:scale-95 transition-all cursor-pointer ${
                                  active
                                    ? opt.activeCls
                                    : isDark
                                      ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {isBn ? opt.bn : opt.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sticky Footer */}
              <div
                className={`px-5 py-3.5 border-t flex items-center gap-2.5 shrink-0 ${
                  isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
                }`}
              >
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => setShowSettingsModal(false)}
                  className={`flex-1 h-12 rounded-2xl border font-black text-xs sm:text-sm active:scale-95 transition-transform cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={handleSaveSettings}
                  className="flex-[2] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Settings'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Floating Toast Notification */}
      {toast.show &&
        createPortal(
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[250] px-4 w-full max-w-sm pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs sm:text-sm font-black font-noto ${
                toast.type === 'success'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-rose-600 border-rose-500 text-white'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0" />
              ) : (
                <AlertCircle size={18} className="shrink-0" />
              )}
              <span className="truncate">{toast.message}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default HifzTracker;
