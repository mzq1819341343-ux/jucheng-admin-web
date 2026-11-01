/**
 * 当月 salary_realtime_draft 的占位与底薪同步。
 * 纯函数：不读 process.env 里的密钥，不发网络请求。
 * 服务端 Route 注入 PostgREST；浏览器只根据保存结果选择 ensure / sync。
 *
 * 闸只认 ALLOW_EMPLOYEE_DRAFT_WRITE。ALLOW_APPLY_REALTIME_DRAFT 不放行。
 * 2026-10 与早于生效月一律拒绝。上门底薪跟表，不改成 0。
 */

export const EMPLOYEE_DRAFT_GATE = "ALLOW_EMPLOYEE_DRAFT_WRITE";
export const OCTOBER_NO_SEED = "2026-10";
export const EFFECTIVE_FROM = "2026-10";
export const SOURCE_PLACEHOLDER = "employee_placeholder";
export const CALIBER_BASE = "employee_placeholder|pending_payroll|base_follows_table";
export const DRAFT_TABLE = "salary_realtime_draft";
export const HARD_EXCLUDED = ["吕文飞", "杨燕辉"] as const;
export const PATCH_KEYS = ["base_amount", "gross_amount", "net_amount", "as_of", "updated_at"] as const;
export const FORBIDDEN_PATCH_KEYS = [
  "subsidy_amount",
  "bonus_amount",
  "door_amount",
  "online_amount",
  "store_amount",
  "accessories_amount",
  "deduction_amount",
  "source",
  "caliber",
  "month",
  "person_name",
  "user_id",
  "id",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const MONEY_RE = /^-?\d+(\.\d+)?$/;

export class DraftWriteRejected extends Error {
  readonly code: 1 | 2 | 3 | 4;
  constructor(message: string, code: 1 | 2 | 3 | 4) {
    super(message);
    this.name = "DraftWriteRejected";
    this.code = code;
  }
}

export class DraftGateClosed extends Error {
  readonly wrote = false;
  constructor() {
    super("未开闸");
    this.name = "DraftGateClosed";
  }
}

export function employeeDraftGateOpen(env: Record<string, string | undefined>): boolean {
  const value = env[EMPLOYEE_DRAFT_GATE];
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function employeeDraftAuthDecision(input: {
  authenticated: boolean;
  role: string | null;
}): 401 | 403 | 200 {
  if (!input.authenticated) return 401;
  if (input.role === "owner") return 200;
  return 403;
}

/** 缺省月份：上海时区的当月。与 salary-realtime.shanghaiYearMonth 同一算法。 */
export function shanghaiYearMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/** 上海墙钟，秒精度，固定 +08:00。与 ops as_of 同一形状。 */
export function shanghaiStamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}:${pick("second")}+08:00`;
}

export function moneyCents(value: unknown): number {
  if (typeof value === "boolean" || value == null) {
    throw new DraftWriteRejected("base_salary 不是合法金额", 1);
  }
  const text = String(value).trim().replace(/,/g, "");
  if (!MONEY_RE.test(text)) throw new DraftWriteRejected("base_salary 不是合法金额", 1);
  const neg = text.startsWith("-");
  const unsigned = neg ? text.slice(1) : text;
  const [whole, frac = ""] = unsigned.split(".");
  if (whole.length > 12) throw new DraftWriteRejected("base_salary 不是合法金额", 1);
  const head = frac.slice(0, 2).padEnd(2, "0");
  const roundDigit = frac.length > 2 ? frac.charCodeAt(2) - 48 : 0;
  let cents = Number(whole) * 100 + Number(head);
  if (!Number.isSafeInteger(cents)) throw new DraftWriteRejected("base_salary 不是合法金额", 1);
  if (roundDigit >= 5) cents += 1;
  if (neg && cents !== 0) cents = -cents;
  return cents;
}

export function moneyTextFromCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const text = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${text}` : text;
}

export function recomputePayableCents(parts: {
  base: number;
  door: number;
  online: number;
  store: number;
  accessories: number;
  subsidy: number;
  bonus: number;
  deduction: number;
}): { gross: number; net: number } {
  const gross =
    parts.base + parts.door + parts.online + parts.store + parts.accessories + parts.subsidy + parts.bonus;
  return { gross, net: gross - parts.deduction };
}

