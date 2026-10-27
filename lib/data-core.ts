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
// 指令40-2：生产环境禁用演示——忽略 demo Cookie，按未登录的最低权限用户处理（页面由 proxy 导向登录）
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

// ============================================================
// 成员待邀请名单（指令59 A6 / migration_008）：仅老板读写（RLS 同步
// 只有 owner 策略）。演示模式用虚构兜底意向；真实模式表未建
// （migration_008 未执行）时 tableReady=false，页面优雅降级提示。
// ============================================================
import { type MemberInvite } from "./invites";
export type { MemberInvite };

export const FALLBACK_MEMBER_INVITES: MemberInvite[] = [
  {
    id: "demo-invite-registered",
    email: "staff-demo@example.com",
    intended_role: "partner",
    intended_businesses: ["aihuishou"],
    note: "演示意向：对方已注册（显示名即邮箱），可一键对齐",
    status: "pending",
    created_by: null,
    created_at: "2026-10-27T09:00:00+08:00",
    aligned_at: null,
    aligned_user_id: null,
  },
  {
    id: "demo-invite-unregistered",
    email: "partner-demo@example.com",
    intended_role: "partner",
    intended_businesses: ["aihuishou"],
    note: "演示意向：对方尚未注册，先去控制台发邀请",
    status: "pending",
    created_by: null,
    created_at: "2026-10-27T09:05:00+08:00",
    aligned_at: null,
    aligned_user_id: null,
  },
  {
    id: "demo-invite-aligned",
    email: "aligned-demo@example.com",
    intended_role: "staff",
    intended_businesses: [],
    note: "演示意向：已对齐示例",
    status: "aligned",
    created_by: null,
    created_at: "2026-10-26T18:00:00+08:00",
    aligned_at: "2026-10-26T18:30:00+08:00",
    aligned_user_id: "demo-staff",
  },
];

export async function getMemberInvites(
  user: CurrentUser
): Promise<{ invites: MemberInvite[]; tableReady: boolean }> {
  if (user.role !== "owner") return { invites: [], tableReady: true };
  if (user.demo) return { invites: FALLBACK_MEMBER_INVITES, tableReady: true };
  if (!realMode(user)) return { invites: [], tableReady: true };
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("member_invites")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) return { invites: data as MemberInvite[], tableReady: true };
  } catch {
    // 表未建时落到降级提示
  }
  return { invites: [], tableReady: false };
}

export async function getFetchLogs(): Promise<{ logs: FetchLog[]; fromDb: boolean}> {if (isSupabaseConfigured()) {
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

/**
 * 数据刷新标记（指令53 C2）：只读 fetch_logs，不写任何假时间。
 * - 最近成功抓取 = 最新一条 status='success' 的 created_at；
 * - 待登录 = 最新一条日志就是 need_user_login（抓数管道会话失效时写入）；
 * - 真实模式下库里无记录（fromDb=false 且非演示）→ hasLogs=false，
 *   页面显示「暂无抓取记录（管道已备未启用）」。
 */
export interface FetchRefreshMarker {
lastSuccessAt: string | null;
needLogin: boolean;
hasLogs: boolean;
}

export async function getFetchRefreshMarker(user?: CurrentUser): Promise<FetchRefreshMarker> {
const { logs, fromDb } = await getFetchLogs();
if (!fromDb && !(user?.demo)) {
  return { lastSuccessAt: null, needLogin: false, hasLogs: false };
}
const success = logs.find((l) => l.status === "success");
return {
  lastSuccessAt: success ? String(success.created_at).replace("T", " ").slice(0, 16) : null,
  needLogin: logs[0]?.status === "need_user_login",
  hasLogs: logs.length > 0,
};
}

/** 真实模式判定：已登录真实账号且 Supabase 已配置（非演示）。 */
export function realMode(user: CurrentUser): boolean {
return !user.demo && isSupabaseConfigured() && !!user.id;
}

