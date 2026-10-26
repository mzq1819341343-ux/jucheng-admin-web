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
  storeCostsTotalForMonth,
  describeMonthCosts,
} from "@/lib/data";
import { money, money2, int } from "@/lib/format";

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
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;
  const netBase = latest?.net_profit_provisional ?? null;
  const netAdjusted = netBase === null ? null : netBase - latestCostTotal;

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
                </div>
              </section>
            ) : null}
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
