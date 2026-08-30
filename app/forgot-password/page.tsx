'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, Card } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Don't reveal whether the email exists — always show the same message.
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="text-sm font-semibold text-navy">Settlr</Link>
        <h1 className="mt-4 text-xl font-semibold text-navy">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <p className="mt-6 text-sm text-success bg-success-bg rounded-xl p-4">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm text-ink-muted text-center">
          <Link href="/login" className="text-teal font-medium">Back to log in</Link>
        </p>
      </Card>
    </div>
  );
}
