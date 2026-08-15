const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfGenerator.tsx', 'utf8');

// I will rewrite `generateResultPDF` back to its jsPDF form.
const origResult = `export const generateResultPDF = async (
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
            );
        } else {
            root.render(<ResultSheetTemplate student={student} exam={exam} marks={marks} madrasah={madrasah} lang={lang} />);
        }
        setTimeout(resolve, 1500); // Increased timeout for font loading
    });

    onProgress?.(50);

    const targetEl = (container.querySelector('.pdf-page-container') || container.firstElementChild) as HTMLElement;
    const imgData = await toPng(targetEl, {
        pixelRatio: 3, // High quality for print
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    onProgress?.(85);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'SLOW');
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    await doc.save(\`Result_\${student.student_name || student.name || 'Student'}.pdf\`);
    onProgress?.(100);
};`;

// Also `generateMassMarksheetPDF`
const origMass = `export const generateMassMarksheetPDF = async (
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
                    <div key={idx} className="pdf-page-container">
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
        setTimeout(resolve, 1500);
    });

    onProgress?.(15);

    // We want 2 A4 portraits on 1 A4 landscape page.
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth(); // 297
    const pageHeight = doc.internal.pageSize.getHeight(); // 210
    
    const wrapper = container.querySelector('#pdf-wrapper');
    if (wrapper && wrapper.children.length > 0) {
        const pages = Array.from(wrapper.children);
        
        for (let i = 0; i < pages.length; i++) {
            const pageElement = (pages[i].querySelector('.pdf-page-container') || pages[i]) as HTMLElement;
            
            const imgData = await toPng(pageElement, {
                pixelRatio: 3,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
            });
            
            const isLeft = (i % 2 === 0);
            
            // Add a new page for every two students (except the first one)
            if (i > 0 && isLeft) {
                doc.addPage();
            }
            
            // A4 landscape width is 297. Half of that is 148.5
            const hw = pageWidth / 2;
            doc.addImage(imgData, 'PNG', isLeft ? 0 : hw, 0, hw, pageHeight, undefined, 'SLOW');
            onProgress?.(15 + Math.floor(((i + 1) / pages.length) * 80));
        }
    }
    
    onProgress?.(98);
    root.unmount();
    document.body.removeChild(container);
    
    await doc.save(\`Mass_Marksheets_\${exam.exam_name || 'All'}.pdf\`);
    onProgress?.(100);
};`;

content = content.replace(/export const generateResultPDF = async \([\s\S]*?onProgress\?\.\(100\);\n};/, origResult);
content = content.replace(/export const generateMassMarksheetPDF = async \([\s\S]*?onProgress\?\.\(100\);\n};/, origMass);
fs.writeFileSync('src/utils/pdfGenerator.tsx', content);
console.log('Reverted to jsPDF flows for Result and Mass Marksheet.');
