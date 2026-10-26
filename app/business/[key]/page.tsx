import { redirect } from "next/navigation";

/**
 * 未开通 / 不存在的业务板块（含 coming_soon 的「更多业务」）：
 * 任何人不可直进，一律回公司总览并提示。
 */
export default async function UnknownBusinessPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  redirect(`/?denied=${encodeURIComponent(key)}`);
}
