"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Copy, FileText, Link2, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import type { FormStats } from "@/lib/stats";
import { TEMPLATES } from "@/lib/templates";
import { FONTS, PRESETS, themeVars } from "@/lib/themes";
import type { Theme } from "@/lib/types";

export interface DashboardForm {
  id: string;
  title: string;
  slug: string;
  status: "live" | "changes" | "draft";
  updatedAt: string;
  views: number;
  questions: number;
  theme: Theme;
  headline: string;
  stats: FormStats;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function Dashboard({
  forms,
  summary,
}: {
  forms: DashboardForm[];
  summary: { leads: number; qualified: number; partial: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DashboardForm | null>(null);

  const rate = summary.leads ? Math.round((summary.qualified / summary.leads) * 100) : 0;

  const duplicate = async (f: DashboardForm) => {
    const res = await fetch(`/api/forms/${f.id}/duplicate`, { method: "POST" });
    if (res.ok) {
      toast("Form duplicated");
      router.refresh();
    }
  };

  const copyLink = (f: DashboardForm) => {
    if (f.status === "draft") return toast("Publish the form first to get a link", "error");
    navigator.clipboard.writeText(`${window.location.origin}/f/${f.slug}`);
    toast("Link copied");
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await fetch(`/api/forms/${confirmDelete.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    toast("Form deleted");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <h1 className="font-serif text-5xl leading-none tracking-tight">Your funnels</h1>
          <p className="mt-3 text-sm text-dim">Build, publish and track lead qualification pages.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary h-10 px-4">
          <Plus className="size-4" /> New form
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
        className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3"
      >
        <Stat label="Leads · 30 days" value={summary.leads} />
        <Stat label="Qualified · 30 days" value={summary.qualified} />
        <Stat label="Qualification rate" value={`${rate}%`} sub={summary.partial ? `${summary.partial} partial` : undefined} />
      </motion.div>

      {forms.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.16 }}
          className="card mt-8 flex flex-col items-center px-6 py-20 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-xl border border-line-strong bg-raised">
            <FileText className="size-5 text-dim" />
          </div>
          <h2 className="mt-5 text-lg font-medium">Create your first qualification form</h2>
          <p className="mt-1.5 max-w-sm text-sm text-dim">
            Start from a proven template, score every answer and send qualified leads straight to your calendar.
          </p>
          <button onClick={() => setCreating(true)} className="btn-primary mt-6">
            <Plus className="size-4" /> New form
          </button>
        </motion.div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.14 + i * 0.04 }}
            >
              <Link
                href={`/forms/${f.id}/edit`}
                className="group card block overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2xl hover:shadow-black/60"
              >
                <Thumbnail theme={f.theme} headline={f.headline} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-medium">{f.title}</h3>
                      <div className="mt-1 flex items-center gap-2 text-[12px] text-faint">
                        <StatusPill status={f.status} />
                        <span>·</span>
                        <span>{timeAgo(f.updatedAt)}</span>
                      </div>
                    </div>
                    <Menu
                      trigger={() => (
                        <span className="btn-icon -mr-1.5 opacity-60 group-hover:opacity-100">
                          <MoreHorizontal className="size-4" />
                        </span>
                      )}
                      items={[
                        { label: "Edit", icon: <Pencil />, onSelect: () => router.push(`/forms/${f.id}/edit`) },
                        { label: "View leads", icon: <Users />, onSelect: () => router.push(`/forms/${f.id}/leads`) },
                        { label: "Copy link", icon: <Link2 />, onSelect: () => copyLink(f) },
                        ...(f.status !== "draft"
                          ? [{ label: "Open live form", icon: <ArrowUpRight />, onSelect: () => window.open(`/f/${f.slug}`, "_blank") }]
                          : []),
                        { label: "Duplicate", icon: <Copy />, onSelect: () => duplicate(f) },
                        "divider",
                        { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(f) },
                      ]}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 border-t border-line pt-3.5 text-[12px]">
                    <Metric label="Views" value={f.views} />
                    <Metric label="Leads" value={f.stats.completed} />
                    <Metric label="Qualified" value={f.stats.qualified} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <NewFormModal open={creating} onClose={() => setCreating(false)} />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this form?"
        description={`“${confirmDelete?.title}” and all of its ${confirmDelete?.stats.starts ?? 0} responses will be permanently deleted. The public link will stop working.`}
        width="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            Cancel
          </button>
          <button className="btn bg-bad text-black hover:bg-bad/90" onClick={remove}>
            Delete form
          </button>
        </div>
      </Modal>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-panel px-6 py-5">
      <p className="text-[12px] text-dim">{label}</p>
      <p className="mt-2 flex items-baseline gap-2 text-3xl font-medium tracking-tight tabular-nums">
        {value}
        {sub && <span className="text-xs font-normal text-faint">{sub}</span>}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-faint">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium text-fg tabular-nums">{value}</p>
    </div>
  );
}

function Thumbnail({ theme, headline }: { theme: Theme; headline: string }) {
  const vars = themeVars(theme) as React.CSSProperties;
  return (
    <div className="relative h-32 overflow-hidden border-b border-line" style={{ ...vars, background: "var(--f-bg)" }}>
      <div
        className="absolute top-[-40%] left-[10%] h-[120%] w-[80%] rounded-full blur-2xl transition-transform duration-700 group-hover:scale-110"
        style={{ background: "radial-gradient(closest-side, var(--f-glow), transparent)" }}
      />
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <p
          className="line-clamp-2 text-[17px] leading-snug"
          style={{ color: "var(--f-text)", fontFamily: FONTS[theme.font]?.heading, fontSize: theme.font === "editorial" ? 21 : 16 }}
        >
          {headline}
        </p>
        <span
          className="mt-2.5 inline-flex h-5 w-12 rounded"
          style={{ background: "var(--f-accent)", opacity: PRESETS[theme.preset]?.dark ? 0.9 : 1 }}
        />
      </div>
    </div>
  );
}

function NewFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [template, setTemplate] = useState<string>("agency");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, title: title.trim() || undefined }),
    });
    if (res.ok) {
      const form = (await res.json()) as { id: string };
      router.push(`/forms/${form.id}/edit`);
    } else setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="New form" description="Pick a starting point. Everything is editable." width="max-w-xl">
      <label className="label">Name</label>
      <input
        className="input"
        placeholder="e.g. Strategy call application"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        autoFocus
      />
      <p className="label mt-5">Template</p>
      <div className="grid gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
              template === t.id ? "border-neutral-400 bg-hover" : "border-line hover:border-line-strong hover:bg-raised"
            }`}
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                template === t.id ? "border-white" : "border-line-strong"
              }`}
            >
              {template === t.id && <motion.span layoutId="tpl-dot" className="size-2 rounded-full bg-white" />}
            </span>
            <span>
              <span className="block text-sm font-medium">{t.name}</span>
              <span className="block text-[13px] text-dim">{t.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={create} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Create form"}
        </button>
      </div>
    </Modal>
  );
}
