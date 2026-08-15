import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, Student, ExamSubject, Institution, SeatAssignment, Class, ClassRoutine } from '../types';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { toJpeg, toPng } from 'html-to-image';
import { ResultSheetTemplate } from '../components/pdf/ResultSheetTemplate';
import { PremiumResultSheetTemplate } from '../components/pdf/PremiumResultSheetTemplate';
import { ClassResultTemplate } from '../components/pdf/ClassResultTemplate';
import { ClassFeeReportTemplate } from '../components/pdf/ClassFeeReportTemplate';
import { FeeReceiptTemplate } from '../components/pdf/FeeReceiptTemplate';
import { FinalResultTemplate } from '../components/pdf/FinalResultTemplate';
import { SeatPlanTemplate } from '../components/pdf/SeatPlanTemplate';
import { AttendanceReportTemplate } from '../components/pdf/AttendanceReportTemplate';
import { AccountingReportTemplate } from '../components/pdf/AccountingReportTemplate';
import { RoutinePDFTemplate } from '../components/pdf/RoutinePDFTemplate';
import { MasterRoutinePDFTemplate } from '../components/pdf/MasterRoutinePDFTemplate';
import { ExamRoutinePDFTemplate } from '../components/pdf/ExamRoutinePDFTemplate';
import { StudentListTemplate } from '../components/pdf/StudentListTemplate';

const CACHE_KEY_FONT = 'bengali_font_base64_v1';
let bengaliFontBase64: string | null = null;

const CACHE_KEY_AREF_RUQAA = 'aref_ruqaa_font_base64_v2';
const CACHE_KEY_AMIRI = 'amiri_font_base64_v2';
const CACHE_KEY_UTHMAN_TAHA = 'uthman_taha_font_base64_v2';

let arefRuqaaFontBase64: string | null = null;
let amiriFontBase64: string | null = null;
let uthmanTahaFontBase64: string | null = null;

const fetchFontAsBase64 = async (url: string, cacheKey: string): Promise<string | null> => {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached && cached.length > 1000) return cached;
    } catch (e) {}

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Failed to fetch font from:", url);
            return null;
        }
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.byteLength; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
        }
        const base64 = window.btoa(binary);
        try {
            localStorage.setItem(cacheKey, base64);
        } catch (e) {}
        return base64;
    } catch (e) {
        console.error("Failed to fetch font:", url, e);
        return null;
    }
};

const loadBengaliFont = async (doc: jsPDF) => {
    if (!bengaliFontBase64) {
        // Try Cache first
        try {
            const cached = localStorage.getItem(CACHE_KEY_FONT);
            if (cached) {
                bengaliFontBase64 = cached;
            }
        } catch(e) {}
    }

    if (!bengaliFontBase64) {
        try {
            const response = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/unhinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf');
            if (!response.ok) {
                console.error("Failed to fetch Bengali font, status:", response.status);
                return;
            }
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            // Process chunk by chunk to prevent Maximum call stack error
            const chunkSize = 8192;
            for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
            }
            bengaliFontBase64 = window.btoa(binary);
            try {
                localStorage.setItem(CACHE_KEY_FONT, bengaliFontBase64);
            } catch(e) {}
            console.log("Bengali font loaded successfully, base64 length:", bengaliFontBase64.length);
        } catch (e) {
            console.error("Failed to load Bengali font", e);
            return;
        }
    }
    doc.addFileToVFS('NotoSansBengali.ttf', bengaliFontBase64);
    doc.addFont('NotoSansBengali.ttf', 'NotoSansBengali', 'normal');
    doc.setFont('NotoSansBengali');
};

const imageCache: Record<string, string> = {};

// Helper: Load Image
const loadImage = (url: string): Promise<string> => {
    if (imageCache[url]) {
        return Promise.resolve(imageCache[url]);
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Prevent huge resolution images hitting memory constraints during PDF gen
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            imageCache[url] = dataUrl;
            resolve(dataUrl);
        };
        img.onerror = reject;
    });
};

