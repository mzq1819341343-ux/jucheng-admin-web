/**
 * 失误扣款编辑是否改过、以及这次跳转算不算离开工资页。
 * 只比较输入快照，不读库、不算工资。
 */

export const MISTAKE_DISCARD_MESSAGE =
  "失误扣款还有未保存的修改，继续会丢掉这些内容。确定放弃？";

export interface MistakeLineSnapshot {
  id: string | null;
  reason: string;
  amount: string;
  note: string;
}

export function mistakeLineSignature(lines: readonly MistakeLineSnapshot[]): string {
  return JSON.stringify(lines.map((line) => [line.id, line.reason, line.amount, line.note]));
}

/** 还在加载、或和上次载入/保存的快照一致时，不算脏。 */
export function mistakeLinesDirty(
  lines: readonly MistakeLineSnapshot[] | null,
  baseline: string | null
): boolean {
  if (!lines || baseline === null) return false;
  return mistakeLineSignature(lines) !== baseline;
}

function salaryPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** 目的地不是 /salary 才算离开。同页哈希、查询不算。跨站算离开。 */
export function navigationLeavesSalary(nextUrl: string, currentHref: string): boolean {
  try {
    const next = new URL(nextUrl, currentHref);
    if (next.origin !== new URL(currentHref).origin) return true;
    return salaryPath(next.pathname) !== "/salary";
  } catch {
    return false;
  }
}
