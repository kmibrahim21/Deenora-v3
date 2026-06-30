import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Plus, Trash2, Calendar, LayoutGrid, Users, Clock, Copy, Save, Loader2, Download, CheckCircle, AlertCircle, Edit3, Palette, X, Check, Coffee, Info, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language, Profile } from 'types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


interface ClassRoutineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile?: Profile | null;
}

const routineThemes = {
  'emerald': { primary: '#013c28', secondary: '#023c28', light: '#E6F4EA', accent: '#EAF7EE', border: '#10b981', shadow: 'rgba(1,60,40,0.1)' },
  'blue': { primary: '#1e3a8a', secondary: '#1e40af', light: '#eff6ff', accent: '#f8fafc', border: '#3b82f6', shadow: 'rgba(30,58,138,0.1)' },
  'slate': { primary: '#334155', secondary: '#475569', light: '#f1f5f9', accent: '#f8fafc', border: '#64748b', shadow: 'rgba(51,65,85,0.1)' },
  'purple': { primary: '#581c87', secondary: '#6b21a8', light: '#faf5ff', accent: '#fdf4ff', border: '#a855f7', shadow: 'rgba(88,28,135,0.1)' },
  'rose': { primary: '#881337', secondary: '#9f1239', light: '#fff1f2', accent: '#fff5f5', border: '#f43f5e', shadow: 'rgba(136,19,55,0.1)' }
};

const ALL_DAYS_OF_WEEK = [
  { id: 'Saturday', bn: 'শনিবার', en: 'Saturday', index: 6 },
  { id: 'Sunday', bn: 'রবিবার', en: 'Sunday', index: 0 },
  { id: 'Monday', bn: 'সোমবার', en: 'Monday', index: 1 },
  { id: 'Tuesday', bn: 'মঙ্গলবার', en: 'Tuesday', index: 2 },
  { id: 'Wednesday', bn: 'বুধবার', en: 'Wednesday', index: 3 },
  { id: 'Thursday', bn: 'বৃহস্পতিবার', en: 'Thursday', index: 4 },
  { id: 'Friday', bn: 'শুক্রবার', en: 'Friday', index: 5 },
];

const RoutineCell = ({ value, onChange, theme, placeholder = '-' }: { value: string, onChange: (val: string) => void, theme: any, placeholder?: string }) => {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full h-full min-h-[50px] bg-white text-center text-[10px] font-black font-noto resize-none border-none outline-none focus:ring-1 focus:ring-blue-400 rounded p-1 leading-normal absolute inset-0 z-50 shadow-lg"
        style={{ color: theme.primary }}
      />
    );
  }

  const lines = (value || '').split('\n').filter(l => l.trim().length > 0);
  
  return (
    <div 
      onClick={() => setEditing(true)}
      className="w-full min-h-[50px] flex flex-col justify-center items-center cursor-pointer p-1 hover:bg-black/5 transition-colors rounded-sm"
    >
      {lines.length > 0 ? (
        <>
          <span className="text-[12px] font-black leading-tight" style={{ color: theme.primary }}>{lines[0]}</span>
          {lines.length > 1 && (
            <span className="text-[8.5px] font-bold opacity-80 leading-tight mt-0.5 italic" style={{ color: theme.primary }}>
              {lines.slice(1).join(' / ')}
            </span>
          )}
        </>
      ) : (
        <span className="text-slate-300">{placeholder}</span>
      )}
    </div>
  );
};

