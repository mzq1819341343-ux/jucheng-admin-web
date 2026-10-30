import type { SalaryRule } from "@/lib/data";
import { money2 } from "@/lib/format";
import { formatCommissionRuleLines } from "@/lib/commission-rules";
import CommissionRuleText from "@/components/CommissionRuleText";

/**
 * 「工资怎么算」规则卡（指令42）：/salary 顶部全角色可见。
 * 把 salary_rules 的结构化配置翻译成人话：底薪全员、线上（非门店）、门店（订单金额不含券阶梯）、配件阶梯、上门提成、生效起始月。
 * 提成短句与工资体系表「提成规则」列共用 formatCommissionRuleLines，两边口径保持一致。
 * 规则来自老板配置（演示模式为同口径兜底常量）；不涉及任何个人工资数据。
 */

export default function SalaryRuleCard({ rule }: { rule: SalaryRule | null }) {
  if (!rule) {
    return (
      <div className="card rule-card">
        <p className="empty">暂无工资规则：规则保存后，这里会用一句话讲清工资怎么算。</p>
      </div>
    );
  }

  const lines = formatCommissionRuleLines(rule.commission_rules, rule.base_salary);
  const base = lines.find((line) => line.id === "base") ?? null;
  const details = lines.filter((line) => line.id !== "base");

  return (
    <div className="card rule-card">
      <ul className="plain">
        <li>
          {base ? (
            <CommissionRuleText line={base} />
          ) : (
            <>
              <strong>底薪：</strong>全员 {money2(rule.base_salary)} 元/月
            </>
          )}
        </li>
        {details.map((line) => (
          <li key={line.id}>
            <CommissionRuleText line={line} />
          </li>
        ))}
      </ul>
      <p className="page-desc" style={{ marginTop: 14, marginBottom: 0 }}>
        生效起始月：{rule.effective_from ?? "待老板确认"}
        {rule.effective_from
          ? "（该月起按本规则计算，此前月份按历史规则回算）"
          : "（确认后支持新旧双版本规则按月回算）"}
        {rule.note ? `｜${rule.note}` : ""}
      </p>
      <p className="page-desc" style={{ marginTop: 8, marginBottom: 0 }}>
        历史双版本按生效起始月切换：新规则自生效月起算，之前月份按旧规则回算。
      </p>
    </div>
  );
}
