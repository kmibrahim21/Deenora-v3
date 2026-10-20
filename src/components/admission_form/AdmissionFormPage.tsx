
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ADMISSION_T } from './constants';
import { AdmissionFormData, AdmissionFormLang, AdmissionFormConfig } from './types';
import AdmissionFormPreview from './AdmissionFormPreview';
import DesignCustomizer from './DesignCustomizer';
import { 
  Globe, 
  Download, 
  ArrowLeft, 
  Search, 
  User, 
  Settings2, 
  Sparkles, 
  CheckCircle2, 
  FileText, 
  Printer, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Eye, 
  GraduationCap, 
  Check, 
  FileSpreadsheet 
} from 'lucide-react';
import { Institution, Student } from '../../types';
import { supabase } from 'supabase';
import { extractStudentExtraFields } from '../../utils/studentExtraFields';
import { exportAdmissionFormHeadless } from '../../utils/admissionFormPdf';

interface Props {
  madrasah: Institution | null;
  onBack: () => void;
  lang: 'bn' | 'en';
}

const getDefaultAdmissionConfig = (lang: AdmissionFormLang = 'bn', madrasahName?: string): AdmissionFormConfig => ({
  themeColor: '#1e3a8a',
  fontScale: 1.1,
  showLogo: true,
  showWatermark: true,
  watermarkText: madrasahName || (lang === 'bn' ? 'ভর্তি ফরম' : 'ADMISSION'),
  sectionHeadings: {
    studentInfo: ADMISSION_T[lang]?.studentInfo || (lang === 'bn' ? 'শিক্ষার্থীর তথ্য' : 'Student Information'),
    parentInfo: ADMISSION_T[lang]?.parentInfo || (lang === 'bn' ? 'পিতামাতা/অভিভাবকের তথ্য' : 'Parent/Guardian Information'),
    addressInfo: ADMISSION_T[lang]?.addressInfo || (lang === 'bn' ? 'ঠিকানা' : 'Address'),
    prevInstInfo: ADMISSION_T[lang]?.prevInstInfo || (lang === 'bn' ? 'পূর্ববর্তী প্রতিষ্ঠানের তথ্য' : 'Previous Institution Information'),
    declaration: ADMISSION_T[lang]?.declaration || (lang === 'bn' ? 'অঙ্গীকারনামা' : 'Declaration'),
    officeUse: ADMISSION_T[lang]?.officeUse || (lang === 'bn' ? 'অফিস ব্যবহারের জন্য' : 'For Office Use Only'),
  },
  fieldVisibility: {
    studentNameEn: true,
    dateOfBirth: true,
    gender: true,
    nationality: true,
    religion: true,
    bloodGroup: true,
    admissionClass: true,
    fatherName: true,
    fatherOccupation: true,
    motherName: true,
    motherOccupation: true,
    guardianName: true,
    guardianRelation: true,
    guardianPhone: true,
    presentAddress: true,
    permanentAddress: true,
    previousInstitution: true,
  },
  signatureLabels: {
    student: ADMISSION_T[lang]?.signatureStudent || (lang === 'bn' ? 'শিক্ষার্থীর স্বাক্ষর' : "Student's Signature"),
    parent: ADMISSION_T[lang]?.signatureParent || (lang === 'bn' ? 'অভিভাবকের স্বাক্ষর' : "Parent's Signature"),
    principal: ADMISSION_T[lang]?.signaturePrincipal || (lang === 'bn' ? 'প্রতিষ্ঠান প্রধানের স্বাক্ষর ও সীল' : "Principal's Signature & Seal"),
  }
});

