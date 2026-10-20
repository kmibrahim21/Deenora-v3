import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import { 
  Paperclip,
  Eye,
  X,
  User, 
  Calendar, 
  CreditCard, 
  BarChart3, 
  FileText, 
  LogOut, 
  Phone, 
  MapPin, 
  Hash, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  GraduationCap,
  BookOpen,
  MessageSquare,
  RefreshCw,
  Trophy,
  Share2,
  Download,
  LayoutDashboard,
  ClipboardList,
  Banknote,
  History as HistoryIcon,
  Users,
  AlertCircle,
  Wallet,
  WalletCards,
  ReceiptText,
  PhoneCall,
  PieChart,
  Info,
  BellRing,
  Heart,
  Shield,
  Smartphone,
  Moon,
  Sun,
  TrendingDown,
  MessageSquareText,
  Mic,
  Sparkles,
  HeartHandshake,
  Award,
  Volume2,
  VolumeX,
  Copy,
  Check,
} from 'lucide-react';
// Smart remarks import removed
import { ChatApp } from './ChatApp';
import { useVoiceCall } from '../context/CallContext';
import { useGlobalNotifications } from '../hooks/useGlobalNotifications';
import { registerNativePushToken } from '../lib/notifyParents';
import { 
  requestPushNotificationPermission, 
  getNotificationPermissionState, 
  playNotificationSound, 
  sendPushNotification 
} from '../lib/pushNotifications';
import { getBengaliDate, getHijriDate } from '../utils/calendarUtils';
import { motion, AnimatePresence } from 'motion/react';
import { Attendance, Fee, Language, Institution } from 'types';
import { hardReload } from 'utils/reloadUtils';
import { generateResultPDF } from 'utils/pdfGenerator';

