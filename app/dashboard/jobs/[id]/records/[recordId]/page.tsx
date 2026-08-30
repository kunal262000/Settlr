import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServerComponent } from '@/lib/supabase-server';
import { Card, StatusBadge, formatINR } from '@/components/ui';
import type { NormalizedTransaction, ReconciliationStatus } from '@/lib/types';

export default async function RecordDetailPage({ params }: { params: { id: string; recordId: string } }) {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: record } = await supabase
    .from('reconciliation_records')
    .select('*')
    .eq('id', params.recordId)
    .eq('job_id', params.id)
    .eq('user_id', user!.id)
    .single();

  if (!record) notFound();

  const seller: NormalizedTransaction | null = record.seller_record;
  const marketplaceRecords: NormalizedTransaction[] = record.marketplace_records ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/dashboard/jobs/${params.id}`} className="text-sm text-ink-muted hover:text-ink">
        ← Back to results
      </Link>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-ink-muted uppercase tracking-wide">Order ID</p>
          <h1 className="text-xl font-mono font-semibold text-navy">{record.order_id}</h1>
        </div>
        <StatusBadge status={record.status as ReconciliationStatus} />
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-medium text-navy">Seller record</h2>
          {seller ? (
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Gross Amount" value={formatINR(seller.gross_amount)} />
              <Row label="Net Amount" value={formatINR(seller.net_amount)} />
              <Row label="Order Date" value={seller.transaction_date ?? '—'} />
              <Row label="SKU" value={seller.sku ?? '—'} />
              <Row label="Product" value={seller.product_name ?? '—'} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">No matching record found in your sales report.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-medium text-navy">Marketplace record{marketplaceRecords.length > 1 ? 's' : ''}</h2>
          {marketplaceRecords.length > 0 ? (
            <div className="mt-4 space-y-5">
              {marketplaceRecords.map((m, i) => (
                <dl key={i} className="space-y-2 text-sm pb-4 border-b border-border last:border-0 last:pb-0">
                  {marketplaceRecords.length > 1 && (
                    <p className="text-xs font-medium text-ink-muted">Transaction {i + 1}</p>
                  )}
                  <Row label="Settlement Amount" value={formatINR(m.net_amount)} />
                  <Row label="Commission" value={formatINR(m.commission_amount)} />
                  <Row label="Shipping" value={formatINR(m.shipping_amount)} />
                  <Row label="TCS" value={formatINR(m.tcs_amount)} />
                  <Row label="Transaction Date" value={m.transaction_date ?? '—'} />
                </dl>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">No marketplace settlement found for this order.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-navy">Difference</h2>
          <p className="text-2xl font-semibold tabular-nums text-navy">
            {record.difference !== null ? formatINR(Math.abs(record.difference)) : '—'}
          </p>
        </div>
        <p className="mt-3 text-sm text-ink-muted leading-relaxed">{record.reason}</p>
      </Card>

      {marketplaceRecords.length > 1 && (
        <p className="mt-4 text-xs text-ink-muted">
          This order has {marketplaceRecords.length} linked marketplace transactions. The settlement
          amount above is the sum of all of them, compared against your single sales record.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular-nums font-medium text-ink">{value}</dd>
    </div>
  );
}
