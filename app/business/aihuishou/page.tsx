import Nav from "@/components/Nav";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import Sparkline from "@/components/Sparkline";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts, getExpenseOperatingInput, storeCostsTotalForMonth, describeMonthCosts } from "@/lib/data";
import { buildOperatingMetrics } from "@/lib/operating";
import { STORE_SHORT_LABEL } from "@/lib/stores";
import { money, money2, int, pct } from "@/lib/format";

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

  // 指令41/42：净利暂定再扣除当月已录入的门店成本（store_costs 两店合计）。
  // 无成本录入时 latestCostTotal = 0，数字与现版完全一致；staff 不查成本（RLS 亦不可见）。
  const costs = sensitive ? await getStoreCosts(user) : [];
  const expenseInput = sensitive ? await getExpenseOperatingInput(user) : [];
  const operating = buildOperatingMetrics({ metrics: rows, storeCosts: costs, expenses: expenseInput });
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;
  const latestOp = latest ? operating.months.find((m) => m.month === latest.month) : undefined;
  const netBase = latestOp?.baseNetProfit ?? null;
  const netAdjusted = latestOp?.storeNetProfit ?? null;

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
            className="net-kpi-card"
            tone={sensitive && netAdjusted !== null && netAdjusted < 0 ? "negative" : "default"}
            label={latestCostTotal > 0 ? "净利暂定（当月，已扣门店成本）" : "净利暂定（当月，未扣房租水电）"}
            value={sensitive ? money(netAdjusted) : ""}
            unit="元"
            sub={
              sensitive ? (
                <>
                  <span className="net-breakdown-line">
                    扣成本前 {money2(netBase)} 元（已扣工资分摊 {money2(latest?.wage_cost)} 元与已知扣款）
                  </span>
                  {latestCostTotal > 0 && latestCostDesc ? (
                    <span className="net-breakdown-line">
                      门店成本 −{money2(latestCostTotal)} 元（{latestCostDesc.items}）
                    </span>
                  ) : (
                    <span className="net-breakdown-line">门店成本未取得，未计入</span>
                  )}
                  {latestOp ? (
                    <>
                      <span className="net-breakdown-line">
                        公司花费（报销）当月 {money2(latestOp.expenseTotal)} 元（未报销 {money2(latestOp.expenseUnreimbursed)} 元）
                      </span>
                      <span className="net-breakdown-line">
                        公司口径净利 {money2(latestOp.companyNetProfit)} 元（门店净利再扣报销花费）
                      </span>
                    </>
                  ) : null}
                </>
              ) : undefined
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

        {sensitive && latestOp ? (
          <>
            <section className="net-panel" aria-label="本月利润率">
              <div>
                <div className="net-panel-label">
                  <span className="en">PROFIT MARGIN</span> · 本月利润率（净利润 ÷ 当月分润）
                </div>
                <KpiValue
                  value={latestOp.profitMargin === null ? "—" : latestOp.profitMargin.toFixed(1)}
                  unit={latestOp.profitMargin === null ? undefined : "%"}
                  tone={latestOp.profitMargin !== null && latestOp.profitMargin < 0 ? "negative" : "default"}
                />
                <div className="kpi-sub">
                  旁注：公司口径净利 {money2(latestOp.companyNetProfit)} 元 · 当月分润 {money2(latestOp.profit)} 元
                </div>
              </div>
              <div className="net-panel-breakdown">
                <div className="net-line">
                  <span>门店净利暂定（完整口径）</span>
                  <strong>{money2(latestOp.storeNetProfit)} 元</strong>
                </div>
                <div className="net-line">
                  <span>公司花费（报销）当月（未报销 {money2(latestOp.expenseUnreimbursed)} 元）</span>
                  <strong className="negative-text">−{money2(latestOp.expenseTotal)} 元</strong>
                </div>
                <div className="net-line">
                  <span>公司口径净利</span>
                  <strong>{money2(latestOp.companyNetProfit)} 元</strong>
                </div>
                <div className="net-line">
                  <span>年回报率（{operating.annual.label}）</span>
                  <strong>{operating.annual.returnRate === null ? "—" : pct(operating.annual.returnRate)}</strong>
                </div>
                <div className="net-line">
                  <span>{operating.rolling12.label}</span>
                  <strong>{operating.rolling12.returnRate === null ? "—" : pct(operating.rolling12.returnRate)}</strong>
                </div>
              </div>
            </section>
            <p className="page-desc" style={{ marginTop: 12 }}>
              净利暂定仅最新月为完整口径（扣工资分摊、已知扣款、门店成本、报销花费），其余月份待补齐后出数。
              年回报率覆盖月份：{operating.annual.coverageMonths.join("、") || "—"}。
            </p>
          </>
        ) : null}

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
          {latestCostTotal > 0 && latestCostDesc
            ? ` − 已录入门店成本 ${money2(latestCostTotal)} 元（${latestCostDesc.items}）${
                latestCostDesc.missingStores.length > 0
                  ? `；${latestCostDesc.missingStores.map((s) => STORE_SHORT_LABEL[s]).join("、")}当月成本未取得，未计入`
                  : ""
              }；未录入的成本类型未取得，未计入。`
            : "，房租水电未取得，未计入。"}
        </p>
      </main>
    </>
  );
}
