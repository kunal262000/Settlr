import Link from 'next/link';
import { supabaseServiceRole, supabaseServerComponent } from '@/lib/supabase-server';
import { Card, StatCard, formatINR } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = supabaseServiceRole();

  const userClient = supabaseServerComponent();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  const [userCount, jobCount, recordCount] = await Promise.all([
    (async () => {
      let total = 0;
      let page = 1;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        total += data.users.length;
        if (data.users.length < 200) break;
        page += 1;
      }
      return total;
    })(),
    admin
      .from('reconciliation_jobs')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => count ?? 0),
    admin
      .from('reconciliation_records')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => count ?? 0),
  ]);

  const { data: recentJobs } = await admin
    .from('reconciliation_jobs')
    .select('id, marketplace, status, created_at, user_id, total_records, matched_count, needs_attention_count, amount_requiring_review')
    .order('created_at', { ascending: false })
    .limit(250);

  const { data: payments } = await admin
    .from('payments')
    .select('amount, status, created_at, plan_id, user_id')
    .order('created_at', { ascending: false })
    .limit(500);

  const { data: subs } = await admin.from('subscriptions').select('plan_id, status, user_id, updated_at');

  let allUsers: Array<{ id: string; email?: string; created_at?: string; last_sign_in_at?: string }> = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    allUsers = allUsers.concat((data.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    })));
    if ((data.users ?? []).length < 200) break;
  }

  const recentUsers = [...allUsers]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 8);

  const userPlanMap = new Map((subs ?? []).map((s) => [s.user_id, s]));

  const statusCounts: Record<string, number> = {};
  for (const j of recentJobs ?? []) {
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  }

  const marketplaceCounts: Record<string, number> = {};
  for (const j of recentJobs ?? []) {
    const key = (j.marketplace ?? 'unknown').toString();
    marketplaceCounts[key] = (marketplaceCounts[key] ?? 0) + 1;
  }

  const revenue = (payments ?? [])
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const successfulPayments = (payments ?? []).filter((p) => p.status === 'SUCCESS').length;
  const failedPayments = (payments ?? []).filter((p) => p.status === 'FAILED').length;
  const pendingPayments = (payments ?? []).filter((p) => p.status === 'PENDING').length;

  const activeSubscriptions = (subs ?? []).filter((s) => s.status === 'active').length;
  const cancelledSubscriptions = (subs ?? []).filter((s) => s.status === 'cancelled').length;
  const planCounts: Record<string, number> = {};
  for (const s of subs ?? []) {
    if (s.status === 'active') {
      planCounts[s.plan_id] = (planCounts[s.plan_id] ?? 0) + 1;
    }
  }

  const completedJobs = (recentJobs ?? []).filter((j) => j.status === 'completed').length;
  const processingJobs = (recentJobs ?? []).filter((j) => j.status === 'processing').length;
  const failedJobCount = (recentJobs ?? []).filter((j) => j.status === 'failed').length;
  const jobsWithAttention = (recentJobs ?? []).filter((j) => Number(j.needs_attention_count ?? 0) > 0).length;
  const successRate = jobCount > 0 ? Math.round((completedJobs / jobCount) * 100) : 0;

  const latestJobs = (recentJobs ?? []).slice(0, 8);
  const failedJobRows = (recentJobs ?? [])
    .filter((j) => j.status === 'failed' || Number(j.needs_attention_count ?? 0) > 0)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-navy">Settlr Admin</span>
            {user?.email && <span className="text-xs text-ink-muted">({user.email})</span>}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
              Back to app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-teal font-medium uppercase tracking-[0.12em]">Operations overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-navy">Admin dashboard</h1>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
            <span className="font-medium text-navy">Health:</span> {successRate}% successful reconciliation rate
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={String(userCount)} tone="navy" />
          <StatCard label="Total jobs" value={String(jobCount)} />
          <StatCard label="Orders compared" value={String(recordCount)} />
          <StatCard label="Revenue" value={formatINR(revenue)} tone="success" />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="p-6">
            <h2 className="font-semibold text-navy">System health</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Completed</span>
                <span className="font-medium tabular-nums">{completedJobs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Processing</span>
                <span className="font-medium tabular-nums">{processingJobs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Failed</span>
                <span className="font-medium tabular-nums text-error">{failedJobCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Jobs needing attention</span>
                <span className="font-medium tabular-nums text-warning">{jobsWithAttention}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-navy">Billing health</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Active subscriptions</span>
                <span className="font-medium tabular-nums">{activeSubscriptions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Cancelled</span>
                <span className="font-medium tabular-nums">{cancelledSubscriptions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Successful payments</span>
                <span className="font-medium tabular-nums">{successfulPayments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Failed / pending</span>
                <span className="font-medium tabular-nums">{failedPayments + pendingPayments}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-navy">Marketplace mix</h2>
            <div className="mt-4 space-y-3 text-sm">
              {Object.keys(marketplaceCounts).length === 0 && (
                <p className="text-ink-muted">No jobs yet.</p>
              )}
              {Object.entries(marketplaceCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([marketplace, count]) => (
                  <div key={marketplace} className="flex items-center justify-between">
                    <span className="text-ink-muted capitalize">{marketplace}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <h2 className="font-semibold text-navy">Recent activity</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-2 pr-4 font-medium">When</th>
                    <th className="pb-2 pr-4 font-medium">Marketplace</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {latestJobs.map((job) => (
                    <tr key={job.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 tabular-nums text-ink-muted">
                        {new Date(job.created_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2 pr-4 capitalize">{job.marketplace}</td>
                      <td className="py-2 pr-4">{job.status}</td>
                      <td className="py-2 font-medium tabular-nums">{job.total_records ?? 0}</td>
                    </tr>
                  ))}
                  {latestJobs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-ink-muted">
                        No reconciliation activity yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-navy">Plan distribution</h2>
            <div className="mt-4 space-y-3 text-sm">
              {Object.keys(planCounts).length === 0 && <p className="text-ink-muted">No paid plans active yet.</p>}
              {Object.entries(planCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, count]) => (
                  <div key={plan} className="rounded-lg border border-border bg-bg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize text-navy">{plan}</span>
                      <span className="tabular-nums">{count}</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-border bg-bg p-4">
              <h3 className="text-sm font-semibold text-navy">Admin checklist</h3>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                <li>• Review failed jobs and abnormal mismatches</li>
                <li>• Track billing and upgrade demand</li>
                <li>• Monitor plan activation and churn</li>
              </ul>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-semibold text-navy">Failed jobs & attention</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-2 pr-4 font-medium">Job</th>
                    <th className="pb-2 pr-4 font-medium">Market</th>
                    <th className="pb-2 pr-4 font-medium">Need attention</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {failedJobRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-ink-muted">
                        No failed or attention-needed jobs right now.
                      </td>
                    </tr>
                  )}
                  {failedJobRows.map((job) => (
                    <tr key={job.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-ink-muted">
                        {job.id.slice(0, 8)}…
                      </td>
                      <td className="py-2 pr-4 capitalize">{job.marketplace}</td>
                      <td className="py-2 pr-4 tabular-nums">{job.needs_attention_count ?? 0}</td>
                      <td className="py-2 font-medium text-error">{job.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-navy">Latest users</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-ink-muted">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {recentUsers.map((u) => {
                    const plan = userPlanMap.get(u.id)?.plan_id ?? 'free';
                    const status = userPlanMap.get(u.id)?.status ?? 'active';
                    return (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs text-ink-muted">{u.email ?? 'Unknown user'}</td>
                        <td className="py-2 pr-4 capitalize">{plan} {status !== 'active' ? `(${status})` : ''}</td>
                        <td className="py-2 tabular-nums text-ink-muted">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-semibold text-navy">Job status breakdown</h2>
            <ul className="mt-4 space-y-2">
              {Object.keys(statusCounts).length === 0 && <li className="text-sm text-ink-muted">No jobs yet.</li>}
              {Object.entries(statusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <li key={status} className="flex justify-between text-sm">
                    <span className="text-ink-muted">{status}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-navy">Billing summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Revenue</span>
                <span className="font-medium tabular-nums text-success">{formatINR(revenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Successful payments</span>
                <span className="font-medium tabular-nums">{successfulPayments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Failed payments</span>
                <span className="font-medium tabular-nums text-error">{failedPayments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Pending payments</span>
                <span className="font-medium tabular-nums text-warning">{pendingPayments}</span>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
