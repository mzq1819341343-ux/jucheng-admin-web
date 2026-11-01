import { NextResponse } from "next/server";
import { readSalaryActor } from "@/lib/salary-actor";
import {
  allocateFetchJobId,
  fetchJobsWriteDecision,
  isFetchRunsUnavailable,
  parseFetchJobCreateBody,
  queuedFetchRun,
} from "@/lib/fetch-jobs-api";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/ops/fetch-jobs
 * 仅 owner。向 salary_fetch_runs 追加一行 status=queued，返回 { job_id }。
 * 不认领、不回写腿的结果，claim / complete 由 ops / Mac 写。
 * 不写 salary_realtime_draft，upload / apply 固定 false。
 */

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function methodNotAllowed() {
  return json({ error: "method not allowed" }, 405);
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = parseFetchJobCreateBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (
    fetchJobsWriteDecision({
      month: parsed.month,
      scope: parsed.scope,
      authenticated: true,
      role: actor.role,
    }) !== 200
  ) {
    return json({ error: "forbidden" }, 403);
  }

  const db = createServiceRoleClient();
  if (!db) return json({ error: "fetch jobs unavailable" }, 503);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const jobId = allocateFetchJobId();
    const inserted = await db
      .from("salary_fetch_runs")
      .insert(
        queuedFetchRun({
          jobId,
          month: parsed.month,
          scope: parsed.scope,
          createdBy: actor.profileId,
        })
      )
      .select("job_id")
      .single();
    if (!inserted.error && typeof inserted.data?.job_id === "string" && inserted.data.job_id !== "") {
      return json({ job_id: inserted.data.job_id }, 200);
    }
    if (isFetchRunsUnavailable(inserted.error)) return json({ error: "fetch jobs unavailable" }, 503);
    if (inserted.error?.code === "23505") continue;
    return json({ error: "query failed" }, 500);
  }
  return json({ error: "query failed" }, 500);
}
