import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "聚成 · 公司业务总后台",
  description: "聚天下英豪，成全球唯一 —— 聚成公司业务总后台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <footer className="site-footer">
          聚成 · 聚天下英豪，成全球唯一 ｜ 数据口径：爱回收驾驶舱 v3.3 汇总 ｜ 本站只展示汇总数据，不含个人明细
        </footer>
      </body>
    </html>
  );
}
