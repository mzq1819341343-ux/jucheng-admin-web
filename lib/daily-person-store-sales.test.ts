import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  SalesReadError,
  buildReadUrl,
  dailySalesHttp,
  dailySalesReadDecision,
  dailyTotals,
  formatMoney,
  parseDay,
  parseJsonPreserveDecimals,
  parseMonth,
  personStoreDays,
  presentDailySales,
  readDailySalesForOwner,
  trendGeometry,
  trendSeries,
  type DetailRow,
  type ReadSpec,
  type SalesTransport,
} from "./daily-person-store-sales.ts";

const STAMP = "2026-11-08T18:00:00+08:00";

function rawRow(
  day: string,
  person: string,
  store: string,
  storeAmt: string | number,
  online: string | number,
  accessories: string | number,
  old: number | null = null,
  acc: number | null = null,
  month?: string,
) {
  return {
    day,
    month: month ?? day.slice(0, 7),
    person_name: person,
    store_name: store,
    recycle_store_amount: storeAmt,
    recycle_online_amount: online,
    accessories_sales: accessories,
    n_old_machine: old,
    n_accessories: acc,
    updated_at: STAMP,
    id: "should-not-leak",
  };
}

function sourceRows(): ReturnType<typeof rawRow>[] {
  return [
    rawRow("2026-11-02", "示例甲", "示例店", "10.10", "5.02", "0.47"),
    rawRow("2026-11-01", "示例乙", "示例店", "50", "0", "0", 1, 0),
    rawRow("2026-11-01", "示例甲", "另一店", "1.00", "2.00", "3.00", 4, 5),
    rawRow("2026-11-01", "示例甲", "示例店", "100.50", "20.00", "1.25", 2, 1),
  ];
}

describe("daily sales money and dates", () => {
  it("keeps two decimal places and rejects a bad month or day", async () => {
    assert.equal(formatMoney("2925.72"), "2925.72");
    assert.equal(formatMoney("60160"), "60160.00");
    assert.equal(formatMoney("190225.00"), "190225.00");
    assert.equal(formatMoney("1.005"), "1.01");
    assert.equal(formatMoney("-1.005"), "-1.01");
    assert.equal(parseMonth("2026-13"), null);
    assert.equal(parseMonth("202611"), null);
    assert.equal(parseMonth("2026-11"), "2026-11");
    assert.equal(parseDay("2026-02-29"), null);
    assert.equal(parseDay("2024-02-29"), "2024-02-29");
    await assert.rejects(
      () => personStoreDays("2026-11", "2026-12-01", null, null, { rowSource: () => [] }),
      (error: unknown) => error instanceof SalesReadError && /month/.test(error.message),
    );
  });

  it("preserves decimal text from a JSON number token", () => {
    const parsed = parseJsonPreserveDecimals('[{"recycle_store_amount":2925.72,"n_old_machine":2,"n_accessories":null}]');
    assert.equal((parsed as { recycle_store_amount: string }[])[0].recycle_store_amount, "2925.72");
    assert.equal((parsed as { n_old_machine: string }[])[0].n_old_machine, "2");
  });
});

