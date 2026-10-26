import type { CSSProperties } from "react";
import CountUp from "./CountUp";

/**
 * KPI 主数字（指令39）：按展示字符串长度分档缩放，保证任何卡内完整可见、不裁切。
 * 档位（scale）：≤5 字符 1 · 6 字符 0.87 · 7–8 字符 0.73 · 9–10 字符 0.62 · ≥11 字符 0.53。
 * （档位已按「数字 0.62em/字宽 + 千分位 0.28em + 单位后缀宽度」保守估算校准，
 *   桌面四列卡 222px 内容宽下最长串「416,661」+ 单位仍留 ≥5% 余量。）
 * 实际字号 = 流体基准字号（--kpi-fs，CSS 按视口/情境给）× 本档 scale。
 * 单位（unit）渲染为主数字的基线对齐后缀，不再塞进下方小字说明。
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
}: {
  value: string;
  unit?: string;
}) {
  const style = { "--kpi-scale": kpiScaleFor(value) } as CSSProperties;
  return (
    <div className="kpi-value" style={style}>
      <CountUp value={value} />
      {unit ? <span className="kpi-unit">{unit}</span> : null}
    </div>
  );
}

export default function KpiCard({
  label,
  value,
  unit,
  sub,
  locked,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  locked?: boolean;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      {locked ? (
        <>
          <div className="kpi-value locked">无权限</div>
          <div className="kpi-sub">该指标仅老板 / 合伙人可见</div>
        </>
      ) : (
        <>
          <KpiValue value={value} unit={unit} />
          {sub ? <div className="kpi-sub">{sub}</div> : null}
        </>
      )}
    </div>
  );
}
