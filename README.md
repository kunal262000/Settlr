# Settlr

Reconcile Meesho settlement reports against your own sales records —
standalone from GSTMatch, own architecture and own Supabase project.

> "Take two messy financial datasets and reliably show the seller what
> matches, what does not match, and exactly why." — this is the whole point
> of the app. The reconciliation engine (`lib/reconciliation.ts`) is the
> most important file in this repo; everything else exists to feed it clean
> data and display its output.

## Stack

- **Frontend + API**: Next.js 14 (App Router, TypeScript, Tailwind) — single
  deployable app, no separate backend, so it ships on Vercel like your other
  projects.
- **Auth & database**: Supabase — **create a new, separate Supabase project**
  for Settlr. Don't reuse the GSTMatch project; the spec calls for a
  fully standalone app with its own data isolation.
- **File parsing**: `xlsx` + `papaparse`, run server-side in API routes.
- **Reconciliation engine**: pure TypeScript, no external services — see
  `lib/reconciliation.ts`.

## 1. Set up Supabase

1. Create a new Supabase project.
2. In the SQL editor, run `supabase/schema.sql` — this creates
   `reconciliation_jobs` and `reconciliation_records` with row-level
   security so each user only ever sees their own data.
3. In Authentication settings, email/password sign-up is enabled by
   default — that's all the MVP needs. Turn off "confirm email" while
   testing locally if you want to skip the inbox step.
4. Copy your Project URL, anon key, and service role key into `.env.local`
   (see `.env.example`).

## 2. Set up Cashfree (billing)

Settlr has three plans — Free, Starter (₹999/mo), Growth (₹2,499/mo) —
defined in `lib/pricing.ts`. Paid plans are billed through Cashfree.

1. Create a Cashfree account and get your API keys from Developers → API
   Keys. Use the Sandbox keys while testing.
2. Add `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` to `.env.local`.
3. Payment activation is verified server-side: after checkout the app calls
   Cashfree's order-status API directly (via `/api/billing/verify`) and
   activates the subscription only on a confirmed PAID response — no webhook
   configuration is needed.
4. Set `CASHFREE_ENV=sandbox` (default) while testing; switch to
   `CASHFREE_ENV=production` and `NEXT_PUBLIC_CASHFREE_ENV=production` to
   go live. The two must match, since one controls which Cashfree API the
   server hits and the other controls which mode the client-side checkout
   SDK opens.

Free-tier usage (5 reconciliations/month) is enforced server-side in
`app/api/reconcile/route.ts` via `lib/billing.ts` — it counts the user's
`reconciliation_jobs` rows created since the start of the current calendar
month, not a separate counter, so it can't drift out of sync with actual
usage.

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase keys
npm run dev
```

Visit `http://localhost:3000`, sign up, and upload a Meesho settlement file
plus your own sales export to try the full flow.

## 4. Deploy

Push to GitHub, import into Vercel, add the same three env vars from
`.env.example` in the Vercel project settings, and deploy — same pattern as
Unfiltered AI and GSTMatch.

## How the reconciliation actually works

1. **Upload** (`app/api/upload/route.ts`) — reads the XLSX/XLS/CSV file
   safely, detects likely columns using alias matching
   (`lib/parsers.ts::detectColumns`), and returns the raw rows plus a
   suggested mapping. Nothing is guessed for financial values — only
   column *names* are matched.
2. **Column mapping review** (`app/dashboard/new/page.tsx`) — the person
   confirms or corrects the detected mapping before anything is
   reconciled. Order ID is required on both files; reconciliation can't
   start without it.
3. **Normalize** (`lib/parsers.ts::normalizeRows`) — converts both files
   into the shared `NormalizedTransaction` shape from `lib/types.ts`.
   Missing optional fields stay `undefined` rather than being invented.
4. **Reconcile** (`lib/reconciliation.ts::reconcile`) — groups both
   datasets by Order ID, aggregates multiple marketplace transactions per
   order (commission, shipping, TCS, adjustments...) into one net figure,
   and classifies each order into one of the eight statuses from the spec
   (`MATCHED`, `AMOUNT_MISMATCH`, `MISSING_SETTLEMENT`, etc.), with a
   plain-language, non-accusatory reason for anything that isn't a clean
   match.
