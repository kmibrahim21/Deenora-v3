
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Loader2, CheckCircle2, Table, AlertTriangle, FileUp, FileSpreadsheet, FileText } from 'lucide-react';
import { supabase } from 'supabase';
import { requestManager } from 'services/RequestManager';
import { Institution, Language } from 'types';
import * as XLSX from 'xlsx';
import { generateStudentListPDF } from 'utils/pdfGenerator';

// Declare the Android interface for TypeScript
declare global {
  interface Window {
    AndroidInterface?: {
      downloadFile: (base64: string, fileName: string, mimeType: string) => void;
    };
  }
}

interface DataManagementProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  triggerRefresh: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ lang, madrasah, onBack, triggerRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploadActive = React.useMemo(() => {
    let configObj: any = {};
    if (madrasah?.config_json) {
      if (typeof madrasah.config_json === 'string') {
        try { configObj = JSON.parse(madrasah.config_json); } catch (e) { configObj = {}; }
      } else {
        configObj = madrasah.config_json;
      }
    }
    return configObj.modules?.backup_restore ?? false;
  }, [madrasah]);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!madrasah) return;
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('sort_order', { ascending: true });
      if (data) {
        const sorted = [...data].sort((a, b) => {
          const getOrder = (val: any) => {
            if (val === 0) return 0;
            if (val == null || String(val).trim() === '') return 999999;
            const num = Number(val);
            return isNaN(num) ? 999999 : num;
          };
          const orderA = getOrder(a.sort_order);
          const orderB = getOrder(b.sort_order);
          if (orderA !== orderB) return orderA - orderB;
          return (a.class_name || '').localeCompare((b.class_name || ''), 'bn', { numeric: true });
        });
        setClasses(sorted);
      }
    };
    fetchClasses();
  }, [madrasah]);
  const isDark = madrasah?.theme === 'dark';

  const getStudentSortHelpers = (classList: any[]) => {
    const classMap = new Map<string, any>();
    classList.forEach(c => {
      if (c.id) classMap.set(c.id, c);
    });

    const getClassInfo = (s: any) => {
      const cFromMap = s.class_id ? classMap.get(s.class_id) : null;
      const cFromJoin = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      const cls = cFromMap || cFromJoin;

      const className = cls?.class_name || 'N/A';

      let sortOrder = 999999;
      if (cls && cls.sort_order !== undefined && cls.sort_order !== null && String(cls.sort_order).trim() !== '') {
        const num = Number(cls.sort_order);
        if (!isNaN(num)) {
          sortOrder = num;
        }
      }
      return { className, sortOrder };
    };

    const sortStudents = (studentArray: any[]) => {
      return [...studentArray].map(s => {
        const cFromMap = s.class_id ? classMap.get(s.class_id) : null;
        const cFromJoin = Array.isArray(s.classes) ? s.classes[0] : s.classes;
        const cls = cFromMap || cFromJoin;
        return {
          ...s,
          classes: cls || null
        };
      }).sort((a, b) => {
        const infoA = getClassInfo(a);
        const infoB = getClassInfo(b);

        if (infoA.sortOrder !== infoB.sortOrder) {
          return infoA.sortOrder - infoB.sortOrder;
        }

        if (infoA.className !== infoB.className) {
          return infoA.className.localeCompare(infoB.className, 'bn', { numeric: true });
        }

        const rollA = a.roll != null && String(a.roll).trim() !== '' ? Number(a.roll) : 999999;
        const rollB = b.roll != null && String(b.roll).trim() !== '' ? Number(b.roll) : 999999;
        const validRollA = isNaN(rollA) ? 999999 : rollA;
        const validRollB = isNaN(rollB) ? 999999 : rollB;

        if (validRollA !== validRollB) {
          return validRollA - validRollB;
        }

        return (a.student_name || '').localeCompare(b.student_name || '', 'bn');
      });
    };

    return { getClassInfo, sortStudents };
  };

  const downloadFileNative = (blob: Blob, fileName: string, mimeType: string) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      if (window.AndroidInterface && typeof window.AndroidInterface.downloadFile === 'function') {
        const base64Content = base64data.split(',')[1];
        window.AndroidInterface.downloadFile(base64Content, fileName, mimeType);
      } else {
        const link = document.createElement('a');
        link.href = base64data;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    reader.readAsDataURL(blob);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Class': 'Class 1',
        'Roll': 1,
        'Student Name': 'Abdur Rahman',
        'Guardian Name': 'Abdullah',
        'Phone 1': '01700000000',
        'Phone 2': '',
        'Admission ID': '12345',
        'Section': 'Section A / Science',
        'Address': 'Dhaka, Bangladesh',
        'Date of birth': '2010-01-01',
        'English Name': 'Abdur Rahman'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    downloadFileNative(blob, 'madrasah_sample_template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    setStatus({
      type: 'success',
      message: lang === 'bn' ? 'স্যাম্পল ফাইল ডাউনলোড হয়েছে' : 'Sample file downloaded'
    });
    setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
  };

  const handleExportExcel = async () => {
    if (!madrasah) return;
    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    
    try {
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('*, classes(class_name, sort_order)')
        .eq('institution_id', madrasah.id);
        
      if (fetchError) throw fetchError;
      if (!students || students.length === 0) {
        throw new Error(lang === 'bn' ? "কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি" : "No student data found");
      }

      const { sortStudents, getClassInfo } = getStudentSortHelpers(classes);
      const sortedStudents = sortStudents(students);
      
      const excelData = sortedStudents.map(s => {
        const info = getClassInfo(s);
        return { 
          'Class': info.className, 
          'Roll': s.roll || '', 
          'Student Name': s.student_name || '', 
          'Guardian Name': s.guardian_name || '',
          'Phone 1': s.guardian_phone || '',
          'Phone 2': s.guardian_phone_2 || '',
          'Section': s.section || '',
          'Admission ID': s.admission_number || '',
          'Address': s.address || '',
          'Date of birth': s.date_of_birth || '',
          'English Name': s.name_en || ''
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new(); 
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `${madrasah.name.replace(/\s+/g, '_')}_students.xlsx`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([excelBuffer], { type: mimeType });

      downloadFileNative(blob, fileName, mimeType);

      setStatus({
        type: 'success',
        message: lang === 'bn' ? 'সফলভাবে ডাউনলোড হয়েছে' : 'Downloaded Successfully'
      });
    } catch (err: any) { 
      setStatus({ type: 'error', message: err.message }); 
    } finally { 
      setLoading(false); 
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
    }
  };

  const handleExportPDF = async () => {
    if (!madrasah) return;
    setGeneratingPDF(true);
    setDownloadProgress(0);
    setStatus({ type: 'idle', message: '' });
    
    try {
      let query = supabase
        .from('students')
        .select('*, classes(class_name, sort_order)')
        .eq('institution_id', madrasah.id);
        
      if (selectedClassId !== 'all') {
        query = query.eq('class_id', selectedClassId);
      }

      const { data: students, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      if (!students || students.length === 0) {
        throw new Error(lang === 'bn' ? "কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি" : "No student data found");
      }

      const { sortStudents } = getStudentSortHelpers(classes);
      const sortedStudents = sortStudents(students);

      const className = selectedClassId === 'all' 
        ? undefined 
        : classes.find(c => c.id === selectedClassId)?.class_name;

      await generateStudentListPDF(sortedStudents, madrasah, className, lang, (p) => setDownloadProgress(p));

      setStatus({
        type: 'success',
        message: lang === 'bn' ? 'সফলভাবে পিডিএফ ডাউনলোড হয়েছে' : 'PDF Downloaded Successfully'
      });
    } catch (err: any) { 
      setStatus({ type: 'error', message: err.message }); 
    } finally { 
      setGeneratingPDF(false); 
      setDownloadProgress(0);
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
    }
  };

  const excelDateToISO = (serial: any) => {
    if (!serial) return null;
    if (typeof serial === 'string' && serial.includes('-')) return serial;
    const num = parseFloat(serial);
    if (isNaN(num)) return null;
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isUploadActive) {
      setStatus({
        type: 'error',
        message: lang === 'bn' ? 'দুঃখিত, সুপার এডমিন থেকে আপলোড অপশন নিষ্ক্রিয় করা রয়েছে।' : 'Sorry, the upload option has been deactivated by the Super Admin.'
      });
      return;
    }

    const file = e.target.files?.[0];
    if (!file || !madrasah) return;

    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    setProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: '' }) as any[];

          let rows = jsonData.slice(1);
          if (rows.length === 0) throw new Error("File is empty");

          let currentLimit = madrasah.config_json?.student_limit || 0;
          let total = rows.length;

          if (navigator.onLine) {
            const { data: instData } = await supabase.from('institutions').select('config_json').eq('id', madrasah.id).single();
            let freshConfig: any = instData?.config_json;
            if (typeof freshConfig === 'string') {
              try { freshConfig = JSON.parse(freshConfig); } catch (e) { freshConfig = {}; }
            }
            if (freshConfig?.student_limit !== undefined) {
              currentLimit = Number(freshConfig.student_limit);
            }
          }

          if (currentLimit > 0 && navigator.onLine) {
            const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
            if (!error && count !== null) {
              if (count >= currentLimit) {
                throw new Error(lang === 'bn' ? `দুঃখিত, আপনার প্রতিষ্ঠানে সর্বোচ্চ ${currentLimit} জন শিক্ষার্থী অ্যাড করার লিমিট রয়েছে।` : `Limit reached! You can only add up to ${currentLimit} students.`);
              }
              const remainingAllowed = currentLimit - count;
              if (rows.length > remainingAllowed) {
                rows = rows.slice(0, remainingAllowed);
                total = rows.length;
                alert(lang === 'bn' ? `আপনার লিমিট অনুযায়ী মাত্র ${remainingAllowed} জন শিক্ষার্থী যোগ করা হবে।` : `Due to limit, only ${remainingAllowed} students will be imported.`);
              }
            }
          }

          let successCount = 0;
          let skippedCount = 0;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const className = String(row.A || '').trim();
            const rollValue = parseInt(row.B);
            const roll = isNaN(rollValue) ? null : rollValue;
            const studentName = String(row.C || '').trim();
            const guardianName = String(row.D || '').trim();
            const phone = String(row.E || '').trim();
            const phone2 = String(row.F || '').trim();
            const sectionValue = String(row.G || '').trim();
            const admissionNumber = String(row.H || '').trim();
            const address = String(row.I || '').trim();
            const dob = excelDateToISO(row.J);
            const nameEn = String(row.K || '').trim();

            if (!studentName || !phone || !className) {
              skippedCount++;
              continue;
            }

            let classId = '';
            const { data: existingClass } = await supabase
              .from('classes')
              .select('id')
              .eq('institution_id', madrasah.id)
              .eq('class_name', className)
              .maybeSingle();

            if (existingClass) {
              classId = existingClass.id;
            } else {
              const { data: newClass, error: classError } = await supabase
                .from('classes')
                .insert({ institution_id: madrasah.id, class_name: className })
                .select('id')
                .single();
              if (classError) {
                skippedCount++;
                continue;
              }
              classId = newClass.id;
            }

            // Check if student already exists in this class with same name and roll
            let studentQuery = supabase
              .from('students')
              .select('id')
              .eq('institution_id', madrasah.id)
              .eq('class_id', classId)
              .eq('student_name', studentName);
            
            if (roll === null) {
              studentQuery = studentQuery.is('roll', null);
            } else {
              studentQuery = studentQuery.eq('roll', roll);
            }

            const { data: existingStudent } = await studentQuery.maybeSingle();

            if (existingStudent) {
              skippedCount++;
              setProgress(Math.round(((i + 1) / total) * 100));
              continue;
            }

            const studentData: any = {
                institution_id: madrasah.id,
                class_id: classId,
                student_name: studentName,
                admission_number: admissionNumber || null,
                roll: roll,
                date_of_birth: dob || null,
                name_en: nameEn || null,
                address: address || null,
                guardian_name: guardianName || null,
                guardian_phone: phone,
                guardian_phone_2: phone2 || null
            };

            if ((window as any)._hasSection !== false) {
              studentData.section = sectionValue || null;
            }

            const { error: studentError } = await supabase
              .from('students')
              .insert(studentData);

            if (!studentError) {
              successCount++;
            } else {
              skippedCount++;
            }
            setProgress(Math.round(((i + 1) / total) * 100));
          }

          const msg = lang === 'bn' 
            ? `${successCount} জন শিক্ষার্থী আপলোড হয়েছে, ${skippedCount} জন ইতিমধ্যে ছিল বা ত্রুটির কারণে বাদ পড়েছে।` 
            : `${successCount} students imported, ${skippedCount} skipped (already exists or error).`;

          setStatus({ 
            type: 'success', 
            message: msg
          });
          
          if (madrasah?.id) {
            requestManager.invalidatePattern('fetch:students:');
            requestManager.invalidatePattern('fetch:classes:');
            requestManager.invalidatePattern('dashboard_');
          }
          
          triggerRefresh();
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message });
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setLoading(false);
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-24">
      {generatingPDF && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
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
                  strokeDashoffset={263.89 * (1 - downloadProgress / 100)} 
                  strokeLinecap="round" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="42" 
                  cx="50" 
                  cy="50" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-black text-xl dark:text-white">
                {downloadProgress}%
              </div>
            </div>
            <h3 className="text-xl font-black mb-2 dark:text-white">
              {lang === 'bn' ? 'ফাইল তৈরি হচ্ছে...' : 'Generating File...'}
            </h3>
            <p className="text-slate-500 text-sm">
              {lang === 'bn' ? 'দয়া করে কিছুক্ষণ অপেক্ষা করুন।' : 'Please wait while we prepare your document.'}
            </p>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md pb-4 pt-2">
        <div className="flex items-center gap-5 px-2">
          <button onClick={onBack} className={`w-14 h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-50 border-blue-100 text-[#2563EB]'} rounded-2xl flex items-center justify-center active:scale-90 transition-all border shadow-sm`}>
            <ArrowLeft size={28} strokeWidth={3} />
          </button>
          <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} font-noto`}>{lang === 'bn' ? 'ডাটা ম্যানেজমেন্ট' : 'Data Management'}</h1>
        </div>
      </div>

      {status.message && (
        <div className={`p-6 rounded-3xl border-2 flex items-center gap-4 animate-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
           {status.type === 'success' ? <CheckCircle2 size={30} /> : <AlertTriangle size={30} />}
           <p className="font-black text-sm">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] border p-10 shadow-bubble relative overflow-hidden group`}>
          <div className="flex items-center gap-6 mb-10">
            <div className={`w-16 h-16 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-[1.5rem] flex items-center justify-center border shadow-inner`}>
              <Download size={32} />
            </div>
            <div>
              <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>{lang === 'bn' ? 'ডাটা এক্সপোর্ট' : 'Data Export'}</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Direct Download File</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <button onClick={handleExportExcel} disabled={loading} className="w-full h-[64px] bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-4 text-xl disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={28} /> : (
                <><Download size={28} /> {lang === 'bn' ? 'এক্সেল ডাউনলোড' : 'Excel Download'}</>
              )}
            </button>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
               <div className="flex flex-col gap-2">
                 <label className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                   {lang === 'bn' ? 'ক্লাস নির্বাচন (পিডিএফ এর জন্য)' : 'Select Class (for PDF)'}
                 </label>
                 <select 
                   value={selectedClassId}
                   onChange={(e) => setSelectedClassId(e.target.value)}
                   className={`w-full h-12 rounded-xl px-4 border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-[#1E3A8A]'} font-bold outline-none focus:border-blue-500 transition-all`}
                 >
                   <option value="all">{lang === 'bn' ? 'সকল ক্লাস' : 'All Classes'}</option>
                   {classes.map(c => (
                     <option key={c.id} value={c.id}>{c.class_name}</option>
                   ))}
                 </select>
               </div>

               <button 
                 onClick={handleExportPDF} 
                 disabled={generatingPDF} 
                 className={`w-full h-[64px] ${isDark ? 'bg-emerald-600' : 'bg-emerald-500'} text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-4 text-xl disabled:opacity-50`}
               >
                 {generatingPDF ? <Loader2 className="animate-spin" size={28} /> : (
                   <><FileText size={28} /> {lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'PDF Download'}</>
                 )}
               </button>
            </div>
          </div>
        </div>

        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[3rem] border p-10 shadow-bubble relative overflow-hidden group`}>
          <div className="flex items-center gap-6 mb-8">
            <div className={`w-16 h-16 ${!isUploadActive ? 'bg-red-50 text-red-500 border-red-100' : isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-[1.5rem] flex items-center justify-center border shadow-inner`}>
              <Upload size={32} />
            </div>
            <div>
              <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto leading-tight`}>{lang === 'bn' ? 'ডাটা আপলোড' : 'Data Upload'}</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Select Excel File</p>
            </div>
          </div>
          
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} />
          
          <div 
            onClick={() => {
              if (loading) return;
              if (!isUploadActive) {
                setStatus({
                  type: 'error',
                  message: lang === 'bn' ? 'দুঃখিত, সুপার এডমিন থেকে আপলোড অপশন নিষ্ক্রিয় করা রয়েছে।' : 'Sorry, the upload option has been deactivated by the Super Admin.'
                });
                return;
              }
              fileInputRef.current?.click();
            }} 
            className={`w-full py-12 ${!isUploadActive ? 'opacity-70 cursor-not-allowed bg-red-50/10 border-red-200/50 text-red-500' : isDark ? 'bg-slate-700/50 border-slate-600 text-blue-400 hover:bg-blue-100/10' : 'bg-blue-50 border-[#2563EB]/20 text-[#2563EB] hover:bg-blue-100/10'} border-4 border-dashed rounded-[2.5rem] font-black text-sm flex flex-col items-center justify-center gap-5 transition-all cursor-pointer ${loading ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}`}
          >
            {loading ? (
              <>
                <div className="relative w-20 h-20">
                   <Loader2 size={80} className="animate-spin absolute inset-0 opacity-20" />
                   <div className="absolute inset-0 flex items-center justify-center text-xl font-black">{progress}%</div>
                </div>
                <span className="font-noto text-lg text-center px-4">{lang === 'bn' ? 'আপলোড হচ্ছে, দয়া করে অপেক্ষা করুন...' : 'Uploading, please wait...'}</span>
              </>
            ) : !isUploadActive ? (
              <>
                <AlertTriangle size={60} className="opacity-80 text-red-500 animate-pulse" />
                <span className="font-noto text-lg text-red-500 text-center px-4 font-black">
                  {lang === 'bn' ? 'আপলোড অপশন সুপার এডমিন দ্বারা নিষ্ক্রিয় করা রয়েছে' : 'Upload option is disabled by Super Admin'}
                </span>
              </>
            ) : (
              <>
                <FileUp size={60} className="opacity-50" />
                <span className="font-noto text-lg">{lang === 'bn' ? 'এক্সেল ফাইল সিলেক্ট করুন' : 'Select Excel File'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-bubble space-y-5`}>
        <div className={`flex items-center justify-between gap-4 ${isDark ? 'text-white' : 'text-[#1E3A8A]'} px-1`}>
          <div className="flex items-center gap-4">
            <Table size={24} />
            <h3 className="text-lg font-black font-noto">{lang === 'bn' ? 'এক্সেল ফরম্যাট গাইড' : 'Excel Format Guide'}</h3>
          </div>
          <button 
            onClick={handleDownloadSample}
            className={`flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-slate-700 text-blue-400 border-slate-600' : 'bg-blue-50 text-[#2563EB] border-blue-100'} rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border`}
          >
            <FileSpreadsheet size={16} /> {lang === 'bn' ? 'স্যাম্পল ফাইল' : 'Sample File'}
          </button>
        </div>
        <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-400'} leading-relaxed px-1`}>{lang === 'bn' ? 'আপনার এক্সেল ফাইলটি নিচের ১১টি কলামের ফরম্যাটে হতে হবে (অথবা স্যাম্পল ফাইলটি ডাউনলোড করুন):' : 'Your Excel file must match the following 11 column format (or download the sample file):'}</p>
        <div className="grid grid-cols-5 lg:grid-cols-11 gap-3">
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col A</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Class</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col B</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Roll</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col C</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Student Name</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col D</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Guardian Name</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col E</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Phone 1</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col F</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Phone 2</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col G</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Section</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col H</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Admission ID</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col I</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Address</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col J</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>Date of birth</p></div>
           <div className={`${isDark ? 'bg-slate-700' : 'bg-slate-50'} p-4 rounded-2xl text-center`}><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Col K</p><p className={`font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>English Name</p></div>
        </div>
      </div>
    </div>
  );
};

export default DataManagement;
