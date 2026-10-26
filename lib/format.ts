/** 金额：千分位 + 取整到元（页面展示口径，与驾驶舱 v3.1+ 精简版一致） */
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Math.round(v).toLocaleString("zh-CN");
}

/** 金额：保留 2 位小数（报表明细口径） */
export function money2(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function int(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("zh-CN");
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(1)}%`;
}
