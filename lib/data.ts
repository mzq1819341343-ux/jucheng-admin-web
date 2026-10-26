import { cookies} from "next/headers";
import { createClient as createServerSupabase, isSupabaseConfigured} from "./supabase/server";
import { isDemoAllowed } from "./demo";
import { FALLBACK_BUSINESSES, type BusinessDef } from "./businesses";

export type { BusinessDef };
export type Role = "owner" | "partner" | "staff";
export type Scope = "combined" | "wanda" | "friendship";

export interface MetricRow {
month: string;
scope: Scope;
orders: number | null;
profit: number | null;
door_orders: number | null;
avg_profit: number | null;
wage_cost?: number | null; // 敏感：staff 视图里不存在
wage_ratio?: number | null; // 敏感
per_capita_profit?: number | null; // 敏感
per_capita_orders?: number | null;
net_profit_provisional?: number | null; // 敏感
note?: string | null;
}

export interface Profile {
id: string;
role: Role;
display_name: string | null;
store_scope: string;
}

export interface FetchLog {
source: string;
status: string;
message: string | null;
created_at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
owner: "老板",
partner: "合伙人",
staff: "店员",
};

/** 敏感字段（净利 / 工资类）：staff 不可见。页面一律按此判断 + 服务端数据层双保险。 */
export function canSeeSensitive(role: Role) {
return role === "owner" || role === "partner";
}

// ============================================================
// 兜底汇总数据：与 supabase/seed.sql 完全一致（爱回收驾驶舱 v3.3 汇总口径）。
// 仅当 Supabase 未配置或查询失败时使用，保证预览链接可打开、可演示。
// 全部数字来自 v3.3 已锁定台账汇总，不含任何个人数据。
// ============================================================
export const FALLBACK_COMBINED: MetricRow[] = [
{ month: "2026-01", scope: "combined", orders: 71, profit: 6458.52, door_orders: 37, avg_profit: 90.96, wage_cost: 5474.73, wage_ratio: 84.8, per_capita_profit: 1614.63, per_capita_orders: 17.75, net_profit_provisional: null, note: "1 月工资仅银行代发汇总，无拆分"},
{ month: "2026-02", scope: "combined", orders: 349, profit: 30700.77, door_orders: 204, avg_profit: 87.97, wage_cost: 24826.79, wage_ratio: 80.9, per_capita_profit: 7675.19, per_capita_orders: 87.25, net_profit_provisional: null},
{ month: "2026-03", scope: "combined", orders: 600, profit: 61454.97, door_orders: 274, avg_profit: 102.42, wage_cost: 31961.53, wage_ratio: 52.0, per_capita_profit: 10242.5, per_capita_orders: 100.0, net_profit_provisional: null},
{ month: "2026-04", scope: "combined", orders: 524, profit: 51464.85, door_orders: 259, avg_profit: 98.22, wage_cost: 29411.15, wage_ratio: 57.1, per_capita_profit: 6433.11, per_capita_orders: 65.5, net_profit_provisional: null},
{ month: "2026-05", scope: "combined", orders: 452, profit: 47902.53, door_orders: 227, avg_profit: 105.98, wage_cost: 32051.8, wage_ratio: 66.9, per_capita_profit: 5987.82, per_capita_orders: 56.5, net_profit_provisional: null},
{ month: "2026-06", scope: "combined", orders: 679, profit: 64865.92, door_orders: 356, avg_profit: 95.53, wage_cost: 31259.0, wage_ratio: 48.2, per_capita_profit: 9266.56, per_capita_orders: 97.0, net_profit_provisional: null},
{ month: "2026-07", scope: "combined", orders: 433, profit: 45630.56, door_orders: 207, avg_profit: 105.38, wage_cost: 28998.0, wage_ratio: 63.5, per_capita_profit: 6518.65, per_capita_orders: 61.86, net_profit_provisional: null},
{ month: "2026-08", scope: "combined", orders: 437, profit: 54962.6, door_orders: 180, avg_profit: 125.77, wage_cost: 30510.0, wage_ratio: 55.5, per_capita_profit: 7851.8, per_capita_orders: 62.43, net_profit_provisional: null, note: "8 月工资以门店工资表汇总为准"},
{ month: "2026-09", scope: "combined", orders: 413, profit: 53220.6, door_orders: 189, avg_profit: 128.86, wage_cost: 30264.0, wage_ratio: 56.9, per_capita_profit: 6652.58, per_capita_orders: 51.63, net_profit_provisional: 4870.86, note: "净利暂定，未扣房租水电"},
];

