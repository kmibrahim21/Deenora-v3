import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, FileText, Download, UserCheck, Loader2, Eye } from 'lucide-react';
import { Institution, Profile, Class, Student, Language } from '../types';
import { supabase } from '../supabase';
import { t } from '../translations';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import jsPDF from 'jspdf';
import { saveJsPdf } from '../utils/fileDownloader';
import { toJpeg, toPng } from 'html-to-image';
import { CertificateTemplate } from '../components/pdf/CertificateTemplate';
import { solaimanLipiBase64 } from '../utils/fonts';

import { requestManager } from 'services/RequestManager';

interface CertificatesProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile: Profile | null;
}

const certificateTypes = [
  { id: 'tc', label: 'Transfer Certificate (TC)', labelBn: 'ট্রান্সফার সার্টিফিকেট (টিসি)' },
  { id: 'testimonial', label: 'Testimonial', labelBn: 'প্রশংসাপত্র' },
  { id: 'exam_cert', label: 'General Certificate', labelBn: 'সনদপত্র' },
  { id: 'attestation', label: 'Attestation Certificate', labelBn: 'প্রত্যয়ন পত্র' },
  { id: 'character', label: 'Character Certificate', labelBn: 'চারিত্রিক সনদপত্র' },
];

import { sortMadrasahClasses } from 'pages/Classes';