const loadSavedConfig = (lang: AdmissionFormLang, madrasah: Institution | null): AdmissionFormConfig => {
  const defaults = getDefaultAdmissionConfig(lang, madrasah?.name);
  try {
    // 1. Check cloud database (madrasah.config_json)
    const dbConfig = (madrasah?.config_json as any)?.admission_form_config;
    if (dbConfig && typeof dbConfig === 'object') {
      return {
        ...defaults,
        ...dbConfig,
        sectionHeadings: { ...defaults.sectionHeadings, ...(dbConfig.sectionHeadings || {}) },
        fieldVisibility: { ...defaults.fieldVisibility, ...(dbConfig.fieldVisibility || {}) },
        signatureLabels: { ...defaults.signatureLabels, ...(dbConfig.signatureLabels || {}) },
      };
    }

    // 2. Check localStorage per institution
    const instKey = madrasah?.id ? `admission_form_config_${madrasah.id}` : 'admission_form_config_default';
    const local = localStorage.getItem(instKey) || localStorage.getItem('admission_form_config_default');
    if (local) {
      const parsed = JSON.parse(local);
      return {
        ...defaults,
        ...parsed,
        sectionHeadings: { ...defaults.sectionHeadings, ...(parsed.sectionHeadings || {}) },
        fieldVisibility: { ...defaults.fieldVisibility, ...(parsed.fieldVisibility || {}) },
        signatureLabels: { ...defaults.signatureLabels, ...(parsed.signatureLabels || {}) },
      };
    }
  } catch (err) {
    console.warn('Failed to load stored admission form config, using defaults:', err);
  }
  return defaults;
};

interface DownloadModalState {
  isOpen: boolean;
  isBlank: boolean;
  student?: Student | null;
  progress: number;
  stepText: string;
  isComplete: boolean;
  error?: string | null;
  fileName?: string;
}

