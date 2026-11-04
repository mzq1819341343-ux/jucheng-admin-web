/**
 * 阶梯提成与排名奖励的配置形状。
 * 数字按参考规格做默认值，存进 salary_rules.commission_rules.tier_rewards。
 * 不改计薪口径，也不读 PAYROLL_CALIBER。
 */

export const TIER_REWARDS_KEY = "tier_rewards";

export interface TierRewardsConfig {
  /** 门店回收三档，单位是百分数：2 表示 2% */
  store_recycle_pct: [number, number, number];
  /** 配件三档，单位是百分数 */
  accessories_pct: [number, number, number];
  /** 网单，单位是百分数 */
  online_pct: number;
  /** 回收排名奖励，元，名次从第一到第三 */
  rank_recycle: [number, number, number];
  /** 配件排名奖励，元，名次从第一到第三 */
  rank_accessories: [number, number, number];
}

/** 参考规格。库里还没有 tier_rewards 时表单用这组，保存后以库里的为准。 */
export const REFERENCE_TIER_REWARDS: TierRewardsConfig = {
  store_recycle_pct: [2, 3, 4],
  accessories_pct: [20, 25, 30],
  online_pct: 0.5,
  rank_recycle: [500, 300, 200],
  rank_accessories: [300, 200, 100],
};

export interface ParsedTierRewards {
  /** commission_rules 里已经有 tier_rewards 对象 */
  configured: boolean;
  value: TierRewardsConfig;
}

export function parseTierRewards(commissionRules: unknown): ParsedTierRewards {
  const root = asObj(commissionRules);
  const raw = root ? asObj(root[TIER_REWARDS_KEY]) : null;
  if (!raw) {
    return { configured: false, value: cloneRewards(REFERENCE_TIER_REWARDS) };
  }
  return {
    configured: true,
    value: {
      store_recycle_pct: triple(raw.store_recycle_pct) ?? cloneTriple(REFERENCE_TIER_REWARDS.store_recycle_pct),
      accessories_pct: triple(raw.accessories_pct) ?? cloneTriple(REFERENCE_TIER_REWARDS.accessories_pct),
      online_pct: amount(raw.online_pct) ?? REFERENCE_TIER_REWARDS.online_pct,
      rank_recycle: triple(raw.rank_recycle) ?? cloneTriple(REFERENCE_TIER_REWARDS.rank_recycle),
      rank_accessories: triple(raw.rank_accessories) ?? cloneTriple(REFERENCE_TIER_REWARDS.rank_accessories),
    },
  };
}

/** 把阶梯配置合并进现有提成 JSON，其它键原样留下。 */
export function mergeTierRewards(
  commissionRules: unknown,
  rewards: TierRewardsConfig,
): Record<string, unknown> {
  const base = asObj(commissionRules) ?? {};
  return {
    ...base,
    [TIER_REWARDS_KEY]: cloneRewards(rewards),
  };
}

export function cloneRewards(rewards: TierRewardsConfig): TierRewardsConfig {
  return {
    store_recycle_pct: cloneTriple(rewards.store_recycle_pct),
    accessories_pct: cloneTriple(rewards.accessories_pct),
    online_pct: rewards.online_pct,
    rank_recycle: cloneTriple(rewards.rank_recycle),
    rank_accessories: cloneTriple(rewards.rank_accessories),
  };
}

function cloneTriple(values: readonly [number, number, number]): [number, number, number] {
  return [values[0], values[1], values[2]];
}

function triple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const nums = value.map(amount);
  if (nums.some((item) => item === null)) return null;
  return [nums[0] as number, nums[1] as number, nums[2] as number];
}

function amount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function asObj(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
