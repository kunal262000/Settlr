import { NextRequest, NextResponse } from 'next/server';
import { supabaseRouteHandler } from '@/lib/supabase-server';
import { buildExportWorkbook } from '@/lib/export';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { ReconciliationJob, ReconciliationRecord } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseRouteHandler();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const limited = await enforceRateLimit(`export:${user.id}`, 30, 300);
  if (limited) return limited;

  // RLS also enforces this, but we check explicitly for a clean 404 instead
  // of a generic empty result.
  const { data: job, error: jobError } = await supabase
    .from('reconciliation_jobs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Reconciliation job not found.' }, { status: 404 });
  }

  const { data: records, error: recordsError } = await supabase
    .from('reconciliation_records')
    .select('*')
    .eq('job_id', params.id)
    .eq('user_id', user.id)
    .order('order_id');

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }

  const mappedRecords: ReconciliationRecord[] = (records ?? []).map((r) => ({
    id: r.id,
    order_id: r.order_id,
    status: r.status,
    seller_record: r.seller_record ?? undefined,
    seller_records: r.seller_records ?? [],
    marketplace_records: r.marketplace_records ?? [],
    expected_amount: r.expected_amount ?? undefined,
    marketplace_amount: r.marketplace_amount ?? undefined,
    difference: r.difference ?? undefined,
    reason: r.reason,
    transaction_date: r.seller_record?.transaction_date,
    possible_match_order_id: r.possible_match_order_id ?? undefined,
  }));

  const buffer = buildExportWorkbook(job as ReconciliationJob, mappedRecords);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="settlr-${params.id}.xlsx"`,
    },
  });
}
