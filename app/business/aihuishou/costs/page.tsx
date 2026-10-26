import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import StoreCostManager from "@/components/StoreCostManager";
import { getCurrentUser, getStoreCosts, type StoreCost } from "@/lib/data";
import { STORE_LABEL, COST_TYPE_LABEL, type CostType } from "@/lib/stores";
import { money2 } from "@/lib/format";

export const dynamic = "force-dynamic";

const COST_TYPES: CostType[] = ["rent", "utilities", "other"];

/**
 * 门店成本页（指令41）：板块 layout 已做业务授权守卫，这里再拦角色——
 * 店员一律拦回（成本对其完全不可见，RLS 亦无策略）；老板可增删改，合伙人只读。
 * 骨架阶段无数据走空态，等老板提供成本数字后录入，录入即进入净利核算。
 */
export default async function StoreCostsPage() {
  const user = await getCurrentUser();
  if (user.role === "staff") {
    redirect("/?denied=costs");
  }
  const costs = await getStoreCosts(user);
  const isOwner = user.role === "owner";

  // 按月分组（新→旧），组内给出两店分项与当月合计
  const months = [...new Set(costs.map((c) => c.month))].sort().reverse();

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">AIHUISHOU · STORE COSTS</span>
          <span className="eyebrow-cn">业务板块 · 爱回收</span>
        </div>
        <h1 className="page-title">门店成本</h1>
        <p className="page-desc">
          两店分月成本（房租 / 水电 / 其他）{isOwner ? "，老板可录入与修改" : "，合伙人只读"}；
          已录入月份的成本合计会进入爱回收仪表盘的净利暂定核算，未录入的类型未取得、不计入。
          {user.demo ? " 当前为演示模式，表单仅本地演示。" : ""}
        </p>

        {isOwner ? (
          <div className="card">
            <StoreCostManager initialCosts={costs} demo={user.demo} userId={user.id} />
          </div>
        ) : (
          <div className="card">{costs.length === 0 ? <EmptyCosts /> : <CostTables costs={costs} months={months} />}</div>
        )}

        {isOwner && costs.length > 0 ? (
          <>
            <h2 className="section-title">按月汇总（两店）</h2>
            <div className="card">
              <CostTables costs={costs} months={months} />
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}

function EmptyCosts() {
  return <p className="empty">待老板提供成本数字后录入：录入后按月在此列示，并进入净利核算。</p>;
}

function CostTables({ costs, months }: { costs: StoreCost[]; months: string[] }) {
  return (
    <>
      {months.map((m) => {
        const rows = costs.filter((c) => c.month === m);
        const total = rows.reduce((s, c) => s + c.amount, 0);
        return (
          <div key={m} style={{ marginBottom: 22 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>
              {m}（两店合计 {money2(total)} 元）
            </h3>
            <div className="table-wrap">
              <table className="report">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>门店</th>
                    {COST_TYPES.map((t) => (
                      <th key={t}>{COST_TYPE_LABEL[t]}（元）</th>
                    ))}
                    <th>小计（元）</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(STORE_LABEL) as (keyof typeof STORE_LABEL)[]).map((scope) => {
                    const byType = (t: CostType) =>
                      rows.find((c) => c.scope === scope && c.cost_type === t)?.amount ?? null;
                    const subtotal = rows
                      .filter((c) => c.scope === scope)
                      .reduce((s, c) => s + c.amount, 0);
                    return (
                      <tr key={scope}>
                        <td style={{ textAlign: "left" }}>{STORE_LABEL[scope]}</td>
                        {COST_TYPES.map((t) => (
                          <td key={t}>{byType(t) === null ? "未录入" : money2(byType(t))}</td>
                        ))}
                        <td>{money2(subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
