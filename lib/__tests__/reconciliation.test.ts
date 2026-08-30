import { describe, it, expect } from 'vitest';
import { reconcile } from '../reconciliation';
import type { NormalizedTransaction } from '../types';

function seller(order_id: string, overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return { source_platform: 'seller', order_id, gross_amount: 1000, transaction_date: '2026-08-01', ...overrides };
}

function marketplace(order_id: string, overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return { source_platform: 'amazon', order_id, net_amount: 1000, transaction_date: '2026-08-03', ...overrides };
}

describe('reconcile: status classification', () => {
  it('classifies an exact match as MATCHED', () => {
    const { records } = reconcile([seller('A1')], [marketplace('A1')]);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('MATCHED');
    expect(records[0].difference).toBe(0);
  });

  it('treats a difference within ₹1 tolerance as MATCHED (rounding)', () => {
    const { records } = reconcile([seller('A1', { gross_amount: 1000 })], [marketplace('A1', { net_amount: 999.5 })]);
    expect(records[0].status).toBe('MATCHED');
  });

  it('classifies an overpayment (marketplace paid more than expected) as AMOUNT_MISMATCH', () => {
    const { records } = reconcile([seller('A1', { gross_amount: 1000 })], [marketplace('A1', { net_amount: 1200 })]);
    expect(records[0].status).toBe('AMOUNT_MISMATCH');
    expect(records[0].difference).toBe(-200);
  });

  it('classifies a shortfall across multiple marketplace transactions as AMOUNT_MISMATCH', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [marketplace('A1', { net_amount: 500 }), marketplace('A1', { net_amount: 100 })]
    );
    expect(records[0].status).toBe('AMOUNT_MISMATCH');
    expect(records[0].difference).toBe(400);
  });

  it('classifies a seller order with no marketplace record as MISSING_SETTLEMENT', () => {
    const { records } = reconcile([seller('A1')], []);
    expect(records[0].status).toBe('MISSING_SETTLEMENT');
    expect(records[0].marketplace_amount).toBeUndefined();
  });

  it('classifies a marketplace record with no seller order as UNMATCHED_MARKETPLACE_RECORD', () => {
    const { records } = reconcile([], [marketplace('A1')]);
    expect(records[0].status).toBe('UNMATCHED_MARKETPLACE_RECORD');
  });

  it('classifies a repeated order id in the seller file as DUPLICATE_RECORD', () => {
    const { records } = reconcile([seller('A1'), seller('A1')], [marketplace('A1')]);
    expect(records[0].status).toBe('DUPLICATE_RECORD');
  });

  it('classifies a return-flagged mismatch as RETURN_DISCREPANCY', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [marketplace('A1', { net_amount: 700, status: 'RTO' })]
    );
    expect(records[0].status).toBe('RETURN_DISCREPANCY');
  });

  it('classifies a single-transaction shortfall as AMOUNT_MISMATCH when nothing signals it is still pending', () => {
    // This is the common case for wide-format marketplaces (Flipkart,
    // Meesho) where one row IS the complete settlement — a shortfall here
    // must not be mislabeled "partial" just because there's only one row.
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [marketplace('A1', { net_amount: 400 })]
    );
    expect(records[0].status).toBe('AMOUNT_MISMATCH');
  });

  it('classifies a shortfall as PARTIAL_SETTLEMENT only when the source data signals a pending/processing state', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [marketplace('A1', { net_amount: 400, status: 'Processing' })]
    );
    expect(records[0].status).toBe('PARTIAL_SETTLEMENT');
  });

  it('classifies a marketplace group with no derivable amount as NEEDS_REVIEW', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [marketplace('A1', { net_amount: undefined, transaction_date: '2026-08-03' })]
    );
    expect(records[0].status).toBe('NEEDS_REVIEW');
  });

  it('classifies a seller record with no comparable amount as NEEDS_REVIEW', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: undefined })],
      [marketplace('A1', { net_amount: 900 })]
    );
    expect(records[0].status).toBe('NEEDS_REVIEW');
  });
});

describe('reconcile: one order, multiple marketplace transactions', () => {
  it('sums multiple net_amount rows sharing an order id (Amazon long-format style)', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [
        marketplace('A1', { net_amount: 1200 }), // Principal
        marketplace('A1', { net_amount: -150 }), // Commission (negative deduction row)
        marketplace('A1', { net_amount: -50 }), // Shipping fee
      ]
    );
    expect(records[0].status).toBe('MATCHED');
    expect(records[0].marketplace_amount).toBe(1000);
    expect(records[0].marketplace_records).toHaveLength(3);
  });

  it('derives net amount from components when no net_amount column exists', () => {
    const { records } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [
        marketplace('A1', {
          net_amount: undefined,
          gross_amount: 1000,
          commission_amount: 100,
          shipping_amount: 50,
        }),
      ]
    );
    // 1000 - (100 + 50) = 850. No pending/processing signal in the source
    // data, so this is a difference requiring review, not an assumed
    // partial settlement.
    expect(records[0].marketplace_amount).toBe(850);
    expect(records[0].status).toBe('AMOUNT_MISMATCH');
  });
});

describe('reconcile: financial summary', () => {
  it('only includes categories actually present in the source data', () => {
    const { summary } = reconcile(
      [seller('A1', { gross_amount: 1000 })],
      [marketplace('A1', { net_amount: 900, commission_amount: 100 })]
    );
    expect(summary.financial_summary.gross_sales).toBe(1000);
    expect(summary.financial_summary.marketplace_fees).toBe(100);
    // No shipping/return/tcs/adjustment fields anywhere in the source data —
    // must not be fabricated as zero.
    expect(summary.financial_summary.shipping).toBeUndefined();
    expect(summary.financial_summary.returns).toBeUndefined();
    expect(summary.financial_summary.tcs).toBeUndefined();
  });

  it('computes counts and amount-requiring-review correctly across a mixed batch', () => {
    const { summary } = reconcile(
      [seller('A1', { gross_amount: 1000 }), seller('A2', { gross_amount: 500 }), seller('A3', { gross_amount: 200 })],
      [marketplace('A1', { net_amount: 1000 }), marketplace('A2', { net_amount: 450 })]
      // A3 has no marketplace record at all -> MISSING_SETTLEMENT
    );
    expect(summary.total_records).toBe(3);
    expect(summary.matched_count).toBe(1);
    expect(summary.needs_attention_count).toBe(2);
    // A2 mismatch contributes |500-450|=50; A3 missing settlement has no
    // difference figure (nothing to compare against), so only A2 counts.
    expect(summary.amount_requiring_review).toBe(50);
  });
});

describe('reconcile: sorting', () => {
  it('sorts records needing attention before matched records', () => {
    const { records } = reconcile(
      [seller('Z9', { gross_amount: 1000 }), seller('A1', { gross_amount: 1000 })],
      [marketplace('Z9', { net_amount: 1000 }), marketplace('A1', { net_amount: 500 })]
    );
    expect(records[0].status).not.toBe('MATCHED');
    expect(records[records.length - 1].status).toBe('MATCHED');
  });
});
