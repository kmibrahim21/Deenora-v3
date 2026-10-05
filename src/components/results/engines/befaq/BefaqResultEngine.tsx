import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from 'supabase';
import { Institution, Class, Student, BefaqExam, BefaqSubject, Language, UserRole, Profile } from 'types';
import { GraduationCap, Plus, BookOpen, Trophy, Save, X, Loader2, ArrowLeft, Calendar, LayoutGrid, Download, CreditCard, Trash2, RefreshCw, Edit2, Edit3, TrendingUp, AlertCircle, ChevronRight, CheckCircle2, Hash, Palette, Clock, ZoomIn, ZoomOut, Maximize, Upload, Globe, Eye, EyeOff, Type } from 'lucide-react';
import { t } from 'translations';
import SmartResultAnalytics from '../../../../components/SmartResultAnalytics';
import { generateAdmitCardPDF } from '../../../../utils/admitCardGenerator';
import { generateSeatPlanPDF, generateExamRoutinePDF } from '../../../../utils/pdfGenerator';
import { SeatAssignment, ExamRoom } from 'types';
import { sortMadrasahClasses } from '../../../../pages/Classes';
import FinalResults from './FinalResults';

interface BefaqResultEngineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  activeYear?: any;
  profile?: Profile | null;
}

const BefaqResultEngine: React.FC<BefaqResultEngineProps> = ({ lang, madrasah, onBack, role, activeYear, profile }) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'analytics' | 'final-results' | 'seat-plan' | 'exam-routine'>('exams');
  
  // Original Befaq states moved to top to avoid TS2448 block-scope issues
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report' | 'rank'>('list');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [exams, setExams] = useState<BefaqExam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<BefaqExam | null>(null);
  const [selectedSeatPlanExamId, setSelectedSeatPlanExamId] = useState<string>('');
  const [subjects, setSubjects] = useState<BefaqSubject[]>([]);
  const [marksData, setMarksData] = useState<any>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [editingExam, setEditingExam] = useState<BefaqExam | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<BefaqSubject | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSubjectConfirm, setShowDeleteSubjectConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => void) | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Exam Routine Feature States
  const [selectedRoutineExamId, setSelectedRoutineExamId] = useState<string>('');
  const [selectedRoutineAllExamIds, setSelectedRoutineAllExamIds] = useState<string[]>([]);
  const [customRoutineTitle, setCustomRoutineTitle] = useState<string>('');
  const [routineSelectionMode, setRoutineSelectionMode] = useState<'all' | 'class' | 'saved'>('all');
  const [selectedRoutineClassId, setSelectedRoutineClassId] = useState<string>('');
  const [routineMorningTime, setRoutineMorningTime] = useState<string>('09:00 AM - 12:00 PM');
  const [routineAfternoonTime, setRoutineAfternoonTime] = useState<string>('02:00 PM - 05:00 PM');
  const [showRoutineAfternoon, setShowRoutineAfternoon] = useState<boolean>(true);

  const getBanglaNumber = (str: string) => {
    const englishDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return str.replace(/[0-9]/g, d => englishDigits[d]);
  };
  const currentYear = new Date().getFullYear().toString();
  const currentYearBn = getBanglaNumber(currentYear);
  const [routineMorningStart, setRoutineMorningStart] = useState<string>('09:00');
  const [routineMorningEnd, setRoutineMorningEnd] = useState<string>('12:00');
  const [routineAfternoonStart, setRoutineAfternoonStart] = useState<string>('14:00');
  const [routineAfternoonEnd, setRoutineAfternoonEnd] = useState<string>('17:00');
  const [routineStartDate, setRoutineStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [routineThemeColor, setRoutineThemeColor] = useState<string>('emerald');
  const [fontScale, setFontScale] = useState<number>(1.2);
  const [routinePrincipalName, setRoutinePrincipalName] = useState<string>('');
  const [routinePrincipalMobile, setRoutinePrincipalMobile] = useState<string>('');
  const [routineInstructions, setRoutineInstructions] = useState<string[]>([
    'পরীক্ষার ১৫ মিনিট পূর্বে আসনে উপস্থিত হতে হবে',
    'অবশ্যই সাথে প্রবেশপত্র আনতে হবে',
    'মোবাইল ও যেকোনো ইলেকট্রনিক ডিভাইস নিষিদ্ধ',
    'পরিষ্কার-পরিচ্ছন্ন ও সুশৃঙ্খলভাবে পরীক্ষা দিতে হবে'
  ]);
  const [routineData, setRoutineData] = useState<any[]>([]);
  const [savedRoutines, setSavedRoutines] = useState<any[]>([]);
  const [isRestoringRoutine, setIsRestoringRoutine] = useState(false);
  const [routineIsPublished, setRoutineIsPublished] = useState<boolean>(true);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editingRoutineName, setEditingRoutineName] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Custom states for routine modals to avoid overlap
  const [showRoutineSuccessModal, setShowRoutineSuccessModal] = useState(false);
  const [routineSuccessTitle, setRoutineSuccessTitle] = useState('');
  const [routineSuccessMessage, setRoutineSuccessMessage] = useState('');
  const [routineModalMode, setRoutineModalMode] = useState<'success' | 'confirm'>('success');
  const [routineOnConfirm, setRoutineOnConfirm] = useState<() => void>(() => {});
  const [routineConfirmText, setRoutineConfirmText] = useState('');
  const [routineCancelText, setRoutineCancelText] = useState('');

  // Load saved routines from config_json
  useEffect(() => {
    if ((madrasah?.config_json as any)?.saved_exam_routines) {
      setSavedRoutines((madrasah.config_json as any).saved_exam_routines);
    }
  }, [madrasah?.config_json]);

  const routineThemes = {
    'emerald': { primary: '#013c28', secondary: '#023c28', light: '#E6F4EA', accent: '#EAF7EE' },
    'blue': { primary: '#1E3A8A', secondary: '#1E40AF', light: '#EFF6FF', accent: '#F0F9FF' },
    'slate': { primary: '#334155', secondary: '#475569', light: '#F1F5F9', accent: '#F8FAFC' },
    'purple': { primary: '#581C87', secondary: '#6B21A8', light: '#F3E8FF', accent: '#FAF5FF' },
    'rose': { primary: '#881337', secondary: '#9F1239', light: '#FFE4E6', accent: '#FFF5F5' }
  };

  const rtTheme = routineThemes[routineThemeColor as keyof typeof routineThemes] || routineThemes.emerald;

  const formatTime = (time24: string) => {
    if (!time24) return '';
    const [hrs, mins] = time24.split(':');
    const hr = parseInt(hrs);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;
    return `${hr12.toString().padStart(2, '0')}:${mins} ${ampm}`;
  };

  // Update routine times whenever start/end times change
  useEffect(() => {
    setRoutineMorningTime(`${formatTime(routineMorningStart)} - ${formatTime(routineMorningEnd)}`);
    setRoutineAfternoonTime(`${formatTime(routineAfternoonStart)} - ${formatTime(routineAfternoonEnd)}`);
  }, [routineMorningStart, routineMorningEnd, routineAfternoonStart, routineAfternoonEnd]);

  // Automatically fetch / prepare data when active tab is exam-routine or filters update
  useEffect(() => {
    if (isRestoringRoutine) return;
    if (activeTab !== 'exam-routine') return;
    
    const loadRoutineData = async () => {
      try {
        let relevantExams = [];
        
        if (routineSelectionMode === 'class' && selectedRoutineClassId) {
          if (selectedRoutineExamId) {
            const pickedExam = exams.find(e => e.id === selectedRoutineExamId);
            if (pickedExam) relevantExams = [pickedExam];
          } else {
            const classExams = exams.filter(e => e.marhala_id === selectedRoutineClassId);
            if (classExams.length > 0) {
              relevantExams = [classExams[0]];
            }
          }
        } else {
          if (selectedRoutineAllExamIds.length > 0) {
            relevantExams = exams.filter(e => selectedRoutineAllExamIds.includes(e.id));
          } else {
            relevantExams = exams; // Fallback to all exams
          }
        }

        if (relevantExams.length === 0) {
          setDefaultSampleRoutine();
          return;
        }

        const { data: allSubs, error } = await supabase
          .from('befaq_subjects')
          .select('*')
          .in('exam_id', relevantExams.map(e => e.id))
          .order('sort_order', { ascending: true });

        if (error || !allSubs || allSubs.length === 0) {
          setDefaultSampleRoutine();
          return;
        }

        const startDate = routineStartDate ? new Date(routineStartDate) : new Date();

        // Get unique sort orders and sort them
        const uniqueSortOrders = Array.from(new Set(allSubs.map(s => s.sort_order || 0))).sort((a, b) => a - b);
        const compiled: any[] = [];
        let currentDate = new Date(startDate);
        const weeklyHolidays = madrasah?.config_json?.weekly_holidays || [5];

        for (const order of uniqueSortOrders) {
          while (weeklyHolidays.includes(currentDate.getDay())) {
            currentDate.setDate(currentDate.getDate() + 1);
          }

          const isoDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
          const dateStr = currentDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const dayStr = currentDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long' });

          const slotSubs = allSubs.filter(s => s.sort_order === order);
          if (slotSubs.length === 0) continue;

          const morningSubjects = slotSubs.map(s => {
            const exam = relevantExams.find(e => e.id === s.exam_id);
            const cls = classes.find(c => c.id === exam?.marhala_id);
            return {
              classId: cls?.id || '',
              className: cls?.class_name || 'Class',
              subject: s.subject_name
            };
          });

          compiled.push({
            id: crypto.randomUUID(),
            isoDate: isoDate,
            date: dateStr,
            day: dayStr,
            morning: {
              time: routineMorningTime || '09:00 AM - 12:00 PM',
              subjects: morningSubjects
            },
            afternoon: {
              time: routineAfternoonTime || '02:00 PM - 05:00 PM',
              subjects: []
            }
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }

        setRoutineData(compiled);
      } catch (err) {
        console.error('Error compiling routine:', err);
        setDefaultSampleRoutine();
      }
    };

    const setDefaultSampleRoutine = () => {
      const compiled: any[] = [];
      const sampleDays = [
        { 
          dayName: lang === 'bn' ? 'শনিবার' : 'Saturday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'তাইসীর' : 'Taisir', subject: lang === 'bn' ? 'আরবি সাহিত্য' : 'Arabic Lit' },
            { classId: 'n', className: lang === 'bn' ? 'মিযান' : 'Mizan', subject: lang === 'bn' ? 'নাহবেমীর' : 'Nahvemir' },
            { classId: '1', className: lang === 'bn' ? 'নাহবেমীর' : 'Nahvemir', subject: lang === 'bn' ? 'শরহে মিআতে আমিল' : 'Sharh' },
            { classId: '2', className: lang === 'bn' ? 'হিদায়াতুন্নাহব' : 'Hidayatunnahv', subject: lang === 'bn' ? 'কুদুরী' : 'Kuduri' },
            { classId: '3', className: lang === 'bn' ? 'কাফিয়া' : 'Kafia', subject: lang === 'bn' ? 'শরহে জামী' : 'Sharh Jami' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'রোববার' : 'Sunday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'তাইসীর' : 'Taisir', subject: lang === 'bn' ? 'উর্দু' : 'Urdu' },
            { classId: 'n', className: lang === 'bn' ? 'মিযান' : 'Mizan', subject: lang === 'bn' ? 'উর্দু কায়েদা' : 'Urdu' },
            { classId: '1', className: lang === 'bn' ? 'নাহবেমীর' : 'Nahvemir', subject: lang === 'bn' ? 'পাক-পাঞ্জাবি' : 'Punjabi' },
            { classId: '2', className: lang === 'bn' ? 'হিদায়াতুন্নাহব' : 'Hidayatunnahv', subject: lang === 'bn' ? 'কুদুরী' : 'Kuduri' },
            { classId: '3', className: lang === 'bn' ? 'কাফিয়া' : 'Kafia', subject: lang === 'bn' ? 'কানযুদ্দাকায়িক' : 'Kanz' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'সোমবার' : 'Monday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'তাইসীর' : 'Taisir', subject: lang === 'bn' ? 'ফার্সি' : 'Persian' },
            { classId: 'n', className: lang === 'bn' ? 'মিযান' : 'Mizan', subject: lang === 'bn' ? 'ফার্সি কায়েদা' : 'Persian' },
            { classId: '1', className: lang === 'bn' ? 'নাহবেমীর' : 'Nahvemir', subject: lang === 'bn' ? 'গুলিস্তাঁ' : 'Gulistan' },
            { classId: '2', className: lang === 'bn' ? 'হিদায়াতুন্নাহব' : 'Hidayatunnahv', subject: lang === 'bn' ? 'বুস্তাঁ' : 'Bustan' },
            { classId: '3', className: lang === 'bn' ? 'কাফিয়া' : 'Kafia', subject: lang === 'bn' ? 'শরহে বেকায়া' : 'Sharh Viqaya' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'মঙ্গলবার' : 'Tuesday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'তাইসীর' : 'Taisir', subject: lang === 'bn' ? 'ফিকাহ' : 'Fiqh' },
            { classId: 'n', className: lang === 'bn' ? 'মিযান' : 'Mizan', subject: lang === 'bn' ? 'মুনশাইব' : 'Munshaib' },
            { classId: '1', className: lang === 'bn' ? 'নাহবেমীর' : 'Nahvemir', subject: lang === 'bn' ? 'কুরআন অনুবাদ' : 'Quran Translation' },
            { classId: '2', className: lang === 'bn' ? 'হিদায়াতুন্নাহব' : 'Hidayatunnahv', subject: lang === 'bn' ? 'নূরুল ঈযাহ' : 'Nurul Idah' },
            { classId: '3', className: lang === 'bn' ? 'কাফিয়া' : 'Kafia', subject: lang === 'bn' ? 'আকাইদ' : 'Aqaid' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'বুধবার' : 'Wednesday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'তাইসীর' : 'Taisir', subject: lang === 'bn' ? 'সীরাত' : 'Seerat' },
            { classId: 'n', className: lang === 'bn' ? 'মিযান' : 'Mizan', subject: lang === 'bn' ? 'পাঁচ কিতাব' : 'Five Books' },
            { classId: '1', className: lang === 'bn' ? 'নাহবেমীর' : 'Nahvemir', subject: lang === 'bn' ? 'তারিখ' : 'History' },
            { classId: '2', className: lang === 'bn' ? 'হিদায়াতুন্নাহব' : 'Hidayatunnahv', subject: lang === 'bn' ? 'খুলাসাতুল কায়দা' : 'Tajweed' },
            { classId: '3', className: lang === 'bn' ? 'কাফিয়া' : 'Kafia', subject: lang === 'bn' ? 'উসূলে শাশী' : 'Usul al-Shashi' }
          ]
        }
      ];

      const getSampleMorningSubjects = (subs: any[]) => {
        if (routineSelectionMode === 'all') {
          return subs;
        }
        const selectedClassName = classes.find(c => c.id === selectedRoutineClassId)?.class_name || '';
        const matched = subs.find(sub => 
          sub.className.includes(selectedClassName) || 
          selectedClassName.includes(sub.className)
        );
        if (matched) {
          return [matched];
        } else {
          return [{ className: selectedClassName || 'Class 1', subject: subs[0]?.subject || (lang === 'bn' ? 'আরবি' : 'Arabic') }];
        }
      };

      let initialDate = routineStartDate ? new Date(routineStartDate) : new Date();
      let runDate = new Date(initialDate);
      const weeklyHolidays = madrasah?.config_json?.weekly_holidays || [5];
      sampleDays.forEach((sd) => {
        while (weeklyHolidays.includes(runDate.getDay())) {
          runDate.setDate(runDate.getDate() + 1);
        }

        const dateStr = runDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isoDate = `${runDate.getFullYear()}-${(runDate.getMonth() + 1).toString().padStart(2, '0')}-${runDate.getDate().toString().padStart(2, '0')}`;
        
        compiled.push({
          id: crypto.randomUUID(),
          isoDate: isoDate,
          date: dateStr,
          day: sd.dayName,
          morning: {
            time: routineMorningTime || '09:00 AM - 12:00 PM',
            subjects: getSampleMorningSubjects(sd.subjects)
          },
          afternoon: {
            time: routineAfternoonTime || '02:00 PM - 05:00 PM',
            subjects: []
          }
        });

        runDate.setDate(runDate.getDate() + 1);
      });

      setRoutineData(compiled);
    };

    loadRoutineData();
  }, [exams, classes, routineMorningTime, routineAfternoonTime, lang, routineSelectionMode, selectedRoutineClassId, selectedRoutineExamId, selectedRoutineAllExamIds, routineStartDate, activeTab]);

  // Set default Selected Class for Routine
  useEffect(() => {
    if (classes.length > 0 && !selectedRoutineClassId) {
      setSelectedRoutineClassId(classes[0].id);
    }
  }, [classes, selectedRoutineClassId]);

  // Scaler Hook/Ref for responsive A4 Live Preview
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [userZoom, setUserZoom] = useState<number>(1);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const isMobile = window.innerWidth < 768;
        const targetWidth = 1123; // Landscape width
        const s = Math.min(1.2, isMobile ? (width / 1160) : (width / (targetWidth + 40)));
        setPreviewScale(s);
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  // Automated name of the active exam
  const activeExamName = React.useMemo(() => {
    if (routineSelectionMode === 'all' && customRoutineTitle.trim() !== '') {
      return customRoutineTitle;
    }
    if (routineSelectionMode === 'class' && selectedRoutineClassId) {
      if (selectedRoutineExamId) {
        const pickedExam = exams.find(e => e.id === selectedRoutineExamId);
        if (pickedExam) return pickedExam.exam_name;
      }
      const classExams = exams.filter(e => e.marhala_id === selectedRoutineClassId);
      if (classExams.length > 0) {
        return classExams[0].exam_name;
      }
      const selectedClass = classes.find(c => c.id === selectedRoutineClassId);
      if (selectedClass) {
        return lang === 'bn' 
          ? `${selectedClass.class_name} পরীক্ষা`
          : `${selectedClass.class_name} Exam`;
      }
    }
    return customRoutineTitle || (lang === 'bn' ? 'বেফাক পরীক্ষা' : 'Befaq Exam');
  }, [routineSelectionMode, customRoutineTitle, selectedRoutineClassId, selectedRoutineExamId, exams, classes, lang]);

  // Compute display classes for routine mode
  const routineDisplayClasses = React.useMemo(() => {
    if (classes.length === 0) return [];
    if (routineSelectionMode === 'all' && selectedRoutineAllExamIds.length > 0) {
      return classes.filter(c => selectedRoutineAllExamIds.some(examId => exams.find(e => e.id === examId)?.marhala_id === c.id));
    }
    return classes;
  }, [classes, routineSelectionMode, selectedRoutineAllExamIds, exams]);

  const handleAddRoutineDay = () => {
    const lastDay = routineData[routineData.length - 1];
    let nextDate = new Date();
    if (lastDay && lastDay.isoDate) {
      nextDate = new Date(lastDay.isoDate);
      nextDate.setDate(nextDate.getDate() + 1);
    }
    
    const weeklyHolidays = madrasah?.config_json?.weekly_holidays || [5];
    while (weeklyHolidays.includes(nextDate.getDay())) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    
    const isoDate = `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}-${nextDate.getDate().toString().padStart(2, '0')}`;
    const dateStr = nextDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dayStr = nextDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long' });
    
    setRoutineData(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        isoDate: isoDate,
        date: dateStr,
        day: dayStr,
        morning: {
          time: routineMorningTime,
          subjects: []
        },
        afternoon: {
          time: routineAfternoonTime,
          subjects: []
        }
      }
    ]);
  };

  const handleRemoveRoutineDay = (id: string) => {
    setRoutineData(prev => prev.filter(d => d.id !== id));
  };

  const handleCreateNewRoutine = () => {
    setEditingRoutineId(null);
    setEditingRoutineName('');
    setCustomRoutineTitle('');
  };

  const saveRoutineToDB = async () => {
    if (!madrasah) return;
    try {
      const isUpdating = Boolean(editingRoutineId);
      const currentConfig = madrasah.config_json || {};
      const existingRoutines: any[] = (currentConfig as any).saved_exam_routines || [];
      const existingRoutine = isUpdating ? existingRoutines.find((r: any) => r.id === editingRoutineId) : null;
      
      const routineId = isUpdating && existingRoutine ? existingRoutine.id : Date.now().toString();

      const payload = {
        id: routineId,
        name: customRoutineTitle || activeExamName || (lang === 'bn' ? 'বেফাক পরীক্ষার রুটিন' : 'Befaq Exam Routine'),
        createdAt: existingRoutine?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        is_published: routineIsPublished,
        routineData,
        routineInstructions,
        routineMorningTime,
        routineAfternoonTime,
        routineThemeColor,
        fontScale: fontScale || 1.2,
        activeExamName,
        routineStartDate,
        showRoutineAfternoon,
        routineSelectionMode,
        selectedRoutineClassId,
        customRoutineTitle,
        routineMorningStart,
        routineMorningEnd,
        routineAfternoonStart,
        routineAfternoonEnd,
        routinePrincipalName,
        routinePrincipalMobile,
        selectedRoutineExamId,
        selectedRoutineAllExamIds
      };

      let updatedRoutines: any[];
      if (isUpdating && existingRoutines.some((r: any) => r.id === routineId)) {
        updatedRoutines = existingRoutines.map((r: any) => r.id === routineId ? payload : r);
      } else {
        updatedRoutines = [...existingRoutines, payload];
      }

      const updatedConfig = { ...currentConfig, saved_exam_routines: updatedRoutines };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;
      setSavedRoutines(updatedRoutines);
      if (madrasah.config_json) {
        (madrasah.config_json as any).saved_exam_routines = updatedRoutines;
      }
      
      setEditingRoutineId(routineId);
      setEditingRoutineName(payload.name);

      setRoutineSuccessTitle(
        isUpdating 
          ? (lang === 'bn' ? 'রুটিন আপডেট হয়েছে' : 'Routine Updated') 
          : (lang === 'bn' ? 'রুটিন সেভ হয়েছে' : 'Routine Saved')
      );
      setRoutineSuccessMessage(
        isUpdating 
          ? (lang === 'bn' ? 'আপনার পরীক্ষার রুটিনটি সফলভাবে আপডেট করা হয়েছে।' : 'Your exam routine has been successfully updated.')
          : (lang === 'bn' ? 'আপনার পরীক্ষার রুটিনটি সফলভাবে সার্ভারে সংরক্ষিত হয়েছে।' : 'Your exam routine has been successfully saved to the server.')
      );
      setRoutineModalMode('success');
      setShowRoutineSuccessModal(true);
    } catch (err) {
      console.error('Error saving routine:', err);
    }
  };

  const toggleRoutinePublish = async (id: string, currentPublished: boolean) => {
    if (!madrasah) return;
    try {
      const currentConfig = madrasah.config_json || {};
      const updatedRoutines = ((currentConfig as any).saved_exam_routines || []).map((r: any) => {
        if (r.id === id) {
          return { ...r, is_published: !currentPublished };
        }
        return r;
      });
      const updatedConfig = { ...currentConfig, saved_exam_routines: updatedRoutines };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;
      setSavedRoutines(updatedRoutines);
      if (madrasah.config_json) {
        (madrasah.config_json as any).saved_exam_routines = updatedRoutines;
      }
    } catch (err) {
      console.error('Error toggling routine publish status:', err);
    }
  };

  const deleteRoutineFromDB = async (id: string) => {
    if (!madrasah) return;
    
    setRoutineModalMode('confirm');
    setRoutineSuccessTitle(lang === 'bn' ? 'মুছে ফেলতে নিশ্চিত?' : 'Confirm Delete');
    setRoutineSuccessMessage(lang === 'bn' ? 'আপনি কি রুটিনটি মুছে ফেলতে নিশ্চিত?' : 'Are you sure you want to delete this routine?');
    setRoutineConfirmText(lang === 'bn' ? 'মুছে ফেলুন' : 'Delete');
    setRoutineCancelText(lang === 'bn' ? 'বাতিল' : 'Cancel');
    
    setRoutineOnConfirm(() => async () => {
      try {
        const currentConfig = madrasah.config_json || {};
        const updatedRoutines = ((currentConfig as any).saved_exam_routines || []).filter((r: any) => r.id !== id);
        const updatedConfig = { ...currentConfig, saved_exam_routines: updatedRoutines };

        const { error } = await supabase
          .from('institutions')
          .update({ config_json: updatedConfig })
          .eq('id', madrasah.id);

        if (error) throw error;
        setSavedRoutines(updatedRoutines);
        if (madrasah.config_json) {
          (madrasah.config_json as any).saved_exam_routines = updatedRoutines;
        }
        
        if (id === editingRoutineId) {
          setEditingRoutineId(null);
          setEditingRoutineName('');
        }
        
        setRoutineSuccessTitle(lang === 'bn' ? 'রুটিন মুছে ফেলা হয়েছে' : 'Routine Deleted');
        setRoutineSuccessMessage(lang === 'bn' ? 'রুটিনটি সফলভাবে মুছে ফেলা হয়েছে।' : 'Routine has been successfully deleted.');
        setRoutineModalMode('success');
        setShowRoutineSuccessModal(true);
      } catch (err) {
        console.error('Error deleting routine:', err);
      }
    });
  };

  const loadRoutineFromDB = (routine: any) => {
    setIsRestoringRoutine(true);
    setEditingRoutineId(routine.id);
    setEditingRoutineName(routine.name || routine.customRoutineTitle || (lang === 'bn' ? 'বেফাক পরীক্ষার রুটিন' : 'Befaq Exam Routine'));

    if (routine.routineData) setRoutineData(routine.routineData);
    if (routine.routineInstructions) setRoutineInstructions(routine.routineInstructions);
    if (routine.routineMorningTime) setRoutineMorningTime(routine.routineMorningTime);
    if (routine.routineAfternoonTime) setRoutineAfternoonTime(routine.routineAfternoonTime);
    if (routine.routineThemeColor) setRoutineThemeColor(routine.routineThemeColor);
    if (routine.fontScale) setFontScale(routine.fontScale);
    if (routine.customRoutineTitle) setCustomRoutineTitle(routine.customRoutineTitle);
    else if (routine.activeExamName && routine.routineSelectionMode === 'all') setCustomRoutineTitle(routine.activeExamName);
    if (routine.routineStartDate) setRoutineStartDate(routine.routineStartDate);
    if (routine.showRoutineAfternoon !== undefined) setShowRoutineAfternoon(routine.showRoutineAfternoon);
    if (routine.routineSelectionMode) setRoutineSelectionMode(routine.routineSelectionMode);
    if (routine.selectedRoutineClassId) setSelectedRoutineClassId(routine.selectedRoutineClassId);
    
    // Additional fields for complete restore
    if (routine.routineMorningStart) setRoutineMorningStart(routine.routineMorningStart);
    if (routine.routineMorningEnd) setRoutineMorningEnd(routine.routineMorningEnd);
    if (routine.routineAfternoonStart) setRoutineAfternoonStart(routine.routineAfternoonStart);
    if (routine.routineAfternoonEnd) setRoutineAfternoonEnd(routine.routineAfternoonEnd);
    if (routine.routinePrincipalName) setRoutinePrincipalName(routine.routinePrincipalName);
    if (routine.routinePrincipalMobile) setRoutinePrincipalMobile(routine.routinePrincipalMobile);
    if (routine.selectedRoutineExamId) setSelectedRoutineExamId(routine.selectedRoutineExamId);
    if (routine.selectedRoutineAllExamIds) setSelectedRoutineAllExamIds(routine.selectedRoutineAllExamIds);
    if (routine.is_published !== undefined) setRoutineIsPublished(Boolean(routine.is_published));

    setRoutineSuccessTitle(lang === 'bn' ? 'রুটিন লোড হয়েছে' : 'Routine Loaded');
    setRoutineSuccessMessage(lang === 'bn' ? 'রুটিনটি সফলভাবে লোড করা হয়েছে। আপনি এখন এটি এডিট করতে পারেন।' : 'Routine has been loaded successfully. You can now edit it.');
    setRoutineModalMode('success');
    setShowRoutineSuccessModal(true);

    // Release the lock after a delay to ensure effects have finished triggering
    setTimeout(() => {
      setIsRestoringRoutine(false);
    }, 500);
  };

  const handleDownloadCustomExamRoutine = async () => {
    setIsDownloading(true);
    try {
      const isExamPostfixBn = activeExamName.endsWith('পরীক্ষা');
      const isExamPostfixEn = activeExamName.toLowerCase().endsWith('exam');
      const examTitle = lang === 'bn' 
        ? (isExamPostfixBn ? `${activeExamName} সময়সূচি` : `${activeExamName} পরীক্ষা সময়সূচি`)
        : (isExamPostfixEn ? `${activeExamName} Schedule` : `${activeExamName} Exam Schedule`);

      await generateExamRoutinePDF(
        {
          ...madrasah,
          phone: routinePrincipalMobile || madrasah?.phone || ''
        } as any, 
        examTitle, 
        routineData, 
        lang,
        {
          routineSelectionMode: routineSelectionMode as any,
          selectedRoutineClassId,
          classesList: routineDisplayClasses,
          routineMorningTime,
          routineAfternoonTime,
          routineInstructions,
          routinePrincipalName,
          routinePrincipalMobile,
          showRoutineAfternoon,
          examYear: currentYear,
          themeColor: routineThemeColor,
          fontScale: fontScale || 1.2
        },
        (p) => setDownloadProgress(p)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Dynamic module configuration
  const modules = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const configObj: any = (typeof config === 'object' && config !== null) ? config : {};
    
    return {
      attendance: configObj.modules?.attendance ?? true,
      results: configObj.modules?.results ?? true,
      admit_card: configObj.modules?.admit_card ?? true,
      seat_plan: configObj.modules?.seat_plan ?? true,
      accounting: configObj.modules?.accounting ?? true,
      academic_year_promotion: configObj.modules?.academic_year_promotion ?? false,
      voice_broadcast: configObj.modules?.voice_broadcast ?? true,
      sms: configObj.modules?.sms ?? true,
    };
  }, [madrasah]);

  // Admit Card States
  const [showAdmitCardModal, setShowAdmitCardModal] = useState(false);
  const [examForAdmitCard, setExamForAdmitCard] = useState<BefaqExam | null>(null);
  const [selectedAdmitCardTemplate, setSelectedAdmitCardTemplate] = useState('classic');

  // Seat Plan States
  const seatPlanTemplates = [
    { id: 'list', name: 'List View', description: 'Room-wise student list (Wall Posting)' },
    { id: 'grid', name: 'Grid View', description: 'Visual seat arrangement' }
  ];
  const [selectedSeatPlanTemplate, setSelectedSeatPlanTemplate] = useState('list');
  const [rooms, setRooms] = useState<ExamRoom[]>([{ id: '1', room_name: 'Room 101', capacity: 30 }]);
  const [seatAssignments, setSeatAssignments] = useState<SeatAssignment[]>([]);
  const [selectedClassesForSeatPlan, setSelectedClassesForSeatPlan] = useState<string[]>([]);

  useEffect(() => {
    if (selectedSeatPlanExamId) {
      const activeExam = exams.find(e => e.id === selectedSeatPlanExamId);
      if (activeExam) {
        const isClassSelected = selectedClassesForSeatPlan.includes(activeExam.marhala_id);
        if (selectedClassesForSeatPlan.length > 0 && !isClassSelected) {
          setSelectedSeatPlanExamId('');
        }
      }
    }
  }, [selectedClassesForSeatPlan, exams, selectedSeatPlanExamId]);
  const [seatPlanConfig, setSeatPlanConfig] = useState({
      randomize: false,
      template: 'list'
  });

  // Form states
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState(activeYear?.start_date ? activeYear.start_date.slice(0, 4) : new Date().getFullYear().toString());
  const [classId, setClassId] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [subName, setSubName] = useState('');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('33');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
    }
  }, [madrasah?.id]);

  useEffect(() => {
    if (madrasah && (selectedClassId || view !== 'list' || activeTab === 'seat-plan')) {
      fetchExams();
    }
  }, [madrasah?.id, selectedClassId, view, activeTab]);

  const fetchExams = async () => {
    const activeYearId = madrasah?.config_json?.active_academic_year_id;
    let query = supabase.from('befaq_exams').select('*, classes(class_name)').eq('institution_id', madrasah?.id);
    
    if (activeYearId) {
      query = query.eq('academic_year_id', activeYearId);
    } else {
      const yearStart = madrasah?.config_json?.academic_year_start;
      if (yearStart) {
        query = query.gte('created_at', yearStart);
      }
    }

    if (selectedClassId && activeTab !== 'seat-plan') {
      query = query.eq('marhala_id', selectedClassId);
    }

    let { data, error } = await query.order('created_at', { ascending: false });
    
    // If the academic_year_id column does not exist in the database, fallback to querying without it
    if (error && error.message && error.message.includes('academic_year_id')) {
      console.warn('Querying befaq_exams failed with academic_year_id, retrying without academic_year_id filter...');
      let fallbackQuery = supabase.from('befaq_exams').select('*, classes(class_name)').eq('institution_id', madrasah?.id);
      
      const yearStart = madrasah?.config_json?.academic_year_start;
      if (yearStart) {
        fallbackQuery = fallbackQuery.gte('created_at', yearStart);
      }
      
      if (selectedClassId && activeTab !== 'seat-plan') {
        fallbackQuery = fallbackQuery.eq('marhala_id', selectedClassId);
      }
      
      const retryResult = await fallbackQuery.order('created_at', { ascending: false });
      data = retryResult.data;
    }

    if (data) {
      let filteredExams = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredExams = data.filter(exam => profile.permissions?.allowed_classes?.includes(exam.marhala_id));
      }
      setExams(filteredExams);
    }
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes')
      .select('*')
      .eq('institution_id', madrasah?.id)
      .order('sort_order', { ascending: true });
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
    setLoading(false);
  };

  const fetchSubjects = async (examId: string) => {
    setLoading(true);
    const { data } = await supabase.from('befaq_subjects').select('*').eq('exam_id', examId).order('sort_order', { ascending: true });
    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchMarkEntryData = async (examId: string, classId: string) => {
    setLoading(true);
    const activeYearId = madrasah?.config_json?.active_academic_year_id;
    let studentQuery = supabase.from('students').select('*').eq('class_id', classId).order('roll', { ascending: true });
    if ((window as any)._hasIsActive !== false) {
      studentQuery = studentQuery.eq('is_active', true);
    }
    if (activeYearId) {
      studentQuery = studentQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
    }
    const { data: stds } = await studentQuery;
    const { data: marks } = await supabase.from('befaq_results').select('*').eq('exam_id', examId);
    
    if (stds) setStudents(stds);
    if (marks) {
        const initialMarks: any = {};
        marks.forEach(m => {
            if (!initialMarks[m.student_id]) initialMarks[m.student_id] = {};
            initialMarks[m.student_id][m.subject_id] = m.marks_obtained;
        });
        setMarksData(initialMarks);
    }
    setLoading(false);
  };

  const handleDownloadAdmitCard = (exam: BefaqExam) => {
      setExamForAdmitCard(exam);
      setShowAdmitCardModal(true);
  };

  const confirmDownloadAdmitCard = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!madrasah || !examForAdmitCard) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
        // Fetch students for the exam class
        const { data: stds } = await supabase.from('students')
          .select('*, classes(class_name)')
          .eq('class_id', examForAdmitCard.marhala_id)
          .eq('is_active', true)
          .order('roll', { ascending: true });
        
        if (!stds || stds.length === 0) {
            alert('No students found for this class');
            setIsDownloading(false);
            return;
        }

        await generateAdmitCardPDF(
            examForAdmitCard,
            stds,
            { name: madrasah.name, logo_url: madrasah.logo_url, config_json: madrasah.config_json, institution_type: madrasah.institution_type, address: madrasah.address, phone: madrasah.phone, contact_email: madrasah.contact_email },
            selectedAdmitCardTemplate,
            downloadLang,
            (p) => setDownloadProgress(p)
        );
        setShowAdmitCardModal(false);
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading Admit Cards');
    } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
    }
  };

  const handleGenerateSeatPlan = async () => {
      if (selectedClassesForSeatPlan.length === 0) {
          alert('Please select at least one class');
          return;
      }
      
      setLoading(true);
      // Fetch students from selected classes
      const { data: stds } = await supabase.from('students')
        .select('*, classes(class_name)')
        .in('class_id', selectedClassesForSeatPlan)
        .eq('is_active', true)
        .order('class_id', { ascending: true })
        .order('roll', { ascending: true });
        
      if (!stds || stds.length === 0) {
          setLoading(false);
          alert('No students found');
          return;
      }

      let studentsToAssign = [...stds];
      if (seatPlanConfig.randomize) {
          // Fisher-Yates shuffle for true randomness
          for (let i = studentsToAssign.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [studentsToAssign[i], studentsToAssign[j]] = [studentsToAssign[j], studentsToAssign[i]];
          }
      }

      const assignments: SeatAssignment[] = [];
      let currentRoomIndex = 0;
      let currentSeat = 1;

      for (const student of studentsToAssign) {
          if (currentRoomIndex >= rooms.length) break; // No more rooms

          const room = rooms[currentRoomIndex];
          
          assignments.push({
              student_id: student.id,
              student_name: student.student_name,
              class_name: student.classes?.class_name || '',
              roll: student.roll || 0,
              room_name: room.room_name,
              seat_number: currentSeat
          });

          currentSeat++;
          if (currentSeat > room.capacity) {
              currentRoomIndex++;
              currentSeat = 1;
          }
      }

      setSeatAssignments(assignments);
      setLoading(false);
  };

  const handleDownloadSeatPlan = async (downloadLang: 'en' | 'bn' = lang) => {
      if (seatAssignments.length === 0 || !madrasah) return;
      setIsDownloading(true);
      setDownloadProgress(0);
      try {
          const seatPlanExamName = exams.find(e => e.id === selectedSeatPlanExamId)?.exam_name || '';
          await generateSeatPlanPDF(
            seatAssignments, 
            madrasah, 
            selectedSeatPlanTemplate, 
            downloadLang, 
            seatPlanExamName,
            (p) => setDownloadProgress(p)
          );
      } catch (error) {
          console.error('Download error:', error);
          alert('Error downloading Seat Plan');
      } finally {
          setIsDownloading(false);
          setDownloadProgress(0);
      }
  };

  const handleAddExam = async () => {
    if (!madrasah || !examName || !classId) {
        alert('Please fill all fields');
        return;
    }
    setIsSaving(true);
    try {
        const activeYearId = activeYear?.id || madrasah.config_json?.active_academic_year_id;
        
        // Validate UUID format for academic_year_id
        const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const examData: any = {
          institution_id: madrasah.id,
          academic_year_id: (activeYearId && isValidUUID(activeYearId)) ? activeYearId : null,
          marhala_id: classId,
          class_name: classes.find(c => c.id === classId)?.class_name || '',
          exam_name: examName,
          exam_year: examYear,
          is_published: isPublished,
          is_active: true
        };

        let error;
        if (editingExam) {
          const { error: updateError } = await supabase
            .from('befaq_exams')
            .update(examData)
            .eq('id', editingExam.id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('befaq_exams')
            .insert(examData);
          error = insertError;
        }
        
        // If error is because is_published column does not exist, retry without it
        if (error && error.message && error.message.includes('is_published') && (error.message.includes('column') || error.message.includes('not exist') || error.message.includes('Could not find'))) {
          console.warn('Column is_published does not exist in befaq_exams table, retrying without it...');
          const retryData = { ...examData };
          delete retryData.is_published;
          if (editingExam) {
            const { error: retryError } = await supabase.from('befaq_exams').update(retryData).eq('id', editingExam.id);
            error = retryError;
          } else {
            const { error: retryError } = await supabase.from('befaq_exams').insert(retryData);
            error = retryError;
          }
          if (!error) {
            alert(lang === 'bn'
              ? 'পরীক্ষাটি সংরক্ষিত হয়েছে, তবে ফলাফল প্রকাশ অপশনটি সচল করতে দয়া করে Supabase SQL Editor এ src/services/migration_add_is_published_to_befaq_exams.sql স্ক্রিপ্টটি রান করুন।'
              : 'Exam saved, but to enable results publishing, please run the src/services/migration_add_is_published_to_befaq_exams.sql script in your Supabase SQL Editor.');
          }
        }

        // If error is because academic_year_id column does not exist at all, retry without academic_year_id property
        if (error && error.message && error.message.includes('academic_year_id') && (error.message.includes('Could not find') || error.message.includes('not exist') || error.message.includes('column'))) {
          console.warn('Column academic_year_id does not exist in befaq_exams table, retrying without it...');
          const retryData = { ...examData };
          delete retryData.academic_year_id;
          if (editingExam) {
            const { error: retryError } = await supabase.from('befaq_exams').update(retryData).eq('id', editingExam.id);
            error = retryError;
          } else {
            const { error: retryError } = await supabase.from('befaq_exams').insert(retryData);
            error = retryError;
          }
        }
        
        // If still getting foreign key error, retry with null academic_year_id
        if (error && error.message && error.message.includes('foreign key constraint')) {
          console.warn('Foreign key violation for academic_year_id in befaq_exams, retrying with null...');
          const retryData = { ...examData, academic_year_id: null };
          if (editingExam) {
            const { error: retryError } = await supabase.from('befaq_exams').update(retryData).eq('id', editingExam.id);
            error = retryError;
          } else {
            const { error: retryError } = await supabase.from('befaq_exams').insert(retryData);
            error = retryError;
          }
        }
        
        if (error) {
            console.error('Error saving exam:', error);
            if (error.message.includes('academic_year_id') && (error.message.includes('Could not find') || error.message.includes('not exist') || error.message.includes('column'))) {
              // Try to do one more fallback by saving completely without academic_year_id to avoid blocking the user
              console.warn('Database error on academic_year_id, attempting last-resort save without it...');
              const finalRetryData = { ...examData };
              delete finalRetryData.academic_year_id;
              let finalError;
              if (editingExam) {
                const { error: finalRetryError } = await supabase.from('befaq_exams').update(finalRetryData).eq('id', editingExam.id);
                finalError = finalRetryError;
              } else {
                const { error: finalRetryError } = await supabase.from('befaq_exams').insert(finalRetryData);
                finalError = finalRetryError;
              }
              if (!finalError) {
                error = null;
              } else {
                alert(lang === 'bn' 
                  ? 'ডাটাবেস আপডেট প্রয়োজন: দয়া করে Supabase SQL Editor এ src/services/migration_fix_befaq_academic_year.sql স্ক্রিপ্টটি রান করুন।' 
                  : 'Database update required: Please run the src/services/migration_fix_befaq_academic_year.sql script in your Supabase SQL Editor.');
              }
            } else if (error.message.includes('row-level security')) {
              alert('Permission denied: You do not have permission to add exams. Please run the SQL migration script.');
            } else {
              alert('Failed to save exam: ' + error.message);
            }
        } else {
          setShowAddExam(false);
          setEditingExam(null);
          setExamName('');
          setClassId('');
          setIsPublished(false);
          fetchExams();
        }
    } catch (e) {
        console.error('Unexpected error:', e);
        alert('An unexpected error occurred');
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditClick = (exam: BefaqExam) => {
    setEditingExam(exam);
    setExamName(exam.exam_name || '');
    setExamYear(exam.exam_year || '');
    setClassId(exam.marhala_id || '');
    setIsPublished(exam.is_published || false);
    setShowAddExam(true);
  };

  const handleDeleteExam = async (examId: string) => {
    setIsSaving(true);
    try {
      // Delete results first (if no cascade)
      await supabase.from('befaq_results').delete().eq('exam_id', examId);
      // Delete subjects
      await supabase.from('befaq_subjects').delete().eq('exam_id', examId);
      // Delete exam
      const { error } = await supabase.from('befaq_exams').delete().eq('id', examId);
      
      if (error) {
        console.error('Error deleting exam:', error);
        alert('Failed to delete exam: ' + error.message);
      } else {
        fetchExams();
      }
    } catch (e) {
      console.error('Unexpected error:', e);
      alert('An unexpected error occurred');
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
      setExamToDelete(null);
    }
  };

  const handleAddSubject = async () => {
    if (!selectedExam || !subName) {
        alert('Please fill all fields');
        return;
    }
    setIsSaving(true);
    try {
        const subjectData = {
          exam_id: selectedExam.id,
          class_name: selectedExam.classes?.class_name || 'Unknown',
          subject_name: subName,
          total_marks: parseInt(totalMarks),
          passing_marks: parseInt(passingMarks),
          sort_order: parseInt(sortOrder) || 0
        };

        let error;
        if (editingSubject) {
          const { error: updateError } = await supabase
            .from('befaq_subjects')
            .update(subjectData)
            .eq('id', editingSubject.id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('befaq_subjects')
            .insert(subjectData);
          error = insertError;
        }
        
        if (error) {
            console.error('Error saving subject:', error);
            alert('Failed to save subject: ' + error.message);
        } else {
          setShowAddSubject(false);
          setEditingSubject(null);
          setSubName('');
          setSortOrder('0');
          fetchSubjects(selectedExam.id);
        }
    } catch (e) {
        console.error('Unexpected error:', e);
        alert('An unexpected error occurred');
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditSubjectClick = (subject: BefaqSubject) => {
    setEditingSubject(subject);
    setSubName(subject.subject_name || '');
    setTotalMarks(subject.total_marks?.toString() || '100');
    setPassingMarks(subject.passing_marks?.toString() || '33');
    setSortOrder(subject.sort_order?.toString() || '0');
    setShowAddSubject(true);
  };

  const handleDeleteSubject = (subjectId: string) => {
    setSubjectToDelete(subjectId);
    setShowDeleteSubjectConfirm(true);
  };

  const handleCopySubjects = async () => {
    if (!selectedExam || !madrasah) return;
    setIsSaving(true);

    try {
      // Find previous exams for the same class
      const activeYearId = madrasah?.config_json?.active_academic_year_id;
      let query = supabase.from('befaq_exams')
        .select('id, exam_name')
        .eq('institution_id', madrasah.id)
        .eq('marhala_id', selectedExam.marhala_id)
        .neq('id', selectedExam.id);

      if (activeYearId) {
        query = query.eq('academic_year_id', activeYearId);
      }

      const { data: prevExams, error: examsError } = await query.order('created_at', { ascending: false });

      if (examsError) throw examsError;
      if (!prevExams || prevExams.length === 0) {
        alert(lang === 'bn' ? 'আগের কোনো পরীক্ষা পাওয়া যায়নি' : 'No previous exams found for this marhala');
        setIsSaving(false);
        return;
      }

      const lastExamId = prevExams[0].id;

      const { data: prevSubjects, error: subjectsError } = await supabase
        .from('befaq_subjects')
        .select('*')
        .eq('exam_id', lastExamId)
        .order('sort_order', { ascending: true });

      if (subjectsError) throw subjectsError;
      if (!prevSubjects || prevSubjects.length === 0) {
        alert(lang === 'bn' ? 'আগের পরীক্ষায় কোনো কিতাব পাওয়া যায়নি' : 'No subjects found in the previous exam');
        setIsSaving(false);
        return;
      }

      const newSubjects = prevSubjects.map(s => ({
        exam_id: selectedExam.id,
        subject_name: s.subject_name,
        total_marks: s.total_marks,
        passing_marks: s.passing_marks,
        sort_order: s.sort_order || 0
      }));

      const { error: insertError } = await supabase
        .from('befaq_subjects')
        .insert(newSubjects);

      if (insertError) throw insertError;

      fetchSubjects(selectedExam.id);
      
      setRoutineSuccessTitle(lang === 'bn' ? 'সফল হয়েছে' : 'Success');
      setRoutineSuccessMessage(lang === 'bn' ? 'আগের পরীক্ষা থেকে বিষয়গুলো কপি করা হয়েছে।' : 'Subjects have been copied from the previous exam.');
      setRoutineModalMode('success');
      setShowRoutineSuccessModal(true);
    } catch (err: any) {
      console.error('Error copying subjects:', err);
      alert('Failed to copy subjects: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setIsSaving(true);
    const { error } = await supabase.from('befaq_subjects').delete().eq('id', subjectToDelete);
    if (!error && selectedExam) {
      fetchSubjects(selectedExam.id);
    } else if (error) {
       console.error("Error deleting subject", error);
       alert(lang === 'bn' ? "কিতাবটি ডিলিট করা সম্ভব হয়নি।" : "Failed to delete subject.");
    }
    setIsSaving(false);
    setShowDeleteSubjectConfirm(false);
    setSubjectToDelete(null);
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setIsSaving(true);
    const payload: any[] = [];
    const toDelete: { student_id: string; subject_id: string }[] = [];

    Object.entries(marksData).forEach(([studentId, subMarks]: any) => {
        Object.entries(subMarks).forEach(([subjectId, marks]) => {
            if (marks !== undefined && marks !== null && marks !== '') {
                payload.push({
                    exam_id: selectedExam.id,
                    student_id: studentId,
                    subject_id: subjectId,
                    marks_obtained: parseFloat(marks as string)
                });
            } else {
                toDelete.push({
                    student_id: studentId,
                    subject_id: subjectId
                });
            }
        });
    });

    // Validate that no marks exceed the subject's total_marks
    for (const item of payload) {
        const sub = subjects.find(s => s.id === item.subject_id);
        if (sub && item.marks_obtained > sub.total_marks) {
            alert(lang === 'bn' ? `${sub.subject_name} বিষয়ের প্রাপ্ত নম্বর পূর্ণ নম্বর (${sub.total_marks}) এর বেশি হতে পারে না!` : `Obtained marks for ${sub.subject_name} cannot exceed full marks (${sub.total_marks})!`);
            setIsSaving(false);
            return;
        }
    }

    // Delete cleared/deleted marks first
    if (toDelete.length > 0) {
        const deletePromises = toDelete.map((item) => {
            return supabase.from('befaq_results')
                .delete()
                .eq('exam_id', selectedExam.id)
                .eq('student_id', item.student_id)
                .eq('subject_id', item.subject_id);
        });
        try {
            await Promise.all(deletePromises);
        } catch (delErr) {
            console.error("Error deleting cleared marks:", delErr);
        }
    }

    // We use a robust delete-and-insert strategy for each row to ensure it works
    // perfectly even if the unique constraint is missing on the database.
    // By using Promise.all, we perform these in parallel for maximum performance.
    const savePromises = payload.map(async (row) => {
        // Delete existing entry if any
        await supabase.from('befaq_results')
            .delete()
            .eq('exam_id', row.exam_id)
            .eq('student_id', row.student_id)
            .eq('subject_id', row.subject_id);

        // Insert new entry
        return supabase.from('befaq_results').insert(row);
    });

    try {
        const results = await Promise.all(savePromises);
        const firstError = results.find(r => r.error);
        if (firstError) {
            console.error("Error saving marks:", firstError.error);
            alert("Error saving marks: " + firstError.error.message);
            setIsSaving(false);
            return;
        }
    } catch (err: any) {
        console.error("Error saving marks:", err);
        alert("Error saving marks: " + (err.message || err));
        setIsSaving(false);
        return;
    }
    setShowSuccessModal(true);
    setIsSaving(false);
  };

  const getDivision = (totalMarks: number, totalPossible: number) => {
    if (totalPossible === 0) return 'N/A';
    const percentage = (totalMarks / totalPossible) * 100;
    
    if (percentage >= 80) return 'মুমতাজ';
    if (percentage >= 65) return 'জায়্যিদ জিদ্দান';
    if (percentage >= 50) return 'জায়্যিদ';
    if (percentage >= 40) return 'মকবুল';
    return 'রাসিব';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {isDownloading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle 
                  className="text-slate-100 dark:text-slate-800" 
                  strokeWidth="8" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="42" 
                  cx="50" 
                  cy="50" 
                />
                <circle 
                  className="text-blue-600 transition-all duration-300 ease-out" 
                  strokeWidth="8" 
                  strokeDasharray={263.89} 
                  strokeDashoffset={263.89 * (1 - downloadProgress / 100)} 
                  strokeLinecap="round" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="42" 
                  cx="50" 
                  cy="50" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-black text-xl dark:text-white">
                {downloadProgress}%
              </div>
            </div>
            <h3 className="text-xl font-black mb-2 dark:text-white">
              {lang === 'bn' ? 'ফাইল তৈরি হচ্ছে...' : 'Generating File...'}
            </h3>
            <p className="text-slate-500 text-sm">
              {lang === 'bn' ? 'দয়া করে কিছুক্ষণ অপেক্ষা করুন।' : 'Please wait while we prepare your document.'}
            </p>
          </div>
        </div>
      )}
      {activeTab !== 'final-results' && (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? (selectedClassId ? () => setSelectedClassId(null) : onBack) : () => setView('list')} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
            <ArrowLeft size={20}/>
          </button>
          <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>
            {activeTab === 'exams' && view === 'list' ? (selectedClassId ? classes.find(c => c.id === selectedClassId)?.class_name : 'বেফাক পরীক্ষা') : 
             activeTab === 'exams' && selectedExam ? selectedExam.exam_name :
             activeTab === 'seat-plan' ? (lang === 'bn' ? 'আসন বিন্যাস' : 'Seat Plan') :
             activeTab === 'analytics' ? (lang === 'bn' ? 'ফলাফল অ্যানালিটিক্স' : 'Result Analytics') : 
             activeTab === 'exam-routine' ? (lang === 'bn' ? 'পরীক্ষার রুটিন' : 'Exam Routine') : 'বেফাক পরীক্ষা'}
          </h1>
        </div>
        {activeTab === 'exams' && view === 'list' && role === 'madrasah_admin' && (
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('final-results')} className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${madrasah?.theme === 'dark' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-600 border-purple-100'}`} title="চূড়ান্ত ফলাফল">
                  <Trophy size={20} />
                </button>
                {selectedClassId && (
                  <button onClick={() => { setClassId(selectedClassId); setShowAddExam(true); }} className="w-10 h-10 bg-emerald-600 text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
                )}
            </div>
        )}
      </div>
      )}

      {activeTab !== 'final-results' && (
      <div className={`flex p-1.5 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'} rounded-[1.5rem] border overflow-x-auto no-scrollbar`}>
        <button onClick={() => setActiveTab('exams')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'exams' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
            {t('exams', lang)}
        </button>
        {modules.seat_plan && (
          <button onClick={() => setActiveTab('seat-plan')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'seat-plan' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
              {lang === 'bn' ? 'আসন বিন্যাস' : 'Seat Plan'}
          </button>
        )}
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'analytics' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
            {lang === 'bn' ? 'অ্যানালিটিক্স' : 'Analytics'}
        </button>
        <button onClick={() => setActiveTab('exam-routine')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'exam-routine' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
            {lang === 'bn' ? 'রুটিন' : 'Routine'}
        </button>
      </div>
      )}

      {activeTab === 'final-results' && (
          <FinalResults lang={lang} madrasah={madrasah} role={role} onBack={() => setActiveTab('exams')} />
      )}

      {activeTab === 'analytics' && madrasah && (
        <SmartResultAnalytics institutionId={madrasah.id} lang={lang} madrasah={madrasah} />
      )}


      {activeTab === 'exam-routine' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Control Panel Column */}
            <div className="space-y-6">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] border shadow-bubble space-y-6`}>
                <h3 className={`text-base font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>
                  {lang === 'bn' ? 'রুটিন কনফিগারেশন' : 'Routine Configuration'}
                </h3>

                {/* Active Editing Notification Banner */}
                {editingRoutineId && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-center justify-between gap-2 shadow-xs mt-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <Edit3 size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider font-noto">
                          {lang === 'bn' ? 'এডিট মোড সক্রিয়' : 'Editing Mode Active'}
                        </p>
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300 truncate max-w-[160px] sm:max-w-[180px]">
                          {editingRoutineName || customRoutineTitle || (lang === 'bn' ? 'রুটিন' : 'Routine')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateNewRoutine}
                      className="text-[10px] font-black bg-white dark:bg-slate-800 hover:bg-amber-100 text-amber-800 dark:text-amber-200 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-700 shadow-xs transition-colors shrink-0 whitespace-nowrap"
                    >
                      {lang === 'bn' ? '+ নতুন তৈরি' : '+ New'}
                    </button>
                  </div>
                )}

                <div className="space-y-4 font-noto">
                  {/* Selection Mode Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'রুটিনের ধরণ' : 'Routine Type'}</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setRoutineSelectionMode('all')}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all ${routineSelectionMode === 'all' ? 'bg-[#013c28] text-white shadow' : 'text-slate-500'}`}
                      >
                        {lang === 'bn' ? 'মাস্টার রুটিন' : 'Master'}
                      </button>
                      <button 
                        onClick={() => setRoutineSelectionMode('class')}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all ${routineSelectionMode === 'class' ? 'bg-[#013c28] text-white shadow' : 'text-slate-500'}`}
                      >
                        {lang === 'bn' ? 'সিঙ্গেল ক্লাস' : 'Single Class'}
                      </button>
                      <button 
                        onClick={() => setRoutineSelectionMode('saved')}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all ${routineSelectionMode === 'saved' ? 'bg-[#013c28] text-white shadow' : 'text-slate-500'}`}
                      >
                        {lang === 'bn' ? 'সেভ করা' : 'Saved'}
                      </button>
                    </div>
                  </div>

                  {routineSelectionMode !== 'saved' && (
                    <>
                      {/* Theme Palette Choice */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Palette size={12} className="text-[#013c28]" />
                          {lang === 'bn' ? 'থিম কালার' : 'Theme Color'}
                        </label>
                        <div className="flex gap-2">
                          {Object.keys(routineThemes).map((color) => {
                            const tc = routineThemes[color as keyof typeof routineThemes];
                            return (
                              <button
                                key={color}
                                onClick={() => setRoutineThemeColor(color)}
                                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center`}
                                style={{ 
                                  backgroundColor: tc.primary,
                                  borderColor: routineThemeColor === color ? '#000000' : 'transparent'
                                }}
                                title={color}
                              >
                                {routineThemeColor === color && <span className="text-white text-[10px]">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Routine Title input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরীক্ষার নাম (কাস্টম)' : 'Exam Name (Custom)'}</label>
                        <input 
                          type="text" 
                          value={customRoutineTitle} 
                          onChange={e => setCustomRoutineTitle(e.target.value)} 
                          className={`w-full py-2 px-3 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} outline-none focus:border-emerald-500`}
                          placeholder={lang === 'bn' ? 'যেমনঃ বেফাক পরীক্ষা' : 'e.g. Befaq Exam'}
                        />
                      </div>

                      {/* Font Scale Selection */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Type size={12} className="text-emerald-600" />
                            {lang === 'bn' ? 'ফন্ট সাইজ' : 'Font Size'}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600">
                            {fontScale === 1.0 ? (lang === 'bn' ? 'স্বাভাবিক' : 'Normal') : fontScale === 1.2 ? (lang === 'bn' ? 'বড়' : 'Large') : (lang === 'bn' ? 'অনেক বড়' : 'Extra Large')}
                          </span>
                        </label>
                        <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                          <button
                            type="button"
                            onClick={() => setFontScale(1.0)}
                            className={`h-8 rounded-lg text-[10px] font-black tracking-wider transition-all flex items-center justify-center ${fontScale === 1.0 ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {lang === 'bn' ? 'স্বাভাবিক' : 'Normal'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFontScale(1.2)}
                            className={`h-8 rounded-lg text-[10px] font-black tracking-wider transition-all flex items-center justify-center ${fontScale === 1.2 ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {lang === 'bn' ? 'বড়' : 'Large'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFontScale(1.4)}
                            className={`h-8 rounded-lg text-[10px] font-black tracking-wider transition-all flex items-center justify-center ${fontScale === 1.4 ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {lang === 'bn' ? 'অনেক বড়' : 'Extra Large'}
                          </button>
                        </div>
                      </div>

                      {routineSelectionMode === 'class' && (
                        <div className="space-y-4 animate-fadeIn">
                          {/* Class Selector */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ক্লাস নির্বাচন' : 'Select Class'}</label>
                            <select 
                              value={selectedRoutineClassId} 
                              onChange={e => setSelectedRoutineClassId(e.target.value)}
                              className={`w-full py-2 px-3 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} outline-none`}
                            >
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.class_name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Filter Single Exam if multiple matches found */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরীক্ষা নির্বাচন (ঐচ্ছিক)' : 'Select Exam (Optional)'}</label>
                            <select 
                              value={selectedRoutineExamId} 
                              onChange={e => setSelectedRoutineExamId(e.target.value)}
                              className={`w-full py-2 px-3 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} outline-none`}
                            >
                              <option value="">{lang === 'bn' ? 'মাস্টার রুটিন সাবজেক্টসমূহ' : 'Master Routine Subjects'}</option>
                              {exams.filter(e => e.marhala_id === selectedRoutineClassId).map(e => (
                                <option key={e.id} value={e.id}>{e.exam_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {routineSelectionMode === 'all' && (
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'রুটিনে অন্তর্ভুক্ত ক্লাস সমূহ' : 'Include Classes in Routine'}</label>
                          <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-xl max-h-[140px] overflow-y-auto bg-slate-50">
                            {exams.length > 0 ? (
                              exams.map(e => {
                                const cls = classes.find(c => c.id === e.marhala_id);
                                if (!cls) return null;
                                const isChecked = selectedRoutineAllExamIds.includes(e.id);
                                return (
                                  <button
                                    key={e.id}
                                    onClick={() => {
                                      if (isChecked) {
                                        setSelectedRoutineAllExamIds(prev => prev.filter(id => id !== e.id));
                                      } else {
                                        setSelectedRoutineAllExamIds(prev => [...prev, e.id]);
                                      }
                                    }}
                                    className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isChecked ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                                  >
                                    {cls.class_name} ({e.exam_name})
                                  </button>
                                );
                              })
                            ) : (
                              <p className="text-[10px] font-bold text-slate-400 p-2">{lang === 'bn' ? 'কোনো পরীক্ষা পাওয়া যায়নি' : 'No exams found'}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Principal Info */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'স্বাক্ষরকারীর নাম' : 'Signatory Name'}</label>
                          <input 
                            type="text" 
                            value={routinePrincipalName} 
                            onChange={e => setRoutinePrincipalName(e.target.value)} 
                            className={`w-full py-2 px-3 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} outline-none`}
                            placeholder={lang === 'bn' ? 'যেমনঃ মুহতামিম' : 'e.g. Principal'}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'স্বাক্ষরকারী মোবাইল' : 'Signatory Mobile'}</label>
                          <input 
                            type="text" 
                            value={routinePrincipalMobile} 
                            onChange={e => setRoutinePrincipalMobile(e.target.value)} 
                            className={`w-full py-2 px-3 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} outline-none`}
                            placeholder="017XXXXXXXX"
                          />
                        </div>
                      </div>

                      {/* Start Date */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                           <Calendar size={12} className="text-emerald-600" />
                           {lang === 'bn' ? 'পরীক্ষা শুরুর তারিখ' : 'Exam Start Date'}
                        </label>
                        <input 
                          type="date" 
                          value={routineStartDate} 
                          onChange={e => setRoutineStartDate(e.target.value)} 
                          className={`w-full py-2 px-3 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} outline-none focus:border-emerald-500 transition-all`}
                        />
                      </div>

                      {/* Morning Shift */}
                      <div className="space-y-2 p-3 rounded-xl border border-dashed border-slate-200">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Clock size={12} className="text-emerald-600" />
                           {lang === 'bn' ? 'সকালের সময়সূচি' : 'Morning Shift Time'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400">{lang === 'bn' ? 'শুরু' : 'Start'}</span>
                            <input 
                              type="time" 
                              value={routineMorningStart} 
                              onChange={e => setRoutineMorningStart(e.target.value)} 
                              className={`w-full py-1.5 px-2 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} outline-none focus:border-emerald-500`}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400">{lang === 'bn' ? 'শেষ' : 'End'}</span>
                            <input 
                              type="time" 
                              value={routineMorningEnd} 
                              onChange={e => setRoutineMorningEnd(e.target.value)} 
                              className={`w-full py-1.5 px-2 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} outline-none focus:border-emerald-500`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Afternoon Shift Toggle & Time */}
                      <div className="space-y-3 p-3 rounded-xl border border-dashed border-slate-200">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Clock size={12} className="text-blue-600" />
                             {lang === 'bn' ? '稳কালের সময়সূচি' : 'Afternoon Shift'}
                          </label>
                          <button 
                            onClick={() => setShowRoutineAfternoon(!showRoutineAfternoon)}
                            className={`w-8 h-4 rounded-full relative transition-colors ${showRoutineAfternoon ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showRoutineAfternoon ? 'left-4' : 'left-0.5'}`} />
                          </button>
                        </div>

                        {showRoutineAfternoon && (
                          <div className="grid grid-cols-2 gap-2 pt-1 animate-fadeIn">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400">{lang === 'bn' ? 'শুরু' : 'Start'}</span>
                              <input 
                                type="time" 
                                value={routineAfternoonStart} 
                                onChange={e => setRoutineAfternoonStart(e.target.value)} 
                                className={`w-full py-1.5 px-2 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} outline-none focus:border-blue-500`}
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400">{lang === 'bn' ? 'শেষ' : 'End'}</span>
                              <input 
                                type="time" 
                                value={routineAfternoonEnd} 
                                onChange={e => setRoutineAfternoonEnd(e.target.value)} 
                                className={`w-full py-1.5 px-2 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} outline-none focus:border-blue-500`}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add Row Button */}
                      <button
                        onClick={handleAddRoutineDay}
                        className="w-full py-3 px-4 rounded-xl text-xs font-black bg-[#013c28] text-white shadow-lg hover:bg-[#02261a] transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        {lang === 'bn' ? 'আরও একটি দিন যোগ করুন' : 'Add Another Exam Day'}
                      </button>

                      {/* Special Instructions List Editor */}
                      <div className="space-y-3 pt-2 border-t border-dashed border-slate-200/50">
                        <div className="flex justify-between items-center font-noto">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}</label>
                          <button 
                            onClick={() => setRoutineInstructions(prev => [...prev, ''])}
                            className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Plus size={12} /> {lang === 'bn' ? 'যুক্ত করুন' : 'Add'}
                          </button>
                        </div>
                        <div className="space-y-2 max-h-[130px] overflow-y-auto pr-1">
                          {routineInstructions.map((inst, index) => (
                            <div key={index} className="flex gap-2">
                              <input 
                                type="text" 
                                value={inst} 
                                onChange={e => {
                                  const updated = [...routineInstructions];
                                  updated[index] = e.target.value;
                                  setRoutineInstructions(updated);
                                }} 
                                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} outline-none`}
                                placeholder={lang === 'bn' ? `নির্দেশনা ${index+1}` : `Instruction ${index+1}`}
                              />
                              <button 
                                onClick={() => setRoutineInstructions(prev => prev.filter((_, i) => i !== index))}
                                className="w-8 h-8 rounded-lg bg-red-50 text-red-500 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Published Option Toggle */}
                      <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${routineIsPublished ? (madrasah?.theme === 'dark' ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-emerald-50/70 border-emerald-200') : (madrasah?.theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200')}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${routineIsPublished ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                            <Globe size={16} />
                          </div>
                          <div>
                            <p className={`text-xs font-black ${routineIsPublished ? (madrasah?.theme === 'dark' ? 'text-emerald-300' : 'text-emerald-800') : (madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700')}`}>
                              {lang === 'bn' ? 'পাবলিশ করুন (Published)' : 'Publish to Parent Portal'}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400">
                              {lang === 'bn' ? 'অন থাকলে অভিভাবকরা প্যারেন্ট পোর্টালে রুটিন দেখতে পাবেন' : 'Visible to parents in their portal'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRoutineIsPublished(prev => !prev)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${routineIsPublished ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${routineIsPublished ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Master Action Button */}
                      <button 
                        onClick={handleDownloadCustomExamRoutine}
                        disabled={isDownloading}
                        className="w-full h-11 bg-[#013c28] hover:bg-[#02261a] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-premium active:scale-95 transition-all disabled:opacity-50 font-noto"
                      >
                        {isDownloading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                        {lang === 'bn' ? 'পিডিএফ ডাউনলোড করুন' : 'Download Printable PDF'}
                      </button>
                    </>
                  )}

                  {/* Content for Saved tab */}
                  {routineSelectionMode === 'saved' && (
                    <div className="space-y-4 pt-2 border-t border-dashed border-slate-200/50 animate-fadeIn">
                      {/* Saved Routines List */}
                      {savedRoutines.length > 0 ? (
                        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                            {lang === 'bn' ? 'সেভ করা রুটিন সমূহ' : 'Saved Routines'}
                          </h4>
                          <div className="space-y-2">
                            {savedRoutines.map((r, i) => {
                              const isCurrentEditing = r.id === editingRoutineId;
                              return (
                                <div 
                                  key={r.id || i} 
                                  className={`flex flex-col gap-3.5 p-4 sm:p-5 rounded-2xl border transition-all shadow-sm ${
                                    isCurrentEditing 
                                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/50' 
                                      : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                  }`}
                                >
                            {/* Card Header & Controls (Same line on mobile & desktop) */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <h5 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 font-noto truncate" title={r.name}>
                                    {r.name}
                                  </h5>
                                  {isCurrentEditing && (
                                    <span className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 shadow-xs">
                                      <Edit3 size={9} /> <span className="hidden xs:inline">{lang === 'bn' ? 'এডিট হচ্ছে' : 'Editing'}</span>
                                    </span>
                                  )}
                                </div>

                                {/* Right Controls: Status, Publish Toggle, Delete */}
                                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                  <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black border ${
                                    r.is_published !== false 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300' 
                                      : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${r.is_published !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                                    <span>{r.is_published !== false ? (lang === 'bn' ? 'পাবলিশড' : 'Published') : (lang === 'bn' ? 'ড্রাফট' : 'Draft')}</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => toggleRoutinePublish(r.id, r.is_published !== false)}
                                    className={`text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border transition-all flex items-center gap-1 shadow-xs ${
                                      r.is_published !== false
                                        ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                    }`}
                                    title={r.is_published !== false ? (lang === 'bn' ? 'প্যারেন্ট পোর্টাল থেকে হাইড করুন' : 'Hide from parent portal') : (lang === 'bn' ? 'প্যারেন্ট পোর্টালে পাবলিশ করুন' : 'Publish to parent portal')}
                                  >
                                    {r.is_published !== false ? <EyeOff size={11} /> : <Eye size={11} />}
                                    <span className="hidden sm:inline">{r.is_published !== false ? (lang === 'bn' ? 'আনপাবলিশ' : 'Unpublish') : (lang === 'bn' ? 'পাবলিশ' : 'Publish')}</span>
                                  </button>

                                  <button 
                                    onClick={() => deleteRoutineFromDB(r.id)}
                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/50 border border-red-100 dark:border-red-900/50 flex items-center justify-center transition-colors shadow-xs"
                                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium font-noto flex-wrap">
                                <span>
                                  {new Date(r.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </span>
                                <span>•</span>
                                <span className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold">
                                  {r.routineSelectionMode === 'all' ? (lang === 'bn' ? 'মাস্টার রুটিন' : 'Master Routine') : (lang === 'bn' ? 'সিঙ্গেল ক্লাস' : 'Single Class')}
                                </span>
                                {r.updatedAt && r.updatedAt !== r.createdAt && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-bold text-[9px] sm:text-[10px]">
                                      {lang === 'bn' ? 'আপডেট:' : 'Updated:'} {new Date(r.updatedAt).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                                  {/* Action Buttons: Edit / Load and Download */}
                                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 font-noto">
                                    <button 
                                      onClick={() => loadRoutineFromDB(r)}
                                      className={`h-9 sm:h-10 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-xs ${
                                        isCurrentEditing 
                                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' 
                                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800'
                                      }`}
                                    >
                                      {isCurrentEditing ? <Edit3 size={14} /> : <Upload size={14} />}
                                      {isCurrentEditing ? (lang === 'bn' ? 'বর্তমানে এডিট হচ্ছে' : 'Currently Editing') : (lang === 'bn' ? 'এডিট / লোড করুন' : 'Edit / Load Routine')}
                                    </button>

                                    <button 
                                      onClick={async () => {
                                        setIsDownloading(true);
                                        try {
                                          const tempName = r.customRoutineTitle || r.activeExamName || (lang === 'bn' ? 'বেফাক পরীক্ষার রুটিন' : 'Befaq Exam Routine');
                                          setDownloadProgress(0);
                                          await generateExamRoutinePDF(
                                            { ...madrasah, name: madrasah?.name || 'Madrasah' } as any,
                                            tempName,
                                            r.routineData,
                                            lang,
                                            {
                                              routineSelectionMode: r.routineSelectionMode,
                                              selectedRoutineClassId: r.selectedRoutineClassId,
                                              classesList: classes,
                                              routineMorningTime: r.routineMorningTime,
                                              routineAfternoonTime: r.routineAfternoonTime,
                                              routineInstructions: r.routineInstructions,
                                              routinePrincipalName: routinePrincipalName,
                                              routinePrincipalMobile: routinePrincipalMobile,
                                              showRoutineAfternoon: r.showRoutineAfternoon,
                                              examYear: currentYear,
                                              themeColor: r.routineThemeColor,
                                              fontScale: r.fontScale || fontScale || 1.2
                                            },
                                            (p) => setDownloadProgress(p)
                                          );
                                        } finally {
                                          setIsDownloading(false);
                                          setDownloadProgress(0);
                                        }
                                      }}
                                      className="h-9 sm:h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors border border-emerald-200 dark:border-emerald-800 shadow-xs"
                                    >
                                      <Download size={14} />
                                      {lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
                          <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-400">
                            {lang === 'bn' ? 'কোনো রুটিন সেভ করা নেই' : 'No saved routines'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Live Preview Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] border shadow-bubble`}>
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-4 gap-3">
                  <h3 className={`text-base font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>
                    {lang === 'bn' ? 'লাইভ প্রিন্ট প্রিভিউ' : 'Live Print Preview'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {routineSelectionMode !== 'saved' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {editingRoutineId ? (
                          <button 
                            onClick={saveRoutineToDB}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            title={lang === 'bn' ? 'বর্তমান রুটিনটি আপডেট করুন' : 'Update existing routine'}
                          >
                            <Save size={12} />
                            {lang === 'bn' ? 'রুটিন আপডেট' : 'Update Routine'}
                          </button>
                        ) : (
                          <button 
                            onClick={saveRoutineToDB}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <Save size={12} />
                            {lang === 'bn' ? 'রুটিন সেভ' : 'Save Routine'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                      <button onClick={() => setUserZoom(z => Math.max(0.5, z - 0.2))} className="p-1.5 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors" title={lang === 'bn' ? 'জুম আউট' : 'Zoom Out'}><ZoomOut size={16} /></button>
                      <span className="text-[11px] font-black text-slate-700 min-w-[44px] text-center">{Math.round(userZoom * 100)}%</span>
                      <button onClick={() => setUserZoom(z => Math.min(3, z + 0.2))} className="p-1.5 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors" title={lang === 'bn' ? 'জুম ইন' : 'Zoom In'}><ZoomIn size={16} /></button>
                      <div className="w-[1px] h-4 bg-slate-300 mx-0.5"></div>
                      <button onClick={() => setUserZoom(1)} className="p-1.5 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors" title={lang === 'bn' ? 'রিসেট জুম' : 'Reset Zoom'}><Maximize size={14} /></button>
                    </div>
                    <div className="hidden sm:block text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-emerald-50/50 border border-emerald-100 text-emerald-800 px-2 py-1.5 rounded-lg whitespace-nowrap">
                      {lang === 'bn' ? 'এ৪ সাইজ' : 'A4 Size'}
                    </div>
                  </div>
                </div>

                {/* Live Preview Paper Wrapper */}
                <div 
                  ref={previewContainerRef}
                  className="w-full py-8 px-2 sm:px-8 bg-slate-100/50 rounded-[2.8rem] border border-slate-200/50 overflow-auto custom-scrollbar"
                  style={{ minHeight: `${794 * previewScale * userZoom + 40}px`, maxHeight: '75vh' }}
                >
                  <div className="min-w-full w-max flex justify-center">
                    <div 
                      className="relative shrink-0 text-left"
                      style={{ 
                        width: `${1123 * previewScale * userZoom}px`,
                        height: `${794 * previewScale * userZoom}px`
                      }}
                    >
                      <div 
                        className="shadow-3xl origin-top-left transition-transform duration-200 bg-white font-noto rounded-lg absolute top-0 left-0"
                        style={{ 
                          transform: `scale(${previewScale * userZoom})`,
                          width: '1123px',
                          height: '794px'
                        }}
                      >
                    
                    {(() => {
                      const isClassMode = routineSelectionMode === 'class';
                      const previewNameFontSize = isClassMode 
                        ? (madrasah?.name && madrasah.name.length > 25 ? 'text-[22px]' : 'text-[26px]') 
                        : (madrasah?.name && madrasah.name.length > 25 ? 'text-[28px]' : 'text-[34px]');
                      
                      const previewLogoSize = isClassMode ? 'w-[68px] h-[68px]' : 'w-[88px] h-[88px]';
                      const previewCalendarBoxClass = isClassMode ? 'w-[130px] h-[88px] p-2' : 'w-[170px] h-[105px] p-2.5';
                      const previewCalendarIconSize = isClassMode ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm';
                      const previewCalendarTextClass1 = isClassMode ? 'text-[11px]' : 'text-[13px]';
                      const previewCalendarTextClass2 = isClassMode ? 'text-[10px]' : 'text-[12px]';
                      const previewCalendarTextClass3 = isClassMode ? 'text-[9px]' : 'text-[11px]';
                      const previewContactTextSize = isClassMode ? 'text-[11px]' : 'text-[12.5px]';
                      const previewPillBadgeClass = isClassMode ? 'px-4 py-1 text-[10.5px]' : 'px-6 py-1.5 text-[12.5px]';

                      return (
                        <div className="text-slate-800 w-[1123px] h-[794px] p-6 relative border-[10px] flex flex-col justify-between font-noto" style={{ borderColor: `${rtTheme.primary}1a` }}>
                          {/* Frame Design corners */}
                          <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                          <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 rounded-tr-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 rounded-bl-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-xl m-2" style={{ borderColor: rtTheme.primary }}></div>

                          <div className="flex-1 flex flex-col justify-between">
                            {/* Banner Block */}
                            <div className="flex justify-between items-center w-full px-4 py-2.5 rounded-3xl border mb-2 relative" style={{ backgroundColor: `${rtTheme.light}66`, borderColor: `${rtTheme.primary}1a`, backgroundImage: `linear-gradient(to right, ${rtTheme.light}33, ${rtTheme.accent}66)` }}>
                              {/* Left Column: Logotype */}
                              <div className="flex-shrink-0 flex items-center justify-center pl-2">
                                <div className="relative p-1 rounded-full border bg-white shadow-sm" style={{ borderColor: rtTheme.primary }}>
                                  {madrasah?.logo_url ? (
                                    <img src={madrasah.logo_url} className={`${previewLogoSize} object-contain rounded-full bg-white`} alt="Logo" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className={`${previewLogoSize} bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-900 font-black text-[10px]`}>LOGO</div>
                                  )}
                                </div>
                              </div>

                              {/* Center Column: Madrasah Title, location, etc */}
                              <div className="flex-1 text-center px-4 leading-normal">
                                <h1 className={`${previewNameFontSize} font-black tracking-tight leading-tight mb-1 font-solaiman`} style={{ color: rtTheme.primary }}>
                                  {madrasah?.name || 'মাদরাসার নাম'}
                                </h1>
                                
                                <div className={`flex items-center justify-center gap-2 ${previewContactTextSize} font-bold text-[#475569] leading-tight flex-wrap font-solaiman`}>
                                  <span className="inline-flex items-center gap-0.5" style={{ color: rtTheme.primary }}>
                                    {madrasah?.address || 'ঠিকানা'}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span className="inline-flex items-center gap-0.5" style={{ color: rtTheme.primary }}>
                                    {lang === 'bn' ? 'মোবাইলঃ ' : 'Mobile: '} {madrasah?.phone || '০১৭XXXXXXXX'}
                                  </span>
                                </div>

                                {/* Center pill badge matching bottom-center of image */}
                                <div className="mt-1.5 inline-block">
                                  <div className={`text-white ${previewPillBadgeClass} rounded-full shadow-sm font-black tracking-wide border font-solaiman`} style={{ backgroundColor: rtTheme.secondary, borderColor: `${rtTheme.primary}80` }}>
                                    {lang === 'bn' 
                                      ? (activeExamName.includes('সময়সূচি') ? activeExamName : `${activeExamName} সময়সূচি - ${currentYearBn}`)
                                      : (activeExamName.includes('Schedule') ? activeExamName : `${activeExamName} Schedule - ${currentYear}`)}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Solid Premium Calendar Box matching top-right box exactly */}
                              <div className={`flex-shrink-0 ${previewCalendarBoxClass} text-white rounded-2xl flex flex-col justify-center border shadow mr-2`} style={{ backgroundColor: rtTheme.primary, borderColor: `${rtTheme.primary}b3` }}>
                                <div className="text-center leading-normal">
                                  <p className={`${previewCalendarTextClass1} font-black leading-none mb-0.5 whitespace-nowrap overflow-hidden`} style={{ color: rtTheme.accent }}>
                                    {activeExamName ? activeExamName.replace(/পরীক্ষার|পরীক্ষা|Exam|সময়সূচি|Schedule/g, '').trim() : (lang === 'bn' ? 'সাময়িক' : 'Term')}
                                  </p>
                                  <p className={`${previewCalendarTextClass2} font-extrabold block mb-0.5`} style={{ color: `${rtTheme.accent}cc` }}>
                                    পরীক্ষা সময়সূচি
                                  </p>
                                  <p className={`${previewCalendarTextClass3} font-semibold text-white/70 block`}>
                                    {currentYearBn}ইং
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Main Grid Table matching image perfectly */}
                            <div className="flex-1 mt-2.5 mb-auto flex flex-col justify-start overflow-x-auto custom-scrollbar min-h-0">
                              {routineSelectionMode === 'all' ? (
                                /* FORMAT A: ALL CLASSES TOGETHER GRID */
                                <table className="w-full h-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: rtTheme.primary }}>
                                  <thead>
                                    {/* First row of Table Header: Days/Dates */}
                                    <tr className="text-white h-11 border-b" style={{ backgroundColor: rtTheme.primary, borderColor: rtTheme.primary }}>
                                      <th className="border-r px-2 py-1.5 text-xs font-black w-24" rowSpan={2} style={{ borderColor: `${rtTheme.primary}b3`, backgroundColor: rtTheme.primary }}>
                                        <div className="flex flex-col items-center justify-center">
                                          <span className="text-[11px] tracking-wider leading-none mb-1 border-b pb-0.5" style={{ borderColor: `${rtTheme.primary}66` }}>{lang === 'bn' ? 'বার' : 'DAY'}</span>
                                          <span className="text-[10px] tracking-widest opacity-80 leading-none">{lang === 'bn' ? 'তারিখ' : 'DATE'}</span>
                                        </div>
                                      </th>
                                      {routineData.map((col, idx) => (
                                        <th key={col.id || idx} className="border-r p-1 text-xs font-black min-w-[100px] relative group" colSpan={showRoutineAfternoon ? 2 : 1} style={{ borderColor: `${rtTheme.primary}b3`, backgroundColor: rtTheme.primary }}>
                                          <button 
                                            onClick={() => handleRemoveRoutineDay(col.id)}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
                                            title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete Day'}
                                          >
                                            <X size={10} strokeWidth={4} />
                                          </button>
                                          <input 
                                            type="text"
                                            value={col.day}
                                            onChange={(e) => {
                                              const updated = [...routineData];
                                              updated[idx].day = e.target.value;
                                              setRoutineData(updated);
                                            }}
                                            className="bg-transparent text-[11px] font-black leading-tight text-white w-full text-center border-none focus:ring-1 focus:ring-emerald-400 rounded outline-none"
                                          />
                                          <input 
                                            type="text"
                                            value={col.date}
                                            onChange={(e) => {
                                              const updated = [...routineData];
                                              updated[idx].date = e.target.value;
                                              setRoutineData(updated);
                                            }}
                                            className="bg-transparent text-[9px] font-bold mt-0.5 w-full text-center border-none focus:ring-1 focus:ring-emerald-400 rounded outline-none"
                                            style={{ color: rtTheme.accent }}
                                          />
                                        </th>
                                      ))}
                                    </tr>
                                    
                                    {/* Second row of Table Header: Morning/Afternoon Shifts */}
                                    <tr className="h-10 border-b" style={{ backgroundColor: rtTheme.accent, borderColor: rtTheme.primary }}>
                                      {routineData.map((_, idx) => (
                                        <React.Fragment key={idx}>
                                          <th className="border-r p-1 text-[11px] font-black font-noto tracking-tighter w-[60px]" style={{ borderColor: `${rtTheme.primary}33`, backgroundColor: rtTheme.accent, color: rtTheme.primary }}>
                                            {lang === 'bn' ? 'সকাল' : 'Morning'}
                                            <span className="block text-[10px] font-black text-[#1e293b] mt-0.5 leading-tight">
                                              {routineMorningTime.split(' ')[0]}
                                            </span>
                                          </th>
                                          {showRoutineAfternoon && (
                                            <th className="border-r p-1 text-[11px] font-black font-noto tracking-tighter w-[60px]" style={{ borderColor: `${rtTheme.primary}33`, backgroundColor: rtTheme.accent, color: rtTheme.primary }}>
                                              {lang === 'bn' ? 'বিকাল' : 'Afternoon'}
                                              <span className="block text-[10px] font-black text-[#1e293b] mt-0.5 leading-tight">
                                                {routineAfternoonTime.split(' ')[0]}
                                              </span>
                                            </th>
                                          )}
                                        </React.Fragment>
                                      ))}
                                    </tr>
                                  </thead>
                                  
                                  <tbody>
                                    {(() => {
                                      const defaultClassesList = [
                                        { id: '1', class_name: lang === 'bn' ? 'প্রথম মারহালা' : 'Class 1' },
                                        { id: '2', class_name: lang === 'bn' ? 'দ্বিতীয় মারহালা' : 'Class 2' },
                                        { id: '3', class_name: lang === 'bn' ? 'তৃতীয় মারহালা' : 'Class 3' }
                                      ];
                                      const displayClassesList = classes.length > 0 
                                        ? (routineSelectionMode === 'all' && selectedRoutineAllExamIds.length > 0 
                                            ? classes.filter(c => selectedRoutineAllExamIds.some(examId => exams.find(e => e.id === examId)?.marhala_id === c.id)) 
                                            : classes) 
                                        : defaultClassesList;
                                      
                                      const getSubjectForClassAndDayAndShift = (cls: any, dayIdx: number, shift: 'morning' | 'afternoon') => {
                                        const dayObj = routineData[dayIdx];
                                        if (!dayObj) return '*****';
                                        const slots = dayObj[shift]?.subjects || [];
                                        const found = slots.find((s: any) => 
                                          s.classId === cls.id || 
                                          s.className === cls.class_name || 
                                          (s.className && cls.class_name && (s.className.includes(cls.class_name) || cls.class_name.includes(s.className)))
                                        );
                                        return found ? found.subject : '*****';
                                      };

                                      return displayClassesList.map((cls, idx) => (
                                        <tr key={cls.id} className="hover:opacity-80 transition-opacity border-b" style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : `${rtTheme.accent}4d`, borderColor: `${rtTheme.primary}26` }}>
                                          <td className="border-r-2 p-2 font-black text-xs text-center align-middle" style={{ borderColor: rtTheme.primary, backgroundColor: `${rtTheme.light}66`, color: rtTheme.primary }}>
                                            <div className="flex items-center justify-center gap-1">
                                              <span className="text-[12px] font-black tracking-tight">{cls.class_name}</span>
                                            </div>
                                          </td>

                                          {routineData.map((_, dayIdx) => {
                                            const mrnSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'morning');
                                            const aftSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'afternoon');

                                            return (
                                              <React.Fragment key={dayIdx}>
                                                <td className="border-r p-1 align-middle text-center" style={{ borderColor: `${rtTheme.primary}26` }}>
                                                  <input 
                                                    type="text"
                                                    value={mrnSub === '*****' ? '' : mrnSub}
                                                    onChange={(e) => {
                                                      const updated = [...routineData];
                                                      const subjects = updated[dayIdx].morning.subjects;
                                                      const foundIdx = subjects.findIndex((s: any) => 
                                                        s.classId === cls.id || 
                                                        s.className === cls.class_name || 
                                                        (s.className && cls.class_name && (s.className.includes(cls.class_name) || cls.class_name.includes(s.className)))
                                                      );
                                                      if (foundIdx > -1) {
                                                        subjects[foundIdx].subject = e.target.value;
                                                      } else {
                                                        subjects.push({
                                                          classId: cls.id,
                                                          className: cls.class_name,
                                                          subject: e.target.value
                                                        });
                                                      }
                                                      setRoutineData(updated);
                                                    }}
                                                    placeholder="-"
                                                    className="w-full bg-transparent text-center text-[10px] font-black border-none focus:ring-1 focus:ring-emerald-400 rounded outline-none p-0.5"
                                                    style={{ color: mrnSub === '*****' ? '#cbd5e1' : rtTheme.primary }}
                                                  />
                                                </td>
                                                {showRoutineAfternoon && (
                                                  <td className="border-r p-1 align-middle text-center" style={{ borderColor: `${rtTheme.primary}26` }}>
                                                    <input 
                                                      type="text"
                                                      value={aftSub === '*****' ? '' : aftSub}
                                                      onChange={(e) => {
                                                        const updated = [...routineData];
                                                        const subjects = updated[dayIdx].afternoon.subjects;
                                                        const foundIdx = subjects.findIndex((s: any) => 
                                                          s.classId === cls.id || 
                                                          s.className === cls.class_name || 
                                                          (s.className && cls.class_name && (s.className.includes(cls.class_name) || cls.class_name.includes(s.className)))
                                                        );
                                                        if (foundIdx > -1) {
                                                          subjects[foundIdx].subject = e.target.value;
                                                        } else {
                                                          subjects.push({
                                                            classId: cls.id,
                                                            className: cls.class_name,
                                                            subject: e.target.value
                                                          });
                                                        }
                                                        setRoutineData(updated);
                                                      }}
                                                      placeholder="-"
                                                      className="w-full bg-transparent text-center text-[10px] font-black border-none focus:ring-1 focus:ring-emerald-400 rounded outline-none p-0.5"
                                                      style={{ color: aftSub === '*****' ? '#cbd5e1' : rtTheme.primary }}
                                                    />
                                                  </td>
                                                )}
                                              </React.Fragment>
                                            );
                                          })}
                                        </tr>
                                      ));
                                    })()}
                                  </tbody>
                                </table>
                              ) : (
                                /* FORMAT B: CLASS-WISE SINGLE ROUTINE */
                                <table className="w-full h-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: rtTheme.primary }}>
                                  <thead>
                                    <tr className="text-white h-11" style={{ backgroundColor: rtTheme.primary }}>
                                      <th className="border-r p-2 text-xs font-black w-32" style={{ borderColor: `${rtTheme.primary}b3` }}>
                                        {lang === 'bn' ? 'বার / তারিখ' : 'Day / Date'}
                                      </th>
                                      <th className="border-r p-2 text-xs font-black" style={{ borderColor: `${rtTheme.primary}b3` }}>
                                        {lang === 'bn' ? `সকাল (${routineMorningTime.split(' - ')[0]})` : `Morning (${routineMorningTime.split(' - ')[0]})`}
                                      </th>
                                      {showRoutineAfternoon && (
                                        <th className="p-2 text-xs font-black w-48">
                                          {lang === 'bn' ? `বিকাল (${routineAfternoonTime.split(' - ')[0]})` : `Afternoon (${routineAfternoonTime.split(' - ')[0]})`}
                                        </th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="h-full">
                                    {(() => {
                                      const activeClassObj = classes.find(c => c.id === selectedRoutineClassId) || classes[0];
                                      const getSubjectForClassAndDayAndShift = (cls: any, dayIdx: number, shift: 'morning' | 'afternoon') => {
                                        const dayObj = routineData[dayIdx];
                                        if (!dayObj) return '*****';
                                        const slots = dayObj[shift]?.subjects || [];
                                        const found = slots.find((s: any) => 
                                          s.classId === cls?.id || 
                                          s.className === cls?.class_name || 
                                          (s.className && cls?.class_name && (s.className.includes(cls.class_name) || cls.class_name.includes(s.className)))
                                        );
                                        return found ? found.subject : '*****';
                                      };

                                      return routineData.map((row, idx) => (
                                        <tr key={row.id || idx} className="border-b relative group" style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : `${rtTheme.accent}33`, borderColor: `${rtTheme.primary}26` }}>
                                          <td className="border-r p-2 text-center align-middle relative group" style={{ borderColor: `${rtTheme.primary}26`, backgroundColor: `${rtTheme.light}4d` }}>
                                            <button 
                                              onClick={() => handleRemoveRoutineDay(row.id)}
                                              className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
                                              title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete Row'}
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                            <div className="relative group/date border rounded-lg p-1 transition-colors" style={{ borderColor: `${rtTheme.primary}26` }}>
                                              <input 
                                                type="date"
                                                value={row.isoDate || ''}
                                                onChange={(e) => {
                                                  const selectedDate = e.target.value;
                                                  if (!selectedDate) return;
                                                  
                                                  const d = new Date(selectedDate);
                                                  const formattedDate = d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                  const formattedDay = d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long' });
                                                  
                                                  const updated = [...routineData];
                                                  updated[idx].isoDate = selectedDate;
                                                  updated[idx].date = formattedDate;
                                                  updated[idx].day = formattedDay;
                                                  setRoutineData(updated);
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                                              />
                                              <div className="flex flex-col items-center">
                                                <p className="text-[10px] font-black leading-none mb-0.5" style={{ color: rtTheme.primary }}>
                                                  {row.day}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                                  <Calendar size={8} />
                                                  {row.date}
                                                </p>
                                              </div>
                                            </div>
                                          </td>
                                          
                                          {/* Morning subject for selected class */}
                                          <td className="border-r p-2 align-middle" style={{ borderColor: `${rtTheme.primary}26` }}>
                                            <input 
                                              type="text"
                                              value={getSubjectForClassAndDayAndShift(activeClassObj, idx, 'morning')}
                                              onChange={(e) => {
                                                const updated = [...routineData];
                                                const subjects = updated[idx].morning.subjects;
                                                const foundIdx = subjects.findIndex((s: any) => 
                                                  s.classId === activeClassObj?.id || 
                                                  s.className === activeClassObj?.class_name || 
                                                  (s.className && activeClassObj?.class_name && (s.className.includes(activeClassObj.class_name) || activeClassObj.class_name.includes(s.className)))
                                                );
                                                if (foundIdx > -1) {
                                                  subjects[foundIdx].subject = e.target.value;
                                                } else {
                                                  subjects.push({
                                                    classId: activeClassObj?.id || '',
                                                    className: activeClassObj?.class_name || '',
                                                    subject: e.target.value
                                                  });
                                                }
                                                setRoutineData(updated);
                                              }}
                                              className="bg-transparent text-center font-black text-xs w-full border-none focus:ring-1 focus:ring-emerald-400 rounded outline-none p-1"
                                              style={{ color: rtTheme.primary }}
                                              placeholder={lang === 'bn' ? 'বিষয়ের নাম লেখুন' : 'Enter Topic'}
                                            />
                                          </td>

                                          {/* Afternoon items */}
                                          {showRoutineAfternoon && (
                                            <td className="p-2 align-middle">
                                              <input 
                                                type="text"
                                                value={getSubjectForClassAndDayAndShift(activeClassObj, idx, 'afternoon')}
                                                onChange={(e) => {
                                                  const updated = [...routineData];
                                                  const subjects = updated[idx].afternoon.subjects;
                                                  const foundIdx = subjects.findIndex((s: any) => 
                                                    s.classId === activeClassObj?.id || 
                                                    s.className === activeClassObj?.class_name || 
                                                    (s.className && activeClassObj?.class_name && (s.className.includes(activeClassObj.class_name) || activeClassObj.class_name.includes(s.className)))
                                                  );
                                                  if (foundIdx > -1) {
                                                    subjects[foundIdx].subject = e.target.value;
                                                  } else {
                                                    subjects.push({
                                                      classId: activeClassObj?.id || '',
                                                      className: activeClassObj?.class_name || '',
                                                      subject: e.target.value
                                                    });
                                                  }
                                                  setRoutineData(updated);
                                                }}
                                                className="bg-transparent text-center font-black text-xs w-full border-none focus:ring-1 focus:ring-emerald-400 rounded outline-none p-1"
                                                style={{ color: rtTheme.primary }}
                                                placeholder={lang === 'bn' ? 'বিষয়ের নাম লেখুন' : 'Enter Topic'}
                                              />
                                            </td>
                                          )}
                                        </tr>
                                      ));
                                    })()}
                                  </tbody>
                                </table>
                              )}

                              {/* Natural Watermark stamp */}
                              <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none -rotate-12 select-none">
                                {madrasah?.logo_url ? (
                                  <img src={madrasah.logo_url} className="w-[330px] h-[330px] object-contain" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="text-9xl font-black" style={{ color: rtTheme.primary }}>{madrasah?.name?.slice(0, 1) || 'ম'}</div>
                                )}
                              </div>
                            </div>

                            {/* Footer Block matching image exactly */}
                            <div className="mt-2 flex justify-between items-end pt-3 border-t" style={{ borderColor: `${rtTheme.primary}1a` }}>
                              {/* Left Column: Special Instructions list */}
                              <div className="max-w-[430px] text-left leading-relaxed">
                                <div className="text-white px-3 py-1 rounded-lg inline-flex items-center gap-1.5 text-[11px] font-black mb-1.5 shadow-sm uppercase font-noto" style={{ backgroundColor: rtTheme.primary }}>
                                  <span>📖</span>
                                  {lang === 'bn' ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}
                                </div>
                                <ul className="space-y-0.5 max-h-[105px] overflow-hidden pr-2">
                                  {(() => {
                                    const previewInstructionsToShow = routineInstructions.length > 0 ? routineInstructions.filter(Boolean) : [
                                      lang === 'bn' ? 'পরীক্ষার ফি, রশিদ যোগ ও বকেয়ার রশিদ সংগ্রহে অনুরোধ রইল।' : 'Required exam fees and pending dues must be paid.',
                                      lang === 'bn' ? 'প্রবেশ পত্র সংগ্রহ করতে হবে।' : 'Collect the exam admit card on time.',
                                      lang === 'bn' ? 'পরীক্ষার শুরু ১৫ মিনিট পূর্বে উপস্থিত থাকতে হবে।' : 'Be present in the exam hall 15 minutes before.',
                                      lang === 'bn' ? 'পরীক্ষার সময় কোনো প্রকার মোবাইল ব্যবহার সম্পূর্ণ নিষিদ্ধ থাকবে।' : 'Smartphones and electronical devices are strictly prohibited.',
                                      lang === 'bn' ? 'পরীক্ষায় নকল করা সম্পূর্ণ নিষিদ্ধ।' : 'Cheating is strictly prohibited.'
                                    ];

                                    return previewInstructionsToShow.map((inst, i) => (
                                      <li key={i} className="flex gap-1.5 text-[10px] font-bold text-slate-600 leading-normal">
                                        <span className="font-extrabold" style={{ color: rtTheme.primary }}>{i + 1} ।</span>
                                        <span>{inst}</span>
                                      </li>
                                    ));
                                  })()}
                                </ul>
                              </div>

                              {/* Right Column: Sign Box matching bottom-right of image */}
                              <div className="text-center min-w-[200px]">
                                <div className="border rounded-xl p-4 relative" style={{ borderColor: `${rtTheme.primary}33`, backgroundColor: `${rtTheme.light}26` }}>
                                  <p className="text-[11px] font-black mb-6" style={{ color: `${rtTheme.primary}e6` }}>{lang === 'bn' ? 'ধন্যবাদান্তে,' : 'Best Regards,'}</p>
                                  <div className="h-px bg-slate-200 w-full mb-1"></div>
                                  <p className="text-[11px] font-black" style={{ color: rtTheme.primary }}>
                                    {routinePrincipalName || (lang === 'bn' ? 'পরীক্ষা নিয়ন্ত্রক' : 'Controller of Exam')}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">{madrasah?.name}</p>
                                  {routinePrincipalMobile && (
                                    <p className="text-[9px] font-black mt-0.5 inline-flex items-center gap-0.5" style={{ color: `${rtTheme.primary}cc` }}>
                                      📞 {routinePrincipalMobile}
                                    </p>
                                  )}
                                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t border-r rounded-tr-md" style={{ borderColor: rtTheme.primary }}></div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Routine Success/Confirm Modal Popup Block */}
          <AnimatePresence>
            {showRoutineSuccessModal && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowRoutineSuccessModal(false)}
                  className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className={`relative w-full max-w-sm rounded-[3rem] shadow-2xl border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                >
                  <div className="p-8 text-center">
                    <div className="relative inline-block mb-6">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                        className={`w-24 h-24 ${routineModalMode === 'success' ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-500 shadow-amber-500/30'} rounded-[2rem] flex items-center justify-center shadow-lg relative z-10`}
                      >
                        {routineModalMode === 'success' ? (
                          <CheckCircle2 size={48} className="text-white" />
                        ) : (
                          <AlertCircle size={48} className="text-white" />
                        )}
                      </motion.div>
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`absolute inset-0 ${routineModalMode === 'success' ? 'bg-emerald-500' : 'bg-amber-500'} rounded-[2rem] blur-2xl -z-10`}
                      />
                    </div>
                    
                    <h3 className={`text-2xl font-black mb-2 font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      {routineSuccessTitle || (lang === 'bn' ? 'সফল হয়েছে!' : 'Success!')}
                    </h3>
                    <p className={`text-sm font-bold mb-8 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {routineSuccessMessage}
                    </p>
                    
                    {routineModalMode === 'confirm' ? (
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={() => setShowRoutineSuccessModal(false)}
                          className={`flex-1 py-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'} font-black rounded-2xl transition-all`}
                        >
                          {routineCancelText || (lang === 'bn' ? 'বাতিল' : 'Cancel')}
                        </button>
                        <button 
                          onClick={() => {
                            setShowRoutineSuccessModal(false);
                            if (routineOnConfirm) {
                              routineOnConfirm();
                            }
                          }}
                          className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                        >
                          {routineConfirmText || (lang === 'bn' ? 'নিশ্চিত' : 'Confirm')}
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowRoutineSuccessModal(false)}
                        className="w-full py-5 bg-emerald-500 shadow-emerald-500/20 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-lg"
                      >
                        {lang === 'bn' ? 'ঠিক আছে' : 'Awesome'}
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeTab === 'seat-plan' && (
        <div className="space-y-6">
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] border shadow-bubble space-y-6`}>
                <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>Seat Plan Configuration</h3>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Classes</label>
                    <div className="flex flex-wrap gap-2">
                        {classes.map(c => (
                            <button 
                                key={c.id}
                                onClick={() => {
                                    if (selectedClassesForSeatPlan.includes(c.id)) {
                                        setSelectedClassesForSeatPlan(prev => prev.filter(id => id !== c.id));
                                    } else {
                                        setSelectedClassesForSeatPlan(prev => [...prev, c.id]);
                                    }
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${selectedClassesForSeatPlan.includes(c.id) ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100')}`}
                            >
                                {c.class_name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Exam Selection */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরীক্ষা নির্বাচন করুন' : 'Select Exam'}</label>
                    <select
                        value={selectedSeatPlanExamId}
                        onChange={(e) => setSelectedSeatPlanExamId(e.target.value)}
                        className={`w-full h-11 px-3.5 py-2 text-xs font-black rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-600 focus:border-emerald-500'} outline-none`}
                    >
                        <option value="">{lang === 'bn' ? '-- পরীক্ষা নির্বাচন করুন (ঐচ্ছিক) --' : '-- Select Exam (Optional) --'}</option>
                        {exams
                            .filter(e => selectedClassesForSeatPlan.length === 0 || selectedClassesForSeatPlan.includes(e.marhala_id))
                            .map(e => (
                                <option key={e.id} value={e.id}>{e.exam_name}</option>
                            ))
                        }
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rooms & Capacity</label>
                    {rooms.map((room, idx) => (
                        <div key={room.id} className="flex gap-2">
                            <input 
                                type="text" 
                                value={room.room_name}
                                onChange={(e) => {
                                    const newRooms = [...rooms];
                                    newRooms[idx].room_name = e.target.value;
                                    setRooms(newRooms);
                                }}
                                className={`flex-1 h-10 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E293B]'} rounded-xl px-3 text-xs font-bold outline-none`}
                                placeholder="Room Name"
                            />
                            <input 
                                type="number" 
                                value={room.capacity}
                                onChange={(e) => {
                                    const newRooms = [...rooms];
                                    newRooms[idx].capacity = parseInt(e.target.value) || 0;
                                    setRooms(newRooms);
                                }}
                                className={`w-24 h-10 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E293B]'} rounded-xl px-3 text-xs font-bold outline-none`}
                                placeholder="Capacity"
                            />
                            <button onClick={() => setRooms(rooms.filter((_, i) => i !== idx))} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setRooms([...rooms, { id: Date.now().toString(), room_name: `Room ${101 + rooms.length}`, capacity: 30 }])} className="text-xs font-black text-emerald-600 flex items-center gap-1 mt-2">
                        <Plus size={14}/> Add Room
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template</label>
                    <div className="grid grid-cols-2 gap-2">
                        {seatPlanTemplates.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setSelectedSeatPlanTemplate(t.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedSeatPlanTemplate === t.id ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 border-emerald-500/30 ring-2 ring-emerald-500/20' : 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100') : (madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-slate-100')}`}
                            >
                                <div className={`font-black text-xs ${selectedSeatPlanTemplate === t.id ? (madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}`}>{t.name}</div>
                                <div className="text-[10px] text-slate-400 mt-1">{t.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        checked={seatPlanConfig.randomize}
                        onChange={(e) => setSeatPlanConfig(prev => ({ ...prev, randomize: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <label className={`text-xs font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Randomize Seating</label>
                </div>

                <button onClick={handleGenerateSeatPlan} disabled={loading} className="w-full h-14 bg-emerald-600 text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {loading && seatAssignments.length === 0 ? <Loader2 className="animate-spin" /> : <><RefreshCw size={20}/> Generate Seat Plan</>}
                </button>
            </div>

            {seatAssignments.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>Generated Plan</h3>
                        <button onClick={() => {
                            setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadSeatPlan(l));
                            setShowDownloadLangModal(true);
                        }} className={`px-4 py-2 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} rounded-xl font-black text-xs flex items-center gap-2 border`}>
                            <Download size={14}/> Download PDF
                        </button>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} rounded-[2rem] border shadow-bubble overflow-hidden`}>
                        <table className="w-full text-left text-sm">
                            <thead className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                <tr>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Room</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Seat</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Student</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Class</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Roll</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${madrasah?.theme === 'dark' ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                {seatAssignments.map((a, i) => (
                                    <tr key={i} className={`${madrasah?.theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                                        <td className={`py-3 px-4 font-bold ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-[#1E3A8A]'}`}>{a.room_name}</td>
                                        <td className="py-3 px-4 font-black text-slate-500">{a.seat_number}</td>
                                        <td className={`py-3 px-4 font-bold ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{a.student_name}</td>
                                        <td className="py-3 px-4 text-slate-500 text-xs">{a.class_name}</td>
                                        <td className="py-3 px-4 font-black text-slate-400">{a.roll}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      )}

      {activeTab === 'exams' && view === 'list' && !selectedClassId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble flex items-center justify-between hover:border-emerald-200 transition-all active:scale-95`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} rounded-2xl flex items-center justify-center`}><BookOpen size={24}/></div>
                <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>{cls.class_name}</h3>
              </div>
              <ChevronRight className="text-slate-300" />
            </button>
          ))}
        </div>
      )}

      {activeTab === 'exams' && view === 'list' && selectedClassId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <button onClick={() => setSelectedClassId(null)} className="text-sm font-black text-emerald-600 flex items-center gap-2">
              <ArrowLeft size={16} /> {lang === 'bn' ? 'শ্রেণিতে ফিরে যান' : 'Back to Classes'}
            </button>
            {role === 'madrasah_admin' && (
              <button 
                onClick={() => { setClassId(selectedClassId); setShowAddExam(true); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-premium active:scale-95 transition-all"
              >
                <Plus size={16} /> {lang === 'bn' ? 'নতুন পরীক্ষা' : 'Add Exam'}
              </button>
            )}
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600" /></div> : exams.map(exam => (
            <div key={exam.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2.5rem] border shadow-bubble space-y-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} rounded-2xl flex items-center justify-center shadow-inner`}><GraduationCap size={24}/></div>
                        <div>
                            <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>{exam.exam_name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black uppercase">{exam.exam_year}</span>
                                {exam.is_published ? (
                                  <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[8px] font-extrabold uppercase font-noto">প্রকাশিত</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[8px] font-extrabold uppercase font-noto">অপ্রকাশিত</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {role === 'madrasah_admin' && (
                    <div className="flex gap-2">
                        <button onClick={() => handleEditClick(exam)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => { setExamToDelete(exam.id); setShowDeleteConfirm(true); }} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors">
                            <Trash2 size={14} />
                        </button>
                    </div>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 active:scale-95 transition-all">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.marhala_id); }} className="py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100 active:scale-95 transition-all">{t('enter_marks', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('rank'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.marhala_id); }} className="py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-premium active:scale-95 transition-all">{t('rank', lang)}</button>
                </div>
                {modules.admit_card && (
                  <button onClick={() => handleDownloadAdmitCard(exam)} className="w-full py-2.5 bg-purple-50 text-purple-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-purple-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <CreditCard size={14}/> Admit Card
                  </button>
                )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'exams' && view === 'subjects' && (
        <div className="space-y-4">
           <div className="flex gap-3">
              <button onClick={() => setShowAddSubject(true)} className={`flex-1 py-5 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} rounded-[2.2rem] text-emerald-600 font-black flex items-center justify-center gap-3 shadow-bubble border active:scale-95 transition-all`}>
                 <Plus size={24} strokeWidth={3} /> {lang === 'bn' ? 'কিতাব যোগ করুন' : 'Add Book'}
              </button>
              <button 
                onClick={handleCopySubjects} 
                disabled={isSaving}
                className={`px-8 py-5 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} rounded-[2.2rem] text-emerald-600 font-black flex items-center justify-center gap-3 shadow-bubble border active:scale-95 transition-all disabled:opacity-50`}
                title={lang === 'bn' ? 'আগের পরীক্ষা থেকে কপি করুন' : 'Copy from previous exam'}
              >
                 <RefreshCw size={24} strokeWidth={3} className={isSaving ? 'animate-spin' : ''} /> {lang === 'bn' ? 'কপি' : 'Copy'}
              </button>
           </div>
           <div className="space-y-3">
              {subjects.map(s => (
                <div key={s.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble flex items-center justify-between`}>
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto text-lg`}>{s.subject_name}</h5>
                   </div>
                   <div className="text-right flex flex-col items-end gap-2">
                       <div className="flex gap-2 items-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase">মোট নম্বর: {s.total_marks}</p>
                          <p className="text-[9px] font-black text-red-400 uppercase">পাস নম্বর: {s.passing_marks}</p>
                       </div>
                      {role === 'madrasah_admin' && (
                         <div className="flex gap-2">
                            <button 
                                onClick={() => handleEditSubjectClick(s)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button 
                                onClick={() => handleDeleteSubject(s.id)}
                                disabled={isSaving}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={14} />
                            </button>
                         </div>
                      )}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'exams' && view === 'marks' && (
        <div className="space-y-4">
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2.5rem] shadow-bubble border`}>
                <div className="overflow-auto max-h-[60vh] md:max-h-[70vh] no-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className={`border-b ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                            <th className={`py-4 px-2 text-[10px] font-black text-slate-400 uppercase border-r ${madrasah?.theme === 'dark' ? 'border-slate-800 bg-slate-900 border-b border-b-slate-850' : 'border-slate-100 bg-white border-b border-b-slate-100'} sticky top-0 left-0 z-30 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.1)] max-w-[100px] truncate`}>Roll/Name</th>
                            {subjects.map(s => (
                                <th key={s.id} className={`py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px] pl-4 sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>{s.subject_name}</th>
                            ))}
                            <th className={`py-4 text-[10px] font-black text-emerald-400 uppercase text-center min-w-[60px] sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>মোট</th>
                            <th className={`py-4 text-[10px] font-black text-purple-400 uppercase text-center min-w-[60px] sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>বিভাগ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((std, sIndex) => {
                            const moveToRow = (subId: string, targetIdx: number) => {
                                if (targetIdx >= 0 && targetIdx < students.length) {
                                    const targetInput = document.getElementById(`befaq-mark-${subId}-${targetIdx}`) as HTMLInputElement | null;
                                    if (targetInput) {
                                        targetInput.focus();
                                        targetInput.select();
                                    }
                                }
                            };

                            const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, subId: string) => {
                                const isEnter = e.key === 'Enter' || e.keyCode === 13 || e.which === 13 || e.code === 'Enter' || e.code === 'NumpadEnter';
                                const isDown = e.key === 'ArrowDown' || e.keyCode === 40;
                                const isUp = e.key === 'ArrowUp' || e.keyCode === 38;

                                if (isEnter || isDown) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.shiftKey && isEnter) {
                                        moveToRow(subId, sIndex - 1);
                                    } else {
                                        moveToRow(subId, sIndex + 1);
                                    }
                                } else if (isUp) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    moveToRow(subId, sIndex - 1);
                                }
                            };

                            return (
                            <tr key={std.id} className={`border-b last:border-0 ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                                <td className={`py-4 px-2 border-r ${madrasah?.theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'} sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-emerald-600 leading-none mb-0.5">#{std.roll}</span>
                                        <span className={`font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'} text-[10px] font-noto truncate max-w-[100px]`}>{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map((sub, idx) => (
                                    <td key={sub.id} className={`py-4 px-2 ${idx === 0 ? 'pl-4' : ''}`}>
                                        <input 
                                            id={`befaq-mark-${sub.id}-${sIndex}`}
                                            type="number" 
                                            inputMode="decimal"
                                            enterKeyHint="next"
                                            autoComplete="off"
                                            tabIndex={idx * students.length + sIndex + 1}
                                            min="0"
                                            max={sub.total_marks}
                                            className={`w-full h-10 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-600'} rounded-lg text-center font-black text-xs outline-none transition-all`}
                                            value={marksData[std.id]?.[sub.id] || ''}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => handleKeyDown(e, sub.id)}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (val !== '') {
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) {
                                                        if (num > sub.total_marks) {
                                                            val = sub.total_marks.toString();
                                                        } else if (num < 0) {
                                                            val = '0';
                                                        }
                                                    }
                                                }
                                                setMarksData(prev => ({
                                                    ...prev,
                                                    [std.id]: {
                                                        ...prev[std.id],
                                                        [sub.id]: val
                                                    }
                                                }));
                                            }}
                                        />
                                    </td>
                                ))}
                                <td className={`py-4 px-2 text-center font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'} text-xs`}>
                                    {subjects.reduce((sum, sub) => sum + (parseFloat(marksData[std.id]?.[sub.id] || '0') || 0), 0)}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">
                                    {(() => {
                                        const total = subjects.reduce((sum, sub) => sum + (parseFloat(marksData[std.id]?.[sub.id] || '0') || 0), 0);
                                        const totalPossible = subjects.reduce((sum, s) => sum + s.total_marks, 0);
                                        return getDivision(total, totalPossible);
                                    })()}
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {activeTab === 'exams' && view === 'rank' && (
        <div className="space-y-4">
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2.5rem] shadow-bubble border overflow-x-auto no-scrollbar`}>
                <table className="w-full text-left min-w-[600px]">
                    <thead>
                        <tr className={`border-b ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase text-center w-16">মেধা</th>
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase pl-4">নাম</th>
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase text-center">রোল</th>
                            <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center">মোট নম্বর</th>
                            <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center">বিভাগ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            const sortedStds = students.map(std => {
                                const stdMarks = marksData[std.id] || {};
                                const totalObtained = subjects.reduce((sum, s) => sum + (parseFloat(stdMarks[s.id] || '0') || 0), 0);
                                const totalPossible = subjects.reduce((sum, s) => sum + s.total_marks, 0);
                                
                                // Check if failed in any subject
                                const failed = subjects.some(sub => {
                                    const marks = parseFloat(stdMarks[sub.id] || '0');
                                    return marks < sub.passing_marks;
                                });

                                return {
                                    ...std,
                                    totalObtained,
                                    division: failed ? 'রাসিব' : getDivision(totalObtained, totalPossible),
                                    failed
                                };
                            }).sort((a, b) => {
                                if (a.failed && !b.failed) return 1;
                                if (!a.failed && b.failed) return -1;
                                return b.totalObtained - a.totalObtained;
                            });

                            let currentRank = 1;
                            return sortedStds.map((std, index) => {
                                if (index > 0) {
                                    const prev = sortedStds[index - 1];
                                    const isTie = prev.totalObtained === std.totalObtained && prev.failed === std.failed;
                                    if (!isTie) {
                                        currentRank++;
                                    }
                                }
                                const rank = currentRank;

                                return (
                                    <tr key={std.id} className={`border-b ${madrasah?.theme === 'dark' ? 'border-slate-800/50' : 'border-slate-50'} last:border-0`}>
                                        <td className="py-4 px-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mx-auto ${rank <= 3 ? 'bg-yellow-100 text-yellow-700' : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500')}`}>
                                                {rank}
                                            </div>
                                        </td>
                                        <td className={`py-4 pl-4 font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'} text-xs font-noto`}>{std.student_name}</td>
                                        <td className="py-4 text-center font-black text-slate-400 text-xs">{std.roll}</td>
                                        <td className="py-4 text-center font-black text-emerald-600 text-xs">{std.totalObtained}</td>
                                        <td className={`py-4 text-center font-black text-xs ${std.failed ? 'text-red-500' : 'text-purple-600'}`}>{std.division}</td>
                                    </tr>
                                );
                            });
                        })()}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Modals */}
      {showAdmitCardModal && examForAdmitCard && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95`}>
             <div className="flex items-center justify-between">
               <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Admit Card Options</h3>
               <button onClick={() => setShowAdmitCardModal(false)} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className={`p-4 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'} rounded-2xl border`}>
                    <p className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-800'}`}>Exam: {examForAdmitCard.exam_name}</p>
                    <p className={`text-xs ${madrasah?.theme === 'dark' ? 'text-emerald-500/60' : 'text-emerald-600'} mt-1`}>Class: {examForAdmitCard.classes?.class_name}</p>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Template</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button 
                            onClick={() => setSelectedAdmitCardTemplate('classic')}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedAdmitCardTemplate === 'classic' ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 border-emerald-500/30 ring-2 ring-emerald-500/20' : 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100') : (madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-slate-100')}`}
                        >
                            <div className={`font-black text-xs ${selectedAdmitCardTemplate === 'classic' ? (madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600') : (madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600')}`}>Classic</div>
                            <div className="text-[10px] text-slate-400 mt-1">Standard layout with borders</div>
                        </button>
                        <button 
                            onClick={() => setSelectedAdmitCardTemplate('modern')}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedAdmitCardTemplate === 'modern' ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 border-emerald-500/30 ring-2 ring-emerald-500/20' : 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100') : (madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-slate-100')}`}
                        >
                            <div className={`font-black text-xs ${selectedAdmitCardTemplate === 'modern' ? (madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600') : (madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600')}`}>Modern</div>
                            <div className="text-[10px] text-slate-400 mt-1">Clean design with color header</div>
                        </button>
                    </div>
                </div>

                 <button 
                   onClick={() => {
                     setDownloadAction(() => (l: 'en' | 'bn') => confirmDownloadAdmitCard(l));
                     setShowDownloadLangModal(true);
                   }} 
                   disabled={isDownloading}
                   className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18}/>} 
                   {isDownloading ? (lang === 'bn' ? 'ডাউনলোড হচ্ছে...' : 'Downloading...') : (lang === 'bn' ? 'এডমিট কার্ড ডাউনলোড করুন' : 'Download Admit Cards')}
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border animate-in zoom-in-95 duration-300`}>
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} text-center mb-2 font-noto`}>আপনি কি নিশ্চিত?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8 leading-relaxed">এই পরীক্ষাটি ডিলিট করলে এর সাথে সম্পর্কিত সকল বিষয় ও নম্বর মুছে যাবে। এটি আর ফিরে পাওয়া যাবে না।</p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowDeleteConfirm(false); setExamToDelete(null); }}
                className={`flex-1 h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'} font-black rounded-xl active:scale-95 transition-all`}
              >
                বাতিল
              </button>
              <button 
                onClick={() => examToDelete && handleDeleteExam(examToDelete)}
                disabled={isSaving}
                className="flex-1 h-12 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'ডিলিট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
      {showDeleteSubjectConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border animate-in zoom-in-95 duration-300`}>
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} text-center mb-2 font-noto`}>
               {lang === 'bn' ? 'কিতাবটি ডিলিট করবেন?' : 'Delete Subject?'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8 leading-relaxed">
               {lang === 'bn' ? 'এই কিতাবটি ডিলিট করলে এর সাথে যুক্ত সকল শিক্ষার্থীর নম্বর স্থায়ীভাবে মুছে যাবে।' : 'Deleting this subject will permanently remove all associated marks.'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowDeleteSubjectConfirm(false); setSubjectToDelete(null); }}
                className={`flex-1 h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'} font-black rounded-xl active:scale-95 transition-all`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDeleteSubject}
                disabled={isSaving}
                className="flex-1 h-12 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : (lang === 'bn' ? 'ডিলিট করুন' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDownloadLangModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-[2rem] p-6 w-full max-w-sm shadow-2xl`}>
                  <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} mb-4 text-center`}>Select Language / ভাষা নির্বাচন করুন</h3>
                  <div className="space-y-3">
                      <button 
                          onClick={() => {
                              if (downloadAction) downloadAction('en');
                              setShowDownloadLangModal(false);
                          }}
                          className={`w-full py-3 ${madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-[#2563EB] border-blue-100'} font-bold rounded-xl border hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors`}
                      >
                          English
                      </button>
                      <button 
                          onClick={() => {
                              if (downloadAction) downloadAction('bn');
                              setShowDownloadLangModal(false);
                          }}
                          className={`w-full py-3 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} font-bold rounded-xl border hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors`}
                      >
                          বাংলা (Bengali)
                      </button>
                      <button 
                          onClick={() => setShowDownloadLangModal(false)}
                          className={`w-full py-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'} font-bold rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-4`}
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showAddExam && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} w-full max-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95`}>
             <div className="flex items-center justify-between">
               <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{editingExam ? 'পরীক্ষা এডিট করুন' : 'নতুন পরীক্ষা (বেফাক)'}</h3>
               <button onClick={() => { setShowAddExam(false); setEditingExam(null); setExamName(''); setClassId(''); setIsPublished(false); }} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all`} placeholder="পরীক্ষার নাম" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                <div className="relative"><input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all`} placeholder="সাল (যেমন: ২০২৪)" value={examYear} onChange={(e) => setExamYear(e.target.value)} /><Calendar className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                <div className="relative">
                    <select className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 appearance-none transition-all`} value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">মারহালা (ক্লাস) বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <input 
                    type="checkbox" 
                    id="isPublishedBefaqInput" 
                    checked={isPublished} 
                    onChange={(e) => setIsPublished(e.target.checked)} 
                    className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-600" 
                  />
                  <label htmlFor="isPublishedBefaqInput" className={`text-xs font-bold ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'} font-noto cursor-pointer select-none`}>ফলাফল প্রকাশ করুন (Publish Results)</label>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> {editingExam ? 'আপডেট করুন' : 'পরীক্ষা তৈরি করুন'}</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddSubject && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95`}>
             <div className="flex items-center justify-between">
               <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{editingSubject ? 'কিতাব এডিট করুন' : 'কিতাব যোগ করুন'}</h3>
               <button onClick={() => { setShowAddSubject(false); setEditingSubject(null); setSubName(''); setSortOrder('0'); }} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all`} placeholder="কিতাবের নাম" value={subName} onChange={(e) => setSubName(e.target.value)} /><BookOpen size={20} className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all`} placeholder="মোট নম্বর" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} /><CreditCard className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                    <div className="relative"><input type="number" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all`} placeholder="পাস নম্বর" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} /><CreditCard className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                </div>
                <div className="relative">
                    <input 
                      type="number" 
                      className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all`} 
                      placeholder="সিরিয়াল নম্বর (Sort Order)" 
                      value={sortOrder} 
                      onChange={(e) => setSortOrder(e.target.value)} 
                    />
                    <Hash className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/>
                    <p className="text-[10px] text-slate-400 font-bold ml-4 mt-1">বিষয়টি কোন সিরিয়ালে থাকবে তা এখানে লিখুন (যেমন: ১, ২, ৩...)</p>
                </div>
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'কিতাব সেভ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm rounded-[3rem] shadow-2xl border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <div className="p-8 text-center">
                <div className="relative inline-block mb-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                    className="w-24 h-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-500/30 relative z-10"
                  >
                    <CheckCircle2 size={48} className="text-white" />
                  </motion.div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-emerald-500 rounded-[2rem] blur-2xl -z-10"
                  />
                </div>
                
                <h3 className={`text-2xl font-black mb-2 font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                  {lang === 'bn' ? 'সফলভাবে সংরক্ষিত!' : 'Successfully Saved!'}
                </h3>
                <p className={`text-sm font-bold mb-8 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {lang === 'bn' ? 'পরীক্ষার নম্বরগুলো ডাটাবেসে সফলভাবে আপডেট করা হয়েছে।' : 'The exam marks have been successfully updated in the database.'}
                </p>
                
                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-5 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-lg"
                >
                  {lang === 'bn' ? 'ঠিক আছে' : 'Awesome'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BefaqResultEngine;
