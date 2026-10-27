import Nav from "@/components/Nav";
import BusinessAccessToggles from "@/components/BusinessAccessToggles";
import MemberInvites from "@/components/MemberInvites";
import { getCurrentUser, getAllMembers, getMemberInvites, getMyBusinesses, ROLE_LABEL, type Profile } from "@/lib/data";

export const dynamic = "force-dynamic";

const ROLE_DOCS: { key: string; role: React.ReactNode; can: React.ReactNode; cannot: React.ReactNode }[] = [
  {
    key: "owner",
    role: (
      <>
        老板（<span className="en">owner</span>）
      </>
    ),
    can: "全部页面与汇总；成员管理（建号、改角色、按板块授权）；数据导入与抓取配置。",
    cannot: "无（个人工资明细本站不入库，老板也看不到）。",
  },
  {
    key: "partner",
    role: (
      <>
        合伙人（<span className="en">partner</span>）
      </>
    ),
    can: "被授权板块的经营汇总：仪表盘、报表（含工资成本、净利暂定）、两店对比、刷新状态。",
    cannot: "成员管理只读；未授权板块不可见、不可直进；不能改数据。",
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
        被授权板块的运营数据：单量、分润、上门、单均（<span className="en">v_ops_metrics</span> 口径）。
      </>
    ),
    cannot: "工资成本、净利等敏感数据不可见（数据层隔离）；未授权板块不可进；成员列表不可见。",
  },
];

/** 演示模式下的示例成员（仅演示勾选交互，不落库） */
const DEMO_MEMBERS: Profile[] = [
  { id: "demo-partner", role: "partner", display_name: "演示合伙人", store_scope: "all" },
  { id: "demo-staff", role: "staff", display_name: "演示店员", store_scope: "all" },
  // 显示名即邮箱 = 新注册账号的默认形态（handle_new_user 触发器），供待邀请名单演示按邮箱匹配
  { id: "demo-new-staff", role: "staff", display_name: "staff-demo@example.com", store_scope: "all" },
];
const DEMO_GRANTS: Record<string, string[]> = {
  "demo-partner": ["aihuishou"],
  "demo-staff": [],
  "demo-new-staff": [],
};

export default async function MembersPage() {
  const user = await getCurrentUser();
  const isOwner = user.role === "owner";
  // 指令133 A2 瀑布：成员与待邀请两路独立（仅依赖 user），由串行改并行一层；
  // Nav 的板块查询同批预热请求级缓存。非老板分支仍以空结果占位、不发查询。
  const [membersRes, invitesRes] = await Promise.all([
    isOwner
      ? getAllMembers()
      : Promise.resolve({ members: [] as Profile[], accessByUser: {} as Record<string, string[]>, fromDb: false }),
    isOwner ? getMemberInvites(user) : Promise.resolve({ invites: [], tableReady: true }),
    getMyBusinesses(user),
  ]);
  const { members, accessByUser, fromDb } = membersRes;
  const showDemoMembers = isOwner && user.demo && members.length === 0;
  // 指令59 A6：待邀请名单仅老板拉取与渲染（合伙人/店员整节不渲染）。
  const { invites, tableReady } = invitesRes;
  const matchMembers = (showDemoMembers ? DEMO_MEMBERS : members).map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }));

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

        {/* 指令58 A3 裁定：店员整段不渲染（标题与提示一并撤下）；合伙人只留中性只读说明，不挂权限占位标签。 */}
        {user.role === "staff" ? null : (
          <h2 className="section-title">成员列表与业务授权</h2>
        )}
        {user.role === "staff" ? null : !isOwner ? (
          <div className="card">
            <p className="empty">
              合伙人可查看上方角色说明；成员列表与业务授权由老板维护，本页不展示成员明细。
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
              演示示例成员，勾选不落库。
            </p>
          </>
        ) : members.length === 0 ? (
          <div className="card">
            <p className="empty">
              {fromDb
                ? "暂无成员记录。"
                : "暂无成员记录：按下方步骤建号后在此列示。"}
            </p>
            <ol className="steps">
              <li>
                <span className="en">Supabase</span> 控制台 → <span className="en">Authentication</span> →{" "}
                <span className="en">Users</span>，用成员邮箱建号或发邀请。
              </li>
              <li>
                首次登录自动生成 <span className="en">profiles</span>（默认 <span className="en">staff</span>）。
              </li>
              <li>
                <span className="en">Table Editor</span> → <span className="en">profiles</span> 改{" "}
                <span className="en">role</span> 与 <span className="en">store_scope</span>。
              </li>
              <li>回本页为成员勾选业务板块授权（勾选即保存）。</li>
              <li>成员重新登录后按新角色与授权显示。</li>
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

        {/* 指令59 A6：待邀请名单仅老板渲染；合伙人/店员整节不渲染（58 A3 最严口径）。 */}
        {isOwner ? (
          <>
            <h2 className="section-title">待邀请名单</h2>
            <MemberInvites
              initialInvites={invites}
              members={matchMembers}
              demo={user.demo}
              tableReady={tableReady}
              userId={user.id}
            />
          </>
        ) : null}
      </main>
    </>
  );
}
