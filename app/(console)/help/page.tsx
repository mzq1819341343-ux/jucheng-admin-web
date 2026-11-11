import HelpRoleName from "@/components/HelpRoleName";
import { PAYROLL_CALIBER as CALIBER } from "@/lib/realtime-payroll";

/**
 * 操作手册：全角色可见，登录后可达。
 * 正文不读会话，可静态生成；角色名由布局里已经解析的会话填上。
 * 工资默认档引用 PAYROLL_CALIBER，页面上保存的配置优先；这里不算薪。
 */
export default function HelpPage() {
  const storeLadder = [...CALIBER.storeTiers]
    .sort((a, b) => a.min - b.min)
    .map((tier) => `满 ${tier.min.toLocaleString("zh-CN")} 元按 ${tier.pct}%`)
    .join("，");
  const baseDefault = CALIBER.basePerPerson.toLocaleString("zh-CN");

  return (
    <>
      <main className="container">
        <div className="eyebrow">
          <span className="en">GUIDE</span>
          <span className="eyebrow-cn">操作手册</span>
        </div>
        <h1 className="page-title">操作手册</h1>
        <p className="page-desc">
          当前账号角色：<HelpRoleName />。本页说明各角色的权限范围与常用操作。
        </p>
        <div className="help-notice" role="note">
          本页截图与数字均为虚构示例，用于教学；与线上真实经营数据无关。
        </div>

        <h2 className="section-title">左侧导航</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            登录后，左侧是一条深蓝色竖栏。栏目按文件夹展开：先打开「项目」，再打开「爱回收」。
          </p>
          <ul className="plain">
            <li>
              <strong>经营：</strong>
              总览、报表、两店对比。老板和合伙人还有「门店成本」和「净利构成」。店员的经营里只有前三项。
            </li>
            <li>
              <strong>员工：</strong>
              老板和合伙人看到「薪资」，店员看到「我的薪酬」；旁边是「成员」。
            </li>
            <li>
              <strong>报销：</strong>
              仍是爱回收下面单独的一项。
            </li>
            <li>
              文件夹下面是「数据状态」和「操作手册」。爱回收的各个页面都收在上面这组文件夹里。
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            手机上，左上角的菜单按钮（☰）打开同一套文件夹。点其中一个链接、点遮罩，或按 Esc，菜单收起。
          </p>
        </div>

        <h2 className="section-title">总览怎么看</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            总览是一块经营面板。先用「上月 / 本月」选月份，再用「全部」或门店名选门店，然后看一排指标格：
            门店回收、目标达成、配件、网单、失误。老板和合伙人多一格「当月工资」，店员没有这一格。
            门店回收没有数时显示「暂无」。回收目标还没设时，目标达成显示「未设定」。
            配件目前显示「暂无」，销售额尚未接通。网单、失误、当月工资在当月还没有草案时也显示「暂无」。
          </p>
          <p>
            老板在这一页的「设目标」里，按人、按店、按月填写回收目标和配件销售目标。配件填销售额。
            达成率只加总同一家店、当月在职人员的回收目标。
          </p>
          <p>
            指标下面有两张按日走势（门店回收、配件销售），目前显示「暂无」。
            再往下是门店排名、员工回收排名、员工配件排名，目前显示「未接通」。
            这几块先占位，页面上还没有每日曲线和排行数据。
          </p>
          <p>
            扣成本后的净利、利润率（分润 / 营收）和年回报率在「报表」。
            两店并排在「两店对比」。房租、水电和其他成本在「门店成本」。
            从分润一步步扣到公司口径净利，看「净利构成」。
          </p>
          <figure className="help-shot">
            <a href="/help-shots/overview.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/overview.png" alt="经营概览：侧栏展开项目和爱回收，指标卡与设目标，走势显示暂无，门店排名显示未接通。图中金额为示例数字" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。示例数字。桌面经营概览：侧栏展开「项目 → 爱回收」；指标卡和设目标；门店回收与配件销售走势显示「暂无」，门店排名显示「未接通」。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">手机上怎么看</h2>
        <div className="card">
          <p style={{ margin: 0 }}>
            手机打开的是同一套页面。左上角的菜单按钮展开左侧文件夹；点链接、点遮罩或按 Esc 即收起。
            宽表（两店对比、权限矩阵、成本明细）在卡片内左右滑动，不会撑破屏幕。
          </p>
          <figure className="help-shot">
            <a href="/help-shots/mobile-overview.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/mobile-overview.png" alt="手机经营概览：左上角菜单抽屉打开，里面是同一套项目、爱回收、经营、员工和报销" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。手机经营概览：左上角菜单抽屉打开，菜单与桌面相同，从「项目」到「爱回收」。点链接、遮罩或 Esc 即收起。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
          <figure className="help-shot">
            <a href="/help-shots/mobile-expenses.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/mobile-expenses.png" alt="手机报销台账：菜单抽屉关闭，汇总卡与新建表单上下排列。金额为示例数字" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。示例数字。手机报销台账：左上角菜单抽屉关闭，汇总卡和新建表单上下排列。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">角色与权限矩阵</h2>
        <div className="card table-wrap">
          <table className="report">
            <thead>
              <tr>
                <th>事项</th>
                <th>老板 · 可见</th>
                <th>老板 · 可写</th>
                <th>合伙人 · 可见</th>
                <th>合伙人 · 可写</th>
                <th>店员 · 可见</th>
                <th>店员 · 可写</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>业务板块入口</td>
                <td>全部板块</td>
                <td>可改授权</td>
                <td>仅被授权板块（未授权不渲染）</td>
                <td>—</td>
                <td>仅被授权板块（未授权不渲染）</td>
                <td>—</td>
              </tr>
              <tr>
                <td>经营报表 / 两店对比（单量 / 分润 / 上门）</td>
                <td>可见</td>
                <td>—（汇总数据）</td>
                <td>可见</td>
                <td>—</td>
                <td>可见</td>
                <td>—</td>
              </tr>
              <tr>
                <td>净利 / 利润率 / 年回报率 / 净利构成</td>
                <td>可见</td>
                <td>—（派生指标）</td>
                <td>可见</td>
                <td>—</td>
                <td>不显示（净利构成页直进也会被拦回）</td>
                <td>—</td>
              </tr>
              <tr>
                <td>工资规则（工资怎么算）</td>
                <td>可见</td>
                <td>可配置 / 可改生效起始月</td>
                <td>只读可见</td>
                <td>—</td>
                <td>只读可见</td>
                <td>—</td>
              </tr>
              <tr>
                <td>工资录入与导入（月度工资行 / CSV 导入）</td>
                <td>可见</td>
                <td>可录入 / 可导入</td>
                <td>不显示</td>
                <td>—</td>
                <td>不显示</td>
                <td>—</td>
              </tr>
              <tr>
                <td>个人工资明细</td>
                <td>全员可见</td>
                <td>可录入 / 可发布</td>
                <td>不显示</td>
                <td>—</td>
                <td>仅自己已发布的月份</td>
                <td>—</td>
              </tr>
              <tr>
                <td>门店工资汇总（人数 / 合计）</td>
                <td>可见</td>
                <td>—</td>
                <td>可见（仅已发布数据的汇总）</td>
                <td>—</td>
                <td>不显示</td>
                <td>—</td>
              </tr>
              <tr>
                <td>工资实表明细（导入与对账校验）</td>
                <td>可见</td>
                <td>可导入维护</td>
                <td>不显示</td>
                <td>—</td>
                <td>不显示</td>
                <td>—</td>
              </tr>
              <tr>
                <td>门店成本与合同台账</td>
                <td>可见</td>
                <td>可录入 / 编辑 / 删除</td>
                <td>只读可见</td>
                <td>—</td>
                <td>不显示（导航无入口，直进拦回）</td>
                <td>—</td>
              </tr>
              <tr>
                <td>月度目标</td>
                <td>可见</td>
                <td>可设定</td>
                <td>可见</td>
                <td>—</td>
                <td>可见</td>
                <td>—</td>
              </tr>
              <tr>
                <td>目标达成复盘（经营报表页，含导出）</td>
                <td>可见</td>
                <td>可导出 CSV / Excel</td>
                <td>可见</td>
                <td>可导出 CSV / Excel</td>
                <td>不显示（整节不渲染）</td>
                <td>—</td>
              </tr>
              <tr>
                <td>报销明细</td>
                <td>全部明细</td>
                <td>可新建 / 编辑 / 删除 / 切换状态</td>
                <td>不显示明细</td>
                <td>—</td>
                <td>仅自己创建的单</td>
                <td>仅自己的单可新建 / 编辑 / 删除 / 切换状态</td>
              </tr>
              <tr>
                <td>报销汇总与导出</td>
                <td>全量汇总</td>
                <td>明细 CSV / Excel 可导出</td>
                <td>仅按月汇总</td>
                <td>汇总 CSV / Excel 可导出</td>
                <td>仅自己范围的汇总</td>
                <td>自己范围 CSV / Excel 可导出</td>
              </tr>
              <tr>
                <td>成员列表与业务授权</td>
                <td>可见</td>
                <td>可改（待邀请名单登记意向 / 一键对齐 / 改角色 / 按板块授权；发邀邮件走 Supabase 控制台）</td>
                <td>仅角色说明（列表不显示）</td>
                <td>—</td>
                <td>仅角色说明（本节不渲染）</td>
                <td>—</td>
              </tr>
              <tr>
                <td>数据范围</td>
                <td>全公司</td>
                <td>—</td>
                <td>被授权板块</td>
                <td>—</td>
                <td>被授权板块及所属门店范围</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="page-desc" style={{ marginTop: 12 }}>
          「可写」指页内新增 / 编辑 / 删除 / 发布 / 导出等操作权限；「—」表示该角色无此操作。
          本矩阵与数据库行级权限（<span className="en">RLS</span>）和页面渲染保持一致：表里写「不显示」的，页面不渲染入口、数据库也不返回数据，不是仅靠前端隐藏。
        </p>
        <div className="card" style={{ marginTop: 20 }}>
          <ul className="plain">
            <li>
              <strong>老板（<span className="en">Owner</span>）：</strong>
              管理全部业务板块与全部指标（含工资占分润比、净利暂定）；在「成员」页用「待邀请名单」登记邀请意向并一键对齐、调整角色、按业务板块逐个授权（发邀邮件走 Supabase 控制台）。
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
              <strong>老板：</strong>在「薪资」页配置工资规则（岗位、底薪、提成），同一页看汇总和实时应发草案。
              月度工资行、导入和实表明细收在「录入与导入」里，默认收起；展开后按人按月录入并发布。
              在「门店成本」页录入两店每月的房租、水电、其他成本，已录入成本进入「报表」和「净利构成」的净利核算。
            </li>
            <li>
              <strong>合伙人：</strong>打开同一页「薪资」，可看汇总和实时草案，不能改补贴、奖金或失误明细；
              门店月度汇总在折叠区，只汇总已发布数据的人数与合计。没有「录入与导入」。
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
              <strong>电费链路：</strong>老板在「门店成本」页「电费实报」按门店 + 月份录入实际金额
              → 记入该店该月的水电成本 → 进入「报表」和「净利构成」的净利核算，不需要再到别处登记。
              未录入的月份按「未取得，未计入」处理，不估算、不编造读数；
              万达备注预填「智能电表自记、按实预付」；同门店同月份重复提交是更新既有行，不会重复计。
              录入区会默认带上最近一次录入的门店与月份，并列出该门店尚未录入的月份，点一下月份即可填入，不用逐月翻找。
            </li>
            <li>
              <strong>两店合同要点（已进成本核算）：</strong>
              合同台账在「门店成本」页可查（合同台账区）；租金、综合服务费等合同费用按台账口径录入后进入净利核算。
              保证金只在合同台账登记，<strong>不进月成本</strong>；合同中写明的联营扣点不计入成本；
              电费按实际发生逐月录入（见上方电费链路），未取得的月份不计入净利。
              本手册不展示合同金额与细账，具体数字以「门店成本」页台账为准。
            </li>
          </ul>
          <figure className="help-shot">
            <a href="/help-shots/costs-utilities.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/costs-utilities.png" alt="门店成本页的电费实报表单：门店、月份、电费金额与备注。画面从月度成本拍起" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。门店成本页「电费实报」：按门店和月份填写金额与备注。这张图从月度成本的表单拍起，上方合同台账不在画面里，页面本身不是空白。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">工资怎么算</h2>
        <div className="card">
          <ul className="plain">
            <li>
              <strong>规则说明：</strong>
              下面是现行口径。比例和生效起始月以「薪资」页里保存的配置为准；门店阶梯可以在该页的「工资体系」里修改，页面配置优先。
              手册不写任何员工的实发，也不附工资原表。
            </li>
            <li>
              <strong>底薪：</strong>
              按人设定。门店岗位的默认底薪是每月 {baseDefault} 元。上门岗位没有底薪，按 0 元。
            </li>
            <li>
              <strong>线上提成：</strong>
              非门店业绩（订单金额不含券）× {CALIBER.onlinePct}%。上门岗位不拿这 {CALIBER.onlinePct}%。
              门店岗位员工自己的上门订单，算进线上业绩，同样按 {CALIBER.onlinePct}% 计。
            </li>
            <li>
              <strong>门店提成（门店岗位）：</strong>
              按订单金额不含券计。阶梯是 {storeLadder}，取已经达到的最高一档。
              「薪资」页可以改这道阶梯，以页面上保存的配置为准。
            </li>
            <li>
              <strong>门店提成（上门岗位）：</strong>
              只统计成交方式为「门店订单」的单，订单金额不含券 × 4%。这是固定比例，不使用门店岗位那道阶梯。
            </li>
            <li>
              <strong>配件提成：</strong>
              按实付金额 × 30%，固定比例。这笔独立来源没有数时，按 0 计。
            </li>
            <li>
              <strong>上门利润分成：</strong>
              只给上门岗位，按上门利润 × 50%。
            </li>
            <li>
              <strong>补贴和奖金：</strong>
              手工填写，算进应发。只有老板能改。
            </li>
            <li>
              <strong>失误和扣款：</strong>
              在「薪资」页按条目录入，先加总，再从对应的实发里扣掉。
            </li>
            <li>
              <strong>什么时候算进当月：</strong>
              旧机销售按订单完成时间计入。月中页面上显示的是实时应发草案；当月最终金额要等到月末才定。
            </li>
            <li>
              <strong>生效起始月：</strong>
              在「薪资」页的「工资体系」里填写。没填时，双版本预览把各月标成待确认；保存之后，生效月之前按旧规则，从生效月起按新规则。
              老板录入并发布后，员工才在「我的薪酬」看到自己的已发布月份。本站不挂工资原表。
            </li>
          </ul>
          <figure className="help-shot">
            <a href="/help-shots/salary.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/salary.png" alt="工资页：规则、汇总和实时应发草案在同一页。金额为示例数字" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。示例数字。规则、汇总和实时应发草案在同一页。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">报销</h2>
        <div className="card">
          <ul className="plain">
            <li>
              <strong>谁可以看、谁可以改：</strong>
              老板看全部报销明细，可新建、编辑、删除并切换状态；合伙人只看汇总卡与按月汇总表，
              不显示明细行、报销人或表单；店员只看自己创建的报销单，可新建、编辑、删除并切换自己单据的状态，
              看不到他人的记录（数据权限与页面显示双重限制）。
            </li>
            <li>
              <strong>状态切换是什么意思：</strong>
              「未报销」表示费用已经发生但公司尚未打款；点「标为已报销」后，状态改为「已报销」并记录报销时间。
              点「改回未报销」后，状态恢复为「未报销」并清空报销时间。状态只表示打款进度，不改变费用是否已经发生。
            </li>
            <li>
              <strong>保存后数字会同步：</strong>
              新建、编辑、删除或切换状态成功后，报销页顶部的汇总数字（未报销 / 已报销 / 本月花费）会随之刷新为最新值，
              不必手动刷新页面。
            </li>
            <li>
              <strong>未报销也计入已发生花费：</strong>
              当月公司花费按已报销 + 未报销全额计算，公司口径净利会扣掉当月全部报销花费。
              因此，一笔未报销单据虽然还没打款，也已经进入当月经营核算；它与「已报销」的区别只在现金是否已经付出。
            </li>
            <li>
              <strong>超期提醒在哪看：</strong>
              有报销超 14 天未报销时，总览顶部会出现红色提醒条（笔数 + 合计金额），点它直达「报销」页并自动筛到「未报销」；
              报销页顶栏未报销合计旁也有超期笔数，行内带「超期」标记。提醒按可见范围统计：老板看全部、店员只看自己创建的单；
              合伙人只看月度汇总、没有逐单日期，因此总览不显示逐单超期提醒。
            </li>
            <li>
              <strong>示例行可以删除：</strong>
              系统里可能留有初始示例记录，只是演示用途，老板可在「报销」页直接删除；
              演示模式中的示例与切换只在本机页面演示，不写数据库。
            </li>
          </ul>
          <figure className="help-shot">
            <a href="/help-shots/expenses.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/expenses.png" alt="报销台账：未报销、已报销和本月花费三张汇总卡，以及新建报销单。金额为示例数字" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。示例数字。报销台账：上方是未报销、已报销和本月花费汇总，下方是新建报销单。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">利润率 / 年回报率</h2>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            利润率、年回报率在「报表」。两店各自的利润率在「两店对比」。分项扣减在「净利构成」。
          </p>
          <ul className="plain">
            <li>
              <strong>利润率（分润）：</strong>
              先算门店净利暂定（已扣工资分摊、已知扣款与门店成本），再扣当月全部报销花费，得到公司口径净利；
              利润率（分润） = 公司口径净利 ÷ 当月分润。示例（虚构，与线上真实月份无关）：某月公司口径净利 −5,000 元 ÷ 当月分润 50,000 元 = −10%。
              净利已扣门店成本与公司花费。
            </li>
            <li>
              <strong>利润率（营收）：</strong>
              利润率（营收） = 公司口径净利 ÷ 当月营收。目前订单金额数据大面积缺失、尚无营收数据源，
              该卡显示「—」并标注「营收口径待接入（订单金额数据缺失），接入后自动出数」；不会拿分润冒充营收。
            </li>
            <li>
              <strong>只有完整口径月份才出数：</strong>
              只有具备完整净利口径的月份才出公司口径净利与利润率；其他月份显示「—」，待工资分摊、已知扣款、门店成本与报销花费补齐后再出数，不用不完整数字硬算。
              示例报销只落在它所属的月份，不影响其他月份的净利口径；所属月份尚无完整口径时同样不出利润率。
            </li>
            <li>
              <strong>年回报率（指令45 口径）：</strong>
              年回报率 = 年度净利润 ÷ 年度投入。年度净利润 = 已核算月份公司口径净利合计；
              年度投入 = 门店成本合计 + 报销花费（未报销与已报销均计入已发生）+ 工资实发合计（以工资实表明细汇总为准，未导入明细时按月度汇总，两者差额在老板视角有标注）。
            </li>
            <li>
              <strong>覆盖范围必须看标注：</strong>
              年回报率卡分别标注净利覆盖月份与投入覆盖月份（以页面卡面标注为准），
              不是把未核算月份估算成全年结果。分母为 0 或没有已核算月份时显示「—」。
            </li>
            <li>
              <strong>近12个月：</strong>
              年回报率卡的次要行按滚动 12 个月计算，窗口以最新完整口径月份为终点向前推 12 个月，
              公式与年度口径相同，页面同样分别标注净利覆盖与投入覆盖；数据不足时只按已覆盖的已核算月份汇总，不补估算。
            </li>
          </ul>
        </div>

        <h2 className="section-title">目标达成复盘</h2>
        <div className="card">
          <ul className="plain">
            <li>
              <strong>在哪看：</strong>
              「报表」页中部的「目标达成复盘」节，按月逐行列出目标与实际。
              本节仅老板与合伙人可见，店员打开报表页时整节不渲染。
            </li>
            <li>
              <strong>三口径：</strong>
              每个月三行——当月分润、当月单量（均取两店合计月度汇总）、公司口径净利
              （扣门店成本与报销后的净利，与「报表」「净利构成」同一核算来源）。
            </li>
            <li>
              <strong>目标从哪来：</strong>
              这张复盘仍用原来那套店目标（当月分润、公司口径净利、当月单量），本页只读不改。
              总览上老板设的是按人、按店、按月各存一条的回收目标与配件销售目标。
              没设店目标的月份在复盘里标「未设定」。
            </li>
            <li>
              <strong>状态怎么读：</strong>
              达成率 = 实际 ÷ 目标，达到 100% 为「已达成」，未满为「未达成」；
              没设目标为「未设定」；设了目标但该月净利尚无完整口径（成本未齐）为「待核算」，
              实际与达成率留空不冒数，等口径齐了自动转实数。
            </li>
            <li>
              <strong>导出：</strong>
              复盘节下方有「导出复盘 CSV」「导出复盘 Excel」两个按钮，导出内容与页面表格
              同一份行数据（金额为纯数字便于再算）；两按钮随复盘节一起仅老板与合伙人可见。
            </li>
          </ul>
        </div>

        <h2 className="section-title">老板动线（日常巡店）</h2>
        <div className="card">
          <ol className="steps">
            <li>
              <strong>看总览（/）：</strong>
              先选月份和门店，看门店回收、目标达成、配件、网单、失误和当月工资。配件、按日走势和三个排名目前是「暂无」或「未接通」。
            </li>
            <li>
              <strong>看报表和构成：</strong>
              进「报表」（/business/aihuishou/reports）看净利、利润率、年回报率。
              进「净利构成」（/business/aihuishou/breakdown）看从分润扣到公司口径净利的分项。
            </li>
            <li>
              <strong>比两店：</strong>进「两店对比」（/business/aihuishou/compare）切换月份，看友谊与万达的分润、门店成本、净利与利润率并排。
            </li>
            <li>
              <strong>管报销：</strong>进「报销」（/expenses）新建报销单，点行内状态在已报销 / 未报销间切换；顶栏看未报销合计与超期笔数，需要留档时导出 CSV / Excel。
            </li>
            <li>
              <strong>管工资：</strong>进「薪资」（/salary）。规则、汇总和实时应发草案在同一页。
              月度工资行、导入和实表明细收在「录入与导入」里，默认收起；展开后再录入并发布。
              改规则前先看「工资体系」里的双版本预览，确认新旧规则的切换月。
            </li>
            <li>
              <strong>管成本：</strong>进「门店成本」（/business/aihuishou/costs）核对合同台账，用通用表单录入房租等成本、
              用「电费实报」按月录入实际电费。录入后进入「报表」和「净利构成」的核算；未录入的月份按未取得、不计入。
            </li>
            <li>
              <strong>定目标：</strong>老板在总览按人、按店、按月填写回收目标和配件销售目标，按人、按店、按月各存一条。
              达成率只用同店在职人员的回收目标合计；没设目标显示「未设定」，有目标但当月回收实际还没有则显示「—」。
              表还没建好时保存会提示失败，不会在浏览器里留一份假目标。配件销售目标填销售额，不用工资提成代替。
              报表里的目标达成复盘仍用原来那套店目标，不从总览这份人店月目标回写。
            </li>
            <li>
              <strong>管成员与数据状态：</strong>邀请新成员先在「成员」（/members）的「待邀请名单」登记邮箱、意向角色与意向授权，
              再去 <span className="en">Supabase</span> 控制台只做发邀请一个动作；对方点邮件链接设密注册后，回名单点「一键对齐」即按意向写入角色与授权
              （发邀不在本站内发送）。已注册成员的角色与授权也在同页直接维护。在「数据状态」（/status）看抓取日志、工资对账与配置更新时间。
            </li>
          </ol>
          <figure className="help-shot">
            <a href="/help-shots/compare.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/compare.png" alt="两店对比：同月两店并排，显示当月分润、门店成本、扣成本后净利和利润率。金额为示例数字" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据），与线上真实经营数据无关。示例数字。两店对比：选中月份后，两店并排看当月分润、门店成本、扣成本后净利和利润率。利润率（营收）在这张图里是「—」。截图刷新：2026-11-11；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">员工动线（只看自己的）</h2>
        <div className="card">
          <ol className="steps">
            <li>
              <strong>登录：</strong>点老板邀请邮件里的链接设置密码，之后用邮箱 + 密码登录。
            </li>
            <li>
              <strong>看工资：</strong>进「我的薪酬」（/salary），只显示你自己已发布月份的实发与构成（底薪 / 提成 / 扣款），下方有历史月份；
              显示「本月工资尚未发布」是正常状态，等老板录入并发布即可。
            </li>
            <li>
              <strong>报报销：</strong>进「报销」（/expenses，页面只显示你创建的报销单）新建自己的报销单，可编辑、删除，并切换自己单据的已报销 / 未报销状态；
              未报销超过 14 天的行会带「超期」标记，顶栏未报销合计旁也会显示你的超期笔数。
            </li>
            <li>
              <strong>看经营：</strong>
              总览可看所选月份和门店下的门店回收、目标达成、配件、网单、失误。店员没有「当月工资」这一格。
              按日走势和排名目前是「暂无」或「未接通」。被授权后还可在「报表」和「两店对比」看单量、分润、上门单量。
            </li>
            <li>
              <strong>看不到什么、为什么：</strong>净利、工资成本与任何他人的工资、门店成本、成员管理，以及未被授权的业务板块——
              这些入口不会出现在你的页面里，直接输入地址也会被拦回。这是权限设置，不是故障；需要开通请联系老板。
            </li>
          </ol>
        </div>

        <h2 className="section-title">合伙人动线（只读汇总）</h2>
        <div className="card">
          <ol className="steps">
            <li>
              <strong>看总览（/）：</strong>
              看月份和门店筛选下的指标格，含当月工资。净利、利润率、年回报在「报表」「两店对比」和「净利构成」。走势和排名目前尚未接通。
            </li>
            <li>
              <strong>看报表与两店对比：</strong>进「报表」（/business/aihuishou/reports）与「两店对比」（/business/aihuishou/compare），
              看两店分润、门店成本、扣成本后净利与利润率并排和逐月走势。
            </li>
            <li>
              <strong>看报销汇总：</strong>进「报销」（/expenses）只看汇总卡与按月汇总表（合计 / 已报销 / 未报销 / 笔数），可导出月度汇总 CSV / Excel。
            </li>
            <li>
              <strong>看工资与成本：</strong>
              「薪资」（/salary）与老板同一页，可看汇总和实时草案，不能修改；已发布的门店月度汇总在折叠区。
              「门店成本」（/business/aihuishou/costs）只读查看合同台账与月度成本。
            </li>
            <li>
              <strong>看不到什么、为什么：</strong>
              报销明细行与报销人、「录入与导入」和工资实表明细不会显示。
              补贴、奖金、失误、成本、工资规则、月度目标与成员权限也不能改。
              「薪资」页上的实时草案只读；已发布的逐人月度工资行只给老板。
            </li>
          </ol>
        </div>

        <h2 className="section-title">常用操作</h2>
        <div className="card">
          <ol className="steps">
            <li>
              <strong>登录：</strong>打开本站登录页，输入老板分配的邮箱与密码。
              首次使用时，老板会发送邀请邮件：点击邮件中的链接进入「设置登录密码」页，设置至少 8 位的密码后即自动登录。邀请链接过期时，请联系老板重发。
            </li>
            <li>
              <strong>进入页面：</strong>
              用左侧深蓝色竖栏。展开「项目 → 爱回收」，再进经营、员工或报销。店员的工资入口写着「我的薪酬」。
            </li>
            <li>
              <strong>查看数据更新情况：</strong>「数据状态」页列出各数据源的最近更新时间与状态。
              尚无抓取记录时，「最近抓取 / 导入日志」会直接显示「暂无抓取记录（管道已备未启用）」，不会列出示例记录；有记录后才逐行显示真实日志。
            </li>
            <li>
              <strong>查看工资与成本：</strong>左侧「薪资」（店员显示为「我的薪酬」）查看与自己相关的工资；
              门店成本在「门店成本」页（仅老板 / 合伙人可见）。
            </li>
            <li>
              <strong>保存操作为什么先变、偶尔又变回去：</strong>报销状态切换、目标保存、成本与电费录入、成员登记与对齐、成员业务授权勾选、
              工资规则新增与生效月编辑等操作，点下后页面会先按新值显示，不必等网络返回；
              如果保存失败（断网或服务端出错），页面会自动恢复到操作前的样子，并出现「保存失败，已回滚：…」一类提示——
              看到「已回滚」就是这次没有存上，检查网络后重试即可，不会留下改了一半的数据。
            </li>
          </ol>
        </div>

        <h2 className="section-title">看不到某个板块？</h2>
        <div className="card">
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            未被授权的业务板块不会出现在你的总览与导航中，直接输入地址也无法进入——这是权限设置，不是故障。
            需要开通时请联系老板，由老板在「成员」页为你的账号勾选对应板块，授权后重新打开页面即可看到。
          </p>
        </div>

        <h2 className="section-title">遇到问题</h2>
        <div className="card">
          <p style={{ margin: 0, lineHeight: 1.65 }}>
            登录失败、密码遗忘、板块未开通、数据有疑问，请联系老板处理。密码遗忘时由老板重发邀请邮件，按邮件链接重新设置密码。
          </p>
          <p style={{ margin: "10px 0 0", lineHeight: 1.65 }}>
            新账号首次登录后，老板会按三角色点验材料逐项确认可见范围（仓库 docs/清单_三角色真机验证.md 与
            docs/清单_乐观更新真机验证.md）；看到的页面与自己角色不符时，把页面名称告诉老板即可。
          </p>
        </div>
      </main>
    </>
  );
}
