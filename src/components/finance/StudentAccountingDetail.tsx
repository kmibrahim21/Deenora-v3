
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, Class, LedgerEntry, Fee } from 'types';
import { X, ArrowLeft, Download, Calendar, DollarSign, ArrowUpCircle, FileText, Loader2, TrendingUp, TrendingDown, Clock, Trash2, User, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CacheService } from '../../services/cacheService';
import { requestManager, CACHE_TTLS } from '../../services/RequestManager';
import { clearGlobalSchoolFeeCache } from './SchoolFeeEngine';
import { clearGlobalQawmiFeeCache } from './QawmiFeeEngine';

interface StudentAccountingDetailProps {
  student: any;
  madrasah: Institution;
  lang: Language;
  onBack: () => void;
  classes: Class[];
}

const StudentAccountingDetail: React.FC<StudentAccountingDetailProps> = ({ student, madrasah, lang, onBack, classes }) => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<Fee[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [studentFeeSettings, setStudentFeeSettings] = useState<any[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [accStartDate, setAccStartDate] = useState<string>('');
  const [isUpdatingAccStart, setIsUpdatingAccStart] = useState(false);

  useEffect(() => {
    if (student?.notes) {
      const match = student.notes.match(/\[ACC_START:(.*?)\]/);
      if (match) {
        setAccStartDate(match[1]);
      } else {
        setAccStartDate('');
      }
    } else {
      setAccStartDate('');
    }
  }, [student]);

  const handleSaveAccStartDate = async (date: string) => {
    setAccStartDate(date);
    setIsUpdatingAccStart(true);
    try {
      let newNotes = student.notes || '';
      const pattern = /\[ACC_START:.*?\]/;
      const tag = `[ACC_START:${date}]`;
      
      if (pattern.test(newNotes)) {
        newNotes = newNotes.replace(pattern, tag);
      } else {
        newNotes = (newNotes ? newNotes + ' ' : '') + tag;
      }

      const { error } = await supabase.from('students').update({ notes: newNotes }).eq('id', student.student_id);
      if (error) throw error;
      
      // Update local student object reference if possible, or just rely on the next refresh
      student.notes = newNotes; 
      
      requestManager.invalidatePattern(`accounting-fees-${student.student_id}`);
      fetchStudentAccountingData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingAccStart(false);
    }
  };

  const [showMultiCollect, setShowMultiCollect] = useState(false);
  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<string[]>([]);
  const [multiPaidAmount, setMultiPaidAmount] = useState<string>('');
  const [multiDiscount, setMultiDiscount] = useState<string>('');
  const [isSavingMulti, setIsSavingMulti] = useState(false);
  const [errorMulti, setErrorMulti] = useState<string>('');

  const getFeeDetailsForMonth = (monthStr: string) => {
      const monthFees = fees.filter(f => f.month === monthStr);
      const actualPaid = monthFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
      const discountAmt = monthFees.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);
      
      const monthPayable = structures.reduce((sum, s) => {
        const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
        const isEnabled = setting ? setting.is_enabled : true;
        const isMonthExpired = s.due_date && monthStr > s.due_date.slice(0, 7);
        const isMonthNotStarted = s.start_date && monthStr < s.start_date.slice(0, 7);
        
        const yearStart = madrasah.config_json?.academic_year_start;
        const isBeforeYearStart = yearStart && monthStr < yearStart.slice(0, 7);
        
        // Respect individual student accounting start date
        const isBeforeAccStart = accStartDate && monthStr < accStartDate.slice(0, 7);
        
        const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
        return (isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart && !isBeforeAccStart) ? sum + amountToCharge : sum;
      }, 0);
      
      return { 
        due: Math.max(0, monthPayable - actualPaid - discountAmt), 
        payable: monthPayable, 
        paid: actualPaid,
        discount: discountAmt
      };
  };

  const getDueForMonth = (monthStr: string) => getFeeDetailsForMonth(monthStr).due;

  const toggleMonthSelection = (monthStr: string) => {
      setSelectedMonthsToPay(prev => 
          prev.includes(monthStr) 
              ? prev.filter(m => m !== monthStr)
              : [...prev, monthStr]
      );
  };

  useEffect(() => {
      if (!showMultiCollect) {
          setSelectedMonthsToPay([]);
          setMultiPaidAmount('');
          setMultiDiscount('');
          setErrorMulti('');
      }
  }, [showMultiCollect]);

  useEffect(() => {
      const totalSelectedDue = selectedMonthsToPay.reduce((sum, m) => sum + getDueForMonth(m), 0);
      const net = Math.max(0, totalSelectedDue - (parseFloat(multiDiscount) || 0));
      if (selectedMonthsToPay.length > 0) {
          setMultiPaidAmount(net.toString());
      } else {
          setMultiPaidAmount('');
      }
  }, [selectedMonthsToPay, multiDiscount]);

  const handleMultiCollectFee = async () => {
    if (selectedMonthsToPay.length === 0 || multiPaidAmount === '') return;
    
    let remainingPaid = parseFloat(multiPaidAmount) || 0;
    let remainingDiscount = parseFloat(multiDiscount) || 0;
    const totalSelectedDue = selectedMonthsToPay.reduce((sum, m) => sum + getDueForMonth(m), 0);
    
    if ((remainingPaid + remainingDiscount) > totalSelectedDue) {
       setErrorMulti(lang === 'bn' ? 'নির্ধারিত পরিমাণের চেয়ে বেশি নেওয়া যাবে না।' : 'Cannot collect more than the total due amount.');
       return;
    }

    setIsSavingMulti(true);
    setErrorMulti('');
    try {
        const activeYearId = madrasah.config_json?.active_academic_year_id;

        const sortedMonths = [...selectedMonthsToPay].sort();

        let totalCategories = structures.filter(s => {
            const set = studentFeeSettings.find(se => se.fee_structure_id === s.id);
            return set ? set.is_enabled : true;
        }).map(s => s.fee_name).join(', ');

        const createdFeeIds = [];

        for (const monthStr of sortedMonths) {
            const due = getDueForMonth(monthStr);
            if (due <= 0) continue;

            const discountForMonth = Math.min(remainingDiscount, due);
            remainingDiscount -= discountForMonth;

            const payableAfterDiscount = due - discountForMonth;
            const paidForMonth = Math.min(remainingPaid, payableAfterDiscount);
            remainingPaid -= paidForMonth;

            if (paidForMonth > 0 || discountForMonth > 0) {
                const feeData: any = {
                    institution_id: madrasah.id,
                    student_id: student.student_id,
                    class_id: student.class_id,
                    amount_paid: paidForMonth,
                    discount: discountForMonth,
                    month: monthStr,
                    academic_year_id: activeYearId,
                    status: (paidForMonth + discountForMonth >= due) ? 'paid' : 'partial'
                };

                const { data: insertedFee, error } = await supabase.from('fees').insert(feeData).select('id').single();
                if (error) {
                    if (error.message.includes('column') || error.code === '42703') {
                       const { data: retryFee, error: retryErr } = await supabase.from('fees').insert({
                          institution_id: madrasah.id,
                          student_id: student.student_id,
                          class_id: student.class_id,
                          amount_paid: paidForMonth,
                          month: monthStr,
                          academic_year_id: activeYearId,
                          status: (paidForMonth + discountForMonth >= due) ? 'paid' : 'partial'
                       }).select('id').single();
                       if (retryErr) throw retryErr;
                       if (retryFee) createdFeeIds.push(retryFee.id);
                    } else {
                       throw error;
                    }
                } else if (insertedFee) {
                    createdFeeIds.push(insertedFee.id);
                }
            }
        }

        const classNameToSave = classes.find(c => c.id === student.class_id)?.class_name || '';
        const roll = student.roll || '-';
        const monthsNames = sortedMonths.map(m => {
             const [_, mm] = m.split('-');
             return ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'][parseInt(mm)-1];
        }).join(', ');
        
        const totalPaid = parseFloat(multiPaidAmount) || 0;
        const totalDisc = parseFloat(multiDiscount) || 0;
        
        const categoriesStr = totalCategories || (lang === 'bn' ? 'স্টুডেন্ট ফি' : 'Student Fee');
        let finalDescription = `${categoriesStr} - ${student.student_name} (${classNameToSave} | Roll: ${roll} | Months: ${monthsNames})${totalDisc > 0 ? " (ছাড়: ৳" + totalDisc + ")" : ""}`;
        
        if (createdFeeIds.length > 0) {
            finalDescription += createdFeeIds.map(id => ` || FEE_ID: ${id}`).join('');
        }

        await bgInsertLedger(madrasah.id, totalPaid, finalDescription, activeYearId);

        setShowMultiCollect(false);
        requestManager.invalidatePattern(`fees:${madrasah.id}`);
        requestManager.invalidatePattern(`stats:${madrasah.id}`);
        requestManager.invalidatePattern(`accounting-fees-${student.student_id}`);
        requestManager.invalidatePattern(`accounting-history-${student.student_id}`);
        clearGlobalSchoolFeeCache();
        clearGlobalQawmiFeeCache();
        
        fetchStudentAccountingData();
    } catch (err: any) {
        setErrorMulti(err.message);
    } finally {
        setIsSavingMulti(false);
    }
  };

  const bgInsertLedger = async (instId: string, amt: number, desc: string, yId: any) => {
      await supabase.from('ledger').insert({
          institution_id: instId,
          type: 'income',
          amount: amt,
          category: 'Student Fee',
          description: desc,
          transaction_date: new Date().toISOString().split('T')[0],
          academic_year_id: yId
      });
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ledgerToDelete, setLedgerToDelete] = useState<string | null>(null);

  const confirmDeleteLedger = (ledgerId: string) => {
    setLedgerToDelete(ledgerId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteLedger = async () => {
    if (!ledgerToDelete) return;
    const ledgerId = ledgerToDelete;
    setShowDeleteConfirm(false);
    setLedgerToDelete(null);
    
    setLoading(true);
    try {
      // Find the record to find FEE_IDs
      const { data: ledgerRecord } = await supabase.from('ledger').select('description').eq('id', ledgerId).single();
      
      if (ledgerRecord?.description) {
         const feeIds: string[] = [];
         const regex = /FEE_ID:\s*([a-f0-9\-]+)/g;
         let match;
         while ((match = regex.exec(ledgerRecord.description)) !== null) {
            feeIds.push(match[1]);
         }

         if (feeIds.length > 0) {
            await supabase.from('fees').delete().in('id', feeIds);
         } else {
            // Robust Fallback: If no FEE_ID is found, parse description for months to clean up for this specific student
            const monthMatches = ledgerRecord.description.match(/[\d]{4}-[\d]{2}/g) || [];
            if (monthMatches.length > 0) {
               await supabase.from('fees').delete().eq('student_id', student.student_id).in('month', monthMatches);
            }
         }
      }

      const { error } = await supabase.from('ledger').delete().eq('id', ledgerId);
      if (error) throw error;

      // Invalidate Patterns
      requestManager.invalidatePattern(`fees:${madrasah.id}`);
      requestManager.invalidatePattern(`stats:${madrasah.id}`);
      requestManager.invalidatePattern(`accounting-fees-${student.student_id}`);
      requestManager.invalidatePattern(`accounting-history-${student.student_id}`);
      requestManager.invalidatePattern(`fetch:ledger:`);
      clearGlobalSchoolFeeCache();
      clearGlobalQawmiFeeCache();

      fetchStudentAccountingData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentAccountingData();
  }, [student.student_id, selectedYear]);

  const fetchStudentAccountingData = async () => {
    setLoading(true);
    try {
      const yearStart = madrasah.config_json?.academic_year_start;

      // 1. Fetch all fees for the student in the selected year (Selective Cache)
      const { data: feesData } = await requestManager.cachedFetch(
        'fees',
        (q) => q.select('id, student_id, month, amount_paid, discount')
          .eq('student_id', student.student_id)
          .like('month', `${selectedYear}-%`),
        `accounting-fees-${student.student_id}-${selectedYear}`,
        CACHE_TTLS.SHORT
      );

      // 2. Fetch ledger entries mentioning this student (Selective Cache)
      const className = classes.find(c => c.id === student.class_id)?.class_name || student.class_name || '';
      const roll = student.roll || '-';
      
      const { data: ledgerData } = await requestManager.cachedFetch(
        'ledger',
        (q) => q.select('id, transaction_date, amount, category, description')
          .eq('institution_id', madrasah.id)
          .eq('category', 'Student Fee')
          .ilike('description', `%${student.student_name} (${className} | Roll: ${roll} | Month%`)
          .order('transaction_date', { ascending: false })
          .order('id', { ascending: false }),
        `accounting-history-${student.student_id}`,
        CACHE_TTLS.SHORT
      );

      let finalFees = feesData || [];
      if (ledgerData) {
         setLedgerEntries(ledgerData);
      }
      setFees(finalFees);

      // 3. Fetch fee structures for this student's class (Selective Cache)
      const { data: structureData } = await requestManager.cachedFetch(
        'fee_structures',
        (q) => q.select('id, fee_name, amount, due_date, start_date')
          .eq('institution_id', madrasah.id)
          .or(`class_id.eq.${student.class_id},class_id.is.null`),
        `accounting-structures-${student.class_id}`,
        CACHE_TTLS.LONG
      );
      
      if (structureData) setStructures(structureData);

      // 4. Fetch student fee settings (Selective Cache)
      const { data: settingsData } = await requestManager.cachedFetch(
        'student_fee_settings',
        (q) => q.select('id, student_id, fee_structure_id, is_enabled, custom_amount')
          .eq('student_id', student.student_id),
        `accounting-settings-${student.student_id}`,
        CACHE_TTLS.SHORT
      );
      
      if (settingsData) setStudentFeeSettings(settingsData);

    } catch (error) {
      console.error('Error fetching student accounting:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFee = async (feeStructureId: string) => {
    setLoadingFees(true);
    try {
      const setting = studentFeeSettings.find(s => s.fee_structure_id === feeStructureId);
      const isCurrentlyEnabled = setting ? setting.is_enabled : true;
      const newEnabledState = !isCurrentlyEnabled;

      if (setting) {
        const { error } = await supabase.from('student_fee_settings').update({ is_enabled: newEnabledState }).eq('id', setting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('student_fee_settings').insert({
          institution_id: madrasah.id,
          student_id: student.student_id,
          fee_structure_id: feeStructureId,
          is_enabled: newEnabledState
        });
        if (error) throw error;
      }
      
      // Optimistic Update
      setStudentFeeSettings(prev => {
        const exists = prev.find(s => s.fee_structure_id === feeStructureId);
        if (exists) {
          return prev.map(s => s.fee_structure_id === feeStructureId ? { ...s, is_enabled: newEnabledState } : s);
        } else {
          return [...prev, { 
            id: 'temp-' + Date.now(),
            institution_id: madrasah.id, 
            student_id: student.student_id, 
            fee_structure_id: feeStructureId, 
            is_enabled: newEnabledState 
          }];
        }
      });
      
      // Invalidate cache patterns
      requestManager.invalidatePattern(`settings:${madrasah.id}`);
      requestManager.invalidatePattern(`accounting-settings-${student.student_id}`);
      requestManager.invalidatePattern(`student_settings:${student.student_id}`);
      requestManager.invalidatePattern(`student_fee_settings:${madrasah.id}`);
      clearGlobalSchoolFeeCache();
      clearGlobalQawmiFeeCache();

      // Refresh settings
      const { data: settingsData } = await supabase
        .from('student_fee_settings')
        .select('id, student_id, fee_structure_id, is_enabled, custom_amount')
        .eq('student_id', student.student_id);
      
      if (settingsData) setStudentFeeSettings(settingsData);
    } catch (error) {
      console.error('Error toggling fee:', error);
    } finally {
      setLoadingFees(false);
    }
  };

  const updateCustomAmount = async (feeStructureId: string, customAmountStr: string) => {
    try {
      const setting = studentFeeSettings.find(s => s.fee_structure_id === feeStructureId);
      const customAmount = customAmountStr ? parseFloat(customAmountStr) : null;

      if (setting) {
        const { error } = await supabase.from('student_fee_settings').update({ custom_amount: customAmount }).eq('id', setting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('student_fee_settings').insert({
          institution_id: madrasah.id,
          student_id: student.student_id,
          fee_structure_id: feeStructureId,
          is_enabled: true,
          custom_amount: customAmount
        });
        if (error) throw error;
      }
      
      // Invalidate cache patterns
      requestManager.invalidatePattern(`settings:${madrasah.id}`);
      requestManager.invalidatePattern(`accounting-settings-${student.student_id}`);
      requestManager.invalidatePattern(`student_settings:${student.student_id}`);
      requestManager.invalidatePattern(`student_fee_settings:${madrasah.id}`);
      clearGlobalSchoolFeeCache();
      clearGlobalQawmiFeeCache();
      
      // Refresh settings state locally to avoid full refetch delay
      setStudentFeeSettings(prev => {
        const exists = prev.find(s => s.fee_structure_id === feeStructureId);
        if (exists) {
          return prev.map(s => s.fee_structure_id === feeStructureId ? { ...s, custom_amount: customAmount } : s);
        } else {
          return [...prev, { institution_id: madrasah.id, student_id: student.student_id, fee_structure_id: feeStructureId, is_enabled: true, custom_amount: customAmount }];
        }
      });
      
    } catch (error: any) {
      console.error('Error updating custom fee amount:', error);
      if (error?.message?.includes('column') || error?.code === '42703') {
         alert("Database Error: 'custom_amount' column missing. Please run the SQL migration script from 'src/services/migration_add_custom_amount_to_fees.sql' in your Supabase SQL Editor.");
      }
    }
  };

  const isDark = madrasah.theme === 'dark';
  const className = classes.find(c => c.id === student.class_id)?.class_name || '';

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  // Use fees table for total paid and discount as it's more accurate (linked by student_id)
  const totalPaid = fees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
  const totalDiscount = fees.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);
  
  // Calculate total due for the year (limited to current month for the current academic year to avoid showing future months as outstanding)
  const currentYearNum = now.getFullYear();
  const selectedYearNum = parseInt(selectedYear);
  let maxMonthIdx = 12;
  if (selectedYearNum === currentYearNum) {
      maxMonthIdx = now.getMonth() + 1;
  } else if (selectedYearNum > currentYearNum) {
      maxMonthIdx = 0;
  }

  const academicYearStart = madrasah.config_json?.academic_year_start;
  const acStart = academicYearStart ? new Date(academicYearStart) : null;
  const startMonthIdx = acStart && acStart.getFullYear().toString() === selectedYear ? acStart.getMonth() + 1 : 1;

  // Calculate total payable directly from the monthly details to guarantee 100% consistency with the monthly status list
  let totalPayableYearToDate = 0;
  for (let m = startMonthIdx; m <= maxMonthIdx; m++) {
      const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const details = getFeeDetailsForMonth(monthStr);
      totalPayableYearToDate += details.payable;
  }
  
  // Total due should be the net difference for the year to date
  const totalDue = Math.max(0, totalPayableYearToDate - totalPaid - totalDiscount);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button 
            onClick={onBack}
            className={`group flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-2xl border transition-all active:scale-95 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 shadow-sm hover:shadow-md hover:border-slate-300'}`}
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
            <span className="hidden sm:inline text-[11px] font-black uppercase tracking-widest">{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {/* Pay Multi Month Button */}
            <button 
                onClick={() => setShowMultiCollect(true)}
                className="h-12 px-5 rounded-2xl flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 shrink-0 group"
            >
                <DollarSign size={16} className="transition-transform group-hover:scale-110 group-hover:rotate-12" />
                <span>{lang === 'bn' ? 'একাধিক ফি' : 'Collect Fee'}</span>
            </button>

            {/* Year Selector */}
            <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={`h-12 px-4 rounded-2xl border text-[11px] font-black outline-none transition-all shadow-sm cursor-pointer shrink-0 appearance-none ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300 focus:border-blue-500' : 'bg-white border-slate-200 text-slate-600 shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5'}`}
            >
                {[0, 1, 2].map(offset => {
                    const year = (new Date().getFullYear() - offset).toString();
                    return <option key={year} value={year}>{year}</option>;
                })}
            </select>
          </div>
        </div>

        {/* Student Profile Row */}
        <div className={`relative overflow-hidden p-5 sm:p-6 rounded-[2rem] border transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full -ml-12 -mb-12 blur-2xl" />
          
          <div className="relative flex items-center gap-5">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] flex items-center justify-center text-3xl sm:text-4xl font-black shadow-inner border transition-transform duration-500 hover:rotate-6 ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
              {student.student_name ? student.student_name.charAt(0) : <User size={28} />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className={`text-xl sm:text-2xl font-black font-noto tracking-tight truncate leading-tight ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                {student.student_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                  {className}
                </span>
                <span className={`px-3 py-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                  ID: {student.student_id?.slice(-6) || '-'}
                </span>
                <span className={`px-3 py-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  {lang === 'bn' ? 'রোল' : 'Roll'}: {student.roll || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest">{lang === 'bn' ? 'ডাটা লোড হচ্ছে...' : 'Loading data...'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Summary & Monthly Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Row - Horizontal on all devices */}
            <div className="flex flex-row gap-2.5 sm:gap-4 overflow-x-auto no-scrollbar pb-2 px-0.5">
              <div className={`flex-1 min-w-[115px] p-3.5 sm:p-5 rounded-[1.25rem] sm:rounded-[1.75rem] border transition-all hover:scale-[1.02] duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <TrendingUp size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] whitespace-nowrap">মোট প্রদেয়</span>
                </div>
                <div className="space-y-1">
                  <p className={`text-xs sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>৳{totalPayableYearToDate.toLocaleString()}</p>
                  <div className="h-1 w-6 bg-blue-500/20 rounded-full" />
                </div>
              </div>

              <div className={`flex-1 min-w-[115px] p-3.5 sm:p-5 rounded-[1.25rem] sm:rounded-[1.75rem] border transition-all hover:scale-[1.02] duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-emerald-200/40'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <DollarSign size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] whitespace-nowrap">মোট পরিশোধ</span>
                </div>
                <div className="space-y-1">
                  <p className={`text-xs sm:text-xl font-black ${isDark ? 'text-white' : 'text-emerald-600'}`}>৳{totalPaid.toLocaleString()}</p>
                  <div className="h-1 w-6 bg-emerald-500/20 rounded-full" />
                </div>
              </div>

              <div className={`flex-1 min-w-[115px] p-3.5 sm:p-5 rounded-[1.25rem] sm:rounded-[1.75rem] border transition-all hover:scale-[1.02] duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-rose-200/40'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <TrendingDown size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] whitespace-nowrap">মোট বকেয়া</span>
                </div>
                <div className="space-y-1">
                  <p className={`text-xs sm:text-xl font-black ${isDark ? 'text-white' : 'text-rose-600'}`}>৳{totalDue.toLocaleString()}</p>
                  <div className="h-1 w-6 bg-rose-500/20 rounded-full" />
                </div>
              </div>

              <div className={`flex-1 min-w-[115px] p-3.5 sm:p-5 rounded-[1.25rem] sm:rounded-[1.75rem] border transition-all hover:scale-[1.02] duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-amber-200/40'}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                    <TrendingDown size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] whitespace-nowrap">মোট ছাড়</span>
                </div>
                <div className="space-y-1">
                  <p className={`text-xs sm:text-xl font-black ${isDark ? 'text-white' : 'text-amber-600'}`}>৳{totalDiscount.toLocaleString()}</p>
                  <div className="h-1 w-6 bg-amber-500/20 rounded-full" />
                </div>
              </div>
            </div>


            {/* Monthly Grid */}
            <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>
                   <Calendar size={18} />
                   {lang === 'bn' ? 'মাসিক ফি স্ট্যাটাস' : 'Monthly Fee Status'} ({selectedYear})
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Paid</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Paid (Partial)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Unpaid</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                    const monthName = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][i];
                    
                    const monthDetails = getFeeDetailsForMonth(monthStr);
                    const monthPayable = monthDetails.payable;
                    const cashPaid = monthDetails.paid;
                    const discountAmt = monthDetails.discount;
                    const paidAmtTotal = cashPaid + discountAmt;

                    let status = 'unpaid';
                    if (monthPayable > 0) {
                      if (paidAmtTotal >= monthPayable) status = 'paid';
                      else if (paidAmtTotal > 0) status = 'partial';
                      else status = 'unpaid';
                    } else if (paidAmtTotal > 0) {
                      status = 'paid';
                    } else {
                      status = 'no_fee';
                    }

                  return (
                    <motion.div 
                      key={monthStr} 
                      whileHover={{ scale: 1.05 }}
                      className={`relative group p-5 rounded-3xl border transition-all overflow-hidden ${
                        status === 'paid' ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5' : 'bg-emerald-50/50 border-emerald-100 shadow-emerald-500/5') : 
                        status === 'partial' ? (isDark ? 'bg-amber-500/10 border-amber-500/20 shadow-amber-500/5' : 'bg-amber-50/50 border-amber-100 shadow-amber-500/5') : 
                        (isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-100')
                      }`}
                    >
                      <div className="flex flex-col h-full gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[11px] font-black tracking-tight ${status === 'paid' ? 'text-emerald-600' : status === 'partial' ? 'text-amber-600' : 'text-slate-400'}`}>{monthName}</p>
                          {discountAmt > 0 && (
                            <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg border animate-pulse ${isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                               {lang === 'bn' ? 'ছাড়' : 'Discount'} ৳{discountAmt?.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-auto space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-lg ${
                              status === 'paid' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 
                              status === 'partial' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 
                              status === 'no_fee' ? 'bg-slate-500 text-white' :
                              'bg-slate-200 text-slate-500'
                            }`}>
                              {status === 'paid' ? 'Paid' : status === 'partial' ? 'Paid' : status === 'no_fee' ? 'No Fee' : 'Unpaid'}
                            </span>
                            {(paidAmtTotal > 0 || status === 'paid') && (
                              <div className="flex flex-col items-end">
                                <span className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>৳{cashPaid?.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Recent Transactions & Fee Settings */}
          <div className="space-y-6">
            {/* Accounting Start Section */}
            <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>
                   <Calendar size={18} />
                   {lang === 'bn' ? 'হিসাব শুরুর তারিখ' : 'Accounting Start Date'}
                </h3>
              </div>
              <div className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50/30 border-blue-100/50'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <Calendar size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'bn' ? 'যেই মাস থেকে হিসাব শুরু হবে' : 'The month from which accounting starts'}</p>
                  <input 
                    type="month" 
                    value={accStartDate || (madrasah.config_json?.academic_year_start?.slice(0, 7) || new Date().toISOString().slice(0, 7))}
                    onChange={(e) => handleSaveAccStartDate(e.target.value)}
                    disabled={isUpdatingAccStart}
                    className={`w-full bg-transparent border-none p-0 focus:ring-0 outline-none cursor-pointer text-sm font-black ${isDark ? 'text-slate-200' : 'text-blue-600'}`}
                  />
                </div>
                {isUpdatingAccStart && <Loader2 size={16} className="animate-spin text-blue-500" />}
              </div>
              <p className="mt-3 text-[9px] font-medium text-slate-400 leading-relaxed font-noto italic">
                *{lang === 'bn' ? ' এই তারিখের পূর্বের কোনো ফি বকেয়া হিসেবে গণ্য হবে না।' : ' Any fees before this date will not be counted as due.'}
              </p>
            </div>

            {/* Fee Settings Section */}
            <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>
                   <DollarSign size={18} />
                   {lang === 'bn' ? 'ফি সেটিংস' : 'Fee Settings'}
                </h3>
              </div>
              
              {loadingFees ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : (
                <div className="space-y-4">
                  {structures.length > 0 ? structures.map(fee => {
                    const setting = studentFeeSettings.find(s => s.fee_structure_id === fee.id);
                    const isEnabled = setting ? setting.is_enabled : true;
                    const isExpired = fee.due_date && fee.due_date < today;
                    const customAmount = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? setting.custom_amount : fee.amount;
                    
                    return (
                      <div key={fee.id} className={`flex flex-col gap-4 p-5 rounded-[2rem] border transition-all ${isEnabled && !isExpired ? (isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50/30 border-blue-100/50') : (isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-100')} ${isExpired ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col min-w-0 gap-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className={`text-xs font-black tracking-tight ${isEnabled && !isExpired ? (isDark ? 'text-blue-300' : 'text-[#1E3A8A]') : 'text-slate-400'}`}>{fee.fee_name}</span>
                                {isExpired && <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded-lg uppercase tracking-widest">Expired</span>}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-slate-400/80 uppercase tracking-widest">{lang === 'bn' ? 'ডিফল্ট' : 'Default'}: ৳{fee.amount?.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                              </div>
                            </div>
                            
                            <label className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all focus:outline-none cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={isEnabled && !isExpired} 
                                disabled={isExpired}
                                onChange={() => !isExpired && toggleFee(fee.id)}
                                className="sr-only"
                              />
                              <span className={`${isEnabled && !isExpired ? (isDark ? 'bg-blue-600' : 'bg-blue-600') : (isDark ? 'bg-slate-700' : 'bg-slate-300')} inline-block h-6 w-11 rounded-full border-2 border-transparent transition-colors shadow-inner`} />
                              <span className={`${isEnabled && !isExpired ? 'translate-x-[20px]' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`} />
                            </label>
                        </div>

                        <AnimatePresence>
                          {isEnabled && !isExpired && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className={`flex items-center gap-3 p-4 rounded-2xl ${isDark ? 'bg-slate-800/80 border border-slate-700' : 'bg-white border border-blue-100/50 shadow-sm'}`}>
                                <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                  <TrendingUp size={14} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'bn' ? 'নির্ধারিত ফি (৳)' : 'Assigned Fee (৳)'}</p>
                                  <input
                                    type="number"
                                    className={`w-full bg-transparent outline-none font-black text-sm placeholder:text-slate-300 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}
                                    placeholder="Amount"
                                    defaultValue={customAmount}
                                    onBlur={(e) => updateCustomAmount(fee.id, e.target.value)}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-10 flex flex-col items-center gap-3">
                       <DollarSign size={32} className="text-slate-200" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কোনো ফি পাওয়া যায়নি' : 'No fees found'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>
                   <Clock size={18} />
                   {lang === 'bn' ? 'লেনদেন ইতিহাস' : 'Transaction History'}
                </h3>
              </div>

              <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                {ledgerEntries.length > 0 ? (
                  ledgerEntries.map((entry, idx) => (
                    <div key={entry.id} className="relative pl-9 group">
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 flex items-center justify-center transition-all group-hover:scale-110 shadow-lg ${isDark ? 'bg-emerald-500 border-slate-900 shadow-emerald-500/20' : 'bg-emerald-500 border-white shadow-emerald-500/20'}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <p className={`text-lg font-black leading-none ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+ ৳{entry.amount.toLocaleString()}</p>
                            <div className="flex items-center gap-2 mt-2">
                               <Clock size={10} className="text-slate-400" />
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                 {entry.transaction_date ? new Date(entry.transaction_date.includes('T') ? entry.transaction_date : entry.transaction_date + 'T00:00:00').toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                               </span>
                            </div>
                          </div>
                          <button
                             onClick={() => confirmDeleteLedger(entry.id)}
                             className={`p-2 rounded-xl transition-all active:scale-95 ${isDark ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                             title="Delete"
                           >
                              <Trash2 size={14} />
                           </button>
                        </div>
                        <div className={`p-4 rounded-2xl border text-[11px] font-bold leading-relaxed whitespace-pre-wrap font-noto ${isDark ? 'bg-slate-800/50 border-slate-700/50 text-slate-400' : 'bg-slate-50/50 border-slate-100 text-slate-600'}`}>
                          {(entry.description || '').split(' || FEE_ID: ')[0]}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 flex flex-col items-center justify-center gap-4">
                    <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-50 text-slate-200 shadow-inner'}`}>
                      <FileText size={28} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কোনো লেনদেন নেই' : 'No transactions found'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showMultiCollect && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
                onClick={() => setShowMultiCollect(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`relative w-full max-w-lg rounded-[2rem] p-6 sm:p-8 border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                          <DollarSign size={24} />
                        </div>
                        <div>
                          <h2 className={`text-xl font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                              {lang === 'bn' ? 'একাধিক মাসের ফি' : 'Multi-month Fees'}
                          </h2>
                          <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>
                            {student.student_name}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setShowMultiCollect(false)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          <X size={20} />
                      </button>
                  </div>

                  <div className="space-y-6">
                      {/* Month Selector */}
                      <div>
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Calendar size={12} className="text-blue-500" />
                            {lang === 'bn' ? 'মাসের বকেয়া নির্বাচন করুন' : 'Select Months Due'} ({selectedYear})
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                              {Array.from({ length: 12 }).map((_, i) => {
                                  const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                                  const monthName = ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'][i];
                                  const details = getFeeDetailsForMonth(monthStr);
                                  const due = details.due;
                                  const isSelected = selectedMonthsToPay.includes(monthStr);
                                  
                                  if (due <= 0 && !isSelected) return null;

                                  return (
                                      <button
                                          key={monthStr}
                                          onClick={() => toggleMonthSelection(monthStr)}
                                          className={`group relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-0.5 ${
                                              isSelected 
                                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]' 
                                              : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-blue-200')
                                          }`}
                                      >
                                          <span className="text-[10px] font-black uppercase tracking-tighter">{monthName}</span>
                                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>৳{due?.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                          {isSelected && (
                                            <div 
                                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-md border-2 border-blue-600"
                                            >
                                              <Check size={12} strokeWidth={3} />
                                            </div>
                                          )}
                                      </button>
                                  );
                              })}
                          </div>
                          {selectedMonthsToPay.length === 0 && (
                            <div className="text-center py-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 mt-2">
                               <p className="text-[10px] font-bold text-slate-400">{lang === 'bn' ? 'অনুগ্রহ করে পরিশোধের জন্য মাস নির্বাচন করুন' : 'Please select months to make a payment'}</p>
                            </div>
                          )}
                      </div>

                      {/* Payment Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                              <label className={`text-[9px] font-black uppercase tracking-widest px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>জমা (৳)</label>
                              <div className={`relative flex items-center group transition-all ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'} rounded-xl border-2 ${isDark ? 'border-slate-700 focus-within:border-blue-500' : 'border-slate-100 focus-within:border-blue-400'}`}>
                                  <DollarSign size={16} className="ml-3 text-blue-500" />
                                  <input 
                                      type="number"
                                      value={multiPaidAmount}
                                      onChange={(e) => setMultiPaidAmount(e.target.value)}
                                      placeholder="0"
                                      className={`w-full bg-transparent p-3 outline-none font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}
                                  />
                              </div>
                          </div>
                          <div className="space-y-1.5">
                              <label className={`text-[9px] font-black uppercase tracking-widest px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ছাড় (৳)</label>
                              <div className={`relative flex items-center group transition-all ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'} rounded-xl border-2 ${isDark ? 'border-slate-700 focus-within:border-amber-500' : 'border-slate-100 focus-within:border-amber-400'}`}>
                                  <TrendingDown size={16} className="ml-3 text-amber-500" />
                                  <input 
                                      type="number"
                                      value={multiDiscount}
                                      onChange={(e) => setMultiDiscount(e.target.value)}
                                      placeholder="0"
                                      className={`w-full bg-transparent p-3 outline-none font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}
                                  />
                              </div>
                          </div>
                      </div>

                      {errorMulti && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold font-noto flex items-center gap-2"
                          >
                            <X size={14} />
                            {errorMulti}
                          </motion.div>
                      )}

                      {/* Action Button */}
                      <button 
                          onClick={handleMultiCollectFee}
                          disabled={isSavingMulti || selectedMonthsToPay.length === 0}
                          className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2.5"
                      >
                          {isSavingMulti ? (
                              <Loader2 size={20} className="animate-spin" />
                          ) : (
                              <>
                                <ArrowUpCircle size={20} />
                                <span>{lang === 'bn' ? 'নিশ্চিত করুন' : 'Confirm'}</span>
                              </>
                          )}
                      </button>
                  </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
                onClick={() => setShowDeleteConfirm(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`relative w-full max-w-sm rounded-[2rem] p-8 border shadow-2xl overflow-hidden text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                  <div className={`w-20 h-20 rounded-[2rem] mx-auto mb-6 flex items-center justify-center ${isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Trash2 size={36} />
                  </div>
                  
                  <h2 className={`text-xl font-black font-noto tracking-tight mb-3 ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                    {lang === 'bn' ? 'মুছে ফেলতে চান?' : 'Confirm Delete?'}
                  </h2>
                  
                  <p className={`text-xs font-bold leading-relaxed mb-8 px-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {lang === 'bn' 
                      ? (lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই লেনদেনটি মুছে ফেলতে চান? এটি সংশ্লিষ্ট সব ফি রেকর্ডও মুছে ফেলবে।' : 'Are you sure you want to delete this transaction? This will also delete all related fee records.') 
                      : 'Are you sure you want to delete this transaction? It will also remove associated fee records.'}
                  </p>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleDeleteLedger}
                      className="w-full h-14 rounded-2xl bg-rose-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-700 active:scale-95"
                    >
                      {lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Delete'}
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(false)}
                      className={`w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StudentAccountingDetail;
