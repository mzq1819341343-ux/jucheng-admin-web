import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRealtimeSalary,
  formatShanghaiDateTime,
  realtimeReadDecision,
  shanghaiYearMonth,
  showAccessoriesColumn,
} from "./salary-realtime.ts";

describe("realtimeReadDecision", () => {
  it("rejects a missing or malformed month before auth", () => {
    assert.equal(realtimeReadDecision({ month: null, authenticated: false, role: null }), 400);
    assert.equal(realtimeReadDecision({ month: "2026-1", authenticated: true, role: "owner" }), 400);
    assert.equal(realtimeReadDecision({ month: "202610", authenticated: true, role: "owner" }), 400);
    assert.equal(realtimeReadDecision({ month: "2026-13", authenticated: true, role: "owner" }), 200);
  });

  it("returns 401 when the month is valid but there is no session", () => {
    assert.equal(
      realtimeReadDecision({ month: "2026-10", authenticated: false, role: "owner" }),
      401
    );
  });

  it("returns 403 for staff and any other role, never a success", () => {
    assert.equal(realtimeReadDecision({ month: "2026-10", authenticated: true, role: "staff" }), 403);
    assert.equal(realtimeReadDecision({ month: "2026-10", authenticated: true, role: null }), 403);
    assert.equal(realtimeReadDecision({ month: "2026-10", authenticated: true, role: "admin" }), 403);
  });

  it("allows owner and partner", () => {
    assert.equal(realtimeReadDecision({ month: "2026-10", authenticated: true, role: "owner" }), 200);
    assert.equal(
      realtimeReadDecision({ month: "2026-10", authenticated: true, role: "partner" }),
      200
    );
  });
});

describe("buildRealtimeSalary", () => {
  it("returns an empty month without inventing amounts", () => {
    assert.deepEqual(buildRealtimeSalary("2026-10", []), {
      month: "2026-10",
      as_of: null,
      caliber: null,
      people: [],
      totals: {
        base: 0,
        door: 0,
        online: 0,
        store: 0,
        accessories: 0,
        gross: 0,
        deduction: null,
        net: null,
      },
    });
  });

  it("maps draft columns, sorts by name, and takes caliber from the latest as_of", () => {
    const body = buildRealtimeSalary("2026-10", [
      {
        person_name: "李冬浩",
        user_id: "11111111-1111-1111-1111-111111111111",
        as_of: "2026-10-30T04:00:00.000Z",
        base_amount: 2000,
        door_amount: 0,
        online_amount: 0,
        store_amount: 0,
        accessories_amount: 0,
        gross_amount: 2000,
        deduction_amount: null,
        net_amount: null,
        caliber: "在职名单",
      },
      {
        person_name: "张三",
        user_id: null,
        as_of: "2026-10-28T02:00:00+00:00",
        base_amount: "2000.00",
        door_amount: "10.5",
        online_amount: "1",
        store_amount: "0",
        accessories_amount: "0",
        gross_amount: "2011.50",
        deduction_amount: null,
        net_amount: null,
        caliber: "旧口径",
      },
    ]);

    assert.deepEqual(
      body.people.map((p) => p.person_key),
      ["张三", "李冬浩"]
    );
    assert.equal(body.people.length, 2);
    const li = body.people.find((p) => p.person_key === "李冬浩");
    assert.ok(li);
    assert.equal(li.display_name, "李冬浩");
    assert.equal(li.user_id, "11111111-1111-1111-1111-111111111111");
    assert.equal(li.base, 2000);
    assert.equal(li.gross, 2000);
    assert.equal(li.deduction, null);
    assert.equal(li.net, null);
    assert.equal(body.as_of, "2026-10-30T04:00:00.000Z");
    assert.equal(body.caliber, "在职名单");
    assert.equal(body.totals.base, 4000);
    assert.equal(body.totals.door, 10.5);
    assert.equal(body.totals.gross, 4011.5);
    assert.equal(body.totals.deduction, null);
    assert.equal(body.totals.net, null);
    assert.equal(showAccessoriesColumn(body), false);
  });

  it("shows accessories when any person is non-zero and sums nullable deduction", () => {
    const body = buildRealtimeSalary("2026-10", [
      {
        person_name: "甲",
        as_of: "2026-10-30T12:00:00+08:00",
        base_amount: 1,
        accessories_amount: 2.5,
        gross_amount: 3.5,
        deduction_amount: "1.25",
        net_amount: 2,
        caliber: "c",
      },
      {
        person_name: "乙",
        as_of: "2026-10-30T12:00:00+08:00",
        base_amount: 1,
        accessories_amount: 0,
        gross_amount: 1,
        deduction_amount: null,
        net_amount: null,
        caliber: "c",
      },
    ]);
    assert.equal(showAccessoriesColumn(body), true);
    assert.equal(body.totals.accessories, 2.5);
    assert.equal(body.totals.deduction, 1.25);
    assert.equal(body.totals.net, 2);
  });
});

describe("Shanghai calendar", () => {
  it("uses Asia/Shanghai for the default month across the UTC date line", () => {
    assert.equal(shanghaiYearMonth(new Date("2026-10-31T15:30:00Z")), "2026-10");
    assert.equal(shanghaiYearMonth(new Date("2026-10-31T16:30:00Z")), "2026-11");
  });

  it("formats as_of in Shanghai local time", () => {
    assert.equal(formatShanghaiDateTime("2026-10-30T04:00:00.000Z"), "2026-10-30 12:00");
  });
});
