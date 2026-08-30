const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

// Mobile layout fix: max-w-7xl mx-auto px-4 md:px-8 pt-6 -> max-w-7xl mx-auto px-2 sm:px-4 md:px-8 pt-6
code = code.replace(/px-4 md:px-8 pt-6/g, "px-2 sm:px-4 md:px-8 pt-6");

// Add suggestion tab to activeTab state
code = code.replace(/useState\<'messages' \| 'notices' \| 'syllabus'\>\('messages'\);/g, "useState<'messages' | 'notices' | 'syllabus' | 'suggestion'>('messages');");

// Add showSuggestionModal state
code = code.replace(/const \[showSyllabusModal, setShowSyllabusModal\] = useState\(false\);/g, "const [showSyllabusModal, setShowSyllabusModal] = useState(false);\n  const [showSuggestionModal, setShowSuggestionModal] = useState(false);");

// Add suggestionList
code = code.replace(/const syllabusList = parsedMessages.filter\(m => m.class_name\?.startsWith\('APP_SYLLABUS_'\)\);/g, "const syllabusList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SYLLABUS_'));\n  const suggestionList = parsedMessages.filter(m => m.class_name?.startsWith('APP_SUGGESTION_'));");

// Duplicate syllabus states for suggestion
code = code.replace(/const \[syllabusSession, setSyllabusSession\] = useState\('2025-26'\);/g, "const [syllabusSession, setSyllabusSession] = useState('2025-26');\n  const [suggestionTitle, setSuggestionTitle] = useState('');\n  const [suggestionClass, setSuggestionClass] = useState('');\n  const [suggestionExam, setSuggestionExam] = useState('');\n  const [suggestionSession, setSuggestionSession] = useState('2025-26');\n  const [suggestionSubjectList, setSuggestionSubjectList] = useState([\n    { subject: 'বাংলা', details: '' }\n  ]);");

// Top-level tabs
code = code.replace(/<BookOpen size={18} \/><span>\{lang === 'bn' \? 'সিলেবাস' : 'Syllabus'\}<\/span>\n\s*<\/button>/g, `<BookOpen size={18} /><span>{lang === 'bn' ? 'সিলেবাস' : 'Syllabus'}</span>
        </button>
        <button onClick={() => setActiveTab('suggestion')} className={\`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all \${activeTab === 'suggestion' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}\`}>
           <BookOpen size={18} /><span>{lang === 'bn' ? 'সাজেশন' : 'Suggestion'}</span>
        </button>`);

fs.writeFileSync('src/pages/Messages.tsx', code);
