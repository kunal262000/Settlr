import 'server-only';

// Cashfree PG Orders API — https://docs.cashfree.com/reference/pg-create-order
// Toggle sandbox vs production with CASHFREE_ENV=production. Sandbox is the
// default so this never accidentally hits live payments before you've
// deliberately switched over.
const CASHFREE_ENV = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
const BASE_URL = CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const API_VERSION = '2023-08-01';

function cashfreeHeaders() {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) {
    throw new Error('CASHFREE_APP_ID / CASHFREE_SECRET_KEY are not set.');
  }
  return {
    'Content-Type': 'application/json',
    'x-api-version': API_VERSION,
    'x-client-id': appId,
    'x-client-secret': secretKey,
  };
}

export interface CreateOrderParams {
  orderId: string;
  amountINR: number;
  customerId: string;
  customerEmail: string;
  customerPhone?: string;
  returnUrl: string;
}

export interface CashfreeOrderResponse {
  order_id: string;
  payment_session_id: string;
  order_status: string;
}

export async function createCashfreeOrder(params: CreateOrderParams): Promise<CashfreeOrderResponse> {
  const res = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: cashfreeHeaders(),
    body: JSON.stringify({
      order_id: params.orderId,
      order_amount: params.amountINR,
      order_currency: 'INR',
      customer_details: {
        customer_id: params.customerId,
        customer_email: params.customerEmail,
        // Cashfree requires a phone number; sellers who signed up without
        // one get a placeholder — fine for sandbox/testing, but swap in a
        // real collected phone number before going live.
        customer_phone: params.customerPhone || '9999999999',
      },
      order_meta: {
        return_url: `${params.returnUrl}?order_id={order_id}`,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Cashfree order creation failed (${res.status}).`);
  }
  return data as CashfreeOrderResponse;
}

export async function getCashfreeOrderStatus(orderId: string): Promise<{ order_status: string; order_amount: number }> {
  const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
    headers: cashfreeHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Could not fetch Cashfree order status (${res.status}).`);
  }
  return data;
}

/**
 * Verifies a Cashfree webhook using the timestamp + raw body HMAC-SHA256
 * scheme described at https://docs.cashfree.com/docs/webhooks — signature
 * is base64(HMAC-SHA256(secret, timestamp + rawBody)).
 */
export async function verifyCashfreeWebhookSignature(rawBody: string, timestamp: string, signature: string): Promise<boolean> {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY;
  if (!secret) throw new Error('CASHFREE_WEBHOOK_SECRET / CASHFREE_SECRET_KEY is not set.');

  const crypto = await import('node:crypto');
  const expected = crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');

  // Constant-time comparison to avoid timing attacks.
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
