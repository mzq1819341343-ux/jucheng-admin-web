import { Suspense } from "react";
import { cookies } from "next/headers";
import Nav from "@/components/Nav";
import {
  ConsoleSessionProvider,
  PublishConsoleSession,
  PublishConsoleNavChrome,
} from "@/components/ConsoleSession";
import { getCurrentUser, getMyBusinesses } from "@/lib/data";
import type { DemoBiz } from "@/components/DemoBizSwitcher";

/**
 * 登录后的壳：顶栏客户端常驻；身份在 Suspense 里后台刷新。
 * 软导航不再因重取 getCurrentUser 把顶栏拆成骨架（壳 warm 目标 ≤150ms）。
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleSessionProvider>
      <Nav />
      <Suspense fallback={null}>
        <ConsoleNavPublisher />
      </Suspense>
      {children}
    </ConsoleSessionProvider>
  );
}

async function ConsoleNavPublisher() {
  const user = await getCurrentUser();
  let demoBiz: DemoBiz = "all";
  if (user.demo) {
    const v = (await cookies()).get("demo_biz")?.value;
    if (v === "aihuishou" || v === "none") demoBiz = v;
  }
  const { grantedIds } = await getMyBusinesses(user);
  return (
    <>
      <PublishConsoleSession session={{ role: user.role, demo: user.demo }} />
      <PublishConsoleNavChrome
        chrome={{
          role: user.role,
          demo: user.demo,
          email: user.email,
          grantedIds,
          demoBiz,
        }}
      />
    </>
  );
}
