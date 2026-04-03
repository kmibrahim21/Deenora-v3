
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, LedgerEntry, Language, UserRole, Class, Profile } from 'types';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Loader2, Save, X, DollarSign, Tag, FileText, RefreshCw, Bell, Heart, Users, BarChart3, AlertCircle } from 'lucide-react';
import SmartFeeAnalytics from 'components/SmartFeeAnalytics';
import { SchoolFeeEngine } from 'components/finance/SchoolFeeEngine';
import { QawmiFeeEngine } from 'components/finance/QawmiFeeEngine';
import StudentAccountingDetail from 'components/finance/StudentAccountingDetail';
import { sortMadrasahClasses } from 'pages/Classes';

interface AccountingProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const Accounting: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role, profile }) => {
  const isTeacher = role === 'teacher';
  const canManageAccounting = !isTeacher || profile?.permissions?.can_manage_accounting;

  if (!canManageAccounting) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'fees' | 'structures' | 'add-ledger'>('fees');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Ledger State
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');

  const feeEngine = madrasah?.config_json?.fee_engine || 'school';

  useEffect(() => {
    if (madrasah) {
      fetchData();
      fetchClasses();
    }
  }, [madrasah?.id, activeTab]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchData = async () => {
    if (!madrasah?.id) return;
    
    if (activeTab === 'summary' || activeTab === 'ledger') {
      setLoading(true);
      try {
        const { data } = await supabase.from('ledger').select('*').eq('institution_id', madrasah.id).order('transaction_date', { ascending: false });
        if (data) setLedger(data);
        setRefreshKey(prev => prev + 1);
      } catch (e: any) { 
        console.error("Accounting Fetch Error:", e);
      } finally { setLoading(false); }
    }
  };

  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ledger').insert({
        institution_id: madrasah.id,
        type: type,
        amount: parseFloat(amount),
        category: category.trim(),
        description: desc.trim(),
        transaction_date: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      setAmount(''); setCategory(''); setDesc('');
      setActiveTab('ledger');
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const isDark = madrasah?.theme === 'dark';

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
            <h1 className={`text-lg font-black font-noto leading-none ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>ফি ও হিসাব</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">অ্যাকাউন্টিং এবং ফি</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => fetchData()} 
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-200'} ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={16}/>
            </button>
            <button 
              onClick={() => setActiveTab('summary')} 
              className={`px-4 h-10 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-xs font-black uppercase tracking-widest border ${activeTab === 'summary' ? (isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-[#2563EB] border-blue-100') : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}
            >
              <BarChart3 size={18}/>
              <span className="hidden sm:inline">ড্যাশবোর্ড</span>
            </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="px-1">
        <div className={`flex p-1.5 rounded-[2rem] border overflow-x-auto no-scrollbar gap-1 ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-100/80 border-slate-200/50'}`}>
          <button 
            onClick={() => setActiveTab('fees')} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'fees' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            শিক্ষার্থী ফি
          </button>
          <button 
            onClick={() => setActiveTab('structures')} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'structures' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            ফি সেটিংস
          </button>
          <button 
            onClick={() => setActiveTab('add-ledger')} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'add-ledger' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            লেনদেন
          </button>
          <button 
            onClick={() => setActiveTab('ledger')} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'ledger' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50' : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
          >
            ইতিহাস
          </button>
        </div>
      </div>

      {selectedStudentForDetail ? (
        <StudentAccountingDetail 
          student={selectedStudentForDetail}
          madrasah={madrasah!}
          lang={lang}
          classes={classes}
          onBack={() => setSelectedStudentForDetail(null)}
        />
      ) : (
        <>
          {(activeTab === 'fees' || activeTab === 'structures') && madrasah && (
            <>
              {feeEngine === 'school' && (
                <SchoolFeeEngine activeTab={activeTab} madrasah={madrasah} lang={lang} classes={classes} onStudentClick={(student) => setSelectedStudentForDetail(student)} role={role} profile={profile} />
              )}
              {feeEngine === 'qawmi' && (
                <QawmiFeeEngine activeTab={activeTab} madrasah={madrasah} lang={lang} classes={classes} onStudentClick={(student) => setSelectedStudentForDetail(student)} role={role} profile={profile} />
              )}
              {/* Default to School Engine for others for now */}
              {feeEngine !== 'school' && feeEngine !== 'qawmi' && (
                <SchoolFeeEngine activeTab={activeTab} madrasah={madrasah} lang={lang} classes={classes} onStudentClick={(student) => setSelectedStudentForDetail(student)} role={role} profile={profile} />
              )}
            </>
          )}
          
          {activeTab === 'summary' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-5">
          <div className={`rounded-[2.5rem] p-1 border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white/40 border-white/20'} backdrop-blur-sm`}>
            {madrasah && (
              <SmartFeeAnalytics 
                institutionId={madrasah.id} 
                lang={lang} 
                month={new Date().toISOString().slice(0, 7)} 
                refreshKey={refreshKey}
                classes={classes}
                madrasah={madrasah}
                role={role}
                profile={profile}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>লেনদেনের ইতিহাস</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{ledger.length} লেনদেন</span>
            </div>
            
            <div className={`flex p-1 rounded-xl border shadow-inner w-fit ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
              <button 
                onClick={() => setLedgerFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${ledgerFilter === 'all' ? (isDark ? 'bg-slate-900 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}
              >
                ইতিহাস
              </button>
              <button 
                onClick={() => setLedgerFilter('income')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${ledgerFilter === 'income' ? (isDark ? 'bg-slate-900 text-emerald-400 shadow-sm' : 'bg-white text-emerald-500 shadow-sm') : 'text-slate-400'}`}
              >
                আয়
              </button>
              <button 
                onClick={() => setLedgerFilter('expense')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${ledgerFilter === 'expense' ? (isDark ? 'bg-slate-900 text-red-400 shadow-sm' : 'bg-white text-red-500 shadow-sm') : 'text-slate-400'}`}
              >
                ব্যয়
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#2563EB]" size={32} /></div>
          ) : ledger.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {ledger.filter(e => ledgerFilter === 'all' || e.type === ledgerFilter).map(entry => {
                let displayName = entry.category;
                let details = '';
                let feeType = '';

                if (entry.category === 'Student Fee') {
                  const parts = entry.description.split(' - ');
                  if (parts.length >= 2) {
                    feeType = parts[0];
                    const namePart = parts.slice(1).join(' - ');
                    const nameMatch = namePart.match(/^(.*?)\s*\((.*?)\)/);
                    if (nameMatch) {
                      displayName = nameMatch[1];
                      details = nameMatch[2];
                    } else {
                      displayName = namePart;
                    }
                  }
                }

                return (
                  <div key={entry.id} className={`group p-5 rounded-[2.5rem] border-2 transition-all flex items-center justify-between shadow-sm hover:shadow-lg active:scale-[0.98] ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-blue-100'}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 shadow-inner border transition-transform group-hover:scale-110 ${entry.type === 'income' ? (isDark ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (isDark ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-red-50 text-red-600 border-red-100')}`}>
                          {entry.type === 'income' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                        </div>
                        <div>
                          <h5 className={`font-black font-noto text-sm mb-0.5 ${isDark ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{displayName}</h5>
                          <div className="flex items-center gap-2">
                            {entry.category === 'Student Fee' ? (
                              <>
                                <span className="text-[10px] text-slate-400 font-bold">{details}</span>
                                <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                <span className="text-[9px] text-blue-500 font-black uppercase tracking-tighter">{feeType}</span>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">{new Date(entry.transaction_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black ${entry.type === 'income' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                          {entry.type === 'income' ? '+' : '-'} ৳{entry.amount.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest">{entry.category}</p>
                      </div>
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
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">কোনো লেনদেন পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'add-ledger' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-5 max-w-2xl mx-auto px-2">
          <div className={`rounded-[3rem] p-8 space-y-8 border shadow-xl ${isDark ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-white/20 shadow-blue-900/5'} backdrop-blur-sm`}>
             <div>
              <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>লেনদেন করুন</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">নতুন লেনদেন যোগ করুন</p>
             </div>

             <div className={`flex p-1.5 rounded-[1.8rem] border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
                <button 
                  onClick={() => setType('income')} 
                  className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'income' ? (isDark ? 'bg-slate-900 text-emerald-400 shadow-sm border border-slate-700/50' : 'bg-white text-emerald-500 shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  আয় (Income)
                </button>
                <button 
                  onClick={() => setType('expense')} 
                  className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all ${type === 'expense' ? (isDark ? 'bg-slate-900 text-red-400 shadow-sm border border-slate-700/50' : 'bg-white text-red-500 shadow-sm border border-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  ব্যয় (Expense)
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
                    placeholder="টাকার পরিমাণ" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                  />
                </div>

                <div className="space-y-3">
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2563EB] transition-colors">
                      <Tag size={20} />
                    </div>
                    <input 
                      type="text" 
                      className={`w-full h-16 rounded-[1.8rem] pl-14 pr-6 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all placeholder:text-slate-300 ${isDark ? 'bg-slate-800 text-slate-100 focus:bg-slate-900' : 'bg-slate-50 text-[#1E293B] focus:bg-white'}`} 
                      placeholder="ক্যাটাগরি (যেমন: বেতন, বিদ্যুৎ)" 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 px-1">
                     {(type === 'income' ? ['সদকা সংগ্রহ', 'লিল্লাহ ফান্ড', 'যাকাত ফান্ড'] : ['রান্না খরচ', 'খাদ্য খরচ', 'শিক্ষক বেতন', 'মাদরাসা maintenance']).map(suggestion => (
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
                    placeholder="বিবরণ" 
                    value={desc} 
                    onChange={(e) => setDesc(e.target.value)} 
                  />
                </div>

                <button 
                  onClick={handleAddLedger} 
                  disabled={isSaving} 
                  className="w-full h-16 bg-[#2563EB] text-white font-black rounded-[1.8rem] shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20}/> সংরক্ষণ করুন</>}
                </button>
             </div>
          </div>
        </div>
      )}
    </>
  )}

  {/* ADD LEDGER MODAL REMOVED */}

      {/* Floating Action Button for New Transaction removed as per request */}
    </div>
  );
};

export default Accounting;
