import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchLegLabel, parseFetchJobLatest } from "./fetch-jobs.ts";
import { isYearMonth } from "./salary-realtime.ts";
import {
  allocateFetchJobId,
  fetchJobsReadDecision,
  fetchJobsWriteDecision,
  isFetchRunsUnavailable,
  parseFetchJobCreateBody,
  queuedFetchRun,
  toLatestResponse,
} from "./fetch-jobs-api.ts";

describe("fetch job role gates", () => {
  it("uses the same month shape as the salary page", () => {
    for (const month of ["2026-11", "2026-1", "", "202611"]) {
      const gate = fetchJobsReadDecision({ month: month || null, authenticated: true, role: "owner" });
      assert.equal(gate === 400, !isYearMonth(month));
    }
  });

  it("rejects a bad month before auth", () => {
    assert.equal(fetchJobsReadDecision({ month: "2026-1", authenticated: false, role: null }), 400);
    assert.equal(
      fetchJobsWriteDecision({ month: null, scope: "all", authenticated: true, role: "owner" }),
      400
    );
    assert.equal(
      fetchJobsWriteDecision({ month: "2026-11", scope: "used_phone", authenticated: true, role: "owner" }),
      400
    );
  });

  it("lets the owner dispatch and the partner only read", () => {
    assert.equal(fetchJobsReadDecision({ month: "2026-11", authenticated: false, role: "owner" }), 401);
    assert.equal(fetchJobsReadDecision({ month: "2026-11", authenticated: true, role: "staff" }), 403);
    assert.equal(fetchJobsReadDecision({ month: "2026-11", authenticated: true, role: "partner" }), 200);
    assert.equal(fetchJobsReadDecision({ month: "2026-11", authenticated: true, role: "owner" }), 200);
    assert.equal(
      fetchJobsWriteDecision({ month: "2026-11", scope: "accessories", authenticated: false, role: null }),
      401
    );
    assert.equal(
      fetchJobsWriteDecision({ month: "2026-11", scope: "all", authenticated: true, role: "partner" }),
      403
    );
    assert.equal(
      fetchJobsWriteDecision({ month: "2026-11", scope: "all", authenticated: true, role: "staff" }),
      403
    );
    assert.equal(
      fetchJobsWriteDecision({ month: "2026-11", scope: "all", authenticated: true, role: "owner" }),
      200
    );
  });
});

describe("queued salary_fetch_runs row", () => {
  it("accepts month and scope and ignores upload flags in the body", () => {
    assert.deepEqual(parseFetchJobCreateBody({ month: "2026-11", scope: "all", upload: true, apply: true }), {
      ok: true,
      month: "2026-11",
      scope: "all",
    });
    assert.equal(parseFetchJobCreateBody({ month: "2026-11", scope: "used_phone" }).ok, false);
  });

  it("inserts queued with the out-of-scope leg null and both gates off", () => {
    const all = queuedFetchRun({
      jobId: "fj_20261102T090000_a1b2c3",
      month: "2026-11",
      scope: "all",
      createdBy: null,
    });
    assert.equal(all.status, "queued");
    assert.equal(all.upload, false);
    assert.equal(all.apply, false);
    assert.equal(all.login, false);
    assert.deepEqual(all.old_machine, { status: "pending", row_count: null, error: null, message: null });
    assert.equal(all.accessories.status, "pending");

    const accessories = queuedFetchRun({
      jobId: "fj_20261102T090000_a1b2c3",
      month: "2026-11",
      scope: "accessories",
      createdBy: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(accessories.old_machine, null);
    assert.equal(accessories.created_by, "11111111-1111-4111-8111-111111111111");
    assert.equal(allocateFetchJobId(new Date("2026-11-02T01:00:00Z"), "a1b2c3"), "fj_20261102T090000_a1b2c3");
  });
});

describe("latest payload", () => {
  it("returns 200-shaped null when the month has no row", () => {
    const body = toLatestResponse(null);
    assert.deepEqual(body, { latest: null });
    const parsed = parseFetchJobLatest(200, body, true);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.latest.empty, true);
  });

  it("keeps an absent old-machine leg null and still parses for the card", () => {
    const body = toLatestResponse({
      job_id: "fj_20261102T090000_a1b2c3",
      scope: "accessories",
      status: "queued",
      created_at: "2026-11-02T01:00:00+00:00",
      updated_at: "2026-11-02T01:00:05+00:00",
      finished_at: null,
      old_machine: null,
      accessories: { status: "pending", row_count: null, error: null, message: null },
    });
    assert.equal(body.latest?.old_machine, null);
    assert.equal(body.latest?.status, "queued");
    assert.equal(body.latest?.at, "2026-11-02T01:00:05+00:00");
    const parsed = parseFetchJobLatest(200, body, true);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.latest.empty, false);
    assert.equal(fetchLegLabel(parsed.latest.used), "未返回 · 行数未返回");
    assert.equal(fetchLegLabel(parsed.latest.accessories), "进行中 · 行数未返回");
  });

  it("maps finished legs the way the card already reads them", () => {
    const body = toLatestResponse({
      job_id: "fj_9",
      status: "failed",
      finished_at: "2026-11-02T09:00:06+08:00",
      updated_at: "2026-11-02T09:00:06+08:00",
      old_machine: { status: "success", row_count: 12 },
      accessories: { status: "failed", row_count: 0, error: "空文件" },
    });
    assert.equal(body.latest?.at, "2026-11-02T09:00:06+08:00");
    const parsed = parseFetchJobLatest(200, body, true);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(fetchLegLabel(parsed.latest.used), "成功 · 12 行");
    assert.equal(fetchLegLabel(parsed.latest.accessories), "失败 · 0 行（空文件）");
  });
});

describe("missing salary_fetch_runs", () => {
  it("treats a missing table as unavailable and leaves other errors alone", () => {
    assert.equal(isFetchRunsUnavailable({ code: "42P01", message: 'relation "salary_fetch_runs" does not exist' }), true);
    assert.equal(
      isFetchRunsUnavailable({
        code: "PGRST205",
        message: "Could not find the table 'public.salary_fetch_runs' in the schema cache",
      }),
      true
    );
    assert.equal(
      isFetchRunsUnavailable({
        code: "42703",
        message: 'column "old_machine" of relation "salary_fetch_runs" does not exist',
      }),
      false
    );
    assert.equal(isFetchRunsUnavailable({ code: "42501", message: "permission denied for table salary_fetch_runs" }), false);
    assert.equal(isFetchRunsUnavailable(null), false);
  });
});
