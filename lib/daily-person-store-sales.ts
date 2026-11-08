/**
 * 人 × 店 × 日销售只读。形状对齐 ops 契约（tip 718b3af）：
 * GET /api/ops/daily-person-store-sales/daily
 * GET /api/ops/daily-person-store-sales
 *
 * 金额在 JSON 里保持两位小数字符串。页面画图时再转数字。
 * 没有行的日期不补 0。会话不是 owner 时不得发 service role 查询。
 * 不写表，不读月度销售目标，不用工资提成代替配件销售额。
 */

const TABLE = "daily_person_store_sales";
const REST_PATH = `/rest/v1/${TABLE}`;
const SELECT = [
  "day",
  "month",
  "person_name",
  "store_name",
  "recycle_store_amount",
  "recycle_online_amount",
  "accessories_sales",
  "n_old_machine",
  "n_accessories",
  "updated_at",
].join(",");
const AMOUNT_FIELDS = ["recycle_store_amount", "recycle_online_amount", "accessories_sales"] as const;
const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);
const MONEY_MAX_CENTS = BigInt("99999999999999");
const COUNT_MAX = 2_000_000_000;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type AmountField = (typeof AMOUNT_FIELDS)[number];

export interface DetailRow {
  day: string;
  month: string;
  person_name: string;
  store_name: string;
  recycle_store_amount: string;
  recycle_online_amount: string;
  accessories_sales: string;
  n_old_machine: number | null;
  n_accessories: number | null;
  updated_at: string | null;
}

export interface DailyTotal {
  day: string;
  recycle_store_amount: string;
  recycle_online_amount: string;
  accessories_sales: string;
}

export interface RankRow {
  name: string;
  amount: string;
}

export interface ReadSpec {
  month: string;
  day: string | null;
  personName: string | null;
  storeName: string | null;
}

export interface TrendPoint {
  day: string;
  /** null：这一天没有行。不是 0，画图时留空。 */
  amount: number | null;
}

export interface DailySalesView {
  daily: DailyTotal[];
  storeRecycle: RankRow[];
  personRecycle: RankRow[];
  personAccessories: RankRow[];
  recycleStoreTotal: string;
  accessoriesTotal: string;
}

export type OwnerSalesResult =
  | { ok: true; detail: DetailRow[] }
  | { ok: false; reason: "forbidden" | "bad-month" | "unavailable" };

export type SalesActorGate =
  | { ok: false; status: 401 | 500; error: string }
  | { ok: true; role: string | null };

export type SalesTransport = (
  method: "GET",
  url: string,
  headers: Record<string, string>,
  body: null,
) => Promise<{ status: number; raw: string; contentRange: string | null }>;

export interface SalesIo {
  env?: Record<string, string | undefined>;
  transport?: SalesTransport;
  rowSource?: (spec: ReadSpec) => unknown[];
  pageSize?: number;
  maxRows?: number;
}

export class SalesReadError extends Error {
  readonly kind: "unavailable" | "failed";

  constructor(kind: "unavailable" | "failed", message: string) {
    super(message);
    this.name = "SalesReadError";
    this.kind = kind;
  }
}

export function parseMonth(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !MONTH_RE.test(value)) return null;
  return value;
}

export function parseDay(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** 月份不合法 400；未登录 401；不是 owner 403；owner 200。查询必须在 200 之后。 */
export function dailySalesReadDecision(input: {
  month: string | null;
  authenticated: boolean;
  role: string | null;
}): 400 | 401 | 403 | 200 {
  if (!parseMonth(input.month)) return 400;
  if (!input.authenticated) return 401;
  if (input.role !== "owner") return 403;
  return 200;
}

export function parseFilterName(
  value: string | null,
): { ok: true; name: string | null } | { ok: false } {
  if (value == null) return { ok: true, name: null };
  const text = value.trim();
  if (text === "") return { ok: true, name: null };
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) return { ok: false };
  }
  return { ok: true, name: text };
}

