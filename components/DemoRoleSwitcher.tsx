"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/data";

const OPTIONS: { value: Role; label: string }[] = [
  { value: "owner", label: "老板（owner）" },
  { value: "partner", label: "合伙人（partner）" },
  { value: "staff", label: "店员（staff）" },
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
          {o.label}
        </button>
      ))}
    </div>
  );
}
