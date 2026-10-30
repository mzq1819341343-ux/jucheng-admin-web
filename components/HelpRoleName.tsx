"use client";

import { useConsoleSession } from "./ConsoleSession";

const ROLE_LABEL = { owner: "老板", partner: "合伙人", staff: "店员" } as const;

/** 操作手册正文保持静态；角色字跟布局里已经解析好的会话走，不单独再查用户。 */
export default function HelpRoleName() {
  const session = useConsoleSession();
  const label = session ? ROLE_LABEL[session.role] : "…";
  return <span suppressHydrationWarning>{label}</span>;
}
