import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mistakeLineSignature,
  mistakeLinesDirty,
  navigationLeavesSalary,
} from "./mistake-editor-dirty.ts";

const blank = { id: null, reason: "", amount: "", note: "" };

describe("mistakeLinesDirty", () => {
  it("is clean while loading or when the snapshot matches", () => {
    const baseline = mistakeLineSignature([blank]);
    assert.equal(mistakeLinesDirty(null, baseline), false);
    assert.equal(mistakeLinesDirty([blank], null), false);
    assert.equal(mistakeLinesDirty([blank], baseline), false);
  });

  it("is dirty when text, amount, order, or line count changes", () => {
    const baseline = mistakeLineSignature([
      { id: "a", reason: "迟到", amount: "1.00", note: "" },
    ]);
    assert.equal(
      mistakeLinesDirty([{ id: "a", reason: "迟到了", amount: "1.00", note: "" }], baseline),
      true
    );
    assert.equal(
      mistakeLinesDirty([{ id: "a", reason: "迟到", amount: "2.00", note: "" }], baseline),
      true
    );
    assert.equal(mistakeLinesDirty([blank, { id: "a", reason: "迟到", amount: "1.00", note: "" }], baseline), true);
    assert.equal(
      mistakeLinesDirty([{ id: "a", reason: "迟到", amount: "1.00", note: "" }], baseline),
      false
    );
  });
});

describe("navigationLeavesSalary", () => {
  const here = "https://admin.example/salary";

  it("stays on the salary page", () => {
    assert.equal(navigationLeavesSalary("/salary", here), false);
    assert.equal(navigationLeavesSalary("/salary/", here), false);
    assert.equal(navigationLeavesSalary("/salary?month=2026-10", here), false);
    assert.equal(navigationLeavesSalary("#edit", here), false);
  });

  it("leaves for in-app pages and other sites", () => {
    assert.equal(navigationLeavesSalary("/expenses", here), true);
    assert.equal(navigationLeavesSalary("/", here), true);
    assert.equal(navigationLeavesSalary("https://example.com/salary", here), true);
  });
});
