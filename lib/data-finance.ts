import { cookies } from "next/headers";
import { createClient as createServerSupabase, isSupabaseConfigured } from "./supabase/server";
import { realMode, type CurrentUser } from "./data-core";

// ============================================================
// 工资体系 + 两店成本（指令41 / migration_003）
// 骨架阶段：老板尚未提供工资规则与成本数字，查询为空属正常，页面走空态。
// 权限由 RLS 收口（salary_monthly 店员仅自己已发布行；store_costs 店员不可见），
// 这里再按角色分发查询，双保险。演示模式一律返回空（页面用本地状态演示表单）。
// ============================================================
// 门店 / 成本类型在 lib/stores（客户端安全模块）；此处 import 供本文件接口使用并转发导出
import { STORE_LABEL, COST_TYPE_LABEL, STORE_SHORT_LABEL, type StoreScope, type CostType } from "./stores";
import { EXPENSE_SCOPE_LABEL, type ExpenseScope, type ExpenseStatus } from "./expenses";
import { money2 } from "./format";
export type { StoreScope, CostType };
export type { ExpenseScope, ExpenseStatus };
export { EXPENSE_SCOPE_LABEL };

export interface SalaryRule {
id: string;
title: string;
base_salary: number | null;
commission_rules: Record<string, unknown>;
note: string | null;
effective_from: string | null; // 生效起始月 'YYYY-MM'（指令42），null = 待老板补填
updated_at: string;
}

export interface SalaryMonthlyRow {
id: string;
user_id: string;
month: string;
scope: StoreScope;
base_amount: number | null;
commission_amount: number | null;
deduction_amount: number | null;
net_amount: number;
note: string | null;
published: boolean;
updated_at: string;
}

export interface SalaryStoreAgg {
scope: StoreScope;
month: string;
headcount: number;
total_net: number | null;
total_base: number | null;
total_commission: number | null;
}

export interface StoreCost {
id: string;
scope: StoreScope;
month: string;
cost_type: CostType;
amount: number;
note: string | null;
updated_at: string;
}


// ============================================================
// 月度目标（指令46 B8)：老板设定、其余角色只读；未设定即空，不预填。
// ============================================================
export type SiteTargetMetric = "profit" | "net_profit" | "orders";

export interface SiteTarget {
id: string;
month: string;
metric: SiteTargetMetric;
target_value: number;
note: string | null;
updated_at: string;
}

export async function getSiteTargets(user: CurrentUser): Promise<SiteTarget[]> {
if (user.demo) {
  // 指令59 A2：演示态目标注入——仅演示会话读 demo_targets Cookie
  // （base64url 编码的 JSON 数组：{month, metric, target_value}），供目标
  // 复盘「已达成 / 未达成 / 待核算」三分支进回归实测。生产构建中演示
  // 总开关关闭时 getCurrentUser 永不返回 demo 用户，此分支恒不达，
  // 生产恒忽略该 Cookie（audit-online 有伪造注入仍 307 的断言）。
  try {
    const raw = (await cookies()).get("demo_targets")?.value;
    if (raw) {
      const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      if (Array.isArray(parsed)) {
        const metrics: SiteTargetMetric[] = ["profit", "net_profit", "orders"];
        return parsed
          .filter(
            (t): t is { month: string; metric: SiteTargetMetric; target_value: number } =>
              !!t &&
              typeof t === "object" &&
              typeof (t as { month?: unknown }).month === "string" &&
              metrics.includes((t as { metric: SiteTargetMetric }).metric) &&
              Number.isFinite(Number((t as { target_value?: unknown }).target_value))
          )
          .map((t) => ({
            id: `demo-target-${t.month}-${t.metric}`,
            month: t.month,
            metric: t.metric,
            target_value: Number(t.target_value),
            note: "演示注入（仅回归实测，生产恒忽略）",
            updated_at: "demo",
          }));
      }
    }
  } catch {
    // 注入格式不对按未设定处理
  }
  return [];
}
if (!realMode(user)) return [];
try {
const supabase = await createServerSupabase();
const { data, error } = await supabase
.from("site_targets")
.select("*")
.order("month", { ascending: true });
if (!error && data) return data as SiteTarget[];
} catch {
// 空态（表未建时按未设定处理）
}
return [];
}

