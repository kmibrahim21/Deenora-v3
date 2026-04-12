
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit3, User as UserIcon, Smartphone, PhoneCall, UserCheck, MessageCircle, BookOpen, Phone, Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { Student, Language, Institution } from 'types';
import { supabase } from 'supabase';
import { t } from 'translations';

interface StudentDetailsProps {
  student: Student;
  madrasah: Institution | null;
  onEdit: () => void;
  onBack: () => void;
  lang: Language;
  readOnly?: boolean;
  institutionId?: string;
  triggerRefresh?: () => void;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, madrasah, onEdit, onBack, lang, readOnly, institutionId, triggerRefresh }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDark = madrasah?.theme === 'dark';

  const initiateWhatsAppCall = async (phone: string) => {
    window.location.href = `https://wa.me/88${phone.replace(/\D/g, '')}`;
  };

  const initiateWhatsAppMessage = async (phone: string) => {
    window.location.href = `https://wa.me/88${phone.replace(/\D/g, '')}?text=${encodeURIComponent('আস-সালামু আলাইকুম')}`;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);
      
      if (error) throw error;
      
      if (triggerRefresh) triggerRefresh();
      onBack();
    } catch (err: any) {
      alert(err.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-right-4 duration-700 pb-20 space-y-4">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[1.2rem] p-5 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_10px_30px_-10px_rgba(37,99,235,0.3)] border border-white/20">
        <div className="absolute top-0 right-0 p-2 opacity-10 rotate-12 animate-pulse">
          <UserIcon size={60} strokeWidth={1} />
        </div>
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="w-9 h-9 bg-white/20 backdrop-blur-2xl rounded-[1rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-lg shrink-0 hover:bg-white/30"
            >
              <ArrowLeft size={18} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white font-noto tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                {t('student_details', lang, madrasah?.institution_type)}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-white/80 text-xs font-black uppercase tracking-[0.15em]">
                  {student.classes?.class_name || 'N/A'}
                </p>
              </div>
            </div>
          </div>
          
          {!readOnly && (
            <div className="flex gap-1.5">
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="w-9 h-9 bg-red-500/20 backdrop-blur-2xl rounded-[1rem] flex items-center justify-center text-red-100 active:scale-90 transition-all border border-red-500/30 shadow-lg hover:bg-red-500/30"
              >
                <Trash2 size={16} />
              </button>
              <button 
                onClick={onEdit} 
                className="w-9 h-9 bg-white rounded-[1rem] flex items-center justify-center text-[#2563EB] active:scale-90 transition-all border border-white shadow-lg hover:shadow-[#2563EB]/20"
              >
                <Edit3 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className={`p-5 rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`absolute top-0 left-0 w-full h-14 bg-gradient-to-b to-transparent ${isDark ? 'from-slate-800/50' : 'from-slate-50/50'}`} />
        
        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-2 group">
            <div className="absolute inset-0 bg-[#2563EB] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className={`relative w-24 h-24 rounded-[1rem] flex items-center justify-center text-[#2563EB] border-[2px] shadow-xl overflow-hidden transform group-hover:scale-105 transition-transform duration-500 ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-800' : 'bg-gradient-to-br from-blue-50 to-white border-white'}`}>
              <UserIcon size={48} strokeWidth={2.5} />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 min-w-[1.75rem] h-6 px-1 bg-[#2563EB] text-white rounded-[0.6rem] flex items-center justify-center border-2 shadow-xl ${isDark ? 'border-slate-800' : 'border-white'}`}>
              <span className="text-xs font-black tracking-tighter">{student.admission_number || '#'}</span>
            </div>
          </div>
          
          <h2 className={`text-xl font-black font-noto tracking-tight leading-tight mb-0.5 drop-shadow-sm ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{student.student_name}</h2>
          
          <div className="flex flex-wrap justify-center gap-1.5">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[0.7rem] border-2 shadow-inner ${isDark ? 'bg-blue-900/20 border-[#2563EB]/20' : 'bg-blue-50 border-[#2563EB]/10'}`}>
              <span className="text-xs font-black text-[#2563EB] uppercase tracking-[0.15em]">{t('roll', lang)}: {student.roll || '-'}</span>
            </div>
          </div>
        </div>

        {/* Detailed Info Section */}
        <div className="mt-4 space-y-4">
          {/* Personal Details */}
          {(student.date_of_birth || student.blood_group) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1.5 mb-1">
                <div className="w-0.5 h-3.5 bg-gradient-to-b from-indigo-500 to-indigo-800 rounded-full shadow-lg shadow-indigo-500/20" />
                <h3 className={`text-xs font-black uppercase tracking-[0.15em] ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ব্যক্তিগত তথ্য' : 'Personal Details'}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {student.date_of_birth && (
                  <div className={`flex items-center gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-indigo-500/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-indigo-500/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                    <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-indigo-500 shrink-0 shadow-md border group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{t('dob', lang)}</p>
                      <p className={`text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.date_of_birth}</p>
                    </div>
                  </div>
                )}
                {student.blood_group && (
                  <div className={`flex items-center gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-red-500/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-red-500/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                    <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-red-500 shrink-0 shadow-md border group-hover:bg-red-500 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}</p>
                      <p className={`text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.blood_group}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1.5 mb-1">
              <div className="w-0.5 h-3.5 bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] rounded-full shadow-lg shadow-[#2563EB]/20" />
              <h3 className={`text-xs font-black uppercase tracking-[0.15em] ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'অভিভাবকের তথ্য' : 'Guardian Details'}</h3>
            </div>

          <div className="grid grid-cols-1 gap-1.5">
            <div className={`flex items-center gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
              <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <UserCheck size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{t('guardian_name', lang)}</p>
                <p className={`text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_name || 'N/A'}</p>
              </div>
            </div>

            <div className={`flex flex-col p-4 rounded-[1.2rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <Smartphone size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'বাবা' : 'Father'}</p>
                    <p className={`text-base font-black tracking-tight leading-none ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_phone}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button 
                  onClick={() => window.location.href = `tel:${student.guardian_phone}`}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Phone size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'কল' : 'Call'}
                </button>
                <button 
                  onClick={() => initiateWhatsAppMessage(student.guardian_phone)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <MessageCircle size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'মেসেজ' : 'SMS'}
                </button>
                <button 
                  onClick={() => initiateWhatsAppCall(student.guardian_phone)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#128C7E] to-[#075E54] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  <PhoneCall size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'ওয়াটসঅ্যাপ' : 'WhatsApp'}
                </button>
              </div>
            </div>

            {student.guardian_phone_2 && (
              <div className={`flex flex-col p-4 rounded-[1.2rem] border-2 transition-all group animate-in slide-in-from-top-4 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-400/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-blue-400/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-blue-400 shrink-0 shadow-md border group-hover:bg-blue-400 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <Smartphone size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'মা' : 'Mother'}</p>
                      <p className={`text-base font-black tracking-tight leading-none ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_phone_2}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button 
                    onClick={() => window.location.href = `tel:${student.guardian_phone_2}`}
                    className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-400/20 active:scale-95 transition-all"
                  >
                    <Phone size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'কল' : 'Call'}
                  </button>
                  <button 
                    onClick={() => initiateWhatsAppMessage(student.guardian_phone_2)}
                    className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <MessageCircle size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'মেসেজ' : 'SMS'}
                  </button>
                  <button 
                    onClick={() => initiateWhatsAppCall(student.guardian_phone_2)}
                    className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#128C7E] to-[#075E54] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <PhoneCall size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'ওয়াটসঅ্যাপ' : 'WhatsApp'}
                  </button>
                </div>
              </div>
            )}

            {student.address && (
              <div className={`flex items-start gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <BookOpen size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{t('address', lang)}</p>
                  <p className={`text-sm font-bold font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-[#1E293B]'}`}>{student.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {showDeleteConfirm && (
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500 fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className={`w-full max-w-xs rounded-[3rem] p-8 shadow-[0_50px_120px_rgba(239,68,68,0.3)] border text-center space-y-6 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'}`}>
             <div className="relative">
               <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse" />
               <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner border mb-4 ${isDark ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-red-50 text-red-500 border-red-100'}`}>
                  <AlertTriangle size={40} />
               </div>
             </div>
             <div>
                <h3 className={`text-xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('confirm_delete', lang)}</h3>
                <p className="text-[12px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-2 leading-relaxed">
                  {lang === 'bn' ? `আপনি কি নিশ্চিতভাবে "${student.student_name}" এর সকল তথ্য মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।` : `Are you sure you want to delete all info for "${student.student_name}"? This cannot be undone.`}
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-1">
                <button 
                  onClick={handleDelete} 
                  disabled={isDeleting} 
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-black rounded-full shadow-2xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center text-base gap-2 border border-white/10"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={20} /> : (
                    <><Trash2 size={20} /> {t('confirm_btn', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  disabled={isDeleting}
                  className={`w-full py-4 font-black rounded-full active:scale-95 transition-all text-xs uppercase tracking-widest border ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {t('cancel_btn', lang)}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetails;
