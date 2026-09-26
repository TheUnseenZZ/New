"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, CalendarCheck, CircleDashed, CircleX, Download, Inbox, Mail, Phone, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormNav, MobileTabs } from "@/components/builder/form-nav";
import { useToast } from "@/components/ui/toast";
import { recall } from "@/lib/engine";
import type { SerializedResponse } from "@/lib/responses";
import type { ResponseStatus } from "@/lib/types";

type Filter = "all" | ResponseStatus;

const STATUS: Record<ResponseStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  qualified: { label: "Qualified", cls: "border-good/25 bg-good/10 text-good", icon: <CalendarCheck className="size-3" /> },
  disqualified: { label: "Disqualified", cls: "border-bad/25 bg-bad/10 text-bad", icon: <CircleX className="size-3" /> },
  completed: { label: "Completed", cls: "border-line-strong bg-raised text-dim", icon: <Inbox className="size-3" /> },
  partial: { label: "Partial", cls: "border-line bg-transparent text-faint", icon: <CircleDashed className="size-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status as ResponseStatus] ?? STATUS.partial;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function fmtDate(iso: string, withTime = false) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (!withTime) {
    if (s < 60) return "Just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  }
  return d.toLocaleString(undefined, { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit", year: "numeric" } : {}) });
}

export function Leads({
  form,
  responses: initial,
}: {
  form: { id: string; title: string; slug: string; isPublished: boolean };
  responses: SerializedResponse[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [responses, setResponses] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<SerializedResponse | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: responses.length, qualified: 0, disqualified: 0, completed: 0, partial: 0 };
    responses.forEach((r) => (c[r.status as ResponseStatus] += 1));
    return c;
  }, [responses]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return responses.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!q || [r.name, r.email, r.company, r.phone].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [responses, filter, query]);

  const remove = async (r: SerializedResponse) => {
    await fetch(`/api/responses/${r.id}`, { method: "DELETE" });
    setResponses((list) => list.filter((x) => x.id !== r.id));
    setOpen(null);
    toast("Lead deleted");
    router.refresh();
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "qualified", label: "Qualified" },
    { key: "disqualified", label: "Disqualified" },
    { key: "completed", label: "Completed" },
    { key: "partial", label: "Partial" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <FormNav
        formId={form.id}
        active="leads"
        title={<span className="block truncate px-2 text-[14px] font-medium">{form.title}</span>}
        right={
          <a href={`/api/forms/${form.id}/responses?format=csv`} className="btn-secondary">
            <Download className="size-3.5" /> <span className="hidden sm:inline">Export CSV</span>
          </a>
        }
      />
      <MobileTabs formId={form.id} active="leads" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <h1 className="font-serif text-4xl">Leads</h1>
          <p className="mt-2 text-sm text-dim">Every response is saved as it happens — including people who didn&apos;t finish.</p>
        </motion.div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`relative rounded-lg px-3 py-1.5 text-[13px] transition-colors ${filter === t.key ? "text-fg" : "text-faint hover:text-dim"}`}
              >
                {filter === t.key && <motion.span layoutId="lead-filter" className="absolute inset-0 rounded-lg border border-line-strong bg-raised" />}
                <span className="relative">
                  {t.label} <span className="ml-1 text-faint tabular-nums">{counts[t.key]}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
            <input className="input pl-8" placeholder="Search name, email, company" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <div className="card mt-4 overflow-hidden">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <Inbox className="size-6 text-faint" />
              <p className="mt-4 text-sm font-medium">{responses.length ? "No leads match" : "No leads yet"}</p>
              <p className="mt-1 max-w-xs text-[13px] text-dim">
                {responses.length
                  ? "Try a different filter or search."
                  : form.isPublished
                    ? "Share your link to start collecting leads."
                    : "Publish your form and share the link to start collecting leads."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11.5px] tracking-wide text-faint uppercase">
                    <th className="px-5 py-3 font-medium">Lead</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Score</th>
                    <th className="hidden px-3 py-3 font-medium md:table-cell">Company</th>
                    <th className="hidden px-3 py-3 font-medium lg:table-cell">Phone</th>
                    <th className="px-5 py-3 text-right font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i, 20) * 0.015 }}
                      onClick={() => setOpen(r)}
                      className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-raised"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name ?? r.email ?? "?"} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg">{r.name || <span className="text-faint">Anonymous</span>}</p>
                            <p className="truncate text-[12px] text-faint">{r.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{r.score}</td>
                      <td className="hidden px-3 py-3 text-dim md:table-cell">{r.company || "—"}</td>
                      <td className="hidden px-3 py-3 text-dim lg:table-cell">{r.phone || "—"}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap text-faint">{fmtDate(r.completedAt ?? r.createdAt)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <LeadDrawer lead={open} onClose={() => setOpen(null)} onDelete={remove} />
    </div>
  );
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised text-[11px] font-semibold text-dim">
      {initials || "?"}
    </span>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onDelete,
}: {
  lead: SerializedResponse | null;
  onClose: () => void;
  onDelete: (r: SerializedResponse) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setConfirm(false);
    if (!lead) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [lead, onClose]);

  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl shadow-black"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line p-6">
              <div className="min-w-0">
                <StatusBadge status={lead.status} />
                <h2 className="mt-3 truncate text-xl font-semibold tracking-tight">{lead.name || "Anonymous lead"}</h2>
                <p className="mt-1 text-[12px] text-faint">{fmtDate(lead.completedAt ?? lead.createdAt, true)}</p>
              </div>
              <button className="btn-icon" onClick={onClose} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
                <div className="bg-panel p-4">
                  <p className="text-[11.5px] text-faint">Score</p>
                  <p className="mt-1 text-2xl font-medium tabular-nums">{lead.score}</p>
                </div>
                <div className="bg-panel p-4">
                  <p className="text-[11.5px] text-faint">Source</p>
                  <p className="mt-1 truncate text-[13px] text-dim">
                    {lead.utm?.utm_source ?? hostOf(lead.referrer) ?? "Direct"}
                    {lead.utm?.utm_campaign ? ` · ${lead.utm.utm_campaign}` : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-1 border-b border-line p-4">
                {lead.email && <ContactRow icon={<Mail />} href={`mailto:${lead.email}`} value={lead.email} />}
                {lead.phone && <ContactRow icon={<Phone />} href={`tel:${lead.phone}`} value={lead.phone} />}
                {lead.company && <ContactRow icon={<Building2 />} value={lead.company} />}
                {!lead.email && !lead.phone && !lead.company && <p className="px-2 text-[13px] text-faint">No contact details captured.</p>}
              </div>

              <div className="p-6">
                <h3 className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">Answers</h3>
                <ol className="mt-4 space-y-5">
                  {lead.answers.map((a, i) => (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.03 }}
                    >
                      <p className="text-[12px] text-faint">{recall(a.title, { name: lead.name ?? undefined, email: lead.email ?? undefined, phone: lead.phone ?? undefined, company: lead.company ?? undefined })}</p>
                      <p className="mt-1 text-[14px] whitespace-pre-line text-fg">{a.value}</p>
                    </motion.li>
                  ))}
                  {lead.answers.length === 0 && <p className="text-[13px] text-faint">No answers yet.</p>}
                </ol>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line p-4">
              {confirm ? (
                <>
                  <button className="btn-ghost" onClick={() => setConfirm(false)}>
                    Cancel
                  </button>
                  <button className="btn bg-bad text-black hover:bg-bad/90" onClick={() => onDelete(lead)}>
                    Delete permanently
                  </button>
                </>
              ) : (
                <button className="btn-ghost text-faint hover:text-bad" onClick={() => setConfirm(true)}>
                  <Trash2 className="size-3.5" /> Delete lead
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ContactRow({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
  const content = (
    <>
      <span className="text-faint [&>svg]:size-3.5">{icon}</span>
      <span className="truncate">{value}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] text-fg transition-colors hover:bg-raised">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2 text-[13px] text-fg">{content}</div>
  );
}
