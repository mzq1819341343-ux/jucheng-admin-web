import Nav from "@/components/Nav";
import { KpiValue } from "@/components/KpiCard";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts, storeCostsTotalForMonth, describeMonthCosts } from "@/lib/data";
import { money, money2, int, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AihuishouReportPage() {
  const user = await getCurrentUser();
  const sensitive = canSeeSensitive(user.role);
  const combined = await getMetrics("combined", user.role);
  const wanda = await getMetrics("wanda", user.role);
  const friendship = await getMetrics("friendship", user.role);

  const rows = combined.rows;
  const wandaTotal = wanda.rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const friendshipTotal = friendship.rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const wandaSep = wanda.rows.find((r) => r.month === "2026-09");
  const friendshipSep = friendship.rows.find((r) => r.month === "2026-09");
  const tOrders = rows.reduce((s, r) => s + (r.orders ?? 0), 0);
  const tProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const tDoor = rows.reduce((s, r) => s + (r.door_orders ?? 0), 0);
  const tWage = rows.reduce((s, r) => s + (r.wage_cost ?? 0), 0);
  // 指令41/42：门店成本脚注（本表净利为扣除前口径，仪表盘已扣已录入成本）
  const costs = sensitive ? await getStoreCosts(user) : [];
  const sepCostTotal = storeCostsTotalForMonth(costs, "2026-09");
  const sepCostDesc = describeMonthCosts(costs, "2026-09");
  const sepCombined = rows.find((r) => r.month === "2026-09");
  const sepNetBase = sepCombined?.net_profit_provisional ?? null;
  const sepNetAdjusted = sepNetBase === null ? null : sepNetBase - sepCostTotal;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">AIHUISHOU · REPORTS</span>
          <span className="eyebrow-cn">业务板块 · 爱回收</span>
        </div>
        <h1 className="page-title">爱回收报表</h1>
        <p className="page-desc">
          数据来源：爱回收驾驶舱 <span className="en">v3.3</span> 汇总口径（2026-01~09，已锁定台账：3,958 单 / 416,661.32 元）。
          {!sensitive ? " 当前角色为店员：工资成本、工资占分润比、人均分润、净利暂定等敏感列已按权限隐藏。" : ""}
        </p>

        <h2 className="section-title">按月汇总（两店合计）</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>月份</th>
                <th>单量</th>
                <th>分润（元）</th>
                <th>上门单量</th>
                {sensitive ? (
                  <>
                    <th>工资成本（元）</th>
                    <th>工资占分润比</th>
                    <th>人均分润（元）</th>
                    <th>净利暂定（元）</th>
                  </>
                ) : (
                  <th>敏感列</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>{int(r.orders)}</td>
                  <td>{money2(r.profit)}</td>
                  <td>{int(r.door_orders)}</td>
                  {sensitive ? (
                    <>
                      <td>{money2(r.wage_cost)}</td>
                      <td>{pct(r.wage_ratio)}</td>
                      <td>{money2(r.per_capita_profit)}</td>
                      <td>{money2(r.net_profit_provisional)}</td>
                    </>
                  ) : (
                    <td className="locked-cell">无权限</td>
                  )}
                </tr>
              ))}
              <tr className="total">
                <td>合计</td>
                <td>{int(tOrders)}</td>
                <td>{money2(tProfit)}</td>
                <td>{int(tDoor)}</td>
                {sensitive ? (
                  <>
                    <td>{money2(tWage)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </>
                ) : (
                  <td>—</td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        {sensitive && sepNetAdjusted !== null ? (
          <>
            <h2 className="section-title">最新完整口径汇总（2026-09）</h2>
            <section className="net-summary-card" aria-label="2026-09 扣门店成本后净利汇总">
              <div>
                <div className="net-panel-label">
                  <span className="en">NET AFTER STORE COSTS</span> · 扣门店成本后净利
                </div>
                <KpiValue
                  value={money(sepNetAdjusted)}
                  unit="元"
                  tone={sepNetAdjusted < 0 ? "negative" : "positive"}
                />
                <div className="kpi-sub">两店合计 · 与爱回收仪表盘同一口径</div>
              </div>
              <div className="net-panel-breakdown">
                <div className="net-line">
                  <span>扣成本前净利暂定</span>
                  <strong>{money2(sepNetBase)} 元</strong>
                </div>
                <div className="net-line">
                  <span>工资分摊与已知扣款</span>
                  <strong>已含在扣成本前净利中</strong>
                </div>
                <div className="net-line">
                  <span>门店成本（{sepCostDesc.items}）</span>
                  <strong className="negative-text">−{money2(sepCostTotal)} 元</strong>
                </div>
              </div>
            </section>
          </>
        ) : null}

        <h2 className="section-title">两店汇总（到店口径，2026-01~09）</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>门店</th>
                <th>到店分润合计（元）</th>
                <th>2026-09 到店分润（元）</th>
                {sensitive ? <th>2026-09 净利暂定（元）</th> : null}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>石河子万达店</td>
                <td>{money2(wandaTotal)}</td>
                <td>{money2(wandaSep?.profit)}</td>
                {sensitive ? <td>{money2(wandaSep?.net_profit_provisional)}</td> : null}
              </tr>
              <tr>
                <td>石河子友谊商厦店</td>
                <td>{money2(friendshipTotal)}</td>
                <td>{money2(friendshipSep?.profit)}</td>
                {sensitive ? <td>{money2(friendshipSep?.net_profit_provisional)}</td> : null}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="page-desc" style={{ marginTop: 12 }}>
          口径：上门单的门店标注只是业务员就近寄件点，只看两店合计、不计入单店业绩；净利暂定未扣房租水电等固定成本，仅 2026-09 有现成数，其余月份留空不估算。
          {sepCostTotal > 0
            ? ` 2026-09 已在「门店成本」录入 ${money2(sepCostTotal)} 元（${sepCostDesc.items}），爱回收仪表盘的净利暂定已扣除该金额；本表为扣除前口径。`
            : ""}
        </p>
      </main>
    </>
  );
}
