import { NextResponse } from "next/server";
import { readSalaryActor } from "@/lib/salary-actor";
import {
  fetchJobsReadDecision,
  fetchRunsFailureLog,
  isFetchRunsUnavailable,
  retryFetchRunsRead,
  toLatestResponse,
  type FetchRunRow,
} from "@/lib/fetch-jobs-api";
import { isYearMonth } from "@/lib/salary-realtime";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops/fetch-jobs/latest?month=YYYY-MM
 * owner 或合伙人。按 created_at、job_id 取该月最新一行。
 * 没有记录时 200 { latest: null }，不返回 404。缺席的腿是 null。
 */

const LATEST_SELECT =
  "job_id, scope, status, created_at, updated_at, finished_at, old_machine, accessories";

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function methodNotAllowed() {
  return json({ error: "method not allowed" }, 405);
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (!isYearMonth(month)) return json({ error: "month must match YYYY-MM" }, 400);

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (fetchJobsReadDecision({ month, authenticated: true, role: actor.role }) !== 200) {
    return json({ error: "forbidden" }, 403);
  }

  const db = createServiceRoleClient();
  if (!db) return json({ error: "fetch jobs unavailable" }, 503);

  const readLatest = () =>
    db
      .from("salary_fetch_runs")
      .select(LATEST_SELECT)
      .eq("month", month)
      .order("created_at", { ascending: false })
      .order("job_id", { ascending: false })
      .limit(1)
      .maybeSingle();

  const result = await retryFetchRunsRead(readLatest);
  if (result.error) {
    if (isFetchRunsUnavailable(result.error)) return json({ error: "fetch jobs unavailable" }, 503);
    console.error("salary_fetch_runs latest failed", fetchRunsFailureLog(result.error));
    return json({ error: "query failed" }, 500);
  }
  return json(toLatestResponse((result.data ?? null) as FetchRunRow | null), 200);
}
