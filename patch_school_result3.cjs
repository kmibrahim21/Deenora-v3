const fs = require('fs');
let content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

// The file currently has:
// {downloadActionType === 'result-sheet' && (
// <>
//                       <div className="mb-6 space-y-2 text-left">
// ...
//                       </div>
//
//                       )}

content = content.replace(
  "{downloadActionType === 'result-sheet' && (\n<>\n                      <div className=\"mb-6 space-y-2 text-left\">",
  "{downloadActionType === 'result-sheet' && (\n                      <div className=\"mb-6 space-y-2 text-left\">"
);

fs.writeFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', content);
console.log("Patched successfully");
