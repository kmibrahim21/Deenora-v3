import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ADMISSION_T, DEFAULT_RULES_BN, DEFAULT_RULES_EN, DEFAULT_DECLARATION_BN, DEFAULT_DECLARATION_EN } from './constants';
import { AdmissionFormData, AdmissionFormLang, AdmissionFormConfig } from './types';
import AdmissionFormPreview from './AdmissionFormPreview';
import AdmissionForm from './AdmissionForm';
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
  GraduationCap, 
  Check, 
  FileSpreadsheet,
  Edit3,
  BookOpen,
  UserPlus
} from 'lucide-react';
import { Institution, Student } from '../../types';
import { supabase } from 'supabase';
import { OfflineService } from '../../services/OfflineService';
import { requestManager } from '../../services/RequestManager';
import { extractStudentExtraFields, packStudentNotesWithExtra } from '../../utils/studentExtraFields';
import { checkStudentLimit } from '../../utils/studentLimitChecker';
import { exportAdmissionFormHeadless } from '../../utils/admissionFormPdf';
import { PublicSiteManager } from '../PublicSiteManager';

interface Props {
  madrasah: Institution | null;
  onBack: () => void;
  lang: 'bn' | 'en';
  activeYear?: any;
}

const getDefaultAdmissionConfig = (lang: AdmissionFormLang = 'bn', madrasahName?: string): AdmissionFormConfig => ({
  layoutMode: '1-page',
  themeColor: '#1e3a8a',
  fontScale: 1.0,
  showLogo: true,
  showWatermark: true,
  watermarkText: madrasahName || (lang === 'bn' ? 'ভর্তি ফরম' : 'ADMISSION'),
  rulesText: lang === 'bn' ? DEFAULT_RULES_BN : DEFAULT_RULES_EN,
  declarationText: lang === 'bn' ? DEFAULT_DECLARATION_BN : DEFAULT_DECLARATION_EN,
  sectionHeadings: {
    studentInfo: ADMISSION_T[lang]?.studentInfo || (lang === 'bn' ? 'শিক্ষার্থীর তথ্য' : 'Student Information'),
    parentInfo: ADMISSION_T[lang]?.parentInfo || (lang === 'bn' ? 'পিতামাতা ও অভিভাবকের তথ্য' : 'Parent & Guardian Information'),
    addressInfo: ADMISSION_T[lang]?.addressInfo || (lang === 'bn' ? 'ঠিকানা' : 'Address'),
    prevInstInfo: ADMISSION_T[lang]?.prevInstInfo || (lang === 'bn' ? 'পূর্ববর্তী প্রতিষ্ঠানের তথ্য' : 'Previous Institution Information'),
    financialInfo: ADMISSION_T[lang]?.financialInfo || (lang === 'bn' ? 'ফি ও আর্থিক তথ্য' : 'Fee & Financial Info'),
    documentsInfo: ADMISSION_T[lang]?.documents || (lang === 'bn' ? 'প্রয়োজনীয় কাগজপত্রের চেকলিস্ট' : 'Document Verification Checklist'),
    declaration: ADMISSION_T[lang]?.declaration || (lang === 'bn' ? 'শিক্ষার্থী ও অভিভাবকের যৌথ অঙ্গীকারনামা' : 'Joint Undertaking of Student & Guardian'),
    officeUse: ADMISSION_T[lang]?.officeUse || (lang === 'bn' ? 'অফিস অনুমোদন ও চূড়ান্ত বরাদ্দ' : 'For Office Approval & Allocation'),
    rulesHeading: ADMISSION_T[lang]?.rulesHeading || (lang === 'bn' ? 'প্রতিষ্ঠানের সাধারণ নিয়মাবলি ও নির্দেশিকা' : 'General Rules & Guidelines'),
    slipHeading: ADMISSION_T[lang]?.slipHeading || (lang === 'bn' ? 'শিক্ষার্থীর সাময়িক ভর্তি রসিদ স্লিপ' : 'Temporary Student Admission Slip'),
  },
  fieldVisibility: {
    studentNameEn: true,
    username: true,
    biometricId: true,
    birthRegNo: true,
    dateOfBirth: true,
    gender: true,
    nationality: true,
    religion: true,
    bloodGroup: true,
    admissionClass: true,
    department: true,
    residentialStatus: true,
    fatherName: true,
    fatherOccupation: true,
    fatherNid: true,
    motherName: true,
    motherOccupation: true,
    motherNid: true,
    guardianName: true,
    guardianRelation: true,
    guardianPhone: true,
    whatsappNumber: true,
    emergencyPhone: true,
    presentAddress: true,
    permanentAddress: true,
    previousInstitution: true,
    previousClass: true,
    tcNumber: true,
    financialInfo: true,
    documentsChecklist: true,
  },
  signatureLabels: {
    student: ADMISSION_T[lang]?.signatureStudent || (lang === 'bn' ? 'শিক্ষার্থীর স্বাক্ষর' : "Student's Signature"),
    parent: ADMISSION_T[lang]?.signatureParent || (lang === 'bn' ? 'অভিভাবকের স্বাক্ষর' : "Parent's Signature"),
    principal: ADMISSION_T[lang]?.signaturePrincipal || (lang === 'bn' ? 'প্রতিষ্ঠান প্রধানের স্বাক্ষর ও সীল' : "Principal's Signature & Seal"),
    collector: ADMISSION_T[lang]?.signatureCollector || (lang === 'bn' ? 'আদায়কারীর স্বাক্ষর ও সীল' : "Collector's Signature & Seal"),
  }
});

