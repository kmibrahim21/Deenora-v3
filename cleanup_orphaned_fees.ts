import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanOrphanedFees() {
  console.log('Fetching all fees...');
  let allFees: any[] = [];
  let hasMoreFees = true;
  let feePage = 0;
  while (hasMoreFees) {
    const { data: fees, error } = await supabase.from('fees').select('id, month, student_id, amount_paid, students(student_name)').range(feePage * 1000, (feePage + 1) * 1000 - 1);
    if (error) throw error;
    if (fees.length > 0) {
      allFees = allFees.concat(fees);
      feePage++;
    } else {
      hasMoreFees = false;
    }
  }

  console.log('Fetching all ledger...');
  let allLedger: any[] = [];
  let hasMoreLedger = true;
  let ledgerPage = 0;
  while (hasMoreLedger) {
    const { data: ledger, error } = await supabase.from('ledger').select('id, description').range(ledgerPage * 1000, (ledgerPage + 1) * 1000 - 1);
    if (error) throw error;
    if (ledger.length > 0) {
      allLedger = allLedger.concat(ledger);
      ledgerPage++;
    } else {
      hasMoreLedger = false;
    }
  }

  console.log(`Total Fees fetched: ${allFees.length}`);
  console.log(`Total Ledger fetched: ${allLedger.length}`);

  let orphanedFeedsIds: string[] = [];
  
  for (const fee of allFees) {
    const studentName = fee.students?.student_name;
    const feeId = fee.id;
    const month = fee.month;

    const hasLedger = allLedger.some(l => {
      const desc = l.description || '';
      if (desc.includes(feeId)) return true;
      if (studentName && desc.includes(studentName) && desc.includes(month)) return true;
      return false;
    });

    if (!hasLedger) {
      orphanedFeedsIds.push(feeId);
    }
  }

  console.log(`Found ${orphanedFeedsIds.length} orphaned fees.`);
  
  const batchSize = 100;
  for (let i = 0; i < orphanedFeedsIds.length; i += batchSize) {
    const batch = orphanedFeedsIds.slice(i, i + batchSize);
    const { error } = await supabase.from('fees').delete().in('id', batch);
    if (error) {
      console.error('Failed to delete batch:', error);
    } else {
      console.log(`Deleted batch of ${batch.length} fees`);
    }
  }

  console.log('Cleanup complete.');
}

cleanOrphanedFees().catch(console.error);
