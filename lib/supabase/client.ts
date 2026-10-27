import { createBrowserClient } from "@supabase/ssr";

/** 浏览器端 Supabase 客户端（只用 anon key，受 RLS 约束） */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** 是否已配置 Supabase 环境变量（未配置时站点走演示模式）；实现已移至零依赖的 ./config，本处转发保持既有导入路径不变。 */
export { isSupabaseConfigured } from "./config";
