/**
 * 工资页「数据抓取」只调用这两条，不写 salary_realtime_draft，不触发 APPLY / UPLOAD。
 *
 * POST /api/ops/fetch-jobs
 * body: { month: "YYYY-MM", scope: "all" | "accessories" }
 * 200 / 202: { job_id: string }（也认 jobId）
 *
 * GET /api/ops/fetch-jobs/latest?month=YYYY-MM
 * 200: {
 *   job_id?: string | null,
 *   at?: string | null,          // 也认 finished_at / updated_at / created_at / last_at
 *   used?: Leg | null,           // 旧机。也认 old_machine
 *   accessories?: Leg | null     // 也认 accessory
 * }
 * Leg: { ok?: boolean, status?: "ok"|"success"|"failed"|"error"|"running"|"pending",
 *        rows?: number, row_count?: number, count?: number, error?: string, message?: string }
 * 响应也可以包在 latest 里。latest: null 或空对象表示这个月还没有记录。
 * 404 / 405 / 501 / 502 / 503 / 非 JSON：任务接口未就绪。有响应但没有 job_id 不算下发成功。
 */

export const FETCH_JOBS_NOT_READY = "任务接口未就绪";

export const FETCH_JOBS_CREATE_PATH = "/api/ops/fetch-jobs";

export function fetchJobsLatestPath(month: string): string {
  return `/api/ops/fetch-jobs/latest?month=${encodeURIComponent(month)}`;
}

export type FetchJobScope = "all" | "accessories";

export interface FetchJobLeg {
  ok: boolean | null;
  rows: number | null;
  detail: string | null;
}

export interface FetchJobLatest {
  jobId: string | null;
  at: string | null;
  used: FetchJobLeg;
  accessories: FetchJobLeg;
  empty: boolean;
}

const EMPTY_LEG: FetchJobLeg = { ok: null, rows: null, detail: null };

export function fetchJobCreateBody(month: string, scope: FetchJobScope): {
  month: string;
  scope: FetchJobScope;
} {
  return { month, scope };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asJobId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id === "" ? null : id;
}

export function fetchJobFailureMessage(status: number, action: "dispatch" | "status"): string {
  if (status === 0 || status === 404 || status === 405 || status === 501 || status === 502 || status === 503) {
    return FETCH_JOBS_NOT_READY;
  }
  if (status === 401) {
    return action === "dispatch" ? "未登录，无法下发抓取任务" : "未登录，无法读取抓取状态";
  }
  if (status === 403) {
    return action === "dispatch" ? "当前角色不能下发抓取任务" : "当前角色不能查看抓取状态";
  }
  if (status === 400) return "月份或范围不正确";
  return action === "dispatch" ? "任务下发失败" : "抓取状态读取失败";
}

export function parseFetchJobCreate(
  status: number,
  body: unknown,
  json: boolean
): { ok: true; jobId: string } | { ok: false; message: string } {
  if (!json || status < 200 || status >= 300) {
    return { ok: false, message: fetchJobFailureMessage(json ? status : 0, "dispatch") };
  }
  const row = asRecord(body);
  const jobId = asJobId(row?.job_id) ?? asJobId(row?.jobId);
  if (!jobId) return { ok: false, message: "下发没有返回任务号" };
  return { ok: true, jobId };
}

function asRows(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseLeg(value: unknown): FetchJobLeg {
  const row = asRecord(value);
  if (!row) return { ...EMPTY_LEG };
  let ok: boolean | null = null;
  let detail: string | null = null;
  if (typeof row.ok === "boolean") ok = row.ok;
  else if (row.status === "ok" || row.status === "success") ok = true;
  else if (row.status === "failed" || row.status === "error") ok = false;
  else if (row.status === "running" || row.status === "pending") detail = "进行中";
  const rows = asRows(row.rows ?? row.row_count ?? row.count);
  if (detail === null) {
    if (typeof row.error === "string" && row.error.trim() !== "") detail = row.error.trim();
    else if (typeof row.message === "string" && row.message.trim() !== "") detail = row.message.trim();
  }
  return { ok, rows, detail };
}

function parseAt(row: Record<string, unknown>): string | null {
  for (const key of ["finished_at", "updated_at", "at", "created_at", "last_at"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function legHasSignal(leg: FetchJobLeg): boolean {
  return leg.ok !== null || leg.rows !== null || (leg.detail !== null && leg.detail !== "");
}

export function parseFetchJobLatest(
  status: number,
  body: unknown,
  json: boolean
): { ok: true; latest: FetchJobLatest } | { ok: false; message: string } {
  if (status === 204) {
    return { ok: true, latest: { jobId: null, at: null, used: { ...EMPTY_LEG }, accessories: { ...EMPTY_LEG }, empty: true } };
  }
  if (!json || status < 200 || status >= 300) {
    return { ok: false, message: fetchJobFailureMessage(json ? status : 0, "status") };
  }
  const root = asRecord(body);
  const wrapped = root && "latest" in root ? root.latest : body;
  if (wrapped == null) {
    return { ok: true, latest: { jobId: null, at: null, used: { ...EMPTY_LEG }, accessories: { ...EMPTY_LEG }, empty: true } };
  }
  const row = asRecord(wrapped);
  if (!row) return { ok: false, message: fetchJobFailureMessage(0, "status") };
  const used = parseLeg(row.used ?? row.old_machine ?? row.oldMachine);
  const accessories = parseLeg(row.accessories ?? row.accessory);
  const jobId = asJobId(row.job_id) ?? asJobId(row.jobId);
  const at = parseAt(row);
  const empty = jobId === null && at === null && !legHasSignal(used) && !legHasSignal(accessories);
  return { ok: true, latest: { jobId, at, used, accessories, empty } };
}

export function fetchLegLabel(leg: FetchJobLeg): string {
  const outcome =
    leg.detail === "进行中" ? "进行中" : leg.ok === true ? "成功" : leg.ok === false ? "失败" : "未返回";
  const rows = leg.rows === null ? "行数未返回" : `${leg.rows} 行`;
  const extra = leg.detail && leg.detail !== "进行中" ? `（${leg.detail}）` : "";
  return `${outcome} · ${rows}${extra}`;
}
