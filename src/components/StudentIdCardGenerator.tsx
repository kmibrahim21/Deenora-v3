import React, { useRef, useState } from "react";
import { Download, X, Printer, Settings2 } from "lucide-react";
import { Student, Institution, Language } from "types";
import QRCode from "react-qr-code";
import { jsPDF } from "jspdf";
import { toPng, toJpeg } from "html-to-image";
import { solaimanLipiBase64 } from "../utils/fonts";

interface StudentIdCardGeneratorProps {
  student: Student;
  madrasah: Institution | null;
  onClose: () => void;
  lang: Language;
  isBulk?: boolean;
  allStudents?: Student[];
}

const StudentIdCardGenerator: React.FC<StudentIdCardGeneratorProps> = ({
  student,
  madrasah,
  onClose,
  lang,
  isBulk,
  allStudents,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [themeColor, setThemeColor] = useState("#1E3A8A"); // Default Navy/Indigo Theme
  const [currentRenderStudent, setCurrentRenderStudent] =
    useState<Student>(student);
  const [bulkProgress, setBulkProgress] = useState(0);

  const isDark = madrasah?.theme === "dark";
  const isBangla = lang === "bn";

  const instName = madrasah?.name || "Institution Name";
  const instAddress = madrasah?.address || "Dhaka, Bangladesh";
  const nameLen = instName.length;
  const addressLen = instAddress.length;
  
  const nameSizeClass = nameLen > 65 ? "text-[11px] leading-snug" : nameLen > 45 ? "text-[12.5px] leading-snug" : nameLen > 30 ? "text-[14.5px] leading-snug" : nameLen > 20 ? "text-[16.5px] leading-snug" : "text-[18.5px] leading-snug";
  const addressSizeClass = addressLen > 60 ? "text-[6.5px] leading-snug" : addressLen > 40 ? "text-[7.5px] leading-snug" : "text-[8px] leading-snug";

  React.useEffect(() => {
    setCurrentRenderStudent(student);
  }, [student]);

  const generateSingleCardData = async () => {
    if (!cardRef.current || !backCardRef.current) return null;
    try {
      const options = {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
        fontEmbedCSS: `
          @font-face {
            font-family: 'SolaimanLipi';
            src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `,
        width: 280, // Explicitly set width to prevent right-side clipping
        height: 448, // Explicitly set height
        style: {
          margin: "0",
          transform: "scale(1)",
        },
      };
      const frontDataUrl = await Promise.race([
        toJpeg(cardRef.current, options),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);
      const backDataUrl = await Promise.race([
        toJpeg(backCardRef.current, options),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);
      return {
        front: frontDataUrl,
        back: backDataUrl,
      };
    } catch (e) {
      console.error("Error generating image", e);
      return null;
    }
  };

  const downloadPdfSingle = async () => {
    setIsGenerating(true);
    try {
      const pdf = new jsPDF("portrait", "mm", "a4");
      const cardWidth = 54;
      const cardHeight = 86;

      // Single Student Centered
      setCurrentRenderStudent(student);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const cardData = await generateSingleCardData();
      if (cardData) {
        const gapX = 10;
        const xMargin = (210 - (cardWidth * 2) - gapX) / 2;
        const yMargin = 30; // Nice top spacing for a single print
        pdf.addImage(cardData.front, "JPEG", xMargin, yMargin, cardWidth, cardHeight);
        pdf.addImage(cardData.back, "JPEG", xMargin + cardWidth + gapX, yMargin, cardWidth, cardHeight);
        pdf.save(`${(student?.student_name || "Student").replace(/\s+/g, "_")}_ID_Card_Single.pdf`);
      }
    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Failed to generate single PDF. Please try again.");
    } finally {
      setIsGenerating(false);
      setCurrentRenderStudent(student);
    }
  };

  const downloadPdfMultiple = async () => {
    setIsGenerating(true);
    try {
      // Use Portrait A4 to fit 3 columns and 3 rows of ONLY front or back parts. (9 students/page)
      const pdf = new jsPDF("portrait", "mm", "a4");
      const cardWidth = 54;
      const cardHeight = 86;
      const pageW = 210;
      const pageH = 297;
      
      const cols = 3;
      const rows = 3;
      const gapX = 8;
      const colGap = 0; // Not needed
      const marginX = (pageW - (cardWidth * cols) - (gapX * (cols - 1))) / 2; // Auto center horizontally
      const gapY = 8; 
      const marginY = (pageH - (cardHeight * rows) - (gapY * (rows - 1))) / 2; // Auto center vertically

      const studentsToRender = (allStudents && allStudents.length > 0) ? allStudents : [student];
      
      let currentIdxOnPage = 0;

      for (let i = 0; i < studentsToRender.length; i++) {
        setBulkProgress(Math.round((i / studentsToRender.length) * 100));
        setCurrentRenderStudent(studentsToRender[i]);
        await new Promise((resolve) => setTimeout(resolve, 300));

        const cardData = await generateSingleCardData();
        if (!cardData) continue;

        // Calculate Position
        const row = Math.floor(currentIdxOnPage / cols);
        const col = currentIdxOnPage % cols;

        const posX = marginX + (col * (cardWidth + gapX));
        const posY = marginY + (row * (cardHeight + gapY));

        const imageData = activeSide === 'front' ? cardData.front : cardData.back;

        pdf.addImage(imageData, "JPEG", posX, posY, cardWidth, cardHeight);

        currentIdxOnPage++;

        // If we filled 9 spots on the page (3x3) and there are more students left
        if (currentIdxOnPage === (cols * rows) && i < studentsToRender.length - 1) {
            pdf.addPage();
            currentIdxOnPage = 0;
        }
      }

      setBulkProgress(100);
      const sideText = activeSide === 'front' ? 'Fronts' : 'Backs';
      const filename = (allStudents && allStudents.length > 1) ? `${(allStudents[0]?.classes?.class_name || "Class").replace(/\s+/g, "_")}_Grid_${sideText}.pdf` : `${(student?.student_name || "Student").replace(/\s+/g, "_")}_A4_${sideText}.pdf`;
      pdf.save(filename);
      
    } catch (error) {
      console.error("Error generating PDF Grid", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
      setBulkProgress(0);
      setCurrentRenderStudent(student);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const colors = [
    "#1E3A8A",
    "#4F46E5",
    "#0F766E",
    "#10B981",
    "#E11D48",
    "#D97706",
    "#4338CA",
    "#0369A1",
  ];

  // PVC Card ratio approx 2.125 x 3.375 inches (portait) -> 54mm x 85.6mm (1:1.58 ratio)
  // Example dimensions: 250px x 395px

  const t = {
    title: isBangla ? "স্টুডেন্ট আইডি কার্ড" : "Student ID Card",
    id: isBangla ? "রেজিঃ নম্বর" : "Reg No",
    class: isBangla ? "শ্রেণী" : "Class",
    roll: isBangla ? "রোল" : "Roll",
    blood: isBangla ? "রক্তের গ্রুপ" : "Blood",
    dob: isBangla ? "জন্ম তারিখ" : "DOB",
    phone: isBangla ? "মোবাইল" : "Phone",
    father: isBangla ? "পিতা" : "Father",
    mother: isBangla ? "মাতা" : "Mother",
    address: isBangla ? "ঠিকানা" : "Address",
    section: isBangla ? "বিভাগ/শাখা" : "Section",
    validity: isBangla ? "মেয়াদ" : "Validity",
    principal: isBangla ? "প্রতিষ্ঠান প্রধান" : "Principal",
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
  };

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  return (
    <div className={`flex flex-col rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
      {/* Header Controls */}
      <div className={`p-3 sm:p-6 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-base sm:text-lg font-black font-solaiman ${isDark ? "text-white" : "text-[#1E3A8A]"}`}>
              {isBulk ? (isBangla ? 'সকল আইডি কার্ড' : 'All ID Cards') : t.title}
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
               <button
                onClick={handlePrint}
                className={`p-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all rounded-lg sm:rounded-xl ${isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-white text-slate-700 border hover:bg-slate-50"}`}
                title={isBangla ? "প্রিন্ট" : "Print"}
              >
                <Printer size={18} />
                <span className="hidden sm:inline ml-2">{isBangla ? "প্রিন্ট" : "Print"}</span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 p-1.5 sm:p-2 rounded-xl border border-slate-100 overflow-x-auto scrollbar-none">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setThemeColor(c)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-all shrink-0 ${themeColor === c ? "border-white ring-2 ring-blue-500 scale-110 shadow-sm" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>

            <div className="flex bg-slate-100 rounded-xl p-1 shadow-sm border border-slate-200">
              <button
                onClick={downloadPdfSingle}
                disabled={isGenerating || isBulk}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black bg-[#1E3A8A] text-white rounded-lg hover:bg-blue-800 transition-all shadow-sm disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isBangla ? "সিঙ্গেল" : "Single"}</span>
              </button>
              <button
                onClick={downloadPdfMultiple}
                disabled={isGenerating}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black text-slate-700 hover:bg-white rounded-lg transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#1E3A8A]/30 border-t-[#1E3A8A] rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <Download size={14} />
                )}
                <span>
                  {isGenerating && isBulk
                    ? `${bulkProgress}%`
                    : isBangla
                      ? "A4 গ্রিড"
                      : "A4 Grid"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className={`p-4 sm:p-8 flex flex-col items-center overflow-x-hidden ${isDark ? "bg-slate-950" : "bg-slate-50/50"}`}>
        
        {/* Toggle buttons for Front / Back Review */}
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 sm:mb-8 inline-flex">
          <button 
            onClick={() => setActiveSide('front')}
            className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeSide === 'front' ? 'bg-[#1E3A8A] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {isBangla ? 'সম্মুখ ভাগ' : 'Front Part'}
          </button>
          <button 
            onClick={() => setActiveSide('back')}
            className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeSide === 'back' ? 'bg-[#1E3A8A] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {isBangla ? 'পিছন ভাগ' : 'Back Part'}
          </button>
        </div>

        {/* Print Wrapper / Canvas Area */}
        <div className="print-area flex flex-col items-center justify-center w-full pb-8 scale-[0.85] sm:scale-100 origin-top">
          {/* FRONT SIDE */}
          <div
            className={`relative overflow-hidden bg-white shadow-[0_10px_40px_rgb(0,0,0,0.12)] rounded-xl border border-slate-200 transition-all shrink-0 flex-col ${activeSide === 'front' || isGenerating ? 'flex' : 'hidden'}`}
            style={{ 
              width: "280px", 
              height: "448px",
              WebkitTextSizeAdjust: "100%",
              textSizeAdjust: "100%"
            }}
            ref={cardRef}
          >
            {/* Top Modern Header Shape */}
             <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[155px]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 280 155"
                  preserveAspectRatio="none"
                  className="w-full h-full drop-shadow-md"
                >
                  <path d="M0,0 L280,0 L280,120 C180,160 100,80 0,140 Z" fill={themeColor}></path>
                  <path d="M0,0 L280,0 L280,110 C180,150 100,70 0,130 Z" fill="white" opacity="0.15"></path>
                  <path d="M0,0 L280,0 L280,100 C180,140 100,60 0,120 Z" fill="white" opacity="0.1"></path>
                  <path d="M0,140 C100,80 180,160 280,120 L280,124 C180,164 100,84 0,144 Z" fill="black" opacity="0.08"></path>
                </svg>
              </div>

              {/* Bottom Wave Vector */}
              <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[70px]">
                 <svg 
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 280 70" 
                  preserveAspectRatio="none" 
                  className="w-full h-full drop-shadow-[0_-2px_4px_rgba(0,0,0,0.1)]"
                 >
                     <path d="M0,70 L280,70 L280,40 C180,0 100,50 0,20 Z" fill={themeColor}></path>
                     <path d="M0,70 L280,70 L280,50 C180,10 100,60 0,30 Z" fill="white" opacity="0.15"></path>
                     <path d="M0,70 L280,70 L280,60 C180,20 100,70 0,40 Z" fill="white" opacity="0.10"></path>
                 </svg>
              </div>

              {/* Content Container */}
              <div className="relative z-10 flex flex-col h-full w-full">
                  {/* Header - Logo & Madrasah Info */}
                  <div className="flex items-center gap-2.5 pt-4 px-4">
                       <div className="w-[48px] h-[48px] bg-white rounded-full p-[2px] shadow-sm flex items-center justify-center shrink-0">
                          {madrasah?.logo_url ? (
                            <img src={madrasah.logo_url} alt="Logo" className="w-full h-full object-contain rounded-full" crossOrigin="anonymous" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full rounded-full flex items-center justify-center text-[18px] font-black" style={{ color: themeColor }}>
                              {instName.charAt(0) || "M"}
                            </div>
                          )}
                       </div>
                       <div className="flex-1 text-center flex flex-col justify-center min-w-0 px-0.5">
                           <h3 className={`font-bold text-white font-solaiman drop-shadow-sm w-full mx-auto text-center py-0.5 ${nameSizeClass}`}>
                            {instName}
                          </h3>
                          <p className={`text-white/95 font-medium mt-[1px] w-full mx-auto text-center py-0.5 ${addressSizeClass}`}>
                            {instAddress}
                          </p>
                       </div>
                  </div>

                  {/* Photo & Title Section */}
                  <div className="flex flex-col items-center mt-1 w-full relative z-10 px-5">
                      <div className="w-[75px] h-[85px] bg-white border-[2px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                         {currentRenderStudent.photo_url ? (
                             <img src={currentRenderStudent.photo_url} alt="Photo" className="w-full h-full object-cover" crossOrigin="anonymous"onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                         ) : (
                             <svg className="text-slate-200 w-[36px] h-[36px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                         )}
                      </div>

                      {/* Title: 'পরিচয় পত্র' or 'STUDENT ID CARD' */}
                      <div className="mt-1 px-3 py-0.5 rounded-full text-white text-[8.5px] font-bold shadow-sm tracking-wide border border-white/20 uppercase inline-block font-solaiman" style={{ backgroundColor: themeColor }}>
                        {t.idBadge}
                      </div>

                      {/* Name */}
                      <div className="mt-0.5 text-center px-2">
                         <h2 className="font-extrabold text-[16px] font-solaiman leading-snug py-0.5" style={{ color: themeColor }}>
                              {currentRenderStudent.student_name || 'Student Name'}
                          </h2>
                      </div>
                  </div>

                  {/* Data Fields */}
                  <div className="pl-10 pr-4 w-full flex flex-col gap-[1px] mt-0.5 z-10 relative">
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.class}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman">{currentRenderStudent.classes?.class_name || "-"}</span>
                       </div>
                       {currentRenderStudent.section && (
                         <div className="flex items-start">
                            <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.section}</span>
                            <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                            <span className="text-[11.5px] font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman">{currentRenderStudent.section}</span>
                         </div>
                       )}
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.id}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman tracking-wide">{currentRenderStudent.registration_number || currentRenderStudent.roll || '-'}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.dob}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman tracking-wide">{currentRenderStudent.date_of_birth ? new Date(currentRenderStudent.date_of_birth).toLocaleDateString('en-GB') : "-"}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.blood}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11.5px] font-black text-red-600 leading-snug py-0.5 font-solaiman">{currentRenderStudent.blood_group || "-"}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.father}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11px] font-extrabold text-slate-800 leading-snug py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] font-solaiman">{currentRenderStudent.guardian_name || "-"}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.mother}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11px] font-extrabold text-slate-800 leading-snug py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] font-solaiman">{currentRenderStudent.mother_name || "-"}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.phone}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[11px] font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman tracking-wide">{currentRenderStudent.guardian_phone || "-"}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[75px] font-solaiman shrink-0 py-0.5 leading-snug">{t.address}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug">:</span>
                          <span className="text-[10px] font-extrabold text-slate-800 leading-tight py-0.5 line-clamp-2 max-w-[155px] font-solaiman break-words">{currentRenderStudent.address || "-"}</span>
                       </div>
                  </div>

                  {/* Footer */}
                  <div className="w-full flex justify-end items-end mt-auto px-5 pb-2 relative z-10">
                     {/* Signature */}
                     <div className="flex items-end gap-2 text-center relative w-full h-[35px] max-w-[120px]">
                        <div className="flex flex-col items-center w-[70px] ml-auto">
                           <div className="flex items-end justify-center mb-[2px]" style={{ height: `${madrasah?.config_json?.signature_height ? madrasah.config_json.signature_height / 1.5 : 22}px` }}>
                           {madrasah?.config_json?.signature_url ? (
                              <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height ? madrasah.config_json.signature_height / 1.5 : 22}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                           ) : (
                              <img
                                 src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgNDAiPjxwYXRoIGQ9Ik0xMCAzMGM1LTUgMTAtMTAgMTEtMTVzLTIgMTAtNSAxNWMyLTUgNS0xMCAxMC0xNCA1LTMgOC01IDEwLTJzLTEgNS0zIDEwYzIgMCA0LTIgNi0zIDItejIgNCAwLTUgOC01IDQgMyAyIDEwLTMgMTRjLTIgMi01IDUtOCAxLTItMy0xLTYgMi04cyA1LTIgNyAwbDEgM2MyLTIgMy01IDUtNyAyLTIgNCAwIDUtMnMyIDEwLTMgMTQtMSA0IDMgNSA2IDVjLTItNSA1LTIgNyAwczIgNiAwIDEwIiBmaWxsPSJub25lIiBzdHJva2U9IiM0NzU1NjkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+"
                                 className="w-[38px] opacity-70 mix-blend-multiply"
                                 alt="Sig"
                              />
                           )}
                           </div>
                           <div className="w-full h-[1px] bg-white/50 mb-0.5" />
                           <p className="text-[7px] font-bold text-white font-solaiman uppercase tracking-wider shadow-sm leading-snug py-0.5">
                              {t.principal}
                           </p>
                        </div>
                     </div>
                  </div>
              </div>
          </div>

          {/* BACK SIDE */}
          <div
            className={`relative overflow-hidden bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl border border-slate-200 transition-all shrink-0 flex-col ${activeSide === 'back' || isGenerating ? 'flex' : 'hidden'} md:mx-0`}
            style={{ 
              width: "280px", 
              height: "448px",
              WebkitTextSizeAdjust: "100%",
              textSizeAdjust: "100%"
            }}
            ref={backCardRef}
          >
            {/* Background Watermark */}
            {madrasah?.logo_url && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none mix-blend-multiply z-0">
                <img
                  src={madrasah.logo_url}
                  alt="Logo Watermark"
                  className="w-[180px] h-[180px] object-contain grayscale"
                  crossOrigin="anonymous"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}

            {/* Back Header - Elegant Curve */}
            <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[80px]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 280 80"
                  preserveAspectRatio="none"
                  className="w-full h-full"
                >
                  <path d="M0,0 L280,0 L280,50 C180,80 100,20 0,70 Z" fill={themeColor} opacity={0.15}></path>
                  <path d="M0,0 L280,0 L280,40 C180,70 100,10 0,60 Z" fill={themeColor} opacity={0.10}></path>
                </svg>
            </div>

            {/* Back Header Content */}
            <div className="w-full pt-3 pb-0.5 px-3 text-center z-10 relative">
               <div className="flex items-center justify-center px-1">
                  <h3 className={`font-bold font-solaiman w-full leading-snug py-0.5 ${nameLen > 65 ? 'text-[10.5px]' : nameLen > 45 ? 'text-[12px]' : nameLen > 30 ? 'text-[14px]' : nameLen > 20 ? 'text-[15.5px]' : 'text-[17px]'}`} style={{ color: themeColor }}>
                    {madrasah?.name || instName}
                  </h3>
               </div>
               <div className="w-[80px] h-[1px] bg-slate-200 mx-auto mt-0.5 opacity-50" />
            </div>

            <div className="px-3.5 py-0.5 flex-1 flex flex-col z-10 relative">
              {/* Rules Section */}
              <div className="mb-0.5">
                <div
                  className="inline-block px-2.5 py-0.5 rounded-sm text-white text-[9px] font-bold font-solaiman mb-0.5 shadow-sm leading-snug"
                  style={{ backgroundColor: themeColor }}
                >
                  {t.instructions}
                </div>
                <ul className="text-[8.5px] text-slate-700 font-medium font-solaiman list-disc pl-3.5 space-y-0.5 pr-1">
                  {t.rules.map((rule, idx) => (
                    <li key={idx} className="leading-snug">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              {/* QR Code Segment - Enlarged */}
              <div className="my-1 flex flex-col items-center w-full">
                <div className="p-1.5 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-100 inline-block mb-1">
                  <QRCode
                    value={madrasah ? `Name: ${madrasah.name}\nAddress: ${madrasah.address || ''}\nMobile: ${madrasah.phone || ''}\nStudent: ${currentRenderStudent.student_name} (${currentRenderStudent.registration_number || currentRenderStudent.roll || ''})` : `ID:${currentRenderStudent.id}`}
                    size={60}
                  />
                </div>
                <p className="text-[8px] font-bold tracking-widest text-slate-500 font-solaiman">
                  {currentRenderStudent.registration_number ||
                    currentRenderStudent.roll ||
                    currentRenderStudent.id.substring(0, 8)}
                </p>
              </div>

              {/* Emergency Contact - Slightly raised with balanced margins */}
              <div className="mt-1.5 mb-2 w-full bg-slate-50 border border-slate-100/80 rounded-lg p-2 shadow-sm">
                <div
                  className="inline-block px-2 py-0.5 rounded text-white text-[8px] font-bold font-solaiman mb-1 leading-snug"
                  style={{ backgroundColor: themeColor }}
                >
                  {t.emergency}
                </div>
                <div className="flex flex-col gap-0.5 text-[8.5px] font-medium text-slate-700 font-solaiman">
                  <div className="flex items-center gap-1.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-2.5 h-2.5 text-emerald-600 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span className="font-bold tracking-wide">
                      {madrasah?.phone || "০১৭XX-XXXXXX"}
                    </span>
                  </div>
                  {madrasah?.email && (
                     <div className="flex items-center gap-1.5 overflow-hidden">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-2.5 h-2.5 text-emerald-600 shrink-0"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                           <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                        </svg>
                        <span 
                          className="font-bold tracking-tight whitespace-nowrap"
                          style={{
                            fontSize: `${(madrasah.email.length || 0) > 30 ? 6.5 : (madrasah.email.length || 0) > 24 ? 7 : (madrasah.email.length || 0) > 18 ? 7.5 : 8}px`,
                            lineHeight: '1.2'
                          }}
                        >
                          {madrasah.email}
                        </span>
                     </div>
                  )}
                  <div className="flex items-start gap-1.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-2.5 h-2.5 text-emerald-600 mt-[1px] shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span className="leading-tight flex-1 font-solaiman line-clamp-1 py-0.5 text-[8px]">
                      {madrasah?.address || "Institution Address Here"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 pt-1 border-t border-slate-200/70">
                    <span className="text-[7.5px] font-bold text-slate-500 font-solaiman uppercase tracking-wider leading-snug py-0.5">{t.issueDate}</span>
                    <span className="text-[7.5px] font-bold text-slate-800 font-solaiman leading-snug py-0.5">: {new Date().toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Curve Design */}
            <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[60px]">
               <svg 
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 280 60" 
                preserveAspectRatio="none" 
                className="w-full h-full"
               >
                   <path d="M0,60 L280,60 L280,30 C180,0 100,50 0,20 Z" fill={themeColor} opacity={0.12}></path>
                   <path d="M0,60 L280,60 L280,20 C180,-10 100,40 0,10 Z" fill={themeColor} opacity={0.08}></path>
               </svg>
            </div>

            {/* Bottom Motto Styled */}
            <div className="w-full pb-2 pt-0.5 text-center z-10 relative mt-auto px-4">
               <div className="px-3.5 py-0.5 rounded-lg inline-block mx-auto shadow-sm border border-white/50" style={{ backgroundColor: themeColor }}>
                  <p className="text-[8px] font-bold text-white font-solaiman tracking-wide uppercase leading-snug py-0.5">
                    {t.motto}
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for print mode */}
      <style>{`
        @media print {
            body * {
                visibility: hidden;
            }
            .print-area, .print-area * {
                visibility: visible;
            }
            .print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                display: flex;
                flex-direction: row !important;
                gap: 20px !important;
                align-items: flex-start;
                justify-content: flex-start;
            }
        }
      `}</style>
    </div>
  );
};

export default StudentIdCardGenerator;
