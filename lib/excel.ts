/**
 * Excel 可打开的 .xls 导出（指令52-3，零新依赖）：
 * 生成带 Excel 命名空间的 HTML 表格文件，Excel / WPS / Numbers 均可直接打开。
 * 纯函数 + 浏览器下载助手，仅供客户端组件调用。
 */

function escCell(v: string | number): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExcelHtml(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): string {
  const head = headers.map((h) => `<th>${escCell(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escCell(c)}</td>`).join("")}</tr>`)
    .join("");
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">` +
    `<title>${escCell(sheetName)}</title></head>` +
    `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
  );
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const blob = new Blob(["\uFEFF" + buildExcelHtml(sheetName, headers, rows)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
