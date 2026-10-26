import Nav from "@/components/Nav";
import { getCurrentUser, getFetchLogs, canSeeSensitive, getConfigFreshness } from "@/lib/data";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  success: { text: "成功", cls: "tag tag-ok" },
  pending: { text: "待启用", cls: "tag tag-pending" },
  failed: { text: "失败", cls: "tag" },
  skipped: { text: "跳过", cls: "tag" },
};

export default async function StatusPage() {
  const user = await getCurrentUser();
  const sensitive = canSeeSensitive(user.role);
  const { logs } = await getFetchLogs();
  const freshness = await getConfigFreshness(user);
  const fmtTime = (v: string | null) => (v ? v.replace("T", " ").slice(0, 16) : null);
  const configUpdated =
    [fmtTime(freshness.salaryRules), fmtTime(freshness.storeCosts)]
      .filter((v): v is string => !!v)
      .sort()
      .pop() ?? null;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">DATA STATUS</span>
          <span className="eyebrow-cn">数据刷新状态</span>
        </div>
        <h1 className="page-title">数据刷新状态</h1>
        <p className="page-desc">各数据源最近更新时间与刷新方式（全部在免费额度内运行）。</p>

        <div className="notice">
          爱回收后台登录状态：<strong>未登录（会话已过期）</strong>。自动抓取处于待启用状态——
          请老板点：在 Muse 浏览器里本人登录一次爱回收后台（或更新保存的密码），登录恢复并成功续抓一次 10 月数据后，再按 <span className="en">auto_fetch</span> 待启用配置开启定时抓取。不要把密码发到聊天里。
        </div>

        <h2 className="section-title">数据源</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>数据源</th>
                <th>最近状态</th>
                <th>刷新方式</th>
                <th style={{ textAlign: "left" }}>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>爱回收经营汇总（驾驶舱 <span className="en">v3.3</span>）</td>
                <td>
                  <span className="tag tag-ok">已更新至 2026-09</span>
                </td>
                <td>手动导入</td>
                <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                  当前为 v3.3 汇总（2026-01~09，3,958 单 / 416,661.32 元）；10 月数据待登录恢复后抓取导入。
                </td>
              </tr>
              <tr>
                <td>爱回收自动抓取</td>
                <td>
                  <span className="tag tag-pending">待启用</span>
                </td>
                <td>定时抓取（待启用）</td>
                <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                  已定策略：增量抓取 + 每月 3 日抓上月整月（<span className="en">Asia/Shanghai</span>）；会话过期只停下记录，不重试登录、不绕过验证。
                </td>
              </tr>
              <tr>
                <td>工资人效汇总</td>
                <td>
                  <span className="tag tag-ok">已更新至 2026-09</span>
                </td>
                <td>手动导入（仅汇总）</td>
                <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                  只存按月汇总（工资成本、占比、人均），工资原表与个人明细不进本站、不进仓库。
                </td>
              </tr>
              <tr>
                <td>工资体系 / 门店成本配置</td>
                <td>
                  {freshness.demo ? (
                    <span className="tag tag-pending">演示数据</span>
                  ) : configUpdated ? (
                    <span className="tag tag-ok">已录入</span>
                  ) : (
                    <span className="tag tag-pending">暂无录入</span>
                  )}
                </td>
                <td>老板人工录入</td>
                <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                  最近更新：
                  {freshness.demo
                    ? "演示数据"
                    : user.role === "staff"
                      ? "仅老板 / 合伙人可见"
                      : configUpdated ?? "暂无录入"}
                  。工资体系在「工资」页配置、门店成本在「门店成本」页录入；无自动抓取，更新时间以人工录入为准。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="section-title">最近抓取 / 导入日志</h2>
        {sensitive ? (
          <div className="card table-wrap">
            <table className="report">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th style={{ textAlign: "left" }}>信息</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i}>
                    <td>{String(l.created_at).replace("T", " ").slice(0, 16)}</td>
                    <td className="en">{l.source}</td>
                    <td>
                      <span className={STATUS_LABEL[l.status]?.cls ?? "tag"}>
                        {STATUS_LABEL[l.status]?.text ?? l.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>{l.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card">
            <p className="empty">无权限：抓取日志仅老板 / 合伙人可见。</p>
          </div>
        )}
      </main>
    </>
  );
}
