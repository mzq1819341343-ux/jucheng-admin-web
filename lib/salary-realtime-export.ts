/**
 * 人效按人表的客户端导出。数据就是已经拿到的 GET /api/salary/realtime，
 * 不另开导出接口。补贴 / 奖金列还没进响应时按 0 写出，表头保持产品确认的形状。
 * 失误只导出 mistake_total，不另加罚款列。
 */

import type { RealtimeSalaryPerson, RealtimeSalaryResponse, RealtimeSalaryTotals } from "./salary-realtime";

export const REALTIME_PERSON_EXPORT_HEADERS = [
  "姓名",
  "底薪",
  "上门",
  "线上",
  "门店",
  "配件",
  "补贴",
  "奖金",
  "失误合计",
  "应发",
] as const;

export interface RealtimeExportSource {
  people: readonly RealtimeSalaryPerson[];
  totals: RealtimeSalaryTotals;
}

function exportMoney(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toFixed(2);
}

/** 字段不在响应里时导出 0，保证列还没落地时表头也不缺。 */
function handExport(value: number | undefined): string {
  return exportMoney(value);
}

function personCells(person: RealtimeSalaryPerson): string[] {
  return [
    person.display_name,
    exportMoney(person.base),
    exportMoney(person.door),
    exportMoney(person.online),
    exportMoney(person.store),
    exportMoney(person.accessories),
    handExport(person.subsidy),
    handExport(person.bonus),
    exportMoney(person.mistake_total),
    exportMoney(person.gross),
  ];
}

/** 按人行加上与页面合计行一致的末行。金额是接口数字，不在这里重算应发。 */
export function realtimePersonExportMatrix(source: RealtimeExportSource): string[][] {
  const people = source.people.map(personCells);
  people.push([
    "合计",
    exportMoney(source.totals.base),
    exportMoney(source.totals.door),
    exportMoney(source.totals.online),
    exportMoney(source.totals.store),
    exportMoney(source.totals.accessories),
    handExport(source.totals.subsidy),
    handExport(source.totals.bonus),
    exportMoney(source.totals.mistake_total),
    exportMoney(source.totals.gross),
  ]);
  return people;
}

export function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildRealtimePersonCsv(source: RealtimeExportSource): string {
  const lines = [
    REALTIME_PERSON_EXPORT_HEADERS.map(csvField).join(","),
    ...realtimePersonExportMatrix(source).map((row) => row.map(csvField).join(",")),
  ];
  return lines.join("\n");
}

/** 给测试一个不依赖组件的入口，确认响应类型能直接导出。 */
export function exportSourceFromResponse(body: RealtimeSalaryResponse): RealtimeExportSource {
  return { people: body.people, totals: body.totals };
}
