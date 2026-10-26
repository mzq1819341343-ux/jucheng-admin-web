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
