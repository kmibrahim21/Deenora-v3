import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronRight,
  User,
  Eye,
  FileText,
  Copy,
  CheckCircle2,
  Filter,
  GraduationCap,
  Layers,
  Bot,
  Lightbulb,
  Heart,
  Star,
  Zap,
  BarChart3,
  Wand2,
  RotateCcw,
  Sliders,
  ChevronDown
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
  isDark = false
}) => {
  const isBn = lang === 'bn';
  const [tone, setTone] = useState<RemarkTone>('nurturing');
  const [activeLang, setActiveLang] = useState<'bn' | 'en'>(isBn ? 'bn' : 'en');
  const [category, setCategory] = useState<'all' | 'academic' | 'deeniyat' | 'general'>('all');
  const [filter, setFilter] = useState<'all' | 'top' | 'needs_care' | 'edited'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'preview' | 'summary'>('cards');
  const [previewStudentId, setPreviewStudentId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

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
  useEffect(() => {
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

  const handleRegenerateSingle = (studentProfile: StudentAcademicProfile) => {
    setRegeneratingId(studentProfile.student_id);
    setTimeout(() => {
      const newRemark = generateStudentRemark(studentProfile, tone);
      setGeneratedMap(prev => ({
        ...prev,
        [studentProfile.student_id]: newRemark
      }));
      setCustomEdits(prev => {
        const next = { ...prev };
        delete next[studentProfile.student_id];
        return next;
      });
      setRegeneratingId(null);
    }, 250);
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
  const avgGpa = profiles.length > 0 
    ? (profiles.reduce((acc, curr) => acc + (typeof curr.gpa === 'number' ? curr.gpa : parseFloat(String(curr.gpa || 0))), 0) / profiles.length).toFixed(2)
    : '0.00';

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
    'নম্বরপত্র, পড়া ও রিভিশন',
    'নিয়মিত উপস্থিতি ও মনোযোগ',
    'বিশেষ দিকনির্দেশনা আবশ্যক',
    'মাশাআল্লাহ, মেধা প্রশংসনীয়',
    'আদব ও শিষ্টাচার অত্যন্ত সুন্দর',
    'পড়ার টেবিলে আরও সময় দরকার'
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`relative w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-[2rem] sm:rounded-[2.5rem] border overflow-hidden shadow-2xl transition-all ${
          isDark 
            ? 'bg-[#060D17] border-blue-500/25 text-slate-100 shadow-blue-950/40' 
            : 'bg-[#F4F8FC] border-blue-100 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Mobile Swipe / Drag Indicator Bar */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-gradient-to-r from-blue-950 via-[#060D17] to-blue-950 shrink-0">
          <div className="w-12 h-1.5 bg-blue-500/40 rounded-full" />
        </div>

        {/* Modal Top Brand Header */}
        <div 
          className={`px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b flex items-center justify-between gap-2.5 shrink-0 ${
            isDark 
              ? 'bg-gradient-to-r from-[#03131E] via-[#081B2B] to-[#041624] border-blue-900/40' 
              : 'bg-white border-blue-100 shadow-xs'
          }`}
        >
          {/* Brand & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0 border border-blue-400/30">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight truncate font-noto text-slate-900 dark:text-white">
                  {isBn ? 'স্মার্ট মূল্যায়ন ও শিক্ষক মন্তব্য' : 'Smart Remarks & AI Assistant'}
                </h2>
                <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${
                  isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  Deenora AI
                </span>
              </div>
              <p className={`text-[10px] sm:text-xs truncate font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {examTitle ? `${examTitle} ${className ? `(${className})` : ''}` : (isBn ? 'স্বয়ংক্রিয় এআই মূল্যায়ন তৈরি করুন' : 'Automated pedagogical remarks')}
              </p>
            </div>
          </div>

          {/* Right Toolbar: View mode tabs, Language & Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* View Switcher (Cards vs Preview vs Analytics) */}
            <div className={`flex items-center p-0.5 sm:p-1 rounded-xl border text-[10px] sm:text-xs font-bold ${
              isDark ? 'bg-slate-950 border-blue-900/50' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className={`px-2 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
                title="Cards View"
              >
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline font-noto">{isBn ? 'কার্ড' : 'Cards'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
                title="Live Marksheet Preview"
              >
                <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline font-noto">{isBn ? 'প্রিভিউ' : 'Preview'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`px-2 sm:px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
                title="Class AI Summary"
              >
                <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline font-noto">{isBn ? 'সামারি' : 'Summary'}</span>
              </button>
            </div>

            {/* Language Switch */}
            <div className={`flex items-center p-0.5 rounded-xl border text-[10px] font-black ${
              isDark ? 'bg-slate-950 border-blue-900/50' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveLang('bn')}
                className={`px-1.5 sm:px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  activeLang === 'bn' 
                    ? 'bg-blue-600 text-white shadow-xs'
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-1.5 sm:px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  activeLang === 'en' 
                    ? 'bg-blue-600 text-white shadow-xs'
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600')
                }`}
              >
                EN
              </button>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark 
                  ? 'border-blue-900/40 text-slate-400 hover:text-white hover:bg-slate-800' 
                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Tone & Category Selection Ribbon */}
        <div 
          className={`px-3 sm:px-6 py-2 border-b flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 ${
            isDark ? 'bg-[#071322] border-blue-950/80' : 'bg-white border-blue-100'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 font-noto hidden sm:inline">
            {isBn ? 'মূল্যায়ন টোন:' : 'Tone:'}
          </span>

          <button
            type="button"
            onClick={() => { setCategory('all'); setTone('nurturing'); }}
            className={`px-3 sm:px-4 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              category === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                : (isDark ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100')
            }`}
          >
            <span>🌸</span>
            <span className="font-noto">{isBn ? 'উৎসাহব্যঞ্জক' : 'Balanced'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setCategory('academic'); setTone('academic'); }}
            className={`px-3 sm:px-4 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              category === 'academic'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                : (isDark ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100')
            }`}
          >
            <span>📘</span>
            <span className="font-noto">{isBn ? 'পড়াশোনা ও ফলাফল' : 'Academic'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setCategory('deeniyat'); setTone('deeniyat'); }}
            className={`px-3 sm:px-4 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              category === 'deeniyat'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                : (isDark ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100')
            }`}
          >
            <span>🌙</span>
            <span className="font-noto">{isBn ? 'দ্বীনি ও আখলাক' : 'Deeniyat & Ethics'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setCategory('general'); setTone('nurturing'); }}
            className={`px-3 sm:px-4 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              category === 'general'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                : (isDark ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100')
            }`}
          >
            <span>💡</span>
            <span className="font-noto">{isBn ? 'পরামর্শ ও নির্দেশক' : 'Guidance'}</span>
          </button>
        </div>

        {/* Search Bar & Regenerate Button */}
        <div 
          className={`px-3 sm:px-6 py-2 border-b flex flex-row items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-slate-950/90 border-blue-950' : 'bg-white border-blue-100'
          }`}
        >
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={isBn ? 'শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন...' : 'Search student or roll...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full px-3.5 py-2 pl-9 pr-8 rounded-xl text-xs outline-none border transition-all font-noto ${
                isDark 
                  ? 'bg-slate-900 border-blue-900/60 text-white placeholder-slate-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20'
              }`}
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleRegenerateAll}
            className={`px-3 py-2 rounded-xl border font-black text-xs inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 font-noto ${
              isDark 
                ? 'bg-slate-900 border-blue-900/60 hover:bg-blue-950 text-blue-300' 
                : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-blue-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">{isBn ? 'সবগুলো রি-জেনারেট' : 'Regenerate All'}</span>
            <span className="sm:hidden">{isBn ? 'রি-জেনারেট' : 'Re-gen'}</span>
          </button>
        </div>

        {/* Filter Pills Ribbon */}
        <div 
          className={`px-3 sm:px-6 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs ${
            isDark ? 'bg-[#040D18] border-blue-950/70' : 'bg-slate-50/70 border-blue-100/60'
          }`}
        >
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full font-black text-[11px] transition-all shrink-0 cursor-pointer font-noto flex items-center gap-1 ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : (isDark ? 'bg-slate-900 text-slate-300 hover:text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100')
            }`}
          >
            <span>★</span>
            <span>{isBn ? `সকল (${profiles.length})` : `All (${profiles.length})`}</span>
          </button>

          <button
            onClick={() => setFilter('top')}
            className={`px-3 py-1 rounded-full font-black text-[11px] transition-all shrink-0 cursor-pointer font-noto flex items-center gap-1 ${
              filter === 'top'
                ? 'bg-emerald-600 text-white shadow-xs'
                : (isDark ? 'bg-slate-900 text-emerald-400 hover:bg-emerald-950/40' : 'bg-emerald-50 text-emerald-800 border border-emerald-200')
            }`}
          >
            <span>⭐</span>
            <span>{isBn ? `শীর্ষ স্থান (${topCount})` : `Top (${topCount})`}</span>
          </button>

          <button
            onClick={() => setFilter('needs_care')}
            className={`px-3 py-1 rounded-full font-black text-[11px] transition-all shrink-0 cursor-pointer font-noto flex items-center gap-1 ${
              filter === 'needs_care'
                ? 'bg-amber-500 text-white shadow-xs'
                : (isDark ? 'bg-slate-900 text-amber-400 hover:bg-amber-950/40' : 'bg-amber-50 text-amber-900 border border-amber-200')
            }`}
          >
            <span>⚠️</span>
            <span>{isBn ? `বিশেষ যত্ন (${needsCareCount})` : `Needs Care (${needsCareCount})`}</span>
          </button>

          {editedCount > 0 && (
            <button
              onClick={() => setFilter('edited')}
              className={`px-3 py-1 rounded-full font-black text-[11px] transition-all shrink-0 cursor-pointer font-noto flex items-center gap-1 ${
                filter === 'edited'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : (isDark ? 'bg-slate-900 text-indigo-400 hover:bg-indigo-950/40' : 'bg-indigo-50 text-indigo-900 border border-indigo-200')
              }`}
            >
              <span>✍️</span>
              <span>{isBn ? `কাস্টম সম্পাদিত (${editedCount})` : `Edited (${editedCount})`}</span>
            </button>
          )}
        </div>

        {/* Body Area */}
        {activeTab === 'summary' ? (
          /* Class AI Summary Tab */
          <div className={`flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4 ${isDark ? 'bg-[#030913]' : 'bg-slate-100/70'}`}>
            <div className="max-w-3xl mx-auto space-y-4 font-noto">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  isDark ? 'bg-slate-900/90 border-blue-900/40' : 'bg-white border-blue-100 shadow-sm'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400">{profiles.length}</p>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  isDark ? 'bg-slate-900/90 border-blue-900/40' : 'bg-white border-blue-100 shadow-sm'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{isBn ? 'গড় জিপিএ' : 'Average GPA'}</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{avgGpa}</p>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  isDark ? 'bg-slate-900/90 border-blue-900/40' : 'bg-white border-blue-100 shadow-sm'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{isBn ? 'মুমতায / A+' : 'Top Performers'}</span>
                  <p className="text-xl font-black text-amber-500">{topCount}</p>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  isDark ? 'bg-slate-900/90 border-blue-900/40' : 'bg-white border-blue-100 shadow-sm'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{isBn ? 'বিশেষ নজর' : 'Needs Support'}</span>
                  <p className="text-xl font-black text-rose-500">{needsCareCount}</p>
                </div>
              </div>

              {/* Class Pedagogy Overview Banner */}
              <div className={`p-5 rounded-3xl border space-y-3 ${
                isDark ? 'bg-gradient-to-br from-[#081726] to-[#040E1A] border-blue-900/50' : 'bg-white border-blue-100 shadow-md'
              }`}>
                <div className="flex items-center gap-2 font-black text-sm text-blue-950 dark:text-blue-200">
                  <Bot className="w-5 h-5 text-blue-500" />
                  <span>{isBn ? 'শ্রেণির শিক্ষাগত সারসংক্ষেপ (Class AI Insight)' : 'Class Pedagogical Summary'}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {isBn 
                    ? `শ্রেণিতে মোট ${profiles.length} জন শিক্ষার্থীর মধ্যে ${topCount} জন শিক্ষার্থী চমৎকার পারফরম্যান্স করেছে (GPA 4.00+)। ${needsCareCount} জন শিক্ষার্থীর ক্ষেত্রে নিয়মিত ক্লাসে উপস্থিতি ও মৌলিক বিষয়গুলোতে বিশেষ নজর দেওয়া প্রয়োজন। এআই ইঞ্জিন প্রতিটি শিক্ষার্থীর মার্কস ও উপস্থিতির ডাটা বিশ্লেষণ করে ব্যক্তিগতকৃত মন্তব্য তৈরি করেছে।`
                    : `Among ${profiles.length} students, ${topCount} achieved outstanding results (GPA 4.00+). ${needsCareCount} students require targeted support in core subjects and daily attendance tracking.`
                  }
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          /* Live Preview Mode */
          <div className={`flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar ${isDark ? 'bg-[#030913]' : 'bg-slate-100/70'}`}>
            <div className="max-w-2xl mx-auto space-y-4">
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 flex-wrap ${
                isDark ? 'bg-slate-900/90 border-blue-900/40' : 'bg-white border-blue-100 shadow-sm'
              }`}>
                <div className="flex items-center gap-2 font-noto text-xs font-bold text-slate-700 dark:text-slate-300">
                  <User className="w-4 h-4 text-blue-500" />
                  <span>{isBn ? 'শিক্ষার্থী নির্বাচন:' : 'Select Student:'}</span>
                </div>
                <select
                  value={previewStudentId}
                  onChange={e => setPreviewStudentId(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-xl border outline-none font-noto max-w-full ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  {profiles.map(p => (
                    <option key={p.student_id} value={p.student_id}>
                      রোল #{p.roll} - {p.student_name} (GPA {typeof p.gpa === 'number' ? p.gpa.toFixed(2) : p.gpa})
                    </option>
                  ))}
                </select>
              </div>

              {/* Marksheet Preview */}
              <div className="bg-white text-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xl space-y-3 font-noto text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      D
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{isBn ? 'রেজাল্ট কার্ডে শিক্ষক মন্তব্যের অবস্থান' : 'Result Card Remark Preview'}</h4>
                      <p className="text-[9px] text-slate-400">{isBn ? 'অফিসিয়াল একাডেমিক মার্কশীট প্রিভিউ' : 'Official Academic Transcript Preview'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                    Official Stamp
                  </span>
                </div>

                <div className="bg-blue-50/60 rounded-2xl p-3.5 sm:p-4 border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-[10px] font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {isBn ? 'শিক্ষকের মূল্যায়ন ও দিকনির্দেশনা' : 'Teacher Evaluation & Guidance'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-blue-700">
                      Roll #{currentPreviewProfile?.roll} · {currentPreviewProfile?.student_name}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-serif italic bg-white p-3 sm:p-4 rounded-xl border border-blue-100 shadow-xs">
                    "{currentPreviewText || (isBn ? 'কোনো মন্তব্য প্রস্তুত নেই' : 'No remark available')}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Cards View */
          <div className={`flex-1 overflow-y-auto p-2.5 sm:p-5 space-y-3 sm:space-y-4 custom-scrollbar ${isDark ? 'bg-[#040A14]' : 'bg-[#F4F8FC]'}`}>
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs sm:text-sm font-noto">
                {isBn ? 'কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি' : 'No students found matching criteria'}
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

                const weakSubs = remarkObj?.growth_areas_bn?.length ? remarkObj.growth_areas_bn.join(', ') : 'বাংলা, ইংরেজি';
                const parentTip = remarkObj?.parent_tip_bn || 'বাড়িতে নিয়মিত পড়া রিভিশন করতে উৎসাহিত করুন।';

                return (
                  <div 
                    key={student.student_id}
                    className={`rounded-2xl sm:rounded-3xl border p-3.5 sm:p-5 transition-all space-y-3 shadow-xs ${
                      isDark 
                        ? 'bg-gradient-to-br from-[#071322] via-[#091829] to-[#06111D] border-blue-950/80 hover:border-blue-600/40' 
                        : 'bg-white border-blue-100/80 hover:border-blue-300'
                    }`}
                  >
                    {/* Top Row: Roll badge, Name, Merit, Attendance, GPA Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 shrink-0">
                          #{student.roll}
                        </span>
                        <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white font-noto truncate">
                          {student.student_name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2.5 justify-between sm:justify-end text-xs font-noto shrink-0 flex-wrap">
                        <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                          <span>{isBn ? 'মেধা:' : 'Rank:'} <strong className="text-amber-500">#{student.rank || '-'}</strong></span>
                          <span>{isBn ? 'উপস্থিতি:' : 'Att:'} <strong className="text-emerald-500">{student.attendance_rate || 90}%</strong></span>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono border ${
                          isFail
                            ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                            : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                        }`}>
                          {student.grade || 'F'} (GPA {gpaDisplay})
                        </span>
                      </div>
                    </div>

                    {/* Focus Subject Tag */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-noto">
                      <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50/80 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/40">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{isBn ? `গুরুত্বপূর্ণ বিষয়: ${weakSubs}` : `Focus Areas: ${weakSubs}`}</span>
                      </div>
                    </div>

                    {/* Teacher's Final Remark Quote Box */}
                    <div className={`p-3 sm:p-4 rounded-2xl border space-y-2 transition-all ${
                      isDark 
                        ? 'bg-[#091A2E] border-blue-900/50 text-slate-100' 
                        : 'bg-[#EEF6FF] border-blue-100 text-slate-900'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-noto flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-black text-blue-900 dark:text-blue-200 text-xs">
                            {isBn ? 'শিক্ষকের চূড়ান্ত মন্তব্য:' : 'Teacher Remark:'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRegenerateSingle(student)}
                            disabled={regeneratingId === student.student_id}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="Regenerate single student remark"
                          >
                            <Wand2 className={`w-3 h-3 ${regeneratingId === student.student_id ? 'animate-spin text-amber-500' : ''}`} />
                            <span>{isBn ? 'পুনরায় লিখুন' : 'Re-write'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyRemark(student.student_id, currentText)}
                            className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-blue-600 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === student.student_id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedId === student.student_id ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}</span>
                          </button>

                          {isEdited && (
                            <button
                              type="button"
                              onClick={() => handleResetSingle(student.student_id)}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{isBn ? 'রিসেট' : 'Reset'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Textarea */}
                      <textarea
                        rows={2}
                        value={currentText}
                        onChange={e => handleEditRemark(student.student_id, e.target.value)}
                        placeholder={isBn ? 'শিক্ষার্থীর জন্য বিশেষ মন্তব্য লিখুন...' : 'Write custom remark...'}
                        className={`w-full text-xs sm:text-sm rounded-xl p-2.5 sm:p-3 leading-relaxed font-noto resize-none transition-all outline-none border ${
                          isDark 
                            ? 'bg-[#030D18] border-blue-900 text-white placeholder-slate-500 focus:border-blue-400' 
                            : 'bg-white border-blue-200/80 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
                        }`}
                      />

                      {/* Quick Insertion Chips */}
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                        {quickPhrasesBn.map((phrase, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => handleAppendPhrase(student.student_id, phrase)}
                            className={`text-[10px] sm:text-[11px] px-2 py-0.5 sm:py-1 rounded-lg font-noto font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer border ${
                              isDark 
                                ? 'bg-slate-900 border-blue-900 text-blue-300 hover:bg-blue-950' 
                                : 'bg-white border-blue-200 text-blue-800 hover:bg-blue-50 shadow-2xs'
                            }`}
                          >
                            + {phrase.length > 20 ? phrase.slice(0, 20) + '...' : phrase}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Guardian Action Advice Banner */}
                    <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border flex items-center justify-between gap-2 text-xs font-noto transition-colors ${
                      isDark 
                        ? 'bg-[#181104] border-amber-950/80 text-amber-200' 
                        : 'bg-[#FFF9EE] border-amber-200/80 text-amber-950'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Heart className="w-3.5 h-3.5 text-amber-500 shrink-0 fill-amber-500/20" />
                        <div className="min-w-0 text-[11px] sm:text-xs">
                          <span className="font-black text-amber-700 dark:text-amber-400 mr-1">{isBn ? 'অভিভাবকের করণীয়:' : 'Parent Tip:'}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{parentTip}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Modal Sticky Responsive Footer */}
        <div 
          className={`px-3.5 sm:px-6 py-2.5 sm:py-3 border-t flex flex-row items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-[#030913] border-blue-950' : 'bg-white border-slate-200'
          }`}
          style={{ paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className={`text-xs font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="font-black text-blue-600 dark:text-blue-400 tabular-nums">{filteredProfiles.length}</span> {isBn ? 'জন শিক্ষার্থী' : 'students'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer font-noto ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer font-noto border border-blue-400/30"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isBn ? 'মন্তব্য সংরক্ষণ' : 'Save Remarks'}</span>
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {isSavedToast && (
          <div className="absolute top-4 right-4 bg-blue-950 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-blue-400 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 z-50 font-noto">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isBn ? 'সকল মন্তব্য সফলভাবে সংরক্ষিত হয়েছে!' : 'Remarks saved successfully!'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
