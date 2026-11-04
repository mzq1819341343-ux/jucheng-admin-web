"use client";

import { downloadExcel } from "@/lib/excel";
import {
  REALTIME_PERSON_EXPORT_HEADERS,
  buildRealtimePersonCsv,
  realtimePersonExportMatrix,
  type RealtimeExportSource,
} from "@/lib/salary-realtime-export";

/**
 * 人效按人表导出。样式与报销汇总、目标复盘的 ghost 按钮一致。
 * 只下载当前已经载入的行；没有行、还在读、或读取失败时按钮不可用。
 */
export default function RealtimePayrollExport({
  month,
  source,
  notice,
}: {
  month: string;
  source: RealtimeExportSource | null;
  notice: string | null;
}) {
  const disabled = notice !== null || source === null || source.people.length === 0;

  function exportCsv() {
    if (disabled || source === null) return;
    const blob = new Blob(["\uFEFF" + buildRealtimePersonCsv(source)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `人效按人-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    if (disabled || source === null) return;
    downloadExcel(
      `人效按人-${month}.xls`,
      "人效按人",
      [...REALTIME_PERSON_EXPORT_HEADERS],
      realtimePersonExportMatrix(source)
    );
  }

  return (
    <div className="salary-actions">
      <div className="salary-actions-row">
        <button type="button" className="btn btn-ghost" disabled={disabled} onClick={exportCsv}>
          导出按人表 CSV
        </button>
        <button type="button" className="btn btn-ghost" disabled={disabled} onClick={exportExcel}>
          导出按人表 Excel
        </button>
      </div>
    </div>
  );
}
