"use client";

import { useMemo, useState } from "react";
import { FALLBACK_BUSINESSES } from "@/lib/businesses";
import {
  INVITE_ROLE_LABEL,
  matchInviteByEmail,
  type MemberInvite,
} from "@/lib/invites";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { runOptimistic } from "@/lib/optimistic";

/**
 * 待邀请名单（指令59 A6 一期，仅老板）：
 * - 登记意向：邮箱 + 意向角色（partner/staff，不开放 owner）+ 意向授权 + 备注；
 * - 发邀仍走 Supabase 控制台（本站不持 service-role 密钥，不站内发信）；
 * - 对方注册后，按邮箱匹配到 profile（display_name 默认即注册邮箱）时出现
 *   「一键对齐」：二次确认后写 profiles.role 与 user_business_access，
 *   名单行标 aligned 并留对齐时间/账号作回执；
 * - 演示模式：全程本地状态演示，不落库；真实模式表未建（migration_008
 *   未执行）时父层传 tableReady=false，本组件只显示降级提示不报错。
 */
export default function MemberInvites({
  initialInvites,
  members,
  demo,
  tableReady,
  userId,
}: {
  initialInvites: MemberInvite[];
  members: { id: string; display_name: string | null }[];
  demo: boolean;
  tableReady: boolean;
  userId: string | null;
}) {
  const [invites, setInvites] = useState<MemberInvite[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberInvite["intended_role"]>("staff");
  const [biz, setBiz] = useState<string[]>(["aihuishou"]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const bizName = useMemo(() => {
    const map = new Map(FALLBACK_BUSINESSES.map((b) => [b.id, b.name]));
    return (ids: string[]) => (ids.length ? ids.map((i) => map.get(i) ?? i).join("、") : "无");
  }, []);

  if (!tableReady) {
    return (
      <div className="card">
        <p className="empty">
          待邀请名单尚未启用：请老板在 Supabase 控制台 SQL Editor 执行仓库
          supabase/migration_008_member_invites.sql 后刷新本页。在此之前仍可按本页
          成员区的旧步骤建号与授权。
        </p>
      </div>
    );
  }

  async function addInvite(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      setMsg("邮箱格式不对，请检查后再登记。");
      return;
    }
    if (invites.some((i) => i.status === "pending" && i.email.toLowerCase() === em)) {
      setMsg("该邮箱已有一条待对齐意向，请勿重复登记。");
      return;
    }
    const row: MemberInvite = {
      id: `local-${Date.now()}`,
      email: em,
      intended_role: role,
      intended_businesses: biz,
      note: note.trim() || null,
      status: "pending",
      created_by: userId,
      created_at: new Date().toISOString(),
      aligned_at: null,
      aligned_user_id: null,
    };
    if (demo || !isSupabaseConfigured()) {
      setInvites((xs) => [row, ...xs]);
      setMsg("演示：意向已登记（未落库）。下一步去 Supabase 控制台用该邮箱发邀请。");
      setEmail("");
      setNote("");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：意向行先入列表，成功换服务端行，失败撤下
    setBusy("add");
    setMsg(null);
    const okAdd = await runOptimistic<MemberInvite>({
      apply: () => setInvites((xs) => [row, ...xs]),
      rollback: () => setInvites((xs) => xs.filter((i) => i.id !== row.id)),
      request: async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("member_invites")
          .insert({
            email: row.email,
            intended_role: row.intended_role,
            intended_businesses: row.intended_businesses,
            note: row.note,
            created_by: userId,
          })
          .select("*")
          .single();
        return { data: data as MemberInvite | null, error };
      },
      commit: (data) => setInvites((xs) => xs.map((i) => (i.id === row.id ? data : i))),
      onError: (m) => setMsg(`登记失败，已回滚：${m}`),
    });
    if (okAdd) {
      setMsg("意向已登记。下一步去 Supabase 控制台用该邮箱发邀请，对方设密注册后回本页一键对齐。");
      setEmail("");
      setNote("");
    }
    setBusy(null);
  }

  async function align(invite: MemberInvite) {
    const target = matchInviteByEmail(invite.email, members);
    if (!target) return;
    const ok = window.confirm(
      `确认一键对齐？\n邮箱：${invite.email}\n写入角色：${INVITE_ROLE_LABEL[invite.intended_role]}\n业务授权：${bizName(invite.intended_businesses)}\n（只按邮箱精确匹配的账号对齐，不会改其他人）`
    );
    if (!ok) return;
    if (demo || !isSupabaseConfigured()) {
      setInvites((xs) =>
        xs.map((i) =>
          i.id === invite.id
            ? { ...i, status: "aligned", aligned_at: new Date().toISOString(), aligned_user_id: target.id }
            : i
        )
      );
      setMsg(`演示：已本地对齐 ${invite.email}（未落库）。`);
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：确认后先把名单行标为已对齐，
    // 任一步写库失败回滚名单状态并报错（已成功的先行写入不假装未发生，
    // 错误信息会指明失败步骤，老板可重试对齐）
    const snapshot = invites;
    const optimisticNow = new Date().toISOString();
    setBusy(invite.id);
    setMsg(null);
    const okAlign = await runOptimistic<string>({
      apply: () =>
        setInvites((xs) =>
          xs.map((i) => (i.id === invite.id ? { ...i, status: "aligned", aligned_at: optimisticNow, aligned_user_id: target.id } : i))
        ),
      rollback: () => setInvites(snapshot),
      request: async () => {
        const supabase = createClient();
        const { error: roleErr } = await supabase
          .from("profiles")
          .update({ role: invite.intended_role })
          .eq("id", target.id);
        if (roleErr) throw new Error(`写角色失败：${roleErr.message}`);
        for (const b of invite.intended_businesses) {
          const { error: accErr } = await supabase
            .from("user_business_access")
            .upsert({ user_id: target.id, business_id: b }, { onConflict: "user_id,business_id" });
          if (accErr) throw new Error(`写业务授权失败：${accErr.message}`);
        }
        const now = new Date().toISOString();
        const { error: invErr } = await supabase
          .from("member_invites")
          .update({ status: "aligned", aligned_at: now, aligned_user_id: target.id })
          .eq("id", invite.id);
        if (invErr) throw new Error(`回写名单失败：${invErr.message}`);
        return { data: now, error: null };
      },
      commit: (now) =>
        setInvites((xs) =>
          xs.map((i) => (i.id === invite.id ? { ...i, status: "aligned", aligned_at: now, aligned_user_id: target.id } : i))
        ),
      onError: (m) => setMsg(`对齐失败，名单状态已回滚：${m}`),
    });
    if (okAlign) {
      setMsg(`已对齐：${invite.email} 的角色与业务授权已按意向写入，对方重新打开页面即生效。`);
    }
    setBusy(null);
  }

  async function removeInvite(invite: MemberInvite) {
    if (!window.confirm(`删除这条意向？${invite.email}（只删名单登记，不影响已注册账号）`)) return;
    if (demo || !isSupabaseConfigured()) {
      setInvites((xs) => xs.filter((i) => i.id !== invite.id));
      setMsg("演示：已本地删除（未落库）。");
      return;
    }
    // 指令68-P0-6 乐观更新（骨架走 lib/optimistic）：先移除，失败回滚
    const snapshot = invites;
    setBusy(invite.id);
    await runOptimistic<never>({
      apply: () => setInvites((xs) => xs.filter((i) => i.id !== invite.id)),
      rollback: () => setInvites(snapshot),
      request: async () => {
        const supabase = createClient();
        const { error } = await supabase.from("member_invites").delete().eq("id", invite.id);
        return { data: null, error };
      },
      onError: (m) => setMsg(`删除失败，已回滚：${m}`),
    });
    setBusy(null);
  }

  return (
    <div className="card">
      <p className="page-desc" style={{ marginTop: 0 }}>
        先在这里登记意向，再去 <span className="en">Supabase</span> 控制台{" "}
        <span className="en">Authentication → Users</span> 用同一邮箱发邀请（本站不发信）；
        对方点邮件链接设密注册后，回本页点「一键对齐」按意向写入角色与业务授权。
      </p>
      <form onSubmit={addInvite} style={{ marginBottom: 8 }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="invite-email">邮箱</label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="invite-role">意向角色</label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberInvite["intended_role"])}
            >
              <option value="staff">店员</option>
              <option value="partner">合伙人</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="invite-note">备注</label>
            <input id="invite-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>意向授权</label>
            <div>
              {FALLBACK_BUSINESSES.map((b) =>
                b.status === "active" ? (
                  <label key={b.id} className="access-toggle">
                    <input
                      type="checkbox"
                      checked={biz.includes(b.id)}
                      onChange={(e) =>
                        setBiz((xs) => (e.target.checked ? [...xs, b.id] : xs.filter((x) => x !== b.id)))
                      }
                    />
                    {b.name}
                  </label>
                ) : null
              )}
            </div>
          </div>
        </div>
        <button type="submit" className="btn" disabled={busy === "add"}>
          登记意向
        </button>
      </form>
      {msg ? <p className="access-msg">{msg}</p> : null}

      {invites.length === 0 ? (
        <p className="empty">暂无待邀请记录：使用上方表单登记第一条。</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="report">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>邮箱</th>
                <th>意向角色</th>
                <th style={{ textAlign: "left" }}>意向授权</th>
                <th style={{ textAlign: "left" }}>备注</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const target = inv.status === "pending" ? matchInviteByEmail(inv.email, members) : null;
                return (
                  <tr key={inv.id}>
                    <td style={{ textAlign: "left" }}>{inv.email}</td>
                    <td>{INVITE_ROLE_LABEL[inv.intended_role]}</td>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>{bizName(inv.intended_businesses)}</td>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>{inv.note ?? "—"}</td>
                    <td>
                      {inv.status === "aligned" ? (
                        <span className="tag tag-ok">已对齐</span>
                      ) : target ? (
                        <span className="tag tag-pending">已注册 · 待对齐</span>
                      ) : (
                        <span className="tag tag-pending">待注册</span>
                      )}
                    </td>
                    <td>
                      {inv.status === "pending" && target ? (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "6px 12px", fontSize: 13 }}
                          disabled={busy === inv.id}
                          onClick={() => align(inv)}
                        >
                          一键对齐
                        </button>
                      ) : null}{" "}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "6px 12px", fontSize: 13 }}
                        disabled={busy === inv.id}
                        onClick={() => removeInvite(inv)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
