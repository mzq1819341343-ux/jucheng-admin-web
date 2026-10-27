"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "jucheng-theme";

/** 太阳图标（夜间显示：点击切到白天）。 */
function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** 月亮图标（白天显示：点击切到夜间）。 */
function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/**
 * 主题切换（仅两套：夜间 / 白天，指令34；指令68-P0-5 改 SVG 图标）。
 * 偏好写 localStorage，layout 内联脚本在首帧渲染前恢复，避免闪烁。
 * 图标语义：夜间显太阳（去白天）、白天显月亮（去夜间）；未定状态先显月亮占位，挂载后校正。
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

  const toLight = theme !== "light";
  return (
    <button
      type="button"
      className="btn btn-ghost theme-toggle"
      onClick={toggle}
      aria-label={toLight ? "切换到白天主题" : "切换到夜间主题"}
      title={toLight ? "切换到白天主题" : "切换到夜间主题"}
    >
      {toLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
