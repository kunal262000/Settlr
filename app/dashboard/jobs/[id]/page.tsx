import { notFound } from 'next/navigation';
import { supabaseServerComponent } from '@/lib/supabase-server';
import { Card, StatCard, formatINR } from '@/components/ui';
import type { ReconciliationJob, ReconciliationRecord } from '@/lib/types';
import ResultsTable from './results-table';

export default async function JobResultsPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job } = await supabase
    .from('reconciliation_jobs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single();

  if (!job) notFound();

  const { data: records } = await supabase
    .from('reconciliation_records')
    .select('*')
    .eq('job_id', params.id)
    .eq('user_id', user!.id)
    .order('order_id');

  const typedJob = job as ReconciliationJob;
  const typedRecords = (records ?? []) as (ReconciliationRecord & { id: string })[];
  const fs = typedJob.financial_summary ?? {};

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy capitalize">{typedJob.marketplace} Settlement</h1>
          <p className="text-sm text-ink-muted mt-1">
            {typedJob.settlement_file_name} vs. {typedJob.sales_file_name}
          </p>
        </div>
        <a href={`/api/export/${typedJob.id}`}>
          <button className="rounded-xl border border-border bg-white px-5 py-3 text-sm font-medium text-navy hover:bg-bg">
            Export to Excel
          </button>
        </a>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Records" value={typedJob.total_records.toLocaleString('en-IN')} tone="navy" />
        <StatCard label="Matched" value={typedJob.matched_count.toLocaleString('en-IN')} tone="success" />
        <StatCard label="Need Attention" value={typedJob.needs_attention_count.toLocaleString('en-IN')} tone="warning" />
        <StatCard label="Amount Requiring Review" value={formatINR(typedJob.amount_requiring_review)} tone="warning" />
      </div>

      {Object.keys(fs).length > 0 && (
        <Card className="mt-8 p-6">
          <h2 className="font-medium text-navy">Financial summary</h2>
          <p className="text-xs text-ink-muted mt-1">Only categories present in your uploaded files are shown.</p>
          <div className="mt-4 space-y-2 text-sm max-w-md">
            <Line label="Gross Sales" value={fs.gross_sales} />
            <Line label="Marketplace Fees" value={fs.marketplace_fees} negative />
            <Line label="Shipping" value={fs.shipping} negative />
            <Line label="Returns" value={fs.returns} negative />
            <Line label="TCS" value={fs.tcs} negative />
            <Line label="Other Adjustments" value={fs.other_adjustments} />
            <div className="border-t border-border pt-2 mt-2" />
            <Line label="Calculated Net" value={fs.calculated_net} bold />
            <Line label="Settlement Total" value={fs.settlement_total} bold />
            <div className="border-t border-border pt-2 mt-2" />
            <Line label="Difference Requiring Review" value={fs.difference_requiring_review} bold tone="warning" />
          </div>
        </Card>
      )}

      <div className="mt-10">
        <ResultsTable records={typedRecords} />
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  negative,
  bold,
  tone,
}: {
  label: string;
  value?: number;
  negative?: boolean;
  bold?: boolean;
  tone?: 'warning';
}) {
  if (value === undefined) return null;
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>
      <span className={bold ? '' : 'text-ink-muted'}>{label}</span>
      <span className="tabular-nums">
        {negative && value > 0 ? '−' : ''}
        {formatINR(Math.abs(value))}
      </span>
    </div>
  );
}
