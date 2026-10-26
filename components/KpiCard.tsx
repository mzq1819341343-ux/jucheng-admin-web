export default function KpiCard({
  label,
  value,
  sub,
  locked,
}: {
  label: string;
  value: string;
  sub?: string;
  locked?: boolean;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      {locked ? (
        <>
          <div className="kpi-value locked">无权限</div>
          <div className="kpi-sub">该指标仅老板 / 合伙人可见</div>
        </>
      ) : (
        <>
          <div className="kpi-value">{value}</div>
          {sub ? <div className="kpi-sub">{sub}</div> : null}
        </>
      )}
    </div>
  );
}
