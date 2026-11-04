import { Suspense } from "react";
import Link from "next/link";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import { SectionSkeleton } from "@/components/PageSkeleton";
import Sparkline from "@/components/Sparkline";
import FetchRefreshMarkerLine from "@/components/FetchRefreshMarker";
import {
  getCurrentUser,
  getMyBusinesses,
  getMetrics,
  canAccessBusiness,
  canSeeSensitive,
  getStoreCosts,
  getExpenseClaims,
  getExpenseOperatingInput,
  storeCostsTotalForMonth,
  describeMonthCosts,
  getSalaryDetailImport,
  salaryDetailByMonth,
  getFetchRefreshMarker,
  getSiteTargets,
  type StoreCost,
  type ExpenseClaim,
  type SalaryDetailImportRow,
  type SiteTarget,
  type FetchRefreshMarker,
} from "@/lib/data";
import { buildOperatingMetrics, coverageRange, wageCheckNote } from "@/lib/operating";
import { isOverdueUnreimbursed } from "@/lib/expenses";
import MonthlyTargetCard from "@/components/MonthlyTargetCard";
import { money, money2, int, pct } from "@/lib/format";
import { STORE_SHORT_LABEL, COST_TYPE_LABEL, type CostType, type StoreScope } from "@/lib/stores";

export const dynamic = "force-dynamic";

