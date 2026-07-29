const fs = require('fs');
let content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

content = content.replace(
  "setDownloadAction(() => (l: 'en' | 'bn', tId?: 'classic' | 'premium') => handleDownloadMassMarksheets(l, tId));",
  "setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadMassMarksheets(l, 'classic'));"
);

fs.writeFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', content);
console.log("Patched successfully");