describe("daily sales aggregation", () => {
  it("sums by day in ascending order and drops id", async () => {
    const totals = await dailyTotals("2026-11", { rowSource: sourceRows });
    assert.deepEqual(totals, [
      {
        day: "2026-11-01",
        recycle_store_amount: "151.50",
        recycle_online_amount: "22.00",
        accessories_sales: "4.25",
      },
      {
        day: "2026-11-02",
        recycle_store_amount: "10.10",
        recycle_online_amount: "5.02",
        accessories_sales: "0.47",
      },
    ]);
    assert.equal("person_name" in totals[0], false);
    assert.equal("id" in totals[0], false);
  });

  it("sorts detail by day, person, store code points and filters exactly", async () => {
    const detail = await personStoreDays("2026-11", null, null, null, { rowSource: sourceRows });
    assert.deepEqual(
      detail.map((row) => row.person_name + row.store_name),
      ["示例乙示例店", "示例甲另一店", "示例甲示例店", "示例甲示例店"],
    );
    assert.deepEqual(detail.map((row) => row.day), ["2026-11-01", "2026-11-01", "2026-11-01", "2026-11-02"]);
    assert.equal("id" in detail[0], false);
    assert.equal(detail[2].n_old_machine, 2);
    assert.equal(detail[2].n_accessories, 1);
    const filtered = await personStoreDays("2026-11", "2026-11-01", "示例甲", "示例店", { rowSource: sourceRows });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].recycle_store_amount, "100.50");
    assert.deepEqual(await personStoreDays("2026-11", null, "没有的人", null, { rowSource: sourceRows }), []);
  });

  it("rejects a row whose month does not match the query", async () => {
    await assert.rejects(
      () => dailyTotals("2026-11", { rowSource: () => [rawRow("2026-10-01", "示例甲", "示例店", "1", "1", "1", null, null, "2026-10")] }),
      (error: unknown) => error instanceof SalesReadError && /月份/.test(error.message),
    );
  });

  it("ranks store recycle, person recycle, and accessories sales without using commission", () => {
    const detail: DetailRow[] = [
      rawRow("2026-11-01", "甲", "万达", "10.00", "100.00", "100.00"),
      rawRow("2026-11-02", "乙", "友谊", "40.00", "1.00", "3.00"),
      rawRow("2026-11-03", "甲", "友谊", "5.00", "0.50", "0.00"),
    ].map((row) => ({
      day: row.day,
      month: "2026-11",
      person_name: row.person_name,
      store_name: row.store_name,
      recycle_store_amount: formatMoney(row.recycle_store_amount),
      recycle_online_amount: formatMoney(row.recycle_online_amount),
      accessories_sales: formatMoney(row.accessories_sales),
      n_old_machine: null,
      n_accessories: null,
      updated_at: null,
    }));
    const normalized = presentDailySales(detail, null);
    assert.deepEqual(normalized.storeRecycle, [
      { name: "友谊", amount: "45.00" },
      { name: "万达", amount: "10.00" },
    ]);
    assert.deepEqual(normalized.personRecycle, [
      { name: "甲", amount: "115.50" },
      { name: "乙", amount: "41.00" },
    ]);
    assert.deepEqual(normalized.personAccessories, [
      { name: "甲", amount: "100.00" },
      { name: "乙", amount: "3.00" },
    ]);
    assert.notEqual(normalized.personAccessories[0].amount, "30.00");
    const tied = presentDailySales(
      [
        {
          day: "2026-11-01",
          month: "2026-11",
          person_name: "甲",
          store_name: "店",
          recycle_store_amount: "1.00",
          recycle_online_amount: "0.00",
          accessories_sales: "0.00",
          n_old_machine: null,
          n_accessories: null,
          updated_at: null,
        },
        {
          day: "2026-11-01",
          month: "2026-11",
          person_name: "乙",
          store_name: "店",
          recycle_store_amount: "1.00",
          recycle_online_amount: "0.00",
          accessories_sales: "0.00",
          n_old_machine: null,
          n_accessories: null,
          updated_at: null,
        },
      ],
      null,
    );
    assert.deepEqual(tied.personRecycle.map((row) => row.name), ["乙", "甲"]);
    const scoped = presentDailySales(
      [
        {
          day: "2026-11-01",
          month: "2026-11",
          person_name: "甲",
          store_name: "示例店",
          recycle_store_amount: "8.00",
          recycle_online_amount: "0.00",
          accessories_sales: "1.00",
          n_old_machine: null,
          n_accessories: null,
          updated_at: null,
        },
        {
          day: "2026-11-01",
          month: "2026-11",
          person_name: "乙",
          store_name: "另一店",
          recycle_store_amount: "9.00",
          recycle_online_amount: "0.00",
          accessories_sales: "2.00",
          n_old_machine: null,
          n_accessories: null,
          updated_at: null,
        },
      ],
      "示例店",
    );
    assert.equal(scoped.daily.length, 1);
    assert.equal(scoped.recycleStoreTotal, "8.00");
    assert.deepEqual(scoped.storeRecycle.map((row) => row.name), ["示例店"]);
  });
});

