import { NextResponse } from "next/server";
import { readSalaryActor } from "@/lib/salary-actor";
import {
  MISTAKE_DETAIL_SELECT,
  amountToDb,
  mistakeWriteDecision,
  parseMistakeCreateBody,
  toMistakeRow,
} from "@/lib/salary-mistake";
import { isYearMonth } from "@/lib/salary-realtime";

export const dynamic = "force-dynamic";

/**
 * POST /api/salary/mistake
 * 仅 owner 新增一条失误明细。不写 salary_realtime_draft。
 * 允许该月草案里还没有这个人。
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

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const month =
    body && typeof body === "object" && !Array.isArray(body) && "month" in body
      ? (body as { month?: unknown }).month
      : null;
  if (!isYearMonth(typeof month === "string" ? month : null)) {
    return json({ error: "month must match YYYY-MM" }, 400);
  }

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (mistakeWriteDecision({ authenticated: true, role: actor.role }) !== 200) {
    return json({ error: "forbidden" }, 403);
  }

  const parsed = parseMistakeCreateBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { data, error } = await actor.supabase
    .from("salary_mistake_deduction")
    .insert({
      month: parsed.value.month,
      person_name: parsed.value.person_name,
      reason: parsed.value.reason,
      amount: amountToDb(parsed.value.amount),
      note: parsed.value.note,
      created_by: actor.profileId,
    })
    .select(MISTAKE_DETAIL_SELECT)
    .single();
  if (error || !data) return json({ error: "query failed" }, 500);

  const row = toMistakeRow(data);
  if (!row) return json({ error: "query failed" }, 500);
  return json(row, 201);
}
