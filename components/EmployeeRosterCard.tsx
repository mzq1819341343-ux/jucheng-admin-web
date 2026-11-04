"use client";

import { useEffect, useRef, useState } from "react";
import { money2 } from "@/lib/format";
import {
  EMPLOYEE_COLUMNS,
  EMPLOYMENT_STATUSES,
  ROSTER_READ_NOTE,
  ROSTER_SAVED_MESSAGE,
  WORK_ROLES,
  baseSalaryLabel,
  coerceEmployeeRow,
  duplicateName,
  parseEmployeeWrite,
  rosterEditNote,
  sortEmployees,
  type EmployeeRow,
  type EmployeeWrite,
  type EmploymentStatus,
  type WorkRole,
} from "@/lib/employees";
import { chooseEmployeeDraftMode, type DraftFollowUp } from "@/lib/employee-draft-ui";
import { postEmployeeDraft } from "@/lib/employee-draft-client";
import { requestSalaryRealtimeRefresh } from "@/lib/salary-realtime-refresh";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/config";
import { runOptimistic } from "@/lib/optimistic";

/**
 * 员工表：老板维护 public.employees，合伙人只读，店员工资页不挂本卡。
 * 写入走浏览器 Supabase 客户端，权限交给现有 RLS（owner 全权，partner 只 select）。
 * 成功提示「已进测算名单」，再请服务端 Route 占位或同步底薪，并重读人效。
 * 本卡不写 salary_realtime_draft，不跑脚本。闸未开时不报已写入草案。
 */

export interface RosterMember {
  id: string;
  display_name: string | null;
}

function accountText(userId: string | null, members: RosterMember[]): string {
  if (!userId) return "—";
  const name = members.find((member) => member.id === userId)?.display_name?.trim();
  return name || "已关联";
}

function writeErrorMessage(message: string, raw?: unknown): string {
  const code =
    raw && typeof raw === "object" && "code" in raw ? String((raw as { code?: unknown }).code ?? "") : "";
  if (code === "23505" || /duplicate key|unique/i.test(message)) return "这个姓名已在名单里";
  return `保存失败，已回滚：${message}`;
}

function localRow(value: EmployeeWrite): EmployeeRow {
  return {
    id: `local-${crypto.randomUUID()}`,
    person_name: value.person_name,
    base_salary: value.base_salary,
    work_role: value.work_role,
    employment_status: value.employment_status,
    user_id: value.user_id,
    updated_at: new Date().toISOString(),
  };
}

