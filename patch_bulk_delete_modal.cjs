const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

const originalRejectModal = `      {/* Reject Confirmation Modal - PORTALED */}`;

const newBulkModal = `      {/* Bulk Delete Modal - PORTALED */}
      {bulkDeleteTab && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-500 border border-red-50">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-red-100">
                 <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1E3A8A] font-noto tracking-tight">আপনি কি নিশ্চিত?</h3>
              <p className="text-[12px] font-bold text-slate-400 mt-2 font-noto leading-relaxed">
                 আপনি {bulkDeleteTab === 'sms' ? 'SMS' : bulkDeleteTab === 'voice' ? 'Voice' : 'Subscription'} এর <strong>সকল পেন্ডিং রিকোয়েস্ট</strong> একসাথে মুছে ফেলতে চাচ্ছেন। <br/> (এতে কোনো Cancel SMS পাঠানো হবে না)
              </p>
              <div className="flex flex-col gap-2 mt-8">
                 <button onClick={bulkDeleteTransactions} disabled={isBulkDeleting} className="w-full py-4 bg-red-500 text-white font-black rounded-full shadow-lg shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    {isBulkDeleting ? <Loader2 className="animate-spin" size={18} /> : 'হ্যাঁ, মুছে ফেলুন'}
                 </button>
                 <button onClick={() => setBulkDeleteTab(null)} disabled={isBulkDeleting} className="w-full py-3 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-[10px] uppercase tracking-widest">পিছনে যান</button>
              </div>
           </div>
        </div>,
        document.body
      )}
      
      {/* Reject Confirmation Modal - PORTALED */}`;

if (!code.includes('Bulk Delete Modal - PORTALED')) {
    code = code.replace(originalRejectModal, newBulkModal);
}

fs.writeFileSync('src/pages/AdminPanel.tsx', code);
