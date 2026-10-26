import type { CSSProperties, ReactNode } from "react";
import CountUp from "./CountUp";

/**
 * KPI 主数字（指令39）：按展示字符串长度分档缩放，保证任何卡内完整可见、不裁切。
 * 档位（scale）：≤5 字符 1 · 6 字符 0.87 · 7–8 字符 0.73 · 9–10 字符 0.62 · ≥11 字符 0.53。
 * 实际字号 = 流体基准字号（--kpi-fs，CSS 按视口/情境给）× 本档 scale。
 * 单位（unit）渲染为主数字的基线对齐后缀，不再塞进下方小字说明。
 *
 * 指令51：KpiCard 增加 size 变体（hero = 现有阶梯最大档 / md = 现大卡档 / sm = 紧凑档）；
 * 长说明走 hint（title 悬停提示），卡面只留短标签与极短 sub；
 * 数字默认静态渲染，CountUp 仅英雄 opt-in（countUp / animate，时长 ≤500ms）。
 */
export function kpiScaleFor(value: string): number {
  const len = value.replace(/\s/g, "").length;
  if (len <= 5) return 1;
  if (len === 6) return 0.87;
  if (len <= 8) return 0.73;
  if (len <= 10) return 0.62;
  return 0.53;
}

export function KpiValue({
  value,
  unit,
  tone = "default",
  animate = false,
}: {
  value: string;
  unit?: string;
  tone?: "default" | "negative" | "positive";
  /** 仅英雄数字开启（CountUp 时长压到 450ms）；其余一律静态。 */
  animate?: boolean;
}) {
  const style = { "--kpi-scale": kpiScaleFor(value) } as CSSProperties;
  return (
    <div className={`kpi-value${tone !== "default" ? ` kpi-${tone}` : ""}`} style={style}>
      {animate ? <CountUp value={value} duration={450} /> : value}
      {unit ? <span className="kpi-unit">{unit}</span> : null}
    </div>
  );
}

export type KpiSize = "hero" | "md" | "sm";

export default function KpiCard({
  label,
  value,
  unit,
  sub,
  hint,
  locked,
  className,
  tone = "default",
  size = "md",
  countUp = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  /** 长说明：走 title 悬停提示，不占卡面（指令51）。 */
  hint?: string;
  locked?: boolean;
  className?: string;
  tone?: "default" | "negative" | "positive";
  size?: KpiSize;
  countUp?: boolean;
}) {
  const sizeClass = size === "hero" ? " kpi-card-hero" : size === "sm" ? " kpi-card-sm" : "";
  return (
    <div className={`kpi-card${sizeClass}${className ? ` ${className}` : ""}`} title={hint}>
      <div className="kpi-label">{label}</div>
      {locked ? (
        <>
          <div className="kpi-value locked">无权限</div>
          <div className="kpi-sub">该指标仅老板 / 合伙人可见</div>
        </>
      ) : (
        <>
          <KpiValue value={value} unit={unit} tone={tone} animate={countUp} />
          {sub ? <div className="kpi-sub">{sub}</div> : null}
        </>
      )}
    </div>
  );
}
