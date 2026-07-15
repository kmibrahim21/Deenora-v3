import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from 'supabase';
import { requestManager } from '../../../../services/RequestManager';
import { Institution, Class, Student, Exam, ExamSubject, Language, UserRole, ExamRoom, SeatAssignment, Profile } from 'types';
import { GraduationCap, Plus, ChevronRight, BookOpen, Trophy, Save, X, Edit3, Trash2, HelpCircle, Loader2, ArrowLeft, Calendar, LayoutGrid, CheckCircle2, FileText, Send, User, Hash, Star, AlertCircle, TrendingUp, Download, CreditCard, Grid3X3, Printer, RefreshCw, Clock, Palette, ZoomIn, ZoomOut, Maximize, Upload } from 'lucide-react';
import { t } from 'translations';
import { sortMadrasahClasses } from '../../../../pages/Classes';
import SmartResultAnalytics from '../../../../components/SmartResultAnalytics';
import FinalResults from './FinalResults';
import { generateSeatPlanPDF, generateResultPDF, generateClassResultPDF, generateExamRoutinePDF, generateMassMarksheetPDF } from '../../../../utils/pdfGenerator';
import { generateAdmitCardPDF } from '../../../../utils/admitCardGenerator';

interface SchoolResultEngineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  activeYear?: any;
  onNavigateToFinalResults?: () => void;
  profile?: Profile | null;
}

