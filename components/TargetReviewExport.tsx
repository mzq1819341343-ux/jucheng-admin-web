"use client";

import type { TargetReviewRow } from "@/lib/targets";
import { downloadExcel } from "@/lib/excel";

/**
 * 目标达成复盘导出（指令59 A5 CSV、指令60 A4 补 Excel）：与报表页复盘表格
 * 同一份行数据（lib/targets.ts buildTargetReviewRows），CSV 与 Excel 共用
 * 同一格式化口径（rowCells），仅敏感角色渲染（页面侧整节仅敏感角色，
 * 店员无此二按钮，见 audit-staff 断言）。
 * 金额列输出纯数字（2 位小数）便于 Excel 再算；缺目标/缺实际留空，
 * 状态列保留「未设定 / 待核算 / 已达成 / 未达成」口径字样。
 */
const HEADERS = ["月份", "口径", "目标", "实际", "达成率", "状态"];

function cellOf(r: TargetReviewRow, v: number | null): string {
  return v === null ? "" : r.metric === "orders" ? String(Math.round(v)) : v.toFixed(2);
}

function rowCells(r: TargetReviewRow): string[] {
  return [
    r.month,
    r.metricLabel,
    cellOf(r, r.targetValue),
    cellOf(r, r.actual),
    r.rate === null ? "" : `${r.rate.toFixed(1)}%`,
    r.status,
  ];
}

export default function TargetReviewExport({ rows }: { rows: TargetReviewRow[] }) {
  function exportCsv() {
    const lines = [HEADERS.join(","), ...rows.map((r) => rowCells(r).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "目标达成复盘.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    downloadExcel("目标达成复盘.xls", "目标达成复盘", HEADERS, rows.map(rowCells));
  }

  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-ghost" onClick={exportCsv}>
        导出复盘 CSV
      </button>
      <button type="button" className="btn btn-ghost" onClick={exportExcel}>
        导出复盘 Excel
      </button>
    </div>
  );
}
