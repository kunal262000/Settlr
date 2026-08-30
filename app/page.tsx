import Link from 'next/link';
import { Button } from '@/components/ui';
import { supabaseServerComponent } from '@/lib/supabase-server';

export default async function LandingPage() {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <WhatItCatches />
      <FinalCTA />
      <Footer isLoggedIn={!!user} />
    </div>
  );
}

function Nav() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-navy flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true">
              <path d="M14 36 L26 46 L50 18" fill="none" stroke="#2DD4BF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 20 L26 30" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
            </svg>
          </div>
          <div className="leading-tight">
            <span className="font-semibold text-navy">Settlr</span>
            <span className="block text-[10px] text-ink-muted">Your settlements, settled.</span>
          </div>
        </div>
        <nav className="hidden sm:flex items-center gap-8 text-sm text-ink-muted">
          <a href="#how-it-works" className="hover:text-ink">How it works</a>
          <a href="#what-it-catches" className="hover:text-ink">What it catches</a>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/blog" className="hover:text-ink">Blog</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink hidden sm:block">
            Log in
          </Link>
          <Link href="/signup">
            <Button className="!py-2 !px-4 text-sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-14 items-center">
      <div>
        <p className="inline-flex items-center rounded-full bg-teal-soft text-teal px-3 py-1 text-xs font-medium mb-6">
          Amazon · Flipkart · Meesho
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-navy leading-[1.1]">
          Did Your Marketplace Pay You Correctly?
        </h1>
        <p className="mt-6 text-lg text-ink-muted leading-relaxed max-w-lg">
          Upload your settlement and sales reports from Amazon, Flipkart, or Meesho. Settlr
          automatically identifies missing settlements, amount mismatches, return discrepancies,
          and deductions that need your attention.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup">
            <Button className="text-base">Reconcile My Settlement</Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="secondary" className="text-base">How It Works</Button>
          </a>
        </div>
        <p className="mt-6 text-xs text-ink-muted">
          No card required. Your files stay private to your account.
        </p>
      </div>

      <ReconciliationFlowVisual />
    </section>
  );
}

function ReconciliationFlowVisual() {
  const steps = [
    { label: 'UPLOAD', detail: 'Settlement + Sales Reports' },
    { label: 'MATCH', detail: 'Orders and Transactions' },
    { label: 'ANALYZE', detail: 'Amounts and Deductions' },
    { label: 'DISCOVER', detail: 'What Needs Attention' },
  ];

  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-surface shadow-card p-6">
        <div className="flex flex-col">
          {steps.map((step, i) => (
            <div key={step.label}>
              <div className="flex items-center gap-4 py-3">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-navy/5 border border-navy/10 flex items-center justify-center text-navy text-xs font-semibold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy tracking-wide">{step.label}</p>
                  <p className="text-sm text-ink-muted">{step.detail}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="ml-[1.1rem] h-5 w-px bg-border" aria-hidden />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-warning-bg border border-warning/20 p-4">
          <p className="text-xs text-warning font-medium uppercase tracking-wide">Product example</p>
          <p className="mt-1 text-2xl font-semibold text-navy tabular-nums">₹34,430</p>
          <p className="text-sm text-ink-muted">Requiring Review</p>
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const items = [
    'Order-level matching, not just totals',
    'Every figure traceable to your source files',
    'Your data stays isolated to your account',
  ];
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-6 grid sm:grid-cols-3 gap-4 text-sm text-ink-muted">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: 'Upload',
      body: 'Upload your marketplace settlement and sales/order reports.',
    },
    {
      title: 'We Reconcile',
      body: 'Settlr matches orders and analyzes settlements, deductions, and transaction differences.',
    },
    {
      title: 'Find What Needs Attention',
      body: 'See missing settlements, mismatches, returns, and unexplained differences in one place.',
    },
  ];

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="text-3xl font-semibold text-navy text-center">How it works</h2>
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {steps.map((step, i) => (
          <div key={step.title} className="rounded-2xl border border-border bg-surface p-8">
            <p className="text-sm font-mono text-teal mb-4">Step {i + 1}</p>
            <h3 className="text-lg font-semibold text-navy">{step.title}</h3>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatItCatches() {
  const rows = [
    { title: 'Missing settlements', body: 'Orders in your sales report that the marketplace never paid out.' },
    { title: 'Amount mismatches', body: 'Settled amounts that differ from what your records expect.' },
    { title: 'Return discrepancies', body: 'Returns and RTOs where the deduction needs a closer look.' },
    { title: 'Unexplained deductions', body: 'Commission, shipping, and adjustment fees broken out clearly.' },
  ];
  return (
    <section id="what-it-catches" className="bg-navy">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl font-semibold text-white text-center">What it catches</h2>
        <div className="mt-12 grid sm:grid-cols-2 gap-6">
          {rows.map((row) => (
            <div key={row.title} className="rounded-2xl bg-white/[0.04] border border-white/10 p-6">
              <h3 className="text-white font-medium">{row.title}</h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{row.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h2 className="text-3xl font-semibold text-navy">Reconcile your first settlement in minutes</h2>
      <p className="mt-4 text-ink-muted">Free to try. No card required.</p>
      <div className="mt-8">
        <Link href="/signup">
          <Button className="text-base">Reconcile My Settlement</Button>
        </Link>
      </div>
    </section>
  );
}

function Footer({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12 grid sm:grid-cols-3 lg:grid-cols-5 gap-8">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-navy flex items-center justify-center">
              <svg viewBox="0 0 64 64" className="h-4 w-4" aria-hidden="true">
                <path d="M14 36 L26 46 L50 18" fill="none" stroke="#2DD4BF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 20 L26 30" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
              </svg>
            </div>
            <span className="font-semibold text-navy text-sm">Settlr</span>
          </div>
          <p className="mt-3 text-xs text-ink-muted leading-relaxed">
            Marketplace settlement reconciliation for Indian e-commerce sellers.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { label: 'Pricing', href: '/pricing' },
            { label: 'How it works', href: '/#how-it-works' },
            { label: 'Blog', href: '/blog' },
            { label: 'Support', href: '/support' },
          ]}
        />
        {isLoggedIn ? null : (
          <FooterColumn
            title="Account"
            links={[
              { label: 'Log in', href: '/login' },
              { label: 'Sign up', href: '/signup' },
            ]}
          />
        )}
        <FooterColumn
          title="Legal"
          links={[
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms & Conditions', href: '/terms' },
            { label: 'Refund & Cancellation Policy', href: '/refund-policy' },
          ]}
        />
        <div>
          <p className="text-xs font-semibold text-navy uppercase tracking-wide">Contact</p>
          <a href="mailto:admin@settlr.app" className="mt-3 block text-sm text-ink-muted hover:text-ink">
            admin@settlr.app
          </a>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between text-xs text-ink-muted flex-wrap gap-2">
          <span>© {new Date().getFullYear()} Settlr</span>
          <span>Built for Indian e-commerce sellers on Amazon, Flipkart, and Meesho.</span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-navy uppercase tracking-wide">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-ink-muted hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
