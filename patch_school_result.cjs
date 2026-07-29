const fs = require('fs');
const content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

// The div ends right before: <div className="space-y-2.5">
const templateRegex = /(\{\/\* Template Options \*\/\}[\s\S]*?)<div className="space-y-2\.5">/;
const updated = content.replace(templateRegex, "{downloadActionType === 'result-sheet' && (\n$1)}\n<div className=\"space-y-2.5\">");

fs.writeFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', updated);
console.log("Patched successfully");
