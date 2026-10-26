"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!configured) {
      setError("Supabase 尚未配置：先按 README 完成建项目与环境变量，再用邮箱密码登录。也可以直接进入演示模式看界面。");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(`登录失败：${error.message}`);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(`登录失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  function enterDemo() {
    document.cookie = "demo_role=owner; path=/; max-age=86400";
    router.push("/");
    router.refresh();
  }

  return (
    <main className="login-wrap">
      <div className="login-brand">
        <div className="login-brand-name">聚成</div>
        <div className="login-brand-slogan">聚天下英豪，成全球唯一</div>
        <div className="login-brand-en">JUCHENG</div>
        <div className="login-brand-rule" aria-hidden="true" />
      </div>
      <div className="card form-card login-card">
        <h1 className="page-title login-title">登录公司后台</h1>
        <p className="page-desc">使用老板分配的邮箱与密码登录（Supabase Auth）。</p>

        {!configured ? (
          <div className="notice">
            当前部署尚未连接 Supabase（环境变量未配）：登录暂不可用，可先进入演示模式查看三角色界面差异；正式启用步骤见仓库 README。
          </div>
        ) : null}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn" disabled={busy} style={{ width: "100%" }}>
            {busy ? "登录中…" : "登录"}
          </button>
        </form>

        <div style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-ghost" onClick={enterDemo} style={{ width: "100%" }}>
            进入演示模式（免登录看界面）
          </button>
          <p className="page-desc" style={{ marginTop: 10, fontSize: 13 }}>
            演示模式使用 v3.3 汇总样例口径，可在页面顶部切换老板 / 合伙人 / 店员，查看权限差异。
          </p>
        </div>
      </div>
    </main>
  );
}
