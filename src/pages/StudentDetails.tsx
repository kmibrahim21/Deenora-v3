
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Edit3, User as UserIcon, Smartphone, PhoneCall, UserCheck, MessageCircle, Hash, BookOpen, Phone, Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
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
    <div className="animate-in slide-in-from-right-4 duration-700 pb-24 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_15px_40px_-10px_rgba(37,99,235,0.3)] border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 animate-pulse">
          <UserIcon size={120} strokeWidth={1} />
        </div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack} 
              className="w-11 h-11 bg-white/20 backdrop-blur-2xl rounded-[1.2rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-lg shrink-0 hover:bg-white/30"
            >
              <ArrowLeft size={22} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-xl font-black text-white font-noto tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                {t('student_details', lang, madrasah?.institution_type)}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">
                  {student.classes?.class_name || 'N/A'}
                </p>
              </div>
            </div>
          </div>
          
          {!readOnly && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="w-11 h-11 bg-red-500/20 backdrop-blur-2xl rounded-[1.2rem] flex items-center justify-center text-red-100 active:scale-90 transition-all border border-red-500/30 shadow-lg hover:bg-red-500/30"
              >
                <Trash2 size={20} />
              </button>
              <button 
                onClick={onEdit} 
                className="w-11 h-11 bg-white rounded-[1.2rem] flex items-center justify-center text-[#2563EB] active:scale-90 transition-all border border-white shadow-lg hover:shadow-[#2563EB]/20"
              >
                <Edit3 size={22} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className={`p-8 rounded-[3.5rem] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.08)] border relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`absolute top-0 left-0 w-full h-24 bg-gradient-to-b to-transparent ${isDark ? 'from-slate-800/50' : 'from-slate-50/50'}`} />
        
        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-[#2563EB] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className={`relative w-32 h-32 rounded-[2.5rem] flex items-center justify-center text-[#2563EB] border-4 shadow-xl overflow-hidden transform group-hover:scale-105 transition-transform duration-500 ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-800' : 'bg-gradient-to-br from-blue-50 to-white border-white'}`}>
              <UserIcon size={64} strokeWidth={2.5} />
            </div>
            <div className={`absolute -bottom-2 -right-2 w-11 h-11 bg-[#2563EB] text-white rounded-[1rem] flex items-center justify-center border-2 shadow-xl ${isDark ? 'border-slate-800' : 'border-white'}`}>
              <Hash size={22} strokeWidth={3} />
            </div>
          </div>
          
          <h2 className={`text-xl font-black font-noto tracking-tight leading-tight mb-2 drop-shadow-sm ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{student.student_name}</h2>
          
          <div className={`inline-flex items-center gap-3 px-6 py-2 rounded-[1.2rem] border-2 shadow-inner ${isDark ? 'bg-blue-900/20 border-[#2563EB]/20' : 'bg-blue-50 border-[#2563EB]/10'}`}>
            <span className="text-[11px] font-black text-[#2563EB] uppercase tracking-[0.2em]">{t('roll', lang)}: {student.roll || '-'}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-10 grid grid-cols-2 gap-4">
          <button 
            onClick={() => initiateWhatsAppCall(student.guardian_phone)} 
            className={`flex flex-col items-center justify-center p-6 border-2 rounded-[2rem] text-emerald-600 active:scale-95 transition-all group shadow-sm ${isDark ? 'bg-emerald-900/20 border-emerald-800/50 hover:bg-emerald-900/30 hover:shadow-emerald-900/20' : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50 hover:shadow-emerald-100'}`}
          >
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-[1rem] flex items-center justify-center mb-3 shadow-lg group-hover:rotate-12 transition-transform">
              <PhoneCall size={24} fill="currentColor" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em]">WA Call</span>
          </button>
          
          <button 
            onClick={() => initiateWhatsAppMessage(student.guardian_phone)} 
            className={`flex flex-col items-center justify-center p-6 border-2 rounded-[2rem] text-blue-600 active:scale-95 transition-all group shadow-sm ${isDark ? 'bg-blue-900/20 border-blue-800/50 hover:bg-blue-900/30 hover:shadow-blue-900/20' : 'bg-blue-50 border-blue-100 hover:bg-blue-100/50 hover:shadow-blue-100'}`}
          >
            <div className="w-12 h-12 bg-blue-500 text-white rounded-[1rem] flex items-center justify-center mb-3 shadow-lg group-hover:-rotate-12 transition-transform">
              <MessageCircle size={24} fill="currentColor" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em]">WA Chat</span>
          </button>
        </div>

        {/* Detailed Info Section */}
        <div className="mt-10 space-y-5">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-1.5 h-6 bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] rounded-full shadow-lg shadow-[#2563EB]/20" />
            <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'অভিভাবকের তথ্য' : 'Guardian Details'}</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
              <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <UserCheck size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{t('guardian_name', lang)}</p>
                <p className={`text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_name || 'N/A'}</p>
              </div>
            </div>

            <div className={`flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <Smartphone size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{t('guardian_phone', lang)}</p>
                  <p className={`text-lg font-black tracking-tight leading-none ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_phone}</p>
                </div>
              </div>
              <button 
                onClick={() => window.location.href = `tel:${student.guardian_phone}`}
                className="w-11 h-11 bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] text-white rounded-[1rem] flex items-center justify-center shadow-lg shadow-[#2563EB]/20 active:scale-90 transition-all hover:rotate-6"
              >
                <Phone size={20} fill="currentColor" />
              </button>
            </div>

            {student.guardian_phone_2 && (
              <div className={`flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all group animate-in slide-in-from-top-4 ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-blue-400/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-blue-400/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center text-blue-400 shrink-0 shadow-md border group-hover:bg-blue-400 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <Smartphone size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{t('guardian_phone_2', lang)}</p>
                    <p className={`text-lg font-black tracking-tight leading-none ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_phone_2}</p>
                  </div>
                </div>
                <button 
                  onClick={() => window.location.href = `tel:${student.guardian_phone_2}`}
                  className="w-11 h-11 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-[1rem] flex items-center justify-center shadow-lg shadow-blue-400/20 active:scale-90 transition-all hover:-rotate-6"
                >
                  <Phone size={20} fill="currentColor" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className={`w-full max-w-sm rounded-[4rem] p-12 shadow-[0_50px_120px_rgba(239,68,68,0.3)] border text-center space-y-8 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'}`}>
             <div className="relative">
               <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse" />
               <div className={`relative w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner border mb-6 ${isDark ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-red-50 text-red-500 border-red-100'}`}>
                  <AlertTriangle size={48} />
               </div>
             </div>
             <div>
                <h3 className={`text-2xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('confirm_delete', lang)}</h3>
                <p className="text-[13px] font-bold text-slate-400 mt-3 uppercase tracking-wider px-2 leading-relaxed">
                  {lang === 'bn' ? `আপনি কি নিশ্চিতভাবে "${student.student_name}" এর সকল তথ্য মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।` : `Are you sure you want to delete all info for "${student.student_name}"? This cannot be undone.`}
                </p>
             </div>
             <div className="flex flex-col gap-4 pt-2">
                <button 
                  onClick={handleDelete} 
                  disabled={isDeleting} 
                  className="w-full py-6 bg-gradient-to-r from-red-500 to-red-600 text-white font-black rounded-full shadow-2xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center text-lg gap-3 border border-white/10"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={24} /> : (
                    <><Trash2 size={24} /> {t('confirm_btn', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  disabled={isDeleting}
                  className={`w-full py-5 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest border ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {t('cancel_btn', lang)}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentDetails;
