import { NextResponse } from "next/server";
import { readSalaryActor, type SalaryActor } from "@/lib/salary-actor";
import { loadMistakeTotals } from "@/lib/salary-mistake-query";
import {
  buildRealtimeSalary,
  handFillWriteDecision,
  isMissingHandFillColumn,
  isYearMonth,
  moneyToDb,
  parseHandFillPatchBody,
  payableGrossFromDraft,
  realtimeReadDecision,
  type SalaryRealtimeDraftRow,
} from "@/lib/salary-realtime";

export const dynamic = "force-dynamic";

/**
 * GET /api/salary/realtime?month=YYYY-MM
 * 草案仍用登录用户 JWT 读 salary_realtime_draft（RLS）。
 * 补贴 / 奖金列还没有时退回不含这两列的 select，响应里也不带 subsidy / bonus。
 * 列落地后应发按底薪+上门+线上+门店+配件+补贴+奖金。
 * 失误合计调用 security definer salary_mistake_totals，只拿按人 sum。
 * 不 SELECT 事由，不读 salary_monthly / salary_detail_import。
 *
 * PATCH 只给 owner，只写 subsidy_amount、bonus_amount，以及同一公式得到的 gross_amount。
 * 不改底薪和各项提成，不改 deduction_amount / net_amount，也不清掉已手填的补贴奖金。
 */

const DRAFT_SELECT =
  "person_name, user_id, as_of, base_amount, door_amount, online_amount, store_amount, accessories_amount, gross_amount, deduction_amount, net_amount, caliber";
const DRAFT_SELECT_HAND = `${DRAFT_SELECT}, subsidy_amount, bonus_amount`;
const HAND_WRITE_SELECT =
  "base_amount, door_amount, online_amount, store_amount, accessories_amount";

type SalarySupabase = Extract<SalaryActor, { ok: true }>["supabase"];

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function methodNotAllowed() {
  return json({ error: "method not allowed" }, 405);
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;

async function loadDraft(supabase: SalarySupabase, month: string) {
  const extended = await supabase
    .from("salary_realtime_draft")
    .select(DRAFT_SELECT_HAND)
    .eq("month", month)
    .order("person_name", { ascending: true });
  if (!extended.error) {
    return {
      ok: true as const,
      rows: (extended.data ?? []) as SalaryRealtimeDraftRow[],
      handFill: true,
    };
  }
  if (!isMissingHandFillColumn(extended.error)) return { ok: false as const };
  const plain = await supabase
    .from("salary_realtime_draft")
    .select(DRAFT_SELECT)
    .eq("month", month)
    .order("person_name", { ascending: true });
  if (plain.error) return { ok: false as const };
  return {
    ok: true as const,
    rows: (plain.data ?? []) as SalaryRealtimeDraftRow[],
    handFill: false,
  };
}

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (!isYearMonth(month)) {
    return json({ error: "month must match YYYY-MM" }, 400);
  }

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);

  const status = realtimeReadDecision({ month, authenticated: true, role: actor.role });
  if (status !== 200) {
    // staff 以及其它非 owner/partner 在这里返回 403。禁止改成 people: []。
    // 403 发生在任何草案或失误查询之前。
    return json({ error: "forbidden" }, 403);
  }

  const [draftResult, mistakeResult] = await Promise.all([
    loadDraft(actor.supabase, month),
    loadMistakeTotals(actor.supabase, month),
  ]);

  if (!draftResult.ok || !mistakeResult.ok) {
    return json({ error: mistakeResult.ok ? "query failed" : mistakeResult.error }, 500);
  }

  return json(
    buildRealtimeSalary(month, draftResult.rows, mistakeResult.rows, { handFill: draftResult.handFill }),
    200
  );
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = parseHandFillPatchBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (handFillWriteDecision({ authenticated: true, role: actor.role }) !== 200) {
    return json({ error: "forbidden" }, 403);
  }

  const existing = await actor.supabase
    .from("salary_realtime_draft")
    .select(HAND_WRITE_SELECT)
    .eq("month", parsed.value.month)
    .eq("person_name", parsed.value.person_name)
    .maybeSingle();
  if (existing.error) {
    if (isMissingHandFillColumn(existing.error)) return json({ error: "hand fill unavailable" }, 409);
    return json({ error: "query failed" }, 500);
  }
  if (!existing.data) return json({ error: "not found" }, 404);

  const gross = payableGrossFromDraft(existing.data as SalaryRealtimeDraftRow, parsed.value.subsidy, parsed.value.bonus);
  // 只更新手填的两列和应发。以后若在这里重算，也不能把 subsidy_amount / bonus_amount 覆盖成 0。
  const updated = await actor.supabase
    .from("salary_realtime_draft")
    .update({
      subsidy_amount: moneyToDb(parsed.value.subsidy),
      bonus_amount: moneyToDb(parsed.value.bonus),
      gross_amount: moneyToDb(gross),
    })
    .eq("month", parsed.value.month)
    .eq("person_name", parsed.value.person_name)
    .select("person_name")
    .maybeSingle();
  if (updated.error) {
    if (isMissingHandFillColumn(updated.error)) return json({ error: "hand fill unavailable" }, 409);
    return json({ error: "query failed" }, 500);
  }
  if (!updated.data) return json({ error: "query failed" }, 500);

  return json(
    {
      month: parsed.value.month,
      person_name: parsed.value.person_name,
      subsidy: parsed.value.subsidy,
      bonus: parsed.value.bonus,
      gross,
    },
    200
  );
}
