import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlan, type PlanId } from './pricing';

export async function getUserPlanId(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return 'free';

  // A subscription past its paid period falls back to free, whether it was
  // still "active" (never got here because there's no real auto-renew yet)
  // or "cancelled" (expected — cancelling stops renewal but the period
  // already paid for still runs out).
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return 'free';

  // 'cancelled' intentionally still resolves to the paid plan_id here —
  // cancelling stops future billing, not the period already paid for.
  if (data.status !== 'active' && data.status !== 'cancelled') return 'free';

  return data.plan_id as PlanId;
}

export async function checkReconciliationAllowance(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; planId: PlanId; usedThisMonth: number; limit: number | null }> {
  const planId = await getUserPlanId(supabase, userId);
  const plan = getPlan(planId);

  if (plan.reconciliationsPerMonth === null) {
    return { allowed: true, planId, usedThisMonth: 0, limit: null };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('reconciliation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'failed') // a system error mid-reconciliation shouldn't cost the user their quota
    .gte('created_at', startOfMonth.toISOString());

  const usedThisMonth = count ?? 0;
  return {
    allowed: usedThisMonth < plan.reconciliationsPerMonth,
    planId,
    usedThisMonth,
    limit: plan.reconciliationsPerMonth,
  };
}
