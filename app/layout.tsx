import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "聚成 · 公司业务总后台",
  description: "聚天下英豪，成全球唯一 —— 聚成公司业务总后台",
};

/** 首帧渲染前从 localStorage 恢复主题（默认夜间），避免主题闪烁（指令34） */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("jucheng-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <footer className="site-footer">
          聚成 · 聚天下英豪，成全球唯一 ｜ 数据口径：爱回收驾驶舱 <span className="en">v3.3</span> 汇总 ｜ 本站只展示汇总数据，不含个人明细
        </footer>
      </body>
    </html>
  );
}
