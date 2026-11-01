import { NextResponse } from "next/server";
import {
  DraftWriteRejected,
  employeeDraftGateOpen,
  readDraftServiceCredentials,
  respondEmployeeDraft,
} from "@/lib/employee-draft";
import { createPostgrestDraftIo } from "@/lib/employee-draft-postgrest";
import { readSalaryActor } from "@/lib/salary-actor";

export const dynamic = "force-dynamic";

/**
 * POST /api/salary/employee-draft
 * 老板会话在 employees 已保存之后调用。只写当月 salary_realtime_draft。
 * 闸是 ALLOW_EMPLOYEE_DRAFT_WRITE，默认关。不看灌数闸，不跑子进程。
 * service role 只留在这个服务端请求里。
 */

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function methodNotAllowed() {
  return json({ error: "method not allowed", wrote: false }, 405);
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid json", wrote: false }, 400);
  }

  const actor = await readSalaryActor();
  const owner = actor.ok && actor.role === "owner";
  const gateOpen = owner ? employeeDraftGateOpen(process.env) : false;
  let io: ReturnType<typeof createPostgrestDraftIo> | undefined;
  let credentialError: DraftWriteRejected | undefined;
  if (gateOpen) {
    const creds = readDraftServiceCredentials(process.env);
    if ("error" in creds) credentialError = creds.error;
    else io = createPostgrestDraftIo(creds);
  }

  const result = await respondEmployeeDraft({
    authenticated: actor.ok,
    role: actor.ok ? actor.role : null,
    authStatus: actor.ok ? undefined : actor.status,
    authError: actor.ok ? undefined : actor.error,
    payload,
    gateOpen,
    io,
    credentialError,
  });
  return json(result.body, result.status);
}
