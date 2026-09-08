const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

const newFunc = `
  const bulkDeleteTransactions = async () => {
    if (!bulkDeleteTab) return;
    setIsBulkDeleting(true);
    try {
      const idsToDelete = pendingTrans.filter(tr => filterTransactionByTab(tr, bulkDeleteTab)).map(tr => tr.id);
      if (idsToDelete.length === 0) {
         setBulkDeleteTab(null);
         return;
      }
      const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
      if (error) throw error;
      
      setPendingTrans(prev => prev.filter(p => !idsToDelete.includes(p.id)));
      setBulkDeleteTab(null);
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'সকল পেন্ডিং পেমেন্ট মুছে ফেলা হয়েছে (কোনো SMS পাঠানো হয়নি)।' });
      initData(true, true);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsBulkDeleting(false);
    }
  };
`;

if (!code.includes('bulkDeleteTransactions')) {
    code = code.replace(
        /const rejectTransaction = async \(\) => \{[\s\S]*?\}\s*?\};\s*?(\/\/|const)/,
        match => {
            const lastLines = match.substring(match.lastIndexOf('};'));
            return match.replace(lastLines, '};\n' + newFunc + '\n' + lastLines.substring(2));
        }
    );
}

fs.writeFileSync('src/pages/AdminPanel.tsx', code);
