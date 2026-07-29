const fs = require('fs');
let content = fs.readFileSync('src/components/pdf/ResultSheetTemplate.tsx', 'utf8');

// Replace for column 1
content = content.replace(
  /<span className="w-20 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.name\}<\/span>/g,
  '<span className="w-[95px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.name}</span>'
);
content = content.replace(
  /<span className="w-20 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.fname\}<\/span>/g,
  '<span className="w-[95px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.fname}</span>'
);
content = content.replace(
  /<span className="w-20 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.mname\}<\/span>/g,
  '<span className="w-[95px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.mname}</span>'
);

// Replace for column 2
content = content.replace(
  /<span className="w-16 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.class\}<\/span>/g,
  '<span className="w-[85px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.class}</span>'
);
content = content.replace(
  /<span className="w-16 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.roll\}<\/span>/g,
  '<span className="w-[85px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.roll}</span>'
);
content = content.replace(
  /<span className="w-16 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.dob\}<\/span>/g,
  '<span className="w-[85px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.dob}</span>'
);

// Replace for column 3
content = content.replace(
  /<span className="w-16 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.session\}<\/span>/g,
  '<span className="w-[100px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.session}</span>'
);
content = content.replace(
  /<span className="w-16 text-slate-500 font-bold uppercase text-\[10px\] leading-tight shrink-0">\{t\.reg\}<\/span>/g,
  '<span className="w-[100px] whitespace-nowrap text-slate-500 font-bold uppercase text-[10px] leading-tight shrink-0">{t.reg}</span>'
);


fs.writeFileSync('src/components/pdf/ResultSheetTemplate.tsx', content);
console.log("Patched successfully");
