"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowRight, Check, Clock, CornerDownLeft, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { calendarEmbedUrl } from "@/lib/engine";
import { themeVars } from "@/lib/themes";
import type { Answer, Ending, LeadField, Question, Theme, Welcome } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const staggerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function FormShell({
  theme,
  children,
  className = "",
}: {
  theme: Theme;
  children: React.ReactNode;
  className?: string;
}) {
  const vars = useMemo(() => themeVars(theme) as React.CSSProperties, [theme]);
  return (
    <div className={`form-root form-shell grain relative isolate overflow-hidden ${className}`} style={vars} data-font={theme.font}>
      {theme.glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-[-25%] left-[5%] -z-10 h-[75%] w-[90%] rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--f-glow), transparent)", animation: "drift 22s ease-in-out infinite" }}
        />
      )}
      {theme.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt="" className="absolute top-5 left-5 z-10 h-7 w-auto max-w-[160px] object-contain sm:top-7 sm:left-8" />
      ) : null}
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  hint = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  hint?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[15px] font-medium shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
        style={{ background: "var(--f-accent)", color: "var(--f-on-accent)" }}
      >
        {children}
      </motion.button>
      {hint && (
        <span className="hidden items-center gap-1.5 text-xs [@media(hover:hover)]:inline-flex" style={{ color: "var(--f-muted)" }}>
          press <strong className="font-semibold" style={{ color: "var(--f-text)" }}>Enter</strong>
          <CornerDownLeft className="size-3" />
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome                                                             */
/* ------------------------------------------------------------------ */

export function WelcomeView({ welcome, onStart }: { welcome: Welcome; onStart?: () => void }) {
  useEnter(onStart);
  return (
    <motion.div variants={staggerVariants} initial="hidden" animate="show" className="flex max-w-2xl flex-col items-start">
      <motion.h1 variants={itemVariants} className="form-heading q-hero text-balance">
        {welcome.title || "Welcome"}
      </motion.h1>
      {welcome.description ? (
        <motion.p variants={itemVariants} className="q-desc mt-5 max-w-xl text-pretty whitespace-pre-line" style={{ color: "var(--f-muted)" }}>
          {welcome.description}
        </motion.p>
      ) : null}
      <motion.div variants={itemVariants} className="mt-9 flex flex-col items-start gap-4">
        <PrimaryButton onClick={onStart}>
          {welcome.buttonLabel || "Start"}
          <ArrowRight className="size-4" />
        </PrimaryButton>
        {welcome.timeToComplete ? (
          <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--f-muted)" }}>
            <Clock className="size-3.5" /> {welcome.timeToComplete}
          </span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Question                                                            */
/* ------------------------------------------------------------------ */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

function useEnter(cb?: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!cb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isTypingTarget(e.target) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        ref.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [!!cb]); // eslint-disable-line react-hooks/exhaustive-deps
}

export interface QuestionViewProps {
  question: Question;
  title: string;
  description?: string;
  number?: number | null;
  answer: Answer | undefined;
  onChange?: (a: Answer | undefined) => void;
  /** Called to move forward. `value` is passed when advancing right after a selection. */
  onSubmit?: (value?: Answer) => void;
  error?: string | null;
  errorKey?: number;
  isLast?: boolean;
  autoFocus?: boolean;
}

export function QuestionView(props: QuestionViewProps) {
  const { question: q, title, description, number, onSubmit, error, errorKey, isLast } = props;
  const reduce = useReducedMotion();
  const interactive = !!onSubmit;
  const needsButton = !["yes_no", "rating"].includes(q.type) && !(q.type === "multiple_choice" && !q.allowMultiple);

  useEnter(interactive && q.type !== "long_text" ? () => onSubmit?.() : undefined);

  return (
    <motion.div variants={staggerVariants} initial="hidden" animate="show" className="flex w-full max-w-2xl flex-col">
      <motion.div variants={itemVariants} className="flex gap-3">
        {number ? (
          <span className="mt-[0.45em] inline-flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums" style={{ color: "var(--f-accent)" }}>
            {number}
            <ArrowRight className="size-3.5" />
          </span>
        ) : null}
        <h2 className="form-heading q-title text-balance">
          {title || <span style={{ color: "var(--f-muted)" }}>Your question here…</span>}
          {q.required && q.type !== "statement" ? <span style={{ color: "var(--f-muted)" }}> *</span> : null}
        </h2>
      </motion.div>
      {description ? (
        <motion.p
          variants={itemVariants}
          className={`q-desc mt-3 whitespace-pre-line ${number ? "sm:pl-8" : ""}`}
          style={{ color: "var(--f-muted)" }}
        >
          {description}
        </motion.p>
      ) : null}

      <motion.div variants={itemVariants} className={`mt-8 ${number ? "sm:pl-8" : ""}`}>
        <motion.div
          key={errorKey}
          animate={errorKey && !reduce ? { x: [0, -9, 9, -6, 6, -2, 0] } : undefined}
          transition={{ duration: 0.45 }}
        >
          <AnswerInput {...props} />
        </motion.div>

        <div className="mt-2 min-h-7">
          <AnimatePresence>
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px]"
                style={{ background: "rgba(229,134,138,0.12)", color: "#f0a3a6" }}
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {needsButton && (
          <div className="mt-4">
            <PrimaryButton onClick={() => onSubmit?.()} hint={q.type !== "long_text"}>
              {q.buttonLabel || (isLast ? "Submit" : "OK")}
              {isLast ? <ArrowRight className="size-4" /> : <Check className="size-4" />}
            </PrimaryButton>
            {q.type === "long_text" && (
              <p className="mt-3 hidden text-xs [@media(hover:hover)]:block" style={{ color: "var(--f-muted)" }}>
                <strong style={{ color: "var(--f-text)" }}>Shift ⇧ + Enter ↵</strong> for a new line
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function AnswerInput({ question: q, answer, onChange, onSubmit, autoFocus }: QuestionViewProps) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 380);
    return () => clearTimeout(t);
  }, [autoFocus, q.id]);

  const textKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  switch (q.type) {
    case "statement":
      return null;
    case "long_text":
      return (
        <textarea
          ref={inputRef}
          rows={1}
          value={typeof answer === "string" ? answer : ""}
          placeholder={q.placeholder || "Type your answer here…"}
          onChange={(e) => {
            onChange?.(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={textKeyDown}
          className="form-input q-input-text resize-none"
        />
      );
    case "multiple_choice":
      return <ChoiceList q={q} answer={answer} onChange={onChange} onSubmit={onSubmit} />;
    case "yes_no":
      return <YesNo q={q} answer={answer} onChange={onChange} onSubmit={onSubmit} />;
    case "rating":
      return <Rating q={q} answer={answer} onChange={onChange} onSubmit={onSubmit} />;
    default: {
      const type = q.type === "email" ? "email" : q.type === "phone" ? "tel" : q.type === "website" ? "url" : q.type === "number" ? "number" : "text";
      const autoComplete =
        q.type === "email" ? "email" : q.type === "phone" ? "tel" : q.type === "website" ? "url" : q.leadField === "name" ? "name" : q.leadField === "company" ? "organization" : "off";
      return (
        <input
          ref={inputRef}
          type={type}
          inputMode={q.type === "number" ? "decimal" : undefined}
          autoComplete={autoComplete}
          value={answer === undefined ? "" : String(answer)}
          placeholder={q.placeholder || "Type your answer here…"}
          onChange={(e) => onChange?.(e.target.value === "" ? undefined : e.target.value)}
          onKeyDown={textKeyDown}
          className="form-input q-input-text"
        />
      );
    }
  }
}

/** Runs the selection "blink" and then advances, Typeform-style. */
function useFlashAdvance(onSubmit?: (v?: Answer) => void) {
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = (key: string, value: Answer) => {
    setFlash(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFlash(null);
      onSubmit?.(value);
    }, 520);
  };
  return { flash, trigger };
}

function OptionButton({
  letter,
  label,
  selected,
  flashing,
  onClick,
  className = "",
}: {
  letter?: string;
  label: React.ReactNode;
  selected: boolean;
  flashing: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      animate={flashing ? { opacity: [1, 0.35, 1, 0.35, 1] } : { opacity: 1 }}
      transition={flashing ? { duration: 0.5, times: [0, 0.25, 0.5, 0.75, 1] } : { duration: 0.2 }}
      className={`group flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] transition-colors duration-200 sm:text-base ${className}`}
      style={{
        background: selected ? "color-mix(in srgb, var(--f-accent) 16%, transparent)" : "var(--f-accent-soft)",
        boxShadow: `inset 0 0 0 ${selected ? 1.5 : 1}px ${selected ? "var(--f-accent)" : "var(--f-accent-line)"}`,
      }}
    >
      {letter ? (
        <span
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold transition-colors"
          style={{
            background: selected ? "var(--f-accent)" : "transparent",
            color: selected ? "var(--f-on-accent)" : "var(--f-accent)",
            boxShadow: selected ? "none" : "inset 0 0 0 1px var(--f-accent-line)",
          }}
        >
          {letter}
        </span>
      ) : null}
      <span className="flex-1">{label}</span>
      <AnimatePresence>
        {selected ? (
          <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
            <Check className="size-4" style={{ color: "var(--f-accent)" }} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}

function useLetterKeys(enabled: boolean, handler: (key: string) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      ref.current(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

type InputProps = { q: Question; answer: Answer | undefined; onChange?: (a: Answer | undefined) => void; onSubmit?: (v?: Answer) => void };

function ChoiceList({ q, answer, onChange, onSubmit }: InputProps) {
  const selected = Array.isArray(answer) ? answer : answer ? [String(answer)] : [];
  const { flash, trigger } = useFlashAdvance(onSubmit);
  const choices = q.choices ?? [];

  const pick = (id: string) => {
    if (!onChange) return;
    if (q.allowMultiple) {
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      onChange(next.length ? next : undefined);
    } else {
      onChange([id]);
      if (onSubmit) trigger(id, [id]);
    }
  };

  useLetterKeys(!!onSubmit, (key) => {
    const i = LETTERS.indexOf(key);
    if (i >= 0 && i < choices.length) pick(choices[i].id);
  });

  return (
    <div className="flex max-w-md flex-col gap-2">
      {q.allowMultiple ? (
        <p className="mb-1 text-[13px]" style={{ color: "var(--f-muted)" }}>
          Choose as many as you like
        </p>
      ) : null}
      {choices.map((c, i) => (
        <OptionButton
          key={c.id}
          letter={LETTERS[i]}
          label={c.label || <span style={{ color: "var(--f-muted)" }}>Choice {i + 1}</span>}
          selected={selected.includes(c.id)}
          flashing={flash === c.id}
          onClick={() => pick(c.id)}
        />
      ))}
    </div>
  );
}

function YesNo({ q, answer, onChange, onSubmit }: InputProps) {
  const { flash, trigger } = useFlashAdvance(onSubmit);
  const pick = (v: "yes" | "no") => {
    if (!onChange) return;
    onChange(v);
    if (onSubmit) trigger(v, v);
  };
  useLetterKeys(!!onSubmit, (key) => {
    if (key === "Y") pick("yes");
    if (key === "N") pick("no");
  });
  void q;
  return (
    <div className="flex max-w-xs flex-col gap-2">
      <OptionButton letter="Y" label="Yes" selected={answer === "yes"} flashing={flash === "yes"} onClick={() => pick("yes")} />
      <OptionButton letter="N" label="No" selected={answer === "no"} flashing={flash === "no"} onClick={() => pick("no")} />
    </div>
  );
}

function Rating({ q, answer, onChange, onSubmit }: InputProps) {
  const max = q.ratingMax ?? 10;
  const { flash, trigger } = useFlashAdvance(onSubmit);
  const pick = (n: number) => {
    if (!onChange) return;
    onChange(n);
    if (onSubmit) trigger(String(n), n);
  };
  useLetterKeys(!!onSubmit, (key) => {
    const n = key === "0" ? 10 : Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= max) pick(n);
  });
  return (
    <div className="max-w-xl">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const selected = Number(answer) === n;
          return (
            <motion.button
              key={n}
              type="button"
              onClick={() => pick(n)}
              whileTap={{ scale: 0.94 }}
              animate={flash === String(n) ? { opacity: [1, 0.35, 1, 0.35, 1] } : { opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex h-12 items-center justify-center rounded-lg text-[15px] font-medium tabular-nums transition-colors sm:h-14"
              style={{
                background: selected ? "var(--f-accent)" : "var(--f-accent-soft)",
                color: selected ? "var(--f-on-accent)" : "var(--f-text)",
                boxShadow: selected ? "none" : "inset 0 0 0 1px var(--f-accent-line)",
              }}
            >
              {n}
            </motion.button>
          );
        })}
      </div>
      {(q.ratingLabels?.low || q.ratingLabels?.high) && (
        <div className="mt-2.5 flex justify-between text-[13px]" style={{ color: "var(--f-muted)" }}>
          <span>{q.ratingLabels?.low}</span>
          <span>{q.ratingLabels?.high}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ending                                                              */
/* ------------------------------------------------------------------ */

function AnimatedCheck() {
  return (
    <motion.svg
      viewBox="0 0 52 52"
      className="size-12"
      initial="hidden"
      animate="show"
      style={{ color: "var(--f-accent)" }}
    >
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.8, ease: EASE } } }}
      />
      <motion.path
        d="M16 27l7 7 13-15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.55, duration: 0.45, ease: EASE } } }}
      />
    </motion.svg>
  );
}

export function EndingView({
  ending,
  title,
  description,
  calendarUrl,
  fields,
  live,
}: {
  ending: Ending;
  title: string;
  description?: string;
  calendarUrl?: string;
  fields: Partial<Record<LeadField, string>>;
  live: boolean;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!live || !ending.redirectUrl) return;
    let n = 4;
    setCountdown(n);
    const t = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        const url = ending.redirectUrl!.startsWith("http") ? ending.redirectUrl! : `https://${ending.redirectUrl}`;
        try {
          (window.top ?? window).location.href = url;
        } catch {
          window.location.href = url;
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [live, ending.redirectUrl]);

  const showCalendar = ending.showCalendar;
  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="show"
      className={`flex w-full flex-col ${showCalendar ? "max-w-3xl items-center text-center" : "max-w-2xl items-start"}`}
    >
      {ending.kind !== "disqualified" && (
        <motion.div variants={itemVariants} className="mb-6">
          <AnimatedCheck />
        </motion.div>
      )}
      <motion.h2 variants={itemVariants} className="form-heading q-title text-balance">
        {title || "Thank you"}
      </motion.h2>
      {description ? (
        <motion.p variants={itemVariants} className="q-desc mt-3 max-w-xl text-pretty whitespace-pre-line" style={{ color: "var(--f-muted)" }}>
          {description}
        </motion.p>
      ) : null}

      {showCalendar && (
        <motion.div variants={itemVariants} className="mt-8 w-full">
          <CalendarEmbed url={calendarUrl} fields={fields} />
        </motion.div>
      )}

      {ending.buttonLabel && ending.buttonUrl ? (
        <motion.div variants={itemVariants} className="mt-8">
          <a
            href={ending.buttonUrl.startsWith("http") ? ending.buttonUrl : `https://${ending.buttonUrl}`}
            target="_top"
            className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[15px] font-medium transition-transform hover:-translate-y-px"
            style={{ background: "var(--f-accent)", color: "var(--f-on-accent)" }}
          >
            {ending.buttonLabel}
            <ArrowRight className="size-4" />
          </a>
        </motion.div>
      ) : null}

      {ending.redirectUrl ? (
        <motion.p variants={itemVariants} className="mt-6 text-[13px]" style={{ color: "var(--f-muted)" }}>
          {live ? `Redirecting${countdown ? ` in ${countdown}…` : "…"}` : `Redirects to ${ending.redirectUrl}`}
        </motion.p>
      ) : null}
    </motion.div>
  );
}

function CalendarEmbed({ url, fields }: { url?: string; fields: Partial<Record<LeadField, string>> }) {
  const [loaded, setLoaded] = useState(false);
  const [host, setHost] = useState<string>();
  useEffect(() => setHost(window.location.host), []);
  const src = useMemo(() => (url && host ? calendarEmbedUrl(url, fields, host) : null), [url, fields, host]);

  if (!url) {
    return (
      <div
        className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm"
        style={{ borderColor: "var(--f-accent-line)", color: "var(--f-muted)" }}
      >
        <span>Your booking calendar appears here.</span>
        <span className="text-xs opacity-70">Add a Calendly or Cal.com link in Form → Booking.</span>
      </div>
    );
  }
  return (
    <div className="w-full">
      <div className="relative h-[660px] w-full overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] sm:h-[700px]">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col gap-4 p-8">
            <div className="shimmer h-6 w-1/3 rounded" />
            <div className="shimmer h-4 w-1/2 rounded" />
            <div className="shimmer mt-4 flex-1 rounded-xl" />
          </div>
        )}
        {src && (
          <motion.iframe
            src={src}
            title="Book a time"
            onLoad={() => setLoaded(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: loaded ? 1 : 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
      <a
        href={url.startsWith("http") ? url : `https://${url}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs opacity-70 transition-opacity hover:opacity-100"
        style={{ color: "var(--f-muted)" }}
      >
        Calendar not loading? Open it in a new tab <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
