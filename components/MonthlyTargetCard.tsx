"use client";

import { useState } from "react";
import type { Role, SiteTarget, SiteTargetMetric } from "@/lib/data";
import { TARGET_METRIC_LABEL } from "@/lib/targets";
import { money2, int } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export { TARGET_METRIC_LABEL };

export interface TargetActuals {
  month: string;
  profit: number | null;
  orders: number | null;
  net: number | null;
}

/**
 * 指令46 B8：月度目标 vs 实际。
 * 目标存 site_targets（老板写、其余只读）；未设定显示「未设定」，不预填任何数字。
 * 净利实际仅完整口径月份有值，其余月份净利目标行显示「实际待核算」。
 */
export default function MonthlyTargetCard({
  initialTargets,
  actuals,
  role,
  demo,
  userId,
}: {
  initialTargets: SiteTarget[];
  actuals: TargetActuals[];
  role: Role;
  demo: boolean;
  userId: string | null;
}) {
  const [targets, setTargets] = useState<SiteTarget[]>(initialTargets);
  const [formOpen, setFormOpen] = useState(false);
  const [month, setMonth] = useState(actuals[actuals.length - 1]?.month ?? "");
  const [metric, setMetric] = useState<SiteTargetMetric>("profit");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = role === "owner";

  const actualOf = (t: SiteTarget): number | null => {
    const a = actuals.find((x) => x.month === t.month);
    if (!a) return null;
    return t.metric === "profit" ? a.profit : t.metric === "orders" ? a.orders : a.net;
  };
  const fmt = (t: SiteTarget, v: number | null) =>
    v === null ? null : t.metric === "orders" ? int(v) : `${money2(v)} 元`;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setMsg("请选择月份");
      return;
    }
    const v = Number(value);
    if (value.trim() === "" || !Number.isFinite(v)) {
      setMsg("目标值须为数字");
      return;
    }
    const now = new Date().toISOString();
    if (demo || !isSupabaseConfigured()) {
      setTargets((prev) => {
        const rest = prev.filter((t) => !(t.month === month && t.metric === metric));
        return [
          ...rest,
          { id: `local-${month}-${metric}`, month, metric, target_value: v, note: null, updated_at: now },
        ].sort((a, b) => a.month.localeCompare(b.month));
      });
      setMsg(demo ? "演示：已本地保存目标，未写库" : "已本地保存目标");
      setValue("");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("site_targets")
        .upsert(
          { month, metric, target_value: v, updated_by: userId, updated_at: now },
          { onConflict: "month,metric" }
        )
        .select("*")
        .single();
      if (error) setMsg(`保存失败：${error.message}`);
      else if (data) {
        setTargets((prev) => {
          const rest = prev.filter((t) => !(t.month === month && t.metric === metric));
          return [...rest, data as SiteTarget].sort((a, b) => a.month.localeCompare(b.month));
        });
        setMsg("目标已保存");
        setValue("");
      }
    } catch (err) {
      setMsg(`保存失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      {targets.length === 0 ? (
        /* 指令51：未设定时只占一行 CTA，点开才出表单，不让空表单占满首屏 */
        <div className="target-cta-row">
          <span className="empty" style={{ padding: 0 }}>
            月度目标未设定{isOwner ? "" : "（老板设定后显示）"}
          </span>
          {isOwner ? (
            <button type="button" className="btn btn-ghost" onClick={() => setFormOpen((v) => !v)}>
              设定本月目标
            </button>
          ) : null}
        </div>
      ) : (
        /* 已设定：紧凑进度行（目标 / 实际 / 达成率一行 + 细进度条） */
        <div className="target-rows">
          {targets.map((t) => {
            const actual = actualOf(t);
            const rate =
              actual === null || t.target_value === 0 ? null : (actual / t.target_value) * 100;
            return (
              <div key={`${t.month}-${t.metric}`} className="target-row">
                <div className="target-row-head">
                  <span>
                    {t.month} · {TARGET_METRIC_LABEL[t.metric]}
                  </span>
                  <span>
                    目标 <strong>{fmt(t, t.target_value)}</strong> · 实际{" "}
                    <strong>{actual === null ? "待核算" : fmt(t, actual)}</strong> · 达成率{" "}
                    <strong>{rate === null ? "—" : `${rate.toFixed(1)}%`}</strong>
                  </span>
                </div>
                {rate !== null ? (
                  <div className="target-bar">
                    <div
                      className="target-bar-fill"
                      style={{ width: `${Math.max(0, Math.min(100, rate))}%` }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {/* 指令56-4：已设定时表单默认收起（点「调整目标」展开），首屏只留紧凑进度，与未设态一行 CTA 同一层级。 */}
      {isOwner && targets.length > 0 && !formOpen ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(true)}>
            调整目标
          </button>
        </div>
      ) : null}
      {isOwner && formOpen ? (
        <form onSubmit={onSave} style={{ marginTop: 16 }}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="target-month">月份</label>
              <select id="target-month" value={month} onChange={(e) => setMonth(e.target.value)}>
                {actuals.map((a) => (
                  <option key={a.month} value={a.month}>
                    {a.month}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="target-metric">指标</label>
              <select
                id="target-metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as SiteTargetMetric)}
              >
                <option value="profit">当月分润</option>
                <option value="net_profit">公司口径净利</option>
                <option value="orders">当月单量</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="target-value">目标值{metric === "orders" ? "（单）" : "（元）"}</label>
              <input
                id="target-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                placeholder="如：60000"
              />
            </div>
          </div>
          <button type="submit" className="btn" disabled={busy}>
            保存目标
          </button>
          {msg ? (
            <div className="access-msg" role="status">
              {msg}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
