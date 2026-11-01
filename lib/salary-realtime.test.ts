import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  afterDeductionAmount,
  buildRealtimeSalary,
  formatShanghaiDateTime,
  handFillShown,
  handFillWriteDecision,
  isMissingHandFillColumn,
  parseHandFillAmount,
  parseHandFillPatchBody,
  payableGross,
  realtimeReadDecision,
  shanghaiYearMonth,
  showAccessoriesColumn,
  shownAfterDeduction,
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
        mistake_total: 0,
        after_deduction: 0,
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
    assert.equal(showAccessoriesColumn(body), true);
    assert.equal(body.totals.accessories, 0);
  });

  it("maps a missing accessories amount to 0 and still shows the column", () => {
    const body = buildRealtimeSalary("2026-11", [
      { person_name: "甲", base_amount: 2000, gross_amount: 2000 },
    ]);
    assert.equal(body.people[0]?.accessories, 0);
    assert.equal(body.totals.accessories, 0);
    assert.equal(showAccessoriesColumn(body), true);
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
    const jiaRow = body.people.find((person) => person.person_key === "甲");
    assert.ok(jiaRow);
    assert.equal(jiaRow.mistake_total, 0);
    assert.equal(jiaRow.after_deduction, 3.5);
    assert.equal(body.totals.mistake_total, 0);
    assert.equal(body.totals.after_deduction, 4.5);
    assert.equal(body.people.every((person) => person.in_draft), true);
  });

  it("subtracts mistake totals in cents and keeps draft deduction/net untouched", () => {
    const body = buildRealtimeSalary(
      "2026-10",
      [
        {
          person_name: "甲",
          gross_amount: 100,
          base_amount: 100,
          deduction_amount: null,
          net_amount: null,
        },
      ],
      [
        { person_name: "甲", mistake_total: 12.5 },
        { person_name: "甲", mistake_total: 0.1 },
        { person_name: "乙", mistake_total: 3 },
      ]
    );
    const jia = body.people.find((person) => person.person_key === "甲");
    const yi = body.people.find((person) => person.person_key === "乙");
    assert.ok(jia);
    assert.ok(yi);
    assert.equal(jia.mistake_total, 12.6);
    assert.equal(jia.after_deduction, 87.4);
    assert.equal(jia.deduction, null);
    assert.equal(jia.net, null);
    assert.equal(jia.in_draft, true);
    assert.equal(Object.hasOwn(jia, "reason"), false);
    assert.equal(yi.gross, 0);
    assert.equal(yi.mistake_total, 3);
    assert.equal(yi.after_deduction, -3);
    assert.equal(yi.in_draft, false);
    assert.equal(body.totals.gross, 100);
    assert.equal(body.totals.mistake_total, 15.6);
    assert.equal(body.totals.after_deduction, 84.4);
    assert.equal(
      body.totals.after_deduction,
      afterDeductionAmount(body.totals.gross, body.totals.mistake_total)
    );
  });

  it("treats a person with no draft row as gross 0", () => {
    const body = buildRealtimeSalary("2026-10", [], [{ person_name: "乙", mistake_total: 2.5 }]);
    assert.equal(body.people.length, 1);
    assert.equal(body.people[0].gross, 0);
    assert.equal(body.people[0].after_deduction, -2.5);
    assert.equal(body.totals.gross, 0);
    assert.equal(body.totals.after_deduction, -2.5);
    assert.equal(body.as_of, null);
  });

  it("keeps stored gross and omits subsidy until hand-fill columns are in the response", () => {
    const body = buildRealtimeSalary("2026-10", [
      {
        person_name: "甲",
        base_amount: 2000,
        subsidy_amount: 50,
        bonus_amount: 20,
        gross_amount: 2000,
      },
    ]);
    assert.equal(Object.hasOwn(body.people[0], "subsidy"), false);
    assert.equal(Object.hasOwn(body.people[0], "bonus"), false);
    assert.equal(Object.hasOwn(body.totals, "subsidy"), false);
    assert.equal(body.people[0].gross, 2000);
    assert.equal(handFillShown(body), false);
  });

  it("adds subsidy and bonus into gross only when the columns are present", () => {
    const body = buildRealtimeSalary(
      "2026-10",
      [
        {
          person_name: "甲",
          base_amount: 2000,
          door_amount: 10,
          online_amount: 1,
          store_amount: 3,
          accessories_amount: 4,
          subsidy_amount: null,
          bonus_amount: "6.00",
          gross_amount: 2000,
        },
      ],
      [{ person_name: "甲", mistake_total: 1.5 }, { person_name: "乙", mistake_total: 2 }],
      { handFill: true }
    );
    const jia = body.people.find((person) => person.person_key === "甲");
    const yi = body.people.find((person) => person.person_key === "乙");
    assert.ok(jia);
    assert.ok(yi);
    assert.equal(jia.subsidy, 0);
    assert.equal(jia.bonus, 6);
    assert.equal(jia.gross, 2024);
    assert.equal(jia.after_deduction, 2022.5);
    assert.equal(jia.deduction, null);
    assert.equal(yi.subsidy, 0);
    assert.equal(yi.bonus, 0);
    assert.equal(yi.gross, 0);
    assert.equal(yi.in_draft, false);
    assert.equal(body.totals.subsidy, 0);
    assert.equal(body.totals.bonus, 6);
    assert.equal(body.totals.gross, 2024);
    assert.equal(handFillShown(body), true);
    assert.equal(payableGross({ base: 0.1, door: 0.2, online: 0, store: 0, accessories: 0, subsidy: 0, bonus: 0 }), 0.3);
  });

  it("uses the api after_deduction and falls back to gross minus mistake", () => {
    assert.equal(shownAfterDeduction({ gross: 10, mistake_total: 3, after_deduction: 7 }), 7);
    assert.equal(shownAfterDeduction({ gross: 10.1, mistake_total: 0.2 }), 9.9);
    assert.equal(afterDeductionAmount(0, 4), -4);
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

describe("hand fill patch", () => {
  it("allows owner only, and accepts zero subsidy and bonus", () => {
    assert.equal(handFillWriteDecision({ authenticated: false, role: "owner" }), 401);
    assert.equal(handFillWriteDecision({ authenticated: true, role: "partner" }), 403);
    assert.equal(handFillWriteDecision({ authenticated: true, role: "staff" }), 403);
    assert.equal(handFillWriteDecision({ authenticated: true, role: "owner" }), 200);
    assert.equal(parseHandFillAmount(0), 0);
    assert.equal(parseHandFillAmount("12.5"), 12.5);
    assert.equal(parseHandFillAmount("-1"), null);
    assert.equal(parseHandFillAmount(""), null);
    const parsed = parseHandFillPatchBody({
      month: "2026-11",
      person_name: " 甲 ",
      subsidy_amount: 0,
      bonus_amount: "2.50",
    });
    assert.deepEqual(parsed, { ok: true, value: { month: "2026-11", person_name: "甲", subsidy: 0, bonus: 2.5 } });
  });

  it("rejects a client-supplied gross so the page cannot write a second formula", () => {
    const parsed = parseHandFillPatchBody({
      month: "2026-11",
      person_name: "甲",
      subsidy_amount: 1,
      bonus_amount: 1,
      gross_amount: 99,
    });
    assert.equal(parsed.ok, false);
  });

  it("treats a missing subsidy or bonus column as absent, and other errors as real failures", () => {
    assert.equal(
      isMissingHandFillColumn({
        code: "42703",
        message: 'column salary_realtime_draft.subsidy_amount does not exist',
      }),
      true
    );
    assert.equal(
      isMissingHandFillColumn({
        code: "PGRST204",
        message: "Could not find the 'bonus_amount' column of 'salary_realtime_draft' in the schema cache",
      }),
      true
    );
    assert.equal(isMissingHandFillColumn({ code: "42501", message: "permission denied for table salary_realtime_draft" }), false);
  });
});
