import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabaseRouteHandler, supabaseServiceRole } from '@/lib/supabase-server';
import { createCashfreeOrder } from '@/lib/cashfree';
import { getPlan, PLANS, type PlanId } from '@/lib/pricing';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const VALID_PLAN_IDS = new Set(PLANS.map((p) => p.id));

export async function POST(req: NextRequest) {
  const supabase = supabaseRouteHandler();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const limited = await enforceRateLimit(`billing-create-order:${user.id}`, 10, 600);
  if (limited) return limited;

  const { planId } = (await req.json()) as { planId: PlanId };
  if (typeof planId !== 'string' || !VALID_PLAN_IDS.has(planId as PlanId)) {
    return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  }
  let plan;
  try {
    plan = getPlan(planId);
  } catch {
    return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  }
  if (plan.priceINR === 0) {
    return NextResponse.json({ error: 'The Free plan does not require checkout.' }, { status: 400 });
  }

  const orderId = `sm_${planId}_${user.id.slice(0, 8)}_${randomUUID().slice(0, 8)}`;
  const configuredAppUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '').trim().replace(/\/$/, '');
  const appUrl = configuredAppUrl || req.nextUrl.origin;

  try {
    const order = await createCashfreeOrder({
      orderId,
      amountINR: plan.priceINR,
      customerId: user.id,
      customerEmail: user.email ?? 'seller@settlr.app',
      returnUrl: `${appUrl}/dashboard/billing`,
    });

    const supa = supabaseServiceRole();
    const { error: insertError } = await supa.from('payments').insert({
      user_id: user.id,
      plan_id: planId,
      cashfree_order_id: order.order_id,
      amount: plan.priceINR,
      status: 'PENDING',
    });
    if (insertError) {
      return NextResponse.json({ error: `Could not record payment attempt: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
