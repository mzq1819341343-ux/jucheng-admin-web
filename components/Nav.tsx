"use client";

import { useEffect, useState, type ReactNode } from "react";
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

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const head = local.slice(0, 2);
  return `${head}***${email.slice(at)}`;
}

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
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

function NavFolder({
  id,
  label,
  active,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className={`menu-group${active ? " is-active" : ""}${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="menu-group-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
      </button>
      <div className="menu-sub-clip">
        <div
          className="menu-sub"
          id={id}
          role="group"
          aria-label={label}
          inert={!open ? true : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function NavGroup({
  id,
  label,
  pathname,
  items,
}: {
  id: string;
  label: string;
  pathname: string;
  items: { href: string; label: string }[];
}) {
  const active = items.some((item) => isCurrent(pathname, item.href));
  if (items.length === 0) return null;
  return (
    <NavFolder id={id} label={label} active={active}>
      {items.map((item) => (
        <NavLink key={item.href} href={item.href} pathname={pathname}>
          {item.label}
        </NavLink>
      ))}
    </NavFolder>
  );
}

function NavBody({ chrome }: { chrome: ConsoleNavChrome }) {
  const pathname = usePathname();
  const { role, demo, email, grantedIds } = chrome;
  const showAihuishou = canAccessBusiness(grantedIds, "aihuishou");
  const showBizTools = showAihuishou && role !== "staff";
  const operateItems = [
    { href: "/", label: "总览" },
    ...(showAihuishou
      ? [
          { href: "/business/aihuishou/reports", label: "报表" },
          { href: "/business/aihuishou/compare", label: "两店对比" },
        ]
      : []),
    ...(showBizTools
      ? [
          { href: "/business/aihuishou/costs", label: "门店成本" },
          { href: "/business/aihuishou/breakdown", label: "净利构成" },
        ]
      : []),
  ];
  const peopleItems = [
    { href: "/salary", label: role === "staff" ? "我的薪酬" : "薪资" },
    { href: "/members", label: "成员" },
  ];
  const inProject =
    pathname === "/" ||
    pathname.startsWith("/business/aihuishou") ||
    pathname.startsWith("/salary") ||
    pathname.startsWith("/members") ||
    pathname.startsWith("/expenses");

  return (
    <>
      <div className="brand">
        <Link href="/" className="brand-name">
          聚成
        </Link>
        <span className="brand-slogan">{BRAND_SLOGAN}</span>
      </div>
      <nav className="menu" aria-label="主导航">
        <NavFolder id="nav-projects" label="项目" active={inProject}>
          <NavFolder id="nav-aihuishou" label="爱回收" active={inProject}>
            <NavGroup id="nav-operate" label="经营" pathname={pathname} items={operateItems} />
            <NavGroup id="nav-people" label="员工" pathname={pathname} items={peopleItems} />
            <NavLink href="/expenses" pathname={pathname}>
              报销
            </NavLink>
          </NavFolder>
        </NavFolder>
        <div className="menu-rule" aria-hidden="true" />
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

export default function Nav() {
  const chrome = useConsoleNavChrome();
  return <NavShell>{chrome ? <NavBody chrome={chrome} /> : <NavSkeleton />}</NavShell>;
}
