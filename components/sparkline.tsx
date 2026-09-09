interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Small decorative trend line for metric cards. Takes fixed data (no
 * randomness) so server and client render identically — this is a visual
 * flourish, not a chart backed by real historical data.
 */
export function Sparkline({ points, color = '#2563eb', width = 64, height = 24 }: SparklineProps) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const path = `M${coords.join(' L')}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      <path d={path} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
