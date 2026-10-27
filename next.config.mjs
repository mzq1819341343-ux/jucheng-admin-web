/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    /**
     * 指令170 C5 · 客户端路由缓存（乐观导航第二半）：
     * Next 16 默认 dynamic staleTime 为 0——每次点击已访问过的动态页都重新拉
     * 整页 RSC（含生产环境一整串 Supabase 往返），返回/重复点击体感最差。
     * dynamic=30s：30 秒内重复点击/返回直接用客户端路由缓存渲染（数据新鲜度
     * 由写操作既有的 router.refresh()（166 修复B 等）与整页刷新兜底，
     * 与 68-P0-6 表单乐观更新不冲突）；static=180s 为静态段缺省档。
     */
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
