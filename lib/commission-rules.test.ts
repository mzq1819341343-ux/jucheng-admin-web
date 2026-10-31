import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMISSION_RULES_EMPTY,
  COMMISSION_RULES_HIDDEN,
  commissionRuleLineText,
  formatCommissionRuleLines,
  salaryRuleClientView,
} from "./commission-rules.ts";

const FORBIDDEN = /[{}]|base_breakdown|store_tiers|door_profit_pct|online_order_pct|accessories_tiers|new_customer|JSON\.stringify/;

/** 与 lib/data-finance.ts FALLBACK_SALARY_RULE 同一份口径，避免测试去拉 Next。 */
const FALLBACK_RULES = {
  base_breakdown: {
    basic: 1000,
    attendance: 500,
    new_customer: 500,
    note: "拉新非交口径待工资表模板到后核对，先按老板口述原样记录",
  },
  online_order_pct: 1,
  store_tiers: [
    { threshold: 30000, pct: 3 },
    { threshold: 60000, pct: 4, note: "阶梯取最高达成档" },
  ],
  accessories_tiers: [
    { below: 6500, pct: 20 },
    { threshold: 6500, pct: 30 },
    { threshold: 10000, pct: 40 },
  ],
  door_profit_pct: 50,
};

function texts(rules: unknown, baseSalary: number | null = null): string[] {
  return formatCommissionRuleLines(rules, baseSalary).map(commissionRuleLineText);
}

