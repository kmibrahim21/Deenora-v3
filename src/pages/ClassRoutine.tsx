import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Plus, Trash2, Loader2, Calendar, Clock, BookOpen, User, Book, MapPin, Coffee, Printer, Download, Copy, Check, LayoutGrid, List, CreditCard, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language, Class, Teacher, ClassRoutine as ClassRoutineType, Profile } from 'types';
import { generateClassRoutinePDF, generateMasterClassRoutinePDF } from '../utils/pdfGenerator';
import { sortMadrasahClasses } from './Classes';

interface ClassRoutineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile?: Profile | null;
}

type ViewFormat = 'grid' | 'list' | 'cards';

const DAYS = [
  { id: 'Saturday', bn: 'শনিবার', en: 'Saturday' },
  { id: 'Sunday', bn: 'রবিবার', en: 'Sunday' },
  { id: 'Monday', bn: 'সোমবার', en: 'Monday' },
  { id: 'Tuesday', bn: 'মঙ্গলবার', en: 'Tuesday' },
  { id: 'Wednesday', bn: 'বুধবার', en: 'Wednesday' },
  { id: 'Thursday', bn: 'বৃহস্পতিবার', en: 'Thursday' },
  { id: 'Friday', bn: 'শুক্রবার', en: 'Friday' },
];

