import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoAllowed } from "./lib/demo";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 路由保护：
 * - 未配置 Supabase 环境变量时（预览/演示部署）：放行，页面内部走演示模式；
 * - 已配置时：无登录会话访问业务页面 → 跳 /login；已登录访问 /login → 跳首页。
 * 演示模式 Cookie（demo_role）只影响未配置/未登录时的演示展示，
 * 真实权限一律以 Supabase 会话 + profiles.role + RLS 为准。
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  if (!url || !anon) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  let authed = false;

  // 指令165 P0 快路径：请求完全不带 Supabase 鉴权 Cookie（sb-<ref>-auth-token，
  // 含分片 .0/.1 与 -code-verifier 变体）时，本地必然无会话——对照 auth-js
  // 2.118 源码：getClaims 在 getSession 无会话时直接返回空（不拉 JWKS、不发
  // 网络），getUser 亦以 AuthSessionMissingError 作返回值本地返回（不发网络、
  // 不写 Cookie），原流程对这类请求的结论恒为 authed=false 且响应不带
  // Set-Cookie。故可整段跳过建客户端 + 两次会话读取，结论与副作用逐路等价；
  // 只要带任一鉴权 Cookie（含过期会话待刷新）仍走下方原全路径，一字不变。
  // 收益面：/login 等静态页由边缘缓存出页前先跑中间件，无会话访问（首次访客、
  // 探活、督工 curl 基线）不再为注定无会话的请求付出中间件内的会话读取开销。
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  if (hasAuthCookie) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // 指令133 A2 中间件验签：项目 JWT 已切非对称签名（JWKS 实测 ES256 EC 公钥在册），
    // 优先 getClaims() 本地验签（签名 + 过期校验走项目公钥，暖实例零网络往返）；
    // 取不到 claims（无会话 / 对称旧令牌 / JWKS 不可达）时回落 getUser() 权威校验，
    // 与原行为逐路一致——会话刷新仍由 ssr 客户端在会话读取阶段完成并回写 Cookie。
    const { data: claimsData } = await supabase.auth.getClaims();
    authed = Boolean(claimsData?.claims);
    if (!authed) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      authed = Boolean(user);
    }
  }

  // 指令40-2：生产环境忽略演示 Cookie（proxy 同步收口）
  const hasDemo = isDemoAllowed() && request.cookies.has("demo_role");
  const isLoginPage = pathname === "/login";
  // 设密码承接页：会话来自 URL hash（服务端看不到），未登录也要放行到页面由浏览器端承接
  const isAuthPage = pathname.startsWith("/auth/");

  if (!authed && !hasDemo && !isLoginPage && !isAuthPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }
  if (authed && isLoginPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
