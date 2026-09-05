'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, StatusBadge, formatINR, Button } from '@/components/ui';

const STEP_MS = 3000;
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Point = 'up' | 'down';

interface SpotBox {
  left: number;
  top: number;
  width: number;
  height: number;
  note?: string;
  point: Point;
}

const STEPS = [
  {
    label: 'Upload',
    url: 'app.settlr.cyou/dashboard/new',
    eyebrow: 'Step 1 of 5',
    title: 'Upload what you already have',
    body: 'Drop in the marketplace settlement export and your own sales register, exactly as they came off Meesho or your books — no reformatting, no template to fill in first.',
  },
  {
    label: 'Map columns',
    url: 'app.settlr.cyou/dashboard/new#mapping',
    eyebrow: 'Step 2 of 5',
    title: 'Confirm the columns, don’t retype them',
    body: 'Settlr detects Order ID, commission, TCS, shipping and the rest by matching real header text from Meesho, Amazon and Flipkart exports — you just glance and confirm before anything is compared.',
  },
  {
    label: 'Reconcile',
    url: 'app.settlr.cyou/dashboard/jobs/8841',
    eyebrow: 'Step 3 of 5',
    title: 'Every order, classified in seconds',
    body: 'Matched, missing, short-paid, or flagged for a return — all 812 orders sorted the moment the file lands, with the ones needing attention surfaced first.',
  },
  {
    label: 'Inspect',
    url: 'app.settlr.cyou/dashboard/jobs/8841/records/19902',
    eyebrow: 'Step 4 of 5',
    title: 'A reason, not just a red flag',
    body: 'Click into any flagged order and see both sides side by side, plus a plain-language explanation of what’s different — so you know whether to chase the marketplace or fix your own book.',
  },
  {
    label: 'Export',
    url: 'app.settlr.cyou/api/export/8841',
    eyebrow: 'Step 5 of 5',
    title: 'Hand it off in one click',
    body: 'The Excel file matches exactly what was on screen — a summary tab, every record, and the mismatches split out — ready for your accountant or your own GST filing.',
  },
];

