import { describe, it, expect } from 'vitest';
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reconcile } from '../reconciliation';
import { detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from '../parsers';

const SAMPLE_DIR = join(__dirname, '..', '..', 'sample-data');

describe('DEBUG: Meesho reconciliation detail', () => {
  it('show every field for return orders', () => {
    const buf = readFileSync(join(SAMPLE_DIR, 'meesho-settlement-sample.xlsx'));
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const sRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false }) as Record<string, unknown>[];

    const csvText = readFileSync(join(SAMPLE_DIR, 'meesho-seller-register-sample.csv'), 'utf-8');
    const slRows = Papa.parse<Record<string, unknown>>(csvText, { header: true, skipEmptyLines: true }).data;

    const sDetected  = detectSettlementColumns('meesho', Object.keys(sRows[0]));
    const slDetected = detectSellerColumns(Object.keys(slRows[0]));
    const sMapping  = mappingFromDetected(sDetected);
    const slMapping = mappingFromDetected(slDetected);

    const mTxns = normalizeRows(sRows, sMapping, 'meesho');
    const sTxns = normalizeRows(slRows, slMapping, 'seller');

    // Find return orders
    const returnSeller = sTxns.filter(t => t.order_id === 'MH1003' || t.order_id === 'MH1014');
    const returnMarket = mTxns.filter(t => t.order_id === 'MH1003' || t.order_id === 'MH1014');

    console.log('=== RETURN ORDERS (seller) ===');
    for (const t of returnSeller) {
      console.log(JSON.stringify({
        order_id: t.order_id,
        gross_amount: t.gross_amount,
        commission_amount: t.commission_amount,
        shipping_amount: t.shipping_amount,
        return_amount: t.return_amount,
        tcs_amount: t.tcs_amount,
        adjustment_amount: t.adjustment_amount,
        net_amount: t.net_amount,
      }));
    }

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
        status: t.status,
      }));
    }

    // Show aggregateMarketplaceGroup behavior
    const group = (records: typeof mTxns, orderId: string) => {
      const groupRecords = records.filter(r => r.order_id === orderId);
      console.log(`\n=== aggregate for ${orderId} ===`);
      for (const r of groupRecords) {
        console.log(`  net=${r.net_amount} gross=${r.gross_amount} comm=${r.commission_amount} ship=${r.shipping_amount} ret=${r.return_amount} tcs=${r.tcs_amount} adj=${r.adjustment_amount}`);
      }
      const withNet = groupRecords.filter(r => r.net_amount !== undefined);
      console.log(`  withNet.length=${withNet.length}`);
      if (withNet.length > 0) {
        const sum = withNet.reduce((acc, r) => acc + (r.net_amount ?? 0), 0);
        console.log(`  summed net_amount=${sum}`);
      }
      const anyComponent = groupRecords.some(r =>
        r.gross_amount !== undefined || r.commission_amount !== undefined ||
        r.shipping_amount !== undefined || r.return_amount !== undefined ||
        r.tcs_amount !== undefined || r.adjustment_amount !== undefined
      );
      console.log(`  anyComponent=${anyComponent}`);
      if (anyComponent) {
        const derived = groupRecords.reduce((acc, r) => {
          const gross = r.gross_amount ?? 0;
          const deductions = (r.commission_amount ?? 0) + (r.shipping_amount ?? 0) +
            (r.return_amount ?? 0) + (r.tcs_amount ?? 0) -
            (r.adjustment_amount ?? 0) - (r.refund_amount ?? 0);
          return acc + (gross - deductions);
        }, 0);
        console.log(`  derived net=${derived}`);
      }
    };

    group(mTxns, 'MH1003');
    group(mTxns, 'MH1014');

    // Show mismatch orders
    const mismatchIds = ['MH1005', 'MH1012', 'MH1019'];
    console.log('\n=== MISMATCH ORDERS ===');
    for (const id of mismatchIds) {
      const s = sTxns.find(t => t.order_id === id);
      const m = mTxns.filter(t => t.order_id === id);
      console.log(`\n${id}:`);
      console.log(`  seller: net=${s?.net_amount} (expected=${s?.net_amount})`);
      for (const tx of m) {
        console.log(`  market: net=${tx.net_amount} gross=${tx.gross_amount} comm=${tx.commission_amount} ship=${tx.shipping_amount} ret=${tx.return_amount} tcs=${tx.tcs_amount} adj=${tx.adjustment_amount}`);
      }
    }

    const csvText2 = readFileSync(join(SAMPLE_DIR, 'meesho-seller-register-sample.csv'), 'utf-8');
    const allSellerRows = Papa.parse<Record<string, unknown>>(csvText2, { header: true, skipEmptyLines: true }).data;
    console.log('\n=== RAW SELLER ROWS FOR MISMATCH IDS ===');
    for (const id of mismatchIds) {
      const row = allSellerRows.find(r => r['Order ID'] === id);
      console.log(`${id}: Expected Settlement Amount = ${row?.['Expected Settlement Amount']}`);
    }

    // And raw settlement file
    console.log('\n=== RAW SETTLEMENT ROWS FOR MISMATCH IDS ===');
    for (const id of mismatchIds) {
      const row = sRows.find(r => r['Sub Order No'] === id);
      console.log(`${id}: Final Settlement Amount = ${row?.['Final Settlement Amount']}`);
    }

    const { records } = reconcile(sTxns, mTxns);
    const counts: Record<string, number> = {};
    for (const r of records) counts[r.status] = (counts[r.status] || 0) + 1;
    console.log('\n=== FINAL COUNTS ===');
    console.log(counts);

    expect(records.length).toBeGreaterThan(0);
  });
});
