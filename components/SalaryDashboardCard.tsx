"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KpiCard from "@/components/KpiCard";
import { money2 } from "@/lib/format";
import { dashboardHeadcount } from "@/lib/salary-dashboard";
import {
  isYearMonth,
  shownAfterDeduction,
  type RealtimeSalaryResponse,
} from "@/lib/salary-realtime";

/**
 * 工资页汇总指标。只读 GET /api/salary/realtime。
 * 不写 salary_realtime_draft，不下发抓取。按人草案由同页另一块展示。
 */

type Phase = "loading" | "ready" | "error";

function messageFor(status: number): string {
  if (status === 401) return "未登录，无法读取实时工资草案";
  if (status === 403) return "当前角色无权查看实时工资草案";
  return "实时工资草案读取失败";
}

export default function SalaryDashboardCard({
  month: monthProp,
  metricsOnly = false,
}: {
  month?: string;
  /** 主视线只留四张合计。按人表不在这块重复。 */
  metricsOnly?: boolean;
}) {
  const [monthState, setMonthState] = useState(monthProp ?? "");
  const month = monthProp ?? monthState;
  const monthRef = useRef(month);
  monthRef.current = month;
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<RealtimeSalaryResponse | null>(null);

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

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    setMessage("");
    setPayload(null);
    void loadSalary(month, ctrl.signal);
    return () => ctrl.abort();
  }, [month, loadSalary]);

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
    <div aria-label="汇总" aria-busy={phase === "loading"}>
      {metricsOnly ? null : (
        <div className="field salary-month">
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
              setMonthState(next);
            }}
          />
        </div>
      )}

      {phase === "loading" ? <div className="skel skel-block" aria-hidden="true" /> : null}

      {phase === "error" ? (
        <div className="card">
          <p className="empty" role="alert">
            {message}
          </p>
        </div>
      ) : null}

      {empty ? (
        <div className="card">
          <p className="empty">暂无数据</p>
        </div>
      ) : null}

      {showPeople && payload ? (
        <div className="kpi-row salary-metrics">
          <KpiCard label="应发合计" value={money2(payload.totals.gross)} unit="元" />
          <KpiCard label="计薪人数" value={String(headcount)} unit="人" />
          <KpiCard label="失误合计" value={money2(payload.totals.mistake_total ?? 0)} unit="元" />
          <KpiCard
            label="扣后合计"
            value={money2(afterTotal)}
            unit="元"
            tone={afterTotal < 0 ? "negative" : "default"}
          />
        </div>
      ) : null}
    </div>
  );
}