export const FALLBACK_STORES: MetricRow[] = [
{ month: "2026-01", scope: "wanda", orders: 34, profit: 4482.52, door_orders: null, avg_profit: 131.84},
{ month: "2026-02", scope: "wanda", orders: 181, profit: 21575.77, door_orders: null, avg_profit: 119.2},
{ month: "2026-03", scope: "wanda", orders: 214, profit: 31218.73, door_orders: null, avg_profit: 145.88},
{ month: "2026-04", scope: "wanda", orders: 149, profit: 24738.43, door_orders: null, avg_profit: 166.03},
{ month: "2026-05", scope: "wanda", orders: 130, profit: 21818.45, door_orders: null, avg_profit: 167.83},
{ month: "2026-06", scope: "wanda", orders: 168, profit: 26323.87, door_orders: null, avg_profit: 156.69},
{ month: "2026-07", scope: "wanda", orders: 127, profit: 21393.85, door_orders: null, avg_profit: 168.46},
{ month: "2026-08", scope: "wanda", orders: 152, profit: 29172.53, door_orders: null, avg_profit: 191.92},
{ month: "2026-09", scope: "wanda", orders: 124, profit: 27111.21, door_orders: null, avg_profit: 218.64, net_profit_provisional: 3290.59},
{ month: "2026-01", scope: "friendship", orders: 0, profit: 0, door_orders: null, avg_profit: null},
{ month: "2026-02", scope: "friendship", orders: 1, profit: 35.0, door_orders: null, avg_profit: 35.0},
{ month: "2026-03", scope: "friendship", orders: 112, profit: 15646.24, door_orders: null, avg_profit: 139.7},
{ month: "2026-04", scope: "friendship", orders: 116, profit: 13486.42, door_orders: null, avg_profit: 116.26},
{ month: "2026-05", scope: "friendship", orders: 95, profit: 14656.58, door_orders: null, avg_profit: 154.28},
{ month: "2026-06", scope: "friendship", orders: 155, profit: 18634.05, door_orders: null, avg_profit: 120.22},
{ month: "2026-07", scope: "friendship", orders: 99, profit: 13797.71, door_orders: null, avg_profit: 139.37},
{ month: "2026-08", scope: "friendship", orders: 105, profit: 15149.57, door_orders: null, avg_profit: 144.28},
{ month: "2026-09", scope: "friendship", orders: 100, profit: 15684.39, door_orders: null, avg_profit: 156.84, net_profit_provisional: 1580.27},
];

export const FALLBACK_FETCH_LOGS: FetchLog[] = [
{ source: "aihuishou_cockpit_v3_3", status: "success", message: "手动导入爱回收驾驶舱 v3.3 汇总（2026-01~09）：3,958 单 / 分润 416,661.32 元", created_at: "2026-10-26 18:00"},
{ source: "aihuishou_auto_fetch", status: "pending", message: "自动抓取未启用：待老板登录爱回收后台并恢复 10 月续抓后启用", created_at: "2026-10-26 18:00"},
];

// ============================================================
// 当前用户与角色
// - 已配置 Supabase 且有登录会话：从 profiles 表读真实角色；
// - 否则进入：角色取 Cookie demo_role（成员页可切换），默认 owner。
// ============================================================
export interface CurrentUser {
id: string | null;
role: Role;
demo: boolean;
email: string | null;
displayName: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
if (isSupabaseConfigured()) {
try {
const supabase = await createServerSupabase();
const {
data: { user},
} = await supabase.auth.getUser();
if (user) {
const { data: profile} = await supabase
.from("profiles")
.select("role, display_name")
.eq("id", user.id)
.single();
return {
id: user.id,
role: (profile?.role as Role)?? "staff",
demo: false,
email: user.email?? null,
displayName: profile?.display_name?? null,
};
}
} catch {
// 落到演示模式（生产环境在下方被总开关拦住）
}
}
if (!isDemoAllowed()) {
// 指令40-2：生产环境禁用演示——忽略 demo Cookie，按未登录的最低权限用户处理（页面由 middleware 导向登录）
return { id: null, role: "staff", demo: false, email: null, displayName: null };
}
const cookieStore = await cookies();
const demoRole = cookieStore.get("demo_role")?.value;
const role: Role =
demoRole === "partner" || demoRole === "staff"? demoRole: "owner";
return { id: null, role, demo: true, email: null, displayName: "演示用户"};
}

// ============================================================
// 多业务板块授权（指令33）
// - 真实模式：businesses 表 + user_business_access 表（RLS 兜底）；
//   owner 不受限（全部 active 板块），其他角色仅授权行内的板块。
// - 演示模式：授权组合取 Cookie demo_biz（all / aihuishou / none），
//   与演示角色组合切换，可直观演示「只开某一业务」的差异。
// ============================================================
export interface MyBusinesses {
businesses: BusinessDef[];
grantedIds: string[];
}

