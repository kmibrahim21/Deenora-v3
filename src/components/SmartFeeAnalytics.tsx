
import React, { useState, useEffect, useRef } from 'react';
import { supabase, smsApi } from 'supabase';
import { Language, Class, SMSTemplate, Institution, UserRole, Profile } from 'types';
import { t } from 'translations';
import { ShortcodeService } from 'services/ShortcodeService';
import { TrendingUp, DollarSign, BarChart3, AlertCircle, Send, Loader2, CheckCircle2, MessageSquare, Smartphone, PieChart, Users, Filter, Calendar, Wallet, BookOpen, ChevronDown, Info, PhoneCall, Download, X } from 'lucide-react';
import { isValidUUID } from 'utils/validation';
import { generateAccountingReportPDF } from 'utils/pdfGenerator';

import { createPortal } from 'react-dom';

interface SmartFeeAnalyticsProps {
  institutionId: string;
  lang: Language;
  month: string;
  refreshKey?: number;
  classes?: Class[];
  madrasah: Institution | null;
  role?: UserRole;
  profile?: Profile | null;
  activeYear?: any;
}

const localT = {
  allClasses: { en: 'All Classes', bn: 'সকল ক্লাস' },
  targetMonthly: { en: 'Target Monthly', bn: 'মাসিক লক্ষ্য' },
  goal100: { en: '100% Goal', bn: '১০০% লক্ষ্য' },
  progress: { en: 'Progress', bn: 'অগ্রগতি' },
  active: { en: 'Active', bn: 'সক্রিয়' },
  totalExpense: { en: 'Total Expense', bn: 'মোট ব্যয়' },
  totalIncome: { en: 'Total Income', bn: 'মোট আয়' },
  monthlyOutflow: { en: 'Monthly Outflow', bn: 'মাসিক ব্যয়' },
  netIncome: { en: 'Net Income', bn: 'নিট আয়' },
  remainingBalance: { en: 'Remaining Balance', bn: 'অবশিষ্ট ব্যালেন্স' },
  feeBreakdown: { en: 'Fee Breakdown', bn: 'ফি ব্রেকডাউন' },
  students: { en: 'Students', bn: 'শিক্ষার্থী' },
  paid: { en: 'Paid', bn: 'পরিশোধিত' },
  expectedCollected: { en: 'Expected / Collected', bn: 'প্রত্যাশিত / সংগৃহীত' },
  due: { en: 'Due', bn: 'বকেয়া' },
  noFeeStructures: { en: 'No fee structures found', bn: 'কোনো ফি স্ট্রাকচার পাওয়া যায়নি' },
  studentsPending: { en: 'Students Pending', bn: 'শিক্ষার্থীর বকেয়া রয়েছে' },
  availableShortcodes: { en: 'Available Shortcodes for Templates:', bn: 'টেমপ্লেটের জন্য উপলব্ধ শর্টকোড:' },
  useShortcodes: { en: '* Use these codes in your SMS templates in Wallet/SMS page.', bn: '* ওয়ালেট/এসএমএস পেজে আপনার এসএমএস টেমপ্লেটে এই কোডগুলো ব্যবহার করুন।' },
  default: { en: 'Default', bn: 'ডিফল্ট' },
  defaultReminder: { en: 'Default Reminder Message', bn: 'ডিফল্ট রিমাইন্ডার মেসেজ' },
  noClass: { en: 'No Class', bn: 'কোনো ক্লাস নেই' },
  allFeesCollected: { en: 'All fees collected!', bn: 'সব ফি সংগ্রহ করা হয়েছে!' },
  totalCollected: { en: 'Total Collected', bn: 'মোট সংগৃহীত' },
  monthly: { en: 'Monthly', bn: 'মাসিক' },
  yearly: { en: 'Yearly', bn: 'বার্ষিক' },
};

import { requestManager } from 'services/RequestManager';

interface LedgerHistoryEntry {
  id: string;
  transaction_date: string;
  amount: number;
  type: string;
  category: string;
  description: string;
}

interface BreakdownEntry {
  name: string;
  expected: number;
  collected: number;
  students: number;
  transactions: number;
}

const availableShortcodes = [
  { code: '{student_name}', label: 'Student Name' },
  { code: '{month}', label: 'Fee Month' },
  { code: '{due_amount}', label: 'Due Amount' },
  { code: '{roll}', label: 'Roll Number' },
  { code: '{class_name}', label: 'Class Name' },
];

