import Nav from "@/components/Nav";
import KpiCard from "@/components/KpiCard";
import Sparkline from "@/components/Sparkline";
import CountUp from "@/components/CountUp";
import { getCurrentUser, getMetrics, canSeeSensitive } from "@/lib/data";
import { money, int, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const { rows } = await getMetrics("combined", user.role);
  const sensitive = canSeeSensitive(user.role);

  const latest = rows[rows.length - 1];
  const totalOrders = rows.reduce((s, r) => s + (r.orders ?? 0), 0);
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalDoor = rows.reduce((s, r) => s + (r.door_orders ?? 0), 0);
  const wageTrend = rows
    .map((r) => r.wage_ratio)
    .filter((v): v is number => typeof v === "number");

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <h1 className="page-title">首页仪表盘</h1>
        <p className="page-desc">
          最新月份 {latest?.month}（两店合计）｜数据来源：爱回收驾驶舱 v3.3 汇总（2026-01~09）
          {user.demo ? "｜当前为演示模式" : ""}
        </p>

        <div className="kpi-row">
          <KpiCard label={`当月总单量（${latest?.month ?? "—"}）`} value={int(latest?.orders)} sub="单" />
          <KpiCard label="当月总分润" value={money(latest?.profit)} sub="元" />
          <KpiCard label="当月单均分润" value={money(latest?.avg_profit)} sub="元 / 单" />
          <KpiCard label="当月上门单量（两店合计）" value={int(latest?.door_orders)} sub="单" />
        </div>

        <div className="kpi-row" style={{ marginTop: 16 }}>
          <div className="kpi-card kpi-wide kpi-hero">
            <div className="kpi-label">工资占分润比（{latest?.month ?? "—"}，两店合计）</div>
            {sensitive ? (
              <>
                <div className="kpi-value">
                  <CountUp value={pct(latest?.wage_ratio)} />
                </div>
                <div className="kpi-sub">
                  2026-01 至 2026-09 月度走势：{wageTrend.length ? `${pct(wageTrend[0])} → ${pct(wageTrend[wageTrend.length - 1])}` : "—"}
                </div>
                {wageTrend.length > 1 ? <Sparkline values={wageTrend} /> : null}
              </>
            ) : (
              <>
                <div className="kpi-value locked">无权限</div>
                <div className="kpi-sub">该指标仅老板 / 合伙人可见</div>
              </>
            )}
          </div>
          <KpiCard
            label="净利暂定（当月，两店合计，未扣房租水电）"
            value={sensitive ? money(latest?.net_profit_provisional) : ""}
            sub="元"
            locked={!sensitive}
          />
          <KpiCard
            label="覆盖期累计（2026-01~09）"
            value={int(totalOrders)}
            sub={`单｜分润 ${money(totalProfit)} 元｜上门 ${int(totalDoor)} 单`}
          />
        </div>

        <h2 className="section-title">月度走势（两店合计）</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>月份</th>
                <th>单量</th>
                <th>分润（元）</th>
                <th>上门单量</th>
                <th>单均分润（元）</th>
                {sensitive ? <th>工资占分润比</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>{int(r.orders)}</td>
                  <td>{money(r.profit)}</td>
                  <td>{int(r.door_orders)}</td>
                  <td>{money(r.avg_profit)}</td>
                  {sensitive ? <td>{pct(r.wage_ratio)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="page-desc" style={{ marginTop: 12 }}>
          口径：上门只看两店合计，不算单店业绩；净利暂定 = 到店分润 − 分摊工资 − 已知扣款，房租水电未取得，未计入。
        </p>
      </main>
    </>
  );
}
