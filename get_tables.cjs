const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = getFiles('src');
const tables = new Set();
files.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/from\('([^']+)'\)/g);
    if (matches) {
      matches.forEach(m => tables.add(m.match(/from\('([^']+)'\)/)[1]));
    }
  }
});
console.log(Array.from(tables).join(', '));
