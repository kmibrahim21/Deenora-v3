
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Plus, Search, CheckCircle2, MessageSquare, X, BookOpen, ChevronDown, Check, PhoneCall, Smartphone, Loader2, ListChecks, MessageCircle, Phone, AlertCircle, AlertTriangle, Zap } from 'lucide-react';
import { supabase, offlineApi, smsApi } from 'supabase';
import { Class, Student, Language, Institution } from 'types';
import { t } from 'translations';


interface StudentsProps {
  selectedClass: Class;
  onStudentClick: (student: Student) => void;
  onAddClick: () => void;
  onBack: () => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  canAdd?: boolean;
  canSendSMS?: boolean;
  institutionId?: string;
  madrasah?: Institution | null;
  onNavigateToWallet?: () => void;
}

const PAGE_SIZE = 50;

const Students: React.FC<StudentsProps> = ({ selectedClass, onStudentClick, onAddClick, onBack, lang, dataVersion, triggerRefresh, canAdd, canSendSMS, institutionId, madrasah, onNavigateToWallet }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'success' | 'error' | 'balance', title: string, message: string}>({
    show: false, type: 'success', title: '', message: ''
  });

  // Fetch Templates (Cached)
  const fetchTemplates = useCallback(async () => {
    if (!institutionId) return;
    const { data } = await supabase.from('sms_templates').select('id, title, body').eq('institution_id', institutionId);
    if (data) setTemplates(data);
  }, [institutionId]);

  // Paginated Fetching
  const fetchStudents = useCallback(async (reset = false) => {
    if (!institutionId) return;
    if (reset) { setLoading(true); setPage(0); } else { setLoadingMore(true); }

    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      // Fix: Add institution_id to the select query to satisfy the Student type requirements.
      let query = supabase
        .from('students')
        .select('id, institution_id, student_name, guardian_phone, roll, guardian_name, class_id, classes(class_name)')
        .eq('institution_id', institutionId)
        .eq('class_id', selectedClass.id)
        .order('roll', { ascending: true })
        .range(from, to);

      if (searchQuery.trim()) {
        query = query.ilike('student_name', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const formattedData = (data as any[]).map(s => ({
          ...s,
          classes: Array.isArray(s.classes) ? s.classes[0] : s.classes
        })) as Student[];
        
        setStudents(prev => reset ? formattedData : [...prev, ...formattedData]);
        setHasMore(data.length === PAGE_SIZE);
        if (!reset) setPage(currentPage + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [institutionId, selectedClass.id, page, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => fetchStudents(true), 400); // Optimized debounced search
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [institutionId, fetchTemplates]);

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  const handlePremiumSMS = async () => {
    if (!selectedTemplate || selectedIds.size === 0 || !institutionId) return;
    setSending(true);
    try {
      const selectedStudents = students.filter(s => selectedIds.has(s.id));
      await smsApi.sendBulk(institutionId, selectedStudents, selectedTemplate.body);
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: t('sms_success', lang) });
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      const isBal = err.message.toLowerCase().includes('balance');
      setStatusModal({ show: true, type: isBal ? 'balance' : 'error', title: isBal ? 'ব্যালেন্স শেষ!' : 'ব্যর্থ', message: err.message });
    } finally { setSending(false); }
  };

  const canSendSystemSMS = true;
  const canSendFreeSMS = true;
  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="animate-in slide-in-from-right-4 duration-700 pb-24 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] shadow-[0_20px_50px_-15px_rgba(37,99,235,0.3)] border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 animate-pulse">
          <BookOpen size={120} strokeWidth={1} />
        </div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack} 
                className="w-12 h-12 bg-white/20 backdrop-blur-2xl rounded-[1.2rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-xl shrink-0 hover:bg-white/30"
              >
                <ArrowLeft size={24} strokeWidth={3} />
              </button>
              <div>
                <h1 className="text-xl font-black text-white font-noto tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                  {selectedClass.class_name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">
                    {students.length} {t('students', lang)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSelectionMode && (
                <button 
                  onClick={toggleSelectAll} 
                  className="h-12 px-4 rounded-[1.2rem] bg-white/20 backdrop-blur-2xl text-white border border-white/30 font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all hover:bg-white/30"
                >
                  {selectedIds.size === students.length ? t('clear', lang) : t('all', lang)}
                </button>
              )}
          <button 
            onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }} 
            className={`w-11 h-11 rounded-[1.2rem] border flex items-center justify-center transition-all active:scale-95 shadow-xl ${isSelectionMode ? 'bg-white text-[#2563EB] border-white' : 'bg-white/20 backdrop-blur-2xl text-white border-white/30 hover:bg-white/30'}`}
          >
            {isSelectionMode ? <X size={22} strokeWidth={3} /> : <MessageSquare size={22} strokeWidth={2.5} />}
          </button>
          {!isSelectionMode && canAdd && (
            <button 
              onClick={onAddClick} 
              className="w-11 h-11 bg-white rounded-[1.2rem] flex items-center justify-center text-[#2563EB] active:scale-90 transition-all border border-white shadow-xl hover:shadow-[#2563EB]/20"
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 group-focus-within:text-white transition-colors" size={20} strokeWidth={3} />
            <input 
              type="text" 
              placeholder={t('search_placeholder', lang)}
              className="w-full h-14 pl-14 pr-6 bg-white/10 backdrop-blur-2xl border-2 border-white/20 rounded-[1.5rem] outline-none text-white font-black text-base placeholder:text-white/40 focus:border-white/40 focus:bg-white/20 transition-all shadow-inner"
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* Student List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {students.map(student => (
          <div 
            key={student.id} 
            onClick={() => isSelectionMode ? (setSelectedIds(prev => { const n = new Set(prev); if(n.has(student.id)) n.delete(student.id); else n.add(student.id); return n; })) : onStudentClick(student)}
            className={`group p-4 rounded-[2rem] border-2 transition-all flex items-center justify-between shadow-sm hover:shadow-lg active:scale-[0.98] cursor-pointer ${isSelectionMode && selectedIds.has(student.id) ? (isDark ? 'bg-blue-600/20 border-[#2563EB] shadow-[#2563EB]/20' : 'bg-blue-50 border-[#2563EB] shadow-[#2563EB]/10') : (isDark ? 'bg-slate-800 border-slate-700 hover:border-[#2563EB]/40 hover:bg-slate-700/50' : 'bg-white border-slate-100 hover:border-[#2563EB]/20')}`}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="relative shrink-0">
                <div className={`w-14 h-14 rounded-[1rem] flex flex-col items-center justify-center shrink-0 border-2 shadow-inner transition-all duration-300 ${isSelectionMode && selectedIds.has(student.id) ? 'bg-[#2563EB] text-white border-[#2563EB]' : (isDark ? 'bg-slate-800 text-blue-400 border-slate-700 group-hover:bg-slate-700 group-hover:border-[#2563EB]/40' : 'bg-slate-50 text-[#2563EB] border-slate-100 group-hover:bg-blue-50 group-hover:border-[#2563EB]/20')}`}>
                  <span className={`text-[8px] font-black leading-none uppercase tracking-widest ${isSelectionMode && selectedIds.has(student.id) ? 'opacity-70' : 'opacity-40'}`}>{t('roll', lang)}</span>
                  <span className="text-lg font-black leading-none mt-1">{student.roll || '-'}</span>
                </div>
                {isSelectionMode && (
                  <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg flex items-center justify-center shadow-lg border-2 transition-all duration-300 ${selectedIds.has(student.id) ? 'bg-[#2563EB] text-white border-white scale-110' : (isDark ? 'bg-slate-800 text-slate-600 border-slate-700' : 'bg-white text-slate-200 border-slate-100')}`}>
                    <Check size={14} strokeWidth={4} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`font-black text-base font-noto truncate leading-tight group-hover:text-[#2563EB] transition-colors ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{student.student_name}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 group-hover:text-[#2563EB]/60 transition-colors">{student.guardian_name || '-'}</p>
              </div>
            </div>
            {!isSelectionMode && (
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button 
                  onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${student.guardian_phone}`; }} 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-sm active:scale-90 transition-all hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] hover:shadow-[#2563EB]/20 ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-slate-50 text-[#2563EB] border-slate-100'}`}
                >
                  <Phone size={18} fill="currentColor" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); window.location.href = `https://wa.me/88${student.guardian_phone.replace(/\D/g, '')}`; }} 
                  className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-90 transition-all hover:rotate-6 hover:shadow-emerald-300"
                >
                  <PhoneCall size={18} fill="currentColor" />
                </button>
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 space-y-3">
            <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
              <Loader2 className="animate-spin text-[#2563EB]" size={28} />
            </div>
            <p className="text-[10px] font-black text-[#2563EB] uppercase tracking-[0.3em] animate-pulse">{t('searching', lang)}</p>
          </div>
        )}
        
        {!loading && hasMore && (
           <button 
             onClick={() => fetchStudents()} 
             disabled={loadingMore} 
             className={`col-span-full h-16 mt-2 rounded-[1.5rem] text-[#2563EB] font-black text-[11px] uppercase tracking-[0.25em] border-2 border-[#2563EB]/10 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 group ${isDark ? 'bg-slate-800 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-white hover:bg-blue-50 hover:border-[#2563EB]/30'}`}
           >
              {loadingMore ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <span>{lang === 'bn' ? 'আরও লোড করুন' : 'Load More Students'}</span>
                  <ChevronDown size={18} className="group-hover:translate-y-1 transition-transform" strokeWidth={3} />
                </>
              )}
           </button>
        )}
      </div>

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+95px)] left-1/2 -translate-x-1/2 w-[94%] max-w-md z-[150] animate-in slide-in-from-bottom-10">
          <div className={`backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl border flex flex-col gap-3 ${isDark ? 'bg-slate-900/95 border-[#2563EB]/30' : 'bg-white/95 border-[#2563EB]/20'}`}>
            <button onClick={() => setShowTemplateMenu(!showTemplateMenu)} className={`w-full h-[54px] flex items-center justify-between px-5 rounded-xl border-2 font-black text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
              <div className="flex items-center gap-3 truncate"><BookOpen size={18} className="text-[#2563EB]" /><span className="truncate font-noto">{selectedTemplate ? selectedTemplate.title : t('template_title', lang)}</span></div>
              <ChevronDown size={18} className={showTemplateMenu ? 'rotate-180' : ''} />
            </button>
            {showTemplateMenu && (
              <div className={`absolute bottom-[calc(100%-40px)] left-0 right-0 mb-3 rounded-xl shadow-2xl border max-h-60 overflow-y-auto p-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => { setSelectedTemplate(tmp); setShowTemplateMenu(false); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between ${selectedTemplate?.id === tmp.id ? 'bg-[#2563EB] text-white shadow-xl' : (isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50')}`}>
                    <span className="text-[11px] font-black truncate font-noto">{tmp.title}</span>
                    {selectedTemplate?.id === tmp.id && <Check size={16} strokeWidth={4} />}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {canSendSystemSMS && <button onClick={handlePremiumSMS} disabled={sending || !selectedTemplate} className="h-11 bg-[#2563EB] text-white rounded-full font-black text-[9px] uppercase shadow-lg flex items-center justify-center gap-2">{sending ? <Loader2 size={14} /> : <MessageSquare size={14} fill="currentColor" />} {t('system_sms', lang)}</button>}
              {canSendFreeSMS && <button onClick={() => { if(!selectedTemplate) return; const phones = students.filter(s => selectedIds.has(s.id)).map(s => s.guardian_phone).join(','); window.location.href = `sms:${phones}?body=${encodeURIComponent(selectedTemplate.body)}`; }} disabled={!selectedTemplate} className="h-11 bg-[#1E3A8A] text-white rounded-full font-black text-[9px] uppercase shadow-lg flex items-center justify-center gap-2"><Smartphone size={14} fill="currentColor" /> {t('native_sms', lang)}</button>}
            </div>
            <p className="text-[9px] font-black text-[#2563EB] uppercase tracking-widest text-center">{selectedIds.size} {t('selected', lang)}</p>
          </div>
        </div>
      )}

      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className={`w-full max-w-sm rounded-[3rem] p-10 text-center shadow-[0_50px_120px_rgba(37,99,235,0.2)] border animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#2563EB]/10'}`}>
             <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-8 mb-6 relative ${statusModal.type === 'success' ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-500 border-emerald-100') : statusModal.type === 'balance' ? (isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-500 border-orange-100') : (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-500 border-red-100')}`}>
                <div className="absolute inset-0 blur-2xl opacity-20 bg-current animate-pulse" />
                {statusModal.type === 'success' ? <CheckCircle2 size={56} strokeWidth={2.5} /> : statusModal.type === 'balance' ? <Zap size={56} strokeWidth={2.5} /> : <AlertCircle size={56} strokeWidth={2.5} />}
             </div>
             <h3 className={`text-2xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-400 mt-3 font-noto px-4 leading-relaxed">{statusModal.message}</p>
             <button 
               onClick={() => setStatusModal({ ...statusModal, show: false })} 
               className="w-full h-16 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-black rounded-full shadow-2xl shadow-[#2563EB]/30 mt-10 text-base uppercase tracking-[0.2em] active:scale-95 transition-all border border-white/10"
             >
               {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
             </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Students;
