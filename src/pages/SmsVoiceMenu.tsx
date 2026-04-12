import React from 'react';
import { MessageSquare, Mic, ArrowLeft } from 'lucide-react';
import { Language, Institution, Profile, UserRole } from 'types';
import { t } from 'translations';

interface SmsVoiceMenuProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  onNavigateToSms: () => void;
  onNavigateToVoice: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const SmsVoiceMenu: React.FC<SmsVoiceMenuProps> = ({ lang, madrasah, onBack, onNavigateToSms, onNavigateToVoice, role, profile }) => {
  const isDark = madrasah?.theme === 'dark';
  const isTeacher = role === 'teacher';
  const canSendSms = !isTeacher || profile?.permissions?.can_send_sms;
  const canUseVoice = !isTeacher || profile?.permissions?.can_use_voice_call;
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className={`w-10 h-10 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-100 text-slate-600'} rounded-full flex items-center justify-center shadow-sm border active:scale-95 transition-all`}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} font-noto`}>{t('sms_voice', lang)}</h2>
          <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-400'} font-noto mt-0.5`}>{t('choose_broadcast', lang)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {canSendSms && (
          <button 
            onClick={onNavigateToSms}
            className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-[2rem] shadow-bubble border flex items-center gap-5 active:scale-[0.98] transition-all text-left group`}
          >
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <MessageSquare size={28} className="text-blue-600" />
            </div>
            <div>
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} font-noto mb-1`}>{t('send_sms', lang)}</h3>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} font-noto leading-relaxed`}>{t('send_sms_desc', lang)}</p>
            </div>
          </button>
        )}

        {canUseVoice && (
          <button 
            onClick={onNavigateToVoice}
            className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-[2rem] shadow-bubble border flex items-center gap-5 active:scale-[0.98] transition-all text-left group`}
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Mic size={28} className="text-emerald-600" />
            </div>
            <div>
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} font-noto mb-1`}>{t('voice_broadcast', lang)}</h3>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} font-noto leading-relaxed`}>{t('voice_broadcast_desc', lang)}</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default SmsVoiceMenu;
