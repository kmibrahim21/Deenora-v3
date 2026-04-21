import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Exam, FinalResult, FinalResultExam, Language, UserRole, Student, Profile } from 'types';
import { ArrowLeft, Plus, Save, Trash2, Download, Loader2, Calculator, Check, X, AlertCircle } from 'lucide-react';
import { t } from 'translations';
import { generateFinalResultPDF } from '../../../../utils/pdfGenerator';

interface FinalResultsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  activeYear?: any;
  profile?: Profile | null;
}

const FinalResults: React.FC<FinalResultsProps> = ({ lang, madrasah, onBack, role, activeYear, profile }) => {
  const [results, setResults] = useState<FinalResult[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewResult, setViewResult] = useState<FinalResult | null>(null);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [selectedExams, setSelectedExams] = useState<{examId: string, weight: number}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Result View State
  const [calculatedData, setCalculatedData] = useState<any[]>([]);
  const [resultLoading, setResultLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
      fetchResults();
    }
  }, [madrasah]);

  useEffect(() => {
    if (selectedClassId) {
      fetchExamsForClass(selectedClassId);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (viewResult) {
      calculateResult(viewResult);
    }
  }, [viewResult]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').eq('institution_id', madrasah?.id);
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(filteredClasses);
    }
  };

  const fetchResults = () => {
    // Using localStorage for persistence as we can't create tables dynamically
    const saved = localStorage.getItem(`final_results_${madrasah?.id}`);
    if (saved) {
      setResults(JSON.parse(saved));
    }
    setLoading(false);
  };

  const fetchExamsForClass = async (classId: string) => {
    let query = supabase.from('exams').select('*').eq('class_id', classId);
    
    if (activeYear) {
      query = query.eq('academic_year_id', activeYear.id);
    } else {
      const yearStart = madrasah?.config_json?.academic_year_start;
      if (yearStart) {
        query = query.gte('created_at', yearStart);
      }
    }

    const { data } = await query;
    if (data) setAvailableExams(data);
  };

  const handleSave = () => {
    if (!title || !selectedClassId || selectedExams.length === 0) return;
    
    const totalWeight = selectedExams.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight <= 0) {
      alert('Total weight must be greater than 0%');
      return;
    }

    const newResult: FinalResult = {
      id: crypto.randomUUID(),
      institution_id: madrasah!.id,
      class_id: selectedClassId,
      title,
      created_at: new Date().toISOString(),
      exams: selectedExams.map(e => ({
        id: crypto.randomUUID(),
        final_result_id: '',
        exam_id: e.examId,
        weight: e.weight,
        exam: availableExams.find(ex => ex.id === e.examId)
      }))
    };

    const updated = [newResult, ...results];
    setResults(updated);
    localStorage.setItem(`final_results_${madrasah?.id}`, JSON.stringify(updated));
    setShowCreate(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setSelectedClassId('');
    setSelectedExams([]);
    setAvailableExams([]);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure?')) {
      const updated = results.filter(r => r.id !== id);
      setResults(updated);
      localStorage.setItem(`final_results_${madrasah?.id}`, JSON.stringify(updated));
    }
  };

  const calculateResult = async (result: FinalResult) => {
    setResultLoading(true);
    try {
      // 1. Fetch Students
      let stdQuery = supabase
        .from('students')
        .select('*')
        .eq('class_id', result.class_id)
        .order('roll', { ascending: true });
      
      if (activeYear) {
        stdQuery = stdQuery.or(`academic_year_id.eq.${activeYear.id},academic_year_id.is.null`);
      }

      const { data: students } = await stdQuery;

      if (!students) throw new Error('No students found');

      // 2. Fetch Marks and Subjects for all exams
      const examDataPromises = result.exams!.map(async (config) => {
        const { data: marks } = await supabase
          .from('exam_marks')
          .select('*, exam_subjects(subject_name, full_marks, pass_marks)')
          .eq('exam_id', config.exam_id);
        
        return {
          examId: config.exam_id,
          weight: config.weight,
          marks: marks || []
        };
      });

      const examsData = await Promise.all(examDataPromises);

      // 3. Process Data
      // Get unique subjects
      const uniqueSubjects = new Set<string>();
      examsData.forEach(e => {
        e.marks.forEach((m: any) => {
           if (m.exam_subjects?.subject_name) uniqueSubjects.add(m.exam_subjects.subject_name);
        });
      });
      const subjectList = Array.from(uniqueSubjects);
      setSubjects(subjectList);

      // Calculate for each student
      const processed = students.map(student => {
        const studentMarks: any = {};
        let totalWeightedSum = 0;
        let hasFailedAny = false;

        subjectList.forEach(sub => {
          let weightedSum = 0;
          let weightUsed = 0;

          examsData.forEach(exam => {
            const markEntry = exam.marks.find((m: any) => 
              m.student_id === student.id && 
              m.exam_subjects?.subject_name === sub
            );

            if (markEntry) {
              const obtained = parseFloat(markEntry.marks_obtained);
              const fullMarks = markEntry.exam_subjects?.full_marks || 100;
              const passMarks = markEntry.exam_subjects?.pass_marks || 33;
              
              // Normalize to the exam's weight. 
              // Example: If weight is 30% and student got 25/50, contribution is (25/50) * 30 = 15
              const contribution = (obtained / fullMarks) * exam.weight;
              weightedSum += contribution;
              weightUsed += exam.weight;
              
              // Pass status: if the component score was less than pass pct
              if ((obtained / fullMarks) * 100 < (passMarks / fullMarks) * 100) {
                  hasFailedAny = true;
              }
            }
          });

          // If weights sum up to less than 100, we might need to normalize
          // studentMarks[sub] = weightedSum;
          studentMarks[sub] = weightedSum.toFixed(1);
          totalWeightedSum += weightedSum;
        });

        // Calculate Grade based on average percentage
        // Since weightedSum per subject is already maxed at 100 (if weights sum to 100),
        // we can use totalWeightedSum / subjectList.length as the final score pct.
        const finalPercentage = subjectList.length > 0 ? (totalWeightedSum / subjectList.length) : 0;
        const { gpa, grade } = getGradeInfo(finalPercentage, hasFailedAny);

        return {
          ...student,
          marks: studentMarks,
          total: totalWeightedSum.toFixed(1),
          average: finalPercentage.toFixed(1),
          gpa,
          grade
        };
      });

      // Sort by Total (Rank)
      processed.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
      
      // Add Rank
      const ranked = processed.map((p, i) => ({ ...p, rank: i + 1 }));
      
      setCalculatedData(ranked);

    } catch (error) {
      console.error(error);
      alert('Error calculating results');
    }
    setResultLoading(false);
  };

  const getGradeInfo = (percentage: number, hasFailed: boolean) => {
    if (hasFailed) return { gpa: '0.00', grade: 'F' };
    if (percentage >= 80) return { gpa: '5.00', grade: 'A+' };
    if (percentage >= 70) return { gpa: '4.00', grade: 'A' };
    if (percentage >= 60) return { gpa: '3.50', grade: 'A-' };
    if (percentage >= 50) return { gpa: '3.00', grade: 'B' };
    if (percentage >= 40) return { gpa: '2.00', grade: 'C' };
    if (percentage >= 33) return { gpa: '1.00', grade: 'D' };
    return { gpa: '0.00', grade: 'F' };
  };

  const handleDownloadPDF = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!viewResult || !madrasah) return;

    setIsDownloading(true);
    try {
      await generateFinalResultPDF(
          viewResult.title,
          classes.find(c => c.id === viewResult.class_id)?.class_name || '',
          subjects,
          calculatedData,
          { name: madrasah.name },
          downloadLang
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Loading Overlay */}
      {(resultLoading || isDownloading) && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-blue-900 font-black tracking-widest uppercase text-sm animate-pulse">
            {isDownloading ? (lang === 'bn' ? 'ডাউনলোড হচ্ছে...' : 'Downloading...') : (lang === 'bn' ? 'অপেক্ষা করুন...' : 'Please Wait...')}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={viewResult ? () => setViewResult(null) : onBack} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-100 text-[#2563EB]'}`}>
            <ArrowLeft size={20}/>
          </button>
          <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>
            {viewResult ? viewResult.title : 'Final Results'}
          </h1>
        </div>
        {!viewResult && (
          <button onClick={() => setShowCreate(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
            <Plus size={20}/>
          </button>
        )}
        {viewResult && (
          <button onClick={() => {
              setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadPDF(l));
              setShowDownloadLangModal(true);
          }} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
            <Download size={20}/>
          </button>
        )}
      </div>

      {!viewResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>
          ) : results.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400">No final results created yet.</div>
          ) : (
            results.map(result => (
              <div key={result.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble flex items-center justify-between`}>
                <div>
                  <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>{result.title}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {classes.find(c => c.id === result.class_id)?.class_name} • {result.exams?.length} Exams
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewResult(result)} className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center border border-blue-100">
                    <Calculator size={20}/>
                  </button>
                  <button onClick={() => handleDelete(result.id)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100">
                    <Trash2 size={20}/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewResult && (
        <div className="space-y-4">
          {resultLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#2563EB]" size={40} /></div>
          ) : (
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2.5rem] shadow-bubble border overflow-x-auto no-scrollbar`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">Rank</th>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">Roll/Name</th>
                    {subjects.map(s => (
                      <th key={s} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px]">{s}</th>
                    ))}
                    <th className="py-4 text-[10px] font-black text-blue-400 uppercase text-center">Total</th>
                    <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center">GPA</th>
                    <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedData.map((student) => (
                    <tr key={student.id} className={`border-b ${madrasah?.theme === 'dark' ? 'border-slate-800/50' : 'border-slate-50'} last:border-0`}>
                      <td className={`py-4 pr-4 font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>#{student.rank}</td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 leading-none mb-1">Roll: {student.roll}</span>
                          <span className={`font-black ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'} text-xs font-noto truncate max-w-[120px]`}>{student.student_name}</span>
                        </div>
                      </td>
                      {subjects.map(sub => (
                        <td key={sub} className={`py-4 px-2 text-center font-black ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-xs`}>
                          {student.marks[sub] || '-'}
                        </td>
                      ))}
                      <td className={`py-4 px-2 text-center font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'} text-xs`}>{student.total}</td>
                      <td className="py-4 px-2 text-center font-black text-purple-600 text-xs">{student.gpa}</td>
                      <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">{student.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      {/* Modals */}
      {showDownloadLangModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1100] flex items-center justify-center p-4">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200`}>
                  <div className={`w-16 h-16 ${madrasah?.theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                      <Download className="text-blue-600" size={32} />
                  </div>
                  <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} mb-2 text-center`}>Select Language</h3>
                  <p className="text-slate-400 text-center text-sm font-bold mb-8">ভাষা নির্বাচন করুন</p>
                  
                  <div className="space-y-4">
                      <button 
                          onClick={async () => {
                              if (downloadAction) await downloadAction('en');
                              setShowDownloadLangModal(false);
                          }}
                          className="w-full py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          English
                      </button>
                      <button 
                          onClick={async () => {
                              if (downloadAction) await downloadAction('bn');
                              setShowDownloadLangModal(false);
                          }}
                          className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          বাংলা (Bengali)
                      </button>
                      <button 
                          onClick={() => setShowDownloadLangModal(false)}
                          className="w-full py-3 text-slate-400 font-black text-sm hover:text-slate-600 transition-colors mt-2"
                      >
                          Cancel / বাতিল
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Create Final Result</h3>
              <button onClick={() => setShowCreate(false)} className={`w-9 h-9 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} rounded-xl flex items-center justify-center`}><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Title</label>
                <input type="text" className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20`} placeholder="e.g. Annual Result 2024" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Class</label>
                <select className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-[#1E293B]'} rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20`} value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>

              {selectedClassId && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Select Exams & Weights</label>
                  {availableExams.map(exam => {
                    const isSelected = selectedExams.some(e => e.examId === exam.id);
                    const weight = selectedExams.find(e => e.examId === exam.id)?.weight || 0;

                    return (
                      <div key={exam.id} className={`p-4 rounded-2xl border transition-all ${isSelected ? (madrasah?.theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200') : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} text-sm`}>{exam.exam_name}</span>
                          <button 
                            onClick={() => {
                              if (isSelected) {
                                setSelectedExams(selectedExams.filter(e => e.examId !== exam.id));
                              } else {
                                setSelectedExams([...selectedExams, { examId: exam.id, weight: 0 }]);
                              }
                            }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border ${isSelected ? 'bg-[#2563EB] border-[#2563EB] text-white' : (madrasah?.theme === 'dark' ? 'bg-slate-700 border-slate-600 text-transparent' : 'bg-white border-slate-200 text-transparent')}`}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              className={`w-20 h-8 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-blue-200 text-[#1E293B]'} rounded-lg px-2 font-black text-xs outline-none border text-center`} 
                              placeholder="0"
                              value={weight || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setSelectedExams(selectedExams.map(ex => ex.examId === exam.id ? { ...ex, weight: val } : ex));
                              }}
                            />
                            <span className="text-xs font-black text-blue-400">% Weight</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div className="flex items-center justify-between px-2 pt-2">
                    <span className="text-xs font-black text-slate-400">Total Weight:</span>
                    <span className={`text-sm font-black ${selectedExams.reduce((sum, e) => sum + e.weight, 0) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedExams.reduce((sum, e) => sum + e.weight, 0)}%
                    </span>
                  </div>
                </div>
              )}

              <button onClick={handleSave} className="w-full py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save size={20} /> Save Result Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalResults;
