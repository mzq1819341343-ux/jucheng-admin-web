import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CALIBER_BASE,
  DraftWriteRejected,
  EMPLOYEE_DRAFT_GATE,
  FORBIDDEN_PATCH_KEYS,
  PATCH_KEYS,
  SOURCE_PLACEHOLDER,
  buildBasePatchRequest,
  buildPlaceholderInsertRequest,
  employeeDraftGateOpen,
  readDraftServiceCredentials,
  respondEmployeeDraft,
  runEmployeeDraft,
  type EmployeeDraftIo,
} from "./employee-draft.ts";
import {
  DRAFT_GATE_CLOSED_MESSAGE,
  chooseEmployeeDraftMode,
  draftFollowUpFromResponse,
} from "./employee-draft-ui.ts";

const NOW = new Date("2026-11-02T01:30:00.000Z");
const USER_ID = "00000000-0000-4000-8000-0000000000a1";

function ownerBody(extra: Record<string, unknown> = {}) {
  return {
    mode: "ensure",
    person_name: "示例甲",
    base_salary: "1800",
    work_role: "上门",
    employment_status: "在职",
    user_id: USER_ID,
    month: "2026-11",
    ...extra,
  };
}

function draftRow(extra: Record<string, unknown> = {}) {
  return {
    person_name: "示例甲",
    base_amount: "2000.00",
    door_amount: "10.00",
    online_amount: "1.00",
    store_amount: "2.00",
    accessories_amount: "3.00",
    subsidy_amount: "12.50",
    bonus_amount: "8.00",
    deduction_amount: "4.00",
    gross_amount: "2036.50",
    net_amount: "2032.50",
    source: "realtime_payroll",
    caliber: "realtime_payroll",
    ...extra,
  };
}

function io(partial: Partial<EmployeeDraftIo> & Pick<EmployeeDraftIo, "readDraft">): EmployeeDraftIo & {
  events: unknown[];
} {
  const events: unknown[] = [];
  return {
    events,
    insertPlaceholder: async (row) => {
      events.push(["insert", row]);
    },
    patchBase: async (month, personName, patch) => {
      events.push(["patch", month, personName, patch]);
    },
    ...partial,
    async readDraft(month, personName) {
      events.push(["read", month, personName]);
      return partial.readDraft(month, personName);
    },
  };
}

