import fs from 'fs';
const file = 'src/utils/pdfGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const newFunc = `export const generateMassMarksheetPDF = async (
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
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\\n');
        
        let htmlContent = \`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            \${styles}
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
        \`;
        
        for (let i = 0; i < pages.length; i += 2) {
            const leftPage = pages[i].outerHTML;
            const rightPage = pages[i + 1] ? pages[i + 1].outerHTML : '';
            
            htmlContent += \`
            <div class="pdf-landscape-page">
                <div class="pdf-marksheet-half">\${leftPage}</div>
                <div class="pdf-marksheet-half">\${rightPage}</div>
            </div>
            \`;
        }
        
        htmlContent += \`</body></html>\`;

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
            a.download = \`Mass_Marksheets_\${exam.exam_name || 'All'}.pdf\`;
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
};`;

content = content.replace(/export const generateMassMarksheetPDF = async \([\s\S]*?onProgress\?\.\(100\);\n};/, newFunc);

fs.writeFileSync(file, content);
console.log('Replaced generateMassMarksheetPDF');
