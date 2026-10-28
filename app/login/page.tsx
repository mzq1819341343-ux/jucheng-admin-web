"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { preconnect } from "react-dom";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";
import { isDemoAllowed } from "@/lib/demo";
import { BRAND_SLOGAN } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  if (configured) {
    // 指令165 P0：supabase-js 改为提交时才懒加载（见 onSubmit），登录页首屏
    // 不再背约 259KB（未压缩）的 supabase chunk；先对鉴权域名预连接，抵消
    // 点击登录时懒加载建客户端现建 TLS 的一次往返。仅连接提示，无行为变化。
    preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL!, {
      crossOrigin: "anonymous",
    });
  }
  const demoAllowed = isDemoAllowed();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!configured) {
      setError(
        demoAllowed
          ? "Supabase 尚未配置：先按 README 完成建项目与环境变量，再用邮箱密码登录。也可以直接进入演示模式看界面。"
          : "Supabase 尚未配置：先按 README 完成建项目与环境变量，再用邮箱密码登录。"
      );
      return;
    }
    setBusy(true);
    try {
      const supabase = await createBrowserSupabase();
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
        {/* 指令185 模块A：口号定稿 + 逐字墨迹显现（纯 CSS 动画，零新增 JS 逻辑） */}
        <div className="login-brand-slogan login-brand-slogan--ink" aria-label={BRAND_SLOGAN}>
          {BRAND_SLOGAN.split("").map((ch, i) => (
            <span
              key={i}
              className="ink-char"
              style={{ animationDelay: `${0.25 + i * 0.075}s` }}
              aria-hidden="true"
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="login-brand-en en">JUCHENG</div>
        <div className="login-brand-rule" aria-hidden="true" />
      </div>
      <div className="card form-card login-card">
        <h1 className="page-title login-title">登录公司后台</h1>
        <p className="page-desc">使用分配的邮箱与密码登录。</p>

        {!configured ? (
          <div className="notice">
            {demoAllowed
              ? "当前部署尚未连接 Supabase（环境变量未配）：登录暂不可用，可先进入演示模式查看三角色界面差异；正式启用步骤见仓库 README。"
              : "当前部署尚未连接 Supabase（环境变量未配）：登录暂不可用；正式启用步骤见仓库 README。"}
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

        {demoAllowed ? (
          <div style={{ marginTop: 18 }}>
            <button type="button" className="btn btn-ghost btn-sheen" onClick={enterDemo} style={{ width: "100%" }}>
              进入演示模式（免登录看界面）
            </button>
            <p className="page-desc" style={{ marginTop: 10, fontSize: 13 }}>
              演示模式使用 v3.3 汇总样例口径，可在页面顶部切换老板 / 合伙人 / 店员，查看权限差异。
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
