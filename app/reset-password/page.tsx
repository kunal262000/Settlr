'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, Card } from '@/components/ui';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The reset-link redirect includes a recovery token in the URL fragment;
    // supabase-js picks it up and establishes a session automatically via
    // onAuthStateChange. We just wait for that PASSWORD_RECOVERY event (or
    // an already-present session) before showing the form.
    const supabase = supabaseBrowser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="text-sm font-semibold text-navy">Settlr</Link>
        <h1 className="mt-4 text-xl font-semibold text-navy">Set a new password</h1>

        {!ready && !done && (
          <p className="mt-6 text-sm text-ink-muted">
            Confirming your reset link… If this doesn&apos;t update in a moment, the link may
            have expired — request a new one from the{' '}
            <Link href="/forgot-password" className="text-teal font-medium">reset page</Link>.
          </p>
        )}

        {ready && !done && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">New password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Confirm new password</span>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}

        {done && (
          <p className="mt-6 text-sm text-success bg-success-bg rounded-xl p-4">
            Password updated. Taking you to your dashboard…
          </p>
        )}
      </Card>
    </div>
  );
}
