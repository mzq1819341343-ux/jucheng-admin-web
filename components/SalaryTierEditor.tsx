"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SalaryRule } from "@/lib/data";
import { runOptimistic } from "@/lib/optimistic";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";
import {
  cloneRewards,
  mergeTierRewards,
  parseTierRewards,
  type TierRewardsConfig,
} from "@/lib/tier-rewards";

const STORAGE_KEY = "jucheng-salary-tier-rewards";

type Triple = [string, string, string];

interface TierFormState {
  store: Triple;
  accessories: Triple;
  online: string;
  rankRecycle: Triple;
  rankAccessories: Triple;
}

function tripleText(values: readonly [number, number, number]): Triple {
  return [String(values[0]), String(values[1]), String(values[2])];
}

function formFrom(config: TierRewardsConfig): TierFormState {
  return {
    store: tripleText(config.store_recycle_pct),
    accessories: tripleText(config.accessories_pct),
    online: String(config.online_pct),
    rankRecycle: tripleText(config.rank_recycle),
    rankAccessories: tripleText(config.rank_accessories),
  };
}

function readStored(): TierRewardsConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseTierRewards({ tier_rewards: JSON.parse(raw) });
    return parsed.configured ? parsed.value : null;
  } catch {
    return null;
  }
}

function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseTriple(values: Triple): [number, number, number] | null {
  const nums = values.map(parseAmount);
  if (nums.some((item) => item === null)) return null;
  return [nums[0] as number, nums[1] as number, nums[2] as number];
}

function asRules(value: SalaryRule["commission_rules"] | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

/**
 * 阶梯提成与排名奖励。老板写入现行 salary_rules.commission_rules；
 * 演示或未配置时写在本机会话里，刷新仍能读回。其它角色只读。
 */
export default function SalaryTierEditor({
  rule,
  canEdit,
  demo,
  userId,
}: {
  rule: SalaryRule | null;
  canEdit: boolean;
  demo: boolean;
  userId: string | null;
}) {
  const router = useRouter();
  const initial = parseTierRewards(rule?.commission_rules);
  const [form, setForm] = useState<TierFormState>(() => formFrom(initial.value));
  const [ruleId, setRuleId] = useState<string | null>(rule?.id ?? null);
  const [rulesObject, setRulesObject] = useState<Record<string, unknown>>(() => asRules(rule?.commission_rules));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!demo || initial.configured) return;
    const stored = readStored();
    if (!stored) return;
    setForm(formFrom(stored));
  }, [demo, initial.configured]);

  function setTriple(key: "store" | "accessories" | "rankRecycle" | "rankAccessories", index: 0 | 1 | 2, value: string) {
    setForm((prev) => {
      const next = [...prev[key]] as Triple;
      next[index] = value;
      return { ...prev, [key]: next };
    });
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    const store = parseTriple(form.store);
    const accessories = parseTriple(form.accessories);
    const online = parseAmount(form.online);
    const rankRecycle = parseTriple(form.rankRecycle);
    const rankAccessories = parseTriple(form.rankAccessories);
    if (!store || !accessories || online === null || !rankRecycle || !rankAccessories) {
      setMsg("请填写不小于 0 的数字");
      return;
    }
    const rewards = cloneRewards({
      store_recycle_pct: store,
      accessories_pct: accessories,
      online_pct: online,
      rank_recycle: rankRecycle,
      rank_accessories: rankAccessories,
    });
    const nextRules = mergeTierRewards(rulesObject, rewards);
    const sessionOnly =
      demo ||
      !isSupabaseConfigured() ||
      (ruleId != null && (ruleId.startsWith("fallback-") || ruleId.startsWith("local-")));

    if (sessionOnly) {
      setRulesObject(nextRules);
      setForm(formFrom(rewards));
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rewards));
      } catch {
        // 会话写不进时，当前页状态仍是刚保存的数。
      }
      setMsg("已保存");
      return;
    }

    const savedId = ruleId;
    const snapshotRules = rulesObject;
    const snapshotForm = form;
    setBusy(true);
    setMsg(null);
    const ok = await runOptimistic<SalaryRule>({
      apply: () => {
        setRulesObject(nextRules);
        setForm(formFrom(rewards));
      },
      rollback: () => {
        setRulesObject(snapshotRules);
        setForm(snapshotForm);
      },
      request: async () => {
        const supabase = await createBrowserSupabase();
        const row = {
          commission_rules: nextRules,
          updated_by: userId,
        };
        const query = savedId
          ? supabase.from("salary_rules").update(row).eq("id", savedId)
          : supabase.from("salary_rules").insert({
              title: "工资配置",
              base_salary: null,
              note: null,
              effective_from: null,
              ...row,
            });
        const { data, error } = await query
          .select("id, title, base_salary, commission_rules, note, effective_from, updated_at")
          .single();
        return { data: data as SalaryRule | null, error };
      },
      commit: (data) => {
        setRuleId(data.id);
        setRulesObject(asRules(data.commission_rules));
        setForm(formFrom(parseTierRewards(data.commission_rules).value));
      },
      onError: () => setMsg("保存失败"),
    });
    if (ok) {
      setMsg("已保存");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form className="card salary-tier" onSubmit={onSave}>
      <TierGroup legend="门店回收" name="store" values={form.store} suffix="%" disabled={!canEdit} onChange={setTriple} />
      <TierGroup legend="配件" name="accessories" values={form.accessories} suffix="%" disabled={!canEdit} onChange={setTriple} />
      <section className="salary-tier-block">
        <h3 className="salary-subhead">网单</h3>
        <div className="field">
          <label htmlFor="tier-online">比例（%）</label>
          <input
            id="tier-online"
            value={form.online}
            inputMode="decimal"
            disabled={!canEdit}
            onChange={(event) => setForm((prev) => ({ ...prev, online: event.target.value }))}
          />
        </div>
      </section>
      <section className="salary-tier-block">
        <h3 className="salary-subhead">排名奖励</h3>
        <RankGroup legend="回收" name="rankRecycle" values={form.rankRecycle} disabled={!canEdit} onChange={setTriple} />
        <RankGroup legend="配件" name="rankAccessories" values={form.rankAccessories} disabled={!canEdit} onChange={setTriple} />
      </section>
      {canEdit ? (
        <button type="submit" className="btn" disabled={busy}>
          保存
        </button>
      ) : null}
      {msg ? (
        <p className="salary-meta" role="status">
          {msg}
        </p>
      ) : null}
    </form>
  );
}