const AdmissionFormPage: React.FC<Props> = ({ madrasah, onBack, lang: appLang }) => {
  const [lang, setLang] = useState<AdmissionFormLang>(appLang as AdmissionFormLang || 'bn');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'design' | 'download'>('download');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPreviewingBlank, setIsPreviewingBlank] = useState(false);

  const [downloadModal, setDownloadModal] = useState<DownloadModalState>({
    isOpen: false,
    isBlank: false,
    student: null,
    progress: 0,
    stepText: '',
    isComplete: false,
    error: null,
    fileName: '',
  });

  const [config, setConfig] = useState<AdmissionFormConfig>(() => loadSavedConfig(lang, madrasah));

  // Reload saved config if madrasah changes
  useEffect(() => {
    if (madrasah) {
      const saved = loadSavedConfig(lang, madrasah);
      setConfig(saved);
    }
  }, [madrasah?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveConfig = async (customConfig?: AdmissionFormConfig) => {
    const configToSave = customConfig || config;
    setIsSaving(true);
    try {
      // 1. Save to LocalStorage for instant persistence
      const instKey = madrasah?.id ? `admission_form_config_${madrasah.id}` : 'admission_form_config_default';
      localStorage.setItem(instKey, JSON.stringify(configToSave));
      localStorage.setItem('admission_form_config_default', JSON.stringify(configToSave));

      // 2. Save to Supabase DB for cross-device cloud persistence
      if (madrasah?.id) {
        const currentConfigJson = (madrasah.config_json && typeof madrasah.config_json === 'object') 
          ? madrasah.config_json 
          : {};
        
        const updatedConfigJson = {
          ...currentConfigJson,
          admission_form_config: configToSave,
        };

        const { error } = await supabase
          .from('institutions')
          .update({ config_json: updatedConfigJson })
          .eq('id', madrasah.id);
        
        if (error) {
          console.warn('Database save warning (saved to local cache):', error);
        } else {
          // Update local madrasah reference config_json if possible
          (madrasah as any).config_json = updatedConfigJson;
        }
      }

      setIsSaved(true);
      showToast(lang === 'bn' ? 'ভর্তি ফরমের ডিজাইন সফলভাবে সংরক্ষণ করা হয়েছে!' : 'Admission form design saved successfully!');
      setTimeout(() => setIsSaved(false), 3500);
    } catch (err) {
      console.error('Error saving admission form design:', err);
      showToast(lang === 'bn' ? 'ডিজাইন সেভ করতে সমস্যা হয়েছে' : 'Failed to save design');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetConfig = () => {
    const defaults = getDefaultAdmissionConfig(lang, madrasah?.name);
    setConfig(defaults);
    
    // Clear saved custom config
    const instKey = madrasah?.id ? `admission_form_config_${madrasah.id}` : 'admission_form_config_default';
    localStorage.removeItem(instKey);
    
    if (madrasah?.id) {
      const currentConfigJson = (madrasah.config_json && typeof madrasah.config_json === 'object') 
        ? madrasah.config_json 
        : {};
      const updatedConfigJson = {
        ...currentConfigJson,
        admission_form_config: defaults,
      };
      supabase.from('institutions').update({ config_json: updatedConfigJson }).eq('id', madrasah.id).then();
    }
    
    showToast(lang === 'bn' ? 'ডিজাইন ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে' : 'Design reset to default');
  };

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
    }
  }, [madrasah]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('class_name');
      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      fetchStudentsByClass();
    } else {
      setStudentsInClass([]);
    }
  }, [selectedClassId]);

  const fetchStudentsByClass = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('class_id', selectedClassId)
        .order('student_name');
      if (error) throw error;
      const formatted = (data || []).map(s => {
        const extra = extractStudentExtraFields(s);
        return {
          ...s,
          ...extra,
          classes: Array.isArray(s.classes) ? s.classes[0] : s.classes
        };
      });
      setStudentsInClass(formatted);
    } catch (err) {
      console.error('Error fetching students by class:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMappedFormData = (student: Student | null): AdmissionFormData => {
    if (!student) return sampleFormData;
    const extra = extractStudentExtraFields(student);
    return {
      formNumber: student.admission_number || `ADM-${new Date().getFullYear()}-${student.roll || '001'}`,
      admissionDate: student.created_at ? student.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      academicYear: new Date().getFullYear().toString(),
      session: '',
      studentName: student.student_name || '',
      studentNameEn: student.name_en || '',
      date_of_birth: student.date_of_birth || '',
      gender: extra.gender || (student as any).gender || '', 
      blood_group: student.blood_group || '',
      fatherName: extra.father_name || (student as any).father_name || student.guardian_name || '',
      fatherOccupation: extra.father_occupation || (student as any).father_occupation || '',
      motherName: student.mother_name || '',
      motherOccupation: extra.mother_occupation || (student as any).mother_occupation || '',
      guardian_name: student.guardian_name || '',
      guardianRelation: extra.guardian_relation || (student as any).guardian_relation || '',
      guardian_phone: student.guardian_phone || '',
      presentAddress: student.address || '',
      permanentAddress: extra.permanent_address || (student as any).permanent_address || student.address || '',
      admissionClass: (student as any).classes?.class_name || student.class_id || '',
      previousInstitution: extra.previous_institution || (student as any).previous_institution || '',
      previousClass: extra.previous_class || (student as any).previous_class || '',
      photoUrl: student.photo_url || '',
      admission_number: student.admission_number || '',
      roll: student.roll,
      nationality: extra.nationality || (student as any).nationality || '',
      religion: extra.religion || (student as any).religion || '',
      documentsChecked: [],
    };
  };

  const handleDownloadBlank = async () => {
    const fileName = 'Admission_Form_Blank.pdf';
    setDownloadModal({
      isOpen: true,
      isBlank: true,
      student: null,
      progress: 15,
      stepText: lang === 'bn' ? 'অফলাইন ব্ল্যাঙ্ক ভর্তি ফরম প্রস্তুত করা হচ্ছে...' : 'Preparing offline blank admission form...',
      isComplete: false,
      error: null,
      fileName,
    });

    try {
      await exportAdmissionFormHeadless({
        formData: sampleFormData,
        madrasah,
        lang,
        config,
        isBlank: true,
        fileName,
        onProgress: (prog, text) => {
          setDownloadModal(prev => ({
            ...prev,
            progress: prog,
            stepText: text,
          }));
        }
      });

      setDownloadModal(prev => ({
        ...prev,
        progress: 100,
        isComplete: true,
        stepText: lang === 'bn' ? 'অফলাইন ব্ল্যাঙ্ক ফরম সফলভাবে ডাউনলোড হয়েছে!' : 'Offline blank form downloaded successfully!',
      }));
    } catch (err: any) {
      console.error('Download blank error:', err);
      setDownloadModal(prev => ({
        ...prev,
        error: lang === 'bn' ? 'ব্ল্যাঙ্ক ফরম ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Failed to download blank form. Please try again.',
      }));
    }
  };

  const handleDownloadStudent = async (student: Student) => {
    const mappedData = getMappedFormData(student);
    const safeStudentName = (mappedData.studentNameEn || mappedData.studentName || 'Student')
      .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')
      .replace(/\s+/g, '_');
    const fileName = `Admission_Form_${safeStudentName}.pdf`;

    setDownloadModal({
      isOpen: true,
      isBlank: false,
      student,
      progress: 15,
      stepText: lang === 'bn' ? `${student.student_name}-এর ভর্তি ফরম প্রস্তুত হচ্ছে...` : `Preparing admission form for ${student.student_name}...`,
      isComplete: false,
      error: null,
      fileName,
    });

    try {
      await exportAdmissionFormHeadless({
        formData: mappedData,
        madrasah,
        lang,
        config,
        isBlank: false,
        fileName,
        onProgress: (prog, text) => {
          setDownloadModal(prev => ({
            ...prev,
            progress: prog,
            stepText: text,
          }));
        }
      });

      setDownloadModal(prev => ({
        ...prev,
        progress: 100,
        isComplete: true,
        stepText: lang === 'bn' ? `${student.student_name}-এর ভর্তি ফরম সফলভাবে ডাউনলোড হয়েছে!` : `Admission form downloaded successfully for ${student.student_name}!`,
      }));
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadModal(prev => ({
        ...prev,
        error: lang === 'bn' ? 'পিডিএফ ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Failed to download PDF. Please try again.',
      }));
    }
  };

  const searchStudents = async () => {
    if (!madrasah || searchQuery.length < 2) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('institution_id', madrasah.id)
        .or(`student_name.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sampleFormData: AdmissionFormData = {
    formNumber: 'ADM-2026-001',
    admissionDate: new Date().toISOString().split('T')[0],
    academicYear: '2026',
    session: 'Morning',
    studentName: 'মোহাম্মদ আব্দুল্লাহ',
    studentNameEn: 'MD. ABDULLAH',
    date_of_birth: '2015-05-12',
    gender: 'male',
    blood_group: 'O+',
    fatherName: 'আব্দুর রহমান',
    fatherOccupation: 'ব্যবসায়ী',
    motherName: 'ফাতেমা বেগম',
    motherOccupation: 'গৃহিণী',
    guardian_name: 'আব্দুর রহমান',
    guardianRelation: 'পিতা',
    guardian_phone: '01712345678',
    presentAddress: 'মিরপুর, ঢাকা',
    permanentAddress: 'মিরপুর, ঢাকা',
    admissionClass: 'Class One',
    documentsChecked: ['birth', 'photos'],
    nationality: 'Bangladeshi',
    religion: 'Islam',
  };

  const t = ADMISSION_T[lang];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 relative">
      {/* Toast Banner */}
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

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 font-noto">
              {t.title}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {madrasah?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Globe size={14} />
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar Area: Selection & Customization */}
          <div className="w-full lg:w-[400px] space-y-6">
            
            {/* Tabs (Download tab is first, Design tab is second) */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
              <button
                onClick={() => setActiveTab('download')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'download' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <Download size={16} />
                {lang === 'bn' ? 'ডাউনলোড' : 'Download'}
              </button>
              <button
                onClick={() => setActiveTab('design')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'design' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <Settings2 size={16} />
                {lang === 'bn' ? 'ডিজাইন কাস্টমাইজ' : 'Design'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'design' ? (
                <motion.div
                  key="design-tab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <DesignCustomizer 
                    config={config} 
                    setConfig={setConfig} 
                    lang={lang} 
                    onSave={() => handleSaveConfig()}
                    isSaving={isSaving}
                    isSaved={isSaved}
                    onReset={handleResetConfig}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="download-tab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  {/* Offline Blank Form Card */}
                  <section className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900 p-6 rounded-[2.5rem] border-2 border-emerald-500/30 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30">
                          <FileSpreadsheet size={24} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-emerald-700 dark:text-emerald-300 uppercase bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full">
                            {lang === 'bn' ? 'অফলাইন প্রিন্ট উপযোগী' : 'Offline Print Ready'}
                          </span>
                          <h3 className="font-black text-slate-800 dark:text-slate-100 text-base font-noto mt-1">
                            {lang === 'bn' ? 'অফলাইন ব্ল্যাঙ্ক ভর্তি ফরম' : 'Offline Blank Admission Form'}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {lang === 'bn' 
                        ? 'সরাসরি প্রিন্ট করে হাতে লেখার জন্য সম্পূর্ণ খালি ভর্তি ফরম। এতে কোনো তথ্য থাকবে না, ফলে যেকোনো নতুন শিক্ষার্থীর জন্য অফলাইনে ব্যবহার করা যাবে।' 
                        : 'Completely blank admission form with clean handwriting lines and offline photo box, ready for printing.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        onClick={() => handleDownloadBlank()}
                        disabled={downloadModal.isOpen && !downloadModal.isComplete}
                        className="w-full py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all text-xs cursor-pointer disabled:opacity-50"
                      >
                        <Download size={15} />
                        <span>{lang === 'bn' ? 'ব্ল্যাঙ্ক PDF ডাউনলোড' : 'Download Blank'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsPreviewingBlank(true);
                          setTimeout(() => window.print(), 250);
                        }}
                        className="w-full py-3 px-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-slate-900/20 transition-all text-xs cursor-pointer"
                      >
                        <Printer size={15} />
                        <span>{lang === 'bn' ? 'সরাসরি প্রিন্ট' : 'Print Now'}</span>
                      </button>
                    </div>
                  </section>

                  {/* Student Search */}
                  <section className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                          <User size={20} />
                        </div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm font-noto">
                          {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন' : 'Student Selection'}
                        </h3>
                      </div>
                      
                      <button
                        onClick={() => setActiveTab('design')}
                        className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-xl"
                      >
                        <Settings2 size={12} />
                        <span>{lang === 'bn' ? 'ডিজাইন' : 'Design'}</span>
                      </button>
                    </div>

                    {/* Class Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class'}
                      </label>
                      <select
                        value={selectedClassId || ''}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm transition-all dark:text-slate-100"
                      >
                        <option value="">{lang === 'bn' ? '-- ক্লাস নির্বাচন করুন --' : '-- Select Class --'}</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyUp={(e) => e.key === 'Enter' && searchStudents()}
                        placeholder={lang === 'bn' ? 'নাম বা এডমিশন নম্বর...' : 'Name or Admission No...'}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm transition-all dark:text-slate-100"
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <button 
                        onClick={searchStudents}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                      >
                        <ArrowLeft className="rotate-180" size={16} />
                      </button>
                    </div>

                    {/* Students List (from search or class) */}
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        (selectedClassId ? studentsInClass : students).map(student => (
                          <div
                            key={student.id}
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsPreviewingBlank(false);
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer ${selectedStudent?.id === student.id && !isPreviewingBlank ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500' : 'border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/60 dark:hover:bg-blue-900/20'}`}
                          >
                            <div className="flex items-center gap-3 flex-1 text-left min-w-0 mr-2">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                                {((madrasah?.config_json?.modules?.student_photo === true) && student.photo_url) ? (
                                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : <User size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight truncate">{student.student_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-0.5">
                                  {student.admission_number || 'No ID'} • {(student as any).classes?.class_name || 'Class'}
                                </p>
                              </div>
                            </div>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadStudent(student); }}
                              disabled={downloadModal.isOpen && !downloadModal.isComplete}
                              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 transition-all"
                              title={lang === 'bn' ? 'পিডিএফ ডাউনলোড করুন' : 'Download PDF'}
                            >
                              <Download size={14} />
                              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
                            </button>
                          </div>
                        ))
                      )}
                      
                      {!loading && selectedClassId && studentsInClass.length === 0 && (
                        <p className="text-center py-8 text-xs font-bold text-slate-400 italic">
                          {lang === 'bn' ? 'এই ক্লাসে কোন শিক্ষার্থী পাওয়া যায়নি' : 'No students found in this class'}
                        </p>
                      )}
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Preview Area */}
          <div className="flex-1 space-y-4">
            {/* Live Preview Controls Header */}
            <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Sparkles size={20} className="animate-pulse shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-wider block leading-none font-noto">
                      {lang === 'bn' ? 'ভর্তি ফরম লাইভ প্রিভিউ' : 'Admission Form Live Preview'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isPreviewingBlank ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'}`}>
                      {isPreviewingBlank ? (lang === 'bn' ? 'ব্ল্যাঙ্ক ফরম মোড' : 'Blank Mode') : (lang === 'bn' ? 'তথ্যসহ মোড' : 'Data Mode')}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 mt-1 block">
                    {isPreviewingBlank
                      ? (lang === 'bn' ? 'অফলাইনে হাতে লেখার জন্য খালি দাগ ও খালি ফটো বক্স দেখানো হচ্ছে' : 'Displaying clean writing lines & empty photo box for offline use')
                      : (selectedStudent ? `${selectedStudent.student_name}-এর তথ্য সহ দেখানো হচ্ছে` : (lang === 'bn' ? 'নমুনা তথ্য সহ দেখানো হচ্ছে' : 'Showing sample data'))}
                  </span>
                </div>
              </div>

              {/* Toggle Preview & Quick Download Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  <button
                    onClick={() => setIsPreviewingBlank(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${!isPreviewingBlank ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    {lang === 'bn' ? 'তথ্য সহ' : 'With Data'}
                  </button>
                  <button
                    onClick={() => setIsPreviewingBlank(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isPreviewingBlank ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    {lang === 'bn' ? 'ব্ল্যাঙ্ক (খালি)' : 'Blank'}
                  </button>
                </div>

                <button
                  onClick={() => handleDownloadBlank()}
                  disabled={downloadModal.isOpen && !downloadModal.isComplete}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold rounded-2xl flex items-center gap-1.5 text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>{lang === 'bn' ? 'ব্ল্যাঙ্ক PDF' : 'Blank PDF'}</span>
                </button>

                {selectedStudent && (
                  <button
                    onClick={() => handleDownloadStudent(selectedStudent)}
                    disabled={downloadModal.isOpen && !downloadModal.isComplete}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold rounded-2xl flex items-center gap-1.5 text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download size={14} />
                    <span>{lang === 'bn' ? 'শিক্ষার্থীর PDF' : 'Student PDF'}</span>
                  </button>
                )}
              </div>
            </div>

            <AdmissionFormPreview 
              formData={isPreviewingBlank ? sampleFormData : getMappedFormData(selectedStudent)} 
              madrasah={madrasah} 
              lang={lang} 
              config={config}
              hideButtons={true}
              isBlank={isPreviewingBlank}
              onDownloadRequest={(isBlank) => {
                if (isBlank) handleDownloadBlank();
                else if (selectedStudent) handleDownloadStudent(selectedStudent);
                else handleDownloadBlank();
              }}
            />
          </div>
        </div>
      </div>

      {/* Beautiful Download Progress & Completion Popup Modal */}
      <AnimatePresence>
        {downloadModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-md"
              onClick={() => {
                if (downloadModal.isComplete || downloadModal.error) {
                  setDownloadModal(prev => ({ ...prev, isOpen: false }));
                }
              }}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-10"
            >
              {/* Ambient Glow */}
              <div 
                className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
                style={{ backgroundColor: downloadModal.isBlank ? '#10b981' : '#3b82f6' }}
              />

              {/* Close Button when finished or error */}
              {(downloadModal.isComplete || downloadModal.error) && (
                <button
                  onClick={() => setDownloadModal(prev => ({ ...prev, isOpen: false }))}
                  className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              )}

              {/* Status Graphic & Heading */}
              <div className="flex flex-col items-center text-center space-y-3">
                {downloadModal.error ? (
                  <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shadow-lg shadow-rose-500/10">
                    <AlertCircle size={32} />
                  </div>
                ) : downloadModal.isComplete ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 size={34} />
                  </motion.div>
                ) : (
                  <div className="relative">
                    <div 
                      className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-xl ${
                        downloadModal.isBlank 
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30' 
                          : 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/30'
                      }`}
                    >
                      {downloadModal.isBlank ? <FileSpreadsheet size={30} /> : <GraduationCap size={30} />}
                    </div>
                    {/* Ring Spinner */}
                    <div className="absolute -inset-2 border-2 border-dashed border-blue-500/40 rounded-[2rem] animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 font-noto">
                    {downloadModal.error 
                      ? (lang === 'bn' ? 'পিডিএফ ডাউনলোডে ত্রুটি' : 'Download Error')
                      : downloadModal.isComplete
                        ? (lang === 'bn' ? 'ডাউনলোড সফল হয়েছে!' : 'Download Complete!')
                        : (downloadModal.isBlank 
                            ? (lang === 'bn' ? 'অফলাইন ব্ল্যাঙ্ক ফরম তৈরি হচ্ছে...' : 'Preparing Blank Form...')
                            : (lang === 'bn' ? `${downloadModal.student?.student_name || 'শিক্ষার্থী'}-এর ফরম তৈরি হচ্ছে...` : 'Generating Form PDF...'))}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs font-medium">
                    {downloadModal.error 
                      ? downloadModal.error
                      : downloadModal.stepText}
                  </p>
                </div>
              </div>

              {/* Progress Bar (when downloading) */}
              {!downloadModal.isComplete && !downloadModal.error && (
                <div className="mt-6 space-y-2">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                    <motion.div
                      className={`h-full rounded-full transition-all duration-300 ${
                        downloadModal.isBlank 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                      }`}
                      style={{ width: `${downloadModal.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 px-1">
                    <span>{downloadModal.isBlank ? (lang === 'bn' ? 'ব্ল্যাঙ্ক লেআউট' : 'Blank Layout') : (lang === 'bn' ? 'শিক্ষার্থীর ডাটা' : 'Student Data')}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">{downloadModal.progress}%</span>
                  </div>
                </div>
              )}

              {/* Document Summary Card (when complete) */}
              {downloadModal.isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-left"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">{lang === 'bn' ? 'ফাইলের নাম:' : 'File:'}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={downloadModal.fileName}>
                      {downloadModal.fileName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">{lang === 'bn' ? 'ফরম্যাট:' : 'Format:'}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'bn' ? 'A4 পেজ (হাই-রেজোলিউশন)' : 'A4 Portrait (High-Res)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">{lang === 'bn' ? 'ধরণ:' : 'Type:'}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check size={13} />
                      {downloadModal.isBlank 
                        ? (lang === 'bn' ? 'অফলাইন ব্ল্যাঙ্ক (হাতে লেখার উপযোগী)' : 'Offline Blank Form')
                        : (lang === 'bn' ? 'পূরণকৃত ভর্তি ফরম' : 'Completed Form')}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Actions Footer */}
              <div className="mt-6 pt-2 flex flex-col sm:flex-row gap-2.5">
                {downloadModal.error ? (
                  <>
                    <button
                      onClick={() => {
                        if (downloadModal.isBlank) handleDownloadBlank();
                        else if (downloadModal.student) handleDownloadStudent(downloadModal.student);
                      }}
                      className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all text-xs cursor-pointer"
                    >
                      <RefreshCw size={14} />
                      <span>{lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}</span>
                    </button>
                    <button
                      onClick={() => setDownloadModal(prev => ({ ...prev, isOpen: false }))}
                      className="py-3 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all text-xs cursor-pointer"
                    >
                      {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                    </button>
                  </>
                ) : downloadModal.isComplete ? (
                  <>
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-3 px-4 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all text-xs cursor-pointer active:scale-95"
                    >
                      <Printer size={15} />
                      <span>{lang === 'bn' ? 'সরাসরি প্রিন্ট' : 'Print Now'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (downloadModal.isBlank) handleDownloadBlank();
                        else if (downloadModal.student) handleDownloadStudent(downloadModal.student);
                      }}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all text-xs cursor-pointer"
                    >
                      <Download size={15} />
                      <span>{lang === 'bn' ? 'আবার ডাউনলোড' : 'Download Again'}</span>
                    </button>
                    <button
                      onClick={() => setDownloadModal(prev => ({ ...prev, isOpen: false }))}
                      className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all text-xs cursor-pointer"
                    >
                      {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center py-2 text-xs font-bold text-slate-400 animate-pulse">
                    {lang === 'bn' ? 'অনুগ্রহ করে অপেক্ষা করুন, ফাইলটি রেডি হচ্ছে...' : 'Please wait, rendering document...'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdmissionFormPage;
