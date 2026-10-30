import HelpRoleName from "@/components/HelpRoleName";
import { PAYROLL_CALIBER as CALIBER } from "@/lib/realtime-payroll";

/**
 * 操作手册（指令40-1）：全角色可见，登录后可达。
 * 内容只讲正式使用：三角色权限、登录与设密码、主题、业务入口、异常处理。
 * 正文不读会话，可静态生成；角色名由布局里已经解析的会话填上。
 */
export default function HelpPage() {
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

        <h2 className="section-title">总览怎么看</h2>
        <div className="card">
          <p style={{ margin: 0 }}>
            总览改版：先看英雄区扣成本后净利 → 次看双利润率 → 成本拆解默认折叠，展开看分项。年回报率收在英雄下方一行（自然年 + 近12个月，附覆盖月份）；月度目标未设定时只有一行按钮，点开再填。
          </p>
          <figure className="help-shot">
            <a href="/help-shots/overview.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/overview.png" alt="总览：扣成本后净利、双利润率与年回报率一行" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：总览英雄净利、双利润率与年回报率一行。截图刷新：2026-10-30；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">手机上怎么看</h2>
        <div className="card">
          <p style={{ margin: 0 }}>
            手机打开本站即同一套页面：导航收进右上角菜单，总览先看英雄区净利；宽表（两店对比、权限矩阵、成本明细）在卡片内左右滑动查看，不会撑破屏幕。
          </p>
          <figure className="help-shot">
            <a href="/help-shots/mobile-overview.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/mobile-overview.png" alt="手机 390 宽总览：英雄净利、双利润率、年回报一行、月度目标与业务卡单列排布" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：手机上的总览——卡片单列、数字不溢出。截图刷新：2026-10-30；点图看大图。</figcaption>
          </figure>
          <figure className="help-shot">
            <a href="/help-shots/mobile-expenses.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/mobile-expenses.png" alt="手机 390 宽报销页：汇总卡、建单表单、状态筛选与台账单列排布" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：手机上的报销页——表单纵排、筛选 chips 同行、台账在卡片内滑动。截图刷新：2026-10-30；点图看大图。</figcaption>
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
              管理全部业务板块与全部指标（含工资占分润比、净利暂定）；在「成员与权限」页用「待邀请名单」登记邀请意向并一键对齐、调整角色、按业务板块逐个授权（发邀邮件走 Supabase 控制台）。
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
              <strong>电费链路：</strong>老板在「门店成本」页「电费实报」按门店 + 月份录入实际金额
              → 写入门店成本（<span className="en">store_costs</span>，类型=水电）→ 自动进入爱回收仪表盘净利暂定、
              「公司花费拆分」下钻与总览成本拆解，不需要再到别处登记。未录入的月份按「未取得，未计入」处理，不估算、不编造读数；
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
              <img src="/help-shots/costs-utilities.png" alt="门店成本页电费实报快捷区：门店、月份、电费金额与备注" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：门店成本页「电费实报」快捷区，万达备注预填电表口径。截图刷新：2026-10-30；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">工资怎么算</h2>
        <div className="card">
          <ul className="plain">
            <li>
              <strong>规则说明：</strong>以下为规则说明；以工资页配置为准；手册不展示任何员工实发与实表明细。
            </li>
            <li>
              <strong>底薪：</strong>全员 {CALIBER.basePerPerson.toLocaleString("zh-CN")} 元/月 = 基础 1,000 + 全勤 500 + 拉新 500。
              拉新口径以工资表模板为准（模板到后核对更新）。
            </li>
            <li>
              <strong>线上订单提成：</strong>
              {CALIBER.onlineBasis} × {CALIBER.onlinePct}%。
            </li>
            <li>
              <strong>门店提成（{CALIBER.storeBasis}，取最高达成档）：</strong>业绩 ≥ 30,000 元 → 3%；业绩 ≥ 60,000 元 → 4%。
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
            <li>
              <strong>双版本切换：</strong>历史双版本按生效起始月切换：生效月之前按旧规则、之后按新规则回算；
              生效月未填则显示待确认。「工资」页配置区的「双版本预览」会把每个月份逐月标为旧规则 / 新规则 / 待确认，
              改生效起始月保存后立即翻转，可先预览再确认。
            </li>
          </ul>
          <figure className="help-shot">
            <a href="/help-shots/salary-rule-preview.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/salary-rule-preview.png" alt="工资页双版本预览：生效起始月未填时各月标待确认" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：工资页「双版本预览」——生效起始月未填时逐月标「待确认」。截图刷新：2026-10-30；点图看大图。</figcaption>
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
              <img src="/help-shots/expenses.png" alt="报销页：按状态筛选（全部 / 未报销 / 已报销）与当前筛选小计" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：报销页状态筛选 chips（图中落在「未报销」）与当前筛选小计。截图刷新：2026-10-30；点图看大图。</figcaption>
          </figure>
        </div>

        <h2 className="section-title">利润率 / 年回报率</h2>
        <div className="card">
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
              年度投入 = 门店成本合计（store_costs）+ 报销花费（expense_claims，未报销与已报销均计入已发生）+ 工资实发合计（以工资实表明细汇总为准，未导入明细时按月度汇总，两者差额在老板视角有标注）。
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
              爱回收「经营报表」页中部的「目标达成复盘」节，按月逐行列出目标与实际。
              本节仅老板与合伙人可见，店员打开报表页时整节不渲染。
            </li>
            <li>
              <strong>三口径：</strong>
              每个月三行——当月分润、当月单量（均取两店合计月度汇总）、公司口径净利
              （扣门店成本与报销后的净利，与总览英雄数同一来源）。
            </li>
            <li>
              <strong>目标从哪来：</strong>
              与总览「本月目标」卡同一份数据（site_targets），老板在总览设定；复盘只读不改，
              没设目标的月份在复盘里标「未设定」。
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
              <strong>看总览（/）：</strong>先看英雄区「扣成本后净利」判断本月赚没赚，再看次级双利润率卡（分润 / 营收）。
            </li>
            <li>
              <strong>拆成本：</strong>展开总览「成本拆解」，或进爱回收仪表盘（/business/aihuishou）看花费拆解下钻——工资、门店成本、报销各占多少，逐层展开到门店与类型。
            </li>
            <li>
              <strong>比两店：</strong>进「两店对比」（/business/aihuishou/compare）切换月份，看友谊 vs 万达的分润、门店成本、净利与双利润率并排。
            </li>
            <li>
              <strong>管报销：</strong>进「报销」（/expenses）新建报销单，点行内状态在已报销 / 未报销间切换；顶栏看未报销合计与超期笔数，需要留档时导出 CSV / Excel。
            </li>
            <li>
              <strong>管工资：</strong>进「工资」（/salary）在工资体系配置里维护规则与生效起始月（先看「双版本预览」确认新旧规则切换月），
              用月度工资导入录入并发布员工工资，再到「工资明细（实表导入）」看逐人实发与对账差额。
            </li>
            <li>
              <strong>管成本：</strong>进「门店成本」（/business/aihuishou/costs）核对合同台账，用通用表单录入房租等成本、
              用「电费实报」按月录入实际电费；录入即进入净利与花费拆解核算，未录入的月份按未取得、不计入。
            </li>
            <li>
              <strong>定目标：</strong>回总览「月度目标」卡设定本月目标（当月分润 / 公司口径净利 / 当月单量三选一，卡面会标明所选口径），之后在同一张卡看目标、实际与达成率。
              目标月份可选到本月与下月：还没有数据的月份可以先设目标，实际出来前卡面标「待核算」；调整已设的目标时表单会带出当前值，改完保存即可，点「收起」关表单。
            </li>
            <li>
              <strong>管成员与数据状态：</strong>邀请新成员先在「成员与权限」（/members）的「待邀请名单」登记邮箱、意向角色与意向授权，
              再去 <span className="en">Supabase</span> 控制台只做发邀请一个动作；对方点邮件链接设密注册后，回名单点「一键对齐」即按意向写入角色与授权
              （发邀不在本站内发送）。已注册成员的角色与授权也在同页直接维护。在「数据刷新状态」（/status）看抓取日志、工资对账与配置更新时间。
            </li>
          </ol>
          <figure className="help-shot">
            <a href="/help-shots/dashboard-drill.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/dashboard-drill.png" alt="爱回收仪表盘公司花费拆分展开：门店成本按店与类型、报销已报未报、工资占比" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：仪表盘「公司花费拆分」展开态——门店成本逐层下钻到门店与类型。截图刷新：2026-10-30；点图看大图。</figcaption>
          </figure>
          <figure className="help-shot">
            <a href="/help-shots/compare.png" target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/help-shots/compare.png" alt="两店对比：友谊与万达同月分润、门店成本、净利与双利润率并排" loading="lazy" />
            </a>
            <figcaption>示例截图（演示数据）：两店对比——同月双店大卡并排（分润、门店成本、扣成本后净利、双利润率）。截图刷新：2026-10-30；点图看大图。</figcaption>
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
              <strong>看经营：</strong>总览与爱回收板块可看经营汇总（单量、分润、上门单量、趋势）与被授权业务的内容。
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
              <strong>看总览（/）：</strong>看公司经营摘要与爱回收板块——扣成本后净利、双利润率、年回报与成本拆解（默认折叠，展开看分项）。
            </li>
            <li>
              <strong>看报表与两店对比：</strong>进爱回收「经营报表」（/business/aihuishou/reports）与「两店对比」（/business/aihuishou/compare），
              看两店分润、门店成本、扣成本后净利与利润率并排和逐月走势。
            </li>
            <li>
              <strong>看报销汇总：</strong>进「报销」（/expenses）只看汇总卡与按月汇总表（合计 / 已报销 / 未报销 / 笔数），可导出月度汇总 CSV / Excel。
            </li>
            <li>
              <strong>看工资与成本汇总：</strong>「工资」（/salary）只看门店月度工资汇总（人数与合计）；「门店成本」（/business/aihuishou/costs）只读查看合同台账与月度成本。
            </li>
            <li>
              <strong>看不到什么、为什么：</strong>报销明细行与报销人、任何人的工资明细与工资实表明细不会显示；
              成本、工资规则、月度目标与成员权限也不能修改——合伙人是只读汇总口径，明细与写入归老板，员工自己的单据归员工本人。
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
              <strong>切换昼夜主题：</strong>点击页面右上角的主题切换图标——夜间时显示太阳图标，点一下切到白天；白天时显示月亮图标，点一下切回夜间。选择会保存在本机，下次打开自动沿用。
            </li>
            <li>
              <strong>进入业务板块：</strong>在「公司总览」页点击业务板块卡片，或使用顶部导航进入。板块内可查看仪表盘与报表。
            </li>
            <li>
              <strong>查看数据更新情况：</strong>「数据刷新状态」页列出各数据源的最近更新时间与状态。
              尚无抓取记录时，「最近抓取 / 导入日志」会直接显示「暂无抓取记录（管道已备未启用）」，不会列出示例记录；有记录后才逐行显示真实日志。
            </li>
            <li>
              <strong>查看工资与成本：</strong>顶部导航「工资」（店员显示为「我的薪酬」）查看与自己相关的工资；
              门店成本在爱回收板块的「门店成本」页（仅老板 / 合伙人可见）。
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
            需要开通时请联系老板，由老板在「成员与权限」页为你的账号勾选对应板块，授权后重新打开页面即可看到。
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
