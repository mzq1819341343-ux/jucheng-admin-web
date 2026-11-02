/**
 * public.employees 测算名单（migration_012，表已在库）。
 * 只做行的形状、校验和展示标签。不计算工资，不读订单，不写 salary_realtime_draft。
 *
 * 上门与门店都保存并展示表内 base_salary。占位草案和底薪同步由服务端完成。
 * 老板要计底薪时可以记成门店（角色只有上门 / 门店两档），上门同样按所填底薪。
 */

export const WORK_ROLES = ["上门", "门店"] as const;
export type WorkRole = (typeof WORK_ROLES)[number];

export const EMPLOYMENT_STATUSES = ["在职", "离职"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYEE_COLUMNS =
  "id, person_name, base_salary, work_role, employment_status, user_id, updated_at";

/** 保存成功后页面上的那一句。只在写入 employees 成功时使用。 */
export const ROSTER_SAVED_MESSAGE = "已进测算名单";

/** 与闸无关：上门与门店都按表内底薪。 */
const ROSTER_TABLE_BASE_NOTE = "上门与门店都按表内底薪保存和显示。";

/**
 * 老板看到的说明。闸开时写入当月草案占位，底薪变更同步草案底薪与应发。
 * 补贴奖金口径仍以人效卡手填为准。
 */
export const ROSTER_EDIT_NOTE_OPEN =
  "保存写入测算名单；新人在职可进当月实时草案占位，底薪变更同步当月草案底薪与应发；补贴奖金仍以人效卡手填为准。" +
  ROSTER_TABLE_BASE_NOTE;

/** 老板看到的说明。闸关时保存仍只写测算名单，不写入草案。 */
export const ROSTER_EDIT_NOTE_CLOSED =
  "保存写入测算名单；占位闸关闭时不写入草案；人效仍读已有实时草案。" + ROSTER_TABLE_BASE_NOTE;

export function rosterEditNote(gateOpen: boolean): string {
  return gateOpen ? ROSTER_EDIT_NOTE_OPEN : ROSTER_EDIT_NOTE_CLOSED;
}

/** 合伙人看到的说明。 */
export const ROSTER_READ_NOTE =
  "只读。名单由老板维护。上门与门店都按表内底薪。人效读取实时草案。";

const NAME_MAX = 40;
const SALARY_MAX = 9_999_999_999.99;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EmployeeRow {
  id: string;
  person_name: string;
  base_salary: number;
  work_role: WorkRole;
  employment_status: EmploymentStatus;
  user_id: string | null;
  updated_at: string;
}

export interface EmployeeWrite {
  person_name: string;
  base_salary: number;
  work_role: WorkRole;
  employment_status: EmploymentStatus;
  user_id: string | null;
}

export function isWorkRole(value: string): value is WorkRole {
  return (WORK_ROLES as readonly string[]).includes(value);
}

export function isEmploymentStatus(value: string): value is EmploymentStatus {
  return (EMPLOYMENT_STATUSES as readonly string[]).includes(value);
}

/** 上门与门店同一标签。底薪就是表内填写值。 */
export function baseSalaryLabel(_workRole: string): string {
  return "底薪（元）";
}

export function sortEmployees(rows: EmployeeRow[]): EmployeeRow[] {
  return [...rows].sort((a, b) => {
    if (a.employment_status !== b.employment_status) {
      return a.employment_status === "在职" ? -1 : 1;
    }
    return a.person_name.localeCompare(b.person_name, "zh");
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asMoney(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > SALARY_MAX) return null;
  return Math.round(n * 100) / 100;
}

/** 库里读出的一行。缺字段或角色不在约束内则丢掉，避免把坏行画进表。 */
export function coerceEmployeeRow(value: unknown): EmployeeRow | null {
  const row = asRecord(value);
  if (!row) return null;
  if (typeof row.id !== "string" || row.id === "") return null;
  if (typeof row.person_name !== "string") return null;
  const personName = row.person_name.trim();
  if (personName === "") return null;
  const base = asMoney(row.base_salary);
  if (base === null) return null;
  if (typeof row.work_role !== "string" || !isWorkRole(row.work_role)) return null;
  if (typeof row.employment_status !== "string" || !isEmploymentStatus(row.employment_status)) {
    return null;
  }
  const userId = row.user_id == null || row.user_id === "" ? null : row.user_id;
  if (userId !== null && typeof userId !== "string") return null;
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : "";
  return {
    id: row.id,
    person_name: personName,
    base_salary: base,
    work_role: row.work_role,
    employment_status: row.employment_status,
    user_id: userId,
    updated_at: updatedAt,
  };
}

export function parseBaseSalaryInput(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim();
  if (text === "") return { ok: false, error: "请填写底薪" };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: "底薪需为不小于 0 的金额，最多两位小数" };
  const value = Number(text);
  if (!Number.isFinite(value) || value > SALARY_MAX) return { ok: false, error: "底薪超出可保存范围" };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export function parseEmployeeWrite(input: {
  person_name: string;
  base_salary: string;
  work_role: string;
  employment_status: string;
  user_id: string;
}): { ok: true; value: EmployeeWrite } | { ok: false; error: string } {
  const personName = input.person_name.trim();
  if (personName === "") return { ok: false, error: "请填写姓名" };
  if (personName.length > NAME_MAX) return { ok: false, error: "姓名过长" };
  const base = parseBaseSalaryInput(input.base_salary);
  if (!base.ok) return base;
  if (!isWorkRole(input.work_role)) return { ok: false, error: "请选择上门或门店" };
  if (!isEmploymentStatus(input.employment_status)) return { ok: false, error: "请选择在职或离职" };
  const linked = input.user_id.trim();
  if (linked !== "" && !UUID_RE.test(linked)) return { ok: false, error: "关联账号无效" };
  return {
    ok: true,
    value: {
      person_name: personName,
      base_salary: base.value,
      work_role: input.work_role,
      employment_status: input.employment_status,
      user_id: linked === "" ? null : linked,
    },
  };
}

export function duplicateName(rows: EmployeeRow[], personName: string, exceptId?: string): boolean {
  const name = personName.trim();
  return rows.some((row) => row.id !== exceptId && row.person_name === name);
}
