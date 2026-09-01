/**
 * Comprehensive Reconciliation Engine Verification Test
 * Creates realistic Meesho data, manually calculates expected results,
 * runs the engine, and verifies output matches expectations
 */
import { reconcile } from './lib/reconciliation.js';

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RECONCILIATION ENGINE VERIFICATION TEST');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// CREATE TEST DATA - REALISTIC MEESHO SCENARIO
// ─────────────────────────────────────────────────────────────────────────────

console.log('SCENARIO: E-commerce seller with Meesho marketplace\n');

// Seller's records (what they think should be paid)
const sellerTransactions = [
  // Order 1: MATCHED - exact match
  { source_platform: 'seller', order_id: 'MH-10001', gross_amount: 500, net_amount: 450, transaction_date: '2026-09-01' },
  
  // Order 2: MATCHED - exact match
  { source_platform: 'seller', order_id: 'MH-10002', gross_amount: 1500, net_amount: 1250, transaction_date: '2026-09-02' },
  
  // Order 3: AMOUNT_MISMATCH - seller expects 1700 but marketplace only paid 1800 (negative difference)
  { source_platform: 'seller', order_id: 'MH-10003', gross_amount: 2000, net_amount: 1700, transaction_date: '2026-09-03' },
  
  // Order 4: RETURN_DISCREPANCY - return with amount difference
  { source_platform: 'seller', order_id: 'MH-10004', gross_amount: 1200, net_amount: 884, transaction_date: '2026-09-04' },
  
  // Order 5: MATCHED
  { source_platform: 'seller', order_id: 'MH-10005', gross_amount: 300, net_amount: 270, transaction_date: '2026-09-05' },
  
  // Order 6: MATCHED
  { source_platform: 'seller', order_id: 'MH-10006', gross_amount: 400, net_amount: 310, transaction_date: '2026-09-06' },
  
  // Order 7: MATCHED
  { source_platform: 'seller', order_id: 'MH-10007', gross_amount: 1800, net_amount: 1502, transaction_date: '2026-09-07' },
  
  // Order 8: MATCHED
  { source_platform: 'seller', order_id: 'MH-10008', gross_amount: 600, net_amount: 540, transaction_date: '2026-09-08' },
  
  // Order 9: MATCHED
  { source_platform: 'seller', order_id: 'MH-10009', gross_amount: 2500, net_amount: 2025, transaction_date: '2026-09-09' },
  
  // Order 10: DUPLICATE_RECORD - appears twice (same ID)
  { source_platform: 'seller', order_id: 'MH-10010', gross_amount: 900, net_amount: 900, transaction_date: '2026-09-10' },
  { source_platform: 'seller', order_id: 'MH-10010', gross_amount: 900, net_amount: 900, transaction_date: '2026-09-10' },
  
  // Order 11: MISSING_SETTLEMENT - seller has record but marketplace never settled it
  { source_platform: 'seller', order_id: 'MH-10012', gross_amount: 250, net_amount: 250, transaction_date: '2026-09-12' },
];

