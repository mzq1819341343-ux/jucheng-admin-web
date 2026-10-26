/**
 * 经营核算单一来源（指令44 块C）。
 * 所有页面都从这里取门店净利、公司口径净利、利润率与年回报率，禁止各页另算。
 *
 * 口径：
 * - 门店净利暂定（完整口径） = monthly_metrics.net_profit_provisional（已扣工资分摊、已知扣款）
 *   − 当月 store_costs 合计。
 * - 当月报销花费 = expense_claims 当月全部金额（已报销 + 未报销，均已发生）。
 * - 公司口径净利 = 门店净利暂定 − 当月报销花费。
 * - 利润率（月） = 公司口径净利 ÷ 当月分润 × 100。
 * - 只有 net_profit_provisional 非空的月份才算完整口径；其余月份公司净利 / 利润率不出数（null）。
 * - 年度投入成本 = 年内 store_costs 合计 + 年内 expense_claims 已报销金额。
 * - 年度净利润 = 年内已核算月份的公司口径净利合计。
 */

export interface OperatingMetricInput {
  month: string;
  profit?: number | null;
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
  baseNetProfit: number | null;
  storeCosts: number;
  storeNetProfit: number | null;
  expenseTotal: number;
  expenseReimbursed: number;
  expenseUnreimbursed: number;
  companyNetProfit: number | null;
  profitMargin: number | null;
  complete: boolean;
}

export interface ReturnSummary {
  label: string;
  periodStart: string | null;
  periodEnd: string | null;
  coverageMonths: string[];
  annualNetProfit: number | null;
  investedCost: number | null;
  storeCostsTotal: number;
  reimbursedExpenseTotal: number;
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
  const storeCostsTotal = storeCosts
    .filter((c) => inPeriod(c.month))
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const reimbursedExpenseTotal = expenses
    .filter((e) => e.status === "reimbursed" && inPeriod(e.claim_date.slice(0, 7)))
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const investedCost = storeCostsTotal + reimbursedExpenseTotal;
  return {
    label,
    periodStart: startMonth,
    periodEnd: endMonth,
    coverageMonths,
    annualNetProfit,
    investedCost: complete.length > 0 ? investedCost : null,
    storeCostsTotal,
    reimbursedExpenseTotal,
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
      return {
        month: metric.month,
        profit: metric.profit ?? null,
        baseNetProfit: baseNetProfit ?? null,
        storeCosts: monthCosts,
        storeNetProfit,
        expenseTotal: exp.total,
        expenseReimbursed: exp.reimbursed,
        expenseUnreimbursed: exp.unreimbursed,
        companyNetProfit,
        profitMargin,
        complete,
      };
    });

  const completeMonths = months.filter((m) => m.complete);
  const latestComplete = completeMonths[completeMonths.length - 1] ?? null;

  if (!latestComplete) {
    const fallbackYear = months[months.length - 1]?.month.slice(0, 4) ?? "2026";
    const emptyAnnual = buildReturnSummary({
      label: `${fallbackYear} 年 · 按已核算月份`,
      startMonth: `${fallbackYear}-01`,
      endMonth: `${fallbackYear}-12`,
      months,
      storeCosts,
      expenses,
    });
    const emptyRolling = buildReturnSummary({
      label: "近12个月 · 按已核算月份",
      startMonth: `${fallbackYear}-01`,
      endMonth: `${fallbackYear}-12`,
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
    endMonth: `${year}-12`,
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
