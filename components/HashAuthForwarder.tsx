"use client";

import { useEffect } from "react";

/**
 * 邀请 / 找回密码链接的 hash 会话转发（插队任务 · 正式登录打通）：
 * Supabase 邮件链接把会话 token 放在回调 URL 的 hash 里（#access_token=...&type=invite|recovery），
 * 落地页（Site URL 根路径）本身不承接。这里在任何页面挂载时检查一次：
 * hash 带 access_token 且 type=invite/recovery → 整段 hash 原样转交 /auth/set-password 完成设密。
 * 无 hash 或非邀请/找回类型时零动作，不影响正常访问。
 */
export default function HashAuthForwarder() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;
    if (!/(?:^|[#&])type=(invite|recovery)(?:&|$)/.test(hash)) return;
    if (window.location.pathname === "/auth/set-password") return;
    window.location.replace("/auth/set-password" + hash);
  }, []);
  return null;
}
