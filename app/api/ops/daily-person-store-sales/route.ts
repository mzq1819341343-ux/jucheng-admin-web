import { NextResponse } from "next/server";
import { dailySalesHttp } from "@/lib/daily-person-store-sales";
import { readSalaryActor } from "@/lib/salary-actor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/ops/daily-person-store-sales?month=YYYY-MM
 * 可选 day / person_name / store_name。人 × 店 × 日明细。
 * 先确认 owner 会话，再用 service role 读 daily_person_store_sales。
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
  const result = await dailySalesHttp(request, "detail", { readActor: readSalaryActor });
  return json(result.body, result.status);
}
