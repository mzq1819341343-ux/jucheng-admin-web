import Link from "next/link";
import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/data";
import { ROLE_LABEL, getMyBusinesses, canAccessBusiness } from "@/lib/data";
import LogoutButton from "./LogoutButton";
import DemoRoleSwitcher from "./DemoRoleSwitcher";
import DemoBizSwitcher, { type DemoBiz } from "./DemoBizSwitcher";
import ThemeToggle from "./ThemeToggle";
import NavShell from "./NavShell";
import MoreMenu from "./MoreMenu";
import { BRAND_SLOGAN } from "@/lib/brand";

/** 邮箱掩码（指令51）：顶栏不明文展示完整邮箱，只留首尾与域名，全址进 title。 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const head = local.slice(0, 2);
  return `${head}***${email.slice(at)}`;
}

export default async function Nav({ user }: { user: CurrentUser }) {
  let demoBiz: DemoBiz = "all";
  if (user.demo) {
    const v = (await cookies()).get("demo_biz")?.value;
    if (v === "aihuishou" || v === "none") demoBiz = v;
  }
  // 指令37：无权限板块入口完全不渲染——导航里的业务链接同样按授权显隐
  const { grantedIds } = await getMyBusinesses(user);
  const showAihuishou = canAccessBusiness(grantedIds, "aihuishou");
  const showBizTools = showAihuishou && user.role !== "staff";

  return (
    <NavShell>
      <div className="topbar-inner">
        <div className="brand">
          <Link href="/" className="brand-name">
            聚成
          </Link>
          <span className="brand-slogan">{BRAND_SLOGAN}</span>
          <span className="brand-en en">JUCHENG</span>
        </div>
        {/* 指令51：桌面单行导航——主链接直达，次要项收进「更多」溢出菜单，不再折行 */}
        <nav className="menu">
          <Link href="/">公司总览</Link>
          {showAihuishou ? <Link href="/business/aihuishou">爱回收</Link> : null}
          <Link href="/salary">{user.role === "staff" ? "我的薪酬" : "工资"}</Link>
          <Link href="/expenses">报销</Link>
          <MoreMenu>
            {showAihuishou ? <Link href="/business/aihuishou/reports">经营报表</Link> : null}
            {showAihuishou ? <Link href="/business/aihuishou/compare">两店对比</Link> : null}
            {showBizTools ? <Link href="/business/aihuishou/costs">门店成本</Link> : null}
            {showBizTools ? <Link href="/business/aihuishou/breakdown">净利构成</Link> : null}
            <Link href="/members">成员与权限</Link>
            <Link href="/status">数据状态</Link>
            <Link href="/help">操作手册</Link>
          </MoreMenu>
        </nav>
        <div className="userbox">
          <span className="user-role">
            {ROLE_LABEL[user.role]}
            {user.demo ? "（演示）" : ""}
          </span>
          {user.email ? (
            <span className="user-email en" title={user.email}>
              {maskEmail(user.email)}
            </span>
          ) : null}
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
      {user.demo ? (
        <div className="demo-bar">
          <DemoRoleSwitcher current={user.role} />
          <DemoBizSwitcher current={demoBiz} />
          <span className="demo-note">
            演示模式：当前为汇总样例数据，可切换角色与业务授权，查看不同权限下的页面差异。
          </span>
        </div>
      ) : null}
    </NavShell>
  );
}
