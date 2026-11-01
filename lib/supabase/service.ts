import { createClient } from "@supabase/supabase-js";

/**
 * 服务端 service role 客户端。绕过 RLS，只给 Route Handler 用。
 * 密钥没有 NEXT_PUBLIC_ 前缀，不要从浏览器组件引用本文件。
 * 未配置时返回 null，由调用方改成 503，而不是改用 anon key 写表。
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
