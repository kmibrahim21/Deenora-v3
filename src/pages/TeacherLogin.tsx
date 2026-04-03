
import React, { useState } from 'react';
import { 
  Smartphone, Lock, Loader2, BookOpen, AlertCircle, 
  Moon, Star, Sparkles, ChevronLeft, UserCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, Institution } from 'types';
import { t } from 'translations';

interface TeacherLoginProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  onLoginSuccess: (teacherData: any) => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ lang, madrasah, onBack, onLoginSuccess }) => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = madrasah?.theme === 'dark';

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/teachers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store session
      localStorage.setItem('teacher_session', JSON.stringify({
        ...data,
        login_at: new Date().toISOString()
      }));

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message === 'Login failed' ? (lang === 'bn' ? 'ভুল মোবাইল নম্বর অথবা পাসওয়ার্ড!' : 'Invalid mobile or password!') : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+24px)] relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#0F172A]' : 'bg-blue-50'}`}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          className={`absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl ${isDark ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
          className={`absolute -bottom-20 -left-20 w-96 h-96 rounded-full blur-3xl ${isDark ? 'bg-teal-500/10' : 'bg-emerald-500/10'}`}
        />
        
        <motion.div 
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-20 right-[15%] ${isDark ? 'text-emerald-400/20' : 'text-blue-400/10'}`}
        >
          <Moon size={120} strokeWidth={1} />
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col items-center z-10 space-y-8"
      >
        <div className="text-center space-y-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="relative inline-block"
          >
            <div className={`w-24 h-24 backdrop-blur-xl rounded-[2.5rem] mx-auto flex items-center justify-center border shadow-2xl relative group ${isDark ? 'bg-white/5 border-white/20' : 'bg-white border-blue-100'}`}>
              <div className={`absolute inset-0 rounded-[2.5rem] blur-xl transition-colors ${isDark ? 'bg-emerald-500/20 group-hover:bg-emerald-500/30' : 'bg-blue-500/10 group-hover:bg-blue-500/20'}`} />
              <UserCircle2 size={48} strokeWidth={1.5} className={`relative z-10 ${isDark ? 'text-emerald-400' : 'text-blue-600'}`} />
            </div>
          </motion.div>
          
          <div className="space-y-1">
            <h1 className={`text-4xl font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'bn' ? 'শিক্ষক লগইন' : 'Teacher Login'}
            </h1>
            <div className={`flex items-center justify-center gap-2 ${isDark ? 'text-emerald-400/60' : 'text-blue-600/60'}`}>
              <Sparkles size={14} />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Teacher Portal Access</p>
              <Sparkles size={14} />
            </div>
          </div>
        </div>

        <div className={`w-full backdrop-blur-[40px] p-8 space-y-6 rounded-[3rem] border shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group transition-all ${isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/80 border-white'}`}>
          <form onSubmit={handleTeacherLogin} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`border p-4 rounded-2xl flex items-center gap-3 font-bold text-xs ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}
                >
                  <AlertCircle size={18} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div className="group relative">
                <Smartphone className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-emerald-400' : 'text-slate-400 group-focus-within:text-blue-600'}`} size={20} />
                <input
                  type="tel"
                  required
                  placeholder={lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                  className={`w-full pl-14 pr-6 py-5 border rounded-2xl outline-none font-bold text-sm transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400'}`}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
              <div className="group relative">
                <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-emerald-400' : 'text-slate-400 group-focus-within:text-blue-600'}`} size={20} />
                <input
                  type="password"
                  required
                  placeholder={t('password', lang)}
                  className={`w-full pl-14 pr-6 py-5 border rounded-2xl outline-none font-bold text-sm transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500/50 focus:bg-white focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className={`w-full py-5 font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'}`}
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : (lang === 'bn' ? 'লগইন করুন' : 'Sign In')}
            </motion.button>
          </form>

          <button 
            onClick={onBack}
            className={`w-full py-4 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <ChevronLeft size={16} />
            {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className={`text-[9px] font-black tracking-[0.4em] uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Deenora Teacher Portal
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default TeacherLogin;
