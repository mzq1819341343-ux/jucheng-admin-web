import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  ROSTER_EDIT_NOTE_CLOSED,
  ROSTER_EDIT_NOTE_OPEN,
  ROSTER_READ_NOTE,
  ROSTER_SAVED_MESSAGE,
  baseSalaryLabel,
  coerceEmployeeRow,
  duplicateName,
  parseEmployeeWrite,
  rosterEditNote,
  sortEmployees,
  type EmployeeRow,
} from "./employees.ts";

function row(partial: Partial<EmployeeRow> & Pick<EmployeeRow, "id" | "person_name">): EmployeeRow {
  return {
    base_salary: 2000,
    work_role: "门店",
    employment_status: "在职",
    user_id: null,
    updated_at: "2026-11-01T00:00:00.000Z",
    ...partial,
  };
}

describe("employees roster labels", () => {
  it("uses the table base label for 上门 and 门店", () => {
    assert.equal(baseSalaryLabel("上门"), "底薪（元）");
    assert.equal(baseSalaryLabel("门店"), "底薪（元）");
    assert.equal(
      `${baseSalaryLabel("上门")}${ROSTER_EDIT_NOTE_OPEN}${ROSTER_EDIT_NOTE_CLOSED}${ROSTER_READ_NOTE}`.includes(
        "计薪按 0",
      ),
      false,
    );
  });

  it("uses the table base for 门店, including a boss stored as 门店", () => {
    const boss = parseEmployeeWrite({
      person_name: "老板",
      base_salary: "8000",
      work_role: "门店",
      employment_status: "在职",
      user_id: "",
    });
    assert.equal(boss.ok, true);
    if (boss.ok) assert.equal(boss.value.base_salary, 8000);
  });

  it("keeps the entered base when the role is 上门", () => {
    const parsed = parseEmployeeWrite({
      person_name: "老板",
      base_salary: "8000",
      work_role: "上门",
      employment_status: "在职",
      user_id: "",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.base_salary, 8000);
  });

  it("uses the exact save confirmation and does not invent payroll fields", () => {
    assert.equal(ROSTER_SAVED_MESSAGE, "已进测算名单");
  });

  it("selects the open or closed permanent note from gateOpen", () => {
    assert.equal(rosterEditNote(true), ROSTER_EDIT_NOTE_OPEN);
    assert.equal(rosterEditNote(false), ROSTER_EDIT_NOTE_CLOSED);
    assert.equal(
      ROSTER_EDIT_NOTE_OPEN.startsWith(
        "保存写入测算名单；新人在职可进当月实时草案占位，底薪变更同步当月草案底薪与应发；补贴奖金仍以人效卡手填为准。",
      ),
      true,
    );
    assert.match(ROSTER_EDIT_NOTE_OPEN, /上门与门店都按表内底薪保存和显示/);
    assert.equal(ROSTER_EDIT_NOTE_OPEN.includes("占位闸"), false);
    assert.equal(
      ROSTER_EDIT_NOTE_CLOSED.startsWith(
        "保存写入测算名单；占位闸关闭时不写入草案；人效仍读已有实时草案。",
      ),
      true,
    );
    assert.match(ROSTER_EDIT_NOTE_CLOSED, /上门与门店都按表内底薪保存和显示/);
    assert.equal(ROSTER_EDIT_NOTE_CLOSED.includes("新人在职"), false);
    assert.equal(ROSTER_EDIT_NOTE_CLOSED.includes("占位闸未开时不写入草案"), false);
  });

  it("passes gateOpen from the salary server component into the roster card", () => {
    const page = readFileSync(new URL("../app/(console)/salary/page.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("../components/EmployeeRosterCard.tsx", import.meta.url), "utf8");
    assert.match(page, /employeeDraftGateOpen\(process\.env\)/);
    assert.match(page, /gateOpen=\{gateOpen\}/);
    assert.equal(page.includes("NEXT_PUBLIC_ALLOW_EMPLOYEE_DRAFT_WRITE"), false);
    assert.match(card, /rosterEditNote\(gateOpen\)/);
    assert.equal(card.includes("占位闸未开时不写入草案"), false);
    assert.equal(card.includes("NEXT_PUBLIC_"), false);
  });
});

describe("parseEmployeeWrite", () => {
  it("accepts a store row and an optional empty account", () => {
    const parsed = parseEmployeeWrite({
      person_name: " 示例甲 ",
      base_salary: "2000",
      work_role: "门店",
      employment_status: "离职",
      user_id: "  ",
    });
    assert.deepEqual(parsed, {
      ok: true,
      value: {
        person_name: "示例甲",
        base_salary: 2000,
        work_role: "门店",
        employment_status: "离职",
        user_id: null,
      },
    });
  });

  it("rejects a missing role, a negative base, and a non-uuid account", () => {
    assert.equal(
      parseEmployeeWrite({
        person_name: "甲",
        base_salary: "2000",
        work_role: "",
        employment_status: "在职",
        user_id: "",
      }).ok,
      false,
    );
    assert.equal(
      parseEmployeeWrite({
        person_name: "甲",
        base_salary: "-1",
        work_role: "门店",
        employment_status: "在职",
        user_id: "",
      }).ok,
      false,
    );
    assert.equal(
      parseEmployeeWrite({
        person_name: "甲",
        base_salary: "1.5",
        work_role: "上门",
        employment_status: "在职",
        user_id: "not-a-user",
      }).ok,
      false,
    );
  });
});

describe("coerce and sort", () => {
  it("reads numeric strings and drops a row with an unknown role", () => {
    const kept = coerceEmployeeRow({
      id: "11111111-1111-4111-8111-111111111111",
      person_name: " 示例乙 ",
      base_salary: "2000.00",
      work_role: "上门",
      employment_status: "在职",
      user_id: null,
      updated_at: "2026-11-01",
    });
    assert.equal(kept?.person_name, "示例乙");
    assert.equal(kept?.base_salary, 2000);
    assert.equal(
      coerceEmployeeRow({
        id: "x",
        person_name: "丙",
        base_salary: 2000,
        work_role: "老板",
        employment_status: "在职",
        user_id: null,
      }),
      null,
    );
  });

  it("lists active people before departed people", () => {
    const sorted = sortEmployees([
      row({ id: "1", person_name: "乙", employment_status: "离职" }),
      row({ id: "2", person_name: "甲", employment_status: "在职" }),
      row({ id: "3", person_name: "丙", employment_status: "在职" }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item.person_name),
      ["丙", "甲", "乙"],
    );
  });

  it("detects a duplicate name without treating an edited row as its own duplicate", () => {
    const rows = [row({ id: "1", person_name: "甲" })];
    assert.equal(duplicateName(rows, "甲"), true);
    assert.equal(duplicateName(rows, "甲", "1"), false);
  });
});
