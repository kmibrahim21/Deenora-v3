
import fs from 'fs';

const filePath = 'src/pages/AdminPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The script messed up by replacing 
// const res = await fetch('/api/admin', {
// with nothing or something else.

// It seems it left:
/*
      const { data: { session } } = await supabase.auth.getSession();
      
        method: 'POST',
*/

// I'll search for the block that looks like:
//         method: 'POST',
// and has no fetch before it but has a session before it.

// Actually, I can just replace:
// \n      \n        method: 'POST',
// or similar.

// Let's be precise.
// Every occurrence of:
//         method: 'POST',
// should be preceded by:
//       const res = await fetch('/api/admin', {

// Let's use a regex to find blocks that start with method: 'POST' but lack the fetch line.
const lines = content.split('\n');
let fixedLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("method: 'POST',") && !lines[i-1].includes("fetch('/api/admin',")) {
    // Check if previous line is empty or just has indentation
    if (lines[i-1].trim() === '' || lines[i-1].includes('session')) {
       // We need to inject the fetch line
       const indent = lines[i].match(/^\s*/)[0];
       // The fetch line should have the same indent or slightly less
       fixedLines.push(indent + "const res = await fetch('/api/admin', {");
    }
  }
  fixedLines.push(lines[i]);
}

content = fixedLines.join('\n');
fs.writeFileSync(filePath, content);
console.log('Restored missing fetch lines');
