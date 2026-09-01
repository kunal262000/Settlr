'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button, Card } from '@/components/ui';
import { StructuredData } from '@/components/structured-data';

const signupFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What does Settlr do for ecommerce sellers?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Settlr reconciles marketplace settlement reports with sales data to identify missing payouts, mismatched amounts, returns, duplicates, and other reconciliation gaps for Amazon, Flipkart, and Meesho sellers.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Settlr work for Indian marketplaces?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Settlr is designed for Indian ecommerce sellers who need to reconcile Meesho, Amazon, and Flipkart settlement reports against their own sales and payout records.',
      },
    },
  ],
};

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <>
      <StructuredData data={signupFaqSchema} />
      <div className="min-h-screen flex items-center justify-center bg-bg px-6">
        <Card className="w-full max-w-sm p-8">
          <Link href="/" className="text-sm font-semibold text-navy">Settlr</Link>
          <h1 className="mt-4 text-xl font-semibold text-navy">Create your account</h1>
          <p className="mt-1 text-sm text-ink-muted">Start reconciling your Meesho settlements.</p>

          {done ? (
            <p className="mt-6 text-sm text-success bg-success-bg rounded-xl p-4">
              Check your email to confirm your account, then log in.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Email" type="email" value={email} onChange={setEmail} required />
              <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />

              {error && <p className="text-sm text-error">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-ink-muted text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-teal font-medium">Log in</Link>
          </p>
        </Card>
      </div>
    </>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
      />
    </label>
  );
}
