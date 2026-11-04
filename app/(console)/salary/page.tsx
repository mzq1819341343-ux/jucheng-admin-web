import { Fragment, Suspense } from "react";
import loadable from "next/dynamic";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import SalaryTierEditor from "@/components/SalaryTierEditor";
import FetchJobsCard from "@/components/FetchJobsCard";
import SalaryLiveBoard from "@/components/SalaryLiveBoard";

const SalaryRuleManager = loadable(() => import("@/components/SalaryRuleManager"), {
  loading: () => <div className="skel skel-block" aria-hidden="true" />,
});
const SalaryMonthlyImporter = loadable(() => import("@/components/SalaryMonthlyImporter"), {
  loading: () => <div className="skel skel-block" aria-hidden="true" />,
});
const EmployeeRosterCard = loadable(() => import("@/components/EmployeeRosterCard"), {
  loading: () => <div className="skel skel-block" aria-hidden="true" />,
});
import {
  getCurrentUser,
  getPublicSalaryRule,
  getSalaryRules,
  getEmployees,
  getMySalary,
  getAllSalaryMonthly,
  getSalaryStoreAgg,
  getAllMembers,
  getSalaryDetailImport,
  getMetrics,
} from "@/lib/data";
import { STORE_LABEL } from "@/lib/stores";
import { money, money2 } from "@/lib/format";
import { salaryDashboardVisible } from "@/lib/salary-dashboard";

function isLead(role: string): role is "owner" | "partner" {
  return salaryDashboardVisible(role);
}

export const dynamic = "force-dynamic";

/**
 * 工资页。老板与合伙人同一页：汇总指标，然后按人草案；其余默认折叠。
 * 算薪口径、闸、字段语义和权限不在这里改。
 */
export default async function SalaryPage() {
  const user = await getCurrentUser();

  return (
    <main className="container calm no-enter salary-page">
      <div className="eyebrow">
        <span className="en">SALARY</span>
        <span className="eyebrow-cn">工资</span>
      </div>
      <h1 className="page-title">{user.role === "staff" ? "我的薪酬" : "工资"}</h1>

      {isLead(user.role) ? (
        <SalaryLiveBoard role={user.role} />
      ) : (
        <Suspense fallback={<div className="skel skel-block" aria-hidden="true" />}>
          <StaffSalary user={user} />
        </Suspense>
      )}

      <div className="salary-folds">
        <details className="salary-fold">
          <summary>阶梯提成与奖励</summary>
          <div className="salary-fold-body">
            <Suspense fallback={<div className="skel skel-block" aria-hidden="true" />}>
              <PublicSalaryRule user={user} />
            </Suspense>
          </div>
        </details>

        {isLead(user.role) ? (
          <details className="salary-fold">
            <summary>员工与抓取</summary>
            <div className="salary-fold-body">
              <div className="salary-ops">
                <Suspense fallback={<div className="skel skel-block" aria-hidden="true" />}>
                  <EmployeeRoster user={user} />
                </Suspense>
                <FetchJobsCard role={user.role} />
              </div>
            </div>
          </details>
        ) : null}

        {user.role === "owner" ? (
          <Suspense fallback={<div className="skel skel-block" aria-hidden="true" />}>
            <OwnerSalary user={user} />
          </Suspense>
        ) : user.role === "partner" ? (
          <Suspense fallback={<div className="skel skel-block" aria-hidden="true" />}>
            <PartnerSalary user={user} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}

async function EmployeeRoster({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const [rows, { members }] = await Promise.all([getEmployees(user), getAllMembers()]);
  return (
    <EmployeeRosterCard
      initialRows={rows}
      members={members.map((member) => ({ id: member.id, display_name: member.display_name }))}
      canEdit={user.role === "owner"}
      demo={user.demo}
    />
  );
}

async function PublicSalaryRule({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const publicRule = await getPublicSalaryRule(user);
  return (
    <SalaryTierEditor
      rule={publicRule}
      canEdit={user.role === "owner"}
      demo={user.demo}
      userId={user.id}
    />
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
      <details className="salary-fold">
        <summary>工资体系</summary>
        <div className="salary-fold-body">
          <SalaryRuleManager
            initialRules={rules}
            demo={user.demo}
            userId={user.id}
            months={combined.rows.map((r) => r.month)}
          />
        </div>
      </details>

      <details className="salary-fold">
        <summary>录入与导入</summary>
        <div className="salary-fold-body">
          <h2 className="section-title">月度工资导入</h2>
          <div className="card">
            <SalaryMonthlyImporter members={members} demo={user.demo} userId={user.id} />
          </div>

          <h2 className="section-title">员工月度工资</h2>
          <div className="card">
            {rows.length === 0 ? (
              <p className="empty">暂无已发布的月度工资</p>
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
          </div>

          <h2 className="section-title">工资明细</h2>
          <SalaryDetailSection user={user} detailRows={detailRows} combinedRows={combined.rows} />
        </div>
      </details>
    </>
  );
}

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
        <p className="empty">暂无实表明细</p>
      </div>
    );
  }
  if (detailRows.length === 0) {
    return (
      <div className="card">
        <p className="empty">尚未导入</p>
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

      <h3 className="salary-subhead">与月度汇总对账</h3>
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
    </div>
  );
}

async function PartnerSalary({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const agg = await getSalaryStoreAgg(user);
  return (
    <details className="salary-fold">
      <summary>门店月度汇总</summary>
      <div className="salary-fold-body">
        <div className="card">
          {agg.length === 0 ? (
            <p className="empty">暂无已发布的月度工资</p>
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
        </div>
      </div>
    </details>
  );
}

async function StaffSalary({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const rows = await getMySalary(user);
  const latest = rows[0];

  if (!latest) {
    return (
      <div className="card">
        <p className="empty">本月工资尚未发布</p>
      </div>
    );
  }

  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">
            本月实发（{latest.month}，{STORE_LABEL[latest.scope]}）
          </div>
          <KpiValue value={money(latest.net_amount)} unit="元" />
        </div>
      </div>
      <div className="kpi-row salary-gap">
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
