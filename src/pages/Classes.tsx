
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronRight, BookOpen, Users, Edit3, Trash2, X, Check, Loader2, AlertCircle, AlertTriangle, Hash } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Class, Language, Institution, Profile } from 'types';
import { t } from 'translations';
import { requestManager } from 'services/RequestManager';

export const sortMadrasahClasses = (classes: any[]) => {
  if (!classes || !Array.isArray(classes)) return [];
  
  const bnToEn = (str: any) => {
    if (str === null || str === undefined) return null;
    const s = String(str);
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let res = s;
    for (let i = 0; i < 10; i++) {
        res = res.replace(new RegExp(bengaliDigits[i], 'g'), englishDigits[i]);
    }
    const num = Number(res);
    return isNaN(num) ? null : num;
  };

  return [...classes].sort((a, b) => {
    const orderA = bnToEn(a.sort_order) ?? 999999;
    const orderB = bnToEn(b.sort_order) ?? 999999;
    
    if (orderA !== orderB) return orderA - orderB;
    
    return (a.class_name || '').localeCompare((b.class_name || ''), 'bn', { numeric: true });
  });
};

interface ClassesProps {
  onClassClick: (cls: Class) => void;
  lang: Language;
  madrasah: Institution | null;
  dataVersion: number;
  triggerRefresh: () => void;
  readOnly?: boolean;
  profile?: Profile | null;
}

