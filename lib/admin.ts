/**
 * Single source of truth for admin access. Both the dashboard header button
 * and the /admin route gate read this — they can never drift apart.
 *
 * This is intentionally strict: if the allowlist is misconfigured in prod,
 * the app should refuse to grant admin access rather than silently open the
 * dashboard to anyone with a matching email pattern.
 */
export function isAdminEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) return false;
  return allowlist.includes(normalizedEmail);
}
