const fs = require('fs');
let code = fs.readFileSync('src/pages/ParentPortal.tsx', 'utf8');

code = code.replace(
  'className="flex bg-slate-100/50 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar self-center sm:self-start border border-slate-100"',
  'className="flex flex-wrap justify-center sm:justify-start bg-slate-100/50 p-1.5 rounded-2xl gap-1.5 self-center sm:self-start border border-slate-100 w-full sm:w-auto"'
);

code = code.replace(
  'className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${',
  'className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 min-w-[30%] sm:min-w-0 px-3 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${'
);

fs.writeFileSync('src/pages/ParentPortal.tsx', code);
