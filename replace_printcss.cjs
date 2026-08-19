const fs = require('fs');
let code = fs.readFileSync('src/utils/pdfGenerator.tsx', 'utf-8');

const targetStr = `                    @page { 
                        margin: \${paperSize === '58mm' || paperSize === '80mm' ? '0' : '0.5cm'}; 
                        size: portrait;
                    }`;

const replacementStr = `                    @page { 
                        margin: \${paperSize === '58mm' || paperSize === '80mm' ? '0' : '0.5cm'}; 
                        \${paperSize === '58mm' ? 'size: 58mm auto;' : paperSize === '80mm' ? 'size: 80mm auto;' : 'size: portrait;'}
                    }`;

if (code.includes(targetStr)) {
  fs.writeFileSync('src/utils/pdfGenerator.tsx', code.replace(targetStr, replacementStr));
  console.log('Replaced successfully');
} else {
  console.log('Target string not found');
}