export function readSpec(
  month: string,
  day?: string | null,
  personName?: string | null,
  storeName?: string | null,
): ReadSpec {
  const monthText = parseMonth(month);
  if (!monthText) throw new SalesReadError("failed", "month 须为 YYYY-MM");
  let dayText: string | null = null;
  if (day != null && day !== "") {
    dayText = parseDay(day);
    if (!dayText) throw new SalesReadError("failed", "day 须为 YYYY-MM-DD");
    if (dayText.slice(0, 7) !== monthText) throw new SalesReadError("failed", "day 不在 month 内");
  }
  return {
    month: monthText,
    day: dayText,
    personName: personName ?? null,
    storeName: storeName ?? null,
  };
}

export function formatMoney(value: unknown): string {
  if (typeof value === "boolean" || value == null) throw new SalesReadError("failed", "读回的金额非法");
  const text = String(value).trim();
  if (text === "") throw new SalesReadError("failed", "读回的金额非法");
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new SalesReadError("failed", "读回的金额非法");
  const whole = BigInt(match[2]);
  const frac = match[3] ?? "";
  const frac2 = (frac.slice(0, 2) + "00").slice(0, 2);
  let cents = whole * HUNDRED + BigInt(frac2);
  if (frac.length > 2 && frac[2] >= "5") cents += ONE;
  if (cents > MONEY_MAX_CENTS) throw new SalesReadError("failed", "读回的金额超出 numeric(14,2)");
  const signed = match[1] === "-" ? -cents : cents;
  return formatCents(signed);
}

