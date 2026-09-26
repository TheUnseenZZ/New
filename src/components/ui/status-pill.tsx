const STYLES = {
  live: { dot: "bg-good", text: "text-good", label: "Live" },
  changes: { dot: "bg-warn", text: "text-warn", label: "Unpublished changes" },
  draft: { dot: "bg-faint", text: "text-dim", label: "Draft" },
} as const;

export function StatusPill({ status }: { status: keyof typeof STYLES }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${s.text}`}>
      <span className="relative flex size-1.5">
        {status === "live" && <span className={`absolute inset-0 animate-ping rounded-full ${s.dot} opacity-60`} />}
        <span className={`relative size-1.5 rounded-full ${s.dot}`} />
      </span>
      {s.label}
    </span>
  );
}
