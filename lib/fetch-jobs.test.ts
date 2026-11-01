import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FETCH_JOBS_NOT_READY,
  dedupeFetchJobMessages,
  fetchJobCreateBody,
  fetchJobFailureMessage,
  fetchJobsLatestPath,
  fetchLegLabel,
  parseFetchJobCreate,
  parseFetchJobLatest,
} from "./fetch-jobs.ts";

describe("fetch job create", () => {
  it("posts month and scope only", () => {
    assert.deepEqual(fetchJobCreateBody("2026-11", "all"), { month: "2026-11", scope: "all" });
    assert.deepEqual(fetchJobCreateBody("2026-11", "accessories"), {
      month: "2026-11",
      scope: "accessories",
    });
    assert.equal(fetchJobsLatestPath("2026-11"), "/api/ops/fetch-jobs/latest?month=2026-11");
  });

  it("accepts job_id and jobId", () => {
    assert.deepEqual(parseFetchJobCreate(200, { job_id: "job-1" }, true), { ok: true, jobId: "job-1" });
    assert.deepEqual(parseFetchJobCreate(202, { jobId: "job-2" }, true), { ok: true, jobId: "job-2" });
  });

  it("does not treat a body without a job id as success", () => {
    const parsed = parseFetchJobCreate(200, { ok: true }, true);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.message, "下发没有返回任务号");
  });

  it("shows one line when dispatch and status both say the route is not ready", () => {
    assert.deepEqual(dedupeFetchJobMessages(FETCH_JOBS_NOT_READY, FETCH_JOBS_NOT_READY), [FETCH_JOBS_NOT_READY]);
    assert.deepEqual(dedupeFetchJobMessages("", FETCH_JOBS_NOT_READY), [FETCH_JOBS_NOT_READY]);
    assert.deepEqual(dedupeFetchJobMessages("月份或范围不正确", "未登录，无法读取抓取状态"), [
      "月份或范围不正确",
      "未登录，无法读取抓取状态",
    ]);
  });

  it("maps a missing route to the not-ready message", () => {
    assert.equal(fetchJobFailureMessage(404, "dispatch"), FETCH_JOBS_NOT_READY);
    assert.equal(parseFetchJobCreate(404, null, false).ok, false);
    const parsed = parseFetchJobCreate(404, null, false);
    if (!parsed.ok) assert.equal(parsed.message, FETCH_JOBS_NOT_READY);
    assert.equal(parseFetchJobCreate(401, { error: "unauthenticated" }, true).ok, false);
  });
});

describe("fetch job latest", () => {
  it("reads old-machine and accessories outcome with row counts", () => {
    const parsed = parseFetchJobLatest(
      200,
      {
        job_id: "job-9",
        finished_at: "2026-11-01T10:00:00+08:00",
        old_machine: { status: "success", row_count: 12 },
        accessories: { ok: false, rows: 0, error: "空文件" },
      },
      true
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.latest.empty, false);
    assert.equal(parsed.latest.jobId, "job-9");
    assert.equal(parsed.latest.at, "2026-11-01T10:00:00+08:00");
    assert.equal(fetchLegLabel(parsed.latest.used), "成功 · 12 行");
    assert.equal(fetchLegLabel(parsed.latest.accessories), "失败 · 0 行（空文件）");
  });

  it("treats an empty payload as no record and a 404 as not ready", () => {
    const empty = parseFetchJobLatest(200, { latest: null }, true);
    assert.equal(empty.ok, true);
    if (empty.ok) assert.equal(empty.latest.empty, true);
    const missing = parseFetchJobLatest(404, "<html>", false);
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.message, FETCH_JOBS_NOT_READY);
  });

  it("keeps a running leg out of the success label", () => {
    const parsed = parseFetchJobLatest(200, { at: "2026-11-01T10:00:00Z", used: { status: "running", rows: 1 } }, true);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(fetchLegLabel(parsed.latest.used), "进行中 · 1 行");
    assert.equal(parsed.latest.used.ok, null);
  });
});
