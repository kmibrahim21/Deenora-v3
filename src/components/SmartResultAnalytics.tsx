
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Language } from 'types';
import { t } from 'translations';
import { TrendingUp, TrendingDown, Award, AlertCircle, Loader2, User, ChevronRight, BarChart2, BookOpen, Users, ArrowUpRight, ArrowDownRight, Filter, Check, Search, Target, Activity } from 'lucide-react';
import { isValidUUID } from 'utils/validation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface SmartResultAnalyticsProps {
  institutionId: string;
  lang: Language;
  madrasah?: any;
}

const localT = {
  allClasses: { en: 'All Classes', bn: 'সকল ক্লাস' },
  selectClass: { en: 'Select Class', bn: 'ক্লাস নির্বাচন করুন' },
  filterByClass: { en: 'Filter by Class', bn: 'ক্লাস অনুযায়ী ফিল্টার' },
  searchClass: { en: 'Search class...', bn: 'ক্লাস খুঁজুন...' },
  noClassesFound: { en: 'No classes found', bn: 'কোনো ক্লাস পাওয়া যায়নি' },
  overallAverage: { en: 'Overall Average', bn: 'সর্বমোট গড়' },
  passRate: { en: 'Pass Rate', bn: 'পাসের হার' },
  failRate: { en: 'Fail Rate', bn: 'ফেলের হার' },
  highestMarks: { en: 'Highest Marks', bn: 'সর্বোচ্চ নম্বর' },
  lowestMarks: { en: 'Lowest Marks', bn: 'সর্বনিম্ন নম্বর' },
  totalClasses: { en: 'Total Classes', bn: 'মোট ক্লাস' },
  topStudents: { en: 'Top Students', bn: 'সেরা শিক্ষার্থী' },
  classPerformance: { en: 'Class Performance', bn: 'ক্লাস পারফরম্যান্স' },
  noDataAvailable: { en: 'No data available', bn: 'কোনো তথ্য পাওয়া যায়নি' },
  subjectWeaknessDetection: { en: 'Subject Weakness Detection', bn: 'দুর্বল বিষয় শনাক্তকরণ' },
  noWeaknessDetected: { en: 'No weakness detected', bn: 'কোনো দুর্বলতা পাওয়া যায়নি' },
  topMovers: { en: 'Top Movers (Improvement/Decline)', bn: 'শীর্ষ পরিবর্তন (উন্নতি/অবনতি)' },
  notEnoughExamData: { en: 'Not enough exam data for comparison', bn: 'তুলনা করার জন্য পর্যাপ্ত পরীক্ষার তথ্য নেই' },
  studentsNeedingAttention: { en: 'Students Needing Attention', bn: 'যেসব শিক্ষার্থীর প্রতি মনোযোগ প্রয়োজন' },
  students: { en: 'Students', bn: 'শিক্ষার্থী' },
  avg: { en: 'Avg', bn: 'গড়' },
  failed: { en: 'Failed', bn: 'ফেল' },
  subjects: { en: 'Subjects', bn: 'বিষয়' },
  improvement: { en: 'Improvement', bn: 'উন্নতি' },
  decline: { en: 'Decline', bn: 'অবনতি' },
  points: { en: 'pts', bn: 'পয়েন্ট' },
  classRankings: { en: 'Class Rankings', bn: 'ক্লাস র‍্যাংকিং' },
  examTrends: { en: 'Exam Trends', bn: 'পরীক্ষার ট্রেন্ড' },
  subjectPerformance: { en: 'Subject Performance', bn: 'বিষয়ভিত্তিক পারফরম্যান্স' },
  roll: { en: 'Roll', bn: 'রোল' },
};

