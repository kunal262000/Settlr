/**
 * Single source of truth for admin access. Both the dashboard header button
 * and the /admin route gate read this — they can never drift apart.
 */
export function isAdminEmail(email: string): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