const ClassRoutine: React.FC<ClassRoutineProps> = ({ lang, madrasah, onBack, profile }) => {
  const weeklyHolidays = madrasah?.config_json?.weekly_holidays || [5];
  const activeDays = ALL_DAYS_OF_WEEK.filter(day => !weeklyHolidays.includes(day.index));

  const [activeTab, setActiveTab] = useState<'general' | 'classwise' | 'saved'>('general');
  const [savedRoutines, setSavedRoutines] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  
  // Editor States
  const [routineTitle, setRoutineTitle] = useState(lang === 'bn' ? 'সাধারণ ক্লাস রুটিন' : 'General Class Routine');
  const [routineThemeColor, setRoutineThemeColor] = useState('blue');
  const [periods, setPeriods] = useState<any[]>([
    { id: 'p1', title: lang === 'bn' ? '১ম ঘণ্টা' : '1st Period', time: '08:00 - 08:45' },
    { id: 'p2', title: lang === 'bn' ? '২য় ঘণ্টা' : '2nd Period', time: '08:45 - 09:30' },
    { id: 'p3', title: lang === 'bn' ? '৩য় ঘণ্টা' : '3rd Period', time: '09:30 - 10:15' },
    { id: 'break1', title: lang === 'bn' ? 'বিরতি' : 'Break', time: '10:15 - 10:45', isBreak: true },
    { id: 'p4', title: lang === 'bn' ? '৪র্থ ঘণ্টা' : '4th Period', time: '10:45 - 11:30' },
  ]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineMatrix, setRoutineMatrix] = useState<Record<string, string>>({});
  const [routineInstructions, setRoutineInstructions] = useState<string[]>([
    lang === 'bn' ? 'মাদরাসার নির্ধারিত পোশাক পরে উপস্থিত থাকতে হবে।' : 'Students must attend in formal madrasah uniform.',
    lang === 'bn' ? 'সময়মতো ক্লাস শুরু হওয়ার ১০ মিনিট পূর্বে মাদরাসায় অবস্থান করতে হবে।' : 'Be at madrasah 10 minutes before classes start.',
    lang === 'bn' ? 'ডায়েরি ও প্রয়োজনীয় শিক্ষা উপকরণ সাথে রাখতে হবে।' : 'Bring diary and necessary educational supplies.',
    lang === 'bn' ? 'অনুপস্থিতির জন্য যথাযথ কারণ দর্শাতে হবে।' : 'Valid reason must be provided for absence.'
  ]);
  const [routinePrincipalName, setRoutinePrincipalName] = useState('');
  const [routinePrincipalMobile, setRoutinePrincipalMobile] = useState('');
  
  const [layoutType, setLayoutType] = useState<'day_left' | 'period_left' | 'class_left'>('day_left');
  const [selectedDay, setSelectedDay] = useState(activeDays[0]?.id || 'Saturday');
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'success' | 'error' | 'info'}>({show: false, msg: '', type: 'info'});
  
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [userZoom, setUserZoom] = useState<number>(1);
  const [downloading, setDownloading] = useState(false);
  
  const canManage = profile?.role !== 'teacher' || profile?.permissions?.can_manage_classes;

  useEffect(() => {
    if (madrasah?.id) {
       if (madrasah.config_json && (madrasah.config_json as any).saved_class_routines) {
         setSavedRoutines((madrasah.config_json as any).saved_class_routines);
       }
       fetchClasses();
    }
  }, [madrasah?.id]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data, error } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true });
    if (!error && data) setClasses(data);
  };

  useEffect(() => {
    if (activeTab === 'general') {
      setSelectedClassId('all');
      setRoutineTitle(lang === 'bn' ? 'সাধারণ ক্লাস রুটিন' : 'General Class Routine');
    } else if (activeTab === 'classwise' && selectedClassId === 'all' && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [activeTab, lang]);

  useEffect(() => {
    if (selectedClassId !== 'all') {
      const cls = classes.find(c => c.id === selectedClassId);
      if (cls) {
        setRoutineTitle(lang === 'bn' ? `${cls.class_name} - এর ক্লাস রুটিন` : `Class Routine for ${cls.class_name}`);
      }
    }
  }, [selectedClassId, classes, lang]);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const isMobile = window.innerWidth < 768;
        const targetWidth = 1123;
        const s = Math.min(1.2, isMobile ? (width / 1160) : (width / (targetWidth + 40)));
        setPreviewScale(s);
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({show: true, msg, type});
    setTimeout(() => setToast(prev => ({...prev, show: false})), 3000);
  };

  const rtTheme = routineThemes[routineThemeColor as keyof typeof routineThemes] || routineThemes.blue;

  const handleCellChange = (dayId: string, periodId: string, value: string) => {
    setRoutineMatrix(prev => ({ ...prev, [`${dayId}_${periodId}`]: value }));
  };

  const handleSaveRoutine = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const newRoutine = {
        id: Date.now().toString(),
        title: routineTitle,
        classId: selectedClassId,
        layoutType,
        selectedDay,
        themeColor: routineThemeColor,
        periods: periods,
        matrix: routineMatrix,
        instructions: routineInstructions,
        principalName: routinePrincipalName,
        principalMobile: routinePrincipalMobile,
        createdAt: new Date().toISOString()
      };
      
      const currentConfig = madrasah.config_json || {};
      let updatedRoutines = ((currentConfig as any).saved_class_routines || []);
      
      if (editingRoutineId) {
         updatedRoutines = updatedRoutines.map((r: any) => r.id === editingRoutineId ? { ...newRoutine, id: editingRoutineId } : r);
      } else {
         updatedRoutines = [...updatedRoutines, newRoutine];
      }
      
      const updatedConfig = { ...currentConfig, saved_class_routines: updatedRoutines };
      
      const { error } = await supabase.from('institutions').update({ config_json: updatedConfig }).eq('id', madrasah.id);
      if (error) throw error;
      
      setSavedRoutines(updatedRoutines);
      (madrasah as any).config_json = updatedConfig;
      showToast(lang === 'bn' ? 'সফলভাবে সংরক্ষিত!' : 'Successfully saved!', 'success');
      setActiveTab('saved');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    if (!madrasah) return;
    if (!window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত?' : 'Are you sure?')) return;
    setSaving(true);
    try {
       const currentConfig = madrasah.config_json || {};
       const updatedRoutines = ((currentConfig as any).saved_class_routines || []).filter((r: any) => r.id !== id);
       const updatedConfig = { ...currentConfig, saved_class_routines: updatedRoutines };
       
       const { error } = await supabase.from('institutions').update({ config_json: updatedConfig }).eq('id', madrasah.id);
       if (error) throw error;
       
       setSavedRoutines(updatedRoutines);
       (madrasah as any).config_json = updatedConfig;
       showToast(lang === 'bn' ? 'ডিলিট সম্পন্ন!' : 'Deleted successfully!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadSavedRoutine = (routine: any) => {
    setEditingRoutineId(routine.id);
    setRoutineTitle(routine.title);
    setSelectedClassId(routine.classId || 'all');
    setActiveTab('general');
    setRoutineThemeColor(routine.themeColor);
    setLayoutType(routine.layoutType || 'day_left');
    setSelectedDay(routine.selectedDay || (activeDays[0]?.id || 'Saturday'));
    setPeriods(routine.periods);
    setRoutineMatrix(routine.matrix);
    setRoutineInstructions(routine.instructions || []);
    setRoutinePrincipalName(routine.principalName || '');
    setRoutinePrincipalMobile(routine.principalMobile || '');
    showToast(lang === 'bn' ? 'রুটিন এডিট মোডে আনা হয়েছে' : 'Loaded in editor', 'info');
  };

  const handleDownloadPDF = async (targetRef: React.RefObject<HTMLElement>) => {
    if (!targetRef.current) return;
    setDownloading(true);
    
    // Show info toast
    showToast(lang === 'bn' ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating PDF...', 'info');

    try {
      const element = targetRef.current;
      const rect = element.getBoundingClientRect();
      // Calculate the actual height at 1:1 scale
      // rect.height is seasonally affected by previewScale and userZoom
      const actualHeight = rect.height / (previewScale * userZoom);
      const actualWidth = 1123; // Fixed width

      // Import html-to-image dynamically to ensure it's available
      const { toJpeg } = await import('html-to-image');
      
      // We need to capture the PDF content
      const dataUrl = await toJpeg(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: actualWidth,
        height: actualHeight,
        filter: (node: any) => {
          // Hide elements with specific attributes or classes
          if (node.getAttribute) {
            const ignore = node.getAttribute('data-html2canvas-ignore');
            if (ignore === 'true' || ignore === true) return false;
          }
          if (node.classList && node.classList.contains('download-hide')) return false;
          return true;
        },
        style: {
          transform: 'none',
          borderRadius: '0',
          margin: '0'
        }
      });
      
      if (layoutType === 'day_left') {
        const pdf = new jsPDF({ 
          orientation: 'portrait', 
          unit: 'px', 
          format: 'a4' 
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Scale to fit half page
        const maxWidth = pageWidth - 60;
        const maxHeight = (pageHeight / 2) - 40;
        const scale = Math.min(maxWidth / actualWidth, maxHeight / actualHeight);
        
        const drawWidth = actualWidth * scale;
        const drawHeight = actualHeight * scale;
        const xOffset = (pageWidth - drawWidth) / 2;

        // Top copy
        pdf.addImage(dataUrl, 'JPEG', xOffset, 20, drawWidth, drawHeight);
        
        // Dashed divider
        (pdf as any).setLineDash([10, 10], 0);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, pageHeight / 2, pageWidth - 20, pageHeight / 2);
        
        // Bottom copy
        pdf.addImage(dataUrl, 'JPEG', xOffset, (pageHeight / 2) + 20, drawWidth, drawHeight);
        
        pdf.save(`${routineTitle.replace(/\s+/g, '_') || 'Class_Routine'}.pdf`);
      } else {
        const pdf = new jsPDF({ 
          orientation: 'landscape', 
          unit: 'px', 
          format: [actualWidth, Math.max(794, actualHeight)] 
        });
        
        pdf.addImage(dataUrl, 'JPEG', 0, 0, actualWidth, actualHeight);
        pdf.save(`${routineTitle.replace(/\s+/g, '_') || 'Class_Routine'}.pdf`);
      }
      
      showToast(lang === 'bn' ? 'পিডিএফ ডাউনলোড হয়েছে!' : 'PDF downloaded!', 'success');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      
      // Fallback to html2canvas if html-to-image fails
      try {
        const canvas = await html2canvas(targetRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 1123,
          height: 794
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1123, 794] });
        pdf.addImage(imgData, 'JPEG', 0, 0, 1123, 794);
        pdf.save(`${routineTitle.replace(/\s+/g, '_') || 'Class_Routine'}.pdf`);
        showToast(lang === 'bn' ? 'পিডিএফ ডাউনলোড হয়েছে (অল্টারনেট পদ্ধতি)!' : 'PDF downloaded (fallback)!', 'success');
      } catch (fbError) {
        showToast(lang === 'bn' ? 'ডাউনলোড করতে সমস্যা হয়েছে' : 'Error generating PDF', 'error');
      }
    } finally {
      setDownloading(false);
    }
  };

  const addPeriod = (isBreak = false) => {
    setPeriods([...periods, { 
      id: `p${Date.now()}`, 
      title: isBreak ? (lang === 'bn' ? 'বিরতি' : 'Break') : (lang === 'bn' ? 'নতুন ঘণ্টা' : 'New Period'), 
      time: '00:00 - 00:00',
      isBreak 
    }]);
  };

  const removePeriod = (id: string) => {
    if (periods.length <= 1) return;
    setPeriods(periods.filter(p => p.id !== id));
  };

  // Convert numbers to bangla
  const getBanglaNumber = (str: string) => {
    const englishDigits: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return str.replace(/[0-9]/g, d => englishDigits[d]);
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800">{lang === 'bn' ? 'অনুমতি নেই' : 'Access Denied'}</h2>
        <button onClick={onBack} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 sticky top-0 z-40 py-2 -mx-4 px-4 bg-slate-50/80 backdrop-blur-md print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm border transition-all active:scale-90 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-600'}`}>
            <ChevronLeft size={20} />
          </button>
          <div className="text-left">
            <h1 className={`text-xl font-black font-noto tracking-tight flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1e3a8a]'}`}>
              <Calendar className="text-[#2563EB]" size={24} />
              {lang === 'bn' ? 'ক্লাস রুটিন' : 'Class Routine'}
            </h1>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Compact & Non-scrolling */}
      <div className="flex justify-center mb-6 print:hidden animate-in fade-in slide-in-from-top-1 duration-500 overflow-x-auto pb-2 scrollbar-hide">
         <div className={`p-1.25 rounded-[1.1rem] border shadow-sm flex flex-nowrap items-center justify-center gap-1.5 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setActiveTab('general')} className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'general' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
              <LayoutGrid size={14} />
              <span>{lang === 'bn' ? 'রুটিন এডিটর' : 'Routine Editor'}</span>
            </button>
            <button onClick={() => setActiveTab('saved')} className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'saved' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
              <Save size={14} />
              <span>{lang === 'bn' ? 'সেভ করা' : 'Saved'}</span>
            </button>
            <div className="w-px h-5 bg-slate-300 mx-0.5"></div>
            <button onClick={() => {
               setEditingRoutineId(null);
               setRoutineTitle(lang === 'bn' ? 'সাধারণ ক্লাস রুটিন' : 'General Class Routine');
               setRoutineMatrix({});
               setActiveTab('general');
            }} className="px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center gap-1.5">
              <Plus size={16} /> <span>{lang === 'bn' ? 'নতুন' : 'New'}</span>
            </button>
         </div>
      </div>

      {activeTab === 'saved' ? (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-premium border">
           <h3 className="text-lg font-black text-slate-800 mb-6 font-noto">{lang === 'bn' ? 'সংরক্ষিত রুটিন সমূহ' : 'Saved Routines'}</h3>
           {savedRoutines.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed text-slate-400">
                 <Calendar className="mx-auto mb-3 opacity-50" size={32} />
                 <p className="font-bold">{lang === 'bn' ? 'কোনো রুটিন পাওয়া যায়নি' : 'No saved routines found'}</p>
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {savedRoutines.map(r => (
                   <div key={r.id} className="p-5 rounded-2xl border flex items-center justify-between" style={{ borderColor: routineThemes[r.themeColor as keyof typeof routineThemes]?.border || '#e2e8f0', backgroundColor: routineThemes[r.themeColor as keyof typeof routineThemes]?.light || '#f8fafc' }}>
                      <div>
                         <h4 className="font-black font-noto text-lg" style={{ color: routineThemes[r.themeColor as keyof typeof routineThemes]?.primary || '#1e293b' }}>{r.title}</h4>
                         <p className="text-xs font-bold text-slate-500 mt-1">{lang === 'bn' ? new Date(r.createdAt || Date.now()).toLocaleDateString('bn-BD') : new Date(r.createdAt || Date.now()).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => loadSavedRoutine(r)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm hover:scale-105 transition-all"><Edit3 size={18}/></button>
                         <button onClick={() => handleDeleteSaved(r.id)} disabled={saving} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm hover:scale-105 transition-all"><Trash2 size={18}/></button>
                      </div>
                   </div>
                 ))}
              </div>
           )}
        </div>
      ) : (
        <div className="space-y-6">
           {/* Editor Tools */}
           <div className={`p-6 rounded-[2.5rem] border shadow-bubble space-y-6 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {/* Class Selector - only if not class_left layout */}
                 {layoutType !== 'class_left' && (
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'শ্রেনী নির্বাচন' : 'Select Class'}</label>
                      <select 
                         value={selectedClassId} 
                         onChange={e => setSelectedClassId(e.target.value)}
                         className={`w-full h-12 rounded-xl px-4 font-bold outline-none border focus:ring-2 appearance-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-blue-500'}`}
                      >
                         <option value="all">{lang === 'bn' ? 'সকল শ্রেণী' : 'All Classes'}</option>
                         {classes.map(c => (
                           <option key={c.id} value={c.id}>{c.class_name}</option>
                         ))}
                      </select>
                   </div>
                 )}
                 
                 {/* Title */}
                 <div className={`space-y-2 ${layoutType !== 'class_left' ? 'lg:col-span-1' : 'md:col-span-2'}`}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'রুটিনের শিরোনাম' : 'Routine Title'}</label>
                    <input 
                       type="text" 
                       value={routineTitle} 
                       onChange={e => setRoutineTitle(e.target.value)}
                       className={`w-full h-12 rounded-xl px-4 font-bold outline-none border focus:ring-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-blue-500'}`}
                    />
                 </div>
                 
                 {/* Theme Color */}
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Palette size={14}/> {lang === 'bn' ? 'থিম কালার' : 'Theme Color'}</label>
                    <div className="flex gap-2">
                      {Object.keys(routineThemes).map((colorKey) => (
                        <button
                          key={colorKey}
                          onClick={() => setRoutineThemeColor(colorKey)}
                          className={`w-10 h-10 rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center ${routineThemeColor === colorKey ? 'scale-110 shadow-lg' : 'hover:scale-105'}`}
                          style={{
                            backgroundColor: routineThemes[colorKey as keyof typeof routineThemes].primary,
                            borderColor: routineThemeColor === colorKey ? routineThemes[colorKey as keyof typeof routineThemes].border : 'transparent',
                            boxShadow: routineThemeColor === colorKey ? `0 4px 12px ${routineThemes[colorKey as keyof typeof routineThemes].shadow}` : 'none'
                          }}
                        >
                           {routineThemeColor === colorKey && <Check size={16} className="text-white" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                 </div>

                 {/* Layout Type Selection */}
                 <div className="space-y-2 md:col-span-2 lg:col-span-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><LayoutGrid size={14}/> {lang === 'bn' ? 'রুটিন লেআউট' : 'Routine Layout'}</label>
                   <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
                     <button 
                       onClick={() => setLayoutType('day_left')}
                       className={`flex-1 h-9 rounded-lg text-[10px] font-black tracking-wider transition-all flex items-center justify-center gap-1 ${layoutType === 'day_left' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       <Calendar size={12} /> {lang === 'bn' ? 'দিন বামে' : 'Day-wise'}
                     </button>
                     <button 
                       onClick={() => setLayoutType('class_left')}
                       className={`flex-1 h-9 rounded-lg text-[10px] font-black tracking-wider transition-all flex items-center justify-center gap-1 ${layoutType === 'class_left' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       <Users size={12} /> {lang === 'bn' ? 'শ্রেণী বামে' : 'Class-wise'}
                     </button>
                   </div>
                 </div>

                 {/* Day Selection (Hiding as requested) */}
                 {layoutType === 'period_left' && (
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'বারের তালিকা' : 'Select Day'}</label>
                     <select 
                       value={selectedDay} 
                       onChange={e => setSelectedDay(e.target.value)}
                       className={`w-full h-11 rounded-xl px-4 font-bold outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-blue-500'}`}
                     >
                       {activeDays.map(d => (
                         <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn : d.en}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {/* Action Buttons */}
                 <div className="space-y-2 flex flex-col justify-end lg:col-span-1">
                    <div className="flex gap-2">
                       <button onClick={handleSaveRoutine} disabled={saving} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                         {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>}
                         {lang === 'bn' ? 'সেভ' : 'Save'}
                       </button>
                       <button onClick={() => handleDownloadPDF(pdfContentRef)} disabled={downloading} className="flex-1 h-12 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                         {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16}/>}
                         {lang === 'bn' ? 'ডাউনলোড' : 'Download'}
                       </button>
                    </div>
                 </div>
              </div>

              {/* Instructions Section */}
              <div className="grid grid-cols-1 gap-8 pt-4 border-t border-slate-100 font-noto">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}</h4>
                    <button onClick={() => setRoutineInstructions([...routineInstructions, ''])} className="text-blue-600 font-bold text-[10px] uppercase tracking-wider hover:underline flex items-center gap-1">
                      <Plus size={14}/> {lang === 'bn' ? 'যোগ করুন' : 'Add New'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {routineInstructions.map((inst, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text" 
                          value={inst} 
                          onChange={e => {
                            const newInst = [...routineInstructions];
                            newInst[idx] = e.target.value;
                            setRoutineInstructions(newInst);
                          }}
                          className={`flex-1 h-10 rounded-lg px-3 text-sm font-medium border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                          placeholder={lang === 'bn' ? `${idx + 1} । নির্দেশনা লিখুন` : `Instruction ${idx + 1}`}
                        />
                        <button onClick={() => setRoutineInstructions(routineInstructions.filter((_, i) => i !== idx))} className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
           </div>


           {/* Live Preview / Builder Area */}
           <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{lang === 'bn' ? 'লাইভ প্রিভিউ' : 'Live Preview'}</h3>
                 <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                      <button onClick={() => setUserZoom(z => Math.max(0.5, z - 0.2))} className="p-1.5 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors" title={lang === 'bn' ? 'জুম আউট' : 'Zoom Out'}><ZoomOut size={16} /></button>
                      <span className="text-[11px] font-black text-slate-700 min-w-[44px] text-center">{Math.round(userZoom * 100)}%</span>
                      <button onClick={() => setUserZoom(z => Math.min(3, z + 0.2))} className="p-1.5 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors" title={lang === 'bn' ? 'জুম ইন' : 'Zoom In'}><ZoomIn size={16} /></button>
                      <div className="w-[1px] h-4 bg-slate-300 mx-0.5"></div>
                      <button onClick={() => setUserZoom(1)} className="p-1.5 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors" title={lang === 'bn' ? 'রিসেট জুম' : 'Reset Zoom'}><Maximize size={14} /></button>
                    </div>
                    <div className="hidden sm:block text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-blue-50/50 border border-blue-100 text-blue-800 px-2 py-1.5 rounded-lg whitespace-nowrap">
                      {lang === 'bn' ? 'এ৪ সাইজ (ল্যান্ডস্কেপ)' : 'A4 Size (Landscape)'}
                    </div>
                 </div>
              </div>

              <div 
                ref={previewContainerRef}
                className="w-full py-8 px-2 sm:px-8 bg-slate-100/50 rounded-[2.8rem] border border-slate-200/50 overflow-auto custom-scrollbar text-center"
                style={{ minHeight: `${794 * previewScale * userZoom + 40}px`, maxHeight: '75vh' }}
              >
                 <div 
                   className="relative shrink-0 inline-flex items-start text-left mx-auto"
                   style={{ 
                     width: `${1123 * previewScale * userZoom}px`,
                     height: `${794 * previewScale * userZoom}px`
                   }}
                 >
                   <div 
                     className="shadow-3xl origin-top-left transition-transform duration-200 bg-white font-noto rounded-lg absolute top-0 left-0"
                     style={{ 
                       transform: `scale(${previewScale * userZoom})`,
                       width: '1123px',
                       height: '794px'
                     }}
                   >
                     {/* The Container to capture for PDF */}
                     <div ref={pdfContentRef} className="text-slate-800 w-[1123px] min-h-[794px] p-10 bg-white relative border-[10px] flex flex-col justify-between" style={{ borderColor: `${rtTheme.primary}1a` }}>
                        
                        {/* Frame Design corners */}
                        <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 rounded-tl-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                        <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 rounded-tr-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 rounded-bl-xl m-2" style={{ borderColor: rtTheme.primary }}></div>
                        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 rounded-br-xl m-2" style={{ borderColor: rtTheme.primary }}></div>

                        <div className="flex-1 flex flex-col justify-between relative z-10">
                          {/* Banner Block */}
                          <div className="flex justify-between items-center w-full px-2 py-2 rounded-3xl border mb-3 relative" style={{ backgroundColor: `${rtTheme.light}66`, borderColor: `${rtTheme.primary}1a`, backgroundImage: `linear-gradient(to right, ${rtTheme.light}33, ${rtTheme.accent}66)` }}>
                            
                            {/* Left Column: Logotype */}
                            <div className="flex-shrink-0 flex items-center justify-center pl-4">
                              <div className="relative p-1 rounded-full border bg-white shadow-sm" style={{ borderColor: rtTheme.primary }}>
                                {madrasah?.logo_url ? (
                                  <img src={madrasah.logo_url} className="w-[85px] h-[85px] object-contain rounded-full bg-white" alt="Logo" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                ) : (
                                  <div className="w-[85px] h-[85px] bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 font-black text-[10px]">LOGO</div>
                                )}
                              </div>
                            </div>

                            {/* Center Column: Madrasah Title, location, etc */}
                            <div className="flex-1 text-center px-3 leading-normal">
                              <h1 className="text-[32px] font-black tracking-tight leading-none mb-1 font-noto" style={{ color: rtTheme.primary }}>
                                {madrasah?.name || 'মাদরাসার নাম'}
                              </h1>
                              
                              <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-[#475569] leading-tight flex-wrap font-noto">
                                <span className="inline-flex items-center gap-0.5 italic" style={{ color: rtTheme.primary }}>
                                  {madrasah?.address || 'ঠিকানা'}
                                </span>
                                {(madrasah?.phone || madrasah?.phone) && (
                                  <>
                                    <span className="text-slate-300">|</span>
                                    <span className="inline-flex items-center gap-0.5" style={{ color: rtTheme.primary }}>
                                      {lang === 'bn' ? 'মোবাইলঃ ' : 'Mobile: '} {madrasah?.phone}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Center pill badge */}
                              <div className="mt-2 inline-block">
                                <div className="text-white px-8 py-2 rounded-2xl shadow-sm text-[14px] font-black tracking-wide border flex items-center gap-2" style={{ backgroundColor: rtTheme.primary, borderColor: `${rtTheme.primary}80` }}>
                                  <LayoutGrid size={16} />
                                  {routineTitle}
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Solid Premium Box */}
                            <div className="flex-shrink-0 w-[160px] h-[105px] text-white rounded-2xl flex flex-col justify-center p-3 border shadow mr-4" style={{ backgroundColor: rtTheme.primary, borderColor: `${rtTheme.primary}b3` }}>
                              <div className="flex items-center justify-center mb-1">
                                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center font-black text-sm" style={{ color: rtTheme.primary }}>
                                  📅
                                </div>
                              </div>
                              <div className="text-center leading-tight">
                                <p className="text-[11px] font-black mb-0.5 uppercase tracking-widest" style={{ color: rtTheme.accent }}>
                                  Class Routine
                                </p>
                                <p className="text-[11px] font-extrabold block mb-0.5" style={{ color: `${rtTheme.accent}cc` }}>
                                  {lang === 'bn' ? 'শিক্ষাবর্ষ' : 'Academic Session'}
                                </p>
                                <p className="text-[10px] font-semibold text-white/70 block">
                                  {new Date().getFullYear()} - {new Date().getFullYear() + 1}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Routine Table Container */}
                          <div className="flex-1 mt-2 overflow-x-auto pb-4 custom-scrollbar relative">
                            {layoutType === 'day_left' ? (
                              <table className="w-full border-collapse border-2 rounded-xl shadow-sm text-center table-fixed" style={{ borderColor: rtTheme.primary }}>
                                <thead>
                                   <tr className="text-white h-11 border-b" style={{ backgroundColor: rtTheme.primary, borderColor: rtTheme.primary }}>
                                      <th className="border-r px-2 py-1.5 text-xs font-black w-32" style={{ borderColor: `${rtTheme.primary}b3`, backgroundColor: rtTheme.primary }}>
                                         <div className="flex flex-col items-center justify-center leading-tight">
                                            <span className="text-[11px] tracking-widest uppercase mb-0.5" style={{ color: rtTheme.accent }}>{lang === 'bn' ? 'দিন / বার' : 'DAYS'}</span>
                                            <Clock size={10} className="opacity-50" />
                                         </div>
                                      </th>
                                      {periods.map((p, idx) => (
                                        <th key={p.id} className={`border-r p-1 text-[11px] font-black relative group ${p.isBreak ? 'w-16 bg-emerald-50' : ''} ${idx !== periods.length - 1 ? 'border-r' : ''}`} style={{ borderColor: `${rtTheme.primary}b3`, backgroundColor: p.isBreak ? `${rtTheme.accent}cc` : rtTheme.primary, color: p.isBreak ? rtTheme.primary : 'white' }}>
                                           {!p.isBreak ? (
                                             <div className="flex flex-col items-center gap-0.5 font-noto">
                                                <input 
                                                  type="text"
                                                  value={p.title}
                                                  onChange={(e) => {
                                                    const newPeriods = [...periods];
                                                    newPeriods[idx].title = e.target.value;
                                                    setPeriods(newPeriods);
                                                  }}
                                                  className="w-full bg-transparent text-center border-none outline-none focus:ring-1 focus:ring-white/30 rounded p-0 text-[10px] font-black placeholder-white/50"
                                                />
                                                <input 
                                                  type="text"
                                                  value={p.time}
                                                  onChange={(e) => {
                                                    const newPeriods = [...periods];
                                                    newPeriods[idx].time = e.target.value;
                                                    setPeriods(newPeriods);
                                                  }}
                                                  className="w-full bg-transparent text-center border-none outline-none focus:ring-1 focus:ring-white/30 rounded p-0 text-[8px] opacity-70 font-bold placeholder-white/30"
                                                />
                                             </div>
                                           ) : (
                                             <div className="flex flex-col items-center py-1 font-noto">
                                                <textarea 
                                                  value={p.title}
                                                  onChange={(e) => {
                                                    const newPeriods = [...periods];
                                                    newPeriods[idx].title = e.target.value;
                                                    setPeriods(newPeriods);
                                                  }}
                                                  className="w-full bg-transparent text-center border-none outline-none focus:ring-1 focus:ring-slate-400/30 rounded p-0 text-[8px] font-black uppercase tracking-widest opacity-80 resize-none h-12"
                                                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                                />
                                             </div>
                                           )}
                                           <button 
                                             onClick={() => removePeriod(p.id)} 
                                             data-html2canvas-ignore="true"
                                             className="download-hide absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg z-30 hover:scale-125 active:scale-95 transition-all border-2 border-white"
                                           >
                                             <X size={12}/>
                                           </button>
                                        </th>
                                      ))}
                                   </tr>
                                </thead>
                                <tbody>
                                   {activeDays.map((day, dIdx) => (
                                     <tr key={day.id} className="border-b h-[2.75rem]" style={{ borderColor: `${rtTheme.primary}26`, backgroundColor: dIdx % 2 === 0 ? 'white' : `${rtTheme.light}4d` }}>
                                       <td className="border-r p-2 font-black text-xs text-center" style={{ borderColor: rtTheme.primary, backgroundColor: `${rtTheme.light}66`, color: rtTheme.primary }}>
                                         {lang === 'bn' ? day.bn : day.en}
                                       </td>
                                       {periods.map((p, idx) => (
                                         <td key={p.id} className={`border-r p-1 align-middle text-center relative ${p.isBreak ? 'bg-slate-50/50' : ''}`} style={{ borderColor: `${rtTheme.primary}26` }}>
                                            {!p.isBreak ? (
                                              <RoutineCell 
                                                 value={routineMatrix[`${day.id}_${p.id}`] || ''}
                                                 onChange={(val) => handleCellChange(day.id, p.id, val)}
                                                 theme={rtTheme}
                                              />
                                            ) : (
                                              <div className="w-full h-full flex flex-col items-center justify-center opacity-10 gap-1">
                                                 <Coffee size={18} style={{ color: rtTheme.primary }} />
                                              </div>
                                            )}
                                         </td>
                                       ))}
                                     </tr>
                                   ))}
                                </tbody>
                              </table>
                            ) : (
                              /* Old Layout: Class Wise (Classes on Left) */
                              <table className="w-full border-collapse border-2 rounded-xl shadow-sm text-center table-fixed shrink-0" style={{ borderColor: rtTheme.primary }}>
                                <thead>
                                   <tr className="text-white h-11 border-b" style={{ backgroundColor: rtTheme.primary, borderColor: rtTheme.primary }}>
                                      <th className="border-r px-2 py-1.5 text-xs font-black w-32" style={{ borderColor: `${rtTheme.primary}b3`, backgroundColor: rtTheme.primary }}>
                                         <div className="flex flex-col items-center justify-center leading-tight">
                                            <span className="text-[11px] tracking-widest uppercase mb-0.5" style={{ color: rtTheme.accent }}>
                                              {lang === 'bn' ? 'শ্রেণী' : 'Class'}
                                            </span>
                                            <span className="text-[9px] opacity-70">{lang === 'bn' ? 'রুটিন' : 'Routine'}</span>
                                         </div>
                                      </th>
                                      {periods.map((p, idx) => (
                                        <th key={p.id} className={`border-r p-1 text-[11px] font-black relative group ${p.isBreak ? 'w-16 bg-emerald-50' : ''} ${idx !== periods.length - 1 ? 'border-r' : ''}`} style={{ borderColor: `${rtTheme.primary}b3`, backgroundColor: p.isBreak ? `${rtTheme.accent}cc` : rtTheme.primary, color: p.isBreak ? rtTheme.primary : 'white' }}>
                                           {!p.isBreak ? (
                                             <div className="flex flex-col items-center gap-0.5 font-noto">
                                                <span className="text-[10px] font-black">{p.title}</span>
                                                <span className="text-[8px] opacity-70 font-bold">{p.time}</span>
                                             </div>
                                           ) : (
                                             <div className="flex flex-col items-center py-1 font-noto">
                                                <span className="text-[8px] font-black uppercase tracking-widest opacity-80" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                                  {p.title}
                                                </span>
                                             </div>
                                           )}
                                           <button 
                                             onClick={() => removePeriod(p.id)} 
                                             data-html2canvas-ignore="true"
                                             className="download-hide absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg z-30 hover:scale-125 active:scale-95 transition-all border-2 border-white"
                                           >
                                             <X size={12}/>
                                           </button>
                                        </th>
                                      ))}
                                   </tr>
                                </thead>
                                <tbody>
                                   {classes.length > 0 ? classes.map((cls, cIdx) => (
                                     <tr key={cls.id} className="border-b h-[2.75rem]" style={{ borderColor: `${rtTheme.primary}26`, backgroundColor: cIdx % 2 === 0 ? 'white' : `${rtTheme.light}4d` }}>
                                       <td className="border-r p-2 font-black text-xs text-center" style={{ borderColor: rtTheme.primary, backgroundColor: `${rtTheme.light}66`, color: rtTheme.primary }}>
                                         {cls.class_name}
                                       </td>
                                       {periods.map((p, idx) => (
                                         <td key={p.id} className={`border-r p-1 align-middle text-center relative ${p.isBreak ? 'bg-slate-50/50' : ''}`} style={{ borderColor: `${rtTheme.primary}26` }}>
                                            {!p.isBreak ? (
                                              <RoutineCell 
                                                 value={routineMatrix[`${cls.id}_${p.id}_${selectedDay}`] || routineMatrix[`${cls.id}_${p.id}`] || (selectedClassId === cls.id ? routineMatrix[`${selectedDay}_${p.id}`] : '')}
                                                 onChange={(val) => handleCellChange(`${cls.id}_${p.id}`, selectedDay, val)}
                                                 theme={rtTheme}
                                              />
                                            ) : (
                                              <div className="w-full h-full flex flex-col items-center justify-center opacity-10 gap-1">
                                                 <Coffee size={18} style={{ color: rtTheme.primary }} />
                                              </div>
                                            )}
                                         </td>
                                       ))}
                                     </tr>
                                   )) : (
                                      <tr>
                                        <td colSpan={periods.length + 1} className="py-10 text-center font-bold text-slate-400 bg-slate-50">
                                          {lang === 'bn' ? 'কোনো শ্রেণী পাওয়া যায়নি' : 'No classes found'}
                                        </td>
                                      </tr>
                                   )}
                                </tbody>
                              </table>
                            )}

                            {/* Watermark */}
                            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none -rotate-12 select-none">
                              {madrasah?.logo_url ? (
                                <img src={madrasah.logo_url} className="w-[330px] h-[330px] object-contain" alt="" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                              ) : (
                                <div className="text-9xl font-black" style={{ color: rtTheme.primary }}>{madrasah?.name?.slice(0, 1) || 'ম'}</div>
                              )}
                            </div>
                          </div>

                          {/* Footer Block */}
                          <div className="mt-2 flex justify-between items-end pt-3 border-t" style={{ borderColor: `${rtTheme.primary}1a` }}>
                            {/* Left Column: Instructions */}
                            <div className="max-w-[430px] text-left leading-relaxed">
                               <div className="text-white px-3 py-1 rounded-lg inline-flex items-center gap-1.5 text-[11px] font-black mb-1.5 shadow-sm uppercase font-noto" style={{ backgroundColor: rtTheme.primary }}>
                                 <span>📖</span>
                                 {lang === 'bn' ? 'বিশেষ নির্দেশনা' : 'Special Instructions'}
                               </div>
                               <ul className="space-y-0.5 max-h-[105px] overflow-hidden pr-2">
                                  {routineInstructions.filter(Boolean).map((inst, i) => (
                                    <li key={i} className="flex gap-1.5 text-[10px] font-bold text-slate-600 leading-normal">
                                      <span className="font-extrabold" style={{ color: rtTheme.primary }}>{i + 1} ।</span>
                                      <span>{inst}</span>
                                    </li>
                                  ))}
                               </ul>
                            </div>

                            {/* Right Column: Signature */}
                            <div className="text-center min-w-[200px]">
                              <div className="relative pt-8">
                                <div className="h-px bg-slate-300 w-full mb-1"></div>
                                <p className="text-[11px] font-black" style={{ color: rtTheme.primary }}>
                                  {lang === 'bn' ? 'অধ্যক্ষ / পরিচালক' : 'Principal / Director'}
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 mt-1">{madrasah?.name}</p>
                              </div>
                            </div>
                          </div>

                          {/* Deenora Portal bottom tagline */}
                          <div className="text-center mt-3 pt-1 text-[8px] font-bold text-slate-300 border-t border-slate-100 tracking-wider font-mono">
                             {lang === 'bn' ? 'মাদরাসা ম্যানেজমেন্ট সিস্টেম ২০২৬ • ডিজিটাল প্রযুক্তি সহায়িকা' : 'MADRASAH MANAGEMENT SYSTEM • POWERED BY DEENORA'}
                          </div>
                        </div>
                     </div>
                   </div>
                 </div>
              </div>

              {/* Add column controls outside the PDF visual layout */}
              <div className="flex gap-2 justify-center mt-4">
                 <button onClick={() => addPeriod(false)} className="px-4 py-2 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-xl flex items-center gap-1 uppercase tracking-widest"><Plus size={14}/> {lang === 'bn' ? 'নতুন ক্লাস যোগ করুন' : 'Add Class Column'}</button>
                 <button onClick={() => addPeriod(true)} className="px-4 py-2 bg-amber-50 text-amber-600 font-bold text-[10px] rounded-xl flex items-center gap-1 uppercase tracking-widest"><Plus size={14}/> {lang === 'bn' ? 'নতুন বিরতি যোগ করুন' : 'Add Break Column'}</button>
              </div>
           </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-50/90 text-emerald-700 border-emerald-100' :
            toast.type === 'error' ? 'bg-red-50/90 text-red-700 border-red-100' :
            'bg-blue-50/90 text-blue-700 border-blue-100'
          }`}>
             {toast.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> :
              toast.type === 'error' ? <AlertCircle size={20} className="text-red-500" /> :
              <Info size={20} className="text-blue-500" />}
            <span className="font-bold text-sm tracking-wide">{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassRoutine;
