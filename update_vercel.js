import fs from 'fs';
const json = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
json.functions = {
  "api/pdf.ts": {
    "memory": 1024,
    "maxDuration": 60
  }
};
fs.writeFileSync('vercel.json', JSON.stringify(json, null, 2));
