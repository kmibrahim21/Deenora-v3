
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Save, User as UserIcon, Phone, List, Hash, Loader2, ChevronDown, Camera, X, Check, UserCheck, AlertCircle, BookOpen } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { OfflineService } from 'services/OfflineService';
import { Student, Class, Language, Institution } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Classes';

interface StudentFormProps {
  student?: Student | null;
  madrasah: Institution | null;
  defaultClassId?: string;
  isEditing: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  lang: Language;
  title?: string;
}

const StudentForm: React.FC<StudentFormProps> = ({ student, madrasah, defaultClassId, isEditing, onSuccess, onCancel, lang, title }) => {
  const [name, setName] = useState(student?.student_name || '');
  const [guardianName, setGuardianName] = useState(student?.guardian_name || '');
  const [roll, setRoll] = useState(student?.roll?.toString() || '');
  const [phone, setPhone] = useState(student?.guardian_phone || '');
  const [phone2, setPhone2] = useState(student?.guardian_phone_2 || '');
  const [classId, setClassId] = useState(student?.class_id || defaultClassId || '');
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  
  const [errorModal, setErrorModal] = useState<{show: boolean, message: string}>({show: false, message: ''});

  const isDark = madrasah?.theme === 'dark';

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const cached = offlineApi.getCache('classes');
    if (cached) setClasses(sortMadrasahClasses(cached));

    if (navigator.onLine && madrasah) {
      const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah.id);
      if (data) {
        const sorted = sortMadrasahClasses(data);
        setClasses(sorted);
        offlineApi.setCache('classes', sorted);
      }
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
      const payload = {
        student_name: name.trim(),
        guardian_name: guardianName.trim(),
        roll: roll ? parseInt(roll) : null,
        guardian_phone: phone.trim(),
        guardian_phone_2: phone2.trim() || null,
        class_id: classId,
        institution_id: madrasah.id
      };

      if (isEditing && student) {
        await OfflineService.safeUpdate('students', student.id, payload);
      } else {
        await OfflineService.safeInsert('students', payload);
      }
      
      onSuccess();
    } catch (err: any) { 
      let msg = err.message;
      if (err.code === '23505') {
        msg = t('duplicate_roll', lang, madrasah?.institution_type);
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
                  type="number" 
                  placeholder="00"
                  className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] font-black text-lg outline-none text-center focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={roll} 
                  onChange={(e) => setRoll(e.target.value)} 
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
