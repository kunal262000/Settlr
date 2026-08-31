import { describe, it, expect } from 'vitest';
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reconcile } from '../reconciliation';
import { detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from '../parsers';

const SAMPLE_DIR = join(__dirname, '..', '..', 'sample-data');

describe('DEBUG: Amazon reconciliation', () => {
  it('show all records', () => {
    const buf = readFileSync(join(SAMPLE_DIR, 'amazon-settlement-sample.xlsx'));
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const sRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false }) as Record<string, unknown>[];

    const csvText = readFileSync(join(SAMPLE_DIR, 'amazon-seller-register-sample.csv'), 'utf-8');
    const slRows = Papa.parse<Record<string, unknown>>(csvText, { header: true, skipEmptyLines: true }).data;

    const sCols  = Object.keys(sRows[0]);
    const slCols = Object.keys(slRows[0]);

    const sDetected  = detectSettlementColumns('amazon', sCols);
    const slDetected = detectSellerColumns(slCols);

    console.log('=== Settlement column detection ===');
    for (const d of sDetected) {
      console.log(`  ${d.internalField}: ${d.detectedColumn} (${d.confidence})`);
    }

    console.log('=== Seller column detection ===');
    for (const d of slDetected) {
      console.log(`  ${d.internalField}: ${d.detectedColumn} (${d.confidence})`);
    }

    const sMapping  = mappingFromDetected(sDetected);
    const slMapping = mappingFromDetected(slDetected);

    console.log('=== Mappings ===');
    console.log('Settlement mapping:', JSON.stringify(sMapping));
    console.log('Seller mapping:', JSON.stringify(slMapping));

    const mTxns = normalizeRows(sRows, sMapping, 'amazon');
    const sTxns = normalizeRows(slRows, slMapping, 'seller');

    console.log(`=== Normalized: ${mTxns.length} marketplace txns, ${sTxns.length} seller txns ===`);

    // Show first few marketplace txns
    console.log('First 3 marketplace txns:');
    for (const t of mTxns.slice(0, 3)) {
      console.log(JSON.stringify(t));
    }

    // Show first few seller txns
    console.log('First 3 seller txns:');
    for (const t of sTxns.slice(0, 3)) {
      console.log(JSON.stringify(t));
    }

    const { records } = reconcile(sTxns, mTxns);

    // Show return orders
    const returnIds = ['AMZ1003', 'AMZ1014'];
    const returnMarket = mTxns.filter(t => returnIds.includes(t.order_id));
    console.log('\n=== RETURN ORDERS (marketplace) ===');
    for (const t of returnMarket) {
      console.log(JSON.stringify({
        order_id: t.order_id,
        gross_amount: t.gross_amount,
        commission_amount: t.commission_amount,
        shipping_amount: t.shipping_amount,
        return_amount: t.return_amount,
        tcs_amount: t.tcs_amount,
        adjustment_amount: t.adjustment_amount,
        net_amount: t.net_amount,
        transaction_type: t.transaction_type,
      }));
    }

    console.log('\n=== All records ===');
    for (const r of records) {
      console.log(`${r.order_id} | ${r.status} | expected=${r.expected_amount} actual=${r.marketplace_amount} diff=${r.difference}`);
    }

    const counts: Record<string, number> = {};
    for (const r of records) counts[r.status] = (counts[r.status] || 0) + 1;
    console.log('\n=== COUNTS ===');
    console.log(counts);

    // Force at least one assertion
    expect(records.length).toBeGreaterThan(0);
  });
});
