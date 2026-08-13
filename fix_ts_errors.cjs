const fs = require('fs');

const fixSchool = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/if \(typeof currentStudent !== 'undefined'[\s\S]*?\}\n/g, `const sId = typeof feeData !== 'undefined' ? feeData.student_id : (typeof selectedStudent !== 'undefined' ? selectedStudent?.student_id : null);\n      if (sId) {\n          await requestManager.invalidatePattern(\`accounting-fees-\$\{sId\}\`);\n          await requestManager.invalidatePattern(\`accounting-history-\$\{sId\}\`);\n      }\n`);
  fs.writeFileSync(file, content);
};

fixSchool('src/components/finance/SchoolFeeEngine.tsx');
fixSchool('src/components/finance/QawmiFeeEngine.tsx');

const fixStudent = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/if \(typeof currentStudent !== 'undefined'[\s\S]*?\}\n/g, `if (student?.student_id) {\n          await requestManager.invalidatePattern(\`accounting-fees-\$\{student.student_id\}\`);\n          await requestManager.invalidatePattern(\`accounting-history-\$\{student.student_id\}\`);\n      }\n`);
  fs.writeFileSync(file, content);
};

fixStudent('src/components/finance/StudentAccountingDetail.tsx');

console.log("Done");
