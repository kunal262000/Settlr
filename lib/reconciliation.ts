import type {
  FinancialSummary,
  NormalizedTransaction,
  ReconciliationRecord,
  ReconciliationStatus,
  ReconciliationSummary,
} from './types';

const AMOUNT_TOLERANCE = 1; // ₹1 rounding tolerance before flagging a mismatch

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sum(values: (number | undefined)[]): number {
  return round2(values.reduce((acc: number, v) => acc + (v ?? 0), 0));
}

/**
 * A single marketplace order can carry several linked transactions
 * (sale, commission, shipping, TCS, adjustment, return...). Aggregate
 * them into one net figure per order before comparing against the
 * seller's record, but keep every underlying transaction attached so
 * the detail view stays traceable back to source rows.
 */
function aggregateMarketplaceGroup(records: NormalizedTransaction[]): {
  netAmount: number;
  hasNetAmount: boolean;
  latestDate?: string;
} {
  const withNet = records.filter((r) => r.net_amount !== undefined);
  if (withNet.length > 0) {
    return {
      netAmount: sum(withNet.map((r) => r.net_amount)),
      hasNetAmount: true,
      latestDate: latestDateOf(records),
    };
  }

  // No explicit net_amount column — derive it from whatever component
  // fields are present, rather than inventing a figure.
  const anyComponent = records.some(
    (r) =>
      r.gross_amount !== undefined ||
      r.commission_amount !== undefined ||
      r.shipping_amount !== undefined ||
      r.return_amount !== undefined ||
      r.refund_amount !== undefined ||
      r.tcs_amount !== undefined ||
      r.adjustment_amount !== undefined
  );
  if (!anyComponent) {
    return { netAmount: 0, hasNetAmount: false, latestDate: latestDateOf(records) };
  }

  const derived = records.reduce((acc, r) => {
    const gross = r.gross_amount ?? 0;
    const deductions =
      (r.commission_amount ?? 0) +
      (r.shipping_amount ?? 0) +
      (r.return_amount ?? 0) +
      (r.tcs_amount ?? 0) -
      (r.adjustment_amount ?? 0) -
      (r.refund_amount ?? 0);
    return acc + (gross - deductions);
  }, 0);

  return { netAmount: round2(derived), hasNetAmount: true, latestDate: latestDateOf(records) };
}

function latestDateOf(records: NormalizedTransaction[]): string | undefined {
  const dates = records.map((r) => r.transaction_date).filter(Boolean) as string[];
  if (dates.length === 0) return undefined;
  return dates.sort().at(-1);
}

function expectedAmountOf(seller: NormalizedTransaction): number | undefined {
  if (seller.net_amount !== undefined) return seller.net_amount;
  if (seller.gross_amount !== undefined) return seller.gross_amount;
  return undefined;
}

/**
 * A seller's sales register can legitimately carry several rows for one
 * order (one per SKU/line item on a multi-item order) — that is not a
 * duplicate, it's normal, and needs summing just like multi-transaction
 * marketplace groups do. Prefer summing net_amount when any row has it
 * (registers that already carry expected payout), otherwise sum
 * gross_amount, matching the single-row preference in expectedAmountOf.
 */
function aggregateSellerGroup(records: NormalizedTransaction[]): { expected?: number } {
  const withNet = records.filter((r) => r.net_amount !== undefined);
  if (withNet.length > 0) {
    return { expected: sum(withNet.map((r) => r.net_amount)) };
  }
  const withGross = records.filter((r) => r.gross_amount !== undefined);
  if (withGross.length > 0) {
    return { expected: sum(withGross.map((r) => r.gross_amount)) };
  }
  return { expected: undefined };
}

/**
 * A real duplicate is the same line entered twice — same SKU, same
 * transaction id (if present), same amount — not just "more than one row
 * for this order id" (see aggregateSellerGroup above for the legitimate
 * multi-line case).
 */
