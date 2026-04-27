const fs = require('fs');
const filename = 'src/pages/AdminPanel.tsx';
const lines = fs.readFileSync(filename, 'utf8').split('\n');
const start = lines.findIndex(l => l.includes("{false && view === 'institutions' && ("));
let end = start;
for(let i=start; i<lines.length; i++) {
  if (lines[i].includes("          )}")) {
      // Need to make sure it's the right line, line 2104.
      if (lines[i+2] && lines[i+2].includes("          {view === 'approvals' && (")) {
         end = i;
         break;
      }
  }
}

console.log('Removing from', start, 'to', end);
const newLines = [...lines.slice(0, start), ...lines.slice(end + 1)];
fs.writeFileSync(filename, newLines.join('\n'));
