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
  getExpenseClaims,
  getExpenseOperatingInput,
  storeCostsTotalForMonth,
  describeMonthCosts,
  getSalaryDetailImport,
  salaryDetailByMonth,
} from "@/lib/data";
import { buildOperatingMetrics, coverageRange } from "@/lib/operating";
import { isOverdueUnreimbursed } from "@/lib/expenses";
import MonthlyTargetCard from "@/components/MonthlyTargetCard";
import { getSiteTargets } from "@/lib/data";
import { money, money2, int, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 公司总览（指令51 改版 · 留皮换骨）：
 * 眉题一行情境 → 唯一英雄「扣成本后净利」（敏感角色）→ 双利润率次级并排 →
 * 年回报紧凑一行 → 成本拆解默认折叠 → 运营四数紧凑行 → 月度目标 → 业务卡。
 * 数字全部走 lib/operating 核算函数；工资明细校验提示不在首页出现（在工资页/状态页）。
 */
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
  // 指令47：工资实发明细仅老板可读，传入核算函数与月度汇总交叉校验（其余角色不传 = 不校验）。
  const detailRows = user.role === "owner" && hasAihuishou && sensitive ? await getSalaryDetailImport(user) : null;
  const operating = buildOperatingMetrics({
    metrics: rows,
    storeCosts: costs,
    expenses: expenseInput,
    salaryDetailByMonth: detailRows ? salaryDetailByMonth(detailRows) : null,
  });
  const latestOp = latest ? operating.months.find((m) => m.month === latest.month) : undefined;
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;

  // 英雄：公司口径净利（最新完整口径月份；当前即最新月）。
  const heroOp =
    latestOp && latestOp.companyNetProfit !== null ? latestOp : operating.latestComplete;
  const heroNet = heroOp?.companyNetProfit ?? null;
  // 极短环比：与上一个完整口径月份比；无可比月份则不显示（不硬凑）。
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

  // 指令55-3：未报销超期提醒——与报销页顶栏计数、行内徽标同一判定（lib/expenses）。
  // 老板按全部报销单、店员按本人创建范围统计；无超期则整条不渲染。
  // 合伙人只看月度汇总、无逐单数据，不显示逐单提醒（口径见 /help 报销节）。
  const overdueClaims =
    hasAihuishou && user.role !== "partner"
      ? (await getExpenseClaims(user)).filter((c) =>
          isOverdueUnreimbursed(c.claim_date, c.status)
        )
      : [];
  const overdueTotal = overdueClaims.reduce((s, c) => s + Number(c.amount ?? 0), 0);

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
      <main className="container calm">
        <div className="eyebrow">
          <span className="eyebrow-cn">
            {hasAihuishou ? `爱回收 · 最新月 ${latest?.month ?? "—"}` : "公司总览"}
          </span>
        </div>
        <h1 className="page-title">聚成总后台</h1>

        {denied ? (
          <div className="notice">
            无权限：你未被授权进入该业务板块（或该板块尚未开放）。如需开通，请联系老板在「成员与权限」页为你勾选对应业务。
          </div>
        ) : null}

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
                  animate
                />
                {heroMom ? <div className="hero-net-mom">{heroMom}</div> : null}
              </section>
            ) : null}

            {sensitive && latestOp ? (
              <div className="kpi-row" style={{ marginTop: 16 }}>
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
                  sub={latestOp.revenueMargin === null ? "营收待接入" : "净利润 ÷ 当月营收"}
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

            {sensitive && latestOp && latestOp.companyNetProfit !== null ? (
              <details className="cost-details">
                <summary>成本拆解</summary>
                <div className="net-panel-breakdown">
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
              </details>
            ) : null}

            <div className="kpi-row kpi-row-sm" style={{ marginTop: 16 }}>
              <KpiCard size="sm" label="当月总单量" value={int(latest?.orders)} unit="单" hint="两店合计" />
              <KpiCard size="sm" label="当月总分润" value={money(latest?.profit)} unit="元" hint="两店合计" />
              <KpiCard size="sm" label="当月上门单量" value={int(latest?.door_orders)} unit="单" hint="两店合计" />
              <KpiCard
                size="sm"
                label="覆盖期累计分润"
                value={money(totalProfit)}
                unit="元"
                hint={`覆盖期共 ${int(totalOrders)} 单`}
              />
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
            <p className="empty">暂未开通任何业务板块，请联系老板授权。开通后，这里会显示对应业务的经营摘要。</p>
          </div>
        )}

        <h2 className="section-title">业务板块</h2>
        {visibleBusinesses.length === 0 ? (
          <div className="card">
            <p className="empty">暂未开通任何业务板块，请联系老板授权。</p>
          </div>
        ) : (
          <div className="biz-grid">
            {visibleBusinesses.map((b) => {
              if (b.status === "coming_soon") {
                // 占位卡只会渲染给老板（过滤逻辑见上方 visibleBusinesses）；指令51：视觉弱化
                return (
                  <div key={b.id} className="biz-card biz-card-off biz-card-weak" aria-disabled="true">
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
                  <p className="biz-summary">二手数码回收 · 两家门店经营数据。</p>
                  <div className="biz-nums">
                    <div className="biz-num">
                      <b>{money(latest?.profit)} 元</b>
                      <span>最新月分润</span>
                    </div>
                    <div className="biz-num">
                      <b>{int(latest?.orders)} 单</b>
                      <span>最新月单量</span>
                    </div>
                    <div className="biz-num">
                      <b>{int(latest?.door_orders)} 单</b>
                      <span>上门单量</span>
                    </div>
                  </div>
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