function hasExactDuplicateRows(records: NormalizedTransaction[]): boolean {
  const seen = new Set<string>();
  for (const r of records) {
    const amount = r.net_amount ?? r.gross_amount;
    const signature = `${r.sku ?? ''}|${r.transaction_id ?? ''}|${amount ?? ''}`;
    if (seen.has(signature)) return true;
    seen.add(signature);
  }
  return false;
}

function classify(params: {
  sellerRecords: NormalizedTransaction[];
  marketplaceRecords: NormalizedTransaction[];
}): { status: ReconciliationStatus; reason: string; expected?: number; marketplaceAmount?: number; difference?: number } {
  const { sellerRecords, marketplaceRecords } = params;

  // Marketplace data exists, no seller record for this order at all.
  if (sellerRecords.length === 0) {
    return {
      status: 'UNMATCHED_MARKETPLACE_RECORD',
      reason: 'A marketplace settlement exists for this order, but no matching record was found in your sales report.',
    };
  }

  if (sellerRecords.length > 1 && hasExactDuplicateRows(sellerRecords)) {
    return {
      status: 'DUPLICATE_RECORD',
      reason: `This order ID appears ${sellerRecords.length} times in your sales report with identical line details. Duplicate entries need review before reconciliation totals can be trusted.`,
    };
  }

  const expected =
    sellerRecords.length > 1 ? aggregateSellerGroup(sellerRecords).expected : expectedAmountOf(sellerRecords[0]);

  // Seller record exists, marketplace never settled it.
  if (marketplaceRecords.length === 0) {
    return {
      status: 'MISSING_SETTLEMENT',
      reason: 'This order appears in your sales report but has no corresponding settlement from the marketplace.',
      expected,
    };
  }

  const returnLike = marketplaceRecords.some(
    (r) =>
      (r.return_amount ?? 0) > 0 ||
      (r.transaction_type ?? '').toLowerCase().includes('return') ||
      (r.transaction_type ?? '').toLowerCase().includes('refund') ||
      (r.status ?? '').toLowerCase().includes('rto')
  );

  const { netAmount, hasNetAmount } = aggregateMarketplaceGroup(marketplaceRecords);

  if (!hasNetAmount) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'The marketplace settlement file did not include enough amount fields to calculate a comparable figure for this order.',
      expected,
    };
  }

  if (expected === undefined) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'Your sales report did not include a comparable amount for this order, so the settlement could not be verified.',
      marketplaceAmount: netAmount,
    };
  }

  const difference = round2(expected - netAmount);
  const hasReturnAmount = marketplaceRecords.some(
    (r) => (r.return_amount ?? 0) > 0
  );
  const hasRefundTransactionType = marketplaceRecords.some(
    (r) => (r.transaction_type ?? '').toLowerCase() === 'refund'
  );

  if (hasReturnAmount || hasRefundTransactionType || returnLike) {
    return {
      status: 'RETURN_DISCREPANCY',
      reason: `A return or RTO was recorded for this order and the settlement differs from your sales record by ₹${Math.abs(difference).toLocaleString('en-IN')}. Difference requiring review.`,
      expected,
      marketplaceAmount: netAmount,
      difference,
    };
  }

  if (Math.abs(difference) <= AMOUNT_TOLERANCE) {
    return {
      status: 'MATCHED',
      reason: 'The marketplace settlement matches your sales record within an acceptable tolerance.',
      expected,
      marketplaceAmount: netAmount,
      difference,
    };
  }

  const pendingLike = marketplaceRecords.some((r) => {
    const status = (r.status ?? '').toLowerCase();
    const type = (r.transaction_type ?? '').toLowerCase();
    return (
      status.includes('partial') ||
      status.includes('pending') ||
      status.includes('processing') ||
      type.includes('partial') ||
      type.includes('pending')
    );
  });

  if (pendingLike && netAmount > 0 && netAmount < expected) {
    return {
      status: 'PARTIAL_SETTLEMENT',
      reason: `The marketplace has flagged this settlement as still processing, and only part of the expected amount has settled so far. Difference requiring review: ₹${Math.abs(difference).toLocaleString('en-IN')}.`,
      expected,
      marketplaceAmount: netAmount,
      difference,
    };
  }

  return {
    status: 'AMOUNT_MISMATCH',
    reason:
      difference > 0
        ? `The reconciled marketplace amount is ₹${Math.abs(difference).toLocaleString('en-IN')} lower than the corresponding seller record. Difference requiring review.`
        : `The reconciled marketplace amount is ₹${Math.abs(difference).toLocaleString('en-IN')} higher than the corresponding seller record. Difference requiring review.`,
    expected,
    marketplaceAmount: netAmount,
    difference,
  };
}

