"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseClaim, Role } from "@/lib/data";
import { EXPENSE_SCOPE_LABEL, isOverdueUnreimbursed, EXPENSE_OVERDUE_DAYS, type ExpenseScope, type ExpenseStatus } from "@/lib/expenses";
import { money2 } from "@/lib/format";
import { downloadExcel } from "@/lib/excel";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";
import { runOptimistic } from "@/lib/optimistic";

const DEMO_OWN_ID = "demo-current-user";

/** 超期判定统一走 lib/expenses 的 isOverdueUnreimbursed（与顶栏超期计数同源）。 */
const OVERDUE_DAYS = EXPENSE_OVERDUE_DAYS;

function isOverdueClaim(claim: ExpenseClaim): boolean {
  return isOverdueUnreimbursed(claim.claim_date, claim.status);
}

function localMode(claim: ExpenseClaim | null, demo: boolean): boolean {
  return demo || !isSupabaseConfigured() || !claim || claim.id.startsWith("local-") || claim.id.startsWith("demo-");
}

export default function ExpenseManager({
  initialClaims,
  demo,
  role,
  userId,
  claimantName,
  initialStatusFilter = "all",
}: {
  initialClaims: ExpenseClaim[];
  demo: boolean;
  role: Role;
  userId: string | null;
  claimantName: string | null;
  /** 指令55-3：总览提醒条直达时初始状态筛选（?status=unreimbursed）。 */
  initialStatusFilter?: "all" | ExpenseStatus;
}) {
  const currentUserKey = userId ?? DEMO_OWN_ID;
  const router = useRouter();
  const [claims, setClaims] = useState<ExpenseClaim[]>(() => {
    if (demo && role === "staff" && initialClaims.length === 0) {
      return [
        {
          id: "demo-expense-own",
          claim_date: "2026-10-08",
          title: "示例·店内采购",
          category: "采购",
          amount: 86,
          scope: "wanda",
          claimant_name: claimantName ?? "演示店员",
          status: "unreimbursed",
          reimbursed_at: null,
          note: "演示样例，仅本人可见",
          created_by: DEMO_OWN_ID,
          created_at: "2026-10-08T00:00:00+08:00",
          updated_at: "2026-10-08T00:00:00+08:00",
        },
      ];
    }
    return initialClaims;
  });
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ExpenseStatus>(initialStatusFilter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [claimDate, setClaimDate] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("其他");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState<ExpenseScope>("company");
  const [claimant, setClaimant] = useState(claimantName ?? "");
  const [status, setStatus] = useState<ExpenseStatus>("unreimbursed");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const months = useMemo(
    () => [...new Set(claims.map((c) => c.claim_date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)),
    [claims]
  );
  // 指令52-3：月份 + 状态双筛选，列表、分类统计、汇总小计与导出共用同一可见范围。
  const visibleClaims = useMemo(
    () =>
      claims.filter(
        (c) =>
          (monthFilter === "all" || c.claim_date.startsWith(monthFilter)) &&
          (statusFilter === "all" || c.status === statusFilter)
      ),
    [claims, monthFilter, statusFilter]
  );
  const visibleTotals = useMemo(
    () => ({
      total: visibleClaims.reduce((s, c) => s + Number(c.amount ?? 0), 0),
      reimbursed: visibleClaims
        .filter((c) => c.status === "reimbursed")
        .reduce((s, c) => s + Number(c.amount ?? 0), 0),
      unreimbursed: visibleClaims
        .filter((c) => c.status === "unreimbursed")
        .reduce((s, c) => s + Number(c.amount ?? 0), 0),
    }),
    [visibleClaims]
  );

  // 指令46 B3：分类统计（当前可见范围 + 当前月份筛选）与 CSV 导出。
  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const c of visibleClaims) {
      const key = c.category || "其他";
      const cur = map.get(key) ?? { total: 0, count: 0 };
      cur.total += Number(c.amount ?? 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([category, v]) => ({ category, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total);
  }, [visibleClaims]);
  const categoryMax = categoryStats.reduce((m, s) => Math.max(m, s.total), 0);

  // 指令52-3：CSV / Excel 共用同一导出行（当前筛选范围）；文件名带月份与状态。
  const EXPORT_HEADERS = ["日期", "事由", "类别", "金额（元）", "归属", "报销人", "状态", "备注"];
  const exportRows = () =>
    visibleClaims.map((c) => [
      c.claim_date,
      c.title,
      c.category || "其他",
      Number(c.amount ?? 0).toFixed(2),
      c.scope ? EXPENSE_SCOPE_LABEL[c.scope] : "",
      c.claimant_name ?? "",
      c.status === "reimbursed" ? "已报销" : "未报销",
      c.note ?? "",
    ]);
  const exportBaseName = () =>
    `报销台账_${monthFilter === "all" ? "全部月份" : monthFilter}_${
      statusFilter === "all" ? "全部状态" : statusFilter === "reimbursed" ? "已报销" : "未报销"
    }`;

  function exportCsv() {
    const esc = (v: string | number | null | undefined) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      EXPORT_HEADERS.join(","),
      ...exportRows().map((r) => r.map(esc).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportBaseName()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("已导出当前筛选范围的 CSV");
  }

  function exportExcel() {
    downloadExcel(`${exportBaseName()}.xls`, "报销台账", EXPORT_HEADERS, exportRows());
    setMsg("已导出当前筛选范围的 Excel（.xls）");
  }

  function resetForm() {
    setEditingId(null);
    setClaimDate("");
    setTitle("");
    setCategory("其他");
    setAmount("");
    setScope("company");
    setClaimant(claimantName ?? "");
    setStatus("unreimbursed");
    setNote("");
  }

  function startEdit(claim: ExpenseClaim) {
    setEditingId(claim.id);
    setClaimDate(claim.claim_date);
    setTitle(claim.title);
    setCategory(claim.category || "其他");
    setAmount(String(claim.amount));
    setScope(claim.scope ?? "company");
    setClaimant(claim.claimant_name ?? "");
    setStatus(claim.status);
    setNote(claim.note ?? "");
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(claimDate)) {
      setMsg("请选择日期");
      return;
    }
    if (!title.trim()) {
      setMsg("请填写事由");
      return;
    }
    const amt = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(amt)) {
      setMsg("金额须为数字");
      return;
    }
    const now = new Date().toISOString();
    const payload = {
      claim_date: claimDate,
      title: title.trim(),
      category: category.trim() || "其他",
      amount: amt,
      scope,
      claimant_name: claimant.trim() || null,
      status,
      reimbursed_at: status === "reimbursed" ? now : null,
      note: note.trim() || null,
    };

    if (demo || !isSupabaseConfigured()) {
      if (editingId) {
        setClaims((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...payload, updated_at: now } : c))
        );
        setMsg("演示：已本地更新，未写库");
      } else {
        setClaims((prev) => [
          {
            id: `local-${Date.now()}`,
            ...payload,
            created_by: currentUserKey,
            created_at: now,
            updated_at: now,
          },
          ...prev,
        ]);
        setMsg("演示：已加入本地列表，未写库");
      }
      resetForm();
      return;
    }

    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先按 payload 改 UI，成功以服务端行校准，失败回滚
    const snapshot = claims;
    const tempId = `temp-${Date.now()}`;
    setBusy(true);
    setMsg(null);
    const ok = await runOptimistic<ExpenseClaim>({
      apply: () => {
        if (editingId) {
          setClaims((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...payload, updated_at: now } : c)));
        } else {
          setClaims((prev) => [
            { id: tempId, ...payload, created_by: currentUserKey, created_at: now, updated_at: now },
            ...prev,
          ]);
        }
      },
      rollback: () => setClaims(snapshot),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { data, error } = editingId
          ? await supabase.from("expense_claims").update({ ...payload, updated_at: now }).eq("id", editingId).select("*").single()
          : await supabase.from("expense_claims").insert({ ...payload, created_by: userId }).select("*").single();
        return { data: data as ExpenseClaim | null, error };
      },
      commit: (data) =>
        setClaims((prev) => prev.map((c) => (c.id === (editingId ?? tempId) ? data : c))),
      onError: (m) => setMsg(`保存失败，已回滚：${m}`),
    });
    if (ok) {
      setMsg("已保存");
      resetForm();
      // 指令166：顶卡（未报销/已报销/本月花费）为服务端渲染，写成功后刷新使其与列表三面一致
      router.refresh();
    }
    setBusy(false);
  }

  async function toggleStatus(claim: ExpenseClaim) {
    const nextStatus: ExpenseStatus = claim.status === "reimbursed" ? "unreimbursed" : "reimbursed";
    const now = new Date().toISOString();
    const patch = {
      status: nextStatus,
      reimbursed_at: nextStatus === "reimbursed" ? now : null,
      updated_at: now,
    };
    if (localMode(claim, demo)) {
      setClaims((prev) => prev.map((c) => (c.id === claim.id ? { ...c, ...patch } : c)));
      setMsg(demo ? "演示：已本地切换状态，未写库" : "已本地切换状态");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先切换 UI，失败回滚
    const snapshot = claims;
    setBusy(true);
    setMsg(null);
    const ok = await runOptimistic<ExpenseClaim>({
      apply: () => setClaims((prev) => prev.map((c) => (c.id === claim.id ? { ...c, ...patch } : c))),
      rollback: () => setClaims(snapshot),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { data, error } = await supabase
          .from("expense_claims")
          .update(patch)
          .eq("id", claim.id)
          .select("*")
          .single();
        return { data: data as ExpenseClaim | null, error };
      },
      commit: (data) => setClaims((prev) => prev.map((c) => (c.id === claim.id ? data : c))),
      onError: (m) => setMsg(`状态切换失败，已回滚：${m}`),
    });
    if (ok) {
      setMsg("状态已更新");
      router.refresh();
    }
    setBusy(false);
  }

  async function onDelete(claim: ExpenseClaim) {
    if (localMode(claim, demo)) {
      setClaims((prev) => prev.filter((c) => c.id !== claim.id));
      setMsg(demo ? "演示：已从本地列表移除，未写库" : "已从本地列表移除");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先从列表移除，失败回滚
    const snapshot = claims;
    setBusy(true);
    setMsg(null);
    const ok = await runOptimistic<never>({
      apply: () => setClaims((prev) => prev.filter((c) => c.id !== claim.id)),
      rollback: () => setClaims(snapshot),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { error } = await supabase.from("expense_claims").delete().eq("id", claim.id);
        return { data: null, error };
      },
      onError: (m) => setMsg(`删除失败，已回滚：${m}`),
    });
    if (ok) {
      setMsg("已删除");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <form onSubmit={onSubmit} style={{ marginBottom: 24 }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="expense-date">日期</label>
            <input id="expense-date" type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="expense-title">事由</label>
            <input id="expense-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：门店采购" />
          </div>
          <div className="field">
            <label htmlFor="expense-category">类别</label>
            <input id="expense-category" value={category} onChange={(e) => setCategory(e.target.value)} list="expense-categories" />
            <datalist id="expense-categories">
              <option value="差旅" />
              <option value="采购" />
              <option value="物流" />
              <option value="办公" />
              <option value="其他" />
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="expense-amount">金额（元）</label>
            <input id="expense-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="expense-scope">归属</label>
            <select id="expense-scope" value={scope} onChange={(e) => setScope(e.target.value as ExpenseScope)}>
              <option value="company">{EXPENSE_SCOPE_LABEL.company}</option>
              <option value="wanda">{EXPENSE_SCOPE_LABEL.wanda}</option>
              <option value="friendship">{EXPENSE_SCOPE_LABEL.friendship}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="expense-claimant">报销人</label>
            <input id="expense-claimant" value={claimant} onChange={(e) => setClaimant(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="expense-status">状态</label>
            <select id="expense-status" value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)}>
              <option value="unreimbursed">未报销</option>
              <option value="reimbursed">已报销</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="expense-note">备注（可空）</label>
          <input id="expense-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={busy}>{editingId ? "保存修改" : "新建报销"}</button>
        {editingId ? (
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={resetForm}>取消编辑</button>
        ) : null}
        {msg ? <div className="access-msg" role="status">{msg}</div> : null}
      </form>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label htmlFor="expense-month-filter">按月筛选</label>
          <select id="expense-month-filter" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="all">全部月份</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>按状态筛选</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(
              [
                ["all", "全部"],
                ["unreimbursed", "未报销"],
                ["reimbursed", "已报销"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`chip${statusFilter === v ? " chip-active" : ""}`}
                aria-pressed={statusFilter === v}
                onClick={() => setStatusFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="access-msg" style={{ marginTop: 12 }} role="status">
        当前筛选共 {visibleClaims.length} 笔 · 合计 {money2(visibleTotals.total)} 元（未报销{" "}
        {money2(visibleTotals.unreimbursed)} 元 · 已报销 {money2(visibleTotals.reimbursed)} 元）；
        分类统计与导出均按此范围。
      </p>

      {categoryStats.length > 0 ? (
        <div style={{ margin: "18px 0 22px" }}>
          <div className="net-panel-label">
            <span className="en">BY CATEGORY</span> · 分类统计（{monthFilter === "all" ? "全部月份" : monthFilter} · 当前可见范围）
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {categoryStats.map((s) => (
              <div key={s.category} className="cat-row">
                <span>{s.category}</span>
                <span
                  aria-hidden
                  style={{
                    display: "block",
                    height: 10,
                    borderRadius: 5,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${categoryMax > 0 ? Math.max(2, (s.total / categoryMax) * 100) : 0}%`,
                      background: "var(--gold)",
                      borderRadius: 5,
                    }}
                  />
                </span>
                <span className="cat-value">
                  {money2(s.total)} 元 · {s.count} 笔
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" className="btn btn-ghost" onClick={exportCsv}>
              导出 CSV（当前筛选）
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportExcel}>
              导出 Excel（当前筛选）
            </button>
          </div>
        </div>
      ) : null}

      {visibleClaims.length === 0 ? (
        <p className="empty">暂无报销记录。可先用上方表单新建；未报销也计入当月已发生公司花费。</p>
      ) : (
        <div className="table-wrap">
          <table className="report expense-table">
            <thead>
              <tr>
                <th>日期</th>
                <th style={{ textAlign: "left" }}>事由</th>
                <th>类别</th>
                <th>金额（元）</th>
                <th>门店 / 公司</th>
                <th>报销人</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleClaims.map((claim) => (
                <tr key={claim.id}>
                  <td>{claim.claim_date}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                    {claim.title}
                    {claim.note ? <div className="access-msg">{claim.note}</div> : null}
                  </td>
                  <td>{claim.category}</td>
                  <td>{money2(claim.amount)}</td>
                  <td>{claim.scope ? EXPENSE_SCOPE_LABEL[claim.scope] : "—"}</td>
                  <td>{claim.claimant_name ?? (claim.created_by ? "—" : "系统种子")}</td>
                  <td>
                    <span className={`status-badge ${claim.status === "reimbursed" ? "is-done" : "is-pending"}`}>
                      {claim.status === "reimbursed" ? "已报销" : "未报销"}
                    </span>
                    {isOverdueClaim(claim) ? (
                      <>
                        {" "}
                        <span className="status-badge is-overdue" title={`发生日距今超过 ${OVERDUE_DAYS} 天仍未报销`}>
                          超期
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void toggleStatus(claim)}>
                      {claim.status === "reimbursed" ? "改回未报销" : "标为已报销"}
                    </button>{" "}
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => startEdit(claim)}>编辑</button>{" "}
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void onDelete(claim)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
