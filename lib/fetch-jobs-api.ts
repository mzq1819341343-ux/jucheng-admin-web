/**
 * 抓取任务的纯映射。路由用它校验请求、拼 queued 行、把 salary_fetch_runs
 * 收成 lib/fetch-jobs.ts 能解析的 latest。这里不访问数据库，也不认领任务。
 */
import { randomBytes } from "node:crypto";

export type FetchJobScope = "all" | "accessories";
export type FetchJobStatus = "queued" | "running" | "success" | "failed";

const SCOPES = new Set<FetchJobScope>(["all", "accessories"]);
const JOB_STATUSES = new Set<FetchJobStatus>(["queued", "running", "success", "failed"]);
/** 与 lib/salary-realtime.ts 的月份门闩一致：^\d{4}-\d{2}$，不另判日历月。 */
const YEAR_MONTH = /^\d{4}-\d{2}$/;

function isYearMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && YEAR_MONTH.test(value);
}

export interface FetchLegWrite {
  status: "pending";
  row_count: null;
  error: null;
  message: null;
}

export interface QueuedFetchRunInsert {
  job_id: string;
  month: string;
  scope: FetchJobScope;
  status: "queued";
  old_machine: FetchLegWrite | null;
  accessories: FetchLegWrite;
  dry: false;
  upload: false;
  apply: false;
  login: false;
  created_by: string | null;
}

export interface FetchRunRow {
  job_id?: unknown;
  scope?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  finished_at?: unknown;
  old_machine?: unknown;
  accessories?: unknown;
}

export interface PublicFetchLeg {
  status?: string;
  ok?: boolean;
  row_count?: number;
  error?: string;
  message?: string;
}

export interface PublicFetchJob {
  job_id: string;
  scope?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  finished_at?: string;
  at?: string;
  old_machine: PublicFetchLeg | null;
  accessories: PublicFetchLeg | null;
}

const BLANK_LEG: FetchLegWrite = {
  status: "pending",
  row_count: null,
  error: null,
  message: null,
};

export function isFetchJobScope(value: unknown): value is FetchJobScope {
  return typeof value === "string" && SCOPES.has(value as FetchJobScope);
}

/**
 * 读当月最新。月份不合法 400；未登录 401；非 owner / 合伙人（含店员）403。
 * 这个月没有行不是 404，路由另返 200 `{ latest: null }`。
 */
export function fetchJobsReadDecision(input: {
  month: string | null;
  authenticated: boolean;
  role: string | null;
}): 400 | 401 | 403 | 200 {
  if (!isYearMonth(input.month)) return 400;
  if (!input.authenticated) return 401;
  if (input.role === "owner" || input.role === "partner") return 200;
  return 403;
}

/**
 * 下发只给 owner。月份或 scope 不合法 400；未登录 401；其它角色 403。
 * 请求体里的 upload / apply 不参与判断，写入时一律 false。
 */
export function fetchJobsWriteDecision(input: {
  month: string | null;
  scope: unknown;
  authenticated: boolean;
  role: string | null;
}): 400 | 401 | 403 | 200 {
  if (!isYearMonth(input.month) || !isFetchJobScope(input.scope)) return 400;
  if (!input.authenticated) return 401;
  if (input.role === "owner") return 200;
  return 403;
}

export function parseFetchJobCreateBody(
  body: unknown
): { ok: true; month: string; scope: FetchJobScope } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "month and scope are required" };
  }
  const row = body as { month?: unknown; scope?: unknown };
  const month = typeof row.month === "string" ? row.month : null;
  if (!isYearMonth(month) || !isFetchJobScope(row.scope)) {
    return { ok: false, error: "month and scope are required" };
  }
  return { ok: true, month, scope: row.scope };
}

/** 上海时间戳 + 6 位十六进制，与 ops 文件态任务号同一形状。 */
export function allocateFetchJobId(now: Date = new Date(), suffix?: string): string {
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
  const stamp = `${pick("year")}${pick("month")}${pick("day")}T${hour}${pick("minute")}${pick("second")}`;
  const tail = suffix ?? randomBytes(3).toString("hex");
  return `fj_${stamp}_${tail}`;
}

/**
 * 只插入排队行。范围内的腿是 pending，范围外是 null。
 * upload / apply / login 固定 false，claim 与 complete 不在这里做。
 */
export function queuedFetchRun(input: {
  jobId: string;
  month: string;
  scope: FetchJobScope;
  createdBy: string | null;
}): QueuedFetchRunInsert {
  return {
    job_id: input.jobId,
    month: input.month,
    scope: input.scope,
    status: "queued",
    old_machine: input.scope === "all" ? { ...BLANK_LEG } : null,
    accessories: { ...BLANK_LEG },
    dry: false,
    upload: false,
    apply: false,
    login: false,
    created_by: input.createdBy,
  };
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function publicLeg(value: unknown): PublicFetchLeg | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const leg: PublicFetchLeg = {};
  const status = text(row.status);
  if (status) leg.status = status;
  if (typeof row.ok === "boolean") leg.ok = row.ok;
  const rows = row.row_count ?? row.rows ?? row.count;
  if (typeof rows === "number" && Number.isFinite(rows) && rows >= 0) leg.row_count = Math.round(rows);
  const error = text(row.error);
  const message = text(row.message);
  if (error) leg.error = error;
  else if (message) leg.message = message;
  const empty =
    leg.status === undefined &&
    leg.ok === undefined &&
    leg.row_count === undefined &&
    leg.error === undefined &&
    leg.message === undefined;
  if (empty) return null;
  return leg;
}

/** 没有行 → `{ latest: null }`。缺席的腿是 null，不补一条假的 pending。 */
export function toLatestResponse(row: FetchRunRow | null): { latest: PublicFetchJob | null } {
  if (!row) return { latest: null };
  const jobId = text(row.job_id);
  if (!jobId) return { latest: null };
  const latest: PublicFetchJob = {
    job_id: jobId,
    old_machine: publicLeg(row.old_machine),
    accessories: publicLeg(row.accessories),
  };
  const scope = text(row.scope);
  const status = text(row.status);
  if (scope) latest.scope = scope;
  if (status && JOB_STATUSES.has(status as FetchJobStatus)) latest.status = status;
  const created = text(row.created_at);
  const updated = text(row.updated_at);
  const finished = text(row.finished_at);
  if (created) latest.created_at = created;
  if (updated) latest.updated_at = updated;
  if (finished) {
    latest.finished_at = finished;
    latest.at = finished;
  } else if (updated) {
    latest.at = updated;
  } else if (created) {
    latest.at = created;
  }
  return { latest };
}

/**
 * 表不在库里，或 PostgREST 的 schema cache 还没有这张表。
 * 缺列、权限、唯一约束冲突都不是这个情况。
 */
export function isFetchRunsUnavailable(error: {
  code?: string | null;
  message?: string | null;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  if (error.code === "42703" || error.code === "PGRST204") return false;
  return /relation ["'](?:public\.)?salary_fetch_runs["'] does not exist/i.test(message)
    || (/could not find the table/i.test(message) && message.includes("salary_fetch_runs"));
}
