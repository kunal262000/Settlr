import { NextRequest, NextResponse } from 'next/server';
import { supabaseRouteHandler } from '@/lib/supabase-server';
import { detectSellerColumns, detectSettlementColumns, isParseError, mappingFromDetected, parseFileBuffer, validateFile } from '@/lib/parsers';
import type { Marketplace } from '@/lib/types';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = supabaseRouteHandler();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const limited = await enforceRateLimit(`upload:${user.id}`, 30, 300);
  if (limited) return limited;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const kind = form.get('kind') as string | null; // 'settlement' | 'sales'
  const marketplace = (form.get('marketplace') as Marketplace | null) ?? 'meesho';

  if (!file) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
  }
  if (kind !== 'settlement' && kind !== 'sales') {
    return NextResponse.json({ error: 'Invalid upload kind.' }, { status: 400 });
  }

  const validationError = validateFile(file.name, file.size);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseFileBuffer(file.name, buffer);

  if (isParseError(parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const detected = kind === 'settlement' ? detectSettlementColumns(marketplace, parsed.columns) : detectSellerColumns(parsed.columns);
  const suggestedMapping = mappingFromDetected(detected);

  return NextResponse.json({
    fileName: parsed.fileName,
    rowCount: parsed.rowCount,
    columns: parsed.columns,
    rows: parsed.rows,
    detected,
    suggestedMapping,
  });
}