/** 工资体系规则：仅老板（RLS 同样仅 owner 可写）。演示模式回兜底规则（与 migration_004 种子一致）。 */
export async function getSalaryRules(user: CurrentUser): Promise<SalaryRule[]> {
if (user.role !== "owner") return [];
if (user.demo) return [FALLBACK_SALARY_RULE];
if (!realMode(user)) return [];
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("salary_rules")
.select("id, title, base_salary, commission_rules, note, effective_from, updated_at")
.order("updated_at", { ascending: false});
if (!error && data) return data as SalaryRule[];
} catch {
// 空态
}
return [];
}

/**
 * 现行工资规则（「工资怎么算」规则卡用，全角色可见；RLS 已放行 salary_rules 全员可读）。
 * 真实模式读库中最新一条；演示 / 未配置时用与 migration_004 种子一致的兜底常量。
 */
export async function getPublicSalaryRule(user: CurrentUser): Promise<SalaryRule | null> {
if (user.demo || !isSupabaseConfigured()) return FALLBACK_SALARY_RULE;
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("salary_rules")
.select("id, title, base_salary, commission_rules, note, effective_from, updated_at")
.order("updated_at", { ascending: false})
.limit(1);
if (!error && data && data.length > 0) return data[0] as SalaryRule;
} catch {
// 落到空态
}
return null;
}

/** 兜底工资规则：与 migration_004 种子逐字一致（老板 2026-10-26 口述版），仅演示 / 未配置时使用。 */
export const FALLBACK_SALARY_RULE: SalaryRule = {
id: "fallback-salary-rule",
title: "通用工资体系（老板口述版）",
base_salary: 2000,
commission_rules: {
base_breakdown: { basic: 1000, attendance: 500, new_customer: 500, note: "拉新非交口径待工资表模板到后核对，先按老板口述原样记录" },
online_order_pct: 1,
store_tiers: [
{ threshold: 30000, pct: 3 },
{ threshold: 60000, pct: 4, note: "阶梯取最高达成档" },
],
accessories_tiers: [
{ below: 6500, pct: 20 },
{ threshold: 6500, pct: 30 },
{ threshold: 10000, pct: 40 },
],
door_profit_pct: 50,
},
note: "老板 2026-10-26 口述；历史规则几个月前改过，生效起始月待老板补填后支持双版本回算",
effective_from: null,
updated_at: "2026-10-26",
};

/** 员工自己的月度工资：只按当前 user id 查（RLS 再兜底：仅自己 + 已发布）。 */
export async function getMySalary(user: CurrentUser): Promise<SalaryMonthlyRow[]> {
if (!realMode(user)) return [];
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("salary_monthly")
.select("*")
.eq("user_id", user.id as string)
.eq("published", true)
.order("month", { ascending: false});
if (!error && data) return data as SalaryMonthlyRow[];
} catch {
// 空态
}
return [];
}

/** 全员月度工资行：仅老板（RLS 同样仅 owner 全权）。 */
export async function getAllSalaryMonthly(user: CurrentUser): Promise<SalaryMonthlyRow[]> {
if (user.role !== "owner" || !realMode(user)) return [];
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("salary_monthly")
.select("*")
.order("month", { ascending: false});
if (!error && data) return data as SalaryMonthlyRow[];
} catch {
// 空态
}
return [];
}

export interface SalaryDetailImportRow {
  id: string;
  month: string;
  section: "store" | "door";
  employee_name: string;
  base_amount: number | null;
  commission_amount: number | null;
  deduction_amount: number | null;
  net_amount: number | null;
  note: string | null;
  matched_user_id: string | null;
  imported_at: string;
}

/**
 * 工资实表明细（salary_detail_import，指令47）：仅老板可读——应用层先按
 * role 收口，RLS 也只有 owner 策略；partner / staff 恒返回空且不发查询。
 * 演示模式返回空（页面走空骨架），明细数字只来自私有导入，不进仓库。
 */