// --- ATTENDANCE REPORT GENERATOR ---
export const generateAttendanceReportPDF = async (
    reportData: any[],
    madrasah: any,
    className: string,
    month: string,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(5);
    
    // Load Calligraphy image if available
    let calligraphyBase64: string | null = null;
    const calligraphyUrl = madrasah?.config_json?.arabic_calligraphy_url;
    if (calligraphyUrl) {
        try {
            // Fetch fresh every time for calligraphy to ensure updates reflect immediately
            const response = await fetch(calligraphyUrl);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
                }
                calligraphyBase64 = window.btoa(binary);
            }
        } catch (e) {
            console.error("Failed to fetch calligraphy image", e);
        }
    }

    // Load Arabic Fonts as Base64 to bypass CORS constraints inside HTML-to-Image SVG Canvas context
    let localAref = arefRuqaaFontBase64;
    let localAmiri = amiriFontBase64;
    let localUthman = uthmanTahaFontBase64;
    
    try {
        if (!localAref) {
            localAref = await fetchFontAsBase64(
                'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/arefruqaa/ArefRuqaa-Regular.ttf',
                CACHE_KEY_AREF_RUQAA
            );
            arefRuqaaFontBase64 = localAref;
        }
        if (!localAmiri) {
            localAmiri = await fetchFontAsBase64(
                'https://fonts.gstatic.com/l/font?kit=J7aRnpd8CGxBHqUo&skey=159039cc026b7e65&v=v30',
                CACHE_KEY_AMIRI
            );
            amiriFontBase64 = localAmiri;
        }
        if (!localUthman) {
            const sources = [
                'https://fonts.gstatic.com/l/font?kit=4UaZrFhTvxVnHDvUkUiHg8jprP4DCwI&skey=dedc87abea7dfb07&v=v21', // Scheherazade New (gorgeous classic Quran Naskh style)
                'https://fonts.gstatic.com/l/font?kit=RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krQ&skey=bacb52bf696c6ae6&v=v44' // Noto Naskh Arabic (clean Quran style)
            ];
            
            for (const url of sources) {
                try {
                    const fetched = await fetchFontAsBase64(url, CACHE_KEY_UTHMAN_TAHA);
                    if (fetched && fetched.length > 1000) {
                        localUthman = fetched;
                        console.log(`Successfully pre-loaded Uthmanic font from: ${url}`);
                        break;
                    }
                } catch (e) {
                    console.warn(`Failed to pre-load Uthmanic font from: ${url}`, e);
                }
            }
            uthmanTahaFontBase64 = localUthman;
        }
    } catch (err) {
        console.error("Error pre-loading Arabic fonts for PDF generation:", err);
    }
    
    onProgress?.(15);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                <AttendanceReportTemplate 
                    reportData={reportData} 
                    madrasah={madrasah} 
                    className={className} 
                    month={month} 
                    lang={lang} 
                    arefRuqaaFontBase64={localAref}
                    amiriFontBase64={localAmiri}
                    uthmanTahaFontBase64={localUthman}
                    arabicCalligraphyBase64={calligraphyBase64}
                />
            </div>
        );
        setTimeout(resolve, 1500); 
    });
    onProgress?.(30);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children).filter(el => el.tagName !== 'STYLE');
        
        for (let i = 0; i < pages.length; i++) {
            const pageElement = pages[i] as HTMLElement;
            
            const imgData = await toJpeg(pageElement, {
                pixelRatio: 1.5,
        quality: 0.8,
                backgroundColor: '#ffffff',
                width: 794, 
                height: 1123, 
            });

            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            onProgress?.(30 + Math.floor(((i + 1) / pages.length) * 65));
        }
    }
    
    onProgress?.(98);
    doc.save(`Attendance_Report_${className}_${month}.pdf`);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};
// --- SEAT PLAN GENERATOR ---
export const generateSeatPlanPDF = async (
    assignments: any[],
    madrasah: any,
    templateId: string = 'list',
    lang: 'en' | 'bn' = 'en',
    examName?: string,
    onProgress?: (progress: number) => void
) => {
    onProgress?.(5);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<SeatPlanTemplate assignments={assignments} madrasah={madrasah} templateId={templateId} lang={lang} examName={examName} />);
        setTimeout(resolve, 1500); // Give more time for fonts/images to render
    });
    onProgress?.(25);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // The template groups by room, so we can iterate over the room divs
    const wrapper = container.firstElementChild;
    if (wrapper && wrapper.children.length > 0) {
        const roomDivs = Array.from(wrapper.children);
        
        for (let i = 0; i < roomDivs.length; i++) {
            const roomElement = roomDivs[i] as HTMLElement;
            
            const imgData = await toPng(roomElement, {
                pixelRatio: 4, // Higher resolution for sharpness
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }
            });

            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'SLOW');
            onProgress?.(25 + Math.floor(((i + 1) / roomDivs.length) * 70));
        }
    } else {
        // Fallback if structure is different
        const imgData = await toPng(container.firstElementChild as HTMLElement, {
            pixelRatio: 3,
            backgroundColor: '#ffffff',
        });
        doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'SLOW');
        onProgress?.(90);
    }
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`seat-plan-${templateId}.pdf`);
    onProgress?.(100);
};

