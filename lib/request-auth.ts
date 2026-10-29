/**
 * proxy 验签后写给本次请求的身份提示。
 * 只由 proxy 在 getClaims / getUser 成功后写入；进入 proxy 时先删掉客户端同名头，
 * 页面不能把浏览器自带的头当成登录身份。
 * 值只用于跳过页面里的第二次 Auth 往返，角色仍以 profiles + RLS 为准。
 */
export const AUTH_UID_HEADER = "x-jucheng-uid";
export const AUTH_EMAIL_HEADER = "x-jucheng-email";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAuthUserId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function encodeAuthEmail(email: string | null | undefined): string | null {
  if (!email || email.length > 320 || !email.includes("@")) return null;
  return encodeURIComponent(email);
}

export function readAuthHint(
  headerGet: (name: string) => string | null
): { id: string; email: string | null } | null {
  const id = headerGet(AUTH_UID_HEADER)?.trim() ?? "";
  if (!isAuthUserId(id)) return null;
  const raw = headerGet(AUTH_EMAIL_HEADER);
  if (!raw) return { id, email: null };
  try {
    const email = decodeURIComponent(raw);
    if (!email.includes("@") || email.length > 320) return { id, email: null };
    return { id, email };
  } catch {
    return { id, email: null };
  }
}
