/**
 * 浏览器端 Supabase 的轻量配置模块（指令132 A4）：只含零依赖的配置判断与
 * 懒加载入口，不静态 import @supabase/ssr——任何页面组件静态引用本模块
 * 都不会把 supabase-js（约 259KB）拖进首屏 JS；真正建客户端时才动态加载。
 */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * 懒加载浏览器端 Supabase 客户端：仅在用户真正触发写操作（提交/删除/
 * 切换状态等事件处理器内）时才 import @supabase/ssr 建客户端，
 * 首屏渲染与列表展示不付出这份体积。行为与原静态 createClient() 一致。
 */
export async function createBrowserSupabase() {
  const { createClient } = await import("./client");
  return createClient();
}