// --- RESULT GENERATOR ---
export const generateResultPDF = async (
    student: any,
    exam: any,
    marks: any[],
    madrasah: any,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void,
    templateId: 'classic' | 'premium' = 'classic'
) => {
    onProgress?.(10);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        if (templateId === 'premium') {
            root.render(
                <div id="pdf-wrapper">
                    <PremiumResultSheetTemplate 
                         exam={exam} 
                         subjects={marks.map((m: any) => ({
                            id: m.subject_id || m.id,
                            subject_name: m.subject_name || m.name,
                            full_marks: m.full_marks || 100,
                            pass_marks: m.pass_marks || 33
                        }))} 
                         students={[]} 
                         madrasah={madrasah} 
                         lang={lang} 
                         singleStudent={student} 
                         singleStudentMarks={marks} 
                     />
                </div>
            );
        } else {
            root.render(
                <div id="pdf-wrapper">
                    <ResultSheetTemplate student={student} exam={exam} marks={marks} madrasah={madrasah} lang={lang} />
                </div>
            );
        }
        setTimeout(resolve, 2000); // Give React time to render completely
    });

    onProgress?.(50);

    const targetEl = container.querySelector('#pdf-wrapper') as HTMLElement;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        ${styles}
        <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            #pdf-wrapper {
                width: 794px;
                height: 1123px;
                background: white;
            }
        </style>
    </head>
    <body class="light">
        ${targetEl.innerHTML}
    </body>
    </html>
    `;

    try {
        const response = await fetch('/api/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: htmlContent,
                format: 'A4',
                landscape: false,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to generate PDF');
        }

        onProgress?.(90);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Result_${student.student_name || student.name || 'Student'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Puppeteer PDF Error:', err);
        alert('PDF generation failed. Please try again.');
    }

    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};

export const generateMassMarksheetPDF = async (
    preppedStudents: any[],
    exam: any,
    madrasah: any,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void,
    templateId: 'classic' | 'premium' = 'classic'
) => {
    onProgress?.(2);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                {preppedStudents.map((std, idx) => (
                    <div key={idx} className="pdf-page-container w-[794px] h-[1123px] bg-white">
                        {templateId === 'premium' ? (
                            <PremiumResultSheetTemplate 
                                 exam={exam} 
                                 subjects={std.marks.map((m: any) => ({
                                    id: m.subject_id || m.id,
                                    subject_name: m.subject_name || m.name,
                                    full_marks: m.full_marks || 100,
                                    pass_marks: m.pass_marks || 33
                                }))} 
                                 students={[]} 
                                 madrasah={madrasah} 
                                 lang={lang} 
                                 singleStudent={std.info} 
                                 singleStudentMarks={std.marks} 
                             />
                        ) : (
                            <ResultSheetTemplate 
                                 student={std.info} 
                                 exam={exam} 
                                 marks={std.marks} 
                                 madrasah={madrasah} 
                                 lang={lang} 
                             />
                        )}
                    </div>
                ))}
            </div>
        );
        setTimeout(resolve, 2000); // Give React time to render completely
    });

    onProgress?.(30);

    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
        
        let htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            ${styles}
            <style>
                @page { size: A4 landscape; margin: 0; }
                body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
                .pdf-landscape-page {
                    width: 297mm;
                    height: 210mm;
                    display: flex;
                    page-break-after: always;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                .pdf-marksheet-half {
                    width: 148.5mm;
                    height: 210mm;
                    position: relative;
                    overflow: hidden;
                }
                .pdf-page-container {
                    width: 794px !important;
                    height: 1123px !important;
                    transform: scale(0.7071);
                    transform-origin: top left;
                    background: white;
                }
            </style>
        </head>
        <body class="light">
        `;
        
        for (let i = 0; i < pages.length; i += 2) {
            const leftPage = pages[i].outerHTML;
            const rightPage = pages[i + 1] ? pages[i + 1].outerHTML : '';
            
            htmlContent += `
            <div class="pdf-landscape-page">
                <div class="pdf-marksheet-half">${leftPage}</div>
                <div class="pdf-marksheet-half">${rightPage}</div>
            </div>
            `;
        }
        
        htmlContent += `</body></html>`;

        onProgress?.(60);

        try {
            const response = await fetch('/api/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: htmlContent,
                    format: 'A4',
                    landscape: true,
                    margin: { top: '0', right: '0', bottom: '0', left: '0' }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate PDF');
            }

            onProgress?.(90);

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Mass_Marksheets_${exam.exam_name || 'All'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Puppeteer PDF Error:', err);
            alert('PDF generation failed. Please try again.');
        }
    }
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};

