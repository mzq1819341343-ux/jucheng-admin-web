/**
 * 工资页「仪表盘」的纯展示。只描述已经从 GET 读到的数字和上次抓取，
 * 不写 salary_realtime_draft，也不下发抓取任务。
 */

import { money2 } from "./format";
import { fetchLegLabel, type FetchJobLatest } from "./fetch-jobs";
import { formatShanghaiDateTime } from "./salary-realtime";

/** 店员不看仪表盘。老板与合伙人看同一份只读块。 */
export function salaryDashboardVisible(role: string | null | undefined): boolean {
  return role === "owner" || role === "partner";
}

/**
 * 桌面表与手机展开明细的列顺序。
 * 扣款是草案 deduction；失误合计在 KPI，不占这一列。
 */
export const DASHBOARD_AMOUNT_COLUMNS = [
  { key: "base", label: "底薪" },
  { key: "door", label: "上门" },
  { key: "online", label: "线上" },
  { key: "store", label: "门店" },
  { key: "accessories", label: "配件×30%" },
  { key: "subsidy", label: "补贴" },
  { key: "bonus", label: "奖金" },
  { key: "deduction", label: "扣款" },
  { key: "gross", label: "应发" },
] as const;

export type DashboardAmountKey = (typeof DASHBOARD_AMOUNT_COLUMNS)[number]["key"];

export function dashboardHeadcount(people: readonly { in_draft: boolean }[]): number {
  return people.reduce((count, person) => count + (person.in_draft ? 1 : 0), 0);
}

/** 手机摘要一行：姓名 · 应发。合计行用「合计」作姓名。 */
export function dashboardPersonLine(name: string, gross: number): string {
  return `${name} · ${money2(gross)}`;
}

/** 上次抓取的一行状态。没有记录时不编造时间或行数。 */
export function fetchLatestOneLiner(latest: FetchJobLatest): string {
  if (latest.empty) return "这个月还没有抓取记录。";
  const when = latest.at ? formatShanghaiDateTime(latest.at) : "时间未返回";
  return `上次抓取 ${when} · 旧机 ${fetchLegLabel(latest.used)} · 配件 ${fetchLegLabel(latest.accessories)}`;
}