5. **Persist** (`app/api/reconcile/route.ts`) — saves one
   `reconciliation_jobs` row (summary) and one `reconciliation_records` row
   per order. Raw file rows are *not* persisted — only the normalized,
   already-parsed fields — to keep storage lean and avoid keeping more
   sensitive financial data than needed.
6. **Results & export** — the results table, detail view, and the
   `/api/export/[id]` Excel download all read from the same
   `reconciliation_records` rows, so what's on screen is always exactly
   what's in the exported file.

## Marketing pages, legal pages, and the blog

- `/pricing` — public plan comparison, links to signup.
- `/privacy`, `/terms`, `/refund-policy` — genuinely describe how this app
  handles data and billing (not boilerplate copy-paste), linked from the
  landing page footer. Cashfree also typically expects these to exist for
  merchant verification.
- `/blog` and `/blog/[slug]` — 25 statically-generated articles on
  marketplace reconciliation, GST/TCS/TDS compliance, and fee tracking,
  each with per-article metadata and `Article` JSON-LD structured data, so
  they're indexable by both search engines and LLM crawlers. Content lives
  in `lib/blog-data.ts` — add an entry there to publish a new article, no
  routing changes needed.
- `app/sitemap.ts` and `app/robots.ts` — auto-generated sitemap covering
  every static page and blog article, referenced from `robots.txt`.
  **Before deploying**, update `SITE_URL` in `app/sitemap.ts` and the
  `mainEntityOfPage` URL in `app/blog/[slug]/page.tsx` if the production
  domain isn't `settlr.app`.

## What's genuinely built vs. stubbed for MVP

**Built and working:**
- Cashfree billing — Free/Starter/Growth plans, hosted checkout, webhook-verified activation, free-tier usage enforcement, self-serve cancellation
- Rate limiting, security headers, prototype-pollution defense, and an automated test suite (see Security and Testing sections above)
- Meesho settlement parsing + generic seller sales register parsing
- Column detection with manual override
- Full reconciliation engine with 8 statuses, one-to-many order matching,
  return/partial-settlement detection, financial summary rollup
- Auth, per-user data isolation (RLS + server-side checks), dashboard,
  results table with filters, order detail view, Excel export

**Intentionally not built yet** (per spec §25 — don't fake unfinished
functionality):
- Amazon / Flipkart parsers — the marketplace picker only allows Meesho;
  the other two are visibly disabled, not fake-functional
- Multi-platform dashboard, profit-per-SKU, ad-spend analytics, bank
  reconciliation — none of these have UI stubs anywhere in the app

## Marketplace column aliases — now based on real report documentation

The aliases in `lib/parsers.ts` (`MARKETPLACE_ALIASES`) were researched against
each platform's actual settlement export format, not guessed:

- **Amazon** — Seller Central's Flat File V2 settlement report (Payments →
  All Statements → Download Flat File V2) is **long-format**: one row per
  order-id per fee/price line, with columns `order-id`, `transaction-type`,
  `amount-type`, `amount-description`, `amount`, `posted-date`, `sku`. This
  is a good fit for the reconciliation engine as-is — it already sums every
  `net_amount` row sharing an order-id (see `aggregateMarketplaceGroup` in
  `lib/reconciliation.ts`), so mapping `amount` → `net_amount` reproduces
  the real payout correctly. Older V1-style wide exports
  (`item-related-fee-amount`, `shipment-fee-amount`, etc.) are aliased too
  in case you're pulling from a third-party tool instead of Seller Central
  directly.
- **Flipkart** — Seller Hub's settlement report is **wide-format**: one row
  per order/order-item with separate `Commission`, `Fixed Fee`,
  `Collection Fee`, `Shipping Fee`, `TCS`, and a `Final Settlement Amount`
  column.
- **Meesho** — as before, based on the common Meesho settlement export
  structure.

This is a real improvement over guesswork, but marketplace exports do vary
slightly by seller category, account region, and whether you're pulling
from the dashboard vs. a third-party tool. The column mapping screen still
lets you correct anything that doesn't auto-detect — if you find a
consistent miss on a real file, add the header text to `MARKETPLACE_ALIASES`
so future uploads catch it automatically.