// --- CLASS RESULT GENERATOR ---
export const generateClassResultPDF = async (
    exam: any,
    subjects: any[],
    students: any[],
    marksData: any,
    madrasah: { name: string, config_json?: any },
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void,
    templateId: 'classic' | 'premium' = 'classic'
) => {
    onProgress?.(5);

    let configObj = madrasah?.config_json as any;
    if (typeof configObj === 'string') {
        try { configObj = JSON.parse(configObj); } catch (e) { configObj = {}; }
    }
    const config = (typeof configObj === 'object' && configObj !== null) ? configObj : {};
    const resultSystem = config.result_system || 'grading';

    // Pre-calculate totals, GPA, rank
    const calculatedStudents = students.map((student, sIdx) => {
        const studentMarks = marksData[student.id] || {};
        let total = 0;
        let totalPossible = 0;
        let hasFailed = false;

        let pointsSum = 0;
        let numMainSubjects = 0;

        const processedSubjectIds = new Set<string>();

        subjects.forEach(s => {
            if (processedSubjectIds.has(s.id)) return;

            // Handle High School combinations
            const children = resultSystem === 'high_school' ? subjects.filter(child => child.pair_with_id === s.id) : [];
            const isParent = children.length > 0;
            const isChild = resultSystem === 'high_school' && !!s.pair_with_id;

            if (isChild) {
                // Individual marks for child will be processed but they don't contribute to GPA here
                // (they will be handled when their parent is processed)
                return;
            }

            if (isParent) {
                let combinedObtained = 0;
                let combinedFull = s.full_marks || 100;
                let combinedFailed = false;

                // Parent marks
                const mP = studentMarks[s.id];
                const markValP = mP !== undefined && mP !== '' ? Number(mP) : 0;
                combinedObtained += markValP;

                // Check Parent Breakdown
                if (resultSystem === 'high_school') {
                    const cq = Number(studentMarks[`${s.id}_cq`] || 0);
                    const mcq = Number(studentMarks[`${s.id}_mcq`] || 0);
                    const pr = Number(studentMarks[`${s.id}_practical`] || 0);
                    if (s.cq_full_marks && cq < Math.ceil(s.cq_full_marks * 0.33)) combinedFailed = true;
                    if (s.mcq_full_marks && mcq < Math.ceil(s.mcq_full_marks * 0.33)) combinedFailed = true;
                    if (s.practical_full_marks && pr < Math.ceil(s.practical_full_marks * 0.33)) combinedFailed = true;
                }
                if (markValP < (s.pass_marks || Math.ceil((s.full_marks || 100) * 0.33))) combinedFailed = true;

                // Children marks
                children.forEach(child => {
                    const mC = studentMarks[child.id];
                    const markValC = mC !== undefined && mC !== '' ? Number(mC) : 0;
                    combinedObtained += markValC;
                    combinedFull += (child.full_marks || 100);

                    // Check Child Breakdown
                    if (resultSystem === 'high_school') {
                        const cq = Number(studentMarks[`${child.id}_cq`] || 0);
                        const mcq = Number(studentMarks[`${child.id}_mcq`] || 0);
                        const pr = Number(studentMarks[`${child.id}_practical`] || 0);
                        if (child.cq_full_marks && cq < Math.ceil(child.cq_full_marks * 0.33)) combinedFailed = true;
                        if (child.mcq_full_marks && mcq < Math.ceil(child.mcq_full_marks * 0.33)) combinedFailed = true;
                        if (child.practical_full_marks && pr < Math.ceil(child.practical_full_marks * 0.33)) combinedFailed = true;
                    }
                    processedSubjectIds.add(child.id);
                });

                // Overall combined pass
                if (combinedObtained < Math.ceil(combinedFull * 0.33)) combinedFailed = true;

                const pct = (combinedObtained / combinedFull) * 100;
                let gp = 0.00;
                if (!combinedFailed) {
                    if (pct >= 80) gp = 5.00;
                    else if (pct >= 70) gp = 4.00;
                    else if (pct >= 60) gp = 3.50;
                    else if (pct >= 50) gp = 3.00;
                    else if (pct >= 40) gp = 2.00;
                    else gp = 1.00;
                }

                if (combinedFailed && !s.is_optional) hasFailed = true;

                total += combinedObtained;
                totalPossible += combinedFull;

                if (s.is_optional) {
                    if (gp > 2) pointsSum += (gp - 2);
                } else {
                    pointsSum += gp;
                    numMainSubjects++;
                }
                processedSubjectIds.add(s.id);

            } else {
                // Standard subject
                const m = studentMarks[s.id];
                const fullMarkValue = Number(s.full_marks || 100);
                const passMarkValue = Number(s.pass_marks || Math.ceil(fullMarkValue * 0.33));
                const isOptional = !!s.is_optional;

                if (m !== undefined && m !== '') {
                    const markVal = Number(m);
                    let failed = markVal < passMarkValue;

                    if (resultSystem === 'high_school') {
                        const cq = Number(studentMarks[`${s.id}_cq`] || 0);
                        const mcq = Number(studentMarks[`${s.id}_mcq`] || 0);
                        const pr = Number(studentMarks[`${s.id}_practical`] || 0);
                        if (s.cq_full_marks && cq < Math.ceil(s.cq_full_marks * 0.33)) failed = true;
                        if (s.mcq_full_marks && mcq < Math.ceil(s.mcq_full_marks * 0.33)) failed = true;
                        if (s.practical_full_marks && pr < Math.ceil(s.practical_full_marks * 0.33)) failed = true;
                    }

                    const isOptionalEffectively = isOptional && (resultSystem === 'grading_optional' || resultSystem === 'high_school');
                    if (!isOptionalEffectively && failed) hasFailed = true;

                    const pct = (markVal / fullMarkValue) * 100;
                    let gp = 0.00;
                    if (!failed) {
                        if (pct >= 80) gp = 5.00;
                        else if (pct >= 70) gp = 4.00;
                        else if (pct >= 60) gp = 3.50;
                        else if (pct >= 50) gp = 3.00;
                        else if (pct >= 40) gp = 2.00;
                        else gp = 1.00;
                    }

                    total += markVal;
                    totalPossible += fullMarkValue;

                    if (resultSystem === 'grading_optional' || resultSystem === 'high_school') {
                        if (!isOptional) {
                            pointsSum += gp;
                            numMainSubjects++;
                        } else if (gp > 2) {
                            pointsSum += (gp - 2);
                        }
                    } else {
                        pointsSum += gp;
                        numMainSubjects++;
                    }
                } else {
                    const isOptionalEffectively = isOptional && (resultSystem === 'grading_optional' || resultSystem === 'high_school');
                    if (!isOptionalEffectively) {
                        hasFailed = true;
                        totalPossible += fullMarkValue;
                        numMainSubjects++;
                    }
                }
                processedSubjectIds.add(s.id);
            }
        });
        
        const hasAnyMark = subjects.some(s => studentMarks[s.id] !== undefined && studentMarks[s.id] !== '' && studentMarks[s.id] !== null);
        const avgPercentage = subjects.length > 0 ? (total / subjects.length) : 0;
        
        let gpa = '0.00';
        let grade = 'F';

        if (numMainSubjects > 0) {
            if (!hasFailed) {
                if (resultSystem === 'grading' || resultSystem === 'grading_optional' || resultSystem === 'high_school') {
                    let avgGp = pointsSum / numMainSubjects;
                    if (avgGp > 5.0) avgGp = 5.0;
                    gpa = avgGp.toFixed(1);
                    if (avgGp >= 5.0) grade = 'A+';
                    else if (avgGp >= 4.0) grade = 'A';
                    else if (avgGp >= 3.5) grade = 'A-';
                    else if (avgGp >= 3.0) grade = 'B';
                    else if (avgGp >= 2.0) grade = 'C';
                    else if (avgGp >= 1.0) grade = 'D';
                    else grade = 'F';
                } else {
                    const overallPct = totalPossible > 0 ? (total / totalPossible) * 100 : 0;
                    if (overallPct >= 80) { gpa = '5.0'; grade = 'A+'; }
                    else if (overallPct >= 70) { gpa = '4.0'; grade = 'A'; }
                    else if (overallPct >= 60) { gpa = '3.5'; grade = 'A-'; }
                    else if (overallPct >= 50) { gpa = '3.0'; grade = 'B'; }
                    else if (overallPct >= 40) { gpa = '2.0'; grade = 'C'; }
                    else if (overallPct >= 33) { gpa = '1.0'; grade = 'D'; }
                }
            }
        }
        
        if (sIdx % 10 === 0) onProgress?.(5 + Math.floor((sIdx / students.length) * 15));

        return {
            ...student,
            _total: hasAnyMark ? total : '',
            _avg: hasAnyMark ? avgPercentage.toFixed(1) : '',
            _gpa: hasAnyMark ? gpa : '',
            _grade: hasAnyMark ? grade : '',
            _hasFailed: hasAnyMark ? hasFailed : true,
            _hasAnyMark: hasAnyMark
        };
    });

    // Sort by rank logic
    const validForRank = calculatedStudents.filter(s => s._hasAnyMark);
    validForRank.sort((a, b) => {
        if (a._hasFailed && !b._hasFailed) return 1;
        if (!a._hasFailed && b._hasFailed) return -1;
        
        const totalDiff = (Number(b._total) || 0) - (Number(a._total) || 0);
        if (Math.abs(totalDiff) > 0.001) return totalDiff;
        const rollA = typeof a.roll === 'string' ? parseInt(a.roll) || 0 : (a.roll || 0);
        const rollB = typeof b.roll === 'string' ? parseInt(b.roll) || 0 : (b.roll || 0);
        return rollA - rollB;
    });

    let currentRank = 1;
    validForRank.forEach((std, index) => {
        if (index > 0) {
            const prev = validForRank[index - 1];
            const isTie = (
                prev._hasFailed === std._hasFailed &&
                Math.abs((Number(prev._total) || 0) - (Number(std._total) || 0)) < 0.001
            );
            if (!isTie) {
                currentRank++;
            }
        }
        std._rank = currentRank;
    });

    calculatedStudents.forEach(std => {
        if (!std._hasAnyMark) {
            std._rank = '';
        }
    });

    // Sort back by roll for the sheet
    calculatedStudents.sort((a, b) => {
        const rollA = typeof a.roll === 'string' ? parseInt(a.roll) || 0 : (a.roll || 0);
        const rollB = typeof b.roll === 'string' ? parseInt(b.roll) || 0 : (b.roll || 0);
        return rollA - rollB;
    });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    if (templateId === 'premium') {
        await new Promise<void>((resolve) => {
            root.render(
                <div id="pdf-wrapper">
                    <PremiumResultSheetTemplate 
                        exam={exam} 
                        subjects={subjects} 
                        students={calculatedStudents} 
                        marksData={marksData} 
                        madrasah={madrasah} 
                        lang={lang} 
                    />
                </div>
            );
            setTimeout(resolve, 1200);
        });
        onProgress?.(35);

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const wrapper = container.querySelector('#pdf-wrapper');
        if (wrapper) {
            const pageElements = Array.from(wrapper.querySelectorAll('.pdf-page-container')) as HTMLElement[];
            const pagesToRender = pageElements.length > 0 ? pageElements : (Array.from(wrapper.children).filter(el => el.tagName !== 'STYLE') as HTMLElement[]);

            for (let i = 0; i < pagesToRender.length; i++) {
                const imgData = await toJpeg(pagesToRender[i], {
                    pixelRatio: 2.5,
                    quality: 0.98,
                    backgroundColor: '#ffffff',
                    width: 794,
                    height: 1123,
                    fontEmbedCSS: '',
                });
                if (i > 0) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
                onProgress?.(35 + Math.floor(((i + 1) / pagesToRender.length) * 60));
            }
        }

        onProgress?.(98);
        root.unmount();
        document.body.removeChild(container);

        doc.save(`Premium_Result_${exam.exam_name || 'Class'}.pdf`);
        onProgress?.(100);
        return;
    }

    // Chunk students for multi-page support in classic template
    const STUDENTS_PER_PAGE = 12; 
    const chunks = [];
    for (let i = 0; i < calculatedStudents.length; i += STUDENTS_PER_PAGE) {
        chunks.push(calculatedStudents.slice(i, i + STUDENTS_PER_PAGE));
    }

    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                {chunks.map((chunk, idx) => (
                    <div key={idx} className="pdf-page-break">
                        <ClassResultTemplate exam={exam} subjects={subjects} students={chunk} marksData={marksData} madrasah={madrasah} lang={lang} />
                    </div>
                ))}
            </div>
        );
        setTimeout(resolve, 800);
    });
    onProgress?.(35);

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toJpeg(pages[i] as HTMLElement, {
                pixelRatio: 1.5,
        quality: 0.8,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            onProgress?.(35 + Math.floor(((i + 1) / pages.length) * 60));
        }
    }
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Class_Result_${exam.exam_name}.pdf`);
    onProgress?.(100);
};

// --- CLASS FEE REPORT GENERATOR ---
export const generateClassFeeReportPDF = async (
    className: string,
    month: string,
    students: any[],
    madrasah: any,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(5);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    // Chunk students for multi-page support
    const STUDENTS_PER_PAGE = 19; 
    const chunks = [];
    for (let i = 0; i < students.length; i += STUDENTS_PER_PAGE) {
        chunks.push(students.slice(i, i + STUDENTS_PER_PAGE));
    }

    // Calculate grand totals for the entire set
    const grandTotals = {
        totalPayable: students.reduce((sum, s) => sum + (Number(s.total_payable) || 0), 0),
        totalPaid: students.reduce((sum, s) => sum + (Number(s.total_paid) || 0), 0),
        totalDue: students.reduce((sum, s) => sum + (Number(s.balance_due) || 0), 0),
    };
    onProgress?.(15);

    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                {chunks.map((chunk, idx) => (
                    <div key={idx} className="pdf-page-break">
                        <ClassFeeReportTemplate 
                          className={className} 
                          month={month} 
                          students={chunk} 
                          madrasah={madrasah} 
                          lang={lang} 
                          allTotals={grandTotals}
                          startIndex={idx * STUDENTS_PER_PAGE}
                        />
                    </div>
                ))}
            </div>
        );
        setTimeout(resolve, 800);
    });
    onProgress?.(30);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toJpeg(pages[i] as HTMLElement, {
                pixelRatio: 1.5,
        quality: 0.8,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            onProgress?.(30 + Math.floor(((i + 1) / pages.length) * 65));
        }
    }
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Fee-Report-${className}-${month}.pdf`);
    onProgress?.(100);
};