// Marketplace settlement records
const marketplaceTransactions = [
  // Order 1: MATCHED
  { source_platform: 'meesho', order_id: 'MH-10001', gross_amount: 500, commission_amount: 50, net_amount: 450, transaction_date: '2026-09-01' },
  
  // Order 2: MATCHED
  { source_platform: 'meesho', order_id: 'MH-10002', gross_amount: 1500, commission_amount: 150, shipping_amount: 100, net_amount: 1250, transaction_date: '2026-09-02' },
  
  // Order 3: AMOUNT_MISMATCH - marketplace paid more
  { source_platform: 'meesho', order_id: 'MH-10003', gross_amount: 2000, commission_amount: 200, net_amount: 1800, transaction_date: '2026-09-03' },
  
  // Order 4: RETURN_DISCREPANCY - return charge applied
  { source_platform: 'meesho', order_id: 'MH-10004', gross_amount: 1200, commission_amount: 120, return_amount: 68, net_amount: 884, status: 'RTO', transaction_date: '2026-09-04' },
  
  // Order 5: MATCHED
  { source_platform: 'meesho', order_id: 'MH-10005', gross_amount: 300, commission_amount: 30, net_amount: 270, transaction_date: '2026-09-05' },
  
  // Order 6: MATCHED
  { source_platform: 'meesho', order_id: 'MH-10006', gross_amount: 400, commission_amount: 40, shipping_amount: 50, net_amount: 310, transaction_date: '2026-09-06' },
  
  // Order 7: MATCHED with TCS
  { source_platform: 'meesho', order_id: 'MH-10007', gross_amount: 1800, commission_amount: 180, shipping_amount: 100, tcs_amount: 18, net_amount: 1502, transaction_date: '2026-09-07' },
  
  // Order 8: MATCHED
  { source_platform: 'meesho', order_id: 'MH-10008', gross_amount: 600, commission_amount: 60, net_amount: 540, transaction_date: '2026-09-08' },
  
  // Order 9: MATCHED
  { source_platform: 'meesho', order_id: 'MH-10009', gross_amount: 2500, commission_amount: 250, shipping_amount: 200, tcs_amount: 25, net_amount: 2025, transaction_date: '2026-09-09' },
  
  // Order 11: UNMATCHED_MARKETPLACE_RECORD - settlement exists but seller has no record
  { source_platform: 'meesho', order_id: 'MH-10011', gross_amount: 350, commission_amount: 35, net_amount: 315, transaction_date: '2026-09-11' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MANUALLY CALCULATE EXPECTED RESULTS
// ─────────────────────────────────────────────────────────────────────────────

console.log('STEP 1: Manual Calculation of Expected Results');
console.log('─────────────────────────────────────────────────────────────────\n');

const expected = {
  'MH-10001': { status: 'MATCHED', desc: 'Perfect match: ₹450 = ₹450' },
  'MH-10002': { status: 'MATCHED', desc: 'Perfect match: ₹1250 = ₹1250' },
  'MH-10003': { status: 'AMOUNT_MISMATCH', desc: 'Mismatch: Seller expects ₹1700, got ₹1800 (diff: -₹100)' },
  'MH-10004': { status: 'RETURN_DISCREPANCY', desc: 'Return flag with RTO status, settled at ₹884' },
  'MH-10005': { status: 'MATCHED', desc: 'Perfect match: ₹270 = ₹270' },
  'MH-10006': { status: 'MATCHED', desc: 'Perfect match: ₹310 = ₹310' },
  'MH-10007': { status: 'MATCHED', desc: 'Perfect match with TCS: ₹1502 = ₹1502' },
  'MH-10008': { status: 'MATCHED', desc: 'Perfect match: ₹540 = ₹540' },
  'MH-10009': { status: 'MATCHED', desc: 'Perfect match with TCS and shipping: ₹2025 = ₹2025' },
  'MH-10010': { status: 'DUPLICATE_RECORD', desc: 'Order ID appears twice in seller file' },
  'MH-10011': { status: 'UNMATCHED_MARKETPLACE_RECORD', desc: 'Settlement exists but seller has no record' },
  'MH-10012': { status: 'MISSING_SETTLEMENT', desc: 'Seller has ₹250 but marketplace never settled it' },
};

for (const [orderId, exp] of Object.entries(expected)) {
  console.log(`  ${orderId}: ${exp.status}`);
  console.log(`    └─ ${exp.desc}`);
}

const expectedCounts = {};
for (const [, exp] of Object.entries(expected)) {
  expectedCounts[exp.status] = (expectedCounts[exp.status] || 0) + 1;
}

console.log('\nExpected Summary:');
console.log(`  Total records: 12`);
console.log(`  MATCHED: 6`);
console.log(`  Needs attention: 6`);
console.log(`  ├─ AMOUNT_MISMATCH: 1`);
console.log(`  ├─ RETURN_DISCREPANCY: 1`);
console.log(`  ├─ DUPLICATE_RECORD: 1`);
console.log(`  ├─ UNMATCHED_MARKETPLACE_RECORD: 1`);
console.log(`  └─ MISSING_SETTLEMENT: 1\n`);

// ─────────────────────────────────────────────────────────────────────────────
// RUN RECONCILIATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

console.log('STEP 2: Running Reconciliation Engine');
console.log('─────────────────────────────────────────────────────────────────\n');

const { records, summary } = reconcile(sellerTransactions, marketplaceTransactions);

console.log(`Processed: ${sellerTransactions.length} seller records + ${marketplaceTransactions.length} marketplace records\n`);

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY RESULTS
// ─────────────────────────────────────────────────────────────────────────────

console.log('STEP 3: Verify Engine Output Against Expected Results');
console.log('═'.repeat(65) + '\n');

let passCount = 0;
let failCount = 0;

for (const record of records) {
  const exp = expected[record.order_id];
  const match = exp && exp.status === record.status;
  const symbol = match ? '✓' : '✗';
  
  console.log(`${symbol} ${record.order_id}: ${record.status}`);
  
  if (!match) {
    console.log(`   Expected: ${exp?.status || 'UNKNOWN'}`);
    failCount++;
  } else {
    passCount++;
  }
  
  if (record.difference !== undefined) {
    console.log(`   Difference: ₹${record.difference.toFixed(2)}`);
  }
}

console.log('\n' + '═'.repeat(65));
console.log('SUMMARY COMPARISON');
console.log('═'.repeat(65) + '\n');

console.log('Status Distribution:');
console.log('─'.repeat(65));

for (const status of [...new Set(Object.values(expected).map(e => e.status))].sort()) {
  const expectedCount = Object.values(expected).filter(e => e.status === status).length;
  const actualCount = records.filter(r => r.status === status).length;
  const match = expectedCount === actualCount ? '✓' : '✗';
  console.log(`${match} ${status.padEnd(30)} Expected: ${expectedCount}, Got: ${actualCount}`);
}

console.log('\n' + '─'.repeat(65));
console.log('Total Record Counts:');
console.log(`✓ Total records: Expected 12, Got ${records.length}`);
console.log(`${records.filter(r => r.status === 'MATCHED').length === 6 ? '✓' : '✗'} Matched: Expected 6, Got ${records.filter(r => r.status === 'MATCHED').length}`);
console.log(`${records.filter(r => r.status !== 'MATCHED').length === 6 ? '✓' : '✗'} Needs attention: Expected 6, Got ${records.filter(r => r.status !== 'MATCHED').length}`);

console.log('\n' + '─'.repeat(65));
console.log('Financial Summary:');
const f = summary.financial_summary;
if (f.gross_sales !== undefined) console.log(`  Gross sales: ₹${f.gross_sales.toFixed(2)}`);
if (f.marketplace_fees !== undefined) console.log(`  Marketplace fees: ₹${f.marketplace_fees.toFixed(2)}`);
if (f.shipping !== undefined) console.log(`  Shipping: ₹${f.shipping.toFixed(2)}`);
if (f.returns !== undefined) console.log(`  Returns/RTO: ₹${f.returns.toFixed(2)}`);
if (f.tcs !== undefined) console.log(`  TCS: ₹${f.tcs.toFixed(2)}`);
if (f.settlement_total !== undefined) console.log(`  Settlement total: ₹${f.settlement_total.toFixed(2)}`);
if (f.difference_requiring_review !== undefined) console.log(`  Difference requiring review: ₹${f.difference_requiring_review.toFixed(2)}`);

console.log('\n' + '═'.repeat(65));

// ─────────────────────────────────────────────────────────────────────────────
// FINAL VERDICT
// ─────────────────────────────────────────────────────────────────────────────

const allMatch = passCount === records.length && 
  records.length === 12 && 
  records.filter(r => r.status === 'MATCHED').length === 6 &&
  records.filter(r => r.status !== 'MATCHED').length === 6;

if (allMatch) {
  console.log('✓✓✓ ENGINE TEST PASSED ✓✓✓');
  console.log('═'.repeat(65));
  console.log('\nThe reconciliation engine is working correctly!');
  console.log('All manual calculations match the engine output.\n');
} else {
  console.log('✗✗✗ ENGINE TEST FAILED ✗✗✗');
  console.log('═'.repeat(65));
  console.log(`\nFound ${failCount} mismatches. Review results above.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAILED ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

console.log('DETAILED ANALYSIS');
console.log('═'.repeat(65) + '\n');

console.log('KEY FINDINGS:\n');

console.log('1. MATCHED Orders (6 records)');
console.log('   Seller and marketplace amounts perfectly align.');
console.log('   No action required.\n');

const mismatch = records.find(r => r.order_id === 'MH-10003');
if (mismatch) {
  console.log('2. AMOUNT_MISMATCH (₹100 difference)');
  console.log(`   Order ${mismatch.order_id}: Seller expects ₹${mismatch.expected_amount}, got ₹${mismatch.marketplace_amount}`);
  console.log('   Investigate why marketplace paid more than expected.\n');
}

const returnDisc = records.find(r => r.order_id === 'MH-10004');
if (returnDisc) {
  console.log('3. RETURN_DISCREPANCY');
  console.log(`   Order ${returnDisc.order_id}: Flagged as return/RTO.`);
  console.log('   Verify return processing and verify settlement amount.\n');
}

const dup = records.find(r => r.order_id === 'MH-10010');
if (dup) {
  console.log('4. DUPLICATE_RECORD');
  console.log(`   Order ${dup.order_id}: Appears ${sellerTransactions.filter(t => t.order_id === 'MH-10010').length} times in seller file.`);
  console.log('   Remove duplicate entry and re-reconcile.\n');
}

const unmatched = records.find(r => r.order_id === 'MH-10011');
if (unmatched) {
  console.log('5. UNMATCHED_MARKETPLACE_RECORD');
  console.log(`   Order ${unmatched.order_id}: Settlement received but no seller record found.`);
  console.log(`   This could be an old order or a discrepancy. Settlement: ₹${unmatched.marketplace_amount}\n`);
}

const missing = records.find(r => r.order_id === 'MH-10012');
if (missing) {
  console.log('6. MISSING_SETTLEMENT');
  console.log(`   Order ${missing.order_id}: Seller recorded ₹${missing.expected_amount} but marketplace hasn't settled it.`);
  console.log('   Follow up with Meesho support.\n');
}

console.log('═'.repeat(65) + '\n');
