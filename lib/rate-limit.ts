import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseServiceRole } from './supabase-server';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter. Not perfectly atomic under very high
 * concurrency (a race between the select and the update could let a
 * request or two slip through right at the boundary), but that's an
 * acceptable tradeoff for abuse prevention on a seller tool at this
 * scale — the goal is stopping runaway scripts and scraping, not
 * millisecond-precise quota enforcement.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const supabase = supabaseServiceRole();
  const now = new Date();

  const { data: existing } = await supabase.from('rate_limits').select('*').eq('key', key).maybeSingle();

  if (!existing) {
    await supabase.from('rate_limits').insert({ key, count: 1, window_start: now.toISOString() });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const windowStart = new Date(existing.window_start);
  const elapsedSeconds = (now.getTime() - windowStart.getTime()) / 1000;

  if (elapsedSeconds >= windowSeconds) {
    await supabase.from('rate_limits').update({ count: 1, window_start: now.toISOString() }).eq('key', key);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsedSeconds)) };
  }

  const nextCount = existing.count + 1;
  await supabase.from('rate_limits').update({ count: nextCount }).eq('key', key);
  return { allowed: true, remaining: Math.max(0, limit - nextCount), retryAfterSeconds: 0 };
}

/** Returns a ready-to-send 429 response if the caller is over the limit, or null if they're clear. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<NextResponse | null> {
  const result = await checkRateLimit(key, limit, windowSeconds);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}

/** Best-effort client IP extraction behind a proxy (Vercel, etc). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