const ExpandableText: React.FC<{ text: string; maxChars?: number }> = ({ text, maxChars = 100 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > maxChars;

  if (!shouldTruncate) {
    return <span className="whitespace-pre-wrap leading-relaxed block font-noto">{text}</span>;
  }

  return (
    <div className="font-noto text-left">
      <div className={`transition-all duration-300 relative ${isExpanded ? '' : 'max-h-[3.6em] overflow-hidden'}`}>
        <span className="whitespace-pre-wrap leading-relaxed block text-slate-600">
          {text}
        </span>
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-[10px] md:text-xs font-black text-blue-600 hover:text-blue-800 transition-colors mt-1 focus:outline-none inline-flex items-center gap-1 cursor-pointer select-none"
      >
        {isExpanded ? (
          <>
            <span>সংক্ষিপ্ত করুন</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
          </>
        ) : (
          <>
            <span>বিস্তারিত দেখুন...</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </>
        )}
      </button>
    </div>
  );
};

const SyllabusAccordion: React.FC<{ subjects: { subject: string; details: string }[] }> = ({ subjects }) => {
  const [openIndexes, setOpenIndexes] = useState<Record<number, boolean>>({});

  const toggleIndex = (index: number) => {
    setOpenIndexes(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="space-y-2.5 font-noto w-full">
      {subjects.map((s, idx) => {
        const isOpen = !!openIndexes[idx];
        return (
          <div 
            key={idx} 
            className="border border-purple-100/60 bg-white rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md hover:border-purple-200"
          >
            <button
              type="button"
              onClick={() => toggleIndex(idx)}
              className="w-full flex items-center justify-between p-4 text-left font-noto font-black text-purple-950 text-xs md:text-sm hover:bg-purple-50/30 transition-colors cursor-pointer select-none focus:outline-none"
            >
              <span className="flex-1 pr-4 font-noto font-bold">{s.subject}</span>
              <span className={`transform transition-transform duration-300 text-purple-500 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] border-t border-purple-50' : 'max-h-0'}`}
            >
              <div className="p-4 bg-purple-50/15 text-slate-700 text-xs md:text-sm leading-relaxed font-noto whitespace-pre-wrap select-text border-t border-purple-50/50">
                {s.details}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ParentPortalProps {
  lang: Language;
  studentId: string;
  madrasah: Institution | null;
}

const ParentPortal: React.FC<ParentPortalProps> = ({ lang, studentId, madrasah }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'results' | 'fees' | 'notices' | 'chat' | 'profile'>('home');
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);
  const [activeNoticeTab, setActiveNoticeTab] = useState<'notice' | 'diary' | 'syllabus' | 'suggestion' | 'routine'>('notice');

  // Pre-load cached data synchronously to eliminate the double loading screen on launch
  const initialCache = useMemo(() => {
    try {
      let activeId = studentId;
      if (!activeId) {
        const session = JSON.parse(localStorage.getItem('parent_session') || '{}');
        activeId = session.student_id;
      }
      if (activeId) {
        const cached = localStorage.getItem(`parent_data_v2_${activeId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.data) {
            return parsed.data;
          }
        }
      }
    } catch (e) {}
    return null;
  }, [studentId]);

  const [readDiaryIds, setReadDiaryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('parent_read_diaries') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('parent_read_diaries', JSON.stringify(readDiaryIds));
    } catch {}
  }, [readDiaryIds]);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(() => initialCache?.student || null);
  const [children, setChildren] = useState<any[]>(() => initialCache?.children || []);
  const [switchingChildId, setSwitchingChildId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string>(() => {
    let activeId = studentId;
    if (!activeId) {
      try {
        const session = JSON.parse(localStorage.getItem('parent_session') || '{}');
        activeId = session.student_id;
      } catch {}
    }
    return activeId || '';
  });
  const [currentInstitution, setCurrentInstitution] = useState<Institution | null>(() => initialCache?.institution || madrasah || null);

  const modules = useMemo(() => {
    let config: any = currentInstitution?.config_json || madrasah?.config_json;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    return (config?.modules || {}) as any;
  }, [currentInstitution, madrasah]);

  // Live chat is temporarily hidden from parent portal as requested
  const isLiveChatEnabled = false;

  const [attendance, setAttendance] = useState<Attendance[]>(() => initialCache?.attendance || []);
  const [fees, setFees] = useState<Fee[]>(() => initialCache?.fees || []);
  const [feeStructures, setFeeStructures] = useState<any[]>(() => initialCache?.feeStructures || []);
  const [studentFeeSettings, setStudentFeeSettings] = useState<any[]>(() => initialCache?.studentFeeSettings || []);
  const [results, setResults] = useState<any[]>(() => initialCache?.examResults || []);
  const [notices, setNotices] = useState<any[]>(() => initialCache?.notices || []);
  const [events, setEvents] = useState<any[]>(() => initialCache?.events || []);
  const [classTotal, setClassTotal] = useState<number>(() => initialCache?.classTotal || 0);
  const [loading, setLoading] = useState<boolean>(() => !initialCache?.student);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [showExamDropdown, setShowExamDropdown] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [profileSubTab, setProfileSubTab] = useState<'basic' | 'family' | 'address' | 'siblings'>('basic');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showNotifBanner, setShowNotifBanner] = useState<boolean>(false);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [speakingRemark, setSpeakingRemark] = useState<boolean>(false);
  const [copiedRemark, setCopiedRemark] = useState<boolean>(false);

  const handleSpeakRemark = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingRemark) {
      window.speechSynthesis.cancel();
      setSpeakingRemark(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'bn-BD';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingRemark(false);
    utterance.onerror = () => setSpeakingRemark(false);
    setSpeakingRemark(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyRemarkText = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedRemark(true);
      setTimeout(() => setCopiedRemark(false), 2000);
    }
  };

  const handleShareRemark = (studentName: string, examName: string, text: string) => {
    const shareText = `🌟 ${studentName} - এর ${examName} পরীক্ষার ফলাফল ও শিক্ষকের মূল্যায়ন:\n\n"${text}"\n\n- Deenora Guardian Portal`;
    if (navigator?.share) {
      navigator.share({
        title: `${studentName} - ফলাফল মূল্যায়ন`,
        text: shareText
      }).catch(() => {});
    } else if (navigator?.clipboard) {
      navigator.clipboard.writeText(shareText);
      setNotifToast('মূল্যায়ন টেক্সট কপি হয়েছে! প্রিয়জনদের কাছে পেস্ট করে শেয়ার করুন।');
      setTimeout(() => setNotifToast(null), 3000);
    }
  };
  
  const { initSignaling, startCall } = useVoiceCall();

  // Initialize Voice Call Signaling listener for Guardian app so parent can receive incoming calls
  useEffect(() => {
    let parentSession: any = {};
    try {
      parentSession = JSON.parse(localStorage.getItem('parent_session') || '{}');
    } catch {}

    const activeInstId = currentInstitution?.id || madrasah?.id || student?.institution_id || parentSession.institution_id || '';
    const activeStudentId = studentId || student?.id || parentSession.student_id || '';
    const activePhone = student?.guardian_phone || parentSession.guardian_phone || '';

    if (activeInstId || activeStudentId || activePhone) {
      initSignaling(activeInstId, activeStudentId, activePhone);
      // Android WebView app: register native FCM token (linked to this parent)
      // so notice/result/diary/chat pushes reach the phone even when closed
      registerNativePushToken(activeStudentId, activePhone, activeInstId);
    }
  }, [currentInstitution?.id, madrasah?.id, student?.institution_id, studentId, student?.id, student?.guardian_phone, initSignaling]);

  useEffect(() => {
    const perm = getNotificationPermissionState();
    setNotifPermission(perm);
    if (perm === 'default') {
      setShowNotifBanner(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    const res = await requestPushNotificationPermission();
    setNotifPermission(res);
    setShowNotifBanner(false);
    if (res === 'granted') {
      setNotifToast('নোটিফিকেশন সফলভাবে চালু করা হয়েছে! 🔔');
      playNotificationSound();
      sendPushNotification(
        'Deenora Parent Portal',
        'নোটিফিকেশন সফলভাবে চালু হয়েছে। এখন থেকে সকল নোটিশ ও মেসেজের নোটিফিকেশন পাবেন।',
        '/Deenora192.png'
      );
    } else if (res === 'denied') {
      setNotifToast('ব্রাউজার সেটিংসে গিয়ে নোটিফিকেশন অনুমতি প্রদান করুন।');
    }
    setTimeout(() => setNotifToast(null), 4000);
  };

  // PWA Installation & Standalone mode state
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isInstalledPWA, setIsInstalledPWA] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  });
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalledPWA(true);
          setShowInstallBanner(false);
          setNotifToast('Deenora অভিভাবক অ্যাপ হোমস্ক্রিনে যুক্ত হয়েছে! 📲');
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
      setDeferredInstallPrompt(null);
    } else {
      setNotifToast('হোমস্ক্রিনে যুক্ত করতে ব্রাউজারের শেয়ার (Share) বাটনে ট্যাপ করে "Add to Home Screen" বেছে নিন। 📲');
      setTimeout(() => setNotifToast(null), 5000);
    }
  };

  const handleTestPushNotification = () => {
    playNotificationSound();
    sendPushNotification(
      'Deenora অভিভাবক টেস্ট নোটিফিকেশন 🔔',
      `${student?.student_name || 'শিক্ষার্থী'}-এর উপস্থিতির নোটিশ ও পরীক্ষার ফলাফল সরাসরি আপনার মোবাইলে পাবেন।`,
      '/Deenora192.png',
      'test-pwa-push'
    );
    setNotifToast('টেস্ট নোটিফিকেশন পাঠানো হয়েছে! মোবাইল নোটিফিকেশন বার চেক করুন। 📲');
    setTimeout(() => setNotifToast(null), 4000);
  };

  // Auto prompt permission on first user interaction when app opens
  useEffect(() => {
    if (notifPermission !== 'default') return;

    const handleFirstInteraction = async () => {
      window.removeEventListener('click', handleFirstInteraction);
      const res = await requestPushNotificationPermission();
      setNotifPermission(res);
      if (res === 'granted') {
        setShowNotifBanner(false);
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
    };
  }, [notifPermission]);

  const CACHE_KEY = `parent_data_v2_${activeStudentId || studentId}`;

  useEffect(() => {
    // Try to load from cache first
    const currentActiveId = activeStudentId || studentId;
    const cachedData = localStorage.getItem(`parent_data_v2_${currentActiveId}`);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          applyData(parsed.data);
          setLoading(false);
        }
      } catch (e) {}
    }
    fetchData(currentActiveId);
  }, [studentId, activeStudentId]);

  const applyData = useCallback((data: any) => {
    setStudent(data.student);
    if (data.children && Array.isArray(data.children) && data.children.length > 0) {
      setChildren(data.children);
    }
    if (data.institution) {
      setCurrentInstitution(data.institution);
    }
    setAttendance(data.attendance || []);
    setFees(data.fees || []);
    setFeeStructures(data.feeStructures || []);
    setStudentFeeSettings(data.studentFeeSettings || []);
    setResults(data.examResults || []);
    setNotices(data.notices || []);
    setEvents(data.events || []);
    setClassTotal(data.classTotal || 0);
  }, []);

  // Hook into global push notifications & live message sync
  useGlobalNotifications({
    institutionId: currentInstitution?.id || madrasah?.id || student?.institution_id,
    userId: student?.id || student?.guardian_phone,
    userRole: 'parent',
    studentClassId: student?.class_id || student?.classes?.id,
    studentClassName: student?.classes?.class_name || student?.class_name,
    onNewNotification: useCallback(() => {
      fetchData();
    }, [studentId, activeStudentId])
  });

  // Filter published routines that belong to student's class
  const publishedClassRoutines = useMemo(() => {
    const currentInst = currentInstitution || madrasah;
    const config = currentInst?.config_json as any;
    let allSavedRoutines: any[] = [];
    if (config?.saved_exam_routines && Array.isArray(config.saved_exam_routines)) {
      allSavedRoutines = config.saved_exam_routines;
    }
    
    // Filter only published routines (is_published !== false)
    const published = allSavedRoutines.filter(r => r.is_published !== false);
    
    const studentClassId = student?.class_id || student?.classes?.id;
    const studentClassName = (student?.classes?.class_name || '').toLowerCase().trim();

    const matchedRoutines: any[] = [];

    published.forEach(r => {
      const isSingleClassMode = r.routineSelectionMode === 'class';
      if (isSingleClassMode && r.selectedRoutineClassId && studentClassId && r.selectedRoutineClassId !== studentClassId) {
        return;
      }

      const classDays: any[] = [];
      let hasAnyAfternoonInRoutine = false;

      (r.routineData || []).forEach((dayObj: any) => {
        const morningSlots = dayObj?.morning?.subjects || (Array.isArray(dayObj?.subjects) ? dayObj.subjects : []);
        const afternoonSlots = dayObj?.afternoon?.subjects || [];
        
        let morningMatch = null;
        let afternoonMatch = null;

        if (isSingleClassMode) {
          morningMatch = morningSlots.find((s: any) => 
            (studentClassId && s.classId === studentClassId) || 
            (studentClassName && s.className && s.className.toLowerCase().trim() === studentClassName)
          ) || morningSlots[0];

          afternoonMatch = afternoonSlots.find((s: any) => 
            (studentClassId && s.classId === studentClassId) || 
            (studentClassName && s.className && s.className.toLowerCase().trim() === studentClassName)
          ) || afternoonSlots[0];
        } else {
          morningMatch = morningSlots.find((s: any) => 
            (studentClassId && s.classId === studentClassId) || 
            (studentClassName && s.className && s.className.toLowerCase().trim() === studentClassName)
          );
          afternoonMatch = afternoonSlots.find((s: any) => 
            (studentClassId && s.classId === studentClassId) || 
            (studentClassName && s.className && s.className.toLowerCase().trim() === studentClassName)
          );
        }

        const morningSubject = morningMatch?.subject?.trim() || (typeof dayObj?.morningSubject === 'string' ? dayObj.morningSubject.trim() : '');
        const afternoonSubject = afternoonMatch?.subject?.trim() || (typeof dayObj?.afternoonSubject === 'string' ? dayObj.afternoonSubject.trim() : '');

        const hasMorning = Boolean(morningSubject && morningSubject !== '*****' && morningSubject !== '---');
        const hasAfternoon = Boolean(afternoonSubject && afternoonSubject !== '*****' && afternoonSubject !== '---');

        if (hasAfternoon) hasAnyAfternoonInRoutine = true;

        if (hasMorning || hasAfternoon) {
          classDays.push({
            id: dayObj.id || Math.random().toString(),
            date: (() => {
              const dVal = dayObj.date || dayObj.isoDate;
              if (!dVal) return '';
              const dObj = new Date(dVal);
              if (isNaN(dObj.getTime())) return dVal;
              return dObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
            })(),
            day: dayObj.day || '',
            morningSubject: hasMorning ? morningSubject : '—',
            morningTime: dayObj.morning?.time || r.routineMorningTime || (r.routineMorningStart ? `${r.routineMorningStart} - ${r.routineMorningEnd}` : ''),
            morningRoom: morningMatch?.room || dayObj.morningRoom || '',
            afternoonSubject: hasAfternoon ? afternoonSubject : '—',
            afternoonTime: dayObj.afternoon?.time || r.routineAfternoonTime || (r.routineAfternoonStart ? `${r.routineAfternoonStart} - ${r.routineAfternoonEnd}` : ''),
            afternoonRoom: afternoonMatch?.room || dayObj.afternoonRoom || ''
          });
        }
      });

      if (classDays.length > 0) {
        matchedRoutines.push({
          ...r,
          hasAfternoon: hasAnyAfternoonInRoutine || Boolean(r.showRoutineAfternoon),
          days: classDays
        });
      }
    });

    return matchedRoutines;
  }, [currentInstitution, madrasah, student]);

  const fetchData = async (targetStudentId?: string, targetRegNo?: string) => {
    const sId = typeof targetStudentId === 'string' ? targetStudentId : (activeStudentId || studentId);
    const regNo = typeof targetRegNo === 'string' ? targetRegNo : undefined;
    if (typeof targetStudentId === 'string' && targetStudentId !== student?.id) {
      setSwitchingChildId(targetStudentId);
    }
    if (!loading) setRefreshing(true);
    try {
      const parentSession = JSON.parse(localStorage.getItem('parent_session') || '{}');
      const phone = parentSession.guardian_phone || student?.guardian_phone;
      const actualRegNo = regNo !== undefined ? regNo : parentSession.registration_number;

      if (!phone || (!actualRegNo && !sId)) {
        handleLogout();
        return;
      }

      let url = `/api/parents/data?phone=${encodeURIComponent(phone)}`;
      if (sId) url += `&student_id=${encodeURIComponent(sId)}`;
      if (actualRegNo) url += `&reg_no=${encodeURIComponent(actualRegNo)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        throw new Error(data.error);
      }

      setError(null);
      const currentSId = data.student?.id || sId;
      localStorage.setItem(`parent_data_v2_${currentSId}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));

      if (data.student) {
        setActiveStudentId(data.student.id);
        localStorage.setItem('parent_session', JSON.stringify({
          student_id: data.student.id,
          guardian_phone: data.student.guardian_phone || phone,
          registration_number: data.student.registration_number,
          institution_id: data.student.institution_id,
          role: 'parent'
        }));
        registerNativePushToken(data.student.id, data.student.guardian_phone || phone, data.student.institution_id);
      }

      applyData(data);
    } catch (error) {
      console.error('Error fetching parent data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSwitchingChildId(null);
    }
  };

  const handleSwitchChild = (child: any) => {
    if (!child || child.id === student?.id || Boolean(switchingChildId)) return;
    fetchData(child.id, child.registration_number);
  };

  const handleLogout = () => {
    localStorage.removeItem('parent_session');
    hardReload();
  };

  const isTabActive = (tab: string) => activeTab === tab;
  const academicYearStart = madrasah?.config_json?.academic_year_start;

  // Attendance Stats for the month
  const today = useMemo(() => new Date(), []);
  
  const monthAttendance = useMemo(() => {
    return attendance.filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [attendance, viewMonth, viewYear]);

  const filteredAttendance = useMemo(() => {
    return attendanceFilter === 'all' 
      ? monthAttendance 
      : monthAttendance.filter(a => a.status === attendanceFilter);
  }, [attendanceFilter, monthAttendance]);

  const cleanStudentNotes = (notes: string) => {
    if (!notes) return "";
    return notes.replace(/\[[A-Z0-9_]+:.*?\]/g, "").trim();
  };

  const accStartDate = useMemo(() => {
    if (student?.notes) {
      const match = student.notes.match(/\[ACC_START:(.*?)\]/);
      return match ? match[1] : '';
    }
    return '';
  }, [student]);

  const getFeeDetailsForMonth = useCallback((monthStr: string) => {
    const monthFees = fees.filter(f => f.month === monthStr);
    const actualPaid = monthFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
    const discountAmt = monthFees.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);
    
    const monthPayable = feeStructures.reduce((sum, s) => {
      const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
      const isEnabled = setting ? setting.is_enabled : true;
      const isMonthExpired = s.due_date && monthStr > s.due_date.slice(0, 7);
      const isMonthNotStarted = s.start_date && monthStr < s.start_date.slice(0, 7);
      
      const yearStart = madrasah?.config_json?.academic_year_start;
      const isBeforeYearStart = yearStart && monthStr < yearStart.slice(0, 7);
      
      // Respect individual student accounting start date
      const isBeforeAccStart = accStartDate && monthStr < accStartDate.slice(0, 7);
      
      const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
      return (isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart && !isBeforeAccStart) ? sum + amountToCharge : sum;
    }, 0);
    
    const paidAmtTotal = actualPaid + discountAmt;
    let status = 'unpaid';
    if (monthPayable > 0) {
      if (paidAmtTotal >= monthPayable) status = 'paid';
      else if (paidAmtTotal > 0) status = 'partial';
      else status = 'unpaid';
    } else if (paidAmtTotal > 0) {
      status = 'paid';
    } else {
      status = 'no_fee';
    }

    return { 
      payable: monthPayable, 
      paid: actualPaid,
      discount: discountAmt,
      due: Math.max(0, monthPayable - actualPaid - discountAmt),
      status
    };
  }, [fees, feeStructures, studentFeeSettings, madrasah, accStartDate]);

  const totalPaid = useMemo(() => {
    return fees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
  }, [fees]);

  const totalDiscount = useMemo(() => {
    return fees.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);
  }, [fees]);
  
  const feeStats = useMemo(() => {
    const currentYearForFees = new Date().getFullYear().toString();
    const acStart = academicYearStart ? new Date(academicYearStart) : null;
    const startMonthIdx = acStart && acStart.getFullYear().toString() === currentYearForFees ? acStart.getMonth() + 1 : 1;

    const currentMonthIdx = today.getMonth() + 1;
    let totalPayableTotal = 0;

    for (let m = startMonthIdx; m <= currentMonthIdx; m++) {
        const monthStr = `${currentYearForFees}-${String(m).padStart(2, '0')}`;
        const details = getFeeDetailsForMonth(monthStr);
        totalPayableTotal += details.payable;
    }

    const tPaid = fees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
    const tDiscount = fees.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);
    const totalDue = Math.max(0, totalPayableTotal - tPaid - tDiscount);

    return {
      pendingFees: totalDue,
      totalPayable: totalPayableTotal,
      totalPaid: tPaid,
      totalDiscount: tDiscount
    };
  }, [fees, getFeeDetailsForMonth, academicYearStart, today]);

  const stats = useMemo(() => {
    return {
      present: monthAttendance.filter(a => a.status === 'present').length,
      absent: monthAttendance.filter(a => a.status === 'absent').length,
      late: monthAttendance.filter(a => a.status === 'late').length,
      total: monthAttendance.length,
      pendingFees: feeStats.pendingFees,
      totalPayable: feeStats.totalPayable,
      lastGpa: results.length > 0 ? (results[0].gpa || 'A-') : '--'
    };
  }, [monthAttendance, feeStats, results]);

  const attendanceRate = useMemo(() => {
    return stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
  }, [stats]);
  
  // Calculate average performance across all exams
  const performanceRate = useMemo(() => {
    let totalObtained = 0;
    let totalFull = 0;
    results.forEach(exam => {
      exam.marks.forEach((m: any) => {
        totalObtained += m.obtained || 0;
        totalFull += m.full || 100;
      });
    });
    return totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 85;
  }, [results]);

  const recentActivities = useMemo(() => {
    return [
      ...(modules.attendance !== false && attendance.length > 0 ? [{
        icon: CheckCircle2,
        id: 'att',
        title: 'উপস্থিতি রেকর্ড',
        sub: new Date(attendance[0].date).toLocaleDateString('bn-BD'),
        trail: attendance[0].status === 'present' ? 'উপস্থিত' : 'অনুপস্থিত',
        color: attendance[0].status === 'present' ? 'emerald' : 'red',
        timestamp: new Date(attendance[0].date).getTime()
      }] : []),
      ...(modules.accounting !== false && fees.length > 0 ? [{
        icon: CreditCard,
        id: 'fee',
        title: 'ফি এর তথ্য',
        sub: fees[0].month,
        trail: fees[0].status === 'paid' ? 'পরিশোধিত' : 'বকেয়া',
        color: fees[0].status === 'paid' ? 'blue' : 'orange',
        timestamp: new Date(fees[0].created_at || '').getTime() || Date.now()
      }] : []),
      ...((modules.results !== false || modules.exam !== false) && results.length > 0 ? [{
        icon: GraduationCap,
        id: 'res',
        title: 'পরীক্ষার ফলাফল',
        sub: results[0].name,
        trail: results[0].gpa || 'প্রকাশিত',
        color: 'purple',
        timestamp: new Date(results[0].date).getTime()
      }] : []),
      ...(notices.length > 0 ? [{
        icon: Bell,
        id: 'not',
        title: 'নতুন নোটিশ',
        sub: notices[0].title,
        trail: 'দেখুন',
        color: 'orange',
        timestamp: new Date(notices[0].created_at).getTime()
      }] : [])
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  }, [attendance, fees, results, notices, modules]);

  const currentExam = useMemo(() => {
    return results.find(e => e.id === selectedExamId) || results[0] || null;
  }, [results, selectedExamId]);

  return (
    <AnimatePresence mode="wait">
      {downloadingReport && (
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
              {'ফাইল তৈরি হচ্ছে...'}
            </h3>
            <p className="text-slate-500 text-sm">
              {'দয়া করে কিছুক্ষণ অপেক্ষা করুন।'}
            </p>
          </div>
        </div>
      )}
      {error ? (
        <motion.div
          key="error-screen"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
             <XCircle size={48} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2 font-noto">
             {error.includes('ইন-অ্যাক্টিভ') ? 'শিক্ষার্থী ইন-অ্যাক্টিভ' : 'ত্রুটি হয়েছে'}
          </h1>
          <p className="text-slate-500 mb-8 max-w-sm font-noto">
             {error}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
            <button 
              onClick={() => fetchData()} 
              className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg shadow-slate-200 active:scale-95 transition-all"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              আবার চেষ্টা করুন
            </button>
            <button 
              onClick={handleLogout} 
              className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-black active:scale-95 transition-all"
            >
              লগ আউট
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="main-portal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex h-full w-full bg-[#0F172A] overflow-hidden relative"
        >
          <div className="flex flex-1 h-full w-full bg-slate-50 overflow-hidden relative">

      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex w-72 flex-col border-r h-full fixed top-0 left-0 z-50 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-blue-100'}`}>
        <div className="p-6 border-b border-inherit flex flex-col justify-center">
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
               {madrasah?.logo_url ? (
                 <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" />
               ) : (
                 <BookOpen size={24} className="text-blue-600" />
               )}
             </div>
             <div className="min-w-0">
               <h1 className={`text-lg font-black leading-tight tracking-tight font-noto line-clamp-3 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
                 {madrasah?.name || 'Deenora'}
               </h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto">
                 Parent Portal
               </p>
             </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
           {[
             { id: 'home', icon: LayoutDashboard, label: 'ড্যাশবোর্ড', visible: true },
             { id: 'chat', icon: MessageSquareText, label: 'লাইভ চ্যাট', visible: isLiveChatEnabled },
             { id: 'attendance', icon: ClipboardList, label: 'উপস্থিতি', visible: modules.attendance !== false },
             { id: 'results', icon: GraduationCap, label: 'ফলাফল', visible: (modules.results !== false || modules.exam !== false) },
             { id: 'fees', icon: Banknote, label: 'ফি ও বকেয়া', visible: modules.accounting !== false },
             { id: 'notices', icon: Bell, label: 'নোটিশ', visible: true },
             { id: 'profile', icon: User, label: 'প্রোফাইল', visible: true }
           ].filter(t => t.visible).map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group ${
                 isTabActive(tab.id) 
                   ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-700') 
                   : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')
               }`}
             >
               <tab.icon 
                 size={22} 
                 strokeWidth={isTabActive(tab.id) ? 2.5 : 2} 
                 className={`${isTabActive(tab.id) ? (madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-blue-700') : 'text-slate-400 group-hover:text-blue-500 transition-colors'}`}
               />
               <span className="text-sm font-bold font-noto">{tab.label}</span>
             </button>
           ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
           <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all w-full text-red-400 hover:bg-red-500/10">
             <LogOut size={20} />
             <span className="text-sm font-bold font-noto">লগ আউট</span>
           </button>
        </div>
      </div>

      <div className="flex-1 lg:ml-64 flex flex-col h-full overflow-hidden bg-blue-50/50 relative">
        {/* Top Header */}
        <header 
          className="px-5 md:px-8 pb-3 md:py-5 flex items-center justify-between bg-white/90 backdrop-blur-xl border-b border-slate-100 z-40 sticky top-0 shrink-0"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-3">
            <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2 font-noto tracking-tight">
                স্বাগতম, অভিভাবক 👋
              </h1>
              <p className="hidden md:block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                আপনার সন্তানের সকল আপডেট জানুন
              </p>
              <div className="md:hidden flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  লাইভ আপডেট
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {notifPermission === 'granted' && (
              <button
                onClick={handleTestPushNotification}
                className="hidden sm:inline-flex px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-200 text-xs font-bold items-center gap-1.5 transition-colors cursor-pointer"
                title="টেস্ট নোটিফিকেশন পাঠান"
              >
                <Smartphone size={14} />
                <span>টেস্ট নোটিফিকেশন</span>
              </button>
            )}
            <button 
              onClick={handleEnableNotifications} 
              className={`p-2.5 md:p-3 rounded-xl transition-all border flex items-center gap-1.5 font-bold text-xs font-noto cursor-pointer ${
                notifPermission === 'granted'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                  : notifPermission === 'denied'
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md'
              }`}
              title={
                notifPermission === 'granted'
                  ? 'নোটিফিকেশন সক্রিয় আছে'
                  : notifPermission === 'denied'
                  ? 'ব্রাউজারে নোটিফিকেশন ব্লক করা রয়েছে'
                  : 'নোটিফিকেশন চালু করুন'
              }
            >
              <BellRing size={18} className={notifPermission === 'default' ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">
                {notifPermission === 'granted' ? 'অন' : notifPermission === 'denied' ? 'ব্লকড' : 'নোটিফিকেশন'}
              </span>
            </button>
            <button onClick={() => fetchData()} className="p-2.5 md:p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-all border border-slate-100 hover:border-blue-100 group cursor-pointer">
              <RefreshCw size={18} className={`${refreshing ? 'animate-spin' : ''} group-active:rotate-180 transition-transform`} />
            </button>
          </div>
        </header>

        {/* Notification Alert Toast */}
        <AnimatePresence>
          {notifToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs font-bold font-noto"
            >
              <BellRing size={16} className="text-emerald-400" />
              <span>{notifToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Notification Enable Banner */}
        {showNotifBanner && notifPermission === 'default' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2 shadow-md z-30"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 text-white animate-bounce" />
              </div>
              <div className="text-left">
                <p className="font-black text-xs font-noto">মোবাইল স্ক্রিনে সরাসরি কল ও নোটিশ পেতে নোটিফিকেশন চালু করুন 📞🔔</p>
                <p className="text-[10px] text-blue-100 font-noto">হোয়াটসঅ্যাপের মতো সরাসরি মোবাইল স্ক্রিনে কল আসা এবং ক্লাসের নোটিশ পাবেন।</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableNotifications}
                className="px-3.5 py-1.5 bg-white text-blue-700 font-black text-xs rounded-xl shadow-md active:scale-95 transition-all font-noto hover:bg-blue-50 cursor-pointer"
              >
                অনুমতি দিন
              </button>
              <button
                onClick={() => setShowNotifBanner(false)}
                className="p-1 text-white/80 hover:text-white cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>
          </motion.div>
        )}

        <main className={`flex-1 w-full ${activeTab === 'chat' ? 'h-full overflow-hidden p-0 m-0' : 'overflow-y-auto custom-scrollbar px-3.5 sm:px-5 md:px-8 pt-4 pb-44 md:pb-8'}`}>
        {/* Date Display */}
        {activeTab === 'home' && (
          <div className="mb-4 animate-in fade-in duration-700">
            <div className="flex flex-nowrap items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0 py-1">
              <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-slate-100 px-3 py-1.5 rounded-xl shadow-soft shrink-0">
                <Moon size={12} className="text-amber-500" />
                <span className="text-[10px] md:text-xs font-black text-slate-700 font-noto whitespace-nowrap">
                  {getHijriDate(new Date()).fullBn.split(',')[0]}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-slate-100 px-3 py-1.5 rounded-xl shadow-soft shrink-0">
                <Calendar size={12} className="text-blue-500" />
                <span className="text-[10px] md:text-xs font-black text-slate-700 font-noto whitespace-nowrap">
                  {new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-slate-100 px-3 py-1.5 rounded-xl shadow-soft shrink-0">
                <Sun size={12} className="text-emerald-500" />
                <span className="text-[10px] md:text-xs font-black text-slate-700 font-noto whitespace-nowrap">
                  {getBengaliDate(new Date()).fullBn.split(',')[0]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Student Profile Card - Only on Home */}
        {activeTab === 'home' && (
          <div className="bg-white border border-slate-100 p-5 rounded-[2.5rem] flex items-center justify-between shadow-premium animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4 text-left">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 overflow-hidden">
                {((madrasah?.config_json?.modules?.student_photo === true) && student?.photo_url) ? (
                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={28} className="text-blue-500" />
                )}
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-base">{student?.student_name}</h2>
                <p className="text-[10px] font-bold text-slate-500 flex items-center gap-2 uppercase">
                  শ্রেণী: {student?.classes?.class_name || 'N/A'} {student?.section && <><span className="w-1 h-1 bg-slate-300 rounded-full" /> {student.section}</>} <span className="w-1 h-1 bg-slate-300 rounded-full" /> আইডি: {student?.registration_number || student?.roll || 'N/A'}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <GraduationCap size={10} className="text-blue-600" />
                  <span className="text-[9px] font-bold text-slate-400 truncate max-w-[120px]">{madrasah?.name || 'প্রতিষ্ঠানের নাম'}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setActiveTab('profile')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
              দেখুন <ChevronRight size={14} className="inline ml-1" />
            </button>
          </div>
        )}

        {/* Stats Grid - Only on Home */}
        {activeTab === 'home' && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-6 duration-700 delay-100">
              {[
                { id: 'attendance', icon: CheckCircle2, color: 'emerald', label: 'উপস্থিতি', value: `${stats.present}/${stats.total}`, sub: 'এই মাস', visible: modules.attendance !== false },
                { id: 'results', icon: GraduationCap, color: 'blue', label: 'ফলাফল', value: stats.lastGpa, sub: 'সর্বশেষ', visible: (modules.results !== false || modules.exam !== false) },
                { id: 'fees', icon: CreditCard, color: 'orange', label: 'বকেয়া ফি', value: `৳${stats.pendingFees}`, sub: 'পরিশোধিত', visible: modules.accounting !== false },
                { id: 'notices', icon: Bell, color: 'red', label: 'নোটিশ', value: notices.length.toString(), sub: 'সব তথ্য', visible: true },
              ].filter(s => s.visible).map((stat, i) => (
                <motion.div 
                  key={i} 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(stat.id as any)}
                  className="bg-white border border-slate-100 p-4 sm:p-5 rounded-[2rem] flex flex-col items-center text-center gap-2 sm:gap-3 cursor-pointer shadow-soft hover:shadow-premium hover:-translate-y-1 transition-all h-full"
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100`}>
                    <stat.icon size={20} className={stat.id === 'attendance' ? 'text-emerald-500' : stat.id === 'results' ? 'text-blue-600' : stat.id === 'fees' ? 'text-orange-500' : 'text-red-500'} />
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                    <p className="text-sm sm:text-base font-black text-slate-900">{stat.value}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">{stat.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8 mt-8 pb-4">
              {/* Upcoming Events */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2 font-noto">
                    <Calendar size={14} className="text-blue-600" /> আসন্ন ইভেন্ট
                  </h3>
                  <button className="text-[10px] font-bold text-slate-400 uppercase">সব দেখুন</button>
                </div>
                <div className="space-y-3">
                  {events.length > 0 ? events.map((event: any, i: number) => {
                    const dateObj = new Date(event.event_date);
                    const day = new Intl.DateTimeFormat('bn-BD', { day: 'numeric' }).format(dateObj);
                    const month = new Intl.DateTimeFormat('bn-BD', { month: 'short' }).format(dateObj);
                    
                    return (
                      <div key={i} className="bg-white border border-slate-100 p-4 rounded-3xl flex items-center gap-4 shadow-soft hover:shadow-premium transition-all duration-300 transform hover:scale-[1.02]">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-200 overflow-hidden">
                          <span className="text-xs font-black text-slate-900 leading-none mb-0.5">{day}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{month}</span>
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="text-sm font-black text-slate-900">{event.title}</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{event.event_type === 'holiday' ? 'ছুটি' : 'ইভেন্ট'}</p>
                          <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={10} /> সারাদিন
                          </p>
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full ${event.event_type === 'holiday' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      </div>
                    );
                  }) : (
                    <div className="bg-white/50 border border-dashed border-slate-200 p-6 rounded-3xl text-center text-[10px] text-slate-400 italic">
                      নিকট ভবিষ্যতে কোনো ইভেন্ট নেই।
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2 font-noto">
                    <BarChart3 size={14} className="text-emerald-600" /> সাম্প্রতিক কার্যক্রম
                  </h3>
                  <button className="text-[10px] font-bold text-slate-400 uppercase">সব দেখুন</button>
                </div>
                <div className="space-y-3">
                   {recentActivities.length > 0 ? recentActivities.map((item, i) => (
                     <div key={i} className="bg-white/60 border border-slate-100 p-4 rounded-3xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4 text-left">
                           <div className={`w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 ${item.color === 'emerald' ? 'text-emerald-500' : item.color === 'blue' ? 'text-blue-600' : item.color === 'orange' ? 'text-orange-500' : item.color === 'red' ? 'text-red-500' : 'text-purple-500'}`}>
                              <item.icon size={18} />
                           </div>
                           <div>
                              <h4 className="text-xs font-black text-slate-900">{item.title}</h4>
                              <p className="text-[10px] font-bold text-slate-400">{item.sub}</p>
                           </div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${item.color === 'emerald' ? 'text-emerald-600' : 'text-slate-400'}`}>
                           {item.trail}
                        </span>
                     </div>
                   )) : (
                    <div className="bg-white/50 border border-dashed border-slate-200 p-6 rounded-3xl text-center text-xs text-slate-400 italic">
                      কোনো সাম্প্রতিক কার্যক্রম নেই।
                    </div>
                   )}
                </div>
              </div>

              {/* Performance Section */}
              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] relative overflow-hidden text-center shadow-premium backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl" />
                <div className="relative z-10">
                   <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                      <div className="relative">
                        <GraduationCap size={32} className="text-blue-600" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                           <Trophy size={11} className="text-white" />
                        </div>
                      </div>
                   </div>
                   <h3 className="text-lg font-black text-slate-900 mb-1 font-noto">দারুন চলছে!</h3>
                   <p className="text-[11px] font-bold text-slate-400 leading-relaxed max-w-[200px] mx-auto mb-8 font-noto">{student?.student_name} অনেক ভালো করছে। তাকে আরও উৎসাহিত করুন।</p>
                   
                    <div className="flex items-center justify-around">
                       <div className="relative w-24 h-24">
                          <svg className="w-full h-full transform -rotate-90">
                             <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                             <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251} strokeDashoffset={251 - (251 * performanceRate) / 100} className="text-emerald-500" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                             <span className="text-xl font-black text-slate-900 tracking-tight">{performanceRate}%</span>
                             <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">পারফরম্যান্স</span>
                          </div>
                       </div>
                       <div className="text-left space-y-4">
                          <div className="space-y-0.5">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> শ্রেণীতে অবস্থান</p>
                             <p className="text-base font-black text-slate-900 pl-3"><span className="text-emerald-500">{student?.roll || '--'}</span> / {classTotal || '--'}</p>
                          </div>
                          <div className="space-y-0.5">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> উপস্থিতির হার</p>
                             <p className="text-base font-black text-slate-900 pl-3">{attendanceRate}%</p>
                          </div>
                       </div>
                    </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div key="attendance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
               <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 font-noto">উপস্থিতি</h2>
                  <div className="bg-white px-4 py-2 rounded-xl flex items-center gap-3 border border-slate-200 shadow-sm">
                     <button 
                       onClick={() => {
                         if (viewMonth === 0) {
                           setViewMonth(11);
                           setViewYear(viewYear - 1);
                         } else {
                           setViewMonth(viewMonth - 1);
                         }
                       }}
                       className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                     >
                       <ChevronLeft size={16} />
                     </button>
                     <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-600" />
                        <span className="text-xs font-black text-slate-900 w-24 text-center">
                          {new Intl.DateTimeFormat('bn-BD', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth))}
                        </span>
                     </div>
                     <button 
                       onClick={() => {
                         if (viewMonth === 11) {
                           setViewMonth(0);
                           setViewYear(viewYear + 1);
                         } else {
                           setViewMonth(viewMonth + 1);
                         }
                       }}
                       className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                     >
                       <ChevronRight size={16} />
                     </button>
                  </div>
               </div>

               {/* Summary Cards */}
               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 space-y-10 shadow-premium">
                  <div className="grid grid-cols-3 gap-2">
                     <div className="text-center group">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-100 group-hover:scale-110 transition-transform">
                           <CheckCircle2 size={28} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">উপস্থিত</p>
                        <p className="text-lg font-black text-slate-900">{stats.present} <span className="text-xs text-slate-400 font-bold ml-1">দিন</span></p>
                     </div>
                     <div className="text-center group">
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-red-100 group-hover:scale-110 transition-transform">
                           <XCircle size={28} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">অনুপস্থিত</p>
                        <p className="text-lg font-black text-slate-900">{stats.absent} <span className="text-xs text-slate-400 font-bold ml-1">দিন</span></p>
                     </div>
                     <div className="text-center group">
                        <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-orange-100 group-hover:scale-110 transition-transform">
                           <Clock size={28} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">দেরি</p>
                        <p className="text-lg font-black text-slate-900">{stats.late} <span className="text-xs text-slate-400 font-bold ml-1">দিন</span></p>
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                     <div className="flex justify-between items-end mb-1 px-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">উপস্থিতির হার</p>
                        <p className="text-2xl font-black text-emerald-600">
                          {attendanceRate}%
                        </p>
                     </div>
                     <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px] shadow-emerald-500/20 relative transition-all duration-1000" 
                          style={{ width: `${attendanceRate}%` }}
                        >
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        </div>
                     </div>
                     <button onClick={() => fetchData()} className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5 pt-2 hover:text-blue-600 transition-colors">
                        <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} /> তথ্য রিফ্রেশ করুন
                     </button>
                  </div>
               </div>

               {/* Filters */}
               <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { id: 'all', label: 'সব দেখুন' },
                    { id: 'present', label: 'উপস্থিত' },
                    { id: 'absent', label: 'অনুপস্থিত' },
                    { id: 'late', label: 'দেরি' }
                  ].map((f) => (
                    <button 
                      key={f.id} 
                      onClick={() => setAttendanceFilter(f.id as any)}
                      className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${attendanceFilter === f.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      {f.label}
                    </button>
                  ))}
               </div>

               {/* Calendar Grid */}
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-premium">
                  <div className="grid grid-cols-7 gap-y-4 text-center mb-6">
                     {['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'].map((d, i) => (
                        <span key={i} className={`text-[11px] font-bold ${i === 5 || i === 6 ? 'text-red-500 uppercase font-black' : 'text-slate-400 uppercase tracking-widest'}`}>{d}</span>
                     ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-4 text-center">
                     {(() => {
                       const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
                       const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
                       const days = [];
                       
                       // Pad previous month
                       for (let i = 0; i < firstDayOfMonth; i++) {
                         days.push(<div key={`pad-${i}`} className="text-slate-100 text-xs font-bold h-10 w-10 flex items-center justify-center">--</div>);
                       }
                       
                       // Current month days
                       for (let day = 1; day <= daysInMonth; day++) {
                         const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                         const att = attendance.find(a => a.date.startsWith(dateStr));
                         const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewMonth && selectedDate.getFullYear() === viewYear;
                         const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
                         
                         days.push(
                           <button 
                             key={day} 
                             onClick={() => setSelectedDate(new Date(viewYear, viewMonth, day))}
                             className="group relative flex flex-col items-center justify-center h-10 w-10 mx-auto"
                           >
                             <div className={`absolute inset-0 transition-all duration-300 rounded-full ${isSelected ? 'bg-blue-600 shadow-lg scale-110' : isToday ? 'border-2 border-blue-600 scale-100' : 'group-hover:bg-slate-50'}`} />
                             <span className={`relative text-xs font-black transition-colors ${isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                                {day.toLocaleString('bn-BD')}
                             </span>
                             {att && !isSelected && (attendanceFilter === 'all' || att.status === attendanceFilter) && (
                               <div className={`absolute bottom-1 w-1 h-1 rounded-full ${att.status === 'present' ? 'bg-emerald-500' : att.status === 'absent' ? 'bg-red-500' : 'bg-orange-500'}`} />
                             )}
                           </button>
                         );
                       }
                       return days;
                     })()}
                  </div>
               </div>

               {/* History List */}
               <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2 font-noto">
                     <HistoryIcon size={16} className="text-blue-600" /> বিস্তারিত তালিকা ({filteredAttendance.length})
                  </h3>
                  {filteredAttendance.length > 0 ? (
                    <div className="space-y-3">
                       {filteredAttendance.slice(0, 10).map((att, i) => (
                          <motion.div 
                            key={att.id} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => {
                              setSelectedDate(new Date(att.date));
                              setViewMonth(new Date(att.date).getMonth());
                              setViewYear(new Date(att.date).getFullYear());
                            }}
                            className="bg-white border border-slate-100 p-4 rounded-3xl flex items-center justify-between shadow-sm hover:border-blue-200 transition-colors cursor-pointer group"
                          >
                             <div className="flex items-center gap-4 text-left">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${att.status === 'present' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : att.status === 'absent' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>
                                   {att.status === 'present' ? <CheckCircle2 size={18} /> : att.status === 'absent' ? <XCircle size={18} /> : <Clock size={18} />}
                                </div>
                                <div className="space-y-0.5">
                                   <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                     {new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(att.date))}
                                   </p>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                     {new Intl.DateTimeFormat('bn-BD', { weekday: 'long' }).format(new Date(att.date))} {att.check_in ? `• ${new Date(`2000-01-01T${att.check_in}`).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' })}` : ''}
                                   </p>
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${att.status === 'present' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : att.status === 'absent' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>
                                   {att.status === 'present' ? 'উপস্থিত' : att.status === 'absent' ? 'অনুপস্থিত' : 'দেরি'}
                                </span>
                                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                             </div>
                          </motion.div>
                       ))}
                       {filteredAttendance.length > 10 && (
                         <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest pt-2">পেছনের আরও রেকর্ড ক্যালেন্ডারে দেখুন</p>
                       )}
                    </div>
                  ) : (
                    <div className="bg-white/50 border border-dashed border-slate-200 p-8 rounded-[2.5rem] text-center text-xs text-slate-400 font-noto">
                      এই ফিল্টারে কোনো রেকর্ড পাওয়া যায়নি।
                    </div>
                  )}
               </div>

               {/* Selected Day Details */}
               <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] space-y-6 shadow-premium">
                  {(() => {
                    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
                    const att = attendance.find(a => a.date.startsWith(dateStr));
                    
                    return (
                      <>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-4 text-left">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${att?.status === 'present' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : att?.status === 'absent' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                 {att?.status === 'present' ? <CheckCircle2 size={28} /> : att?.status === 'absent' ? <XCircle size={28} /> : <Calendar size={28} />}
                              </div>
                              <div>
                                 <h4 className="text-lg font-black text-slate-900 font-noto">
                                   {new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDate)}
                                 </h4>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                   {new Intl.DateTimeFormat('bn-BD', { weekday: 'long' }).format(selectedDate)}
                                 </p>
                              </div>
                           </div>
                           <span className={`text-[11px] font-black uppercase tracking-widest ${att?.status === 'present' ? 'text-emerald-500' : att?.status === 'absent' ? 'text-red-500' : 'text-slate-300'}`}>
                             {att?.status === 'present' ? 'উপস্থিত' : att?.status === 'absent' ? 'অনুপস্থিত' : att?.status === 'late' ? 'দেরি' : 'N/A'}
                           </span>
                        </div>
                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                           <div className="flex items-center gap-4 group">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                 <Clock size={20} />
                              </div>
                              <div className="text-left">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">সময়</p>
                                 <p className="text-sm font-black text-slate-900">{att?.check_in ? new Date(`2000-01-01T${att.check_in}`).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' }) : '—'}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-4 group">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-purple-600 transition-colors">
                                 <MessageSquare size={20} />
                              </div>
                              <div className="text-left">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">নোট</p>
                                 <p className="text-sm font-black text-slate-900">{att?.note || 'নেই'}</p>
                              </div>
                           </div>
                        </div>
                      </>
                    );
                  })()}
               </div>
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
              {results.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center space-y-5 shadow-bubble/50">
                   <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.3rem] flex items-center justify-center mx-auto border border-blue-100">
                      <GraduationCap size={32} />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-xl font-black text-slate-900 font-noto">কোনো পরীক্ষার ফলাফল নেই</h3>
                      <p className="text-xs text-slate-500 font-bold max-w-xs mx-auto leading-relaxed font-noto">এই শিক্ষার্থীর জন্য এখনো কোনো পরীক্ষার ফলাফল প্রকাশ করা হয়নি। অনুগ্রহ করে {(madrasah?.institution_type === 'school' || madrasah?.institution_type === 'kindergarten' || madrasah?.institution_type === 'choching') ? 'প্রতিষ্ঠান' : 'মাদরাসা'} কর্তৃপক্ষের সাথে যোগাযোগ করুন।</p>
                   </div>
                   <button onClick={() => fetchData()} className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 border border-blue-100 shadow-sm active:scale-95 transition-all outline-none">
                      <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> রিফ্রেশ করুন
                   </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight font-noto">ফলাফল</h2>
                    <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5 tracking-widest uppercase">
                       <BarChart3 size={12} /> GPA: {currentExam?.gpa || '--'}
                    </p>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => {
                        if (results.length > 1) {
                          setShowExamDropdown(!showExamDropdown);
                        }
                      }}
                      className={`bg-white px-4 py-2.5 rounded-xl flex items-center gap-2 border shadow-sm transition-all ${
                        showExamDropdown ? 'border-blue-500 ring-2 ring-blue-50/55' : 'border-slate-200 hover:border-slate-300'
                      } ${results.length > 1 ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                       <Calendar size={14} className="text-blue-600" />
                       <span className="text-xs font-black text-slate-900">{currentExam?.name || 'পরীক্ষা নির্বাচন করুন'}</span>
                       {results.length > 1 && (
                         <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${showExamDropdown ? 'rotate-180' : ''}`} />
                       )}
                    </button>

                    {showExamDropdown && results.length > 1 && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowExamDropdown(false)} />
                        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl py-2.5 z-50 animate-in fade-in-50 slide-in-from-top-1" onClick={(e) => e.stopPropagation()}>
                          <div className="px-4 py-2 border-b border-slate-50 mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-noto">পরীক্ষা নির্বাচন করুন</span>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {results.map((exam) => (
                              <button
                                key={exam.id}
                                onClick={() => {
                                  setSelectedExamId(exam.id);
                                  setShowExamDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-xs font-bold font-noto flex items-center justify-between transition-colors ${
                                  (selectedExamId === exam.id || (!selectedExamId && results[0]?.id === exam.id))
                                    ? 'bg-blue-50/80 text-blue-600' 
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className="truncate pr-2">{exam.name}</span>
                                {(selectedExamId === exam.id || (!selectedExamId && results[0]?.id === exam.id)) && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
               </div>

               {/* Result Master Card */}
               <div className="bg-white p-5 rounded-[2rem] border border-slate-100 grid grid-cols-3 gap-4 items-center shadow-premium relative overflow-hidden backdrop-blur-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl" />
                  <div className="text-center space-y-1 z-10">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">সর্বমোট গ্রেড</p>
                     <div className="relative inline-block mt-1">
                        <span className="text-5xl font-black text-emerald-600 leading-none tracking-tight">
                          {currentExam?.gpa_grade || '--'}
                        </span>
                        <div className="absolute -top-1 -right-3 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                           <span className="text-[8px] text-white">★</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="text-center space-y-4 border-l border-slate-100 px-3 z-10">
                     <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">মোট নম্বর</p>
                        <p className="text-base font-black text-slate-900">
                          {currentExam?.marks.reduce((s, m) => s + (m.obtained || 0), 0) || 0} 
                          <span className="text-[10px] text-slate-300 font-bold ml-1">
                            / {currentExam?.marks.reduce((s, m) => s + (m.full || 0), 0) || 0}
                          </span>
                        </p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">শতকরা</p>
                        <p className="text-base font-black text-emerald-600">
                          {currentExam ? Math.round((currentExam.marks.reduce((s, m) => s + (m.obtained || 0), 0) / currentExam.marks.reduce((s, m) => s + (m.full || 0), 0)) * 100) : 0}%
                        </p>
                     </div>
                  </div>

                  <div className="text-center space-y-2 border-l border-slate-100 z-10">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">শ্রেণীতে অবস্থান</p>
                     <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto border border-orange-100 shadow-sm">
                        <Trophy size={16} />
                     </div>
                     <div className="pt-1">
                        <p className="text-xl font-black text-slate-900 tracking-widest">{currentExam?.position || '--'}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                          {currentExam?.position && currentExam.position !== '--' ? 'মেধাক্রম' : 'হিসাবকৃত নয়'}
                        </p>
                     </div>
                  </div>
               </div>

               {/* Subject Table */}
               <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-premium">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                     <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2 font-noto">
                        <BookOpen size={16} className="text-blue-600" /> বিষয়ভিত্তিক ফলাফল
                     </h3>
                     <button onClick={() => fetchData()} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-blue-100 shadow-sm transition-all active:scale-95">
                        <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} /> রিফ্রেশ
                     </button>
                  </div>
                  <div className="p-5 space-y-5">
                     <div className="flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1 px-1">
                        <span>বিষয়</span>
                        <div className="flex gap-4 md:gap-7 pr-1">
                           <span>নম্বর</span>
                           <span>জিপিএ</span>
                           <span>গ্রেড</span>
                        </div>
                     </div>
                     {currentExam?.marks.map((sub, i) => (
                        <div key={i} className="group">
                           <div className="flex items-center justify-between relative">
                              <div className="flex items-center gap-3">
                                 <div className="space-y-1 text-left">
                                    <h4 className="text-xs font-black text-slate-900 capitalize tracking-wide">{sub.subject || 'অজানা বিষয়'}</h4>
                                    <div className="w-28 md:w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                       <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${(sub.obtained / (sub.full || 100)) * 100}%` }}
                                         transition={{ duration: 1, delay: i * 0.1 }}
                                         className="h-full bg-blue-600 rounded-full" 
                                       />
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2 md:gap-5">
                                 <p className="text-[11px] font-black text-slate-900 tracking-tight w-12 text-right">
                                    <span className="text-blue-600">{sub.obtained}</span> 
                                    <span className="text-[8px] text-slate-300 font-bold ml-0.5">/ {sub.full || 100}</span>
                                 </p>
                                 <div className="w-8 h-6 rounded-lg bg-blue-50/50 border border-blue-100 flex items-center justify-center shadow-sm cursor-help" title="জিপিএ">
                                    <span className="text-[10px] font-black text-blue-700">
                                      {sub.obtained < sub.pass ? '0.00' : (sub.gpa || '0.00')}
                                    </span>
                                 </div>
                                 <div className={`w-8 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm cursor-help`}>
                                    <span className={`text-[10px] font-black ${sub.obtained < sub.pass ? 'text-red-500' : 'text-emerald-500'}`}>
                                      {sub.obtained < sub.pass ? 'F' : (sub.grade || 'A-')}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Summary Widgets */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-[2rem] border border-slate-100 flex flex-col items-center gap-4 shadow-premium">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] w-full text-left">ফলাফলের সারসংক্ষেপ</h4>
                     <div className="flex items-center gap-5">
                        <div className="relative w-20 h-20">
                           <svg className="w-full h-full transform -rotate-90">
                              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-50" />
                              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={200} strokeDashoffset={50} className="text-emerald-500" strokeLinecap="round" />
                              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={200} strokeDashoffset={150} className="text-orange-500" strokeLinecap="round" />
                           </svg>
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-xl font-black text-slate-900">{currentExam?.marks.length || 0}</span>
                              <span className="text-[6px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">বিষয়সমূহ</span>
                           </div>
                        </div>
                        <div className="space-y-1.5 text-left">
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm" /> 
                              <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Passed: {currentExam?.marks.filter(m => m.obtained >= m.pass).length}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full shadow-sm" /> 
                              <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Failed: {currentExam?.marks.filter(m => m.obtained < m.pass).length}</span>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Teacher Remarks (If manually entered in exam) */}
                  {currentExam?.remarks && currentExam.remarks.trim() !== '' && (
                    <div className="my-3 p-4 rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 text-left font-noto">
                      <p className="text-xs font-black text-[#1E3A8A] dark:text-blue-400 mb-1">শিক্ষকের মন্তব্য:</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{currentExam.remarks}</p>
                    </div>
                  )}
               </div>
               
               {/* Action Buttons */}
               <div className="pt-4">
                  <button 
                    onClick={async () => {
                      if (!currentExam || !student || !madrasah) return;
                      try {
                        const marks = currentExam.marks.map((m: any) => ({
                          subject_name: m.subject,
                          full_marks: m.full,
                          pass_marks: m.pass,
                          marks_obtained: m.obtained,
                          grade: m.grade,
                          grade_point: m.gpa
                        }));
                        const finalRemarks = currentExam.remarks && currentExam.remarks.trim() !== '' 
                          ? currentExam.remarks 
                          : '';

                        const examInfo = {
                          exam_name: currentExam.name,
                          exam_date: currentExam.date,
                          position: currentExam.position || '--',
                          gpa: currentExam.gpa,
                          gpa_grade: currentExam.gpa_grade,
                          total_marks: currentExam.total_marks,
                          total_full: currentExam.total_full,
                          remarks: finalRemarks
                        };
                        const totalAttendanceRate = (() => {
                          const validRecords = attendance.filter(a => a.status === 'present' || a.status === 'absent' || a.status === 'late' || a.status === 'half_day');
                          if (validRecords.length === 0) return 'N/A';
                          let presentCount = 0;
                          validRecords.forEach(a => {
                            if (a.status === 'present' || a.status === 'late') presentCount += 1;
                            else if (a.status === 'half_day') presentCount += 0.5;
                          });
                          return Math.round((presentCount / validRecords.length) * 100).toString() + '%';
                        })();

                        setDownloadingReport(true);
                        setDownloadProgress(0);
                        try {
                          await generateResultPDF(
                              { ...student, attendance: totalAttendanceRate, smart_remarks: finalRemarks, teacher_remarks: finalRemarks }, 
                              examInfo, 
                              marks, 
                              madrasah, 
                              lang === 'bn' ? 'bn' : 'en',
                              (p) => setDownloadProgress(p)
                          );
                        } finally {
                          setDownloadingReport(false);
                          setDownloadProgress(0);
                        }
                      } catch (err) {
                        console.error('Error generating PDF:', err);
                      }
                    }}
                    className="w-full bg-emerald-50 border border-emerald-100 p-5 rounded-[2rem] flex items-center justify-center gap-4 group hover:bg-emerald-100 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                     <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                        <Download size={20} />
                     </div>
                     <div className="text-left font-noto">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ডাউনলোড</p>
                        <p className="text-xs font-black text-slate-900">রিপোর্ট কার্ড (মার্কশীট)</p>
                     </div>
                  </button>
               </div>
               </>
             )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4 md:space-y-6 pb-20">
               {/* Hero Header Card - Redesigned to be horizontal, super clean, compact on mobile */}
               <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 relative shadow-premium overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-indigo-500/5 to-transparent pointer-events-none" />
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-100/10 rounded-full blur-2xl" />
                  
                  <div className="relative flex flex-row items-center gap-4 text-left w-full">
                    {/* Avatar with smaller size */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-2xl p-1 shadow-md border border-slate-100">
                        {((madrasah?.config_json?.modules?.student_photo === true) && student?.photo_url) ? (
                           <img src={student.photo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                           <div className="w-full h-full bg-slate-50 flex items-center justify-center rounded-xl">
                              <User size={32} className="text-slate-300" />
                           </div>
                        )}
                      </div>
                      <motion.div 
                        initial={{ scale: 0, rotate: -45 }} 
                        animate={{ scale: 1, rotate: 0 }} 
                        className="absolute -bottom-1 -right-1 bg-emerald-500 p-1 md:p-1.5 rounded-lg border-2 border-white shadow-md text-white"
                      >
                        <CheckCircle2 size={12} className="w-3 h-3 md:w-4 md:h-4" />
                      </motion.div>
                    </div>

                     {/* Compact Profile Details */}
                    <div className="flex-grow min-w-0 font-noto">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[9px] md:text-[10px] font-black border border-emerald-100/50 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        অ্যাক্টিভ শিক্ষার্থী
                      </span>
                      <h3 className="text-base md:text-2xl font-black text-slate-900 tracking-tight truncate">
                        {student?.student_name}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[9px] md:text-xs font-bold border border-blue-100/30">
                          শ্রেণী: {student?.classes?.class_name || 'N/A'}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] md:text-xs font-bold border border-indigo-100/30">
                          আইডি: {student?.registration_number || '---'}
                        </span>
                        {student?.section && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-lg text-[9px] md:text-xs font-bold border border-purple-100/30">
                             শাখা: {student.section}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
               </div>

               {/* Quick Child Switcher on Account / Profile Page */}
               {children && children.length > 1 && (
                 <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-4 rounded-3xl border border-blue-500/20 shadow-xl text-white">
                   <div className="flex items-center justify-between gap-2 mb-3 px-1">
                     <div className="flex items-center gap-2">
                       <div className="w-7 h-7 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-400/20 shrink-0">
                         <Users size={16} />
                       </div>
                       <div>
                         <h4 className="text-xs sm:text-sm font-black font-noto">
                           সন্তান পরিবর্তন করুন ({children.length} জন)
                         </h4>
                         <p className="text-[9px] text-blue-200/80 font-noto">
                           যে সন্তানের তথ্য দেখতে চান নির্বাচন করুন
                         </p>
                       </div>
                     </div>
                     <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2.5 py-1 rounded-full border border-blue-400/20 font-noto">
                       একাউন্ট সুইচ
                     </span>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                     {children.map((child) => {
                       const isSelected = student?.id === child.id;
                       const isSwitching = switchingChildId === child.id;
                       return (
                         <button
                           key={child.id}
                           type="button"
                           disabled={isSelected || Boolean(switchingChildId)}
                           onClick={() => handleSwitchChild(child)}
                           className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 cursor-pointer ${
                             isSelected
                               ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg scale-[1.01]'
                               : 'bg-white/5 hover:bg-white/15 text-slate-300 border border-white/5 hover:border-white/20 active:scale-95'
                           }`}
                         >
                           <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                             {child.photo_url ? (
                               <img src={child.photo_url} alt="" className="w-full h-full object-cover" />
                             ) : (
                               <User size={22} className={isSelected ? 'text-white' : 'text-blue-300'} />
                             )}
                           </div>
                           <div className="min-w-0 flex-1 font-noto">
                             <div className="flex items-center justify-between gap-1">
                               <p className="text-xs sm:text-sm font-black truncate leading-tight">
                                 {child.student_name}
                               </p>
                               {isSelected && (
                                 <span className="bg-emerald-500/30 text-emerald-300 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-400/30 shrink-0">
                                   সক্রিয়
                                 </span>
                               )}
                               {isSwitching && (
                                 <Loader2 size={14} className="animate-spin text-white shrink-0" />
                               )}
                             </div>
                             <p className={`text-[10px] font-bold truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                               {child.class_name ? `শ্রেণি: ${child.class_name}` : ''} {child.roll ? `• রোল: ${child.roll}` : ''}
                             </p>
                             <p className={`text-[8px] truncate ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                               আইডি: {child.registration_number || '---'}
                             </p>
                           </div>
                         </button>
                       );
                     })}
                   </div>
                 </div>
               )}

               {/* Modern Profile Sub Tabs for scroll-free navigation on mobile */}
               <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 w-full border border-slate-200/50 overflow-x-auto no-scrollbar">
                 {[
                   { id: 'basic', label: 'ব্যক্তিগত তথ্য', icon: User },
                   { id: 'family', label: 'অভিভাবক', icon: Shield },
                   { id: 'address', label: 'ঠিকানা ও নোট', icon: MapPin },
                   ...(children && children.length > 1 ? [{ id: 'siblings', label: `সকল সন্তান (${children.length})`, icon: Users }] : [])
                 ].map(tab => {
                   const isActive = profileSubTab === tab.id;
                   return (
                     <button
                       key={tab.id}
                       onClick={() => setProfileSubTab(tab.id as any)}
                       className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                         isActive 
                           ? 'bg-white text-blue-600 shadow-sm border border-blue-50/50 font-black' 
                           : 'text-slate-400 hover:text-slate-600 font-bold'
                       }`}
                     >
                       <tab.icon size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                       {tab.label}
                     </button>
                   );
                 })}
               </div>

               {/* Information Sections with Tab Transition */}
               <div className="w-full">
                 <AnimatePresence mode="wait">
                   {profileSubTab === 'basic' && (
                     <motion.div
                       key="basic-tab"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       transition={{ duration: 0.2 }}
                       className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-premium space-y-4"
                     >
                       <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                         <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                           <User size={16} />
                         </div>
                         <h4 className="text-sm font-black text-slate-800 font-noto">ব্যক্তিগত তথ্যাবলী</h4>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3">
                         {[
                           { label: 'রোল নম্বর', value: student?.roll || '---', icon: Hash, color: 'text-orange-500', bg: 'bg-orange-50/30' },
                           { label: 'রেজিস্ট্রেশন নং', value: student?.registration_number || '---', icon: CreditCard, color: 'text-indigo-500', bg: 'bg-indigo-50/30' },
                           { label: 'জন্ম তারিখ', value: student?.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : '---', icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-50/30' },
                           { label: 'রক্তের গ্রুপ', value: student?.blood_group || '---', icon: Heart, color: 'text-red-500', bg: 'bg-red-50/30' },
                           { label: 'ছাত্রের ধরণ', value: student?.student_type === 'boarding' ? 'আবাসিক' : student?.student_type === 'day_scholar' ? 'অনাবাসিক' : student?.student_type || '---', icon: Info, color: 'text-blue-500', bg: 'bg-blue-50/30' },
                           { label: 'বিভাগ/শাখা', value: student?.section || '---', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50/30' },
                           { label: 'শ্রেণী', value: student?.classes?.class_name || 'N/A', icon: GraduationCap, color: 'text-purple-500', bg: 'bg-purple-50/30' },
                           { label: 'বিভাগ', value: student?.department || 'সাধারণ', icon: BookOpen, color: 'text-slate-600', bg: 'bg-slate-50/30' },
                         ].map((item, i) => (
                           <div key={i} className="flex items-center gap-2.5 p-2 bg-slate-50/35 border border-slate-100/60 rounded-xl hover:bg-white hover:shadow-sm hover:border-slate-200/45 transition-all">
                             <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center ${item.color} shrink-0`}>
                               <item.icon size={16} />
                             </div>
                             <div className="text-left font-noto min-w-0">
                               <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">{item.label}</p>
                               <p className="text-[11px] md:text-sm font-black text-slate-800 truncate">{item.value}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     </motion.div>
                   )}

                   {profileSubTab === 'family' && (
                     <motion.div
                       key="family-tab"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       transition={{ duration: 0.2 }}
                       className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-premium space-y-4"
                     >
                       <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                         <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                           <Shield size={16} />
                         </div>
                         <h4 className="text-sm font-black text-slate-800 font-noto">অভিভাবকের তথ্যাবলী</h4>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         {[
                           { label: 'পিতা/অভিভাবক', value: student?.guardian_name || '---', icon: User, color: 'text-blue-600', bg: 'bg-blue-50/30' },
                           { label: 'মাতার নাম', value: student?.mother_name || '---', icon: User, color: 'text-pink-500', bg: 'bg-pink-50/30' },
                           { label: 'জরুরী ফোন', value: student?.guardian_phone || '---', icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50/30' },
                           { label: 'বিকল্প ফোন', value: student?.guardian_phone_2 || '---', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50/30' },
                         ].map((item, i) => (
                           <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-50/35 border border-slate-100/60 rounded-xl hover:bg-white hover:shadow-sm hover:border-slate-200/45 transition-all">
                             <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center ${item.color} shrink-0`}>
                               <item.icon size={18} />
                             </div>
                             <div className="text-left font-noto min-w-0">
                               <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">{item.label}</p>
                               <p className="text-xs md:text-sm font-black text-slate-800 truncate">{item.value}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     </motion.div>
                   )}

                   {profileSubTab === 'address' && (
                     <motion.div
                       key="address-tab"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       transition={{ duration: 0.2 }}
                       className="space-y-4"
                     >
                       {/* Address Info Container */}
                       <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-premium space-y-3">
                         <div className="flex items-center gap-3 border-b border-slate-50 pb-2">
                           <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                             <MapPin size={16} />
                           </div>
                           <h4 className="text-sm font-black text-slate-800 font-noto">স্থায়ী ঠিকানা</h4>
                         </div>
                         
                         <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50 font-noto text-left">
                           <p className="text-xs md:text-sm font-medium text-slate-600 leading-relaxed">
                             {student?.address || 'ঠিকানা পাওয়া যায়নি। প্রতিষ্ঠানের অফিস থেকে এটি আপডেট করা যাবে।'}
                           </p>
                         </div>
                       </div>

                       {/* Academic Notes if any */}
                       {student?.notes && (
                          <div className="bg-amber-50/60 p-4 md:p-6 rounded-3xl border border-amber-100 shadow-soft space-y-3">
                            <div className="flex items-center gap-3 border-b border-amber-100/55 pb-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <FileText size={16} />
                              </div>
                              <h4 className="text-sm font-black text-amber-900 font-noto">শিক্ষক নোট / মন্তব্য</h4>
                            </div>
                            <p className="text-xs md:text-sm font-medium text-amber-800 leading-relaxed bg-white/60 p-4 rounded-xl border border-amber-200/50 italic text-left font-noto">
                              "{cleanStudentNotes(student.notes)}"
                            </p>
                          </div>
                       )}
                     </motion.div>
                   )}
                                     {profileSubTab === 'siblings' && (
                      <motion.div
                        key="siblings-tab"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Users size={16} />
                              </div>
                              <h4 className="text-sm font-black text-slate-800 font-noto">আমার সন্তানগণ ({children.length} জন)</h4>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 font-noto">
                              সুইচ করতে ক্লিক করুন
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {children.map((c) => {
                              const isCurrent = student?.id === c.id;
                              const isSwitching = switchingChildId === c.id;
                              return (
                                <div 
                                  key={c.id} 
                                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                                    isCurrent 
                                      ? 'bg-blue-50/40 border-blue-200 shadow-sm ring-1 ring-blue-400/30' 
                                      : 'bg-slate-50/40 border-slate-100 hover:bg-white hover:shadow-md hover:border-blue-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 text-left">
                                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                                      {c.photo_url ? (
                                        <img src={c.photo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                                      ) : (
                                        <User size={22} className={isCurrent ? 'text-blue-600' : 'text-slate-400'} />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1 font-noto">
                                      <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-black text-slate-900 truncate">
                                          {c.student_name}
                                        </h5>
                                        {isCurrent && (
                                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black shrink-0 border border-emerald-200">
                                            বর্তমান
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                        {c.class_name ? `শ্রেণি: ${c.class_name}` : ''} {c.section ? `(${c.section})` : ''} {c.roll ? `• রোল: ${c.roll}` : ''}
                                      </p>
                                      <p className="text-[9px] font-semibold text-slate-400">
                                        আইডি: {c.registration_number || c.admission_number || '---'}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={isCurrent || Boolean(switchingChildId)}
                                    onClick={() => {
                                      handleSwitchChild(c);
                                      setActiveTab('home');
                                    }}
                                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-black font-noto flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                                      isCurrent
                                        ? 'bg-emerald-600 text-white cursor-default'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                                    }`}
                                  >
                                    {isSwitching ? (
                                      <>
                                        <Loader2 size={14} className="animate-spin text-white" />
                                        <span>লোড হচ্ছে...</span>
                                      </>
                                    ) : isCurrent ? (
                                      <>
                                        <CheckCircle2 size={14} className="text-white" />
                                        <span>এই প্রোফাইলটি সক্রিয় রয়েছে</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>এই সন্তানের তথ্য দেখুন</span>
                                        <ArrowRight size={14} />
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>

               {/* Modern Minimalist Logout Row */}
               <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout} 
                  className="w-full p-4 bg-red-50/45 border border-red-100/50 hover:bg-red-50 hover:border-red-200 rounded-3xl flex items-center justify-between text-red-600 transition-all shadow-sm group font-noto font-black"
               >
                  <div className="flex items-center gap-3.5 text-left">
                     <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-red-100 text-red-500 group-hover:scale-105 transition-transform">
                        <LogOut size={18} />
                     </div>
                     <div className="text-left">
                        <span className="block font-black text-xs uppercase tracking-wider">অভিভাবক লগআউট</span>
                        <span className="block text-[8px] font-bold text-red-400 tracking-[0.1em] mt-0.5 uppercase">সেশন ডিলিট হয়ে যাবে</span>
                     </div>
                  </div>
                  <ChevronRight size={18} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
               </motion.button>
               
               {/* Footer brand block */}
               <div className="flex flex-col items-center gap-0.5 pt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Deenora App</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  </div>
                  <p className="text-[7px] font-bold text-slate-300 uppercase tracking-widest">Build v26.06.2023</p>
               </div>
            </motion.div>
          )}

          {activeTab === 'fees' && (() => {
            const currentMonthStr = new Date().toISOString().substring(0, 7);
            const currentYearStr = currentMonthStr.substring(0, 4);

            const feePaid = feeStats.totalPaid;
            const feeTotal = feeStats.totalPayable;
            const feeDue = feeStats.pendingFees;
            const feeDiscount = feeStats.totalDiscount;

            const paidPercentage = feeTotal > 0 ? Math.round((feePaid / feeTotal) * 100) : 0;
            const duePercentage = feeTotal > 0 ? Math.round((feeDue / feeTotal) * 100) : 0;
            const discountPercentage = feeTotal > 0 ? Math.round((feeDiscount / feeTotal) * 100) : 0;

            const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
            
            const allInstallments = Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, '0');
              const monthStr = `${currentYearStr}-${m}`;
              
              const details = getFeeDetailsForMonth(monthStr);

              return {
                index: i + 1,
                month: monthStr,
                nameBn: monthNamesBn[i],
                status: details.status,
                amount: details.payable,
                paidAmount: details.paid,
                discount: details.discount,
                due: details.due,
                dueDate: `১০ ${monthNamesBn[i]} ${currentYearStr.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)])}`
              };
            });

            // Summary stats for installments
            const paidInstallments = allInstallments.filter(inst => inst.status === 'paid').length;
            const dueInstallments = allInstallments.filter(inst => inst.status === 'unpaid' || inst.status === 'partial').length;
            const totalInstallments = 12;

            const formatMonth = (monthStr: string) => {
              if (!monthStr || !monthStr.includes('-')) return monthStr;
              const [y, m] = monthStr.split('-');
              const mIndex = parseInt(m, 10) - 1;
              if (mIndex >= 0 && mIndex < 12) {
                 return `${monthNamesBn[mIndex]} ${y.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)])}`;
              }
              return monthStr;
            };

            const formatDay = (monthStr: string) => {
              if (!monthStr || !monthStr.includes('-')) return monthStr;
              const [y, m] = monthStr.split('-');
              const mIndex = parseInt(m, 10) - 1;
              if (mIndex >= 0 && mIndex < 12) {
                 return `১০ ${monthNamesBn[mIndex]} ${y.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)])}`;
              }
              return monthStr;
            };

            return (
            <motion.div key="fees" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              
              {/* Header with Session dropdown mockup */}
              <div className="flex justify-between items-center mb-4 mx-1">
                <h2 className="text-xl font-black text-slate-900 font-noto tracking-tight">ফি</h2>
                <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-bold text-slate-700">
                  <Calendar size={16} /> সেশন ২০২৫-২৬ <ChevronRight size={16} className="rotate-90 ml-2" />
                </button>
              </div>

              {/* 5 Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Total Fees */}
                <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100/50 flex flex-col justify-center text-left hover:shadow-premium hover:-translate-y-1 transition-all duration-300 shadow-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Wallet size={16} /></div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">প্রদেয় ফি</span>
                  </div>
                  <h3 className="text-2xl font-black text-emerald-600 mb-1">৳{feeTotal.toLocaleString('bn-BD')}</h3>
                  <p className="text-[11px] font-medium text-slate-500">এই সেশনে</p>
                </div>

                {/* Paid Amount */}
                <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100/50 flex flex-col justify-center text-left hover:shadow-premium hover:-translate-y-1 transition-all duration-300 shadow-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><WalletCards size={16} /></div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">পরিশোধিত</span>
                  </div>
                  <h3 className="text-2xl font-black text-blue-600 mb-1">৳{feePaid.toLocaleString('bn-BD')}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{paidPercentage}% পরিশোধিত</p>
                </div>

                {/* Discount Amount */}
                <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100/50 flex flex-col justify-center text-left hover:shadow-premium hover:-translate-y-1 transition-all duration-300 shadow-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-500"><TrendingDown size={16} /></div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">ছাড়</span>
                  </div>
                  <h3 className="text-2xl font-black text-amber-600 mb-1">৳{feeDiscount.toLocaleString('bn-BD')}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{discountPercentage}% মোট ছাড়</p>
                </div>

                {/* Due Amount */}
                <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-100/50 flex flex-col justify-center text-left hover:shadow-premium hover:-translate-y-1 transition-all duration-300 shadow-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500"><WalletCards size={16} /></div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">বকেয়া</span>
                  </div>
                  <h3 className="text-2xl font-black text-orange-500 mb-1">৳{feeDue.toLocaleString('bn-BD')}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{duePercentage}% বকেয়া</p>
                </div>

                {/* Total Installments */}
                <div className="bg-purple-50/50 p-5 rounded-3xl border border-purple-100/50 flex flex-col justify-center text-left hover:shadow-premium hover:-translate-y-1 transition-all duration-300 shadow-soft col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><ReceiptText size={16} /></div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">মোট মাস</span>
                  </div>
                  <h3 className="text-2xl font-black text-purple-600 mb-1">{totalInstallments}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{paidInstallments} পরিশোধ, {dueInstallments} বকেয়া</p>
                </div>
              </div>

              {/* Installment Details Section */}
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-premium p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600"><ReceiptText size={16} /></div>
                    <h3 className="font-bold text-slate-900 text-lg">ফি বিবরন</h3>
                  </div>
                  <button className="text-purple-600 text-sm font-medium hover:underline flex items-center gap-1">
                    ফি স্ট্রাকচার দেখুন <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  {allInstallments.map((inst, i) => {
                    const isPaid = inst.status === 'paid';
                    const isPartial = inst.status === 'partial';
                    const isNoFee = inst.status === 'no_fee';

                    const cardBgClass = isPaid 
                      ? 'bg-emerald-50/30 border-emerald-100/50 hover:shadow-emerald-500/5' 
                      : isPartial 
                        ? 'bg-amber-50/50 border-amber-100/50 hover:shadow-amber-500/5' 
                        : isNoFee
                          ? 'bg-slate-50/30 border-slate-100/50 opacity-60'
                          : 'bg-slate-50/50 border-slate-100';

                    const textClass = isPaid 
                      ? 'text-emerald-700' 
                      : isPartial 
                        ? 'text-amber-700' 
                        : 'text-slate-700';

                    const dotBgClass = isPaid 
                      ? 'bg-emerald-400' 
                      : isPartial 
                        ? 'bg-amber-400' 
                        : isNoFee
                          ? 'bg-slate-300'
                          : 'bg-orange-400';

                    const statusLabel = isPaid 
                      ? 'পরিশোধিত' 
                      : isPartial 
                        ? 'আংশিক পরিশোধ' 
                        : isNoFee
                          ? 'কোনো ফি নেই'
                          : 'বকেয়া';

                    return (
                      <div key={i} className={`p-4 rounded-3xl border transition-all flex flex-col gap-2.5 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${cardBgClass}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center flex-wrap gap-1 mb-1">
                              <span className={`text-xs font-black tracking-tight ${textClass}`}>{inst.nameBn}</span>
                              {inst.discount > 0 && (
                                <span className="text-[7px] font-black bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200">
                                  ছাড় ৳{inst.discount}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${dotBgClass}`} />
                              {statusLabel}
                            </span>
                          </div>
                          
                          {isPaid ? (
                            <div className="inline-flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-full border border-emerald-200 text-emerald-500 bg-emerald-50 shadow-sm">
                              <CheckCircle2 size={14} />
                            </div>
                          ) : isPartial ? (
                            <div className="inline-flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-full border border-amber-200 text-amber-500 bg-amber-50 shadow-sm">
                              <Clock size={14} className="text-amber-500" />
                            </div>
                          ) : null}
                        </div>
                        
                        <div className={`flex flex-col p-3 rounded-2xl mt-1 ${
                          isPaid ? 'bg-emerald-500/5 border border-emerald-500/10' : 
                          isPartial ? 'bg-amber-500/5 border border-amber-500/10' : 
                          'bg-white border border-slate-200'
                        } transition-all`}>
                            <div className="flex flex-wrap justify-between items-center gap-1 mb-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">পরিমাণ (৳)</p>
                                {isPaid ? (
                                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-full">পরিশোধিত</span>
                                ) : isPartial ? (
                                    <span className="text-[8px] font-black text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-full">আংশিক</span>
                                ) : isNoFee ? (
                                    <span className="text-[8px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">প্রযোজ্য নয়</span>
                                ) : (
                                    <span className="text-[8px] font-black text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-full">বকেয়া</span>
                                )}
                            </div>
                            <div className="flex flex-wrap justify-between items-center gap-2 mt-1">
                                <h3 className={`font-black text-base flex-shrink-0 ${
                                  isPaid ? 'text-emerald-700' : 
                                  isPartial ? 'text-amber-700' : 
                                  'text-slate-800'
                                }`}>
                                  ৳{isPaid ? inst.amount.toLocaleString('bn-BD') : inst.due.toLocaleString('bn-BD')}
                                </h3>
                                {!isPaid && !isNoFee && (
                                    <button className="px-3 py-1.5 bg-[#4F46E5]/10 text-[#4F46E5] hover:bg-[#4F46E5]/20 transition-colors text-[10px] font-bold rounded-lg whitespace-nowrap active:scale-95">
                                        পে
                                    </button>
                                )}
                            </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Transactions and Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Recent Transactions */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 text-lg">সাম্প্রতিক লেনদেন</h3>
                    <button className="text-purple-600 text-sm font-medium hover:underline">সব দেখুন</button>
                  </div>
                  
                  <div className="space-y-4">
                    {fees.length > 0 ? fees.slice(0, 3).map((fee, idx) => {
                      const feeAmount = fee.status === 'paid' ? (fee.amount_paid || fee.amount_due || 0) : (fee.amount_due || 0);
                      return (
                      <div key={idx} className="flex items-center justify-between pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 text-left">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fee.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}>
                             {fee.status === 'paid' ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                                {(() => {
                                    // Try to identify specific fee name if it's stored in the fee record description or category
                                    // Or match based on context. 
                                    const feeRec: any = fee;
                                    if (feeRec.fee_name) return feeRec.fee_name;
                                    if (feeRec.category && feeRec.category !== 'Fee' && feeRec.category !== 'ফি') return feeRec.category;

                                    const monthStr = fee.month;
                                    if (!monthStr) return fee.status === 'paid' ? 'পেমেন্ট গৃহীত' : 'বকেয়া যুক্ত';
                                    
                                    const activeStructures = feeStructures.filter(s => {
                                        const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
                                        const isEnabled = setting ? setting.is_enabled : true;
                                        
                                        // Check if this month matches the start/end dates of the structure
                                        const isMonthExpired = s.due_date && monthStr > s.due_date.slice(0, 7);
                                        const isMonthNotStarted = s.start_date && monthStr < s.start_date.slice(0, 7);
                                        const isBeforeYearStart = academicYearStart && monthStr < academicYearStart.slice(0, 7);
                                        
                                        return isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart;
                                    });
                                    
                                    if (activeStructures.length > 0) {
                                        // If we have specific payment data, try to match by amount
                                        const totalAmt = (Number(fee.amount_paid) || 0) + (Number(fee.discount) || 0);
                                        const matchingByAmount = activeStructures.filter(s => {
                                            const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
                                            const amount = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                                            return amount === totalAmt;
                                        });

                                        if (matchingByAmount.length > 0) {
                                            return matchingByAmount.map(s => s.fee_name).join(', ');
                                        }

                                        return activeStructures.map(s => s.fee_name).join(', ');
                                    }
                                    
                                    return fee.status === 'paid' ? 'পেমেন্ট গৃহীত' : 'বকেয়া যুক্ত';
                                })()}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              {formatMonth(fee.month)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 font-medium mb-1">{formatDay(fee.month)}</p>
                          <p className={`text-sm font-bold ${fee.status === 'paid' ? 'text-emerald-600' : 'text-orange-500'}`}>
                             {fee.status === 'paid' ? '+' : '-'}৳{feeAmount.toLocaleString('bn-BD')}
                          </p>
                        </div>
                      </div>
                    )}) : (
                      <div className="text-center italic text-slate-400 text-sm py-4">কোনো লেনদেন নেই</div>
                    )}
                  </div>
                </div>

                {/* Fee Summary */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col">
                  <h3 className="font-bold text-slate-900 text-lg mb-6 text-left">ফি সারাংশ</h3>
                  
                  <div className="flex-grow flex flex-col items-center justify-center relative -mt-4">
                    <div className="relative w-40 h-40">
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                        {feeTotal > 0 && (
                          <>
                            <circle cx="50" cy="50" r="40" stroke="#10b981" strokeWidth="12" fill="transparent" 
                                    strokeDasharray={`${(feePaid/feeTotal)*251} 251`} strokeLinecap="round" />
                            <circle cx="50" cy="50" r="40" stroke="#f97316" strokeWidth="12" fill="transparent" 
                                    strokeDasharray={`${(feeDue/feeTotal)*251} 251`} strokeDashoffset={-((feePaid/feeTotal)*251)} strokeLinecap="round" />
                          </>
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-slate-900 border-b border-slate-200 pb-1 mb-1 shadow-sm px-2">৳{feePaid.toLocaleString('bn-BD')}</span>
                        <span className="text-[10px] font-bold text-slate-500">পরিশোধিত</span>
                      </div>
                    </div>

                    <div className="w-full space-y-3 mt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                          <span className="text-sm text-slate-600 font-medium">পরিশোধিত</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600 font-noto">৳{feePaid.toLocaleString('bn-BD')} ({paidPercentage}%)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <span className="text-sm text-slate-600 font-medium">বকেয়া</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600 font-noto">৳{feeDue.toLocaleString('bn-BD')} ({duePercentage}%)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Support Banner */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">পেমেন্ট নিয়ে সাহায্য প্রয়োজন?</h4>
                    <p className="text-sm text-slate-600">পেমেন্ট সংক্রান্ত যেকোনো তথ্যের জন্য সরাসরি অফিসে যোগাযোগ করুন।</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <a 
                    href={madrasah?.phone ? `tel:${madrasah.phone}` : '#'} 
                    className="flex-1 md:flex-none flex flex-col items-center justify-center bg-white text-purple-600 border border-purple-200 px-4 py-2 rounded-xl font-bold text-sm hover:bg-purple-50 transition-colors shadow-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <PhoneCall size={16} /> অফিসে যোগাযোগ
                    </span>
                    {madrasah?.phone && (
                      <span className="text-[10px] text-slate-400 font-mono font-medium tracking-wide mt-0.5">{madrasah.phone}</span>
                    )}
                  </a>
                </div>
              </div>

            </motion.div>
            );
          })()}

          {activeTab === 'notices' && (
            <motion.div key="notices" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6 pb-20">
              <div className="flex flex-col gap-6">
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-black text-slate-900 font-noto tracking-tight">তথ্য ও যোগাযোগ</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 font-noto">{(madrasah?.institution_type === 'school' || madrasah?.institution_type === 'kindergarten' || madrasah?.institution_type === 'choching') ? 'প্রতিষ্ঠানের' : 'মাদরাসার'} সকল আপডেট এখানে পাবেন</p>
                </div>
                
                <div className="flex flex-wrap justify-center sm:justify-start bg-slate-100/50 p-1.5 rounded-2xl gap-1.5 self-center sm:self-start border border-slate-100 w-full sm:w-auto">
                  {[
                    { id: 'notice', label: 'নোটিশ', icon: Bell },
                    { id: 'diary', label: 'ডায়েরি', icon: BookOpen },
                    { id: 'syllabus', label: 'সিলেবাস', icon: FileText },
                    { id: 'suggestion', label: 'সাজেশন', icon: BookOpen },
                    { id: 'routine', label: 'রুটিন', icon: Calendar }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveNoticeTab(tab.id as any)}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 min-w-[30%] sm:min-w-0 px-3 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        activeNoticeTab === tab.id 
                          ? 'bg-white text-blue-600 shadow-soft border border-blue-50/50' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeNoticeTab === 'routine' ? (
                <div>
                  {publishedClassRoutines.length === 0 ? (
                    <div className="bg-white/50 border border-dashed border-slate-200 p-12 rounded-[3rem] text-center space-y-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                        <Calendar size={40} className="text-slate-300" />
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-700 font-noto">কোনো পরীক্ষার রুটিন প্রকাশিত হয়নি</p>
                        <p className="text-xs text-slate-400 font-medium font-noto mt-1">আপনার শ্রেণির জন্য পরীক্ষার রুটিন পাবলিশ করা হলে এখানে দেখতে পাবেন।</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {publishedClassRoutines.map((routine, rIdx) => (
                        <motion.div
                          key={routine.id || rIdx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: rIdx * 0.08 }}
                          className="bg-white border border-slate-100 rounded-[2.5rem] p-5 sm:p-7 shadow-premium relative overflow-hidden group hover:border-blue-200 transition-all duration-300"
                        >
                          {/* Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  {student?.classes?.class_name || 'নিজ শ্রেণি'}
                                </span>
                                {routine.createdAt && (
                                  <span className="text-[10px] text-slate-400 font-bold font-noto">
                                    প্রকাশ: {new Date(routine.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg sm:text-xl font-black text-slate-900 font-noto tracking-tight">
                                {routine.name}
                              </h3>
                            </div>
                            
                            {/* Shifts time */}
                            <div className="flex flex-wrap items-center gap-2">
                              {(routine.routineMorningTime || routine.routineMorningStart) && (
                                <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-100 px-3 py-1.5 rounded-xl text-blue-700">
                                  <Clock size={12} className="text-blue-500" />
                                  <span className="text-[10px] font-black font-noto">
                                    সকাল: {routine.routineMorningTime || `${routine.routineMorningStart} - ${routine.routineMorningEnd}`}
                                  </span>
                                </div>
                              )}
                              {routine.hasAfternoon && (routine.routineAfternoonTime || routine.routineAfternoonStart) && (
                                <div className="flex items-center gap-1.5 bg-purple-50/70 border border-purple-100 px-3 py-1.5 rounded-xl text-purple-700">
                                  <Clock size={12} className="text-purple-500" />
                                  <span className="text-[10px] font-black font-noto">
                                    বিকাল: {routine.routineAfternoonTime || `${routine.routineAfternoonStart} - ${routine.routineAfternoonEnd}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Routine Table */}
                          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse min-w-[480px]">
                                <thead>
                                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider font-noto">
                                    <th className="py-3 px-4 w-[160px]">তারিখ ও বার</th>
                                    <th className="py-3 px-4">সকালের পরীক্ষা</th>
                                    {routine.hasAfternoon && (
                                      <th className="py-3 px-4">বিকালের পরীক্ষা</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-noto">
                                  {routine.days.map((d: any, dIdx: number) => (
                                    <tr key={d.id || dIdx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3.5 px-4 align-top">
                                        <p className="text-xs font-black text-slate-800">{d.date}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{d.day}</p>
                                      </td>
                                      <td className="py-3.5 px-4 align-top">
                                        {d.morningSubject && d.morningSubject !== '—' ? (
                                          <div className="space-y-1">
                                            <span className="inline-block text-xs font-black text-blue-900 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100">
                                              {d.morningSubject}
                                            </span>
                                            {(d.morningTime || d.morningRoom) && (
                                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                {d.morningTime && <span>সময়: {d.morningTime}</span>}
                                                {d.morningRoom && <span>• কক্ষ: {d.morningRoom}</span>}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-300 font-bold">—</span>
                                        )}
                                      </td>
                                      {routine.hasAfternoon && (
                                        <td className="py-3.5 px-4 align-top">
                                          {d.afternoonSubject && d.afternoonSubject !== '—' ? (
                                            <div className="space-y-1">
                                              <span className="inline-block text-xs font-black text-purple-900 bg-purple-50/80 px-2.5 py-1 rounded-lg border border-purple-100">
                                                {d.afternoonSubject}
                                              </span>
                                              {(d.afternoonTime || d.afternoonRoom) && (
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                  {d.afternoonTime && <span>সময়: {d.afternoonTime}</span>}
                                                  {d.afternoonRoom && <span>• কক্ষ: {d.afternoonRoom}</span>}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-slate-300 font-bold">—</span>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Instructions */}
                          {routine.routineInstructions && routine.routineInstructions.length > 0 && (
                            <div className="mt-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-100/60 font-noto">
                              <div className="flex items-center gap-2 mb-2 text-amber-800 text-xs font-black">
                                <Info size={14} className="text-amber-600" />
                                <span>পরীক্ষার্থীদের জন্য বিশেষ নির্দেশনাবলী:</span>
                              </div>
                              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-900/80 font-bold">
                                {routine.routineInstructions.map((inst: string, iIdx: number) => (
                                  <li key={iIdx} className="flex items-start gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                    <span>{inst}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Principal info */}
                          {routine.routinePrincipalName && (
                            <div className="mt-4 flex justify-end">
                              <div className="text-right">
                                <p className="text-xs font-black text-slate-700 font-noto">{routine.routinePrincipalName}</p>
                                <p className="text-[10px] font-bold text-slate-400 font-noto">কর্তৃপক্ষ / প্রতিষ্ঠান প্রধান</p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (() => {
                const studentClassName = (student?.classes?.class_name || student?.class_name || student?.class || '').trim().toLowerCase();
                const studentClassId = String(student?.class_id || student?.classes?.id || '').trim().toLowerCase();

                const isClassMatch = (targetClass: string | null | undefined): boolean => {
                  if (!targetClass) return true;
                  const norm = targetClass.trim().toLowerCase();
                  if (
                    norm === 'all' || 
                    norm === 'all classes' || 
                    norm === 'all_classes' || 
                    norm === 'সকল' || 
                    norm === 'সকল শ্রেণী' || 
                    norm === 'সকল শ্রেণি' || 
                    norm === 'সকলের জন্য' || 
                    norm === 'সব' || 
                    norm === 'সব শ্রেণি' || 
                    norm === 'সব শ্রেণী' ||
                    norm === 'all parents' ||
                    norm === 'all students'
                  ) {
                    return true;
                  }

                  if (!studentClassName && !studentClassId) return false;
                  if (studentClassName && norm === studentClassName) return true;
                  if (studentClassId && norm === studentClassId) return true;

                  const cleanNorm = norm.replace(/[\s_-]+/g, '');
                  const cleanSName = studentClassName.replace(/[\s_-]+/g, '');
                  if (cleanNorm && cleanSName && cleanNorm === cleanSName) return true;

                  return false;
                };

                const filtered = notices.filter(n => {
                  let parsed: any = {};
                  try {
                    if (typeof n.message === 'string') {
                      parsed = JSON.parse(n.message);
                    } else {
                      parsed = n.message || {};
                    }
                  } catch (e) {
                    parsed = { desc: n.message };
                  }

                  if (parsed?.status === 'draft') return false;

                  const msgClass = (n.class_name || '').trim();
                  const lowerMsgClass = msgClass.toLowerCase();
                  const targetClassGroup = (parsed?.classGroup || parsed?.target_class || parsed?.class || '').trim();

                  if (activeNoticeTab === 'notice') {
                    // Regular notices, holidays, PTMs, events
                    const isNoticeType = 
                      lowerMsgClass === 'app_notice' || 
                      lowerMsgClass === 'app_holiday' || 
                      lowerMsgClass === 'app_ptm' || 
                      lowerMsgClass === 'app_event' ||
                      lowerMsgClass === 'all' || 
                      lowerMsgClass === 'সকলের জন্য' ||
                      (!lowerMsgClass.startsWith('app_') && !Array.isArray(parsed?.subjects));

                    if (!isNoticeType) return false;
                    
                    const target = targetClassGroup || (lowerMsgClass === 'all' || lowerMsgClass === 'সকলের জন্য' ? 'all' : (lowerMsgClass.startsWith('app_') ? 'all' : msgClass));
                    return isClassMatch(target);
                  }

                  if (activeNoticeTab === 'diary') {
                    // Diary entries
                    const isDiaryType = 
                      lowerMsgClass === 'app_diary' || 
                      (!lowerMsgClass.startsWith('app_') && (Array.isArray(parsed?.subjects) || parsed?.activities || parsed?.homework || parsed?.note));

                    if (!isDiaryType) return false;

                    const target = lowerMsgClass === 'app_diary' ? targetClassGroup : msgClass;
                    return isClassMatch(target);
                  }

                  
                  if (activeNoticeTab === 'suggestion') {
                    if (!lowerMsgClass.startsWith('app_suggestion_')) return false;
                    const target = msgClass.replace(/^APP_SUGGESTION_/i, '').trim();
                    return isClassMatch(target);
                  }

                  if (activeNoticeTab === 'syllabus') {
                    if (!lowerMsgClass.startsWith('app_syllabus_')) return false;
                    const target = msgClass.replace(/^APP_SYLLABUS_/i, '').trim();
                    return isClassMatch(target);
                  }

                  return false;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white/50 border border-dashed border-slate-200 p-12 rounded-[3rem] text-center space-y-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                        <Bell size={40} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400 font-noto">এই ক্যাটাগরিতে কোনো তথ্য পাওয়া যায়নি।</p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-5">
                    {filtered.map((notice, i) => (
                      <motion.div 
                        key={notice.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white border border-slate-100 p-5 md:p-8 rounded-[3rem] shadow-premium relative overflow-hidden group hover:border-blue-200 hover:shadow-bubble transition-all duration-500"
                      >
                        <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] -mr-20 -mt-20 opacity-10 transition-colors ${
                          notice.class_name === 'APP_HOLIDAY' ? 'bg-emerald-500' : 
                          notice.class_name === 'APP_PTM' ? 'bg-purple-500' : 
                          activeNoticeTab === 'diary' ? 'bg-blue-500' : activeNoticeTab === 'suggestion' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`} />
                        
                        <div className="flex flex-row items-center gap-3 md:gap-4 text-left relative z-10 w-full pb-3 border-b border-slate-50">
                          <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center border shadow-sm shrink-0 transition-transform group-hover:scale-105 ${
                            notice.class_name === 'APP_HOLIDAY' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 
                            notice.class_name === 'APP_PTM' ? 'bg-purple-50 border-purple-100 text-purple-500' : 
                            activeNoticeTab === 'suggestion' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                          }`}>
                            {notice.class_name === 'APP_HOLIDAY' ? <Calendar size={20} /> : 
                             notice.class_name === 'APP_PTM' ? <Users size={20} /> : 
                             activeNoticeTab === 'diary' ? <BookOpen size={20} /> : activeNoticeTab === 'suggestion' ? <BookOpen size={20} /> : <MessageSquare size={20} />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              {activeNoticeTab !== 'diary' ? (
                                <span className={`text-[7px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                  notice.class_name === 'APP_HOLIDAY' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                                  notice.class_name === 'APP_PTM' ? 'bg-purple-50 border-purple-100 text-purple-600' : 
                                  activeNoticeTab === 'suggestion' ? 'bg-emerald-100/50 border-emerald-200 text-emerald-700' : 'bg-blue-100/50 border-blue-200 text-blue-700'
                                }`}>
                                  {notice.class_name === 'APP_HOLIDAY' ? 'ছুটি' : 
                                   notice.class_name === 'APP_PTM' ? 'মিটিং' : 
                                   notice.class_name === 'all' ? 'সকলের জন্য' : 'সাধারণ'}
                                </span>
                              ) : (
                                <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap bg-blue-50 border-blue-100 text-blue-700">
                                  {notice.class_name?.startsWith('APP_') ? 'ডায়েরি' : notice.class_name}
                                </span>
                              )}
                              <h3 className="text-sm md:text-xl font-black text-slate-900 leading-tight font-noto tracking-tight flex-1 truncate">{notice.title}</h3>
                              <span className="text-[9px] font-bold text-slate-400 font-noto whitespace-nowrap ml-auto">
                                {new Date(notice.created_at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Message content */}
                        <div className="w-full pt-3">
                        {(() => {
                          try {
                            const parsed = typeof notice.message === 'string' ? JSON.parse(notice.message) : (notice.message || {});
                            return (
                              <div className="space-y-3">
                                {parsed.desc && <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-noto whitespace-pre-wrap">{parsed.desc}</p>}
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {parsed.activities && (
                                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 group-hover:bg-white transition-colors">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                          <BookOpen size={10} />
                                        </div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ক্লাসের কাজ</p>
                                      </div>
                                      <p className="text-[11px] md:text-xs text-slate-700 leading-snug whitespace-pre-wrap font-noto">{parsed.activities}</p>
                                    </div>
                                  )}
                                  {parsed.homework && (
                                    <div className="bg-blue-50/20 p-3 rounded-2xl border border-blue-100/20 group-hover:bg-white transition-colors">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                                          <Smartphone size={10} />
                                        </div>
                                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">বাড়ির কাজ</p>
                                      </div>
                                      <p className="text-[11px] md:text-xs text-blue-800/80 leading-snug whitespace-pre-wrap font-noto">{parsed.homework}</p>
                                    </div>
                                  )}
                                </div>

                                {parsed.note && (
                                  <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100 text-amber-900 text-xs leading-relaxed font-noto">
                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1 font-noto">বিশেষ দ্রষ্টব্য / নোট:</p>
                                    <p className="whitespace-pre-wrap">{parsed.note}</p>
                                  </div>
                                )}

                                {parsed.exam && (
                                  <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 mb-2 w-fit">
                                    <GraduationCap size={14} className="text-purple-600" />
                                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider font-noto">{parsed.exam}</span>
                                  </div>
                                )}
                                {parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length > 0 && (
                                  <SyllabusAccordion subjects={parsed.subjects} />
                                )}

                                {parsed.attachments && Array.isArray(parsed.attachments) && parsed.attachments.length > 0 && (
                                  <div className="space-y-2 pt-2.5 border-t border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                      <Paperclip size={12} className="text-blue-500" /> সংযুক্ত ফাইল / ছবি:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {parsed.attachments.map((att: any, attIdx: number) => (
                                        att.type === 'pdf' ? (
                                          <a
                                            key={attIdx}
                                            href={att.url}
                                            download={att.name}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 p-2.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-all text-xs font-bold text-red-700"
                                          >
                                            <FileText size={18} className="text-red-500 shrink-0" />
                                            <span className="truncate flex-1">{att.name}</span>
                                            <Download size={14} className="shrink-0 text-red-400" />
                                          </a>
                                        ) : (
                                          <div
                                            key={attIdx}
                                            onClick={() => setZoomedImage(att.url)}
                                            className="relative group rounded-xl overflow-hidden border border-slate-200 cursor-pointer aspect-video bg-slate-100"
                                          >
                                            <img src={att.url} alt={att.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">
                                              <Eye size={16} />
                                            </div>
                                          </div>
                                        )
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {activeNoticeTab === 'diary' && (
                                  <div className="pt-2.5 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReadDiaryIds(prev =>
                                          prev.includes(notice.id) ? prev.filter(id => id !== notice.id) : [...prev, notice.id]
                                        );
                                      }}
                                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        readDiaryIds.includes(notice.id)
                                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-xs'
                                          : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200/80'
                                      }`}
                                    >
                                      <CheckCircle2 size={15} className={readDiaryIds.includes(notice.id) ? 'text-emerald-600' : 'text-slate-400'} />
                                      <span>{readDiaryIds.includes(notice.id) ? 'দেখেছি (অভিভাবকের স্বাক্ষর)' : 'পড়া দেখেছি মার্ক করুন'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          } catch (e) {
                            return <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-noto">{notice.message}</p>;
                          }
                        })()}
                        </div>

                        {notice.sender_name && (
                          <div className="pt-3 flex items-center gap-2 mt-2">
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest font-noto">
                              প্রেরক: <span className="text-slate-400">{notice.sender_name}</span>
                            </span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}
          {isLiveChatEnabled && activeTab === 'chat' && (
            <div key="chat" className="h-full w-full flex flex-col overflow-hidden">
              <ChatApp
                institution={currentInstitution || madrasah}
                profile={{
                  id: student?.guardian_phone ? `parent-${student.guardian_phone}` : (student?.id ? `parent-${student.id}` : 'parent-user'),
                  institution_id: currentInstitution?.id || madrasah?.id || '',
                  full_name: `${student?.student_name ? student.student_name + ' (অভিভাবক)' : 'অভিভাবক'}`,
                  role: 'parent',
                  class_id: student?.class_id || student?.classes?.id,
                  is_active: true,
                  created_at: new Date().toISOString()
                }}
                classes={
                  student?.classes
                    ? [student.classes]
                    : (student?.class_id
                      ? [{ id: student.class_id, class_name: student.class_name || 'আমার ক্লাস' }]
                      : [])
                }
                lang={lang}
                isDark={madrasah?.theme === 'dark'}
                onMobileChatStateChange={setIsMobileChatActive}
                onStartVoiceCall={(targetName) => {
                  const activeInstId = currentInstitution?.id || madrasah?.id || student?.institution_id || '';
                  startCall(
                    {
                      id: student?.id || studentId || 'student',
                      name: student?.student_name || 'শিক্ষার্থী',
                      roll: student?.roll_no || student?.roll,
                      class_name: student?.class_name,
                      guardian_name: student?.guardian_name,
                      guardian_phone: student?.guardian_phone,
                    },
                    {
                      id: student?.guardian_phone ? `parent-${student.guardian_phone}` : (student?.id ? `parent-${student.id}` : 'parent-user'),
                      name: student?.student_name ? `${student.student_name} (অভিভাবক)` : 'অভিভাবক',
                      role: 'parent',
                      phone: student?.guardian_phone || '',
                    },
                    activeInstId
                  );
                }}
              />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Bottom Navigation */}
      {!(activeTab === 'chat' && isMobileChatActive) && (
        <div 
          className="fixed md:hidden bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 w-[98%] sm:w-[92%] max-w-md z-[200]"
          style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
        <nav className={`backdrop-blur-[25px] border py-2 sm:py-2.5 rounded-[2.5rem] shadow-2xl flex justify-between items-end px-1 sm:px-2 overflow-visible relative gap-0.5 sm:gap-1 ${madrasah?.theme === 'dark' ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
          {[
            { id: 'home', icon: LayoutDashboard, label: 'ড্যাশবোর্ড', visible: true },
            { id: 'chat', icon: MessageSquareText, label: 'চ্যাট', visible: isLiveChatEnabled },
            { id: 'attendance', icon: Calendar, label: 'হাজিরা', visible: modules.attendance !== false },
            { id: 'results', icon: GraduationCap, label: 'পরীক্ষা', visible: (modules.results !== false || modules.exam !== false) },
            { id: 'fees', icon: CreditCard, label: 'ফি', visible: modules.accounting !== false },
            { id: 'notices', icon: Bell, label: 'নোটিশ', visible: true },
            { id: 'profile', icon: User, label: 'প্রোফাইল', visible: true }
          ].filter(t => t.visible).map((item) => {
            const active = isTabActive(item.id);
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className="relative flex flex-col items-center justify-end flex-1 min-w-0 cursor-pointer group py-0.5 px-0.5"
              >
                {active ? (
                  <div className="flex flex-col items-center max-w-full">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center -mt-5 sm:-mt-6 mb-0.5 transition-all duration-300 shadow-lg border relative z-10 ${
                      madrasah?.theme === 'dark' ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-black/60 ring-2 sm:ring-4 ring-slate-900' : 'bg-white text-[#2563EB] border-blue-100 shadow-blue-600/20 ring-2 sm:ring-4 ring-white'
                    }`}>
                      <IconComponent size={19} strokeWidth={2.5} className="sm:w-[21px] sm:h-[21px] animate-in zoom-in-75 duration-200" />
                    </div>
                    <span className={`text-[8.5px] xs:text-[9px] sm:text-[9.5px] font-black font-noto tracking-tighter sm:tracking-tight whitespace-nowrap truncate max-w-full ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 max-w-full">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center">
                      <IconComponent size={18} strokeWidth={1.8} className={`sm:w-[20px] sm:h-[20px] ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    </div>
                    <span className={`text-[8.5px] xs:text-[9px] sm:text-[9.5px] font-bold font-noto tracking-tighter sm:tracking-tight whitespace-nowrap opacity-80 truncate max-w-full ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      )}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
          <img src={zoomedImage} alt="Attachment" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}
      </div>
      </div>
    </motion.div>
    )}
  </AnimatePresence>
  );
};

export default ParentPortal;