const ClassRoutine: React.FC<ClassRoutineProps> = ({ lang, madrasah, onBack, profile }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [routines, setRoutines] = useState<ClassRoutineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [masterDownloading, setMasterDownloading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [format, setFormat] = useState<ViewFormat>('grid');
  const [deleteModal, setDeleteModal] = useState<{show: boolean, id: string | null}>({show: false, id: null});
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({show: false, message: '', type: 'info'});

  
  // Form state
  const [formData, setFormData] = useState<Partial<ClassRoutineType>>({
    day: 'Saturday',
    start_time: '08:00',
    end_time: '09:00',
    is_break: false
  });

  const canManage = profile?.role !== 'teacher' || profile?.permissions?.can_manage_classes;

  useEffect(() => {
    if (madrasah) {
      fetchData();
    }
  }, [madrasah]);

  const fetchData = async () => {
    if (!madrasah) return;
    setLoading(true);
    try {
      const [clsRes, teaRes, rouRes] = await Promise.all([
        supabase.from('classes').select('*').eq('institution_id', madrasah.id),
        supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true),
        supabase.from('class_routines').select('*, classes(class_name), teachers(teacher_name)').eq('institution_id', madrasah.id).order('start_time', { ascending: true })
      ]);

      if (clsRes.data) setClasses(sortMadrasahClasses(clsRes.data));
      if (teaRes.data) setTeachers(teaRes.data.map(t => ({ ...t, name: t.teacher_name, phone: t.mobile })));
      if (rouRes.data) setRoutines(rouRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({show: true, message, type});
    setTimeout(() => {
      setToast(prev => ({...prev, show: false}));
    }, 3000);
  };

  const handleSave = async () => {
    if (!madrasah || !formData.class_id || (!formData.subject_name && !formData.is_break) || !formData.day || !formData.start_time || !formData.end_time) {
      showToast(lang === 'bn' ? 'সবগুলো ঘর পূরণ করুন' : 'Please fill all required fields', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('class_routines').insert({
        institution_id: madrasah.id,
        class_id: formData.class_id,
        subject_name: formData.is_break ? (formData.subject_name || (lang === 'bn' ? 'বিরতি' : 'Break')) : formData.subject_name,
        teacher_id: formData.teacher_id || null,
        day: formData.day,
        start_time: formData.start_time,
        end_time: formData.end_time,
        room_number: formData.room_number || null,
        is_break: formData.is_break || false,
        note: formData.note || null
      });
      if (error) throw error;
      
      setIsAdding(false);
      setFormData(prev => ({
        ...prev,
        start_time: prev.end_time,
        end_time: '',
        subject_name: '',
        is_break: false
      }));
      fetchData();
      showToast(lang === 'bn' ? 'সফলভাবে সংরক্ষণ করা হয়েছে' : 'Saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    if (!id) {
      showToast('Error: Routine ID missing', 'error');
      return;
    }
    setDeleteModal({show: true, id});
  };

  const executeDelete = async () => {
    const id = deleteModal.id;
    if (!id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('class_routines').delete().eq('id', id);
      if (error) {
        console.error('Delete error:', error);
        showToast('Delete failed: ' + error.message, 'error');
        return;
      }
      showToast(lang === 'bn' ? 'সফলভাবে ডিলিট হয়েছে' : 'Deleted successfully', 'success');
      setDeleteModal({show: false, id: null});
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting routine', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (routine: ClassRoutineType) => {
    if (!routine) return;
    console.log('Copying routine:', routine);
    
    try {
      const startTime = routine.start_time ? routine.start_time.slice(0, 5) : '08:00';
      const endTime = routine.end_time ? routine.end_time.slice(0, 5) : '09:00';
      
      setFormData({
        class_id: routine.class_id,
        subject_name: routine.subject_name,
        teacher_id: routine.teacher_id,
        day: routine.day,
        start_time: startTime,
        end_time: endTime,
        room_number: routine.room_number,
        is_break: routine.is_break,
        note: routine.note
      });
      setIsAdding(true);
      showToast(lang === 'bn' ? 'তথ্য কপি হয়েছে, এবার সংরক্ষণ করুন' : 'Data copied, now save it', 'success');
    } catch (err) {
      console.error('Copy error:', err);
      showToast('Error copying data', 'error');
    }
  };

  const handleDownloadAllPDF = async () => {
    setDownloading(true);
    try {
      await generateClassRoutinePDF(madrasah, routines, classes, DAYS, lang);
    } catch (err) {
      console.error('PDF generation error:', err);
      showToast('Error generating PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadMasterPDF = async () => {
    setMasterDownloading(true);
    try {
      await generateMasterClassRoutinePDF(madrasah, routines, classes, DAYS, lang);
    } catch (err) {
      console.error('Master PDF generation error:', err);
      alert('Error generating Master PDF');
    } finally {
      setMasterDownloading(false);
    }
  };

  const getBanglaNumber = (str: string) => {
    const englishDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return str.replace(/[0-9]/g, d => englishDigits[d]);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 sticky top-0 z-40 py-2 -mx-4 px-4 bg-slate-50/80 backdrop-blur-md print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm border transition-all active:scale-90 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-600'}`}>
            <ChevronLeft size={20} />
          </button>
          <div className="text-left">
            <h1 className={`text-xl font-black font-noto tracking-tight flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              <Calendar className="text-[#2563EB]" size={24} />
              {lang === 'bn' ? 'ক্লাস রুটিন' : 'Class Routine'}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canManage && (
            <button 
              onClick={() => setIsAdding(true)}
              className="h-10 px-4 bg-[#2563EB] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} />
              {lang === 'bn' ? 'এড' : 'Add'}
            </button>
          )}

          <button 
            onClick={handleDownloadAllPDF}
            disabled={downloading || masterDownloading}
            title={lang === 'bn' ? 'আলাদা আলাদা ক্লাস ডাউনলোড (PDF)' : 'Download Individual Classes (PDF)'}
            className="h-10 px-3 bg-white border border-slate-100 text-slate-600 rounded-2xl flex items-center gap-1.5 shadow-sm active:scale-90 font-bold text-[9px] uppercase tracking-wider disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin text-[#2563EB]" />
            ) : (
              <Download size={16} className="text-[#2563EB]" />
            )}
            <span className="hidden sm:inline">{downloading ? (lang === 'bn' ? 'অপেক্ষা...' : 'Wait...') : (lang === 'bn' ? 'আলাদা PDF' : 'Individual PDF')}</span>
          </button>

          <button 
            onClick={handleDownloadMasterPDF}
            disabled={downloading || masterDownloading}
            title={lang === 'bn' ? 'মাস্টার রুটিন ডাউনলোড (একসাথে)' : 'Download Master Routine'}
            className="h-10 px-3 bg-[#2563EB] border border-[#2563EB] text-white rounded-2xl flex items-center gap-1.5 shadow-sm active:scale-90 font-bold text-[9px] uppercase tracking-wider disabled:opacity-50"
          >
            {masterDownloading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <LayoutGrid size={16} className="text-white" />
            )}
            <span className="hidden sm:inline">{masterDownloading ? (lang === 'bn' ? 'অপেক্ষা...' : 'Wait...') : (lang === 'bn' ? 'মাস্টার PDF' : 'Master PDF')}</span>
          </button>
        </div>
      </div>

      {/* Controls: Class & Format Switcher */}
      <div className="space-y-4 print:hidden">
        {/* Class Selector */}
        <div className={`p-4 rounded-[2rem] border shadow-sm flex items-center gap-4 sticky top-14 z-20 overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-2 min-w-max">
             <BookOpen size={18} className="text-slate-400" />
             <span className="text-[10px] font-black text-slate-400 uppercase">ক্লাস:</span>
          </div>
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1 flex-1">
            <button 
              onClick={() => setSelectedClassId('all')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${selectedClassId === 'all' ? 'bg-[#2563EB] text-white shadow-md' : 'bg-slate-50 text-slate-500'}`}
            >
              সকল ক্লাস
            </button>
            {classes.map(cls => (
              <button 
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white shadow-md' : 'bg-slate-50 text-slate-500'}`}
              >
                {cls.class_name}
              </button>
            ))}
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center justify-center gap-2">
           <button onClick={() => setFormat('grid')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${format === 'grid' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
              <LayoutGrid size={16} /> Grid View
           </button>
           <button onClick={() => setFormat('list')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${format === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
              <List size={16} /> List View
           </button>
           <button onClick={() => setFormat('cards')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${format === 'cards' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
              <CreditCard size={16} /> Card View
           </button>
        </div>
      </div>

      {/* Routine Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="font-bold text-xs uppercase tracking-widest">লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {selectedClassId === 'all' && format === 'grid' ? (
             <MasterRoutineGrid 
               routines={routines}
               classes={classes}
               madrasah={madrasah}
               getBanglaNumber={getBanglaNumber}
             />
          ) : (
            classes.filter(c => selectedClassId === 'all' || selectedClassId === c.id).map(cls => {
              const classRoutines = routines.filter(r => r.class_id === cls.id);
              if (classRoutines.length === 0 && selectedClassId === 'all') return null;

              return (
                <div key={cls.id} className="space-y-4">
                  {selectedClassId === 'all' && (
                    <div className="flex items-center gap-2 px-4 print:hidden">
                      <div className="w-1 h-6 bg-[#2563EB] rounded-full" />
                      <h2 className="text-xl font-black font-noto text-slate-800">{cls.class_name}</h2>
                    </div>
                  )}
                  
                  {format === 'grid' ? (
                    <RoutineGrid 
                      routines={classRoutines} 
                      madrasah={madrasah} 
                      days={DAYS} 
                      className={cls.class_name} 
                      getBanglaNumber={getBanglaNumber}
                      canManage={canManage}
                      handleDelete={confirmDelete}
                      handleCopy={handleCopy}
                    />
                  ) : format === 'list' ? (
                    <RoutineList 
                      routines={classRoutines} 
                      days={DAYS} 
                      getBanglaNumber={getBanglaNumber}
                      canManage={canManage}
                      handleDelete={confirmDelete}
                      handleCopy={handleCopy}
                    />
                  ) : (
                    <RoutineCards 
                      routines={classRoutines} 
                      days={DAYS} 
                      getBanglaNumber={getBanglaNumber}
                      canManage={canManage}
                      handleDelete={confirmDelete}
                      handleCopy={handleCopy}
                    />
                  )}
                  <div className="page-break" />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 pb-24 sm:pb-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-7 shadow-2xl space-y-6 overflow-y-auto max-h-[80vh] no-scrollbar relative overflow-hidden">
             
             {/* Decorative Background */}
             <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
             <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl" />

             <div className="flex items-center gap-4 border-b-2 border-slate-50 pb-5 relative z-10">
               <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-[1rem] flex items-center justify-center shadow-sm">
                 <Plus size={24} strokeWidth={2.5} />
               </div>
               <h3 className="font-black font-noto text-xl text-slate-800 tracking-tight">রুটিন এড করুন</h3>
             </div>

             <div className="space-y-4 relative z-10">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                   <button onClick={() => setFormData({...formData, is_break: false})} className={`flex-1 py-2.5 text-[11px] font-black uppercase rounded-xl transition-all ${!formData.is_break ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>ক্লাস</button>
                   <button onClick={() => setFormData({...formData, is_break: true})} className={`flex-1 py-2.5 text-[11px] font-black uppercase rounded-xl transition-all ${formData.is_break ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>বিরতি</button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">ক্লাস</label>
                  <select 
                    className="w-full h-12 border-2 border-slate-100 rounded-[1rem] px-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors bg-white hover:bg-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                    value={formData.class_id || ''}
                    onChange={e => setFormData({...formData, class_id: e.target.value})}
                  >
                    <option value="">ক্লাস পছন্দ করুন</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">{formData.is_break ? 'বিরতির বিষয়' : 'বিষয়ের নাম'}</label>
                  <input 
                    type="text"
                    className="w-full h-12 border-2 border-slate-100 rounded-[1rem] px-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors bg-white placeholder-slate-300"
                    value={formData.subject_name || ''}
                    onChange={e => setFormData({...formData, subject_name: e.target.value})}
                    placeholder={formData.is_break ? "যেমন: টিফিন, নামায" : "যেমন: আরবী"}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">বার</label>
                  <select 
                    className="w-full h-12 border-2 border-slate-100 rounded-[1rem] px-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors bg-white hover:bg-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                    value={formData.day || ''}
                    onChange={e => setFormData({...formData, day: e.target.value as any})}
                  >
                    {DAYS.map(d => <option key={d.id} value={d.id}>{d.bn}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">শুরু</label>
                    <input type="time" className="w-full h-12 border-2 border-slate-100 rounded-[1rem] px-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors bg-white" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">শেষ</label>
                    <input type="time" className="w-full h-12 border-2 border-slate-100 rounded-[1rem] px-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors bg-white" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                  </div>
                </div>

                {!formData.is_break && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">শিক্ষক</label>
                    <select 
                      className="w-full h-12 border-2 border-slate-100 rounded-[1rem] px-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors bg-white hover:bg-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                      value={formData.teacher_id || ''}
                      onChange={e => setFormData({...formData, teacher_id: e.target.value})}
                    >
                      <option value="">শিক্ষক পছন্দ করুন (ঐচ্ছিক)</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
             </div>

             <div className="flex gap-3 pt-6 relative z-10">
                <button onClick={() => setIsAdding(false)} className="flex-1 h-12 md:h-14 bg-slate-100 text-slate-600 font-black rounded-2xl md:rounded-[1.25rem] text-[11px] md:text-xs uppercase hover:bg-slate-200 transition-colors">বাতিল</button>
                <button onClick={handleSave} disabled={saving} className="flex-[2] h-12 md:h-14 bg-[#2563EB] text-white font-black rounded-2xl md:rounded-[1.25rem] text-[11px] md:text-xs uppercase shadow-lg shadow-blue-500/20 flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-95">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : 'সংরক্ষণ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 pb-24 sm:pb-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full mx-auto flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 border-4 border-white rounded-full"></div>
              <Trash2 size={32} strokeWidth={2} />
            </div>
            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-black font-noto tracking-tight text-slate-800">আপনি কি নিশ্চিত?</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">এই রুটিনটি স্থায়ীভাবে মুছে ফেলা হবে। এই কাজ আর বাতিল করা যাবে না।</p>
            </div>
            <div className="flex gap-3 pt-4 relative z-10">
               <button onClick={() => setDeleteModal({show: false, id: null})} className="flex-1 h-12 md:h-14 bg-slate-100 text-slate-600 font-black rounded-2xl md:rounded-[1.25rem] text-[11px] md:text-xs uppercase hover:bg-slate-200 transition-colors">না, বাতিল</button>
               <button onClick={executeDelete} disabled={saving} className="flex-1 h-12 md:h-14 bg-red-500 text-white font-black rounded-2xl md:rounded-[1.25rem] text-[11px] md:text-xs uppercase shadow-lg shadow-red-500/20 flex items-center justify-center hover:bg-red-600 transition-colors active:scale-95">
                 {saving ? <Loader2 className="animate-spin" size={18} /> : 'হ্যাঁ, ডিলিট'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-24 sm:bottom-10 left-1/2 -translate-x-1/2 z-[120] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-50/90 text-emerald-700 border-emerald-100' :
            toast.type === 'error' ? 'bg-red-50/90 text-red-700 border-red-100' :
            'bg-blue-50/90 text-blue-700 border-blue-100'
          }`}>
            <div className="shrink-0 bg-white/50 p-1.5 rounded-full">
              {toast.type === 'success' ? <CheckCircle size={20} strokeWidth={2.5} className="text-emerald-500" /> :
               toast.type === 'error' ? <AlertCircle size={20} className="text-red-500" /> :
               <Info size={20} className="text-blue-500" />}
            </div>
            <span className="font-bold text-sm tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Subcomponents for different views ---

const RoutineGrid = ({ routines, madrasah, days, className, getBanglaNumber, canManage, handleDelete, handleCopy }: any) => {
  const timeSlots = useMemo(() => {
    const slots = Array.from(new Set(routines.map((r: any) => `${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}`)));
    return slots.sort();
  }, [routines]);

  return (
    <div className="p-8 bg-white border-2 border-slate-900 rounded-[2.5rem] shadow-premium print:border-none print:shadow-none print:p-0">
       <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
             {madrasah?.logo_url && <img src={madrasah.logo_url} className="w-16 h-16 object-contain" alt="Logo" />}
             <div className="text-left">
                <h1 className="text-xl font-black font-noto text-blue-800">{madrasah?.name_english}</h1>
                <h2 className="text-lg font-bold font-noto text-slate-800">{madrasah?.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{madrasah?.address}</p>
             </div>
          </div>
          <div className="bg-slate-900 text-white px-8 py-1.5 rounded-full inline-block text-sm font-black font-noto">ক্লাস রুটিন - ২০২৫</div>
          {className && <div className="mt-2 text-xl font-black font-noto text-slate-700">শ্রেণি: {className}</div>}
       </div>

       <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse border-2 border-slate-900 min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-900">
                <th className="border-r-2 border-slate-900 p-3 text-sm font-black font-noto w-24">সময়</th>
                {days.map((d: any) => d.id !== 'Friday' && (
                  <th key={d.id} className="border-r-2 border-slate-900 p-3 text-sm font-black font-noto">{d.bn}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot: any) => (
                <tr key={slot} className="border-b-2 border-slate-900 last:border-0">
                  <td className="border-r-2 border-slate-900 p-3 text-center text-[11px] font-black bg-slate-50">{getBanglaNumber(slot)}</td>
                  {days.map((d: any) => d.id !== 'Friday' && (
                    <td key={d.id} className="border-r-2 border-slate-900 p-2 text-center relative group min-h-[60px]">
                       {(() => {
                         const r = routines.find((item: any) => item.day === d.id && `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` === slot);
                         if (!r) return null;
                         return (
                           <div className="space-y-0.5">
                             <p className={`text-sm font-black font-noto ${r.is_break ? 'text-amber-600' : 'text-slate-900'}`}>{r.subject_name}</p>
                             {!r.is_break && (r.teachers as any)?.teacher_name && (
                               <p className="text-[10px] font-bold text-slate-400 capitalize">{(r.teachers as any).teacher_name}</p>
                             )}
                             {canManage && (
                               <div className="flex items-center justify-center gap-1.5 mt-2 print:hidden">
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleCopy(r); }} 
                                   className="w-10 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100 shadow-sm active:scale-95"
                                   title="Copy"
                                 >
                                   <Copy size={12} />
                                 </button>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} 
                                   className="w-10 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center border border-red-100 shadow-sm active:scale-95"
                                   title="Delete"
                                 >
                                   <Trash2 size={12} />
                                 </button>
                               </div>
                             )}
                           </div>
                         );
                       })()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
       </div>

       <div className="mt-8 flex justify-between items-end px-10">
          <div className="text-center border-t border-slate-400 pt-1 min-w-[120px]">
             <p className="text-[10px] font-bold font-noto">সহকারী শিক্ষক</p>
          </div>
          <div className="text-center border-t border-slate-400 pt-1 min-w-[120px]">
             <p className="text-[10px] font-bold font-noto">অধ্যক্ষ / মুহতামিম</p>
          </div>
       </div>
    </div>
  );
};

const RoutineList = ({ routines, days, getBanglaNumber, canManage, handleDelete, handleCopy }: any) => {
  return (
    <div className="space-y-4">
      {days.map((day: any) => {
        const dayRoutines = routines.filter((r: any) => r.day === day.id);
        if (dayRoutines.length === 0) return null;
        return (
          <div key={day.id} className="bg-white rounded-[2rem] border overflow-hidden">
             <div className="bg-slate-50 px-6 py-3 border-b flex items-center justify-between">
                <h4 className="font-black font-noto text-slate-700">{day.bn}</h4>
                <div className="text-[10px] font-black text-slate-400 uppercase">{dayRoutines.length} পিরিয়ড</div>
             </div>
             <div className="divide-y">
                {dayRoutines.map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.is_break ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                          {r.is_break ? <Coffee size={18} /> : <BookOpen size={18} />}
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-400">{getBanglaNumber(r.start_time.slice(0, 5))} - {getBanglaNumber(r.end_time.slice(0, 5))}</p>
                          <h5 className={`font-black font-noto ${r.is_break ? 'text-amber-600' : 'text-slate-900'}`}>{r.subject_name}</h5>
                          {!r.is_break && (r.teachers as any)?.teacher_name && (
                            <p className="text-[10px] font-medium text-slate-400">{(r.teachers as any).teacher_name}</p>
                          )}
                       </div>
                    </div>
                    {canManage && (
                       <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleCopy(r); }} 
                           className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 active:scale-90 shadow-sm"
                         >
                           <Copy size={18} />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} 
                           className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 active:scale-90 shadow-sm"
                         >
                           <Trash2 size={18} />
                         </button>
                       </div>
                    )}
                  </div>
                ))}
             </div>
          </div>
        );
      })}
    </div>
  );
};

const RoutineCards = ({ routines, days, getBanglaNumber, canManage, handleDelete, handleCopy }: any) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {routines.map((r: any) => (
        <div key={r.id} className="bg-white p-6 rounded-[2rem] border relative overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-[#2563EB]">
           <div className="flex justify-between items-start mb-4">
             <div className="bg-blue-50 text-[#2563EB] px-3 py-1 rounded-full text-[10px] font-black uppercase">
               {DAYS.find(d => d.id === r.day)?.bn}
             </div>
             <div className="text-xs font-black text-slate-400 flex items-center gap-1">
               <Clock size={14} /> {getBanglaNumber(r.start_time.slice(0, 5))} - {getBanglaNumber(r.end_time.slice(0, 5))}
             </div>
           </div>
           
           <div className="space-y-3">
              <h4 className="text-xl font-black font-noto text-slate-900">{r.subject_name}</h4>
              <div className="flex flex-wrap gap-4 pt-2">
                 {!r.is_break && (r.teachers as any)?.teacher_name && (
                   <div className="flex items-center gap-1.5 text-slate-500">
                     <User size={14} /> <span className="text-xs font-bold">{(r.teachers as any).teacher_name}</span>
                   </div>
                 )}
                 {r.room_number && (
                   <div className="flex items-center gap-1.5 text-slate-500">
                     <MapPin size={14} /> <span className="text-xs font-bold">{r.room_number}</span>
                   </div>
                 )}
              </div>
           </div>

           {canManage && (
             <div className="absolute bottom-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCopy(r); }} 
                  className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 active:scale-90 shadow-sm"
                >
                  <Copy size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} 
                  className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 active:scale-90 shadow-sm"
                >
                  <Trash2 size={18} />
                </button>
             </div>
           )}
        </div>
      ))}
    </div>
  );
};

const MasterRoutineGrid = ({ routines, classes, madrasah, getBanglaNumber }: any) => {
  const timeSlots = useMemo(() => {
    const slots = Array.from(new Set(routines.map((r: any) => `${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}`)));
    return slots.sort();
  }, [routines]);

  return (
    <div className="bg-white border-2 border-slate-900 rounded-[2.5rem] overflow-hidden shadow-premium p-6">
       <div className="text-center mb-6">
          <h1 className="text-2xl font-black font-noto text-slate-800">{madrasah?.name}</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{madrasah?.address}</p>
          <div className="mt-4 bg-slate-900 text-white px-8 py-1.5 rounded-full inline-block text-sm font-black font-noto uppercase tracking-widest">
            মাস্টার ক্লাস রুটিন - ২০২৫
          </div>
       </div>

       <div className="overflow-x-auto no-scrollbar pb-4">
          <table className="w-full border-collapse border-[1px] border-slate-300 text-[10px]">
             <thead>
                <tr className="bg-slate-50 h-12">
                   <th className="border-[1px] border-slate-300 p-2 font-black font-noto w-20 text-center">শ্রেণি</th>
                   {(timeSlots as string[]).map((slot, index) => {
                      const startTime = slot.split(' - ')[0];
                      const endTime = slot.split(' - ')[1];
                      return (
                         <React.Fragment key={slot}>
                            <th className="border-[1px] border-slate-300 p-1 font-black font-noto min-w-[100px] text-center">
                               <div className="text-[11px]">{getBanglaNumber((index + 1).toString())}ম ঘণ্টা</div>
                               <div className="text-[9px] font-bold text-slate-400">({getBanglaNumber(startTime)}-{getBanglaNumber(endTime)})</div>
                            </th>
                            {index === 2 && <th className="border-[1px] border-slate-300 p-1 font-black font-noto w-8 bg-slate-100">বিরতি</th>}
                            {index === 5 && <th className="border-[1px] border-slate-300 p-1 font-black font-noto w-8 bg-slate-100">বিরতি</th>}
                         </React.Fragment>
                      );
                   })}
                </tr>
             </thead>
             <tbody>
                {classes.map(cls => {
                  const classRoutines = routines.filter((r: any) => r.class_id === cls.id);
                  if (classRoutines.length === 0) return null;

                  return (
                    <tr key={cls.id} className="h-16 group hover:bg-slate-50 transition-colors">
                       <td className="border-[1px] border-slate-300 p-2 font-black font-noto text-center bg-slate-50/50">
                          {cls.class_name}
                       </td>
                       {(timeSlots as string[]).map((slot, index) => {
                          const r = classRoutines.find((item: any) => `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` === slot);
                          return (
                            <React.Fragment key={slot}>
                               <td className="border-[1px] border-slate-300 p-2 text-center align-middle whitespace-normal">
                                  {r ? (
                                    <div className="space-y-0.5">
                                       <p className="font-black font-noto text-slate-900 text-[11px]">{r.subject_name}</p>
                                       {!r.is_break && (r.teachers as any)?.teacher_name && (
                                         <p className="text-[9px] font-bold text-slate-400 leading-tight">মো: {(r.teachers as any).teacher_name}</p>
                                       )}
                                    </div>
                                  ) : <span className="text-slate-200">---</span>}
                               </td>
                               {index === 2 && (
                                  <td className="border-[1px] border-slate-300 p-0 text-center align-middle bg-slate-50/50 relative">
                                     <div className="[writing-mode:vertical-lr] rotate-180 text-[8px] font-black tracking-widest text-slate-400 mx-auto">
                                        পানি বিরতি
                                     </div>
                                  </td>
                               )}
                               {index === 5 && (
                                  <td className="border-[1px] border-slate-300 p-0 text-center align-middle bg-slate-50/50 relative">
                                     <div className="[writing-mode:vertical-lr] rotate-180 text-[7px] font-black leading-tight text-slate-400 mx-auto">
                                        দুপুরের বিরতি
                                     </div>
                                  </td>
                               )}
                            </React.Fragment>
                          );
                       })}
                    </tr>
                  );
                })}
             </tbody>
          </table>
       </div>
    </div>
  );
};

export default ClassRoutine;
