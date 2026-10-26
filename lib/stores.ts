/**
 * 门店 / 成本类型定义（纯数据，无服务端依赖，客户端组件也可 import）。
 * 与 supabase 表 store_costs / salary_monthly 的 scope、cost_type 取值对应。
 */
export type StoreScope = "wanda" | "friendship";
export type CostType = "rent" | "utilities" | "other";

export const STORE_LABEL: Record<StoreScope, string> = {
  wanda: "石河子万达店",
  friendship: "石河子友谊商厦店",
};

export const COST_TYPE_LABEL: Record<CostType, string> = {
  rent: "房租",
  utilities: "水电",
  other: "其他",
};
