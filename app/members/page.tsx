import Nav from "@/components/Nav";
import { getCurrentUser, getAllMembers, ROLE_LABEL } from "@/lib/data";

export const dynamic = "force-dynamic";

const ROLE_DOCS = [
  {
    role: "老板（owner）",
    can: "全部页面与全部汇总数据；成员管理（建号、改角色）；数据导入与抓取配置。",
    cannot: "无（但本站不存任何个人工资明细，老板也看不到个人明细——源头即不入库）。",
  },
  {
    role: "合伙人（partner）",
    can: "全部经营汇总：仪表盘、爱回收报表（含工资成本、工资占分润比、人均、净利暂定）、刷新状态。",
    cannot: "成员管理只读（能看角色说明，不能建号/改角色）；不能改数据。",
  },
  {
    role: "店员（staff）",
    can: "运营数据：单量、分润、上门单量、单均分润（v_ops_metrics 视图口径）。",
    cannot: "工资成本、工资占分润比、人均分润、净利暂定不可见（数据层隔离，不只是页面隐藏）；成员列表不可见。",
  },
];

export default async function MembersPage() {
  const user = await getCurrentUser();
  const isOwner = user.role === "owner";
  const { members, fromDb } = isOwner
    ? await getAllMembers()
    : { members: [], fromDb: false };

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <h1 className="page-title">成员与权限</h1>
        <p className="page-desc">
          当前用户角色：<strong>{ROLE_LABEL[user.role]}</strong>
          {user.demo ? "（演示模式，成员页可切换演示角色）" : ""}
          {user.email ? `｜账号：${user.email}` : ""}
        </p>

        <h2 className="section-title">角色说明（三级）</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>角色</th>
                <th style={{ textAlign: "left" }}>能看 / 能做</th>
                <th style={{ textAlign: "left" }}>不能看 / 不能做</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_DOCS.map((r) => (
                <tr key={r.role}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.role}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.can}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.cannot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="section-title">成员列表</h2>
        {!isOwner ? (
          <div className="card">
            <p className="empty">
              {user.role === "partner"
                ? "合伙人可查看角色说明，成员管理为只读：成员列表仅老板可见。"
                : "无权限：成员列表仅老板可见。"}
            </p>
          </div>
        ) : members.length === 0 ? (
          <div className="card">
            <p className="empty">
              {fromDb
                ? "profiles 表暂无成员记录。"
                : "尚未连接 Supabase（或表中暂无数据），先按下面步骤建号。"}
            </p>
            <ol className="steps">
              <li>老板在 Supabase 控制台 → Authentication → Users → Add user，用成员邮箱建号（或发邀请）。</li>
              <li>新账号首次登录后会自动生成 profiles 记录（默认角色 staff、显示名取邮箱）。</li>
              <li>老板在 Supabase 控制台 → Table Editor → profiles，把该成员 role 改为 owner / partner / staff，并按需设置 store_scope（all / wanda / friendship）。</li>
              <li>改完后成员重新登录即按新角色显示（净利、工资占比等敏感数据对 staff 自动隔离）。</li>
            </ol>
          </div>
        ) : (
          <div className="card table-wrap">
            <table className="report">
              <thead>
                <tr>
                  <th>显示名</th>
                  <th>角色</th>
                  <th>门店范围</th>
                  <th>用户 ID</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.display_name ?? "—"}</td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td>{m.store_scope}</td>
                    <td>{m.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
