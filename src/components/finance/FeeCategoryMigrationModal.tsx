import React, { useState, useMemo } from 'react';
import { FeeCategory, FeeStructure } from '../../types';
import {
  suggestCategoryForFeeName,
  batchSaveFeeStructureCategories,
  FREQUENCY_LABELS
} from '../../utils/feeCategoryHelper';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';

interface FeeCategoryMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  structures: FeeStructure[];
  categories: FeeCategory[];
  madrasah: any;
  supabase: any;
  lang: 'en' | 'bn';
  onMigrationComplete: (updatedConfig: any) => void;
}

export const FeeCategoryMigrationModal: React.FC<FeeCategoryMigrationModalProps> = ({
  isOpen,
  onClose,
  structures,
  categories,
  madrasah,
  supabase,
  lang,
  onMigrationComplete
}) => {
  const isBangla = lang === 'bn';
  const isDark = madrasah?.theme === 'dark';

  // Current mappings stored in institution config
  const existingMapping = useMemo(() => {
    let config = madrasah?.config_json;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch {
        config = {};
      }
    }
    return config?.fee_structure_categories || {};
  }, [madrasah]);

  // Initial state of selected mappings: auto-suggest for each structure if not explicitly set
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    structures.forEach(s => {
      const existing = s.category_id || existingMapping[s.id];
      if (existing) {
        initial[s.id] = existing;
      } else {
        const suggested = suggestCategoryForFeeName(s.fee_name, categories);
        initial[s.id] = suggested.id;
      }
    });
    return initial;
  });

  const [filterMode, setFilterMode] = useState<'all' | 'uncategorized'>('uncategorized');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const uncategorizedCount = structures.filter(
    s => !(s.category_id || existingMapping[s.id])
  ).length;

  const displayedStructures = structures.filter(s => {
    if (filterMode === 'uncategorized') {
      return !(s.category_id || existingMapping[s.id]);
    }
    return true;
  });

  const handleSelectCategory = (structureId: string, categoryId: string) => {
    setSelectedMappings(prev => ({
      ...prev,
      [structureId]: categoryId
    }));
  };

  const handleConvertSingle = async (structureId: string) => {
    const categoryId = selectedMappings[structureId];
    if (!categoryId) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updatedConfig = await batchSaveFeeStructureCategories(supabase, madrasah, {
        [structureId]: categoryId
      });
      setSuccessMessage(
        isBangla
          ? 'ফি সফলভাবে ক্যাটাগরিতে কনভার্ট হয়েছে!'
          : 'Fee successfully converted to category!'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      onMigrationComplete(updatedConfig);
    } catch (e: any) {
      setErrorMessage(e.message || (isBangla ? 'কনভার্ট করতে সমস্যা হয়েছে।' : 'Conversion failed.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertAll = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Gather all current mappings for displayed structures or all structures
      const batchPayload: Record<string, string> = {};
      structures.forEach(s => {
        if (selectedMappings[s.id]) {
          batchPayload[s.id] = selectedMappings[s.id];
        }
      });

      const updatedConfig = await batchSaveFeeStructureCategories(supabase, madrasah, batchPayload);
      setSuccessMessage(
        isBangla
          ? `আলহামদুলিল্লাহ! মোট ${Object.keys(batchPayload).length} টি ফি সফলভাবে ক্যাটাগরিতে কনভার্ট করা হয়েছে!`
          : `Successfully converted ${Object.keys(batchPayload).length} fee structures to categories!`
      );
      setTimeout(() => {
        setSuccessMessage(null);
        onMigrationComplete(updatedConfig);
        onClose();
      }, 1500);
    } catch (e: any) {
      setErrorMessage(e.message || (isBangla ? 'কনভার্ট করতে সমস্যা হয়েছে।' : 'Conversion failed.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 shadow-2xl relative border my-auto max-h-[92vh] flex flex-col overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3.5 sm:pb-4 border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-md shrink-0">
              <Sparkles size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className={`text-base sm:text-xl font-black font-noto truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                  {isBangla ? 'ফি ক্যাটাগরি কনভার্সন টুল' : 'Fee Category Migration'}
                </h3>
                <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 shrink-0">
                  {isBangla ? 'স্মার্ট অটো সাজেস্ট' : 'Auto Suggest'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                {isBangla
                  ? 'বিভিন্ন নামে সংরক্ষিত ফি ক্যাটাগরিতে রূপান্তর করুন'
                  : 'Convert legacy fee names into structured categories'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 py-2">

        {/* Stats card & Quick CTA */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-blue-50/60 border-blue-100'
          }`}
        >
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isBangla ? 'মোট ফি কাঠামো' : 'Total Fees'}
              </span>
              <span className="text-lg font-black">{structures.length}</span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            <div>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                {isBangla ? 'কনভার্ট বাকি' : 'Needs Conversion'}
              </span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                {uncategorizedCount}
              </span>
            </div>
          </div>

          <button
            onClick={handleConvertAll}
            disabled={isSaving || structures.length === 0}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {isBangla ? 'এক ক্লিকে সব কনভার্ট করুন' : 'Convert All in 1 Click'}
          </button>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterMode('uncategorized')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'uncategorized'
                  ? 'bg-white dark:bg-slate-900 text-[#2563EB] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isBangla ? `কনভার্টযোগ্য (${uncategorizedCount})` : `Uncategorized (${uncategorizedCount})`}
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-900 text-[#2563EB] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isBangla ? `সবগুলো (${structures.length})` : `All (${structures.length})`}
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            {isBangla
              ? 'সিস্টেম স্বয়ংক্রিয়ভাবে উপযুক্ত ক্যাটাগরি বেছে নিয়েছে'
              : 'Smart suggestions based on fee titles'}
          </span>
        </div>

        {/* Structures Mapping Table */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {displayedStructures.length > 0 ? (
            displayedStructures.map(s => {
              const currentCatId = s.category_id || existingMapping[s.id];
              const isAlreadyDone = Boolean(currentCatId);
              const selectedCatId = selectedMappings[s.id];
              const selectedCat = categories.find(c => c.id === selectedCatId);
              const isSuggested = !isAlreadyDone;

              return (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isAlreadyDone
                      ? isDark
                        ? 'bg-slate-800/30 border-slate-800'
                        : 'bg-slate-50/50 border-slate-100'
                      : isDark
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-white border-blue-100 shadow-sm'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Tag size={15} className="text-[#2563EB] shrink-0" />
                      <span className={`font-black text-sm truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                        {s.fee_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                        {s.classes?.class_name || (isBangla ? 'সব শ্রেণি' : 'All Classes')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-[#2563EB] dark:text-blue-400">
                        ৳{s.amount?.toLocaleString()}
                      </span>
                      {isAlreadyDone ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check size={12} />
                          {isBangla ? 'ক্যাটাগরি যুক্ত আছে' : 'Categorized'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Sparkles size={12} />
                          {isBangla ? 'সাজেস্টেড ক্যাটাগরি' : 'Auto suggested'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category Selection Dropdown */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <select
                        value={selectedCatId || ''}
                        onChange={e => handleSelectCategory(s.id, e.target.value)}
                        className={`h-10 rounded-xl px-3 pr-8 text-xs font-black border outline-none appearance-none cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-200 text-[#1E3A8A] focus:border-[#2563EB]'
                        }`}
                      >
                        {categories.map(c => {
                          const freq = FREQUENCY_LABELS[c.frequency] || FREQUENCY_LABELS.custom;
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} ({isBangla ? freq.badgeBn : freq.en})
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        ▼
                      </div>
                    </div>

                    <button
                      onClick={() => handleConvertSingle(s.id)}
                      disabled={isSaving}
                      className="px-3.5 py-2 rounded-xl text-xs font-black bg-blue-50 hover:bg-blue-100 text-[#2563EB] dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Check size={14} />
                      {isBangla ? 'কনভার্ট' : 'Apply'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={`text-center py-12 rounded-3xl border-2 border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-black text-slate-500 dark:text-slate-400">
                {isBangla ? 'সব ফি কাঠামো ইতিমধ্যে ক্যাটাগরিতে কনভার্ট করা হয়েছে!' : 'All fee structures are already categorized!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
        <span className="text-xs text-slate-400">
          {isBangla ? 'পরবর্তীতে ফি এডিটর থেকেও ক্যাটাগরি বদলানো যাবে' : 'You can also change categories anytime from Fee Settings'}
        </span>
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black transition-all"
        >
          {isBangla ? 'সম্পন্ন' : 'Done'}
        </button>
      </div>
    </div>
  </div>
);
};