describe("employee draft gate", () => {
  it("stays closed unless ALLOW_EMPLOYEE_DRAFT_WRITE is true", () => {
    assert.equal(employeeDraftGateOpen({}), false);
    assert.equal(employeeDraftGateOpen({ [EMPLOYEE_DRAFT_GATE]: "false" }), false);
    assert.equal(employeeDraftGateOpen({ [EMPLOYEE_DRAFT_GATE]: "1" }), false);
    assert.equal(employeeDraftGateOpen({ ALLOW_APPLY_REALTIME_DRAFT: "true" }), false);
    assert.equal(employeeDraftGateOpen({ [EMPLOYEE_DRAFT_GATE]: " TRUE " }), true);
  });

  it("returns 未开闸 and does not touch the database", async () => {
    let touched = false;
    const result = await respondEmployeeDraft({
      authenticated: true,
      role: "owner",
      payload: ownerBody(),
      gateOpen: false,
      now: NOW,
      io: {
        readDraft: async () => {
          touched = true;
          return [];
        },
        insertPlaceholder: async () => {
          touched = true;
        },
        patchBase: async () => {
          touched = true;
        },
      },
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.error, "未开闸");
    assert.equal(result.body.code, "gate_closed");
    assert.equal(result.body.wrote, false);
    assert.equal(touched, false);
    const note = draftFollowUpFromResponse(result.status, result.body);
    assert.equal(note.text, DRAFT_GATE_CLOSED_MESSAGE);
    assert.equal(note.text.includes("已写入"), false);
  });

  it("rejects 2026-10 even when the gate is open", async () => {
    let touched = false;
    const result = await respondEmployeeDraft({
      authenticated: true,
      role: "owner",
      payload: ownerBody({ month: "2026-10" }),
      gateOpen: true,
      now: NOW,
      io: {
        readDraft: async () => {
          touched = true;
          return [];
        },
        insertPlaceholder: async () => {
          touched = true;
        },
        patchBase: async () => {
          touched = true;
        },
      },
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 2);
    assert.equal(result.body.wrote, false);
    assert.match(String(result.body.error), /十月禁灌/);
    assert.equal(touched, false);
  });

  it("rejects months before the effective month", async () => {
    const result = await respondEmployeeDraft({
      authenticated: true,
      role: "owner",
      payload: ownerBody({ month: "2026-09" }),
      gateOpen: true,
      now: NOW,
    });
    assert.equal(result.body.code, 2);
    assert.match(String(result.body.error), /早于生效月/);
  });

  it("rejects a body that tries to send subsidy or bonus", async () => {
    const result = await respondEmployeeDraft({
      authenticated: true,
      role: "owner",
      payload: { ...ownerBody(), subsidy_amount: "9.00" },
      gateOpen: true,
      now: NOW,
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.wrote, false);
  });

  it("does not call the database when the gate is open but credentials are missing", async () => {
    const result = await respondEmployeeDraft({
      authenticated: true,
      role: "owner",
      payload: ownerBody(),
      gateOpen: true,
      now: NOW,
      credentialError: new DraftWriteRejected(
        "ALLOW_EMPLOYEE_DRAFT_WRITE=true 与写入请求已同时成立，但缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，未写库",
        1,
      ),
    });
    assert.equal(result.status, 502);
    assert.equal(result.body.wrote, false);
    assert.match(String(result.body.error), /未写库/);
  });

  it("allows only the owner session", async () => {
    const staff = await respondEmployeeDraft({
      authenticated: true,
      role: "staff",
      payload: ownerBody(),
      gateOpen: true,
      now: NOW,
    });
    const partner = await respondEmployeeDraft({
      authenticated: true,
      role: "partner",
      payload: ownerBody(),
      gateOpen: true,
      now: NOW,
    });
    const anon = await respondEmployeeDraft({
      authenticated: false,
      role: null,
      payload: ownerBody(),
      gateOpen: true,
      now: NOW,
    });
    assert.equal(staff.status, 403);
    assert.equal(partner.status, 403);
    assert.equal(anon.status, 401);
    assert.equal(staff.body.wrote, false);
  });
});

describe("employee draft writes", () => {
  it("inserts a placeholder at the table base, including 上门", async () => {
    const store = io({ readDraft: async () => [] });
    const result = await runEmployeeDraft({
      mode: "ensure",
      employee: ownerBody(),
      month: "2026-11",
      now: NOW,
      gateOpen: true,
      io: store,
    });
    assert.equal(result.action, "insert");
    assert.equal(result.wrote, true);
    assert.deepEqual(store.events.map((event) => (event as unknown[])[0]), ["read", "insert"]);
    const row = (store.events[1] as unknown[])[1] as Record<string, string>;
    assert.equal(row.base_amount, "1800.00");
    assert.notEqual(row.base_amount, "0.00");
    assert.equal(row.door_amount, "0.00");
    assert.equal(row.online_amount, "0.00");
    assert.equal(row.store_amount, "0.00");
    assert.equal(row.accessories_amount, "0.00");
    assert.equal(row.subsidy_amount, "0.00");
    assert.equal(row.bonus_amount, "0.00");
    assert.equal(row.deduction_amount, "0.00");
    assert.equal(row.gross_amount, "1800.00");
    assert.equal(row.net_amount, "1800.00");
    assert.equal(row.source, SOURCE_PLACEHOLDER);
    assert.equal(row.caliber, `${CALIBER_BASE}|work_role=上门`);
    assert.equal(row.user_id, USER_ID);
    assert.equal(row.month, "2026-11");
    assert.equal(row.as_of, "2026-11-02T09:30:00+08:00");
  });

  it("does nothing when a draft row already exists", async () => {
    const store = io({
      readDraft: async () => [draftRow({ base_amount: "1500.00", door_amount: "9.00" })],
      insertPlaceholder: async () => {
        throw new Error("should not insert");
      },
    });
    const result = await runEmployeeDraft({
      mode: "ensure",
      employee: ownerBody(),
      month: "2026-11",
      now: NOW,
      gateOpen: true,
      io: store,
    });
    assert.equal(result.action, "skip");
    assert.equal(result.wrote, false);
    assert.equal(result.base_amount, "1500.00");
    assert.equal(result.subsidy_amount, "12.50");
    assert.equal(result.bonus_amount, "8.00");
    assert.equal(result.source, "realtime_payroll");
    assert.deepEqual(store.events.map((event) => (event as unknown[])[0]), ["read"]);
    const note = draftFollowUpFromResponse(200, result);
    assert.equal(note.text.includes("已写入"), false);
  });

  it("patches only base and payable, keeping subsidy and bonus", async () => {
    const store = io({
      readDraft: async () => [draftRow()],
      insertPlaceholder: async () => {
        throw new Error("should not insert");
      },
    });
    const result = await runEmployeeDraft({
      mode: "sync",
      employee: { ...ownerBody(), base_salary: "2500" },
      month: "2026-11",
      now: NOW,
      gateOpen: true,
      io: store,
    });
    assert.equal(result.action, "patch");
    assert.equal(result.wrote, true);
    const patch = (store.events[1] as unknown[])[3] as Record<string, string>;
    assert.deepEqual(Object.keys(patch).sort(), [...PATCH_KEYS].sort());
    for (const key of FORBIDDEN_PATCH_KEYS) assert.equal(key in patch, false);
    assert.equal(patch.base_amount, "2500.00");
    assert.equal(patch.gross_amount, "2536.50");
    assert.equal(patch.net_amount, "2532.50");
    assert.equal(result.subsidy_amount, "12.50");
    assert.equal(result.bonus_amount, "8.00");
  });

  it("placeholders then patches when the row is missing, keeping a raced subsidy", async () => {
    let reads = 0;
    const store = io({
      readDraft: async () => {
        reads += 1;
        if (reads === 1) return [];
        return [
          draftRow({
            base_amount: "0.00",
            door_amount: "0.00",
            online_amount: "0.00",
            store_amount: "0.00",
            accessories_amount: "0.00",
            subsidy_amount: "5.00",
            bonus_amount: "1.00",
            deduction_amount: "0.00",
          }),
        ];
      },
    });
    const result = await runEmployeeDraft({
      mode: "sync",
      employee: { ...ownerBody(), base_salary: "2200" },
      month: "2026-11",
      now: NOW,
      gateOpen: true,
      io: store,
    });
    assert.equal(result.action, "placeholder_then_patch");
    const inserted = (store.events[1] as unknown[])[1] as Record<string, string>;
    const patch = (store.events[3] as unknown[])[3] as Record<string, string>;
    assert.equal(inserted.source, SOURCE_PLACEHOLDER);
    assert.equal(inserted.base_amount, "2200.00");
    assert.equal(inserted.subsidy_amount, "0.00");
    assert.equal("subsidy_amount" in patch, false);
    assert.equal(patch.gross_amount, "2206.00");
    assert.equal(patch.net_amount, "2206.00");
    assert.equal(result.subsidy_amount, "5.00");
    assert.equal(result.bonus_amount, "1.00");
    assert.equal(result.source, "realtime_payroll");
  });

  it("does not placeholder a departed employee, but syncs an existing row", async () => {
    const quiet = io({ readDraft: async () => [] });
    await assert.rejects(
      () =>
        runEmployeeDraft({
          mode: "ensure",
          employee: { ...ownerBody(), employment_status: "离职" },
          month: "2026-11",
          now: NOW,
          gateOpen: true,
          io: quiet,
        }),
      (err: unknown) => err instanceof DraftWriteRejected && err.code === 4,
    );
    assert.equal(quiet.events.length, 0);

    await assert.rejects(
      () =>
        runEmployeeDraft({
          mode: "sync",
          employee: { ...ownerBody(), employment_status: "离职", base_salary: "2100" },
          month: "2026-11",
          now: NOW,
          gateOpen: true,
          io: quiet,
        }),
      (err: unknown) => err instanceof DraftWriteRejected && err.code === 4 && /不占位/.test(err.message),
    );
    assert.equal(quiet.events.length, 1);
    assert.equal((quiet.events[0] as unknown[])[0], "read");

    const sync = io({ readDraft: async () => [draftRow()] });
    const result = await runEmployeeDraft({
      mode: "sync",
      employee: { ...ownerBody(), employment_status: "离职", base_salary: "2100" },
      month: "2026-11",
      now: NOW,
      gateOpen: true,
      io: sync,
    });
    assert.equal(result.action, "patch");
    assert.equal(((sync.events[1] as unknown[])[3] as Record<string, string>).base_amount, "2100.00");
  });

  it("rejects hard-excluded names and missing subsidy columns without writing", async () => {
    await assert.rejects(
      () =>
        runEmployeeDraft({
          mode: "ensure",
          employee: { ...ownerBody(), person_name: "吕文飞" },
          month: "2026-11",
          now: NOW,
          gateOpen: true,
          io: io({ readDraft: async () => [] }),
        }),
      (err: unknown) => err instanceof DraftWriteRejected && err.code === 3,
    );
    const missing = io({
      readDraft: async () => [{ person_name: "示例甲", base_amount: "1.00" }],
      insertPlaceholder: async () => {
        throw new Error("should not insert");
      },
    });
    await assert.rejects(
      () =>
        runEmployeeDraft({
          mode: "ensure",
          employee: ownerBody(),
          month: "2026-11",
          now: NOW,
          gateOpen: true,
          io: missing,
        }),
      (err: unknown) => err instanceof DraftWriteRejected && err.code === 1 && /subsidy_amount/.test(err.message),
    );
  });

  it("refuses to open from the apply gate or a public service key", () => {
    const creds = readDraftServiceCredentials({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "public-should-not-be-used",
      ALLOW_APPLY_REALTIME_DRAFT: "true",
    });
    assert.equal("error" in creds, true);
    const http = readDraftServiceCredentials({
      SUPABASE_URL: "http://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-secret",
    });
    assert.equal("error" in http, true);
  });

  it("builds PostgREST writes that ignore duplicates and omit hand-filled columns", () => {
    const row = {
      month: "2026-11",
      person_name: "示例甲",
      base_amount: "1800.00",
      source: SOURCE_PLACEHOLDER,
    };
    const insert = buildPlaceholderInsertRequest("https://example.supabase.co", "test-secret", row);
    const parsed = new URL(insert.url);
    assert.equal(parsed.pathname, "/rest/v1/salary_realtime_draft");
    assert.equal(parsed.searchParams.get("on_conflict"), "month,person_name");
    assert.equal(insert.method, "POST");
    assert.equal(insert.headers.Prefer, "resolution=ignore-duplicates,return=representation");
    assert.equal(insert.body.includes("merge-duplicates"), false);
    assert.equal(insert.body.includes("test-secret"), false);
    const patch = buildBasePatchRequest("https://example.supabase.co", "test-secret", "2026-11", "示例 甲", {
      base_amount: "2500.00",
      gross_amount: "2536.50",
      net_amount: "2532.50",
      as_of: "2026-11-02T09:30:00+08:00",
      updated_at: "2026-11-02T09:30:00+08:00",
    });
    const patchUrl = new URL(patch.url);
    assert.equal(patch.method, "PATCH");
    assert.equal(patch.headers.Prefer, "return=minimal");
    assert.equal(patchUrl.searchParams.get("month"), "eq.2026-11");
    assert.match(patchUrl.search, /person_name=eq/);
    assert.equal(patchUrl.search.includes("示例"), false);
    const body = JSON.parse(patch.body) as Record<string, string>;
    assert.equal("subsidy_amount" in body, false);
    assert.equal(body.base_amount, "2500.00");
    assert.equal(patch.body.includes("test-secret"), false);
  });
});

describe("roster follow-up", () => {
  it("syncs only after a base change and never calls ensure for a departed save", () => {
    assert.equal(chooseEmployeeDraftMode(null, { base_salary: 1800, employment_status: "在职" }), "ensure");
    assert.equal(chooseEmployeeDraftMode(null, { base_salary: 1800, employment_status: "离职" }), null);
    assert.equal(
      chooseEmployeeDraftMode({ base_salary: 1800 }, { base_salary: 1800, employment_status: "在职" }),
      "ensure",
    );
    assert.equal(
      chooseEmployeeDraftMode({ base_salary: 1800 }, { base_salary: 2100, employment_status: "离职" }),
      "sync",
    );
    assert.equal(
      chooseEmployeeDraftMode({ base_salary: 1800 }, { base_salary: 1800, employment_status: "离职" }),
      null,
    );
  });

  it("does not describe a closed gate as a written draft", () => {
    assert.equal(draftFollowUpFromResponse(409, { error: "未开闸", code: "gate_closed", wrote: false }).text, "占位闸未开");
    assert.match(draftFollowUpFromResponse(502, { error: "占位写库失败 HTTP 401", wrote: false }).text, /^草案未写入：/);
    assert.equal(draftFollowUpFromResponse(200, { ok: true, action: "insert", wrote: true }).text, "已写入当月草案占位");
  });
});

describe("route source", () => {
  it("does not shell out or reuse the apply gate", () => {
    const route = readFileSync(new URL("../app/api/salary/employee-draft/route.ts", import.meta.url), "utf8");
    const client = readFileSync(new URL("./employee-draft-client.ts", import.meta.url), "utf8");
    assert.equal(route.includes("child_process"), false);
    assert.equal(route.includes("python"), false);
    assert.equal(route.includes("ALLOW_APPLY_REALTIME_DRAFT"), false);
    assert.match(route, /employeeDraftGateOpen/);
    assert.equal(client.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(client.includes("salary_realtime_draft"), false);
    assert.equal(client.includes("from(\"salary_realtime_draft\")"), false);
  });
});
