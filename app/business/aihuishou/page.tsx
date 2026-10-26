import Nav from "@/components/Nav";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import Sparkline from "@/components/Sparkline";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts, storeCostsTotalForMonth } from "@/lib/data";
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

  // 指令41：净利暂定再扣除当月已录入的门店成本（store_costs 两店合计）。
  // 无成本录入时 latestCostTotal = 0，数字与现版完全一致；staff 不查成本（RLS 亦不可见）。
  const costs = sensitive ? await getStoreCosts(user) : [];
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const netBase = latest?.net_profit_provisional ?? null;
  const netAdjusted = netBase === null ? null : netBase - latestCostTotal;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">AIHUISHOU</span>
          <span className="eyebrow-cn">业务板块 · 爱回收</span>
        </div>
        <h1 className="page-title">爱回收仪表盘</h1>
        <p className="page-desc">
          最新月份 {latest?.month}（两店合计）｜数据来源：爱回收驾驶舱 <span className="en">v3.3</span> 汇总（2026-01~09）
          {user.demo ? "｜当前为演示模式" : ""}
        </p>

        <div className="kpi-row">
          <KpiCard label={`当月总单量（${latest?.month ?? "—"}）`} value={int(latest?.orders)} unit="单" />
          <KpiCard label="当月总分润" value={money(latest?.profit)} unit="元" />
          <KpiCard label="当月单均分润" value={money(latest?.avg_profit)} unit="元/单" />
          <KpiCard label="当月上门单量（两店合计）" value={int(latest?.door_orders)} unit="单" />
        </div>

        <div className="kpi-row" style={{ marginTop: 16 }}>
          <div className="kpi-card kpi-wide kpi-hero">
            <div className="kpi-label">工资占分润比（{latest?.month ?? "—"}，两店合计）</div>
            {sensitive ? (
              <>
                <KpiValue
                  value={pct(latest?.wage_ratio).replace(/%$/, "")}
                  unit={pct(latest?.wage_ratio).endsWith("%") ? "%" : undefined}
                />
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
            label={latestCostTotal > 0 ? "净利暂定（当月，已扣已录入成本）" : "净利暂定（当月，未扣房租水电）"}
            value={sensitive ? money(netAdjusted) : ""}
            unit="元"
            sub={
              sensitive && latestCostTotal > 0
                ? `已扣门店成本 ${money(latestCostTotal)} 元（房租/水电/其他按已录入项）`
                : undefined
            }
            locked={!sensitive}
          />
          <KpiCard
            label="覆盖期累计（2026-01~09）"
            value={int(totalOrders)}
            unit="单"
            sub={`分润 ${money(totalProfit)} 元｜上门 ${int(totalDoor)} 单`}
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
          口径：上门只看两店合计，不算单店业绩；净利暂定 = 到店分润 − 分摊工资 − 已知扣款
          {latestCostTotal > 0
            ? " − 已录入门店成本；未录入的成本类型未取得，未计入。"
            : "，房租水电未取得，未计入。"}
        </p>
      </main>
    </>
  );
}
