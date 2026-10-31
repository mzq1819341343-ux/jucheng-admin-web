/**
 * 失误扣款的纯校验与角色门闩。不访问数据库。
 * 合计只来自 salary_mistake_totals（person_name + sum）。事由行只给 owner 明细接口。
 */
/** 与 salary-realtime 的月份门闩一致：^\d{4}-\d{2}$，不另判日历月。 */
const YEAR_MONTH = /^\d{4}-\d{2}$/;

function isYearMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && YEAR_MONTH.test(value);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * security definer：只返回 person_name 与 sum(amount)。
 * 路由用登录用户 JWT 调用，不 SELECT 明细表。
 */
export const MISTAKE_TOTALS_RPC = "salary_mistake_totals";

/** owner 明细接口才使用。含事由，合伙人 / 店员路由在查询前 403。 */
export const MISTAKE_DETAIL_SELECT =
  "id, month, person_name, reason, amount, note, created_at, updated_at, created_by";

const AMOUNT_TEXT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MAX_AMOUNT = 9_999_999_999.99;
const MAX_PERSON = 200;
const MAX_REASON = 200;
const MAX_NOTE = 500;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * 明细只给 owner。月份不合法 400；未登录 401；partner / staff / 其它角色 403。
 */
export function mistakeDetailsDecision(input: {
  month: string | null;
  authenticated: boolean;
  role: string | null;
}): 400 | 401 | 403 | 200 {
  if (!isYearMonth(input.month)) return 400;
  if (!input.authenticated) return 401;
  if (input.role === "owner") return 200;
  return 403;
}

/** 写入只给 owner。未登录 401；其它角色 403。 */
export function mistakeWriteDecision(input: {
  authenticated: boolean;
  role: string | null;
}): 401 | 403 | 200 {
  if (!input.authenticated) return 401;
  if (input.role === "owner") return 200;
  return 403;
}

/** 大于 0、最多两位小数、不超过 numeric(12,2)。布尔和空串拒绝。 */
export function parseMistakeAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) return null;
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 1e-6) return null;
    if (cents <= 0) return null;
    return cents / 100;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!AMOUNT_TEXT.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

export function amountToDb(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export interface MistakeTotalRow {
  person_name: string;
  mistake_total: number;
}

/**
 * 只接受合计行：person_name + mistake_total。
 * 多出来的列（reason / note / amount / id）整份作废，不能把事由行剥掉再当合计。
 */
export function parseMistakeTotalRows(data: unknown): MistakeTotalRow[] | null {
  if (!Array.isArray(data)) return null;
  const centsByName = new Map<string, number>();
  for (const row of data) {
    if (!row || typeof row !== "object") return null;
    const rec = row as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key !== "person_name" && key !== "mistake_total") return null;
    }
    if (!Object.prototype.hasOwnProperty.call(rec, "mistake_total")) return null;
    if (typeof rec.person_name !== "string" || rec.person_name === "") return null;
    const amount = parseStoredMoney(rec.mistake_total);
    if (amount === null) return null;
    const cents = Math.round(amount * 100);
    centsByName.set(rec.person_name, (centsByName.get(rec.person_name) ?? 0) + cents);
  }
  return [...centsByName.entries()].map(([person_name, cents]) => ({
    person_name,
    mistake_total: cents / 100,
  }));
}

function parseStoredMoney(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function parseOptionalPersonName(
  value: string | null
): { ok: true; personName: string | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, personName: null };
  const personName = value.trim();
  if (personName === "" || personName.length > MAX_PERSON) {
    return { ok: false, error: "person_name is invalid" };
  }
  return { ok: true, personName };
}

export interface MistakeCreateInput {
  month: string;
  person_name: string;
  reason: string;
  amount: number;
  note: string | null;
}

export function parseMistakeCreateBody(
  body: unknown
): { ok: true; value: MistakeCreateInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid body" };
  }
  const rec = body as Record<string, unknown>;
  const month = typeof rec.month === "string" ? rec.month : null;
  if (!isYearMonth(month)) {
    return { ok: false, error: "month must match YYYY-MM" };
  }
  if (typeof rec.person_name !== "string") {
    return { ok: false, error: "person_name is required" };
  }
  const personName = rec.person_name.trim();
  if (personName === "" || personName.length > MAX_PERSON) {
    return { ok: false, error: "person_name is required" };
  }
  if (typeof rec.reason !== "string") {
    return { ok: false, error: "reason is required" };
  }
  const reason = rec.reason.trim();
  if (reason === "" || reason.length > MAX_REASON) {
    return { ok: false, error: "reason is required" };
  }
  const amount = parseMistakeAmount(rec.amount);
  if (amount === null) {
    return { ok: false, error: "amount must be greater than 0" };
  }
  const note = parseNote(rec.note, true);
  if (!note.ok) return note;
  return {
    ok: true,
    value: {
      month,
      person_name: personName,
      reason,
      amount,
      note: note.value,
    },
  };
}

