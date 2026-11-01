import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRealtimeSalary } from "./salary-realtime.ts";
import {
  REALTIME_PERSON_EXPORT_HEADERS,
  buildRealtimePersonCsv,
  realtimePersonExportMatrix,
} from "./salary-realtime-export.ts";

describe("realtime person export", () => {
  it("uses the approved columns and writes 0 when subsidy and bonus are absent", () => {
    assert.deepEqual(REALTIME_PERSON_EXPORT_HEADERS, [
      "姓名",
      "底薪",
      "上门",
      "线上",
      "门店",
      "配件",
      "补贴",
      "奖金",
      "失误合计",
      "应发",
    ]);
    const body = buildRealtimeSalary(
      "2026-11",
      [
        {
          person_name: "甲",
          base_amount: 2000,
          door_amount: 10,
          online_amount: 1,
          store_amount: 0,
          accessories_amount: 0,
          gross_amount: 2011,
        },
      ],
      [{ person_name: "甲", mistake_total: 3 }]
    );
    const matrix = realtimePersonExportMatrix(body);
    assert.deepEqual(matrix[0], ["甲", "2000.00", "10.00", "1.00", "0.00", "0.00", "0.00", "0.00", "3.00", "2011.00"]);
    assert.equal(matrix[1][0], "合计");
    assert.equal(matrix[1][8], "3.00");
    assert.equal(matrix[1][9], "2011.00");
    const csv = buildRealtimePersonCsv(body);
    assert.equal(csv.split("\n")[0], REALTIME_PERSON_EXPORT_HEADERS.join(","));
    assert.equal(csv.includes("实发"), false);
    assert.equal(csv.includes("罚款"), false);
  });

  it("exports hand-fill amounts from the loaded response without recomputing them", () => {
    const body = buildRealtimeSalary(
      "2026-11",
      [
        {
          person_name: "张,三",
          base_amount: 100,
          subsidy_amount: 5,
          bonus_amount: 2.5,
          gross_amount: 1,
        },
      ],
      [],
      { handFill: true }
    );
    const csv = buildRealtimePersonCsv(body);
    assert.match(csv, /"张,三",100\.00,0\.00,0\.00,0\.00,0\.00,5\.00,2\.50,0\.00,107\.50/);
  });
});
