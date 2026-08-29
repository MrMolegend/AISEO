import { Meta } from '@/components/ui/panel';

/**
 * The hero's market-entry dossier.
 *
 * Drawn entirely in SVG and CSS. Not a stock photograph, not a rendered globe:
 * both are decoration that says nothing, and a globe in particular says the
 * opposite of what this product does — it implies everywhere, when the whole
 * proposition is one corridor between two specific markets.
 *
 * What it shows is the actual shape of a dossier. Two market markers with their
 * ISO codes, a route drawn between them, evidence nodes gathered along it, and
 * the three counts a reader looks at first. The numbers are the illustrative
 * case's real ones, and the panel says so — a marketing visual quoting figures
 * it invented would undercut the one thing this product sells.
 *
 * Every animation is a transform, an opacity or a stroke-dashoffset, so the
 * whole composition stays on the compositor. The coordinate field drifts by
 * translating a painted gradient; there is no blur layer anywhere, which is
 * both the brief's instruction and the reason this stays smooth on a mid-range
 * phone.
 */
export function DossierVisual() {
  return (
    <figure className="relative isolate" aria-labelledby="dossier-caption">
      {/*
       * The cartographic field lives inside the panel, not beside it.
       *
       * It used to be a sibling clipped to the whole figure — which meant the
       * only place it was ever visible was the strip below the panel, drifting
       * behind the caption. On obsidian that was invisible; on parchment it
       * read as a printing fault. Inside the panel it does the job it was
       * written for: faint moving graticule behind the chart, with the opaque
       * data cells sitting on top of it.
       */}
      <div className="border-rule bg-ground-raised relative isolate overflow-hidden border">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="grid-field animate-drift absolute -inset-x-16 -inset-y-16 opacity-60" />
        </div>

        <div className="relative">
          <div className="border-rule flex items-center justify-between border-b px-4 py-2.5">
            <Meta>Market entry dossier</Meta>
            <Meta className="text-signal">Illustrative</Meta>
          </div>

          <svg
            viewBox="0 0 420 220"
            className="block h-auto w-full"
            role="img"
            aria-label="A route drawn from Ireland to the United Arab Emirates, with twenty evidence sources gathered along it and three regulatory checkpoints marked."
          >
            {/* Latitude rules — cartographic, deliberately faint. */}
            {[44, 88, 132, 176].map((y) => (
              <line
                key={y}
                x1="0"
                x2="420"
                y1={y}
                y2={y}
                stroke="var(--color-rule-faint)"
                strokeWidth="1"
              />
            ))}

            {/* The corridor. Drawn once on load, then held. */}
            <path
              d="M78 150 C 150 40, 270 40, 342 96"
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth="1.5"
              strokeDasharray="420"
              strokeDashoffset="420"
              className="animate-draw"
            />

            {/* Evidence nodes gathered along the route. */}
            {[
              { x: 132, y: 88, i: 0 },
              { x: 178, y: 68, i: 1 },
              { x: 226, y: 62, i: 2 },
              { x: 272, y: 66, i: 3 },
              { x: 312, y: 80, i: 4 },
            ].map((node) => (
              <circle
                key={node.x}
                cx={node.x}
                cy={node.y}
                r="3"
                fill="var(--color-signal)"
                className="animate-node"
                style={{ ['--node-index' as string]: node.i }}
              />
            ))}

            {/* Regulatory checkpoints: square, because they are gates rather than
              findings, and the shape carries that without a legend. */}
            {[
              { x: 200, y: 118 },
              { x: 240, y: 132 },
              { x: 280, y: 118 },
            ].map((gate) => (
              <rect
                key={gate.x}
                x={gate.x - 3}
                y={gate.y - 3}
                width="6"
                height="6"
                fill="none"
                stroke="var(--color-cobalt)"
                strokeWidth="1.5"
              />
            ))}

            {/* Origin */}
            <g>
              <circle cx="78" cy="150" r="5" fill="var(--color-text)" />
              <circle
                cx="78"
                cy="150"
                r="11"
                fill="none"
                stroke="var(--color-rule-strong)"
                strokeWidth="1"
              />
            </g>

            {/* Target */}
            <g>
              <circle cx="342" cy="96" r="5" fill="var(--color-signal)" />
              <circle
                cx="342"
                cy="96"
                r="11"
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth="1"
                opacity="0.5"
              />
            </g>
          </svg>

          {/* Market codes, set in mono against the drawing rather than inside it,
            so they stay legible at any width instead of scaling with the SVG. */}
          {/*
           * Two by two on a phone, four across from `sm`.
           *
           * Four flex cells of unbreakable text — "Promising", "United Arab
           * Emirates" — cannot shrink below their min-content, so at 320px the
           * row pushed the whole page nine pixels wide. Four columns of seventy
           * pixels would have been unreadable even if it had fitted. The hairlines
           * are a `gap-px` grid rather than per-cell borders, which is what makes
           * the internal rules meet correctly in both arrangements.
           */}
          <div className="border-rule grid grid-cols-2 gap-px border-t bg-[var(--color-rule)] sm:grid-cols-4">
            <Field label="Origin" value="IE" note="Ireland" />
            <Field label="Target" value="AE" note="United Arab Emirates" />
            <Field label="Sources" value="20" note="6 read directly" />
            <Field label="Verdict" value="Promising" note="Confidence: high" accent />
          </div>
        </div>
      </div>

      <figcaption id="dossier-caption" className="text-text-faint mt-3 text-[12px]">
        Figures from the worked example. No real business is shown.
      </figcaption>
    </figure>
  );
}

function Field({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-ground-raised min-w-0 px-3 py-3">
      <Meta>{label}</Meta>
      <p
        className={`mt-1 text-[15px] font-medium ${accent ? 'text-signal' : 'text-text'}`}
        data-numeric
      >
        {value}
      </p>
      <p className="text-text-faint mt-0.5 text-[11px] leading-tight">{note}</p>
    </div>
  );
}
