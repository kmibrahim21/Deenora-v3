
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Loader2, CheckCircle2, Table, AlertTriangle, FileUp, FileSpreadsheet, FileText, Database, Mail, Copy, Check, Settings, Globe, ExternalLink, RefreshCw, Key, Info } from 'lucide-react';
import { supabase } from 'supabase';
import { requestManager } from 'services/RequestManager';
import { Institution, Language } from 'types';
import * as XLSX from 'xlsx';
import { generateStudentListPDF } from 'utils/pdfGenerator';
import { 
  initAuth, 
  googleSignIn, 
  googleSignInRedirect,
  googleSignInDirectRedirect,
  getFriendlyAuthErrorMessage,
  logoutGoogle, 
  encryptData, 
  decryptData, 
  findOrCreateDeenoraFolder, 
  listBackups, 
  uploadBackupToDrive, 
  downloadBackupFromDrive, 
  deleteBackupFromDrive,
  GoogleDriveUser,
  getGoogleClientId,
  setCustomGoogleClientId,
  signInWithGis
} from 'services/googleDriveBackup';


interface DataManagementProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  triggerRefresh: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ lang, madrasah, onBack, triggerRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [skippedDetails, setSkippedDetails] = useState<Array<{ row: number; name: string; class: string; reason: string }>>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [gmailAddress, setGmailAddress] = useState(madrasah?.contact_email || madrasah?.email || '');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');

  // Google Drive Backup & Restore State
  const [googleUser, setGoogleUser] = useState<GoogleDriveUser | null>(null);
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [gdriveBackups, setGdriveBackups] = useState<any[]>([]);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveActionLoading, setGdriveActionLoading] = useState(false);
  const [showRedirectOption, setShowRedirectOption] = useState<boolean>(false);
  const [showGdriveConfig, setShowGdriveConfig] = useState<boolean>(false);
  const [customClientIdInput, setCustomClientIdInput] = useState<string>(() => getGoogleClientId());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldId: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  // Load Google Drive backups once token is available
  const loadGDriveBackups = async (token: string) => {
    setGdriveLoading(true);
    try {
      const folderId = await findOrCreateDeenoraFolder(token);
      const list = await listBackups(token, folderId);
      setGdriveBackups(list);
      // Cache files metadata locally for instant loading on page refresh
      localStorage.setItem('deenora_gdrive_backups_cache', JSON.stringify(list));
    } catch (err: any) {
      console.error('Error loading Google Drive backups:', err);
    } finally {
      setGdriveLoading(false);
    }
  };

  useEffect(() => {
    // Load local metadata cache instantly on component mount
    const cached = localStorage.getItem('deenora_gdrive_backups_cache');
    if (cached) {
      try {
        setGdriveBackups(JSON.parse(cached));
      } catch (e) {
        console.error('Error parsing backup cache:', e);
      }
    }

    // Listen to Google OAuth status
    const unsubscribe = initAuth((user, token) => {
      if (user) {
        setGoogleUser(user);
        setGdriveToken(token);
        if (token) {
          loadGDriveBackups(token);
        }
      } else {
        setGoogleUser(null);
        setGdriveToken(null);
        setGdriveBackups([]);
        localStorage.removeItem('deenora_gdrive_backups_cache');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleConnect = async () => {
    setGdriveLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGdriveToken(res.accessToken);
        setShowRedirectOption(false);
        await loadGDriveBackups(res.accessToken);
        setStatus({
          type: 'success',
          message: lang === 'bn' 
            ? 'গুগল অ্যাকাউন্ট সফলভাবে যুক্ত করা হয়েছে!' 
            : 'Google account successfully connected!'
        });
      }
    } catch (err: any) {
      console.error('Google connect error:', err);
      const friendly = getFriendlyAuthErrorMessage(err, lang);
      if (friendly.isPopupBlockedOrClosed) {
        setShowRedirectOption(true);
      }
      setStatus({
        type: 'error',
        message: friendly.message
      });
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleGoogleConnectRedirect = async () => {
    setGdriveLoading(true);
    try {
      await googleSignInRedirect();
    } catch (err: any) {
      console.error('Google connect redirect error:', err);
      const friendly = getFriendlyAuthErrorMessage(err, lang);
      setStatus({
        type: 'error',
        message: friendly.message
      });
      setGdriveLoading(false);
    }
  };

  const handleGoogleConnectGis = async () => {
    setGdriveLoading(true);
    try {
      const res = await signInWithGis();
      if (res) {
        setGoogleUser(res.user);
        setGdriveToken(res.accessToken);
        setShowRedirectOption(false);
        await loadGDriveBackups(res.accessToken);
        setStatus({
          type: 'success',
          message: lang === 'bn' 
            ? 'গুগল ড্রাইভ সফলভাবে যুক্ত হয়েছে (GIS)!' 
            : 'Google Drive successfully connected via GIS!'
        });
      }
    } catch (err: any) {
      console.error('GIS connect error:', err);
      const friendly = getFriendlyAuthErrorMessage(err, lang);
      setStatus({
        type: 'error',
        message: friendly.message
      });
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm(lang === 'bn' ? 'আপনি কি গুগল অ্যাকাউন্ট ডিসকানেক্ট করতে চান?' : 'Are you sure you want to disconnect Google account?')) {
      return;
    }
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setGdriveToken(null);
      setGdriveBackups([]);
      localStorage.removeItem('deenora_gdrive_backups_cache');
      setStatus({
        type: 'success',
        message: lang === 'bn' ? 'গুগল অ্যাকাউন্ট ডিসকানেক্ট করা হয়েছে।' : 'Google account disconnected.'
      });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleBackupToGoogleDrive = async () => {
    if (!madrasah) return;
    
    let activeToken = gdriveToken;
    if (!activeToken) {
      setGdriveActionLoading(true);
      try {
        const res = await googleSignIn();
        if (res) {
          setGoogleUser(res.user);
          setGdriveToken(res.accessToken);
          activeToken = res.accessToken;
        }
      } catch (err: any) {
        console.error('Auto login failed:', err);
        const friendly = getFriendlyAuthErrorMessage(err, lang);
        if (friendly.isPopupBlockedOrClosed) {
          setShowRedirectOption(true);
        }
        setStatus({
          type: 'error',
          message: friendly.message
        });
        setGdriveActionLoading(false);
        return;
      }
    }

    if (!activeToken) return;
    setGdriveActionLoading(true);
    try {
      const instId = madrasah.id;
      
      // Step-by-step fetch for robust, full database representation
      const [
        classesRes,
        studentsRes,
        teachersRes,
        examsRes,
        feesRes,
        feeStructuresRes,
        attendanceRes,
        calendarRes,
        donationsRes,
        libraryRes
      ] = await Promise.all([
        supabase.from('classes').select('*').eq('institution_id', instId),
        supabase.from('students').select('*').eq('institution_id', instId),
        supabase.from('teachers').select('*').eq('institution_id', instId),
        supabase.from('exams').select('*').eq('institution_id', instId),
        supabase.from('fees').select('*').eq('institution_id', instId),
        supabase.from('fee_structures').select('*').eq('institution_id', instId),
        supabase.from('attendance').select('*').eq('institution_id', instId),
        supabase.from('calendar_events').select('*').eq('institution_id', instId),
        supabase.from('donations').select('*').eq('institution_id', instId),
        supabase.from('library_books').select('*').eq('institution_id', instId)
      ]);

      const exams = examsRes.data || [];
      const examIds = exams.map(e => e.id);

      let examSubjects: any[] = [];
      let examMarks: any[] = [];

      if (examIds.length > 0) {
        const [subjectsRes, marksRes] = await Promise.all([
          supabase.from('exam_subjects').select('*').in('exam_id', examIds),
          supabase.from('exam_marks').select('*').in('exam_id', examIds)
        ]);
        examSubjects = subjectsRes.data || [];
        examMarks = marksRes.data || [];
      }

      const backupObj = {
        institution_id: instId,
        institution_name: madrasah.name,
        backup_date: new Date().toISOString(),
        version: "2.0",
        data: {
          classes: classesRes.data || [],
          students: studentsRes.data || [],
          teachers: teachersRes.data || [],
          exams: exams,
          exam_subjects: examSubjects,
          exam_marks: examMarks,
          fees: feesRes.data || [],
          fee_structures: feeStructuresRes.data || [],
          attendance: attendanceRes.data || [],
          calendar_events: calendarRes.data || [],
          donations: donationsRes.data || [],
          library_books: libraryRes.data || []
        }
      };

      const jsonStr = JSON.stringify(backupObj);
      const encrypted = encryptData(jsonStr);

      const folderId = await findOrCreateDeenoraFolder(activeToken);
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Backup_${dateStr}.deenora`;

      await uploadBackupToDrive(activeToken, folderId, fileName, encrypted);
      await loadGDriveBackups(activeToken);

      setStatus({
        type: 'success',
        message: lang === 'bn' 
          ? 'সম্পূর্ণ এনক্রিপ্টেড ব্যাকআপ সফলভাবে গুগল ড্রাইভে আপলোড করা হয়েছে!' 
          : 'Encrypted backup successfully uploaded to Google Drive!'
      });
    } catch (err: any) {
      console.error('Google drive backup error:', err);
      setStatus({
        type: 'error',
        message: lang === 'bn' ? `গুগল ড্রাইভে ব্যাকআপ নিতে ব্যর্থ হয়েছে: ${err.message}` : `Google Drive backup failed: ${err.message}`
      });
    } finally {
      setGdriveActionLoading(false);
    }
  };

  const handleRestoreFromGoogleDrive = async (fileId: string, fileName: string) => {
    let activeToken = gdriveToken;
    if (!activeToken) {
      setGdriveActionLoading(true);
      try {
        const res = await googleSignIn();
        if (res) {
          setGoogleUser(res.user);
          setGdriveToken(res.accessToken);
          activeToken = res.accessToken;
        }
      } catch (err: any) {
        console.error('Auto login failed:', err);
        const friendly = getFriendlyAuthErrorMessage(err, lang);
        if (friendly.isPopupBlockedOrClosed) {
          setShowRedirectOption(true);
        }
        setStatus({
          type: 'error',
          message: friendly.message
        });
        setGdriveActionLoading(false);
        return;
      }
    }

    if (!activeToken) return;
    setGdriveActionLoading(true);
    try {
      const encryptedContent = await downloadBackupFromDrive(activeToken, fileId);
      const decryptedJsonStr = decryptData(encryptedContent);
      const backupObj = JSON.parse(decryptedJsonStr);

      await handleRestoreBackup(backupObj);
    } catch (err: any) {
      console.error('Google drive restore error:', err);
      setStatus({
        type: 'error',
        message: lang === 'bn' ? `গুগল ড্রাইভ থেকে রিস্টোর করতে ব্যর্থ হয়েছে: ${err.message}` : `Google Drive restore failed: ${err.message}`
      });
    } finally {
      setGdriveActionLoading(false);
    }
  };

  const handleDeleteFromGoogleDrive = async (fileId: string) => {
    let activeToken = gdriveToken;
    if (!activeToken) {
      setGdriveActionLoading(true);
      try {
        const res = await googleSignIn();
        if (res) {
          setGoogleUser(res.user);
          setGdriveToken(res.accessToken);
          activeToken = res.accessToken;
        }
      } catch (err: any) {
        console.error('Auto login failed:', err);
        const friendly = getFriendlyAuthErrorMessage(err, lang);
        if (friendly.isPopupBlockedOrClosed) {
          setShowRedirectOption(true);
        }
        setStatus({
          type: 'error',
          message: friendly.message
        });
        setGdriveActionLoading(false);
        return;
      }
    }

    if (!activeToken) return;
    if (!confirm(lang === 'bn' ? 'আপনি কি এই ব্যাকআপ ফাইলটি গুগল ড্রাইভ থেকে ডিলিট করতে চান?' : 'Are you sure you want to delete this backup file from Google Drive?')) {
      return;
    }
    setGdriveActionLoading(true);
    try {
      await deleteBackupFromDrive(activeToken, fileId);
      await loadGDriveBackups(activeToken);
      setStatus({
        type: 'success',
        message: lang === 'bn' ? 'ব্যাকআপ ফাইলটি গুগল ড্রাইভ থেকে ডিলিট করা হয়েছে।' : 'Backup file deleted from Google Drive.'
      });
    } catch (err: any) {
      console.error('Google drive delete error:', err);
      setStatus({
        type: 'error',
        message: lang === 'bn' ? `ডিলিট করতে সমস্যা হয়েছে: ${err.message}` : `Delete failed: ${err.message}`
      });
    } finally {
      setGdriveActionLoading(false);
    }
  };

  const isUploadActive = React.useMemo(() => {
    let configObj: any = {};
    if (madrasah?.config_json) {
      if (typeof madrasah.config_json === 'string') {
        try { configObj = JSON.parse(madrasah.config_json); } catch (e) { configObj = {}; }
      } else {
        configObj = madrasah.config_json;
      }
    }
    return configObj.modules?.backup_restore ?? false;
  }, [madrasah]);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!madrasah) return;
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('sort_order', { ascending: true });
      if (data) {
        const sorted = [...data].sort((a, b) => {
          const getOrder = (val: any) => {
            if (val === 0) return 0;
            if (val == null || String(val).trim() === '') return 999999;
            const num = Number(val);
            return isNaN(num) ? 999999 : num;
          };
          const orderA = getOrder(a.sort_order);
          const orderB = getOrder(b.sort_order);
          if (orderA !== orderB) return orderA - orderB;
          return (a.class_name || '').localeCompare((b.class_name || ''), 'bn', { numeric: true });
        });
        setClasses(sorted);
      }
    };
    fetchClasses();
  }, [madrasah]);
  const isDark = madrasah?.theme === 'dark';

  const getStudentSortHelpers = (classList: any[]) => {
    const classMap = new Map<string, any>();
    classList.forEach(c => {
      if (c.id) classMap.set(c.id, c);
    });

    const getClassInfo = (s: any) => {
      const cFromMap = s.class_id ? classMap.get(s.class_id) : null;
      const cFromJoin = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      const cls = cFromMap || cFromJoin;

      const className = cls?.class_name || 'N/A';

      let sortOrder = 999999;
      if (cls && cls.sort_order !== undefined && cls.sort_order !== null && String(cls.sort_order).trim() !== '') {
        const num = Number(cls.sort_order);
        if (!isNaN(num)) {
          sortOrder = num;
        }
      }
      return { className, sortOrder };
    };

    const sortStudents = (studentArray: any[]) => {
      return [...studentArray].map(s => {
        const cFromMap = s.class_id ? classMap.get(s.class_id) : null;
        const cFromJoin = Array.isArray(s.classes) ? s.classes[0] : s.classes;
        const cls = cFromMap || cFromJoin;
        return {
          ...s,
          classes: cls || null
        };
      }).sort((a, b) => {
        const infoA = getClassInfo(a);
        const infoB = getClassInfo(b);

        if (infoA.sortOrder !== infoB.sortOrder) {
          return infoA.sortOrder - infoB.sortOrder;
        }

        if (infoA.className !== infoB.className) {
          return infoA.className.localeCompare(infoB.className, 'bn', { numeric: true });
        }

        const rollA = a.roll != null && String(a.roll).trim() !== '' ? Number(a.roll) : 999999;
        const rollB = b.roll != null && String(b.roll).trim() !== '' ? Number(b.roll) : 999999;
        const validRollA = isNaN(rollA) ? 999999 : rollA;
        const validRollB = isNaN(rollB) ? 999999 : rollB;

        if (validRollA !== validRollB) {
          return validRollA - validRollB;
        }

        return (a.student_name || '').localeCompare(b.student_name || '', 'bn');
      });
    };

    return { getClassInfo, sortStudents };
  };

  const downloadFileNative = (blob: Blob, fileName: string, mimeType: string) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      if (window.AndroidInterface && typeof window.AndroidInterface.downloadFile === 'function') {
        try {
          const base64Content = base64data.split(',')[1];
          window.AndroidInterface.downloadFile(base64Content, fileName, mimeType);
        } catch (err) {
          console.warn('AndroidInterface download failed, falling back to standard web download:', err);
          const link = document.createElement('a');
          link.href = base64data;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        const link = document.createElement('a');
        link.href = base64data;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    reader.readAsDataURL(blob);
  };

  const handleGenerateFullBackup = async (sendEmail: boolean = false) => {
    if (!madrasah) return;
    setBackupLoading(true);
    setBackupSuccess(false);
    try {
      const instId = madrasah.id;
      
      // Step-by-step fetch for robust, full database representation
      const [
        classesRes,
        studentsRes,
        teachersRes,
        examsRes,
        feesRes,
        feeStructuresRes,
        attendanceRes,
        calendarRes,
        donationsRes,
        libraryRes
      ] = await Promise.all([
        supabase.from('classes').select('*').eq('institution_id', instId),
        supabase.from('students').select('*').eq('institution_id', instId),
        supabase.from('teachers').select('*').eq('institution_id', instId),
        supabase.from('exams').select('*').eq('institution_id', instId),
        supabase.from('fees').select('*').eq('institution_id', instId),
        supabase.from('fee_structures').select('*').eq('institution_id', instId),
        supabase.from('attendance').select('*').eq('institution_id', instId),
        supabase.from('calendar_events').select('*').eq('institution_id', instId),
        supabase.from('donations').select('*').eq('institution_id', instId),
        supabase.from('library_books').select('*').eq('institution_id', instId)
      ]);

      const exams = examsRes.data || [];
      const examIds = exams.map(e => e.id);

      let examSubjects: any[] = [];
      let examMarks: any[] = [];

      if (examIds.length > 0) {
        const [subjectsRes, marksRes] = await Promise.all([
          supabase.from('exam_subjects').select('*').in('exam_id', examIds),
          supabase.from('exam_marks').select('*').in('exam_id', examIds)
        ]);
        examSubjects = subjectsRes.data || [];
        examMarks = marksRes.data || [];
      }

      const backupObj = {
        institution_id: instId,
        institution_name: madrasah.name,
        backup_date: new Date().toISOString(),
        version: "2.0",
        data: {
          classes: classesRes.data || [],
          students: studentsRes.data || [],
          teachers: teachersRes.data || [],
          exams: exams,
          exam_subjects: examSubjects,
          exam_marks: examMarks,
          fees: feesRes.data || [],
          fee_structures: feeStructuresRes.data || [],
          attendance: attendanceRes.data || [],
          calendar_events: calendarRes.data || [],
          donations: donationsRes.data || [],
          library_books: libraryRes.data || []
        }
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);

      if (sendEmail) {
        const recipient = gmailAddress || madrasah.contact_email || '';
        const subject = encodeURIComponent(`Deenora Full System Backup - ${madrasah.name} - ${new Date().toLocaleDateString()}`);
        const body = encodeURIComponent(
          `আসসালামু আলাইকুম,\n\nআপনার প্রতিষ্ঠান "${madrasah.name}" এর সম্পূর্ণ ডাটাবেস ব্যাকআপ সফলভাবে জেনারেট করা হয়েছে।\n\n` +
          `📅 ব্যাকআপের তারিখ: ${new Date().toLocaleString()}\n` +
          `🔒 ফাইল টাইপ: JSON Full Database Archive\n` +
          `📊 পরিসংখ্যান:\n` +
          `- ক্লাস সংখ্যা: ${backupObj.data.classes.length} টি\n` +
          `- শিক্ষার্থী সংখ্যা: ${backupObj.data.students.length} জন\n` +
          `- শিক্ষক সংখ্যা: ${backupObj.data.teachers.length} জন\n` +
          `- পরীক্ষা সংখ্যা: ${backupObj.data.exams.length} টি\n` +
          `- মোট মার্ক এন্ট্রি: ${backupObj.data.exam_marks.length} টি\n` +
          `- মোট ফি রেকর্ড: ${backupObj.data.fees.length} টি\n` +
          `- মোট হাজিরা রেকর্ড: ${backupObj.data.attendance.length} টি\n\n` +
          `⚠️ নির্দেশিকা:\n` +
          `১. এই মেইলে নিচে ডাউনলোড করা ব্যাকআপ ফাইলটি (.json) সংযুক্ত করে রাখুন।\n` +
          `২. পরবর্তীতে রিস্টোর করার জন্য Deenora ডেটা ম্যানেজমেন্ট প্যানেলে গিয়ে ফাইলটি আপলোড করুন।\n\n` +
          `- Deenora Islamic Management System`
        );

        // Download file
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const fileName = `deenora_backup_${madrasah.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
        downloadFileNative(blob, fileName, 'application/json');

        // Open email client
        window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
        
        setStatus({
          type: 'success',
          message: lang === 'bn' 
            ? 'ব্যাকআপ ফাইলটি ডাউনলোড হয়েছে এবং জিমেইল কম্পোজ উইন্ডো ওপেন হয়েছে। দয়া করে মেইলে ফাইলটি সংযুক্ত করে আপনার ইনবক্সে পাঠিয়ে রাখুন।' 
            : 'Backup file downloaded & email compose window opened. Please attach the file and send it to your inbox.'
        });
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const fileName = `deenora_backup_${madrasah.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
        downloadFileNative(blob, fileName, 'application/json');
        
        setStatus({
          type: 'success',
          message: lang === 'bn' 
            ? 'সম্পূর্ণ ডাটাবেস ব্যাকআপ ফাইল সফলভাবে ডাউনলোড করা হয়েছে!' 
            : 'Full database backup file successfully downloaded!'
        });
      }
      setBackupSuccess(true);
    } catch (err: any) {
      console.error('Backup error:', err);
      setStatus({
        type: 'error',
        message: lang === 'bn' ? `ব্যাকআপ তৈরি করতে ব্যর্থ হয়েছে: ${err.message}` : `Failed to create backup: ${err.message}`
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (backupObj: any) => {
    if (!madrasah) return;
    if (!backupObj || backupObj.version !== "2.0" || !backupObj.data) {
      alert(lang === 'bn' ? 'ভুল ব্যাকআপ ফরম্যাট! অনুগ্রহ করে সঠিক Deenora ব্যাকআপ ফাইল আপলোড করুন।' : 'Invalid backup format! Please upload a valid Deenora backup file.');
      return;
    }

    if (backupObj.institution_id !== madrasah.id) {
      if (!confirm(lang === 'bn' 
        ? 'সতর্কতা: এই ব্যাকআপ ফাইলটি অন্য একটি প্রতিষ্ঠানের ডাটা ধারণ করছে। আপনি কি নিশ্চিত যে আপনি এটি আপনার প্রতিষ্ঠানে রিস্টোর করতে চান?' 
        : 'Warning: This backup file belongs to another institution. Are you sure you want to restore it here?')) {
        return;
      }
    }

    const confirmMsg = lang === 'bn'
      ? '⚠️ চূড়ান্ত সতর্কতা: ব্যাকআপ রিস্টোর করলে আপনার বর্তমান প্রতিষ্ঠানের সকল ডাটা মুছে গিয়ে ব্যাকআপ ফাইলের ডাটা দিয়ে প্রতিস্থাপিত হবে! আপনি কি নিশ্চিত?'
      : '⚠️ FINAL WARNING: Restoring the backup will delete all current data for this institution and replace it with the backup file data! Are you sure?';

    if (!confirm(confirmMsg)) return;

    setRestoreLoading(true);
    setRestoreProgress(lang === 'bn' ? 'রিস্টোর শুরু হচ্ছে...' : 'Starting restore...');

    try {
      const instId = madrasah.id;
      const data = backupObj.data;

      const chunkArray = (arr: any[], size: number) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const performRestoreForTable = async (tableName: string, rows: any[]) => {
        if (!rows || rows.length === 0) return;
        setRestoreProgress(lang === 'bn' ? `ডাটা রিস্টোর হচ্ছে: ${tableName}...` : `Restoring table: ${tableName}...`);
        
        const preppedRows = rows.map(r => ({
          ...r,
          ...(r.institution_id !== undefined ? { institution_id: instId } : {})
        }));

        const chunks = chunkArray(preppedRows, 50);
        for (const chunk of chunks) {
          const { error } = await supabase.from(tableName).upsert(chunk);
          if (error) {
            console.error(`Error restoring chunk for ${tableName}:`, error);
            throw error;
          }
        }
      };

      // 1. Delete existing records in correct order to avoid constraint failures
      const tablesToDelete = [
        'exam_marks', 'exam_subjects', 'exams', 
        'fees', 'fee_structures', 'attendance', 
        'calendar_events', 'donations', 'library_books',
        'students', 'classes', 'teachers'
      ];

      for (const table of tablesToDelete) {
        setRestoreProgress(lang === 'bn' ? `পুরোনো ডাটা পরিষ্কার করা হচ্ছে: ${table}...` : `Cleaning old data: ${table}...`);
        
        if (table === 'exam_marks' || table === 'exam_subjects') {
          const { data: instExams } = await supabase.from('exams').select('id').eq('institution_id', instId);
          const eIds = (instExams || []).map((e: any) => e.id);
          if (eIds.length > 0) {
            await supabase.from(table).delete().in('exam_id', eIds);
          }
        } else {
          await supabase.from(table).delete().eq('institution_id', instId);
        }
      }

      // 2. Perform restores sequentially to preserve foreign key chains
      await performRestoreForTable('classes', data.classes || []);
      await performRestoreForTable('teachers', data.teachers || []);
      await performRestoreForTable('students', data.students || []);
      await performRestoreForTable('exams', data.exams || []);
      await performRestoreForTable('exam_subjects', data.exam_subjects || []);
      await performRestoreForTable('exam_marks', data.exam_marks || []);
      await performRestoreForTable('fee_structures', data.fee_structures || []);
      await performRestoreForTable('fees', data.fees || []);
      await performRestoreForTable('attendance', data.attendance || []);
      await performRestoreForTable('calendar_events', data.calendar_events || []);
      await performRestoreForTable('donations', data.donations || []);
      await performRestoreForTable('library_books', data.library_books || []);

      setRestoreProgress(lang === 'bn' ? 'রিস্টোর সফলভাবে সম্পন্ন হয়েছে!' : 'Restore completed successfully!');
      setStatus({
        type: 'success',
        message: lang === 'bn' 
          ? 'অভিনন্দন! আপনার সম্পূর্ণ ডাটাবেস সফলভাবে রিস্টোর করা হয়েছে।' 
          : 'Congratulations! Your full database has been successfully restored.'
      });
      triggerRefresh();
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatus({
        type: 'error',
        message: lang === 'bn' ? `রিস্টোর করতে সমস্যা হয়েছে: ${err.message}` : `Restore failed: ${err.message}`
      });
    } finally {
      setRestoreLoading(false);
      setRestoreProgress('');
    }
  };

  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backupObj = JSON.parse(text);
        await handleRestoreBackup(backupObj);
      } catch (err: any) {
        console.error('JSON parse error:', err);
        setStatus({
          type: 'error',
          message: lang === 'bn' 
            ? 'ব্যাকআপ ফাইলটি পড়া যায়নি! দয়া করে নিশ্চিত করুন এটি একটি সঠিক Deenora ব্যাকআপ জেসন ফাইল।' 
            : 'Could not read backup file! Please ensure it is a valid Deenora backup JSON file.'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Class': 'Class 1',
        'Roll': 1,
        'Student Name': 'Abdur Rahman',
        'Guardian Name': 'Abdullah',
        'Phone 1': '01700000000',
        'Phone 2': '',
        'Admission ID': '12345',
        'Section': 'Section A / Science',
        'Address': 'Dhaka, Bangladesh',
        'Date of birth': '2010-01-01',
        'English Name': 'Abdur Rahman'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    downloadFileNative(blob, 'madrasah_sample_template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    setStatus({
      type: 'success',
      message: lang === 'bn' ? 'স্যাম্পল ফাইল ডাউনলোড হয়েছে' : 'Sample file downloaded'
    });
    setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
  };

  const handleExportExcel = async () => {
    if (!madrasah) return;
    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    
    try {
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('*, classes(class_name, sort_order)')
        .eq('institution_id', madrasah.id);
        
      if (fetchError) throw fetchError;
      if (!students || students.length === 0) {
        throw new Error(lang === 'bn' ? "কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি" : "No student data found");
      }

      const { sortStudents, getClassInfo } = getStudentSortHelpers(classes);
      const sortedStudents = sortStudents(students);
      
      const excelData = sortedStudents.map(s => {
        const info = getClassInfo(s);
        return { 
          'Class': info.className, 
          'Roll': s.roll || '', 
          'Student Name': s.student_name || '', 
          'Guardian Name': s.guardian_name || '',
          'Phone 1': s.guardian_phone || '',
          'Phone 2': s.guardian_phone_2 || '',
          'Section': s.section || '',
          'Admission ID': s.admission_number || '',
          'Address': s.address || '',
          'Date of birth': s.date_of_birth || '',
          'English Name': s.name_en || ''
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new(); 
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `${madrasah.name.replace(/\s+/g, '_')}_students.xlsx`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([excelBuffer], { type: mimeType });

      downloadFileNative(blob, fileName, mimeType);

      setStatus({
        type: 'success',
        message: lang === 'bn' ? 'সফলভাবে ডাউনলোড হয়েছে' : 'Downloaded Successfully'
      });
    } catch (err: any) { 
      setStatus({ type: 'error', message: err.message }); 
    } finally { 
      setLoading(false); 
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
    }
  };

  const handleExportPDF = async () => {
    if (!madrasah) return;
    setGeneratingPDF(true);
    setDownloadProgress(0);
    setStatus({ type: 'idle', message: '' });
    
    try {
      let query = supabase
        .from('students')
        .select('*, classes(class_name, sort_order)')
        .eq('institution_id', madrasah.id);
        
      if (selectedClassId !== 'all') {
        query = query.eq('class_id', selectedClassId);
      }

      const { data: students, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      if (!students || students.length === 0) {
        throw new Error(lang === 'bn' ? "কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি" : "No student data found");
      }

      const { sortStudents } = getStudentSortHelpers(classes);
      const sortedStudents = sortStudents(students);

      const className = selectedClassId === 'all' 
        ? undefined 
        : classes.find(c => c.id === selectedClassId)?.class_name;

      await generateStudentListPDF(sortedStudents, madrasah, className, lang, (p) => setDownloadProgress(p));

      setStatus({
        type: 'success',
        message: lang === 'bn' ? 'সফলভাবে পিডিএফ ডাউনলোড হয়েছে' : 'PDF Downloaded Successfully'
      });
    } catch (err: any) { 
      setStatus({ type: 'error', message: err.message }); 
    } finally { 
      setGeneratingPDF(false); 
      setDownloadProgress(0);
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
    }
  };

  const excelDateToISO = (serial: any) => {
    if (!serial) return null;
    if (typeof serial === 'string' && serial.includes('-')) return serial;
    const num = parseFloat(serial);
    if (isNaN(num)) return null;
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isUploadActive) {
      setStatus({
        type: 'error',
        message: lang === 'bn' ? 'দুঃখিত, সুপার এডমিন থেকে আপলোড অপশন নিষ্ক্রিয় করা রয়েছে।' : 'Sorry, the upload option has been deactivated by the Super Admin.'
      });
      return;
    }

    const file = e.target.files?.[0];
    if (!file || !madrasah) return;

    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    setProgress(0);
    setSkippedDetails([]);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: '' }) as any[];

          let rows = jsonData.slice(1);
          if (rows.length === 0) throw new Error("File is empty");

          let currentLimit = madrasah.config_json?.student_limit || 0;
          let total = rows.length;

          if (navigator.onLine) {
            const { data: instData } = await supabase.from('institutions').select('config_json').eq('id', madrasah.id).single();
            let freshConfig: any = instData?.config_json;
            if (typeof freshConfig === 'string') {
              try { freshConfig = JSON.parse(freshConfig); } catch (e) { freshConfig = {}; }
            }
            if (freshConfig?.student_limit !== undefined) {
              currentLimit = Number(freshConfig.student_limit);
            }
          }

          if (currentLimit > 0 && navigator.onLine) {
            const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
            if (!error && count !== null) {
              if (count >= currentLimit) {
                throw new Error(lang === 'bn' ? `দুঃখিত, আপনার প্রতিষ্ঠানে সর্বোচ্চ ${currentLimit} জন শিক্ষার্থী অ্যাড করার লিমিট রয়েছে।` : `Limit reached! You can only add up to ${currentLimit} students.`);
              }
              const remainingAllowed = currentLimit - count;
              if (rows.length > remainingAllowed) {
                rows = rows.slice(0, remainingAllowed);
                total = rows.length;
                alert(lang === 'bn' ? `আপনার লিমিট অনুযায়ী মাত্র ${remainingAllowed} জন শিক্ষার্থী যোগ করা হবে।` : `Due to limit, only ${remainingAllowed} students will be imported.`);
              }
            }
          }

          let successCount = 0;
          let skippedCount = 0;
          const localSkipped: Array<{ row: number; name: string; class: string; reason: string }> = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const className = String(row.A || '').trim();
            const rollValue = parseInt(row.B);
            const roll = isNaN(rollValue) ? null : rollValue;
            const studentName = String(row.C || '').trim();
            const guardianName = String(row.D || '').trim();
            const phone = String(row.E || '').trim();
            const phone2 = String(row.F || '').trim();
            const sectionValue = String(row.G || '').trim();
            const admissionNumber = String(row.H || '').trim();
            const address = String(row.I || '').trim();
            const dob = excelDateToISO(row.J);
            const nameEn = String(row.K || '').trim();

            // Skip entirely empty row without counting or reporting as a skip
            if (!studentName && !phone && !className) {
              setProgress(Math.round(((i + 1) / total) * 100));
              continue;
            }

            if (!studentName || !phone || !className) {
              skippedCount++;
              const missing = [];
              if (!className) missing.push(lang === 'bn' ? 'ক্লাস' : 'Class');
              if (!studentName) missing.push(lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name');
              if (!phone) missing.push(lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number');
              localSkipped.push({
                row: i + 2,
                name: studentName || (lang === 'bn' ? 'অজানা শিক্ষার্থী' : 'Unknown Student'),
                class: className || (lang === 'bn' ? 'অজানা' : 'Unknown'),
                reason: lang === 'bn' 
                  ? `প্রয়োজনীয় তথ্য (${missing.join(', ')}) পাওয়া যায়নি` 
                  : `Required info (${missing.join(', ')}) is missing`
              });
              setProgress(Math.round(((i + 1) / total) * 100));
              continue;
            }

            let classId = '';
            const { data: existingClass } = await supabase
              .from('classes')
              .select('id')
              .eq('institution_id', madrasah.id)
              .eq('class_name', className)
              .maybeSingle();

            if (existingClass) {
              classId = existingClass.id;
            } else {
              const { data: newClass, error: classError } = await supabase
                .from('classes')
                .insert({ institution_id: madrasah.id, class_name: className })
                .select('id')
                .single();
              if (classError) {
                skippedCount++;
                localSkipped.push({
                  row: i + 2,
                  name: studentName,
                  class: className,
                  reason: lang === 'bn' ? 'শ্রেণি তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create class'
                });
                setProgress(Math.round(((i + 1) / total) * 100));
                continue;
              }
              classId = newClass.id;
            }

            // Check if student already exists in this class with same name and roll
            let studentQuery = supabase
              .from('students')
              .select('id')
              .eq('institution_id', madrasah.id)
              .eq('class_id', classId)
              .eq('student_name', studentName);
            
            if (roll === null) {
              studentQuery = studentQuery.is('roll', null);
            } else {
              studentQuery = studentQuery.eq('roll', roll);
            }

            const { data: existingStudent } = await studentQuery.maybeSingle();

            if (existingStudent) {
              skippedCount++;
              localSkipped.push({
                row: i + 2,
                name: studentName,
                class: className,
                reason: lang === 'bn' ? 'এই শ্রেণিতে একই নাম ও রোলের শিক্ষার্থী ইতিমধ্যে আছে' : 'Student with same name and roll already exists in this class'
              });
              setProgress(Math.round(((i + 1) / total) * 100));
              continue;
            }

            const studentData: any = {
                institution_id: madrasah.id,
                class_id: classId,
                student_name: studentName,
                admission_number: admissionNumber || null,
                roll: roll,
                date_of_birth: dob || null,
                name_en: nameEn || null,
                address: address || null,
                guardian_name: guardianName || null,
                guardian_phone: phone,
                guardian_phone_2: phone2 || null
            };

            if ((window as any)._hasSection !== false) {
              studentData.section = sectionValue || null;
            }

            const { error: studentError } = await supabase
              .from('students')
              .insert(studentData);

            if (!studentError) {
              successCount++;
            } else {
              skippedCount++;
              localSkipped.push({
                row: i + 2,
                name: studentName,
                class: className,
                reason: lang === 'bn' ? `ডাটাবেজ ত্রুটি: ${studentError.message}` : `Database error: ${studentError.message}`
              });
            }
            setProgress(Math.round(((i + 1) / total) * 100));
          }

          setSkippedDetails(localSkipped);

          const msg = lang === 'bn' 
            ? `${successCount} জন শিক্ষার্থী আপলোড হয়েছে, ${skippedCount} জন বাদ পড়েছে।` 
            : `${successCount} students imported, ${skippedCount} skipped.`;

          setStatus({ 
            type: 'success', 
            message: msg
          });
          
          if (madrasah?.id) {
            requestManager.invalidatePattern('fetch:students:');
            requestManager.invalidatePattern('fetch:classes:');
            requestManager.invalidatePattern('dashboard_');
          }
          
          triggerRefresh();
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message });
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setLoading(false);
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-24">
      {generatingPDF && (
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
      <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md pb-4 pt-2">
        <div className="flex items-center gap-5 px-2">
          <button onClick={onBack} className={`w-14 h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-50 border-blue-100 text-[#2563EB]'} rounded-2xl flex items-center justify-center active:scale-90 transition-all border shadow-sm`}>
            <ArrowLeft size={28} strokeWidth={3} />
          </button>
          <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} font-noto`}>{lang === 'bn' ? 'ডাটা ম্যানেজমেন্ট' : 'Data Management'}</h1>
        </div>
      </div>

      {status.message && (
        <div className={`p-6 rounded-3xl border-2 flex items-center gap-4 animate-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
           {status.type === 'success' ? <CheckCircle2 size={30} /> : <AlertTriangle size={30} />}
           <p className="font-black text-sm">{status.message}</p>
        </div>
      )}

      {skippedDetails.length > 0 && (
        <div className={`p-6 md:p-8 rounded-3xl border-2 animate-in slide-in-from-top-4 ${isDark ? 'bg-slate-800 border-amber-500/20 text-slate-100' : 'bg-amber-50/50 border-amber-200 text-slate-800'} space-y-4`}>
          <div className="flex items-start gap-4">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-1" size={28} />
            <div>
              <h4 className="font-black text-lg font-noto">
                {lang === 'bn' ? 'বাদ পড়া শিক্ষার্থীদের তালিকা ও কারণ' : 'Skipped Students List & Reasons'}
              </h4>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
                {lang === 'bn' 
                  ? 'নিচের শিক্ষার্থীদের ডাটাবেজে যুক্ত করা যায়নি। অনুগ্রহ করে কারণগুলো দেখে এক্সেল ফাইলটি সংশোধন করুন এবং পুনরায় আপলোড করুন।' 
                  : 'The following students could not be added. Please review the reasons, correct your Excel file, and upload again.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
            <table className="w-full text-left border-collapse font-noto min-w-[500px]">
              <thead>
                <tr className={`${isDark ? 'bg-slate-900/40' : 'bg-slate-100/50'} border-b border-slate-200 dark:border-slate-700`}>
                  <th className="py-3 px-4 text-xs font-black uppercase tracking-wider text-center w-24">
                    {lang === 'bn' ? 'এক্সেল রো' : 'Excel Row'}
                  </th>
                  <th className="py-3 px-4 text-xs font-black uppercase tracking-wider">
                    {lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}
                  </th>
                  <th className="py-3 px-4 text-xs font-black uppercase tracking-wider">
                    {lang === 'bn' ? 'শ্রেণি' : 'Class'}
                  </th>
                  <th className="py-3 px-4 text-xs font-black uppercase tracking-wider text-red-500 dark:text-red-400">
                    {lang === 'bn' ? 'বাদ পড়ার কারণ' : 'Reason for Skipping'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {skippedDetails.map((student, idx) => (
                  <tr key={idx} className="hover:bg-slate-500/5 transition-colors">
                    <td className="py-3 px-4 font-black text-center text-slate-400">
                      {lang === 'bn' ? `রো ${student.row}` : `Row ${student.row}`}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {student.name}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400">
                      {student.class}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      {student.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] border p-10 shadow-bubble relative overflow-hidden group`}>
          <div className="flex items-center gap-6 mb-10">
            <div className={`w-16 h-16 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-[1.5rem] flex items-center justify-center border shadow-inner`}>
              <Download size={32} />
            </div>
            <div>
              <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>{lang === 'bn' ? 'ডাটা এক্সপোর্ট' : 'Data Export'}</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Direct Download File</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <button onClick={handleExportExcel} disabled={loading} className="w-full h-[64px] bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-4 text-xl disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={28} /> : (
                <><Download size={28} /> {lang === 'bn' ? 'এক্সেল ডাউনলোড' : 'Excel Download'}</>
              )}
            </button>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
               <div className="flex flex-col gap-2">
                 <label className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                   {lang === 'bn' ? 'ক্লাস নির্বাচন (পিডিএফ এর জন্য)' : 'Select Class (for PDF)'}
                 </label>
                 <select 
                   value={selectedClassId}
                   onChange={(e) => setSelectedClassId(e.target.value)}
                   className={`w-full h-12 rounded-xl px-4 border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-[#1E3A8A]'} font-bold outline-none focus:border-blue-500 transition-all`}
                 >
                   <option value="all">{lang === 'bn' ? 'সকল ক্লাস' : 'All Classes'}</option>
                   {classes.map(c => (
                     <option key={c.id} value={c.id}>{c.class_name}</option>
                   ))}
                 </select>
               </div>

               <button 
                 onClick={handleExportPDF} 
                 disabled={generatingPDF} 
                 className={`w-full h-[64px] ${isDark ? 'bg-emerald-600' : 'bg-emerald-500'} text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-4 text-xl disabled:opacity-50`}
               >
                 {generatingPDF ? <Loader2 className="animate-spin" size={28} /> : (
                   <><FileText size={28} /> {lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'PDF Download'}</>
                 )}
               </button>
            </div>
          </div>
        </div>

        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] border p-10 shadow-bubble relative overflow-hidden group`}>
          <div className="flex items-center gap-6 mb-8">
            <div className={`w-16 h-16 ${!isUploadActive ? 'bg-red-50 text-red-500 border-red-100' : isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-[1.5rem] flex items-center justify-center border shadow-inner`}>
              <Upload size={32} />
            </div>
            <div>
              <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>{lang === 'bn' ? 'ডাটা আপলোড' : 'Data Upload'}</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Select Excel File</p>
            </div>
          </div>
          
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} />
          
          <div 
            onClick={() => {
              if (loading) return;
              if (!isUploadActive) {
                setStatus({
                  type: 'error',
                  message: lang === 'bn' ? 'দুঃখিত, সুপার এডমিন থেকে আপলোড অপশন নিষ্ক্রিয় করা রয়েছে।' : 'Sorry, the upload option has been deactivated by the Super Admin.'
                });
                return;
              }
              fileInputRef.current?.click();
            }} 
            className={`w-full py-12 ${!isUploadActive ? 'opacity-70 cursor-not-allowed bg-red-50/10 border-red-200/50 text-red-500' : isDark ? 'bg-slate-700/50 border-slate-600 text-blue-400 hover:bg-blue-100/10' : 'bg-blue-50 border-[#2563EB]/20 text-[#2563EB] hover:bg-blue-100/10'} border-4 border-dashed rounded-[2.5rem] font-black text-sm flex flex-col items-center justify-center gap-5 transition-all cursor-pointer ${loading ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}`}
          >
            {loading ? (
              <>
                <div className="relative w-20 h-20">
                   <Loader2 size={80} className="animate-spin absolute inset-0 opacity-20" />
                   <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{progress}%</div>
                </div>
                <span className="font-noto text-lg text-center px-4">{lang === 'bn' ? 'আপলোড হচ্ছে, দয়া করে অপেক্ষা করুন...' : 'Uploading, please wait...'}</span>
              </>
            ) : !isUploadActive ? (
              <>
                <AlertTriangle size={60} className="opacity-80 text-red-500 animate-pulse" />
                <span className="font-noto text-lg text-red-500 text-center px-4 font-black">
                  {lang === 'bn' ? 'আপলোড অপশন সুপার এডমিন দ্বারা নিষ্ক্রিয় করা রয়েছে' : 'Upload option is disabled by Super Admin'}
                </span>
              </>
            ) : (
              <>
                <FileUp size={60} className="opacity-50" />
                <span className="font-noto text-lg">{lang === 'bn' ? 'এক্সেল ফাইল সিলেক্ট করুন' : 'Select Excel File'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* সম্পূর্ণ ডাটাবেস ব্যাকআপ ও রিস্টোর */}
      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] border p-8 sm:p-10 shadow-bubble space-y-8`}>
        <div className="flex items-center gap-4">
          <Database className={`w-8 h-8 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
          <div>
            <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>
              {lang === 'bn' ? 'ডাটাবেস ব্যাকআপ ও রিস্টোর' : 'Database Backup & Restore'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-1`}>
              {lang === 'bn' 
                ? 'আপনার প্রতিষ্ঠানের সমস্ত তথ্যের ক্লাউড বা ম্যানুয়াল ব্যাকআপ রাখুন।' 
                : 'Keep cloud or manual backups of all your institution details.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          {/* গুগল ড্রাইভ ক্লাউড ব্যাকআপ ও রিস্টোর */}
          <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900/30 border-slate-700' : 'bg-slate-50/50 border-slate-200'} space-y-6 flex flex-col justify-between`}>
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500 fill-current">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
                  </svg>
                </div>
                <h4 className={`text-base font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} font-noto`}>
                  {lang === 'bn' ? '১. গুগল ড্রাইভ ক্লাউড ব্যাকআপ (সুপার রিকমেন্ডেড)' : '1. Google Drive Cloud Backup (Highly Recommended)'}
                </h4>
              </div>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`}>
                {lang === 'bn' 
                  ? 'আপনার গুগল ড্রাইভের মাধ্যমে সরাসরি মেঘে সুরক্ষিত ব্যাকআপ নিন এবং যেকোনো ডিভাইস বা নতুন ফোনে রিস্টোর করুন।' 
                  : 'Connect your Google Drive account to perform secure backups and restore directly on any device.'}
              </p>
            </div>

            {googleUser ? (
              <div className="space-y-4">
                {/* Connected User Badge */}
                <div className={`p-3.5 rounded-2xl flex items-center justify-between border ${isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {googleUser?.photoURL ? (
                      <img src={googleUser.photoURL} alt="Google profile" className="w-8 h-8 rounded-full border border-blue-500 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-black text-xs shrink-0">
                        {googleUser?.displayName?.charAt(0) || googleUser?.email?.charAt(0) || 'G'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{googleUser?.displayName || 'Google User'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{googleUser?.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleGoogleDisconnect}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black rounded-lg transition-all shrink-0"
                  >
                    {lang === 'bn' ? 'ডিসকানেক্ট' : 'Disconnect'}
                  </button>
                </div>

                {/* GDrive Actions & Backup List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <h5 className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>
                      {lang === 'bn' ? 'সংরক্ষিত ক্লাউড ব্যাকআপ সমূহ (৭ দিন)' : 'Cloud Backups (Max 7 Days)'}
                    </h5>
                    <button 
                      onClick={handleBackupToGoogleDrive}
                      disabled={gdriveActionLoading || gdriveLoading}
                      className="px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-full flex items-center gap-1.5 text-[11px] shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {gdriveActionLoading ? <Loader2 className="animate-spin" size={12} /> : <><svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/></svg> {lang === 'bn' ? 'ব্যাকআপ নিন' : 'Backup Now'}</>}
                    </button>
                  </div>

                  {gdriveLoading ? (
                    <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
                  ) : gdriveBackups.length > 0 ? (
                    <div className={`border rounded-2xl divide-y ${isDark ? 'border-slate-700 divide-slate-700 bg-slate-900/20' : 'border-slate-100 divide-slate-100 bg-slate-50/20'} max-h-44 overflow-y-auto`}>
                      {gdriveBackups.map((backup) => {
                        const backupSizeKb = backup.size ? (parseInt(backup.size) / 1024).toFixed(1) : 'N/A';
                        const createdDate = new Date(backup.createdTime).toLocaleDateString();
                        return (
                          <div key={backup.id} className="p-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{backup.name}</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">{createdDate} • {backupSizeKb} KB</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button 
                                onClick={() => handleRestoreFromGoogleDrive(backup.id, backup.name)}
                                disabled={gdriveActionLoading}
                                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-md transition-all"
                              >
                                {lang === 'bn' ? 'রিস্টোর' : 'Restore'}
                              </button>
                              <button 
                                onClick={() => handleDeleteFromGoogleDrive(backup.id)}
                                disabled={gdriveActionLoading}
                                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-black rounded-md transition-all"
                              >
                                {lang === 'bn' ? 'ডিলিট' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`p-6 border-2 border-dashed rounded-2xl text-center ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                      <p className="text-[11px] font-black">{lang === 'bn' ? 'কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি।' : 'No cloud backups found.'}</p>
                      <p className="text-[9px] opacity-75 mt-0.5">{lang === 'bn' ? 'প্রথম ক্লাউড ব্যাকআপ তৈরি করতে উপরের "ব্যাকআপ নিন" বাটনে চাপুন।' : 'Press "Backup Now" above to create your first cloud backup.'}</p>
                    </div>
                  )}

                  {!gdriveToken && gdriveBackups.length > 0 && (
                    <p className="text-[9px] text-center text-amber-500 font-bold mt-1 leading-normal">
                      {lang === 'bn' 
                        ? 'সেশন রিফ্রেশ করা হয়েছে। কোনো অ্যাকশন বাটনে চাপ দিলে গুগল একাউন্ট ভেরিফাই হয়ে অপারেশনটি স্বয়ংক্রিয়ভাবে সম্পন্ন হবে।' 
                        : 'Session refreshed. Pressing any action will automatically verify and execute the operation.'}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3.5">
                {/* Primary Button: Direct Popup Google Sign-In */}
                <button 
                  onClick={handleGoogleConnect}
                  disabled={gdriveLoading}
                  className="flex items-center justify-center gap-3 px-6 h-12 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] w-full max-w-sm cursor-pointer"
                >
                  <svg viewBox="0 0 48 48" className="w-5 h-5 shrink-0 bg-white rounded-full p-0.5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>{lang === 'bn' ? 'গুগল ড্রাইভ কানেক্ট (পপআপ)' : 'Connect Google Drive (Popup)'}</span>
                </button>

                {/* Secondary Button: Redirect Sign-In (Full Page) */}
                <button 
                  onClick={handleGoogleConnectRedirect}
                  disabled={gdriveLoading}
                  className={`flex items-center justify-center gap-2 px-6 h-11 ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} font-bold text-xs rounded-xl border shadow-xs transition-all active:scale-[0.98] w-full max-w-sm cursor-pointer`}
                >
                  <ExternalLink size={14} className="text-slate-400" />
                  <span>{lang === 'bn' ? 'রিডাইরেক্ট করে সাইন ইন করুন (ফুল পেজ)' : 'Sign in with Redirect (Full Page)'}</span>
                </button>

                {/* Alternative Button: Direct GIS Token Client */}
                <button 
                  onClick={handleGoogleConnectGis}
                  disabled={gdriveLoading}
                  className="text-[11px] font-bold text-slate-500 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors cursor-pointer py-0.5"
                >
                  <Key size={12} />
                  <span>{lang === 'bn' ? 'বিকল্প: Google Identity Services (GIS) দিয়ে ট্রাই করুন' : 'Alternative: Try Google Identity Services (GIS)'}</span>
                </button>

                {/* Domain & Cloud Configuration Guide Toggle */}
                <div className="w-full max-w-sm pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGdriveConfig(!showGdriveConfig)}
                    className="text-[11px] font-bold text-blue-500 hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <Settings size={13} />
                    <span>{lang === 'bn' ? 'deenora.app / Vercel ডোমেন ও ক্লাউড কনফিগারেশন নির্দেশিকা' : 'deenora.app / Vercel Domain Setup Guide'}</span>
                  </button>

                  {showGdriveConfig && (
                    <div className={`mt-3 p-4 rounded-2xl text-left border ${isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-blue-50/70 border-blue-200/80 text-slate-700'} text-xs space-y-3.5 animate-in fade-in duration-200`}>
                      <div className="flex items-center gap-2 font-black text-blue-600 dark:text-blue-400">
                        <Globe size={15} />
                        <span>ডোমেইন ও গুগল ক্লাউড অনুমোদন নির্দেশিকা</span>
                      </div>
                      
                      <p className="text-[11px] leading-relaxed">
                        গুগল ড্রাইভ ব্যাকআপ <strong>deenora.app</strong> ও <strong>Vercel</strong> ডোমেনে সক্রিয় রাখতে নিচের ধাপগুলো নিশ্চিত করুন:
                      </p>

                      {/* Step 1: Firebase Authorized Domains */}
                      <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-amber-400">১. Firebase Authorized Domains:</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(typeof window !== 'undefined' ? window.location.hostname : 'deenora.app', 'domain')}
                            className="px-2 py-0.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'domain' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                            {copiedField === 'domain' ? 'কপি হয়েছে' : 'ডোমেন কপি'}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Firebase Console &gt; Project (deenora-3c9ca) &gt; Authentication &gt; Settings &gt; Authorized domains-এ গিয়ে এই ডোমেনটি যুক্ত করুন:
                        </p>
                        <code className="text-emerald-400 font-mono text-[11px] block bg-black/40 p-1.5 rounded">
                          {typeof window !== 'undefined' ? window.location.hostname : 'deenora.app'}
                        </code>
                      </div>

                      {/* Step 2: Google Cloud Console */}
                      <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-blue-400">২. Google Cloud Console (OAuth Client):</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(typeof window !== 'undefined' ? window.location.origin : 'https://deenora.app', 'origin')}
                            className="px-2 py-0.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'origin' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                            {copiedField === 'origin' ? 'কপি হয়েছে' : 'Origin কপি'}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Google Cloud Console &gt; APIs & Services &gt; Credentials-এ OAuth 2.0 Web Client-এর Authorized JavaScript origins এবং Redirect URIs-এ যুক্ত করুন:
                        </p>
                        <div className="font-mono text-[10px] space-y-1 bg-black/40 p-2 rounded">
                          <p className="text-slate-400">// Authorized JavaScript origins:</p>
                          <p className="text-emerald-400">https://deenora.app</p>
                          <p className="text-emerald-400">https://www.deenora.app</p>
                          <p className="text-emerald-400">{typeof window !== 'undefined' ? window.location.origin : 'https://deenora.app'}</p>
                          <p className="text-slate-400 mt-2">// Authorized redirect URIs:</p>
                          <p className="text-sky-300">https://deenora-3c9ca.firebaseapp.com/__/auth/handler</p>
                          <p className="text-sky-300">{typeof window !== 'undefined' ? window.location.origin + window.location.pathname.replace(/\/$/, '') : 'https://deenora.app/data-management'}</p>
                        </div>
                      </div>

                      {/* Step 3: Custom Google Client ID */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 block">৩. কাস্টম Google Client ID (যদি নিজস্ব GCP প্রজেক্ট থাকে):</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={customClientIdInput}
                            onChange={(e) => setCustomClientIdInput(e.target.value)}
                            placeholder="your-client-id.apps.googleusercontent.com"
                            className={`flex-1 h-9 px-3 rounded-xl border text-xs font-mono outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCustomGoogleClientId(customClientIdInput);
                              setStatus({ type: 'success', message: 'Google Client ID সফলভাবে সংরক্ষিত হয়েছে!' });
                            }}
                            className="px-3 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            সংরক্ষণ
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ম্যানুয়াল বা লোকাল ডাটাবেস ব্যাকআপ ও রিস্টোর */}
          <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900/30 border-slate-700' : 'bg-slate-50/50 border-slate-200'} space-y-6 flex flex-col justify-between`}>
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 text-emerald-500" />
                </div>
                <h4 className={`text-base font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'} font-noto`}>
                  {lang === 'bn' ? '২. স্থানীয় ব্যাকআপ ও রিস্টোর (ম্যানুয়াল)' : '2. Local Backup & Restore (Manual)'}
                </h4>
              </div>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`}>
                {lang === 'bn' 
                  ? 'আপনার প্রতিষ্ঠানের সমস্ত তথ্যের কপি সরাসরি জেসন (.json) ফাইল হিসেবে ডাউনলোড করুন বা পূর্বে সংরক্ষিত ফাইল আপলোড করে রিস্টোর করুন।' 
                  : 'Manually download your institution data as a .json file or upload a previously saved file to restore.'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Manual Backup Download */}
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleGenerateFullBackup(false)}
                  disabled={backupLoading}
                  className={`w-full h-11 ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-650' : 'bg-slate-800 text-white hover:bg-slate-750'} font-black rounded-xl flex items-center justify-center gap-2 text-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer`}
                >
                  {backupLoading ? <Loader2 className="animate-spin" size={16} /> : <><Download size={16} /> {lang === 'bn' ? 'ব্যাকআপ ফাইল ডাউনলোড করুন' : 'Download Backup File'}</>}
                </button>
              </div>

              {/* Manual Restore Upload */}
              <div>
                <input type="file" ref={jsonFileInputRef} className="hidden" accept=".json" onChange={handleImportJsonBackup} />

                {restoreLoading ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-2 text-center">
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                    <p className="font-black text-emerald-500 animate-pulse text-[11px]">{restoreProgress}</p>
                  </div>
                ) : (
                  <div 
                    onClick={() => jsonFileInputRef.current?.click()}
                    className={`py-4 ${isDark ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70 text-emerald-400' : 'bg-emerald-50/30 border-emerald-200/50 text-emerald-600 hover:bg-emerald-50/60'} border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-[0.98] px-4`}
                  >
                    <Upload size={18} className="opacity-80" />
                    <div className="text-left">
                      <span className="font-black text-[11px] block">{lang === 'bn' ? 'ব্যাকআপ ফাইল আপলোড করুন' : 'Upload Backup JSON'}</span>
                      <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'} block`}>
                        {lang === 'bn' ? 'পূর্বে ডাউনলোড করা .json ফাইল সিলেক্ট করুন' : 'Select a previously saved .json file'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-bubble space-y-5`}>
        <div className={`flex items-center justify-between gap-4 ${isDark ? 'text-white' : 'text-[#1E3A8A]'} px-1`}>
          <div className="flex items-center gap-4">
            <Table size={24} />
            <h3 className="text-lg font-black font-noto">{lang === 'bn' ? 'এক্সেল ফরম্যাট গাইড' : 'Excel Format Guide'}</h3>
          </div>
          <button 
            onClick={handleDownloadSample}
            className={`flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border`}
          >
            <FileSpreadsheet size={16} /> {lang === 'bn' ? 'স্যাম্পল ফাইল' : 'Sample File'}
          </button>
        </div>
        <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-400'} leading-relaxed px-1`}>{lang === 'bn' ? 'আপনার এক্সেল ফাইলটি নিচের ১১টি কলামের ফরম্যাটে হতে হবে (অথবা স্যাম্পল ফাইলটি ডাউনলোড করুন):' : 'Your Excel file must match the following 11 column format (or download the sample file):'}</p>
        <div className="grid grid-cols-5 lg:grid-cols-11 gap-3">
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col A</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Class</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col B</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Roll</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col C</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Student Name</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col D</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Guardian Name</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col E</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Phone 1</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col F</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Phone 2</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col G</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Section</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col H</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Admission ID</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col I</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Address</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col J</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Date of birth</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col K</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>English Name</p></div>
        </div>
      </div>
    </div>
  );
};

export default DataManagement;
