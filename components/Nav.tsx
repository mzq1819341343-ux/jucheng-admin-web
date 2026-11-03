"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import DemoRoleSwitcher from "./DemoRoleSwitcher";
import DemoBizSwitcher from "./DemoBizSwitcher";
import NavShell from "./NavShell";
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

/** 邮箱掩码（指令51）：栏底不明文展示完整邮箱，只留首尾与域名，全址进 title。 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const head = local.slice(0, 2);
  return `${head}***${email.slice(at)}`;
}

/** 爱回收首页与报表/对比/成本/净利分列，父项不跟着子页一起亮。 */
function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/business/aihuishou") return pathname === "/business/aihuishou";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: ReactNode;
}) {
  const current = isCurrent(pathname, href);
  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

function NavBody({ chrome }: { chrome: ConsoleNavChrome }) {
  const pathname = usePathname();
  const { role, demo, email, grantedIds } = chrome;
  const showAihuishou = canAccessBusiness(grantedIds, "aihuishou");
  const showBizTools = showAihuishou && role !== "staff";

  return (
    <>
      <div className="brand">
        <Link href="/" className="brand-name">
          聚成
        </Link>
        <span className="brand-slogan">{BRAND_SLOGAN}</span>
      </div>
      <nav className="menu" aria-label="主导航">
        <NavLink href="/" pathname={pathname}>
          公司总览
        </NavLink>
        {showAihuishou ? (
          <NavLink href="/business/aihuishou" pathname={pathname}>
            爱回收
          </NavLink>
        ) : null}
        <NavLink href="/salary" pathname={pathname}>
          {role === "staff" ? "我的薪酬" : "工资"}
        </NavLink>
        <NavLink href="/expenses" pathname={pathname}>
          报销
        </NavLink>
        <div className="menu-rule" aria-hidden="true" />
        {showAihuishou ? (
          <NavLink href="/business/aihuishou/reports" pathname={pathname}>
            经营报表
          </NavLink>
        ) : null}
        {showAihuishou ? (
          <NavLink href="/business/aihuishou/compare" pathname={pathname}>
            两店对比
          </NavLink>
        ) : null}
        {showBizTools ? (
          <NavLink href="/business/aihuishou/costs" pathname={pathname}>
            门店成本
          </NavLink>
        ) : null}
        {showBizTools ? (
          <NavLink href="/business/aihuishou/breakdown" pathname={pathname}>
            净利构成
          </NavLink>
        ) : null}
        <NavLink href="/members" pathname={pathname}>
          成员与权限
        </NavLink>
        <NavLink href="/status" pathname={pathname}>
          数据状态
        </NavLink>
        <NavLink href="/help" pathname={pathname}>
          操作手册
        </NavLink>
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
        <LogoutButton />
      </div>
    </>
  );
}

function NavSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="brand">
        <div className="skel" style={{ width: 72, height: 26, margin: 0 }} />
      </div>
      <div className="menu">
        <div className="skel skel-line" style={{ width: "72%", margin: "8px 0" }} />
        <div className="skel skel-line" style={{ width: "56%", margin: "8px 0" }} />
        <div className="skel skel-line" style={{ width: "64%", margin: "8px 0" }} />
      </div>
    </div>
  );
}

/** 演示条放在内容区顶部（不再挂在导航下）。未进入演示时不渲染。 */
export function ConsoleDemoBar() {
  const chrome = useConsoleNavChrome();
  if (!chrome?.demo) return null;
  return (
    <div className="demo-bar">
      <DemoRoleSwitcher current={chrome.role} />
      <DemoBizSwitcher current={chrome.demoBiz} />
      <span className="demo-note">
        演示模式：当前为汇总样例数据，可切换角色与业务授权，查看不同权限下的页面差异。
      </span>
    </div>
  );
}

/**
 * 登录壳侧栏：读布局发布的 chrome 快照。
 * 软导航时 Provider 不卸载，沿用上一份 chrome，Suspense 重取身份时侧栏不闪骨架。
 */
export default function Nav() {
  const chrome = useConsoleNavChrome();
  return <NavShell>{chrome ? <NavBody chrome={chrome} /> : <NavSkeleton />}</NavShell>;
}
