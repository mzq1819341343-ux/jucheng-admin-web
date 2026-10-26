import Nav from "@/components/Nav";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import SalaryRuleManager from "@/components/SalaryRuleManager";
import SalaryRuleCard from "@/components/SalaryRuleCard";
import {
  getCurrentUser,
  getPublicSalaryRule,
  getSalaryRules,
  getMySalary,
  getAllSalaryMonthly,
  getSalaryStoreAgg,
  getAllMembers,
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
          ｜工资数字由老板提供后录入，本站不展示工资原表。
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
  const [rules, rows, { members }] = await Promise.all([
    getSalaryRules(user),
    getAllSalaryMonthly(user),
    getAllMembers(),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.display_name ?? "—"]));

  return (
    <>
      <h2 className="section-title">工资体系配置</h2>
      <div className="card">
        <SalaryRuleManager initialRules={rules} demo={user.demo} userId={user.id} />
      </div>

      <h2 className="section-title">员工月度工资（按人行，仅老板可见）</h2>
      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">
            暂无已发布的月度工资：老板提供工资数字后，在此按人按月录入并发布，员工即可在「我的薪酬」看到自己的一行。
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
    </>
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
