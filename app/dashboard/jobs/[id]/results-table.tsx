'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StatusBadge, formatINR } from '@/components/ui';
import type { ReconciliationRecord, ReconciliationStatus } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/types';

const FILTERS: { key: 'ALL' | ReconciliationStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'NEEDS_REVIEW', label: 'Needs Review' },
  { key: 'AMOUNT_MISMATCH', label: 'Amount Mismatch' },
  { key: 'MISSING_SETTLEMENT', label: 'Missing Settlement' },
  { key: 'RETURN_DISCREPANCY', label: 'Returns' },
  { key: 'UNMATCHED_MARKETPLACE_RECORD', label: 'Unmatched' },
];

export default function ResultsTable({ records }: { records: (ReconciliationRecord & { id: string })[] }) {
  const [filter, setFilter] = useState<'ALL' | ReconciliationStatus>('ALL');
  const pathname = usePathname();

  const filtered = filter === 'ALL' ? records : records.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm border transition-colors ${
              filter === f.key ? 'bg-navy text-white border-navy' : 'bg-white text-ink-muted border-border hover:border-navy/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Order ID</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Expected</th>
              <th className="px-4 py-3 font-medium text-right">Marketplace</th>
              <th className="px-4 py-3 font-medium text-right">Difference</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg">
                <td className="px-4 py-3">
                  <Link href={`${pathname}/records/${r.id}`} className="font-mono text-xs text-navy hover:underline">
                    {r.order_id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted">{r.transaction_date ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(r.expected_amount)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatINR(r.marketplace_amount)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.difference !== undefined && r.difference !== null ? formatINR(Math.abs(r.difference)) : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  No records match {STATUS_LABEL[filter as ReconciliationStatus] ?? 'this filter'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
