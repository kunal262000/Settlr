import { NextRequest, NextResponse } from 'next/server';
import { supabaseRouteHandler } from '@/lib/supabase-server';
import { normalizeRows } from '@/lib/parsers';
import { reconcile } from '@/lib/reconciliation';
import { checkReconciliationAllowance } from '@/lib/billing';
import { getPlan } from '@/lib/pricing';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { ColumnMapping, Marketplace } from '@/lib/types';
import { MARKETPLACES } from '@/lib/types';

const MAX_ROWS_PER_REQUEST = 200_000; // matches the parser's own hard cap
const VALID_MARKETPLACE_IDS = new Set(MARKETPLACES.map((m) => m.id));

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ReconcileRequestBody {
  marketplace: Marketplace;
  settlementFileName: string;
  settlementRows: Record<string, unknown>[];
  settlementMapping: ColumnMapping;
  salesFileName: string;
  salesRows: Record<string, unknown>[];
  salesMapping: ColumnMapping;
}

export async function POST(req: NextRequest) {
  const supabase = supabaseRouteHandler();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await req.json()) as ReconcileRequestBody;

  // Defense-in-depth input validation — don't trust client-supplied shape
  // or size even though this is an authenticated route.
  if (!VALID_MARKETPLACE_IDS.has(body.marketplace)) {
    return NextResponse.json({ error: 'Invalid marketplace.' }, { status: 400 });
  }
  if (!Array.isArray(body.settlementRows) || !Array.isArray(body.salesRows)) {
    return NextResponse.json({ error: 'Malformed request: rows must be arrays.' }, { status: 400 });
  }
  if (body.settlementRows.length > MAX_ROWS_PER_REQUEST || body.salesRows.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json({ error: `A file exceeds the ${MAX_ROWS_PER_REQUEST.toLocaleString('en-IN')} row limit.` }, { status: 400 });
  }
  if (typeof body.settlementMapping !== 'object' || typeof body.salesMapping !== 'object') {
    return NextResponse.json({ error: 'Malformed request: column mappings must be objects.' }, { status: 400 });
  }
  if (typeof body.settlementFileName !== 'string' || typeof body.salesFileName !== 'string') {
    return NextResponse.json({ error: 'Malformed request: file names must be strings.' }, { status: 400 });
  }

  const limited = await enforceRateLimit(`reconcile:${user.id}`, 10, 300);
  if (limited) return limited;

  if (!body.settlementMapping?.order_id || !body.salesMapping?.order_id) {
    return NextResponse.json(
      { error: 'Order ID column must be mapped on both files before reconciliation can run.' },
      { status: 400 }
    );
  }

  const allowance = await checkReconciliationAllowance(supabase, user.id);
  if (!allowance.allowed) {
    return NextResponse.json(
      {
        error: `You've used all ${allowance.limit} reconciliations included in your free plan this month. Upgrade to Starter or Growth for unlimited reconciliations.`,
        upgradeRequired: true,
      },
      { status: 402 }
    );
  }

  const plan = getPlan(allowance.planId);
  if (plan.maxOrdersPerFile !== null) {
    const rowCount = Math.max(body.settlementRows.length, body.salesRows.length);
    if (rowCount > plan.maxOrdersPerFile) {
      return NextResponse.json(
        {
          error: `Your ${plan.name} plan supports up to ${plan.maxOrdersPerFile.toLocaleString('en-IN')} orders per file. This file has ${rowCount.toLocaleString('en-IN')} rows — upgrade to a higher plan for larger files.`,
          upgradeRequired: true,
        },
        { status: 402 }
      );
    }
  }

  try {
    const marketplace: Marketplace = body.marketplace ?? 'meesho';
    const marketplaceTxns = normalizeRows(body.settlementRows, body.settlementMapping, marketplace);
    const sellerTxns = normalizeRows(body.salesRows, body.salesMapping, 'seller');

    const { records, summary } = reconcile(sellerTxns, marketplaceTxns);

    const { data: job, error: jobError } = await supabase
      .from('reconciliation_jobs')
      .insert({
        user_id: user.id,
        marketplace,
        status: 'completed',
        settlement_file_name: body.settlementFileName,
        settlement_file_rows: body.settlementRows.length,
        sales_file_name: body.salesFileName,
        sales_file_rows: body.salesRows.length,
        column_mapping: { settlement: body.settlementMapping, sales: body.salesMapping },
        total_records: summary.total_records,
        matched_count: summary.matched_count,
        needs_attention_count: summary.needs_attention_count,
        amount_requiring_review: summary.amount_requiring_review,
        financial_summary: summary.financial_summary,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: `Could not save reconciliation job: ${jobError?.message}` }, { status: 500 });
    }

    const recordRows = records.map((r) => ({
      job_id: job.id,
      user_id: user.id,
      order_id: r.order_id,
      status: r.status,
      seller_record: r.seller_record ? stripRaw(r.seller_record) : null,
      marketplace_records: r.marketplace_records.map(stripRaw),
      expected_amount: r.expected_amount ?? null,
      marketplace_amount: r.marketplace_amount ?? null,
      difference: r.difference ?? null,
      reason: r.reason,
    }));

    // Insert in chunks to stay under request size limits on large files.
    const CHUNK = 500;
    for (let i = 0; i < recordRows.length; i += CHUNK) {
      const chunk = recordRows.slice(i, i + CHUNK);
      const { error: recordsError } = await supabase.from('reconciliation_records').insert(chunk);
      if (recordsError) {
        await supabase.from('reconciliation_jobs').update({ status: 'failed', error_message: recordsError.message }).eq('id', job.id);
        return NextResponse.json({ error: `Could not save reconciliation records: ${recordsError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    return NextResponse.json({ error: `Reconciliation failed: ${(err as Error).message}` }, { status: 500 });
  }
}

function stripRaw<T extends { _raw?: unknown }>(t: T): Omit<T, '_raw'> {
  const { _raw, ...rest } = t;
  return rest;
}