describe("formatCommissionRuleLines", () => {
  it("renders the fallback rule with the same sentences as the salary card", () => {
    assert.deepEqual(texts(FALLBACK_RULES, 2000), [
      "底薪：全员 2,000.00 元/月 = 基础 1,000.00 + 全勤 500.00 + 拉新 500.00（拉新非交口径待工资表模板到后核对，先按老板口述原样记录）",
      "线上订单提成：非门店 × 1%",
      "门店提成（订单金额不含券阶梯，取最高达成档）：业绩 ≥ 30,000 元 → 3%；业绩 ≥ 60,000 元 → 4%",
      "配件提成：业绩 < 6,500 元 → 20%；业绩 ≥ 6,500 元 → 30%；业绩 ≥ 10,000 元 → 40%",
      "上门提成：卖出机子利润的 50%",
    ]);
    for (const line of texts(FALLBACK_RULES, 2000)) {
      assert.equal(FORBIDDEN.test(line), false, line);
    }
  });

  it("uses base salary when the breakdown has no numbers", () => {
    assert.deepEqual(texts({ base_breakdown: { note: "待补" } }, 1800), [
      "底薪：全员 1,800.00 元/月 = 基础 — + 全勤 — + 拉新 —（待补）",
    ]);
  });

  it("sums the breakdown when base salary is absent", () => {
    assert.deepEqual(
      texts({ base_breakdown: { basic: 1000, attendance: 500, new_customer: 500 } }, null),
      ["底薪：全员 2,000.00 元/月 = 基础 1,000.00 + 全勤 500.00 + 拉新 500.00"],
    );
  });

  it("returns no lines for empty or unparseable rules", () => {
    for (const value of [null, undefined, {}, [], "", "   ", "not-json", "{", 0, "[]", "null", 12]) {
      assert.deepEqual(formatCommissionRuleLines(value, 2000), [], JSON.stringify(value));
    }
    assert.equal(COMMISSION_RULES_EMPTY, "暂无提成细则");
  });

  it("parses a JSON string of a rules object", () => {
    assert.deepEqual(texts('{"online_order_pct":2,"door_profit_pct":50}'), [
      "线上订单提成：非门店 × 2%",
      "上门提成：卖出机子利润的 50%",
    ]);
  });

  it("hides unknown keys in one muted line and never prints their raw values", () => {
    const lines = formatCommissionRuleLines(
      {
        online_order_pct: 1,
        custom_bonus: { rate: 0.5, label: "secret{raw}" },
        store_tiers: "not-an-array",
      },
      null,
    );
    assert.equal(lines.at(-1)?.muted, true);
    assert.equal(lines.at(-1)?.body, COMMISSION_RULES_HIDDEN);
    const joined = lines.map(commissionRuleLineText).join("\n");
    assert.match(joined, /线上订单提成：非门店 × 1%/);
    assert.equal(joined.includes("custom_bonus"), false);
    assert.equal(joined.includes("secret"), false);
    assert.equal(joined.includes("{"), false);
    assert.equal(joined.includes("}"), false);
    assert.equal(joined.includes("store_tiers"), false);
    assert.equal(FORBIDDEN.test(joined), false);
  });

  it("renders the live accessories_pct rule as sentences and never the raw JSON", () => {
    const live = {
      store_tiers: [
        { pct: 3, threshold: 30000 },
        { pct: 4, note: "阶梯取最高达成档", threshold: 60000 },
      ],
      base_breakdown: {
        note: "拉新非交口径待工资表模板到后核对，先按老板口述原样记录",
        basic: 1000,
        attendance: 500,
        new_customer: 500,
      },
      accessories_pct: 30,
      door_profit_pct: 50,
      online_order_pct: 1,
    };
    const raw = JSON.stringify(live);
    assert.match(raw, /store_tiers/);
    assert.match(raw, /accessories_pct/);
    assert.match(raw, /[{}]/);
    const text = texts(live, "2000.00").join("\n");
    assert.match(text, /底薪：全员 2,000\.00 元\/月/);
    assert.match(text, /线上订单提成：非门店 × 1%/);
    assert.match(text, /门店提成（订单金额不含券阶梯，取最高达成档）：业绩 ≥ 30,000 元 → 3%；业绩 ≥ 60,000 元 → 4%/);
    assert.match(text, /配件提成：实付 × 30%/);
    assert.match(text, /上门提成：卖出机子利润的 50%/);
    assert.equal(text.includes(COMMISSION_RULES_HIDDEN), false);
    assert.equal(FORBIDDEN.test(text), false, text);
    for (const key of ["store_tiers", "base_breakdown", "accessories_pct", "door_profit_pct", "online_order_pct", "threshold", "pct"]) {
      assert.equal(text.includes(key), false, key);
    }
  });

  it("drops raw commission_rules before the row crosses to the client", () => {
    const live = {
      store_tiers: [{ pct: 3, threshold: 30000 }],
      base_breakdown: { basic: 1000, attendance: 500, new_customer: 500 },
      accessories_pct: 30,
      door_profit_pct: 50,
      online_order_pct: 1,
    };
    const view = salaryRuleClientView({
      id: "row-1",
      title: "通用工资体系",
      base_salary: "2000.00",
      commission_rules: live,
      note: null,
      effective_from: "2026-10",
      updated_at: "2026-10-26",
    });
    assert.equal("commission_rules" in view, false);
    const blob = JSON.stringify(view);
    const shown = view.commissionLines.map(commissionRuleLineText).join("\n");
    assert.match(shown, /配件提成：实付 × 30%/);
    assert.equal(FORBIDDEN.test(shown), false, shown);
    for (const key of ["store_tiers", "base_breakdown", "accessories_pct", "accessories_tiers", "door_profit_pct", "online_order_pct", "new_customer", "threshold", "pct"]) {
      assert.equal(blob.includes(key), false, key);
      assert.equal(shown.includes(key), false, key);
    }
  });

  it("shows only the hidden line when every key is unknown", () => {
    const lines = formatCommissionRuleLines({ extra: { a: 1 } }, 2000);
    assert.deepEqual(
      lines.map((line) => ({ text: commissionRuleLineText(line), muted: line.muted })),
      [{ text: "其它规则：已隐藏技术原文", muted: true }],
    );
  });

  it("skips tier rows that are missing a percent, and keeps array order", () => {
    assert.deepEqual(
      texts({
        store_tiers: [{ pct: 9 }, { threshold: 1000, pct: 3 }, { threshold: 8000, pct: 5 }],
        accessories_tiers: [
          { threshold: 100, pct: 10 },
          { below: 100, pct: 5 },
          { below: 50 },
        ],
      }),
      [
        "门店提成（订单金额不含券阶梯，取最高达成档）：业绩 ≥ 1,000 元 → 3%；业绩 ≥ 8,000 元 → 5%",
        "配件提成：业绩 ≥ 100 元 → 10%；业绩 < 100 元 → 5%",
      ],
    );
  });
});
