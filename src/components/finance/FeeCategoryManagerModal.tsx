import React, { useState } from 'react';
import { FeeCategory, FeeCategoryFrequency } from '../../types';
import { FREQUENCY_LABELS, saveInstitutionFeeCategories } from '../../utils/feeCategoryHelper';
import { X, Plus, Check, Trash2, Edit3, Tag, Layers, AlertCircle, Loader2 } from 'lucide-react';

interface FeeCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: FeeCategory[];
  madrasah: any;
  supabase: any;
  lang: 'en' | 'bn';
  onCategoriesUpdated: (updatedCategories: FeeCategory[], updatedConfig: any) => void;
}

export const FeeCategoryManagerModal: React.FC<FeeCategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  madrasah,
  supabase,
  lang,
  onCategoriesUpdated
}) => {
  const isBangla = lang === 'bn';
  const isDark = madrasah?.theme === 'dark';

  const [categoryList, setCategoryList] = useState<FeeCategory[]>(categories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<FeeCategoryFrequency>('monthly');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingId(null);
    setName('');
    setFrequency('monthly');
    setDescription('');
    setColor('blue');
    setError(null);
    setShowAddForm(true);
  };

  const handleStartEdit = (cat: FeeCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setFrequency(cat.frequency);
    setDescription(cat.description || '');
    setColor(cat.color || 'blue');
    setError(null);
    setShowAddForm(true);
  };

  const handleSaveCategory = async () => {
    setError(null);
    if (!name.trim()) {
      setError(isBangla ? 'ক্যাটাগরির নাম দিন।' : 'Please enter category name.');
      return;
    }

    setIsSaving(true);
    try {
      let updated: FeeCategory[];
      if (editingId) {
        updated = categoryList.map(c =>
          c.id === editingId
            ? { ...c, name: name.trim(), frequency, description: description.trim(), color }
            : c
        );
      } else {
        const newCat: FeeCategory = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: name.trim(),
          frequency,
          description: description.trim(),
          color,
          is_default: false,
          created_at: new Date().toISOString()
        };
        updated = [...categoryList, newCat];
      }

      const updatedConfig = await saveInstitutionFeeCategories(supabase, madrasah, updated);
      setCategoryList(updated);
      setShowAddForm(false);
      setName('');
      setDescription('');
      setEditingId(null);
      onCategoriesUpdated(updated, updatedConfig);
    } catch (e: any) {
      setError(e.message || (isBangla ? 'সেভ করতে সমস্যা হয়েছে।' : 'Failed to save.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const target = categoryList.find(c => c.id === id);
    if (target?.is_default) {
      setError(isBangla ? 'ডিফল্ট ক্যাটাগরি ডিলিট করা যাবে না।' : 'Default categories cannot be deleted.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = categoryList.filter(c => c.id !== id);
      const updatedConfig = await saveInstitutionFeeCategories(supabase, madrasah, updated);
      setCategoryList(updated);
      onCategoriesUpdated(updated, updatedConfig);
    } catch (e: any) {
      setError(e.message || (isBangla ? 'ডিলিট ব্যর্থ হয়েছে।' : 'Failed to delete.'));
    } finally {
      setIsSaving(false);
    }
  };

  const colorOptions = [
    { id: 'blue', label: 'নীল', bg: 'bg-blue-500' },
    { id: 'emerald', label: 'সবুজ', bg: 'bg-emerald-500' },
    { id: 'purple', label: 'বেগুনী', bg: 'bg-purple-500' },
    { id: 'amber', label: 'হলুদ/কমলা', bg: 'bg-amber-500' },
    { id: 'rose', label: 'গোলাপি/লাল', bg: 'bg-rose-500' },
    { id: 'slate', label: 'ধূসর', bg: 'bg-slate-500' }
  ];

  const getPillBadgeStyle = (catColor?: string) => {
    switch (catColor) {
      case 'emerald':
        return isDark ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'purple':
        return isDark ? 'bg-purple-950/60 border-purple-800/80 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700';
      case 'amber':
        return isDark ? 'bg-amber-950/60 border-amber-800/80 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700';
      case 'rose':
        return isDark ? 'bg-rose-950/60 border-rose-800/80 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700';
      case 'slate':
        return isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700';
      default:
        return isDark ? 'bg-blue-950/60 border-blue-800/80 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-lg rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 shadow-2xl relative border my-auto max-h-[92vh] flex flex-col overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3.5 sm:pb-4 border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}>
              <Layers size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-base sm:text-xl font-black font-noto truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                {isBangla ? 'ফি ক্যাটাগরি সেটিংস' : 'Fee Categories'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                {isBangla ? 'ডিফল্ট ও কাস্টম ফি ক্যাটাগরি পরিচালনা' : 'Manage fee categories'}
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

        {error && (
          <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center gap-2.5 text-xs font-bold shrink-0 ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            <AlertCircle size={16} className="shrink-0" />
            <p className="flex-1 text-[11px] sm:text-xs">{error}</p>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 py-1">
          {/* Add/Edit form */}
          {showAddForm ? (
            <div className={`p-3.5 sm:p-5 rounded-2xl border space-y-3.5 sm:space-y-4 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {editingId
                    ? (isBangla ? 'ক্যাটাগরি সম্পাদনা' : 'Edit Category')
                    : (isBangla ? 'নতুন ক্যাটাগরি তৈরি' : 'Create New Category')}
                </span>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingId(null); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </button>
              </div>

              {/* Category Name */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {isBangla ? 'ক্যাটাগরির নাম *' : 'Category Name *'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isBangla ? 'যেমন: কোচিং ফি / হোস্টেল ফি' : 'e.g. Coaching Fee'}
                  className={`w-full h-11 sm:h-12 rounded-xl px-3.5 text-sm font-bold border outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-[#2563EB]'
                  }`}
                />
              </div>

              {/* Frequency Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {isBangla ? 'ফি আদায়ের ধরন বা ফ্রিকোয়েন্সি *' : 'Fee Frequency *'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(FREQUENCY_LABELS) as FeeCategoryFrequency[]).map(freqKey => {
                    const isSelected = frequency === freqKey;
                    const labelObj = FREQUENCY_LABELS[freqKey];
                    return (
                      <button
                        key={freqKey}
                        type="button"
                        onClick={() => setFrequency(freqKey)}
                        className={`p-2.5 sm:p-3 rounded-xl border text-left flex items-start justify-between transition-all min-h-[44px] ${
                          isSelected
                            ? (isDark ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/30' : 'bg-blue-50 border-[#2563EB] text-[#2563EB] ring-1 ring-blue-500/20')
                            : (isDark ? 'bg-slate-900/60 border-slate-700/80 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300')
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="text-xs font-black truncate">{isBangla ? labelObj.badgeBn : labelObj.en}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">{isBangla ? labelObj.bn : labelObj.en}</div>
                        </div>
                        {isSelected && <Check size={16} className="shrink-0 mt-0.5 text-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {isBangla ? 'রঙ নির্বাচন (ট্যাগ স্টাইল)' : 'Badge Color'}
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {colorOptions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center transition-all ${
                      color === c.id ? 'ring-4 ring-blue-400/40 scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {color === c.id && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                {isBangla ? 'বিবরণ (ঐচ্ছিক)' : 'Description (Optional)'}
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={isBangla ? 'যেমন: প্রতিমাসের ২০ তারিখের মধ্যে পরিশোধযোগ্য' : 'Brief explanation'}
                className={`w-full h-11 rounded-xl px-4 text-xs font-medium border outline-none transition-all ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-[#2563EB]'
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingId(null); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold ${
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {isBangla ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#2563EB] hover:bg-blue-700 text-white flex items-center gap-2 shadow-md active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {isBangla ? 'সংরক্ষণ করুন' : 'Save Category'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              {isBangla ? `মোট ${categoryList.length} টি ক্যাটাগরি` : `Total ${categoryList.length} categories`}
            </span>
            <button
              onClick={handleStartAdd}
              className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Plus size={16} />
              {isBangla ? 'নতুন ক্যাটাগরি যোগ করুন' : 'Add New Category'}
            </button>
          </div>
        )}

        {/* Category List */}
        <div className="space-y-2">
          {categoryList.map(cat => {
            const freqLabel = FREQUENCY_LABELS[cat.frequency] || FREQUENCY_LABELS.custom;
            return (
              <div
                key={cat.id}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                  isDark ? 'bg-slate-800/50 border-slate-800 hover:bg-slate-800' : 'bg-slate-50/70 border-slate-100 hover:bg-white hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border flex items-center justify-center shrink-0 ${getPillBadgeStyle(cat.color)}`}>
                    <Tag size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className={`font-black text-xs sm:text-sm truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                        {cat.name}
                      </span>
                      {cat.is_default && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB] dark:bg-blue-900/60 dark:text-blue-300 shrink-0">
                          {isBangla ? 'ডিফল্ট' : 'Default'}
                        </span>
                      )}
                      <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${getPillBadgeStyle(cat.color)}`}>
                        {isBangla ? freqLabel.badgeBn : freqLabel.en}
                      </span>
                    </div>
                    {cat.description && (
                      <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5 font-medium">{cat.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(cat)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isDark ? 'text-blue-400 hover:bg-slate-700' : 'text-[#2563EB] hover:bg-blue-50'
                    }`}
                    title={isBangla ? 'সম্পাদনা করুন' : 'Edit'}
                  >
                    <Edit3 size={14} className="sm:w-[15px] sm:h-[15px]" />
                  </button>
                  {!cat.is_default && (
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isDark ? 'text-red-400 hover:bg-slate-700' : 'text-red-500 hover:bg-red-50'
                      }`}
                      title={isBangla ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 size={14} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black transition-all"
        >
          {isBangla ? 'বন্ধ করুন' : 'Close'}
        </button>
      </div>
    </div>
  </div>
);
};
