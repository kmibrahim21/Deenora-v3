import React, { useState, useEffect } from 'react';
import { X, Building2, Plus, Users, GraduationCap, Check, MapPin, Phone, Loader2, ArrowRight, Sparkles, AlertCircle, Trash2, Info, LayoutGrid, ShieldCheck, Mail, Coins, Smartphone, PhoneCall, Send } from 'lucide-react';
import { Institution, Language } from 'types';

interface BranchItem {
  id: string;
  name: string;
  isMain: boolean;
  address: string;
  phone: string;
  contact_email: string;
  institution_type: string;
  studentCount: number;
  teacherCount: number;
  sms_balance?: number;
  balance?: number;
  voice_sender_id?: string;
  voice_rate?: number;
  created_at?: string;
}

interface BranchManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  madrasah: Institution | null;
  lang: Language;
  onSwitchBranch: (branchId: string) => void;
  activeBranchId: string | null;
}

export const BranchManagementModal: React.FC<BranchManagementModalProps> = ({
  isOpen,
  onClose,
  madrasah,
  lang,
  onSwitchBranch,
  activeBranchId
}) => {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [branchName, setBranchName] = useState('');
  const [institutionType, setInstitutionType] = useState<'madrasah' | 'school' | 'kindergarten' | 'choching'>(
    (madrasah?.institution_type as any) || 'madrasah'
  );
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [branchLimit, setBranchLimit] = useState<number>(0);

  // Shared Pool & Allocation State
  const [parentSmsBalance, setParentSmsBalance] = useState<number>(0);
  const [parentVoiceBalance, setParentVoiceBalance] = useState<number>(0);

  const [allocatingBranch, setAllocatingBranch] = useState<BranchItem | null>(null);
  const [allocateSms, setAllocateSms] = useState<string>('0');
  const [allocateVoice, setAllocateVoice] = useState<string>('0');
  const [allocating, setAllocating] = useState<boolean>(false);
  const [allocateError, setAllocateError] = useState<string>('');
  const [allocateSuccess, setAllocateSuccess] = useState<string>('');

  const isDark = madrasah?.theme === 'dark';

  const fetchBranches = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-branches',
          institutionId: madrasah.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch branches');
      setBranches(data.branches || []);
      if (data.branchLimit !== undefined) {
        setBranchLimit(Number(data.branchLimit));
      }
      if (data.sharedSmsBalance !== undefined) setParentSmsBalance(Number(data.sharedSmsBalance));
      if (data.sharedVoiceBalance !== undefined) setParentVoiceBalance(Number(data.sharedVoiceBalance));
    } catch (err: any) {
      console.error('Error fetching branches:', err);
      setError(err.message || 'শাখা তালিকা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingBranch || !madrasah?.id) return;

    const numSms = Math.floor(Number(allocateSms) || 0);
    const numVoice = Number(Number(allocateVoice || 0).toFixed(2));

    if (numSms === 0 && numVoice === 0) {
      setAllocateError(lang === 'bn' ? 'অনুগ্রহ করে সঠিক SMS বা ভয়েস পরিমাণ লিখুন' : 'Please enter a valid SMS or Voice amount');
      return;
    }

    setAllocating(true);
    setAllocateError('');
    setAllocateSuccess('');

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'allocate-balance',
          parent_institution_id: madrasah.id,
          branch_id: allocatingBranch.id,
          sms_amount: numSms,
          voice_amount: numVoice
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to allocate balance');

      setAllocateSuccess(data.message || (lang === 'bn' ? 'ব্যালেন্স বরাদ্দ সফল হয়েছে!' : 'Balance allocated successfully!'));

      setParentSmsBalance(data.parentSms);
      setParentVoiceBalance(data.parentVoice);

      setBranches(prev => prev.map(b => {
        if (b.id === allocatingBranch.id) {
          return { ...b, sms_balance: data.branchSms, balance: data.branchVoice };
        }
        if (b.isMain) {
          return { ...b, sms_balance: data.parentSms, balance: data.parentVoice };
        }
        return b;
      }));

      setTimeout(() => {
        setAllocatingBranch(null);
        setAllocateSms('0');
        setAllocateVoice('0');
        setAllocateSuccess('');
      }, 1500);
    } catch (err: any) {
      console.error('Error allocating balance:', err);
      setAllocateError(err.message || 'ব্যালেন্স বরাদ্দ করতে সমস্যা হয়েছে');
    } finally {
      setAllocating(false);
    }
  };



  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      setShowAddForm(false);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen, madrasah?.id]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে শাখার নাম দিন' : 'Please enter branch name');
      return;
    }
    if (!madrasah?.id) return;

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-branch',
          parent_institution_id: madrasah.id,
          name: branchName.trim(),
          institution_type: institutionType,
          address: address.trim(),
          phone: phone.trim() || madrasah.phone || '',
          email: email.trim() || ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create branch');

      setSuccessMessage(data.message || 'নতুন শাখা সফলভাবে যুক্ত হয়েছে!');
      setBranchName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setShowAddForm(false);
      // Refresh list
      await fetchBranches();
    } catch (err: any) {
      console.error('Error creating branch:', err);
      setError(err.message || 'শাখা তৈরিতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!madrasah?.id) return;
    setDeletingBranchId(branchId);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-branch',
          branch_id: branchId,
          parent_institution_id: madrasah.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'শাখা মুছতে সমস্যা হয়েছে');

      setSuccessMessage(data.message || 'শাখাটি সফলভাবে মুছে ফেলা হয়েছে!');
      setConfirmDeleteId(null);

      // If active branch was deleted, switch back to root
      if (activeBranchId === branchId) {
        onSwitchBranch(madrasah.id);
      }

      await fetchBranches();
    } catch (err: any) {
      console.error('Error deleting branch:', err);
      setError(err.message || 'শাখা মুছতে সমস্যা হয়েছে');
    } finally {
      setDeletingBranchId(null);
    }
  };

  if (!isOpen) return null;

  const currentActiveId = activeBranchId || madrasah?.id;
  const childBranches = branches.filter(b => !b.isMain);
  const mainCampus = branches.find(b => b.isMain);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className={`w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-[3rem] border shadow-2xl overflow-hidden transition-all ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
        }`}
      >
        {/* Modern Header */}
        <div className={`p-6 sm:p-8 border-b flex items-center justify-between shrink-0 relative overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-sm shadow-blue-500/5">
              <Building2 size={24} className="sm:size-28" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-noto tracking-tight">
                {lang === 'bn' ? 'শাখা ও ক্যাম্পাস' : 'Branch Management'}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {lang === 'bn' ? 'একাধিক শাখা পরিচালনা ও সুইচিং' : 'Multi-Campus Control Hub'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'
            }`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Dynamic Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-[1.5rem] bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-start gap-3 text-sm font-bold animate-in slide-in-from-top-2 duration-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-start gap-3 text-sm font-bold animate-in slide-in-from-top-2 duration-300">
              <Check size={18} className="shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Unified Quota & Info Dashboard */}
          <div className={`rounded-[2rem] border overflow-hidden ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/50 border-slate-100 shadow-sm shadow-slate-100/50'
          }`}>
            <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Sparkles size={18} />
                  <span className="font-black text-sm uppercase tracking-wider">{lang === 'bn' ? 'সেন্ট্রাল সিস্টেম' : 'Central System'}</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed font-noto">
                  {lang === 'bn'
                    ? 'সকল শাখার জন্য একটিই কেন্দ্রীয় এসএমএস ও ভয়েস ব্যালেন্স কার্যকর থাকবে। আলাদা রিচার্জ করার ঝামেলা নেই।'
                    : 'Unified SMS & Voice balance across all branches. No separate recharge needed.'}
                </p>
              </div>

              <div className={`p-4 rounded-2xl flex flex-col justify-center gap-2 ${isDark ? 'bg-slate-900/50' : 'bg-white border border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'শাখা কোটা' : 'Branch Quota'}</span>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    branchLimit <= 0 ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {branchLimit <= 0 ? (lang === 'bn' ? 'বন্ধ' : 'Disabled') : (lang === 'bn' ? 'সক্রিয়' : 'Active')}
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2">
                   <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black tabular-nums">{childBranches.length}</span>
                      <span className="text-slate-400 text-xs font-bold">/ {branchLimit > 0 ? branchLimit : 0}</span>
                   </div>
                   <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (childBranches.length / (branchLimit || 1)) * 100)}%` }}
                      ></div>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* New Branch Trigger */}
          {branchLimit > 0 && childBranches.length < branchLimit && !showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setError(''); setSuccessMessage(''); }}
              className="w-full group p-4 sm:p-5 rounded-[2rem] border-2 border-dashed border-blue-500/20 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
                <Plus size={20} strokeWidth={3} />
              </div>
              <span>{lang === 'bn' ? 'নতুন শাখা বা ক্যাম্পাস যুক্ত করুন' : 'Register New Campus'}</span>
            </button>
          )}

          {/* Registration Form */}
          {showAddForm && (
            <form onSubmit={handleCreateBranch} className={`p-6 sm:p-8 rounded-[2.5rem] border space-y-6 animate-in zoom-in-95 duration-300 relative ${
              isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-xl shadow-slate-200/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center"><Plus size={20} /></div>
                   <h3 className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 font-noto">
                     {lang === 'bn' ? 'নতুন শাখার তথ্য দিন' : 'New Campus Details'}
                   </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                    {lang === 'bn' ? 'শাখার নাম (আবশ্যক)' : 'Branch Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'bn' ? 'যেমন: মিরপুর বালিকা শাখা / ক্যাম্পাস ২' : 'e.g. Uttara Branch'}
                    className={`w-full h-14 px-6 rounded-2xl text-sm font-black border outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500'
                    }`}
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{lang === 'bn' ? 'ধরণ' : 'Type'}</label>
                    <select
                      className={`w-full h-14 px-5 rounded-2xl text-sm font-black border outline-none transition-all appearance-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500 shadow-sm shadow-slate-100'
                      }`}
                      value={institutionType}
                      onChange={(e) => setInstitutionType(e.target.value as any)}
                    >
                      <option value="madrasah">মাদ্রাসা (Madrasah)</option>
                      <option value="school">স্কুল (School)</option>
                      <option value="kindergarten">কিন্ডারগার্টেন (Kindergarten)</option>
                      <option value="choching">কোচিং (Coaching)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}</label>
                    <input
                      type="tel"
                      placeholder="01..."
                      className={`w-full h-14 px-6 rounded-2xl text-sm font-black border outline-none transition-all ${
                        isDark 
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500 shadow-sm shadow-slate-100'
                      }`}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{lang === 'bn' ? 'ঠিকানা' : 'Location'}</label>
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? 'এলাকা, জেলা' : 'Area / Address'}
                    className={`w-full h-14 px-6 rounded-2xl text-sm font-black border outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500 shadow-sm shadow-slate-100'
                    }`}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className={`flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] h-14 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  {submitting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={20} strokeWidth={3} />
                      <span>{lang === 'bn' ? 'শাখা সেভ করুন' : 'Confirm & Save'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Campus Hierarchy */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <LayoutGrid size={18} className="text-slate-400" />
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 font-noto">
                  {lang === 'bn' ? 'ক্যাম্পাস ও শাখা তালিকা' : 'Campus Directory'}
                </h4>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {branches.length} TOTAL
              </span>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400 animate-pulse">
                <div className="w-12 h-12 rounded-2xl border-4 border-t-blue-500 border-blue-500/10 animate-spin"></div>
                <span className="text-xs font-black uppercase tracking-widest">{lang === 'bn' ? 'শাখা তালিকা লোড হচ্ছে...' : 'Fetching directory...'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {/* Main Campus Card */}
                {mainCampus && (
                  <CampusCard 
                    branch={mainCampus} 
                    isActive={currentActiveId === mainCampus.id} 
                    isDark={isDark} 
                    lang={lang} 
                    onSwitch={() => { onSwitchBranch(mainCampus.id); onClose(); }} 
                    onDelete={null}
                    isDeleting={false}
                    confirmDeleteId={confirmDeleteId}
                    setConfirmDeleteId={setConfirmDeleteId}
                  />
                )}

                {/* Separator if child branches exist */}
                {childBranches.length > 0 && (
                  <div className="relative py-2 flex items-center gap-4">
                     <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sister Branches</span>
                     <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                  </div>
                )}

                {/* Sister Branches */}
                {childBranches.map((b) => (
                  <CampusCard 
                    key={b.id}
                    branch={b} 
                    isActive={currentActiveId === b.id} 
                    isDark={isDark} 
                    lang={lang} 
                    onSwitch={() => { onSwitchBranch(b.id); onClose(); }} 
                    onDelete={() => handleDeleteBranch(b.id)}
                    onAllocate={() => {
                      setAllocatingBranch(b);
                      setAllocateSms('0');
                      setAllocateVoice('0');
                      setAllocateError('');
                      setAllocateSuccess('');
                    }}
                    isDeleting={deletingBranchId === b.id}
                    confirmDeleteId={confirmDeleteId}
                    setConfirmDeleteId={setConfirmDeleteId}
                  />
                ))}

                {childBranches.length === 0 && !showAddForm && (
                  <div className={`py-12 px-6 text-center rounded-[2.5rem] border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/50'} space-y-4`}>
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                       <Info size={28} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-sm text-slate-600 dark:text-slate-300">
                        {lang === 'bn' ? 'কোনো অতিরিক্ত শাখা এখনও নেই' : 'No Additional Branches'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-bold max-w-[280px] mx-auto leading-relaxed">
                        {lang === 'bn' ? 'আপনার প্রতিষ্ঠানের একাধিক ক্যাম্পাস থাকলে উপরের বাটনে ক্লিক করে যুক্ত করুন।' : 'Add your other campuses to manage them all from a single dashboard.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Premium Footer */}
        <div className={`p-6 border-t flex items-center justify-between shrink-0 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-50 bg-slate-50/30'}`}>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 hidden sm:flex">
             <ShieldCheck size={14} className="text-emerald-500" />
             <span>Secure Multi-Branch Link</span>
          </div>
          <button
            onClick={onClose}
            className={`w-full sm:w-auto px-10 h-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 shadow-lg shadow-black/20' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm shadow-slate-100'
            }`}
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Close Dashboard'}
          </button>
        </div>
      </div>

      {/* Balance Allocation Modal Overlay */}
      {allocatingBranch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-[2.5rem] border shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Coins size={24} />
                </div>
                <div>
                  <h4 className="font-black text-lg tracking-tight">{allocatingBranch.name}</h4>
                  <p className="text-xs font-bold text-slate-400">
                    {lang === 'bn' ? 'এসএমএস ও ভয়েস কল ব্যালেন্স বরাদ্দ / ট্রান্সফার' : 'SMS & Voice Balance Allocation'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAllocatingBranch(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Pool Status */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {lang === 'bn' ? 'মূল প্রতিষ্ঠানে অবশিষ্ট' : 'Main Pool Available'}
                </p>
                <p className="text-xs font-black text-blue-600 dark:text-blue-400">
                  {parentSmsBalance} SMS | ৳ {parentVoiceBalance.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1 border-l border-slate-200 dark:border-slate-700 pl-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {lang === 'bn' ? 'শাখার বর্তমান বরাদ্দ' : 'Branch Current'}
                </p>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {allocatingBranch.sms_balance || 0} SMS | ৳ {(allocatingBranch.balance || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Messages */}
            {allocateError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0" />
                <span>{allocateError}</span>
              </div>
            )}
            {allocateSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-3">
                <Check size={18} className="shrink-0" />
                <span>{allocateSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAllocateBalance} className="space-y-5">
              {/* SMS Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Smartphone size={14} className="text-blue-500" />
                  <span>{lang === 'bn' ? 'বরাদ্দকৃত SMS সংখ্যা (+ দিয়ে যোগ, - দিয়ে ফেরত)' : 'SMS Allocation (+ to add, - to return)'}</span>
                </label>
                <input
                  type="number"
                  step="1"
                  className={`w-full h-14 px-5 rounded-2xl text-base font-black border outline-none transition-all ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
                  }`}
                  value={allocateSms}
                  onChange={(e) => setAllocateSms(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                  {[100, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAllocateSms(String(val))}
                      className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:bg-indigo-500 hover:text-white transition-colors"
                    >
                      +{val} SMS
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <PhoneCall size={14} className="text-emerald-500" />
                  <span>{lang === 'bn' ? 'বরাদ্দকৃত ভয়েস ব্যালেন্স (৳ BDT)' : 'Voice Call Balance (BDT)'}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={`w-full h-14 px-5 rounded-2xl text-base font-black border outline-none transition-all ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
                  }`}
                  value={allocateVoice}
                  onChange={(e) => setAllocateVoice(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                  {[50, 100, 500].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAllocateVoice(String(val))}
                      className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white transition-colors"
                    >
                      +৳ {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAllocatingBranch(null)}
                  className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={allocating}
                  className="flex-[2] h-14 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  {allocating ? <Loader2 size={20} className="animate-spin" /> : (
                    <>
                      <Send size={18} />
                      <span>{lang === 'bn' ? 'বরাদ্দ নিশ্চিত করুন' : 'Confirm Allocation'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface CampusCardProps {
  branch: BranchItem;
  isActive: boolean;
  isDark: boolean;
  lang: Language;
  onSwitch: () => void;
  onDelete: (() => void) | null;
  onAllocate?: (() => void) | null;
  isDeleting: boolean;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
}

const CampusCard: React.FC<CampusCardProps> = ({ 
  branch, isActive, isDark, lang, onSwitch, onDelete, onAllocate, isDeleting, confirmDeleteId, setConfirmDeleteId 
}) => {
  return (
    <div
      className={`group p-5 sm:p-6 rounded-[2rem] border transition-all duration-300 relative ${
        isActive
          ? isDark 
            ? 'bg-blue-600/10 border-blue-500/40 shadow-premium' 
            : 'bg-blue-50/70 border-blue-200 shadow-lg shadow-blue-600/5'
          : isDark 
            ? 'bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50' 
            : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4 min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h5 className="font-black text-base sm:text-lg tracking-tight truncate max-w-[250px]">
              {branch.name}
            </h5>
            <div className="flex items-center gap-1.5">
              {branch.isMain ? (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                  {lang === 'bn' ? 'মূল ক্যাম্পাস' : 'Main'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-widest">
                  {lang === 'bn' ? 'শাখা' : 'Branch'}
                </span>
              )}
              {isActive && (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white shadow-sm uppercase tracking-widest animate-pulse">
                  {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            {branch.address && (
              <div className="flex items-center gap-2 truncate">
                <MapPin size={14} className="text-slate-300 shrink-0" />
                <span className="truncate">{branch.address}</span>
              </div>
            )}
            {branch.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-slate-300 shrink-0" />
                <span>{branch.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-500" />
                  <span className="tabular-nums">{branch.studentCount} {lang === 'bn' ? 'শিক্ষার্থী' : 'Students'}</span>
               </div>
               {!branch.isMain && branch.teacherCount > 0 && (
                 <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                    <GraduationCap size={14} className="text-emerald-500" />
                    <span className="tabular-nums">{branch.teacherCount} {lang === 'bn' ? 'শিক্ষক' : 'Teachers'}</span>
                 </div>
               )}
            </div>
          </div>

          {/* SMS & Voice Balance Pill Badges */}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <div className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 flex items-center gap-1.5 text-xs font-black">
              <Smartphone size={13} className="text-blue-500" />
              <span>{branch.sms_balance || 0} SMS</span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40 flex items-center gap-1.5 text-xs font-black">
              <PhoneCall size={13} className="text-emerald-500" />
              <span>৳ {(branch.balance || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Allocate Balance Button for Sister Branches */}
          {!branch.isMain && onAllocate && (
            <button
              onClick={(e) => { e.stopPropagation(); onAllocate(); }}
              className="px-4 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 text-xs font-black transition-all flex items-center gap-2 active:scale-95"
              title={lang === 'bn' ? 'এসএমএস ও ভয়েস ব্যালেন্স বরাদ্দ করুন' : 'Allocate Balance'}
            >
              <Coins size={16} />
              <span>{lang === 'bn' ? 'বরাদ্দ' : 'Allocate'}</span>
            </button>
          )}



          {isActive ? (
            <div className="px-6 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-2 border border-emerald-500/20 uppercase tracking-widest">
              <Check size={16} strokeWidth={4} />
              <span>{lang === 'bn' ? 'বর্তমান' : 'Active'}</span>
            </div>
          ) : (
            <button
              onClick={onSwitch}
              className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 uppercase tracking-widest group/btn"
            >
              <span>{lang === 'bn' ? 'সুইচ করুন' : 'Switch'}</span>
              <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          {/* Delete Action - only for child branches */}
          {!branch.isMain && onDelete && (
            <div className="relative">
              {confirmDeleteId === branch.id ? (
                <div className="absolute bottom-0 right-0 z-20 flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest px-2 whitespace-nowrap">Delete?</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    disabled={isDeleting}
                    className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black transition-all flex items-center gap-2 active:scale-95"
                  >
                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <span>YES</span>}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black transition-all active:scale-95"
                  >
                    NO
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(branch.id); }}
                  title={lang === 'bn' ? 'শাখাটি মুছে ফেলুন' : 'Delete Branch'}
                  className="w-12 h-12 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all flex items-center justify-center active:scale-90"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
