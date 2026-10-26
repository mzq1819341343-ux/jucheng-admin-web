/**
 * 成员待邀请名单（指令59 A6 一期）：类型与邮箱匹配纯函数。
 * 本模块无服务端依赖，服务端数据层（lib/data.ts）与客户端组件共用。
 *
 * 匹配口径：新账号的 profiles.display_name 默认即注册邮箱
 * （schema.sql 的 handle_new_user 触发器：display_name 取
 * raw_user_meta_data.display_name，缺省回落 new.email），因此邀请邮箱与
 * 某 profile 的 display_name 去空格、不分大小写精确相等才算匹配上；
 * 改过显示名的账号不会被误配，对齐前界面还会二次确认邮箱与角色。
 */
export interface MemberInvite {
  id: string;
  email: string;
  intended_role: "partner" | "staff";
  intended_businesses: string[];
  note: string | null;
  status: "pending" | "aligned";
  created_by: string | null;
  created_at: string;
  aligned_at: string | null;
  aligned_user_id: string | null;
}

export const INVITE_ROLE_LABEL: Record<MemberInvite["intended_role"], string> = {
  partner: "合伙人",
  staff: "店员",
};

export function matchInviteByEmail(
  email: string,
  members: { id: string; display_name: string | null }[]
): { id: string; display_name: string | null } | null {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  return members.find((m) => (m.display_name ?? "").trim().toLowerCase() === target) ?? null;
}
