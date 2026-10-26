import { redirect } from "next/navigation";
import { getCurrentUser, getMyBusinesses, canAccessBusiness } from "@/lib/data";

/**
 * 爱回收板块服务端守卫（指令33C）：
 * 无该业务授权 → 重定向回公司总览并带无权限提示，直进 URL 也绕不过。
 * 真实模式授权来自 user_business_access（owner 不受限），演示模式来自演示授权组合。
 */
export default async function AihuishouLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const { grantedIds } = await getMyBusinesses(user);
  if (!canAccessBusiness(grantedIds, "aihuishou")) {
    redirect("/?denied=aihuishou");
  }
  return <>{children}</>;
}
