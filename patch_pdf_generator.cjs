const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfGenerator.tsx', 'utf8');

// For ClassResultPDF
// Replace sorting logic
content = content.replace(
  "if ((resultSystem === 'grading' || resultSystem === 'grading_optional' || resultSystem === 'high_school') && !a._hasFailed && !b._hasFailed) {\n            const gpaDiff = parseFloat(b._gpa || '0') - parseFloat(a._gpa || '0');\n            if (Math.abs(gpaDiff) > 0.001) return gpaDiff;\n        }",
  "" // Remove GPA sorting
);
// Replace tie logic
content = content.replace(
  "prev._hasFailed === std._hasFailed &&\n                prev._gpa === std._gpa &&\n                Math.abs((Number(prev._total) || 0) - (Number(std._total) || 0)) < 0.001",
  "prev._hasFailed === std._hasFailed &&\n                Math.abs((Number(prev._total) || 0) - (Number(std._total) || 0)) < 0.001"
);


fs.writeFileSync('src/utils/pdfGenerator.tsx', content);
console.log("Patched successfully");
