import { notFound, redirect } from 'next/navigation';
import { supabaseServerComponent } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

/**
 * Admin gate. Any signed-in user whose email is not on the ADMIN_EMAILS
 * allowlist gets a hard 404 — /admin effectively does not exist for them.
 * There is no link to it anywhere in the UI except the dashboard header
 * button, which is server-rendered only for allowlisted emails.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  if (!isAdminEmail(user.email ?? '')) notFound();

  return <>{children}</>;
}
