import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  X, 
  Check, 
  RefreshCw, 
  BookOpen, 
  Award, 
  AlertCircle, 
  Save, 
  Search,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  HeartHandshake,
  TrendingUp,
  User,
  Eye,
  FileText,
  Copy,
  CheckCircle2,
  Filter,
  GraduationCap,
  Calendar,
  Layers,
  Sparkle
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
  isDark?: boolean;
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
  lang = 'bn',
  isDark = true
}) => {
  const isBn = lang === 'bn';
  const [tone, setTone] = useState<RemarkTone>('nurturing');
  const [activeLang, setActiveLang] = useState<'bn' | 'en'>(isBn ? 'bn' : 'en');
  const [filter, setFilter] = useState<'all' | 'top' | 'needs_care' | 'edited'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'preview'>('cards');
  const [previewStudentId, setPreviewStudentId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        attendance_rate: std.attendance_rate || (std.attendance ? parseFloat(String(std.attendance)) : 90),
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

      if (!previewStudentId && profiles.length > 0) {
        setPreviewStudentId(profiles[0].student_id);
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

  const handleAppendPhrase = (studentId: string, phrase: string) => {
    const current = activeLang === 'bn' 
      ? (customEdits[studentId]?.bn ?? generatedMap[studentId]?.full_remark_bn ?? '')
      : (customEdits[studentId]?.en ?? generatedMap[studentId]?.full_remark_en ?? '');
    
    const updated = current ? `${current.trim()} ${phrase}` : phrase;
    handleEditRemark(studentId, updated);
  };

  const handleResetSingle = (studentId: string) => {
    setCustomEdits(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const handleCopyRemark = (studentId: string, text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(studentId);
      setTimeout(() => setCopiedId(null), 1500);
    }
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
    }, 850);
  };

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const nameMatch = p.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      String(p.roll).includes(searchQuery);
    if (!nameMatch) return false;

    const gpa = typeof p.gpa === 'number' ? p.gpa : parseFloat(String(p.gpa || 0));
    if (filter === 'top') return gpa >= 4.0;
    if (filter === 'needs_care') return gpa < 3.0 || p.grade === 'F';
    if (filter === 'edited') return !!customEdits[p.student_id];
    return true;
  });

  // Statistics
  const topCount = profiles.filter(p => (typeof p.gpa === 'number' ? p.gpa : parseFloat(String(p.gpa || 0))) >= 4.0).length;
  const needsCareCount = profiles.filter(p => (typeof p.gpa === 'number' ? p.gpa : parseFloat(String(p.gpa || 0))) < 3.0 || p.grade === 'F').length;
  const editedCount = Object.keys(customEdits).length;

  // Selected student for preview
  const currentPreviewProfile = profiles.find(p => p.student_id === previewStudentId) || profiles[0];
  const currentPreviewRemarkObj = currentPreviewProfile ? generatedMap[currentPreviewProfile.student_id] : null;
  const currentPreviewText = currentPreviewProfile 
    ? (activeLang === 'bn' 
        ? (customEdits[currentPreviewProfile.student_id]?.bn ?? currentPreviewRemarkObj?.full_remark_bn ?? '')
        : (customEdits[currentPreviewProfile.student_id]?.en ?? currentPreviewRemarkObj?.full_remark_en ?? ''))
    : '';

  // Quick insertion phrases for teachers
  const quickPhrasesBn = [
    'মাশাআল্লাহ, মেধা ও একাগ্রতা প্রশংসনীয়।',
    'নিয়মিত উপস্থিতি ও গভীর মনোযোগ সন্তোষজনক।',
    'নিয়মিত বিষয়ভিত্তিক রিভিশন দেওয়া জরুরি।',
    'হাতের লেখা ও উত্তর উপস্থাপনায় যত্ন নেওয়া প্রয়োজন।',
    'আদব ও শিষ্টাচার অত্যন্ত সুন্দর।',
    'আল্লাহ তায়ালা ইলমে প্রভূত বরকত দান করুন।'
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`relative w-full max-w-5xl h-[96vh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-[2.2rem] sm:rounded-[2.2rem] border overflow-hidden shadow-2xl transition-all ${
          isDark 
            ? 'bg-[#060D17] border-emerald-500/25 text-slate-100 shadow-emerald-950/40' 
            : 'bg-white border-emerald-100 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Mobile Swipe Grab Indicator */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-gradient-to-r from-emerald-950 via-[#060D17] to-emerald-950 shrink-0">
          <div className="w-12 h-1 bg-emerald-500/40 rounded-full" />
        </div>

        {/* Modal Top Brand Header */}
        <div 
          className={`px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark 
              ? 'bg-gradient-to-r from-[#03131E] via-[#081B2B] to-[#041624] border-emerald-900/40' 
              : 'bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 border-emerald-100'
          }`}
        >
          {/* Brand & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0 border border-emerald-400/30">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight truncate font-noto">
                  {isBn ? 'স্মার্ট মূল্যায়ন ও শিক্ষকের মন্তব্য' : 'Smart Academic Remarks'}
                </h2>
                <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Deenora AI
                </span>
              </div>
              <p className={`text-[11px] sm:text-xs truncate font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {examTitle} {className && `· ${className}`} · <span className="text-emerald-400 font-bold">{profiles.length} জন শিক্ষার্থী</span>
              </p>
            </div>
          </div>

          {/* Right Toolbar: View mode, Language & Close */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* View Switcher (Cards vs Preview) */}
            <div className={`hidden md:flex items-center p-0.5 rounded-xl border text-[11px] font-bold ${
              isDark ? 'bg-slate-950 border-emerald-900/50' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'cards'
                    ? (isDark ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isBn ? 'কার্ড ভিউ' : 'Cards'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? (isDark ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isBn ? 'লাইভ প্রিভিউ' : 'Live Preview'}</span>
              </button>
            </div>

            {/* Language Switch */}
            <div className={`flex items-center p-0.5 rounded-xl border text-[10px] sm:text-[11px] font-black ${
              isDark ? 'bg-slate-950 border-emerald-900/50' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveLang('bn')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  activeLang === 'bn' 
                    ? (isDark ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  activeLang === 'en' 
                    ? (isDark ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-900 shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
              >
                ENG
              </button>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark 
                  ? 'border-emerald-900/40 text-slate-400 hover:text-white hover:bg-slate-800' 
                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tone Selection Ribbon - Deenora Islamic/Academic Theme */}
        <div 
          className={`px-3 sm:px-6 py-2.5 sm:py-3 border-b flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0 ${
            isDark ? 'bg-[#071322] border-emerald-950/80' : 'bg-emerald-50/40 border-emerald-100/60'
          }`}
        >
          {/* Tone Segmented Cards */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <span className={`text-[10px] sm:text-xs font-black shrink-0 font-noto ${isDark ? 'text-emerald-400' : 'text-emerald-900'}`}>
              {isBn ? 'মূল্যায়ন ধারা:' : 'Pedagogical Tone:'}
            </span>

            <div className={`flex items-center p-0.5 rounded-xl border shrink-0 text-xs ${
              isDark ? 'bg-slate-950 border-emerald-950' : 'bg-white border-emerald-200/80 shadow-xs'
            }`}>
              {/* Nurturing */}
              <button
                type="button"
                onClick={() => setTone('nurturing')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  tone === 'nurturing'
                    ? (isDark ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
                title="স্নেহশীল অনুপ্রেরণা ও ইতিবাচক গঠনমূলক মূল্যায়ন"
              >
                <span>🌸</span>
                <span className="font-noto">{isBn ? 'উদ্বুদ্ধকরণ' : 'Nurturing'}</span>
              </button>

              {/* Academic */}
              <button
                type="button"
                onClick={() => setTone('academic')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  tone === 'academic'
                    ? (isDark ? 'bg-teal-600 text-white shadow-md' : 'bg-teal-600 text-white shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
                title="নম্বরভিত্তিক সুনির্দিষ্ট মূল্যায়ন ও প্রাতিষ্ঠানিক দিকনির্দেশনা"
              >
                <span>📘</span>
                <span className="font-noto">{isBn ? 'একাডেমিক' : 'Academic'}</span>
              </button>

              {/* Deeniyat / Akhlaq */}
              <button
                type="button"
                onClick={() => setTone('deeniyat')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  tone === 'deeniyat'
                    ? (isDark ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-600 text-white shadow-xs')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                }`}
                title="দ্বীনিয়াহ, ইলম, আমল ও আখলাকভিত্তিক মূল্যায়ন"
              >
                <span>🌙</span>
                <span className="font-noto">{isBn ? 'দ্বীনিয়াহ ও আখলাক' : 'Deeniyat'}</span>
              </button>
            </div>
          </div>

          {/* Quick Regenerate & Search */}
          <div className="flex items-center gap-2 justify-between md:justify-end">
            <button
              type="button"
              onClick={handleRegenerateAll}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border font-black text-xs inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
                isDark 
                  ? 'bg-slate-900/90 border-emerald-800/50 hover:bg-emerald-950/40 text-emerald-300 shadow-xs' 
                  : 'bg-white border-emerald-200 hover:bg-emerald-50 text-emerald-800 shadow-xs'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-noto">{isBn ? 'সবগুলো রি-জেনারেট' : 'Regenerate All'}</span>
            </button>

            <div className="relative flex-1 sm:w-48 md:w-56">
              <input
                type="text"
                placeholder={isBn ? 'নাম বা রোল খুঁজুন...' : 'Search student...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full px-3 py-1.5 pl-8 rounded-xl text-xs outline-none border transition-colors ${
                  isDark 
                    ? 'bg-slate-950 border-emerald-900/60 text-white placeholder-slate-500 focus:border-emerald-400' 
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>
          </div>
        </div>

        {/* Filter Badges Strip */}
        <div 
          className={`px-3 sm:px-6 py-2 border-b flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0 text-xs ${
            isDark ? 'bg-slate-950/70 border-emerald-950/70' : 'bg-slate-50/80 border-slate-100'
          }`}
        >
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer font-noto ${
              filter === 'all'
                ? (isDark ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-800 text-white shadow-xs')
                : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            {isBn ? `সকল শিক্ষার্থী (${profiles.length})` : `All (${profiles.length})`}
          </button>
          <button
            onClick={() => setFilter('top')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer font-noto ${
              filter === 'top'
                ? (isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs' : 'bg-amber-100 text-amber-900 border border-amber-200')
                : (isDark ? 'text-slate-400 hover:text-amber-400' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            🌟 {isBn ? `শীর্ষ ফলাফল (${topCount})` : `Top (${topCount})`}
          </button>
          <button
            onClick={() => setFilter('needs_care')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer font-noto ${
              filter === 'needs_care'
                ? (isDark ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs' : 'bg-rose-100 text-rose-900 border border-rose-200')
                : (isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            ⚠️ {isBn ? `বিশেষ যত্ন কাম্য (${needsCareCount})` : `Needs Care (${needsCareCount})`}
          </button>
          {editedCount > 0 && (
            <button
              onClick={() => setFilter('edited')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer font-noto ${
                filter === 'edited'
                  ? (isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs' : 'bg-blue-100 text-blue-900 border border-blue-200')
                  : (isDark ? 'text-slate-400 hover:text-blue-400' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              ✍️ {isBn ? `সম্পাদিত (${editedCount})` : `Customized (${editedCount})`}
            </button>
          )}

          {/* Quick mobile view toggle if small screen */}
          <div className="md:hidden ml-auto shrink-0 flex items-center">
            <button
              onClick={() => setActiveTab(activeTab === 'cards' ? 'preview' : 'cards')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : (isDark ? 'bg-slate-900 text-slate-300 border-slate-800' : 'bg-white text-slate-700 border-slate-200')
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{activeTab === 'preview' ? 'কার্ডে ফিরুন' : 'লাইভ প্রিভিউ'}</span>
            </button>
          </div>
        </div>

        {/* Content Body: Either Cards View or Live Marksheet Preview */}
        {activeTab === 'preview' ? (
          /* Live Preview Mode */
          <div className={`flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar ${isDark ? 'bg-[#030913]' : 'bg-slate-100/70'}`}>
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Student Selector in Preview */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/90 border-emerald-900/40' : 'bg-white border-emerald-100 shadow-sm'
              }`}>
                <div className="flex items-center gap-2 font-noto text-xs font-bold">
                  <User className="w-4 h-4 text-emerald-500" />
                  <span>{isBn ? 'শিক্ষার্থী নির্বাচন করুন:' : 'Select Student:'}</span>
                </div>
                <select
                  value={previewStudentId}
                  onChange={e => setPreviewStudentId(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-xl border outline-none font-noto ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  {profiles.map(p => (
                    <option key={p.student_id} value={p.student_id}>
                      রোল {p.roll} - {p.student_name} (GPA {typeof p.gpa === 'number' ? p.gpa.toFixed(2) : p.gpa})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview 1: Official Deenora Marksheet / Certificate Box */}
              <div className="bg-white text-slate-900 rounded-2xl p-5 border border-slate-200 shadow-xl space-y-3 font-noto text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      D
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">অফিসিয়াল মার্কশীট প্রিভিউ (Result Sheet)</h4>
                      <p className="text-[9px] text-slate-400">এভাবেই প্রিন্ট হওয়া রেজাল্ট কার্ডে প্রদর্শিত হবে</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                    Official Stamp
                  </span>
                </div>

                <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      শিক্ষকের মূল্যায়ন ও দিকনির্দেশনা (Evaluation & Guidance)
                    </span>
                    <span className="text-[9px] font-mono font-bold text-emerald-700">
                      Roll #{currentPreviewProfile?.roll} · {currentPreviewProfile?.student_name}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed font-serif italic bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                    "{currentPreviewText || 'কোনো মন্তব্য প্রস্তুত নেই'}"
                  </p>

                  {currentPreviewRemarkObj && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                      {currentPreviewRemarkObj.strengths_bn.length > 0 && (
                        <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                          <strong className="text-emerald-800 block">🎯 অর্জিত দক্ষতা:</strong>
                          <span className="text-slate-700">{currentPreviewRemarkObj.strengths_bn.join(', ')}</span>
                        </div>
                      )}
                      {currentPreviewRemarkObj.growth_areas_bn.length > 0 && (
                        <div className="bg-white/80 p-2 rounded-lg border border-amber-100">
                          <strong className="text-amber-800 block">💡 অনুশীলনের ক্ষেত্র:</strong>
                          <span className="text-slate-700">{currentPreviewRemarkObj.growth_areas_bn.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview 2: Guardian Mobile App PWA Card */}
              <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 text-white rounded-2xl p-5 border border-emerald-500/30 shadow-xl space-y-3 font-noto text-left">
                <div className="flex items-center justify-between border-b border-emerald-800/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-emerald-200">অভিভাবক মোবাইল অ্যাপ প্রিভিউ (Guardian PWA)</span>
                  </div>
                  <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-emerald-300">
                    Live Mobile Card
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-slate-100 bg-white/5 p-3 rounded-xl border border-white/10">
                    "{currentPreviewText || 'মন্তব্য নেই'}"
                  </p>
                  {currentPreviewRemarkObj?.parent_tip_bn && (
                    <div className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-200 p-2 rounded-xl flex items-start gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                        <strong>পিতা-মাতার করণীয়: </strong>
                        <span>{currentPreviewRemarkObj.parent_tip_bn}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Cards View */
          <div className={`flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 custom-scrollbar ${isDark ? 'bg-[#040A14]' : 'bg-slate-50/70'}`}>
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs sm:text-sm font-noto">
                {isBn ? 'কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি' : 'No students found matching your criteria'}
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
                const isFail = student.grade === 'F' || (typeof student.gpa === 'number' && student.gpa === 0);

                // Achievement band styling
                const band = remarkObj?.achievement_band || 'jayyid';
                const bandMeta = {
                  mumtaz: { label: isBn ? 'মুমতাজ (ممتاز)' : 'Outstanding', color: 'from-amber-400 to-amber-600', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
                  jayyid_jiddan: { label: isBn ? 'জায়্যিদ জিদ্দান' : 'Excellent', color: 'from-emerald-400 to-teal-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                  jayyid: { label: isBn ? 'জায়্যিদ' : 'Good', color: 'from-blue-400 to-cyan-500', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                  maqbool: { label: isBn ? 'মাকবুল' : 'Pass', color: 'from-orange-400 to-amber-500', text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
                  rasib: { label: isBn ? 'রাসিব (বিশেষ যত্ন)' : 'Needs Care', color: 'from-rose-500 to-red-600', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
                }[band];

                return (
                  <div 
                    key={student.student_id}
                    className={`rounded-2xl border p-3.5 sm:p-4 transition-all flex flex-col md:flex-row md:items-start gap-3.5 shadow-sm ${
                      isDark 
                        ? 'bg-gradient-to-br from-[#071322] via-[#091829] to-[#06111D] border-emerald-950/80 hover:border-emerald-600/40 shadow-emerald-950/20' 
                        : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    {/* Left Column: Student Academic Snapshot */}
                    <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-800/60 pb-3 md:pb-0 md:pr-4">
                      <div className="flex items-center justify-between md:block">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              #{student.roll}
                            </span>
                            <h4 className="font-bold text-xs sm:text-sm truncate font-noto">{student.student_name}</h4>
                          </div>

                          <div className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {student.rank && (
                              <span className="inline-block mr-2">
                                {isBn ? 'মেধা:' : 'Rank:'} <strong className="text-amber-400">#{student.rank}</strong>
                              </span>
                            )}
                            {student.attendance_rate !== undefined && (
                              <span className="inline-block">
                                {isBn ? 'হাজিরা:' : 'Att:'} <strong className="text-emerald-400">{student.attendance_rate}%</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Grade and Achievement Badge */}
                        <div className="flex items-center gap-1.5 mt-1 md:mt-2">
                          <span className={`text-[10px] sm:text-[11px] font-black font-mono px-2 py-0.5 rounded-lg border ${
                            isFail
                              ? (isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-50 text-rose-700 border-rose-200')
                              : (isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                          }`}>
                            {student.grade || 'A'}
                          </span>
                          <span className={`text-xs font-mono font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            GPA {gpaDisplay}
                          </span>
                        </div>
                      </div>

                      {/* Achievement Band Tag */}
                      <div className="mt-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border inline-block font-noto ${bandMeta.bg} ${bandMeta.text}`}>
                          {bandMeta.label}
                        </span>
                      </div>

                      {/* Diagnostic Strengths & Focus Areas */}
                      {remarkObj && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 space-y-1 text-[10px] font-noto">
                          {remarkObj.strengths_bn.length > 0 && (
                            <div className="truncate">
                              <span className="font-bold text-emerald-400">🎯 {isBn ? 'সবল:' : 'Strength:'}</span>{' '}
                              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                                {isBn ? remarkObj.strengths_bn.join(', ') : remarkObj.strengths_en.join(', ')}
                              </span>
                            </div>
                          )}
                          {remarkObj.growth_areas_bn.length > 0 && (
                            <div className="truncate">
                              <span className="font-bold text-amber-400">💡 {isBn ? 'যত্ন:' : 'Focus:'}</span>{' '}
                              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                                {isBn ? remarkObj.growth_areas_bn.join(', ') : remarkObj.growth_areas_en.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Editable Remark Box & Quick Phrase Insertion */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      {/* Sub-header of Card */}
                      <div className="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-1 font-noto">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {isBn ? 'শিক্ষকের চূড়ান্ত মন্তব্য:' : 'Final Remark:'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isEdited 
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {isEdited ? (isBn ? 'কাস্টমাইজড' : 'Edited') : (isBn ? 'অটোমেটেড' : 'Auto')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Copy button */}
                          <button
                            type="button"
                            onClick={() => handleCopyRemark(student.student_id, currentText)}
                            className="text-[10px] text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                            title="কপি করুন"
                          >
                            {copiedId === student.student_id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">{isBn ? 'কপি হয়েছে' : 'Copied'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{isBn ? 'কপি' : 'Copy'}</span>
                              </>
                            )}
                          </button>

                          {/* Reset to AI original */}
                          {isEdited && (
                            <button
                              type="button"
                              onClick={() => handleResetSingle(student.student_id)}
                              className="text-[10px] text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="পুনরায় স্বয়ংক্রিয় মন্তব্যে ফেরত যান"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>{isBn ? 'অটোতে রিসেট' : 'Reset'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Textarea */}
                      <textarea
                        rows={2}
                        value={currentText}
                        onChange={e => handleEditRemark(student.student_id, e.target.value)}
                        placeholder={isBn ? 'শিক্ষার্থীর জন্য ব্যক্তিগত মূল্যায়ন লিখুন...' : 'Write evaluation remark...'}
                        className={`w-full text-xs sm:text-sm rounded-xl p-2.5 sm:p-3 leading-relaxed font-noto resize-none transition-all outline-none border ${
                          isDark 
                            ? 'bg-slate-950/90 border-emerald-950 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30' 
                            : 'bg-emerald-50/20 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500/20'
                        }`}
                      />

                      {/* Quick Phrase Insertion Chips (Deenora Signature Feature) */}
                      <div className="mt-2 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <span className="text-[9px] font-bold text-slate-500 shrink-0 font-noto mr-0.5">
                          {isBn ? 'কুইক ট্যাগ:' : 'Quick Tag:'}
                        </span>
                        {quickPhrasesBn.map((phrase, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => handleAppendPhrase(student.student_id, phrase)}
                            className={`text-[9px] px-2 py-0.5 rounded-lg border font-noto whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                              isDark 
                                ? 'bg-slate-900/80 border-emerald-900/40 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-950/30' 
                                : 'bg-white border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            + {phrase.length > 24 ? phrase.slice(0, 24) + '...' : phrase}
                          </button>
                        ))}
                      </div>

                      {/* Actionable Parent Advice hint */}
                      {remarkObj?.parent_tip_bn && (
                        <div className={`mt-2 text-[10px] p-2 rounded-xl flex items-start gap-2 text-left font-noto border ${
                          isDark 
                            ? 'bg-slate-950/60 border-amber-950/60 text-slate-400' 
                            : 'bg-amber-50/60 border-amber-200/60 text-amber-900'
                        }`}>
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <strong className={isDark ? 'text-amber-300' : 'text-amber-900'}>
                              {isBn ? 'অভিভাবকের করণীয়:' : 'Parent Tip:'}
                            </strong>{' '}
                            <span>{isBn ? remarkObj.parent_tip_bn : remarkObj.parent_tip_en}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Modal Sticky Responsive Footer */}
        <div 
          className={`px-4 sm:px-6 py-3 sm:py-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-[#030913] border-emerald-950' : 'bg-white border-slate-200'
          }`}
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className={`text-xs font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="font-bold text-emerald-400 tabular-nums">{profiles.length}</span> {isBn ? 'জন শিক্ষার্থীর মূল্যায়ন প্রস্তুত' : 'remarks ready'}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer font-noto ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 sm:px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-900/40 transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer font-noto border border-emerald-400/30"
            >
              <Save className="w-4 h-4" />
              <span>{isBn ? 'মন্তব্য সংরক্ষণ করুন' : 'Save Remarks'}</span>
            </button>
          </div>
        </div>

        {/* Saved Success Toast */}
        {isSavedToast && (
          <div className="absolute top-4 right-4 bg-emerald-950 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 z-50 font-noto">
            <Check className="w-4 h-4 text-emerald-300" />
            <span>{isBn ? 'সকল মন্তব্য সফলভাবে সংরক্ষিত হয়েছে!' : 'All remarks saved successfully!'}</span>
          </div>
        )}

      </div>
    </div>
  );
};
