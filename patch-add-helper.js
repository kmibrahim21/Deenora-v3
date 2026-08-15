import fs from 'fs';
const file = 'src/utils/pdfGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const helper = `
export const generatePdfViaServer = async (
    htmlBody: string,
    filename: string,
    options: {
        format?: 'A4' | 'Letter' | 'Legal',
        landscape?: boolean,
        margin?: { top: string, right: string, bottom: string, left: string },
        customStyles?: string
    } = {}
) => {
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\\n');
    
    const htmlContent = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        \${styles}
        <style>
            @page { size: \${options.format || 'A4'} \${options.landscape ? 'landscape' : 'portrait'}; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            .pdf-page-wrapper {
                width: \${options.landscape ? '297mm' : '210mm'};
                height: \${options.landscape ? '210mm' : '297mm'};
                overflow: hidden;
                box-sizing: border-box;
                position: relative;
                page-break-after: always;
                page-break-inside: avoid;
            }
            .pdf-page-wrapper:last-child {
                page-break-after: auto;
            }
            \${options.customStyles || ''}
        </style>
    </head>
    <body class="light">
        \${htmlBody}
    </body>
    </html>
    \`;

    try {
        const response = await fetch('/api/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: htmlContent,
                format: options.format || 'A4',
                landscape: !!options.landscape,
                margin: options.margin || { top: '0', right: '0', bottom: '0', left: '0' }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to generate PDF on server');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Server PDF Error:', err);
        throw err;
    }
};
`;

if (!content.includes('generatePdfViaServer')) {
    content = content.replace(/(import .*?\n)+/, match => match + helper + '\n');
    fs.writeFileSync(file, content);
    console.log('Added helper');
} else {
    console.log('Helper already exists');
}
