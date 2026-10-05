import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Class, Exam, FinalResult, FinalResultExam, Language, UserRole, Student, Profile } from 'types';
import { ArrowLeft, Plus, Save, Trash2, Download, Loader2, Calculator, Check, X, AlertCircle, SlidersHorizontal, Info, Eye, Sparkles } from 'lucide-react';
import { t } from 'translations';
import { generateFinalResultPDF, generateFinalIndividualResultPDF, generateFinalMassMarksheetsPDF } from '../../../../utils/pdfGenerator';
import { sortMadrasahClasses } from 'pages/Classes';
import { FileText } from 'lucide-react';

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
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadModalType, setDownloadModalType] = useState<'resultlist' | 'marksheet' | 'single_marksheet'>('resultlist');
  const [pdfFormatSelection, setPdfFormatSelection] = useState<'compact' | 'breakdown'>('compact');
  const [selectedStudentForDownload, setSelectedStudentForDownload] = useState<any>(null);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);

  // Dynamic config helper
  const config = React.useMemo(() => {
    let conf = madrasah?.config_json as any;
    if (typeof conf === 'string') {
      try {
        conf = JSON.parse(conf);
      } catch (e) {
        conf = {};
      }
    }
    return (typeof conf === 'object' && conf !== null) ? conf : {};
  }, [madrasah]);

  const resultSystem = config.result_system || 'grading';

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
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('config_json')
        .eq('id', madrasah?.id)
        .single();
        
      if (data && data.config_json && data.config_json.school_final_results) {
         setResults(data.config_json.school_final_results);
      } else {
         const saved = localStorage.getItem(`final_results_${madrasah?.id}`);
         if (saved) {
           setResults(JSON.parse(saved));
         }
      }
    } catch(err) {
      console.error(err);
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

  const applyPreset = (pattern: '20_20_60' | '25_25_50' | '50_50' | 'equal') => {
    if (availableExams.length === 0) return;
    if (pattern === '20_20_60') {
      const weights = [20, 20, 60];
      const selected = availableExams.slice(0, 3).map((ex, i) => ({
        examId: ex.id,
        weight: weights[i] || 33.33
      }));
      setSelectedExams(selected);
    } else if (pattern === '25_25_50') {
      const weights = [25, 25, 50];
      const selected = availableExams.slice(0, 3).map((ex, i) => ({
        examId: ex.id,
        weight: weights[i] || 33.33
      }));
      setSelectedExams(selected);
    } else if (pattern === '50_50') {
      const weights = [50, 50];
      const selected = availableExams.slice(0, 2).map((ex, i) => ({
        examId: ex.id,
        weight: weights[i] || 50
      }));
      setSelectedExams(selected);
    } else if (pattern === 'equal') {
      const equalWeight = Math.round((100 / availableExams.length) * 10) / 10;
      const selected = availableExams.map(ex => ({
        examId: ex.id,
        weight: equalWeight
      }));
      setSelectedExams(selected);
    }
  };

  const handleSave = async () => {
    if (!title || !selectedClassId || selectedExams.length === 0) return;
    setIsSaving(true);
    
    const totalWeight = selectedExams.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight <= 0) {
      alert('Total weight must be greater than 0%');
      setIsSaving(false);
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
    
    // Save to DB
    try {
      const { data: instData } = await supabase.from('institutions').select('config_json').eq('id', madrasah?.id).single();
      const currentConfig = instData?.config_json || madrasah?.config_json || {};
      const newConfig = {
        ...currentConfig,
        school_final_results: updated,
      };
      await supabase.from('institutions').update({ config_json: newConfig }).eq('id', madrasah?.id);
    } catch(err) {
       console.error("Error saving final results to db", err);
    }

    localStorage.setItem(`final_results_${madrasah?.id}`, JSON.stringify(updated));
    setShowCreate(false);
    resetForm();
    setIsSaving(false);
  };

  const resetForm = () => {
    setTitle('');
    setSelectedClassId('');
    setSelectedExams([]);
    setAvailableExams([]);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      const updated = results.filter(r => r.id !== id);
      setResults(updated);
      
      try {
        const { data: instData } = await supabase.from('institutions').select('config_json').eq('id', madrasah?.id).single();
        const currentConfig = instData?.config_json || madrasah?.config_json || {};
        const newConfig = {
          ...currentConfig,
          school_final_results: updated,
        };
        await supabase.from('institutions').update({ config_json: newConfig }).eq('id', madrasah?.id);
      } catch(err) {
         console.error("Error deleting final result", err);
      }
      
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

      if ((window as any)._hasIsActive !== false) {
        stdQuery = stdQuery.eq('is_active', true);
      }

      const { data: students } = await stdQuery;

      if (!students) throw new Error('No students found');

      // Fetch fresh institution config for manual attendance overrides
      const { data: instData } = await supabase.from('institutions').select('config_json').eq('id', madrasah?.id).single();
      const currentConfig = instData?.config_json || madrasah?.config_json || {};
      const manualAttendanceConfig = currentConfig?.exam_manual_attendance || {};

      // Fetch class attendance stats
      let attStatsMap: Record<string, string> = {};
      try {
        const studentIds = (students || []).map((s: any) => s.id).filter(Boolean);
        let attQuery = supabase
          .from('attendance')
          .select('student_id, status, date')
          .eq('institution_id', madrasah?.id);
        if (studentIds.length > 0) {
          attQuery = attQuery.in('student_id', studentIds);
        } else if (result.class_id) {
          attQuery = attQuery.eq('class_id', result.class_id);
        }
        const { data: attData } = await attQuery;
        const stats: Record<string, { present: number, total: number }> = {};
        (attData || []).forEach((record: any) => {
          if (!record.student_id) return;
          if (!stats[record.student_id]) stats[record.student_id] = { present: 0, total: 0 };
          stats[record.student_id].total += 1;
          const st = String(record.status || '').toLowerCase();
          if (st === 'present' || st === 'late' || st === 'half_day') {
            stats[record.student_id].present += (st === 'half_day' ? 0.5 : 1);
          }
        });
        for (const [sId, stat] of Object.entries(stats)) {
          if (stat.total > 0) {
            attStatsMap[sId] = Math.round((stat.present / stat.total) * 100).toString();
          }
        }
      } catch (e) {
        console.error('Error fetching att stats in final results:', e);
      }

      // 2. Fetch Marks and Subjects for all exams
      const examDataPromises = result.exams!.map(async (config) => {
        const { data: marks } = await supabase
          .from('exam_marks')
          .select('*, exam_subjects(subject_name, full_marks, pass_marks, is_optional)')
          .eq('exam_id', config.exam_id);
        
        return {
          examId: config.exam_id,
          examName: config.exam?.exam_name || 'Exam',
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
        const termBreakdown: any = {};
        let totalWeightedSum = 0;
        let overallMaxMarks = 0;
        let hasFailedAny = false;

        let pointsSum = 0;
        let numMainSubjects = 0;

        subjectList.forEach(sub => {
          let weightedSum = 0;
          let subjectMaxMarks = 0;
          let subjectPassMarks = 0;
          let isOptional = false;
          const subTerms: any[] = [];

          examsData.forEach(exam => {
            const subjectMarkEntryFromAnyStudent = exam.marks.find((m: any) => m.exam_subjects?.subject_name === sub);
            if (!subjectMarkEntryFromAnyStudent) return;

            const fullMarks = subjectMarkEntryFromAnyStudent.exam_subjects?.full_marks || 100;
            const passMarks = subjectMarkEntryFromAnyStudent.exam_subjects?.pass_marks || 33;
            if (resultSystem === 'high_school') {
              const studentOptSubId = (madrasah?.config_json as any)?.class_student_optional_subjects?.[selectedClassId]?.[student.id];
              if (studentOptSubId !== undefined) {
                const subObj = examsData.flatMap((e: any) => e.subjects || []).find((s: any) => s.id === studentOptSubId);
                if (subObj && subObj.subject_name === sub) {
                  isOptional = true;
                }
              } else if (subjectMarkEntryFromAnyStudent.exam_subjects?.is_optional) {
                isOptional = true;
              }
            } else if (subjectMarkEntryFromAnyStudent.exam_subjects?.is_optional) {
              isOptional = true;
            }

            const maxContribution = fullMarks * (exam.weight / 100);
            const passContribution = passMarks * (exam.weight / 100);
            
            subjectMaxMarks += maxContribution;
            subjectPassMarks += passContribution;

            const markEntry = exam.marks.find((m: any) => 
              m.student_id === student.id && 
              m.exam_subjects?.subject_name === sub
            );

            let obtained = 0;
            if (markEntry && markEntry.marks_obtained !== '') {
               obtained = parseFloat(markEntry.marks_obtained) || 0;
            }
            
            const contribution = obtained * (exam.weight / 100);
            weightedSum += contribution;

            subTerms.push({
              examName: exam.examName,
              weight: exam.weight,
              rawMark: obtained,
              fullMarks: fullMarks,
              weightedMark: contribution.toFixed(1)
            });
          });

          if (subjectMaxMarks > 0) {
            const pct = (weightedSum / subjectMaxMarks) * 100;
            
            const isOptionalEffectively = isOptional && (resultSystem === 'grading_optional' || resultSystem === 'high_school');
            const failedCombined = weightedSum < subjectPassMarks;
            
            if (!isOptionalEffectively && failedCombined) {
                hasFailedAny = true;
            }

            // In getGradeInfo, pass literal failed combined status
            const { gpa: gpStr } = getGradeInfo(pct, failedCombined);
            const gp = parseFloat(gpStr);
            
            if (resultSystem === 'grading_optional' || resultSystem === 'high_school') {
                if (isOptional) {
                    if (gp > 2) pointsSum += (gp - 2);
                } else {
                    pointsSum += gp;
                    numMainSubjects++;
                }
            } else {
                pointsSum += gp;
                numMainSubjects++;
            }
          }

          studentMarks[sub] = weightedSum.toFixed(1);
          termBreakdown[sub] = subTerms;
          const optTotalMode = (madrasah?.config_json as any)?.optional_subject_total_mode || 'exclude';
          const isOptionalEffectively = isOptional && (resultSystem === 'grading_optional' || resultSystem === 'high_school');

          if (isOptionalEffectively) {
            if (optTotalMode === 'bonus_above_40') {
              const passPart = subjectPassMarks || 40;
              const bonus = Math.max(0, weightedSum - passPart);
              totalWeightedSum += bonus;
            } else if (optTotalMode === 'include') {
              totalWeightedSum += weightedSum;
              overallMaxMarks += subjectMaxMarks;
            }
            // default 'exclude': do not add 4th subject to totalWeightedSum or overallMaxMarks
          } else {
            totalWeightedSum += weightedSum;
            overallMaxMarks += subjectMaxMarks;
          }
        });

        const finalPercentage = overallMaxMarks > 0 ? (totalWeightedSum / overallMaxMarks) * 100 : 0;
        let finalGpa = '0.00';
        let finalGradeStr = 'F';

        if ((resultSystem === 'grading' || resultSystem === 'grading_optional' || resultSystem === 'high_school') && numMainSubjects > 0) {
           if (hasFailedAny) {
             finalGpa = '0.00';
             finalGradeStr = 'F';
           } else {
             let avgGp = pointsSum / numMainSubjects;
             if (avgGp > 5.0) avgGp = 5.0;
             finalGpa = avgGp.toFixed(2);
             
             // Dynamic Grade based on GPA
             const gpaVal = parseFloat(finalGpa);
             if (gpaVal >= 5.0) finalGradeStr = 'A+';
             else if (gpaVal >= 4.0) finalGradeStr = 'A';
             else if (gpaVal >= 3.5) finalGradeStr = 'A-';
             else if (gpaVal >= 3.0) finalGradeStr = 'B';
             else if (gpaVal >= 2.0) finalGradeStr = 'C';
             else if (gpaVal >= 1.0) finalGradeStr = 'D';
             else finalGradeStr = 'F';
           }
        } else {
           // Continuous GPA for other systems (Accurate GPA)
           if (hasFailedAny) {
             finalGpa = '0.00';
             finalGradeStr = 'F';
           } else {
             const { gpa, grade } = getGradeInfo(finalPercentage, false);
             // If the user wants "accurate" (continuous) GPA from percentage:
             const accurateGpa = (finalPercentage / 20).toFixed(2);
             finalGpa = accurateGpa;
             finalGradeStr = grade;
           }
        }

        // Calculate student attendance from constituent exams or fallback to class attendance stats
        let studentAttVal = 0;
        let foundManualExamAtt = false;
        let examAttSum = 0;
        let examAttCount = 0;

        (result.exams || []).forEach(ex => {
          const manualVal = manualAttendanceConfig?.[ex.exam_id]?.[student.id];
          if (manualVal !== undefined && manualVal !== null && String(manualVal).trim() !== '') {
            const numVal = parseFloat(String(manualVal).replace(/[^0-9.]/g, '')) || 0;
            examAttSum += numVal;
            examAttCount++;
            foundManualExamAtt = true;
          }
        });

        if (foundManualExamAtt && examAttCount > 0) {
          studentAttVal = examAttSum / examAttCount;
        } else if (attStatsMap[student.id]) {
          studentAttVal = parseFloat(attStatsMap[student.id]) || 0;
        } else if (student.attendance) {
          studentAttVal = parseFloat(String(student.attendance).replace(/[^0-9.]/g, '')) || 0;
        }

        const parsedAtt = studentAttVal;

        return {
          ...student,
          marks: studentMarks,
          termBreakdown,
          total: totalWeightedSum.toFixed(1),
          average: finalPercentage.toFixed(1),
          gpa: finalGpa,
          grade: finalGradeStr,
          attendance: parsedAtt
        };
      });

      const meritMode = (madrasah?.config_json as any)?.merit_ranking_mode || 'total_marks_first';

      // Sort by Pass Status, Total Marks, GPA, and Attendance
      processed.sort((a, b) => {
        const failedA = a.grade === 'F' || parseFloat(a.gpa) === 0;
        const failedB = b.grade === 'F' || parseFloat(b.gpa) === 0;
        if (!failedA && failedB) return -1;
        if (failedA && !failedB) return 1;

        if (meritMode === 'gpa_first') {
          // 1. GPA
          const gpaA = parseFloat(a.gpa) || 0;
          const gpaB = parseFloat(b.gpa) || 0;
          const gpaDiff = gpaB - gpaA;
          if (Math.abs(gpaDiff) > 0.001) return gpaDiff;

          // 2. Total Marks
          const totalDiff = parseFloat(b.total) - parseFloat(a.total);
          if (Math.abs(totalDiff) > 0.001) return totalDiff;

          // 3. Attendance (Hajira)
          const attA = typeof a.attendance === 'number' ? a.attendance : (parseFloat(String(a.attendance || '0').replace(/[^0-9.]/g, '')) || 0);
          const attB = typeof b.attendance === 'number' ? b.attendance : (parseFloat(String(b.attendance || '0').replace(/[^0-9.]/g, '')) || 0);
          const attDiff = attB - attA;
          if (Math.abs(attDiff) > 0.001) return attDiff;

          // 4. Roll Order
          const rollA = parseInt(a.roll) || 0;
          const rollB = parseInt(b.roll) || 0;
          return rollA - rollB;
        } else if (meritMode === 'total_marks_first') {
          // 1. Total Marks
          const totalDiff = parseFloat(b.total) - parseFloat(a.total);
          if (Math.abs(totalDiff) > 0.001) return totalDiff;

          // 2. GPA
          const gpaA = parseFloat(a.gpa) || 0;
          const gpaB = parseFloat(b.gpa) || 0;
          const gpaDiff = gpaB - gpaA;
          if (Math.abs(gpaDiff) > 0.001) return gpaDiff;

          // 3. Attendance (Hajira)
          const attA = typeof a.attendance === 'number' ? a.attendance : (parseFloat(String(a.attendance || '0').replace(/[^0-9.]/g, '')) || 0);
          const attB = typeof b.attendance === 'number' ? b.attendance : (parseFloat(String(b.attendance || '0').replace(/[^0-9.]/g, '')) || 0);
          const attDiff = attB - attA;
          if (Math.abs(attDiff) > 0.001) return attDiff;

          // 4. Roll Order
          const rollA = parseInt(a.roll) || 0;
          const rollB = parseInt(b.roll) || 0;
          return rollA - rollB;
        } else {
          const totalDiff = parseFloat(b.total) - parseFloat(a.total);
          if (Math.abs(totalDiff) > 0.001) return totalDiff;

          const rollA = parseInt(a.roll) || 0;
          const rollB = parseInt(b.roll) || 0;
          return rollA - rollB;
        }
      });
      
      // Add Rank with tie-handling (Dense Ranking)
      let currentRank = 1;
      const ranked = processed.map((p, i) => {
        if (i > 0) {
          const prev = processed[i - 1];
          const failedPrev = prev.grade === 'F' || parseFloat(prev.gpa) === 0;
          const failedP = p.grade === 'F' || parseFloat(p.gpa) === 0;

          let isTie = false;
          if (meritMode === 'gpa_first' || meritMode === 'total_marks_first') {
            const attPrev = typeof prev.attendance === 'number' ? prev.attendance : (parseFloat(String(prev.attendance || '0').replace(/[^0-9.]/g, '')) || 0);
            const attP = typeof p.attendance === 'number' ? p.attendance : (parseFloat(String(p.attendance || '0').replace(/[^0-9.]/g, '')) || 0);

            isTie = (
              failedPrev === failedP &&
              Math.abs((parseFloat(prev.gpa) || 0) - (parseFloat(p.gpa) || 0)) < 0.001 &&
              Math.abs(parseFloat(prev.total) - parseFloat(p.total)) < 0.001 &&
              Math.abs(attPrev - attP) < 0.001
            );
          } else {
            isTie = (
              failedPrev === failedP &&
              Math.abs(parseFloat(prev.total) - parseFloat(p.total)) < 0.001
            );
          }

          if (!isTie) {
            currentRank++;
          }
        }
        return { ...p, rank: currentRank };
      });
      
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

  const handleDownloadPDF = async (downloadLang: 'en' | 'bn' = lang, withBreakdown: boolean = false) => {
    if (!viewResult || !madrasah) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await generateFinalResultPDF(
          viewResult.title,
          classes.find(c => c.id === viewResult.class_id)?.class_name || '',
          subjects,
          calculatedData,
          madrasah,
          downloadLang,
          (p) => setDownloadProgress(p),
          withBreakdown
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading PDF');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDownloadIndividualPDF = async (student: any, downloadLang: 'en' | 'bn' = lang) => {
    if (!viewResult || !madrasah) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await generateFinalIndividualResultPDF(
          student,
          viewResult.title,
          subjects,
          madrasah,
          downloadLang,
          (p) => setDownloadProgress(p)
      );
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading Mark Sheet');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleMassDownloadMarksheets = async (downloadLang: 'en' | 'bn' = lang) => {
    if (!viewResult || !madrasah || calculatedData.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await generateFinalMassMarksheetsPDF(
        calculatedData,
        viewResult.title,
        subjects,
        madrasah,
        downloadLang,
        (p) => setDownloadProgress(p)
      );
    } catch (error) {
      console.error('Mass Download error:', error);
      alert('Error downloading Mark Sheets');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Loading Overlay */}
      {(resultLoading || isDownloading) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle 
                  className="text-slate-100 dark:text-slate-800" 
                  strokeWidth="8" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="42" 
                  cx="50" 
                  cy="50" 
                />
                <circle 
                  className="text-blue-600 transition-all duration-300 ease-out" 
                  strokeWidth="8" 
                  strokeDasharray={263.89} 
                  strokeDashoffset={263.89 * (1 - (isDownloading ? downloadProgress : 0) / 100)} 
                  strokeLinecap="round" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="42" 
                  cx="50" 
                  cy="50" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-black text-xl dark:text-white">
                {isDownloading ? `${downloadProgress}%` : <Loader2 className="animate-spin" />}
              </div>
            </div>
            <h3 className="text-xl font-black mb-2 dark:text-white">
              {isDownloading ? (lang === 'bn' ? 'ফাইল তৈরি হচ্ছে...' : 'Generating File...') : (lang === 'bn' ? 'অপেক্ষা করুন...' : 'Please Wait...')}
            </h3>
            <p className="text-slate-500 text-sm">
              {isDownloading 
                ? (lang === 'bn' ? 'দয়া করে কিছুক্ষণ অপেক্ষা করুন।' : 'Please wait while we prepare your document.')
                : (lang === 'bn' ? 'দয়া করে কিছুক্ষণ অপেক্ষা করুন।' : 'Please wait a moment.')}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <button onClick={viewResult ? () => setViewResult(null) : onBack} className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-blue-50 border-blue-100 text-[#2563EB] hover:bg-blue-100'}`}>
            <ArrowLeft size={20}/>
          </button>
          <div>
            <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>
              {viewResult ? viewResult.title : 'Final Results'}
            </h1>
            {viewResult && (
              <p className="text-xs text-slate-400 font-bold">
                {classes.find(c => c.id === viewResult.class_id)?.class_name} • {viewResult.exams?.length} {lang === 'bn' ? 'টি পরীক্ষা' : 'Exams'}
              </p>
            )}
          </div>
        </div>
        {!viewResult && (
          <button onClick={() => setShowCreate(true)} className="w-10 h-10 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center active:scale-95 transition-all">
            <Plus size={20}/>
          </button>
        )}
        {viewResult && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            <button 
              onClick={() => setShowBreakdown(!showBreakdown)}
              className={`h-11 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all border ${
                showBreakdown 
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                  : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-purple-400 border-slate-700 hover:bg-slate-700' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 shadow-sm')
              }`}
              title="Toggle Term Breakdown View"
            >
              <SlidersHorizontal size={16} />
              <span className="truncate">{showBreakdown ? (lang === 'bn' ? 'সংক্ষিপ্ত ভিউ' : 'Compact View') : (lang === 'bn' ? 'টার্মভিত্তিক ব্রেকডাউন' : 'Term Breakdown')}</span>
            </button>

            <button 
              onClick={() => {
                setDownloadModalType('marksheet');
                setShowDownloadLangModal(true);
              }} 
              className={`h-11 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all border ${
                madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm'
              }`}
              title="Download All Marksheets"
            >
              <FileText size={16} />
              <span className="truncate">{lang === 'bn' ? 'সকল মার্কশীট' : 'All Marksheets'}</span>
            </button>

            <button 
              onClick={() => {
                setDownloadModalType('resultlist');
                setShowDownloadLangModal(true);
              }} 
              className="h-11 px-4 bg-[#2563EB] text-white rounded-xl shadow-premium flex items-center justify-center gap-2 font-black text-xs active:scale-95 transition-all hover:bg-blue-700"
              title="Download Result List PDF"
            >
              <Download size={16}/>
              <span className="truncate">{lang === 'bn' ? 'রেজাল্ট শীট PDF' : 'Result Sheet PDF'}</span>
            </button>
          </div>
        )}
      </div>

      {!viewResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#2563EB]" /></div>
          ) : results.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400">
              {lang === 'bn' ? 'এখনো কোনো চূড়ান্ত ফলাফল তৈরি করা হয়নি।' : 'No final results created yet.'}
            </div>
          ) : (
            results.map(result => (
              <div key={result.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble flex items-center justify-between`}>
                <div>
                  <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>{result.title}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {classes.find(c => c.id === result.class_id)?.class_name} • {result.exams?.length} {lang === 'bn' ? 'টি পরীক্ষা' : 'Exams'}
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
                      <th key={s} className="py-4 text-[10px] font-black text-slate-400 uppercase text-center min-w-[100px]">{s}</th>
                    ))}
                    <th className="py-4 text-[10px] font-black text-blue-400 uppercase text-center">Total</th>
                    <th className="py-4 text-[10px] font-black text-purple-400 uppercase text-center">GPA</th>
                    <th className="py-4 text-[10px] font-black text-emerald-400 uppercase text-center">Grade</th>
                    <th className="py-4 text-[10px] font-black text-slate-400 uppercase text-center">Action</th>
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
                        <td key={sub} className="py-3 px-2 text-center align-top">
                          {showBreakdown ? (
                            <div className="space-y-1 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800 min-w-[110px]">
                              {student.termBreakdown?.[sub]?.map((tb: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                                  <span className="truncate max-w-[65px]" title={tb.examName}>{tb.examName} ({tb.weight}%):</span>
                                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{tb.weightedMark}</span>
                                </div>
                              ))}
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-[#2563EB] text-xs">
                                <span>মোট:</span>
                                <span>{student.marks[sub] || '-'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className={`font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} text-xs`}>
                              {student.marks[sub] || '-'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className={`py-4 px-2 text-center font-black ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'} text-xs`}>{student.total}</td>
                      <td className="py-4 px-2 text-center font-black text-purple-600 text-xs">{student.gpa}</td>
                      <td className="py-4 px-2 text-center font-black text-emerald-500 text-xs">{student.grade}</td>
                      <td className="py-4 px-2 text-center">
                        <button 
                          onClick={() => {
                            setSelectedStudentForDownload(student);
                            setDownloadModalType('single_marksheet');
                            setShowDownloadLangModal(true);
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-blue-50 hover:text-blue-600'}`}
                          title="Download Mark Sheet"
                        >
                          <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showDownloadLangModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200`}>
            <div className={`w-14 h-14 ${madrasah?.theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Download className="text-blue-600" size={28} />
            </div>
            
            <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} mb-1 text-center`}>
              {downloadModalType === 'resultlist' 
                ? (lang === 'bn' ? 'রেজাল্ট শীট PDF ডাউনলোড' : 'Download Result Sheet PDF')
                : downloadModalType === 'marksheet'
                ? (lang === 'bn' ? 'সকল মার্কশীট ডাউনলোড' : 'Download All Marksheets')
                : (lang === 'bn' ? 'মার্কশীট ডাউনলোড' : 'Download Marksheet')}
            </h3>
            <p className="text-slate-400 text-center text-xs font-bold mb-6">
              {lang === 'bn' ? 'অপশন ও ভাষা নির্বাচন করুন' : 'Select options and language'}
            </p>

            {/* Format selection if downloading result list */}
            {downloadModalType === 'resultlist' && (
              <div className="mb-6 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                  {lang === 'bn' ? '১. PDF ফরমেট সিলেক্ট করুন:' : '1. Select PDF Format:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPdfFormatSelection('compact')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      pdfFormatSelection === 'compact'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-200 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-black text-xs">{lang === 'bn' ? 'সংক্ষিপ্ত ভিউ' : 'Compact Summary'}</span>
                    <span className="text-[10px] text-slate-400">{lang === 'bn' ? 'শুধুমাত্র মোট নম্বর' : 'Subject totals only'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPdfFormatSelection('breakdown')}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      pdfFormatSelection === 'breakdown'
                        ? 'bg-purple-50/80 border-purple-500 text-purple-900 dark:bg-purple-950/50 dark:border-purple-500 dark:text-purple-200 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-black text-xs">{lang === 'bn' ? 'টার্মভিত্তিক বিস্তৃত' : 'Term Breakdown'}</span>
                    <span className="text-[10px] text-slate-400">{lang === 'bn' ? 'পরীক্ষাভিত্তিক বিস্তারিত' : 'Term-wise detail'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                {downloadModalType === 'resultlist' ? (lang === 'bn' ? '২. ভাষা নির্বাচন করুন:' : '2. Select Language:') : (lang === 'bn' ? 'ভাষা নির্বাচন করুন:' : 'Select Language:')}
              </label>
              
              <button 
                onClick={async () => {
                  setShowDownloadLangModal(false);
                  setTimeout(async () => {
                    if (downloadModalType === 'resultlist') {
                      await handleDownloadPDF('en', pdfFormatSelection === 'breakdown');
                    } else if (downloadModalType === 'marksheet') {
                      await handleMassDownloadMarksheets('en');
                    } else if (downloadModalType === 'single_marksheet' && selectedStudentForDownload) {
                      await handleDownloadIndividualPDF(selectedStudentForDownload, 'en');
                    }
                  }, 50);
                }}
                className="w-full py-3.5 bg-[#2563EB] text-white font-black rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
              >
                English
              </button>

              <button 
                onClick={async () => {
                  setShowDownloadLangModal(false);
                  setTimeout(async () => {
                    if (downloadModalType === 'resultlist') {
                      await handleDownloadPDF('bn', pdfFormatSelection === 'breakdown');
                    } else if (downloadModalType === 'marksheet') {
                      await handleMassDownloadMarksheets('bn');
                    } else if (downloadModalType === 'single_marksheet' && selectedStudentForDownload) {
                      await handleDownloadIndividualPDF(selectedStudentForDownload, 'bn');
                    }
                  }, 50);
                }}
                className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
              >
                বাংলা (Bengali)
              </button>

              <button 
                onClick={() => setShowDownloadLangModal(false)}
                className="w-full py-2.5 text-slate-400 font-bold text-xs hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-1"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
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
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block">
                      {lang === 'bn' ? 'পরীক্ষা ও ওয়েটেজ (Weightage) সিলেক্ট করুন' : 'Select Exams & Weights'}
                    </label>
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="p-3 bg-blue-50/70 dark:bg-slate-800/80 rounded-2xl border border-blue-100 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#2563EB] dark:text-blue-400">
                      <Sparkles size={14} />
                      <span>{lang === 'bn' ? 'দ্রুত ওয়েটেজ সেটআপ (Quick Presets):' : 'Quick Weightage Presets:'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => applyPreset('20_20_60')}
                        className="py-2 px-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs hover:border-blue-400 hover:text-blue-600 active:scale-95 transition-all text-center"
                      >
                        ২০% + ২০% + ৬০%
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('25_25_50')}
                        className="py-2 px-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs hover:border-blue-400 hover:text-blue-600 active:scale-95 transition-all text-center"
                      >
                        ২৫% + ২৫% + ৫০%
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('50_50')}
                        className="py-2 px-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs hover:border-blue-400 hover:text-blue-600 active:scale-95 transition-all text-center"
                      >
                        ৫০% + ৫০%
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('equal')}
                        className="py-2 px-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs hover:border-blue-400 hover:text-blue-600 active:scale-95 transition-all text-center"
                      >
                        {lang === 'bn' ? 'সমান ভাগে' : 'Equal Shares'}
                      </button>
                    </div>
                  </div>

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
