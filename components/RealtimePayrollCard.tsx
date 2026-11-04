"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import KpiCard, { KpiValue } from "@/components/KpiCard";
import RealtimePayrollExport from "@/components/RealtimePayrollExport";
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
  handFillShown,
  parseHandFillAmount,
  shanghaiYearMonth,
  showAccessoriesColumn,
  shownAfterDeduction,
  type RealtimeSalaryPerson,
  type RealtimeSalaryResponse,
} from "@/lib/salary-realtime";
import { SALARY_REALTIME_REFRESH_EVENT } from "@/lib/salary-realtime-refresh";

/**
 * 实时工资 · 人效卡。老板 / 合伙人由工资页渲染；店员整卡不渲染。
 * 应发来自 GET /api/salary/realtime。失误合计与扣后实发也在这份响应里。
 * 事由明细只在老板展开某人时另取，合伙人不请求、不展示。
 * 本轮编辑只覆盖表里已有的人，没有单独的「添加不在表中的人」入口。
 */

type Phase = "loading" | "ready" | "error";
type SalaryRole = "owner" | "partner";

const HAND_DISCARD_MESSAGE = "补贴或奖金还有未保存的修改，继续会丢掉这些内容。确定放弃？";
const BOTH_DISCARD_MESSAGE =
  "失误扣款、补贴或奖金还有未保存的修改，继续会丢掉这些内容。确定放弃？";

function exportNotice(phase: Phase, count: number): string | null {
  if (phase === "loading") return "正在读取本月人效，暂时不能导出。";
  if (phase === "error") return "草案没有读出来，暂时不能导出。";
  if (count === 0) return "暂无按人明细，没有可导出的内容。";
  return null;
}

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

