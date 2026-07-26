import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Student, UserRole, Profile } from 'types';
import { Loader2, Plus, X, DollarSign, Tag, CheckCircle2, Download, ChevronDown, RefreshCw, AlertCircle, Info, Users, Edit3, Trash2, Calendar, Phone, Check } from 'lucide-react';
import { sortMadrasahClasses } from 'pages/Classes';
import { generateClassFeeReportPDF, generateFeeReceiptPDF } from '../../utils/pdfGenerator';
import { requestManager, CACHE_TTLS } from '../../services/RequestManager';
import { OfflineService } from '../../services/OfflineService';

interface SchoolFeeEngineProps {
  activeTab: 'fees' | 'structures';
  madrasah: Institution;
  lang: 'en' | 'bn';
  classes: Class[];
  onStudentClick?: (student: any) => void;
  role?: UserRole;
  profile?: Profile | null;
  activeYear?: any;
  refreshKey?: number;
  triggerRefresh?: () => void;
}

// Global cache to prevent re-fetching on tab switch
let globalSchoolFeesReport: Record<string, any[]> = {};
let globalSchoolStructures: Record<string, any[]> = {};

export const clearGlobalSchoolFeeCache = () => {
  globalSchoolFeesReport = {};
  globalSchoolStructures = {};
};

