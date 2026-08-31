/**
 * Test script: runs reconciliation against the generated sample files and
 * verifies results match expected scenario counts.
 *
 * Run: node scripts/test-reconciliation.mjs
 */
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcile } from '../lib/reconciliation.js';
import { detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from '../lib/parsers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'sample-data');

function parseSettlement(filePath) {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function parseCSV(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data;
}

function runReconciliation(settlementFile, sellerFile, marketplace, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${label}`);
  console.log('='.repeat(60));

  const sRows = parseSettlement(settlementFile);
  const slRows = parseCSV(sellerFile);

  const sCols = Object.keys(sRows[0]);
  const slCols = Object.keys(slRows[0]);

  const sDetected  = detectSettlementColumns(marketplace, sCols);
  const slDetected = detectSellerColumns(slCols);

  const sMapping  = mappingFromDetected(sDetected);
  const slMapping = mappingFromDetected(slDetected);

  console.log('\nSettlement column detection:');
  for (const d of sDetected) {
    if (d.detectedColumn) {
      console.log(`  ${d.internalField} -> "${d.detectedColumn}" (${d.confidence})`);
    }
  }

  console.log('\nSeller register column detection:');
  for (const d of slDetected) {
    if (d.detectedColumn) {
      console.log(`  ${d.internalField} -> "${d.detectedColumn}" (${d.confidence})`);
    }
  }

  if (!sMapping.order_id) {
    console.error('  ERROR: order_id not detected in settlement file!');
    return;
  }
  if (!slMapping.order_id) {
    console.error('  ERROR: order_id not detected in seller register file!');
    return;
  }

  const marketplaceTxns = normalizeRows(sRows, sMapping, marketplace);
  const sellerTxns      = normalizeRows(slRows, slMapping, 'seller');

  console.log(`\n  Settlement rows: ${sRows.length} -> ${marketplaceTxns.length} normalized transactions`);
  console.log(`  Seller rows:     ${slRows.length} -> ${sellerTxns.length} normalized transactions`);

  const { records, summary } = reconcile(sellerTxns, marketplaceTxns);

  const counts = {};
  for (const r of records) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }

  console.log('\n  Reconciliation Results:');
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`    ${status}: ${count}`);
  }
  console.log(`\n  Summary:`);
  console.log(`    Total records:             ${summary.total_records}`);
  console.log(`    Matched:                   ${summary.matched_count}`);
  console.log(`    Needs attention:            ${summary.needs_attention_count}`);
  console.log(`    Amount requiring review:    ₹${summary.amount_requiring_review.toFixed(2)}`);

  if (summary.financial_summary) {
    console.log(`\n  Financial Summary:`);
    const f = summary.financial_summary;
    if (f.gross_sales !== undefined)       console.log(`    Gross sales:               ₹${f.gross_sales.toFixed(2)}`);
    if (f.marketplace_fees !== undefined)  console.log(`    Marketplace fees:          ₹${f.marketplace_fees.toFixed(2)}`);
    if (f.shipping !== undefined)          console.log(`    Shipping:                  ₹${f.shipping.toFixed(2)}`);
    if (f.returns !== undefined)           console.log(`    Returns:                   ₹${f.returns.toFixed(2)}`);
    if (f.tcs !== undefined)              console.log(`    TCS:                       ₹${f.tcs.toFixed(2)}`);
    if (f.calculated_net !== undefined)    console.log(`    Calculated net:            ₹${f.calculated_net.toFixed(2)}`);
    if (f.settlement_total !== undefined)  console.log(`    Settlement total:          ₹${f.settlement_total.toFixed(2)}`);
  }

  return { records, summary, counts };
}

const MARKETPLACES = [
  {
    label: 'Amazon',
    marketplace: 'amazon',
    settlement: 'amazon-settlement-sample.xlsx',
    seller: 'amazon-seller-register-sample.csv',
  },
  {
    label: 'Flipkart',
    marketplace: 'flipkart',
    settlement: 'flipkart-settlement-sample.xlsx',
    seller: 'flipkart-seller-register-sample.csv',
  },
  {
    label: 'Meesho',
    marketplace: 'meesho',
    settlement: 'meesho-settlement-sample.xlsx',
    seller: 'meesho-seller-register-sample.csv',
  },
];

for (const mp of MARKETPLACES) {
  runReconciliation(
    join(outDir, mp.settlement),
    join(outDir, mp.seller),
    mp.marketplace,
    mp.label
  );
}
