import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from 'supabase';
import { Language } from 'types';
import { t } from 'translations';
import { 
  TrendingUp, 
  Award, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  BarChart2, 
  BookOpen, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Check, 
  Search, 
  Target, 
  Activity, 
  FileText,
  Calendar,
  Layers
} from 'lucide-react';
import { isValidUUID } from 'utils/validation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { requestManager } from 'services/RequestManager';
import { sortMadrasahClasses } from 'pages/Classes';

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
  allExams: { en: 'All Exams (Combined)', bn: 'সকল পরীক্ষা (সম্মিলিত)' },
  selectExam: { en: 'Select Exam', bn: 'নির্দিষ্ট পরীক্ষা নির্বাচন' },
  filterByExam: { en: 'Filter by Exam', bn: 'পরীক্ষা অনুযায়ী ফিল্টার' },
  searchExam: { en: 'Search exam...', bn: 'পরীক্ষা খুঁজুন...' },
  noExamsFound: { en: 'No exams found', bn: 'কোনো পরীক্ষা পাওয়া যায়নি' },
  examComparison: { en: 'Exam Comparison & Overview', bn: 'পরীক্ষাভিত্তিক তুলনামূলক বিশ্লেষণ' },
  viewExamDetails: { en: 'View Analysis', bn: 'বিশ্লেষণ দেখুন' },
  overallAverage: { en: 'Overall Average', bn: 'সর্বমোট গড়' },
  passRate: { en: 'Pass Rate', bn: 'পাসের হার' },
  failRate: { en: 'Fail Rate', bn: 'ফেলের হার' },
  highestMarks: { en: 'Highest Marks', bn: 'সর্বোচ্চ নম্বর' },
  lowestMarks: { en: 'Lowest Marks', bn: 'সর্বনিম্ন নম্বর' },
  totalClasses: { en: 'Classes with Data', bn: 'কার্যকর ক্লাস' },
  totalExams: { en: 'Total Exams', bn: 'মোট পরীক্ষা' },
  totalStudents: { en: 'Evaluated Students', bn: 'মূল্যায়িত শিক্ষার্থী' },
  topStudents: { en: 'Top Students', bn: 'সেরা শিক্ষার্থী' },
  classPerformance: { en: 'Class Performance', bn: 'ক্লাস পারফরম্যান্স' },
  noDataAvailable: { en: 'No result data found for this selection', bn: 'এই নির্বাচনে কোনো ফলাফল তথ্য পাওয়া যায়নি' },
  subjectWeaknessDetection: { en: 'Subject Weakness Detection', bn: 'দুর্বল বিষয় শনাক্তকরণ' },
  noWeaknessDetected: { en: 'No weakness detected (All subjects performing well)', bn: 'কোনো দুর্বল বিষয় শনাক্ত হয়নি (সব বিষয়ে সন্তোষজনক ফলাফল)' },
  topMovers: { en: 'Performance Shift (Improvement/Decline)', bn: 'পরীক্ষায় উন্নতি ও অবনতি (তুলনামূলক)' },
  notEnoughExamData: { en: 'Needs at least 2 exams to compare progress', bn: 'উন্নতি/অবনতি তুলনা করতে ক্লাসে অন্তত ২টি পরীক্ষা প্রয়োজন' },
  studentsNeedingAttention: { en: 'Students Needing Attention', bn: 'যেসব শিক্ষার্থীর প্রতি বিশেষ যত্ন প্রয়োজন' },
  students: { en: 'Students', bn: 'শিক্ষার্থী' },
  avg: { en: 'Avg', bn: 'গড়' },
  failed: { en: 'Failed', bn: 'ফেল' },
  passed: { en: 'Passed', bn: 'পাস' },
  subjects: { en: 'Subjects', bn: 'বিষয়' },
  improvement: { en: 'Improvement', bn: 'উন্নতি' },
  decline: { en: 'Decline', bn: 'অবনতি' },
  points: { en: 'pts', bn: 'পয়েন্ট' },
  classRankings: { en: 'Class Merit Rankings', bn: 'ক্লাসভিত্তিক মেধা তালিকা' },
  examTrends: { en: 'Exam-to-Exam Trends', bn: 'পরীক্ষাভিত্তিক অগ্রগতির ট্রেন্ড' },
  subjectPerformance: { en: 'Subject-wise Performance & Pass Rate', bn: 'বিষয়ভিত্তিক ফলাফল ও পাসের হার' },
  roll: { en: 'Roll', bn: 'রোল' },
  selectedScope: { en: 'Currently Viewing', bn: 'বর্তমান ভিউ' },
  allExamsNotice: { en: 'Showing aggregated analysis across all exams. You can select a single exam from the dropdown above.', bn: 'সকল পরীক্ষার সম্মিলিত বিশ্লেষণ প্রদর্শিত হচ্ছে। একক পরীক্ষার রিপোর্ট দেখতে উপরের ড্রপডাউন থেকে পরীক্ষা নির্বাচন করুন।' }
};