const SchoolResultEngine: React.FC<SchoolResultEngineProps> = ({ lang, madrasah, onBack, role, activeYear, onNavigateToFinalResults, profile }) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'final-results' | 'seat-plan' | 'analytics' | 'exam-routine'>('exams');
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report'>('list');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [marksData, setMarksData] = useState<any>({});
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Seat Plan State
  const [rooms, setRooms] = useState<ExamRoom[]>([{ id: '1', room_name: 'Room 101', capacity: 30 }]);
  const [seatAssignments, setSeatAssignments] = useState<SeatAssignment[]>([]);
  const [selectedClassesForSeatPlan, setSelectedClassesForSeatPlan] = useState<string[]>([]);
  const [seatPlanConfig, setSeatPlanConfig] = useState({
      randomize: false
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<ExamSubject | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSubjectConfirm, setShowDeleteSubjectConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [modalMode, setModalMode] = useState<'success' | 'error' | 'confirm'>('success');
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [cancelText, setCancelText] = useState('');

  // Exam Routine Feature States
  const [routineTermGroup, setRoutineTermGroup] = useState<string>('');
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

  // Load saved routines from config_json
  React.useEffect(() => {
    if ((madrasah?.config_json as any)?.saved_exam_routines) {
      setSavedRoutines((madrasah.config_json as any).saved_exam_routines);
    }
  }, [madrasah?.config_json]);

  // Scaler Hook/Ref for responsive A4 Live Preview
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [userZoom, setUserZoom] = useState<number>(1);

  const fetchClassAttendanceStats = async (classId: string) => {
    if (!madrasah || !activeYear) return {};
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('institution_id', madrasah.id)
        .eq('class_id', classId)
        .gte('date', activeYear.start_date || '')
        .lte('date', activeYear.end_date || '');
      
      if (error) throw error;
      
      const stats: Record<string, { present: number, total: number }> = {};
      data?.forEach((record: any) => {
        if (!stats[record.student_id]) {
          stats[record.student_id] = { present: 0, total: 0 };
        }
        stats[record.student_id].total += 1;
        if (record.status === 'present' || record.status === 'late') {
          stats[record.student_id].present += 1;
        }
      });
      
      const percentages: Record<string, string> = {};
      for (const [studentId, stat] of Object.entries(stats)) {
        if (stat.total > 0) {
          percentages[studentId] = Math.round((stat.present / stat.total) * 100).toString();
        }
      }
      return percentages;
    } catch (err) {
      console.error('Error fetching attendance stats:', err);
      return {};
    }
  };

  const routineThemes = {
    'emerald': { primary: '#013c28', secondary: '#023c28', light: '#E6F4EA', accent: '#EAF7EE' },
    'blue': { primary: '#1e3a8a', secondary: '#1e40af', light: '#eff6ff', accent: '#f8fafc' },
    'slate': { primary: '#334155', secondary: '#475569', light: '#f1f5f9', accent: '#f8fafc' },
    'purple': { primary: '#581c87', secondary: '#6b21a8', light: '#faf5ff', accent: '#fdf4ff' },
    'rose': { primary: '#881337', secondary: '#9f1239', light: '#fff1f2', accent: '#fff5f5' }
  };
  const rtTheme = routineThemes[routineThemeColor as keyof typeof routineThemes] || routineThemes.emerald;

  React.useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // On mobile/narrow screens, allow a slightly larger scale even if it overflows slightly 
        // to improve readability of the small text
        const isMobile = window.innerWidth < 768;
        const targetWidth = 1123; // Landscape width
        // On mobile, try to fit the width more accurately with slight padding
        const s = Math.min(1.2, isMobile ? (width / 1160) : (width / (targetWidth + 40)));
        setPreviewScale(s);
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  // Set default Selected Class for Routine
  React.useEffect(() => {
    if (classes.length > 0 && !selectedRoutineClassId) {
      setSelectedRoutineClassId(classes[0].id);
    }
  }, [classes, selectedRoutineClassId]);

  // Dynamic Exam Group Names compiled from existing exams
  const examTermGroups = React.useMemo(() => {
    const groups = new Set<string>();
    exams.forEach(e => {
      const cleaned = e.exam_name.replace(/[0-9]|Class|শ্রেণি|শ্রেণী/g, '').trim();
      if (cleaned) groups.add(cleaned);
    });
    const arr = Array.from(groups);
    return arr.length > 0 ? arr : ['প্রথম সাময়িক', 'অর্ধ-বার্ষিক', 'বার্ষিক'];
  }, [exams]);

  // Set default Term Group
  React.useEffect(() => {
    if (examTermGroups.length > 0 && !routineTermGroup) {
      setRoutineTermGroup(examTermGroups[0]);
    }
  }, [examTermGroups, routineTermGroup]);

  // Update routine times whenever start/end times change
  React.useEffect(() => {
    const formatTime = (time24: string) => {
      const [h, m] = time24.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
    };
    setRoutineMorningTime(`${formatTime(routineMorningStart)} - ${formatTime(routineMorningEnd)}`);
    setRoutineAfternoonTime(`${formatTime(routineAfternoonStart)} - ${formatTime(routineAfternoonEnd)}`);
  }, [routineMorningStart, routineMorningEnd, routineAfternoonStart, routineAfternoonEnd]);

  // Automatically fetch / prepare data when active tab is exam-routine or filters update
  React.useEffect(() => {
    if (isRestoringRoutine) return;
    
    const loadRoutineData = async () => {
      try {
        let relevantExams = [];
        
        if (routineSelectionMode === 'class' && selectedRoutineClassId) {
          if (selectedRoutineExamId) {
            const pickedExam = exams.find(e => e.id === selectedRoutineExamId);
            if (pickedExam) relevantExams = [pickedExam];
          } else {
            const classExams = exams.filter(e => e.class_id === selectedRoutineClassId);
            if (classExams.length > 0) {
              relevantExams = [classExams[0]];
            }
          }
        } else {
          if (selectedRoutineAllExamIds.length > 0) {
            relevantExams = exams.filter(e => selectedRoutineAllExamIds.includes(e.id));
          } else {
            if (!routineTermGroup) return;
            const targetTerm = routineTermGroup;
            relevantExams = exams.filter(e => e.exam_name.includes(targetTerm));
          }
        }

        if (relevantExams.length === 0) {
          setDefaultSampleRoutine();
          return;
        }

        const { data: allSubs, error } = await supabase
          .from('exam_subjects')
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
            const cls = classes.find(c => c.id === exam?.class_id);
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
            { classId: 'p', className: lang === 'bn' ? 'প্লে' : 'Play', subject: lang === 'bn' ? 'আরবি' : 'Arabic' },
            { classId: 'n', className: lang === 'bn' ? 'নার্সারি' : 'Nursery', subject: lang === 'bn' ? 'আরবি' : 'Arabic' },
            { classId: '1', className: lang === 'bn' ? 'প্রথম শ্রেণি' : 'Class 1', subject: lang === 'bn' ? 'কুরআন মজিদ' : 'Quran' },
            { classId: '2', className: lang === 'bn' ? 'দ্বিতীয় শ্রেণি' : 'Class 2', subject: lang === 'bn' ? 'কুরআন মজিদ' : 'Quran' },
            { classId: '3', className: lang === 'bn' ? 'তৃতীয় শ্রেণি' : 'Class 3', subject: lang === 'bn' ? 'তাজবীদ ও আকাইদ' : 'Tajweed' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'রোববার' : 'Sunday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'প্লে' : 'Play', subject: lang === 'bn' ? 'বাংলা' : 'Bangla' },
            { classId: 'n', className: lang === 'bn' ? 'নার্সারি' : 'Nursery', subject: lang === 'bn' ? 'বাংলা' : 'Bangla' },
            { classId: '1', className: lang === 'bn' ? 'প্রথম শ্রেণি' : 'Class 1', subject: lang === 'bn' ? 'সহজ বাংলা' : 'Bangla' },
            { classId: '2', className: lang === 'bn' ? 'দ্বিতীয় শ্রেণি' : 'Class 2', subject: lang === 'bn' ? 'সহজ বাংলা' : 'Bangla' },
            { classId: '3', className: lang === 'bn' ? 'তৃতীয় শ্রেণি' : 'Class 3', subject: lang === 'bn' ? 'বাংলা সাহিত্য' : 'Bangla Literature' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'সোমবার' : 'Monday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'প্লে' : 'Play', subject: lang === 'bn' ? 'ইংরেজি' : 'English' },
            { classId: 'n', className: lang === 'bn' ? 'নার্সারি' : 'Nursery', subject: lang === 'bn' ? 'ইংরেজি' : 'English' },
            { classId: '1', className: lang === 'bn' ? 'প্রথম শ্রেণি' : 'Class 1', subject: lang === 'bn' ? 'ইংরেজি' : 'English' },
            { classId: '2', className: lang === 'bn' ? 'দ্বিতীয় শ্রেণি' : 'Class 2', subject: lang === 'bn' ? 'ইংরেজি' : 'English' },
            { classId: '3', className: lang === 'bn' ? 'তৃতীয় শ্রেণি' : 'Class 3', subject: lang === 'bn' ? 'ইংরেজী ব্যাকরণ' : 'Grammar' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'মঙ্গলবার' : 'Tuesday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'প্লে' : 'Play', subject: lang === 'bn' ? 'গণিত' : 'Math' },
            { classId: 'n', className: lang === 'bn' ? 'নার্সারি' : 'Nursery', subject: lang === 'bn' ? 'গণিত' : 'Math' },
            { classId: '1', className: lang === 'bn' ? 'প্রথম শ্রেণি' : 'Class 1', subject: lang === 'bn' ? 'এসো অংক শিখি' : 'Math' },
            { classId: '2', className: lang === 'bn' ? 'দ্বিতীয় শ্রেণি' : 'Class 2', subject: lang === 'bn' ? 'এসো অংক শিখি' : 'Math' },
            { classId: '3', className: lang === 'bn' ? 'তৃতীয় শ্রেণি' : 'Class 3', subject: lang === 'bn' ? 'গণিত ও বিজ্ঞান' : 'Math' }
          ]
        },
        { 
          dayName: lang === 'bn' ? 'বুধবার' : 'Wednesday',
          subjects: [
            { classId: 'p', className: lang === 'bn' ? 'প্লে' : 'Play', subject: lang === 'bn' ? 'দ্বীনিয়্যাত' : 'Deeniyat' },
            { classId: 'n', className: lang === 'bn' ? 'নার্সারি' : 'Nursery', subject: lang === 'bn' ? 'দ্বীনিয়্যাত' : 'Deeniyat' },
            { classId: '1', className: lang === 'bn' ? 'প্রথম শ্রেণি' : 'Class 1', subject: lang === 'bn' ? 'আকাঈদ ও ফিকাহ' : 'Aqaid' },
            { classId: '2', className: lang === 'bn' ? 'দ্বিতীয় শ্রেণি' : 'Class 2', subject: lang === 'bn' ? 'আকাঈদ ও ফিকাহ' : 'Aqaid' },
            { classId: '3', className: lang === 'bn' ? 'তৃতীয় শ্রেণি' : 'Class 3', subject: lang === 'bn' ? 'সীরাতুন্নবী' : 'Seerat' }
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
  }, [routineTermGroup, exams, classes, routineMorningTime, routineAfternoonTime, lang, routineSelectionMode, selectedRoutineClassId, selectedRoutineExamId, selectedRoutineAllExamIds]);

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
      const classExams = exams.filter(e => e.class_id === selectedRoutineClassId);
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
    
    if (routineTermGroup) {
      const matched = exams.find(e => {
        const cleaned = e.exam_name.replace(/[0-9]|Class|শ্রেণি|শ্রেণী/g, '').trim();
        return cleaned.includes(routineTermGroup) || routineTermGroup.includes(cleaned);
      });
      if (matched) {
        return matched.exam_name.replace(/Class\s*\d+|Class\s*[a-zA-Z]+|\d+\s*শ্রেণি|\d+\s*শ্রেণী|শ্রেণি\s*\d+|শ্রেণী\s*\d+|প্লে|নার্সারি|প্রথম|দ্বিতীয়|তৃতীয়|চতুর্থ|পঞ্চম|ষষ্ঠ|সপ্তম|অষ্টম|নবম|দশম/g, '').trim();
      }
    }
    if (exams.length > 0) {
      return exams[0].exam_name.replace(/Class\s*\d+|Class\s*[a-zA-Z]+|\d+\s*শ্রেণি|\d+\s*শ্রেণী|শ্রেণি\s*\d+|শ্রেণী\s*\d+|প্লে|নার্সারি|প্রথম|দ্বিতীয়|তৃতীয়|চতুর্থ|পঞ্চম|ষষ্ঠ|সপ্তম|অষ্টম|নবম|দশম/g, '').trim();
    }
    return lang === 'bn' ? 'বার্ষিক পরীক্ষা' : 'Annual Exam';
  }, [routineSelectionMode, selectedRoutineClassId, exams, routineTermGroup, classes, lang, customRoutineTitle, selectedRoutineExamId]);

  // Compute display classes for routine mode
  const routineDisplayClasses = React.useMemo(() => {
    if (classes.length === 0) return [];
    if (routineSelectionMode === 'all' && selectedRoutineAllExamIds.length > 0) {
      return classes.filter(c => selectedRoutineAllExamIds.some(examId => exams.find(e => e.id === examId)?.class_id === c.id));
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
    
    const newRow = {
      id: crypto.randomUUID(),
      isoDate,
      date: dateStr,
      day: dayStr,
      morning: { 
        time: routineMorningTime || '09:00 AM - 12:00 PM', 
        subjects: [] 
      },
      afternoon: { 
        time: routineAfternoonTime || '02:00 PM - 05:00 PM', 
        subjects: [] 
      }
    };
    if (routineSelectionMode === 'class') {
      newRow.morning.subjects = [{ 
        classId: selectedRoutineClassId, 
        className: classes.find(c => c.id === selectedRoutineClassId)?.class_name || 'Class', 
        subject: '' 
      }];
    }
    setRoutineData([...routineData, newRow]);
  };

  const handleRemoveRoutineDay = (id: string) => {
    setRoutineData(prev => prev.filter(d => d.id !== id));
  };

  const saveRoutineToDB = async () => {
    if (!madrasah) return;
    try {
      const payload = {
        id: Date.now().toString(),
        name: customRoutineTitle || activeExamName || (lang === 'bn' ? 'পরীক্ষার রুটিন' : 'Exam Routine'),
        createdAt: new Date().toISOString(),
        routineData,
        routineInstructions,
        routineMorningTime,
        routineAfternoonTime,
        routineThemeColor,
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
        selectedRoutineAllExamIds,
        routineTermGroup
      };

      const currentConfig = madrasah.config_json || {};
      const updatedRoutines = [...((currentConfig as any).saved_exam_routines || []), payload];
      const updatedConfig = { ...currentConfig, saved_exam_routines: updatedRoutines };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;
      setSavedRoutines(updatedRoutines);
      // We also update the madrasah prop config_json contextually to keep UI in sync without reload
      if (madrasah.config_json) {
        (madrasah.config_json as any).saved_exam_routines = updatedRoutines;
      }
      
      setSuccessTitle(lang === 'bn' ? 'রুটিন সেভ হয়েছে' : 'Routine Saved');
      setSuccessMessage(lang === 'bn' ? 'আপনার পরীক্ষার রুটিনটি সফলভাবে সার্ভারে সংরক্ষিত হয়েছে।' : 'Your exam routine has been successfully saved to the server.');
      setModalMode('success');
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error saving routine:', err);
      setSuccessTitle(lang === 'bn' ? 'সমস্যা হয়েছে' : 'Error Occurred');
      setSuccessMessage(lang === 'bn' ? 'রুটিন সেভ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।' : 'Failed to save routine. Please try again.');
      setModalMode('error');
      setShowSuccessModal(true);
    }
  };

  const loadRoutineFromDB = (routine: any) => {
    setIsRestoringRoutine(true);

    if (routine.routineData) setRoutineData(routine.routineData);
    if (routine.routineInstructions) setRoutineInstructions(routine.routineInstructions);
    if (routine.routineMorningTime) setRoutineMorningTime(routine.routineMorningTime);
    if (routine.routineAfternoonTime) setRoutineAfternoonTime(routine.routineAfternoonTime);
    if (routine.routineThemeColor) setRoutineThemeColor(routine.routineThemeColor);
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
    if (routine.routineTermGroup) setRoutineTermGroup(routine.routineTermGroup);

    setSuccessTitle(lang === 'bn' ? 'রুটিন লোড হয়েছে' : 'Routine Loaded');
    setSuccessMessage(lang === 'bn' ? 'রুটিনটি সফলভাবে লোড করা হয়েছে। আপনি এখন এটি এডিট করতে পারেন।' : 'Routine has been loaded successfully. You can now edit it.');
    setModalMode('success');
    setShowSuccessModal(true);

    // Release the lock after a delay to ensure effects have finished triggering
    setTimeout(() => {
      setIsRestoringRoutine(false);
    }, 500);
  };

  const deleteRoutineFromDB = async (id: string) => {
    if (!madrasah) return;
    
    setModalMode('confirm');
    setSuccessTitle(lang === 'bn' ? 'মুছে ফেলতে নিশ্চিত?' : 'Confirm Delete');
    setSuccessMessage(lang === 'bn' ? 'আপনি কি রুটিনটি মুছে ফেলতে নিশ্চিত?' : 'Are you sure you want to delete this routine?');
    setConfirmText(lang === 'bn' ? 'মুছে ফেলুন' : 'Delete');
    setCancelText(lang === 'bn' ? 'বাতিল' : 'Cancel');
    
    setOnConfirm(() => async () => {
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
        
        setSuccessTitle(lang === 'bn' ? 'রুটিন মুছে ফেলা হয়েছে' : 'Routine Deleted');
        setSuccessMessage(lang === 'bn' ? 'রুটিনটি সফলভাবে তালিকা থেকে সরিয়ে ফেলা হয়েছে।' : 'The routine has been successfully removed from the list.');
        setModalMode('success');
        setShowSuccessModal(true);
      } catch (err) {
        console.error('Error deleting routine:', err);
        setSuccessTitle(lang === 'bn' ? 'মুছে ফেলা যায়নি' : 'Delete Failed');
        setSuccessMessage(lang === 'bn' ? 'রুটিন মুছতে সমস্যা হয়েছে।' : 'Failed to delete routine.');
        setModalMode('error');
        setShowSuccessModal(true);
      }
    });

    setShowSuccessModal(true);
  };

  const handleDownloadCustomExamRoutine = async () => {
    setIsDownloading(true);
    try {
      const isExamPostfixBn = activeExamName.endsWith('পরীক্ষা');
      const isExamPostfixEn = activeExamName.toLowerCase().endsWith('exam');
      const examTitle = lang === 'bn' 
        ? (isExamPostfixBn ? `${activeExamName} সময়সূচি` : `${activeExamName} পরীক্ষার সময়সূচি`)
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
          themeColor: routineThemeColor
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Dynamic configuration helper
  const config = React.useMemo(() => {
    let conf = madrasah?.config_json as any;
    if (typeof conf === 'string') {
      try {
        conf = JSON.parse(conf);
      } catch (e) {
        conf = {};
      }
    }
    return (typeof conf === 'object' && conf !== null) ? conf : {};
  }, [madrasah]);

  const resultSystem = config.result_system || 'grading';

  // Dynamic module configuration
  const modules = React.useMemo(() => {
    return {
      attendance: config.modules?.attendance ?? true,
      results: config.modules?.results ?? true,
      admit_card: config.modules?.admit_card ?? true,
      seat_plan: config.modules?.seat_plan ?? true,
      accounting: config.modules?.accounting ?? true,
      academic_year_promotion: config.modules?.academic_year_promotion ?? true,
      voice_broadcast: config.modules?.voice_broadcast ?? true,
      sms: config.modules?.sms ?? true,
      exam_routine: config.modules?.exam_routine ?? true,
    };
  }, [config]);

  // Form states
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState(activeYear?.start_date || new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [subName, setSubName] = useState('');
  const [fullMarks, setFullMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('33');
  const [sortOrder, setSortOrder] = useState('0');
  const [isOptional, setIsOptional] = useState(false);

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
    }
  }, [madrasah?.id]);

  useEffect(() => {
    if (madrasah) {
      if (activeTab === 'exam-routine') {
        fetchExams(routineSelectionMode === 'all' ? null : selectedRoutineClassId);
      } else if (selectedClassId) {
        fetchExams(selectedClassId);
      }
    }
  }, [madrasah?.id, selectedClassId, view, activeTab, selectedRoutineClassId, routineSelectionMode]);

  const fetchExams = async (targetClassId?: string | null) => {
    if (!madrasah) return;
    const activeYearId = madrasah?.config_json?.active_academic_year_id;
    const classToFetch = targetClassId !== undefined ? targetClassId : selectedClassId;
    
    const cacheKey = `exams:${madrasah.id}:${classToFetch || 'all'}:${activeYearId || 'no-year'}`;
    
    const { data } = await requestManager.cachedFetch('exams', (q: any) => {
      let query = q.select('*, classes(class_name)').eq('institution_id', madrasah.id);
      
      if (activeYearId) {
        query = query.eq('academic_year_id', activeYearId);
      } else {
        const yearStart = madrasah?.config_json?.academic_year_start;
        if (yearStart) {
          query = query.gte('created_at', yearStart);
        }
      }

      if (classToFetch) {
          query = query.eq('class_id', classToFetch);
      }
      return query.order('created_at', { ascending: false });
    }, cacheKey);

    if (data) {
      let filteredExams = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredExams = data.filter((exam: any) => profile.permissions?.allowed_classes?.includes(exam.class_id));
      }
      setExams(filteredExams);
    }
    setLoading(false);
  };

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data } = await requestManager.cachedFetch('classes', (q: any) => 
      q.select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
      `classes:${madrasah.id}`
    );
    
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter((cls: any) => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
    setLoading(false);
  };

  const fetchSubjects = async (examId: string) => {
    setLoading(true);
    const { data } = await requestManager.cachedFetch('exam_subjects', (q: any) => 
      q.select('*').eq('exam_id', examId).order('sort_order', { ascending: true }),
      `exam_subjects:${examId}`
    );

    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchMarkEntryData = async (examId: string, classId: string) => {
    setLoading(true);
    const activeYearId = madrasah?.config_json?.active_academic_year_id;
    
    // 1. Fetch Students of the exam's class
    const { data: stds } = await requestManager.cachedFetch('students', (q: any) => {
      let query = q.select('*').eq('class_id', classId).order('roll', { ascending: true });
      if (activeYearId) {
        query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }
      if ((window as any)._hasIsActive !== false) {
        query = query.eq('is_active', true);
      }
      return query;
    }, `students:${classId}:${activeYearId || 'no-year'}`);

    // 2. Fetch existing marks
    const { data: marks } = await requestManager.cachedFetch('exam_marks', (q: any) => 
      q.select('*').eq('exam_id', examId),
      `exam_marks:${examId}`
    );
    
    // 3. Load manual attendance from config
    const manualAttendanceMap = madrasah?.config_json?.exam_manual_attendance?.[examId] || {};
    
    if (stds) setStudents(stds);
    if (marks) {
        const initialMarks: any = {};
        marks.forEach((m: any) => {
            if (!initialMarks[m.student_id]) initialMarks[m.student_id] = {};
            initialMarks[m.student_id][m.subject_id] = m.marks_obtained;
        });
        
        // Fill manual attendance
        Object.entries(manualAttendanceMap).forEach(([studentId, val]: [string, any]) => {
            if (!initialMarks[studentId]) initialMarks[studentId] = {};
            initialMarks[studentId]['attendance'] = val;
        });
        
        setMarksData(initialMarks);
    }
    setLoading(false);
  };

  const handleDownloadExamRoutineMaster = async () => {
    if (!madrasah || exams.length === 0) return;
    setIsDownloading(true);

    try {
      // 1. Identify "Terms" or Exam Names
      const demoExamGroups = Array.from(new Set(exams.map(e => e.exam_name.replace(/[0-9]|Class|শ্রেণি|শ্রেণী/g, '').trim())));
      const targetTerm = demoExamGroups[0] || 'পরীক্ষা';
      
      const relevantExams = exams.filter(e => e.exam_name.includes(targetTerm));
      
      // 2. Fetch all subjects for these exams
      const { data: allSubs } = await requestManager.cachedFetch('exam_subjects', (q: any) => 
        q.select('*').in('exam_id', relevantExams.map(e => e.id)).order('sort_order', { ascending: true }),
        `exam_subjects:multiple:${relevantExams.map(e => e.id).join('-')}`
      );
      
      if (!allSubs || allSubs.length === 0) {
        alert(lang === 'bn' ? 'কোনো বিষয় পাওয়া যায়নি' : 'No subjects found for routine');
        return;
      }

      // 3. Build a "Smart Routine" starting from the earliest exam_date
      const startDate = new Date(Math.min(...relevantExams.map(e => new Date(e.exam_date).getTime())));
      
      // We group subjects by their sort_order (Day 1, Day 2, etc.)
      const maxSlots = Math.max(...allSubs.map(s => s.sort_order || 0)) + 1;
      const routineData: any[] = [];
      
      let currentDate = new Date(startDate);
      const weeklyHolidays = madrasah?.config_json?.weekly_holidays || [5];
      for (let i = 0; i < maxSlots; i++) {
        while (weeklyHolidays.includes(currentDate.getDay())) {
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const dateStr = currentDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const dayStr = currentDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long' });

        const slotSubs = allSubs.filter(s => s.sort_order === i);
        if (slotSubs.length === 0) continue;

        const morningSubjects = slotSubs.map(s => {
          const exam = relevantExams.find(e => e.id === s.exam_id);
          return {
            className: exam?.classes?.class_name || 'Class',
            subject: s.subject_name
          };
        });

        routineData.push({
          date: dateStr,
          day: dayStr,
          morning: {
            time: '09:00 - 12:00',
            subjects: morningSubjects
          },
          afternoon: {
            time: '',
            subjects: [] // Usually morning only for standard exams, or interleaved
          }
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const examTitle = lang === 'bn' ? `${targetTerm} পরীক্ষার সময়সূচি - ${currentYearBn}` : `${targetTerm} Exam Schedule - ${currentYear}`;
      await generateExamRoutinePDF(madrasah, examTitle, routineData, lang, { 
        examYear: currentYear,
        themeColor: routineThemeColor 
      });
    } catch (error) {
      console.error('Error generating routine:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchRanking = async (examId: string, classId: string) => {
    setLoading(true);
    try {
      const activeYearId = madrasah?.config_json?.active_academic_year_id;
      
      // Fetch data for ranking computation
      const [subsRes, studentsRes, marksRes] = await Promise.all([
        requestManager.cachedFetch('exam_subjects', (q: any) => q.select('*').eq('exam_id', examId), `exam_subjects:${examId}`),
        requestManager.cachedFetch('students', (q: any) => {
          let query = q.select('*').eq('class_id', classId);
          if (activeYearId) query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
          if ((window as any)._hasIsActive !== false) query = query.eq('is_active', true);
          return query;
        }, `students:${classId}:${activeYearId || 'no-year'}`),
        requestManager.cachedFetch('exam_marks', (q: any) => q.select('*').eq('exam_id', examId), `exam_marks:${examId}`)
      ]);

      const subs = subsRes.data || [];
      const stds = studentsRes.data || [];
      const mks = marksRes.data || [];

      const sortedRanked = stds.map(student => {
        const studentMarksForStudent = mks.filter(m => m.student_id === student.id);
        const studentMarksObjLocal: Record<string, string> = {};
        studentMarksForStudent.forEach(m => {
          studentMarksObjLocal[m.subject_id] = m.marks_obtained;
        });

        let totalMarks = 0;
        let totalPossible = 0;
        let passStatus = true;
        let pointsSum = 0;
        let numMainSubjects = 0;

        subs.forEach(sub => {
          const score = parseFloat(studentMarksObjLocal[sub.id] || '0');
          const isOptionalEffectively = !!sub.is_optional && resultSystem === 'grading_optional';
          const failed = score < (sub.pass_marks || 33);
          
          if (!isOptionalEffectively && failed) passStatus = false;

          const pct = (score / (sub.full_marks || 100)) * 100;
          const { gpa: gpStr } = getGradeInfo(pct, !failed);
          const gp = parseFloat(gpStr);

          if (resultSystem === 'grading_optional') {
            if (!sub.is_optional) {
              totalMarks += score;
              totalPossible += (sub.full_marks || 100);
              pointsSum += gp;
              numMainSubjects++;
            } else {
              if (gp > 2) pointsSum += (gp - 2);
            }
          } else {
            totalMarks += score;
            totalPossible += (sub.full_marks || 100);
            pointsSum += gp;
            numMainSubjects++;
          }
        });

        // For non grading_optional, we still need totalPossible for pct if used
        if (subs.length === 0) passStatus = totalMarks > 0;

        let finalGpa = '0.00';
        if ((resultSystem === 'grading' || resultSystem === 'grading_optional') && numMainSubjects > 0) {
          if (!passStatus) finalGpa = '0.00';
          else {
            let avgGp = pointsSum / numMainSubjects;
            if (avgGp > 5.0) avgGp = 5.0;
            finalGpa = avgGp.toFixed(2);
          }
        }

        return {
          student_id: student.id,
          student_name: student.student_name,
          roll: student.roll,
          total_marks: totalMarks,
          pass_status: passStatus,
          gpa: finalGpa
        };
      })
      .sort((a, b) => {
        if (a.pass_status && !b.pass_status) return -1;
        if (!a.pass_status && b.pass_status) return 1;
        
        // If GPA exists (grading mode), sort by GPA then total marks
        if (a.gpa !== '0.00' || b.gpa !== '0.00') {
           const gpaDiff = parseFloat(b.gpa) - parseFloat(a.gpa);
           if (Math.abs(gpaDiff) > 0.001) return gpaDiff;
        }
        return b.total_marks - a.total_marks;
      });

      let currentRank = 1;
      let lastRank = 1;
      const ranked = sortedRanked.map((item, idx) => {
        let rank = currentRank;
        if (idx > 0) {
          const prev = sortedRanked[idx - 1];
          if (prev.pass_status === item.pass_status && prev.total_marks === item.total_marks) {
            rank = lastRank;
          } else {
            rank = currentRank;
            lastRank = currentRank;
          }
        } else {
          rank = currentRank;
          lastRank = currentRank;
        }
        currentRank++;
        return { ...item, rank };
      });

      setRankingData(ranked);
    } catch (e) {
      console.error('Frontend Ranking Error:', e);
      setRankingData([]);
    }
    setLoading(false);
  };

  const getGradeInfo = (scorePercentage: number, passStatus: boolean) => {
    if (!passStatus) return { gpa: '0.00', grade: 'F' };
    
    if (scorePercentage >= 80) return { gpa: '5.00', grade: 'A+' };
    if (scorePercentage >= 70) return { gpa: '4.00', grade: 'A' };
    if (scorePercentage >= 60) return { gpa: '3.50', grade: 'A-' };
    if (scorePercentage >= 50) return { gpa: '3.00', grade: 'B' };
    if (scorePercentage >= 40) return { gpa: '2.00', grade: 'C' };
    return { gpa: '1.00', grade: 'D' };
  };

  const calculateStudentResult = (studentId: string, currentSubjects: ExamSubject[]) => {
    const studentMarksObj = marksData[studentId] || {};
    let totalMarks = 0;
    let totalPossible = 0;
    let hasFailedSub = false;

    let pointsSum = 0;
    let numMainSubjects = 0;

    for (const s of currentSubjects) {
      const obtained = parseFloat(studentMarksObj[s.id] || '0');
      const pass = s.pass_marks || 33;
      const full = s.full_marks || 100;
      
      const pct = (obtained / full) * 100;
      const failed = obtained < pass;

      const isOptionalEffectively = s.is_optional && resultSystem === 'grading_optional';

      if (!isOptionalEffectively && failed) {
        hasFailedSub = true;
      }

      const { gpa: gpStr } = getGradeInfo(pct, !failed);
      const gp = parseFloat(gpStr);

      if (resultSystem === 'grading_optional') {
        if (!s.is_optional) {
          totalMarks += obtained;
          totalPossible += full;
          pointsSum += gp;
          numMainSubjects++;
        } else {
          if (gp > 2) {
            pointsSum += (gp - 2);
          }
        }
      } else {
        totalMarks += obtained;
        totalPossible += full;
        pointsSum += gp;
        numMainSubjects++;
      }
    }

    const pct = totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0;

    if (numMainSubjects > 0) {
      if (hasFailedSub) return { total: totalMarks, average: pct, gpa: '0.00', grade: 'F', pass_status: false };
      
      let finalGpa = '0.00';
      let finalGrade = 'F';

      if (resultSystem === 'grading' || resultSystem === 'grading_optional') {
        let avgGp = pointsSum / numMainSubjects;
        if (avgGp > 5.0) avgGp = 5.0;
        finalGpa = avgGp.toFixed(2);
        
        if (avgGp >= 5.0) finalGrade = 'A+';
        else if (avgGp >= 4.0) finalGrade = 'A';
        else if (avgGp >= 3.5) finalGrade = 'A-';
        else if (avgGp >= 3.0) finalGrade = 'B';
        else if (avgGp >= 2.0) finalGrade = 'C';
        else if (avgGp >= 1.0) finalGrade = 'D';
        else finalGrade = 'F';
      } else {
        const gradeInfo = getGradeInfo(pct, !hasFailedSub);
        finalGpa = gradeInfo.gpa;
        finalGrade = gradeInfo.grade;
      }

      return { total: totalMarks, average: pct, gpa: finalGpa, grade: finalGrade, pass_status: true };
    }

    return { 
      total: totalMarks, 
      average: pct, 
      gpa: '0.00', 
      grade: 'F', 
      pass_status: false 
    };
  };

  // Template Configurations
  const admitCardTemplates = [
    { id: 'admission', name: lang === 'bn' ? 'ভর্তি পরীক্ষা (প্রিমিয়াম)' : 'Admission (Premium)', description: lang === 'bn' ? 'উন্নত মানের ডায়নামিক ডিজাইন' : 'High-quality dynamic design' },
    { id: 'classic', name: 'Classic', description: 'Traditional layout with border' },
    { id: 'modern', name: 'Modern', description: 'Clean design with accent colors' }
  ];

  const seatPlanTemplates = [
    { id: 'list', name: 'List View', description: 'Room-wise student list (Wall Posting)' },
    { id: 'grid', name: 'Grid View', description: 'Visual seat arrangement' }
  ];

  const [showAdmitCardModal, setShowAdmitCardModal] = useState(false);
  const [selectedAdmitCardTemplate, setSelectedAdmitCardTemplate] = useState('classic');
  const [selectedSeatPlanTemplate, setSelectedSeatPlanTemplate] = useState('list');
  const [examForAdmitCard, setExamForAdmitCard] = useState<Exam | null>(null);

  const handleDownloadAdmitCard = (exam: Exam) => {
      setExamForAdmitCard(exam);
      setShowAdmitCardModal(true);
  };

  const confirmDownloadAdmitCard = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!madrasah || !examForAdmitCard) return;
    
    setIsDownloading(true);
    try {
        // Fetch students for the exam class
        const { data: stds } = await requestManager.cachedFetch('students', (q: any) => {
          let query = q.select('*, classes(class_name)').eq('class_id', examForAdmitCard.class_id).order('roll', { ascending: true });
          if ((window as any)._hasIsActive !== false) query = query.eq('is_active', true);
          return query;
        }, `students:${examForAdmitCard.class_id}:with-classes`);
        
        if (!stds || stds.length === 0) {
            alert('No students found for this class');
            setIsDownloading(false);
            return;
        }

        await generateAdmitCardPDF(
            examForAdmitCard,
            stds,
            madrasah,
            selectedAdmitCardTemplate,
            downloadLang
        );
        setShowAdmitCardModal(false);
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading Admit Cards');
    } finally {
        setIsDownloading(false);
    }
  };

  const handleGenerateSeatPlan = async () => {
      if (selectedClassesForSeatPlan.length === 0) {
          alert('Please select at least one class');
          return;
      }
      
      setLoading(true);
      // Fetch students from selected classes
      const { data: stds } = await requestManager.cachedFetch('students', (q: any) => {
        let query = q.select('*, classes(class_name)')
          .in('class_id', selectedClassesForSeatPlan)
          .order('class_id', { ascending: true })
          .order('roll', { ascending: true });
        if ((window as any)._hasIsActive !== false) query = query.eq('is_active', true);
        return query;
      }, `students:seatplan:${selectedClassesForSeatPlan.join('-')}`);
        
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
      if (seatAssignments.length === 0) return;
      
      setIsDownloading(true);
      try {
        await generateSeatPlanPDF(
            seatAssignments,
            { name: madrasah?.name || 'Madrasah' },
            selectedSeatPlanTemplate,
            downloadLang
        );
      } catch (e) {
          console.error(e);
          alert('Error downloading Seat Plan');
      } finally {
          setIsDownloading(false);
      }
  };

  const handleAddExam = async () => {
    if (!madrasah || !examName || !classId) return;
    setIsSaving(true);
    try {
      const activeYearId = activeYear?.id || madrasah.config_json?.active_academic_year_id;
      
      // Validate UUID format for academic_year_id
      const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      const examData: any = {
        institution_id: madrasah.id,
        academic_year_id: (activeYearId && isValidUUID(activeYearId)) ? activeYearId : null,
        class_id: classId,
        exam_name: examName,
        exam_date: examDate,
        is_published: isPublished
      };

      let error;
      if (editingExam) {
        const { error: updateError } = await supabase
          .from('exams')
          .update(examData)
          .eq('id', editingExam.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('exams')
          .insert(examData);
        error = insertError;
      }
      
      // If still getting foreign key error, retry with null academic_year_id
      if (error && error.message.includes('foreign key constraint')) {
        console.warn('Foreign key violation for academic_year_id, retrying with null...');
        const retryData = { ...examData, academic_year_id: null };
        if (editingExam) {
          const { error: retryError } = await supabase.from('exams').update(retryData).eq('id', editingExam.id);
          error = retryError;
        } else {
          const { error: retryError } = await supabase.from('exams').insert(retryData);
          error = retryError;
        }
      }
      
      if (error) {
          console.error('Error saving exam:', error);
          alert('Failed to save exam: ' + error.message);
      } else {
        if (madrasah?.id) {
          requestManager.invalidatePattern(`exams:${madrasah.id}`);
          requestManager.invalidatePattern('dashboard_');
          // Also invalidate routine data as it depends on exams
          requestManager.invalidatePattern(`exam_subjects:`);
        }
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

  const handleEditClick = (exam: Exam) => {
    setEditingExam(exam);
    setExamName(exam.exam_name || '');
    setExamDate(exam.exam_date || '');
    setClassId(exam.class_id || '');
    setIsPublished(exam.is_published || false);
    setShowAddExam(true);
  };

  const handleDeleteExam = async (examId: string) => {
    setIsSaving(true);
    try {
      // Delete marks first
      await supabase.from('exam_marks').delete().eq('exam_id', examId);
      // Delete subjects
      await supabase.from('exam_subjects').delete().eq('exam_id', examId);
      // Delete exam
      const { error } = await supabase.from('exams').delete().eq('id', examId);
      
      if (error) {
        console.error('Error deleting exam:', error);
        alert('Failed to delete exam: ' + error.message);
      } else {
        if (madrasah?.id) {
          requestManager.invalidatePattern(`exams:${madrasah.id}`);
          requestManager.invalidatePattern(`exam_subjects:${examId}`);
          requestManager.invalidatePattern(`exam_marks:${examId}`);
          requestManager.invalidatePattern('dashboard_');
        }
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
    if (!selectedExam || !subName) return;
    setIsSaving(true);
    
    const subjectData = {
      exam_id: selectedExam.id,
      subject_name: subName,
      full_marks: parseInt(fullMarks),
      pass_marks: parseInt(passMarks),
      sort_order: parseInt(sortOrder) || 0,
      is_optional: isOptional
    };

    let error;
    if (editingSubject) {
      const { error: updateError } = await supabase
        .from('exam_subjects')
        .update(subjectData)
        .eq('id', editingSubject.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('exam_subjects')
        .insert(subjectData);
      error = insertError;
    }

    if (!error) {
      if (madrasah?.id) {
        requestManager.invalidatePattern(`exam_subjects:${selectedExam.id}`);
        requestManager.invalidatePattern('dashboard_');
      }
      setShowAddSubject(false);
      setEditingSubject(null);
      setSubName('');
      setSortOrder('0');
      setIsOptional(false);
      fetchSubjects(selectedExam.id);
    } else {
      console.error('Error saving subject:', error);
      alert('Failed to save subject: ' + error.message);
    }
    setIsSaving(false);
  };

  const handleEditSubjectClick = (subject: ExamSubject) => {
    setEditingSubject(subject);
    setSubName(subject.subject_name || '');
    setFullMarks(subject.full_marks?.toString() || '100');
    setPassMarks(subject.pass_marks?.toString() || '33');
    setSortOrder(subject.sort_order?.toString() || '0');
    setIsOptional(subject.is_optional || false);
    setShowAddSubject(true);
  };

  const handleDeleteSubject = (subjectId: string) => {
    setSubjectToDelete(subjectId);
    setShowDeleteSubjectConfirm(true);
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setIsSaving(true);
    const { error } = await supabase.from('exam_subjects').delete().eq('id', subjectToDelete);
    if (!error && selectedExam) {
      if (madrasah?.id) {
        requestManager.invalidatePattern(`exam_subjects:${selectedExam.id}`);
        // Routine data also depends on subjects
        requestManager.invalidatePattern(`exam_subjects:multiple:`);
        requestManager.invalidatePattern('dashboard_');
      }
      fetchSubjects(selectedExam.id);
    } else if (error) {
       console.error("Error deleting subject", error);
       alert(lang === 'bn' ? "বিষয়টি ডিলিট করা সম্ভব হয়নি।" : "Failed to delete subject.");
    }
    setIsSaving(false);
    setShowDeleteSubjectConfirm(false);
    setSubjectToDelete(null);
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setIsSaving(true);
    const payload: any[] = [];
    Object.entries(marksData).forEach(([studentId, subMarks]: any) => {
        Object.entries(subMarks).forEach(([subjectId, marks]) => {
            if (marks !== undefined && marks !== null && marks !== '') {
              payload.push({
                  exam_id: selectedExam.id,
                  student_id: studentId,
                  subject_id: subjectId,
                  marks_obtained: parseFloat(marks as string)
              });
            }
        });
    });

    // Validate that no marks exceed the subject's full marks
    for (const item of payload) {
        if (item.subject_id === 'attendance') continue;
        const sub = subjects.find(s => s.id === item.subject_id);
        if (sub && item.marks_obtained > sub.full_marks) {
            alert(lang === 'bn' ? `${sub.subject_name} বিষয়ের প্রাপ্ত নম্বর পূর্ণ নম্বর (${sub.full_marks}) এর বেশি হতে পারে না!` : `Obtained marks for ${sub.subject_name} cannot exceed full marks (${sub.full_marks})!`);
            setIsSaving(false);
            return;
        }
    }

    // Upsert logic
    for (const row of payload) {
        if (row.subject_id === 'attendance') continue; // Skip attendance here
        const { error } = await supabase.from('exam_marks').upsert(row, { onConflict: 'exam_id,student_id,subject_id' });
        if (error) {
            console.error("Error saving marks:", error);
            alert("Error saving marks: " + error.message);
            setIsSaving(false);
            return;
        }
    }
    
    // Save manual attendance to madrasah config
    try {
        const examId = selectedExam.id;
        const currentManualAttendance = madrasah?.config_json?.exam_manual_attendance || {};
        const examAttendance: any = {};
        
        Object.entries(marksData).forEach(([studentId, subMarks]: any) => {
            if (subMarks.attendance) {
                examAttendance[studentId] = subMarks.attendance;
            }
        });

        const { data: instData } = await supabase.from('institutions').select('config_json').eq('id', madrasah?.id).single();
        const updatedConfig = {
            ...(instData?.config_json || madrasah?.config_json || {}),
            exam_manual_attendance: {
                ...currentManualAttendance,
                [examId]: examAttendance
            }
        };

        const { error: configError } = await supabase.from('institutions').update({ config_json: updatedConfig }).eq('id', madrasah?.id);
        if (configError) throw configError;
    } catch (err) {
        console.error("Error saving manual attendance to config:", err);
    }
    
    if (madrasah?.id && selectedExam) {
      requestManager.invalidatePattern(`exam_marks:${selectedExam.id}`);
      requestManager.invalidatePattern('dashboard_');
    }

    setShowSuccessModal(true);
    setIsSaving(false);
  };

  const handleDownloadClassResult = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!selectedExam || !madrasah) return;
    
    setIsDownloading(true);
    // Ensure we have marks data
    if (Object.keys(marksData).length === 0) {
        await fetchMarkEntryData(selectedExam.id, selectedExam.class_id);
    }

    try {
      await generateClassResultPDF(
          selectedExam,
          subjects,
          students,
          marksData,
          madrasah,
          downloadLang
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadMassMarksheets = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!selectedExam || !madrasah) return;
    
    setIsDownloading(true);
    if (Object.keys(marksData).length === 0) {
        await fetchMarkEntryData(selectedExam.id, selectedExam.class_id);
    }
    
    const attStats = await fetchClassAttendanceStats(selectedExam.class_id);
    
    // We already have rankingData if view === 'report'. 
    // If not, fetchRanking should be called. 
    const validStudents = rankingData.filter((item: any) => students.find(st => st.id === item.student_id));
    
    const preppedStudents = validStudents.map((item: any) => {
        const studentObj = students.find(st => st.id === item.student_id);
        const resultInfo = calculateStudentResult(item.student_id, subjects);
        
        const studentMarks = marksData[item.student_id] || {};
        const preparedMarks = subjects.map(s => {
            const obtained = parseFloat(studentMarks[s.id] || '0');
            const full = s.full_marks || 100;
            const pass = s.pass_marks || 33;
            const pct = (obtained / full) * 100;
            const hasFailedSub = obtained < pass;
            
            const classHighest = Object.keys(marksData || {}).reduce((max, stdId) => {
                const markVal = parseFloat(marksData[stdId]?.[s.id] || '0');
                return markVal > max ? markVal : max;
            }, 0);
            
            const subGradeInfo = (p: number, f: boolean) => {
                if (f) return { gpa: '0.00', grade: 'F' };
                if (p >= 80) return { gpa: '5.00', grade: 'A+' };
                if (p >= 70) return { gpa: '4.00', grade: 'A' };
                if (p >= 60) return { gpa: '3.50', grade: 'A-' };
                if (p >= 50) return { gpa: '3.00', grade: 'B' };
                if (p >= 40) return { gpa: '2.00', grade: 'C' };
                return { gpa: '1.00', grade: 'D' };
            };

            return {
                subject_name: s.subject_name,
                marks_obtained: obtained,
                grade: subGradeInfo(pct, hasFailedSub).grade,
                grade_point: subGradeInfo(pct, hasFailedSub).gpa,
                full_marks: s.full_marks || 100,
                pass_marks: s.pass_marks || 33,
                class_highest: classHighest,
                is_optional: s.is_optional
            };
        });
        
        return {
           info: {
               ...studentObj,
               student_name: item.student_name, 
               roll: item.roll, 
               classes: { class_name: selectedExam.classes?.class_name }, 
               photo_url: studentObj?.photo_url, 
               attendance: marksData[item.student_id]?.['attendance'] || attStats[item.student_id] || 'N/A', 
               merit_position: item.rank, 
               gpa: resultInfo.gpa,
               grade: resultInfo.grade
           },
           marks: preparedMarks
        };
    });

    try {
      await generateMassMarksheetPDF(
          preppedStudents,
          selectedExam,
          madrasah,
          downloadLang
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative">
      {/* Download Indicator */}
      {isDownloading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-white/90 backdrop-blur-md border border-blue-100 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <div className="relative">
                    <Loader2 className="animate-spin text-blue-600" size={20} />
                    <div className="absolute inset-0 bg-blue-400/20 blur-sm rounded-full animate-pulse"></div>
                </div>
                <span className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest">ডাউনলোড হচ্ছে...</span>
            </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-blue-900 font-black tracking-widest uppercase text-sm animate-pulse">
            {lang === 'bn' ? 'অপেক্ষা করুন...' : 'Please Wait...'}
          </p>
        </div>
      )}
      {activeTab !== 'final-results' && (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? onBack : () => setView('list')} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-100 text-[#2563EB]'}`}>
            <ArrowLeft size={20}/>
          </button>
          <h1 className={`text-lg sm:text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto truncate max-w-[50vw]`}>
            {activeTab === 'exams' && view === 'list' ? t('exams', lang) : 
             activeTab === 'exams' && selectedExam ? selectedExam.exam_name :
             activeTab === 'seat-plan' ? 'Seat Plan' :
             activeTab === 'analytics' ? t('prediction_system', lang) : t('exams', lang)}
          </h1>
          {activeTab === 'exams' && view === 'report' && (
              <div className="flex items-center gap-2">
                <button onClick={() => {
                    setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadClassResult(l));
                    setShowDownloadLangModal(true);
                }} className="px-2.5 h-8 bg-blue-50 text-[#2563EB] rounded-lg flex items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors text-[10px] font-black uppercase tracking-widest gap-1.5">
                    <Download size={14} />
                    {lang === 'bn' ? 'ফলাফল' : 'Result'}
                </button>
                <button onClick={() => {
                    setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadMassMarksheets(l));
                    setShowDownloadLangModal(true);
                }} className="px-2.5 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center border border-purple-100 hover:bg-purple-100 transition-colors text-[10px] font-black uppercase tracking-widest gap-1.5">
                    <Printer size={14} />
                    {lang === 'bn' ? 'মার্কশীট' : 'Marksheet'}
                </button>
              </div>
          )}
        </div>
        {activeTab === 'exams' && view === 'list' && role === 'madrasah_admin' && (
            <div className="flex gap-2">
                {selectedClassId && (
                    <button onClick={() => { setClassId(selectedClassId); setShowAddExam(true); }} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
                )}
                <button onClick={() => setActiveTab('final-results')} className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${madrasah?.theme === 'dark' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-600 border-purple-100'}`} title="Final Results">
                  <Trophy size={20} />
                </button>
            </div>
        )}
      </div>
      )}

      {activeTab !== 'final-results' && (
      <div className={`flex p-1.5 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'} rounded-[1.5rem] border overflow-x-auto no-scrollbar`}>
        <button onClick={() => setActiveTab('exams')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'exams' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            {t('exams', lang)}
        </button>
        {modules.seat_plan && (
          <button onClick={() => setActiveTab('seat-plan')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'seat-plan' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
              {lang === 'bn' ? 'আসন বিন্যাস' : 'Seat Plan'}
          </button>
        )}
        {modules.exam_routine && (
          <button onClick={() => setActiveTab('exam-routine')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'exam-routine' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
              {lang === 'bn' ? 'পরীক্ষার রুটিন' : 'Exam Routine'}
          </button>
        )}
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'analytics' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            {lang === 'bn' ? 'অ্যানালিটিক্স' : 'Analytics'}
        </button>
      </div>
      )}

      {activeTab === 'analytics' && madrasah && (
          <SmartResultAnalytics institutionId={madrasah.id} lang={lang} madrasah={madrasah} />
      )}

      {activeTab === 'final-results' && (
          <FinalResults lang={lang} madrasah={madrasah} role={role} onBack={() => setActiveTab('exams')} />
      )}

      {activeTab === 'seat-plan' && (
        <div className="space-y-6">
            {/* Configuration Section */}
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] border shadow-bubble space-y-6`}>
                <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>Seat Plan Configuration</h3>
                
                {/* Class Selection */}
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
                                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${selectedClassesForSeatPlan.includes(c.id) ? (madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-[#2563EB] border-blue-200') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100')}`}
                            >
                                {c.class_name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Room Configuration */}
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
                    <button onClick={() => setRooms([...rooms, { id: Date.now().toString(), room_name: `Room ${101 + rooms.length}`, capacity: 30 }])} className="text-xs font-black text-[#2563EB] flex items-center gap-1 mt-2">
                        <Plus size={14}/> Add Room
                    </button>
                </div>

                {/* Options */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template</label>
                    <div className="grid grid-cols-2 gap-2">
                        {seatPlanTemplates.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setSelectedSeatPlanTemplate(t.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedSeatPlanTemplate === t.id ? (madrasah?.theme === 'dark' ? 'bg-blue-500/20 border-blue-500/30 ring-2 ring-blue-500/20' : 'bg-blue-50 border-blue-200 ring-2 ring-blue-100') : (madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-slate-100')}`}
                            >
                                <div className={`font-black text-xs ${selectedSeatPlanTemplate === t.id ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]') : (madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}`}>{t.name}</div>
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
                        className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <label className={`text-xs font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Randomize Seating</label>
                </div>

                <button onClick={handleGenerateSeatPlan} disabled={loading} className="w-full h-14 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {loading && seatAssignments.length === 0 ? <Loader2 className="animate-spin" /> : <><RefreshCw size={20}/> Generate Seat Plan</>}
                </button>
            </div>

            {/* Results */}
            {seatAssignments.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>Generated Plan</h3>
                        <button onClick={() => {
                            setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadSeatPlan(l));
                            setShowDownloadLangModal(true);
                        }} className={`px-4 py-2 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} rounded-xl font-black text-xs flex items-center gap-2 border`}>
                            <Printer size={16}/> Print / Download
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rooms.map(room => {
                            const roomAssignments = seatAssignments.filter(sa => sa.room_name === room.room_name);
                            if (roomAssignments.length === 0) return null;
                            
                            return (
                                <div key={room.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{room.room_name}</h4>
                                        <span className={`text-[10px] font-bold ${madrasah?.theme === 'dark' ? 'text-slate-400 bg-slate-800' : 'text-slate-400 bg-slate-50'} px-2 py-1 rounded-lg`}>{roomAssignments.length} / {room.capacity}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {roomAssignments.map(sa => (
                                            <div key={sa.student_id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-2 rounded-xl border text-center`}>
                                                <div className={`text-[10px] font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'} mb-0.5`}>Seat {sa.seat_number}</div>
                                                <div className={`text-[9px] font-bold ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} truncate`}>{sa.student_name}</div>
                                                <div className="text-[8px] font-bold text-slate-400">{sa.class_name} (Roll: {sa.roll})</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}

      {activeTab === 'exam-routine' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Controls Column */}
            <div className="lg:col-span-1 space-y-4">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] border shadow-bubble space-y-6`}>
                <h3 className={`text-base font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto flex items-center gap-2`}>
                  <Calendar size={18} className="text-emerald-600" />
                  {lang === 'bn' ? 'রুটিন কনফিগারেশন' : 'Routine Configuration'}
                </h3>

                {/* Routine Selection Mode Option */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'রুটিনের ধরণ' : 'Routine Type'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setRoutineSelectionMode('all')}
                      className={`py-2 px-1 rounded-xl text-xs font-black border transition-all ${routineSelectionMode === 'all' ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-premium' : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')}`}
                    >
                      {lang === 'bn' ? 'সব ক্লাস' : 'All Classes'}
                    </button>
                    <button
                      onClick={() => setRoutineSelectionMode('class')}
                      className={`py-2 px-1 rounded-xl text-xs font-black border transition-all ${routineSelectionMode === 'class' ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-premium' : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')}`}
                    >
                      {lang === 'bn' ? 'ক্লাস ভিত্তিক' : 'Class-wise'}
                    </button>
                    <button
                      onClick={() => setRoutineSelectionMode('saved')}
                      className={`py-2 px-1 rounded-xl text-xs font-black border transition-all ${routineSelectionMode === 'saved' ? 'bg-emerald-600 border-emerald-600 text-white shadow-premium' : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')}`}
                    >
                      {lang === 'bn' ? 'সেভ করা রুটিন' : 'Saved'}
                    </button>
                  </div>
                </div>

                {/* Options below the tabs - only show when not in 'saved' tab */}
                {routineSelectionMode !== 'saved' && (
                  <>
                    {/* Dropdown for class selection */}
                    {routineSelectionMode === 'class' && (
                      <div className="space-y-4 pt-2 border-t border-dashed border-slate-200/50 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class'}</label>
                      <select
                        value={selectedRoutineClassId}
                        onChange={e => setSelectedRoutineClassId(e.target.value)}
                        className={`w-full px-3.5 py-2.5 text-xs font-black rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-600 focus:border-blue-500'} outline-none`}
                      >
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.class_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Specific Exam Selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরীক্ষা নির্বাচন করুন' : 'Select Exam'}</label>
                      <select
                        value={selectedRoutineExamId}
                        onChange={e => setSelectedRoutineExamId(e.target.value)}
                        className={`w-full px-3.5 py-2.5 text-xs font-black rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-600 focus:border-blue-500'} outline-none`}
                      >
                        <option value="">{lang === 'bn' ? '-- সর্বশেষ পরীক্ষা --' : '-- Latest Exam --'}</option>
                        {exams.filter(e => e.class_id === selectedRoutineClassId).map(e => (
                          <option key={e.id} value={e.id}>
                            {e.exam_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Name override for all classes */}
                {routineSelectionMode === 'all' && (
                  <div className="space-y-4 pt-2 border-t border-dashed border-slate-200/50 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরীক্ষার নাম' : 'Exam Title'}</label>
                      <input 
                        type="text" 
                        value={customRoutineTitle} 
                        onChange={e => setCustomRoutineTitle(e.target.value)} 
                        className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'} outline-none transition-all`} 
                        placeholder={lang === 'bn' ? 'যেমন: প্রথম সাময়িক পরীক্ষা (ঐচ্ছিক)' : 'e.g., Half Yearly Exam (Optional)'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরীক্ষা নির্বাচন করুন' : 'Select Exams'}</label>
                      <div className={`max-h-60 overflow-y-auto w-full p-2 text-xs font-bold rounded-xl border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} space-y-2`}>
                        {exams.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((e) => {
                          const cls = classes.find(c => c.id === e.class_id);
                          return (
                            <label key={e.id} className="flex items-start gap-2 cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                className="rounded w-4 h-4 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                                checked={selectedRoutineAllExamIds.includes(e.id)}
                                onChange={(evt) => {
                                  if (evt.target.checked) {
                                    setSelectedRoutineAllExamIds(prev => [...prev, e.id]);
                                  } else {
                                    setSelectedRoutineAllExamIds(prev => prev.filter(id => id !== e.id));
                                  }
                                }}
                              />
                              <span className="leading-tight">
                                {e.exam_name} <span className="text-emerald-600 opacity-80 whitespace-nowrap ml-1">({cls?.class_name})</span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Theme Selection */}
                <div className="space-y-4 pt-2 border-t border-dashed border-slate-200/50 animate-fadeIn">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Palette size={12} className="text-emerald-600" />
                       {lang === 'bn' ? 'থিম কালার নির্বাচন করুন' : 'Select Theme Color'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'emerald', color: '#013c28', label: lang === 'bn' ? 'সবুজ' : 'Emerald' },
                        { id: 'blue', color: '#1e3a8a', label: lang === 'bn' ? 'নীল' : 'Blue' },
                        { id: 'slate', color: '#334155', label: lang === 'bn' ? 'ধূসর' : 'Slate' },
                        { id: 'purple', color: '#581c87', label: lang === 'bn' ? 'বেগুনি' : 'Purple' },
                        { id: 'rose', color: '#881337', label: lang === 'bn' ? 'লাল' : 'Rose' }
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setRoutineThemeColor(theme.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold ${routineThemeColor === theme.id ? 'border-transparent shadow-md text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                          style={{ backgroundColor: routineThemeColor === theme.id ? theme.color : undefined }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.color }}></div>
                          {theme.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Exam Times */}
                <div className="space-y-4">
                  {/* Start Date */}
                  <div className="space-y-1.5 p-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/10">
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
                         {lang === 'bn' ? 'বিকালের সময়সূচি' : 'Afternoon Shift'}
                      </label>
                      <button 
                        onClick={() => setShowRoutineAfternoon(!showRoutineAfternoon)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${showRoutineAfternoon ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showRoutineAfternoon ? 'left-4.5' : 'left-0.5'}`} />
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
                    className="w-full py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    {lang === 'bn' ? 'আরও একটি দিন যোগ করুন' : 'Add Another Exam Day'}
                  </button>
                </div>



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

                {/* Master Action Button */}
                <button 
                  onClick={handleDownloadCustomExamRoutine}
                  disabled={isDownloading}
                  className="w-full h-11 bg-[#013c28] hover:bg-[#01261a] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-premium active:scale-95 transition-all disabled:opacity-50 font-noto"
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
                      {savedRoutines.map((r, i) => (
                        <div key={r.id || i} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{r.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {new Date(r.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                                  day: '2-digit', month: 'long', year: 'numeric'
                                })} • {r.routineSelectionMode === 'all' ? (lang === 'bn' ? 'মাস্টার রুটিন' : 'Master Routine') : (lang === 'bn' ? 'সিঙ্গেল ক্লাস' : 'Single Class')}
                              </p>
                            </div>
                            <button 
                              onClick={() => deleteRoutineFromDB(r.id)}
                              className="text-red-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button 
                              onClick={() => loadRoutineFromDB(r)}
                              className="h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                            >
                              <Upload size={12} />
                              {lang === 'bn' ? 'লোড করুন' : 'Load'}
                            </button>
                            <button 
                              onClick={async () => {
                                // Direct download of this saved routine context
                                setIsDownloading(true);
                                try {
                                  const tempName = r.customRoutineTitle || r.activeExamName || (lang === 'bn' ? 'পরীক্ষার রুটিন' : 'Exam Routine');
                                  await generateExamRoutinePDF(
                                    { ...madrasah, name: madrasah?.name || 'School' } as any,
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
                                      themeColor: r.routineThemeColor
                                    }
                                  );
                                } finally {
                                  setIsDownloading(false);
                                }
                              }}
                              className="h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                            >
                              <Download size={12} />
                              {lang === 'bn' ? 'ডাউনলোড' : 'Download'}
                            </button>
                          </div>
                        </div>
                      ))}
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

            {/* Right Live Preview Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] border shadow-bubble`}>
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-4 gap-3">
                  <h3 className={`text-base font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>
                    {lang === 'bn' ? 'লাইভ প্রিন্ট প্রিভিউ' : 'Live Print Preview'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {routineSelectionMode !== 'saved' && (
                      <div className="flex bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        <button 
                          onClick={saveRoutineToDB}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black transition-colors flex items-center gap-1"
                        >
                          <Save size={12} />
                          {lang === 'bn' ? 'রুটিন সেভ' : 'Save Routine'}
                        </button>
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

                {/* Scalable, responsive container for Live Preview page to prevent overflow/side-scrolling */}
                <div 
                  ref={previewContainerRef}
                  className="w-full py-8 px-2 sm:px-8 bg-slate-100/50 rounded-[2.8rem] border border-slate-200/50 overflow-auto custom-scrollbar text-center"
                  style={{ minHeight: `${794 * previewScale * userZoom + 40}px`, maxHeight: '75vh' }}
                >
                  <div 
                    className="relative shrink-0 inline-flex items-start text-left mx-auto"
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
                    
                    {/* Render live mockup copy matching true output */}
                    {(() => {
                      const isClassMode = routineSelectionMode === 'class';
                      const previewNameFontSize = isClassMode 
                        ? (madrasah?.name && madrasah.name.length > 25 ? 'text-[20px]' : 'text-[24px]') 
                        : (madrasah?.name && madrasah.name.length > 25 ? 'text-[26px]' : 'text-[32px]');
                      
                      const previewLogoSize = isClassMode ? 'w-[64px] h-[64px]' : 'w-[85px] h-[85px]';
                      const previewCalendarBoxClass = isClassMode ? 'w-[125px] h-[90px] p-2' : 'w-[160px] h-[105px] p-3';
                      const previewCalendarIconSize = isClassMode ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm';
                      const previewCalendarTextClass1 = isClassMode ? 'text-[9.5px]' : 'text-[11px]';
                      const previewCalendarTextClass2 = isClassMode ? 'text-[9.5px]' : 'text-[11px]';
                      const previewCalendarTextClass3 = isClassMode ? 'text-[8.5px]' : 'text-[10px]';
                      const previewContactTextSize = isClassMode ? 'text-[10.5px]' : 'text-[12px]';
                      const previewPillBadgeClass = isClassMode ? 'px-3 py-1 text-[10px]' : 'px-5 py-1.5 text-[11px]';

                      return (
                        <div className="text-slate-800 w-[1123px] h-[794px] p-6 relative border-[10px] flex flex-col justify-between" style={{ borderColor: `${rtTheme.primary}1a` }}>
                          {/* Frame Design corners */}
                          <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                          <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 rounded-tr-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 rounded-bl-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-xl m-2" style={{ borderColor: rtTheme.primary }}></div>

                          <div className="flex-1 flex flex-col justify-between">
                            {/* Banner Block */}
                            <div className="flex justify-between items-center w-full px-2 py-2 rounded-3xl border mb-3 relative" style={{ backgroundColor: `${rtTheme.light}66`, borderColor: `${rtTheme.primary}1a`, backgroundImage: `linear-gradient(to right, ${rtTheme.light}33, ${rtTheme.accent}66)` }}>
                              
                              {/* Left Column: Logotype */}
                              <div className="flex-shrink-0 flex items-center justify-center pl-4">
                                <div className="relative p-1 rounded-full border bg-white shadow-sm" style={{ borderColor: rtTheme.primary }}>
                                  {madrasah?.logo_url ? (
                                    <img src={madrasah.logo_url} className={`${previewLogoSize} object-contain rounded-full bg-white`} alt="Logo" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className={`${previewLogoSize} bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-900 font-black text-[10px]`}>LOGO</div>
                                  )}
                                </div>
                              </div>

                              {/* Center Column: Madrasah Title, location, etc */}
                              <div className="flex-1 text-center px-3 leading-normal">
                                <h1 className={`${previewNameFontSize} font-black tracking-tight leading-none mb-1 font-serif-bn italic`} style={{ color: rtTheme.primary }}>
                                  {madrasah?.name || 'মাদরাসার নাম'}
                                </h1>
                                
                                <div className={`flex items-center justify-center gap-2 ${previewContactTextSize} font-bold text-[#475569] leading-tight flex-wrap font-noto`}>
                                  <span className="inline-flex items-center gap-0.5 italic" style={{ color: rtTheme.primary }}>
                                    {madrasah?.address || 'ঠিকানা'}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span className="inline-flex items-center gap-0.5" style={{ color: rtTheme.primary }}>
                                    {lang === 'bn' ? 'মোবাইলঃ ' : 'Mobile: '} {madrasah?.phone || '০১৭XXXXXXXX'}
                                  </span>
                                </div>

                                {/* Center pill badge matching bottom-center of image */}
                                <div className="mt-2 inline-block">
                                  <div className={`text-white ${previewPillBadgeClass} rounded-full shadow-sm font-black tracking-wide border`} style={{ backgroundColor: rtTheme.secondary, borderColor: `${rtTheme.primary}80` }}>
                                    {lang === 'bn' 
                                      ? `${activeExamName} সময়সূচি - ${currentYearBn}` 
                                      : `${activeExamName} Schedule - ${currentYear}`}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Solid Premium Calendar Box matching top-right box exactly */}
                              <div className={`flex-shrink-0 ${previewCalendarBoxClass} text-white rounded-2xl flex flex-col justify-between border shadow mr-4`} style={{ backgroundColor: rtTheme.primary, borderColor: `${rtTheme.primary}b3` }}>
                                <div className="flex items-center justify-center">
                                  <div className={`${previewCalendarIconSize} rounded-full bg-white flex items-center justify-center font-black`} style={{ color: rtTheme.primary }}>
                                    📅
                                  </div>
                                </div>
                                <div className="text-center mt-1 leading-normal">
                                  <p className={`${previewCalendarTextClass1} font-black leading-none mb-0.5 whitespace-nowrap overflow-hidden`} style={{ color: rtTheme.accent }}>
                                    {activeExamName ? activeExamName.replace(/পরীক্ষা|Exam/g, '').trim() : (lang === 'bn' ? 'সাময়িক' : 'Term')}
                                  </p>
                                  <p className={`${previewCalendarTextClass2} font-extrabold block mb-0.5`} style={{ color: `${rtTheme.accent}cc` }}>
                                    পরীক্ষার সময়সূচি
                                  </p>
                                  <p className={`${previewCalendarTextClass3} font-semibold text-white/70 block`}>
                                    {currentYearBn}ইং
                                  </p>
                                </div>
                              </div>
                            </div>

                        {/* Main Grid Table matching image perfectly */}
                        <div className="flex-1 mt-2 overflow-x-auto pb-4 custom-scrollbar">
                          
                          {routineSelectionMode === 'all' ? (
                            /* FORMAT A: ALL CLASSES TOGETHER GRID */
                            <table className="w-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: rtTheme.primary }}>
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
                                        className={`bg-transparent text-[11px] font-black leading-tight text-white w-full text-center border-none focus:ring-1 focus:ring-${routineThemeColor === 'emerald' ? 'emerald' : 'blue'}-400 rounded outline-none`}
                                      />
                                      <input 
                                        type="text"
                                        value={col.date}
                                        onChange={(e) => {
                                          const updated = [...routineData];
                                          updated[idx].date = e.target.value;
                                          setRoutineData(updated);
                                        }}
                                        className={`bg-transparent text-[9px] font-bold mt-0.5 w-full text-center border-none focus:ring-1 focus:ring-${routineThemeColor === 'emerald' ? 'emerald' : 'blue'}-400 rounded outline-none`}
                                        style={{ color: rtTheme.accent }}
                                      />
                                    </th>
                                  ))}
                                </tr>
                                
                                {/* Second row of Table Header: Morning/Afternoon Shifts */}
                                <tr className="h-9 border-b" style={{ backgroundColor: rtTheme.accent, borderColor: rtTheme.primary }}>
                                  {routineData.map((_, idx) => (
                                    <React.Fragment key={idx}>
                                      <th className="border-r p-1 text-[9px] font-black font-noto tracking-tighter w-[55px]" style={{ borderColor: `${rtTheme.primary}33`, backgroundColor: rtTheme.accent, color: rtTheme.primary }}>
                                        {lang === 'bn' ? 'সকাল' : 'Morning'}
                                        <span className="block text-[8px] font-bold text-[#475569] mt-0.5 leading-none">
                                          {routineMorningTime.split(' ')[0]}
                                        </span>
                                      </th>
                                      {showRoutineAfternoon && (
                                        <th className="border-r p-1 text-[9px] font-black font-noto tracking-tighter w-[55px]" style={{ borderColor: `${rtTheme.primary}33`, backgroundColor: rtTheme.accent, color: rtTheme.primary }}>
                                          {lang === 'bn' ? 'বিকাল' : 'Afternoon'}
                                          <span className="block text-[8px] font-bold text-[#475569] mt-0.5 leading-none">
                                            {routineAfternoonTime.split(' ')[0]}
                                          </span>
                                        </th>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tr>
                              </thead>
                              
                              <tbody>
                                {/* Classes display rows */}
                                {(() => {
                                  const defaultClassesList = [
                                    { id: '5', class_name: lang === 'bn' ? '৫ম শ্রেণি' : 'Class 5' },
                                    { id: 'n', class_name: lang === 'bn' ? 'নার্সারি' : 'Nursery' },
                                    { id: '1', class_name: lang === 'bn' ? 'প্রথম শ্রেণি' : 'Class 1' },
                                    { id: '2', class_name: lang === 'bn' ? 'দ্বিতীয় শ্রেণি' : 'Class 2' },
                                    { id: '3', class_name: lang === 'bn' ? 'তৃতীয় শ্রেণি' : 'Class 3' }
                                  ];
                                  const displayClassesList = classes.length > 0 
                                    ? (routineSelectionMode === 'all' && selectedRoutineAllExamIds.length > 0 
                                        ? classes.filter(c => selectedRoutineAllExamIds.some(examId => exams.find(e => e.id === examId)?.class_id === c.id)) 
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
                                    <tr key={cls.id} className={`${idx % 2 === 0 ? 'bg-white' : ''} hover:opacity-80 transition-opacity border-b h-[2.75rem]`} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : `${rtTheme.accent}4d`, borderColor: `${rtTheme.primary}26` }}>
                                      {/* Leftmost column showing class label with cute small ribbon or text */}
                                      <td className="border-r-2 p-2 font-black text-xs text-center" style={{ borderColor: rtTheme.primary, backgroundColor: `${rtTheme.light}66`, color: rtTheme.primary }}>
                                        <div className="flex items-center justify-center gap-1">
                                          <span className="text-[12px] font-black tracking-tight">{cls.class_name}</span>
                                        </div>
                                      </td>

                                      {/* Map days */}
                                      {routineData.map((_, dayIdx) => {
                                        const mrnSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'morning');
                                        const aftSub = getSubjectForClassAndDayAndShift(cls, dayIdx, 'afternoon');

                                        return (
                                          <React.Fragment key={dayIdx}>
                                            {/* Morning Shift subject cell */}
                                            <td className="border-r p-1 align-middle text-center" style={{ borderColor: `${rtTheme.primary}26` }}>
                                              <input 
                                                type="text"
                                                value={mrnSub === '*****' ? '' : mrnSub}
                                                onChange={(e) => {
                                                  const updated = [...routineData];
                                                  const subjects = updated[dayIdx].morning.subjects;
                                                  const foundIdx = subjects.findIndex((s: any) => s.classId === cls.id);
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
                                                className={`w-full bg-transparent text-center text-[10px] font-black border-none focus:ring-1 focus:ring-${routineThemeColor === 'emerald' ? 'emerald' : 'blue'}-400 rounded outline-none p-0.5`}
                                                style={{ color: mrnSub === '*****' ? '#cbd5e1' : rtTheme.primary }}
                                              />
                                            </td>
                                            {/* Afternoon Shift subject cell */}
                                            {showRoutineAfternoon && (
                                              <td className="border-r p-1 align-middle text-center" style={{ borderColor: `${rtTheme.primary}26` }}>
                                                <input 
                                                  type="text"
                                                  value={aftSub === '*****' ? '' : aftSub}
                                                  onChange={(e) => {
                                                    const updated = [...routineData];
                                                    const subjects = updated[dayIdx].afternoon.subjects;
                                                    const foundIdx = subjects.findIndex((s: any) => s.classId === cls.id);
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
                                                  className={`w-full bg-transparent text-center text-[10px] font-black border-none focus:ring-1 focus:ring-${routineThemeColor === 'emerald' ? 'emerald' : 'blue'}-400 rounded outline-none p-0.5`}
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
                            <table className="w-full border-collapse border-2 rounded-xl overflow-hidden shadow-sm text-center" style={{ borderColor: rtTheme.primary }}>
                              <thead>
                                <tr className="text-white h-11" style={{ backgroundColor: rtTheme.primary }}>
                                  <th className="border-r p-2 text-xs font-black w-32" style={{ borderColor: `${rtTheme.primary}b3` }}>
                                    {lang === 'bn' ? 'বার / তারিখ' : 'Day / Date'}
                                  </th>
                                  <th className="border-r p-2 text-xs font-black" style={{ borderColor: `${rtTheme.primary}b3` }}>
                                    {lang === 'bn' ? `সকাল (${routineMorningTime.split(' - ')[0]})` : `Morning (${routineMorningTime.split(' - ')[0]})`}
                                  </th>
                                  <th className="p-2 text-xs font-black w-48">
                                    {lang === 'bn' ? `বিকাল (${routineAfternoonTime.split(' - ')[0]})` : `Afternoon (${routineAfternoonTime.split(' - ')[0]})`}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
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
                                    <tr key={row.id || idx} className={`${idx % 2 === 0 ? 'bg-white' : ''} border-b h-[3.25rem] relative group`} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : `${rtTheme.accent}33`, borderColor: `${rtTheme.primary}26` }}>
                                      <td className="border-r p-2 text-center relative group" style={{ borderColor: `${rtTheme.primary}26`, backgroundColor: `${rtTheme.light}4d` }}>
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
                                            const foundIdx = subjects.findIndex((s: any) => s.classId === activeClassObj?.id);
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
                                          className={`bg-transparent text-center font-black text-xs w-full border-none focus:ring-1 focus:ring-${routineThemeColor === 'emerald' ? 'emerald' : 'blue'}-400 rounded outline-none p-1`}
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
                                              const foundIdx = subjects.findIndex((s: any) => s.classId === activeClassObj?.id);
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
                                            className={`bg-transparent text-center font-black text-xs w-full border-none focus:ring-1 focus:ring-${routineThemeColor === 'emerald' ? 'emerald' : 'blue'}-400 rounded outline-none p-1`}
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
                                  lang === 'bn' ? 'পরীক্ষায় ইতালি কপি করা বা নকল করা হলে কঠোর শাস্তির ব্যবস্থা নেওয়া হবে।' : 'Cheating or copying will lead to severe punishment.',
                                  lang === 'bn' ? 'পরীক্ষা চলাকালীন সময় কোনো অভিভাবক পরীক্ষা হলে প্রবেশ করতে পারবেন না।' : 'Guardians are strictly forbidden from entering the halls.'
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
                                {routinePrincipalName || (lang === 'bn' ? 'প্রতিষ্ঠাতা পরিচালক' : 'Founding Director')}
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

                        {/* Deenora Portal bottom tagline */}
                        <div className="text-center mt-3 pt-1 text-[8px] font-bold text-slate-300 border-t border-slate-100 tracking-wider font-mono">
                          {lang === 'bn' ? 'দ্বীনোরা শিক্ষাবর্ষ ২০২৬ • তৈরি করতে ভিজিট করুন deenora.com' : 'DEENORA PORTAL • POWERED BY DEENORA'}
                        </div>
                      </div>
                    </div>
                  )})()}

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'exams' && view === 'list' && !selectedClassId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble flex items-center justify-between hover:border-blue-200 transition-all active:scale-95`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center"><BookOpen size={24}/></div>
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
            <button onClick={() => setSelectedClassId(null)} className="text-sm font-black text-[#2563EB] flex items-center gap-2">
              <ArrowLeft size={16} /> {lang === 'bn' ? 'শ্রেণিতে ফিরে যান' : 'Back to Classes'}
            </button>
            <div className="flex items-center gap-2">
              {role === 'madrasah_admin' && (
              <button 
                onClick={() => { setClassId(selectedClassId); setShowAddExam(true); }}
                className="px-4 py-2 bg-[#2563EB] text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-premium active:scale-95 transition-all"
              >
                <Plus size={16} /> {lang === 'bn' ? 'নতুন পরীক্ষা' : 'Add Exam'}
              </button>
            )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div> : exams.map(exam => (
            <div key={exam.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2.5rem] border shadow-bubble space-y-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center shadow-inner"><GraduationCap size={24}/></div>
                        <div>
                            <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>{exam.exam_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</span>
                                {exam.is_published ? (
                                  <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[8px] font-extrabold uppercase font-noto">প্রকাশিত</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[8px] font-extrabold uppercase font-noto">অপ্রকাশিত</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-[10px] font-black text-slate-300 uppercase">{new Date(exam.exam_date).toLocaleDateString('bn-BD')}</div>
                        {role === 'madrasah_admin' && (
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick(exam)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">
                                <Edit3 size={14} />
                            </button>
                            <button onClick={() => { setExamToDelete(exam.id); setShowDeleteConfirm(true); }} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 active:scale-95 transition-all">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.class_id); }} className="py-2.5 bg-blue-50 text-[#2563EB] rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-100 active:scale-95 transition-all">{t('enter_marks', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('report'); fetchSubjects(exam.id); fetchRanking(exam.id, exam.class_id); fetchMarkEntryData(exam.id, exam.class_id); }} className="py-2.5 bg-[#2563EB] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-premium active:scale-95 transition-all">{t('rank', lang)}</button>
                </div>
                {modules.admit_card && (
                  <button onClick={() => handleDownloadAdmitCard(exam)} className="w-full py-2.5 bg-purple-50 text-purple-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-purple-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <CreditCard size={14}/> Admit Card
                  </button>
                )}
            </div>
          ))}
        </div>
      </div>
      )}

      {activeTab === 'exams' && view === 'subjects' && (
        <div className="space-y-4">
           <button onClick={() => setShowAddSubject(true)} className={`w-full py-5 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} rounded-[2.2rem] text-[#2563EB] font-black flex items-center justify-center gap-3 shadow-bubble border active:scale-95 transition-all`}>
              <Plus size={24} strokeWidth={3} /> বিষয় যোগ করুন
           </button>
           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {subjects.map(s => (
                <div key={s.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble flex items-center justify-between`}>
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto text-lg`}>{s.subject_name}</h5>
                   </div>
                   <div className="text-right flex flex-col items-end gap-2">
                      <div className="flex gap-2 items-center">
                         <p className="text-[9px] font-black text-slate-400 uppercase">পূর্ণমান: {s.full_marks}</p>
                         <p className="text-[9px] font-black text-red-400 uppercase">পাস: {s.pass_marks}</p>
                      </div>
                      {role === 'madrasah_admin' && (
                         <div className="flex gap-2">
                           <button 
                             onClick={() => handleEditSubjectClick(s)}
                             className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                           >
                             <Edit3 size={14} />
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
                            <th className={`py-4 text-[10px] font-black text-amber-500 uppercase text-center min-w-[80px] sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>{lang === 'bn' ? 'উপস্থিতি (%)' : 'Attendance (%)'}</th>
                            <th className={`py-4 text-[10px] font-black text-blue-400 uppercase text-center min-w-[60px] sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>{t('total_marks', lang)}</th>
                            <th className={`py-4 text-[10px] font-black text-purple-400 uppercase text-center min-w-[60px] sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>{t('average', lang)}</th>
                            <th className={`py-4 text-[10px] font-black text-emerald-400 uppercase text-center min-w-[60px] sticky top-0 z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-b border-b-slate-800' : 'bg-white border-b border-b-slate-100'}`}>{t('gpa', lang)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => (
                            <tr key={std.id} className={`border-b last:border-0 ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                                <td className={`py-4 px-2 border-r ${madrasah?.theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'} sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-[#2563EB] leading-none mb-0.5">#{std.roll}</span>
                                        <span className={`font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'} text-[10px] font-noto truncate max-w-[100px]`}>{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map((sub, idx) => (
                                    <td key={sub.id} className={`py-4 px-2 ${idx === 0 ? 'pl-4' : ''}`}>
                                        <input 
                                            type="number" 
                                            min="0"
                                            max={sub.full_marks}
                                            className={`w-full h-10 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-[#2563EB]'} rounded-lg text-center font-black text-xs outline-none transition-all`}
                                            value={marksData[std.id]?.[sub.id] || ''}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (val !== '') {
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) {
                                                        if (num > sub.full_marks) {
                                                            val = sub.full_marks.toString();
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
                                <td className="py-4 px-2">
                                    <input 
                                        type="number" 
                                        placeholder="%"
                                        className={`w-full h-10 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-500' : 'bg-amber-50 border-amber-100 text-slate-900 focus:border-amber-500'} rounded-lg text-center font-black text-xs outline-none transition-all`}
                                        value={marksData[std.id]?.['attendance'] || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMarksData(prev => ({
                                                ...prev,
                                                [std.id]: {
                                                    ...prev[std.id],
                                                    ['attendance']: val
                                                }
                                            }));
                                        }}
                                    />
                                </td>
                                <td className={`py-4 px-2 text-center font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'} text-xs`}>
                                    {(Object.entries(marksData[std.id] || {}).filter(([sid]) => sid !== 'attendance') as any[]).reduce((sum: number, [_, m]: any) => sum + (parseFloat(m) || 0), 0)}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-[#2563EB] text-xs">
                                    {(() => {
                                        const total = (Object.entries(marksData[std.id] || {}).filter(([sid]) => sid !== 'attendance') as any[]).reduce((sum: number, [_, m]: any) => sum + (parseFloat(m) || 0), 0);
                                        const avgValue = subjects.length > 0 ? (total / subjects.length) : 0;
                                        return avgValue.toFixed(2);
                                    })()}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">
                                    {(() => {
                                        let totalMarks = 0;
                                        let totalPossible = 0;
                                        let pointsSum = 0;
                                        let numMainSubjects = 0;
                                        let passStatus = true;
                                        
                                        subjects.forEach(sub => {
                                          const score = parseFloat((marksData[std.id] || {})[sub.id] || '0');
                                          const isOptionalEffectively = !!sub.is_optional && resultSystem === 'grading_optional';
                                          const failed = score < (sub.pass_marks || 33);
                                          
                                          if (!isOptionalEffectively && failed) passStatus = false;
                                          
                                          const pct = (score / (sub.full_marks || 100)) * 100;
                                          const { gpa: gpStr } = getGradeInfo(pct, !failed);
                                          const gp = parseFloat(gpStr);

                                          if (resultSystem === 'grading_optional') {
                                            if (!sub.is_optional) {
                                              totalMarks += score;
                                              totalPossible += (sub.full_marks || 100);
                                              pointsSum += gp;
                                              numMainSubjects++;
                                            } else {
                                              if (gp > 2) pointsSum += (gp - 2);
                                            }
                                          } else {
                                            totalMarks += score;
                                            totalPossible += (sub.full_marks || 100);
                                            pointsSum += gp;
                                            numMainSubjects++;
                                          }
                                        });

                                        if ((resultSystem === 'grading' || resultSystem === 'grading_optional') && numMainSubjects > 0) {
                                          if (!passStatus) return '0.00';
                                          let avgGp = pointsSum / numMainSubjects;
                                          if (avgGp > 5.0) avgGp = 5.0;
                                          return avgGp.toFixed(2);
                                        } else if (totalPossible > 0) {
                                          const overallPct = (totalMarks / totalPossible) * 100;
                                          return getGradeInfo(overallPct, passStatus).gpa;
                                        }
                                        return '0.00';
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {activeTab === 'exams' && view === 'report' && (
          <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#2563EB]" size={40} /></div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] text-white flex items-center justify-between shadow-premium">
                      <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase opacity-60">সেরা ফলাফল</p>
                          <h3 className="text-lg sm:text-2xl font-black font-noto truncate pt-1">{rankingData[0]?.student_name || 'N/A'}</h3>
                      </div>
                      <Trophy size={40} className="text-amber-300" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                      {rankingData.map((item: any) => (
                          <div key={item.student_id} className="bg-white p-2.5 sm:p-3 rounded-[1.2rem] sm:rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-50 text-[#2563EB] rounded-md flex items-center justify-center text-[8px] sm:text-[9px] font-black shrink-0">{item.rank}</div>
                                  <div className="min-w-0">
                                      <h5 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto truncate leading-relaxed mb-0.5 text-[12px] sm:text-[13px] pt-0.5`}>{item.student_name}</h5>
                                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter truncate opacity-80">
                                        Roll: {item.roll} | {item.total_marks} | {(() => {
                                            const avgValue = subjects.length > 0 ? (item.total_marks / subjects.length) : 0;
                                            return avgValue.toFixed(2);
                                        })()}
                                      </p>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <div className="flex gap-1.5 mb-0.5">
                                      <button 
                                          onClick={() => {
                                              const studentMarks = marksData[item.student_id] || {};
                                              const preparedMarks = subjects.map(s => {
                                                  const obtained = parseFloat(studentMarks[s.id] || '0');
                                                  const full = s.full_marks || 100;
                                                  const pass = s.pass_marks || 33;
                                                  const pct = (obtained / full) * 100;
                                                  const hasFailedSub = obtained < pass;
                                                  
                                                  // Calculate highest mark obtained in class for this subject
                                                  const classHighest = Object.keys(marksData || {}).reduce((max, stdId) => {
                                                      const markVal = parseFloat(marksData[stdId]?.[s.id] || '0');
                                                      return markVal > max ? markVal : max;
                                                  }, 0);
                                                  
                                                  const subGradeInfo = (p: number, f: boolean) => {
                                                      if (f) return { gpa: '0.00', grade: 'F' };
                                                      if (p >= 80) return { gpa: '5.00', grade: 'A+' };
                                                      if (p >= 70) return { gpa: '4.00', grade: 'A' };
                                                      if (p >= 60) return { gpa: '3.50', grade: 'A-' };
                                                      if (p >= 50) return { gpa: '3.00', grade: 'B' };
                                                      if (p >= 40) return { gpa: '2.00', grade: 'C' };
                                                      return { gpa: '1.00', grade: 'D' };
                                                  };
                                                  return {
                                                      subject_name: s.subject_name,
                                                      marks_obtained: obtained,
                                                      grade: subGradeInfo(pct, hasFailedSub).grade,
                                                      grade_point: subGradeInfo(pct, hasFailedSub).gpa,
                                                      full_marks: s.full_marks || 100,
                                                      pass_marks: s.pass_marks || 33,
                                                      class_highest: classHighest,
                                                      is_optional: s.is_optional
                                                  };
                                              });
                                              if (selectedExam && madrasah) {
                                                const studentObj = students.find(st => st.id === item.student_id);
                                                const resultInfo = calculateStudentResult(item.student_id, subjects);
                                                
                                                fetchClassAttendanceStats(selectedExam.class_id).then(attStats => {
                                                  generateResultPDF(
                                                      { 
                                                        ...studentObj,
                                                        student_name: item.student_name, 
                                                        roll: item.roll, 
                                                        classes: { class_name: selectedExam.classes?.class_name }, 
                                                        photo_url: studentObj?.photo_url, 
                                                        attendance: marksData[item.student_id]?.['attendance'] || attStats[item.student_id] || 'N/A', 
                                                        merit_position: item.rank, 
                                                        gpa: resultInfo.gpa,
                                                        grade: resultInfo.grade
                                                      },
                                                      selectedExam,
                                                      preparedMarks,
                                                      { name: madrasah.name, logo_url: madrasah.logo_url, address: madrasah.address },
                                                      lang
                                                  );
                                                });
                                              }
                                          }}
                                          className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                      >
                                          <Printer size={10}/> {lang === 'bn' ? 'মার্কশিট' : 'Marksheet'}
                                      </button>
                                      <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase border ${item.pass_status ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                          {item.pass_status ? (lang === 'bn' ? 'পাস' : 'Passed') : (lang === 'bn' ? 'ফেল' : 'Failed')}
                                      </div>
                                  </div>
                                  {item.pass_status && (
                                    <div className="flex gap-1">
                                       {(() => {
                                           const info = calculateStudentResult(item.student_id, subjects);
                                           return (
                                               <>
                                                  <span className="px-1.5 py-0.5 bg-blue-50 text-[#2563EB] rounded-md text-[7px] font-black border border-blue-50">{t('gpa', lang)}: {info.gpa}</span>
                                                  <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[7px] font-black border border-purple-50">{t('grade', lang)}: {info.grade}</span>
                                               </>
                                           );
                                       })()}
                                    </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                </>
              )}
          </div>
      )}

      {/* MODALS */}
      {showAdmitCardModal && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95`}>
             <div className="flex items-center justify-between">
               <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>Select Admit Card Template</h3>
               <button onClick={() => setShowAdmitCardModal(false)} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
             </div>
             
             <div className="space-y-3">
                {admitCardTemplates.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setSelectedAdmitCardTemplate(t.id)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${selectedAdmitCardTemplate === t.id ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/20' : 'bg-blue-50 border-blue-200 ring-2 ring-blue-100') : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-slate-100')}`}
                    >
                        <div>
                            <div className={`font-black text-sm ${selectedAdmitCardTemplate === t.id ? 'text-[#2563EB] dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{t.name}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t.description}</div>
                        </div>
                        {selectedAdmitCardTemplate === t.id && <CheckCircle2 className="text-[#2563EB] dark:text-blue-400" size={20} />}
                    </button>
                ))}
             </div>

             <button onClick={() => {
                 setDownloadAction(() => (l: 'en' | 'bn') => confirmDownloadAdmitCard(l));
                 setShowDownloadLangModal(true);
             }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
               <Download size={20}/> Download Admit Cards
             </button>
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
                {lang === 'bn' ? 'বিষয়টি ডিলিট করবেন?' : 'Delete Subject?'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8 leading-relaxed">
                {lang === 'bn' ? 'এই বিষয়টি ডিলিট করলে এর সাথে যুক্ত সকল শিক্ষার্থীর নম্বর স্থায়ীভাবে মুছে যাবে।' : 'Deleting this subject will permanently remove all associated marks.'}
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
          <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[1100] flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800 shadow-none' : 'bg-white border-white/20 shadow-2xl'} w-full max-w-sm rounded-[3rem] p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden`}>
                  {/* Decorative Background */}
                  <div className={`absolute top-0 right-0 w-32 h-32 ${madrasah?.theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50'} rounded-full -mr-16 -mt-16 opacity-50`}></div>
                  <div className={`absolute bottom-0 left-0 w-24 h-24 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/5' : 'bg-emerald-50'} rounded-full -ml-12 -mb-12 opacity-50`}></div>

                  <div className="relative z-10">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-none rotate-3">
                          <Download className="text-white" size={32} strokeWidth={2.5} />
                      </div>
                      
                      <div className="text-center mb-8">
                          <h3 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} leading-tight`}>Select Language</h3>
                          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">ডাউনলোড ভাষা নির্বাচন করুন</p>
                      </div>
                      
                      <div className="space-y-3">
                          <button 
                              onClick={async () => {
                                  if (downloadAction) {
                                      setShowDownloadLangModal(false);
                                      setShowAdmitCardModal(false);
                                      await downloadAction('bn');
                                  }
                              }}
                              className="w-full group relative overflow-hidden py-5 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-3"
                          >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                              <span className="relative z-10 text-lg">বাংলা (Bengali)</span>
                          </button>

                          <button 
                              onClick={async () => {
                                  if (downloadAction) {
                                      setShowDownloadLangModal(false);
                                      setShowAdmitCardModal(false);
                                      await downloadAction('en');
                                  }
                              }}
                              className="w-full group relative overflow-hidden py-5 bg-[#2563EB] text-white font-black rounded-2xl shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-3"
                          >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                              <span className="relative z-10 text-lg">English</span>
                          </button>

                          <button 
                              onClick={() => setShowDownloadLangModal(false)}
                              className="w-full py-4 text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-[0.2em] hover:text-slate-600 dark:hover:text-slate-300 transition-colors mt-2 active:scale-95"
                          >
                              Cancel / বাতিল
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showAddExam && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95`}>
             <div className="flex items-center justify-between">
               <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{editingExam ? 'পরীক্ষা এডিট করুন' : 'নতুন পরীক্ষা যোগ করুন'}</h3>
               <button onClick={() => { setShowAddExam(false); setEditingExam(null); setExamName(''); setClassId(''); setIsPublished(false); }} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all`} placeholder="পরীক্ষার নাম (যেমন: বার্ষিক পরীক্ষা)" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                <div className="relative"><input 
                  type="date" 
                  className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all`} 
                  value={examDate} 
                  onChange={(e) => setExamDate(e.target.value)}
                  min={activeYear?.start_date}
                  max={activeYear?.end_date}
                /><Calendar className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                <div className="relative">
                    <select className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none transition-all`} value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">ক্লাস বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <input 
                    type="checkbox" 
                    id="isPublishedInput" 
                    checked={isPublished} 
                    onChange={(e) => setIsPublished(e.target.checked)} 
                    className="w-5 h-5 rounded-lg border-slate-300 text-[#2563EB] focus:ring-[#2563EB]" 
                  />
                  <label htmlFor="isPublishedInput" className={`text-xs font-bold ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'} font-noto cursor-pointer select-none`}>ফলাফল প্রকাশ করুন (Publish Results)</label>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
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
               <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{editingSubject ? 'বিষয় এডিট করুন' : 'বিষয় যোগ করুন'}</h3>
               <button onClick={() => { setShowAddSubject(false); setEditingSubject(null); setSubName(''); setSortOrder('0'); setIsOptional(false); }} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all`} placeholder="বিষয়ের নাম (যেমন: কুরআন)" value={subName} onChange={(e) => setSubName(e.target.value)} /><BookOpen size={20} className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" /></div>
                {resultSystem === 'grading_optional' && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <input type="checkbox" id="isOptional" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} className="w-5 h-5 rounded-lg border-slate-300 text-[#2563EB] focus:ring-[#2563EB]" />
                    <label htmlFor="isOptional" className={`text-sm font-bold ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>৪র্থ বিষয় / Optional Subject</label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all`} placeholder="পূর্ণমান" value={fullMarks} onChange={(e) => setFullMarks(e.target.value)} /><Star className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
                    <div className="relative"><input type="number" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all`} placeholder="পাস" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} /><AlertCircle className="absolute left-4 top-4 text-slate-300 dark:text-slate-600" size={20}/></div>
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
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'বিষয় সেভ করুন'}
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
                    className={`w-24 h-24 ${modalMode === 'success' ? 'bg-emerald-500 shadow-emerald-500/30' : modalMode === 'error' ? 'bg-rose-500 shadow-rose-500/30' : 'bg-amber-500 shadow-amber-500/30'} rounded-[2rem] flex items-center justify-center shadow-lg relative z-10`}
                  >
                    {modalMode === 'success' ? (
                      <CheckCircle2 size={48} className="text-white" />
                    ) : modalMode === 'error' ? (
                      <AlertCircle size={48} className="text-white" />
                    ) : (
                      <HelpCircle size={48} className="text-white" />
                    )}
                  </motion.div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`absolute inset-0 ${modalMode === 'success' ? 'bg-emerald-500' : modalMode === 'error' ? 'bg-rose-500' : 'bg-amber-500'} rounded-[2rem] blur-2xl -z-10`}
                  />
                </div>
                
                <h3 className={`text-2xl font-black mb-2 font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                  {successTitle || (modalMode === 'success' ? (lang === 'bn' ? 'সফলভাবে সংরক্ষিত!' : 'Successfully Saved!') : (lang === 'bn' ? 'ত্রুটি!' : 'Error!'))}
                </h3>
                <p className={`text-sm font-bold mb-8 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {successMessage || (lang === 'bn' ? 'পরীক্ষার নম্বরগুলো ডাটাবেসে সফলভাবে আপডেট করা হয়েছে।' : 'The exam marks have been successfully updated in the database.')}
                </p>
                
                {modalMode === 'confirm' ? (
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setShowSuccessModal(false)}
                      className={`flex-1 py-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'} font-black rounded-2xl transition-all`}
                    >
                      {cancelText || (lang === 'bn' ? 'বাতিল' : 'Cancel')}
                    </button>
                    <button 
                      onClick={() => {
                        setShowSuccessModal(false);
                        if (onConfirm) {
                          onConfirm();
                        }
                      }}
                      className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      {confirmText || (lang === 'bn' ? 'নিশ্চিত' : 'Confirm')}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowSuccessModal(false)}
                    className={`w-full py-5 ${modalMode === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'} text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-lg`}
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : (modalMode === 'success' ? 'Awesome' : 'Close')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolResultEngine;
