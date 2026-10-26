"use client";

import type { TargetReviewRow } from "@/lib/targets";

/**
 * 目标达成复盘 CSV 导出（指令59 A5）：与报表页复盘表格同一份行数据
 * （lib/targets.ts buildTargetReviewRows），仅敏感角色渲染（页面侧整节
 * 仅敏感角色，店员无此按钮，见 audit-staff 断言）。
 * 金额列输出纯数字（2 位小数）便于 Excel 再算；缺目标/缺实际留空，
 * 状态列保留「未设定 / 待核算 / 已达成 / 未达成」口径字样。
 */
export default function TargetReviewExport({ rows }: { rows: TargetReviewRow[] }) {
  function exportCsv() {
    const cell = (r: TargetReviewRow, v: number | null) =>
      v === null ? "" : r.metric === "orders" ? String(Math.round(v)) : v.toFixed(2);
    const lines = [
      ["月份", "口径", "目标", "实际", "达成率", "状态"].join(","),
      ...rows.map((r) =>
        [
          r.month,
          r.metricLabel,
          cell(r, r.targetValue),
          cell(r, r.actual),
          r.rate === null ? "" : `${r.rate.toFixed(1)}%`,
          r.status,
        ].join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "目标达成复盘.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) return null;
  return (
    <button type="button" className="btn btn-ghost" style={{ marginTop: 14 }} onClick={exportCsv}>
      导出复盘 CSV
    </button>
  );
}
