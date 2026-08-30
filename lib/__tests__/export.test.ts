import { describe, it, expect } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { buildExportWorkbook } from '../export';
import type { ReconciliationJob, ReconciliationRecord } from '../types';

function makeJob(overrides: Partial<ReconciliationJob> = {}): ReconciliationJob {
  return {
    id: 'job-1',
    user_id: 'user-1',
    marketplace: 'amazon',
    status: 'completed',
    settlement_file_name: 'settlement.csv',
    settlement_file_rows: 2,
    sales_file_name: 'sales.csv',
    sales_file_rows: 2,
    column_mapping: {},
    total_records: 2,
    matched_count: 1,
    needs_attention_count: 1,
    amount_requiring_review: 100,
    financial_summary: { gross_sales: 1000, calculated_net: 900 },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const records: ReconciliationRecord[] = [
  {
    order_id: 'A1',
    status: 'MATCHED',
    marketplace_records: [],
    expected_amount: 500,
    marketplace_amount: 500,
    difference: 0,
    reason: 'Matched.',
  },
  {
    order_id: 'A2',
    status: 'AMOUNT_MISMATCH',
    marketplace_records: [],
    expected_amount: 500,
    marketplace_amount: 400,
    difference: 100,
    reason: 'Difference requiring review.',
  },
];

describe('buildExportWorkbook', () => {
  it('builds a valid, parseable XLSX buffer without throwing', () => {
    const buffer = buildExportWorkbook(makeJob(), records);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Round-trip: re-parse what we just wrote to confirm it's structurally valid.
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Summary');
    expect(wb.SheetNames).toContain('All Records');
    expect(wb.SheetNames).toContain('Matched');
    expect(wb.SheetNames).toContain('Amount Mismatches');
  });

  it('the All Records sheet contains exactly the records passed in', () => {
    const buffer = buildExportWorkbook(makeJob(), records);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = XLSX.utils.sheet_to_json(wb.Sheets['All Records']) as Record<string, unknown>[];
    expect(sheet).toHaveLength(2);
    expect(sheet.map((r) => r['Order ID'])).toEqual(['A1', 'A2']);
  });

  it('the Matched sheet only contains matched records', () => {
    const buffer = buildExportWorkbook(makeJob(), records);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = XLSX.utils.sheet_to_json(wb.Sheets['Matched']) as Record<string, unknown>[];
    expect(sheet).toHaveLength(1);
    expect(sheet[0]['Order ID']).toBe('A1');
  });

  it('handles an empty record set without throwing', () => {
    const buffer = buildExportWorkbook(makeJob({ total_records: 0, matched_count: 0, needs_attention_count: 0 }), []);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
