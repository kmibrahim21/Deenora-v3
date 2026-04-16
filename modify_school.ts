import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/components/finance/SchoolFeeEngine.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">শেষ তারিখ (Optional)</label>
                       <div className="relative">
                           <input type="date" className={\`w-full h-14 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent transition-all \${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer\`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                           <Calendar className={\`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none \${isDark ? 'text-slate-500' : 'text-slate-400'}\`} size={20}/>
                       </div>
                    </div>`;

const replacement = `                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">শুরুর তারিখ</label>
                       <div className="relative">
                           <input type="date" className={\`w-full h-14 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent transition-all \${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer\`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                           <Calendar className={\`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none \${isDark ? 'text-slate-500' : 'text-slate-400'}\`} size={20}/>
                       </div>
                    </div>
                    <div className="relative">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5 block">শেষ তারিখ (Optional)</label>
                       <div className="relative">
                           <input type="date" className={\`w-full h-14 rounded-2xl px-12 font-black text-sm outline-none border-2 border-transparent transition-all \${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer\`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                           <Calendar className={\`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none \${isDark ? 'text-slate-500' : 'text-slate-400'}\`} size={20}/>
                       </div>
                    </div>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Success");
} else {
    console.log("Target not found");
}
