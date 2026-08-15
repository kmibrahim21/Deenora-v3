
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, smsApi } from 'supabase';
import { Institution, Class, Student, Language, Attendance as AttendanceType, Profile } from 'types';
import { ClipboardList, Users, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, ChevronDown, Save, Calendar, BarChart3, Send, AlertTriangle, FileText, CheckCircle2, AlertCircle, RefreshCw, Settings, TrendingDown, Info, Plus, Trash2, MessageSquare, Download, Phone, CalendarOff, Search, LayoutGrid, ListFilter, Trophy } from 'lucide-react';
import { getBengaliDate, getHijriDate, getEventsForDate, getTodayDateString, getTodayMonthString } from '../utils/calendarUtils';
import { sortMadrasahClasses } from 'pages/Classes';
import { t } from 'translations';
import { useOfflineStatus } from 'hooks/useOffline';
import { CacheService } from 'services/cacheService';
import { requestManager, CACHE_TTLS } from 'services/RequestManager';
import { SupabaseWrapper } from 'services/supabaseWrapper';
import { SyncEngine } from 'services/syncEngine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { generateAttendanceReportPDF } from '../utils/pdfGenerator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  userId: string;
  profile?: Profile | null;
  activeYear?: any;
  triggerRefresh?: () => void;
}

