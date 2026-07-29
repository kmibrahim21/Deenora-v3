const fs = require('fs');
let content = fs.readFileSync('src/components/results/engines/school/FinalResults.tsx', 'utf8');

// Replace sorting logic in FinalResults
content = content.replace(
  "if (!failedA && !failedB && (resultSystem === 'grading' || resultSystem === 'grading_optional' || resultSystem === 'high_school')) {\n          const gpaDiff = parseFloat(b.gpa) - parseFloat(a.gpa);\n          if (Math.abs(gpaDiff) > 0.001) return gpaDiff;\n        }",
  "// Removed GPA sort to prioritize total marks"
);
// Replace tie logic in FinalResults
content = content.replace(
  "const isTie = (\n            failedPrev === failedP &&\n            prev.gpa === p.gpa &&\n            Math.abs(parseFloat(prev.total) - parseFloat(p.total)) < 0.001\n          );",
  "const isTie = (\n            failedPrev === failedP &&\n            Math.abs(parseFloat(prev.total) - parseFloat(p.total)) < 0.001\n          );"
);

fs.writeFileSync('src/components/results/engines/school/FinalResults.tsx', content);
console.log("Patched successfully");
