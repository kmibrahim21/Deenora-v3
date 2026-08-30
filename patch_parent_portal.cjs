const fs = require('fs');
let code = fs.readFileSync('src/pages/ParentPortal.tsx', 'utf8');

// Update activeNoticeTab state
code = code.replace(/useState\<'notice' \| 'diary' \| 'syllabus' \| 'routine'\>\('notice'\);/g, "useState<'notice' | 'diary' | 'syllabus' | 'suggestion' | 'routine'>('notice');");

// Update notice tabs UI
code = code.replace(/\{\s*id:\s*'syllabus',\s*label:\s*'সিলেবাস',\s*icon:\s*BookOpen\s*\}/g, "{ id: 'syllabus', label: 'সিলেবাস', icon: BookOpen },\n                    { id: 'suggestion', label: 'সাজেশন', icon: BookOpen }");

// Update filtering logic
const suggestionFilterCode = `
                  if (activeNoticeTab === 'suggestion') {
                    if (!lowerMsgClass.startsWith('app_suggestion_')) return false;
                    const target = msgClass.replace(/^APP_SUGGESTION_/i, '').trim();
                    return isClassMatch(target);
                  }
`;
code = code.replace(/if \(activeNoticeTab === 'syllabus'\) \{/g, suggestionFilterCode + "\n                  if (activeNoticeTab === 'syllabus') {");

// Update background colors
code = code.replace(/activeNoticeTab === 'diary' \? 'bg-blue-500' : 'bg-blue-500'/g, "activeNoticeTab === 'diary' ? 'bg-blue-500' : activeNoticeTab === 'suggestion' ? 'bg-emerald-500' : 'bg-blue-500'");
code = code.replace(/'bg-blue-50 border-blue-100 text-blue-600'/g, "activeNoticeTab === 'suggestion' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'");
code = code.replace(/activeNoticeTab === 'diary' \? <BookOpen size=\{20\} \/> : <MessageSquare size=\{20\} \/>/g, "activeNoticeTab === 'diary' ? <BookOpen size={20} /> : activeNoticeTab === 'suggestion' ? <BookOpen size={20} /> : <MessageSquare size={20} />");
code = code.replace(/'bg-blue-100\/50 border-blue-200 text-blue-700'/g, "activeNoticeTab === 'suggestion' ? 'bg-emerald-100/50 border-emerald-200 text-emerald-700' : 'bg-blue-100/50 border-blue-200 text-blue-700'");

fs.writeFileSync('src/pages/ParentPortal.tsx', code);
