/**
 * 实时工资草案的纯映射（GET /api/salary/realtime）。
 * 不访问数据库：路由用登录会话查 salary_realtime_draft，再用服务端聚合后的
 * 失误合计交给这里。店员不会走到映射（路由先 403，不拿空列表冒充）。
 * 失误合计不回写 draft 的 deduction_amount / net_amount。
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
  /**
   * 手填补贴。migration_016 的 subsidy_amount 还没进响应时省略；
   * 列落地后缺省为 0。页面只在字段存在时展示。
   */
  subsidy?: number;
  /** 手填奖金。与 subsidy 同时出现或同时省略。 */
  bonus?: number;
  gross: number;
  deduction: number | null;
  net: number | null;
  /** 当月失误扣款合计。没有明细时为 0。 */
  mistake_total: number;
  /** 应发 − 失误合计。没有草案行时按应发 0，结果可以为负。 */
  after_deduction: number;
  /** 该人是否来自 salary_realtime_draft。只有失误、没有草案行时为 false。 */
  in_draft: boolean;
}

export interface RealtimeSalaryTotals {
  base: number;
  door: number;
  online: number;
  store: number;
  accessories: number;
  /** 手填补贴合计。列未进响应时省略。 */
  subsidy?: number;
  /** 手填奖金合计。与 subsidy 同时出现或同时省略。 */
  bonus?: number;
  gross: number;
  deduction: number | null;
  net: number | null;
  mistake_total: number;
  after_deduction: number;
}

/** 路由聚合后的按人失误合计。这里只收合计，不收事由。 */
export interface MistakeTotalInput {
  person_name: string;
  mistake_total: number;
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
  subsidy_amount?: unknown;
  bonus_amount?: unknown;
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

/**
 * 应发 = 底薪 + 上门 + 线上 + 门店 + 配件 + 补贴 + 奖金。
 * 只在补贴/奖金列已进入响应时使用；列未落地时仍展示草案里的 gross_amount。
 * 页面只渲染这里算出的 gross，不再加一次。
 */
export function payableGross(parts: {
  base: number;
  door: number;
  online: number;
  store: number;
  accessories: number;
  subsidy: number;
  bonus: number;
}): number {
  return sumMoney([
    parts.base,
    parts.door,
    parts.online,
    parts.store,
    parts.accessories,
    parts.subsidy,
    parts.bonus,
  ]);
}

export function payableGrossFromDraft(
  row: SalaryRealtimeDraftRow,
  subsidy: number,
  bonus: number
): number {
  return payableGross({
    base: moneyNumber(row.base_amount),
    door: moneyNumber(row.door_amount),
    online: moneyNumber(row.online_amount),
    store: moneyNumber(row.store_amount),
    accessories: moneyNumber(row.accessories_amount),
    subsidy,
    bonus,
  });
}

const HAND_AMOUNT_TEXT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MAX_HAND_AMOUNT = 9_999_999_999.99;
const MAX_PERSON_NAME = 200;

/** 补贴 / 奖金：允许 0，最多两位小数。负数、空串、布尔拒绝。 */
export function parseHandFillAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > MAX_HAND_AMOUNT) return null;
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 1e-6) return null;
    return cents / 100;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!HAND_AMOUNT_TEXT.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > MAX_HAND_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

export function moneyToDb(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export interface HandFillPatch {
  month: string;
  person_name: string;
  subsidy: number;
  bonus: number;
}

/**
 * 老板手填只接受 month、person_name、subsidy_amount、bonus_amount。
 * 带上 gross 或其它金额列则整份拒绝，避免页面另写一套应发。
 */
export function parseHandFillPatchBody(
  body: unknown
): { ok: true; value: HandFillPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid body" };
  }
  const rec = body as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (
      key !== "month" &&
      key !== "person_name" &&
      key !== "subsidy_amount" &&
      key !== "bonus_amount"
    ) {
      return { ok: false, error: "only subsidy_amount and bonus_amount can be changed" };
    }
  }
  const month = typeof rec.month === "string" ? rec.month : null;
  if (!isYearMonth(month)) return { ok: false, error: "month must match YYYY-MM" };
  if (typeof rec.person_name !== "string") {
    return { ok: false, error: "person_name is required" };
  }
  const personName = rec.person_name.trim();
  if (personName === "" || personName.length > MAX_PERSON_NAME) {
    return { ok: false, error: "person_name is required" };
  }
  if (!Object.prototype.hasOwnProperty.call(rec, "subsidy_amount")) {
    return { ok: false, error: "subsidy_amount and bonus_amount are required" };
  }
  if (!Object.prototype.hasOwnProperty.call(rec, "bonus_amount")) {
    return { ok: false, error: "subsidy_amount and bonus_amount are required" };
  }
  const subsidy = parseHandFillAmount(rec.subsidy_amount);
  if (subsidy === null) return { ok: false, error: "subsidy_amount must be zero or greater" };
  const bonus = parseHandFillAmount(rec.bonus_amount);
  if (bonus === null) return { ok: false, error: "bonus_amount must be zero or greater" };
  return {
    ok: true,
    value: { month, person_name: personName, subsidy, bonus },
  };
}

/** 手填写入只给 owner。未登录 401；合伙人 / 店员 / 其它角色 403。 */
export function handFillWriteDecision(input: {
  authenticated: boolean;
  role: string | null;
}): 401 | 403 | 200 {
  if (!input.authenticated) return 401;
  if (input.role === "owner") return 200;
  return 403;
}

/**
 * PostgREST / Postgres 表示 subsidy_amount 或 bonus_amount 还不存在。
 * 其它查询错误不能当成「列还没落地」，否则会把权限或网络问题吞掉。
 */
