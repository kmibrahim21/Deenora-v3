import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { pushToParents } from '../lib/notifyParents';
import { 
  Mic,
  MicOff,
  Paperclip,
  Image as ImageIcon,
  Sparkles,
  MessageSquare, 
  Calendar, 
  Send, 
  List, 
  Trash2, 
  CalendarDays, 
  BookOpen, 
  Clock, 
  FileText, 
  Plus, 
  Bell, 
  Users, 
  CheckCircle2, 
  Circle,
  RefreshCw,
  Pencil,
  Copy,
  Download,
  X,
  AlertTriangle,
  ArrowLeft,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  PenTool,
  PlusCircle,
  Save,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Institution, Language } from '../types';
import { OfflineService } from '../services/OfflineService';
import { getTodayDateString } from '../utils/calendarUtils';
import { sortMadrasahClasses } from 'pages/Classes';
import { generateMessagePDF } from '../utils/pdfGenerator';

import { requestManager } from 'services/RequestManager';
import { DeenoraDatePicker } from '../components/common/DeenoraDatePicker';

// Sub-components
const SyllabusItem = ({ item, onDelete, onEdit, onDownload, isDownloading }: { item: any, onDelete: (id: string) => void, onEdit: (item: any) => void, onDownload: (item: any) => void, isDownloading: boolean }) => {
  const subjects = item.parsedMessage?.subjects || [];
  return (
    <div className="p-3 group hover:bg-slate-50 transition-colors">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
             <h4 className="font-bold text-slate-800 text-base truncate">{item.title}</h4>
             <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-slate-200 shrink-0">
                {item.class_name.replace('APP_SYLLABUS_', '')}
             </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">Session: {item.parsedMessage?.session}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.parsedMessage?.status === 'draft' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold shrink-0">ড্রাফট</span>}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onDownload(item)} disabled={isDownloading} className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-lg shadow-sm transition-all shrink-0 disabled:opacity-50" title="Download">
              {isDownloading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            </button>
            <button onClick={() => onEdit(item)} className="p-1.5 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg shadow-sm transition-all shrink-0" title="Edit">
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-lg shadow-sm transition-all shrink-0" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
             <tr>
               <th className="py-1.5 px-3 w-1/3">Subject</th>
               <th className="py-1.5 px-3">Details</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {subjects.map((sub: any, idx: number) => (
               <tr key={idx} className="hover:bg-slate-50/50">
                 <td className="py-1.5 px-3 font-bold text-slate-700">{sub.subject}</td>
                 <td className="py-1.5 px-3 text-slate-500 leading-normal">{sub.details}</td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function Messages({ 
  lang = 'bn',
  madrasah,
  profile,
  onBack
}: { 
  lang?: Language;
  madrasah: Institution | null;
  profile?: any;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'messages' | 'notices' | 'syllabus' | 'suggestion'>('messages');

  // Modals
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownload = async (msg: any) => {
    setIsDownloading(msg.id);
    try {
      await generateMessagePDF(madrasah, msg, lang);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে' : 'Failed to generate PDF');
    } finally {
      setIsDownloading(null);
    }
  };

  // Redesigned Diary States
  const [selectedClass, setSelectedClass] = useState('');
  const [diarySubView, setDiarySubView] = useState<'overview' | 'editor'>('overview');
  const [diaryTab, setDiaryTab] = useState<'today' | 'past'>('today');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classSubjects, setClassSubjects] = useState<string[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lecturePeriod, setLecturePeriod] = useState('');
  const [homeworkDesc, setHomeworkDesc] = useState('');
  
  // Custom Modal States
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);
  const [editingSubjectIndex, setEditingSubjectIndex] = useState<number | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', type: 'danger' as 'danger' | 'success' | 'info' });
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // Past diaries filter states (independent from composer state to avoid hiding past diaries!)
  const [pastFilterClass, setPastFilterClass] = useState('');
  const [pastFilterDate, setPastFilterDate] = useState('');
  const [pastSearchQuery, setPastSearchQuery] = useState('');

  // Notice filter states
  const [noticeSearch, setNoticeSearch] = useState('');
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<'all' | 'APP_NOTICE' | 'APP_HOLIDAY' | 'APP_PTM'>('all');
  const [noticeClassFilter, setNoticeClassFilter] = useState('all');

  // Syllabus filter & subject editor states
  const [syllabusTitle, setSyllabusTitle] = useState('');
  const [syllabusClass, setSyllabusClass] = useState('');
  const [syllabusExam, setSyllabusExam] = useState('');
  const [syllabusSession, setSyllabusSession] = useState('2025-26');
  const [syllabusSearch, setSyllabusSearch] = useState('');
  const [syllabusClassFilter, setSyllabusClassFilter] = useState('all');
  const [syllabusSubView, setSyllabusSubView] = useState<'overview' | 'editor'>('overview');
  const [syllabusTab, setSyllabusTab] = useState<'subjects' | 'all'>('subjects');
  const [syllabusSelectedSubject, setSyllabusSelectedSubject] = useState('');
  const [syllabusSubjectDetails, setSyllabusSubjectDetails] = useState('');
  const [syllabusSubjectNote, setSyllabusSubjectNote] = useState('');
  const [syllabusSubjectList, setSyllabusSubjectList] = useState([
    { subject: 'বাংলা', details: '' }
  ]);

  // Suggestion filter & subject editor states
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionClass, setSuggestionClass] = useState('');
  const [suggestionExam, setSuggestionExam] = useState('');
  const [suggestionSession, setSuggestionSession] = useState('2025-26');
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [suggestionClassFilter, setSuggestionClassFilter] = useState('all');
  const [suggestionSubView, setSuggestionSubView] = useState<'overview' | 'editor'>('overview');
  const [suggestionTab, setSuggestionTab] = useState<'subjects' | 'all'>('subjects');
  const [suggestionSelectedSubject, setSuggestionSelectedSubject] = useState('');
  const [suggestionSubjectDetails, setSuggestionSubjectDetails] = useState('');
  const [suggestionSubjectNote, setSuggestionSubjectNote] = useState('');
  const [suggestionSubjectList, setSuggestionSubjectList] = useState([
    { subject: 'বাংলা', details: '' }
  ]);
  
  const [title, setTitle] = useState('');
  const [msgDate, setMsgDate] = useState(getTodayDateString());
  const [diaryNote, setDiaryNote] = useState('');
  const [diaryAttachments, setDiaryAttachments] = useState<{ url: string; name: string; type: 'image' | 'pdf' }[]>([]);
  const [activeListeningIndex, setActiveListeningIndex] = useState<number | null>(null);
  const [isListeningNote, setIsListeningNote] = useState(false);
  const [diarySubjects, setDiarySubjects] = useState([
    { subject: 'বাংলা', details: '' }
  ]);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: 'image' | 'pdf' } | null>(null);

  const COMMON_DIARY_SUBJECTS = [
    'বাংলা', 'ইংরেজি', 'গণিত', 'আরবি', 'কুরআন মজিদ', 
    'হাদীস শরীফ', 'আকাইদ ও ফিকহ', 'বিজ্ঞান', 'বাংলাদেশ ও বিশ্বপরিচয়', 'সাধারণ জ্ঞান'
  ];

  const fetchClassSubjects = async (classIdentifier: string) => {
    if (!classIdentifier) return;

    // 1. Check localStorage for user-customized subjects
    const storageKey = `deenora_class_subjects_${madrasah?.id || 'default'}_${classIdentifier}`;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setClassSubjects(parsed);
          return;
        }
      }
    } catch (e) {}

    // 2. Look up class in classes list
    const targetClassObj = classes.find(c => c.class_name === classIdentifier || c.id === classIdentifier);
    const classId = targetClassObj?.id;

    if (classId && isUUID(classId)) {
      try {
        const { data, error } = await supabase
          .from('class_routines')
          .select('subject_name')
          .eq('institution_id', madrasah?.id)
          .eq('class_id', classId);
        
        if (!error && data && data.length > 0) {
          const uniqueSubjects = Array.from(new Set(data.map((r: any) => r.subject_name))).filter(Boolean) as string[];
          if (uniqueSubjects.length > 0) {
            setClassSubjects(uniqueSubjects);
            try {
              localStorage.setItem(storageKey, JSON.stringify(uniqueSubjects));
            } catch(e) {}
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching subjects from routines:', err);
      }
    }

    // 3. Fallback to common diary subjects
    setClassSubjects(COMMON_DIARY_SUBJECTS);
  };

  const updateAndPersistSubjects = (newSubjects: string[]) => {
    setClassSubjects(newSubjects);
    const targetCls = activeTab === 'syllabus' ? (syllabusClass || selectedClass) : activeTab === 'suggestion' ? (suggestionClass || selectedClass) : selectedClass;
    if (targetCls && madrasah?.id) {
      const storageKey = `deenora_class_subjects_${madrasah.id}_${targetCls}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSubjects));
      } catch(e) {}
    }
  };

  useEffect(() => {
    const targetCls = activeTab === 'syllabus' ? (syllabusClass || selectedClass) : activeTab === 'suggestion' ? (suggestionClass || selectedClass) : selectedClass;
    if (targetCls) {
      fetchClassSubjects(targetCls);
      try {
        localStorage.setItem('deenora_last_selected_class', targetCls);
      } catch(e) {}
    }
  }, [selectedClass, syllabusClass, suggestionClass, activeTab]);

  const isUUID = (str?: string) => {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
  };

  const removeUUIDFromText = (text?: string) => {
    if (!text) return '';
    const clean = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '').replace(/\s+/g, ' ').trim();
    return clean || 'ডায়েরি ও বাড়ির কাজ';
  };

  const getDisplayClassName = (rawName?: string) => {
    if (!rawName) return 'নির্দিষ্ট শ্রেণি';
    let cleanName = rawName.replace(/^(APP_DIARY_|APP_NOTICE_|APP_SYLLABUS_|APP_SUGGESTION_|APP_ROUTINE_|APP_)/i, '').trim();
    if (isUUID(cleanName)) {
      const matchedClass = classes.find(c => c.id === cleanName || c.class_id === cleanName);
      if (matchedClass) {
        return matchedClass.class_name;
      }
      return 'শ্রেণি';
    }
    return removeUUIDFromText(cleanName) || 'শ্রেণি';
  };

  const handleAutoTitle = () => {
    if (!msgDate) return;
    const d = new Date(msgDate);
    if (isNaN(d.getTime())) return;
    const day = d.getDate();
    const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const month = monthsBn[d.getMonth()];
    const dayName = daysBn[d.getDay()];
    const bnDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    const bnDay = String(day).replace(/[0-9]/g, x => bnDigits[x]);
    const bnYear = String(d.getFullYear()).replace(/[0-9]/g, x => bnDigits[x]);
    
    const classDisplay = selectedClass ? getDisplayClassName(selectedClass) : '';
    const classPrefix = classDisplay ? `${classDisplay} - ` : '';
    const formatted = `${classPrefix}${bnDay} ${month} ${bnYear}, ${dayName} এর ডায়েরি ও বাড়ির কাজ`;
    setTitle(formatted);
  };

  const setTodayDate = () => {
    const today = getTodayDateString();
    setMsgDate(today);
  };

  const setTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    setMsgDate(tomorrowStr);
  };

  const setYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    setMsgDate(yesterdayStr);
  };

  const getYesterdayDateString = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const adjustMsgDate = (days: number) => {
    const cur = new Date(msgDate || getTodayDateString());
    if (isNaN(cur.getTime())) {
      setMsgDate(getTodayDateString());
      return;
    }
    cur.setDate(cur.getDate() + days);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    setMsgDate(`${y}-${m}-${d}`);
  };

  const getBengaliFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('T')[0].split('-');
    let d: Date;
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return String(dateStr);
    const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBn = (n: number | string) => String(n).replace(/[0-9]/g, w => bnDigits[Number(w)]);
    
    const dayName = daysBn[d.getDay()];
    const day = toBn(d.getDate());
    const month = monthsBn[d.getMonth()];
    const year = toBn(d.getFullYear());
    
    return `${day} ${month} ${year}, ${dayName}`;
  };

  const getDateRelativeTag = (dateStr: string) => {
    const today = getTodayDateString();
    const cleanDate = String(dateStr).split('T')[0];
    if (cleanDate === today) return 'আজকের দিন';
    
    const d = new Date(cleanDate);
    const t = new Date(today);
    const diffTime = d.getTime() - t.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    
    if (diffDays === 1) return 'আগামীকাল';
    if (diffDays === -1) return 'গতকাল';
    return '';
  };

  const addOrSetSubject = (subjectName: string) => {
    const emptyIndex = diarySubjects.findIndex(s => !s.subject.trim());
    if (emptyIndex !== -1) {
      const updated = [...diarySubjects];
      updated[emptyIndex] = { ...updated[emptyIndex], subject: subjectName };
      setDiarySubjects(updated);
    } else {
      setDiarySubjects(prev => [...prev, { subject: subjectName, details: '' }]);
    }
  };

  const loadDefaultClassSubjects = () => {
    setDiarySubjects([
      { subject: 'বাংলা', details: '' },
      { subject: 'ইংরেজি', details: '' },
      { subject: 'গণিত', details: '' },
      { subject: 'আরবি', details: '' }
    ]);
  };

  // Form states - Notice
  const [noticeType, setNoticeType] = useState('APP_NOTICE');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDate, setNoticeDate] = useState(getTodayDateString());
  const [noticeDesc, setNoticeDesc] = useState('');
  const [noticeClass, setNoticeClass] = useState('All Classes');
  const [noticeTarget, setNoticeTarget] = useState('All Parents');

  // Form states - Routine
  const [routineClass, setRoutineClass] = useState('');
  const [routineEffectiveDate, setRoutineEffectiveDate] = useState(getTodayDateString());
  const [routineNote, setRoutineNote] = useState('');
  const [routineRows, setRoutineRows] = useState([
    { id: '1', time: '8:00 - 9:00', Sunday: 'Hifz', Monday: 'Quran', Tuesday: 'Hifz', Wednesday: 'Arabic', Thursday: 'Hifz' },
    { id: '2', time: '9:00 - 10:00', Sunday: 'Tajweed', Monday: 'Arabic', Tuesday: 'Tajweed', Wednesday: 'Quran', Thursday: 'Arabic' },
    { id: '3', time: '10:00 - 10:15', isBreak: true, label: 'Break' },
    { id: '4', time: '10:15 - 11:15', Sunday: 'Islam', Monday: 'Hadith', Tuesday: 'Islam', Wednesday: 'Akhlaq', Thursday: 'Hadith' },
    { id: '5', time: '11:15 - 12:15', Sunday: 'Bangla', Monday: 'English', Tuesday: 'Math', Wednesday: 'Bangla', Thursday: 'English' },
  ]);



  useEffect(() => {
    if (madrasah?.id) {
      fetchData();
    }
  }, [madrasah?.id]);

  const fetchData = async () => {
    if (!madrasah?.id) return;
    setIsLoading(true);
    try {
      // Use Promise.all for parallel fetching
      const [clsResult, historyResult] = await Promise.all([
        requestManager.cachedFetch(
          'classes',
          (q) => q.select('id, class_name, sort_order').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
          `classes:${madrasah.id}`,
          30 * 60 * 1000 // 30 mins
        ),
        supabase.from('messages')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('created_at', { ascending: false })
          .limit(300)
      ]);

      if (clsResult.data) {
        const sorted = sortMadrasahClasses(clsResult.data);
        setClasses(sorted);
        setSelectedClass(prev => {
          if (prev) return prev;
          const remembered = localStorage.getItem('deenora_last_selected_class');
          if (remembered && sorted.some((c: any) => c.class_name === remembered)) {
            return remembered;
          }
          return sorted[0]?.class_name || '';
        });
      }
      if (historyResult.data) setMessages(historyResult.data);

    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    if (item.class_name.startsWith('APP_SYLLABUS_')) {
      setSyllabusTitle(item.title);
      setSyllabusClass(item.class_name.replace('APP_SYLLABUS_', ''));
      setSyllabusSession(item.parsedMessage?.session || '2025-26');
      setSyllabusExam(item.parsedMessage?.exam || '');
      setSyllabusSubjectList(item.parsedMessage?.subjects || []);
      setShowSyllabusModal(true);
    
    } else if (item.class_name.startsWith('APP_SUGGESTION_')) {
      setSuggestionTitle(item.title);
      setSuggestionClass(item.class_name.replace('APP_SUGGESTION_', ''));
      setSuggestionSession(item.parsedMessage?.session || '2025-26');
      setSuggestionExam(item.parsedMessage?.exam || '');
      setSuggestionSubjectList(item.parsedMessage?.subjects || []);
      setShowSuggestionModal(true);
} else if (['APP_NOTICE', 'APP_HOLIDAY', 'APP_PTM', 'APP_DIARY', 'all'].includes(item.class_name)) {
      setNoticeTitle(item.title);
      setNoticeDate(item.parsedMessage?.date || getTodayDateString());
      setNoticeDesc(item.parsedMessage?.desc || '');
      setNoticeType(item.class_name);
      setNoticeClass(item.parsedMessage?.classGroup || 'All Classes');
      setNoticeTarget(item.parsedMessage?.sendTo || 'All Parents');
      setShowNoticeModal(true);
    } else {
      // Diary edit logic (Redesigned UI)
      const p = item.parsedMessage;
      setTitle(item.title);
      setSelectedClass(item.class_name);
      setMsgDate(p?.date || getTodayDateString());
      setDiaryNote(p?.note || '');
      setDiaryAttachments(p?.attachments || []);
      
      if (p?.version === 'v2') {
        setSelectedSubject(p.subject || '');
        setLessonTitle(p.lesson || '');
        setLecturePeriod(p.period || '');
        setHomeworkDesc(p.homework || '');
        setDiarySubjects([{ subject: p.subject, details: p.details || '' }]);
      } else {
        setDiarySubjects(p?.subjects || [{ subject: 'বাংলা', details: '' }]);
        setSelectedSubject(p?.subjects?.[0]?.subject || '');
        setHomeworkDesc('');
        setLessonTitle('');
        setLecturePeriod('');
      }
      
      setDiarySubView('editor');
      // Scroll to top of editor
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('messages').delete().eq('id', deletingId);
      if (error) throw error;
      await fetchData();
      setShowDeleteModal(false);
      setDeletingId(null);
    } catch (err) {
      console.error(err);
      alert('মুছে ফেলতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (msg: any) => {
    if(!msg.parsedMessage) return;
    try {
      const newStatus = msg.parsedMessage.status === 'completed' ? 'pending' : 'completed';
      const newPayload = { ...msg.parsedMessage, status: newStatus };
      await OfflineService.safeUpdate('messages', msg.id, {
        message: JSON.stringify(newPayload)
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  
  const handleVoiceInput = (
    onText: (text: string) => void,
    onListeningChange: (listening: boolean) => void
  ) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('আপনার ব্রাউজার বা ডিভাইসে ভয়েস ইনপুট সমর্থিত নয়। অনুগ্রহ করে টাইপ করুন বা ক্রোম ব্যবহার করুন।');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      onListeningChange(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0]?.transcript;
        if (transcript) onText(transcript);
        onListeningChange(false);
      };
      recognition.onerror = () => onListeningChange(false);
      recognition.onend = () => onListeningChange(false);
      recognition.start();
    } catch (e) {
      onListeningChange(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isImg = file.type.startsWith('image/');
      if (!isPdf && !isImg) {
        alert('শুধুমাত্র ছবি (JPG, PNG) বা PDF ফাইল আপলোড করতে পারবেন।');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('ফাইল সাইজ ১০ মেগাবাইটের বেশি হতে পারবে না।');
        continue;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (url) {
          setDiaryAttachments(prev => [...prev, { url, name: file.name, type: isPdf ? 'pdf' : 'image' }]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyYesterdayDiary = () => {
    if (!selectedClass) {
      alert('অনুগ্রহ করে আগে শ্রেণী নির্বাচন করুন।');
      return;
    }
    const latest = messages.find(m => m.class_name === selectedClass);
    if (!latest) {
      alert('এই শ্রেণীর জন্য পূর্বে পাঠানো কোনো ডায়েরি পাওয়া যায়নি।');
      return;
    }
    try {
      const parsed = typeof latest.message === 'string' ? JSON.parse(latest.message) : (latest.message || {});
      if (parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
        setDiarySubjects(parsed.subjects);
      }
      if (parsed.note) setDiaryNote(parsed.note);
      if (parsed.attachments) setDiaryAttachments(parsed.attachments);
      alert('পূর্বের ডায়েরির তথ্য সফলভাবে কপি করা হয়েছে!');
    } catch (e) {
      alert('ডায়েরি কপি করতে সমস্যা হয়েছে।');
    }
  };

  const submitMessage = async (e?: React.FormEvent, isDraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Determine which payload to use: New structured diary or standard message
    const isNewDiary = diarySubView === 'editor';
    
    // Auto-resolve effective class and subject safely so teachers are never blocked
    const effectiveSubject = selectedSubject || diarySubjects[0]?.subject || (classSubjects.length > 0 ? classSubjects[0] : '');
    const effectiveClass = selectedClass || (classes.length > 0 ? classes[0].class_name : '') || localStorage.getItem('deenora_last_selected_class') || '';

    if (isNewDiary) {
      if (!effectiveClass || !effectiveSubject) return alert('শ্রেণি এবং বিষয় নির্বাচন করুন।');
    } else {
      if (!effectiveClass || !title) return alert('অনুগ্রহ করে আবশ্যক তথ্যগুলো দিন।');
    }

    setIsSubmitting(true);
    try {
      let payload: any;
      let finalTitle = title;

      if (isNewDiary) {
        payload = {
          date: msgDate,
          subject: effectiveSubject,
          lesson: lessonTitle,
          period: lecturePeriod,
          details: diarySubjects[0]?.details || '', 
          homework: homeworkDesc,
          note: diaryNote,
          attachments: diaryAttachments,
          status: isDraft ? 'draft' : 'published',
          version: 'v2' // Tag for new structured diary
        };
        finalTitle = `${getDisplayClassName(effectiveClass)} - ${effectiveSubject} (${msgDate})`;
      } else {
        payload = {
          date: msgDate,
          subjects: diarySubjects,
          note: diaryNote, 
          attachments: diaryAttachments, 
          status: isDraft ? 'draft' : 'published'
        };
      }
      
      // Check for existing diary for same class, date & subject (for new diary v2)
      if (!editingItem && !isDraft && isNewDiary) {
        const existing = messages.find(m => {
          try {
            const p = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
            return m.class_name === effectiveClass && p.date === msgDate && p.subject === effectiveSubject && p.version === 'v2';
          } catch(e) { return false; }
        });
        
        if (existing) {
          setConfirmConfig({
            title: 'ডায়েরি ইতিমধ্যে আছে',
            message: `${getDisplayClassName(effectiveClass)} এর জন্য ${effectiveSubject} বিষয়ের ডায়েরি ইতিমধ্যে আছে। আপনি কি সেটি আপডেট করতে চান?`,
            type: 'info'
          });
          setConfirmAction(() => () => {
            setEditingItem(existing);
            setShowConfirmModal(false);
            // Re-trigger submit with the now set editingItem
            setTimeout(() => {
              submitMessage(undefined, isDraft);
            }, 100);
          });
          setShowConfirmModal(true);
          setIsSubmitting(false);
          return;
        }
      }

      const existingRecord = messages.find(m => {
        try {
          const p = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
          return m.class_name === effectiveClass && p.date === msgDate && p.subject === effectiveSubject && p.version === 'v2';
        } catch(e) { return false; }
      });

      if (editingItem || (isNewDiary && !editingItem && existingRecord)) {
        // Resolve ID if we found a duplicate
        const targetId = editingItem?.id || existingRecord?.id;

        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: targetId,
            class_name: effectiveClass,
            title: finalTitle,
            message: payload,
            sender_name: profile?.name || 'Teacher'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || 'ডায়েরি আপডেট করতে সমস্যা হয়েছে।');
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: effectiveClass,
          title: finalTitle,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Teacher'
        });
        if (error) throw error;
        
        if (!isDraft) {
          pushToParents({
            institution_id: madrasah?.id,
            class_name: effectiveClass,
            title: finalTitle || 'ডায়েরি',
            body: `আজকের (${effectiveSubject || 'পড়া'}) ডায়েরি দেওয়া হয়েছে — দেখে নিন`,
          });
        }
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setDiarySubView('overview');
      setEditingItem(null);
      resetDiaryForm();
      await fetchData();
      alert('সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      console.error('Submit error:', err);
      alert('তথ্য সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally { setIsSubmitting(false); }
  };

  const resetDiaryForm = () => {
    setTitle(''); 
    setDiaryNote(''); 
    setDiaryAttachments([]);
    setLessonTitle('');
    setLecturePeriod('');
    setHomeworkDesc('');
  };

  const openDiaryEditorForSubject = (sub: string, existing?: any) => {
    setSelectedSubject(sub);
    if (existing) {
      setEditingItem(existing);
      try {
        const p = typeof existing.message === 'string' ? JSON.parse(existing.message) : (existing.message || {});
        setLessonTitle(p.lesson || '');
        setLecturePeriod(p.period || '');
        setHomeworkDesc(p.homework || '');
        setDiaryNote(p.note || '');
        setDiaryAttachments(p.attachments || []);
        if (p.subjects && Array.isArray(p.subjects) && p.subjects.length > 0) {
          const subData = p.subjects.find((s: any) => s.subject === sub);
          setDiarySubjects([{ subject: sub, details: subData?.details || p.details || p.desc || '' }]);
          if (subData?.homework && !p.homework) setHomeworkDesc(subData.homework);
        } else {
          setDiarySubjects([{ subject: sub, details: p.details || p.desc || '' }]);
        }
      } catch (e) {
        setDiarySubjects([{ subject: sub, details: '' }]);
      }
    } else {
      setEditingItem(null);
      resetDiaryForm();
      setSelectedSubject(sub);
      setDiarySubjects([{ subject: sub, details: '' }]);
    }
    setDiarySubView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSyllabusEditorForSubject = (sub: string, existingItem?: any) => {
    setSyllabusSelectedSubject(sub);
    const effectiveClass = syllabusClass || selectedClass || (classes.length > 0 ? classes[0].class_name : '');
    if (!syllabusClass && effectiveClass) setSyllabusClass(effectiveClass);
    const effectiveExam = syllabusExam || '১ম সাময়িক পরীক্ষা';
    if (!syllabusExam) setSyllabusExam('১ম সাময়িক পরীক্ষা');
    
    const targetItem = existingItem || syllabusList.find(m => {
      const rawClass = m.class_name.replace('APP_SYLLABUS_', '');
      const p = m.parsedMessage || {};
      return (rawClass === effectiveClass || getDisplayClassName(rawClass) === getDisplayClassName(effectiveClass)) &&
             (p.exam || '') === effectiveExam;
    });

    if (targetItem) {
      setEditingItem(targetItem);
      try {
        const p = targetItem.parsedMessage || (typeof targetItem.message === 'string' ? JSON.parse(targetItem.message) : (targetItem.message || {}));
        const subData = (p.subjects || []).find((s: any) => s.subject?.trim().toLowerCase() === sub.trim().toLowerCase());
        setSyllabusSubjectDetails(subData?.details || p.details || '');
        setSyllabusSubjectNote(subData?.note || p.note || '');
        if (p.exam) setSyllabusExam(p.exam);
        if (p.session) setSyllabusSession(p.session);
      } catch (e) {
        setSyllabusSubjectDetails('');
        setSyllabusSubjectNote('');
      }
    } else {
      setEditingItem(null);
      setSyllabusSubjectDetails('');
      setSyllabusSubjectNote('');
    }
    setSyllabusSubView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitSubjectSyllabus = async (isDraft = false) => {
    const effectiveClass = syllabusClass || selectedClass || (classes.length > 0 ? classes[0].class_name : '');
    if (!effectiveClass) return alert('অনুগ্রহ করে শ্রেণি নির্বাচন করুন');
    if (!syllabusSelectedSubject) return alert('অনুগ্রহ করে বিষয় নির্বাচন করুন');
    if (!syllabusSubjectDetails.trim()) return alert('অনুগ্রহ করে সিলেবাসের বিবরণ লিখুন');

    setIsSubmitting(true);
    try {
      const targetClassName = `APP_SYLLABUS_${effectiveClass}`;
      const effectiveExam = syllabusExam || '১ম সাময়িক পরীক্ষা';
      const effectiveSession = syllabusSession || '২০২৫-২৬';

      // Find if an existing syllabus message exists for this class and exam
      const existingMsg = syllabusList.find(m => {
        const rawClass = m.class_name.replace('APP_SYLLABUS_', '');
        const p = m.parsedMessage || {};
        return (rawClass === effectiveClass || getDisplayClassName(rawClass) === getDisplayClassName(effectiveClass)) && 
               (p.exam || '') === effectiveExam && 
               (p.session || '') === effectiveSession;
      }) || editingItem;

      let subjectsArr: any[] = [];
      if (existingMsg) {
        const existingParsed = existingMsg.parsedMessage || {};
        subjectsArr = Array.isArray(existingParsed.subjects) ? [...existingParsed.subjects] : [];
        const existingIdx = subjectsArr.findIndex((s: any) => s.subject?.trim().toLowerCase() === syllabusSelectedSubject.trim().toLowerCase());
        const updatedEntry = {
          subject: syllabusSelectedSubject,
          details: syllabusSubjectDetails.trim(),
          note: syllabusSubjectNote.trim()
        };
        if (existingIdx >= 0) {
          subjectsArr[existingIdx] = updatedEntry;
        } else {
          subjectsArr.push(updatedEntry);
        }
      } else {
        subjectsArr = [{
          subject: syllabusSelectedSubject,
          details: syllabusSubjectDetails.trim(),
          note: syllabusSubjectNote.trim()
        }];
      }

      const payload = {
        subjects: subjectsArr,
        session: effectiveSession,
        exam: effectiveExam,
        status: isDraft ? 'draft' : 'published'
      };

      if (existingMsg) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingMsg.id,
            title: `সিলেবাস - ${effectiveClass} (${effectiveExam})`,
            class_name: targetClassName,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সিলেবাস আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: targetClassName,
          title: `সিলেবাস - ${effectiveClass} (${effectiveExam})`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setSyllabusSubView('overview');
      setEditingItem(null);
      setSyllabusSubjectDetails('');
      setSyllabusSubjectNote('');
      await fetchData();
      alert('সিলেবাস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('সিলেবাস সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSuggestionEditorForSubject = (sub: string, existingItem?: any) => {
    setSuggestionSelectedSubject(sub);
    const effectiveClass = suggestionClass || selectedClass || (classes.length > 0 ? classes[0].class_name : '');
    if (!suggestionClass && effectiveClass) setSuggestionClass(effectiveClass);
    const effectiveExam = suggestionExam || '১ম সাময়িক পরীক্ষা';
    if (!suggestionExam) setSuggestionExam('১ম সাময়িক পরীক্ষা');

    const targetItem = existingItem || suggestionList.find(m => {
      const rawClass = m.class_name.replace('APP_SUGGESTION_', '');
      const p = m.parsedMessage || {};
      return (rawClass === effectiveClass || getDisplayClassName(rawClass) === getDisplayClassName(effectiveClass)) &&
             (p.exam || '') === effectiveExam;
    });

    if (targetItem) {
      setEditingItem(targetItem);
      try {
        const p = targetItem.parsedMessage || (typeof targetItem.message === 'string' ? JSON.parse(targetItem.message) : (targetItem.message || {}));
        const subData = (p.subjects || []).find((s: any) => s.subject?.trim().toLowerCase() === sub.trim().toLowerCase());
        setSuggestionSubjectDetails(subData?.details || p.details || '');
        setSuggestionSubjectNote(subData?.note || p.note || '');
        if (p.exam) setSuggestionExam(p.exam);
        if (p.session) setSuggestionSession(p.session);
      } catch (e) {
        setSuggestionSubjectDetails('');
        setSuggestionSubjectNote('');
      }
    } else {
      setEditingItem(null);
      setSuggestionSubjectDetails('');
      setSuggestionSubjectNote('');
    }
    setSuggestionSubView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitSubjectSuggestion = async (isDraft = false) => {
    const effectiveClass = suggestionClass || selectedClass || (classes.length > 0 ? classes[0].class_name : '');
    if (!effectiveClass) return alert('অনুগ্রহ করে শ্রেণি নির্বাচন করুন');
    if (!suggestionSelectedSubject) return alert('অনুগ্রহ করে বিষয় নির্বাচন করুন');
    if (!suggestionSubjectDetails.trim()) return alert('অনুগ্রহ করে সাজেশনের বিবরণ লিখুন');

    setIsSubmitting(true);
    try {
      const targetClassName = `APP_SUGGESTION_${effectiveClass}`;
      const effectiveExam = suggestionExam || '১ম সাময়িক পরীক্ষা';
      const effectiveSession = suggestionSession || '২০২৫-২৬';

      const existingMsg = suggestionList.find(m => {
        const rawClass = m.class_name.replace('APP_SUGGESTION_', '');
        const p = m.parsedMessage || {};
        return (rawClass === effectiveClass || getDisplayClassName(rawClass) === getDisplayClassName(effectiveClass)) && 
               (p.exam || '') === effectiveExam && 
               (p.session || '') === effectiveSession;
      }) || editingItem;

      let subjectsArr: any[] = [];
      if (existingMsg) {
        const existingParsed = existingMsg.parsedMessage || {};
        subjectsArr = Array.isArray(existingParsed.subjects) ? [...existingParsed.subjects] : [];
        const existingIdx = subjectsArr.findIndex((s: any) => s.subject?.trim().toLowerCase() === suggestionSelectedSubject.trim().toLowerCase());
        const updatedEntry = {
          subject: suggestionSelectedSubject,
          details: suggestionSubjectDetails.trim(),
          note: suggestionSubjectNote.trim()
        };
        if (existingIdx >= 0) {
          subjectsArr[existingIdx] = updatedEntry;
        } else {
          subjectsArr.push(updatedEntry);
        }
      } else {
        subjectsArr = [{
          subject: suggestionSelectedSubject,
          details: suggestionSubjectDetails.trim(),
          note: suggestionSubjectNote.trim()
        }];
      }

      const payload = {
        subjects: subjectsArr,
        session: effectiveSession,
        exam: effectiveExam,
        status: isDraft ? 'draft' : 'published'
      };

      if (existingMsg) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingMsg.id,
            title: `সাজেশন - ${effectiveClass} (${effectiveExam})`,
            class_name: targetClassName,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সাজেশন আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: targetClassName,
          title: `সাজেশন - ${effectiveClass} (${effectiveExam})`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setSuggestionSubView('overview');
      setEditingItem(null);
      setSuggestionSubjectDetails('');
      setSuggestionSubjectNote('');
      await fetchData();
      alert('সাজেশন সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('সাজেশন সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitNotice = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!noticeTitle) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        date: noticeDate, 
        desc: noticeDesc, 
        classGroup: noticeClass, 
        sendTo: noticeTarget, 
        status: isDraft ? 'draft' : 'published' 
      };

      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            class_name: noticeType,
            title: noticeTitle,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'নোটিশ আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: noticeType,
          title: noticeTitle,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
        // Native Android push for parents (fire-and-forget, skip drafts)
        if (!isDraft) {
          pushToParents({
            institution_id: madrasah?.id,
            class_name: noticeType,
            title: noticeTitle || 'নতুন নোটিশ',
            body: 'প্রতিষ্ঠান থেকে নতুন নোটিশ প্রকাশিত হয়েছে',
          });
        }
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowNoticeModal(false);
      setEditingItem(null);
      setNoticeTitle(''); setNoticeDate(''); setNoticeDesc('');
      await fetchData();
    } finally { setIsSubmitting(false); }
  };

  const submitRoutine = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!routineClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      await OfflineService.safeInsert('messages', {
        institution_id: madrasah?.id,
        class_name: `APP_ROUTINE_${routineClass}`,
        title: "Class Routine",
        message: JSON.stringify({
          effectiveDate: routineEffectiveDate,
          note: routineNote,
          rows: routineRows,
          status: isDraft ? 'draft' : 'published'
        }),
        sender_name: profile?.name || 'Admin'
      });
      setShowRoutineModal(false);
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  
  const submitSuggestion = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!suggestionClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        subjects: suggestionSubjectList, 
        session: suggestionSession, 
        exam: suggestionExam,
        status: isDraft ? 'draft' : 'published' 
      };
      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            title: suggestionTitle || `Suggestion ${suggestionSession}`,
            class_name: `APP_SUGGESTION_${suggestionClass}`,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সাজেশন আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: `APP_SUGGESTION_${suggestionClass}`,
          title: suggestionTitle || `Suggestion ${suggestionSession}`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
        // Native Android push for parents (fire-and-forget, skip drafts)
        if (!isDraft) {
          pushToParents({
            institution_id: madrasah?.id,
            class_name: `APP_SUGGESTION_${suggestionClass}`,
            title: suggestionTitle || `সাজেশন ${suggestionSession}`,
            body: 'নতুন সাজেশন প্রকাশিত হয়েছে — দেখে নিন',
          });
        }
      }
      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowSuggestionModal(false);
      setEditingItem(null);
      await fetchData();
    } finally { setIsSubmitting(false); }
  };

  const submitSyllabus = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!syllabusClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        subjects: syllabusSubjectList, 
        session: syllabusSession, 
        exam: syllabusExam,
        status: isDraft ? 'draft' : 'published' 
      };

      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            title: syllabusTitle || `Syllabus ${syllabusSession}`,
            class_name: `APP_SYLLABUS_${syllabusClass}`,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সিলেবাস আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: `APP_SYLLABUS_${syllabusClass}`,
          title: syllabusTitle || `Syllabus ${syllabusSession}`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
        // Native Android push for parents (fire-and-forget, skip drafts)
        if (!isDraft) {
          pushToParents({
            institution_id: madrasah?.id,
            class_name: `APP_SYLLABUS_${syllabusClass}`,
            title: syllabusTitle || `সিলেবাস ${syllabusSession}`,
            body: 'নতুন সিলেবাস প্রকাশিত হয়েছে — দেখে নিন',
          });
        }
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowSyllabusModal(false);
      setEditingItem(null);
      await fetchData();
    } finally { setIsSubmitting(false); }
  };

  const handleDuplicateDiary = async (msg: any) => {
    if (!madrasah?.id) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('messages').insert({
        institution_id: madrasah.id,
        class_name: msg.class_name,
        title: `${msg.title} (Copy)`,
        message: typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
        sender_name: profile?.name || 'Admin',
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      
      sessionStorage.removeItem(`messages_cache_${madrasah.id}`);
      await fetchData();
      alert('ডায়েরিটি সফলভাবে কপি করা হয়েছে।');
    } catch (err) {
      console.error(err);
      alert('কপি করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };
  const parsedMessages = messages.map(msg => {
    let parsedMessage: any = {};
    try {
      let currentMsg = msg.message;
      for (let i = 0; i < 5; i++) {
        if (typeof currentMsg === 'string') {
          const trimmed = currentMsg.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            currentMsg = JSON.parse(trimmed);
          } else {
            break;
          }
        } else {
          break;
        }
      }
      parsedMessage = currentMsg;
      if (typeof parsedMessage !== 'object' || parsedMessage === null) {
        parsedMessage = { desc: String(msg.message) };
      }
    } catch(e) { 
      parsedMessage = { desc: msg.message }; 
    }
    return { ...msg, parsedMessage };
  });

  const studentMsgs = parsedMessages.filter(m => {
    if (m.class_name === 'APP_NOTICE' || m.class_name === 'APP_HOLIDAY' || m.class_name === 'APP_PTM' || m.class_name === 'all') return false;
    if (m.class_name?.startsWith('APP_SYLLABUS_') || m.class_name?.startsWith('APP_SUGGESTION_') || m.class_name?.startsWith('APP_ROUTINE_')) return false;
    return true;
  });
  const noticeList = parsedMessages.filter(m => 
    m.class_name === 'APP_NOTICE' || 
    m.class_name === 'APP_HOLIDAY' || 
    m.class_name === 'APP_PTM' || 
    m.class_name === 'all'
  );
  const syllabusList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SYLLABUS_'));
  const suggestionList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SUGGESTION_'));

  const filteredNotices = noticeList.filter(msg => {
    if (noticeCategoryFilter !== 'all' && msg.class_name !== noticeCategoryFilter) return false;
    if (noticeClassFilter !== 'all') {
      const target = msg.parsedMessage?.sendTo || msg.parsedMessage?.classGroup || '';
      if (target !== noticeClassFilter && msg.class_name !== noticeClassFilter) return false;
    }
    if (noticeSearch.trim()) {
      const q = noticeSearch.toLowerCase().trim();
      const titleMatch = (msg.title || '').toLowerCase().includes(q);
      const descMatch = (msg.parsedMessage?.desc || msg.message || '').toLowerCase().includes(q);
      const senderMatch = (msg.sender_name || '').toLowerCase().includes(q);
      if (!titleMatch && !descMatch && !senderMatch) return false;
    }
    return true;
  });

  const filteredSyllabusList = syllabusList.filter(item => {
    if (syllabusClassFilter !== 'all') {
      if (item.class_name !== `APP_SYLLABUS_${syllabusClassFilter}` && item.class_name !== syllabusClassFilter) return false;
    }
    if (syllabusSearch.trim()) {
      const q = syllabusSearch.toLowerCase().trim();
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const subMatch = (item.parsedMessage?.subjects || []).some((s: any) => 
        (s.subject || '').toLowerCase().includes(q) || (s.details || '').toLowerCase().includes(q)
      );
      if (!titleMatch && !subMatch) return false;
    }
    return true;
  });

  const filteredSuggestionList = suggestionList.filter(item => {
    if (suggestionClassFilter !== 'all') {
      if (item.class_name !== `APP_SUGGESTION_${suggestionClassFilter}` && item.class_name !== suggestionClassFilter) return false;
    }
    if (suggestionSearch.trim()) {
      const q = suggestionSearch.toLowerCase().trim();
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const subMatch = (item.parsedMessage?.subjects || []).some((s: any) => 
        (s.subject || '').toLowerCase().includes(q) || (s.details || '').toLowerCase().includes(q)
      );
      if (!titleMatch && !subMatch) return false;
    }
    return true;
  });

  // Group student messages (diaries) by date and class to avoid duplicates while preserving all subjects
  const diariesByDateClass = studentMsgs.reduce((acc: Record<string, any>, msg: any) => {
    const date = msg.parsedMessage?.date || (msg.created_at ? new Date(msg.created_at).toISOString().split('T')[0] : getTodayDateString());
    const className = msg.class_name || 'General';
    const key = `${date}_${className}`;
    
    if (!acc[key]) {
      acc[key] = { ...msg, allSubjects: [], allAttachments: [] };
    }

    // Merge subjects from this record
    const p = msg.parsedMessage;
    if (p?.version === 'v2' && p.subject) {
      if (!acc[key].allSubjects.some((s: any) => s.subject === p.subject)) {
        acc[key].allSubjects.push({ 
          subject: p.subject, 
          details: p.details || p.homework || '', 
          homework: p.homework || '',
          lesson: p.lesson || '',
          period: p.period || '',
          isV2: true, 
          originalMsg: msg 
        });
      }
    } else if (p?.subjects && Array.isArray(p.subjects) && p.subjects.length > 0) {
      p.subjects.forEach((s: any) => {
        if (s?.subject && !acc[key].allSubjects.some((as: any) => as.subject === s.subject)) {
          acc[key].allSubjects.push({ 
            subject: s.subject, 
            details: s.details || '', 
            homework: s.homework || '',
            originalMsg: msg 
          });
        }
      });
    } else {
      // Legacy message, plain text message, or message with desc/details/homework
      const subj = p?.subject || msg.title || 'সাধারণ পাঠ';
      const details = p?.details || p?.desc || (typeof msg.message === 'string' && !msg.message.startsWith('{') ? msg.message : '') || p?.homework || '';
      if (details || subj) {
        if (!acc[key].allSubjects.some((as: any) => as.subject === subj)) {
          acc[key].allSubjects.push({
            subject: subj,
            details: details,
            homework: p?.homework || '',
            originalMsg: msg
          });
        }
      }
    }

    // Collect attachments
    if (p?.attachments && Array.isArray(p.attachments)) {
      p.attachments.forEach((att: any) => {
        if (!acc[key].allAttachments.some((a: any) => a.url === att.url)) {
          acc[key].allAttachments.push(att);
        }
      });
    }

    // Collect note
    if (p?.note && !acc[key].parsedMessage?.note) {
      if (!acc[key].parsedMessage) acc[key].parsedMessage = {};
      acc[key].parsedMessage.note = p.note;
    }

    // Keep the most recent record as the "primary" for metadata (like sender_name)
    if (new Date(msg.created_at) > new Date(acc[key].created_at)) {
      acc[key] = { 
        ...msg, 
        allSubjects: acc[key].allSubjects,
        parsedMessage: {
          ...msg.parsedMessage,
          note: acc[key].parsedMessage?.note || msg.parsedMessage?.note,
          attachments: acc[key].allAttachments || msg.parsedMessage?.attachments || []
        }
      };
    }

    return acc;
  }, {});

  const diaryList: any[] = Object.values(diariesByDateClass).sort((a: any, b: any) => {
    const dateA = a.parsedMessage?.date || a.created_at;
    const dateB = b.parsedMessage?.date || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const todayStr = getTodayDateString();
  const todayDiaries: any[] = diaryList.filter((m: any) => (m.parsedMessage?.date === todayStr));
  const pastDiaries: any[] = diaryList.filter((m: any) => (m.parsedMessage?.date !== todayStr));

  // Filtered past diaries based on independent past tab filters
  const filteredPastDiaries = diaryList.filter((m: any) => {
    const mDate = m.parsedMessage?.date || (m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : '');
    
    // Class filter
    if (pastFilterClass) {
      const match = m.class_name === pastFilterClass || 
        getDisplayClassName(m.class_name) === getDisplayClassName(pastFilterClass) ||
        classes.find(c => c.class_name === pastFilterClass)?.id === m.class_name;
      if (!match) return false;
    }
    
    // Date filter
    if (pastFilterDate && mDate !== pastFilterDate) {
      return false;
    }
    
    // Search query
    if (pastSearchQuery.trim()) {
      const q = pastSearchQuery.toLowerCase();
      const cName = getDisplayClassName(m.class_name).toLowerCase();
      const subjectsMatch = (m.allSubjects || []).some((s: any) => 
        (s.subject && s.subject.toLowerCase().includes(q)) || 
        (s.details && s.details.toLowerCase().includes(q)) ||
        (s.homework && s.homework.toLowerCase().includes(q))
      );
      const noteMatch = m.parsedMessage?.note && m.parsedMessage.note.toLowerCase().includes(q);
      const titleMatch = m.title && m.title.toLowerCase().includes(q);
      if (!cName.includes(q) && !subjectsMatch && !noteMatch && !titleMatch) return false;
    }
    
    return true;
  });

  const DiaryCard = ({ msg }: { msg: any }) => {
    const subjectsList = msg.allSubjects || [];
    const attachmentsList = msg.parsedMessage?.attachments || [];
    const noteText = msg.parsedMessage?.note || '';
    const dateStr = msg.parsedMessage?.date 
      ? new Date(msg.parsedMessage.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) 
      : new Date(msg.created_at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-300 group overflow-hidden flex flex-col h-full shadow-sm">
        {/* Card Header: Class & Date */}
        <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center group-hover:bg-blue-50/30 transition-colors">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0 transform group-hover:rotate-6 transition-transform">
              <BookOpen size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-lg truncate leading-tight">
                {getDisplayClassName(msg.class_name)}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-xs">
                  <CalendarDays size={12} className="text-blue-500" />
                  {dateStr}
                </span>
                {msg.parsedMessage?.status === 'draft' && (
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-amber-200">
                    ড্রাফট
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => handleDownload(msg)} disabled={isDownloading === msg.id} className="p-2 bg-white text-slate-600 border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer" title="Download PDF">
              {isDownloading === msg.id ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
            <button onClick={() => startEdit(msg)} className="p-2 bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 transition-all cursor-pointer" title="Edit">
              <Pencil size={14} />
            </button>
          </div>
        </div>

        {/* Subjects Area */}
        <div className="p-5 flex-1 space-y-4">
          {subjectsList.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">আজকের পাঠ ও পড়া</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>
              
              {subjectsList.map((sub: any, sIdx: number) => (
                <div 
                  key={sIdx} 
                  onClick={() => startEdit(sub.originalMsg || msg)}
                  className="group/item flex flex-col p-3 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-blue-50/50 hover:border-blue-100 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-black bg-white border border-slate-200 text-blue-700 px-2.5 py-1 rounded-lg group-hover/item:bg-blue-600 group-hover/item:text-white group-hover/item:border-blue-600 transition-all shadow-xs">
                      {sub.subject || 'সাধারণ বিষয়'}
                    </span>
                    <div className="h-px bg-slate-200 flex-1 opacity-50"></div>
                  </div>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed break-words pl-1 group-hover/item:text-slate-900">
                    {sub.details || 'পড়া দেয়া হয়নি'}
                  </p>
                  
                  {/* Subtle hover indicator */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <Pencil size={12} className="text-blue-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Sparkles size={24} className="text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-bold italic">আজকের কোনো পড়া এন্ট্রি করা হয়নি</p>
            </div>
          )}

          {/* Note & Attachments */}
          <div className="flex flex-col gap-3 pt-2">
            {noteText && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-950 font-bold relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                <span className="text-[10px] uppercase tracking-tighter opacity-60 block mb-1">বিশেষ নোট:</span>
                {noteText}
              </div>
            )}

            {attachmentsList.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {attachmentsList.map((att: any, aIdx: number) => (
                  <button
                    key={aIdx}
                    type="button"
                    onClick={() => setPreviewAttachment(att)}
                    className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-blue-50/80 border border-slate-200 rounded-xl transition-all text-left overflow-hidden group/att cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                      {att.type === 'pdf' ? (
                        <FileText size={16} className="text-red-500" />
                      ) : (
                        <img src={att.url} alt={att.name} className="w-full h-full rounded-lg object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-black text-slate-700 group-hover/att:text-blue-600 truncate block">{att.name}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{att.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card Footer: Metadata */}
        <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between group-hover:bg-white transition-colors">
          <div className="flex items-center gap-2 text-slate-400 font-bold">
            <Users size={14} className="text-slate-300" />
            <span className="text-[10px] tracking-wide">শিক্ষক: <span className="text-slate-600">{msg.sender_name || 'অ্যাডমিন'}</span></span>
          </div>
          <button onClick={() => startEdit(msg)} className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
             বিস্তারিত দেখুন
             <ArrowLeft size={10} className="rotate-180" />
          </button>
        </div>
      </div>
    );
  };

  const ConfirmDialog = ({ config, onConfirm, onCancel }: { config: any, onConfirm: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${config.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
            {config.type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">{config.title}</h3>
          <p className="text-slate-500 font-bold leading-relaxed">{config.message}</p>
        </div>
        <div className="flex border-t border-slate-100 h-16">
          <button onClick={onCancel} className="flex-1 font-black text-slate-400 hover:bg-slate-50 transition-colors">ফিরে যান</button>
          <div className="w-px bg-slate-100"></div>
          <button onClick={onConfirm} className={`flex-1 font-black transition-colors ${config.type === 'danger' ? 'text-red-500 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`}>নিশ্চিত করুন</button>
        </div>
      </div>
    </div>
  );

  const AddSubjectDialog = ({ onAdd, onCancel }: { onAdd: (name: string) => void, onCancel: () => void }) => {
    const [name, setName] = useState('');
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="p-8">
            <h3 className="text-xl font-black text-slate-800 mb-6 text-center">নতুন বিষয় যোগ করুন</h3>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="বিষয়ের নাম (যেমন: বাংলা)"
              className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  e.preventDefault();
                  onAdd(name.trim());
                }
              }}
            />
          </div>
          <div className="flex border-t border-slate-100 h-16">
            <button onClick={onCancel} className="flex-1 font-black text-slate-400 hover:bg-slate-50 transition-colors">বাতিল</button>
            <div className="w-px bg-slate-100"></div>
            <button onClick={() => { if(name.trim()) onAdd(name.trim()); }} className="flex-1 font-black text-blue-600 hover:bg-blue-50 transition-colors">যোগ করুন</button>
          </div>
        </div>
      </div>
    );
  };

  const EditSubjectDialog = ({ currentName, onSave, onCancel }: { currentName: string, onSave: (name: string) => void, onCancel: () => void }) => {
    const [name, setName] = useState(currentName);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="p-8">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Pencil size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1 text-center">বিষয় এডিট / পরিবর্তন</h3>
            <p className="text-xs text-slate-400 font-bold text-center mb-6">বিষয়ের নাম পরিবর্তন করে সংরক্ষণ করুন</p>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="বিষয়ের নাম (যেমন: বাংলা)"
              className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  e.preventDefault();
                  onSave(name.trim());
                }
              }}
            />
          </div>
          <div className="flex border-t border-slate-100 h-16">
            <button onClick={onCancel} className="flex-1 font-black text-slate-400 hover:bg-slate-50 transition-colors">বাতিল</button>
            <div className="w-px bg-slate-100"></div>
            <button onClick={() => { if(name.trim()) onSave(name.trim()); }} className="flex-1 font-black text-blue-600 hover:bg-blue-50 transition-colors">সংরক্ষণ করুন</button>
          </div>
        </div>
      </div>
    );
  };

  const isEditorOpen = (activeTab === 'messages' && diarySubView === 'editor') || 
                       (activeTab === 'syllabus' && syllabusSubView === 'editor') || 
                       (activeTab === 'suggestion' && suggestionSubView === 'editor');

  if (!madrasah) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500 max-w-7xl mx-auto pb-12">
      
      {/* Header and Tabs - Hidden when writing/editing a subject diary, syllabus, or suggestion */}
      {!isEditorOpen && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 py-5 rounded-3xl text-white shadow-md">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-2xl transition-all border border-white/15 text-white shrink-0 cursor-pointer"
                  title={lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5 font-noto">
                  <MessageSquare size={24} className="shrink-0" />
                  {lang === 'bn' ? 'বার্তা ও তথ্য' : 'Messages & Updates'}
                  <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold ml-1 border border-white/20">
                    {messages.length}
                  </span>
                </h1>
                <p className="text-blue-100 font-bold mt-1 text-xs sm:text-sm opacity-90 font-noto">
                  {lang === 'bn' ? 'নোটিশ, ক্লাস রুটিন, সিলেবাস এবং অন্যান্য আপডেট' : 'Notice, class routine, syllabus and other updates'}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-1.5 rounded-2xl gap-2 shadow-xs">
            <button onClick={() => setActiveTab('messages')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'messages' ? 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900 shadow-xs' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
              <BookOpen size={18} /><span>{lang === 'bn' ? 'ডায়েরি' : 'Diary'}</span>
            </button>
            <button onClick={() => setActiveTab('notices')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'notices' ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900 shadow-xs' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
              <Bell size={18} /><span>{lang === 'bn' ? 'নোটিশ' : 'Notice'}</span>
            </button>
            <button onClick={() => setActiveTab('syllabus')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'syllabus' ? 'bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900 shadow-xs' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
               <BookOpen size={18} /><span>{lang === 'bn' ? 'সিলেবাস' : 'Syllabus'}</span>
            </button>
            <button onClick={() => setActiveTab('suggestion')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'suggestion' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900 shadow-xs' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
               <BookOpen size={18} /><span>{lang === 'bn' ? 'সাজেশন' : 'Suggestion'}</span>
            </button>
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="space-y-4 min-h-[400px]">
         
         {isLoading ? (
            <div className="py-20 text-center animate-pulse flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
                <MessageSquare className="text-blue-400" size={24} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
            </div>
         ) : (
           <>
              {/* === TAB 1: MESSAGES === */}
              {activeTab === 'messages' && (
                <div className="space-y-6 pb-20">
                  {diarySubView === 'overview' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
                      {/* 3. Navigation Tabs */}
                      <div className="grid grid-cols-2 gap-2 mb-6">
                        <button 
                          onClick={() => setDiaryTab('today')}
                          className={`py-3.5 rounded-2xl font-black text-sm transition-all shadow-sm ${diaryTab === 'today' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}
                        >
                          আজকের ডায়েরি
                        </button>
                        <button 
                          onClick={() => setDiaryTab('past')}
                          className={`py-3.5 rounded-2xl font-black text-sm transition-all shadow-sm ${diaryTab === 'past' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}
                        >
                          পুরোনো ডায়েরি
                        </button>
                      </div>

                      {/* 4. Selection Controls */}
                      {diaryTab === 'today' && (
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div>
                              <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                <Users size={12} className="text-blue-500" /> ক্লাস নির্বাচন
                              </label>
                              <div className="relative">
                                <select 
                                  value={selectedClass}
                                  onChange={(e) => setSelectedClass(e.target.value)}
                                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-blue-500 transition-all font-black text-slate-700 text-sm appearance-none cursor-pointer"
                                >
                                  <option value="">ক্লাস নির্বাচন করুন...</option>
                                  {classes.map(c => (
                                    <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                  ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                   <ChevronDown size={18} />
                                </div>
                              </div>
                            </div>

                            {/* Date Selector with DobPicker-style modal & Quick Prev/Next buttons */}
                            <div>
                              <div className="flex items-center justify-between mb-2 px-1">
                                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                  <Calendar size={13} className="text-blue-500" /> ডায়েরির তারিখ
                                </label>
                              </div>

                              {/* Date Navigation & DobPicker Trigger */}
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => adjustMsgDate(-1)}
                                  className="w-12 h-14 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-2xl flex items-center justify-center transition-all border border-slate-100 active:scale-90 shrink-0 cursor-pointer shadow-xs"
                                  title="পূর্ববর্তী দিন"
                                >
                                  <ArrowLeft size={18} />
                                </button>

                                <div className="flex-1">
                                  <DeenoraDatePicker
                                    value={msgDate}
                                    onChange={(val) => {
                                      if (val) setMsgDate(val);
                                    }}
                                    title="ডায়েরির তারিখ নির্বাচন করুন"
                                    placeholder="তারিখ নির্বাচন করুন"
                                  />
                                </div>

                                <button 
                                  type="button"
                                  onClick={() => adjustMsgDate(1)}
                                  className="w-12 h-14 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-2xl flex items-center justify-center transition-all border border-slate-100 active:scale-90 shrink-0 cursor-pointer shadow-xs"
                                  title="পরবর্তী দিন"
                                >
                                  <ArrowLeft size={18} className="rotate-180" />
                                </button>
                              </div>

                              {/* Quick Date Chips */}
                              <div className="grid grid-cols-3 gap-2 mt-2.5">
                                <button
                                  type="button"
                                  onClick={setTodayDate}
                                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    msgDate === getTodayDateString()
                                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                                  }`}
                                >
                                  আজ
                                </button>
                                <button
                                  type="button"
                                  onClick={setYesterdayDate}
                                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    msgDate === getYesterdayDateString()
                                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                                  }`}
                                >
                                  গতকাল
                                </button>
                                <button
                                  type="button"
                                  onClick={setTomorrowDate}
                                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    msgDate === getTomorrowDateString()
                                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                                  }`}
                                >
                                  আগামীকাল
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* 5. Subject List */}
                          {selectedClass ? (
                            <div className="space-y-3">
                               {/* Add Subject Action Header */}
                               <div className="flex justify-between items-center px-1 mb-2">
                                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <BookOpen size={13} className="text-blue-500" />
                                    বিষয় তালিকা ({classSubjects.length}টি)
                                  </h4>
                                  <button 
                                    type="button"
                                    onClick={() => setShowAddSubjectModal(true)}
                                    className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-full border border-blue-200/80 transition-all active:scale-95 cursor-pointer shadow-xs"
                                  >
                                    <Plus size={13} className="stroke-[3]" /> বিষয় যোগ করুন
                                  </button>
                                </div>

                               {classSubjects.map((sub, idx) => {
                                  // Check if diary exists for this subject
                                  const existing = messages.find(m => {
                                     try {
                                       const p = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                                       const classMatches = m.class_name === selectedClass || 
                                         getDisplayClassName(m.class_name) === getDisplayClassName(selectedClass) ||
                                         classes.find(c => c.class_name === selectedClass)?.id === m.class_name;
                                       const dateMatches = (p.date === msgDate) || (m.created_at && m.created_at.split('T')[0] === msgDate);
                                       const subClean = sub.trim().toLowerCase();
                                       const subjectMatches = (p.subject && p.subject.trim().toLowerCase() === subClean) ||
                                         (p.subjects && Array.isArray(p.subjects) && p.subjects.some((s: any) => s.subject && s.subject.trim().toLowerCase() === subClean));
                                       return classMatches && dateMatches && subjectMatches;
                                     } catch(e) { return false; }
                                  });

                                  return (
                                    <div 
                                      key={idx} 
                                      className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-blue-200 hover:shadow-md transition-all group/item"
                                    >
                                       {/* Subject Info Area (Clickable to write diary) */}
                                       <div 
                                         onClick={() => openDiaryEditorForSubject(sub, existing)}
                                         className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer pr-2"
                                       >
                                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 ${existing ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                             {existing ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
                                          </div>
                                          <div className="text-left min-w-0 flex-1">
                                             <h4 className="font-black text-slate-800 text-sm sm:text-base truncate group-hover/item:text-blue-600 transition-colors">
                                               {sub}
                                             </h4>
                                             <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1.5 ${existing ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                                                {existing ? (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                    ডায়েরি লেখা সম্পন্ন
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>
                                                    ডায়েরি লেখা হয়নি
                                                  </>
                                                )}
                                             </p>
                                          </div>
                                       </div>

                                       {/* Action Controls (Always Visible for Mobile Touch) */}
                                       <div className="flex items-center gap-1.5 shrink-0">
                                          {/* Edit Subject Button */}
                                          <button 
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingSubjectIndex(idx);
                                              setEditingSubjectName(sub);
                                              setShowEditSubjectModal(true);
                                            }}
                                            className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200/70 hover:border-amber-200 flex items-center justify-center transition-all shadow-xs active:scale-90 cursor-pointer"
                                            title="বিষয়ের নাম পরিবর্তন / এডিট করুন"
                                          >
                                            <Pencil size={15} />
                                          </button>

                                          {/* Delete Subject Button */}
                                          <button 
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setConfirmConfig({
                                                title: 'বিষয় মুছে ফেলুন',
                                                message: `আপনি কি "${sub}" বিষয়টি শ্রেণি তালিকা থেকে মুছে ফেলতে চান?`,
                                                type: 'danger'
                                              });
                                              setConfirmAction(() => () => {
                                                const updated = classSubjects.filter((_, i) => i !== idx);
                                                updateAndPersistSubjects(updated);
                                                setShowConfirmModal(false);
                                              });
                                              setShowConfirmModal(true);
                                            }}
                                            className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200/70 hover:border-red-200 flex items-center justify-center transition-all shadow-xs active:scale-90 cursor-pointer"
                                            title="বিষয় মুছে ফেলুন"
                                          >
                                            <Trash2 size={15} />
                                          </button>

                                          {/* Open Editor Button */}
                                          <button
                                            type="button"
                                            onClick={() => openDiaryEditorForSubject(sub, existing)}
                                            className={`h-9 px-3 rounded-xl border font-black text-xs flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer ${
                                              existing 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white' 
                                                : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white'
                                            }`}
                                          >
                                            <span>{existing ? 'এডিট' : 'লিখুন'}</span>
                                            <ArrowLeft size={12} className="rotate-180" />
                                          </button>
                                       </div>
                                    </div>
                                  );
                               })}

                               {/* Bottom Quick Add Subject */}
                               <button 
                                 type="button"
                                 onClick={() => setShowAddSubjectModal(true)}
                                 className="w-full py-4 bg-white hover:bg-blue-50/50 border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-3xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-600 font-black text-xs transition-all active:scale-98 cursor-pointer shadow-xs"
                               >
                                 <Plus size={16} /> নতুন বিষয় যোগ করুন
                               </button>
                            </div>
                          ) : (
                            <div className="py-20 text-center">
                               <div className="w-20 h-20 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white shadow-sm">
                                  <Users size={32} />
                               </div>
                               <p className="text-slate-400 font-bold text-sm">ডায়েরি লিখতে আগে ক্লাস নির্বাচন করুন</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 6. Past Diaries List (With Independent Filters so past records are always visible) */}
                      {diaryTab === 'past' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           {/* Filters for Past Diaries */}
                           <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                              <div className="flex flex-col sm:flex-row gap-3">
                                 {/* Class Filter */}
                                 <div className="flex-1 relative">
                                    <select 
                                      value={pastFilterClass}
                                      onChange={(e) => setPastFilterClass(e.target.value)}
                                      className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-slate-700 text-xs appearance-none cursor-pointer"
                                    >
                                      <option value="">সকল ক্লাস ({diaryList.length}টি ডায়েরি)</option>
                                      {classes.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                                    </select>
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                       <ChevronDown size={14} />
                                    </div>
                                 </div>

                                 {/* Date Filter with DobPicker Modal */}
                                 <div className="flex-1 min-w-[200px]">
                                   <DeenoraDatePicker
                                     value={pastFilterDate}
                                     onChange={(val) => setPastFilterDate(val)}
                                     allowClear={true}
                                     onClear={() => setPastFilterDate('')}
                                     title="পুরোনো ডায়েরির তারিখ খুঁজুন"
                                     placeholder="সকল তারিখ (বাছাই করুন)"
                                   />
                                 </div>
                              </div>

                              {/* Search Bar */}
                              <div className="relative">
                                <input 
                                  type="text"
                                  value={pastSearchQuery}
                                  onChange={(e) => setPastSearchQuery(e.target.value)}
                                  placeholder="বিষয়, বাড়ির কাজ বা পাঠ দিয়ে খুঁজুন..."
                                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700 text-xs"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                   <MessageSquare size={14} />
                                </div>
                                {pastSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setPastSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              {/* Quick Date Chips */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setPastFilterDate('')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    !pastFilterDate
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  সকল তারিখ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPastFilterDate(getTodayDateString())}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    pastFilterDate === getTodayDateString()
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  আজ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPastFilterDate(getYesterdayDateString())}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    pastFilterDate === getYesterdayDateString()
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  গতকাল
                                </button>
                              </div>

                              {/* Filter Summary & Reset Action */}
                              <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-100">
                                <span className="font-bold text-slate-500">
                                  মোট <span className="text-blue-600 font-black">{filteredPastDiaries.length}</span>টি ডায়েরি পাওয়া গেছে
                                </span>
                                {(pastFilterClass || pastFilterDate || pastSearchQuery) && (
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setPastFilterClass('');
                                      setPastFilterDate('');
                                      setPastSearchQuery('');
                                    }}
                                    className="text-[11px] font-black text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw size={11} /> ফিল্টার রিসেট
                                  </button>
                                )}
                              </div>
                           </div>

                           {/* Past Diaries Grid */}
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {filteredPastDiaries.map((msg: any) => (
                                 <DiaryCard key={msg.id} msg={msg} />
                              ))}
                           </div>

                           {filteredPastDiaries.length === 0 && (
                             <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                   <CalendarDays size={28} />
                                </div>
                                <h4 className="font-black text-slate-700 text-base mb-1">কোনো ডায়েরি পাওয়া যায়নি</h4>
                                <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                                   {pastFilterClass || pastFilterDate || pastSearchQuery
                                     ? 'নির্বাচিত ফিল্টার অনুযায়ী কোনো ডায়েরি রেকর্ড নেই।'
                                     : 'এখনও কোনো পূর্বের ডায়েরি সংরক্ষণ করা হয়নি।'}
                                </p>
                                {(pastFilterClass || pastFilterDate || pastSearchQuery) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPastFilterClass('');
                                      setPastFilterDate('');
                                      setPastSearchQuery('');
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-md shadow-blue-200 active:scale-95 transition-all cursor-pointer"
                                  >
                                    সকল ডায়েরি দেখুন
                                  </button>
                                )}
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* DIARY EDITOR VIEW */
                    <div className="animate-in slide-in-from-right-4 duration-500 pb-12">
                       {/* Editor Header */}
                       <div className="flex justify-between items-center bg-white p-4 -mx-6 -mt-6 mb-6 border-b border-slate-100 shadow-xs sticky top-0 z-50">
                          <div className="flex items-center gap-3">
                             <button 
                               onClick={() => setDiarySubView('overview')}
                               className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-transform"
                             >
                                <ArrowLeft size={20} />
                             </button>
                             <h2 className="text-lg font-black text-slate-800">ডায়েরি: {selectedSubject}</h2>
                          </div>
                          <button 
                            onClick={(e) => submitMessage(e as any, false)}
                            disabled={isSubmitting}
                            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 active:scale-90 transition-all"
                          >
                             {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                          </button>
                       </div>

                       {/* Selection Info Card */}
                       <div className="bg-blue-600 rounded-[2rem] p-5 text-white shadow-xl shadow-blue-100 mb-6 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Users size={20} />
                             </div>
                             <div>
                                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">নির্বাচিত ক্লাস</p>
                                <h3 className="text-sm font-black">{getDisplayClassName(selectedClass)}</h3>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Calendar size={20} />
                             </div>
                             <div className="text-right">
                                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">তারিখ</p>
                                <h3 className="text-sm font-black">{new Date(msgDate).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                             </div>
                          </div>
                       </div>

                       {/* Editor Form */}
                       <div className="space-y-6">
                          {/* A. Lesson Details */}
                          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                   <PenTool size={20} />
                                </div>
                                <h4 className="text-sm font-black text-slate-800">পাঠের বিবরণ</h4>
                             </div>
                             <div className="relative">
                                <textarea 
                                  value={diarySubjects[0]?.details || ''}
                                  onChange={(e) => {
                                    const newList = [{ subject: selectedSubject, details: e.target.value }];
                                    setDiarySubjects(newList);
                                  }}
                                  placeholder="আজকের ক্লাসে কী পড়ানো হয়েছে, সংক্ষেপে লিখুন..."
                                  className="w-full min-h-[150px] bg-slate-50 border border-slate-100 rounded-3xl p-5 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700 text-sm resize-none leading-relaxed"
                                />
                                <div className="absolute bottom-4 right-5 text-[10px] font-black text-slate-300">
                                   {(diarySubjects[0]?.details || '').length}/2000
                                </div>
                             </div>
                          </div>

                          {/* B. Homework */}
                          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                   <PlusCircle size={20} />
                                </div>
                                <h4 className="text-sm font-black text-slate-800">হোমওয়ার্ক / বাড়ির কাজ</h4>
                             </div>
                             <div className="relative">
                                <textarea 
                                  value={homeworkDesc}
                                  onChange={(e) => setHomeworkDesc(e.target.value)}
                                  placeholder="শিক্ষার্থীদের বাড়িতে কী করতে হবে লিখুন..."
                                  className="w-full min-h-[120px] bg-slate-50 border border-slate-100 rounded-3xl p-5 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700 text-sm resize-none leading-relaxed"
                                />
                                <div className="absolute bottom-4 right-5 text-[10px] font-black text-slate-300">
                                   {homeworkDesc.length}/500
                                </div>
                             </div>
                          </div>

                          {/* C. Attachment Section */}
                          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                   <Paperclip size={20} />
                                </div>
                                <h4 className="text-sm font-black text-slate-800">ছবি বা PDF আপলোড</h4>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-3 mb-4">
                               <label className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer group">
                                  <ImageIcon size={24} className="text-slate-400 group-hover:text-blue-500" />
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-blue-600">ছবি আপলোড</span>
                                  <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                               </label>
                               <label className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer group">
                                  <FileText size={24} className="text-slate-400 group-hover:text-red-500" />
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-red-600">PDF আপলোড</span>
                                  <input type="file" accept="application/pdf" multiple onChange={handleFileUpload} className="hidden" />
                               </label>
                             </div>

                             {diaryAttachments.length > 0 && (
                               <div className="flex flex-wrap gap-2">
                                  {diaryAttachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-100 rounded-xl border border-slate-200 max-w-full">
                                       <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                                          {att.type === 'pdf' ? <FileText size={14} className="text-red-500" /> : <ImageIcon size={14} className="text-blue-500" />}
                                       </div>
                                       <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{att.name}</span>
                                       <button 
                                          onClick={() => setDiaryAttachments(prev => prev.filter((_, i) => i !== idx))}
                                          className="p-1 bg-white rounded-full text-slate-400 hover:text-red-500 shadow-sm"
                                       >
                                          <X size={12} />
                                       </button>
                                    </div>
                                  ))}
                               </div>
                             )}
                          </div>

                          {/* D. Extra Note */}
                          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                   <Info size={20} />
                                </div>
                                <h4 className="text-sm font-black text-slate-800">অতিরিক্ত নোট (ঐচ্ছিক)</h4>
                             </div>
                             <textarea 
                               value={diaryNote}
                               onChange={(e) => setDiaryNote(e.target.value)}
                               placeholder="প্রয়োজনীয় নির্দেশনা বা অন্যান্য তথ্য লিখুন..."
                               className="w-full min-h-[100px] bg-slate-50 border border-slate-100 rounded-3xl p-5 outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-slate-700 text-sm resize-none leading-relaxed"
                             />
                          </div>

                          {/* Save Action Buttons - Directly below Extra Note field */}
                          <div className="space-y-3 pt-2">
                             <button 
                               type="button"
                               onClick={(e) => submitMessage(e as any, false)}
                               disabled={isSubmitting}
                               className="w-full h-15 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 cursor-pointer"
                             >
                                {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                ডায়েরি সংরক্ষণ করুন
                             </button>

                             <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setDiarySubView('overview')}
                                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <ArrowLeft size={16} /> বাতিল ও তালিকায় ফিরুন
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => submitMessage(e as any, true)}
                                  disabled={isSubmitting}
                                  className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  ড্রাফট হিসেবে রাখুন
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              )}

{/* === TAB 2: NOTICES === */}
              {activeTab === 'notices' && (
                <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                  {/* Notice Header Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-xs">
                        <Bell size={22} />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                          {lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'}
                          <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                            {noticeList.length}
                          </span>
                        </h2>
                        <p className="text-xs text-slate-400 font-bold">
                          {lang === 'bn' ? 'জরুরি বিজ্ঞপ্তি, ছুটির নোটিশ ও অভিভাবক সমাবেশ' : 'Important notices, holidays & PTM'}
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => { 
                        setEditingItem(null); 
                        setNoticeTitle(''); 
                        setNoticeDate(getTodayDateString()); 
                        setNoticeDesc('');
                        setNoticeType('APP_NOTICE');
                        setNoticeClass('All Classes');
                        setNoticeTarget('All Parents');
                        setShowNoticeModal(true); 
                      }} 
                      className="h-12 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Plus size={16} /> 
                      <span>{lang === 'bn' ? 'নতুন নোটিশ দিন' : 'Create Notice'}</span>
                    </button>
                  </div>

                  {/* Notice Filters & Search */}
                  <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <input 
                          type="text"
                          value={noticeSearch}
                          onChange={(e) => setNoticeSearch(e.target.value)}
                          placeholder="নোটিশের শিরোনাম বা বিবরণ দিয়ে খুঁজুন..."
                          className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 outline-none focus:bg-white focus:border-amber-500 transition-all font-bold text-slate-700 text-xs sm:text-sm"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Search size={16} />
                        </div>
                        {noticeSearch && (
                          <button
                            type="button"
                            onClick={() => setNoticeSearch('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Class Filter Dropdown */}
                      <div className="relative">
                        <select 
                          value={noticeClassFilter}
                          onChange={(e) => setNoticeClassFilter(e.target.value)}
                          className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-amber-500 transition-all font-bold text-slate-700 text-xs sm:text-sm appearance-none cursor-pointer"
                        >
                          <option value="all">সকল শ্রেণি / শ্রেণিভিত্তিক</option>
                          <option value="All Classes">সকল শ্রেণি (All Classes)</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.class_name}>{c.class_name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setNoticeCategoryFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            noticeCategoryFilter === 'all'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          সকল নোটিশ
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoticeCategoryFilter('APP_NOTICE')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            noticeCategoryFilter === 'APP_NOTICE'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          📢 সাধারণ নোটিশ
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoticeCategoryFilter('APP_HOLIDAY')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            noticeCategoryFilter === 'APP_HOLIDAY'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          🏖️ ছুটির নোটিশ
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoticeCategoryFilter('APP_PTM')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            noticeCategoryFilter === 'APP_PTM'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          👨‍👩‍👧 অভিভাবক সমাবেশ
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-400">
                          মোট <span className="text-amber-600 font-black">{filteredNotices.length}</span>টি
                        </span>
                        {(noticeSearch || noticeCategoryFilter !== 'all' || noticeClassFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setNoticeSearch('');
                              setNoticeCategoryFilter('all');
                              setNoticeClassFilter('all');
                            }}
                            className="text-[11px] font-black text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw size={11} /> রিসেট
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notice List Cards */}
                  {filteredNotices.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredNotices.map((msg) => {
                        const noticeDateVal = msg.parsedMessage?.date || msg.created_at;
                        const dateObj = new Date(noticeDateVal);
                        const isHoliday = msg.class_name === 'APP_HOLIDAY';
                        const isPtm = msg.class_name === 'APP_PTM';
                        const categoryName = isHoliday ? 'ছুটির নোটিশ' : isPtm ? 'অভিভাবক সমাবেশ' : 'সাধারণ নোটিশ';
                        const categoryColor = isHoliday 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : isPtm 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200';

                        return (
                          <div 
                            key={msg.id} 
                            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col justify-between group relative"
                          >
                            <div>
                              {/* Top Bar: Date badge, category, status & action buttons */}
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  {/* Date Badge */}
                                  <div className={`w-13 h-13 rounded-2xl shrink-0 flex flex-col items-center justify-center border shadow-2xs ${categoryColor}`}>
                                    <span className="text-[10px] font-black uppercase tracking-tight leading-none opacity-70">
                                      {dateObj.toLocaleDateString('bn-BD', { month: 'short' })}
                                    </span>
                                    <span className="text-xl font-black leading-none mt-1">
                                      {dateObj.toLocaleDateString('bn-BD', { day: 'numeric' })}
                                    </span>
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${categoryColor}`}>
                                        {categoryName}
                                      </span>
                                      {msg.parsedMessage?.status === 'draft' && (
                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-200">
                                          ড্রাফট
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="font-black text-slate-800 text-base leading-snug line-clamp-1 group-hover:text-amber-700 transition-colors">
                                      {msg.title}
                                    </h3>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    type="button"
                                    onClick={() => handleDownload(msg)} 
                                    disabled={isDownloading === msg.id} 
                                    className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50" 
                                    title="পিডিএফ ডাউনলোড"
                                  >
                                    {isDownloading === msg.id ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => startEdit(msg)} 
                                    className="p-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer" 
                                    title="এডিট করুন"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDelete(msg.id)} 
                                    className="p-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer" 
                                    title="ডিলিট করুন"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Notice Description */}
                              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium mb-4 line-clamp-4 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                                {msg.parsedMessage?.desc || msg.message}
                              </p>
                            </div>

                            {/* Footer Information */}
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-100">
                              <span className="flex items-center gap-1.5 text-blue-600">
                                <Users size={13} /> {msg.parsedMessage?.sendTo || msg.parsedMessage?.classGroup || 'সকল শিক্ষার্থী ও অভিভাবক'}
                              </span>
                              <span>পোস্ট করেছেন: {msg.sender_name || 'মাদরাসা কর্তৃপক্ষ'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell size={28} />
                      </div>
                      <h4 className="font-black text-slate-700 text-base mb-1">কোনো নোটিশ পাওয়া যায়নি</h4>
                      <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                        {noticeSearch || noticeCategoryFilter !== 'all' || noticeClassFilter !== 'all'
                          ? 'নির্বাচিত ফিল্টার অনুযায়ী কোনো নোটিশ নেই।'
                          : 'প্রতিষ্ঠান সম্পর্কিত সকল জরুরি নোটিশ এখানে যুক্ত করুন।'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(null); 
                          setNoticeTitle(''); 
                          setNoticeDate(getTodayDateString()); 
                          setNoticeDesc('');
                          setNoticeType('APP_NOTICE');
                          setNoticeClass('All Classes');
                          setNoticeTarget('All Parents');
                          setShowNoticeModal(true);
                        }}
                        className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-200 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus size={14} /> নতুন নোটিশ দিন
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === TAB 3: SYLLABUS === */}
              {activeTab === 'syllabus' && (
                <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                  {syllabusSubView === 'editor' ? (
                    /* Dedicated Subject Syllabus Editor (Header and Tabs are hidden) */
                    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-md space-y-6 animate-in zoom-in-95 duration-200">
                      {/* Top Bar with Back Button */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSyllabusSubView('overview')}
                          className="inline-flex items-center gap-2 text-xs font-black text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2.5 rounded-2xl border border-purple-200 transition-all active:scale-95 cursor-pointer w-fit"
                        >
                          <ArrowLeft size={16} /> বিষয় তালিকায় ফিরুন
                        </button>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black px-3 py-1 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
                            ক্লাস: {syllabusClass || selectedClass}
                          </span>
                          <span className="text-xs font-black px-3.5 py-1 bg-purple-600 text-white rounded-xl shadow-xs">
                            বিষয়: {syllabusSelectedSubject}
                          </span>
                        </div>
                      </div>

                      {/* Header Title */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 shadow-2xs">
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-black text-slate-800">
                            {syllabusSelectedSubject} — সিলেবাস রচনা
                          </h3>
                          <p className="text-xs text-slate-400 font-bold">
                            {syllabusClass || selectedClass} শ্রেণির শিক্ষার্থীদের জন্য পাঠ পরিকল্পনা ও সিলেবাস দিন
                          </p>
                        </div>
                      </div>

                      {/* Controls Row: Exam & Session */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                            পরীক্ষা / টার্ম নির্বাচন
                          </label>
                          <div className="relative">
                            <select
                              value={syllabusExam || '১ম সাময়িক পরীক্ষা'}
                              onChange={(e) => setSyllabusExam(e.target.value)}
                              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-purple-500 font-bold text-slate-700 text-xs sm:text-sm appearance-none cursor-pointer"
                            >
                              <option value="১ম সাময়িক পরীক্ষা">১ম সাময়িক পরীক্ষা</option>
                              <option value="২য় সাময়িক পরীক্ষা">২য় সাময়িক পরীক্ষা</option>
                              <option value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</option>
                              <option value="অর্ধবার্ষিক পরীক্ষা">অর্ধবার্ষিক পরীক্ষা</option>
                              <option value="প্রাক-নির্বাচনী পরীক্ষা">প্রাক-নির্বাচনী পরীক্ষা</option>
                              <option value="টেস্ট পরীক্ষা">টেস্ট পরীক্ষা</option>
                              <option value="মাসিক মূল্যায়ন">মাসিক মূল্যায়ন</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown size={16} />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                            শিক্ষাবর্ষ / সেশন
                          </label>
                          <input
                            type="text"
                            value={syllabusSession}
                            onChange={(e) => setSyllabusSession(e.target.value)}
                            placeholder="যেমন: ২০২৫-২৬"
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-purple-500 font-bold text-slate-700 text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      {/* Syllabus Details Textarea */}
                      <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                          সিলেবাসের বিস্তারিত পড়া ও অধ্যায় <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={6}
                          value={syllabusSubjectDetails}
                          onChange={(e) => setSyllabusSubjectDetails(e.target.value)}
                          placeholder="এই বিষয়ের জন্য সিলেবাসের বিস্তারিত পড়া, অধ্যায়সমূহ, পৃষ্ঠা নম্বর এবং পাঠ পরিকল্পনা লিখুন..."
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-purple-500 font-bold text-sm text-slate-800 transition-all resize-y"
                        />
                      </div>

                      {/* Optional Note / Guidelines */}
                      <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                          অতিরিক্ত নির্দেশনা বা পাঠ্যপুস্তকের তথ্য (ঐচ্ছিক)
                        </label>
                        <textarea
                          rows={3}
                          value={syllabusSubjectNote}
                          onChange={(e) => setSyllabusSubjectNote(e.target.value)}
                          placeholder="শিক্ষার্থীদের জন্য জরুরি নির্দেশনা, মান বণ্টন বা পাঠ্যপুস্তকের নাম (ঐচ্ছিক)..."
                          className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-purple-500 font-medium text-xs text-slate-700 transition-all"
                        />
                      </div>

                      {/* Save Button Bar right below the optional note */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => submitSubjectSyllabus(false)}
                          disabled={isSubmitting}
                          className="w-full sm:flex-1 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Save size={18} /> {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সিলেবাস সংরক্ষণ করুন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSyllabusSubView('overview')}
                          className="w-full sm:w-auto px-6 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm active:scale-95 transition-all cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Syllabus Overview Mode */
                    <div className="space-y-4">
                      {/* Sub-Navigation Tabs: বিষয়ভিত্তিক সিলেবাস | সকল সিলেবাস */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                          type="button"
                          onClick={() => setSyllabusTab('subjects')}
                          className={`py-3.5 rounded-2xl font-black text-sm transition-all shadow-sm cursor-pointer ${syllabusTab === 'subjects' ? 'bg-purple-600 text-white shadow-purple-200' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                        >
                          বিষয়ভিত্তিক সিলেবাস
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSyllabusTab('all')}
                          className={`py-3.5 rounded-2xl font-black text-sm transition-all shadow-sm cursor-pointer ${syllabusTab === 'all' ? 'bg-purple-600 text-white shadow-purple-200' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                        >
                          সকল সিলেবাস তালিকা ({syllabusList.length})
                        </button>
                      </div>

                      {syllabusTab === 'subjects' ? (
                        /* Subjects List View (like Diary) */
                        <div className="space-y-4 animate-in fade-in duration-300">
                          {/* Class & Exam Selectors Card */}
                          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Class Select */}
                              <div>
                                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                  <Users size={12} className="text-purple-500" /> ক্লাস নির্বাচন
                                </label>
                                <div className="relative">
                                  <select 
                                    value={syllabusClass || selectedClass}
                                    onChange={(e) => {
                                      setSyllabusClass(e.target.value);
                                      fetchClassSubjects(e.target.value);
                                    }}
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-purple-500 transition-all font-black text-slate-700 text-sm appearance-none cursor-pointer"
                                  >
                                    <option value="">ক্লাস নির্বাচন করুন...</option>
                                    {classes.map(c => (
                                      <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                    ))}
                                  </select>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={18} />
                                  </div>
                                </div>
                              </div>

                              {/* Exam Select */}
                              <div>
                                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                  <BookOpen size={12} className="text-purple-500" /> পরীক্ষা / টার্ম নির্বাচন
                                </label>
                                <div className="relative">
                                  <select 
                                    value={syllabusExam || '১ম সাময়িক পরীক্ষা'}
                                    onChange={(e) => setSyllabusExam(e.target.value)}
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-purple-500 transition-all font-black text-slate-700 text-sm appearance-none cursor-pointer"
                                  >
                                    <option value="১ম সাময়িক পরীক্ষা">১ম সাময়িক পরীক্ষা</option>
                                    <option value="২য় সাময়িক পরীক্ষা">২য় সাময়িক পরীক্ষা</option>
                                    <option value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</option>
                                    <option value="অর্ধবার্ষিক পরীক্ষা">অর্ধবার্ষিক পরীক্ষা</option>
                                    <option value="প্রাক-নির্বাচনী পরীক্ষা">প্রাক-নির্বাচনী পরীক্ষা</option>
                                    <option value="টেস্ট পরীক্ষা">টেস্ট পরীক্ষা</option>
                                    <option value="মাসিক মূল্যায়ন">মাসিক মূল্যায়ন</option>
                                  </select>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={18} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Subjects Header */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center px-1 mb-2">
                              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <BookOpen size={13} className="text-purple-500" />
                                বিষয় তালিকা ({classSubjects.length}টি)
                              </h4>
                              <button 
                                type="button"
                                onClick={() => setShowAddSubjectModal(true)}
                                className="flex items-center gap-1.5 text-xs font-black text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3.5 py-1.5 rounded-full border border-purple-200/80 transition-all active:scale-95 cursor-pointer shadow-xs"
                              >
                                <Plus size={13} className="stroke-[3]" /> বিষয় যোগ করুন
                              </button>
                            </div>

                            {/* Subject Cards */}
                            {classSubjects.map((sub, idx) => {
                              const currentCls = syllabusClass || selectedClass;
                              const effectiveExam = syllabusExam || '১ম সাময়িক পরীক্ষা';
                              const existingSyllabusMsg = syllabusList.find(m => {
                                const rawClass = m.class_name.replace('APP_SYLLABUS_', '');
                                const p = m.parsedMessage || {};
                                return (rawClass === currentCls || getDisplayClassName(rawClass) === getDisplayClassName(currentCls)) &&
                                       (p.exam || '') === effectiveExam;
                              });

                              const subClean = sub.trim().toLowerCase();
                              const existingSub = existingSyllabusMsg?.parsedMessage?.subjects?.find((s: any) => 
                                s.subject?.trim().toLowerCase() === subClean
                              );
                              const hasSyllabus = Boolean(existingSub && existingSub.details?.trim());

                              return (
                                <div 
                                  key={idx} 
                                  className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-purple-200 hover:shadow-md transition-all group/item"
                                >
                                  {/* Subject Info Area (Clickable to write syllabus) */}
                                  <div 
                                    onClick={() => openSyllabusEditorForSubject(sub, existingSyllabusMsg)}
                                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer pr-2"
                                  >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 ${hasSyllabus ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                                      {hasSyllabus ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
                                    </div>
                                    <div className="text-left min-w-0 flex-1">
                                      <h4 className="font-black text-slate-800 text-sm sm:text-base truncate group-hover/item:text-purple-600 transition-colors">
                                        {sub}
                                      </h4>
                                      <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1.5 ${hasSyllabus ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                                        {hasSyllabus ? (
                                          <>
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                            সিলেবাস লেখা সম্পন্ন
                                          </>
                                        ) : (
                                          <>
                                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>
                                            সিলেবাস লেখা হয়নি
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSubjectIndex(idx);
                                        setEditingSubjectName(sub);
                                        setShowEditSubjectModal(true);
                                      }}
                                      className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-600 border border-slate-200/70 hover:border-purple-200 flex items-center justify-center transition-all shadow-xs active:scale-90 cursor-pointer"
                                      title="বিষয়ের নাম পরিবর্তন"
                                    >
                                      <Pencil size={15} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openSyllabusEditorForSubject(sub, existingSyllabusMsg)}
                                      className={`h-9 px-3 rounded-xl border font-black text-xs flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer ${
                                        hasSyllabus 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white' 
                                          : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white'
                                      }`}
                                    >
                                      <Pencil size={12} />
                                      {hasSyllabus ? 'সিলেবাস এডিট' : 'সিলেবাস লিখুন'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* All Saved Syllabi List */
                        <div className="space-y-4 animate-in fade-in duration-300">
                          {/* Search & Filter */}
                          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="relative">
                                <input 
                                  type="text"
                                  value={syllabusSearch}
                                  onChange={(e) => setSyllabusSearch(e.target.value)}
                                  placeholder="সিলেবাস বা বিষয় দিয়ে খুঁজুন..."
                                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 outline-none focus:bg-white focus:border-purple-500 transition-all font-bold text-slate-700 text-xs sm:text-sm"
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                  <Search size={16} />
                                </div>
                                {syllabusSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setSyllabusSearch('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>

                              <div className="relative">
                                <select 
                                  value={syllabusClassFilter}
                                  onChange={(e) => setSyllabusClassFilter(e.target.value)}
                                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-purple-500 transition-all font-bold text-slate-700 text-xs sm:text-sm appearance-none cursor-pointer"
                                >
                                  <option value="all">সকল শ্রেণি ({syllabusList.length}টি সিলেবাস)</option>
                                  {classes.map(c => (
                                    <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                  ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                  <ChevronDown size={16} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Existing Syllabus Cards Grid */}
                          {filteredSyllabusList.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {filteredSyllabusList.map((item) => {
                                const rawClassName = item.class_name.replace('APP_SYLLABUS_', '');
                                const subjects = item.parsedMessage?.subjects || [];
                                return (
                                  <div 
                                    key={item.id} 
                                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex flex-col justify-between group"
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 shadow-2xs">
                                            <BookOpen size={20} />
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                                {rawClassName}
                                              </span>
                                              {item.parsedMessage?.session && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                  সেশন: {item.parsedMessage.session}
                                                </span>
                                              )}
                                            </div>
                                            <h3 className="font-black text-slate-800 text-base group-hover:text-purple-700 transition-colors">
                                              {item.title}
                                            </h3>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button 
                                            type="button"
                                            onClick={() => handleDownload(item)} 
                                            disabled={isDownloading === item.id} 
                                            className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50" 
                                            title="পিডিএফ ডাউনলোড"
                                          >
                                            {isDownloading === item.id ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => handleDelete(item.id)} 
                                            className="p-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer" 
                                            title="ডিলিট করুন"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 space-y-2 mb-3">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                          বিষয় ও বিবরণ ({subjects.length}টি বিষয়):
                                        </span>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                          {subjects.map((s: any, sIdx: number) => (
                                            <div key={sIdx} className="bg-white p-2.5 rounded-xl border border-slate-100 text-xs">
                                              <span className="font-black text-purple-900 block">{s.subject}</span>
                                              <span className="text-slate-600 font-medium text-[11px] leading-relaxed block mt-0.5">
                                                {s.details || 'কোনো বিবরণ নেই'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                                      <span>পরীক্ষা: {item.parsedMessage?.exam || 'সাধারণ পাঠ্যক্রম'}</span>
                                      <span>পোস্ট করেছেন: {item.sender_name || 'শিক্ষক'}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
                              <BookOpen size={28} className="text-purple-400 mx-auto mb-3" />
                              <h4 className="font-black text-slate-700 text-base mb-1">কোনো সিলেবাস পাওয়া যায়নি</h4>
                              <p className="text-xs text-slate-400">বিষয়ভিত্তিক সিলেবাস ট্যাব থেকে সহজেই বিষয় নির্বাচন করে সিলেবাস লিখুন।</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
           
              {/* === TAB 4: SUGGESTION === */}
              {activeTab === 'suggestion' && (
                <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                  {suggestionSubView === 'editor' ? (
                    /* Dedicated Subject Suggestion Editor (Header and Tabs are hidden) */
                    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-md space-y-6 animate-in zoom-in-95 duration-200">
                      {/* Top Bar with Back Button */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSuggestionSubView('overview')}
                          className="inline-flex items-center gap-2 text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-2xl border border-emerald-200 transition-all active:scale-95 cursor-pointer w-fit"
                        >
                          <ArrowLeft size={16} /> বিষয় তালিকায় ফিরুন
                        </button>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                            ক্লাস: {suggestionClass || selectedClass}
                          </span>
                          <span className="text-xs font-black px-3.5 py-1 bg-emerald-600 text-white rounded-xl shadow-xs">
                            বিষয়: {suggestionSelectedSubject}
                          </span>
                        </div>
                      </div>

                      {/* Header Title */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                          <Sparkles size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-black text-slate-800">
                            {suggestionSelectedSubject} — পরীক্ষার সাজেশন রচনা
                          </h3>
                          <p className="text-xs text-slate-400 font-bold">
                            {suggestionClass || selectedClass} শ্রেণির শিক্ষার্থীদের জন্য গুরুত্বপূর্ণ প্রশ্ন ও সাজেশন দিন
                          </p>
                        </div>
                      </div>

                      {/* Controls Row: Exam & Session */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                            পরীক্ষা / টার্ম নির্বাচন
                          </label>
                          <div className="relative">
                            <select
                              value={suggestionExam || '১ম সাময়িক পরীক্ষা'}
                              onChange={(e) => setSuggestionExam(e.target.value)}
                              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-emerald-500 font-bold text-slate-700 text-xs sm:text-sm appearance-none cursor-pointer"
                            >
                              <option value="১ম সাময়িক পরীক্ষা">১ম সাময়িক পরীক্ষা</option>
                              <option value="২য় সাময়িক পরীক্ষা">২য় সাময়িক পরীক্ষা</option>
                              <option value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</option>
                              <option value="অর্ধবার্ষিক পরীক্ষা">অর্ধবার্ষিক পরীক্ষা</option>
                              <option value="প্রাক-নির্বাচনী পরীক্ষা">প্রাক-নির্বাচনী পরীক্ষা</option>
                              <option value="টেস্ট পরীক্ষা">টেস্ট পরীক্ষা</option>
                              <option value="মাসিক মূল্যায়ন">মাসিক মূল্যায়ন</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown size={16} />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                            শিক্ষাবর্ষ / সেশন
                          </label>
                          <input
                            type="text"
                            value={suggestionSession || '২০২৫-২৬'}
                            onChange={(e) => setSuggestionSession(e.target.value)}
                            placeholder="যেমন: ২০২৫-২৬"
                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-emerald-500 font-bold text-slate-700 text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      {/* Suggestion Details Textarea */}
                      <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                          সাজেশনের বিস্তারিত প্রশ্ন ও বিষয়বস্তু <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={6}
                          value={suggestionSubjectDetails}
                          onChange={(e) => setSuggestionSubjectDetails(e.target.value)}
                          placeholder="এই বিষয়ের পরীক্ষার জন্য গুরুত্বপূর্ণ প্রশ্নাবলি, মান বণ্টন ও অধ্যায়ভিত্তিক সাজেশন লিখুন..."
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-emerald-500 font-bold text-sm text-slate-800 transition-all resize-y"
                        />
                      </div>

                      {/* Optional Note / Guidelines */}
                      <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                          অতিরিক্ত নির্দেশনা বা পরামর্শ (ঐচ্ছিক)
                        </label>
                        <textarea
                          rows={3}
                          value={suggestionSubjectNote}
                          onChange={(e) => setSuggestionSubjectNote(e.target.value)}
                          placeholder="শিক্ষার্থীদের জন্য বিশেষ পরামর্শ বা সতর্কবার্তা (ঐচ্ছিক)..."
                          className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-emerald-500 font-medium text-xs text-slate-700 transition-all"
                        />
                      </div>

                      {/* Save Button Bar right below the optional note */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => submitSubjectSuggestion(false)}
                          disabled={isSubmitting}
                          className="w-full sm:flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Save size={18} /> {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সাজেশন সংরক্ষণ করুন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestionSubView('overview')}
                          className="w-full sm:w-auto px-6 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm active:scale-95 transition-all cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Suggestion Overview Mode */
                    <div className="space-y-4">
                      {/* Sub-Navigation Tabs: বিষয়ভিত্তিক সাজেশন | সকল সাজেশন */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                          type="button"
                          onClick={() => setSuggestionTab('subjects')}
                          className={`py-3.5 rounded-2xl font-black text-sm transition-all shadow-sm cursor-pointer ${suggestionTab === 'subjects' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                        >
                          বিষয়ভিত্তিক সাজেশন
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSuggestionTab('all')}
                          className={`py-3.5 rounded-2xl font-black text-sm transition-all shadow-sm cursor-pointer ${suggestionTab === 'all' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                        >
                          সকল সাজেশন তালিকা ({suggestionList.length})
                        </button>
                      </div>

                      {suggestionTab === 'subjects' ? (
                        /* Subjects List View (like Diary) */
                        <div className="space-y-4 animate-in fade-in duration-300">
                          {/* Class & Exam Selectors Card */}
                          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Class Select */}
                              <div>
                                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                  <Users size={12} className="text-emerald-500" /> ক্লাস নির্বাচন
                                </label>
                                <div className="relative">
                                  <select 
                                    value={suggestionClass || selectedClass}
                                    onChange={(e) => {
                                      setSuggestionClass(e.target.value);
                                      fetchClassSubjects(e.target.value);
                                    }}
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-emerald-500 transition-all font-black text-slate-700 text-sm appearance-none cursor-pointer"
                                  >
                                    <option value="">ক্লাস নির্বাচন করুন...</option>
                                    {classes.map(c => (
                                      <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                    ))}
                                  </select>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={18} />
                                  </div>
                                </div>
                              </div>

                              {/* Exam Select */}
                              <div>
                                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                  <Sparkles size={12} className="text-emerald-500" /> পরীক্ষা / টার্ম নির্বাচন
                                </label>
                                <div className="relative">
                                  <select 
                                    value={suggestionExam || '১ম সাময়িক পরীক্ষা'}
                                    onChange={(e) => setSuggestionExam(e.target.value)}
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-emerald-500 transition-all font-black text-slate-700 text-sm appearance-none cursor-pointer"
                                  >
                                    <option value="১ম সাময়িক পরীক্ষা">১ম সাময়িক পরীক্ষা</option>
                                    <option value="২য় সাময়িক পরীক্ষা">২য় সাময়িক পরীক্ষা</option>
                                    <option value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</option>
                                    <option value="অর্ধবার্ষিক পরীক্ষা">অর্ধবার্ষিক পরীক্ষা</option>
                                    <option value="প্রাক-নির্বাচনী পরীক্ষা">প্রাক-নির্বাচনী পরীক্ষা</option>
                                    <option value="টেস্ট পরীক্ষা">টেস্ট পরীক্ষা</option>
                                    <option value="মাসিক মূল্যায়ন">মাসিক মূল্যায়ন</option>
                                  </select>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={18} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Subjects Header */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center px-1 mb-2">
                              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={13} className="text-emerald-500" />
                                বিষয় তালিকা ({classSubjects.length}টি)
                              </h4>
                              <button 
                                type="button"
                                onClick={() => setShowAddSubjectModal(true)}
                                className="flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200/80 transition-all active:scale-95 cursor-pointer shadow-xs"
                              >
                                <Plus size={13} className="stroke-[3]" /> বিষয় যোগ করুন
                              </button>
                            </div>

                            {/* Subject Cards */}
                            {classSubjects.map((sub, idx) => {
                              const currentCls = suggestionClass || selectedClass;
                              const effectiveExam = suggestionExam || '১ম সাময়িক পরীক্ষা';
                              const existingSuggestionMsg = suggestionList.find(m => {
                                const rawClass = m.class_name.replace('APP_SUGGESTION_', '');
                                const p = m.parsedMessage || {};
                                return (rawClass === currentCls || getDisplayClassName(rawClass) === getDisplayClassName(currentCls)) &&
                                       (p.exam || '') === effectiveExam;
                              });

                              const subClean = sub.trim().toLowerCase();
                              const existingSub = existingSuggestionMsg?.parsedMessage?.subjects?.find((s: any) => 
                                s.subject?.trim().toLowerCase() === subClean
                              );
                              const hasSuggestion = Boolean(existingSub && existingSub.details?.trim());

                              return (
                                <div 
                                  key={idx} 
                                  className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-emerald-200 hover:shadow-md transition-all group/item"
                                >
                                  {/* Subject Info Area (Clickable to write suggestion) */}
                                  <div 
                                    onClick={() => openSuggestionEditorForSubject(sub, existingSuggestionMsg)}
                                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer pr-2"
                                  >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 ${hasSuggestion ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                      {hasSuggestion ? <CheckCircle2 size={24} /> : <Sparkles size={24} className="text-emerald-500" />}
                                    </div>
                                    <div className="text-left min-w-0 flex-1">
                                      <h4 className="font-black text-slate-800 text-sm sm:text-base truncate group-hover/item:text-emerald-600 transition-colors">
                                        {sub}
                                      </h4>
                                      <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1.5 ${hasSuggestion ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                                        {hasSuggestion ? (
                                          <>
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                            সাজেশন লেখা সম্পন্ন
                                          </>
                                        ) : (
                                          <>
                                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>
                                            সাজেশন লেখা হয়নি
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSubjectIndex(idx);
                                        setEditingSubjectName(sub);
                                        setShowEditSubjectModal(true);
                                      }}
                                      className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-200/70 hover:border-emerald-200 flex items-center justify-center transition-all shadow-xs active:scale-90 cursor-pointer"
                                      title="বিষয়ের নাম পরিবর্তন"
                                    >
                                      <Pencil size={15} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openSuggestionEditorForSubject(sub, existingSuggestionMsg)}
                                      className={`h-9 px-3 rounded-xl border font-black text-xs flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer ${
                                        hasSuggestion 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white' 
                                          : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white'
                                      }`}
                                    >
                                      <Pencil size={12} />
                                      {hasSuggestion ? 'সাজেশন এডিট' : 'সাজেশন লিখুন'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* All Saved Suggestions List */
                        <div className="space-y-4 animate-in fade-in duration-300">
                          {/* Suggestion Filters */}
                          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Search */}
                              <div className="relative">
                                <input 
                                  type="text"
                                  value={suggestionSearch}
                                  onChange={(e) => setSuggestionSearch(e.target.value)}
                                  placeholder="সাজেশন বা বিষয় দিয়ে খুঁজুন..."
                                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 outline-none focus:bg-white focus:border-emerald-500 transition-all font-bold text-slate-700 text-xs sm:text-sm"
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                  <Search size={16} />
                                </div>
                                {suggestionSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setSuggestionSearch('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>

                              {/* Class Filter */}
                              <div className="relative">
                                <select 
                                  value={suggestionClassFilter}
                                  onChange={(e) => setSuggestionClassFilter(e.target.value)}
                                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 outline-none focus:bg-white focus:border-emerald-500 transition-all font-bold text-slate-700 text-xs sm:text-sm appearance-none cursor-pointer"
                                >
                                  <option value="all">সকল শ্রেণি ({suggestionList.length}টি সাজেশন)</option>
                                  {classes.map(c => (
                                    <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                  ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                  <ChevronDown size={16} />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                              <span className="font-bold text-slate-400">
                                মোট <span className="text-emerald-600 font-black">{filteredSuggestionList.length}</span>টি সাজেশন পাওয়া গেছে
                              </span>
                              {(suggestionSearch || suggestionClassFilter !== 'all') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSuggestionSearch('');
                                    setSuggestionClassFilter('all');
                                  }}
                                  className="text-[11px] font-black text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw size={11} /> ফিল্টার রিসেট
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Suggestion Cards */}
                          {filteredSuggestionList.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {filteredSuggestionList.map((item) => {
                                const rawClassName = item.class_name.replace('APP_SUGGESTION_', '');
                                const subjects = item.parsedMessage?.subjects || [];
                                return (
                                  <div 
                                    key={item.id} 
                                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between group"
                                  >
                                    <div>
                                      {/* Header */}
                                      <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                                            <Sparkles size={20} />
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {rawClassName}
                                              </span>
                                              {item.parsedMessage?.exam && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                  {item.parsedMessage.exam}
                                                </span>
                                              )}
                                              {item.parsedMessage?.status === 'draft' && (
                                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                  ড্রাফট
                                                </span>
                                              )}
                                            </div>
                                            <h3 className="font-black text-slate-800 text-base group-hover:text-emerald-700 transition-colors">
                                              {item.title}
                                            </h3>
                                          </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button 
                                            type="button"
                                            onClick={() => handleDownload(item)} 
                                            disabled={isDownloading === item.id} 
                                            className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50" 
                                            title="পিডিএফ ডাউনলোড"
                                          >
                                            {isDownloading === item.id ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => startEdit(item)} 
                                            className="p-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer" 
                                            title="এডিট করুন"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => handleDelete(item.id)} 
                                            className="p-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-xs transition-all cursor-pointer" 
                                            title="ডিলিট করুন"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Subjects List */}
                                      <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 space-y-2 mb-3">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                          বিষয় ও সাজেশন ({subjects.length}টি বিষয়):
                                        </span>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                          {subjects.map((s: any, idx: number) => (
                                            <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-100 text-xs">
                                              <span className="font-black text-emerald-900 block">{s.subject}</span>
                                              <span className="text-slate-600 font-medium text-[11px] leading-relaxed block mt-0.5">
                                                {s.details || 'কোনো বিবরণ নেই'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                                      <span>সেশন: {item.parsedMessage?.session || '২০২৫-২৬'}</span>
                                      <span>পোস্ট করেছেন: {item.sender_name || 'শিক্ষক'}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
                              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Sparkles size={28} />
                              </div>
                              <h4 className="font-black text-slate-700 text-base mb-1">কোনো সাজেশন পাওয়া যায়নি</h4>
                              <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                                বিষয়ভিত্তিক সাজেশন ট্যাব থেকে সহজেই বিষয় নির্বাচন করে সাজেশন লিখুন।
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(null); 
                                  setSuggestionTitle('');
                                  setSuggestionClass(classes.length > 0 ? classes[0].class_name : '');
                                  setSuggestionExam('');
                                  setSuggestionSession('2025-26');
                                  setSuggestionSubjectList([{ subject: 'বাংলা', details: '' }]);
                                  setShowSuggestionModal(true);
                                }}
                                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Plus size={14} /> নতুন সাজেশন যোগ করুন
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

           </>
         )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. Message Modal (Diary) */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[300] overflow-y-auto">
          <div className="min-h-screen px-3 md:px-6 pt-6 pb-28 md:py-8 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600"></div>

              <div className="p-5 md:p-7 space-y-5">
                {/* Header Section */}
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-2xs shrink-0">
                        <BookOpen size={22} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">ডায়েরি লিখুন</h3>
                        <p className="text-slate-400 text-xs font-semibold">আজকের ক্লাসের পড়া ও বাড়ির কাজ সহজে দিন</p>
                     </div>
                  </div>
                  <button onClick={() => setShowMsgModal(false)} className="px-3.5 h-9 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer">
                     ✕ বন্ধ করুন
                  </button>
                </div>

                {/* Quick Shortcuts Bar */}
                <div className="bg-blue-50/70 border border-blue-100/80 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <span className="font-extrabold text-blue-900 flex items-center gap-1 shrink-0">
                    <Sparkles size={14} className="text-blue-600" /> দ্রুত বাটন:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={setTodayDate}
                      className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200/70 rounded-lg font-bold transition-all shadow-2xs text-[11px]"
                    >
                      📅 আজকে
                    </button>
                    <button
                      type="button"
                      onClick={setTomorrowDate}
                      className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200/70 rounded-lg font-bold transition-all shadow-2xs text-[11px]"
                    >
                      📅 আগামীকাল
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoTitle}
                      className="px-2 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200/70 rounded-lg font-bold transition-all shadow-2xs text-[11px]"
                    >
                      ✨ অটো টাইটেল
                    </button>
                    <button
                      type="button"
                      onClick={loadDefaultClassSubjects}
                      className="px-2 py-1 bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200/70 rounded-lg font-bold transition-all shadow-2xs text-[11px]"
                    >
                      📚 ডিফল্ট বিষয়
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyYesterdayDiary}
                      className="px-2 py-1 bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200/70 rounded-lg font-bold transition-all shadow-2xs text-[11px] flex items-center gap-1"
                    >
                      <Copy size={11} /> গতকালের ডায়েরি
                    </button>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={(e) => submitMessage(e, false)}>
                  {/* Top Inputs: Class, Date & Title */}
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">শ্রেণী (Class) <span className="text-red-500">*</span></label>
                        <select 
                          required 
                          value={selectedClass} 
                          onChange={e => {
                            setSelectedClass(e.target.value);
                            if (!title) {
                              setTimeout(handleAutoTitle, 100);
                            }
                          }} 
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-700 text-sm"
                        >
                          <option value="">শ্রেণী নির্বাচন করুন...</option>
                          {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">তারিখ <span className="text-red-500">*</span></label>
                        <input 
                          required 
                          type="date" 
                          value={msgDate} 
                          onChange={e => {
                            setMsgDate(e.target.value);
                            setTimeout(handleAutoTitle, 100);
                          }} 
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-700 text-sm cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">ডায়েরির শিরোনাম <span className="text-red-500">*</span></label>
                        <button
                          type="button"
                          onClick={handleAutoTitle}
                          className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/80"
                        >
                          অটো তৈরি
                        </button>
                      </div>
                      <input 
                        required 
                        type="text" 
                        value={title} 
                        onChange={e=>setTitle(e.target.value)} 
                        placeholder="যেমন: প্রথম শ্রেণি - ২০ অক্টোবর ২০২৬, মঙ্গলবার এর পড়া" 
                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-700 text-sm placeholder-slate-400" 
                      />
                    </div>
                  </div>

                  {/* Subject Badges Bar */}
                  <div className="pt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">বিষয় বাটন (ক্লিক করলেই যুক্ত হবে):</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COMMON_DIARY_SUBJECTS.map((sbName) => (
                        <button
                          key={sbName}
                          type="button"
                          onClick={() => addOrSetSubject(sbName)}
                          className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 transition-all cursor-pointer active:scale-95"
                        >
                          + {sbName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subjects & Homework Input Section */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-600 uppercase tracking-wider">বিষয় ও আজকের পড়া ({diarySubjects.length}টি বিষয়)</label>
                    </div>

                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1.5 custom-scrollbar">
                      {diarySubjects.map((sub, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 shadow-2xs transition-all space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                            {/* Subject Field */}
                            <div className="w-full sm:w-44 shrink-0">
                              <input 
                                type="text" 
                                placeholder="বিষয় (যেমন: বাংলা)" 
                                value={sub.subject} 
                                onChange={e => {
                                   const newList = diarySubjects.map((s, idx2) => idx2 === idx ? { ...s, subject: e.target.value } : s);
                                   setDiarySubjects(newList);
                                }} 
                                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl h-9 px-2.5 outline-none transition-all font-bold text-slate-800 text-xs" 
                              />
                            </div>

                            {/* Details & Voice */}
                            <div className="flex-1 w-full space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">আজকের পড়া / বাড়ির কাজ:</span>
                                <button
                                  type="button"
                                  onClick={() => handleVoiceInput(
                                    (text) => {
                                      const newList = diarySubjects.map((s, idx2) => idx2 === idx ? { ...s, details: (s.details ? s.details + ' ' + text : text) } : s);
                                      setDiarySubjects(newList);
                                    },
                                    (listening) => setActiveListeningIndex(listening ? idx : null)
                                  )}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all ${
                                    activeListeningIndex === idx
                                      ? 'bg-red-500 text-white animate-pulse'
                                      : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600'
                                  }`}
                                >
                                  {activeListeningIndex === idx ? <MicOff size={10} /> : <Mic size={10} />}
                                  <span>{activeListeningIndex === idx ? 'শুনছি...' : 'ভয়েস'}</span>
                                </button>
                              </div>
                              <textarea 
                                placeholder="পড়া বা বাড়ির কাজ বিস্তারিত লিখুন..." 
                                value={sub.details} 
                                onChange={e => {
                                   const newList = diarySubjects.map((s, idx2) => idx2 === idx ? { ...s, details: e.target.value } : s);
                                   setDiarySubjects(newList);
                                }} 
                                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl py-1.5 px-2.5 outline-none transition-all font-semibold text-slate-700 text-xs min-h-[46px] resize-none" 
                              />
                            </div>

                            {/* Delete Subject Button */}
                            <button 
                              type="button" 
                              onClick={() => setDiarySubjects(diarySubjects.filter((_, i) => i !== idx))}
                              disabled={diarySubjects.length <= 1}
                              className="self-end sm:self-center w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-20 rounded-lg transition-all shrink-0 cursor-pointer"
                              title="বিষয় সরান"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Quick Text Shortcuts */}
                          <div className="flex items-center gap-1 flex-wrap pt-0.5 border-t border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400">শর্টকাট:</span>
                            {[
                              'বোর্ডের পড়া শিখবে ও লিখবে',
                              'রিভিশন পড়া',
                              'আগামীকাল ক্লাস টেস্ট',
                              'পড়া নেই'
                            ].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  const newList = diarySubjects.map((s, idx2) => idx2 === idx ? { ...s, details: (s.details ? s.details + ' ' + preset : preset) } : s);
                                  setDiarySubjects(newList);
                                }}
                                className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200/60 transition-all cursor-pointer"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => setDiarySubjects([...diarySubjects, { subject: '', details: '' }])}
                      className="w-full py-2.5 border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50/50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={16} /> আরো বিষয় যোগ করুন
                    </button>
                  </div>

                  {/* Note & File Upload Section (Grid) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Special Note */}
                    <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">বিশেষ দ্রষ্টব্য / নোট (ঐচ্ছিক)</label>
                        <button
                          type="button"
                          onClick={() => handleVoiceInput(
                            (text) => setDiaryNote(prev => prev ? prev + ' ' + text : text),
                            setIsListeningNote
                          )}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                            isListeningNote ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isListeningNote ? <MicOff size={10} /> : <Mic size={10} />}
                          <span>{isListeningNote ? 'শুনছি...' : 'ভয়েস'}</span>
                        </button>
                      </div>
                      <textarea
                        value={diaryNote}
                        onChange={e => setDiaryNote(e.target.value)}
                        placeholder="যেমন: অভিভাবকের স্বাক্ষর করিয়ে আনবেন..."
                        className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl py-1.5 px-2.5 outline-none font-semibold text-slate-700 text-xs min-h-[50px] resize-none"
                      />
                    </div>

                    {/* File Attachment Upload */}
                    <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Paperclip size={13} className="text-blue-600" /> ছবি বা PDF সংযুক্ত করুন
                        </label>
                        <span className="text-[9px] font-bold text-slate-400">সর্বোচ্চ ১০MB</span>
                      </div>

                      <label className="w-full h-11 border border-dashed border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
                        <Paperclip size={16} className="text-blue-600" />
                        <span className="text-xs font-bold text-blue-700">ছবি বা PDF আপলোড করুন</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {diaryAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 max-h-[60px] overflow-y-auto">
                          {diaryAttachments.map((att, attIdx) => (
                            <div key={attIdx} className="p-1 pl-2 bg-white rounded-lg border border-slate-200 flex items-center gap-1 text-[11px] font-bold text-slate-700">
                              {att.type === 'pdf' ? <FileText size={14} className="text-red-500" /> : <ImageIcon size={14} className="text-blue-500" />}
                              <span className="truncate max-w-[90px]">{att.name}</span>
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiaryAttachments(diaryAttachments.filter((_, i) => i !== attIdx))}
                                className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setShowMsgModal(false)} 
                      className="w-full sm:w-auto px-5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                      <button 
                        type="button" 
                        onClick={(e) => submitMessage(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                      >
                        ড্রাফট সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitMessage(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send size={14} /> ডায়েরি প্রকাশ করুন
                      </button>
                    </div>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* 2. Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-red-500 via-amber-500 to-red-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <Bell size={28} className="animate-wiggle" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">নোটিশ তৈরি করুন</h3>
                        <p className="text-slate-500 text-sm font-medium">অভিভাবক ও শিক্ষার্থীদের জন্য গুরুত্বপূর্ণ নোটিশ পাঠান</p>
                     </div>
                  </div>
                  <button onClick={() => setShowNoticeModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Title Input */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">নোটিশের শিরোনাম <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="text" 
                      value={noticeTitle} 
                      onChange={e=>setNoticeTitle(e.target.value)} 
                      placeholder="যেমন: আগামী শুক্রবার মাদ্রাসা বন্ধ থাকবে" 
                      className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all font-bold text-slate-700 placeholder-slate-400" 
                    />
                  </div>

                  {/* Dual selectors for Class and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">শ্রেণী / গ্রুপ <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={noticeClass} 
                        onChange={e=>setNoticeClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all font-bold text-slate-700"
                      >
                        <option value="All Classes">সকল শ্রেণী (All Classes)</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>

                    <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">নোটিশের ধরন <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'APP_NOTICE', label: 'গুরুত্বপূর্ণ নোটিশ', color: 'border-red-200 text-red-600 bg-red-50/10' },
                          { id: 'APP_HOLIDAY', label: 'ছুটির ঘোষণা', color: 'border-amber-200 text-amber-600 bg-amber-50/10' },
                          { id: 'APP_PTM', label: 'মিটিং / সভা', color: 'border-blue-200 text-blue-600 bg-blue-50/10' },
                          { id: 'APP_DIARY', label: 'ডায়েরি নোটিশ', color: 'border-purple-200 text-purple-600 bg-purple-50/10' },
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setNoticeType(type.id)}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                              noticeType === type.id 
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-102 font-black' 
                                : `bg-white border-slate-200 text-slate-600 hover:border-slate-300`
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Date selection */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">তারিখ <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        required 
                        type="date" 
                        value={noticeDate} 
                        onChange={e=>setNoticeDate(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all font-bold text-slate-700" 
                      />
                    </div>
                  </div>

                  {/* Message details */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">বিস্তারিত বিবরণ <span className="text-red-500">*</span></label>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100 transition-all">
                      <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif font-black text-sm transition-all">B</button>
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif italic text-sm transition-all">I</button>
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif underline text-sm transition-all">U</button>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-all"><List size={16} /></button>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Rich Text</span>
                      </div>
                      <textarea 
                        required 
                        value={noticeDesc} 
                        onChange={e=>setNoticeDesc(e.target.value)} 
                        placeholder="এখানে বিস্তারিত বিবরণ ও নির্দেশনাবলী লিখুন..." 
                        className="w-full h-40 p-4 outline-none resize-none text-slate-700 leading-relaxed font-semibold placeholder-slate-400" 
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setShowNoticeModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitNotice(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitNotice(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> নোটিশ প্রকাশ করুন
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Routine Modal */}
      {showRoutineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                        <CalendarDays size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Class Routine</h3>
                        <p className="text-slate-500 text-sm font-medium">Create and manage class routines</p>
                     </div>
                  </div>
                  <button onClick={() => setShowRoutineModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                     ← Back
                  </button>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Class <span className="text-red-500">*</span></label>
                      <select required value={routineClass} onChange={e=>setRoutineClass(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-green-500 transition-all font-bold text-slate-700">
                          <option value="">Select Class</option>
                          {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Effective From <span className="text-red-500">*</span></label>
                      <input required type="date" value={routineEffectiveDate} onChange={e=>setRoutineEffectiveDate(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-green-500 transition-all font-bold text-slate-700" />
                    </div>
                  </div>

                  {/* Matrix approach */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                     <table className="w-full text-center text-sm">
                        <thead className="bg-green-50 text-green-800 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-2 border-r border-slate-200">Time</th>
                            <th className="py-3 px-2 border-r border-slate-200">Sunday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Monday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Tuesday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Wednesday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Thursday</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                          {routineRows.map((row, idx) => {
                             if (row.isBreak) {
                               return (
                                 <tr key={row.id} className="bg-slate-50 group">
                                   <td colSpan={6} className="py-2 px-2 font-bold text-slate-500 text-center relative">
                                      <input type="text" value={row.label || 'Break'} onChange={(e) => {
                                        const newRows = [...routineRows];
                                        newRows[idx].label = e.target.value;
                                        setRoutineRows(newRows);
                                      }} className="bg-transparent text-center outline-none border-b border-dashed border-slate-300 focus:border-green-500" />
                                      {' ('}
                                      <input type="text" value={row.time} onChange={(e) => {
                                        const newRows = [...routineRows];
                                        newRows[idx].time = e.target.value;
                                        setRoutineRows(newRows);
                                      }} className="bg-transparent text-center outline-none w-24 border-b border-dashed border-slate-300 focus:border-green-500" />
                                      {')'}
                                      <button type="button" onClick={() => {
                                         if(routineRows.length > 1) {
                                            const newRows = [...routineRows];
                                            newRows.splice(idx, 1);
                                            setRoutineRows(newRows);
                                         }
                                      }} className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16} />
                                      </button>
                                   </td>
                                 </tr>
                               )
                             }
                             return (
                               <tr key={row.id} className="group relative">
                                 <td className="py-2 px-2 border-r border-slate-200 font-bold text-slate-800">
                                   <div className="flex items-center gap-1">
                                      <input type="text" value={row.time} onChange={(e) => {
                                           const newRows = [...routineRows];
                                           newRows[idx].time = e.target.value;
                                           setRoutineRows(newRows);
                                         }} className="w-full text-center bg-transparent outline-none focus:bg-white focus:ring-2 ring-green-100 rounded py-1" />
                                      <button type="button" onClick={() => {
                                         if(routineRows.length > 1) {
                                            const newRows = [...routineRows];
                                            newRows.splice(idx, 1);
                                            setRoutineRows(newRows);
                                         }
                                      }} className="absolute -left-6 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 p-1 bg-red-50 rounded-full">
                                        <Trash2 size={14} />
                                      </button>
                                   </div>
                                 </td>
                                 {(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const).map(day => (
                                   <td key={day} className="py-2 px-2 border-r border-slate-200">
                                     <input type="text" value={row[day as keyof typeof row] as string || ''} onChange={(e) => {
                                        const newRows = [...routineRows];
                                        newRows[idx] = { ...newRows[idx], [day]: e.target.value };
                                        setRoutineRows(newRows);
                                      }} className="w-full text-center bg-transparent outline-none focus:bg-white focus:ring-2 ring-green-100 rounded py-1 placeholder-slate-300" placeholder="-" />
                                   </td>
                                 ))}
                               </tr>
                             );
                          })}
                        </tbody>
                     </table>
                     <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-4">
                        <button type="button" onClick={() => setRoutineRows([...routineRows, { id: Math.random().toString(), time: 'Time', Sunday: '', Monday: '', Tuesday: '', Wednesday: '', Thursday: '' }])} className="text-sm font-bold text-green-600 flex items-center gap-1 hover:text-green-700 bg-white px-3 py-1.5 rounded-lg border border-green-200 shadow-sm">
                           <Plus size={16} /> Add Normal Period
                        </button>
                        <button type="button" onClick={() => setRoutineRows([...routineRows, { id: Math.random().toString(), isBreak: true, time: '10:00 - 10:15', label: 'Break' }])} className="text-sm font-bold text-slate-500 flex items-center gap-1 hover:text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                           <Plus size={16} /> Add Break
                        </button>
                     </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Note <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <textarea value={routineNote} onChange={e=>setRoutineNote(e.target.value)} placeholder="রুটিন পরিবর্তন হলে..." className="w-full h-20 bg-white border border-slate-200 rounded-xl p-4 outline-none focus:border-green-500 transition-all font-medium text-slate-700 resize-none" />
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setShowRoutineModal(false)} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all">Cancel</button>
                    <div className="flex gap-3">
                      <button type="button" onClick={(e) => submitRoutine(e, true)} disabled={isSubmitting} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm">Save as Draft</button>
                      <button type="button" onClick={(e) => submitRoutine(e, false)} disabled={isSubmitting} className="px-8 h-12 bg-[#16a34a] hover:bg-green-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all shadow-md">Publish</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Syllabus Modal */}
      {showSyllabusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <BookOpen size={28} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">সিলেবাস যোগ করুন</h3>
                        <p className="text-slate-500 text-sm font-medium">বিভিন্ন শ্রেণীর জন্য নতুন সিলেবাস তৈরি অথবা আপডেট করুন</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSyllabusModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শ্রেণী (Class) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={syllabusClass} 
                        onChange={e=>setSyllabusClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-bold text-slate-700"
                      >
                        <option value="">শ্রেণী নির্বাচন করুন...</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">পরীক্ষা (Exam) <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span></label>
                      <input 
                        type="text"
                        value={syllabusExam}
                        onChange={e=>setSyllabusExam(e.target.value)}
                        placeholder="যেমন: অর্ধবার্ষিক পরীক্ষা"
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-bold text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শিক্ষাবর্ষ / সেশন (Session) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={syllabusSession} 
                        onChange={e=>setSyllabusSession(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-bold text-slate-700"
                      >
                        <option value="2025-26">২০২৫-২৬ (2025-26)</option>
                        <option value="2026-27">২০২৬-২৭ (2026-27)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject List Grid Design */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">সিলেবাসের বিষয়সমূহ এবং বিবরণ</label>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{syllabusSubjectList.length}টি বিষয়</span>
                    </div>

                    <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {syllabusSubjectList.map((item, idx) => {
                        // Dynamic icons or tag themes based on subject input
                        const subLower = item.subject.toLowerCase();
                        let badgeStyle = "bg-orange-50 text-orange-600 border-orange-100";
                        if (subLower.includes("quran") || subLower.includes("কুরআন") || subLower.includes("কোরআন")) {
                          badgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        } else if (subLower.includes("arabic") || subLower.includes("আরবি")) {
                          badgeStyle = "bg-red-50 text-red-600 border-red-100";
                        } else if (subLower.includes("hadith") || subLower.includes("হাদিস")) {
                          badgeStyle = "bg-blue-50 text-blue-600 border-blue-100";
                        } else if (subLower.includes("bangla") || subLower.includes("বাংলা")) {
                          badgeStyle = "bg-teal-50 text-teal-600 border-teal-100";
                        } else if (subLower.includes("english") || subLower.includes("अंग्रेजी")) {
                          badgeStyle = "bg-purple-50 text-purple-600 border-purple-100";
                        }

                        return (
                          <div 
                            key={idx} 
                            className="group flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50 transition-all duration-200"
                          >
                            {/* Subject Field Column */}
                            <div className="flex-1 min-w-[200px] flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl border shrink-0 flex items-center justify-center transition-all ${badgeStyle}`}>
                                <BookOpen size={18} />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">বিষয় (Subject)</label>
                                <input 
                                  type="text" 
                                  value={item.subject} 
                                  onChange={(e) => {
                                    const arr = [...syllabusSubjectList];
                                    arr[idx].subject = e.target.value;
                                    setSyllabusSubjectList(arr);
                                  }} 
                                  className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-orange-500 rounded-xl h-10 px-3 outline-none transition-all font-bold text-slate-700 text-sm" 
                                  placeholder="যেমন: বাংলা, ইংরেজি, গণিত"
                                />
                              </div>
                            </div>

                            {/* Details text input column */}
                            <div className="flex-[2] flex flex-col justify-center">
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">পরীক্ষার সিলেবাসের বিবরণ (Syllabus Details)</label>
                              <textarea 
                                value={item.details} 
                                onChange={(e) => {
                                  const arr = [...syllabusSubjectList];
                                  arr[idx].details = e.target.value;
                                  setSyllabusSubjectList(arr);
                                }} 
                                className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-orange-500 rounded-xl py-2 px-3 outline-none transition-all font-semibold text-slate-600 text-sm min-h-[60px] resize-none" 
                                placeholder="পরীক্ষার অধ্যায়, পৃষ্ঠা বা নির্দিষ্ট অংশ বিস্তারিত লিখুন..."
                              />
                            </div>

                            {/* Delete Column */}
                            <div className="flex items-center justify-end md:justify-center px-1">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if(syllabusSubjectList.length > 1) {
                                    const arr = [...syllabusSubjectList];
                                    arr.splice(idx, 1);
                                    setSyllabusSubjectList(arr);
                                  }
                                }} 
                                disabled={syllabusSubjectList.length <= 1}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all"
                                title="Remove Subject"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        setSyllabusSubjectList([...syllabusSubjectList, { subject: '', details: '' }]);
                      }} 
                      className="w-full mt-4 py-3.5 border-2 border-dashed border-slate-200 text-orange-600 hover:text-orange-700 hover:border-orange-300 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-orange-50/30 transition-all active:scale-99"
                    >
                      <Plus size={18} className="stroke-[3]" /> আরো বিষয় যোগ করুন (Add Subject)
                    </button>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 mt-8">
                    <button 
                      type="button" 
                      onClick={() => setShowSyllabusModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitSyllabus(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitSyllabus(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> সিলেবাস প্রকাশ করুন
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Suggestion Modal */}
      {showSuggestionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <BookOpen size={28} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">সাজেশন যোগ করুন</h3>
                        <p className="text-slate-500 text-sm font-medium">বিভিন্ন শ্রেণীর জন্য নতুন সাজেশন তৈরি অথবা আপডেট করুন</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSuggestionModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শ্রেণী (Class) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={suggestionClass} 
                        onChange={e=>setSuggestionClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-700"
                      >
                        <option value="">শ্রেণী নির্বাচন করুন...</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">পরীক্ষা (Exam) <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span></label>
                      <input 
                        type="text"
                        value={suggestionExam}
                        onChange={e=>setSuggestionExam(e.target.value)}
                        placeholder="যেমন: অর্ধবার্ষিক পরীক্ষা"
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শিক্ষাবর্ষ / সেশন (Session) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={suggestionSession} 
                        onChange={e=>setSuggestionSession(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-700"
                      >
                        <option value="2025-26">২০২৫-২৬ (2025-26)</option>
                        <option value="2026-27">২০২৬-২৭ (2026-27)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject List Grid Design */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">সিলেবাসের বিষয়সমূহ এবং বিবরণ</label>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{suggestionSubjectList.length}টি বিষয়</span>
                    </div>

                    <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {suggestionSubjectList.map((item, idx) => {
                        // Dynamic icons or tag themes based on subject input
                        const subLower = item.subject.toLowerCase();
                        let badgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        if (subLower.includes("quran") || subLower.includes("কুরআন") || subLower.includes("কোরআন")) {
                          badgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        } else if (subLower.includes("arabic") || subLower.includes("আরবি")) {
                          badgeStyle = "bg-red-50 text-red-600 border-red-100";
                        } else if (subLower.includes("hadith") || subLower.includes("হাদিস")) {
                          badgeStyle = "bg-blue-50 text-blue-600 border-blue-100";
                        } else if (subLower.includes("bangla") || subLower.includes("বাংলা")) {
                          badgeStyle = "bg-teal-50 text-teal-600 border-teal-100";
                        } else if (subLower.includes("english") || subLower.includes("अंग्रेजी")) {
                          badgeStyle = "bg-purple-50 text-purple-600 border-purple-100";
                        }

                        return (
                          <div 
                            key={idx} 
                            className="group flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50 transition-all duration-200"
                          >
                            {/* Subject Field Column */}
                            <div className="flex-1 min-w-[200px] flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl border shrink-0 flex items-center justify-center transition-all ${badgeStyle}`}>
                                <BookOpen size={18} />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">বিষয় (Subject)</label>
                                <input 
                                  type="text" 
                                  value={item.subject} 
                                  onChange={(e) => {
                                    const arr = [...suggestionSubjectList];
                                    arr[idx].subject = e.target.value;
                                    setSuggestionSubjectList(arr);
                                  }} 
                                  className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-emerald-500 rounded-xl h-10 px-3 outline-none transition-all font-bold text-slate-700 text-sm" 
                                  placeholder="যেমন: বাংলা, ইংরেজি, গণিত"
                                />
                              </div>
                            </div>

                            {/* Details text input column */}
                            <div className="flex-[2] flex flex-col justify-center">
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">পরীক্ষার সিলেবাসের বিবরণ (Syllabus Details)</label>
                              <textarea 
                                value={item.details} 
                                onChange={(e) => {
                                  const arr = [...suggestionSubjectList];
                                  arr[idx].details = e.target.value;
                                  setSuggestionSubjectList(arr);
                                }} 
                                className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-emerald-500 rounded-xl py-2 px-3 outline-none transition-all font-semibold text-slate-600 text-sm min-h-[60px] resize-none" 
                                placeholder="পরীক্ষার অধ্যায়, পৃষ্ঠা বা নির্দিষ্ট অংশ বিস্তারিত লিখুন..."
                              />
                            </div>

                            {/* Delete Column */}
                            <div className="flex items-center justify-end md:justify-center px-1">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if(suggestionSubjectList.length > 1) {
                                    const arr = [...suggestionSubjectList];
                                    arr.splice(idx, 1);
                                    setSuggestionSubjectList(arr);
                                  }
                                }} 
                                disabled={suggestionSubjectList.length <= 1}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all"
                                title="Remove Subject"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        setSuggestionSubjectList([...suggestionSubjectList, { subject: '', details: '' }]);
                      }} 
                      className="w-full mt-4 py-3.5 border-2 border-dashed border-slate-200 text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-50/30 transition-all active:scale-99"
                    >
                      <Plus size={18} className="stroke-[3]" /> আরো বিষয় যোগ করুন (Add Subject)
                    </button>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 mt-8">
                    <button 
                      type="button" 
                      onClick={() => setShowSuggestionModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitSuggestion(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitSuggestion(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> সাজেশন প্রকাশ করুন
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <ConfirmDialog 
            config={confirmConfig} 
            onConfirm={confirmAction || (() => {})} 
            onCancel={() => setShowConfirmModal(false)} 
          />
        )}
      </AnimatePresence>

      {/* Edit Subject Modal */}
      <AnimatePresence>
        {showEditSubjectModal && (
          <EditSubjectDialog 
            currentName={editingSubjectName}
            onSave={(name) => {
              if (editingSubjectIndex !== null && name.trim()) {
                const updated = [...classSubjects];
                const oldName = updated[editingSubjectIndex];
                updated[editingSubjectIndex] = name.trim();
                updateAndPersistSubjects(updated);
                if (selectedSubject === oldName) {
                  setSelectedSubject(name.trim());
                }
              }
              setShowEditSubjectModal(false);
              setEditingSubjectIndex(null);
              setEditingSubjectName('');
            }}
            onCancel={() => {
              setShowEditSubjectModal(false);
              setEditingSubjectIndex(null);
              setEditingSubjectName('');
            }}
          />
        )}
      </AnimatePresence>

      {/* Add Subject Modal */}
      <AnimatePresence>
        {showAddSubjectModal && (
          <AddSubjectDialog 
            onAdd={(name) => {
              setClassSubjects(prev => [...prev, name]);
              setShowAddSubjectModal(false);
            }} 
            onCancel={() => setShowAddSubjectModal(false)} 
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} className="stroke-[2.5]" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                এই তথ্যটি চিরস্থায়ীভাবে মুছে ফেলা হবে। আপনি কি নিশ্চিত যে এটি মুছে ফেলতে চান?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => confirmDelete()}
                  disabled={isSubmitting}
                  className="w-full h-14 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Trash2 size={20} />}
                  হ্যাঁ, মুছে ফেলুন
                </button>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingId(null);
                  }}
                  disabled={isSubmitting}
                  className="w-full h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  বাতিল করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attachment Preview Lightbox Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[500] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-4 md:p-6 relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {previewAttachment.type === 'pdf' ? <FileText className="text-red-500 shrink-0" size={22} /> : <ImageIcon className="text-blue-500 shrink-0" size={22} />}
                <span className="font-extrabold text-slate-800 text-sm truncate">{previewAttachment.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  download={previewAttachment.name}
                  className="px-3.5 h-9 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Download size={14} /> ডাউনলোড
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-100">
              {previewAttachment.type === 'image' ? (
                <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[70vh] object-contain rounded-xl shadow-xs" />
              ) : (
                <div className="w-full h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center">
                    <FileText size={48} />
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800 text-base mb-1">{previewAttachment.name}</p>
                    <p className="text-xs text-slate-400 font-medium">পিডিএফ ফাইল সংযুক্ত করা হয়েছে</p>
                  </div>
                  <a
                    href={previewAttachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-6 h-12 bg-red-600 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all active:scale-95"
                  >
                    <ExternalLink size={16} /> PDF ডকুমেন্ট ওপেন করুন
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