export async function getSalaryDetailImport(user: CurrentUser): Promise<SalaryDetailImportRow[]> {
  if (user.role !== "owner" || !realMode(user)) return [];
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("salary_detail_import")
      .select("*")
      .order("month", { ascending: true })
      .order("section", { ascending: true })
      .order("employee_name", { ascending: true });
    if (!error && data) return data as SalaryDetailImportRow[];
  } catch {
    // 空态（迁移未执行时表不存在，页面走空骨架）
  }
  return [];
}

/** 明细按月净额合计（年回报分母交叉校验用）：key = 'YYYY-MM'。 */
export function salaryDetailByMonth(rows: SalaryDetailImportRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.month] = (map[r.month] ?? 0) + Number(r.net_amount ?? 0);
  }
  return map;
}

/** 门店月度工资汇总（视图）：老板全量、合伙人按视图内行过滤；staff 恒空。 */
export async function getSalaryStoreAgg(user: CurrentUser): Promise<SalaryStoreAgg[]> {
if (user.role === "staff" || !realMode(user)) return [];
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("salary_store_monthly_agg")
.select("*")
.order("month", { ascending: false});
if (!error && data) return data as SalaryStoreAgg[];
} catch {
// 空态
}
return [];
}

/**
 * 两店成本：老板 / 合伙人可读（RLS 同步收口）；staff 直接返回空且不发查询。
 * 演示模式用与 migration_004 种子一致的兜底成本（合同已定的房租/物业费），供口径验证。
 */
export async function getStoreCosts(user: CurrentUser): Promise<StoreCost[]> {
if (user.role === "staff") return [];
if (user.demo) return FALLBACK_STORE_COSTS;
if (!realMode(user)) return [];
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("store_costs")
.select("*")
.order("month", { ascending: false})
.order("scope", { ascending: true});
if (!error && data) return data as StoreCost[];
} catch {
// 空态
}
return [];
}

function seedCost(scope: StoreScope, month: string, cost_type: CostType, amount: number, note: string): StoreCost {
return { id: `seed-${scope}-${cost_type}-${month}`, scope, month, cost_type, amount, note, updated_at: "2026-10-26" };
}

const WANDA_OLD_MONTHS = [
"2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
"2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
];
const WANDA_NEW_MONTHS = [
"2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05",
"2027-06", "2027-07", "2027-08", "2027-09", "2027-10", "2027-11",
];
const FRIENDSHIP_RENT_MONTHS = [
"2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
"2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01",
];

/**
 * 兜底成本：与 migration_004 的 store_costs 种子逐行一致（指令42/42b）。
 * 万达分时段：上一期月租 4100.04（2026-01~11，王州确认）+ 新合同期 2026-12 起展示费/物业费拆分；
 * 友谊只有年租金月摊（联营扣点为避税写法、管理费未实际发生，均不入账）；万达电费实报实销不在此列。
 */
export const FALLBACK_STORE_COSTS: StoreCost[] = [
...FRIENDSHIP_RENT_MONTHS.map((m) =>
seedCost("friendship", m, "rent", 7083.33, "年租金 85000 月摊（合同期至 2027-01-31）")
),
...WANDA_OLD_MONTHS.map((m) =>
seedCost("wanda", m, "rent", 4100.04, "上一期综合服务费（单价 341.67 元/㎡×12㎡，王州确认，未拆分展示/物业；旧期至 2026-11-27）")
),
...WANDA_NEW_MONTHS.map((m, i) =>
seedCost("wanda", m, "rent", 3921.6, i === 0 ? "合同综合服务费之展示费（新合同 2026-11-28 生效，11 月整月按旧期口径，2026-12 起新价）" : "合同综合服务费之展示费")
),
...WANDA_NEW_MONTHS.map((m, i) => seedCost("wanda", m, "other", 588, i === 0 ? "合同综合服务费之物业费（新合同 2026-11-28 生效，2026-12 起新价）" : "合同综合服务费之物业费")),
].sort((a, b) => b.month.localeCompare(a.month) || a.scope.localeCompare(b.scope));