describe("daily sales trend gaps", () => {
  it("does not invent zero for a day with no row", () => {
    const series = trendSeries("2026-11", [
      {
        day: "2026-11-02",
        recycle_store_amount: "10.00",
        recycle_online_amount: "0.00",
        accessories_sales: "0.00",
      },
    ], "recycle_store_amount");
    assert.equal(series.length, 30);
    assert.equal(series[0].amount, null);
    assert.equal(series[1].amount, 10);
    assert.equal(series.filter((point) => point.amount === 0).length, 0);
    assert.deepEqual(trendSeries("2026-11", [], "accessories_sales"), []);
    assert.deepEqual(trendSeries("2026-13", [{
      day: "2026-11-02",
      recycle_store_amount: "1.00",
      recycle_online_amount: "0.00",
      accessories_sales: "0.00",
    }], "recycle_store_amount"), []);
  });

  it("breaks the line at an empty day and still plots a real zero", () => {
    const points = [
      { day: "2026-11-01", amount: 10 },
      { day: "2026-11-02", amount: null },
      { day: "2026-11-03", amount: 30 },
      { day: "2026-11-04", amount: 0 },
    ];
    const geo = trendGeometry(points);
    assert.deepEqual(geo.dots.map((dot) => dot.day), ["2026-11-01", "2026-11-03", "2026-11-04"]);
    assert.equal(geo.segments.length, 1);
    assert.equal(geo.segments[0].startsWith(`${geo.dots[1].x.toFixed(1)},`), true);
  });
});

