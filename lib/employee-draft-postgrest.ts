/**
 * 服务端直写 PostgREST。只由 Route Handler 引用。
 * 密钥由调用方传入，本文件不读 process.env，也不要被客户端组件 import。
 */

import {
  DraftWriteRejected,
  buildBasePatchRequest,
  buildDraftGetUrl,
  buildPlaceholderInsertRequest,
  supabaseOrigin,
  type DraftServiceCredentials,
  type EmployeeDraftIo,
} from "./employee-draft";

const EMPLOYEES_SELECT = "person_name,work_role,base_salary,employment_status,user_id";

function checked(url: string, allowedPath: string): string {
  const parsed = new URL(url);
  if (parsed.pathname !== allowedPath) {
    throw new DraftWriteRejected("请求路径越界，已中止未写库", 1);
  }
  return url;
}

async function send(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  failPrefix: string,
  ok: number[],
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, redirect: "manual", cache: "no-store", signal: controller.signal });
  } catch {
    throw new DraftWriteRejected(`${failPrefix}连接失败，已中止未写库`, 1);
  } finally {
    clearTimeout(timer);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new DraftWriteRejected(`${failPrefix} HTTP ${response.status}，已中止未写库`, 1);
  }
  const text = await response.text();
  if (!ok.includes(response.status)) {
    throw new DraftWriteRejected(`${failPrefix} HTTP ${response.status}，已中止未写库`, 1);
  }
  return text;
}

function parseArray(text: string, what: string, failPrefix: string): Record<string, unknown>[] {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new DraftWriteRejected(`${failPrefix}响应不是 JSON，已中止未写库`, 1);
  }
  if (!Array.isArray(payload)) throw new DraftWriteRejected(`${what}返回不是数组，已中止未写库`, 1);
  return payload as Record<string, unknown>[];
}

export function createPostgrestDraftIo(
  creds: DraftServiceCredentials,
  fetchImpl: typeof fetch = fetch,
): EmployeeDraftIo {
  if (typeof window !== "undefined") {
    throw new DraftWriteRejected("草案写入只能在服务端", 1);
  }
  const origin = supabaseOrigin(creds.origin);
  const key = creds.key.trim();
  if (!key) throw new DraftWriteRejected("缺少 SUPABASE_SERVICE_ROLE_KEY", 1);

  return {
    async readDraft(month, personName) {
      const text = await send(
        fetchImpl,
        buildDraftGetUrl(origin, month, personName),
        { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } },
        "读取当月草案",
        [200],
      );
      return parseArray(text, "当月草案", "读取当月草案");
    },
    async insertPlaceholder(row) {
      const req = buildPlaceholderInsertRequest(origin, key, row);
      await send(fetchImpl, req.url, { method: req.method, headers: req.headers, body: req.body }, "占位写库失败", [
        200,
        201,
        204,
      ]);
    },
    async patchBase(month, personName, patch) {
      const req = buildBasePatchRequest(origin, key, month, personName, patch);
      await send(
        fetchImpl,
        req.url,
        { method: req.method, headers: req.headers, body: req.body },
        "底薪同步写库失败",
        [200, 201, 204],
      );
    },
    async readEmployee(spec) {
      const ident = spec.person_name
        ? `person_name=eq.${encodeURIComponent(spec.person_name)}`
        : `user_id=eq.${encodeURIComponent(spec.user_id ?? "")}`;
      if (!spec.person_name && !spec.user_id) throw new DraftWriteRejected("读取 employees 缺少身份", 1);
      const url = checked(
        `${origin}/rest/v1/employees?select=${encodeURIComponent(EMPLOYEES_SELECT)}&${ident}&limit=2`,
        "/rest/v1/employees",
      );
      const text = await send(
        fetchImpl,
        url,
        { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } },
        "读取 employees",
        [200],
      );
      const rows = parseArray(text, "employees ", "读取 employees");
      if (rows.length > 1) throw new DraftWriteRejected("employees 命中多行，已中止未写库", 1);
      return rows[0] ?? null;
    },
  };
}
