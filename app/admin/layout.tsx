import { redirect } from 'next/navigation';
import { supabaseServerComponent } from '@/lib/supabase-server';

/**
 * Admin gate. Any signed-in user whose email is not on the ADMIN_EMAILS
 * allowlist gets bounced to the homepage — /admin effectively does not
 * exist for them. There is no link to it anywhere in the public UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServerComponent();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.includes((user.email ?? '').toLowerCase())) redirect('/');

  return <>{children}</>;
}
