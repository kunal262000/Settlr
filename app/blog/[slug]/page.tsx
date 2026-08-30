import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BLOG_POSTS, getBlogPost } from '@/lib/blog-data';
import { Button } from '@/components/ui';

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  return {
    title: `${post.title} — Settlr Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default function BlogArticlePage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const related = BLOG_POSTS.filter((p) => p.category === post.category && p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Settlr' },
    publisher: { '@type': 'Organization', name: 'Settlr' },
    articleSection: post.category,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://settlr.app/blog/${post.slug}` },
  };

  return (
    <div className="min-h-screen">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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

      <article className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/blog" className="text-sm text-ink-muted hover:text-ink">← All articles</Link>

        <div className="mt-6 flex items-center gap-3 text-xs text-ink-muted">
          <span className="rounded-full bg-teal-soft text-teal px-2.5 py-0.5 font-medium">{post.category}</span>
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <span>{post.readTimeMinutes} min read</span>
        </div>

        <h1 className="mt-4 text-3xl font-semibold text-navy leading-tight">{post.title}</h1>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink">
          {post.content.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {related.length > 0 && (
          <div className="mt-16 border-t border-border pt-8">
            <h2 className="text-sm font-medium text-navy uppercase tracking-wide">More on {post.category}</h2>
            <div className="mt-4 space-y-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="block text-sm text-teal font-medium hover:underline">
                  {r.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

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