const SmartResultAnalytics: React.FC<SmartResultAnalyticsProps> = ({ institutionId, lang, madrasah }) => {
  const isDark = madrasah?.theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  // Filter States
  const [showClassFilter, setShowClassFilter] = useState(false);
  const [showExamFilter, setShowExamFilter] = useState(false);
  const [classFilterSearch, setClassFilterSearch] = useState('');
  const [examFilterSearch, setExamFilterSearch] = useState('');
  
  const [classes, setClasses] = useState<any[]>([]);
  const [allExams, setAllExams] = useState<any[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    totalEvaluatedStudents: number;
    totalExamsCount: number;
    subjectPerformance: any[];
    examTrends: any[];
    examComparisons: any[];
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
    totalEvaluatedStudents: 0,
    totalExamsCount: 0,
    subjectPerformance: [],
    examTrends: [],
    examComparisons: [],
    classRankings: []
  });

  useEffect(() => {
    fetchClasses();
  }, [institutionId]);

  useEffect(() => {
    fetchAnalytics();
  }, [institutionId, selectedClassId, selectedExamId]);

  const fetchClasses = async () => {
    if (!isValidUUID(institutionId)) return;
    try {
      const { data } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', institutionId).order('sort_order', { ascending: true }),
        `classes:${institutionId}`,
        30 * 60 * 1000 // 30 mins
      );
      if (data) setClasses(sortMadrasahClasses(data));
    } catch (e) {
      console.error('Error fetching classes in Analytics:', e);
    }
  };

  // Filter available exams according to currently selected class
  const classSpecificExams = useMemo(() => {
    const isBefaq = madrasah?.config_json?.result_engine === 'befaq';
    const classIdField = isBefaq ? 'marhala_id' : 'class_id';
    
    if (selectedClassId === 'all') {
      return allExams;
    }
    return allExams.filter(e => e[classIdField] === selectedClassId);
  }, [allExams, selectedClassId, madrasah]);

  const fetchAnalytics = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    try {
        const activeYearId = madrasah?.config_json?.active_academic_year_id;
        const isBefaq = madrasah?.config_json?.result_engine === 'befaq';
        const examTable = isBefaq ? 'befaq_exams' : 'exams';
        const subjectTable = isBefaq ? 'befaq_subjects' : 'exam_subjects';
        const marksTable = isBefaq ? 'befaq_results' : 'exam_marks';
        const classIdField = isBefaq ? 'marhala_id' : 'class_id';

        // 1. Fetch All Exams for Institution (using relaxed query to prevent missing exams with null academic_year_id)
        let examQuery = supabase
          .from(examTable)
          .select('*')
          .eq('institution_id', institutionId)
          .order(isBefaq ? 'created_at' : 'exam_date', { ascending: true });
        
        if (activeYearId) {
          examQuery = examQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
        }

        const { data: rawExams } = await examQuery;
        const examsList = rawExams || [];
        setAllExams(examsList);

        if (examsList.length === 0) {
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
                totalEvaluatedStudents: 0,
                totalExamsCount: 0,
                subjectPerformance: [],
                examTrends: [],
                examComparisons: [],
                classRankings: []
            });
            setLoading(false);
            return;
        }

        // Determine which exams are in the current scope
        let scopedExams = examsList;
        if (selectedClassId !== 'all') {
            scopedExams = scopedExams.filter(e => e[classIdField] === selectedClassId);
        }

        if (selectedExamId !== 'all') {
            scopedExams = scopedExams.filter(e => e.id === selectedExamId);
        }

        if (scopedExams.length === 0) {
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
                totalEvaluatedStudents: 0,
                totalExamsCount: 0,
                subjectPerformance: [],
                examTrends: [],
                examComparisons: [],
                classRankings: []
            });
            setLoading(false);
            return;
        }

        const scopedExamIds = scopedExams.map(e => e.id);

        // 2. Fetch Subjects and Marks for Scoped Exams
        const { data: rawSubjects } = await supabase.from(subjectTable).select('*').in('exam_id', scopedExamIds);
        const subjects = rawSubjects || [];

        const { data: rawMarks } = await supabase.from(marksTable).select('*').in('exam_id', scopedExamIds);
        const marks = rawMarks || [];

        // 3. Fetch Students
        let studentQuery = supabase.from('students').select('id, student_name, roll, class_id').eq('institution_id', institutionId);
        if (selectedClassId !== 'all') {
            studentQuery = studentQuery.eq('class_id', selectedClassId);
        }
        if (activeYearId) {
            studentQuery = studentQuery.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
        }
        const { data: rawStudents } = await studentQuery;
        const students = rawStudents || [];

        // 4. Calculate Exam Comparison List (for multi-exam visibility)
        const examComparisons: any[] = [];
        const examsToCompare = selectedClassId !== 'all' 
          ? examsList.filter(e => e[classIdField] === selectedClassId)
          : examsList;

        examsToCompare.forEach(exam => {
          const examMarks = marks.filter(m => m.exam_id === exam.id);
          const examSubjects = subjects.filter(s => s.exam_id === exam.id);
          const className = classes.find(c => c.id === exam[classIdField])?.class_name || '';

          const studentMarksMap: Record<string, { totalPct: number; count: number; failed: boolean }> = {};
          
          examMarks.forEach(m => {
            const sub = examSubjects.find(s => s.id === m.subject_id);
            if (!sub) return;
            const full = Number(isBefaq ? sub.total_marks : sub.full_marks) || 100;
            const pass = Number(isBefaq ? sub.passing_marks : sub.pass_marks) || 33;
            const obtained = Number(m.marks_obtained) || 0;
            const pct = (obtained / full) * 100;

            if (!studentMarksMap[m.student_id]) {
              studentMarksMap[m.student_id] = { totalPct: 0, count: 0, failed: false };
            }
            studentMarksMap[m.student_id].totalPct += pct;
            studentMarksMap[m.student_id].count++;
            if (obtained < pass) {
              studentMarksMap[m.student_id].failed = true;
            }
          });

          const stdAverages = Object.values(studentMarksMap).map(s => ({
            avg: s.count > 0 ? s.totalPct / s.count : 0,
            failed: s.failed
          }));

          if (stdAverages.length > 0) {
            const totalAvg = stdAverages.reduce((sum, s) => sum + s.avg, 0) / stdAverages.length;
            const passedCount = stdAverages.filter(s => !s.failed).length;
            const passRate = (passedCount / stdAverages.length) * 100;
            const highest = Math.max(...stdAverages.map(s => s.avg));
            const lowest = Math.min(...stdAverages.map(s => s.avg));

            examComparisons.push({
              id: exam.id,
              exam_name: exam.exam_name,
              class_id: exam[classIdField],
              class_name: className,
              date: exam.exam_date || exam.created_at?.substring(0, 10),
              student_count: stdAverages.length,
              subject_count: examSubjects.length,
              average: totalAvg,
              pass_rate: passRate,
              fail_rate: 100 - passRate,
              highest,
              lowest
            });
          }
        });

        // 5. Process Class Performance
        const classPerformance: any[] = [];
        let totalOverallPercentage = 0;
        let totalOverallCount = 0;

        const classesToProcess = selectedClassId === 'all' ? classes : classes.filter(c => c.id === selectedClassId);

        classesToProcess.forEach(cls => {
            const classExams = scopedExams.filter(e => e[classIdField] === cls.id);
            const classExamIds = classExams.map(e => e.id);
            const classMarks = marks.filter(m => classExamIds.includes(m.exam_id));
            
            if (classMarks.length > 0) {
                let totalPercentage = 0;
                let count = 0;
                
                classMarks.forEach(m => {
                    const subject = subjects.find(s => s.id === m.subject_id);
                    if (subject) {
                        const fullMarks = Number(isBefaq ? subject.total_marks : subject.full_marks) || 100;
                        const obtained = Number(m.marks_obtained) || 0;
                        const pct = (obtained / fullMarks) * 100;
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
                    student_count: students.filter(s => s.class_id === cls.id).length,
                    exam_count: classExams.length
                });
            }
        });

        // 6. Process Subject Weakness & Performance
        const subjectStats: Record<string, { total: number; count: number; passCount: number; failCount: number }> = {};
        
        marks.forEach(m => {
            const subject = subjects.find(s => s.id === m.subject_id);
            if (subject) {
                const name = (subject.subject_name || '').trim();
                if (!name) return;
                
                if (!subjectStats[name]) {
                  subjectStats[name] = { total: 0, count: 0, passCount: 0, failCount: 0 };
                }
                
                const fullMarks = Number(isBefaq ? subject.total_marks : subject.full_marks) || 100;
                const passMarks = Number(isBefaq ? subject.passing_marks : subject.pass_marks) || 33;
                const obtained = Number(m.marks_obtained) || 0;
                const pct = (obtained / fullMarks) * 100;

                subjectStats[name].total += pct;
                subjectStats[name].count++;
                if (obtained >= passMarks) {
                  subjectStats[name].passCount++;
                } else {
                  subjectStats[name].failCount++;
                }
            }
        });
        
        const subjectWeakness = Object.entries(subjectStats)
            .map(([name, stats]) => ({ 
              name, 
              average: stats.count > 0 ? stats.total / stats.count : 0,
              failCount: stats.failCount,
              totalStudents: stats.count
            }))
            .sort((a, b) => a.average - b.average)
            .slice(0, 5);

        const subjectPerformance = Object.entries(subjectStats).map(([name, stats]) => {
            const avg = stats.count > 0 ? stats.total / stats.count : 0;
            const pRate = stats.count > 0 ? (stats.passCount / stats.count) * 100 : 0;
            return {
                name: name.length > 14 ? name.substring(0, 14) + '...' : name,
                fullName: name,
                average: parseFloat(avg.toFixed(1)),
                passRate: parseFloat(pRate.toFixed(1))
            };
        });

        // 7. Process Improvement Insights across Multiple Exams
        const studentPerformance: Record<string, { exam_date: string; average: number }[]> = {};
        
        students.forEach(std => {
            const stdMarks = marks.filter(m => m.student_id === std.id);
            const stdExamIds = [...new Set(stdMarks.map(m => m.exam_id))];
            
            const examAvgs: { exam_date: string; average: number }[] = [];
            
            stdExamIds.forEach(eid => {
                const exam = examsList.find(e => e.id === eid);
                const mks = stdMarks.filter(m => m.exam_id === eid);
                
                let total = 0;
                let count = 0;
                mks.forEach(m => {
                    const sub = subjects.find(s => s.id === m.subject_id);
                    if (sub) {
                        const fullMarks = Number(isBefaq ? sub.total_marks : sub.full_marks) || 100;
                        const obtained = Number(m.marks_obtained) || 0;
                        total += (obtained / fullMarks) * 100;
                        count++;
                    }
                });
                
                if (exam && count > 0) {
                    examAvgs.push({
                        exam_date: exam.exam_date || exam.created_at || '',
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
                    class_name: classes.find(c => c.id === std.class_id)?.class_name || '',
                    roll: std.roll,
                    current_avg: current.average.toFixed(1),
                    change: parseFloat(change.toFixed(1)),
                    status: change >= 0 ? 'improving' : 'declining'
                });
            }
        });
        
        improvementInsights.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        // 8. Process Student Averages for Current Scope (Top & Weak Students)
        // If an exam is selected, calculate specifically for that exam;
        // If all exams selected, calculate average across scoped exams.
        const studentAverages: { id: string; name: string; roll: number; className: string; average: number; totalMarks: number; hasFailed: boolean }[] = [];
        
        let passedCount = 0;
        let failedCount = 0;

        students.forEach(std => {
            const stdMarks = marks.filter(m => m.student_id === std.id && scopedExamIds.includes(m.exam_id));
            if (stdMarks.length > 0) {
                let totalPct = 0;
                let count = 0;
                let hasFailed = false;

                stdMarks.forEach(m => {
                    const sub = subjects.find(s => s.id === m.subject_id);
                    if (sub) {
                        const fullMarks = Number(isBefaq ? sub.total_marks : sub.full_marks) || 100;
                        const passMarks = Number(isBefaq ? sub.passing_marks : sub.pass_marks) || 33;
                        const obtained = Number(m.marks_obtained) || 0;
                        const pct = (obtained / fullMarks) * 100;
                        
                        totalPct += pct;
                        count++;
                        if (obtained < passMarks) hasFailed = true;
                    }
                });

                if (count > 0) {
                    const avg = totalPct / count;
                    studentAverages.push({
                        id: std.id,
                        name: std.student_name,
                        roll: std.roll,
                        className: classes.find(c => c.id === std.class_id)?.class_name || '',
                        average: avg,
                        totalMarks: totalPct,
                        hasFailed
                    });

                    if (hasFailed) failedCount++;
                    else passedCount++;
                }
            }
        });

        studentAverages.sort((a, b) => b.average - a.average);
        const topStudents = studentAverages.slice(0, 5);
        const weakStudents = [...studentAverages].reverse().slice(0, 5);
        
        const totalEvaluatedStudents = studentAverages.length;
        const passRate = totalEvaluatedStudents > 0 ? (passedCount / totalEvaluatedStudents) * 100 : 0;
        const failRate = totalEvaluatedStudents > 0 ? (failedCount / totalEvaluatedStudents) * 100 : 0;

        const highestMarks = totalEvaluatedStudents > 0 ? Math.max(...studentAverages.map(s => s.average)) : 0;
        const lowestMarks = totalEvaluatedStudents > 0 ? Math.min(...studentAverages.map(s => s.average)) : 0;

        // 9. Exam Trends (Line Chart)
        const examTrends = scopedExams.map(exam => {
            const examMarks = marks.filter(m => m.exam_id === exam.id);
            let total = 0;
            let count = 0;
            examMarks.forEach(m => {
                const sub = subjects.find(s => s.id === m.subject_id);
                if (sub) {
                    const fullMarks = Number(isBefaq ? sub.total_marks : sub.full_marks) || 100;
                    const obtained = Number(m.marks_obtained) || 0;
                    total += (obtained / fullMarks) * 100;
                    count++;
                }
            });
            return {
                name: exam.exam_name,
                average: count > 0 ? parseFloat((total / count).toFixed(1)) : 0
            };
        }).filter(e => e.average > 0);

        // 10. Class Rankings
        const classRankings: any[] = [];
        classesToProcess.forEach(cls => {
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
            improvementInsights: improvementInsights.slice(0, 6),
            overallAvg: totalOverallCount > 0 ? totalOverallPercentage / totalOverallCount : 0,
            topStudents,
            weakStudents,
            passRate,
            failRate,
            highestMarks,
            lowestMarks,
            totalEvaluatedStudents,
            totalExamsCount: scopedExams.length,
            subjectPerformance,
            examTrends,
            examComparisons,
            classRankings
        });

    } catch (err) {
        console.error('Error calculating analytics:', err);
    } finally {
        setLoading(false);
    }
  };

  const currentSelectedClassName = selectedClassId === 'all' 
    ? localT.allClasses[lang] 
    : classes.find(c => c.id === selectedClassId)?.class_name || localT.selectClass[lang];

  const currentSelectedExamName = selectedExamId === 'all'
    ? localT.allExams[lang]
    : classSpecificExams.find(e => e.id === selectedExamId)?.exam_name || localT.selectExam[lang];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="animate-spin text-[#2563EB]" size={32} />
        <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {lang === 'bn' ? 'ফলাফল এনালাইসিস লোড হচ্ছে...' : 'Loading Result Analytics...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Filter Bar: Class Filter + Exam Filter */}
      <div className={`p-4 rounded-[1.8rem] border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-bubble ${
        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <Filter size={16} />
          </div>
          <div>
            <h4 className={`text-xs font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'ফিল্টার ও পরীক্ষা নির্বাচন' : 'Filter & Exam Selector'}
            </h4>
            <p className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedClassId !== 'all' || selectedExamId !== 'all' 
                ? `${currentSelectedClassName} • ${currentSelectedExamName}`
                : (lang === 'bn' ? 'সকল ক্লাস ও পরীক্ষার সম্মিলিত রিপোর্ট' : 'Aggregated Report for All Classes & Exams')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* 1. Class Filter Dropdown */}
          <div className="relative flex-1 sm:flex-initial min-w-[125px]">
            <button 
                id="btn-analytics-class-filter"
                onClick={() => { setShowClassFilter(!showClassFilter); setShowExamFilter(false); }}
                className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 border rounded-xl px-3.5 py-2 text-xs font-black transition-all active:scale-95 shadow-sm ${
                    isDark 
                    ? 'bg-slate-900/60 border-slate-700 text-slate-200 hover:border-blue-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#2563EB]'
                }`}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers size={14} className={`shrink-0 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} />
                  <span className="truncate max-w-[90px] sm:max-w-[130px]">{currentSelectedClassName}</span>
                </div>
                <ChevronRight size={14} className={`shrink-0 transition-transform duration-200 ${showClassFilter ? 'rotate-90' : ''}`} />
            </button>

            {showClassFilter && (
                <>
                    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" onClick={() => setShowClassFilter(false)}></div>
                    <div className={`fixed sm:absolute top-1/2 -translate-y-1/2 sm:translate-y-0 sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-0 sm:mt-2 w-auto sm:w-72 max-h-[85vh] sm:max-h-96 rounded-2xl shadow-2xl border p-3 z-50 animate-in zoom-in-95 origin-center sm:origin-top-right flex flex-col ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                    }`}>
                        <div className="mb-2 px-1">
                            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.filterByClass[lang]}</h4>
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder={localT.searchClass[lang]} 
                                    className={`w-full h-8 rounded-lg pl-8 pr-2.5 text-xs font-bold outline-none border transition-all ${
                                        isDark 
                                        ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-blue-500' 
                                        : 'bg-slate-50 border-slate-200 focus:border-blue-200 focus:bg-white'
                                    }`}
                                    value={classFilterSearch}
                                    onChange={(e) => setClassFilterSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            <button 
                                onClick={() => { setSelectedClassId('all'); setSelectedExamId('all'); setShowClassFilter(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${
                                    selectedClassId === 'all' 
                                    ? 'bg-[#2563EB] text-white shadow-md' 
                                    : isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <span>{localT.allClasses[lang]}</span>
                                {selectedClassId === 'all' && <Check size={14} className="text-white shrink-0" />}
                            </button>
                            
                            {classes.filter(c => (c.class_name || '').toLowerCase().includes((classFilterSearch || '').toLowerCase())).map(c => (
                                <button 
                                    key={c.id}
                                    onClick={() => { setSelectedClassId(c.id); setSelectedExamId('all'); setShowClassFilter(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${
                                        selectedClassId === c.id 
                                        ? 'bg-[#2563EB] text-white shadow-md' 
                                        : isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="truncate pr-2">{c.class_name}</span>
                                    {selectedClassId === c.id && <Check size={14} className="text-white shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
          </div>

          {/* 2. Exam Filter Dropdown (Multi-Exam Selector) */}
          <div className="relative flex-1 sm:flex-initial min-w-[125px]">
            <button 
                id="btn-analytics-exam-filter"
                onClick={() => { setShowExamFilter(!showExamFilter); setShowClassFilter(false); }}
                className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 border rounded-xl px-3.5 py-2 text-xs font-black transition-all active:scale-95 shadow-sm ${
                    selectedExamId !== 'all'
                    ? (isDark ? 'bg-purple-900/40 border-purple-500 text-purple-200' : 'bg-purple-50 border-purple-300 text-purple-700')
                    : (isDark ? 'bg-slate-900/60 border-slate-700 text-slate-200 hover:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-purple-600')
                }`}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText size={14} className={`shrink-0 ${selectedExamId !== 'all' ? 'text-purple-600' : (isDark ? 'text-slate-400' : 'text-slate-500')}`} />
                  <span className="truncate max-w-[90px] sm:max-w-[130px]">{currentSelectedExamName}</span>
                </div>
                <ChevronRight size={14} className={`shrink-0 transition-transform duration-200 ${showExamFilter ? 'rotate-90' : ''}`} />
            </button>

            {showExamFilter && (
                <>
                    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" onClick={() => setShowExamFilter(false)}></div>
                    <div className={`fixed sm:absolute top-1/2 -translate-y-1/2 sm:translate-y-0 sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-0 sm:mt-2 w-auto sm:w-80 max-h-[85vh] sm:max-h-96 rounded-2xl shadow-2xl border p-3 z-50 animate-in zoom-in-95 origin-center sm:origin-top-right flex flex-col ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                    }`}>
                        <div className="mb-2 px-1">
                            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.filterByExam[lang]}</h4>
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder={localT.searchExam[lang]} 
                                    className={`w-full h-8 rounded-lg pl-8 pr-2.5 text-xs font-bold outline-none border transition-all ${
                                        isDark 
                                        ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-purple-500' 
                                        : 'bg-slate-50 border-slate-200 focus:border-purple-200 focus:bg-white'
                                    }`}
                                    value={examFilterSearch}
                                    onChange={(e) => setExamFilterSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            <button 
                                onClick={() => { setSelectedExamId('all'); setShowExamFilter(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${
                                    selectedExamId === 'all' 
                                    ? 'bg-purple-600 text-white shadow-md' 
                                    : isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <div>
                                  <p className="font-black">{localT.allExams[lang]}</p>
                                  <p className={`text-[9px] ${selectedExamId === 'all' ? 'text-purple-100' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                    {lang === 'bn' ? 'সকল পরীক্ষার সামগ্রিক হিসাব' : 'Aggregated results'}
                                  </p>
                                </div>
                                {selectedExamId === 'all' && <Check size={14} className="text-white shrink-0" />}
                            </button>
                            
                            {classSpecificExams
                              .filter(e => (e.exam_name || '').toLowerCase().includes((examFilterSearch || '').toLowerCase()))
                              .map(e => {
                                const examClass = classes.find(c => c.id === (e.class_id || e.marhala_id))?.class_name;
                                return (
                                  <button 
                                      key={e.id}
                                      onClick={() => { setSelectedExamId(e.id); setShowExamFilter(false); }}
                                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-between group ${
                                          selectedExamId === e.id 
                                          ? 'bg-purple-600 text-white shadow-md' 
                                          : isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                  >
                                      <div className="truncate pr-2">
                                        <p className="font-black truncate">{e.exam_name}</p>
                                        <p className={`text-[9px] font-bold ${selectedExamId === e.id ? 'text-purple-100' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                          {examClass ? `${examClass} • ` : ''}{e.exam_date || e.created_at?.substring(0, 10) || ''}
                                        </p>
                                      </div>
                                      {selectedExamId === e.id && <Check size={14} className="text-white shrink-0" />}
                                  </button>
                                );
                            })}

                            {classSpecificExams.length === 0 && (
                              <div className="text-center py-4 text-[10px] font-bold text-slate-400">{localT.noExamsFound[lang]}</div>
                            )}
                        </div>
                    </div>
                </>
            )}
          </div>

          {(selectedClassId !== 'all' || selectedExamId !== 'all') && (
            <button
              onClick={() => { setSelectedClassId('all'); setSelectedExamId('all'); }}
              className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              {lang === 'bn' ? 'রিসেট' : 'Reset'}
            </button>
          )}
        </div>
      </div>

      {/* Selected Scope Indicator Banner */}
      {selectedExamId !== 'all' && (
        <div className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-2 animate-in fade-in duration-300 ${
          isDark ? 'bg-purple-950/30 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-black">
            <FileText size={15} className="text-purple-600" />
            <span>
              {lang === 'bn' ? `নির্দিষ্ট পরীক্ষার বিশ্লেষণ: ${currentSelectedExamName}` : `Specific Exam Report: ${currentSelectedExamName}`}
            </span>
          </div>
          <button 
            onClick={() => setSelectedExamId('all')} 
            className="text-[11px] font-black underline hover:opacity-80"
          >
            {lang === 'bn' ? 'সব পরীক্ষা দেখুন' : 'Show All Exams'}
          </button>
        </div>
      )}

      {/* Primary Key Stats Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Overall Average Card */}
        <div className="bg-[#1E3A8A] p-5 rounded-[2rem] text-white shadow-premium relative overflow-hidden col-span-2 lg:col-span-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                <Award size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">{localT.overallAverage[lang]}</span>
                </div>
                <h2 className="text-4xl font-black font-noto">{analytics.overallAvg.toFixed(1)}%</h2>
                <p className="text-[10px] font-bold text-blue-200 mt-1">
                  {selectedExamId !== 'all' 
                    ? (lang === 'bn' ? 'এই পরীক্ষার সকল বিষয়ের গড় নম্বর' : 'Average score across this exam')
                    : (lang === 'bn' ? 'সকল বিষয়ের সম্মিলিত গড় স্কোর' : 'Average score across all exams')}
                </p>
            </div>
        </div>

        {/* Pass Rate Card */}
        <div className="bg-emerald-600 p-5 rounded-[2rem] text-white shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-2xl -mr-5 -mt-5"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                <Check size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{localT.passRate[lang]}</span>
                </div>
                <h2 className="text-2xl font-black font-noto">{analytics.passRate.toFixed(1)}%</h2>
                <p className="text-[9px] font-bold text-emerald-100 mt-1">
                  {analytics.totalEvaluatedStudents > 0 
                    ? `${Math.round((analytics.passRate / 100) * analytics.totalEvaluatedStudents)} ${localT.students[lang]}` 
                    : `0 ${localT.students[lang]}`}
                </p>
            </div>
        </div>

        {/* Fail Rate Card */}
        <div className="bg-red-500 p-5 rounded-[2rem] text-white shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-2xl -mr-5 -mt-5"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                <AlertCircle size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{localT.failRate[lang]}</span>
                </div>
                <h2 className="text-2xl font-black font-noto">{analytics.failRate.toFixed(1)}%</h2>
                <p className="text-[9px] font-bold text-red-100 mt-1">
                  {analytics.totalEvaluatedStudents > 0 
                    ? `${Math.round((analytics.failRate / 100) * analytics.totalEvaluatedStudents)} ${localT.students[lang]}` 
                    : `0 ${localT.students[lang]}`}
                </p>
            </div>
        </div>

        {/* Highest Marks */}
        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.highestMarks[lang]}</span>
            <span className={`text-xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{analytics.highestMarks.toFixed(1)}%</span>
            <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.topStudents[lang]}: {analytics.topStudents.length > 0 ? analytics.topStudents[0].name : '-'}</span>
        </div>

        {/* Lowest Marks */}
        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.lowestMarks[lang]}</span>
            <span className="text-xl font-black text-red-500">{analytics.lowestMarks.toFixed(1)}%</span>
            <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{lang === 'bn' ? 'সর্বনিম্ন প্রাপ্ত গড়' : 'Lowest score recorded'}</span>
        </div>

        {/* Total Evaluated Students */}
        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.totalStudents[lang]}</span>
            <span className={`text-xl font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{analytics.totalEvaluatedStudents}</span>
            <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.totalClasses[lang]}: {analytics.classPerformance.length}</span>
        </div>

        {/* Total Exams in View */}
        <div className={`p-4 rounded-[1.8rem] border shadow-bubble flex flex-col justify-center ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.totalExams[lang]}</span>
            <span className="text-xl font-black text-purple-600">{analytics.totalExamsCount}</span>
            <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {selectedExamId !== 'all' ? (lang === 'bn' ? 'একক পরীক্ষা ভিউ' : 'Single exam view') : (lang === 'bn' ? 'সকল পরীক্ষা অন্তর্ভুক্ত' : 'All exams combined')}
            </span>
        </div>
      </div>

      {/* MULTI-EXAM BREAKDOWN SECTION: Exam Comparison Cards */}
      {analytics.examComparisons.length > 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-purple-600" />
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {localT.examComparison[lang]} ({analytics.examComparisons.length} {lang === 'bn' ? 'টি পরীক্ষা' : 'Exams'})
              </h3>
            </div>
            {selectedExamId !== 'all' && (
              <button 
                onClick={() => setSelectedExamId('all')}
                className="text-[10px] font-black text-purple-600 hover:underline"
              >
                {lang === 'bn' ? 'সবগুলো একসাথে দেখুন' : 'View All Combined'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.examComparisons.map((ex, idx) => {
              const isSelected = selectedExamId === ex.id;
              return (
                <div 
                  key={idx} 
                  className={`p-4 rounded-[1.8rem] border transition-all shadow-bubble flex flex-col justify-between ${
                    isSelected 
                    ? (isDark ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20' : 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-500/20')
                    : (isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-blue-200')
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{ex.exam_name}</h4>
                        <p className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {ex.class_name} {ex.date ? `• ${ex.date}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-black ${
                        ex.average >= 75 ? 'bg-emerald-100 text-emerald-700' : ex.average >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ex.average.toFixed(1)}% {localT.avg[lang]}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 my-3 text-center">
                      <div className={`p-2 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                        <p className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.passRate[lang]}</p>
                        <p className="text-xs font-black text-emerald-600">{ex.pass_rate.toFixed(0)}%</p>
                      </div>
                      <div className={`p-2 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                        <p className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.students[lang]}</p>
                        <p className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{ex.student_count}</p>
                      </div>
                      <div className={`p-2 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                        <p className={`text-[8px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.highestMarks[lang]}</p>
                        <p className="text-xs font-black text-blue-600">{ex.highest.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedExamId(isSelected ? 'all' : ex.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                      ? 'bg-purple-600 text-white shadow-md'
                      : (isDark ? 'bg-slate-700 text-slate-200 hover:bg-purple-900/50 hover:text-purple-300' : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-purple-700')
                    }`}
                  >
                    <span>{isSelected ? (lang === 'bn' ? '✓ নির্বাচিত পরীক্ষা' : '✓ Selected Exam') : localT.viewExamDetails[lang]}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Class Performance, Subject Weakness, Improvement Tracking */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1. Class Performance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
              <BarChart2 size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.classPerformance[lang]}</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
              {analytics.classPerformance.map((cls, idx) => (
                <div key={idx} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                    <div>
                      <h4 className={`font-black text-sm ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{cls.class_name}</h4>
                      <p className={`text-[9px] font-bold flex items-center gap-2 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="flex items-center gap-1"><Users size={10}/> {cls.student_count} {localT.students[lang]}</span>
                        <span>•</span>
                        <span>{cls.exam_count} {localT.totalExams[lang]}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black ${parseFloat(cls.average) >= 80 ? 'text-emerald-500' : parseFloat(cls.average) >= 60 ? 'text-blue-500' : 'text-orange-500'}`}>
                          {cls.average}%
                      </span>
                      <p className={`text-[8px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.avg[lang]}</p>
                    </div>
                </div>
              ))}
              {analytics.classPerformance.length === 0 && (
                <div className={`text-center py-8 rounded-[1.8rem] border border-dashed ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'} text-xs font-bold`}>
                  {localT.noDataAvailable[lang]}
                </div>
              )}
          </div>
        </div>

        {/* 2. Subject Weakness Detection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
              <AlertCircle size={16} className="text-red-500" />
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.subjectWeaknessDetection[lang]}</h3>
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
                            <div className="text-right">
                              <span className="text-xs font-black text-red-500">{sub.average.toFixed(1)}% {localT.avg[lang]}</span>
                              {sub.failCount > 0 && (
                                <span className={`text-[9px] font-bold ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ({sub.failCount} {localT.failed[lang]})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, Math.max(5, sub.average))}%` }}></div>
                          </div>
                      </div>
                    </div>
                ))}
                {analytics.subjectWeakness.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs font-bold">
                    {localT.noWeaknessDetected[lang]}
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* 3. Multi-Exam Student Improvement / Decline (Top Movers) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
              <TrendingUp size={16} className="text-emerald-500" />
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.topMovers[lang]}</h3>
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
                          <p className={`text-[9px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.class_name} • {localT.roll[lang]}: {item.roll}
                          </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black ${item.status === 'improving' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.change > 0 ? '+' : ''}{item.change}%
                      </span>
                      <p className={`text-[9px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.avg[lang]}: {item.current_avg}%</p>
                    </div>
                </div>
              ))}
              {analytics.improvementInsights.length === 0 && (
                <div className={`text-center py-6 px-4 rounded-[1.8rem] border border-dashed ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'} text-xs font-bold`}>
                  {localT.notEnoughExamData[lang]}
                </div>
              )}
          </div>
        </div>

        {/* 4. Exam Trends Line Chart */}
        {analytics.examTrends.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                  <Activity size={16} className="text-blue-500" />
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.examTrends[lang]}</h3>
              </div>
              <div className={`p-5 rounded-[2rem] border shadow-bubble h-64 ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
              }`}>
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={180}>
                        <LineChart data={analytics.examTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
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
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-[#2563EB]" size={20} />
                    </div>
                  )}
              </div>
            </div>
        )}

        {/* 5. Subject Performance Bar Chart */}
        {analytics.subjectPerformance.length > 0 && (
            <div className="space-y-3 xl:col-span-2">
              <div className="flex items-center gap-2 px-2">
                  <BookOpen size={16} className="text-indigo-500" />
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.subjectPerformance[lang]}</h3>
              </div>
              <div className={`p-5 rounded-[2rem] border shadow-bubble h-72 ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
              }`}>
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={180}>
                        <BarChart data={analytics.subjectPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                            <Tooltip 
                                cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                                formatter={(value: any, name: string) => [
                                  `${value}%`, 
                                  name === 'average' ? (lang === 'bn' ? 'গড় স্কোর' : 'Avg Score') : (lang === 'bn' ? 'পাসের হার' : 'Pass Rate')
                                ]}
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
                            <Bar dataKey="average" name="average" fill="#818cf8" radius={[6, 6, 0, 0]} barSize={26} />
                            <Bar dataKey="passRate" name="passRate" fill="#34d399" radius={[6, 6, 0, 0]} barSize={26} />
                        </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-[#2563EB]" size={20} />
                    </div>
                  )}
              </div>
            </div>
        )}

        {/* 6. Top Students (Merit) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
              <Target size={16} className="text-emerald-500" />
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.topStudents[lang]}</h3>
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
                          <p className={`text-[9px] font-bold flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {std.className} • {localT.roll[lang]}: {std.roll}
                          </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-500">
                          {std.average.toFixed(1)}%
                      </span>
                    </div>
                </div>
              ))}
              {analytics.topStudents.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-bold">{localT.noDataAvailable[lang]}</div>
              )}
          </div>
        </div>

        {/* 7. Students Needing Attention */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
              <AlertCircle size={16} className="text-red-500" />
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.studentsNeedingAttention[lang]}</h3>
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
                          <p className={`text-[9px] font-bold flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {std.className} • {localT.roll[lang]}: {std.roll}
                          </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-red-500">
                          {std.average.toFixed(1)}%
                      </span>
                    </div>
                </div>
              ))}
              {analytics.weakStudents.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-bold">{localT.noDataAvailable[lang]}</div>
              )}
          </div>
        </div>

        {/* 8. Class Rankings Grid */}
        {analytics.classRankings.length > 0 && (
            <div className="space-y-3 xl:col-span-2">
              <div className="flex items-center gap-2 px-2">
                  <Award size={16} className="text-amber-500" />
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.classRankings[lang]}</h3>
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
                                            <p className={`text-[9px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{localT.roll[lang]}: {std.roll}</p>
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
