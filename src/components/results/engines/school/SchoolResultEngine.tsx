import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Student, Exam, ExamSubject, Language, UserRole, ExamRoom, SeatAssignment, Profile } from 'types';
import { GraduationCap, Plus, ChevronRight, BookOpen, Trophy, Save, X, Edit3, Trash2, Loader2, ArrowLeft, Calendar, LayoutGrid, CheckCircle2, FileText, Send, User, Hash, Star, AlertCircle, TrendingUp, Download, CreditCard, Grid3X3, Printer, RefreshCw } from 'lucide-react';
import { t } from 'translations';
import { sortMadrasahClasses } from '../../../../pages/Classes';
import SmartResultAnalytics from '../../../../components/SmartResultAnalytics';
import FinalResults from './FinalResults';
import { generateSeatPlanPDF, generateResultPDF, generateClassResultPDF } from '../../../../utils/pdfGenerator';
import { generateAdmitCardPDF } from '../../../../utils/admitCardGenerator';

interface SchoolResultEngineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  onNavigateToFinalResults?: () => void;
  profile?: Profile | null;
}

const SchoolResultEngine: React.FC<SchoolResultEngineProps> = ({ lang, madrasah, onBack, role, onNavigateToFinalResults, profile }) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'final-results' | 'seat-plan' | 'analytics'>('exams');
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report'>('list');
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [marksData, setMarksData] = useState<any>({});
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Seat Plan State
  const [rooms, setRooms] = useState<ExamRoom[]>([{ id: '1', room_name: 'Room 101', capacity: 30 }]);
  const [seatAssignments, setSeatAssignments] = useState<SeatAssignment[]>([]);
  const [selectedClassesForSeatPlan, setSelectedClassesForSeatPlan] = useState<string[]>([]);
  const [seatPlanConfig, setSeatPlanConfig] = useState({
      randomize: false
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);

  // Form states
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState('');
  const [subName, setSubName] = useState('');
  const [fullMarks, setFullMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('33');

  useEffect(() => {
    if (madrasah) {
      fetchExams();
      fetchClasses();
    }
  }, [madrasah?.id, view]);

  const fetchExams = async () => {
    const { data } = await supabase.from('exams').select('*, classes(class_name)').eq('institution_id', madrasah?.id).order('created_at', { ascending: false });
    if (data) {
      let filteredExams = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredExams = data.filter(exam => profile.permissions?.allowed_classes?.includes(exam.class_id));
      }
      setExams(filteredExams);
    }
    setLoading(false);
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

  const fetchSubjects = async (examId: string) => {
    setLoading(true);
    const { data } = await supabase.from('exam_subjects').select('*').eq('exam_id', examId);
    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchMarkEntryData = async (examId: string, classId: string) => {
    setLoading(true);
    // 1. Fetch Students of the exam's class
    const { data: stds } = await supabase.from('students').select('*').eq('class_id', classId).order('roll', { ascending: true });
    // 2. Fetch existing marks
    const { data: marks } = await supabase.from('exam_marks').select('*').eq('exam_id', examId);
    
    if (stds) setStudents(stds);
    if (marks) {
        const initialMarks: any = {};
        marks.forEach(m => {
            if (!initialMarks[m.student_id]) initialMarks[m.student_id] = {};
            initialMarks[m.student_id][m.subject_id] = m.marks_obtained;
        });
        setMarksData(initialMarks);
    }
    setLoading(false);
  };

  const fetchRanking = async (examId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.rpc('get_exam_ranking', { p_exam_id: examId });
      setRankingData(data || []);
    } catch (e) {
      console.error(e);
      setRankingData([]);
    }
    setLoading(false);
  };

  const getGradeInfo = (totalMarks: number, passStatus: boolean) => {
    if (!passStatus) return { gpa: '0.00', grade: 'F' };
    
    const totalPossible = subjects.reduce((sum, s) => sum + s.full_marks, 0);
    if (totalPossible === 0) return { gpa: '0.00', grade: 'N/A' };
    
    const percentage = (totalMarks / totalPossible) * 100;
    
    if (percentage >= 80) return { gpa: '5.00', grade: 'A+' };
    if (percentage >= 70) return { gpa: '4.00', grade: 'A' };
    if (percentage >= 60) return { gpa: '3.50', grade: 'A-' };
    if (percentage >= 50) return { gpa: '3.00', grade: 'B' };
    if (percentage >= 40) return { gpa: '2.00', grade: 'C' };
    if (percentage >= 33) return { gpa: '1.00', grade: 'D' };
    return { gpa: '0.00', grade: 'F' };
  };

  // Template Configurations
  const admitCardTemplates = [
    { id: 'classic', name: 'Classic', description: 'Traditional layout with border' },
    { id: 'modern', name: 'Modern', description: 'Clean design with accent colors' },
    { id: 'minimal', name: 'Minimal', description: 'Simple, ink-saving design' }
  ];

  const seatPlanTemplates = [
    { id: 'list', name: 'List View', description: 'Room-wise student list (Wall Posting)' },
    { id: 'grid', name: 'Grid View', description: 'Visual seat arrangement' }
  ];

  const [showAdmitCardModal, setShowAdmitCardModal] = useState(false);
  const [selectedAdmitCardTemplate, setSelectedAdmitCardTemplate] = useState('classic');
  const [selectedSeatPlanTemplate, setSelectedSeatPlanTemplate] = useState('list');
  const [examForAdmitCard, setExamForAdmitCard] = useState<Exam | null>(null);

  const handleDownloadAdmitCard = (exam: Exam) => {
      setExamForAdmitCard(exam);
      setShowAdmitCardModal(true);
  };

  const confirmDownloadAdmitCard = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!madrasah || !examForAdmitCard) return;
    
    setIsDownloading(true);
    try {
        // Fetch students for the exam class
        const { data: stds } = await supabase.from('students').select('*, classes(class_name)').eq('class_id', examForAdmitCard.class_id).order('roll', { ascending: true });
        
        if (!stds || stds.length === 0) {
            alert('No students found for this class');
            setIsDownloading(false);
            return;
        }

        await generateAdmitCardPDF(
            examForAdmitCard,
            stds,
            { name: madrasah.name, logo_url: madrasah.logo_url },
            selectedAdmitCardTemplate,
            downloadLang
        );
        setShowAdmitCardModal(false);
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading Admit Cards');
    } finally {
        setIsDownloading(false);
    }
  };

  const handleGenerateSeatPlan = async () => {
      if (selectedClassesForSeatPlan.length === 0) {
          alert('Please select at least one class');
          return;
      }
      
      setLoading(true);
      // Fetch students from selected classes
      const { data: stds } = await supabase.from('students')
        .select('*, classes(class_name)')
        .in('class_id', selectedClassesForSeatPlan)
        .order('class_id', { ascending: true })
        .order('roll', { ascending: true });
        
      if (!stds || stds.length === 0) {
          setLoading(false);
          alert('No students found');
          return;
      }

      let studentsToAssign = [...stds];
      if (seatPlanConfig.randomize) {
          studentsToAssign = studentsToAssign.sort(() => Math.random() - 0.5);
      }

      const assignments: SeatAssignment[] = [];
      let currentRoomIndex = 0;
      let currentSeat = 1;

      for (const student of studentsToAssign) {
          if (currentRoomIndex >= rooms.length) break; // No more rooms

          const room = rooms[currentRoomIndex];
          
          assignments.push({
              student_id: student.id,
              student_name: student.student_name,
              class_name: student.classes?.class_name || '',
              roll: student.roll || 0,
              room_name: room.room_name,
              seat_number: currentSeat
          });

          currentSeat++;
          if (currentSeat > room.capacity) {
              currentRoomIndex++;
              currentSeat = 1;
          }
      }

      setSeatAssignments(assignments);
      setLoading(false);
  };

  const handleDownloadSeatPlan = async (downloadLang: 'en' | 'bn' = lang) => {
      if (seatAssignments.length === 0) return;
      
      setIsDownloading(true);
      try {
        await generateSeatPlanPDF(
            seatAssignments,
            { name: madrasah?.name || 'Madrasah' },
            selectedSeatPlanTemplate,
            downloadLang
        );
      } catch (e) {
          console.error(e);
          alert('Error downloading Seat Plan');
      } finally {
          setIsDownloading(false);
      }
  };

  const handleAddExam = async () => {
    if (!madrasah || !examName || !classId) return;
    setIsSaving(true);
    try {
      const selectedClass = classes.find(c => c.id === classId);
      const examData = {
        institution_id: madrasah.id,
        class_id: classId,
        exam_name: examName,
        exam_date: examDate
      };

      let error;
      if (editingExam) {
        const { error: updateError } = await supabase
          .from('exams')
          .update(examData)
          .eq('id', editingExam.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('exams')
          .insert(examData);
        error = insertError;
      }
      
      if (error) {
          console.error('Error saving exam:', error);
          alert('Failed to save exam: ' + error.message);
      } else {
        setShowAddExam(false);
        setEditingExam(null);
        setExamName('');
        setClassId('');
        fetchExams();
      }
    } catch (e) {
        console.error('Unexpected error:', e);
        alert('An unexpected error occurred');
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditClick = (exam: Exam) => {
    setEditingExam(exam);
    setExamName(exam.exam_name);
    setExamDate(exam.exam_date);
    setClassId(exam.class_id);
    setShowAddExam(true);
  };

  const handleDeleteExam = async (examId: string) => {
    setIsSaving(true);
    try {
      // Delete marks first
      await supabase.from('exam_marks').delete().eq('exam_id', examId);
      // Delete subjects
      await supabase.from('exam_subjects').delete().eq('exam_id', examId);
      // Delete exam
      const { error } = await supabase.from('exams').delete().eq('id', examId);
      
      if (error) {
        console.error('Error deleting exam:', error);
        alert('Failed to delete exam: ' + error.message);
      } else {
        fetchExams();
      }
    } catch (e) {
      console.error('Unexpected error:', e);
      alert('An unexpected error occurred');
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
      setExamToDelete(null);
    }
  };

  const handleAddSubject = async () => {
    if (!selectedExam || !subName) return;
    setIsSaving(true);
    const { error } = await supabase.from('exam_subjects').insert({
      exam_id: selectedExam.id,
      subject_name: subName,
      full_marks: parseInt(fullMarks),
      pass_marks: parseInt(passMarks)
    });
    if (!error) {
      setShowAddSubject(false);
      setSubName('');
      fetchSubjects(selectedExam.id);
    }
    setIsSaving(false);
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setIsSaving(true);
    const payload: any[] = [];
    Object.entries(marksData).forEach(([studentId, subMarks]: any) => {
        Object.entries(subMarks).forEach(([subjectId, marks]) => {
            payload.push({
                exam_id: selectedExam.id,
                student_id: studentId,
                subject_id: subjectId,
                marks_obtained: parseFloat(marks as string)
            });
        });
    });

    // Upsert logic
    for (const row of payload) {
        await supabase.from('exam_marks').upsert(row);
    }
    alert(t('success', lang));
    setIsSaving(false);
  };

  const handleDownloadClassResult = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!selectedExam || !madrasah) return;
    
    setIsDownloading(true);
    // Ensure we have marks data
    if (Object.keys(marksData).length === 0) {
        await fetchMarkEntryData(selectedExam.id, selectedExam.class_id);
    }

    try {
      await generateClassResultPDF(
          selectedExam,
          subjects,
          students,
          marksData,
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative">
      {/* Download Indicator */}
      {isDownloading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-white/90 backdrop-blur-md border border-blue-100 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <div className="relative">
                    <Loader2 className="animate-spin text-blue-600" size={20} />
                    <div className="absolute inset-0 bg-blue-400/20 blur-sm rounded-full animate-pulse"></div>
                </div>
                <span className="text-[11px] font-black text-[#1E3A8A] uppercase tracking-widest">ডাউনলোড হচ্ছে...</span>
            </div>
        </div>
      )}

      {/* Loading Overlay */}
      {(loading || isSaving) && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-blue-900 font-black tracking-widest uppercase text-sm animate-pulse">
            {lang === 'bn' ? 'অপেক্ষা করুন...' : 'Please Wait...'}
          </p>
        </div>
      )}
      {activeTab !== 'final-results' && (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? onBack : () => setView('list')} className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#2563EB] border border-blue-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">
            {activeTab === 'exams' && view === 'list' ? t('exams', lang) : 
             activeTab === 'exams' && selectedExam ? selectedExam.exam_name :
             activeTab === 'seat-plan' ? 'Seat Plan' :
             activeTab === 'analytics' ? t('prediction_system', lang) : t('exams', lang)}
          </h1>
          {activeTab === 'exams' && view === 'report' && (
              <button onClick={() => {
                  setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadClassResult(l));
                  setShowDownloadLangModal(true);
              }} className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors">
                  <Download size={20} />
              </button>
          )}
        </div>
        {activeTab === 'exams' && view === 'list' && role === 'madrasah_admin' && (
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('final-results')} className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 shadow-sm active:scale-95 transition-all" title="Final Results">
                  <Trophy size={20} />
                </button>
                <button onClick={() => setShowAddExam(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
            </div>
        )}
      </div>
      )}

      {activeTab !== 'final-results' && (
      <div className="flex p-1.5 bg-slate-50 rounded-[1.5rem] border border-slate-100 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('exams')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'exams' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            {t('exams', lang)}
        </button>
        <button onClick={() => setActiveTab('seat-plan')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'seat-plan' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            Seat Plan
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'analytics' ? 'bg-[#2563EB] text-white shadow-premium' : 'text-slate-400'}`}>
            Analytics
        </button>
      </div>
      )}

      {activeTab === 'analytics' && madrasah && (
          <SmartResultAnalytics institutionId={madrasah.id} lang={lang} madrasah={madrasah} />
      )}

      {activeTab === 'final-results' && (
          <FinalResults lang={lang} madrasah={madrasah} role={role} onBack={() => setActiveTab('exams')} />
      )}

      {activeTab === 'seat-plan' && (
        <div className="space-y-6">
            {/* Configuration Section */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-6">
                <h3 className="text-lg font-black text-[#1E3A8A] font-noto">Seat Plan Configuration</h3>
                
                {/* Class Selection */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Classes</label>
                    <div className="flex flex-wrap gap-2">
                        {classes.map(c => (
                            <button 
                                key={c.id}
                                onClick={() => {
                                    if (selectedClassesForSeatPlan.includes(c.id)) {
                                        setSelectedClassesForSeatPlan(prev => prev.filter(id => id !== c.id));
                                    } else {
                                        setSelectedClassesForSeatPlan(prev => [...prev, c.id]);
                                    }
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${selectedClassesForSeatPlan.includes(c.id) ? 'bg-blue-50 text-[#2563EB] border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                            >
                                {c.class_name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Room Configuration */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rooms & Capacity</label>
                    {rooms.map((room, idx) => (
                        <div key={room.id} className="flex gap-2">
                            <input 
                                type="text" 
                                value={room.room_name}
                                onChange={(e) => {
                                    const newRooms = [...rooms];
                                    newRooms[idx].room_name = e.target.value;
                                    setRooms(newRooms);
                                }}
                                className="flex-1 h-10 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold outline-none"
                                placeholder="Room Name"
                            />
                            <input 
                                type="number" 
                                value={room.capacity}
                                onChange={(e) => {
                                    const newRooms = [...rooms];
                                    newRooms[idx].capacity = parseInt(e.target.value) || 0;
                                    setRooms(newRooms);
                                }}
                                className="w-24 h-10 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold outline-none"
                                placeholder="Capacity"
                            />
                            <button onClick={() => setRooms(rooms.filter((_, i) => i !== idx))} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setRooms([...rooms, { id: Date.now().toString(), room_name: `Room ${101 + rooms.length}`, capacity: 30 }])} className="text-xs font-black text-[#2563EB] flex items-center gap-1 mt-2">
                        <Plus size={14}/> Add Room
                    </button>
                </div>

                {/* Options */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template</label>
                    <div className="grid grid-cols-2 gap-2">
                        {seatPlanTemplates.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setSelectedSeatPlanTemplate(t.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedSeatPlanTemplate === t.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                            >
                                <div className={`font-black text-xs ${selectedSeatPlanTemplate === t.id ? 'text-[#2563EB]' : 'text-slate-600'}`}>{t.name}</div>
                                <div className="text-[10px] text-slate-400 mt-1">{t.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        checked={seatPlanConfig.randomize}
                        onChange={(e) => setSeatPlanConfig(prev => ({ ...prev, randomize: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <label className="text-xs font-bold text-slate-600">Randomize Seating</label>
                </div>

                <button onClick={handleGenerateSeatPlan} disabled={loading} className="w-full h-14 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {loading && seatAssignments.length === 0 ? <Loader2 className="animate-spin" /> : <><RefreshCw size={20}/> Generate Seat Plan</>}
                </button>
            </div>

            {/* Results */}
            {seatAssignments.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-[#1E3A8A] font-noto">Generated Plan</h3>
                        <button onClick={() => {
                            setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadSeatPlan(l));
                            setShowDownloadLangModal(true);
                        }} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs flex items-center gap-2 border border-emerald-100">
                            <Printer size={16}/> Print / Download
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rooms.map(room => {
                            const roomAssignments = seatAssignments.filter(sa => sa.room_name === room.room_name);
                            if (roomAssignments.length === 0) return null;
                            
                            return (
                                <div key={room.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-[#1E3A8A]">{room.room_name}</h4>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{roomAssignments.length} / {room.capacity}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {roomAssignments.map(sa => (
                                            <div key={sa.student_id} className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                                                <div className="text-[10px] font-black text-[#2563EB] mb-0.5">Seat {sa.seat_number}</div>
                                                <div className="text-[9px] font-bold text-slate-600 truncate">{sa.student_name}</div>
                                                <div className="text-[8px] font-bold text-slate-400">{sa.class_name} (Roll: {sa.roll})</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}

      {activeTab === 'exams' && view === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div> : exams.map(exam => (
            <div key={exam.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center shadow-inner"><GraduationCap size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black text-[#1E3A8A] font-noto leading-tight">{exam.exam_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</span>
                                {exam.is_published && <span className="px-2 py-0.5 bg-green-50 text-green-500 rounded-full text-[8px] font-black uppercase">Published</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-[10px] font-black text-slate-300 uppercase">{new Date(exam.exam_date).toLocaleDateString('bn-BD')}</div>
                        {role === 'madrasah_admin' && (
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick(exam)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">
                                <Edit3 size={14} />
                            </button>
                            <button onClick={() => { setExamToDelete(exam.id); setShowDeleteConfirm(true); }} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 active:scale-95 transition-all">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.class_id); }} className="py-2.5 bg-blue-50 text-[#2563EB] rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-100 active:scale-95 transition-all">{t('enter_marks', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('report'); fetchSubjects(exam.id); fetchRanking(exam.id); fetchMarkEntryData(exam.id, exam.class_id); }} className="py-2.5 bg-[#2563EB] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-premium active:scale-95 transition-all">{t('rank', lang)}</button>
                </div>
                <button onClick={() => handleDownloadAdmitCard(exam)} className="w-full py-2.5 bg-purple-50 text-purple-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-purple-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <CreditCard size={14}/> Admit Card
                </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'exams' && view === 'subjects' && (
        <div className="space-y-4">
           <button onClick={() => setShowAddSubject(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-[#2563EB] font-black flex items-center justify-center gap-3 shadow-bubble border border-slate-100 active:scale-95 transition-all">
              <Plus size={24} strokeWidth={3} /> বিষয় যোগ করুন
           </button>
           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {subjects.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className="font-black text-[#1E3A8A] font-noto text-lg">{s.subject_name}</h5>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">পূর্ণমান: {s.full_marks}</p>
                      <p className="text-[9px] font-black text-red-400 uppercase">পাস: {s.pass_marks}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'exams' && view === 'marks' && (
        <div className="space-y-4">
            <div className="bg-white p-5 rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase pr-4">Roll/Name</th>
                            {subjects.map(s => (
                                <th key={s.id} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[80px]">{s.subject_name}</th>
                            ))}
                            <th className="py-4 text-[10px] font-black text-blue-400 uppercase text-center min-w-[60px]">{t('total_marks', lang)}</th>
                            <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center min-w-[60px]">{t('average', lang)}</th>
                            <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center min-w-[60px]">{t('gpa', lang)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => (
                            <tr key={std.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 pr-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-[#2563EB] leading-none mb-1">#{std.roll}</span>
                                        <span className="font-black text-[#1E3A8A] text-xs font-noto truncate max-w-[100px]">{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map(sub => (
                                    <td key={sub.id} className="py-4 px-2">
                                        <input 
                                            type="number" 
                                            className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs outline-none focus:border-[#2563EB] transition-all"
                                            value={marksData[std.id]?.[sub.id] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setMarksData(prev => ({
                                                    ...prev,
                                                    [std.id]: {
                                                        ...prev[std.id],
                                                        [sub.id]: val
                                                    }
                                                }));
                                            }}
                                        />
                                    </td>
                                ))}
                                <td className="py-4 px-2 text-center font-black text-[#1E3A8A] text-xs">
                                    {(Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0)}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-[#2563EB] text-xs">
                                    {subjects.length > 0 ? ((Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0) / subjects.length).toFixed(1) : '0'}
                                </td>
                                <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">
                                    {(() => {
                                        const total = (Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0);
                                        const passStatus = subjects.length > 0 && subjects.every(sub => {
                                            const mark = parseFloat((marksData[std.id] || {})[sub.id] || '0');
                                            return mark >= sub.pass_marks;
                                        });
                                        return getGradeInfo(total, passStatus).gpa;
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {activeTab === 'exams' && view === 'report' && (
          <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#2563EB]" size={40} /></div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] p-6 rounded-[2.5rem] text-white flex items-center justify-between shadow-premium">
                      <div>
                          <p className="text-[10px] font-black uppercase opacity-60">সেরা ফলাফল</p>
                          <h3 className="text-2xl font-black font-noto">{rankingData[0]?.student_name || 'N/A'}</h3>
                      </div>
                      <Trophy size={40} className="text-amber-300" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                      {rankingData.map((item: any) => (
                          <div key={item.student_id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                              <div className="flex items-center gap-4 min-w-0">
                                  <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-xl flex items-center justify-center font-black shrink-0">{item.rank}</div>
                                  <div className="min-w-0">
                                      <h5 className="font-black text-[#1E3A8A] font-noto truncate leading-none mb-1">{item.student_name}</h5>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Roll: {item.roll} | {t('total_marks', lang)}: {item.total_marks} | {t('average', lang)}: {subjects.length > 0 ? (item.total_marks / subjects.length).toFixed(2) : '0'}
                                      </p>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${item.pass_status ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                     {item.pass_status ? (lang === 'bn' ? 'পাস' : 'Passed') : (lang === 'bn' ? 'ফেল' : 'Failed')}
                                  </div>
                                  {item.pass_status && (
                                    <div className="flex gap-1.5">
                                       <span className="px-2 py-0.5 bg-blue-50 text-[#2563EB] rounded-lg text-[8px] font-black border border-blue-100">{t('gpa', lang)}: {getGradeInfo(item.total_marks, item.pass_status).gpa}</span>
                                       <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-lg text-[8px] font-black border border-purple-100">{t('grade', lang)}: {getGradeInfo(item.total_marks, item.pass_status).grade}</span>
                                    </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                </>
              )}
          </div>
      )}

      {/* MODALS */}
      {showAdmitCardModal && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">Select Admit Card Template</h3>
               <button onClick={() => setShowAdmitCardModal(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             
             <div className="space-y-3">
                {admitCardTemplates.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setSelectedAdmitCardTemplate(t.id)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${selectedAdmitCardTemplate === t.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                    >
                        <div>
                            <div className={`font-black text-sm ${selectedAdmitCardTemplate === t.id ? 'text-[#2563EB]' : 'text-slate-700'}`}>{t.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{t.description}</div>
                        </div>
                        {selectedAdmitCardTemplate === t.id && <CheckCircle2 className="text-[#2563EB]" size={20} />}
                    </button>
                ))}
             </div>

             <button onClick={() => {
                 setDownloadAction(() => (l: 'en' | 'bn') => confirmDownloadAdmitCard(l));
                 setShowDownloadLangModal(true);
             }} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
               <Download size={20}/> Download Admit Cards
             </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-[#1E293B] text-center mb-2 font-noto">আপনি কি নিশ্চিত?</h3>
            <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">এই পরীক্ষাটি ডিলিট করলে এর সাথে সম্পর্কিত সকল বিষয় ও নম্বর মুছে যাবে। এটি আর ফিরে পাওয়া যাবে না।</p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowDeleteConfirm(false); setExamToDelete(null); }}
                className="flex-1 h-12 bg-slate-50 text-slate-500 font-black rounded-xl active:scale-95 transition-all"
              >
                বাতিল
              </button>
              <button 
                onClick={() => examToDelete && handleDeleteExam(examToDelete)}
                disabled={isSaving}
                className="flex-1 h-12 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'ডিলিট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDownloadLangModal && (
          <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[1100] flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                  {/* Decorative Background */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full -ml-12 -mb-12 opacity-50"></div>

                  <div className="relative z-10">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 rotate-3">
                          <Download className="text-white" size={32} strokeWidth={2.5} />
                      </div>
                      
                      <div className="text-center mb-8">
                          <h3 className="text-2xl font-black text-[#1E3A8A] leading-tight">Select Language</h3>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">ডাউনলোড ভাষা নির্বাচন করুন</p>
                      </div>
                      
                      <div className="space-y-3">
                          <button 
                              onClick={async () => {
                                  if (downloadAction) {
                                      setShowDownloadLangModal(false);
                                      setShowAdmitCardModal(false);
                                      await downloadAction('bn');
                                  }
                              }}
                              className="w-full group relative overflow-hidden py-5 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                          >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                              <span className="relative z-10 text-lg">বাংলা (Bengali)</span>
                          </button>

                          <button 
                              onClick={async () => {
                                  if (downloadAction) {
                                      setShowDownloadLangModal(false);
                                      setShowAdmitCardModal(false);
                                      await downloadAction('en');
                                  }
                              }}
                              className="w-full group relative overflow-hidden py-5 bg-[#2563EB] text-white font-black rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                          >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                              <span className="relative z-10 text-lg">English</span>
                          </button>

                          <button 
                              onClick={() => setShowDownloadLangModal(false)}
                              className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:text-slate-600 transition-colors mt-2 active:scale-95"
                          >
                              Cancel / বাতিল
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showAddExam && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">{editingExam ? 'পরীক্ষা এডিট করুন' : 'নতুন পরীক্ষা যোগ করুন'}</h3>
               <button onClick={() => { setShowAddExam(false); setEditingExam(null); setExamName(''); setClassId(''); }} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="পরীক্ষার নাম (যেমন: বার্ষিক পরীক্ষা)" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="date" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" value={examDate} onChange={(e) => setExamDate(e.target.value)} /><Calendar className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative">
                    <select className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 appearance-none transition-all" value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">ক্লাস বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300" size={20}/>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20}/> {editingExam ? 'আপডেট করুন' : 'পরীক্ষা তৈরি করুন'}</>}
                </button>
             </div>
          </div>
        </div>
      )}

      {showAddSubject && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">বিষয় যোগ করুন</h3>
               <button onClick={() => setShowAddSubject(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="বিষয়ের নাম (যেমন: কুরআন)" value={subName} onChange={(e) => setSubName(e.target.value)} /><BookOpen size={20} className="absolute left-4 top-4 text-slate-300" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="পূর্ণমান" value={fullMarks} onChange={(e) => setFullMarks(e.target.value)} /><Star className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-[#2563EB]/20 transition-all" placeholder="পাস" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} /><AlertCircle className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                </div>
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'বিষয় সেভ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolResultEngine;