function MockTopbar({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <span className="font-extrabold text-sm text-navy tracking-tight">Settlr</span>
      <div className="flex gap-4">
        {items.map((item) => (
          <span
            key={item}
            className={item === active ? 'text-[11.5px] font-semibold text-navy' : 'text-[11.5px] text-ink-muted'}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function useCountUp(target: number, active: boolean, currency: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return currency ? formatINR(value) : String(value);
}

function Step1Upload() {
  return (
    <>
      <MockTopbar items={['New reconciliation', 'Dashboard', 'Billing']} active="New reconciliation" />
      <div className="grid grid-cols-2 gap-3">
        <div
          data-spot="true"
          data-note=".xlsx, .xls or .csv — any of the three"
          data-point="down"
          className="rounded-xl border-[1.5px] border-dashed border-border bg-bg text-center p-5"
        >
          <div className="text-xl">📄</div>
          <div className="mt-1.5 text-[11px] text-ink-muted">Marketplace settlement</div>
          <div className="mt-2 inline-block rounded-md bg-teal-soft px-2 py-0.5 font-mono text-[11px] text-navy">
            meesho_settlement_aug2026.xlsx
          </div>
        </div>
        <div className="rounded-xl border-[1.5px] border-dashed border-border bg-bg text-center p-5">
          <div className="text-xl">📄</div>
          <div className="mt-1.5 text-[11px] text-ink-muted">Your sales report</div>
          <div className="mt-2 inline-block rounded-md bg-teal-soft px-2 py-0.5 font-mono text-[11px] text-navy">
            sales_register_aug2026.csv
          </div>
        </div>
      </div>
    </>
  );
}

function Step2Mapping() {
  const rows: { field: string; required?: boolean; column: string; confidence: 'high' | 'medium' }[] = [
    { field: 'Order ID', required: true, column: 'Sub Order No', confidence: 'high' },
    { field: 'Net Settlement', column: 'Final Settlement Amount', confidence: 'high' },
    { field: 'Commission', column: 'Commission (Incl. GST)', confidence: 'high' },
    { field: 'TCS Amount', column: 'TCS Amount', confidence: 'medium' },
  ];
  return (
    <>
      <MockTopbar items={['Column mapping', 'Dashboard']} active="Column mapping" />
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted border-b border-border">
            <th className="py-2 font-semibold">Internal field</th>
            <th className="py-2 font-semibold">Detected column</th>
            <th className="py-2 font-semibold">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.field}
              className="border-b border-border last:border-0"
              data-spot={i === 0 ? 'true' : undefined}
              data-note={i === 0 ? 'Required — reconciliation can’t start without it' : undefined}
              data-point={i === 0 ? 'up' : undefined}
            >
              <td className="py-2.5">
                {row.field} {row.required && <span className="text-error">*</span>}
              </td>
              <td className="py-2.5 font-mono text-[11px] text-ink-muted">{row.column}</td>
              <td className="py-2.5">
                <span
                  className={
                    row.confidence === 'high'
                      ? 'rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success'
                      : 'rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-bold text-warning'
                  }
                >
                  {row.confidence === 'high' ? 'High' : 'Medium'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Step3Reconcile({ active }: { active: boolean }) {
  const totalRecords = useCountUp(812, active, false);
  const matched = useCountUp(734, active, false);
  const needsAttention = useCountUp(78, active, false);
  const amountToReview = useCountUp(184320, active, true);

  return (
    <>
      <MockTopbar items={['Results', 'Export']} active="Results" />
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <Card className="p-3">
          <p className="text-[10.5px] text-ink-muted">Total records</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{totalRecords}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10.5px] text-ink-muted">Matched</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-navy">{matched}</p>
        </Card>
        <Card className="p-3" data-spot="true" data-note="These need a closer look" data-point="down">
          <p className="text-[10.5px] text-ink-muted">Needs attention</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-warning">{needsAttention}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10.5px] text-ink-muted">Amount to review</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{amountToReview}</p>
        </Card>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted border-b border-border">
            <th className="py-2 font-semibold">Order ID</th>
            <th className="py-2 font-semibold text-right">Expected</th>
            <th className="py-2 font-semibold text-right">Marketplace</th>
            <th className="py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="py-2.5 font-mono text-[11px] text-ink-muted">228491017234</td>
            <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(1249)}</td>
            <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(1249)}</td>
            <td className="py-2.5"><StatusBadge status="MATCHED" /></td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2.5 font-mono text-[11px] text-ink-muted">228491018841</td>
            <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(899)}</td>
            <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(640)}</td>
            <td className="py-2.5"><StatusBadge status="AMOUNT_MISMATCH" /></td>
          </tr>
          <tr>
            <td className="py-2.5 font-mono text-[11px] text-ink-muted">228491019902</td>
            <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(2150)}</td>
            <td className="py-2.5 text-right font-mono tabular-nums">—</td>
            <td className="py-2.5"><StatusBadge status="MISSING_SETTLEMENT" /></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Step4Detail() {
  return (
    <>
      <MockTopbar items={['Order 228491019902']} active="Order 228491019902" />
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <h4 className="mb-2.5 text-xs font-semibold text-navy">Your sales report</h4>
          <div className="flex justify-between text-[11.5px] py-1">
            <span className="text-ink-muted">Gross amount</span>
            <span className="font-mono tabular-nums">{formatINR(2150)}</span>
          </div>
          <div className="flex justify-between text-[11.5px] py-1">
            <span className="text-ink-muted">Order date</span>
            <span className="font-mono tabular-nums">14 Aug</span>
          </div>
        </Card>
        <Card className="p-3.5">
          <h4 className="mb-2.5 text-xs font-semibold text-navy">Marketplace settlement</h4>
          <div className="flex justify-between text-[11.5px] py-1">
            <span className="text-ink-muted">Found</span>
            <span className="font-mono tabular-nums">None</span>
          </div>
        </Card>
        <div
          className="col-span-2 rounded-xl border border-warning/30 bg-warning-bg p-3.5 text-xs leading-relaxed text-warning"
          data-spot="true"
          data-note="Written for a human, not a status code"
          data-point="down"
        >
          This order appears in your sales report but has no corresponding settlement from the marketplace.
        </div>
      </div>
    </>
  );
}

function Step5Export() {
  const tabs = ['Summary', 'All Records', 'Matched', 'Amount Mismatches', 'Missing Settlements'];
  return (
    <>
      <MockTopbar items={['Results']} active="Results" />
      <Card className="flex items-center justify-between p-3.5 mb-2.5">
        <span className="font-mono text-xs text-navy">settlr-aug2026-reconciliation.xlsx</span>
        <button
          type="button"
          data-spot="true"
          data-note="Same data, zero re-entry"
          data-point="down"
          className="rounded-lg bg-navy px-3.5 py-2 text-xs font-semibold text-white"
        >
          Export to Excel
        </button>
      </Card>
      <div className="flex gap-1.5">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={
              i === 0
                ? 'rounded-md bg-navy px-2.5 py-1 text-[10.5px] text-white'
                : 'rounded-md border border-border bg-bg px-2.5 py-1 text-[10.5px] text-ink-muted'
            }
          >
            {tab}
          </span>
        ))}
      </div>
    </>
  );
}

const STEP_COMPONENTS: Array<(props: { active: boolean }) => JSX.Element> = [
  Step1Upload,
  Step2Mapping,
  Step3Reconcile,
  Step4Detail,
  Step5Export,
];