export interface DraftEmployeeInput {
  person_name?: unknown;
  name?: unknown;
  base_salary?: unknown;
  work_role?: unknown;
  role?: unknown;
  employment_status?: unknown;
  user_id?: unknown;
}

interface NormalizedEmployee {
  person_name: string;
  user_id: string | null;
  work_role: "上门" | "门店" | null;
  employment_status: "在职" | "离职";
  status_provided: boolean;
  base_cents: number | null;
  base_provided: boolean;
}

export interface EmployeeDraftIo {
  readDraft(month: string, personName: string): Promise<Record<string, unknown>[]>;
  insertPlaceholder(row: Record<string, string>): Promise<void>;
  patchBase(month: string, personName: string, patch: Record<string, string>): Promise<void>;
  readEmployee?(spec: { person_name?: string; user_id?: string }): Promise<Record<string, unknown> | null>;
}

export interface EmployeeDraftResult {
  ok: true;
  action: "skip" | "insert" | "patch" | "placeholder_then_patch";
  wrote: boolean;
  month: string;
  person_name: string;
  work_role: "上门" | "门店" | null;
  source: string | null;
  base_amount: string;
  gross_amount: string | null;
  net_amount: string | null;
  subsidy_amount: string | null;
  bonus_amount: string | null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

function parseUserId(value: unknown): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const text = String(value).trim();
  if (!UUID_RE.test(text)) throw new DraftWriteRejected("user_id 不是 UUID", 1);
  return text;
}

function baseProvided(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

export function normalizeEmployee(raw: DraftEmployeeInput): NormalizedEmployee {
  const name = textOrNull(raw.person_name) ?? textOrNull(raw.name) ?? "";
  const userId = parseUserId(raw.user_id);
  if (!name && !userId) throw new DraftWriteRejected("需要 person_name 或 user_id", 1);
  const roleRaw = raw.work_role ?? raw.role;
  let workRole: "上门" | "门店" | null = null;
  if (!(roleRaw == null || (typeof roleRaw === "string" && roleRaw.trim() === ""))) {
    const role = String(roleRaw).trim();
    if (role !== "上门" && role !== "门店") throw new DraftWriteRejected("work_role 只能是上门或门店", 1);
    workRole = role;
  }
  const statusRaw = raw.employment_status;
  const statusGiven = !(statusRaw == null || (typeof statusRaw === "string" && statusRaw.trim() === ""));
  let status: "在职" | "离职" = "在职";
  if (statusGiven) {
    const text = String(statusRaw).trim();
    if (text !== "在职" && text !== "离职") throw new DraftWriteRejected("无法识别的 employment_status", 1);
    status = text;
  }
  const hasBase = baseProvided(raw.base_salary);
  let base: number | null = null;
  if (hasBase) {
    if (typeof raw.base_salary === "boolean") throw new DraftWriteRejected("base_salary 不是合法金额", 1);
    base = moneyCents(raw.base_salary);
    if (base < 0) throw new DraftWriteRejected("base_salary 不能为负", 1);
  }
  if (name && (HARD_EXCLUDED as readonly string[]).includes(name)) {
    throw new DraftWriteRejected(`硬排除人员 ${name}，已中止未写库`, 3);
  }
  return {
    person_name: name,
    user_id: userId,
    work_role: workRole,
    employment_status: status,
    status_provided: statusGiven,
    base_cents: base,
    base_provided: hasBase,
  };
}

export function resolveDraftMonth(explicit: string | null | undefined, now: Date): string {
  let month: string;
  if (explicit == null || explicit.trim() === "") {
    month = shanghaiYearMonth(now);
  } else {
    const matched = MONTH_RE.exec(explicit.trim());
    if (!matched) throw new DraftWriteRejected("month 须为 YYYY-MM", 1);
    const monthNum = Number(matched[2]);
    if (monthNum < 1 || monthNum > 12) throw new DraftWriteRejected("month 须为 YYYY-MM", 1);
    month = `${matched[1]}-${matched[2]}`;
  }
  if (month < EFFECTIVE_FROM) {
    throw new DraftWriteRejected(`月份 ${month} 早于生效月 ${EFFECTIVE_FROM}，不写占位、不同步底薪`, 2);
  }
  if (month === OCTOBER_NO_SEED) {
    throw new DraftWriteRejected(`十月禁灌：${month} 不写 salary_realtime_draft 占位、不同步底薪。`, 2);
  }
  return month;
}

function buildCaliber(workRole: string | null): string {
  if (workRole) return `${CALIBER_BASE}|work_role=${workRole}`;
  return CALIBER_BASE;
}

export function buildPlaceholderRow(employee: NormalizedEmployee, month: string, asOf: string): Record<string, string> {
  if (employee.base_cents == null) throw new DraftWriteRejected("缺少 base_salary", 1);
  if (!employee.person_name) throw new DraftWriteRejected("缺少 person_name", 1);
  const payable = recomputePayableCents({
    base: employee.base_cents,
    door: 0,
    online: 0,
    store: 0,
    accessories: 0,
    subsidy: 0,
    bonus: 0,
    deduction: 0,
  });
  const row: Record<string, string> = {
    month,
    person_name: employee.person_name,
    as_of: asOf,
    base_amount: moneyTextFromCents(employee.base_cents),
    door_amount: "0.00",
    online_amount: "0.00",
    store_amount: "0.00",
    accessories_amount: "0.00",
    subsidy_amount: "0.00",
    bonus_amount: "0.00",
    gross_amount: moneyTextFromCents(payable.gross),
    deduction_amount: "0.00",
    net_amount: moneyTextFromCents(payable.net),
    caliber: buildCaliber(employee.work_role),
    source: SOURCE_PLACEHOLDER,
    updated_at: asOf,
  };
  if (employee.user_id) row.user_id = employee.user_id;
  if (row.source !== SOURCE_PLACEHOLDER) throw new DraftWriteRejected("占位 source 异常", 1);
  for (const key of ["door_amount", "online_amount", "store_amount", "accessories_amount", "subsidy_amount", "bonus_amount"]) {
    if (row[key] !== "0.00") throw new DraftWriteRejected("占位业绩或补贴列不是 0", 1);
  }
  return row;
}

function readAmount(record: Record<string, unknown>, keys: string[], label: string): number {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const raw = record[key];
    if (raw == null || String(raw).trim() === "") return 0;
    try {
      return moneyCents(raw);
    } catch {
      throw new DraftWriteRejected(`已有草案的 ${label} 不是金额，已中止未写库`, 1);
    }
  }
  throw new DraftWriteRejected(`已有草案行缺少 ${label}，已中止未写库`, 1);
}

