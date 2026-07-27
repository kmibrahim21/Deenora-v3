import React, { useState, useEffect } from 'react';
import { ChevronLeft, FileText, Download, ShieldCheck, Loader2, Users, GraduationCap } from 'lucide-react';
import { Institution, Profile, Class, Student, Language, Teacher } from '../types';
import { supabase } from '../supabase';
import { t } from '../translations';
import StudentIdCardGenerator from '../components/StudentIdCardGenerator';
import TeacherIdCardGenerator from '../components/TeacherIdCardGenerator';

import { requestManager } from 'services/RequestManager';

interface IdCardsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile: Profile | null;
}

import { sortMadrasahClasses } from 'pages/Classes';

const IdCards: React.FC<IdCardsProps> = ({ lang, madrasah, onBack, profile }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClassMap, setSelectedClassMap] = useState<Record<string, string>>({});
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  
  const [showIdCard, setShowIdCard] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, [madrasah]);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', madrasah.id).order('sort_order', { ascending: true }),
        `classes:${madrasah.id}`,
        30 * 60 * 1000 // 30 mins
      );

      if (error) throw error;
      const sortedClasses = sortMadrasahClasses(data || []);
      setClasses(sortedClasses);
      const map: Record<string, string> = {};
      sortedClasses.forEach((c: Class) => map[c.id] = c.class_name);
      setSelectedClassMap(map);
    } catch (err: any) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    if (!madrasah) return;
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('institution_id', madrasah.id)
        .eq('class_id', classId)
        .order('roll', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      if (data && data.length > 0) {
        setSelectedStudentId(data[0].id);
      } else {
        setSelectedStudentId('');
      }
    } catch (err: any) {
      console.error('Error fetching students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchTeachers = async () => {
    if (!madrasah) return;
    setLoadingTeachers(true);
    try {
      const response = await fetch(
        `/api/teachers/list?institute_id=${madrasah.id}&t=${Date.now()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch teachers");
      const data = await response.json();
      const teacherList = data.teachers || [];
      setTeachers(teacherList);
      if (teacherList.length > 0) {
        setSelectedTeacherId(teacherList[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0] || null;
  const activeTeacher = teachers.find(t => t.id === selectedTeacherId) || teachers[0] || null;
  const isBulk = activeTab === 'students' ? selectedStudentId === 'all' : selectedTeacherId === 'all';

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-sm border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            <button onClick={onBack} className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
            </button>
            <div className="flex-1">
              <h2 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {lang === 'bn' ? 'পরিচয় পত্র' : 'ID Cards'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest gap-1.5 flex items-center">
                 <ShieldCheck size={10} /> {lang === 'bn' ? 'জেনারেটর' : 'Generator'}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className={`flex p-1 rounded-xl sm:rounded-2xl w-full sm:w-fit ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <button 
              onClick={() => setActiveTab('students')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all ${activeTab === 'students' ? (isDark ? 'bg-slate-700 text-white shadow-lg' : 'bg-white text-[#1E3A8A] shadow-sm') : 'text-slate-500'}`}
            >
              <GraduationCap size={14} className="sm:w-4 sm:h-4" />
              {lang === 'bn' ? 'শিক্ষার্থী' : 'Students'}
            </button>
            <button 
              onClick={() => setActiveTab('teachers')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all ${activeTab === 'teachers' ? (isDark ? 'bg-slate-700 text-white shadow-lg' : 'bg-white text-[#1E3A8A] shadow-sm') : 'text-slate-500'}`}
            >
              <Users size={14} className="sm:w-4 sm:h-4" />
              {lang === 'bn' ? 'শিক্ষক' : 'Teachers'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            <div className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-6 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="space-y-4 sm:space-y-6">
                {activeTab === 'students' ? (
                  <>
                    {/* Class Selection */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 pl-1">
                        {lang === 'bn' ? 'শ্রেণী নির্বাচন করুন' : 'Select Class'}
                      </label>
                      {loadingConfig ? (
                        <div className={`h-12 sm:h-14 animate-pulse rounded-xl sm:rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} />
                      ) : (
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className={`w-full border text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        >
                          <option value="">{t('select_class', lang)}</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.class_name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Student Selection */}
                    {selectedClassId && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 pl-1">
                          {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student'}
                        </label>
                        {loadingStudents ? (
                          <div className={`h-12 sm:h-14 animate-pulse rounded-xl sm:rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} />
                        ) : students.length > 0 ? (
                          <select
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className={`w-full border text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                          >
                            <option value="all">{lang === 'bn' ? 'সকল শিক্ষার্থী (বাল্ক)' : 'All Students (Bulk)'}</option>
                            {students.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.roll ? `${s.roll} - ` : ''}{s.student_name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-3 sm:p-4 bg-teal-50 text-teal-700 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-bold border border-teal-200">
                            {lang === 'bn' ? 'এই শ্রেণীতে কোন শিক্ষার্থী নেই' : 'No students in this class'}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Teacher Selection */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 pl-1">
                        {lang === 'bn' ? 'শিক্ষক নির্বাচন করুন' : 'Select Teacher'}
                      </label>
                      {loadingTeachers ? (
                        <div className={`h-12 sm:h-14 animate-pulse rounded-xl sm:rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} />
                      ) : teachers.length > 0 ? (
                        <select
                          value={selectedTeacherId}
                          onChange={(e) => setSelectedTeacherId(e.target.value)}
                          className={`w-full border text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        >
                          <option value="all">{lang === 'bn' ? 'সকল শিক্ষক (বাল্ক)' : 'All Teachers (Bulk)'}</option>
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} {t.designation ? `(${t.designation})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3 sm:p-4 bg-amber-50 text-amber-700 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-bold border border-amber-200">
                          {lang === 'bn' ? 'কোনো শিক্ষক পাওয়া যায়নি' : 'No teachers found'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {activeTab === 'students' ? (
              activeStudent && selectedClassId ? (
                <StudentIdCardGenerator 
                  student={activeStudent} 
                  madrasah={madrasah} 
                  lang={lang} 
                  onClose={() => setShowIdCard(false)} 
                  isBulk={isBulk}
                  allStudents={students}
                />
              ) : (
                <div className={`rounded-2xl sm:rounded-3xl border p-8 sm:p-12 shadow-sm text-center flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <GraduationCap size={28} className="sm:w-8 sm:h-8 text-slate-300" />
                  </div>
                  <h3 className={`text-base sm:text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-700'}`}>
                    {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select a Student'}
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm max-w-xs sm:max-w-sm mx-auto">
                    {lang === 'bn' 
                      ? 'আইডি কার্ড তৈরি ও প্রিভিউ দেখতে বাম পাশ থেকে শ্রেণী ও শিক্ষার্থী নির্বাচন করুন।' 
                      : 'Select a class and student to generate and preview the ID card.'}
                  </p>
                </div>
              )
            ) : (
              activeTeacher ? (
                <TeacherIdCardGenerator 
                  teacher={activeTeacher} 
                  madrasah={madrasah} 
                  lang={lang} 
                  onClose={() => setShowIdCard(false)} 
                  isBulk={isBulk}
                  allTeachers={teachers}
                />
              ) : (
                <div className={`rounded-2xl sm:rounded-3xl border p-8 sm:p-12 shadow-sm text-center flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <Users size={28} className="sm:w-8 sm:h-8 text-slate-300" />
                  </div>
                  <h3 className={`text-base sm:text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-700'}`}>
                    {lang === 'bn' ? 'শিক্ষক নির্বাচন করুন' : 'Select a Teacher'}
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm max-w-xs sm:max-w-sm mx-auto">
                    {lang === 'bn' 
                      ? 'আইডি কার্ড তৈরি ও প্রিভিউ দেখতে বাম পাশ থেকে শিক্ষক নির্বাচন করুন।' 
                      : 'Select a teacher to generate and preview the ID card.'}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

    </div>
  );
};

export default IdCards;
