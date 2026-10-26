import { redirect } from "next/navigation";

/** 旧地址 /reports/aihuishou 已迁入爱回收板块，永久重定向避免 404 */
export default function OldAihuishouReportRedirect() {
  redirect("/business/aihuishou/reports");
}
