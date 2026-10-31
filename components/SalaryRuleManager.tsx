"use client";

import { useState } from "react";
import type { SalaryRule } from "@/lib/data";
import { money2 } from "@/lib/format";
import {
  COMMISSION_RULES_EMPTY,
  salaryRuleClientView,
  type CommissionRuleLine,
} from "@/lib/commission-rules";
import CommissionRuleText from "@/components/CommissionRuleText";
import SalaryRuleVersionPreview from "@/components/SalaryRuleVersionPreview";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";
import { runOptimistic } from "@/lib/optimistic";

/**
 * 工资体系规则配置（指令41，仅老板）：
 * - 真实模式：新增 / 删除直接写 salary_rules（RLS 仅 owner 可写），updated_by 记当前用户；
 * - 演示模式：仅本地状态演示，不落库。
 * 规则结构（岗位/底薪/提成 JSON）是可配置骨架，老板发来正式体系后在此录入。
 * 表格只收 salaryRuleClientView：显示列用短句，原始 commission_rules 不过客户端边界。
 */
type SalaryRuleRow = Omit<SalaryRule, "commission_rules"> & {
  commissionLines: CommissionRuleLine[];
};

export default function SalaryRuleManager({
  initialRules,
  demo,
  userId,
  months = [],
}: {
  initialRules: SalaryRuleRow[];
  demo: boolean;
  userId: string | null;
  months?: string[];
}) {
  const [rules, setRules] = useState<SalaryRuleRow[]>(initialRules);
  // 指令53 D2：双版本预览跟随最近编辑生效月的规则（默认第一条），保存后即时翻转。
  const [previewRuleId, setPreviewRuleId] = useState<string | null>(initialRules[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [commissionJson, setCommissionJson] = useState("");
  const [note, setNote] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onEffectiveSaved(id: string, value: string | null) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, effective_from: value } : r)));
    setPreviewRuleId(id);
    setMsg(value ? `生效起始月已设为 ${value}` : "生效起始月已清空（待老板确认）");
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setMsg("请填写岗位 / 职级名称");
      return;
    }
    let commission: Record<string, unknown> = {};
    if (commissionJson.trim()) {
      try {
        const parsed = JSON.parse(commissionJson);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setMsg("提成规则需为 JSON 对象（{ ... }）");
          return;
        }
        commission = parsed as Record<string, unknown>;
      } catch {
        setMsg("提成规则 JSON 格式不正确，请检查");
        return;
      }
    }
    const base = baseSalary.trim() === "" ? null : Number(baseSalary);
    if (base !== null && Number.isNaN(base)) {
      setMsg("底薪需为数字");
      return;
    }
    const eff = effectiveFrom.trim();
    if (eff !== "" && !/^\d{4}-\d{2}$/.test(eff)) {
      setMsg("生效起始月格式应为 YYYY-MM（可留空）");
      return;
    }
    const draft = salaryRuleClientView({
      id: `local-${Date.now()}`,
      title: title.trim(),
      base_salary: base,
      commission_rules: commission,
      note: note.trim() || null,
      effective_from: eff === "" ? null : eff,
      updated_at: new Date().toISOString(),
    });
    if (demo || !isSupabaseConfigured()) {
      setRules([draft, ...rules]);
      setPreviewRuleId(draft.id);
      setMsg("演示：已加入本地列表，未落库");
      setTitle("");
      setBaseSalary("");
      setCommissionJson("");
      setNote("");
      setEffectiveFrom("");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：草稿先入列表并切预览，成功换服务端行，失败撤下（表单保留可重试）
    setBusy(true);
    setMsg(null);
    const okR = await runOptimistic<SalaryRule>({
      apply: () => {
        setRules([draft, ...rules]);
        setPreviewRuleId(draft.id);
      },
      rollback: () => setRules(rules),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { data, error } = await supabase
          .from("salary_rules")
          .insert({
            title: draft.title,
            base_salary: draft.base_salary,
            commission_rules: commission,
            note: draft.note,
            effective_from: draft.effective_from,
            updated_by: userId,
          })
          .select("id, title, base_salary, commission_rules, note, effective_from, updated_at")
          .single();
        return { data: data as SalaryRule | null, error };
      },
      commit: (data) => {
        const row = salaryRuleClientView(data);
        setRules([row, ...rules]);
        setPreviewRuleId(row.id);
      },
      onError: (m) => setMsg(`保存失败，已回滚：${m}`),
    });
    if (okR) {
      setMsg("已保存");
      setTitle("");
      setBaseSalary("");
      setCommissionJson("");
      setNote("");
      setEffectiveFrom("");
    }
    setBusy(false);
  }

  async function onDelete(id: string) {
    if (demo || !isSupabaseConfigured() || id.startsWith("local-")) {
      setRules(rules.filter((r) => r.id !== id));
      setMsg("演示：已从本地列表移除");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先移除，失败回滚
    const snapshot = rules;
    setBusy(true);
    setMsg(null);
    const okD = await runOptimistic<never>({
      apply: () => setRules(rules.filter((r) => r.id !== id)),
      rollback: () => setRules(snapshot),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { error } = await supabase.from("salary_rules").delete().eq("id", id);
        return { data: null, error };
      },
      onError: (m) => setMsg(`删除失败，已回滚：${m}`),
    });
    if (okD) setMsg("已删除");
    setBusy(false);
  }

  const previewEff =
    (rules.find((r) => r.id === previewRuleId) ?? rules[0])?.effective_from ?? null;

  return (
    <div>
      {/* 指令56-3c：双规则确认动线压成一条步骤条——待确认预览 → 填生效月 → 保存 → 预览翻转 → 按双版本回算。 */}
      <ol className="flow-steps" aria-label="工资双规则确认动线">
        <li className={previewEff ? "done" : "current"}>
          1 看双版本预览（{previewEff ? `生效起始月 ${previewEff}` : "当前待确认"}）
        </li>
        <li>2 在规则行填生效起始月</li>
        <li>3 点保存</li>
        <li>4 预览逐月翻转（生效月带「生效月」高亮）</li>
        <li>5 历史按双版本回算</li>
      </ol>
      <div className="access-msg" style={{ marginBottom: 14 }}>
        历史双版本按生效起始月切换：新规则自生效月起算，之前月份按旧规则回算。
      </div>
      {rules.length === 0 ? (
        <p className="empty">暂无工资规则：使用下方表单新增，保存后即在此列示。</p>
      ) : (
        <div className="table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>岗位 / 职级</th>
                <th>底薪（元）</th>
                <th style={{ textAlign: "left" }}>提成规则</th>
                <th style={{ textAlign: "left" }}>备注</th>
                <th>生效起始月</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td style={{ textAlign: "left" }}>{r.title}</td>
                  <td>{r.base_salary === null ? "待定" : money2(r.base_salary)}</td>
                  <td className="commission-cell">
                    <CommissionRulesCell lines={r.commissionLines} />
                  </td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.note ?? "—"}</td>
                  <td>
                    <EffectiveFromEditor rule={r} demo={demo} onSaved={onEffectiveSaved} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onDelete(r.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SalaryRuleVersionPreview
        rule={rules.find((r) => r.id === previewRuleId) ?? rules[0] ?? null}
        months={months}
      />

      <form onSubmit={onAdd} style={{ marginTop: 20 }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="sr-title">岗位 / 职级</label>
            <input id="sr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：店长 / 高级业务员" />
          </div>
          <div className="field">
            <label htmlFor="sr-base">底薪（元，可空）</label>
            <input id="sr-base" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} inputMode="decimal" placeholder="请输入金额" />
          </div>
          <div className="field">
            <label htmlFor="sr-eff">生效起始月（<span className="en">YYYY-MM</span>，可空）</label>
            <input id="sr-eff" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} placeholder="待老板补填" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="sr-json">
            提成规则（<span className="en">JSON</span>，可空）
          </label>
          <textarea
            id="sr-json"
            value={commissionJson}
            onChange={(e) => setCommissionJson(e.target.value)}
            placeholder='如 {"到店分润提成率": 0.05, "上门单提成": 10}'
            rows={3}
          />
        </div>
        <div className="field">
          <label htmlFor="sr-note">备注（可空）</label>
          <input id="sr-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={busy}>
          新增规则
        </button>
        {msg ? <div className="access-msg">{msg}</div> : null}
      </form>
    </div>
  );
}

