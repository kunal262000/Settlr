/**
 * Reconciliation integration tests using generated sample files.
 * Verifies that the reconciliation engine produces expected results
 * for Amazon, Flipkart, and Meesho sample data.
 *
 * Run: npm test -- lib/__tests__/test-marketplaces.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcile } from '../reconciliation';
import { detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from '../parsers';

const SAMPLE_DIR = join(__dirname, '..', '..', 'sample-data');

function parseXlsx(filePath: string) {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Record<string, unknown>[];
}

function parseCsv(filePath: string) {
  const text = readFileSync(filePath, 'utf-8');
  const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
  return result.data;
}

interface TestCase {
  label: string;
  marketplace: 'amazon' | 'flipkart' | 'meesho';
  settlementFile: string;
  sellerFile: string;
  expectedMatched: number;
  expectedMismatch: number;
  expectedMissingSettlement: number;
  expectedUnmatchedMarketplace: number;
  expectedDuplicate: number;
  expectedReturnDiscrepancy: number;
  expectedNeedsReview: number;
}

const CASES: TestCase[] = [
  {
    label: 'Amazon',
    marketplace: 'amazon',
    settlementFile: 'amazon-settlement-sample.xlsx',
    sellerFile: 'amazon-seller-register-sample.csv',
    expectedMatched: 15,
    expectedMismatch: 3,
    expectedMissingSettlement: 2,
    expectedUnmatchedMarketplace: 2,
    expectedDuplicate: 1,
    expectedReturnDiscrepancy: 2,
    expectedNeedsReview: 0,
  },
  {
    label: 'Flipkart',
    marketplace: 'flipkart',
    settlementFile: 'flipkart-settlement-sample.xlsx',
    sellerFile: 'flipkart-seller-register-sample.csv',
    expectedMatched: 15,
    expectedMismatch: 3,
    expectedMissingSettlement: 2,
    expectedUnmatchedMarketplace: 2,
    expectedDuplicate: 1,
    expectedReturnDiscrepancy: 2,
    expectedNeedsReview: 0,
  },
  {
    label: 'Meesho',
    marketplace: 'meesho',
    settlementFile: 'meesho-settlement-sample.xlsx',
    sellerFile: 'meesho-seller-register-sample.csv',
    expectedMatched: 14,
    expectedMismatch: 3,
    expectedMissingSettlement: 2,
    expectedUnmatchedMarketplace: 2,
    expectedDuplicate: 1,
    expectedReturnDiscrepancy: 3,
    expectedNeedsReview: 0,
  },
];

describe('Sample file reconciliation', () => {
  for (const tc of CASES) {
    describe(tc.label, () => {
      let records: ReturnType<typeof reconcile>['records'];
      let summary: ReturnType<typeof reconcile>['summary'];

      beforeAll(() => {
        const sRows  = parseXlsx(join(SAMPLE_DIR, tc.settlementFile));
        const slRows = parseCsv(join(SAMPLE_DIR, tc.sellerFile));

        const sCols  = Object.keys(sRows[0]);
        const slCols = Object.keys(slRows[0]);

        const sDetected  = detectSettlementColumns(tc.marketplace, sCols);
        const slDetected = detectSellerColumns(slCols);

        const sMapping  = mappingFromDetected(sDetected);
        const slMapping = mappingFromDetected(slDetected);

        const marketplaceTxns = normalizeRows(sRows, sMapping, tc.marketplace);
        const sellerTxns      = normalizeRows(slRows, slMapping, 'seller');

        const result = reconcile(sellerTxns, marketplaceTxns);
        records  = result.records;
        summary  = result.summary;
      });

      it('should detect order_id in settlement file', () => {
        const sRows  = parseXlsx(join(SAMPLE_DIR, tc.settlementFile));
        const sCols  = Object.keys(sRows[0]);
        const sDetected = detectSettlementColumns(tc.marketplace, sCols);
        const sMapping  = mappingFromDetected(sDetected);
        expect(sMapping.order_id).toBeDefined();
      });

      it('should detect order_id in seller register', () => {
        const slRows = parseCsv(join(SAMPLE_DIR, tc.sellerFile));
        const slCols = Object.keys(slRows[0]);
        const slDetected = detectSellerColumns(slCols);
        const slMapping  = mappingFromDetected(slDetected);
        expect(slMapping.order_id).toBeDefined();
      });

      it(`should have ${tc.expectedMatched} MATCHED records`, () => {
        const matched = records.filter(r => r.status === 'MATCHED').length;
        expect(matched).toBe(tc.expectedMatched);
      });

      it(`should have ${tc.expectedMismatch} AMOUNT_MISMATCH records`, () => {
        const mismatches = records.filter(r => r.status === 'AMOUNT_MISMATCH').length;
        expect(mismatches).toBe(tc.expectedMismatch);
      });

      it(`should have ${tc.expectedMissingSettlement} MISSING_SETTLEMENT records`, () => {
        const missing = records.filter(r => r.status === 'MISSING_SETTLEMENT').length;
        expect(missing).toBe(tc.expectedMissingSettlement);
      });

      it(`should have ${tc.expectedUnmatchedMarketplace} UNMATCHED_MARKETPLACE_RECORD records`, () => {
        const unmatched = records.filter(r => r.status === 'UNMATCHED_MARKETPLACE_RECORD').length;
        expect(unmatched).toBe(tc.expectedUnmatchedMarketplace);
      });

      it(`should have ${tc.expectedDuplicate} DUPLICATE_RECORD records`, () => {
        const dupes = records.filter(r => r.status === 'DUPLICATE_RECORD').length;
        expect(dupes).toBe(tc.expectedDuplicate);
      });

      it(`should have ${tc.expectedReturnDiscrepancy} RETURN_DISCREPANCY records`, () => {
        const returns = records.filter(r => r.status === 'RETURN_DISCREPANCY').length;
        expect(returns).toBe(tc.expectedReturnDiscrepancy);
      });

      it(`should have ${tc.expectedNeedsReview} NEEDS_REVIEW records`, () => {
        const review = records.filter(r => r.status === 'NEEDS_REVIEW').length;
        expect(review).toBe(tc.expectedNeedsReview);
      });

      it('total records should equal sum of all categories', () => {
        const matched       = records.filter(r => r.status === 'MATCHED').length;
        const mismatches   = records.filter(r => r.status === 'AMOUNT_MISMATCH').length;
        const missing      = records.filter(r => r.status === 'MISSING_SETTLEMENT').length;
        const unmatched    = records.filter(r => r.status === 'UNMATCHED_MARKETPLACE_RECORD').length;
        const dupes       = records.filter(r => r.status === 'DUPLICATE_RECORD').length;
        const returns     = records.filter(r => r.status === 'RETURN_DISCREPANCY').length;
        const review      = records.filter(r => r.status === 'NEEDS_REVIEW').length;
        const total = matched + mismatches + missing + unmatched + dupes + returns + review;
        expect(total).toBe(records.length);
        expect(total).toBe(summary.total_records);
      });

      it('matched + needs_attention should equal total', () => {
        expect(summary.matched_count + summary.needs_attention_count).toBe(summary.total_records);
      });

      it('financial summary should have gross_sales', () => {
        expect(summary.financial_summary.gross_sales).toBeDefined();
      });

      it('financial summary should have calculated_net', () => {
        expect(summary.financial_summary.calculated_net).toBeDefined();
      });

      it('financial summary should have settlement_total', () => {
        expect(summary.financial_summary.settlement_total).toBeDefined();
      });
    });
  }
});
