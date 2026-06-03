const fs = require('fs');
const content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

const startIdx = content.indexOf("{activeTab === 'exam-routine' && (");
const nextTabIdx = content.indexOf("{activeTab === 'exams' && view === 'list' && !selectedClassId && (");

const block = content.slice(startIdx, nextTabIdx);

let divCount = 0;
const lines = block.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/<div/)) divCount += (line.match(/<div/g) || []).length;
  if (line.match(/<\/div>/)) divCount -= (line.match(/<\/div>/g) || []).length;
}

console.log('Div balance for exam-routine block:', divCount);
