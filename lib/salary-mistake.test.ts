import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MISTAKE_TOTALS_RPC,
  mistakeDetailsDecision,
  mistakeWriteDecision,
  parseMistakeTotalRows,
  parseMistakeAmount,
  parseMistakeCreateBody,
  parseMistakePatchBody,
  sumMistakeLineAmounts,
  validateMistakeLines,
} from "./salary-mistake.ts";

describe("mistake role gates", () => {
  it("returns 400 for a bad month before auth on details", () => {
    assert.equal(
      mistakeDetailsDecision({ month: null, authenticated: false, role: null }),
      400
    );
    assert.equal(
      mistakeDetailsDecision({ month: "2026-1", authenticated: true, role: "owner" }),
      400
    );
  });

  it("returns 401 when the month is valid but there is no session", () => {
    assert.equal(
      mistakeDetailsDecision({ month: "2026-10", authenticated: false, role: "owner" }),
      401
    );
    assert.equal(mistakeWriteDecision({ authenticated: false, role: "owner" }), 401);
  });

  it("returns 403 for partner and staff on details and writes", () => {
    for (const role of ["partner", "staff", null, "admin"]) {
      assert.equal(
        mistakeDetailsDecision({ month: "2026-10", authenticated: true, role }),
        403
      );
      assert.equal(mistakeWriteDecision({ authenticated: true, role }), 403);
    }
  });

  it("allows only owner", () => {
    assert.equal(
      mistakeDetailsDecision({ month: "2026-10", authenticated: true, role: "owner" }),
      200
    );
    assert.equal(mistakeWriteDecision({ authenticated: true, role: "owner" }), 200);
  });
});

describe("mistake aggregate", () => {
  it("calls the totals function and not a detail select", () => {
    assert.equal(MISTAKE_TOTALS_RPC, "salary_mistake_totals");
    assert.equal(MISTAKE_TOTALS_RPC.includes("reason"), false);
  });

  it("sums total rows and rejects a payload that still contains reasons", () => {
    const rows = parseMistakeTotalRows([
      { person_name: "甲", mistake_total: "1.50" },
      { person_name: "甲", mistake_total: 2 },
      { person_name: "乙", mistake_total: "3.00" },
    ]);
    assert.deepEqual(rows, [
      { person_name: "甲", mistake_total: 3.5 },
      { person_name: "乙", mistake_total: 3 },
    ]);
    assert.equal(parseMistakeTotalRows([{ person_name: "甲", amount: 1, reason: "x" }]), null);
    assert.equal(parseMistakeTotalRows([{ person_name: "甲", mistake_total: 1, note: "y" }]), null);
    assert.equal(parseMistakeTotalRows([{ person_name: "甲", mistake_total: 1, id: "nope" }]), null);
  });
});

describe("mistake amount and lines", () => {
  it("accepts positive amounts with at most two decimals", () => {
    assert.equal(parseMistakeAmount(12.5), 12.5);
    assert.equal(parseMistakeAmount("0.50"), 0.5);
    assert.equal(parseMistakeAmount(0), null);
    assert.equal(parseMistakeAmount(-1), null);
    assert.equal(parseMistakeAmount("1.005"), null);
    assert.equal(parseMistakeAmount(true), null);
    assert.equal(parseMistakeAmount(""), null);
  });

  it("treats empty lines as total 0 and rejects a partial line", () => {
    assert.equal(sumMistakeLineAmounts([{ amount: "" }, { amount: "1.25" }, { amount: "0." }]), 1.25);
    const empty = validateMistakeLines([
      { id: null, reason: "  ", amount: "", note: "" },
    ]);
    assert.deepEqual(empty, { ok: true, lines: [] });
    const partial = validateMistakeLines([{ id: null, reason: "迟到", amount: "", note: "" }]);
    assert.equal(partial.ok, false);
    const ok = validateMistakeLines([
      { id: null, reason: " 迟到 ", amount: "2.5", note: "  " },
      { id: null, reason: "", amount: "", note: "" },
    ]);
    assert.deepEqual(ok, {
      ok: true,
      lines: [{ id: null, reason: "迟到", amount: 2.5, note: null }],
    });
  });

  it("rejects changing month or person_name and requires amount > 0", () => {
    assert.equal(
      parseMistakePatchBody({ month: "2026-11", reason: "迟到" }).ok,
      false
    );
    assert.equal(
      parseMistakePatchBody({ person_name: "乙", amount: 1 }).ok,
      false
    );
    const patch = parseMistakePatchBody({ reason: "迟到", amount: "3.5", note: "" });
    assert.deepEqual(patch, {
      ok: true,
      value: { reason: "迟到", amount: 3.5, note: null },
    });
    const created = parseMistakeCreateBody({
      month: "2026-10",
      person_name: " 甲 ",
      reason: "迟到",
      amount: 1,
    });
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.value.person_name, "甲");
      assert.equal(created.value.note, null);
      assert.equal(created.value.amount, 1);
    }
    assert.equal(parseMistakeCreateBody({ month: "2026-10", person_name: "甲", reason: "迟到", amount: 0 }).ok, false);
  });
});