export function buildBasePatch(
  existing: Record<string, unknown>,
  newBaseCents: number,
  asOf: string,
): { patch: Record<string, string>; preserved: Record<string, string | null> } {
  const door = readAmount(existing, ["door_amount", "door_commission"], "door_amount");
  const online = readAmount(existing, ["online_amount", "online_commission"], "online_amount");
  const store = readAmount(existing, ["store_amount", "store_commission"], "store_amount");
  const accessories = readAmount(existing, ["accessories_amount", "accessories_commission"], "accessories_amount");
  const subsidy = readAmount(existing, ["subsidy_amount", "subsidy"], "subsidy_amount");
  const bonus = readAmount(existing, ["bonus_amount", "bonus"], "bonus_amount");
  const deduction = readAmount(existing, ["deduction_amount", "deduction"], "deduction_amount");
  if (subsidy < 0 || bonus < 0) throw new DraftWriteRejected("已有补贴或奖金为负，已中止未写库", 1);
  const payable = recomputePayableCents({
    base: newBaseCents,
    door,
    online,
    store,
    accessories,
    subsidy,
    bonus,
    deduction,
  });
  const patch: Record<string, string> = {
    base_amount: moneyTextFromCents(newBaseCents),
    gross_amount: moneyTextFromCents(payable.gross),
    net_amount: moneyTextFromCents(payable.net),
    as_of: asOf,
    updated_at: asOf,
  };
  assertPatchOnlyBase(patch);
  const name = textOrNull(existing.person_name) ?? textOrNull(existing.person) ?? "";
  return {
    patch,
    preserved: {
      person_name: name,
      door_amount: moneyTextFromCents(door),
      online_amount: moneyTextFromCents(online),
      store_amount: moneyTextFromCents(store),
      accessories_amount: moneyTextFromCents(accessories),
      subsidy_amount: moneyTextFromCents(subsidy),
      bonus_amount: moneyTextFromCents(bonus),
      deduction_amount: moneyTextFromCents(deduction),
      source: typeof existing.source === "string" ? existing.source : null,
    },
  };
}

