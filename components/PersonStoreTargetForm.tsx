"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { money2 } from "@/lib/format";
import {
  MONTHLY_SALES_TARGETS_TABLE,
  TARGET_OFFLINE_MESSAGE,
  TARGET_SAVED_MESSAGE,
  TARGET_TABLE_MISSING_MESSAGE,
  isMissingMonthlySalesTargetsError,
  parseMonthlySalesTargetWrite,
  type MonthlySalesTarget,
  type StoreOption,
} from "@/lib/monthly-sales-targets";
import { createBrowserSupabase } from "@/lib/supabase/config";

export interface TargetPersonOption {
  id: string;
  person_name: string;
  employment_status: "在职" | "离职";
}

function amountText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * 老板按人、按店、按月写入 monthly_sales_targets。
 * 失败只提示，不把目标留在本地状态里冒充已保存。
 * 配件栏是销售额，不读工资草案，也不把提成乘 30%。
 */
export default function PersonStoreTargetForm({
  month,
  stores,
  people,
  existing,
  persist,
  tableMissing,
}: {
  month: string;
  stores: StoreOption[];
  people: TargetPersonOption[];
  existing: MonthlySalesTarget[];
  persist: boolean;
  tableMissing: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState(people.find((person) => person.employment_status === "在职")?.id ?? people[0]?.id ?? "");
  const [recycle, setRecycle] = useState("");
  const [accessories, setAccessories] = useState("");
  const [msg, setMsg] = useState<string | null>(tableMissing ? TARGET_TABLE_MISSING_MESSAGE : null);
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => new Map(people.map((person) => [person.id, person.person_name])), [people]);
  const storeNames = useMemo(() => new Map(stores.map((store) => [store.id, store.name])), [stores]);
  const monthRows = existing.filter((row) => row.month === month);

  useEffect(() => {
    const found = existing.find(
      (row) => row.month === month && row.store_id === storeId && row.employee_id === employeeId,
    );
    setRecycle(found ? amountText(found.recycle_target) : "");
    setAccessories(found ? amountText(found.accessories_sales_target) : "");
  }, [existing, month, storeId, employeeId]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!persist) {
      setMsg(TARGET_OFFLINE_MESSAGE);
      return;
    }
    const parsed = parseMonthlySalesTargetWrite({
      month,
      store_id: storeId,
      employee_id: employeeId,
      recycle_target: recycle,
      accessories_sales_target: accessories,
    });
    if (!parsed.ok) {
      setMsg(parsed.error);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = await createBrowserSupabase();
      const { error } = await supabase.from(MONTHLY_SALES_TARGETS_TABLE).upsert(parsed.value, {
        onConflict: "month,store_id,employee_id",
      });
      if (error) {
        setMsg(isMissingMonthlySalesTargetsError(error) ? TARGET_TABLE_MISSING_MESSAGE : `保存失败，没有写入：${error.message}`);
        return;
      }
      setMsg(TARGET_SAVED_MESSAGE);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      setMsg(isMissingMonthlySalesTargetsError(err) ? TARGET_TABLE_MISSING_MESSAGE : `保存失败，没有写入：${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ov-panel ov-target" aria-label="设目标">
      <div className="ov-panel-head">
        <h2>设目标</h2>
        <span>人 × 店 × 月</span>
      </div>
      <p className="ov-fold-note ov-target-note">
        写入回收目标与配件销售额。配件不使用提成，也不按提成的 30% 估算。离职人员的目标不计入达成率。
      </p>
      {monthRows.length === 0 ? (
        <p className="empty" style={{ padding: 0 }}>
          {month} 还没有写入人店目标
        </p>
      ) : (
        <ul className="ov-target-list">
          {monthRows.map((row) => (
            <li key={`${row.store_id}:${row.employee_id}`}>
              <span>{names.get(row.employee_id) ?? "员工不在测算名单"}</span>
              <span>{storeNames.get(row.store_id) ?? row.store_id}</span>
              <span>回收目标 {money2(row.recycle_target)} 元</span>
              <span>配件销售目标 {money2(row.accessories_sales_target)} 元</span>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)} disabled={people.length === 0 || stores.length === 0}>
          设定{month}目标
        </button>
      ) : (
        <form onSubmit={onSave}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="person-target-month">月份</label>
              <input id="person-target-month" value={month} readOnly />
            </div>
            <div className="field">
              <label htmlFor="person-target-store">门店</label>
              <select
                id="person-target-store"
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="person-target-person">员工</label>
              <select
                id="person-target-person"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.person_name}
                    {person.employment_status === "离职" ? "（离职）" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="person-target-recycle">回收目标（元）</label>
              <input
                id="person-target-recycle"
                value={recycle}
                onChange={(event) => setRecycle(event.target.value)}
                inputMode="decimal"
                placeholder="如：20000"
              />
            </div>
            <div className="field">
              <label htmlFor="person-target-accessories">配件销售目标（元）</label>
              <input
                id="person-target-accessories"
                value={accessories}
                onChange={(event) => setAccessories(event.target.value)}
                inputMode="decimal"
                placeholder="销售额，不是提成"
              />
            </div>
          </div>
          <button type="submit" className="btn" disabled={busy || people.length === 0}>
            保存目标
          </button>
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={() => setOpen(false)}>
            收起
          </button>
        </form>
      )}
      {people.length === 0 ? <p className="ov-fold-note">测算名单为空，不能设目标。</p> : null}
      {msg ? (
        <div className="access-msg" role="status">
          {msg}
        </div>
      ) : null}
    </section>
  );
}
