const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

// Add suggestion tab to activeTab state
code = code.replace(/useState\<'messages' \| 'notices' \| 'syllabus'\>\('messages'\);/g, "useState<'messages' | 'notices' | 'syllabus' | 'suggestion'>('messages');");

// Add showSuggestionModal state
code = code.replace(/const \[showSyllabusModal, setShowSyllabusModal\] = useState\(false\);/g, "const [showSyllabusModal, setShowSyllabusModal] = useState(false);\n  const [showSuggestionModal, setShowSuggestionModal] = useState(false);");

// Add suggestionList
code = code.replace(/const syllabusList = parsedMessages.filter\(m => m.class_name\?.startsWith\('APP_SYLLABUS_'\)\);/g, "const syllabusList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SYLLABUS_'));\n  const suggestionList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SUGGESTION_'));");

// Duplicate syllabus states for suggestion
code = code.replace(/const \[syllabusSession, setSyllabusSession\] = useState\('2025-26'\);/g, "const [syllabusSession, setSyllabusSession] = useState('2025-26');\n  const [suggestionTitle, setSuggestionTitle] = useState('');\n  const [suggestionClass, setSuggestionClass] = useState('');\n  const [suggestionExam, setSuggestionExam] = useState('');\n  const [suggestionSession, setSuggestionSession] = useState('2025-26');\n  const [suggestionSubjectList, setSuggestionSubjectList] = useState([\n    { subject: 'বাংলা', details: '' }\n  ]);");

fs.writeFileSync('src/pages/Messages.tsx', code);
