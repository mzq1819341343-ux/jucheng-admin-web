import { trendGeometry, type TrendPoint } from "@/lib/daily-person-store-sales";

/**
 * 按日曲线。points 里的 null 是没有记录的日期，不画点、不连线、不当作 0。
 * 整段没有真数时不渲染。
 */
export default function DailySalesChart({
  points,
  tone,
  label,
  note,
}: {
  points: TrendPoint[];
  tone: "recycle" | "parts";
  label: string;
  note: string;
}) {
  const real = points.some((point) => point.amount != null);
  if (!real) return null;
  const geo = trendGeometry(points);
  const stroke = tone === "recycle" ? "var(--ov-c-recycle)" : "var(--ov-c-parts)";
  const first = points[0]?.day.slice(8) ?? "";
  const middle = points[Math.floor((points.length - 1) / 2)]?.day.slice(8) ?? "";
  const last = points[points.length - 1]?.day.slice(8) ?? "";
  return (
    <div className="ov-plot ov-plot-live">
      <svg
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        width="100%"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        {geo.segments.map((segment, index) => (
          <polyline key={index} points={segment} fill="none" stroke={stroke} strokeWidth="2" />
        ))}
        {geo.dots.map((dot, index) => (
          <circle
            key={dot.day}
            cx={dot.x.toFixed(1)}
            cy={dot.y.toFixed(1)}
            r={index === geo.dots.length - 1 ? 3.2 : 2.4}
            fill={stroke}
          >
            <title>{`${dot.day} 有记录`}</title>
          </circle>
        ))}
      </svg>
      <div className="ov-chart-axis" aria-hidden="true">
        <span>{first}</span>
        {points.length > 2 ? <span>{middle}</span> : <span />}
        {points.length > 1 ? <span>{last}</span> : null}
      </div>
      <span className="ov-plot-note">{note}</span>
    </div>
  );
}
