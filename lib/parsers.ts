import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import type { ColumnMapping, DetectedColumn, Marketplace, NormalizedTransaction, SourcePlatform } from './types';

// ─────────────────────────────────────────────────────────
// 1. Safe file reading (base/file_reader)
// Accepts xlsx, xls, csv. Never throws raw parser errors outward —
// always returns a structured result so the UI can explain failures.
// ─────────────────────────────────────────────────────────

export interface ParsedFile {
  fileName: string;
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
}

export interface FileParseError {
  error: string;
}

const MAX_ROWS = 200_000;
const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv'];

export function validateFile(fileName: string, sizeBytes: number): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type ".${ext}". Upload an XLSX, XLS, or CSV file.`;
  }
  if (sizeBytes > 25 * 1024 * 1024) {
    return 'File is larger than 25MB. Split it into smaller exports and try again.';
  }
  if (sizeBytes === 0) {
    return 'File is empty.';
  }
  return null;
}

export async function parseFileBuffer(
  fileName: string,
  buffer: Buffer
): Promise<ParsedFile | FileParseError> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  try {
    let rows: Record<string, unknown>[] = [];

    if (ext === 'csv') {
      const text = buffer.toString('utf-8');
      const result = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
      if (result.errors?.length && result.data.length === 0) {
        return { error: `Could not read CSV file: ${result.errors[0].message}` };
      }
      rows = result.data;
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { error: 'No sheets found in the uploaded file.' };
      }
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    }

    if (rows.length === 0) {
      return { error: 'No data rows were found in this file. Check that the header row is present.' };
    }
    if (rows.length > MAX_ROWS) {
      return { error: `File has ${rows.length.toLocaleString()} rows, which exceeds the ${MAX_ROWS.toLocaleString()} row limit.` };
    }

    // Defense-in-depth against prototype pollution: strip any row/column
    // using a dangerous key name outright, regardless of what the parsing
    // library itself does with them. This doesn't depend on the xlsx
    // library's own fix — it holds even if a future dependency
    // regresses or a different file format sneaks a dangerous key through.
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    rows = rows.map((row) => {
      const clean: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        if (!DANGEROUS_KEYS.has(key)) clean[key] = row[key];
      }
      return clean;
    });

    const columns = Object.keys(rows[0]).filter((c) => !DANGEROUS_KEYS.has(c));
    return { fileName, rows, columns, rowCount: rows.length };
  } catch (err) {
    return { error: `File could not be parsed. It may be corrupted or in an unexpected format. (${(err as Error).message})` };
  }
}

export function isParseError(result: ParsedFile | FileParseError): result is FileParseError {
  return 'error' in result;
}

// ─────────────────────────────────────────────────────────
// 2. Column detection (base/column_detector)
// Alias-based fuzzy matching against normalized header names.
// ─────────────────────────────────────────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  order_id: ['order id', 'order number', 'order no', 'sub order id', 'order_number', 'order reference', 'orderid'],
  transaction_id: ['transaction id', 'txn id', 'settlement id', 'payment id'],
  transaction_date: ['transaction date', 'order date', 'settlement date', 'date', 'payment date'],
  sku: ['sku', 'sku id', 'sku code'],
  product_name: ['product name', 'product', 'item name', 'item description'],
  gross_amount: ['gross amount', 'selling price', 'order amount', 'sale amount', 'listed price', 'supplier listed price'],
  commission_amount: ['commission', 'commission amount', 'marketplace fee', 'platform fee'],
  shipping_amount: ['shipping fee', 'shipping charge', 'shipping amount', 'forward shipping charges', 'reverse shipping charges'],
  return_amount: ['return amount', 'return charges', 'rto amount'],
  refund_amount: ['refund amount', 'refund'],
  tcs_amount: ['tcs', 'tcs amount', 'tax collected at source'],
  adjustment_amount: ['adjustment', 'adjustment amount', 'other adjustment'],
  net_amount: ['net amount', 'settlement amount', 'final settlement amount', 'net settlement amount', 'amount paid', 'payment amount'],
  transaction_type: ['transaction type', 'live order status', 'order status'],
  status: ['status', 'settlement status'],
};

// Marketplace-specific header variants layered on top of the base aliases
// above. Real-world exports differ enough between platforms that a single
// alias list would miss most of them.
//
// Amazon's actual settlement export (Flat File V2, via Seller Central >
// Payments > All Statements) is LONG-format, not wide: one row per
// order-id per amount-type/amount-description, with a single "amount"
// column carrying the value and "posted-date" the date. Because our
// reconciliation engine already sums every net_amount row sharing an
// order_id (see aggregateMarketplaceGroup in reconciliation.ts), mapping
// "amount" -> net_amount is correct as-is — Amazon settlements naturally
// arrive pre-split into one row per order per fee/price line, and summing
// them reproduces the payout. Older V1-style exports (or third-party
// pulls) sometimes still use wide fragmented columns like
// item-related-fee-amount / shipment-fee-amount, so both are aliased.
//
// Flipkart's Seller Hub settlement export is wide-format: one row per
// order/order-item with separate commission, fixed fee, collection fee,
// shipping fee, and TCS columns, plus a single final settlement column.
const MARKETPLACE_ALIASES: Record<Marketplace, Partial<Record<string, string[]>>> = {
  meesho: {
    order_id: ['sub order no', 'sub order id'],
    net_amount: ['final settlement amount', 'net settlement amount'],
    commission_amount: ['commission (including gst)'],
    shipping_amount: ['forward shipping charges', 'reverse shipping charges (if applicable)'],
    return_amount: ['return shipping charge'],
    tcs_amount: ['tcs amount'],
  },
  amazon: {
    order_id: ['order-id', 'order id', 'merchant-order-id', 'amazon-order-id'],
    transaction_id: ['settlement-id', 'adjustment-id', 'shipment-id'],
    transaction_date: ['posted-date', 'posted-date-time', 'deposit-date'],
    sku: ['sku', 'msku'],
    gross_amount: ['item-price', 'price-amount', 'principal'],
    commission_amount: ['selling fees', 'referral fee', 'fba fees', 'item-related-fee-amount', 'commission'],
    shipping_amount: ['shipping fees', 'shipment-fee-amount', 'shipping-price'],
    return_amount: ['refund shipping cost', 'return charge'],
    refund_amount: ['refund amount'],
    tcs_amount: ['tcs-igst', 'tcs-cgst', 'tcs-sgst', 'tcs collected'],
    adjustment_amount: ['other-fee-amount', 'misc-fee-amount', 'order-fee-amount'],
    net_amount: ['amount', 'total-amount', 'payment amount', 'net proceeds'],
    transaction_type: ['transaction-type', 'amount-type'],
    status: ['amount-description'],
  },
  flipkart: {
    order_id: ['order id', 'order item id', 'order_id'],
    transaction_date: ['order date', 'settlement date', 'return date'],
    sku: ['sku', 'fsn'],
    gross_amount: ['total offer price', 'selling price', 'invoice amount'],
    commission_amount: ['commission', 'marketplace fee', 'collection fee', 'fixed fee', 'fixed closing fee'],
    shipping_amount: ['shipping fee', 'logistics fee', 'shipping charges'],
    return_amount: ['return premium', 'reverse pickup charges'],
    tcs_amount: ['tcs', 'igst tcs', 'cgst tcs', 'sgst tcs'],
    adjustment_amount: ['tds', 'adjustment'],
    net_amount: ['final settlement amount', 'total settlement value', 'bank settlement value', 'net settlement amount'],
  },
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(normalizedHeader: string, alias: string): number {
  if (normalizedHeader === alias) return 3; // exact

  // Word-based containment: only count a match when the shorter phrase
  // contributes at least 2 overlapping words. This prevents a generic
  // single-word column (e.g. a bare "amount" column, common in Amazon's
  // settlement export) from falsely matching every alias that happens to
  // contain that word as one component of a longer phrase (e.g. "gross
  // amount", "commission amount"). A single generic word should only ever
  // win via an exact match against a field with a matching short alias
  // (like net_amount's dedicated "amount" alias), never a fuzzy contains.
  const headerWords = normalizedHeader.split(' ').filter(Boolean);
  const aliasWords = alias.split(' ').filter(Boolean);
  const [shorter, longer] = headerWords.length <= aliasWords.length ? [headerWords, aliasWords] : [aliasWords, headerWords];

  if (shorter.length >= 2 && shorter.every((w) => longer.includes(w))) return 2; // contains

  return 0;
}

export function detectColumns(
  columns: string[],
  requiredFields: string[] = ['order_id'],
  optionalFields: string[] = Object.keys(FIELD_ALIASES).filter((f) => f !== 'order_id'),
  marketplace?: Marketplace
): DetectedColumn[] {
  const normalizedColumns = columns.map((c) => ({ original: c, normalized: normalizeHeader(c) }));
  const results: DetectedColumn[] = [];

  const allFields = [...requiredFields, ...optionalFields];
  const uniqueFields = Array.from(new Set(allFields));
  const marketplaceExtra = marketplace ? MARKETPLACE_ALIASES[marketplace] : undefined;

  for (const field of uniqueFields) {
    const baseAliases = FIELD_ALIASES[field] ?? [field.replace(/_/g, ' ')];
    const extraAliases = marketplaceExtra?.[field] ?? [];
    // Normalize aliases the same way headers are normalized, so aliases
    // can be authored with hyphens/underscores (matching how marketplaces
    // actually spell their columns, e.g. "posted-date") without silently
    // failing to match.
    const aliases = [...baseAliases, ...extraAliases].map(normalizeHeader);
    let best: { column: string; score: number } | null = null;

    for (const { original, normalized } of normalizedColumns) {
      for (const alias of aliases) {
        const score = scoreMatch(normalized, alias);
        if (score > 0 && (!best || score > best.score)) {
          best = { column: original, score };
        }
      }
    }

    results.push({
      internalField: field,
      label: fieldLabel(field),
      detectedColumn: best?.column ?? null,
      confidence: best ? (best.score >= 3 ? 'high' : 'medium') : 'none',
      required: requiredFields.includes(field),
    });
  }

  return results;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    order_id: 'Order ID',
    transaction_id: 'Transaction ID',
    transaction_date: 'Transaction Date',
    sku: 'SKU',
    product_name: 'Product Name',
    gross_amount: 'Gross / Selling Amount',
    commission_amount: 'Commission',
    shipping_amount: 'Shipping Fee',
    return_amount: 'Return Amount',
    refund_amount: 'Refund Amount',
    tcs_amount: 'TCS Amount',
    adjustment_amount: 'Adjustment Amount',
    net_amount: 'Net Settlement Amount',
    transaction_type: 'Transaction Type',
    status: 'Status',
  };
  return labels[field] ?? field;
}

// ─────────────────────────────────────────────────────────
// 3. Normalizer (base/normalizer)
// Converts raw rows + a confirmed column mapping into NormalizedTransaction[].
// Never invents values: fields with no mapped column are left undefined.
// ─────────────────────────────────────────────────────────

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function toDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const d = new Date(String(value));
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(value);
}

export function normalizeRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  sourcePlatform: SourcePlatform
): NormalizedTransaction[] {
  return rows
    .map((row): NormalizedTransaction | null => {
      const get = (field: string) => (mapping[field] ? row[mapping[field]] : undefined);
      const orderIdRaw = get('order_id');
      if (orderIdRaw === undefined || orderIdRaw === null || String(orderIdRaw).trim() === '') {
        return null; // rows without an order id can't be reconciled — skip, don't invent one
      }

      return {
        source_platform: sourcePlatform,
        order_id: String(orderIdRaw).trim(),
        transaction_id: get('transaction_id') ? String(get('transaction_id')) : undefined,
        transaction_date: toDateString(get('transaction_date')),
        sku: get('sku') ? String(get('sku')) : undefined,
        product_name: get('product_name') ? String(get('product_name')) : undefined,
        gross_amount: toNumber(get('gross_amount')),
        commission_amount: toNumber(get('commission_amount')),
        shipping_amount: toNumber(get('shipping_amount')),
        return_amount: toNumber(get('return_amount')),
        refund_amount: toNumber(get('refund_amount')),
        tcs_amount: toNumber(get('tcs_amount')),
        adjustment_amount: toNumber(get('adjustment_amount')),
        net_amount: toNumber(get('net_amount')),
        transaction_type: get('transaction_type') ? String(get('transaction_type')) : undefined,
        status: get('status') ? String(get('status')) : undefined,
        _raw: row,
      };
    })
    .filter((r): r is NormalizedTransaction => r !== null);
}

// ─────────────────────────────────────────────────────────
// 4. Platform-specific entry points (platforms/meesho, seller/sales_register)
// For the MVP both funnel through the generic detector + normalizer above,
// with Meesho-specific alias hints layered in. This is the extension point
// future marketplaces (Amazon, Flipkart) implement against.
// ─────────────────────────────────────────────────────────

const SETTLEMENT_OPTIONAL_FIELDS = [
  'transaction_id',
  'transaction_date',
  'sku',
  'product_name',
  'gross_amount',
  'commission_amount',
  'shipping_amount',
  'return_amount',
  'refund_amount',
  'tcs_amount',
  'adjustment_amount',
  'net_amount',
  'transaction_type',
  'status',
];

/**
 * Entry point for any marketplace settlement file. Meesho, Amazon, and
 * Flipkart all funnel through the same detector + normalizer — only the
 * alias hints in MARKETPLACE_ALIASES differ per platform. Adding a new
 * marketplace means adding an entry there, not a new parser module.
 */
export function detectSettlementColumns(marketplace: Marketplace, columns: string[]): DetectedColumn[] {
  return detectColumns(columns, ['order_id'], SETTLEMENT_OPTIONAL_FIELDS, marketplace);
}

/** @deprecated use detectSettlementColumns(marketplace, columns) */
export function detectMeeshoColumns(columns: string[]): DetectedColumn[] {
  return detectSettlementColumns('meesho', columns);
}

export function detectSellerColumns(columns: string[]): DetectedColumn[] {
  return detectColumns(columns, ['order_id'], [
    'transaction_date',
    'sku',
    'product_name',
    'gross_amount',
    'status',
  ]);
}

export function mappingFromDetected(detected: DetectedColumn[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const d of detected) {
    if (d.detectedColumn) mapping[d.internalField] = d.detectedColumn;
  }
  return mapping;
}