export default function EmployeeRosterCard({
  initialRows,
  members,
  canEdit,
  demo,
  gateOpen,
}: {
  initialRows: EmployeeRow[];
  members: RosterMember[];
  canEdit: boolean;
  demo: boolean;
  /** 服务端 ALLOW_EMPLOYEE_DRAFT_WRITE。只选永久说明，不代替保存后的跟进文案。 */
  gateOpen: boolean;
}) {
  const [rows, setRows] = useState<EmployeeRow[]>(() => sortEmployees(initialRows));
  const [msg, setMsg] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<DraftFollowUp | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [base, setBase] = useState("2000");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<EmploymentStatus>("在职");
  const [account, setAccount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBase, setEditBase] = useState("");
  const [editRole, setEditRole] = useState<WorkRole>("门店");
  const [editStatus, setEditStatus] = useState<EmploymentStatus>("在职");
  const [editAccount, setEditAccount] = useState("");
  const msgRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (msg !== ROSTER_SAVED_MESSAGE && !draftNote) return;
    msgRef.current?.scrollIntoView({ block: "nearest" });
  }, [msg, draftNote]);

  const offline = demo || !isSupabaseConfigured();

  function resetAddForm() {
    setName("");
    setBase("2000");
    setRole("");
    setStatus("在职");
    setAccount("");
  }

  function beginEdit(row: EmployeeRow) {
    setEditingId(row.id);
    setEditBase(row.base_salary.toFixed(2));
    setEditRole(row.work_role);
    setEditStatus(row.employment_status);
    setEditAccount(row.user_id ?? "");
    setMsg(null);
    setDraftNote(null);
  }

  async function persist(value: EmployeeWrite, previous: EmployeeRow | null) {
    if (offline || (previous && previous.id.startsWith("local-"))) {
      const next = previous
        ? rows.map((row) =>
            row.id === previous.id
              ? {
                  ...row,
                  base_salary: value.base_salary,
                  work_role: value.work_role,
                  employment_status: value.employment_status,
                  user_id: value.user_id,
                }
              : row,
          )
        : [localRow(value), ...rows];
      setRows(sortEmployees(next));
      setEditingId(null);
      if (!previous) resetAddForm();
      setDraftNote(null);
      setMsg("演示模式不落库，未进测算名单");
      return;
    }

    const snapshot = rows;
    setBusy(true);
    setMsg(null);
    setDraftNote(null);
    const ok = await runOptimistic<EmployeeRow>({
      apply: () => {
        const draft = previous
          ? { ...previous, ...value, updated_at: new Date().toISOString() }
          : localRow(value);
        const without = previous ? rows.filter((row) => row.id !== previous.id) : rows;
        setRows(sortEmployees([draft, ...without]));
      },
      rollback: () => setRows(snapshot),
      request: async () => {
        const supabase = await createBrowserSupabase();
        const payload = {
          person_name: value.person_name,
          base_salary: value.base_salary,
          work_role: value.work_role,
          employment_status: value.employment_status,
          user_id: value.user_id,
          ...(previous ? { updated_at: new Date().toISOString() } : {}),
        };
        const query = previous
          ? supabase.from("employees").update(payload).eq("id", previous.id)
          : supabase.from("employees").insert(payload);
        const { data, error } = await query.select(EMPLOYEE_COLUMNS).single();
        if (error) return { data: null, error: { message: error.message, code: error.code } };
        const row = coerceEmployeeRow(data);
        if (!row) return { data: null, error: { message: "保存结果无法读取" } };
        return { data: row, error: null };
      },
      commit: (saved) => {
        const without = previous ? snapshot.filter((row) => row.id !== previous.id) : snapshot;
        setRows(sortEmployees([saved, ...without]));
      },
      onError: (message, raw) => setMsg(writeErrorMessage(message, raw)),
    });
    if (ok) {
      setMsg(ROSTER_SAVED_MESSAGE);
      setEditingId(null);
      if (!previous) resetAddForm();
      const mode = chooseEmployeeDraftMode(previous, value);
      if (mode) {
        const note = await postEmployeeDraft({
          mode,
          person_name: value.person_name,
          base_salary: value.base_salary,
          work_role: value.work_role,
          employment_status: value.employment_status,
          user_id: value.user_id,
        });
        setDraftNote(note);
      }
      requestSalaryRealtimeRefresh();
    }
    setBusy(false);
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseEmployeeWrite({
      person_name: name,
      base_salary: base,
      work_role: role,
      employment_status: status,
      user_id: account,
    });
    if (!parsed.ok) {
      setMsg(parsed.error);
      setDraftNote(null);
      return;
    }
    if (duplicateName(rows, parsed.value.person_name)) {
      setMsg("这个姓名已在名单里");
      setDraftNote(null);
      return;
    }
    await persist(parsed.value, null);
  }

  async function onSaveEdit(row: EmployeeRow) {
    const parsed = parseEmployeeWrite({
      person_name: row.person_name,
      base_salary: editBase,
      work_role: editRole,
      employment_status: editStatus,
      user_id: editAccount,
    });
    if (!parsed.ok) {
      setMsg(parsed.error);
      setDraftNote(null);
      return;
    }
    await persist(parsed.value, row);
  }

  return (
    <section aria-label="员工表">
      <h2 className="section-title salary-head">
        <span className="salary-head-text">员工表</span>
        <span className="salary-kind salary-kind-draft">测算名单</span>
      </h2>
      <div className="card">
        <p className="page-desc employee-roster-note">{canEdit ? rosterEditNote(gateOpen) : ROSTER_READ_NOTE}</p>

        {msg || draftNote ? (
          <div ref={msgRef}>
            {msg ? (
              <p className="access-msg employee-roster-msg" role="status">
                {msg === ROSTER_SAVED_MESSAGE ? <span className="tag tag-ok">{msg}</span> : msg}
              </p>
            ) : null}
            {draftNote ? (
              <p className="access-msg employee-roster-msg" role={draftNote.tone === "error" ? "alert" : "status"}>
                {draftNote.tone === "error" ? (
                  draftNote.text
                ) : (
                  <span className={draftNote.tone === "ok" ? "tag tag-ok" : "tag tag-pending"}>{draftNote.text}</span>
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="empty">
            {canEdit ? "暂无员工。新增后进入测算名单，这里不预填任何人。" : "暂无员工。"}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="report employee-roster">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>底薪（元）</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>关联账号</th>
                  {canEdit ? <th>操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const editing = canEdit && editingId === row.id;
                  return (
                    <tr key={row.id}>
                      <td>{row.person_name}</td>
                      <td>
                        {editing ? (
                          <>
                            <label className="employee-cell-label" htmlFor={`emp-base-${row.id}`}>
                              {baseSalaryLabel(editRole)}
                            </label>
                            <input
                              id={`emp-base-${row.id}`}
                              className="inline-input"
                              inputMode="decimal"
                              value={editBase}
                              onChange={(event) => setEditBase(event.target.value)}
                            />
                          </>
                        ) : (
                          money2(row.base_salary)
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <select
                            className="inline-input"
                            aria-label={`${row.person_name}的角色`}
                            value={editRole}
                            onChange={(event) => setEditRole(event.target.value as WorkRole)}
                          >
                            {WORK_ROLES.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        ) : (
                          row.work_role
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <select
                            className="inline-input"
                            aria-label={`${row.person_name}的在职状态`}
                            value={editStatus}
                            onChange={(event) => setEditStatus(event.target.value as EmploymentStatus)}
                          >
                            {EMPLOYMENT_STATUSES.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        ) : row.employment_status === "在职" ? (
                          <span className="tag tag-ok">在职</span>
                        ) : (
                          <span className="tag tag-pending">离职</span>
                        )}
                      </td>
                      <td>
                        {editing && (members.length > 0 || editAccount) ? (
                          <select
                            className="inline-input"
                            aria-label={`${row.person_name}的关联账号`}
                            value={editAccount}
                            onChange={(event) => setEditAccount(event.target.value)}
                          >
                            <option value="">不关联</option>
                            {editAccount && !members.some((member) => member.id === editAccount) ? (
                              <option value={editAccount}>已关联</option>
                            ) : null}
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.display_name?.trim() || "未命名账号"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          accountText(row.user_id, members)
                        )}
                      </td>
                      {canEdit ? (
                        <td>
                          {editing ? (
                            <span className="employee-row-actions">
                              <button
                                type="button"
                                className="btn"
                                disabled={busy}
                                onClick={() => onSaveEdit(row)}
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => setEditingId(null)}
                              >
                                取消
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={busy}
                              onClick={() => beginEdit(row)}
                            >
                              编辑
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canEdit ? (
          <form onSubmit={onAdd}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="emp-name">姓名</label>
                <input
                  id="emp-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="emp-base">{baseSalaryLabel(role)}</label>
                <input
                  id="emp-base"
                  value={base}
                  inputMode="decimal"
                  onChange={(event) => setBase(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="emp-role">角色</label>
                <select id="emp-role" value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="">请选择</option>
                  {WORK_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="emp-status">状态</label>
                <select
                  id="emp-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as EmploymentStatus)}
                >
                  {EMPLOYMENT_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              {members.length > 0 ? (
                <div className="field">
                  <label htmlFor="emp-account">关联账号（可选）</label>
                  <select id="emp-account" value={account} onChange={(event) => setAccount(event.target.value)}>
                    <option value="">不关联</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.display_name?.trim() || "未命名账号"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <button type="submit" className="btn" disabled={busy}>
              新增
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
