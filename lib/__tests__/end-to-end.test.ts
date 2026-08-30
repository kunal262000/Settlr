import { describe, it, expect } from 'vitest';
import { parseFileBuffer, isParseError, detectSettlementColumns, detectSellerColumns, mappingFromDetected, normalizeRows } from '../parsers';
import { reconcile } from '../reconciliation';

/**
 * These fixtures model the documented real-world structure of each
 * marketplace's settlement export (see README "Marketplace column
 * aliases" section for sourcing) — not files pulled directly from a
 * seller's account, since none were available to test against. They're
 * built to stress the same structural quirks real files have: Amazon's
 * long/multi-row-per-order format, Flipkart's wide single-row format with
 * a status column, and Meesho's punctuation-heavy headers.
 */

async function runPipeline(marketplace: 'amazon' | 'flipkart' | 'meesho', settlementCsv: string, salesCsv: string) {
  const settlementParsed = await parseFileBuffer('settlement.csv', Buffer.from(settlementCsv));
  const salesParsed = await parseFileBuffer('sales.csv', Buffer.from(salesCsv));
  if (isParseError(settlementParsed) || isParseError(salesParsed)) {
    throw new Error('Fixture failed to parse — check the CSV is well-formed.');
  }

  const settlementMapping = mappingFromDetected(detectSettlementColumns(marketplace, settlementParsed.columns));
  const salesMapping = mappingFromDetected(detectSellerColumns(salesParsed.columns));

  const marketplaceTxns = normalizeRows(settlementParsed.rows, settlementMapping, marketplace);
  const sellerTxns = normalizeRows(salesParsed.rows, salesMapping, 'seller');

  return reconcile(sellerTxns, marketplaceTxns);
}

function byOrder(records: ReturnType<typeof reconcile>['records'], orderId: string) {
  const record = records.find((r) => r.order_id === orderId);
  if (!record) throw new Error(`No record found for order ${orderId}`);
  return record;
}

describe('End-to-end: Amazon Flat File V2 style (long-format, multi-row-per-order)', () => {
  const salesCsv = [
    'Order ID,Order Date,SKU,Product Name,Gross Amount',
    '111-1111111-1111111,2026-08-01,SKU-A,Wireless Mouse,599',
    '111-2222222-2222222,2026-08-02,SKU-B,USB Cable,299',
    '111-3333333-3333333,2026-08-03,SKU-C,Phone Case,499',
    '111-4444444-4444444,2026-08-04,SKU-D,Bluetooth Speaker,1999',
  ].join('\n');

  const settlementCsv = [
    'order-id,transaction-type,amount-type,amount-description,amount,posted-date,sku',
    // Order 1: normal sale with commission + fulfillment fee deducted across 3 rows
    '111-1111111-1111111,Order,ItemPrice,Principal,599,2026-08-05,SKU-A',
    '111-1111111-1111111,Order,ItemFees,Commission,-89.85,2026-08-05,SKU-A',
    '111-1111111-1111111,Order,ItemFees,FBAPerUnitFulfillmentFee,-35.00,2026-08-05,SKU-A',
    // Order 2: zero-fee promo item settling for exactly the gross amount
    '111-2222222-2222222,Order,ItemPrice,Principal,299,2026-08-06,SKU-B',
    // Order 3 (Phone Case) intentionally has no settlement rows at all — missing settlement
    // Order 4: full return/refund
    '111-4444444-4444444,Order,ItemPrice,Principal,1999,2026-08-04,SKU-D',
    '111-4444444-4444444,Return,ItemFees,Return - Full Refund,-1999,2026-08-09,SKU-D',
    // An order with no matching seller record at all
    '111-5555555-5555555,Order,ItemPrice,Principal,150,2026-08-07,SKU-E',
    // A non-order account-level fee row with no order-id — must be silently
    // dropped, not misattributed to any order.
    ',Other,ItemFees,Monthly Subscription Fee,-39.99,2026-08-01,',
  ].join('\n');

  it('reconciles all orders to the expected statuses and amounts', async () => {
    const { records, summary } = await runPipeline('amazon', settlementCsv, salesCsv);

    // The account-level fee row with no order-id must not produce a phantom record.
    expect(records.find((r) => r.order_id === '')).toBeUndefined();

    const order1 = byOrder(records, '111-1111111-1111111');
    expect(order1.status).toBe('AMOUNT_MISMATCH');
    expect(order1.marketplace_amount).toBeCloseTo(474.15, 2);
    expect(order1.marketplace_records).toHaveLength(3);

    const order2 = byOrder(records, '111-2222222-2222222');
    expect(order2.status).toBe('MATCHED');

    const order3 = byOrder(records, '111-3333333-3333333');
    expect(order3.status).toBe('MISSING_SETTLEMENT');

    const order4 = byOrder(records, '111-4444444-4444444');
    expect(order4.status).toBe('RETURN_DISCREPANCY');
    expect(order4.marketplace_amount).toBeCloseTo(0, 2);

    const order5 = byOrder(records, '111-5555555-5555555');
    expect(order5.status).toBe('UNMATCHED_MARKETPLACE_RECORD');

    expect(summary.total_records).toBe(5);
  });
});

