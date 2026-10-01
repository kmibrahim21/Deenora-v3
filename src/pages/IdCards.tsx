import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Download, 
  ShieldCheck, 
  Users, 
  GraduationCap, 
  Settings2, 
  CheckCircle2, 
  Sparkles,
  Search,
  Eye,
  Layers,
  Palette
} from 'lucide-react';
import { Institution, Profile, Class, Student, Language, Teacher } from '../types';
import { supabase } from '../supabase';
import { t } from '../translations';
import StudentIdCardGenerator from '../components/StudentIdCardGenerator';
import TeacherIdCardGenerator from '../components/TeacherIdCardGenerator';
import IdCardDesignCustomizer from '../components/idcard/IdCardDesignCustomizer';
import { IdCardDesignSettings, DEFAULT_ID_CARD_DESIGN } from '../types/idCardDesign';
import { requestManager } from 'services/RequestManager';
import { sortMadrasahClasses } from 'pages/Classes';
import { motion, AnimatePresence } from 'motion/react';

interface IdCardsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile: Profile | null;
}

const loadSavedDesignSettings = (madrasah: Institution | null, cardType: 'student' | 'teacher'): IdCardDesignSettings => {
  const defaultThemeColor = cardType === 'teacher' ? '#0F766E' : '#1E3A8A';
  const defaults: IdCardDesignSettings = { 
    ...DEFAULT_ID_CARD_DESIGN, 
    themeColor: defaultThemeColor 
  };

  try {
    const configKey = cardType === 'teacher' ? 'teacher_id_card_design' : 'id_card_design';
    const localKey = cardType === 'teacher' ? 'deenora_teacher_idcard_design_settings' : 'deenora_idcard_design_settings';
    
    // 1. Check cloud database (madrasah.config_json)
    const dbConfig = (madrasah?.config_json as any)?.[configKey];
    if (dbConfig && typeof dbConfig === 'object') {
      return { ...defaults, ...dbConfig };
    }

    // 2. Check localStorage
    const local = localStorage.getItem(localKey);
    if (local) {
      return { ...defaults, ...JSON.parse(local) };
    }
  } catch (err) {
    console.warn('Failed to load saved id card design settings:', err);
  }
  return defaults;
};

