import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class } from 'types';
import { Loader2, Plus, X, DollarSign, Tag, CheckCircle2, Download, ChevronDown, RefreshCw, AlertCircle, Info, Users, HandHeart, Bell } from 'lucide-react';
import { sortMadrasahClasses } from 'pages/Classes';
import { generateClassFeeReportPDF, generateFeeReceiptPDF } from '../../utils/pdfGenerator';

interface QawmiFeeEngineProps {
  activeTab: 'fees' | 'structures';
  madrasah: Institution;
  lang: 'en' | 'bn';
  classes: Class[];
  onStudentClick?: (student: any) => void;
  role?: string;
  profile?: any;
}

export const QawmiFeeEngine: React.FC<QawmiFeeEngineProps> = ({ activeTab, madrasah, lang, classes: initialClasses, onStudentClick, role, profile }) => {
  const [classes, setClasses] = useState<Class[]>(initialClasses || []);
  const [feesReport, setFeesReport] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Fee Collection State
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [anyStudentsInMadrasah, setAnyStudentsInMadrasah] = useState<boolean | null>(null);
  
  // Collection Modal State
  const [showFeeCollection, setShowFeeCollection] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [availableFeeItems, setAvailableFeeItems] = useState<any[]>([]);
  const [selectedFeeCategories, setSelectedFeeCategories] = useState<string[]>([]);
  const [paidFeeCategories, setPaidFeeCategories] = useState<string[]>([]);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<any>(null);
  const [studentFeeHistory, setStudentFeeHistory] = useState<any[]>([]);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear().toString());

  // Structure State
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, [madrasah.id]);

  useEffect(() => {
    fetchData();
  }, [madrasah.id, activeTab, selectedMonth, selectedClass]);

  useEffect(() => {
    if (selectedStudent) {
      initializeFeeCollection(selectedStudent);
    }
  }, [selectedStudent]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter((cls: any) => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'fees') {
        const classId = selectedClass === '' ? null : selectedClass;
        
        const { data: feeStructures } = await supabase.from('fee_structures')
            .select('*')
            .eq('institution_id', madrasah.id);

        const { data: feesData } = await supabase.from('fees')
            .select('student_id, amount_paid, discount')
            .eq('institution_id', madrasah.id)
            .eq('month', selectedMonth);

        // For Qawmi, we might use a different report or the same one but interpret it differently
        // Using the same report for now as a base
        const { data, error } = await supabase.rpc('get_monthly_dues_report', {
          p_institution_id: madrasah.id,
          p_class_id: classId,
          p_month: selectedMonth
        });
        
        if (error) throw error;

        let filteredData = data || [];
        if (role === 'teacher' && profile?.permissions?.allowed_classes && !classId) {
          filteredData = data.filter((student: any) => profile.permissions?.allowed_classes?.includes(student.class_id));
        }

        const correctedData = filteredData.map((student: any) => {
            const studentFeeStructures = feeStructures?.filter(fs => fs.class_id === student.class_id || fs.class_id === null) || [];
            const totalPayable = studentFeeStructures.reduce((sum, fs) => sum + Number(fs.amount), 0);
            
            const studentFees = feesData?.filter(f => f.student_id === student.student_id) || [];
            const totalPaid = studentFees.reduce((sum, f) => sum + Number(f.amount_paid) + Number(f.discount || 0), 0);
            
            const balanceDue = Math.max(0, totalPayable - totalPaid);
            
            let status = 'unpaid';
            if (totalPayable <= 0) status = 'no_fee';
            else if (totalPaid >= totalPayable) status = 'paid';
            else if (totalPaid > 0) status = 'partial';

            return {
                ...student,
                total_payable: totalPayable,
                total_paid: totalPaid,
                balance_due: balanceDue,
                status: status
            };
        });

        setFeesReport(correctedData || []);

        if (!data || data.length === 0) {
          let checkQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
          if (classId) checkQuery = checkQuery.eq('class_id', classId);
          const { count } = await checkQuery;
          setAnyStudentsInMadrasah(count && count > 0 ? true : false);
        } else {
          setAnyStudentsInMadrasah(true);
        }
      }

      if (activeTab === 'structures') {
        const { data } = await supabase.from('fee_structures').select('*, classes(class_name)').eq('institution_id', madrasah.id);
        if (data) setStructures(data || []);
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
    
    // 1. Fetch structures
    const { data: structures } = await supabase.from('fee_structures')
      .select('*')
      .eq('institution_id', madrasah.id)
      .or(`class_id.eq.${student.class_id},class_id.is.null`);
    if (!structures) {
        setAvailableFeeItems([]);
        return;
    }
    
    // Fetch student fee settings
    const { data: settings } = await supabase.from('student_fee_settings')
      .select('*')
      .eq('student_id', student.student_id);
    
    const enabledStructures = structures.filter(s => {
        const setting = settings?.find(set => set.fee_structure_id === s.id);
        return setting ? setting.is_enabled : true;
    });
    setAvailableFeeItems(enabledStructures);

    // 2. Fetch ledger entries for this student/month to see what's paid
    const { data: ledgerData } = await supabase.from('ledger')
      .select('description')
      .eq('institution_id', madrasah.id)
      .eq('type', 'income')
      .eq('category', 'Student Fee')
      .ilike('description', `%${student.student_name} (%Month: ${selectedMonth})%`);

    const paidItems: string[] = [];
    ledgerData?.forEach(l => {
        const desc = l.description.split(' - ')[0];
        if (desc) {
            desc.split(', ').forEach(item => paidItems.push(item));
        }
    });
    setPaidFeeCategories(paidItems);

    // 3. Select unpaid items
    const unpaid = structures.filter(s => !paidItems.includes(s.fee_name));
    const unpaidNames = unpaid.map(s => s.fee_name);
    setSelectedFeeCategories(unpaidNames);
    
    // 4. Set initial amount
    const total = unpaid.reduce((sum, s) => sum + s.amount, 0);
    setCollectAmount(total > 0 ? total.toString() : '');
  };

  const calculateTotal = (categories: string[], discountVal: string, items = availableFeeItems, monthsCount = 1) => {
    const gross = items
        .filter(item => categories.includes(item.fee_name))
        .reduce((sum, item) => sum + item.amount, 0) * monthsCount;
    
    const disc = parseFloat(discountVal) || 0;
    const net = Math.max(0, gross - disc);
    return net > 0 ? net.toString() : '';
  };

  const handleCollectFee = async () => {
    if (!selectedStudent || !collectAmount) return;
    setIsSaving(true);
    try {
      const totalAmt = parseFloat(collectAmount);
      const totalDiscount = parseFloat(discount) || 0;
      
      const feeData = {
        institution_id: madrasah.id,
        student_id: selectedStudent.student_id,
        class_id: selectedStudent.class_id,
        amount_paid: totalAmt,
        month: selectedMonth,
        status: (Number(selectedStudent.total_paid) + totalAmt + totalDiscount) >= Number(selectedStudent.total_payable) ? 'paid' : 'partial'
      };

      // Try inserting with discount first
      let { error: feeErr } = await supabase.from('fees').insert({
        ...feeData,
        discount: totalDiscount
      });
      
      // If error is about missing column, retry without discount
      if (feeErr && (feeErr.message.includes('column') || feeErr.code === '42703')) {
          const { error: retryErr } = await supabase.from('fees').insert(feeData);
          feeErr = retryErr;
      }
      
      if (feeErr) throw feeErr;

      // Add to Ledger
      const feeDescription = selectedFeeCategories.join(', ');
      const className = classes.find(c => c.id === selectedStudent.class_id)?.class_name || '';
      const roll = selectedStudent.roll || '-';
      
      await supabase.from('ledger').insert({
        institution_id: madrasah.id,
        type: 'income',
        amount: totalAmt,
        category: 'Student Fee',
        description: `${feeDescription} - ${selectedStudent.student_name} (${className} | Roll: ${roll} | Month: ${selectedMonth})${totalDiscount > 0 ? ` (ছাড়: ৳${totalDiscount})` : ''}`,
        transaction_date: new Date().toISOString().split('T')[0]
      });

      setShowFeeCollection(false);
      setCollectAmount('');
      setDiscount('');
      setSelectedStudent(null);
      fetchData();
    } catch (err: any) { 
      setActionError(err.message); 
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
    const { data } = await supabase.from('fees')
      .select('*')
      .eq('student_id', studentId)
      .like('month', `${year}-%`);
    setStudentFeeHistory(data || []);
  };

  useEffect(() => {
      if (historyStudent) {
          fetchStudentHistory(historyStudent.student_id, historyYear);
      }
  }, [historyYear]);

  const handleDownloadClassReport = async (downloadLang: 'en' | 'bn' = lang) => {
    setIsDownloading(true);
    try {
      const className = classes.find(c => c.id === selectedClass)?.class_name || 'All Classes';
      await generateClassFeeReportPDF(
          className,
          selectedMonth,
          feesReport,
          { name: madrasah.name },
          downloadLang
      );
    } catch (error) {
      console.error("Download Error:", error);
      setActionError("রিপোর্ট ডাউনলোড করতে সমস্যা হয়েছে।");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadReceipt = async (student: any, downloadLang: 'en' | 'bn' = lang) => {
    setIsDownloading(true);
    try {
      const className = classes.find(c => c.id === student.class_id)?.class_name || '';
      await generateFeeReceiptPDF(
          { ...student, class_name: className },
          selectedMonth,
          { name: madrasah.name, address: madrasah.address, phone: madrasah.phone },
          downloadLang
      );
    } catch (error) {
      console.error("Receipt Download Error:", error);
      setActionError("রশিদ ডাউনলোড করতে সমস্যা হয়েছে।");
    } finally {
      setIsDownloading(false);
    }
  };

  if (activeTab === 'fees') {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5 relative">
         {/* Download Indicator */}
         {isDownloading && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-white/90 backdrop-blur-md border border-blue-100 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                    <div className="relative">
                        <Loader2 className="animate-spin text-blue-600" size={20} />
                        <div className="absolute inset-0 bg-blue-400/20 blur-sm rounded-full animate-pulse"></div>
                    </div>
                    <span className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest">ডাউনলোড হচ্ছে...</span>
                </div>
            </div>
         )}

         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-bubble space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
               {/* Class Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group active:scale-[0.98] transition-all">
                     <span className="text-[11px] font-black text-[#1E3A8A] truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'সব জামাত (Classes)'}</span>
                     <ChevronDown size={16} className="text-slate-400 group-hover:text-[#2563EB] transition-colors" />
                  </button>
                  {showClassDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                          <button onClick={() => { setSelectedClass(''); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:text-[#2563EB] transition-colors">সব জামাত</button>
                          {classes.map(c => (
                              <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:text-[#2563EB] transition-colors">{c.class_name}</button>
                          ))}
                      </div>
                  )}
               </div>

               {/* Month Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <input type="month" className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-[#1E3A8A] outline-none focus:border-[#2563EB]/30 transition-all" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
               </div>

               {/* Status Filter */}
               <div className="relative flex-1 min-w-[140px]">
                   <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-[#1E3A8A] outline-none appearance-none focus:border-[#2563EB]/30 transition-all"
                  >
                      <option value="all">সব স্ট্যাটাস</option>
                      <option value="paid">পরিশোধিত (Paid)</option>
                      <option value="partial">আংশিক (Partial)</option>
                      <option value="unpaid">বকেয়া (Unpaid)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16}/>
               </div>

               {/* Download Report Button */}
               <button 
                  onClick={() => {
                      setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadClassReport(l));
                      setShowDownloadLangModal(true);
                  }}
                  disabled={feesReport.length === 0}
                  className="h-11 px-6 bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none"
               >
                  <Download size={16} />
                  রিপোর্ট ডাউনলোড
               </button>
            </div>
         </div>

         {actionError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold shadow-sm mb-4">
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">ত্রুটি!</p>
                  <p className="opacity-70">{actionError}</p>
               </div>
               <button onClick={() => setActionError(null)} className="bg-white p-1.5 rounded-lg border border-red-200 text-red-600 active:scale-95"><X size={14}/></button>
            </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 col-span-full">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
              </div>
            ) : feesReport.length > 0 ? (
                feesReport.filter((item: any) => {
                    // Qawmi logic might be different, but using standard for now
                    const isFullyPaid = Number(item.balance_due) <= 0 && Number(item.total_payable) > 0;
                    const isPartial = Number(item.balance_due) > 0 && Number(item.total_paid) > 0;
                    const isUnpaid = Number(item.total_paid) === 0 && Number(item.total_payable) > 0;

                    if (statusFilter === 'paid') return isFullyPaid;
                    if (statusFilter === 'partial') return isPartial;
                    if (statusFilter === 'unpaid') return isUnpaid;
                    return true;
                }).map((item: any) => {
                  const balance = Number(item.balance_due) || 0;
                  const payable = Number(item.total_payable) || 0;
                  const paid = Number(item.total_paid) || 0;

                  const isFullyPaid = balance <= 0 && payable > 0;
                  const isNoFeeSet = payable === 0;
                  const hasBalance = balance > 0;
                  
                  return (
                  <div key={item.student_id} className="bg-white p-4 rounded-[1.8rem] border border-slate-100 shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all">
                     <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center font-black shrink-0 ${isFullyPaid ? 'bg-emerald-50 text-emerald-500' : hasBalance ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-[#2563EB]'}`}>
                           {item.roll || '-'}
                        </div>
                        <div className="min-w-0">
                           <h5 
                             className="font-black text-[#1E3A8A] font-noto truncate leading-tight mb-1 cursor-pointer hover:underline decoration-2 underline-offset-2"
                             onClick={() => onStudentClick ? onStudentClick(item) : handleShowHistory(item)}
                           >
                             {item.student_name}
                           </h5>
                           <div className="flex items-center gap-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">জমা: ৳{paid}</p>
                              <p className="text-[10px] text-red-400 font-bold uppercase">বকেয়া: ৳{Math.max(0, balance)}</p>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <button 
                          onClick={() => {
                              setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadReceipt(item, l));
                              setShowDownloadLangModal(true);
                          }}
                          className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-[#2563EB] transition-all active:scale-90 border border-slate-100"
                          title="রশিদ ডাউনলোড করুন"
                       >
                          <Download size={18} />
                       </button>
                       <button 
                          onClick={() => { setSelectedStudent(item); setCollectAmount(''); setShowFeeCollection(true); }} 
                          disabled={isFullyPaid || isNoFeeSet}
                          className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${isFullyPaid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : isNoFeeSet ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : hasBalance ? 'bg-orange-500 text-white active:scale-95 shadow-orange-200' : 'bg-[#2563EB] text-white active:scale-95'}`}
                       >
                          {isFullyPaid ? 'PAID' : 'জমা নিন'}
                       </button>
                     </div>
                  </div>
                )})
            ) : !fetchError && (
              <div className="text-center py-16 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 mx-2 px-6 flex flex-col items-center col-span-full">
                 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-200 mb-5">
                    {anyStudentsInMadrasah ? <Info size={32} /> : <Users size={32} />}
                 </div>
                 <h3 className="text-[#1E293B] text-lg font-black font-noto leading-tight">
                   {anyStudentsInMadrasah ? 'কোনো ডাটা পাওয়া যায়নি' : 'কোনো ছাত্র পাওয়া যায়নি'}
                 </h3>
              </div>
            )}
         </div>

         {/* COLLECT FEE MODAL */}
         {/* Modals */}
      {showDownloadLangModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1001] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6 shadow-sm">
                      <Download size={32} strokeWidth={2.5} />
                  </div>
                  
                  <h3 className="text-xl font-black text-[#1E3A8A] mb-2 text-center font-noto">ভাষা নির্বাচন করুন</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-8 tracking-widest">Select PDF Language</p>
                  
                  <div className="space-y-3">
                      <button 
                          onClick={async () => {
                              if (downloadAction) {
                                  setShowDownloadLangModal(false);
                                  await downloadAction('bn');
                              }
                          }}
                          className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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
                          className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                          <span className="text-sm">English</span>
                      </button>
                      
                      <button 
                          onClick={() => setShowDownloadLangModal(false)}
                          className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-2xl hover:bg-slate-100 active:scale-[0.98] transition-all mt-4"
                      >
                          বাতিল (Cancel)
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showFeeCollection && selectedStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
                <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[80vh] shadow-2xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-[#1E3A8A] font-noto">কওমি ফি / অনুদান</h3>
                        <button onClick={() => setShowFeeCollection(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ছাত্রের নাম</p>
                        <h4 className="text-xl font-black text-[#1E3A8A] font-noto">{selectedStudent.student_name}</h4>
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                              <p className="text-[7px] font-black text-slate-400 uppercase"> প্রদেয় </p>
                              <p className="font-black text-blue-600 text-sm">৳{selectedStudent.total_payable}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                              <p className="text-[7px] font-black text-slate-400 uppercase"> পরিশোধিত </p>
                              <p className="font-black text-green-600 text-sm">৳{selectedStudent.total_paid}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                              <p className="text-[7px] font-black text-slate-400 uppercase"> বকেয়া </p>
                              <p className="font-black text-red-600 text-sm">৳{Math.max(0, Number(selectedStudent.balance_due))}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ফি-র ধরণ (Fee Type)</label>
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-h-40 overflow-y-auto">
                                <div className="space-y-2">
                                    {availableFeeItems.length > 0 ? (
                                        availableFeeItems.map(item => {
                                            const isPaid = paidFeeCategories.includes(item.fee_name);
                                            const isSelected = selectedFeeCategories.includes(item.fee_name);
                                            
                                            return (
                                                <div key={item.id} className={`flex flex-col gap-2 p-3 rounded-xl transition-colors ${isPaid ? 'bg-emerald-50' : 'bg-white border border-slate-100'}`}>
                                                    <label className={`flex items-center gap-3 cursor-pointer`}>
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected || isPaid ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'} ${isPaid ? 'opacity-50' : ''}`}>
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
                                                            <span className={`text-xs font-black ${isPaid ? 'text-emerald-600' : 'text-[#1E3A8A]'}`}>
                                                                {item.fee_name} {isPaid && '(পরিশোধিত)'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">৳{item.amount}</span>
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
                              <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0.00" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
                              <DollarSign className="absolute left-4 top-4 text-[#2563EB]" size={20}/>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ছাড় / ডিসকাউন্ট (যদি থাকে)</label>
                            <div className="relative">
                              <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-orange-500/20" placeholder="0.00" value={discount} onChange={(e) => {
                                  setDiscount(e.target.value);
                                  setCollectAmount(calculateTotal(selectedFeeCategories, e.target.value, availableFeeItems));
                              }} />
                              <Tag className="absolute left-4 top-4 text-orange-500" size={20}/>
                            </div>
                        </div>
                        <button onClick={handleCollectFee} disabled={isSaving || !collectAmount} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                            {isSaving ? <Loader2 className="animate-spin" /> : <><HandHeart size={20}/> জমা নিন</>}
                        </button>
                    </div>
                </div>
            </div>
         )}

         {/* HISTORY MODAL */}
         {showHistoryModal && historyStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
                <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[90vh] shadow-2xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-[#1E3A8A] font-noto">ফি হিস্ট্রি</h3>
                        <button onClick={() => setShowHistoryModal(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                    </div>
                    
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-3xl border border-slate-100">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ছাত্রের নাম</p>
                            <h4 className="text-lg font-black text-[#1E3A8A] font-noto">{historyStudent.student_name}</h4>
                        </div>
                        <div className="w-32">
                            <select 
                                value={historyYear}
                                onChange={(e) => setHistoryYear(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-[#1E3A8A] outline-none"
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
                            let totalPaid = 0;
                            
                            const studentFeeStructures = availableFeeItems.filter(fs => fs.class_id === historyStudent.class_id || fs.class_id === null);
                            const totalPayable = studentFeeStructures.reduce((sum, fs) => sum + Number(fs.amount), 0);

                            if (recordsForMonth.length > 0) {
                                totalPaid = recordsForMonth.reduce((sum, r) => sum + (Number(r.amount_paid) || 0) + (Number(r.discount) || 0), 0);
                                if (totalPaid >= totalPayable && totalPayable > 0) status = 'paid';
                                else if (totalPaid > 0) status = 'partial';
                                else status = 'unpaid';
                            }

                            return (
                                <div key={monthStr} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${status === 'paid' ? 'bg-emerald-50 border-emerald-100' : status === 'partial' ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <span className={`text-sm font-black ${status === 'paid' ? 'text-emerald-700' : status === 'partial' ? 'text-orange-700' : 'text-slate-500'}`}>
                                        {monthName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${status === 'paid' ? 'bg-emerald-200 text-emerald-800' : status === 'partial' ? 'bg-orange-200 text-orange-800' : 'bg-slate-200 text-slate-600'}`}>
                                        {status === 'paid' ? 'পরিশোধিত' : status === 'partial' ? 'আংশিক' : 'বকেয়া'}
                                    </span>
                                    {totalPaid > 0 && (
                                        <span className="text-xs font-bold text-slate-600 mt-1">৳{totalPaid}</span>
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
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold shadow-sm mb-4">
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">ত্রুটি!</p>
                  <p className="opacity-70">{actionError}</p>
               </div>
               <button onClick={() => setActionError(null)} className="bg-white p-1.5 rounded-lg border border-red-200 text-red-600 active:scale-95"><X size={14}/></button>
            </div>
         )}
         <button onClick={() => setShowAddStructure(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#2563EB] font-black flex items-center justify-center gap-3 shadow-bubble active:scale-95 transition-all border border-slate-100">
            <Plus size={24} strokeWidth={3} /> নতুন ফি/অনুদান খাত যোগ করুন
         </button>
         <div className="space-y-3">
            {structures.length > 0 ? structures.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                 <div className="min-w-0">
                    <h5 className="font-black text-[#1E3A8A] font-noto text-[17px] truncate">{s.fee_name}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">{s.classes?.class_name}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="text-2xl font-black text-[#2563EB] shrink-0">৳{s.amount}</div>
                     {deleteConfirmId === s.id ? (
                         <div className="flex items-center gap-2">
                             <button onClick={async () => {
                                 const { error } = await supabase.from('fee_structures').delete().eq('id', s.id);
                                 if (error) {
                                     console.error("Delete Error:", error);
                                     setActionError("ডিলিট করতে সমস্যা হয়েছে: " + error.message);
                                 } else {
                                     fetchData();
                                 }
                                 setDeleteConfirmId(null);
                             }} className="bg-red-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-black">নিশ্চিত</button>
                             <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-600 text-[10px] px-3 py-1.5 rounded-lg font-black">বাতিল</button>
                         </div>
                     ) : (
                         <button onClick={() => setDeleteConfirmId(s.id)} className="p-2 text-red-300 hover:text-red-500"><X size={18}/></button>
                     )}
                 </div>
              </div>
            )) : (
              <div className="text-center py-20 text-slate-400 uppercase text-xs font-black">কোনো ফি স্ট্রাকচার সেট করা নেই</div>
            )}
         </div>

         {/* ADD STRUCTURE MODAL */}
         {showAddStructure && (
           <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 shadow-2xl relative">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-black text-[#1E3A8A]">ফি/অনুদান সেটআপ</h3>
                   <button onClick={() => setShowAddStructure(false)} className="w-9 h-9 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><X size={20} /></button>
                 </div>
                 <div className="space-y-4">
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">জামাত (Class) (ঐচ্ছিক)</label>
                       <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-14 px-6 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center justify-between font-black text-[#1E3A8A]">
                          <span className="truncate">{classes.find(c => c.id === selectedClass)?.class_name || 'সব জামাত (All Classes)'}</span>
                          <ChevronDown size={20} className="text-slate-300" />
                       </button>
                       {showClassDropdown && (
                           <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1001] p-2 max-h-48 overflow-y-auto">
                               <button onClick={() => { setSelectedClass(''); setShowClassDropdown(false); }} className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 font-black text-[#1E3A8A]">সব জামাত (All Classes)</button>
                               {classes.map(c => (
                                   <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 font-black text-[#1E3A8A]">{c.class_name}</button>
                               ))}
                           </div>
                       )}
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">খাতের নাম</label>
                       <input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="যেমন: খোরাকি" value={category} onChange={(e) => setCategory(e.target.value)} />
                       <Tag className="absolute left-4 top-[44px] text-slate-300" size={20}/>
                       <div className="flex flex-wrap gap-2 mt-2 px-1">
                          {['মাসিক ফি', 'বোর্ডিং / খাওয়ার খরচ', 'কিতাব / বই ফি', 'পরীক্ষা ফি', 'জামা / লিবাস ফি', 'বিদ্যুৎ / পানি ফি'].map(suggestion => (
                             <button 
                                key={suggestion}
                                type="button"
                                onClick={() => setCategory(suggestion)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${category === suggestion ? 'bg-blue-50 text-[#2563EB] border-[#2563EB]/20' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                             >
                                {suggestion}
                             </button>
                          ))}
                       </div>
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">ধার্যকৃত টাকা (Optional)</label>
                       <input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent focus:border-[#2563EB]/20" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                       <DollarSign className="absolute left-4 top-[44px] text-[#2563EB]" size={20}/>
                    </div>
                    
                    <button onClick={async () => {
                       if (!category) return;
                       setIsSaving(true);
                       try {
                           const { error } = await supabase.from('fee_structures').insert({
                               institution_id: madrasah.id,
                               class_id: selectedClass || null,
                               fee_name: category,
                               amount: parseFloat(amount) || 0
                           });
                           if (error) throw error;
                           setShowAddStructure(false);
                           setCategory(''); setAmount(''); setSelectedClass('');
                           fetchData();
                       } catch (e: any) { setActionError(e.message); } finally { setIsSaving(false); }
                    }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all text-base">
                       {isSaving ? <Loader2 className="animate-spin" /> : 'সেভ করুন'}
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