export default function RealtimePayrollCard({
  role,
  summary = "full",
  month: monthProp,
  confirmRef,
}: {
  role: SalaryRole;
  /** full：合计卡和草案表都在本卡。table：合计卡改由同页汇总承担，本卡只留草案表。 */
  summary?: "full" | "table";
  /** 与汇总共用的月份。传入后本卡不再单独放月份控件。 */
  month?: string;
  confirmRef?: MutableRefObject<() => boolean>;
}) {
  const canEdit = role === "owner";
  const [monthState, setMonthState] = useState(monthProp ?? shanghaiYearMonth);
  const month = monthProp ?? monthState;
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<RealtimeSalaryResponse | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [handDirty, setHandDirty] = useState(false);
  const dirtyRef = useRef(false);
  const handDirtyRef = useRef(false);
  const handDirtyKeys = useRef(new Set<string>());
  const acceptedLeaveRef = useRef(false);
  const lastSignatureRef = useRef("");
  const salaryHrefRef = useRef("");
  const inflightRef = useRef<AbortController | null>(null);
  const hasPayloadRef = useRef(false);

  const onHandDirtyChange = useCallback((personKey: string, dirty: boolean) => {
    const keys = handDirtyKeys.current;
    if (dirty) keys.add(personKey);
    else keys.delete(personKey);
    const next = keys.size > 0;
    handDirtyRef.current = next;
    setHandDirty((current) => (current === next ? current : next));
  }, []);

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
    const mistakeDirty = dirtyRef.current;
    const subsidyDirty = handDirtyRef.current;
    if (!mistakeDirty && !subsidyDirty) return true;
    const message =
      mistakeDirty && subsidyDirty
        ? BOTH_DISCARD_MESSAGE
        : mistakeDirty
          ? MISTAKE_DISCARD_MESSAGE
          : HAND_DISCARD_MESSAGE;
    if (!window.confirm(message)) return false;
    acceptedLeaveRef.current = true;
    return true;
  }

  if (confirmRef) confirmRef.current = confirmDiscard;

  const loadPayload = useCallback(async (targetMonth: string, signal: AbortSignal, quiet: boolean) => {
    if (!quiet) {
      hasPayloadRef.current = false;
      setPhase("loading");
      setMessage("");
      setPayload(null);
    }
    const fail = (text: string) => {
      if (signal.aborted) return;
      if (quiet && hasPayloadRef.current) return;
      setPhase("error");
      setMessage(text);
    };
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
        fail(messageFor(res.status, code));
        return;
      }
      const body = (await res.json()) as RealtimeSalaryResponse;
      if (signal.aborted) return;
      if (!body || !Array.isArray(body.people) || !body.totals) {
        fail("实时工资草案读取失败");
        return;
      }
      hasPayloadRef.current = true;
      setPayload(body);
      setPhase("ready");
    } catch {
      fail("实时工资草案读取失败");
    }
  }, []);

  const beginLoad = useCallback(
    (targetMonth: string, quiet: boolean) => {
      inflightRef.current?.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      return loadPayload(targetMonth, ctrl.signal, quiet);
    },
    [loadPayload]
  );

  useEffect(() => {
    setOpenKey(null);
    void beginLoad(month, false);
    return () => inflightRef.current?.abort();
  }, [month, beginLoad]);

  useEffect(() => {
    if (!editorDirty && !handDirty) return;
    salaryHrefRef.current = window.location.href;

    const unsaved = () => dirtyRef.current || handDirtyRef.current;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved() || acceptedLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (!unsaved() || acceptedLeaveRef.current) return;
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
      if (!unsaved() || acceptedLeaveRef.current) return;
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
  }, [editorDirty, handDirty]);

  const refreshQuiet = useCallback(() => beginLoad(month, true), [beginLoad, month]);

  useEffect(() => {
    const onRefresh = () => {
      void refreshQuiet();
    };
    window.addEventListener(SALARY_REALTIME_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(SALARY_REALTIME_REFRESH_EVENT, onRefresh);
  }, [refreshQuiet]);

  const people = payload?.people ?? [];
  const empty = phase === "ready" && people.length === 0;
  const showPeople = phase === "ready" && payload !== null && people.length > 0;
  const showAccessories = payload ? showAccessoriesColumn(payload) : false;
  const handFill = payload ? handFillShown(payload) : false;
  const headcount = people.filter((person) => person.in_draft).length;
  const columns = (showAccessories ? 1 : 0) + (handFill ? 2 : 0) + 8;
  const exportNote = exportNotice(phase, people.length);
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
      <h2 id={summary === "table" ? "salary-people" : undefined} className="section-title">
        {summary === "table" ? "按人草案" : `实时工资 · 人效（${month}）`}
      </h2>

      {monthProp === undefined ? (
        <div className="field salary-month">
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
              setMonthState(next);
            }}
          />
        </div>
      ) : null}

      <RealtimePayrollExport
        month={month}
        source={exportNote === null && payload ? { people: payload.people, totals: payload.totals } : null}
        notice={exportNote}
      />

      {phase === "loading" ? <div className="skel skel-block salary-gap" aria-hidden="true" /> : null}

      {phase === "error" ? (
        <div className="card salary-gap">
          <p className="empty" role="alert">
            {message}
          </p>
        </div>
      ) : null}

      {empty ? (
        <div className="card salary-gap">
          <p className="empty">本月暂无草案</p>
          <p className="page-desc">可切换月份，查看已有草案的月份。</p>
        </div>
      ) : null}

      {showPeople && payload ? (
        <>
          {summary === "full" ? (
            <>
              <div className="kpi-row salary-gap">
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
              <div className="kpi-row salary-gap">
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
            </>
          ) : null}

          <div className="card salary-gap">
            {summary === "table" ? null : <h3 className="section-title salary-title-tight">按人明细</h3>}
            <div className="table-wrap">
              <table className={handFill ? "report salary-people salary-people-hand" : "report salary-people"}>
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>底薪（元）</th>
                    <th>上门（元）</th>
                    <th>线上（元）</th>
                    <th>门店（元）</th>
                    {showAccessories ? <th>配件（元）</th> : null}
                    {handFill ? (
                      <>
                        <th>补贴（元）</th>
                        <th>奖金（元）</th>
                      </>
                    ) : null}
                    <th>应发（元）</th>
                    <th>失误扣款（元）</th>
                    <th>实发（元）</th>
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
                        handFill={handFill}
                        canEdit={canEdit}
                        open={open}
                        columns={columns}
                        month={payload.month}
                        onToggle={() => toggle(person.person_key)}
                        onSaved={refreshQuiet}
                        onDirtyChange={onDirtyChange}
                        onHandDirtyChange={onHandDirtyChange}
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
                    {handFill ? (
                      <>
                        <td>{money2(payload.totals.subsidy ?? 0)}</td>
                        <td>{money2(payload.totals.bonus ?? 0)}</td>
                      </>
                    ) : null}
                    <td>{money2(payload.totals.gross)}</td>
                    <td>{money2(payload.totals.mistake_total ?? 0)}</td>
                    <td>{money2(afterTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
  handFill,
  canEdit,
  open,
  columns,
  month,
  onToggle,
  onSaved,
  onDirtyChange,
  onHandDirtyChange,
}: {
  person: RealtimeSalaryPerson;
  after: number;
  showAccessories: boolean;
  handFill: boolean;
  canEdit: boolean;
  open: boolean;
  columns: number;
  month: string;
  onToggle: () => void;
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean, signature: string) => void;
  onHandDirtyChange: (personKey: string, dirty: boolean) => void;
}) {
  const canFill = canEdit && handFill && person.in_draft;
  return (
    <>
      <tr onClick={canEdit ? onToggle : undefined} style={canEdit ? { cursor: "pointer" } : undefined}>
        <td>
          <Link
            href={`/salary/people/${encodeURIComponent(person.person_key)}?month=${encodeURIComponent(month)}`}
            onClick={(event) => event.stopPropagation()}
          >
            {person.display_name}
          </Link>
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
        {handFill ? (
          canFill ? (
            <HandFillCells
              key={`${person.person_key}:${person.subsidy ?? 0}:${person.bonus ?? 0}`}
              month={month}
              person={person}
              onDirty={onHandDirtyChange}
              onSaved={onSaved}
            />
          ) : (
            <>
              <td>{money2(person.subsidy ?? 0)}</td>
              <td>
                {money2(person.bonus ?? 0)}
              </td>
            </>
          )
        ) : null}
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

function formatHand(value: number | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toFixed(2);
}

function sameHand(text: string, server: number | undefined): boolean {
  const parsed = parseHandFillAmount(text.trim() === "" ? "0" : text.trim());
  const target = typeof server === "number" && Number.isFinite(server) ? server : 0;
  return parsed !== null && parsed === target;
}

function HandFillCells({
  month,
  person,
  onDirty,
  onSaved,
}: {
  month: string;
  person: RealtimeSalaryPerson;
  onDirty: (personKey: string, dirty: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [subsidyText, setSubsidyText] = useState(() => formatHand(person.subsidy));
  const [bonusText, setBonusText] = useState(() => formatHand(person.bonus));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = !sameHand(subsidyText, person.subsidy) || !sameHand(bonusText, person.bonus);

  useEffect(() => {
    onDirty(person.person_key, dirty);
  }, [dirty, onDirty, person.person_key]);

  useEffect(() => {
    return () => onDirty(person.person_key, false);
  }, [onDirty, person.person_key]);

  async function onSave(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    const subsidy = parseHandFillAmount(subsidyText.trim() === "" ? "0" : subsidyText.trim());
    const bonus = parseHandFillAmount(bonusText.trim() === "" ? "0" : bonusText.trim());
    if (subsidy === null || bonus === null) {
      setError("补贴和奖金须为不小于 0 的金额，最多两位小数");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salary/realtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          person_name: person.person_key,
          subsidy_amount: subsidy,
          bonus_amount: bonus,
        }),
      });
      if (res.status === 403) {
        setError("当前角色不能修改补贴和奖金");
        return;
      }
      if (res.status === 409) {
        setError("补贴和奖金列还没就绪，暂时不能保存");
        return;
      }
      if (!res.ok) {
        setError("保存失败，请重试");
        return;
      }
      await onSaved();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <td className="salary-hand-cell" onClick={(event) => event.stopPropagation()}>
        <input
          className="salary-hand-input"
          inputMode="decimal"
          aria-label={`${person.display_name} 补贴（元）`}
          value={subsidyText}
          disabled={busy}
          onChange={(event) => {
            setSubsidyText(event.target.value);
            setError("");
          }}
        />
      </td>
      <td className="salary-hand-cell" onClick={(event) => event.stopPropagation()}>
        <div className="salary-hand-save">
          <input
            className="salary-hand-input"
            inputMode="decimal"
            aria-label={`${person.display_name} 奖金（元）`}
            value={bonusText}
            disabled={busy}
            onChange={(event) => {
              setBonusText(event.target.value);
              setError("");
            }}
          />
          <button
            type="button"
            className="btn btn-ghost salary-row-edit"
            disabled={busy || !dirty}
            onClick={(event) => void onSave(event)}
          >
            {busy ? "保存中" : "保存"}
          </button>
        </div>
        {error ? (
          <p className="empty salary-gap" role="alert">
            {error}
          </p>
        ) : null}
      </td>
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
      <p className="salary-meta">合计 {money2(live)} 元</p>
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
          <div className="form-row salary-gap">
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
        <p className="empty salary-gap" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
