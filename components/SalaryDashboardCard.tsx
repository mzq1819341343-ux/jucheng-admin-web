"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import { money2 } from "@/lib/format";
import {
  FETCH_JOBS_NOT_READY,
  FETCH_STATUS_RETRY_DELAY_MS,
  fetchJobsLatestPath,
  parseFetchJobLatest,
  shouldRetryFetchStatusRead,
} from "@/lib/fetch-jobs";
import {
  DASHBOARD_AMOUNT_COLUMNS,
  dashboardHeadcount,
  dashboardPersonLine,
  fetchLatestOneLiner,
  type DashboardAmountKey,
} from "@/lib/salary-dashboard";
import {
  ACCESSORIES_SOURCE_NOTE,
  formatShanghaiDateTime,
  isYearMonth,
  shanghaiYearMonth,
  shownAfterDeduction,
  type RealtimeSalaryPerson,
  type RealtimeSalaryResponse,
} from "@/lib/salary-realtime";

/**
 * 工资页顶部仪表盘。只读 GET /api/salary/realtime 与 GET /api/ops/fetch-jobs/latest。
 * 不写 salary_realtime_draft，不下发抓取，不改人效卡的编辑。
 */

type Phase = "loading" | "ready" | "error";

function messageFor(status: number): string {
  if (status === 401) return "未登录，无法读取实时工资草案";
  if (status === 403) return "当前角色无权查看实时工资草案";
  return "实时工资草案读取失败";
}

async function readJson(res: Response): Promise<{ json: boolean; body: unknown }> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) return { json: false, body: null };
  try {
    return { json: true, body: await res.json() };
  } catch {
    return { json: false, body: null };
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal.removeEventListener("abort", finish);
      resolve();
    }, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function amountOf(
  row: Partial<Record<DashboardAmountKey, number | null>>,
  key: DashboardAmountKey,
): number | null | undefined {
  return row[key];
}

