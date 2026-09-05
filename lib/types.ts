// Standard internal transaction model.
// Every parser (Meesho, seller sales register, future marketplaces) must
// normalize its source rows into this shape before reconciliation runs.
// Fields are optional except order_id — never invent a value that wasn't
// present in the source file; leave it undefined instead.

export type Marketplace = 'meesho' | 'amazon' | 'flipkart';
export type SourcePlatform = Marketplace | 'seller';

export const MARKETPLACES: { id: Marketplace; label: string }[] = [
  { id: 'meesho', label: 'Meesho' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'flipkart', label: 'Flipkart' },
];

export interface NormalizedTransaction {
  source_platform: SourcePlatform;
  order_id: string;
  transaction_id?: string;
  transaction_date?: string; // ISO date
  sku?: string;
  product_name?: string;

  gross_amount?: number;
  commission_amount?: number;
  shipping_amount?: number;
  return_amount?: number;
  refund_amount?: number;
  tcs_amount?: number;
  adjustment_amount?: number;
  net_amount?: number;

  transaction_type?: string;
  status?: string;

  // raw row, kept only in-memory during a run for traceability in the
  // detail view — never persisted verbatim to keep storage lean.
  _raw?: Record<string, unknown>;
}

export type ReconciliationStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'MISSING_SETTLEMENT'
  | 'UNMATCHED_MARKETPLACE_RECORD'
  | 'DUPLICATE_RECORD'
  | 'PARTIAL_SETTLEMENT'
  | 'RETURN_DISCREPANCY'
  | 'NEEDS_REVIEW';

export interface ReconciliationRecord {
  id?: string;
  order_id: string;
  status: ReconciliationStatus;
  seller_record?: NormalizedTransaction;
  seller_records: NormalizedTransaction[];
  marketplace_records: NormalizedTransaction[];
  expected_amount?: number;
  marketplace_amount?: number;
  difference?: number;
  reason: string;
  transaction_date?: string;
  // Set only for MISSING_SETTLEMENT / UNMATCHED_MARKETPLACE_RECORD when an
  // unmatched order id on the other side is a near-identical string (likely
  // a formatting difference, not a genuinely missing record). Surfaced as a
  // hint in the UI only — never used to auto-match.
  possible_match_order_id?: string;
}

export interface FinancialSummary {
  gross_sales?: number;
  marketplace_fees?: number;
  shipping?: number;
  returns?: number;
  tcs?: number;
  other_adjustments?: number;
  calculated_net?: number;
  settlement_total?: number;
  difference_requiring_review?: number;
}

export interface ReconciliationSummary {
  total_records: number;
  matched_count: number;
  needs_attention_count: number;
  amount_requiring_review: number;
  financial_summary: FinancialSummary;
}

export interface ColumnMapping {
  [internalField: string]: string; // internal field -> detected source column name
}

export interface DetectedColumn {
  internalField: string;
  label: string;
  detectedColumn: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  required: boolean;
}

export interface ReconciliationJob {
  id: string;
  user_id: string;
  marketplace: Marketplace;
  status: 'processing' | 'completed' | 'failed';
  settlement_file_name: string;
  settlement_file_rows: number;
  sales_file_name: string;
  sales_file_rows: number;
  column_mapping: ColumnMapping;
  total_records: number;
  matched_count: number;
  needs_attention_count: number;
  amount_requiring_review: number;
  financial_summary: FinancialSummary;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  MATCHED: 'Matched',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  MISSING_SETTLEMENT: 'Missing Settlement',
  UNMATCHED_MARKETPLACE_RECORD: 'Unmatched Marketplace Record',
  DUPLICATE_RECORD: 'Duplicate Record',
  PARTIAL_SETTLEMENT: 'Partial Settlement',
  RETURN_DISCREPANCY: 'Return Discrepancy',
  NEEDS_REVIEW: 'Needs Review',
};

export const STATUS_TONE: Record<ReconciliationStatus, 'success' | 'warning' | 'error'> = {
  MATCHED: 'success',
  AMOUNT_MISMATCH: 'warning',
  MISSING_SETTLEMENT: 'error',
  UNMATCHED_MARKETPLACE_RECORD: 'warning',
  DUPLICATE_RECORD: 'warning',
  PARTIAL_SETTLEMENT: 'warning',
  RETURN_DISCREPANCY: 'warning',
  NEEDS_REVIEW: 'warning',
};
