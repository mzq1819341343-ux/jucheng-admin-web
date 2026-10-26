"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "jucheng-theme";

/**
 * 主题切换（仅两套：夜间 / 白天，指令34）。
 * 偏好写 localStorage，layout 内联脚本在首帧渲染前恢复，避免闪烁。
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隐私模式等场景忽略，当前页仍生效
    }
  }

  return (
    <button type="button" className="btn btn-ghost theme-toggle" onClick={toggle} aria-label="切换主题">
      {theme === null ? (
        <>
          主题 <span className="en">THEME</span>
        </>
      ) : theme === "light" ? (
        <>
          夜间 <span className="en">NIGHT</span>
        </>
      ) : (
        <>
          白天 <span className="en">LIGHT</span>
        </>
      )}
    </button>
  );
}
