import React, { useState, useEffect } from 'react';
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
  Smartphone,
  Trash2,
  Shield,
  Hash,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Institution, Language } from '../types';
import { requestManager } from '../services/RequestManager';
import { downloadBlob } from '../utils/fileDownloader';

interface Props {
  madrasah: Institution | null;
  lang: Language;
  onBack: () => void;
  onProfileUpdate?: () => void;
  setStatusModal: (s: any) => void;
}

const ProfileSettings: React.FC<Props> = ({ madrasah, lang, onBack, onProfileUpdate, setStatusModal }) => {
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
  const [biometricDevicesStr, setBiometricDevicesStr] = useState(((madrasah?.config_json as any)?.biometric_devices || []).map((d: any) => d.sn).join(', ') || 'PAS4254900230');
  const [biometricIp, setBiometricIp] = useState((madrasah?.config_json as any)?.biometric_ip || ((madrasah?.config_json as any)?.biometric_devices?.[0]?.ip) || '172.31.6.208');
  const [biometricPort, setBiometricPort] = useState((madrasah?.config_json as any)?.biometric_port || ((madrasah?.config_json as any)?.biometric_devices?.[0]?.port) || '4370');

  const [featureStudentAttSms, setFeatureStudentAttSms] = useState((madrasah?.config_json as any)?.features?.student_attendance_sms ?? false);
  const [featureFeeSms, setFeatureFeeSms] = useState((madrasah?.config_json as any)?.features?.fee_collection_sms ?? false);
  const [featureTeacherSalarySms, setFeatureTeacherSalarySms] = useState((madrasah?.config_json as any)?.features?.teacher_salary_sms ?? false);
  const [featureTeacherDeduction, setFeatureTeacherDeduction] = useState((madrasah?.config_json as any)?.features?.teacher_attendance_deduction ?? false);
  const [receiptPrintMode, setReceiptPrintMode] = useState((madrasah?.config_json as any)?.features?.receipt_print_mode ?? false);
  const [printerPaperSize, setPrinterPaperSize] = useState((madrasah?.config_json as any)?.features?.printer_paper_size ?? 'A4');

  const [featureDeleteClass, setFeatureDeleteClass] = useState((madrasah?.config_json as any)?.features?.delete_class ?? false);
  const [featureDeleteAccounting, setFeatureDeleteAccounting] = useState((madrasah?.config_json as any)?.features?.delete_accounting ?? false);

  // Registration Number Auto-Generator & Bulk Delete states
  const [regExamplePattern, setRegExamplePattern] = useState('Abc001');
  const [regFormatMode, setRegFormatMode] = useState<'class_serial' | 'global_seq'>('class_serial');
  const [regTargetScope, setRegTargetScope] = useState<string>('all');
  const [regOverwriteMode, setRegOverwriteMode] = useState<'unassigned' | 'all'>('unassigned');
  const [isGeneratingRegNo, setIsGeneratingRegNo] = useState(false);
  const [isDeletingRegNo, setIsDeletingRegNo] = useState(false);
  const [showDeleteRegConfirm, setShowDeleteRegConfirm] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [showSyncAgentModal, setShowSyncAgentModal] = useState(false);
  const [testingDevice, setTestingDevice] = useState(false);
  const [isDownloadingAgent, setIsDownloadingAgent] = useState<string | null>(null);

  const handleDownloadSyncAgent = async (format: 'bat' | 'ps1' | 'py') => {
    setIsDownloadingAgent(format);
    try {
      const sn = biometricDevicesStr.split(',')[0]?.trim() || 'PAS4254900230';
      const name = madrasah?.name || 'Deenora';
      const ip = biometricIp.trim() || '172.31.6.208';
      const port = biometricPort.trim() || '4370';
      const isPreviewHost = typeof window !== 'undefined' && (
        window.location.hostname.includes('run.app') || 
        window.location.hostname.includes('localhost') || 
        window.location.hostname.includes('aistudio')
      );
      const targetApiUrl = isPreviewHost ? 'https://deenora.app/api/iclock' : `${window.location.origin}/api/iclock`;
      const instId = madrasah?.id || '';
      const url = `/api/biometric-download?sn=${encodeURIComponent(sn)}&ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&name=${encodeURIComponent(name)}&institution_id=${encodeURIComponent(instId)}&api_url=${encodeURIComponent(targetApiUrl)}&format=${format}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to generate agent file');
      const blob = await res.blob();
      
      const ext = format === 'bat' ? 'bat' : (format === 'ps1' ? 'ps1' : 'py');
      const fileName = format === 'bat' 
        ? `Deenora-K40-Sync-${ip.replace(/\./g, '_')}.${ext}`
        : (format === 'ps1' ? `Deenora-K40-Sync-${ip.replace(/\./g, '_')}.${ext}` : `deenora_sync_${ip.replace(/\./g, '_')}.${ext}`);
      
      const mimeType = format === 'bat' 
        ? 'application/x-bat' 
        : (format === 'ps1' ? 'application/x-powershell' : 'text/x-python');

      await downloadBlob(blob, fileName, mimeType);
    } catch (err: any) {
      console.error('Download agent error:', err);
      alert('ফাইলটি পেতে সমস্যা হচ্ছে: ' + err.message);
    } finally {
      setIsDownloadingAgent(null);
    }
  };
  const [deviceStatusResult, setDeviceStatusResult] = useState<{
    status: 'success' | 'warning' | 'error';
    message: string;
    lastPunch?: string;
  } | null>(null);

  const [testBioId, setTestBioId] = useState('101');
  const [isTestingPunch, setIsTestingPunch] = useState(false);
  const [testPunchResult, setTestPunchResult] = useState<{
    status: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const handleSendTestPunch = async () => {
    if (!testBioId.trim()) return;
    setIsTestingPunch(true);
    setTestPunchResult(null);
    try {
      const sn = biometricDevicesStr.split(',')[0]?.trim() || 'PAS4254900230';
      const now = new Date();
      const checkTime = now.toISOString().replace('T', ' ').substring(0, 19);
      const res = await fetch('/api/iclock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sn: sn,
          logs: [
            {
              userId: testBioId.trim(),
              checkTime: checkTime
            }
          ]
        })
      });

      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setTestPunchResult({
          status: data.processed > 0 ? 'success' : 'warning',
          message: data.message || `আইডি ${testBioId} এর জন্য সিঙ্ক সম্পন্ন হয়েছে!`
        });
      } else {
        setTestPunchResult({
          status: 'error',
          message: 'টেস্ট রিকোয়েস্ট ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ বা সেটিংস চেক করুন।'
        });
      }
    } catch (err: any) {
      setTestPunchResult({
        status: 'error',
        message: err.message || 'টেস্ট রিকোয়েস্ট পাঠাতে ত্রুটি হয়েছে।'
      });
    } finally {
      setIsTestingPunch(false);
      fetchTodayPunches();
    }
  };

  const [todayPunches, setTodayPunches] = useState<any[]>([]);
  const [loadingPunches, setLoadingPunches] = useState(false);

  const fetchTodayPunches = async () => {
    if (!madrasah?.id) return;
    setLoadingPunches(true);
    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const utcDate = now.toISOString().substring(0, 10);
      const queryDates = Array.from(new Set([localDate, utcDate]));
      const { data: logs } = await supabase
        .from('attendance')
        .select('id, student_id, date, arrival_time, status, created_at, session, notes, students(student_name, roll, biometric_id, classes(class_name))')
        .eq('institution_id', madrasah.id)
        .in('date', queryDates)
        .order('created_at', { ascending: false })
        .limit(10);
      setTodayPunches(logs || []);
    } catch (err) {
      console.error('fetchTodayPunches error:', err);
    } finally {
      setLoadingPunches(false);
    }
  };

  const handleTestDeviceConnection = async () => {
    if (!madrasah?.id) return;
    setTestingDevice(true);
    setDeviceStatusResult(null);

    try {
      const snList = biometricDevicesStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (snList.length === 0) {
        setDeviceStatusResult({
          status: 'warning',
          message: lang === 'bn' 
            ? 'অনুগ্রহ করে প্রথমে মেশিনের সিরিয়াল নাম্বার (SN) ঘরটিতে লিখুন এবং সেভ করুন।' 
            : 'Please enter machine Serial Number (SN) first and save.'
        });
        return;
      }

      await fetchTodayPunches();

      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const utcDate = now.toISOString().substring(0, 10);
      const queryDates = Array.from(new Set([localDate, utcDate]));
      const { data: recentLogs } = await supabase
        .from('attendance')
        .select('id, created_at, notes, arrival_time, date, students(student_name, biometric_id)')
        .eq('institution_id', madrasah.id)
        .in('date', queryDates)
        .order('created_at', { ascending: false })
        .limit(10);

      const latestLog = recentLogs && recentLogs.length > 0 ? recentLogs[0] : null;

      if (latestLog) {
        const punchTime = latestLog.arrival_time || new Date(latestLog.created_at).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US');
        const studentInfo = (latestLog as any).students?.student_name ? ` (শিক্ষার্থী: ${(latestLog as any).students?.student_name})` : '';
        setDeviceStatusResult({
          status: 'success',
          message: lang === 'bn'
            ? `সফল! আজ আপনার মেশিন থেকে লাইভ পাঞ্চের ডাটা Deenora সার্ভারে যুক্ত হয়েছে${studentInfo}।`
            : `Success! Today's punch data is active on Deenora server${studentInfo}.`,
          lastPunch: punchTime
        });
      } else {
        setDeviceStatusResult({
          status: 'success',
          message: lang === 'bn'
            ? `মেশিনের সিরিয়াল নাম্বার (${snList.join(', ')}) সার্ভারে রেজিস্টার্ড রয়েছে। মেশিনে কার্ড পাঞ্চ বা আঙ্গুল ছুঁইয়ে (Punch) টেস্ট করুন, উপস্থিতিতে সাথে সাথে যুক্ত হবে।`
            : `Serial Number (${snList.join(', ')}) is registered on server. Perform a test punch on the machine now.`
        });
      }
    } catch (err: any) {
      setDeviceStatusResult({
        status: 'error',
        message: err.message || 'Connection test failed.'
      });
    } finally {
      setTestingDevice(false);
    }
  };

  useEffect(() => {
    if (madrasah) {
      setNewName(madrasah.name || '');
      setNewAddress(madrasah.address || '');
      setNewPhone(madrasah.phone || '');
      setNewContactEmail(madrasah.contact_email || '');
      setLogoUrl(madrasah.logo_url || '');
      setVoiceSenderId(madrasah.voice_sender_id || '');
      const config = typeof madrasah.config_json === 'string'
        ? (() => { try { return JSON.parse(madrasah.config_json); } catch(e) { return {}; } })()
        : (madrasah.config_json || {});
      setArabicCalligraphyUrl(config.arabic_calligraphy_url || '');
      setArabicCalligraphyWidth(config.arabic_calligraphy_width || 100);
      setNewPin(config.user_pin || '');
      setSignatureUrl(config.signature_url || '');
      setSignatureHeight(config.signature_height || 30);
      const snStr = (config.biometric_devices || []).map((d: any) => d.sn).join(', ');
      setBiometricDevicesStr(snStr || 'PAS4254900230');
      setBiometricIp(config.biometric_ip || config.biometric_devices?.[0]?.ip || '172.31.6.208');
      setBiometricPort(config.biometric_port || config.biometric_devices?.[0]?.port || '4370');
      setFeatureStudentAttSms(config.features?.student_attendance_sms ?? false);
      setFeatureFeeSms(config.features?.fee_collection_sms ?? false);
      setFeatureTeacherSalarySms(config.features?.teacher_salary_sms ?? false);
      setFeatureTeacherDeduction(config.features?.teacher_attendance_deduction ?? false);
      setReceiptPrintMode(config.features?.receipt_print_mode ?? false);
      setPrinterPaperSize(config.features?.printer_paper_size ?? 'A4');
      setFeatureDeleteClass(config.features?.delete_class ?? false);
      setFeatureDeleteAccounting(config.features?.delete_accounting ?? false);
      fetchTodayPunches();
    }
  }, [madrasah]);

  useEffect(() => {
    if (!madrasah?.id) return;
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
  }, [madrasah?.id]);

  const getRegLivePreview = () => {
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
        .select('id, class_id, roll, student_name, registration_number')
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
        targetStudents = fetchedStudents.filter(s => !s.registration_number || s.registration_number.trim() === '');
        if (targetStudents.length === 0) {
          setStatusModal({
            show: true,
            type: 'info',
            title: lang === 'bn' ? 'তথ্য' : 'Info',
            message: lang === 'bn' ? 'সকল শিক্ষার্থীর ইতিমধ্যেই রেজিষ্ট্রেশন নম্বর বসানো আছে।' : 'All students already have registration numbers.'
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

      const updates: Array<{ id: string; registration_number: string }> = [];
      let globalSeqCounter = startingNum;

      const targetClassesToProcess = regTargetScope === 'all'
        ? sortedClasses
        : sortedClasses.filter(c => c.id === regTargetScope);

      targetClassesToProcess.forEach(cls => {
        const cSerial = classSerialMap.get(cls.id) || 1;
        const clsStudents = studentsByClass.get(cls.id) || [];
        clsStudents.sort((a, b) => (Number(a.roll) || 9999) - (Number(b.roll) || 9999));

        clsStudents.forEach((st, sIndex) => {
          const rollNum = st.roll || (sIndex + 1);
          let regStr = '';
          if (regFormatMode === 'class_serial') {
            regStr = `${prefix}${cSerial}${String(rollNum).padStart(paddingLength, '0')}`;
          } else {
            regStr = `${prefix}${String(globalSeqCounter).padStart(paddingLength, '0')}`;
            globalSeqCounter++;
          }
          updates.push({
            id: st.id,
            registration_number: regStr
          });
        });
      });

      for (let i = 0; i < updates.length; i += 50) {
        const chunk = updates.slice(i, i + 50);
        const results = await Promise.all(
          chunk.map(u =>
            supabase
              .from('students')
              .update({ registration_number: u.registration_number })
              .eq('id', u.id)
              .eq('institution_id', madrasah.id)
          )
        );
        const firstErr = results.find(r => r.error)?.error;
        if (firstErr) throw firstErr;
      }

      requestManager.invalidatePattern(`students:${madrasah.id}`);
      if (onProfileUpdate) onProfileUpdate();

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল!' : 'Success!',
        message: lang === 'bn'
          ? `মোট ${updates.length} জন শিক্ষার্থীর রেজিষ্ট্রেশন নম্বর সফলভাবে জেনারেট করা হয়েছে।`
          : `Successfully generated registration numbers for ${updates.length} students.`
      });
    } catch (err: any) {
      console.error('Registration generation error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ!' : 'Failed!',
        message: err.message || 'Failed to generate registration numbers.'
      });
    } finally {
      setIsGeneratingRegNo(false);
    }
  };

  const handleBulkDeleteRegNumbers = async () => {
    if (!madrasah?.id) return;
    setIsDeletingRegNo(true);
    try {
      let query = supabase.from('students').select('id').eq('institution_id', madrasah.id);
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
          message: lang === 'bn' ? 'রিসেট করার মতো কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found to clear registration numbers.'
        });
        return;
      }

      const updates = targetStudents.map(s => ({
        id: s.id,
        registration_number: null
      }));

      for (let i = 0; i < updates.length; i += 50) {
        const chunk = updates.slice(i, i + 50);
        const results = await Promise.all(
          chunk.map(u =>
            supabase
              .from('students')
              .update({ registration_number: null })
              .eq('id', u.id)
              .eq('institution_id', madrasah.id)
          )
        );
        const firstErr = results.find(r => r.error)?.error;
        if (firstErr) throw firstErr;
      }

      requestManager.invalidatePattern(`students:${madrasah.id}`);
      if (onProfileUpdate) onProfileUpdate();

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল!' : 'Success!',
        message: lang === 'bn'
          ? `মোট ${updates.length} জন শিক্ষার্থীর রেজিষ্ট্রেশন নম্বর ডিলিট/রিসেট করা হয়েছে।`
          : `Cleared registration numbers for ${updates.length} students.`
      });
    } catch (err: any) {
      console.error('Bulk clear error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ!' : 'Failed!',
        message: err.message || 'Failed to clear registration numbers.'
      });
    } finally {
      setIsDeletingRegNo(false);
      setShowDeleteRegConfirm(false);
    }
  };

  const isDark = madrasah?.theme === 'dark';
  const parsedConfig = React.useMemo(() => {
    if (!madrasah?.config_json) return {};
    if (typeof madrasah.config_json === 'string') {
      try { return JSON.parse(madrasah.config_json); } catch (e) { return {}; }
    }
    return (madrasah.config_json as any) || {};
  }, [madrasah?.config_json]);

  const modules = parsedConfig?.modules || (madrasah?.config_json as any)?.modules || {};
  const isBiometricEnabled = true; // Always enabled so institutions can setup and connect ZKTeco K40 / biometric devices
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
    setBiometricDevicesStr((parsedConfig.biometric_devices || []).map((d: any) => d.sn).join(', ') || 'PAS4254900230');
    setBiometricIp(parsedConfig.biometric_ip || parsedConfig.biometric_devices?.[0]?.ip || '172.31.6.208');
    setBiometricPort(parsedConfig.biometric_port || parsedConfig.biometric_devices?.[0]?.port || '4370');

    const feats = parsedConfig.features || {};
    setFeatureStudentAttSms(feats.student_attendance_sms ?? false);
    setFeatureFeeSms(feats.fee_collection_sms ?? false);
    setFeatureTeacherSalarySms(feats.teacher_salary_sms ?? false);
    setFeatureTeacherDeduction(feats.teacher_attendance_deduction ?? false);
    setReceiptPrintMode(feats.receipt_print_mode ?? false);
    setPrinterPaperSize(feats.printer_paper_size ?? 'A4');

    setFeatureDeleteClass(feats.delete_class ?? false);
    setFeatureDeleteAccounting(feats.delete_accounting ?? false);
  }, [madrasah]);

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const currentConfigObj = typeof madrasah.config_json === 'string'
        ? (() => { try { return JSON.parse(madrasah.config_json); } catch (e) { return {}; } })()
        : (madrasah.config_json || {});

      const updatedConfig = { 
        ...currentConfigObj, 
        user_pin: newPin.trim(), 
        signature_url: signatureUrl,
        signature_height: signatureHeight,
        arabic_calligraphy_url: arabicCalligraphyUrl,
        arabic_calligraphy_width: arabicCalligraphyWidth,
        name_english: nameEnglish.trim(),
        biometric_ip: biometricIp.trim() || '172.31.6.208',
        biometric_port: biometricPort.trim() || '4370',
        ...(isBiometricEnabled
          ? { 
              biometric_devices: biometricDevicesStr.split(',').map(s => s.trim()).filter(Boolean).map(sn => ({ 
                sn, 
                ip: biometricIp.trim() || '172.31.6.208',
                port: biometricPort.trim() || '4370',
                name: "Device " + sn 
              })) 
            }
          : (currentConfigObj.biometric_devices ? { biometric_devices: currentConfigObj.biometric_devices } : {})
        ),
        features: {
          ...(currentConfigObj.features || {}),
          student_attendance_sms: featureStudentAttSms,
          fee_collection_sms: featureFeeSms,
          teacher_salary_sms: featureTeacherSalarySms,
          teacher_attendance_deduction: featureTeacherDeduction,
          receipt_print_mode: receiptPrintMode,
          printer_paper_size: printerPaperSize,
          delete_class: featureDeleteClass,
          delete_accounting: featureDeleteAccounting
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
            name: newName.trim(),
            address: newAddress.trim() || null,
            phone: newPhone.trim(),
            contact_email: newContactEmail.trim() || null,
            voice_sender_id: voiceSenderId.trim() || null,
            logo_url: logoUrl,
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
          name: newName.trim(), 
          address: newAddress.trim() || null,
          phone: newPhone.trim(), 
          contact_email: newContactEmail.trim() || null,
          voice_sender_id: voiceSenderId.trim() || null,
          logo_url: logoUrl,
          config_json: updatedConfig
        }).eq('id', madrasah.id);
        
        if (error) throw error;
      }
      
      // Update local cache so UI doesn't bounce
      try {
         const { OfflineService } = await import('../services/OfflineService');
         const cachedMadrasah = OfflineService.getCache('profile');
         if (cachedMadrasah && cachedMadrasah.id === madrasah.id) {
           OfflineService.setCache('profile', { ...cachedMadrasah, name: newName.trim(), address: newAddress.trim(), phone: newPhone.trim(), contact_email: newContactEmail.trim(), config_json: updatedConfig });
         }
      } catch(e) {}

      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: lang === 'bn' ? 'প্রোফাইল সেটিংস সফলভাবে সেভ হয়েছে' : 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
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
            <h1 className="text-xl font-black font-noto tracking-tight truncate">{lang === 'bn' ? 'প্রোফাইল সেটিংস' : 'Profile Settings'}</h1>
            <p className="text-[10px] font-bold text-slate-400 font-noto uppercase tracking-wider">{lang === 'bn' ? 'ব্র্যান্ডিং এবং তথ্য আপডেট' : 'Edit branding and info'}</p>
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

                {isBiometricEnabled && (
                  <div className="space-y-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Zap size={14} />
                        {lang === 'bn' ? 'বায়োমেট্রিক হাজিরা মেশিন সেটিংস (K40 / Non-ADMS)' : 'Biometric Machine Settings'}
                      </label>
                      <span className="text-[9px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                        ZKTeco K40, K14, ADMS
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-1">
                        {lang === 'bn' ? 'মেশিনের সিরিয়াল নাম্বার (Serial Number / SN):' : 'Machine Serial Number (SN):'}
                      </label>
                      <div className="relative group">
                        <input 
                          type="text" 
                          className={`w-full h-11 border-2 rounded-xl px-4 font-black font-mono text-[13px] outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-200 focus:border-[#2563EB]/40 text-slate-900 group-hover:bg-white focus:bg-white shadow-inner'}`} 
                          value={biometricDevicesStr} 
                          onChange={(e) => setBiometricDevicesStr(e.target.value)} 
                          placeholder="যেমন: PAS4254900230"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-1 flex items-center gap-1">
                          <span>🌐</span>
                          {lang === 'bn' ? 'মেশিন আইপি (Machine Local IP):' : 'Machine Local IP:'}
                        </label>
                        <input 
                          type="text" 
                          className={`w-full h-11 border-2 rounded-xl px-4 font-mono font-bold text-xs outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'}`}
                          value={biometricIp} 
                          onChange={(e) => setBiometricIp(e.target.value)} 
                          placeholder="যেমন: 172.31.6.208"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-1 flex items-center gap-1">
                          <span>🔌</span>
                          {lang === 'bn' ? 'মেশিন পোর্ট (Port):' : 'Machine Port:'}
                        </label>
                        <input 
                          type="text" 
                          className={`w-full h-11 border-2 rounded-xl px-4 font-mono font-bold text-xs outline-none transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'}`}
                          value={biometricPort} 
                          onChange={(e) => setBiometricPort(e.target.value)} 
                          placeholder="4370"
                        />
                      </div>
                    </div>

                    <p className={`text-[10px] ml-1 leading-snug p-2 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200/80 text-slate-500'}`}>
                      {lang === 'bn' 
                        ? '💡 আপনার K40 মেশিনের মেনু -> Comm. -> Ethernet অপশনে থাকা IP (যেমন 172.31.6.208) ও Port (4370) এখানে দিয়ে নিচে "সেভ করুন" বাটনে চাপ দিন। এরপর পিসি সিঙ্ক সফটওয়্যারটি ডাউনলোড করলে তা স্বয়ংক্রিয়ভাবে এই আইপি নিয়েই চলবে এবং উইন্ডো কেটে যাবে না।' 
                        : 'Enter K40 Ethernet IP and Port, then save. Downloaded agent will use this IP automatically.'}
                    </p>

                    <div className="pt-2 flex flex-col gap-3">
                      {/* 1. Connect / Start Sync Button */}
                      <button
                        type="button"
                        onClick={handleTestDeviceConnection}
                        disabled={testingDevice}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {testingDevice ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                        <span>{lang === 'bn' ? '▶️ Connect / Start Sync (কানেকশন ও লাইভ সিঙ্ক শুরু)' : '▶️ Connect / Start Sync (Live Device Sync)'}</span>
                      </button>

                      {/* 2. Quick Test Punch Simulator (e.g. for ID 101) */}
                      <div className="p-3 rounded-2xl border bg-slate-50/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span>🧪</span> {lang === 'bn' ? 'টেস্ট পাঞ্চ পাঠান (যেমন: আইডি 101)' : 'Send Test Punch (e.g. ID 101)'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">K40 Test</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={testBioId}
                            onChange={(e) => setTestBioId(e.target.value)}
                            placeholder="যেমন: 101"
                            className="w-28 h-9 px-3 rounded-lg border font-mono font-bold text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleSendTestPunch}
                            disabled={isTestingPunch || !testBioId.trim()}
                            className="flex-1 h-9 px-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isTestingPunch ? <Loader2 className="animate-spin" size={13} /> : <span>⚡</span>}
                            <span>{lang === 'bn' ? 'পাঞ্চ টেস্ট করুন' : 'Test Punch'}</span>
                          </button>
                        </div>
                        {testPunchResult && (
                          <div className={`p-2.5 rounded-xl border text-[11px] font-medium leading-relaxed ${
                            testPunchResult.status === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                              : testPunchResult.status === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                          }`}>
                            <p className="font-bold">{testPunchResult.message}</p>
                          </div>
                        )}
                      </div>

                      {/* 3. PC Sync Agent Guide & Download Modal */}
                      <button
                        type="button"
                        onClick={() => setShowSyncAgentModal(true)}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                      >
                        <Smartphone size={15} />
                        {lang === 'bn' ? '💻 পিসি সিংক সফটওয়্যার ও ডাউনলোড গাইড (Non-ADMS)' : '💻 PC Sync Software & Setup'}
                      </button>

                      {/* Guidance note */}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-blue-50/60 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 leading-normal">
                        💡 <strong className="text-blue-700 dark:text-blue-300">টিপস:</strong> আপনি যদি পিসি অ্যাপের <em>Connect / Start Sync</em> খুঁজে থাকেন, তবে ওয়েবসাইট থেকে সরাসরি পরীক্ষা করতে উপরের <strong>'▶️ Connect / Start Sync'</strong> বাটনে চাপ দিন। আর পিসিতে ডাউনলোড করা ১-ক্লিক স্ক্রিপ্ট বা অ্যাপটি ওপেন রাখলে ZKTeco K40 মেশিন থেকে লাইভ হাজিরা স্বয়ংক্রিয়ভাবে Deenora ক্লাউডে সিঙ্ক হতে থাকবে।
                      </p>

                      {deviceStatusResult && (
                        <div className={`p-3 rounded-xl border text-xs font-medium space-y-1 ${
                          deviceStatusResult.status === 'success' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                            : deviceStatusResult.status === 'warning'
                            ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                            : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                        }`}>
                          <div className="flex items-start gap-2">
                            <Zap size={15} className="mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">{deviceStatusResult.message}</p>
                              {deviceStatusResult.lastPunch && (
                                <p className="text-[11px] opacity-90 mt-1">
                                  🕒 {lang === 'bn' ? 'সর্বশেষ প্রাপ্ত পাঞ্চ:' : 'Last received punch:'} <span className="font-bold">{deviceStatusResult.lastPunch}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 4. Live Attendance Punch Monitor */}
                      <div className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            {lang === 'bn' ? '🔴 লাইভ পাঞ্চ মনিটর (আজকের উপস্থিতি)' : '🔴 Live Punch Monitor'}
                          </span>
                          <button
                            type="button"
                            onClick={fetchTodayPunches}
                            disabled={loadingPunches}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <RefreshCw size={12} className={loadingPunches ? 'animate-spin' : ''} />
                            <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                          </button>
                        </div>

                        {todayPunches.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            {loadingPunches ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin text-blue-500" />
                                <span>ডাটা যাচাই করা হচ্ছে...</span>
                              </div>
                            ) : (
                              <span>আজকে এখনও কোনো পাঞ্চ রেকর্ড নেই। উপরের "পাঞ্চ টেস্ট করুন" অথবা মেশিনে কার্ড পাঞ্চ করুন।</span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {todayPunches.map((punch: any, idx: number) => {
                              const std = punch.students || {};
                              const clsName = std.classes?.class_name || '';
                              return (
                                <div key={punch.id || idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                                      ✓
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-800 dark:text-slate-200">
                                        {std.student_name || 'শিক্ষার্থী'}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        {clsName ? `ক্লাস: ${clsName} • ` : ''}আইডি: {std.biometric_id || std.roll || punch.student_id?.substring(0, 6)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                      {punch.status === 'present' ? 'উপস্থিত' : punch.status}
                                    </span>
                                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                      🕒 {punch.arrival_time || new Date(punch.created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {isBiometricEnabled && showSyncAgentModal && (
              <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className={`w-full max-w-2xl p-6 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        ⚡
                      </div>
                      <div>
                        <h3 className="font-black text-base">Deenora ZKTeco PC Auto-Sync Agent</h3>
                        <p className="text-[11px] text-slate-400">Non-ADMS (ZKTeco K40, K14, etc.) এর জন্য ১-ক্লিক সিংক সেটআপ</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowSyncAgentModal(false)}
                      className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed">
                    <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/40 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 font-black text-sm text-emerald-700 dark:text-emerald-300">
                        <span>🚀 ১-ক্লিক উইন্ডোজ পিসি অটোকানেক্ট অ্যাপ (.exe / .bat Agent)</span>
                      </div>
                      <p className="text-[11px] font-medium leading-normal">
                        আপনার অফিসের ল্যাপটপ/পিসিতে আলাদা কোনো পাইথন বা সফটওয়্যার ইনস্টল করার প্রয়োজন নেই। নিচের বাটনটিতে ক্লিক করে ১-ক্লিক সিঙ্ক অ্যাপটি ডাউনলোড করে ডাবল-ক্লিক করুন। এটি স্বয়ংক্রিয়ভাবে K40 বায়োমেট্রিক মেশিনের সাথে কানেক্ট হয়ে ওয়েবসাইটে রিয়েল-টাইম হাজিরা পাঠানো শুরু করবে।
                      </p>

                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleDownloadSyncAgent('bat')}
                          disabled={Boolean(isDownloadingAgent)}
                          className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer font-noto"
                        >
                          {isDownloadingAgent === 'bat' ? <Loader2 className="animate-spin" size={15} /> : <span>📥 ১-ক্লিক উইন্ডোজ অটোকানেক্ট সিঙ্ক অ্যাপ ডাউনলোড (.exe / .bat)</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSyncAgent('ps1')}
                          disabled={Boolean(isDownloadingAgent)}
                          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer font-noto"
                        >
                          {isDownloadingAgent === 'ps1' ? <Loader2 className="animate-spin" size={15} /> : <span>⚡ পাওয়ারশেল সিঙ্ক ফাইল (.ps1)</span>}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <p className="font-bold text-slate-700 dark:text-slate-300">অথবা, পাইথন কোড ডাউনলোড বা কপি করুন (Python Option):</p>
                      <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-500">
                        <li>পিসিতে Python ইনস্টল থাকলে <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-blue-600">pip install zk requests</code> কম্যান্ডটি টার্মিনালে রান করুন।</li>
                        <li>নিচের পাইথন ফাইলটি ডাউনলোড করে অথবা কোড কপি করে রান করুন:</li>
                      </ol>

                      <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[10px] overflow-x-auto select-all">
{`from zk import ZK
import requests
import time

MACHINE_IP = '${biometricIp.trim() || '172.31.6.208'}' # Local K40 IP
MACHINE_PORT = ${biometricPort.trim() || '4370'}
DEVICE_SN = '${biometricDevicesStr.split(',')[0]?.trim() || 'PAS4254900230'}'
DEENORA_API = 'https://deenora.app/api/iclock'

print(f"Connecting to ZKTeco Machine at {MACHINE_IP}:{MACHINE_PORT}...")
zk = ZK(MACHINE_IP, port=MACHINE_PORT, timeout=5)

try:
    conn = zk.connect()
    print("✓ Successfully connected to ZKTeco K40 Machine!")
    
    while True:
        attendances = conn.get_attendance()
        if attendances:
            logs = []
            for att in attendances:
                logs.append({
                    "userId": str(att.user_id),
                    "checkTime": str(att.timestamp)
                })
            
            payload = {"sn": DEVICE_SN, "logs": logs}
            res = requests.post(DEENORA_API, json=payload)
            print(f"Syncing {len(logs)} logs to Deenora -> Status: {res.status_code}")
        
        time.sleep(3) # Check every 3 seconds

except Exception as e:
    print("Error:", e)`}
                      </pre>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleDownloadSyncAgent('py')}
                        disabled={Boolean(isDownloadingAgent)}
                        className="py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer font-noto"
                      >
                        {isDownloadingAgent === 'py' ? <Loader2 className="animate-spin" size={14} /> : <span>📄 deenora_sync.py পাইথন ফাইল ডিরেক্ট ডাউনলোড</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`from zk import ZK\nimport requests\nimport time\n\nMACHINE_IP = '${biometricIp.trim() || '172.31.6.208'}'\nMACHINE_PORT = ${biometricPort.trim() || '4370'}\nDEVICE_SN = '${biometricDevicesStr.split(',')[0]?.trim() || 'PAS4254900230'}'\nDEENORA_API = 'https://deenora.app/api/iclock'\n\nprint(f"Connecting to ZKTeco Machine at {MACHINE_IP}:{MACHINE_PORT}...")\nzk = ZK(MACHINE_IP, port=MACHINE_PORT, timeout=5)\n\ntry:\n    conn = zk.connect()\n    print("✓ Successfully connected to ZKTeco K40 Machine!")\n    while True:\n        attendances = conn.get_attendance()\n        if attendances:\n            logs = [{"userId": str(att.user_id), "checkTime": str(att.timestamp)} for att in attendances]\n            res = requests.post(DEENORA_API, json={"sn": DEVICE_SN, "logs": logs})\n            print(f"Syncing {len(logs)} logs -> Status: {res.status_code}")\n        time.sleep(3)\nexcept Exception as e:\n    print("Error:", e)`);
                          alert('পাইথন স্ক্রিপ্টের কোড কপি করা হয়েছে!');
                        }}
                        className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer font-noto"
                      >
                        📋 পাইথন কোড কপি করুন
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

               {/* Features Toggle Card */}
               <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#F1F5F9] border-slate-200/50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                    <Zap size={20} />
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'স্মার্ট অটোমেশন' : 'Smart Automation'}</h3>
                </div>

                <div className="space-y-4">
                  {[
                    { label: lang === 'bn' ? 'হাজিরা SMS' : 'Attendance SMS', description: lang === 'bn' ? 'শিক্ষার্থীদের হাজিরার পর SMS যাবে' : 'Auto SMS on attendance', checked: featureStudentAttSms, setter: setFeatureStudentAttSms },
                    { label: lang === 'bn' ? 'বেতন আদায় SMS' : 'Fee SMS', description: lang === 'bn' ? 'বেতন আদায়ের পর SMS যাবে' : 'Auto SMS on fee collection', checked: featureFeeSms, setter: setFeatureFeeSms },
                    { label: lang === 'bn' ? 'শিক্ষক বেতন SMS' : 'Teacher Salary SMS', description: lang === 'bn' ? 'শিক্ষক বেতন প্রদানের পর SMS যাবে' : 'Auto SMS on teacher salary', checked: featureTeacherSalarySms, setter: setFeatureTeacherSalarySms },
                    { label: lang === 'bn' ? 'শিক্ষক বেতন কর্তন' : 'Teacher Deduction', description: lang === 'bn' ? 'হাজিরার উপর ভিত্তি করে বেতন কর্তন' : 'Auto-deduct by attendance', checked: featureTeacherDeduction, setter: setFeatureTeacherDeduction },
                    { label: lang === 'bn' ? 'রশিদ প্রিন্ট মোড' : 'Receipt Print Mode', description: lang === 'bn' ? 'ডাউনলোডের পরিবর্তে সরাসরি প্রিন্ট করুন' : 'Direct print instead of download', checked: receiptPrintMode, setter: setReceiptPrintMode },
                  ].map((feature, idx) => (
                    <div key={idx} className="space-y-3">
                      <label className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.02] ${feature.checked ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white border-blue-100 shadow-md shadow-blue-500/5') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/60 border-transparent')}`}>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => feature.setter(e.target.checked)} />
                          <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-[#2563EB] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-blue-400' : 'text-[#2563EB]') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{feature.description}</p>
                        </div>
                      </label>
                      
                      {feature.label === (lang === 'bn' ? 'রশিদ প্রিন্ট মোড' : 'Receipt Print Mode') && feature.checked && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-3"
                        >
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'প্রিন্ট পেপার সাইজ' : 'Printer Paper Size'}</label>
                          <div className="grid grid-cols-4 gap-2">
                            {['58mm', '80mm', 'A4', 'A5'].map((size) => (
                              <button
                                key={size}
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
                  ))}
                </div>
              </div>

               {/* Admin Permissions Card */}
               <div className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#FFF1F2] border-rose-200/50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{lang === 'bn' ? 'অ্যাডমিন পারমিশন' : 'Admin Permissions'}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'bn' ? 'সতর্কতার সাথে ব্যবহার করুন' : 'Use with caution'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: lang === 'bn' ? 'ক্লাস ডিলিট' : 'Delete Class', description: lang === 'bn' ? 'ক্লাস ডিলিট করার অপশন চালু করুন' : 'Enable option to delete classes', checked: featureDeleteClass, setter: setFeatureDeleteClass },
                    { label: lang === 'bn' ? 'হিসাব ইতিহাস ডিলিট' : 'Delete Accounting History', description: lang === 'bn' ? 'হিসাবের লেনদেন ডিলিট করুন' : 'Enable option to delete transactions', checked: featureDeleteAccounting, setter: setFeatureDeleteAccounting },
                  ].map((feature, idx) => (
                    <label key={idx} className={`flex items-center gap-4 cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 group hover:scale-[1.02] ${feature.checked ? (isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white border-rose-200 shadow-md shadow-rose-500/5') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/60 border-transparent')}`}>
                      <div className="relative inline-flex items-center">
                        <input type="checkbox" className="peer sr-only" checked={feature.checked} onChange={(e) => feature.setter(e.target.checked)} />
                        <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${isDark ? 'bg-slate-700' : 'bg-slate-200'} peer-checked:bg-rose-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner shadow-black/5`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black transition-colors ${feature.checked ? (isDark ? 'text-rose-400' : 'text-rose-600') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{feature.label}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{feature.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Registration Number Auto Generator & Bulk Delete Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={`p-6 md:p-8 rounded-[2.5rem] border space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Hash size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর অটো-জেনারেটর ও বাল্ক ব্যবস্থাপনা' : 'Auto Registration Generator & Bulk Manager'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {lang === 'bn' ? 'প্যাটার্ন অনুযায়ী সকল শিক্ষার্থীর রেজিঃ নম্বর জেনারেট বা বাল্ক ডিলিট করুন' : 'Generate pattern-based registration numbers or clear in bulk'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-2">
              {/* Pattern Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 flex items-center justify-between">
                  <span>{lang === 'bn' ? 'প্যাটার্ন বা উদাহরণ ফরম্যাট' : 'Pattern Example Format'}</span>
                  <span className="text-[9px] text-indigo-500 font-bold">e.g. Abc001 / REG001 / 2026-001</span>
                </label>
                <div className="relative group">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Sparkles size={16} />
                  </div>
                  <input 
                    type="text" 
                    value={regExamplePattern} 
                    onChange={(e) => setRegExamplePattern(e.target.value)} 
                    placeholder="Abc001"
                    className={`w-full h-12 border-2 rounded-2xl pl-12 pr-4 font-black text-[13px] outline-none transition-all duration-300 font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white'}`}
                  />
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
                      {lang === 'bn' ? 'যেমন: প্লে (সিরিয়াল ১) -> Abc101, নার্সারি (সিরিয়াল ২) -> Abc201' : 'e.g. Play (Serial 1) -> Abc101, Nursery (Serial 2) -> Abc201'}
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
                      {lang === 'bn' ? 'যেমন: সকল শিক্ষার্থী ক্রমান্বয়ে Abc001, Abc002, Abc003...' : 'e.g. All students sequentially Abc001, Abc002, Abc003...'}
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
                    <option value="unassigned">{lang === 'bn' ? 'কেবল যাদের রেজিঃ নম্বর নেই' : 'Only for unassigned students'}</option>
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
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">{item.sampleReg}</span>
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
                  <span>{lang === 'bn' ? 'বাল্ক ডিলিট / রিসেট করুন' : 'Bulk Clear / Delete'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateRegNumbers}
                  disabled={isGeneratingRegNo || isDeletingRegNo}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
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
                      {lang === 'bn' ? 'রেজিষ্ট্রেশন নম্বর ডিলিট নিশ্চিতকরণ' : 'Confirm Bulk Delete'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {lang === 'bn' 
                        ? `আপনি কি নিশ্চিত যে ${regTargetScope === 'all' ? 'সকল শ্রেণির' : 'নির্বাচিত শ্রেণির'} শিক্ষার্থীদের রেজিষ্ট্রেশন নম্বর স্থায়ীভাবে মুছে ফেলতে চান? এটি পুনরায় নতুন করে জেনারেট করার সুযোগ দেবে।`
                        : `Are you sure you want to clear registration numbers for ${regTargetScope === 'all' ? 'all classes' : 'the selected class'}? You can regenerate them anytime later.`}
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

          {/* Premium Branding Section */}
          {isPremiumPackage && (
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
