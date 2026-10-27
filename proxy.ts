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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 指令40-2：生产环境忽略演示 Cookie（proxy 同步收口）
  const hasDemo = isDemoAllowed() && request.cookies.has("demo_role");
  const isLoginPage = pathname === "/login";
  // 设密码承接页：会话来自 URL hash（服务端看不到），未登录也要放行到页面由浏览器端承接
  const isAuthPage = pathname.startsWith("/auth/");

  if (!user && !hasDemo && !isLoginPage && !isAuthPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }
  if (user && isLoginPage) {
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
