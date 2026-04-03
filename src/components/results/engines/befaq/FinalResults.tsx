import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Language, UserRole, BefaqExam, Profile } from 'types';
import { ArrowLeft, Plus, Save, Trash2, Download, Loader2, Calculator, Check, X, Trophy } from 'lucide-react';
import { t } from 'translations';
import { generateFinalResultPDF } from '../../../../utils/pdfGenerator';

interface FinalResultsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

interface BefaqFinalResult {
  id: string;
  institution_id: string;
  class_id: string;
  title: string;
  created_at: string;
  exams: {
    id: string;
    exam_id: string;
    weight: number;
    exam?: BefaqExam;
  }[];
}

const BefaqFinalResults: React.FC<FinalResultsProps> = ({ lang, madrasah, onBack, role, profile }) => {
  const [results, setResults] = useState<BefaqFinalResult[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewResult, setViewResult] = useState<BefaqFinalResult | null>(null);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [availableExams, setAvailableExams] = useState<BefaqExam[]>([]);
  const [selectedExams, setSelectedExams] = useState<{examId: string, weight: number}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Result View State
  const [calculatedData, setCalculatedData] = useState<any[]>([]);
  const [resultLoading, setResultLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => void) | null>(null);

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
    const saved = localStorage.getItem(`befaq_final_results_${madrasah?.id}`);
    if (saved) {
      setResults(JSON.parse(saved));
    }
    setLoading(false);
  };

  const fetchExamsForClass = async (classId: string) => {
    const { data } = await supabase.from('befaq_exams').select('*').eq('marhala_id', classId);
    if (data) setAvailableExams(data);
  };

  const handleSave = () => {
    if (!title || !selectedClassId || selectedExams.length === 0) return;
    
    const totalWeight = selectedExams.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight !== 100) {
      alert('Total weight must be 100%');
      return;
    }

    const newResult: BefaqFinalResult = {
      id: crypto.randomUUID(),
      institution_id: madrasah!.id,
      class_id: selectedClassId,
      title,
      created_at: new Date().toISOString(),
      exams: selectedExams.map(e => ({
        id: crypto.randomUUID(),
        exam_id: e.examId,
        weight: e.weight,
        exam: availableExams.find(ex => ex.id === e.examId)
      }))
    };

    const updated = [newResult, ...results];
    setResults(updated);
    localStorage.setItem(`befaq_final_results_${madrasah?.id}`, JSON.stringify(updated));
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
      localStorage.setItem(`befaq_final_results_${madrasah?.id}`, JSON.stringify(updated));
    }
  };

  const getDivision = (percentage: number) => {
    if (percentage >= 80) return 'মুমতাজ';
    if (percentage >= 65) return 'জায়্যিদ জিদ্দান';
    if (percentage >= 50) return 'জায়্যিদ';
    if (percentage >= 40) return 'মকবুল';
    return 'রাসিব';
  };

  const calculateResult = async (result: BefaqFinalResult) => {
    setResultLoading(true);
    try {
      // 1. Fetch Students
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', result.class_id)
        .order('roll', { ascending: true });

      if (!students) throw new Error('No students found');

      // 2. Fetch Marks and Subjects for all exams
      const examDataPromises = result.exams.map(async (config) => {
        const { data: marks } = await supabase
          .from('befaq_results')
          .select('*')
          .eq('exam_id', config.exam_id);
        
        const { data: subjects } = await supabase
          .from('befaq_subjects')
          .select('*')
          .eq('exam_id', config.exam_id);
          
        return {
          examId: config.exam_id,
          weight: config.weight,
          marks: marks || [],
          subjects: subjects || []
        };
      });

      const examsData = await Promise.all(examDataPromises);

      // 3. Process Data
      // Get unique subjects (by name) to merge across exams if needed, 
      // but for Befaq usually exams are distinct. 
      // Let's list all subjects from all exams for the table header.
      // If multiple exams have same subject name, we might want to average them or list them separately.
      // For simplicity, let's list unique subject names.
      const uniqueSubjects = new Set<string>();
      examsData.forEach(e => {
        e.subjects.forEach((s: any) => uniqueSubjects.add(s.subject_name));
      });
      const subjectList = Array.from(uniqueSubjects);
      setSubjects(subjectList);

      // Calculate for each student
      const processed = students.map(student => {
        const studentMarks: any = {};
        let totalWeightedMarks = 0;
        let totalPossibleWeightedMarks = 0;

        subjectList.forEach(subName => {
          let weightedSum = 0;
          
          examsData.forEach(exam => {
            const subject = exam.subjects.find((s: any) => s.subject_name === subName);
            if (subject) {
               const markEntry = exam.marks.find((m: any) => 
                 m.student_id === student.id && 
                 m.subject_id === subject.id
               );
               
               if (markEntry) {
                 const obtained = parseFloat(markEntry.marks_obtained);
                 weightedSum += (obtained * exam.weight) / 100;
               }
               
               // Calculate possible weighted marks for this subject
               totalPossibleWeightedMarks += (subject.total_marks * exam.weight) / 100;
            }
          });
          
          studentMarks[subName] = weightedSum.toFixed(2);
          totalWeightedMarks += weightedSum;
        });

        // Calculate Percentage
        // We need total possible marks across all exams/subjects to calculate percentage correctly
        // But simplified: sum of weighted marks is the final score out of 100 if weights sum to 100?
        // No, weight is for the Exam. 
        // Example: Exam A (100 marks) is 50%, Exam B (100 marks) is 50%.
        // Student gets 80 in A, 90 in B.
        // Weighted: (80*0.5) + (90*0.5) = 40 + 45 = 85.
        // So totalWeightedMarks IS the final score out of (Total Possible of Subject * Weight)?
        // Wait, if subjects have different total marks (e.g. 100 vs 50), we should normalize to percentage first?
        // Befaq usually has 100 marks per kitab.
        // Let's assume standard 100 marks for simplicity or normalize.
        
        // Let's stick to: Weighted sum of obtained marks.
        // And for division, we need percentage.
        // Percentage = (Total Weighted Obtained / Total Weighted Possible) * 100
        
        // Re-calculating total possible weighted marks correctly:
        let grandTotalPossible = 0;
        examsData.forEach(exam => {
            const examTotal = exam.subjects.reduce((sum: number, s: any) => sum + s.total_marks, 0);
            grandTotalPossible += (examTotal * exam.weight) / 100;
        });

        const percentage = grandTotalPossible > 0 ? (totalWeightedMarks / grandTotalPossible) * 100 : 0;
        const division = getDivision(percentage);

        return {
          ...student,
          marks: studentMarks,
          total: totalWeightedMarks.toFixed(2),
          percentage: percentage.toFixed(2),
          division,
          grandTotalPossible
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

  const handleDownloadPDF = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!viewResult || !madrasah) return;

    try {
      // Use existing PDF generator but maybe we need a Befaq specific one?
      // For now, reuse the generic one, passing division as grade
      const pdfData = calculatedData.map(d => ({
          ...d,
          grade: d.division, // Map division to grade field for PDF
          gpa: d.percentage + '%' // Map percentage to GPA field
      }));

      await generateFinalResultPDF(
          viewResult.title,
          classes.find(c => c.id === viewResult.class_id)?.class_name || '',
          subjects,
          pdfData,
          { name: madrasah.name },
          downloadLang
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading PDF');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={viewResult ? () => setViewResult(null) : onBack} className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">
            {viewResult ? viewResult.title : 'চূড়ান্ত ফলাফল (বেফাক)'}
          </h1>
        </div>
        {!viewResult && (
          <button onClick={() => setShowCreate(true)} className="w-10 h-10 bg-emerald-600 text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
            <Plus size={20}/>
          </button>
        )}
        {viewResult && (
          <button onClick={() => {
              setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadPDF(l));
              setShowDownloadLangModal(true);
          }} className="w-10 h-10 bg-emerald-600 text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
            <Download size={20}/>
          </button>
        )}
      </div>

      {!viewResult && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600" /></div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
                <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                <p>কোনো চূড়ান্ত ফলাফল তৈরি করা হয়নি</p>
            </div>
          ) : (
            results.map(result => (
              <div key={result.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-[#1E3A8A] font-noto">{result.title}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {classes.find(c => c.id === result.class_id)?.class_name} • {result.exams?.length} Exams
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewResult(result)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
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
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>
          ) : (
            <div className="bg-white p-5 rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">মেধা</th>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">রোল/নাম</th>
                    {subjects.map(s => (
                      <th key={s} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px]">{s}</th>
                    ))}
                    <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center">মোট</th>
                    <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center">বিভাগ</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedData.map((student) => (
                    <tr key={student.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-4 pr-4 font-black text-emerald-600">#{student.rank}</td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 leading-none mb-1">রোল: {student.roll}</span>
                          <span className="font-black text-[#1E3A8A] text-xs font-noto truncate max-w-[120px]">{student.student_name}</span>
                        </div>
                      </td>
                      {subjects.map(sub => (
                        <td key={sub} className="py-4 px-2 text-center font-black text-slate-600 text-xs">
                          {student.marks[sub] || '-'}
                        </td>
                      ))}
                      <td className="py-4 px-2 text-center font-black text-emerald-600 text-xs">{student.total}</td>
                      <td className="py-4 px-2 text-center font-black text-purple-600 text-xs">{student.division}</td>
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-black text-[#1E293B] mb-4 text-center">Select Language / ভাষা নির্বাচন করুন</h3>
                  <div className="space-y-3">
                      <button 
                          onClick={() => {
                              if (downloadAction) downloadAction('en');
                              setShowDownloadLangModal(false);
                          }}
                          className="w-full py-3 bg-blue-50 text-[#2563EB] font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                      >
                          English
                      </button>
                      <button 
                          onClick={() => {
                              if (downloadAction) downloadAction('bn');
                              setShowDownloadLangModal(false);
                          }}
                          className="w-full py-3 bg-emerald-50 text-emerald-600 font-bold rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
                      >
                          বাংলা (Bengali)
                      </button>
                      <button 
                          onClick={() => setShowDownloadLangModal(false)}
                          className="w-full py-3 bg-slate-50 text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors mt-4"
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1E3A8A]">নতুন চূড়ান্ত ফলাফল</h3>
              <button onClick={() => setShowCreate(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">ফলাফলের নাম</label>
                <input type="text" className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20" placeholder="উদাহরণ: বার্ষিক ফলাফল ২০২৪" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">মারহালা (ক্লাস)</label>
                <select className="w-full h-12 bg-slate-50 rounded-xl px-4 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                  <option value="">মারহালা নির্বাচন করুন</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>

              {selectedClassId && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">পরীক্ষা ও গুরুত্ব (Weight) নির্বাচন করুন</label>
                  {availableExams.map(exam => {
                    const isSelected = selectedExams.some(e => e.examId === exam.id);
                    const weight = selectedExams.find(e => e.examId === exam.id)?.weight || 0;

                    return (
                      <div key={exam.id} className={`p-4 rounded-2xl border transition-all ${isSelected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-[#1E3A8A] text-sm">{exam.exam_name}</span>
                          <button 
                            onClick={() => {
                              if (isSelected) {
                                setSelectedExams(selectedExams.filter(e => e.examId !== exam.id));
                              } else {
                                setSelectedExams([...selectedExams, { examId: exam.id, weight: 0 }]);
                              }
                            }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-transparent'}`}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              className="w-20 h-8 bg-white rounded-lg px-2 font-black text-xs outline-none border border-emerald-200 text-center" 
                              placeholder="0"
                              value={weight || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setSelectedExams(selectedExams.map(ex => ex.examId === exam.id ? { ...ex, weight: val } : ex));
                              }}
                            />
                            <span className="text-xs font-black text-emerald-400">% Weight</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div className="flex items-center justify-between px-2 pt-2">
                    <span className="text-xs font-black text-slate-400">মোট গুরুত্ব:</span>
                    <span className={`text-sm font-black ${selectedExams.reduce((sum, e) => sum + e.weight, 0) === 100 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedExams.reduce((sum, e) => sum + e.weight, 0)}%
                    </span>
                  </div>
                </div>
              )}

              <button onClick={handleSave} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save size={20} /> ফলাফল সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BefaqFinalResults;
