import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFileBuffer, isParseError, detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from '../parsers';
import { reconcile } from '../reconciliation';

describe('sample-data end-to-end', () => {
  it('produces the correct status mix for the generated sample files', async () => {
    const dir = join(__dirname, '..', '..', 'sample-data');
    const settlement = await parseFileBuffer('meesho-settlement-sample.xlsx', readFileSync(join(dir, 'meesho-settlement-sample.xlsx')));
    const sales = await parseFileBuffer('meesho-seller-register-sample.csv', readFileSync(join(dir, 'meesho-seller-register-sample.csv')));
    expect(isParseError(settlement)).toBe(false);
    expect(isParseError(sales)).toBe(false);
    if (isParseError(settlement) || isParseError(sales)) return;

    const mTxns = normalizeRows(settlement.rows, mappingFromDetected(detectSettlementColumns('meesho', settlement.columns)), 'meesho');
    const sTxns = normalizeRows(sales.rows, mappingFromDetected(detectSellerColumns(sales.columns)), 'seller');

    const { records } = reconcile(sTxns, mTxns);
    const count = (s: string) => records.filter((r) => r.status === s).length;

    expect(count('MATCHED')).toBe(14);
    expect(count('AMOUNT_MISMATCH')).toBe(3);
    expect(count('MISSING_SETTLEMENT')).toBe(2);
    expect(count('UNMATCHED_MARKETPLACE_RECORD')).toBe(2);
    expect(count('DUPLICATE_RECORD')).toBe(1);
    expect(count('RETURN_DISCREPANCY')).toBe(3);
  });
});
