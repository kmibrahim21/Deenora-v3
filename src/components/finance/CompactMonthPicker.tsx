import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { MONTH_DEFINITIONS } from '../../utils/feeCategoryHelper';

interface CompactMonthPickerProps {
  value: string; // e.g. "2026-01"
  onChange: (value: string) => void;
  label?: string;
  lang?: 'en' | 'bn';
  isDark?: boolean;
  availableYears?: number[];
}

export const CompactMonthPicker: React.FC<CompactMonthPickerProps> = ({
  value,
  onChange,
  label,
  lang = 'bn',
  isDark = false,
  availableYears
}) => {
  const isBangla = lang === 'bn';
  const currentYear = new Date().getFullYear();
  const years = availableYears || [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  // Parse value
  const parts = (value || '').split('-');
  const valYear = parseInt(parts[0], 10) || currentYear;
  const valMonth = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0');

  const [isOpen, setIsOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<number>(valYear);

  useEffect(() => {
    if (valYear && years.includes(valYear)) {
      setActiveYear(valYear);
    }
  }, [valYear]);

  const selectedMonthDef = MONTH_DEFINITIONS.find(m => m.value === valMonth) || MONTH_DEFINITIONS[0];
  const yearText = isBangla
    ? valYear.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)])
    : valYear.toString();
  const displayLabel = `${isBangla ? selectedMonthDef.nameBn : selectedMonthDef.nameEn} ${yearText}`;

  const handleSelectMonth = (monthVal: string) => {
    onChange(`${activeYear}-${monthVal}`);
    setIsOpen(false);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
          {label}
        </label>
      )}

      {/* Trigger Field / Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full h-10 sm:h-11 rounded-xl px-3 flex items-center justify-between border text-xs font-black transition-all cursor-pointer ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100 hover:border-slate-600'
            : 'bg-white border-slate-200 text-[#1E3A8A] hover:border-[#2563EB] shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar size={15} className="text-[#2563EB] shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold ml-1 shrink-0">▼</span>
      </button>

      {/* Centered Modal Popup */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-xs sm:max-w-sm rounded-3xl p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-200 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-[#2563EB] dark:text-blue-400">
                  <Calendar size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black font-noto">
                    {isBangla ? 'মাস ও বছর নির্বাচন করুন' : 'Select Month & Year'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {label || (isBangla ? 'নির্দিষ্ট মাস পছন্দ করুন' : 'Choose target month')}
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

            {/* Year Switcher */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const idx = years.indexOf(activeYear);
                  if (idx > 0) setActiveYear(years[idx - 1]);
                }}
                disabled={years.indexOf(activeYear) <= 0}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-xs disabled:opacity-30 disabled:shadow-none transition-all"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {years.map(yr => {
                  const yrStr = isBangla
                    ? yr.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)])
                    : yr.toString();
                  const isCurYr = yr === activeYear;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setActiveYear(yr)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all ${
                        isCurYr
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {yrStr}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const idx = years.indexOf(activeYear);
                  if (idx >= 0 && idx < years.length - 1) setActiveYear(years[idx + 1]);
                }}
                disabled={years.indexOf(activeYear) >= years.length - 1}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-xs disabled:opacity-30 disabled:shadow-none transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 12 Months Grid (3 columns x 4 rows) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {MONTH_DEFINITIONS.map(m => {
                const isSelected = activeYear === valYear && m.value === valMonth;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => handleSelectMonth(m.value)}
                    className={`py-2.5 px-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30 scale-[1.02]'
                        : isDark
                        ? 'bg-slate-800/80 text-slate-200 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                        : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-[#2563EB] border border-slate-200/80'
                    }`}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                    <span className="truncate">{isBangla ? m.nameBn : m.nameEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Cancel Button */}
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
