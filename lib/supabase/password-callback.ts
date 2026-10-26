/**
 * 邀请 / 找回邮件落到 /auth/set-password 后的会话承接。
 *
 * @supabase/ssr 的 createBrowserClient 把 flowType 固定为 pkce，
 * 只认 ?code=。邮件 verify 重定向常见的是隐式片段
 *（#access_token&refresh_token&type=recovery|invite），
 * 客户端初始化会把它当成「不是 PKCE」直接丢掉，不会触发登录事件。
 * 这里显式把片段交给 setSession，同时保留 ?code= 换票。
 */

export type PasswordCallbackPhase = "ready" | "invalid";

type AuthErrorLike = { message: string } | null;

export type PasswordCallbackAuth = {
  exchangeCodeForSession: (code: string) => Promise<{ error: AuthErrorLike }>;
  setSession: (currentSession: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ data: { session: unknown | null }; error: AuthErrorLike }>;
  getSession: () => Promise<{ data: { session: unknown | null } }>;
};

export type PasswordCallbackParams = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

function nonempty(value: string | null): string | null {
  if (!value) return null;
  return value.length > 0 ? value : null;
}

/** 只解析回调参数，不写日志、不改地址栏。 */
export function readPasswordCallback(href: string): PasswordCallbackParams {
  const url = new URL(href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
  return {
    code: nonempty(url.searchParams.get("code")),
    accessToken: nonempty(hashParams.get("access_token")),
    refreshToken: nonempty(hashParams.get("refresh_token")),
  };
}

/** 去掉片段和 ?code=，避免令牌留在地址栏。其它查询参数保留。 */
export function authCallbackPathWithoutSecrets(href: string): string {
  const url = new URL(href);
  url.hash = "";
  url.searchParams.delete("code");
  return `${url.pathname}${url.search}`;
}

async function hasSession(auth: PasswordCallbackAuth): Promise<boolean> {
  try {
    const { data } = await auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

export async function establishPasswordSession(
  auth: PasswordCallbackAuth,
  href: string,
): Promise<PasswordCallbackPhase> {
  const { code, accessToken, refreshToken } = readPasswordCallback(href);

  if (code) {
    try {
      await auth.exchangeCodeForSession(code);
    } catch {
      // 换码失败不结束：初始化可能已经换成会话，或片段里还有隐式令牌。
    }
  }

  if (await hasSession(auth)) return "ready";

  if (accessToken && refreshToken) {
    try {
      const { data, error } = await auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error && data.session) return "ready";
    } catch {
      return "invalid";
    }
  }

  return (await hasSession(auth)) ? "ready" : "invalid";
}

let inflight: Promise<PasswordCallbackPhase> | null = null;

/**
 * 同一轮页面加载只承接一次。开发模式 effect 会挂载两次，
 * 第二次若再读地址栏，片段可能已被清掉。
 */
export function beginPasswordCallback(
  auth: PasswordCallbackAuth,
  href: string,
): Promise<PasswordCallbackPhase> {
  if (!inflight) {
    inflight = establishPasswordSession(auth, href).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
