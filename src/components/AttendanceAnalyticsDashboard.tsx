import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, Class } from 'types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingDown, Calendar, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { sortMadrasahClasses } from 'pages/Classes';

interface Props {
  institutionId: string;
  lang: Language;
  madrasah: Institution | null;
}

const AttendanceAnalyticsDashboard: React.FC<Props> = ({ institutionId, lang, madrasah }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (institutionId) {
      fetchClasses();
    }
  }, [institutionId]);

  useEffect(() => {
    if (selectedClass) {
      fetchReport(selectedClass.id);
    }
  }, [selectedClass?.id, reportType, selectedMonth, selectedYear]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', institutionId);
    if (data) {
      const sorted = sortMadrasahClasses(data);
      setClasses(sorted);
      if (sorted.length > 0) {
        setSelectedClass(sorted[0]);
      }
    }
  };

  const fetchReport = async (cid: string) => {
    setLoading(true);
    setFetchError(null);
    try {
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
      if (data) setReportData(data);
    } catch (e: any) { 
      console.error(e);
      setFetchError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 px-1">
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-[1.8rem] border shadow-bubble space-y-4`}>
        <div className="relative">
          <button onClick={() => setShowClassDropdown(!showClassDropdown)} className={`w-full h-12 px-4 rounded-xl border-2 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'} flex items-center justify-between group active:scale-[0.99] transition-all`}>
            <span className="font-black font-noto truncate text-sm">{selectedClass?.class_name || (lang === 'bn' ? 'ক্লাস নির্বাচন করুন' : 'Select Class')}</span>
            <ChevronDown size={18} className="text-slate-400 transition-transform duration-300 group-focus:rotate-180" />
          </button>
          {showClassDropdown && (
            <div className={`absolute top-full left-0 right-0 mt-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-2xl shadow-bubble border z-[100] p-2 max-h-56 overflow-y-auto animate-in slide-in-from-top-2`}>
              {classes.map(cls => (
                <button key={cls.id} onClick={() => { setSelectedClass(cls); setShowClassDropdown(false); }} className={`w-full text-left px-4 py-3 rounded-xl mb-1 transition-all ${selectedClass?.id === cls.id ? 'bg-[#2563EB] text-white shadow-md' : madrasah?.theme === 'dark' ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}>
                  <span className="font-black font-noto text-sm">{cls.class_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
            <button onClick={() => setReportType('monthly')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === 'monthly' ? 'bg-[#2563EB] text-white shadow-sm' : madrasah?.theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>{lang === 'bn' ? 'মাসিক' : 'Monthly'}</button>
            <button onClick={() => setReportType('yearly')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === 'yearly' ? 'bg-[#2563EB] text-white shadow-sm' : madrasah?.theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>{lang === 'bn' ? 'বাৎসরিক' : 'Yearly'}</button>
        </div>
        
        <div className="relative">
            {reportType === 'monthly' ? (
                <div className="relative"><input type="month" className={`w-full h-12 pl-12 pr-4 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'} border-2 rounded-xl font-black outline-none focus:border-[#2563EB]/50 transition-all text-sm`} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /><BarChart3 className="absolute left-4 top-3.5 text-[#2563EB]" size={18}/></div>
            ) : (
                <div className="relative">
                    <select className={`w-full h-12 pl-12 pr-4 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'} border-2 rounded-xl font-black outline-none focus:border-[#2563EB]/50 transition-all appearance-none text-sm`} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <Calendar className="absolute left-4 top-3.5 text-[#2563EB]" size={18}/>
                    <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={18}/>
                </div>
            )}
        </div>
      </div>

      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 shadow-sm">
           <AlertCircle size={20} className="shrink-0" />
           <p className="text-[10px] font-bold leading-relaxed">{fetchError}</p>
        </div>
      )}

      {loading ? (
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-[2rem] border shadow-bubble flex flex-col items-center justify-center gap-3`}>
          <Loader2 className="animate-spin text-[#2563EB]" size={24} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</span>
        </div>
      ) : reportData.length > 0 ? (
        <div className="space-y-4">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
              <BarChart3 className="text-[#2563EB]" size={16} />
              {lang === 'bn' ? 'হাজিরা ওভারভিউ' : 'Attendance Overview'}
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.map(d => ({ name: d.roll || d.student_name.substring(0, 5), Present: d.present_days, Absent: d.absent_days, Late: d.late_days || 0, HalfDay: d.half_days || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={madrasah?.theme === 'dark' ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: madrasah?.theme === 'dark' ? '#1e293b' : '#f8fafc' }} contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: madrasah?.theme === 'dark' ? '#0f172a' : '#fff', color: madrasah?.theme === 'dark' ? '#fff' : '#000', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="HalfDay" stackId="a" fill="#a855f7" />
                  <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
              <TrendingDown className="text-red-500" size={16} />
              {lang === 'bn' ? 'সর্বোচ্চ অনুপস্থিত শিক্ষার্থী' : 'Most Absent Students'}
            </h3>
            <div className="space-y-2">
              {[...reportData].sort((a, b) => b.absent_days - a.absent_days).slice(0, 5).map((student, idx) => (
                <div key={student.student_id} className={`flex items-center justify-between p-3 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'} rounded-2xl border`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center font-black text-[10px]">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className={`font-black text-xs ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{student.student_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Roll: {student.roll || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-red-500 text-xs">{student.absent_days} {lang === 'bn' ? 'দিন' : 'Days'}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} text-center py-12 rounded-[2rem] border shadow-bubble flex flex-col items-center`}>
          <BarChart3 size={32} className="text-slate-300 mb-3" />
          <p className="text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">{lang === 'bn' ? 'কোনো ডেটা নেই' : 'No Data for Analytics'}</p>
        </div>
      )}
    </div>
  );
};

export default AttendanceAnalyticsDashboard;
