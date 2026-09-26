"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { FormNav, MobileTabs } from "@/components/builder/form-nav";

export interface AnalyticsData {
  views: number;
  starts: number;
  completed: number;
  qualified: number;
  disqualified: number;
  avgScore: number;
  questions: { id: string; index: number; title: string; count: number }[];
  daily: { date: string; starts: number; qualified: number }[];
}

const EASE = [0.22, 1, 0.36, 1] as const;

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export function Analytics({ form, data }: { form: { id: string; title: string }; data: AnalyticsData }) {
  const tiles = [
    { label: "Views", value: data.views.toLocaleString(), sub: "Unique sessions" },
    { label: "Starts", value: data.starts.toLocaleString(), sub: `${pct(data.starts, data.views)}% of views` },
    { label: "Completion rate", value: `${pct(data.completed, data.starts)}%`, sub: `${data.completed} finished` },
    { label: "Qualified", value: data.qualified.toLocaleString(), sub: `${pct(data.qualified, data.completed)}% of completions` },
    { label: "Average score", value: data.avgScore.toLocaleString(), sub: "Completed leads" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <FormNav formId={form.id} active="analytics" title={<span className="block truncate px-2 text-[14px] font-medium">{form.title}</span>} />
      <MobileTabs formId={form.id} active="analytics" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <h1 className="font-serif text-4xl">Analytics</h1>
          <p className="mt-2 text-sm text-dim">How people move through your funnel — and where they leave.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
          className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5"
        >
          {tiles.map((t) => (
            <div key={t.label} className="bg-panel px-5 py-5">
              <p className="text-[12px] text-dim">{t.label}</p>
              <p className="mt-2 text-[28px] leading-none font-medium tracking-tight tabular-nums">{t.value}</p>
              <p className="mt-2 text-[11.5px] text-faint">{t.sub}</p>
            </div>
          ))}
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <Card title="Responses · last 30 days" className="lg:col-span-3" delay={0.12}>
            <DailyChart daily={data.daily} />
          </Card>
          <Card title="Outcomes" className="lg:col-span-2" delay={0.16}>
            <Outcomes data={data} />
          </Card>
        </div>

        <Card title="Drop-off by question" className="mt-6" delay={0.2}>
          <DropOff data={data} />
        </Card>
      </main>
    </div>
  );
}

function Card({ title, children, className = "", delay = 0 }: { title: string; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      className={`card p-6 ${className}`}
    >
      <h2 className="text-[13px] font-medium text-fg">{title}</h2>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-[13px] text-faint">{text}</div>;
}

/* ------------------------------------------------------------------ */

function DailyChart({ daily }: { daily: AnalyticsData["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.starts));
  const total = daily.reduce((s, d) => s + d.starts, 0);
  if (!total) return <Empty text="No responses in the last 30 days" />;
  const h = hover !== null ? daily[hover] : null;
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      <div className="mb-3 h-5 text-[12px] text-dim">
        {h ? (
          <span>
            <span className="text-fg">{label(h.date)}</span> · {h.starts} response{h.starts === 1 ? "" : "s"} · {h.qualified} qualified
          </span>
        ) : (
          <span>
            <span className="text-fg tabular-nums">{total}</span> responses · peak {max}/day
          </span>
        )}
      </div>
      <div className="relative">
        {/* Recessive gridlines */}
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2 right-0 translate-x-full pl-2 text-[10px] text-faint tabular-nums">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="flex h-44 items-end gap-[2px] pr-6" onMouseLeave={() => setHover(null)}>
          {daily.map((d, i) => (
            <div key={d.date} className="relative flex h-full flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.starts / max) * 100}%` }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.012 }}
                className="w-full rounded-t-[4px] transition-colors"
                style={{ minHeight: d.starts ? 3 : 0, background: hover === i ? "#ffffff" : hover === null ? "#d4d4d4" : "#5a5a5a" }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pr-6 text-[10.5px] text-faint">
        <span>{label(daily[0].date)}</span>
        <span>{label(daily[Math.floor(daily.length / 2)].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Outcomes({ data }: { data: AnalyticsData }) {
  const partial = data.starts - data.completed;
  const neutral = data.completed - data.qualified - data.disqualified;
  const segments = [
    { key: "qualified", label: "Qualified", value: data.qualified, color: "var(--color-good)" },
    { key: "disqualified", label: "Disqualified", value: data.disqualified, color: "var(--color-bad)" },
    { key: "completed", label: "Completed", value: neutral, color: "#a1a1a1" },
    { key: "partial", label: "Didn't finish", value: partial, color: "#3a3a3a" },
  ].filter((s) => s.value > 0);
  if (!data.starts) return <Empty text="No responses yet" />;

  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
        {segments.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: s.value }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.05 }}
            className="h-full basis-0"
            style={{ background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-[13px]">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
            <span className="flex-1 text-dim">{s.label}</span>
            <span className="font-medium text-fg tabular-nums">{s.value}</span>
            <span className="w-10 text-right text-faint tabular-nums">{pct(s.value, data.starts)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DropOff({ data }: { data: AnalyticsData }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!data.starts) return <Empty text="Drop-off appears once people start your form" />;
  const base = Math.max(data.starts, 1);
  const rows = [
    ...data.questions.map((q) => ({ id: q.id, label: `${q.index}. ${q.title || "Untitled"}`, count: q.count })),
    { id: "__done", label: "Completed", count: data.completed },
  ];

  return (
    <div className="space-y-1" onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex text-[11px] tracking-wide text-faint uppercase">
        <span className="flex-1">Step</span>
        <span className="w-24 text-right">Reached</span>
        <span className="hidden w-20 text-right sm:block">Drop</span>
      </div>
      {rows.map((r, i) => {
        const prev = i === 0 ? data.starts : rows[i - 1].count;
        const drop = prev ? Math.round(((prev - r.count) / prev) * 100) : 0;
        const width = (r.count / base) * 100;
        const active = hover === r.id;
        return (
          <div
            key={r.id}
            onMouseEnter={() => setHover(r.id)}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${active ? "bg-raised" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[13px] ${r.id === "__done" ? "font-medium text-fg" : "text-dim"}`}>{r.label}</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-line/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.04 }}
                  className="h-full rounded-full"
                  style={{ background: active ? "#ffffff" : "#cfcfcf" }}
                />
              </div>
            </div>
            <span className="w-24 text-right text-[13px] tabular-nums">
              <span className="font-medium text-fg">{r.count}</span>
              <span className="ml-1.5 text-faint">{pct(r.count, base)}%</span>
            </span>
            <span className={`hidden w-20 text-right text-[12px] tabular-nums sm:block ${drop >= 25 ? "text-warn" : "text-faint"}`}>
              {i === 0 && drop === 0 ? "—" : drop > 0 ? `−${drop}%` : "0%"}
            </span>
          </div>
        );
      })}
      <p className="px-2 pt-3 text-[11.5px] text-faint">
        Percentages are of everyone who started. Questions skipped by conditional logic will naturally show fewer people.
      </p>
    </div>
  );
}
