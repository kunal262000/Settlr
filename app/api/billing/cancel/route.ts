import { NextResponse } from 'next/server';
import { supabaseRouteHandler, supabaseServiceRole } from '@/lib/supabase-server';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(_req: Request) {
  const supabase = supabaseRouteHandler();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const limited = await enforceRateLimit(`billing-cancel:${user.id}`, 10, 600);
  if (limited) return limited;

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing || existing.plan_id === 'free') {
    return NextResponse.json({ error: 'You are not on a paid plan.' }, { status: 400 });
  }

  // Regular users have no update policy on subscriptions (see schema.sql) —
  // writes go through the service-role client, only after the ownership
  // check above using the user's own session.
  const serviceClient = supabaseServiceRole();
  const { error } = await serviceClient
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true });
}
