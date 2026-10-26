"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 顶栏外壳（指令37 · 响应式导航）：
 * - 大屏：children（品牌 / 菜单 / 用户区 / 演示条）按原布局平铺，汉堡按钮隐藏；
 * - 小屏：菜单、用户区、演示条默认收起，点右上角汉堡展开成抽屉面板
 *   （CSS 按 .nav-open 控制显隐），路由变化或按 Esc 自动关闭。
 */
export default function NavShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <header className={`topbar${open ? " nav-open" : ""}`}>
      <button
        type="button"
        className="nav-burger"
        aria-expanded={open}
        aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "✕" : "☰"}
      </button>
      {children}
    </header>
  );
}
