const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

// 1. Initial state
code = code.replace(
  "const [editVoiceRate, setEditVoiceRate] = useState<number>(0.50);",
  "const [editVoiceRate, setEditVoiceRate] = useState<number>(0.45);"
);

// 2. setEditVoiceRate when user is loaded
code = code.replace(
  "setEditVoiceRate(user.voice_rate || 0.50);",
  "setEditVoiceRate(user.voice_rate !== undefined && user.voice_rate !== null ? user.voice_rate : 0.45);"
);

// 3. Save voice_rate
code = code.replace(
  "voice_rate: Number(editVoiceRate) || 0.50,",
  "voice_rate: Number(editVoiceRate) !== undefined && !isNaN(Number(editVoiceRate)) ? Number(editVoiceRate) : 0.45,"
);

// 4. Add handleApplyVoiceRateToAllUsers
const newHandler = `
  const handleApplyVoiceRateToAllUsers = async () => {
    try {
      const { error: sysErr } = await supabase
        .from('system_settings')
        .update({ voice_rate: 0.45 })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      if (sysErr) console.error('Sys error:', sysErr);

      const { error: instErr } = await supabase
        .from('institutions')
        .update({ voice_rate: 0.45 })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (instErr) throw instErr;

      setEditVoiceRate(0.45);
      setStatusModal({
        show: true,
        type: 'success',
        title: 'সফল',
        message: 'সকল ইউজার এবং গ্লোবাল সিস্টেমে ভয়েস কল রেট ০.৪৫ টাকা সেট করা হয়েছে।'
      });
      initData(true, true);
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'ত্রুটি',
        message: err.message || 'ভয়েস রেট আপডেট করতে সমস্যা হয়েছে।'
      });
    }
  };
`;

if (!code.includes('handleApplyVoiceRateToAllUsers')) {
  code = code.replace(
    'const bulkDeleteTransactions = async () => {',
    newHandler + '\n  const bulkDeleteTransactions = async () => {'
  );
}

// 5. Update input placeholder & add button in API Security tab
const oldInput = `<input type="number" step="0.01" readOnly={!canWrite('api_security')} className={\`w-full h-14 \${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all \${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}\`} value={editVoiceRate} onChange={(e) => setEditVoiceRate(Number(e.target.value))} placeholder="0.50" />`;

const newInput = `<input type="number" step="0.01" readOnly={!canWrite('api_security')} className={\`w-full h-14 \${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:bg-slate-800' : 'bg-white border-slate-200 text-slate-900 focus:bg-white'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all \${!canWrite('api_security') ? 'cursor-not-allowed opacity-85' : ''}\`} value={editVoiceRate} onChange={(e) => setEditVoiceRate(Number(e.target.value))} placeholder="0.45" />
                                    {canWrite('api_security') && (
                                      <button
                                        type="button"
                                        onClick={handleApplyVoiceRateToAllUsers}
                                        className="mt-2 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                                      >
                                        <Zap size={13} /> সকল ইউজারের ভয়েস কল রেট ০.৪৫ টাকা সেট করুন
                                      </button>
                                    )}`;

code = code.replace(oldInput, newInput);

fs.writeFileSync('src/pages/AdminPanel.tsx', code);
console.log('Patched AdminPanel.tsx successfully');
