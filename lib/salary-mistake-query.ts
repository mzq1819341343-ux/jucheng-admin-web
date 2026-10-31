import type { createClient } from "@/lib/supabase/server";
import {
  MISTAKE_TOTALS_RPC,
  parseMistakeTotalRows,
  type MistakeTotalRow,
} from "@/lib/salary-mistake";

type UserClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 按月汇总失误金额。用当前登录用户的 JWT 调用 security definer
 * salary_mistake_totals：函数只返回 person_name 与 sum(amount)。
 * 不读取 reason / note，也不把明细行查回再剥掉。
 * 店员在路由里先 403；函数本身也拒绝非 owner / partner。
 */
export async function loadMistakeTotals(
  supabase: UserClient,
  month: string
): Promise<{ ok: true; rows: MistakeTotalRow[] } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc(MISTAKE_TOTALS_RPC, { p_month: month });
  if (error) return { ok: false, error: "query failed" };
  const rows = parseMistakeTotalRows(data ?? []);
  if (!rows) return { ok: false, error: "query failed" };
  return { ok: true, rows };
}
