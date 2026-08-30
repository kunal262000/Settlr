import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import { PLANS, formatPlanPrice } from '@/lib/pricing';

export const metadata = {
  title: 'Pricing — Settlr',
  description:
    'Simple, affordable pricing for Settlr — reconcile Amazon, Flipkart, and Meesho settlements without breaking the bank.',
};

export default function PricingPage() {
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
          <Link href="/signup">
            <Button className="!py-2 !px-4 text-sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold text-navy tracking-tight">Simple, affordable pricing</h1>
        <p className="mt-4 text-lg text-ink-muted max-w-xl mx-auto">
          Reconciliation software shouldn&apos;t cost more than the discrepancies it finds. Start
          free, upgrade only when you need to.
        </p>

        <div className="mt-14 grid sm:grid-cols-3 gap-6 text-left">
          {PLANS.map((plan) => (
            <Card key={plan.id} className={`p-8 flex flex-col ${plan.highlight ? 'border-2 border-teal' : ''}`}>
              {plan.highlight && (
                <span className="inline-flex self-start items-center rounded-full bg-teal-soft text-teal px-3 py-1 text-xs font-medium mb-4">
                  Most popular
                </span>
              )}
              <p className="font-medium text-navy">{plan.name}</p>
              <p className="text-3xl font-semibold text-navy mt-2">{formatPlanPrice(plan)}</p>
              <ul className="mt-6 space-y-3 text-sm text-ink-muted flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8">
                <Button variant={plan.highlight ? 'primary' : 'secondary'} className="w-full">
                  {plan.priceINR === 0 ? 'Start free' : `Choose ${plan.name}`}
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        <p className="mt-10 text-sm text-ink-muted">
          All plans include Amazon, Flipkart, and Meesho reconciliation. No setup fees. Cancel anytime.
        </p>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-ink-muted">
          <Link href="/" className="text-teal font-medium">← Back to Settlr</Link>
        </div>
      </footer>
    </div>
  );
}
