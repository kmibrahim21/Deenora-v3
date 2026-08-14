
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ADMISSION_T } from './constants';
import { AdmissionFormData, AdmissionFormLang, AdmissionFormConfig } from './types';
import AdmissionForm from './AdmissionForm';
import AdmissionFormPreview from './AdmissionFormPreview';
import DesignCustomizer from './DesignCustomizer';
import { Globe, FileText, Eye, Download, ArrowLeft, Search, User, ChevronRight, Settings2, Sparkles, Filter, X, Save, CheckCircle2, RotateCcw } from 'lucide-react';
import { Institution, Student } from '../../types';
import { supabase } from 'supabase';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

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
    principal: ADMISSION_T[lang]?.signaturePrincipal || (lang === 'bn' ? 'অধ্যক্ষ/প্রধানের স্বাক্ষর ও সীল' : "Principal's Signature & Seal"),
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

const AdmissionFormPage: React.FC<Props> = ({ madrasah, onBack, lang: appLang }) => {
  const [lang, setLang] = useState<AdmissionFormLang>(appLang as AdmissionFormLang || 'bn');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'download'>('download');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [headlessDownloadData, setHeadlessDownloadData] = useState<AdmissionFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const headlessPrintRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<AdmissionFormConfig>(() => loadSavedConfig(lang, madrasah));

  // Reload saved config if madrasah changes
  useEffect(() => {
    if (madrasah) {
      const saved = loadSavedConfig(lang, madrasah);
      setConfig(saved);
    }
  }, [madrasah?.id]);

  const [formData, setFormData] = useState<AdmissionFormData>({
    formNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    academicYear: '',
    session: '',
    documentsChecked: [],
  });

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
    if (!headlessDownloadData) return;

    const generatePDF = async () => {
      try {
        // Wait a small delay to ensure rendering and fonts are fully loaded
        await new Promise(resolve => setTimeout(resolve, 800));

        const element = headlessPrintRef.current;
        if (!element) return;

        // Query the actual A4 container inside the preview
        const printArea = element.querySelector('#print-area') as HTMLElement || element;

        let canvas;
        let imgData;
        try {
          canvas = await html2canvas(printArea, {
            scale: 3.0, // 3.0x scale makes the PDF print quality extremely premium, sharp and crisp!
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          imgData = canvas.toDataURL('image/jpeg', 0.95);
        } catch (err1) {
          console.warn("Headless 3.0x render failed, attempting safe 1.5x render...", err1);
          try {
            canvas = await html2canvas(printArea, {
              scale: 1.5,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            });
            imgData = canvas.toDataURL('image/jpeg', 0.9);
          } catch (err2) {
            console.warn("Headless CORS/Taint issue at 1.5x, trying 1.5x scale with no-CORS non-tainting layout...", err2);
            try {
              canvas = await html2canvas(printArea, {
                scale: 1.5,
                useCORS: false,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff'
              });
              imgData = canvas.toDataURL('image/jpeg', 0.9);
            } catch (err3) {
              console.error("All headless image generations failed. Performing low-scale default fallback...", err3);
              canvas = await html2canvas(printArea, {
                scale: 1.0,
                useCORS: false,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff'
              });
              imgData = canvas.toDataURL('image/png');
            }
          }
        }

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        
        const safeStudentName = (headlessDownloadData.studentNameEn || headlessDownloadData.studentName || 'Form')
          .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')
          .replace(/\s+/g, '_');
        pdf.save(`Admission_Form_${safeStudentName}.pdf`);
      } catch (error) {
        console.error('Headless PDF Generation Error:', error);
      } finally {
        setHeadlessDownloadData(null);
        setIsGenerating(null);
      }
    };

    generatePDF();
  }, [headlessDownloadData]);

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
      setStudentsInClass(data || []);
    } catch (err) {
      console.error('Error fetching students by class:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStudent = async (student: Student) => {
    if (isGenerating) return;
    setIsGenerating(student.id);

    // Prepare full form data representation of this student for direct PDF compilation
    const mappedData: AdmissionFormData = {
      ...formData,
      studentName: student.student_name,
      studentNameEn: student.name_en,
      date_of_birth: student.date_of_birth,
      gender: 'male', 
      blood_group: student.blood_group,
      fatherName: student.guardian_name,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      presentAddress: student.address,
      admissionClass: (student as any).classes?.class_name || student.class_id,
      photoUrl: student.photo_url,
      admission_number: student.admission_number,
      roll: student.roll,
      nationality: 'Bangladeshi',
      religion: 'Islam',
    };

    setHeadlessDownloadData(mappedData);
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

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      ...formData,
      studentName: student.student_name,
      studentNameEn: student.name_en,
      date_of_birth: student.date_of_birth,
      gender: 'male', 
      blood_group: student.blood_group,
      fatherName: student.guardian_name,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      presentAddress: student.address,
      admissionClass: (student as any).classes?.class_name,
      photoUrl: student.photo_url,
      admission_number: student.admission_number,
      roll: student.roll,
      nationality: 'Bangladeshi',
      religion: 'Islam',
    });
    setStudents([]);
    setSearchQuery('');
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
    <div className="min-h-screen bg-slate-50 pb-20 relative">
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
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-2xl transition-all cursor-pointer"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black text-slate-800 font-noto">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-all cursor-pointer"
          >
            <Globe size={14} />
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar Area: Selection & Customization */}
          <div className={`w-full lg:w-[400px] space-y-6 ${showPreview ? 'hidden lg:block' : 'block'}`}>
            
            {/* Tabs (Download tab is first, Design tab is second) */}
            <div className="flex bg-slate-200 p-1 rounded-2xl shadow-inner">
              <button
                onClick={() => setActiveTab('download')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'download' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Download size={16} />
                {lang === 'bn' ? 'ডাউনলোড' : 'Download'}
              </button>
              <button
                onClick={() => setActiveTab('design')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'design' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
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
                  {/* Student Search */}
                  <section className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <User size={20} />
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm font-noto">
                          {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন' : 'Student Selection'}
                        </h3>
                      </div>
                      
                      <button
                        onClick={() => setActiveTab('design')}
                        className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-xl"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm transition-all"
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
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm transition-all"
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
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        (selectedClassId ? studentsInClass : students).map(student => (
                          <div
                            key={student.id}
                            className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                          >
                            <button
                              onClick={() => handleSelectStudent(student)}
                              className="flex items-center gap-3 flex-1 text-left cursor-pointer"
                            >
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden group-hover:bg-blue-100 group-hover:text-blue-500 flex-shrink-0">
                                {student.photo_url ? (
                                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : <User size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800 leading-tight truncate">{student.student_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                  {student.admission_number} • {(student as any).classes?.class_name}
                                </p>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => handleDownloadStudent(student)}
                              disabled={isGenerating !== null}
                              className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                              title={lang === 'bn' ? 'এই ডিজাইনে পিডিএফ ডাউনলোড করুন' : 'Download PDF with saved design'}
                            >
                              {isGenerating === student.id ? (
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Download size={16} />
                              )}
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

                    {selectedStudent && (
                      <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mt-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">SELECTED</p>
                            <p className="text-sm font-bold text-emerald-700">{selectedStudent.student_name}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedStudent(null)}
                          className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-600 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Preview Area */}
          <div className="flex-1 space-y-6">
            {activeTab === 'design' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2.5 text-blue-600">
                    <Sparkles size={20} className="animate-pulse" />
                    <div>
                      <span className="text-sm font-black uppercase tracking-wider block leading-none">
                        {lang === 'bn' ? 'ডিজাইন লাইভ প্রিভিউ' : 'Design Live Preview'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                        {lang === 'bn' ? 'বাম পাশের পরিবর্তনের সাথে সাথে এখানে প্রিভিউ পরিবর্তিত হবে' : 'Preview changes update in real time'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                      {lang === 'bn' ? 'A4 সাইজ ফরম্যাট' : 'A4 Size Format'}
                    </span>
                  </div>
                </div>

                <AdmissionFormPreview 
                  formData={selectedStudent ? formData : sampleFormData} 
                  madrasah={madrasah} 
                  lang={lang} 
                  config={config}
                />
              </div>
            ) : !selectedStudent ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-dashed border-slate-200 rounded-[3rem]">
                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mb-6">
                  <User size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 font-noto">
                  {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select a Student'}
                </h2>
                <p className="text-slate-400 font-bold max-w-xs text-sm">
                  {lang === 'bn' ? 'এডমিশন ফর্ম জেনারেট বা ডাউনলোড করতে প্রথমে বাম পাশ থেকে একজন শিক্ষার্থী সার্চ বা ক্লাস অনুযায়ী নির্বাচন করুন।' : 'Search and select a student from the left panel to generate or download their admission form.'}
                </p>
                <button
                  onClick={() => setActiveTab('design')}
                  className="mt-6 px-6 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Settings2 size={16} />
                  <span>{lang === 'bn' ? 'ফরমের ডিজাইন পরিবর্তন করুন' : 'Customize Form Design'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Mode Toggle */}
                <div className="flex bg-slate-200 p-1.5 rounded-3xl max-w-sm mx-auto shadow-sm">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${!showPreview ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    <FileText size={16} />
                    {lang === 'bn' ? 'তথ্য যাচাই' : 'Verify Details'}
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${showPreview ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    <Eye size={16} />
                    {t.preview}
                  </button>
                </div>

                <motion.div
                  key={showPreview ? 'preview' : 'form'}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {!showPreview ? (
                    <AdmissionForm 
                      formData={formData} 
                      setFormData={setFormData} 
                      lang={lang} 
                      onPreview={() => setShowPreview(true)}
                    />
                  ) : (
                    <AdmissionFormPreview 
                      formData={formData} 
                      madrasah={madrasah} 
                      lang={lang} 
                      config={config}
                    />
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Hidden container for background headless PDF generation */}
      {headlessDownloadData && (
        <div style={{ position: 'fixed', left: '0', top: '0', opacity: 0.01, pointerEvents: 'none', zIndex: -9999, width: '210mm', height: '297mm', overflow: 'hidden' }}>
          <div ref={headlessPrintRef}>
            <AdmissionFormPreview
              formData={headlessDownloadData}
              madrasah={madrasah}
              lang={lang}
              config={config}
              isPrint={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionFormPage;