export function groupMoney(text: string): string {
  const negative = text.startsWith("-");
  const plain = negative ? text.slice(1) : text;
  const [whole, frac = "00"] = plain.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${frac}`;
}

function formatCents(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const whole = abs / HUNDRED;
  const frac = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

function centsOf(text: string): bigint {
  const negative = text.startsWith("-");
  const [whole, frac = "00"] = (negative ? text.slice(1) : text).split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function parseCount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "boolean") throw new SalesReadError("failed", "件数不是整数");
  const text = String(value).trim();
  if (text === "") return null;
  if (!/^\d+(?:\.0+)?$/.test(text)) throw new SalesReadError("failed", "件数不是整数");
  const number = Number(text.slice(0, text.indexOf(".") === -1 ? text.length : text.indexOf(".")));
  if (!Number.isSafeInteger(number) || number < 0 || number > COUNT_MAX) {
    throw new SalesReadError("failed", "件数超出范围");
  }
  return number;
}

function parseRequiredName(value: unknown, label: string): string {
  if (value == null) throw new SalesReadError("failed", `${label} 为空`);
  const text = String(value).trim();
  if (text === "") throw new SalesReadError("failed", `${label} 为空`);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) throw new SalesReadError("failed", `${label} 含控制字符`);
  }
  return text;
}

export function normalizeDetailRow(raw: unknown, month: string): DetailRow {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SalesReadError("failed", "读回的行不是对象");
  }
  const row = raw as Record<string, unknown>;
  const day = parseDay(typeof row.day === "string" ? row.day : "");
  if (!day) throw new SalesReadError("failed", "读回的日期非法");
  const derived = day.slice(0, 7);
  const rowMonth = typeof row.month === "string" && row.month.trim() !== "" ? row.month.trim() : derived;
  if (rowMonth !== month || derived !== month) throw new SalesReadError("failed", "读回的月份与查询不一致");
  const updated = row.updated_at;
  return {
    day,
    month,
    person_name: parseRequiredName(row.person_name, "person_name"),
    store_name: parseRequiredName(row.store_name, "store_name"),
    recycle_store_amount: formatMoney(row.recycle_store_amount),
    recycle_online_amount: formatMoney(row.recycle_online_amount),
    accessories_sales: formatMoney(row.accessories_sales),
    n_old_machine: parseCount(row.n_old_machine),
    n_accessories: parseCount(row.n_accessories),
    updated_at: updated == null || String(updated).trim() === "" ? null : String(updated),
  };
}

function matches(row: DetailRow, spec: ReadSpec): boolean {
  if (row.month !== spec.month || row.day.slice(0, 7) !== spec.month) return false;
  if (spec.day && row.day !== spec.day) return false;
  if (spec.personName && row.person_name !== spec.personName) return false;
  if (spec.storeName && row.store_name !== spec.storeName) return false;
  return true;
}

function sortRows(rows: DetailRow[]): DetailRow[] {
  return [...rows].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (a.person_name !== b.person_name) return a.person_name < b.person_name ? -1 : 1;
    if (a.store_name !== b.store_name) return a.store_name < b.store_name ? -1 : 1;
    return 0;
  });
}

export function sumByDay(rows: DetailRow[]): DailyTotal[] {
  const buckets = new Map<string, Record<AmountField, bigint>>();
  for (const row of rows) {
    let bucket = buckets.get(row.day);
    if (!bucket) {
      bucket = { recycle_store_amount: ZERO, recycle_online_amount: ZERO, accessories_sales: ZERO };
      buckets.set(row.day, bucket);
    }
    for (const field of AMOUNT_FIELDS) bucket[field] += centsOf(row[field]);
  }
  return [...buckets.keys()].sort().map((day) => {
    const bucket = buckets.get(day)!;
    return {
      day,
      recycle_store_amount: formatCents(bucket.recycle_store_amount),
      recycle_online_amount: formatCents(bucket.recycle_online_amount),
      accessories_sales: formatCents(bucket.accessories_sales),
    };
  });
}

function rankBy(rows: DetailRow[], nameOf: (row: DetailRow) => string, centsOfRow: (row: DetailRow) => bigint): RankRow[] {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    const name = nameOf(row);
    totals.set(name, (totals.get(name) ?? ZERO) + centsOfRow(row));
  }
  return [...totals.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] > b[1] ? -1 : 1;
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      return 0;
    })
    .map(([name, cents]) => ({ name, amount: formatCents(cents) }));
}

/** 门店回收：只加 recycle_store_amount，不含网单。 */
export function rankStoresByRecycle(rows: DetailRow[]): RankRow[] {
  return rankBy(rows, (row) => row.store_name, (row) => centsOf(row.recycle_store_amount));
}

/** 员工回收：门店回收 + 网单不含券。不是工资提成。 */
export function rankPeopleByRecycle(rows: DetailRow[]): RankRow[] {
  return rankBy(rows, (row) => row.person_name, (row) => centsOf(row.recycle_store_amount) + centsOf(row.recycle_online_amount));
}

/** 员工配件销售额：只加 accessories_sales。 */
export function rankPeopleByAccessories(rows: DetailRow[]): RankRow[] {
  return rankBy(rows, (row) => row.person_name, (row) => centsOf(row.accessories_sales));
}

export function sumField(rows: DailyTotal[], field: AmountField): string {
  return formatCents(rows.reduce((sum, row) => sum + centsOf(row[field]), ZERO));
}

/**
 * 连续日期轴。没有合计行的日子 amount 为 null，调用方不得画成 0。
 * 整月没有任何行时返回空数组，页面继续显示「暂无」。
 */
export function trendSeries(month: string, daily: DailyTotal[], field: AmountField): TrendPoint[] {
  if (!parseMonth(month) || daily.length === 0) return [];
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const points: TrendPoint[] = [];
  for (let day = 1; day <= count; day += 1) {
    const key = `${month}-${String(day).padStart(2, "0")}`;
    const row = byDay.get(key);
    points.push({ day: key, amount: row ? Number(row[field]) : null });
  }
  return points;
}

export function trendGeometry(points: TrendPoint[], width = 320, height = 112) {
  const padX = 8;
  const padY = 10;
  const real = points.flatMap((point) => (point.amount == null ? [] : [point.amount]));
  if (real.length === 0) return { width, height, segments: [] as string[], dots: [] as { x: number; y: number; day: string }[] };
  const min = Math.min(...real);
  const max = Math.max(...real);
  const span = max - min || 1;
  const last = points.length - 1;
  const xAt = (index: number) => (last <= 0 ? width / 2 : padX + (index * (width - padX * 2)) / last);
  const yAt = (amount: number) => padY + (1 - (amount - min) / span) * (height - padY * 2);
  const dots: { x: number; y: number; day: string }[] = [];
  const segments: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 2) segments.push(run.join(" "));
    run = [];
  };
  points.forEach((point, index) => {
    if (point.amount == null) {
      flush();
      return;
    }
    const x = xAt(index);
    const y = yAt(point.amount);
    dots.push({ x, y, day: point.day });
    run.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  flush();
  return { width, height, segments, dots };
}

/** 总览展示。storeName 为空表示全部门店；有店名时按 store_name 精确过滤，对不上就不显示。 */
export function presentDailySales(detail: DetailRow[], storeName: string | null): DailySalesView {
  const rows = storeName == null ? detail : detail.filter((row) => row.store_name === storeName);
  const daily = sumByDay(rows);
  return {
    daily,
    storeRecycle: rankStoresByRecycle(rows),
    personRecycle: rankPeopleByRecycle(rows),
    personAccessories: rankPeopleByAccessories(rows),
    recycleStoreTotal: sumField(daily, "recycle_store_amount"),
    accessoriesTotal: sumField(daily, "accessories_sales"),
  };
}

function httpsOrigin(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new SalesReadError("unavailable", "SUPABASE_URL 须为 https 的项目根地址");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new SalesReadError("unavailable", "SUPABASE_URL 须为 https 的项目根地址");
  }
  return url.origin;
}

function eqFilter(value: string, quoted: boolean): string {
  const text = quoted ? `"${value.replaceAll('"', '""')}"` : value;
  return `eq.${text}`;
}

