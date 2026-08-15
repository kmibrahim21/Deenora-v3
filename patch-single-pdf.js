import fs from 'fs';
const file = 'src/utils/pdfGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const newFunc = `export const generateResultPDF = async (
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
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\\n');
    
    const htmlContent = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        \${styles}
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
        \${targetEl.innerHTML}
    </body>
    </html>
    \`;

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
        a.download = \`Result_\${student.student_name || student.name || 'Student'}.pdf\`;
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
};`;

content = content.replace(/export const generateResultPDF = async \([\s\S]*?onProgress\?\.\(100\);\n};/, newFunc);

fs.writeFileSync(file, content);
console.log('Replaced generateResultPDF');
