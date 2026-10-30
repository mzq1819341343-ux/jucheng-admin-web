/**
 * 实时工资草案的纯映射（GET /api/salary/realtime）。
 * 不访问数据库：路由用登录会话的 Supabase 客户端查 salary_realtime_draft，
 * 再把行交给这里。店员不会走到映射（路由先 403，不拿空列表冒充）。
 */

export const YEAR_MONTH = /^\d{4}-\d{2}$/;

export function isYearMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && YEAR_MONTH.test(value);
}

/** 缺省月份：上海时区的当月，与浏览器本地时区无关。 */
export function shanghaiYearMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/** 给页面展示的上海时间。解析失败时原样返回。 */
export function formatShanghaiDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}-${pick("month")}-${pick("day")} ${hour}:${pick("minute")}`;
}

/**
 * 状态码顺序：月份不合法 400；未登录 401；非 owner/partner（含 staff）403；否则 200。
 * role 尚未查到时不要调用——null 会落成 403。
 */
export function realtimeReadDecision(input: {
  month: string | null;
  authenticated: boolean;
  role: string | null;
}): 400 | 401 | 403 | 200 {
  if (!isYearMonth(input.month)) return 400;
  if (!input.authenticated) return 401;
  if (input.role === "owner" || input.role === "partner") return 200;
  return 403;
}

export interface RealtimeSalaryPerson {
  person_key: string;
  display_name: string;
  user_id: string | null;
  base: number;
  door: number;
  online: number;
  store: number;
  accessories: number;
  gross: number;
  deduction: number | null;
  net: number | null;
}

export interface RealtimeSalaryTotals {
  base: number;
  door: number;
  online: number;
  store: number;
  accessories: number;
  gross: number;
  deduction: number | null;
  net: number | null;
}

export interface RealtimeSalaryResponse {
  month: string;
  as_of: string | null;
  caliber: string | null;
  people: RealtimeSalaryPerson[];
  totals: RealtimeSalaryTotals;
}

export interface SalaryRealtimeDraftRow {
  person_name: string;
  user_id?: string | null;
  as_of?: string | null;
  base_amount?: unknown;
  door_amount?: unknown;
  online_amount?: unknown;
  store_amount?: unknown;
  accessories_amount?: unknown;
  gross_amount?: unknown;
  deduction_amount?: unknown;
  net_amount?: unknown;
  caliber?: unknown;
}

function moneyNumber(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function moneyOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function sumMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0);
  return cents / 100;
}

function sumNullableMoney(values: Array<number | null>): number | null {
  if (values.every((value) => value === null)) return null;
  return sumMoney(values.map((value) => value ?? 0));
}

function timeMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const EMPTY_TOTALS: RealtimeSalaryTotals = {
  base: 0,
  door: 0,
  online: 0,
  store: 0,
  accessories: 0,
  gross: 0,
  deduction: null,
  net: null,
};

export function buildRealtimeSalary(
  month: string,
  rows: readonly SalaryRealtimeDraftRow[]
): RealtimeSalaryResponse {
  const people: RealtimeSalaryPerson[] = [];
  let bestMs = Number.NEGATIVE_INFINITY;
  let bestName = "";
  let asOf: string | null = null;
  let caliber: string | null = null;

  for (const row of rows) {
    if (typeof row.person_name !== "string" || row.person_name === "") continue;
    const person: RealtimeSalaryPerson = {
      person_key: row.person_name,
      display_name: row.person_name,
      user_id: typeof row.user_id === "string" && row.user_id !== "" ? row.user_id : null,
      base: moneyNumber(row.base_amount),
      door: moneyNumber(row.door_amount),
      online: moneyNumber(row.online_amount),
      store: moneyNumber(row.store_amount),
      accessories: moneyNumber(row.accessories_amount),
      gross: moneyNumber(row.gross_amount),
      deduction: moneyOrNull(row.deduction_amount),
      net: moneyOrNull(row.net_amount),
    };
    people.push(person);

    const ms = timeMs(row.as_of);
    if (ms === null) continue;
    const newer = ms > bestMs;
    const tie = ms === bestMs && (bestName === "" || row.person_name < bestName);
    if (newer || tie) {
      bestMs = ms;
      bestName = row.person_name;
      asOf = row.as_of ?? null;
      caliber = typeof row.caliber === "string" ? row.caliber : null;
    }
  }

  people.sort((a, b) => (a.person_key < b.person_key ? -1 : a.person_key > b.person_key ? 1 : 0));

  if (people.length === 0) {
    return { month, as_of: null, caliber: null, people: [], totals: { ...EMPTY_TOTALS } };
  }

  return {
    month,
    as_of: asOf,
    caliber,
    people,
    totals: {
      base: sumMoney(people.map((p) => p.base)),
      door: sumMoney(people.map((p) => p.door)),
      online: sumMoney(people.map((p) => p.online)),
      store: sumMoney(people.map((p) => p.store)),
      accessories: sumMoney(people.map((p) => p.accessories)),
      gross: sumMoney(people.map((p) => p.gross)),
      deduction: sumNullableMoney(people.map((p) => p.deduction)),
      net: sumNullableMoney(people.map((p) => p.net)),
    },
  };
}

/** 人和合计都是 0 / 空时不展示配件列。 */
export function showAccessoriesColumn(body: RealtimeSalaryResponse): boolean {
  if (body.totals.accessories !== 0) return true;
  return body.people.some((person) => person.accessories !== 0);
}
