const fs = require('fs');
const content = fs.readFileSync('vite.config.ts', 'utf8');
const updated = content.replace(/'react': path\.resolve\(__dirname, '\.\/node_modules\/react'\),\n/, '')
                       .replace(/'react-dom': path\.resolve\(__dirname, '\.\/node_modules\/react-dom'\)\n/, '');
fs.writeFileSync('vite.config.ts', updated);
console.log("Patched vite.config.ts");
