
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from 'supabase';
import { Mail, Lock, Loader2, BookOpen, AlertCircle, Smartphone, Key, Moon, Star, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from 'types';
import { t } from 'translations';
import { isValidUUID } from 'utils/validation';
import { hardReload } from 'utils/reloadUtils';
import { useOfflineStatus } from '../hooks/useOffline';
import { registerNativePushToken } from '../lib/notifyParents';

interface AuthProps {
  lang: Language;
}

const Auth: React.FC<AuthProps> = ({ lang }) => {
  const isOnline = useOfflineStatus();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [regNo, setRegNo] = useState('');
  const [loginType, setLoginType] = useState<'admin' | 'teacher' | 'parent'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
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
      localStorage.removeItem('parent_session');
      const { data, error: signInError } = await (supabase.auth as any).signInWithPassword({ 
        email: email.trim(), 
        password: code 
      });
      if (signInError) throw signInError;
      if (data.user) {
        if (email.trim() === 'thedevomix@gmail.com' || email.trim() === 'kmibrahim@gmail.com' || email.trim() === 'ibrahimkhan269596@gmail.com') {
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
          else localStorage.setItem('m_name', 'সুপার অ্যাডমিন');
        } else {
          localStorage.setItem('m_name', 'সুপার অ্যাডমিন');
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
      localStorage.removeItem('parent_session');
      const response = await fetch('/api/teachers/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mobile: phone.trim(),
          password: pin.trim()
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(lang === 'bn' ? 'সার্ভারে সমস্যা হচ্ছে, অনুগ্রহ করে পরে চেষ্টা করুন।' : 'Server error, please try again later.');
      }

      if (!response.ok) {
        if (data.institution_phone) setSupportPhone(data.institution_phone);
        throw new Error(data.error || 'Failed to login');
      }

      if (data.user && data.auth) {
        // Sign in to Supabase Auth to get a real session
        const { error: signInError } = await (supabase.auth as any).signInWithPassword({
          email: data.auth.email,
          password: data.auth.password
        });
        
        if (signInError) throw signInError;

        localStorage.setItem('teacher_session', JSON.stringify(data.user));
        registerNativePushToken(undefined, phone.trim(), data.user?.institution_id, data.user?.id);
        hardReload();
      } else {
        setError(lang === 'bn' ? 'ভুল ফোন নম্বর বা পিন' : 'Invalid phone number or PIN');
      }
    } catch (err: any) {
      console.error('Teacher login error:', err);
      const msg = err.message || '';
      if (msg.includes('Invalid mobile number or password')) {
        setError(lang === 'bn' ? 'ভুল ফোন নম্বর বা পিন' : 'Invalid phone number or PIN');
      } else {
        setError(lang === 'bn' ? `লগইন করতে সমস্যা হচ্ছে: ${msg}` : `Error logging in: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleParentAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      localStorage.removeItem('teacher_session');
      
      const response = await fetch('/api/parents/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone.trim(),
          reg_no: regNo.trim()
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(lang === 'bn' ? 'সার্ভারে সমস্যা হচ্ছে, অনুগ্রহ করে পরে চেষ্টা করুন।' : 'Server error, please try again later.');
      }

      if (!response.ok) {
        if (data.institution_phone) setSupportPhone(data.institution_phone);
        throw new Error(data.error || 'Failed to login');
      }

      if (data.student) {
        localStorage.setItem('parent_session', JSON.stringify({
          student_id: data.student.id,
          guardian_phone: data.student.guardian_phone,
          registration_number: data.student.registration_number,
          institution_id: data.student.institution_id,
          role: 'parent'
        }));
        if (data.institution?.name) {
          localStorage.setItem('m_name', data.institution.name);
        }
        registerNativePushToken(data.student.id, data.student.guardian_phone, data.student.institution_id);
        hardReload();
      } else {
        setError(lang === 'bn' ? 'ভুল ফোন নম্বর অথবা রেজিস্ট্রেশন নম্বর' : 'Invalid phone number or registration number');
      }
    } catch (err: any) {
      console.error('Parent login error:', err);
      const msg = err.message || '';
      if (msg.includes('Student not found')) {
        setError(lang === 'bn' ? 'ভুল ফোন নম্বর অথবা রেজিস্ট্রেশন নম্বর' : 'Invalid phone number or registration number');
      } else if (msg.includes('প্যারেন্ট পোর্টাল বন্ধ')) {
        setError(msg);
      } else {
        setError(lang === 'bn' ? `লগইন করতে সমস্যা হচ্ছে: ${msg}` : `Error logging in: ${msg}`);
      }
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
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">সিকিউর পোর্টাল লগইন</p>
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
            <div 
              className={`absolute h-[calc(100%-8px)] w-[calc(33.33%-4px)] bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20 transition-transform duration-300 ${
                loginType === 'teacher' ? 'translate-x-full' : 
                loginType === 'parent' ? 'translate-x-[200%]' : 
                'translate-x-0'
              }`} 
            />
            <button 
              onClick={() => { setLoginType('admin'); setError(''); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'admin' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              অ্যাডমিন
            </button>
            <button 
              onClick={() => { setLoginType('teacher'); setError(''); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'teacher' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              শিক্ষক
            </button>
            <button 
              onClick={() => { setLoginType('parent'); setError(''); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'parent' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              অভিভাবক
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
                    className="space-y-3"
                  >
                    <div className={`${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} p-4 rounded-2xl flex items-start gap-3 font-semibold text-sm shadow-xl border border-white/10`}
                    >
                      <div className={`${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'bg-amber-500' : 'bg-red-500'} rounded-full p-1 mt-0.5 shrink-0`}>
                        <AlertCircle className={`w-3.5 h-3.5 ${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'text-[#0F172A]' : 'text-white'}`} />
                      </div>
                      <span className="flex-1 leading-relaxed">{error}</span>
                    </div>

                    {(error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ')) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col gap-2"
                      >
                        <a
                          href="tel:+8801629780297"
                          className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs border border-white/10 hover:bg-slate-700 transition-all shadow-lg"
                        >
                          <Smartphone size={16} className="text-blue-400" />
                          +8801629780297
                        </a>
                        <a
                          href="https://wa.me/8801629780297"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-lg shadow-green-500/20"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          হোয়াটসঅ্যাপ সাপোর্ট
                        </a>
                      </motion.div>
                    )}
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
          ) : loginType === 'teacher' ? (
            <form onSubmit={handleTeacherAuth} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className={`${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} p-4 rounded-2xl flex items-start gap-3 font-semibold text-sm shadow-xl border border-white/10`}
                    >
                      <div className={`${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'bg-amber-500' : 'bg-red-500'} rounded-full p-1 mt-0.5 shrink-0`}>
                        <AlertCircle className={`w-3.5 h-3.5 ${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'text-[#0F172A]' : 'text-white'}`} />
                      </div>
                      <span className="flex-1 leading-relaxed">{error}</span>
                    </div>

                    {(error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ')) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col gap-2"
                      >
                        <a
                          href={`tel:${(supportPhone || '8801629780297')}`}
                          className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs border border-white/10 hover:bg-slate-700 transition-all shadow-lg"
                        >
                          <Smartphone size={16} className="text-blue-400" />
                          {supportPhone || '+8801629780297'}
                        </a>
                        <a
                          href={`https://wa.me/${(supportPhone || '8801629780297').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-lg shadow-green-500/20"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          হোয়াটসঅ্যাপ সাপোর্ট
                        </a>
                      </motion.div>
                    )}
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
          ) : (
            <form onSubmit={handleParentAuth} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className={`${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} p-4 rounded-2xl flex items-start gap-3 font-semibold text-sm shadow-xl border border-white/10`}
                    >
                      <div className={`${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'bg-amber-500' : 'bg-red-500'} rounded-full p-1 mt-0.5 shrink-0`}>
                        <AlertCircle className={`w-3.5 h-3.5 ${error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ') ? 'text-[#0F172A]' : 'text-white'}`} />
                      </div>
                      <span className="flex-1 leading-relaxed">{error}</span>
                    </div>

                    {(error.includes('প্যারেন্ট পোর্টাল বন্ধ') || error.includes('অ্যাক্সেস বন্ধ')) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col gap-2"
                      >
                        <a
                          href={`tel:${(supportPhone || '8801629780297')}`}
                          className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs border border-white/10 hover:bg-slate-700 transition-all shadow-lg"
                        >
                          <Smartphone size={16} className="text-blue-400" />
                          {supportPhone || '+8801629780297'}
                        </a>
                        <a
                          href={`https://wa.me/${(supportPhone || '8801629780297').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-lg shadow-green-500/20"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          হোয়াটসঅ্যাপ সাপোর্ট
                        </a>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <div className="group relative">
                  <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="tel"
                    required
                    placeholder="অভিভাবকের ফোন নম্বর"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-600"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="group relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    placeholder="রেজিস্ট্রেশন নম্বর (Reg. No)"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-600"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
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
                {loading ? <Loader2 className="animate-spin" size={24} /> : 'অভিভাবক লগইন'}
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
