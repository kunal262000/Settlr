import { NextRequest, NextResponse } from 'next/server';
import { supabaseRouteHandler, supabaseServiceRole } from '@/lib/supabase-server';
import { getCashfreeOrderStatus } from '@/lib/cashfree';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { PlanId } from '@/lib/pricing';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = supabaseRouteHandler();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const limited = await enforceRateLimit(`billing-verify:${user.id}`, 30, 300);
  if (limited) return limited;

  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id.' }, { status: 400 });
  }

  // Confirm this order actually belongs to the signed-in user before doing
  // anything with it — RLS enforces this on the select.
  const { data: payment } = await supabase
    .from('payments')
    .select('plan_id, status')
    .eq('cashfree_order_id', orderId)
    .eq('user_id', user.id)
    .single();

  if (!payment) {
    return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
  }

  if (payment.status === 'SUCCESS') {
    return NextResponse.json({ status: 'SUCCESS' });
  }

  try {
    const orderStatus = await getCashfreeOrderStatus(orderId);
    if (orderStatus.order_status !== 'PAID') {
      return NextResponse.json({ status: orderStatus.order_status });
    }

    // Activate immediately after independently confirming order status with
    // Cashfree's API, using the service-role client since regular users have
    // no write policy on these tables.
    const serviceClient = supabaseServiceRole();
    await serviceClient
      .from('payments')
      .update({ status: 'SUCCESS', updated_at: new Date().toISOString() })
      .eq('cashfree_order_id', orderId);

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    await serviceClient.from('subscriptions').upsert({
      user_id: user.id,
      plan_id: payment.plan_id as PlanId,
      status: 'active',
      cashfree_order_id: orderId,
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
