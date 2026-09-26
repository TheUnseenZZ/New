"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef } from "react";

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-1">
      {label ? (
        <span className="min-w-0">
          <span className="block text-[13px] text-fg">{label}</span>
          {description && <span className="mt-0.5 block text-[12px] leading-snug text-faint">{description}</span>}
        </span>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-white" : "bg-line-strong"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
          className={`size-3.5 rounded-full shadow ${checked ? "ml-[15px] bg-black" : "ml-0.5 bg-neutral-400"}`}
        />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const group = useId();
  return (
    <div className="flex rounded-lg border border-line bg-ink p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-md px-2 ${size === "sm" ? "h-6 text-[11px]" : "h-7 text-[12px]"} font-medium transition-colors ${
              active ? "text-fg" : "text-faint hover:text-dim"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-md border border-line-strong bg-hover"
              />
            )}
            <span className="relative inline-flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="mt-1.5 text-[11.5px] leading-snug text-faint">{hint}</p> : null}
    </div>
  );
}

/** Textarea that grows with its content. */
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  minRows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`input h-auto resize-none py-2 leading-relaxed ${className}`}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      className={`input tabular-nums ${className}`}
    />
  );
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">{title}</h3>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