export function assertPatchOnlyBase(patch: Record<string, string>): void {
  const keys = Object.keys(patch).sort();
  const expected = [...PATCH_KEYS].sort();
  if (keys.join("|") !== expected.join("|")) {
    throw new DraftWriteRejected("底薪同步字段越界，已中止未写库", 1);
  }
  for (const key of FORBIDDEN_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      throw new DraftWriteRejected("底薪同步不得覆盖手填或业绩列，已中止未写库", 1);
    }
  }
}

function oneRow(rows: unknown, what: string): Record<string, unknown> | null {
  if (!Array.isArray(rows)) throw new DraftWriteRejected(`${what}返回不是数组，已中止未写库`, 1);
  if (rows.length > 1) throw new DraftWriteRejected(`${what}命中多行，已中止未写库`, 1);
  if (rows.length === 1 && (!rows[0] || typeof rows[0] !== "object" || Array.isArray(rows[0]))) {
    throw new DraftWriteRejected(`${what}行不是对象，已中止未写库`, 1);
  }
  return rows.length === 1 ? (rows[0] as Record<string, unknown>) : null;
}

function amountText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" || (typeof value === "string" && MONEY_RE.test(value.trim()))) {
    return moneyTextFromCents(moneyCents(value));
  }
  return String(value);
}

async function finishEmployee(
  raw: DraftEmployeeInput,
  gateOpen: boolean,
  io: EmployeeDraftIo | undefined,
  credentialError: DraftWriteRejected | undefined,
): Promise<NormalizedEmployee> {
  const cli = normalizeEmployee(raw);
  const needFetch = gateOpen && (!cli.person_name || !cli.base_provided);
  if (!gateOpen) return cli;
  if (!needFetch) return cli;
  if (!io?.readEmployee) {
    throw credentialError ?? new DraftWriteRejected(
      `${EMPLOYEE_DRAFT_GATE}=true 与写入请求已同时成立，但缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，未写库`,
      1,
    );
  }
  const spec = cli.person_name ? { person_name: cli.person_name } : { user_id: cli.user_id ?? undefined };
  const fetched = await io.readEmployee(spec);
  if (!fetched) throw new DraftWriteRejected("employees 没有该员工，已中止未写库", 1);
  if (textOrNull(fetched.employment_status) == null) {
    throw new DraftWriteRejected("employees 行缺少 employment_status，已中止未写库", 1);
  }
  const fetchedUid = parseUserId(fetched.user_id);
  const mergedInput: DraftEmployeeInput = {
    person_name: textOrNull(fetched.person_name),
    work_role: textOrNull(fetched.work_role),
    base_salary: fetched.base_salary,
    employment_status: textOrNull(fetched.employment_status),
    user_id: fetchedUid,
  };
  if (cli.person_name) mergedInput.person_name = cli.person_name;
  if (cli.user_id) mergedInput.user_id = cli.user_id;
  if (cli.work_role) mergedInput.work_role = cli.work_role;
  if (cli.base_provided) mergedInput.base_salary = cli.base_cents == null ? undefined : moneyTextFromCents(cli.base_cents);
  if (cli.status_provided) mergedInput.employment_status = cli.employment_status;
  const merged = normalizeEmployee(mergedInput);
  if (cli.user_id && fetchedUid && cli.user_id !== fetchedUid) {
    throw new DraftWriteRejected("user_id 与 employees 不一致，已中止未写库", 1);
  }
  return merged;
}

