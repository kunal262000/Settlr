'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import type { Plan, PlanId } from '@/lib/pricing';
import { formatPlanPrice } from '@/lib/pricing';

declare global {
  interface Window {
    Cashfree?: (config: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: '_self' }) => void;
    };
  }
}

export default function PlanPicker({ plans, currentPlanId }: { plans: Plan[]; currentPlanId: PlanId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // On return from Cashfree checkout, the order_id query param confirms
  // the attempt — verify it server-side and refresh so the new plan shows.
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId) return;
    setVerifying(true);
    fetch(`/api/billing/verify?order_id=${encodeURIComponent(orderId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'SUCCESS') {
          router.replace('/dashboard/billing');
          router.refresh();
        } else {
          setError('Payment is still processing. This can take a minute — refresh shortly.');
        }
      })
      .catch(() => setError('Could not verify payment status.'))
      .finally(() => setVerifying(false));
  }, [searchParams, router]);

  async function handleUpgrade(planId: PlanId) {
    setError(null);
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start checkout.');
        setLoadingPlan(null);
        return;
      }

      // Load the Cashfree JS SDK on demand rather than on every page load.
      if (!window.Cashfree) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Could not load Cashfree checkout.'));
          document.head.appendChild(script);
        });
      }

      if (!window.Cashfree) {
        throw new Error('Cashfree SDK is unavailable. Please try again in a moment.');
      }

      const mode = process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
      const cashfree = window.Cashfree({ mode });
      cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setError((err as Error).message);
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {verifying && <p className="mt-4 text-sm text-ink-muted">Confirming your payment…</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 grid sm:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={`p-6 flex flex-col ${plan.highlight ? 'border-2 border-teal' : ''}`}>
            <p className="font-medium text-navy">{plan.name}</p>
            <p className="text-2xl font-semibold text-navy mt-2">{formatPlanPrice(plan)}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-muted flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {currentPlanId === plan.id ? (
                <Button variant="secondary" disabled className="w-full">Current plan</Button>
              ) : plan.priceINR === 0 ? (
                <Button variant="secondary" disabled className="w-full">Free plan</Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={loadingPlan !== null}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {loadingPlan === plan.id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
