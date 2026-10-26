import Link from "next/link";
import type { CurrentUser } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/data";
import LogoutButton from "./LogoutButton";
import DemoRoleSwitcher from "./DemoRoleSwitcher";

export default function Nav({ user }: { user: CurrentUser }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <Link href="/" className="brand-name">
            聚成
          </Link>
          <span className="brand-slogan">聚天下英豪，成全球唯一</span>
          <span className="brand-en">JUCHENG</span>
        </div>
        <nav className="menu">
          <Link href="/">首页仪表盘</Link>
          <Link href="/reports/aihuishou">爱回收报表</Link>
          <Link href="/members">成员与权限</Link>
          <Link href="/status">数据刷新状态</Link>
        </nav>
        <div className="userbox">
          <span className="user-role">
            {ROLE_LABEL[user.role]}
            {user.demo ? "（演示）" : ""}
          </span>
          {user.email ? <span className="user-email">{user.email}</span> : null}
          <LogoutButton />
        </div>
      </div>
      {user.demo ? (
        <div className="demo-bar">
          <DemoRoleSwitcher current={user.role} />
          <span className="demo-note">
            演示模式：尚未连接 Supabase 或未登录，数据为 v3.3 汇总样例口径；在成员页可查看正式建号步骤。
          </span>
        </div>
      ) : null}
    </header>
  );
}
