import { NextResponse } from "next/server";
import { dailySalesHttp } from "@/lib/daily-person-store-sales";
import { readSalaryActor } from "@/lib/salary-actor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/ops/daily-person-store-sales/daily?month=YYYY-MM
 * 按日合计。先确认 owner 会话，再用 service role 读表后自行加总。
 * 没有行时 []。不补没有记录的日期。
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
  const result = await dailySalesHttp(request, "daily", { readActor: readSalaryActor });
  return json(result.body, result.status);
}
