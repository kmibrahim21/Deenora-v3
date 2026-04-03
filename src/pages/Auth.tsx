
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from 'supabase';
import { Mail, Lock, Loader2, BookOpen, AlertCircle, Smartphone, Key, Moon, Star, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from 'types';
import { t } from 'translations';
import { isValidUUID } from 'utils/validation';
import { useOfflineStatus } from '../hooks/useOffline';

interface AuthProps {
  lang: Language;
}

const Auth: React.FC<AuthProps> = ({ lang }) => {
  const isOnline = useOfflineStatus();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loginType, setLoginType] = useState<'admin' | 'teacher'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brandInfo, setBrandInfo] = useState({ name: 'দ্বীনোরা' });

  useEffect(() => {
    const name = localStorage.getItem('m_name');
    if (name) setBrandInfo({ name });
  }, []);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      localStorage.removeItem('teacher_session');
      const { data, error: signInError } = await (supabase.auth as any).signInWithPassword({ 
        email: email.trim(), 
        password: code 
      });
      if (signInError) throw signInError;
      if (data.user) {
        if (email.trim() === 'thedevomix@gmail.com' || email.trim() === 'kmibrahim@gmail.com') {
          try {
            await supabase.rpc('bootstrap_super_admin', {
              p_uid: data.user.id,
              p_email: data.user.email
            });
          } catch (bootstrapErr) {
            console.error('Bootstrap error:', bootstrapErr);
          }
        }

        offlineApi.removeCache('profile');
        if (isValidUUID(data.user.id)) {
          const { data: profile } = await supabase.from('institutions').select('name').eq('id', data.user.id).maybeSingle();
          if (profile) localStorage.setItem('m_name', profile.name);
          else localStorage.setItem('m_name', 'Super Admin');
        } else {
          localStorage.setItem('m_name', 'Super Admin');
        }
      }
    } catch (err: any) { 
      setError(t('login_error', lang)); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Call RPC to verify credentials and ensure Supabase user exists
      const { data: rpcData, error: rpcError } = await supabase.rpc('check_teacher_login', {
        p_phone: phone.trim(),
        p_pin: pin.trim()
      });

      if (rpcError) {
        // Fallback to direct table query if RPC doesn't exist yet (before user runs SQL)
        const { data, error: fetchError } = await supabase
          .from('teachers')
          .select('*')
          .eq('phone', phone.trim())
          .eq('pin', pin.trim())
          .eq('is_active', true)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (data) {
          localStorage.setItem('teacher_session', JSON.stringify(data));
          window.location.reload();
        } else {
          setError(lang === 'bn' ? 'ভুল ফোন নম্বর বা পিন' : 'Invalid phone number or PIN');
        }
        return;
      }
      
      if (rpcData && rpcData.length > 0) {
        const teacherData = rpcData[0];
        
        // 2. Sign in with Supabase Auth
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: teacherData.supabase_email,
          password: pin.trim()
        });
        
        if (signInError) throw signInError;
        
        // 3. Store teacher session data
        localStorage.setItem('teacher_session', JSON.stringify(teacherData));
        window.location.reload();
      } else {
        setError(lang === 'bn' ? 'ভুল ফোন নম্বর বা পিন' : 'Invalid phone number or PIN');
      }
    } catch (err: any) {
      console.error('Teacher login error:', err);
      setError(lang === 'bn' ? 'লগইন করতে সমস্যা হচ্ছে' : 'Error logging in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+24px)] relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-20 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"
        />
        
        {/* Islamic Decorative Icons */}
        <motion.div 
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[15%] text-blue-400/20"
        >
          <Moon size={120} strokeWidth={1} />
        </motion.div>
        
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.1, scale: 0.5 }}
            animate={{ 
              opacity: [0.1, 0.4, 0.1], 
              scale: [0.5, 1, 0.5],
              y: [0, Math.random() * -30, 0]
            }}
            transition={{ 
              duration: 3 + Math.random() * 4, 
              repeat: Infinity, 
              delay: Math.random() * 5 
            }}
            className="absolute text-yellow-500/20"
            style={{ 
              top: `${Math.random() * 100}%`, 
              left: `${Math.random() * 100}%` 
            }}
          >
            <Star size={12 + Math.random() * 12} fill="currentColor" />
          </motion.div>
        ))}
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
            <div className="w-24 h-24 bg-white/5 backdrop-blur-xl rounded-[2.5rem] mx-auto flex items-center justify-center border border-white/20 shadow-2xl relative group">
              <div className="absolute inset-0 bg-blue-500/20 rounded-[2.5rem] blur-xl group-hover:bg-blue-500/30 transition-colors" />
              <BookOpen size={48} strokeWidth={1.5} className="text-blue-400 relative z-10" />
            </div>
          </motion.div>
          
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-white font-noto tracking-tight">
              {brandInfo.name}
            </h1>
            <div className="flex items-center justify-center gap-2 text-blue-400/60">
              <Sparkles size={14} />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Secure Portal Login</p>
              <Sparkles size={14} />
            </div>
          </div>
        </div>

        <div className="w-full bg-slate-900/40 backdrop-blur-[40px] p-8 space-y-6 rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Animated Light Beam */}
          <motion.div
            animate={{
              x: ['-150%', '150%'],
              y: ['-150%', '150%'],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-blue-400/5 to-transparent pointer-events-none"
          />
          
          {/* Subtle inner glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 relative mb-6">
            <div className={`absolute h-[calc(100%-8px)] w-[calc(50%-4px)] bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20 transition-transform duration-300 ${loginType === 'teacher' ? 'translate-x-full' : 'translate-x-0'}`} />
            <button 
              onClick={() => { setLoginType('admin'); setError(''); }}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'admin' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Admin Login
            </button>
            <button 
              onClick={() => { setLoginType('teacher'); setError(''); }}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'teacher' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Teacher Login
            </button>
          </div>

          {loginType === 'admin' ? (
            <form onSubmit={handleAdminAuth} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 font-bold text-xs"
                  >
                    <AlertCircle size={18} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <div className="group relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="email"
                    required
                    placeholder="ইমেইল এড্রেস"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="group relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="password"
                    required
                    placeholder="পাসওয়ার্ড"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-600"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : 'লগইন করুন'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleTeacherAuth} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 font-bold text-xs"
                  >
                    <AlertCircle size={18} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <div className="group relative">
                  <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="tel"
                    required
                    placeholder="ফোন নম্বর (01...)"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-600"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="group relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="password"
                    required
                    placeholder="লগইন পিন"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-600"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : 'শিক্ষক লগইন'}
              </motion.button>
            </form>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-slate-500 text-[9px] font-black tracking-[0.4em] uppercase">
            Deenora Management System
          </p>
          <div className="flex items-center gap-4 text-slate-600">
            <Star size={10} fill="currentColor" />
            <Moon size={10} fill="currentColor" />
            <Star size={10} fill="currentColor" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
