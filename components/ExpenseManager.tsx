"use client";

import { useMemo, useState } from "react";
import type { ExpenseClaim, Role } from "@/lib/data";
import { EXPENSE_SCOPE_LABEL, type ExpenseScope, type ExpenseStatus } from "@/lib/expenses";
import { money2 } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const DEMO_OWN_ID = "demo-current-user";

function localMode(claim: ExpenseClaim | null, demo: boolean): boolean {
  return demo || !isSupabaseConfigured() || !claim || claim.id.startsWith("local-") || claim.id.startsWith("demo-");
}

export default function ExpenseManager({
  initialClaims,
  demo,
  role,
  userId,
  claimantName,
}: {
  initialClaims: ExpenseClaim[];
  demo: boolean;
  role: Role;
  userId: string | null;
  claimantName: string | null;
}) {
  const currentUserKey = userId ?? DEMO_OWN_ID;
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
  const visibleClaims = useMemo(
    () => (monthFilter === "all" ? claims : claims.filter((c) => c.claim_date.startsWith(monthFilter))),
    [claims, monthFilter]
  );

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

    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      if (editingId) {
        const { data, error } = await supabase
          .from("expense_claims")
          .update({ ...payload, updated_at: now })
          .eq("id", editingId)
          .select("*")
          .single();
        if (error) setMsg(`保存失败：${error.message}`);
        else {
          setClaims((prev) => prev.map((c) => (c.id === editingId ? (data as ExpenseClaim) : c)));
          setMsg("已保存");
          resetForm();
        }
      } else {
        const { data, error } = await supabase
          .from("expense_claims")
          .insert({ ...payload, created_by: userId })
          .select("*")
          .single();
        if (error) setMsg(`保存失败：${error.message}`);
        else {
          setClaims((prev) => [data as ExpenseClaim, ...prev]);
          setMsg("已保存");
          resetForm();
        }
      }
    } catch (err) {
      setMsg(`保存失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expense_claims")
        .update(patch)
        .eq("id", claim.id)
        .select("*")
        .single();
      if (error) setMsg(`状态切换失败：${error.message}`);
      else {
        setClaims((prev) => prev.map((c) => (c.id === claim.id ? (data as ExpenseClaim) : c)));
        setMsg("状态已更新");
      }
    } catch (err) {
      setMsg(`状态切换失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(claim: ExpenseClaim) {
    if (localMode(claim, demo)) {
      setClaims((prev) => prev.filter((c) => c.id !== claim.id));
      setMsg(demo ? "演示：已从本地列表移除，未写库" : "已从本地列表移除");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("expense_claims").delete().eq("id", claim.id);
      if (error) setMsg(`删除失败：${error.message}`);
      else {
        setClaims((prev) => prev.filter((c) => c.id !== claim.id));
        setMsg("已删除");
      }
    } catch (err) {
      setMsg(`删除失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
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

      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="expense-month-filter">按月筛选</label>
        <select id="expense-month-filter" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">全部月份</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

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
