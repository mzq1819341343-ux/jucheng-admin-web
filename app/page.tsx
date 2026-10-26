import Link from "next/link";
import Nav from "@/components/Nav";
import KpiCard from "@/components/KpiCard";
import {
  getCurrentUser,
  getMyBusinesses,
  getMetrics,
  canAccessBusiness,
} from "@/lib/data";
import { money, int } from "@/lib/format";

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

  const { rows } = await getMetrics("combined", user.role);
  const latest = rows[rows.length - 1];
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.orders ?? 0), 0);

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

        <h2 className="section-title">经营摘要（爱回收 · 最新月 {latest?.month ?? "—"}）</h2>
        {hasAihuishou ? (
          <div className="kpi-row">
            <KpiCard label="当月总单量（两店合计）" value={int(latest?.orders)} sub="单" />
            <KpiCard label="当月总分润" value={money(latest?.profit)} sub="元" />
            <KpiCard label="当月上门单量（两店合计）" value={int(latest?.door_orders)} sub="单" />
            <KpiCard
              label="覆盖期累计（2026-01~09）"
              value={money(totalProfit)}
              sub={`元分润｜共 ${int(totalOrders)} 单`}
            />
          </div>
        ) : (
          <div className="card">
            <p className="empty">无权限：当前账号未开通任何业务板块，摘要不可见。请联系老板开通。</p>
          </div>
        )}

        <h2 className="section-title">业务板块</h2>
        <div className="biz-grid">
          {businesses.map((b) => {
            if (b.status === "coming_soon") {
              return (
                <div key={b.id} className="biz-card biz-card-off" aria-disabled="true">
                  <div className="biz-en en">{b.en}</div>
                  <div className="biz-name">{b.name}</div>
                  <p className="biz-summary">新业务筹备中，敬请期待。</p>
                  <span className="biz-badge">即将开放</span>
                </div>
              );
            }
            const granted = canAccessBusiness(grantedIds, b.id);
            if (!granted) {
              return (
                <div key={b.id} className="biz-card biz-card-off" aria-disabled="true">
                  <div className="biz-en en">{b.en}</div>
                  <div className="biz-name">{b.name}</div>
                  <p className="biz-summary">当前账号未被授权进入该板块。</p>
                  <span className="biz-badge">未授权 · 请联系老板开通</span>
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
      </main>
    </>
  );
}
