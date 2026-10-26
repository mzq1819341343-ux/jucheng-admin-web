import Nav from "@/components/Nav";
import { KpiValue } from "@/components/KpiCard";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts, getExpenseOperatingInput, storeCostsTotalForMonth, describeMonthCosts, getSiteTargets, type SiteTargetMetric } from "@/lib/data";
import { TARGET_METRIC_LABEL, buildTargetReviewRows } from "@/lib/targets";
import TargetReviewExport from "@/components/TargetReviewExport";
import { buildOperatingMetrics, coverageRange, buildStoreComparison } from "@/lib/operating";
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
  // 指令41/42/44：经营指标统一走 lib/operating 单一核算函数。
  const costs = sensitive ? await getStoreCosts(user) : [];
  const expenseInput = sensitive ? await getExpenseOperatingInput(user) : [];
  const operating = buildOperatingMetrics({ metrics: rows, storeCosts: costs, expenses: expenseInput });
  const operatingByMonth = new Map(operating.months.map((m) => [m.month, m]));
  const sepCostTotal = storeCostsTotalForMonth(costs, "2026-09");
  const sepCostDesc = describeMonthCosts(costs, "2026-09");
  const sepOp = operatingByMonth.get("2026-09");
  const sepNetBase = sepOp?.baseNetProfit ?? null;
  const sepNetAdjusted = sepOp?.storeNetProfit ?? null;
  const totalExpense = operating.months.reduce((s, m) => s + m.expenseTotal, 0);
  // 指令46 B1：两店对比（单店口径，报销不摊入单店；营收无源恒「—」）。
  const wandaCmp = new Map(
    buildStoreComparison({ metrics: wanda.rows, storeCosts: costs, scope: "wanda" }).map((m) => [m.month, m])
  );
  const friendshipCmp = new Map(
    buildStoreComparison({ metrics: friendship.rows, storeCosts: costs, scope: "friendship" }).map((m) => [m.month, m])
  );
  const wandaCostTotal = [...wandaCmp.values()].reduce((s, m) => s + m.storeCosts, 0);
  const friendshipCostTotal = [...friendshipCmp.values()].reduce((s, m) => s + m.storeCosts, 0);
  // 指令58 A4：目标达成复盘——目标与总览目标卡同一数据源（site_targets），
  // 实际走经营核算口径：分润/单量取两店合计月度汇总，公司口径净利仅完整
  // 口径月份有值（operating.companyNetProfit），其余月份标「待核算」不冒数；
  // 未设目标的月份标「未设定」。整节仅敏感角色渲染（店员不渲染，见 audit-staff）。
  // 指令58 A4 / 指令59 A5：目标达成复盘——行计算下沉 lib/targets.ts 单一来源，
  // 页面表格与 CSV 导出共用同一份行数据；目标与总览目标卡同源（site_targets），
  // 实际走经营核算口径，公司口径净利仅完整口径月份有值，其余标「待核算」。
  const siteTargets = sensitive ? await getSiteTargets(user) : [];
  const companyNetMap: Record<string, number | null> = {};
  for (const m of operating.months) companyNetMap[m.month] = m.companyNetProfit;
  const reviewRows = buildTargetReviewRows({ months: rows, targets: siteTargets, companyNetProfit: companyNetMap });
  const fmtReview = (metric: SiteTargetMetric, v: number | null) =>
    v === null ? "—" : metric === "orders" ? int(v) : `${money2(v)} 元`;

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
                    <th>当月报销花费（元）</th>
                    <th>公司口径净利（元）</th>
                    <th>利润率（分润）</th>
                    <th>利润率（营收）</th>
                  </>
                ) : null}
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
                      <td>{money2(operatingByMonth.get(r.month)?.expenseTotal)}</td>
                      <td>{operatingByMonth.get(r.month)?.companyNetProfit == null ? "—" : money2(operatingByMonth.get(r.month)?.companyNetProfit)}</td>
                      <td>{operatingByMonth.get(r.month)?.profitMargin == null ? "—" : pct(operatingByMonth.get(r.month)?.profitMargin)}</td>
                      <td>{operatingByMonth.get(r.month)?.revenueMargin == null ? "—" : pct(operatingByMonth.get(r.month)?.revenueMargin)}</td>
                    </>
                  ) : null}
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
                    <td>{money2(totalExpense)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </>
                ) : null}
              </tr>
            </tbody>
          </table>
        </div>
        {sensitive ? (
          <p className="page-desc" style={{ marginTop: 12 }}>
            净利暂定仅最新月为完整口径（扣工资分摊、已知扣款、门店成本、报销花费），其余月份待补齐后出数。
          </p>
        ) : null}

        {sensitive ? (
          <>
            <h2 className="section-title">目标达成复盘</h2>
            <div className="card table-wrap">
              <table className="report">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th style={{ textAlign: "left" }}>口径</th>
                    <th>目标</th>
                    <th>实际</th>
                    <th>达成率</th>
                    <th style={{ textAlign: "left" }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((x) => (
                    <tr key={`${x.month}-${x.metric}`}>
                      <td>{x.month}</td>
                      <td style={{ textAlign: "left" }}>{TARGET_METRIC_LABEL[x.metric]}</td>
                      <td>{x.targetValue === null ? "—" : fmtReview(x.metric, x.targetValue)}</td>
                      <td>{fmtReview(x.metric, x.actual)}</td>
                      <td>{x.rate === null ? "—" : `${x.rate.toFixed(1)}%`}</td>
                      <td style={{ textAlign: "left" }}>{x.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="page-desc" style={{ marginTop: 12 }}>
              目标存 site_targets（与总览目标卡同一数据源，老板在总览设定）；未设目标的月份标「未设定」。
              公司口径净利仅完整口径月份出数，缺完整口径的月份实际与达成率标「待核算」，不估算冒数。
            </p>
            <TargetReviewExport rows={reviewRows} />
          </>
        ) : null}

        <h2 className="section-title">两店对比（按月，到店口径）</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th rowSpan={2}>月份</th>
                <th colSpan={sensitive ? 5 : 2}>石河子万达店</th>
                <th colSpan={sensitive ? 5 : 2}>石河子友谊商厦店</th>
              </tr>
              <tr>
                <th>分润（元）</th>
                <th>营收（元）</th>
                {sensitive ? (
                  <>
                    <th>门店成本（元）</th>
                    <th>净利暂定·扣成本后（元）</th>
                    <th>利润率（分润）</th>
                  </>
                ) : null}
                <th>分润（元）</th>
                <th>营收（元）</th>
                {sensitive ? (
                  <>
                    <th>门店成本（元）</th>
                    <th>净利暂定·扣成本后（元）</th>
                    <th>利润率（分润）</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = wandaCmp.get(r.month);
                const f = friendshipCmp.get(r.month);
                return (
                  <tr key={r.month}>
                    <td>{r.month}</td>
                    <td>{money2(w?.profit)}</td>
                    <td>—</td>
                    {sensitive ? (
                      <>
                        <td>{money2(w?.storeCosts)}</td>
                        <td>{w?.netAfterCosts == null ? "—" : money2(w.netAfterCosts)}</td>
                        <td>{w?.profitMargin == null ? "—" : pct(w.profitMargin)}</td>
                      </>
                    ) : null}
                    <td>{money2(f?.profit)}</td>
                    <td>—</td>
                    {sensitive ? (
                      <>
                        <td>{money2(f?.storeCosts)}</td>
                        <td>{f?.netAfterCosts == null ? "—" : money2(f.netAfterCosts)}</td>
                        <td>{f?.profitMargin == null ? "—" : pct(f.profitMargin)}</td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
              <tr className="total">
                <td>合计</td>
                <td>{money2(wandaTotal)}</td>
                <td>—</td>
                {sensitive ? (
                  <>
                    <td>{money2(wandaCostTotal)}</td>
                    <td>—</td>
                    <td>—</td>
                  </>
                ) : null}
                <td>{money2(friendshipTotal)}</td>
                <td>—</td>
                {sensitive ? (
                  <>
                    <td>{money2(friendshipCostTotal)}</td>
                    <td>—</td>
                    <td>—</td>
                  </>
                ) : null}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="page-desc" style={{ marginTop: 12 }}>
          {/* 指令56-1：净利公式脚注仅敏感角色渲染（与仪表盘 55-2 口径一致），店员只看其可见列的口径说明。 */}
          {sensitive
            ? "单店净利暂定 = 该店净利暂定（到店口径，已扣该店工资分摊与已知扣款）− 该店当月门店成本；仅 2026-09 有完整口径，其余月份显示「—」不估算。"
            : ""}
          报销为公司级花费，不摊入单店对比（公司口径见上方汇总）。营收暂无数据源（订单金额大面积缺失），整列显示「—」，不以分润冒充。
          友谊店 2026-02 开业，2026-01 无经营数据。
        </p>

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
                <div className="net-line">
                  <span>公司花费（报销）当月（未报销 {money2(sepOp?.expenseUnreimbursed)} 元）</span>
                  <strong className="negative-text">−{money2(sepOp?.expenseTotal)} 元</strong>
                </div>
                <div className="net-line">
                  <span>公司口径净利</span>
                  <strong>{money2(sepOp?.companyNetProfit)} 元</strong>
                </div>
                <div className="net-line">
                  <span>利润率（分润）（净利润 ÷ 当月分润）</span>
                  <strong>{sepOp?.profitMargin == null ? "—" : pct(sepOp?.profitMargin)}</strong>
                </div>
                <div className="net-line">
                  <span>利润率（营收）（净利润 ÷ 当月营收）</span>
                  <strong>{sepOp?.revenueMargin == null ? "—（营收口径待接入）" : pct(sepOp?.revenueMargin)}</strong>
                </div>
              </div>
            </section>

            <h2 className="section-title">年回报率结论（{operating.annual.label}）</h2>
            <div className="card">
              <p style={{ marginTop: 0 }}>
                <strong>年回报率：{operating.annual.returnRate === null ? "—" : pct(operating.annual.returnRate)}</strong>
                （净利覆盖月份：{operating.annual.coverageMonths.join("、") || "—"}；年度净利润 {money2(operating.annual.annualNetProfit)} 元；
                年度投入成本 {money2(operating.annual.investedCost)} 元 = 门店成本合计 {money2(operating.annual.storeCostsTotal)} 元
                + 报销花费 {money2(operating.annual.expenseAllTotal)} 元（未报销 + 已报销全计）
                + 工资实发合计 {money2(operating.annual.wageTotal)} 元；投入覆盖月份：{coverageRange(operating.annual.investedCoverageMonths)}。）
              </p>
              <p>
                近12个月：{operating.rolling12.label}，年回报率 {operating.rolling12.returnRate === null ? "—" : pct(operating.rolling12.returnRate)}
                （净利覆盖月份：{operating.rolling12.coverageMonths.join("、") || "—"}；净利润 {money2(operating.rolling12.annualNetProfit)} 元；
                投入成本 {money2(operating.rolling12.investedCost)} 元；投入覆盖月份：{coverageRange(operating.rolling12.investedCoverageMonths)}）。
              </p>
              <p className="page-desc" style={{ marginBottom: 0 }}>
                年回报率 = 年度净利润 ÷ 年度投入（指令45 口径）；年度投入 = 门店成本合计（store_costs）+ 报销花费（expense_claims，未报销与已报销均计入已发生）+ 工资实发合计（monthly_metrics 工资汇总）。
                年度净利润 = 已核算月份公司口径净利合计；分母为 0 或无已核算月份时显示「—」。
              </p>
            </div>
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
          口径：上门单的门店标注只是业务员就近寄件点，只看两店合计、不计入单店业绩
          {sensitive ? "；净利暂定未扣房租水电等固定成本，仅 2026-09 有现成数，其余月份留空不估算" : ""}
          。
          {sepCostTotal > 0
            ? ` 2026-09 已在「门店成本」录入 ${money2(sepCostTotal)} 元（${sepCostDesc.items}），爱回收仪表盘的净利暂定已扣除该金额；本表为扣除前口径。`
            : ""}
        </p>
      </main>
    </>
  );
}
