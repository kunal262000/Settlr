import Link from 'next/link';
import { supabaseServiceRole, supabaseServerComponent } from '@/lib/supabase-server';
import { Card, StatCard, formatINR } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = supabaseServiceRole();

  // Signed-in admin (layout already gated, but we want the email for display)
  const userClient = supabaseServerComponent();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  // --- Aggregate counts (head-only, exact) ---
  const [userCount, jobCount, recordCount] = await Promise.all([
    (async () => {
      // auth users require the admin API; count via listUsers pagination
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

  // --- Jobs by status (last 1000 jobs is plenty for an overview) ---
  const { data: recentJobs } = await admin
    .from('reconciliation_jobs')
    .select('id, marketplace, status, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  const statusCounts: Record<string, number> = {};
  for (const j of recentJobs ?? []) {
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  }

  // --- Payments ---
  const { data: payments } = await admin
    .from('payments')
    .select('amount, status, created_at, plan_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  const revenue = (payments ?? [])
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const successfulPayments = (payments ?? []).filter((p) => p.status === 'SUCCESS').length;
  const failedPayments = (payments ?? []).filter((p) => p.status === 'FAILED').length;

  // --- Active subscriptions by plan ---
  const { data: subs } = await admin.from('subscriptions').select('plan_id, status');
  const planCounts: Record<string, number> = {};
  for (const s of subs ?? []) {
    if (s.status === 'active') planCounts[s.plan_id] = (planCounts[s.plan_id] ?? 0) + 1;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-navy">Settlr Admin</span>
            {user?.email && <span className="text-xs text-ink-muted">({user.email})</span>}
          </div>
          <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <section>
          <h1 className="text-2xl font-semibold text-navy">Overview</h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Users" value={String(userCount)} tone="navy" />
            <StatCard label="Reconciliations run" value={String(jobCount)} />
            <StatCard label="Orders compared" value={String(recordCount)} />
            <StatCard label="Revenue (SUCCESS)" value={formatINR(revenue)} tone="success" />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-semibold text-navy">Recent jobs by status</h2>
            <p className="text-xs text-ink-muted mt-1">Last {recentJobs?.length ?? 0} jobs</p>
            <ul className="mt-4 space-y-2">
              {Object.keys(statusCounts).length === 0 && (
                <li className="text-sm text-ink-muted">No jobs yet.</li>
              )}
              {Object.entries(statusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, n]) => (
                  <li key={status} className="flex justify-between text-sm">
                    <span className="text-ink-muted">{status}</span>
                    <span className="font-medium tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-navy">Active subscriptions</h2>
            <p className="text-xs text-ink-muted mt-1">By plan</p>
            <ul className="mt-4 space-y-2">
              {Object.keys(planCounts).length === 0 && (
                <li className="text-sm text-ink-muted">No subscriptions yet.</li>
              )}
              {Object.entries(planCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, n]) => (
                  <li key={plan} className="flex justify-between text-sm">
                    <span className="text-ink-muted capitalize">{plan}</span>
                    <span className="font-medium tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
            <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-ink-muted">Successful payments</p>
                <p className="font-medium tabular-nums">{successfulPayments}</p>
              </div>
              <div>
                <p className="text-ink-muted">Failed payments</p>
                <p className="font-medium tabular-nums">{failedPayments}</p>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <Card className="p-6">
            <h2 className="font-semibold text-navy">Latest reconciliations</h2>
            <p className="text-xs text-ink-muted mt-1">Most recent 10 across all users</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-border">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Marketplace</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">User</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentJobs ?? []).slice(0, 10).map((j) => (
                    <tr key={j.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 tabular-nums">
                        {new Date(j.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2 pr-4 capitalize">{j.marketplace}</td>
                      <td className="py-2 pr-4">{j.status}</td>
                      <td className="py-2 font-mono text-xs text-ink-muted">
                        {j.user_id.slice(0, 8)}…
                      </td>
                    </tr>
                  ))}
                  {(recentJobs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-ink-muted">
                        No reconciliations have been run yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
