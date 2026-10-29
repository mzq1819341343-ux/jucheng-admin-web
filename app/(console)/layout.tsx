import { Suspense } from "react";
import Nav from "@/components/Nav";
import { ConsoleSessionProvider, PublishConsoleSession } from "@/components/ConsoleSession";
import { getCurrentUser } from "@/lib/data";

/**
 * 登录后的壳：导航与当前用户只挂在这一层。
 * 布局函数本身不读 Cookie，身份放进 Suspense，这样子页的 loading 可以在点击后立刻出现，
 * 软导航不再把顶栏拆掉重查一遍。
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleSessionProvider>
      <Suspense fallback={<NavPlaceholder />}>
        <ConsoleNav />
      </Suspense>
      {children}
    </ConsoleSessionProvider>
  );
}

async function ConsoleNav() {
  const user = await getCurrentUser();
  return (
    <>
      <PublishConsoleSession session={{ role: user.role, demo: user.demo }} />
      <Nav user={user} />
    </>
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