export interface MistakePatchInput {
  reason?: string;
  amount?: number;
  note?: string | null;
}

export function parseMistakePatchBody(
  body: unknown
): { ok: true; value: MistakePatchInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid body" };
  }
  const rec = body as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 0) return { ok: false, error: "nothing to update" };
  for (const key of keys) {
    if (key === "month" || key === "person_name") {
      return { ok: false, error: "month and person_name cannot be changed" };
    }
    if (key !== "reason" && key !== "amount" && key !== "note") {
      return { ok: false, error: "only reason, amount, and note can be changed" };
    }
  }
  const patch: MistakePatchInput = {};
  if ("reason" in rec) {
    if (typeof rec.reason !== "string") return { ok: false, error: "reason is required" };
    const reason = rec.reason.trim();
    if (reason === "" || reason.length > MAX_REASON) {
      return { ok: false, error: "reason is required" };
    }
    patch.reason = reason;
  }
  if ("amount" in rec) {
    const amount = parseMistakeAmount(rec.amount);
    if (amount === null) return { ok: false, error: "amount must be greater than 0" };
    patch.amount = amount;
  }
  if ("note" in rec) {
    const note = parseNote(rec.note, false);
    if (!note.ok) return note;
    patch.note = note.value;
  }
  return { ok: true, value: patch };
}

function parseNote(
  value: unknown,
  optional: boolean
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined && optional) return { ok: true, value: null };
  if (value === undefined) return { ok: false, error: "note is invalid" };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "note is invalid" };
  const note = value.trim();
  if (note.length > MAX_NOTE) return { ok: false, error: "note is too long" };
  return { ok: true, value: note === "" ? null : note };
}

export interface MistakeLineInput {
  id: string | null;
  reason: string;
  amount: string;
  note: string;
}

export interface MistakeLineDraft {
  id: string | null;
  reason: string;
  amount: number;
  note: string | null;
}

/** 完全空白的行忽略。有内容的行必须有事由且金额 > 0。全部空白则合计为 0。 */
export function validateMistakeLines(
  lines: readonly MistakeLineInput[]
): { ok: true; lines: MistakeLineDraft[] } | { ok: false; error: string } {
  const kept: MistakeLineDraft[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const reason = line.reason.trim();
    const amountText = line.amount.trim();
    const noteText = line.note.trim();
    if (reason === "" && amountText === "" && noteText === "") continue;
    if (reason === "" || reason.length > MAX_REASON) {
      return { ok: false, error: "事由不能为空" };
    }
    const amount = parseMistakeAmount(amountText);
    if (amount === null) {
      return { ok: false, error: "金额须大于 0，最多两位小数" };
    }
    if (noteText.length > MAX_NOTE) return { ok: false, error: "备注过长" };
    if (line.id !== null) {
      if (!isUuid(line.id) || seen.has(line.id)) {
        return { ok: false, error: "明细行无效" };
      }
      seen.add(line.id);
    }
    kept.push({
      id: line.id,
      reason,
      amount,
      note: noteText === "" ? null : noteText,
    });
  }
  return { ok: true, lines: kept };
}

/** 编辑时的实时合计：还没填完的金额不计入，空行按 0。 */
export function sumMistakeLineAmounts(lines: readonly { amount: string }[]): number {
  let cents = 0;
  for (const line of lines) {
    const amount = parseMistakeAmount(line.amount);
    if (amount === null) continue;
    cents += Math.round(amount * 100);
  }
  return cents / 100;
}

export interface SalaryMistakeDetail {
  id: string;
  month: string;
  person_name: string;
  reason: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function toMistakeRow(row: unknown): SalaryMistakeDetail | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (typeof rec.id !== "string" || !isUuid(rec.id)) return null;
  if (!isYearMonth(typeof rec.month === "string" ? rec.month : null)) return null;
  if (typeof rec.person_name !== "string" || rec.person_name === "") return null;
  if (typeof rec.reason !== "string" || rec.reason.trim() === "") return null;
  const amount = parseMistakeAmount(rec.amount);
  if (amount === null) return null;
  if (typeof rec.created_at !== "string" || typeof rec.updated_at !== "string") return null;
  if (rec.note !== null && typeof rec.note !== "string") return null;
  if (rec.created_by !== null && typeof rec.created_by !== "string") return null;
  return {
    id: rec.id,
    month: rec.month as string,
    person_name: rec.person_name,
    reason: rec.reason,
    amount,
    note: typeof rec.note === "string" && rec.note.trim() !== "" ? rec.note : null,
    created_at: rec.created_at,
    updated_at: rec.updated_at,
    created_by: typeof rec.created_by === "string" ? rec.created_by : null,
  };
}
