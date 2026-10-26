import Nav from "@/components/Nav";
import { getCurrentUser, ROLE_LABEL } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * 操作手册（指令40-1）：全角色可见，登录后可达。
 * 内容只讲正式使用：三角色权限、登录与设密码、主题、业务入口、异常处理。
 */
export default async function HelpPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Nav user={user} />
      <main className="container">
        <div className="eyebrow">
          <span className="en">GUIDE</span>
          <span className="eyebrow-cn">操作手册</span>
        </div>
        <h1 className="page-title">操作手册</h1>
        <p className="page-desc">
          当前账号角色：{ROLE_LABEL[user.role]}。本页说明各角色的权限范围与常用操作。
        </p>

        <h2 className="section-title">角色与权限</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>事项</th>
                <th>老板</th>
                <th>合伙人</th>
                <th>店员</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>业务板块入口</td>
                <td>全部板块</td>
                <td>仅被授权的板块</td>
                <td>仅被授权的板块</td>
              </tr>
              <tr>
                <td>经营报表（单量 / 分润 / 上门等）</td>
                <td>可见</td>
                <td>可见</td>
                <td>可见</td>
              </tr>
              <tr>
                <td>工资占分润比 / 净利暂定等敏感指标</td>
                <td>可见</td>
                <td>可见</td>
                <td>不显示</td>
              </tr>
              <tr>
                <td>成员管理（邀请 / 改角色 / 按板块授权）</td>
                <td>可管理</td>
                <td>不可</td>
                <td>不可</td>
              </tr>
              <tr>
                <td>数据范围</td>
                <td>全公司</td>
                <td>被授权板块</td>
                <td>被授权板块及所属门店范围</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <ul className="plain">
            <li>
              <strong>老板（<span className="en">Owner</span>）：</strong>
              管理全部业务板块与全部指标（含工资占分润比、净利暂定）；在「成员与权限」页邀请成员、调整角色、按业务板块逐个授权。
            </li>
            <li>
              <strong>合伙人（<span className="en">Partner</span>）：</strong>
              查看被授权板块的入口与报表，经营指标与敏感指标均可见；不能管理成员，不能进入未授权板块。
            </li>
            <li>
              <strong>店员（<span className="en">Staff</span>）：</strong>
              查看被授权板块的日常经营数据与报表，数据范围以所属门店为准；工资占比、净利等敏感指标不显示，也没有成员管理入口。
            </li>
          </ul>
        </div>

        <h2 className="section-title">常用操作</h2>
        <div className="card">
          <ol className="steps">
            <li>
              <strong>登录：</strong>打开本站登录页，输入老板分配的邮箱与密码。
              首次使用时，老板会发送邀请邮件：点击邮件中的链接进入「设置登录密码」页，设置至少 8 位的密码后即自动登录。邀请链接过期时，请联系老板重发。
            </li>
            <li>
              <strong>切换昼夜主题：</strong>点击页面右上角的主题切换按钮（白天 / 夜间），选择会保存在本机，下次打开自动沿用。
            </li>
            <li>
              <strong>进入业务板块：</strong>在「公司总览」页点击业务板块卡片，或使用顶部导航进入。板块内可查看仪表盘与报表。
            </li>
            <li>
              <strong>查看数据更新情况：</strong>「数据刷新状态」页列出各数据源的最近更新时间与状态。
            </li>
          </ol>
        </div>

        <h2 className="section-title">看不到某个板块？</h2>
        <div className="card">
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            未被授权的业务板块不会出现在你的总览与导航中，直接输入地址也无法进入——这是权限设置，不是故障。
            需要开通时请联系老板，由老板在「成员与权限」页为你的账号勾选对应板块，授权后重新打开页面即可看到。
          </p>
        </div>

        <h2 className="section-title">遇到问题</h2>
        <div className="card">
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            登录失败、密码遗忘、板块未开通、数据有疑问，请联系老板处理。密码遗忘时由老板重发邀请邮件，按邮件链接重新设置密码。
          </p>
        </div>
      </main>
    </>
  );
}
