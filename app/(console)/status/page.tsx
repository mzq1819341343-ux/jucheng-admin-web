import type { ReactNode } from "react";
import {
  getCurrentUser,
  getFetchLogs,
  getFetchRefreshMarker,
  canSeeSensitive,
  getConfigFreshness,
  getSalaryDetailImport,
  getMetrics,
  getMyBusinesses,
  salaryDetailByMonth,
} from "@/lib/data";
import FetchRefreshMarkerLine from "@/components/FetchRefreshMarker";
import { money2 } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  success: { text: "成功", cls: "tag tag-ok" },
  pending: { text: "待启用", cls: "tag tag-pending" },
  need_user_login: { text: "待登录", cls: "tag tag-pending" },
  failed: { text: "失败", cls: "tag" },
  skipped: { text: "跳过", cls: "tag" },
};

export default async function StatusPage() {
  const user = await getCurrentUser();
  const sensitive = canSeeSensitive(user.role);
  // 指令133 A2 瀑布：日志 / 配置新鲜度 / 工资明细（仅老板）三路独立，先同批启动、
  // 再依次 await（启动即并发，串行深度一层）；Nav 的板块查询同批预热请求级缓存。
  // 刷新标记改吃已取回的日志（免其内部再发一次同一查询）。
  const freshnessPromise = getConfigFreshness(user);
  const detailPromise = user.role === "owner" ? getSalaryDetailImport(user) : Promise.resolve([]);
  const bizPromise = getMyBusinesses(user);
  const { logs, fromDb } = await getFetchLogs();
  const freshness = await freshnessPromise;
  const detailRows = await detailPromise;
  await bizPromise;
  // 指令74 A4 督工裁定（方向①）：真实模式下库里无抓取记录
  // （!fromDb 且非演示）时，记录节显式呈空态，与同页刷新标记的
  // 「暂无抓取记录」口径一致，不再渲染 FALLBACK 两行兜底；
  // 演示模式与 fromDb 为真时仍按 logs 原样渲染，不误伤。
  const fetchLogsEmpty = !fromDb && !user.demo;
  const refreshMarker = await getFetchRefreshMarker(user, { logs, fromDb });
  const fmtTime = (v: string | null) => (v ? v.replace("T", " ").slice(0, 16) : null);
  const configUpdated =
    [fmtTime(freshness.salaryRules), fmtTime(freshness.storeCosts)]
      .filter((v): v is string => !!v)
      .sort()
      .pop() ?? null;

  // 指令51：工资 0.01 校验从首页移到状态页——按 salary_detail_import 与月度汇总
  // 的实际对账结果生成（明细仅老板可读；差额月份逐个列出，不写死任何数字）。
  // 指令58 A3 裁定：对账行仅老板渲染；合伙人 / 店员整行不渲染（不挂「仅老板可见」占位）。
  let wageRecon: { tag: ReactNode; desc: string } | null = null;
  if (user.role !== "owner") {
    wageRecon = null;
  } else if (freshness.demo) {
    wageRecon = { tag: <span className="tag tag-pending">演示数据</span>, desc: "演示模式不做实际对账。" };
  } else {
    if (detailRows.length === 0) {
      wageRecon = {
        tag: <span className="tag tag-pending">明细未导入</span>,
        desc: "工资实表明细尚未导入，暂无对账结果；年回报工资项按月度汇总。",
      };
    } else {
      const { rows: combined } = await getMetrics("combined", user.role);
      const wageMap = new Map(combined.map((r) => [r.month, r.wage_cost ?? null]));
      const byMonth = salaryDetailByMonth(detailRows);
      let totalDiff = 0;
      const diffMonths: string[] = [];
      for (const [m, v] of Object.entries(byMonth)) {
        const w = wageMap.get(m);
        if (w === null || w === undefined) continue;
        const d = Math.round((v - w) * 100) / 100;
        totalDiff = Math.round((totalDiff + d) * 100) / 100;
        if (d !== 0) diffMonths.push(m);
      }
      const monthCount = Object.keys(byMonth).length;
      wageRecon =
        totalDiff === 0
          ? {
              tag: <span className="tag tag-ok">已对平</span>,
              desc: `实表明细覆盖 ${monthCount} 个月，与月度工资汇总逐月对账，差额 0.00 元。`,
            }
          : {
              tag: <span className="tag tag-pending">有差额</span>,
              desc: `实表明细覆盖 ${monthCount} 个月，与月度工资汇总差额 ${money2(totalDiff)} 元（差异月份：${diffMonths.join("、") || "—"}）；明细逐行与差额来源见「工资」页对账表。`,
            };
    }
  }

  return (
    <>
      <main className="container">
        <div className="eyebrow">
          <span className="en">DATA STATUS</span>
          <span className="eyebrow-cn">数据刷新状态</span>
        </div>
        <h1 className="page-title">数据刷新状态</h1>
        <p className="page-desc">各数据源最近更新时间与刷新方式（全部在免费额度内运行）。</p>

        {/* 指令58 A3：登录恢复操作说明只对老板 / 合伙人渲染，店员不展示老板操作指引行。 */}
        {sensitive ? (
          <div className="notice">
            爱回收后台登录状态：<strong>未登录（会话已过期）</strong>。自动抓取处于待启用状态——
            请老板点：在 Muse 浏览器里本人登录一次爱回收后台（或更新保存的密码），登录恢复并成功续抓一次 10 月数据后，再按 <span className="en">auto_fetch</span> 待启用配置开启定时抓取。不要把密码发到聊天里。
          </div>
        ) : null}

        <h2 className="section-title">10 月对账（待抓取）</h2>
        <div className="card">
          <div className="table-wrap">
            <table className="report">
              <tbody>
                <tr>
                  <td style={{ textAlign: "left", whiteSpace: "nowrap" }}>应抓区间</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                    订单按回收完成时间 2026-10-01 00:00:00 ~ 2026-10-25 23:59:59（万达 4594 / 友谊 5511 两店原生导出）；
                    加盟商对账单账单时间 2026-10（两店）。
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: "left", whiteSpace: "nowrap" }}>基线（不变）</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                    2026-01~09 已锁定台账：3,958 单 / 分润 416,661.32 元（跨月去重口径）；10 月只追加新行，不改基线。
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: "left", whiteSpace: "nowrap" }}>当前状态</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                    <span className="tag tag-pending">待登录 need_user_login</span>{" "}
                    拍机堂会话未在 Muse 浏览器恢复，抓数管道已备未启用，未建定时任务；本卡只展示状态，不写假进度。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="page-desc" style={{ margin: "14px 0 8px" }}>一键启用步骤（登录恢复后按序执行）：</p>
          <ol className="steps">
            <li>老板在 Muse 浏览器面板本人登录一次拍机堂（密码只在登录页输入，不经聊天）。</li>
            <li>
              按仓库 <span className="en">docs/fetch-pipeline/10月抓取运行单.md</span> 首抓 10 月订单与对账单，落盘并更新 asof=2026-10-25 后重跑驾驶舱。
            </li>
            <li>对账校验：10 月单量 / 分润与后台一致；台账只新增 10 月行；7 单跨月重复只记待财务核对、不重复计入。</li>
            <li>首抓对账通过后，再启用两条定时任务：每日 09:30 增量、每月 3 日 10:00 抓上月整月（Asia/Shanghai）。</li>
          </ol>
        </div>

        <h2 className="section-title">数据源</h2>
        <FetchRefreshMarkerLine marker={refreshMarker} />
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
              {wageRecon ? (
                <tr>
                  <td>工资明细对账（实表 vs 月度汇总）</td>
                  <td>{wageRecon.tag}</td>
                  <td>导入后自动对账</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{wageRecon.desc}</td>
                </tr>
              ) : null}
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
                      ? "—"
                      : configUpdated ?? "暂无录入"}
                  。工资体系在「工资」页配置、门店成本在「门店成本」页录入；无自动抓取，更新时间以人工录入为准。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 指令57 自扫：抓取日志整节仅老板 / 合伙人渲染；店员不再出「无权限」占位卡。 */}
        {sensitive ? (
          <>
          <h2 className="section-title">最近抓取 / 导入日志</h2>
          {fetchLogsEmpty ? (
            <div className="card">
              <p className="empty">暂无抓取记录（管道已备未启用）</p>
            </div>
          ) : (
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
          )}
          </>
        ) : null}
      </main>
    </>
  );
}
