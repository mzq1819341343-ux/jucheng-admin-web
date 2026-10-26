import Link from "next/link";
import Nav from "@/components/Nav";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import {
  getCurrentUser,
  getMyBusinesses,
  getMetrics,
  canAccessBusiness,
  canSeeSensitive,
  getStoreCosts,
  getExpenseOperatingInput,
  storeCostsTotalForMonth,
  describeMonthCosts,
} from "@/lib/data";
import { buildOperatingMetrics, coverageRange } from "@/lib/operating";
import MonthlyTargetCard from "@/components/MonthlyTargetCard";
import { getSiteTargets } from "@/lib/data";
import { money, money2, int, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await getCurrentUser();
  const { denied } = await searchParams;
  const { businesses, grantedIds } = await getMyBusinesses(user);
  const hasAihuishou = canAccessBusiness(grantedIds, "aihuishou");

  // 指令37：无权限板块「完全不可见」——未授权板块不渲染（DOM 里不存在），
  // 不是灰显；「更多业务」占位仅老板可见（演示「无授权」组合下连占位也不出现，走空状态）。
  const visibleBusinesses = businesses.filter((b) => {
    if (b.status === "coming_soon") {
      return user.role === "owner" && grantedIds.length > 0;
    }
    return canAccessBusiness(grantedIds, b.id);
  });

  const { rows } = await getMetrics("combined", user.role);
  const latest = rows[rows.length - 1];
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.orders ?? 0), 0);
  const sensitive = canSeeSensitive(user.role);
  const costs = hasAihuishou && sensitive ? await getStoreCosts(user) : [];
  const expenseInput = hasAihuishou && sensitive ? await getExpenseOperatingInput(user) : [];
  const operating = buildOperatingMetrics({ metrics: rows, storeCosts: costs, expenses: expenseInput });
  const latestOp = latest ? operating.months.find((m) => m.month === latest.month) : undefined;
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;
  const netBase = latestOp?.baseNetProfit ?? null;
  const netAdjusted = latestOp?.storeNetProfit ?? null;
  // 指令46 B8：月度目标 vs 实际（目标仅老板可设定；未设定显示「未设定」）。
  const siteTargets = hasAihuishou ? await getSiteTargets(user) : [];
  const targetActuals = rows.map((r) => ({
    month: r.month,
    profit: r.profit ?? null,
    orders: r.orders ?? null,
    net: operating.months.find((m) => m.month === r.month)?.companyNetProfit ?? null,
  }));

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">OVERVIEW</span>
          <span className="eyebrow-cn">公司总览</span>
        </div>
        <h1 className="page-title">聚成总后台</h1>
        <p className="page-desc">
          公司级总览：跨业务摘要与业务板块入口。各业务数据按账号授权开放，未授权的板块不可见、不可直进。
          {user.demo ? " 当前为演示模式，可在顶部组合切换演示角色与业务授权。" : ""}
        </p>

        {denied ? (
          <div className="notice">
            无权限：你未被授权进入该业务板块（或该板块尚未开放）。如需开通，请联系老板在「成员与权限」页为你勾选对应业务。
          </div>
        ) : null}

        <h2 className="section-title">
          {hasAihuishou ? `经营摘要（爱回收 · 最新月 ${latest?.month ?? "—"}）` : "经营摘要"}
        </h2>
        {hasAihuishou ? (
          <>
            <div className="kpi-row">
              <KpiCard label="当月总单量（两店合计）" value={int(latest?.orders)} unit="单" />
              <KpiCard label="当月总分润" value={money(latest?.profit)} unit="元" />
              <KpiCard label="当月上门单量（两店合计）" value={int(latest?.door_orders)} unit="单" />
              <KpiCard
                label="覆盖期累计分润（2026-01~09）"
                value={money(totalProfit)}
                unit="元"
                sub={`共 ${int(totalOrders)} 单`}
              />
            </div>
            {sensitive && netAdjusted !== null ? (
              <section className="net-panel" aria-label="扣门店成本后净利">
                <div>
                  <div className="net-panel-label">
                    <span className="en">NET AFTER STORE COSTS</span> · 扣门店成本后净利（{latest?.month}）
                  </div>
                  <KpiValue
                    value={money(netAdjusted)}
                    unit="元"
                    tone={netAdjusted < 0 ? "negative" : "positive"}
                  />
                  <div className="kpi-sub">两店合计 · 净利暂定口径</div>
                </div>
                <div className="net-panel-breakdown">
                  <div className="net-line">
                    <span>扣成本前净利暂定（已扣工资分摊与已知扣款）</span>
                    <strong>{money2(netBase)} 元</strong>
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
                    <span>公司花费（报销）当月（未报销 {money2(latestOp?.expenseUnreimbursed)} 元）</span>
                    <strong className="negative-text">−{money2(latestOp?.expenseTotal)} 元</strong>
                  </div>
                  <div className="net-line">
                    <span>公司口径净利</span>
                    <strong>{money2(latestOp?.companyNetProfit)} 元</strong>
                  </div>
                  <div className="net-line">
                    <span>利润率（分润）（净利润 ÷ 当月分润）</span>
                    <strong>{latestOp?.profitMargin === null || !latestOp ? "—" : pct(latestOp.profitMargin)}</strong>
                  </div>
                </div>
              </section>
            ) : null}
            {sensitive && latestOp ? (
              <div className="kpi-row" style={{ marginTop: 16 }}>
                <KpiCard
                  label="本月利润率（分润）"
                  value={latestOp.profitMargin === null ? "—" : latestOp.profitMargin.toFixed(1)}
                  unit={latestOp.profitMargin === null ? undefined : "%"}
                  sub={`公司口径净利 ${money2(latestOp.companyNetProfit)} 元 ÷ 当月分润 ${money2(latestOp.profit)} 元`}
                  tone={latestOp.profitMargin !== null && latestOp.profitMargin < 0 ? "negative" : "default"}
                />
                <KpiCard
                  label="本月利润率（营收）"
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
                  sub={`净利覆盖 ${operating.annual.coverageMonths.join("、") || "—"}｜投入覆盖 ${coverageRange(operating.annual.investedCoverageMonths)}（门店成本 ${money2(operating.annual.storeCostsTotal)} + 报销 ${money2(operating.annual.expenseAllTotal)} + 工资实发 ${money2(operating.annual.wageTotal)}）｜近12个月 ${operating.rolling12.returnRate === null ? "—" : pct(operating.rolling12.returnRate)}`}
                  tone={operating.annual.returnRate !== null && operating.annual.returnRate < 0 ? "negative" : "default"}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="card">
            <p className="empty">暂未开通任何业务板块，请联系老板授权。开通后，这里会显示对应业务的经营摘要。</p>
          </div>
        )}

        {hasAihuishou ? (
          <>
            <h2 className="section-title">月度目标</h2>
            <MonthlyTargetCard
              initialTargets={siteTargets}
              actuals={targetActuals}
              role={user.role}
              demo={user.demo}
              userId={user.id}
            />
          </>
        ) : null}

        <h2 className="section-title">业务板块</h2>
        {visibleBusinesses.length === 0 ? (
          <div className="card">
            <p className="empty">暂未开通任何业务板块，请联系老板授权。</p>
          </div>
        ) : (
          <div className="biz-grid">
            {visibleBusinesses.map((b) => {
              if (b.status === "coming_soon") {
                // 占位卡只会渲染给老板（过滤逻辑见上方 visibleBusinesses）
                return (
                  <div key={b.id} className="biz-card biz-card-off" aria-disabled="true">
                    <div className="biz-en en">{b.en}</div>
                    <div className="biz-name">{b.name}</div>
                    <p className="biz-summary">新业务筹备中，敬请期待。</p>
                    <span className="biz-badge">即将开放</span>
                  </div>
                );
              }
              return (
                <Link key={b.id} href={`/business/${b.id}`} className="biz-card">
                  <div className="biz-en en">{b.en}</div>
                  <div className="biz-name">{b.name}</div>
                  <p className="biz-summary">
                    二手数码回收 · 两家门店经营数据。最新月（{latest?.month ?? "—"}）：分润{" "}
                    {money(latest?.profit)} 元 · 单量 {int(latest?.orders)} 单 · 上门 {int(latest?.door_orders)} 单。
                  </p>
                  <div className="biz-cta">进入板块 →</div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
