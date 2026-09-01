/**
 * Test reconciliation engine with realistic Meesho data
 * Create test files, run reconciliation, and verify output matches expected results
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import * as XLSX from '@e965/xlsx';
import { parseFileBuffer, isParseError, detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from './lib/parsers.js';
import { reconcile } from './lib/reconciliation.js';

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RECONCILIATION ENGINE TEST WITH REALISTIC MEESHO DATA');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE REALISTIC TEST FILES
// ─────────────────────────────────────────────────────────────────────────────

console.log('STEP 1: Creating Realistic Test Files');
console.log('─────────────────────────────────────────────────────────────────');

const settlementCsv = `Sub Order No,Transaction ID,Transaction Date,SKU,Product Name,Supplier Listed Price,Commission (Including GST),Forward Shipping Charges,Return Shipping Charge (If Applicable),TCS Amount,Final Settlement Amount
MH-10001,TXN001,2026-09-01,SKU-A,T-Shirt,500.00,50.00,0.00,0.00,0.00,450.00
MH-10002,TXN002,2026-09-02,SKU-B,Jeans,1500.00,150.00,100.00,0.00,0.00,1250.00
MH-10003,TXN003,2026-09-03,SKU-C,Shoes,2000.00,200.00,0.00,0.00,0.00,1800.00
MH-10004,TXN004,2026-09-04,SKU-D,Dress,1200.00,120.00,0.00,68.00,0.00,884.00
MH-10005,TXN005,2026-09-05,SKU-E,Cap,300.00,30.00,0.00,0.00,0.00,270.00
MH-10006,TXN006,2026-09-06,SKU-F,Socks,400.00,40.00,50.00,0.00,0.00,310.00
MH-10007,TXN007,2026-09-07,SKU-G,Sweater,1800.00,180.00,100.00,0.00,18.00,1502.00
MH-10008,TXN008,2026-09-08,SKU-H,Shorts,600.00,60.00,0.00,0.00,0.00,540.00
MH-10009,TXN009,2026-09-09,SKU-I,Jacket,2500.00,250.00,200.00,0.00,25.00,2025.00
MH-10011,TXN011,2026-09-11,SKU-K,Scarf,350.00,35.00,0.00,0.00,0.00,315.00`;

const sellerCsv = `Order ID,Order Date,SKU,Product Name,Expected Settlement Amount
MH-10001,2026-09-01,SKU-A,T-Shirt,450.00
MH-10002,2026-09-02,SKU-B,Jeans,1250.00
MH-10003,2026-09-03,SKU-C,Shoes,1700.00
MH-10004,2026-09-04,SKU-D,Dress,884.00
MH-10005,2026-09-05,SKU-E,Cap,270.00
MH-10006,2026-09-06,SKU-F,Socks,310.00
MH-10007,2026-09-07,SKU-G,Sweater,1502.00
MH-10008,2026-09-08,SKU-H,Shorts,540.00
MH-10009,2026-09-09,SKU-I,Jacket,2025.00
MH-10010,2026-09-10,SKU-J,Blazer,900.00
MH-10010,2026-09-10,SKU-J,Blazer,900.00
MH-10012,2026-09-12,SKU-L,Belt,250.00`;

writeFileSync('test-settlement.csv', settlementCsv);
writeFileSync('test-sales.csv', sellerCsv);
console.log('✓ Created test-settlement.csv (10 marketplace orders)');
console.log('✓ Created test-sales.csv (12 seller records)\n');

// ─────────────────────────────────────────────────────────────────────────────
// 2. MANUALLY CALCULATE EXPECTED RESULTS
// ─────────────────────────────────────────────────────────────────────────────

console.log('STEP 2: Manually Calculate Expected Reconciliation Output');
console.log('─────────────────────────────────────────────────────────────────');

const expectedResults = {
  'MH-10001': { status: 'MATCHED', sellerAmount: 450.00, settlementAmount: 450.00, difference: 0 },
  'MH-10002': { status: 'MATCHED', sellerAmount: 1250.00, settlementAmount: 1250.00, difference: 0 },
  'MH-10003': { status: 'AMOUNT_MISMATCH', sellerAmount: 1700.00, settlementAmount: 1800.00, difference: -100.00 },
  'MH-10004': { status: 'RETURN_DISCREPANCY', sellerAmount: 884.00, settlementAmount: 884.00, difference: 0 },
  'MH-10005': { status: 'MATCHED', sellerAmount: 270.00, settlementAmount: 270.00, difference: 0 },
  'MH-10006': { status: 'MATCHED', sellerAmount: 310.00, settlementAmount: 310.00, difference: 0 },
  'MH-10007': { status: 'MATCHED', sellerAmount: 1502.00, settlementAmount: 1502.00, difference: 0 },
  'MH-10008': { status: 'MATCHED', sellerAmount: 540.00, settlementAmount: 540.00, difference: 0 },
  'MH-10009': { status: 'MATCHED', sellerAmount: 2025.00, settlementAmount: 2025.00, difference: 0 },
  'MH-10010': { status: 'DUPLICATE_RECORD', sellerAmount: 900.00, count: 2 },
  'MH-10011': { status: 'UNMATCHED_MARKETPLACE_RECORD', settlementAmount: 315.00 },
  'MH-10012': { status: 'MISSING_SETTLEMENT', sellerAmount: 250.00 },
};

console.log('\nExpected Reconciliation Results:\n');
let expectedCounts = {};
for (const [orderId, expected] of Object.entries(expectedResults)) {
  expectedCounts[expected.status] = (expectedCounts[expected.status] || 0) + 1;
  console.log(`  ${orderId}: ${expected.status}`);
}

console.log('\nExpected Summary:');
for (const [status, count] of Object.entries(expectedCounts).sort()) {
  console.log(`  ${status}: ${count}`);
}
console.log('\nExpected Totals:');
console.log(`  Total records: 12`);
console.log(`  Matched: 6`);
console.log(`  Needs attention: 6\n`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. RUN RECONCILIATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

console.log('STEP 3: Run Reconciliation Engine on Test Files');
console.log('─────────────────────────────────────────────────────────────────');

async function runTest() {
  // Parse files
  const settlementParsed = await parseFileBuffer('test-settlement.csv', readFileSync('test-settlement.csv'));
  const salesParsed = await parseFileBuffer('test-sales.csv', readFileSync('test-sales.csv'));

  if (isParseError(settlementParsed) || isParseError(salesParsed)) {
    console.error('❌ Parse Error:', {
      settlement: settlementParsed,
      sales: salesParsed,
    });
    return;
  }

  console.log(`✓ Parsed settlement file: ${settlementParsed.rowCount} rows`);
  console.log(`✓ Parsed sales file: ${salesParsed.rowCount} rows\n`);

  // Detect and map columns
  const settlementMapping = mappingFromDetected(detectSettlementColumns('meesho', settlementParsed.columns));
  const salesMapping = mappingFromDetected(detectSellerColumns(salesParsed.columns));

  console.log('✓ Detected and mapped columns');
  console.log(`  Settlement columns: ${Object.keys(settlementMapping).length} fields`);
  console.log(`  Sales columns: ${Object.keys(salesMapping).length} fields\n`);

  // Normalize rows
  const marketplaceTxns = normalizeRows(settlementParsed.rows, settlementMapping, 'meesho');
  const sellerTxns = normalizeRows(salesParsed.rows, salesMapping, 'seller');

  console.log(`✓ Normalized transactions:`);
  console.log(`  Marketplace transactions: ${marketplaceTxns.length}`);
  console.log(`  Seller transactions: ${sellerTxns.length}\n`);

  // Run reconciliation
  const { records, summary } = reconcile(sellerTxns, marketplaceTxns);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. COMPARE RESULTS
  // ─────────────────────────────────────────────────────────────────────────

  console.log('STEP 4: Compare Engine Output with Expected Results');
  console.log('─────────────────────────────────────────────────────────────────\n');

  console.log('Actual Reconciliation Results:\n');
  let actualCounts = {};
  for (const record of records) {
    actualCounts[record.status] = (actualCounts[record.status] || 0) + 1;
    const expected = expectedResults[record.order_id];
    const match = expected && expected.status === record.status ? '✓' : '✗';
    console.log(`  ${match} ${record.order_id}: ${record.status}`);
    if (expected && expected.status !== record.status) {
      console.log(`     Expected: ${expected.status}, Got: ${record.status}`);
    }
    if (record.difference !== undefined) {
      console.log(`     Difference: ₹${record.difference.toFixed(2)}`);
    }
  }

  console.log('\n' + '═'.repeat(65));
  console.log('RESULTS COMPARISON');
  console.log('═'.repeat(65) + '\n');

  console.log('Expected Summary:');
  for (const [status, count] of Object.entries(expectedCounts).sort()) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\nActual Summary:');
  for (const [status, count] of Object.entries(actualCounts).sort()) {
    console.log(`  ${status}: ${count}`);
  }

  // Compare
  console.log('\n' + '─'.repeat(65));
  let allMatch = true;
  for (const status of Object.keys(expectedCounts)) {
    const expected = expectedCounts[status] || 0;
    const actual = actualCounts[status] || 0;
    const match = expected === actual ? '✓' : '✗';
    if (expected !== actual) allMatch = false;
    console.log(`${match} ${status}: Expected ${expected}, Got ${actual}`);
  }

  console.log('\n' + '─'.repeat(65));
  console.log('Summary Comparison:');
  console.log(`✓ Total records: Expected ${Object.keys(expectedResults).length}, Got ${summary.total_records}`);
  console.log(`${summary.matched_count === 6 ? '✓' : '✗'} Matched: Expected 6, Got ${summary.matched_count}`);
  console.log(`${summary.needs_attention_count === 6 ? '✓' : '✗'} Needs attention: Expected 6, Got ${summary.needs_attention_count}`);

  console.log('\nFinancial Summary:');
  const f = summary.financial_summary;
  if (f.gross_sales !== undefined) console.log(`  Gross sales: ₹${f.gross_sales.toFixed(2)}`);
  if (f.settlement_total !== undefined) console.log(`  Settlement total: ₹${f.settlement_total.toFixed(2)}`);
  if (f.marketplace_fees !== undefined) console.log(`  Marketplace fees: ₹${f.marketplace_fees.toFixed(2)}`);
  if (f.difference_requiring_review !== undefined) console.log(`  Difference requiring review: ₹${f.difference_requiring_review.toFixed(2)}`);

  console.log('\n' + '═'.repeat(65));
  if (allMatch && summary.matched_count === 6 && summary.needs_attention_count === 6) {
    console.log('✓ TEST PASSED: Engine output matches expected results!');
  } else {
    console.log('✗ TEST FAILED: Engine output does not match expected results');
  }
  console.log('═'.repeat(65) + '\n');
}

await runTest();
