import { int, money2 } from "./format";
import { PAYROLL_CALIBER as CALIBER } from "./realtime-payroll";

/**
 * 把 salary_rules.commission_rules 译成与「工资怎么算」（SalaryRuleCard）同一套中文短句。
 * 工资体系表「提成规则」列共用这里，避免一处改口径、另一处还在吐 JSON。
 *
 * 已知字段（卡上的说法）：
 * - base_breakdown → 底薪（拆分：基础 / 全勤 / 拉新）
 * - online_order_pct → 线上订单提成
 * - store_tiers → 门店提成（订单金额不含券阶梯，取最高达成档）
 * - accessories_tiers → 配件提成
 * - door_profit_pct → 上门提成
 *
 * 空对象、非对象、解析失败 → 空数组，调用方显示「暂无提成细则」。
 * 顶层未知键不展开原文，只加一行「其它规则：已隐藏技术原文」。
 */

export const COMMISSION_RULES_EMPTY = "暂无提成细则";
export const COMMISSION_RULES_HIDDEN = "其它规则：已隐藏技术原文";

const KNOWN_KEYS = new Set([
  "base_breakdown",
  "online_order_pct",
  "store_tiers",
  "accessories_tiers",
  "door_profit_pct",
]);

export type CommissionRuleLine = {
  id: "base" | "online" | "store" | "accessories" | "door" | "hidden";
  /** 含结尾冒号的加粗标签；隐藏行没有标签。 */
  label: string;
  body: string;
  /** 底薪拆分里的说明，展示时包在括号中并降色。 */
  note: string | null;
  muted: boolean;
};

export function commissionRuleLineText(line: CommissionRuleLine): string {
  const note = line.note ? `（${line.note}）` : "";
  return `${line.label}${line.body}${note}`;
}

export function formatCommissionRuleLines(
  commissionRules: unknown,
  baseSalary: number | null = null,
): CommissionRuleLine[] {
  const cr = asRulesObject(commissionRules);
  if (!cr) return [];

  const lines: CommissionRuleLine[] = [];

  const base = asObj(cr.base_breakdown);
  if (base) {
    const basic = asNum(base.basic);
    const attendance = asNum(base.attendance);
    const newCustomer = asNum(base.new_customer);
    const baseTotal =
      baseSalary ??
      (basic !== null || attendance !== null || newCustomer !== null
        ? (basic ?? 0) + (attendance ?? 0) + (newCustomer ?? 0)
        : null);
    lines.push({
      id: "base",
      label: "底薪：",
      body: `全员 ${money2(baseTotal)} 元/月 = 基础 ${money2(basic)} + 全勤 ${money2(attendance)} + 拉新 ${money2(newCustomer)}`,
      note: typeof base.note === "string" ? base.note : null,
      muted: false,
    });
  }

  const onlinePct = asNum(cr.online_order_pct);
  if (onlinePct !== null) {
    lines.push({
      id: "online",
      label: "线上订单提成：",
      body: `${CALIBER.onlineBasis} × ${onlinePct}%`,
      note: null,
      muted: false,
    });
  }

  const storeParts = tierParts(cr.store_tiers, (t) => {
    const th = asNum(t.threshold);
    const p = asNum(t.pct);
    return th !== null && p !== null ? `业绩 ≥ ${int(th)} 元 → ${p}%` : null;
  });
  if (storeParts.length > 0) {
    lines.push({
      id: "store",
      label: `门店提成（${CALIBER.storeBasis}，取最高达成档）：`,
      body: storeParts.join("；"),
      note: null,
      muted: false,
    });
  }

  const accParts = tierParts(cr.accessories_tiers, (t) => {
    const below = asNum(t.below);
    const th = asNum(t.threshold);
    const p = asNum(t.pct);
    if (p === null) return null;
    if (below !== null) return `业绩 < ${int(below)} 元 → ${p}%`;
    if (th !== null) return `业绩 ≥ ${int(th)} 元 → ${p}%`;
    return null;
  });
  if (accParts.length > 0) {
    lines.push({
      id: "accessories",
      label: "配件提成：",
      body: accParts.join("；"),
      note: null,
      muted: false,
    });
  }

  const doorPct = asNum(cr.door_profit_pct);
  if (doorPct !== null) {
    lines.push({
      id: "door",
      label: "上门提成：",
      body: `卖出机子利润的 ${doorPct}%`,
      note: null,
      muted: false,
    });
  }

  if (Object.keys(cr).some((key) => !KNOWN_KEYS.has(key))) {
    lines.push({
      id: "hidden",
      label: "",
      body: COMMISSION_RULES_HIDDEN,
      note: null,
      muted: true,
    });
  }

  return lines;
}

function tierParts(
  value: unknown,
  format: (tier: Record<string, unknown>) => string | null,
): string[] {
  return asArr(value)
    .map(format)
    .filter((part): part is string => part !== null);
}

function asRulesObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return asRulesObject(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return asObj(value);
}

function asNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asObj(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArr(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}