## Testing

```bash
npm test
```

Runs 41 automated tests (`vitest run`) covering:

- **Reconciliation engine** (`lib/__tests__/reconciliation.test.ts`) — every
  one of the 8 statuses, multi-transaction aggregation, financial summary
  correctness, and the PARTIAL_SETTLEMENT vs AMOUNT_MISMATCH distinction
  (see below).
- **Parsing & column detection** (`lib/__tests__/parsers.test.ts`) — CSV and
  XLSX parsing, per-marketplace column detection accuracy, currency
  formatting edge cases, and a test that actually proves the
  prototype-pollution defense works rather than just asserting it exists.
- **End-to-end pipeline** (`lib/__tests__/end-to-end.test.ts`) — full
  parse → detect → normalize → reconcile runs against fixtures modeling
  each marketplace's real documented settlement format: Amazon's
  long/multi-row-per-order structure, Flipkart's wide single-row format,
  and Meesho's punctuation-heavy headers. These aren't files pulled from a
  live seller account (none were available to test against) — they're
  built to match the structural quirks documented for each format, and
  they're what caught the bug described next.
- **Excel export** (`lib/__tests__/export.test.ts`) — round-trips the
  generated workbook back through the parser to confirm it's structurally
  valid, not just that the write call didn't throw.

**A real bug the end-to-end tests caught:** the engine originally inferred
"still settling" (`PARTIAL_SETTLEMENT`) from row count — a shortfall with
only one marketplace row per order. That's exactly wrong for Flipkart and
Meesho, whose normal, fully-processed settlement format *is* one row per
order; every ordinary commission deduction was getting mislabeled as
pending. Fixed in `lib/reconciliation.ts` to only classify a shortfall as
partial when the source data itself signals a pending/processing state (a
status or transaction-type field containing "partial", "pending", or
"processing") — otherwise it's `AMOUNT_MISMATCH`, a difference requiring
review like any other, with no unproven claim attached.

## Security

- **SQL injection**: not a realistic attack surface here — every database
  call goes through Supabase's parameterized query builder (`.eq()`,
  `.select()`, etc.); there's no raw SQL string concatenation anywhere in
  the app.
- **Prototype pollution**: `xlsx`'s public npm package has an unpatched CVE
  (CVE-2023-30533) — SheetJS fixed it in 0.19.3 but never republished past
  0.18.5 to the npm registry (see their own advisory at cdn.sheetjs.com).
  This app uses `@e965/xlsx@0.20.3`, a maintained republish of the patched
  version, plus defense-in-depth: every parsed row has
  `__proto__`/`constructor`/`prototype` keys stripped in `lib/parsers.ts`
  regardless of what the library itself does, with a test that verifies
  the global `Object.prototype` is actually untouched.
- **Data isolation**: RLS on every table, plus explicit `user_id` checks in
  route handlers — never trusting a client-supplied user id.
- **Webhook authenticity**: the Cashfree webhook verifies the HMAC-SHA256
  signature (constant-time comparison) before touching any data — an
  unsigned or forged webhook call is rejected outright.
- **Rate limiting**: every meaningful API route (upload, reconcile, export,
  billing create-order/verify/cancel, webhook) is rate-limited via
  `lib/rate-limit.ts`, backed by a Supabase table rather than in-memory —
  in-memory limits don't actually work correctly across serverless
  instances, so this was worth doing properly.
- **Security headers**: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` set in `next.config.js`.
- **Input validation**: the reconcile API validates marketplace enum
  values, array types, and row-count limits server-side rather than
  trusting the request shape, even though the route is already
  authenticated.
- **Dependency audit**: `npm audit` is clean except for Next.js 14.2.35's
  own framework-level advisories. I checked each one individually — nearly
  all require features this app doesn't use (`next/image` with
  `remotePatterns`, `rewrites`, i18n Pages Router, a custom server, actual
  Server Actions, WebSocket upgrades, CSP nonces). Fully clearing them
  means a Next 15/16 upgrade, which involves breaking API changes (async
  `cookies()`, async route params) I did **not** make blind without time to
  regression-test — do that deliberately when you have a testing window,
  not as a drive-by dependency bump.