const IdCards: React.FC<IdCardsProps> = ({ lang, madrasah, onBack, profile }) => {
  const [mainTab, setMainTab] = useState<'download' | 'design'>('download');
  const [roleTab, setRoleTab] = useState<'students' | 'teachers'>('students');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [isSavedDesign, setIsSavedDesign] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Design Settings states for Student and Teacher cards
  const [studentDesign, setStudentDesign] = useState<IdCardDesignSettings>(() => 
    loadSavedDesignSettings(madrasah, 'student')
  );
  const [teacherDesign, setTeacherDesign] = useState<IdCardDesignSettings>(() => 
    loadSavedDesignSettings(madrasah, 'teacher')
  );

  const isDark = madrasah?.theme === 'dark';
  const isBn = lang === 'bn';

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, [madrasah]);

  useEffect(() => {
    if (madrasah) {
      setStudentDesign(loadSavedDesignSettings(madrasah, 'student'));
      setTeacherDesign(loadSavedDesignSettings(madrasah, 'teacher'));
    }
  }, [madrasah?.id]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchClasses = async () => {
    if (!madrasah) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
        `classes:${madrasah.id}`,
        30 * 60 * 1000
      );

      if (error) throw error;
      const sortedClasses = sortMadrasahClasses(data || []);
      setClasses(sortedClasses);
      if (sortedClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(sortedClasses[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    if (!madrasah) return;
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('institution_id', madrasah.id)
        .eq('class_id', classId)
        .order('roll', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      if (data && data.length > 0) {
        setSelectedStudentId(data[0].id);
      } else {
        setSelectedStudentId('');
      }
    } catch (err: any) {
      console.error('Error fetching students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchTeachers = async () => {
    if (!madrasah) return;
    setLoadingTeachers(true);
    try {
      const response = await fetch(
        `/api/teachers/list?institute_id=${madrasah.id}&t=${Date.now()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch teachers");
      const data = await response.json();
      const teacherList = data.teachers || [];
      setTeachers(teacherList);
      if (teacherList.length > 0) {
        setSelectedTeacherId(teacherList[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!madrasah) return;
    setIsSavingDesign(true);
    const activeDesign = roleTab === 'students' ? studentDesign : teacherDesign;
    const configKey = roleTab === 'students' ? 'id_card_design' : 'teacher_id_card_design';
    const localKey = roleTab === 'students' ? 'deenora_idcard_design_settings' : 'deenora_teacher_idcard_design_settings';

    try {
      // 1. Save to LocalStorage
      localStorage.setItem(localKey, JSON.stringify(activeDesign));

      // 2. Save to Supabase Cloud Database
      const currentConfig = (typeof madrasah.config_json === 'object' && madrasah.config_json !== null)
        ? madrasah.config_json
        : {};

      const updatedConfig = {
        ...currentConfig,
        [configKey]: activeDesign
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) {
        console.warn('Cloud database update warning:', error);
      } else {
        (madrasah as any).config_json = updatedConfig;
      }

      setIsSavedDesign(true);
      showToast(isBn ? 'আইডি কার্ডের ডিজাইন সফলভাবে সংরক্ষণ করা হয়েছে!' : 'ID card design saved successfully!');
      setTimeout(() => setIsSavedDesign(false), 3500);
    } catch (e) {
      console.error('Failed to save ID card design:', e);
      showToast(isBn ? 'ডিজাইন সংরক্ষণে সমস্যা হয়েছে' : 'Failed to save design');
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleResetDesign = () => {
    const defaultSettings: IdCardDesignSettings = {
      ...DEFAULT_ID_CARD_DESIGN,
      themeColor: roleTab === 'teachers' ? '#0F766E' : '#1E3A8A'
    };
    if (roleTab === 'students') {
      setStudentDesign(defaultSettings);
    } else {
      setTeacherDesign(defaultSettings);
    }
    const localKey = roleTab === 'students' ? 'deenora_idcard_design_settings' : 'deenora_teacher_idcard_design_settings';
    localStorage.setItem(localKey, JSON.stringify(defaultSettings));
    showToast(isBn ? 'ডিজাইন ডিফল্ট মানে রিসেট করা হয়েছে' : 'Design reset to defaults');
  };

  // Sample data fallback for live preview in customization tab
  const sampleStudent: Student = {
    id: 'sample-student-01',
    institution_id: madrasah?.id || '',
    student_name: 'মোহাম্মদ আব্দুল্লাহ',
    name_en: 'MD. ABDULLAH',
    class_id: selectedClassId || 'sample-class',
    roll: 1,
    admission_number: '2026-001',
    guardian_phone: '01712345678',
    date_of_birth: '2015-05-12',
    blood_group: 'O+',
    father_name: 'আব্দুর রহমান',
    mother_name: 'ফাতেমা বেগম',
    present_address: 'মিরপুর, ঢাকা',
    photo_url: '',
    gender: 'male',
    classes: { class_name: classes.find(c => c.id === selectedClassId)?.class_name || 'হিফজুল কুরআন' }
  } as any;

  const sampleTeacher: Teacher = {
    id: 'sample-teacher-01',
    institution_id: madrasah?.id || '',
    name: 'মাওলানা আহমাদ উল্লাহ',
    designation: 'প্রধান শিক্ষক',
    phone: '01812345678',
    blood_group: 'A+',
    address: 'ঢাকা, বাংলাদেশ',
    photo_url: '',
    gender: 'male'
  } as any;

  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0] || sampleStudent;
  const activeTeacher = teachers.find(t => t.id === selectedTeacherId) || teachers[0] || sampleTeacher;
  const isBulk = roleTab === 'students' ? selectedStudentId === 'all' : selectedTeacherId === 'all';

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-32 ${isDark ? 'text-white' : 'text-slate-800'}`}>
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 text-sm font-black"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header Bar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border transition-all ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'}`}>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button 
            onClick={onBack} 
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl active:scale-95 transition-all cursor-pointer shrink-0 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            title={isBn ? 'পিছনে যান' : 'Go Back'}
          >
            <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className={`text-base sm:text-xl font-black font-solaiman truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {isBn ? 'পরিচয় পত্র (ID Cards)' : 'ID Cards Generator'}
            </h2>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mt-0.5 truncate">
              <ShieldCheck size={12} className="text-blue-500 shrink-0" /> 
              <span className="truncate">{madrasah?.name || 'Deenora Madrasah'}</span>
            </p>
          </div>
        </div>

        {/* Student / Teacher Role Switcher - Mobile Responsive Grid */}
        <div className={`grid grid-cols-2 p-1 rounded-2xl border w-full sm:w-auto sm:flex sm:items-center gap-1 shadow-inner ${isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100 border-slate-200'}`}>
          <button 
            type="button"
            onClick={() => setRoleTab('students')}
            className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              roleTab === 'students' 
                ? (isDark ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30' : 'bg-white text-blue-700 shadow-sm border border-slate-200/50') 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap size={16} className={roleTab === 'students' ? 'text-white dark:text-white' : 'text-slate-400'} />
            <span>{isBn ? 'শিক্ষার্থী' : 'Students'}</span>
            {students.length > 0 && roleTab === 'students' && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isDark ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                {students.length}
              </span>
            )}
          </button>

          <button 
            type="button"
            onClick={() => setRoleTab('teachers')}
            className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              roleTab === 'teachers' 
                ? (isDark ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30' : 'bg-white text-teal-700 shadow-sm border border-slate-200/50') 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users size={16} className={roleTab === 'teachers' ? 'text-white dark:text-white' : 'text-slate-400'} />
            <span>{isBn ? 'শিক্ষক' : 'Teachers'}</span>
            {teachers.length > 0 && roleTab === 'teachers' && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isDark ? 'bg-teal-700 text-teal-100' : 'bg-teal-100 text-teal-800'}`}>
                {teachers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar Controls & Live Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (Sidebar) - Tabs: Download vs Customization */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Main Tab Switcher (Matching Admission Form Tab Layout) */}
          <div className={`flex p-1.5 rounded-2xl shadow-inner border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300/60'}`}>
            <button
              type="button"
              onClick={() => setMainTab('download')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                mainTab === 'download'
                  ? (isDark ? 'bg-slate-800 text-blue-400 shadow-md border border-slate-700' : 'bg-white text-blue-600 shadow-sm')
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Download size={16} />
              <span>{isBn ? 'ডাউনলোড' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMainTab('design')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                mainTab === 'design'
                  ? (isDark ? 'bg-slate-800 text-blue-400 shadow-md border border-slate-700' : 'bg-white text-blue-600 shadow-sm')
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Settings2 size={16} />
              <span>{isBn ? 'ডিজাইন কাস্টমাইজ' : 'Customization'}</span>
            </button>
          </div>

          {/* TAB 1: DOWNLOAD CONTROLS */}
          {mainTab === 'download' && (
            <motion.div 
              key="tab-download"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className={`p-5 sm:p-6 rounded-[2rem] border shadow-sm space-y-5 transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider font-noto">
                      {roleTab === 'students' 
                        ? (isBn ? 'শিক্ষার্থী নির্বাচন ও ডাউনলোড' : 'Student Selection & Download')
                        : (isBn ? 'শিক্ষক নির্বাচন ও ডাউনলোড' : 'Teacher Selection & Download')
                      }
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {isBn ? 'সিঙ্গেল অথবা পুরো ক্লাসের বাল্ক আইডি কার্ড ডাউনলোড' : 'Download single or bulk class cards'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setMainTab('design')}
                  className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1.5 rounded-xl cursor-pointer"
                >
                  <Settings2 size={13} />
                  <span>{isBn ? 'ডিজাইন' : 'Design'}</span>
                </button>
              </div>

              {roleTab === 'students' ? (
                <div className="space-y-4">
                  {/* Class Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
                      {isBn ? 'শ্রেণী নির্বাচন করুন' : 'Select Class'}
                    </label>
                    {loadingConfig ? (
                      <div className={`h-12 animate-pulse rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    ) : (
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className={`w-full border text-xs sm:text-sm font-bold rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="">{t('select_class', lang)}</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.class_name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Student Selector */}
                  {selectedClassId && (
                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
                        {isBn ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student'}
                      </label>
                      {loadingStudents ? (
                        <div className={`h-12 animate-pulse rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                      ) : students.length > 0 ? (
                        <select
                          value={selectedStudentId}
                          onChange={(e) => setSelectedStudentId(e.target.value)}
                          className={`w-full border text-xs sm:text-sm font-bold rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="all">{isBn ? '📁 সকল শিক্ষার্থী (বাল্ক ডাউনলোড)' : '📁 All Students (Bulk Download)'}</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.roll ? `রোল ${s.roll} - ` : ''}{s.student_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-bold border border-amber-500/20">
                          {isBn ? 'এই শ্রেণীতে কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found in this class'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info helper card */}
                  <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${isDark ? 'bg-slate-800/40 border-slate-700/60 text-slate-300' : 'bg-blue-50/50 border-blue-100 text-slate-600'}`}>
                    <div className="flex items-center gap-2 font-black text-blue-600 dark:text-blue-400">
                      <Sparkles size={14} />
                      <span>{isBn ? 'সহজ টিপস' : 'Quick Tip'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {isBn 
                        ? 'সিঙ্গেল কার্ড ডাউনলোড করতে ড্রপডাউন থেকে একজন শিক্ষার্থী সিলেক্ট করুন অথবা এক ক্লিকে পুরো ক্লাসের আইডি কার্ড একসাথে প্রিন্ট/ডাউনলোড করতে "সকল শিক্ষার্থী" অপশনটি বেছে নিন।'
                        : 'Select an individual student for a single card or choose "All Students" to generate and download an A4 grid for the entire class.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Teacher Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
                      {isBn ? 'শিক্ষক নির্বাচন করুন' : 'Select Teacher'}
                    </label>
                    {loadingTeachers ? (
                      <div className={`h-12 animate-pulse rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    ) : teachers.length > 0 ? (
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className={`w-full border text-xs sm:text-sm font-bold rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="all">{isBn ? '📁 সকল শিক্ষক (বাল্ক ডাউনলোড)' : '📁 All Teachers (Bulk Download)'}</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.designation ? `(${t.designation})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-bold border border-amber-500/20">
                        {isBn ? 'কোনো শিক্ষক পাওয়া যায়নি' : 'No teachers found'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: DESIGN CUSTOMIZER */}
          {mainTab === 'design' && (
            <motion.div
              key="tab-design"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
            >
              <IdCardDesignCustomizer
                settings={roleTab === 'students' ? studentDesign : teacherDesign}
                onUpdate={(newSettings) => {
                  if (roleTab === 'students') {
                    setStudentDesign(newSettings);
                  } else {
                    setTeacherDesign(newSettings);
                  }
                }}
                onSave={handleSaveDesign}
                onReset={handleResetDesign}
                isSaving={isSavingDesign}
                isSaved={isSavedDesign}
                lang={lang}
                cardType={roleTab === 'students' ? 'student' : 'teacher'}
                isDark={isDark}
              />
            </motion.div>
          )}
        </div>

        {/* Right Column (Live ID Card Preview & Download Action View) */}
        <div className="lg:col-span-7">
          {roleTab === 'students' ? (
            <StudentIdCardGenerator 
              student={activeStudent} 
              madrasah={madrasah} 
              lang={lang} 
              onClose={() => {}} 
              isBulk={isBulk}
              allStudents={students}
              designSettings={studentDesign}
              onUpdateDesign={(newSettings) => setStudentDesign(newSettings)}
            />
          ) : (
            <TeacherIdCardGenerator 
              teacher={activeTeacher} 
              madrasah={madrasah} 
              lang={lang} 
              onClose={() => {}} 
              isBulk={isBulk}
              allTeachers={teachers}
              designSettings={teacherDesign}
              onUpdateDesign={(newSettings) => setTeacherDesign(newSettings)}
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default IdCards;
