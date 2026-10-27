"use client";

import { useState } from "react";
import { FALLBACK_BUSINESSES } from "@/lib/businesses";
import { runOptimistic } from "@/lib/optimistic";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * 成员业务板块授权勾选（指令33B）：
 * - 真实模式（老板）：勾选即写 user_business_access（受 RLS 约束，仅 owner 可写）；
 *   指令76 起与全站统一走 lib/optimistic 乐观更新（先改勾选、失败回滚并标「已回滚」）；
 * - 演示模式：仅本地状态演示并标注「演示」，不落库。
 * coming_soon 板块灰显不可勾。
 */
export default function BusinessAccessToggles({
  userId,
  initialGranted,
  demo,
}: {
  userId: string;
  initialGranted: string[];
  demo: boolean;
}) {
  const [granted, setGranted] = useState<string[]>(initialGranted);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onToggle(businessId: string, checked: boolean) {
    const next = checked
      ? [...granted, businessId]
      : granted.filter((g) => g !== businessId);
    if (demo || !isSupabaseConfigured()) {
      setGranted(next);
      setMsg("演示：仅本地演示，未落库");
      return;
    }
    setBusy(true);
    setMsg(null);
    const prev = granted;
    const ok = await runOptimistic<null>({
      apply: () => setGranted(next),
      rollback: () => setGranted(prev),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const { error } = checked
          ? await supabase
              .from("user_business_access")
              .insert({ user_id: userId, business_id: businessId })
          : await supabase
              .from("user_business_access")
              .delete()
              .eq("user_id", userId)
              .eq("business_id", businessId);
        return { data: null, error };
      },
      onError: (m) => setMsg(`保存失败，已回滚：${m}`),
    });
    if (ok) setMsg("已保存");
    setBusy(false);
  }

  return (
    <div>
      {FALLBACK_BUSINESSES.map((b) =>
        b.status === "active" ? (
          <label key={b.id} className="access-toggle">
            <input
              type="checkbox"
              checked={granted.includes(b.id)}
              disabled={busy}
              onChange={(e) => onToggle(b.id, e.target.checked)}
            />
            {b.name}（<span className="en">{b.en}</span>）
          </label>
        ) : (
          <span key={b.id} className="access-toggle access-toggle-off">
            <input type="checkbox" disabled checked={false} readOnly aria-label={`${b.name}（即将开放，不可勾）`} />
            {b.name}（即将开放，不可勾）
          </span>
        )
      )}
      {msg ? <div className="access-msg">{msg}</div> : null}
    </div>
  );
}
