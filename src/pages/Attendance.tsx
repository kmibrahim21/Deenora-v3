
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, smsApi } from 'supabase';
import { Institution, Class, Student, Language, Attendance as AttendanceType, Profile } from 'types';
import { ClipboardList, Users, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, ChevronDown, Save, Calendar, BarChart3, Send, AlertTriangle, FileText, CheckCircle2, AlertCircle, RefreshCw, Settings, TrendingDown, Info } from 'lucide-react';
import { getBengaliDate, getHijriDate, getEventsForDate } from '../utils/calendarUtils';
import { sortMadrasahClasses } from 'pages/Classes';
import { t } from 'translations';
import { useOfflineStatus } from 'hooks/useOffline';
import { CacheService } from 'services/cacheService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttendanceProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  userId: string;
  profile?: Profile | null;
}

const Attendance: React.FC<AttendanceProps> = ({ lang, madrasah, onBack, userId, profile }) => {
  const isTeacher = profile?.role === 'teacher';
  const canManageAttendance = !isTeacher || profile?.permissions?.can_manage_attendance;

  if (!canManageAttendance) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const isOnline = useOfflineStatus();
  const [activeTab, setActiveTab] = useState<'daily' | 'report'>('daily');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'half_day'>>({});
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [reportView, setReportView] = useState<'list' | 'analytics'>('list');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [halfDayTime, setHalfDayTime] = useState(madrasah?.config_json?.attendance_settings?.half_day_time || '12:00');
  const [fullDayTime, setFullDayTime] = useState(madrasah?.config_json?.attendance_settings?.full_day_time || '14:00');
  const [savingSettings, setSavingSettings] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<any[]>([]);
  const [isHoliday, setIsHoliday] = useState(false);
  const [showShortcodes, setShowShortcodes] = useState(false);

  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'ছাত্রের নাম' : 'Student Name' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },
  ];

  useEffect(() => {
    if (madrasah) fetchClasses();
  }, [madrasah?.id]);

  useEffect(() => {
    if (selectedClass) {
      if (activeTab === 'daily') {
        fetchStudents(selectedClass.id);
        fetchDayEvents();
      }
      else fetchReport(selectedClass.id);
    }
  }, [selectedClass?.id, activeTab, date, selectedMonth, reportType, selectedYear]);

  const fetchDayEvents = async () => {
    if (!madrasah) return;
    try {
      const { data: customEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('event_date', date);
      
      const events = getEventsForDate(new Date(date), customEvents || []);
      setDayEvents(events);
      
      const holiday = events.length > 0;
      setIsHoliday(holiday);
    } catch (e) {
      console.error('Error fetching day events:', e);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah?.id);
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchStudents = async (cid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: stdData } = await supabase.from('students').select('*').eq('class_id', cid).order('roll', { ascending: true });
      const { data: attData } = await supabase.from('attendance').select('*').eq('class_id', cid).eq('date', date);

      if (stdData) {
        setStudents(stdData);
        const initial: Record<string, 'present' | 'absent' | 'late' | 'half_day'> = {};
        stdData.forEach(s => {
          const existing = attData?.find(a => a.student_id === s.id);
          initial[s.id] = existing ? (existing.status as any) : 'present';
        });
        setAttendance(initial);
      }
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const fetchReport = async (cid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      if (!isOnline) {
        const cachedReport = await CacheService.getCachedData('attendance', madrasah?.id || '');
        // Filter cached report by class and date range
        // For simplicity, we just set the cached data if it matches the class
        const filtered = cachedReport.filter(r => r.class_id === cid);
        setReportData(filtered);
        setLoading(false);
        return;
      }

      let startDate, endDate;

      if (reportType === 'monthly') {
          startDate = `${selectedMonth}-01`;
          endDate = new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString().split('T')[0];
      } else {
          startDate = `${selectedYear}-01-01`;
          endDate = `${selectedYear}-12-31`;
      }

      const { data, error } = await supabase.rpc('get_attendance_report', {
        p_class_id: cid,
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) throw error;
      if (data) {
        setReportData(data);
        await CacheService.cacheData('attendance', madrasah?.id || '', data);
      }
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  const setStatus = (sid: string, status: 'present' | 'absent' | 'late' | 'half_day') => {
    setAttendance(prev => ({ ...prev, [sid]: status }));
  };

  const handleSave = async () => {
    if (!madrasah || !selectedClass) return;
    setSaving(true);
    try {
      // Clean delete for sync
      const { error: delError } = await supabase.from('attendance').delete().eq('class_id', selectedClass.id).eq('date', date);
      if (delError) throw delError;

      const payload = Object.entries(attendance).map(([sid, status]) => ({
        institution_id: madrasah.id,
        class_id: selectedClass.id,
        student_id: sid,
        status: status,
        date: date,
        recorded_by: userId
      }));

      const { error } = await supabase.from('attendance').insert(payload);
      if (error) {
        if (error.message.includes('class_id') || error.message.includes('cache')) {
          throw new Error('ডাটাবেস কলাম (class_id) খুঁজে পাওয়া যাচ্ছে না। দয়া করে SQL এডিটর থেকে নতুন মাইগ্রেশন কোডটি রান করুন।');
        }
        throw error;
      }
      alert(t('success', lang));
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const sendAbsentAlerts = async () => {
    if (!madrasah || !selectedClass) return;
    const absents = students.filter(s => attendance[s.id] === 'absent');
    if (absents.length === 0) {
        alert(lang === 'bn' ? 'কোনো অনুপস্থিত ছাত্র নেই!' : 'No absent students found!');
        return;
    }

    if (!confirm(lang === 'bn' ? `${absents.length} জন অভিভাবককে অনুপস্থিতি SMS পাঠাতে চান?` : `Send absence alerts to ${absents.length} guardians?`)) return;

    setSendingAlerts(true);
    try {
      const message = lang === 'bn' 
        ? `আস-সালামু আলাইকুম, {student_name} আজ মাদরাসায় অনুপস্থিত। অনুগ্রহ করে অনুপস্থিতির কারণ জানান।`
        : `As-Salamu Alaikum, {student_name} is absent today. Please inform us of the reason.`;

      await smsApi.sendBulk(madrasah.id, absents, message);
      alert(t('sms_success', lang));
    } catch (err: any) { alert(err.message); } finally { setSendingAlerts(false); }
  };

  const saveSettings = async () => {
    if (!madrasah) return;
    setSavingSettings(true);
    try {
      const updatedConfig = {
        ...madrasah.config_json,
        attendance_settings: {
          ...madrasah.config_json?.attendance_settings,
          half_day_time: halfDayTime,
          full_day_time: fullDayTime
        }
      };
      
      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);
        
      if (error) throw error;
      alert('Settings saved successfully!');
      setShowSettingsModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-20 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}><ArrowLeft size={20}/></button>
          <h1 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>{t('attendance_daily', lang)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettingsModal(true)} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400'}`}><Settings size={18} /></button>
          <button onClick={() => selectedClass && (activeTab === 'daily' ? fetchStudents(selectedClass.id) : fetchReport(selectedClass.id))} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-400'}`}><RefreshCw size={18} /></button>
        </div>
      </div>

      <div className={`flex p-1 rounded-[1.5rem] border shadow-sm transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
        {(['daily', 'report'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            {tab === 'daily' ? t('attendance_daily', lang) : t('attendance_report', lang)}
          </button>
        ))}
      </div>

      <div className={`p-6 rounded-[2.5rem] border shadow-bubble space-y-4 transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">{t('class_select', lang)}</label>
          <button onClick={() => setShowClassDropdown(!showClassDropdown)} className={`w-full h-14 px-6 rounded-2xl border-2 flex items-center justify-between group active:scale-[0.99] transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
            <span className="font-black font-noto truncate">{selectedClass?.class_name || t('class_choose', lang)}</span>
            <ChevronDown size={20} className="text-slate-300 transition-transform duration-300 group-focus:rotate-180" />
          </button>
          {showClassDropdown && (
            <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2rem] shadow-bubble border z-[100] p-2 max-h-56 overflow-y-auto animate-in slide-in-from-top-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              {classes.map(cls => (
                <button key={cls.id} onClick={() => { setSelectedClass(cls); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-4 rounded-xl mb-1 transition-all ${selectedClass?.id === cls.id ? 'bg-[#2563EB] text-white shadow-premium' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700')}`}>
                  <span className="font-black font-noto text-[15px]">{cls.class_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'daily' ? (
          <div className="relative animate-in fade-in">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">তারিখ</label>
            <div className="relative"><input type="date" className={`w-full h-14 pl-14 pr-6 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={date} onChange={(e) => setDate(e.target.value)} /><Calendar className="absolute left-5 top-4 text-[#2563EB]" size={22}/></div>
          </div>
        ) : (
            <div className="space-y-4 animate-in fade-in">
                <div className={`flex p-1 rounded-xl border transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <button onClick={() => setReportType('monthly')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'monthly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>মাসিক</button>
                    <button onClick={() => setReportType('yearly')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'yearly' ? (isDark ? 'bg-slate-800 text-[#2563EB] shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>বাৎসরিক</button>
                </div>
                
                <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">
                        {reportType === 'monthly' ? 'মাস নির্বাচন করুন' : 'বছর নির্বাচন করুন'}
                    </label>
                    {reportType === 'monthly' ? (
                        <div className="relative"><input type="month" className={`w-full h-14 pl-14 pr-6 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /><BarChart3 className="absolute left-5 top-4 text-[#2563EB]" size={22}/></div>
                    ) : (
                        <div className="relative">
                            <select className={`w-full h-14 pl-14 pr-6 border-2 rounded-2xl font-black outline-none focus:border-[#2563EB]/20 transition-all appearance-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <Calendar className="absolute left-5 top-4 text-[#2563EB]" size={22}/>
                            <ChevronDown className="absolute right-5 top-4 text-slate-400 pointer-events-none" size={20}/>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {fetchError && (
        <div className="p-5 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-600 shadow-sm animate-in shake duration-500">
           <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><AlertCircle size={24} /></div>
           <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider">টেকনিক্যাল এরর!</p>
              <p className="text-[11px] font-bold opacity-80 leading-relaxed">{fetchError}</p>
           </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Data...</p>
        </div>
      ) : (
          <>
            {activeTab === 'daily' ? (
              isHoliday ? (
                <div className={`p-10 border-2 border-dashed rounded-[3rem] flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-500 ${isDark ? 'bg-slate-900 border-slate-700 shadow-slate-950/50' : 'bg-amber-50 border-amber-200 shadow-amber-900/5'}`}>
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
                    <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner border ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-amber-100 text-amber-600 border-amber-200'}`}>
                      <AlertTriangle size={40} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-amber-900'}`}>আজ হাজিরা বন্ধ</h3>
                    <p className={`text-sm font-bold max-w-[250px] ${isDark ? 'text-slate-400' : 'text-amber-700/70'}`}>
                      {dayEvents.map(e => e.title).join(', ') || 'আজকের দিনে বিশেষ ইভেন্ট বা ছুটি রয়েছে।'}
                    </p>
                    <p className={`text-[10px] font-black uppercase tracking-widest pt-2 ${isDark ? 'text-blue-400' : 'text-amber-400'}`}>ক্যালেন্ডার অনুযায়ী আজ হাজিরা গ্রহণ করা সম্ভব নয়</p>
                  </div>
                </div>
              ) : students.length > 0 ? (
                <div className="space-y-3 animate-in slide-in-from-bottom-5">
                   <div className="flex items-center justify-between px-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ছাত্র তালিকা</h4>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">উপস্থিতি</h4>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                   {students.map(s => (
                     <div key={s.id} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-11 h-11 rounded-[1.1rem] flex flex-col items-center justify-center border shrink-0 shadow-inner ${isDark ? 'bg-slate-900 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}>
                            <span className="text-[8px] font-black opacity-40 leading-none">ROLL</span>
                            <span className="text-base font-black leading-none mt-1">{s.roll || '-'}</span>
                          </div>
                          <h5 className={`font-black font-noto text-sm ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{s.student_name}</h5>
                        </div>
                        <div className="flex gap-2 shrink-0">
                           <button onClick={() => setStatus(s.id, 'present')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'present' ? 'bg-emerald-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Present"><CheckCircle size={18}/></button>
                           <button onClick={() => setStatus(s.id, 'absent')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Absent"><XCircle size={18}/></button>
                           <button onClick={() => setStatus(s.id, 'late')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'late' ? 'bg-amber-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Late"><Clock size={18}/></button>
                           <button onClick={() => setStatus(s.id, 'half_day')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${attendance[s.id] === 'half_day' ? 'bg-purple-500 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-600 border border-slate-700' : 'bg-slate-50 text-slate-300')}`} title="Half Day"><span className="text-[10px] font-black">1/2</span></button>
                        </div>
                     </div>
                   ))}
                   </div>
                   <div className="flex flex-col gap-4 mt-8">
                        <button 
                          onClick={() => {
                            if (!isOnline) {
                              alert("Internet required to save attendance.");
                              return;
                            }
                            handleSave();
                          }} 
                          disabled={saving || !isOnline} 
                          className={`w-full h-16 font-black rounded-full flex items-center justify-center gap-3 text-lg active:scale-95 transition-all ${!isOnline ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-[#2563EB] text-white shadow-premium'}`}
                        >
                            {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} strokeWidth={3} /> {t('save', lang)}</>}
                        </button>
                        
                        <div className="flex items-center gap-3">
                           <button 
                             onClick={() => {
                               if (!isOnline) {
                                 alert("Internet required to send SMS.");
                                 return;
                               }
                               sendAbsentAlerts();
                             }} 
                             disabled={sendingAlerts || !isOnline} 
                             className={`flex-1 h-14 font-black rounded-full flex items-center justify-center gap-3 text-[13px] active:scale-95 transition-all border uppercase tracking-widest shadow-sm ${!isOnline ? 'bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed' : isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}
                           >
                               {sendingAlerts ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} className={isDark ? 'text-blue-400/60' : 'text-[#2563EB]/60'} /> {t('absent_alert', lang)}</>}
                           </button>
                           <button 
                             onClick={() => setShowShortcodes(!showShortcodes)}
                             className={`w-14 h-14 rounded-2xl flex items-center justify-center border active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                           >
                             <Info size={24} />
                           </button>
                        </div>

                        {showShortcodes && (
                           <div className={`p-4 rounded-2xl border animate-in slide-in-from-top-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50/50 border-blue-100/50'}`}>
                             <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`}>Available Shortcodes:</p>
                             <div className="flex flex-wrap gap-2">
                               {availableShortcodes.map(sc => (
                                 <div key={sc.code} className={`px-3 py-1.5 border rounded-xl text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-blue-100 text-[#1E3A8A]'}`}>
                                   {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                        )}
                   </div>
                </div>
              ) : <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                    <Users size={40} className="text-slate-400/20 mb-4" />
                    <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">{selectedClass ? 'No Students Found' : 'Please select a class'}</p>
                  </div>
            ) : (
              <div>
                <div className="flex gap-2 mb-6">
                  <button onClick={() => setReportView('list')} className={`flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${reportView === 'list' ? 'bg-[#2563EB] text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>List View</button>
                  <button onClick={() => setReportView('analytics')} className={`flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${reportView === 'analytics' ? 'bg-[#2563EB] text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Analytics</button>
                </div>

                {reportView === 'analytics' ? (
                <div className="space-y-6 animate-in fade-in">
                  {reportData.length > 0 ? (
                    <>
                      <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          <BarChart3 className="text-[#2563EB]" size={18} />
                          Attendance Overview
                        </h3>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.map(d => ({ name: d.roll || d.student_name.substring(0, 5), Present: d.present_days, Absent: d.absent_days, Late: d.late_days || 0, HalfDay: d.half_days || 0 }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <Tooltip cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                              <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                              <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                              <Bar dataKey="HalfDay" stackId="a" fill="#a855f7" />
                              <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          <TrendingDown className="text-red-500" size={18} />
                          Most Absent Students
                        </h3>
                        <div className="space-y-3">
                          {[...reportData].sort((a, b) => b.absent_days - a.absent_days).slice(0, 5).map((student, idx) => (
                            <div key={student.student_id} className={`flex items-center justify-between p-3 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-black text-xs">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className={`font-black text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{student.student_name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Roll: {student.roll || '-'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-red-500">{student.absent_days} Days</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Absent</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                      <BarChart3 size={40} className="text-slate-400/20 mb-4" />
                      <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">No Data for Analytics</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 animate-in slide-in-from-bottom-5">
                    {reportData.length > 0 ? reportData.map((item: any) => {
                        const late = item.late_days || (item.total_days - item.present_days - item.absent_days - (item.half_days || 0));
                        const pct = item.total_days > 0 ? Math.round(((item.present_days + late + (item.half_days || 0) * 0.5) / item.total_days) * 100) : 0;
                        const latePct = item.total_days > 0 ? Math.round((late / item.total_days) * 100) : 0;
                        const halfDayPct = item.total_days > 0 ? Math.round(((item.half_days || 0) / item.total_days) * 100) : 0;
                        
                        return (
                            <div key={item.student_id} className={`p-6 rounded-[2.5rem] border shadow-lg space-y-4 group ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/95 border-white'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black border shadow-inner shrink-0 ${isDark ? 'bg-slate-900 text-[#A179FF] border-slate-700' : 'bg-slate-50 text-[#A179FF] border-slate-100'}`}>#{item.roll || '-'}</div>
                                        <div className="min-w-0">
                                            <h5 className={`font-black font-noto text-[17px] truncate leading-tight mb-0.5 ${isDark ? 'text-slate-100' : 'text-[#2E0B5E]'}`}>{item.student_name}</h5>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</p>
                                        </div>
                                    </div>
                                    <div className={`text-2xl font-black ${pct >= 90 ? 'text-green-500' : pct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</div>
                                </div>
                                <div className={`w-full h-3 rounded-full overflow-hidden border flex shadow-inner ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${pct}%` }}></div>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/50 border-slate-50'}`}><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Total</p><p className={`font-black text-sm ${isDark ? 'text-slate-100' : 'text-[#2E0B5E]'}`}>{item.total_days}</p></div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-green-900/10 border-green-900/20' : 'bg-green-50/50 border-green-50'}`}><p className="text-[8px] font-black text-green-400 uppercase mb-0.5">Present</p><p className="font-black text-green-600 text-sm">{item.present_days}</p></div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-red-900/10 border-red-900/20' : 'bg-red-50/50 border-red-50'}`}><p className="text-[8px] font-black text-red-400 uppercase mb-0.5">Absent</p><p className="font-black text-red-600 text-sm">{item.absent_days}</p></div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-amber-900/10 border-amber-900/20' : 'bg-amber-50/50 border-amber-50'}`}>
                                      <p className="text-[8px] font-black text-amber-400 uppercase mb-0.5">Late</p>
                                      <p className="font-black text-amber-600 text-sm">{late}</p>
                                   </div>
                                   <div className={`p-2.5 rounded-xl text-center border ${isDark ? 'bg-purple-900/10 border-purple-900/20' : 'bg-purple-50/50 border-purple-50'}`}>
                                      <p className="text-[8px] font-black text-purple-400 uppercase mb-0.5">Half</p>
                                      <p className="font-black text-purple-600 text-sm">{item.half_days || 0}</p>
                                   </div>
                                </div>
                            </div>
                        );
                    }) : <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed mx-2 flex flex-col items-center ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white/10 border-white/20'}`}>
                            <FileText size={40} className="text-slate-400/20 mb-4" />
                            <p className="text-slate-400/40 uppercase text-xs font-black tracking-[0.2em]">No Attendance Records</p>
                         </div>}
                </div>
              )}
              </div>
            )}
          </>
      )}
      
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className={`rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-50'}`}>
              <h2 className={`text-xl font-black flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                <Settings className="text-[#2563EB]" size={24} />
                Attendance Settings
              </h2>
              <button onClick={() => setShowSettingsModal(false)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-900/20' : 'bg-white text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Half Day Time</label>
                <input 
                  type="time" 
                  value={halfDayTime}
                  onChange={(e) => setHalfDayTime(e.target.value)}
                  className={`w-full h-14 px-5 border-2 rounded-2xl font-bold outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-[#2563EB]/30' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-[#2563EB]/30 focus:bg-white'}`}
                />
                <p className="text-[10px] text-slate-400 font-bold">Students arriving after this time will be marked as Half Day.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Full Day Time</label>
                <input 
                  type="time" 
                  value={fullDayTime}
                  onChange={(e) => setFullDayTime(e.target.value)}
                  className={`w-full h-14 px-5 border-2 rounded-2xl font-bold outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-[#2563EB]/30' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-[#2563EB]/30 focus:bg-white'}`}
                />
                <p className="text-[10px] text-slate-400 font-bold">Standard full day attendance time.</p>
              </div>
            </div>
            <div className={`p-6 border-t flex gap-3 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-50'}`}>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className={`flex-1 h-14 font-black rounded-xl border-2 active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                Cancel
              </button>
              <button 
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex-1 h-14 bg-[#2563EB] text-white font-black rounded-xl shadow-premium active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {savingSettings ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
