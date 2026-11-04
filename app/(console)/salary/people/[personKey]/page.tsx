"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { money2 } from "@/lib/format";
import {
  isYearMonth,
  shanghaiYearMonth,
  type RealtimeSalaryPerson,
  type RealtimeSalaryResponse,
} from "@/lib/salary-realtime";

type Phase = "loading" | "ready" | "missing" | "error";

function messageFor(status: number): string {
  if (status === 401) return "未登录，无法读取实时工资草案";
  if (status === 403) return "当前角色无权查看实时工资草案";
  return "实时工资草案读取失败";
}

function personKeyFromParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function PersonMonthPage() {
  const params = useParams<{ personKey: string }>();
  const search = useSearchParams();
  const personKey = personKeyFromParam(params.personKey);
  const requested = search.get("month");
  const month = isYearMonth(requested) ? requested : shanghaiYearMonth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [person, setPerson] = useState<RealtimeSalaryPerson | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    setPerson(null);
    setMessage("");
    fetch(`/api/salary/realtime?month=${encodeURIComponent(month)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          setPhase("error");
          setMessage(messageFor(res.status));
          return;
        }
        const body = (await res.json()) as RealtimeSalaryResponse;
        const found = Array.isArray(body?.people)
          ? body.people.find((row) => row.person_key === personKey) ?? null
          : null;
        setPerson(found);
        setPhase(found ? "ready" : "missing");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPhase("error");
        setMessage("实时工资草案读取失败");
      });
    return () => ctrl.abort();
  }, [month, personKey]);

  const back = `/salary?month=${month}#salary-people`;

  return (
    <main className="container calm no-enter salary-page person-month">
      <div className="eyebrow">
        <span className="eyebrow-cn">员工业绩</span>
      </div>
      <h1 className="page-title">{personKey || "员工"}</h1>
      <p className="page-desc">
        <Link href={back}>{month} · 返回按人草案</Link>
      </p>

      <section className="pm-month" aria-label="月度">
        <h2 className="section-title">月度</h2>
        {phase === "loading" ? <div className="skel skel-block" aria-hidden="true" /> : null}
        {phase === "error" ? <p className="empty">{message}</p> : null}
        {phase === "missing" ? <p className="empty">暂无</p> : null}
        {phase === "ready" && person ? <MonthFields person={person} /> : null}
      </section>

      <section className="pm-daily" aria-label="按日">
        <h2 className="section-title">按日</h2>
        <p>暂无</p>
        <p className="pm-note">台账无按日明细</p>
      </section>
    </main>
  );
}

function MonthFields({ person }: { person: RealtimeSalaryPerson }) {
  const fields: { label: string; value: number }[] = [
    { label: "底薪", value: person.base },
    { label: "上门", value: person.door },
    { label: "线上", value: person.online },
    { label: "门店", value: person.store },
    { label: "配件", value: person.accessories },
    { label: "应发", value: person.gross },
    { label: "失误", value: person.mistake_total },
  ];
  if (typeof person.subsidy === "number") fields.push({ label: "补贴", value: person.subsidy });
  if (typeof person.bonus === "number") fields.push({ label: "奖金", value: person.bonus });
  return (
    <div className="pm-grid">
      {fields.map((field) => (
        <article className="pm-field" key={field.label}>
          <div className="pm-label">{field.label}</div>
          <div className="pm-value">{money2(field.value)} 元</div>
        </article>
      ))}
    </div>
  );
}
