import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fetchLegLabel, type FetchJobLatest } from "./fetch-jobs.ts";
import { money2 } from "./format.ts";
import {
  DASHBOARD_AMOUNT_COLUMNS,
  dashboardHeadcount,
  dashboardPersonLine,
  fetchLatestOneLiner,
  salaryDashboardVisible,
} from "./salary-dashboard.ts";
import { formatShanghaiDateTime } from "./salary-realtime.ts";

const EMPTY_LEG = { ok: null, rows: null, detail: null };

describe("salary dashboard audience", () => {
  it("shows the block to owner and partner only", () => {
    assert.equal(salaryDashboardVisible("owner"), true);
    assert.equal(salaryDashboardVisible("partner"), true);
    assert.equal(salaryDashboardVisible("staff"), false);
    assert.equal(salaryDashboardVisible(null), false);
  });

  it("mounts the read-only card from the salary page for that audience", () => {
    const page = readFileSync(new URL("../app/(console)/salary/page.tsx", import.meta.url), "utf8");
    const board = readFileSync(new URL("../components/SalaryLiveBoard.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("../components/SalaryDashboardCard.tsx", import.meta.url), "utf8");
    assert.match(page, /<SalaryLiveBoard role=\{user\.role\} \/>/);
    assert.match(board, /<SalaryDashboardCard month=\{month\} metricsOnly \/>/);
    assert.match(card, /\/api\/salary\/realtime\?month=/);
    assert.equal(card.includes("fetchJobsLatestPath"), false);
    assert.equal(card.includes("FETCH_JOBS_CREATE_PATH"), false);
    assert.equal(card.includes('method: "POST"'), false);
    assert.equal(card.includes('method: "PATCH"'), false);
    assert.equal(card.includes('method: "PUT"'), false);
    assert.equal(card.includes('method: "DELETE"'), false);
    assert.equal(card.includes(".from("), false);
  });
});

describe("salary dashboard columns", () => {
  it("keeps the approved per-person amount order", () => {
    assert.deepEqual(
      DASHBOARD_AMOUNT_COLUMNS.map((column) => column.label),
      ["底薪", "上门", "线上", "门店", "配件×30%", "补贴", "奖金", "扣款", "应发"],
    );
  });

  it("counts only draft rows and formats the mobile line", () => {
    assert.equal(
      dashboardHeadcount([{ in_draft: true }, { in_draft: false }, { in_draft: true }]),
      2,
    );
    assert.equal(dashboardPersonLine("甲", 1200), `甲 · ${money2(1200)}`);
    assert.equal(dashboardPersonLine("合计", 0), `合计 · ${money2(0)}`);
  });
});

describe("fetch latest one-liner", () => {
  it("says when the month has no fetch record", () => {
    const latest: FetchJobLatest = {
      jobId: null,
      at: null,
      used: { ...EMPTY_LEG },
      accessories: { ...EMPTY_LEG },
      empty: true,
    };
    assert.equal(fetchLatestOneLiner(latest), "这个月还没有抓取记录。");
  });

  it("puts time and both legs on one line", () => {
    const latest: FetchJobLatest = {
      jobId: "job-1",
      at: "2026-11-01T04:00:00.000Z",
      used: { ok: true, rows: 12, detail: null },
      accessories: { ok: false, rows: 0, detail: "超时" },
      empty: false,
    };
    assert.equal(
      fetchLatestOneLiner(latest),
      `上次抓取 ${formatShanghaiDateTime(latest.at ?? "")} · 旧机 ${fetchLegLabel(latest.used)} · 配件 ${fetchLegLabel(latest.accessories)}`,
    );
    assert.equal(fetchLatestOneLiner(latest).includes("job-1"), false);
  });
});
