import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import StoreCostManager from "@/components/StoreCostManager";
import { getCurrentUser, getStoreCosts, getStoreContracts, type StoreCost, type StoreContract } from "@/lib/data";
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
  // 指令133 A2 瀑布：成本与合同两路独立，由串行 2 层改 Promise.all 一层。
  const [costs, contracts] = await Promise.all([getStoreCosts(user), getStoreContracts(user)]);
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
          两店分月成本（房租 / 水电 / 其他）{isOwner ? "，可录入与修改" : "，只读"}。
          已录入成本进入仪表盘净利核算，未录入的类型未取得、不计入。
          {user.demo ? " 当前为演示模式，表单仅本地演示。" : ""}
        </p>

        <h2 className="section-title">合同台账</h2>
        {contracts.length === 0 ? (
          <div className="card">
            <p className="empty">暂无合同记录：两店合同要点录入后在此列示。</p>
          </div>
        ) : (
          <div className="biz-grid" style={{ marginBottom: 8 }}>
            {contracts.map((c) => (
              <ContractCard key={c.id} contract={c} />
            ))}
          </div>
        )}

        <h2 className="section-title">月度成本</h2>
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
  return <p className="empty">暂无成本记录：录入后按月在此列示，并进入净利核算。</p>;
}

/** 合同卡片（指令42）：门店、点位、期限、月费与构成、支付方式、保证金（不进月成本）、备注。 */
function ContractCard({ contract: c }: { contract: StoreContract }) {
  const breakdown = Object.entries(c.fee_breakdown ?? {});
  return (
    <div className="biz-card contract-card">
      <div className="biz-en">{c.scope === "wanda" ? "WANDA" : "FRIENDSHIP"} · CONTRACT</div>
      <div className="biz-name" style={{ fontSize: 24 }}>
        {STORE_LABEL[c.scope]}
      </div>
      <p className="biz-summary" style={{ marginTop: 6 }}>
        {c.title}
      </p>
      <ul className="plain" style={{ marginTop: 14 }}>
        <li>
          <strong>签约双方：</strong>
          {c.party_a ?? "—"} × {c.party_b ?? "—"}
        </li>
        <li>
          <strong>点位：</strong>
          {c.location ?? "—"}
          {c.area_sqm !== null ? `（约 ${c.area_sqm} ㎡）` : ""}
        </li>
        <li>
          <strong>期限：</strong>
          {c.term_start ?? "—"} ~ {c.term_end ?? "—"}
        </li>
        <li>
          <strong>月费：</strong>
          {c.monthly_fee === null ? "—" : `${money2(c.monthly_fee)} 元/月`}
          {breakdown.length > 0 ? (
            <span style={{ color: "var(--muted)" }}>
              （
              {breakdown
                .map(([k, v]) => `${k} ${typeof v === "number" ? `${money2(v)} 元` : String(v)}`)
                .join("；")}
              ）
            </span>
          ) : null}
        </li>
        <li>
          <strong>支付：</strong>
          {c.payment_cycle ?? "—"}
        </li>
        <li>
          <strong>保证金：</strong>
          {c.deposit_total === null ? "—" : `${money2(c.deposit_total)} 元`}
          <span style={{ color: "var(--muted)" }}>（只登记，不进月成本）</span>
        </li>
      </ul>
      {c.note ? (
        <p className="biz-summary" style={{ marginTop: 12 }}>
          {c.note}
        </p>
      ) : null}
    </div>
  );
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