export const SchoolFeeEngine: React.FC<SchoolFeeEngineProps> = ({ activeTab, madrasah, lang, classes: initialClasses, onStudentClick, role, profile, activeYear, refreshKey, triggerRefresh }) => {
  const isDark = madrasah.theme === 'dark';
  const [classes, setClasses] = useState<Class[]>(initialClasses || []);

  const activeYearId = React.useMemo(() => {
    if (!madrasah?.config_json) return null;
    let config = madrasah.config_json as any;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    const yearId = config?.active_academic_year_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(yearId) ? yearId : null;
  }, [madrasah]);
  
  const selectedClassInitial = () => localStorage.getItem('school_fee_selectedClass') || '';
  const selectedMonthInitial = () => localStorage.getItem('school_fee_selectedMonth') || new Date().toISOString().slice(0, 7);
  const cacheKey = `${madrasah.id}_${selectedMonthInitial()}_${selectedClassInitial()}`;
  
  const [feesReport, setFeesReport] = useState<any[]>(() => globalSchoolFeesReport[cacheKey] || []);
  const [structures, setStructures] = useState<any[]>(() => globalSchoolStructures[madrasah.id] || []);
  const [loading, setLoading] = useState(() => !globalSchoolFeesReport[cacheKey]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fee Collection State
  const [selectedClass, setSelectedClass] = useState<string>(selectedClassInitial);
  const [selectedMonth, setSelectedMonth] = useState(selectedMonthInitial);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [anyStudentsInMadrasah, setAnyStudentsInMadrasah] = useState<boolean | null>(null);

  useEffect(() => {
    localStorage.setItem('school_fee_selectedClass', selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    localStorage.setItem('school_fee_selectedMonth', selectedMonth);
  }, [selectedMonth]);
  
  // Collection Modal State
  const [showFeeCollection, setShowFeeCollection] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableFeeItems, setAvailableFeeItems] = useState<any[]>([]);
  const [selectedFeeCategories, setSelectedFeeCategories] = useState<string[]>([]);
  const [paidFeeCategories, setPaidFeeCategories] = useState<string[]>([]);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<any>(null);
  const [studentFeeHistory, setStudentFeeHistory] = useState<any[]>([]);
  const [historyStudentSettings, setHistoryStudentSettings] = useState<any[]>([]);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear().toString());

  // Structure State
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [structureSelectedClass, setStructureSelectedClass] = useState<string>('');
  const [showStructureClassDropdown, setShowStructureClassDropdown] = useState(false);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [activeYearEndDate, setActiveYearEndDate] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);

  useEffect(() => {
    fetchData();
  }, [madrasah.id, activeTab, selectedMonth, selectedClass, refreshKey]);

  useEffect(() => {
    if (selectedStudent) {
      initializeFeeCollection(selectedStudent);
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (initialClasses) {
      setClasses(initialClasses);
    }
  }, [initialClasses]);

  const fetchData = async () => {
    if (feesReport.length === 0 && structures.length === 0) {
      setLoading(true);
    }
    setFetchError(null);
    try {
      if (activeYearId) {
          const { data: yearData } = await requestManager.cachedFetch(
            'academic_years',
            (q) => q.select('end_date').eq('id', activeYearId).single(),
            `academic_year_end:${activeYearId}`,
            CACHE_TTLS.LONG
          );
          if (yearData) {
              setActiveYearEndDate(yearData.end_date);
          }
      }

      if (activeTab === 'fees') {
        if (!selectedClass) {
          setFeesReport([]);
          setLoading(false);
          return;
        }

        const classId = selectedClass;
        
        const { data: feeStructures } = await requestManager.cachedFetch(
          'fee_structures',
          (q) => q.select('*').eq('institution_id', madrasah.id),
          `structures:${madrasah.id}`,
          CACHE_TTLS.MEDIUM
        );

        const yearStart = madrasah.config_json?.academic_year_start;
        const startMonth = yearStart ? yearStart.slice(0, 7) : `${selectedMonth.slice(0, 4)}-01`;

        const { data: allFeesData } = await requestManager.cachedFetch(
          'fees',
          (q) => {
            let query = q.select('student_id, amount_paid, discount, month')
              .eq('institution_id', madrasah.id)
              .gte('month', startMonth)
              .lte('month', selectedMonth);
            if (activeYearId) {
              query = query.eq('academic_year_id', activeYearId);
            }
            return query;
          },
          `all_fees:${madrasah.id}_${startMonth}_${selectedMonth}_${activeYearId || 'current'}`,
          CACHE_TTLS.SHORT 
        );

        const feesData = allFeesData?.filter(f => f.month === selectedMonth) || [];

        const getMonthsInRange = (startMonthStr: string, endMonthStr: string): string[] => {
          const months: string[] = [];
          let [startYear, startMonth] = startMonthStr.split('-').map(Number);
          const [endYear, endMonth] = endMonthStr.split('-').map(Number);
          
          if (!startYear || !startMonth || !endYear || !endMonth) return [];
          
          while (startYear < endYear || (startYear === endYear && startMonth <= endMonth)) {
            months.push(`${startYear}-${String(startMonth).padStart(2, '0')}`);
            startMonth++;
            if (startMonth > 12) {
              startMonth = 1;
              startYear++;
            }
          }
          return months;
        };

        const previousMonths = getMonthsInRange(startMonth, selectedMonth).filter(m => m < selectedMonth);

        // Fetch student fee settings for the whole institution
        const { data: allSettings } = await requestManager.cachedFetch(
          'student_fee_settings',
          (q) => q.select('*').eq('institution_id', madrasah.id),
          `settings:${madrasah.id}`,
          CACHE_TTLS.MEDIUM
        );

        const { data: studentsData, error } = await requestManager.cachedFetch(
          'students',
          (q) => {
            let query = q.select('id, student_name, roll, class_id, classes(class_name), guardian_phone, is_active, notes')
              .eq('institution_id', madrasah.id);
            if (classId) {
              query = query.eq('class_id', classId);
            }
            if (activeYearId) {
              query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
            }
            if ((window as any)._hasIsActive !== false) {
              query = query.eq('is_active', true);
            }
            return query;
          },
          `students_report:${madrasah.id}_${selectedClass}_${activeYearId || 'current'}`,
          CACHE_TTLS.LONG
        );
        
        if (error) throw error;
        
        const data = (studentsData || []).map((s: any) => ({
          student_id: s.id,
          id: s.id, // required for shortcode parsing
          student_name: s.student_name,
          roll: s.roll,
          class_id: s.class_id,
          class_name: s.classes?.class_name,
          guardian_phone: s.guardian_phone,
          notes: s.notes
        }));

        let filteredData = data || [];
        if (role === 'teacher' && profile?.permissions?.allowed_classes && !classId) {
          filteredData = data.filter((student: any) => (profile.permissions.allowed_classes || []).includes(student.class_id));
        }

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const correctedData = filteredData.map((student: any) => {
            const studentSettings = allSettings?.filter(as => as.student_id === student.student_id) || [];
            
            // Calculate previous due
            let previousPayable = 0;
            const studentNotes = student.notes || '';
            const accStartMatch = studentNotes.match(/\[ACC_START:(.*?)\]/);
            const accStartDate = accStartMatch ? accStartMatch[1] : null;

            previousMonths.forEach(m => {
                const studentFeeStructuresForMonth = feeStructures?.filter(fs => {
                    const isClassMatch = fs.class_id === student.class_id || fs.class_id === null;
                    if (!isClassMatch) return false;
                    
                    const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
                    const isEnabled = setting ? setting.is_enabled : true;
                    const isMonthExpired = fs.due_date && m > fs.due_date.slice(0, 7);
                    const isMonthNotStarted = fs.start_date && m < fs.start_date.slice(0, 7);
                    const isBeforeYearStart = yearStart && m < yearStart.slice(0, 7);
                    
                    // Respect student individual accounting start date
                    const isBeforeAccStart = accStartDate && m < accStartDate;

                    return isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart && !isBeforeAccStart;
                }) || [];
                
                const monthPayable = studentFeeStructuresForMonth.reduce((sum, fs) => {
                    const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
                    const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(fs.amount);
                    return sum + amountToCharge;
                }, 0);
                previousPayable += monthPayable;
            });

            const allStudentFees = allFeesData?.filter(f => f.student_id === student.student_id) || [];
            const totalPaidOverall = allStudentFees.reduce((sum, f) => sum + Number(f.amount_paid) + Number(f.discount || 0), 0);
            
            const previousDue = Math.max(0, previousPayable - totalPaidOverall);

            const studentFeeStructures = feeStructures?.filter(fs => {
                const isClassMatch = fs.class_id === student.class_id || fs.class_id === null;
                if (!isClassMatch) return false;
                
                const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
                const isEnabled = setting ? setting.is_enabled : true;
                const isMonthExpired = fs.due_date && selectedMonth > fs.due_date.slice(0, 7);
                const isMonthNotStarted = fs.start_date && selectedMonth < fs.start_date.slice(0, 7);

                // If yearStart exists, ensure selectedMonth >= yearStart
                const isBeforeYearStart = yearStart && selectedMonth < yearStart.slice(0, 7);

                // Respect student individual accounting start date
                const isBeforeAccStart = accStartDate && selectedMonth < accStartDate;

                return isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart && !isBeforeAccStart;
            }) || [];
            
            const totalPayable = studentFeeStructures.reduce((sum, fs) => {
                const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
                const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(fs.amount);
                return sum + amountToCharge;
            }, 0);
            
            const studentFees = feesData?.filter(f => f.student_id === student.student_id) || [];
            const totalPaid = studentFees.reduce((sum, f) => sum + Number(f.amount_paid) + Number(f.discount || 0), 0);
            
            const balanceDue = Math.max(0, previousPayable + totalPayable - totalPaidOverall);
            
            let status = 'unpaid';
            if (totalPayable > 0) {
                if (totalPaid >= totalPayable) status = 'paid';
                else if (totalPaid > 0) status = 'partial';
                else status = 'unpaid';
            } else {
                status = totalPaid > 0 ? 'paid' : 'no_fee';
            }

            return {
                ...student,
                previous_due: previousDue,
                total_payable: totalPayable,
                total_paid: totalPaid,
                balance_due: balanceDue,
                status: status,
                fee_items: studentFeeStructures.map(fs => {
                    const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
                    return {
                        name: fs.fee_name,
                        amount: setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(fs.amount)
                    };
                })
            };
        });

        // Sort students by roll in continuous numeric order, placing empty or non-numeric roll at the end
        if (correctedData) {
            correctedData.sort((a, b) => {
                const rA = a.roll != null && a.roll !== '' ? Number(a.roll) : 999999;
                const rB = b.roll != null && b.roll !== '' ? Number(b.roll) : 999999;
                if (isNaN(rA) && isNaN(rB)) {
                    return String(a.roll || '').localeCompare(String(b.roll || ''));
                }
                if (isNaN(rA)) return 1;
                if (isNaN(rB)) return -1;
                if (rA !== rB) {
                    return rA - rB;
                }
                return String(a.student_name || '').localeCompare(String(b.student_name || ''));
            });
        }

        setFeesReport(correctedData || []);
        const cacheKeyCurrent = `${madrasah.id}_${selectedMonth}_${selectedClass}`;
        globalSchoolFeesReport[cacheKeyCurrent] = correctedData || [];

        if (!data || data.length === 0) {
          let checkQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
          if (classId) checkQuery = checkQuery.eq('class_id', classId);
          if (activeYearId) checkQuery = checkQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
          const { count } = await checkQuery;
          setAnyStudentsInMadrasah(count && count > 0 ? true : false);
        } else {
          setAnyStudentsInMadrasah(true);
        }
      }

      if (activeTab === 'structures') {
        const { data } = await requestManager.cachedFetch(
          'fee_structures',
          (q) => q.select('*, classes(class_name)').eq('institution_id', madrasah.id),
          `structures_full:${madrasah.id}`,
          CACHE_TTLS.MEDIUM
        );
        if (data) {
           setStructures(data || []);
           globalSchoolStructures[madrasah.id] = data || [];
        }
      }
    } catch (e: any) {
      console.error("Fetch Error:", e);
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeFeeCollection = async (student: any) => {
    setDiscount('');
    setCollectError(null);
    
    // 1. Fetch structures
    const { data: structures } = await requestManager.cachedFetch(
      'fee_structures',
      (q) => q.select('*').eq('institution_id', madrasah.id).or(`class_id.eq.${student.class_id},class_id.is.null`),
      `structures:${madrasah.id}:${student.class_id}`,
      CACHE_TTLS.LONG
    );
    if (!structures) {
        setAvailableFeeItems([]);
        return;
    }

    // Fetch student fee settings
    const { data: settings } = await requestManager.cachedFetch(
      'student_fee_settings',
      (q) => q.select('*').eq('student_id', student.student_id),
      `student_settings:${student.student_id}`,
      CACHE_TTLS.LONG
    );
    
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const enabledStructures = structures.filter(s => {
        const setting = settings?.find(set => set.fee_structure_id === s.id);
        const isEnabled = setting ? setting.is_enabled : true;
        
        // Also check if the selected month is after the due date's month
        const isMonthExpired = s.due_date && selectedMonth > s.due_date.slice(0, 7);
        
        // Check if the selected month is before the start date's month
        const isMonthNotStarted = s.start_date && selectedMonth < s.start_date.slice(0, 7);
        
        return isEnabled && !isMonthExpired && !isMonthNotStarted;
    }).map(s => {
        const setting = settings?.find(set => set.fee_structure_id === s.id);
        if (setting?.custom_amount !== undefined && setting?.custom_amount !== null) {
            return { ...s, amount: Number(setting.custom_amount) };
        }
        return s;
    });

    setAvailableFeeItems(enabledStructures);

    // 2. Fetch ledger entries for this student/month to see what's paid
    const yearStart = madrasah.config_json?.academic_year_start;
    const className = classes.find(c => c.id === student.class_id)?.class_name || '';
    const roll = student.roll || '-';
    
    const { data: ledgerData } = await requestManager.cachedFetch(
      'ledger',
      (q) => {
        let qry = q.select('description').eq('institution_id', madrasah.id).eq('type', 'income').eq('category', 'Student Fee').ilike('description', `%${student.student_name} (${className} | Roll: ${roll} | Month: ${selectedMonth})%`);
        if (yearStart) {
          qry = qry.gte('created_at', yearStart);
        }
        return qry;
      },
      `ledger_paid:${madrasah.id}:${student.student_id}:${selectedMonth}`,
      CACHE_TTLS.SHORT
    );

    const paidItems: string[] = [];
    ledgerData?.forEach(l => {
        const desc = (l.description || '').split(' - ')[0];
        if (desc) {
            desc.split(', ').forEach(item => paidItems.push(item));
        }
    });
    setPaidFeeCategories(paidItems);

    // 3. Select unpaid items (only from available/non-expired items)
    const unpaid = enabledStructures.filter(s => !(paidItems || []).includes(s.fee_name));
    const unpaidNames = unpaid.map(s => s.fee_name);
    setSelectedFeeCategories(unpaidNames);
    
    // 4. Set initial amount
    const total = unpaid.reduce((sum, s) => sum + s.amount, 0);
    setCollectAmount(total > 0 ? total.toString() : '');
  };

  const calculateTotal = (categories: string[], discountVal: string, items = availableFeeItems, monthsCount = 1) => {
    const gross = items
        .filter(item => (categories || []).includes(item.fee_name))
        .reduce((sum, item) => sum + item.amount, 0) * monthsCount;
    
    const disc = parseFloat(discountVal) || 0;
    const net = Math.max(0, gross - disc);
    return categories.length > 0 ? net.toString() : '';
  };

  const handleCollectFee = async () => {
    if (!selectedStudent || collectAmount === '') return;
    
    const totalAmt = parseFloat(collectAmount) || 0;
    const totalDueStr = calculateTotal(selectedFeeCategories, discount, availableFeeItems);
    const maxAllowed = parseFloat(totalDueStr) || 0;
    
    if (totalAmt > maxAllowed) {
        setCollectError(lang === 'bn' ? 'নির্ধারিত পরিমাণের চেয়ে বেশি নেওয়া যাবে না।' : 'Cannot collect more than the total due amount.');
        return;
    }

    setCollectError(null);
    setIsSaving(true);
    try {
      const activeYearId = madrasah.config_json?.active_academic_year_id;
      const totalDiscount = parseFloat(discount) || 0;
      
      const feeData = {
        institution_id: madrasah.id,
        student_id: selectedStudent.student_id,
        class_id: selectedStudent.class_id,
        amount_paid: totalAmt,
        month: selectedMonth,
        academic_year_id: activeYearId,
        status: (Number(selectedStudent.total_paid) + totalAmt + totalDiscount) >= Number(selectedStudent.total_payable) ? 'paid' : 'partial'
      };

      // Try inserting with discount first
      let feeIdToSave = '';
      if (navigator.onLine) {
        let { data: feeRes, error: feeErr } = await supabase.from('fees').insert({
          ...feeData,
          discount: totalDiscount
        }).select('id');
        
        // If error is about missing column, retry without discount
        if (feeErr && (feeErr.message.includes('column') || feeErr.code === '42703')) {
            const { data: retryRes, error: retryErr } = await supabase.from('fees').insert(feeData).select('id');
            feeErr = retryErr;
            if (retryRes && retryRes.length > 0) feeIdToSave = retryRes[0].id;
        } else if (feeRes && feeRes.length > 0) {
            feeIdToSave = feeRes[0].id;
        }
        
        if (feeErr) throw feeErr;
      } else {
        await OfflineService.safeInsert('fees', { ...feeData, discount: totalDiscount });
      }

      // Add to Ledger
      const feeDescription = selectedFeeCategories.length > 0 ? selectedFeeCategories.join(', ') : (lang === 'bn' ? 'স্টুডেন্ট ফি' : 'Student Fee');
      const className = classes.find(c => c.id === selectedStudent.class_id)?.class_name || '';
      const roll = selectedStudent.roll || '-';
      
      let finalDescription = `${feeDescription} - ${selectedStudent.student_name} (${className} | Roll: ${roll} | Month: ${selectedMonth})${totalDiscount > 0 ? " (ছাড়: ৳" + totalDiscount + ")" : ""}`;
      if (feeIdToSave) {
          finalDescription += ` || FEE_ID: ${feeIdToSave}`;
      }

      await OfflineService.safeInsert('ledger', {
        institution_id: madrasah.id,
        type: 'income',
        amount: totalAmt,
        category: 'Student Fee',
        description: finalDescription,
        transaction_date: new Date().toISOString().split('T')[0],
        academic_year_id: activeYearId
      });

      setShowFeeCollection(false);
      setCollectAmount('');
      setDiscount('');
      setSelectedStudent(null);
      
      requestManager.invalidatePattern(`fees:${madrasah.id}`);
      requestManager.invalidatePattern(`stats:${madrasah.id}`);
      requestManager.invalidatePattern(`dashboard_`);
      requestManager.invalidatePattern(`accounting-fees-${selectedStudent.student_id}`);
      requestManager.invalidatePattern(`accounting-history-${selectedStudent.student_id}`);
      requestManager.invalidatePattern(`fetch:ledger:`);

      // Auto Send SMS
      if (madrasah?.config_json?.features?.fee_collection_sms) {
        try {
          const smsApiModule = await import('supabase').then(res => res.smsApi);
          
          const templates = (madrasah?.config_json as any)?.features?.sms_templates || {};
          let template = templates.fee_collection || (lang === 'bn' 
            ? `আস-সালামু আলাইকুম, {student_name} এর বেতন বাবদ {amount} টাকা জমা হয়েছে। ধন্যবাদ।`
            : `As-salamu Alaikum, {amount} BDT has been received as fee for {student_name}. Thank you.`);
          
          const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
          const date = new Date(selectedMonth + '-01');
          const formattedMonth = lang === 'bn' ? bnMonths[date.getMonth()] : date.toLocaleString('en-US', { month: 'long' });
          const stName = selectedStudent.student_name || '';
          const fatherName = selectedStudent.father_name || '';
          const stRoll = selectedStudent.roll || '';
          const stClass = classes.find(c => c.id === selectedStudent.class_id)?.class_name || '';
          const currentDue = Math.max(0, Number(selectedStudent.balance_due || 0) - totalAmt - totalDiscount);

          let collectMsg = template
             .replace(/\{student_name\}/g, stName)
             .replace(/\{father_name\}/g, fatherName)
             .replace(/\{class\}/g, stClass)
             .replace(/\{roll\}/g, stRoll)
             .replace(/\{month\}/g, formattedMonth)
             .replace(/\{paid_amount\}/g, totalAmt.toString())
             .replace(/\{amount\}/g, totalAmt.toString())
             .replace(/\{due_amount\}/g, currentDue.toString());
            
          await smsApiModule.sendBulk(madrasah.id, [selectedStudent], collectMsg);
        } catch (smsError: any) {
          console.error("Fee SMS error: ", smsError);
          alert(lang === 'bn' ? `অটো এসএমএস পাঠানো সম্ভব হয়নি: ${smsError.message}` : `Auto SMS failed: ${smsError.message}`);
        }
      }
      
      if (triggerRefresh) triggerRefresh();
      fetchData();
    } catch (err: any) { 
      if (err.message?.includes('row-level security policy')) {
         setActionError("Database RLS Error: Please run the SQL migration script in Supabase SQL Editor to fix permissions for 'fees' and 'ledger' tables. You can find the script in 'src/services/migration_fees_and_ledger_rls.sql'.");
      } else {
         setActionError(err.message); 
      }
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleShowHistory = async (student: any) => {
    setHistoryStudent(student);
    setShowHistoryModal(true);
    fetchStudentHistory(student.student_id, historyYear);
  };

  const fetchStudentHistory = async (studentId: string, year: string) => {
    const [{ data }, { data: settingsData }] = await Promise.all([
      supabase.from('fees')
        .select('*')
        .eq('student_id', studentId)
        .like('month', `${year}-%`),
      supabase.from('student_fee_settings').select('*').eq('student_id', studentId)
    ]);
    setStudentFeeHistory(data || []);
    setHistoryStudentSettings(settingsData || []);
  };

  useEffect(() => {
      if (historyStudent) {
          fetchStudentHistory(historyStudent.student_id, historyYear);
      }
  }, [historyYear]);

  const handleDownloadClassReport = async (downloadLang: 'en' | 'bn' = lang) => {
    if (feesReport.length === 0) {
      setActionError('No data to download');
      return;
    }

    const className = classes.find(c => c.id === selectedClass)?.class_name || 'All Classes';

    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await generateClassFeeReportPDF(
          className,
          selectedMonth,
          feesReport,
          madrasah,
          downloadLang,
          (p) => setDownloadProgress(p)
      );
    } catch (error) {
      console.error('Download error:', error);
      setActionError('Error downloading PDF');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDownloadReceipt = async (student: any, downloadLang: 'en' | 'bn' = lang) => {
    const className = classes.find(c => c.id === student.class_id)?.class_name || '';
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
        await generateFeeReceiptPDF(
            { ...student, class_name: className, section: student.student_type ? student.student_type : '' }, // Assuming student_type might represent section temporarily if none exists
            selectedMonth,
            madrasah,
            downloadLang,
            (p) => setDownloadProgress(p)
        );
    } catch (error) {
        console.error('Download error:', error);
        setActionError('Error downloading PDF');
    } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
    }
  };

  if (activeTab === 'fees') {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5 relative">
         {/* Download Indicator */}
         {isDownloading && (
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

         <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-[2rem] border shadow-bubble space-y-4`}>
            <div className="flex flex-wrap gap-3 items-center justify-between">
               {/* Class Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <button onClick={() => setShowClassDropdown(!showClassDropdown)} className={`w-full h-11 px-4 rounded-xl border flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                     <span className={`text-[11px] font-black truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{classes.find(c => c.id === selectedClass)?.class_name || 'শ্রেণি নির্বাচন করুন'}</span>
                     <ChevronDown size={16} className={`transition-colors ${isDark ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-[#2563EB]'}`} />
                  </button>
                  {showClassDropdown && (
                      <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl border z-50 p-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                          {classes.map(c => (
                              <button 
                                key={c.id} 
                                onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} 
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black transition-colors flex items-center justify-between ${
                                  selectedClass === c.id
                                    ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')
                                    : (isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-[#2563EB]')
                                }`}
                              >
                                {c.class_name}
                                {selectedClass === c.id && <Check size={14} />}
                              </button>
                          ))}
                      </div>
                  )}
               </div>

               {/* Month Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <input 
                    type="month" 
                    className={`w-full h-11 px-4 border rounded-xl text-[11px] font-black outline-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    min={activeYear?.start_date ? activeYear.start_date.slice(0, 7) : undefined}
                    max={activeYear?.end_date ? activeYear.end_date.slice(0, 7) : undefined}
                  />
               </div>

               {/* Status Filter */}
               <div className="relative flex-1 min-w-[140px]">
                   <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className={`w-full h-11 px-4 border rounded-xl text-[11px] font-black outline-none appearance-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`}
                  >
                      <option value="all">সব স্ট্যাটাস</option>
                      <option value="paid">পরিশোধিত (Paid)</option>
                      <option value="partial">আংশিক (Partial)</option>
                      <option value="unpaid">বকেয়া (Unpaid)</option>
                  </select>
                  <ChevronDown className={`absolute right-3 top-3.5 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={16}/>
               </div>

               {/* Download Report Button */}
               <button 
                  onClick={() => {
                      setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadClassReport(l));
                      setShowDownloadLangModal(true);
                  }}
                  disabled={feesReport.length === 0}
                  className={`h-11 px-6 rounded-xl text-[11px] font-black uppercase flex items-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none ${isDark ? 'bg-emerald-500/20 text-emerald-400 shadow-emerald-900/20' : 'bg-emerald-500 text-white shadow-emerald-200'}`}
               >
                  <Download size={16} />
                  রিপোর্ট ডাউনলোড
               </button>
            </div>
         </div>

         {fetchError && (
            <div className={`p-4 border rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">স্কিমা এরর!</p>
                  <p className="opacity-70">{fetchError}</p>
                  <p className="mt-1 font-normal opacity-60">সমাধান: SQL এডিটর থেকে নতুন প্রোভাইড করা কোডটি রান করুন।</p>
               </div>
               <button onClick={() => fetchData()} className={`px-3 py-1.5 rounded-lg border active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-red-200 text-red-600'}`}><RefreshCw size={14}/></button>
            </div>
         )}

         {actionError && (
            <div className={`p-4 border rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm mb-4 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">ত্রুটি!</p>
                  <p className="opacity-70">{actionError}</p>
               </div>
               <button onClick={() => setActionError(null)} className={`p-1.5 rounded-lg border active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-red-200 text-red-600'}`}><X size={14}/></button>
            </div>
         )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading ? (
              <div className={`flex flex-col items-center justify-center py-16 col-span-full ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
              </div>
            ) : feesReport.length > 0 ? (
                (() => {
                  const filteredData = feesReport.filter((item: any) => {
                    if (statusFilter === 'all') return true;
                    return item.status === statusFilter;
                  });

                  return (
                    <>
                      {statusFilter !== 'all' && (
                        <div className="col-span-full mb-1">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            {statusFilter === 'paid' ? 'পরিশোধিত' : statusFilter === 'partial' ? 'আংশিক' : 'বকেয়া'}: {filteredData.length} জন
                          </span>
                        </div>
                      )}
                      {filteredData.map((item: any) => {
                        const balance = Number(item.balance_due) || 0;
                        const paid = Number(item.total_paid) || 0;

                        const isFullyPaid = item.status === 'paid';
                        const isNoFeeSet = item.status === 'no_fee';
                        const isPartial = item.status === 'partial';
                        const isUnpaid = item.status === 'unpaid';
                        const hasBalance = balance > 0;

                        return (
                        <div key={item.student_id} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                     <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center font-black shrink-0 ${isFullyPaid ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500') : hasBalance ? (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-500') : (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-[#2563EB]')}`}>
                           {item.roll || '-'}
                        </div>
                        <div className="min-w-0">
                           <h5 
                             className={`font-black font-noto line-clamp-2 whitespace-normal leading-tight mb-0.5 cursor-pointer hover:underline decoration-2 underline-offset-2 text-[13px] ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}
                             onClick={() => onStudentClick ? onStudentClick(item) : handleShowHistory(item)}
                           >
                             {item.student_name}
                           </h5>
                           <div className="flex items-center gap-2">
                              <p className="text-[9px] text-red-500 font-bold uppercase">বকেয়া: ৳{Math.max(0, balance)}</p>
                              {isNoFeeSet && <span className={`text-[7px] px-1.5 py-0.5 rounded-md font-black uppercase ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>No Fee Set</span>}
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-1.5">
                       {item.guardian_phone && (
                          <a
                            href={`tel:${item.guardian_phone}`}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-sm transition-all ${isDark ? 'bg-slate-900 text-orange-400 border-orange-500/20 hover:bg-orange-500/10' : 'bg-white text-orange-500 border-orange-200 hover:bg-orange-50'} active:scale-95`}
                            title="কল করুন"
                          >
                             <Phone size={14} />
                          </a>
                       )}
                       <button 
                          onClick={() => {
                              setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadReceipt(item, l));
                              setShowDownloadLangModal(true);
                          }}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-sm transition-all ${isDark ? 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-blue-400' : 'bg-white text-slate-400 border-slate-100 hover:bg-blue-50 hover:text-[#2563EB] hover:border-blue-100'} active:scale-95`}
                          title="Download Receipt"
                       >
                          <Download size={16} />
                       </button>
                       <button 
                          onClick={() => { setSelectedStudent(item); setCollectAmount(''); setShowFeeCollection(true); }} 
                          disabled={isFullyPaid || isNoFeeSet} 
                          className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm ${
                            isFullyPaid ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-600 border border-emerald-200') : 
                            isPartial ? (isDark ? 'bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30' : 'bg-blue-50 text-blue-600 border border-blue-100') :
                            isNoFeeSet ? (isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed') : 
                            isUnpaid ? 'bg-orange-500 text-white active:scale-95 shadow-orange-200' : 
                            'bg-[#2563EB] text-white active:scale-95 shadow-blue-200'
                          }`}
                       >
                          {isFullyPaid ? 'PAID' : isPartial ? 'PARTIAL' : isNoFeeSet ? 'ফি নেই' : 'ফি জমা'}
                       </button>
                     </div>
                  </div>
                  );
                })}
                </>
                );
              })()
            ) : !selectedClass ? (
              <div className={`text-center py-16 rounded-[3rem] border-2 border-dashed mx-2 px-6 flex flex-col items-center col-span-full ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-blue-50 text-blue-200'}`}>
                    <Info size={32} />
                 </div>
                 <h3 className={`text-lg font-black font-noto leading-tight ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>
                   শ্রেণি নির্বাচন করুন
                 </h3>
                 <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-wide leading-relaxed">
                   শিক্ষার্থীদের ফি দেখতে একটি নির্দিষ্ট শ্রেণি নির্বাচন করুন।
                 </p>
              </div>
            ) : !fetchError && (
              <div className={`text-center py-16 rounded-[3rem] border-2 border-dashed mx-2 px-6 flex flex-col items-center col-span-full ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-blue-50 text-blue-200'}`}>
                    {anyStudentsInMadrasah ? <Info size={32} /> : <Users size={32} />}
                 </div>
                 <h3 className={`text-lg font-black font-noto leading-tight ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>
                   {anyStudentsInMadrasah ? 'রিপোর্ট পাওয়া যায়নি' : 'কোনো শিক্ষার্থী পাওয়া যায়নি'}
                 </h3>
                 <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-wide leading-relaxed">
                   {anyStudentsInMadrasah 
                      ? 'আপনার ডাটাবেসে শিক্ষার্থী আছে, কিন্তু তারা সম্ভবত সঠিক শ্রেণিতে নিবন্ধিত নয় অথবা ডাটাবেস ফাংশনে সমস্যা হচ্ছে।'
                      : 'এই মাদরাসার অধীনে কোনো শিক্ষার্থী নিবন্ধিত নেই। অনুগ্রহ করে শিক্ষার্থী যোগ করুন।'}
                 </p>
              </div>
            )}
          </div>

         {/* COLLECT FEE MODAL */}
         {/* Modals */}
      {showDownloadLangModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1001] flex items-center justify-center p-4">
              <div className={`rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-white/20'}`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                      <Download size={32} strokeWidth={2.5} />
                  </div>
                  
                  <h3 className={`text-xl font-black mb-2 text-center font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>ভাষা নির্বাচন করুন</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-8 tracking-widest">Select PDF Language</p>
                  
                  <div className="space-y-3">
                      <button 
                          onClick={async () => {
                              if (downloadAction) {
                                  setShowDownloadLangModal(false);
                                  await downloadAction('bn');
                              }
                          }}
                          className={`w-full py-4 font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${isDark ? 'bg-emerald-600 text-white shadow-emerald-900/20 hover:bg-emerald-500' : 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600'}`}
                      >
                          <span className="text-sm">বাংলা (Bengali)</span>
                      </button>
                      
                      <button 
                          onClick={async () => {
                              if (downloadAction) {
                                  setShowDownloadLangModal(false);
                                  await downloadAction('en');
                              }
                          }}
                          className={`w-full py-4 font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${isDark ? 'bg-blue-600 text-white shadow-blue-900/20 hover:bg-blue-500' : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'}`}
                      >
                          <span className="text-sm">English</span>
                      </button>
                      
                      <button 
                          onClick={() => setShowDownloadLangModal(false)}
                          className={`w-full py-4 rounded-2xl active:scale-[0.98] transition-all mt-4 font-black ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                          বাতিল (Cancel)
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showFeeCollection && selectedStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
                <div className={`w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[80vh] shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>ফি সংগ্রহ করুন</h3>
                        <button onClick={() => setShowFeeCollection(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
                    </div>
                    <div className={`p-6 rounded-3xl border text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">শিক্ষার্থীর নাম</p>
                        <h4 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{selectedStudent.student_name}</h4>
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className={`p-2.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <p className="text-[7px] font-black text-slate-400 uppercase"> প্রদেয় </p>
                              <p className={`font-black text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>৳{selectedStudent.total_payable}</p>
                            </div>
                            <div className={`p-2.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <p className="text-[7px] font-black text-slate-400 uppercase"> পরিশোধিত </p>
                              <p className={`font-black text-sm ${isDark ? 'text-emerald-400' : 'text-green-600'}`}>৳{selectedStudent.total_paid}</p>
                            </div>
                            <div className={`p-2.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <p className="text-[7px] font-black text-slate-400 uppercase"> বকেয়া </p>
                              <p className={`font-black text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>৳{Math.max(0, Number(selectedStudent.balance_due))}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ফি-র ধরণ (Fee Type)</label>
                            <div className={`rounded-2xl p-4 border max-h-40 overflow-y-auto ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="space-y-2">
                                    {availableFeeItems.length > 0 ? (
                                        availableFeeItems.map(item => {
              const isPaid = (paidFeeCategories || []).includes(item.fee_name);
              const isSelected = (selectedFeeCategories || []).includes(item.fee_name);
                                            
                                            return (
                                                <div key={item.id} className={`flex flex-col gap-2 p-3 rounded-xl transition-colors ${isPaid ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-100')}`}>
                                                    <label className={`flex items-center gap-3 cursor-pointer`}>
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected || isPaid ? 'bg-[#2563EB] border-[#2563EB]' : (isDark ? 'border-slate-600' : 'border-slate-300')} ${isPaid ? 'opacity-50' : ''}`}>
                                                            {(isSelected || isPaid) && <CheckCircle2 size={14} className="text-white" />}
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden"
                                                            checked={isSelected || isPaid}
                                                            disabled={isPaid}
                                                            onChange={(e) => {
                                                                if (isPaid) return;
                                                                let newCategories = [];
                                                                if (e.target.checked) {
                                                                    newCategories = [...selectedFeeCategories, item.fee_name];
                                                                } else {
                                                                    newCategories = selectedFeeCategories.filter(c => c !== item.fee_name);
                                                                }
                                                                setSelectedFeeCategories(newCategories);
                                                                setCollectAmount(calculateTotal(newCategories, discount, availableFeeItems));
                                                            }}
                                                        />
                                                        <div className="flex-1 flex justify-between items-center">
                                                            <span className={`text-xs font-black ${isPaid ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-200' : 'text-[#1E3A8A]')}`}>
                                                                {item.fee_name} {isPaid && '(পরিশোধিত)'}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'text-slate-400 bg-slate-800' : 'text-slate-400 bg-slate-100'}`}>৳{item.amount}</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-4 text-slate-400 text-xs font-bold">কোনো ফি আইটেম পাওয়া যায়নি। দয়া করে ফি সেটিংস থেকে আইটেম যোগ করুন।</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">জমা টাকার পরিমাণ</label>
                            <div className="relative">
                              <input type="number" className={`w-full h-14 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'}`} placeholder="0.00" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
                              <DollarSign className={`absolute left-4 top-4 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} size={20}/>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ছাড় / ডিসকাউন্ট (যদি থাকে)</label>
                            <div className="relative">
                              <input type="number" className={`w-full h-14 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-orange-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-orange-500/20'}`} placeholder="0.00" value={discount} onChange={(e) => {
                                  setDiscount(e.target.value);
                                  setCollectAmount(calculateTotal(selectedFeeCategories, e.target.value, availableFeeItems));
                              }} />
                              <Tag className={`absolute left-4 top-4 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} size={20}/>
                            </div>
                        </div>
                        {collectError && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center">
                                {collectError}
                            </div>
                        )}
                        <button onClick={handleCollectFee} disabled={isSaving || collectAmount === ''} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                            {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20}/> পেমেন্ট নিশ্চিত করুন</>}
                        </button>
                    </div>
                </div>
            </div>
         )}

         {/* HISTORY MODAL */}
         {showHistoryModal && historyStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
                <div className={`w-full max-w-2xl rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[90vh] shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>ফি হিস্ট্রি</h3>
                        <button onClick={() => setShowHistoryModal(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
                    </div>
                    
                    <div className={`flex items-center justify-between p-4 rounded-3xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">শিক্ষার্থীর নাম</p>
                            <h4 className={`text-lg font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{historyStudent.student_name}</h4>
                        </div>
                        <div className="w-32">
                            <select 
                                value={historyYear}
                                onChange={(e) => setHistoryYear(e.target.value)}
                                className={`w-full h-10 px-3 border rounded-xl text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-[#1E3A8A]'}`}
                            >
                                {[0, 1, 2].map(offset => {
                                    const year = (new Date().getFullYear() - offset).toString();
                                    return <option key={year} value={year}>{year}</option>;
                                })}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 12 }, (_, i) => {
                            const monthStr = `${historyYear}-${String(i + 1).padStart(2, '0')}`;
                            const monthName = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][i];
                            
                            const recordsForMonth = studentFeeHistory.filter(f => f.month === monthStr);
                            let status = 'unpaid';
                            let totalProcessed = 0;
                            let totalCash = 0;
                            let totalDiscount = 0;
                            
                            const studentSettings = historyStudentSettings;
                            const now = new Date();
                            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                            
                            const studentFeeStructures = structures.filter(fs => {
                                const isClassMatch = fs.class_id === historyStudent.class_id || fs.class_id === null;
                                if (!isClassMatch) return false;
                                
                                const setting = studentSettings.find(ss => ss.fee_structure_id === fs.id);
                                const isEnabled = setting ? setting.is_enabled : true;
                                const isMonthExpired = fs.due_date && monthStr > fs.due_date.slice(0, 7);
                                const isMonthNotStarted = fs.start_date && monthStr < fs.start_date.slice(0, 7);

                                // If yearStart (academic_year_start) exists, ensure the month is not before it
                                const yearStart = madrasah.config_json?.academic_year_start;
                                const isBeforeYearStart = yearStart && monthStr < yearStart.slice(0, 7);

                                return isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart;
                            });
                            const totalPayable = studentFeeStructures.reduce((sum, fs) => {
                                const setting = studentSettings?.find(ss => ss.fee_structure_id === fs.id);
                                const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(fs.amount);
                                return sum + amountToCharge;
                            }, 0);

                            if (recordsForMonth.length > 0) {
                                totalCash = recordsForMonth.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
                                totalDiscount = recordsForMonth.reduce((sum, r) => sum + (Number(r.discount) || 0), 0);
                                totalProcessed = totalCash + totalDiscount;
                                
                                if (totalPayable > 0) {
                                    if (totalProcessed >= totalPayable) status = 'paid';
                                    else if (totalProcessed > 0) status = 'partial';
                                    else status = 'unpaid';
                                } else {
                                    status = totalProcessed > 0 ? 'paid' : 'no_fee';
                                }
                            } else if (totalPayable === 0) {
                                status = 'no_fee';
                            } else {
                                status = 'unpaid';
                            }

                            return (
                                <div key={monthStr} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-1 transition-all ${status === 'paid' ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-100') : status === 'partial' ? (isDark ? 'bg-orange-500/20 border-orange-500/30' : 'bg-orange-50 border-orange-100') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                                    <span className={`text-sm font-black ${status === 'paid' ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : status === 'partial' ? (isDark ? 'text-orange-400' : 'text-orange-700') : 'text-slate-500'}`}>
                                        {monthName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        status === 'paid' ? (isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-200 text-emerald-800') : 
                                        status === 'partial' ? (isDark ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-200 text-orange-800') : 
                                        status === 'no_fee' ? (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500') :
                                        (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600')
                                    }`}>
                                        {status === 'paid' ? 'পরিশোধিত' : status === 'partial' ? 'পরিশোধিত' : status === 'no_fee' ? 'ফি নেই' : 'বকেয়া'}
                                    </span>
                                    {totalProcessed > 0 && (
                                        <div className="flex flex-col items-center mt-1">
                                           <span className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>৳{totalCash}</span>
                                           {totalDiscount > 0 && <span className="text-[7px] font-bold text-orange-500 leading-none">(-৳{totalDiscount} ছাড়)</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
         )}
      </div>
    );
  }

  if (activeTab === 'structures') {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5">
         {actionError && (
            <div className={`p-4 border rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm mb-4 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">ত্রুটি!</p>
                  <p className="opacity-70">{actionError}</p>
               </div>
               <button onClick={() => setActionError(null)} className={`p-1.5 rounded-lg border active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-red-200 text-red-600'}`}><X size={14}/></button>
            </div>
         )}

         <div className={`p-6 rounded-[2.5rem] border shadow-bubble ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className={`text-lg font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ফি সেটিংস' : 'Fee Settings'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'bn' ? 'মাদরাসার ফি কাঠামো নির্ধারণ করুন' : 'Set up institution fee structures'}</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingStructureId(null);
                        setCategory('');
                        setAmount('');
                        setStructureSelectedClass('');
                        setDueDate(activeYearEndDate);
                        setStartDate(madrasah.config_json?.academic_year_start || '');
                        setShowAddStructure(true);
                    }} 
                    className="w-12 h-12 bg-[#2563EB] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 active:scale-95 transition-all"
                >
                    <Plus size={24} strokeWidth={3} />
                </button>
            </div>

            <div className="space-y-3">
                {structures.length > 0 ? (
                    Object.entries(structures.reduce((acc: any, s: any) => {
                        const className = s.classes?.class_name || (lang === 'bn' ? 'সব শ্রেণি' : 'All Classes');
                        if (!acc[className]) acc[className] = [];
                        acc[className].push(s);
                        return acc;
                    }, {})).map(([className, items]: [string, any]) => (
                        <div key={className} className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                                <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}></div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{className}</span>
                                <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}></div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {items.map((s: any) => (
                                    <div key={s.id} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${isDark ? 'bg-slate-900/50 border-slate-700 hover:bg-slate-900' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-sm'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-white text-[#2563EB]'}`}>
                                                <Tag size={18} />
                                            </div>
                                            <div>
                                                <h5 className={`font-black font-noto text-sm ${isDark ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{s.fee_name}</h5>
                                                <p className="text-[10px] font-bold text-slate-400">{lang === 'bn' ? 'নির্ধারিত ফি' : 'Assigned Fee'} {s.due_date && `• ${lang === 'bn' ? 'শেষ তারিখ' : 'Due Date'}: ${new Date(s.due_date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}`}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className={`text-lg font-black ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>৳{s.amount?.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</div>
                                            {deleteConfirmId === s.id ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[9px] font-bold text-red-500">{lang === 'bn' ? 'সব ডাটা ডিলিট হয়ে যাবে!' : 'All structure data will be deleted!'}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={async () => {
                                                            const { error } = await supabase.from('fee_structures').delete().eq('id', s.id);
                                                            if (error) {
                                                                console.error("Delete Error:", error);
                                                                setActionError((lang === 'bn' ? "ডিলিট করতে সমস্যা হয়েছে: " : "Failed to delete: ") + error.message);
                                                            } else {
                                                                requestManager.invalidatePattern(`structures:${madrasah.id}`);
                                                                requestManager.invalidatePattern(`structures_full:${madrasah.id}`);
                                                                clearGlobalSchoolFeeCache();
                                                                if (triggerRefresh) triggerRefresh();
                                                                fetchData();
                                                            }
                                                            setDeleteConfirmId(null);
                                                        }} className="bg-red-500 text-white text-[9px] px-2.5 py-1.5 rounded-lg font-black">{lang === 'bn' ? 'হ্যাঁ' : 'Yes'}</button>
                                                        <button onClick={() => setDeleteConfirmId(null)} className={`text-[9px] px-2.5 py-1.5 rounded-lg font-black ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>{lang === 'bn' ? 'না' : 'No'}</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => {
                                                        setEditingStructureId(s.id);
                                                        setCategory(s.fee_name);
                                                        setAmount(s.amount?.toString() || '');
                                                        setStructureSelectedClass(s.class_id || '');
                                                        setDueDate(s.due_date || '');
                                                        setStartDate(s.start_date || '');
                                                        setShowAddStructure(true);
                                                    }} className={`w-8 h-8 flex items-center justify-center transition-colors ${isDark ? 'text-blue-400 hover:bg-slate-700' : 'text-[#2563EB] hover:bg-blue-50 rounded-lg'}`}>
                                                        <Edit3 size={16}/>
                                                    </button>
                                                    <button onClick={() => setDeleteConfirmId(s.id)} className={`w-8 h-8 flex items-center justify-center transition-colors ${isDark ? 'text-red-400 hover:bg-slate-700' : 'text-red-500 hover:bg-red-50 rounded-lg'}`}>
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={`text-center py-12 rounded-3xl border-2 border-dashed ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-white text-slate-200'}`}>
                            <Tag size={24} />
                        </div>
                        <p className="text-slate-400 uppercase text-[10px] font-black">{lang === 'bn' ? 'কোনো ফি আইটেম নেই' : 'No fee structures found'}</p>
                    </div>
                )}
            </div>
         </div>

         {/* ADD STRUCTURE MODAL */}
         {showAddStructure && (
           <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
              <div className={`w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                 <div className="flex items-center justify-between">
                   <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{editingStructureId ? (lang === 'bn' ? 'ফি এডিট করুন' : 'Edit Fee Structure') : (lang === 'bn' ? 'ফি সেটআপ করুন' : 'Setup Fee Structure')}</h3>
                   <button onClick={() => setShowAddStructure(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
                 </div>
                 <div className="space-y-4">
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{lang === 'bn' ? 'শ্রেণি নির্বাচন করুন (ঐচ্ছিক)' : 'Select Class (Optional)'}</label>
                       <button onClick={() => setShowStructureClassDropdown(!showStructureClassDropdown)} className={`w-full h-14 px-6 rounded-2xl border-2 flex items-center justify-between font-black transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                          <span className="truncate">{classes.find(c => c.id === structureSelectedClass)?.class_name || 'সব শ্রেণি (All Classes)'}</span>
                          <ChevronDown size={20} className="text-slate-300" />
                       </button>
                       {showStructureClassDropdown && (
                           <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border z-[1001] p-2 max-h-48 overflow-y-auto ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                               <button onClick={() => { setStructureSelectedClass(''); setShowStructureClassDropdown(false); }} className={`w-full text-left px-5 py-3 rounded-xl font-black transition-colors ${isDark ? 'text-slate-100 hover:bg-slate-700' : 'text-[#1E3A8A] hover:bg-slate-50'}`}>সব শ্রেণি (All Classes)</button>
                               {classes.map(c => (
                                   <button key={c.id} onClick={() => { setStructureSelectedClass(c.id); setShowStructureClassDropdown(false); }} className={`w-full text-left px-5 py-3 rounded-xl font-black transition-colors ${isDark ? 'text-slate-100 hover:bg-slate-700' : 'text-[#1E3A8A] hover:bg-slate-50'}`}>{c.class_name}</button>
                               ))}
                           </div>
                       )}
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{lang === 'bn' ? 'ফি-র নাম' : 'Fee Name'}</label>
                       <input type="text" className={`w-full h-14 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-slate-700 focus:border-[#2563EB]/20'}`} placeholder={lang === 'bn' ? "যেমন: মাসিক বেতন" : "e.g. Monthly Fee"} value={category} onChange={(e) => setCategory(e.target.value)} />
                       <Tag className={`absolute left-4 top-[44px] ${isDark ? 'text-slate-500' : 'text-slate-300'}`} size={20}/>
                       <div className="flex flex-wrap gap-2 mt-2 px-1">
                          {(lang === 'bn' ? ['পরীক্ষার ফি', 'কোচিং ফি', 'অন্যান্য ফি'] : ['Exam Fee', 'Coaching Fee', 'Other Fee']).map(suggestion => (
                             <button 
                                key={suggestion}
                                type="button"
                                onClick={() => setCategory(suggestion)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${category === suggestion ? (isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-[#2563EB] border-[#2563EB]/20') : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200')}`}
                             >
                                {suggestion}
                             </button>
                          ))}
                       </div>
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'}</label>
                       <input type="number" className={`w-full h-14 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'}`} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                       <DollarSign className={`absolute left-4 top-[44px] ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} size={20}/>
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{lang === 'bn' ? 'শুরুর তারিখ' : 'Start Date'}</label>
                       <div className="relative">
                           <input type="date" className={`w-full h-14 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                           <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={20}/>
                       </div>
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{lang === 'bn' ? 'শেষ তারিখ (Optional)' : 'End Date (Optional)'}</label>
                       <div className="relative">
                           <input type="date" className={`w-full h-14 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                           <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={20}/>
                       </div>
                    </div>
                    
                    <button onClick={async () => {
                       if (!category || !amount) return;
                       setIsSaving(true);
                       try {
                           const payload = {
                               institution_id: madrasah.id,
                               class_id: structureSelectedClass || null,
                               fee_name: category,
                               amount: parseFloat(amount),
                               due_date: dueDate || null,
                               start_date: startDate || null
                           };
                           
                           let error;
                           if (editingStructureId) {
                               const { error: updateError } = await supabase.from('fee_structures').update(payload).eq('id', editingStructureId);
                               error = updateError;
                           } else {
                               const { error: insertError } = await supabase.from('fee_structures').insert(payload);
                               error = insertError;
                           }
                           
                           if (error) {
                               if (error.message.includes('start_date does not exist')) {
                                   throw new Error("Database schema error: Please run the SQL migration script 'src/services/migration_add_start_date_fee_structures.sql' in Supabase SQL Editor to add the 'start_date' column.");
                               }
                               throw error;
                           }
                           setShowAddStructure(false);
                           setCategory(''); setAmount(''); setStructureSelectedClass(''); setDueDate(''); setStartDate(''); setEditingStructureId(null);
                           requestManager.invalidatePattern(`structures:${madrasah.id}`);
                           requestManager.invalidatePattern(`structures_full:${madrasah.id}`);
                           clearGlobalSchoolFeeCache();
                           if (triggerRefresh) triggerRefresh();
                           fetchData();
                       } catch (e: any) { setActionError(e.message); } finally { setIsSaving(false); }
                    }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                       {isSaving ? <Loader2 className="animate-spin" /> : (lang === 'bn' ? 'সেভ করুন' : 'Save')}
                    </button>
                 </div>
              </div>
           </div>
         )}
      </div>
    );
  }

  return null;
};
