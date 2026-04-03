
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Loader2, Send, ChevronDown, BookOpen, Users, CheckCircle2, MessageSquare, Plus, Edit3, Trash2, Smartphone, X, Check, History, Zap, AlertTriangle, Clock, Save, AlertCircle, Mic, Info, XCircle } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { SMSTemplate, Language, Institution, Class, Student, Transaction, Profile, UserRole } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';
import { getSmsLengthInfo } from 'utils/smsUtils';
import VoiceBroadcast from './VoiceBroadcast';

interface WalletSMSProps {
  lang: Language;
  madrasah: Institution | null;
  triggerRefresh: () => void;
  dataVersion: number;
  initialTab?: 'templates' | 'bulk-sms' | 'history' | 'recharge';
  role: UserRole;
  profile?: Profile | null;
  onBack: () => void;
}

const WalletSMS: React.FC<WalletSMSProps> = ({ lang, madrasah, triggerRefresh, dataVersion, initialTab, role, profile, onBack }) => {
  const isTeacher = role === 'teacher';
  const canSendSms = !isTeacher || profile?.permissions?.can_send_sms;

  if (!canSendSms) {
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

  const [activeTab, setActiveTab] = useState<'templates' | 'bulk-sms' | 'history' | 'recharge'>(initialTab || 'bulk-sms');
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showTemplateDropdownBulk, setShowTemplateDropdownBulk] = useState(false);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<SMSTemplate | null>(null);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempBody, setTempBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showShortcodes, setShowShortcodes] = useState(false);

  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'ছাত্রের নাম' : 'Student Name' },
    { code: '{father_name}', label: lang === 'bn' ? 'পিতার নাম' : 'Father Name' },
    { code: '{class}', label: lang === 'bn' ? 'শ্রেণী' : 'Class' },
    { code: '{roll}', label: lang === 'bn' ? 'রোল' : 'Roll' },
    { code: '{due_amount}', label: lang === 'bn' ? 'বকেয়া টাকা' : 'Due Amount' },
    { code: '{paid_amount}', label: lang === 'bn' ? 'পরিশোধিত টাকা' : 'Paid Amount' },
    { code: '{month}', label: lang === 'bn' ? 'মাস' : 'Month' },
    { code: '{result_grade}', label: lang === 'bn' ? 'রেজাল্ট গ্রেড' : 'Result Grade' },
    { code: '{exam_name}', label: lang === 'bn' ? 'পরীক্ষার নাম' : 'Exam Name' },
    { code: '{attendance_percentage}', label: lang === 'bn' ? 'উপস্থিতি হার' : 'Attendance %' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },
  ];

  // Error/Status Modal
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'error' | 'balance' | 'success', title: string, message: string}>({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // Recharge Form States
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [rechargePhone, setRechargePhone] = useState('');
  const [rechargeType, setRechargeType] = useState<'sms' | 'voice'>('sms');
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [adminBkash, setAdminBkash] = useState('০১৭৬৬-XXXXXX');
  const [smsRate, setSmsRate] = useState<number>(0.50);
  const [voiceRate, setVoiceRate] = useState<number>(1.00);

  useEffect(() => { 
    if (activeTab === 'templates') fetchTemplates(); 
    if (activeTab === 'bulk-sms') { fetchClasses(); fetchTemplates(); }
    if (activeTab === 'history') fetchSmsHistory();
    if (activeTab === 'recharge') { fetchSystemSettings(); fetchUserTransactions(); }
  }, [activeTab, madrasah?.id, dataVersion]);

  useEffect(() => {
    if (selectedClassId) fetchClassStudents(selectedClassId); else setClassStudents([]);
  }, [selectedClassId]);

  const fetchSystemSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    if (settings.bkash_number) setAdminBkash(settings.bkash_number);
    if (settings.sms_rate) setSmsRate(settings.sms_rate);
    if (settings.voice_rate) setVoiceRate(settings.voice_rate);
  };

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchClassStudents = async (cid: string) => {
    const { data } = await supabase.from('students').select('*').eq('class_id', cid);
    if (data) setClassStudents(data);
  };

  const fetchTemplates = async () => {
    if (!madrasah) return;
    setLoading(true);
    const { data } = await supabase.from('sms_templates').select('*').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setTemplates(data);
    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    if (!madrasah || !tempTitle.trim() || !tempBody.trim()) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await supabase.from('sms_templates').update({ title: tempTitle, body: tempBody }).eq('id', editingId);
      } else {
        await supabase.from('sms_templates').insert({ institution_id: madrasah.id, title: tempTitle, body: tempBody });
      }
      setShowAddModal(false);
      setTempTitle('');
      setTempBody('');
      setEditingId(null);
      fetchTemplates();
    } catch (e: any) { 
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: e.message
      });
    } finally { setIsSaving(false); }
  };

  const handleDeleteTemplate = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      await supabase.from('sms_templates').delete().eq('id', showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      fetchTemplates();
    } catch (e: any) { 
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: e.message
      });
    } finally { setIsDeleting(false); }
  };

  const fetchUserTransactions = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('transactions')
      .select('*')
      .eq('institution_id', madrasah.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setUserTransactions(data);
  };

  const handleRechargeRequest = async () => {
    if (!rechargeAmount || !rechargeTrx || !madrasah) return;
    setRequesting(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: parseInt(rechargeAmount),
        transaction_id: rechargeTrx.trim().toUpperCase(),
        sender_phone: rechargePhone.trim(),
        description: rechargeType === 'sms' ? 'SMS Recharge Request' : 'Voice Recharge Request',
        type: 'credit',
        status: 'pending'
      });
      if (error) throw error;
      setRequestSuccess(true);
      setRechargeAmount('');
      setRechargeTrx('');
      setRechargePhone('');
      fetchUserTransactions();
      setTimeout(() => setRequestSuccess(false), 5000);
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Request Failed',
        message: err.message
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleSendBulk = async () => {
    if (!bulkMessage.trim() || !selectedClassId || classStudents.length === 0 || !madrasah) return;
    setSendingBulk(true);
    try {
      await smsApi.sendBulk(madrasah.id, classStudents, bulkMessage);
      setBulkSuccess(true); 
      setShowSuccessPopup(true);
      setBulkMessage(''); 
      setSelectedClassId('');
      triggerRefresh();
      setTimeout(() => setBulkSuccess(false), 3000);
    } catch (err: any) { 
      const isBalanceError = err.message.toLowerCase().includes('balance');
      setStatusModal({
        show: true,
        type: isBalanceError ? 'balance' : 'error',
        title: isBalanceError ? (lang === 'bn' ? 'ব্যালেন্স শেষ!' : 'Out of Balance!') : (lang === 'bn' ? 'ব্যর্থ' : 'Failed'),
        message: err.message
      });
    } finally { setSendingBulk(false); }
  };

  const handleSendFreeBulk = () => {
    if (!bulkMessage.trim() || classStudents.length === 0) return;
    const phones = classStudents.map(s => s.guardian_phone).join(',');
    const encodedMsg = encodeURIComponent(bulkMessage);
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phones}${separator}body=${encodedMsg}`;
  };

  const getSelectedClassName = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    return cls ? cls.class_name : (lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class');
  };

  const modules = useMemo(() => ({
    sms: true,
    ...(madrasah?.config_json?.modules || {})
  }), [madrasah?.config_json?.modules]);

  const availableTabs = useMemo(() => {
    return (['templates', 'bulk-sms', 'history', 'recharge'] as const).filter(tab => {
      if (tab === 'recharge' && role === 'teacher') return false;
      if (tab === 'templates' || tab === 'bulk-sms' || tab === 'history') return modules.sms !== false;
      return true;
    });
  }, [role, modules.sms]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'bulk-sms');
    }
  }, [availableTabs, activeTab]);

  const fetchSmsHistory = async () => {
    if (!madrasah?.id) return;
    setLoadingHistory(true);
    try {
      const history = await smsApi.getHistory(madrasah.id);
      setSmsHistory(history);
    } catch (err) {
      console.error("Failed to fetch SMS history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchSmsHistory();
    }
  }, [activeTab, madrasah?.id]);

  return (
    <>
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="relative p-1.5 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-sm flex items-center h-16 mb-2">
          <div 
            className="absolute h-[calc(100%-12px)] rounded-[2.5rem] bg-[#2563EB] shadow-md transition-all duration-500 z-0"
            style={{ 
              width: availableTabs.length > 0 ? `calc((100% - 12px) / ${availableTabs.length})` : '0',
              left: availableTabs.length > 0 ? `calc(6px + ${Math.max(0, availableTabs.indexOf(activeTab))} * (100% - 12px) / ${availableTabs.length})` : '0',
            }}
          />
          {availableTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 h-full rounded-[2.5rem] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all z-10 ${activeTab === tab ? 'text-white' : 'text-slate-400'}`}>
              {tab === 'templates' ? <MessageSquare size={16} /> : 
               tab === 'bulk-sms' ? <Send size={16} /> : 
               tab === 'history' ? <History size={16} /> :
               <CreditCard size={16} />}
              <span className="font-noto">
                {tab === 'templates' ? t('templates', lang) : 
                 tab === 'bulk-sms' ? t('bulk_sms', lang) : 
                 tab === 'history' ? t('sms_history', lang) :
                 t('recharge', lang)}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('saved_templates', lang)}</h2>
              <button onClick={() => { setEditingId(null); setTempTitle(''); setTempBody(''); setShowAddModal(true); }} className="bg-[#2563EB] text-white px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-2 active:scale-95 transition-all border border-blue-100 shadow-premium">
                 <Plus size={14} strokeWidth={4} /> {t('new_template', lang)}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
               {loading ? (
                  <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" size={30} /></div>
               ) : templates.length > 0 ? (
                  templates.map(tmp => (
                    <div key={tmp.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble relative group flex flex-col">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB] border border-blue-100 shrink-0">
                                <BookOpen size={18} />
                             </div>
                             <h4 className="font-black text-[#1E3A8A] text-[15px] font-noto line-clamp-1">{tmp.title}</h4>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                             <button onClick={() => { setEditingId(tmp.id); setTempTitle(tmp.title); setTempBody(tmp.body); setShowAddModal(true); }} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center active:scale-90 transition-all"><Edit3 size={14}/></button>
                             <button onClick={() => setShowDeleteConfirm(tmp)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center active:scale-90 transition-all"><Trash2 size={14}/></button>
                          </div>
                       </div>
                       <p className="text-sm font-bold text-slate-500 font-noto leading-relaxed flex-1">{tmp.body}</p>
                    </div>
                  ))
               ) : (
                  <div className="col-span-full text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                     <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_templates', lang)}</p>
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'bulk-sms' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="bg-[#2563EB] p-6 rounded-[2.2rem] shadow-premium border border-blue-100 flex items-center justify-between text-white relative">
               <div className="relative z-10">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">{t('available_sms', lang)}</p>
                 <h3 className="text-4xl font-black flex items-baseline gap-2">{madrasah?.sms_balance || 0}</h3>
               </div>
               <Zap size={40} className="text-white opacity-20" />
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-bubble border border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="space-y-7">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">{t('step_1_class', lang)}</h4>
                    <div className="relative space-y-3">
                      <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                        <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      
                      {selectedClassId && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                          <Users size={16} className="text-[#2563EB]" />
                          <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-wider">
                            {t('total_students', lang)}: {classStudents.length} {t('students_count', lang)}
                          </p>
                        </div>
                      )}

                      {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {classes.map(cls => (
                            <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                              <span className="font-black font-noto">{cls.class_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest px-1">{t('step_2_template', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowTemplateDropdownBulk(!showTemplateDropdownBulk)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen size={18} className="text-[#2563EB]" />
                          <span className="text-base font-black font-noto text-slate-400">{t('template_title', lang)}</span>
                        </div>
                        <ChevronDown className={`text-slate-300 transition-all ${showTemplateDropdownBulk ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showTemplateDropdownBulk && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                          {templates.length > 0 ? templates.map(tmp => (
                            <button key={tmp.id} onClick={() => { setBulkMessage(tmp.body); setShowTemplateDropdownBulk(false); }} className="w-full text-left px-5 py-3.5 rounded-xl mb-1 hover:bg-slate-50">
                              <p className="text-[10px] font-black text-[#2563EB] uppercase mb-0.5">{tmp.title}</p>
                              <p className="text-xs font-bold text-[#1E3A8A] truncate">{tmp.body}</p>
                            </button>
                          )) : (
                            <div className="p-5 text-center text-slate-400 text-xs font-bold">{t('no_templates', lang)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-7 flex flex-col">
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest">{t('step_3_message', lang)}</h4>
                      <button 
                        onClick={() => setShowShortcodes(!showShortcodes)}
                        className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                      >
                        <Info size={12} /> Shortcodes
                      </button>
                    </div>

                    {showShortcodes && (
                      <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 mb-2 animate-in slide-in-from-top-2">
                        <div className="flex flex-wrap gap-1.5">
                          {availableShortcodes.map(sc => (
                            <button
                              key={sc.code}
                              onClick={() => {
                                setBulkMessage(prev => prev + sc.code);
                              }}
                              className="px-2 py-1 bg-white border border-blue-100 rounded-lg text-[10px] font-bold text-[#1E3A8A] hover:bg-blue-100 transition-colors"
                            >
                              {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative flex-1 flex flex-col">
                      <textarea className="w-full flex-1 min-h-[128px] px-5 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] text-[#1E3A8A] font-bold outline-none font-noto resize-none" placeholder={t('sms', lang) + "..."} value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} />
                      <div className="absolute bottom-4 right-5 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm flex gap-2">
                         {(() => {
                            const info = getSmsLengthInfo(bulkMessage);
                            return (
                              <>
                                <span className="text-[10px] font-black text-slate-400">{info.isBangla ? 'Bangla' : 'English'}</span>
                                <span className="text-[10px] font-black text-[#2563EB]">{info.length}/{info.maxAllowed} ({info.parts} SMS)</span>
                              </>
                            );
                         })()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mt-auto">
                    <button onClick={handleSendBulk} disabled={sendingBulk || !bulkMessage.trim() || !selectedClassId || classStudents.length === 0 || getSmsLengthInfo(bulkMessage).parts > 7} className="w-full h-[64px] bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all">
                      {sendingBulk ? <Loader2 className="animate-spin" size={24} /> : bulkSuccess ? (lang === 'bn' ? 'সফল!' : 'Success!') : <><Send size={20} /> {t('send_bulk_sms', lang)}</>}
                    </button>
                    
                    <button onClick={handleSendFreeBulk} disabled={sendingBulk || !bulkMessage.trim() || classStudents.length === 0 || getSmsLengthInfo(bulkMessage).parts > 7} className="w-full h-[54px] bg-slate-800 text-white font-black rounded-full shadow-lg flex items-center justify-center gap-3 text-sm disabled:opacity-40 active:scale-95 transition-all">
                      <Smartphone size={20} /> {t('free_sms_sim', lang)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('sms_history', lang)}</h2>
              <button onClick={fetchSmsHistory} className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-all">
                <History size={14} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
              </button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('date', lang)}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('recipient', lang)}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('message', lang)}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('status', lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center">
                          <Loader2 className="animate-spin text-[#2563EB] mx-auto" size={30} />
                        </td>
                      </tr>
                    ) : smsHistory.length > 0 ? (
                      smsHistory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-700">{new Date(item.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                              <span className="text-[10px] font-bold text-slate-400">{new Date(item.date).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-black text-[#1E3A8A]">{item.recipient}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-500 line-clamp-2 max-w-xs font-noto">{item.message}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {item.status === 'sent' || item.status === 'delivered' ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
                                  <CheckCircle2 size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">{t('sent', lang)}</span>
                                </div>
                              ) : item.status === 'pending' ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                                  <Clock size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">{t('pending', lang)}</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100 w-fit">
                                    <XCircle size={12} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">{t('failed', lang)}</span>
                                  </div>
                                  {item.reason && (
                                    <span className="text-[9px] font-bold text-red-400 px-1">{item.reason}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center">
                          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_history', lang)}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-5 duration-500">
             <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-[3rem] shadow-bubble border space-y-6`}>
                <div className="text-center">
                  <div className={`inline-flex p-3 rounded-2xl mb-3 ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><CreditCard size={32} /></div>
                  <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('recharge_request', lang)}</h3>
                  <p className="text-xs font-bold text-slate-400 font-noto">{t('recharge_desc', lang)}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'} p-4 rounded-[2rem] text-center border relative overflow-hidden`}>
                    <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 relative z-10 ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>SMS Rate</p>
                    <h3 className={`text-xl font-black relative z-10 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{smsRate} ৳</h3>
                  </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'} p-6 rounded-[2.2rem] text-center border relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Smartphone size={60} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 relative z-10 ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>{t('bkash_personal', lang)}</p>
                  <h3 className={`text-3xl font-black relative z-10 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{adminBkash}</h3>
                </div>

                <div className="space-y-4">
                  {requestSuccess && (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 text-emerald-600 text-sm font-black animate-in slide-in-from-top-2">
                       <CheckCircle2 size={20} /> {t('recharge_success_msg', lang)}
                    </div>
                  )}
                  
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('amount', lang)}</label>
                    <input type="number" className={`w-full h-14 px-6 rounded-full font-black text-lg outline-none border-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-blue-500/50'}`} value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('bkash_number', lang)}</label>
                    <input type="tel" className={`w-full h-14 px-6 rounded-full font-black text-lg outline-none border-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-blue-500/50'}`} value={rechargePhone} onChange={(e) => setRechargePhone(e.target.value)} placeholder="017XXXXXXXX" />
                  </div>
                  <div className="space-y-1.5 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TrxID</label>
                    <input type="text" className={`w-full h-14 px-6 rounded-full font-black text-lg uppercase outline-none border-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-blue-500/50'}`} value={rechargeTrx} onChange={(e) => setRechargeTrx(e.target.value)} placeholder="8X23M1..." />
                  </div>
                  <button onClick={handleRechargeRequest} disabled={requesting || !rechargeAmount || !rechargeTrx} className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg mt-4 disabled:opacity-40 active:scale-95 transition-all">
                    {requesting ? <Loader2 className="animate-spin" size={24} /> : t('send_request', lang)}
                  </button>
                </div>
             </div>

             <div className="space-y-4">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 flex items-center gap-2">
                   <History size={12} /> {t('recharge_history', lang)}
                </h2>
                <div className="space-y-2.5">
                  {userTransactions.length > 0 ? userTransactions.map(tr => (
                    <div key={tr.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-[1.8rem] border flex items-center justify-between shadow-bubble`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-[15px] font-black leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{tr.amount} ৳</p>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : tr.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                            {tr.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                           <Clock size={10} className="text-slate-400" />
                           <p className="text-[10px] font-bold text-slate-400">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black text-[#2563EB] uppercase tracking-tighter opacity-60">TrxID: {tr.transaction_id}</p>
                      </div>
                    </div>
                  )) : (
                    <div className={`text-center py-10 rounded-[2.5rem] border border-dashed ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                       <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">No history records</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        )}
      </div>

      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-[0_50px_120px_rgba(0,0,0,0.15)] border border-slate-50 animate-in zoom-in-95 duration-500 relative overflow-hidden">
             
             <div className="relative mb-8">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 shadow-inner relative z-10 transition-all duration-700 ${
                  statusModal.type === 'balance' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                  statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' :
                  'bg-red-50 text-red-500 border-red-100'
                }`}>
                  {statusModal.type === 'balance' ? <Zap size={54} strokeWidth={2.5} fill="currentColor" /> :
                   statusModal.type === 'success' ? <CheckCircle2 size={54} strokeWidth={2.5} /> :
                   <AlertCircle size={54} strokeWidth={2.5} />}
                </div>
                {statusModal.type !== 'success' && (
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-20 mx-auto w-24 h-24 ${statusModal.type === 'balance' ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                )}
             </div>

             <h3 className="text-[24px] font-black text-[#2E0B5E] font-noto leading-tight tracking-tight">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-500 mt-3 font-noto px-2 leading-relaxed">
               {statusModal.message}
             </p>
             
             <div className="flex flex-col gap-3 mt-10">
                {statusModal.type === 'balance' ? (
                  <>
                    <button 
                      onClick={() => { setStatusModal({ ...statusModal, show: false }); setActiveTab('recharge'); }} 
                      className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-full shadow-xl shadow-purple-100 active:scale-95 transition-all text-sm uppercase tracking-[0.1em] flex items-center justify-center gap-3"
                    >
                      <Zap size={18} fill="currentColor" /> রিচার্জ করুন
                    </button>
                    <button 
                      onClick={() => setStatusModal({ ...statusModal, show: false })} 
                      className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setStatusModal({ ...statusModal, show: false })} 
                    className={`w-full py-5 font-black rounded-full text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${statusModal.type === 'success' ? 'bg-[#2E0B5E] text-white shadow-slate-200' : 'bg-red-500 text-white shadow-red-100'}`}
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
                  </button>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}

      {showSuccessPopup && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-12 text-center shadow-[0_40px_100px_rgba(141,48,244,0.3)] border border-[#8D30F4]/10 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-100">
                 <CheckCircle2 size={56} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 font-noto tracking-tight">{t('sent_successfully', lang)}</h3>
              <p className="text-[11px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">{t('sms_success', lang)}</p>
              <button 
                onClick={() => setShowSuccessPopup(false)} 
                className="w-full mt-10 py-5 premium-btn text-white font-black rounded-full shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                {t('ok', lang)}
              </button>
           </div>
        </div>,
        document.body
      )}
      
      {showAddModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(141,48,244,0.2)] border border-[#8D30F4]/5 relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#8D30F4] transition-all p-1">
                 <X size={26} strokeWidth={3} />
              </button>
              <div className="flex items-center gap-5 mb-8">
                 <div className="w-16 h-16 bg-[#8D30F4]/10 rounded-[1.8rem] flex items-center justify-center text-[#8D30F4] border border-[#8D30F4]/10 shadow-inner">
                    <MessageSquare size={32} />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('add_template', lang)}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SMS Template</p>
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">{t('name', lang)}</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] font-noto outline-none focus:border-[#8D30F4]/30" placeholder={t('name', lang)} value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} />
                 </div>
                 <div className="space-y-2 px-1 relative">
                    <div className="flex items-center justify-between px-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{t('step_3_message', lang)}</label>
                       <button 
                         onClick={() => setShowShortcodes(!showShortcodes)}
                         className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                       >
                         <Info size={10} /> Shortcodes
                       </button>
                    </div>

                    {showShortcodes && (
                       <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100/50 mb-2 animate-in slide-in-from-top-2">
                         <div className="flex flex-wrap gap-1.5">
                           {availableShortcodes.map(sc => (
                             <button
                               key={sc.code}
                               onClick={() => {
                                 setTempBody(prev => prev + sc.code);
                               }}
                               className="px-2 py-1 bg-white border border-purple-100 rounded-lg text-[9px] font-bold text-[#2E0B5E] hover:bg-purple-100 transition-colors"
                             >
                               {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                             </button>
                           ))}
                         </div>
                       </div>
                    )}

                    <textarea className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] px-6 py-4 font-bold text-slate-600 font-noto outline-none focus:border-[#8D30F4]/30 resize-none" placeholder={t('sms', lang) + "..."} value={tempBody} onChange={(e) => setTempBody(e.target.value)} />
                    <div className="absolute bottom-4 right-5 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm flex gap-2">
                       {(() => {
                          const info = getSmsLengthInfo(tempBody);
                          return (
                            <>
                              <span className="text-[10px] font-black text-slate-400">{info.isBangla ? 'Bangla' : 'English'}</span>
                              <span className="text-[10px] font-black text-[#8D30F4]">{info.length}/{info.maxAllowed} ({info.parts} SMS)</span>
                            </>
                          );
                       })()}
                    </div>
                 </div>
                 <button onClick={handleSaveTemplate} disabled={isSaving || !tempTitle || !tempBody || getSmsLengthInfo(tempBody).parts > 7} className="w-full h-16 premium-btn text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg">
                    {isSaving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> {editingId ? t('edit', lang) : t('save', lang)}</>}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 font-noto">{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4 leading-relaxed">
                  Are you sure you want to delete this template?
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleDeleteTemplate} 
                  disabled={isDeleting} 
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={22} /> : (
                    <><Trash2 size={20} /> {t('delete', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)} 
                  disabled={isDeleting}
                  className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  {t('cancel', lang)}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default WalletSMS;
