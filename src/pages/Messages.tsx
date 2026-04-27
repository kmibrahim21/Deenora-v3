import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { MessageSquare, Calendar, Send, Shield, List, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Institution, Language } from '../types';

export default function Messages({ 
  lang = 'bn',
  madrasah,
  profile
}: { 
  lang?: Language;
  madrasah: Institution | null;
  profile?: any;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedClass, setSelectedClass] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (madrasah?.id) {
      fetchData();
    }
  }, [madrasah?.id]);

  const fetchData = async () => {
    if (!madrasah?.id) return;
    setIsLoading(true);
    try {
      // fetch classes
      const { data: cls } = await supabase.from('classes').select('id, class_name').eq('institution_id', madrasah.id).order('created_at');
      if (cls) setClasses(cls);

      // fetch history
      const { data: history } = await supabase.from('messages')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });
      
      if (history) setMessages(history);

    } catch (err: any) {
      console.error(err);
      alert('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id) return;
    if (!selectedClass || !title || !message) {
      alert('সব তথ্য পূরণ করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('messages').insert({
        institution_id: madrasah.id,
        class_name: selectedClass,
        title: title,
        message: message,
        sender_name: profile?.name || 'Admin'
      });

      if (error) throw error;
      alert('বার্তা পাঠানো হয়েছে!');
      setShowModal(false);
      setTitle('');
      setMessage('');
      setSelectedClass('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('বার্তা পাঠাতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই বার্তাটি মুছে ফেলতে চান?')) return;
    try {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      alert('বার্তা মোছা হয়েছে');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('মুছতে সমস্যা হয়েছে');
    }
  };

  if (!madrasah) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-24 max-w-7xl mx-auto px-4 md:px-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-3xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <MessageSquare size={32} />
            বার্তা বা মেসেজ করুন
          </h1>
          <p className="text-blue-100 font-medium mt-2 text-sm opacity-90">শিক্ষার্থীদের ক্লাস অনুযায়ী নোটিশ বা গুরুত্বপূর্ণ বার্তা পাঠান</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-2xl font-black transition-all flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95"
        >
          <Plus size={20} />
          নতুন বার্তা
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-10">
         <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
           <List size={20} className="text-blue-500" />
           পূর্বের প্রেরিত বার্তাসমূহ
         </h2>

         {isLoading ? (
           <div className="py-20 text-center animate-pulse flex flex-col items-center justify-center">
             <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
               <MessageSquare className="text-blue-400" size={24} />
             </div>
             <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">লোড হচ্ছে...</p>
           </div>
         ) : messages.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {messages.map((msg) => (
               <div key={msg.id} className="bg-slate-50 border border-slate-100 rounded-3xl p-6 hover:shadow-lg hover:border-blue-200 transition-all group relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                 <div className="flex justify-between items-start mb-4">
                   <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                     {msg.class_name}
                   </span>
                   <button 
                     onClick={() => handleDelete(msg.id)}
                     className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                   >
                     <Trash2 size={16} />
                   </button>
                 </div>
                 <h3 className="font-bold text-slate-800 text-lg mb-2">{msg.title}</h3>
                 <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">{msg.message}</p>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-auto pt-4 border-t border-slate-100">
                   <Calendar size={14} />
                   {new Date(msg.created_at).toLocaleDateString('bn-BD', {
                     year: 'numeric', month: 'short', day: 'numeric',
                     hour: '2-digit', minute: '2-digit'
                   })}
                 </div>
               </div>
             ))}
           </div>
         ) : (
           <div className="text-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
             <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <MessageSquare size={32} className="text-blue-300" />
             </div>
             <h3 className="text-xl font-black text-slate-800 mb-2">কোনো বার্তা পাওয়া যায়নি</h3>
             <p className="text-slate-500 font-medium">উপরে "নতুন বার্তা" বাটনে ক্লিক করে প্রথম বার্তা পাঠান।</p>
           </div>
         )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">নতুন বার্তা</h3>
                  <p className="text-slate-500 text-sm mt-1">শিক্ষার্থীদের জন্য একটি নোটিশ বা বার্তা তৈরি করুন</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Send size={24} />
                </div>
              </div>

              <form onSubmit={handleSend} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">ক্লাস নির্বাচন করুন</label>
                  <select 
                    value={selectedClass} 
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
                    required
                  >
                    <option value="">ক্লাস নির্বাচন করুন...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.class_name}>{c.class_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">বার্তার শিরোনাম (Title)</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="যেমন: আগামীকালের ছুটি প্রসঙ্গে"
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">বার্তার বিষয়বস্তু (Message)</label>
                  <textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="বিস্তারিত বার্তা এখানে লিখুন..."
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700 resize-none"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-colors"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