const Attendance: React.FC<AttendanceProps> = ({ lang, madrasah, onBack, userId, profile, activeYear, triggerRefresh }) => {
  const isTeacher = profile?.role === 'teacher';
  const canManageAttendance = !isTeacher || profile?.permissions?.can_manage_attendance;
  const isDark = madrasah?.theme === 'dark';

  if (!canManageAttendance) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const isOnline = useOfflineStatus();
  const [activeTab, setActiveTab] = useState<'daily' | 'report'>('daily');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'half_day' | 'leave'>>({});
  const [arrivalTime, setArrivalTime] = useState<Record<string, string>>({});
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [reportView, setReportView] = useState<'list' | 'analytics'>('list');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportDisplayMode, setReportDisplayMode] = useState<'table' | 'cards'>('table');

  const getRankBadgeLabel = (rank: number, l: Language) => {
    if (l !== 'bn') return `#${rank}`;
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBn = (n: number) => String(n).replace(/[0-9]/g, d => bnDigits[parseInt(d)]);
    if (rank === 1) return '১ম';
    if (rank === 2) return '২য়';
    if (rank === 3) return '৩য়';
    if (rank === 4) return '৪র্থ';
    if (rank === 5) return '৫ম';
    if (rank === 6) return '৬ষ্ঠ';
    if (rank === 7) return '৭ম';
    if (rank === 8) return '৮ম';
    if (rank === 9) return '৯ম';
    if (rank === 10) return '১০ম';
    return `${toBn(rank)}তম`;
  };

  const processedReportData = useMemo(() => {
    if (!reportData || reportData.length === 0) return [];

    const withPct = reportData.map(item => {
      const late = Number(item.late_days || item.late || 0);
      const present = Number(item.present_days || item.present || 0);
      const half = Number(item.half_days || item.half || 0);
      const leave = Number(item.leave_days || item.leave || 0);
      const absent = Number(item.absent_days || item.absent || 0);
      const total = Number(item.total_days || item.total || 0);

      const attended = present + late + (half * 0.5);
      const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((attended / total) * 100))) : 0;
      
      const cls = classes.find(c => c.id === item.class_id);
      return {
        ...item,
        late_days: late,
        present_days: present,
        half_days: half,
        leave_days: leave,
        absent_days: absent,
        total_days: total,
        pct,
        class_name: cls?.class_name || item.class_name || ''
      };
    });

    // Dense Ranking (1, 2, 2, 3) based on percentage descending
    const sortedByPct = [...withPct].sort((a, b) => b.pct - a.pct);
    let currentRank = 1;
    sortedByPct.forEach((item, index) => {
      if (index > 0) {
        if (item.pct !== sortedByPct[index - 1].pct) {
          currentRank++;
        }
      }
      item.rank = currentRank;
    });

    const rankMap = new Map<string, number>();
    sortedByPct.forEach(item => rankMap.set(item.student_id, item.rank));

    return withPct.map(item => ({
      ...item,
      rank: rankMap.get(item.student_id) || 1
    }));
  }, [reportData, classes]);

  const filteredReportData = useMemo(() => {
    if (!reportSearchQuery.trim()) return processedReportData;
    const q = reportSearchQuery.toLowerCase().trim();
    return processedReportData.filter(item => 
      item.student_name?.toLowerCase().includes(q) || 
      String(item.roll || '').includes(q) ||
      item.class_name?.toLowerCase().includes(q)
    );
  }, [processedReportData, reportSearchQuery]);
  const [selectedYear, setSelectedYear] = useState(activeYear?.start_date ? activeYear.start_date.slice(0, 4) : new Date().getFullYear().toString());
  const [reportDate, setReportDate] = useState(getTodayDateString());
  const [dailyAbsentees, setDailyAbsentees] = useState<any[]>([]);
  const [attendanceNotTaken, setAttendanceNotTaken] = useState(false);

  const onlyAbsents = dailyAbsentees.filter(a => a.final_status === 'absent');
  const lateCount = dailyAbsentees.filter(a => a.final_status === 'late').length;
  const leaveCount = dailyAbsentees.filter(a => a.final_status === 'leave').length;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const isSendingAlertsRef = useRef(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [settingsClassId, setSettingsClassId] = useState<string>('global');
  const [settingsSessions, setSettingsSessions] = useState<{ id: string; name: string }[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [startTime, setStartTime] = useState(madrasah?.config_json?.attendance_settings?.start_time || '08:00');
  const [endTime, setEndTime] = useState(madrasah?.config_json?.attendance_settings?.end_time || '14:00');
  const [halfDayTime, setHalfDayTime] = useState(madrasah?.config_json?.attendance_settings?.half_day_time || '12:00');
  const [fullDayTime, setFullDayTime] = useState(madrasah?.config_json?.attendance_settings?.full_day_time || '14:00');
  const [savingSettings, setSavingSettings] = useState(false);
  const [date, setDate] = useState(getTodayDateString());
  const [selectedSession, setSelectedSession] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(getTodayMonthString()); 
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<any[]>([]);
  const [existingAttRecords, setExistingAttRecords] = useState<any[]>([]);
  const [isHoliday, setIsHoliday] = useState(false);
  const [showShortcodes, setShowShortcodes] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Enhanced Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    icon: 'sms' | 'voice' | 'alert';
    action: () => void;
    color: string;
  } | null>(null);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  // New states for SMS and Voice Templates
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = useState<string>('');
  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);
  const [selectedVoiceTemplateId, setSelectedVoiceTemplateId] = useState<string>('');
  const [showSmsTemplateDropdown, setShowSmsTemplateDropdown] = useState(false);
  const [showVoiceTemplateDropdown, setShowVoiceTemplateDropdown] = useState(false);
  const [sendingVoiceAlerts, setSendingVoiceAlerts] = useState(false);
  const [walletBalance, setWalletBalance] = useState(madrasah?.balance || 0);
  const [voiceRate, setVoiceRate] = useState(madrasah?.voice_rate || 0.50);

  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{teacher_name}', label: lang === 'bn' ? 'শিক্ষকের নাম' : 'Teacher Name' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },
  ];

  useEffect(() => {
    const initVoiceRate = async () => {
      let r = madrasah?.voice_rate;
      if (!r) {
        try {
          const { data } = await supabase.from('system_settings').select('voice_rate').eq('id', '00000000-0000-0000-0000-000000000001').single();
          r = data?.voice_rate || 0.50;
        } catch(e) {
          r = 0.50;
        }
      }
      setVoiceRate(r);
    };

    if (madrasah) {
      fetchClasses();
      fetchSmsTemplates();
      fetchVoiceTemplates();
      setWalletBalance(madrasah.balance || 0);
      initVoiceRate();
    }
  }, [madrasah?.id, madrasah?.voice_rate, madrasah?.balance]);

  const fetchSmsTemplates = async () => {
    if (!madrasah) return;
    const { data } = await requestManager.cachedFetch(
      'sms_templates',
      (q: any) => q.select('*').eq('institution_id', madrasah.id).order('created_at', { ascending: false }),
      `sms_templates:${madrasah.id}`
    );
    if (data) setSmsTemplates(data);
  };

  const fetchVoiceTemplates = async () => {
    if (!madrasah) return;
    const { data } = await requestManager.cachedFetch(
      'voice_templates',
      (q: any) => q.select('*').eq('institution_id', madrasah.id).eq('provider_status', 'approved').order('created_at', { ascending: false }),
      `voice_templates:${madrasah.id}:approved`
    );
    if (data) setVoiceTemplates(data);
  };

  useEffect(() => {
    if (selectedClass && madrasah) {
      if (activeTab === 'daily') {
        if (selectedClass.id !== 'all') {
          fetchStudents(selectedClass.id);
          fetchDayEvents();
        } else {
          setStudents([]);
        }
      }
      else fetchReport(selectedClass.id);
    }
  }, [selectedClass?.id, activeTab, date, selectedSession, selectedMonth, reportType, selectedYear, reportDate, madrasah?.id]);

  useEffect(() => {
    if (madrasah) {
      const settings = madrasah.config_json?.attendance_settings || {};
      if (selectedClass) {
        const classSessions = settings.class_sessions?.[selectedClass.id];
        if (classSessions && classSessions.length > 0) {
          setSessions(classSessions);
        } else if (settings.sessions) {
          setSessions(settings.sessions);
        } else {
          setSessions([]);
        }
      } else if (settings.sessions) {
        setSessions(settings.sessions);
      } else {
        setSessions([]);
      }
    }
  }, [madrasah?.id, selectedClass?.id, madrasah?.config_json]);

  useEffect(() => {
    if (madrasah) {
      const settings = madrasah.config_json?.attendance_settings || {};
      if (settingsClassId === 'global') {
        setSettingsSessions(settings.sessions || []);
        setStartTime(settings.start_time || '08:00');
        setEndTime(settings.end_time || '14:00');
        setHalfDayTime(settings.half_day_time || '12:00');
        setFullDayTime(settings.full_day_time || '14:00');
      } else {
        const classSessions = settings.class_sessions?.[settingsClassId];
        setSettingsSessions(classSessions || []);

        // Load class specific times if available
        const classTimes = settings.class_times?.[settingsClassId];
        setStartTime(classTimes?.start_time || settings.start_time || '08:00');
        setEndTime(classTimes?.end_time || settings.end_time || '14:00');
        setHalfDayTime(classTimes?.half_day_time || settings.half_day_time || '12:00');
        setFullDayTime(classTimes?.full_day_time || settings.full_day_time || '14:00');
      }
    }
  }, [settingsClassId, madrasah?.config_json]);

  const fetchDayEvents = async () => {
    if (!madrasah) return;
    try {
      // Invalidate the cache right before fetching to ensure we get the latest events for attendance
      await requestManager.invalidatePattern(`calendar_events:${madrasah.id}:${date}`);
      
      const { data: customEvents } = await requestManager.cachedFetch(
        'calendar_events',
        (q: any) => q.select('*').eq('institution_id', madrasah.id).or(`event_date.eq.${date},and(event_date.lte.${date},end_date.gte.${date})`),
        `calendar_events:${madrasah.id}:${date}`
      );
      
      let events = getEventsForDate(new Date(date), customEvents || []);
      
      // Filter events by selected class
      if (selectedClass && selectedClass.id !== 'all') {
          events = events.filter(e => {
              // Islamic holidays and weekly holidays are global
              if (e.id === 'weekly-holiday' || e.type === 'islamic' || e.event_type === 'islamic') return true;
              
              // If it's a custom event, check class restrictions
              const classId = e.class_id;
              const classIds = e.class_ids;
              
              // Global events (no class restriction)
              if (!classId && (!classIds || classIds.length === 0)) return true;
              
              // Class specific events
              if (classId === selectedClass.id) return true;
              if (classIds && classIds.includes(selectedClass.id)) return true;
              
              return false;
          });
      }
      
      // Check for weekly holiday
      const weeklyHolidays = madrasah.config_json?.weekly_holidays || [5]; // Default Friday
      const dayIndex = new Date(date).getDay();
      const isWeeklyHoliday = weeklyHolidays.includes(dayIndex);
      
      if (isWeeklyHoliday) {
        const dayNamesBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
        const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        events.push({
          title: lang === 'bn' ? `সাপ্তাহিক ছুটি (${dayNamesBn[dayIndex]})` : `Weekly Holiday (${dayNamesEn[dayIndex]})`,
          type: 'holiday',
          id: 'weekly-holiday',
        });
      }
      
      setDayEvents(events);
      
      const holiday = events.some(e => {
        const type = e.event_type || e.type;
        return ['holiday', 'closed', 'islamic'].includes(type);
      });
      setIsHoliday(holiday);
    } catch (e) {
      console.error('Error fetching day events:', e);
    }
  };

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    const { data } = await requestManager.cachedFetch(
      'classes',
      (q) => q.select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
      `classes:${madrasah.id}`,
      CACHE_TTLS.LONG
    );
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter((cls: any) => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses as Class[]));
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      if (sessions.length > 0) {
        // If current selectedSession is not in the new sessions list, reset it
        const isValid = sessions.some(s => s.id === selectedSession);
        if (!isValid || selectedSession === 'all' || selectedSession === 'daily') {
          setSelectedSession(sessions[0].id);
        }
      } else {
        if (selectedSession !== 'daily') {
          setSelectedSession('daily');
        }
      }
    }
  }, [sessions, activeTab]);

  const fetchStudents = async (cid: string) => {
    if (!madrasah) return;
    setLoading(true);
    setFetchError(null);
    try {
      const activeYearId = madrasah.config_json?.active_academic_year_id;
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      
      // Use cachedFetch for offline support
      const { data: stdData, error: stdError } = await requestManager.cachedFetch(
        'students',
        (q) => {
          let query = q.select('*').eq('institution_id', madrasah.id).eq('class_id', cid).order('roll', { ascending: true });
          if (activeYearId && isUuid(activeYearId)) {
            query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
          }
          if ((window as any)._hasIsActive !== false) {
            query = query.eq('is_active', true);
          }
          return query;
        },
        `students:${madrasah.id}:${cid}:${(activeYearId && isUuid(activeYearId)) ? activeYearId : 'all'}`,
        CACHE_TTLS.LONG
      );
      
      if (stdError && isOnline) {
        if ((window as any)._hasIsActive === undefined && (stdError.code === 'PGRST204' || stdError.message?.includes('is_active'))) {
          (window as any)._hasIsActive = false;
          return fetchStudents(cid);
        }
        throw stdError;
      }
      
      if ((window as any)._hasIsActive === undefined) {
        (window as any)._hasIsActive = true;
      }
      
      let finalStdData = stdData || [];
      
      // Fallback: if no students found with activeYearId, try fetching without it (caching the fallback too)
      if (finalStdData.length === 0 && activeYearId) {
        const { data: fallbackData, error: fallbackError } = await requestManager.cachedFetch(
          'students',
          (q) => {
            let query = q.select('*').eq('institution_id', madrasah.id).eq('class_id', cid).order('roll', { ascending: true });
            if ((window as any)._hasIsActive !== false) {
              query = query.eq('is_active', true);
            }
            return query;
          },
          `students:${madrasah.id}:${cid}:all`,
          CACHE_TTLS.LONG
        );
        if (fallbackData && fallbackData.length > 0) {
          finalStdData = fallbackData;
        }
      }
      
      // Ensure robust numeric sorting in case database sorting is lexicographical
      finalStdData = [...finalStdData].sort((a: any, b: any) => {
        const rollA = a.roll != null ? Number(a.roll) : 999999;
        const rollB = b.roll != null ? Number(b.roll) : 999999;
        return rollA - rollB;
      });

      // Also fetch attendance with institution_id and session
      const { data: attData, error: attError } = await requestManager.cachedFetch(
        'attendance',
        (q) => {
          let query = q.select('*').eq('institution_id', madrasah.id).eq('class_id', cid).eq('date', date);
          // We fetch all records for the date to avoid duplicate key issues on INSERT
          // because a student might have a record in a different session
          return query.order('created_at', { ascending: false });
        },
        `attendance:${madrasah.id}:${cid}:${date}:${selectedSession}`,
        CACHE_TTLS.SHORT
      );
        
      if (attError) {
        console.error('Attendance fetch error (skipping academic_year_id):', attError);
        // If it's a column missing error, we still want to proceed with empty attendance
      }

      setExistingAttRecords(attData || []);

      if (finalStdData) {
        setStudents(finalStdData);
        const initial: Record<string, 'present' | 'absent' | 'late' | 'half_day' | 'leave'> = {};
        const initialArrival: Record<string, string> = {};
        
        finalStdData.forEach(s => {
          const existing = attData?.find(a => a.student_id === s.id && (a.session === selectedSession || (!a.session && selectedSession === 'daily')));
          initial[s.id] = existing ? (existing.status as any) : 'present';
          if (existing?.arrival_time) initialArrival[s.id] = existing.arrival_time;
        });
        setAttendance(initial);
        setArrivalTime(initialArrival);
      }
    } catch (e: any) { 
      console.error('Attendance fetch error:', e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const fetchReport = async (cid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      if (!isOnline) {
        if (reportType === 'daily') {
           const cachedDaily = await CacheService.getCachedData('attendance_daily', madrasah?.id || '');
           setDailyAbsentees(cachedDaily || []);
        } else {
           const cachedReport = await CacheService.getCachedData('attendance', madrasah?.id || '');
           const filtered = (cid && cid !== 'all') ? (cachedReport || []).filter((r: any) => r.class_id === cid) : (cachedReport || []);
           setReportData(filtered);
        }
        setLoading(false);
        return;
      }

      if (reportType === 'daily') {
        const { data: checkData, error: checkError } = await requestManager.cachedFetch(
          'attendance',
          (q: any) => {
            let query = q.select('id')
               .eq('institution_id', madrasah?.id)
               .eq('date', reportDate)
               .limit(1);

            if (cid && cid !== 'all') {
               query = query.eq('class_id', cid);
            }
            
            // Safety check for session UUID
            const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
            
            if (selectedSession && selectedSession !== 'all' && selectedSession !== 'daily' && isUuid(selectedSession)) {
               query = query.eq('session', selectedSession);
            }
            return query;
          },
          `attendance_check:${madrasah?.id}:${reportDate}:${cid || 'all'}:${selectedSession || 'daily'}`,
          CACHE_TTLS.SHORT
        );
        
        if (checkError) throw checkError;

        if (!checkData || checkData.length === 0) {
           setDailyAbsentees([]);
           setAttendanceNotTaken(true);
        } else {
           setAttendanceNotTaken(false);
           
           // Client-side mapping of daily attendance to ensure support for 'leave' and 'late' statuses
           let stdQuery = supabase
             .from('students')
             .select('id, student_name, roll, guardian_phone, class_id')
             .eq('institution_id', madrasah?.id);
           if (cid && cid !== 'all') {
             stdQuery = stdQuery.eq('class_id', cid);
           }
           const { data: stdData, error: stdError } = await stdQuery;
           if (stdError) throw stdError;

           let attQuery = supabase
             .from('attendance')
             .select('student_id, status, arrival_time, class_id, session')
             .eq('institution_id', madrasah?.id)
             .eq('date', reportDate);
           if (cid && cid !== 'all') {
             attQuery = attQuery.eq('class_id', cid);
           }
           
           const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
           if (selectedSession && selectedSession !== 'all' && selectedSession !== 'daily' && isUuid(selectedSession)) {
             attQuery = attQuery.eq('session', selectedSession);
           }
           const { data: attData, error: attError } = await attQuery;
           if (attError) throw attError;

           const studentDailyAtt: Record<string, { statuses: string[]; max_arrival: string | null }> = {};
           attData?.forEach((r: any) => {
             if (!studentDailyAtt[r.student_id]) {
               studentDailyAtt[r.student_id] = { statuses: [], max_arrival: null };
             }
             studentDailyAtt[r.student_id].statuses.push(r.status);
             if (r.arrival_time && (!studentDailyAtt[r.student_id].max_arrival || r.arrival_time > studentDailyAtt[r.student_id].max_arrival)) {
               studentDailyAtt[r.student_id].max_arrival = r.arrival_time;
             }
           });

           const mappedDailyDetails = stdData?.map((s: any) => {
             const att = studentDailyAtt[s.id];
             const statuses = att?.statuses || [];
             
             let finalStatus = 'absent';
             if (statuses.length === 0) {
               return null;
             }
             
             if (statuses.includes('present')) {
               finalStatus = 'present';
             } else if (statuses.includes('late')) {
               finalStatus = 'late';
             } else if (statuses.includes('half_day')) {
               finalStatus = 'half_day';
             } else if (statuses.includes('leave')) {
               finalStatus = 'leave';
             } else if (statuses.includes('absent')) {
               finalStatus = 'absent';
             }

             const cls = classes.find(c => c.id === s.class_id);

             return {
               id: s.id,
               student_id: s.id,
               student_name: s.student_name,
               roll: s.roll,
               class_name: cls?.class_name || '',
               class_id: s.class_id,
               guardian_phone: s.guardian_phone,
               final_status: finalStatus,
               arrival_time: att?.max_arrival || null,
               session: selectedSession === 'all' || selectedSession === 'daily' ? 'daily' : selectedSession
             };
           }).filter(Boolean) || [];

           // Filter for absents, lates, and leaves for the list
           const absents = (mappedDailyDetails as any[]).filter((r: any) => r.final_status === 'absent' || r.final_status === 'late' || r.final_status === 'leave').map((r: any) => ({
             ...r,
             students: { student_name: r.student_name, roll: r.roll, guardian_phone: r.guardian_phone },
             classes: { class_name: r.class_name }
           }));
           
           // Sort absents by class sort_order
           const sortedAbsents = [...absents].sort((a, b) => {
             const clsA = classes.find(c => c.id === a.class_id || c.class_name === a.class_name);
             const clsB = classes.find(c => c.id === b.class_id || c.class_name === b.class_name);
             
             const orderA = clsA?.sort_order ?? 999999;
             const orderB = clsB?.sort_order ?? 999999;
             
             if (orderA !== orderB) return orderA - orderB;
             
             // Secondary sort by roll
             const parseRoll = (r: any) => {
               if (typeof r === 'string') return parseInt(r) || parseInt(r.replace(/\D/g, '')) || 999999;
               return Number(r) || 999999;
             };
             
             const rollA = parseRoll(a.roll);
             const rollB = parseRoll(b.roll);
             return rollA - rollB;
           });
           
           setDailyAbsentees(sortedAbsents);
           await CacheService.cacheData('attendance_daily', madrasah?.id || '', sortedAbsents);
        }
      } else {
        let startDate, endDate;

        if (reportType === 'monthly') {
            startDate = `${selectedMonth}-01`;
            const [yearStr, monthStr] = selectedMonth.split('-');
            const y = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10);
            const lastDay = new Date(y, m, 0).getDate();
            endDate = `${yearStr}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else {
            startDate = `${selectedYear}-01-01`;
            endDate = `${selectedYear}-12-31`;
        }

        // Fetch students to map over
        let stdQuery = supabase
          .from('students')
          .select('id, student_name, roll, class_id')
          .eq('institution_id', madrasah?.id);
        if (cid && cid !== 'all') {
          stdQuery = stdQuery.eq('class_id', cid);
        }
        const { data: activeStudents, error: stdError } = await stdQuery;
        if (stdError) throw stdError;

        const activeStudentIds = activeStudents?.map((s: any) => s.id) || [];
        if (activeStudentIds.length === 0) {
          setReportData([]);
          setLoading(false);
          return;
        }

        // Fetch attendance records in paginated batches of 1000 to prevent PostgREST row truncation
        let allAttRecords: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          let attQuery = supabase
            .from('attendance')
            .select('student_id, status, date, session, class_id')
            .eq('institution_id', madrasah?.id)
            .gte('date', startDate)
            .lte('date', endDate)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (cid && cid !== 'all') {
            attQuery = attQuery.in('student_id', activeStudentIds);
          }
          if (selectedSession && selectedSession !== 'all' && selectedSession !== 'daily') {
            attQuery = attQuery.eq('session', selectedSession);
          }

          const { data: pageData, error: attError } = await attQuery;
          if (attError) throw attError;

          if (pageData && pageData.length > 0) {
            allAttRecords = allAttRecords.concat(pageData);
            if (pageData.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }

        // Perform aggregation client-side so 'leave_days' and 'late_days' are 100% supported
        const attendanceMap: Record<string, { present: number; absent: number; late: number; leave: number; half_day: number; total: number }> = {};
        const studentClassMap: Record<string, string> = {};

        activeStudents?.forEach((s: any) => {
          attendanceMap[s.id] = { present: 0, absent: 0, late: 0, leave: 0, half_day: 0, total: 0 };
          if (s.id && s.class_id) {
            studentClassMap[s.id] = s.class_id;
          }
        });

        const studentDailyStatus: Record<string, Record<string, string[]>> = {};
        const classUniqueDates: Record<string, Set<string>> = {};
        const allUniqueDates = new Set<string>();

        allAttRecords.forEach((r: any) => {
          if (r.date) {
            allUniqueDates.add(r.date);
            const cId = r.class_id || studentClassMap[r.student_id] || 'default';
            if (!classUniqueDates[cId]) {
              classUniqueDates[cId] = new Set<string>();
            }
            classUniqueDates[cId].add(r.date);
          }

          if (!studentDailyStatus[r.student_id]) {
            studentDailyStatus[r.student_id] = {};
          }
          if (!studentDailyStatus[r.student_id][r.date]) {
            studentDailyStatus[r.student_id][r.date] = [];
          }
          studentDailyStatus[r.student_id][r.date].push(r.status);
        });

        activeStudents?.forEach((s: any) => {
          const studentDates = studentDailyStatus[s.id] || {};
          const counts = attendanceMap[s.id];
          if (!counts) return;

          // Find relevant dates for student's class + any dates where this student has records
          const baseClassDates = (s.class_id && classUniqueDates[s.class_id] && classUniqueDates[s.class_id].size > 0)
            ? classUniqueDates[s.class_id]
            : allUniqueDates;

          const sClassDates = new Set<string>([
            ...Array.from(baseClassDates),
            ...Object.keys(studentDates)
          ]);
          const totalWorkingDays = sClassDates.size;

          if (totalWorkingDays > 0) {
            counts.total = totalWorkingDays;
            sClassDates.forEach((date) => {
              const statuses = studentDates[date];
              if (!statuses || statuses.length === 0) {
                counts.absent++;
              } else {
                let finalStatus = 'absent';
                if (statuses.includes('present')) {
                  finalStatus = 'present';
                } else if (statuses.includes('late')) {
                  finalStatus = 'late';
                } else if (statuses.includes('half_day')) {
                  finalStatus = 'half_day';
                } else if (statuses.includes('leave')) {
                  finalStatus = 'leave';
                } else if (statuses.includes('absent')) {
                  finalStatus = 'absent';
                }

                if (finalStatus === 'present') counts.present++;
                else if (finalStatus === 'late') counts.late++;
                else if (finalStatus === 'half_day') counts.half_day++;
                else if (finalStatus === 'leave') counts.leave++;
                else counts.absent++;
              }
            });
          } else {
            counts.total = 0;
          }
        });

        const finalData = activeStudents?.map((s: any) => {
          const counts = attendanceMap[s.id] || { present: 0, absent: 0, late: 0, leave: 0, half_day: 0, total: 0 };
          const cls = classes.find(c => c.id === s.class_id);
          
          return {
            student_id: s.id,
            student_name: s.student_name,
            roll: s.roll,
            present_days: counts.present,
            absent_days: counts.absent,
            late_days: counts.late,
            half_days: counts.half_day,
            leave_days: counts.leave,
            total_days: counts.total,
            class_id: s.class_id,
            class_sort_order: cls?.sort_order ?? 999999
          };
        }) || [];

        // Sort finalData by class serial and then by roll
        const sortedFinalData = [...finalData].sort((a, b) => {
          const orderA = a.class_sort_order ?? 999999;
          const orderB = b.class_sort_order ?? 999999;
          
          if (orderA !== orderB) return orderA - orderB;
          
          const parseRoll = (r: any) => {
            if (typeof r === 'string') return parseInt(r) || parseInt(r.replace(/\D/g, '')) || 999999;
            return Number(r) || 999999;
          };
          
          const rollA = parseRoll(a.roll);
          const rollB = parseRoll(b.roll);
          return rollA - rollB;
        });

        setReportData(sortedFinalData);
        await CacheService.cacheData('attendance', madrasah?.id || '', sortedFinalData);
      }
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const computeLateMins = (arrTime: string | null | undefined) => {
    const classTimes = selectedClass && selectedClass.id !== 'all' 
                        ? madrasah?.config_json?.attendance_settings?.class_times?.[selectedClass.id] 
                        : null;
    const sTime = classTimes?.start_time || madrasah?.config_json?.attendance_settings?.start_time || '08:00';
    if (!arrTime || !sTime) return 0;
    const [sh, sm] = sTime.split(':').map(Number);
    const [lh, lm] = arrTime.split(':').map(Number);
    const mins = (lh * 60 + lm) - (sh * 60 + sm);
    return mins > 0 ? mins : 0;
  };

  const setStatus = (sid: string, status: 'present' | 'absent' | 'late' | 'half_day' | 'leave') => {
    setAttendance(prev => ({ ...prev, [sid]: status }));
    if (status === 'late' && !arrivalTime[sid]) {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setArrivalTime(prev => ({...prev, [sid]: `${h}:${m}`}));
    } else if (status !== 'late') {
      const newArrival = { ...arrivalTime };
      delete newArrival[sid];
      setArrivalTime(newArrival);
    }
  };

  const handleSave = async () => {
    if (!madrasah || !selectedClass || selectedClass.id === 'all') {
      if (selectedClass?.id === 'all') {
        setErrorTitle(lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class');
        setErrorDetails(lang === 'bn' ? 'সব ক্লাসের হাজিরা একসাথে সেভ করা সম্ভব নয়। অনুগ্রহ করে একটি নির্দিষ্ট ক্লাস নির্বাচন করুন।' : 'Saving attendance for all classes at once is not supported. Please select a specific class.');
        setShowErrorModal(true);
      }
      return;
    }
    setSaving(true);
    
    // Invalidate RequestManager pattern-based caches
    await requestManager.invalidatePattern(`attendance:`);
    await requestManager.invalidatePattern(`stats:${madrasah.id}`);
    await requestManager.invalidatePattern(`dashboard_`);
    await requestManager.invalidatePattern('get_today_attendance_count');
    await requestManager.invalidatePattern('get_daily_attendance_details');
    await requestManager.invalidatePattern('get_attendance_report');
    await requestManager.invalidatePattern('attendance_check:');
    await CacheService.clearCache('stats', madrasah.id);

    try {
      const activeYearId = madrasah.config_json?.active_academic_year_id;
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const validatedYearId = (activeYearId && isUuid(activeYearId)) ? activeYearId : null;
      
      const inserts = [];
      const updates = [];
      const payload: any[] = [];
      const smsEligibleStudentIds = new Set<string>();
      
      const existingMap = new Map();
      // process backwards so the first element (latest via created_at desc) overwrites any older duplicates
      // match by student_id AND session to prevent overwriting different sessions
      [...existingAttRecords].reverse().forEach(r => existingMap.set(`${r.student_id}_${r.session || 'daily'}`, r));

      for (const [sid, status] of Object.entries(attendance)) {
        const arrTime = status === 'late' ? arrivalTime[sid] : null;
        const mins = status === 'late' ? computeLateMins(arrivalTime[sid]) : null;
        
        const record = {
          institution_id: madrasah.id,
          class_id: selectedClass.id,
          student_id: sid,
          status: status,
          date: date,
          session: (selectedSession === 'all' || selectedSession === 'daily') ? null : selectedSession,
          arrival_time: arrTime,
          late_minutes: mins,
          recorded_by: userId,
          academic_year_id: validatedYearId
        };
        
        payload.push(record);

        const existing = existingMap.get(`${sid}_${selectedSession}`);
        if (existing) {
          // Check if status changed
          if (existing.status !== status) {
            updates.push({ ...record, id: existing.id });
            smsEligibleStudentIds.add(sid);
          } else if (existing.arrival_time !== arrTime || existing.late_minutes !== mins) {
            updates.push({ ...record, id: existing.id });
            // Don't add to smsEligibleStudentIds if status is same to avoid duplicate SMS
            // unless we want to resend on time change. Let's keep it status-only for now.
          }
        } else {
          inserts.push(record);
          smsEligibleStudentIds.add(sid);
        }
      }

      // Execute updates
      for (const chunk of Array.from({ length: Math.ceil(updates.length / 50) }, (_, i) => updates.slice(i * 50, i * 50 + 50))) {
        await SupabaseWrapper.safeUpsert('attendance', chunk);
      }

      // Execute inserts
      for (const chunk of Array.from({ length: Math.ceil(inserts.length / 50) }, (_, i) => inserts.slice(i * 50, i * 50 + 50))) {
        try {
          await SupabaseWrapper.safeInsert('attendance', chunk);
        } catch (error: any) {
          if (error.message && (error.message.includes('class_id') || error.message.includes('cache'))) {
            throw new Error('ডাটাবেস কলাম (class_id) খুঁজে পাওয়া যাচ্ছে না। দয়া করে SQL এডিটর থেকে নতুন মাইগ্রেশন কোডটি রান করুন।');
          }
          throw error;
        }
      }

      // Sync and reload to get persistent IDs / records from the server if online
      if (isOnline) {
        try {
          await SyncEngine.sync();
          await fetchStudents(selectedClass.id);
        } catch (syncErr) {
          console.error("Immediate sync error:", syncErr);
        }
      } else {
        // Refresh existing records mapping 
        setExistingAttRecords(prev => {
          const newMap = new Map(prev.map(r => [r.student_id, r]));
          inserts.forEach(i => {
            const tempId = i.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString());
            newMap.set(i.student_id, { ...i, id: tempId });
          });
          updates.forEach(u => newMap.set(u.student_id, u));
          return Array.from(newMap.values());
        });
      }

      // Update Local Cache for offline consistency
      const currentAttendanceData = payload.filter(p => p.status !== 'present').map(p => {
        const student = students.find(s => s.id === p.student_id);
        const cls = classes.find(c => c.id === p.class_id);
        return {
          ...p,
          students: { 
            student_name: student?.student_name, 
            roll: student?.roll, 
            guardian_phone: student?.guardian_phone 
          },
          classes: { class_name: cls?.class_name },
          class_sort_order: cls?.sort_order
        };
      });

      // Sort currentAttendanceData by class sort order and roll
      const sortedCurrentData = [...currentAttendanceData].sort((a, b) => {
        const orderA = a.class_sort_order ?? 999999;
        const orderB = b.class_sort_order ?? 999999;
        
        if (orderA !== orderB) return orderA - orderB;
        
        const parseRoll = (r: any) => {
          if (typeof r === 'string') return parseInt(r) || parseInt(r.replace(/\D/g, '')) || 999999;
          return Number(r) || 999999;
        };
        
        const rollA = parseRoll(a.students?.roll);
        const rollB = parseRoll(b.students?.roll);
        return rollA - rollB;
      });
      
      if (date === reportDate) {
        setDailyAbsentees(sortedCurrentData as any);
        await CacheService.cacheData('attendance_daily', madrasah.id, sortedCurrentData);
      }
      
      // Auto-send SMS if configured
      if (madrasah?.config_json?.features?.student_attendance_sms) {
        try {
          const smsPromises = [];
          
          const templates = (madrasah?.config_json as any)?.features?.sms_templates || {};
          let presentMsgEn = templates.attendance_present || '';
          let absentMsgEn = templates.attendance_absent || '';
          let lateMsgEn = templates.attendance_late || '';
          let leaveMsgEn = templates.attendance_leave || '';

          const msgMap: Record<string, string> = {
            'present': presentMsgEn,
            'absent': absentMsgEn,
            'late': lateMsgEn,
            'leave': leaveMsgEn,
          };

          const sids = Array.from(smsEligibleStudentIds);
          const activeStudents = students.filter(s => sids.includes(s.id));
          
          // Group by status
          const grouped = activeStudents.reduce((acc, student) => {
            const st = attendance[student.id];
            if (st === 'present' || st === 'absent' || st === 'late' || st === 'leave') {
              if (!acc[st]) acc[st] = [];
              acc[st].push(student);
            }
            return acc;
          }, {} as Record<string, any[]>);

          for (const st of Object.keys(grouped)) {
            if (grouped[st].length > 0 && msgMap[st]) {
              smsPromises.push(smsApi.sendBulk(madrasah.id, grouped[st], msgMap[st]));
            }
          }
          
          if (smsPromises.length > 0) {
            Promise.all(smsPromises).catch(e => {
              console.error("Auto SMS failed", e);
              alert(lang === 'bn' ? `অটো এসএমএস পাঠানো সম্ভব হয়নি: ${e.message}` : `Auto SMS failed: ${e.message}`);
            });
          }
        } catch (autoSmsErr) {
          console.error("Auto SMS error: ", autoSmsErr);
        }
      }

      setSuccessTitle(lang === 'bn' ? 'সফল হয়েছে!' : 'Success!');
      setSuccessMessage(lang === 'bn' ? 'হাজিরা সফলভাবে ডাটাবেসে সংরক্ষিত হয়েছে।' : 'Attendance has been successfully saved to the database.');
      setShowSuccessModal(true);
      
      if (triggerRefresh) triggerRefresh();
    } catch (err: any) { 
      setErrorTitle(lang === 'bn' ? 'হাজিরা সংরক্ষণ ব্যর্থ' : 'Save Failed');
      setErrorDetails(err.message);
      setShowErrorModal(true);
    } finally { 
      setSaving(false); 
    }
  };

  const sendAbsentAlerts = async (customAbsents?: any[], customClassName?: string) => {
    if (!madrasah) return;
    
    const absents = customAbsents || students.filter(s => attendance[s.id] === 'absent');
    if (absents.length === 0) {
      setErrorTitle(lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'No Selection');
      setErrorDetails(lang === 'bn' ? 'কোনো অনুপস্থিত শিক্ষার্থী পাওয়া যায়নি!' : 'No absent students found to send alerts.');
      setShowErrorModal(true);
      return;
    }

    setConfirmData({
      title: lang === 'bn' ? 'এসএমএস এলার্ট পাঠান' : 'Send SMS Alert',
      message: lang === 'bn' 
        ? `${absents.length} জন অনুপস্থিত শিক্ষার্থীর অভিভাবককে এসএমএস পাঠাতে চান?` 
        : `Send SMS alerts to guardians of ${absents.length} absent students?`,
      icon: 'sms',
      color: 'blue',
      action: async () => {
        if (isSendingAlertsRef.current) return;
        isSendingAlertsRef.current = true;
        setSendingAlerts(true);
        setShowConfirmModal(false);
        try {
          let message = '';
          const template = smsTemplates.find(t => t.id === selectedSmsTemplateId);
          message = template?.body || '';

          if (!message.trim()) {
            throw new Error(lang === 'bn' ? 'এসএমএস টেমপ্লেট নির্বাচন করুন' : 'Please select an SMS template');
          }

          await smsApi.sendBulk(madrasah.id, absents, message);
          
          setSuccessTitle(lang === 'bn' ? 'সফল হয়েছে!' : 'Success!');
          setSuccessMessage(lang === 'bn' ? `${absents.length} জন অভিভাবককে এসএমএস পাঠানো হয়েছে।` : `SMS alerts sent to ${absents.length} guardians.`);
          setShowSuccessModal(true);
        } catch (err: any) { 
          setErrorTitle(lang === 'bn' ? 'এসএমএস পাঠানো ব্যর্থ' : 'SMS Failed');
          setErrorDetails(err.message);
          setShowErrorModal(true);
        } finally { 
          isSendingAlertsRef.current = false;
          setSendingAlerts(false); 
        }
      }
    });
    setShowConfirmModal(true);
  };

  const sendAbsentVoiceAlerts = async (customAbsents?: any[], customClassName?: string) => {
    if (!madrasah) return;
    
    if (!selectedVoiceTemplateId) {
      setErrorTitle(lang === 'bn' ? 'ভয়েস নির্বাচন করুন' : 'Select Voice');
      setErrorDetails(lang === 'bn' ? 'অনুগ্রহ করে একটি ভয়েস টেমপ্লেট নির্বাচন করুন' : 'Please select a voice template to continue.');
      setShowErrorModal(true);
      return;
    }

    const absents = customAbsents || students.filter(s => attendance[s.id] === 'absent');
    if (absents.length === 0) {
      setErrorTitle(lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'No Selection');
      setErrorDetails(lang === 'bn' ? 'কোনো অনুপস্থিত শিক্ষার্থী পাওয়া যায়নি!' : 'No absent students found!');
      setShowErrorModal(true);
      return;
    }

    const uniquePhoneNumbers = [...new Set(absents
      .map(s => {
        let p = s.guardian_phone || '';
        const digits = p.replace(/[^0-9]/g, '');
        if (digits.length === 11 && digits.startsWith('01')) return digits;
        if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
        if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
        return '';
      })
      .filter(p => p.length === 11)
    )];

    if (uniquePhoneNumbers.length === 0) {
      setErrorTitle(lang === 'bn' ? 'অবৈধ ফোন নম্বর' : 'Invalid phone numbers');
      setErrorDetails(lang === 'bn' ? 'কোনো অভিভাবকের সঠিক ফোন নম্বর পাওয়া যায়নি। (11 ডিজিট)' : 'No valid 11-digit guardian phone numbers found.');
      setShowErrorModal(true);
      return;
    }

    const estimatedCost = uniquePhoneNumbers.length * voiceRate;
    if (walletBalance < estimatedCost) {
      setErrorTitle(lang === 'bn' ? 'অপর্যাপ্ত ব্যালেন্স' : 'Insufficient Balance');
      setErrorDetails(lang === 'bn' ? `আপনার ব্যালেন্স কম। প্রয়োজন: ${estimatedCost} ৳` : `Insufficient balance. Required: ${estimatedCost} ৳`);
      setShowErrorModal(true);
      return;
    }

    setConfirmData({
      title: lang === 'bn' ? 'ভয়েস কল এলার্ট' : 'Voice Call Alert',
      message: lang === 'bn' 
        ? `${uniquePhoneNumbers.length} জন অভিভাবক-কে অনুপস্থিতি ভয়েস কল দিতে চান? (খরচ: ${estimatedCost} ৳)` 
        : `Send voice alerts to ${uniquePhoneNumbers.length} guardians? (Approx cost: ${estimatedCost} ৳)`,
      icon: 'voice',
      color: 'emerald',
      action: async () => {
        setSendingVoiceAlerts(true);
        setShowConfirmModal(false);
        try {
          const voice = voiceTemplates.find(v => v.id === selectedVoiceTemplateId);
          if (!voice) throw new Error('Voice template not found');

          // phoneNumbers is already uniquePhoneNumbers from above
          const phoneNumbers = uniquePhoneNumbers;

          if (phoneNumbers.length === 0) throw new Error('No valid phone numbers found');

          // Get sender number from institution
          const { data: instData } = await requestManager.cachedFetch('institutions', (q: any) => 
            q.select('voice_sender_id').eq('id', madrasah.id).single(),
            `institution_voice_sender:${madrasah.id}`,
            CACHE_TTLS.LONG
          );
          let sNumber = instData?.voice_sender_id || '';
          
          if (!sNumber) {
            // Fallback: try to fetch first available sender from API
            const sRes = await fetch('/api/awaj/senders');
            if (sRes.ok) {
              const sData = await sRes.json();
              const sList = Array.isArray(sData) ? sData : (sData.senders || sData.data || []);
              if (sList.length > 0) {
                sNumber = (sList[0].callingNumber || sList[0].caller_id || sList[0].id).toString();
              }
            }
          }

          if (!sNumber) throw new Error(lang === 'bn' ? 'কোনো ভয়েস সেন্ডার আইডি খুঁজে পাওয়া যায়নি।' : 'No voice sender ID found.');

          // Ensure sender is in 8801... format
          sNumber = sNumber.toString();
          const sDigits = sNumber.replace(/[^0-9]/g, '');
          if (sDigits.length === 11 && sDigits.startsWith('01')) {
            sNumber = '88' + sDigits;
          } else if (sDigits.length === 13 && sDigits.startsWith('8801')) {
            sNumber = sDigits;
          } else if (sDigits.length === 10 && sDigits.startsWith('1')) {
            sNumber = '880' + sDigits;
          }

          const requestId = crypto.randomUUID();
          const voiceName = voice.provider_voice_name || voice.title || voice.name || voice.voice_name || voice.id;
          
          const payload = {
            request_id: requestId,
            voice: voiceName,
            sender: sNumber,
            phone_numbers: phoneNumbers,
            retry: 1,
            retry_count: 1,
            retries: 1
          };

          const response = await fetch('/api/awaj/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errMessage = errorData.error || errorData.message || 'Failed to initiate voice call';
            if (errorData.details) {
                errMessage += ' - ' + (typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details));
            }
            throw new Error(errMessage);
          }

          const result = await response.json();
          const campaignId = result.broadcast?.id || result.id || requestId;

          // Log to database
          await supabase.from('voice_broadcasts').insert({
            institution_id: madrasah.id,
            voice_template_id: voice.id,
            target_type: 'students',
            target_class_name: customClassName || selectedClass?.class_name || 'Attendance Class',
            total_numbers: phoneNumbers.length,
            estimated_cost: estimatedCost,
            status: 'sending',
            provider_campaign_id: campaignId
          });

          // Deduct balance
          const { error: deductError } = await supabase.rpc('deduct_balance', {
            p_institution_id: madrasah.id,
            p_amount: estimatedCost
          });

          if (deductError) console.error('Error deducting balance:', deductError);
          
          setWalletBalance(prev => prev - estimatedCost);
          
          setSuccessTitle(lang === 'bn' ? 'সফল হয়েছে!' : 'Success!');
          setSuccessMessage(lang === 'bn' ? `${absents.length} জন অভিভাবককে ভয়েস কল রিকোয়েস্ট পাঠানো হয়েছে।` : `Voice call request sent to ${absents.length} guardians.`);
          setShowSuccessModal(true);
        } catch (err: any) {
          setErrorTitle(lang === 'bn' ? 'ভয়েস কল ব্যর্থ' : 'Voice Call Failed');
          setErrorDetails(err.message);
          setShowErrorModal(true);
        } finally {
          setSendingVoiceAlerts(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const saveSettings = async () => {
    if (!madrasah) return;
    setSavingSettings(true);
    try {
      const currentSettings = madrasah.config_json?.attendance_settings || {};
      const classSessions = { ...(currentSettings.class_sessions || {}) };
      const classTimes = { ...(currentSettings.class_times || {}) };
      
      let updatedSettings = { ...currentSettings };

      if (settingsClassId === 'global') {
        updatedSettings.sessions = settingsSessions;
        updatedSettings.start_time = startTime;
        updatedSettings.end_time = endTime;
        updatedSettings.half_day_time = halfDayTime;
        updatedSettings.full_day_time = fullDayTime;
      } else {
        classSessions[settingsClassId] = settingsSessions;
        updatedSettings.class_sessions = classSessions;
        
        classTimes[settingsClassId] = {
          start_time: startTime,
          end_time: endTime,
          half_day_time: halfDayTime,
          full_day_time: fullDayTime,
        };
        updatedSettings.class_times = classTimes;
      }

      const updatedConfig = {
        ...madrasah.config_json,
        attendance_settings: updatedSettings
      };
      
      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);
        
      if (error) throw error;
      
      // Invalidate Pattern on settings change as it affects attendance logic
      requestManager.invalidatePattern(`attendance:${madrasah.id}`);
      requestManager.invalidatePattern(`dashboard_`);
      
      if (triggerRefresh) triggerRefresh();
      
      setSuccessTitle(lang === 'bn' ? 'সেটিংস সংরক্ষিত!' : 'Settings Saved!');
      setSuccessMessage(lang === 'bn' ? 'আপনার হাজিরা সেটিংস সফলভাবে আপডেট করা হয়েছে।' : 'Your attendance settings have been successfully updated.');
      setShowSuccessModal(true);
      setShowSettingsModal(false);
    } catch (err: any) {
      setErrorTitle(lang === 'bn' ? 'সেটিংস সেভ ব্যর্থ' : 'Settings Failed');
      setErrorDetails(err.message);
      setShowErrorModal(true);
    } finally {
      setSavingSettings(false);
    }
  };

  const addSession = () => {
    if (!newSessionName.trim()) return;
    const newSession = {
      id: newSessionName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
      name: newSessionName.trim()
    };
    setSettingsSessions(prev => [...(Array.isArray(prev) ? prev : []), newSession]);
    setNewSessionName('');
  };

  const removeSession = (id: string) => {
    setSettingsSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleDownloadReportPDF = async () => {
    if (!reportData || reportData.length === 0 || !selectedClass) return;
    setDownloadingReport(true);
    setDownloadProgress(0);
    try {
        const titleLabel = reportType === 'monthly'
          ? new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })
          : reportType === 'yearly'
          ? (lang === 'bn' ? `বাৎসরিক রিপোর্ট (${selectedYear})` : `Yearly Report (${selectedYear})`)
          : (lang === 'bn' ? `দৈনিক রিপোর্ট (${reportDate})` : `Daily Report (${reportDate})`);
        await generateAttendanceReportPDF(reportData, madrasah, selectedClass.class_name, titleLabel, lang, (p) => setDownloadProgress(p));
    } catch (err: any) {
        console.error('Failed to generate PDF:', err);
    } finally {
        setDownloadingReport(false);
        setDownloadProgress(0);
    }
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-20 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
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
              {lang === 'bn' ? 'ফাইল তৈরি হচ্ছে...' : 'Generating File...'}
            </h3>
            <p className="text-slate-500 text-sm">
              {lang === 'bn' ? 'দয়া করে কিছুক্ষণ অপেক্ষা করুন।' : 'Please wait while we prepare your document.'}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}><ArrowLeft size={20}/></button>
          <h1 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>{t('attendance_daily', lang)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettingsModal(true)} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400'}`}><Settings size={18} /></button>
          <button onClick={() => selectedClass && (activeTab === 'daily' ? fetchStudents(selectedClass.id) : fetchReport(selectedClass.id))} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400'}`}><RefreshCw size={18} /></button>
        </div>
      </div>

      <div className={`flex p-1 rounded-[1.5rem] border shadow-sm transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
        {(['daily', 'report'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            {tab === 'daily' ? t('attendance_daily', lang) : t('attendance_report', lang)}
          </button>
        ))}
      </div>

      <div className={`p-6 rounded-[2.5rem] border shadow-bubble space-y-4 transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
        <div className={activeTab === 'daily' ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-4"}>
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('class_select', lang)}</label>
            <button onClick={() => setShowClassDropdown(!showClassDropdown)} className={`w-full h-14 px-4 rounded-2xl border-2 flex items-center justify-between group active:scale-[0.99] transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
              <span className="font-black font-noto truncate text-[13px] sm:text-sm">{selectedClass ? (selectedClass.id === 'all' ? (lang === 'bn' ? 'সকল ক্লাস (সম্পূর্ণ প্রতিষ্ঠান)' : 'All Classes (Entire Institution)') : selectedClass.class_name) : t('class_choose', lang)}</span>
              <ChevronDown size={18} className="text-slate-300 transition-transform duration-300 group-focus:rotate-180" />
            </button>
            {showClassDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2rem] shadow-bubble border z-[100] p-2 max-h-56 overflow-y-auto animate-in slide-in-from-top-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                {activeTab === 'report' && (
                  <button onClick={() => { setSelectedClass({id: 'all', class_name: lang === 'bn' ? 'সকল ক্লাস (সম্পূর্ণ প্রতিষ্ঠান)' : 'All Classes (Entire Institution)'} as any); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-4 rounded-xl mb-1 transition-all ${selectedClass?.id === 'all' ? 'bg-[#2563EB] text-white shadow-premium' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700')}`}>
                    <span className="font-black font-noto text-[15px]">{lang === 'bn' ? 'সকল ক্লাস (সম্পূর্ণ প্রতিষ্ঠান)' : 'All Classes (Entire Institution)'}</span>
                  </button>
                )}
                {classes.map(cls => (
                  <button key={cls.id} onClick={() => { setSelectedClass(cls); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-4 rounded-xl mb-1 transition-all ${selectedClass?.id === cls.id ? 'bg-[#2563EB] text-white shadow-premium' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700')}`}>
                    <span className="font-black font-noto text-[15px]">{cls.class_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeTab === 'daily' && (
            <div className="relative animate-in fade-in">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">তারিখ</label>
              <div className="relative">
                <input 
                  type="date" 
                  className={`w-full h-14 pl-10 pr-2 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  min={activeYear?.start_date}
                  max={activeYear?.end_date}
                />
                <Calendar className="absolute left-3 top-4 text-[#2563EB]" size={18}/>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'daily' ? (
          <div className="relative mt-0 animate-in fade-in">
            <div className="relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{lang === 'bn' ? 'বেলা/সেশন' : 'Session'}</label>
              <div className={`flex flex-wrap p-1.5 rounded-2xl border-2 shadow-inner gap-1 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {sessions.length > 0 ? sessions.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setSelectedSession(s.id)} 
                    className={`flex-1 min-w-[80px] py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSession === s.id ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {lang === 'bn' ? (s.name === 'Morning' ? 'সকাল' : s.name === 'Afternoon' ? 'বিকাল' : s.name) : (s.name === 'সকাল' ? 'Morning' : s.name === 'বিকাল' ? 'Afternoon' : s.name)}
                  </button>
                )) : (
                  <button 
                    onClick={() => setSelectedSession('daily')} 
                    className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSession === 'daily' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {lang === 'bn' ? 'দৈনিক' : 'Daily'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
            <div className="space-y-4 animate-in fade-in">
                <div className={`flex p-1 rounded-xl border transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <button onClick={() => setReportType('daily')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'daily' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'দৈনিক' : 'Daily'}</button>
                    <button onClick={() => setReportType('monthly')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'monthly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'মাসিক' : 'Monthly'}</button>
                    <button onClick={() => setReportType('yearly')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'yearly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'বাৎসরিক' : 'Yearly'}</button>
                </div>
                
                <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                        {lang === 'bn' ? 'সেশন নির্বাচন করুন' : 'Select Session'}
                    </label>
                    <div className={`flex flex-wrap p-1 rounded-xl border transition-all gap-1 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <button onClick={() => setSelectedSession('all')} className={`flex-1 min-w-[60px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedSession === 'all' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'সব' : 'All'}</button>
                        {sessions.length > 0 ? sessions.map(s => (
                          <button key={s.id} onClick={() => setSelectedSession(s.id)} className={`flex-1 min-w-[60px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedSession === s.id ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? (s.name === 'Morning' ? 'সকাল' : s.name === 'Afternoon' ? 'বিকাল' : s.name) : (s.name === 'সকাল' ? 'Morning' : s.name === 'বিকাল' ? 'Afternoon' : s.name)}</button>
                        )) : (
                          <button onClick={() => setSelectedSession('daily')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedSession === 'daily' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{lang === 'bn' ? 'দৈনিক' : 'Daily'}</button>
                        )}
                    </div>
                </div>
                
                <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                        {reportType === 'daily' ? 'তারিখ নির্বাচন করুন' : reportType === 'monthly' ? 'মাস নির্বাচন করুন' : 'বছর নির্বাচন করুন'}
                    </label>
                    {reportType === 'daily' ? (
                        <div className="relative"><input 
                          type="date" 
                          className={`w-full h-14 pl-14 pr-6 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} 
                          value={reportDate} 
                          onChange={(e) => setReportDate(e.target.value)}
                          min={activeYear?.start_date}
                          max={activeYear?.end_date}
                        /><Calendar className="absolute left-5 top-4 text-[#2563EB]" size={22}/></div>
                    ) : reportType === 'monthly' ? (
                        <div className="relative"><input 
                          type="month" 
                          className={`w-full h-14 pl-14 pr-6 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} 
                          value={selectedMonth} 
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          min={activeYear?.start_date ? activeYear.start_date.slice(0, 7) : undefined}
                          max={activeYear?.end_date ? activeYear.end_date.slice(0, 7) : undefined}
                        /><BarChart3 className="absolute left-5 top-4 text-[#2563EB]" size={22}/></div>
                    ) : (
                        <div className="relative">
                            <select className={`w-full h-14 pl-14 pr-6 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all appearance-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                                {(() => {
                                    const currentY = new Date().getFullYear();
                                    const yearsSet = new Set<number>();
                                    yearsSet.add(currentY);
                                    yearsSet.add(currentY - 1);
                                    yearsSet.add(currentY - 2);
                                    yearsSet.add(currentY - 3);
                                    yearsSet.add(currentY + 1);
                                    if (activeYear?.start_date && activeYear?.end_date) {
                                        const startY = parseInt(activeYear.start_date.slice(0, 4));
                                        const endY = parseInt(activeYear.end_date.slice(0, 4));
                                        for (let y = startY; y <= endY; y++) yearsSet.add(y);
                                    }
                                    return Array.from(yearsSet).sort((a, b) => b - a).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ));
                                })()}
                            </select>
                            <Calendar className="absolute left-5 top-4 text-[#2563EB]" size={22}/>
                            <ChevronDown className="absolute right-5 top-4 text-slate-400 pointer-events-none" size={20}/>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {fetchError && (
        <div className="p-5 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-600 shadow-sm animate-in shake duration-500">
           <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><AlertCircle size={24} /></div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider">টেকনিক্যাল এরর!</p>
              <p className="text-[11px] font-bold opacity-80 leading-relaxed">{fetchError}</p>
           </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Data...</p>
        </div>
      ) : (
          <>
            {activeTab === 'daily' ? (
              isHoliday ? (
                <div className={`p-10 border-2 border-dashed rounded-[3rem] flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-500 ${isDark ? 'bg-slate-900 border-slate-700 shadow-slate-950/50' : 'bg-amber-50 border-amber-200 shadow-amber-900/5'}`}>
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
                    <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner border ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-amber-100 text-amber-600 border-amber-200'}`}>
                      <AlertTriangle size={40} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-amber-900'}`}>আজ হাজিরা বন্ধ</h3>
                    <p className={`text-sm font-bold max-w-[250px] ${isDark ? 'text-slate-400' : 'text-amber-700/70'}`}>
                      {dayEvents.map(e => e.title).join(', ') || 'আজকের দিনে বিশেষ ইভেন্ট বা ছুটি রয়েছে।'}
                    </p>
                    <p className={`text-[10px] font-black uppercase tracking-widest pt-2 ${isDark ? 'text-blue-400' : 'text-amber-400'}`}>ক্যালেন্ডার অনুযায়ী আজ হাজিরা গ্রহণ করা সম্ভব নয়</p>
                  </div>
                </div>
              ) : students.length > 0 ? (
                <div className="space-y-3 animate-in slide-in-from-bottom-5">
                   <div className="flex items-center justify-between px-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">শিক্ষার্থী তালিকা</h4>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">উপস্থিতি</h4>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                   {students.map(s => (
                     <div key={s.id} className={`p-3 sm:p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[1.1rem] flex flex-col items-center justify-center border shrink-0 shadow-inner ${isDark ? 'bg-slate-900 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
                            <span className="text-[7px] sm:text-[8px] font-black opacity-40 leading-none">ROLL</span>
                            <span className="text-sm sm:text-base font-black leading-none mt-0.5 sm:mt-1">{s.roll || '-'}</span>
                          </div>
                          <div className="min-w-0">
                            <h5 className={`font-black font-noto text-[13px] sm:text-sm line-clamp-2 leading-tight ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{s.student_name}</h5>
                          </div>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 shrink-0 items-center">
                           <button onClick={() => setStatus(s.id, 'present')} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'present' ? 'bg-emerald-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title={t('mark_present', lang, madrasah?.institution_type)}><CheckCircle size={18} className="sm:w-5 sm:h-5" /></button>
                           <button onClick={() => setStatus(s.id, 'absent')} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title={t('mark_absent', lang, madrasah?.institution_type)}><XCircle size={18} className="sm:w-5 sm:h-5" /></button>
                           <div className="flex flex-col items-center">
                             <button onClick={() => setStatus(s.id, 'late')} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'late' ? 'bg-amber-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title={t('mark_late', lang, madrasah?.institution_type)}>
                                {attendance[s.id] === 'late' ? (
                                 <span className="text-[13px] sm:text-base font-black">{computeLateMins(arrivalTime[s.id])}</span>
                                ) : <Clock size={18} className="sm:w-5 sm:h-5" />}
                             </button>
                             {attendance[s.id] === 'late' && (
                               <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-amber-500 mt-1 whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                                 {lang === 'bn' ? 'মিনিট' : 'MIN'}
                               </span>
                             )}
                           </div>
                           <button onClick={() => setStatus(s.id, 'leave')} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'leave' ? 'bg-indigo-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title={t('mark_leave', lang, madrasah?.institution_type)}><CalendarOff size={18} className="sm:w-5 sm:h-5" /></button>
                        </div>
                     </div>
                   ))}
                   </div>
                   <div className="flex flex-col gap-4 mt-8">
                        <button 
                          onClick={() => {
                            if (!isOnline) {
                              setErrorTitle(lang === 'bn' ? 'অফলাইন' : 'Offline');
                              setErrorDetails(lang === 'bn' ? 'হাজিরা সেভ করতে ইন্টারনেট প্রয়োজন।' : 'Internet required to save attendance.');
                              setShowErrorModal(true);
                              return;
                            }
                            handleSave();
                          }} 
                          disabled={saving || !isOnline} 
                          className={`w-full h-16 font-black rounded-full flex items-center justify-center gap-3 text-lg active:scale-95 transition-all ${!isOnline ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-[#2563EB] text-white shadow-premium'}`}
                        >
                            {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} strokeWidth={3} /> {t('save', lang)}</>}
                        </button>
                        
                        <div className="flex flex-col gap-4">
                            {/* SMS Section */}
                            <div className="space-y-2">
                                <p className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {lang === 'bn' ? 'এসএমএস এলার্ট' : 'SMS Alert'}
                                </p>
                                
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => {
                                            if (!isOnline) {
                                                setErrorTitle(lang === 'bn' ? 'অফলাইন' : 'Offline');
                                                setErrorDetails(lang === 'bn' ? 'এসএমএস পাঠাতে ইন্টারনেট প্রয়োজন।' : 'Internet required to send SMS.');
                                                setShowErrorModal(true);
                                                return;
                                            }
                                            sendAbsentAlerts();
                                        }} 
                                        disabled={sendingAlerts || !isOnline} 
                                        className={`flex-[2.5] h-14 font-black rounded-2xl flex items-center justify-center gap-3 text-[13px] active:scale-95 transition-all border uppercase tracking-widest shadow-sm ${!isOnline ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed' : isDark ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100 hover:bg-blue-100'}`}
                                    >
                                        {sendingAlerts ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} /> {t('absent_alert', lang)}</>}
                                    </button>

                                    <div className="flex-1 relative">
                                        <button 
                                            onClick={() => setShowSmsTemplateDropdown(!showSmsTemplateDropdown)}
                                            className={`w-full h-14 px-3 rounded-2xl border flex items-center justify-between active:scale-95 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-[#2563EB]'}`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest truncate">
                                                {smsTemplates.find(t => t.id === selectedSmsTemplateId)?.title || (lang === 'bn' ? 'নির্বাচন করুন' : 'Select Template')}
                                            </span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform duration-300 ${showSmsTemplateDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showSmsTemplateDropdown && (
                                            <div className={`absolute bottom-full right-0 mb-3 w-64 p-2 rounded-[1.5rem] shadow-xl border z-[110] max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                {smsTemplates.length === 0 ? (
                                                    <p className="p-4 text-xs text-slate-500 font-bold text-center italic">{lang === 'bn' ? 'কোনো টেমপ্লেট নেই' : 'No templates found.'}</p>
                                                ) : (
                                                    smsTemplates.map(t => (
                                                        <button 
                                                            key={t.id}
                                                            onClick={() => { setSelectedSmsTemplateId(t.id); setShowSmsTemplateDropdown(false); }}
                                                            className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold mb-1 transition-all ${selectedSmsTemplateId === t.id ? (isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-600 text-white') : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}
                                                        >
                                                            {t.title}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => setShowShortcodes(!showShortcodes)}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border active:scale-95 transition-all shrink-0 ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                                    >
                                        <Info size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Voice Section */}
                            <div className="space-y-2 mt-2">
                                <p className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {lang === 'bn' ? 'ভয়েস এলার্ট' : 'Voice Alert'}
                                </p>
                                
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => {
                                            if (!isOnline) {
                                                setErrorTitle(lang === 'bn' ? 'অফলাইন' : 'Offline');
                                                setErrorDetails(lang === 'bn' ? 'ভয়েস কল পাঠাতে ইন্টারনেট প্রয়োজন।' : 'Internet required to send Voice Calls.');
                                                setShowErrorModal(true);
                                                return;
                                            }
                                            sendAbsentVoiceAlerts();
                                        }} 
                                        disabled={sendingVoiceAlerts || !isOnline || voiceTemplates.length === 0} 
                                        className={`flex-[2.5] h-14 font-black rounded-2xl flex items-center justify-center gap-3 text-[13px] active:scale-95 transition-all border uppercase tracking-widest shadow-sm ${!isOnline || voiceTemplates.length === 0 ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed' : isDark ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                                    >
                                        {sendingVoiceAlerts ? <Loader2 className="animate-spin" size={20} /> : <><MessageSquare size={20} /> {lang === 'bn' ? 'ভয়েস কল এলার্ট' : 'Voice Call Alert'}</>}
                                    </button>

                                    <div className="flex-1 relative">
                                        <button 
                                            onClick={() => setShowVoiceTemplateDropdown(!showVoiceTemplateDropdown)}
                                            className={`w-full h-14 px-3 rounded-2xl border flex items-center justify-between active:scale-95 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-[#2563EB]'}`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest truncate">
                                                {selectedVoiceTemplateId ? (voiceTemplates.find(v => v.id === selectedVoiceTemplateId)?.title || (lang === 'bn' ? 'নির্বাচন' : 'Select')) : (lang === 'bn' ? 'নির্বাচন' : 'Select')}
                                            </span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform duration-300 ${showVoiceTemplateDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showVoiceTemplateDropdown && (
                                            <div className={`absolute bottom-full right-0 mb-3 w-64 p-2 rounded-[1.5rem] shadow-xl border z-[110] max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                {voiceTemplates.length === 0 ? (
                                                    <p className="p-4 text-xs text-slate-500 font-bold text-center italic">{lang === 'bn' ? 'কোনো অনুমোদিত ভয়েস নেই' : 'No approved voices found.'}</p>
                                                ) : (
                                                    voiceTemplates.map(v => (
                                                        <button 
                                                            key={v.id}
                                                            onClick={() => { setSelectedVoiceTemplateId(v.id); setShowVoiceTemplateDropdown(false); }}
                                                            className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold mb-1 transition-all ${selectedVoiceTemplateId === v.id ? (isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-600 text-white') : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}
                                                        >
                                                            {v.title}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {showShortcodes && (
                           <div className={`p-4 rounded-2xl border animate-in slide-in-from-top-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50/50 border-blue-100/50'}`}>
                             <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>Available Shortcodes:</p>
                             <div className="flex flex-wrap gap-2">
                               {availableShortcodes.map(sc => (
                                 <div key={sc.code} className={`px-3 py-1.5 border rounded-xl text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-blue-100 text-[#1E3A8A]'}`}>
                                   {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                        )}
                   </div>
                </div>
              ) : <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                    <Users size={40} className="text-slate-400/20 mb-4" />
                    <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">{selectedClass ? 'No Students Found' : 'Please select a class'}</p>
                  </div>
            ) : reportType === 'daily' ? (
              <div className="space-y-6 animate-in slide-in-from-bottom-5">
                  {dailyAbsentees.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-sm">
                       <div className={`p-2 sm:p-2.5 rounded-[1.2rem] border text-center ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50/50 border-red-100 text-red-600'}`}>
                          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</p>
                          <p className="text-xs sm:text-sm font-black">{onlyAbsents.length}</p>
                       </div>
                       <div className={`p-2 sm:p-2.5 rounded-[1.2rem] border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50/50 border-amber-100 text-amber-600'}`}>
                          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5">{lang === 'bn' ? 'বিলম্ব / দেরি' : 'Late'}</p>
                          <p className="text-xs sm:text-sm font-black">{lateCount}</p>
                       </div>
                       <div className={`p-2 sm:p-2.5 rounded-[1.2rem] border text-center ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50/50 border-indigo-100 text-indigo-600'}`}>
                          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5">{lang === 'bn' ? 'ছুটি' : 'Leave'}</p>
                          <p className="text-xs sm:text-sm font-black">{leaveCount}</p>
                       </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2 mt-2">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {lang === 'bn' ? 'অনুপস্থিত শিক্ষার্থী তালিকা' : 'Absent Student List'} ({onlyAbsents.length})
                     </h4>
                  </div>

                  {onlyAbsents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {onlyAbsents.map(a => (
                        <div key={a.student_id} className={`p-2.5 sm:p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between gap-2.5 sm:gap-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                           <div className="flex items-center gap-4 min-w-0">
                             <div className={`w-11 h-11 rounded-[1.1rem] flex flex-col items-center justify-center border shrink-0 ${isDark ? 'bg-slate-900 text-red-400 border-slate-700' : 'bg-red-50 text-red-500 border-red-100'}`}>
                               <XCircle size={16} className="sm:w-5 sm:h-5" />
                             </div>
                             <div className="min-w-0">
                               <h5 className={`font-black font-noto text-xs sm:text-[13px] truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{a.students?.student_name}</h5>
                               <div className="mt-1 space-y-0.5">
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{a.classes?.class_name || 'Class'}</p>
                                   <span className="text-slate-300">•</span>
                                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Roll: {a.students?.roll}</p>
                                 </div>
                               </div>
                             </div>
                           </div>
                           {a.students?.guardian_phone && (
                             <a href={`tel:${a.students.guardian_phone}`} className={`shrink-0 w-11 h-11 rounded-[1.1rem] flex items-center justify-center border transition-all active:scale-95 ${isDark ? 'bg-blue-900/30 text-blue-400 border-blue-900/50 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}>
                               <Phone size={16} className="sm:w-[18px] sm:h-[18px]" />
                             </a>
                           )}
                        </div>
                      ))}
                    </div>
                 ) : attendanceNotTaken ? (
                    <div className={`p-10 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center text-center ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                       <AlertTriangle size={40} className="text-yellow-500 mb-3" />
                       <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{lang === 'bn' ? 'হাজিরা নেওয়া হয়নি' : 'Attendance Not Taken'}</p>
                    </div>
                 ) : (
                    <div className={`p-10 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center text-center ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                       <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                       <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{lang === 'bn' ? 'সবাই উপস্থিত' : 'Everyone Present'}</p>
                    </div>
                 )}
                 
                 {dailyAbsentees.length > 0 && (
                   <div className="flex flex-col gap-4 mt-8 border-t pt-8 border-slate-100 dark:border-slate-800">
                      {/* Shared SMS/Voice UI for Daily Reports */}
                      <div className="space-y-2">
                          <p className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {lang === 'bn' ? 'এসএমএস এলার্ট (সকল ক্লাস বা নির্দিষ্ট)' : 'SMS Alert (All/Selected Classes)'}
                          </p>
                          <div className="flex items-center gap-2">
                              <button 
                                  onClick={() => {
                                      if (!isOnline) {
                                          setErrorTitle(lang === 'bn' ? 'অফলাইন' : 'Offline');
                                          setErrorDetails(lang === 'bn' ? 'এসএমএস পাঠাতে ইন্টারনেট প্রয়োজন।' : 'Internet required to send SMS.');
                                          setShowErrorModal(true);
                                          return;
                                      }
                                      const mappedAbsents = onlyAbsents.filter(a => a.students).map(a => ({...a.students, id: a.student_id}));
                                      sendAbsentAlerts(mappedAbsents, selectedClass?.id === 'all' ? 'All Classes' : undefined);
                                  }} 
                                  disabled={sendingAlerts || !isOnline} 
                                  className={`flex-[2.5] h-14 font-black rounded-2xl flex items-center justify-center gap-3 text-[13px] active:scale-95 transition-all border uppercase tracking-widest shadow-sm ${!isOnline ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed' : isDark ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100 hover:bg-blue-100'}`}
                              >
                                  {sendingAlerts ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} /> {t('absent_alert', lang)}</>}
                              </button>
                              <div className="flex-1 relative">
                                  <button onClick={() => setShowSmsTemplateDropdown(!showSmsTemplateDropdown)} className={`w-full h-14 px-3 rounded-2xl border flex items-center justify-between active:scale-95 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-[#2563EB]'}`}>
                                      <span className="text-[10px] font-black uppercase tracking-widest truncate">{smsTemplates.find(t => t.id === selectedSmsTemplateId)?.title || (lang === 'bn' ? 'নির্বাচন করুন' : 'Select Template')}</span>
                                      <ChevronDown size={14} className={`shrink-0 transition-transform duration-300 ${showSmsTemplateDropdown ? 'rotate-180' : ''}`} />
                                  </button>
                                  {showSmsTemplateDropdown && (
                                      <div className={`absolute bottom-full right-0 mb-3 w-64 p-2 rounded-[1.5rem] shadow-xl border z-[110] max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                          {smsTemplates.length === 0 ? (
                                              <p className="p-4 text-xs text-slate-500 font-bold text-center italic">{lang === 'bn' ? 'কোনো টেমপ্লেট নেই' : 'No templates found.'}</p>
                                          ) : (
                                              smsTemplates.map(t => (
                                                  <button key={t.id} onClick={() => { setSelectedSmsTemplateId(t.id); setShowSmsTemplateDropdown(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold mb-1 transition-all ${selectedSmsTemplateId === t.id ? (isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-600 text-white') : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}>{t.title}</button>
                                              ))
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="space-y-2 mt-2">
                          <p className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {lang === 'bn' ? 'ভয়েস এলার্ট (সকল ক্লাস বা নির্দিষ্ট)' : 'Voice Alert (All/Selected Classes)'}
                          </p>
                          <div className="flex items-center gap-2">
                              <button 
                                  onClick={() => {
                                      if (!isOnline) {
                                          setErrorTitle(lang === 'bn' ? 'অফলাইন' : 'Offline');
                                          setErrorDetails(lang === 'bn' ? 'ভয়েস কল পাঠাতে ইন্টারনেট প্রয়োজন।' : 'Internet required to send Voice Calls.');
                                          setShowErrorModal(true);
                                          return;
                                      }
                                      const mappedAbsents = onlyAbsents.filter(a => a.students).map(a => ({...a.students, id: a.student_id}));
                                      sendAbsentVoiceAlerts(mappedAbsents, selectedClass?.id === 'all' ? 'All Classes' : undefined);
                                  }} 
                                  disabled={sendingVoiceAlerts || !isOnline || voiceTemplates.length === 0} 
                                  className={`flex-[2.5] h-14 font-black rounded-2xl flex items-center justify-center gap-3 text-[13px] active:scale-95 transition-all border uppercase tracking-widest shadow-sm ${!isOnline || voiceTemplates.length === 0 ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed' : isDark ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                              >
                                  {sendingVoiceAlerts ? <Loader2 className="animate-spin" size={20} /> : <><MessageSquare size={20} /> {lang === 'bn' ? 'ভয়েস কল এলার্ট' : 'Voice Call Alert'}</>}
                              </button>
                              <div className="flex-1 relative">
                                  <button onClick={() => setShowVoiceTemplateDropdown(!showVoiceTemplateDropdown)} className={`w-full h-14 px-3 rounded-2xl border flex items-center justify-between active:scale-95 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-[#2563EB]'}`}>
                                      <span className="text-[10px] font-black uppercase tracking-widest truncate">{selectedVoiceTemplateId ? (voiceTemplates.find(v => v.id === selectedVoiceTemplateId)?.title || (lang === 'bn' ? 'নির্বাচন' : 'Select')) : (lang === 'bn' ? 'নির্বাচন' : 'Select')}</span>
                                      <ChevronDown size={14} className={`shrink-0 transition-transform duration-300 ${showVoiceTemplateDropdown ? 'rotate-180' : ''}`} />
                                  </button>
                                  {showVoiceTemplateDropdown && (
                                      <div className={`absolute bottom-full right-0 mb-3 w-64 p-2 rounded-[1.5rem] shadow-xl border z-[110] max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                          {voiceTemplates.length === 0 ? (
                                              <p className="p-4 text-xs text-slate-500 font-bold text-center italic">{lang === 'bn' ? 'কোনো অনুমোদিত ভয়েস নেই' : 'No approved voices found.'}</p>
                                          ) : (
                                              voiceTemplates.map(v => (
                                                  <button key={v.id} onClick={() => { setSelectedVoiceTemplateId(v.id); setShowVoiceTemplateDropdown(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold mb-1 transition-all ${selectedVoiceTemplateId === v.id ? (isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-600 text-white') : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}>{v.title}</button>
                                              ))
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                   </div>
                 )}
              </div>
            ) : (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button onClick={() => setReportView('list')} className={`flex-1 sm:flex-initial h-11 sm:h-12 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${reportView === 'list' ? 'bg-[#2563EB] text-white shadow-md' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400')}`}>
                        {lang === 'bn' ? 'লিস্ট ভিউ' : 'List View'}
                      </button>
                      <button onClick={() => setReportView('analytics')} className={`flex-1 sm:flex-initial h-11 sm:h-12 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${reportView === 'analytics' ? 'bg-[#2563EB] text-white shadow-md' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400')}`}>
                        {lang === 'bn' ? 'অ্যানালিটিক্স' : 'Analytics'}
                      </button>
                  </div>

                  {reportView === 'list' && reportData.length > 0 && (
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                      <div className={`relative flex items-center flex-1 rounded-xl border px-3 py-1.5 h-11 sm:h-12 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                        <input
                          type="text"
                          placeholder={lang === 'bn' ? 'শিক্ষার্থী / রোল খুঁজুন...' : 'Search student or roll...'}
                          value={reportSearchQuery}
                          onChange={e => setReportSearchQuery(e.target.value)}
                          className="bg-transparent border-none outline-none text-xs font-bold w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </div>

                      <div className={`flex rounded-xl p-1 border h-11 sm:h-12 shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                        <button
                          onClick={() => setReportDisplayMode('table')}
                          title={lang === 'bn' ? 'টেবিল ভিউ' : 'Table View'}
                          className={`px-2.5 sm:px-3 rounded-lg flex items-center justify-center transition-all ${reportDisplayMode === 'table' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          <ListFilter size={18} />
                        </button>
                        <button
                          onClick={() => setReportDisplayMode('cards')}
                          title={lang === 'bn' ? 'কার্ড ভিউ' : 'Cards View'}
                          className={`px-2.5 sm:px-3 rounded-lg flex items-center justify-center transition-all ${reportDisplayMode === 'cards' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          <LayoutGrid size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {reportData.length > 0 && selectedClass && (
                    <button 
                      onClick={handleDownloadReportPDF} 
                      disabled={downloadingReport}
                      className={`w-full sm:w-auto h-11 sm:h-12 px-5 sm:px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                    >
                      {downloadingReport ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      {lang === 'bn' ? 'ডাউনলোড PDF' : 'Download PDF'}
                    </button>
                  )}
                </div>

                {reportView === 'analytics' ? (
                <div className="space-y-6 animate-in fade-in">
                  {reportData.length > 0 ? (
                    <>
                      <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          <BarChart3 className="text-[#2563EB]" size={18} />
                          {lang === 'bn' ? 'হাজিরা ওভারভিউ' : 'Attendance Overview'}
                        </h3>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.map(d => ({ name: d.roll || d.student_name.substring(0, 5), [lang === 'bn' ? 'উপস্থিত' : 'Present']: d.present_days, [lang === 'bn' ? 'অনুপস্থিত' : 'Absent']: d.absent_days, [lang === 'bn' ? 'বিলম্ব' : 'Late']: d.late_days || 0, [lang === 'bn' ? 'ছুটি' : 'Leave']: d.leave_days || 0 }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <Tooltip cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                              <Bar dataKey={lang === 'bn' ? 'উপস্থিত' : 'Present'} stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                              <Bar dataKey={lang === 'bn' ? 'ছুটি' : 'Leave'} stackId="a" fill="#6366f1" />
                              <Bar dataKey={lang === 'bn' ? 'বিলম্ব' : 'Late'} stackId="a" fill="#f59e0b" />
                              <Bar dataKey={lang === 'bn' ? 'অনুপস্থিত' : 'Absent'} stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          <TrendingDown className="text-red-500" size={18} />
                          {lang === 'bn' ? 'সর্বাধিক অনুপস্থিত শিক্ষার্থী' : 'Most Absent Students'}
                        </h3>
                        <div className="space-y-3">
                          {[...reportData].sort((a, b) => b.absent_days - a.absent_days).slice(0, 5).map((student, idx) => (
                            <div key={student.student_id} className={`flex items-center justify-between p-3 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-black text-xs">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className={`font-black text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{student.student_name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Roll: {student.roll || '-'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-red-500">{student.absent_days} {lang === 'bn' ? 'দিন' : 'Days'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                      <BarChart3 size={40} className="text-slate-400/20 mb-4" />
                      <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">{lang === 'bn' ? 'অ্যানালিটিক্স এর জন্য কোনো তথ্য নেই' : 'No Data for Analytics'}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-5">
                    {filteredReportData.length > 0 ? (
                      reportDisplayMode === 'table' ? (
                        <div className={`rounded-2xl sm:rounded-3xl border overflow-hidden shadow-lg ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="overflow-x-auto scrollbar-thin">
                            <table className="w-full text-left border-collapse min-w-[680px]">
                              <thead>
                                <tr className={`border-b text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                                  <th className="py-3 sm:py-4 px-2.5 sm:px-4 text-center whitespace-nowrap">{lang === 'bn' ? 'মেধাস্থান' : 'Rank'}</th>
                                  <th className="py-3 sm:py-4 px-2.5 sm:px-4 text-center whitespace-nowrap">{lang === 'bn' ? 'রোল' : 'Roll'}</th>
                                  <th className="py-3 sm:py-4 px-2.5 sm:px-4 whitespace-nowrap">{lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                                  {selectedClass?.id === 'all' && <th className="py-3 sm:py-4 px-2.5 sm:px-4 whitespace-nowrap">{lang === 'bn' ? 'শ্রেণি' : 'Class'}</th>}
                                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center whitespace-nowrap">{lang === 'bn' ? 'মোট দিন' : 'Total'}</th>
                                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{lang === 'bn' ? 'উপস্থিত' : 'Present'}</th>
                                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center text-red-700 dark:text-red-400 whitespace-nowrap">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</th>
                                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center text-amber-700 dark:text-amber-400 whitespace-nowrap">{lang === 'bn' ? 'বিলম্ব' : 'Late'}</th>
                                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{lang === 'bn' ? 'ছুটি' : 'Leave'}</th>
                                  <th className="py-3 sm:py-4 px-2.5 sm:px-4 text-center whitespace-nowrap">{lang === 'bn' ? 'শতকরা' : 'Percentage'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px] sm:text-xs font-bold">
                                {filteredReportData.map((item, index) => {
                                  const rankLabel = getRankBadgeLabel(item.rank, lang);
                                  const isTop3 = item.rank <= 3;
                                  return (
                                    <tr 
                                      key={item.student_id} 
                                      className={`hover:bg-blue-50/60 dark:hover:bg-slate-800/60 transition-colors ${
                                        item.rank === 1 
                                          ? 'bg-amber-50/40 dark:bg-amber-950/20' 
                                          : index % 2 === 0 
                                            ? 'bg-slate-50/60 dark:bg-slate-900/30' 
                                            : 'bg-white dark:bg-slate-950/30'
                                      }`}
                                    >
                                      <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 text-center whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full font-black text-[10px] sm:text-xs ${
                                          item.rank === 1 ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/50 dark:text-amber-300' :
                                          item.rank === 2 ? 'bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200' :
                                          item.rank === 3 ? 'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/50 dark:text-orange-300' :
                                          'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                                        }`}>
                                          {isTop3 && <Trophy size={11} className={item.rank === 1 ? 'text-amber-600' : item.rank === 2 ? 'text-slate-500' : 'text-orange-600'} />}
                                          {rankLabel}
                                        </span>
                                      </td>
                                      <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 text-center font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">#{item.roll || '-'}</td>
                                      <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 font-black text-slate-900 dark:text-white whitespace-nowrap bg-slate-50/50 dark:bg-white/5">{item.student_name}</td>
                                      {selectedClass?.id === 'all' && (
                                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 text-slate-900 dark:text-slate-100 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                                          {item.class_name || '-'}
                                        </td>
                                      )}
                                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center text-slate-950 dark:text-slate-50 font-black bg-slate-200/40 dark:bg-slate-800/60">{item.total_days}</td>
                                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full font-black text-xs min-w-[32px] bg-emerald-600 text-white dark:bg-emerald-950/50 dark:text-emerald-400 dark:border dark:border-emerald-800">
                                          {item.present_days}
                                        </span>
                                      </td>
                                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full font-black text-xs min-w-[32px] bg-red-600 text-white dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800">
                                          {item.absent_days}
                                        </span>
                                      </td>
                                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full font-black text-xs min-w-[32px] bg-amber-600 text-white dark:bg-amber-950/50 dark:text-amber-400 dark:border dark:border-amber-800">
                                          {item.late_days}
                                        </span>
                                      </td>
                                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full font-black text-xs min-w-[32px] bg-indigo-600 text-white dark:bg-indigo-950/50 dark:text-indigo-400 dark:border dark:border-indigo-800">
                                          {item.leave_days}
                                        </span>
                                      </td>
                                      <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                          <div className="w-12 sm:w-16 h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 hidden sm:block">
                                            <div
                                              className={`h-full transition-all duration-500 ${item.pct >= 90 ? 'bg-emerald-500' : item.pct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                                              style={{ width: `${item.pct}%` }}
                                            />
                                          </div>
                                          <span className={`inline-flex items-center justify-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-black text-xs min-w-[44px] ${
                                            item.pct >= 90 
                                              ? 'bg-emerald-600 text-white dark:bg-emerald-950/50 dark:text-emerald-400 dark:border dark:border-emerald-800' 
                                              : item.pct >= 75 
                                                ? 'bg-amber-600 text-white dark:bg-amber-950/50 dark:text-amber-400 dark:border dark:border-amber-800' 
                                                : 'bg-red-600 text-white dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800'
                                          }`}>
                                            {item.pct}%
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                          {filteredReportData.map((item) => {
                            const rankLabel = getRankBadgeLabel(item.rank, lang);
                            const isTop3 = item.rank <= 3;
                            return (
                              <div key={item.student_id} className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border shadow-bubble space-y-2.5 sm:space-y-3 relative group transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                                  <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                          <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black border shadow-inner shrink-0 text-xs sm:text-base ${isDark ? 'bg-slate-900 text-[#A179FF] border-slate-700' : 'bg-slate-50 text-[#A179FF] border-slate-100'}`}>#{item.roll || '-'}</div>
                                          <div className="min-w-0">
                                              <h5 className={`font-black font-noto text-xs sm:text-[16px] truncate leading-tight mb-0.5 ${isDark ? 'text-slate-100' : 'text-[#2E0B5E]'}`}>{item.student_name}</h5>
                                              {selectedClass?.id === 'all' && (
                                                <p className="text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider truncate">{item.class_name}</p>
                                              )}
                                              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'উপস্থিতির তথ্য' : 'Attendance Status'}</p>
                                          </div>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0 gap-0.5 sm:gap-1">
                                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] sm:text-[11px] shadow-sm ${
                                            item.rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200' :
                                            item.rank === 2 ? 'bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200' :
                                            item.rank === 3 ? 'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/60 dark:text-orange-200' :
                                            'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                          }`}>
                                            {isTop3 && <Trophy size={11} className={item.rank === 1 ? 'text-amber-600' : item.rank === 2 ? 'text-slate-500' : 'text-orange-600'} />}
                                            {rankLabel} {lang === 'bn' ? 'মেধা' : 'Rank'}
                                          </span>
                                          <div className={`text-lg sm:text-xl font-black ${item.pct >= 90 ? 'text-emerald-500' : item.pct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>{item.pct}%</div>
                                      </div>
                                  </div>
                                  <div className={`w-full h-1.5 sm:h-2 rounded-full overflow-hidden border flex shadow-inner ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                      <div className={`h-full transition-all duration-1000 ${item.pct >= 90 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : item.pct >= 75 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`} style={{ width: `${item.pct}%` }}></div>
                                  </div>
                                  <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                                     <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/50 border-slate-100'}`}><p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase mb-0.5 truncate">{lang === 'bn' ? 'মোট' : 'Total'}</p><p className={`font-black text-[11px] sm:text-xs ${isDark ? 'text-slate-100' : 'text-[#2E0B5E]'}`}>{item.total_days}</p></div>
                                     <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center border ${isDark ? 'bg-emerald-900/10 border-emerald-900/20' : 'bg-emerald-50/50 border-emerald-50'}`}><p className="text-[7px] sm:text-[8px] font-black text-emerald-500 uppercase mb-0.5 truncate">{t('mark_present', lang, madrasah?.institution_type)}</p><p className="font-black text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs">{item.present_days}</p></div>
                                     <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center border ${isDark ? 'bg-red-900/10 border-red-900/20' : 'bg-red-50/50 border-red-50'}`}><p className="text-[7px] sm:text-[8px] font-black text-red-500 uppercase mb-0.5 truncate">{t('mark_absent', lang, madrasah?.institution_type)}</p><p className="font-black text-red-600 dark:text-red-400 text-[11px] sm:text-xs">{item.absent_days}</p></div>
                                     <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center border ${isDark ? 'bg-amber-900/10 border-amber-900/20' : 'bg-amber-50/50 border-amber-50'}`}>
                                        <p className="text-[7px] sm:text-[8px] font-black text-amber-500 uppercase mb-0.5 truncate">{t('mark_late', lang, madrasah?.institution_type)}</p>
                                        <p className="font-black text-amber-600 dark:text-amber-400 text-[11px] sm:text-xs">{item.late_days}</p>
                                     </div>
                                     <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center border ${isDark ? 'bg-indigo-900/10 border-indigo-900/20' : 'bg-indigo-50/50 border-indigo-50'}`}>
                                        <p className="text-[7px] sm:text-[8px] font-black text-indigo-500 uppercase mb-0.5 truncate">{t('mark_leave', lang, madrasah?.institution_type)}</p>
                                        <p className="font-black text-indigo-600 dark:text-indigo-400 text-[11px] sm:text-xs">{item.leave_days}</p>
                                     </div>
                                  </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                          <FileText size={40} className="text-slate-400/20 mb-4" />
                          <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">{lang === 'bn' ? 'কোনো তথ্য পাওয়া যায়নি' : 'No Records Found'}</p>
                       </div>
                    )}
                </div>
              )}
              </div>
            )}
          </>
      )}
      


      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 pt-10 sm:pt-6 animate-in fade-in duration-300">
          <div className={`rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[75vh] sm:max-h-[85vh] flex flex-col overflow-hidden border-4 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800 shadow-blue-500/10' : 'bg-white border-white shadow-slate-200/50'}`}>
            <div className={`p-6 sm:p-8 border-b flex justify-between items-center relative overflow-hidden shrink-0 ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
              <div className="absolute top-0 left-0 w-1 h-full bg-[#2563EB]"></div>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-slate-900 text-blue-400' : 'bg-white text-blue-600'}`}>
                  <Settings size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {lang === 'bn' ? 'হাজিরা সেটিংস' : 'Attendance Settings'}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configure your sessions</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)} 
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-slate-900 text-slate-400 hover:text-red-400 hover:bg-red-900/20' : 'bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-100'}`}
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto flex-1 no-scrollbar">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Class for Sessions</label>
                  <div className="flex gap-2">
                    <select
                      value={settingsClassId}
                      onChange={(e) => setSettingsClassId(e.target.value)}
                      className={`flex-1 h-14 px-6 border-2 rounded-2xl font-black outline-none transition-all text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500/30'}`}
                    >
                      <option value="global">Global (All Classes)</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.class_name}</option>
                      ))}
                    </select>
                    {settingsClassId !== 'global' && (
                      <button 
                        onClick={() => {
                          const settings = madrasah?.config_json?.attendance_settings || {};
                          setSettingsSessions(settings.sessions || []);
                          setStartTime(settings.start_time || '08:00');
                          setEndTime(settings.end_time || '14:00');
                          setHalfDayTime(settings.half_day_time || '12:00');
                          setFullDayTime(settings.full_day_time || '14:00');
                        }}
                        title="Copy Global Settings"
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-blue-600 border-blue-100'}`}
                      >
                        <RefreshCw size={20} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'শুরুর সময়' : 'Start Time'}</label>
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={`w-full h-14 px-4 border-2 rounded-2xl font-black outline-none transition-all text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500/30'}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'ছুটির সময়' : 'End Time'}</label>
                    <input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={`w-full h-14 px-4 border-2 rounded-2xl font-black outline-none transition-all text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500/30'}`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between px-1 mt-6">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {settingsClassId === 'global' ? 'Global Sessions' : `${classes.find(c => c.id === settingsClassId)?.class_name} Sessions`}
                  </label>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {settingsSessions.length} Active
                  </span>
                </div>
                
                <div className="flex gap-3 group">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      placeholder={lang === 'bn' ? 'সেশনের নাম (উদা: সকাল)' : 'Session Name (e.g. Morning)'}
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSession();
                        }
                      }}
                      className={`w-full h-14 px-6 border-2 rounded-2xl font-black outline-none transition-all text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50 focus:bg-slate-800' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-blue-500/30 focus:bg-white focus:shadow-lg focus:shadow-blue-500/5'}`}
                    />
                  </div>
                  <button 
                    onClick={addSession}
                    className="w-14 h-14 bg-[#2563EB] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 hover:scale-105 transition-all shrink-0"
                  >
                    <Plus size={28} strokeWidth={3} />
                  </button>
                </div>

                <div className={`space-y-3 rounded-3xl p-2 -mx-2 ${isDark ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
                  {settingsSessions.length > 0 ? settingsSessions.map((s, idx) => (
                    <div 
                      key={s.id} 
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all animate-in slide-in-from-right-4 duration-300`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400 shadow-sm'}`}>
                          {idx + 1}
                        </div>
                        <span className={`font-black text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.name}</span>
                      </div>
                      <button 
                        onClick={() => removeSession(s.id)} 
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isDark ? 'bg-red-500/10 text-red-400 active:bg-red-500/20' : 'bg-red-50 text-red-500 active:bg-red-100'}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                        <Clock size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">No sessions added</p>
                      <p className="text-[10px] text-slate-400/60 font-bold mt-1 italic">Defaulting to "Daily" attendance</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`p-6 sm:p-8 border-t flex gap-4 shrink-0 ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className={`flex-1 h-14 font-black rounded-2xl border-2 active:scale-95 transition-all text-xs uppercase tracking-widest ${isDark ? 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex-1 h-14 bg-[#2563EB] text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 hover:shadow-xl hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {savingSettings ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} strokeWidth={2.5} /> {lang === 'bn' ? 'সেভ করুন' : 'Save Changes'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 animate-in zoom-in-95 duration-500 p-10 text-center relative ${isDark ? 'bg-slate-900 border-slate-800 shadow-emerald-500/10' : 'bg-white border-white shadow-emerald-200/50'}`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            
            <div className="relative">
              <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-[2rem] animate-ping duration-1000"></div>
                <CheckCircle2 size={48} strokeWidth={3} className="relative z-10" />
              </div>
              
              <h2 className={`text-3xl font-black mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {successTitle}
              </h2>
              
              <p className={`text-sm font-bold leading-relaxed px-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {successMessage}
              </p>
              
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="mt-10 w-full h-16 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 hover:scale-[1.02] transition-all text-sm uppercase tracking-[0.2em]"
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'Awesome'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && confirmData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 animate-in zoom-in-95 duration-500 p-10 text-center relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-white'}`}>
            <div className={`absolute top-0 left-0 w-full h-2 bg-${confirmData.color === 'emerald' ? 'emerald' : confirmData.color === 'amber' ? 'amber' : 'blue'}-500`}></div>
            
            <div className="relative">
              <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative ${
                confirmData.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600' : 
                confirmData.color === 'amber' ? 'bg-amber-500/10 text-amber-600' : 
                'bg-blue-500/10 text-blue-600'
              }`}>
                {confirmData.icon === 'sms' && <Send size={48} strokeWidth={3} />}
                {confirmData.icon === 'voice' && <MessageSquare size={48} strokeWidth={3} />}
                {confirmData.icon === 'alert' && <AlertTriangle size={48} strokeWidth={3} />}
              </div>
              
              <h2 className={`text-2xl font-black mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {confirmData.title}
              </h2>
              
              <p className={`text-sm font-bold leading-relaxed px-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {confirmData.message}
              </p>
              
              <div className="mt-10 flex flex-col gap-3">
                <button 
                  onClick={confirmData.action}
                  className={`w-full h-16 text-white font-black rounded-2xl shadow-lg active:scale-95 hover:scale-[1.02] transition-all text-sm uppercase tracking-[0.2em] ${
                    confirmData.color === 'emerald' ? 'bg-emerald-500 shadow-emerald-500/30' : 
                    confirmData.color === 'amber' ? 'bg-amber-500 shadow-amber-500/30' : 
                    'bg-[#2563EB] shadow-blue-500/30'
                  }`}
                >
                  {lang === 'bn' ? 'হ্যাঁ, পাঠান' : 'Yes, Send'}
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className={`w-full h-14 font-black rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                >
                  {lang === 'bn' ? 'না, বাতিল' : 'No, Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showErrorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 animate-in zoom-in-95 duration-500 p-10 text-center relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-white'}`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
            
            <div className="relative">
              <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
                <AlertCircle size={48} strokeWidth={3} />
              </div>
              
              <h2 className={`text-2xl font-black mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {errorTitle}
              </h2>
              
              <p className={`text-sm font-bold leading-relaxed px-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {errorDetails}
              </p>
              
              <button 
                onClick={() => setShowErrorModal(false)}
                className="mt-10 w-full h-16 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/30 active:scale-95 hover:scale-[1.02] transition-all text-sm uppercase tracking-[0.2em]"
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'Understood'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