export async function getMyBusinesses(user: CurrentUser): Promise<MyBusinesses> {
if (!user.demo && isSupabaseConfigured() && user.id) {
try {
const supabase = await createServerSupabase();
const { data: bizRows } = await supabase
.from("businesses")
.select("id, name, status, sort")
.order("sort", { ascending: true});
const businesses: BusinessDef[] =
bizRows && bizRows.length > 0
? (bizRows as Omit<BusinessDef, "en">[]).map((b) => ({
...b,
en: FALLBACK_BUSINESSES.find((f) => f.id === b.id)?.en ?? b.id.toUpperCase(),
}))
: FALLBACK_BUSINESSES;
if (user.role === "owner") {
return {
businesses,
grantedIds: businesses.filter((b) => b.status === "active").map((b) => b.id),
};
}
const { data: accRows } = await supabase
.from("user_business_access")
.select("business_id")
.eq("user_id", user.id);
return { businesses, grantedIds: (accRows ?? []).map((r) => r.business_id as string) };
} catch {
// 落到兜底：owner 给全部 active，其他角色不给（页面会被守卫拦下并提示）
return {
businesses: FALLBACK_BUSINESSES,
grantedIds:
user.role === "owner"
? FALLBACK_BUSINESSES.filter((b) => b.status === "active").map((b) => b.id)
: [],
};
}
}
// 演示模式（仅演示用户可达；真实/匿名用户到此一律无授权，板块不渲染）
if (!user.demo) {
return { businesses: FALLBACK_BUSINESSES, grantedIds: [] };
}
const cookieStore = await cookies();
const demoBiz = cookieStore.get("demo_biz")?.value;
const activeIds = FALLBACK_BUSINESSES.filter((b) => b.status === "active").map((b) => b.id);
const grantedIds =
demoBiz === "none"? []: demoBiz === "aihuishou"? ["aihuishou"]: activeIds;
return { businesses: FALLBACK_BUSINESSES, grantedIds };
}

export function canAccessBusiness(grantedIds: string[], businessId: string) {
return grantedIds.includes(businessId);
}

/** staff 在数据层就拿不到敏感列（真实模式查 v_ops_metrics 视图；兜底模式在此剥离）。 */
function stripSensitive(rows: MetricRow[]): MetricRow[] {
return rows.map((r) => ({
month: r.month,
scope: r.scope,
orders: r.orders,
profit: r.profit,
door_orders: r.door_orders,
avg_profit: r.avg_profit,
}));
}

export async function getMetrics(
scope: Scope,
role: Role
): Promise<{ rows: MetricRow[]; fromDb: boolean}> {
if (isSupabaseConfigured()) {
try {
const supabase = await createServerSupabase();
const table = role === "staff"? "v_ops_metrics": "monthly_metrics";
const { data, error} = await supabase
.from(table)
.select("*")
.eq("scope", scope)
.order("month", { ascending: true});
if (!error && data && data.length > 0) {
return { rows: data as MetricRow[], fromDb: true};
}
} catch {
// 用兜底数据
}
}
const rows = scope === "combined"? FALLBACK_COMBINED: FALLBACK_STORES.filter((r) => r.scope === scope);
return { rows: role === "staff"? stripSensitive(rows): rows, fromDb: false};
}

export async function getAllMembers(): Promise<{
members: Profile[];
accessByUser: Record<string, string[]>;
fromDb: boolean;
}> {
if (isSupabaseConfigured()) {
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("profiles")
.select("id, role, display_name, store_scope")
.order("created_at", { ascending: true});
if (!error && data) {
const accessByUser: Record<string, string[]> = {};
try {
const { data: acc } = await supabase
.from("user_business_access")
.select("user_id, business_id");
for (const row of acc ?? []) {
const uid = row.user_id as string;
(accessByUser[uid] ??= []).push(row.business_id as string);
}
} catch {
// 授权表未迁移时忽略，勾选区按空授权展示
}
return { members: data as Profile[], accessByUser, fromDb: true};
}
} catch {
// 空态
}
}
return { members: [], accessByUser: {}, fromDb: false};
}

export async function getFetchLogs(): Promise<{ logs: FetchLog[]; fromDb: boolean}> {
if (isSupabaseConfigured()) {
try {
const supabase = await createServerSupabase();
const { data, error} = await supabase
.from("fetch_logs")
.select("source, status, message, created_at")
.order("created_at", { ascending: false})
.limit(20);
if (!error && data && data.length > 0) return { logs: data as FetchLog[], fromDb: true};
} catch {
// 兜底
}
}
return { logs: FALLBACK_FETCH_LOGS, fromDb: false};
}

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

function realMode(user: CurrentUser): boolean {
return !user.demo && isSupabaseConfigured() && !!user.id;
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
if (user.demo) return [];
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
if (user.role === "owner") {
const { data } = await supabase
.from("salary_rules")
.select("updated_at")
.order("updated_at", { ascending: false})
.limit(1);
salaryRules = (data?.[0]?.updated_at as string) ?? null;
}
if (user.role !== "staff") {
const { data } = await supabase
.from("store_costs")
.select("updated_at")
.order("updated_at", { ascending: false})
.limit(1);
storeCosts = (data?.[0]?.updated_at as string) ?? null;
}
} catch {
// 按暂无录入处理
}
return { salaryRules, storeCosts, demo: false };
}