export default function SalaryDashboardCard() {
  const [month, setMonth] = useState(shanghaiYearMonth);
  const monthRef = useRef(month);
  monthRef.current = month;
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<RealtimeSalaryResponse | null>(null);
  const [fetchLine, setFetchLine] = useState("正在读取上次抓取");
  const [fetchError, setFetchError] = useState("");

  const loadSalary = useCallback(async (targetMonth: string, signal: AbortSignal) => {
    if (!isYearMonth(targetMonth)) {
      setPhase("error");
      setMessage("请选择月份");
      setPayload(null);
      return;
    }
    try {
      const res = await fetch(`/api/salary/realtime?month=${encodeURIComponent(targetMonth)}`, {
        cache: "no-store",
        signal,
      });
      if (signal.aborted || monthRef.current !== targetMonth) return;
      if (!res.ok) {
        setPhase("error");
        setMessage(messageFor(res.status));
        setPayload(null);
        return;
      }
      const body = (await res.json()) as RealtimeSalaryResponse;
      if (signal.aborted || monthRef.current !== targetMonth) return;
      if (!body || !Array.isArray(body.people) || !body.totals) {
        setPhase("error");
        setMessage("实时工资草案读取失败");
        setPayload(null);
        return;
      }
      setPayload(body);
      setPhase("ready");
    } catch {
      if (signal.aborted) return;
      setPhase("error");
      setMessage("实时工资草案读取失败");
      setPayload(null);
    }
  }, []);

  const loadLatest = useCallback(async (targetMonth: string, signal: AbortSignal) => {
    if (!isYearMonth(targetMonth)) {
      setFetchLine("");
      setFetchError("请选择月份");
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let retry = false;
      try {
        const res = await fetch(fetchJobsLatestPath(targetMonth), { cache: "no-store", signal });
        if (signal.aborted || monthRef.current !== targetMonth) return;
        const parsedBody = await readJson(res);
        if (signal.aborted || monthRef.current !== targetMonth) return;
        const parsed = parseFetchJobLatest(res.status, parsedBody.body, parsedBody.json);
        if (parsed.ok) {
          setFetchError("");
          setFetchLine(fetchLatestOneLiner(parsed.latest));
          return;
        }
        retry = attempt === 0 && shouldRetryFetchStatusRead(res.status);
        if (!retry) {
          setFetchLine("");
          setFetchError(parsed.message);
          return;
        }
      } catch {
        if (signal.aborted) return;
        retry = attempt === 0 && shouldRetryFetchStatusRead(null);
        if (!retry) {
          setFetchLine("");
          setFetchError(FETCH_JOBS_NOT_READY);
          return;
        }
      }
      await pause(FETCH_STATUS_RETRY_DELAY_MS, signal);
      if (signal.aborted || monthRef.current !== targetMonth) return;
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    setMessage("");
    setPayload(null);
    setFetchError("");
    setFetchLine("正在读取上次抓取");
    void loadSalary(month, ctrl.signal);
    void loadLatest(month, ctrl.signal);
    return () => ctrl.abort();
  }, [month, loadSalary, loadLatest]);

  const people = payload?.people ?? [];
  const empty = phase === "ready" && people.length === 0;
  const showPeople = phase === "ready" && payload !== null && people.length > 0;
  const headcount = dashboardHeadcount(people);
  const afterTotal = payload
    ? shownAfterDeduction({
        gross: payload.totals.gross,
        mistake_total: payload.totals.mistake_total,
        after_deduction: payload.totals.after_deduction,
      })
    : 0;

  return (
    <section aria-label="仪表盘" aria-busy={phase === "loading"}>
      <h2 className="section-title salary-head">
        <span className="salary-head-text">仪表盘</span>
        <span className="salary-kind salary-kind-draft">只读</span>
      </h2>
      <div className="form-row">
        <div className="field" style={{ flex: "0 1 220px", marginBottom: 0 }}>
          <label htmlFor="salary-dashboard-month">月份</label>
          <input
            id="salary-dashboard-month"
            type="month"
            value={month}
            onChange={(event) => {
              const next = event.target.value;
              if (!isYearMonth(next)) {
                event.target.value = month;
                return;
              }
              setMonth(next);
            }}
          />
        </div>
      </div>
      <p className="page-desc salary-dashboard-note">
        只读当月实时草案和上次抓取。不写入草案，也不下发抓取。
      </p>
      <div className="salary-dashboard-fetch" aria-live="polite">
        {fetchError ? (
          <p className="empty" role="alert">
            {fetchError}
          </p>
        ) : null}
        {fetchLine ? <p className="page-desc salary-dashboard-note">{fetchLine}</p> : null}
      </div>

      {phase === "loading" ? (
        <div className="skel skel-block" style={{ marginTop: 16 }} aria-hidden="true" />
      ) : null}

      {phase === "error" ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="empty" role="alert">
            {message}
          </p>
        </div>
      ) : null}

      {empty ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="empty">暂无数据</p>
        </div>
      ) : null}

      {showPeople && payload ? (
        <>
          <div className="kpi-row" style={{ marginTop: 16 }}>
            <div className="kpi-card kpi-wide kpi-hero">
              <div className="kpi-label">应发合计（{payload.month}）</div>
              <KpiValue value={money2(payload.totals.gross)} unit="元" />
              <div className="kpi-sub">
                计薪 {headcount} 人
                {payload.as_of ? (
                  <>
                    ｜截至 <time dateTime={payload.as_of}>{formatShanghaiDateTime(payload.as_of)}</time>
                  </>
                ) : null}
              </div>
            </div>
            <KpiCard label="计薪人数" value={String(headcount)} unit="人" sub="有草案行的人数" />
            <KpiCard
              label="失误合计"
              value={money2(payload.totals.mistake_total ?? 0)}
              unit="元"
              sub="本月失误扣款"
            />
            <KpiCard
              label="扣后合计"
              value={money2(afterTotal)}
              unit="元"
              tone={afterTotal < 0 ? "negative" : "default"}
              sub="应发合计 − 失误合计"
            />
          </div>

          <div className="card salary-dashboard-desktop" style={{ marginTop: 16 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>
              按人
            </h3>
            <div className="table-wrap">
              <table className="report salary-dashboard">
                <thead>
                  <tr>
                    <th>姓名</th>
                    {DASHBOARD_AMOUNT_COLUMNS.map((column) => (
                      <th key={column.key} title={column.key === "accessories" ? ACCESSORIES_SOURCE_NOTE : undefined}>
                        {column.label}（元）
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.person_key}>
                      <td>{person.display_name}</td>
                      {DASHBOARD_AMOUNT_COLUMNS.map((column) => (
                        <td key={column.key}>{money2(amountOf(person, column.key))}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total">
                    <td>合计</td>
                    {DASHBOARD_AMOUNT_COLUMNS.map((column) => (
                      <td key={column.key}>{money2(amountOf(payload.totals, column.key))}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="page-desc salary-dashboard-note">{ACCESSORIES_SOURCE_NOTE}</p>
            {payload.caliber ? <p className="page-desc salary-dashboard-note">口径：{payload.caliber}</p> : null}
          </div>

          <div className="card salary-dashboard-mobile" style={{ marginTop: 16 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>
              按人
            </h3>
            <p className="salary-dashboard-total">{dashboardPersonLine("合计", payload.totals.gross)}</p>
            {people.map((person) => (
              <PersonSummary key={person.person_key} person={person} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function PersonSummary({ person }: { person: RealtimeSalaryPerson }) {
  return (
    <details className="salary-dashboard-person">
      <summary>{dashboardPersonLine(person.display_name, person.gross)}</summary>
      <dl className="salary-dashboard-break">
        {DASHBOARD_AMOUNT_COLUMNS.map((column) => (
          <div key={column.key}>
            <dt>{column.label}</dt>
            <dd>{money2(amountOf(person, column.key))}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
