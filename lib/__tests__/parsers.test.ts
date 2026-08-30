import { describe, it, expect } from 'vitest';
import * as XLSX from '@e965/xlsx';
import {
  parseFileBuffer,
  isParseError,
  validateFile,
  detectSettlementColumns,
  normalizeRows,
  mappingFromDetected,
} from '../parsers';

describe('validateFile', () => {
  it('rejects unsupported extensions', () => {
    expect(validateFile('report.pdf', 1000)).toMatch(/unsupported file type/i);
  });
  it('rejects oversized files', () => {
    expect(validateFile('report.csv', 30 * 1024 * 1024)).toMatch(/25MB/);
  });
  it('rejects empty files', () => {
    expect(validateFile('report.csv', 0)).toMatch(/empty/i);
  });
  it('accepts a reasonably sized csv/xlsx/xls', () => {
    expect(validateFile('report.csv', 1000)).toBeNull();
    expect(validateFile('report.xlsx', 1000)).toBeNull();
    expect(validateFile('report.xls', 1000)).toBeNull();
  });
});

describe('parseFileBuffer: CSV', () => {
  it('parses a well-formed CSV into rows and columns', async () => {
    const csv = 'Order ID,Amount\nORD1,100\nORD2,200\n';
    const result = await parseFileBuffer('test.csv', Buffer.from(csv));
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.rowCount).toBe(2);
      expect(result.columns).toEqual(['Order ID', 'Amount']);
    }
  });

  it('errors on a CSV with only headers and no data rows', async () => {
    const result = await parseFileBuffer('test.csv', Buffer.from('Order ID,Amount\n'));
    expect(isParseError(result)).toBe(true);
  });

  it('strips dangerous prototype-pollution keys from parsed rows (defense-in-depth)', async () => {
    const csv = '__proto__,Order ID,constructor\nbad,ORD1,alsoBad\n';
    const result = await parseFileBuffer('test.csv', Buffer.from(csv));
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.columns).not.toContain('__proto__');
      expect(result.columns).not.toContain('constructor');
      expect(result.columns).toContain('Order ID');
      expect(Object.prototype.hasOwnProperty.call(result.rows[0], '__proto__')).toBe(false);
      // Confirm the global Object.prototype itself was never touched.
      expect(({} as Record<string, unknown>).bad).toBeUndefined();
    }
  });
});

describe('parseFileBuffer: XLSX', () => {
  it('parses a real XLSX workbook built with the same library', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { 'Order ID': 'ORD1', Amount: 500 },
      { 'Order ID': 'ORD2', Amount: 750 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const result = await parseFileBuffer('test.xlsx', buffer);
    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.rowCount).toBe(2);
      expect(result.rows[0]['Order ID']).toBe('ORD1');
    }
  });

  it('errors gracefully on a corrupted/non-spreadsheet buffer', async () => {
    const result = await parseFileBuffer('test.xlsx', Buffer.from('this is not a real xlsx file'));
    expect(isParseError(result)).toBe(true);
  });
});

describe('detectSettlementColumns: per-marketplace accuracy', () => {
  it('detects Amazon long-format columns without false positives on generic "amount"', () => {
    const headers = ['order-id', 'transaction-type', 'amount-type', 'amount-description', 'amount', 'posted-date', 'sku'];
    const detected = detectSettlementColumns('amazon', headers);
    const byField = Object.fromEntries(detected.map((d) => [d.internalField, d.detectedColumn]));

    expect(byField.order_id).toBe('order-id');
    expect(byField.net_amount).toBe('amount');
    expect(byField.transaction_date).toBe('posted-date');
    // The generic "amount" column must not also be claimed by unrelated
    // fields like gross_amount/commission_amount/shipping_amount — that
    // was a real bug caught during manual testing.
    expect(byField.gross_amount).toBeNull();
    expect(byField.commission_amount).toBeNull();
    expect(byField.shipping_amount).toBeNull();
  });

  it('detects Flipkart wide-format columns without cross-field collisions', () => {
    const headers = ['Order ID', 'Order Date', 'SKU', 'Total Offer Price', 'Commission', 'Fixed Fee', 'Shipping Fee', 'TCS', 'Final Settlement Amount'];
    const detected = detectSettlementColumns('flipkart', headers);
    const byField = Object.fromEntries(detected.map((d) => [d.internalField, d.detectedColumn]));

    expect(byField.order_id).toBe('Order ID');
    expect(byField.commission_amount).toBe('Commission');
    expect(byField.shipping_amount).toBe('Shipping Fee');
    expect(byField.net_amount).toBe('Final Settlement Amount');
    // No dedicated return column in this file — must stay undetected
    // rather than guessing (this was the "Shipping Fee" collision bug).
    expect(byField.return_amount).toBeNull();
  });

  it('detects Meesho columns including punctuation-normalized aliases', () => {
    const headers = ['Sub Order No', 'Final Settlement Amount', 'Commission (Including GST)', 'Forward Shipping Charges'];
    const detected = detectSettlementColumns('meesho', headers);
    const byField = Object.fromEntries(detected.map((d) => [d.internalField, d.detectedColumn]));

    expect(byField.order_id).toBe('Sub Order No');
    expect(byField.net_amount).toBe('Final Settlement Amount');
    expect(byField.commission_amount).toBe('Commission (Including GST)');
  });
});

describe('normalizeRows', () => {
  it('skips rows with no order id rather than inventing one', () => {
    const rows = [{ OrderId: 'ORD1', Amount: '100' }, { OrderId: '', Amount: '50' }, { OrderId: null, Amount: '20' }];
    const normalized = normalizeRows(rows, { order_id: 'OrderId', net_amount: 'Amount' }, 'seller');
    expect(normalized).toHaveLength(1);
    expect(normalized[0].order_id).toBe('ORD1');
  });

  it('parses currency-formatted amounts (₹, commas, parenthesized negatives)', () => {
    const rows = [{ OrderId: 'ORD1', Amount: '₹1,499.50' }, { OrderId: 'ORD2', Amount: '(45.00)' }];
    const normalized = normalizeRows(rows, { order_id: 'OrderId', net_amount: 'Amount' }, 'seller');
    expect(normalized[0].net_amount).toBe(1499.5);
    expect(normalized[1].net_amount).toBe(-45);
  });

  it('leaves unmapped optional fields undefined rather than defaulting to zero', () => {
    const rows = [{ OrderId: 'ORD1' }];
    const normalized = normalizeRows(rows, { order_id: 'OrderId' }, 'seller');
    expect(normalized[0].gross_amount).toBeUndefined();
    expect(normalized[0].net_amount).toBeUndefined();
  });
});

describe('mappingFromDetected', () => {
  it('only includes fields that were actually detected', () => {
    const detected = detectSettlementColumns('meesho', ['Sub Order No']);
    const mapping = mappingFromDetected(detected);
    expect(mapping.order_id).toBe('Sub Order No');
    expect(mapping.net_amount).toBeUndefined();
  });
});
