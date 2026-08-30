const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

const suggestionEditBlock = `
    } else if (item.class_name.startsWith('APP_SUGGESTION_')) {
      setSuggestionTitle(item.title);
      setSuggestionClass(item.class_name.replace('APP_SUGGESTION_', ''));
      setSuggestionSession(item.parsedMessage?.session || '2025-26');
      setSuggestionExam(item.parsedMessage?.exam || '');
      setSuggestionSubjectList(item.parsedMessage?.subjects || []);
      setShowSuggestionModal(true);
`;

code = code.replace(/\} else if \(\['APP_NOTICE'/g, suggestionEditBlock + "} else if (['APP_NOTICE'");
fs.writeFileSync('src/pages/Messages.tsx', code);
