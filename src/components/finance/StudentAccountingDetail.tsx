
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, Class, LedgerEntry, Fee } from 'types';
import { X, ArrowLeft, Download, Calendar, DollarSign, ArrowUpCircle, FileText, Loader2, TrendingUp, TrendingDown, Clock } from 'lucide-react';

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
      let feesQuery = supabase
        .from('fees')
        .select('*')
        .eq('student_id', student.student_id)
        .like('month', `${selectedYear}-%`);
      
      if (yearStart) {
        feesQuery = feesQuery.gte('created_at', yearStart);
      }

      const { data: feesData } = await feesQuery;
      
      if (feesData) setFees(feesData);

      // 2. Fetch ledger entries mentioning this student
      let ledgerQuery = supabase
        .from('ledger')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('category', 'Student Fee')
        .ilike('description', `%${student.student_name}%`);
      
      if (yearStart) {
        ledgerQuery = ledgerQuery.gte('created_at', yearStart);
      }

      const { data: ledgerData } = await ledgerQuery;
      
      if (ledgerData) setLedgerEntries(ledgerData.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()));

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

  const isDark = madrasah.theme === 'dark';
  const className = classes.find(c => c.id === student.class_id)?.class_name || '';

  const totalPayablePerMonth = structures.reduce((sum, s) => {
    const setting = studentFeeSettings.find(set => set.fee_structure_id === s.id);
    const isEnabled = setting ? setting.is_enabled : true;
    return isEnabled ? sum + Number(s.amount) : sum;
  }, 0);
  const totalPaid = ledgerEntries.reduce((sum, l) => sum + Number(l.amount), 0);
  
  // Calculate total due for the year up to current month
  const currentMonth = new Date().getMonth() + 1;
  const totalPayableYearToDate = totalPayablePerMonth * currentMonth;
  const totalDue = Math.max(0, totalPayableYearToDate - totalPaid);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>{student.student_name}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{className} | রোল: {student.roll || '-'}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={`h-10 px-4 rounded-xl border text-xs font-black outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}
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
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-3xl border shadow-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">মোট প্রদেয়</span>
                </div>
                <p className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>৳{totalPayablePerMonth}</p>
              </div>

              <div className={`p-4 rounded-3xl border shadow-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <DollarSign size={16} />
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">মোট পরিশোধিত</span>
                </div>
                <p className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-emerald-600'}`}>৳{totalPaid}</p>
              </div>

              <div className={`p-4 rounded-3xl border shadow-sm ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                    <TrendingDown size={16} />
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">মোট বকেয়া</span>
                </div>
                <p className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-red-600'}`}>৳{totalDue}</p>
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
                  
                  const monthFee = fees.find(f => f.month === monthStr);
                  const status = monthFee?.status || 'unpaid';
                  const paidAmt = (Number(monthFee?.amount_paid) || 0) + (Number(monthFee?.discount) || 0);

                  return (
                    <div key={monthStr} className={`p-5 rounded-3xl border transition-all hover:scale-[1.02] ${status === 'paid' ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100') : status === 'partial' ? (isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-100') : (isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                      <p className={`text-[11px] font-black mb-2 ${status === 'paid' ? 'text-emerald-600' : status === 'partial' ? 'text-orange-600' : 'text-slate-400'}`}>{monthName}</p>
                      <div className="flex items-center justify-between">
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
                    return (
                      <label key={fee.id} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${isEnabled ? (isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}`}>
                        <div className="flex flex-col">
                          <span className={`text-xs font-black ${isEnabled ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-slate-400'}`}>{fee.fee_name}</span>
                          <span className="text-[10px] font-bold text-slate-400">৳{fee.amount}</span>
                        </div>
                        <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none">
                          <input 
                            type="checkbox" 
                            checked={isEnabled} 
                            onChange={() => toggleFee(fee.id)}
                            className="sr-only"
                          />
                          <span className={`${isEnabled ? 'bg-blue-500' : 'bg-slate-300'} inline-block h-6 w-11 rounded-full transition-colors`} />
                          <span className={`${isEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </div>
                      </label>
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
                          <span className="text-[9px] font-bold text-slate-400">{new Date(entry.transaction_date).toLocaleDateString('bn-BD')}</span>
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
