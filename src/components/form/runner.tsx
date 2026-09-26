"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { leadFields, nextStep, recall, validateAnswer } from "@/lib/engine";
import type { Answer, Answers, FormSchema } from "@/lib/types";
import { EndingView, FormShell, QuestionView, WelcomeView } from "./views";

type Stage = { kind: "welcome" } | { kind: "question"; id: string } | { kind: "ending"; id: string };

const EASE = [0.22, 1, 0.36, 1] as const;

function initialStage(schema: FormSchema): Stage {
  if (schema.welcome.enabled) return { kind: "welcome" };
  if (schema.questions[0]) return { kind: "question", id: schema.questions[0].id };
  return { kind: "ending", id: schema.endings[0]?.id ?? "" };
}

export function FormRunner({
  schema,
  mode,
  slug,
  className = "h-dvh",
  onClose,
}: {
  schema: FormSchema;
  mode: "live" | "preview";
  slug?: string;
  className?: string;
  onClose?: () => void;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>(() => initialStage(schema));
  const [history, setHistory] = useState<string[]>(() =>
    !schema.welcome.enabled && schema.questions[0] ? [schema.questions[0].id] : [],
  );
  const [answers, setAnswers] = useState<Answers>({});
  const [dir, setDir] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  // Release focus from whatever opened the form (e.g. the builder's Preview
  // button) so keyboard shortcuts like Enter go to the form.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  /* ---------------- persistence (live mode only) ---------------- */
  const responseId = useRef<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (mode !== "live" || !slug) return;
    const key = `lq:viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch(`/api/f/${slug}/view`, { method: "POST" }).catch(() => {});
  }, [mode, slug]);

  const persist = useCallback(
    (payload: { answers: Answers; path: string[]; lastStepId: string; complete: boolean }) => {
      if (mode !== "live" || !slug) return;
      queue.current = queue.current.then(async () => {
        try {
          if (!responseId.current) {
            const params = new URLSearchParams(window.location.search);
            const utm: Record<string, string> = {};
            params.forEach((v, k) => {
              if (k.startsWith("utm_")) utm[k] = v;
            });
            const res = await fetch(`/api/f/${slug}/responses`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, referrer: document.referrer || undefined, utm }),
              keepalive: true,
            });
            if (res.ok) responseId.current = ((await res.json()) as { id: string }).id;
          } else {
            await fetch(`/api/f/${slug}/responses/${responseId.current}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              keepalive: true,
            });
          }
        } catch {
          // Network hiccups shouldn't interrupt the respondent.
        }
      });
    },
    [mode, slug],
  );

  /* ---------------- navigation ---------------- */
  const fields = useMemo(() => leadFields(schema, answers), [schema, answers]);
  const current = stage.kind === "question" ? schema.questions.find((q) => q.id === stage.id) : undefined;
  const currentIndex = current ? schema.questions.indexOf(current) : -1;

  const go = (next: Stage, direction: 1 | -1) => {
    setDir(direction);
    setError(null);
    setStage(next);
  };

  const start = () => {
    const first = schema.questions[0];
    if (!first) return go({ kind: "ending", id: schema.endings[0]?.id ?? "" }, 1);
    setHistory([first.id]);
    go({ kind: "question", id: first.id }, 1);
  };

  const submit = (value?: Answer) => {
    if (!current || busy.current) return;
    const a = value !== undefined ? value : answers[current.id];
    const err = validateAnswer(current, a);
    if (err) {
      setError(err);
      setErrorKey((k) => k + 1);
      return;
    }
    const nextAnswers = { ...answers };
    if (a === undefined) delete nextAnswers[current.id];
    else nextAnswers[current.id] = a;
    setAnswers(nextAnswers);

    const step = nextStep(schema, current.id, nextAnswers, history.slice(0, -1));
    const complete = step.kind === "ending";
    persist({ answers: nextAnswers, path: history, lastStepId: current.id, complete });

    busy.current = true;
    setTimeout(() => (busy.current = false), 350);
    if (step.kind === "question") setHistory((h) => [...h, step.id]);
    go(step, 1);
  };

  const back = () => {
    if (stage.kind !== "question") return;
    if (history.length > 1) {
      const prev = history[history.length - 2];
      setHistory((h) => h.slice(0, -1));
      go({ kind: "question", id: prev }, -1);
    } else if (schema.welcome.enabled) {
      setHistory([]);
      go({ kind: "welcome" }, -1);
    }
  };

  const restart = () => {
    responseId.current = null;
    setAnswers({});
    setHistory(!schema.welcome.enabled && schema.questions[0] ? [schema.questions[0].id] : []);
    go(initialStage(schema), -1);
  };

  /* ---------------- progress ---------------- */
  const total = schema.questions.length;
  const progress = stage.kind === "ending" ? 1 : stage.kind === "welcome" ? 0 : total ? currentIndex / total : 0;
  const numberOf = (id: string) => {
    if (!schema.settings.showQuestionNumbers) return null;
    const visible = schema.questions.filter((q) => q.type !== "statement");
    const i = visible.findIndex((q) => q.id === id);
    return i >= 0 ? i + 1 : null;
  };

  const pageVariants: Variants = {
    enter: (d: number) => ({ opacity: 0, y: reduce ? 0 : d * 56, filter: reduce ? "none" : "blur(6px)" }),
    center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
    exit: (d: number) => ({
      opacity: 0,
      y: reduce ? 0 : d * -56,
      filter: reduce ? "none" : "blur(6px)",
      transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
    }),
  };

  const stageKey = stage.kind === "welcome" ? "welcome" : `${stage.kind}:${stage.id}`;
  const ending = stage.kind === "ending" ? schema.endings.find((e) => e.id === stage.id) : undefined;

  return (
    <FormShell theme={schema.theme} className={className}>
      {schema.settings.showProgress && (
        <div className="absolute inset-x-0 top-0 z-20 h-[3px]" style={{ background: "var(--f-accent-soft)" }}>
          <motion.div
            className="h-full origin-left"
            style={{ background: "var(--f-accent)" }}
            initial={false}
            animate={{ scaleX: progress }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
          />
        </div>
      )}

      {mode === "preview" && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase"
            style={{ background: "var(--f-accent-soft)", color: "var(--f-muted)", boxShadow: "inset 0 0 0 1px var(--f-border)" }}
          >
            Preview · not saved
          </span>
          <button
            type="button"
            onClick={restart}
            className="inline-flex size-8 items-center justify-center rounded-full transition-opacity hover:opacity-80"
            style={{ background: "var(--f-accent-soft)", color: "var(--f-text)", boxShadow: "inset 0 0 0 1px var(--f-border)" }}
            title="Restart"
          >
            <RotateCcw className="size-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-full px-3.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--f-accent)", color: "var(--f-on-accent)" }}
            >
              Close
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-center justify-center px-6 pt-24 pb-28 sm:px-12">
          <AnimatePresence mode="wait" custom={dir} onExitComplete={() => scrollRef.current?.scrollTo({ top: 0 })}>
            <motion.div
              key={stageKey}
              custom={dir}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex w-full justify-center"
            >
              {stage.kind === "welcome" && <WelcomeView welcome={schema.welcome} onStart={start} />}
              {current && (
                <QuestionView
                  question={current}
                  title={recall(current.title, fields)}
                  description={current.description ? recall(current.description, fields) : undefined}
                  number={numberOf(current.id)}
                  answer={answers[current.id]}
                  onChange={(a) => {
                    setError(null);
                    setAnswers((prev) => {
                      const next = { ...prev };
                      if (a === undefined) delete next[current.id];
                      else next[current.id] = a;
                      return next;
                    });
                  }}
                  onSubmit={submit}
                  error={error}
                  errorKey={errorKey}
                  isLast={currentIndex === schema.questions.length - 1}
                  autoFocus
                />
              )}
              {ending && (
                <EndingView
                  ending={ending}
                  title={recall(ending.title, fields)}
                  description={ending.description ? recall(ending.description, fields) : undefined}
                  calendarUrl={schema.settings.calendarUrl}
                  fields={fields}
                  live={mode === "live"}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {stage.kind === "question" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-5 bottom-5 z-20 flex overflow-hidden rounded-lg sm:right-8 sm:bottom-7"
            style={{ boxShadow: "inset 0 0 0 1px var(--f-border)", background: "var(--f-surface)" }}
          >
            <button
              type="button"
              onClick={back}
              disabled={history.length <= 1 && !schema.welcome.enabled}
              aria-label="Previous"
              className="flex size-9 items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <span className="w-px" style={{ background: "var(--f-border)" }} />
            <button
              type="button"
              onClick={() => submit()}
              aria-label="Next"
              className="flex size-9 items-center justify-center transition-opacity hover:opacity-70"
            >
              <ChevronDown className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </FormShell>
  );
}