// --- INDIVIDUAL FEE RECEIPT GENERATOR ---
export const generateFeeReceiptPDF = async (
    student: any,
    month: string,
    madrasah: any,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(10);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    const receiptId = `#REC-${Date.now().toString().slice(-6)}`;
    
    // Convert month string (YYYY-MM) to month name if needed
    let displayMonth = month;
    if (month && month.includes('-')) {
        const [year, monthNum] = month.split('-');
        const monthIndex = parseInt(monthNum) - 1;
        const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
        const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (lang === 'bn') {
            displayMonth = `${monthNamesBn[monthIndex]}, ${year.replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)])}`;
        } else {
            displayMonth = `${monthNamesEn[monthIndex]}, ${year}`;
        }
    }
    
    await new Promise<void>((resolve) => {
        root.render(<FeeReceiptTemplate student={student} month={displayMonth} madrasah={madrasah} lang={lang} receiptId={receiptId} />);
        setTimeout(resolve, 500);
    });
    onProgress?.(40);

    const imgData = await toJpeg(container.firstElementChild as HTMLElement, {
        pixelRatio: 1.5,
        quality: 0.8,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });
    onProgress?.(80);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    onProgress?.(95);
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Receipt-${student.student_name}-${month}.pdf`);
    onProgress?.(100);
};

// --- FINAL RESULT GENERATOR ---
export const generateFinalResultPDF = async (
    title: string,
    className: string,
    subjects: string[],
    students: any[],
    madrasah: any,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(5);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    // Chunk students for multi-page support
    const STUDENTS_PER_PAGE = 12; 
    const chunks = [];
    for (let i = 0; i < students.length; i += STUDENTS_PER_PAGE) {
        chunks.push(students.slice(i, i + STUDENTS_PER_PAGE));
    }

    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                {chunks.map((chunk, idx) => (
                    <div key={idx}>
                        <FinalResultTemplate title={title} className={className} subjects={subjects} students={chunk} madrasah={madrasah} lang={lang} />
                    </div>
                ))}
            </div>
        );
        setTimeout(resolve, 800);
    });
    onProgress?.(25);

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toJpeg(pages[i] as HTMLElement, {
                pixelRatio: 1.5,
        quality: 0.8,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            onProgress?.(25 + Math.floor(((i + 1) / pages.length) * 70));
        }
    }
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Final_Result_${className}.pdf`);
    onProgress?.(100);
};

