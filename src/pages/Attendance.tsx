
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, smsApi } from 'supabase';
import { Institution, Class, Student, Language, Attendance as AttendanceType, Profile } from 'types';
import { ClipboardList, Users, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, ChevronDown, Save, Calendar, BarChart3, Send, AlertTriangle, FileText, CheckCircle2, AlertCircle, RefreshCw, Settings, TrendingDown, Info, Plus, Trash2, MessageSquare, Download } from 'lucide-react';
import { getBengaliDate, getHijriDate, getEventsForDate } from '../utils/calendarUtils';
import { sortMadrasahClasses } from 'pages/Classes';
import { t } from 'translations';
import { useOfflineStatus } from 'hooks/useOffline';
import { CacheService } from 'services/cacheService';
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
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'half_day'>>({});
  const [arrivalTime, setArrivalTime] = useState<Record<string, string>>({});
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [reportView, setReportView] = useState<'list' | 'analytics'>('list');
  const [selectedYear, setSelectedYear] = useState(activeYear?.start_date ? activeYear.start_date.slice(0, 4) : new Date().getFullYear().toString());
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<any[]>([]);
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
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = useState<string>('default');
  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);
  const [selectedVoiceTemplateId, setSelectedVoiceTemplateId] = useState<string>('');
  const [showSmsTemplateDropdown, setShowSmsTemplateDropdown] = useState(false);
  const [showVoiceTemplateDropdown, setShowVoiceTemplateDropdown] = useState(false);
  const [sendingVoiceAlerts, setSendingVoiceAlerts] = useState(false);
  const [walletBalance, setWalletBalance] = useState(madrasah?.balance || 0);
  const [voiceRate, setVoiceRate] = useState(madrasah?.voice_rate || 0.50);

  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },
  ];

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
      fetchSmsTemplates();
      fetchVoiceTemplates();
      setWalletBalance(madrasah.balance || 0);
      setVoiceRate(madrasah.voice_rate || 0.50);
    }
  }, [madrasah?.id]);

  const fetchSmsTemplates = async () => {
    if (!madrasah) return;
    const { data } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('institution_id', madrasah.id)
      .order('created_at', { ascending: false });
    if (data) setSmsTemplates(data);
  };

  const fetchVoiceTemplates = async () => {
    if (!madrasah) return;
    const { data } = await supabase
      .from('voice_templates')
      .select('*')
      .eq('institution_id', madrasah.id)
      .eq('provider_status', 'approved')
      .order('created_at', { ascending: false });
    if (data) setVoiceTemplates(data);
  };

  useEffect(() => {
    if (selectedClass && madrasah) {
      if (activeTab === 'daily') {
        fetchStudents(selectedClass.id);
        fetchDayEvents();
      }
      else fetchReport(selectedClass.id);
    }
  }, [selectedClass?.id, activeTab, date, selectedSession, selectedMonth, reportType, selectedYear, madrasah?.id]);

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
      } else {
        const classSessions = settings.class_sessions?.[settingsClassId];
        setSettingsSessions(classSessions || []);
      }
    }
  }, [settingsClassId, madrasah?.config_json]);

  const fetchDayEvents = async () => {
    if (!madrasah) return;
    try {
      const { data: customEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('event_date', date);
      
      let events = getEventsForDate(new Date(date), customEvents || []);
      
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
      
      const holiday = events.length > 0;
      setIsHoliday(holiday);
    } catch (e) {
      console.error('Error fetching day events:', e);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah?.id);
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
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
      
      // Use exact same query structure as Students.tsx
      let studentQuery = supabase.from('students')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('class_id', cid)
        .order('roll', { ascending: true });
      
      if (activeYearId) {
        studentQuery = studentQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }
      
      const { data: stdData, error: stdError } = await studentQuery;
      if (stdError) throw stdError;
      
      let finalStdData = stdData || [];
      
      // Fallback: if no students found with activeYearId, try fetching without it
      if (finalStdData.length === 0 && activeYearId) {
        const { data: fallbackData } = await supabase.from('students')
          .select('*')
          .eq('institution_id', madrasah.id)
          .eq('class_id', cid)
          .order('roll', { ascending: true });
        if (fallbackData && fallbackData.length > 0) {
          finalStdData = fallbackData;
        }
      }
      
      // Also fetch attendance with institution_id and session
      let attQuery = supabase.from('attendance')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('class_id', cid)
        .eq('date', date)
        .eq('session', selectedSession);
        
      const { data: attData, error: attError } = await attQuery;
      if (attError) {
        console.error('Attendance fetch error (skipping academic_year_id):', attError);
        // If it's a column missing error, we still want to proceed with empty attendance
      }

      if (finalStdData) {
        setStudents(finalStdData);
        const initial: Record<string, 'present' | 'absent' | 'late' | 'half_day'> = {};
        const initialArrival: Record<string, string> = {};
        
        finalStdData.forEach(s => {
          const existing = attData?.find(a => a.student_id === s.id);
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
        const cachedReport = await CacheService.getCachedData('attendance', madrasah?.id || '');
        // Filter cached report by class and date range
        // For simplicity, we just set the cached data if it matches the class
        const filtered = cachedReport.filter(r => r.class_id === cid);
        setReportData(filtered);
        setLoading(false);
        return;
      }

      let startDate, endDate;

      if (reportType === 'monthly') {
          startDate = `${selectedMonth}-01`;
          endDate = new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString().split('T')[0];
      } else {
          startDate = `${selectedYear}-01-01`;
          endDate = `${selectedYear}-12-31`;
      }

      const { data, error } = await supabase.rpc('get_attendance_report', {
        p_class_id: cid,
        p_start_date: startDate,
        p_end_date: endDate,
        p_session: selectedSession === 'all' ? null : selectedSession
      });

      if (error) throw error;
      if (data) {
        setReportData(data);
        await CacheService.cacheData('attendance', madrasah?.id || '', data);
      }
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const computeLateMins = (arrTime: string | null | undefined) => {
    const sTime = madrasah?.config_json?.attendance_settings?.start_time || '08:00';
    if (!arrTime || !sTime) return 0;
    const [sh, sm] = sTime.split(':').map(Number);
    const [lh, lm] = arrTime.split(':').map(Number);
    const mins = (lh * 60 + lm) - (sh * 60 + sm);
    return mins > 0 ? mins : 0;
  };

  const setStatus = (sid: string, status: 'present' | 'absent' | 'late' | 'half_day') => {
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
    if (!madrasah || !selectedClass) return;
    setSaving(true);
    try {
      const activeYearId = madrasah.config_json?.active_academic_year_id;
      // Clean delete for sync - now including session
      let delQuery = supabase.from('attendance')
        .delete()
        .eq('class_id', selectedClass.id)
        .eq('date', date)
        .eq('session', selectedSession);
      const { error: delError } = await delQuery;
      if (delError) throw delError;

      const payload = Object.entries(attendance).map(([sid, status]) => ({
        institution_id: madrasah.id,
        class_id: selectedClass.id,
        student_id: sid,
        status: status,
        date: date,
        session: selectedSession,
        arrival_time: status === 'late' ? arrivalTime[sid] : null,
        late_minutes: status === 'late' ? computeLateMins(arrivalTime[sid]) : null,
        recorded_by: userId,
        academic_year_id: activeYearId || null
      }));

      const { error } = await supabase.from('attendance').insert(payload);
      if (error) {
        if (error.message.includes('class_id') || error.message.includes('cache')) {
          throw new Error('ডাটাবেস কলাম (class_id) খুঁজে পাওয়া যাচ্ছে না। দয়া করে SQL এডিটর থেকে নতুন মাইগ্রেশন কোডটি রান করুন।');
        }
        throw error;
      }
      setSuccessTitle(lang === 'bn' ? 'সফল হয়েছে!' : 'Success!');
      setSuccessMessage(lang === 'bn' ? 'হাজিরা সফলভাবে ডাটাবেসে সংরক্ষিত হয়েছে।' : 'Attendance has been successfully saved to the database.');
      setShowSuccessModal(true);
    } catch (err: any) { 
      setErrorTitle(lang === 'bn' ? 'হাজিরা সংরক্ষণ ব্যর্থ' : 'Save Failed');
      setErrorDetails(err.message);
      setShowErrorModal(true);
    } finally { 
      setSaving(false); 
    }
  };

  const sendAbsentAlerts = async () => {
    if (!madrasah || !selectedClass) return;
    
    const absents = students.filter(s => attendance[s.id] === 'absent');
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
        setSendingAlerts(true);
        setShowConfirmModal(false);
        try {
          let message = '';
          if (selectedSmsTemplateId === 'default') {
            message = lang === 'bn' 
              ? `আস-সালামু আলাইকুম, {student_name} আজ মাদরাসায় অনুপস্থিত। অনুগ্রহ করে অনুপস্থিতির কারণ জানান।`
              : `As-Salamu Alaikum, {student_name} is absent today. Please inform us of the reason.`;
          } else {
            const template = smsTemplates.find(t => t.id === selectedSmsTemplateId);
            message = template?.body || '';
          }

          if (!message.trim()) {
            throw new Error(lang === 'bn' ? 'এসএমএস টেমপ্লেট নির্বাচন করুন অথবা একটি মেসেজ লিখুন' : 'Please select an SMS template or write a message');
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
          setSendingAlerts(false); 
        }
      }
    });
    setShowConfirmModal(true);
  };

  const sendAbsentVoiceAlerts = async () => {
    if (!madrasah || !selectedClass) return;
    
    if (!selectedVoiceTemplateId) {
      setErrorTitle(lang === 'bn' ? 'ভয়েস নির্বাচন করুন' : 'Select Voice');
      setErrorDetails(lang === 'bn' ? 'অনুগ্রহ করে একটি ভয়েস টেমপ্লেট নির্বাচন করুন' : 'Please select a voice template to continue.');
      setShowErrorModal(true);
      return;
    }

    const absents = students.filter(s => attendance[s.id] === 'absent');
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
          const { data: instData } = await supabase.from('institutions').select('voice_sender_id').eq('id', madrasah.id).single();
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

          if (!sNumber) throw new Error('No voice sender ID configured');

          // Ensure sender is in 8801... format if it is a mobile number
          sNumber = sNumber.toString();
          const sDigits = sNumber.replace(/[^0-9]/g, '');
          if (sDigits.length === 11 && sDigits.startsWith('01')) {
            sNumber = '88' + sDigits;
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
            target_class_name: selectedClass?.class_name || 'Attendance Class',
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
      
      if (settingsClassId === 'global') {
        currentSettings.sessions = settingsSessions;
      } else {
        classSessions[settingsClassId] = settingsSessions;
        currentSettings.class_sessions = classSessions;
      }

      const updatedConfig = {
        ...madrasah.config_json,
        attendance_settings: {
          ...currentSettings,
          start_time: startTime,
          end_time: endTime,
          half_day_time: halfDayTime,
          full_day_time: fullDayTime,
        }
      };
      
      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);
        
      if (error) throw error;
      
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
    try {
        const monthLabel = reportType === 'monthly' ? new Date(selectedMonth).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' }) : '';
        await generateAttendanceReportPDF(reportData, madrasah, selectedClass.class_name, monthLabel, lang);
    } catch (err: any) {
        console.error('Failed to generate PDF:', err);
    } finally {
        setDownloadingReport(false);
    }
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-20 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
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
        <div className={activeTab === 'daily' ? "grid grid-cols-2 gap-3" : "space-y-4"}>
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('class_select', lang)}</label>
            <button onClick={() => setShowClassDropdown(!showClassDropdown)} className={`w-full h-14 px-4 rounded-2xl border-2 flex items-center justify-between group active:scale-[0.99] transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
              <span className="font-black font-noto truncate text-sm">{selectedClass?.class_name || t('class_choose', lang)}</span>
              <ChevronDown size={18} className="text-slate-300 transition-transform duration-300 group-focus:rotate-180" />
            </button>
            {showClassDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2rem] shadow-bubble border z-[100] p-2 max-h-56 overflow-y-auto animate-in slide-in-from-top-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">বেলা/সেশন</label>
              <div className={`flex flex-wrap p-1.5 rounded-2xl border-2 shadow-inner gap-1 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {sessions.length > 0 ? sessions.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setSelectedSession(s.id)} 
                    className={`flex-1 min-w-[80px] py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSession === s.id ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {s.name}
                  </button>
                )) : (
                  <button 
                    onClick={() => setSelectedSession('daily')} 
                    className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSession === 'daily' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    দৈনিক
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
            <div className="space-y-4 animate-in fade-in">
                <div className={`flex p-1 rounded-xl border transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <button onClick={() => setReportType('monthly')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'monthly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>মাসিক</button>
                    <button onClick={() => setReportType('yearly')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'yearly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>বাৎসরিক</button>
                </div>
                
                <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                        সেশন নির্বাচন করুন
                    </label>
                    <div className={`flex flex-wrap p-1 rounded-xl border transition-all gap-1 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <button onClick={() => setSelectedSession('all')} className={`flex-1 min-w-[60px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedSession === 'all' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>সব</button>
                        {sessions.length > 0 ? sessions.map(s => (
                          <button key={s.id} onClick={() => setSelectedSession(s.id)} className={`flex-1 min-w-[60px] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedSession === s.id ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>{s.name}</button>
                        )) : (
                          <button onClick={() => setSelectedSession('daily')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedSession === 'daily' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>দৈনিক</button>
                        )}
                    </div>
                </div>
                
                <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                        {reportType === 'monthly' ? 'মাস নির্বাচন করুন' : 'বছর নির্বাচন করুন'}
                    </label>
                    {reportType === 'monthly' ? (
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
                                {(activeYear ? 
                                  Array.from({ length: parseInt(activeYear.end_date.slice(0, 4)) - parseInt(activeYear.start_date.slice(0, 4)) + 1 }, (_, i) => parseInt(activeYear.start_date.slice(0, 4)) + i) :
                                  Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
                                ).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
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
                     <div key={s.id} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-11 h-11 rounded-[1.1rem] flex flex-col items-center justify-center border shrink-0 shadow-inner ${isDark ? 'bg-slate-900 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
                            <span className="text-[8px] font-black opacity-40 leading-none">ROLL</span>
                            <span className="text-base font-black leading-none mt-1">{s.roll || '-'}</span>
                          </div>
                          <div>
                            <h5 className={`font-black font-noto text-sm ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{s.student_name}</h5>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 items-start">
                           <button onClick={() => setStatus(s.id, 'present')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'present' ? 'bg-emerald-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Present"><CheckCircle size={20}/></button>
                           <button onClick={() => setStatus(s.id, 'absent')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Absent"><XCircle size={20}/></button>
                           <div className="flex flex-col items-center">
                             <button onClick={() => setStatus(s.id, 'late')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'late' ? 'bg-amber-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Late">
                                {attendance[s.id] === 'late' ? (
                                 <span className="text-base font-black">{computeLateMins(arrivalTime[s.id])}</span>
                                ) : <Clock size={20}/>}
                             </button>
                             {attendance[s.id] === 'late' && (
                               <span className="text-[8px] font-black uppercase tracking-wider text-amber-500 mt-1 whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                                 {lang === 'bn' ? 'মিনিট' : 'MIN'}
                               </span>
                             )}
                           </div>
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
                                                {selectedSmsTemplateId === 'default' ? (lang === 'bn' ? 'ডিফল্ট' : 'Default') : (smsTemplates.find(t => t.id === selectedSmsTemplateId)?.title || (lang === 'bn' ? 'নির্বাচন' : 'Select'))}
                                            </span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform duration-300 ${showSmsTemplateDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showSmsTemplateDropdown && (
                                            <div className={`absolute bottom-full right-0 mb-3 w-64 p-2 rounded-[1.5rem] shadow-xl border z-[110] max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                <button 
                                                    onClick={() => { setSelectedSmsTemplateId('default'); setShowSmsTemplateDropdown(false); }}
                                                    className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold mb-1 transition-all ${selectedSmsTemplateId === 'default' ? (isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-600 text-white') : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}
                                                >
                                                    {lang === 'bn' ? 'ডিফল্ট টেমপ্লেট' : 'Default Template'}
                                                </button>
                                                {smsTemplates.map(t => (
                                                    <button 
                                                        key={t.id}
                                                        onClick={() => { setSelectedSmsTemplateId(t.id); setShowSmsTemplateDropdown(false); }}
                                                        className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold mb-1 transition-all ${selectedSmsTemplateId === t.id ? (isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-600 text-white') : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')}`}
                                                    >
                                                        {t.title}
                                                    </button>
                                                ))}
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
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <div className="flex flex-1 gap-2 min-w-[200px]">
                      <button onClick={() => setReportView('list')} className={`flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${reportView === 'list' ? 'bg-[#2563EB] text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>List View</button>
                      <button onClick={() => setReportView('analytics')} className={`flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${reportView === 'analytics' ? 'bg-[#2563EB] text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Analytics</button>
                  </div>
                  {reportData.length > 0 && selectedClass && (
                    <button 
                      onClick={handleDownloadReportPDF} 
                      disabled={downloadingReport}
                      className={`h-12 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
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
                          Attendance Overview
                        </h3>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.map(d => ({ name: d.roll || d.student_name.substring(0, 5), Present: d.present_days, Absent: d.absent_days, Late: d.late_days || 0 }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <Tooltip cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                              <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                              <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                              <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          <TrendingDown className="text-red-500" size={18} />
                          Most Absent Students
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
                                <p className="font-black text-red-500">{student.absent_days} Days</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Absent</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                      <BarChart3 size={40} className="text-slate-400/20 mb-4" />
                      <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">No Data for Analytics</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 animate-in slide-in-from-bottom-5">
                    {reportData.length > 0 ? reportData.map((item: any) => {
                        const late = item.late_days || 0;
                        const pct = item.total_days > 0 ? Math.round(((item.present_days + late) / item.total_days) * 100) : 0;
                        
                        return (
                            <div key={item.student_id} className={`p-6 rounded-[2.5rem] border shadow-lg space-y-4 group ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/95 border-white'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black border shadow-inner shrink-0 ${isDark ? 'bg-slate-900 text-[#A179FF] border-slate-700' : 'bg-slate-50 text-[#A179FF] border-slate-100'}`}>#{item.roll || '-'}</div>
                                        <div className="min-w-0">
                                            <h5 className={`font-black font-noto text-[17px] truncate leading-tight mb-0.5 ${isDark ? 'text-slate-100' : 'text-[#2E0B5E]'}`}>{item.student_name}</h5>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</p>
                                        </div>
                                    </div>
                                    <div className={`text-2xl font-black ${pct >= 90 ? 'text-green-500' : pct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</div>
                                </div>
                                <div className={`w-full h-3 rounded-full overflow-hidden border flex shadow-inner ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${pct}%` }}></div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/50 border-slate-50'}`}><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Total</p><p className={`font-black text-sm ${isDark ? 'text-slate-100' : 'text-[#2E0B5E]'}`}>{item.total_days}</p></div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-green-900/10 border-green-900/20' : 'bg-green-50/50 border-green-50'}`}><p className="text-[8px] font-black text-green-400 uppercase mb-0.5">Present</p><p className="font-black text-green-600 text-sm">{item.present_days}</p></div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-red-900/10 border-red-900/20' : 'bg-red-50/50 border-red-50'}`}><p className="text-[8px] font-black text-red-400 uppercase mb-0.5">Absent</p><p className="font-black text-red-600 text-sm">{item.absent_days}</p></div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-amber-900/10 border-amber-900/20' : 'bg-amber-50/50 border-amber-50'}`}>
                                      <p className="text-[8px] font-black text-amber-400 uppercase mb-0.5">Late</p>
                                      <p className="font-black text-amber-600 text-sm">{late}</p>
                                   </div>
                                </div>
                            </div>
                        );
                    }) : <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                            <FileText size={40} className="text-slate-400/20 mb-4" />
                            <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">No Attendance Records</p>
                         </div>}
                </div>
              )}
              </div>
            )}
          </>
      )}
      


      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border-4 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800 shadow-blue-500/10' : 'bg-white border-white shadow-slate-200/50'}`}>
            <div className={`p-8 border-b flex justify-between items-center relative overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
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

            <div className="p-8 space-y-8">
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
                          const globalSessions = madrasah?.config_json?.attendance_settings?.sessions || [];
                          setSettingsSessions(globalSessions);
                        }}
                        title="Copy Global Sessions"
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

                <div className={`space-y-3 max-h-[280px] overflow-y-auto pr-2 scrollbar-hide rounded-3xl p-2 -mx-2 ${isDark ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
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

            <div className={`p-8 border-t flex gap-4 ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
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
