import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatCommissionRuleLines } from "./commission-rules.ts";
import { PAYROLL_CALIBER } from "./realtime-payroll.ts";
import {
  REFERENCE_TIER_REWARDS,
  mergeTierRewards,
  parseTierRewards,
} from "./tier-rewards.ts";

describe("tier rewards config", () => {
  it("uses the reference percents and rank amounts when nothing is stored", () => {
    const parsed = parseTierRewards({ online_order_pct: 1, store_tiers: [{ threshold: 30000, pct: 3 }] });
    assert.equal(parsed.configured, false);
    assert.deepEqual(parsed.value, REFERENCE_TIER_REWARDS);
    assert.deepEqual(parsed.value.store_recycle_pct, [2, 3, 4]);
    assert.deepEqual(parsed.value.accessories_pct, [20, 25, 30]);
    assert.equal(parsed.value.online_pct, 0.5);
    assert.deepEqual(parsed.value.rank_recycle, [500, 300, 200]);
    assert.deepEqual(parsed.value.rank_accessories, [300, 200, 100]);
  });

  it("reads a stored tier_rewards object and fills a broken field from the reference", () => {
    const parsed = parseTierRewards({
      tier_rewards: {
        store_recycle_pct: [1, 2, 3],
        accessories_pct: [9],
        online_pct: 0.5,
        rank_recycle: [100, 80, 40],
        rank_accessories: [30, 20, 10],
      },
    });
    assert.equal(parsed.configured, true);
    assert.deepEqual(parsed.value.store_recycle_pct, [1, 2, 3]);
    assert.deepEqual(parsed.value.accessories_pct, [20, 25, 30]);
    assert.equal(parsed.value.online_pct, 0.5);
    assert.deepEqual(parsed.value.rank_recycle, [100, 80, 40]);
    assert.deepEqual(parsed.value.rank_accessories, [30, 20, 10]);
  });

  it("merges into commission_rules without dropping the existing caliber keys", () => {
    const merged = mergeTierRewards(
      {
        online_order_pct: 1,
        store_tiers: [{ threshold: 30000, pct: 3 }],
        door_profit_pct: 50,
      },
      REFERENCE_TIER_REWARDS,
    );
    assert.equal(merged.online_order_pct, 1);
    assert.equal(merged.door_profit_pct, 50);
    assert.deepEqual(merged.store_tiers, [{ threshold: 30000, pct: 3 }]);
    assert.deepEqual(merged.tier_rewards, REFERENCE_TIER_REWARDS);
    assert.deepEqual(parseTierRewards(merged).value, REFERENCE_TIER_REWARDS);
    assert.equal(parseTierRewards(merged).configured, true);
  });

  it("leaves the payroll caliber constants and the human sentences alone", () => {
    assert.equal(PAYROLL_CALIBER.onlinePct, 1);
    assert.deepEqual(PAYROLL_CALIBER.storeTiers, [
      { min: 60000, pct: 4 },
      { min: 30000, pct: 3 },
    ]);
    const lines = formatCommissionRuleLines({
      online_order_pct: 1,
      tier_rewards: REFERENCE_TIER_REWARDS,
    });
    assert.equal(lines.some((line) => line.id === "hidden"), false);
    assert.equal(lines.map((line) => line.body).join("").includes("0.5"), false);
    assert.equal(lines.map((line) => line.body).join("").includes("tier_rewards"), false);
  });
});

describe("salary page tier form", () => {
  it("keeps the tier form and the import fold closed, and does not wire the reserved buttons", () => {
    const page = readFileSync(new URL("../app/(console)/salary/page.tsx", import.meta.url), "utf8");
    const board = readFileSync(new URL("../components/SalaryLiveBoard.tsx", import.meta.url), "utf8");
    assert.match(page, /<summary>阶梯提成与奖励<\/summary>/);
    assert.match(page, /<summary>录入与导入<\/summary>/);
    assert.equal(page.includes("<details open"), false);
    assert.equal(page.includes("SalaryRuleCard"), false);
    assert.match(board, /<button type="button" className="btn btn-ghost" disabled>\s*下载工资表\s*<\/button>/);
    assert.match(board, /<button type="button" className="btn btn-ghost" disabled>\s*录入模板\s*<\/button>/);
    assert.equal(board.includes("createObjectURL"), false);
    assert.equal(board.includes("download="), false);
    assert.equal(board.includes("salary-realtime-export"), false);
  });
});
