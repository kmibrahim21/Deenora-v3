import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Check, X, Sparkles, ChevronDown } from 'lucide-react';

interface HijriDatePickerProps {
  value: string; // e.g. "০১ মুহাররম ১৪৪৬" or "01 Muharram 1446"
  onChange: (val: string) => void;
  label?: string;
  lang?: 'en' | 'bn';
  isDark?: boolean;
  placeholder?: string;
  className?: string;
}

export const HIJRI_MONTHS = [
  { value: '01', nameBn: 'মুহাররম', nameEn: 'Muharram' },
  { value: '02', nameBn: 'সফর', nameEn: 'Safar' },
  { value: '03', nameBn: 'রবিউল আউয়াল', nameEn: "Rabi' al-Awwal" },
  { value: '04', nameBn: 'রবিউস সানি', nameEn: "Rabi' al-Thani" },
  { value: '05', nameBn: 'জমাদিউল আউয়াল', nameEn: 'Jumada al-Awwal' },
  { value: '06', nameBn: 'জমাদিউস সানি', nameEn: 'Jumada al-Thani' },
  { value: '07', nameBn: 'রজব', nameEn: 'Rajab' },
  { value: '08', nameBn: 'শাবান', nameEn: "Sha'ban" },
  { value: '09', nameBn: 'রমজান', nameEn: 'Ramadan' },
  { value: '10', nameBn: 'শাওয়াল', nameEn: 'Shawwal' },
  { value: '11', nameBn: 'জিলকদ', nameEn: 'Dhul Qi-dah' },
  { value: '12', nameBn: 'জিলহজ', nameEn: 'Dhul Hijjah' },
];

