
import React, { useState, useEffect } from 'react';
import { supabase, smsApi } from 'supabase';
import { Language, Class, SMSTemplate, Institution, UserRole, Profile } from 'types';
import { t } from 'translations';
import { ShortcodeService } from 'services/ShortcodeService';
import { TrendingUp, DollarSign, BarChart3, AlertCircle, Send, Loader2, CheckCircle2, MessageSquare, Smartphone, PieChart, Users, Filter, Calendar, Wallet, BookOpen, ChevronDown, Info, PhoneCall, Download } from 'lucide-react';
import { isValidUUID } from 'utils/validation';
import { generateAccountingReportPDF } from 'utils/pdfGenerator';

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
  totalExpense: { en: 'Total Expense', bn: 'মোট খরচ' },
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

const SmartFeeAnalytics: React.FC<SmartFeeAnalyticsProps> = ({ institutionId, lang, month: initialMonth, refreshKey, classes = [], madrasah, role, profile, activeYear }) => {
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showShortcodes, setShowShortcodes] = useState(false);
  
  // Voice Call States
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voiceRate, setVoiceRate] = useState<number>(1.00);
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);

  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'ছাত্রের নাম' : 'Student Name' },
    { code: '{due_amount}', label: lang === 'bn' ? 'বকেয়া টাকা' : 'Due Amount' },
    { code: '{month}', label: lang === 'bn' ? 'মাস' : 'Month' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },
  ];

  // Filters
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(activeYear?.start_date ? activeYear.start_date.slice(0, 4) : new Date().getFullYear().toString());
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  const [localClasses, setLocalClasses] = useState<Class[]>([]);

  useEffect(() => {
    if (classes.length > 0) {
      setLocalClasses(classes);
    } else if (isValidUUID(institutionId)) {
      supabase.from('classes')
        .select('*')
        .eq('institution_id', institutionId)
        .order('class_name')
        .then(({ data }) => {
          if (data) {
            let filteredClasses = data;
            if (role === 'teacher' && profile?.permissions?.allowed_classes) {
              filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
            }
            setLocalClasses(filteredClasses);
          }
        });
    }
  }, [institutionId, classes, role, profile]);

  useEffect(() => {
    fetchAnalytics();
    fetchTemplates();
  }, [institutionId, selectedMonth, selectedYear, viewMode, selectedClassId, refreshKey]);

  const fetchTemplates = async () => {
    if (!isValidUUID(institutionId)) return;
    const { data } = await supabase.from('sms_templates')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const fetchAnalytics = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    console.log("Fetching analytics for:", { institutionId, viewMode, selectedMonth, selectedYear, selectedClassId });
    try {
      const activeYearId = madrasah?.config_json?.active_academic_year_id;
      // Determine date filter for ledger
      const dateFilter = viewMode === 'monthly' ? selectedMonth : selectedYear;

      // 1. Fetch Fee Structures
      let structureQuery = supabase.from('fee_structures').select('*').eq('institution_id', institutionId);
      if (selectedClassId !== 'all') {
        structureQuery = structureQuery.or(`class_id.eq.${selectedClassId},class_id.is.null`);
      }
      const { data: structures, error: structError } = await structureQuery;
      console.log("Structures:", structures, "Error:", structError);
      if (!structures) return;

      // 2. Fetch Students for counts and class mapping
      let studentQuery = supabase.from('students').select('id, student_name, class_id').eq('institution_id', institutionId);
      if (selectedClassId !== 'all') {
        studentQuery = studentQuery.eq('class_id', selectedClassId);
      }
      if (activeYearId) {
        studentQuery = studentQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }
      const { data: students, error: studError } = await studentQuery;
      console.log("Students:", students, "Error:", studError);

      // Fetch student fee settings for the whole institution
      const { data: allSettings } = await supabase.from('student_fee_settings')
          .select('*')
          .eq('institution_id', institutionId);
      
      const studentCounts: Record<string, number> = {};
      const studentClassMap: Record<string, string> = {};
      
      students?.forEach(s => {
        studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
        studentClassMap[s.student_name] = s.class_id;
      });

      // 3. Fetch Ledger for transaction counts (Income) AND Expenses
      let ledgerQuery = supabase.from('ledger')
        .select('description, amount, type, category, transaction_date')
        .eq('institution_id', institutionId);
      
      if (activeYearId) {
        ledgerQuery = ledgerQuery.eq('academic_year_id', activeYearId);
      }

      const { data: ledger, error: ledgerError } = await ledgerQuery;
      console.log("Ledger:", ledger, "Error:", ledgerError);

      if (ledger) {
        // Filter ledger by period and class (if applicable) for the report
        const filteredLedger = ledger.filter(l => l.transaction_date.startsWith(dateFilter));
        setLedgerHistory(filteredLedger);
      }

      // 4. Process Data
      const breakdownMap: Record<string, { expected: number, collected: number, students: number, transactions: number }> = {};
      let totalExpected = 0;
      let totalCollected = 0;
      let totalExpense = 0;

      // Calculate Expenses
      ledger?.forEach(l => {
        if (l.type === 'expense' && l.transaction_date.startsWith(dateFilter)) {
          totalExpense += l.amount;
        }
      });
      console.log("Total Expense calculated:", totalExpense);

      structures.forEach(s => {
        // Evaluate active months based on year Start and fee start/due dates
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
            const isExpired = s.due_date && s.due_date.slice(0, 7) < dateFilter;
            const isNotStarted = s.start_date && s.start_date.slice(0, 7) > dateFilter;
            if (!isExpired && !isNotStarted) activeMonthsCount = 1;
        }

        if (activeMonthsCount === 0) return;

        // Calculate correct count and expected amount based on enabled settings
        let count = 0;
        let total = 0;
        const multiplier = activeMonthsCount;

        if (s.class_id === null) {
          // Global fee: count students who have this fee enabled
          students?.forEach(st => {
            const setting = allSettings?.find(as => as.student_id === st.id && as.fee_structure_id === s.id);
            if (setting ? setting.is_enabled : true) {
                count++;
                const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                total += amountToCharge * multiplier;
            }
          });
        } else {
          // Class fee: count students in this class who have this fee enabled
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
      console.log("Total Expected calculated:", totalExpected);

        // Count transactions and calculate collected amount (Income)
      ledger?.forEach(l => {
        if (l.type !== 'income' || l.category !== 'Student Fee') return;

        // Ensure it's for the selected month/year
        // Robust check: either transaction date matches or description contains month
        const isCorrectPeriod = l.transaction_date.startsWith(dateFilter) || l.description.includes(dateFilter);
        if (!isCorrectPeriod) return;

        const parts = l.description.split(' - ');
        if (parts.length < 2) return;

        const feePart = parts[0];
        const studentInfo = parts.slice(1).join(' - ');
        const studentName = studentInfo.split(' (')[0].trim();
        
        // Extract class name from description if possible
        const match = studentInfo.match(/\((.*?)\s*\|/);
        const classNameFromDesc = match ? match[1].trim() : null;
        
        let classId = studentClassMap[studentName];
        if (!classId && classNameFromDesc && localClasses.length > 0) {
            classId = localClasses.find(c => c.class_name.trim() === classNameFromDesc)?.id;
        }

        // If filtering by class, ensure student belongs to selected class
        if (selectedClassId !== 'all' && classId !== selectedClassId) return;

        const fees = feePart.split(',').map(f => f.trim());
        let totalStructureAmount = 0;
        const matchedStructures: any[] = [];
        
        fees.forEach(f => {
            const normalizedF = (f || '').toLowerCase().trim();
            // Find structure for this fee name and class
            // Match either the student's class or a global fee (class_id is null)
            const structure = structures.find(s => 
                (s.fee_name || '').toLowerCase().trim() === normalizedF && 
                (s.class_id === null || (classId && s.class_id === classId))
            );
            
            if (structure) {
                totalStructureAmount += structure.amount;
                matchedStructures.push(structure);
            } else {
                // Try matching by name only if class match fails
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
                    // Allocate actual collected amount proportionally
                    const ratio = totalStructureAmount > 0 ? (structure.amount / totalStructureAmount) : (1 / matchedStructures.length);
                    const allocatedAmount = l.amount * ratio;
                    breakdownMap[feeName].collected += allocatedAmount;
                }
            });
            totalCollected += l.amount;
        } else {
            // Fallback if no structures matched
            fees.forEach(f => {
                const normalizedF = (f || '').toLowerCase().trim();
                // Find any breakdown item that matches the name
                const breakdownKey = Object.keys(breakdownMap).find(k => (k || '').toLowerCase().trim() === normalizedF);
                if (breakdownKey) {
                    breakdownMap[breakdownKey].transactions += 1;
                    breakdownMap[breakdownKey].collected += l.amount / fees.length;
                }
            });
            totalCollected += l.amount;
        }
      });
      console.log("Total Collected calculated:", totalCollected);

      const breakdownList = Object.entries(breakdownMap).map(([name, data]) => ({ name, ...data }));
      setBreakdown(breakdownList);

      // Set Stats
      setStats({
        expected_income: totalExpected,
        prediction: totalCollected,
        total_expense: totalExpense,
        net_income: totalCollected - totalExpense,
        collection_rate: totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0
      });

      // Fetch reminders only for monthly view (current dues)
      if (viewMode === 'monthly') {
        const { data: remindersData, error: remError } = await supabase.rpc('get_fee_reminder_list', { 
          p_institution_id: institutionId, 
          p_month: selectedMonth,
          p_academic_year_id: null // Bypass RPC filter to handle null academic_year_id correctly
        });
        console.log("Reminders:", remindersData, "Error:", remError);
        
        if (remindersData) {
            // Filter reminders by active students (which handles class and academic_year_id filters)
            const activeStudentIds = new Set(students?.map(s => s.id) || []);
            const filteredReminders = remindersData.filter((r: any) => activeStudentIds.has(r.student_id));
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
    }
  };

  const fetchVoices = async () => {
    setIsFetchingVoices(true);
    try {
      const { data: sysSettings } = await supabase.from('system_settings').select('voice_rate').single();
      if (sysSettings?.voice_rate) setVoiceRate(sysSettings.voice_rate);

      const { data: localVoices } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('provider_status', 'approved');
      
      setVoices(localVoices || []);
      if (localVoices && localVoices.length > 0) {
        setSelectedVoiceId(localVoices[0].id);
      }
      setShowVoiceModal(true);
    } catch (err) {
      console.error('Error fetching voices:', err);
      alert(lang === 'bn' ? 'ভয়েস লোড করতে সমস্যা হয়েছে।' : 'Failed to load voices.');
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

      const sNumber = instData.voice_sender_id;
      if (!sNumber) throw new Error(lang === 'bn' ? 'কোনো সেন্ডার আইডি সেট করা নেই।' : 'No Sender ID configured.');

      const voiceName = voice.provider_voice_name || voice.title;
      const requestId = 'fee_' + Math.random().toString(36).substr(2, 9);

      // Normalize phone numbers: 11 digits (01...)
      const normalizedPhoneNumbers = phoneNumbers
        .map(phone => {
          if (!phone) return '';
          const digits = phone.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        })
        .filter(p => p && p.length === 11 && p.startsWith('01'));

      if (normalizedPhoneNumbers.length === 0) {
        throw new Error(lang === 'bn' ? 'কোনো সঠিক মোবাইল নম্বর (০১৭xxx...) পাওয়া যায়নি।' : 'No valid 11-digit phone numbers (01...) found.');
      }

      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: normalizedPhoneNumbers,
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
        let errorMessage = 'Failed to send broadcast via Awaj API';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // Deduct balance
      const { error: deductError } = await supabase.rpc('deduct_balance', {
        p_institution_id: institutionId,
        p_amount: estimatedCost
      });
      if (deductError) throw deductError;

      // Save to Supabase
      await supabase.from('voice_broadcasts').insert({
        institution_id: institutionId,
        voice_template_id: selectedVoiceId,
        total_numbers: phoneNumbers.length,
        estimated_cost: estimatedCost,
        status: 'pending',
        provider_campaign_id: campaignId.toString()
      });

      alert(lang === 'bn' ? 'ভয়েস কল সফলভাবে পাঠানো হয়েছে' : 'Voice broadcast sent successfully');
      setShowVoiceModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to send voice broadcast');
    } finally {
      setSending(false);
    }
  };

  const sendBulkReminder = async (type: 'native' | 'system') => {
    if (reminders.length === 0) return;
    
    if (type === 'native') {
      const phones = reminders.map(r => r.guardian_phone).join(',');
      let body = selectedTemplate 
        ? selectedTemplate.body 
        : `আস-সালামু আলাইকুম, {student_name} এর {month} মাসের বকেয়া ফি ৳{due_amount} দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো।`;
      
      // Simple variable replacement if using template
      if (selectedTemplate) {
        body = body.replace(/\[month\]/g, '{month}')
                   .replace(/\[amount\]/g, '{due_amount}')
                   .replace(/\[name\]/g, '{student_name}');
      }

      // For native SMS, we can only send one message to all, so we use the first student's data as a preview
      // But actually native SMS doesn't support shortcodes per recipient.
      // So we'll just use the first student's data for the native SMS body.
      const firstData = {
        student_name: reminders[0].student_name,
        month: selectedMonth,
        due_amount: Math.max(0, Number(reminders[0].balance_due))
      };
      const finalBody = ShortcodeService.replaceShortcodes(body, firstData);

      window.location.href = `sms:${phones}?body=${encodeURIComponent(finalBody)}`;
    } else {
      setSending(true);
      try {
        // Map reminders to Student-like objects for SMSService
        const pseudoStudents = reminders.map(r => ({
          id: r.student_id,
          student_name: r.student_name,
          guardian_phone: r.guardian_phone,
          institution_id: institutionId
        })) as any[];

        let body = selectedTemplate 
          ? selectedTemplate.body 
          : `আস-সালামু আলাইকুম, {student_name} এর {month} মাসের বকেয়া ফি ৳{due_amount} দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো।`;

        // If using old style templates, convert them
        if (selectedTemplate) {
          body = body.replace(/\[month\]/g, '{month}')
                     .replace(/\[amount\]/g, '{due_amount}')
                     .replace(/\[name\]/g, '{student_name}');
        }

        await smsApi.sendBulk(institutionId, pseudoStudents, body);
        alert(lang === 'bn' ? 'রিমাইন্ডার সফলভাবে পাঠানো হয়েছে' : 'Reminders sent successfully');
      } catch (err: any) {
        alert(err.message || 'Failed to send SMS');
      } finally {
        setSending(false);
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!madrasah || !stats) return;
    const period = viewMode === 'monthly' ? selectedMonth : selectedYear;
    try {
      await generateAccountingReportPDF(
        { name: madrasah.name },
        period,
        stats,
        breakdown,
        ledgerHistory,
        lang
      );
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে' : 'Failed to generate PDF');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="animate-spin text-[#2563EB]" size={32} />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Filters */}
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-center justify-between`}>
        <div className="flex items-center gap-2">
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} p-1 rounded-xl flex`}>
                <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'monthly' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {localT.monthly[lang]}
                </button>
                <button 
                    onClick={() => setViewMode('yearly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'yearly' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {localT.yearly[lang]}
                </button>
            </div>
            
            {viewMode === 'monthly' ? (
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    min={activeYear?.start_date ? activeYear.start_date.slice(0, 7) : undefined}
                    max={activeYear?.end_date ? activeYear.end_date.slice(0, 7) : undefined}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                />
            ) : (
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            )}
        </div>

        <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[150px] ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
            >
                <option value="all">{localT.allClasses[lang]}</option>
                {localClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
            </select>
            <button 
              onClick={handleDownloadPDF}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'}`}
              title={lang === 'bn' ? 'সারাংশ রিপোর্ট ডাউনলোড' : 'Download Summary Report'}
            >
              <Download size={16} />
              <span className="hidden lg:inline">{lang === 'bn' ? 'রিপোর্ট ডাউনলোড' : 'Download Report'}</span>
            </button>
        </div>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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

        {/* Predicted Collection */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
              <TrendingUp size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewMode === 'yearly' ? localT.totalCollected[lang] : t('predicted_total', lang)}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-[#1E3A8A]'}`}>৳ {stats?.prediction?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
              <span>{localT.progress[lang]}</span>
              <span>{Math.round((stats?.prediction / stats?.expected_income) * 100) || 0}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000" 
                style={{ width: `${Math.min(100, (stats?.prediction / stats?.expected_income) * 100)}%` }}
              />
            </div>
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
           <h3 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{localT.feeBreakdown[lang]} ({viewMode === 'monthly' ? selectedMonth : selectedYear})</h3>
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

      {/* Reminders Section - Only show for Monthly View */}
      {viewMode === 'monthly' && (
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
      )}
      {/* Voice Selection Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-md rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col`}>
            <div className={`p-6 border-b ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('voice_call', lang)}</h3>
              <p className={`text-xs font-bold mt-1 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'bn' ? 'ভয়েস ব্রডকাস্ট পাঠাতে একটি ভয়েস নির্বাচন করুন' : 'Select a voice to send broadcast'}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {voices.length === 0 ? (
                <div className={`p-4 rounded-xl text-center text-sm font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                  {lang === 'bn' ? 'কোনো অনুমোদিত ভয়েস পাওয়া যায়নি। দয়া করে ভয়েস ব্রডকাস্ট মেনু থেকে ভয়েস আপলোড করুন।' : 'No approved voices found. Please upload a voice from Voice Broadcast menu.'}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('select_voice', lang)}</label>
                  <select
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className={`w-full h-12 rounded-xl px-4 font-bold text-sm outline-none appearance-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-[#1E3A8A] border-slate-200'} border focus:border-[#2563EB]/50`}
                  >
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.title || v.provider_voice_name || 'Unknown Voice'}</option>
                    ))}
                  </select>
                </div>
              )}

              {voices.length > 0 && reminders.length > 0 && (
                <div className={`p-4 rounded-xl flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-blue-900/20 border-blue-900/50' : 'bg-blue-50 border-blue-100'} border`}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">{lang === 'bn' ? 'মোট প্রাপক' : 'Total Recipients'}</p>
                    <h4 className="text-lg font-black text-blue-600">{reminders.filter(r => r.guardian_phone).length}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">{lang === 'bn' ? 'আনুমানিক খরচ' : 'Estimated Cost'}</p>
                    <h4 className="text-lg font-black text-blue-600">{(reminders.filter(r => r.guardian_phone).length * voiceRate).toFixed(2)} ৳</h4>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 border-t flex gap-3 ${madrasah?.theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
              <button
                onClick={() => setShowVoiceModal(false)}
                className={`flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={sendVoiceBroadcast}
                disabled={sending || voices.length === 0}
                className="flex-1 h-12 bg-[#2563EB] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="animate-spin" size={16} /> : <PhoneCall size={16} />} {lang === 'bn' ? 'কল করুন' : 'Call Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartFeeAnalytics;
