/**
 * public.employees 测算名单（migration_012，表已在库）。
 * 只做行的形状、校验和展示标签。不计算工资，不读订单，不触发草案。
 *
 * 计薪脚本对 work_role=上门 强制底薪 0，表里的 base_salary 不采用。
 * 门店行按表内底薪。老板要计底薪时记成门店（角色只有上门 / 门店两档）。
 */

export const WORK_ROLES = ["上门", "门店"] as const;
export type WorkRole = (typeof WORK_ROLES)[number];

export const EMPLOYMENT_STATUSES = ["在职", "离职"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYEE_COLUMNS =
  "id, person_name, base_salary, work_role, employment_status, user_id, updated_at";

/** 保存成功后页面上的那一句。只在写入 employees 成功时使用。 */
export const ROSTER_SAVED_MESSAGE = "已进测算名单";

/** 上门行底薪旁的固定说明。表仍保存填写值。 */
export const DOOR_BASE_NOTE = "计薪按 0、不跟表";

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

/** 上门：计薪忽略表内底薪。门店（含记在门店上的老板）跟表。 */
export function payrollIgnoresTableBase(workRole: string): boolean {
  return workRole === "上门";
}

export function baseSalaryLabel(workRole: string): string {
  if (payrollIgnoresTableBase(workRole)) return `底薪（元，${DOOR_BASE_NOTE}）`;
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
