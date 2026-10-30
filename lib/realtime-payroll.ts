/**
 * 计薪口径说明（与 ops 仓 scripts/payroll/realtime_payroll.py 对齐）。
 * 「工资怎么算」和帮助页共用这些句子。人效卡的金额不在这里：
 * 按人草案由 GET /api/salary/realtime 读取 salary_realtime_draft。
 * 本文件不放汇总额。UPLOAD / APPLY 在 ops 仓，保持 false。
 *
 * - 线上 = 非门店 × 1%
 * - 门店 = 订单金额不含券阶梯（≥6 万 4% / ≥3 万 3%，取最高达成档）
 * - 底薪全员 2000
 */

/** 人效以外的口径句，避免「工资怎么算」和帮助页各写一套。 */
export const PAYROLL_CALIBER = {
  /** 底薪全员 2000（元/人/月） */
  basePerPerson: 2000,
  /** 线上 = 非门店 × 1% */
  onlineBasis: "非门店",
  onlinePct: 1,
  /** 门店 = 订单金额不含券阶梯 */
  storeBasis: "订单金额不含券阶梯",
  /** 与 realtime_payroll.py STORE_TIERS 一致，只用于口径说明 */
  storeTiers: [
    { min: 60000, pct: 4 },
    { min: 30000, pct: 3 },
  ],
} as const;
