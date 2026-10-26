import type { StoreScope } from "./stores";

/** 报销归属与状态（纯数据模块，客户端组件也可安全 import）。 */
export type ExpenseScope = StoreScope | "company";
export type ExpenseStatus = "unreimbursed" | "reimbursed";

export const EXPENSE_SCOPE_LABEL: Record<ExpenseScope, string> = {
  wanda: "万达店",
  friendship: "友谊店",
  company: "公司",
};

/** 未报销超期阈值（指令46 B9 / 指令53 D7）：发生日距今超过 14 天仍未报销 → 站内「超期」标记（不发通知）。 */
export const EXPENSE_OVERDUE_DAYS = 14;

/** 是否超期未报销：与报销列表的行内「超期」徽标同一判定，供顶栏计数共用。 */
export function isOverdueUnreimbursed(
  claimDate: string,
  status: ExpenseStatus,
  nowMs: number = Date.now()
): boolean {
  if (status !== "unreimbursed") return false;
  // 按 UTC 日历日算间隔：服务端（UTC）与浏览器（老板时区）同一时刻得到同一结果，
  // 避免顶栏计数与行内徽标在临界日不一致。
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(claimDate);
  if (!m) return false;
  const claimUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date(nowMs);
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((todayUtc - claimUtc) / 86_400_000) > EXPENSE_OVERDUE_DAYS;
}