const SmartResultAnalytics: React.FC<SmartResultAnalyticsProps> = ({ institutionId, lang, madrasah }) => {
  const isDark = madrasah?.theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [analytics, setAnalytics] = useState<{
    classPerformance: any[];
    subjectWeakness: any[];
    improvementInsights: any[];
    overallAvg: number;
    topStudents: any[];
    weakStudents: any[];
    passRate: number;
    failRate: number;
    highestMarks: number;
    lowestMarks: number;
    subjectPerformance: any[];
    examTrends: any[];
    classRankings: any[];
  }>({
    classPerformance: [],
    subjectWeakness: [],
    improvementInsights: [],
    overallAvg: 0,
    topStudents: [],
    weakStudents: [],
    passRate: 0,
    failRate: 0,
    highestMarks: 0,
    lowestMarks: 0,
    subjectPerformance: [],
    examTrends: [],
    classRankings: []
  });

  useEffect(() => {
    fetchClasses();
  }, [institutionId]);

  useEffect(() => {
    fetchAnalytics();
  }, [institutionId, selectedClassId]);

  const fetchClasses = async () => {
    if (!isValidUUID(institutionId)) return;
    const { data } = await supabase.from('classes').select('*').eq('institution_id', institutionId);
    if (data) setClasses(data);
  };

  const fetchAnalytics = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    try {
        const isBefaq = madrasah?.config_json?.result_engine === 'befaq';
        const examTable = isBefaq ? 'befaq_exams' : 'exams';
        const subjectTable = isBefaq ? 'befaq_subjects' : 'exam_subjects';
        const marksTable = isBefaq ? 'befaq_results' : 'exam_marks';
        const classIdField = isBefaq ? 'marhala_id' : 'class_id';

        // Fetch Exams
        let examQuery = supabase.from(examTable).select('*').eq('institution_id', institutionId).order(isBefaq ? 'created_at' : 'exam_date', { ascending: true });
        if (selectedClassId !== 'all') {
            examQuery = examQuery.eq(classIdField, selectedClassId);
        }
        const { data: exams } = await examQuery;
        
        if (!exams || exams.length === 0) {
            setAnalytics({
                classPerformance: [],
                subjectWeakness: [],
                improvementInsights: [],
                overallAvg: 0,
                topStudents: [],
                weakStudents: [],
                passRate: 0,
                failRate: 0,
                highestMarks: 0,
                lowestMarks: 0,
                subjectPerformance: [],
                examTrends: [],
                classRankings: []
            });
            setLoading(false);
            return;
        }

        const examIds = exams.map(e => e.id);

        // Fetch Subjects
        const { data: subjects } = await supabase.from(subjectTable).select('*').in('exam_id', examIds);
        
        // Fetch Marks
        const { data: marks } = await supabase.from(marksTable).select('*').in('exam_id', examIds);

        // Fetch Students
        let studentQuery = supabase.from('students').select('id, student_name, roll, class_id').eq('institution_id', institutionId);
        if (selectedClassId !== 'all') {
            studentQuery = studentQuery.eq('class_id', selectedClassId);
        }
        const { data: students } = await studentQuery;

        if (!marks || !subjects || !students) {
             setLoading(false);
             return;
        }

        // --- Process Class Performance ---
        const classPerformance: any[] = [];
        let totalOverallPercentage = 0;
        let totalOverallCount = 0;

        const classesToProcess = selectedClassId === 'all' ? classes : classes.filter(c => c.id === selectedClassId);

        classesToProcess.forEach(cls => {
            const classExams = exams.filter(e => e[classIdField] === cls.id);
            const classExamIds = classExams.map(e => e.id);
            const classMarks = marks.filter(m => classExamIds.includes(m.exam_id));
            
            if (classMarks.length > 0) {
                let totalPercentage = 0;
                let count = 0;
                
                classMarks.forEach(m => {
                    const subject = subjects.find(s => s.id === m.subject_id);
                    if (subject) {
                        const fullMarks = isBefaq ? (subject.total_marks || 100) : (subject.full_marks || 100);
                        const pct = (parseFloat(m.marks_obtained as any) / fullMarks) * 100;
                        totalPercentage += pct;
                        count++;
                        
                        totalOverallPercentage += pct;
                        totalOverallCount++;
                    }
                });
                
                const avg = count > 0 ? totalPercentage / count : 0;
                classPerformance.push({
                    class_name: cls.class_name,
                    average: avg.toFixed(1),
                    student_count: students.filter(s => s.class_id === cls.id).length
                });
            }
        });

        // --- Process Subject Weakness ---
        const subjectStats: Record<string, { total: number, count: number }> = {};
        marks.forEach(m => {
            const subject = subjects.find(s => s.id === m.subject_id);
            if (subject) {
                const name = subject.subject_name.trim();
                if (!subjectStats[name]) subjectStats[name] = { total: 0, count: 0 };
                
                const fullMarks = isBefaq ? (subject.total_marks || 100) : (subject.full_marks || 100);
                subjectStats[name].total += (parseFloat(m.marks_obtained as any) / fullMarks) * 100;
                subjectStats[name].count++;
            }
        });
        
        const subjectWeakness = Object.entries(subjectStats)
            .map(([name, stats]) => ({ name, average: stats.total / stats.count }))
            .sort((a, b) => a.average - b.average)
            .slice(0, 5);

        // --- Process Improvement ---
        const studentPerformance: Record<string, { exam_date: string, average: number }[]> = {};
        
        students.forEach(std => {
            const stdMarks = marks.filter(m => m.student_id === std.id);
            const stdExams = [...new Set(stdMarks.map(m => m.exam_id))];
            
            const examAvgs: { exam_date: string, average: number }[] = [];
            
            stdExams.forEach(eid => {
                const exam = exams.find(e => e.id === eid);
                const mks = stdMarks.filter(m => m.exam_id === eid);
                
                let total = 0;
                let count = 0;
                mks.forEach(m => {
                    const sub = subjects.find(s => s.id === m.subject_id);
                    if (sub) {
                        const fullMarks = isBefaq ? (sub.total_marks || 100) : (sub.full_marks || 100);
                        total += (m.marks_obtained / fullMarks) * 100;
                        count++;
                    }
                });
                
                if (exam && count > 0) {
                    examAvgs.push({
                        exam_date: isBefaq ? exam.created_at : exam.exam_date,
                        average: total / count
                    });
                }
            });
            
            examAvgs.sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
            studentPerformance[std.id] = examAvgs;
        });

        const improvementInsights: any[] = [];
        students.forEach(std => {
            const perfs = studentPerformance[std.id];
            if (perfs && perfs.length >= 2) {
                const current = perfs[perfs.length - 1];
                const prev = perfs[perfs.length - 2];
                const change = current.average - prev.average;
                
                improvementInsights.push({
                    student_name: std.student_name,
                    class_name: classes.find(c => c.id === std.class_id)?.class_name,
                    roll: std.roll,
                    current_avg: current.average.toFixed(1),
                    change: parseFloat(change.toFixed(1)),
                    status: change >= 0 ? 'improving' : 'declining'
                });
            }
        });
        
        improvementInsights.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        // --- Process Top & Weak Students (Based on latest exam) ---
        const latestExamId = exams[exams.length - 1]?.id;
        const latestMarks = marks.filter(m => m.exam_id === latestExamId);
        const studentAverages: { id: string, name: string, roll: number, className: string, average: number, totalMarks: number }[] = [];
        
        let passedCount = 0;
        let failedCount = 0;
        let highest = 0;
        let lowest = 100;

        students.forEach(std => {
            const stdMarks = latestMarks.filter(m => m.student_id === std.id);
            if (stdMarks.length > 0) {
                let total = 0;
                let count = 0;
                let hasFailed = false;

                stdMarks.forEach(m => {
                    const sub = subjects.find(s => s.id === m.subject_id);
                    if (sub) {
                        const fullMarks = isBefaq ? (sub.total_marks || 100) : (sub.full_marks || 100);
                        const passMarks = isBefaq ? (sub.passing_marks || 33) : (sub.pass_marks || 33);
                        const pct = (parseFloat(m.marks_obtained as any) / fullMarks) * 100;
                        total += pct;
                        count++;
                        if (parseFloat(m.marks_obtained as any) < passMarks) hasFailed = true;
                    }
                });

                if (count > 0) {
                    const avg = total / count;
                    studentAverages.push({
                        id: std.id,
                        name: std.student_name,
                        roll: std.roll,
                        className: classes.find(c => c.id === std.class_id)?.class_name || '',
                        average: avg,
                        totalMarks: total
                    });

                    if (hasFailed) failedCount++;
                    else passedCount++;

                    if (avg > highest) highest = avg;
                    if (avg < lowest) lowest = avg;
                }
            }
        });

        studentAverages.sort((a, b) => b.average - a.average);
        const topStudents = studentAverages.slice(0, 5);
        const weakStudents = [...studentAverages].reverse().slice(0, 5);
        const totalStudentsWithMarks = passedCount + failedCount;
        const passRate = totalStudentsWithMarks > 0 ? (passedCount / totalStudentsWithMarks) * 100 : 0;
        const failRate = totalStudentsWithMarks > 0 ? (failedCount / totalStudentsWithMarks) * 100 : 0;

        // --- Process Subject Performance (For Graph) ---
        const subjectPerformance = Object.entries(subjectStats).map(([name, stats]) => {
            const avg = stats.total / stats.count;
            return {
                name: name.length > 10 ? name.substring(0, 10) + '...' : name,
                average: parseFloat(avg.toFixed(1)),
                passRate: 100 // Mock pass rate for now, can be calculated if needed
            };
        });

        // --- Process Exam Trends (For Graph) ---
        const examTrends = exams.map(exam => {
            const examMarks = marks.filter(m => m.exam_id === exam.id);
            let total = 0;
            let count = 0;
            examMarks.forEach(m => {
                const sub = subjects.find(s => s.id === m.subject_id);
                if (sub) {
                    const fullMarks = isBefaq ? (sub.total_marks || 100) : (sub.full_marks || 100);
                    total += (parseFloat(m.marks_obtained as any) / fullMarks) * 100;
                    count++;
                }
            });
            return {
                name: exam.exam_name,
                average: count > 0 ? parseFloat((total / count).toFixed(1)) : 0
            };
        }).filter(e => e.average > 0);

        // --- Process Class Rankings ---
        const classRankings: any[] = [];
        classes.forEach(cls => {
            const classStudents = studentAverages.filter(s => s.className === cls.class_name);
            if (classStudents.length > 0) {
                classRankings.push({
                    className: cls.class_name,
                    topStudents: classStudents.slice(0, 3)
                });
            }
        });

        setAnalytics({
            classPerformance: classPerformance.sort((a, b) => parseFloat(b.average) - parseFloat(a.average)),
            subjectWeakness,
            improvementInsights: improvementInsights.slice(0, 5),
            overallAvg: totalOverallCount > 0 ? totalOverallPercentage / totalOverallCount : 0,
            topStudents,
            weakStudents,
            passRate,
            failRate,
            highestMarks: highest === 100 && totalStudentsWithMarks === 0 ? 0 : highest,
            lowestMarks: lowest === 100 && totalStudentsWithMarks === 0 ? 0 : lowest,
            subjectPerformance,
            examTrends,
            classRankings
        });

    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Filter */}
      <div className="flex justify-end relative z-30">
        <button 
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 text-xs font-black transition-all active:scale-95 shadow-sm ${
                isDark 
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-[#2563EB]'
            }`}
        >
            <Filter size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <span>{selectedClassId === 'all' ? localT.allClasses[lang] : classes.find(c => c.id === selectedClassId)?.class_name || localT.selectClass[lang]}</span>
            <ChevronRight size={14} className={`${isDark ? 'text-slate-500' : 'text-slate-400'} transition-transform duration-300 ${showFilter ? 'rotate-90' : ''}`} />
        </button>

        {showFilter && (
            <>
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setShowFilter(false)}></div>
                <div className={`absolute top-full right-0 mt-2 w-72 rounded-[2rem] shadow-2xl border p-4 z-50 animate-in zoom-in-95 origin-top-right ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                    <div className="mb-3 px-2">
                        <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.filterByClass[lang]}</h4>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder={localT.searchClass[lang]} 
                                className={`w-full h-9 rounded-xl pl-9 pr-3 text-xs font-bold outline-none border transition-all ${
                                    isDark 
                                    ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-blue-500' 
                                    : 'bg-slate-50 border-transparent focus:border-blue-100 focus:bg-blue-50/50'
                                }`}
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        <button 
                            onClick={() => { setSelectedClassId('all'); setShowFilter(false); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${
                                selectedClassId === 'all' 
                                ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-900/20' 
                                : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span>{localT.allClasses[lang]}</span>
                            {selectedClassId === 'all' && <Check size={14} className="text-white" />}
                        </button>
                        
                        {classes.filter(c => c.class_name.toLowerCase().includes(filterSearch.toLowerCase())).map(c => (
                            <button 
                                key={c.id}
                                onClick={() => { setSelectedClassId(c.id); setShowFilter(false); }}
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${
                                    selectedClassId === c.id 
                                    ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-900/20' 
                                    : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <span>{c.class_name}</span>
                                {selectedClassId === c.id && <Check size={14} className="text-white" />}
                            </button>
                        ))}
                        {classes.filter(c => c.class_name.toLowerCase().includes(filterSearch.toLowerCase())).length === 0 && (
                            <div className="text-center py-4 text-[10px] font-bold text-slate-400">{localT.noClassesFound[lang]}</div>
                        )}
                    </div>
                </div>
            </>
        )}
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1E3A8A] p-5 rounded-[2rem] text-white shadow-premium relative overflow-hidden col-span-2 lg:col-span-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                <Award size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">{localT.overallAverage[lang]}</span>
                </div>
                <h2 className="text-4xl font-black font-noto">{analytics.overallAvg.toFixed(1)}%</h2>
            </div>
        </div>

        <div className="bg-emerald-500 p-5 rounded-[2rem] text-white shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-2xl -mr-5 -mt-5"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                <Check size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{localT.passRate[lang]}</span>
                </div>
                <h2 className="text-2xl font-black font-noto">{analytics.passRate.toFixed(1)}%</h2>
            </div>
        </div>

        <div className="bg-red-500 p-5 rounded-[2rem] text-white shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-2xl -mr-5 -mt-5"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                <AlertCircle size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{localT.failRate[lang]}</span>
                </div>
                <h2 className="text-2xl font-black font-noto">{analytics.failRate.toFixed(1)}%</h2>
            </div>
        </div>

        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.highestMarks[lang]}</span>
            <span className={`text-xl font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{analytics.highestMarks.toFixed(1)}%</span>
        </div>

        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.lowestMarks[lang]}</span>
            <span className="text-xl font-black text-red-500">{analytics.lowestMarks.toFixed(1)}%</span>
        </div>

        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.totalClasses[lang]}</span>
            <span className={`text-xl font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{analytics.classPerformance.length}</span>
        </div>

        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.topStudents[lang]}</span>
            <span className="text-xl font-black text-emerald-500">{analytics.topStudents.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* Class Performance */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <BarChart2 size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.classPerformance[lang]}</h3>
         </div>
         <div className="grid grid-cols-1 gap-3">
            {analytics.classPerformance.map((cls, idx) => (
               <div key={idx} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between ${
                   isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
               }`}>
                  <div>
                     <h4 className={`font-black text-sm ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{cls.class_name}</h4>
                     <p className={`text-[9px] font-bold flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Users size={10}/> {cls.student_count} {localT.students[lang]}</p>
                  </div>
                  <div className="text-right">
                     <span className={`text-lg font-black ${parseFloat(cls.average) >= 80 ? 'text-emerald-500' : parseFloat(cls.average) >= 60 ? 'text-blue-500' : 'text-orange-500'}`}>
                        {cls.average}%
                     </span>
                  </div>
               </div>
            ))}
            {analytics.classPerformance.length === 0 && <div className="text-center py-6 text-slate-400 text-xs font-bold">{localT.noDataAvailable[lang]}</div>}
         </div>
      </div>

      {/* Subject Weakness */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <AlertCircle size={16} className="text-red-400" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.subjectWeaknessDetection[lang]}</h3>
         </div>
         <div className={`p-5 rounded-[2rem] border shadow-bubble ${
             isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
         }`}>
            <div className="space-y-4">
               {analytics.subjectWeakness.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                         isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-500'
                     }`}>
                        {idx + 1}
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between mb-1">
                           <span className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{sub.name}</span>
                           <span className="text-xs font-black text-red-500">{sub.average.toFixed(1)}%</span>
                        </div>
                        <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                           <div className="h-full bg-red-500 rounded-full" style={{ width: `${sub.average}%` }}></div>
                        </div>
                     </div>
                  </div>
               ))}
               {analytics.subjectWeakness.length === 0 && <div className="text-center py-4 text-slate-400 text-xs font-bold">{localT.noWeaknessDetected[lang]}</div>}
            </div>
         </div>
      </div>

      {/* Improvement Tracking */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.topMovers[lang]}</h3>
         </div>
         <div className="space-y-3">
            {analytics.improvementInsights.map((item, idx) => (
               <div key={idx} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between ${
                   isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
               }`}>
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                         item.status === 'improving' 
                         ? (isDark ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500') 
                         : (isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-500')
                     }`}>
                        {item.status === 'improving' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                     </div>
                     <div>
                        <h4 className={`font-black text-sm font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{item.student_name}</h4>
                        <p className={`text-[9px] font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.class_name}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <span className={`text-sm font-black ${item.status === 'improving' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.change > 0 ? '+' : ''}{item.change}%
                     </span>
                     <p className={`text-[9px] font-bold ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{localT.avg[lang]}: {item.current_avg}%</p>
                  </div>
               </div>
            ))}
            {analytics.improvementInsights.length === 0 && <div className="text-center py-6 text-slate-400 text-xs font-bold">{localT.notEnoughExamData[lang]}</div>}
         </div>
      </div>

      {/* Trend Analysis */}
      {analytics.examTrends.length > 0 && (
          <div className="space-y-3">
             <div className="flex items-center gap-2 px-2">
                <Activity size={16} className="text-blue-500" />
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.examTrends[lang]}</h3>
             </div>
             <div className={`p-5 rounded-[2rem] border shadow-bubble h-64 ${
                 isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
             }`}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.examTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', 
                                fontWeight: 'bold', 
                                fontSize: '12px',
                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                color: isDark ? '#f1f5f9' : '#1e293b'
                            }}
                            itemStyle={{ color: isDark ? '#60a5fa' : '#1E3A8A' }}
                        />
                        <Line type="monotone" dataKey="average" stroke="#2563EB" strokeWidth={4} dot={{ r: 6, fill: '#2563EB', strokeWidth: 2, stroke: isDark ? '#1e293b' : '#fff' }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
      )}

      {/* Subject Performance */}
      {analytics.subjectPerformance.length > 0 && (
          <div className="space-y-3 xl:col-span-2">
             <div className="flex items-center gap-2 px-2">
                <BookOpen size={16} className="text-indigo-500" />
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.subjectPerformance[lang]}</h3>
             </div>
             <div className={`p-5 rounded-[2rem] border shadow-bubble h-64 ${
                 isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
             }`}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.subjectPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                        <Tooltip 
                            cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                            contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', 
                                fontWeight: 'bold', 
                                fontSize: '12px',
                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                color: isDark ? '#f1f5f9' : '#1e293b'
                            }}
                        />
                        <Bar dataKey="average" fill="#818cf8" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
      )}

      {/* Top Students */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <Target size={16} className="text-emerald-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.topStudents[lang]}</h3>
         </div>
         <div className="grid grid-cols-1 gap-3">
            {analytics.topStudents.map((std, idx) => (
               <div key={idx} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between ${
                   isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
               }`}>
                  <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                         isDark ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                     }`}>
                        {idx + 1}
                     </div>
                     <div>
                        <h4 className={`font-black text-sm ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{std.name}</h4>
                        <p className={`text-[9px] font-bold flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{std.className} • {localT.roll[lang]}: {std.roll}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <span className="text-lg font-black text-emerald-500">
                        {std.average.toFixed(1)}%
                     </span>
                  </div>
               </div>
            ))}
            {analytics.topStudents.length === 0 && <div className="text-center py-6 text-slate-400 text-xs font-bold">{localT.noDataAvailable[lang]}</div>}
         </div>
      </div>

      {/* Weak Students */}
      <div className="space-y-3">
         <div className="flex items-center gap-2 px-2">
            <AlertCircle size={16} className="text-red-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.studentsNeedingAttention[lang]}</h3>
         </div>
         <div className="grid grid-cols-1 gap-3">
            {analytics.weakStudents.map((std, idx) => (
               <div key={idx} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between ${
                   isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
               }`}>
                  <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                         isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-500'
                     }`}>
                        {idx + 1}
                     </div>
                     <div>
                        <h4 className={`font-black text-sm ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{std.name}</h4>
                        <p className={`text-[9px] font-bold flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{std.className} • {localT.roll[lang]}: {std.roll}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <span className="text-lg font-black text-red-500">
                        {std.average.toFixed(1)}%
                     </span>
                  </div>
               </div>
            ))}
            {analytics.weakStudents.length === 0 && <div className="text-center py-6 text-slate-400 text-xs font-bold">{localT.noDataAvailable[lang]}</div>}
         </div>
      </div>

      {/* Class Rankings */}
      {analytics.classRankings.length > 0 && (
          <div className="space-y-3 xl:col-span-2">
             <div className="flex items-center gap-2 px-2">
                <Award size={16} className="text-amber-500" />
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.classRankings[lang]}</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {analytics.classRankings.map((clsRank, idx) => (
                   <div key={idx} className={`p-5 rounded-[2rem] border shadow-bubble ${
                       isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                   }`}>
                      <h4 className={`font-black text-sm mb-3 border-b pb-2 ${
                          isDark ? 'text-blue-400 border-slate-700' : 'text-[#1E3A8A] border-slate-100'
                      }`}>{clsRank.className}</h4>
                      <div className="space-y-3">
                          {clsRank.topStudents.map((std: any, sIdx: number) => (
                              <div key={sIdx} className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                                          sIdx === 0 
                                          ? (isDark ? 'bg-amber-900/20 text-amber-400' : 'bg-amber-100 text-amber-600') 
                                          : sIdx === 1 
                                          ? (isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-600') 
                                          : (isDark ? 'bg-orange-900/20 text-orange-400' : 'bg-orange-50 text-orange-600')
                                      }`}>
                                          #{sIdx + 1}
                                      </div>
                                      <div>
                                          <p className={`font-bold text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{std.name}</p>
                                          <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.roll[lang]}: {std.roll}</p>
                                      </div>
                                  </div>
                                  <span className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{std.average.toFixed(1)}%</span>
                              </div>
                          ))}
                      </div>
                   </div>
                ))}
             </div>
          </div>
      )}
      </div>
    </div>
  );
};

export default SmartResultAnalytics;
