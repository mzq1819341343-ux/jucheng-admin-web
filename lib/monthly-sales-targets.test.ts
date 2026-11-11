import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  TARGET_OFFLINE_MESSAGE,
  TARGET_TABLE_MISSING_MESSAGE,
  coerceMonthlySalesTarget,
  isMissingMonthlySalesTargetsError,
  parseMonthlySalesTargetWrite,
  recycleAchievement,
  type MonthlySalesTarget,
} from "./monthly-sales-targets.ts";

function target(partial: Partial<MonthlySalesTarget> & Pick<MonthlySalesTarget, "employee_id" | "store_id">): MonthlySalesTarget {
  return {
    id: `${partial.month ?? "2026-11"}:${partial.store_id}:${partial.employee_id}`,
    month: "2026-11",
    recycle_target: 100,
    accessories_sales_target: 10,
    ...partial,
  };
}

describe("monthly sales targets", () => {
  it("sums recycle targets of active people at the same store only", () => {
    const view = recycleAchievement({
      rosterKnown: true,
      month: "2026-11",
      storeId: "wanda",
      actual: 150,
      employees: [
        { id: "a", employment_status: "在职" },
        { id: "b", employment_status: "在职" },
        { id: "c", employment_status: "离职" },
      ],
      targets: [
        target({ employee_id: "a", store_id: "wanda", recycle_target: 100 }),
        target({ employee_id: "b", store_id: "wanda", recycle_target: 50.5 }),
        target({ employee_id: "c", store_id: "wanda", recycle_target: 999 }),
        target({ employee_id: "a", store_id: "friendship", recycle_target: 80 }),
        target({ employee_id: "a", store_id: "wanda", month: "2026-10", recycle_target: 70 }),
      ],
    });
    assert.equal(view.target, 150.5);
    assert.equal(view.actual, 150);
    assert.equal(view.rate?.toFixed(1), ((150 / 150.5) * 100).toFixed(1));
  });

  it("is 未设定 when no active person has a target", () => {
    const view = recycleAchievement({
      rosterKnown: true,
      month: "2026-11",
      storeId: null,
      actual: 10,
      employees: [{ id: "c", employment_status: "离职" }],
      targets: [target({ employee_id: "c", store_id: "wanda", recycle_target: 20 })],
    });
    assert.equal(view.target, null);
    assert.equal(view.rate, null);
  });

  it("does not invent a rate when actual is missing or the target is zero", () => {
    const employees = [{ id: "a", employment_status: "在职" }];
    const missingActual = recycleAchievement({
      rosterKnown: true,
      month: "2026-11",
      storeId: null,
      actual: null,
      employees,
      targets: [target({ employee_id: "a", store_id: "wanda", recycle_target: 20 })],
    });
    assert.equal(missingActual.target, 20);
    assert.equal(missingActual.rate, null);

    const zero = recycleAchievement({
      rosterKnown: true,
      month: "2026-11",
      storeId: null,
      actual: 8,
      employees,
      targets: [target({ employee_id: "a", store_id: "wanda", recycle_target: 0 })],
    });
    assert.equal(zero.target, 0);
    assert.equal(zero.rate, null);
  });

  it("is 未设定 for a hidden roster when the month has no target rows", () => {
    const view = recycleAchievement({
      rosterKnown: false,
      month: "2026-11",
      storeId: null,
      actual: 10,
      employees: [],
      targets: [],
    });
    assert.equal(view.rosterKnown, true);
    assert.equal(view.target, null);
    assert.equal(view.rate, null);
  });

  it("does not compute a rate when the roster cannot be checked", () => {
    const view = recycleAchievement({
      rosterKnown: false,
      month: "2026-11",
      storeId: null,
      actual: 10,
      employees: [],
      targets: [target({ employee_id: "a", store_id: "wanda", recycle_target: 20 })],
    });
    assert.equal(view.rosterKnown, false);
    assert.equal(view.target, null);
    assert.equal(view.rate, null);
  });

  it("rejects a blank accessories target instead of copying commission", () => {
    const parsed = parseMonthlySalesTargetWrite({
      month: "2026-11",
      store_id: "wanda",
      employee_id: "a",
      recycle_target: "100",
      accessories_sales_target: "",
    });
    assert.equal(parsed.ok, false);
  });

  it("treats a missing table as a failed write, not an empty success", () => {
    assert.equal(isMissingMonthlySalesTargetsError({ code: "42P01", message: 'relation "public.monthly_sales_targets" does not exist' }), true);
    assert.equal(
      isMissingMonthlySalesTargetsError({
        code: "PGRST205",
        message: "Could not find the table 'public.monthly_sales_targets' in the schema cache",
      }),
      true,
    );
    assert.equal(isMissingMonthlySalesTargetsError({ code: "42501", message: "permission denied" }), false);
    assert.match(TARGET_TABLE_MISSING_MESSAGE, /没有留在本地/);
    assert.match(TARGET_OFFLINE_MESSAGE, /不会留在本机/);
  });

  it("drops a row whose amounts are not numbers", () => {
    assert.equal(
      coerceMonthlySalesTarget({
        month: "2026-11",
        store_id: "wanda",
        employee_id: "a",
        recycle_target: "12.50",
        accessories_sales_target: "3",
      })?.recycle_target,
      12.5,
    );
    assert.equal(
      coerceMonthlySalesTarget({
        month: "2026-11",
        store_id: "wanda",
        employee_id: "a",
        recycle_target: null,
        accessories_sales_target: 1,
      }),
      null,
    );
  });
});

describe("overview does not draw a daily curve", () => {
  const page = readFileSync(new URL("../app/(console)/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/PersonStoreTargetForm.tsx", import.meta.url), "utf8");
  const help = readFileSync(new URL("../app/(console)/help/page.tsx", import.meta.url), "utf8");
  const reports = readFileSync(new URL("../app/(console)/business/aihuishou/reports/page.tsx", import.meta.url), "utf8");

  it("keeps the ledger empty state and does not embed the disk dump", () => {
    assert.equal(page.split("台账无按日明细").length - 1, 2);
    assert.equal(page.includes("recycle_order_amount"), false);
    assert.equal(page.includes("accessories_sales_amount"), false);
    assert.equal(page.includes("13399"), false);
    assert.equal(page.includes("fj_20261104"), false);
    assert.equal(page.includes("daily_series"), false);
    assert.equal(page.includes('from("site_targets")'), false);
  });

  it("does not keep a local fake target", () => {
    const source = readFileSync(new URL("./monthly-sales-targets.ts", import.meta.url), "utf8");
    assert.equal(form.includes("已本地保存"), false);
    assert.equal(form.includes("local-"), false);
    assert.equal(form.includes("salary_realtime"), false);
    assert.match(form, /MONTHLY_SALES_TARGETS_TABLE/);
    assert.match(source, /monthly_sales_targets/);
    assert.match(source, /onConflict: "month,store_id,employee_id"|recycle_target/);
  });

  it("stops telling people the overview writes site_targets", () => {
    assert.equal(help.includes("老板在总览设定"), false);
    assert.equal(help.includes("老板在总览用 site_targets"), false);
    assert.equal(help.includes("monthly_sales_targets"), false);
    assert.equal(help.includes("site_targets"), false);
    assert.equal(reports.includes("老板在总览设定"), false);
    assert.match(reports, /monthly_sales_targets/);
  });
});
