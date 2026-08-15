const fs = require('fs');
const files = [
  'src/components/admission_form/AdmissionFormPreview.tsx',
  'src/components/admission_form/AdmissionFormPage.tsx',
  'src/components/TeacherIdCardGenerator.tsx',
  'src/components/StudentIdCardGenerator.tsx',
  'src/pages/Certificates.tsx',
  'src/pages/ClassRoutine.tsx',
  'src/pages/AdminPanel.tsx',
  'src/utils/admitCardGenerator.tsx',
  'src/utils/pdfGenerator.tsx',
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace html-to-image imports
    content = content.replace(/import\s+\{([^}]*toPng[^}]*)\}\s+from\s+['"]html-to-image['"];?/g, '');

    // Replace jsPDF imports
    content = content.replace(/import\s+jsPDF\s+from\s+['"]jspdf['"];?/g, '');
    content = content.replace(/import\s+\{\s*jsPDF\s*\}\s+from\s+['"]jspdf['"];?/g, '');
    
    // Add our universal import
    if (!content.includes('serverPdfGenerator')) {
         let depth = (file.match(/\//g) || []).length; // e.g. src/utils/pdfGenerator.tsx -> 2 slashes, depth 2. Wait, src(0)/utils(1)/pdfGenerator.tsx
         // paths: 
         // src/components/TeacherIdCardGenerator.tsx (2 slashes) -> '../utils/serverPdfGenerator'
         // src/utils/pdfGenerator.tsx (2 slashes) -> './serverPdfGenerator'
         // src/components/admission_form/AdmissionFormPage.tsx (3 slashes) -> '../../utils/serverPdfGenerator'
         let relPath = '';
         if (depth === 1) relPath = './utils/serverPdfGenerator'; // src/App.tsx
         else if (depth === 2 && file.startsWith('src/utils/')) relPath = './serverPdfGenerator';
         else if (depth === 2) relPath = '../utils/serverPdfGenerator';
         else if (depth === 3) relPath = '../../utils/serverPdfGenerator';
         
         content = `import { jsPDF, toPng, toJpeg } from '${relPath}';\n` + content;
    }
    
    fs.writeFileSync(file, content);
    console.log(`Patched ${file}`);
  }
}
