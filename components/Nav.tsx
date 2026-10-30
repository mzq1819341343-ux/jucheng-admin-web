"use client";

import Link from "next/link";
import LogoutButton from "./LogoutButton";
import DemoRoleSwitcher from "./DemoRoleSwitcher";
import DemoBizSwitcher from "./DemoBizSwitcher";
import ThemeToggle from "./ThemeToggle";
import NavShell from "./NavShell";
import MoreMenu from "./MoreMenu";
import { BRAND_SLOGAN } from "@/lib/brand";
import {
  useConsoleNavChrome,
  type ConsoleNavChrome,
  type ConsoleRole,
} from "./ConsoleSession";

const ROLE_LABEL: Record<ConsoleRole, string> = {
  owner: "老板",
  partner: "合伙人",
  staff: "店员",
};

function canAccessBusiness(grantedIds: string[], businessId: string) {
  return grantedIds.includes(businessId);
}

/** 邮箱掩码（指令51）：顶栏不明文展示完整邮箱，只留首尾与域名，全址进 title。 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const head = local.slice(0, 2);
  return `${head}***${email.slice(at)}`;
}

function NavBody({ chrome }: { chrome: ConsoleNavChrome }) {
  const { role, demo, email, grantedIds, demoBiz } = chrome;
  const showAihuishou = canAccessBusiness(grantedIds, "aihuishou");
  const showBizTools = showAihuishou && role !== "staff";

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
        <nav className="menu">
          <Link href="/">公司总览</Link>
          {showAihuishou ? <Link href="/business/aihuishou">爱回收</Link> : null}
          <Link href="/salary">{role === "staff" ? "我的薪酬" : "工资"}</Link>
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
            {ROLE_LABEL[role]}
            {demo ? "（演示）" : ""}
          </span>
          {email ? (
            <span className="user-email en" title={email}>
              {maskEmail(email)}
            </span>
          ) : null}
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
      {demo ? (
        <div className="demo-bar">
          <DemoRoleSwitcher current={role} />
          <DemoBizSwitcher current={demoBiz} />
          <span className="demo-note">
            演示模式：当前为汇总样例数据，可切换角色与业务授权，查看不同权限下的页面差异。
          </span>
        </div>
      ) : null}
    </NavShell>
  );
}

function NavPlaceholder() {
  return (
    <header className="topbar" aria-hidden="true">
      <div className="topbar-inner">
        <div className="skel skel-title" style={{ width: 92, height: 28, margin: 0 }} />
        <div className="skel skel-line" style={{ width: 280, margin: 0 }} />
      </div>
    </header>
  );
}

/**
 * 登录壳顶栏：读布局发布的 chrome 快照。
 * 软导航时 Provider 不卸载，沿用上一份 chrome，Suspense 重取身份时顶栏不闪骨架。
 */
export default function Nav() {
  const chrome = useConsoleNavChrome();
  if (!chrome) return <NavPlaceholder />;
  return <NavBody chrome={chrome} />;
}
