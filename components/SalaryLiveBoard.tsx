"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RealtimePayrollCard from "@/components/RealtimePayrollCard";
import SalaryDashboardCard from "@/components/SalaryDashboardCard";
import { isYearMonth, shanghaiYearMonth } from "@/lib/salary-realtime";

export default function SalaryLiveBoard({ role }: { role: "owner" | "partner" }) {
  const router = useRouter();
  const requested = useSearchParams().get("month");
  const [month, setMonth] = useState(isYearMonth(requested) ? requested : shanghaiYearMonth());
  const confirmRef = useRef<() => boolean>(() => true);

  function commitMonth(next: string) {
    setMonth(next);
    router.replace(`/salary?month=${next}#salary-people`, { scroll: false });
  }

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
              commitMonth(next);
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