const Certificates: React.FC<CertificatesProps> = ({ lang, madrasah, onBack, profile }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassMap, setSelectedClassMap] = useState<Record<string, string>>({});
  
  const [certLang, setCertLang] = useState<'bn' | 'en'>('bn');
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('testimonial');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [gpa, setGpa] = useState<string>('');
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // For responsive preview
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (selectedStudentId && selectedClassId) {
      const fetchStudentGpa = async () => {
        if (!madrasah) return;
        try {
          setGpa(''); // Reset
          const { data: latestExam } = await supabase
            .from('exams')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('exam_date', { ascending: false })
            .limit(1)
            .single();
            
          if (!latestExam) return;
          
          const { data: subjects } = await supabase
            .from('exam_subjects')
            .select('*')
            .eq('exam_id', latestExam.id);
            
          if (!subjects || subjects.length === 0) return;
          
          const { data: marks } = await supabase
            .from('exam_marks')
            .select('*')
            .eq('exam_id', latestExam.id)
            .eq('student_id', selectedStudentId);
            
          if (!marks || marks.length === 0) return;
          
          let passStatus = true;
          let pointsSum = 0;
          let numMainSubjects = 0;
          const rs = (madrasah.config_json as any)?.result_system || 'grading';

          subjects.forEach(sub => {
            const mark = marks.find(m => m.subject_id === sub.id)?.marks_obtained || 0;
            const score = typeof mark === 'string' ? parseFloat(mark) : mark;
            const passMarks = sub.pass_marks || 33;
            const fullMarks = sub.full_marks || 100;
            const failed = score < passMarks;
            const isOptionalEffectively = !!sub.is_optional && rs === 'grading_optional';
            
            if (!isOptionalEffectively && failed) passStatus = false;
            
            const pct = (score / fullMarks) * 100;
            
            let gp = 0;
            if (!failed) {
              if (pct >= 80) gp = 5.00;
              else if (pct >= 70) gp = 4.00;
              else if (pct >= 60) gp = 3.50;
              else if (pct >= 50) gp = 3.00;
              else if (pct >= 40) gp = 2.00;
              else gp = 1.00;
            }
            
            if (rs === 'grading_optional') {
              if (!isOptionalEffectively) {
                pointsSum += gp;
                numMainSubjects++;
              } else {
                 if (gp > 2) pointsSum += (gp - 2);
              }
            } else {
                pointsSum += gp;
                numMainSubjects++;
            }
          });
          
          if (!passStatus) {
             setGpa('0.00');
             return;
          }
          
          const finalGpa = numMainSubjects > 0 ? Math.min(5.00, pointsSum / numMainSubjects) : 0;
          setGpa(finalGpa.toFixed(2));
          
        } catch (err) {
           console.error("Error computing GPA:", err);
        }
      };

      fetchStudentGpa();
    }
  }, [selectedStudentId, selectedClassId, madrasah]);

  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        // Find the actual container width instead of assuming offsetWidth
        const parentWidth = previewContainerRef.current.parentElement?.clientWidth || window.innerWidth;
        const availableWidth = parentWidth - 48; // padding
        const scale = Math.min(1, availableWidth / 1122);
        setPreviewScale(scale);
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    
    let observer: ResizeObserver;
    if (previewContainerRef.current) {
      observer = new ResizeObserver(updateScale);
      observer.observe(previewContainerRef.current.parentElement!);
    }
    
    return () => {
      window.removeEventListener('resize', updateScale);
      if (observer) observer.disconnect();
    }
  }, [selectedStudentId, students, classes]);

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
        .select('*')
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

  const formatIssueDate = () => {
    if (!issueDate) return '';
    const d = new Date(issueDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getStudentWithClass = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return null;
    return {
       ...student,
       className: selectedClassMap[selectedStudentId] || classes.find(c => c.id === selectedClassId)?.class_name || '',
       gpa: gpa
    };
  };

  const generatePDF = async () => {
    if (!madrasah || !selectedStudentId) return;
    const studentWithClass = getStudentWithClass();
    if (!studentWithClass) return;

    setDownloading(true);
    const typeName = certificateTypes.find(t => t.id === selectedType)?.label.replace(/\s+/g, '_') || 'Certificate';
    const safeStudentName = (studentWithClass.student_name || 'Student').replace(/\s+/g, '_');
    const filename = `${safeStudentName}_${typeName}.pdf`;

    try {
      // 1. Server-Side Generation with /api/pdf (Puppeteer + Supabase cache)
      const certHtml = renderToString(
        <CertificateTemplate 
          madrasah={madrasah} 
          student={studentWithClass} 
          type={selectedType}
          issueDate={formatIssueDate()}
          certLang={certLang}
        />
      );

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${safeStudentName}_Certificate</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @font-face {
              font-family: 'SolaimanLipi';
              src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype'),
                   url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-normal-v1.0.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: 'SolaimanLipi';
              src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype'),
                   url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-bold-v1.0.ttf') format('truetype');
              font-weight: bold;
              font-style: normal;
              font-display: swap;
            }
            @import url('https://fonts.googleapis.com/css2?family=Charm:wght@400;700&family=Noto+Serif+Bengali:wght@400;700;900&family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Tiro+Bangla:ital@0;1&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Inter:wght@400;500;600;700&display=swap');
            @page {
              size: a4 landscape;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: white;
              width: 297mm;
              height: 210mm;
              overflow: hidden;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .cert-scale-wrapper {
              width: 1122px;
              height: 793px;
              box-sizing: border-box;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div class="cert-scale-wrapper">
            ${certHtml}
          </div>
        </body>
        </html>
      `;

      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: fullHtml,
          format: 'a4',
          orientation: 'landscape',
          entity_type: 'certificate',
          entity_id: `${studentWithClass.id}_${selectedType}_${certLang}`,
          filename: filename,
          force_refresh: true
        })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.url) {
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = data.url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
        } else {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return;
        }
      }
      throw new Error('Server PDF generation returned non-OK response');
    } catch (serverErr) {
      console.warn('Server PDF generation failed, falling back to client-side:', serverErr);

      // 2. Client-side Fallback using html-to-image + jsPDF
      try {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        document.body.appendChild(container);

        const root = createRoot(container);
        
        await new Promise<void>((resolve) => {
          root.render(
            <CertificateTemplate 
              madrasah={madrasah} 
              student={studentWithClass} 
              type={selectedType}
              issueDate={formatIssueDate()}
              certLang={certLang}
            />
          );
          setTimeout(resolve, 800);
        });

        // Wait for all fonts to be ready before rendering canvas
        if ((document as any).fonts?.ready) {
          try {
            await (document as any).fonts.ready;
          } catch (e) {
            // ignore
          }
        }

        const dataUrl = await toPng(container.firstElementChild as HTMLElement, { 
          pixelRatio: 2, 
          width: 1122, 
          height: 793, 
          backgroundColor: '#ffffff' 
        });

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
        await saveJsPdf(pdf, filename);

        root.unmount();
        document.body.removeChild(container);
      } catch (clientErr) {
        console.error("Error generating Certificate PDF fallback:", clientErr);
        alert(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে' : 'Failed to generate PDF');
      }
    } finally {
      setDownloading(false);
    }
  };

  const activeStudent = getStudentWithClass();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <button onClick={onBack} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-[#1E3A8A]">
            {lang === 'bn' ? 'সার্টিফিকেট জেনারেটর' : 'Certificate Generator'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest gap-2 flex items-center">
             <FileText size={12} /> {lang === 'bn' ? 'সনদপত্র ও প্রশংসাপত্র' : 'Testimonials & Certificates'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Certificate Type */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
              {lang === 'bn' ? 'সার্টিফিকেটের ধরন' : 'Certificate Type'}
            </label>
            <div className="grid gap-3">
              {certificateTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl text-left transition-all border-2 ${selectedType === type.id ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white hover:border-amber-200'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedType === type.id ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                     <AwardIcon selected={selectedType === type.id} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${selectedType === type.id ? 'text-amber-900' : 'text-slate-700'}`}>
                      {lang === 'bn' ? type.labelBn : type.label}
                    </h3>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Language Selection */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
                {lang === 'bn' ? 'সার্টিফিকেটের ভাষা' : 'Certificate Language'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCertLang('bn')}
                  className={`py-3 rounded-2xl font-bold flex flex-col items-center justify-center transition-all border-2 ${certLang === 'bn' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-100 bg-white text-slate-500 hover:border-amber-200'}`}
                >
                  <span className="text-sm">বাংলা</span>
                </button>
                <button
                  onClick={() => setCertLang('en')}
                  className={`py-3 rounded-2xl font-bold flex flex-col items-center justify-center transition-all border-2 ${certLang === 'en' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-100 bg-white text-slate-500 hover:border-amber-200'}`}
                >
                  <span className="text-sm">English</span>
                </button>
              </div>
            </div>

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
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 appearance-none"
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 appearance-none"
                  >
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.roll ? `${s.roll} - ` : ''}{s.student_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl text-sm font-bold border border-amber-200">
                    {lang === 'bn' ? 'এই শ্রেণীতে কোন শিক্ষার্থী নেই' : 'No students in this class'}
                  </div>
                )}
              </div>
            )}

            {/* Issue Date */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
                {lang === 'bn' ? 'ইস্যুর তারিখ' : 'Issue Date'}
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            
            {/* Download Button */}
            <div className="pt-4">
              <button
                onClick={generatePDF}
                disabled={!selectedStudentId || downloading}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${!selectedStudentId || downloading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-xl shadow-amber-500/20 active:scale-95'}`}
              >
                {downloading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>{lang === 'bn' ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating PDF...'}</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>{lang === 'bn' ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Section */}
      {activeStudent && (
        <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200 flex flex-col items-center shadow-inner overflow-hidden">
           <div className="flex items-center gap-2 mb-6">
              <Eye className="text-slate-400" size={20} />
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                {lang === 'bn' ? 'সার্টিফিকেট প্রিভিউ' : 'Certificate Preview'}
              </h3>
           </div>
           
           <div 
             ref={previewContainerRef} 
             className="w-full flex justify-center bg-white shadow-xl border border-slate-200 rounded-xl overflow-hidden relative"
             style={{ height: 793 * previewScale }}
           >
              <div 
                className="absolute origin-top-left flex items-start justify-start"
                style={{ 
                  transform: `scale(${previewScale})`, 
                  width: 1122, 
                  height: 793,
                  left: '50%',
                  marginLeft: -(1122 * previewScale) / 2
                }}
              >
                 <CertificateTemplate 
                    madrasah={madrasah} 
                    student={activeStudent} 
                    type={selectedType}
                    issueDate={formatIssueDate()}
                    certLang={certLang}
                 />
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

const AwardIcon = ({ selected }: { selected: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={selected ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
)

export default Certificates;
