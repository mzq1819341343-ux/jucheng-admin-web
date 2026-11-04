"use client";

import { useRef, useState } from "react";
import RealtimePayrollCard from "@/components/RealtimePayrollCard";
import SalaryDashboardCard from "@/components/SalaryDashboardCard";
import { isYearMonth, shanghaiYearMonth } from "@/lib/salary-realtime";

/**
 * 工资页主视线：一个月份，汇总指标在上，按人草案在下。
 * 月份切换先问未保存的手填，再让两块读同一月。
 */
export default function SalaryLiveBoard({ role }: { role: "owner" | "partner" }) {
  const [month, setMonth] = useState(shanghaiYearMonth);
  const confirmRef = useRef<() => boolean>(() => true);

  return (
    <section className="salary-main" aria-label="实时工资">
      <div className="salary-toolbar">
        <div className="field salary-month">
          <label htmlFor="salary-live-month">月份</label>
          <input
            id="salary-live-month"
            type="month"
            value={month}
            onChange={(event) => {
              const next = event.target.value;
              if (!isYearMonth(next) || next === month) {
                event.target.value = month;
                return;
              }
              if (!confirmRef.current()) {
                event.target.value = month;
                return;
              }
              setMonth(next);
            }}
          />
        </div>
        <div className="salary-actions-row">
          <button type="button" className="btn btn-ghost" disabled>
            下载工资表
          </button>
          <button type="button" className="btn btn-ghost" disabled>
            录入模板
          </button>
        </div>
      </div>
      <div className="salary-metrics-block">
        <h2 className="section-title">汇总</h2>
        <SalaryDashboardCard month={month} metricsOnly />
      </div>
      <RealtimePayrollCard role={role} summary="table" month={month} confirmRef={confirmRef} />
    </section>
  );
}
