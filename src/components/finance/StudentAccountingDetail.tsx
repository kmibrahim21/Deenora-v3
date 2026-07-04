
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, Class, LedgerEntry, Fee } from 'types';
import { X, ArrowLeft, Download, Calendar, DollarSign, ArrowUpCircle, FileText, Loader2, TrendingUp, TrendingDown, Clock, Trash2 } from 'lucide-react';
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

  const [showMultiCollect, setShowMultiCollect] = useState(false);
  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<string[]>([]);
  const [multiPaidAmount, setMultiPaidAmount] = useState<string>('');
  const [multiDiscount, setMultiDiscount] = useState<string>('');
  const [isSavingMulti, setIsSavingMulti] = useState(false);
  const [errorMulti, setErrorMulti] = useState<string>('');

  const getDueForMonth = (monthStr: string) => {
      const monthFees = fees.filter(f => f.month === monthStr);
      const paidAmt = monthFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0) + (Number(f.discount) || 0), 0);
      
      const monthPayable = structures.reduce((sum, s) => {
        const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
        const isEnabled = setting ? setting.is_enabled : true;
        const isMonthExpired = s.due_date && monthStr > s.due_date.slice(0, 7);
        const isMonthNotStarted = s.start_date && monthStr < s.start_date.slice(0, 7);
        
        const yearStart = madrasah.config_json?.academic_year_start;
        const isBeforeYearStart = yearStart && monthStr < yearStart.slice(0, 7);
        
        const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
        return (isEnabled && !isMonthExpired && !isMonthNotStarted && !isBeforeYearStart) ? sum + amountToCharge : sum;
      }, 0);
      
      return Math.max(0, monthPayable - paidAmt);
  };

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
        
        let finalDescription = `${totalCategories} - ${student.student_name} (${classNameToSave} | Roll: ${roll} | Months: ${monthsNames})${totalDisc > 0 ? " (ছাড়: ৳" + totalDisc + ")" : ""}`;
        
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

  const handleDeleteLedger = async (ledgerId: string) => {
    if (!confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই লেনদেনটি মুছে ফেলতে চান? এটি সংশ্লিষ্ট সব ফি রেকর্ডও মুছে ফেলবে।' : 'Are you sure you want to delete this transaction? It will also remove associated fee records.')) return;
    
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
          .ilike('description', `%${student.student_name} (${className} | Roll: ${roll} | Month%`),
        `accounting-history-${student.student_id}`,
        CACHE_TTLS.SHORT
      );

      let finalFees = feesData || [];
      if (ledgerData) {
         setLedgerEntries(ledgerData.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()));
         
         // AUTO-CLEANUP ORPHANED FEES (Throttled Self-healing)
         const lastCleanup = localStorage.getItem(`last_fee_cleanup_${student.student_id}`);
         const now = Date.now();
         const ONE_HOUR = 3600000;

         if (feesData && (!lastCleanup || now - parseInt(lastCleanup) > ONE_HOUR)) {
             const feesToDelete: string[] = [];
             for (const fee of feesData) {
                const hasLedger = ledgerData.some(l => 
                   (l.description || '').includes(`FEE_ID: ${fee.id}`)
                );
                if (!hasLedger) {
                   feesToDelete.push(fee.id);
                }
             }
             
             if (feesToDelete.length > 0) {
                try {
                   await supabase.from('fees').delete().in('id', feesToDelete);
                   finalFees = feesData.filter(f => !feesToDelete.includes(f.id));
                   if (madrasah?.id) {
                      await CacheService.clearCache('stats', madrasah.id);
                      await CacheService.clearCache('fees', madrasah.id);
                      requestManager.invalidatePattern(`fees:${madrasah.id}`);
                      requestManager.invalidatePattern(`stats:${madrasah.id}`);
                      requestManager.invalidatePattern(`dashboard_`);
                      clearGlobalSchoolFeeCache();
                      clearGlobalQawmiFeeCache();
                   }
                } catch (e) {
                   console.error("Cleanup error:", e);
                }
             }
             localStorage.setItem(`last_fee_cleanup_${student.student_id}`, now.toString());
         }
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
  
  // Use fees table for total paid as it's more accurate (linked by student_id)
  const totalPaid = fees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0) + (Number(f.discount) || 0), 0);
  
  // Calculate total due for the year
  const maxMonthIdx = 12;
  const academicYearStart = madrasah.config_json?.academic_year_start;
  const acStart = academicYearStart ? new Date(academicYearStart) : null;
  const startMonthIdx = acStart && acStart.getFullYear().toString() === selectedYear ? acStart.getMonth() + 1 : 1;

  let totalPayableYearToDate = 0;
  for (let m = startMonthIdx; m <= maxMonthIdx; m++) {
      const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      structures.forEach(s => {
          const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
          const isEnabled = setting ? setting.is_enabled : true;
          if (!isEnabled) return;
          
          const isExpired = s.due_date && s.due_date.slice(0, 7) < monthStr;
          const isNotStarted = s.start_date && s.start_date.slice(0, 7) > monthStr;
          const isBeforeYearStart = academicYearStart && monthStr < academicYearStart.slice(0, 7);
          
          if (!isExpired && !isNotStarted && !isBeforeYearStart) {
             const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
             totalPayableYearToDate += amountToCharge;
          }
      });
  }

  const totalDue = Math.max(0, totalPayableYearToDate - totalPaid);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-1 sm:gap-4 pb-1">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink">
          <button 
            onClick={onBack}
            className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <div className="min-w-0">
            <h2 className={`text-sm sm:text-xl font-black font-noto truncate ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>{student.student_name}</h2>
            <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{className} | রোল: {student.roll || '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button 
                onClick={() => setShowMultiCollect(true)}
                className={`h-8 sm:h-10 px-2 sm:px-4 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all shadow-sm ${isDark ? 'bg-[#2563EB] hover:bg-blue-600 text-white border border-blue-500/50 shadow-blue-500/20' : 'bg-[#2563EB] hover:bg-blue-600 text-white shadow-blue-500/20'}`}
            >
                <DollarSign size={12} className="sm:w-[14px] sm:h-[14px]" />
                <span className="hidden sm:inline">একসাথে ফি</span>
                <span className="inline sm:hidden">একাধিক মাস</span>
            </button>
            <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={`h-8 sm:h-10 px-2 sm:px-4 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-black outline-none transition-all shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600 focus:border-blue-300'}`}
            >
                {[0, 1, 2].map(offset => {
                    const year = (new Date().getFullYear() - offset).toString();
                    return <option key={year} value={year}>{year}</option>;
                })}
            </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Summary & Monthly Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="flex flex-row gap-2 sm:gap-4 pb-2 sm:pb-0">
              <div className={`flex-1 p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-3">
                  <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-[0.6rem] sm:rounded-[1.2rem] flex items-center justify-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <TrendingUp size={12} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <span className="text-[6.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">মোট প্রদেয়</span>
                </div>
                <p className={`text-xs sm:text-2xl font-black ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>৳{totalPayableYearToDate.toLocaleString()}</p>
              </div>

              <div className={`flex-1 p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-3">
                  <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-[0.6rem] sm:rounded-[1.2rem] flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <DollarSign size={12} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <span className="text-[6.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">মোট পরিশোধ</span>
                </div>
                <p className={`text-xs sm:text-2xl font-black ${isDark ? 'text-slate-100' : 'text-emerald-600'}`}>৳{totalPaid.toLocaleString()}</p>
              </div>

              <div className={`flex-1 p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-3">
                  <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-[0.6rem] sm:rounded-[1.2rem] flex items-center justify-center ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                    <TrendingDown size={12} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <span className="text-[6.5px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">মোট বকেয়া</span>
                </div>
                <p className={`text-xs sm:text-2xl font-black ${isDark ? 'text-slate-100' : 'text-red-600'}`}>৳{totalDue.toLocaleString()}</p>
              </div>
            </div>

            {/* Monthly Grid */}
            <div className={`p-8 rounded-[3rem] border shadow-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>মাসিক ফি স্ট্যাটাস ({selectedYear})</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Paid</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Partial</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Unpaid</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                    const monthName = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][i];
                    
                    const monthFees = fees.filter(f => f.month === monthStr);
                    const paidAmtTotal = monthFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0) + (Number(f.discount) || 0), 0);
                    const cashPaid = monthFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
                    const discountAmt = monthFees.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);
                    
                    // Calculate payable for this specific month
                    const monthPayable = structures.reduce((sum, s) => {
                      const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
                      const isEnabled = setting ? setting.is_enabled : true;
                      const isMonthExpired = s.due_date && monthStr > s.due_date.slice(0, 7);
                      const isMonthNotStarted = s.start_date && monthStr < s.start_date.slice(0, 7);
                      const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                      return (isEnabled && !isMonthExpired && !isMonthNotStarted) ? sum + amountToCharge : sum;
                    }, 0);

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
                    <div key={monthStr} className={`relative p-5 rounded-3xl border transition-all hover:scale-[1.02] ${status === 'paid' ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100') : status === 'partial' ? (isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-100') : (isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-[11px] font-black ${status === 'paid' ? 'text-emerald-600' : status === 'partial' ? 'text-orange-600' : 'text-slate-400'}`}>{monthName}</p>
                        {discountAmt > 0 && (
                          <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                             -{discountAmt} ছাড়
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                          status === 'paid' ? 'bg-emerald-500 text-white' : 
                          status === 'partial' ? 'bg-orange-500 text-white' : 
                          status === 'no_fee' ? 'bg-slate-500 text-white' :
                          'bg-slate-200 text-slate-500'
                        }`}>
                          {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : status === 'no_fee' ? (lang === 'bn' ? 'ফি নেই' : 'No Fee') : 'Unpaid'}
                        </span>
                        {(paidAmtTotal > 0 || status === 'paid') && (
                          <div className="flex flex-col items-end">
                            <span className={`text-[10px] font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>৳{cashPaid}</span>
                            {status === 'partial' && <span className="text-[7px] text-red-500 font-bold">বাকি: {Math.max(0, monthPayable - paidAmtTotal)}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Recent Transactions & Fee Settings */}
          <div className="space-y-6">
            {/* Fee Settings Section */}
            <div className={`p-8 rounded-[3rem] border shadow-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>ফি সেটিংস</h3>
                <DollarSign size={18} className="text-slate-300" />
              </div>
              
              {loadingFees ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" size={20} /></div>
              ) : (
                <div className="space-y-3">
                  {structures.length > 0 ? structures.map(fee => {
                    const setting = studentFeeSettings.find(s => s.fee_structure_id === fee.id);
                    const isEnabled = setting ? setting.is_enabled : true;
                    const isExpired = fee.due_date && fee.due_date < today;
                    const customAmount = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? setting.custom_amount : fee.amount;
                    
                    return (
                      <div key={fee.id} className={`flex flex-col gap-3 p-5 rounded-[2rem] border transition-all ${isEnabled && !isExpired ? (isDark ? 'bg-blue-500/5 border-blue-500/10 shadow-sm' : 'bg-blue-50/50 border-blue-100/50 shadow-sm') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')} ${isExpired ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                <span className={`text-xs font-black tracking-tight ${isEnabled && !isExpired ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-slate-400'}`}>{fee.fee_name}</span>
                                {isExpired && <span className="text-[7px] font-black bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded-lg uppercase tracking-widest leading-none">Expired</span>}
                              </div>
                              <span className="text-[9px] font-bold text-slate-400/80 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                ডিফল্ট ফি: ৳{fee.amount}
                              </span>
                            </div>
                            
                            <label className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all focus:outline-none cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={isEnabled && !isExpired} 
                                disabled={isExpired}
                                onChange={() => !isExpired && toggleFee(fee.id)}
                                className="sr-only"
                              />
                              <span className={`${isEnabled && !isExpired ? (isDark ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-[#2563EB] shadow-[0_0_20px_rgba(37,99,235,0.3)]') : (isDark ? 'bg-slate-700' : 'bg-slate-400')} inline-block h-7 w-12 rounded-full border-2 ${isDark ? 'border-slate-800' : 'border-white'} transition-colors`} />
                              <span className={`${isEnabled && !isExpired ? 'translate-x-[22px]' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md`} />
                            </label>
                        </div>

                        {isEnabled && !isExpired && (
                          <div className={`flex items-center gap-3 p-3 rounded-2xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-blue-100/30'} animate-in fade-in slide-in-from-top-2 duration-300`}>
                            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                              <DollarSign size={12} />
                            </div>
                            <div className="flex-1">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">ব্যক্তিগত ফি (৳)</p>
                              <input
                                type="number"
                                className={`w-full bg-transparent outline-none font-black text-xs placeholder:text-slate-300 ${isDark ? 'text-slate-200' : 'text-[#1E3A8A]'}`}
                                placeholder="এখানে নতুন পরিমান লিখুন"
                                defaultValue={customAmount}
                                onBlur={(e) => updateCustomAmount(fee.id, e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-[10px] font-bold text-slate-400 text-center py-4 uppercase tracking-widest">কোনো ফি পাওয়া যায়নি</p>
                  )}
                </div>
              )}
            </div>

            <div className={`p-8 rounded-[3rem] border shadow-sm h-full ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>লেনদেন ইতিহাস</h3>
                <Clock size={18} className="text-slate-300" />
              </div>

              <div className="space-y-4">
                {ledgerEntries.length > 0 ? (
                  ledgerEntries.map((entry, idx) => (
                    <div key={entry.id} className={`relative pl-8 pb-6 ${idx === ledgerEntries.length - 1 ? '' : `border-l-2 border-dashed ${isDark ? 'border-slate-700' : 'border-slate-100'}`}`}>
                      <div className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 shadow-sm flex items-center justify-center ${isDark ? 'bg-emerald-500 border-slate-800' : 'bg-emerald-500 border-white'}`}></div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>৳{entry.amount}</p>
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] font-bold text-slate-400">
                               {entry.transaction_date ? new Date(entry.transaction_date.includes('T') ? entry.transaction_date : entry.transaction_date + 'T00:00:00').toLocaleDateString('bn-BD') : ''}
                             </span>
                             <button
                               onClick={() => handleDeleteLedger(entry.id)}
                               className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                             >
                                <Trash2 size={12} />
                             </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">
                          {(entry.description || '').split(' || FEE_ID: ')[0].split(' | Month: ')[0].split(' | মাস: ')[0]}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 flex flex-col items-center justify-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-50 text-slate-200'}`}>
                      <FileText size={24} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">কোনো লেনদেন নেই</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMultiCollect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowMultiCollect(false)}></div>
            <div className={`relative w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 animate-in zoom-in duration-300 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-8">
                    <h2 className={`text-2xl font-black font-noto tracking-tight flex flex-col ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                        একাধিক মাসের ফি
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>{student.student_name}</span>
                    </h2>
                    <button onClick={() => setShowMultiCollect(false)} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-6">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>মাসের বকেয়া নির্বাচন করুন ({selectedYear})</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => {
                            const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                            const monthName = ['জানু', 'ফেব', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুল', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'][i];
                            const due = getDueForMonth(monthStr);
                            const isSelected = selectedMonthsToPay.includes(monthStr);
                            
                            return (
                                <button 
                                    key={monthStr}
                                    type="button"
                                    onClick={() => due > 0 && toggleMonthSelection(monthStr)}
                                    disabled={due <= 0}
                                    className={`relative p-2 rounded-xl flex flex-col items-center justify-center border-2 transition-all ${
                                         due <= 0 
                                            ? (isDark ? 'bg-slate-800/20 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-50 cursor-not-allowed')
                                            : isSelected 
                                                ? (isDark ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'bg-[#2563EB] border-[#2563EB] text-white')
                                                : (isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
                                    }`}
                                >
                                    <span className="text-xs font-black">{monthName}</span>
                                    {due > 0 && <span className={`text-[9px] font-bold mt-1 ${isSelected ? 'text-blue-100' : isDark ? 'text-red-400' : 'text-red-500'}`}>৳{due}</span>}
                                    {due <= 0 && <span className="text-[9px] font-bold mt-1 text-emerald-500">Paid</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-4 mb-6">
                   <div className="flex-1">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ছাড় (৳)</label>
                      <input 
                         type="number" 
                         className={`w-full h-12 rounded-xl px-4 font-black transition-all outline-none border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-[#1E293B] focus:border-[#2563EB]/50'}`}
                         placeholder="0" 
                         value={multiDiscount} 
                         onChange={e => setMultiDiscount(e.target.value)} 
                      />
                   </div>
                   <div className="flex-1">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>মোট গ্রহণ (৳)</label>
                      <input 
                         type="number" 
                         className={`w-full h-12 rounded-xl px-4 font-black transition-all outline-none border focus:ring-0 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-[#1E293B] focus:border-[#2563EB]/50'}`}
                         placeholder="0.00" 
                         value={multiPaidAmount} 
                         onChange={e => setMultiPaidAmount(e.target.value)} 
                      />
                   </div>
                </div>

                {errorMulti && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center">
                        {errorMulti}
                    </div>
                )}

                <button 
                   onClick={handleMultiCollectFee}
                   disabled={isSavingMulti || selectedMonthsToPay.length === 0 || multiPaidAmount === ''}
                   className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-all ${
                       selectedMonthsToPay.length === 0 || multiPaidAmount === '' || isSavingMulti
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#2563EB] hover:bg-blue-600 text-white active:scale-95 shadow-lg shadow-blue-500/25'
                   }`}
                >
                   {isSavingMulti ? <Loader2 className="animate-spin" size={20} /> : 'নিশ্চিত করুন'}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default StudentAccountingDetail;
