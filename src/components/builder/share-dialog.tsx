"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/controls";
import { useToast } from "@/components/ui/toast";

export function ShareDialog({
  open,
  onClose,
  slug,
  isPublished,
  onUnpublish,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  isPublished: boolean;
  onUnpublish: () => void;
}) {
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<"link" | "embed" | "popup">("link");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const url = `${origin}/f/${slug}`;
  const embed = `<iframe src="${url}" style="width:100%;height:640px;border:0;border-radius:16px" allow="fullscreen" title="Apply"></iframe>`;
  const button = `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 22px;background:#0a0a0a;color:#fff;border-radius:10px;font:500 15px/1 system-ui;text-decoration:none">Book a call →</a>`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  };

  const snippet = mode === "link" ? url : mode === "embed" ? embed : button;

  return (
    <Modal open={open} onClose={onClose} title="Share your form" description={isPublished ? "Your form is live." : "Publish to activate this link."}>
      <Segmented
        value={mode}
        options={[
          { value: "link", label: "Link" },
          { value: "embed", label: "Embed" },
          { value: "popup", label: "Button" },
        ]}
        onChange={setMode}
      />
      <div className="mt-4">
        {mode === "link" ? (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink p-1 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{url}</span>
            <button className="btn-secondary h-8" onClick={() => copy(url, "link")}>
              {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
            </button>
          </div>
        ) : (
          <div className="relative">
            <pre className="max-h-40 overflow-auto rounded-lg border border-line bg-ink p-3 pr-20 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-dim">
              {snippet}
            </pre>
            <button className="btn-secondary absolute top-2 right-2 h-7 px-2.5 text-[12px]" onClick={() => copy(snippet, mode)}>
              {copied === mode ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
            </button>
          </div>
        )}
        <p className="mt-2 text-[12px] text-faint">
          {mode === "link" && "Use it in ads, bios, emails and DMs. UTM parameters are captured with each lead."}
          {mode === "embed" && "Paste into any website builder (Webflow, WordPress, Framer, Squarespace)."}
          {mode === "popup" && "A styled button that opens your form in a new tab."}
        </p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        {isPublished ? (
          <button className="btn-ghost -ml-2 text-bad hover:text-bad" onClick={onUnpublish}>
            Unpublish
          </button>
        ) : (
          <span />
        )}
        <a href={url} target="_blank" rel="noreferrer" className={`btn-secondary ${!isPublished ? "pointer-events-none opacity-40" : ""}`}>
          Open form <ExternalLink className="size-3.5" />
        </a>
      </div>
    </Modal>
  );
}
