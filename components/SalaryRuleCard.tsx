import type { SalaryRule } from "@/lib/data";
import { money2, int } from "@/lib/format";

/**
 * 「工资怎么算」规则卡（指令42）：/salary 顶部全角色可见。
 * 把 salary_rules 的结构化配置翻译成人话：底薪分项、线上提成、门店/配件阶梯、上门提成、生效起始月。
 * 规则来自老板配置（演示模式为同口径兜底常量）；不涉及任何个人工资数据。
 */
function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asObj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asArr(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is Record<string, unknown> => typeof x === "object" && x !== null
  );
}

export default function SalaryRuleCard({ rule }: { rule: SalaryRule | null }) {
  if (!rule) {
    return (
      <div className="card">
        <p className="empty">工资体系待老板提供后录入：规则落库后，这里会用一句话讲清工资怎么算。</p>
      </div>
    );
  }

  const cr = rule.commission_rules ?? {};
  const base = asObj(cr.base_breakdown);
  const basic = base ? asNum(base.basic) : null;
  const attendance = base ? asNum(base.attendance) : null;
  const newCustomer = base ? asNum(base.new_customer) : null;
  const baseNote = base && typeof base.note === "string" ? base.note : null;
  const baseTotal =
    rule.base_salary ??
    (basic !== null || attendance !== null || newCustomer !== null
      ? (basic ?? 0) + (attendance ?? 0) + (newCustomer ?? 0)
      : null);

  const onlinePct = asNum(cr.online_order_pct);
  const storeTiers = asArr(cr.store_tiers);
  const accTiers = asArr(cr.accessories_tiers);
  const doorPct = asNum(cr.door_profit_pct);

  return (
    <div className="card">
      <ul className="plain">
        <li>
          <strong>底薪：</strong>
          {base ? (
            <>
              合计 {money2(baseTotal)} 元/月 = 基础 {money2(basic)} + 全勤 {money2(attendance)} + 拉新{" "}
              {money2(newCustomer)}
            </>
          ) : (
            <>{money2(rule.base_salary)} 元/月</>
          )}
          {baseNote ? <span style={{ color: "var(--muted)" }}>（{baseNote}）</span> : null}
        </li>
        {onlinePct !== null ? (
          <li>
            <strong>线上订单提成：</strong>一律 {onlinePct}%
          </li>
        ) : null}
        {storeTiers.length > 0 ? (
          <li>
            <strong>门店提成（阶梯，取最高达成档）：</strong>
            {storeTiers
              .map((t) => {
                const th = asNum(t.threshold);
                const p = asNum(t.pct);
                return th !== null && p !== null ? `业绩 ≥ ${int(th)} 元 → ${p}%` : null;
              })
              .filter(Boolean)
              .join("；")}
          </li>
        ) : null}
        {accTiers.length > 0 ? (
          <li>
            <strong>配件提成：</strong>
            {accTiers
              .map((t) => {
                const below = asNum(t.below);
                const th = asNum(t.threshold);
                const p = asNum(t.pct);
                if (p === null) return null;
                if (below !== null) return `业绩 < ${int(below)} 元 → ${p}%`;
                if (th !== null) return `业绩 ≥ ${int(th)} 元 → ${p}%`;
                return null;
              })
              .filter(Boolean)
              .join("；")}
          </li>
        ) : null}
        {doorPct !== null ? (
          <li>
            <strong>上门提成：</strong>卖出机子利润的 {doorPct}%
          </li>
        ) : null}
      </ul>
      <p className="page-desc" style={{ marginTop: 14, marginBottom: 0 }}>
        生效起始月：{rule.effective_from ?? "待老板确认"}
        {rule.effective_from
          ? "（该月起按本规则计算，此前月份按历史规则回算）"
          : "（确认后支持新旧双版本规则按月回算）"}
        {rule.note ? `｜${rule.note}` : ""}
      </p>
    </div>
  );
}