export function reconcile(
  sellerTransactions: NormalizedTransaction[],
  marketplaceTransactions: NormalizedTransaction[]
): { records: ReconciliationRecord[]; summary: ReconciliationSummary } {
  const sellerByOrder = groupBy(sellerTransactions, (t) => t.order_id);
  const marketByOrder = groupBy(marketplaceTransactions, (t) => t.order_id);

  const allOrderIds = new Set([...sellerByOrder.keys(), ...marketByOrder.keys()]);

  const records: ReconciliationRecord[] = [];

  for (const orderId of allOrderIds) {
    const sellerRecords = sellerByOrder.get(orderId) ?? [];
    const marketplaceRecords = marketByOrder.get(orderId) ?? [];
    const result = classify({ sellerRecords, marketplaceRecords });

    records.push({
      order_id: orderId,
      status: result.status,
      seller_record: sellerRecords[0],
      seller_records: sellerRecords,
      marketplace_records: marketplaceRecords,
      expected_amount: result.expected,
      marketplace_amount: result.marketplaceAmount,
      difference: result.difference,
      reason: result.reason,
      transaction_date: sellerRecords[0]?.transaction_date ?? latestDateOf(marketplaceRecords),
    });
  }

  attachPossibleMatches(records);

  // Sort: attention-needed first, then by order id, for a stable, scannable results table.
  records.sort((a, b) => {
    if (a.status === 'MATCHED' && b.status !== 'MATCHED') return 1;
    if (a.status !== 'MATCHED' && b.status === 'MATCHED') return -1;
    return a.order_id.localeCompare(b.order_id);
  });

  const summary = buildSummary(records, sellerTransactions, marketplaceTransactions);
  return { records, summary };
}

// ─────────────────────────────────────────────────────────
// Near-miss order ID suggestions — surfacing only, never auto-matching.
// A MISSING_SETTLEMENT/UNMATCHED_MARKETPLACE_RECORD pair whose order ids
// are near-identical after normalization is very likely one formatting
// difference (leading zeros, stray characters, a typo) rather than a
// genuinely missing record, so it's worth a hint pointing the seller at it.
// ─────────────────────────────────────────────────────────

const FUZZY_MATCH_CAP = 3000; // avoid O(n*m) cost on very large unmatched sets

