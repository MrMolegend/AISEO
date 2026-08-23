'use client';

import { useEffect, useRef, useState } from 'react';
import { ratingPresentation } from '@/lib/scoring';
import { cn } from '@/lib/utils';

/**
 * The overall score, drawn as an SVG arc.
 *
 * Hand-written rather than pulled from a chart library: the product has exactly
 * two visualisations, and 40kb of charting dependency for a single arc would be
 * a poor trade. The count-up is the one piece of decorative motion in the
 * report, and it is disabled under prefers-reduced-motion.
 */
export function ScoreDial({
  score,
  size = 200,
  animate = true,
  className,
}: {
  score: number;
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  const { label, color } = ratingPresentation(score);
  // Seeded with the final value when not animating, so the server-rendered
  // markup already carries the real number and nothing flashes on hydration.
  const [displayed, setDisplayed] = useState(animate ? 0 : score);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A zero duration collapses the tween to a single frame, which is how both
    // the reduced-motion and animate={false} cases are served. Every setState
    // then happens inside the rAF callback rather than in the effect body.
    const duration = !animate || reduced ? 0 : 600;
    const start = performance.now();

    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      // easeOutCubic — matches --ease-out-soft closely enough for a number.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(score * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [score, animate]);

  // A 270° arc leaves a deliberate gap at the bottom, which reads as a gauge
  // rather than a progress ring.
  const stroke = size * 0.075;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const progress = Math.max(0, Math.min(100, displayed)) / 100;

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // The accessible value lives on the wrapper text below; the arc is decoration.
        aria-hidden="true"
      >
        {/*
          Rotated with an SVG transform rather than a CSS class. A CSS rotation
          leaves the layout box alone but expands the element's *bounding* rect to
          the diagonal (size x sqrt(2)), which pushed the page into horizontal
          overflow at 768px. Transforming inside the viewBox keeps the painted
          box exactly size x size.
        */}
        <g transform={`rotate(-225 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-sunken)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength * progress} ${circumference}`}
            style={{ transition: 'stroke-dasharray 40ms linear' }}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tabular font-semibold"
          style={{ fontSize: size * 0.3, lineHeight: 1, color }}
        >
          {displayed}
        </span>
        <span
          className="text-ink-faint mt-0.5 font-mono"
          style={{ fontSize: Math.max(10, size * 0.062) }}
        >
          / 100
        </span>
        <span
          className="text-ink-muted mt-1.5 font-medium"
          style={{ fontSize: Math.max(11, size * 0.068) }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
