const fs = require('fs');
let code = fs.readFileSync('src/components/pdf/SyllabusPDFTemplate.tsx', 'utf8');

const isSuggestion = `const isSuggestion = (syllabus.class_name || '').toLowerCase().includes('suggestion');`;
code = code.replace(/const className = syllabus.class_name/g, isSuggestion + '\n  const className = syllabus.class_name');

code = code.replace(/পাঠ্যক্রম ও পরীক্ষার সিলেবাস \(SYLLABUS\)/g, `{isSuggestion ? 'পরীক্ষার সাজেশন (SUGGESTION)' : 'পাঠ্যক্রম ও পরীক্ষার সিলেবাস (SYLLABUS)'}`);

fs.writeFileSync('src/components/pdf/SyllabusPDFTemplate.tsx', code);