export default function ProductTour() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [spotlights, setSpotlights] = useState<SpotBox[]>([]);

  const sectionRef = useRef<HTMLElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Only autoplay once the tour has actually scrolled into view — it's
  // embedded partway down the landing page, not the whole screen, so
  // starting the count-up/progress the moment the page loads would mean
  // most visitors miss the first steps entirely before they scroll to it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((next: number) => {
    setCurrent(((next % STEPS.length) + STEPS.length) % STEPS.length);
  }, []);

  const measure = useCallback(() => {
    const container = appRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-spot]'));
    const pad = 5;
    setSpotlights(
      targets.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left - containerRect.left - pad,
          top: r.top - containerRect.top - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
          note: el.getAttribute('data-note') ?? undefined,
          point: (el.getAttribute('data-point') as Point) ?? 'down',
        };
      })
    );
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [current, measure]);

  const active = playing && inView;

  // Drives the segmented "story" progress bar. useLayoutEffect (not
  // useEffect) so the reset-then-animate sequence happens before the
  // browser paints — otherwise the bar briefly flashes full before
  // snapping back to empty on every step change.
  useIsomorphicLayoutEffect(() => {
    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = 'none';
      fill.style.transform = 'scaleX(0)';
      fill.getBoundingClientRect();
      if (active) {
        fill.style.transition = `transform ${STEP_MS}ms linear`;
        fill.style.transform = 'scaleX(1)';
      }
    }
    if (!active) return;
    timerRef.current = setTimeout(() => goTo(current + 1), STEP_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, active, goTo]);

  const isLast = current === STEPS.length - 1;
  const step = STEPS[current];
  const StepComponent = STEP_COMPONENTS[current];

  return (
    <section id="how-it-works" ref={sectionRef} className="mx-auto max-w-6xl px-6 py-24">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-teal">Product tour</p>
      <h2 className="mt-2 text-3xl font-semibold text-navy text-center">How a Settlr reconciliation actually runs</h2>
      <p className="mt-3 text-center text-ink-muted max-w-2xl mx-auto">
        Five steps, the same ones every reconciliation goes through — from your two raw files to a report you can
        hand to your accountant.
      </p>

      <div className="mt-10 flex gap-1 border-b border-border">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => goTo(i)}
            className="flex-1 flex flex-col items-start gap-1.5 pb-3.5 text-left"
          >
            <span className={`font-mono text-[11px] font-semibold ${i === current ? 'text-navy' : 'text-ink-muted'}`}>
              0{i + 1}
            </span>
            <span className={`hidden sm:block text-xs font-semibold ${i === current ? 'text-navy' : 'text-ink-muted'}`}>
              {s.label}
            </span>
          </button>
        ))}
      </div>
      <div className="-mt-px flex gap-1">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-border overflow-hidden">
            <div
              ref={i === current ? fillRef : undefined}
              className="h-full bg-teal origin-left"
              style={{ transform: i < current ? 'scaleX(1)' : 'scaleX(0)' }}
            />
          </div>
        ))}
      </div>

      <div
        className="mt-8 grid lg:grid-cols-[1.5fr_1fr] gap-7 items-start"
        onMouseEnter={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
        }}
        onMouseLeave={() => {
          if (active) timerRef.current = setTimeout(() => goTo(current + 1), STEP_MS);
        }}
      >
        <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-[#FBFBFA] px-3.5 py-2.5">
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="ml-2 flex-1 truncate rounded-md border border-border bg-bg px-2.5 py-1 font-mono text-[11px] text-ink-muted">
              {step.url}
            </span>
          </div>
          <div ref={appRef} className="relative p-5" key={current}>
            <StepComponent active={current === 2} />
            {spotlights.map((s, i) => (
              <div key={i}>
                <div
                  className="absolute rounded-xl ring-2 ring-teal animate-ring-pulse animate-fade-in-up pointer-events-none"
                  style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
                />
                {s.note && (
                  <div
                    className="absolute z-10 whitespace-nowrap rounded-lg bg-navy px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg animate-fade-in-up"
                    style={{ left: s.left, top: s.point === 'down' ? s.top - 40 : s.top + s.height + 8 }}
                  >
                    {s.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-teal">{step.eyebrow}</p>
          <h3 className="mt-2 text-xl font-bold text-navy">{step.title}</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-navy hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause autoplay' : 'Resume autoplay'}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-navy hover:bg-bg"
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <span className="font-mono text-xs text-ink-muted">
            Step {current + 1} of {STEPS.length}
          </span>
        </div>

        {isLast ? (
          <Link href="/signup">
            <Button className="!py-2.5 !px-4 text-sm">Try it free →</Button>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-navy hover:bg-bg"
          >
            Next →
          </button>
        )}
      </div>
    </section>
  );
}
