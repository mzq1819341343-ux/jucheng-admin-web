import { Fragment } from "react";
import loadable from "next/dynamic";
import Nav from "@/components/Nav";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import SalaryRuleCard from "@/components/SalaryRuleCard";

/**
 * 指令170 C1/C6：老板区两个重型客户端组件（规则管理器含双版本预览、CSV 导入器）
 * 改路由内动态 import——不再同步进工资页导航关键 chunk，页头与「工资怎么算」
 * 先渲染可交互，这两块到达后回填（占位高度与卡片一致，避免跳版）。
 */
const SalaryRuleManager = loadable(() => import("@/components/SalaryRuleManager"), {
  loading: () => <div className="skel skel-block" aria-hidden="true" />,
});
const SalaryMonthlyImporter = loadable(() => import("@/components/SalaryMonthlyImporter"), {
  loading: () => <div className="skel skel-block" aria-hidden="true" />,
});
import {
  getCurrentUser,
  getPublicSalaryRule,
  getSalaryRules,
  getMySalary,
  getAllSalaryMonthly,
  getSalaryStoreAgg,
  getAllMembers,
  getSalaryDetailImport,
  getMetrics,
  ROLE_LABEL,
} from "@/lib/data";
import { STORE_LABEL } from "@/lib/stores";
import { money, money2 } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 工资页（指令41）：入口全角色可见，内容按角色分化——
 * 老板：工资体系配置 + 全员月度工资行（仅老板可见，不导出原表）；
 * 合伙人：只看门店月度汇总（视图聚合，无他人明细）；
 * 店员：「我的薪酬」，只查自己已发布的月份（RLS + 应用层双保险）。
 * 骨架阶段数据为空属正常，全部走空态，等老板提供数字后录入。
 */
export default async function SalaryPage() {
  const user = await getCurrentUser();
  const publicRule = await getPublicSalaryRule(user);

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">SALARY</span>
          <span className="eyebrow-cn">工资</span>
        </div>
        <h1 className="page-title">{user.role === "staff" ? "我的薪酬" : "工资"}</h1>
        <p className="page-desc">
          当前角色：{ROLE_LABEL[user.role]}
          {user.demo ? "｜演示模式（表单仅本地演示，不落库）" : ""}
          ｜工资由老板录入，本站不展示工资原表。
        </p>

        <h2 className="section-title">工资怎么算</h2>
        <SalaryRuleCard rule={publicRule} />

        {user.role === "owner" ? (
          <OwnerSalary user={user} />
        ) : user.role === "partner" ? (
          <PartnerSalary user={user} />
        ) : (
          <StaffSalary user={user} />
        )}
      </main>
    </>
  );
}