export function buildReadUrl(baseUrl: string, spec: ReadSpec, limit: number, offset: number): string {
  const params = new URLSearchParams();
  params.set("select", SELECT);
  params.set("month", eqFilter(spec.month, false));
  if (spec.day) params.set("day", eqFilter(spec.day, false));
  if (spec.personName) params.set("person_name", eqFilter(spec.personName, true));
  if (spec.storeName) params.set("store_name", eqFilter(spec.storeName, true));
  params.set("order", "day.asc,person_name.asc,store_name.asc");
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const url = `${httpsOrigin(baseUrl)}${REST_PATH}?${params.toString()}`;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.pathname !== REST_PATH) {
    throw new SalesReadError("failed", `只允许访问表 ${TABLE}`);
  }
  return url;
}

function readCredentials(env: Record<string, string | undefined>): { origin: string; key: string } {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE || "").trim();
  if (!url || !key) throw new SalesReadError("unavailable", "需要 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY");
  return { origin: httpsOrigin(url), key };
}

function contentRangeTotal(value: string | null): number | null {
  if (!value || !value.includes("/")) return null;
  const total = value.slice(value.lastIndexOf("/") + 1).trim();
  if (!/^\d+$/.test(total)) return null;
  return Number(total);
}

/** 金额数字按原文保留，避免 JSON number 先变成二进制浮点再丢分。 */
export function parseJsonPreserveDecimals(text: string): unknown {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const start = i;
      i += 1;
      while (i < text.length) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      out += text.slice(start, i);
      continue;
    }
    const prev = i === 0 ? "" : text[i - 1];
    if ((text[i] === "-" || (text[i] >= "0" && text[i] <= "9")) && (i === 0 || /[\s,:[\]]/.test(prev))) {
      const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (match) {
        out += `"${match[0]}"`;
        i += match[0].length;
        continue;
      }
    }
    out += text[i];
    i += 1;
  }
  return JSON.parse(out);
}

