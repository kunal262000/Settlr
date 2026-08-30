import Link from 'next/link';

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-navy flex items-center justify-center">
              <span className="text-white text-xs font-bold">SM</span>
            </div>
            <span className="font-semibold text-navy">Settlr</span>
          </Link>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">← Back home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-navy">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated: {updated}</p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-teal [&_a]:font-medium">
          {children}
        </div>
      </main>
    </div>
  );
}
