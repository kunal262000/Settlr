import LegalLayout from '@/components/legal-layout';

export const metadata = {
  title: 'Privacy Policy — Settlr',
  description: 'How Settlr collects, uses, and protects your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 2026">
      <p>
        Settlr (&quot;we&quot;, &quot;us&quot;) provides marketplace settlement reconciliation
        software for e-commerce sellers on Amazon, Flipkart, and Meesho. This policy explains what
        data we collect when you use Settlr, why we collect it, and how it&apos;s protected.
      </p>

      <h2>What we collect</h2>
      <p>When you create an account and use Settlr, we collect:</p>
      <ul>
        <li>Account information: your email address and authentication credentials.</li>
        <li>
          Reconciliation data: when you upload a settlement report and a sales report, we process
          the rows in that file to run reconciliation. We store the normalized, order-level results
          (order ID, amounts, status, and reason) — not the original uploaded file. The raw file you
          upload exists only in memory during processing and is discarded once reconciliation
          completes.
        </li>
        <li>Payment data: if you upgrade to a paid plan, payment is processed by Cashfree. We store the plan you&apos;re on, the payment status, and a Cashfree order reference — we never see or store your card, UPI, or bank details directly.</li>
        <li>Usage data: which plan you&apos;re on and how many reconciliations you&apos;ve run this month, so we can enforce plan limits.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Your data is used solely to provide the reconciliation service: matching your orders,
        showing you results, generating your Excel exports, and enforcing your plan&apos;s usage
        limits. We do not sell your data, and we do not use your financial data to train any
        external model.
      </p>

      <h2>Data isolation</h2>
      <p>
        Every reconciliation job and record is tied to your account and protected by row-level
        security at the database level — no other Settlr user, and no unauthenticated request,
        can read your data. All authorization checks happen server-side; we never trust a user ID
        supplied by the browser alone.
      </p>

      <h2>Third parties</h2>
      <p>
        We use Supabase for authentication and data storage, and Cashfree for payment processing.
        Both process data on our behalf under their own security and privacy commitments. We do not
        share your reconciliation data with any marketplace (Amazon, Flipkart, Meesho) or any other
        third party.
      </p>

      <h2>Data retention</h2>
      <p>
        Reconciliation jobs and records are retained until you delete them or close your account.
        Raw uploaded files are never retained past the processing request itself.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of your data or request account deletion at any time by emailing{' '}
        <a href="mailto:admin@settlr.app">admin@settlr.app</a>. Deleting your account
        removes your reconciliation jobs, records, and subscription data.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy can be sent to <a href="mailto:admin@settlr.app">admin@settlr.app</a>.</p>
    </LegalLayout>
  );
}
