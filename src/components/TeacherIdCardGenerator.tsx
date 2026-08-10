import React, { useRef, useState } from "react";
import { Download, X, Printer, Settings2 } from "lucide-react";
import { Teacher, Institution, Language } from "types";
import QRCode from "react-qr-code";
import { jsPDF } from "jspdf";
import { toPng, toJpeg } from "html-to-image";
import { solaimanLipiBase64 } from "../utils/fonts";

interface TeacherIdCardGeneratorProps {
  teacher: Teacher;
  madrasah: Institution | null;
  onClose: () => void;
  lang: Language;
  isBulk?: boolean;
  allTeachers?: Teacher[];
}

const TeacherIdCardGenerator: React.FC<TeacherIdCardGeneratorProps> = ({
  teacher,
  madrasah,
  onClose,
  lang,
  isBulk,
  allTeachers,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [themeColor, setThemeColor] = useState("#0F766E"); // Default Teal Theme for Teachers
  const [currentRenderTeacher, setCurrentRenderTeacher] =
    useState<Teacher>(teacher);
  const [bulkProgress, setBulkProgress] = useState(0);

  const isDark = madrasah?.theme === "dark";
  const isBangla = lang === "bn";

  const instName = madrasah?.name || "Institution Name";
  const instAddress = madrasah?.address || "Dhaka, Bangladesh";
  const nameLen = instName.length;
  const addressLen = instAddress.length;
  
  const nameSizeClass = nameLen > 45 ? "text-[11px] leading-normal" : nameLen > 30 ? "text-[13px] leading-normal" : "text-[15px] leading-normal";
  const addressSizeClass = addressLen > 65 ? "text-[7.5px] leading-normal" : addressLen > 40 ? "text-[8px] leading-normal" : "text-[8.5px] leading-normal";

  React.useEffect(() => {
    setCurrentRenderTeacher(teacher);
  }, [teacher]);

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
        width: 280, 
        height: 448, 
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

      setCurrentRenderTeacher(teacher);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const cardData = await generateSingleCardData();
      if (cardData) {
        const gapX = 10;
        const xMargin = (210 - (cardWidth * 2) - gapX) / 2;
        const yMargin = 30; 
        pdf.addImage(cardData.front, "JPEG", xMargin, yMargin, cardWidth, cardHeight);
        pdf.addImage(cardData.back, "JPEG", xMargin + cardWidth + gapX, yMargin, cardWidth, cardHeight);
        pdf.save(`${(teacher?.name || "Teacher").replace(/\s+/g, "_")}_ID_Card_Single.pdf`);
      }
    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Failed to generate single PDF. Please try again.");
    } finally {
      setIsGenerating(false);
      setCurrentRenderTeacher(teacher);
    }
  };

  const downloadPdfMultiple = async () => {
    setIsGenerating(true);
    try {
      const pdf = new jsPDF("portrait", "mm", "a4");
      const cardWidth = 54;
      const cardHeight = 86;
      const pageW = 210;
      const pageH = 297;
      
      const cols = 3;
      const rows = 3;
      const gapX = 8;
      const marginX = (pageW - (cardWidth * cols) - (gapX * (cols - 1))) / 2; 
      const gapY = 8; 
      const marginY = (pageH - (cardHeight * rows) - (gapY * (rows - 1))) / 2; 

      const teachersToRender = (allTeachers && allTeachers.length > 0) ? allTeachers : [teacher];
      
      let currentIdxOnPage = 0;

      for (let i = 0; i < teachersToRender.length; i++) {
        setBulkProgress(Math.round((i / teachersToRender.length) * 100));
        setCurrentRenderTeacher(teachersToRender[i]);
        await new Promise((resolve) => setTimeout(resolve, 300));

        const cardData = await generateSingleCardData();
        if (!cardData) continue;

        const row = Math.floor(currentIdxOnPage / cols);
        const col = currentIdxOnPage % cols;

        const posX = marginX + (col * (cardWidth + gapX));
        const posY = marginY + (row * (cardHeight + gapY));

        const imageData = activeSide === 'front' ? cardData.front : cardData.back;

        pdf.addImage(imageData, "JPEG", posX, posY, cardWidth, cardHeight);

        currentIdxOnPage++;

        if (currentIdxOnPage === (cols * rows) && i < teachersToRender.length - 1) {
            pdf.addPage();
            currentIdxOnPage = 0;
        }
      }

      setBulkProgress(100);
      const sideText = activeSide === 'front' ? 'Fronts' : 'Backs';
      const filename = (allTeachers && allTeachers.length > 1) ? `Teachers_Grid_${sideText}.pdf` : `${(teacher?.name || "Teacher").replace(/\s+/g, "_")}_A4_${sideText}.pdf`;
      pdf.save(filename);
      
    } catch (error) {
      console.error("Error generating PDF Grid", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
      setBulkProgress(0);
      setCurrentRenderTeacher(teacher);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const colors = [
    "#0F766E",
    "#1E3A8A",
    "#4F46E5",
    "#10B981",
    "#E11D48",
    "#D97706",
    "#4338CA",
    "#0369A1",
  ];

  const t = {
    title: isBangla ? "শিক্ষক আইডি কার্ড" : "Teacher ID Card",
    id: isBangla ? "আইডি নম্বর" : "ID No",
    designation: isBangla ? "পদবী" : "Designation",
    blood: isBangla ? "রক্তের গ্রুপ" : "Blood",
    phone: isBangla ? "মোবাইল" : "Phone",
    address: isBangla ? "ঠিকানা" : "Address",
    joinDate: isBangla ? "যোগদানের তারিখ" : "Join Date",
    principal: isBangla ? "অধ্যক্ষ" : "Principal",
    instructions: isBangla ? "নিয়মাবলি" : "Instructions",
    rules: isBangla
      ? [
          "এই কার্ডটি শুধু উক্ত শিক্ষকের জন্য প্রযোজ্য।",
          "কার্ডটি সর্বদা সাথে রাখতে হবে এবং প্রয়োজনে কর্তৃপক্ষকে প্রদর্শন করতে হবে।",
          "কার্ডটি অন্যকে ব্যবহার করতে দেয়া যাবে না।",
          "কার্ডটি হারিয়ে গেলে বা নষ্ট হলে সংশ্লিষ্ট কর্তৃপক্ষকে জানাতে হবে।",
          "কার্ডটি বিদ্যালয় কর্তৃপক্ষের সম্পত্তি, প্রয়োজনে ফেরত দিতে হবে।",
        ]
      : [
          "This card is strictly valid for the designated teacher.",
          "Must be carried at all times and shown upon request.",
          "This card is strictly non-transferable.",
          "If lost or damaged, notify the school authority immediately.",
          "This card remains the property of the institution.",
        ],
    emergency: isBangla ? "জরুরি যোগাযোগ" : "Emergency Contact",
    issueDate: isBangla ? "ইস্যু তারিখ" : "Issue Date",
    motto: isBangla ? "শিক্ষাই আলো, শিক্ষাই শক্তি" : "Education is Light",
    idBadge: isBangla ? "পরিচয় পত্র" : "TEACHER ID CARD",
  };

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  return (
    <div className={`flex flex-col rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
      <div className={`p-3 sm:p-6 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-base sm:text-lg font-black font-solaiman ${isDark ? "text-white" : "text-[#1E3A8A]"}`}>
              {isBulk ? (isBangla ? 'সকল আইডি কার্ড' : 'All ID Cards') : t.title}
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
               <button
                onClick={handlePrint}
                className={`p-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all rounded-lg sm:rounded-xl ${isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-white text-slate-700 border hover:bg-slate-100"}`}
                title={isBangla ? "প্রিন্ট" : "Print"}
              >
                <Printer size={18} />
                <span className="hidden sm:inline ml-2">{isBangla ? "প্রিন্ট" : "Print"}</span>
              </button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 sm:p-2 rounded-xl border border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none">
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

            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700">
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all disabled:opacity-50"
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

      <div className={`p-4 sm:p-8 flex flex-col items-center overflow-x-hidden ${isDark ? "bg-slate-950" : "bg-slate-50/50"}`}>
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

        <div className="print-area flex flex-col items-center justify-center w-full pb-8 scale-[0.85] sm:scale-100 origin-top">
          <div
            className={`relative overflow-hidden bg-white shadow-[0_10px_40px_rgb(0,0,0,0.12)] rounded-xl border border-slate-200 transition-all shrink-0 flex-col ${activeSide === 'front' || isGenerating ? 'flex' : 'hidden'}`}
            style={{ width: "280px", height: "448px" }}
            ref={cardRef}
          >
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

              <div className="relative z-10 flex flex-col h-full w-full">
                  <div className="flex items-center gap-3 pt-5 px-5">
                       <div className="w-[50px] h-[50px] bg-white rounded-full p-[2px] shadow-sm flex items-center justify-center shrink-0">
                          {madrasah?.logo_url ? (
                            <img src={madrasah.logo_url} alt="Logo" className="w-full h-full object-contain rounded-full" crossOrigin="anonymous" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full rounded-full flex items-center justify-center text-[20px] font-black" style={{ color: themeColor }}>
                              {instName.charAt(0) || "M"}
                            </div>
                          )}
                       </div>
                       <div className="flex-1 text-center">
                           <h3 className={`font-bold text-white font-solaiman tracking-wide drop-shadow-md line-clamp-2 max-w-[200px] mx-auto text-center ${nameSizeClass}`}>
                            {instName}
                          </h3>
                          <p className={`text-white/95 font-medium tracking-wide mt-[2px] line-clamp-2 max-w-[200px] mx-auto text-center ${addressSizeClass}`}>
                            {instAddress}
                          </p>
                       </div>
                  </div>

                  <div className="flex flex-col items-center mt-2 w-full relative z-10 px-5">
                      <div className="w-[75px] h-[85px] bg-white border-[2.5px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                         {currentRenderTeacher.photo_url ? (
                             <img src={currentRenderTeacher.photo_url} alt="Photo" className="w-full h-full object-cover" crossOrigin="anonymous"onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                         ) : (
                             <svg className="text-slate-200 w-[36px] h-[36px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                         )}
                      </div>

                      <div className="mt-1 px-3 py-0.5 rounded-full text-white text-[8.5px] font-bold shadow-sm tracking-widest border border-white/20 uppercase inline-block" style={{ backgroundColor: themeColor }}>
                        {t.idBadge}
                      </div>

                      <div className="mt-1 text-center px-2">
                         <h2 className="font-extrabold text-[17px] font-solaiman leading-snug tracking-tight pt-0.5" style={{ color: themeColor }}>
                              {currentRenderTeacher.name || 'Teacher Name'}
                          </h2>
                      </div>
                  </div>

                  <div className="pl-10 pr-4 w-full flex flex-col gap-[1.5px] mt-0.5 z-10 relative">
                       <div className="flex items-center">
                          <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-solaiman">{t.designation}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-normal font-solaiman">{currentRenderTeacher.designation || (isBangla ? 'শিক্ষক' : 'Teacher')}</span>
                       </div>
                       <div className="flex items-center">
                          <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-solaiman">{t.phone}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-normal font-solaiman tracking-wide">{currentRenderTeacher.phone || "-"}</span>
                       </div>
                       <div className="flex items-center">
                          <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-solaiman">{t.joinDate}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-normal font-solaiman tracking-wide">{currentRenderTeacher.join_date ? new Date(currentRenderTeacher.join_date).toLocaleDateString('en-GB') : "-"}</span>
                       </div>
                       <div className="flex items-start">
                          <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-solaiman shrink-0 mt-[1px]">{t.address}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2 shrink-0 mt-[1px]">:</span>
                          <span className="text-[11px] font-extrabold text-slate-800 leading-normal line-clamp-3 max-w-[155px] font-solaiman">{currentRenderTeacher.address || "-"}</span>
                       </div>
                       <div className="flex items-center">
                          <span className="text-[10px] font-semibold text-slate-600 w-[65px] font-solaiman">{t.issueDate}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mr-2">:</span>
                          <span className="text-[11.5px] font-extrabold text-slate-800 leading-normal font-solaiman tracking-wide">{new Date().toLocaleDateString('en-GB')}</span>
                       </div>
                  </div>

                  <div className="w-full flex justify-end items-end mt-auto px-5 pb-2 relative z-10">
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
                           <p className="text-[6.5px] font-bold text-white font-solaiman uppercase tracking-wider shadow-sm">
                               {t.principal}
                           </p>
                        </div>
                     </div>
                  </div>
              </div>
          </div>

          <div
            className={`relative overflow-hidden bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl border border-slate-200 transition-all shrink-0 flex-col ${activeSide === 'back' || isGenerating ? 'flex' : 'hidden'} md:mx-0`}
            style={{ width: "280px", height: "448px" }}
            ref={backCardRef}
          >
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

            <div className="w-full pt-5 pb-1 px-4 text-center z-10 relative">
               <div className="flex items-center justify-center gap-2">
                  {madrasah?.logo_url && (
                    <img
                      src={madrasah.logo_url}
                      className="w-[24px] h-[24px] object-contain rounded-full"
                      alt="logo"
                      crossOrigin="anonymous"
                     onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <h3 className="font-bold text-[13px] leading-normal font-solaiman" style={{ color: themeColor }}>
                    {madrasah?.name}
                  </h3>
               </div>
               <div className="w-[100px] h-[1px] bg-slate-200 mx-auto mt-2 opacity-50" />
            </div>

            <div className="px-4 py-1.5 flex-1 flex flex-col z-10 relative">
              <div className="mb-2">
                <div
                  className="inline-block px-3 py-0.5 rounded-sm text-white text-[9.5px] font-bold font-solaiman mb-1.5 shadow-sm"
                  style={{ backgroundColor: themeColor }}
                >
                  {t.instructions}
                </div>
                <ul className="text-[9px] text-slate-700 font-medium font-solaiman list-disc pl-4 space-y-1 pr-1">
                  {t.rules.map((rule, idx) => (
                    <li key={idx} className="leading-normal">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="my-auto py-1 flex flex-col items-center w-full">
                <div className="p-1 px-1.5 bg-white rounded-lg shadow-sm border border-slate-100 inline-block mb-1">
                  <QRCode
                    value={madrasah ? `Name: ${madrasah.name}\nTeacher: ${currentRenderTeacher.name}\nDesignation: ${currentRenderTeacher.designation || 'Teacher'}\nPhone: ${currentRenderTeacher.phone || ''}` : `ID:${currentRenderTeacher.id}`}
                    size={60}
                  />
                </div>
              </div>

              <div className="mt-1 w-full bg-slate-50 border border-slate-100/60 rounded-xl p-2">
                <div
                  className="inline-block px-2 py-0.5 rounded text-white text-[8px] font-bold font-solaiman mb-1"
                  style={{ backgroundColor: themeColor }}
                >
                  {t.emergency}
                </div>
                <div className="flex flex-col gap-1 text-[9px] font-medium text-slate-700 font-solaiman">
                  <div className="flex items-center gap-1.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-2.5 h-2.5 text-emerald-600"
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
                     <div className="flex items-center gap-1.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-2.5 h-2.5 text-emerald-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                           <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                        </svg>
                        <span className="font-bold tracking-wide break-all">
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
                    <span className="leading-snug flex-1 font-solaiman">
                      {madrasah?.address || "Institution Address Here"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[80px]">
               <svg 
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 280 80" 
                preserveAspectRatio="none" 
                className="w-full h-full"
               >
                   <path d="M0,80 L280,80 L280,50 C180,10 100,70 0,30 Z" fill={themeColor} opacity={0.12}></path>
                   <path d="M0,80 L280,80 L280,40 C180,0 100,60 0,20 Z" fill={themeColor} opacity={0.08}></path>
               </svg>
            </div>

            <div className="w-full pb-3.5 pt-1 text-center z-10 relative mt-auto px-5">
               <div className="px-4 py-1 rounded-lg inline-block mx-auto shadow-sm border border-white/50" style={{ backgroundColor: themeColor }}>
                  <p className="text-[8.5px] font-bold text-white font-solaiman tracking-[0.2em] uppercase">
                    {t.motto}
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>

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

export default TeacherIdCardGenerator;
