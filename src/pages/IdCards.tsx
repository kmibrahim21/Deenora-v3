import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, FileText, Download, ShieldCheck, Loader2, Eye, Layout } from 'lucide-react';
import { Institution, Profile, Class, Student, Language } from '../types';
import { supabase } from '../supabase';
import { t } from '../translations';
import { sortMadrasahClasses } from './Classes';
import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { IdCardFront } from '../components/id/IdCardFront';
import { IdCardBack } from '../components/id/IdCardBack';

interface IdCardsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  profile: Profile | null;
}

const colors = [
  "#1E3A8A", "#4F46E5", "#0F766E", "#10B981", "#E11D48", "#D97706", "#4338CA", "#0369A1",
];

const IdCards: React.FC<IdCardsProps> = ({ lang, madrasah, onBack, profile }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassMap, setSelectedClassMap] = useState<Record<string, string>>({});
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const [themeColor, setThemeColor] = useState("#1E3A8A");
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const isDark = madrasah?.theme === "dark";
  const isBangla = lang === "bn";

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
    let timeoutId: number;
    const updateScale = (forceWidth?: number) => {
      if (previewContainerRef.current) {
        const parentWidth = forceWidth || previewContainerRef.current.parentElement?.clientWidth || window.innerWidth;
        const availableWidth = parentWidth - 48; // padding
        const scale = Math.min(1.2, availableWidth / 280);
        setPreviewScale(prev => Math.abs(prev - scale) > 0.005 ? scale : prev);
      }
    };
    
    updateScale();
    
    const handleResize = () => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => updateScale(), 100);
    };
    window.addEventListener('resize', handleResize);
    
    let observer: ResizeObserver;
    if (previewContainerRef.current) {
      observer = new ResizeObserver((entries) => {
         clearTimeout(timeoutId);
         const width = entries[0]?.contentRect.width;
         timeoutId = window.setTimeout(() => updateScale(width), 100);
      });
      observer.observe(previewContainerRef.current.parentElement!);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    }
  }, [selectedStudentId, students]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', madrasah.id);

      if (error) throw error;
      const sorted = sortMadrasahClasses(data || []);
      setClasses(sorted);
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

  const getCardTranslations = () => ({
    title: isBangla ? "স্টুডেন্ট আইডি কার্ড" : "Student ID Card",
    id: isBangla ? "আইডি নং" : "ID No",
    class: isBangla ? "শ্রেণী" : "Class",
    roll: isBangla ? "রোল" : "Roll",
    blood: isBangla ? "রক্তের গ্রুপ" : "Blood",
    dob: isBangla ? "জন্ম তারিখ" : "DOB",
    phone: isBangla ? "মোবাইল" : "Phone",
    father: isBangla ? "পিতা" : "Father",
    mother: isBangla ? "মাতা" : "Mother",
    address: isBangla ? "ঠিকানা" : "Address",
    validity: isBangla ? "মেয়াদ" : "Validity",
    principal: isBangla ? "অধ্যক্ষ" : "Principal",
    instructions: isBangla ? "নিয়মাবলি" : "Instructions",
    rules: isBangla
      ? [
          "এই কার্ডটি শুধু উক্ত শিক্ষার্থীর জন্য প্রযোজ্য।",
          "কার্ডটি সর্বদা সাথে রাখতে হবে এবং প্রয়োজনে কর্তৃপক্ষকে প্রদর্শন করতে হবে।",
          "কার্ডটি অন্যকে ব্যবহার করতে দেয়া যাবে না।",
          "কার্ডটি হারিয়ে গেলে বা নষ্ট হলে সংশ্লিষ্ট কর্তৃপক্ষকে জানাতে হবে।",
          "কার্ডটি বিদ্যালয় কর্তৃপক্ষের সম্পত্তি, প্রয়োজনে ফেরত দিতে হবে।",
        ]
      : [
          "This card is strictly valid for the designated student.",
          "Must be carried at all times and shown upon request.",
          "This card is strictly non-transferable.",
          "If lost or damaged, notify the school authority immediately.",
          "This card remains the property of the institution.",
        ],
    emergency: isBangla ? "জরুরি যোগাযোগ" : "Emergency Contact",
    issueDate: isBangla ? "ইস্যু তারিখ" : "Issue Date",
    motto: isBangla ? "শিক্ষাই আলো, শিক্ষাই শক্তি" : "Education is Light",
    idBadge: isBangla ? "পরিচয় পত্র" : "STUDENT ID CARD",
  });

  const generateSinglePdf = async () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student || !madrasah) return;
    
    setIsGenerating(true);
    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const trans = getCardTranslations();
      const pdf = new jsPDF("portrait", "mm", "a4");
      
      // Render Front
      const frontRoot = createRoot(container);
      frontRoot.render(<IdCardFront student={student} madrasah={madrasah} themeColor={themeColor} t={trans} />);
      await new Promise(r => setTimeout(r, 600));
      const frontData = await toPng(container.firstElementChild as HTMLElement, { pixelRatio: 3 });
      
      // Render Back
      frontRoot.render(<IdCardBack student={student} madrasah={madrasah} themeColor={themeColor} t={trans} />);
      await new Promise(r => setTimeout(r, 600));
      const backData = await toPng(container.firstElementChild as HTMLElement, { pixelRatio: 3 });

      const cardW = 54;
      const cardH = 85.6;
      const marginX = (210 - cardW * 2 - 10) / 2;
      const marginY = 40;

      pdf.addImage(frontData, 'PNG', marginX, marginY, cardW, cardH);
      pdf.addImage(backData, 'PNG', marginX + cardW + 10, marginY, cardW, cardH);
      
      pdf.save(`${student.student_name}_ID_Card.pdf`);
      
      frontRoot.unmount();
      document.body.removeChild(container);
    } catch (error) {
      console.error("PDF Error", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBulkPdf = async () => {
    if (!madrasah || students.length === 0) return;
    setIsGenerating(true);
    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const trans = getCardTranslations();
      const pdf = new jsPDF("portrait", "mm", "a4");
      
      const root = createRoot(container);
      
      const cardW = 54;
      const cardH = 85.6;
      const marginX = 15;
      const marginY = 15;
      const gapX = 10;
      const gapY = 10;
      
      let col = 0;
      let row = 0;
      
      // We will print Fronts first, then Backs on next page?
      // Or Front next to Back?
      // User said "multiple per A4 paper". Let's put Front and Back next to each other.
      // 3 pairs per column (6 total columns)? No.
      // Column width: (54*2)+10 = 118mm. 210 - 118 = 92mm margin.
      // Let's fit 2 units per row? 118 * 2 = 236. Too wide (210 max).
      // So 1 unit (Front+Back) per row.
      // Let's print all Fronts on one page, and all Backs on another page?
      // No, let's put 3 students per page, each with Front and Back.
      // Or 5-6 students Front side on page 1, then Back side on page 2. This is better for double-sided printing.
      // Standard layout: 3x3 = 9 cards per page.
      
      const cardsPerPage = 9;
      const cols = 3;
      const rows = 3;
      
      // Step 1: Fronts
      for(let i=0; i<students.length; i++) {
        const pageIdx = Math.floor(i / cardsPerPage);
        const cardInPageIdx = i % cardsPerPage;
        const currentCol = cardInPageIdx % cols;
        const currentRow = Math.floor(cardInPageIdx / cols);
        
        if (i > 0 && cardInPageIdx === 0) pdf.addPage();
        
        root.render(<IdCardFront student={students[i]} madrasah={madrasah} themeColor={themeColor} t={trans} />);
        await new Promise(r => setTimeout(r, 400));
        const data = await toPng(container.firstElementChild as HTMLElement, { pixelRatio: 2 });
        
        const x = marginX + (currentCol * (cardW + gapX));
        const y = marginY + (currentRow * (cardH + gapY));
        pdf.addImage(data, 'PNG', x, y, cardW, cardH);
      }
      
      // Step 2: Backs (Matching alignment for printing)
      pdf.addPage();
      for(let i=0; i<students.length; i++) {
        const pageIdx = Math.floor(i / cardsPerPage);
        const cardInPageIdx = i % cardsPerPage;
        const currentCol = cardInPageIdx % cols;
        const currentRow = Math.floor(cardInPageIdx / cols);
        
        // Reverse column for back side if printing double sided? 
        // Actually, just keep it simple.
        if (i > 0 && cardInPageIdx === 0) pdf.addPage();
        
        root.render(<IdCardBack student={students[i]} madrasah={madrasah} themeColor={themeColor} t={trans} />);
        await new Promise(r => setTimeout(r, 400));
        const data = await toPng(container.firstElementChild as HTMLElement, { pixelRatio: 2 });
        
        const x = marginX + (currentCol * (cardW + gapX));
        const y = marginY + (currentRow * (cardH + gapY));
        pdf.addImage(data, 'PNG', x, y, cardW, cardH);
      }

      pdf.save(`Bulk_ID_Cards_${selectedClassMap[selectedClassId] || 'Class'}.pdf`);
      
      root.unmount();
      document.body.removeChild(container);
    } catch (error) {
      console.error("Bulk PDF Error", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const activeStudent = students.find(s => s.id === selectedStudentId);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm h-fit space-y-6">
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
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
                  >
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

            {/* Color Selection - Mobile & Desktop */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
                {lang === 'bn' ? 'থিম কালার নির্বাচন করুন' : 'Select Theme Color'}
              </label>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setThemeColor(c)}
                    className={`w-10 h-10 rounded-xl border-2 transition-all ${themeColor === c ? "border-white ring-4 ring-teal-500 scale-110" : "border-transparent opacity-80 hover:opacity-100"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            
            {/* Download Options */}
            {selectedClassId && (
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={generateSinglePdf}
                  disabled={!selectedStudentId || isGenerating}
                  className={`py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${!selectedStudentId || isGenerating ? 'bg-slate-100 text-slate-400' : 'bg-white border-2 border-teal-500 text-teal-600 hover:bg-teal-50'}`}
                >
                  <Download size={18} />
                  <span>{lang === 'bn' ? 'সিঙ্গেল ডাউনলোড' : 'Single Download'}</span>
                </button>
                <button
                  onClick={generateBulkPdf}
                  disabled={students.length === 0 || isGenerating}
                  className={`py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${students.length === 0 || isGenerating ? 'bg-slate-100 text-slate-400' : 'bg-teal-500 text-white hover:bg-teal-600 shadow-lg shadow-teal-500/20'}`}
                >
                  <Layout size={18} />
                  <span>{lang === 'bn' ? 'বাল্ক ডাউনলোড' : 'Bulk Download'}</span>
                </button>
              </div>
            )}
            
            {isGenerating && (
               <div className="flex items-center gap-2 text-teal-600 font-bold text-sm justify-center animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{lang === 'bn' ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating PDF...'}</span>
               </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 flex flex-col items-center min-h-[500px] overflow-hidden">
           <div className="flex flex-col sm:flex-row items-center justify-between w-full mb-6 gap-4">
              <div className="flex items-center gap-2">
                 <Eye className="text-slate-400" size={20} />
                 <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                   {lang === 'bn' ? 'প্রিভিউ' : 'Preview'}
                 </h3>
              </div>
              
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                 <button 
                  onClick={() => setViewMode('front')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'front' ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                 >
                   {lang === 'bn' ? 'সামনের পার্ট' : 'Front Part'}
                 </button>
                 <button 
                  onClick={() => setViewMode('back')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'back' ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                 >
                   {lang === 'bn' ? 'পিছনের পার্ট' : 'Back Part'}
                 </button>
              </div>
           </div>
           
           {activeStudent ? (
             <div 
               ref={previewContainerRef} 
               className="w-full flex justify-center overflow-hidden relative"
               style={{ height: 448 * previewScale }}
             >
                <div 
                  className="absolute origin-top-left"
                  style={{ 
                    transform: `scale(${previewScale})`, 
                    width: 280, 
                    height: 448,
                    left: '50%',
                    marginLeft: -(280 * previewScale) / 2
                  }}
                >
                   {viewMode === 'front' ? (
                     <IdCardFront 
                       student={activeStudent} 
                       madrasah={madrasah} 
                       themeColor={themeColor} 
                       t={getCardTranslations()} 
                     />
                   ) : (
                     <IdCardBack 
                       student={activeStudent} 
                       madrasah={madrasah} 
                       themeColor={themeColor} 
                       t={getCardTranslations()} 
                     />
                   )}
                </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
                <FileText size={64} strokeWidth={1} />
                <p className="font-bold text-sm tracking-widest uppercase">
                  {lang === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student to Preview'}
                </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default IdCards;