describe("daily sales postgrest pages", () => {
  it("quotes names and keeps the service key out of the url", () => {
    const spec: ReadSpec = { month: "2026-11", day: null, personName: "示例,甲", storeName: '店"A' };
    const url = buildReadUrl("https://example.supabase.co", spec, 1000, 0);
    assert.equal(new URL(url).pathname, "/rest/v1/daily_person_store_sales");
    assert.equal(new URL(url).searchParams.get("month"), "eq.2026-11");
    assert.equal(new URL(url).searchParams.get("person_name"), 'eq."示例,甲"');
    assert.equal(new URL(url).searchParams.get("store_name"), 'eq."店""A"');
    assert.equal(url.includes("test-service-role"), false);
    assert.throws(() => buildReadUrl("http://example.supabase.co", spec, 1, 0), SalesReadError);
    assert.throws(() => buildReadUrl("https://example.supabase.co/rest/v1", spec, 1, 0), SalesReadError);
    assert.throws(() => buildReadUrl("https://user:pass@example.supabase.co", spec, 1, 0), SalesReadError);
  });

  it("follows Content-Range until the total is complete", async () => {
    const pages: number[] = [];
    const body = [
      rawRow("2026-11-01", "示例甲", "示例店", "0.10", "0.20", "0.30", 1, 2),
      rawRow("2026-11-02", "示例乙", "示例店", "0.40", "0.50", "0.60"),
      rawRow("2026-11-03", "示例甲", "示例店", "1.00", "1.00", "1.00", 3, 4),
    ];
    const transport: SalesTransport = async (method, url, headers) => {
      assert.equal(method, "GET");
      assert.equal(headers.apikey, "alias-key");
      assert.equal(headers.Authorization, "Bearer alias-key");
      assert.equal(headers.Prefer, "count=exact");
      assert.equal(url.includes("alias-key"), false);
      const parsed = new URL(url);
      assert.equal(parsed.pathname, "/rest/v1/daily_person_store_sales");
      assert.equal(parsed.searchParams.get("month"), "eq.2026-11");
      assert.equal(parsed.searchParams.get("person_name"), null);
      const offset = Number(parsed.searchParams.get("offset"));
      const limit = Number(parsed.searchParams.get("limit"));
      const page = body.slice(offset, offset + limit);
      pages.push(offset);
      const end = page.length === 0 ? offset : offset + page.length - 1;
      const contentRange = page.length === 0 ? "*/0" : `${offset}-${end}/${body.length}`;
      return { status: 200, raw: JSON.stringify(page), contentRange };
    };
    const summed = await dailyTotals("2026-11", {
      env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/", SUPABASE_SERVICE_ROLE: "alias-key" },
      transport,
      pageSize: 2,
    });
    assert.deepEqual(pages, [0, 2]);
    assert.equal(summed[0].recycle_store_amount, "0.10");
    assert.equal(summed[1].accessories_sales, "0.60");
    assert.equal(summed[2].recycle_online_amount, "1.00");
  });

  it("rejects a short page that does not reach Content-Range and a stalled page", async () => {
    const stalled: SalesTransport = async () => ({
      status: 200,
      raw: JSON.stringify([rawRow("2026-11-01", "示例甲", "示例店", "1", "1", "1")]),
      contentRange: null,
    });
    await assert.rejects(
      () => dailyTotals("2026-11", {
        env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
        transport: stalled,
        pageSize: 1,
      }),
      /分页没有前进/,
    );
    const truncated: SalesTransport = async () => ({
      status: 200,
      raw: JSON.stringify([rawRow("2026-11-01", "示例甲", "示例店", "1", "1", "1")]),
      contentRange: "0-0/4",
    });
    await assert.rejects(
      () => dailyTotals("2026-11", {
        env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
        transport: truncated,
        pageSize: 2,
      }),
      /分页被截断/,
    );
  });

  it("does not follow redirects or leak an error body", async () => {
    const redirected: SalesTransport = async () => ({ status: 302, raw: "", contentRange: null });
    await assert.rejects(
      () => personStoreDays("2026-11", null, null, null, {
        env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
        transport: redirected,
      }),
      /跳转/,
    );
    const broken: SalesTransport = async () => ({ status: 200, raw: "{", contentRange: null });
    await assert.rejects(
      () => dailyTotals("2026-11", {
        env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
        transport: broken,
      }),
      /不是 JSON|不是数组/,
    );
    const denied: SalesTransport = async () => ({ status: 401, raw: '{"message":"no"}', contentRange: null });
    await assert.rejects(
      () => dailyTotals("2026-11", {
        env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
        transport: denied,
      }),
      (error: unknown) => error instanceof SalesReadError && error.message.includes("HTTP 401") && !error.message.includes("no"),
    );
  });
});

