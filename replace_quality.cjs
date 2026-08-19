const fs = require('fs');
let code = fs.readFileSync('src/utils/pdfGenerator.tsx', 'utf-8');

const targetStr = `                imgData = await toJpeg(receiptEl, {
            pixelRatio: 2,
            quality: 0.9,`;

const replacementStr = `                imgData = await toJpeg(receiptEl, {
            pixelRatio: 3,
            quality: 1.0,`;

if (code.includes(targetStr)) {
  fs.writeFileSync('src/utils/pdfGenerator.tsx', code.replace(targetStr, replacementStr));
  console.log('Replaced successfully');
} else {
  console.log('Target string not found');
}
