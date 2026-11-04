"use client";

import type { SalaryRule } from "@/lib/data";

/**
 * 工资双版本预览（指令53 D2）：按规则的生效起始月（effective_from）把数据月份
 * 逐月标注「旧规则 / 新规则」——生效月之前按旧规则、生效月起按新规则回算。
 * effective_from 为空时不臆测切换点，整列显示「待确认」。
 * 纯展示组件：吃 SalaryRuleManager 的本地状态，保存生效月后即时翻转（演示模式同样成立）。
 */
export default function SalaryRuleVersionPreview({
  rule,
  months,
}: {
  rule: SalaryRule | null;
  months: string[];
}) {
  if (!rule || months.length === 0) return null;
  const sorted = [...months].sort();
  const eff = rule.effective_from;

  return (
    <div className="salary-gap">
      <h3 className="salary-subhead">双版本预览（{rule.title}）</h3>
      <div className="salary-tags">
        {sorted.map((m) => {
          const isNew = eff !== null && m >= eff;
          const isEffMonth = eff !== null && m === eff;
          const label = eff === null ? "待确认" : isNew ? "新规则" : "旧规则";
          const cls = eff === null ? "tag tag-pending" : isNew ? "tag tag-ok" : "tag";
          return (
            <span key={m} className={isEffMonth ? `${cls} tag-current` : cls}>
              {m} · {label}
              {isEffMonth ? " · 生效月" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
