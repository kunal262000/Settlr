// Pricing, researched against the actual Indian marketplace-reconciliation
// category (not generic reconciliation software). Competitor entry-paid
// pricing clusters around ₹2,500–4,000/month:
//   - ReconPe: free tier = 3 reconciliations/month; paid starts ₹3,999/month
//   - eRetail Express: ₹1,250–12,500/month, tiered by order volume
//   - Ecominate: ~₹1,700–8,300/month, tiered by order volume
//   - Manual reconciliation services: ₹2,499–3,499/month
//
// Settlr is priced a step below that band so a small MSME seller can
// justify it immediately rather than needing to prove ROI first.

export type PlanId = 'free' | 'starter' | 'growth';

export interface Plan {
  id: PlanId;
  name: string;
  priceINR: number; // 0 for free
  billingPeriod: 'month';
  reconciliationsPerMonth: number | null; // null = unlimited
  maxOrdersPerFile: number | null; // null = unlimited (subject to the hard 200k row parser cap)
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceINR: 0,
    billingPeriod: 'month',
    reconciliationsPerMonth: 5,
    maxOrdersPerFile: 500,
    features: [
      '5 reconciliations / month',
      'Up to 500 orders per file',
      'All marketplaces — Amazon, Flipkart, Meesho',
      'Excel export',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceINR: 999,
    billingPeriod: 'month',
    reconciliationsPerMonth: null,
    maxOrdersPerFile: 5000,
    features: [
      'Unlimited reconciliations',
      'Up to 5,000 orders per file',
      'All marketplaces — Amazon, Flipkart, Meesho',
      'Excel export',
      'Full reconciliation history',
    ],
    highlight: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    priceINR: 2499,
    billingPeriod: 'month',
    reconciliationsPerMonth: null,
    maxOrdersPerFile: null,
    features: [
      'Unlimited reconciliations',
      'Unlimited orders per file',
      'All marketplaces — Amazon, Flipkart, Meesho',
      'Excel export',
      'Full reconciliation history',
      'Priority support',
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

export function formatPlanPrice(plan: Plan): string {
  if (plan.priceINR === 0) return 'Free';
  return `₹${plan.priceINR.toLocaleString('en-IN')}/mo`;
}