const Classes: React.FC<ClassesProps> = ({ onClassClick, lang, madrasah, dataVersion, triggerRefresh, readOnly, profile }) => {
  const [classes, setClasses] = useState<(Class & { student_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Class | null>(null);
  const isDark = madrasah?.theme === 'dark';

  useEffect(() => { 
    if (madrasah?.id) {
      fetchClasses(); 
    }
  }, [dataVersion, madrasah?.id]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    
    // First, show whatever is in offline cache immediately
    const cacheKey = `classes_${madrasah.id}`;
    const cached = offlineApi.getCache(cacheKey);
    if (cached) setClasses(sortMadrasahClasses(cached));

    try {
      // 1. Fetch Classes (Cached)
      const { data: classesData, error } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
        `classes:${madrasah.id}`,
        30 * 60 * 1000
      );
      if (error) throw error;
      
      if (classesData) {
        let filteredClasses = classesData;
        if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
          filteredClasses = classesData.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
        }

        // 2. Fetch Student Class Counts (Only class_id to reduce payload)
        // Cache this for 1 minute as it's just for display counts
        const { data: studentData } = await requestManager.cachedFetch(
          'students',
          (q) => q.select('class_id').eq('institution_id', madrasah.id),
          `student_counts:${madrasah.id}`,
          30 * 60 * 1000 // 30 mins
        );
        
        const counts: Record<string, number> = {};
        if (studentData) {
          studentData.forEach(s => {
            if (s.class_id) {
              counts[s.class_id] = (counts[s.class_id] || 0) + 1;
            }
          });
        }

        const withCounts = filteredClasses.map(cls => ({
          ...cls,
          student_count: counts[cls.id] || 0
        }));
        const sorted = sortMadrasahClasses(withCounts);
        setClasses(sorted);
        offlineApi.setCache(cacheKey, sorted);
      }
    } catch (err) { 
      console.error('Fetch Classes Error:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveClass = async () => {
    if (!newClassName.trim() || !madrasah) return;
    setModalLoading(true);
    
    const bengaliToEnglish: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    const englishSortOrder = newSortOrder ? newSortOrder.replace(/[০-৯]/g, match => bengaliToEnglish[match]) : '';
    const order = englishSortOrder ? parseInt(englishSortOrder) : null;
    
    // Invalidate RequestManager cache immediately
    requestManager.invalidatePattern(`classes:${madrasah.id}`);

    try {
      if (editingClass) {
        // Optimistic Update
        const updatedClasses = classes.map(c => c.id === editingClass.id ? { ...c, class_name: newClassName.trim(), sort_order: order } : c);
        const sorted = sortMadrasahClasses(updatedClasses);
        setClasses(sorted);
        offlineApi.setCache(`classes_${madrasah.id}`, sorted);
        
        if (navigator.onLine) {
          const { error } = await supabase.from('classes').update({ 
            class_name: newClassName.trim(),
            sort_order: order 
          }).eq('id', editingClass.id);
          if (error) throw error;
        } else {
          offlineApi.queueAction('classes', 'UPDATE', { 
            id: editingClass.id, 
            class_name: newClassName.trim(),
            sort_order: order
          });
        }
      } else {
        const tempId = crypto.randomUUID();
        const payload = { 
          id: tempId,
          class_name: newClassName.trim(), 
          institution_id: madrasah.id,
          sort_order: order
        };
        
        // Optimistic Update
        const updatedClasses = sortMadrasahClasses([...classes, { ...payload, student_count: 0 }]);
        setClasses(updatedClasses);
        offlineApi.setCache(`classes_${madrasah.id}`, updatedClasses);

        if (navigator.onLine) {
          const { data, error } = await supabase.from('classes').insert({
            class_name: payload.class_name,
            institution_id: payload.institution_id,
            sort_order: payload.sort_order
          }).select().single();
          if (error) throw error;
          
          // Replace temp item with real data if needed (though next refresh will handle it)
          if (data) {
             setClasses(prev => prev.map(c => c.id === tempId ? { ...data, student_count: 0 } : c));
          }
        } else {
          offlineApi.queueAction('classes', 'INSERT', payload);
        }
      }
      setShowModal(false);
      setNewClassName('');
      setNewSortOrder('');
      setEditingClass(null);
      await triggerRefresh();
    } catch (err: any) {
      alert(lang === 'bn' ? `ব্যর্থ হয়েছে: ${err.message}` : `Failed: ${err.message}`);
      // On error, we really should revert the optimistic state but for now fetchClasses will correct it
      fetchClasses();
    } finally { setModalLoading(false); }
  };

  const handleDeleteClass = async () => {
    if (!showDeleteConfirm || !madrasah) return;
    setModalLoading(true);
    
    // Invalidate
    requestManager.invalidatePattern(`classes:${madrasah.id}`);

    try {
      // Optimistic Delete
      setClasses(prev => prev.filter(c => c.id !== showDeleteConfirm.id));

      if (navigator.onLine) {
        const { error } = await supabase.from('classes').delete().eq('id', showDeleteConfirm.id);
        if (error) {
          // Check for foreign key constraint violation (PostgreSQL error code 23503)
          if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
             throw new Error(lang === 'bn' 
               ? 'এই ক্লাসটি ডিলিট করা যাবে না কারণ এটি অন্যান্য তথ্যের (যেমন: শিক্ষার্থী, ফি, পরীক্ষা) সাথে যুক্ত। প্রথমে যুক্ত তথ্যগুলো ডিলিট করুন।' 
               : 'This class cannot be deleted because it is linked to other records (e.g. students, fees, exams). Please delete the linked records first.');
          }
          throw error;
        }
      } else {
        // Offline check (limited)
        offlineApi.queueAction('classes', 'DELETE', { id: showDeleteConfirm.id });
      }
      setShowDeleteConfirm(null);
      triggerRefresh();
    } catch (err: any) { 
      alert(err.message); 
      fetchClasses(); // Revert on failure
    } finally { setModalLoading(false); }
  };

  return (
    <>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">

        <div className="flex items-center justify-between px-2">
          <h1 className={`text-xl font-noto font-black ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>{t('classes_title', lang, madrasah?.institution_type)}</h1>
          {!readOnly && (
            <button onClick={() => { setNewClassName(''); setNewSortOrder(''); setEditingClass(null); setShowModal(true); }} className="bg-[#2563EB] text-white px-5 py-3 rounded-2xl text-[12px] font-black flex items-center gap-2 active:scale-95 transition-all border border-blue-100 shadow-premium">
              <Plus size={16} strokeWidth={4} /> {t('new_class', lang, madrasah?.institution_type)}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {classes.map(cls => (
            <div key={cls.id} onClick={() => onClassClick(cls)} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 sm:p-5 rounded-[2.2rem] border flex items-center justify-between active:scale-[0.98] transition-all group shadow-bubble relative overflow-hidden`}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB]'} rounded-2xl flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={20} className="sm:size-6" />
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} text-[16px] sm:text-[18px] font-noto line-clamp-2 leading-tight tracking-tight break-words`}>
                      {cls.class_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users size={12} className={isDark ? 'text-blue-400/60' : 'text-[#2563EB]/60'} />
                    <p className={`text-[9px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-[0.1em]`}>{cls.student_count || 0} {t('students_count', lang, madrasah?.institution_type)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {!readOnly && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setNewClassName(cls.class_name || ''); setNewSortOrder(cls.sort_order?.toString() || ''); setEditingClass(cls); setShowModal(true); }} 
                      className={`w-9 h-9 sm:w-10 sm:h-10 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB]'} rounded-xl flex items-center justify-center border active:scale-90 transition-all shadow-sm`}>
                      <Edit3 size={14} className="sm:size-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(cls); }} 
                      className={`w-9 h-9 sm:w-10 sm:h-10 ${isDark ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-500'} rounded-xl flex items-center justify-center border active:scale-90 transition-all shadow-sm`}>
                      <Trash2 size={14} className="sm:size-4" />
                    </button>
                  </>
                )}
                <ChevronRight className={`${isDark ? 'text-slate-600 group-hover:text-blue-400' : 'text-blue-200 group-hover:text-[#2563EB]'} transition-colors ml-0.5`} size={18} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[3.5rem] p-10 shadow-bubble border relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => setShowModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#2563EB] transition-all"><X size={26} strokeWidth={3} /></button>
            

            <div className="flex items-center gap-5 mb-8">
               <div className={`w-16 h-16 ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB]'} rounded-[1.8rem] flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto tracking-tight`}>
                    {editingClass ? t('edit_class', lang, madrasah?.institution_type) : t('new_class', lang, madrasah?.institution_type)}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Class Information</p>
               </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{t('class_name_label', lang, madrasah?.institution_type)}</label>
                <input 
                  type="text" 
                  autoFocus
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#2563EB]/30 focus:bg-white transition-all shadow-inner`} 
                  value={newClassName} 
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="যেমন: হিফয বিভাগ"
                />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                  <Hash size={12} /> সিরিয়াল নম্বর (Sorting)
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9০-৯]*"
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#2563EB]/30 focus:bg-white transition-all shadow-inner`} 
                  value={newSortOrder} 
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="যেমন: ১"
                />
              </div>

              <button onClick={handleSaveClass} disabled={modalLoading || !newClassName.trim()} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg">
                {modalLoading ? <Loader2 className="animate-spin" size={24} /> : <><Check size={24} strokeWidth={4} /> {t('save', lang)}</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'} w-full max-w-sm rounded-[3.5rem] p-10 shadow-bubble border text-center space-y-6 animate-in zoom-in-95 duration-500`}>
             <div className={`w-20 h-20 ${isDark ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-500'} rounded-full flex items-center justify-center mx-auto shadow-inner border`}>
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'} font-noto`}>{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4">"{showDeleteConfirm.class_name}" শ্রেণির সকল শিক্ষার্থীর তথ্য মুছে যাবে।</p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button onClick={handleDeleteClass} disabled={modalLoading} className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md">
                  {modalLoading ? <Loader2 className="animate-spin" size={22} /> : 'ডিলিট করুন'}
                </button>
                <button onClick={() => setShowDeleteConfirm(null)} className={`w-full py-4 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'} font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest`}>বাতিল</button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Classes;
