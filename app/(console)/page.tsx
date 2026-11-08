import { Suspense } from "react";
import Link from "next/link";
import { SectionSkeleton } from "@/components/PageSkeleton";
import FetchRefreshMarkerLine from "@/components/FetchRefreshMarker";
import DailySalesChart from "@/components/DailySalesChart";
import PersonStoreTargetForm from "@/components/PersonStoreTargetForm";
import {
  getCurrentUser,
  getMyBusinesses,
  getMetrics,
  canAccessBusiness,
  canSeeSensitive,
  getStoreCosts,
  getExpenseClaims,
  getExpenseOperatingInput,
  storeCostsTotalForMonth,
  describeMonthCosts,
  getSalaryDetailImport,
  salaryDetailByMonth,
  getFetchRefreshMarker,
  getStores,
  getMonthlySalesTargets,
  getEmployees,
  realMode,
  type StoreCost,
  type ExpenseClaim,
  type SalaryDetailImportRow,
  type FetchRefreshMarker,
  type MetricRow,
} from "@/lib/data";
import { buildOperatingMetrics, coverageRange, wageCheckNote } from "@/lib/operating";
import { isOverdueUnreimbursed } from "@/lib/expenses";
import {
  groupMoney,
  presentDailySales,
  readDailySalesForOwner,
  trendSeries,
  type RankRow,
} from "@/lib/daily-person-store-sales";
import { money, money2, int } from "@/lib/format";
import {
  TARGET_READ_UNAVAILABLE,
  TARGET_TABLE_MISSING_READ,
  recycleAchievement,
  type MonthlySalesTargetRead,
  type StoreOption,
} from "@/lib/monthly-sales-targets";
import { readSalaryActor } from "@/lib/salary-actor";
import { loadMistakeTotals } from "@/lib/salary-mistake-query";
import {
  buildRealtimeSalary,
  isMissingHandFillColumn,
  isYearMonth,
  realtimeReadDecision,
  type RealtimeSalaryResponse,
  type SalaryRealtimeDraftRow,
  shanghaiYearMonth,
} from "@/lib/salary-realtime";
import { STORE_LABEL, STORE_SHORT_LABEL, COST_TYPE_LABEL, type CostType, type StoreScope } from "@/lib/stores";

export const dynamic = "force-dynamic";

function DeniedNotice() {
  return (
    <div className="notice">
      你未被授权进入该业务板块（或该板块尚未开放），入口未对你开放。如需开通，请联系老板在「成员与权限」页为你勾选对应业务。
    </div>
  );
}

function shiftMonth(ym: string, delta: number) {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [year, month] = ym.split("-");
  return `${year}年${Number(month)}月`;
}

function monthHref(month: string, denied?: string, store?: string) {
  const query = new URLSearchParams();
  query.set("month", month);
  if (store && store !== "all") query.set("store", store);
  if (denied) query.set("denied", denied);
  return `/?${query.toString()}`;
}

function MetricSlot({
  label,
  text,
  kind,
  sub,
  href,
}: {
  label: string;
  text: string;
  kind: "num" | "note";
  sub?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="ov-metric-label">{label}</div>
      <div className={kind === "num" ? "ov-metric-value" : "ov-empty"}>{text}</div>
      {sub ? <div className="ov-metric-sub">{sub}</div> : null}
    </>
  );
  if (!href) return <div className="ov-metric">{body}</div>;
  return (
    <Link href={href} className="ov-metric">
      {body}
    </Link>
  );
}

function RankList({ rows }: { rows: RankRow[] }) {
  return (
    <ol className="ov-rank-list">
      {rows.map((row, index) => (
        <li key={row.name} className="ov-rank-item">
          <span className="ov-rank-pos">{index + 1}</span>
          <span className="ov-rank-name">{row.name}</span>
          <span className="ov-rank-amt">{groupMoney(row.amount)} 元</span>
        </li>
      ))}
    </ol>
  );
}

