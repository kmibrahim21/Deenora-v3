import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Lock, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive, 
  Eye, 
  EyeOff, 
  X, 
  Layers, 
  Database,
  ArrowRight,
  Info,
  Mail,
  Plus,
  Trash2,
  Check,
  Share2,
  ExternalLink,
  Sparkles,
  Archive,
  History,
  CheckCircle,
  FileCheck,
  Server,
  Zap,
  Sliders,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { ChatBackupService, BackupPreferences, RestorePreview, RestoreResult } from '../../services/chatBackupService';
import { ChatArchiveService } from '../../services/chatArchiveService';
import { EncryptedBackupPackage } from '../../services/chatBackupCrypto';
import { 
  ChatRetentionPolicy, 
  ChatArchiveMetadata, 
  ChatArchiveAuditLog, 
  ArchiveCandidateStats, 
  ArchiveExecutionStep,
  ArchiveExecutionResult 
} from '../../types';

interface ChatBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionId: string;
  userId: string;
  userEmail?: string;
  onRestoreComplete?: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const ChatBackupModal: React.FC<ChatBackupModalProps> = ({
  isOpen,
  onClose,
  institutionId,
  userId,
  userEmail,
  onRestoreComplete,
  lang = 'bn',
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'archive'>('archive');
  const [preferences, setPreferences] = useState<BackupPreferences>(() =>
    ChatBackupService.getPreferences(institutionId)
  );

  // Google / Gmail Account state
  const [isAddingGmail, setIsAddingGmail] = useState(false);
  const [gmailInput, setGmailInput] = useState('');
  const [gmailFeedback, setGmailFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Backup State
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'incremental'>('full');
  const [backupStatus, setBackupStatus] = useState<
    'idle' | 'preparing' | 'compressing' | 'encrypting' | 'saving' | 'completed' | 'error'
  >('idle');
  const [backupStatusMsg, setBackupStatusMsg] = useState('');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [lastBackupResult, setLastBackupResult] = useState<{
    pkg: EncryptedBackupPackage;
    jsonString: string;
    filename: string;
  } | null>(null);

  // Restore State
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePassphrase, setShowRestorePassphrase] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatusMsg, setRestoreStatusMsg] = useState('');
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [recentBackups, setRecentBackups] = useState<any[]>([]);

  // V3 ARCHIVE & OPTIMIZATION STATE
  const [retentionPolicy, setRetentionPolicy] = useState<ChatRetentionPolicy | null>(null);
  const [candidateStats, setCandidateStats] = useState<ArchiveCandidateStats | null>(null);
  const [archivesList, setArchivesList] = useState<ChatArchiveMetadata[]>([]);
  const [auditLogs, setAuditLogs] = useState<ChatArchiveAuditLog[]>([]);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // V3 Archive Run Execution
  const [isArchiving, setIsArchiving] = useState(false);
  const [archivePassphrase, setArchivePassphrase] = useState('');
  const [showArchivePassphrase, setShowArchivePassphrase] = useState(false);
  const [archiveExecutionSteps, setArchiveExecutionSteps] = useState<ArchiveExecutionStep[]>([]);
  const [archiveResult, setArchiveResult] = useState<ArchiveExecutionResult | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [showPolicySettings, setShowPolicySettings] = useState(false);

  // Local Restore from Archive
  const [restoringArchiveId, setRestoringArchiveId] = useState<string | null>(null);
  const [restoreArchivePassphrase, setRestoreArchivePassphrase] = useState('');
  const [restoreArchiveFeedback, setRestoreArchiveFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadV3Data = async () => {
    if (!institutionId) return;
    setIsLoadingStats(true);
    try {
      const pol = await ChatArchiveService.getRetentionPolicy(institutionId);
      setRetentionPolicy(pol);
      const stats = await ChatArchiveService.getArchiveCandidateStats(institutionId, pol);
      setCandidateStats(stats);
      const archives = await ChatArchiveService.getArchives(institutionId);
      setArchivesList(archives);
      const logs = await ChatArchiveService.getAuditLogs(institutionId);
      setAuditLogs(logs);
    } catch (e) {
      console.warn('[ChatBackupModal] Failed to load V3 metrics:', e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const prefs = ChatBackupService.getPreferences(institutionId);
      
      if (!prefs.google_account && userEmail) {
        prefs.google_account = userEmail;
        prefs.linked_google_accounts = [userEmail];
        ChatBackupService.savePreferences(institutionId, prefs);
      }
      
      setPreferences(prefs);
      setRecentBackups(ChatBackupService.getRecentEncryptedBackups(institutionId));
      setBackupStatus('idle');
      setBackupError(null);
      setRestoreError(null);
      setRestoreResult(null);
      setIsAddingGmail(false);
      setGmailFeedback(null);
      setGmailInput('');
      setArchiveError(null);
      setArchiveResult(null);
      setArchiveExecutionSteps([]);

      loadV3Data();
    }
  }, [isOpen, institutionId, userEmail]);

  if (!isOpen) return null;

  // Format date helper
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return lang === 'bn' ? 'কখনও ব্যাকআপ নেওয়া হয়নি' : 'Never backed up';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (isToday) {
        return `${lang === 'bn' ? 'আজ' : 'Today'}, ${timeStr}`;
      }
      return `${date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}, ${timeStr}`;
    } catch {
      return dateStr;
    }
  };

  const handleFrequencyChange = (freq: 'manual' | 'weekly' | 'monthly') => {
    const updated = { ...preferences, frequency: freq };
    setPreferences(updated);
    ChatBackupService.savePreferences(institutionId, { frequency: freq });
  };

  // Gmail Account management
  const handleSaveGmail = (emailToSave?: string) => {
    const target = (emailToSave || gmailInput).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!target || !emailRegex.test(target)) {
      setGmailFeedback({
        type: 'error',
        message: lang === 'bn' ? 'একটি সঠিক ইমেইল/Gmail এড্রেস দিন (যেমন: user@gmail.com)' : 'Please enter a valid Gmail / Email address'
      });
      return;
    }

    const updated = ChatBackupService.addGoogleAccount(institutionId, target);
    setPreferences(updated);
    setGmailInput('');
    setIsAddingGmail(false);
    setGmailFeedback({
      type: 'success',
      message: lang === 'bn' ? `Gmail একাউন্ট "${target}" সফলভাবে যুক্ত হয়েছে!` : `Gmail account "${target}" connected successfully!`
    });
    setTimeout(() => setGmailFeedback(null), 3500);
  };

  const handleRemoveGmail = (email: string) => {
    const updated = ChatBackupService.removeGoogleAccount(institutionId, email);
    setPreferences(updated);
    setGmailFeedback({
      type: 'success',
      message: lang === 'bn' ? 'Gmail একাউন্টটি মুছে ফেলা হয়েছে।' : 'Gmail account removed.'
    });
    setTimeout(() => setGmailFeedback(null), 3000);
  };

  const handleSelectActiveGmail = (email: string) => {
    const updated = ChatBackupService.setActiveGoogleAccount(institutionId, email);
    setPreferences(updated);
  };

  // Compose Email share / dispatch
  const handleSendBackupViaEmail = () => {
    if (!lastBackupResult) return;
    const recipient = preferences.google_account || userEmail || '';
    const subject = encodeURIComponent(`Deenora চ্যাট এনক্রিপ্টেড ব্যাকআপ - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(
      `আসসালামু আলাইকুম,\n\nDeenora চ্যাট ব্যাকআপ সফলভাবে সম্পন্ন হয়েছে।\n\n` +
      `📅 ব্যাকআপের তারিখ: ${new Date().toLocaleString()}\n` +
      `📁 ফাইলের নাম: ${lastBackupResult.filename}\n` +
      `💬 মোট কনভারসেশন: ${lastBackupResult.pkg.stats.conversation_count} টি\n` +
      `✉️ মোট মেসেজ: ${lastBackupResult.pkg.stats.message_count} টি\n` +
      `🔒 নিরাপত্তা: AES-256-GCM এনক্রিপ্টেড\n` +
      `📱 ডিভাইস: ${lastBackupResult.pkg.device_info}\n\n` +
      `* আপনার ব্যাকআপ ফাইলটি ডিভাইসের ডাউনলোড ফোল্ডারে সংরক্ষিত রয়েছে। রিস্টোর করার সময় আপনার ব্যক্তিগত পাসওয়ার্ড/পিন ব্যবহার করুন।\n\n` +
      `- Deenora Islamic Management System`
    );

    window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
  };

  // Perform V2 Backup
  const handleStartBackup = async () => {
    if (!passphrase || passphrase.length < 4) {
      setBackupError(
        lang === 'bn'
          ? 'অনুগ্রহ করে ব্যাকআপ এনক্রিপ্ট করার জন্য কমপক্ষে ৪ অক্ষরের একটি নিরাপদ পাসওয়ার্ড বা পিন দিন।'
          : 'Please enter a secure password or PIN with at least 4 characters to encrypt your backup.'
      );
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setBackupError(
        lang === 'bn'
          ? 'পাসওয়ার্ড দুটি মিলছে না! পুনরায় চেক করুন।'
          : 'Passwords do not match! Please check again.'
      );
      return;
    }

    setBackupError(null);
    setBackupStatus('preparing');

    try {
      const result = await ChatBackupService.createEncryptedBackup(
        institutionId,
        userId,
        passphrase,
        backupType,
        (step, details) => {
          setBackupStatus(step);
          if (details) setBackupStatusMsg(details);
        },
        preferences.google_account || userEmail
      );

      setLastBackupResult(result);
      setPreferences(ChatBackupService.getPreferences(institutionId));
      setRecentBackups(ChatBackupService.getRecentEncryptedBackups(institutionId));
      
      // Auto-trigger download
      ChatBackupService.downloadBackupFile(result.jsonString, result.filename);
    } catch (err: any) {
      setBackupStatus('error');
      setBackupError(err.message || (lang === 'bn' ? 'ব্যাকআপ ব্যর্থ হয়েছে' : 'Backup failed'));
    }
  };

  // File selection for restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    setRestoreError(null);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreFileContent(content);
      try {
        const preview = ChatBackupService.parseBackupHeader(content);
        setRestorePreview(preview);
      } catch (err: any) {
        setRestoreError(err.message || 'অবৈধ ব্যাকআপ ফাইল');
        setRestorePreview(null);
      }
    };
    reader.onerror = () => {
      setRestoreError('ফাইল পড়তে ব্যর্থ হয়েছে');
    };
    reader.readAsText(file);
  };

  const handleSelectRecentBackup = (recent: any) => {
    try {
      setRestoreFileContent(recent.encrypted_package);
      setRestoreFileName(`Recent Backup (${new Date(recent.created_at).toLocaleDateString()})`);
      const preview = ChatBackupService.parseBackupHeader(recent.encrypted_package);
      setRestorePreview(preview);
      setRestoreError(null);
      setRestoreResult(null);
    } catch (err: any) {
      setRestoreError(err.message || 'ব্যাকআপ ফাইলটি পড়া যায়নি');
    }
  };

  // Perform V2 Restore
  const handleStartRestore = async () => {
    if (!restoreFileContent) {
      setRestoreError(
        lang === 'bn' ? 'অনুগ্রহ করে একটি ব্যাকআপ ফাইল নির্বাচন করুন' : 'Please select a backup file'
      );
      return;
    }

    if (!restorePassphrase) {
      setRestoreError(
        lang === 'bn' ? 'ব্যাকআপের পাসওয়ার্ড দিন' : 'Enter the backup password'
      );
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);

    try {
      const result = await ChatBackupService.restoreFromEncryptedBackup(
        restoreFileContent,
        restorePassphrase,
        institutionId,
        (msg) => setRestoreStatusMsg(msg)
      );

      if (result.success) {
        setRestoreResult(result);
        if (onRestoreComplete) {
          onRestoreComplete();
        }
      } else {
        setRestoreError(result.error || (lang === 'bn' ? 'রিস্টোর ব্যর্থ হয়েছে' : 'Restore failed'));
      }
    } catch (err: any) {
      setRestoreError(err.message || 'রিস্টোর প্রক্রিয়া ব্যর্থ হয়েছে');
    } finally {
      setIsRestoring(false);
    }
  };

  // ---------------------------------------------------------------------------
  // V3 HANDLERS: AUTOMATIC CHAT ARCHIVE & CLOUD STORAGE OPTIMIZATION
  // ---------------------------------------------------------------------------

  const handleSaveRetentionPolicy = async (newPolicy: Partial<ChatRetentionPolicy>) => {
    try {
      const updated = await ChatArchiveService.saveRetentionPolicy(institutionId, newPolicy);
      setRetentionPolicy(updated);
      const stats = await ChatArchiveService.getArchiveCandidateStats(institutionId, updated);
      setCandidateStats(stats);
      setGmailFeedback({
        type: 'success',
        message: lang === 'bn' ? 'রিটেনশন পলিসি সফলভাবে সংরক্ষিত হয়েছে!' : 'Retention policy saved successfully!'
      });
      setTimeout(() => setGmailFeedback(null), 3000);
    } catch (err: any) {
      setGmailFeedback({
        type: 'error',
        message: err.message || 'পলিসি সংরক্ষণ ব্যর্থ হয়েছে'
      });
    }
  };

  const handleStartV3Archive = async () => {
    if (!archivePassphrase || archivePassphrase.length < 4) {
      setArchiveError(
        lang === 'bn'
          ? 'আর্কাইভ এনক্রিপ্ট ও ভেরিফিকেশনের জন্য কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড বা পিন দিন।'
          : 'Please enter a password of at least 4 characters to encrypt the archive.'
      );
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    setArchiveResult(null);

    try {
      const result = await ChatArchiveService.runAutomaticArchiving(
        institutionId,
        userId,
        archivePassphrase,
        {
          onStepChange: (step) => {
            setArchiveExecutionSteps(prev => {
              const idx = prev.findIndex(s => s.step === step.step);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = step;
                return copy;
              }
              return [...prev, step];
            });
          }
        }
      );

      setArchiveResult(result);
      if (!result.success) {
        setArchiveError(result.error || 'আর্কাইভ প্রক্রিয়া ব্যর্থ হয়েছে');
      } else {
        await loadV3Data();
      }
    } catch (err: any) {
      setArchiveError(err.message || 'আর্কাইভ প্রক্রিয়ায় সমস্যা হয়েছে');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreFromArchiveId = async (archiveId: string) => {
    if (!restoreArchivePassphrase) {
      setRestoreArchiveFeedback(lang === 'bn' ? 'আর্কাইভের পাসওয়ার্ড দিন' : 'Enter archive password');
      return;
    }

    try {
      setRestoreArchiveFeedback(lang === 'bn' ? 'আর্কাইভ ডিক্রিপ্ট হচ্ছে...' : 'Decrypting archive...');
      const res = await ChatArchiveService.restoreArchive(
        institutionId,
        archiveId,
        restoreArchivePassphrase,
        userId
      );

      if (res.success) {
        setRestoreArchiveFeedback(
          lang === 'bn'
            ? `সফলভাবে ${res.restoredCount} টি মেসেজ লোকাল চ্যাটে রিস্টোর করা হয়েছে!`
            : `Successfully restored ${res.restoredCount} messages!`
        );
        setTimeout(() => {
          setRestoringArchiveId(null);
          setRestoreArchiveFeedback(null);
          setRestoreArchivePassphrase('');
          onRestoreComplete?.();
        }, 2500);
      } else {
        setRestoreArchiveFeedback(res.error || (lang === 'bn' ? 'রিস্টোর ব্যর্থ হয়েছে' : 'Restore failed'));
      }
    } catch (err: any) {
      setRestoreArchiveFeedback(err.message || 'রিস্টোর ব্যর্থ হয়েছে');
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className={`relative z-10 w-full max-w-2xl flex flex-col max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden border transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  {lang === 'bn' ? 'চ্যাট ব্যাকআপ ও স্টোরেজ অপ্টিমাইজেশন' : 'Chat Backup & Storage Optimization'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                  V3
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'স্বয়ংক্রিয় ক্লাউড রিটেনশন, AES-256 এনক্রিপ্টেড আর্কাইভ ও লোকাল ক্যাশ'
                  : 'Automated retention policy, AES-256 encrypted cold archives & local cache'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 shrink-0">
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => {
                setActiveTab('archive');
                setArchiveError(null);
              }}
              className={`py-2 px-2 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="truncate">{lang === 'bn' ? 'অটো-আর্কাইভ (V3)' : 'Auto-Archive'}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('backup');
                setBackupError(null);
              }}
              className={`py-2 px-2 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="truncate">{lang === 'bn' ? 'ম্যানুয়াল ব্যাকআপ' : 'Manual Backup'}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('restore');
                setRestoreError(null);
              }}
              className={`py-2 px-2 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'restore'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate">{lang === 'bn' ? 'ফাইল রিস্টোর' : 'Restore'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* TAB 1: V3 AUTOMATIC ARCHIVE & STORAGE OPTIMIZATION */}
          {activeTab === 'archive' && (
            <div className="space-y-5">
              
              {/* Top Metrics Cards: Real-Time Supabase Optimization */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-1">
                    <Server className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'সক্রিয় চ্যাট' : 'Hot Messages'}</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {candidateStats?.hot_messages_count ?? '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {retentionPolicy?.hot_retention_days || 90} {lang === 'bn' ? 'দিনের ভেতর (Supabase)' : 'days hot'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1">
                    <Archive className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'আর্কাইভ যোগ্য' : 'Archive Ready'}</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {candidateStats?.archive_candidate_count ?? '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {retentionPolicy?.hot_retention_days || 90}+ {lang === 'bn' ? 'দিনের পুরনো মেসেজ' : 'days old'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'যাচাইকৃত আর্কাইভ' : 'Verified Archives'}</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {candidateStats?.verified_archives_count ?? 0}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? 'AES-256 এনক্রিপ্টেড' : 'SHA-256 Verified'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'স্টোরেজ সাশ্রয়' : 'Storage Saved'}</span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {candidateStats ? ((candidateStats.archive_candidate_count * 450) / 1024).toFixed(0) : '0'} KB
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? 'ডাটাবেস অপ্টিমাইজড' : 'Cloud Optimized'}
                  </span>
                </div>
              </div>

              {/* Retention Policy Configuration Toggle & Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'রিটেনশন পলিসি সেটিংস (Retention Policy)' : 'Retention Policy Settings'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPolicySettings(!showPolicySettings)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                  >
                    {showPolicySettings
                      ? (lang === 'bn' ? 'সংক্ষেপ করুন' : 'Collapse')
                      : (lang === 'bn' ? 'পরিবর্তন করুন' : 'Configure')}
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'bn'
                    ? `বর্তমান পলিসি: সাম্প্রতিক ${retentionPolicy?.hot_retention_days || 90} দিনের চ্যাট ক্লাউড ডাটাবেসে সক্রিয় থাকবে। এর বেশি পুরনো মেসেজ এনক্রিপ্ট হয়ে আর্কাইভে যাবে এবং নিরাপদ ভেরিফিকেশনের পর ক্লাউড ক্লিনআপ হবে।`
                    : `Active policy: Messages within ${retentionPolicy?.hot_retention_days || 90} days stay hot in Supabase. Older records are encrypted into cold archives and cleaned up post-verification.`}
                </p>

                {showPolicySettings && retentionPolicy && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-3 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn' ? 'সক্রিয় চ্যাটের সময়সীমা (Hot Retention)' : 'Hot Retention Period'}
                        </label>
                        <select
                          value={retentionPolicy.hot_retention_days}
                          onChange={(e) => handleSaveRetentionPolicy({ hot_retention_days: Number(e.target.value) })}
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                        >
                          <option value={30}>৩০ দিন (30 Days)</option>
                          <option value={60}>৬০ দিন (60 Days)</option>
                          <option value={90}>৯০ দিন (90 Days - Recommended)</option>
                          <option value={180}>১৮০ দিন (6 Months)</option>
                          <option value={365}>৩৬৫ দিন (1 Year)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn' ? 'নোটিশ বোর্ড রিটেনশন (Notice Board)' : 'Announcement Retention'}
                        </label>
                        <select
                          value={retentionPolicy.announcement_retention_mode}
                          onChange={(e) => handleSaveRetentionPolicy({ announcement_retention_mode: e.target.value as any })}
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                        >
                          <option value="permanent">{lang === 'bn' ? 'আজীবন স্থায়ী (Permanent)' : 'Permanent'}</option>
                          <option value="days">{lang === 'bn' ? 'সাধারণ পলিসি অনুযায়ী' : 'Follow General Policy'}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={retentionPolicy.protect_pinned_messages}
                          onChange={(e) => handleSaveRetentionPolicy({ protect_pinned_messages: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{lang === 'bn' ? 'পিন করা মেসেজ সংরক্ষণ করুন' : 'Protect Pinned Messages'}</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={retentionPolicy.protect_starred_messages}
                          onChange={(e) => handleSaveRetentionPolicy({ protect_starred_messages: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{lang === 'bn' ? 'স্টার করা মেসেজ সংরক্ষণ করুন' : 'Protect Starred Messages'}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 1-Click Run Archiving & Optimization Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'নিরাপদ অটো-আর্কাইভ ও ক্লাউড অপ্টিমাইজেশন চালান' : 'Run Safe Auto-Archive & Cloud Optimization'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuditLogsModal(true)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'অডিট লগ' : 'Audit Logs'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'bn'
                    ? 'এটি স্বয়ংক্রিয়ভাবে পুরনো মেসেজগুলোকে সংকুচিত ও AES-256 দিয়ে এনক্রিপ্ট করবে, SHA-256 ইন্টিগ্রিটি ও মেমরি টেস্ট ডিক্রিপশন সম্পন্ন করবে, এবং সফলভাবে ভেরিফাই হওয়ার পর ক্লাউড থেকে পুরনো রেকর্ড নিরাপদভাবে অপ্টিমাইজ করবে।'
                    : 'Compresses & encrypts qualified messages via AES-256, verifies SHA-256 integrity with in-memory trial decryption, and safely cleans up old cloud records only after full verification.'}
                </p>

                {/* Passphrase Input */}
                {!isArchiving && !archiveResult && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'bn' ? 'আর্কাইভ এনক্রিপশন পাসওয়ার্ড / পিন' : 'Archive Encryption Password / PIN'}
                    </label>
                    <div className="relative">
                      <input
                        type={showArchivePassphrase ? 'text' : 'password'}
                        value={archivePassphrase}
                        onChange={(e) => setArchivePassphrase(e.target.value)}
                        placeholder={lang === 'bn' ? 'একটি শক্তিশালী পাসওয়ার্ড দিন...' : 'Enter a password...'}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowArchivePassphrase(!showArchivePassphrase)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showArchivePassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step-by-Step Live Execution Indicator */}
                {isArchiving && (
                  <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-blue-200 dark:border-blue-900/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === 'bn' ? 'স্বয়ংক্রিয় প্রসেস চলছে...' : 'Archive process in progress...'}</span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {archiveExecutionSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : step.status === 'running' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                          ) : step.status === 'failed' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                          )}
                          <span className={step.status === 'running' ? 'font-bold text-blue-600 dark:text-blue-400' : ''}>
                            {step.details || step.step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archive Error */}
                {archiveError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{archiveError}</span>
                  </div>
                )}

                {/* Archive Success Result */}
                {archiveResult && archiveResult.success && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{lang === 'bn' ? 'আর্কাইভ ও ক্লাউড অপ্টিমাইজেশন সফলভাবে সম্পন্ন!' : 'Archive & Storage Optimization Successful!'}</span>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      {archiveResult.archive_metadata?.message_count ?? 0} {lang === 'bn' ? 'টি পুরনো মেসেজ সফলভাবে এনক্রিপ্ট ও ভেরিফাই করা হয়েছে।' : 'messages securely encrypted and verified.'} {archiveResult.cleaned_up_count > 0 && `(${archiveResult.cleaned_up_count} ${lang === 'bn' ? 'টি মেসেজ ক্লাউড থেকে অপ্টিমাইজ করা হয়েছে)' : 'messages safely cleaned from cloud)'}`}
                    </p>
                  </div>
                )}

                {/* Execution Button */}
                {!isArchiving && !archiveResult && (
                  <button
                    type="button"
                    onClick={handleStartV3Archive}
                    disabled={!archivePassphrase}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'আর্কাইভ ও ক্লাউড অপ্টিমাইজেশন শুরু করুন' : 'Start Archive & Cloud Optimization'}</span>
                  </button>
                )}
              </div>

              {/* Verified Archives Explorer List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'bn' ? 'সংরক্ষিত আর্কাইভসমূহ' : 'Stored Archives'}</span>
                    <span className="px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                      {archivesList.length}
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={loadV3Data}
                    className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                  </button>
                </div>

                {archivesList.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1 text-slate-400 text-xs">
                    <Archive className="w-6 h-6 mx-auto opacity-50" />
                    <p>{lang === 'bn' ? 'এখনও কোনো আর্কাইভ তৈরি করা হয়নি।' : 'No archives created yet.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {archivesList.map((arc) => (
                      <div
                        key={arc.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2 hover:border-blue-300 transition-all text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                              {arc.status === 'cleaned_up' ? 'Cleaned & Optimized' : 'Verified'}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {arc.message_count} {lang === 'bn' ? 'টি মেসেজ' : 'messages'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {(arc.archive_size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {new Date(arc.date_start).toLocaleDateString()} — {new Date(arc.date_end).toLocaleDateString()}
                          </span>
                          <span className="font-mono text-[10px] truncate max-w-[120px]" title={arc.checksum}>
                            SHA: {arc.checksum.slice(0, 10)}...
                          </span>
                        </div>

                        {/* Inline Local Restore Action */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(arc.created_at)}
                          </span>

                          {restoringArchiveId === arc.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={restoreArchivePassphrase}
                                onChange={(e) => setRestoreArchivePassphrase(e.target.value)}
                                placeholder={lang === 'bn' ? 'পিন/পাসওয়ার্ড...' : 'Password...'}
                                className="text-[10px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => handleRestoreFromArchiveId(arc.id)}
                                className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 cursor-pointer"
                              >
                                {lang === 'bn' ? 'নিশ্চিত করুন' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestoringArchiveId(null)}
                                className="text-[10px] text-slate-400 hover:text-slate-600"
                              >
                                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRestoringArchiveId(arc.id);
                                  setRestoreArchiveFeedback(null);
                                }}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>{lang === 'bn' ? 'লোকাল চ্যাটে দেখুন' : 'View in Chat'}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {restoringArchiveId === arc.id && restoreArchiveFeedback && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            {restoreArchiveFeedback}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL V2 BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Last Backup Information Card */}
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-100/80 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'সর্বশেষ এনক্রিপ্টেড ব্যাকআপ' : 'Last Encrypted Backup'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatDateTime(preferences.last_backup_at)}
                    </h3>
                    {preferences.last_backup_size && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {lang === 'bn' ? 'ফাইলের আকার:' : 'Size:'} {(preferences.last_backup_size / 1024).toFixed(1)} KB • {preferences.last_backup_msg_count ?? 0} {lang === 'bn' ? 'টি মেসেজ' : 'messages'}
                      </p>
                    )}
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-bold shrink-0">
                  AES-256
                </span>
              </div>

              {/* Linked Gmail / Google Account Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'সংযুক্ত Gmail / Google অ্যাকাউন্ট' : 'Linked Gmail / Google Account'}
                    </span>
                  </div>
                  {!isAddingGmail && (
                    <button
                      type="button"
                      onClick={() => setIsAddingGmail(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'নতুন একাউন্ট যোগ করুন' : 'Add Gmail'}</span>
                    </button>
                  )}
                </div>

                {/* Add Gmail Input */}
                {isAddingGmail && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-200">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'bn' ? 'Gmail / ইমেইল এড্রেস লিখুন' : 'Enter Gmail / Email Address'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={gmailInput}
                        onChange={(e) => setGmailInput(e.target.value)}
                        placeholder="example@gmail.com"
                        className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveGmail()}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingGmail(false);
                          setGmailInput('');
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Gmail Feedback */}
                {gmailFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    gmailFeedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200'
                  }`}>
                    {gmailFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{gmailFeedback.message}</span>
                  </div>
                )}

                {/* Linked Google Accounts List */}
                <div className="space-y-1.5">
                  {(preferences.linked_google_accounts && preferences.linked_google_accounts.length > 0) ? (
                    preferences.linked_google_accounts.map((email) => {
                      const isActive = preferences.google_account === email;
                      return (
                        <div
                          key={email}
                          className={`p-2.5 px-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isActive
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                              G
                            </div>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {email}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                                {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => handleSelectActiveGmail(email)}
                                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                              >
                                {lang === 'bn' ? 'সক্রিয় করুন' : 'Set Active'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveGmail(email)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
                              title={lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-2 text-slate-400 text-xs">
                      {lang === 'bn' ? 'কোনো Gmail একাউন্ট যুক্ত করা হয়নি' : 'No Gmail account linked'}
                    </div>
                  )}
                </div>
              </div>

              {/* Passphrase Input Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'ব্যক্তিগত পাসওয়ার্ড বা পিন (পাসফ্রেজ)' : 'Encryption Password / PIN'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder={lang === 'bn' ? 'কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন...' : 'Enter password...'}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                  </label>
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder={lang === 'bn' ? 'একই পাসওয়ার্ড পুনরায় লিখুন...' : 'Re-enter password...'}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Backup Error */}
              {backupError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{backupError}</span>
                </div>
              )}

              {/* Start Backup Button */}
              <button
                type="button"
                onClick={handleStartBackup}
                disabled={backupStatus !== 'idle' && backupStatus !== 'error' && backupStatus !== 'completed'}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {backupStatus !== 'idle' && backupStatus !== 'completed' && backupStatus !== 'error' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{backupStatusMsg || (lang === 'bn' ? 'ব্যাকআপ তৈরি হচ্ছে...' : 'Backing up...')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'এখনই এনক্রিপ্ট করে ব্যাকআপ ফাইল ডাউনলোড করুন' : 'Download Encrypted Backup'}</span>
                  </>
                )}
              </button>

              {/* Share via Gmail action after success */}
              {lastBackupResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{lang === 'bn' ? 'এনক্রিপ্টেড ব্যাকআপ সফলভাবে প্রস্তুত হয়েছে!' : 'Backup Created Successfully!'}</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {lastBackupResult.pkg.stats.conversation_count} {lang === 'bn' ? 'টি চ্যাট ও' : 'chats &'} {lastBackupResult.pkg.stats.message_count} {lang === 'bn' ? 'টি মেসেজ AES-256 দিয়ে এনক্রিপ্ট করা হয়েছে।' : 'messages safely encrypted.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSendBackupViaEmail}
                    className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-500" />
                    <span>{lang === 'bn' ? 'Gmail / ইমেইলে ব্যাকআপের কপি পাঠান' : 'Share Details via Gmail'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESTORE */}
          {activeTab === 'restore' && (
            <div className="space-y-5">
              {/* File Dropzone / Select */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 transition-all text-center cursor-pointer space-y-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    {restoreFileName || (lang === 'bn' ? 'এনক্রিপ্টেড ব্যাকআপ ফাইল নির্বাচন করুন' : 'Select .deenorabackup file')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {lang === 'bn' ? 'ক্লিক করে আপনার ফাইল বাছাই করুন (.deenorabackup)' : 'Click to browse files'}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".deenorabackup,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Passphrase Input for Restore */}
              {restoreFileContent && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'ব্যাকআপের ডিক্রিপশন পাসওয়ার্ড / পিন লিখুন' : 'Enter Backup Password / PIN'}
                  </label>
                  <div className="relative">
                    <input
                      type={showRestorePassphrase ? 'text' : 'password'}
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      placeholder={lang === 'bn' ? 'পাসওয়ার্ড লিখুন...' : 'Enter password...'}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRestorePassphrase(!showRestorePassphrase)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showRestorePassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Restore Error */}
              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              {/* Restore Success Result */}
              {restoreResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{lang === 'bn' ? 'রিস্টোর সফলভাবে সম্পন্ন হয়েছে!' : 'Restore completed successfully!'}</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    {restoreResult.restored_messages_count} {lang === 'bn' ? 'টি মেসেজ এবং' : 'messages and'} {restoreResult.restored_conversations_count} {lang === 'bn' ? 'টি কনভারসেশন রিস্টোর করা হয়েছে।' : 'conversations merged into your chat store.'}
                  </p>
                </div>
              )}

              {/* Restore Button */}
              {restoreFileContent && !restoreResult && (
                <button
                  type="button"
                  onClick={handleStartRestore}
                  disabled={isRestoring || !restorePassphrase}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{restoreStatusMsg || (lang === 'bn' ? 'রিস্টোর হচ্ছে...' : 'Restoring...')}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'রিস্টোর করুন (Restore)' : 'Restore'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AUDIT LOGS MODAL */}
      {showAuditLogsModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'অডিট ও অপারেশন লগ' : 'Archive Audit & Operation Logs'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  {lang === 'bn' ? 'কোনো অডিট রেকর্ড পাওয়া যায়নি।' : 'No audit records found.'}
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                        {log.details}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{log.affected_message_count} msgs</span>
                      <span>By: {log.performed_by?.slice(0, 8)}...</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
