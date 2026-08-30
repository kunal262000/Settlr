import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import { BLOG_POSTS } from '@/lib/blog-data';

export const metadata = {
  title: 'Blog — Settlr',
  description:
    'Guides on Amazon, Flipkart, and Meesho settlement reconciliation, GST and TCS/TDS compliance, and marketplace fee tracking for Indian e-commerce sellers.',
};

export default function BlogIndexPage() {
  const sorted = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

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

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-navy">Settlr Blog</h1>
        <p className="mt-3 text-ink-muted max-w-xl">
          Practical guides on marketplace settlement reconciliation, GST and tax compliance, and
          fee tracking for Amazon, Flipkart, and Meesho sellers in India.
        </p>

        <div className="mt-10 space-y-4">
          {sorted.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <Card className="p-6 hover:border-navy/20 transition-colors">
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span className="rounded-full bg-teal-soft text-teal px-2.5 py-0.5 font-medium">{post.category}</span>
                  <span>{formatDate(post.date)}</span>
                  <span>·</span>
                  <span>{post.readTimeMinutes} min read</span>
                </div>
                <h2 className="mt-3 text-lg font-medium text-navy">{post.title}</h2>
                <p className="mt-2 text-sm text-ink-muted">{post.description}</p>
              </Card>
            </Link>
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
