import Nav from "@/components/Nav";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import Sparkline from "@/components/Sparkline";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts, getExpenseOperatingInput, storeCostsTotalForMonth, describeMonthCosts, getSalaryDetailImport, salaryDetailByMonth, getFetchRefreshMarker } from "@/lib/data";
import FetchRefreshMarkerLine from "@/components/FetchRefreshMarker";
import { buildOperatingMetrics, coverageRange, wageCheckNote } from "@/lib/operating";
import { STORE_SHORT_LABEL, COST_TYPE_LABEL, type CostType, type StoreScope } from "@/lib/stores";
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
  // 指令47：工资实发明细仅老板可读，传入核算函数与月度汇总交叉校验（其余角色不传 = 不校验）。
  const detailRows = user.role === "owner" && sensitive ? await getSalaryDetailImport(user) : null;
  const operating = buildOperatingMetrics({
    metrics: rows,
    storeCosts: costs,
    expenses: expenseInput,
    salaryDetailByMonth: detailRows ? salaryDetailByMonth(detailRows) : null,
  });
  const wageNote = wageCheckNote(operating.annual);
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;
  const latestOp = latest ? operating.months.find((m) => m.month === latest.month) : undefined;
  const netBase = latestOp?.baseNetProfit ?? null;
  const netAdjusted = latestOp?.storeNetProfit ?? null;
  // 指令53 C2：数据刷新标记（只读 fetch_logs）。
  const refreshMarker = await getFetchRefreshMarker(user);

  // 指令52-2：花费拆解下钻——门店成本按店、按类型（store_costs 原始行）分层，
  // 报销拆已报/未报，工资当月合计；占比统一以当月总花费为分母，与上方合计同源。
  const spendTotal = latestOp
    ? latestOp.storeCosts + latestOp.expenseTotal + (latestOp.wageCost ?? 0)
    : 0;
  const shareOf = (v: number) =>
    spendTotal > 0 ? `${((v / spendTotal) * 100).toFixed(1)}%` : "—";
  const scopeDrill = latestOp
    ? (Object.keys(STORE_SHORT_LABEL) as StoreScope[]).map((scope) => {
        const rows = costs.filter((c) => c.month === latestOp.month && c.scope === scope);
        const byType = (Object.keys(COST_TYPE_LABEL) as CostType[])
          .map((t) => ({
            type: t,
            amount: rows
              .filter((c) => c.cost_type === t)
              .reduce((s, c) => s + Number(c.amount ?? 0), 0),
          }))
          .filter((x) => x.amount !== 0);
        return {
          scope,
          total: rows.reduce((s, c) => s + Number(c.amount ?? 0), 0),
          byType,
          recorded: rows.length > 0,
        };
      })
    : [];

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
        <FetchRefreshMarkerLine marker={refreshMarker} />

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
            <div className="kpi-row" style={{ marginTop: 16 }}>
              <KpiCard
                label={`利润率（分润）（${latestOp.month}）`}
                value={latestOp.profitMargin === null ? "—" : latestOp.profitMargin.toFixed(1)}
                unit={latestOp.profitMargin === null ? undefined : "%"}
                sub={`公司口径净利 ${money2(latestOp.companyNetProfit)} 元 ÷ 当月分润 ${money2(latestOp.profit)} 元`}
                tone={latestOp.profitMargin !== null && latestOp.profitMargin < 0 ? "negative" : "default"}
              />
              <KpiCard
                label={`利润率（营收）（${latestOp.month}）`}
                value={latestOp.revenueMargin === null ? "—" : latestOp.revenueMargin.toFixed(1)}
                unit={latestOp.revenueMargin === null ? undefined : "%"}
                sub={
                  latestOp.revenueMargin === null
                    ? "营收口径待接入（订单金额数据缺失），接入后自动出数"
                    : `公司口径净利 ${money2(latestOp.companyNetProfit)} 元 ÷ 当月营收 ${money2(latestOp.revenue)} 元`
                }
                tone={latestOp.revenueMargin !== null && latestOp.revenueMargin < 0 ? "negative" : "default"}
              />
              <KpiCard
                label={`年回报率（${operating.annual.label}）`}
                value={operating.annual.returnRate === null ? "—" : operating.annual.returnRate.toFixed(1)}
                unit={operating.annual.returnRate === null ? undefined : "%"}
                sub={`净利覆盖 ${operating.annual.coverageMonths.join("、") || "—"}｜投入覆盖 ${coverageRange(operating.annual.investedCoverageMonths)}｜近12个月 ${operating.rolling12.returnRate === null ? "—" : pct(operating.rolling12.returnRate)}`}
                tone={operating.annual.returnRate !== null && operating.annual.returnRate < 0 ? "negative" : "default"}
              />
            </div>
            <p className="page-desc" style={{ marginTop: 12 }}>
              净利已扣门店成本与公司花费（报销，未报销亦计入已发生花费）；净利暂定仅最新月为完整口径，其余月份待补齐后出数。
              年回报率 = 年度净利润 ÷ 年度投入（门店成本合计 + 报销花费（未报销 + 已报销） + 工资实发合计）；
              净利覆盖月份：{operating.annual.coverageMonths.join("、") || "—"}；投入覆盖月份：{coverageRange(operating.annual.investedCoverageMonths)}。
              {wageNote ? <span className="negative-text"> {wageNote}。</span> : null}
            </p>

            <h2 className="section-title">公司花费拆分</h2>
            <section className="net-panel" aria-label="公司花费拆分">
              <div>
                <div className="net-panel-label">
                  <span className="en">COST BREAKDOWN</span> · 最新月（{latestOp.month}）
                </div>
                <KpiValue
                  value={money(latestOp.storeCosts + latestOp.expenseTotal + (latestOp.wageCost ?? 0))}
                  unit="元"
                />
                <div className="kpi-sub">当月四项花费合计（与经营核算同一来源）</div>
              </div>
              <div className="net-panel-breakdown">
                <details className="drill">
                  <summary>
                    <span className="drill-name">门店成本</span>
                    <span>
                      <strong>{money2(latestOp.storeCosts)} 元</strong>
                      <span className="share">占 {shareOf(latestOp.storeCosts)}</span>
                    </span>
                  </summary>
                  <div className="drill-children">
                    {scopeDrill.map((s) =>
                      s.recorded ? (
                        <details key={s.scope} className="drill">
                          <summary>
                            <span className="drill-name">{STORE_SHORT_LABEL[s.scope]}店</span>
                            <span>
                              <strong>{money2(s.total)} 元</strong>
                              <span className="share">占 {shareOf(s.total)}</span>
                            </span>
                          </summary>
                          <div className="drill-children">
                            {s.byType.map((t) => (
                              <div className="net-line" key={t.type}>
                                <span>{COST_TYPE_LABEL[t.type]}</span>
                                <span>
                                  <strong>{money2(t.amount)} 元</strong>
                                  <span className="share">占 {shareOf(t.amount)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div className="net-line" key={s.scope}>
                          <span>{STORE_SHORT_LABEL[s.scope]}店</span>
                          <span>
                            <strong>未录入</strong>
                            <span className="share">占 {shareOf(0)}</span>
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </details>
                <details className="drill">
                  <summary>
                    <span className="drill-name">报销花费</span>
                    <span>
                      <strong>{money2(latestOp.expenseTotal)} 元</strong>
                      <span className="share">占 {shareOf(latestOp.expenseTotal)}</span>
                    </span>
                  </summary>
                  <div className="drill-children">
                    <div className="net-line">
                      <span>已报销</span>
                      <span>
                        <strong>{money2(latestOp.expenseReimbursed)} 元</strong>
                        <span className="share">占 {shareOf(latestOp.expenseReimbursed)}</span>
                      </span>
                    </div>
                    <div className="net-line">
                      <span>未报销（已发生未打款）</span>
                      <span>
                        <strong>{money2(latestOp.expenseUnreimbursed)} 元</strong>
                        <span className="share">占 {shareOf(latestOp.expenseUnreimbursed)}</span>
                      </span>
                    </div>
                  </div>
                </details>
                <div className="net-line">
                  <span>工资实发（当月合计）</span>
                  <span>
                    <strong>{money2(latestOp.wageCost)} 元</strong>
                    <span className="share">占 {shareOf(latestOp.wageCost ?? 0)}</span>
                  </span>
                </div>
                <div className="net-line">
                  <span>年度合计（投入覆盖 {coverageRange(operating.annual.investedCoverageMonths)}）</span>
                  <strong>
                    {money2(
                      operating.annual.storeCostsTotal +
                        operating.annual.expenseAllTotal +
                        operating.annual.wageTotal
                    )}{" "}
                    元
                  </strong>
                </div>
                <div className="net-line">
                  <span>年度拆分</span>
                  <strong>
                    门店 {money2(operating.annual.storeCostsTotal)}｜报销未报{" "}
                    {money2(operating.annual.expenseAllTotal - operating.annual.expenseReimbursedTotal)}｜报销已报{" "}
                    {money2(operating.annual.expenseReimbursedTotal)}｜工资 {money2(operating.annual.wageTotal)}
                  </strong>
                </div>
              </div>
            </section>
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
