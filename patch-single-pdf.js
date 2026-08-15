import fs from 'fs';
const file = 'src/utils/pdfGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const htmlContent = `([\s\S]*?)`;/;

const newHtmlContent = `const htmlContent = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        \${styles}
        <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; overflow: hidden; }
            #pdf-wrapper {
                width: 210mm;
                height: 297mm;
                background: white;
                overflow: hidden;
                box-sizing: border-box;
            }
            .pdf-page-container {
                width: 794px;
                height: 1123px;
                transform-origin: top left;
                transform: scale(calc(210 / 210)); /* Adjust if needed */
            }
        </style>
    </head>
    <body class="light">
        \${targetEl.innerHTML}
    </body>
    </html>
    \`;`;

content = content.replace(regex, newHtmlContent);
fs.writeFileSync(file, content);
console.log('Fixed blank page issue');
