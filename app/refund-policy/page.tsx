import LegalLayout from '@/components/legal-layout';

export const metadata = {
  title: 'Refund & Cancellation Policy — Settlr',
  description: 'How refunds, cancellations, and plan downgrades work on Settlr.',
};

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" updated="August 2026">
      <p>
        Settlr is a digital subscription service, not a physical product, so this policy
        covers refunds and cancellations rather than product returns.
      </p>

      <h2>Free plan</h2>
      <p>
        The Free plan requires no payment, so there&apos;s nothing to refund or cancel — you can
        stop using it at any time.
      </p>

      <h2>Cancelling a paid plan</h2>
      <p>
        You can cancel your Starter or Growth subscription at any time from the Billing page. When
        you cancel, your plan remains active until the end of the period you&apos;ve already paid
        for, and then reverts to the Free plan automatically. You won&apos;t be charged again after
        cancellation, and cancelling does not itself trigger a refund for the current period — see
        the refund rules below.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>
          <strong>Within 3 days of payment:</strong> if you request a refund within 3 days of your
          payment date, we&apos;ll issue a full refund, no questions asked.
        </li>
        <li>
          <strong>After 3 days:</strong> once more than 3 days have passed since payment, all
          charges are final and non-refundable, regardless of how much you&apos;ve used the
          service. This applies even if you choose to stop using Settlr — cancelling stops
          future billing but does not refund the current period past the 3-day window.
        </li>
        <li>
          <strong>Failed or duplicate charges:</strong> this 3-day window doesn&apos;t apply to
          Cashfree processing errors — if you&apos;re charged twice for the same billing period, or
          charged but your plan never activated, we&apos;ll refund the erroneous charge in full at
          any time, once verified.
        </li>
      </ul>

      <h2>How refunds are processed</h2>
      <p>
        Approved refunds are issued back to the original payment method via Cashfree. Depending on
        your bank or payment method, refunds typically reflect within 5–7 business days after being
        initiated.
      </p>

      <h2>Requesting a refund or cancellation</h2>
      <p>
        Cancel anytime from the Billing page in your dashboard. For refund requests, email{' '}
        <a href="mailto:admin@settlr.app">admin@settlr.app</a> within 3 days of payment
        with your account email and the Cashfree order ID from your payment confirmation.
      </p>
    </LegalLayout>
  );
}