// --- FINAL INDIVIDUAL MARKSHEET GENERATOR ---
export const generateFinalIndividualResultPDF = async (
    student: any,
    title: string,
    subjects: string[],
    madrasah: any,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(10);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    // Prepare data for ResultSheetTemplate
    // ResultSheetTemplate expects exam object and marks array
    const exam = { exam_name: title };
    
    // marks array: { subject_name, full_marks, pass_marks, marks_obtained, grade, grade_point }
    const marks = subjects.map(sub => {
        const obtained = student.marks[sub];
        const val = parseFloat(obtained) || 0;
        
        // Calculate grade and gp for the weighted mark
        // Usually final result weighted marks are out of their weight, but here we treat them as out of 100 or relative
        // Actually, in FinalResults.tsx, percentage is calculated as (weightedSum / subjectMaxMarks) * 100
        // We'll assume full marks is 100 for display purpose and calculate grade accordingly
        
        let gp = '0.00';
        let grade = 'F';
        if (val >= 80) { gp = '5.00'; grade = 'A+'; }
        else if (val >= 70) { gp = '4.00'; grade = 'A'; }
        else if (val >= 60) { gp = '3.50'; grade = 'A-'; }
        else if (val >= 50) { gp = '3.00'; grade = 'B'; }
        else if (val >= 40) { gp = '2.00'; grade = 'C'; }
        else if (val >= 33) { gp = '1.00'; grade = 'D'; }

        return {
            subject_name: sub,
            full_marks: 100,
            pass_marks: 33,
            marks_obtained: obtained,
            grade: grade,
            grade_point: gp
        };
    });

    // We pass the calculated GPA and Grade into student object so template uses them
    const studentWithFinalData = {
        ...student,
        gpa: student.gpa,
        grade: student.grade,
        merit_position: student.rank
    };

    await new Promise<void>((resolve) => {
        root.render(<ResultSheetTemplate student={studentWithFinalData} exam={exam} marks={marks} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 1500);
    });
    onProgress?.(50);

    const targetEl = (container.querySelector('.pdf-page-container') || container.firstElementChild) as HTMLElement;

    const imgData = await toJpeg(targetEl, {
        pixelRatio: 2,
        quality: 0.95,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });
    onProgress?.(85);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`MarkSheet_${student.student_name || 'Student'}.pdf`);
    onProgress?.(100);
};