async function OwnerSalary({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const [rules, rows, { members }, detailRows, combined] = await Promise.all([
    getSalaryRules(user),
    getAllSalaryMonthly(user),
    getAllMembers(),
    getSalaryDetailImport(user),
    getMetrics("combined", user.role),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.display_name ?? "—"]));

  return (
    <>
      <h2 className="section-title">工资体系配置</h2>
      <div className="card">
        <SalaryRuleManager
          initialRules={rules}
          demo={user.demo}
          userId={user.id}
          months={combined.rows.map((r) => r.month)}
        />
      </div>

      <h2 className="section-title">月度工资导入</h2>
      <div className="card">
        <SalaryMonthlyImporter members={members} demo={user.demo} userId={user.id} />
      </div>

      <h2 className="section-title">员工月度工资（按人行，仅老板可见）</h2>
      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">
            暂无已发布的月度工资。录入并发布后，员工可在「我的薪酬」看到自己的一行。
          </p>
        ) : (
          <div className="table-wrap">
            <table className="report">
              <thead>
                <tr>
                  <th>月份</th>
                  <th style={{ textAlign: "left" }}>员工</th>
                  <th>门店</th>
                  <th>底薪（元）</th>
                  <th>提成（元）</th>
                  <th>扣款（元）</th>
                  <th>实发（元）</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.month}</td>
                    <td style={{ textAlign: "left" }}>{nameById.get(r.user_id) ?? "—"}</td>
                    <td>{STORE_LABEL[r.scope]}</td>
                    <td>{money2(r.base_amount)}</td>
                    <td>{money2(r.commission_amount)}</td>
                    <td>{money2(r.deduction_amount)}</td>
                    <td>{money2(r.net_amount)}</td>
                    <td>
                      {r.published ? (
                        <span className="tag tag-ok">已发布</span>
                      ) : (
                        <span className="tag tag-pending">未发布</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="page-desc" style={{ marginTop: 12 }}>
          按人明细仅老板可见，本站不提供工资原表导出；员工只看到自己已发布月份的一行。
        </p>
      </div>

      <h2 className="section-title">工资明细（实表导入）</h2>
      <SalaryDetailSection user={user} detailRows={detailRows} combinedRows={combined.rows} />
    </>
  );
}

/**
 * 工资实表明细只读区（指令47）：数据来自 salary_detail_import（老板提供的
 * 2026 年 1–9 月工资实表按锁定口径导入），仅老板渲染本区，RLS 同步只有
 * owner 策略；合伙人 / 员工页面不出现本区。逐月与 monthly_metrics 的
 * 月度工资汇总自动对账，差额逐行列明（应为 0.00）。
 */
function SalaryDetailSection({
  user,
  detailRows,
  combinedRows,
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  detailRows: Awaited<ReturnType<typeof getSalaryDetailImport>>;
  combinedRows: Awaited<ReturnType<typeof getMetrics>>["rows"];
}) {
  if (user.demo) {
    return (
      <div className="card">
        <p className="empty">
          演示模式不显示实表明细：明细来自工资实表导入，仅老板真实登录后可见；员工与合伙人均不可见，也不在演示中出现。
        </p>
      </div>
    );
  }
  if (detailRows.length === 0) {
    return (
      <div className="card">
        <p className="empty">
          尚未导入工资实表明细：导入完成后，这里按月列示逐人实发，并与月度工资汇总自动对账。
        </p>
      </div>
    );
  }

  const months = [...new Set(detailRows.map((r) => r.month))].sort().reverse();
  const wageByMonth = new Map(combinedRows.map((r) => [r.month, r.wage_cost ?? null]));
  const detailSum = (m: string) =>
    detailRows.filter((r) => r.month === m).reduce((s, r) => s + Number(r.net_amount ?? 0), 0);
  const detailGrand = detailRows.reduce((s, r) => s + Number(r.net_amount ?? 0), 0);
  const metricsGrand = months.reduce((s, m) => s + Number(wageByMonth.get(m) ?? 0), 0);
  const SECTION_LABEL: Record<string, string> = { store: "门店", door: "上门" };

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="report">
          <thead>
            <tr>
              <th>月份</th>
              <th style={{ textAlign: "left" }}>员工</th>
              <th>段</th>
              <th>固定（元）</th>
              <th>提成（元）</th>
              <th>调整（元）</th>
              <th>实发（元）</th>
              <th style={{ textAlign: "left" }}>备注</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <Fragment key={m}>
                {detailRows
                  .filter((r) => r.month === m)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.month}</td>
                      <td style={{ textAlign: "left" }}>{r.employee_name}</td>
                      <td>{SECTION_LABEL[r.section] ?? r.section}</td>
                      <td>{money2(r.base_amount)}</td>
                      <td>{money2(r.commission_amount)}</td>
                      <td>{money2(r.deduction_amount)}</td>
                      <td>{money2(r.net_amount)}</td>
                      <td style={{ textAlign: "left" }}>{r.note ?? "—"}</td>
                    </tr>
                  ))}
                <tr key={`${m}-subtotal`}>
                  <td colSpan={6} style={{ textAlign: "right" }}>
                    {m} 明细合计
                  </td>
                  <td>{money2(detailSum(m))}</td>
                  <td />
                </tr>
              </Fragment>
            ))}
            <tr>
              <td colSpan={6} style={{ textAlign: "right" }}>
                全部月份明细总计
              </td>
              <td>{money2(detailGrand)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="section-title" style={{ marginTop: 20 }}>与月度汇总对账</h3>
      <div className="table-wrap">
        <table className="report">
          <thead>
            <tr>
              <th>月份</th>
              <th>明细实发合计（元）</th>
              <th>月度汇总（元）</th>
              <th>差额（元）</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const d = detailSum(m);
              const w = wageByMonth.get(m) ?? null;
              const diff = w === null ? null : Math.round((d - w) * 100) / 100;
              return (
                <tr key={m}>
                  <td>{m}</td>
                  <td>{money2(d)}</td>
                  <td>{money2(w)}</td>
                  <td>
                    {diff === null ? (
                      "—"
                    ) : diff === 0 ? (
                      <span className="tag tag-ok">0.00</span>
                    ) : (
                      <span className="tag tag-pending">{money2(diff)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td>总计</td>
              <td>{money2(detailGrand)}</td>
              <td>{money2(metricsGrand)}</td>
              <td>
                {Math.round((detailGrand - metricsGrand) * 100) / 100 === 0 ? (
                  <span className="tag tag-ok">0.00</span>
                ) : (
                  <span className="tag tag-pending">
                    {money2(Math.round((detailGrand - metricsGrand) * 100) / 100)}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="page-desc" style={{ marginTop: 12 }}>
        明细口径：实发取工资表最终打款列（2 月合计、3 月实际工资、4–9 月去除公费实际打款、1 月银行代发）；
        李东浩与李冬浩为同一人，已合并。年回报率的工资实发合计以本明细为准，与月度汇总交叉校验。
        员工账号建立后，可按姓名把明细晋升为员工可见的月度工资行（先未发布，核对后发布）。
      </p>
    </div>
  );
}

async function PartnerSalary({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const agg = await getSalaryStoreAgg(user);
  return (
    <>
      <h2 className="section-title">门店月度工资汇总</h2>
      <div className="card">
        {agg.length === 0 ? (
          <p className="empty">暂无已发布的月度工资：老板录入并发布后，这里按门店按月显示汇总。</p>
        ) : (
          <div className="table-wrap">
            <table className="report">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>门店</th>
                  <th>人数</th>
                  <th>实发合计（元）</th>
                  <th>底薪合计（元）</th>
                  <th>提成合计（元）</th>
                </tr>
              </thead>
              <tbody>
                {agg.map((a) => (
                  <tr key={`${a.scope}-${a.month}`}>
                    <td>{a.month}</td>
                    <td>{STORE_LABEL[a.scope]}</td>
                    <td>{a.headcount}</td>
                    <td>{money2(a.total_net)}</td>
                    <td>{money2(a.total_base)}</td>
                    <td>{money2(a.total_commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="page-desc" style={{ marginTop: 12 }}>
          合伙人只看门店汇总，不显示他人工资明细。
        </p>
      </div>
    </>
  );
}

async function StaffSalary({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const rows = await getMySalary(user);
  const latest = rows[0];

  if (!latest) {
    return (
      <div className="card">
        <p className="empty">本月工资尚未发布：老板录入并发布后，这里会显示你的实发与构成。</p>
      </div>
    );
  }

  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card kpi-wide kpi-hero">
          <div className="kpi-label">本月实发（{latest.month}，{STORE_LABEL[latest.scope]}）</div>
          <KpiValue value={money(latest.net_amount)} unit="元" />
          <div className="kpi-sub">工资由老板录入并发布，此处只显示你本人的数据</div>
        </div>
      </div>
      <div className="kpi-row" style={{ marginTop: 16 }}>
        <KpiCard label="底薪" value={money(latest.base_amount)} unit="元" />
        <KpiCard label="提成" value={money(latest.commission_amount)} unit="元" />
        <KpiCard label="扣款" value={money(latest.deduction_amount)} unit="元" />
      </div>

      {rows.length > 1 ? (
        <>
          <h2 className="section-title">历史月份</h2>
          <div className="card table-wrap">
            <table className="report">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>门店</th>
                  <th>底薪（元）</th>
                  <th>提成（元）</th>
                  <th>扣款（元）</th>
                  <th>实发（元）</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.month}</td>
                    <td>{STORE_LABEL[r.scope]}</td>
                    <td>{money2(r.base_amount)}</td>
                    <td>{money2(r.commission_amount)}</td>
                    <td>{money2(r.deduction_amount)}</td>
                    <td>{money2(r.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
