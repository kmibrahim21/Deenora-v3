const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

const originalUI = `<h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                   <AlertCircle size={14} className="text-amber-400" /> Pending Requests ({paymentTab === 'sms' ? 'SMS' : paymentTab === 'voice' ? 'Voice' : 'Subscription'})
                </h2>`;

const newUI = `<div className="flex items-center justify-between px-2">
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <AlertCircle size={14} className="text-amber-400" /> Pending Requests ({paymentTab === 'sms' ? 'SMS' : paymentTab === 'voice' ? 'Voice' : 'Subscription'})
                  </h2>
                  {pendingTrans.filter(tr => filterTransactionByTab(tr, paymentTab)).length > 0 && (
                    <button
                      onClick={() => setBulkDeleteTab(paymentTab)}
                      className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <Trash2 size={12} /> Delete All Pending
                    </button>
                  )}
                </div>`;

if (!code.includes('Delete All Pending')) {
    code = code.replace(originalUI, newUI);
}

fs.writeFileSync('src/pages/AdminPanel.tsx', code);
