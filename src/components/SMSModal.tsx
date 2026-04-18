
import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Loader2, AlertCircle, CheckCircle2, ChevronDown, BookOpen, Eye, Info } from 'lucide-react';
import { t } from 'translations';
import { Language, Student, Institution, SMSTemplate } from 'types';
import { supabase, smsApi } from 'supabase';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from 'services/ShortcodeService';

interface SMSModalProps {
  students: Student[];
  madrasah: Institution;
  lang: Language;
  onClose: () => void;
  onSuccess: () => void;
}

const SMSModal: React.FC<SMSModalProps> = ({ students, madrasah, lang, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showShortcodes, setShowShortcodes] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const isDark = madrasah?.theme === 'dark';

  const availableShortcodes = [
    { code: '{student_name}', label: 'Student Name' },
    { code: '{father_name}', label: 'Father Name' },
    { code: '{class}', label: 'Class' },
    { code: '{roll}', label: 'Roll' },
    { code: '{due_amount}', label: 'Due Amount' },
    { code: '{paid_amount}', label: 'Paid Amount' },
    { code: '{result_grade}', label: 'Result Grade' },
    { code: '{exam_name}', label: 'Exam Name' },
    { code: '{attendance_percentage}', label: 'Attendance %' },
    { code: '{institution_name}', label: 'Institution Name' },
  ];

  useEffect(() => { fetchTemplates(); }, [madrasah.id]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('sms_templates').select('*').eq('institution_id', madrasah.id).order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const handlePreview = async () => {
    if (!message.trim() || students.length === 0) return;
    setPreviewing(true);
    try {
      const data = await ShortcodeService.fetchShortcodeData(madrasah.id, [students[0].id]);
      if (data && data.length > 0) {
        const text = ShortcodeService.replaceShortcodes(message, data[0]);
        setPreviewText(text);
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setPreviewing(false);
    }
  };

  const insertShortcode = (code: string) => {
    setMessage(prev => prev + code);
    setShowShortcodes(false);
  };

  const handleSend = async () => {
    if (!message.trim() || students.length === 0) return;
    setSending(true);
    try {
      await smsApi.sendBulk(madrasah.id, students, message);
      setStatus('success');
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(lang === 'bn' ? 'ব্যালেন্স নেই অথবা নেটওয়ার্ক সমস্যা' : 'Failed to send SMS');
    } finally { setSending(false); }
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[500] flex items-start justify-center p-8 pt-32 animate-in fade-in zoom-in-95">
        <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#8D30F4]/5'} rounded-[3.5rem] p-10 flex flex-col items-center text-center shadow-2xl border`}>
           <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-inner"><CheckCircle2 size={40} strokeWidth={2.5} /></div>
           <h2 className={`text-xl font-black mb-1 font-noto ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>সফল হয়েছে!</h2>
           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{students.length} SMS Sent</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[500] flex items-start justify-center p-4 pt-16 animate-in fade-in duration-300">
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#8D30F4]/5'} w-full max-w-sm rounded-[3rem] shadow-2xl p-8 border animate-in zoom-in-95 relative overflow-hidden`}>
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-slate-800 transition-all"><X size={24} /></button>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-11 h-11 bg-[#8D30F4]/5 rounded-xl flex items-center justify-center text-[#8D30F4]"><MessageSquare size={22} /></div>
          <div><h2 className={`text-xl font-black font-noto leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>এসএমএস পাঠান</h2><p className="text-[9px] font-black text-[#8D30F4]/60 uppercase tracking-widest mt-0.5">{students.length} জন ছাত্র নির্বাচিত</p></div>
        </div>
        <div className="space-y-5">
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">টেমপ্লেট বেছে নিন</label>
            <button onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl border text-sm font-bold shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-[#8D30F4]" />
                <span className="truncate">Saved Templates</span>
              </div>
              <ChevronDown size={18} className={`text-slate-300 transition-all ${showTemplateDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTemplateDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-xl border z-[510] max-h-48 overflow-y-auto p-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => { setMessage(tmp.body); setShowTemplateDropdown(false); }} className={`w-full text-left px-4 py-3 border-b last:border-0 rounded-lg transition-colors ${isDark ? 'border-slate-700/50 hover:bg-slate-700 text-slate-300' : 'border-slate-50 hover:bg-slate-50 text-slate-800'}`}>
                    <p className="text-[8px] font-black text-[#8D30F4] uppercase mb-0.5">{tmp.title}</p>
                    <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tmp.body}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">বার্তা লিখুন</label>
                <button 
                  onClick={() => setShowShortcodes(!showShortcodes)}
                  className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                >
                  <Info size={12} /> Shortcodes
                </button>
              </div>
              <span className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest">
                {(() => {
                  const info = getSmsLengthInfo(message);
                  return `${info.isBangla ? 'BN' : 'EN'} | ${info.length}/${info.maxAllowed} (${info.parts} SMS)`;
                })()}
              </span>
            </div>

            {showShortcodes && (
              <div className={`flex flex-wrap gap-1.5 p-3 rounded-xl border animate-in slide-in-from-top-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {availableShortcodes.map(sc => (
                  <button 
                    key={sc.code} 
                    onClick={() => insertShortcode(sc.code)}
                    className={`px-2 py-1 border rounded-lg text-[9px] font-bold transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-[#8D30F4] hover:text-[#8D30F4]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#8D30F4] hover:text-[#8D30F4]'}`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            )}

            <textarea 
              className={`w-full h-28 px-5 py-4 border rounded-2xl outline-none font-medium text-sm focus:border-[#8D30F4]/30 resize-none shadow-inner leading-relaxed ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`} 
              placeholder="মেসেজ লিখুন..." 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
            />
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={handlePreview}
              disabled={previewing || !message.trim()}
              className={`w-full py-3 rounded-xl font-black text-[10px] uppercase border flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              {previewing ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />} Preview SMS
            </button>

            {previewText && (
              <div className={`p-4 rounded-2xl border animate-in slide-in-from-top-2 ${isDark ? 'bg-blue-900/10 border-blue-900/20' : 'bg-blue-50/50 border-blue-100'}`}>
                <p className="text-[8px] font-black text-blue-400 uppercase mb-1.5 tracking-widest">Preview (First Student)</p>
                <p className={`text-xs font-medium leading-relaxed italic ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>"{previewText}"</p>
              </div>
            )}
          </div>

          {status === 'error' && <div className="bg-red-50 p-3 rounded-xl flex items-center gap-2 text-red-500 text-[10px] font-black border border-red-100 animate-in slide-in-from-top-2"><AlertCircle size={14} className="shrink-0" /> {errorMsg}</div>}
          <button onClick={handleSend} disabled={sending || !message.trim() || getSmsLengthInfo(message).parts > 7} className="w-full py-4 premium-btn text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest">{sending ? <Loader2 className="animate-spin" size={20} /> : 'বার্তা পাঠান'}</button>
        </div>
      </div>
    </div>
  );
};

export default SMSModal;
