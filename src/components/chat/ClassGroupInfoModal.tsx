import React from 'react';
import { Conversation, Profile } from '../../types';
import { Users, Shield, User, X, CheckCircle2 } from 'lucide-react';

interface ClassGroupInfoModalProps {
  conversation: Conversation | null;
  teachersList?: Profile[];
  onClose: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const ClassGroupInfoModal: React.FC<ClassGroupInfoModalProps> = ({
  conversation,
  teachersList = [],
  onClose,
  lang = 'bn',
  isDark = false,
}) => {
  if (!conversation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[85vh] ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-emerald-950/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">{conversation.name}</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'bn' ? 'গ্রুপের বিস্তারিত ও সদস্যবৃন্দ' : 'Group Details & Members'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          <div className={`p-3 rounded-xl border text-xs ${
            isDark
              ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300'
              : 'bg-emerald-50 border-emerald-100 text-emerald-800'
          }`}>
            <p className="font-semibold mb-1 flex items-center gap-1">
              <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              {lang === 'bn' ? 'স্বয়ংক্রিয় সিঙ্ক গ্রুপ' : 'Auto-Synchronized Group'}
            </p>
            <p>
              {lang === 'bn'
                ? 'এই গ্রুপের সকল শিক্ষার্থী ও অভিভাবকরা প্রতিষ্ঠানের ডাটাবেস অনুযায়ী স্বয়ংক্রিয়ভাবে সদস্য থাকেন।'
                : 'All students and guardians in this class are automatically synced with the institutional database.'}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {lang === 'bn' ? 'দায়িত্বপ্রাপ্ত শিক্ষকগণ' : 'Assigned Teachers'}
            </h4>
            <div className="space-y-2">
              {teachersList.length === 0 ? (
                <div className={`p-2.5 rounded-xl border border-dashed text-xs text-slate-400 flex items-center gap-2 ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <Shield className="w-4 h-4 text-indigo-500" />
                  <span>{lang === 'bn' ? 'শ্রেণি শিক্ষক ও বিষয়ভিত্তিক শিক্ষকবৃন্দ' : 'Class teacher & subject teachers'}</span>
                </div>
              ) : (
                teachersList.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      isDark ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center ${
                        isDark ? 'bg-indigo-950 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {t.full_name ? t.full_name[0] : 'T'}
                      </div>
                      <span className="font-medium">{t.full_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md font-medium ${
                      isDark ? 'bg-indigo-950/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {lang === 'bn' ? 'শিক্ষক' : 'Teacher'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-3 border-t flex justify-end ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
