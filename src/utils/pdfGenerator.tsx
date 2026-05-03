import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, Student, ExamSubject, Institution, SeatAssignment } from '../types';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { ResultSheetTemplate } from '../components/pdf/ResultSheetTemplate';
import { ClassResultTemplate } from '../components/pdf/ClassResultTemplate';
import { ClassFeeReportTemplate } from '../components/pdf/ClassFeeReportTemplate';
import { FeeReceiptTemplate } from '../components/pdf/FeeReceiptTemplate';
import { FinalResultTemplate } from '../components/pdf/FinalResultTemplate';
import { SeatPlanTemplate } from '../components/pdf/SeatPlanTemplate';
import { AttendanceReportTemplate } from '../components/pdf/AttendanceReportTemplate';
import { AccountingReportTemplate } from '../components/pdf/AccountingReportTemplate';

let bengaliFontBase64: string | null = null;

const loadBengaliFont = async (doc: jsPDF) => {
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
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            bengaliFontBase64 = window.btoa(binary);
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

// Helper: Load Image
const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
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
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<AttendanceReportTemplate reportData={reportData} madrasah={madrasah} className={className} month={month} lang={lang} />);
        setTimeout(resolve, 800); 
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    if (container.children.length > 0) {
        const pages = Array.from(container.children).filter(el => el.tagName !== 'STYLE');
        
        for (let i = 0; i < pages.length; i++) {
            const pageElement = pages[i] as HTMLElement;
            
            const imgData = await toPng(pageElement, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: 794, 
                height: 1123, 
            });

            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    }
    
    doc.save(`Attendance_Report_${className}_${month}.pdf`);
    root.unmount();
    document.body.removeChild(container);
};
// --- SEAT PLAN GENERATOR ---
export const generateSeatPlanPDF = async (
    assignments: any[],
    madrasah: { name: string },
    templateId: string = 'list',
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<SeatPlanTemplate assignments={assignments} madrasah={madrasah} templateId={templateId} lang={lang} />);
        setTimeout(resolve, 500); // Give more time for fonts/images
    });

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
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: 794, // A4 width at 96 DPI
                height: 1123, // A4 height at 96 DPI
            });

            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    } else {
        // Fallback if structure is different
        const imgData = await toPng(container.firstElementChild as HTMLElement, {
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });
        doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`seat-plan-${templateId}.pdf`);
};

// --- RESULT GENERATOR ---
export const generateResultPDF = async (
    student: any,
    exam: any,
    marks: any[],
    madrasah: { name: string; logo_url?: string; address?: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<ResultSheetTemplate student={student} exam={exam} marks={marks} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 800);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Result_${student.student_name}.pdf`);
};

// --- CLASS RESULT GENERATOR ---
export const generateClassResultPDF = async (
    exam: any,
    subjects: any[],
    students: any[],
    marksData: any,
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    // Pre-calculate totals, GPA, rank
    const calculatedStudents = students.map(student => {
        const studentMarks = marksData[student.id] || {};
        let total = 0;
        let totalPossible = 0;
        let hasFailed = false;

        subjects.forEach(s => {
            const m = studentMarks[s.id];
            const fullMarkValue = Number(s.full_marks || 100);
            const passMarkValue = Number(s.pass_marks || 33);
            totalPossible += fullMarkValue;

            if (m !== undefined && m !== '') {
                const markVal = Number(m);
                total += markVal;
                if (markVal < passMarkValue) hasFailed = true;
            } else {
                hasFailed = true;
            }
        });
        
        const avgPercentage = totalPossible > 0 ? (total / totalPossible) * 100 : 0;
        
        let gpa = '0.00';
        let grade = 'F';
        if (!hasFailed) {
            if (avgPercentage >= 80) { gpa = '5.00'; grade = 'A+'; }
            else if (avgPercentage >= 70) { gpa = '4.00'; grade = 'A'; }
            else if (avgPercentage >= 60) { gpa = '3.50'; grade = 'A-'; }
            else if (avgPercentage >= 50) { gpa = '3.00'; grade = 'B'; }
            else if (avgPercentage >= 40) { gpa = '2.00'; grade = 'C'; }
            else if (avgPercentage >= 33) { gpa = '1.00'; grade = 'D'; }
        }

        return {
            ...student,
            _total: total,
            _avg: avgPercentage.toFixed(2),
            _gpa: gpa,
            _grade: grade,
            _hasFailed: hasFailed
        };
    });

    // Sort by rank logic
    calculatedStudents.sort((a, b) => {
        if (a._hasFailed && !b._hasFailed) return 1;
        if (!a._hasFailed && b._hasFailed) return -1;
        return b._total - a._total; // Highest total first
    });

    let currentRank = 1;
    calculatedStudents.forEach((std, index) => {
        if (index > 0) {
            const prev = calculatedStudents[index - 1];
            if (prev._hasFailed === std._hasFailed && prev._total === std._total) {
                std._rank = prev._rank;
            } else {
                std._rank = currentRank;
            }
        } else {
            std._rank = currentRank;
        }
        currentRank++;
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
    
    // Chunk students for multi-page support
    const STUDENTS_PER_PAGE = 15; 
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

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toPng(pages[i] as HTMLElement, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    }
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Class_Result_${exam.exam_name}.pdf`);
};

// --- CLASS FEE REPORT GENERATOR ---
export const generateClassFeeReportPDF = async (
    className: string,
    month: string,
    students: any[],
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    // Chunk students for multi-page support
    const STUDENTS_PER_PAGE = 18; // Portrait has more space vertically
    const chunks = [];
    for (let i = 0; i < students.length; i += STUDENTS_PER_PAGE) {
        chunks.push(students.slice(i, i + STUDENTS_PER_PAGE));
    }

    await new Promise<void>((resolve) => {
        root.render(
            <div id="pdf-wrapper">
                {chunks.map((chunk, idx) => (
                    <div key={idx} className="pdf-page-break">
                        <ClassFeeReportTemplate className={className} month={month} students={chunk} madrasah={madrasah} lang={lang} />
                    </div>
                ))}
            </div>
        );
        setTimeout(resolve, 800);
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toPng(pages[i] as HTMLElement, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    }
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Fee-Report-${className}-${month}.pdf`);
};

// --- INDIVIDUAL FEE RECEIPT GENERATOR ---
export const generateFeeReceiptPDF = async (
    student: any,
    month: string,
    madrasah: { name: string; address?: string; phone?: string; logo_url?: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<FeeReceiptTemplate student={student} month={month} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Receipt-${student.student_name}-${month}.pdf`);
};

// --- FINAL RESULT GENERATOR ---
export const generateFinalResultPDF = async (
    title: string,
    className: string,
    subjects: string[],
    students: any[],
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    // Chunk students for multi-page support
    const STUDENTS_PER_PAGE = 15; 
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

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        for (let i = 0; i < pages.length; i++) {
            const imgData = await toPng(pages[i] as HTMLElement, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: 1123,
                height: 794,
            });
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    }
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Final_Result_${className}.pdf`);
};

// --- ACCOUNTING REPORT GENERATOR ---
export const generateAccountingReportPDF = async (
    madrasah: { name: string },
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

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Accounting_Report_${period}.pdf`);
};
