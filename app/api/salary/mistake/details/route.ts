import { NextResponse } from "next/server";
import { readSalaryActor } from "@/lib/salary-actor";
import {
  MISTAKE_DETAIL_SELECT,
  mistakeDetailsDecision,
  parseOptionalPersonName,
  toMistakeRow,
} from "@/lib/salary-mistake";
import { isYearMonth } from "@/lib/salary-realtime";

export const dynamic = "force-dynamic";

/**
 * GET /api/salary/mistake/details?month=YYYY-MM&person_name=
 * 仅 owner。partner / staff 在查询前 403，不返回事由行。
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
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  if (!isYearMonth(month)) {
    return json({ error: "month must match YYYY-MM" }, 400);
  }

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (mistakeDetailsDecision({ month, authenticated: true, role: actor.role }) !== 200) {
    return json({ error: "forbidden" }, 403);
  }

  const person = parseOptionalPersonName(url.searchParams.get("person_name"));
  if (!person.ok) return json({ error: person.error }, 400);

  let query = actor.supabase
    .from("salary_mistake_deduction")
    .select(MISTAKE_DETAIL_SELECT)
    .eq("month", month)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (person.personName) query = query.eq("person_name", person.personName);

  const { data, error } = await query;
  if (error) return json({ error: "query failed" }, 500);

  const rows = [];
  for (const row of data ?? []) {
    const parsed = toMistakeRow(row);
    if (!parsed) return json({ error: "query failed" }, 500);
    rows.push(parsed);
  }
  return json({ month, person_name: person.personName, rows }, 200);
}
