import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  MessageSquare, 
  Calendar, 
  Send, 
  List, 
  Trash2, 
  CalendarDays, 
  BookOpen, 
  Clock, 
  FileText, 
  Plus, 
  Bell, 
  Users, 
  CheckCircle2, 
  Circle,
  RefreshCw,
  Pencil,
  Copy,
  Download,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Institution, Language } from '../types';
import { OfflineService } from '../services/OfflineService';
import { getTodayDateString } from '../utils/calendarUtils';
import { sortMadrasahClasses } from 'pages/Classes';
import { generateMessagePDF } from '../utils/pdfGenerator';

import { requestManager } from 'services/RequestManager';

// Sub-components
const SyllabusItem = ({ item, onDelete, onEdit, onDownload, isDownloading }: { item: any, onDelete: (id: string) => void, onEdit: (item: any) => void, onDownload: (item: any) => void, isDownloading: boolean }) => {
  const subjects = item.parsedMessage?.subjects || [];
  return (
    <div className="p-3 group hover:bg-slate-50 transition-colors">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
             <h4 className="font-bold text-slate-800 text-base truncate">{item.title}</h4>
             <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-slate-200 shrink-0">
                {item.class_name.replace('APP_SYLLABUS_', '')}
             </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">Session: {item.parsedMessage?.session}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.parsedMessage?.status === 'draft' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold shrink-0">ড্রাফট</span>}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onDownload(item)} disabled={isDownloading} className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-lg shadow-sm transition-all shrink-0 disabled:opacity-50" title="Download">
              {isDownloading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            </button>
            <button onClick={() => onEdit(item)} className="p-1.5 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg shadow-sm transition-all shrink-0" title="Edit">
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-lg shadow-sm transition-all shrink-0" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
             <tr>
               <th className="py-1.5 px-3 w-1/3">Subject</th>
               <th className="py-1.5 px-3">Details</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {subjects.map((sub: any, idx: number) => (
               <tr key={idx} className="hover:bg-slate-50/50">
                 <td className="py-1.5 px-3 font-bold text-slate-700">{sub.subject}</td>
                 <td className="py-1.5 px-3 text-slate-500 leading-normal">{sub.details}</td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'messages' | 'notices' | 'syllabus' | 'suggestion'>('messages');

  // Modals
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownload = async (msg: any) => {
    setIsDownloading(msg.id);
    try {
      await generateMessagePDF(madrasah, msg, lang);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে' : 'Failed to generate PDF');
    } finally {
      setIsDownloading(null);
    }
  };

  // Form states - Message
  const [selectedClass, setSelectedClass] = useState('');
  const [title, setTitle] = useState('');
  const [msgDate, setMsgDate] = useState(getTodayDateString());
  const [diaryNote, setDiaryNote] = useState('');
  const [diarySubjects, setDiarySubjects] = useState([
    { subject: 'বাংলা', details: '' }
  ]);

  // Form states - Notice
  const [noticeType, setNoticeType] = useState('APP_NOTICE');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDate, setNoticeDate] = useState(getTodayDateString());
  const [noticeDesc, setNoticeDesc] = useState('');
  const [noticeClass, setNoticeClass] = useState('All Classes');
  const [noticeTarget, setNoticeTarget] = useState('All Parents');

  // Form states - Routine
  const [routineClass, setRoutineClass] = useState('');
  const [routineEffectiveDate, setRoutineEffectiveDate] = useState(getTodayDateString());
  const [routineNote, setRoutineNote] = useState('');
  const [routineRows, setRoutineRows] = useState([
    { id: '1', time: '8:00 - 9:00', Sunday: 'Hifz', Monday: 'Quran', Tuesday: 'Hifz', Wednesday: 'Arabic', Thursday: 'Hifz' },
    { id: '2', time: '9:00 - 10:00', Sunday: 'Tajweed', Monday: 'Arabic', Tuesday: 'Tajweed', Wednesday: 'Quran', Thursday: 'Arabic' },
    { id: '3', time: '10:00 - 10:15', isBreak: true, label: 'Break' },
    { id: '4', time: '10:15 - 11:15', Sunday: 'Islam', Monday: 'Hadith', Tuesday: 'Islam', Wednesday: 'Akhlaq', Thursday: 'Hadith' },
    { id: '5', time: '11:15 - 12:15', Sunday: 'Bangla', Monday: 'English', Tuesday: 'Math', Wednesday: 'Bangla', Thursday: 'English' },
  ]);

  // Form states - Syllabus
  const [syllabusTitle, setSyllabusTitle] = useState('');
  const [syllabusClass, setSyllabusClass] = useState('');
  const [syllabusExam, setSyllabusExam] = useState('');
  const [syllabusSession, setSyllabusSession] = useState('2025-26');
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionClass, setSuggestionClass] = useState('');
  const [suggestionExam, setSuggestionExam] = useState('');
  const [suggestionSession, setSuggestionSession] = useState('2025-26');
  const [suggestionSubjectList, setSuggestionSubjectList] = useState([
    { subject: 'বাংলা', details: '' }
  ]);
  const [syllabusSubjectList, setSyllabusSubjectList] = useState([
    { subject: 'বাংলা', details: '' }
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
      // Use Promise.all for parallel fetching
      const [clsResult, historyResult] = await Promise.all([
        requestManager.cachedFetch(
          'classes',
          (q) => q.select('id, class_name, sort_order').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
          `classes:${madrasah.id}`,
          30 * 60 * 1000 // 30 mins
        ),
        supabase.from('messages')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('created_at', { ascending: false })
          .limit(300)
      ]);

      if (clsResult.data) setClasses(sortMadrasahClasses(clsResult.data));
      if (historyResult.data) setMessages(historyResult.data);

    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    if (item.class_name.startsWith('APP_SYLLABUS_')) {
      setSyllabusTitle(item.title);
      setSyllabusClass(item.class_name.replace('APP_SYLLABUS_', ''));
      setSyllabusSession(item.parsedMessage?.session || '2025-26');
      setSyllabusExam(item.parsedMessage?.exam || '');
      setSyllabusSubjectList(item.parsedMessage?.subjects || []);
      setShowSyllabusModal(true);
    
    } else if (item.class_name.startsWith('APP_SUGGESTION_')) {
      setSuggestionTitle(item.title);
      setSuggestionClass(item.class_name.replace('APP_SUGGESTION_', ''));
      setSuggestionSession(item.parsedMessage?.session || '2025-26');
      setSuggestionExam(item.parsedMessage?.exam || '');
      setSuggestionSubjectList(item.parsedMessage?.subjects || []);
      setShowSuggestionModal(true);
} else if (['APP_NOTICE', 'APP_HOLIDAY', 'APP_PTM', 'APP_DIARY', 'all'].includes(item.class_name)) {
      setNoticeTitle(item.title);
      setNoticeDate(item.parsedMessage?.date || getTodayDateString());
      setNoticeDesc(item.parsedMessage?.desc || '');
      setNoticeType(item.class_name);
      setNoticeClass(item.parsedMessage?.classGroup || 'All Classes');
      setNoticeTarget(item.parsedMessage?.sendTo || 'All Parents');
      setShowNoticeModal(true);
    } else {
      // Diary edit logic
      setTitle(item.title);
      setSelectedClass(item.class_name);
      setMsgDate(item.parsedMessage?.date || getTodayDateString());
      setDiaryNote(item.parsedMessage?.note || '');
      setDiarySubjects(item.parsedMessage?.subjects || [
        { subject: 'বাংলা', details: '' }
      ]);
      setShowMsgModal(true);
    }
  };
  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('messages').delete().eq('id', deletingId);
      if (error) throw error;
      await fetchData();
      setShowDeleteModal(false);
      setDeletingId(null);
    } catch (err) {
      console.error(err);
      alert('মুছে ফেলতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
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
    if (!selectedClass || !title) return alert('অনুগ্রহ করে আবশ্যক তথ্যগুলো দিন।');
    setIsSubmitting(true);
    try {
      const payload = {
        date: msgDate,
        subjects: diarySubjects,
        note: diaryNote,
        status: isDraft ? 'draft' : 'published'
      };
      
      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            class_name: selectedClass,
            title,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'ডায়েরি আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: selectedClass,
          title,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowMsgModal(false);
      setEditingItem(null);
      setTitle(''); 
      setDiarySubjects([
        { subject: 'বাংলা', details: '' }
      ]); 
      setDiaryNote(''); 
      setSelectedClass('');
      setMsgDate(getTodayDateString());
      await fetchData();
    } catch (err: any) {
      console.error('Submit error:', err);
      alert('তথ্য সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally { setIsSubmitting(false); }
  };

  const submitNotice = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!noticeTitle) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        date: noticeDate, 
        desc: noticeDesc, 
        classGroup: noticeClass, 
        sendTo: noticeTarget, 
        status: isDraft ? 'draft' : 'published' 
      };

      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            class_name: noticeType,
            title: noticeTitle,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'নোটিশ আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: noticeType,
          title: noticeTitle,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowNoticeModal(false);
      setEditingItem(null);
      setNoticeTitle(''); setNoticeDate(''); setNoticeDesc('');
      await fetchData();
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

  
  const submitSuggestion = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!suggestionClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        subjects: suggestionSubjectList, 
        session: suggestionSession, 
        exam: suggestionExam,
        status: isDraft ? 'draft' : 'published' 
      };
      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            title: suggestionTitle || `Suggestion ${suggestionSession}`,
            class_name: `APP_SUGGESTION_${suggestionClass}`,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সাজেশন আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: `APP_SUGGESTION_${suggestionClass}`,
          title: suggestionTitle || `Suggestion ${suggestionSession}`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }
      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowSuggestionModal(false);
      setEditingItem(null);
      await fetchData();
    } finally { setIsSubmitting(false); }
  };

  const submitSyllabus = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!syllabusClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        subjects: syllabusSubjectList, 
        session: syllabusSession, 
        exam: syllabusExam,
        status: isDraft ? 'draft' : 'published' 
      };

      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            title: syllabusTitle || `Syllabus ${syllabusSession}`,
            class_name: `APP_SYLLABUS_${syllabusClass}`,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সিলেবাস আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: `APP_SYLLABUS_${syllabusClass}`,
          title: syllabusTitle || `Syllabus ${syllabusSession}`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }

      sessionStorage.removeItem(`messages_cache_${madrasah?.id}`);
      setShowSyllabusModal(false);
      setEditingItem(null);
      await fetchData();
    } finally { setIsSubmitting(false); }
  };

  const handleDuplicateDiary = async (msg: any) => {
    if (!madrasah?.id) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('messages').insert({
        institution_id: madrasah.id,
        class_name: msg.class_name,
        title: `${msg.title} (Copy)`,
        message: typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
        sender_name: profile?.name || 'Admin',
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      
      sessionStorage.removeItem(`messages_cache_${madrasah.id}`);
      await fetchData();
      alert('ডায়েরিটি সফলভাবে কপি করা হয়েছে।');
    } catch (err) {
      console.error(err);
      alert('কপি করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };
  const parsedMessages = messages.map(msg => {
    let parsedMessage: any = {};
    try {
      let currentMsg = msg.message;
      for (let i = 0; i < 5; i++) {
        if (typeof currentMsg === 'string') {
          const trimmed = currentMsg.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            currentMsg = JSON.parse(trimmed);
          } else {
            break;
          }
        } else {
          break;
        }
      }
      parsedMessage = currentMsg;
      if (typeof parsedMessage !== 'object' || parsedMessage === null) {
        parsedMessage = { desc: String(msg.message) };
      }
    } catch(e) { 
      parsedMessage = { desc: msg.message }; 
    }
    return { ...msg, parsedMessage };
  });

  const studentMsgs = parsedMessages.filter(m => !m.class_name?.startsWith('APP_'));
  const noticeList = parsedMessages.filter(m => 
    m.class_name === 'APP_NOTICE' || 
    m.class_name === 'APP_HOLIDAY' || 
    m.class_name === 'APP_PTM' || 
    m.class_name === 'APP_DIARY' ||
    m.class_name === 'all'
  );
  const syllabusList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SYLLABUS_'));
  const suggestionList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SUGGESTION_'));

  if (!madrasah) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500 pb-24 max-w-7xl mx-auto px-2 sm:px-4 md:px-8 pt-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-2xl text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <MessageSquare size={26} />
            {lang === 'bn' ? 'বার্তা ও তথ্য' : 'Messages & Updates'}
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold ml-2">
              {messages.length}
            </span>
          </h1>
          <p className="text-blue-100 font-medium mt-1 text-sm opacity-90">{lang === 'bn' ? 'নোটিশ, ক্লাস রুটিন, সিলেবাস এবং অন্যান্য আপডেট' : 'Notice, class routine, syllabus and other updates'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap bg-white border border-slate-200 p-2 rounded-2xl gap-2 shadow-sm">
        <button onClick={() => setActiveTab('messages')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'messages' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>
          <BookOpen size={18} /><span>{lang === 'bn' ? 'ডায়েরি' : 'Diary'}</span>
        </button>
        <button onClick={() => setActiveTab('notices')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'notices' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Bell size={18} /><span>{lang === 'bn' ? 'নোটিশ' : 'Notice'}</span>
        </button>
        <button onClick={() => setActiveTab('syllabus')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'syllabus' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'text-slate-500 hover:bg-slate-50'}`}>
           <BookOpen size={18} /><span>{lang === 'bn' ? 'সিলেবাস' : 'Syllabus'}</span>
        </button>
        <button onClick={() => setActiveTab('suggestion')} className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'suggestion' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}>
           <BookOpen size={18} /><span>{lang === 'bn' ? 'সাজেশন' : 'Suggestion'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-8 min-h-[400px]">
         
         {isLoading ? (
            <div className="py-20 text-center animate-pulse flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
                <MessageSquare className="text-blue-400" size={24} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
            </div>
         ) : (
           <>
              {/* === TAB 1: MESSAGES === */}
              {activeTab === 'messages' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                       <BookOpen size={18} className="text-blue-500" />
                       {lang === 'bn' ? 'আজকের ডায়েরি' : "Today's Diary"}
                    </h2>
                    <button onClick={() => { 
                      setEditingItem(null); 
                      setTitle(''); 
                      setDiarySubjects([
                        { subject: 'বাংলা', details: '' }
                      ]); 
                      setDiaryNote(''); 
                      setSelectedClass('');
                      setMsgDate(getTodayDateString());
                      setShowMsgModal(true); 
                    }} className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                       <Plus size={14} /> {lang === 'bn' ? 'ডায়েরি লিখুন' : 'Write Diary'}
                    </button>
                  </div>
                  {studentMsgs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {studentMsgs.map((msg) => (
                        <div key={msg.id} className="bg-white border-l-4 border-l-blue-500 border border-slate-200 rounded-3xl hover:shadow-xl transition-all group overflow-hidden">
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-3 gap-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shadow-sm shrink-0">
                                   <BookOpen size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">{msg.title}</h3>
                                    {msg.parsedMessage?.status === 'draft' && (
                                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                                        ড্রাফট
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest leading-none mt-1.5">{msg.class_name}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleDownload(msg)} disabled={isDownloading === msg.id} className="p-1.5 sm:p-2 bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-600 hover:text-white rounded-xl transition-all shadow-sm shrink-0 disabled:opacity-50" title="Download">
                                  {isDownloading === msg.id ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                </button>
                                <button onClick={() => handleDuplicateDiary(msg)} className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm shrink-0" title="Duplicate Diary">
                                  <Copy size={12} />
                                </button>
                                <button onClick={() => startEdit(msg)} className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm transition-all shrink-0" title="Edit">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => handleDelete(msg.id)} className="p-1.5 sm:p-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-sm transition-all shrink-0" title="Delete">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            



                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                  <CalendarDays size={12} className="text-slate-300" />
                                  {msg.parsedMessage?.date 
                                    ? new Date(msg.parsedMessage.date).toLocaleDateString('bn-BD') 
                                    : new Date(msg.created_at).toLocaleDateString('bn-BD')}
                              </div>
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                                 <span className="text-[10px] font-bold text-slate-500 truncate max-w-[90px]">{msg.sender_name}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">{lang === 'bn' ? 'কোনো বার্তা পাঠানো হয়নি' : 'No messages sent'}</div>
                  )}
                </div>
              )}

              {/* === TAB 2: NOTICES === */}
              {activeTab === 'notices' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                       <Bell size={18} className="text-amber-500" />
                       {lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'}
                    </h2>
                    <button onClick={() => { 
                      setEditingItem(null); 
                      setNoticeTitle(''); 
                      setNoticeDate(getTodayDateString()); 
                      setNoticeDesc('');
                      setNoticeType('APP_NOTICE');
                      setNoticeClass('All Classes');
                      setNoticeTarget('All Parents');
                      setShowNoticeModal(true); 
                    }} className="bg-amber-600 text-white hover:bg-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                       <Plus size={14} /> {lang === 'bn' ? 'নোটিশ দিন' : 'Create Notice'}
                    </button>
                  </div>
                  {noticeList.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {noticeList.map((msg) => (
                        <div key={msg.id} className="flex gap-4 p-3 border border-slate-200 rounded-2xl hover:border-amber-200 hover:shadow-md transition-all bg-white group relative">
                          <div className={`w-14 h-14 rounded-xl shrink-0 flex flex-col items-center justify-center border
                             ${msg.class_name === 'APP_HOLIDAY' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : msg.class_name === 'APP_PTM' ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                             <span className="text-[10px] font-black uppercase tracking-tighter leading-none opacity-60">
                               {new Date(msg.parsedMessage?.date || msg.created_at).toLocaleString('default', { month: 'short' })}
                             </span>
                             <span className="text-2xl font-black leading-none mt-1">
                               {new Date(msg.parsedMessage?.date || msg.created_at).getDate()}
                             </span>
                          </div>
                          
                          <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center justify-between mb-1 gap-2">
                               <div className="flex items-center gap-2 overflow-hidden flex-wrap min-w-0 flex-1">
                                 <h3 className="font-bold text-slate-800 text-base truncate">{msg.title}</h3>
                                 <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                                    {msg.class_name.replace('APP_', '')}
                                 </span>
                                 {msg.parsedMessage?.status === 'draft' && (
                                   <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                                      ড্রাফট
                                   </span>
                                 )}
                               </div>
                               <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => handleDownload(msg)} disabled={isDownloading === msg.id} className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm transition-all shrink-0 disabled:opacity-50" title="Download">
                                     {isDownloading === msg.id ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                  </button>
                                  <button onClick={() => startEdit(msg)} className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm transition-all shrink-0" title="Edit">
                                     <Pencil size={12} />
                                  </button>
                                  <button onClick={() => handleDelete(msg.id)} className="p-1.5 sm:p-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-sm transition-all shrink-0" title="Delete">
                                     <Trash2 size={12} />
                                  </button>
                               </div>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 font-medium mb-3 italic">"{msg.parsedMessage?.desc || msg.message}"</p>
                            <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400">
                               {msg.parsedMessage?.sendTo && <span className="text-blue-500">Target: {msg.parsedMessage.sendTo}</span>}
                               <span>• Posted by {msg.sender_name}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">{lang === 'bn' ? 'কোনো নোটিশ নেই' : 'No notices found'}</div>
                  )}
                </div>
              )}

              {/* === TAB 3: SYLLABUS === */}
              {activeTab === 'syllabus' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                       <BookOpen size={18} className="text-purple-500" />
                       {lang === 'bn' ? 'সিলেবাস' : 'Syllabus'}
                    </h2>
                    <button onClick={() => { 
                      setEditingItem(null); 
                      setSyllabusTitle('');
                      setSyllabusClass('');
                      setSyllabusExam('');
                      setSyllabusSession('2025-26');
                      setSyllabusSubjectList([
                        { subject: 'বাংলা', details: '' }
                      ]);
                      setShowSyllabusModal(true); 
                    }} className="bg-purple-600 text-white hover:bg-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                       <Plus size={14} /> {lang === 'bn' ? 'সিলেবাস যোগ করুন' : 'Add Syllabus'}
                    </button>
                  </div>
                  {syllabusList.length > 0 ? (
                    <div className="space-y-6">
                      {/* Show by known classes first */}
                      {classes.map(cls => {
                         const clsSyllabus = syllabusList.filter(m => m.class_name === `APP_SYLLABUS_${cls.class_name}`);
                         if(clsSyllabus.length === 0) return null;
                         return (
                           <div key={cls.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                             <div className="bg-purple-50/50 px-4 py-3 border-b border-slate-200 font-black text-purple-900 flex items-center gap-2">
                               {cls.class_name}
                             </div>
                             <div className="divide-y divide-slate-100">
                              {clsSyllabus.map(s => (
                                 <SyllabusItem key={s.id} item={s} onDelete={handleDelete} onEdit={startEdit} onDownload={handleDownload} isDownloading={isDownloading === s.id} />
                               ))}
                             </div>
                           </div>
                         );
                      })}

                      {/* Show others that don't match known classes */}
                      {(() => {
                        const matchedClassNames = classes.map(c => `APP_SYLLABUS_${c.class_name}`);
                        const unmatched = syllabusList.filter(s => !matchedClassNames.includes(s.class_name));
                        if (unmatched.length === 0) return null;
                        return (
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-black text-slate-800 flex items-center gap-2">
                              Other / Unknown Classes
                            </div>
                            <div className="divide-y divide-slate-100">
                              {unmatched.map(s => (
                                 <SyllabusItem key={s.id} item={s} onDelete={handleDelete} onEdit={startEdit} onDownload={handleDownload} isDownloading={isDownloading === s.id} />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">{lang === 'bn' ? 'সিলেবাসে কোনো টপিক নেই' : 'No syllabus topics found'}</div>
                  )}
                </div>
              )}
           
              {/* === TAB 4: SUGGESTION === */}
              {activeTab === 'suggestion' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                       <BookOpen size={18} className="text-emerald-500" />
                       {lang === 'bn' ? 'সাজেশন' : 'Suggestion'}
                    </h2>
                    <button onClick={() => { 
                       setEditingItem(null); 
                       setSuggestionTitle('');
                      setSuggestionClass('');
                      setSuggestionExam('');
                      setSuggestionSession('2025-26');
                      setSuggestionSubjectList([
                        { subject: 'বাংলা', details: '' }
                      ]);
                      setShowSuggestionModal(true); 
                     }} className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                       <Plus size={14} /> {lang === 'bn' ? 'সাজেশন যোগ করুন' : 'Add Suggestion'}
                    </button>
                  </div>

                  {suggestionList.length > 0 ? (
                    <div className="space-y-6">
                      {classes.map(cls => {
                         const clsSyllabus = suggestionList.filter(m => m.class_name === `APP_SUGGESTION_${cls.class_name}`);
                         if(clsSyllabus.length === 0) return null;
                         return (
                           <div key={cls.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                             <div className="bg-emerald-50/50 px-4 py-3 border-b border-slate-200 font-black text-emerald-900 flex items-center gap-2">
                               {cls.class_name}
                             </div>
                             <div className="divide-y divide-slate-100">
                              {clsSyllabus.map(s => (
                                 <SyllabusItem key={s.id} item={s} onDelete={handleDelete} onEdit={startEdit} onDownload={handleDownload} isDownloading={isDownloading === s.id} />
                               ))}
                             </div>
                           </div>
                         );
                      })}
                      {(() => {
                        const matchedClassNames = classes.map(c => `APP_SUGGESTION_${c.class_name}`);
                        const unmatched = suggestionList.filter(s => !matchedClassNames.includes(s.class_name));
                        if (unmatched.length === 0) return null;
                        return (
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-black text-slate-800 flex items-center gap-2">
                              Other / Unknown Classes
                            </div>
                            <div className="divide-y divide-slate-100">
                              {unmatched.map(s => (
                                 <SyllabusItem key={s.id} item={s} onDelete={handleDelete} onEdit={startEdit} onDownload={handleDownload} isDownloading={isDownloading === s.id} />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">{lang === 'bn' ? 'কোনো সাজেশন নেই' : 'No suggestions found'}</div>
                  )}
                </div>
              )}
           </>
         )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. Message Modal (Diary) */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <BookOpen size={28} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">ডায়েরি লিখুন</h3>
                        <p className="text-slate-500 text-sm font-medium">আজকের দিনের ক্লাস ও পড়া সম্পর্কিত তথ্য দিন</p>
                     </div>
                  </div>
                  <button onClick={() => setShowMsgModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Class & Date Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শ্রেণী (Class) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={selectedClass} 
                        onChange={e=>setSelectedClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700 font-bold"
                      >
                        <option value="">শ্রেণী নির্বাচন করুন...</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">তারিখ <span className="text-red-500">*</span></label>
                      <input 
                        required 
                        type="date" 
                        value={msgDate} 
                        onChange={e=>setMsgDate(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Title of Diary Entry */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">ডায়েরির শিরোনাম <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="text" 
                      value={title} 
                      onChange={e=>setTitle(e.target.value)} 
                      placeholder="যেমন: ০১ জুন ২০২৬, সোমবারের বাড়ির কাজ" 
                      className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700 placeholder-slate-400" 
                    />
                  </div>

                  {/* Diary Subjects List (Syllabus style but compact & responsive) */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">বিষয় এবং আজকের পড়া (বাড়ির কাজ)</label>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{diarySubjects.length}টি বিষয়</span>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {diarySubjects.map((sub, idx) => (
                        <div 
                          key={idx} 
                          className="group flex flex-col sm:flex-row items-stretch gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50 transition-all duration-200"
                        >
                          {/* Subject Input */}
                          <div className="flex-1 min-w-[150px] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0 flex items-center justify-center">
                              <BookOpen size={18} />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">বিষয় (Subject)</label>
                              <input 
                                type="text" 
                                placeholder="যেমন: বাংলা, ইংরেজি" 
                                value={sub.subject} 
                                onChange={e => {
                                   const newList = diarySubjects.map((s, idx2) => idx2 === idx ? { ...s, subject: e.target.value } : s);
                                   setDiarySubjects(newList);
                                }} 
                                className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-blue-500 rounded-xl h-10 px-3 outline-none transition-all font-bold text-slate-700 text-sm" 
                              />
                            </div>
                          </div>

                          {/* Homework Details */}
                          <div className="flex-[2] flex flex-col justify-center">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">আজকের পড়া / বাড়ির কাজ (Homework Details)</label>
                            <textarea 
                              placeholder="পড়া বা বাড়ির কাজ বিস্তারিত লিখুন..." 
                              value={sub.details} 
                              onChange={e => {
                                 const newList = diarySubjects.map((s, idx2) => idx2 === idx ? { ...s, details: e.target.value } : s);
                                 setDiarySubjects(newList);
                              }} 
                              className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-blue-500 rounded-xl py-2 px-3 outline-none transition-all font-semibold text-slate-600 text-sm min-h-[60px] resize-none" 
                            />
                          </div>

                          {/* Delete Action Button */}
                          <div className="flex items-center justify-end sm:justify-center px-1">
                            <button 
                              type="button" 
                              onClick={() => setDiarySubjects(diarySubjects.filter((_, i) => i !== idx))}
                              disabled={diarySubjects.length <= 1}
                              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all"
                              title="Remove Subject"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => setDiarySubjects([...diarySubjects, { subject: '', details: '' }])}
                      className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 text-blue-600 hover:text-blue-700 hover:border-blue-300 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-50/30 transition-all active:scale-99"
                    >
                      <Plus size={18} className="stroke-[3]" /> আরো বিষয় যোগ করুন (Add Subject)
                    </button>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 mt-8">
                    <button 
                      type="button" 
                      onClick={() => setShowMsgModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitMessage(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitMessage(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> ডায়েরি প্রকাশ করুন
                      </button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-red-500 via-amber-500 to-red-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <Bell size={28} className="animate-wiggle" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">নোটিশ তৈরি করুন</h3>
                        <p className="text-slate-500 text-sm font-medium">অভিভাবক ও শিক্ষার্থীদের জন্য গুরুত্বপূর্ণ নোটিশ পাঠান</p>
                     </div>
                  </div>
                  <button onClick={() => setShowNoticeModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Title Input */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">নোটিশের শিরোনাম <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="text" 
                      value={noticeTitle} 
                      onChange={e=>setNoticeTitle(e.target.value)} 
                      placeholder="যেমন: আগামী শুক্রবার মাদ্রাসা বন্ধ থাকবে" 
                      className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all font-bold text-slate-700 placeholder-slate-400" 
                    />
                  </div>

                  {/* Dual selectors for Class and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">শ্রেণী / গ্রুপ <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={noticeClass} 
                        onChange={e=>setNoticeClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all font-bold text-slate-700"
                      >
                        <option value="All Classes">সকল শ্রেণী (All Classes)</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>

                    <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">নোটিশের ধরন <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'APP_NOTICE', label: 'গুরুত্বপূর্ণ নোটিশ', color: 'border-red-200 text-red-600 bg-red-50/10' },
                          { id: 'APP_HOLIDAY', label: 'ছুটির ঘোষণা', color: 'border-amber-200 text-amber-600 bg-amber-50/10' },
                          { id: 'APP_PTM', label: 'মিটিং / সভা', color: 'border-blue-200 text-blue-600 bg-blue-50/10' },
                          { id: 'APP_DIARY', label: 'ডায়েরি নোটিশ', color: 'border-purple-200 text-purple-600 bg-purple-50/10' },
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setNoticeType(type.id)}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                              noticeType === type.id 
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-102 font-black' 
                                : `bg-white border-slate-200 text-slate-600 hover:border-slate-300`
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Date selection */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">তারিখ <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        required 
                        type="date" 
                        value={noticeDate} 
                        onChange={e=>setNoticeDate(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all font-bold text-slate-700" 
                      />
                    </div>
                  </div>

                  {/* Message details */}
                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">বিস্তারিত বিবরণ <span className="text-red-500">*</span></label>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100 transition-all">
                      <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif font-black text-sm transition-all">B</button>
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif italic text-sm transition-all">I</button>
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg font-serif underline text-sm transition-all">U</button>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button type="button" className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-all"><List size={16} /></button>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Rich Text</span>
                      </div>
                      <textarea 
                        required 
                        value={noticeDesc} 
                        onChange={e=>setNoticeDesc(e.target.value)} 
                        placeholder="এখানে বিস্তারিত বিবরণ ও নির্দেশনাবলী লিখুন..." 
                        className="w-full h-40 p-4 outline-none resize-none text-slate-700 leading-relaxed font-semibold placeholder-slate-400" 
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setShowNoticeModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitNotice(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitNotice(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> নোটিশ প্রকাশ করুন
                      </button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <BookOpen size={28} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">সিলেবাস যোগ করুন</h3>
                        <p className="text-slate-500 text-sm font-medium">বিভিন্ন শ্রেণীর জন্য নতুন সিলেবাস তৈরি অথবা আপডেট করুন</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSyllabusModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শ্রেণী (Class) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={syllabusClass} 
                        onChange={e=>setSyllabusClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-bold text-slate-700"
                      >
                        <option value="">শ্রেণী নির্বাচন করুন...</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">পরীক্ষা (Exam) <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span></label>
                      <input 
                        type="text"
                        value={syllabusExam}
                        onChange={e=>setSyllabusExam(e.target.value)}
                        placeholder="যেমন: অর্ধবার্ষিক পরীক্ষা"
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-bold text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শিক্ষাবর্ষ / সেশন (Session) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={syllabusSession} 
                        onChange={e=>setSyllabusSession(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-bold text-slate-700"
                      >
                        <option value="2025-26">২০২৫-২৬ (2025-26)</option>
                        <option value="2026-27">২০২৬-২৭ (2026-27)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject List Grid Design */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">সিলেবাসের বিষয়সমূহ এবং বিবরণ</label>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{syllabusSubjectList.length}টি বিষয়</span>
                    </div>

                    <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {syllabusSubjectList.map((item, idx) => {
                        // Dynamic icons or tag themes based on subject input
                        const subLower = item.subject.toLowerCase();
                        let badgeStyle = "bg-orange-50 text-orange-600 border-orange-100";
                        if (subLower.includes("quran") || subLower.includes("কুরআন") || subLower.includes("কোরআন")) {
                          badgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        } else if (subLower.includes("arabic") || subLower.includes("আরবি")) {
                          badgeStyle = "bg-red-50 text-red-600 border-red-100";
                        } else if (subLower.includes("hadith") || subLower.includes("হাদিস")) {
                          badgeStyle = "bg-blue-50 text-blue-600 border-blue-100";
                        } else if (subLower.includes("bangla") || subLower.includes("বাংলা")) {
                          badgeStyle = "bg-teal-50 text-teal-600 border-teal-100";
                        } else if (subLower.includes("english") || subLower.includes("अंग्रेजी")) {
                          badgeStyle = "bg-purple-50 text-purple-600 border-purple-100";
                        }

                        return (
                          <div 
                            key={idx} 
                            className="group flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50 transition-all duration-200"
                          >
                            {/* Subject Field Column */}
                            <div className="flex-1 min-w-[200px] flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl border shrink-0 flex items-center justify-center transition-all ${badgeStyle}`}>
                                <BookOpen size={18} />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">বিষয় (Subject)</label>
                                <input 
                                  type="text" 
                                  value={item.subject} 
                                  onChange={(e) => {
                                    const arr = [...syllabusSubjectList];
                                    arr[idx].subject = e.target.value;
                                    setSyllabusSubjectList(arr);
                                  }} 
                                  className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-orange-500 rounded-xl h-10 px-3 outline-none transition-all font-bold text-slate-700 text-sm" 
                                  placeholder="যেমন: বাংলা, ইংরেজি, গণিত"
                                />
                              </div>
                            </div>

                            {/* Details text input column */}
                            <div className="flex-[2] flex flex-col justify-center">
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">পরীক্ষার সিলেবাসের বিবরণ (Syllabus Details)</label>
                              <textarea 
                                value={item.details} 
                                onChange={(e) => {
                                  const arr = [...syllabusSubjectList];
                                  arr[idx].details = e.target.value;
                                  setSyllabusSubjectList(arr);
                                }} 
                                className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-orange-500 rounded-xl py-2 px-3 outline-none transition-all font-semibold text-slate-600 text-sm min-h-[60px] resize-none" 
                                placeholder="পরীক্ষার অধ্যায়, পৃষ্ঠা বা নির্দিষ্ট অংশ বিস্তারিত লিখুন..."
                              />
                            </div>

                            {/* Delete Column */}
                            <div className="flex items-center justify-end md:justify-center px-1">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if(syllabusSubjectList.length > 1) {
                                    const arr = [...syllabusSubjectList];
                                    arr.splice(idx, 1);
                                    setSyllabusSubjectList(arr);
                                  }
                                }} 
                                disabled={syllabusSubjectList.length <= 1}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all"
                                title="Remove Subject"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        setSyllabusSubjectList([...syllabusSubjectList, { subject: '', details: '' }]);
                      }} 
                      className="w-full mt-4 py-3.5 border-2 border-dashed border-slate-200 text-orange-600 hover:text-orange-700 hover:border-orange-300 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-orange-50/30 transition-all active:scale-99"
                    >
                      <Plus size={18} className="stroke-[3]" /> আরো বিষয় যোগ করুন (Add Subject)
                    </button>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 mt-8">
                    <button 
                      type="button" 
                      onClick={() => setShowSyllabusModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitSyllabus(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitSyllabus(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> সিলেবাস প্রকাশ করুন
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Suggestion Modal */}
      {showSuggestionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] overflow-y-auto">
          <div className="min-h-screen px-4 md:px-8 pt-10 pb-36 md:py-10 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Premium Header Accent */}
              <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-6 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <BookOpen size={28} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">সাজেশন যোগ করুন</h3>
                        <p className="text-slate-500 text-sm font-medium">বিভিন্ন শ্রেণীর জন্য নতুন সাজেশন তৈরি অথবা আপডেট করুন</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSuggestionModal(false)} className="px-5 h-11 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-extrabold flex items-center gap-2 border border-slate-200/60 transition-all active:scale-95">
                     ← ফিরে যান
                  </button>
                </div>

                <form className="space-y-6">
                  {/* Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শ্রেণী (Class) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={suggestionClass} 
                        onChange={e=>setSuggestionClass(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-700"
                      >
                        <option value="">শ্রেণী নির্বাচন করুন...</option>
                        {classes.map(c=><option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">পরীক্ষা (Exam) <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span></label>
                      <input 
                        type="text"
                        value={suggestionExam}
                        onChange={e=>setSuggestionExam(e.target.value)}
                        placeholder="যেমন: অর্ধবার্ষিক পরীক্ষা"
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 font-bold">শিক্ষাবর্ষ / সেশন (Session) <span className="text-red-500">*</span></label>
                      <select 
                        required 
                        value={suggestionSession} 
                        onChange={e=>setSuggestionSession(e.target.value)} 
                        className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-bold text-slate-700"
                      >
                        <option value="2025-26">২০২৫-২৬ (2025-26)</option>
                        <option value="2026-27">২০২৬-২৭ (2026-27)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject List Grid Design */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">সিলেবাসের বিষয়সমূহ এবং বিবরণ</label>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{suggestionSubjectList.length}টি বিষয়</span>
                    </div>

                    <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {suggestionSubjectList.map((item, idx) => {
                        // Dynamic icons or tag themes based on subject input
                        const subLower = item.subject.toLowerCase();
                        let badgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        if (subLower.includes("quran") || subLower.includes("কুরআন") || subLower.includes("কোরআন")) {
                          badgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        } else if (subLower.includes("arabic") || subLower.includes("আরবি")) {
                          badgeStyle = "bg-red-50 text-red-600 border-red-100";
                        } else if (subLower.includes("hadith") || subLower.includes("হাদিস")) {
                          badgeStyle = "bg-blue-50 text-blue-600 border-blue-100";
                        } else if (subLower.includes("bangla") || subLower.includes("বাংলা")) {
                          badgeStyle = "bg-teal-50 text-teal-600 border-teal-100";
                        } else if (subLower.includes("english") || subLower.includes("अंग्रेजी")) {
                          badgeStyle = "bg-purple-50 text-purple-600 border-purple-100";
                        }

                        return (
                          <div 
                            key={idx} 
                            className="group flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/50 transition-all duration-200"
                          >
                            {/* Subject Field Column */}
                            <div className="flex-1 min-w-[200px] flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl border shrink-0 flex items-center justify-center transition-all ${badgeStyle}`}>
                                <BookOpen size={18} />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">বিষয় (Subject)</label>
                                <input 
                                  type="text" 
                                  value={item.subject} 
                                  onChange={(e) => {
                                    const arr = [...suggestionSubjectList];
                                    arr[idx].subject = e.target.value;
                                    setSuggestionSubjectList(arr);
                                  }} 
                                  className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-emerald-500 rounded-xl h-10 px-3 outline-none transition-all font-bold text-slate-700 text-sm" 
                                  placeholder="যেমন: বাংলা, ইংরেজি, গণিত"
                                />
                              </div>
                            </div>

                            {/* Details text input column */}
                            <div className="flex-[2] flex flex-col justify-center">
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">পরীক্ষার সিলেবাসের বিবরণ (Syllabus Details)</label>
                              <textarea 
                                value={item.details} 
                                onChange={(e) => {
                                  const arr = [...suggestionSubjectList];
                                  arr[idx].details = e.target.value;
                                  setSuggestionSubjectList(arr);
                                }} 
                                className="w-full bg-white border border-slate-100 hover:border-slate-200 focus:border-emerald-500 rounded-xl py-2 px-3 outline-none transition-all font-semibold text-slate-600 text-sm min-h-[60px] resize-none" 
                                placeholder="পরীক্ষার অধ্যায়, পৃষ্ঠা বা নির্দিষ্ট অংশ বিস্তারিত লিখুন..."
                              />
                            </div>

                            {/* Delete Column */}
                            <div className="flex items-center justify-end md:justify-center px-1">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if(suggestionSubjectList.length > 1) {
                                    const arr = [...suggestionSubjectList];
                                    arr.splice(idx, 1);
                                    setSuggestionSubjectList(arr);
                                  }
                                }} 
                                disabled={suggestionSubjectList.length <= 1}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all"
                                title="Remove Subject"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        setSuggestionSubjectList([...suggestionSubjectList, { subject: '', details: '' }]);
                      }} 
                      className="w-full mt-4 py-3.5 border-2 border-dashed border-slate-200 text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-50/30 transition-all active:scale-99"
                    >
                      <Plus size={18} className="stroke-[3]" /> আরো বিষয় যোগ করুন (Add Subject)
                    </button>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 mt-8">
                    <button 
                      type="button" 
                      onClick={() => setShowSuggestionModal(false)} 
                      className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl font-bold transition-all active:scale-95"
                    >
                      বাতিল
                    </button>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                      <button 
                        type="button" 
                        onClick={(e) => submitSuggestion(e, true)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-6 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-all active:scale-95"
                      >
                        ড্রাফট হিসেবে সংরক্ষণ
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => submitSuggestion(e, false)} 
                        disabled={isSubmitting} 
                        className="w-full sm:w-auto px-8 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black disabled:opacity-50 transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> সাজেশন প্রকাশ করুন
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} className="stroke-[2.5]" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                এই তথ্যটি চিরস্থায়ীভাবে মুছে ফেলা হবে। আপনি কি নিশ্চিত যে এটি মুছে ফেলতে চান?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => confirmDelete()}
                  disabled={isSubmitting}
                  className="w-full h-14 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Trash2 size={20} />}
                  হ্যাঁ, মুছে ফেলুন
                </button>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingId(null);
                  }}
                  disabled={isSubmitting}
                  className="w-full h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  বাতিল করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
