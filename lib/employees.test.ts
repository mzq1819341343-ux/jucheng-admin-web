import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOOR_BASE_NOTE,
  ROSTER_SAVED_MESSAGE,
  baseSalaryLabel,
  coerceEmployeeRow,
  duplicateName,
  parseEmployeeWrite,
  payrollIgnoresTableBase,
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
  it("keeps a base field for 上门 but marks payroll as zero", () => {
    assert.equal(payrollIgnoresTableBase("上门"), true);
    assert.equal(baseSalaryLabel("上门"), `底薪（元，${DOOR_BASE_NOTE}）`);
    assert.match(baseSalaryLabel("上门"), /计薪按 0、不跟表/);
  });

  it("uses the table base for 门店, including a boss stored as 门店", () => {
    assert.equal(payrollIgnoresTableBase("门店"), false);
    assert.equal(baseSalaryLabel("门店"), "底薪（元）");
    const boss = parseEmployeeWrite({
      person_name: "老板",
      base_salary: "8000",
      work_role: "门店",
      employment_status: "在职",
      user_id: "",
    });
    assert.equal(boss.ok, true);
    if (boss.ok) {
      assert.equal(boss.value.base_salary, 8000);
      assert.equal(payrollIgnoresTableBase(boss.value.work_role), false);
    }
  });

  it("still ignores the table when a person named 老板 is marked 上门", () => {
    assert.equal(payrollIgnoresTableBase("上门"), true);
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
