import { Suspense } from "react";
import { redirect } from "next/navigation";
import PageSkeleton from "@/components/PageSkeleton";
import { getCurrentUser, getMyBusinesses, canAccessBusiness } from "@/lib/data";

/**
 * 爱回收板块服务端守卫（指令33C）：
 * 无该业务授权 → 重定向回公司总览并带无权限提示，直进 URL 也绕不过。
 * 真实模式授权来自 user_business_access（owner 不受限），演示模式来自演示授权组合。
 * 守卫放在 Suspense 里，布局函数本身不等待，子页 loading 可以先出来。
 */
export default function AihuishouLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton label="爱回收" />}>
      <AihuishouGuard>{children}</AihuishouGuard>
    </Suspense>
  );
}

async function AihuishouGuard({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const { grantedIds } = await getMyBusinesses(user);
  if (!canAccessBusiness(grantedIds, "aihuishou")) {
    redirect("/?denied=aihuishou");
  }
  return children;
}
