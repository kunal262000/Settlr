import { NextRequest, NextResponse } from 'next/server';
import { verifyCashfreeWebhookSignature } from '@/lib/cashfree';
import { supabaseServiceRole } from '@/lib/supabase-server';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PlanId } from '@/lib/pricing';

export const runtime = 'nodejs';

interface CashfreeWebhookPayload {
  type: string;
  data: {
    order: { order_id: string; order_amount: number };
    payment: { payment_status: string };
  };
}

// Configure this URL (https://yourdomain.com/api/billing/webhook) in the
// Cashfree dashboard under Developers > Webhooks, subscribed to the
// PAYMENT_SUCCESS_WEBHOOK event. This route is the source of truth for
// activating a subscription — the return_url redirect (handled by
// /api/billing/verify) is only a same-request convenience for the UI and
// must never be trusted on its own.
export async function POST(req: NextRequest) {
  // Generous IP-based limit — Cashfree can legitimately retry webhook
  // delivery, so this guards against abuse/flooding rather than normal
  // retry behavior.
  const limited = await enforceRateLimit(`webhook:${getClientIp(req)}`, 120, 60);
  if (limited) return limited;

  const rawBody = await req.text();
  const signature = req.headers.get('x-webhook-signature');
  const timestamp = req.headers.get('x-webhook-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing webhook signature headers.' }, { status: 400 });
  }

  const valid = await verifyCashfreeWebhookSignature(rawBody, timestamp, signature);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as CashfreeWebhookPayload;

  if (payload.type !== 'PAYMENT_SUCCESS_WEBHOOK') {
    // Acknowledge other event types (failures, refunds, etc.) without
    // activating anything.
    return NextResponse.json({ received: true });
  }

  const orderId = payload.data.order.order_id;
  const supabase = supabaseServiceRole();

  const { data: payment } = await supabase
    .from('payments')
    .select('user_id, plan_id, amount')
    .eq('cashfree_order_id', orderId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: 'No matching payment record for this order.' }, { status: 404 });
  }

  await supabase
    .from('payments')
    .update({ status: 'SUCCESS', updated_at: new Date().toISOString() })
    .eq('cashfree_order_id', orderId);

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  await supabase.from('subscriptions').upsert({
    user_id: payment.user_id,
    plan_id: payment.plan_id as PlanId,
    status: 'active',
    cashfree_order_id: orderId,
    current_period_end: periodEnd.toISOString(),
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ received: true });
}
