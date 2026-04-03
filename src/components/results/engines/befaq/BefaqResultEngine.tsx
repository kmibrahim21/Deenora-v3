import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Student, BefaqExam, BefaqSubject, Language, UserRole, Profile } from 'types';
import { GraduationCap, Plus, BookOpen, Trophy, Save, X, Loader2, ArrowLeft, Calendar, LayoutGrid, Download, CreditCard, Trash2, RefreshCw, Edit2, TrendingUp, AlertCircle } from 'lucide-react';
import { t } from 'translations';
import SmartResultAnalytics from '../../../../components/SmartResultAnalytics';
import { generateAdmitCardPDF } from '../../../../utils/admitCardGenerator';
import { generateSeatPlanPDF } from '../../../../utils/pdfGenerator';
import { SeatAssignment, ExamRoom } from 'types';
import { sortMadrasahClasses } from '../../../../pages/Classes';
import FinalResults from './FinalResults';

interface BefaqResultEngineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const BefaqResultEngine: React.FC<BefaqResultEngineProps> = ({ lang, madrasah, onBack, role, profile }) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'analytics' | 'final-results' | 'seat-plan'>('exams');
  const [view, setView] = useState<'list' | 'subjects' | 'marks' | 'report' | 'rank'>('list');
  const [exams, setExams] = useState<BefaqExam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<BefaqExam | null>(null);
  const [subjects, setSubjects] = useState<BefaqSubject[]>([]);
  const [marksData, setMarksData] = useState<any>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [editingExam, setEditingExam] = useState<BefaqExam | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => void) | null>(null);

  // Admit Card States
  const [showAdmitCardModal, setShowAdmitCardModal] = useState(false);
  const [examForAdmitCard, setExamForAdmitCard] = useState<BefaqExam | null>(null);
  const [selectedAdmitCardTemplate, setSelectedAdmitCardTemplate] = useState('classic');

  // Seat Plan States
  const seatPlanTemplates = [
    { id: 'list', name: 'List View', description: 'Room-wise student list (Wall Posting)' },
    { id: 'grid', name: 'Grid View', description: 'Visual seat arrangement' }
  ];
  const [selectedSeatPlanTemplate, setSelectedSeatPlanTemplate] = useState('list');
  const [rooms, setRooms] = useState<ExamRoom[]>([{ id: '1', room_name: 'Room 101', capacity: 30 }]);
  const [seatAssignments, setSeatAssignments] = useState<SeatAssignment[]>([]);
  const [selectedClassesForSeatPlan, setSelectedClassesForSeatPlan] = useState<string[]>([]);
  const [seatPlanConfig, setSeatPlanConfig] = useState({
      randomize: false,
      template: 'list'
  });

  // Form states
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState(new Date().getFullYear().toString());
  const [classId, setClassId] = useState('');
  const [subName, setSubName] = useState('');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('33');

  useEffect(() => {
    if (madrasah) {
      fetchExams();
      fetchClasses();
    }
  }, [madrasah?.id, view]);

  const fetchExams = async () => {
    const { data } = await supabase.from('befaq_exams').select('*, classes(class_name)').eq('institution_id', madrasah?.id).order('created_at', { ascending: false });
    if (data) {
      let filteredExams = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredExams = data.filter(exam => profile.permissions?.allowed_classes?.includes(exam.marhala_id));
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
    const { data } = await supabase.from('befaq_subjects').select('*').eq('exam_id', examId);
    if (data) setSubjects(data);
    setLoading(false);
  };

  const fetchMarkEntryData = async (examId: string, classId: string) => {
    setLoading(true);
    const { data: stds } = await supabase.from('students').select('*').eq('class_id', classId).order('roll', { ascending: true });
    const { data: marks } = await supabase.from('befaq_results').select('*').eq('exam_id', examId);
    
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

  const handleDownloadAdmitCard = (exam: BefaqExam) => {
      setExamForAdmitCard(exam);
      setShowAdmitCardModal(true);
  };

  const confirmDownloadAdmitCard = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!madrasah || !examForAdmitCard) return;
    
    // Fetch students for the exam class
    const { data: stds } = await supabase.from('students').select('*, classes(class_name)').eq('class_id', examForAdmitCard.marhala_id).order('roll', { ascending: true });
    
    if (!stds || stds.length === 0) {
        alert('No students found for this class');
        return;
    }

    try {
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
      if (seatAssignments.length === 0 || !madrasah) return;
      try {
          await generateSeatPlanPDF(seatAssignments, { name: madrasah.name }, selectedSeatPlanTemplate, downloadLang);
      } catch (error) {
          console.error('Download error:', error);
          alert('Error downloading Seat Plan');
      }
  };

  const handleAddExam = async () => {
    if (!madrasah || !examName || !classId) {
        alert('Please fill all fields');
        return;
    }
    setIsSaving(true);
    try {
        const selectedClass = classes.find(c => c.id === classId);
        const examData = {
          institution_id: madrasah.id,
          marhala_id: classId,
          class_name: selectedClass?.class_name || 'Unknown',
          exam_name: examName,
          exam_year: examYear,
          is_active: true
        };

        let error;
        if (editingExam) {
          const { error: updateError } = await supabase
            .from('befaq_exams')
            .update(examData)
            .eq('id', editingExam.id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('befaq_exams')
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

  const handleEditClick = (exam: BefaqExam) => {
    setEditingExam(exam);
    setExamName(exam.exam_name);
    setExamYear(exam.exam_year);
    setClassId(exam.marhala_id);
    setShowAddExam(true);
  };

  const handleDeleteExam = async (examId: string) => {
    setIsSaving(true);
    try {
      // Delete results first (if no cascade)
      await supabase.from('befaq_results').delete().eq('exam_id', examId);
      // Delete subjects
      await supabase.from('befaq_subjects').delete().eq('exam_id', examId);
      // Delete exam
      const { error } = await supabase.from('befaq_exams').delete().eq('id', examId);
      
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
    if (!selectedExam || !subName) {
        alert('Please fill all fields');
        return;
    }
    setIsSaving(true);
    try {
        const { error } = await supabase.from('befaq_subjects').insert({
          exam_id: selectedExam.id,
          class_name: selectedExam.classes?.class_name || 'Unknown',
          subject_name: subName,
          total_marks: parseInt(totalMarks),
          passing_marks: parseInt(passingMarks)
        });
        
        if (error) {
            console.error('Error adding subject:', error);
            alert('Failed to add subject: ' + error.message);
        } else {
          setShowAddSubject(false);
          setSubName('');
          fetchSubjects(selectedExam.id);
        }
    } catch (e) {
        console.error('Unexpected error:', e);
        alert('An unexpected error occurred');
    } finally {
        setIsSaving(false);
    }
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

    // Upsert logic - simpler to delete and insert or use upsert if constraint exists
    // Assuming upsert works on (exam_id, student_id, subject_id)
    for (const row of payload) {
        // We need a unique constraint on befaq_results(exam_id, student_id, subject_id) for upsert to work perfectly
        // Or we check if exists. For now, let's try upsert.
        const { error } = await supabase.from('befaq_results').upsert(row, { onConflict: 'exam_id, student_id, subject_id' });
        if (error) console.error(error);
    }
    alert(t('success', lang));
    setIsSaving(false);
  };

  const getDivision = (totalMarks: number, totalPossible: number) => {
    if (totalPossible === 0) return 'N/A';
    const percentage = (totalMarks / totalPossible) * 100;
    
    if (percentage >= 80) return 'মুমতাজ';
    if (percentage >= 65) return 'জায়্যিদ জিদ্দান';
    if (percentage >= 50) return 'জায়্যিদ';
    if (percentage >= 40) return 'মকবুল';
    return 'রাসিব';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {activeTab !== 'final-results' && (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={view === 'list' ? onBack : () => setView('list')} className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">
            {activeTab === 'exams' && view === 'list' ? 'বেফাক পরীক্ষা' : 
             activeTab === 'exams' && selectedExam ? selectedExam.exam_name :
             activeTab === 'seat-plan' ? 'Seat Plan' :
             activeTab === 'analytics' ? 'Result Analytics' : 'বেফাক পরীক্ষা'}
          </h1>
        </div>
        {activeTab === 'exams' && view === 'list' && role === 'madrasah_admin' && (
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('final-results')} className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100 shadow-sm active:scale-95 transition-all" title="চূড়ান্ত ফলাফল">
                  <Trophy size={20} />
                </button>
                <button onClick={() => setShowAddExam(true)} className="w-10 h-10 bg-emerald-600 text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all"><Plus size={20}/></button>
            </div>
        )}
      </div>
      )}

      {activeTab !== 'final-results' && (
      <div className="flex p-1.5 bg-slate-50 rounded-[1.5rem] border border-slate-100 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('exams')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'exams' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
            {t('exams', lang)}
        </button>
        <button onClick={() => setActiveTab('seat-plan')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'seat-plan' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
            Seat Plan
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 min-w-[85px] py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'analytics' ? 'bg-emerald-600 text-white shadow-premium' : 'text-slate-400'}`}>
            Analytics
        </button>
      </div>
      )}

      {activeTab === 'final-results' && (
          <FinalResults lang={lang} madrasah={madrasah} role={role} onBack={() => setActiveTab('exams')} />
      )}

      {activeTab === 'analytics' && madrasah && (
        <SmartResultAnalytics institutionId={madrasah.id} lang={lang} madrasah={madrasah} />
      )}

      {activeTab === 'seat-plan' && (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-6">
                <h3 className="text-lg font-black text-[#1E3A8A] font-noto">Seat Plan Configuration</h3>
                
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
                                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${selectedClassesForSeatPlan.includes(c.id) ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                            >
                                {c.class_name}
                            </button>
                        ))}
                    </div>
                </div>

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
                    <button onClick={() => setRooms([...rooms, { id: Date.now().toString(), room_name: `Room ${101 + rooms.length}`, capacity: 30 }])} className="text-xs font-black text-emerald-600 flex items-center gap-1 mt-2">
                        <Plus size={14}/> Add Room
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template</label>
                    <div className="grid grid-cols-2 gap-2">
                        {seatPlanTemplates.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setSelectedSeatPlanTemplate(t.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedSeatPlanTemplate === t.id ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                            >
                                <div className={`font-black text-xs ${selectedSeatPlanTemplate === t.id ? 'text-emerald-600' : 'text-slate-600'}`}>{t.name}</div>
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
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <label className="text-xs font-bold text-slate-600">Randomize Seating</label>
                </div>

                <button onClick={handleGenerateSeatPlan} disabled={loading} className="w-full h-14 bg-emerald-600 text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                    {loading && seatAssignments.length === 0 ? <Loader2 className="animate-spin" /> : <><RefreshCw size={20}/> Generate Seat Plan</>}
                </button>
            </div>

            {seatAssignments.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-[#1E3A8A] font-noto">Generated Plan</h3>
                        <button onClick={() => {
                            setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadSeatPlan(l));
                            setShowDownloadLangModal(true);
                        }} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs flex items-center gap-2 border border-emerald-100">
                            <Download size={14}/> Download PDF
                        </button>
                    </div>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-bubble overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Room</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Seat</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Student</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Class</th>
                                    <th className="py-3 px-4 font-black text-slate-400 uppercase text-[10px]">Roll</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {seatAssignments.map((a, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="py-3 px-4 font-bold text-[#1E3A8A]">{a.room_name}</td>
                                        <td className="py-3 px-4 font-black text-slate-500">{a.seat_number}</td>
                                        <td className="py-3 px-4 font-bold text-slate-700">{a.student_name}</td>
                                        <td className="py-3 px-4 text-slate-500 text-xs">{a.class_name}</td>
                                        <td className="py-3 px-4 font-black text-slate-400">{a.roll}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      )}

      {activeTab === 'exams' && view === 'list' && (
        <div className="space-y-4">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-600" /></div> : exams.map(exam => (
            <div key={exam.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><GraduationCap size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black text-[#1E3A8A] font-noto leading-tight">{exam.exam_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.classes?.class_name}</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black uppercase">{exam.exam_year}</span>
                            </div>
                        </div>
                    </div>
                    {role === 'madrasah_admin' && (
                    <div className="flex gap-2">
                        <button onClick={() => handleEditClick(exam)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => { setExamToDelete(exam.id); setShowDeleteConfirm(true); }} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors">
                            <Trash2 size={14} />
                        </button>
                    </div>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setSelectedExam(exam); setView('subjects'); fetchSubjects(exam.id); }} className="py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 active:scale-95 transition-all">{t('subject', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('marks'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.marhala_id); }} className="py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100 active:scale-95 transition-all">{t('enter_marks', lang)}</button>
                    <button onClick={() => { setSelectedExam(exam); setView('rank'); fetchSubjects(exam.id); fetchMarkEntryData(exam.id, exam.marhala_id); }} className="py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-premium active:scale-95 transition-all">{t('rank', lang)}</button>
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
           <button onClick={() => setShowAddSubject(true)} className="w-full py-5 bg-white rounded-[2.2rem] text-emerald-600 font-black flex items-center justify-center gap-3 shadow-bubble border border-slate-100 active:scale-95 transition-all">
              <Plus size={24} strokeWidth={3} /> কিতাব যোগ করুন
           </button>
           <div className="space-y-3">
              {subjects.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><BookOpen size={20}/></div>
                      <h5 className="font-black text-[#1E3A8A] font-noto text-lg">{s.subject_name}</h5>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">মোট নম্বর: {s.total_marks}</p>
                      <p className="text-[9px] font-black text-red-400 uppercase">পাস নম্বর: {s.passing_marks}</p>
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
                            <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center min-w-[60px]">মোট</th>
                            <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center min-w-[60px]">বিভাগ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => (
                            <tr key={std.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 pr-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-emerald-600 leading-none mb-1">#{std.roll}</span>
                                        <span className="font-black text-[#1E3A8A] text-xs font-noto truncate max-w-[100px]">{std.student_name}</span>
                                    </div>
                                </td>
                                {subjects.map(sub => (
                                    <td key={sub.id} className="py-4 px-2">
                                        <input 
                                            type="number" 
                                            className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs outline-none focus:border-emerald-600 transition-all"
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
                                <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">
                                    {(() => {
                                        const total = (Object.values(marksData[std.id] || {}) as any[]).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0);
                                        const totalPossible = subjects.reduce((sum, s) => sum + s.total_marks, 0);
                                        return getDivision(total, totalPossible);
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleSaveMarks} disabled={isSaving} className="w-full h-16 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={24}/> নম্বর সংরক্ষণ করুন</>}
            </button>
        </div>
      )}

      {activeTab === 'exams' && view === 'rank' && (
        <div className="space-y-4">
            <div className="bg-white p-5 rounded-[2.5rem] shadow-bubble border border-slate-100 overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase text-center w-16">মেধা</th>
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase pl-4">নাম</th>
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase text-center">রোল</th>
                            <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center">মোট নম্বর</th>
                            <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center">বিভাগ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(std => {
                            const stdMarks = marksData[std.id] || {};
                            const totalObtained = Object.values(stdMarks).reduce((sum: number, m: any) => sum + (parseFloat(m) || 0), 0) as number;
                            const totalPossible = subjects.reduce((sum, s) => sum + s.total_marks, 0);
                            
                            // Check if failed in any subject
                            const failed = subjects.some(sub => {
                                const marks = parseFloat(stdMarks[sub.id] || '0');
                                return marks < sub.passing_marks;
                            });

                            return {
                                ...std,
                                totalObtained,
                                division: failed ? 'রাসিব' : getDivision(totalObtained, totalPossible),
                                failed
                            } as Student & { totalObtained: number; division: string; failed: boolean };
                        }).sort((a, b) => b.totalObtained - a.totalObtained).map((std, index) => (
                            <tr key={std.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mx-auto ${index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-50 text-slate-500'}`}>
                                        {index + 1}
                                    </div>
                                </td>
                                <td className="py-4 pl-4 font-black text-[#1E3A8A] text-xs font-noto">{std.student_name}</td>
                                <td className="py-4 text-center font-black text-slate-400 text-xs">{std.roll}</td>
                                <td className="py-4 text-center font-black text-emerald-600 text-xs">{std.totalObtained}</td>
                                <td className={`py-4 text-center font-black text-xs ${std.failed ? 'text-red-500' : 'text-purple-600'}`}>{std.division}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Modals */}
      {showAdmitCardModal && examForAdmitCard && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">Admit Card Options</h3>
               <button onClick={() => setShowAdmitCardModal(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-sm font-bold text-emerald-800">Exam: {examForAdmitCard.exam_name}</p>
                    <p className="text-xs text-emerald-600 mt-1">Class: {examForAdmitCard.classes?.class_name}</p>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Template</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setSelectedAdmitCardTemplate('classic')}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedAdmitCardTemplate === 'classic' ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                        >
                            <div className={`font-black text-xs ${selectedAdmitCardTemplate === 'classic' ? 'text-emerald-600' : 'text-slate-600'}`}>Classic</div>
                            <div className="text-[10px] text-slate-400 mt-1">Standard layout with borders</div>
                        </button>
                        <button 
                            onClick={() => setSelectedAdmitCardTemplate('modern')}
                            className={`p-3 rounded-xl border text-left transition-all ${selectedAdmitCardTemplate === 'modern' ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                        >
                            <div className={`font-black text-xs ${selectedAdmitCardTemplate === 'modern' ? 'text-emerald-600' : 'text-slate-600'}`}>Modern</div>
                            <div className="text-[10px] text-slate-400 mt-1">Clean design with color header</div>
                        </button>
                    </div>
                </div>

                <button onClick={() => {
                    setDownloadAction(() => (l: 'en' | 'bn') => confirmDownloadAdmitCard(l));
                    setShowDownloadLangModal(true);
                }} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <Download size={18}/> Download Admit Cards
                </button>
             </div>
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

      {showAddExam && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[999] flex items-center justify-center p-6">
          <div className="bg-white w-full max-sm rounded-[3rem] p-8 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#1E3A8A]">{editingExam ? 'পরীক্ষা এডিট করুন' : 'নতুন পরীক্ষা (বেফাক)'}</h3>
               <button onClick={() => { setShowAddExam(false); setEditingExam(null); setExamName(''); setClassId(''); }} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="পরীক্ষার নাম" value={examName} onChange={(e) => setExamName(e.target.value)} /><BookOpen className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="সাল (যেমন: ২০২৪)" value={examYear} onChange={(e) => setExamYear(e.target.value)} /><Calendar className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                <div className="relative">
                    <select className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 appearance-none transition-all" value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">মারহালা (ক্লাস) বেছে নিন</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                    <LayoutGrid className="absolute left-4 top-4 text-slate-300" size={20}/>
                </div>
                <button onClick={handleAddExam} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
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
               <h3 className="text-xl font-black text-[#1E3A8A]">কিতাব যোগ করুন</h3>
               <button onClick={() => setShowAddSubject(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center"><X size={18} /></button>
             </div>
             <div className="space-y-4">
                <div className="relative"><input type="text" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="কিতাবের নাম" value={subName} onChange={(e) => setSubName(e.target.value)} /><BookOpen size={20} className="absolute left-4 top-4 text-slate-300" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="মোট নম্বর" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} /><CreditCard className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                    <div className="relative"><input type="number" className="w-full h-14 bg-slate-50 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent focus:border-emerald-600/20 transition-all" placeholder="পাস নম্বর" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} /><CreditCard className="absolute left-4 top-4 text-slate-300" size={20}/></div>
                </div>
                <button onClick={handleAddSubject} disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" /> : 'কিতাব সেভ করুন'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BefaqResultEngine;
