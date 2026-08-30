import LegalLayout from '@/components/legal-layout';

export const metadata = {
  title: 'Terms and Conditions — Settlr',
  description: 'The terms governing your use of Settlr.',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms and Conditions" updated="August 2026">
      <p>
        These terms govern your use of Settlr, a settlement reconciliation tool for e-commerce
        sellers. By creating an account, you agree to these terms.
      </p>

      <h2>The service</h2>
      <p>
        Settlr lets you upload marketplace settlement reports and your own sales records, and
        automatically reconciles them to surface missing settlements, amount mismatches, and other
        discrepancies. Settlr is a reconciliation and analysis tool — it does not file disputes
        with marketplaces on your behalf, and it does not constitute financial, tax, or legal advice.
      </p>

      <h2>Accuracy of results</h2>
      <p>
        Reconciliation results are only as accurate as the files you upload and the column mapping
        you confirm. Settlr flags differences for your review — where a figure is genuinely
        uncertain, we label it &quot;needs review&quot; rather than asserting a conclusion we can&apos;t
        prove from your data. You&apos;re responsible for verifying flagged discrepancies before
        acting on them (for example, before disputing a charge with a marketplace or amending a tax
        filing).
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You&apos;re responsible for keeping your login credentials secure.</li>
        <li>You may only use Settlr for your own business&apos;s reconciliation, or with authorization from the business you&apos;re acting on behalf of.</li>
        <li>You won&apos;t attempt to access another user&apos;s data or circumvent plan usage limits.</li>
      </ul>

      <h2>Plans and billing</h2>
      <p>
        Paid plans are billed monthly in advance via Cashfree. Your plan renews automatically each
        month unless cancelled. See our <a href="/refund-policy">Refund &amp; Cancellation Policy</a>{' '}
        for details on cancelling and refund eligibility.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You won&apos;t use Settlr to upload data you don&apos;t have the right to process, to
        attempt to disrupt or reverse-engineer the service, or to exceed reasonable usage in a way
        that degrades the service for others.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Settlr is provided &quot;as is.&quot; We work to keep the reconciliation engine accurate
        and the service available, but we&apos;re not liable for business decisions made based on
        reconciliation output, or for losses arising from marketplace settlement errors that
        originate with the marketplace itself rather than with Settlr.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Continued use of Settlr after an update
        means you accept the revised terms.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent to <a href="mailto:admin@settlr.app">admin@settlr.app</a>.</p>
    </LegalLayout>
  );
}
