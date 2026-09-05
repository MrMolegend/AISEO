/**
 * The network opening: a small constellation of accounts drawing its
 * connections on arrival. Pure decoration — aria-hidden, server-rendered
 * SVG, transform/opacity/stroke animation only. Edges draw once and stay;
 * nodes breathe on the existing pulse utility, which reduced motion
 * removes entirely (a loop has no final state to land in).
 */

const NODES: { x: number; y: number; r: number }[] = [
  { x: 24, y: 58, r: 4 },
  { x: 74, y: 22, r: 3 },
  { x: 128, y: 66, r: 5 },
  { x: 180, y: 30, r: 3 },
  { x: 226, y: 74, r: 4 },
  { x: 262, y: 40, r: 3 },
];

const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [2, 4],
];

export function NetworkMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 288 96" aria-hidden="true" focusable="false" className={className}>
      {EDGES.map(([from, to], index) => {
        const a = NODES[from]!;
        const b = NODES[to]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        return (
          <line
            key={index}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
            className="animate-draw"
            style={{
              strokeDasharray: length,
              strokeDashoffset: length,
              animationDelay: `${index * 140}ms`,
            }}
          />
        );
      })}
      {NODES.map((node, index) => (
        <circle
          key={index}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill="var(--color-signal)"
          className="animate-node"
          style={{ '--node-index': index } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}