// --- ACCOUNTING REPORT GENERATOR ---
export const generateAccountingReportPDF = async (
    madrasah: any,
    period: string,
    stats: any,
    breakdown: any[],
    ledger: any[],
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<AccountingReportTemplate madrasah={madrasah} lang={lang} period={period} stats={stats} breakdown={breakdown} ledger={ledger} />);
        setTimeout(resolve, 800);
    });

    const rootEl = container.firstElementChild as HTMLElement;
    rootEl.style.height = 'auto'; // allow natural expansion
    const scrollHeight = rootEl.scrollHeight;

    const imgData = await toJpeg(rootEl, {
        pixelRatio: 1.5,
        quality: 0.8,
        backgroundColor: '#ffffff',
        width: 794,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const pxToMm = pageWidth / 794;
    const totalPdfHeight = scrollHeight * pxToMm;

    let heightLeft = totalPdfHeight;
    let position = 0;

    doc.addImage(imgData, 'JPEG', 0, position, pageWidth, totalPdfHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position -= pageHeight;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, pageWidth, totalPdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
    }
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Accounting_Report_${period}.pdf`);
};

// --- CLASS ROUTINE GENERATOR ---
export const generateClassRoutinePDF = async (
    madrasah: Institution | null,
    routines: ClassRoutine[],
    classes: Class[],
    days: any[],
    lang: 'en' | 'bn' = 'bn',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(10);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                <RoutinePDFTemplate madrasah={madrasah} routines={routines} classes={classes} days={days} lang={lang} />
            </div>
        );
        setTimeout(resolve, 1000); // Give time for images to load
    });
    onProgress?.(30);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper) {
        const pageContainers = wrapper.querySelectorAll('.pdf-page-container');
        
        let pageAdded = false;
        for (let i = 0; i < pageContainers.length; i++) {
            const pageElement = pageContainers[i] as HTMLElement;

            const imgData = await toJpeg(pageElement, {
                pixelRatio: 1.5,
                quality: 0.8,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
            });

            if (pageAdded) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            pageAdded = true;
            onProgress?.(30 + Math.floor(((i + 1) / pageContainers.length) * 65));
        }
    }
    
    onProgress?.(98);
    doc.save(`${madrasah?.name || 'Madrasah'}_Class_Routine.pdf`);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};

export const generateMasterClassRoutinePDF = async (
    madrasah: Institution | null,
    routines: ClassRoutine[],
    classes: Class[],
    days: any[],
    lang: 'en' | 'bn' = 'bn',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(10);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                <MasterRoutinePDFTemplate madrasah={madrasah} routines={routines} classes={classes} days={days} lang={lang} />
            </div>
        );
        setTimeout(resolve, 1500);
    });
    onProgress?.(40);

    const doc = new jsPDF('l', 'mm', 'a4'); // LANDSCAPE
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper) {
        const pageElement = wrapper.querySelector('.pdf-page-container') as HTMLElement;
        if (pageElement) {
            const imgData = await toJpeg(pageElement, {
                pixelRatio: 2,
                quality: 0.95,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            onProgress?.(85);
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    }
    
    onProgress?.(98);
    doc.save(`${madrasah?.name || 'Madrasah'}_Master_Routine.pdf`);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};

// --- EXAM ROUTINE GENERATOR ---
export const generateExamRoutinePDF = async (
    madrasah: Institution | null,
    examName: string,
    routineData: any[],
    lang: 'en' | 'bn' = 'bn',
    options?: {
      routineSelectionMode?: 'all' | 'class';
      selectedRoutineClassId?: string;
      classesList?: any[];
      routineMorningTime?: string;
      routineAfternoonTime?: string;
      routineInstructions?: string[];
      routinePrincipalName?: string;
      routinePrincipalMobile?: string;
      showRoutineAfternoon?: boolean;
      examYear?: string;
      themeColor?: string;
    },
    onProgress?: (progress: number) => void
) => {
    onProgress?.(10);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                <ExamRoutinePDFTemplate 
                    madrasah={madrasah} 
                    examName={examName} 
                    routineData={routineData} 
                    lang={lang} 
                    {...options}
                />
            </div>
        );
        setTimeout(resolve, 1500); 
    });
    onProgress?.(40);

    const isLandscape = true;
    
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper) {
        const pageElement = wrapper.querySelector('.pdf-page-container') as HTMLElement;
        if (pageElement) {
            const imgData = await toJpeg(pageElement, {
                pixelRatio: 2,
                quality: 0.95,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            onProgress?.(85);
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    }
    
    onProgress?.(98);
    doc.save(`${madrasah?.name || 'Madrasah'}_Exam_Routine.pdf`);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};

// --- STUDENT LIST GENERATOR ---
export const generateStudentListPDF = async (
    students: any[],
    madrasah: any,
    className?: string,
    lang: 'en' | 'bn' = 'en',
    onProgress?: (progress: number) => void
) => {
    onProgress?.(5);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                <StudentListTemplate 
                  students={students} 
                  madrasah={madrasah} 
                  className={className} 
                  lang={lang} 
                />
            </div>
        );
        setTimeout(resolve, 1500); 
    });
    onProgress?.(25);

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toPng(pages[i] as HTMLElement, {
                pixelRatio: 2.5,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            onProgress?.(25 + Math.floor(((i + 1) / pages.length) * 70));
        }
    }
    
    onProgress?.(98);
    doc.save(`Student_List_${className || 'All'}.pdf`);
    root.unmount();
    document.body.removeChild(container);
    onProgress?.(100);
};
