import { NextResponse } from "next/server";
import {
  buildRealtimeSalary,
  isYearMonth,
  realtimeReadDecision,
  type SalaryRealtimeDraftRow,
} from "@/lib/salary-realtime";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/salary/realtime?month=YYYY-MM
 * 只读 public.salary_realtime_draft。用登录用户的 JWT（Cookie 会话）查询，RLS 生效。
 * 不使用 service role，未登录时也不做匿名直查。
 * 不写库，也不读 salary_monthly / salary_detail_import。
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
  if (!isSupabaseConfigured()) {
    return json({ error: "unauthenticated" }, 401);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ error: "unauthenticated" }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return json({ error: "role lookup failed" }, 500);
  }

  const role = typeof profile?.role === "string" ? profile.role : null;
  const status = realtimeReadDecision({ month, authenticated: true, role });
  if (status !== 200) {
    // staff 以及其它非 owner/partner 在这里返回 403。禁止改成 people: []。
    return json({ error: "forbidden" }, 403);
  }

  const { data, error } = await supabase
    .from("salary_realtime_draft")
    .select(
      "person_name, user_id, as_of, base_amount, door_amount, online_amount, store_amount, accessories_amount, gross_amount, deduction_amount, net_amount, caliber"
    )
    .eq("month", month)
    .order("person_name", { ascending: true });
  if (error) {
    return json({ error: "query failed" }, 500);
  }

  return json(buildRealtimeSalary(month, (data ?? []) as SalaryRealtimeDraftRow[]), 200);
}
