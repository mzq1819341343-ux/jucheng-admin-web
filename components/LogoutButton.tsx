"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";

export default function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    // 清演示 Cookie（演示模式与真实模式都安全）
    document.cookie = "demo_role=; path=/; max-age=0";
    document.cookie = "demo_biz=; path=/; max-age=0";
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createBrowserSupabase();
        await supabase.auth.signOut();
      } catch {
        // 忽略，仍跳登录页
      }
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={onLogout}>
      退出
    </button>
  );
}
