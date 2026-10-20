import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X, Sparkles } from 'lucide-react';
import { MONTH_DEFINITIONS } from '../../utils/feeCategoryHelper';

interface SmartDatePickerProps {
  value: string; // e.g. "2026-10-15"
  onChange: (val: string) => void;
  label?: string;
  lang?: 'en' | 'bn';
  isDark?: boolean;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  className?: string;
}

export const SmartDatePicker: React.FC<SmartDatePickerProps> = ({
  value,
  onChange,
  label,
  lang = 'bn',
  isDark = false,
  minDate,
  maxDate,
  placeholder,
  className
}) => {
  const isBangla = lang === 'bn';

  // Parse YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = getTodayStr();
  const dateVal = value || todayStr;

  const parts = dateVal.split('-');
  const initialYear = parseInt(parts[0], 10) || new Date().getFullYear();
  const initialMonth = parseInt(parts[1], 10) - 1 || new Date().getMonth(); // 0-indexed
  const initialDay = parseInt(parts[2], 10) || new Date().getDate();

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth); // 0-11

  useEffect(() => {
    if (value && value.includes('-')) {
      const p = value.split('-');
      const y = parseInt(p[0], 10);
      const m = parseInt(p[1], 10) - 1;
      if (y && !isNaN(y)) setViewYear(y);
      if (m >= 0 && m <= 11) setViewMonth(m);
    }
  }, [value]);

  // Helpers
  const toBn = (num: number | string) => {
    if (!isBangla) return num.toString();
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  };

  const monthDef = MONTH_DEFINITIONS[viewMonth] || MONTH_DEFINITIONS[0];
  const monthName = isBangla ? monthDef.nameBn : monthDef.nameEn;

  // Days of week labels (Sat to Fri for BD context)
  const weekDays = isBangla
    ? ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র']
    : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // Calculate calendar grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // First day of month (0 = Sun, 1 = Mon ... 6 = Sat)
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
  // Adjust so 0 = Sat, 1 = Sun, 2 = Mon ... 6 = Fri
  const startDayIndex = (firstDayRaw + 1) % 7;

  // Format display label
  const curParts = dateVal.split('-');
  const curY = parseInt(curParts[0], 10);
  const curM = parseInt(curParts[1], 10) - 1;
  const curD = parseInt(curParts[2], 10);
  const curMonthName = isBangla
    ? (MONTH_DEFINITIONS[curM] ? MONTH_DEFINITIONS[curM].nameBn : '')
    : (MONTH_DEFINITIONS[curM] ? MONTH_DEFINITIONS[curM].nameEn : '');

  const isToday = dateVal === todayStr;
  const displayLabel = value
    ? `${toBn(curD)} ${curMonthName}, ${toBn(curY)} ${isToday ? (isBangla ? '(আজ)' : '(Today)') : ''}`
    : placeholder || (isBangla ? 'তারিখ নির্বাচন করুন' : 'Select Date');

  const handleSelectDate = (day: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const selectedDateStr = `${viewYear}-${monthStr}-${dayStr}`;

    // Check min / max constraints
    if (minDate && selectedDateStr < minDate) return;
    if (maxDate && selectedDateStr > maxDate) return;

    onChange(selectedDateStr);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const t = getTodayStr();
    onChange(t);
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsOpen(false);
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const yestStr = `${y}-${m}-${day}`;
    onChange(yestStr);
    setViewYear(y);
    setViewMonth(d.getMonth());
    setIsOpen(false);
  };

  return (
    <div className={`w-full ${className || ''}`}>
      {label && (
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full h-14 pl-12 pr-4 flex items-center justify-between border-2 rounded-2xl font-black text-sm transition-all cursor-pointer relative ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100 hover:border-slate-600'
            : 'bg-slate-50 border-slate-100 text-[#1E3A8A] hover:border-[#2563EB]/40 shadow-xs'
        }`}
      >
        <CalendarIcon className="absolute left-4 top-4 text-[#2563EB]" size={20} />
        <span className="truncate">{displayLabel}</span>
        <span className="text-xs text-slate-400 font-bold ml-2 shrink-0">▼</span>
      </button>

      {/* Centered Modal Popup */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-xs sm:max-w-sm rounded-3xl p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-200 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black font-noto">
                    {isBangla ? 'তারিখ নির্বাচন করুন' : 'Select Date'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {label || (isBangla ? 'কাঙ্ক্ষিত দিন পছন্দ করুন' : 'Choose date')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Presets (Today / Yesterday) */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleSetToday}
                className="flex-1 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-300 font-extrabold text-[11px] border border-blue-100 dark:border-blue-900/40 hover:opacity-90 transition-opacity"
              >
                {isBangla ? 'আজকে' : 'Today'}
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px] hover:opacity-90 transition-opacity"
              >
                {isBangla ? 'গতকাল' : 'Yesterday'}
              </button>
            </div>

            {/* Month & Year Navigator */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(prev => prev - 1);
                  } else {
                    setViewMonth(prev => prev - 1);
                  }
                }}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-xs transition-all"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="text-center">
                <span className="text-xs font-black block">
                  {monthName} {toBn(viewYear)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(prev => prev + 1);
                  } else {
                    setViewMonth(prev => prev + 1);
                  }
                }}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-xs transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekDays.map((wd, i) => (
                <span
                  key={wd}
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    i === 6 ? 'text-rose-500' : 'text-slate-400'
                  }`}
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty leading cells */}
              {Array.from({ length: startDayIndex }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-9" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const mStr = String(viewMonth + 1).padStart(2, '0');
                const dStr = String(d).padStart(2, '0');
                const cellDateStr = `${viewYear}-${mStr}-${dStr}`;

                const isSelected = cellDateStr === dateVal;
                const isTodayCell = cellDateStr === todayStr;

                const isDisabled =
                  (minDate && cellDateStr < minDate) || (maxDate && cellDateStr > maxDate);

                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDate(d)}
                    className={`h-9 rounded-xl text-xs font-black flex items-center justify-center relative transition-all cursor-pointer ${
                      isDisabled
                        ? 'opacity-20 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/30 scale-105'
                        : isTodayCell
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-300 border border-blue-200 dark:border-blue-700/60 font-black'
                        : isDark
                        ? 'text-slate-200 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {toBn(d)}
                  </button>
                );
              })}
            </div>

            {/* Close / Cancel Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`w-full py-2.5 rounded-2xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isBangla ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
