'use client';

import { useEffect, useRef } from 'react';

export function AnimatedAmount({ target, prefix = '₹' }: { target: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const duration = 1000;
    const start = performance.now();
    const formatted = new Intl.NumberFormat('en-IN');

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      el.textContent = formatted.format(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timeout = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 800);

    return () => clearTimeout(timeout);
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}0
    </span>
  );
}
