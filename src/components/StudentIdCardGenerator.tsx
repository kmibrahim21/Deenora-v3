import React, { useRef, useState, useEffect } from "react";
import { Download, X, Printer, Settings2, Sliders, Palette, Check, RotateCcw, FileText, Layers, Sparkles } from "lucide-react";
import { Student, Institution, Language } from "types";
import QRCode from "react-qr-code";
import { jsPDF } from "jspdf";
import { toJpeg, toPng } from "html-to-image";
import JSZip from "jszip";
import { solaimanLipiBase64 } from "../utils/fonts";
import { IdCardDesignSettings, DEFAULT_ID_CARD_DESIGN } from "../types/idCardDesign";
import IdCardDesignModal from "./idcard/IdCardDesignModal";
import { supabase } from "../supabase";
import { elementToEps, elementToPureSvgXml, downloadCardEpsZip } from "../utils/epsExport";

interface StudentIdCardGeneratorProps {
  student: Student;
  madrasah: Institution | null;
  onClose: () => void;
  lang: Language;
  isBulk?: boolean;
  allStudents?: Student[];
  designSettings?: IdCardDesignSettings;
  onUpdateDesign?: (newSettings: IdCardDesignSettings) => void;
}

const StudentIdCardGenerator: React.FC<StudentIdCardGeneratorProps> = ({
  student,
  madrasah,
  onClose,
  lang,
  isBulk,
  allStudents,
  designSettings: externalDesignSettings,
  onUpdateDesign: externalOnUpdateDesign,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRenderStudent, setCurrentRenderStudent] = useState<Student>(student);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  // Initialize design settings from external prop, local cache or database
  const [internalDesignSettings, setInternalDesignSettings] = useState<IdCardDesignSettings>(() => {
    if (externalDesignSettings) return externalDesignSettings;
    const cloudDesign = (madrasah?.config_json as any)?.id_card_design;
    const cached = localStorage.getItem('deenora_idcard_design_settings');
    let merged = { ...DEFAULT_ID_CARD_DESIGN };
    if (cloudDesign) {
      merged = { ...merged, ...cloudDesign };
    } else if (cached) {
      try {
        merged = { ...merged, ...JSON.parse(cached) };
      } catch (e) {}
    }
    return merged;
  });

  const designSettings = externalDesignSettings || internalDesignSettings;

  useEffect(() => {
    if (externalDesignSettings) {
      setInternalDesignSettings(externalDesignSettings);
    }
  }, [externalDesignSettings]);

  const themeColor = designSettings.themeColor || "#1E3A8A";
  const isDark = madrasah?.theme === "dark";
  const isBangla = lang === "bn";

  const isPhotoModuleEnabled = madrasah?.config_json?.modules?.student_photo === true;
  const instName = madrasah?.name || "Institution Name";
  const instAddress = madrasah?.address || "Dhaka, Bangladesh";

  useEffect(() => {
    setCurrentRenderStudent(student);
  }, [student]);

  const handleSaveToCloud = async (newSettings: IdCardDesignSettings) => {
    if (!madrasah) return;
    setIsSavingCloud(true);
    try {
      const existingConfig = (typeof madrasah.config_json === 'string' ? JSON.parse(madrasah.config_json) : madrasah.config_json) || {};
      const updatedConfig = {
        ...existingConfig,
        id_card_design: newSettings
      };
      await supabase.from('institutions').update({ config_json: updatedConfig }).eq('id', madrasah.id);
      localStorage.setItem('deenora_idcard_design_settings', JSON.stringify(newSettings));
      if (externalOnUpdateDesign) {
        externalOnUpdateDesign(newSettings);
      } else {
        setInternalDesignSettings(newSettings);
      }
    } catch (e) {
      console.error('Failed to save id card design:', e);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleUpdateDesign = (newSettings: IdCardDesignSettings) => {
    if (externalOnUpdateDesign) {
      externalOnUpdateDesign(newSettings);
    } else {
      setInternalDesignSettings(newSettings);
    }
    localStorage.setItem('deenora_idcard_design_settings', JSON.stringify(newSettings));
  };

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
    const safeName = (student?.student_name || "Student").replace(/\s+/g, "_");
    const filename = `${safeName}_ID_Card_Single.pdf`;

    try {
      setCurrentRenderStudent(student);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const frontEl = cardRef.current;
      const backEl = backCardRef.current;

      if (!frontEl || !backEl) {
        throw new Error("Card elements not found in DOM");
      }

      const frontHtml = frontEl.outerHTML.replace(/\bhidden\b/g, 'flex');
      const backHtml = backEl.outerHTML.replace(/\bhidden\b/g, 'flex');

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="UTF-8">
          <title>${safeName} ID Card</title>
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
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .font-solaiman, .font-solaiman * {
              font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
            }
            body, html, div, span, p, h1, h2, h3, h4, h5, h6, li {
              font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
            }
            @page {
              size: a4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: white;
              width: 210mm;
              height: 297mm;
            }
            .page-container {
              width: 210mm;
              height: 297mm;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              padding-top: 30mm;
              gap: 10mm;
              box-sizing: border-box;
            }
            .card-slot {
              width: 54mm;
              height: 86mm;
              overflow: hidden;
              position: relative;
              border-radius: 3.5mm;
              box-sizing: border-box;
              border: 0.5px solid #cbd5e1;
            }
            .card-slot > div {
              transform: scale(0.72) !important;
              transform-origin: top left !important;
              display: flex !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
            .photo-frame {
              border-radius: 12px !important;
              overflow: hidden !important;
              -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
              clip-path: inset(0 round 12px) !important;
              isolation: isolate !important;
            }
            .photo-frame img {
              border-radius: 10px !important;
              object-fit: cover !important;
              display: block !important;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="card-slot">${frontHtml}</div>
            <div class="card-slot">${backHtml}</div>
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
          orientation: 'portrait',
          entity_type: 'student_id_card_single',
          entity_id: `${student?.id || 'unknown'}`,
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
      throw new Error('Server returned non-OK response');
    } catch (serverError) {
      console.warn("Server ID card generation failed, falling back to client-side:", serverError);
      
      try {
        const pdf = new jsPDF("portrait", "mm", "a4");
        const cardWidth = 54;
        const cardHeight = 86;

        setCurrentRenderStudent(student);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const cardData = await generateSingleCardData();
        if (cardData) {
          const gapX = 10;
          const xMargin = (210 - (cardWidth * 2) - gapX) / 2;
          const yMargin = 30;

          pdf.addImage(cardData.front, "JPEG", xMargin, yMargin, cardWidth, cardHeight, undefined, "FAST");
          pdf.addImage(cardData.back, "JPEG", xMargin + cardWidth + gapX, yMargin, cardWidth, cardHeight, undefined, "FAST");
          pdf.save(filename);
        }
      } catch (err) {
        console.error("Single PDF fallback generation error:", err);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPdfMultiple = async () => {
    const studentsToRender = allStudents && allStudents.length > 0 ? allStudents : [student];
    const filename = `Student_ID_Cards_Batch_${activeSide}_${studentsToRender.length}.pdf`;
    setIsGenerating(true);
    setBulkProgress(5);

    try {
      const cardHtmlPromises = studentsToRender.map(async (std, index) => {
        setCurrentRenderStudent(std);
        await new Promise(r => setTimeout(r, 20));
        const targetEl = activeSide === 'front' ? cardRef.current : backCardRef.current;
        if (!targetEl) return '';
        return targetEl.outerHTML.replace(/\bhidden\b/g, 'flex');
      });

      const cardsHtmlList: string[] = [];
      for (let i = 0; i < studentsToRender.length; i++) {
        setCurrentRenderStudent(studentsToRender[i]);
        await new Promise(r => setTimeout(r, 15));
        const targetEl = activeSide === 'front' ? cardRef.current : backCardRef.current;
        if (targetEl) {
          cardsHtmlList.push(targetEl.outerHTML.replace(/\bhidden\b/g, 'flex'));
        }
        setBulkProgress(Math.min(50, Math.round(((i + 1) / studentsToRender.length) * 50)));
      }

      const CARDS_PER_PAGE = 8;
      const pages: string[][] = [];
      for (let i = 0; i < cardsHtmlList.length; i += CARDS_PER_PAGE) {
        pages.push(cardsHtmlList.slice(i, i + CARDS_PER_PAGE));
      }

      const pagesHtml = pages.map((pageCards, pageIdx) => `
        <div class="page-container" style="page-break-after: ${pageIdx < pages.length - 1 ? 'always' : 'auto'};">
          ${pageCards.map(c => `
            <div class="card-slot">
              ${c}
            </div>
          `).join('')}
        </div>
      `).join('');

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="UTF-8">
          <title>${filename}</title>
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
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .font-solaiman, .font-solaiman * {
              font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
            }
            body, html, div, span, p, h1, h2, h3, h4, h5, h6, li {
              font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
            }
            @page {
              size: a4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: white;
            }
            .page-container {
              width: 210mm;
              height: 297mm;
              padding-top: 15mm;
              padding-bottom: 15mm;
              padding-left: 10mm;
              padding-right: 10mm;
              display: grid;
              grid-template-columns: repeat(3, 54mm);
              grid-template-rows: repeat(3, 86mm);
              gap: 6mm 10mm;
              box-sizing: border-box;
              justify-content: center;
              align-content: center;
            }
            .card-slot {
              width: 54mm;
              height: 86mm;
              overflow: hidden;
              position: relative;
              border-radius: 3.5mm;
              box-sizing: border-box;
              border: 0.5px solid #cbd5e1;
            }
            .card-slot > div {
              transform: scale(0.72) !important;
              transform-origin: top left !important;
              display: flex !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
            .photo-frame {
              border-radius: 12px !important;
              overflow: hidden !important;
              -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
              clip-path: inset(0 round 12px) !important;
              isolation: isolate !important;
            }
            .photo-frame img {
              border-radius: 10px !important;
              object-fit: cover !important;
              display: block !important;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
        </html>
      `;

      setBulkProgress(70);

      const batchKey = studentsToRender.map(s => s.id).slice(0, 5).join('-');
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: fullHtml,
          format: 'a4',
          orientation: 'portrait',
          entity_type: 'student_id_card_grid',
          entity_id: `batch_${batchKey}_${activeSide}_${studentsToRender.length}`,
          filename: filename,
          force_refresh: true
        })
      });

      if (response.ok) {
        setBulkProgress(95);
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
      throw new Error('Server returned non-OK response');
    } catch (serverError) {
      console.warn("Server ID card generation failed, falling back to client-side:", serverError);
      
      try {
        const pdf = new jsPDF("portrait", "mm", "a4");
        const cardWidth = 54;
        const cardHeight = 86;
        const gapX = 10;
        const gapY = 6;
        const columns = 3;
        const rows = 3;
        const cardsPerPage = columns * rows;
        const xOffset = 14;
        const yOffset = 15;

        for (let i = 0; i < studentsToRender.length; i++) {
          setBulkProgress(Math.round(((i + 1) / studentsToRender.length) * 100));
          setCurrentRenderStudent(studentsToRender[i]);
          await new Promise((resolve) => setTimeout(resolve, 150));

          const pageIndex = Math.floor((i % cardsPerPage) / columns);
          const colIndex = (i % cardsPerPage) % columns;

          if (i > 0 && i % cardsPerPage === 0) {
            pdf.addPage();
          }

          const x = xOffset + colIndex * (cardWidth + gapX);
          const y = yOffset + pageIndex * (cardHeight + gapY);

          const cardData = await generateSingleCardData();
          if (cardData) {
            const imageToDraw = activeSide === 'front' ? cardData.front : cardData.back;
            pdf.addImage(imageToDraw, "JPEG", x, y, cardWidth, cardHeight, undefined, "FAST");
          }
        }

        pdf.save(filename);
      } catch (err) {
        console.error("Batch PDF fallback generation error:", err);
      }
    } finally {
      setIsGenerating(false);
      setBulkProgress(0);
      setCurrentRenderStudent(student);
    }
  };

  const downloadEpsSingle = async () => {
    if (!cardRef.current || !backCardRef.current) return;
    setIsGenerating(true);
    const safeName = (student?.student_name || "Student").replace(/\s+/g, "_");
    const rollOrId = student?.roll ? `Roll_${student.roll}` : student?.admission_number || 'ID';
    const baseFilename = `${rollOrId}_${safeName}`;

    try {
      setCurrentRenderStudent(student);
      await new Promise((resolve) => setTimeout(resolve, 250));

      const frontEl = cardRef.current;
      const backEl = backCardRef.current;

      if (!frontEl || !backEl) {
        throw new Error("Card elements not found in DOM");
      }

      await downloadCardEpsZip(frontEl, backEl, baseFilename, student?.student_name || 'Student');
    } catch (err) {
      console.error('Failed to generate EPS:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadEpsMultiple = async () => {
    const studentsToProcess = isBulk && allStudents && allStudents.length > 0 ? allStudents : [student];
    if (studentsToProcess.length === 0 || !cardRef.current || !backCardRef.current) return;

    setIsGenerating(true);
    setBulkProgress(0);

    try {
      const zip = new JSZip();
      const folderName = `ID_Cards_EPS_Press_${new Date().toISOString().split('T')[0]}`;
      const folder = zip.folder(folderName) || zip;

      for (let i = 0; i < studentsToProcess.length; i++) {
        const s = studentsToProcess[i];
        setCurrentRenderStudent(s);
        await new Promise((resolve) => setTimeout(resolve, 150));

        const frontEl = cardRef.current;
        const backEl = backCardRef.current;

        if (frontEl && backEl) {
          const safeName = (s.student_name || `Student_${i + 1}`).replace(/[\s/\\:]+/g, '_');
          const prefix = s.roll ? `${String(s.roll).padStart(2, '0')}_` : `${i + 1}_`;
          const baseName = `${prefix}${safeName}`;

          const [frontEps, backEps] = await Promise.all([
            elementToEps(frontEl, { title: `${s.student_name}_Front`, widthPt: 243.78, heightPt: 388.27 }),
            elementToEps(backEl, { title: `${s.student_name}_Back`, widthPt: 243.78, heightPt: 388.27 })
          ]);

          const frontSvg = elementToPureSvgXml(frontEl, `${s.student_name}_Front`);
          const backSvg = elementToPureSvgXml(backEl, `${s.student_name}_Back`);

          folder.file(`${baseName}_Front.eps`, frontEps);
          folder.file(`${baseName}_Back.eps`, backEps);
          folder.file(`${baseName}_Front_Vector.svg`, frontSvg);
          folder.file(`${baseName}_Back_Vector.svg`, backSvg);
        }

        setBulkProgress(Math.round(((i + 1) / studentsToProcess.length) * 100));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to export bulk EPS:', err);
    } finally {
      setCurrentRenderStudent(student);
      setIsGenerating(false);
      setBulkProgress(0);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(isBangla ? 'পপআপ ব্লকার সক্রিয় আছে। অনুগ্রহ করে পপআপ অনুমোদন করুন।' : 'Popup blocked. Please allow popups.');
      return;
    }

    const targetEl = activeSide === 'front' ? cardRef.current : backCardRef.current;
    if (!targetEl) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${instName} - ID Card</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @font-face {
              font-family: 'SolaimanLipi';
              src: url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-normal-v1.0.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
            .font-solaiman { font-family: 'SolaimanLipi', sans-serif !important; }
            body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            @media print {
              body { padding: 0; }
              @page { size: auto; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div style="transform: scale(1); transform-origin: top center;">
            ${targetEl.outerHTML}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const colors = [
    "#1E3A8A", // Navy Blue
    "#065F46", // Royal Emerald
    "#881337", // Deep Maroon
    "#B91C1C", // Crimson Red
    "#4338CA", // Indigo
    "#0F766E", // Dark Teal
    "#581C87", // Imperial Violet
    "#18181B", // Charcoal
  ];

  const t = {
    title: isBangla ? "শিক্ষার্থী পরিচয় পত্র" : "Student ID Card",
    class: isBangla ? "শ্রেণি" : "Class",
    id: isBangla ? "আইডি/রোল" : "ID/Roll",
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

  // Helper to render top header decoration based on layout style
  const renderHeaderDecoration = () => {
    const style = designSettings.layoutStyle;
    if (style === 'minimal_clean') {
      return (
        <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[140px]" style={{ backgroundColor: themeColor }}>
          <div className="absolute bottom-0 left-0 w-full h-[4px] bg-gradient-to-r from-amber-400 via-white to-amber-400 opacity-80" />
        </div>
      );
    }
    if (style === 'royal_arch') {
      return (
        <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[155px]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 155" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,0 L280,0 L280,115 Q140,165 0,115 Z" fill={themeColor}></path>
            <path d="M0,115 Q140,165 280,115 L280,120 Q140,170 0,120 Z" fill="#F59E0B" opacity="0.9"></path>
            <path d="M0,123 Q140,173 280,123 L280,125 Q140,175 0,125 Z" fill="white" opacity="0.4"></path>
          </svg>
        </div>
      );
    }
    if (style === 'bold_banner') {
      return (
        <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[148px]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 148" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,0 L280,0 L280,140 L140,125 L0,140 Z" fill={themeColor}></path>
            <path d="M0,140 L140,125 L280,140 L280,145 L140,130 L0,145 Z" fill="white" opacity="0.3"></path>
          </svg>
        </div>
      );
    }
    // Default: modern_wave
    return (
      <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[155px]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 155" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,0 L280,0 L280,120 C180,160 100,80 0,140 Z" fill={themeColor}></path>
          <path d="M0,0 L280,0 L280,110 C180,150 100,70 0,130 Z" fill="white" opacity="0.15"></path>
          <path d="M0,0 L280,0 L280,100 C180,140 100,60 0,120 Z" fill="white" opacity="0.1"></path>
          <path d="M0,140 C100,80 180,160 280,120 L280,124 C180,164 100,84 0,144 Z" fill="black" opacity="0.08"></path>
        </svg>
      </div>
    );
  };

  // Helper to render bottom footer decoration based on layout style
  const renderFooterDecoration = () => {
    const style = designSettings.layoutStyle;
    if (style === 'minimal_clean') {
      return (
        <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[45px]" style={{ backgroundColor: themeColor }}>
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/40" />
        </div>
      );
    }
    if (style === 'royal_arch') {
      return (
        <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[65px]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 65" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,65 L280,65 L280,20 Q140,0 0,20 Z" fill={themeColor}></path>
            <path d="M0,20 Q140,0 280,20 L280,23 Q140,3 0,23 Z" fill="#F59E0B" opacity="0.8"></path>
          </svg>
        </div>
      );
    }
    if (style === 'bold_banner') {
      return (
        <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[55px]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 55" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,55 L280,55 L280,12 L140,24 L0,12 Z" fill={themeColor}></path>
            <path d="M0,12 L140,24 L280,12 L280,9 L140,21 L0,9 Z" fill="white" opacity="0.3"></path>
          </svg>
        </div>
      );
    }
    // Default: modern_wave
    return (
      <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[70px]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 70" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,70 L280,70 L280,40 C180,0 100,50 0,20 Z" fill={themeColor}></path>
          <path d="M0,70 L280,70 L280,50 C180,10 100,60 0,30 Z" fill="white" opacity="0.15"></path>
          <path d="M0,70 L280,70 L280,60 C180,20 100,70 0,40 Z" fill="white" opacity="0.10"></path>
        </svg>
      </div>
    );
  };

  // Helper to render back header decoration dynamically matching selected layout style
  const renderBackHeaderDecoration = () => {
    const style = designSettings.layoutStyle;
    if (style === 'minimal_clean') {
      return (
        <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[65px]" style={{ backgroundColor: `${themeColor}12` }}>
          <div className="absolute top-0 left-0 w-full h-[4px]" style={{ backgroundColor: themeColor }} />
          <div className="absolute bottom-0 left-0 w-full h-[1px] border-b border-dashed" style={{ borderColor: `${themeColor}40` }} />
        </div>
      );
    }
    if (style === 'royal_arch') {
      return (
        <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[75px]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 75" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,0 L280,0 L280,45 Q140,75 0,45 Z" fill={themeColor} opacity={0.16}></path>
            <path d="M0,45 Q140,75 280,45 L280,48 Q140,78 0,48 Z" fill="#F59E0B" opacity="0.8"></path>
            <path d="M0,52 Q140,82 280,52 L280,53 Q140,83 0,53 Z" fill={themeColor} opacity={0.3}></path>
          </svg>
        </div>
      );
    }
    if (style === 'bold_banner') {
      return (
        <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[70px]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 70" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,0 L280,0 L280,55 L140,42 L0,55 Z" fill={themeColor} opacity={0.16}></path>
            <path d="M0,55 L140,42 L280,55 L280,59 L140,46 L0,59 Z" fill={themeColor} opacity={0.45}></path>
          </svg>
        </div>
      );
    }
    // Default: modern_wave
    return (
      <div className="absolute top-0 left-0 w-full shrink-0 z-0 h-[80px]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,0 L280,0 L280,50 C180,80 100,20 0,70 Z" fill={themeColor} opacity={0.15}></path>
          <path d="M0,0 L280,0 L280,40 C180,70 100,10 0,60 Z" fill={themeColor} opacity={0.10}></path>
          <path d="M0,70 C100,20 180,80 280,50 L280,53 C180,83 100,23 0,73 Z" fill={themeColor} opacity={0.35}></path>
        </svg>
      </div>
    );
  };

  // Helper to render back footer decoration dynamically matching selected layout style
  const renderBackFooterDecoration = () => {
    const style = designSettings.layoutStyle;
    if (style === 'minimal_clean') {
      return (
        <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[18px] pointer-events-none" style={{ backgroundColor: `${themeColor}12` }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{ backgroundColor: themeColor }} />
        </div>
      );
    }
    if (style === 'royal_arch') {
      return (
        <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[45px] pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 45" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,45 L280,45 L280,15 Q140,0 0,15 Z" fill={themeColor} opacity={0.14}></path>
            <path d="M0,15 Q140,0 280,15 L280,17 Q140,2 0,17 Z" fill="#F59E0B" opacity="0.75"></path>
          </svg>
        </div>
      );
    }
    if (style === 'bold_banner') {
      return (
        <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[38px] pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 38" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,38 L280,38 L280,10 L140,18 L0,10 Z" fill={themeColor} opacity={0.14}></path>
            <path d="M0,10 L140,18 L280,10 L280,12 L140,20 L0,12 Z" fill={themeColor} opacity={0.4}></path>
          </svg>
        </div>
      );
    }
    // Default: modern_wave
    return (
      <div className="absolute bottom-0 left-0 w-full shrink-0 z-0 h-[45px] pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 45" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,45 L280,45 L280,25 C180,5 100,35 0,15 Z" fill={themeColor} opacity={0.12}></path>
          <path d="M0,15 C100,35 180,5 280,25 L280,28 C180,8 100,38 0,18 Z" fill={themeColor} opacity={0.3}></path>
        </svg>
      </div>
    );
  };

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
                className={`p-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all rounded-lg sm:rounded-xl cursor-pointer ${isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-white text-slate-700 border hover:bg-slate-50"}`}
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
                  onClick={() => handleUpdateDesign({ ...designSettings, themeColor: c })}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-all shrink-0 ${themeColor === c ? "border-white ring-2 ring-blue-500 scale-110 shadow-sm" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>

            {/* Download Buttons: PDF & EPS (Press Ready) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* PDF Group */}
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700">
                <button
                  onClick={downloadPdfSingle}
                  disabled={isGenerating || isBulk}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-black bg-[#1E3A8A] text-white rounded-lg hover:bg-blue-800 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  title={isBangla ? "সিঙ্গেল PDF ডাউনলোড" : "Download Single PDF"}
                >
                  <FileText size={13} />
                  <span>{isBangla ? "PDF" : "PDF"}</span>
                </button>
                <button
                  onClick={downloadPdfMultiple}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                  title={isBangla ? "A4 গ্রিড PDF ডাউনলোড" : "Download A4 Grid PDF"}
                >
                  {isGenerating ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#1E3A8A]/30 border-t-[#1E3A8A] rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <Download size={13} />
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

              {/* EPS Press-Ready Group */}
              <div className="flex bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-1 shadow-sm border border-emerald-200 dark:border-emerald-800">
                <button
                  onClick={downloadEpsSingle}
                  disabled={isGenerating || isBulk}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-black bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  title={isBangla ? "প্রেস প্রিন্ট উপযোগী ভেক্টর EPS ডাউনলোড (ZIP)" : "Download Single EPS ZIP (Front & Back)"}
                >
                  <Sparkles size={13} />
                  <span>{isBangla ? "EPS প্রেস" : "EPS"}</span>
                </button>
                <button
                  onClick={downloadEpsMultiple}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-black text-emerald-800 dark:text-emerald-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                  title={isBangla ? "সকল শিক্ষার্থীর ফ্রন্ট ও ব্যাক EPS জিপ ডাউনলোড" : "Download Bulk EPS ZIP for Press"}
                >
                  {isGenerating ? (
                    <div className="w-3.5 h-3.5 border-2 border-emerald-700/30 border-t-emerald-700 rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <Layers size={13} />
                  )}
                  <span>{isBangla ? "সকল EPS" : "All EPS"}</span>
                </button>
              </div>
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
              textSizeAdjust: "100%",
              borderRadius: "12px",
              overflow: "hidden"
            }}
            ref={cardRef}
          >
             {/* Header Vector */}
             {renderHeaderDecoration()}

             {/* Bottom Vector */}
             {renderFooterDecoration()}

             {/* Content Container */}
             <div className="relative z-10 flex flex-col h-full w-full">
                 {/* Header - Logo & Madrasah Info */}
                 <div className="flex items-center gap-2.5 pt-4 px-4">
                      {designSettings.showLogo !== false && (
                        <div 
                          className="bg-white rounded-full p-[2px] shadow-sm flex items-center justify-center shrink-0"
                          style={{
                            width: `${designSettings.logoSize || 48}px`,
                            height: `${designSettings.logoSize || 48}px`
                          }}
                        >
                           {madrasah?.logo_url ? (
                             <img src={madrasah.logo_url} alt="Logo" className="w-full h-full object-contain rounded-full" crossOrigin="anonymous" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                           ) : (
                             <div className="w-full h-full rounded-full flex items-center justify-center text-[18px] font-black" style={{ color: themeColor }}>
                               {instName.charAt(0) || "M"}
                             </div>
                           )}
                        </div>
                      )}
                      <div className="flex-1 text-center flex flex-col justify-center min-w-0 px-0.5">
                          <h3 
                            className="font-bold text-white font-solaiman w-full mx-auto text-center leading-snug py-0.5" 
                            style={{ 
                              fontSize: `${designSettings.instNameSize || 16}px`,
                              color: designSettings.instNameColor || 'white',
                              textShadow: "0 1px 2px rgba(0,0,0,0.3)" 
                            }}
                          >
                           {instName}
                         </h3>
                         <p 
                           className="text-white/95 font-medium -mt-0.5 w-full mx-auto text-center leading-snug"
                           style={{ fontSize: `${designSettings.instAddressSize || 8}px` }}
                         >
                           {instAddress}
                         </p>
                      </div>
                 </div>

                 {/* Photo & Title Section */}
                 <div className="flex flex-col items-center mt-1 w-full relative z-10 px-5">
                     {designSettings.showPhoto !== false && (
                       <div 
                         className="bg-white border-[2px] border-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden flex items-center justify-center shrink-0 photo-frame"
                         style={{
                           width: `${designSettings.photoWidth || 75}px`,
                           height: `${designSettings.photoHeight || 85}px`,
                           borderRadius: `${designSettings.photoRadius !== undefined ? designSettings.photoRadius : 12}px`,
                           overflow: 'hidden',
                           WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                           clipPath: `inset(0 round ${designSettings.photoRadius !== undefined ? designSettings.photoRadius : 12}px)`,
                           isolation: 'isolate'
                         }}
                       >
                          {(isPhotoModuleEnabled && currentRenderStudent.photo_url) ? (
                              <img 
                                src={currentRenderStudent.photo_url} 
                                alt="Photo" 
                                className="w-full h-full object-cover" 
                                style={{
                                  borderRadius: `${Math.max(0, (designSettings.photoRadius !== undefined ? designSettings.photoRadius : 12) - 2)}px`,
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                                crossOrigin="anonymous"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                              />
                          ) : (
                              <svg className="text-slate-200 w-[36px] h-[36px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          )}
                       </div>
                     )}

                     {/* Title Badge */}
                     <div 
                       className="mt-1 px-3 py-0.5 rounded-full text-white text-[8.5px] font-bold shadow-sm tracking-wide border border-white/20 uppercase inline-block font-solaiman" 
                       style={{ backgroundColor: designSettings.badgeBgColor || themeColor }}
                     >
                       {designSettings.badgeText || t.idBadge}
                     </div>

                     {/* Name */}
                     <div className="mt-0.5 text-center px-2">
                        <h2 
                          className="font-extrabold font-solaiman leading-snug py-0.5" 
                          style={{ 
                            fontSize: `${designSettings.nameSize || 16}px`,
                            color: designSettings.nameColor || themeColor 
                          }}
                        >
                             {currentRenderStudent.student_name || 'Student Name'}
                         </h2>
                     </div>
                 </div>

                 {/* Data Fields */}
                 <div className="pl-10 pr-4 w-full flex flex-col gap-[1px] mt-0.5 z-10 relative">
                      {designSettings.showClass !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.class}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman"
                             style={{ fontSize: `${designSettings.fieldValueSize || 11.5}px` }}
                           >
                             {currentRenderStudent.classes?.class_name || (currentRenderStudent as any).class_name || "-"}
                           </span>
                        </div>
                      )}

                      {designSettings.showSection !== false && currentRenderStudent.section && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.section}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman"
                             style={{ fontSize: `${designSettings.fieldValueSize || 11.5}px` }}
                           >
                             {currentRenderStudent.section}
                           </span>
                        </div>
                      )}

                      {designSettings.showId !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.id}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman tracking-wide"
                             style={{ fontSize: `${designSettings.fieldValueSize || 11.5}px` }}
                           >
                             {currentRenderStudent.registration_number || (currentRenderStudent.roll !== null && currentRenderStudent.roll !== undefined ? currentRenderStudent.roll : null) || (currentRenderStudent as any).admission_number || currentRenderStudent.biometric_id || (currentRenderStudent.id ? currentRenderStudent.id.substring(0, 6).toUpperCase() : "-")}
                           </span>
                        </div>
                      )}

                      {designSettings.showDob !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.dob}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman tracking-wide"
                             style={{ fontSize: `${designSettings.fieldValueSize || 11.5}px` }}
                           >
                             {currentRenderStudent.date_of_birth ? new Date(currentRenderStudent.date_of_birth).toLocaleDateString('en-GB') : "-"}
                           </span>
                        </div>
                      )}

                      {designSettings.showBlood !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.blood}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-black text-red-600 leading-snug py-0.5 font-solaiman"
                             style={{ fontSize: `${designSettings.fieldValueSize || 11.5}px` }}
                           >
                             {currentRenderStudent.blood_group || "-"}
                           </span>
                        </div>
                      )}

                      {designSettings.showFather !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.father}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] font-solaiman"
                             style={{ fontSize: `${Math.max(9.5, (designSettings.fieldValueSize || 11.5) - 0.5)}px` }}
                           >
                             {(currentRenderStudent as any).father_name || currentRenderStudent.guardian_name || "-"}
                           </span>
                        </div>
                      )}

                      {designSettings.showMother !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.mother}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] font-solaiman"
                             style={{ fontSize: `${Math.max(9.5, (designSettings.fieldValueSize || 11.5) - 0.5)}px` }}
                           >
                             {currentRenderStudent.mother_name || "-"}
                           </span>
                        </div>
                      )}

                      {designSettings.showPhone !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.phone}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-snug py-0.5 font-solaiman tracking-wide"
                             style={{ fontSize: `${Math.max(9.5, (designSettings.fieldValueSize || 11.5) - 0.5)}px` }}
                           >
                             {currentRenderStudent.guardian_phone || currentRenderStudent.guardian_phone_2 || "-"}
                           </span>
                        </div>
                      )}

                      {designSettings.showAddress !== false && (
                        <div className="flex items-start">
                           <span 
                             className="font-semibold text-slate-600 font-solaiman shrink-0 py-0.5 leading-snug"
                             style={{ 
                               width: `${designSettings.labelWidth || 75}px`,
                               fontSize: `${designSettings.fieldFontSize || 10}px` 
                             }}
                           >
                             {t.address}
                           </span>
                           <span className="font-semibold text-slate-400 mr-2 shrink-0 py-0.5 leading-snug" style={{ fontSize: `${designSettings.fieldFontSize || 10}px` }}>:</span>
                           <span 
                             className="font-extrabold text-slate-800 leading-tight py-0.5 line-clamp-2 max-w-[155px] font-solaiman break-words"
                             style={{ fontSize: `${Math.max(9, (designSettings.fieldValueSize || 11.5) - 1.5)}px` }}
                           >
                             {currentRenderStudent.address || (currentRenderStudent as any).permanent_address || "-"}
                           </span>
                        </div>
                      )}
                 </div>

                 {/* Footer Signature */}
                 <div className="w-full flex justify-end items-end mt-auto px-5 pb-2 relative z-10">
                    <div className="flex items-end gap-2 text-center relative w-full h-[35px] max-w-[120px]">
                       <div className="flex flex-col items-center w-[70px] ml-auto">
                          <div 
                            className="flex items-end justify-center mb-[2px]" 
                            style={{ height: `${designSettings.signatureHeight || (madrasah?.config_json?.signature_height ? madrasah.config_json.signature_height / 1.5 : 22)}px` }}
                          >
                          {madrasah?.config_json?.signature_url ? (
                             <img 
                               src={madrasah.config_json.signature_url} 
                               style={{ height: `${designSettings.signatureHeight || (madrasah?.config_json?.signature_height ? madrasah.config_json.signature_height / 1.5 : 22)}px` }} 
                               className="object-contain mix-blend-multiply" 
                               alt="Sig" 
                               crossOrigin="anonymous" 
                               onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                             />
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
                             {designSettings.principalTitle || t.principal}
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
              textSizeAdjust: "100%",
              borderRadius: "12px",
              overflow: "hidden"
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

            {/* Back Header - Dynamic Vector matching layout style */}
            {renderBackHeaderDecoration()}

            {/* Back Footer - Dynamic Vector matching layout style */}
            {renderBackFooterDecoration()}

            {/* Back Header Content */}
            <div className="w-full pt-3 pb-0.5 px-3 text-center z-10 relative">
               <div className="flex items-center justify-center px-1">
                  <h3 
                    className="font-bold font-solaiman w-full leading-snug py-0.5" 
                    style={{ 
                      color: themeColor,
                      fontSize: `${Math.max(11, (designSettings.instNameSize || 16) - 1)}px`
                    }}
                  >
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

              {/* QR Code Segment */}
              {designSettings.showQrCode !== false && (
                <div className="my-1 flex flex-col items-center w-full">
                  <div className="p-1.5 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-100 inline-block mb-1">
                    <QRCode
                      value={madrasah ? `Name: ${madrasah.name}\nAddress: ${madrasah.address || ''}\nMobile: ${madrasah.phone || ''}\nStudent: ${currentRenderStudent.student_name} (${currentRenderStudent.registration_number || currentRenderStudent.roll || ''})` : `ID:${currentRenderStudent.id}`}
                      size={designSettings.qrSize || 60}
                    />
                  </div>
                  <p className="text-[8px] font-bold tracking-widest text-slate-500 font-solaiman">
                    {currentRenderStudent.registration_number ||
                      currentRenderStudent.roll ||
                      currentRenderStudent.id.substring(0, 8)}
                  </p>
                </div>
              )}

              {/* Emergency Contact */}
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
                  {madrasah?.contact_email && (
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
                            fontSize: `${(madrasah.contact_email?.length || 0) > 30 ? 6.5 : (madrasah.contact_email?.length || 0) > 24 ? 7 : (madrasah.contact_email?.length || 0) > 18 ? 7.5 : 8}px`,
                            lineHeight: '1.2'
                          }}
                        >
                          {madrasah.contact_email}
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
                    <span className="font-medium leading-tight">
                      {madrasah?.address || "ঢাকা, বাংলাদেশ"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Backside Bottom Motto */}
            <div className="w-full py-1 text-center bg-slate-100 border-t border-slate-200 mt-auto z-10 relative">
              <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-widest font-solaiman">
                {designSettings.mottoText || t.motto}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ID Card Design Customization Modal */}
      <IdCardDesignModal
        isOpen={isDesignModalOpen}
        onClose={() => setIsDesignModalOpen(false)}
        settings={designSettings}
        onUpdate={handleUpdateDesign}
        onSaveToCloud={handleSaveToCloud}
        isSavingCloud={isSavingCloud}
        lang={lang}
        cardType="student"
      />
    </div>
  );
};

export default StudentIdCardGenerator;
