/**
 * 演示模式总开关（指令40-2）：生产环境一律禁用演示。
 *
 * 允许演示的条件（满足其一）：
 * - 显式设置 NEXT_PUBLIC_ALLOW_DEMO=1（例如给 Vercel Preview 环境单独开启）；
 * - 非生产环境：VERCEL_ENV 与 NODE_ENV 都不是 production（如本地 next dev）。
 *
 * 生产（VERCEL_ENV=production 或 NODE_ENV=production，如 jcxj.cc / vercel.app 主部署）
 * 一律返回 false：登录页不渲染演示入口、顶栏不渲染演示切换器、
 * 数据层忽略 demo_role / demo_biz Cookie 直接走真实登录。
 *
 * 客户端组件中 process.env.VERCEL_ENV 不可见（undefined，按非 production 计），
 * 但 NODE_ENV 由构建时内联：生产构建恒为 "production"，客户端判定同样成立。
 */
export function isDemoAllowed(): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_DEMO === "1") return true;
  return (
    process.env.VERCEL_ENV !== "production" &&
    process.env.NODE_ENV !== "production"
  );
}
