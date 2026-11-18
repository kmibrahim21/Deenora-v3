
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronRight, BookOpen, Users, Edit3, Trash2, X, Check, Loader2, AlertCircle, AlertTriangle, Hash, Search, Phone } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Class, Student, Language, Institution, Profile } from 'types';
import { t } from 'translations';
import { requestManager } from 'services/RequestManager';
import { isValidUUID } from 'utils/validation';
import { filterAndRankStudents } from 'utils/studentSearch';
import { extractStudentExtraFields } from 'utils/studentExtraFields';

export const sortMadrasahClasses = (classes: any[]) => {
  if (!classes || !Array.isArray(classes)) return [];
  return [...classes].sort((a, b) => {
    // Primary sort by sort_order (coerce to number to be safe)
    // Treat null/empty as unassigned, sending them to the bottom (999999). 
    const getOrder = (val: any) => {
      if (val === 0) return 0;
      if (val == null || String(val).trim() === '') return 999999;
      return Number(val);
    };

    const orderA = getOrder(a.sort_order);
    const orderB = getOrder(b.sort_order);
    
    if (orderA !== orderB) return orderA - orderB;
    
    // Fallback to alphabetical
    return (a.class_name || '').localeCompare((b.class_name || ''), 'bn', { numeric: true });
  });
};

interface ClassesProps {
  onClassClick: (cls: Class) => void;
  onStudentClick?: (student: Student) => void;
  lang: Language;
  madrasah: Institution | null;
  dataVersion: number;
  triggerRefresh: () => void;
  readOnly?: boolean;
  profile?: Profile | null;
  activeYear?: any;
  selectedYear?: any;
}

