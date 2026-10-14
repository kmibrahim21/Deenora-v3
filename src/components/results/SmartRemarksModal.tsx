import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  X, 
  Check, 
  RefreshCw, 
  FileText, 
  BookOpen, 
  Award, 
  AlertCircle, 
  Save, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  HeartHandshake
} from 'lucide-react';
import { 
  generateClassRemarks, 
  generateStudentRemark, 
  GeneratedSmartRemark, 
  RemarkTone, 
  StudentAcademicProfile 
} from '../../utils/smartRemarksEngine';

interface SmartRemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  examTitle: string;
  className?: string;
  students: any[]; // calculated student result rows
  subjects: string[];
  initialRemarks?: Record<string, string>;
  onSaveRemarks: (remarksMap: Record<string, { full_remark_bn: string; full_remark_en: string; details?: any }>) => void;
  lang?: 'en' | 'bn';
}

export const SmartRemarksModal: React.FC<SmartRemarksModalProps> = ({
  isOpen,
  onClose,
  examTitle,
  className = '',
  students,
  subjects,
  initialRemarks = {},
  onSaveRemarks,
  lang = 'bn'
}) => {
  const isBn = lang === 'bn';
  const [tone, setTone] = useState<RemarkTone>('nurturing');
  const [activeLang, setActiveLang] = useState<'bn' | 'en'>(isBn ? 'bn' : 'en');
  const [filter, setFilter] = useState<'all' | 'top' | 'needs_care'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  // Map incoming student rows to StudentAcademicProfile
  const profiles: StudentAcademicProfile[] = useMemo(() => {
    return students.map((std, idx) => {
      const gpaNum = parseFloat(String(std.gpa || 0)) || 0;
      const subList: any[] = [];
      if (std.marks) {
        subjects.forEach(sub => {
          const val = parseFloat(std.marks[sub]) || 0;
          subList.push({
            subject_name: sub,
            marks_obtained: val,
            full_marks: 100,
            grade: val >= 80 ? 'A+' : val >= 70 ? 'A' : val >= 60 ? 'A-' : val >= 50 ? 'B' : val >= 40 ? 'C' : val >= 33 ? 'D' : 'F'
          });
        });
      }

      return {
        student_id: String(std.student_id || std.id || `st-${idx}`),
        student_name: std.student_name || std.name || `Student ${idx + 1}`,
        roll: std.roll || std.roll_no || idx + 1,
        class_name: className,
        total_marks: std.total_obtained || std.totalMarks || 0,
        gpa: gpaNum,
        grade: std.grade || (gpaNum >= 5 ? 'A+' : gpaNum >= 4 ? 'A' : gpaNum >= 3.5 ? 'A-' : gpaNum >= 3 ? 'B' : gpaNum >= 2 ? 'C' : 'F'),
        rank: std.rank || std.merit_position || idx + 1,
        attendance_rate: std.attendance_rate || (std.attendance ? parseFloat(String(std.attendance)) : undefined),
        subjects: subList
      };
    });
  }, [students, subjects, className]);

  // Editable remarks state
  const [generatedMap, setGeneratedMap] = useState<Record<string, GeneratedSmartRemark>>({});
  const [customEdits, setCustomEdits] = useState<Record<string, { bn: string; en: string }>>({});

  // Auto-generate on open or tone change
  React.useEffect(() => {
    if (isOpen && profiles.length > 0) {
      const remarks = generateClassRemarks(profiles, tone);
      setGeneratedMap(remarks);

      // Pre-fill existing initialRemarks if present
      const existing: Record<string, { bn: string; en: string }> = {};
      profiles.forEach(p => {
        if (initialRemarks[p.student_id]) {
          existing[p.student_id] = {
            bn: initialRemarks[p.student_id],
            en: remarks[p.student_id]?.full_remark_en || ''
          };
        }
      });
      if (Object.keys(existing).length > 0) {
        setCustomEdits(prev => ({ ...prev, ...existing }));
      }
    }
  }, [isOpen, tone, profiles]);

  if (!isOpen) return null;

  const handleRegenerateAll = () => {
    const remarks = generateClassRemarks(profiles, tone);
    setGeneratedMap(remarks);
    setCustomEdits({});
  };

  const handleEditRemark = (studentId: string, text: string) => {
    setCustomEdits(prev => ({
      ...prev,
      [studentId]: {
        bn: activeLang === 'bn' ? text : (prev[studentId]?.bn || generatedMap[studentId]?.full_remark_bn || ''),
        en: activeLang === 'en' ? text : (prev[studentId]?.en || generatedMap[studentId]?.full_remark_en || '')
      }
    }));
  };

  const handleResetSingle = (studentId: string) => {
    setCustomEdits(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const handleSave = () => {
    const finalMap: Record<string, { full_remark_bn: string; full_remark_en: string; details?: any }> = {};
    profiles.forEach(p => {
      const auto = generatedMap[p.student_id];
      const custom = customEdits[p.student_id];
      finalMap[p.student_id] = {
        full_remark_bn: custom?.bn || auto?.full_remark_bn || '',
        full_remark_en: custom?.en || auto?.full_remark_en || '',
        details: auto
      };
    });

    onSaveRemarks(finalMap);
    setIsSavedToast(true);
    setTimeout(() => {
      setIsSavedToast(false);
      onClose();
    }, 900);
  };

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const nameMatch = p.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      String(p.roll).includes(searchQuery);
    if (!nameMatch) return false;

    const gpa = typeof p.gpa === 'number' ? p.gpa : parseFloat(String(p.gpa || 0));
    if (filter === 'top') return gpa >= 4.0;
    if (filter === 'needs_care') return gpa < 3.0 || p.grade === 'F';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {isBn ? 'স্মার্ট মূল্যায়ন ও শিক্ষকের মন্তব্য' : 'Smart Academic Remarks'}
                </h2>
                <span className="text-xs text-slate-500">· {examTitle}</span>
              </div>
              <p className="text-xs text-slate-500">
                {isBn 
                  ? 'গ্রেড, উপস্থিতির হার ও সবল/দুর্বল বিষয়ের ভিত্তিতে প্রতিটি শিক্ষার্থীর জন্য অটোমেটেড মন্তব্য'
                  : 'Individualized pedagogical remarks based on GPA, attendance, and subject trends'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Tone Selector */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 whitespace-nowrap">
              {isBn ? 'মূল্যায়ন ভঙ্গি:' : 'Tone:'}
            </span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setTone('nurturing')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  tone === 'nurturing'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'উদ্বুদ্ধকরণ ও মমতাময়ী' : 'Nurturing'}
              </button>
              <button
                type="button"
                onClick={() => setTone('academic')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  tone === 'academic'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'একাডেমিক ও সুনির্দিষ্ট' : 'Academic'}
              </button>
              <button
                type="button"
                onClick={() => setTone('deeniyat')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  tone === 'deeniyat'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'দ্বীনি ও আখলাক' : 'Deeniyat'}
              </button>
            </div>
          </div>

          {/* Language Toggle & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveLang('bn')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  activeLang === 'bn'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  activeLang === 'en'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
            </div>

            <button
              type="button"
              onClick={handleRegenerateAll}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
              title="রি-জেনারেট করুন"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isBn ? 'নতুন করে তৈরি করুন' : 'Regenerate'}</span>
            </button>
          </div>
        </div>

        {/* Filter bar & Search */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? `সকল শিক্ষার্থী (${profiles.length})` : `All (${profiles.length})`}
            </button>
            <button
              onClick={() => setFilter('top')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'top'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'শীর্ষস্থান অধিকারী (GPA 4.0+)' : 'Top Achievers (4.0+)'}
            </button>
            <button
              onClick={() => setFilter('needs_care')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'needs_care'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'বিশেষ যত্ন প্রয়োজন' : 'Needs Support'}
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={isBn ? 'নাম বা রোল দিয়ে খুঁজুন...' : 'Search student or roll...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 pl-8 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-56"
            />
            <BookOpen className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>
        </div>

        {/* Student Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50/50">
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found matching your criteria'}
            </div>
          ) : (
            filteredProfiles.map(student => {
              const remarkObj = generatedMap[student.student_id];
              const custom = customEdits[student.student_id];
              const isEdited = !!custom;
              const currentText = activeLang === 'bn' 
                ? (custom?.bn ?? remarkObj?.full_remark_bn ?? '')
                : (custom?.en ?? remarkObj?.full_remark_en ?? '');

              const gpaDisplay = typeof student.gpa === 'number' ? student.gpa.toFixed(2) : student.gpa;

              return (
                <div 
                  key={student.student_id}
                  className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-start gap-4"
                >
                  {/* Left Column: Student Academic Snapshot */}
                  <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between md:block">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{student.student_name}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {isBn ? 'রোল:' : 'Roll:'} <span className="font-mono tabular-nums font-semibold">{student.roll}</span>
                          {student.rank && (
                            <>
                              <span className="mx-1">·</span>
                              <span>{isBn ? 'মেধাক্রম:' : 'Rank:'} #{student.rank}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          student.grade === 'F' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {student.grade || 'A'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">
                          GPA {gpaDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Strengths & Growth Areas inline text */}
                    {remarkObj && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
                        {remarkObj.strengths_bn.length > 0 && (
                          <div className="truncate">
                            <span className="font-semibold text-emerald-700">{isBn ? 'সবল:' : 'Strength:'}</span>{' '}
                            {isBn ? remarkObj.strengths_bn.join(', ') : remarkObj.strengths_en.join(', ')}
                          </div>
                        )}
                        {remarkObj.growth_areas_bn.length > 0 && (
                          <div className="truncate">
                            <span className="font-semibold text-amber-700">{isBn ? 'যত্ন কাম্য:' : 'Focus:'}</span>{' '}
                            {isBn ? remarkObj.growth_areas_bn.join(', ') : remarkObj.growth_areas_en.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Editable Remark Box */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span className="font-medium">
                        {isBn ? 'শ্রেণি শিক্ষকের চূড়ান্ত মন্তব্য:' : 'Final Report Card Remark:'}
                      </span>
                      {isEdited && (
                        <button
                          type="button"
                          onClick={() => handleResetSingle(student.student_id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{isBn ? 'স্বয়ংক্রিয় রিমার্কে ফিরুন' : 'Reset to auto'}</span>
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      value={currentText}
                      onChange={e => handleEditRemark(student.student_id, e.target.value)}
                      placeholder={isBn ? 'শিক্ষার্থীর জন্য ব্যক্তিগত মূল্যায়ন লিখুন...' : 'Write evaluation remark...'}
                      className="w-full text-xs sm:text-sm text-slate-800 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-noto resize-none bg-slate-50/30 focus:bg-white transition-colors"
                    />

                    {/* Actionable Parent Advice hint */}
                    {remarkObj?.parent_tip_bn && (
                      <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                        <HeartHandshake className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-600">{isBn ? 'অভিভাবকের করণীয়:' : 'Parent Tip:'}</span>
                        <span className="truncate">{isBn ? remarkObj.parent_tip_bn : remarkObj.parent_tip_en}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {isBn 
              ? `মোট ${profiles.length} জন শিক্ষার্থীর মন্তব্য প্রস্তুত` 
              : `${profiles.length} student remarks ready for export`}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isBn ? 'সংরক্ষণ করুন ও শিটে যুক্ত করুন' : 'Save & Apply to Marksheets'}</span>
            </button>
          </div>
        </div>

        {/* Saved Success Toast */}
        {isSavedToast && (
          <div className="absolute top-4 right-4 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{isBn ? 'মন্তব্য সফলভাবে সংরক্ষিত হয়েছে!' : 'Remarks saved successfully!'}</span>
          </div>
        )}

      </div>
    </div>
  );
};