function normalizeOrderId(id: string): string {
  return id.trim().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+(?=\d)/, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function attachPossibleMatches(records: ReconciliationRecord[]): void {
  const missing = records.filter((r) => r.status === 'MISSING_SETTLEMENT');
  const unmatched = records.filter((r) => r.status === 'UNMATCHED_MARKETPLACE_RECORD');
  if (missing.length === 0 || unmatched.length === 0) return;
  if (missing.length > FUZZY_MATCH_CAP || unmatched.length > FUZZY_MATCH_CAP) return;

  const unmatchedNormalized = unmatched.map((r) => ({ record: r, normalized: normalizeOrderId(r.order_id) }));

  for (const m of missing) {
    const mNorm = normalizeOrderId(m.order_id);
    const threshold = mNorm.length <= 4 ? 1 : 2; // stricter for short ids to avoid noisy suggestions
    let best: { record: ReconciliationRecord; distance: number } | null = null;

    for (const u of unmatchedNormalized) {
      if (u.record.order_id === m.order_id || u.normalized === mNorm) continue; // exact match would've already merged
      if (Math.abs(mNorm.length - u.normalized.length) > threshold) continue;
      const distance = levenshtein(mNorm, u.normalized);
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { record: u.record, distance };
      }
    }

    if (best) {
      m.possible_match_order_id = best.record.order_id;
      m.reason += ` A marketplace record with a very similar order ID ("${best.record.order_id}") was found unmatched — check for formatting differences (leading zeros, extra characters) before treating this as missing.`;
      if (!best.record.possible_match_order_id) {
        best.record.possible_match_order_id = m.order_id;
        best.record.reason += ` A sales record with a very similar order ID ("${m.order_id}") was found unmatched — check for formatting differences before treating this as unmatched.`;
      }
    }
  }
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function buildSummary(
  records: ReconciliationRecord[],
  sellerTransactions: NormalizedTransaction[],
  marketplaceTransactions: NormalizedTransaction[]
): ReconciliationSummary {
  const matched = records.filter((r) => r.status === 'MATCHED').length;
  const needsAttention = records.length - matched;

  const amountRequiringReview = round2(
    records
      .filter((r) => r.status !== 'MATCHED' && r.difference !== undefined)
      .reduce((acc, r) => acc + Math.abs(r.difference ?? 0), 0)
  );

  const financial_summary = buildFinancialSummary(sellerTransactions, marketplaceTransactions);

  return {
    total_records: records.length,
    matched_count: matched,
    needs_attention_count: needsAttention,
    amount_requiring_review: amountRequiringReview,
    financial_summary,
  };
}

/**
 * Only populate a category if the source data actually contained it —
 * per spec, never generate fictional financial values.
 */
function buildFinancialSummary(
  sellerTransactions: NormalizedTransaction[],
  marketplaceTransactions: NormalizedTransaction[]
): FinancialSummary {
  const has = (field: keyof NormalizedTransaction, txns: NormalizedTransaction[]) =>
    txns.some((t) => t[field] !== undefined);

  const summary: FinancialSummary = {};

  if (has('gross_amount', sellerTransactions)) {
    summary.gross_sales = sum(sellerTransactions.map((t) => t.gross_amount));
  }
  if (has('commission_amount', marketplaceTransactions)) {
    summary.marketplace_fees = sum(marketplaceTransactions.map((t) => t.commission_amount));
  }
  if (has('shipping_amount', marketplaceTransactions)) {
    summary.shipping = sum(marketplaceTransactions.map((t) => t.shipping_amount));
  }
  if (has('return_amount', marketplaceTransactions)) {
    summary.returns = sum(marketplaceTransactions.map((t) => t.return_amount));
  }
  if (has('tcs_amount', marketplaceTransactions)) {
    summary.tcs = sum(marketplaceTransactions.map((t) => t.tcs_amount));
  }
  if (has('adjustment_amount', marketplaceTransactions)) {
    summary.other_adjustments = sum(marketplaceTransactions.map((t) => t.adjustment_amount));
  }

  if (summary.gross_sales !== undefined) {
    const deductions =
      (summary.marketplace_fees ?? 0) +
      (summary.shipping ?? 0) +
      (summary.returns ?? 0) +
      (summary.tcs ?? 0) -
      (summary.other_adjustments ?? 0);
    summary.calculated_net = round2(summary.gross_sales - deductions);
  }

  if (has('net_amount', marketplaceTransactions)) {
    summary.settlement_total = sum(marketplaceTransactions.map((t) => t.net_amount));
  }

  if (summary.calculated_net !== undefined && summary.settlement_total !== undefined) {
    summary.difference_requiring_review = round2(summary.calculated_net - summary.settlement_total);
  }

  return summary;
}
