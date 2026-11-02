"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FETCH_JOBS_CREATE_PATH,
  FETCH_JOBS_NOT_READY,
  FETCH_STATUS_RETRY_DELAY_MS,
  dedupeFetchJobMessages,
  fetchJobCreateBody,
  fetchJobsLatestPath,
  fetchLegLabel,
  parseFetchJobCreate,
  parseFetchJobLatest,
  shouldRetryFetchStatusRead,
  type FetchJobLatest,
  type FetchJobScope,
} from "@/lib/fetch-jobs";
import { formatShanghaiDateTime, isYearMonth, shanghaiYearMonth } from "@/lib/salary-realtime";

/**
 * 工资页「数据抓取」。只下发 POST /api/ops/fetch-jobs，状态只读 GET latest。
 * 不写 salary_realtime_draft，不调用上传或落库。接口没有按契约应答时提示未就绪。
 */

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

export default function FetchJobsCard({ role }: { role: "owner" | "partner" }) {
  const canDispatch = role === "owner";
  const [month, setMonth] = useState(shanghaiYearMonth);
  const monthRef = useRef(month);
  monthRef.current = month;
  const [latest, setLatest] = useState<FetchJobLatest | null>(null);
  const [statusMessage, setStatusMessage] = useState("正在读取上次抓取");
  const [statusError, setStatusError] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [dispatchError, setDispatchError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadLatest = useCallback(async (targetMonth: string, signal: AbortSignal) => {
    if (!isYearMonth(targetMonth)) {
      setLatest(null);
      setStatusError("请选择月份");
      setStatusMessage("");
      return;
    }
    setStatusError("");
    setStatusMessage("正在读取上次抓取");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let retry = false;
      try {
        const res = await fetch(fetchJobsLatestPath(targetMonth), { cache: "no-store", signal });
        if (signal.aborted) return;
        const parsedBody = await readJson(res);
        if (signal.aborted) return;
        if (monthRef.current !== targetMonth) return;
        const parsed = parseFetchJobLatest(res.status, parsedBody.body, parsedBody.json);
        if (parsed.ok) {
          setLatest(parsed.latest);
          setStatusError("");
          setStatusMessage(parsed.latest.empty ? "这个月还没有抓取记录。" : "");
          return;
        }
        retry = attempt === 0 && shouldRetryFetchStatusRead(res.status);
        if (!retry) {
          setLatest(null);
          setStatusMessage("");
          setStatusError(parsed.message);
          return;
        }
      } catch {
        if (signal.aborted) return;
        retry = attempt === 0 && shouldRetryFetchStatusRead(null);
        if (!retry) {
          setLatest(null);
          setStatusMessage("");
          setStatusError(FETCH_JOBS_NOT_READY);
          return;
        }
      }
      await pause(FETCH_STATUS_RETRY_DELAY_MS, signal);
      if (signal.aborted || monthRef.current !== targetMonth) return;
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadLatest(month, ctrl.signal);
    return () => ctrl.abort();
  }, [month, loadLatest]);

  async function dispatch(scope: FetchJobScope) {
    if (!canDispatch || busy) return;
    if (!isYearMonth(month)) {
      setDispatchError("请选择月份");
      setDispatchMessage("");
      return;
    }
    setBusy(true);
    setDispatchError("");
    setDispatchMessage("");
    try {
      const res = await fetch(FETCH_JOBS_CREATE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fetchJobCreateBody(month, scope)),
      });
      const parsedBody = await readJson(res);
      const parsed = parseFetchJobCreate(res.status, parsedBody.body, parsedBody.json);
      if (!parsed.ok) {
        setDispatchError(parsed.message);
        return;
      }
      setDispatchMessage(`已下发，任务号 ${parsed.jobId}`);
      const ctrl = new AbortController();
      await loadLatest(month, ctrl.signal);
    } catch {
      setDispatchError(FETCH_JOBS_NOT_READY);
    } finally {
      setBusy(false);
    }
  }

  const when = latest?.at ? formatShanghaiDateTime(latest.at) : null;
  const alerts = dedupeFetchJobMessages(dispatchError, statusError);

  return (
    <section aria-label="数据抓取" aria-busy={busy}>
      <h2 className="section-title salary-head">
        <span className="salary-head-text">数据抓取</span>
        <span className="salary-kind salary-kind-draft">只下发任务</span>
      </h2>
      <div className="card">
        <p className="page-desc" style={{ marginTop: 0 }}>
          {canDispatch
            ? "按月份下发抓取任务。全部包含旧机和配件，也可以只抓配件。这里提交任务并查看上次结果。配件金额由后端按加盟后台配件进销存 × 30% 写入人效。"
            : "按月份查看上次抓取结果。下发由老板操作。配件金额由后端按加盟后台配件进销存 × 30% 写入人效。"}
        </p>
        <div className="form-row">
          <div className="field" style={{ flex: "0 1 220px", marginBottom: 0 }}>
            <label htmlFor="fetch-jobs-month">抓取月份</label>
            <input
              id="fetch-jobs-month"
              type="month"
              value={month}
              onChange={(event) => {
                const next = event.target.value;
                if (!isYearMonth(next)) {
                  event.target.value = month;
                  return;
                }
                setDispatchMessage("");
                setDispatchError("");
                setMonth(next);
              }}
            />
          </div>
        </div>
        {canDispatch ? (
          <div className="fetch-jobs-actions">
            <button type="button" className="btn" disabled={busy} onClick={() => void dispatch("all")}>
              {busy ? "下发中" : "抓取全部"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void dispatch("accessories")}>
              {busy ? "下发中" : "只抓配件"}
            </button>
          </div>
        ) : null}
        <div className="fetch-jobs-status" aria-live="polite">
          {dispatchMessage ? (
            <p className="access-msg" role="status">
              <span className="tag tag-ok">{dispatchMessage}</span>
            </p>
          ) : null}
          {alerts.map((message) => (
            <p className="empty" role="alert" key={message}>
              {message}
            </p>
          ))}
          {statusMessage ? <p className="page-desc">{statusMessage}</p> : null}
          {latest && !latest.empty ? (
            <dl className="fetch-jobs-lines">
              <div>
                <dt>上次</dt>
                <dd>{when ? <time dateTime={latest.at ?? undefined}>{when}</time> : "时间未返回"}</dd>
              </div>
              <div>
                <dt>旧机</dt>
                <dd>{fetchLegLabel(latest.used)}</dd>
              </div>
              <div>
                <dt>配件</dt>
                <dd>{fetchLegLabel(latest.accessories)}</dd>
              </div>
              {latest.jobId ? (
                <div>
                  <dt>任务号</dt>
                  <dd>{latest.jobId}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
