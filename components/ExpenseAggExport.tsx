"use client";

import type { ExpenseMonthlyAgg } from "@/lib/data";

/** 指令46 B3：合伙人月度汇总 CSV 导出（仅汇总，无明细字段）。 */
export default function ExpenseAggExport({ rows }: { rows: ExpenseMonthlyAgg[] }) {
  function exportCsv() {
    const lines = [
      ["月份", "公司花费合计（元）", "已报销（元）", "未报销（元）", "笔数"].join(","),
      ...rows.map((r) =>
        [
          r.month,
          Number(r.total ?? 0).toFixed(2),
          Number(r.reimbursed_total ?? 0).toFixed(2),
          Number(r.unreimbursed_total ?? 0).toFixed(2),
          String(r.count ?? 0),
        ].join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "报销月度汇总.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) return null;
  return (
    <button type="button" className="btn btn-ghost" style={{ marginTop: 14 }} onClick={exportCsv}>
      导出月度汇总 CSV
    </button>
  );
}
