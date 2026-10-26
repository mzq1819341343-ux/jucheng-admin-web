"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type DemoBiz = "all" | "aihuishou" | "none";

const OPTIONS: { value: DemoBiz; cn: string; en: string }[] = [
  { value: "all", cn: "全部业务", en: "all" },
  { value: "aihuishou", cn: "仅爱回收", en: "aihuishou" },
  { value: "none", cn: "无授权", en: "none" },
];

/** 仅演示模式出现：切换演示业务授权组合，演示「只开某一业务」的差异（指令33D） */
export default function DemoBizSwitcher({ current }: { current: DemoBiz }) {
  const router = useRouter();
  const [biz, setBiz] = useState<DemoBiz>(current);

  function onChange(v: DemoBiz) {
    setBiz(v);
    document.cookie = `demo_biz=${v}; path=/; max-age=86400`;
    router.refresh();
  }

  return (
    <div className="demo-switcher">
      <span>演示业务授权：</span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={biz === o.value ? "chip chip-active" : "chip"}
          onClick={() => onChange(o.value)}
        >
          {o.cn}（<span className="en">{o.en}</span>）
        </button>
      ))}
    </div>
  );
}
