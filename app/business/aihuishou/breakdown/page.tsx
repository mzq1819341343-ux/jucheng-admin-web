import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentUser, getMetrics, canSeeSensitive, getStoreCosts, getExpenseOperatingInput } from "@/lib/data";
import { buildOperatingMetrics } from "@/lib/operating";
import { money2 } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 指令46 B4：净利构成（瀑布）。
 * 最新完整口径月份的分项链条，全部数字来自 monthly_metrics / store_costs /
 * expense_claims 与 lib/operating 单一核算函数；无法再拆的差额单列并注明。
 * 店员无净利权限：导航不渲染入口，直进重定向回总览。
 */
export default async function NetBreakdownPage() {
  const user = await getCurrentUser();
  if (!canSeeSensitive(user.role)) {
    redirect("/?denied=breakdown");
  }
  const combined = await getMetrics("combined", user.role);
  const wanda = await getMetrics("wanda", user.role);
  const friendship = await getMetrics("friendship", user.role);
  const costs = await getStoreCosts(user);
  const expenseInput = await getExpenseOperatingInput(user);
  const operating = buildOperatingMetrics({ metrics: combined.rows, storeCosts: costs, expenses: expenseInput });
  const op = operating.latestComplete;

  const storeRow = (month: string) =>
    (wanda.rows.find((r) => r.month === month)?.profit ?? 0) +
    (friendship.rows.find((r) => r.month === month)?.profit ?? 0);

  type Step = { label: string; note?: string; delta: number | null; cumulative: number; kind: "start" | "delta" | "total" | "final"; pending?: boolean };
  let steps: Step[] = [];
  if (op && op.profit !== null && op.baseNetProfit !== null && op.companyNetProfit !== null) {
    const storeProfit = storeRow(op.month);
    const doorProfit = op.profit - storeProfit;
    const wage = op.wageCost ?? 0;
    const residual = storeProfit - wage - op.baseNetProfit;
    const afterWage = storeProfit - wage;
    steps = [
      // 指令52-4：营收段占位（灰段）——营收接入后瀑布自营收起算，当前自当月分润起算，不编营收数。
      { label: "营收（待接入）", note: "营收数据接入后自营收起算；当前自当月分润起算", delta: null, cumulative: op.profit, kind: "start", pending: true },
      { label: `当月分润（两店到店 + 上门）`, delta: null, cumulative: op.profit, kind: "start" },
      { label: "减：上门分润", note: "上门只看两店合计，不计入到店净利口径", delta: -doorProfit, cumulative: storeProfit, kind: "delta" },
      { label: "减：工资实发", note: "当月工资汇总，按口径计入净利", delta: -wage, cumulative: afterWage, kind: "delta" },
      { label: "减：已知扣款与其余口径差额", note: "对账已知扣款等，现有字段无法再拆，差额单列", delta: -residual, cumulative: op.baseNetProfit, kind: "delta" },
      { label: "净利暂定（扣门店成本前）", delta: null, cumulative: op.baseNetProfit, kind: "total" },
      { label: "减：门店成本", note: "房租 / 物业等已录入成本", delta: -op.storeCosts, cumulative: op.storeNetProfit ?? op.baseNetProfit - op.storeCosts, kind: "delta" },
      { label: "减：报销花费（公司级）", note: `未报销 ${money2(op.expenseUnreimbursed)} 元亦计入已发生`, delta: -op.expenseTotal, cumulative: op.companyNetProfit, kind: "delta" },
      { label: "公司口径净利", delta: null, cumulative: op.companyNetProfit, kind: "final" },
    ];
  }

  const values = steps.map((s) => s.cumulative);
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const span = maxV - minV || 1;
  const pos = (v: number) => ((v - minV) / span) * 100;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">AIHUISHOU · NET BREAKDOWN</span>
          <span className="eyebrow-cn">业务板块 · 爱回收</span>
        </div>
        <h1 className="page-title">净利构成</h1>
        <p className="page-desc">
          {op
            ? `最新完整口径月份 ${op.month} 的分项链条：从当月分润一步步扣到公司口径净利。`
            : "暂无完整口径月份，待净利暂定补齐后出图。"}
          数字与仪表盘、报表同一核算来源，不另算。
        </p>

        {steps.length > 0 ? (
          <div className="card">
            <div style={{ display: "grid", gap: 14 }}>
              {steps.map((s, i) => {
                const prev = i === 0 ? 0 : steps[i - 1].cumulative;
                const from = s.kind === "delta" ? Math.min(pos(prev), pos(s.cumulative)) : pos(Math.min(0, s.cumulative));
                const width =
                  s.kind === "delta"
                    ? Math.abs(pos(s.cumulative) - pos(prev))
                    : Math.abs(pos(s.cumulative) - pos(0));
                const barColor =
                  s.kind === "start" || s.kind === "final"
                    ? "var(--gold)"
                    : s.kind === "total"
                      ? "var(--muted)"
                      : "var(--negative)";
                const barBackground = s.pending
                  ? "repeating-linear-gradient(45deg, var(--faint) 0 6px, transparent 6px 12px)"
                  : barColor;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <span style={s.pending ? { color: "var(--faint)" } : undefined}>
                        {s.label}
                        {s.note ? <span className="kpi-sub" style={{ marginLeft: 8 }}>{s.note}</span> : null}
                      </span>
                      <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                        {s.pending ? (
                          "—（待接入）"
                        ) : (
                          <>
                            {s.delta !== null ? `−${money2(Math.abs(s.delta))} 元 · ` : ""}
                            累计 {money2(s.cumulative)} 元
                          </>
                        )}
                      </strong>
                    </div>
                    <div
                      aria-hidden
                      style={{
                        position: "relative",
                        height: 14,
                        borderRadius: 7,
                        background: "var(--border)",
                        opacity: 1,
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `${from}%`,
                          width: `${Math.max(1, width)}%`,
                          background: barBackground,
                          opacity: s.pending ? 0.5 : s.kind === "delta" ? 0.55 : 1,
                          borderRadius: 7,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="page-desc" style={{ marginTop: 16, marginBottom: 0 }}>
              口径：净利暂定为到店口径（已扣工资分摊与已知扣款），上门分润不计入；门店成本与报销花费在此页继续向下扣减，
              得到与仪表盘一致的公司口径净利。瀑布首段「营收（待接入）」为灰色占位段：营收数据接入后瀑布自营收起算，当前自当月分润起算，不编营收数字。
              其余月份净利口径未补齐，暂不出图，不估算。
            </p>
          </div>
        ) : (
          <div className="card">
            <p className="empty">暂无可展示的净利构成：完整口径月份核算后自动生成。</p>
          </div>
        )}
      </main>
    </>
  );
}
