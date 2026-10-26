"use client";

import { useState } from "react";
import type { StoreCost } from "@/lib/data";
import { STORE_LABEL, COST_TYPE_LABEL, type StoreScope, type CostType } from "@/lib/stores";
import { money2 } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

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
  const [uScope, setUScope] = useState<StoreScope>("wanda");
  const [uMonth, setUMonth] = useState("");
  const [uAmount, setUAmount] = useState("");
  const [uNote, setUNote] = useState("智能电表自记、按实预付");
  const [uMsg, setUMsg] = useState<string | null>(null);
  const [uBusy, setUBusy] = useState(false);

  function onUScopeChange(s: StoreScope) {
    setUScope(s);
    // 备注未被老板改过时才跟随门店预填：万达=智能电表提示，友谊=空。
    if (uNote === "" || uNote === "智能电表自记、按实预付") {
      setUNote(s === "wanda" ? "智能电表自记、按实预付" : "");
    }
  }

  async function onUtilitySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(uMonth)) {
      setUMsg("请填写月份（格式 2026-09）");
      return;
    }
    const amt = Number(uAmount);
    if (uAmount.trim() === "" || Number.isNaN(amt)) {
      setUMsg("金额需为数字（按电表实际读数 / 预付金额填，不估算）");
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
    setUBusy(true);
    setUMsg(null);
    try {
      const supabase = createClient();
      if (existing) {
        const { data, error } = await supabase
          .from("store_costs")
          .update({ amount: amt, note: noteVal, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) {
          setUMsg(`保存失败：${error.message}`);
        } else {
          setCosts(costs.map((c) => (c.id === existing.id ? (data as StoreCost) : c)));
          setUMsg("该月电费已存在，已更新既有行");
          setUAmount("");
        }
      } else {
        const { data, error } = await supabase
          .from("store_costs")
          .insert({
            scope: uScope,
            month: uMonth,
            cost_type: "utilities",
            amount: amt,
            note: noteVal,
            created_by: userId,
          })
          .select("*")
          .single();
        if (error) {
          setUMsg(
            error.message.includes("duplicate") || error.code === "23505"
              ? "该门店该月份电费已存在，请重新提交以更新既有行"
              : `保存失败：${error.message}`
          );
        } else {
          setCosts([data as StoreCost, ...costs]);
          setUMsg("电费已录入，将进入净利与花费拆解核算");
          setUAmount("");
        }
      }
    } catch (err) {
      setUMsg(`保存失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setUBusy(false);
    }
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
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      if (editingId) {
        const { data, error } = await supabase
          .from("store_costs")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingId)
          .select("*")
          .single();
        if (error) {
          setMsg(`保存失败：${error.message}`);
        } else {
          setCosts(costs.map((c) => (c.id === editingId ? (data as StoreCost) : c)));
          setMsg("已保存");
          resetForm();
        }
      } else {
        const { data, error } = await supabase
          .from("store_costs")
          .insert({ ...payload, created_by: userId })
          .select("*")
          .single();
        if (error) {
          setMsg(
            error.message.includes("duplicate") || error.code === "23505"
              ? "该门店该月份该类型已存在，请用编辑修改"
              : `保存失败：${error.message}`
          );
        } else {
          setCosts([data as StoreCost, ...costs]);
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

  async function onDelete(id: string) {
    if (demo || !isSupabaseConfigured() || id.startsWith("local-")) {
      setCosts(costs.filter((c) => c.id !== id));
      setMsg("演示：已从本地列表移除");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("store_costs").delete().eq("id", id);
      if (error) {
        setMsg(`删除失败：${error.message}`);
      } else {
        setCosts(costs.filter((c) => c.id !== id));
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
      {/* 指令53 D5：电费实报快捷区——按月按实际金额录入，未录入的月份不计入净利（脚注标明未取得）。 */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18, marginBottom: 22 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>电费实报</h3>
        <p className="page-desc" style={{ margin: "0 0 12px" }}>
          按门店 + 月份录入实际电费（万达智能电表自记、按实预付；友谊如有电费单据同样按实录入）。
          同门店同月份重复提交会更新既有行；未录入的月份按「未取得，未计入」处理，不估算。
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
              <input id="uc-month" type="month" value={uMonth} onChange={(e) => setUMonth(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="uc-amount">电费金额（元）</label>
              <input id="uc-amount" value={uAmount} onChange={(e) => setUAmount(e.target.value)} inputMode="decimal" placeholder="按实际金额填" />
            </div>
            <div className="field">
              <label htmlFor="uc-note">备注</label>
              <input id="uc-note" value={uNote} onChange={(e) => setUNote(e.target.value)} placeholder="如：智能电表自记、按实预付" />
            </div>
          </div>
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
            <input id="sc-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="待老板提供" />
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
        <p className="empty">待老板提供成本数字后录入：上方表单先行就位，录入后即在此列示并进入净利核算。</p>
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
