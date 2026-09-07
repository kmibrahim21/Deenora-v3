
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, LedgerEntry, Language, UserRole, Class, Profile, AcademicYear } from 'types';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Loader2, Save, X, DollarSign, Tag, FileText, RefreshCw, Bell, Heart, Users, BarChart3, AlertCircle, Trash2, Filter, ChevronDown, Check, Database, CheckCircle2, Clock, Calendar } from 'lucide-react';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import { SchoolFeeEngine, clearGlobalSchoolFeeCache } from 'components/finance/SchoolFeeEngine';
import { QawmiFeeEngine, clearGlobalQawmiFeeCache } from 'components/finance/QawmiFeeEngine';
import StudentAccountingDetail from 'components/finance/StudentAccountingDetail';
import { motion, AnimatePresence } from 'motion/react';
import { sortMadrasahClasses } from 'pages/Classes';
import { getTodayDateString } from '../utils/calendarUtils';
import { useOfflineStatus } from 'hooks/useOffline';
import { CacheService } from 'services/cacheService';
import { requestManager, CACHE_TTLS } from 'services/RequestManager';

interface AccountingProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
  activeYear?: AcademicYear | null;
  triggerRefresh?: () => void;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role, profile, activeYear, triggerRefresh }) => {
  const isTeacher = role === 'teacher';
  const canViewReports = !isTeacher || !!profile?.permissions?.can_view_reports;

  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'automation' | 'fees' | 'sms' | 'summary' | 'structures' | 'add-ledger'>(() => {
    const saved = localStorage.getItem('accounting_activeTab');
    if (saved === 'summary' && !canViewReports) return 'fees';
    return (saved as any) || 'fees';
  });
  const [isAdding, setIsAdding] = useState(false);
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFeeTab, setActiveFeeTab] = useState<'settings' | 'reminders' | 'stats'>('settings');

  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, ids: string[]}>({show: false, ids: []});
  const [syncModal, setSyncModal] = useState<{
    show: boolean;
    step: 'confirm' | 'loading' | 'success' | 'error';
    message?: string;
    deletedCount?: number;
  }>({ show: false, step: 'confirm' });
  const [historyTab, setHistoryTab] = useState<'student_history' | 'income_expense'>(() => (localStorage.getItem('accounting_historyTab') as any) || 'student_history');
  const [selectedHistoryClass, setSelectedHistoryClass] = useState<string>(() => localStorage.getItem('accounting_selectedHistoryClass') || 'all');
  const [showClassFilterMenu, setShowClassFilterMenu] = useState(false);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<string>(() => localStorage.getItem('accounting_selectedHistoryMonth') || 'all');
  const [showMonthFilterMenu, setShowMonthFilterMenu] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState<'month' | 'daily'>('month');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(getTodayDateString());
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense'>('all');
  const isDark = madrasah?.theme === 'dark';
  const isOnline = useOfflineStatus();
  const feeEngine = madrasah?.config_json?.fee_engine || 'school';
  const canDeleteAccounting = (madrasah?.config_json as any)?.features?.delete_accounting === true;

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [desc, setDesc] = useState('');

  const uniqueMonths = React.useMemo(() => {
    const monthsSet = new Set<string>();
    ledger.forEach(entry => {
      if (entry.transaction_date) {
        const month = entry.transaction_date.substring(0, 7); // "YYYY-MM"
        monthsSet.add(month);
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [ledger]);

  const formatMonth = (monthStr: string, language: 'en' | 'bn' = 'bn') => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const bnMonths = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const enMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) return monthStr;
    
    if (language === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      const bnYear = year.split('').map(d => bnDigits[parseInt(d, 10)] || d).join('');
      return `${bnMonths[monthIdx]} ${bnYear}`;
    } else {
      return `${enMonths[monthIdx]} ${year}`;
    }
  };

  useEffect(() => {
    if (!canViewReports && activeTab === 'summary') {
      setActiveTab('fees');
    }
  }, [canViewReports, activeTab]);

  useEffect(() => {
    localStorage.setItem('accounting_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('accounting_historyTab', historyTab);
  }, [historyTab]);

  useEffect(() => {
    localStorage.setItem('accounting_selectedHistoryClass', selectedHistoryClass);
  }, [selectedHistoryClass]);

  useEffect(() => {
    localStorage.setItem('accounting_selectedHistoryMonth', selectedHistoryMonth);
  }, [selectedHistoryMonth]);

  useEffect(() => {
    if (madrasah?.id) {
      fetchData();
      fetchClasses();
      
      const unsubscribeLedger = requestManager.subscribe(`fetch:ledger:`, (result) => {
        if (result.data) setLedger(result.data);
      });
      
      const unsubscribeClasses = requestManager.subscribe(`fetch:classes:`, (result) => {
        if (result.data) {
          const sorted = sortMadrasahClasses(result.data);
          setClasses(sorted);
        }
      });

      return () => {
        unsubscribeLedger();
        unsubscribeClasses();
      };
    }
  }, [madrasah, activeTab]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    try {
      const { data } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('id, class_name, sort_order').eq('institution_id', madrasah.id),
        `classes:${madrasah.id}`,
        CACHE_TTLS.LONG
      );
      
      if (data) {
        let filteredClasses = data;
        if (role === 'teacher' && profile?.permissions?.allowed_classes) {
          filteredClasses = data.filter(cls => (profile.permissions.allowed_classes || []).includes(cls.id));
        }
        const sorted = sortMadrasahClasses(filteredClasses);
        setClasses(sorted);
      }
    } catch (err) {
      console.error('Fetch Classes Error:', err);
    }
  };

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

  const fetchData = async (force = false) => {
    if (!madrasah?.id) return;
    
    if (force || activeTab === 'summary' || activeTab === 'ledger') {
      if (ledger.length === 0) setLoading(true);
      try {
        if (!isOnline) {
          const cachedLedger = await CacheService.getCachedData('fees', madrasah.id);
          setLedger(cachedLedger || []);
          if (ledger.length === 0) setLoading(false);
          return;
        }

        const cacheKey = `ledger:${madrasah.id}:${activeYearId || 'current'}`;

        const { data } = await requestManager.cachedFetch(
          'ledger',
          (q) => {
            let query = q.select('id, institution_id, academic_year_id, type, amount, category, description, transaction_date, created_at').eq('institution_id', madrasah.id);
            if (activeYearId) {
              query = query.eq('academic_year_id', activeYearId);
            } else {
              let config = madrasah.config_json as any;
              if (typeof config === 'string') {
                try { config = JSON.parse(config); } catch (e) { config = {}; }
              }
              const yearStart = config?.academic_year_start;
              if (yearStart) query = query.gte('transaction_date', yearStart);
            }
            return query.order('transaction_date', { ascending: false }).order('id', { ascending: false }).limit(5000);
          },
          cacheKey,
          CACHE_TTLS.MEDIUM
        );

        if (data) {
          setLedger(data);
          await CacheService.cacheData('fees', madrasah.id, data);
        }
      } catch (e: any) { 
        console.error("Accounting Fetch Error:", e);
      } finally { setLoading(false); }
    }
  };

  const handleDeleteLedger = async () => {
    if (!madrasah?.id || deleteConfirm.ids.length === 0) return;
    if (!isOnline) {
      alert("Internet required to delete ledger entry.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Optimistic Update
      const oldLedger = [...ledger];
      setLedger(prev => prev.filter(item => !deleteConfirm.ids.includes(item.id)));
      
      // First find if there are any associated fees by grabbing the descriptions
      const { data: recordsToDelete } = await supabase.from('ledger').select('description, category').in('id', deleteConfirm.ids);

      const { error } = await supabase.from('ledger').delete().in('id', deleteConfirm.ids);
      if (error) throw error;
      
      // Attempt to clean up fees table based on descriptions
      if (recordsToDelete) {
         const feeIdsToDelete = [];
         const fallbackDeletions = [];

         for (const record of recordsToDelete) {
            // Priority 1: Direct FEE_ID match (Global search for multi-month transactions)
            if (record.description?.includes('FEE_ID: ')) {
               const regex = /FEE_ID:\s*([a-f0-9\-]+)/g;
               let match;
               while ((match = regex.exec(record.description)) !== null) {
                  feeIdsToDelete.push(match[1]);
               }
            }
            
            // Priority 2: Fallback for older or multi-item records without IDs
            if (record.category === 'Student Fee' || record.category?.includes('Fee') || record.category?.includes('ফি')) {
               // Extract all YYYY-MM patterns (handles both Month: and Months: formats)
               const monthMatches = record.description?.match(/[\d]{4}-[\d]{2}/g) || [];
               
               let name = null;
               if (record.description?.includes(' - ')) {
                  const parts = record.description.split(' - ');
                  const namePart = parts.slice(1).join(' - ').split(' (')[0];
                  if (namePart) name = namePart.trim();
               }

               if (name) {
                  monthMatches.forEach(month => {
                     fallbackDeletions.push({ name, month });
                  });
               }
            }
         }

         // Batch delete known fee IDs
         if (feeIdsToDelete.length > 0) {
            const { error: fErr } = await supabase.from('fees').delete().in('id', feeIdsToDelete);
            if (fErr) console.warn("Fee deletion error by ID:", fErr);
         }

         // Perform fallback deletions by name and month
         for (const del of fallbackDeletions) {
            const { data: students } = await supabase.from('students').select('id').eq('institution_id', madrasah.id).eq('student_name', del.name);
            if (students && students.length > 0) {
               const studentIds = students.map(s => s.id);
               const { error: fbErr } = await supabase.from('fees').delete().in('student_id', studentIds).eq('month', del.month);
               if (fbErr) console.warn("Fallback fee deletion error:", fbErr);
            }
         }
      }

      setSelectedLedgerIds([]);
      setDeleteConfirm({show: false, ids: []});
      
      // Clear all relevant caches
      if (madrasah?.id) {
        requestManager.invalidatePattern('fetch:ledger:');
        requestManager.invalidatePattern(`stats:${madrasah.id}`);
        requestManager.invalidatePattern(`fees:${madrasah.id}`);
        requestManager.invalidatePattern(`dashboard_`);
        await CacheService.clearCache('stats', madrasah.id);
        await CacheService.clearCache('fees', madrasah.id);
        clearGlobalSchoolFeeCache();
        clearGlobalQawmiFeeCache();
      }
      
      if (triggerRefresh) triggerRefresh();
      // Background fetchData is still good to sync fully
      fetchData();
    } catch (err: any) {
      alert(err.message);
      fetchData(); // Revert on failure
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncAndRepairFees = async () => {
    if (!madrasah?.id) return;
    if (!isOnline) {
      alert(lang === 'bn' ? "ডাটা সংশোধন করতে ইন্টারনেট সংযোগ প্রয়োজন।" : "Internet connection required to sync and repair data.");
      return;
    }
    
    setSyncModal({ show: true, step: 'loading' });
    setIsSyncing(true);

    try {
      // 1. Fetch all ledger entries for the institution
      const { data: allLedger, error: lErr } = await supabase
        .from('ledger')
        .select('id, description, category')
        .eq('institution_id', madrasah.id);
      
      if (lErr) throw lErr;

      // 2. Fetch all student fee records for the institution
      const { data: allFees, error: fErr } = await supabase
        .from('fees')
        .select('id, student_id, month, amount_paid')
        .eq('institution_id', madrasah.id);

      if (fErr) throw fErr;

      if (!allFees || allFees.length === 0) {
        setSyncModal({ 
          show: true, 
          step: 'success', 
          deletedCount: 0,
          message: lang === 'bn' ? "কোনো ফি ডাটা পাওয়া যায়নি। ডাটা ইতোমধ্যে পরিষ্কার আছে।" : "No fee records found. Data is already clean." 
        });
        setIsSyncing(false);
        return;
      }

      // 3. Find orphaned fee records
      const ledgerList = allLedger || [];
      const orphanedFeeIds: string[] = [];

      for (const fee of allFees) {
        // Check if there's any ledger entry referencing this fee ID
        const hasDirectLedger = ledgerList.some(l => 
          (l.description || '').includes(`FEE_ID: ${fee.id}`)
        );

        if (!hasDirectLedger) {
          // If no direct FEE_ID match, let's check if there are no student fee entries in ledger at all.
          // Since they deleted ALL history, there should be no ledger entries left.
          orphanedFeeIds.push(fee.id);
        }
      }

      // 4. Batch delete the orphaned fee records
      if (orphanedFeeIds.length > 0) {
        // Chunk deletions to avoid hitting database limits or timeouts
        const chunkSize = 50;
        for (let i = 0; i < orphanedFeeIds.length; i += chunkSize) {
          const chunk = orphanedFeeIds.slice(i, i + chunkSize);
          const { error: delErr } = await supabase
            .from('fees')
            .delete()
            .in('id', chunk);
          
          if (delErr) {
            console.error("Error deleting fee chunk:", delErr);
          }
        }

        // 5. Clear all caches
        requestManager.invalidatePattern(`fees:${madrasah.id}`);
        requestManager.invalidatePattern(`stats:${madrasah.id}`);
        requestManager.invalidatePattern(`dashboard_`);
        await CacheService.clearCache('stats', madrasah.id);
        await CacheService.clearCache('fees', madrasah.id);
        clearGlobalSchoolFeeCache();
        clearGlobalQawmiFeeCache();
      }

      setSyncModal({
        show: true,
        step: 'success',
        deletedCount: orphanedFeeIds.length
      });

      if (triggerRefresh) triggerRefresh();
      fetchData(true);
    } catch (err: any) {
      console.error("Error repairing fees:", err);
      setSyncModal({
        show: true,
        step: 'error',
        message: err.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFixFeeNames = async () => {
    if (!madrasah?.id) return;
    if (!isOnline) {
      alert(lang === 'bn' ? "ডাটা সংশোধন করতে ইন্টারনেট সংযোগ প্রয়োজন।" : "Internet connection required to sync and repair data.");
      return;
    }
    if (!confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে এলোমেলো ফি-এর নামগুলো ঠিক করতে চান?' : 'Are you sure you want to fix overlapping fee names?')) return;
    
    setIsSyncing(true);
    
    try {
      // 1. Fetch all ledgers that are student fees
      const { data: allLedgers, error: lErr } = await supabase
        .from('ledger')
        .select('id, description')
        .eq('institution_id', madrasah.id)
        .eq('category', 'Student Fee')
        .eq('type', 'income');
        
      if (lErr) throw lErr;
      
      // 2. Fetch all fees
      const { data: allFees, error: fErr } = await supabase
        .from('fees')
        .select('id, student_id')
        .eq('institution_id', madrasah.id);
        
      if (fErr) throw fErr;
      
      // 3. Fetch all students
      const { data: allStudents, error: sErr } = await supabase
        .from('students')
        .select('id, student_id, student_name, class_id, roll')
        .eq('institution_id', madrasah.id);
        
      if (sErr) throw sErr;
      
      const studentsMap = new Map();
      allStudents?.forEach(s => studentsMap.set(s.student_id || s.id, s));
      
      const feesMap = new Map();
      allFees?.forEach(f => feesMap.set(f.id, f));
      
      let updatedCount = 0;
      
      // 4. Loop through ledger and fix names
      for (const l of (allLedgers || [])) {
        if (!l.description) continue;
        
        // Extract FEE_ID
        const feeIdMatches = [...l.description.matchAll(/FEE_ID:\s*([a-f0-9\-]+)/g)];
        if (feeIdMatches.length === 0) continue;
        
        const firstFeeId = feeIdMatches[0][1];
        const feeRecord = feesMap.get(firstFeeId);
        
        if (!feeRecord) continue;
        
        const student = studentsMap.get(feeRecord.student_id);
        if (!student) continue;
        
        const className = classes.find(c => c.id === student.class_id)?.class_name || '';
        const roll = student.roll || '-';
        
        if (l.description.includes(`| Roll:`)) continue; // Already fixed!
        
        let newDesc = l.description.replace(
          new RegExp(`- ${student.student_name} \\(Month`), 
          `- ${student.student_name} (${className} | Roll: ${roll} | Month`
        );
        
        if (newDesc === l.description) {
           newDesc = l.description.replace(
             `${student.student_name} (Month`, 
             `${student.student_name} (${className} | Roll: ${roll} | Month`
           );
        }
        
        if (newDesc !== l.description) {
          const { error: updErr } = await supabase.from('ledger').update({ description: newDesc }).eq('id', l.id);
          if (updErr) console.error(updErr);
          else updatedCount++;
        }
      }
      
      alert(lang === 'bn' ? `সফলভাবে ${updatedCount} টি ফি রেকর্ড সংশোধন করা হয়েছে।` : `Successfully fixed ${updatedCount} fee records.`);
      
      // Clear caches
      requestManager.invalidatePattern(`fees:${madrasah.id}`);
      requestManager.invalidatePattern(`all_fees:${madrasah.id}`);
      requestManager.invalidatePattern(`all_fees_qawmi:${madrasah.id}`);
      requestManager.invalidatePattern(`accounting-history`);
      requestManager.invalidatePattern(`fetch:ledger:`);
      clearGlobalSchoolFeeCache();
      clearGlobalQawmiFeeCache();
      if (triggerRefresh) triggerRefresh();
      fetchData(true);
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    if (!isOnline) {
      alert("Internet required to add ledger entry.");
      return;
    }
    setIsSaving(true);
    
    try {
      const activeYearId = madrasah.config_json?.active_academic_year_id;
      const amountNum = parseFloat(amount);
      const tempId = crypto.randomUUID();
      
      const newEntry: LedgerEntry = {
        id: tempId,
        institution_id: madrasah.id,
        academic_year_id: activeYearId,
        type: type,
        amount: amountNum,
        category: category.trim(),
        description: desc.trim(),
        transaction_date: transactionDate || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };

      // Optimistic Update
      setLedger(prev => [newEntry, ...prev]);

      const { data, error } = await supabase.from('ledger').insert({
        institution_id: madrasah.id,
        academic_year_id: activeYearId,
        type: type,
        amount: amountNum,
        category: category.trim(),
        description: desc.trim(),
        transaction_date: transactionDate || new Date().toISOString().split('T')[0]
      }).select('id, institution_id, academic_year_id, type, amount, category, description, transaction_date, created_at').single();

      if (error) throw error;
      if (data) {
        setLedger(prev => prev.map(e => e.id === tempId ? data : e));
      }

      setAmount(''); setCategory(''); setDesc('');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setActiveTab('ledger');

      // Clear relevant caches
      if (madrasah?.id) {
        requestManager.invalidatePattern('fetch:ledger:');
        requestManager.invalidatePattern(`stats:${madrasah.id}`);
        requestManager.invalidatePattern(`dashboard_`);
        await CacheService.clearCache('stats', madrasah.id);
      }
      
      if (triggerRefresh) triggerRefresh();
    } catch (err: any) { 
      if (err.message?.includes('row-level security policy')) {
         alert("Database RLS Error: Please run the SQL migration script in Supabase SQL Editor to fix permissions for 'fees' and 'ledger' tables. You can find the script in 'src/services/migration_fees_and_ledger_rls.sql'.");
      } else {
         alert(err.message); 
      }
      fetchData(); // Revert on failure
    } finally { setIsSaving(false); }
  };

  const [refreshKey, setRefreshKey] = useState(0);

  const handleTriggerRefresh = () => {
    fetchData(true);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-24 ${isDark ? 'text-slate-200' : ''}`}>
      {/* Header Section */}
      <div className={`flex items-center justify-between px-4 py-2 backdrop-blur-md sticky top-0 z-50 -mx-4 border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/50 border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'}`}
          >
            <Calculator size={18}/>
          </button>
          <div>
            <h1 className={`text-lg font-black font-noto leading-none ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>{lang === 'bn' ? 'ফি ও হিসাব' : 'Fees & Accounts'}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{lang === 'bn' ? 'অ্যাকাউন্টিং এবং ফি' : 'Accounting & Fees'}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => fetchData()} 
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-200'} ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={16}/>
            </button>
            {canViewReports && (
              <button 
                onClick={() => setActiveTab('summary')} 
                className={`px-4 h-10 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-xs font-black uppercase tracking-widest border ${activeTab === 'summary' ? (isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-[#2563EB] border-blue-100') : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}
              >
                <BarChart3 size={18}/>
                <span className="hidden sm:inline">{lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}</span>
              </button>
            )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="px-1">
        <div className={`flex p-1.5 rounded-[2rem] border overflow-x-auto no-scrollbar gap-1 ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-100/80 border-slate-200/50'}`}>
          <button 
            onClick={() => { setActiveTab('fees'); setSelectedStudentForDetail(null); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'fees' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            {lang === 'bn' ? 'শিক্ষার্থী ফি' : 'Student Fees'}
          </button>
          <button 
            onClick={() => { setActiveTab('structures'); setSelectedStudentForDetail(null); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'structures' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            {lang === 'bn' ? 'ফি সেটিংস' : 'Fee Settings'}
          </button>
          <button 
            onClick={() => { setActiveTab('add-ledger'); setSelectedStudentForDetail(null); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'add-ledger' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            {lang === 'bn' ? 'লেনদেন' : 'Transactions'}
          </button>
          <button 
            onClick={() => { setActiveTab('ledger'); setSelectedStudentForDetail(null); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'ledger' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            {lang === 'bn' ? 'ইতিহাস' : 'History'}
          </button>
        </div>
      </div>

      <div className={selectedStudentForDetail ? 'block' : 'hidden'}>
        {selectedStudentForDetail && (
          <StudentAccountingDetail 
            student={selectedStudentForDetail}
            madrasah={madrasah!}
            lang={lang}
            classes={classes}
            onBack={() => {
              setSelectedStudentForDetail(null);
              handleTriggerRefresh();
            }}
          />
        )}
      </div>

      <div className={!selectedStudentForDetail ? 'block' : 'hidden'}>
          <div className={(activeTab === 'fees' || activeTab === 'structures') && madrasah ? 'block' : 'hidden'}>
            <>
              {feeEngine === 'school' && (
                <SchoolFeeEngine activeTab={activeTab === 'structures' ? 'structures' : 'fees'} madrasah={madrasah} lang={lang} classes={classes} onStudentClick={(student) => setSelectedStudentForDetail(student)} role={role} profile={profile} activeYear={activeYear} triggerRefresh={handleTriggerRefresh} refreshKey={refreshKey} />
              )}
              {feeEngine === 'qawmi' && (
                <QawmiFeeEngine activeTab={activeTab === 'structures' ? 'structures' : 'fees'} madrasah={madrasah} lang={lang} classes={classes} onStudentClick={(student) => setSelectedStudentForDetail(student)} role={role} profile={profile} activeYear={activeYear} triggerRefresh={handleTriggerRefresh} refreshKey={refreshKey} />
              )}
              {/* Default to School Engine for others for now */}
              {feeEngine !== 'school' && feeEngine !== 'qawmi' && (
                <SchoolFeeEngine activeTab={activeTab === 'structures' ? 'structures' : 'fees'} madrasah={madrasah} lang={lang} classes={classes} onStudentClick={(student) => setSelectedStudentForDetail(student)} role={role} profile={profile} activeYear={activeYear} triggerRefresh={handleTriggerRefresh} refreshKey={refreshKey} />
              )}
            </>
          </div>

          
          <div className={activeTab === 'summary' && canViewReports ? 'block' : 'hidden'}>
        <div className="space-y-6 animate-in slide-in-from-bottom-5">
          <div className={`rounded-[2.5rem] p-1 border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white/40 border-white/20'}`}>
            {madrasah && (
              <SmartFeeAnalytics 
                institutionId={madrasah.id} 
                lang={lang} 
                month={activeYear?.start_date ? activeYear.start_date.slice(0, 7) : new Date().toISOString().slice(0, 7)} 
                classes={classes}
                madrasah={madrasah}
                role={role}
                profile={profile}
                activeYear={activeYear}
              />
            )}
          </div>
        </div>
      </div>

      <div className={activeTab === 'ledger' ? 'block' : 'hidden'}>
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
          <div className="flex flex-col gap-4 px-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'লেনদেনের ইতিহাস' : 'Transaction History'}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{ledger.length} {lang === 'bn' ? 'লেনদেন' : 'Transactions'}</span>
                    <div className={`flex p-0.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <button 
                        onClick={() => setHistoryFilterType('month')}
                        className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all ${historyFilterType === 'month' ? (isDark ? 'bg-slate-800 text-blue-400' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}
                      >
                        {lang === 'bn' ? 'মাসিক' : 'Month'}
                      </button>
                      <button 
                        onClick={() => setHistoryFilterType('daily')}
                        className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all ${historyFilterType === 'daily' ? (isDark ? 'bg-slate-800 text-blue-400' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}
                      >
                        {lang === 'bn' ? 'দৈনিক' : 'Daily'}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {canDeleteAccounting && selectedLedgerIds.length > 0 && (
                    <button
                      onClick={() => setDeleteConfirm({show: true, ids: selectedLedgerIds})}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 text-white shadow-sm hover:bg-red-600 flex items-center gap-1 active:scale-95"
                    >
                      <span>{lang === 'bn' ? `${selectedLedgerIds.length} টি মুছুন` : `Delete ${selectedLedgerIds.length}`}</span>
                    </button>
                  )}
                  {canDeleteAccounting && ledger.length > 0 && (
                    <button
                      onClick={() => setDeleteConfirm({show: true, ids: ledger.map(l => l.id)})}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1 active:scale-95 ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      <span>{lang === 'bn' ? 'সব মুছুন' : 'Delete All'}</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Primary Tabs & Class Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full sm:w-auto">
                {/* Tabs */}
                <div className={`flex p-1 rounded-2xl border w-full sm:w-auto shrink-0 ${isDark ? 'bg-slate-800 border-slate-700 shadow-inner' : 'bg-slate-100 border-slate-200/50 shadow-inner'}`}>
                  <button 
                    onClick={() => setHistoryTab('student_history')}
                    className={`flex-1 sm:flex-none text-center px-3 sm:px-5 py-2 sm:py-1.5 rounded-xl text-[10px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${historyTab === 'student_history' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-md border border-slate-200/50') : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {lang === 'bn' ? 'শিক্ষার্থী ইতিহাস' : 'Student History'}
                  </button>
                  <button 
                    onClick={() => setHistoryTab('income_expense')}
                    className={`flex-1 sm:flex-none text-center px-3 sm:px-5 py-2 sm:py-1.5 rounded-xl text-[10px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${historyTab === 'income_expense' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-md border border-slate-200/50') : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {lang === 'bn' ? 'আয় ব্যয় ইতিহাস' : 'Income & Expenses'}
                  </button>
                </div>

                {/* Filter Dropdowns container */}
                <div className={`grid ${historyTab === 'student_history' ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:items-center gap-2 w-full sm:w-auto`}>
                  {historyTab === 'student_history' && (
                    <div className="relative w-full sm:w-auto">
                      <button
                        onClick={() => setShowClassFilterMenu(!showClassFilterMenu)}
                        className={`flex items-center justify-between sm:justify-start gap-2 h-9 w-full sm:w-auto px-4 rounded-xl text-[10px] font-black tracking-wider transition-all border outline-none shadow-sm ${
                          isDark 
                            ? 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:text-slate-200' 
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Filter size={12} className={selectedHistoryClass !== 'all' ? 'text-blue-500' : ''} />
                          <span className="truncate">
                            {selectedHistoryClass === 'all' ? (lang === 'bn' ? 'সব ক্লাস' : 'All Classes') : classes.find(c => c.id === selectedHistoryClass)?.class_name}
                          </span>
                        </div>
                        <ChevronDown size={12} className={`transition-transform duration-300 ${showClassFilterMenu ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showClassFilterMenu && (
                          <>
                            <div 
                              className="fixed inset-0 z-[60]" 
                              onClick={() => setShowClassFilterMenu(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className={`absolute right-0 top-full mt-2 w-48 sm:w-56 z-[70] rounded-2xl border shadow-2xl overflow-hidden ${
                                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-blue-900/10'
                              }`}
                            >
                              <div className="p-1.5 max-h-64 overflow-y-auto no-scrollbar">
                                <button
                                  onClick={() => { setSelectedHistoryClass('all'); setShowClassFilterMenu(false); }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all mb-1 ${
                                    selectedHistoryClass === 'all' 
                                      ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600 font-black')
                                      : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')
                                  }`}
                                >
                                  {lang === 'bn' ? 'সব ক্লাস' : 'All Classes'}
                                  {selectedHistoryClass === 'all' && <Check size={12} />}
                                </button>
                                
                                <div className={`h-px my-1 mx-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                                
                                {classes.map(cls => (
                                  <button
                                    key={cls.id}
                                    onClick={() => { setSelectedHistoryClass(cls.id); setShowClassFilterMenu(false); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                      selectedHistoryClass === cls.id 
                                        ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600 font-black')
                                        : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')
                                    }`}
                                  >
                                    {cls.class_name}
                                    {selectedHistoryClass === cls.id && <Check size={12} />}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Filter Inputs */}
                  <div className="relative w-full sm:w-auto">
                    {historyFilterType === 'month' ? (
                      <button
                        onClick={() => setShowMonthFilterMenu(!showMonthFilterMenu)}
                        className={`flex items-center justify-between sm:justify-start gap-2 h-9 w-full sm:w-auto px-4 rounded-xl text-[10px] font-black tracking-wider transition-all border outline-none shadow-sm ${
                          isDark 
                            ? 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:text-slate-200' 
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Calendar size={12} className={selectedHistoryMonth !== 'all' ? 'text-blue-500' : ''} />
                          <span className="truncate">
                            {selectedHistoryMonth === 'all' 
                              ? (lang === 'bn' ? 'সব মাস' : 'All Months') 
                              : formatMonth(selectedHistoryMonth, lang)}
                          </span>
                        </div>
                        <ChevronDown size={12} className={`transition-transform duration-300 ${showMonthFilterMenu ? 'rotate-180' : ''}`} />
                      </button>
                    ) : (
                      <input 
                        type="date"
                        value={selectedHistoryDate}
                        onChange={(e) => setSelectedHistoryDate(e.target.value)}
                        className={`h-9 w-full sm:w-auto px-4 rounded-xl text-[10px] font-black tracking-wider transition-all border outline-none shadow-sm ${
                          isDark 
                            ? 'bg-slate-900/50 border-slate-700/50 text-slate-300' 
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      />
                    )}

                    <AnimatePresence>
                      {showMonthFilterMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-[60]" 
                            onClick={() => setShowMonthFilterMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={`absolute right-0 top-full mt-2 w-48 sm:w-56 z-[70] rounded-2xl border shadow-2xl overflow-hidden ${
                              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-blue-900/10'
                            }`}
                          >
                            <div className="p-1.5 max-h-64 overflow-y-auto no-scrollbar">
                              <button
                                onClick={() => { setSelectedHistoryMonth('all'); setShowMonthFilterMenu(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all mb-1 ${
                                  selectedHistoryMonth === 'all' 
                                    ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600 font-black')
                                    : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')
                                }`}
                              >
                                {lang === 'bn' ? 'সব মাস' : 'All Months'}
                                {selectedHistoryMonth === 'all' && <Check size={12} />}
                              </button>
                              
                              <div className={`h-px my-1 mx-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                              
                              {uniqueMonths.length === 0 ? (
                                <div className="px-3 py-2.5 text-[10px] text-slate-400 font-bold text-center">
                                  {lang === 'bn' ? 'কোনো মাস নেই' : 'No months found'}
                                </div>
                              ) : (
                                uniqueMonths.map(m => (
                                  <button
                                    key={m}
                                    onClick={() => { setSelectedHistoryMonth(m); setShowMonthFilterMenu(false); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                      selectedHistoryMonth === m 
                                        ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600 font-black')
                                        : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')
                                    }`}
                                  >
                                    {formatMonth(m, lang)}
                                    {selectedHistoryMonth === m && <Check size={12} />}
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub Filters - Income/Expense Only */}
            {historyTab === 'income_expense' && (
              <div className="flex justify-start sm:justify-end pt-2 sm:border-t border-slate-200 dark:border-slate-800">
                <div className={`flex p-1 rounded-2xl border w-full sm:w-auto overflow-x-auto no-scrollbar snap-x ${isDark ? 'bg-slate-800 border-slate-700 shadow-inner' : 'bg-slate-100 border-slate-200/50 shadow-inner'}`}>
                  <button 
                    onClick={() => setLedgerFilter('all')}
                    className={`flex-1 sm:flex-none px-6 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap snap-start ${ledgerFilter === 'all' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-md border border-slate-200/50') : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {lang === 'bn' ? 'সব' : 'All'}
                  </button>
                  <button 
                    onClick={() => setLedgerFilter('income')}
                    className={`flex-1 sm:flex-none px-6 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap snap-start ${ledgerFilter === 'income' ? (isDark ? 'bg-slate-900 text-emerald-400 shadow-sm border border-slate-700/50' : 'bg-white text-emerald-500 shadow-md border border-slate-200/50') : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {lang === 'bn' ? 'আয়' : 'Income'}
                  </button>
                  <button 
                    onClick={() => setLedgerFilter('expense')}
                    className={`flex-1 sm:flex-none px-6 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap snap-start ${ledgerFilter === 'expense' ? (isDark ? 'bg-slate-900 text-red-400 shadow-sm border border-slate-700/50' : 'bg-white text-red-500 shadow-md border border-slate-200/50') : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {lang === 'bn' ? 'ব্যয়' : 'Expense'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#2563EB]" size={32} /></div>
          ) : ledger.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {ledger.filter(e => {
                const category = e.category || '';
                const description = e.description || '';
                const transactionDate = e.transaction_date || '';

                if (historyFilterType === 'month') {
                  if (selectedHistoryMonth !== 'all') {
                    const isMatchByDate = transactionDate.startsWith(selectedHistoryMonth);
                    
                    // For student fees, also match if the month is mentioned in the description
                    const isStudentFee = category === 'Student Fee' || description.includes('FEE_ID:');
                    const isMatchByDesc = isStudentFee && description.includes(selectedHistoryMonth);
                    
                    if (!isMatchByDate && !isMatchByDesc) {
                      return false;
                    }
                  }
                } else {
                  // Daily Filter
                  if (transactionDate !== selectedHistoryDate) {
                    return false;
                  }
                }
                const isStudent = 
                  (category === 'Student Fee' || 
                  category.includes('Fee') || 
                  category.includes('ফি') || 
                  category.includes('ভর্তি') || 
                  category.includes('Admission') ||
                  description.includes('FEE_ID:') ||
                  (description.includes('(') && description.includes('|') && description.includes(')')) ||
                  (description.includes('Roll:') || description.includes('রোল:')) ||
                  (description.includes('Month:') || description.includes('মাস:'))) &&
                  category !== 'donation' && category !== 'donations';
                if (historyTab === 'student_history') {
                   if (!isStudent) return false;
                   if (selectedHistoryClass !== 'all') {
                      const className = classes.find(c => c.id === selectedHistoryClass)?.class_name;
                      if (className && !e.description?.includes(`${className} |`)) { 
                        // Exact match for class name within the identifier section
                        return false; 
                      }
                   }
                   return true;
                }
                if (historyTab === 'income_expense') {
                   if (isStudent) return false;
                   if (ledgerFilter !== 'all' && e.type !== ledgerFilter) return false;
                   return true;
                }
                return true;
              }).map(entry => {
                let displayName = entry.category;
                let details = '';
                let feeType = '';
                const rawDescription = (entry.description || '').split(' || FEE_ID: ')[0];
                const cleanDescription = rawDescription.split(' {')[0];

                const isStudentDisplay = 
                  (entry.category === 'Student Fee' || 
                  entry.category?.includes('Fee') || 
                  entry.category?.includes('ফি') || 
                  entry.category?.includes('ভর্তি') || 
                  entry.category?.includes('Admission') ||
                  entry.description?.includes('FEE_ID:') ||
                  (entry.description?.includes('(') && entry.description?.includes('|') && entry.description?.includes(')'))) &&
                  entry.category !== 'donation' && entry.category !== 'donations';

                if (entry.category === 'donation' || entry.category === 'donations') {
                  const donationParts = cleanDescription.split(' {');
                  const mainDesc = donationParts[0];
                  // Extract donor name and receipt from "[DONATION:XXX] Donor Name - Fund"
                  const donorMatch = mainDesc.match(/\[DONATION:(.*?)\]\s*(.*)/);
                  if (donorMatch) {
                    feeType = lang === 'bn' ? `রশিদ: ${donorMatch[1]}` : `Receipt: ${donorMatch[1]}`;
                    displayName = donorMatch[2];
                  } else {
                    displayName = mainDesc;
                  }
                  details = lang === 'bn' ? 'অনুদান' : 'Donation';
                } else if (isStudentDisplay) {
                  // Try to find Fee Type and Details in description
                  // Expected format often: "Monthly Fee - Student Name (Details)" or similar
                  const parts = cleanDescription.split(' - ');
                  if (parts.length >= 2) {
                    feeType = parts[0];
                    const nameAndDetails = parts.slice(1).join(' - ');
                    
                    // Regex for "Name (Details)"
                    const match = nameAndDetails.match(/^(.*?)\s*(\(.*)$/);
                    if (match) {
                      displayName = match[1];
                      details = match[2].trim();
                    } else {
                      displayName = nameAndDetails;
                      details = ''; // Reset details if no parenthesis match
                    }
                  } else {
                    // Fallback if no " - " separator
                    feeType = entry.category;
                    displayName = cleanDescription;
                  }
                }
                
                // Robust date formatter for Safari/iOS
                const formatDate = (dateStr: string) => {
                  if (!dateStr) return '';
                  try {
                    // Replace dashes with slashes for better Safari compatibility if needed, 
                    // but usually T00:00:00 works if handled correctly.
                    // Let's normalize it.
                    const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
                    const date = new Date(normalized);
                    if (isNaN(date.getTime())) return dateStr; // Fallback to raw string
                    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
                  } catch (e) {
                    return dateStr;
                  }
                };

                return (
                  <div key={entry.id} className={`group p-4 sm:p-5 rounded-[2rem] sm:rounded-[2.5rem] border transition-all flex flex-col gap-4 shadow-sm hover:shadow-xl active:scale-[0.98] min-w-0 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-blue-100'}`}>
                    <div className="flex items-start gap-4 w-full min-w-0">
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="pt-1">
                          <input 
                             type="checkbox" 
                             checked={selectedLedgerIds.includes(entry.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLedgerIds([...selectedLedgerIds, entry.id]);
                              } else {
                                setSelectedLedgerIds(selectedLedgerIds.filter(id => id !== entry.id));
                              }
                            }}
                            className={`w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isDark ? 'bg-slate-800 border-slate-600' : ''}`}
                          />
                        </div>
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border transition-all group-hover:scale-105 ${entry.type === 'income' ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100')}`}>
                          {entry.type === 'income' ? <ArrowUpCircle size={24} className="sm:w-7 sm:h-7" /> : <ArrowDownCircle size={24} className="sm:w-7 sm:h-7" />}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex flex-col gap-1">
                          <h5 className={`font-black font-noto text-sm sm:text-base leading-snug break-words line-clamp-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                            {displayName}
                          </h5>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {(entry.category === 'Student Fee' || entry.category === 'donation' || entry.category === 'donations') ? (
                              <>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                  {feeType}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold break-words italic">{details}</span>
                              </>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                {entry.category}
                              </span>
                            )}
                          </div>

                          {cleanDescription && cleanDescription !== entry.category && entry.category !== 'Student Fee' && entry.category !== 'donation' && entry.category !== 'donations' && (
                            <p className="text-[10px] text-slate-400 font-medium font-noto leading-tight mt-1 break-words italic">
                              {cleanDescription}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                          <Clock size={12} className="text-slate-300" />
                          {formatDate(entry.transaction_date)}
                        </div>
                        <p className={`text-xl sm:text-2xl font-black mt-1 ${entry.type === 'income' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                          {entry.type === 'income' ? '+' : '-'} ৳{entry.amount.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                        </p>
                      </div>
                      
                      {canDeleteAccounting && (
                        <button 
                           onClick={() => setDeleteConfirm({show: true, ids: [entry.id]})}
                          className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center shadow-sm active:scale-95 ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'}`}
                        >
                          {lang === 'bn' ? 'মুছুন' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={`text-center py-32 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-slate-100 text-slate-300'}`}>
                  <FileText size={32} />
               </div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found'}</p>
            </div>
          )}
        </div>
      </div>

      <div className={activeTab === 'add-ledger' ? 'block' : 'hidden'}>
        <div className="space-y-8 animate-in slide-in-from-bottom-5 max-w-2xl mx-auto px-2">
          <div className={`rounded-[3rem] p-8 space-y-8 border shadow-xl ${isDark ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-white/20 shadow-blue-900/5'} backdrop-blur-sm`}>
             <div>
              <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'লেনদেন করুন' : 'Add Transaction'}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{lang === 'bn' ? 'নতুন লেনদেন যোগ করুন' : 'Add new transaction'}</p>
             </div>

             <div className={`flex p-1.5 rounded-[1.8rem] border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
                <button 
                  onClick={() => setType('income')} 
                  className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'income' ? (isDark ? 'bg-slate-900 text-emerald-400 shadow-sm border border-slate-700/50' : 'bg-white text-emerald-500 shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {lang === 'bn' ? 'আয় (Income)' : 'Income'}
                </button>
                <button 
                  onClick={() => setType('expense')} 
                  className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'expense' ? (isDark ? 'bg-slate-900 text-red-400 shadow-sm border border-slate-700/50' : 'bg-white text-red-500 shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {lang === 'bn' ? 'ব্যয় (Expense)' : 'Expense'}
                </button>
             </div>

             <div className="space-y-5">
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2563EB] transition-colors">
                    <DollarSign size={22} />
                  </div>
                  <input 
                    type="number" 
                    className={`w-full h-16 rounded-[1.8rem] pl-14 pr-6 font-black text-xl outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all placeholder:text-slate-300 ${isDark ? 'bg-slate-800 text-slate-100 focus:bg-slate-900' : 'bg-slate-50 text-[#1E293B] focus:bg-white'}`} 
                    placeholder={lang === 'bn' ? "টাকার পরিমাণ" : "Amount (৳)"} 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2563EB] transition-colors">
                        <Tag size={20} />
                      </div>
                      <input 
                        type="text" 
                        className={`w-full h-16 rounded-[1.8rem] pl-14 pr-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all placeholder:text-slate-300 ${isDark ? 'bg-slate-800 text-slate-100 focus:bg-slate-900' : 'bg-slate-50 text-[#1E293B] focus:bg-white'}`} 
                        placeholder={lang === 'bn' ? "ক্যাটাগরি (যেমন: বেতন, বিদ্যুৎ)" : "Category (e.g. Salary, Electricity bill)"} 
                        value={category} 
                        onChange={(e) => setCategory(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="relative group">
                      <input 
                        type="date" 
                        className={`w-full h-16 rounded-[1.8rem] px-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:bg-slate-900 [color-scheme:dark]' : 'bg-slate-50 text-[#1E293B] focus:bg-white'}`} 
                        value={transactionDate} 
                        onChange={(e) => setTransactionDate(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 px-1">
                     {(type === 'income' 
                        ? (madrasah?.institution_type === 'school' || madrasah?.institution_type === 'choching' || madrasah?.institution_type === 'kindergarten' ? (lang === 'bn' ? ['ভর্তি ফি', 'মাসিক বেতন', 'সেশন চার্জ', 'পরীক্ষার ফি'] : ['Admission Fee', 'Monthly Fee', 'Session Charge', 'Exam Fee']) : (lang === 'bn' ? ['সদকা সংগ্রহ', 'লিল্লাহ ফান্ড', 'যাকাত ফান্ড'] : ['Sadakah Collection', 'Lillah Fund', 'Zakat Fund'])) 
                        : (madrasah?.institution_type === 'school' || madrasah?.institution_type === 'choching' || madrasah?.institution_type === 'kindergarten' ? (lang === 'bn' ? ['অফিস খরচ', 'বিদ্যুৎ বিল', 'শিক্ষক বেতন', 'অন্যান্য খরচ'] : ['Office Expense', 'Electricity Bill', 'Teacher Salary', 'Other Expenses']) : (lang === 'bn' ? ['রান্না খরচ', 'খাদ্য খরচ', 'শিক্ষক বেতন', 'মাদরাসা maintenance'] : ['Kitchen Expense', 'Food Expense', 'Teacher Salary', 'Maintenance']))
                     ).map(suggestion => (
                        <button 
                           key={suggestion}
                           type="button"
                           onClick={() => setCategory(suggestion)}
                           className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${category === suggestion ? (isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm' : 'bg-blue-50 text-[#2563EB] border-blue-200 shadow-sm') : (isDark ? 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200')}`}
                        >
                           {suggestion}
                        </button>
                     ))}
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute left-5 top-6 text-slate-300 group-focus-within:text-[#2563EB] transition-colors">
                    <FileText size={20} />
                  </div>
                  <textarea 
                    className={`w-full h-28 rounded-[1.8rem] pl-14 pr-6 py-5 font-bold text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all resize-none placeholder:text-slate-300 ${isDark ? 'bg-slate-800 text-slate-100 focus:bg-slate-900' : 'bg-slate-50 text-[#1E293B] focus:bg-white'}`} 
                    placeholder={lang === 'bn' ? "বিবরণ" : "Description"} 
                    value={desc} 
                    onChange={(e) => setDesc(e.target.value)} 
                  />
                </div>

                <button 
                  onClick={handleAddLedger} 
                  disabled={isSaving} 
                  className="w-full h-16 bg-[#2563EB] text-white font-black rounded-[1.8rem] shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20}/> {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Transaction'}</>}
                </button>
             </div>
          </div>
        </div>
      </div>
      </div>

  {/* ADD LEDGER MODAL REMOVED */}

      {/* Floating Action Button for New Transaction removed as per request */}
      
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-500'}`}>
                <Trash2 size={32} />
              </div>
              <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {lang === 'bn' ? 'নিশ্চিত করুন' : 'Confirm Deletion'}
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'bn' 
                  ? `আপনি কি নিশ্চিত যে আপনি ${deleteConfirm.ids.length} টি লেনদেন মুছে ফেলতে চান? এই কাজ বাতিল করা যাবে না।` 
                  : `Are you sure you want to delete ${deleteConfirm.ids.length} record(s)? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm({show: false, ids: []})}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                onClick={handleDeleteLedger}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : (lang === 'bn' ? 'মুছে ফেলুন' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State-Driven Sync & Repair Modal */}
      {syncModal.show && (
        <div id="sync-repair-modal" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div id="sync-repair-modal-content" className={`w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl transition-all duration-300 transform scale-100 ${
            isDark 
              ? 'bg-slate-900/95 border border-slate-800 text-slate-100 shadow-blue-950/20' 
              : 'bg-white text-slate-800 shadow-indigo-900/10'
          }`}>
            
            {/* Step 1: CONFIRM */}
            {syncModal.step === 'confirm' && (
              <div id="sync-step-confirm" className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
                    isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <Database size={38} className="animate-pulse" />
                  </div>
                  <h3 className={`text-2xl font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'ডাটা সিঙ্ক ও মেরামত' : 'Data Sync & Repair'}
                  </h3>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-indigo-400' : 'text-[#2563EB]'}`}>
                    {lang === 'bn' ? 'ডাটাবেজ অসংগতি সংশোধন' : 'Database Inconsistency repair'}
                  </p>
                  
                  <div className={`mt-6 p-5 rounded-2xl text-left border text-sm leading-relaxed ${
                    isDark ? 'bg-slate-800/50 border-slate-700/50 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    <div className="flex gap-2.5 items-start">
                      <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                      <p className="font-semibold text-xs sm:text-sm font-noto">
                        {lang === 'bn' 
                          ? 'লেনদেন ইতিহাস ছাড়া কোনো ফি ডাটা (Paid status) থাকলে এই প্রক্রিয়াটি তা স্বয়ংক্রিয়ভাবে শনাক্ত করবে এবং অতিরিক্ত বা অনাথ ডাটাগুলো মুছে দিয়ে ডাটাবেজ সচল রাখবে।'
                          : 'This process automatically scans your database, detects paid/fee records that do not have matching financial transaction history, and deletes them to keep your data perfectly consistent.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    id="btn-sync-cancel"
                    onClick={() => setSyncModal({ show: false, step: 'confirm' })}
                    className={`flex-1 py-3.5 rounded-2xl font-black transition-all text-xs uppercase tracking-wider border active:scale-95 ${
                      isDark 
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                        : 'bg-slate-100 text-slate-600 border-slate-200/50 hover:bg-slate-200'
                    }`}
                  >
                    {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
                  </button>
                  <button 
                    id="btn-sync-proceed"
                    onClick={handleSyncAndRepairFees}
                    className={`flex-1 py-3.5 rounded-2xl font-black text-white transition-all text-xs uppercase tracking-wider bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-95 shadow-md hover:shadow-lg`}
                  >
                    {lang === 'bn' ? 'শুরু করুন' : 'Begin Repair'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: LOADING */}
            {syncModal.step === 'loading' && (
              <div id="sync-step-loading" className="py-6 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-4 border-indigo-500/10 animate-ping absolute" />
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <Loader2 size={38} className="animate-spin" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {lang === 'bn' ? 'ডাটা মেরামত করা হচ্ছে...' : 'Repairing Database...'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} max-w-xs mx-auto leading-relaxed font-noto`}>
                    {lang === 'bn' 
                      ? 'ডাটাবেজ স্ক্যান করে অসংগতিপূর্ণ বা অনাথ ফি রেকর্ডগুলো মুছে ফেলা হচ্ছে। অনুগ্রহ করে উইন্ডোটি বন্ধ করবেন না।' 
                      : 'Scanning and removing orphaned student fee entries to restore structural integrity. Please do not close this window.'}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: SUCCESS */}
            {syncModal.step === 'success' && (
              <div id="sync-step-success" className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-5 animate-bounce">
                    <CheckCircle2 size={38} />
                  </div>
                  
                  <h3 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#065F46]'}`}>
                    {lang === 'bn' ? 'মেরামত সম্পন্ন!' : 'Repair Completed!'}
                  </h3>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 text-emerald-500`}>
                    {lang === 'bn' ? 'ডাটাবেজ এখন সচল' : 'Database is fully sync\'d'}
                  </p>

                  <div className={`w-full mt-6 p-5 rounded-2xl border text-left ${
                    isDark ? 'bg-slate-800/40 border-slate-700/50 text-slate-300' : 'bg-emerald-50/50 border-emerald-100 text-emerald-900 font-medium'
                  }`}>
                    <div className="space-y-3 font-noto text-xs sm:text-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-700/20">
                        <span className="font-bold">{lang === 'bn' ? 'সংশোধিত রেকর্ড:' : 'Repaired Records:'}</span>
                        <span className="font-extrabold text-base px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                          {syncModal.deletedCount ?? 0}
                        </span>
                      </div>
                      <p className="leading-relaxed text-xs">
                        {syncModal.message || (lang === 'bn' 
                          ? 'ডাটাবেজ থেকে অনাথ ফি ডাটা সফলভাবে পরিষ্কার করা হয়েছে এবং ক্যাশ রিফ্রেশ করা হয়েছে।' 
                          : 'Successfully cleaned up orphaned/inconsistent student fee records and invalidated matching app cache patterns.')}
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  id="btn-sync-success-close"
                  onClick={() => setSyncModal({ show: false, step: 'confirm' })}
                  className="w-full py-3.5 bg-emerald-500 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-600 active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  {lang === 'bn' ? 'দারুণ! বন্ধ করুন' : 'Awesome, Close'}
                </button>
              </div>
            )}

            {/* Step 4: ERROR */}
            {syncModal.step === 'error' && (
              <div id="sync-step-error" className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mb-5 animate-pulse">
                    <AlertCircle size={38} />
                  </div>
                  
                  <h3 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#991B1B]'}`}>
                    {lang === 'bn' ? 'সংশোধন ব্যর্থ হয়েছে' : 'Repair Failed'}
                  </h3>
                  
                  <div className={`mt-6 p-5 rounded-2xl border text-left w-full ${
                    isDark ? 'bg-slate-800/40 border-slate-700/50 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700 font-semibold'
                  }`}>
                    <p className="font-mono text-xs break-all">
                      {syncModal.message || 'Unknown database exception occurred.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    id="btn-sync-error-retry"
                    onClick={handleSyncAndRepairFees}
                    className="flex-1 py-3.5 bg-rose-500 text-white font-black rounded-2xl hover:bg-rose-600 active:scale-95 transition-all text-xs uppercase tracking-wider font-bold"
                  >
                    {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Retry'}
                  </button>
                  <button 
                    id="btn-sync-error-close"
                    onClick={() => setSyncModal({ show: false, step: 'confirm' })}
                    className={`flex-1 py-3.5 rounded-2xl font-black transition-all text-xs uppercase tracking-wider border active:scale-95 ${
                      isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200/50 hover:bg-slate-200'
                    }`}
                  >
                    {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
