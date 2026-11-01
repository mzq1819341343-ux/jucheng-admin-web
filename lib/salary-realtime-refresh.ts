/** 员工表保存成功后，请人效卡重新 GET /api/salary/realtime。不携带草案行。 */
export const SALARY_REALTIME_REFRESH_EVENT = "jucheng-salary-realtime-refresh";

export function requestSalaryRealtimeRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SALARY_REALTIME_REFRESH_EVENT));
}
