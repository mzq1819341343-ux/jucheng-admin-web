/**
 * 月度目标口径与标签（单一来源，指令58 A4 抽出）：
 * 本模块无服务端依赖，总览目标卡（客户端组件）与报表复盘（服务端组件）共用，
 * 避免口径标签两处文案漂移；类型与 lib/data.ts 的 SiteTargetMetric 保持一致。
 */
export type SiteTargetMetricKey = "profit" | "net_profit" | "orders";

export const TARGET_METRIC_LABEL: Record<SiteTargetMetricKey, string> = {
  profit: "当月分润",
  net_profit: "公司口径净利",
  orders: "当月单量",
};

// ============================================================
// 目标达成复盘行（指令58 A4 建节，指令59 A5 抽为页面表格与 CSV 导出的
// 同源计算）：逐月 × 三口径的目标 / 实际 / 达成率 / 状态。
// 状态口径：无目标 →「未设定」；有目标但实际缺完整口径 →「待核算」；
// 达成率 ≥100% →「已达成」，否则「未达成」。缺数不估算、不冒数。
// ============================================================
export const TARGET_REVIEW_METRICS: SiteTargetMetricKey[] = ["profit", "net_profit", "orders"];

export type TargetReviewStatus = "未设定" | "待核算" | "已达成" | "未达成";

export interface TargetReviewRow {
  month: string;
  metric: SiteTargetMetricKey;
  metricLabel: string;
  targetValue: number | null;
  actual: number | null;
  rate: number | null;
  status: TargetReviewStatus;
}

export function buildTargetReviewRows(input: {
  months: { month: string; profit: number | null; orders: number | null }[];
  targets: { month: string; metric: SiteTargetMetricKey; target_value: number }[];
  companyNetProfit: Record<string, number | null>;
}): TargetReviewRow[] {
  return input.months.flatMap((r) =>
    TARGET_REVIEW_METRICS.map((metric) => {
      const target =
        input.targets.find((t) => t.month === r.month && t.metric === metric)?.target_value ?? null;
      const actual =
        metric === "profit"
          ? (r.profit ?? null)
          : metric === "orders"
            ? (r.orders ?? null)
            : (input.companyNetProfit[r.month] ?? null);
      const rate =
        target !== null && actual !== null && target !== 0 ? (actual / target) * 100 : null;
      const status: TargetReviewStatus =
        target === null ? "未设定" : actual === null ? "待核算" : rate !== null && rate >= 100 ? "已达成" : "未达成";
      return {
        month: r.month,
        metric,
        metricLabel: TARGET_METRIC_LABEL[metric],
        targetValue: target,
        actual,
        rate,
        status,
      };
    })
  );
}