function EmptyPlot({ note }: { note: string }) {
  return (
    <div className="ov-plot">
      <span>暂无</span>
      <span className="ov-plot-note">{note}</span>
    </div>
  );
}

const DRAFT_SELECT =
  "person_name, user_id, as_of, base_amount, door_amount, online_amount, store_amount, accessories_amount, gross_amount, deduction_amount, net_amount, caliber";

async function loadLatestDraftMonth(): Promise<string | null> {
  const actor = await readSalaryActor();
  if (!actor.ok) return null;
  if (realtimeReadDecision({ month: "2000-01", authenticated: true, role: actor.role }) !== 200) return null;
  const { data, error } = await actor.supabase.from("salary_realtime_draft").select("month, person_name");
  if (error || !data) return null;
  let latest: string | null = null;
  for (const row of data as { month?: unknown; person_name?: unknown }[]) {
    const month = typeof row.month === "string" ? row.month : "";
    const name = typeof row.person_name === "string" ? row.person_name.trim() : "";
    if (!isYearMonth(month) || name === "") continue;
    if (latest === null || month > latest) latest = month;
  }
  return latest;
}

async function loadPayrollTotals(month: string): Promise<RealtimeSalaryResponse | null> {
  const actor = await readSalaryActor();
  if (!actor.ok) return null;
  if (realtimeReadDecision({ month, authenticated: true, role: actor.role }) !== 200) return null;
  const extended = await actor.supabase
    .from("salary_realtime_draft")
    .select(`${DRAFT_SELECT}, subsidy_amount, bonus_amount`)
    .eq("month", month);
  let rows: SalaryRealtimeDraftRow[] = [];
  let handFill = true;
  if (extended.error) {
    if (!isMissingHandFillColumn(extended.error)) return null;
    const plain = await actor.supabase.from("salary_realtime_draft").select(DRAFT_SELECT).eq("month", month);
    if (plain.error) return null;
    rows = (plain.data ?? []) as SalaryRealtimeDraftRow[];
    handFill = false;
  } else {
    rows = (extended.data ?? []) as SalaryRealtimeDraftRow[];
  }
  const mistakes = await loadMistakeTotals(actor.supabase, month);
  if (!mistakes.ok) return null;
  return buildRealtimeSalary(month, rows, mistakes.rows, { handFill });
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; month?: string; store?: string }>;
}) {
  const { denied, month, store } = await searchParams;
  return (
    <main className="container calm no-enter overview-page">
      <Suspense fallback={<OverviewFallback denied={denied} />}>
        <OverviewContent denied={denied} monthParam={month} storeParam={store} />
      </Suspense>
    </main>
  );
}

function OverviewFallback({ denied }: { denied?: string }) {
  return (
    <>
      <div className="skel skel-eyebrow" />
      <h1 className="page-title">经营概览</h1>
      {denied ? <DeniedNotice /> : null}
      <SectionSkeleton />
    </>
  );
}

