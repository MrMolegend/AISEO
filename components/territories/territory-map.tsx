import type { TerritoryRollup } from '@/lib/insights/compute';

/**
 * The schematic GCC map.
 *
 * Deliberately a diagram, not cartography: hand-laid tiles that echo where
 * the markets sit relative to each other, lit by real account counts. No
 * mapping provider, no geocoding, no client JavaScript — it renders on the
 * server from the same rollup the table below it shows, and the table is
 * the accessible, exact record. Every tile carries a <title> so the shape
 * itself reads aloud.
 */

interface Tile {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the label sits when the tile is too small to hold it. */
  labelOutside?: boolean;
}

const MARKET_TILES: Tile[] = [
  { key: 'SA', x: 20, y: 70, w: 250, h: 240 },
  { key: 'KW', x: 280, y: 40, w: 78, h: 56 },
  { key: 'BH', x: 318, y: 128, w: 40, h: 30, labelOutside: true },
  { key: 'QA', x: 372, y: 112, w: 54, h: 66 },
  { key: 'AE', x: 402, y: 200, w: 160, h: 84 },
  { key: 'OM', x: 500, y: 300, w: 120, h: 70 },
];

const EMIRATE_TILES: Tile[] = [
  { key: 'AE-AZ', x: 20, y: 20, w: 150, h: 72 },
  { key: 'AE-DU', x: 180, y: 20, w: 110, h: 72 },
  { key: 'AE-SH', x: 300, y: 20, w: 84, h: 72 },
  { key: 'AE-AJ', x: 394, y: 20, w: 52, h: 72, labelOutside: true },
  { key: 'AE-UQ', x: 456, y: 20, w: 52, h: 72, labelOutside: true },
  { key: 'AE-RK', x: 518, y: 20, w: 52, h: 72, labelOutside: true },
  { key: 'AE-FU', x: 580, y: 20, w: 40, h: 72, labelOutside: true },
];

function intensity(count: number, max: number): number {
  if (max === 0 || count === 0) return 0;
  return 0.25 + 0.75 * (count / max);
}

function TileShape({
  tile,
  rollup,
  max,
  index,
}: {
  tile: Tile;
  rollup: TerritoryRollup | undefined;
  max: number;
  index: number;
}) {
  const count = rollup?.accounts ?? 0;
  const name = rollup?.name ?? tile.key;
  const label = tile.labelOutside ? tile.key.replace(/^AE-/, '') : name;
  return (
    <g className="animate-fade" style={{ '--fade-index': index } as React.CSSProperties}>
      <rect
        x={tile.x}
        y={tile.y}
        width={tile.w}
        height={tile.h}
        fill="var(--color-signal)"
        fillOpacity={intensity(count, max)}
        stroke="var(--color-rule-strong)"
        strokeWidth={1}
      >
        <title>{`${name}: ${count} account${count === 1 ? '' : 's'}`}</title>
      </rect>
      <text
        x={tile.x + 8}
        y={tile.y + 20}
        fill="var(--color-text)"
        fontSize={12}
        fontWeight={500}
      >
        {label}
      </text>
      {count > 0 && (
        <text x={tile.x + 8} y={tile.y + 38} fill="var(--color-text-muted)" fontSize={11}>
          {count}
        </text>
      )}
    </g>
  );
}

export function TerritoryMap({ rollups }: { rollups: TerritoryRollup[] }) {
  const byKey = new Map(rollups.map((rollup) => [rollup.key, rollup]));
  const marketMax = Math.max(
    0,
    ...MARKET_TILES.map((tile) => byKey.get(tile.key)?.accounts ?? 0),
  );
  const emirateMax = Math.max(
    0,
    ...EMIRATE_TILES.map((tile) => byKey.get(tile.key)?.accounts ?? 0),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
      <figure>
        <svg
          viewBox="0 0 640 400"
          role="img"
          aria-label="Schematic map of GCC markets, shaded by account count"
          className="border-rule bg-ground-sunken w-full max-w-2xl border"
        >
          {MARKET_TILES.map((tile, index) => (
            <TileShape
              key={tile.key}
              tile={tile}
              rollup={byKey.get(tile.key)}
              max={marketMax}
              index={index}
            />
          ))}
          {/* One sweep of light on arrival; a single iteration that ends
              invisible, so reduced motion lands it already gone. */}
          <rect
            aria-hidden="true"
            x={0}
            y={0}
            width={80}
            height={400}
            fill="var(--color-signal)"
            className="animate-scan pointer-events-none"
            opacity={0}
          />
        </svg>
        <figcaption className="text-text-subtle mt-2 text-[12px]">
          Schematic positions, not geography. Darker means more accounts; exact numbers
          are in the table.
        </figcaption>
      </figure>
      <figure>
        <svg
          viewBox="0 0 640 112"
          role="img"
          aria-label="UAE emirates, shaded by account count"
          className="border-rule bg-ground-sunken w-full border lg:w-[420px]"
        >
          {EMIRATE_TILES.map((tile, index) => (
            <TileShape
              key={tile.key}
              tile={tile}
              rollup={byKey.get(tile.key)}
              max={emirateMax}
              index={index}
            />
          ))}
        </svg>
        <figcaption className="text-text-subtle mt-2 text-[12px]">
          The UAE, emirate by emirate.
        </figcaption>
      </figure>
    </div>
  );
}
