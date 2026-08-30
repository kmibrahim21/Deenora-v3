const fs = require('fs');
let code = fs.readFileSync('api/parents.ts', 'utf8');

const suggestionLogic = `          // 2. Syllabus type (APP_SYLLABUS_...)
          if (msgClass.startsWith('APP_SYLLABUS_')) {
            const syllabusClass = msgClass.replace('APP_SYLLABUS_', '').trim();
            return isForStudentClass(syllabusClass);
          }
          if (msgClass.startsWith('APP_SUGGESTION_')) {
            const suggestionClass = msgClass.replace('APP_SUGGESTION_', '').trim();
            return isForStudentClass(suggestionClass);
          }`;

code = code.replace(/\/\/ 2\. Syllabus type \(APP_SYLLABUS_\.\.\.\)[\s\S]*?return isForStudentClass\(syllabusClass\);\n          }/, suggestionLogic);

fs.writeFileSync('api/parents.ts', code);
