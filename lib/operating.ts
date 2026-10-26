/**
 * 经营核算单一来源（指令44 块C 建立，指令45 块1 修订公式）。
 * 所有页面都从这里取门店净利、公司口径净利、双利润率与年回报率，禁止各页另算。
 *
 * 口径（指令45 定版）：
 * - 门店净利暂定（完整口径） = monthly_metrics.net_profit_provisional（已扣工资分摊、已知扣款）
 *   − 当月 store_costs 合计。
 * - 当月报销花费 = expense_claims 当月全部金额（已报销 + 未报销，均计入已发生花费）。
 * - 公司口径净利 = 门店净利暂定 − 当月报销花费。
 * - 利润率（分润） = 公司口径净利 ÷ 当月分润 × 100。
 * - 利润率（营收） = 公司口径净利 ÷ 当月营收 × 100；营收暂无数据源（订单金额大面积缺失），
 *   revenue 入参为 null 时不出数，页面显示「—」，严禁拿分润冒充营收。
 * - 只有 net_profit_provisional 非空的月份才算完整口径；其余月份公司净利 / 利润率不出数（null）。
 * - 年回报率（45 版） = 年度净利润 ÷ 年度投入；
 *   年度投入 = 门店成本合计（store_costs） + 报销花费（未报销 + 已报销全计）
 *            + 工资实发合计（monthly_metrics 工资汇总 wage_cost）。
 *   年度净利润 = 已核算月份的公司口径净利合计。
 * - 年度窗口截到数据最新月（不把未来月份的种子成本计入本年投入）；
 *   净利覆盖月份与投入覆盖月份分别标注，分母为 0 或无已核算月份时不出数。
 */

export interface OperatingMetricInput {
  month: string;
  profit?: number | null;
  /** 当月营收：暂无数据源，调用方传 null / 不传；接入后自动出「利润率（营收）」。 */
  revenue?: number | null;
  wage_cost?: number | null;
  net_profit_provisional?: number | null;
}

export interface OperatingCostInput {
  month: string;
  amount: number;
}

export interface OperatingExpenseInput {
  claim_date: string;
  amount: number;
  status: "unreimbursed" | "reimbursed";
}

export interface MonthlyOperating {
  month: string;
  profit: number | null;
  revenue: number | null;
  wageCost: number | null;
  baseNetProfit: number | null;
  storeCosts: number;
  storeNetProfit: number | null;
  expenseTotal: number;
  expenseReimbursed: number;
  expenseUnreimbursed: number;
  companyNetProfit: number | null;
  /** 利润率（分润口径）% */
  profitMargin: number | null;
  /** 利润率（营收口径）%：营收未接入时恒为 null */
  revenueMargin: number | null;
  complete: boolean;
}

export interface ReturnSummary {
  label: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** 净利覆盖月份：窗口内具备完整净利口径的月份 */
  coverageMonths: string[];
  /** 投入覆盖月份：窗口内有门店成本 / 报销 / 工资任一投入数据的月份 */
  investedCoverageMonths: string[];
  annualNetProfit: number | null;
  investedCost: number | null;
  storeCostsTotal: number;
  /** 报销花费（未报销 + 已报销全计，45 版口径） */
  expenseAllTotal: number;
  expenseReimbursedTotal: number;
  /** 工资实发合计（monthly_metrics 工资汇总） */
  wageTotal: number;
  returnRate: number | null;
}

export interface OperatingResult {
  months: MonthlyOperating[];
  latestComplete: MonthlyOperating | null;
  annual: ReturnSummary;
  rolling12: ReturnSummary;
}

function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

