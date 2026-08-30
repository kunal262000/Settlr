import Link from 'next/link';
import { supabaseServerComponent } from '@/lib/supabase-server';
import { Button, Card, StatCard, formatINR } from '@/components/ui';
import type { ReconciliationJob } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from('reconciliation_jobs')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const allJobs = (jobs ?? []) as ReconciliationJob[];
  const completed = allJobs.filter((j) => j.status === 'completed');

  const totals = completed.reduce(
    (acc, j) => ({
      total: acc.total + j.total_records,
      matched: acc.matched + j.matched_count,
      needAttention: acc.needAttention + j.needs_attention_count,
      review: acc.review + j.amount_requiring_review,
    }),
    { total: 0, matched: 0, needAttention: 0, review: 0 }
  );

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Welcome back 👋</h1>
          <p className="text-ink-muted mt-1">Here&apos;s your settlement overview.</p>
        </div>
        <Link href="/dashboard/new">
          <Button>New Reconciliation</Button>
        </Link>
      </div>

      {allJobs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Orders Reconciled" value={totals.total.toLocaleString('en-IN')} tone="navy" />
            <StatCard label="Successfully Matched" value={totals.matched.toLocaleString('en-IN')} tone="success" />
            <StatCard label="Need Attention" value={totals.needAttention.toLocaleString('en-IN')} tone="warning" />
            <StatCard label="Amount Requiring Review" value={formatINR(totals.review)} tone="warning" />
          </div>

          <h2 className="mt-12 text-lg font-semibold text-navy">Recent reconciliations</h2>
          <div className="mt-4 space-y-3">
            {allJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function JobRow({ job }: { job: ReconciliationJob }) {
  const dateLabel = new Date(job.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Link href={`/dashboard/jobs/${job.id}`}>
      <Card className="p-5 hover:border-navy/20 transition-colors">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-medium text-navy capitalize">{job.marketplace} Settlement</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {job.status === 'processing' ? 'Processing…' : job.status === 'failed' ? `Failed — ${job.error_message ?? 'see details'}` : `Completed on ${dateLabel}`}
            </p>
          </div>
          {job.status === 'completed' && (
            <div className="flex items-center gap-6 text-sm">
              <Metric label="Orders" value={job.total_records.toLocaleString('en-IN')} />
              <Metric label="Matched" value={job.matched_count.toLocaleString('en-IN')} tone="success" />
              <Metric label="Need Attention" value={job.needs_attention_count.toLocaleString('en-IN')} tone="warning" />
              <Metric label="Requiring Review" value={formatINR(job.amount_requiring_review)} tone="warning" />
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-ink';
  return (
    <div className="text-right">
      <p className={`font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="mt-8 p-12 text-center">
      <h2 className="text-lg font-semibold text-navy">No reconciliations yet</h2>
      <p className="mt-2 text-sm text-ink-muted max-w-sm mx-auto">
        Upload your first Meesho settlement report and sales register to see what matches and
        what needs your attention.
      </p>
      <Link href="/dashboard/new" className="inline-block mt-6">
        <Button>Start your first reconciliation</Button>
      </Link>
    </Card>
  );
}
