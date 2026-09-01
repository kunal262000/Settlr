import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { AnimatedAmount } from '@/components/animated-amount';
import { supabaseServerComponent } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Marketplace reconciliation for Meesho, Amazon and Flipkart sellers',
  description:
    'Settlr helps sellers reconcile marketplace settlements with sales data, detect mismatches, missing payouts, and returns across Amazon, Flipkart, and Meesho.',
};

export default async function LandingPage() {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <Nav isLoggedIn={!!user} userEmail={user?.email} />
      <Hero isLoggedIn={!!user} />
      <TrustStrip />
      <HowItWorks />
      <WhatItCatches />
      <FinalCTA isLoggedIn={!!user} />
      <Footer isLoggedIn={!!user} />
    </div>
  );
}

function Nav({ isLoggedIn, userEmail }: { isLoggedIn: boolean; userEmail?: string }) {
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
        {isLoggedIn ? (
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-ink-muted hover:text-ink">Home</Link>
            <Link href="/dashboard" className="text-ink-muted hover:text-ink">Dashboard</Link>
            <Link href="/dashboard/new" className="text-ink-muted hover:text-ink">New Reconciliation</Link>
            <Link href="/dashboard/billing" className="text-ink-muted hover:text-ink">Billing</Link>
            <span className="text-ink-muted hidden sm:block">{userEmail}</span>
            <SignOutButton />
          </nav>
        ) : (
          <nav className="hidden sm:flex items-center gap-8 text-sm text-ink-muted">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#what-it-catches" className="hover:text-ink">What it catches</a>
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/blog" className="hover:text-ink">Blog</Link>
          </nav>
        )}
        <div className="flex items-center gap-3">
          {isLoggedIn ? null : (
            <>
              <Link href="/login" className="text-sm text-ink-muted hover:text-ink hidden sm:block">
                Log in
              </Link>
              <Link href="/signup">
                <Button className="!py-2 !px-4 text-sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

import SignOutButton from './dashboard/sign-out-button';

function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
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
          <Link href={isLoggedIn ? '/dashboard/new' : '/signup'}>
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
    { label: 'UPLOAD', detail: 'Settlement + Sales Reports', icon: UploadIcon },
    { label: 'MATCH', detail: 'Orders and Transactions', icon: MatchIcon },
    { label: 'ANALYZE', detail: 'Amounts and Deductions', icon: AnalyzeIcon },
    { label: 'DISCOVER', detail: 'What Needs Attention', icon: DiscoverIcon },
  ];

  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-surface shadow-card p-6 overflow-hidden animate-card-float">
        <div className="flex flex-col">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className="animate-step opacity-0"
                style={{ animationDelay: `${i * 250}ms` }}
              >
                <div className="flex items-center gap-4 py-3">
                  <div className="relative">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-navy to-navy/80 flex items-center justify-center text-white shadow-lg animate-icon-pop" style={{ animationDelay: `${i * 250 + 100}ms` }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="absolute -inset-1 rounded-xl bg-navy/20 animate-ping-slow" style={{ animationDelay: `${i * 250 + 500}ms` }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-navy tracking-widest animate-text-slide">{step.label}</p>
                    <p className="text-sm text-ink-muted animate-text-slide" style={{ animationDelay: `${i * 250 + 150}ms` }}>{step.detail}</p>
                  </div>
                  <div className="h-6 w-6 rounded-full bg-teal/10 flex items-center justify-center animate-check-pop opacity-0" style={{ animationDelay: `${i * 250 + 400}ms` }}>
                    <svg className="h-3 w-3 text-teal" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-check-draw" />
                    </svg>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="ml-[1.25rem] h-6 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-border via-teal/30 to-border animate-line-grow" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-gradient-to-br from-warning-bg to-amber-50/50 border-2 border-warning/30 p-5 relative overflow-hidden animate-box-bounce">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(234,88,12,0.08),transparent_60%)] animate-pulse-glow" />
          <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-warning/10 blur-2xl animate-float-slow" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-xs text-warning font-semibold uppercase tracking-wider animate-badge-pulse">
                <svg className="h-3 w-3 animate-alert-shake" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1.5l6.928 12H1.072L8 1.5zM7.25 6.75v2.5h1.5v-2.5h-1.5zm0 3.25v.5h1.5v-.5h-1.5z"/>
                </svg>
                Product example
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-navy tabular-nums animate-amount-bounce">
                <AnimatedAmount target={34430} />
              </span>
              <span className="text-lg text-navy/60">INR</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-warning/80 animate-fade-in-up" style={{ animationDelay: '1.3s' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                Requires attention
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function MatchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M9 12l2 2 4-4" />
    </svg>
  );
}

function AnalyzeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

function DiscoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
    </svg>
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

function FinalCTA({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h2 className="text-3xl font-semibold text-navy">Reconcile your first settlement in minutes</h2>
      <p className="mt-4 text-ink-muted">Free to try. No card required.</p>
      <div className="mt-8">
        <Link href={isLoggedIn ? '/dashboard/new' : '/signup'}>
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
