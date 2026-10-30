"use client";

import { useEffect, useState } from "react";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import { money2 } from "@/lib/format";
import {
  formatShanghaiDateTime,
  shanghaiYearMonth,
  showAccessoriesColumn,
  type RealtimeSalaryResponse,
} from "@/lib/salary-realtime";

/**
 * 实时工资 · 人效卡。老板 / 合伙人由工资页渲染；店员整卡不渲染。
 * 数字只来自 GET /api/salary/realtime，空月份显示「暂无数据」。
 */

type Phase = "loading" | "ready" | "error";

export default function RealtimePayrollCard() {
  const [month, setMonth] = useState(shanghaiYearMonth);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<RealtimeSalaryResponse | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    setMessage("");
    setPayload(null);
    (async () => {
      try {
        const res = await fetch(`/api/salary/realtime?month=${encodeURIComponent(month)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (res.status === 401) {
          setPhase("error");
          setMessage("未登录，无法读取实时工资草案");
          return;
        }
        if (res.status === 403) {
          setPhase("error");
          setMessage("当前角色无权查看实时工资草案");
          return;
        }
        if (!res.ok) {
          setPhase("error");
          setMessage("实时工资草案读取失败");
          return;
        }
        const body = (await res.json()) as RealtimeSalaryResponse;
        if (!body || !Array.isArray(body.people) || !body.totals) {
          setPhase("error");
          setMessage("实时工资草案读取失败");
          return;
        }
        setPayload(body);
        setPhase("ready");
      } catch {
        if (ctrl.signal.aborted) return;
        setPhase("error");
        setMessage("实时工资草案读取失败");
      }
    })();
    return () => ctrl.abort();
  }, [month]);

  const people = payload?.people ?? [];
  const empty = phase === "ready" && people.length === 0;
  const showPeople = phase === "ready" && payload !== null && people.length > 0;
  const showAccessories = payload ? showAccessoriesColumn(payload) : false;

  return (
    <section aria-busy={phase === "loading"} aria-live="polite">
      <h2 className="section-title salary-head">
        <span className="salary-head-text">实时工资 · 人效（{month}）</span>
        <span className="salary-kind salary-kind-draft">实时草案（未月结）</span>
      </h2>

      <div className="form-row">
        <div className="field" style={{ flex: "0 1 220px", marginBottom: 0 }}>
          <label htmlFor="realtime-salary-month">月份</label>
          <input
            id="realtime-salary-month"
            type="month"
            value={month}
            onChange={(e) => {
              const next = e.target.value;
              if (/^\d{4}-\d{2}$/.test(next)) setMonth(next);
            }}
          />
        </div>
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
              <div className="kpi-label">应发合计（实时工资草案，{payload.month}）</div>
              <KpiValue value={money2(payload.totals.gross)} unit="元" />
              <div className="kpi-sub">
                计薪 {people.length} 人
                {payload.as_of ? (
                  <>
                    ｜截至 <time dateTime={payload.as_of}>{formatShanghaiDateTime(payload.as_of)}</time>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="kpi-row" style={{ marginTop: 16 }}>
            <KpiCard label="计薪人数" value={String(people.length)} unit="人" />
            <KpiCard
              label="人均应发"
              value={money2(payload.totals.gross / people.length)}
              unit="元"
              sub="应发合计 ÷ 计薪人数"
            />
            <KpiCard label="底薪合计" value={money2(payload.totals.base)} unit="元" />
            <KpiCard label="上门合计" value={money2(payload.totals.door)} unit="元" />
            <KpiCard label="线上合计" value={money2(payload.totals.online)} unit="元" />
            <KpiCard label="门店合计" value={money2(payload.totals.store)} unit="元" />
            {showAccessories ? (
              <KpiCard label="配件合计" value={money2(payload.totals.accessories)} unit="元" />
            ) : null}
            {payload.totals.net !== null ? (
              <KpiCard label="实发合计" value={money2(payload.totals.net)} unit="元" />
            ) : null}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>
              按人明细
            </h3>
            <div className="table-wrap">
              <table className="report salary-people">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>底薪（元）</th>
                    <th>上门（元）</th>
                    <th>线上（元）</th>
                    <th>门店（元）</th>
                    {showAccessories ? <th>配件（元）</th> : null}
                    <th>应发（元）</th>
                    <th>实发（元）</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.person_key}>
                      <td>{person.display_name}</td>
                      <td>{money2(person.base)}</td>
                      <td>{money2(person.door)}</td>
                      <td>{money2(person.online)}</td>
                      <td>{money2(person.store)}</td>
                      {showAccessories ? <td>{money2(person.accessories)}</td> : null}
                      <td>{money2(person.gross)}</td>
                      <td>{money2(person.net)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>合计</td>
                    <td>{money2(payload.totals.base)}</td>
                    <td>{money2(payload.totals.door)}</td>
                    <td>{money2(payload.totals.online)}</td>
                    <td>{money2(payload.totals.store)}</td>
                    {showAccessories ? <td>{money2(payload.totals.accessories)}</td> : null}
                    <td>{money2(payload.totals.gross)}</td>
                    <td>{money2(payload.totals.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {payload.caliber ? (
              <p className="page-desc" style={{ marginTop: 12, marginBottom: 0 }}>
                口径：{payload.caliber}
              </p>
            ) : null}
            <p className="page-desc" style={{ marginTop: 12, marginBottom: 0 }}>
              此为实时工资草案，只读。已发布月度工资仍在下方，本卡不修改、不发布。
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
