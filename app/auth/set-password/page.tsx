"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  authCallbackPathWithoutSecrets,
  beginPasswordCallback,
} from "@/lib/supabase/password-callback";

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * 设密码承接页（插队任务 · 正式登录打通）：
 * Supabase 邀请 / 找回邮件把会话放在 URL hash（或 ?code=）里，
 * 必须由浏览器端承接会话后才能调 updateUser 设密码。
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) {
      setPhase("invalid");
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    const href = window.location.href;

    beginPasswordCallback(
      {
        exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
        setSession: (tokens) => supabase.auth.setSession(tokens),
        getSession: () => supabase.auth.getSession(),
      },
      href,
    ).then((next) => {
      if (cancelled) return;
      if (next === "ready") {
        const cleaned = authCallbackPathWithoutSecrets(window.location.href);
        window.history.replaceState(window.history.state, "", cleaned);
      }
      setPhase(next);
    }).catch(() => {
      if (!cancelled) setPhase("invalid");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("密码至少 8 位。");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(`设置失败：${error.message}`);
      } else {
        setPhase("done");
        window.setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1200);
      }
    } catch (err) {
      setError(`设置失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-brand">
        <div className="login-brand-name">聚成</div>
        <div className="login-brand-slogan">聚天下英豪，成全球唯一</div>
        <div className="login-brand-en en">JUCHENG</div>
        <div className="login-brand-rule" aria-hidden="true" />
      </div>
      <div className="card form-card login-card">
        <h1 className="page-title login-title">设置登录密码</h1>
        {phase === "checking" ? (
          <p className="page-desc">正在验证邀请链接，请稍候…</p>
        ) : null}
        {phase === "invalid" ? (
          <>
            <p className="page-desc">
              链接无效或已过期，请让管理员重发邀请。
            </p>
            <button type="button" className="btn" onClick={() => router.push("/login")}>
              去登录页
            </button>
          </>
        ) : null}
        {phase === "ready" ? (
          <>
            <p className="page-desc">
              邀请验证通过。为你的账号设置登录密码（至少 8 位），设置完成后将直接进入聚成总后台。
            </p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="new-password">新密码</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-password">确认新密码</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再次输入新密码"
                />
              </div>
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "提交中…" : "设置密码并进入后台"}
              </button>
            </form>
          </>
        ) : null}
        {phase === "done" ? (
          <p className="page-desc">密码已设置，正在进入聚成总后台…</p>
        ) : null}
      </div>
    </main>
  );
}