export async function runEmployeeDraft(input: {
  mode: "ensure" | "sync";
  employee: DraftEmployeeInput;
  month?: string | null;
  now?: Date;
  gateOpen: boolean;
  io?: EmployeeDraftIo;
  credentialError?: DraftWriteRejected;
}): Promise<EmployeeDraftResult> {
  if (input.mode !== "ensure" && input.mode !== "sync") {
    throw new DraftWriteRejected("未知写入模式", 1);
  }
  const now = input.now ?? new Date();
  const month = resolveDraftMonth(input.month, now);
  const person = await finishEmployee(input.employee, input.gateOpen, input.io, input.credentialError);
  if (input.mode === "ensure" && person.employment_status !== "在职") {
    throw new DraftWriteRejected("非在职不占位，已中止未写库", 4);
  }
  if (!input.gateOpen) throw new DraftGateClosed();
  if (!input.io) {
    throw input.credentialError ?? new DraftWriteRejected(
      `${EMPLOYEE_DRAFT_GATE}=true 与写入请求已同时成立，但缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，未写库`,
      1,
    );
  }
  if (person.base_cents == null) throw new DraftWriteRejected("缺少 base_salary", 1);
  const stamp = shanghaiStamp(now);
  const preview = buildPlaceholderRow(person, month, stamp);
  const rows = await input.io.readDraft(month, person.person_name);
  let current = oneRow(rows, "当月草案");
  if (current) {
    const got = textOrNull(current.person_name) ?? textOrNull(current.person) ?? "";
    if (got && got !== person.person_name) {
      throw new DraftWriteRejected("草案行姓名与目标不一致，已中止未写库", 1);
    }
  }

  if (input.mode === "ensure") {
    if (current) {
      return {
        ok: true,
        action: "skip",
        wrote: false,
        month,
        person_name: person.person_name,
        work_role: person.work_role,
        source: typeof current.source === "string" ? current.source : null,
        base_amount: moneyTextFromCents(readAmount(current, ["base_amount", "base_salary"], "base_amount")),
        gross_amount: amountText(current.gross_amount),
        net_amount: amountText(current.net_amount),
        subsidy_amount: moneyTextFromCents(readAmount(current, ["subsidy_amount", "subsidy"], "subsidy_amount")),
        bonus_amount: moneyTextFromCents(readAmount(current, ["bonus_amount", "bonus"], "bonus_amount")),
      };
    }
    await input.io.insertPlaceholder(preview);
    return {
      ok: true,
      action: "insert",
      wrote: true,
      month,
      person_name: person.person_name,
      work_role: person.work_role,
      source: SOURCE_PLACEHOLDER,
      base_amount: preview.base_amount,
      gross_amount: preview.gross_amount,
      net_amount: preview.net_amount,
      subsidy_amount: "0.00",
      bonus_amount: "0.00",
    };
  }

  let inserted = false;
  if (!current) {
    if (person.employment_status !== "在职") {
      throw new DraftWriteRejected("非在职且当月无草案，不占位，已中止未写库", 4);
    }
    await input.io.insertPlaceholder(preview);
    const reread = oneRow(await input.io.readDraft(month, person.person_name), "当月草案");
    current = reread ?? preview;
    inserted = true;
  }
  const { patch, preserved } = buildBasePatch(current, person.base_cents, stamp);
  await input.io.patchBase(month, person.person_name, patch);
  return {
    ok: true,
    action: inserted ? "placeholder_then_patch" : "patch",
    wrote: true,
    month,
    person_name: person.person_name,
    work_role: person.work_role,
    source: preserved.source ?? (inserted ? SOURCE_PLACEHOLDER : null),
    base_amount: patch.base_amount,
    gross_amount: patch.gross_amount,
    net_amount: patch.net_amount,
    subsidy_amount: preserved.subsidy_amount,
    bonus_amount: preserved.bonus_amount,
  };
}

const BODY_KEYS = new Set([
  "mode",
  "person_name",
  "name",
  "base_salary",
  "work_role",
  "role",
  "employment_status",
  "user_id",
  "month",
]);

export function parseEmployeeDraftBody(body: unknown):
  | { ok: true; mode: "ensure" | "sync"; month: string | null; employee: DraftEmployeeInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid body" };
  const rec = body as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (!BODY_KEYS.has(key)) return { ok: false, error: "only placeholder or base sync fields are accepted" };
  }
  if (rec.mode !== "ensure" && rec.mode !== "sync") return { ok: false, error: "mode must be ensure or sync" };
  if (rec.month != null && typeof rec.month !== "string") return { ok: false, error: "month 须为 YYYY-MM" };
  return {
    ok: true,
    mode: rec.mode,
    month: typeof rec.month === "string" ? rec.month : null,
    employee: {
      person_name: rec.person_name,
      name: rec.name,
      base_salary: rec.base_salary,
      work_role: rec.work_role,
      role: rec.role,
      employment_status: rec.employment_status,
      user_id: rec.user_id,
    },
  };
}

