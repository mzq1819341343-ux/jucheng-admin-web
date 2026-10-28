/**
 * 实时工资汇总数（指令194 接线，老板 2026-10-28 20:39 拍板）。
 *
 * 数据来源：指令191 franchise-admin 抓数（orders37 旧机销售订单明细，
 * 2026-10 完成时间，共 458 单）+ 指令193 在职名单过滤（只算在职，
 * 张浩冉与已离职人员不计薪），由 scripts/payroll/realtime_payroll.py
 * 以 --active-roster 重跑得出的 2026-10 实时工资草案汇总。
 * 本机产物（个人级，仅本机、禁止入仓）：
 *   ~/Desktop/05_Muse督工/payroll_193/payroll_2026-10.json
 *   输入原生导出：~/Desktop/05_Muse督工/fetch_samples_191/native_export_2026-10_oldMachineOrder.xlsx
 *
 * 更新方式：重跑 realtime_payroll 后，手工把汇总数同步到本文件——
 * UPLOAD / APPLY 仍为 false（docs/fetch-pipeline/pipeline_config.json），
 * 本站不自动写入、不覆盖生产真数。本数是草案（draft）：10 月对账单
 * 未生成（statement=pending，月未结），待月结后校准。
 */

export const REALTIME_PAYROLL = {
  /** 草案月份（生效月 effective_from = 2026-10） */
  month: "2026-10",
  /** 生成日期（与 193 重跑同日） */
  generatedOn: "2026-10-28",
  /** 来源标注：191 抓数结构 + 193 名单口径 */
  source: "orders37/191",
  roster: "active-only/193",
  statement: "pending",
  /** 计薪人数（仅在职名单） */
  headcount: 4,
  /** 计薪单量（在职人员名下 10 月订单） */
  countedOrders: 275,
  /** 排除人数 / 单量（名单外与已离职，不计薪，订单留痕于排除清单） */
  excludedPeople: 4,
  excludedOrders: 183,
  /** 五项拆分汇总（元） */
  baseTotal: 8000,
  doorCommissionTotal: 647.5,
  onlineCommissionTotal: 737.95,
  storeCommissionTotal: 7849.6,
  accessoriesCommissionTotal: 0,
  /** 应发合计（元） */
  grossTotal: 17235.05,
  /**
   * 人效分母：2026-10 全量 458 单的订单分润金额合计（元，订单口径）。
   * 分润金额非空 442 单求和，16 单为空不补值；非对账单口径。
   */
  orderProfitTotal: 59211.68,
  orderProfitRows: 442,
  orderRowsTotal: 458,
} as const;

/** 人均应发 = 应发合计 ÷ 计薪人数 */
export const REALTIME_PAYROLL_PER_CAPITA =
  REALTIME_PAYROLL.grossTotal / REALTIME_PAYROLL.headcount;

/** 人均单量 = 计薪单量 ÷ 计薪人数 */
export const REALTIME_PAYROLL_ORDERS_PER_CAPITA =
  REALTIME_PAYROLL.countedOrders / REALTIME_PAYROLL.headcount;

/** 工资占分润比（%）= 应发合计 ÷ 订单分润合计 × 100 */
export const REALTIME_PAYROLL_WAGE_TO_PROFIT_PCT =
  (REALTIME_PAYROLL.grossTotal / REALTIME_PAYROLL.orderProfitTotal) * 100;
