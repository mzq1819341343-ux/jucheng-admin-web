import type { StoreScope } from "./stores";

/** 报销归属与状态（纯数据模块，客户端组件也可安全 import）。 */
export type ExpenseScope = StoreScope | "company";
export type ExpenseStatus = "unreimbursed" | "reimbursed";

export const EXPENSE_SCOPE_LABEL: Record<ExpenseScope, string> = {
  wanda: "万达店",
  friendship: "友谊店",
  company: "公司",
};
