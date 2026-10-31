"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import { money2 } from "@/lib/format";
import {
  MISTAKE_DISCARD_MESSAGE,
  mistakeLineSignature,
  mistakeLinesDirty,
  navigationLeavesSalary,
} from "@/lib/mistake-editor-dirty";
import {
  sumMistakeLineAmounts,
  validateMistakeLines,
  type MistakeLineInput,
  type SalaryMistakeDetail,
} from "@/lib/salary-mistake";
import {
  formatShanghaiDateTime,
  shanghaiYearMonth,
  showAccessoriesColumn,
  shownAfterDeduction,
  type RealtimeSalaryPerson,
  type RealtimeSalaryResponse,
} from "@/lib/salary-realtime";

/**
 * 实时工资 · 人效卡。老板 / 合伙人由工资页渲染；店员整卡不渲染。
 * 应发来自 GET /api/salary/realtime。失误合计与扣后实发也在这份响应里。
 * 事由明细只在老板展开某人时另取，合伙人不请求、不展示。
 * 本轮编辑只覆盖表里已有的人，没有单独的「添加不在表中的人」入口。
 */

type Phase = "loading" | "ready" | "error";
type SalaryRole = "owner" | "partner";

interface EditorLine extends MistakeLineInput {
  key: string;
}

function messageFor(status: number, code: string): string {
  if (status === 401) return "未登录，无法读取实时工资草案";
  if (status === 403) return "当前角色无权查看实时工资草案";
  if (code === "mistake totals unavailable") return "失误合计暂不可用";
  return "实时工资草案读取失败";
}

function blankLine(): EditorLine {
  return { key: crypto.randomUUID(), id: null, reason: "", amount: "", note: "" };
}

function lineFromRow(row: SalaryMistakeDetail): EditorLine {
  return {
    key: row.id,
    id: row.id,
    reason: row.reason,
    amount: row.amount.toFixed(2),
    note: row.note ?? "",
  };
}

