import Link from "next/link";
import Nav from "@/components/Nav";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts } from "@/lib/data";
import { buildStoreComparison, type StoreMonthComparison } from "@/lib/operating";
import { STORE_LABEL, type StoreScope } from "@/lib/stores";
import { money, money2, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 两店对比（指令52 · 由指令46 B1 报表内嵌表独立成页）：
 * 友谊 vs 万达同月并排，数字全部走 lib/operating.buildStoreComparison，
 * 与报表页同一来源同值（单店口径：报销为公司级花费，不摊入单店）。
 * 顶部月份切换 + 最新月大字双列卡，下方逐月表。
 * 敏感列（门店成本 / 净利暂定 / 利润率）仅老板 / 合伙人可见，与报表页一致；
 * 营收无数据源，利润率（营收）整列「—」，不以分润冒充。
 */

function StoreCard({
  scope,
  row,
  sensitive,
}: {
  scope: StoreScope;
  row: StoreMonthComparison | undefined;
  sensitive: boolean;
}) {
  const net = row?.netAfterCosts ?? null;
  return (
    <section className="card compare-card" aria-label={`${STORE_LABEL[scope]} ${row?.month ?? ""} 对比`}>
      <div className="compare-store">{STORE_LABEL[scope]}</div>
      <div className="compare-main">
        <span>当月分润</span>
        <strong>
          {money(row?.profit)} <span className="compare-unit">元</span>
        </strong>
      </div>
      {sensitive ? (
        <div className="net-panel-breakdown">
          <div className="net-line">
            <span>门店成本</span>
            <strong>{money2(row?.storeCosts)} 元</strong>
          </div>
          <div className="net-line">
            <span>扣成本后净利暂定</span>
            <strong className={net !== null && net < 0 ? "negative-text" : undefined}>
              {net === null ? "—" : `${money2(net)} 元`}
            </strong>
          </div>
          <div className="net-line">
            <span>利润率（分润）</span>
            <strong>{row?.profitMargin == null ? "—" : pct(row.profitMargin)}</strong>
          </div>
          <div className="net-line">
            <span>利润率（营收）</span>
            <strong>—</strong>
          </div>
        </div>
      ) : (
        <div className="net-panel-breakdown">
          <div className="net-line">
            <span>营收</span>
            <strong>—</strong>
          </div>
        </div>
      )}
    </section>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  const sensitive = canSeeSensitive(user.role);
  const wanda = await getMetrics("wanda", user.role);
  const friendship = await getMetrics("friendship", user.role);
  const costs = sensitive ? await getStoreCosts(user) : [];

  const wandaCmp = new Map(
    buildStoreComparison({ metrics: wanda.rows, storeCosts: costs, scope: "wanda" }).map((m) => [m.month, m])
  );
  const friendshipCmp = new Map(
    buildStoreComparison({ metrics: friendship.rows, storeCosts: costs, scope: "friendship" }).map((m) => [m.month, m])
  );
  const months = wanda.rows.map((r) => r.month);
  const { month: monthParam } = await searchParams;
  const selected =
    monthParam && wandaCmp.has(monthParam) ? monthParam : months[months.length - 1];

  const wandaTotal = wanda.rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const friendshipTotal = friendship.rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const wandaCostTotal = [...wandaCmp.values()].reduce((s, m) => s + m.storeCosts, 0);
  const friendshipCostTotal = [...friendshipCmp.values()].reduce((s, m) => s + m.storeCosts, 0);
  const selW = wandaCmp.get(selected);
  const selF = friendshipCmp.get(selected);
  const colsPerStore = sensitive ? 5 : 2;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">AIHUISHOU · COMPARE</span>
          <span className="eyebrow-cn">业务板块 · 爱回收</span>
        </div>
        <h1 className="page-title">两店对比</h1>
        <p className="page-desc">
          友谊 vs 万达同月并排（到店口径）。数字与报表页同一核算来源；营收暂无数据源，利润率（营收）整列「—」，不以分润冒充。
          {!sensitive ? " 当前角色为店员：门店成本、净利暂定、利润率等敏感列已按权限隐藏。" : ""}
        </p>

        <div className="month-switch" role="navigation" aria-label="月份切换">
          {months.map((m) => (
            <Link
              key={m}
              href={`/business/aihuishou/compare?month=${m}`}
              className={`chip${m === selected ? " chip-active" : ""}`}
            >
              {m}
            </Link>
          ))}
        </div>

        <h2 className="section-title" style={{ marginTop: 8 }}>
          {selected} 单月对比
        </h2>
        <div className="compare-grid">
          <StoreCard scope="friendship" row={selF} sensitive={sensitive} />
          <StoreCard scope="wanda" row={selW} sensitive={sensitive} />
        </div>
        {sensitive && selW?.netAfterCosts == null && selF?.netAfterCosts == null ? (
          <p className="page-desc" style={{ marginTop: 12 }}>
            {selected} 尚无完整净利口径：净利暂定与利润率显示「—」，待该月工资分摊与已知扣款补齐后出数，不估算（当前仅 2026-09 完整）。
          </p>
        ) : null}

        <h2 className="section-title">逐月对比（到店口径）</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th rowSpan={2}>月份</th>
                <th colSpan={colsPerStore}>石河子友谊商厦店</th>
                <th colSpan={colsPerStore}>石河子万达店</th>
              </tr>
              <tr>
                <th>分润（元）</th>
                {sensitive ? (
                  <>
                    <th>门店成本（元）</th>
                    <th>净利暂定·扣成本后（元）</th>
                    <th>利润率（分润）</th>
                    <th>
                      利润率（营收）
                      <span className="th-note">营收待接入</span>
                    </th>
                  </>
                ) : (
                  <th>营收（元）</th>
                )}
                <th>分润（元）</th>
                {sensitive ? (
                  <>
                    <th>门店成本（元）</th>
                    <th>净利暂定·扣成本后（元）</th>
                    <th>利润率（分润）</th>
                    <th>
                      利润率（营收）
                      <span className="th-note">营收待接入</span>
                    </th>
                  </>
                ) : (
                  <th>营收（元）</th>
                )}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const f = friendshipCmp.get(m);
                const w = wandaCmp.get(m);
                return (
                  <tr key={m} className={m === selected ? "row-selected" : undefined}>
                    <td>{m}</td>
                    <td>{money2(f?.profit)}</td>
                    {sensitive ? (
                      <>
                        <td>{money2(f?.storeCosts)}</td>
                        <td>{f?.netAfterCosts == null ? "—" : money2(f.netAfterCosts)}</td>
                        <td>{f?.profitMargin == null ? "—" : pct(f.profitMargin)}</td>
                        <td>—</td>
                      </>
                    ) : (
                      <td>—</td>
                    )}
                    <td>{money2(w?.profit)}</td>
                    {sensitive ? (
                      <>
                        <td>{money2(w?.storeCosts)}</td>
                        <td>{w?.netAfterCosts == null ? "—" : money2(w.netAfterCosts)}</td>
                        <td>{w?.profitMargin == null ? "—" : pct(w.profitMargin)}</td>
                        <td>—</td>
                      </>
                    ) : (
                      <td>—</td>
                    )}
                  </tr>
                );
              })}
              <tr className="total">
                <td>合计</td>
                <td>{money2(friendshipTotal)}</td>
                {sensitive ? (
                  <>
                    <td>{money2(friendshipCostTotal)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </>
                ) : (
                  <td>—</td>
                )}
                <td>{money2(wandaTotal)}</td>
                {sensitive ? (
                  <>
                    <td>{money2(wandaCostTotal)}</td>
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
        <p className="page-desc" style={{ marginTop: 12 }}>
          单店净利暂定 = 该店净利暂定（到店口径，已扣该店工资分摊与已知扣款）− 该店当月门店成本；仅 2026-09 有完整口径，其余月份显示「—」不估算。
          报销为公司级花费，不摊入单店对比（公司口径见报表页与总览）。上门单只看两店合计，不计入单店业绩。
          友谊店 2026-02 开业，2026-01 无经营数据。
        </p>
      </main>
    </>
  );
}
