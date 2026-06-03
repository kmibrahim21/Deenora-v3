const fs = require('fs');
let content = fs.readFileSync('src/components/pdf/CertificateTemplate.tsx', 'utf8');
content = content.replace(/flex w-full items-end pb-1/g, 'flex w-full items-baseline pb-1');
fs.writeFileSync('src/components/pdf/CertificateTemplate.tsx', content);
