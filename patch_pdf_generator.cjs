const fs = require('fs');
let code = fs.readFileSync('src/utils/pdfGenerator.tsx', 'utf8');

code = code.replace(/if \(msgClass.includes\('syllabus'\)\)/g, "if (msgClass.includes('syllabus') || msgClass.includes('suggestion'))");
code = code.replace(/fileName = \(messageData.class_name \|\| ''\)\.toLowerCase\(\)\.includes\('syllabus'\) \? 'Syllabus' :/g, "fileName = (messageData.class_name || '').toLowerCase().includes('suggestion') ? 'Suggestion' : (messageData.class_name || '').toLowerCase().includes('syllabus') ? 'Syllabus' :");

fs.writeFileSync('src/utils/pdfGenerator.tsx', code);
