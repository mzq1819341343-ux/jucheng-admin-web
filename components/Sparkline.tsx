/** 迷你趋势折线（纯 SVG，无第三方库）：values 为百分比数值序列 */
export default function Sparkline({
  values,
  width = 300,
  height = 64,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 8;
  const stepX = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-label="月度趋势"
    >
      <polyline points={line} fill="none" stroke="#C9A227" strokeWidth="2" />
      {pts.map(([x, y], i) => {
        const last = i === pts.length - 1;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={last ? 3.5 : 2.2}
            fill={last ? "#C9A227" : "#5B6B8C"}
          />
        );
      })}
    </svg>
  );
}
