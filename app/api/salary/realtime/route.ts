import { NextResponse } from "next/server";
import { readSalaryActor } from "@/lib/salary-actor";
import { loadMistakeTotals } from "@/lib/salary-mistake-query";
import {
  buildRealtimeSalary,
  isYearMonth,
  realtimeReadDecision,
  type SalaryRealtimeDraftRow,
} from "@/lib/salary-realtime";

export const dynamic = "force-dynamic";

/**
 * GET /api/salary/realtime?month=YYYY-MM
 * 草案仍用登录用户 JWT 读 salary_realtime_draft（RLS）。
 * 失误合计调用 security definer salary_mistake_totals，只拿按人 sum。
 * 不 SELECT 事由，不写草案，不读 salary_monthly / salary_detail_import。
 */

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
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

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
    actor.supabase
      .from("salary_realtime_draft")
      .select(
        "person_name, user_id, as_of, base_amount, door_amount, online_amount, store_amount, accessories_amount, gross_amount, deduction_amount, net_amount, caliber"
      )
      .eq("month", month)
      .order("person_name", { ascending: true }),
    loadMistakeTotals(actor.supabase, month),
  ]);

  if (draftResult.error || !mistakeResult.ok) {
    return json({ error: mistakeResult.ok ? "query failed" : mistakeResult.error }, 500);
  }

  return json(
    buildRealtimeSalary(month, (draftResult.data ?? []) as SalaryRealtimeDraftRow[], mistakeResult.rows),
    200
  );
}
