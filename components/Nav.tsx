import Link from "next/link";
import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/data";
import { ROLE_LABEL, getMyBusinesses, canAccessBusiness } from "@/lib/data";
import LogoutButton from "./LogoutButton";
import DemoRoleSwitcher from "./DemoRoleSwitcher";
import DemoBizSwitcher, { type DemoBiz } from "./DemoBizSwitcher";
import ThemeToggle from "./ThemeToggle";
import NavShell from "./NavShell";

export default async function Nav({ user }: { user: CurrentUser }) {
  let demoBiz: DemoBiz = "all";
  if (user.demo) {
    const v = (await cookies()).get("demo_biz")?.value;
    if (v === "aihuishou" || v === "none") demoBiz = v;
  }
  // 指令37：无权限板块入口完全不渲染——导航里的业务链接同样按授权显隐
  const { grantedIds } = await getMyBusinesses(user);
  const showAihuishou = canAccessBusiness(grantedIds, "aihuishou");

  return (
    <NavShell>
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
          {showAihuishou ? <Link href="/business/aihuishou">爱回收</Link> : null}
          {showAihuishou && user.role !== "staff" ? (
            <Link href="/business/aihuishou/costs">门店成本</Link>
          ) : null}
          <Link href="/salary">{user.role === "staff" ? "我的薪酬" : "工资"}</Link>
          <Link href="/expenses">报销</Link>
          <Link href="/members">成员与权限</Link>
          <Link href="/status">数据刷新状态</Link>
          <Link href="/help">操作手册</Link>
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
    </NavShell>
  );
}
