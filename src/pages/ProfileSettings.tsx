import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, 
  Edit3, 
  Loader2, 
  Key, 
  Image as ImageIcon, 
  Upload, 
  MessageSquare, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Fingerprint, 
  Zap, 
  Settings2,
  Check,
  CheckCircle,
  Smartphone,
  Trash2,
  Shield,
  Hash,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ListOrdered,
  Bell,
  BellRing,
  Send,
  Save,
  CheckCircle2,
  Printer,
  Moon,
  Sun,
  Sliders,
  Mic,
  Square,
  PhoneCall,
  Wifi,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Institution, Language } from '../types';
import { requestManager } from '../services/RequestManager';
import { NotificationService, DEFAULT_NOTIFICATION_SETTINGS } from '../services/NotificationService';
import { packStudentNotesWithExtra } from '../utils/studentExtraFields';
import {
  hasInternetVoicePermission,
  getInternetVoiceFeatureConfig,
  uploadInternetVoiceTemplate,
} from '../utils/internetVoiceCall';

interface Props {
  madrasah: Institution | null;
  lang: Language;
  onBack: () => void;
  onProfileUpdate?: () => void;
  setStatusModal: (s: any) => void;
  mode?: 'profile' | 'automation';
}

const ProfileSettings: React.FC<Props> = ({ madrasah, lang, onBack, onProfileUpdate, setStatusModal, mode = 'profile' }) => {
  const isAutomationMode = mode === 'automation';
  const [localTheme, setLocalTheme] = useState<'dark' | 'default'>(madrasah?.theme === 'dark' ? 'dark' : 'default');
  const [togglingTheme, setTogglingTheme] = useState(false);
  const [newName, setNewName] = useState(madrasah?.name || '');
  const [newAddress, setNewAddress] = useState(madrasah?.address || '');
  const [newPhone, setNewPhone] = useState(madrasah?.phone || '');
  const [newContactEmail, setNewContactEmail] = useState(madrasah?.contact_email || '');
  const [logoUrl, setLogoUrl] = useState(madrasah?.logo_url || '');
  const [arabicCalligraphyUrl, setArabicCalligraphyUrl] = useState(madrasah?.config_json?.arabic_calligraphy_url || '');
  const [arabicCalligraphyWidth, setArabicCalligraphyWidth] = useState((madrasah?.config_json as any)?.arabic_calligraphy_width || 100);
  const [voiceSenderId, setVoiceSenderId] = useState(madrasah?.voice_sender_id || '');
  const [newPin, setNewPin] = useState(madrasah?.config_json?.user_pin || '');
  const [saving, setSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(madrasah?.config_json?.signature_url || '');
  const [signatureHeight, setSignatureHeight] = useState(madrasah?.config_json?.signature_height || 30);
  const [nameEnglish, setNameEnglish] = useState((madrasah?.config_json as any)?.name_english || '');

  const [featureStudentAttSms, setFeatureStudentAttSms] = useState((madrasah?.config_json as any)?.features?.student_attendance_sms ?? false);
  const [featureFeeSms, setFeatureFeeSms] = useState((madrasah?.config_json as any)?.features?.fee_collection_sms ?? false);
  const [featureTeacherSalarySms, setFeatureTeacherSalarySms] = useState((madrasah?.config_json as any)?.features?.teacher_salary_sms ?? false);
  const [featureTeacherDeduction, setFeatureTeacherDeduction] = useState((madrasah?.config_json as any)?.features?.teacher_attendance_deduction ?? false);
  const [receiptPrintMode, setReceiptPrintMode] = useState((madrasah?.config_json as any)?.features?.receipt_print_mode ?? false);
  const [printerPaperSize, setPrinterPaperSize] = useState((madrasah?.config_json as any)?.features?.printer_paper_size ?? 'A4');

  const [featureDeleteClass, setFeatureDeleteClass] = useState((madrasah?.config_json as any)?.features?.delete_class ?? false);
  const [featureDeleteAccounting, setFeatureDeleteAccounting] = useState((madrasah?.config_json as any)?.features?.delete_accounting ?? false);

  // Zero-Cost Internet Voice Call Automation & Permission states
  const initialVoiceConfig = getInternetVoiceFeatureConfig(madrasah);
  const [featureInternetVoiceAttendance, setFeatureInternetVoiceAttendance] = useState<boolean>(initialVoiceConfig.attendanceEnabled);
  const [featureInternetVoiceAttendanceAutoSend, setFeatureInternetVoiceAttendanceAutoSend] = useState<boolean>(initialVoiceConfig.attendanceAutoSend);
  const [featureInternetVoiceAttendanceTemplateId, setFeatureInternetVoiceAttendanceTemplateId] = useState<string>(initialVoiceConfig.attendanceTemplateId);
  const [featureInternetVoiceDueFee, setFeatureInternetVoiceDueFee] = useState<boolean>(initialVoiceConfig.dueFeeEnabled);
  const [featureInternetVoiceDueFeeTemplateId, setFeatureInternetVoiceDueFeeTemplateId] = useState<string>(initialVoiceConfig.dueFeeTemplateId);

  const [voiceTemplatesList, setVoiceTemplatesList] = useState<any[]>([]);
  const [loadingVoiceTemplates, setLoadingVoiceTemplates] = useState(false);
  const [activeVoiceRecorderTarget, setActiveVoiceRecorderTarget] = useState<'attendance' | 'due_fee' | null>(null);
  const [customVoiceTitle, setCustomVoiceTitle] = useState('');
  const [customVoiceFile, setCustomVoiceFile] = useState<File | null>(null);
  const [customVoiceDuration, setCustomVoiceDuration] = useState(0);
  const [isRecordingCustomVoice, setIsRecordingCustomVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingCustomVoice, setIsUploadingCustomVoice] = useState(false);
  const customMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const customAudioChunksRef = useRef<Blob[]>([]);
  const customRecordTimerRef = useRef<any>(null);
  const customRecordStreamRef = useRef<MediaStream | null>(null);

  // Smartphone App Push Notification Configuration states
  const [notifSettingsLoaded, setNotifSettingsLoaded] = useState(false);
  const [notifAttendanceEnabled, setNotifAttendanceEnabled] = useState(false);
  const [notifFeeEnabled, setNotifFeeEnabled] = useState(false);
  const [notifAbsentTitle, setNotifAbsentTitle] = useState('অনুপস্থিতি নোটিফিকেশন');
  const [notifAbsentBodyTemplate, setNotifAbsentBodyTemplate] = useState('আস-সালামু আলাইকুম, {student_name} (রোল: {roll}, শ্রেণি: {class_name}) আজ {date} তারিখে ক্লাসে অনুপস্থিত রয়েছে।');
  const [notifFeeTitle, setNotifFeeTitle] = useState('ফি আদায় নোটিফিকেশন');
  const [notifFeeBodyTemplate, setNotifFeeBodyTemplate] = useState('আস-সালামু আলাইকুম, {student_name}-এর বেতন বাবদ {amount} ৳ সফলভাবে জমা হয়েছে। মাস: {month}।');
  const [savingNotifSettings, setSavingNotifSettings] = useState(false);
  const [notifSaveSuccess, setNotifSaveSuccess] = useState(false);
  const [testingNotifPush, setTestingNotifPush] = useState(false);

  // Registration Number & Biometric ID Auto-Generator & Bulk Delete states
  const [genTargetField, setGenTargetField] = useState<'reg_no' | 'biometric_id'>('reg_no');
  const [regExamplePattern, setRegExamplePattern] = useState('Abc001');
  const [bioStartingNum, setBioStartingNum] = useState('101');
  const [regFormatMode, setRegFormatMode] = useState<'class_serial' | 'global_seq'>('class_serial');
  const [regTargetScope, setRegTargetScope] = useState<string>('all');
  const [regOverwriteMode, setRegOverwriteMode] = useState<'unassigned' | 'all'>('unassigned');
  const [isGeneratingRegNo, setIsGeneratingRegNo] = useState(false);
  const [isDeletingRegNo, setIsDeletingRegNo] = useState(false);
  const [showDeleteRegConfirm, setShowDeleteRegConfirm] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);

  useEffect(() => {
    if (!madrasah?.id || !isAutomationMode) return;
    supabase
      .from('classes')
      .select('id, class_name, sort_order, created_at')
      .eq('institution_id', madrasah.id)
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => {
            if (a.sort_order !== null && a.sort_order !== undefined && b.sort_order !== null && b.sort_order !== undefined) {
              return a.sort_order - b.sort_order;
            }
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          });
          setClassesList(sorted);
        }
      });
  }, [madrasah?.id, isAutomationMode]);

  useEffect(() => {
    const isParentPortalActive = Boolean((madrasah?.config_json as any)?.modules?.parent_portal === true);
    if (!madrasah?.id || !isParentPortalActive || !isAutomationMode) return;
    let isMounted = true;
    NotificationService.getSettings(madrasah.id)
      .then((settings) => {
        if (!isMounted) return;
        setNotifAttendanceEnabled(settings.attendance_notify_enabled);
        setNotifFeeEnabled(settings.fee_notify_enabled);
        setNotifAbsentTitle(settings.absent_title || DEFAULT_NOTIFICATION_SETTINGS.absent_title);
        setNotifAbsentBodyTemplate(settings.absent_body_template || DEFAULT_NOTIFICATION_SETTINGS.absent_body_template);
        setNotifFeeTitle(settings.fee_title || DEFAULT_NOTIFICATION_SETTINGS.fee_title);
        setNotifFeeBodyTemplate(settings.fee_body_template || DEFAULT_NOTIFICATION_SETTINGS.fee_body_template);
        setNotifSettingsLoaded(true);
      })
      .catch((err) => {
        console.warn('Failed to load notification settings:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [madrasah?.id, isAutomationMode]);

  const handleSaveNotifSettings = async () => {
    if (!madrasah?.id) return;
    setSavingNotifSettings(true);
    try {
      await NotificationService.saveSettings(madrasah.id, {
        attendance_notify_enabled: notifAttendanceEnabled,
        fee_notify_enabled: notifFeeEnabled,
        absent_title: notifAbsentTitle,
        absent_body_template: notifAbsentBodyTemplate,
        fee_title: notifFeeTitle,
        fee_body_template: notifFeeBodyTemplate,
      });
      setNotifSaveSuccess(true);
      setTimeout(() => setNotifSaveSuccess(false), 3000);
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল হয়েছে!' : 'Success!',
        message: lang === 'bn' ? 'স্মার্টফোন পুশ নোটিফিকেশন কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে।' : 'Push notification settings saved successfully.',
      });
    } catch (err: any) {
      alert(err.message || 'Error saving notification settings');
    } finally {
      setSavingNotifSettings(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!madrasah?.id) return;
    setTestingNotifPush(true);
    try {
      const res = await fetch('/api/call?action=send_notification_push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: madrasah.id,
          title: notifAbsentTitle || 'Deenora পুশ নোটিফিকেশন টেস্ট',
          body: 'এটি একটি টেস্ট নোটিফিকেশন। অভিভাবক অ্যাপে সফলভাবে নোটিফিকেশন পৌঁছাচ্ছে। 🔔',
          type: 'general',
          target: { type: 'all' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'টেস্ট নোটিফিকেশন প্রেরিত' : 'Test Sent',
        message: lang === 'bn' 
          ? `টেস্ট পুশ নোটিফিকেশন কমান্ড সফলভাবে সম্পন্ন হয়েছে। (সংযুক্ত ডিভাইস: ${data?.sent ?? data?.matched ?? 0} টি)`
          : `Test push sent to registered devices: ${data?.sent ?? data?.matched ?? 0}`,
      });
    } catch (err: any) {
      alert('টেস্ট পুশ নোটিফিকেশন পাঠানো যায়নি: ' + err.message);
    } finally {
      setTestingNotifPush(false);
    }
  };

  const canConfigureInternetVoice = useMemo(
    () => hasInternetVoicePermission(madrasah, Boolean((madrasah as any)?.is_super_admin)),
    [madrasah]
  );

  const approvedVoiceTemplates = useMemo(
    () => voiceTemplatesList.filter((v) => (v.admin_status || v.provider_status || 'approved') === 'approved'),
    [voiceTemplatesList]
  );

  const pendingVoiceTemplates = useMemo(
    () => voiceTemplatesList.filter((v) => v.admin_status === 'pending'),
    [voiceTemplatesList]
  );

  const customVoicePreviewUrl = useMemo(() => {
    if (!customVoiceFile) return null;
    return URL.createObjectURL(customVoiceFile);
  }, [customVoiceFile]);

  useEffect(() => {
    return () => {
      if (customVoicePreviewUrl) {
        URL.revokeObjectURL(customVoicePreviewUrl);
      }
    };
  }, [customVoicePreviewUrl]);

  useEffect(() => {
    return () => {
      if (customRecordTimerRef.current) clearInterval(customRecordTimerRef.current);
      if (customRecordStreamRef.current) {
        customRecordStreamRef.current.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  const fetchInstitutionVoiceTemplates = async () => {
    if (!madrasah?.id) return;
    setLoadingVoiceTemplates(true);
    try {
      const { data, error } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        setVoiceTemplatesList(data);
      } else {
        const res = await fetch(`/api/awaj?action=templates&institution_id=${encodeURIComponent(madrasah.id)}`);
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (Array.isArray(json?.templates)) {
            setVoiceTemplatesList(json.templates);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching voice templates in ProfileSettings:', err);
    } finally {
      setLoadingVoiceTemplates(false);
    }
  };

  useEffect(() => {
    if (madrasah?.id && isAutomationMode) {
      fetchInstitutionVoiceTemplates();
    }
  }, [madrasah?.id, isAutomationMode]);

  const openInlineVoiceRecorder = (target: 'attendance' | 'due_fee') => {
    if (activeVoiceRecorderTarget === target) {
      setActiveVoiceRecorderTarget(null);
      return;
    }
    setActiveVoiceRecorderTarget(target);
    setCustomVoiceTitle(
      target === 'attendance'
        ? (lang === 'bn' ? 'অনুপস্থিতি ফ্রি ইন্টারনেট ভয়েস' : 'Attendance Absence Voice')
        : (lang === 'bn' ? 'বকেয়া ফি রিমাইন্ডার ভয়েস' : 'Due Fee Reminder Voice')
    );
    setCustomVoiceFile(null);
    setCustomVoiceDuration(0);
    setRecordingSeconds(0);
  };

  const startCustomVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      customRecordStreamRef.current = stream;
      let recorderOptions: MediaRecorderOptions | undefined;
      let recordedMimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) {
          recorderOptions = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 };
          recordedMimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported?.('audio/webm')) {
          recorderOptions = { mimeType: 'audio/webm', audioBitsPerSecond: 24000 };
        } else {
          recorderOptions = { audioBitsPerSecond: 24000 };
        }
      }
      const mediaRecorder = recorderOptions ? new MediaRecorder(stream, recorderOptions) : new MediaRecorder(stream);
      customMediaRecorderRef.current = mediaRecorder;
      customAudioChunksRef.current = [];
      let secondsElapsed = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          customAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blobType = mediaRecorder.mimeType || recordedMimeType || 'audio/webm';
        const audioBlob = new Blob(customAudioChunksRef.current, { type: blobType });
        const recordedFile = new File([audioBlob], `internet_voice_${Date.now()}.webm`, { type: blobType });
        setCustomVoiceFile(recordedFile);
        setCustomVoiceDuration(secondsElapsed);
        stream.getTracks().forEach((tr) => tr.stop());
        customRecordStreamRef.current = null;
      };

      mediaRecorder.start(200);
      setIsRecordingCustomVoice(true);
      setRecordingSeconds(0);
      if (customRecordTimerRef.current) clearInterval(customRecordTimerRef.current);
      customRecordTimerRef.current = setInterval(() => {
        secondsElapsed += 1;
        setRecordingSeconds(secondsElapsed);
      }, 1000);
    } catch {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'মাইক্রোফোন সমস্যা' : 'Microphone Error',
        message: lang === 'bn' ? 'মাইক্রোফোন অনুমতি পাওয়া যায়নি। ব্রাউজার সেটিংস থেকে অনুমতি দিন।' : 'Microphone permission denied.',
      });
    }
  };

  const stopCustomVoiceRecording = () => {
    if (customMediaRecorderRef.current && isRecordingCustomVoice) {
      customMediaRecorderRef.current.stop();
      setIsRecordingCustomVoice(false);
      if (customRecordTimerRef.current) {
        clearInterval(customRecordTimerRef.current);
        customRecordTimerRef.current = null;
      }
    }
  };

  const handleUploadCustomInternetVoice = async () => {
    if (!madrasah?.id || !activeVoiceRecorderTarget) return;
    if (!customVoiceTitle.trim() || !customVoiceFile) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Missing Details',
        message: lang === 'bn' ? 'অনুগ্রহ করে ভয়েসের শিরোনাম দিন এবং অডিও রেকর্ড বা ফাইল নির্বাচন করুন।' : 'Please enter a title and record or choose an audio file.',
      });
      return;
    }
    setIsUploadingCustomVoice(true);
    try {
      const created = await uploadInternetVoiceTemplate({
        institutionId: madrasah.id,
        title: customVoiceTitle.trim(),
        file: customVoiceFile,
        duration: customVoiceDuration,
        isSuperAdmin: Boolean((madrasah as any)?.is_super_admin),
      });
      setVoiceTemplatesList((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
      if (created?.admin_status === 'approved') {
        if (activeVoiceRecorderTarget === 'attendance') {
          setFeatureInternetVoiceAttendanceTemplateId(created.id);
        } else {
          setFeatureInternetVoiceDueFeeTemplateId(created.id);
        }
      }
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'ভয়েস আপলোড সফল!' : 'Voice Uploaded!',
        message:
          created?.admin_status === 'approved'
            ? (lang === 'bn' ? 'ভয়েস টেমপ্লেটটি সংরক্ষিত ও স্বয়ংক্রিয়ভাবে নির্বাচিত হয়েছে।' : 'Voice saved and selected.')
            : (lang === 'bn'
                ? 'কাস্টম ইন্টারনেট ভয়েস আপলোড হয়েছে এবং সুপার অ্যাডমিন অনুমোদনের জন্য পাঠানো হয়েছে। অনুমোদনের পর এটি ড্রপডাউনে ব্যবহারযোগ্য হবে।'
                : 'Custom voice uploaded and submitted for Super Admin approval.'),
      });
      setCustomVoiceTitle('');
      setCustomVoiceFile(null);
      setCustomVoiceDuration(0);
      setRecordingSeconds(0);
      setActiveVoiceRecorderTarget(null);
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'আপলোড ব্যর্থ' : 'Upload Failed',
        message: err?.message || 'ভয়েস আপলোড করা যায়নি।',
      });
    } finally {
      setIsUploadingCustomVoice(false);
    }
  };

  const getRegLivePreview = () => {
    if (genTargetField === 'biometric_id') {
      const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
      const raw = String(bioStartingNum || '').replace(/[০-৯]/g, d => String(bn.indexOf(d))).replace(/[^0-9]/g, '');
      const startingNum = parseInt(raw, 10) || 101;

      const samples: { className: string; sampleReg: string }[] = [];
      const displayClasses = classesList.length > 0 ? classesList.slice(0, 3) : [
        { id: '1', class_name: lang === 'bn' ? 'প্লে শ্রেণি (সিরিয়াল ১)' : 'Play Class (Serial 1)' },
        { id: '2', class_name: lang === 'bn' ? 'নার্সারি শ্রেণি (সিরিয়াল ২)' : 'Nursery Class (Serial 2)' },
        { id: '3', class_name: lang === 'bn' ? '১ম শ্রেণি (সিরিয়াল ৩)' : 'Class 1 (Serial 3)' },
      ];

      let seq = startingNum;
      displayClasses.forEach((cls, idx) => {
        const cSerial = idx + 1;
        if (regFormatMode === 'class_serial') {
          const sample1 = `${cSerial}01`;
          const sample2 = `${cSerial}02`;
          samples.push({ className: cls.class_name, sampleReg: `${sample1}, ${sample2}...` });
        } else {
          const sample1 = String(seq);
          seq++;
          const sample2 = String(seq);
          seq++;
          samples.push({ className: cls.class_name, sampleReg: `${sample1}, ${sample2}...` });
        }
      });
      return samples;
    }

    const example = regExamplePattern.trim() || 'Abc001';
    const match = example.match(/^(.*?)(0*(\d+))$/);
    let prefix = example;
    let paddingLength = 3;
    let startingNum = 1;
    if (match) {
      prefix = match[1];
      paddingLength = match[2].length;
      startingNum = parseInt(match[3], 10) || 1;
    }

    const samples: { className: string; sampleReg: string }[] = [];
    const displayClasses = classesList.length > 0 ? classesList.slice(0, 3) : [
      { id: '1', class_name: lang === 'bn' ? 'প্লে শ্রেণি (সিরিয়াল ১)' : 'Play Class (Serial 1)' },
      { id: '2', class_name: lang === 'bn' ? 'নার্সারি শ্রেণি (সিরিয়াল ২)' : 'Nursery Class (Serial 2)' },
      { id: '3', class_name: lang === 'bn' ? '১ম শ্রেণি (সিরিয়াল ৩)' : 'Class 1 (Serial 3)' },
    ];

    let seq = startingNum;
    displayClasses.forEach((cls, idx) => {
      const cSerial = idx + 1;
      if (regFormatMode === 'class_serial') {
        const sample1 = `${prefix}${cSerial}${String(1).padStart(paddingLength, '0')}`;
        const sample2 = `${prefix}${cSerial}${String(2).padStart(paddingLength, '0')}`;
        samples.push({ className: cls.class_name, sampleReg: `${sample1}, ${sample2}...` });
      } else {
        const sample1 = `${prefix}${String(seq).padStart(paddingLength, '0')}`;
        seq++;
        const sample2 = `${prefix}${String(seq).padStart(paddingLength, '0')}`;
        seq++;
        samples.push({ className: cls.class_name, sampleReg: `${sample1}, ${sample2}...` });
      }
    });

    return samples;
  };

  const handleGenerateRegNumbers = async () => {
    if (!madrasah?.id) return;
    setIsGeneratingRegNo(true);
    try {
      const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
      const rawBio = String(bioStartingNum || '').replace(/[০-৯]/g, d => String(bn.indexOf(d))).replace(/[^0-9]/g, '');
      const bioStart = parseInt(rawBio, 10) || 101;

      const example = regExamplePattern.trim() || 'Abc001';
      const match = example.match(/^(.*?)(0*(\d+))$/);
      let prefix = example;
      let paddingLength = 3;
      let startingNum = 1;
      if (match) {
        prefix = match[1];
        paddingLength = match[2].length;
        startingNum = parseInt(match[3], 10) || 1;
      }

      const { data: fetchedClasses, error: clsErr } = await supabase
        .from('classes')
        .select('id, class_name, sort_order, created_at')
        .eq('institution_id', madrasah.id);
      if (clsErr) throw clsErr;

      const sortedClasses = (fetchedClasses || []).sort((a, b) => {
        if (a.sort_order !== null && a.sort_order !== undefined && b.sort_order !== null && b.sort_order !== undefined) {
          return a.sort_order - b.sort_order;
        }
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });

      const classSerialMap = new Map<string, number>();
      sortedClasses.forEach((cls, idx) => {
        classSerialMap.set(cls.id, idx + 1);
      });

      let stQuery = supabase
        .from('students')
        .select('id, class_id, roll, student_name, registration_number, biometric_id, notes')
        .eq('institution_id', madrasah.id);

      if (regTargetScope !== 'all') {
        stQuery = stQuery.eq('class_id', regTargetScope);
      }

      const { data: fetchedStudents, error: stErr } = await stQuery;
      if (stErr) throw stErr;

      if (!fetchedStudents || fetchedStudents.length === 0) {
        setStatusModal({
          show: true,
          type: 'error',
          title: lang === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No Students Found',
          message: lang === 'bn' ? 'জেনারেট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found in selected scope.'
        });
        return;
      }

      let targetStudents = fetchedStudents;
      if (regOverwriteMode === 'unassigned') {
        if (genTargetField === 'biometric_id') {
          targetStudents = fetchedStudents.filter(s => !s.biometric_id && !(s.notes && s.notes.includes('"biometric_id"')));
        } else {
          targetStudents = fetchedStudents.filter(s => !s.registration_number || s.registration_number.trim() === '');
        }

        if (targetStudents.length === 0) {
          setStatusModal({
            show: true,
            type: 'info',
            title: lang === 'bn' ? 'তথ্য' : 'Info',
            message: lang === 'bn' 
              ? `সকল শিক্ষার্থীর ইতিমধ্যেই ${genTargetField === 'biometric_id' ? 'বায়োমেট্রিক আইডি' : 'রেজিষ্ট্রেশন নম্বর'} বসানো আছে।` 
              : 'All students already have IDs assigned.'
          });
          return;
        }
      }

      const studentsByClass = new Map<string, any[]>();
      targetStudents.forEach(s => {
        if (!studentsByClass.has(s.class_id)) {
          studentsByClass.set(s.class_id, []);
        }
        studentsByClass.get(s.class_id)!.push(s);
      });

      const updates: Array<{ id: string; payload: Record<string, any> }> = [];
      let globalSeqCounter = genTargetField === 'biometric_id' ? bioStart : startingNum;

      const targetClassesToProcess = regTargetScope === 'all'
        ? sortedClasses
        : sortedClasses.filter(c => c.id === regTargetScope);

      targetClassesToProcess.forEach(cls => {
        const cSerial = classSerialMap.get(cls.id) || 1;
        const clsStudents = studentsByClass.get(cls.id) || [];
        clsStudents.sort((a, b) => (Number(a.roll) || 9999) - (Number(b.roll) || 9999));

        clsStudents.forEach((st, sIndex) => {
          const rollNum = st.roll || (sIndex + 1);
          if (genTargetField === 'biometric_id') {
            let bioVal = 0;
            if (regFormatMode === 'class_serial') {
              bioVal = parseInt(`${cSerial}${String(rollNum).padStart(2, '0')}`, 10);
            } else {
              bioVal = globalSeqCounter;
              globalSeqCounter++;
            }
            updates.push({
              id: st.id,
              payload: {
                biometric_id: bioVal,
                notes: packStudentNotesWithExtra(st.notes || '', { biometric_id: String(bioVal) })
              }
            });
          } else {
            let regStr = '';
            if (regFormatMode === 'class_serial') {
              regStr = `${prefix}${cSerial}${String(rollNum).padStart(paddingLength, '0')}`;
            } else {
              regStr = `${prefix}${String(globalSeqCounter).padStart(paddingLength, '0')}`;
              globalSeqCounter++;
            }
            updates.push({
              id: st.id,
              payload: {
                registration_number: regStr
              }
            });
          }
        });
      });

      for (let i = 0; i < updates.length; i += 50) {
        const chunk = updates.slice(i, i + 50);
        const results = await Promise.all(
          chunk.map(u =>
            supabase
              .from('students')
              .update(u.payload)
              .eq('id', u.id)
              .eq('institution_id', madrasah.id)
          )
        );
        const firstErr = results.find(r => r.error)?.error;
        if (firstErr) throw firstErr;
      }

      requestManager.invalidatePattern(`students:${madrasah.id}`);
      if (onProfileUpdate) onProfileUpdate();

      const label = genTargetField === 'biometric_id' ? (lang === 'bn' ? 'বায়োমেট্রিক আইডি' : 'Biometric ID') : (lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর' : 'Registration No');

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল!' : 'Success!',
        message: lang === 'bn'
          ? `মোট ${updates.length} জন শিক্ষার্থীর ${label} সফলভাবে জেনারেট করা হয়েছে।`
          : `Successfully generated ${label} for ${updates.length} students.`
      });
    } catch (err: any) {
      console.error('Generation error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ!' : 'Failed!',
        message: err.message || 'Failed to generate IDs.'
      });
    } finally {
      setIsGeneratingRegNo(false);
    }
  };

  const handleBulkDeleteRegNumbers = async () => {
    if (!madrasah?.id) return;
    setIsDeletingRegNo(true);
    try {
      let query = supabase.from('students').select('id, notes').eq('institution_id', madrasah.id);
      if (regTargetScope !== 'all') {
        query = query.eq('class_id', regTargetScope);
      }

      const { data: targetStudents, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      if (!targetStudents || targetStudents.length === 0) {
        setStatusModal({
          show: true,
          type: 'error',
          title: lang === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No Students Found',
          message: lang === 'bn' ? 'রিসেট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found to clear IDs.'
        });
        return;
      }

      const updates = targetStudents.map(s => {
        if (genTargetField === 'biometric_id') {
          return {
            id: s.id,
            payload: {
              biometric_id: null,
              notes: packStudentNotesWithExtra(s.notes || '', { biometric_id: '' })
            }
          };
        }
        return {
          id: s.id,
          payload: {
            registration_number: null
          }
        };
      });

      for (let i = 0; i < updates.length; i += 50) {
        const chunk = updates.slice(i, i + 50);
        const results = await Promise.all(
          chunk.map(u =>
            supabase
              .from('students')
              .update(u.payload)
              .eq('id', u.id)
              .eq('institution_id', madrasah.id)
          )
        );
        const firstErr = results.find(r => r.error)?.error;
        if (firstErr) throw firstErr;
      }

      requestManager.invalidatePattern(`students:${madrasah.id}`);
      if (onProfileUpdate) onProfileUpdate();

      const label = genTargetField === 'biometric_id' ? (lang === 'bn' ? 'বায়োমেট্রিক আইডি' : 'Biometric ID') : (lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর' : 'Registration No');

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল!' : 'Success!',
        message: lang === 'bn'
          ? `মোট ${updates.length} জন শিক্ষার্থীর ${label} ডিলিট/রিসেট করা হয়েছে।`
          : `Cleared ${label} for ${updates.length} students.`
      });
    } catch (err: any) {
      console.error('Bulk clear error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ!' : 'Failed!',
        message: err.message || 'Failed to clear IDs.'
      });
    } finally {
      setIsDeletingRegNo(false);
      setShowDeleteRegConfirm(false);
    }
  };

  const isDark = localTheme === 'dark';
  const parsedConfig = React.useMemo(() => {
    if (!madrasah?.config_json) return {};
    if (typeof madrasah.config_json === 'string') {
      try { return JSON.parse(madrasah.config_json); } catch (e) { return {}; }
    }
    return (madrasah.config_json as any) || {};
  }, [madrasah?.config_json]);

  const modules = parsedConfig?.modules || (madrasah?.config_json as any)?.modules || {};
  const packageRaw = madrasah?.config_json?.package_name || madrasah?.config_json?.subscription?.package_name || '1';
  const packageNumber = String(packageRaw);

  const getPackageLevel = (pkg: string): number => {
    const name = pkg.trim().toUpperCase();
    if (name === '1' || name === 'STARTER' || name === 'স্টার্টার') return 1;
    if (name === '2' || name === 'BASIC' || name === 'বেসিক') return 2;
    if (name === '3' || name === 'SMART' || name === 'স্মার্ট') return 3;
    if (name === '4' || name === 'ACADEMIC' || name === 'একাডেমিক') return 4;
    if (name === '5' || name === 'STANDARD' || name === 'স্ট্যান্ডার্ড') return 5;
    if (name === '6' || name === 'FINANCE' || name === 'ফিনান্স') return 6;
    if (name === '7' || name === 'PROFESSIONAL' || name === 'প্রফেশনাল') return 7;
    if (name === '8' || name === 'ENTERPRISE' || name === 'এন্টারপ্রাইজ') return 8;
    if (name === '9' || name === 'ENTERPRISE PLUS' || name === 'এন্টারপ্রাইজ প্লাস') return 9;
    if (name === '10' || name === 'ULTIMATE' || name === 'আল্টিমেট') return 10;
    
    const num = parseInt(name);
    if (!isNaN(num)) return num;

    if (name.includes('ULTIMATE') || name.includes('আল্টিমেট')) return 10;
    if (name.includes('ENTERPRISE') || name.includes('এন্টারপ্রাইজ')) return 8;
    if (name.includes('PROFESSIONAL') || name.includes('প্রফেশনাল')) return 7;
    if (name.includes('FINANCE') || name.includes('ফিনান্স')) return 6;
    if (name.includes('STANDARD') || name.includes('স্ট্যান্ডার্ড')) return 5;
    if (name.includes('ACADEMIC') || name.includes('একাডেমিক')) return 4;

    return 1;
  };

  const isPremiumPackage = getPackageLevel(packageNumber) >= 4;

  const compressAndResizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height *= maxWidth / width)); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width *= maxHeight / height)); height = maxHeight; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get context'));
          
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Failed to create blob')); }, 'image/webp', 0.9);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  useEffect(() => {
    if (!madrasah) return;
    setLocalTheme(madrasah.theme === 'dark' ? 'dark' : 'default');
    const parsedConfig = typeof madrasah.config_json === 'string'
      ? (() => { try { return JSON.parse(madrasah.config_json); } catch (e) { return {}; } })()
      : (madrasah.config_json || {});

    setNewName(madrasah.name || '');
    setNewAddress(madrasah.address || '');
    setNewPhone(madrasah.phone || '');
    setNewContactEmail(madrasah.contact_email || '');
    setLogoUrl(madrasah.logo_url || '');
    setArabicCalligraphyUrl(parsedConfig.arabic_calligraphy_url || '');
    setArabicCalligraphyWidth(parsedConfig.arabic_calligraphy_width || 100);
    setVoiceSenderId(madrasah.voice_sender_id || '');
    setNewPin(parsedConfig.user_pin || '');
    setSignatureUrl(parsedConfig.signature_url || '');
    setSignatureHeight(parsedConfig.signature_height || 30);
    setNameEnglish(parsedConfig.name_english || '');

    const feats = parsedConfig.features || {};
    setFeatureStudentAttSms(feats.student_attendance_sms ?? false);
    setFeatureFeeSms(feats.fee_collection_sms ?? false);
    setFeatureTeacherSalarySms(feats.teacher_salary_sms ?? false);
    setFeatureTeacherDeduction(feats.teacher_attendance_deduction ?? false);
    setReceiptPrintMode(feats.receipt_print_mode ?? false);
    setPrinterPaperSize(feats.printer_paper_size ?? 'A4');

    setFeatureDeleteClass(feats.delete_class ?? false);
    setFeatureDeleteAccounting(feats.delete_accounting ?? false);

    setFeatureInternetVoiceAttendance(feats.internet_voice_attendance_enabled ?? false);
    setFeatureInternetVoiceAttendanceAutoSend(feats.internet_voice_attendance_auto_send ?? false);
    setFeatureInternetVoiceAttendanceTemplateId(String(feats.internet_voice_attendance_template_id || ''));
    setFeatureInternetVoiceDueFee(feats.internet_voice_due_fee_enabled ?? false);
    setFeatureInternetVoiceDueFeeTemplateId(String(feats.internet_voice_due_fee_template_id || ''));
  }, [madrasah]);

  const handleToggleTheme = async () => {
    if (!madrasah || togglingTheme) return;
    const nextTheme: 'dark' | 'default' = localTheme === 'dark' ? 'default' : 'dark';
    setLocalTheme(nextTheme);
    setTogglingTheme(true);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      requestManager.invalidatePattern(`institution:${madrasah.id}`);
      requestManager.invalidatePattern('dashboard_');

      try {
        await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-theme', institutionId: madrasah.id, theme: nextTheme })
        });
      } catch (backendErr) {
        console.warn('Backend admin theme update error:', backendErr);
      }

      try {
        await supabase.from('institutions').update({ theme: nextTheme }).eq('id', madrasah.id);
      } catch (e) {}

      if (onProfileUpdate) onProfileUpdate();
    } catch (err) {
      console.warn('Theme toggle error:', err);
    } finally {
      setTogglingTheme(false);
    }
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const currentConfigObj = typeof madrasah.config_json === 'string'
        ? (() => { try { return JSON.parse(madrasah.config_json); } catch (e) { return {}; } })()
        : (madrasah.config_json || {});

      const existingFeatures = currentConfigObj.features || {};

      const updatedConfig = isAutomationMode
        ? {
            ...currentConfigObj,
            features: {
              ...existingFeatures,
              student_attendance_sms: featureStudentAttSms,
              fee_collection_sms: featureFeeSms,
              teacher_salary_sms: featureTeacherSalarySms,
              teacher_attendance_deduction: featureTeacherDeduction,
              delete_class: featureDeleteClass,
              delete_accounting: featureDeleteAccounting,
              internet_voice_attendance_enabled: featureInternetVoiceAttendance,
              internet_voice_attendance_auto_send: featureInternetVoiceAttendanceAutoSend,
              internet_voice_attendance_template_id: featureInternetVoiceAttendanceTemplateId,
              internet_voice_due_fee_enabled: featureInternetVoiceDueFee,
              internet_voice_due_fee_template_id: featureInternetVoiceDueFeeTemplateId,
            }
          }
        : {
            ...currentConfigObj,
            user_pin: newPin.trim() || currentConfigObj.user_pin || '',
            signature_url: signatureUrl,
            signature_height: signatureHeight,
            arabic_calligraphy_url: arabicCalligraphyUrl,
            arabic_calligraphy_width: arabicCalligraphyWidth,
            name_english: nameEnglish.trim(),
            features: {
              ...existingFeatures,
              receipt_print_mode: receiptPrintMode,
              printer_paper_size: printerPaperSize
            }
          };

      const nextName = isAutomationMode ? (madrasah.name || '') : newName.trim();
      const nextAddress = isAutomationMode ? (madrasah.address || null) : (newAddress.trim() || null);
      const nextPhone = isAutomationMode ? (madrasah.phone || '') : newPhone.trim();
      const nextContactEmail = isAutomationMode ? (madrasah.contact_email || null) : (newContactEmail.trim() || null);
      const nextVoiceSenderId = isAutomationMode ? (madrasah.voice_sender_id || null) : (voiceSenderId.trim() || null);
      const nextLogoUrl = isAutomationMode ? (madrasah.logo_url || '') : logoUrl;
      
      requestManager.invalidatePattern(`institution:${madrasah.id}`);
      requestManager.invalidatePattern('institution');
      
      let updateSuccess = false;
      try {
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-settings',
            institutionId: madrasah.id,
            name: nextName,
            address: nextAddress,
            phone: nextPhone,
            contact_email: nextContactEmail,
            voice_sender_id: nextVoiceSenderId,
            logo_url: nextLogoUrl,
            config_json: updatedConfig
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success) {
            updateSuccess = true;
          }
        }
      } catch (e) {
        console.warn('API update-settings failed, falling back to client Supabase:', e);
      }

      if (!updateSuccess) {
        const { error } = await supabase.from('institutions').update({ 
          name: nextName, 
          address: nextAddress,
          phone: nextPhone, 
          contact_email: nextContactEmail,
          voice_sender_id: nextVoiceSenderId,
          logo_url: nextLogoUrl,
          config_json: updatedConfig
        }).eq('id', madrasah.id);
        
        if (error) throw error;
      }

      // Auto-save notification settings if loaded and Parent Portal is active in automation mode
      const isParentPortalActive = Boolean((madrasah?.config_json as any)?.modules?.parent_portal === true);
      if (isAutomationMode && isParentPortalActive && notifSettingsLoaded) {
        NotificationService.saveSettings(madrasah.id, {
          attendance_notify_enabled: notifAttendanceEnabled,
          fee_notify_enabled: notifFeeEnabled,
          absent_title: notifAbsentTitle,
          absent_body_template: notifAbsentBodyTemplate,
          fee_title: notifFeeTitle,
          fee_body_template: notifFeeBodyTemplate,
        }).catch(err => console.warn('Auto-save notif settings in handleUpdate notice:', err));
      }
      
      // Update local cache so UI doesn't bounce
      try {
        const { OfflineService } = await import('../services/OfflineService');
        const cachedData = OfflineService.getCache('profile');
        if (cachedData) {
          if (cachedData.id === madrasah.id) {
            OfflineService.setCache('profile', { ...cachedData, name: nextName, address: nextAddress, phone: nextPhone, contact_email: nextContactEmail, config_json: updatedConfig });
          } else if (cachedData.madrasah && cachedData.madrasah.id === madrasah.id) {
            OfflineService.setCache('profile', {
              ...cachedData,
              madrasah: {
                ...cachedData.madrasah,
                name: nextName,
                address: nextAddress,
                phone: nextPhone,
                contact_email: nextContactEmail,
                config_json: updatedConfig
              }
            });
          }
        }
      } catch(e) {}

      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({
        show: true,
        type: 'success',
        title: 'সাফল্য',
        message: isAutomationMode
          ? (lang === 'bn' ? 'অটোমেশন ও পারমিশন সফলভাবে সেভ হয়েছে' : 'Automation & permissions saved successfully')
          : (lang === 'bn' ? 'প্রোফাইল সেটিংস সফলভাবে সেভ হয়েছে' : 'Profile updated successfully')
      });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleToggleAdminFeature = async (featureKey: 'delete_class' | 'delete_accounting', nextVal: boolean) => {
    if (featureKey === 'delete_class') setFeatureDeleteClass(nextVal);
    if (featureKey === 'delete_accounting') setFeatureDeleteAccounting(nextVal);
    if (!madrasah) return;
    try {
      let currentConfigObj: any = {};
      if (typeof madrasah.config_json === 'string') {
        try { currentConfigObj = JSON.parse(madrasah.config_json); } catch (e) { currentConfigObj = {}; }
      } else if (madrasah.config_json && typeof madrasah.config_json === 'object') {
        currentConfigObj = madrasah.config_json;
      }

      const updatedConfig = {
        ...currentConfigObj,
        features: {
          ...(currentConfigObj.features || {}),
          delete_class: featureKey === 'delete_class' ? nextVal : featureDeleteClass,
          delete_accounting: featureKey === 'delete_accounting' ? nextVal : featureDeleteAccounting
        }
      };

      requestManager.invalidatePattern(`institution:${madrasah.id}`);
      requestManager.invalidatePattern('institution');

      let updateSuccess = false;
      try {
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-settings',
            institutionId: madrasah.id,
            name: newName.trim() || madrasah.name,
            address: newAddress.trim() || madrasah.address || null,
            phone: newPhone.trim() || madrasah.phone,
            contact_email: newContactEmail.trim() || madrasah.contact_email || null,
            voice_sender_id: voiceSenderId.trim() || madrasah.voice_sender_id || null,
            logo_url: logoUrl || madrasah.logo_url,
            config_json: updatedConfig
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.success) updateSuccess = true;
        }
      } catch (e) {}

      if (!updateSuccess) {
        await supabase.from('institutions').update({ config_json: updatedConfig }).eq('id', madrasah.id);
      }

      try {
        const { OfflineService } = await import('../services/OfflineService');
        const cachedData = OfflineService.getCache('profile');
        if (cachedData) {
          if (cachedData.id === madrasah.id) {
            OfflineService.setCache('profile', { ...cachedData, config_json: updatedConfig });
          } else if (cachedData.madrasah && cachedData.madrasah.id === madrasah.id) {
            OfflineService.setCache('profile', {
              ...cachedData,
              madrasah: { ...cachedData.madrasah, config_json: updatedConfig }
            });
          }
        }
      } catch (e) {}

      if (onProfileUpdate) onProfileUpdate();
    } catch (e) {
      console.warn('Failed to auto-save admin permission toggle:', e);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature' | 'calligraphy') => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      // Delete old file if exists if it belongs to this madrasah
      const oldUrl = type === 'logo' ? logoUrl : (type === 'signature' ? signatureUrl : arabicCalligraphyUrl);
      if (oldUrl && oldUrl.includes('madrasah-assets/')) {
        try {
          const oldFileName = oldUrl.split('madrasah-assets/').pop();
          if (oldFileName) {
            await supabase.storage.from('madrasah-assets').remove([oldFileName]);
          }
        } catch (e) { console.error("Error removing old file", e); }
      }

      const size = type === 'logo' ? 600 : (type === 'calligraphy' ? 1200 : 250);
      const compressedBlob = await compressAndResizeImage(file, size, size);
      
      const fileExt = 'webp';
      const fileName = `${type}_${madrasah.id}_${Date.now()}.${fileExt}`;
      
      // Ensure bucket exists (ignoring errors if it does)
      await supabase.storage.createBucket('madrasah-assets', { public: true }).catch(() => {});
      
      const { data, error: uploadError } = await supabase.storage.from('madrasah-assets').upload(fileName, compressedBlob, { 
        contentType: `image/${fileExt}`,
        upsert: true 
      });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('madrasah-assets').getPublicUrl(fileName);
      
      if (type === 'logo') setLogoUrl(publicUrl);
      else if (type === 'signature') setSignatureUrl(publicUrl);
      else if (type === 'calligraphy') setArabicCalligraphyUrl(publicUrl);
      
      // Auto-save the URL to database to prevent loss on refresh
      try {
        const currentConfig = (typeof madrasah.config_json === 'string' ? JSON.parse(madrasah.config_json) : madrasah.config_json) || {};
        
        let updatedConfig = { ...currentConfig };
        let updateData: any = {};

        if (type === 'logo') {
          updateData.logo_url = publicUrl;
        } else {
          const updateKey = type === 'signature' ? 'signature_url' : 'arabic_calligraphy_url';
          updatedConfig[updateKey] = publicUrl;
          updateData.config_json = updatedConfig;
        }

        let autoSaveSuccess = false;
        try {
          const res = await fetch('/api/branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update-settings',
              institutionId: madrasah.id,
              ...(type === 'logo' ? { logo_url: publicUrl } : { config_json: updatedConfig })
            })
          });
          if (res.ok) {
            autoSaveSuccess = true;
          }
        } catch (apiErr) {
          console.warn('API update-settings failed for asset upload, falling back to direct update:', apiErr);
        }

        if (!autoSaveSuccess) {
          const { error: autoSaveError } = await supabase.from('institutions').update(updateData).eq('id', madrasah.id);
          if (!autoSaveError) {
            autoSaveSuccess = true;
          }
        }
        
        if (autoSaveSuccess) {
          // Update local cache so refresh doesn't show old data
          try {
            const { OfflineService } = await import('../services/OfflineService');
            const cachedMadrasah = OfflineService.getCache('profile');
            if (cachedMadrasah && cachedMadrasah.id === madrasah.id) {
              const newCachedData = { 
                ...cachedMadrasah, 
                logo_url: type === 'logo' ? publicUrl : cachedMadrasah.logo_url,
                config_json: type !== 'logo' ? updatedConfig : cachedMadrasah.config_json 
              };
              OfflineService.setCache('profile', newCachedData);
            }
          } catch(e) { console.error("Error updating offline cache", e); }
          
          if (onProfileUpdate) onProfileUpdate();
        }
      } catch (e) {
        console.error("Auto-save failed", e);
      }

      console.log(`${type} uploaded and auto-saved successfully:`, publicUrl);
    } catch (error: any) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Error uploading ${type}: ` + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
      // Reset input value so same file can be selected again
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteCalligraphy = async () => {
    if (!madrasah || !arabicCalligraphyUrl) return;
    
    const confirmDelete = window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি ক্যালিগ্রাফি ছবিটি ডিলিট করতে চান?' : 'Are you sure you want to delete the calligraphy image?');
    if (!confirmDelete) return;

    setSaving(true);
    try {
      // 1. Remove from storage if it belongs to this madrasah
      if (arabicCalligraphyUrl.includes('madrasah-assets/')) {
        try {
          const fileName = arabicCalligraphyUrl.split('madrasah-assets/').pop();
          if (fileName) {
            await supabase.storage.from('madrasah-assets').remove([fileName]);
          }
        } catch (e) { console.error("Error removing file from storage", e); }
      }

      // 2. Update state
      setArabicCalligraphyUrl('');

      // 3. Update Database
      const { data: currentData } = await supabase.from('institutions').select('config_json').eq('id', madrasah.id).single();
      const currentConfig = (typeof currentData?.config_json === 'string' ? JSON.parse(currentData.config_json) : currentData?.config_json) || {};
      
      let updatedConfig = { ...currentConfig };
      delete updatedConfig.arabic_calligraphy_url;

      const { error } = await supabase.from('institutions').update({ 
        config_json: updatedConfig 
      }).eq('id', madrasah.id);

      if (error) throw error;

      // 4. Update local cache
      try {
        const { OfflineService } = await import('../services/OfflineService');
        const cachedMadrasah = OfflineService.getCache('profile');
        if (cachedMadrasah && cachedMadrasah.id === madrasah.id) {
          OfflineService.setCache('profile', { ...cachedMadrasah, config_json: updatedConfig });
        }
      } catch(e) {}

      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: lang === 'bn' ? 'ক্যালিগ্রাফি ডিলিট করা হয়েছে' : 'Calligraphy deleted successfully' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-60px)] md:h-screen w-full relative overflow-hidden ${isDark ? 'bg-[#0f172a] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
      {/* Header */}
      <div className={`p-4 md:p-6 flex items-center justify-between sticky top-0 z-50 transition-all ${isDark ? 'bg-[#1e293b]/90 backdrop-blur-md border-b border-slate-800' : 'bg-white/80 backdrop-blur-md border-b border-slate-200/60'}`}>
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack} 
            className={`w-10 h-10 rounded-[1.1rem] border flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} shadow-sm`}
          >
            <ChevronLeft size={20} />
          </motion.button>
          <div className="min-w-0">
            <h1 className="text-xl font-black font-noto tracking-tight truncate">
              {isAutomationMode
                ? (lang === 'bn' ? 'অটোমেশন ও পারমিশন' : 'Automation & Permissions')
                : (lang === 'bn' ? 'প্রোফাইল সেটিংস' : 'Profile Settings')}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 font-noto uppercase tracking-wider truncate">
              {isAutomationMode
                ? (lang === 'bn' ? 'SMS, পুশ নোটিফিকেশন, পারমিশন ও আইডি জেনারেটর' : 'SMS, Push Notifications, Permissions & ID Tools')
                : (lang === 'bn' ? 'প্রতিষ্ঠানের ব্র্যান্ডিং, তথ্য ও প্রিন্ট সেটিংস' : 'Institution branding, info & print settings')}
            </p>
          </div>
        </div>
        <div className="hidden md:block">
           <button onClick={handleUpdate} disabled={saving} className={`px-6 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-black rounded-xl text-xs uppercase shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}>
             {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
             {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
           </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-32 space-y-8">
          
          {!isAutomationMode && (
          <>
          {/* Logo Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative p-8 rounded-[2.5rem] border overflow-hidden flex flex-col items-center text-center space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="relative group">
              <div className={`w-32 h-32 rounded-[2.2rem] border-4 flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-500 group-hover:scale-105 ${isDark ? 'bg-slate-800 border-slate-700 shadow-black/50' : 'bg-slate-50 border-white shadow-slate-200'}`}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="text-slate-300 flex flex-col items-center gap-2">
                    <ImageIcon size={40} className="opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Logo</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-[2px]">
                  <Upload className="text-white mb-1" size={24} />
                  <span className="text-[10px] text-white font-black uppercase tracking-widest">{lang === 'bn' ? 'পরিবর্তন' : 'Change'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'logo')} disabled={saving} />
                </label>
              </div>
              {saving && <div className="absolute inset-0 bg-white/20 dark:bg-black/20 backdrop-blur-sm rounded-[2.2rem] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
            </div>

            <div className="space-y-1">
              <h2 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{newName || 'Institution Name'}</h2>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'bn' ? 'প্রতিষ্ঠানের ব্র্যান্ডিং' : 'Institution Branding'}</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Info Card */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <Building2 size={20} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'সাধারণ তথ্য' : 'General Info'}</h3>
              </div>

              <div className="space-y-5">
                {[
                  { label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name', value: newName, setter: setNewName, icon: Building2, type: 'text' },
                  { label: lang === 'bn' ? 'ঠিকানা' : 'Address', value: newAddress, setter: setNewAddress, icon: MapPin, type: 'text' },
                  { label: lang === 'bn' ? 'মোবাইল নাম্বার' : 'Phone Number', value: newPhone, setter: setNewPhone, icon: Phone, type: 'tel' },
                  { label: lang === 'bn' ? 'অফিসিয়াল ইমেইল (PDF-এর জন্য)' : 'Official Email (For PDFs)', value: newContactEmail, setter: setNewContactEmail, icon: Mail, type: 'email' },
                ].map((field, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">{field.label}</label>
                    <div className="relative group">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isDark ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-300 group-focus-within:text-[#2563EB]'}`}>
                        <field.icon size={16} />
                      </div>
                      <input 
                        type={field.type} 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                        value={field.value} 
                        onChange={(e) => field.setter(e.target.value)} 
                        placeholder="..."
                      />
                    </div>
                  </div>
                ))}

                {madrasah?.institution_type === 'madrasah' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                        {lang === 'bn' ? 'প্রতিষ্ঠানের নাম (ইংরেজি) - ঐচ্ছিক' : 'Institution Name (English) - Optional'}
                      </label>
                      <div className="relative group">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isDark ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-300 group-focus-within:text-[#2563EB]'}`}>
                          <Building2 size={16} />
                        </div>
                        <input 
                          type="text" 
                          className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                          value={nameEnglish} 
                          onChange={(e) => setNameEnglish(e.target.value)} 
                          placeholder={lang === 'bn' ? 'ইংরেজি নাম লিখুন' : 'Enter English name'}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                        {lang === 'bn' ? 'আরবি ক্যালিগ্রাফি ইমেজ (ঐচ্ছিক)' : 'Arabic Calligraphy Image (Optional)'}
                      </label>
                      <div className={`relative p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        {arabicCalligraphyUrl ? (
                          <div className="relative group/calligraphy w-full flex flex-col items-center">
                            <div className={`p-4 rounded-xl border mb-4 flex items-center justify-center bg-white ${isDark ? 'border-slate-700' : 'border-slate-100'}`} style={{ width: '100%', height: '120px' }}>
                              <img 
                                src={arabicCalligraphyUrl} 
                                alt="Calligraphy" 
                                className="max-h-full object-contain" 
                                crossOrigin="anonymous" 
                                style={{ width: `${arabicCalligraphyWidth}%` }} 
                              />
                            </div>
                            
                            <div className="w-full space-y-3 mb-4">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ক্যালিগ্রাফির সাইজ (প্রস্থ)' : 'Calligraphy Scale (Width)'}</label>
                                <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{arabicCalligraphyWidth}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="30" 
                                max="100" 
                                value={arabicCalligraphyWidth} 
                                onChange={(e) => setArabicCalligraphyWidth(Number(e.target.value))} 
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>

                            <div className="flex items-center gap-4">
                              <button 
                                onClick={handleDeleteCalligraphy}
                                className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                              >
                                <Trash2 size={12} />
                                {lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                              </button>
                              <label className="text-[10px] font-black text-blue-500 cursor-pointer uppercase tracking-widest hover:underline">
                                {lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change Image'}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'calligraphy')} disabled={saving} />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Upload size={24} className="text-slate-300" />
                            <label className="text-center cursor-pointer">
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">
                                {lang === 'bn' ? 'ক্যালিগ্রাফি ছবি আপলোড করুন' : 'Upload Calligraphy Image'}
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                                {lang === 'bn' ? 'PDF রিপোর্টে নামের পরিবর্তে এটি ব্যবহার হবে' : 'This will be used instead of text in PDF reports'}
                              </span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'calligraphy')} disabled={saving} />
                            </label>
                          </>
                        )}
                        {saving && <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm rounded-2xl flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={24} /></div>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Account & Security Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'অ্যাকাউন্ট ও নিরাপত্তা' : 'Account & Security'}</h3>
                </div>

                <div className="space-y-5">
                   <div className="space-y-1.5 opacity-80">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center justify-between">
                      {lang === 'bn' ? 'ইমেইল এড্রেস' : 'Email Address'}
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-400/5 px-2 py-0.5 rounded-full border border-red-400/10">read-only</span>
                    </label>
                    <div className="relative group grayscale pointer-events-none">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Mail size={16} />
                      </div>
                      <input 
                        type="email" 
                        readOnly 
                        disabled 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none cursor-not-allowed ${isDark ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400 shadow-inner'}`} 
                        value={madrasah?.email || ''} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 opacity-80">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center justify-between">
                      {lang === 'bn' ? 'অ্যাকাউন্ট পিন' : 'Account PIN'}
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-400/5 px-2 py-0.5 rounded-full border border-red-400/10">read-only</span>
                    </label>
                    <div className="relative group grayscale pointer-events-none">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Fingerprint size={16} />
                      </div>
                      <input 
                        type="text" 
                        readOnly 
                        disabled 
                        className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none cursor-not-allowed font-mono ${isDark ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400 shadow-inner'}`} 
                        value={madrasah?.config_json?.user_pin || ''} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme & Receipt Print Mode Card */}
              <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Printer size={20} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      {lang === 'bn' ? 'থিম ও প্রিন্ট সেটিংস' : 'Theme & Print Settings'}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      {lang === 'bn' ? 'অ্যাপ থিম ও রশিদ প্রিন্ট মোড' : 'Appearance & receipt printer'}
                    </p>
                  </div>
                </div>

                {/* Theme Toggle */}
                <div className={`flex items-center justify-between gap-4 p-4 rounded-[1.5rem] border transition-all ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-blue-50 text-[#2563EB]'}`}>
                      {isDark ? <Moon size={18} /> : <Sun size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {lang === 'bn' ? 'ডার্ক মোড থিম' : 'Dark Mode Theme'}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">
                        {isDark ? (lang === 'bn' ? 'ডার্ক থিম সক্রিয়' : 'Dark theme active') : (lang === 'bn' ? 'লাইট থিম সক্রিয়' : 'Light theme active')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    disabled={togglingTheme}
                    className={`w-12 h-6.5 shrink-0 rounded-full p-1 transition-colors relative ${isDark ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-5.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Receipt Print Mode Toggle */}
                <div className="space-y-3">
                  <label className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 ${receiptPrintMode ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50/40 border-blue-200 shadow-sm') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100')}`}>
                    <div className="relative inline-flex items-center">
                      <input type="checkbox" className="peer sr-only" checked={receiptPrintMode} onChange={(e) => setReceiptPrintMode(e.target.checked)} />
                      <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-[#2563EB] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black transition-colors ${receiptPrintMode ? (isDark ? 'text-blue-400' : 'text-[#2563EB]') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>
                        {lang === 'bn' ? 'রশিদ প্রিন্ট মোড' : 'Receipt Print Mode'}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">
                        {lang === 'bn' ? 'ডাউনলোডের পরিবর্তে সরাসরি প্রিন্ট করুন' : 'Direct print instead of download'}
                      </p>
                    </div>
                  </label>

                  {receiptPrintMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 space-y-3"
                    >
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {lang === 'bn' ? 'প্রিন্ট পেপার সাইজ' : 'Printer Paper Size'}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {['58mm', '80mm', 'A4', 'A5'].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setPrinterPaperSize(size)}
                            className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                              printerPaperSize === size
                                ? (isDark ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600')
                                : (isDark ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white border-slate-100 text-slate-400')
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
          </>
          )}

          {isAutomationMode && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Smart Automation Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{lang === 'bn' ? 'স্মার্ট অটোমেশন' : 'Smart Automation'}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'bn' ? 'স্বয়ংক্রিয় SMS ও বেতন নিয়ন্ত্রণ' : 'Auto SMS & salary rules'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: lang === 'bn' ? 'হাজিরা SMS' : 'Attendance SMS', description: lang === 'bn' ? 'শিক্ষার্থীদের হাজিরার পর SMS যাবে' : 'Auto SMS on attendance', checked: featureStudentAttSms, setter: setFeatureStudentAttSms },
                  { label: lang === 'bn' ? 'বেতন আদায় SMS' : 'Fee SMS', description: lang === 'bn' ? 'বেতন আদায়ের পর SMS যাবে' : 'Auto SMS on fee collection', checked: featureFeeSms, setter: setFeatureFeeSms },
                  { label: lang === 'bn' ? 'শিক্ষক বেতন SMS' : 'Teacher Salary SMS', description: lang === 'bn' ? 'শিক্ষক বেতন প্রদানের পর SMS যাবে' : 'Auto SMS on teacher salary', checked: featureTeacherSalarySms, setter: setFeatureTeacherSalarySms },
                  { label: lang === 'bn' ? 'শিক্ষক বেতন কর্তন' : 'Teacher Deduction', description: lang === 'bn' ? 'হাজিরার উপর ভিত্তি করে বেতন কর্তন' : 'Auto-deduct by attendance', checked: featureTeacherDeduction, setter: setFeatureTeacherDeduction },
                ].map((feature, idx) => (
                  <label key={idx} className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.01] ${feature.checked ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50/40 border-blue-200 shadow-sm') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100')}`}>
                    <div className="relative inline-flex items-center">
                      <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => feature.setter(e.target.checked)} />
                      <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-[#2563EB] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-blue-400' : 'text-[#2563EB]') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{feature.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>

            {/* Admin Permissions Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#FFF1F2] border-rose-200/50'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{lang === 'bn' ? 'অ্যাডমিন পারমিশন' : 'Admin Permissions'}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'bn' ? 'সতর্কতার সাথে ব্যবহার করুন (অটো-সেভ)' : 'Use with caution (Auto-saved)'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'delete_class' as const, label: lang === 'bn' ? 'ক্লাস ডিলিট' : 'Delete Class', description: lang === 'bn' ? 'ক্লাস ডিলিট করার অপশন চালু করুন' : 'Enable option to delete classes', checked: featureDeleteClass },
                  { key: 'delete_accounting' as const, label: lang === 'bn' ? 'হিসাব ইতিহাস ডিলিট' : 'Delete Accounting History', description: lang === 'bn' ? 'হিসাবের লেনদেন ডিলিট করুন' : 'Enable option to delete transactions', checked: featureDeleteAccounting },
                ].map((feature, idx) => (
                  <label key={idx} className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.01] ${feature.checked ? (isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white border-rose-200 shadow-md shadow-rose-500/5') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/70 border-transparent')}`}>
                    <div className="relative inline-flex items-center">
                      <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => handleToggleAdminFeature(feature.key, e.target.checked)} />
                      <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-rose-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-rose-400' : 'text-rose-600') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{feature.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Zero-Cost Internet Bulk Voice Call Automation Controls (Attendance & Due Fee) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Wifi size={22} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`text-base font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {lang === 'bn' ? 'ফ্রি ইন্টারনেট ভয়েস কল অটোমেশন ও পারমিশন' : 'Zero-Cost Internet Voice Call Automation'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {lang === 'bn' ? '০ টাকা / ফ্রি' : '0 BDT / Free'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 font-noto mt-0.5">
                    {lang === 'bn'
                      ? 'হাজিরা অনুপস্থিতি ও বকেয়া ফি রিমাইন্ডারে শুধুমাত্র সুপার অ্যাডমিন অনুমোদিত ভয়েস ব্যবহার করে ফ্রি ইন্টারনেট কল চালু/বন্ধ করুন'
                      : 'Configure zero-cost internet voice calls for Attendance Absence & Fee Due Reminders'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchInstitutionVoiceTemplates}
                disabled={loadingVoiceTemplates}
                className={`px-3.5 py-2 rounded-xl border text-xs font-black font-noto flex items-center gap-1.5 self-start sm:self-auto active:scale-95 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
              >
                <RefreshCw size={14} className={loadingVoiceTemplates ? 'animate-spin' : ''} />
                <span>{lang === 'bn' ? 'ভয়েস তালিকা রিফ্রেশ' : 'Refresh Voices'}</span>
              </button>
            </div>

            {!canConfigureInternetVoice && (
              <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-bold font-noto ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <span>
                  {lang === 'bn'
                    ? 'ইন্টারনেট ভয়েস কল পাঠানোর জন্য সুপার অ্যাডমিন প্যানেল থেকে এই প্রতিষ্ঠানের "প্যারেন্ট পোর্টাল" এবং "লাইভ চ্যাট" মডিউল অ্যাক্টিভ থাকতে হবে।'
                    : 'Parent Portal and Live Chat permissions must be enabled by Super Admin to broadcast zero-cost internet voice calls.'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Control 1: Attendance Absence Internet Voice Call */}
              <div className={`p-5 rounded-3xl border space-y-4 transition-all ${featureInternetVoiceAttendance ? (isDark ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50/40 border-emerald-200') : (isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/80')}`}>
                <label className="flex items-start gap-3.5 cursor-pointer">
                  <div className="relative inline-flex items-center mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={featureInternetVoiceAttendance}
                      onChange={(e) => setFeatureInternetVoiceAttendance(e.target.checked)}
                    />
                    <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-300'} peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black font-noto ${featureInternetVoiceAttendance ? (isDark ? 'text-emerald-400' : 'text-emerald-800') : (isDark ? 'text-slate-200' : 'text-slate-800')}`}>
                      {lang === 'bn' ? 'হাজিরা ফ্রি ইন্টারনেট ভয়েস কল (অনুপস্থিতি)' : 'Attendance Free Internet Voice Call (Absence)'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold font-noto mt-0.5">
                      {lang === 'bn' ? 'হাজিরা পেজে অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের ফ্রি ইন্টারনেট ভয়েস কল বাটন চালু করুন' : 'Enable zero-cost internet voice call alert for absent students in Attendance'}
                    </p>
                  </div>
                </label>

                {featureInternetVoiceAttendance && (
                  <div className="space-y-3 pt-2 border-t border-emerald-500/15">
                    <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer ${isDark ? 'bg-slate-900/60 border-slate-700 text-slate-300' : 'bg-white border-emerald-100 text-slate-700'}`}>
                      <input
                        type="checkbox"
                        checked={featureInternetVoiceAttendanceAutoSend}
                        onChange={(e) => setFeatureInternetVoiceAttendanceAutoSend(e.target.checked)}
                        className="w-4 h-4 rounded accent-emerald-600"
                      />
                      <span className="text-xs font-bold font-noto">
                        {lang === 'bn' ? 'হাজিরা সেভ করার সাথে সাথে অটো ফ্রি ভয়েস কল পাঠান' : 'Auto-send internet voice call when Attendance is saved'}
                      </span>
                    </label>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                        {lang === 'bn' ? 'সুপার অ্যাডমিন অনুমোদিত ভয়েস টেমপ্লেট নির্বাচন' : 'Select SuperAdmin-Approved Voice Template'}
                      </label>
                      <select
                        value={featureInternetVoiceAttendanceTemplateId}
                        onChange={(e) => setFeatureInternetVoiceAttendanceTemplateId(e.target.value)}
                        className={`w-full h-11 px-3.5 rounded-xl border text-xs font-bold font-noto outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                      >
                        <option value="">
                          {approvedVoiceTemplates.length === 0
                            ? (lang === 'bn' ? '-- কোনো অনুমোদিত ভয়েস পাওয়া যায়নি --' : '-- No approved voices found --')
                            : (lang === 'bn' ? '-- অনুমোদিত ভয়েস নির্বাচন করুন --' : '-- Select approved voice --')}
                        </option>
                        {approvedVoiceTemplates.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} {v.provider_status === 'internet_only' ? '(ফ্রি ইন্টারনেট)' : ''}
                          </option>
                        ))}
                      </select>
                      {pendingVoiceTemplates.length > 0 && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-noto px-1">
                          {lang === 'bn'
                            ? `${pendingVoiceTemplates.length}টি ভয়েস সুপার অ্যাডমিন অনুমোদনের অপেক্ষায় আছে।`
                            : `${pendingVoiceTemplates.length} voice(s) pending Super Admin approval.`}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openInlineVoiceRecorder('attendance')}
                      className={`w-full py-2.5 px-3 rounded-xl border text-xs font-black font-noto flex items-center justify-center gap-2 transition-all active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700' : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                    >
                      <Mic size={15} />
                      <span>
                        {activeVoiceRecorderTarget === 'attendance'
                          ? (lang === 'bn' ? 'রেকর্ডার বন্ধ করুন' : 'Close Recorder')
                          : (lang === 'bn' ? 'কাস্টম ভয়েস রেকর্ড / আপলোড করুন (অনুমোদনের জন্য)' : 'Record / Upload Custom Voice (For Approval)')}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Control 2: Due Fee Reminder Internet Voice Call */}
              <div className={`p-5 rounded-3xl border space-y-4 transition-all ${featureInternetVoiceDueFee ? (isDark ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-indigo-50/40 border-indigo-200') : (isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/80')}`}>
                <label className="flex items-start gap-3.5 cursor-pointer">
                  <div className="relative inline-flex items-center mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={featureInternetVoiceDueFee}
                      onChange={(e) => setFeatureInternetVoiceDueFee(e.target.checked)}
                    />
                    <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-300'} peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black font-noto ${featureInternetVoiceDueFee ? (isDark ? 'text-indigo-400' : 'text-indigo-800') : (isDark ? 'text-slate-200' : 'text-slate-800')}`}>
                      {lang === 'bn' ? 'বকেয়া ফি রিমাইন্ডার ফ্রি ইন্টারনেট ভয়েস কল' : 'Due Fee Reminder Free Internet Voice Call'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold font-noto mt-0.5">
                      {lang === 'bn' ? 'হিসাব / ফি পেজে বকেয়া থাকা অভিভাবকদের ফ্রি ইন্টারনেট ভয়েস রিমাইন্ডার বাটন চালু করুন' : 'Enable zero-cost internet voice due fee reminder button in Fee Collection'}
                    </p>
                  </div>
                </label>

                {featureInternetVoiceDueFee && (
                  <div className="space-y-3 pt-2 border-t border-indigo-500/15">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                        {lang === 'bn' ? 'সুপার অ্যাডমিন অনুমোদিত ভয়েস টেমপ্লেট নির্বাচন' : 'Select SuperAdmin-Approved Voice Template'}
                      </label>
                      <select
                        value={featureInternetVoiceDueFeeTemplateId}
                        onChange={(e) => setFeatureInternetVoiceDueFeeTemplateId(e.target.value)}
                        className={`w-full h-11 px-3.5 rounded-xl border text-xs font-bold font-noto outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                      >
                        <option value="">
                          {approvedVoiceTemplates.length === 0
                            ? (lang === 'bn' ? '-- কোনো অনুমোদিত ভয়েস পাওয়া যায়নি --' : '-- No approved voices found --')
                            : (lang === 'bn' ? '-- অনুমোদিত ভয়েস নির্বাচন করুন --' : '-- Select approved voice --')}
                        </option>
                        {approvedVoiceTemplates.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} {v.provider_status === 'internet_only' ? '(ফ্রি ইন্টারনেট)' : ''}
                          </option>
                        ))}
                      </select>
                      {pendingVoiceTemplates.length > 0 && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-noto px-1">
                          {lang === 'bn'
                            ? `${pendingVoiceTemplates.length}টি ভয়েস সুপার অ্যাডমিন অনুমোদনের অপেক্ষায় আছে।`
                            : `${pendingVoiceTemplates.length} voice(s) pending Super Admin approval.`}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openInlineVoiceRecorder('due_fee')}
                      className={`w-full py-2.5 px-3 rounded-xl border text-xs font-black font-noto flex items-center justify-center gap-2 transition-all active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
                    >
                      <Mic size={15} />
                      <span>
                        {activeVoiceRecorderTarget === 'due_fee'
                          ? (lang === 'bn' ? 'রেকর্ডার বন্ধ করুন' : 'Close Recorder')
                          : (lang === 'bn' ? 'কাস্টম ভয়েস রেকর্ড / আপলোড করুন (অনুমোদনের জন্য)' : 'Record / Upload Custom Voice (For Approval)')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Shared Inline Internet-Only Custom Voice Recorder & Uploader */}
            {activeVoiceRecorderTarget && (
              <div className={`p-5 rounded-3xl border space-y-4 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PhoneCall size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <h4 className={`text-xs sm:text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {activeVoiceRecorderTarget === 'attendance'
                        ? (lang === 'bn' ? 'হাজিরা অনুপস্থিতির কাস্টম ইন্টারনেট ভয়েস রেকর্ড/আপলোড' : 'Record/Upload Attendance Internet Voice')
                        : (lang === 'bn' ? 'বকেয়া ফি রিমাইন্ডারের কাস্টম ইন্টারনেট ভয়েস রেকর্ড/আপলোড' : 'Record/Upload Due Fee Internet Voice')}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveVoiceRecorderTarget(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={customVoiceTitle}
                    onChange={(e) => setCustomVoiceTitle(e.target.value)}
                    placeholder={lang === 'bn' ? 'ভয়েসের শিরোনাম লিখুন...' : 'Voice template title...'}
                    className={`h-11 px-4 rounded-xl border text-xs font-bold font-noto outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                  />

                  <div className="flex items-center gap-2">
                    {!isRecordingCustomVoice ? (
                      <button
                        type="button"
                        onClick={startCustomVoiceRecording}
                        className="flex-1 h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black font-noto flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Mic size={15} />
                        <span>{lang === 'bn' ? 'ভয়েস রেকর্ড করুন' : 'Record Voice'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCustomVoiceRecording}
                        className="flex-1 h-11 px-4 rounded-xl bg-slate-900 text-white text-xs font-black font-noto flex items-center justify-center gap-2 animate-pulse"
                      >
                        <Square size={14} className="fill-current text-rose-500" />
                        <span>{lang === 'bn' ? `থামান (${recordingSeconds}s)` : `Stop (${recordingSeconds}s)`}</span>
                      </button>
                    )}

                    <label className={`h-11 px-4 rounded-xl border text-xs font-black font-noto flex items-center justify-center gap-1.5 cursor-pointer ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                      <Upload size={14} />
                      <span>{lang === 'bn' ? 'ফাইল' : 'File'}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setCustomVoiceFile(f);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {customVoiceFile && customVoicePreviewUrl && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <audio controls src={customVoicePreviewUrl} className="w-full sm:flex-1 h-10" />
                    <button
                      type="button"
                      onClick={handleUploadCustomInternetVoice}
                      disabled={isUploadingCustomVoice || !customVoiceTitle.trim()}
                      className="w-full sm:w-auto px-5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black font-noto flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                    >
                      {isUploadingCustomVoice ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      <span>{lang === 'bn' ? 'অনুমোদনের জন্য পাঠান' : 'Submit for Approval'}</span>
                    </button>
                  </div>
                )}

                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-noto">
                  {lang === 'bn'
                    ? '* রেকর্ডকৃত অডিও স্বয়ংক্রিয়ভাবে কম মেগাবাইটে (Opus 24kbps) কম্প্রেস হয়ে শুধুমাত্র ইন্টারনেট ভয়েস কলের জন্য সংরক্ষিত হবে এবং সুপার অ্যাডমিন অনুমোদনের পর ব্যবহার করা যাবে।'
                    : '* Recorded audio is compressed (Opus 24kbps) for internet_only calls and requires Super Admin approval.'}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>{lang === 'bn' ? 'ইন্টারনেট ভয়েস সেটিংস সেভ করুন' : 'Save Voice Settings'}</span>
              </button>
            </div>
          </motion.div>

          {/* Smartphone Push & In-App Notification Configuration Card - Only if Parent Portal is active */}
          {Boolean((madrasah?.config_json as any)?.modules?.parent_portal === true) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} shadow-inner`}>
                  <BellRing size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-base font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {lang === 'bn' ? 'স্মার্টফোন পুশ নোটিফিকেশন কনফিগারেশন' : 'Smartphone Push Notification Configuration'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      FCM + In-App
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 font-noto mt-0.5">
                    {lang === 'bn' 
                      ? 'শিক্ষার্থীর হাজিরা ও বেতন আদায়ের সাথে সাথে অভিভাবকের মোবাইল অ্যাপে স্বয়ংক্রিয় পুশ অ্যালার্ট ও ইন-অ্যাপ নোটিফিকেশন'
                      : 'Automatic smartphone push alerts & in-app notifications for attendance and fee collection'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={testingNotifPush}
                  className={`px-3.5 py-2.5 rounded-xl border text-[11px] font-bold font-noto flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                    isDark 
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={lang === 'bn' ? 'টেস্ট নোটিফিকেশন পাঠান' : 'Send Test Notification'}
                >
                  {testingNotifPush ? <Loader2 size={14} className="animate-spin text-emerald-500" /> : <Smartphone size={14} className="text-emerald-500" />}
                  <span>{lang === 'bn' ? 'টেস্ট নোটিফিকেশন' : 'Test Push'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveNotifSettings}
                  disabled={savingNotifSettings}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black font-noto uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingNotifSettings ? <Loader2 size={14} className="animate-spin" /> : notifSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                  <span>{notifSaveSuccess ? (lang === 'bn' ? 'সংরক্ষিত!' : 'Saved!') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Settings')}</span>
                </button>
              </div>
            </div>

            {/* Notification Sections */}
            <div className="space-y-6">
              
              {/* 1. Attendance Absence Push Notification Toggle & Template */}
              <div className={`p-5 rounded-2xl border transition-all ${
                notifAttendanceEnabled 
                  ? (isDark ? 'bg-blue-500/5 border-blue-500/30' : 'bg-blue-50/40 border-blue-200/80')
                  : (isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200/60')
              }`}>
                {/* Toggle Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      notifAttendanceEnabled 
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' 
                        : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')
                    }`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {lang === 'bn' ? 'অনুপস্থিতি হলে নোটিফিকেশন পাঠানো হবে' : 'Send Push Notification for Absentees'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold font-noto">
                        {lang === 'bn' ? 'হাজিরা নেওয়ার সময় শিক্ষার্থী অনুপস্থিত থাকলে তৎক্ষণাৎ পুশ ও ইন-অ্যাপ নোটিফিকেশন পৌঁছাবে' : 'Notify guardians when student is marked absent during attendance'}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notifAttendanceEnabled}
                      onChange={(e) => setNotifAttendanceEnabled(e.target.checked)}
                    />
                    <div className={`w-12 h-6.5 rounded-full transition-all duration-300 relative ${
                      isDark ? 'bg-slate-700' : 'bg-slate-200'
                    } peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[22px] shadow-inner`}></div>
                  </label>
                </div>

                {/* Expanded Settings when Active */}
                <AnimatePresence>
                  {notifAttendanceEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 pt-4 border-t border-blue-200/50 dark:border-blue-500/20 space-y-4"
                    >
                      {/* Title Input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
                          {lang === 'bn' ? 'নোটিফিকেশন শিরোনাম (Title)' : 'Notification Title'}
                        </label>
                        <input
                          type="text"
                          value={notifAbsentTitle}
                          onChange={(e) => setNotifAbsentTitle(e.target.value)}
                          placeholder="অনুপস্থিতি নোটিফিকেশন"
                          className={`w-full h-11 px-4 rounded-xl border font-bold text-xs outline-none transition-all ${
                            isDark 
                              ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                              : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500 shadow-sm'
                          }`}
                        />
                      </div>

                      {/* Template Textarea */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {lang === 'bn' ? 'মেসেজ টেমপ্লেট (Message Template)' : 'Message Template'}
                          </label>
                          <span className="text-[9px] font-bold text-slate-400 font-noto">
                            {lang === 'bn' ? 'নিচের ট্যাগগুলোতে ক্লিক করে মেসেজে যোগ করুন' : 'Click tags below to insert'}
                          </span>
                        </div>

                        <textarea
                          rows={3}
                          value={notifAbsentBodyTemplate}
                          onChange={(e) => setNotifAbsentBodyTemplate(e.target.value)}
                          placeholder="আস-সালামু আলাইকুম, {student_name} আজ {date} তারিখে ক্লাসে অনুপস্থিত রয়েছে।"
                          className={`w-full p-3.5 rounded-xl border font-noto text-xs leading-relaxed outline-none transition-all resize-y ${
                            isDark 
                              ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                              : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500 shadow-sm'
                          }`}
                        />

                        {/* Clickable Variable Tags */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {lang === 'bn' ? 'উপলব্ধ ভ্যারিয়েবলসমূহ:' : 'Available Tags:'}
                          </span>
                          {[
                            { tag: '{student_name}', label: 'শিক্ষার্থীর নাম' },
                            { tag: '{class_name}', label: 'শ্রেণি' },
                            { tag: '{roll}', label: 'রোল নম্বর' },
                            { tag: '{date}', label: 'তারিখ' },
                          ].map((t) => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => setNotifAbsentBodyTemplate(prev => prev + ' ' + t.tag)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold font-mono transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                isDark
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-xs'
                              }`}
                              title={`ক্লিক করে ${t.tag} যোগ করুন`}
                            >
                              <span>{t.tag}</span>
                              <span className="text-[9px] font-sans opacity-70 ml-1">({t.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Fee Payment Push Notification Toggle & Template */}
              <div className={`p-5 rounded-2xl border transition-all ${
                notifFeeEnabled 
                  ? (isDark ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50/40 border-emerald-200/80')
                  : (isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200/60')
              }`}>
                {/* Toggle Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      notifFeeEnabled 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30' 
                        : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')
                    }`}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {lang === 'bn' ? 'ফি আদায় হলে নোটিফিকেশন পাঠানো হবে' : 'Send Push Notification on Fee Payment'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold font-noto">
                        {lang === 'bn' ? 'অভিভাবকের কাছ থেকে যেকোনো ফি জমা নেওয়ার সাথে সাথে ডিজিটাল রসিদ ও নোটিফিকেশন পাঠানো হবে' : 'Notify guardians instantly whenever tuition or other fees are collected'}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notifFeeEnabled}
                      onChange={(e) => setNotifFeeEnabled(e.target.checked)}
                    />
                    <div className={`w-12 h-6.5 rounded-full transition-all duration-300 relative ${
                      isDark ? 'bg-slate-700' : 'bg-slate-200'
                    } peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[22px] shadow-inner`}></div>
                  </label>
                </div>

                {/* Expanded Settings when Active */}
                <AnimatePresence>
                  {notifFeeEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 pt-4 border-t border-emerald-200/50 dark:border-emerald-500/20 space-y-4"
                    >
                      {/* Title Input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
                          {lang === 'bn' ? 'নোটিফিকেশন শিরোনাম (Title)' : 'Notification Title'}
                        </label>
                        <input
                          type="text"
                          value={notifFeeTitle}
                          onChange={(e) => setNotifFeeTitle(e.target.value)}
                          placeholder="ফি আদায় নোটিফিকেশন"
                          className={`w-full h-11 px-4 rounded-xl border font-bold text-xs outline-none transition-all ${
                            isDark 
                              ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' 
                              : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm'
                          }`}
                        />
                      </div>

                      {/* Template Textarea */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {lang === 'bn' ? 'মেসেজ টেমপ্লেট (Message Template)' : 'Message Template'}
                          </label>
                          <span className="text-[9px] font-bold text-slate-400 font-noto">
                            {lang === 'bn' ? 'নিচের ট্যাগগুলোতে ক্লিক করে মেসেজে যোগ করুন' : 'Click tags below to insert'}
                          </span>
                        </div>

                        <textarea
                          rows={3}
                          value={notifFeeBodyTemplate}
                          onChange={(e) => setNotifFeeBodyTemplate(e.target.value)}
                          placeholder="আস-সালামু আলাইকুম, {student_name}-এর বেতন বাবদ {amount} ৳ সফলভাবে জমা হয়েছে। মাস: {month}।"
                          className={`w-full p-3.5 rounded-xl border font-noto text-xs leading-relaxed outline-none transition-all resize-y ${
                            isDark 
                              ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' 
                              : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm'
                          }`}
                        />

                        {/* Clickable Variable Tags */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {lang === 'bn' ? 'উপলব্ধ ভ্যারিয়েবলসমূহ:' : 'Available Tags:'}
                          </span>
                          {[
                            { tag: '{student_name}', label: 'শিক্ষার্থীর নাম' },
                            { tag: '{amount}', label: 'আদায়কৃত টাকা' },
                            { tag: '{month}', label: 'মাস' },
                            { tag: '{date}', label: 'তারিখ' },
                            { tag: '{roll}', label: 'রোল' },
                            { tag: '{class_name}', label: 'শ্রেণি' },
                          ].map((t) => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => setNotifFeeBodyTemplate(prev => prev + ' ' + t.tag)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold font-mono transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                isDark
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                              }`}
                              title={`ক্লিক করে ${t.tag} যোগ করুন`}
                            >
                              <span>{t.tag}</span>
                              <span className="text-[9px] font-sans opacity-70 ml-1">({t.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
          )}

          {/* Registration Number Auto Generator & Bulk Delete Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${genTargetField === 'biometric_id' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600')}`}>
                  {genTargetField === 'biometric_id' ? <Fingerprint size={20} /> : <Hash size={20} />}
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {genTargetField === 'biometric_id'
                      ? (lang === 'bn' ? 'বায়োমেট্রিক আইডি অটো-জেনারেটর ও বাল্ক ব্যবস্থাপনা' : 'Biometric ID Auto-Generator & Bulk Manager')
                      : (lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর অটো-জেনারেটর ও বাল্ক ব্যবস্থাপনা' : 'Auto Registration Generator & Bulk Manager')}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {genTargetField === 'biometric_id'
                      ? (lang === 'bn' ? 'ZKTeco মেশিনের জন্য শিক্ষার্থীদের শুধু সংখ্যা (0-9) আইডি তৈরি বা রিসেট করুন' : 'Generate pure numeric (0-9) IDs for ZKTeco machines or clear in bulk')
                      : (lang === 'bn' ? 'প্যাটার্ন অনুযায়ী সকল শিক্ষার্থীর রেজিঃ নম্বর জেনারেট বা বাল্ক ডিলিট করুন' : 'Generate pattern-based registration numbers or clear in bulk')}
                  </p>
                </div>
              </div>
            </div>

            {/* Target Field Switcher: Reg No vs Biometric ID */}
            <div className={`flex p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setGenTargetField('reg_no')}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${genTargetField === 'reg_no' ? (isDark ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20') : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Hash size={15} />
                {lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর' : 'Registration No'}
              </button>
              <button
                type="button"
                onClick={() => setGenTargetField('biometric_id')}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${genTargetField === 'biometric_id' ? (isDark ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20') : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Fingerprint size={15} />
                {lang === 'bn' ? 'বায়োমেট্রিক আইডি (Numeric Only)' : 'Biometric ID (Numeric Only)'}
              </button>
            </div>

            <div className="space-y-5 pt-2">
              {/* Pattern Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center justify-between">
                  <span>
                    {genTargetField === 'biometric_id'
                      ? (lang === 'bn' ? 'শুরুর সংখ্যা (শুধু ইংরেজি সংখ্যা, যেমন 101)' : 'Starting Number (Numeric Only, e.g. 101)')
                      : (lang === 'bn' ? 'প্যাটার্ন বা উদাহরণ ফরম্যাট' : 'Pattern Example Format')}
                  </span>
                  <span className={`text-[9px] font-bold ${genTargetField === 'biometric_id' ? 'text-emerald-500' : 'text-indigo-500'}`}>
                    {genTargetField === 'biometric_id' ? 'e.g. 101 / 1001' : 'e.g. Abc001 / REG001 / 2026-001'}
                  </span>
                </label>
                <div className="relative group">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {genTargetField === 'biometric_id' ? <Fingerprint size={16} /> : <Sparkles size={16} />}
                  </div>
                  {genTargetField === 'biometric_id' ? (
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={bioStartingNum} 
                      onChange={(e) => {
                        const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
                        const en = String(e.target.value || '').replace(/[০-৯]/g, d => String(bn.indexOf(d))).replace(/[^0-9]/g, '');
                        setBioStartingNum(en);
                      }} 
                      placeholder="101"
                      className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-mono font-black text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 text-emerald-400 focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-emerald-700 focus:border-emerald-500 focus:bg-white'}`}
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={regExamplePattern} 
                      onChange={(e) => setRegExamplePattern(e.target.value)} 
                      placeholder="Abc001"
                      className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'}`}
                    />
                  )}
                </div>
              </div>

              {/* Format Mode Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                  {lang === 'bn' ? 'জেনারেট করার পদ্ধতি' : 'Generation Mode'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRegFormatMode('class_serial')}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      regFormatMode === 'class_serial' 
                        ? (isDark ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm')
                        : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs">
                      <ListOrdered size={14} />
                      <span>{lang === 'bn' ? 'ক্লাসের সিরিয়াল অনুযায়ী' : 'By Class Serial'}</span>
                    </div>
                    <p className="text-[9px] mt-1 opacity-70 leading-snug">
                      {genTargetField === 'biometric_id'
                        ? (lang === 'bn' ? 'যেমন: ক্লাস ১ রোল ৫ -> 105, ক্লাস ২ রোল ১২ -> 212' : 'e.g. Class 1 Roll 5 -> 105, Class 2 Roll 12 -> 212')
                        : (lang === 'bn' ? 'যেমন: প্লে (সিরিয়াল ১) -> Abc101, নার্সারি (সিরিয়াল ২) -> Abc201' : 'e.g. Play (Serial 1) -> Abc101, Nursery (Serial 2) -> Abc201')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegFormatMode('global_seq')}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      regFormatMode === 'global_seq' 
                        ? (isDark ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm')
                        : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs">
                      <Hash size={14} />
                      <span>{lang === 'bn' ? 'একটানা গ্লোবাল সিরিয়াল' : 'Continuous Global Sequence'}</span>
                    </div>
                    <p className="text-[9px] mt-1 opacity-70 leading-snug">
                      {genTargetField === 'biometric_id'
                        ? (lang === 'bn' ? `যেমন: ক্রমান্বয়ে ${bioStartingNum || '101'}, ${(parseInt(bioStartingNum, 10) || 101) + 1}...` : `e.g. Sequentially ${bioStartingNum || '101'}, ${(parseInt(bioStartingNum, 10) || 101) + 1}...`)
                        : (lang === 'bn' ? 'যেমন: সকল শিক্ষার্থী ক্রমান্বয়ে Abc001, Abc002, Abc003...' : 'e.g. All students sequentially Abc001, Abc002, Abc003...')}
                    </p>
                  </button>
                </div>
              </div>

              {/* Scope & Overwrite Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                    {lang === 'bn' ? 'কোন শ্রেণির শিক্ষার্থীদের জন্য' : 'Target Scope'}
                  </label>
                  <select
                    value={regTargetScope}
                    onChange={(e) => setRegTargetScope(e.target.value)}
                    className={`w-full h-12 border-2 rounded-2xl px-4 font-black text-xs outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  >
                    <option value="all">{lang === 'bn' ? 'সকল শ্রেণির শিক্ষার্থী (All Classes)' : 'All Classes'}</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>{c.class_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1">
                    {lang === 'bn' ? 'জেনারেট করার শর্ত' : 'Overwrite Rule'}
                  </label>
                  <select
                    value={regOverwriteMode}
                    onChange={(e) => setRegOverwriteMode(e.target.value as any)}
                    className={`w-full h-12 border-2 rounded-2xl px-4 font-black text-xs outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  >
                    <option value="unassigned">{genTargetField === 'biometric_id' ? (lang === 'bn' ? 'কেবল যাদের বায়োমেট্রিক আইডি নেই' : 'Only for unassigned students') : (lang === 'bn' ? 'কেবল যাদের রেজিঃ নম্বর নেই' : 'Only for unassigned students')}</option>
                    <option value="all">{lang === 'bn' ? 'সকলের নতুন করে ওভাররাইট করুন' : 'Overwrite for all students'}</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 font-black text-[11px] uppercase tracking-wider">
                  <Sparkles size={14} />
                  <span>{lang === 'bn' ? 'লাইভ নমুনা প্রিভিউ (Sample Preview)' : 'Live Sample Preview'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {getRegLivePreview().map((item, i) => (
                    <div key={i} className={`p-2.5 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                      <span className="text-[10px] font-bold text-slate-400 block truncate">{item.className}</span>
                      <span className={`font-mono font-black mt-0.5 block truncate ${genTargetField === 'biometric_id' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{item.sampleReg}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteRegConfirm(true)}
                  disabled={isDeletingRegNo || isGeneratingRegNo}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-500/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  <span>{genTargetField === 'biometric_id' ? (lang === 'bn' ? 'বায়োমেট্রিক আইডি ডিলিট করুন' : 'Clear Biometric IDs') : (lang === 'bn' ? 'বাল্ক ডিলিট / রিসেট করুন' : 'Bulk Clear / Delete')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateRegNumbers}
                  disabled={isGeneratingRegNo || isDeletingRegNo}
                  className={`w-full sm:w-auto px-7 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${genTargetField === 'biometric_id' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                >
                  {isGeneratingRegNo ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  <span>{lang === 'bn' ? 'অটো-জেনারেট করুন' : 'Generate Now'}</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Bulk Delete Confirm Modal */}
          <AnimatePresence>
            {showDeleteRegConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`w-full max-w-md p-6 rounded-[2rem] border shadow-2xl space-y-5 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <AlertTriangle size={24} />
                  </div>

                  <div>
                    <h3 className="text-lg font-black font-noto">
                      {genTargetField === 'biometric_id'
                        ? (lang === 'bn' ? 'বায়োমেট্রিক আইডি ডিলিট নিশ্চিতকরণ' : 'Confirm Biometric ID Clear')
                        : (lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর ডিলিট নিশ্চিতকরণ' : 'Confirm Bulk Delete')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {lang === 'bn'
                        ? `আপনি কি নিশ্চিত যে ${regTargetScope === 'all' ? 'সকল শ্রেণির' : 'নির্বাচিত শ্রেণির'} শিক্ষার্থীদের ${genTargetField === 'biometric_id' ? 'বায়োমেট্রিক আইডি' : 'রেজিষ্ট্রেশন নম্বর'} স্থায়ীভাবে মুছে ফেলতে চান? এটি পুনরায় নতুন করে জেনারেট করার সুযোগ দেবে।`
                        : `Are you sure you want to clear ${genTargetField === 'biometric_id' ? 'Biometric IDs' : 'registration numbers'} for ${regTargetScope === 'all' ? 'all classes' : 'the selected class'}? You can regenerate them anytime later.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteRegConfirm(false)}
                      className={`flex-1 py-3 rounded-xl font-black text-xs uppercase border ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'}`}
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDeleteRegNumbers}
                      disabled={isDeletingRegNo}
                      className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                    >
                      {isDeletingRegNo ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      <span>{lang === 'bn' ? 'ডিলিট করুন' : 'Confirm Delete'}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          </>
          )}

          {/* Premium Branding Section */}
          {!isAutomationMode && isPremiumPackage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-6 md:p-8 rounded-[2.5rem] border space-y-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden'}`}
            >
              <div className="absolute top-0 right-0">
                <div className="bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-[1.5rem] shadow-sm">Premium Feature</div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{lang === 'bn' ? 'ডিজিটাল স্বাক্ষর স্টুডিও' : 'Digital Signature Studio'}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{lang === 'bn' ? 'অফিসিয়াল রিপোর্টে ব্যবহারের জন্য' : 'For usage in official reports'}</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                 <div className={`w-full md:w-64 aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center relative group transition-all duration-500 overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/30' : 'bg-slate-50 border-slate-200 hover:border-emerald-500/30'}`}>
                    {signatureUrl ? (
                      <div className="p-4 w-full h-full flex items-center justify-center">
                        <img src={signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain filter " crossOrigin="anonymous" style={{ height: `${signatureHeight * 1.8}px` }} />
                      </div>
                    ) : (
                      <div className="text-slate-300 flex flex-col items-center gap-2">
                        <Edit3 size={32} className="opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Signature</span>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-emerald-500/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                      <Upload className="text-white mb-1" size={24} />
                      <span className="text-[10px] text-white font-black uppercase tracking-widest">{lang === 'bn' ? 'পরিবর্তন' : 'Change'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'signature')} disabled={saving} />
                    </label>
                 </div>

                 <div className="flex-1 w-full space-y-6">
                    <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'স্বাক্ষরের সাইজ' : 'Signature Scale'}</label>
                        <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{signatureHeight}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="15" 
                        max="80" 
                        value={signatureHeight} 
                        onChange={(e) => setSignatureHeight(Number(e.target.value))} 
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">{lang === 'bn' ? '* একটি স্বচ্ছ ব্যাকগ্রাউন্ড সহ সাদা বা কালো স্বাক্ষর ব্যবহার করুন' : '* Use a clean signature with a transparent background'}</p>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {/* Action Area Mobile Only show */}
          <div className="md:hidden">
             <button onClick={handleUpdate} disabled={saving} className="w-full h-16 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-black rounded-[1.8rem] text-sm uppercase shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-blue-500/20">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
