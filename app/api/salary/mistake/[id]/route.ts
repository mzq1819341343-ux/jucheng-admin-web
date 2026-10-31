import { NextResponse } from "next/server";
import { readSalaryActor } from "@/lib/salary-actor";
import {
  MISTAKE_DETAIL_SELECT,
  amountToDb,
  isUuid,
  mistakeWriteDecision,
  parseMistakePatchBody,
  toMistakeRow,
} from "@/lib/salary-mistake";

export const dynamic = "force-dynamic";

/**
 * PATCH / DELETE /api/salary/mistake/:id
 * 仅 owner。PATCH 只改 reason / amount / note，不改 month / person_name。
 * 不写 salary_realtime_draft。
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
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isUuid(id)) return json({ error: "invalid id" }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (mistakeWriteDecision({ authenticated: true, role: actor.role }) !== 200) {
    return json({ error: "forbidden" }, 403);
  }

  const parsed = parseMistakePatchBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const update: {
    updated_at: string;
    reason?: string;
    amount?: string;
    note?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (parsed.value.reason !== undefined) update.reason = parsed.value.reason;
  if (parsed.value.amount !== undefined) update.amount = amountToDb(parsed.value.amount);
  if (parsed.value.note !== undefined) update.note = parsed.value.note;

  const { data, error } = await actor.supabase
    .from("salary_mistake_deduction")
    .update(update)
    .eq("id", id)
    .select(MISTAKE_DETAIL_SELECT)
    .maybeSingle();
  if (error) return json({ error: "query failed" }, 500);
  if (!data) return json({ error: "not found" }, 404);

  const row = toMistakeRow(data);
  if (!row) return json({ error: "query failed" }, 500);
  return json(row, 200);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isUuid(id)) return json({ error: "invalid id" }, 400);

  const actor = await readSalaryActor();
  if (!actor.ok) return json({ error: actor.error }, actor.status);
  if (mistakeWriteDecision({ authenticated: true, role: actor.role }) !== 200) {
    return json({ error: "forbidden" }, 403);
  }

  const { data, error } = await actor.supabase
    .from("salary_mistake_deduction")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return json({ error: "query failed" }, 500);
  if (!data || data.length === 0) return json({ error: "not found" }, 404);
  return json({ ok: true }, 200);
}
