
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, Class, LedgerEntry, Fee } from 'types';
import { X, ArrowLeft, Download, Calendar, DollarSign, ArrowUpCircle, FileText, Loader2, TrendingUp, TrendingDown, Clock, Trash2 } from 'lucide-react';
import { CacheService } from '../../services/cacheService';
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

  useEffect(() => {
    fetchStudentAccountingData();
  }, [student.student_id, selectedYear]);

  const fetchStudentAccountingData = async () => {
    setLoading(true);
    try {
      const yearStart = madrasah.config_json?.academic_year_start;

      // 1. Fetch all fees for the student in the selected year
      const { data: feesData } = await supabase
        .from('fees')
        .select('*')
        .eq('student_id', student.student_id)
        .like('month', `${selectedYear}-%`);

      // 2. Fetch ledger entries mentioning this student
      const { data: ledgerData } = await supabase
        .from('ledger')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('category', 'Student Fee')
        .ilike('description', `%${student.student_name}%`);

      let finalFees = feesData || [];
      if (ledgerData) {
         setLedgerEntries(ledgerData.sort((a, b) => new Date(b.transaction_date.replace(/-/g, '/')).getTime() - new Date(a.transaction_date.replace(/-/g, '/')).getTime()));
         
         // AUTO-CLEANUP ORPHANED FEES (Self-healing mechanism)
         if (feesData) {
             const feesToDelete: string[] = [];
             for (const fee of feesData) {
                const hasLedger = ledgerData.some(l => 
                   l.description.includes(`FEE_ID: ${fee.id}`)
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
                      clearGlobalSchoolFeeCache();
                      clearGlobalQawmiFeeCache();
                   }
                } catch (e) {
                   console.error("Cleanup error:", e);
                }
             }
         }
      }
      setFees(finalFees);

      // 3. Fetch fee structures for this student's class
      const { data: structureData } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('institution_id', madrasah.id)
        .or(`class_id.eq.${student.class_id},class_id.is.null`);
      
      if (structureData) setStructures(structureData);

      // 4. Fetch student fee settings
      const { data: settingsData } = await supabase
        .from('student_fee_settings')
        .select('*')
        .eq('student_id', student.student_id);
      
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
        await supabase.from('student_fee_settings').update({ is_enabled: newEnabledState }).eq('id', setting.id);
      } else {
        await supabase.from('student_fee_settings').insert({
          institution_id: madrasah.id,
          student_id: student.student_id,
          fee_structure_id: feeStructureId,
          is_enabled: newEnabledState
        });
      }
      
      // Refresh settings
      const { data: settingsData } = await supabase
        .from('student_fee_settings')
        .select('*')
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
  
  // Calculate total due for the year up to current month mapping over months properly 
  const currentMonthIdx = now.getMonth() + 1;
  const yearStr = now.getFullYear().toString();
  const academicYearStart = madrasah.config_json?.academic_year_start;
  const acStart = academicYearStart ? new Date(academicYearStart.replace(/-/g, '/')) : new Date(now.getFullYear(), 0, 1);
  const startMonthIdx = acStart.getFullYear() === now.getFullYear() ? acStart.getMonth() + 1 : 1;

  let totalPayableYearToDate = 0;
  for (let m = startMonthIdx; m <= currentMonthIdx; m++) {
      const monthStr = `${yearStr}-${String(m).padStart(2, '0')}`;
      structures.forEach(s => {
          const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
          const isEnabled = setting ? setting.is_enabled : true;
          if (!isEnabled) return;
          
          const isExpired = s.due_date && s.due_date.slice(0, 7) < monthStr;
          const isNotStarted = s.start_date && s.start_date.slice(0, 7) > monthStr;
          
          if (!isExpired && !isNotStarted) {
             const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
             totalPayableYearToDate += amountToCharge;
          }
      });
  }

  const totalDue = Math.max(0, totalPayableYearToDate - totalPaid);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className={`text-xl font-black font-noto truncate ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>{student.student_name}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{className} | রোল: {student.roll || '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
            <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={`h-10 px-4 rounded-xl border text-xs font-black outline-none transition-all shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600 focus:border-blue-300'}`}
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
                    const paidAmt = monthFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0) + (Number(f.discount) || 0), 0);
                    
                    // Calculate payable for this specific month
                    const monthPayable = structures.reduce((sum, s) => {
                      const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
                      const isEnabled = setting ? setting.is_enabled : true;
                      const isExpired = s.due_date && s.due_date < today;
                      const isNotStarted = s.start_date && s.start_date > today;
                      const isMonthExpired = s.due_date && monthStr > s.due_date.slice(0, 7);
                      const isMonthNotStarted = s.start_date && monthStr < s.start_date.slice(0, 7);
                      const amountToCharge = setting?.custom_amount !== undefined && setting?.custom_amount !== null ? Number(setting.custom_amount) : Number(s.amount);
                      return (isEnabled && !isExpired && !isMonthExpired && !isNotStarted && !isMonthNotStarted) ? sum + amountToCharge : sum;
                    }, 0);

                    let status = 'unpaid';
                    if (monthPayable > 0) {
                      if (paidAmt >= monthPayable) status = 'paid';
                      else if (paidAmt > 0) status = 'partial';
                    } else {
                      status = paidAmt > 0 ? 'paid' : 'unpaid';
                    }

                  return (
                    <div key={monthStr} className={`relative p-5 rounded-3xl border transition-all hover:scale-[1.02] ${status === 'paid' ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100') : status === 'partial' ? (isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-100') : (isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-[11px] font-black ${status === 'paid' ? 'text-emerald-600' : status === 'partial' ? 'text-orange-600' : 'text-slate-400'}`}>{monthName}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${status === 'paid' ? 'bg-emerald-500 text-white' : status === 'partial' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                        {paidAmt > 0 && <span className={`text-[10px] font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>৳{paidAmt}</span>}
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
                          <span className="text-[9px] font-bold text-slate-400">{new Date(entry.transaction_date.replace(/-/g, '/')).toLocaleDateString('bn-BD')}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed line-clamp-2">{entry.description}</p>
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
    </div>
  );
};

export default StudentAccountingDetail;