const SmartFeeAnalytics: React.FC<SmartFeeAnalyticsProps> = ({ institutionId, lang, month: initialMonth, refreshKey, classes = [], madrasah, role, profile, activeYear }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<BreakdownEntry[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerHistoryEntry[]>([]);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [localClasses, setLocalClasses] = useState<Class[]>(classes);
  const [sending, setSending] = useState(false);
  const isSendingRef = useRef(false);
  const [showShortcodes, setShowShortcodes] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [statusModal, setStatusModal] = useState<{ show: boolean, type: 'success' | 'error' | 'info', title?: string, message: string }>({ show: false, type: 'success', message: '' });
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voiceRate, setVoiceRate] = useState(0.85);

  const passedClassesLength = classes?.length;
  const allowedClassesJson = JSON.stringify(profile?.permissions?.allowed_classes || []);

  useEffect(() => {
    if (classes && classes.length > 0) {
      setLocalClasses(classes);
    } else if (isValidUUID(institutionId)) {
      requestManager.cachedFetch(
        'classes',
        (q) => q.select('id, class_name').eq('institution_id', institutionId).order('class_name'),
        `classes:${institutionId}`
      ).then(({ data }) => {
        if (data) {
          let filteredClasses = data;
          if (role === 'teacher' && profile?.permissions?.allowed_classes) {
            filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
          }
          setLocalClasses(filteredClasses);
        }
      });
    }
  }, [institutionId, passedClassesLength, role, allowedClassesJson]);

  const [isRevalidating, setIsRevalidating] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchTemplates();

    const keys = [
      `fee_structs:${institutionId}`,
      `students:${institutionId}`,
      `fee_settings:${institutionId}`,
      `ledger:${institutionId}`
    ];
    const unsubs = keys.map(k => requestManager.subscribe(k, () => fetchAnalytics(true)));
    return () => unsubs.forEach(u => u());
  }, [institutionId, selectedMonth, selectedYear, selectedDate, dateRange, viewMode, selectedClassId, refreshKey]);

  const fetchTemplates = async () => {
    if (!isValidUUID(institutionId)) return;
    const { data } = await requestManager.cachedFetch(
      'sms_templates',
      (q) => q.select('id, body, title, created_at').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      `templates:${institutionId}`
    );
    if (data) setTemplates(data);
  };

  const fetchAnalytics = async (isBackground = false) => {
    if (!isValidUUID(institutionId)) return;
    if (!isBackground) {
      if (!stats) setLoading(true); 
    } else {
      setIsRevalidating(true);
    }
    
    try {
      const activeYearId = madrasah?.config_json?.active_academic_year_id;
      let dateFilter = selectedMonth;
      if (viewMode === 'daily') dateFilter = selectedDate;
      else if (viewMode === 'yearly') dateFilter = selectedYear;
      else if (viewMode === 'custom') dateFilter = '';
      
      const isDateInRange = (dateStr: string) => {
        if (viewMode === 'custom') {
           if (!dateRange.start || !dateRange.end) return true;
           return dateStr >= dateRange.start && dateStr <= dateRange.end;
        }
        return dateStr.startsWith(dateFilter);
      };

      // Use requestManager for cached data fetches
      const [structuresRes, studentsRes, settingsRes, ledgerRes] = await Promise.all([
        requestManager.cachedFetch('fee_structures', (q) => q.select('id, fee_name, amount, class_id, start_date, due_date').eq('institution_id', institutionId), `fee_structs:${institutionId}`),
        requestManager.cachedFetch('students', (q) => q.select('id, student_name, class_id, academic_year_id, guardian_phone, roll').eq('institution_id', institutionId), `students:${institutionId}`),
        requestManager.cachedFetch('student_fee_settings', (q) => q.select('student_id, fee_structure_id, is_enabled, custom_amount').eq('institution_id', institutionId), `fee_settings:${institutionId}`),
        requestManager.cachedFetch('ledger', (q) => q.select('id, transaction_date, amount, type, category, description').eq('institution_id', institutionId), `ledger:${institutionId}`)
      ]);

      const structures = structuresRes.data;
      if (!structures) return;

      let students = studentsRes.data;
      if (activeYearId) {
        students = students?.filter(s => s.academic_year_id === activeYearId || !s.academic_year_id);
      }
      if (selectedClassId !== 'all') {
        students = students?.filter(s => s.class_id === selectedClassId);
      }

      const allSettings = settingsRes.data;
      const ledger = ledgerRes.data;

      const studentCounts: Record<string, number> = {};
      const studentClassMap: Record<string, string> = {};
      
      students?.forEach(s => {
        studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
        studentClassMap[s.student_name] = s.class_id;
      });

      if (ledger) {
        const filteredLedger = ledger.filter(l => isDateInRange(l.transaction_date));
        setLedgerHistory(filteredLedger);
      }

      // 4. Process Data
      const breakdownMap: Record<string, { expected: number, collected: number, students: number, transactions: number }> = {};
      let totalExpected = 0;
      let totalCollected = 0;
      let totalExpense = 0;
      let totalIncome = 0;

      // Calculate Expenses and Total Income
      ledger?.forEach(l => {
        if (isDateInRange(l.transaction_date)) {
          if (l.type === 'expense') {
            totalExpense += l.amount;
          } else if (l.type === 'income') {
            totalIncome += l.amount;
          }
        }
      });

      structures.forEach(s => {
        // filter structures by selected class if needed
        if (selectedClassId !== 'all' && s.class_id !== null && s.class_id !== selectedClassId) return;

        // ... existing active months logic ...
        let activeMonthsCount = 0;
        const acStart = activeYear?.start_date ? new Date(activeYear.start_date) : new Date(new Date().getFullYear(), 0, 1);
        const startMonthIdx = acStart.getFullYear() === parseInt(selectedYear) ? acStart.getMonth() + 1 : 1;
        
        if (viewMode === 'yearly') {
            for (let m = startMonthIdx; m <= 12; m++) {
                const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
                const isExpired = s.due_date && s.due_date.slice(0, 7) < mStr;
                const isNotStarted = s.start_date && s.start_date.slice(0, 7) > mStr;
                if (!isExpired && !isNotStarted) activeMonthsCount++;
            }
        } else {
            const evalMonth = selectedMonth; 
            const isExpired = s.due_date && s.due_date.slice(0, 7) < evalMonth;
            const isNotStarted = s.start_date && s.start_date.slice(0, 7) > evalMonth;
            if (!isExpired && !isNotStarted) activeMonthsCount = 1;
        }
        if (activeMonthsCount === 0) return;

        let count = 0;
        let total = 0;
        const multiplier = activeMonthsCount;

        if (s.class_id === null) {
          students?.forEach(st => {
            const setting = allSettings?.find(as => as.student_id === st.id && as.fee_structure_id === s.id);
            if (setting ? setting.is_enabled : true) {
                count++;
                const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                total += amountToCharge * multiplier;
            }
          });
        } else {
          students?.forEach(st => {
            if (st.class_id !== s.class_id) return;
            const setting = allSettings?.find(as => as.student_id === st.id && as.fee_structure_id === s.id);
            if (setting ? setting.is_enabled : true) {
                count++;
                const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                total += amountToCharge * multiplier;
            }
          });
        }
            
        const feeName = s.fee_name.trim();
        if (!breakdownMap[feeName]) {
          breakdownMap[feeName] = { expected: 0, collected: 0, students: 0, transactions: 0 };
        }
        breakdownMap[feeName].expected += total;
        breakdownMap[feeName].students += count;
        totalExpected += total;
      });

      // ... existing collection calculation logic ...
      ledger?.forEach(l => {
        if (l.type !== 'income' || l.category !== 'Student Fee') return;
        const isCorrectPeriod = l.transaction_date.startsWith(dateFilter) || l.description.includes(dateFilter);
        if (!isCorrectPeriod) return;
        const parts = l.description.split(' - ');
        if (parts.length < 2) return;
        const feePart = parts[0];
        const studentInfo = parts.slice(1).join(' - ');
        const studentName = studentInfo.split(' (')[0].trim();
        const match = studentInfo.match(/\((.*?)\s*\|/);
        const classNameFromDesc = match ? match[1].trim() : null;
        let classId = studentClassMap[studentName];
        if (!classId && classNameFromDesc && localClasses.length > 0) {
            classId = localClasses.find(c => c.class_name.trim() === classNameFromDesc)?.id;
        }
        if (selectedClassId !== 'all' && classId !== selectedClassId) return;
        const fees = feePart.split(',').map(f => f.trim());
        let totalStructureAmount = 0;
        const matchedStructures: any[] = [];
        fees.forEach(f => {
            const normalizedF = (f || '').toLowerCase().trim();
            const structure = structures.find(s => 
                (s.fee_name || '').toLowerCase().trim() === normalizedF && 
                (s.class_id === null || (classId && s.class_id === classId))
            );
            if (structure) {
                totalStructureAmount += structure.amount;
                matchedStructures.push(structure);
            } else {
                const nameOnlyMatch = structures.find(s => (s.fee_name || '').toLowerCase().trim() === normalizedF);
                if (nameOnlyMatch) {
                    totalStructureAmount += nameOnlyMatch.amount;
                    matchedStructures.push(nameOnlyMatch);
                }
            }
        });
        if (matchedStructures.length > 0) {
            matchedStructures.forEach(structure => {
                const feeName = structure.fee_name.trim();
                if (breakdownMap[feeName]) {
                    breakdownMap[feeName].transactions += 1;
                    const ratio = totalStructureAmount > 0 ? (structure.amount / totalStructureAmount) : (1 / matchedStructures.length);
                    const allocatedAmount = l.amount * ratio;
                    breakdownMap[feeName].collected += allocatedAmount;
                }
            });
            totalCollected += l.amount;
        } else {
            fees.forEach(f => {
                const normalizedF = (f || '').toLowerCase().trim();
                const breakdownKey = Object.keys(breakdownMap).find(k => (k || '').toLowerCase().trim() === normalizedF);
                if (breakdownKey) {
                    breakdownMap[breakdownKey].transactions += 1;
                    breakdownMap[breakdownKey].collected += l.amount / fees.length;
                }
            });
            totalCollected += l.amount;
        }
      });
      // ... end processing ...

      const breakdownList = Object.entries(breakdownMap).map(([name, data]) => ({ name, ...data }));
      setBreakdown(breakdownList);

      setStats({
        expected_income: totalExpected,
        prediction: totalCollected,
        total_expense: totalExpense,
        total_income: totalIncome,
        net_income: totalIncome - totalExpense,
        collection_rate: totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0
      });

      if (viewMode === 'monthly') {
        const { data: remindersData, error: remError } = await requestManager.cachedRpc('get_fee_reminder_list', { 
          p_institution_id: institutionId, 
          p_month: selectedMonth,
          p_academic_year_id: null 
        });
        if (remindersData) {
            const getExpectedForStudentAndMonth = (studentId: string, classId: string, monthStr: string) => {
              let totalExpectedVal = 0;
              structures.forEach(s => {
                if (s.class_id !== null && s.class_id !== classId) return;

                const isExpired = s.due_date && s.due_date.slice(0, 7) < monthStr;
                const isNotStarted = s.start_date && s.start_date.slice(0, 7) > monthStr;
                if (isExpired || isNotStarted) return;

                const setting = allSettings?.find(as => as.student_id === studentId && as.fee_structure_id === s.id);
                if (setting ? setting.is_enabled : true) {
                  const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                  totalExpectedVal += amountToCharge;
                }
              });
              return totalExpectedVal;
            };

            const activeStudents = students || [];
            const filteredReminders = remindersData
              .map((r: any) => {
                const student = activeStudents.find(st => st.id === r.student_id);
                if (!student) return null;
                
                const expected = getExpectedForStudentAndMonth(student.id, student.class_id, selectedMonth);
                const paid = Number(r.total_paid) || 0;
                const balance_due = Math.max(0, expected - paid);
                
                return {
                  ...r,
                  total_payable: expected,
                  balance_due: balance_due,
                  reminder_type: expected > 0 ? (balance_due > (expected * 0.8) ? 'final' : (balance_due > (expected * 0.4) ? 'strong' : 'soft')) : 'soft'
                };
              })
              .filter((r: any) => r !== null && r.balance_due > 0);

            setReminders(filteredReminders || []);
        } else {
            setReminders([]);
        }
      } else {
        setReminders([]);
      }

    } catch (err) {
      console.error('Smart Fee Analytics Error:', err);
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  };

  const fetchVoices = async () => {
    setIsFetchingVoices(true);
    try {
      const { data: sysSettings } = await supabase.from('system_settings').select('voice_rate').single();
      if (sysSettings?.voice_rate) setVoiceRate(sysSettings.voice_rate);

      const { data: localVoices } = await supabase
        .from('voice_templates')
        .select('id, provider_voice_name, title')
        .eq('institution_id', institutionId)
        .eq('provider_status', 'approved');
      
      setVoices(localVoices || []);
      if (localVoices && localVoices.length > 0) {
        setSelectedVoiceId(localVoices[0].id);
      }
      setShowVoiceModal(true);
    } catch (err) {
      console.error('Error fetching voices:', err);
      setStatusModal({ show: true, type: 'error', title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Failed', message: lang === 'bn' ? 'ভয়েস লোড করতে সমস্যা হয়েছে।' : 'Failed to load voices.' });
    } finally {
      setIsFetchingVoices(false);
    }
  };

  const sendVoiceBroadcast = async () => {
    if (!selectedVoiceId || reminders.length === 0) return;
    setSending(true);
    try {
      const voice = voices.find(v => v.id === selectedVoiceId);
      if (!voice) throw new Error('Selected voice not found.');

      const phoneNumbers = reminders.map(r => r.guardian_phone).filter(Boolean);
      if (phoneNumbers.length === 0) throw new Error('No valid phone numbers found.');

      const estimatedCost = phoneNumbers.length * voiceRate;
      const { data: instData } = await supabase.from('institutions').select('balance, voice_sender_id').eq('id', institutionId).single();
      
      if (!instData || instData.balance < estimatedCost) {
        throw new Error(lang === 'bn' ? `পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজন: ${estimatedCost} ৳, আছে: ${instData?.balance || 0} ৳` : `Insufficient balance. Required: ${estimatedCost} ৳, Available: ${instData?.balance || 0} ৳`);
      }

      let sNumber = instData.voice_sender_id;
      
      if (!sNumber) {
        try {
          // Fallback: try to fetch first available sender from API
          const sRes = await fetch('/api/awaj/senders');
          if (sRes.ok) {
            const sData = await sRes.json();
            const sList = Array.isArray(sData) ? sData : (sData.senders || sData.data || []);
            if (sList.length > 0) {
              sNumber = (sList[0].callingNumber || sList[0].caller_id || sList[0].id || '').toString();
            }
          }
        } catch (sErr) {
          console.warn('Failed to fetch fallback sender ID:', sErr);
        }
      }

      if (!sNumber) throw new Error(lang === 'bn' ? 'কোনো সেন্ডার আইডি খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সেটিংস থেকে সেট করুন।' : 'No Sender ID found. Please configure it in settings.');

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

      const voiceName = voice.provider_voice_name || voice.title;
      const requestId = crypto.randomUUID();

      // Normalize phone numbers: 11 digits (01...)
      const uniqueNormalizedPhoneNumbers = [...new Set(phoneNumbers
        .map(phone => {
          if (!phone) return '';
          const digits = phone.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        })
        .filter(p => p && p.length === 11 && p.startsWith('01')))];

      if (uniqueNormalizedPhoneNumbers.length === 0) {
        throw new Error(lang === 'bn' ? 'কোনো সঠিক মোবাইল নম্বর (০১৭xxx...) পাওয়া যায়নি।' : 'No valid 11-digit phone numbers (01...) found.');
      }

      // Re-evaluate estimation by unique length
      const actualEstimatedCost = uniqueNormalizedPhoneNumbers.length * voiceRate;
      if (instData.balance < actualEstimatedCost) {
        throw new Error(lang === 'bn' ? `পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজন: ${actualEstimatedCost} ৳, আছে: ${instData.balance || 0} ৳` : `Insufficient balance. Required: ${actualEstimatedCost} ৳, Available: ${instData.balance || 0} ৳`);
      }

      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: uniqueNormalizedPhoneNumbers,
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
        let errorMessage = errorData.error || errorData.message || `Failed to send broadcast (API Error ${response.status})`;
        if (errorData.details) {
          const details = typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details);
          errorMessage += ` - ${details}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // Deduct balance
      const { error: deductError } = await supabase.rpc('deduct_balance', {
        p_institution_id: institutionId,
        p_amount: actualEstimatedCost
      });
      if (deductError) throw deductError;

      // Save to Supabase
      await supabase.from('voice_broadcasts').insert({
        institution_id: institutionId,
        voice_template_id: selectedVoiceId,
        total_numbers: uniqueNormalizedPhoneNumbers.length,
        estimated_cost: actualEstimatedCost,
        status: 'pending',
        provider_campaign_id: campaignId.toString()
      });

      setStatusModal({ show: true, type: 'success', title: lang === 'bn' ? 'সফল হয়েছে' : 'Success', message: lang === 'bn' ? 'ভয়েস কল সফলভাবে পাঠানো হয়েছে' : 'Voice broadcast sent successfully' });
      setShowVoiceModal(false);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Error', message: err.message || 'Failed to send voice broadcast' });
    } finally {
      setSending(false);
    }
  };

  const sendBulkReminder = async (type: 'native' | 'system') => {
    if (reminders.length === 0) return;
    
    if (!selectedTemplate) {
        alert(lang === 'bn' ? 'দয়া করে একটি এসএমএস টেমপ্লেট নির্বাচন করুন' : 'Please select an SMS template');
        return;
    }

    const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    const formattedMonth = lang === 'bn' ? `${monthNamesBn[monthIdx]} ${yearStr}` : `${monthNamesEn[monthIdx]} ${yearStr}`;

    if (type === 'native') {
      const phones = reminders.map(r => r.guardian_phone).join(',');
      let body = selectedTemplate.body;
      
      // Simple variable replacement if using template
      body = body.replace(/\[month\]/g, '{month}')
                 .replace(/\[amount\]/g, '{due_amount}')
                 .replace(/\[name\]/g, '{student_name}');

      // For native SMS, we can only send one message to all, so we use the first student's data as a preview
      // But actually native SMS doesn't support shortcodes per recipient.
      // So we'll just use the first student's data for the native SMS body.
      const firstData = {
        student_name: reminders[0].student_name,
        month: formattedMonth,
        due_amount: Math.max(0, Number(reminders[0].balance_due))
      };
      const finalBody = ShortcodeService.replaceShortcodes(body, firstData);

      window.location.href = `sms:${phones}?body=${encodeURIComponent(finalBody)}`;
    } else {
      if (isSendingRef.current) return;
      isSendingRef.current = true;
      setSending(true);
      try {
        // Map reminders to Student-like objects for SMSService
        const pseudoStudents = reminders.map(r => ({
          id: r.student_id,
          student_name: r.student_name,
          guardian_phone: r.guardian_phone,
          institution_id: institutionId,
          month: formattedMonth,
          due_amount: Math.max(0, Number(r.balance_due))
        })) as any[];

        let body = selectedTemplate.body;
        
        // If using old style templates, convert them
        body = body.replace(/\[month\]/g, '{month}')
                   .replace(/\[amount\]/g, '{due_amount}')
                   .replace(/\[name\]/g, '{student_name}');

        await smsApi.sendBulk(institutionId, pseudoStudents, body);
        setStatusModal({ show: true, type: 'success', title: lang === 'bn' ? 'সফল হয়েছে' : 'Success', message: lang === 'bn' ? 'রিমাইন্ডার সফলভাবে পাঠানো হয়েছে' : 'Reminders sent successfully' });
      } catch (err: any) {
        setStatusModal({ show: true, type: 'error', title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Error', message: err.message || 'Failed to send SMS' });
      } finally {
        isSendingRef.current = false;
        setSending(false);
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!madrasah || !stats) return;
    let period = selectedMonth;
    if (viewMode === 'daily') period = selectedDate;
    else if (viewMode === 'yearly') period = selectedYear;
    else if (viewMode === 'custom') period = `${dateRange.start} - ${dateRange.end}`;
    try {
      await generateAccountingReportPDF(
        madrasah,
        period,
        stats,
        breakdown,
        ledgerHistory,
        lang
      );
    } catch (err) {
      console.error("PDF Generation Error:", err);
      setStatusModal({ show: true, type: 'error', title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Error', message: lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে' : 'Failed to generate PDF' });
    }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="animate-spin text-[#2563EB]" size={32} />
    </div>
  );

      let displayPeriod = selectedMonth;
      if (viewMode === 'daily') displayPeriod = selectedDate;
      else if (viewMode === 'yearly') displayPeriod = selectedYear;
      else if (viewMode === 'custom') displayPeriod = `${dateRange.start} - ${dateRange.end}`;

      return (
        <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Filters */}
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} p-1 rounded-xl flex overflow-x-auto no-scrollbar w-full md:w-auto shrink-0`}>
                <button 
                    onClick={() => setViewMode('daily')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'daily' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    দৈনিক
                </button>
                <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'monthly' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {localT.monthly[lang]}
                </button>
                <button 
                    onClick={() => setViewMode('yearly')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'yearly' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {localT.yearly[lang]}
                </button>
                <button 
                    onClick={() => setViewMode('custom')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'custom' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    কাস্টম
                </button>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            {viewMode === 'daily' && (
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex-1 sm:flex-none sm:w-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                />
            )}
            
            {viewMode === 'custom' && (
                <div className="flex items-center gap-1 flex-1 sm:flex-none sm:w-auto">
                    <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                        className={`flex-1 md:flex-none px-2 py-2 border rounded-l-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                        className={`flex-1 md:flex-none px-2 py-2 border rounded-r-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    />
                </div>
            )}

            {viewMode === 'monthly' && (
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    min={activeYear?.start_date ? activeYear.start_date.slice(0, 7) : undefined}
                    max={activeYear?.end_date ? activeYear.end_date.slice(0, 7) : undefined}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex-1 sm:flex-none sm:w-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                />
            )}
            {viewMode === 'yearly' && (
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex-1 sm:flex-none sm:w-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            )}

            <div className="flex items-center gap-2 flex-1 sm:flex-none justify-between sm:justify-end">
                <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <Filter size={16} className="text-slate-400 shrink-0" />
                    <select 
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex-1 sm:flex-none sm:min-w-[150px] ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                        <option value="all">{localT.allClasses[lang]}</option>
                        {localClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.class_name}</option>
                        ))}
                    </select>
                </div>
                <button 
                onClick={handleDownloadPDF}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'}`}
                title={lang === 'bn' ? 'সারাংশ রিপোর্ট ডাউনলোড' : 'Download Summary Report'}
                >
                <Download size={16} />
                <span className="hidden lg:inline">{lang === 'bn' ? 'রিপোর্ট ডাউনলোড' : 'Download Report'}</span>
                </button>
            </div>
        </div>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Expected Income */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
              <DollarSign size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('expected_income', lang)}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>৳ {stats?.expected_income?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>{localT.targetMonthly[lang]}</span>
            <span className="text-blue-500">{localT.goal100[lang]}</span>
          </div>
        </div>

        {/* Predicted Collection (Student Fees) */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
              <Download size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সংগৃহীত ফি' : 'Collected Fees'}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>৳ {stats?.prediction?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
              <span>{localT.progress[lang]}</span>
              <span>{Math.round((stats?.prediction / stats?.expected_income) * 100) || 0}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div 
                className="h-full bg-blue-500 transition-all duration-1000" 
                style={{ width: `${Math.min(100, (stats?.prediction / stats?.expected_income) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total Income (All) */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
              <TrendingUp size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{localT.totalIncome[lang]}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-[#1E3A8A]'}`}>৳ {stats?.total_income?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>{lang === 'bn' ? 'মোট আয়' : 'Total In'}</span>
            <span className="text-emerald-500 font-black">LIVE</span>
          </div>
        </div>

        {/* Collection Rate */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              <BarChart3 size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('collection_rate_label', lang)}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-indigo-400' : 'text-[#1E3A8A]'}`}>{stats?.collection_rate}%</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div className="h-full bg-indigo-500" style={{ width: `${stats?.collection_rate}%` }} />
            </div>
            <span className="text-[9px] font-black text-indigo-500 uppercase">{localT.active[lang]}</span>
          </div>
        </div>

        {/* Total Expense */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500'}`}>
              <TrendingUp size={24} className="rotate-180" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{localT.totalExpense[lang]}</p>
              <h3 className="text-xl font-black text-red-500">৳ {stats?.total_expense?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{localT.monthlyOutflow[lang]}</p>
        </div>

        {/* Net Income */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${stats?.net_income >= 0 ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500') : (madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500')}`}>
              <Wallet size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{localT.netIncome[lang]}</p>
              <h3 className={`text-xl font-black ${stats?.net_income >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                ৳ {stats?.net_income?.toLocaleString('bn-BD')}
              </h3>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{localT.remainingBalance[lang]}</p>
        </div>
      </div>

      {/* Fee Breakdown Section */}
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble space-y-4`}>
        <div className="flex items-center gap-3 mb-2">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-500'}`}>
              <PieChart size={20} />
           </div>
           <h3 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{localT.feeBreakdown[lang]} ({displayPeriod})</h3>
        </div>
        
        <div className="space-y-3">
           {breakdown.length > 0 ? breakdown.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                 <div>
                    <h4 className={`font-black text-sm ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-[#1E3A8A]'}`}>{item.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Users size={10}/> {item.students} {localT.students[lang]}</span>
                       <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> {item.transactions} {localT.paid[lang]}</span>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">{localT.expectedCollected[lang]}</p>
                    <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-[#1E3A8A]'}`}>৳{item.expected.toLocaleString()} / <span className="text-emerald-500">৳{item.collected.toLocaleString()}</span></p>
                    <p className="text-[10px] font-bold text-red-400 mt-1">{localT.due[lang]}: ৳{(item.expected - item.collected).toLocaleString()}</p>
                 </div>
              </div>
           )) : (
              <div className="text-center py-8 text-slate-400 text-xs font-bold">{localT.noFeeStructures[lang]}</div>
           )}
        </div>
      </div>

      {/* Reminders Section */}
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-100 text-[#1E293B]'} p-8 rounded-[2.5rem] shadow-bubble border space-y-6`}>
            <div className="flex items-center justify-between">
            <div>
                <h3 className="text-xl font-black font-noto">{t('reminders', lang)}</h3>
                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">{reminders.length} {localT.studentsPending[lang]}</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
                <AlertCircle size={24} />
            </div>
            </div>

            {/* Template Selection */}
            <div className="relative">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t('template_title', lang)}
                </label>
                <button 
                  onClick={() => setShowShortcodes(!showShortcodes)}
                  className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                >
                  <Info size={12} /> Shortcodes
                </button>
              </div>

              {showShortcodes && (
                <div className={`${madrasah?.theme === 'dark' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50/50 border-purple-100/50'} p-3 rounded-2xl border mb-3 animate-in slide-in-from-top-2`}>
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">{localT.availableShortcodes[lang]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableShortcodes.map(sc => (
                      <div
                        key={sc.code}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-purple-300' : 'bg-white border-purple-100 text-[#2E0B5E]'}`}
                      >
                        {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 mt-2 italic">
                    {localT.useShortcodes[lang]}
                  </p>
                </div>
              )}

              <button 
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} 
                className={`w-full flex items-center justify-between px-5 py-3.5 border rounded-xl text-sm font-bold shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-[#8D30F4]" />
                  <span className="truncate">{selectedTemplate ? selectedTemplate.title : t('template_title', lang)}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-all ${showTemplateDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showTemplateDropdown && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-xl border z-[510] max-h-48 overflow-y-auto p-1 animate-in slide-in-from-top-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <button 
                    onClick={() => { setSelectedTemplate(null); setShowTemplateDropdown(false); }}
                    className={`w-full text-left px-4 py-3 border-b last:border-0 rounded-lg ${madrasah?.theme === 'dark' ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-50 hover:bg-slate-50'}`}
                  >
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">{localT.default[lang]}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{localT.defaultReminder[lang]}</p>
                  </button>
                  {templates.map(tmp => (
                    <button 
                      key={tmp.id} 
                      onClick={() => { setSelectedTemplate(tmp); setShowTemplateDropdown(false); }} 
                      className={`w-full text-left px-4 py-3 border-b last:border-0 rounded-lg ${madrasah?.theme === 'dark' ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-50 hover:bg-slate-50'}`}
                    >
                      <p className="text-[8px] font-black text-[#8D30F4] uppercase mb-0.5">{tmp.title}</p>
                      <p className="text-xs font-bold text-slate-500 truncate">{tmp.body}</p>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase">
                      {t('no_templates', lang)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button 
                onClick={() => sendBulkReminder('system')}
                disabled={sending}
                className="h-14 bg-[#2563EB] text-white rounded-2xl font-black text-[10px] uppercase shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
                {sending ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} fill="currentColor" />} {t('system_sms', lang)}
            </button>
            <button 
                onClick={() => sendBulkReminder('native')}
                disabled={sending}
                className={`h-14 rounded-2xl font-black text-[10px] uppercase border flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
            >
                <Smartphone size={16} fill="currentColor" /> {t('native_sms', lang)}
            </button>
            {(!role || role === 'madrasah_admin' || profile?.permissions?.can_use_voice_call) && (
              <button 
                  onClick={fetchVoices}
                  disabled={sending || isFetchingVoices}
                  className={`h-14 rounded-2xl font-black text-[10px] uppercase border flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 border-emerald-900/50 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
              >
                  {isFetchingVoices ? <Loader2 className="animate-spin" size={16} /> : <PhoneCall size={16} fill="currentColor" />} {t('voice_call', lang)}
              </button>
            )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {reminders.map((r, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm'}`}>
                <div className="min-w-0">
                    <h4 className={`font-black text-sm font-noto truncate ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{r.student_name}</h4>
                    <p className="text-[9px] font-bold opacity-60 uppercase">{r.class_name || localT.noClass[lang]} • {localT.due[lang]}: ৳{Math.max(0, Number(r.balance_due))}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase shrink-0 ${
                    r.reminder_type === 'final' ? 'bg-red-500 text-white' : r.reminder_type === 'strong' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                    {r.reminder_type === 'final' ? t('final_warning', lang) : r.reminder_type === 'strong' ? t('strong_reminder', lang) : t('soft_reminder', lang)}
                </span>
                </div>
            ))}
            {reminders.length === 0 && (
                <div className="col-span-full text-center py-10 opacity-40">
                <CheckCircle2 size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">{localT.allFeesCollected[lang]}</p>
                </div>
            )}
            </div>
        </div>

      {/* Voice Selection Modal - PORTALED */}
      {showVoiceModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-white'} w-full max-w-md rounded-[3rem] border-4 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300`}>
            <div className={`p-8 border-b ${madrasah?.theme === 'dark' ? 'border-slate-800 bg-slate-800/20' : 'border-slate-50 bg-slate-50/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
                    <PhoneCall size={24} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('voice_call', lang)}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 opacity-60`}>
                      {lang === 'bn' ? 'পেমেন্ট রিমাইন্ডার ভয়েস কল' : 'Payment Reminder Voice Call'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowVoiceModal(false)} className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'} active:scale-95 transition-all`}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              {voices.length === 0 ? (
                <div className={`p-6 rounded-2xl text-center border-2 border-dashed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  <Info size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-xs font-bold leading-relaxed">
                    {lang === 'bn' ? 'কোনো অনুমোদিত ভয়েস পাওয়া যায়নি। দয়া করে ভয়েস ব্রডকাস্ট মেনু থেকে ভয়েস আপলোড করুন।' : 'No approved voices found. Please upload a voice from Voice Broadcast menu.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('select_voice', lang)}</label>
                  <div className="relative group">
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      className={`w-full h-14 rounded-2xl px-5 font-black text-sm outline-none appearance-none transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-white border-slate-700 hover:border-blue-500/50' : 'bg-slate-50 text-[#1E3A8A] border-slate-200 hover:border-blue-500/50'} border-2 focus:border-[#2563EB] shadow-inner`}
                    >
                      {voices.map(v => (
                        <option key={v.id} value={v.id}>{v.title || v.provider_voice_name || 'Unknown Voice'}</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={20} />
                    </div>
                  </div>
                </div>
              )}

              {voices.length > 0 && reminders.length > 0 && (
                <div className={`p-6 rounded-[2rem] border-2 shadow-inner group transition-all ${madrasah?.theme === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/50 border-blue-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-500/60 mb-1">{lang === 'bn' ? 'মোট প্রাপক' : 'Total Recipients'}</p>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-blue-500" />
                        <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{reminders.filter(r => r.guardian_phone).length.toLocaleString('bn-BD')}</h4>
                        <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'জন' : 'Students'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-500/60 mb-1">{lang === 'bn' ? 'আনুমানিক খরচ' : 'Estimated Cost'}</p>
                      <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>৳{(reminders.filter(r => r.guardian_phone).length * voiceRate).toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    </div>
                  </div>
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <div className="h-full bg-blue-500 rounded-full w-full animate-pulse opacity-50" />
                  </div>
                </div>
              )}
            </div>

            <div className={`p-8 border-t flex gap-4 ${madrasah?.theme === 'dark' ? 'border-slate-800 bg-slate-800/10' : 'border-slate-50 bg-slate-50/30'}`}>
              <button
                onClick={() => setShowVoiceModal(false)}
                className={`flex-1 h-16 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100 border-2 border-slate-100 shadow-sm'}`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={sendVoiceBroadcast}
                disabled={sending || voices.length === 0}
                className="flex-1 h-16 bg-[#2563EB] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 group"
              >
                {sending ? <Loader2 className="animate-spin" size={20} /> : <PhoneCall size={20} className="group-hover:animate-bounce" />} 
                {lang === 'bn' ? 'কল করুন' : 'Call Now'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Status Modal - PORTALED */}
      {statusModal.show && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
          <div className={`${madrasah?.theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-50" } w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-2xl border animate-in zoom-in-95 duration-500 relative overflow-hidden`} >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform duration-700 ${ statusModal.type === "success" ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-red-50 text-red-500 border-red-100" } border-4 shadow-inner`} >
              {statusModal.type === "success" ? (
                <CheckCircle2 size={40} strokeWidth={2.5} className="animate-in zoom-in duration-500" />
              ) : (
                <AlertCircle size={40} strokeWidth={2.5} className="animate-in zoom-in duration-500" />
              )}
            </div>
            <h3 className={`text-[22px] font-black font-noto leading-tight tracking-tight ${ madrasah?.theme === "dark" ? "text-white" : "text-[#1E3A8A]" }`} >
              {statusModal.title || (statusModal.type === 'success' ? (lang === 'bn' ? 'সফল হয়েছে' : 'Success') : (lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Failed'))}
            </h3>
            <p className="text-[13px] font-bold text-slate-400 mt-3 font-noto px-4 leading-relaxed whitespace-pre-wrap">
              {statusModal.message}
            </p>
            <button
              onClick={() => setStatusModal({ ...statusModal, show: false })}
              className={`w-full mt-8 py-4 font-black rounded-full text-xs uppercase tracking-[0.2em] transition-all shadow-premium active:scale-95 ${ statusModal.type === "success" ? "bg-[#2563EB] text-white" : "bg-red-500 text-white" }`}
            >
              {lang === "bn" ? "ঠিক আছে" : "Continue"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SmartFeeAnalytics;
