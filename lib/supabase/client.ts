import { createBrowserClient } from "@supabase/ssr";

/** 浏览器端 Supabase 客户端（只用 anon key，受 RLS 约束） */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** 是否已配置 Supabase 环境变量（未配置时站点走演示模式） */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
