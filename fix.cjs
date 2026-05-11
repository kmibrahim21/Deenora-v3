const fs = require('fs');

const data = fs.readFileSync('src/utils/pdfGenerator.tsx', 'utf8');

// Replace toPng with toJpeg
let newData = data.replace(/import \{ toPng \}/g, 'import { toJpeg }');
newData = newData.replace(/toPng\(/g, 'toJpeg(');

// Add quality setting after pixelRatio in all html-to-image options
newData = newData.replace(/pixelRatio: 2,/g, 'pixelRatio: 1.5,\n        quality: 0.8,');

// Change PNG to JPEG in jsPDF addImage
newData = newData.replace(/'PNG',/g, "'JPEG',");

fs.writeFileSync('src/utils/pdfGenerator.tsx', newData, 'utf8');
console.log("PDF Generator optimized to JPEG");
