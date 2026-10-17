import React, { useState } from 'react';
import { Institution, Language, Class } from '../../types';
import { supabase } from '../../supabase';
import { 
  Settings, 
  X, 
  CheckCircle2, 
  Trophy, 
  Sparkles, 
  Layers, 
  Search, 
  Check, 
  BookOpen,
  Info
} from 'lucide-react';

interface ExamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  madrasah: Institution | null;
  lang: Language;
  classes: Class[];
  onConfigUpdated?: (updatedConfig: any) => void;
}

export const ExamSettingsModal: React.FC<ExamSettingsModalProps> = ({
  isOpen,
  onClose,
  madrasah,
  lang,
  classes,
  onConfigUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'class_systems' | 'merit_rules' | 'optional_subject'>('class_systems');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessClassId, setSavedSuccessClassId] = useState<string | null>(null);

  if (!isOpen || !madrasah) return null;

  const isSchool = madrasah.institution_type === 'school';
  const classEngines: Record<string, string> = (madrasah.config_json as any)?.class_result_engines || {};
  const currentMeritMode = (madrasah.config_json as any)?.merit_ranking_mode || 'total_marks_first';
  const currentOptionalMode = (madrasah.config_json as any)?.optional_subject_total_mode || 'include';

  // Update Class-Wise Engine
  const handleUpdateClassEngine = async (classId: string, targetEngine: 'gpa' | 'befaq' | 'high_school') => {
    if (!madrasah?.id) return;
    setIsSaving(true);
    setSavedSuccessClassId(classId);

    try {
      const updatedClassEngines = {
        ...((madrasah.config_json as any)?.class_result_engines || {}),
        [classId]: targetEngine
      };

      const updatedConfig = {
        ...(madrasah.config_json || {}),
        class_result_engines: updatedClassEngines
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;

      if (madrasah.config_json) {
        (madrasah.config_json as any).class_result_engines = updatedClassEngines;
      }

      if (onConfigUpdated) {
        onConfigUpdated(updatedConfig);
      }

      setTimeout(() => {
        setSavedSuccessClassId(null);
      }, 1500);
    } catch (err) {
      console.error('Error updating class result engine:', err);
      setSavedSuccessClassId(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Update Merit Ranking Mode
  const handleSetMeritRankingMode = async (mode: 'gpa_first' | 'total_marks_first' | 'off') => {
    if (!madrasah?.id) return;
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...(madrasah.config_json || {}),
        merit_ranking_mode: mode
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;

      if (madrasah.config_json) {
        (madrasah.config_json as any).merit_ranking_mode = mode;
      }

      if (onConfigUpdated) {
        onConfigUpdated(updatedConfig);
      }
    } catch (err) {
      console.error('Error updating merit ranking mode:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Update 4th / Optional Subject Mode
  const handleSetOptionalSubjectTotalMode = async (mode: 'exclude' | 'bonus_above_40' | 'include') => {
    if (!madrasah?.id) return;
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...(madrasah.config_json || {}),
        optional_subject_total_mode: mode
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;

      if (madrasah.config_json) {
        (madrasah.config_json as any).optional_subject_total_mode = mode;
      }

      if (onConfigUpdated) {
        onConfigUpdated(updatedConfig);
      }
    } catch (err) {
      console.error('Error updating optional subject total mode:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredClasses = classes.filter(cls => 
    !searchQuery.trim() || cls.class_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className={`w-full sm:max-w-xl md:max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] p-4 sm:p-7 shadow-2xl border ${
        madrasah?.theme === 'dark' 
          ? 'bg-slate-900 border-slate-800 text-white' 
          : 'bg-white border-slate-100 text-slate-800'
      } max-h-[92vh] sm:max-h-[88vh] flex flex-col transition-all duration-300`}>
        
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800 mb-3 sm:mb-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-[#2563EB] dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800/50 shrink-0">
              <Settings size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black font-noto truncate">
                {lang === 'bn' ? 'পরীক্ষা ও রেজাল্ট সেটিংস' : 'Exam & Result Settings'}
              </h3>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate">
                {lang === 'bn' ? 'শ্রেণিভিত্তিক রেজাল্ট সিস্টেম ও মেধা নিয়মাবলি' : 'Class-wise result systems & ranking rules'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors shrink-0 active:scale-95"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Responsive Tab Selector with no-scrollbar and compact mobile labels */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-3 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('class_systems')}
            className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-98 ${
              activeTab === 'class_systems'
                ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers size={13} className="shrink-0" />
            <span className="hidden sm:inline">{lang === 'bn' ? 'শ্রেণিভিত্তিক সিস্টেম' : 'Class Systems'}</span>
            <span className="sm:hidden">{lang === 'bn' ? 'শ্রেণি সিস্টেম' : 'Classes'}</span>
          </button>

          <button
            onClick={() => setActiveTab('merit_rules')}
            className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-98 ${
              activeTab === 'merit_rules'
                ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Trophy size={13} className="shrink-0" />
            <span className="hidden sm:inline">{lang === 'bn' ? 'মেধাস্থান নিয়মাবলি' : 'Merit Ranking'}</span>
            <span className="sm:hidden">{lang === 'bn' ? 'মেধাস্থান' : 'Merit'}</span>
          </button>

          <button
            onClick={() => setActiveTab('optional_subject')}
            className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-98 ${
              activeTab === 'optional_subject'
                ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles size={13} className="shrink-0" />
            <span className="hidden sm:inline">{lang === 'bn' ? '৪র্থ / ঐচ্ছিক বিষয়' : '4th Subject'}</span>
            <span className="sm:hidden">{lang === 'bn' ? '৪র্থ বিষয়' : '4th Sub'}</span>
          </button>
        </div>

        {/* Tab 1: Class-Wise Systems */}
        {activeTab === 'class_systems' && (
          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5 overscroll-contain">
            {/* Sleek, Compact Info Tip Banner */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border text-[11px] font-bold leading-relaxed flex items-start gap-2 ${
              madrasah?.theme === 'dark' 
                ? 'bg-slate-800/40 border-slate-700 text-slate-300' 
                : 'bg-blue-50/60 border-blue-100 text-slate-600'
            }`}>
              <Info size={15} className="shrink-0 text-[#2563EB] dark:text-blue-400 mt-0.5" />
              <p>
                {lang === 'bn' 
                  ? 'প্রতিটি শ্রেণির জন্য আলাদা ফলাফল সিস্টেম নির্ধারণ করুন। পরীক্ষায় সেই ক্লাসে ঢুকলে স্বয়ংক্রিয়ভাবে নির্ধারিত সিস্টেমের ইন্টারফেস চালু হবে।'
                  : 'Assign distinct result systems per class. When entering a class in Exams, the assigned system interface will open automatically.'}
              </p>
            </div>

            {/* Search Input (visible if > 4 classes) */}
            {classes.length > 4 && (
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'শ্রেণি খুঁজুন...' : 'Search classes...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3.5 py-2 text-xs font-bold rounded-xl outline-none border transition-all ${
                    madrasah?.theme === 'dark' 
                      ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-400'
                  }`}
                />
              </div>
            )}

            {/* Classes List */}
            <div className="space-y-2.5 pb-2">
              {filteredClasses.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-400">
                  {lang === 'bn' ? 'কোনো শ্রেণি পাওয়া যায়নি।' : 'No classes found.'}
                </div>
              ) : (
                filteredClasses.map((cls) => {
                  const configuredEngine = classEngines[cls.id] || (madrasah.config_json as any)?.result_engine || (isSchool ? 'school' : 'befaq');
                  const isBefaq = configuredEngine === 'befaq';
                  const isHighSchool = configuredEngine === 'high_school';
                  const isGpa = !isBefaq && !isHighSchool;
                  const isJustSaved = savedSuccessClassId === cls.id;

                  return (
                    <div 
                      key={cls.id}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                        madrasah?.theme === 'dark' 
                          ? 'bg-slate-800/40 border-slate-700/80 hover:border-slate-600' 
                          : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Class Info Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isBefaq 
                              ? (madrasah?.theme === 'dark' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')
                              : isHighSchool
                                ? (madrasah?.theme === 'dark' ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-800/40' : 'bg-indigo-50 text-indigo-600 border border-indigo-100')
                                : (madrasah?.theme === 'dark' ? 'bg-blue-950/50 text-blue-400 border border-blue-800/40' : 'bg-blue-50 text-[#2563EB] border border-blue-100')
                          }`}>
                            <BookOpen size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-black font-noto truncate">
                                {cls.class_name}
                              </h4>
                              {isJustSaved && (
                                <span className="text-[10px] font-black text-emerald-600 flex items-center gap-0.5 animate-in fade-in shrink-0">
                                  <Check size={11} /> {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-0.5">
                              <span className="shrink-0">{lang === 'bn' ? 'বর্তমান:' : 'Active:'}</span>
                              <span className={`font-black truncate ${isBefaq ? 'text-emerald-500' : isHighSchool ? 'text-indigo-500' : 'text-[#2563EB]'}`}>
                                {isBefaq ? (lang === 'bn' ? 'বেফাক (Befaq)' : 'Befaq') :
                                 isHighSchool ? (lang === 'bn' ? 'হাই স্কুল (High School)' : 'High School') :
                                 (lang === 'bn' ? 'জিপিএ (GPA)' : 'GPA')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Desktop Inline Segmented Control */}
                        <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                          {isSchool ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateClassEngine(cls.id, 'gpa')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                                  isGpa 
                                    ? 'bg-blue-600 text-white shadow-xs' 
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {lang === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateClassEngine(cls.id, 'high_school')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                                  isHighSchool 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {lang === 'bn' ? 'হাই স্কুল' : 'High School'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateClassEngine(cls.id, 'gpa')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                                  isGpa 
                                    ? 'bg-blue-600 text-white shadow-xs' 
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {lang === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateClassEngine(cls.id, 'befaq')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                                  isBefaq 
                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {lang === 'bn' ? 'বেফাক (Befaq)' : 'Befaq'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Mobile Full-Width Segmented Control */}
                      <div className="sm:hidden grid grid-cols-2 gap-1 p-1 mt-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                        {isSchool ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateClassEngine(cls.id, 'gpa')}
                              className={`py-2 px-2 rounded-lg text-xs font-black transition-all text-center active:scale-95 ${
                                isGpa 
                                  ? 'bg-blue-600 text-white shadow-xs' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {lang === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateClassEngine(cls.id, 'high_school')}
                              className={`py-2 px-2 rounded-lg text-xs font-black transition-all text-center active:scale-95 ${
                                isHighSchool 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {lang === 'bn' ? 'হাই স্কুল' : 'High School'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateClassEngine(cls.id, 'gpa')}
                              className={`py-2 px-2 rounded-lg text-xs font-black transition-all text-center active:scale-95 ${
                                isGpa 
                                  ? 'bg-blue-600 text-white shadow-xs' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {lang === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateClassEngine(cls.id, 'befaq')}
                              className={`py-2 px-2 rounded-lg text-xs font-black transition-all text-center active:scale-95 ${
                                isBefaq 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {lang === 'bn' ? 'বেফাক (Befaq)' : 'Befaq'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Merit & Ranking Rules */}
        {activeTab === 'merit_rules' && (
          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5 overscroll-contain">
            {/* Mode 1: GPA Priority */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              currentMeritMode === 'gpa_first'
                ? (madrasah?.theme === 'dark' ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-50/70 border-blue-200')
                : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-100')
            }`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="pr-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Trophy size={15} className="text-amber-500 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-black font-noto">
                      {lang === 'bn' ? '১. জিপিএ অগ্রাধিকার (GPA Priority Mode)' : '1. GPA Priority Mode'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-noto leading-relaxed">
                    {lang === 'bn' 
                      ? 'GPA বেশি → আগে। GPA সমান হলে Total Mark বেশি → আগে। Total Mark সমান হলে Attendance বেশি → আগে।' 
                      : 'Higher GPA → First. If GPA is equal, higher Total Marks → First. If Total Marks also equal, higher Attendance → First.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSetMeritRankingMode(currentMeritMode === 'gpa_first' ? 'off' : 'gpa_first')}
                  className={`shrink-0 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                    currentMeritMode === 'gpa_first'
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : madrasah?.theme === 'dark'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {currentMeritMode === 'gpa_first' ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{lang === 'bn' ? 'একটিভ' : 'Active'}</span>
                    </>
                  ) : (
                    <span>{lang === 'bn' ? 'অফ' : 'Off'}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Mode 2: Total Mark Priority */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              currentMeritMode === 'total_marks_first' || !currentMeritMode
                ? (madrasah?.theme === 'dark' ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-50/70 border-blue-200')
                : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-100')
            }`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="pr-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Trophy size={15} className="text-[#2563EB] shrink-0" />
                    <h4 className="text-xs sm:text-sm font-black font-noto">
                      {lang === 'bn' ? '২. টোটাল মার্ক অগ্রাধিকার (Total Mark Priority Mode)' : '2. Total Mark Priority Mode'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-noto leading-relaxed">
                    {lang === 'bn' 
                      ? 'Total Mark বেশি → আগে। Total Mark সমান হলে GPA বেশি → আগে। এরপর Attendance বেশি → আগে।' 
                      : 'Higher Total Marks → First. If Total Marks equal, higher GPA → First. Then higher Attendance → First.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSetMeritRankingMode(currentMeritMode === 'total_marks_first' ? 'off' : 'total_marks_first')}
                  className={`shrink-0 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                    currentMeritMode === 'total_marks_first' || !currentMeritMode
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : madrasah?.theme === 'dark'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {currentMeritMode === 'total_marks_first' || !currentMeritMode ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{lang === 'bn' ? 'একটিভ' : 'Active'}</span>
                    </>
                  ) : (
                    <span>{lang === 'bn' ? 'অফ' : 'Off'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 4th / Optional Subject */}
        {activeTab === 'optional_subject' && (
          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5 overscroll-contain">
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-black font-noto">
                  {lang === 'bn' ? '৪র্থ / ঐচ্ছিক বিষয়ের নম্বর মোট নম্বরে যোগ করার নিয়ম' : '4th / Optional Subject in Total Marks'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-noto leading-relaxed mb-3">
                {lang === 'bn' 
                  ? 'বাংলাদেশ শিক্ষা বোর্ড ও মার্কশিট অনুযায়ী ৪র্থ বিষয় বাদে শুধুমাত্র মূল বিষয়সমূহের মোট নম্বর গণনা করা হয়।' 
                  : 'According to Board standards, 4th subject marks are usually excluded from the mandatory total marks.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetOptionalSubjectTotalMode('exclude')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all text-xs font-black flex flex-col justify-between active:scale-98 ${
                    currentOptionalMode === 'exclude'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')
                  }`}
                >
                  <span>{lang === 'bn' ? '৪র্থ বিষয় বাদ' : 'Exclude 4th Sub'}</span>
                  <span className="text-[9px] font-normal opacity-80 mt-1">{lang === 'bn' ? '(বোর্ডের মূল নিয়ম)' : '(Board Rule)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetOptionalSubjectTotalMode('bonus_above_40')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all text-xs font-black flex flex-col justify-between active:scale-98 ${
                    currentOptionalMode === 'bonus_above_40'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')
                  }`}
                >
                  <span>{lang === 'bn' ? '৪০-এর বেশিটুকু যোগ' : 'Bonus > 40 Only'}</span>
                  <span className="text-[9px] font-normal opacity-80 mt-1">{lang === 'bn' ? '(অতিরিক্ত নম্বর)' : '(Above pass mark)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetOptionalSubjectTotalMode('include')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all text-xs font-black flex flex-col justify-between active:scale-98 ${
                    currentOptionalMode === 'include'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')
                  }`}
                >
                  <span>{lang === 'bn' ? 'সম্পূর্ণ নম্বর যোগ' : 'Include Full Marks'}</span>
                  <span className="text-[9px] font-normal opacity-80 mt-1">{lang === 'bn' ? '(সব বিষয়সহ)' : '(All subjects)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Mobile/Desktop Footer */}
        <div className="pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 mt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 active:scale-98 text-white font-black rounded-xl text-xs sm:text-sm shadow-premium transition-all"
          >
            {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExamSettingsModal;
