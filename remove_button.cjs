const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

const targetBtn = `                                    {canWrite('api_security') && (
                                      <button
                                        type="button"
                                        onClick={handleApplyVoiceRateToAllUsers}
                                        className="mt-2 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                                      >
                                        <Zap size={13} /> সকল ইউজারের ভয়েস কল রেট ০.৪৫ টাকা সেট করুন
                                      </button>
                                    )}`;

code = code.replace(targetBtn, '');
fs.writeFileSync('src/pages/AdminPanel.tsx', code);
console.log('Removed button');
