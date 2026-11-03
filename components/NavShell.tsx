"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * 侧栏外壳：
 * - 桌面：左侧固定竖栏常显，汉堡条隐藏；
 * - 小屏（≤900px）：竖栏收成抽屉，点汉堡展开；
 *   路由变化、按 Esc、点遮罩或点菜单链接时关闭。
 */
export default function NavShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    function sync() {
      setNarrow(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 900px)");
    function lock() {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    }
    lock();
    mq.addEventListener("change", lock);
    return () => {
      mq.removeEventListener("change", lock);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="nav-mobile-bar">
        <button
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-controls="console-nav"
          aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
        <span className="nav-mobile-title">聚成</span>
      </div>
      {open ? (
        <div
          className="nav-backdrop"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="console-nav"
        className={`sidebar${open ? " is-open" : ""}`}
        inert={narrow && !open ? true : undefined}
        onClick={(e) => {
          const el = e.target instanceof Element ? e.target : null;
          if (el?.closest("a")) setOpen(false);
        }}
      >
        {children}
      </aside>
    </>
  );
}
