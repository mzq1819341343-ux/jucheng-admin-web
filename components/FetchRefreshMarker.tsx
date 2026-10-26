import type { FetchRefreshMarker } from "@/lib/data";

/**
 * 数据刷新标记（指令53 C2）：一行展示抓数管道的最近成功时间与登录状态。
 * 数据只来自 fetch_logs：无成功记录时显示「暂无抓取记录（管道已备未启用）」，
 * 最新日志为 need_user_login 时状态显示「待登录 need_user_login」。
 */
export default function FetchRefreshMarkerLine({ marker }: { marker: FetchRefreshMarker }) {
  if (!marker.hasLogs || !marker.lastSuccessAt) {
    return (
      <p className="page-desc" style={{ marginTop: 8 }}>
        数据刷新：暂无抓取记录（管道已备未启用）
        {marker.needLogin ? " · 状态 待登录 need_user_login" : ""}
      </p>
    );
  }
  return (
    <p className="page-desc" style={{ marginTop: 8 }}>
      数据刷新：最近成功抓取 {marker.lastSuccessAt} · 状态{" "}
      {marker.needLogin ? "待登录 need_user_login" : "正常"}
    </p>
  );
}
