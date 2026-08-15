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
    content = content.replace(/import\s+\{([^}]*toPng[^}]*)\}\s+from\s+['"]html-to-image['"];?/g, 
        (match, p1) => {
             // we need to see if there are other imports. Usually it's just toPng, toJpeg
             // we'll replace with our mock.
             // Actually, some files import jsPDF from 'jspdf'. Let's do a uniform replace.
             return ''; 
        }
    );

    // Replace jsPDF imports
    content = content.replace(/import\s+jsPDF\s+from\s+['"]jspdf['"];?/g, '');
    content = content.replace(/import\s+\{\s*jsPDF\s*\}\s+from\s+['"]jspdf['"];?/g, '');
    
    // Add our universal import
    if (!content.includes('import { jsPDF, toPng, toJpeg } from')) {
         // for paths, since all files are at different depths:
         let depth = (file.match(/\//g) || []).length; // e.g. src/utils/pdfGenerator.tsx -> 2
         let relPath = '../'.repeat(depth - 1) + 'utils/serverPdfGenerator';
         content = `import { jsPDF, toPng, toJpeg } from '${relPath}';\n` + content;
    }
    
    fs.writeFileSync(file, content);
    console.log(`Patched ${file}`);
  }
}
