import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServerComponent } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import SignOutButton from './sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Show the Admin Panel link only when the signed-in email is on the
  // ADMIN_EMAILS allowlist — the exact same shared check the /admin layout
  // enforces, so the button and the route can never disagree.
  const isAdmin = isAdminEmail(user.email ?? '');

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-navy flex items-center justify-center">
              <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true">
                <path d="M14 36 L26 46 L50 18" fill="none" stroke="#2DD4BF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 20 L26 30" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
              </svg>
            </div>
            <span className="font-semibold text-navy">Settlr</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-ink-muted hover:text-ink">Dashboard</Link>
            <Link href="/dashboard/new" className="text-ink-muted hover:text-ink">New Reconciliation</Link>
            <Link href="/dashboard/billing" className="text-ink-muted hover:text-ink">Billing</Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-md bg-navy px-3 py-1.5 font-medium text-white hover:opacity-90"
              >
                Admin Panel
              </Link>
            )}
            <span className="text-ink-muted hidden sm:block">{user.email}</span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
