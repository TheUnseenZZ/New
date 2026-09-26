"use client";

import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const TABS = [
  { key: "edit", label: "Build" },
  { key: "leads", label: "Leads" },
  { key: "analytics", label: "Analytics" },
] as const;

export function FormNav({
  formId,
  active,
  title,
  right,
}: {
  formId: string;
  active: (typeof TABS)[number]["key"];
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink px-3">
      <Link href="/dashboard" className="btn-icon" title="All forms">
        <ArrowLeft className="size-4" />
      </Link>
      <div className="h-5 w-px bg-line" />
      <div className="min-w-0 flex-1 md:flex-none md:basis-64">{title}</div>
      <nav className="mx-auto hidden items-center gap-1 rounded-lg border border-line bg-panel p-0.5 md:flex">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/forms/${formId}/${t.key}`}
            className={`relative rounded-md px-3.5 py-1 text-[13px] font-medium transition-colors ${
              active === t.key ? "text-fg" : "text-faint hover:text-dim"
            }`}
          >
            {active === t.key && (
              <motion.span layoutId="form-tab" className="absolute inset-0 rounded-md border border-line-strong bg-hover" />
            )}
            <span className="relative">{t.label}</span>
          </Link>
        ))}
      </nav>
      <div className="flex shrink-0 items-center justify-end gap-2 md:basis-64">{right}</div>
    </header>
  );
}

export function MobileTabs({ formId, active }: { formId: string; active: string }) {
  return (
    <nav className="flex border-b border-line bg-ink md:hidden">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/forms/${formId}/${t.key}`}
          className={`flex-1 py-2.5 text-center text-[13px] ${active === t.key ? "border-b border-white text-fg" : "text-faint"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
