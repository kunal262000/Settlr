import * as XLSX from '@e965/xlsx';
import type { ReconciliationJob, ReconciliationRecord, ReconciliationStatus } from './types';
import { STATUS_LABEL } from './types';

function recordsToRows(records: ReconciliationRecord[]) {
  return records.map((r) => ({
    'Order ID': r.order_id,
    Date: r.transaction_date ?? '',
    'Expected Amount': r.expected_amount ?? '',
    'Marketplace Amount': r.marketplace_amount ?? '',
    Difference: r.difference ?? '',
    Status: STATUS_LABEL[r.status],
    Reason: r.reason,
  }));
}

function sheetForStatus(records: ReconciliationRecord[], status: ReconciliationStatus) {
  return recordsToRows(records.filter((r) => r.status === status));
}

export function buildExportWorkbook(job: ReconciliationJob, records: ReconciliationRecord[]): Buffer {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { Metric: 'Marketplace', Value: job.marketplace },
    { Metric: 'Settlement File', Value: job.settlement_file_name },
    { Metric: 'Sales File', Value: job.sales_file_name },
    { Metric: 'Total Records', Value: job.total_records },
    { Metric: 'Matched', Value: job.matched_count },
    { Metric: 'Need Attention', Value: job.needs_attention_count },
    { Metric: 'Amount Requiring Review', Value: job.amount_requiring_review },
    { Metric: '', Value: '' },
    ...Object.entries(job.financial_summary).map(([k, v]) => ({
      Metric: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      Value: v,
    })),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recordsToRows(records)), 'All Records');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetForStatus(records, 'MATCHED')), 'Matched');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetForStatus(records, 'AMOUNT_MISMATCH')), 'Amount Mismatches');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetForStatus(records, 'MISSING_SETTLEMENT')), 'Missing Settlements');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetForStatus(records, 'UNMATCHED_MARKETPLACE_RECORD')), 'Unmatched Marketplace');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      ...sheetForStatus(records, 'RETURN_DISCREPANCY'),
      ...sheetForStatus(records, 'PARTIAL_SETTLEMENT'),
      ...sheetForStatus(records, 'DUPLICATE_RECORD'),
      ...sheetForStatus(records, 'NEEDS_REVIEW'),
    ]),
    'Returns & Review Items'
  );

  const arrayBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return arrayBuffer as Buffer;
}