const loadSavedConfig = (lang: AdmissionFormLang, madrasah: Institution | null): AdmissionFormConfig => {
  const defaults = getDefaultAdmissionConfig(lang, madrasah?.name);
  try {
    const dbConfig = (madrasah?.config_json as any)?.admission_form_config;
    if (dbConfig && typeof dbConfig === 'object') {
      return {
        ...defaults,
        ...dbConfig,
        layoutMode: dbConfig.layoutMode === '2-page' ? '2-page' : '1-page',
        sectionHeadings: { ...defaults.sectionHeadings, ...(dbConfig.sectionHeadings || {}) },
        fieldVisibility: { ...defaults.fieldVisibility, ...(dbConfig.fieldVisibility || {}) },
        signatureLabels: { ...defaults.signatureLabels, ...(dbConfig.signatureLabels || {}) },
      };
    }

    const instKey = madrasah?.id ? `admission_form_config_${madrasah.id}` : 'admission_form_config_default';
    const local = localStorage.getItem(instKey) || localStorage.getItem('admission_form_config_default');
    if (local) {
      const parsed = JSON.parse(local);
      return {
        ...defaults,
        ...parsed,
        layoutMode: parsed.layoutMode === '2-page' ? '2-page' : '1-page',
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

const sampleFormData: AdmissionFormData = {
  formNumber: 'ADM-2026-001',
  admissionDate: new Date().toISOString().split('T')[0],
  academicYear: '২০২৬',
  session: '২০২৬-২০২৭',
  studentName: 'মোহাম্মদ আব্দুল্লাহ আল মামুন',
  studentNameEn: 'MD. ABDULLAH AL MAMUN',
  username: 'STD-202601',
  biometricId: '1045',
  birthRegNo: '20152694812039481',
  date_of_birth: '2015-05-12',
  gender: 'male',
  blood_group: 'O+',
  religion: 'ইসলাম',
  nationality: 'বাংলাদেশী',
  admissionClass: 'হিফজুল কুরআন / ষষ্ঠ শ্রেণি',
  department: 'হিফজ বিভাগ',
  residentialStatus: 'আবাসিক (Residential)',
  fatherName: 'হাফেজ মাওলানা আব্দুর রহমান',
  fatherOccupation: 'ব্যবসায়ী',
  fatherNid: '1982269481029',
  motherName: 'মোসাম্মৎ ফাতেমা বেগম',
  motherOccupation: 'গৃহিণী',
  motherNid: '1988269481044',
  guardian_name: 'হাফেজ মাওলানা আব্দুর রহমান',
  guardianRelation: 'পিতা',
  guardian_phone: '01712345678',
  whatsappNumber: '01712345678',
  emergencyPhone: '01812345678',
  presentAddress: 'বাড়ি #১২, রোড #০৫, ব্লক #সি, মিরপুর-১০, ঢাকা-১২১৬',
  permanentAddress: 'গ্রাম: রসুলপুর, ডাকঘর: কসবা, উপজেলা: কসবা, জেলা: ব্রাহ্মণবাড়িয়া',
  previousInstitution: 'দারুস সালাম আদর্শ মাদরাসা',
  previousClass: 'নূরানী তৃতীয় শ্রেণি',
  tcNumber: 'TC-2025-882',
  admissionFee: '৩,৫০০',
  monthlyFee: '২,০০০',
  receiptNumber: 'MR-1024',
  documentsChecked: ['birth', 'parentNID', 'photos'],
};

const getBlankEditableFormData = (lang: AdmissionFormLang, activeYear?: any, classId?: string, className?: string): AdmissionFormData => ({
  formNumber: `ADM-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
  admissionDate: new Date().toISOString().split('T')[0],
  academicYear: activeYear?.year_name || new Date().getFullYear().toString(),
  session: activeYear?.session_name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  studentName: '',
  studentNameEn: '',
  username: '',
  biometricId: '',
  birthRegNo: '',
  date_of_birth: '',
  gender: 'male',
  blood_group: '',
  religion: lang === 'bn' ? 'ইসলাম' : 'Islam',
  nationality: lang === 'bn' ? 'বাংলাদেশী' : 'Bangladeshi',
  class_id: classId || '',
  admissionClass: className || '',
  department: '',
  residentialStatus: '',
  roll: undefined,
  fatherName: '',
  fatherOccupation: '',
  fatherNid: '',
  motherName: '',
  motherOccupation: '',
  motherNid: '',
  guardian_name: '',
  guardianRelation: lang === 'bn' ? 'পিতা' : 'Father',
  guardian_phone: '',
  whatsappNumber: '',
  emergencyPhone: '',
  presentAddress: '',
  permanentAddress: '',
  previousInstitution: '',
  previousClass: '',
  tcNumber: '',
  admissionFee: '',
  monthlyFee: '',
  receiptNumber: '',
  photoUrl: '',
  documentsChecked: ['birth', 'parentNID', 'photos'],
});

const AdmissionFormPage: React.FC<Props> = ({ madrasah, onBack, lang: appLang, activeYear }) => {
  const [lang, setLang] = useState<AdmissionFormLang>(appLang as AdmissionFormLang || 'bn');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'download' | 'edit' | 'design' | 'online'>('download');
  const [pendingOnlineCount, setPendingOnlineCount] = useState<number>(0);

  const isPublicWebsiteEnabled = React.useMemo(() => {
    if (!madrasah) return false;
    if (madrasah.is_super_admin) return true;
    let cfg: any = madrasah.config_json;
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    }
    return cfg?.modules?.public_website === true;
  }, [madrasah]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [customFormData, setCustomFormData] = useState<AdmissionFormData>(sampleFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
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

  useEffect(() => {
    if (madrasah) {
      const saved = loadSavedConfig(lang, madrasah);
      setConfig(saved);
    }
  }, [madrasah?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const handleSaveConfig = async (customConfig?: AdmissionFormConfig) => {
    const configToSave = customConfig || config;
    setIsSaving(true);
    try {
      const instKey = madrasah?.id ? `admission_form_config_${madrasah.id}` : 'admission_form_config_default';
      localStorage.setItem(instKey, JSON.stringify(configToSave));
      localStorage.setItem('admission_form_config_default', JSON.stringify(configToSave));

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
      fetchStudentsByClass(selectedClassId);
    } else {
      setStudentsInClass([]);
    }
  }, [selectedClassId]);

  const fetchStudentsByClass = async (targetClassId?: string) => {
    const cId = targetClassId || selectedClassId;
    if (!cId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('class_id', cId);

      const targetYearId = activeYear?.id || (madrasah?.config_json as any)?.active_academic_year_id;
      const isAdvanceOrHistorical = Boolean(activeYear && activeYear.status !== 'active');
      if (isAdvanceOrHistorical && targetYearId) {
        query = query.eq('academic_year_id', targetYearId);
      } else if (targetYearId) {
        query = query.or(`academic_year_id.eq.${targetYearId},academic_year_id.is.null`);
      }

      const { data, error } = await query.order('student_name');
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

      if (!selectedStudent && !customFormData.roll) {
        const maxRoll = formatted.reduce((max, s) => {
          const r = Number(s.roll);
          return Number.isFinite(r) && r > max ? r : max;
        }, 0);
        setCustomFormData(prev => {
          if (prev.roll) return prev;
          return { ...prev, roll: maxRoll + 1 };
        });
      }
    } catch (err) {
      console.error('Error fetching students by class:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMappedFormData = (student: Student | null): AdmissionFormData => {
    if (!student) return customFormData;
    const extra = extractStudentExtraFields(student);
    const className = (student as any).classes?.class_name || classes.find(c => c.id === student.class_id)?.class_name || '';
    return {
      formNumber: student.admission_number || (student as any).registration_number || `ADM-${new Date().getFullYear()}-${student.roll || '001'}`,
      admissionDate: student.created_at ? student.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      academicYear: activeYear?.year_name || new Date().getFullYear().toString(),
      session: activeYear?.session_name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      studentName: student.student_name || '',
      studentNameEn: student.name_en || '',
      username: (student as any).username || student.admission_number || (student as any).registration_number || '',
      biometricId: (student as any).biometric_id || extra.biometric_id || (student.roll ? String(student.roll) : ''),
      birthRegNo: extra.birth_reg_no || (student as any).birth_reg_no || (student as any).birth_certificate_no || '',
      date_of_birth: student.date_of_birth || '',
      gender: extra.gender || (student as any).gender || 'male', 
      blood_group: student.blood_group || '',
      religion: extra.religion || (student as any).religion || (lang === 'bn' ? 'ইসলাম' : 'Islam'),
      nationality: extra.nationality || (student as any).nationality || (lang === 'bn' ? 'বাংলাদেশী' : 'Bangladeshi'),
      class_id: student.class_id || '',
      admissionClass: className,
      department: extra.department || (student as any).department || (student as any).section || '',
      residentialStatus: extra.residential_status || (student as any).residential_status || '',
      fatherName: extra.father_name || (student as any).father_name || student.guardian_name || '',
      fatherOccupation: extra.father_occupation || (student as any).father_occupation || '',
      fatherNid: extra.father_nid || (student as any).father_nid || '',
      motherName: student.mother_name || '',
      motherOccupation: extra.mother_occupation || (student as any).mother_occupation || '',
      motherNid: extra.mother_nid || (student as any).mother_nid || '',
      guardian_name: student.guardian_name || extra.father_name || '',
      guardianRelation: extra.guardian_relation || (student as any).guardian_relation || (lang === 'bn' ? 'পিতা' : 'Father'),
      guardian_phone: student.guardian_phone || '',
      whatsappNumber: extra.whatsapp_number || (student as any).whatsapp_number || student.guardian_phone || '',
      emergencyPhone: extra.emergency_phone || (student as any).emergency_phone || (student as any).guardian_phone_2 || student.guardian_phone || '',
      presentAddress: student.address || '',
      permanentAddress: extra.permanent_address || (student as any).permanent_address || student.address || '',
      previousInstitution: extra.previous_institution || (student as any).previous_institution || '',
      previousClass: extra.previous_class || (student as any).previous_class || '',
      tcNumber: extra.tc_number || (student as any).tc_number || '',
      admissionFee: extra.admission_fee || (student as any).admission_fee || '',
      monthlyFee: extra.monthly_fee || (student as any).monthly_fee || '',
      receiptNumber: extra.receipt_number || (student as any).receipt_number || '',
      photoUrl: student.photo_url || '',
      admission_number: student.admission_number || '',
      roll: student.roll,
      documentsChecked: ['birth', 'parentNID', 'photos'],
    };
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setCustomFormData(getMappedFormData(student));
    setIsPreviewingBlank(false);
  };

  const handleStartNewAdmission = () => {
    setSelectedStudent(null);
    setIsPreviewingBlank(false);
    const activeCls = classes.find(c => c.id === selectedClassId);
    const blankData = getBlankEditableFormData(lang, activeYear, selectedClassId || '', activeCls?.class_name || '');
    if (selectedClassId) {
      const maxRoll = studentsInClass.reduce((max, s) => {
        const r = Number(s.roll);
        return Number.isFinite(r) && r > max ? r : max;
      }, 0);
      blankData.roll = maxRoll + 1;
    }
    setCustomFormData(blankData);
    setActiveTab('edit');
    showToast(lang === 'bn' ? 'নতুন শিক্ষার্থী ভর্তির জন্য খালি ফরম প্রস্তুত করা হয়েছে' : 'New student admission form ready');
  };

  const handleSaveStudentToDatabase = async (andDownloadPdf: boolean) => {
    if (!madrasah?.id) return;

    const studentName = (customFormData.studentName || '').trim();
    const targetClassId = customFormData.class_id || selectedClassId || '';
    const guardianPhone = (customFormData.guardian_phone || customFormData.whatsappNumber || '').trim();
    const guardianName = (customFormData.guardian_name || customFormData.fatherName || '').trim();

    if (!studentName) {
      showToast(lang === 'bn' ? 'অনুগ্রহ করে শিক্ষার্থীর নাম লিখুন' : 'Please enter student name');
      return;
    }
    if (!targetClassId) {
      showToast(lang === 'bn' ? 'অনুগ্রহ করে ভর্তিচ্ছু ক্লাস নির্বাচন করুন' : 'Please select admission class');
      return;
    }
    if (!guardianPhone) {
      showToast(lang === 'bn' ? 'অনুগ্রহ করে অভিভাবকের মোবাইল নম্বর লিখুন' : 'Please enter guardian phone number');
      return;
    }

    const isEditing = Boolean(selectedStudent?.id);
    setIsSavingStudent(true);

    try {
      // Check student capacity limit if creating a new student
      if (!isEditing) {
        const limitCheck = await checkStudentLimit(madrasah.id, madrasah.config_json);
        if (limitCheck.isLimitReached) {
          showToast(
            lang === 'bn'
              ? `দুঃখিত, আপনার প্রতিষ্ঠানে সর্বোচ্চ ${limitCheck.limit} জন শিক্ষার্থী যুক্ত করার কোটা পূর্ণ হয়ে গেছে।`
              : `Student limit reached (${limitCheck.limit}).`
          );
          setIsSavingStudent(false);
          return;
        }
      }

      const parsedConfig = typeof madrasah.config_json === 'string'
        ? JSON.parse(madrasah.config_json)
        : (madrasah.config_json || {});
      let targetAcademicYearId = activeYear?.id || parsedConfig?.active_academic_year_id;

      if (!targetAcademicYearId && madrasah.id) {
        try {
          const { data: dbYear } = await supabase
            .from('academic_years')
            .select('id')
            .eq('institution_id', madrasah.id)
            .eq('status', 'active')
            .maybeSingle();
          if (dbYear?.id) targetAcademicYearId = dbYear.id;
        } catch (e) {
          console.warn('Could not fetch active academic year:', e);
        }
      }

      const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const bengaliToEnglish: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
      const rawRoll = customFormData.roll !== undefined && customFormData.roll !== null ? String(customFormData.roll) : '';
      const englishRoll = rawRoll.replace(/[০-৯]/g, m => bengaliToEnglish[m]).replace(/\D/g, '');

      const extraFields: any = {
        gender: (customFormData.gender || '').trim() || null,
        nationality: (customFormData.nationality || '').trim() || null,
        religion: (customFormData.religion || '').trim() || null,
        father_name: (customFormData.fatherName || '').trim() || null,
        father_occupation: (customFormData.fatherOccupation || '').trim() || null,
        father_nid: (customFormData.fatherNid || '').trim() || null,
        mother_occupation: (customFormData.motherOccupation || '').trim() || null,
        mother_nid: (customFormData.motherNid || '').trim() || null,
        guardian_relation: (customFormData.guardianRelation || '').trim() || null,
        whatsapp_number: (customFormData.whatsappNumber || '').trim() || null,
        emergency_phone: (customFormData.emergencyPhone || '').trim() || null,
        permanent_address: (customFormData.permanentAddress || '').trim() || null,
        previous_institution: (customFormData.previousInstitution || '').trim() || null,
        previous_class: (customFormData.previousClass || '').trim() || null,
        tc_number: (customFormData.tcNumber || '').trim() || null,
        biometric_id: (customFormData.biometricId || '').trim() || null,
        birth_reg_no: (customFormData.birthRegNo || '').trim() || null,
        department: (customFormData.department || '').trim() || null,
        residential_status: (customFormData.residentialStatus || '').trim() || null,
        admission_fee: (customFormData.admissionFee || '').trim() || null,
        monthly_fee: (customFormData.monthlyFee || '').trim() || null,
        receipt_number: (customFormData.receiptNumber || '').trim() || null,
      };

      const existingNotes = isEditing ? (selectedStudent?.notes || '') : '';
      const packedNotes = packStudentNotesWithExtra(existingNotes, extraFields);

      const dbExtraColumns: any = {
        gender: extraFields.gender,
        nationality: extraFields.nationality,
        religion: extraFields.religion,
        father_name: extraFields.father_name,
        father_occupation: extraFields.father_occupation,
        mother_occupation: extraFields.mother_occupation,
        guardian_relation: extraFields.guardian_relation,
        permanent_address: extraFields.permanent_address,
        previous_institution: extraFields.previous_institution,
        previous_class: extraFields.previous_class,
        biometric_id: extraFields.biometric_id,
      };

      const payload: any = {
        student_name: studentName,
        name_en: (customFormData.studentNameEn || '').trim() || null,
        registration_number: (customFormData.username || customFormData.formNumber || '').trim() || null,
        biometric_id: (customFormData.biometricId || '').trim() || null,
        guardian_name: guardianName || studentName,
        mother_name: (customFormData.motherName || '').trim() || null,
        roll: englishRoll ? parseInt(englishRoll, 10) : null,
        date_of_birth: customFormData.date_of_birth || null,
        blood_group: (customFormData.blood_group || '').trim() || null,
        guardian_phone: guardianPhone,
        guardian_phone_2: (customFormData.emergencyPhone || '').trim() || null,
        address: (customFormData.presentAddress || '').trim() || null,
        class_id: targetClassId,
        section: (customFormData.department || '').trim() || null,
        institution_id: madrasah.id,
        academic_year_id: (targetAcademicYearId && isValidUUID(targetAcademicYearId)) ? targetAcademicYearId : null,
        photo_url: customFormData.photoUrl || selectedStudent?.photo_url || null,
        notes: packedNotes || null,
        ...dbExtraColumns,
      };

      let finalStudent: any = null;
      const currentPayload = { ...payload };
      const extraFieldKeys = Object.keys(dbExtraColumns).concat(['photo_url']);
      let effectiveIsEditing = isEditing;
      let effectiveStudentId = selectedStudent?.id;

      // Pre-check roll collision in targetClassId for new admissions
      if (!effectiveIsEditing && currentPayload.roll !== null) {
        const { data: existingWithRoll } = await supabase
          .from('students')
          .select('id, student_name, roll')
          .eq('class_id', targetClassId)
          .eq('roll', currentPayload.roll)
          .maybeSingle();

        if (existingWithRoll) {
          if (
            existingWithRoll.student_name &&
            existingWithRoll.student_name.trim().toLowerCase() === studentName.toLowerCase()
          ) {
            effectiveIsEditing = true;
            effectiveStudentId = existingWithRoll.id;
          } else {
            const { data: maxRollRow } = await supabase
              .from('students')
              .select('roll')
              .eq('class_id', targetClassId)
              .not('roll', 'is', null)
              .order('roll', { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextRoll = (Number(maxRollRow?.roll) || 0) + 1;
            currentPayload.roll = nextRoll;
            payload.roll = nextRoll;
            setCustomFormData(prev => ({ ...prev, roll: nextRoll }));
          }
        }
      }

      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          if (effectiveIsEditing && effectiveStudentId) {
            finalStudent = await OfflineService.safeUpdate('students', effectiveStudentId, currentPayload);
          } else {
            finalStudent = await OfflineService.safeInsert('students', currentPayload);
          }
          break;
        } catch (innerErr: any) {
          console.error(`Admission save attempt ${attempt + 1} error:`, innerErr);
          if (currentPayload.academic_year_id && (innerErr.message?.includes('foreign key constraint') || innerErr.code === '23503')) {
            currentPayload.academic_year_id = null;
            continue;
          }
          if (innerErr.code === 'PGRST204' || innerErr.message?.includes('does not exist') || innerErr.message?.includes('column')) {
            const missingColumn =
              innerErr.message?.match(/column ['"](.*?)['"]/)?.[1] ||
              innerErr.message?.match(/Could not find the '(.*?)' column/)?.[1];
            if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
              delete currentPayload[missingColumn];
            } else {
              extraFieldKeys.forEach(k => delete currentPayload[k]);
            }
            continue;
          }
          if (
            innerErr.code === '23505' ||
            innerErr.message?.includes('students_class_id_roll_key') ||
            innerErr.message?.includes('duplicate key')
          ) {
            const { data: maxRollRow } = await supabase
              .from('students')
              .select('roll')
              .eq('class_id', targetClassId)
              .not('roll', 'is', null)
              .order('roll', { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextRoll = (Number(maxRollRow?.roll) || 0) + 1;
            currentPayload.roll = currentPayload.roll === nextRoll ? null : nextRoll;
            payload.roll = currentPayload.roll;
            setCustomFormData(prev => ({ ...prev, roll: currentPayload.roll ?? undefined }));
            continue;
          }
          throw innerErr;
        }
      }

      const mergedStudent = Array.isArray(finalStudent) ? finalStudent[0] : (finalStudent || {});
      const matchedClass = classes.find(c => c.id === targetClassId);
      const enrichedStudent: Student = {
        ...(selectedStudent || {}),
        ...payload,
        ...mergedStudent,
        ...extraFields,
        notes: packedNotes || mergedStudent.notes || null,
        id: mergedStudent.id || effectiveStudentId || payload.id || '',
        classes: matchedClass ? { class_name: matchedClass.class_name } : (selectedStudent as any)?.classes,
      };

      // Invalidate caches and refresh class student list
      requestManager.invalidatePattern('fetch:students:');
      requestManager.invalidatePattern('v6_students:');
      requestManager.invalidatePattern('students');
      requestManager.invalidatePattern(`stats:${madrasah.id}`);
      requestManager.invalidatePattern(`dashboard_`);

      setSelectedClassId(targetClassId);
      await fetchStudentsByClass(targetClassId);
      setSelectedStudent(enrichedStudent);

      showToast(
        effectiveIsEditing
          ? lang === 'bn'
            ? `${studentName}-এর তথ্য সফলভাবে আপডেট করা হয়েছে!`
            : `Updated ${studentName} successfully!`
          : lang === 'bn'
          ? `${studentName}-কে সফলভাবে "${matchedClass?.class_name || 'ক্লাসে'}" ভর্তি করা হয়েছে!`
          : `Admitted ${studentName} to ${matchedClass?.class_name || 'class'} successfully!`
      );

      if (andDownloadPdf) {
        const updatedFormData = { ...customFormData, roll: mergedStudent.roll ?? currentPayload.roll ?? customFormData.roll };
        await handleDownloadDataPdf(enrichedStudent, updatedFormData);
      }
    } catch (err: any) {
      console.error('Error saving student from Admission Form:', err);
      showToast(lang === 'bn' ? 'শিক্ষার্থী সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Failed to save student. Please try again.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleDownloadBlank = async () => {
    const fileName = config.layoutMode === '2-page' ? 'Admission_Form_2Page_Blank.pdf' : 'Admission_Form_1Page_Blank.pdf';
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
        formData: customFormData,
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

  const handleDownloadDataPdf = async (student?: Student | null, overrideFormData?: AdmissionFormData) => {
    const dataToExport = overrideFormData || (student ? getMappedFormData(student) : customFormData);
    const displayStudentName = dataToExport.studentName || dataToExport.studentNameEn || 'Student';
    const safeStudentName = (dataToExport.studentNameEn || dataToExport.studentName || 'Student')
      .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')
      .replace(/\s+/g, '_');
    const fileName = `Admission_Form_${safeStudentName}.pdf`;

    setDownloadModal({
      isOpen: true,
      isBlank: false,
      student: student || selectedStudent,
      progress: 15,
      stepText: lang === 'bn' ? `${displayStudentName}-এর ভর্তি ফরম প্রস্তুত হচ্ছে...` : `Preparing admission form for ${displayStudentName}...`,
      isComplete: false,
      error: null,
      fileName,
    });

    try {
      await exportAdmissionFormHeadless({
        formData: dataToExport,
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
        stepText: lang === 'bn' ? `${displayStudentName}-এর ভর্তি ফরম সফলভাবে ডাউনলোড হয়েছে!` : `Admission form downloaded successfully for ${displayStudentName}!`,
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
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 text-sm font-black print:hidden"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 font-noto">
              {t.title}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {madrasah?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick New Student Admission Button in Header */}
          <button
            onClick={handleStartNewAdmission}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full text-xs font-black shadow-sm transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>{lang === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি' : 'New Admission'}</span>
          </button>

          {/* Quick Layout Mode Switcher in Top Bar */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setConfig(prev => ({ ...prev, layoutMode: '1-page' }))}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                config.layoutMode !== '2-page'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText size={13} />
              <span>{lang === 'bn' ? '১-পৃষ্ঠা কমপ্যাক্ট' : '1-Page Compact'}</span>
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, layoutMode: '2-page' }))}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                config.layoutMode === '2-page'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BookOpen size={13} />
              <span>{lang === 'bn' ? '২-পৃষ্ঠা উভয় পিঠ' : '2-Page Double'}</span>
            </button>
          </div>

          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Globe size={14} />
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 print:p-0">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar Area: Selection, Live Data Entry & Customization */}
          <div className="w-full lg:w-[420px] shrink-0 space-y-5 print:hidden">
            
            {/* Tab Navigation */}
            <div className={`grid ${isPublicWebsiteEnabled ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner gap-1`}>
              <button
                onClick={() => setActiveTab('download')}
                className={`flex items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl text-[11px] font-black tracking-tight transition-all cursor-pointer ${activeTab === 'download' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <Download size={13} />
                <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
              </button>
              <button
                onClick={() => {
                  setIsPreviewingBlank(false);
                  setActiveTab('edit');
                }}
                className={`flex items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl text-[11px] font-black tracking-tight transition-all cursor-pointer ${activeTab === 'edit' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <Edit3 size={13} />
                <span>{lang === 'bn' ? 'তথ্য পূরণ' : 'Admit'}</span>
              </button>
              {isPublicWebsiteEnabled && (
                <button
                  onClick={() => setActiveTab('online')}
                  className={`flex items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl text-[11px] font-black tracking-tight transition-all cursor-pointer ${activeTab === 'online' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                  <Globe size={13} />
                  <span>{lang === 'bn' ? 'অনলাইন' : 'Online'}</span>
                  {pendingOnlineCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black leading-none tabular-nums">
                      {pendingOnlineCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setActiveTab('design')}
                className={`flex items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl text-[11px] font-black tracking-tight transition-all cursor-pointer ${activeTab === 'design' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <Settings2 size={13} />
                <span>{lang === 'bn' ? 'ডিজাইন' : 'Design'}</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'online' && isPublicWebsiteEnabled ? (
                <motion.div
                  key="online-tab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar"
                >
                  <PublicSiteManager
                    madrasah={madrasah}
                    lang={lang}
                    activeYear={activeYear}
                    classesList={classes}
                    onPendingCountChange={setPendingOnlineCount}
                    onApproved={(admittedClassId) => {
                      setSelectedClassId(admittedClassId);
                      fetchStudentsByClass(admittedClassId);
                    }}
                  />
                </motion.div>
              ) : activeTab === 'design' ? (
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
              ) : activeTab === 'edit' ? (
                <motion.div
                  key="edit-tab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4 max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar"
                >
                  <AdmissionForm
                    formData={customFormData}
                    setFormData={setCustomFormData}
                    lang={lang}
                    classes={classes}
                    selectedClassId={customFormData.class_id || selectedClassId || ''}
                    onClassChange={(cId) => setSelectedClassId(cId)}
                    isExistingStudent={Boolean(selectedStudent?.id)}
                    isSavingStudent={isSavingStudent}
                    onSaveStudent={(andDownload) => handleSaveStudentToDatabase(andDownload)}
                    onDownloadOnly={() => handleDownloadDataPdf(null, customFormData)}
                    onClearNewForm={handleStartNewAdmission}
                    onResetData={() => {
                      setSelectedStudent(null);
                      setCustomFormData(sampleFormData);
                    }}
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
                  {/* Online New Student Admission Card */}
                  <section className="bg-gradient-to-br from-blue-600/10 via-indigo-500/5 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 p-5 rounded-[2.2rem] border-2 border-blue-500/30 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/25">
                          <UserPlus size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-blue-700 dark:text-blue-300 uppercase bg-blue-100 dark:bg-blue-900/60 px-2.5 py-0.5 rounded-full">
                            {lang === 'bn' ? 'অনলাইন ভর্তি ও অটো সেভ' : 'Online Admission & Auto Save'}
                          </span>
                          <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm font-noto mt-1">
                            {lang === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি ও ফরম ডাউনলোড' : 'New Student Admission & Form PDF'}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {lang === 'bn'
                        ? 'নতুন শিক্ষার্থীর তথ্য পূরণ করে সরাসরি নির্দিষ্ট ক্লাসে ভর্তি করতে এবং সাথে সাথে পূরণকৃত ভর্তি ফরম PDF ডাউনলোড করতে নিচের বাটনে ক্লিক করুন।'
                        : 'Fill out a new student admission form, save them directly to their assigned class, and download their completed PDF.'}
                    </p>

                    <button
                      onClick={handleStartNewAdmission}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all text-xs cursor-pointer"
                    >
                      <UserPlus size={16} />
                      <span>{lang === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি ফরম পূরণ করুন' : 'Fill New Student Admission Form'}</span>
                    </button>
                  </section>

                  {/* Offline Blank Form Card */}
                  <section className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900 p-5 rounded-[2.2rem] border-2 border-emerald-500/30 shadow-sm space-y-3.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30">
                          <FileSpreadsheet size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-emerald-700 dark:text-emerald-300 uppercase bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full">
                            {lang === 'bn' ? 'অফলাইন প্রিন্ট উপযোগী' : 'Offline Print Ready'}
                          </span>
                          <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm font-noto mt-1">
                            {lang === 'bn' ? 'অফলাইন ব্ল্যাঙ্ক ভর্তি ফরম' : 'Offline Blank Admission Form'}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {lang === 'bn' 
                        ? 'সরাসরি প্রিন্ট করে হাতে লেখার জন্য সম্পূর্ণ খালি ভর্তি ফরম। ১-পৃষ্ঠা কমপ্যাক্ট অথবা ২-পৃষ্ঠা উভয় পিঠ (রসিদ স্লিপসহ) যেকোনো মোডে প্রিন্ট করতে পারবেন।' 
                        : 'Completely blank admission form with clean handwriting lines and offline photo box, ready for printing in 1-Page or 2-Page mode.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
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

                  {/* Existing Student Search & Class List */}
                  <section className="bg-white dark:bg-slate-900 p-6 rounded-[2.2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                          <User size={18} />
                        </div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider text-xs font-noto">
                          {lang === 'bn' ? 'বিদ্যমান শিক্ষার্থী নির্বাচন' : 'Existing Students'}
                        </h3>
                      </div>
                      
                      {selectedStudent && (
                        <button
                          onClick={() => setActiveTab('edit')}
                          className="text-[11px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-xl cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>{lang === 'bn' ? 'তথ্য এডিট করুন' : 'Edit Info'}</span>
                        </button>
                      )}
                    </div>

                    {/* Class Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {lang === 'bn' ? 'ক্লাস অনুযায়ী শিক্ষার্থী দেখুন' : 'Filter by Class'}
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
                        placeholder={lang === 'bn' ? 'নাম বা এডমিশন নম্বর দিয়ে খুঁজুন...' : 'Search by Name or ID...'}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-xs transition-all dark:text-slate-100"
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <button 
                        onClick={searchStudents}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                      >
                        <ArrowLeft className="rotate-180" size={14} />
                      </button>
                    </div>

                    {/* Students List (from search or class) */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        (selectedClassId ? studentsInClass : students).map(student => (
                          <div
                            key={student.id}
                            onClick={() => handleSelectStudent(student)}
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
                                  {student.roll ? `রোল: ${student.roll} • ` : ''}{(student as any).classes?.class_name || 'Class'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectStudent(student);
                                  setActiveTab('edit');
                                }}
                                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 rounded-xl transition-all cursor-pointer"
                                title={lang === 'bn' ? 'তথ্য এডিট করুন' : 'Edit student data'}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectStudent(student);
                                  handleDownloadDataPdf(student);
                                }}
                                disabled={downloadModal.isOpen && !downloadModal.isComplete}
                                className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-1 text-xs font-bold transition-all"
                                title={lang === 'bn' ? 'পিডিএফ ডাউনলোড করুন' : 'Download PDF'}
                              >
                                <Download size={13} />
                                <span>PDF</span>
                              </button>
                            </div>
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
          <div className="flex-1 space-y-4 min-w-0">
            {/* Live Preview Controls Header */}
            <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Sparkles size={20} className="animate-pulse shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-wider block leading-none font-noto">
                      {lang === 'bn' ? 'ভর্তি ফরম লাইভ প্রিভিউ' : 'Admission Form Live Preview'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isPreviewingBlank ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'}`}>
                      {isPreviewingBlank ? (lang === 'bn' ? 'ব্ল্যাঙ্ক ফরম মোড' : 'Blank Mode') : (lang === 'bn' ? 'তথ্যসহ মোড' : 'Data Mode')}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                      {config.layoutMode === '2-page'
                        ? (lang === 'bn' ? '২-পৃষ্ঠা (উভয় পিঠ + রসিদ স্লিপ)' : '2-Page Double-Sided')
                        : (lang === 'bn' ? '১-পৃষ্ঠা (কমপ্যাক্ট)' : '1-Page Compact')}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 mt-1 block">
                    {isPreviewingBlank
                      ? (lang === 'bn' ? 'অফলাইনে হাতে লেখার জন্য খালি ঘর ও খালি ফটো বক্স দেখানো হচ্ছে' : 'Displaying clean writing boxes & empty photo frame for offline use')
                      : (selectedStudent ? `${selectedStudent.student_name}-এর তথ্য সহ দেখানো হচ্ছে` : (customFormData.studentName ? `${customFormData.studentName}-এর তথ্য সহ দেখানো হচ্ছে` : (lang === 'bn' ? 'নতুন ভর্তি ফরম প্রিভিউ দেখানো হচ্ছে' : 'Showing admission form preview')))}
                  </span>
                </div>
              </div>

              {/* Toggle Preview, Layout Mode & Quick Download Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Layout Switcher (Mobile/Tablet & Quick Toggle) */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, layoutMode: '1-page' }))}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${config.layoutMode !== '2-page' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    {lang === 'bn' ? '১-পৃষ্ঠা' : '1-Page'}
                  </button>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, layoutMode: '2-page' }))}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${config.layoutMode === '2-page' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    {lang === 'bn' ? '২-পৃষ্ঠা' : '2-Page'}
                  </button>
                </div>

                {/* Data vs Blank Mode Toggle */}
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
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold rounded-2xl flex items-center gap-1.5 text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>{lang === 'bn' ? 'ব্ল্যাঙ্ক PDF' : 'Blank PDF'}</span>
                </button>

                <button
                  onClick={() => handleDownloadDataPdf(null, customFormData)}
                  disabled={downloadModal.isOpen && !downloadModal.isComplete}
                  className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold rounded-2xl flex items-center gap-1.5 text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>{lang === 'bn' ? 'তথ্যসহ PDF' : 'Data PDF'}</span>
                </button>
              </div>
            </div>

            <AdmissionFormPreview 
              formData={customFormData} 
              madrasah={madrasah} 
              lang={lang} 
              config={config}
              hideButtons={true}
              isBlank={isPreviewingBlank}
              onDownloadRequest={(isBlank) => {
                if (isBlank) handleDownloadBlank();
                else handleDownloadDataPdf(null, customFormData);
              }}
            />
          </div>
        </div>
      </div>

      {/* Beautiful Download Progress & Completion Popup Modal */}
      <AnimatePresence>
        {downloadModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 print:hidden">
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
                            : (lang === 'bn' ? `${downloadModal.student?.student_name || customFormData.studentName || 'শিক্ষার্থী'}-এর ফরম তৈরি হচ্ছে...` : 'Generating Form PDF...'))}
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
                    <span className="text-slate-400 font-bold">{lang === 'bn' ? 'লেআউট মোড:' : 'Layout:'}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {config.layoutMode === '2-page'
                        ? (lang === 'bn' ? 'A4 ২-পৃষ্ঠা (উভয় পিঠ)' : 'A4 2-Page Double-Sided')
                        : (lang === 'bn' ? 'A4 ১-পৃষ্ঠা (কমপ্যাক্ট)' : 'A4 1-Page Compact')}
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
                        else handleDownloadDataPdf(downloadModal.student, customFormData);
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
                        else handleDownloadDataPdf(downloadModal.student, customFormData);
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
