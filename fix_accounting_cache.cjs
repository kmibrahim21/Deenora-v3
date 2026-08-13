const fs = require('fs');
const file = 'src/pages/Accounting.tsx';

let content = fs.readFileSync(file, 'utf8');

// Replace the sequence of invalidations with a comprehensive list
const regex = /requestManager\.invalidatePattern\(`fees:\$\{madrasah\.id\}`\);\s*requestManager\.invalidatePattern\(`accounting-history`\);\s*clearGlobalSchoolFeeCache\(\);\s*clearGlobalQawmiFeeCache\(\);/g;

const replacement = `requestManager.invalidatePattern(\`fees:\$\{madrasah.id\}\`);
      requestManager.invalidatePattern(\`all_fees:\$\{madrasah.id\}\`);
      requestManager.invalidatePattern(\`all_fees_qawmi:\$\{madrasah.id\}\`);
      requestManager.invalidatePattern(\`accounting-history\`);
      requestManager.invalidatePattern(\`fetch:ledger:\`);
      clearGlobalSchoolFeeCache();
      clearGlobalQawmiFeeCache();`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log("Done");
