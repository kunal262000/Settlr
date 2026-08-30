'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, Card } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already signed in (e.g. followed an old bookmark), skip straight to
  // the dashboard instead of showing the form again.
  useEffect(() => {
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace('/dashboard');
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="text-sm font-semibold text-navy">Settlr</Link>
        <h1 className="mt-4 text-xl font-semibold text-navy">Log in</h1>
        <p className="mt-1 text-sm text-ink-muted">Access your reconciliation dashboard.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <div>
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            <div className="mt-1.5 text-right">
              <Link href="/forgot-password" className="text-xs text-teal font-medium">Forgot password?</Link>
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink-muted text-center">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-teal font-medium">Sign up</Link>
        </p>
      </Card>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
      />
    </label>
  );
}
