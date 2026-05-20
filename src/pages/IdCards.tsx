import React, { useState, useEffect } from 'react';
import { ChevronLeft, FileText, Download, ShieldCheck, Loader2 } from 'lucide-react';
import { Institution, Profile, Class, Student, Language } from '../types';
import { supabase } from '../supabase';
import { t } from '../translations';
import StudentIdCardGenerator from '../components/StudentIdCardGenerator';

interface IdCardsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile: Profile | null;
}

const IdCards: React.FC<IdCardsProps> = ({ lang, madrasah, onBack, profile }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassMap, setSelectedClassMap] = useState<Record<string, string>>({});
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  const [showIdCard, setShowIdCard] = useState(false);

  useEffect(() => {
    fetchClasses();
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
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
      const map: Record<string, string> = {};
      data?.forEach(c => map[c.id] = c.class_name);
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

  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0] || null;
  const isBulk = selectedStudentId === 'all';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button onClick={onBack} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-[#1E3A8A]">
            {lang === 'bn' ? 'স্টুডেন্ট আইডি কার্ড' : 'Student ID Cards'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest gap-2 flex items-center">
             <ShieldCheck size={12} /> {lang === 'bn' ? 'জেনারেটর' : 'Generator'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm max-w-xl mx-auto">
        <div className="space-y-6">
          {/* Class Selection */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
              {lang === 'bn' ? 'শ্রেণী নির্বাচন করুন' : 'Select Class'}
            </label>
            {loadingConfig ? (
              <div className="h-14 bg-slate-50 animate-pulse rounded-2xl" />
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none"
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
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
                {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student'}
              </label>
              {loadingStudents ? (
                <div className="h-14 bg-slate-50 animate-pulse rounded-2xl" />
              ) : students.length > 0 ? (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none"
                >
                  <option value="all">{lang === 'bn' ? 'সকল শিক্ষার্থী (বাল্ক ডাউনলোড)' : 'All Students (Bulk Download)'}</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.roll ? `${s.roll} - ` : ''}{s.student_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-4 bg-teal-50 text-teal-700 rounded-2xl text-sm font-bold border border-teal-200">
                  {lang === 'bn' ? 'এই শ্রেণীতে কোন শিক্ষার্থী নেই' : 'No students in this class'}
                </div>
              )}
            </div>
          )}
          
          {/* Download Button */}
          {selectedClassId && (
            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={() => setShowIdCard(true)}
                disabled={!selectedStudentId}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${!selectedStudentId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-teal-500 text-white hover:bg-teal-600 shadow-xl shadow-teal-500/20 active:scale-95'}`}
              >
                <FileText size={20} />
                <span>{lang === 'bn' ? 'আইডি কার্ড তৈরি করুন' : 'Generate ID Card'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showIdCard && activeStudent && (
        <StudentIdCardGenerator 
          student={activeStudent} 
          madrasah={madrasah} 
          lang={lang} 
          onClose={() => setShowIdCard(false)} 
          isBulk={isBulk}
          allStudents={isBulk ? students : undefined}
        />
      )}
    </div>
  );
};

export default IdCards;
