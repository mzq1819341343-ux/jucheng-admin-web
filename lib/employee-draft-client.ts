/**
 * 浏览器只调用本仓 Route。不持有 service role，不直接写草案表。
 */

import { draftFollowUpFromResponse, type DraftFollowUp } from "./employee-draft-ui";

export async function postEmployeeDraft(body: {
  mode: "ensure" | "sync";
  person_name: string;
  base_salary: number;
  work_role: string;
  employment_status: string;
  user_id: string | null;
}): Promise<DraftFollowUp> {
  try {
    const res = await fetch("/api/salary/employee-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    return draftFollowUpFromResponse(res.status, payload);
  } catch {
    return { tone: "error", text: "草案未写入：网络失败" };
  }
}