/**
 * 「提成规则」列：只渲染已经格式化的短句。
 * 空 / 无法解析显示「暂无提成细则」；未知键只留一行降色说明，不输出 JSON。
 */
function CommissionRulesCell({ lines }: { lines: CommissionRuleLine[] }) {
  if (lines.length === 0) {
    return <span style={{ color: "var(--muted)" }}>{COMMISSION_RULES_EMPTY}</span>;
  }
  return (
    <div className="commission-lines">
      {lines.map((line) => (
        <div key={line.id}>
          <CommissionRuleText line={line} />
        </div>
      ))}
    </div>
  );
}

/**
 * 生效起始月行内编辑（指令42）：老板可直接在规则行上改 effective_from。
 * 格式 YYYY-MM，清空 = 置空（待老板确认）；真实模式写 salary_rules，演示/本地行只改本地状态。
 * 补填后「工资怎么算」规则卡即显示该月，并支持新旧双版本规则按月回算。
 */
function EffectiveFromEditor({
  rule,
  demo,
  onSaved,
}: {
  rule: SalaryRuleRow;
  demo: boolean;
  onSaved: (id: string, value: string | null) => void;
}) {
  const [value, setValue] = useState(rule.effective_from ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSave() {
    const v = value.trim();
    if (v !== "" && !/^\d{4}-\d{2}$/.test(v)) {
      setErr("格式应为 YYYY-MM");
      return;
    }
    const next = v === "" ? null : v;
    if (demo || !isSupabaseConfigured() || rule.id.startsWith("local-") || rule.id.startsWith("fallback-")) {
      onSaved(rule.id, next);
      setErr(null);
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先回写上层状态（预览即时翻转），失败恢复原值并报错
    setSaving(true);
    setErr(null);
    await runOptimistic<never>({
      apply: () => onSaved(rule.id, next),
      rollback: () => {
        onSaved(rule.id, rule.effective_from);
        setValue(rule.effective_from ?? "");
      },
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { error } = await supabase
          .from("salary_rules")
          .update({ effective_from: next })
          .eq("id", rule.id);
        return { data: null, error };
      },
      onError: (m) => setErr(`保存失败，已回滚：${m}`),
    });
    setSaving(false);
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <input
        className="inline-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="待确认"
        aria-label={`「${rule.title}」生效起始月`}
      />
      <button type="button" className="btn btn-ghost" disabled={saving} onClick={onSave}>
        保存
      </button>
      {err ? <span className="access-msg">{err}</span> : null}
    </span>
  );
}
