"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CircleAlert, Copy, GitBranch, Plus, Trash2, X } from "lucide-react";
import { AutoTextarea, Field, NumberInput, Section, Segmented, Toggle } from "@/components/ui/controls";
import { operatorsFor, QUESTION_TYPES } from "@/lib/engine";
import { uid } from "@/lib/id";
import { choice, newQuestion } from "@/lib/templates";
import type { Ending, EndingKind, FormSchema, LeadField, LogicRule, Question, QuestionType, Welcome } from "@/lib/types";
import { ENDING_LABELS } from "./icons";

const RECALL_HINT = (
  <>
    Tip: type <code className="rounded bg-raised px-1 text-dim">{"{name}"}</code> to greet leads by name. Also{" "}
    <code className="rounded bg-raised px-1 text-dim">{"{company}"}</code>, <code className="rounded bg-raised px-1 text-dim">{"{email}"}</code>.
  </>
);

/* ------------------------------------------------------------------ */
/* Question                                                            */
/* ------------------------------------------------------------------ */

export function QuestionInspector({
  q,
  schema,
  onChange,
  onDelete,
  onDuplicate,
}: {
  q: Question;
  schema: FormSchema;
  onChange: (q: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const set = <K extends keyof Question>(k: K, v: Question[K]) => onChange({ ...q, [k]: v });
  const scoring = schema.settings.scoringEnabled;

  const changeType = (type: QuestionType) => {
    if (type === q.type) return;
    const fresh = newQuestion(type);
    onChange({
      ...fresh,
      id: q.id,
      title: q.title,
      description: q.description,
      required: type === "statement" ? false : q.required,
      leadField: ["short_text", "email", "phone", "website"].includes(type) ? fresh.leadField ?? q.leadField : null,
      logic: [],
    });
  };

  const textual = ["short_text", "long_text", "email", "phone", "website", "number"].includes(q.type);

  return (
    <div>
      <Section title="Content">
        <Field label="Type">
          <select className="input" value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Question" hint={RECALL_HINT}>
          <AutoTextarea value={q.title} onChange={(v) => set("title", v)} placeholder="Ask something…" />
        </Field>
        <Field label="Description">
          <AutoTextarea
            value={q.description ?? ""}
            onChange={(v) => set("description", v || undefined)}
            placeholder="Optional context"
            minRows={1}
          />
        </Field>
        {textual && q.type !== "number" && (
          <Field label="Placeholder">
            <input className="input" value={q.placeholder ?? ""} onChange={(e) => set("placeholder", e.target.value || undefined)} />
          </Field>
        )}
        {(textual || q.type === "statement" || (q.type === "multiple_choice" && q.allowMultiple)) && (
          <Field label="Button label">
            <input
              className="input"
              value={q.buttonLabel ?? ""}
              placeholder={q.type === "statement" ? "Continue" : "OK"}
              onChange={(e) => set("buttonLabel", e.target.value || undefined)}
            />
          </Field>
        )}
        {q.type !== "statement" && <Toggle label="Required" checked={q.required} onChange={(v) => set("required", v)} />}
      </Section>

      {q.type === "multiple_choice" && <ChoicesEditor q={q} scoring={scoring} onChange={onChange} />}

      {q.type === "number" && (
        <Section title="Limits">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min">
              <NumberInput value={q.min} onChange={(v) => set("min", v)} placeholder="None" />
            </Field>
            <Field label="Max">
              <NumberInput value={q.max} onChange={(v) => set("max", v)} placeholder="None" />
            </Field>
          </div>
        </Section>
      )}

      {q.type === "yes_no" && (
        <Section title="Scoring">
          <ScoringDisabledNote enabled={scoring} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Points for Yes">
              <NumberInput value={q.yesScore ?? 0} onChange={(v) => set("yesScore", v ?? 0)} />
            </Field>
            <Field label="Points for No">
              <NumberInput value={q.noScore ?? 0} onChange={(v) => set("noScore", v ?? 0)} />
            </Field>
          </div>
        </Section>
      )}

      {q.type === "rating" && (
        <Section title="Scale">
          <Segmented
            value={q.ratingMax ?? 10}
            options={[
              { value: 5, label: "1 – 5" },
              { value: 10, label: "1 – 10" },
            ]}
            onChange={(v) => set("ratingMax", v as 5 | 10)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Low label">
              <input
                className="input"
                value={q.ratingLabels?.low ?? ""}
                onChange={(e) => set("ratingLabels", { ...q.ratingLabels, low: e.target.value || undefined })}
              />
            </Field>
            <Field label="High label">
              <input
                className="input"
                value={q.ratingLabels?.high ?? ""}
                onChange={(e) => set("ratingLabels", { ...q.ratingLabels, high: e.target.value || undefined })}
              />
            </Field>
          </div>
          <Field label="Points per step" hint={`Score = rating × points. A ${q.ratingMax ?? 10} earns ${(q.ratingMax ?? 10) * (q.ratingWeight ?? 0)} points.`}>
            <NumberInput value={q.ratingWeight ?? 0} onChange={(v) => set("ratingWeight", v ?? 0)} />
          </Field>
        </Section>
      )}

      {q.type !== "statement" && q.type !== "multiple_choice" && q.type !== "yes_no" && q.type !== "rating" && (
        <Section title="Lead field">
          <Field label="Save this answer as" hint="Mapped fields appear as columns in Leads and prefill the booking calendar.">
            <select
              className="input"
              value={q.leadField ?? ""}
              onChange={(e) => set("leadField", (e.target.value || null) as LeadField | null)}
            >
              <option value="">Not mapped</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="company">Company</option>
            </select>
          </Field>
        </Section>
      )}

      {q.type !== "statement" && <LogicEditor q={q} schema={schema} onChange={(logic) => set("logic", logic)} />}

      <div className="flex gap-2 px-5 py-5">
        <button className="btn-secondary flex-1" onClick={onDuplicate}>
          <Copy className="size-3.5" /> Duplicate
        </button>
        <button className="btn-secondary flex-1 hover:border-bad/50 hover:text-bad" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

function ScoringDisabledNote({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warn/20 bg-warn/5 px-3 py-2 text-[12px] text-warn">
      <CircleAlert className="mt-px size-3.5 shrink-0" />
      Lead scoring is off. Turn it on under Form → Qualification.
    </p>
  );
}

function ChoicesEditor({ q, scoring, onChange }: { q: Question; scoring: boolean; onChange: (q: Question) => void }) {
  const choices = q.choices ?? [];
  const update = (id: string, patch: Partial<{ label: string; score: number }>) =>
    onChange({ ...q, choices: choices.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const remove = (id: string) =>
    onChange({
      ...q,
      choices: choices.filter((c) => c.id !== id),
      logic: q.logic.filter((r) => r.value !== id),
    });

  return (
    <Section
      title="Choices"
      action={scoring ? <span className="text-[11px] text-faint">Points</span> : undefined}
    >
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {choices.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="group flex items-center gap-1.5"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded border border-line-strong text-[10px] font-semibold text-dim">
                {String.fromCharCode(65 + i)}
              </span>
              <input
                className="input h-8"
                value={c.label}
                placeholder={`Choice ${i + 1}`}
                onChange={(e) => update(c.id, { label: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onChange({ ...q, choices: [...choices.slice(0, i + 1), choice(""), ...choices.slice(i + 1)] });
                }}
              />
              {scoring && (
                <input
                  type="number"
                  className="input h-8 w-16 shrink-0 px-2 text-center tabular-nums"
                  value={c.score}
                  onChange={(e) => update(c.id, { score: Number(e.target.value) || 0 })}
                  title="Points"
                />
              )}
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={choices.length <= 1}
                className="btn-icon size-7 shrink-0 disabled:opacity-20"
                title="Remove"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button type="button" className="btn-ghost h-8 px-2" onClick={() => onChange({ ...q, choices: [...choices, choice("")] })}>
        <Plus className="size-3.5" /> Add choice
      </button>
      <Toggle
        label="Allow multiple selections"
        description={q.allowMultiple ? "Points from every selected choice are added up." : "Selecting a choice advances automatically."}
        checked={!!q.allowMultiple}
        onChange={(v) => onChange({ ...q, allowMultiple: v })}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Logic                                                               */
/* ------------------------------------------------------------------ */

function LogicEditor({ q, schema, onChange }: { q: Question; schema: FormSchema; onChange: (rules: LogicRule[]) => void }) {
  const ops = operatorsFor(q);
  const idx = schema.questions.findIndex((x) => x.id === q.id);
  const targets = [
    ...schema.questions
      .map((x, i) => ({ x, i }))
      .filter(({ x }) => x.id !== q.id)
      .map(({ x, i }) => ({ id: x.id, label: `${i + 1}. ${x.title || "Untitled"}`, group: "Questions", backwards: i < idx })),
    ...schema.endings.map((e) => ({ id: e.id, label: `${ENDING_LABELS[e.kind]}: ${e.title || "Untitled"}`, group: "Endings", backwards: false })),
  ];

  const defaultValue = () => {
    if (q.type === "multiple_choice") return q.choices?.[0]?.id ?? "";
    if (q.type === "yes_no") return "yes";
    return "";
  };
  const add = () => {
    const disq = schema.endings.find((e) => e.kind === "disqualified");
    onChange([...q.logic, { id: uid(), op: ops[0].op, value: defaultValue(), target: disq?.id ?? targets[0]?.id ?? "" }]);
  };
  const update = (id: string, patch: Partial<LogicRule>) => onChange(q.logic.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const next = schema.questions[idx + 1];
  return (
    <Section
      title="Conditional logic"
      action={
        <button type="button" className="btn-ghost -mr-2 h-7 px-2 text-[12px]" onClick={add}>
          <Plus className="size-3.5" /> Rule
        </button>
      }
    >
      {q.logic.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-left transition-colors hover:border-neutral-500 hover:bg-raised"
        >
          <GitBranch className="size-4 shrink-0 text-faint" />
          <span className="text-[12px] leading-snug text-dim">
            Route leads based on this answer — e.g. send low budgets straight to the disqualified ending.
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {q.logic.map((r) => {
              const op = ops.find((o) => o.op === r.op) ?? ops[0];
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-2 rounded-xl border border-line bg-ink p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-wide text-faint uppercase">If answer</span>
                    <button className="btn-icon size-6" onClick={() => onChange(q.logic.filter((x) => x.id !== r.id))} title="Remove rule">
                      <X className="size-3" />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      className="input h-8 w-auto shrink-0"
                      value={r.op}
                      onChange={(e) => update(r.id, { op: e.target.value as LogicRule["op"] })}
                    >
                      {ops.map((o) => (
                        <option key={o.op} value={o.op}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {op?.needsValue &&
                      (q.type === "multiple_choice" ? (
                        <select className="input h-8 min-w-0" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })}>
                          {(q.choices ?? []).map((c, i) => (
                            <option key={c.id} value={c.id}>
                              {c.label || `Choice ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      ) : q.type === "yes_no" ? (
                        <select className="input h-8 min-w-0" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : (
                        <input
                          className="input h-8 min-w-0"
                          type={q.type === "number" || q.type === "rating" ? "number" : "text"}
                          value={r.value}
                          placeholder="Value"
                          onChange={(e) => update(r.id, { value: e.target.value })}
                        />
                      ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="size-3.5 shrink-0 text-faint" />
                    <select className="input h-8 min-w-0" value={r.target} onChange={(e) => update(r.id, { target: e.target.value })}>
                      {["Questions", "Endings"].map((g) => (
                        <optgroup key={g} label={g}>
                          {targets
                            .filter((t) => t.group === g)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label.length > 44 ? `${t.label.slice(0, 44)}…` : t.label}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {targets.find((t) => t.id === r.target)?.backwards && (
                    <p className="text-[11px] text-warn">Jumps backwards — make sure this can't loop forever.</p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <p className="px-1 text-[11.5px] text-faint">
            Otherwise → {next ? `continue to ${idx + 2}. ${next.title || "Untitled"}` : "score-based ending"}
          </p>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Ending & welcome                                                    */
/* ------------------------------------------------------------------ */

export function EndingInspector({
  ending,
  schema,
  onChange,
  onDelete,
}: {
  ending: Ending;
  schema: FormSchema;
  onChange: (e: Ending) => void;
  onDelete?: () => void;
}) {
  const set = <K extends keyof Ending>(k: K, v: Ending[K]) => onChange({ ...ending, [k]: v });
  const kindHint: Record<EndingKind, string> = {
    qualified: "Leads scoring at or above your threshold land here and are marked Qualified.",
    disqualified: "Leads below your threshold (or routed here by logic) are marked Disqualified.",
    default: "Neutral ending used when scoring is off.",
  };
  return (
    <div>
      <Section title="Ending">
        <Field label="Outcome" hint={kindHint[ending.kind]}>
          <Segmented
            value={ending.kind}
            options={[
              { value: "qualified", label: "Qualified" },
              { value: "disqualified", label: "Disqualified" },
              { value: "default", label: "Neutral" },
            ]}
            onChange={(v) => onChange({ ...ending, kind: v, showCalendar: v === "qualified" ? ending.showCalendar : false })}
          />
        </Field>
        <Field label="Title" hint={RECALL_HINT}>
          <AutoTextarea value={ending.title} onChange={(v) => set("title", v)} />
        </Field>
        <Field label="Message">
          <AutoTextarea value={ending.description ?? ""} onChange={(v) => set("description", v || undefined)} placeholder="Optional" />
        </Field>
      </Section>
      <Section title="Next step">
        <Toggle
          label="Show booking calendar"
          description="Embeds your Calendly or Cal.com page, prefilled with the lead's name and email."
          checked={ending.showCalendar}
          onChange={(v) => set("showCalendar", v)}
        />
        {ending.showCalendar && !schema.settings.calendarUrl && (
          <p className="flex items-start gap-2 rounded-lg border border-warn/20 bg-warn/5 px-3 py-2 text-[12px] text-warn">
            <CircleAlert className="mt-px size-3.5 shrink-0" />
            Add your calendar link under Form → Booking.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Button label">
            <input className="input" value={ending.buttonLabel ?? ""} placeholder="None" onChange={(e) => set("buttonLabel", e.target.value || undefined)} />
          </Field>
          <Field label="Button link">
            <input className="input" value={ending.buttonUrl ?? ""} placeholder="https://" onChange={(e) => set("buttonUrl", e.target.value || undefined)} />
          </Field>
        </div>
        <Field label="Auto-redirect to" hint="Leave empty to stay on this screen.">
          <input className="input" value={ending.redirectUrl ?? ""} placeholder="https://" onChange={(e) => set("redirectUrl", e.target.value || undefined)} />
        </Field>
      </Section>
      {onDelete && (
        <div className="px-5 py-5">
          <button className="btn-secondary w-full hover:border-bad/50 hover:text-bad" onClick={onDelete}>
            <Trash2 className="size-3.5" /> Delete ending
          </button>
        </div>
      )}
    </div>
  );
}

export function WelcomeInspector({ welcome, onChange }: { welcome: Welcome; onChange: (w: Welcome) => void }) {
  const set = <K extends keyof Welcome>(k: K, v: Welcome[K]) => onChange({ ...welcome, [k]: v });
  return (
    <Section title="Welcome screen">
      <Toggle label="Show welcome screen" checked={welcome.enabled} onChange={(v) => set("enabled", v)} />
      <Field label="Headline">
        <AutoTextarea value={welcome.title} onChange={(v) => set("title", v)} />
      </Field>
      <Field label="Description">
        <AutoTextarea value={welcome.description ?? ""} onChange={(v) => set("description", v || undefined)} placeholder="Optional" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Button">
          <input className="input" value={welcome.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} />
        </Field>
        <Field label="Time estimate">
          <input
            className="input"
            value={welcome.timeToComplete ?? ""}
            placeholder="Takes 2 minutes"
            onChange={(e) => set("timeToComplete", e.target.value || undefined)}
          />
        </Field>
      </div>
    </Section>
  );
}
