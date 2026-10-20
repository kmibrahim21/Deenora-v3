import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Check, X, Sparkles, ChevronDown } from 'lucide-react';
import { MONTH_DEFINITIONS } from '../../utils/feeCategoryHelper';

interface DeenoraDatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
  label?: string;
  title?: string;
  placeholder?: string;
  allowClear?: boolean;
  onClear?: () => void;
  className?: string;
  isDark?: boolean;
  minYear?: number;
  maxYear?: number;
}

export const DeenoraDatePicker: React.FC<DeenoraDatePickerProps> = ({
  value,
  onChange,
  label,
  title = 'ডায়েরির তারিখ নির্বাচন করুন',
  placeholder = 'তারিখ নির্বাচন করুন',
  allowClear = false,
  onClear,
  className,
  isDark = false,
  minYear,
  maxYear,
}) => {
  const currentYear = new Date().getFullYear();
  const startYr = minYear || (currentYear - 3);
  const endYr = maxYear || (currentYear + 2);

  const years: number[] = [];
  for (let y = endYr; y >= startYr; y--) {
    years.push(y);
  }

  // Parse value "YYYY-MM-DD"
  const parts = (value || '').split('-');
  const initialYear = parseInt(parts[0], 10) || currentYear;
  const initialMonth = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
  const initialDay = parseInt(parts[2], 10) || new Date().getDate();

  const [isOpen, setIsOpen] = useState(false);
  const [selYear, setSelYear] = useState<number>(initialYear);
  const [selMonth, setSelMonth] = useState<string>(initialMonth);
  const [selDay, setSelDay] = useState<number>(initialDay);
  const [activeTab, setActiveTab] = useState<'year' | 'month' | 'day'>('day');

  useEffect(() => {
    if (value && value.includes('-')) {
      const p = value.split('-');
      if (p.length === 3) {
        const y = parseInt(p[0], 10);
        const m = p[1];
        const d = parseInt(p[2], 10);
        if (y) setSelYear(y);
        if (m) setSelMonth(m.padStart(2, '0'));
        if (d) setSelDay(d);
      }
    }
  }, [value]);

  const getDaysInMonth = (year: number, monthStr: string) => {
    const monthNum = parseInt(monthStr, 10);
    return new Date(year, monthNum, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selYear, selMonth);

  const toBn = (num: number | string) => {
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  };

  const monthDef = MONTH_DEFINITIONS.find(m => m.value === selMonth) || MONTH_DEFINITIONS[0];
  const monthName = monthDef ? monthDef.nameBn : 'অক্টোবর';

  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const applyDateString = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    setSelYear(parseInt(y, 10));
    setSelMonth(m);
    setSelDay(parseInt(d, 10));
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleConfirm = () => {
    const validDay = Math.min(selDay, daysInMonth);
    const dayStr = String(validDay).padStart(2, '0');
    const monthStr = selMonth.padStart(2, '0');
    onChange(`${selYear}-${monthStr}-${dayStr}`);
    setIsOpen(false);
  };

  // Relative Tag
  const isToday = value === getTodayStr();
  const isYesterday = value === getYesterdayStr();
  const isTomorrow = value === getTomorrowStr();

  const formattedDisplay = value
    ? `${toBn(selDay)} ${monthName} ${toBn(selYear)}`
    : placeholder;

  return (
    <div className={`w-full ${className || ''}`}>
      {label && (
        <label className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'}`}>
          {label}
        </label>
      )}

      {/* Trigger Button - Matches DobPicker visual identity */}
      <div className="flex items-center gap-1.5 w-full">
        <button
          type="button"
          onClick={() => {
            setActiveTab('day');
            setIsOpen(true);
          }}
          className={`flex-1 h-14 px-4 flex items-center justify-between border-2 rounded-2xl outline-none font-black text-sm transition-all cursor-pointer ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white hover:border-slate-600'
              : 'bg-slate-50 border-slate-100 hover:border-blue-500 text-slate-800 shadow-xs hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-3 truncate">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CalendarIcon size={18} />
            </div>
            <span className={`truncate text-sm font-black ${!value ? 'text-slate-400 font-medium' : ''}`}>
              {formattedDisplay}
            </span>
          </div>
          <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" />
        </button>

        {allowClear && value && (
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
              else onChange('');
            }}
            className="h-14 px-3 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-2xl font-bold text-xs transition-colors shrink-0 flex items-center justify-center cursor-pointer border border-slate-200"
            title="ফিল্টার মুছে ফেলুন"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Centered Modal Popup - Same DobPicker structure */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
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
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black font-noto">
                    {title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    দিন, মাস ও বছর নির্বাচন করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Chips: আজ | গতকাল | আগামীকাল */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => applyDateString(getTodayStr())}
                className="flex-1 py-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl font-black text-xs transition-all shadow-2xs text-center cursor-pointer"
              >
                📅 আজ
              </button>
              <button
                type="button"
                onClick={() => applyDateString(getYesterdayStr())}
                className="flex-1 py-2 bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 rounded-xl font-black text-xs transition-all shadow-2xs text-center cursor-pointer"
              >
                গতকাল
              </button>
              <button
                type="button"
                onClick={() => applyDateString(getTomorrowStr())}
                className="flex-1 py-2 bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 rounded-xl font-black text-xs transition-all shadow-2xs text-center cursor-pointer"
              >
                আগামীকাল
              </button>
            </div>

            {/* Selection Summary Pill */}
            <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-black text-blue-900 dark:text-blue-300">
                  {toBn(selDay)} {monthName} {toBn(selYear)}
                </span>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-600 text-white">
                তারিখ
              </span>
            </div>

            {/* Tab Navigation: Year | Month | Day */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('day')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'day'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                ১. দিন ({toBn(selDay)})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                ২. মাস ({monthName.slice(0, 5)})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('year')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'year'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                ৩. বছর ({toBn(selYear)})
              </button>
            </div>

            {/* Content Views */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] max-h-[280px]">
              {/* TAB: DAY SELECTION GRID */}
              {activeTab === 'day' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    তারিখ (দিন) বেছে নিন:
                  </span>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                      const isSelected = d === selDay;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelDay(d)}
                          className={`h-10 rounded-2xl text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30 scale-105'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80'
                          }`}
                        >
                          {toBn(d)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: MONTH SELECTION GRID */}
              {activeTab === 'month' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    মাস বেছে নিন:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MONTH_DEFINITIONS.map(m => {
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
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80'
                          }`}
                        >
                          <span>{m.nameBn}</span>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: YEAR SELECTION GRID */}
              {activeTab === 'year' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    বছর বেছে নিন:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {years.map(yr => {
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
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80'
                          }`}
                        >
                          <span className="text-sm font-black">{toBn(yr)}</span>
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
                onClick={() => setIsOpen(false)}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                বাতিল
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check size={16} strokeWidth={3} />
                <span>তারিখ নিশ্চিত করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
