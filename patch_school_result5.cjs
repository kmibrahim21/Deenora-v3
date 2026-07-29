const fs = require('fs');
let content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

// Replace sorting logic in fetchRanking
content = content.replace(
  "// If both passed and grading system, sort by GPA first\n        if ((resultSystem === 'grading' || resultSystem === 'grading_optional' || resultSystem === 'high_school') && a.pass_status && b.pass_status) {\n           const gpaDiff = parseFloat(b.gpa) - parseFloat(a.gpa);\n           if (Math.abs(gpaDiff) > 0.001) return gpaDiff;\n        }",
  "// Removed GPA sort to prioritize total marks"
);
// Replace tie logic in fetchRanking
content = content.replace(
  "const isTie = (\n            prev.pass_status === item.pass_status &&\n            prev.gpa === item.gpa &&\n            Math.abs(prev.total_marks - item.total_marks) < 0.001\n          );",
  "const isTie = (\n            prev.pass_status === item.pass_status &&\n            Math.abs(prev.total_marks - item.total_marks) < 0.001\n          );"
);

fs.writeFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', content);
console.log("Patched successfully");