export function isMissingHandFillColumn(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = error.message ?? "";
  if (!message.includes("subsidy_amount") && !message.includes("bonus_amount")) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

/** 响应里两列都是数字时，页面才展示补贴 / 奖金。 */
export function handFillShown(body: {
  totals: { subsidy?: number; bonus?: number };
}): boolean {
  return typeof body.totals.subsidy === "number" && typeof body.totals.bonus === "number";
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
  mistake_total: 0,
  after_deduction: 0,
};

function toCents(value: number): number {
  return Math.round(value * 100);
}

/** 应发 − 失误合计，按分计算，避免二进制小数漂移。 */
export function afterDeductionAmount(gross: number, mistakeTotal: number): number {
  return (toCents(gross) - toCents(mistakeTotal)) / 100;
}

/**
 * 页面上的扣后实发。接口有 after_deduction 时用接口值；
 * 没有该字段时用应发 − 失误合计本地算。
 */
export function shownAfterDeduction(person: {
  gross: number;
  mistake_total?: number;
  after_deduction?: number;
}): number {
  if (typeof person.after_deduction === "number" && Number.isFinite(person.after_deduction)) {
    return person.after_deduction;
  }
  const mistake =
    typeof person.mistake_total === "number" && Number.isFinite(person.mistake_total)
      ? person.mistake_total
      : 0;
  return afterDeductionAmount(person.gross, mistake);
}

function mergeMistakeCents(rows: readonly MistakeTotalInput[]): Map<string, number> {
  const centsByName = new Map<string, number>();
  for (const row of rows) {
    if (typeof row.person_name !== "string" || row.person_name === "") continue;
    const cents = toCents(moneyNumber(row.mistake_total));
    centsByName.set(row.person_name, (centsByName.get(row.person_name) ?? 0) + cents);
  }
  return centsByName;
}

export function buildRealtimeSalary(
  month: string,
  rows: readonly SalaryRealtimeDraftRow[],
  mistakeTotals: readonly MistakeTotalInput[] = [],
  options?: { handFill?: boolean }
): RealtimeSalaryResponse {
  const handFill = options?.handFill === true;
  const mistakeCents = mergeMistakeCents(mistakeTotals);
  const people: RealtimeSalaryPerson[] = [];
  const seen = new Set<string>();
  let bestMs = Number.NEGATIVE_INFINITY;
  let bestName = "";
  let asOf: string | null = null;
  let caliber: string | null = null;

  for (const row of rows) {
    if (typeof row.person_name !== "string" || row.person_name === "") continue;
    const subsidy = moneyNumber(row.subsidy_amount);
    const bonus = moneyNumber(row.bonus_amount);
    const gross = handFill
      ? payableGrossFromDraft(row, subsidy, bonus)
      : moneyNumber(row.gross_amount);
    const mistake = mistakeCents.get(row.person_name) ?? 0;
    const person: RealtimeSalaryPerson = {
      person_key: row.person_name,
      display_name: row.person_name,
      user_id: typeof row.user_id === "string" && row.user_id !== "" ? row.user_id : null,
      base: moneyNumber(row.base_amount),
      door: moneyNumber(row.door_amount),
      online: moneyNumber(row.online_amount),
      store: moneyNumber(row.store_amount),
      accessories: moneyNumber(row.accessories_amount),
      gross,
      deduction: moneyOrNull(row.deduction_amount),
      net: moneyOrNull(row.net_amount),
      mistake_total: mistake / 100,
      after_deduction: (toCents(gross) - mistake) / 100,
      in_draft: true,
    };
    if (handFill) {
      person.subsidy = subsidy;
      person.bonus = bonus;
    }
    people.push(person);
    seen.add(row.person_name);

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

  for (const [personName, cents] of mistakeCents) {
    if (seen.has(personName) || cents === 0) continue;
    people.push({
      person_key: personName,
      display_name: personName,
      user_id: null,
      base: 0,
      door: 0,
      online: 0,
      store: 0,
      accessories: 0,
      gross: 0,
      deduction: null,
      net: null,
      mistake_total: cents / 100,
      after_deduction: -cents / 100,
      in_draft: false,
      ...(handFill ? { subsidy: 0, bonus: 0 } : {}),
    });
  }

  people.sort((a, b) => (a.person_key < b.person_key ? -1 : a.person_key > b.person_key ? 1 : 0));

  const totals: RealtimeSalaryTotals = {
    base: sumMoney(people.map((p) => p.base)),
    door: sumMoney(people.map((p) => p.door)),
    online: sumMoney(people.map((p) => p.online)),
    store: sumMoney(people.map((p) => p.store)),
    accessories: sumMoney(people.map((p) => p.accessories)),
    gross: sumMoney(people.map((p) => p.gross)),
    deduction: sumNullableMoney(people.map((p) => p.deduction)),
    net: sumNullableMoney(people.map((p) => p.net)),
    mistake_total: sumMoney(people.map((p) => p.mistake_total)),
    after_deduction: sumMoney(people.map((p) => p.after_deduction)),
  };
  if (handFill) {
    totals.subsidy = sumMoney(people.map((p) => p.subsidy ?? 0));
    totals.bonus = sumMoney(people.map((p) => p.bonus ?? 0));
  }

  if (people.length === 0) {
    return {
      month,
      as_of: null,
      caliber: null,
      people: [],
      totals: handFill ? { ...EMPTY_TOTALS, subsidy: 0, bonus: 0 } : { ...EMPTY_TOTALS },
    };
  }

  return {
    month,
    as_of: asOf,
    caliber,
    people,
    totals,
  };
}

/** 人和合计都是 0 / 空时不展示配件列。 */
export function showAccessoriesColumn(body: RealtimeSalaryResponse): boolean {
  if (body.totals.accessories !== 0) return true;
  return body.people.some((person) => person.accessories !== 0);
}
