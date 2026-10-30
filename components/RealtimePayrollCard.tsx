import KpiCard, { KpiValue } from "@/components/KpiCard";
import { money, money2 } from "@/lib/format";
import {
  PAYROLL_CALIBER as CALIBER,
  REALTIME_PAYROLL as RP,
  REALTIME_PAYROLL_PER_CAPITA,
  REALTIME_PAYROLL_ORDERS_PER_CAPITA,
  REALTIME_PAYROLL_WAGE_TO_PROFIT_PCT,
} from "@/lib/realtime-payroll";

/**
 * 实时工资 · 人效汇总卡（指令194）：展示 193 在职口径实时工资草案汇总数。
 * 纯服务端静态渲染（汇总常量在 lib/realtime-payroll.ts），零客户端 JS。
 * 可见性由调用方按角色决定：老板 / 合伙人渲染，店员整卡不渲染（指令58）。
 */
export default function RealtimePayrollCard() {
  const onlineLabel = `线上提成（${CALIBER.onlineBasis} × ${CALIBER.onlinePct}%）`;
  const storeLabel = `门店提成（${CALIBER.storeBasis}）`;
  const tierPhrase = CALIBER.storeTiers
    .map((t) => `≥${t.min / 10000} 万 ${t.pct}%`)
    .join(" / ");
  const accessoriesText = CALIBER.accessoriesHasData
    ? money2(RP.accessoriesCommissionTotal)
    : `${money2(CALIBER.accessoriesPlaceholder)}（占位）`;
  const staleSuffix = CALIBER.amountsPendingRerun
    ? `（${CALIBER.staleAmountNote}）`
    : "";

  // 构成名允许换行：金额列保持不换行，避免长口径把数字挤出手机屏。
  const rows: Array<{ label: string; value: string }> = [
    { label: `底薪（全员 ${CALIBER.basePerPerson}）`, value: money2(RP.baseTotal) },
    { label: "上门提成（分润 × 50%）", value: money2(RP.doorCommissionTotal) },
    {
      label: onlineLabel,
      value: `${money2(RP.onlineCommissionTotal)}${staleSuffix}`,
    },
    { label: storeLabel, value: money2(RP.storeCommissionTotal) },
    { label: "配件提成（无数据）", value: accessoriesText },
  ];

  return (
    <>
      <h2 className="section-title salary-head">
        <span className="salary-head-text">实时工资 · 人效（{RP.month}）</span>
        <span className="salary-kind salary-kind-draft">当月实时草案（未月结）</span>
      </h2>
      <div className="kpi-row">
        <div className="kpi-card kpi-wide kpi-hero">
          <div className="kpi-label">
            应发合计（实时工资草案，{RP.month}）
            {staleSuffix}
          </div>
          <KpiValue value={money2(RP.grossTotal)} unit="元" />
          <div className="kpi-sub">
            计薪 {RP.headcount} 人（仅在职名单）｜数据来源：191 抓数 + 193 名单口径
            {CALIBER.amountsPendingRerun
              ? "｜旧锚点已作废，待按新口径重跑"
              : ""}
          </div>
        </div>
      </div>
      <div className="kpi-row" style={{ marginTop: 16 }}>
        <KpiCard label="计薪人数" value={String(RP.headcount)} unit="人" />
        <KpiCard
          label={CALIBER.amountsPendingRerun ? `人均应发${staleSuffix}` : "人均应发"}
          value={money2(REALTIME_PAYROLL_PER_CAPITA)}
          unit="元"
          sub={`应发合计 ÷ 计薪人数（${money(RP.grossTotal)} ÷ ${RP.headcount}）`}
        />
        <KpiCard
          label="人均单量"
          value={REALTIME_PAYROLL_ORDERS_PER_CAPITA.toFixed(2)}
          unit="单"
          sub={`计薪单量 ÷ 计薪人数（${RP.countedOrders} ÷ ${RP.headcount}）`}
        />
        <KpiCard
          label="工资占分润比"
          value={`${REALTIME_PAYROLL_WAGE_TO_PROFIT_PCT.toFixed(2)}%`}
          sub={`分母 = ${RP.month} 订单分润合计 ${money2(RP.orderProfitTotal)} 元（订单口径，对账单未结）`}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table className="report payroll-split">
            <thead>
              <tr>
                <th>构成</th>
                <th>金额（元）</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.value}</td>
                </tr>
              ))}
              <tr>
                <td>应发合计{staleSuffix}</td>
                <td>{money2(RP.grossTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="kpi-sub" style={{ marginTop: 8 }}>
          注：配件提成 —— 191 抓数无配件数据源，占位 {CALIBER.accessoriesPlaceholder}。
          {CALIBER.amountsPendingRerun ? (
            <>
              {" "}
              线上提成与应发合计为旧锚点（{money2(RP.onlineCommissionTotal)} /{" "}
              {money2(RP.grossTotal)}），{CALIBER.staleAmountNote}；旧锚点作废，本仓不重算。
            </>
          ) : null}
        </p>
        <p className="page-desc" style={{ marginTop: 12 }}>
          口径说明：只算在职名单内人员；张浩冉与已离职人员不计薪（本月排除 {RP.excludedPeople}{" "}
          人、{RP.excludedOrders} 单，订单已留痕于排除清单）。底薪全员 {CALIBER.basePerPerson}。线上提成 ={" "}
          {CALIBER.onlineBasis} × {CALIBER.onlinePct}%；门店提成 = {CALIBER.storeBasis}（{tierPhrase}，取最高达成档）；上门提成
          = 上门单分润 × 50%；配件无数据源，占位 {CALIBER.accessoriesPlaceholder}。生效月（effective_from）=
          2026-10。工资占分润比的分母为 {RP.month} 全量 {RP.orderRowsTotal} 单的订单分润合计（{RP.orderProfitRows}{" "}
          单分润非空求和，空值不补）——此为订单口径，10 月对账单尚未生成（statement = pending），
          本卡数字为当月实时草案（未月结），待对账单月结后校准
          {CALIBER.amountsPendingRerun
            ? `；其中线上提成与应发合计仍为旧数（${CALIBER.staleAmountNote}）`
            : ""}
          。此汇总不含任何个人明细，个人级草案仅存老板本机。
        </p>
      </div>
    </>
  );
}
