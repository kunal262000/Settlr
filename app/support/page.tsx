'use client';

import Link from 'next/link';
import { Card } from '@/components/ui';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

const FAQ_ITEMS = [
  {
    q: 'How does Settlr match orders to settlements?',
    a: 'Settlr reads your marketplace settlement report and your sales/order report side by side. For each order in the sales report it looks for a corresponding payout row in the settlement report — matching by order ID, amount, and date range. Any order that has no matching settlement row is flagged as missing.',
  },
  {
    q: 'Which marketplaces does Settlr support?',
    a: 'Settlr currently supports Amazon, Flipkart, and Meesho. Each marketplace has its own report format; Settlr handles the parsing and normalisation internally.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your files are stored in your private Supabase bucket and never shared with any third party. Row-level security ensures only you can access your data.',
  },
  {
    q: 'Does Settlr read my GST details from reports?',
    a: 'Settlr extracts TCS/TDS and GST-related deduction lines from your settlement reports so you can verify them against your books. It does not connect to any GST portal.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no long-term contracts. You can cancel your subscription from the Billing page at any time.',
  },
  {
    q: 'How do I upgrade or change my plan?',
    a: 'Go to Dashboard → Billing. You can upgrade, downgrade, or cancel your plan from there.',
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => setUserEmail(data.session?.user.email ?? null));
  }, []);

  const isLoggedIn = !!userEmail;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-navy flex items-center justify-center">
              <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true">
                <path d="M14 36 L26 46 L50 18" fill="none" stroke="#2DD4BF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 20 L26 30" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
              </svg>
            </div>
            <span className="font-semibold text-navy">Settlr</span>
          </Link>
          {isLoggedIn ? (
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="text-ink-muted hover:text-ink">Home</Link>
              <Link href="/dashboard" className="text-ink-muted hover:text-ink">Dashboard</Link>
              <Link href="/dashboard/new" className="text-ink-muted hover:text-ink">New Reconciliation</Link>
              <Link href="/dashboard/billing" className="text-ink-muted hover:text-ink">Billing</Link>
              <span className="text-ink-muted hidden sm:block">{userEmail}</span>
              <button
                onClick={async () => {
                  await supabaseBrowser().auth.signOut();
                  router.push('/');
                  router.refresh();
                }}
                className="text-ink-muted hover:text-ink"
              >
                Log out
              </button>
            </nav>
          ) : (
            <Link
              href="/signup"
              className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Get started
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-navy">Support</h1>
        <p className="mt-3 text-ink-muted">
          Frequently asked questions. If you need further help, email{' '}
          <a href="mailto:admin@settlr.app" className="text-teal">
            admin@settlr.app
          </a>
          .
        </p>

        <div className="mt-10 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <Card key={item.q} className="p-6">
              <h2 className="text-base font-medium text-navy">{item.q}</h2>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">{item.a}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-ink-muted">
          <Link href="/" className="text-teal font-medium">← Back to Settlr</Link>
        </div>
      </footer>
    </div>
  );
}
