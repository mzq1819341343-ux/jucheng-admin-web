import type { CommissionRuleLine } from "@/lib/commission-rules";

/** 「工资怎么算」与工资体系表共用的一行提成文案。 */
export default function CommissionRuleText({ line }: { line: CommissionRuleLine }) {
  const content = (
    <>
      {line.label ? <strong>{line.label}</strong> : null}
      {line.body}
      {line.note ? <span style={{ color: "var(--muted)" }}>（{line.note}）</span> : null}
    </>
  );
  if (!line.muted) return content;
  return <span style={{ color: "var(--muted)" }}>{content}</span>;
}
