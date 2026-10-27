"use client";

import { useState } from "react";
import type { StoreCost } from "@/lib/data";
import { STORE_LABEL, COST_TYPE_LABEL, type StoreScope, type CostType } from "@/lib/stores";
import { money2 } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { runOptimistic } from "@/lib/optimistic";

/**
 * 门店成本管理（指令41，仅老板可写）：
 * - 真实模式：新增 / 编辑 / 删除直接写 store_costs（RLS 仅 owner 可写）；
 *   同门店同月份同类型唯一，重复录入会提示已存在、请用编辑。
 * - 演示模式：仅本地状态演示，不落库。
 */
export default function StoreCostManager({
  initialCosts,
  demo,
  userId,
}: {
  initialCosts: StoreCost[];
  demo: boolean;
  userId: string | null;
}) {
  const [costs, setCosts] = useState<StoreCost[]>(initialCosts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scope, setScope] = useState<StoreScope>("wanda");
  const [month, setMonth] = useState("");
  const [costType, setCostType] = useState<CostType>("rent");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 指令53 D5：电费实报快捷录入（cost_type='utilities'，与通用表单同表同口径）。
  // 同门店同月份已有电费行时走更新（编辑既有行），不重复新增；万达备注预填智能电表提示。
  // 指令71 A4：默认带上次值——以最近一笔已录电费（月份最大、并列取 updated_at 最新）的
  // 门店+月份预填，老板打开即接着上次录；无任何电费行时维持万达+空月默认。
  const lastUtility = [...initialCosts]
    .filter((c) => c.cost_type === "utilities")
    .sort((a, b) => b.month.localeCompare(a.month) || b.updated_at.localeCompare(a.updated_at))[0];
  const [uScope, setUScope] = useState<StoreScope>(lastUtility?.scope ?? "wanda");
  const [uMonth, setUMonth] = useState(lastUtility?.month ?? "");
  const [uAmount, setUAmount] = useState("");
  const [uNote, setUNote] = useState(
    lastUtility?.scope === "friendship" ? "" : "智能电表自记、按实预付"
  );
  const [uMsg, setUMsg] = useState<string | null>(null);
  const [uBusy, setUBusy] = useState(false);
  // 指令56-3b：行内校验错误（挂在对应字段下方，报错不提交）+ 选中门店/月份的录入状态提示。
  const [uErrMonth, setUErrMonth] = useState<string | null>(null);
  const [uErrAmt, setUErrAmt] = useState<string | null>(null);

  // 指令56-3b：当前所选门店+月份的电费录入状态（空态/已录入提示与提交时的既有行判定同源）。
  const uMonthValid = /^\d{4}-\d{2}$/.test(uMonth);
  const uExisting = uMonthValid
    ? costs.find((c) => c.scope === uScope && c.month === uMonth && c.cost_type === "utilities")
    : undefined;

  // 指令71 A4：所选门店成本月份跨度内尚无电费行的月份（点选即填，少一次手选）；
  // 跨度取该店已有成本行的最早~最晚月，至多列最早 8 个。
  const uMissingMonths = (() => {
    const span = costs.filter((c) => c.scope === uScope).map((c) => c.month).sort();
    if (span.length === 0) return [];
    const have = new Set(
      costs.filter((c) => c.scope === uScope && c.cost_type === "utilities").map((c) => c.month)
    );
    const out: string[] = [];
    let cur = span[0];
    const last = span[span.length - 1];
    while (cur <= last && out.length < 8) {
      if (!have.has(cur)) out.push(cur);
      const [y, m] = cur.split("-").map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
    return out;
  })();

  function onUScopeChange(s: StoreScope) {
    setUScope(s);
    // 备注未被老板改过时才跟随门店预填：万达=智能电表提示，友谊=空。
    if (uNote === "" || uNote === "智能电表自记、按实预付") {
      setUNote(s === "wanda" ? "智能电表自记、按实预付" : "");
    }
  }

  async function onUtilitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setUErrMonth(null);
    setUErrAmt(null);
    if (!/^\d{4}-\d{2}$/.test(uMonth)) {
      setUErrMonth("请选择月份（格式 YYYY-MM）");
      return;
    }
    const amt = Number(uAmount);
    if (uAmount.trim() === "" || Number.isNaN(amt)) {
      setUErrAmt("金额为空或不是数字：按电表实际金额填，不估算；未取得就先不录");
      return;
    }
    const existing = costs.find(
      (c) => c.scope === uScope && c.month === uMonth && c.cost_type === "utilities"
    );
    const noteVal = uNote.trim() || null;
    if (demo || !isSupabaseConfigured()) {
      if (existing) {
        setCosts(
          costs.map((c) =>
            c.id === existing.id
              ? { ...c, amount: amt, note: noteVal, updated_at: new Date().toISOString() }
              : c
          )
        );
        setUMsg("演示：该月电费已存在，已本地更新既有行，未落库");
      } else {
        setCosts([
          {
            id: `local-${Date.now()}`,
            scope: uScope,
            month: uMonth,
            cost_type: "utilities" as CostType,
            amount: amt,
            note: noteVal,
            updated_at: new Date().toISOString(),
          },
          ...costs,
        ]);
        setUMsg("演示：电费已加入本地列表，未落库");
      }
      setUAmount("");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先改 UI，成功以服务端行校准，失败回滚
    const snapshot = costs;
    const tempId = `temp-${Date.now()}`;
    setUBusy(true);
    setUMsg(null);
    const okU = await runOptimistic<StoreCost>({
      apply: () => {
        if (existing) {
          setCosts((prev) => prev.map((c) => (c.id === existing.id ? { ...c, amount: amt, note: noteVal, updated_at: new Date().toISOString() } : c)));
        } else {
          setCosts((prev) => [
            { id: tempId, scope: uScope, month: uMonth, cost_type: "utilities" as CostType, amount: amt, note: noteVal, updated_at: new Date().toISOString() },
            ...prev,
          ]);
        }
      },
      rollback: () => setCosts(snapshot),
      request: async () => {
        const supabase = createClient();
        const { data, error } = existing
          ? await supabase.from("store_costs").update({ amount: amt, note: noteVal, updated_at: new Date().toISOString() }).eq("id", existing.id).select("*").single()
          : await supabase.from("store_costs").insert({ scope: uScope, month: uMonth, cost_type: "utilities", amount: amt, note: noteVal, created_by: userId }).select("*").single();
        return { data: data as StoreCost | null, error };
      },
      commit: (data) => setCosts((prev) => prev.map((c) => (c.id === (existing?.id ?? tempId) ? data : c))),
      onError: (m, raw) =>
        setUMsg(
          m.includes("duplicate") || (raw as { code?: string } | undefined)?.code === "23505"
            ? "该门店该月份电费已存在，请重新提交以更新既有行"
            : `保存失败，已回滚：${m}`
        ),
    });
    if (okU) {
      setUMsg(existing ? "该月电费已存在，已更新既有行" : "电费已录入，将进入净利与花费拆解核算");
      setUAmount("");
    }
    setUBusy(false);
  }

  function resetForm() {
    setEditingId(null);
    setMonth("");
    setAmount("");
    setNote("");
    setCostType("rent");
    setScope("wanda");
  }

  function startEdit(c: StoreCost) {
    setEditingId(c.id);
    setScope(c.scope);
    setMonth(c.month);
    setCostType(c.cost_type);
    setAmount(String(c.amount));
    setNote(c.note ?? "");
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setMsg("请填写月份（格式 2026-09）");
      return;
    }
    const amt = Number(amount);
    if (amount.trim() === "" || Number.isNaN(amt)) {
      setMsg("金额需为数字");
      return;
    }
    const payload = {
      scope,
      month,
      cost_type: costType,
      amount: amt,
      note: note.trim() || null,
    };
    if (demo || !isSupabaseConfigured()) {
      if (editingId) {
        setCosts(
          costs.map((c) =>
            c.id === editingId ? { ...c, ...payload, updated_at: new Date().toISOString() } : c
          )
        );
        setMsg("演示：已本地更新，未落库");
      } else {
        const dup = costs.find(
          (c) => c.scope === scope && c.month === month && c.cost_type === costType
        );
        if (dup) {
          setMsg("该门店该月份该类型已存在，请用编辑修改");
          return;
        }
        setCosts([
          { id: `local-${Date.now()}`, ...payload, updated_at: new Date().toISOString() },
          ...costs,
        ]);
        setMsg("演示：已加入本地列表，未落库");
      }
      resetForm();
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先改 UI，成功以服务端行校准，失败回滚
    const snapshot = costs;
    const tempId = `temp-${Date.now()}`;
    setBusy(true);
    setMsg(null);
    const okC = await runOptimistic<StoreCost>({
      apply: () => {
        if (editingId) {
          setCosts((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...payload, updated_at: new Date().toISOString() } : c)));
        } else {
          setCosts((prev) => [{ id: tempId, ...payload, updated_at: new Date().toISOString() }, ...prev]);
        }
      },
      rollback: () => setCosts(snapshot),
      request: async () => {
        const supabase = createClient();
        const { data, error } = editingId
          ? await supabase.from("store_costs").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId).select("*").single()
          : await supabase.from("store_costs").insert({ ...payload, created_by: userId }).select("*").single();
        return { data: data as StoreCost | null, error };
      },
      commit: (data) => setCosts((prev) => prev.map((c) => (c.id === (editingId ?? tempId) ? data : c))),
      onError: (m, raw) =>
        setMsg(
          m.includes("duplicate") || (raw as { code?: string } | undefined)?.code === "23505"
            ? "该门店该月份该类型已存在，请用编辑修改"
            : `保存失败，已回滚：${m}`
        ),
    });
    if (okC) {
      setMsg("已保存");
      resetForm();
    }
    setBusy(false);
  }

  async function onDelete(id: string) {
    if (demo || !isSupabaseConfigured() || id.startsWith("local-")) {
      setCosts(costs.filter((c) => c.id !== id));
      setMsg("演示：已从本地列表移除");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先移除，失败回滚
    const snapshot = costs;
    setBusy(true);
    setMsg(null);
    const okD = await runOptimistic<never>({
      apply: () => setCosts((prev) => prev.filter((c) => c.id !== id)),
      rollback: () => setCosts(snapshot),
      request: async () => {
        const supabase = createClient();
        const { error } = await supabase.from("store_costs").delete().eq("id", id);
        return { data: null, error };
      },
      onError: (m) => setMsg(`删除失败，已回滚：${m}`),
    });
    if (okD) setMsg("已删除");
    setBusy(false);
  }

  return (
    <div>
      {/* 指令53 D5：电费实报快捷区——按月按实际金额录入，未录入的月份不计入净利（脚注标明未取得）。 */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18, marginBottom: 22 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>电费实报</h3>
        <p className="page-desc" style={{ margin: "0 0 12px" }}>
          按门店 + 月份录入实际电费（万达智能电表自记、按实预付；友谊如有电费单据同样按实录入）。
          同门店同月份重复提交会更新既有行；未录入的月份按「未取得，未计入」处理，不估算。
          表单默认带上次录入的门店与月份，下方会列出该门店尚未录入的月份，点选即可填入。
        </p>
        <form onSubmit={onUtilitySubmit}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="uc-scope">门店</label>
              <select id="uc-scope" value={uScope} onChange={(e) => onUScopeChange(e.target.value as StoreScope)}>
                <option value="wanda">{STORE_LABEL.wanda}</option>
                <option value="friendship">{STORE_LABEL.friendship}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="uc-month">月份</label>
              <input
                id="uc-month"
                type="month"
                value={uMonth}
                aria-invalid={uErrMonth ? true : undefined}
                onChange={(e) => {
                  setUMonth(e.target.value);
                  setUErrMonth(null);
                }}
              />
              {uErrMonth ? (
                <div className="form-error" role="alert">{uErrMonth}</div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="uc-amount">电费金额（元）</label>
              <input
                id="uc-amount"
                value={uAmount}
                aria-invalid={uErrAmt ? true : undefined}
                onChange={(e) => {
                  setUAmount(e.target.value);
                  setUErrAmt(null);
                }}
                inputMode="decimal"
                placeholder="按实际金额填"
              />
              {uErrAmt ? (
                <div className="form-error" role="alert">{uErrAmt}</div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="uc-note">备注</label>
              <input id="uc-note" value={uNote} onChange={(e) => setUNote(e.target.value)} placeholder="如：智能电表自记、按实预付" />
            </div>
          </div>
          {uMonthValid ? (
            <div className="access-msg" style={{ margin: "0 0 10px" }}>
              {uExisting
                ? `${STORE_LABEL[uScope]} ${uMonth} 已有电费 ${money2(uExisting.amount)} 元，本次提交将更新既有行。`
                : `${STORE_LABEL[uScope]} ${uMonth} 电费尚未录入——未取得，未计入；录入后进入净利与花费拆解。`}
            </div>
          ) : null}
          {uMissingMonths.length > 0 ? (
            <div className="access-msg" style={{ margin: "0 0 10px" }}>
              {STORE_LABEL[uScope]}未录电费月份：
              {uMissingMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginLeft: 6 }}
                  onClick={() => {
                    setUMonth(m);
                    setUErrMonth(null);
                  }}
                >
                  {m}
                </button>
              ))}
              （点选即填入上方月份）
            </div>
          ) : null}
          <button type="submit" className="btn" disabled={uBusy}>
            录入电费
          </button>
          {uMsg ? <div className="access-msg">{uMsg}</div> : null}
        </form>
      </div>

      <form onSubmit={onSubmit} style={{ marginBottom: 24 }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="sc-scope">门店</label>
            <select id="sc-scope" value={scope} onChange={(e) => setScope(e.target.value as StoreScope)}>
              <option value="wanda">{STORE_LABEL.wanda}</option>
              <option value="friendship">{STORE_LABEL.friendship}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sc-month">月份</label>
            <input id="sc-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sc-type">成本类型</label>
            <select id="sc-type" value={costType} onChange={(e) => setCostType(e.target.value as CostType)}>
              <option value="rent">{COST_TYPE_LABEL.rent}</option>
              <option value="utilities">{COST_TYPE_LABEL.utilities}</option>
              <option value="other">{COST_TYPE_LABEL.other}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sc-amount">金额（元）</label>
            <input id="sc-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="请输入金额" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="sc-note">备注（可空）</label>
          <input id="sc-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={busy}>
          {editingId ? "保存修改" : "新增成本"}
        </button>
        {editingId ? (
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={resetForm}>
            取消编辑
          </button>
        ) : null}
        {msg ? <div className="access-msg">{msg}</div> : null}
      </form>

      {costs.length === 0 ? (
        <p className="empty">暂无成本记录：使用上方表单录入，保存后即在此列示并进入净利核算。</p>
      ) : (
        <div className="table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>月份</th>
                <th style={{ textAlign: "left" }}>门店</th>
                <th>类型</th>
                <th>金额（元）</th>
                <th style={{ textAlign: "left" }}>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td>{c.month}</td>
                  <td style={{ textAlign: "left" }}>{STORE_LABEL[c.scope]}</td>
                  <td>{COST_TYPE_LABEL[c.cost_type]}</td>
                  <td>{money2(c.amount)}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{c.note ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => startEdit(c)}>
                      编辑
                    </button>{" "}
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onDelete(c.id)}>
                      删除
                    </button>
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