export default function RealtimePayrollCard({ role }: { role: SalaryRole }) {
  const canEdit = role === "owner";
  const [month, setMonth] = useState(shanghaiYearMonth);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<RealtimeSalaryResponse | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const dirtyRef = useRef(false);
  const acceptedLeaveRef = useRef(false);
  const lastSignatureRef = useRef("");
  const salaryHrefRef = useRef("");

  const onDirtyChange = useCallback((dirty: boolean, signature: string) => {
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      acceptedLeaveRef.current = false;
    }
    if (!dirty) acceptedLeaveRef.current = false;
    dirtyRef.current = dirty;
    setEditorDirty((current) => (current === dirty ? current : dirty));
  }, []);

  function confirmDiscard(): boolean {
    if (acceptedLeaveRef.current) return true;
    if (!dirtyRef.current) return true;
    if (!window.confirm(MISTAKE_DISCARD_MESSAGE)) return false;
    acceptedLeaveRef.current = true;
    return true;
  }

  const loadPayload = useCallback(async (targetMonth: string, signal: AbortSignal, quiet: boolean) => {
    if (!quiet) {
      setPhase("loading");
      setMessage("");
      setPayload(null);
    }
    try {
      const res = await fetch(`/api/salary/realtime?month=${encodeURIComponent(targetMonth)}`, {
        cache: "no-store",
        signal,
      });
      if (signal.aborted) return;
      if (!res.ok) {
        let code = "";
        try {
          const errBody = (await res.json()) as { error?: unknown };
          if (typeof errBody.error === "string") code = errBody.error;
        } catch {
          code = "";
        }
        if (signal.aborted) return;
        setPhase("error");
        setMessage(messageFor(res.status, code));
        return;
      }
      const body = (await res.json()) as RealtimeSalaryResponse;
      if (signal.aborted) return;
      if (!body || !Array.isArray(body.people) || !body.totals) {
        setPhase("error");
        setMessage("实时工资草案读取失败");
        return;
      }
      setPayload(body);
      setPhase("ready");
    } catch {
      if (signal.aborted) return;
      setPhase("error");
      setMessage("实时工资草案读取失败");
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setOpenKey(null);
    void loadPayload(month, ctrl.signal, false);
    return () => ctrl.abort();
  }, [month, loadPayload]);

  useEffect(() => {
    if (!editorDirty) return;
    salaryHrefRef.current = window.location.href;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || acceptedLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || acceptedLeaveRef.current) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!navigationLeavesSalary(anchor.href, window.location.href)) return;
      if (confirmDiscard()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onPopState = () => {
      if (!dirtyRef.current || acceptedLeaveRef.current) return;
      const backTo = salaryHrefRef.current;
      if (!backTo) return;
      if (!navigationLeavesSalary(window.location.href, backTo)) return;
      if (confirmDiscard()) return;
      history.pushState(null, "", backTo);
    };

    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);
    const guardHistory = (original: History["pushState"]): History["pushState"] =>
      function (this: History, data, unused, url) {
        const urlText = typeof url === "string" ? url : url instanceof URL ? url.toString() : "";
        if (urlText && navigationLeavesSalary(urlText, window.location.href) && !confirmDiscard()) return;
        return original.call(this, data, unused, url);
      };

    history.pushState = guardHistory(originalPush);
    history.replaceState = guardHistory(originalReplace);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick, true);
    return () => {
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, [editorDirty]);

  const refreshQuiet = useCallback(() => {
    const ctrl = new AbortController();
    return loadPayload(month, ctrl.signal, true);
  }, [loadPayload, month]);

  const people = payload?.people ?? [];
  const empty = phase === "ready" && people.length === 0;
  const showPeople = phase === "ready" && payload !== null && people.length > 0;
  const showAccessories = payload ? showAccessoriesColumn(payload) : false;
  const headcount = people.filter((person) => person.in_draft).length;
  const columns = (showAccessories ? 1 : 0) + 8;
  const afterTotal = payload
    ? shownAfterDeduction({
        gross: payload.totals.gross,
        mistake_total: payload.totals.mistake_total,
        after_deduction: payload.totals.after_deduction,
      })
    : 0;

  function toggle(personKey: string) {
    if (openKey !== null && !confirmDiscard()) return;
    setOpenKey((current) => (current === personKey ? null : personKey));
  }

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
              if (!/^\d{4}-\d{2}$/.test(next) || next === month) {
                e.target.value = month;
                return;
              }
              if (!confirmDiscard()) {
                e.target.value = month;
                return;
              }
              setOpenKey(null);
              setMonth(next);
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
                计薪 {headcount} 人
                {payload.as_of ? (
                  <>
                    ｜截至 <time dateTime={payload.as_of}>{formatShanghaiDateTime(payload.as_of)}</time>
                  </>
                ) : null}
              </div>
            </div>
            <KpiCard label="失误合计" value={money2(payload.totals.mistake_total ?? 0)} unit="元" sub="本月失误扣款" />
            <KpiCard
              label="扣后合计"
              value={money2(afterTotal)}
              unit="元"
              tone={afterTotal < 0 ? "negative" : "default"}
              sub="应发合计 − 失误合计"
            />
          </div>
          <div className="kpi-row" style={{ marginTop: 16 }}>
            <KpiCard label="计薪人数" value={String(headcount)} unit="人" />
            {headcount > 0 ? (
              <KpiCard
                label="人均应发"
                value={money2(payload.totals.gross / headcount)}
                unit="元"
                sub="应发合计 ÷ 计薪人数"
              />
            ) : null}
            <KpiCard label="底薪合计" value={money2(payload.totals.base)} unit="元" />
            <KpiCard label="上门合计" value={money2(payload.totals.door)} unit="元" />
            <KpiCard label="线上合计" value={money2(payload.totals.online)} unit="元" />
            <KpiCard label="门店合计" value={money2(payload.totals.store)} unit="元" />
            {showAccessories ? (
              <KpiCard label="配件合计" value={money2(payload.totals.accessories)} unit="元" />
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
                    <th>失误扣款（元）</th>
                    <th title="应发 − 失误扣款">实发（元）</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const open = canEdit && openKey === person.person_key;
                    const after = shownAfterDeduction(person);
                    return (
                      <PersonRows
                        key={person.person_key}
                        person={person}
                        after={after}
                        showAccessories={showAccessories}
                        canEdit={canEdit}
                        open={open}
                        columns={columns}
                        month={payload.month}
                        onToggle={() => toggle(person.person_key)}
                        onSaved={refreshQuiet}
                        onDirtyChange={onDirtyChange}
                      />
                    );
                  })}
                  <tr className="total">
                    <td>合计</td>
                    <td>{money2(payload.totals.base)}</td>
                    <td>{money2(payload.totals.door)}</td>
                    <td>{money2(payload.totals.online)}</td>
                    <td>{money2(payload.totals.store)}</td>
                    {showAccessories ? <td>{money2(payload.totals.accessories)}</td> : null}
                    <td>{money2(payload.totals.gross)}</td>
                    <td>{money2(payload.totals.mistake_total ?? 0)}</td>
                    <td>{money2(afterTotal)}</td>
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
              {canEdit
                ? "实发 = 应发 − 失误扣款。编辑只改失误明细，不回写应发草案，也不发布月度工资。表里还没有的人，本轮不能从这里新增。"
                : "失误扣款只显示每人合计和上方合计，不显示事由，也不能修改。应发仍是实时草案，本卡不改草案、不发布月度工资。"}
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}

