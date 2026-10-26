import Link from "next/link";
import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/data";
import LogoutButton from "./LogoutButton";
import DemoRoleSwitcher from "./DemoRoleSwitcher";
import DemoBizSwitcher, { type DemoBiz } from "./DemoBizSwitcher";
import ThemeToggle from "./ThemeToggle";

export default async function Nav({ user }: { user: CurrentUser }) {
  let demoBiz: DemoBiz = "all";
  if (user.demo) {
    const v = (await cookies()).get("demo_biz")?.value;
    if (v === "aihuishou" || v === "none") demoBiz = v;
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <Link href="/" className="brand-name">
            聚成
          </Link>
          <span className="brand-slogan">聚天下英豪，成全球唯一</span>
          <span className="brand-en en">JUCHENG</span>
        </div>
        <nav className="menu">
          <Link href="/">公司总览</Link>
          <Link href="/business/aihuishou">爱回收</Link>
          <Link href="/members">成员与权限</Link>
          <Link href="/status">数据刷新状态</Link>
        </nav>
        <div className="userbox">
          <span className="user-role">
            {ROLE_LABEL[user.role]}
            {user.demo ? "（演示）" : ""}
          </span>
          {user.email ? <span className="user-email en">{user.email}</span> : null}
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
      {user.demo ? (
        <div className="demo-bar">
          <DemoRoleSwitcher current={user.role} />
          <DemoBizSwitcher current={demoBiz} />
          <span className="demo-note">
            演示模式：尚未连接 Supabase 或未登录，数据为 v3.3 汇总样例口径；可组合切换演示角色与业务授权，查看权限差异。
          </span>
        </div>
      ) : null}
    </header>
  );
}
