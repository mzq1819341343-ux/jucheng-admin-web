"use client";

/**
 * 工资双版本预览（指令53 D2）：按规则的生效起始月（effective_from）把数据月份
 * 逐月标注「旧规则 / 新规则」——生效月之前按旧规则、生效月起按新规则回算。
 * effective_from 为空时不臆测切换点，整列显示「待确认」。
 * 纯展示组件：吃 SalaryRuleManager 的本地状态，保存生效月后即时翻转（演示模式同样成立）。
 * 只需要岗位名和生效月，不接收提成原文。
 */
export default function SalaryRuleVersionPreview({
  rule,
  months,
}: {
  rule: { title: string; effective_from: string | null } | null;
  months: string[];
}) {
  if (!rule || months.length === 0) return null;
  const sorted = [...months].sort();
  const eff = rule.effective_from;

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
        双版本预览（{rule.title}）
      </h3>
      {eff ? (
        <p className="page-desc" style={{ margin: "0 0 10px" }}>
          生效起始月 {eff}：该月及之后按<strong>新规则</strong>，此前月份按<strong>旧规则</strong>回算。
        </p>
      ) : (
        <p className="page-desc" style={{ margin: "0 0 10px" }}>
          生效起始月未填（待确认）：不臆测切换点，全部月份暂标「待确认」；在上方规则行填入并保存生效起始月后，这里自动按月切换新旧规则。
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