export const HijriDatePicker: React.FC<HijriDatePickerProps> = ({
  value,
  onChange,
  label,
  lang = 'bn',
  isDark = false,
  placeholder,
  className
}) => {
  const isBangla = lang === 'bn';

  // Range of Hijri Years (e.g. 1442 to 1452)
  const hijriYears: number[] = [1442, 1443, 1444, 1445, 1446, 1447, 1448, 1449, 1450, 1451, 1452];

  const toBn = (num: number | string) => {
    if (!isBangla) return num.toString();
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  };

  const toEn = (str: string) => {
    return str.replace(/[০-৯]/g, d => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(d)]);
  };

  // Helper to parse existing string (e.g. "০১ মুহাররম ১৪৪৬")
  const parseHijriString = (raw: string) => {
    if (!raw) return { year: 1446, month: '01', day: 1 };
    const normalized = toEn(raw);
    const yearMatch = normalized.match(/(14[0-9]{2})/);
    const dayMatch = normalized.match(/^(\d{1,2})/);

    let foundMonth = '01';
    for (const m of HIJRI_MONTHS) {
      if (raw.includes(m.nameBn) || raw.toLowerCase().includes(m.nameEn.toLowerCase())) {
        foundMonth = m.value;
        break;
      }
    }

    const yr = yearMatch ? parseInt(yearMatch[1], 10) : 1446;
    const dy = dayMatch ? parseInt(dayMatch[1], 10) : 1;

    return { year: yr, month: foundMonth, day: dy };
  };

  const initial = parseHijriString(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selYear, setSelYear] = useState<number>(initial.year);
  const [selMonth, setSelMonth] = useState<string>(initial.month);
  const [selDay, setSelDay] = useState<number>(initial.day);
  const [activeTab, setActiveTab] = useState<'year' | 'month' | 'day'>('year');

  useEffect(() => {
    if (value) {
      const parsed = parseHijriString(value);
      setSelYear(parsed.year);
      setSelMonth(parsed.month);
      setSelDay(parsed.day);
    }
  }, [value]);

  const monthDef = HIJRI_MONTHS.find(m => m.value === selMonth) || HIJRI_MONTHS[0];
  const monthName = isBangla ? monthDef.nameBn : monthDef.nameEn;

  const formattedDisplay = value || placeholder || (isBangla ? 'আরবি তারিখ নির্বাচন করুন' : 'Select Arabic Date');

  const handleConfirm = () => {
    const dayStr = String(selDay).padStart(2, '0');
    let formatted = '';
    if (isBangla) {
      formatted = `${toBn(dayStr)} ${monthName} ${toBn(selYear)}`;
    } else {
      formatted = `${dayStr} ${monthName} ${selYear}`;
    }
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`w-full ${className || ''}`}>
      {label && (
        <label className={`block text-[10px] font-black uppercase tracking-widest px-1 mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setActiveTab('year');
          setIsOpen(true);
        }}
        className={`w-full h-12 px-4 flex items-center justify-between border rounded-xl outline-none font-black text-sm transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
            : 'bg-slate-50 border-slate-100 text-[#1E3A8A] hover:border-[#2563EB]/40 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Moon size={15} />
          </div>
          <span className={`truncate text-sm font-bold ${!value ? 'text-slate-400' : ''}`}>
            {formattedDisplay}
          </span>
        </div>
        <ChevronDown size={15} className="text-slate-400 ml-2 shrink-0" />
      </button>

      {/* Centered Modal Popup Portal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-sm sm:max-w-md rounded-3xl p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Moon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black font-noto">
                    {label || (isBangla ? 'আরবি তারিখ নির্বাচন' : 'Select Hijri Date')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isBangla ? 'হিজরি সাল, আরবি মাস ও দিন নির্বাচন করুন' : 'Select Hijri year, month & day'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selection Summary Pill */}
            <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                  {toBn(String(selDay).padStart(2, '0'))} {monthName}, {toBn(selYear)} হিজরি
                </span>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                {toBn(selYear)} হিজরি
              </span>
            </div>

            {/* Tab Navigation: Year | Month | Day */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('year')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'year'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {isBangla ? `১. সাল (${toBn(selYear)})` : `1. Year (${selYear})`}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'month'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {isBangla ? `২. মাস (${monthName.slice(0, 5)})` : `2. Month (${monthName.slice(0, 3)})`}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('day')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'day'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {isBangla ? `৩. দিন (${toBn(selDay)})` : `3. Day (${selDay})`}
              </button>
            </div>

            {/* Content Views */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] max-h-[280px]">
              {/* TAB 1: HIJRI YEAR SELECTION GRID */}
              {activeTab === 'year' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {isBangla ? 'হিজরি সাল বেছে নিন:' : 'Select Hijri Year:'}
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {hijriYears.map(yr => {
                      const isSelected = yr === selYear;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setSelYear(yr);
                            setActiveTab('month'); // auto advance to month
                          }}
                          className={`py-3 px-2 rounded-2xl text-xs font-black flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                          }`}
                        >
                          <span className="text-sm font-black">{toBn(yr)} হিজরি</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: HIJRI MONTH SELECTION GRID */}
              {activeTab === 'month' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {isBangla ? 'আরবি মাস বেছে নিন:' : 'Select Hijri Month:'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {HIJRI_MONTHS.map(m => {
                      const isSelected = m.value === selMonth;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setSelMonth(m.value);
                            setActiveTab('day'); // auto advance to day
                          }}
                          className={`py-3 px-3 rounded-2xl text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                          }`}
                        >
                          <span>{isBangla ? m.nameBn : m.nameEn}</span>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: DAY SELECTION GRID (1 to 30) */}
              {activeTab === 'day' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {isBangla ? 'তারিখ (১-৩০ দিন) বেছে নিন:' : 'Select Day (1-30):'}
                  </span>
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(d => {
                      const isSelected = d === selDay;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelDay(d)}
                          className={`h-10 rounded-2xl text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30 scale-105'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80'
                          }`}
                        >
                          {toBn(d)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className={`py-3 px-4 rounded-2xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {isBangla ? 'মুছুন' : 'Clear'}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isBangla ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check size={16} strokeWidth={3} />
                <span>{isBangla ? 'নিশ্চিত করুন' : 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
