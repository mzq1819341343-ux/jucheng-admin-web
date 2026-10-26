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
                <td>工资（我的薪酬 / 门店汇总）</td>
                <td>录入后可见</td>
                <td>仅门店汇总</td>
                <td>仅自己已发布月份</td>
              </tr>
              <tr>
                <td>门店成本（房租 / 水电 / 其他）</td>
                <td>可录入 / 可见</td>
                <td>只读可见</td>
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

        <h2 className="section-title">工资与成本</h2>
        <div className="card">
          <ul className="plain">
            <li>
              <strong>老板：</strong>在「工资」页配置工资体系规则（岗位 / 职级、底薪、提成规则），
              按人按月录入员工工资并发布；查看全员工资行与两店汇总；在「门店成本」页录入两店每月的房租、水电、其他成本，
              已录入成本会进入爱回收仪表盘的净利暂定核算。
            </li>
            <li>
              <strong>合伙人：</strong>在「工资」页只看被授权门店的月度工资汇总（人数与合计），看不到他人的工资明细；
              「门店成本」可只读查看，不能修改。
            </li>
            <li>
              <strong>店员：</strong>在「我的薪酬」只看自己已发布月份的实发与构成（底薪 / 提成 / 扣款），
              看不到门店成本，也看不到任何他人的工资数据。
            </li>
            <li>
              工资数字由老板提供后录入：录入时员工与登录账号一一对应；本站只展示按角色该看的口径，
              <strong>不展示工资原表</strong>，也没有原表导出。工资尚未发布时，「我的薪酬」会显示尚未发布，属正常状态。
            </li>
            <li>
              <strong>两店合同要点（已进成本核算）：</strong>
              万达上一期月租 4,100.04 元/月（单价 341.67 元/㎡，2026-01~2026-11，万达负责人王州确认）；
              新合同综合服务费 4,509.60 元/月（展示费 3,921.60 + 物业费 588.00，2026-11-28 生效、2026-12 起按新价记账）；
              友谊年租金 85,000 元、按月摊 7,083.33 元记房租（2026-02 起）。
              两店保证金（万达 14,019.20 元、友谊 13,000 元）只在合同台账登记，<strong>不进月成本</strong>；
              万达电费（自装电表按量预缴）按实际发生逐月录入，未取得的月份不计入净利；
              友谊除年租金外<strong>无其他费用</strong>——合同中的联营扣点 8% 只是避税写法、非实际成本，不计入核算；管理费未实际发生，不记。
              合同全文要点在「门店成本」页的合同台账区。
            </li>
          </ul>
        </div>

        <h2 className="section-title">工资怎么算</h2>
        <div className="card">
          <ul className="plain">
            <li>
              <strong>底薪：</strong>合计 2,000 元/月 = 基础 1,000 + 全勤 500 + 拉新 500。
              拉新口径以工资表模板为准（模板到后核对更新）。
            </li>
            <li>
              <strong>线上订单提成：</strong>一律 1%。
            </li>
            <li>
              <strong>门店提成（阶梯，取最高达成档）：</strong>业绩 ≥ 30,000 元 → 3%；业绩 ≥ 60,000 元 → 4%。
            </li>
            <li>
              <strong>配件提成：</strong>业绩 &lt; 6,500 元 → 20%；≥ 6,500 元 → 30%；≥ 10,000 元 → 40%。
            </li>
            <li>
              <strong>上门提成：</strong>卖出机子利润的 50%。
            </li>
            <li>
              <strong>生效起始月：</strong>当前规则的生效起始月待老板确认；确认后，新规则自该月起算，
              此前月份按历史规则回算（双版本）。老板在「工资」页的工资体系配置里填写生效起始月。
              每位员工当月应发 = 底薪分项 + 各提成 − 扣款，由老板按月录入并发布后在「我的薪酬」可见，本站不挂工资原表。
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
            <li>
              <strong>查看工资与成本：</strong>顶部导航「工资」（店员显示为「我的薪酬」）查看与自己相关的工资；
              门店成本在爱回收板块的「门店成本」页（仅老板 / 合伙人可见）。
            </li>
          </ol>
        </div>

        <h2 className="section-title">看不到某个板块？</h2>
        <div className="card">
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            未被授权的业务板块不会出现在你的总览与导航中，直接输入地址也无法进入——这是权限设置，不是故障。
            需要开通时请联系老板，由老板在「成员与权限」页为你的账号勾选对应板块，授权后重新打开页面即可看到。
          </p>
        </div>

        <h2 className="section-title">遇到问题</h2>
        <div className="card">
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            登录失败、密码遗忘、板块未开通、数据有疑问，请联系老板处理。密码遗忘时由老板重发邀请邮件，按邮件链接重新设置密码。
          </p>
        </div>
      </main>
    </>
  );
}
