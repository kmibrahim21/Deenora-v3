const fs = require('fs');
let code = fs.readFileSync('src/pages/VoiceBroadcast.tsx', 'utf8');

// 1. Patch fetchHistory
const oldFetchHistoryLine = `    const { data } = await query.order('created_at', { ascending: false }).limit(200);
    if (data) setBroadcastHistory(data);`;

const newFetchHistoryLine = `    const { data } = await query.order('created_at', { ascending: false }).limit(200);
    if (data) {
      let instIdToFilter = madrasah?.id;
      let txQuery = supabase.from('transactions').select('transaction_id, amount').eq('module', 'voice').eq('type', 'credit');
      if (instIdToFilter && isValidUUID(instIdToFilter)) {
        txQuery = txQuery.eq('institution_id', instIdToFilter);
      }
      const { data: refundTxs } = await txQuery;
      const refundMap: { [campId: string]: number } = {};
      if (refundTxs) {
        refundTxs.forEach(tx => {
          if (tx.transaction_id && tx.transaction_id.startsWith('REFUND_CAMP_')) {
            const campId = tx.transaction_id.replace('REFUND_CAMP_', '');
            refundMap[campId] = (refundMap[campId] || 0) + Number(tx.amount || 0);
          }
        });
      }

      const mappedData = data.map(item => {
        let totalTxRefund = refundMap[item.provider_campaign_id] || 0;
        if (item.retries && Array.isArray(item.retries)) {
          item.retries.forEach((rId: string) => {
            if (refundMap[rId]) totalTxRefund += refundMap[rId];
          });
        }
        const effectiveRefund = Math.max(Number(item.refunded_amount || 0), totalTxRefund);
        return {
          ...item,
          refunded_amount: effectiveRefund
        };
      });

      setBroadcastHistory(mappedData);
    }`;

code = code.replace(oldFetchHistoryLine, newFetchHistoryLine);

// 2. Patch history card cost column
const oldCostColumn = `                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost', lang)}</p>
                          <p className="text-xs font-black text-red-500">{h.estimated_cost} ৳</p>
                        </div>`;

const newCostColumn = `                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {lang === 'bn' ? 'সর্বমোট নিট খরচ' : 'Net Total Cost'}
                          </p>
                          {Number(h.refunded_amount || 0) > 0 ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-black text-emerald-600">
                                  {Math.max(0, Number((h.estimated_cost - Number(h.refunded_amount || 0)).toFixed(2)))} ৳
                                </p>
                                <p className="text-[10px] text-slate-400 line-through">
                                  {h.estimated_cost} ৳
                                </p>
                              </div>
                              <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">
                                ({lang === 'bn' ? \`রিফান্ড: \${h.refunded_amount} ৳\` : \`Refunded: \${h.refunded_amount} ৳\`})
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs font-black text-red-500">{h.estimated_cost} ৳</p>
                          )}
                        </div>`;

code = code.replace(oldCostColumn, newCostColumn);

// 3. Patch expanded detail card to add net cost breakdown
const oldDetailsGridEnd = `                                  </div>

                                  {failedLogs.length > 0 && (`

const newDetailsGridEnd = `                                  </div>

                                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs mt-3">
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-slate-500 block text-[10px] uppercase">
                                        {lang === 'bn' ? 'প্রাথমিক চার্জ' : 'Initial Charge'}: {h.estimated_cost} ৳
                                      </span>
                                      {Number(h.refunded_amount || 0) > 0 && (
                                        <span className="font-bold text-emerald-600 block text-[10px] uppercase">
                                          {lang === 'bn' ? 'অব্যবহৃত/ব্যর্থ কল রিফান্ড' : 'Unused/Failed Refund'}: -{h.refunded_amount} ৳
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">
                                        {lang === 'bn' ? 'সর্বমোট প্রকৃত খরচ' : 'Net Actual Cost'}
                                      </span>
                                      <span className="text-sm font-black text-[#1E3A8A]">
                                        {Math.max(0, Number((h.estimated_cost - Number(h.refunded_amount || 0)).toFixed(2)))} ৳
                                      </span>
                                    </div>
                                  </div>

                                  {failedLogs.length > 0 && (`

code = code.replace(oldDetailsGridEnd, newDetailsGridEnd);

fs.writeFileSync('src/pages/VoiceBroadcast.tsx', code);
console.log('Successfully patched VoiceBroadcast.tsx for Net Cost display');