const Classes: React.FC<ClassesProps> = ({ onClassClick, onStudentClick, lang, madrasah, dataVersion, triggerRefresh, readOnly, profile, activeYear, selectedYear }) => {
  const effectiveInstitutionId = madrasah?.id;
  const [classes, setClasses] = useState<(Class & { student_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<(Class & { student_count?: number }) | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [openingStudentId, setOpeningStudentId] = useState<string | null>(null);
  const searchRequestIdRef = useRef(0);
  const searchIndexRef = useRef<{ key: string; students: Student[]; cachedAt: number } | null>(null);
  const isDark = madrasah?.theme === 'dark';
  const isDeleteClassEnabled = React.useMemo(() => {
    if (!madrasah?.config_json) return false;
    let cfg = madrasah.config_json as any;
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch (e) { cfg = {}; }
    }
    return cfg?.features?.delete_class === true;
  }, [madrasah?.config_json]);
  const canDeleteClass = isDeleteClassEnabled && (
    !profile ||
    profile?.role === 'super_admin' ||
    profile?.role === 'madrasah_admin' ||
    Boolean(profile?.permissions?.can_manage_classes)
  );

  const targetYear = selectedYear || activeYear;
  const isAdvanceOrHistorical = Boolean(targetYear && targetYear.status !== 'active');

  const activeYearId = React.useMemo(() => {
    if (targetYear?.id) return targetYear.id;
    if (!madrasah?.config_json) return null;
    let config = madrasah.config_json as any;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    const yearId = config?.active_academic_year_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(yearId) ? yearId : null;
  }, [madrasah, targetYear]);

  useEffect(() => { 
    if (madrasah?.id) {
      // Force clear cache once to satisfy user request for fresh start
      requestManager.invalidatePattern(`classes:${effectiveInstitutionId}`);
      fetchClasses(); 
    }
  }, [dataVersion, madrasah?.id, activeYearId]);

  const allowedClassesKey = Array.isArray(profile?.permissions?.allowed_classes)
    ? profile.permissions.allowed_classes.join(',')
    : '';

  useEffect(() => {
    const trimmed = studentSearchQuery.trim();
    if (!trimmed || !effectiveInstitutionId) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearchingStudents(false);
      setSearchError(null);
      return;
    }

    const indexKey = `${effectiveInstitutionId}:${targetYear?.id || activeYearId || 'all'}:${targetYear?.status || 'active'}:${allowedClassesKey}:v${dataVersion}`;
    const now = Date.now();

    // Instant client-side search if the index for this institution/year is warm (< 5 min)
    if (
      searchIndexRef.current &&
      searchIndexRef.current.key === indexKey &&
      now - searchIndexRef.current.cachedAt < 5 * 60 * 1000
    ) {
      setSearchResults(filterAndRankStudents(searchIndexRef.current.students, trimmed).slice(0, 60));
      setSearchingStudents(false);
      setSearchError(null);
      return;
    }

    const reqId = ++searchRequestIdRef.current;
    setSearchingStudents(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      const loadSearchIndex = async (): Promise<Student[]> => {
        const CHUNK_SIZE = 1000;
        const MAX_PAGES = 5;
        const collected: Student[] = [];

        for (let pageIdx = 0; pageIdx < MAX_PAGES; pageIdx++) {
          const from = pageIdx * CHUNK_SIZE;
          const to = from + CHUNK_SIZE - 1;

          const baseFields = `id, institution_id, student_name, name_en, guardian_phone, roll, guardian_name, class_id, section, is_active, photo_url, academic_year_id, classes(class_name)`;
          let selectFields = baseFields;
          if ((window as any)._hasSection === false) selectFields = selectFields.replace('section, ', '');
          if ((window as any)._hasIsActive === false) selectFields = selectFields.replace('is_active, ', '');
          if ((window as any)._hasNameEn === false) selectFields = selectFields.replace('name_en, ', '');

          let query = supabase
            .from('students')
            .select(selectFields)
            .eq('institution_id', effectiveInstitutionId)
            .order('roll', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(from, to);

          if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes && profile.permissions.allowed_classes.length > 0) {
            query = query.in('class_id', profile.permissions.allowed_classes);
          }

          if (targetYear?.id && isValidUUID(targetYear.id)) {
            if (targetYear.status === 'active') {
              query = query.or(`academic_year_id.eq.${targetYear.id},academic_year_id.is.null`);
            } else {
              query = query.eq('academic_year_id', targetYear.id);
            }
          } else if (activeYearId && isValidUUID(activeYearId)) {
            query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
          }

          const { data, error } = await query;

          if (error) {
            if ((window as any)._hasSection === undefined && (error.code === 'PGRST204' || error.message?.includes('section'))) {
              (window as any)._hasSection = false;
              return loadSearchIndex();
            }
            if ((window as any)._hasNameEn === undefined && (error.code === 'PGRST204' || error.message?.includes('name_en'))) {
              (window as any)._hasNameEn = false;
              return loadSearchIndex();
            }
            if ((window as any)._hasIsActive === undefined && (error.code === 'PGRST204' || error.message?.includes('is_active'))) {
              (window as any)._hasIsActive = false;
              return loadSearchIndex();
            }
            throw error;
          }

          const rows = ((data as unknown as any[]) || []).map((s) => ({
            ...s,
            classes: Array.isArray(s.classes) ? s.classes[0] : s.classes,
          })) as Student[];

          collected.push(...rows);
          if (rows.length < CHUNK_SIZE) break;
        }

        return collected;
      };

      try {
        const allStudents = await loadSearchIndex();
        if (reqId !== searchRequestIdRef.current) return;
        searchIndexRef.current = { key: indexKey, students: allStudents, cachedAt: Date.now() };
        setSearchResults(filterAndRankStudents(allStudents, trimmed).slice(0, 60));
        setSearchingStudents(false);
      } catch (err: any) {
        if (reqId !== searchRequestIdRef.current) return;
        console.error('Student search error in Classes:', err);
        setSearchError(lang === 'bn' ? 'শিক্ষার্থী খুঁজতে সমস্যা হয়েছে' : 'Failed to search students');
        setSearchingStudents(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [studentSearchQuery, effectiveInstitutionId, activeYearId, targetYear?.id, targetYear?.status, dataVersion, profile?.role, allowedClassesKey, lang]);

  const handleOpenSearchedStudent = async (student: Student, matchedClass?: Class) => {
    if (!onStudentClick) {
      if (matchedClass) onClassClick(matchedClass);
      return;
    }
    if (openingStudentId === student.id) return;
    setOpeningStudentId(student.id);
    try {
      const extraFieldsStr = 'gender, nationality, religion, father_name, father_occupation, mother_occupation, guardian_relation, permanent_address, previous_institution, previous_class, ';
      const baseFields = `id, institution_id, student_name, name_en, guardian_phone, guardian_phone_2, roll, guardian_name, mother_name, registration_number, class_id, admission_number, date_of_birth, blood_group, address, academic_year_id, section, is_active, photo_url, notes, ${(window as any)._hasExtraCols !== false ? extraFieldsStr : ''}classes(class_name)`;
      let selectFields = (window as any)._hasMotherName === false ? baseFields.replace('mother_name, ', '') : baseFields;
      if ((window as any)._hasSection === false) selectFields = selectFields.replace('section, ', '');
      if ((window as any)._hasIsActive === false) selectFields = selectFields.replace('is_active, ', '');
      if ((window as any)._hasNameEn === false) selectFields = selectFields.replace('name_en, ', '');

      const { data, error } = await supabase
        .from('students')
        .select(selectFields)
        .eq('id', student.id)
        .maybeSingle();

      if (!error && data) {
        const row: any = data;
        const extra = extractStudentExtraFields(row);
        const fullStudent: Student = {
          ...row,
          ...extra,
          classes: Array.isArray(row.classes) ? row.classes[0] : row.classes,
        };
        onStudentClick(fullStudent);
        return;
      }
    } catch (err) {
      console.warn('Could not load full student record, opening cached preview:', err);
    } finally {
      setOpeningStudentId(null);
    }
    onStudentClick(student);
  };

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    
    const cacheKey = madrasah?.id ? `classes_${effectiveInstitutionId}` : 'classes';
    const cached = offlineApi.getCache(cacheKey);
    if (cached) setClasses(sortMadrasahClasses(cached));

    try {
      // 1. Fetch Classes (Cached)
      const { data: classesData, error } = await requestManager.cachedFetch(
        'classes',
        (q) => q.select('*').eq('institution_id', effectiveInstitutionId).order('sort_order', { ascending: true }),
        `classes:${effectiveInstitutionId}`,
        30 * 60 * 1000
      );
      if (error) throw error;
      
      if (classesData) {
        let filteredClasses = classesData;
        if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes && profile.permissions.allowed_classes.length > 0) {
          filteredClasses = classesData.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
        }

        // 2. Fetch Student Class Counts filtered strictly by academic year
        const { data: studentData } = await requestManager.cachedFetch(
          'students',
          (q) => {
            let query = q.select('class_id, academic_year_id').eq('institution_id', effectiveInstitutionId);
            if (targetYear?.id) {
              query = query.eq('academic_year_id', targetYear.id);
            } else if (activeYearId) {
              query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
            }
            return query;
          },
          `student_counts:${effectiveInstitutionId}:${activeYearId || 'all'}`,
          30 * 60 * 1000 // 30 mins
        );
        
        const counts: Record<string, number> = {};
        if (studentData) {
          studentData.forEach(s => {
            if (s.class_id) {
              counts[s.class_id] = (counts[s.class_id] || 0) + 1;
            }
          });
        }

        const withCounts = filteredClasses.map(cls => ({
          ...cls,
          student_count: counts[cls.id] || 0
        }));
        const sorted = sortMadrasahClasses(withCounts);
        setClasses(sorted);
        offlineApi.setCache(cacheKey, sorted);
      }
    } catch (err) { 
      console.error('Fetch Classes Error:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveClass = async () => {
    if (!newClassName.trim() || !madrasah) return;
    setModalLoading(true);
    
    let order: number | null = null;
    if (newSortOrder && newSortOrder.trim() !== '') {
      const bengaliToEnglish: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
      const eng = newSortOrder.replace(/[০-৯]/g, match => bengaliToEnglish[match]).trim();
      const parsed = parseInt(eng, 10);
      if (!isNaN(parsed)) {
        order = parsed;
      }
    }
    
    // Invalidate RequestManager cache immediately
    if (madrasah?.id) {
      await requestManager.invalidatePattern(`classes:${effectiveInstitutionId}`);
      await requestManager.invalidatePattern(`classes`);
    }

    try {
      if (editingClass) {
        // Optimistic Update
        const updatedClasses = classes.map(c => c.id === editingClass.id ? { ...c, class_name: newClassName.trim(), sort_order: order } : c);
        const sorted = sortMadrasahClasses(updatedClasses);
        setClasses(sorted);
        if (madrasah?.id) {
          offlineApi.setCache(`classes_${effectiveInstitutionId}`, sorted);
        }
        
        if (navigator.onLine) {
          const { error } = await supabase.from('classes').update({ 
            class_name: newClassName.trim(),
            sort_order: order 
          }).eq('id', editingClass.id);
          
          if (error) {
            // Fallback to API serverless endpoint if RLS restricts direct update
            const apiRes = await fetch('/api/classes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update',
                id: editingClass.id,
                class_name: newClassName.trim(),
                sort_order: order
              })
            });
            if (!apiRes.ok) {
              const errJson = await apiRes.json().catch(() => ({}));
              throw new Error(errJson.error || error.message);
            }
          }
        } else {
          offlineApi.queueAction('classes', 'UPDATE', { 
            id: editingClass.id, 
            class_name: newClassName.trim(),
            sort_order: order
          });
        }
      } else {
        const tempId = crypto.randomUUID();
        const payload = { 
          id: tempId,
          class_name: newClassName.trim(), 
          institution_id: effectiveInstitutionId,
          sort_order: order
        };
        
        // Optimistic Update
        const updatedClasses = sortMadrasahClasses([...classes, { ...payload, student_count: 0 }]);
        setClasses(updatedClasses);
        if (madrasah?.id) {
          offlineApi.setCache(`classes_${effectiveInstitutionId}`, updatedClasses);
        }

        if (navigator.onLine) {
          const { data, error } = await supabase.from('classes').insert({
            class_name: payload.class_name,
            institution_id: payload.institution_id,
            sort_order: payload.sort_order
          }).select('id, class_name, institution_id, sort_order, created_at').single();
          
          if (error) {
            // Fallback to API serverless endpoint if RLS restricts direct insert
            const apiRes = await fetch('/api/classes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create',
                class_name: payload.class_name,
                institution_id: payload.institution_id,
                sort_order: payload.sort_order
              })
            });
            if (!apiRes.ok) {
              const errJson = await apiRes.json().catch(() => ({}));
              throw new Error(errJson.error || error.message);
            }
            const resData = await apiRes.json();
            if (resData?.class) {
              setClasses(prev => prev.map(c => c.id === tempId ? { ...resData.class, student_count: 0 } : c));
            }
          } else if (data) {
             setClasses(prev => prev.map(c => c.id === tempId ? { ...data, student_count: 0 } : c));
          }
        } else {
          offlineApi.queueAction('classes', 'INSERT', payload);
        }
      }
      
      // Final cache clearing to be safe
      if (madrasah?.id) {
        await requestManager.invalidatePattern(`classes`);
      }
      
      setShowModal(false);
      setNewClassName('');
      setNewSortOrder('');
      setEditingClass(null);
      triggerRefresh();
    } catch (err: any) {
      alert(lang === 'bn' ? `ব্যর্থ হয়েছে: ${err.message}` : `Failed: ${err.message}`);
      fetchClasses();
    } finally { setModalLoading(false); }
  };

  const handleDeleteClass = async () => {
    if (!showDeleteConfirm || !madrasah) return;

    setModalLoading(true);
    
    // Invalidate
    requestManager.invalidatePattern(`classes:${effectiveInstitutionId}`);

    try {
      // Optimistic Delete
      setClasses(prev => prev.filter(c => c.id !== showDeleteConfirm.id));

      if (navigator.onLine) {
        // If there are students associated with this class, unlink them first so foreign key constraint does not block
        if (showDeleteConfirm.student_count && showDeleteConfirm.student_count > 0) {
          await supabase.from('students').update({ class_id: null }).eq('class_id', showDeleteConfirm.id);
        }

        const { error } = await supabase.from('classes').delete().eq('id', showDeleteConfirm.id);
        if (error) {
          // Fallback to API serverless endpoint
          const apiRes = await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              id: showDeleteConfirm.id
            })
          });

          if (!apiRes.ok) {
            const errJson = await apiRes.json().catch(() => ({}));
            if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
              throw new Error(lang === 'bn' 
                ? 'এই শ্রেণিটি ডিলিট করা যাবে না কারণ এটি অন্যান্য তথ্যের (যেমন: ফি আদায়, পরীক্ষা, বা রুটিন) সাথে যুক্ত।' 
                : 'This class cannot be deleted because it is linked to other records (e.g. fees, exams, routine).');
            } else {
              throw new Error(errJson.error || error.message);
            }
          }
        }
      } else {
        // Offline check (limited)
        offlineApi.queueAction('classes', 'DELETE', { id: showDeleteConfirm.id });
      }
      setShowDeleteConfirm(null);
      triggerRefresh();
    } catch (err: any) { 
      alert(err.message); 
      fetchClasses(); // Revert on failure
    } finally { setModalLoading(false); }
  };

  return (
    <>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">

        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <h1 className={`text-xl font-noto font-black ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>{t('classes_title', lang, madrasah?.institution_type)}</h1>
          </div>
          {!readOnly && (
            <button onClick={() => { setNewClassName(''); setNewSortOrder(''); setEditingClass(null); setShowModal(true); }} className="bg-[#2563EB] text-white px-5 py-3 rounded-2xl text-[12px] font-black flex items-center gap-2 active:scale-95 transition-all border border-blue-100 shadow-premium">
              <Plus size={16} strokeWidth={4} /> {t('new_class', lang, madrasah?.institution_type)}
            </button>
          )}
        </div>

        {/* Student Search Bar above Class List */}
        <div className="relative">
          <div className={`relative flex items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200/80'} border rounded-[1.6rem] shadow-sm focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/15 transition-all`}>
            <Search size={18} className={`ml-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'শিক্ষার্থীর নাম লিখে খুঁজুন...' : 'Search student by name...'}
              aria-label={lang === 'bn' ? 'শিক্ষার্থীর নাম লিখে খুঁজুন' : 'Search student by name'}
              className={`w-full px-3 py-3.5 bg-transparent outline-none text-sm font-noto font-bold ${isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`}
            />
            {searchingStudents && (
              <Loader2 size={18} className="mr-3 shrink-0 animate-spin text-[#2563EB]" />
            )}
            {studentSearchQuery && (
              <button
                type="button"
                onClick={() => setStudentSearchQuery('')}
                aria-label={lang === 'bn' ? 'অনুসন্ধান মুছুন' : 'Clear search'}
                className={`mr-3 p-1.5 rounded-full transition-colors shrink-0 ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Results */}
          {studentSearchQuery.trim() !== '' && (
            <div className="mt-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between px-2">
                <p className={`text-xs font-black font-noto ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {lang === 'bn' ? 'খুঁজে পাওয়া শিক্ষার্থী' : 'Matching Students'}
                  {!searchingStudents && !searchError ? ` (${searchResults.length})` : ''}
                </p>
                {searchResults.length === 60 && (
                  <span className="text-[10px] font-bold text-slate-400 font-noto">
                    {lang === 'bn' ? 'সর্বোচ্চ ৬০টি ফলাফল' : 'Top 60 results'}
                  </span>
                )}
              </div>

              {searchError ? (
                <div className={`${isDark ? 'bg-red-950/30 border-red-900/50 text-red-300' : 'bg-red-50 border-red-100 text-red-600'} border rounded-2xl p-4 text-xs font-bold flex items-center gap-2 font-noto`}>
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{searchError}</span>
                </div>
              ) : searchingStudents && searchResults.length === 0 ? (
                <div className={`${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-500'} border rounded-2xl p-6 text-center text-xs font-bold flex items-center justify-center gap-2 font-noto`}>
                  <Loader2 size={16} className="animate-spin text-[#2563EB]" />
                  <span>{lang === 'bn' ? 'শিক্ষার্থী খোঁজা হচ্ছে...' : 'Searching students...'}</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className={`${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-500'} border rounded-2xl p-6 text-center text-xs font-bold font-noto`}>
                  {lang === 'bn' ? `"${studentSearchQuery.trim()}" নামে কোনো শিক্ষার্থী পাওয়া যায়নি` : `No students found matching "${studentSearchQuery.trim()}"`}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {searchResults.map((student) => {
                    const matchedClass = classes.find((c) => c.id === student.class_id);
                    const className = student.classes?.class_name || matchedClass?.class_name || (lang === 'bn' ? 'শ্রেণি নির্ধারিত নয়' : 'Unassigned');
                    return (
                      <div
                        key={student.id}
                        onClick={() => handleOpenSearchedStudent(student, matchedClass)}
                        className={`${isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-500/50' : 'bg-white border-slate-100 hover:border-blue-200'} p-3.5 rounded-[1.8rem] border flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all shadow-sm group`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {student.photo_url ? (
                            <img
                              src={student.photo_url}
                              alt={student.student_name}
                              className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-slate-600"
                            />
                          ) : (
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${isDark ? 'bg-slate-700 text-blue-400' : 'bg-[#EAF4FF] text-[#2563EB]'}`}>
                              {student.student_name?.charAt(0) || 'শ'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className={`font-black text-sm font-noto truncate ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                                {student.student_name}
                              </h4>
                              {student.is_active === false && (
                                <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 font-noto">
                                  {lang === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg font-noto ${isDark ? 'bg-slate-700 text-blue-300' : 'bg-[#EAF4FF] text-[#2563EB]'}`}>
                                {className}
                              </span>
                              {student.roll != null && (
                                <span className={`text-[10px] font-bold font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {lang === 'bn' ? `রোল: ${student.roll}` : `Roll: ${student.roll}`}
                                </span>
                              )}
                              {student.section && (
                                <span className={`text-[10px] font-bold font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ({student.section})
                                </span>
                              )}
                            </div>
                            {(student.guardian_name || student.guardian_phone) && (
                              <p className={`text-[10px] font-semibold mt-0.5 truncate flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {student.guardian_name && <span className="truncate">{student.guardian_name}</span>}
                                {student.guardian_name && student.guardian_phone && <span>•</span>}
                                {student.guardian_phone && (
                                  <span className="inline-flex items-center gap-0.5 shrink-0">
                                    <Phone size={9} /> {student.guardian_phone}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        {openingStudentId === student.id ? (
                          <Loader2 size={17} className="animate-spin text-[#2563EB] shrink-0" />
                        ) : (
                          <ChevronRight size={17} strokeWidth={3} className={`${isDark ? 'text-slate-600 group-hover:text-blue-400' : 'text-blue-200 group-hover:text-[#2563EB]'} shrink-0 transition-colors`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 px-2">
                <p className={`text-xs font-black font-noto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('classes_title', lang, madrasah?.institution_type)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {classes.map(cls => (
            <div key={cls.id} onClick={() => onClassClick(cls)} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 sm:p-5 rounded-[2.2rem] border flex items-center justify-between active:scale-[0.98] transition-all group shadow-bubble relative overflow-hidden`}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB]'} rounded-2xl flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={20} className="sm:size-6" />
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} text-[16px] sm:text-[18px] font-noto line-clamp-2 leading-tight tracking-tight break-words`}>
                      {cls.class_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users size={12} className={isDark ? 'text-blue-400/60' : 'text-[#2563EB]/60'} />
                    <p className={`text-[9px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-[0.1em]`}>{cls.student_count || 0} {t('students_count', lang, madrasah?.institution_type)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {!readOnly && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setNewClassName(cls.class_name || ''); setNewSortOrder(cls.sort_order?.toString() || ''); setEditingClass(cls); setShowModal(true); }} 
                      className={`w-9 h-9 sm:w-10 sm:h-10 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB]'} rounded-xl flex items-center justify-center border active:scale-90 transition-all shadow-sm`}>
                      <Edit3 size={14} className="sm:size-4" />
                    </button>
                    {canDeleteClass && (
                      <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(cls); }} 
                        className={`w-9 h-9 sm:w-10 sm:h-10 ${isDark ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-500'} rounded-xl flex items-center justify-center border active:scale-90 transition-all shadow-sm`}>
                        <Trash2 size={14} className="sm:size-4" />
                      </button>
                    )}
                  </>
                )}
                <ChevronRight className={`${isDark ? 'text-slate-600 group-hover:text-blue-400' : 'text-blue-200 group-hover:text-[#2563EB]'} transition-colors ml-0.5`} size={18} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[3.5rem] p-10 shadow-bubble border relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => setShowModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#2563EB] transition-all"><X size={26} strokeWidth={3} /></button>
            

            <div className="flex items-center gap-5 mb-8">
               <div className={`w-16 h-16 ${isDark ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-blue-50 text-[#2563EB]'} rounded-[1.8rem] flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto tracking-tight`}>
                    {editingClass ? t('edit_class', lang, madrasah?.institution_type) : t('new_class', lang, madrasah?.institution_type)}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Class Information</p>
               </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{t('class_name_label', lang, madrasah?.institution_type)}</label>
                <input 
                  type="text" 
                  autoFocus
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:bg-white'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#2563EB]/30 transition-all shadow-inner`} 
                  value={newClassName} 
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="যেমন: হিফয বিভাগ"
                />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                  <Hash size={12} /> সিরিয়াল নম্বর (Sorting)
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9০-৯]*"
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-800' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:bg-white'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#2563EB]/30 transition-all shadow-inner`} 
                  value={newSortOrder} 
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="যেমন: ১"
                />
              </div>

              <button onClick={handleSaveClass} disabled={modalLoading || !newClassName.trim()} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg">
                {modalLoading ? <Loader2 className="animate-spin" size={24} /> : <><Check size={24} strokeWidth={4} /> {t('save', lang)}</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} w-full max-w-sm rounded-[3.5rem] p-8 sm:p-10 shadow-bubble border text-center space-y-6 animate-in zoom-in-95 duration-300`}>
             <div className={`w-20 h-20 ${isDark ? "bg-red-900/30 text-red-400 border-red-900/50" : "bg-red-50 text-red-500"} rounded-full flex items-center justify-center mx-auto shadow-inner border`}>
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-800"} font-noto`}>
                  {lang === "bn" ? "আপনি কি নিশ্চিতভাবে ডিলিট করতে চান?" : "Are you sure you want to delete?"}
                </h3>
                <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-2 font-noto px-2">
                  {lang === "bn"
                    ? `"${showDeleteConfirm.class_name}" শ্রেণিটি স্থায়ীভাবে মুছে ফেলা হবে।`
                    : `"${showDeleteConfirm.class_name}" class will be permanently deleted.`}
                </p>
                {showDeleteConfirm.student_count && showDeleteConfirm.student_count > 0 ? (
                  <p className="text-[11px] font-bold text-red-500 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-950/40 p-3 rounded-2xl border border-red-100 dark:border-red-900/40 font-noto">
                    {lang === "bn"
                      ? `সতর্কতা: এই শ্রেণিতে বর্তমানে ${showDeleteConfirm.student_count} জন শিক্ষার্থী যুক্ত রয়েছে।`
                      : `Warning: This class currently has ${showDeleteConfirm.student_count} active students.`}
                  </p>
                ) : null}
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button onClick={handleDeleteClass} disabled={modalLoading} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-full shadow-xl shadow-red-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center text-md font-noto">
                  {modalLoading ? <Loader2 className="animate-spin" size={22} /> : (lang === "bn" ? "ডিলিট করুন" : "Delete Class")}
                </button>
                <button onClick={() => setShowDeleteConfirm(null)} className={`w-full py-4 ${isDark ? "bg-[#1E293B] text-slate-400" : "bg-slate-50 text-slate-400"} font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest`}>
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Classes;
