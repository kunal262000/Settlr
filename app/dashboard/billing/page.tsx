import { supabaseServerComponent } from '@/lib/supabase-server';
import { checkReconciliationAllowance } from '@/lib/billing';
import { getPlan, PLANS } from '@/lib/pricing';
import { Card } from '@/components/ui';
import PlanPicker from './plan-picker';
import CancelPlanButton from './cancel-plan-button';

export default async function BillingPage() {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowance = await checkReconciliationAllowance(supabase, user!.id);
  const currentPlan = getPlan(allowance.planId);

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', user!.id)
    .maybeSingle();

  const isCancelled = subscription?.status === 'cancelled';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Billing</h1>
      <p className="text-ink-muted mt-1">Manage your Settlr plan.</p>

      <Card className="mt-6 p-6 max-w-xl">
        <p className="text-sm text-ink-muted">Current plan</p>
        <p className="text-xl font-semibold text-navy mt-1">{currentPlan.name}</p>
        {allowance.limit !== null ? (
          <p className="text-sm text-ink-muted mt-2">
            {allowance.usedThisMonth} of {allowance.limit} reconciliations used this month
          </p>
        ) : (
          <p className="text-sm text-success mt-2">Unlimited reconciliations</p>
        )}

        {currentPlan.priceINR > 0 && subscription?.current_period_end && (
          <p className="text-xs text-ink-muted mt-3">
            {isCancelled
              ? `Cancelled — access continues until ${new Date(subscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}, then reverts to Free.`
              : `Renews ${new Date(subscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          </p>
        )}

        {currentPlan.priceINR > 0 && !isCancelled && (
          <div className="mt-4">
            <CancelPlanButton />
          </div>
        )}
      </Card>

      <h2 className="mt-10 text-lg font-semibold text-navy">Plans</h2>
      <PlanPicker plans={PLANS} currentPlanId={allowance.planId} />
    </div>
  );
}
