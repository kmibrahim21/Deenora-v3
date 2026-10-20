import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check, X, Sparkles } from 'lucide-react';
import { MONTH_DEFINITIONS } from '../../utils/feeCategoryHelper';

interface DobPickerProps {
  value: string; // e.g. "2015-08-15"
  onChange: (val: string) => void;
  label?: string;
  lang?: 'en' | 'bn';
  isDark?: boolean;
  placeholder?: string;
  className?: string;
}

export const DobPicker: React.FC<DobPickerProps> = ({
  value,
  onChange,
  label,
  lang = 'bn',
  isDark = false,
  placeholder,
  className
}) => {
  const isBangla = lang === 'bn';
  const currentYear = new Date().getFullYear();

  // Generate range of birth years (e.g., currentYear down to 1980)
  const years: number[] = [];
  for (let y = currentYear; y >= 1980; y--) {
    years.push(y);
  }

  // Parse value "YYYY-MM-DD"
  const parts = (value || '').split('-');
  const initialYear = parseInt(parts[0], 10) || (currentYear - 10);
  const initialMonth = parts[1] || '01';
  const initialDay = parseInt(parts[2], 10) || 1;

  const [isOpen, setIsOpen] = useState(false);
  const [selYear, setSelYear] = useState<number>(initialYear);
  const [selMonth, setSelMonth] = useState<string>(initialMonth);
  const [selDay, setSelDay] = useState<number>(initialDay);
  const [activeTab, setActiveTab] = useState<'year' | 'month' | 'day'>('year');

  useEffect(() => {
    if (value) {
      const p = value.split('-');
      if (p.length === 3) {
        const y = parseInt(p[0], 10);
        const m = p[1];
        const d = parseInt(p[2], 10);
        if (y) setSelYear(y);
        if (m) setSelMonth(m);
        if (d) setSelDay(d);
      }
    }
  }, [value]);

  // Calculate days in selected month
  const getDaysInMonth = (year: number, monthStr: string) => {
    const monthNum = parseInt(monthStr, 10);
    return new Date(year, monthNum, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selYear, selMonth);

  // Bengali Number Helper
  const toBn = (num: number | string) => {
    if (!isBangla) return num.toString();
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  };

  // Get Month Label
  const monthDef = MONTH_DEFINITIONS.find(m => m.value === selMonth) || MONTH_DEFINITIONS[0];
  const monthName = isBangla ? monthDef.nameBn : monthDef.nameEn;

  // Formatted Label for trigger
  const formattedDisplay = value
    ? `${toBn(selDay)} ${monthName}, ${toBn(selYear)}`
    : placeholder || (isBangla ? 'জন্ম তারিখ নির্বাচন করুন' : 'Select Date of Birth');

  const handleConfirm = () => {
    // Ensure day is valid for month
    const validDay = Math.min(selDay, daysInMonth);
    const dayStr = String(validDay).padStart(2, '0');
    const monthStr = selMonth.padStart(2, '0');
    onChange(`${selYear}-${monthStr}-${dayStr}`);
    setIsOpen(false);
  };

  // Calculate Age
  const calculatedAge = currentYear - selYear;

  return (
    <div className={`w-full ${className || ''}`}>
      {label && (
        <label className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'}`}>
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full h-[54px] px-5 flex items-center justify-between border-2 rounded-[1.2rem] outline-none font-black text-sm transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-white hover:border-slate-600'
            : 'bg-slate-50 border-slate-100 text-[#1E293B] hover:border-[#2563EB] shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3 truncate">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <span className={`truncate ${!value ? 'text-slate-400 font-medium' : ''}`}>
            {formattedDisplay}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-bold ml-2 shrink-0">▼</span>
      </button>

      {/* Centered Modal Popup */}
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
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black font-noto">
                    {isBangla ? 'শিক্ষার্থীর জন্ম তারিখ' : 'Student Date of Birth'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isBangla ? `বয়স আনুমানিক: ${toBn(calculatedAge)} বছর` : `Approx. Age: ${calculatedAge} Yrs`}
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
            <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#2563EB] dark:text-blue-400 shrink-0" />
                <span className="text-xs font-black text-[#1E3A8A] dark:text-blue-300">
                  {toBn(selDay)} {monthName}, {toBn(selYear)}
                </span>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                {toBn(calculatedAge)} {isBangla ? 'বছর' : 'yrs'}
              </span>
            </div>

            {/* Tab Navigation: Year | Month | Day */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('year')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'year'
                    ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {isBangla ? `১. বছর (${toBn(selYear)})` : `1. Year (${selYear})`}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'month'
                    ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-blue-300 shadow-xs'
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
                    ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {isBangla ? `৩. দিন (${toBn(selDay)})` : `3. Day (${selDay})`}
              </button>
            </div>

            {/* Content Views */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] max-h-[280px]">
              {/* TAB 1: YEAR SELECTION GRID */}
              {activeTab === 'year' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {isBangla ? 'জন্মের বছর বেছে নিন:' : 'Select Year of Birth:'}
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {years.map(yr => {
                      const isSelected = yr === selYear;
                      const age = currentYear - yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setSelYear(yr);
                            setActiveTab('month'); // auto advance to month
                          }}
                          className={`py-2.5 px-2 rounded-2xl text-xs font-black flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-[#2563EB] border border-slate-200/80'
                          }`}
                        >
                          <span className="text-xs font-black">{toBn(yr)}</span>
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {toBn(age)} {isBangla ? 'বছর' : 'yrs'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: MONTH SELECTION GRID */}
              {activeTab === 'month' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {isBangla ? 'জন্মের মাস বেছে নিন:' : 'Select Month:'}
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
                              ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-[#2563EB] border border-slate-200/80'
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

              {/* TAB 3: DAY SELECTION GRID */}
              {activeTab === 'day' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    {isBangla ? 'তারিখ (দিন) বেছে নিন:' : 'Select Day:'}
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
                              ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30 scale-105'
                              : isDark
                              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                              : 'bg-slate-50 text-slate-800 hover:bg-blue-50 hover:text-[#2563EB] border border-slate-200/80'
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
                className="flex-1 py-3 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all"
              >
                <Check size={16} strokeWidth={3} />
                <span>{isBangla ? 'সেভ করুন' : 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
