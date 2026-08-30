'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function CancelPlanButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not cancel your plan.');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-sm text-error font-medium hover:underline">
        Cancel plan
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-error-bg p-4">
      <p className="text-sm text-ink">
        Your plan will stay active until the end of the period you&apos;ve already paid for, then
        revert to Free. This won&apos;t refund the current period.
      </p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="!py-1.5 !px-3 text-xs" onClick={() => setConfirming(false)}>
          Keep plan
        </Button>
        <Button className="!py-1.5 !px-3 text-xs !bg-error hover:!bg-error/90" disabled={loading} onClick={handleCancel}>
          {loading ? 'Cancelling…' : 'Confirm cancellation'}
        </Button>
      </div>
    </div>
  );
}
