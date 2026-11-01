/**
 * 员工表保存成功之后，浏览器怎么跟服务端 Route 说话。
 * 这里没有密钥，也不写草案表。
 */

export const DRAFT_GATE_CLOSED_MESSAGE = "占位闸未开";

/** 底薪变了走同步；在职且底薪未变走占位；非在职且底薪未变不调用。 */
export function chooseEmployeeDraftMode(
  previous: { base_salary: number } | null,
  next: { base_salary: number; employment_status: "在职" | "离职" },
): "ensure" | "sync" | null {
  if (previous && Math.round(previous.base_salary * 100) !== Math.round(next.base_salary * 100)) return "sync";
  if (next.employment_status === "在职") return "ensure";
  return null;
}

export interface DraftFollowUp {
  tone: "muted" | "error" | "ok";
  text: string;
}

export function draftFollowUpFromResponse(status: number, body: unknown): DraftFollowUp {
  const rec = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (rec.code === "gate_closed" || rec.error === "未开闸") {
    return { tone: "muted", text: DRAFT_GATE_CLOSED_MESSAGE };
  }
  const failed = status < 200 || status >= 300 || rec.ok === false;
  if (failed) {
    const reason = typeof rec.error === "string" && rec.error.trim() ? rec.error : "草案没有写入";
    return { tone: "error", text: `草案未写入：${reason}` };
  }
  if (
    rec.wrote === true &&
    (rec.action === "insert" || rec.action === "patch" || rec.action === "placeholder_then_patch")
  ) {
    return {
      tone: "ok",
      text: rec.action === "insert" ? "已写入当月草案占位" : "已同步当月底薪",
    };
  }
  if (rec.action === "skip" && rec.wrote === false) {
    return { tone: "muted", text: "当月草案已有该人，未改原行" };
  }
  return { tone: "error", text: "草案未写入" };
}
