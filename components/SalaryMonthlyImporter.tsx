"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/data";
import type { StoreScope } from "@/lib/stores";
import { STORE_LABEL } from "@/lib/stores";
import { money2 } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const TEMPLATE_HEADER = "员工邮箱或账号标识,月份,门店,底薪,提成,扣款,实发,备注";

type ImportStatus = "ready" | "invalid" | "unmatched" | "demo";

interface ImportRow {
  line: number;
  identifier: string;
  month: string;
  scopeText: string;
  scope: StoreScope | null;
  baseAmount: number | null;
  commissionAmount: number | null;
  deductionAmount: number | null;
  netAmount: number | null;
  note: string;
  errors: string[];
  matchedUserId: string | null;
  matchedName: string | null;
  status: ImportStatus;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseAmount(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw.replace(/,/g, "").replace(/¥/g, "").trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

function normalizeScope(raw: string): StoreScope | null {
  const v = raw.trim().toLowerCase();
  if (v === "wanda" || v.includes("万达")) return "wanda";
  if (v === "friendship" || v.includes("友谊")) return "friendship";
  return null;
}

function isHeader(cells: string[]): boolean {
  const joined = cells.join(",").toLowerCase();
  return (
    joined.includes("employee") ||
    joined.includes("员工") ||
    joined.includes("月份") ||
    joined.includes("month") ||
    joined.includes("实发") ||
    joined.includes("net_amount")
  );
}

export default function SalaryMonthlyImporter({
  members,
  demo,
  userId,
}: {
  members: Profile[];
  demo: boolean;
  userId: string | null;
}) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const memberByIdentifier = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const member of members) {
      map.set(member.id.toLowerCase(), member);
      if (member.display_name) map.set(member.display_name.trim().toLowerCase(), member);
    }
    return map;
  }, [members]);

  const rows = useMemo<ImportRow[]>(() => {
    if (!csvText.trim()) return [];
    const parsed = parseCsv(csvText);
    const dataRows = parsed.length > 0 && isHeader(parsed[0]) ? parsed.slice(1) : parsed;
    const seen = new Set<string>();

    return dataRows.map((cells, index) => {
      const line = index + (parsed.length > 0 && isHeader(parsed[0]) ? 2 : 1);
      const identifier = (cells[0] ?? "").trim();
      const month = (cells[1] ?? "").trim();
      const scopeText = (cells[2] ?? "").trim();
      const scope = normalizeScope(scopeText);
      const baseAmount = parseAmount(cells[3] ?? "");
      const commissionAmount = parseAmount(cells[4] ?? "");
      const deductionAmount = parseAmount(cells[5] ?? "");
      const netAmount = parseAmount(cells[6] ?? "");
      const note = (cells[7] ?? "").trim();
      const errors: string[] = [];

      if (!identifier) errors.push("员工标识为空");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) errors.push("月份格式应为 YYYY-MM");
      if (!scope) errors.push("门店应为 wanda / friendship（或万达 / 友谊）");
      if (baseAmount !== null && Number.isNaN(baseAmount)) errors.push("底薪不是数字");
      if (commissionAmount !== null && Number.isNaN(commissionAmount)) errors.push("提成不是数字");
      if (deductionAmount !== null && Number.isNaN(deductionAmount)) errors.push("扣款不是数字");
      if (netAmount === null || Number.isNaN(netAmount)) errors.push("实发必填且须为数字");

      const duplicateKey = `${identifier.toLowerCase()}|${month}`;
      if (identifier && month && seen.has(duplicateKey)) errors.push("同一员工同一月份在文件中重复");
      if (identifier && month) seen.add(duplicateKey);

      const matched = identifier ? memberByIdentifier.get(identifier.toLowerCase()) : undefined;
      const structuralError = errors.length > 0;
      return {
        line,
        identifier,
        month,
        scopeText,
        scope,
        baseAmount: baseAmount !== null && Number.isNaN(baseAmount) ? null : baseAmount,
        commissionAmount:
          commissionAmount !== null && Number.isNaN(commissionAmount) ? null : commissionAmount,
        deductionAmount:
          deductionAmount !== null && Number.isNaN(deductionAmount) ? null : deductionAmount,
        netAmount: netAmount !== null && Number.isNaN(netAmount) ? null : netAmount,
        note,
        errors,
        matchedUserId: matched?.id ?? null,
        matchedName: matched?.display_name ?? null,
        status: structuralError ? "invalid" : demo ? "demo" : matched ? "ready" : "unmatched",
      } satisfies ImportRow;
    });
  }, [csvText, demo, memberByIdentifier]);

  const readyRows = rows.filter((r) => r.status === "ready");
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const unmatchedCount = rows.filter((r) => r.status === "unmatched").length;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
    setMessage(null);
  }

  function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE_HEADER}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "月度工资导入空表.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport() {
    if (demo || !isSupabaseConfigured()) {
      setMessage("演示模式仅解析预览，不写库。");
      return;
    }
    if (readyRows.length === 0) {
      setMessage("没有可导入的有效且已匹配行。未匹配或校验失败的行会被跳过。");
      return;
    }
    setBusy(true);
    setMessage(null);
    let success = 0;
    const failures: string[] = [];
    try {
      const supabase = createClient();
      for (const row of readyRows) {
        const { error } = await supabase.from("salary_monthly").insert({
          user_id: row.matchedUserId,
          month: row.month,
          scope: row.scope,
          base_amount: row.baseAmount,
          commission_amount: row.commissionAmount,
          deduction_amount: row.deductionAmount,
          net_amount: row.netAmount,
          note: row.note || null,
          published: false,
          created_by: userId,
        });
        if (error) {
          failures.push(`第 ${row.line} 行：${error.message}`);
        } else {
          success += 1;
        }
      }
      setMessage(
        `导入完成：成功 ${success} 行（全部未发布）；跳过未匹配 ${unmatchedCount} 行、校验失败 ${invalidCount} 行` +
          (failures.length ? `；写入失败 ${failures.length} 行：${failures.join("；")}` : "。")
      );
      if (success > 0) router.refresh();
    } catch (err) {
      setMessage(`导入失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="page-desc" style={{ marginBottom: 16 }}>
        粘贴 CSV 或选择 .csv 文件。员工标识可填成员 ID，或成员页显示名（新账号默认显示名为邮箱）；
        导入后一律为<strong>未发布</strong>，员工不可见，核对无误后还需在工资数据中发布。
        {demo ? " 当前为演示模式：只解析预览，不写库。" : ""}
      </p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="salary-import-file">选择 CSV 文件</label>
          <input
            id="salary-import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {fileName ? <div className="access-msg">已读取：{fileName}</div> : null}
        </div>
        <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={downloadTemplate}>
            下载空表模板 CSV
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="salary-import-text">粘贴月度工资 CSV</label>
        <textarea
          id="salary-import-text"
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setMessage(null);
          }}
          rows={7}
          placeholder={`${TEMPLATE_HEADER}\n（从第二行开始填写员工数据）`}
        />
      </div>

      {rows.length > 0 ? (
        <>
          <div className="access-msg" role="status">
            共 {rows.length} 行：可导入 {demo ? 0 : readyRows.length} 行，校验失败 {invalidCount} 行，
            未匹配 {demo ? "演示不校验匹配" : `${unmatchedCount} 行`}
            {demo ? "；演示模式不写库" : ""}。
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="report salary-import-table">
              <thead>
                <tr>
                  <th>行</th>
                  <th style={{ textAlign: "left" }}>员工标识 / 匹配</th>
                  <th>月份</th>
                  <th>门店</th>
                  <th>底薪（元）</th>
                  <th>提成（元）</th>
                  <th>扣款（元）</th>
                  <th>实发（元）</th>
                  <th style={{ textAlign: "left" }}>校验</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={r.status === "invalid" || r.status === "unmatched" ? "import-row-error" : undefined}>
                    <td>{r.line}</td>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                      {r.identifier || "—"}
                      <div className="access-msg">
                        {demo
                          ? "演示预览"
                          : r.matchedUserId
                            ? `已匹配：${r.matchedName ?? r.matchedUserId}`
                            : "未匹配，导入时跳过"}
                      </div>
                    </td>
                    <td>{r.month || "—"}</td>
                    <td>{r.scope ? STORE_LABEL[r.scope] : r.scopeText || "—"}</td>
                    <td>{money2(r.baseAmount)}</td>
                    <td>{money2(r.commissionAmount)}</td>
                    <td>{money2(r.deductionAmount)}</td>
                    <td>{money2(r.netAmount)}</td>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                      {r.errors.length ? (
                        <span className="error">{r.errors.join("；")}</span>
                      ) : r.status === "unmatched" ? (
                        <span className="error">账号未匹配</span>
                      ) : (
                        <span className="tag tag-ok">通过</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn" disabled={busy || demo || readyRows.length === 0} onClick={onImport} style={{ marginTop: 16 }}>
            确认导入（全部未发布）
          </button>
          {demo ? <span className="access-msg" style={{ marginLeft: 12 }}>演示模式不写库</span> : null}
        </>
      ) : (
        <p className="empty">尚无待导入数据。空表模板只有表头，不含任何人员数据。</p>
      )}
      {message ? <div className="access-msg" role="status">{message}</div> : null}
    </div>
  );
}