function decodeRows(status: number, raw: string): unknown[] {
  if (status >= 300 && status < 400) throw new SalesReadError("failed", "读取被拒绝：不跟随跳转");
  if (status === 0) throw new SalesReadError("failed", "读取被拒绝：不跟随跳转");
  if (status >= 400) throw new SalesReadError("failed", `读取失败 HTTP ${status}`);
  if (status === 204 || raw === "") return [];
  let payload: unknown;
  try {
    payload = parseJsonPreserveDecimals(raw);
  } catch {
    throw new SalesReadError("failed", "读取响应不是 JSON");
  }
  if (!Array.isArray(payload)) throw new SalesReadError("failed", "读取响应不是数组");
  return payload;
}

async function defaultTransport(
  method: "GET",
  url: string,
  headers: Record<string, string>,
  body: null,
): Promise<{ status: number; raw: string; contentRange: string | null }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new SalesReadError("failed", "连接失败");
  }
  const raw = await response.text();
  return { status: response.status, raw, contentRange: response.headers.get("content-range") };
}

export async function fetchRawRows(spec: ReadSpec, io: SalesIo = {}): Promise<unknown[]> {
  const pageSize = io.pageSize ?? PAGE_SIZE;
  const maxRows = io.maxRows ?? MAX_ROWS;
  if (pageSize < 1 || pageSize > PAGE_SIZE) throw new SalesReadError("failed", "分页大小非法");
  const env = io.env ?? process.env;
  const { origin, key } = readCredentials(env);
  const transport = io.transport ?? defaultTransport;
  const found: unknown[] = [];
  let offset = 0;
  let previous: string | null = null;
  while (true) {
    const url = buildReadUrl(origin, spec, pageSize, offset);
    let status: number;
    let raw: string;
    let contentRange: string | null;
    try {
      const exchanged = await transport("GET", url, {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Prefer: "count=exact",
      }, null);
      status = exchanged.status;
      raw = exchanged.raw;
      contentRange = exchanged.contentRange;
    } catch (error) {
      if (error instanceof SalesReadError) throw error;
      throw new SalesReadError("failed", "连接失败");
    }
    const page = decodeRows(status, raw);
    const total = contentRangeTotal(contentRange);
    if (page.length === 0) {
      if (total != null && total !== 0 && offset < total) throw new SalesReadError("failed", "分页被截断，已中止");
      break;
    }
    const first = page[0];
    const signature = first && typeof first === "object"
      ? `${String((first as Record<string, unknown>).day)}\u0000${String((first as Record<string, unknown>).person_name)}\u0000${String((first as Record<string, unknown>).store_name)}`
      : "";
    if (previous === signature) throw new SalesReadError("failed", "分页没有前进，已中止");
    previous = signature;
    found.push(...page);
    if (total != null && found.length > total) throw new SalesReadError("failed", "分页行数超出 Content-Range，已中止");
    if (found.length > maxRows) throw new SalesReadError("failed", "读取达到上限，已中止");
    if (total != null && found.length >= total) break;
    if (page.length < pageSize) {
      if (total != null && found.length < total) throw new SalesReadError("failed", "分页被截断，已中止");
      break;
    }
    offset += pageSize;
  }
  return found;
}

export async function loadDetailRows(spec: ReadSpec, io: SalesIo = {}): Promise<DetailRow[]> {
  const rawRows = io.rowSource ? io.rowSource(spec) : await fetchRawRows(spec, io);
  if (!Array.isArray(rawRows)) throw new SalesReadError("failed", "读回的响应不是数组");
  const rows = rawRows.map((raw) => normalizeDetailRow(raw, spec.month)).filter((row) => matches(row, spec));
  return sortRows(rows);
}

export async function dailyTotals(month: string, io: SalesIo = {}): Promise<DailyTotal[]> {
  const spec = readSpec(month);
  return sumByDay(await loadDetailRows(spec, io));
}

