/**
 * 人 × 店 × 月销售目标。列与 ops migration_018 对齐：
 * month + store_id → stores + employee_id → employees
 * + recycle_target + accessories_sales_target（销售额，不是提成）。
 * UNIQUE(month, store_id, employee_id)。
 *
 * 表还没建好时调用方必须提示失败，不能在浏览器里留一份假目标。
 * 达成率只加总「在职」人员的 recycle_target。没有日曲线、不读落盘 CSV。
 */

export const MONTHLY_SALES_TARGETS_TABLE = "monthly_sales_targets";

export const TARGET_TABLE_MISSING_MESSAGE =
  "月度销售目标表尚未建好，这次没有写入，也没有留在本地。请先在运维侧应用 migration_018。";

export const TARGET_OFFLINE_MESSAGE = "未连接数据库，目标没有写入，也不会留在本机。";

export const TARGET_SAVED_MESSAGE = "目标已写入";

export const TARGET_TABLE_MISSING_READ =
  "月度销售目标表尚未建好，达成率按「未设定」显示，没有用本地数字代替。";

export const TARGET_READ_UNAVAILABLE =
  "人店月目标暂时读不到，达成率按「未设定」显示，没有用估算数字。";

const MONTH_RE = /^\d{4}-\d{2}$/;
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const AMOUNT_MAX = 9_999_999_999.99;

export interface StoreOption {
  id: string;
  name: string;
}

export interface MonthlySalesTarget {
  id: string;
  month: string;
  store_id: string;
  employee_id: string;
  recycle_target: number;
  accessories_sales_target: number;
}

export interface MonthlySalesTargetWrite {
  month: string;
  store_id: string;
  employee_id: string;
  recycle_target: number;
  accessories_sales_target: number;
}

export type MonthlySalesTargetRead =
  | { ok: true; rows: MonthlySalesTarget[] }
  | { ok: false; reason: "missing_table" | "unavailable" };

export interface RecycleAchievement {
  /** 当前角色读不到测算名单时，不能按「在职」过滤，达成率不做。 */
  rosterKnown: boolean;
  /** null：范围内没有在职人员的回收目标。 */
  target: number | null;
  actual: number | null;
  /** null：没目标、没实际，或目标为 0（不能除）。 */
  rate: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseTargetAmount(
  raw: string,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim();
  if (text === "") return { ok: false, error: `请填写${label}` };
  if (!AMOUNT_RE.test(text)) return { ok: false, error: `${label}需为不小于 0 的金额，最多两位小数` };
  const value = Number(text);
  if (!Number.isFinite(value) || value > AMOUNT_MAX) return { ok: false, error: `${label}超出可保存范围` };
  return { ok: true, value: roundMoney(value) };
}

function asMoney(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > AMOUNT_MAX) return null;
  return roundMoney(n);
}

export function coerceStoreOption(value: unknown): StoreOption | null {
  const row = asRecord(value);
  if (!row) return null;
  if (typeof row.id !== "string" || row.id.trim() === "") return null;
  if (typeof row.name !== "string" || row.name.trim() === "") return null;
  return { id: row.id.trim(), name: row.name.trim() };
}

export function coerceMonthlySalesTarget(value: unknown): MonthlySalesTarget | null {
  const row = asRecord(value);
  if (!row) return null;
  if (typeof row.month !== "string" || !MONTH_RE.test(row.month)) return null;
  if (typeof row.store_id !== "string" || row.store_id === "") return null;
  if (typeof row.employee_id !== "string" || row.employee_id === "") return null;
  const recycle = asMoney(row.recycle_target);
  const accessories = asMoney(row.accessories_sales_target);
  if (recycle === null || accessories === null) return null;
  const id = typeof row.id === "string" && row.id !== "" ? row.id : `${row.month}:${row.store_id}:${row.employee_id}`;
  return {
    id,
    month: row.month,
    store_id: row.store_id,
    employee_id: row.employee_id,
    recycle_target: recycle,
    accessories_sales_target: accessories,
  };
}

export function parseMonthlySalesTargetWrite(input: {
  month: string;
  store_id: string;
  employee_id: string;
  recycle_target: string;
  accessories_sales_target: string;
}): { ok: true; value: MonthlySalesTargetWrite } | { ok: false; error: string } {
  if (!MONTH_RE.test(input.month)) return { ok: false, error: "请选择月份" };
  if (input.store_id.trim() === "") return { ok: false, error: "请选择门店" };
  if (input.employee_id.trim() === "") return { ok: false, error: "请选择员工" };
  const recycle = parseTargetAmount(input.recycle_target, "回收目标");
  if (!recycle.ok) return recycle;
  const accessories = parseTargetAmount(input.accessories_sales_target, "配件销售目标");
  if (!accessories.ok) return accessories;
  return {
    ok: true,
    value: {
      month: input.month,
      store_id: input.store_id,
      employee_id: input.employee_id,
      recycle_target: recycle.value,
      accessories_sales_target: accessories.value,
    },
  };
}

/** PostgREST / Postgres：表还没进 schema cache，或关系不存在。 */
export function isMissingMonthlySalesTargetsError(error: unknown): boolean {
  const row = asRecord(error);
  const code = row && typeof row.code === "string" ? row.code : "";
  const message = row && typeof row.message === "string" ? row.message : "";
  if (code === "42P01" || code === "PGRST205") return true;
  const text = `${code} ${message}`.toLowerCase();
  if (!text.includes("monthly_sales_targets") && !text.includes("schema cache")) return false;
  return /does not exist|schema cache|could not find|not find the table|undefined table|relation/.test(text);
}

/**
 * 店目标 = 同店在职人员 recycle_target 合计。
 * storeId 为空表示全部门店。离职、别的月份、别的店不计入。
 * 没有任何在职目标行时 target 为 null（页面显示「未设定」）。
 */
export function recycleAchievement(input: {
  targets: MonthlySalesTarget[];
  employees: { id: string; employment_status: string }[];
  month: string;
  storeId: string | null;
  actual: number | null;
  rosterKnown: boolean;
}): RecycleAchievement {
  const actual = typeof input.actual === "number" && Number.isFinite(input.actual) ? input.actual : null;
  if (!input.rosterKnown) {
    const inScope = input.targets.some(
      (row) => row.month === input.month && (input.storeId === null || row.store_id === input.storeId),
    );
    // 一条目标都没有时，不需要在职名单也能确定「未设定」。
    // 有目标行但看不了在离职，不能把离职人员加进达成率。
    if (!inScope) return { rosterKnown: true, target: null, actual, rate: null };
    return { rosterKnown: false, target: null, actual, rate: null };
  }
  const active = new Set(
    input.employees.filter((row) => row.employment_status === "在职").map((row) => row.id),
  );
  const matched = input.targets.filter(
    (row) =>
      row.month === input.month &&
      (input.storeId === null || row.store_id === input.storeId) &&
      active.has(row.employee_id),
  );
  if (matched.length === 0) {
    return { rosterKnown: true, target: null, actual, rate: null };
  }
  const target = roundMoney(matched.reduce((sum, row) => sum + row.recycle_target, 0));
  if (actual === null || target === 0) {
    return { rosterKnown: true, target, actual, rate: null };
  }
  return { rosterKnown: true, target, actual, rate: (actual / target) * 100 };
}