async function OverviewContent({
  denied,
  monthParam,
  storeParam,
}: {
  denied?: string;
  monthParam?: string;
  storeParam?: string;
}) {
  const user = await getCurrentUser();
  const { businesses, grantedIds } = await getMyBusinesses(user);
  const hasAihuishou = canAccessBusiness(grantedIds, "aihuishou");

  const visibleBusinesses = businesses.filter((b) => {
    if (b.status === "coming_soon") {
      return user.role === "owner" && grantedIds.length > 0;
    }
    return canAccessBusiness(grantedIds, b.id);
  });

  const sensitive = canSeeSensitive(user.role);
  const withData = hasAihuishou && sensitive;
  const canReadPayroll = (user.role === "owner" || user.role === "partner") && realMode(user);
  const rosterKnown = user.role === "owner" || user.role === "partner";
  const [combinedMetrics, wandaMetrics, friendshipMetrics, costs, expenseInput, detailRows, allClaims, refreshMarker, latestDraftMonth, dbStores, salesTargets, employees] =
    await Promise.all([
      getMetrics("combined", user.role),
      hasAihuishou ? getMetrics("wanda", user.role) : Promise.resolve({ rows: [] as MetricRow[], fromDb: false }),
      hasAihuishou ? getMetrics("friendship", user.role) : Promise.resolve({ rows: [] as MetricRow[], fromDb: false }),
      withData ? getStoreCosts(user) : Promise.resolve<StoreCost[]>([]),
      withData
        ? getExpenseOperatingInput(user)
        : Promise.resolve<ExpenseClaim[]>([]),
      user.role === "owner" && withData
        ? getSalaryDetailImport(user)
        : Promise.resolve<SalaryDetailImportRow[] | null>(null),
      hasAihuishou && user.role !== "partner"
        ? getExpenseClaims(user)
        : Promise.resolve<ExpenseClaim[]>([]),
      hasAihuishou
        ? getFetchRefreshMarker(user)
        : Promise.resolve<FetchRefreshMarker | null>(null),
      canReadPayroll ? loadLatestDraftMonth() : Promise.resolve<string | null>(null),
      hasAihuishou ? getStores(user) : Promise.resolve<StoreOption[]>([]),
      hasAihuishou ? getMonthlySalesTargets(user) : Promise.resolve<MonthlySalesTargetRead>({ ok: true, rows: [] }),
      hasAihuishou && rosterKnown ? getEmployees(user) : Promise.resolve([]),
    ]);
  const rows = combinedMetrics.rows;
  const latest = rows[rows.length - 1];
  const calendarMonth = shanghaiYearMonth();
  const prevCalendarMonth = shiftMonth(calendarMonth, -1);
  const requested = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;
  const selected = requested ?? latestDraftMonth ?? latest?.month ?? calendarMonth;
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.orders ?? 0), 0);
  const totalDoor = rows.reduce((s, r) => s + (r.door_orders ?? 0), 0);
  const operating = buildOperatingMetrics({
    metrics: rows,
    storeCosts: costs,
    expenses: expenseInput,
    salaryDetailByMonth: detailRows ? salaryDetailByMonth(detailRows) : null,
  });
  const latestOp = latest ? operating.months.find((m) => m.month === latest.month) : undefined;
  const selectedOp = operating.months.find((m) => m.month === selected);
  const storeOptions: StoreOption[] =
    dbStores.length > 0
      ? dbStores
      : (["wanda", "friendship"] as const).map((id) => ({ id, name: STORE_LABEL[id] }));
  const storeFilter = storeOptions.some((store) => store.id === storeParam) ? storeParam! : "all";
  const storeName = storeOptions.find((store) => store.id === storeFilter)?.name ?? null;
  const scopedRows =
    storeFilter === "wanda" ? wandaMetrics.rows : storeFilter === "friendship" ? friendshipMetrics.rows : storeFilter === "all" ? rows : [];
  const scopedRow = scopedRows.find((row) => row.month === selected);
  const storeLines = (["friendship", "wanda"] as StoreScope[]).map((scope) => {
    const source = scope === "wanda" ? wandaMetrics.rows : friendshipMetrics.rows;
    return { scope, row: source.find((r) => r.month === selected) };
  });
  const recycle = typeof scopedRow?.profit === "number" ? scopedRow.profit : null;
  const achievement = recycleAchievement({
    targets: salesTargets.ok ? salesTargets.rows : [],
    employees,
    month: selected,
    storeId: storeFilter === "all" ? null : storeFilter,
    actual: recycle,
    rosterKnown,
  });
  const achievementText = !achievement.rosterKnown
    ? "—"
    : achievement.target === null
      ? "未设定"
      : achievement.rate === null
        ? "—"
        : `${achievement.rate.toFixed(1)}%`;
  const achievementSub = !achievement.rosterKnown
    ? "在职口径不可见"
    : achievement.target === null
      ? "回收目标未设定"
      : `${storeName ? `${storeName} · ` : ""}回收目标 ${money(achievement.target)} 元`;
  const realOwner = user.role === "owner" && realMode(user);
  const [payroll, sales] = await Promise.all([
    canReadPayroll ? loadPayrollTotals(selected) : Promise.resolve<RealtimeSalaryResponse | null>(null),
    hasAihuishou
      ? readDailySalesForOwner({ role: realOwner ? user.role : null, month: selected })
      : Promise.resolve(null),
  ]);
  const salesView = sales && sales.ok
    ? presentDailySales(sales.detail, storeFilter === "all" ? null : storeName)
    : null;
  const hasDaily = Boolean(salesView && salesView.daily.length > 0);
  const dailyNote = !realOwner
    ? user.demo
      ? "没有按日实绩"
      : "按日实绩仅老板可看"
    : !sales || !sales.ok
      ? "按日实绩暂时读不到"
      : sales.detail.length === 0
        ? "本月没有按日记录"
        : hasDaily
          ? ""
          : "本月没有该店的按日记录";
  const recyclePoints = hasDaily && salesView ? trendSeries(selected, salesView.daily, "recycle_store_amount") : [];
  const accessoryPoints = hasDaily && salesView ? trendSeries(selected, salesView.daily, "accessories_sales") : [];
  const hasRoster = Boolean(payroll && payroll.people.length > 0);
  const reportsHref = `/business/aihuishou/reports?month=${selected}`;
  const salaryHref = hasRoster
    ? `/salary?month=${selected}#salary-people`
    : `/salary?month=${selected}`;
  const latestCostTotal = latest ? storeCostsTotalForMonth(costs, latest.month) : 0;
  const latestCostDesc = latest ? describeMonthCosts(costs, latest.month) : null;
  const wageNote = wageCheckNote(operating.annual);
  const wageTrend = rows
    .map((r) => r.wage_ratio)
    .filter((v): v is number => typeof v === "number");
  const netAdjusted = latestOp?.storeNetProfit ?? null;

  const heroOp =
    latestOp && latestOp.companyNetProfit !== null ? latestOp : operating.latestComplete;
  const heroNet = heroOp?.companyNetProfit ?? null;
  let heroMom: string | null = null;
  if (heroOp && heroNet !== null) {
    const idx = operating.months.findIndex((m) => m.month === heroOp.month);
    const prev = operating.months
      .slice(0, Math.max(idx, 0))
      .reverse()
      .find((m) => m.companyNetProfit !== null);
    if (prev && prev.companyNetProfit !== null && prev.companyNetProfit !== 0) {
      const d = ((heroNet - prev.companyNetProfit) / Math.abs(prev.companyNetProfit)) * 100;
      heroMom = `环比 ${d >= 0 ? "+" : ""}${d.toFixed(1)}%（较 ${prev.month}）`;
    }
  }

  const overdueClaims = allClaims.filter((c) =>
    isOverdueUnreimbursed(c.claim_date, c.status)
  );
  const overdueTotal = overdueClaims.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const targetActuals = rows.map((r) => ({
    month: r.month,
    profit: r.profit ?? null,
    orders: r.orders ?? null,
    net: operating.months.find((m) => m.month === r.month)?.companyNetProfit ?? null,
  }));

  const spendTotal = latestOp
    ? latestOp.storeCosts + latestOp.expenseTotal + (latestOp.wageCost ?? 0)
    : 0;
  const shareOf = (v: number) =>
    spendTotal > 0 ? `${((v / spendTotal) * 100).toFixed(1)}%` : "—";
  const scopeDrill = latestOp
    ? (Object.keys(STORE_SHORT_LABEL) as StoreScope[]).map((scope) => {
        const scopeRows = costs.filter((c) => c.month === latestOp.month && c.scope === scope);
        const byType = (Object.keys(COST_TYPE_LABEL) as CostType[])
          .map((t) => ({
            type: t,
            amount: scopeRows
              .filter((c) => c.cost_type === t)
              .reduce((s, c) => s + Number(c.amount ?? 0), 0),
          }))
          .filter((x) => x.amount !== 0);
        return {
          scope,
          total: scopeRows.reduce((s, c) => s + Number(c.amount ?? 0), 0),
          byType,
          recorded: scopeRows.length > 0,
        };
      })
    : [];

  return (
    <>
        <header className="ov-head">
          <div>
            <h1 className="page-title">经营概览</h1>
            {hasAihuishou ? (
              <p className="page-desc ov-source">
                爱回收 · {monthLabel(selected)}
                {user.demo ? " · 演示" : ""}
              </p>
            ) : (
              <p className="page-desc ov-source">公司总览</p>
            )}
          </div>
          {hasAihuishou ? (
            <div className="ov-toolbar">
              <span className="ov-query">查询月份 {monthLabel(selected)}</span>
              <Link
                href={monthHref(prevCalendarMonth, denied, storeFilter)}
                className="ov-month-btn"
                aria-current={selected === prevCalendarMonth ? "page" : undefined}
              >
                上月
              </Link>
              <Link
                href={monthHref(calendarMonth, denied, storeFilter)}
                className="ov-month-btn"
                aria-current={selected === calendarMonth ? "page" : undefined}
              >
                本月
              </Link>
              <Link
                href={monthHref(selected, denied, "all")}
                className="ov-month-btn"
                aria-current={storeFilter === "all" ? "page" : undefined}
              >
                全部
              </Link>
              {storeOptions.map((store) => (
                <Link
                  key={store.id}
                  href={monthHref(selected, denied, store.id)}
                  className="ov-month-btn"
                  aria-current={storeFilter === store.id ? "page" : undefined}
                >
                  {store.name}
                </Link>
              ))}
            </div>
          ) : null}
        </header>
        {refreshMarker ? (
          <div className="ov-marker">
            <FetchRefreshMarkerLine marker={refreshMarker} />
          </div>
        ) : null}

        {denied ? <DeniedNotice /> : null}

        {overdueClaims.length > 0 ? (
          <Link href="/expenses?status=unreimbursed" className="alert-bar" role="alert">
            <span>
              报销超期提醒：<strong>{overdueClaims.length} 笔</strong>报销已超 14 天未报销，合计{" "}
              <strong>{money2(overdueTotal)} 元</strong>
              {user.role === "staff" ? "（仅统计你创建的报销单）" : ""}
            </span>
            <span className="alert-cta">去处理 →</span>
          </Link>
        ) : null}

        {hasAihuishou ? (
          <>
            <div className="ov-metrics">
              <MetricSlot
                href={reportsHref}
                label={`${monthLabel(selected)}门店回收`}
                text={recycle === null ? "暂无" : `${money(recycle)} 元`}
                kind={recycle === null ? "note" : "num"}
                sub={
                  scopedRow
                    ? storeFilter === "all"
                      ? `${typeof scopedRow.orders === "number" ? `${int(scopedRow.orders)} 单` : "单量暂无"} · 上门 ${typeof scopedRow.door_orders === "number" ? `${int(scopedRow.door_orders)} 单` : "暂无"}`
                      : `${storeName ?? ""} · ${typeof scopedRow.orders === "number" ? `${int(scopedRow.orders)} 单` : "单量暂无"}`
                    : storeName ?? undefined
                }
              />
              <MetricSlot
                label="目标达成"
                text={achievementText}
                kind={achievement.rate != null ? "num" : "note"}
                sub={achievementSub}
              />
              <MetricSlot
                label="配件"
                text={hasDaily && salesView ? `${groupMoney(salesView.accessoriesTotal)} 元` : "暂无"}
                kind={hasDaily && salesView ? "num" : "note"}
                sub={hasDaily ? "配件销售额" : dailyNote}
              />
              <MetricSlot
                href={salaryHref}
                label="网单"
                text={hasRoster ? `${money2(payroll!.totals.online)} 元` : "暂无"}
                kind={hasRoster ? "num" : "note"}
              />
              <MetricSlot
                href={salaryHref}
                label="失误"
                text={hasRoster ? `${money2(payroll!.totals.mistake_total)} 元` : "暂无"}
                kind={hasRoster ? "num" : "note"}
              />
              {sensitive ? (
                <MetricSlot
                  href={salaryHref}
                  label="当月工资"
                  text={hasRoster ? `${money2(payroll!.totals.gross)} 元` : "暂无"}
                  kind={hasRoster ? "num" : "note"}
                  sub={monthLabel(selected)}
                />
              ) : null}
            </div>

            {!salesTargets.ok ? (
              <p className="ov-fold-note">
                {salesTargets.reason === "missing_table" ? TARGET_TABLE_MISSING_READ : TARGET_READ_UNAVAILABLE}
              </p>
            ) : null}
            {user.role === "owner" ? (
              <PersonStoreTargetForm
                month={selected}
                stores={storeOptions}
                people={employees.map((person) => ({
                  id: person.id,
                  person_name: person.person_name,
                  employment_status: person.employment_status,
                }))}
                existing={salesTargets.ok ? salesTargets.rows : []}
                persist={realMode(user)}
                tableMissing={!salesTargets.ok && salesTargets.reason === "missing_table"}
              />
            ) : null}

            <div className="ov-charts">
              <section className="ov-panel" aria-label="门店回收日走势">
                <div className="ov-panel-head">
                  <h2>{monthLabel(selected)}门店回收走势（按日）</h2>
                  {hasDaily && salesView ? (
                    <span>合计 {groupMoney(salesView.recycleStoreTotal)} 元</span>
                  ) : recycle !== null ? (
                    <span>当月分润 {money(recycle)} 元</span>
                  ) : null}
                </div>
                {hasDaily ? (
                  <DailySalesChart
                    points={recyclePoints}
                    tone="recycle"
                    label={`${monthLabel(selected)}门店回收按日曲线，空档不是 0`}
                    note="空档表示当天没有记录，不是 0。曲线是门店回收，不含网单。"
                  />
                ) : (
                  <EmptyPlot note={dailyNote} />
                )}
              </section>
              <section className="ov-panel" aria-label="配件日走势">
                <div className="ov-panel-head">
                  <h2>{monthLabel(selected)}配件销售走势（按日）</h2>
                  {hasDaily && salesView ? <span>合计 {groupMoney(salesView.accessoriesTotal)} 元</span> : null}
                </div>
                {hasDaily ? (
                  <DailySalesChart
                    points={accessoryPoints}
                    tone="parts"
                    label={`${monthLabel(selected)}配件销售额按日曲线，空档不是 0`}
                    note="空档表示当天没有记录，不是 0。按配件销售额，不是提成。"
                  />
                ) : (
                  <EmptyPlot note={dailyNote} />
                )}
              </section>
            </div>

            <section className="ov-panel ov-rank-single" aria-label="门店回收排名">
              <div className="ov-panel-head">
                <h2>门店回收排名</h2>
                <span>按门店回收，不含网单</span>
              </div>
              {hasDaily && salesView && salesView.storeRecycle.length > 0 ? (
                <RankList rows={salesView.storeRecycle} />
              ) : (
                <EmptyPlot note={dailyNote} />
              )}
            </section>
            <div className="ov-rank">
              <section className="ov-panel" aria-label="员工回收排名">
                <div className="ov-panel-head">
                  <h2>员工回收排名</h2>
                  <span>门店回收 + 网单不含券</span>
                </div>
                {hasDaily && salesView && salesView.personRecycle.length > 0 ? (
                  <RankList rows={salesView.personRecycle} />
                ) : (
                  <EmptyPlot note={dailyNote} />
                )}
              </section>
              <section className="ov-panel" aria-label="员工配件销售额排名">
                <div className="ov-panel-head">
                  <h2>员工配件销售额排名</h2>
                  <span>按销售额，不是提成</span>
                </div>
                {hasDaily && salesView && salesView.personAccessories.length > 0 ? (
                  <RankList rows={salesView.personAccessories} />
                ) : (
                  <EmptyPlot note={dailyNote} />
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="card">
            <p className="empty">暂未开通任何业务板块，请联系老板开通授权。</p>
          </div>
        )}
    </>
  );
}