export async function personStoreDays(
  month: string,
  day: string | null,
  personName: string | null,
  storeName: string | null,
  io: SalesIo = {},
): Promise<DetailRow[]> {
  const spec = readSpec(month, day, personName, storeName);
  return loadDetailRows(spec, io);
}

/**
 * 总览服务端读取。role 不是 owner 时直接返回，不读环境里的 service role，也不调用 transport。
 */
export async function readDailySalesForOwner(input: {
  role: string | null;
  month: string;
  env?: Record<string, string | undefined>;
  transport?: SalesTransport;
  pageSize?: number;
}): Promise<OwnerSalesResult> {
  if (input.role !== "owner") return { ok: false, reason: "forbidden" };
  if (!parseMonth(input.month)) return { ok: false, reason: "bad-month" };
  try {
    const detail = await personStoreDays(input.month, null, null, null, {
      env: input.env,
      transport: input.transport,
      pageSize: input.pageSize,
    });
    return { ok: true, detail };
  } catch (error) {
    if (error instanceof SalesReadError) return { ok: false, reason: "unavailable" };
    console.error("daily_person_store_sales read failed");
    return { ok: false, reason: "unavailable" };
  }
}

function detailQuery(url: URL, month: string): { ok: true; spec: ReadSpec } | { ok: false; error: string } {
  const dayParam = url.searchParams.get("day");
  let day: string | null = null;
  if (dayParam != null && dayParam.trim() !== "") {
    day = parseDay(dayParam.trim());
    if (!day) return { ok: false, error: "day must match YYYY-MM-DD" };
    if (day.slice(0, 7) !== month) return { ok: false, error: "day must fall within month" };
  }
  const person = parseFilterName(url.searchParams.get("person_name"));
  if (!person.ok) return { ok: false, error: "person_name is invalid" };
  const store = parseFilterName(url.searchParams.get("store_name"));
  if (!store.ok) return { ok: false, error: "store_name is invalid" };
  return { ok: true, spec: { month, day, personName: person.name, storeName: store.name } };
}

async function defaultReadActor(): Promise<SalesActorGate> {
  const { readSalaryActor } = await import("./salary-actor");
  const actor = await readSalaryActor();
  if (!actor.ok) return { ok: false, status: actor.status, error: actor.error };
  return { ok: true, role: actor.role };
}

/**
 * 先校验查询，再确认 owner 会话，最后才用 service role 读表。
 * 400 不查会话；401/403 不发 PostgREST。
 */
export async function dailySalesHttp(
  request: Request,
  mode: "daily" | "detail",
  deps: {
    readActor?: () => Promise<SalesActorGate>;
    transport?: SalesTransport;
    env?: Record<string, string | undefined>;
    pageSize?: number;
  } = {},
): Promise<{ status: number; body: unknown }> {
  const url = new URL(request.url);
  const month = parseMonth(url.searchParams.get("month"));
  if (!month) return { status: 400, body: { error: "month must match YYYY-MM" } };
  const parsed = mode === "daily"
    ? { ok: true as const, spec: readSpec(month) }
    : detailQuery(url, month);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  const actor = await (deps.readActor ?? defaultReadActor)();
  if (!actor.ok) return { status: actor.status, body: { error: actor.error } };
  if (dailySalesReadDecision({ month, authenticated: true, role: actor.role }) !== 200) {
    return { status: 403, body: { error: "forbidden" } };
  }

  try {
    const io: SalesIo = { env: deps.env, transport: deps.transport, pageSize: deps.pageSize };
    const body = mode === "daily"
      ? await dailyTotals(month, io)
      : await loadDetailRows(parsed.spec, io);
    return { status: 200, body };
  } catch (error) {
    if (error instanceof SalesReadError && error.kind === "unavailable") {
      return { status: 503, body: { error: "daily sales unavailable" } };
    }
    console.error("daily_person_store_sales read failed");
    return { status: 500, body: { error: "query failed" } };
  }
}
