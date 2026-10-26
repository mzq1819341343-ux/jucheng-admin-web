"use client";

import { useEffect, useRef } from "react";

/**
 * 顶栏「更多」溢出菜单（指令52-7）：
 * 在原生 details 上补「点击外部关闭 / Esc 关闭」，不引依赖。
 * 点击菜单内部（含 summary 与面板链接）不触发关闭，沿用原生切换与跳转；
 * 移动抽屉内面板为静态展开，同一逻辑同样适用。
 */
export default function MoreMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (el && el.open && !el.contains(e.target as Node)) {
        el.open = false;
      }
    }
    function onKey(e: KeyboardEvent) {
      const el = ref.current;
      if (el && e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details className="menu-more" ref={ref}>
      <summary>更多</summary>
      <div className="menu-more-panel">{children}</div>
    </details>
  );
}