describe("daily sales http gate", () => {
  it("rejects a bad month before the session check", () => {
    assert.equal(dailySalesReadDecision({ month: "2026-1", authenticated: false, role: null }), 400);
    assert.equal(dailySalesReadDecision({ month: "2026-11", authenticated: false, role: "owner" }), 401);
    assert.equal(dailySalesReadDecision({ month: "2026-11", authenticated: true, role: "staff" }), 403);
    assert.equal(dailySalesReadDecision({ month: "2026-11", authenticated: true, role: "partner" }), 403);
    assert.equal(dailySalesReadDecision({ month: "2026-11", authenticated: true, role: "owner" }), 200);
  });

  it("does not read the table until the caller is the owner", async () => {
    let actorCalled = false;
    const badMonth = await dailySalesHttp(new Request("https://web.local/api/ops/daily-person-store-sales/daily?month=2026-13"), "daily", {
      readActor: async () => {
        actorCalled = true;
        return { ok: true, role: "owner" };
      },
    });
    assert.equal(badMonth.status, 400);
    assert.equal(actorCalled, false);

    let queried = false;
    const transport: SalesTransport = async () => {
      queried = true;
      return { status: 200, raw: "[]", contentRange: "*/0" };
    };
    const staff = await dailySalesHttp(new Request("https://web.local/api/ops/daily-person-store-sales?month=2026-11"), "detail", {
      readActor: async () => ({ ok: true, role: "staff" }),
      transport,
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    });
    assert.equal(staff.status, 403);
    assert.equal(queried, false);
    const anon = await dailySalesHttp(new Request("https://web.local/api/ops/daily-person-store-sales/daily?month=2026-11"), "daily", {
      readActor: async () => ({ ok: false, status: 401, error: "unauthenticated" }),
      transport,
    });
    assert.equal(anon.status, 401);
    const badDay = await dailySalesHttp(
      new Request("https://web.local/api/ops/daily-person-store-sales?month=2026-11&day=2026-12-01"),
      "detail",
      { readActor: async () => ({ ok: true, role: "owner" }), transport },
    );
    assert.equal(badDay.status, 400);
    assert.equal(queried, false);

    const owner = await dailySalesHttp(new Request("https://web.local/api/ops/daily-person-store-sales/daily?month=2026-11"), "daily", {
      readActor: async () => ({ ok: true, role: "owner" }),
      transport: async () => ({
        status: 200,
        raw: JSON.stringify([rawRow("2026-11-01", "示例甲", "示例店", "1.00", "2.00", "3.00")]),
        contentRange: "0-0/1",
      }),
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    });
    assert.equal(owner.status, 200);
    assert.deepEqual(owner.body, [{
      day: "2026-11-01",
      recycle_store_amount: "1.00",
      recycle_online_amount: "2.00",
      accessories_sales: "3.00",
    }]);

    const missing = await dailySalesHttp(new Request("https://web.local/api/ops/daily-person-store-sales/daily?month=2026-11"), "daily", {
      readActor: async () => ({ ok: true, role: "owner" }),
      env: {},
      transport,
    });
    assert.equal(missing.status, 503);
  });

  it("does not query when the overview reader is not the owner", async () => {
    let queried = false;
    const blocked = await readDailySalesForOwner({
      role: "partner",
      month: "2026-11",
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
      transport: async () => {
        queried = true;
        return { status: 200, raw: "[]", contentRange: "*/0" };
      },
    });
    assert.deepEqual(blocked, { ok: false, reason: "forbidden" });
    assert.equal(queried, false);
    const empty = await readDailySalesForOwner({
      role: "owner",
      month: "2026-11",
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
      transport: async () => ({ status: 200, raw: "[]", contentRange: "*/0" }),
    });
    assert.deepEqual(empty, { ok: true, detail: [] });
  });
});

describe("daily sales source guard", () => {
  it("does not touch salary gates, targets, or a desktop fixture", () => {
    const lib = readFileSync(new URL("./daily-person-store-sales.ts", import.meta.url), "utf8");
    const dailyRoute = readFileSync(new URL("../app/api/ops/daily-person-store-sales/daily/route.ts", import.meta.url), "utf8");
    const detailRoute = readFileSync(new URL("../app/api/ops/daily-person-store-sales/route.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../app/(console)/page.tsx", import.meta.url), "utf8");
    const chart = readFileSync(new URL("../components/DailySalesChart.tsx", import.meta.url), "utf8");
    for (const source of [lib, dailyRoute, detailRoute, chart]) {
      for (const token of [
        "ALLOW_EMPLOYEE_DRAFT_WRITE",
        "ALLOW_APPLY_REALTIME_DRAFT",
        "monthly_sales_targets",
        "salary_realtime_draft",
        "Desktop",
        "0.3",
      ]) {
        assert.equal(source.includes(token), false, token);
      }
    }
    assert.match(dailyRoute, /readSalaryActor/);
    assert.match(detailRoute, /readSalaryActor/);
    assert.equal(dailyRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(detailRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(chart.includes("use client"), false);
    assert.equal(page.includes("销售额未接通"), false);
    assert.match(page, /readDailySalesForOwner/);
    assert.match(page, /accessories_sales/);
    assert.equal(page.includes("0.3"), false);
  });
});
