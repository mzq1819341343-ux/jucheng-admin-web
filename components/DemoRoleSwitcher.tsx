"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/data";

const OPTIONS: { value: Role; cn: string; en: string }[] = [
  { value: "owner", cn: "老板", en: "owner" },
  { value: "partner", cn: "合伙人", en: "partner" },
  { value: "staff", cn: "店员", en: "staff" },
];

/** 仅演示模式出现：切换演示角色，直观看到权限差异 */
export default function DemoRoleSwitcher({ current }: { current: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(current);

  function onChange(v: Role) {
    setRole(v);
    document.cookie = `demo_role=${v}; path=/; max-age=86400`;
    router.refresh();
  }

  return (
    <div className="demo-switcher">
      <span>演示角色：</span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={role === o.value ? "chip chip-active" : "chip"}
          onClick={() => onChange(o.value)}
        >
          {o.cn}（<span className="en">{o.en}</span>）
        </button>
      ))}
    </div>
  );
}