describe('End-to-end: Flipkart Seller Hub style (wide-format, one row per order)', () => {
  const salesCsv = [
    'Order ID,Order Date,SKU,Product Name,Gross Amount',
    'FK1001,2026-08-01,SKU-X,Yoga Mat,899',
    'FK1002,2026-08-02,SKU-Y,Water Bottle,349',
    'FK1003,2026-08-03,SKU-Z,Backpack,1499',
  ].join('\n');

  const settlementCsv = [
    'Order ID,Order Date,SKU,Total Offer Price,Commission,Fixed Fee,Collection Fee,Shipping Fee,TCS,Settlement Status,Final Settlement Amount',
    // Normal fully-processed order with several fee deductions in one row —
    // this must NOT be misread as "partial" just because it's a single row.
    'FK1001,2026-08-05,SKU-X,899,89.90,10,5,40,8.99,Completed,745.11',
    // Zero-deduction promo item settling for the exact gross amount
    'FK1002,2026-08-06,SKU-Y,349,0,0,0,0,0,Completed,349',
    // Genuinely still-processing settlement, explicitly flagged as such
    'FK1003,2026-08-07,SKU-Z,1499,0,0,0,0,0,Processing,800',
  ].join('\n');

  it('does not mislabel a normal single-row settlement as partial', async () => {
    const { records } = await runPipeline('flipkart', settlementCsv, salesCsv);

    const order1 = byOrder(records, 'FK1001');
    expect(order1.status).toBe('AMOUNT_MISMATCH');
    expect(order1.marketplace_amount).toBeCloseTo(745.11, 2);

    const order2 = byOrder(records, 'FK1002');
    expect(order2.status).toBe('MATCHED');
  });

  it('does classify an explicitly-flagged processing settlement as PARTIAL_SETTLEMENT', async () => {
    const { records } = await runPipeline('flipkart', settlementCsv, salesCsv);
    const order3 = byOrder(records, 'FK1003');
    expect(order3.status).toBe('PARTIAL_SETTLEMENT');
  });
});

describe('End-to-end: Meesho style', () => {
  const salesCsv = ['Order ID,Order Date,SKU,Product Name,Gross Amount', 'M2001,2026-08-01,SKU-P,Kurti,599', 'M2002,2026-08-02,SKU-Q,Earrings,299'].join('\n');

  const settlementCsv = [
    'Sub Order No,Order Date,SKU,Final Settlement Amount,Commission (Including GST),Forward Shipping Charges,TCS Amount',
    'M2001,2026-08-05,SKU-P,479.20,89.85,25.00,4.95',
    'M2002,2026-08-06,SKU-Q,299,0,0,0',
  ].join('\n');

  it('reconciles Meesho\u2019s punctuation-heavy headers correctly', async () => {
    const { records } = await runPipeline('meesho', settlementCsv, salesCsv);

    const order1 = byOrder(records, 'M2001');
    expect(order1.status).toBe('AMOUNT_MISMATCH');
    expect(order1.marketplace_amount).toBeCloseTo(479.2, 2);

    const order2 = byOrder(records, 'M2002');
    expect(order2.status).toBe('MATCHED');
  });
});