/** 某月成本脚注描述：合计 + 分项（门店短名+类型+金额）+ 当月无任何成本行的门店（未取得）。 */
export function describeMonthCosts(
costs: StoreCost[],
month: string
): { total: number; items: string; missingStores: StoreScope[] } {
const rows = costs.filter((c) => c.month === month);
const total = rows.reduce((s, c) => s + (c.amount ?? 0), 0);
const items = rows
.map((c) => `${STORE_SHORT_LABEL[c.scope]}${COST_TYPE_LABEL[c.cost_type]} ${money2(c.amount)}`)
.join("、");
const missingStores = (Object.keys(STORE_LABEL) as StoreScope[]).filter(
(s) => !rows.some((c) => c.scope === s)
);
return { total, items, missingStores };
}

// ============================================================
// 公司报销台账（指令44 / migration_005）：未报销也算已发生花费。
// owner 看全部；partner 只读月度汇总视图；staff 只查自己创建的行。
// ============================================================
export interface ExpenseClaim {
  id: string;
  claim_date: string;
  title: string;
  category: string;
  amount: number;
  scope: ExpenseScope | null;
  claimant_name: string | null;
  status: ExpenseStatus;
  reimbursed_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseMonthlyAgg {
  month: string;
  total: number;
  reimbursed_total: number;
  unreimbursed_total: number;
  count: number;
}

export const FALLBACK_EXPENSE_CLAIMS: ExpenseClaim[] = [
  {
    id: "demo-expense-travel",
    claim_date: "2026-10-12",
    title: "示例·差旅",
    category: "差旅",
    amount: 320,
    scope: "company",
    claimant_name: null,
    status: "unreimbursed",
    reimbursed_at: null,
    note: "演示种子，老板可直接删除",
    created_by: null,
    created_at: "2026-10-12T00:00:00+08:00",
    updated_at: "2026-10-12T00:00:00+08:00",
  },
  {
    id: "demo-expense-purchase",
    claim_date: "2026-10-03",
    title: "示例·采购",
    category: "采购",
    amount: 158.5,
    scope: "wanda",
    claimant_name: null,
    status: "reimbursed",
    reimbursed_at: "2026-10-05T00:00:00+08:00",
    note: "演示种子，老板可直接删除",
    created_by: null,
    created_at: "2026-10-03T00:00:00+08:00",
    updated_at: "2026-10-05T00:00:00+08:00",
  },
  {
    id: "demo-expense-logistics",
    claim_date: "2026-10-18",
    title: "示例·物流",
    category: "物流",
    amount: 96,
    scope: "friendship",
    claimant_name: null,
    status: "unreimbursed",
    reimbursed_at: null,
    note: "演示种子，老板可直接删除",
    created_by: null,
    created_at: "2026-10-18T00:00:00+08:00",
    updated_at: "2026-10-18T00:00:00+08:00",
  },
];

export function aggregateExpenseClaims(claims: ExpenseClaim[]): ExpenseMonthlyAgg[] {
  const byMonth = new Map<string, ExpenseMonthlyAgg>();
  for (const claim of claims) {
    const month = claim.claim_date.slice(0, 7);
    const row = byMonth.get(month) ?? {
      month,
      total: 0,
      reimbursed_total: 0,
      unreimbursed_total: 0,
      count: 0,
    };
    row.total += claim.amount;
    if (claim.status === "reimbursed") row.reimbursed_total += claim.amount;
    else row.unreimbursed_total += claim.amount;
    row.count += 1;
    byMonth.set(month, row);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function normalizeExpenseClaim(row: Record<string, unknown>): ExpenseClaim {
  return {
    ...(row as unknown as ExpenseClaim),
    amount: Number(row.amount ?? 0),
  };
}

/** 报销明细：owner 全量、staff 仅自己；partner 不查本表（只用汇总视图）。 */
export async function getExpenseClaims(user: CurrentUser): Promise<ExpenseClaim[]> {
  if (user.role === "partner") return [];
  if (user.demo) return user.role === "owner" ? FALLBACK_EXPENSE_CLAIMS : [];
  if (!realMode(user)) return [];
  try {
    const supabase = await createServerSupabase();
    let query = supabase
      .from("expense_claims")
      .select("*")
      .order("claim_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (user.role === "staff") query = query.eq("created_by", user.id as string);
    const { data, error } = await query;
    if (!error && data) return data.map((r) => normalizeExpenseClaim(r as Record<string, unknown>));
  } catch {
    // migration 未执行或暂无数据时显示空态
  }
  return [];
}

/** 报销月度汇总：owner / partner 全量汇总；staff 仅自己的汇总（视图内已按角色过滤）。 */
export async function getExpenseMonthlyAgg(user: CurrentUser): Promise<ExpenseMonthlyAgg[]> {
  if (user.demo) {
    return user.role === "staff" ? [] : aggregateExpenseClaims(FALLBACK_EXPENSE_CLAIMS);
  }
  if (!realMode(user)) return [];
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("expense_monthly_agg")
      .select("*")
      .order("month", { ascending: false });
    if (!error && data) {
      return data.map((r) => ({
        month: String(r.month),
        total: Number(r.total ?? 0),
        reimbursed_total: Number(r.reimbursed_total ?? 0),
        unreimbursed_total: Number(r.unreimbursed_total ?? 0),
        count: Number(r.count ?? 0),
      }));
    }
  } catch {
    // 空态
  }
  return [];
}

/**
 * 经营核算用的报销输入：只取月度汇总再合成核算行，不把 partner 的明细带进页面。
 * owner / partner 用全量汇总；staff 不参与敏感经营核算，返回空。
 */
export async function getExpenseOperatingInput(user: CurrentUser): Promise<ExpenseClaim[]> {
  if (user.role === "staff") return [];
  const agg = await getExpenseMonthlyAgg(user);
  const rows: ExpenseClaim[] = [];
  for (const row of agg) {
    if (row.reimbursed_total > 0) {
      rows.push({
        id: `agg-${row.month}-reimbursed`,
        claim_date: `${row.month}-01`,
        title: "月度汇总（已报销）",
        category: "汇总",
        amount: row.reimbursed_total,
        scope: "company",
        claimant_name: null,
        status: "reimbursed",
        reimbursed_at: `${row.month}-01T00:00:00+08:00`,
        note: null,
        created_by: null,
        created_at: `${row.month}-01T00:00:00+08:00`,
        updated_at: `${row.month}-01T00:00:00+08:00`,
      });
    }
    if (row.unreimbursed_total > 0) {
      rows.push({
        id: `agg-${row.month}-unreimbursed`,
        claim_date: `${row.month}-01`,
        title: "月度汇总（未报销）",
        category: "汇总",
        amount: row.unreimbursed_total,
        scope: "company",
        claimant_name: null,
        status: "unreimbursed",
        reimbursed_at: null,
        note: null,
        created_by: null,
        created_at: `${row.month}-01T00:00:00+08:00`,
        updated_at: `${row.month}-01T00:00:00+08:00`,
      });
    }
  }
  return rows;
}

// ============================================================
// 合同台账（指令42 / migration_004）：只登记合同要点，不直接进成本；
// 成本由 store_costs 按合同口径逐月种子 / 录入。保证金不进月成本。
// ============================================================
export interface StoreContract {
id: string;
scope: StoreScope;
title: string;
party_a: string | null;
party_b: string | null;
location: string | null;
area_sqm: number | null;
term_start: string | null;
term_end: string | null;
monthly_fee: number | null;
fee_breakdown: Record<string, unknown>;
payment_cycle: string | null;
deposit_total: number | null;
note: string | null;
updated_at: string;
}

/** 兜底合同台账：与 migration_004 种子逐字一致（老板提供的两份合同关键数字）。 */
export const FALLBACK_CONTRACTS: StoreContract[] = [
{
id: "fallback-contract-wanda",
scope: "wanda",
title: "万达广场展示点位综合服务合同",
party_a: "石河子市聚成云科网络科技有限公司",
party_b: "石河子市万达广场商业管理有限公司",
location: "万达广场 2F JY-BX-206",
area_sqm: 12,
term_start: "2026-11-28",
term_end: "2027-11-27",
monthly_fee: 4509.6,
fee_breakdown: { "展示费": 3921.6, "物业费": 588, "新单价": "375.8 元/㎡/月", "上一期单价": "341.67 元/㎡/月", "上一期月费": 4100.04, "上一期到期": "2026-11-27" },
payment_cycle: "按季支付；首期 13979.76（2026-11-28~2027-02-28）",
deposit_total: 14019.2,
note: "签约主体：石河子市聚成云科网络科技有限公司 × 石河子市万达广场商业管理有限公司；月综合服务费（含税）4509.60 = 展示费 3921.60 + 物业费 588.00，年合计 54115.20；保证金 = 履约 9019.20 + 质量 5000，只登记不进月成本；电费自装智能电表按量预缴，按月实填；上一期单价 341.67 元/㎡/月经微信与万达负责人王州确认（上一期月费 4100.04，未拆分展示/物业，旧期至 2026-11-27）",
updated_at: "2026-10-26",
},
{
id: "fallback-contract-friendship",
scope: "friendship",
title: "壹加壹小吃街租赁合同",
party_a: "壹加壹小吃街（甲方，出租方）",
party_b: "张森",
location: "友谊大厦负一层摊位 111",
area_sqm: 22,
term_start: "2026-02-01",
term_end: "2027-01-31",
monthly_fee: 7083.33,
fee_breakdown: {
"年租金": 85000,
"月摊": 7083.33,
},
payment_cycle: "年租金一次付清",
deposit_total: 13000,
note: "合同署名乙方为张森，业务口径门店名为友谊；年租金 85000 已一次付清，按月摊 7083.33 记房租；合同中联营扣点 8% 为避税写法，非实际成本，不计入核算（老板 2026-10-26 确认）；除年租金外无其他费用（管理费未实际发生，不记）；另有免租至 2027-02-07；保证金 = 履约 10000 + 设备押金 3000，只登记不进月成本；甲方名称以合同原文为准（此处按老板提供口径登记）",
updated_at: "2026-10-26",
},
];

/** 合同台账：老板 / 合伙人可读（RLS 同步收口）；staff 返回空。真实模式优先读库，空/失败时用兜底（与种子一致）。 */
export async function getStoreContracts(user: CurrentUser): Promise<StoreContract[]> {
if (user.role === "staff") return [];
if (!user.demo && isSupabaseConfigured() && user.id) {
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("store_contracts")
.select("*")
.order("scope", { ascending: true});
if (!error && data && data.length > 0) return data as StoreContract[];
} catch {
// 用兜底台账
}
}
return FALLBACK_CONTRACTS;
}

/** 某月两店已录入成本合计（净利公式用；无录入 = 0，不影响现版数字）。 */
export function storeCostsTotalForMonth(costs: StoreCost[], month: string): number {
return costs
.filter((c) => c.month === month)
.reduce((s, c) => s + (c.amount ?? 0), 0);
}

/** 工资体系 / 门店成本配置最近更新时间（状态页用）。 */
export async function getConfigFreshness(
user: CurrentUser
): Promise<{ salaryRules: string | null; storeCosts: string | null; demo: boolean}> {
if (user.demo) return { salaryRules: null, storeCosts: null, demo: true };
if (!realMode(user)) return { salaryRules: null, storeCosts: null, demo: false };
let salaryRules: string | null = null;
let storeCosts: string | null = null;
try {
const supabase = await createServerSupabase();
// 指令133 A2 瀑布：两条新鲜度查询互相独立，由串行 2 层改并行 1 层；
// 角色门槛不变（工资规则仅 owner、门店成本 staff 不查），不查的分支以空结果占位。
const [rulesRes, costsRes] = await Promise.all([
user.role === "owner"
? supabase
.from("salary_rules")
.select("updated_at")
.order("updated_at", { ascending: false})
.limit(1)
: Promise.resolve({ data: null as { updated_at: string }[] | null }),
user.role !== "staff"
? supabase
.from("store_costs")
.select("updated_at")
.order("updated_at", { ascending: false})
.limit(1)
: Promise.resolve({ data: null as { updated_at: string }[] | null }),
]);
salaryRules = (rulesRes.data?.[0]?.updated_at as string) ?? null;
storeCosts = (costsRes.data?.[0]?.updated_at as string) ?? null;
} catch {
// 按暂无录入处理
}
return { salaryRules, storeCosts, demo: false };
}
