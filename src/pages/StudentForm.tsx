
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Save, User as UserIcon, Phone, List, Hash, Loader2, ChevronDown, Camera, X, Check, UserCheck, AlertCircle, BookOpen } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { OfflineService } from 'services/OfflineService';
import { CacheService } from 'services/cacheService';
import { requestManager } from 'services/RequestManager';
import { Student, Class, Language, Institution } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';
import { extractStudentExtraFields, packStudentNotesWithExtra } from 'utils/studentExtraFields';
import { DobPicker } from '../components/common/DobPicker';
import { checkStudentLimit } from '../utils/studentLimitChecker';

interface StudentFormProps {
  student?: Student | null;
  madrasah: Institution | null;
  defaultClassId?: string;
  isEditing: boolean;
  onSuccess: (student?: Student) => void;
  onCancel: () => void;
  lang: Language;
  title?: string;
  activeYear?: any;
}

const StudentForm: React.FC<StudentFormProps> = ({ student, madrasah, defaultClassId, isEditing, onSuccess, onCancel, lang, title, activeYear }) => {
  const initialExtra = extractStudentExtraFields(student);

  const [name, setName] = useState(student?.student_name || '');
  const [nameEn, setNameEn] = useState(student?.name_en || '');
  const [registrationNumber, setRegistrationNumber] = useState(student?.registration_number || '');
  const [biometricId, setBiometricId] = useState(student?.biometric_id || initialExtra?.biometric_id || '');
  const [guardianName, setGuardianName] = useState(student?.guardian_name || '');
  const [motherName, setMotherName] = useState(student?.mother_name || '');
  const [section, setSection] = useState(student?.section || '');
  const [roll, setRoll] = useState(student?.roll?.toString() || '');
  const [dob, setDob] = useState(student?.date_of_birth || '');
  const [bloodGroup, setBloodGroup] = useState(student?.blood_group || '');
  const [phone, setPhone] = useState(student?.guardian_phone || '');
  const [phone2, setPhone2] = useState(student?.guardian_phone_2 || '');
  const [address, setAddress] = useState(student?.address || '');
  const [classId, setClassId] = useState(student?.class_id || defaultClassId || '');
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  // Additional Admission Form fields
  const [gender, setGender] = useState(initialExtra.gender || '');
  const [nationality, setNationality] = useState(initialExtra.nationality || '');
  const [religion, setReligion] = useState(initialExtra.religion || '');
  const [fatherName, setFatherName] = useState(initialExtra.father_name || '');
  const [fatherOccupation, setFatherOccupation] = useState(initialExtra.father_occupation || '');
  const [motherOccupation, setMotherOccupation] = useState(initialExtra.mother_occupation || '');
  const [guardianRelation, setGuardianRelation] = useState(initialExtra.guardian_relation || '');
  const [permanentAddress, setPermanentAddress] = useState(initialExtra.permanent_address || '');
  const [previousInstitution, setPreviousInstitution] = useState(initialExtra.previous_institution || '');
  const [previousClass, setPreviousClass] = useState(initialExtra.previous_class || '');

  
  const [errorModal, setErrorModal] = useState<{show: boolean, message: string}>({show: false, message: ''});

  const isDark = madrasah?.theme === 'dark';

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    const cacheKey = `classes_${madrasah.id}`;
    const cached = offlineApi.getCache(cacheKey);
    if (cached) setClasses(sortMadrasahClasses(cached));

    try {
      const { data } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', madrasah.id),
        `classes:${madrasah.id}`,
        30 * 60 * 1000 // 30 mins
      );
      
      if (data) {
        const sorted = sortMadrasahClasses(data);
        setClasses(sorted);
        offlineApi.setCache(cacheKey, sorted);
      }
    } catch (e) {
      console.error('Failed to fetch classes in StudentForm:', e);
    }
  };


  const getSelectedClassName = () => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.class_name : t('class_choose', lang, madrasah?.institution_type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !classId || !madrasah) {
      setErrorModal({ show: true, message: lang === 'bn' ? 'সব তথ্য পূরণ করুন' : 'Fill required fields' });
      return;
    }

    if (phone.length < 10 || phone.length > 15) {
      setErrorModal({ 
        show: true, 
        message: t('invalid_phone', lang, madrasah?.institution_type)
      });
      return;
    }

    setLoading(true);
    try {
      if (!isEditing && navigator.onLine && madrasah?.id) {
        const limitCheck = await checkStudentLimit(madrasah.id, madrasah.config_json);
        if (limitCheck.isLimitReached) {
          setErrorModal({
            show: true,
            message: lang === 'bn'
              ? (limitCheck.isSharedBranchLimit
                  ? `দুঃখিত, মূল ও শাখা ক্যাম্পাস মিলিয়ে নির্ধারিত সর্বোচ্চ ${limitCheck.limit} জন শিক্ষার্থীর কোটা পূর্ণ হয়ে গেছে (বর্তমান মোট: ${limitCheck.currentCount} জন)। নতুন শিক্ষার্থী যোগ করতে লিমিট বৃদ্ধি করতে হবে।`
                  : `দুঃখিত, আপনার প্রতিষ্ঠানে সর্বোচ্চ ${limitCheck.limit} জন শিক্ষার্থী অ্যাড করার লিমিট রয়েছে। লিমিট বাড়াতে কর্তৃপক্ষের সাথে যোগাযোগ করুন।`)
              : (limitCheck.isSharedBranchLimit
                  ? `Total student capacity reached across all campuses! Limit is ${limitCheck.limit} (current: ${limitCheck.currentCount}).`
                  : `Limit reached! You can only add up to ${limitCheck.limit} students.`)
          });
          setLoading(false);
          return;
        }
      }

      const studentFormParsedConfig = typeof madrasah.config_json === 'string' ? JSON.parse(madrasah.config_json) : (madrasah.config_json || {});
      let activeYearId = activeYear?.id || studentFormParsedConfig?.active_academic_year_id;

      if (!activeYearId && madrasah?.id) {
        try {
          const { data: dbYear } = await supabase.from('academic_years').select('id').eq('institution_id', madrasah.id).eq('status', 'active').maybeSingle();
          if (dbYear?.id) activeYearId = dbYear.id;
        } catch (e) {
          console.warn('Could not fetch active year in StudentForm:', e);
        }
      }
      
      // Validate UUID format for academic_year_id
      const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      const bengaliToEnglish: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
      const englishRoll = roll ? roll.replace(/[০-৯]/g, match => bengaliToEnglish[match]) : '';

      const extraFields: any = {
        gender: (gender || '').trim() || null,
        nationality: (nationality || '').trim() || null,
        religion: (religion || '').trim() || null,
        father_name: (fatherName || '').trim() || null,
        father_occupation: (fatherOccupation || '').trim() || null,
        mother_occupation: (motherOccupation || '').trim() || null,
        guardian_relation: (guardianRelation || '').trim() || null,
        permanent_address: (permanentAddress || '').trim() || null,
        previous_institution: (previousInstitution || '').trim() || null,
        previous_class: (previousClass || '').trim() || null,
        biometric_id: biometricId.trim() || null
      };

      // Pack extra admission fields into notes as fallback so data is NEVER lost regardless of DB schema state
      const existingNotes = isEditing ? (student?.notes || '') : '';
      const packedNotes = packStudentNotesWithExtra(existingNotes, extraFields);

      const payload: any = {
        student_name: name.trim(),
        name_en: nameEn.trim() || null,
        registration_number: registrationNumber.trim() || null,
        biometric_id: biometricId.trim() || null,
        guardian_name: guardianName.trim(),
        mother_name: motherName.trim() || null,
        roll: englishRoll ? parseInt(englishRoll) : null,
        date_of_birth: dob || null,
        blood_group: bloodGroup || null,
        guardian_phone: phone.trim(),
        guardian_phone_2: phone2.trim() || null,
        address: address.trim() || null,
        class_id: classId,
        section: section.trim() || null,
        institution_id: madrasah.id,
        academic_year_id: (activeYearId && isValidUUID(activeYearId)) ? activeYearId : null,
        notes: packedNotes || null,
        ...extraFields
      };

      let finalStudent: any = null;
      let currentPayload = { ...payload };
      const extraFieldKeys = [
        'gender', 'nationality', 'religion', 'father_name', 'father_occupation',
        'mother_occupation', 'guardian_relation', 'permanent_address',
        'previous_institution', 'previous_class', 'biometric_id'
      ];

      // Robust retry loop (handles missing columns or foreign key violations gracefully)
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          if (isEditing && student) {
            finalStudent = await OfflineService.safeUpdate('students', student.id, currentPayload);
          } else {
            finalStudent = await OfflineService.safeInsert('students', currentPayload);
          }
          break; // Successful save!
        } catch (innerErr: any) {
          console.error(`Save attempt ${attempt + 1} encountered error:`, innerErr);

          // If foreign key violation on academic_year_id, retry with null
          if (currentPayload.academic_year_id && (innerErr.message?.includes('foreign key constraint') || innerErr.code === '23503')) {
            currentPayload.academic_year_id = null;
            continue;
          }

          // If specific column does not exist in DB, strip the column and retry
          if (innerErr.code === 'PGRST204' || innerErr.message?.includes('does not exist') || innerErr.message?.includes('column')) {
            const missingColumn = innerErr.message?.match(/column "(.*?)"/)?.[1];
            if (missingColumn && currentPayload.hasOwnProperty(missingColumn)) {
              delete currentPayload[missingColumn];
            } else {
              // Strip all extra column keys at once if single key not identified
              extraFieldKeys.forEach(k => delete currentPayload[k]);
            }
            continue;
          }

          // Other unexpected error, rethrow
          throw innerErr;
        }
      }

      // Merge saved payload fields to ensure local state and caller receives 100% complete data
      const mergedStudent = Array.isArray(finalStudent) ? finalStudent[0] : (finalStudent || {});
      const enrichedStudent: Student = {
        ...(student || {}),
        ...payload,
        ...mergedStudent,
        ...extraFields,
        notes: packedNotes || mergedStudent.notes || null,
        id: mergedStudent.id || student?.id || payload.id || '',
      };
      
      // Cache Invalidation
      if (madrasah) {
        requestManager.invalidatePattern('fetch:students:');
        requestManager.invalidatePattern('v6_students:');
        requestManager.invalidatePattern('students');
        requestManager.invalidatePattern(`stats:${madrasah.id}`);
        requestManager.invalidatePattern(`fees:${madrasah.id}`);
        requestManager.invalidatePattern(`dashboard_`);
        
        // Update IndexedDB Cache if online
        if (navigator.onLine) {
          const { data: updatedStudents } = await supabase
            .from('students')
            .select('*')
            .eq('institution_id', madrasah.id)
            .eq('class_id', classId);
          if (updatedStudents) {
            await CacheService.cacheData('students', madrasah.id, updatedStudents);
          }
        }
      }
      
      onSuccess(enrichedStudent);
    } catch (err: any) { 
      let msg = err.message;
      if (err.code === '23505') {
        msg = t('duplicate_roll', lang, madrasah?.institution_type);
      } else if (err.code === 'PGRST204' || err.message?.includes('mother_name does not exist')) {
        msg = 'Database needs update! Please run the SQL migration in Supabase to add mother_name column.';
      }
      setErrorModal({ show: true, message: msg });
    } finally { setLoading(false); }
  };

  const handlePhoneChange = (val: string, setter: (v: string) => void) => {
    const numericValue = val.replace(/\D/g, '').slice(0, 15);
    setter(numericValue);
  };

  return (
    <div className="animate-in slide-in-from-bottom-6 duration-700 pb-24 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 bg-gradient-to-br from-[#2563EB] to-[#1E40AF] shadow-2xl border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
          <UserIcon size={100} strokeWidth={1} />
        </div>
        <div className="relative z-10 flex items-center gap-5">
          <button 
            onClick={onCancel} 
            className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-[1rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 shadow-lg shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-lg font-black text-white font-noto tracking-tight drop-shadow-sm">
              {title || (isEditing ? t('edit_student', lang, madrasah?.institution_type) : t('add_student', lang, madrasah?.institution_type))}
            </h1>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">
              {isEditing ? 'Update existing record' : 'Register new student'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Form Container */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-none' : 'bg-white border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]'} p-6 rounded-[2.5rem] border space-y-6`}>
          
          {/* Section: Basic Info */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
              <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'প্রাথমিক তথ্য' : 'Basic Information'}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <UserIcon size={11} className="text-[#2563EB]" /> 
                  {t('student_name', lang, madrasah?.institution_type)}
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="Full Name"
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <UserIcon size={11} className="text-[#2563EB]" /> 
                  {lang === 'bn' ? 'নাম (ইংরেজি - ঐচ্ছিক)' : 'Name (English - Optional)'}
                </label>
                <input 
                  type="text" 
                  placeholder="English Name (Optional)"
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={nameEn} 
                  onChange={(e) => setNameEn(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <Hash size={11} className="text-[#2563EB]" /> 
                  {lang === 'bn' ? 'রেজি: নম্বর' : 'Registration No.'}
                </label>
                <input 
                  type="text" 
                  placeholder="Registration ID"
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={registrationNumber} 
                  onChange={(e) => setRegistrationNumber(e.target.value)} 
                />
              </div>

              {(madrasah?.config_json as any)?.modules?.biometric_device_sync && (
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                    <UserCheck size={11} className="text-[#2563EB]" /> 
                    {lang === 'bn' ? 'বায়োমেট্রিক আইডি' : 'Biometric ID'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={lang === 'bn' ? "মেশিনের আইডি (যেমন: 101)" : "Machine ID (e.g., 101)"}
                    className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                    value={biometricId} 
                    onChange={(e) => setBiometricId(e.target.value)} 
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <UserCheck size={11} className="text-[#2563EB]" /> 
                  {t('guardian_name', lang, madrasah?.institution_type)}
                </label>
                <input 
                  type="text" 
                  placeholder="Father/Guardian Name"
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={guardianName} 
                  onChange={(e) => setGuardianName(e.target.value)} 
                />
              </div>

              {(madrasah?.institution_type === 'school' || madrasah?.institution_type === 'madrasah') && (
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                    <UserCheck size={11} className="text-[#2563EB]" /> 
                    {lang === 'bn' ? 'মাতার নাম' : "Mother's Name"}
                  </label>
                  <input 
                    type="text" 
                    placeholder={lang === 'bn' ? 'মাতার নাম' : "Mother's Name"}
                    className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                    value={motherName} 
                    onChange={(e) => setMotherName(e.target.value)} 
                  />
                </div>
              )}

              <DobPicker
                label={t('dob', lang, madrasah?.institution_type)}
                value={dob}
                onChange={setDob}
                lang={lang}
                isDark={isDark}
              />

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <AlertCircle size={11} className="text-[#2563EB]" /> 
                  {lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
                </label>
                <select 
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm appearance-none`} 
                  value={bloodGroup} 
                  onChange={(e) => setBloodGroup(e.target.value)} 
                >
                  <option value="">{lang === 'bn' ? 'নির্বাচন করুন' : 'Select'}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                <List size={11} className="text-[#2563EB]" /> 
                {t('address', lang, madrasah?.institution_type)}
              </label>
              <textarea 
                placeholder="Full Address"
                className={`w-full min-h-[100px] p-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm resize-none`} 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
              />
            </div>
          </div>

          {/* Section: Academic & Contact */}
          <div className={`space-y-5 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-50'}`}>
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
              <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'একাডেমিক ও যোগাযোগ' : 'Academic & Contact'}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <Hash size={11} className="text-[#2563EB]" /> 
                  {t('roll', lang, madrasah?.institution_type)}
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9০-৯]*"
                  placeholder="00"
                  className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] font-black text-lg outline-none text-center focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={roll} 
                  onChange={(e) => setRoll(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <BookOpen size={11} className="text-[#2563EB]" /> 
                  {t('section', lang)}
                </label>
                <input 
                  type="text" 
                  placeholder={lang === 'bn' ? 'উদা: ক শাখা / বিজ্ঞান' : 'e.g. Sec A / Science'}
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={section} 
                  onChange={(e) => setSection(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <List size={11} className="text-[#2563EB]" /> 
                  {t('classes', lang, madrasah?.institution_type)}
                </label>
                <div 
                  onClick={() => setShowClassModal(true)} 
                  className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 hover:border-blue-500/50' : 'bg-slate-50 border-slate-100 hover:border-[#2563EB]/30'} border-2 rounded-[1.2rem] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-sm group`}
                >
                  <span className={`font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} truncate text-sm leading-none font-noto`}>{getSelectedClassName()}</span>
                  <ChevronDown size={16} className="text-[#2563EB] shrink-0 group-hover:translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <Phone size={11} className="text-[#2563EB]" /> 
                  {t('phone_primary_wa', lang, madrasah?.institution_type)}
                </label>
                <input 
                  type="tel" 
                  required 
                  placeholder="01XXXXXXXXX"
                  className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={phone} 
                  onChange={(e) => handlePhoneChange(e.target.value, setPhone)} 
                />
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  <Phone size={11} className="text-[#2563EB]" /> 
                  {t('phone_secondary_15', lang, madrasah?.institution_type)}
                </label>
                <input 
                  type="tel" 
                  placeholder="Optional Number"
                  className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={phone2} 
                  onChange={(e) => handlePhoneChange(e.target.value, setPhone2)} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Optional Admission Fields Section */}
        <div className={`p-4 sm:p-7 rounded-[2rem] border-2 transition-all duration-300 ${isDark ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600' : 'bg-white border-blue-50/80 hover:border-blue-100 shadow-[0_15px_40px_-20px_rgba(37,99,235,0.05)]'}`}>
          <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-slate-100 dark:border-slate-700">
            <div>
              <h2 className={`text-lg sm:text-xl font-black font-noto tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                  <BookOpen size={20} className="stroke-[2.5]" />
                </div>
                {lang === 'bn' ? 'অতিরিক্ত তথ্য (ঐচ্ছিক)' : 'Additional Information (Optional)'}
              </h2>
              <p className={`text-[11px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'bn' ? 'ভর্তি ফরমের জন্য' : 'For Admission Form'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-7">
            {/* Gender */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'লিঙ্গ' : 'Gender'}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
              >
                <option value="">{lang === 'bn' ? 'নির্বাচন করুন' : 'Select'}</option>
                <option value="male">{lang === 'bn' ? 'ছাত্র' : 'Male'}</option>
                <option value="female">{lang === 'bn' ? 'ছাত্রী' : 'Female'}</option>
                <option value="other">{lang === 'bn' ? 'অন্যান্য' : 'Other'}</option>
              </select>
            </div>

            {/* Nationality */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'জাতীয়তা' : 'Nationality'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: বাংলাদেশী' : 'e.g. Bangladeshi'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              />
            </div>

            {/* Religion */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'ধর্ম' : 'Religion'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: ইসলাম' : 'e.g. Islam'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
              />
            </div>

            {/* Father's Name */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'পিতার নাম' : "Father's Name"}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'পিতার নাম' : "Father's Name"}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
              />
            </div>

            {/* Father's Occupation */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'পিতার পেশা' : "Father's Occupation"}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: ব্যবসায়ী' : 'e.g. Businessman'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={fatherOccupation}
                onChange={(e) => setFatherOccupation(e.target.value)}
              />
            </div>

            {/* Mother's Occupation */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'মাতার পেশা' : "Mother's Occupation"}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: গৃহিণী' : 'e.g. Housewife'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={motherOccupation}
                onChange={(e) => setMotherOccupation(e.target.value)}
              />
            </div>

            {/* Guardian Relation */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'অভিভাবকের সাথে সম্পর্ক' : 'Guardian Relation'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: পিতা/মাতা' : 'e.g. Father'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={guardianRelation}
                onChange={(e) => setGuardianRelation(e.target.value)}
              />
            </div>

            {/* Previous Institution */}
            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'পূর্ববর্তী প্রতিষ্ঠান' : 'Previous Institution'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={previousInstitution}
                onChange={(e) => setPreviousInstitution(e.target.value)}
              />
            </div>

            {/* Previous Class */}
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'পূর্ববর্তী শ্রেণী' : 'Previous Class'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'শ্রেণীর নাম' : 'Class Name'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={previousClass}
                onChange={(e) => setPreviousClass(e.target.value)}
              />
            </div>

            {/* Permanent Address */}
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'বিস্তারিত ঠিকানা লিখুন...' : 'Enter permanent address...'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-indigo-500'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:bg-transparent focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm`}
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Enhanced Submit Button */}
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full h-[64px] bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-black rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(37,99,235,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 text-base font-noto border border-white/10 uppercase tracking-[0.2em] relative overflow-hidden group disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          {loading ? <Loader2 className="animate-spin" size={28} /> : (
            <>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Save size={22} strokeWidth={2.5} />
              </div>
              <span className="drop-shadow-lg">{t('save', lang, madrasah?.institution_type)}</span>
            </>
          )}
        </button>
      </form>

      {showClassModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-2xl' : 'bg-white border-[#2563EB]/5 shadow-[0_40px_100px_rgba(37,99,235,0.15)]'} w-full max-w-sm rounded-[2.5rem] p-8 relative animate-in zoom-in-95 duration-300 border`}>
            <button onClick={() => setShowClassModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-[#2563EB] transition-all"><X size={22} strokeWidth={3} /></button>
            
            <div className="flex items-center gap-4 mb-6">
               <div className={`w-14 h-14 ${isDark ? 'bg-blue-900/30 border-blue-800/50 text-blue-400' : 'bg-blue-50 border-blue-100 text-[#2563EB]'} rounded-[1.5rem] flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={28} />
               </div>
               <div>
                  <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto tracking-tight`}>{t('select_class', lang, madrasah?.institution_type)}</h2>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Select a class</p>
               </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
               {classes.map(cls => (
                 <button key={cls.id} onClick={() => { setClassId(cls.id); setShowClassModal(false); }} className={`w-full p-4 rounded-[1.5rem] font-black transition-all flex items-center justify-between border-2 ${classId === cls.id ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xl' : isDark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                    <span className="font-noto text-base">{cls.class_name}</span>
                    {classId === cls.id && <Check size={18} strokeWidth={4} />}
                 </button>
               ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {errorModal.show && createPortal(
         <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className={`${isDark ? 'bg-slate-800 border-red-900/30 shadow-2xl' : 'bg-white border-red-50 shadow-[0_40px_100px_rgba(239,68,68,0.2)]'} w-full max-w-sm p-10 rounded-[3.5rem] text-center space-y-6 animate-in zoom-in-95 duration-300 border`}>
               <div className={`w-20 h-20 ${isDark ? 'bg-red-900/20 border-red-800/30 text-red-400' : 'bg-red-50 border-red-100 text-red-500'} rounded-full flex items-center justify-center mx-auto shadow-inner border`}>
                 <AlertCircle size={40} />
               </div>
               <div>
                 <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'} font-noto tracking-tight`}>সতর্কবাণী</h3>
                 <p className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-400'} mt-2 text-[13px] leading-relaxed`}>{errorModal.message}</p>
               </div>
               <button onClick={() => setErrorModal({show: false, message: ''})} className={`w-full py-5 ${isDark ? 'bg-slate-900 text-blue-400' : 'bg-slate-100 text-[#2E0B5E]'} rounded-full font-black text-sm uppercase tracking-widest active:scale-95 transition-all`}>ঠিক আছে</button>
            </div>
         </div>,
         document.body
      )}
    </div>
  );
};

export default StudentForm;
