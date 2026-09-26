export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex size-6 items-center justify-center rounded-md bg-white text-black">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="7.5" cy="7.5" r="4.5" />
          <path d="M10.5 10.5 13.5 13.5" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Qualify</span>
    </span>
  );
}