function monthName(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function expensesForMonth(expenses: OperatingExpenseInput[], month: string) {
  const rows = expenses.filter((e) => e.claim_date.slice(0, 7) === month);
  return {
    total: rows.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    reimbursed: rows
      .filter((e) => e.status === "reimbursed")
      .reduce((s, e) => s + Number(e.amount ?? 0), 0),
    unreimbursed: rows
      .filter((e) => e.status === "unreimbursed")
      .reduce((s, e) => s + Number(e.amount ?? 0), 0),
  };
}

function buildReturnSummary(params: {
  label: string;
  startMonth: string;
  endMonth: string;
  months: MonthlyOperating[];
  storeCosts: OperatingCostInput[];
  expenses: OperatingExpenseInput[];
}): ReturnSummary {
  const { label, startMonth, endMonth, months, storeCosts, expenses } = params;
  const start = monthIndex(startMonth);
  const end = monthIndex(endMonth);
  const inPeriod = (month: string) => {
    const idx = monthIndex(month);
    return idx >= start && idx <= end;
  };
  const complete = months.filter((m) => m.complete && inPeriod(m.month));
  const coverageMonths = complete.map((m) => m.month).sort();
  const annualNetProfit =
    complete.length > 0
      ? complete.reduce((s, m) => s + (m.companyNetProfit ?? 0), 0)
      : null;
  const storeCostsInPeriod = storeCosts.filter((c) => inPeriod(c.month));
  const storeCostsTotal = storeCostsInPeriod.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const expensesInPeriod = expenses.filter((e) => inPeriod(e.claim_date.slice(0, 7)));
  const expenseAllTotal = expensesInPeriod.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const expenseReimbursedTotal = expensesInPeriod
    .filter((e) => e.status === "reimbursed")
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const monthsInPeriod = months.filter((m) => inPeriod(m.month));
  const wageTotal = monthsInPeriod.reduce((s, m) => s + Number(m.wageCost ?? 0), 0);
  const investedCoverage = new Set<string>();
  for (const m of monthsInPeriod) if (m.wageCost !== null) investedCoverage.add(m.month);
  for (const c of storeCostsInPeriod) investedCoverage.add(c.month);
  for (const e of expensesInPeriod) investedCoverage.add(e.claim_date.slice(0, 7));
  const investedCoverageMonths = [...investedCoverage].sort();
  const investedCost = storeCostsTotal + expenseAllTotal + wageTotal;
  return {
    label,
    periodStart: startMonth,
    periodEnd: endMonth,
    coverageMonths,
    investedCoverageMonths,
    annualNetProfit,
    investedCost: complete.length > 0 ? investedCost : null,
    storeCostsTotal,
    expenseAllTotal,
    expenseReimbursedTotal,
    wageTotal,
    returnRate:
      complete.length > 0 && investedCost !== 0 && annualNetProfit !== null
        ? (annualNetProfit / investedCost) * 100
        : null,
  };
}

export function buildOperatingMetrics(input: {
  metrics: OperatingMetricInput[];
  storeCosts: OperatingCostInput[];
  expenses: OperatingExpenseInput[];
}): OperatingResult {
  const { metrics, storeCosts, expenses } = input;
  const months: MonthlyOperating[] = [...metrics]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((metric) => {
      const monthCosts = storeCosts
        .filter((c) => c.month === metric.month)
        .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      const exp = expensesForMonth(expenses, metric.month);
      const baseNetProfit = metric.net_profit_provisional;
      const complete = baseNetProfit !== null && baseNetProfit !== undefined;
      const storeNetProfit = complete ? baseNetProfit - monthCosts : null;
      const companyNetProfit = storeNetProfit === null ? null : storeNetProfit - exp.total;
      const profitMargin =
        companyNetProfit === null || !metric.profit
          ? null
          : (companyNetProfit / metric.profit) * 100;
      const revenue = metric.revenue ?? null;
      const revenueMargin =
        companyNetProfit === null || !revenue
          ? null
          : (companyNetProfit / revenue) * 100;
      return {
        month: metric.month,
        profit: metric.profit ?? null,
        revenue,
        wageCost: metric.wage_cost ?? null,
        baseNetProfit: baseNetProfit ?? null,
        storeCosts: monthCosts,
        storeNetProfit,
        expenseTotal: exp.total,
        expenseReimbursed: exp.reimbursed,
        expenseUnreimbursed: exp.unreimbursed,
        companyNetProfit,
        profitMargin,
        revenueMargin,
        complete,
      };
    });

  const completeMonths = months.filter((m) => m.complete);
  const latestComplete = completeMonths[completeMonths.length - 1] ?? null;
  const lastDataMonth = months[months.length - 1]?.month ?? null;

  if (!latestComplete || !lastDataMonth) {
    const fallbackYear = lastDataMonth?.slice(0, 4) ?? "2026";
    const emptyEnd = lastDataMonth ?? `${fallbackYear}-12`;
    const emptyAnnual = buildReturnSummary({
      label: `${fallbackYear} 年 · 按已核算月份`,
      startMonth: `${fallbackYear}-01`,
      endMonth: emptyEnd,
      months,
      storeCosts,
      expenses,
    });
    const emptyRolling = buildReturnSummary({
      label: "近12个月 · 按已核算月份",
      startMonth: `${fallbackYear}-01`,
      endMonth: emptyEnd,
      months,
      storeCosts,
      expenses,
    });
    return { months, latestComplete: null, annual: emptyAnnual, rolling12: emptyRolling };
  }

  const year = latestComplete.month.slice(0, 4);
  const annual = buildReturnSummary({
    label: `${year} 年 · 按已核算月份`,
    startMonth: `${year}-01`,
    endMonth: lastDataMonth,
    months,
    storeCosts,
    expenses,
  });

  const endIdx = monthIndex(latestComplete.month);
  const rolling12 = buildReturnSummary({
    label: `近12个月（${monthName(endIdx - 11)} ~ ${latestComplete.month}）· 按已核算月份`,
    startMonth: monthName(endIdx - 11),
    endMonth: latestComplete.month,
    months,
    storeCosts,
    expenses,
  });

  return { months, latestComplete, annual, rolling12 };
}

/** 投入覆盖标注：如「2026-01 ~ 2026-09」；无数据时「—」。 */
export function coverageRange(months: string[]): string {
  if (months.length === 0) return "—";
  if (months.length === 1) return months[0];
  return `${months[0]} ~ ${months[months.length - 1]}`;
}

// ============================================================
// 两店对比（指令46 B1）：单店口径与公司口径分开。
// - 单店净利暂定 = 该店 net_profit_provisional（到店口径，已扣该店工资分摊与已知扣款）
//   − 该店当月 store_costs。报销是公司级花费，不摊入单店。
// - 单店利润率（分润） = 单店净利暂定（扣门店成本后） ÷ 该店当月到店分润。
// - 营收无数据源：revenue 恒为 null，利润率（营收）不出数。
// - 只有 net_profit_provisional 非空的月份才有单店净利/利润率（当前仅 2026-09）。
// ============================================================

export interface StoreCostScopedInput {
  month: string;
  amount: number;
  scope: string;
}

export interface StoreMonthComparison {
  month: string;
  profit: number | null;
  revenue: number | null;
  baseNetProfit: number | null;
  storeCosts: number;
  netAfterCosts: number | null;
  profitMargin: number | null;
  revenueMargin: number | null;
}

export function buildStoreComparison(input: {
  metrics: OperatingMetricInput[];
  storeCosts: StoreCostScopedInput[];
  scope: string;
}): StoreMonthComparison[] {
  return input.metrics.map((metric) => {
    const storeCosts = input.storeCosts
      .filter((c) => c.month === metric.month && c.scope === input.scope)
      .reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const baseNetProfit = metric.net_profit_provisional ?? null;
    const netAfterCosts = baseNetProfit === null ? null : baseNetProfit - storeCosts;
    const profitMargin =
      netAfterCosts === null || !metric.profit
        ? null
        : (netAfterCosts / metric.profit) * 100;
    return {
      month: metric.month,
      profit: metric.profit ?? null,
      revenue: null,
      baseNetProfit,
      storeCosts,
      netAfterCosts,
      profitMargin,
      revenueMargin: null,
    };
  });
}
