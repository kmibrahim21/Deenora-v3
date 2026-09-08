const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

code = code.replace(/  const handleApplyVoiceRateToAllUsers = async \(\) => \{[\s\S]*?\n  \};\n/, '');
fs.writeFileSync('src/pages/AdminPanel.tsx', code);
console.log('Removed handler');
