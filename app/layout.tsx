import type { Metadata } from "next";
import "./globals.css";
import "./globals-extra.css";
import HashAuthForwarder from "@/components/HashAuthForwarder";
import { BRAND_SLOGAN } from "@/lib/brand";

export const metadata: Metadata = {
  title: "聚成 · 公司业务总后台",
  description: `${BRAND_SLOGAN} —— 聚成公司业务总后台`,
  openGraph: {
    title: "聚成 · 公司业务总后台",
    description: `${BRAND_SLOGAN} —— 聚成公司业务总后台`,
  },
};

/**
 * 指令132 A1：函数区域亚太化——根 layout 的 preferredRegion 覆盖全部子路由，
 * 与 vercel.json 的 regions 双保险，把 SSR / Server Action 执行地从默认
 * iad1（弗吉尼亚）钉到 hkg1（香港），靠近老板（中国）与 Supabase（新加坡）。
 */
export const preferredRegion = "hkg1";

/** 本轮固定日间。忽略已存的夜间偏好，避免首帧闪回藏青金（指令34 的防闪脚本保留，只锁白天）。 */
const THEME_INIT_SCRIPT = `(function(){try{document.documentElement.setAttribute("data-theme","light");}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <HashAuthForwarder />
        {children}
        <footer className="site-footer">© {new Date().getFullYear()} 聚成</footer>
      </body>
    </html>
  );
}
