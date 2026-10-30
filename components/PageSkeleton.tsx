/**
 * 导航骨架（指令170 C5 · 乐观导航）：各路由段 loading.tsx 共用。
 * 点击后客户端路由立即切到本骨架（URL 与页面壳即时切换），真实数据到达后回填，
 * 不再像无 loading 边界时那样停在旧页等整页 RSC 载荷。
 * 纯服务端组件、零客户端 JS；脉冲动画受 globals-extra.css 的
 * prefers-reduced-motion 全局降级规则约束（近乎静态）。
 */
/** 页头已经画出之后，下面数据块用的占位，避免再套一层整页骨架。 */
export function SectionSkeleton() {
  return (
    <div role="status" aria-label="内容加载中">
      <div className="skel-row">
        <div className="skel skel-card" />
        <div className="skel skel-card" />
        <div className="skel skel-card" />
      </div>
      <div className="skel skel-block" />
    </div>
  );
}

export default function PageSkeleton({ label }: { label: string }) {
  return (
    <main className="container" role="status" aria-label={`${label}加载中`}>
      <div className="skel skel-eyebrow" />
      <div className="skel skel-title" />
      <div className="skel skel-line" />
      <div className="skel-row">
        <div className="skel skel-card" />
        <div className="skel skel-card" />
        <div className="skel skel-card" />
      </div>
      <div className="skel skel-block" />
      <span className="skel-note">{label}加载中…</span>
    </main>
  );
}