function TierGroup({
  legend,
  name,
  values,
  suffix,
  disabled,
  onChange,
}: {
  legend: string;
  name: "store" | "accessories";
  values: Triple;
  suffix: string;
  disabled: boolean;
  onChange: (key: "store" | "accessories", index: 0 | 1 | 2, value: string) => void;
}) {
  const ranks = ["一档", "二档", "三档"] as const;
  return (
    <section className="salary-tier-block">
      <h3 className="salary-subhead">{legend}</h3>
      <div className="salary-tier-grid">
        {ranks.map((label, index) => {
          const id = `tier-${name}-${index}`;
          return (
            <div className="field" key={id}>
              <label htmlFor={id}>
                {label}（{suffix}）
              </label>
              <input
                id={id}
                value={values[index]}
                inputMode="decimal"
                disabled={disabled}
                onChange={(event) => onChange(name, index as 0 | 1 | 2, event.target.value)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RankGroup({
  legend,
  name,
  values,
  disabled,
  onChange,
}: {
  legend: string;
  name: "rankRecycle" | "rankAccessories";
  values: Triple;
  disabled: boolean;
  onChange: (key: "rankRecycle" | "rankAccessories", index: 0 | 1 | 2, value: string) => void;
}) {
  const ranks = ["第一", "第二", "第三"] as const;
  return (
    <div className="salary-tier-block">
      <div className="salary-tier-name">{legend}</div>
      <div className="salary-tier-grid">
        {ranks.map((label, index) => {
          const id = `tier-${name}-${index}`;
          return (
            <div className="field" key={id}>
              <label htmlFor={id}>{label}（元）</label>
              <input
                id={id}
                value={values[index]}
                inputMode="decimal"
                disabled={disabled}
                onChange={(event) => onChange(name, index as 0 | 1 | 2, event.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