function DeniedNotice() {
  return (
    <div className="notice">
      你未被授权进入该业务板块（或该板块尚未开放），入口未对你开放。如需开通，请联系老板在「成员与权限」页为你勾选对应业务。
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  return (
    <main className="container calm no-enter overview-page">
      <Suspense fallback={<OverviewFallback denied={denied} />}>
        <OverviewContent denied={denied} />
      </Suspense>
    </main>
  );
}

function OverviewFallback({ denied }: { denied?: string }) {
  return (
    <>
      <div className="skel skel-eyebrow" />
      <h1 className="page-title">聚成总后台</h1>
      {denied ? <DeniedNotice /> : null}
      <SectionSkeleton />
    </>
  );
}

async function OverviewContent({ denied }: { denied?: string }) {
  const user = await getCurrentUser();
  const { businesses, grantedIds } = await getMyBusinesses(user);
  const hasAihuishou = canAccessBusiness(grantedIds, "aihuishou");

  const visibleBusinesses = businesses.filter((b) => {
    if (b.status === "coming_soon") {
      return user.role === "owner" && grantedIds.length > 0;
    }
    return canAccessBusiness(grantedIds, b.id);
  });

  const sensitive = canSeeSensitive(user.role);
  const withData = hasAihuishou && sensitive;
  const [{ rows }, costs, expenseInput, detailRows, allClaims, siteTargets, refreshMarker] =
    await Promise.all([
      getMetrics("combined", user.role),
      withData ? getStoreCosts(user) : Promise.resolve<StoreCost[]>([]),
      withData
        ? getExpenseOperatingInput(user)
        : Promise.resolve<ExpenseClaim[]>([]),
      user.role === "owner" && withData
        ? getSalaryDetailImport(user)
        : Promise.resolve<SalaryDetailImportRow[] | null>(null),
      hasAihuishou && user.role !== "partner"
        ? getExpenseClaims(user)
        : Promise.resolve<ExpenseClaim[]>([]),
      hasAihuishou ? getSiteTargets(user) : Promise.resolve<SiteTarget[]>([]),
      hasAihuishou
        ? getFetchRefreshMarker(user)
        : Promise.resolve<FetchRefreshMarker | null>(null),
    ]);
  const latest = rows[rows.length - 1];
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.orders ?? 0), 0);
  const totalDoor = rows.reduce((s, r) => s + (r.door_orders ?? 0), 0);
  const operating = buildOperatingMetrics({
    metrics: rows,
    storeCosts: costs,
    expenses: expenseInput,
    salaryDetailByMonth: detailRows ? salaryDetailByMonth(detailRows) : null,
  });
  const latestOp = latest ? operating.months.find((m) => m.month === latest.month) : undefined;
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;
  const wageNote = wageCheckNote(operating.annual);
  const wageTrend = rows
    .map((r) => r.wage_ratio)
    .filter((v): v is number => typeof v === "number");
  const netAdjusted = latestOp?.storeNetProfit ?? null;

  const heroOp =
    latestOp && latestOp.companyNetProfit !== null ? latestOp : operating.latestComplete;
  const heroNet = heroOp?.companyNetProfit ?? null;
  let heroMom: string | null = null;
  if (heroOp && heroNet !== null) {
    const idx = operating.months.findIndex((m) => m.month === heroOp.month);
    const prev = operating.months
      .slice(0, Math.max(idx, 0))
      .reverse()
      .find((m) => m.companyNetProfit !== null);
    if (prev && prev.companyNetProfit !== null && prev.companyNetProfit !== 0) {
      const d = ((heroNet - prev.companyNetProfit) / Math.abs(prev.companyNetProfit)) * 100;
      heroMom = `环比 ${d >= 0 ? "+" : ""}${d.toFixed(1)}%（较 ${prev.month}）`;
    }
  }

  const overdueClaims = allClaims.filter((c) =>
    isOverdueUnreimbursed(c.claim_date, c.status)
  );
  const overdueTotal = overdueClaims.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const targetActuals = rows.map((r) => ({
    month: r.month,
    profit: r.profit ?? null,
    orders: r.orders ?? null,
    net: operating.months.find((m) => m.month === r.month)?.companyNetProfit ?? null,
  }));

  const spendTotal = latestOp
    ? latestOp.storeCosts + latestOp.expenseTotal + (latestOp.wageCost ?? 0)
    : 0;
  const shareOf = (v: number) =>
    spendTotal > 0 ? `${((v / spendTotal) * 100).toFixed(1)}%` : "—";
  const scopeDrill = latestOp
    ? (Object.keys(STORE_SHORT_LABEL) as StoreScope[]).map((scope) => {
        const scopeRows = costs.filter((c) => c.month === latestOp.month && c.scope === scope);
        const byType = (Object.keys(COST_TYPE_LABEL) as CostType[])
          .map((t) => ({
            type: t,
            amount: scopeRows
              .filter((c) => c.cost_type === t)
              .reduce((s, c) => s + Number(c.amount ?? 0), 0),
          }))
          .filter((x) => x.amount !== 0);
        return {
          scope,
          total: scopeRows.reduce((s, c) => s + Number(c.amount ?? 0), 0),
          byType,
          recorded: scopeRows.length > 0,
        };
      })
    : [];

  return (
    <>
        <div className="eyebrow">
          <span className="eyebrow-cn">
            {hasAihuishou ? `爱回收 · 最新月 ${latest?.month ?? "—"}` : "公司总览"}
          </span>
        </div>
        <h1 className="page-title">聚成总后台</h1>

        {hasAihuishou ? (
          <p className="page-desc ov-source">
            最新月份 {latest?.month}（两店合计）｜数据来源：爱回收驾驶舱 <span className="en">v3.3</span> 汇总（2026-01~09）
            {user.demo ? "｜当前为演示模式" : ""}
          </p>
        ) : null}
        {refreshMarker ? (
          <div className="ov-marker">
            <FetchRefreshMarkerLine marker={refreshMarker} />
          </div>
        ) : null}

        {denied ? <DeniedNotice /> : null}

        {overdueClaims.length > 0 ? (
          <Link href="/expenses?status=unreimbursed" className="alert-bar" role="alert">
            <span>
              报销超期提醒：<strong>{overdueClaims.length} 笔</strong>报销已超 14 天未报销，合计{" "}
              <strong>{money2(overdueTotal)} 元</strong>
              {user.role === "staff" ? "（仅统计你创建的报销单）" : ""}
            </span>
            <span className="alert-cta">去处理 →</span>
          </Link>
        ) : null}

        {hasAihuishou ? (
          <>
            {sensitive && heroOp && heroNet !== null ? (
              <section className="hero-net" aria-label="扣成本后净利">
                <div className="hero-net-label">扣成本后净利 · {heroOp.month}（两店合计）</div>
                <KpiValue
                  value={money(heroNet)}
                  unit="元"
                  tone={heroNet < 0 ? "negative" : "positive"}
                />
                {heroMom ? <div className="hero-net-mom">{heroMom}</div> : null}
              </section>
            ) : null}

            {sensitive && latestOp ? (
              <div className="kpi-row ov-rates">
                <KpiCard
                  label="利润率（分润）"
                  value={latestOp.profitMargin === null ? "—" : latestOp.profitMargin.toFixed(1)}
                  unit={latestOp.profitMargin === null ? undefined : "%"}
                  sub="净利润 ÷ 当月分润"
                  hint={
                    latestOp.profitMargin === null
                      ? "该月净利口径不完整，暂不出数"
                      : `公司口径净利 ${money2(latestOp.companyNetProfit)} 元 ÷ 当月分润 ${money2(latestOp.profit)} 元`
                  }
                  tone={
                    latestOp.profitMargin !== null && latestOp.profitMargin < 0
                      ? "negative"
                      : "default"
                  }
                />
                <KpiCard
                  label="利润率（营收）"
                  value={latestOp.revenueMargin === null ? "—" : latestOp.revenueMargin.toFixed(1)}
                  unit={latestOp.revenueMargin === null ? undefined : "%"}
                  sub={latestOp.revenueMargin === null ? "营收口径待接入（订单金额数据缺失），接入后自动出数" : "净利润 ÷ 当月营收"}
                  hint={
                    latestOp.revenueMargin === null
                      ? "营收口径待接入（订单金额数据缺失），接入后自动出数"
                      : `公司口径净利 ${money2(latestOp.companyNetProfit)} 元 ÷ 当月营收 ${money2(latestOp.revenue)} 元`
                  }
                  tone={
                    latestOp.revenueMargin !== null && latestOp.revenueMargin < 0
                      ? "negative"
                      : "default"
                  }
                />
              </div>
            ) : null}

            {sensitive ? (
              <div className="annual-strip" aria-label="年回报率">
                <span>
                  年回报率（{operating.annual.label}）{" "}
                  <strong>
                    {operating.annual.returnRate === null
                      ? "—"
                      : `${operating.annual.returnRate.toFixed(1)}%`}
                  </strong>
                </span>
                <span>
                  近12个月{" "}
                  <strong>
                    {operating.rolling12.returnRate === null
                      ? "—"
                      : pct(operating.rolling12.returnRate)}
                  </strong>
                </span>
                <span className="annual-note">
                  净利覆盖 {operating.annual.coverageMonths.join("、") || "—"} · 投入覆盖{" "}
                  {coverageRange(operating.annual.investedCoverageMonths)}（门店成本{" "}
                  {money2(operating.annual.storeCostsTotal)} + 报销{" "}
                  {money2(operating.annual.expenseAllTotal)} + 工资实发{" "}
                  {money2(operating.annual.wageTotal)}）
                </span>
              </div>
            ) : null}

            <div className="kpi-row kpi-row-sm ov-sight">
              <KpiCard size="sm" label="当月总单量" value={int(latest?.orders)} unit="单" hint="两店合计" />
              <KpiCard size="sm" label="当月总分润" value={money(latest?.profit)} unit="元" hint="两店合计" />
              <KpiCard size="sm" label="当月上门单量" value={int(latest?.door_orders)} unit="单" hint="两店合计" />
            </div>

            <div className="ov-folds">
              {sensitive && latestOp ? (
                <details className="cost-details ov-fold">
                  <summary>花费拆分</summary>
                  <section className="net-panel" aria-label="公司花费拆分">
                    <div>
                      <div className="net-panel-label">
                        <span className="en">COST BREAKDOWN</span> · 最新月（{latestOp.month}）
                      </div>
                      <KpiValue
                        value={money(latestOp.storeCosts + latestOp.expenseTotal + (latestOp.wageCost ?? 0))}
                        unit="元"
                      />
                      <div className="kpi-sub">当月三项花费合计：门店成本 + 报销 + 工资（与经营核算同一来源）</div>
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
                        <span>年度拆分 · 门店成本</span>
                        <strong>{money2(operating.annual.storeCostsTotal)} 元</strong>
                      </div>
                      <div className="net-line">
                        <span>年度拆分 · 报销（未报 / 已报）</span>
                        <strong>
                          {money2(operating.annual.expenseAllTotal - operating.annual.expenseReimbursedTotal)} /{" "}
                          {money2(operating.annual.expenseReimbursedTotal)} 元
                        </strong>
                      </div>
                      <div className="net-line">
                        <span>年度拆分 · 工资实发</span>
                        <strong>{money2(operating.annual.wageTotal)} 元</strong>
                      </div>
                    </div>
                  </section>
                </details>
              ) : null}

              <details className="cost-details ov-fold">
                <summary>月度走势</summary>
                <div className="ov-fold-body">
                  <p className="page-desc ov-fold-note">
                    覆盖期累计 {int(totalOrders)} 单｜分润 {money(totalProfit)} 元｜上门 {int(totalDoor)} 单
                    {latest ? `｜当月单均分润 ${money(latest.avg_profit)} 元/单` : ""}
                  </p>
                  {sensitive ? (
                    <div className="ov-wage">
                      <div className="kpi-label">工资占分润比（{latest?.month ?? "—"}，两店合计）</div>
                      <KpiValue
                        value={pct(latest?.wage_ratio).replace(/%$/, "")}
                        unit={pct(latest?.wage_ratio).endsWith("%") ? "%" : undefined}
                      />
                      <div className="kpi-sub">
                        2026-01 至 2026-09 月度走势：{wageTrend.length ? `${pct(wageTrend[0])} → ${pct(wageTrend[wageTrend.length - 1])}` : "—"}
                      </div>
                      {wageTrend.length > 1 ? <Sparkline values={wageTrend} /> : null}
                    </div>
                  ) : null}
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
                  <p className="page-desc ov-fold-note">
                    口径：上门只看两店合计，不算单店业绩。
                    {sensitive
                      ? `净利暂定 = 到店分润 − 分摊工资 − 已知扣款${
                          latestCostTotal > 0 && latestCostDesc
                            ? ` − 已录入门店成本 ${money2(latestCostTotal)} 元（${latestCostDesc.items}）${
                                latestCostDesc.missingStores.length > 0
                                  ? `；${latestCostDesc.missingStores.map((s) => STORE_SHORT_LABEL[s]).join("、")}当月成本未取得，未计入`
                                  : ""
                              }；未录入的成本类型未取得，未计入。`
                            : "，房租水电未取得，未计入。"
                        }`
                      : null}
                  </p>
                </div>
              </details>

              {sensitive && latestOp && latestOp.companyNetProfit !== null ? (
                <details className="cost-details ov-fold">
                  <summary>净利构成</summary>
                  <div className="ov-fold-body">
                    <div className="net-panel-breakdown">
                      <div className="net-line">
                        <span>
                          {latestCostTotal > 0
                            ? "净利暂定（当月，已扣门店成本）"
                            : "净利暂定（当月，未扣房租水电）"}
                        </span>
                        <strong className={netAdjusted !== null && netAdjusted < 0 ? "negative-text" : undefined}>
                          {money2(netAdjusted)} 元
                        </strong>
                      </div>
                      <div className="net-line">
                        <span>扣成本前净利暂定（已扣工资分摊与已知扣款）</span>
                        <strong>{money2(latestOp.baseNetProfit)} 元</strong>
                      </div>
                      <div className="net-line">
                        <span>工资分摊（已含在扣成本前净利中）</span>
                        <strong>{money2(latest?.wage_cost)} 元</strong>
                      </div>
                      <div className="net-line">
                        <span>门店成本{latestCostDesc?.items ? `（${latestCostDesc.items}）` : ""}</span>
                        <strong className="negative-text">−{money2(latestCostTotal)} 元</strong>
                      </div>
                      <div className="net-line">
                        <span>公司花费（报销）当月（未报销 {money2(latestOp.expenseUnreimbursed)} 元）</span>
                        <strong className="negative-text">−{money2(latestOp.expenseTotal)} 元</strong>
                      </div>
                      <div className="net-line">
                        <span>公司口径净利</span>
                        <strong>{money2(latestOp.companyNetProfit)} 元</strong>
                      </div>
                    </div>
                    <p className="page-desc ov-fold-note">
                      净利已扣门店成本与公司花费（报销，未报销亦计入已发生花费）；净利暂定仅最新月为完整口径，其余月份待补齐后出数。
                      年回报率 = 年度净利润 ÷ 年度投入（门店成本合计 + 报销花费（未报销 + 已报销） + 工资实发合计）；
                      净利覆盖月份：{operating.annual.coverageMonths.join("、") || "—"}；投入覆盖月份：{coverageRange(operating.annual.investedCoverageMonths)}。
                      {wageNote ? <span className="negative-text"> {wageNote}。</span> : null}
                    </p>
                  </div>
                </details>
              ) : null}
            </div>

            <h2 className="section-title">月度目标</h2>
            <MonthlyTargetCard
              initialTargets={siteTargets}
              actuals={targetActuals}
              role={user.role}
              demo={user.demo}
              userId={user.id}
            />
          </>
        ) : (
          <div className="card">
            <p className="empty">暂未开通任何业务板块，请联系老板开通授权。</p>
          </div>
        )}

        <h2 className="section-title ov-quiet-title">业务板块</h2>
        {visibleBusinesses.length === 0 ? (
          <div className="card">
            <p className="empty">暂未开通任何业务板块，请联系老板开通授权。</p>
          </div>
        ) : (
          <div className="biz-grid">
            {visibleBusinesses.map((b) => {
              if (b.status === "coming_soon") {
                return (
                  <div key={b.id} className="biz-card biz-card-off biz-card-weak biz-card-quiet" aria-disabled="true">
                    <div className="biz-en en">{b.en}</div>
                    <div className="biz-name">{b.name}</div>
                    <p className="biz-summary">新业务筹备中，敬请期待。</p>
                    <span className="biz-badge">即将开放</span>
                  </div>
                );
              }
              return (
                <div key={b.id} className="biz-card biz-card-quiet">
                  <div className="biz-en en">{b.en}</div>
                  <div className="biz-name">{b.name}</div>
                  <p className="biz-summary">二手数码回收 · 两家门店经营数据。</p>
                </div>
              );
            })}
          </div>
        )}
    </>
  );
}
