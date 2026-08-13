const fs = require('fs');
const files = [
  'src/components/finance/SchoolFeeEngine.tsx',
  'src/components/finance/QawmiFeeEngine.tsx',
  'src/components/finance/StudentAccountingDetail.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the sequence of invalidations with a comprehensive list
  const regex = /await requestManager\.invalidatePattern\(`fees:\$\{madrasah\.id\}`\);[\s\S]*?clearGlobalSchoolFeeCache\(\);/g;
  
  const replacement = `await requestManager.invalidatePattern(\`fees:\$\{madrasah.id\}\`);
      await requestManager.invalidatePattern(\`all_fees:\$\{madrasah.id\}\`);
      await requestManager.invalidatePattern(\`all_fees_qawmi:\$\{madrasah.id\}\`);
      await requestManager.invalidatePattern(\`stats:\$\{madrasah.id\}\`);
      await requestManager.invalidatePattern(\`dashboard_\`);
      if (typeof currentStudent !== 'undefined' && currentStudent?.student_id) {
          await requestManager.invalidatePattern(\`accounting-fees-\$\{currentStudent.student_id\}\`);
          await requestManager.invalidatePattern(\`accounting-history-\$\{currentStudent.student_id\}\`);
      } else if (typeof student !== 'undefined' && student?.student_id) {
          await requestManager.invalidatePattern(\`accounting-fees-\$\{student.student_id\}\`);
          await requestManager.invalidatePattern(\`accounting-history-\$\{student.student_id\}\`);
      }
      await requestManager.invalidatePattern(\`fetch:ledger:\`);
      
      clearGlobalSchoolFeeCache();`;

  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
}
console.log("Done");
