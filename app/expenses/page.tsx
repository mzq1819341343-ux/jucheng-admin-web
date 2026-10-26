import Nav from "@/components/Nav";
import KpiCard from "@/components/KpiCard";
import ExpenseManager from "@/components/ExpenseManager";
import ExpenseAggExport from "@/components/ExpenseAggExport";
import {
  getCurrentUser,
  getExpenseClaims,
  getExpenseMonthlyAgg,
  aggregateExpenseClaims,
  type ExpenseMonthlyAgg,
} from "@/lib/data";
import { isOverdueUnreimbursed } from "@/lib/expenses";
import { money, money2, int } from "@/lib/format";

export const dynamic = "force-dynamic";

function SummaryCards({
  rows,
  latestMonth,
  overdueSub,
}: {
  rows: ExpenseMonthlyAgg[];
  latestMonth: string;
  /** 指令53 D7：未报销合计卡的超期说明（明细角色给超期笔数；合伙人给不可见说明）。 */
  overdueSub?: string;
}) {
  const unreimbursed = rows.reduce((s, r) => s + r.unreimbursed_total, 0);
  const reimbursed = rows.reduce((s, r) => s + r.reimbursed_total, 0);
  const latest = rows.find((r) => r.month === latestMonth);
  return (
    <div className="kpi-row">
      <KpiCard label="未报销合计（全部月份）" value={money(unreimbursed)} unit="元" sub={overdueSub} />
      <KpiCard label="已报销合计（全部月份）" value={money(reimbursed)} unit="元" />
      <KpiCard
        label={`本月公司花费合计（${latestMonth}）`}
        value={money(latest?.total)}
        unit="元"
        sub={latest ? `共 ${int(latest.count)} 笔 · 已报销与未报销均计入已发生花费` : "当月暂无报销记录"}
      />
    </div>
  );
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  const { status } = await searchParams;
  // 指令55-3：总览超期提醒条直达——带 ?status=unreimbursed 时列表初始落在「未报销」筛选。
  const initialStatusFilter =
    status === "unreimbursed" || status === "reimbursed" ? status : "all";
  const isPartner = user.role === "partner";

  if (isPartner) {
    const agg = await getExpenseMonthlyAgg(user);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const latestMonth = agg[0]?.month ?? currentMonth;
    return (
      <>
        <Nav user={user} />
        <main className="container">
          <div className="eyebrow">
            <span className="en">EXPENSES</span>
            <span className="eyebrow-cn">公司报销</span>
          </div>
          <h1 className="page-title">报销台账</h1>
          <p className="page-desc">
            仅看公司汇总（无明细、报销人与录入表单）。未报销也计入已发生花费。
          </p>
          <SummaryCards
            rows={agg}
            latestMonth={latestMonth}
            overdueSub="超期笔数按逐单发生日计算，合伙人汇总不含逐单日期，仅老板 / 本人明细可见"
          />
          <h2 className="section-title">按月汇总</h2>
          <div className="card table-wrap">
            {agg.length === 0 ? (
              <p className="empty">暂无报销汇总。</p>
            ) : (
              <table className="report">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>公司花费合计（元）</th>
                    <th>已报销（元）</th>
                    <th>未报销（元）</th>
                    <th>笔数</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{money2(r.total)}</td>
                      <td>{money2(r.reimbursed_total)}</td>
                      <td>{money2(r.unreimbursed_total)}</td>
                      <td>{int(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <ExpenseAggExport rows={agg} />
        </main>
      </>
    );
  }

  const claims = await getExpenseClaims(user);
  const agg = aggregateExpenseClaims(claims);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const latestMonth = agg[0]?.month ?? currentMonth;
  const isStaff = user.role === "staff";
  // 指令53 D7：顶栏超期笔数——按当前角色可见范围（老板全部 / 店员自己）统计，与行内徽标同判定。
  const overdueCount = claims.filter((c) => isOverdueUnreimbursed(c.claim_date, c.status)).length;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">EXPENSES</span>
          <span className="eyebrow-cn">公司报销</span>
        </div>
        <h1 className="page-title">{isStaff ? "我的报销" : "报销台账"}</h1>
        <p className="page-desc">
          {isStaff
            ? "只显示你创建的报销单，可新建、编辑、删除与切换状态。"
            : "全部报销单，可新建、编辑、删除与切换状态。"}
          未报销也计入当月已发生花费。
          {user.demo ? " 当前为演示模式：本地样例数据，不写库。" : ""}
        </p>

        <SummaryCards
          rows={agg}
          latestMonth={latestMonth}
          overdueSub={`其中超期 ${overdueCount} 笔（发生超 14 天未报销）`}
        />

        <h2 className="section-title">{isStaff ? "我创建的报销单" : "全部报销单"}</h2>
        <div className="card">
          <ExpenseManager
            initialClaims={claims}
            demo={user.demo}
            role={user.role}
            userId={user.id}
            claimantName={user.displayName ?? user.email}
            initialStatusFilter={initialStatusFilter}
          />
        </div>
      </main>
    </>
  );
}