function rejectionStatus(err: DraftWriteRejected): number {
  if (err.code !== 1) return 409;
  if (/HTTP|连接失败|未写库|SUPABASE_/.test(err.message)) return 502;
  return 400;
}

export async function respondEmployeeDraft(input: {
  authenticated: boolean;
  role: string | null;
  authStatus?: number;
  authError?: string;
  payload: unknown;
  gateOpen: boolean;
  now?: Date;
  io?: EmployeeDraftIo;
  credentialError?: DraftWriteRejected;
}): Promise<{ status: number; body: object }> {
  if (!input.authenticated) {
    return {
      status: input.authStatus ?? 401,
      body: { error: input.authError ?? "unauthenticated", wrote: false },
    };
  }
  if (employeeDraftAuthDecision({ authenticated: true, role: input.role }) !== 200) {
    return { status: 403, body: { error: "forbidden", wrote: false } };
  }
  const parsed = parseEmployeeDraftBody(input.payload);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error, wrote: false } };
  try {
    const result = await runEmployeeDraft({
      mode: parsed.mode,
      employee: parsed.employee,
      month: parsed.month,
      now: input.now,
      gateOpen: input.gateOpen,
      io: input.io,
      credentialError: input.credentialError,
    });
    return { status: 200, body: result };
  } catch (err) {
    if (err instanceof DraftGateClosed) {
      return { status: 409, body: { ok: false, error: "未开闸", code: "gate_closed", wrote: false } };
    }
    if (err instanceof DraftWriteRejected) {
      return {
        status: rejectionStatus(err),
        body: { ok: false, error: err.message, code: err.code, wrote: false },
      };
    }
    return { status: 500, body: { ok: false, error: "草案写入失败", code: 1, wrote: false } };
  }
}

const DRAFT_SELECT =
  "person_name,user_id,base_amount,door_amount,online_amount,store_amount,accessories_amount,subsidy_amount,bonus_amount,deduction_amount,gross_amount,net_amount,source,caliber";

export interface DraftServiceCredentials {
  origin: string;
  key: string;
}

export function supabaseOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DraftWriteRejected("SUPABASE_URL 须为 https", 1);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new DraftWriteRejected("SUPABASE_URL 须为 https", 1);
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new DraftWriteRejected("SUPABASE_URL 须为 https", 1);
  }
  return url.origin;
}

export function readDraftServiceCredentials(
  env: Record<string, string | undefined>,
): DraftServiceCredentials | { error: DraftWriteRejected } {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    return {
      error: new DraftWriteRejected(
        "ALLOW_EMPLOYEE_DRAFT_WRITE=true 与写入请求已同时成立，但缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，未写库",
        1,
      ),
    };
  }
  try {
    return { origin: supabaseOrigin(url), key };
  } catch (err) {
    if (err instanceof DraftWriteRejected) return { error: err };
    throw err;
  }
}

function checkedDraftUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname !== `/rest/v1/${DRAFT_TABLE}`) {
    throw new DraftWriteRejected("请求路径越界，已中止未写库", 1);
  }
  return url;
}

export function buildDraftGetUrl(origin: string, month: string, personName: string): string {
  const query = [
    `select=${encodeURIComponent(DRAFT_SELECT)}`,
    `month=eq.${encodeURIComponent(month)}`,
    `person_name=eq.${encodeURIComponent(personName)}`,
    "limit=2",
  ].join("&");
  return checkedDraftUrl(`${origin}/rest/v1/${DRAFT_TABLE}?${query}`);
}

export function buildPlaceholderInsertRequest(origin: string, key: string, row: Record<string, string>) {
  const url = checkedDraftUrl(`${origin}/rest/v1/${DRAFT_TABLE}?on_conflict=month,person_name`);
  const body = JSON.stringify([row]);
  if (body.includes("merge-duplicates")) throw new DraftWriteRejected("占位请求不得 merge", 1);
  return {
    url,
    method: "POST" as const,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body,
  };
}

export function buildBasePatchRequest(
  origin: string,
  key: string,
  month: string,
  personName: string,
  patch: Record<string, string>,
) {
  const query = [`month=eq.${encodeURIComponent(month)}`, `person_name=eq.${encodeURIComponent(personName)}`].join("&");
  const url = checkedDraftUrl(`${origin}/rest/v1/${DRAFT_TABLE}?${query}`);
  return {
    url,
    method: "PATCH" as const,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  };
}
