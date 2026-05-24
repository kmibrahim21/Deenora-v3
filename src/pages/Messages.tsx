import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { sortMadrasahClasses } from './Classes';
import { MessageSquare, Calendar, Send, List, Trash2, CalendarDays, BookOpen, Clock, FileText, Plus, Bell, Users, CheckCircle2, Circle } from 'lucide-react';
import { Institution, Language } from '../types';
import { OfflineService } from '../services/OfflineService';

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
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'messages' | 'notices' | 'routine' | 'syllabus'>('messages');

  // Modals
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states - Message
  const [selectedClass, setSelectedClass] = useState('');
  const [title, setTitle] = useState('');
  const [msgDate, setMsgDate] = useState(new Date().toISOString().split('T')[0]);
  const [msgActivities, setMsgActivities] = useState('');
  const [msgHomework, setMsgHomework] = useState('');
  const [msgNote, setMsgNote] = useState('');

  // Form states - Notice
  const [noticeType, setNoticeType] = useState('APP_NOTICE');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDate, setNoticeDate] = useState(new Date().toISOString().split('T')[0]);
  const [noticeDesc, setNoticeDesc] = useState('');
  const [noticeClass, setNoticeClass] = useState('All Classes');
  const [sendTo, setSendTo] = useState('All Parents');

  // Form states - Routine
  const [routineClass, setRoutineClass] = useState('');
  const [routineEffectiveDate, setRoutineEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [routineNote, setRoutineNote] = useState('');
  const [routineRows, setRoutineRows] = useState([
    { id: '1', time: '8:00 - 9:00', Sunday: 'Hifz', Monday: 'Quran', Tuesday: 'Hifz', Wednesday: 'Arabic', Thursday: 'Hifz' },
    { id: '2', time: '9:00 - 10:00', Sunday: 'Tajweed', Monday: 'Arabic', Tuesday: 'Tajweed', Wednesday: 'Quran', Thursday: 'Arabic' },
    { id: '3', time: '10:00 - 10:15', isBreak: true, label: 'Break' },
    { id: '4', time: '10:15 - 11:15', Sunday: 'Islam', Monday: 'Hadith', Tuesday: 'Islam', Wednesday: 'Akhlaq', Thursday: 'Hadith' },
    { id: '5', time: '11:15 - 12:15', Sunday: 'Bangla', Monday: 'English', Tuesday: 'Math', Wednesday: 'Bangla', Thursday: 'English' },
  ]);

  // Form states - Syllabus
  const [syllabusClass, setSyllabusClass] = useState('');
  const [syllabusSession, setSyllabusSession] = useState('2025-26');
  const [syllabusSubjectList, setSyllabusSubjectList] = useState([
    { subject: 'Quran', details: 'সূরা ইয়াসিন, সূরা রহমান' },
    { subject: 'Arabic', details: 'নাহু - পরিচিতি' },
    { subject: 'Tajweed', details: 'মাখারিজ, ওয়াকফ' },
  ]);

  useEffect(() => {
    if (madrasah?.id) {
      fetchData();
    }
  }, [madrasah?.id]);

  const fetchData = async () => {
    if (!madrasah?.id) return;
    setIsLoading(true);
    try {
      const cacheKey = `messages_cache_${madrasah.id}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
          try { setMessages(JSON.parse(cached)); setIsLoading(false); } catch(e) {}
      }

      const { data: cls } = await supabase.from('classes').select('id, class_name, sort_order').eq('institution_id', madrasah.id);
      if (cls) setClasses(sortMadrasahClasses(cls));

      const { data: history } = await supabase.from('messages')
        .select('id, class_name, title, message, created_at, sender_name, type')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (history) {
          setMessages(history);
          sessionStorage.setItem(cacheKey, JSON.stringify(history));
      }

    } catch (err: any) {
      console.error(err);
      alert('তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এটি মুছে ফেলতে চান?')) return;
    try {
      await OfflineService.safeDelete('messages', id);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('মুছতে সমস্যা হয়েছে');
    }
  };

  const handleStatusToggle = async (msg: any) => {
    if(!msg.parsedMessage) return;
    try {
      const newStatus = msg.parsedMessage.status === 'completed' ? 'pending' : 'completed';
      const newPayload = { ...msg.parsedMessage, status: newStatus };
      await OfflineService.safeUpdate('messages', msg.id, {
        message: JSON.stringify(newPayload)
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const submitMessage = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!selectedClass || !title || !msgActivities) return alert('অনুগ্রহ করে আবশ্যক তথ্যগুলো দিন।');
    setIsSubmitting(true);
    try {
      const payload = {
        date: msgDate,
        activities: msgActivities,
        homework: msgHomework,
        note: msgNote,
        status: isDraft ? 'draft' : 'published'
      };
      await OfflineService.safeInsert('messages', {
        institution_id: madrasah?.id,
        class_name: selectedClass,
        title,
        message: JSON.stringify(payload),
        sender_name: profile?.name || 'Admin'
      });
      setShowMsgModal(false);
      setTitle(''); setMsgActivities(''); setMsgHomework(''); setMsgNote(''); setSelectedClass('');
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  const submitNotice = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!noticeTitle) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      await OfflineService.safeInsert('messages', {
        institution_id: madrasah?.id,
        class_name: noticeType,
        title: noticeTitle,
        message: JSON.stringify({ date: noticeDate, desc: noticeDesc, classGroup: noticeClass, sendTo, status: isDraft ? 'draft' : 'published' }),
        sender_name: profile?.name || 'Admin'
      });
      setShowNoticeModal(false);
      setNoticeTitle(''); setNoticeDate(''); setNoticeDesc('');
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  const submitRoutine = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!routineClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      await OfflineService.safeInsert('messages', {
        institution_id: madrasah?.id,
        class_name: `APP_ROUTINE_${routineClass}`,
        title: "Class Routine",
        message: JSON.stringify({
          effectiveDate: routineEffectiveDate,
          note: routineNote,
          rows: routineRows,
          status: isDraft ? 'draft' : 'published'
        }),
        sender_name: profile?.name || 'Admin'
      });
      setShowRoutineModal(false);
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  const submitSyllabus = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!syllabusClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      await OfflineService.safeInsert('messages', {
        institution_id: madrasah?.id,
        class_name: `APP_SYLLABUS_${syllabusClass}`,
        title: `Syllabus ${syllabusSession}`,
        message: JSON.stringify({ subjects: syllabusSubjectList, session: syllabusSession, status: isDraft ? 'draft' : 'published' }),
        sender_name: profile?.name || 'Admin'
      });
      setShowSyllabusModal(false);
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  const parsedMessages = messages.map(msg => {
    let parsedMessage = {};
    try {
      if (typeof msg.message === 'string' && (msg.message.startsWith('{') || msg.message.startsWith('['))) {
         parsedMessage = JSON.parse(msg.message);
      } else {
         parsedMessage = { activities: msg.message }; // fallback for older messages
      }
    } catch {
       parsedMessage = { activities: msg.message };
    }
    return { ...msg, parsedMessage };
  });

  const studentMsgs = parsedMessages.filter(m => !m.class_name?.startsWith('APP_'));
  const noticeList = parsedMessages.filter(m => m.class_name === 'APP_NOTICE' || m.class_name === 'APP_HOLIDAY' || m.class_name === 'APP_PTM');
  const routineList = parsedMessages.filter(m => m.class_name?.startsWith('APP_ROUTINE_'));
  const syllabusList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SYLLABUS_'));

  if (!madrasah) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500 pb-24 max-w-7xl mx-auto px-4 md:px-8 pt-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-2xl text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <MessageSquare size={26} />
            বার্তা ও তথ্য
          </h1>
          <p className="text-blue-100 font-medium mt-1 text-sm opacity-90">নোটিশ, ক্লাস রুটিন, সিলেবাস এবং অন্যান্য আপডেট</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap bg-white border border-slate-200 p-2 rounded-2xl gap-2 shadow-sm">
        <button onClick={() => setActiveTab('messages')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'messages' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>
          <BookOpen size={18} /><span>ডায়েরি</span>
        </button>
        <button onClick={() => setActiveTab('notices')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'notices' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Bell size={18} /><span>নোটিশ ও ইভেন্ট</span>
        </button>
        <button onClick={() => setActiveTab('routine')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'routine' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}>
           <Clock size={18} /><span>ক্লাস রুটিন</span>
        </button>
        <button onClick={() => setActiveTab('syllabus')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'syllabus' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'text-slate-500 hover:bg-slate-50'}`}>
           <BookOpen size={18} /><span>সিলেবাস</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-8 min-h-[400px]">
         
         {isLoading ? (
            <div className="py-20 text-center animate-pulse flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
                <MessageSquare className="text-blue-400" size={24} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">লোড হচ্ছে...</p>
            </div>
         ) : (
           <>
              {/* === TAB 1: MESSAGES === */}
              {activeTab === 'messages' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                       <BookOpen size={20} className="text-blue-500" />
                       দৈনন্দিন ডায়েরি লগ
                    </h2>
                    <button onClick={() => setShowMsgModal(true)} className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
                       <Plus size={16} /> নতুন ডায়েরি
                    </button>
                  </div>
                  {studentMsgs.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                      {studentMsgs.map((msg) => (
                        <div key={msg.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all group relative">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                               <h3 className="font-black text-slate-800 text-xl">{msg.title}</h3>
                               <div className="flex gap-3 items-center mt-2">
                                  <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                                    {msg.class_name}
                                  </span>
                                  <span className="text-[12px] font-bold text-slate-400 flex items-center gap-1">
                                    <CalendarDays size={14} />
                                    {new Date(msg.parsedMessage?.date || msg.created_at).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric'})}
                                  </span>
                                  {msg.parsedMessage?.status === 'draft' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Draft</span>}
                               </div>
                            </div>
                            <button onClick={() => handleDelete(msg.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-red-50 rounded-full">
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="space-y-4">
                            {msg.parsedMessage?.activities && (
                               <div>
                                 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">আজকের ক্লাসের কাজ</h4>
                                 <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{msg.parsedMessage.activities}</p>
                               </div>
                            )}
                            {msg.parsedMessage?.homework && (
                               <div>
                                 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">বাড়ির কাজ (Homework)</h4>
                                 <p className="text-slate-700 text-sm whitespace-pre-wrap bg-blue-50/50 p-3 rounded-xl border border-blue-100">{msg.parsedMessage.homework}</p>
                               </div>
                            )}
                            {msg.parsedMessage?.note && (
                               <div>
                                 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">শিক্ষকের মন্তব্য</h4>
                                 <p className="text-slate-600 text-sm italic border-l-2 border-slate-300 pl-3 py-1">{msg.parsedMessage.note}</p>
                               </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">কোনো ডায়েরি নেই</div>
                  )}
                </div>
              )}

              {/* === TAB 2: NOTICES === */}
              {activeTab === 'notices' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                       <Bell size={20} className="text-amber-500" />
                       নোটিশ বোর্ড ও ইভেন্ট
                    </h2>
                    <button onClick={() => setShowNoticeModal(true)} className="bg-amber-500 text-white hover:bg-amber-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
                       <Plus size={16} /> নতুন নোটিশ
                    </button>
                  </div>
                  {noticeList.length > 0 ? (
                    <div className="space-y-4">
                      {noticeList.map((msg) => (
                        <div key={msg.id} className="flex gap-4 p-4 border border-slate-200 rounded-2xl hover:border-amber-200 hover:shadow-md transition-all bg-white group">
                          <div className="w-16 h-16 rounded-xl shrink-0 flex flex-col items-center justify-center 
                             ${msg.class_name === 'APP_HOLIDAY' ? 'bg-emerald-50 text-emerald-600' : msg.class_name === 'APP_PTM' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}">
                             <span className="text-xs font-bold uppercase">{new Date(msg.parsedMessage?.date).toLocaleString('default', { month: 'short' })}</span>
                             <span className="text-xl font-black">{new Date(msg.parsedMessage?.date).getDate() || '-'}</span>
                          </div>
                          <div className="flex-1">
                             <div className="flex justify-between items-start">
                               <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider uppercase
                                     ${msg.class_name === 'APP_HOLIDAY' ? 'bg-emerald-100 text-emerald-700' : msg.class_name === 'APP_PTM' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                                     {msg.class_name === 'APP_HOLIDAY' ? 'ছুটি' : msg.class_name === 'APP_PTM' ? 'পিতামাতা-শিক্ষক মিটিং' : 'নোটিশ'}
                                  </span>
                               </div>
                               <button onClick={() => handleDelete(msg.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                 <Trash2 size={16} />
                               </button>
                             </div>
                             <h3 className="font-bold text-slate-800 text-base">{msg.title}</h3>
                             <p className="text-slate-600 text-sm mt-1">{msg.parsedMessage?.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">কোনো নোটিশ বা ইভেন্ট নেই</div>
                  )}
                </div>
              )}

              {/* === TAB 3: ROUTINE === */}
              {activeTab === 'routine' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                       <Clock size={20} className="text-emerald-500" />
                       ক্লাস রুটিন
                    </h2>
                    <button onClick={() => setShowRoutineModal(true)} className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
                       <Plus size={16} /> রুটিন যোগ করুন
                    </button>
                  </div>
                  {routineList.length > 0 ? (
                    <div className="space-y-8">
                       {routineList.map(r => {
                         const rows = r.parsedMessage?.rows || [];
                         return (
                           <div key={r.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm group">
                             <div className="bg-emerald-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                               <div>
                                 <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                   {r.class_name.replace('APP_ROUTINE_', '')}
                                 </h3>
                                 <p className="text-sm text-slate-500 font-bold mt-1">Effective: {new Date(r.parsedMessage?.effectiveDate || r.created_at).toLocaleDateString()}</p>
                               </div>
                               <div className="flex items-center gap-3">
                                 {r.parsedMessage?.status === 'draft' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Draft</span>}
                                 <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Trash2 size={16} />
                                 </button>
                               </div>
                             </div>
                             
                             <div className="overflow-x-auto">
                               <table className="w-full text-center text-sm min-w-[600px]">
                                 <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                   <tr>
                                     <th className="py-3 px-2 border-r border-slate-200">Time</th>
                                     <th className="py-3 px-2 border-r border-slate-200">Sunday</th>
                                     <th className="py-3 px-2 border-r border-slate-200">Monday</th>
                                     <th className="py-3 px-2 border-r border-slate-200">Tuesday</th>
                                     <th className="py-3 px-2 border-r border-slate-200">Wednesday</th>
                                     <th className="py-3 px-2 border-r border-slate-200">Thursday</th>
                                   </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                   {rows.map((row: any) => row.isBreak ? (
                                      <tr key={row.id} className="bg-slate-50">
                                        <td colSpan={6} className="py-4 px-2 font-bold text-slate-500 text-center">{row.label || 'Break'} ({row.time})</td>
                                      </tr>
                                   ) : (
                                      <tr key={row.id}>
                                        <td className="py-4 px-2 border-r border-slate-100 font-bold text-slate-800">{row.time}</td>
                                        <td className="py-4 px-2 border-r border-slate-100">{row.Sunday}</td>
                                        <td className="py-4 px-2 border-r border-slate-100">{row.Monday}</td>
                                        <td className="py-4 px-2 border-r border-slate-100">{row.Tuesday}</td>
                                        <td className="py-4 px-2 border-r border-slate-100">{row.Wednesday}</td>
                                        <td className="py-4 px-2 border-r border-slate-100">{row.Thursday}</td>
                                      </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                             {r.parsedMessage?.note && (
                               <div className="p-4 bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
                                  <strong>Note:</strong> {r.parsedMessage.note}
                               </div>
                             )}
                           </div>
                         );
                       })}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">কোনো রুটিন যোগ করা হয়নি</div>
                  )}
                </div>
              )}

              {/* === TAB 4: SYLLABUS === */}
              {activeTab === 'syllabus' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                       <BookOpen size={20} className="text-purple-500" />
                       সিলেবাস ট্র্যাকিং
                    </h2>
                    <button onClick={() => setShowSyllabusModal(true)} className="bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md">
                       <Plus size={16} /> টপিক যোগ করুন
                    </button>
                  </div>
                  {syllabusList.length > 0 ? (
                    <div className="space-y-6">
                      {classes.map(cls => {
                         const clsSyllabus = syllabusList.filter(m => m.class_name === `APP_SYLLABUS_${cls.class_name}`);
                         if(clsSyllabus.length === 0) return null;
                         return (
                           <div key={cls.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                             <div className="bg-purple-50/50 px-4 py-3 border-b border-slate-200 font-black text-purple-900 flex items-center gap-2">
                               {cls.class_name}
                             </div>
                             <div className="divide-y divide-slate-100">
                               {clsSyllabus.map(s => {
                                 const subjects = s.parsedMessage?.subjects || [];
                                 return (
                                   <div key={s.id} className="p-4 group hover:bg-slate-50 transition-colors">
                                     <div className="flex justify-between items-start mb-4">
                                       <div>
                                         <h4 className="font-bold text-slate-800 text-lg">{s.title}</h4>
                                         <p className="text-sm text-slate-500 font-medium">Session: {s.parsedMessage?.session}</p>
                                       </div>
                                       <div className="flex items-center gap-3">
                                         {s.parsedMessage?.status === 'draft' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Draft</span>}
                                         <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                           <Trash2 size={16} />
                                         </button>
                                       </div>
                                     </div>
                                     <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                       <table className="w-full text-left text-sm">
                                         <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                              <th className="py-2 px-4 w-1/3">Subject</th>
                                              <th className="py-2 px-4">Details</th>
                                            </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-100">
                                            {subjects.map((sub: any, idx: number) => (
                                              <tr key={idx}>
                                                <td className="py-2 px-4 font-bold text-slate-700">{sub.subject}</td>
                                                <td className="py-2 px-4 text-slate-600">{sub.details}</td>
                                              </tr>
                                            ))}
                                         </tbody>
                                       </table>
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">সিলেবাসে কোনো টপিক নেই</div>
                  )}
                </div>
              )}
           </>
         )}
      </div>

      {/* --- MODALS --- */}
      {/* 1. Message Modal */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 py-10 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
              
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <BookOpen size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Daily Diary</h3>
                        <p className="text-slate-500 text-sm font-medium">Share today's class activities and notes</p>
                     </div>
                  </div>
                  <button onClick={() => setShowMsgModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                     ← Back
                  </button>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Class <span className="text-red-500">*</span></label>
                      <select required value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700">
                          <option value="">Select Class...</option>
                          {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Date <span className="text-red-500">*</span></label>
                      <input required type="date" value={msgDate} onChange={e=>setMsgDate(e.target.value)} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                    <input required type="text" placeholder="e.g. 05 May 2026, Monday" value={title} onChange={e=>setTitle(e.target.value)} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Today's Class Activities <span className="text-red-500">*</span></label>
                    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1">
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif font-bold">B</button>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif italic">I</button>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif underline">U</button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg"><List size={16} /></button>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg"><List size={16} /></button>
                      </div>
                      <textarea required value={msgActivities} onChange={e=>setMsgActivities(e.target.value)} placeholder="- সূরা ইয়াসিন (১-২০) শিখনো হয়েছে..." className="w-full h-32 p-4 outline-none resize-none text-slate-700 leading-relaxed font-medium" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Homework</label>
                    <textarea value={msgHomework} onChange={e=>setMsgHomework(e.target.value)} placeholder="সূরা ইয়াসিন (১-২০) মুখস্থ করতে হবে..." className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700 resize-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Teacher's Note <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <textarea value={msgNote} onChange={e=>setMsgNote(e.target.value)} placeholder="আপনাদের সন্তান..." className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700 resize-none" />
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setShowMsgModal(false)} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all">Cancel</button>
                    <div className="flex gap-3">
                      <button type="button" onClick={(e) => submitMessage(e, true)} disabled={isSubmitting} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm">Save as Draft</button>
                      <button type="button" onClick={(e) => submitMessage(e, false)} disabled={isSubmitting} className="px-8 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 transition-all shadow-md">Publish</button>
                    </div>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 2. Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 py-10 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                        <Bell size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Notice</h3>
                        <p className="text-slate-500 text-sm font-medium">Send important notices to parents</p>
                     </div>
                  </div>
                  <button onClick={() => setShowNoticeModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                     ← Back
                  </button>
                </div>

                <form className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                    <input required type="text" value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} placeholder="আগামী শুক্রবার মাদ্রাসা বন্ধ থাকবে" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-red-500 focus:bg-white transition-all font-bold text-slate-700" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Class / Group <span className="text-red-500">*</span></label>
                      <select required value={noticeClass} onChange={e=>setNoticeClass(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-red-500 transition-all font-bold text-slate-700">
                          <option value="All Classes">All Classes</option>
                          {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Notice Type <span className="text-red-500">*</span></label>
                      <select required value={noticeType} onChange={e=>setNoticeType(e.target.value)} className="w-full h-12 bg-white border border-slate-200 text-red-500 rounded-xl px-4 outline-none focus:border-red-500 transition-all font-bold">
                          <option value="APP_NOTICE">Important</option>
                          <option value="APP_HOLIDAY">Holiday</option>
                          <option value="APP_PTM">Meeting</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Date <span className="text-red-500">*</span></label>
                    <input required type="date" value={noticeDate} onChange={e=>setNoticeDate(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-red-500 transition-all font-bold text-slate-700" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Message / Details <span className="text-red-500">*</span></label>
                    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 transition-all">
                      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1">
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif font-bold">B</button>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif italic">I</button>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif underline">U</button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg"><List size={16} /></button>
                        <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg"><List size={16} /></button>
                      </div>
                      <textarea required value={noticeDesc} onChange={e=>setNoticeDesc(e.target.value)} placeholder="বিস্তারিত লিখুন..." className="w-full h-40 p-4 outline-none resize-none text-slate-700 leading-relaxed font-medium" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-3">Send To <span className="text-red-500">*</span></label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="sendTo" checked={sendTo === 'All Parents'} onChange={() => setSendTo('All Parents')} className="w-4 h-4 accent-red-600 focus:ring-red-500" />
                        <span className="text-sm font-bold text-slate-700">All Parents</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="sendTo" checked={sendTo === 'Select Class'} onChange={() => setSendTo('Select Class')} className="w-4 h-4 accent-red-600 focus:ring-red-500" />
                        <span className="text-sm font-bold text-slate-700">Select Class</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="sendTo" checked={sendTo === 'Select Group'} onChange={() => setSendTo('Select Group')} className="w-4 h-4 accent-red-600 focus:ring-red-500" />
                        <span className="text-sm font-bold text-slate-700">Select Group</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setShowNoticeModal(false)} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all">Cancel</button>
                    <div className="flex gap-3">
                      <button type="button" onClick={(e) => submitNotice(e, true)} disabled={isSubmitting} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm">Save as Draft</button>
                      <button type="button" onClick={(e) => submitNotice(e, false)} disabled={isSubmitting} className="px-8 h-12 bg-[#ef4444] hover:bg-red-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all shadow-md">Publish</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Routine Modal */}
      {showRoutineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 py-10 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                        <CalendarDays size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Class Routine</h3>
                        <p className="text-slate-500 text-sm font-medium">Create and manage class routines</p>
                     </div>
                  </div>
                  <button onClick={() => setShowRoutineModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                     ← Back
                  </button>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Class <span className="text-red-500">*</span></label>
                      <select required value={routineClass} onChange={e=>setRoutineClass(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-green-500 transition-all font-bold text-slate-700">
                          <option value="">Select Class</option>
                          {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Effective From <span className="text-red-500">*</span></label>
                      <input required type="date" value={routineEffectiveDate} onChange={e=>setRoutineEffectiveDate(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-green-500 transition-all font-bold text-slate-700" />
                    </div>
                  </div>

                  {/* Matrix approach */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                     <table className="w-full text-center text-sm">
                        <thead className="bg-green-50 text-green-800 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-2 border-r border-slate-200">Time</th>
                            <th className="py-3 px-2 border-r border-slate-200">Sunday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Monday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Tuesday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Wednesday</th>
                            <th className="py-3 px-2 border-r border-slate-200">Thursday</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                          {routineRows.map((row, idx) => {
                             if (row.isBreak) {
                               return (
                                 <tr key={row.id} className="bg-slate-50 group">
                                   <td colSpan={6} className="py-2 px-2 font-bold text-slate-500 text-center relative">
                                      <input type="text" value={row.label || 'Break'} onChange={(e) => {
                                        const newRows = [...routineRows];
                                        newRows[idx].label = e.target.value;
                                        setRoutineRows(newRows);
                                      }} className="bg-transparent text-center outline-none border-b border-dashed border-slate-300 focus:border-green-500" />
                                      {' ('}
                                      <input type="text" value={row.time} onChange={(e) => {
                                        const newRows = [...routineRows];
                                        newRows[idx].time = e.target.value;
                                        setRoutineRows(newRows);
                                      }} className="bg-transparent text-center outline-none w-24 border-b border-dashed border-slate-300 focus:border-green-500" />
                                      {')'}
                                      <button type="button" onClick={() => {
                                         if(routineRows.length > 1) {
                                            const newRows = [...routineRows];
                                            newRows.splice(idx, 1);
                                            setRoutineRows(newRows);
                                         }
                                      }} className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16} />
                                      </button>
                                   </td>
                                 </tr>
                               )
                             }
                             return (
                               <tr key={row.id} className="group relative">
                                 <td className="py-2 px-2 border-r border-slate-200 font-bold text-slate-800">
                                   <div className="flex items-center gap-1">
                                      <input type="text" value={row.time} onChange={(e) => {
                                           const newRows = [...routineRows];
                                           newRows[idx].time = e.target.value;
                                           setRoutineRows(newRows);
                                         }} className="w-full text-center bg-transparent outline-none focus:bg-white focus:ring-2 ring-green-100 rounded py-1" />
                                      <button type="button" onClick={() => {
                                         if(routineRows.length > 1) {
                                            const newRows = [...routineRows];
                                            newRows.splice(idx, 1);
                                            setRoutineRows(newRows);
                                         }
                                      }} className="absolute -left-6 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 p-1 bg-red-50 rounded-full">
                                        <Trash2 size={14} />
                                      </button>
                                   </div>
                                 </td>
                                 {(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const).map(day => (
                                   <td key={day} className="py-2 px-2 border-r border-slate-200">
                                     <input type="text" value={row[day as keyof typeof row] as string || ''} onChange={(e) => {
                                        const newRows = [...routineRows];
                                        newRows[idx] = { ...newRows[idx], [day]: e.target.value };
                                        setRoutineRows(newRows);
                                      }} className="w-full text-center bg-transparent outline-none focus:bg-white focus:ring-2 ring-green-100 rounded py-1 placeholder-slate-300" placeholder="-" />
                                   </td>
                                 ))}
                               </tr>
                             );
                          })}
                        </tbody>
                     </table>
                     <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-4">
                        <button type="button" onClick={() => setRoutineRows([...routineRows, { id: Math.random().toString(), time: 'Time', Sunday: '', Monday: '', Tuesday: '', Wednesday: '', Thursday: '' }])} className="text-sm font-bold text-green-600 flex items-center gap-1 hover:text-green-700 bg-white px-3 py-1.5 rounded-lg border border-green-200 shadow-sm">
                           <Plus size={16} /> Add Normal Period
                        </button>
                        <button type="button" onClick={() => setRoutineRows([...routineRows, { id: Math.random().toString(), isBreak: true, time: '10:00 - 10:15', label: 'Break' }])} className="text-sm font-bold text-slate-500 flex items-center gap-1 hover:text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                           <Plus size={16} /> Add Break
                        </button>
                     </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Note <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <textarea value={routineNote} onChange={e=>setRoutineNote(e.target.value)} placeholder="রুটিন পরিবর্তন হলে..." className="w-full h-20 bg-white border border-slate-200 rounded-xl p-4 outline-none focus:border-green-500 transition-all font-medium text-slate-700 resize-none" />
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setShowRoutineModal(false)} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all">Cancel</button>
                    <div className="flex gap-3">
                      <button type="button" onClick={(e) => submitRoutine(e, true)} disabled={isSubmitting} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm">Save as Draft</button>
                      <button type="button" onClick={(e) => submitRoutine(e, false)} disabled={isSubmitting} className="px-8 h-12 bg-[#16a34a] hover:bg-green-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all shadow-md">Publish</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Syllabus Modal */}
      {showSyllabusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 py-10 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                        <BookOpen size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Syllabus</h3>
                        <p className="text-slate-500 text-sm font-medium">Add or update syllabus for classes</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSyllabusModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                     ← Back
                  </button>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Class <span className="text-red-500">*</span></label>
                      <select required value={syllabusClass} onChange={e=>setSyllabusClass(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all font-bold text-slate-700">
                          <option value="">Select Class</option>
                          {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Session <span className="text-red-500">*</span></label>
                      <select required value={syllabusSession} onChange={e=>setSyllabusSession(e.target.value)} className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 outline-none focus:border-orange-500 transition-all font-bold text-slate-700">
                          <option value="2025-26">2025-26</option>
                          <option value="2026-27">2026-27</option>
                      </select>
                    </div>
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-3">Subject List</label>
                     <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
                       <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                           <tr>
                             <th className="py-3 px-4 w-1/4">Subject</th>
                             <th className="py-3 px-4">Details</th>
                             <th className="py-3 px-4 w-20 text-center">Action</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                           {syllabusSubjectList.map((item, idx) => (
                             <tr key={idx}>
                               <td className="py-3 px-4">
                                 <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center 
                                     ${item.subject === 'Quran' ? 'bg-orange-100 text-orange-600' : 
                                       item.subject === 'Arabic' ? 'bg-red-100 text-red-600' : 
                                       item.subject === 'Tajweed' ? 'bg-green-100 text-green-600' :
                                       item.subject === 'Islam' ? 'bg-yellow-100 text-yellow-600' :
                                       'bg-purple-100 text-purple-600'}`}>
                                      <BookOpen size={14} />
                                   </div>
                                   <input type="text" value={item.subject} onChange={(e) => {
                                     const arr = [...syllabusSubjectList];
                                     arr[idx].subject = e.target.value;
                                     setSyllabusSubjectList(arr);
                                   }} className="w-full bg-transparent outline-none font-bold placeholder-slate-400 text-slate-700" placeholder="Subject Name"/>
                                 </div>
                               </td>
                               <td className="py-3 px-4">
                                 <input type="text" value={item.details} onChange={(e) => {
                                     const arr = [...syllabusSubjectList];
                                     arr[idx].details = e.target.value;
                                     setSyllabusSubjectList(arr);
                                   }} className="w-full bg-transparent outline-none placeholder-slate-400" placeholder="Enter syllabus details... (e.g. সূরা ইয়াসিন, সূরা রহমান)"/>
                               </td>
                               <td className="py-3 px-4 text-center">
                                 <button type="button" onClick={() => {
                                   if(syllabusSubjectList.length > 1) {
                                     const arr = [...syllabusSubjectList];
                                     arr.splice(idx, 1);
                                     setSyllabusSubjectList(arr);
                                   }
                                 }} className="text-red-400 hover:text-red-600 p-1">
                                   <Trash2 size={18} />
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                     <button type="button" onClick={() => {
                        setSyllabusSubjectList([...syllabusSubjectList, { subject: 'New Subject', details: '' }]);
                     }} className="w-full py-3 border border-dashed border-blue-300 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
                        <Plus size={18} /> Add More Subject
                     </button>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-8">
                    <button type="button" onClick={() => setShowSyllabusModal(false)} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all">Cancel</button>
                    <div className="flex gap-3">
                      <button type="button" onClick={(e) => submitSyllabus(e, true)} disabled={isSubmitting} className="px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm">Save as Draft</button>
                      <button type="button" onClick={(e) => submitSyllabus(e, false)} disabled={isSubmitting} className="px-8 h-12 bg-[#f97316] hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all shadow-md">Publish</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