function PersonRows({
  person,
  after,
  showAccessories,
  canEdit,
  open,
  columns,
  month,
  onToggle,
  onSaved,
  onDirtyChange,
}: {
  person: RealtimeSalaryPerson;
  after: number;
  showAccessories: boolean;
  canEdit: boolean;
  open: boolean;
  columns: number;
  month: string;
  onToggle: () => void;
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean, signature: string) => void;
}) {
  return (
    <>
      <tr onClick={canEdit ? onToggle : undefined} style={canEdit ? { cursor: "pointer" } : undefined}>
        <td>
          {person.display_name}
          {canEdit ? (
            <button
              type="button"
              className="btn btn-ghost salary-row-edit"
              aria-expanded={open}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
            >
              {open ? "收起" : "编辑"}
            </button>
          ) : null}
        </td>
        <td>{money2(person.base)}</td>
        <td>{money2(person.door)}</td>
        <td>{money2(person.online)}</td>
        <td>{money2(person.store)}</td>
        {showAccessories ? <td>{money2(person.accessories)}</td> : null}
        <td>{money2(person.gross)}</td>
        <td>{money2(person.mistake_total ?? 0)}</td>
        <td style={after < 0 ? { color: "var(--negative)" } : undefined}>{money2(after)}</td>
      </tr>
      {open ? (
        <tr className="mistake-editor">
          <td colSpan={columns}>
            <MistakeEditor
              month={month}
              personName={person.person_key}
              onSaved={onSaved}
              onDirtyChange={onDirtyChange}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MistakeEditor({
  month,
  personName,
  onSaved,
  onDirtyChange,
}: {
  month: string;
  personName: string;
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean, signature: string) => void;
}) {
  const [lines, setLines] = useState<EditorLine[] | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [original, setOriginal] = useState<SalaryMistakeDetail[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signature = lines ? mistakeLineSignature(lines) : "";
  const isDirty = mistakeLinesDirty(lines, baseline);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(
      `/api/salary/mistake/details?month=${encodeURIComponent(month)}&person_name=${encodeURIComponent(personName)}`,
      { cache: "no-store" }
    );
    if (res.status === 403) {
      setLines([]);
      setError("当前角色不能查看失误事由");
      return;
    }
    if (!res.ok) {
      setLines([]);
      setError("失误明细读取失败");
      return;
    }
    const body = (await res.json()) as { rows?: SalaryMistakeDetail[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const nextLines = rows.length > 0 ? rows.map(lineFromRow) : [blankLine()];
    setOriginal(rows);
    setLines(nextLines);
    setBaseline(mistakeLineSignature(nextLines));
  }, [month, personName]);

  useEffect(() => {
    void load().catch(() => {
      setLines([]);
      setBaseline(mistakeLineSignature([]));
      setError("失误明细读取失败");
    });
  }, [load]);

  useEffect(() => {
    onDirtyChange(isDirty, signature);
  }, [isDirty, signature, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange(false, "");
  }, [onDirtyChange]);

  async function onSave() {
    if (!lines) return;
    const validated = validateMistakeLines(lines);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const keptIds = new Set(
        validated.lines.flatMap((line) => (line.id ? [line.id] : []))
      );
      for (const row of original) {
        if (keptIds.has(row.id)) continue;
        const res = await fetch(`/api/salary/mistake/${row.id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error("delete");
      }
      for (const line of validated.lines) {
        if (line.id === null) {
          const res = await fetch("/api/salary/mistake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              month,
              person_name: personName,
              reason: line.reason,
              amount: line.amount,
              note: line.note,
            }),
          });
          if (!res.ok) throw new Error("post");
          continue;
        }
        const prev = original.find((row) => row.id === line.id);
        if (!prev) throw new Error("missing");
        if (prev.reason === line.reason && prev.amount === line.amount && (prev.note ?? null) === line.note) {
          continue;
        }
        const res = await fetch(`/api/salary/mistake/${line.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: line.reason,
            amount: line.amount,
            note: line.note,
          }),
        });
        if (!res.ok) throw new Error("patch");
      }
      await onSaved();
      const saved = mistakeLineSignature(lines);
      setBaseline(saved);
      onDirtyChange(false, saved);
      await load();
    } catch {
      setError("保存失败，请重试");
      try {
        await load();
      } catch {
        setError("保存失败，请重试");
      }
    } finally {
      setBusy(false);
    }
  }

  const live = lines ? sumMistakeLineAmounts(lines) : 0;

  return (
    <div className="mistake-editor-panel">
      <p className="page-desc" style={{ marginTop: 0 }}>
        {personName} 的失误扣款。多行事由与金额，合计 {money2(live)} 元。
      </p>
      {lines === null ? <div className="skel skel-block" aria-hidden="true" /> : null}
      {lines ? (
        <>
          <div className="mistake-lines">
            {lines.map((line, index) => (
              <div className="mistake-line" key={line.key}>
                <div className="field">
                  <label htmlFor={`mistake-reason-${line.key}`}>事由</label>
                  <input
                    id={`mistake-reason-${line.key}`}
                    value={line.reason}
                    disabled={busy}
                    onChange={(event) => {
                      const reason = event.target.value;
                      setLines((current) =>
                        current?.map((item) => (item.key === line.key ? { ...item, reason } : item)) ?? current
                      );
                    }}
                  />
                </div>
                <div className="field mistake-amount">
                  <label htmlFor={`mistake-amount-${line.key}`}>金额（元）</label>
                  <input
                    id={`mistake-amount-${line.key}`}
                    inputMode="decimal"
                    value={line.amount}
                    disabled={busy}
                    onChange={(event) => {
                      const amount = event.target.value;
                      setLines((current) =>
                        current?.map((item) => (item.key === line.key ? { ...item, amount } : item)) ?? current
                      );
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`mistake-note-${line.key}`}>备注（可选）</label>
                  <input
                    id={`mistake-note-${line.key}`}
                    value={line.note}
                    disabled={busy}
                    onChange={(event) => {
                      const note = event.target.value;
                      setLines((current) =>
                        current?.map((item) => (item.key === line.key ? { ...item, note } : item)) ?? current
                      );
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setLines((current) => current?.filter((item) => item.key !== line.key) ?? current);
                  }}
                >
                  删除第 {index + 1} 行
                </button>
              </div>
            ))}
          </div>
          <div className="form-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setLines((current) => [...(current ?? []), blankLine()])}
            >
              添加一行
            </button>
            <button type="button" className="btn" disabled={busy || lines === null} onClick={() => void onSave()}>
              {busy ? "保存中" : "保存"}
            </button>
          </div>
        </>
      ) : null}
      {error ? (
        <p className="empty" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      <p className="page-desc" style={{ marginBottom: 0 }}>
        空行不计入。全部清空后保存，该人失误合计为 0。
      </p>
    </div>
  );
}
