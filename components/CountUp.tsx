"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 数字滚动：把已格式化的展示字符串（如 "53,221"、"56.9%"）中的数字部分
 * 从 0 滚动到目标值（约 800ms，easeOutCubic）。
 * - SSR / 首帧渲染最终值（保证无 JS 时数字完整、服务端剥离逻辑可核查）
 * - 挂载后才从 0 开始滚动；尊重 prefers-reduced-motion
 */
function parseValue(v: string) {
  const m = v.match(/-?[\d,]+(?:\.\d+)?/);
  if (!m || m.index === undefined) return null;
  const raw = m[0];
  const num = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  return { num, decimals, start: m.index, end: m.index + raw.length };
}

function formatNum(n: number, decimals: number): string {
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function CountUp({
  value,
  duration = 800,
}: {
  value: string;
  duration?: number;
}) {
  const [text, setText] = useState(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setText(value);
    const p = parseValue(value);
    if (!p) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const prefix = value.slice(0, p.start);
    const suffix = value.slice(p.end);
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setText(prefix + formatNum(p.num * eased, p.decimals) + suffix);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <>{text}</>;
}
