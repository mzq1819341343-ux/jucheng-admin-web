import Nav from "@/components/Nav";
import BusinessAccessToggles from "@/components/BusinessAccessToggles";
import { getCurrentUser, getAllMembers, ROLE_LABEL, type Profile } from "@/lib/data";

export const dynamic = "force-dynamic";

const ROLE_DOCS: { key: string; role: React.ReactNode; can: React.ReactNode; cannot: React.ReactNode }[] = [
  {
    key: "owner",
    role: (
      <>
        老板（<span className="en">owner</span>）
      </>
    ),
    can: "全部页面与全部汇总数据；全部业务板块；成员管理（建号、改角色、按业务板块授权）；数据导入与抓取配置。",
    cannot: "无（但本站不存任何个人工资明细，老板也看不到个人明细——源头即不入库）。",
  },
  {
    key: "partner",
    role: (
      <>
        合伙人（<span className="en">partner</span>）
      </>
    ),
    can: (
      <>
        被授权业务板块的全部经营汇总：仪表盘、爱回收报表（含工资成本、工资占分润比、人均、净利暂定）、刷新状态。
      </>
    ),
    cannot: "成员管理只读（能看角色说明，不能建号/改角色/改授权）；未被勾选的业务板块不可见、不可直进；不能改数据。",
  },
  {
    key: "staff",
    role: (
      <>
        店员（<span className="en">staff</span>）
      </>
    ),
    can: (
      <>
        被授权业务板块的运营数据：单量、分润、上门单量、单均分润（<span className="en">v_ops_metrics</span> 视图口径）。
      </>
    ),
    cannot: "工资成本、工资占分润比、人均分润、净利暂定不可见（数据层隔离，不只是页面隐藏）；未授权板块不可进；成员列表不可见。",
  },
];

/** 演示模式下的示例成员（仅演示勾选交互，不落库） */
const DEMO_MEMBERS: Profile[] = [
  { id: "demo-partner", role: "partner", display_name: "演示合伙人", store_scope: "all" },
  { id: "demo-staff", role: "staff", display_name: "演示店员", store_scope: "all" },
];
const DEMO_GRANTS: Record<string, string[]> = {
  "demo-partner": ["aihuishou"],
  "demo-staff": [],
};

export default async function MembersPage() {
  const user = await getCurrentUser();
  const isOwner = user.role === "owner";
  const { members, accessByUser, fromDb } = isOwner
    ? await getAllMembers()
    : { members: [] as Profile[], accessByUser: {} as Record<string, string[]>, fromDb: false };
  const showDemoMembers = isOwner && user.demo && members.length === 0;

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">MEMBERS</span>
          <span className="eyebrow-cn">成员与权限</span>
        </div>
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
                <tr key={r.key}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.role}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.can}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.cannot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="section-title">成员列表与业务授权</h2>
        {!isOwner ? (
          <div className="card">
            <p className="empty">
              {user.role === "partner"
                ? "合伙人可查看角色说明，成员管理为只读：成员列表与业务授权仅老板可见可改。"
                : "无权限：成员列表与业务授权仅老板可见可改。"}
            </p>
          </div>
        ) : showDemoMembers ? (
          <>
            <div className="card table-wrap">
              <table className="report">
                <thead>
                  <tr>
                    <th>显示名</th>
                    <th>角色</th>
                    <th>门店范围</th>
                    <th className="access-cell">业务授权（勾选）</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_MEMBERS.map((m) => (
                    <tr key={m.id}>
                      <td>{m.display_name}</td>
                      <td>{ROLE_LABEL[m.role]}</td>
                      <td>
                        <span className="en">{m.store_scope}</span>
                      </td>
                      <td className="access-cell">
                        <BusinessAccessToggles
                          userId={m.id}
                          initialGranted={DEMO_GRANTS[m.id] ?? []}
                          demo
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="page-desc" style={{ marginTop: 12 }}>
              以上为演示示例成员，勾选仅本地演示、不落库。正式建号步骤见下方说明。
            </p>
          </>
        ) : members.length === 0 ? (
          <div className="card">
            <p className="empty">
              {fromDb
                ? "profiles 表暂无成员记录。"
                : "尚未连接 Supabase（或表中暂无数据），先按下面步骤建号。"}
            </p>
            <ol className="steps">
              <li>
                老板在 <span className="en">Supabase</span> 控制台 → <span className="en">Authentication</span> →{" "}
                <span className="en">Users</span> → <span className="en">Add user</span>，用成员邮箱建号（或发邀请）。
              </li>
              <li>
                新账号首次登录后会自动生成 <span className="en">profiles</span> 记录（默认角色{" "}
                <span className="en">staff</span>、显示名取邮箱）。
              </li>
              <li>
                老板在 <span className="en">Supabase</span> 控制台 → <span className="en">Table Editor</span> →{" "}
                <span className="en">profiles</span>，把该成员 <span className="en">role</span> 改为{" "}
                <span className="en">owner / partner / staff</span>，并按需设置 <span className="en">store_scope</span>（
                <span className="en">all / wanda / friendship</span>）。
              </li>
              <li>在本页成员列表里为该成员勾选可进入的业务板块（按业务单独授权，勾选即保存到授权表）。</li>
              <li>改完后成员重新登录即按新角色与业务授权显示（未授权板块不可见、不可直进；敏感数据对 staff 自动隔离）。</li>
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
                  <th className="access-cell">业务授权（勾选）</th>
                  <th>用户 ID</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.display_name ?? "—"}</td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td>
                      <span className="en">{m.store_scope}</span>
                    </td>
                    <td className="access-cell">
                      {m.role === "owner" ? (
                        <span className="demo-note">老板：全部板块（不受勾选限制）</span>
                      ) : (
                        <BusinessAccessToggles
                          userId={m.id}
                          initialGranted={accessByUser[m.id] ?? []}
                          demo={user.demo}
                        />
                      )}
                    </td>
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
