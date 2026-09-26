"use client";

import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, NumberInput, Section, Segmented, Toggle } from "@/components/ui/controls";
import { maxScore } from "@/lib/engine";
import { ACCENTS, FONTS, PRESETS } from "@/lib/themes";
import type { FormSchema, FormSettings, Theme, ThemeFont, ThemePreset } from "@/lib/types";

export function FormSettingsPanel({
  schema,
  onChange,
  slug,
  onSlugChange,
}: {
  schema: FormSchema;
  onChange: (s: FormSchema) => void;
  slug: string;
  onSlugChange: (slug: string) => Promise<string | null>;
}) {
  const setTheme = (patch: Partial<Theme>) => onChange({ ...schema, theme: { ...schema.theme, ...patch } });
  const setSettings = (patch: Partial<FormSettings>) => onChange({ ...schema, settings: { ...schema.settings, ...patch } });
  const max = maxScore(schema);
  const { settings, theme } = schema;
  const provider = settings.calendarUrl?.includes("calendly.com")
    ? "Calendly"
    : settings.calendarUrl?.includes("cal.com")
      ? "Cal.com"
      : settings.calendarUrl
        ? "Custom"
        : null;

  return (
    <div>
      <Section title="Design">
        <Field label="Theme">
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(PRESETS) as ThemePreset[]).map((key) => {
              const p = PRESETS[key];
              const active = theme.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme({ preset: key, accent: p.dark === PRESETS[theme.preset].dark ? theme.accent : p.text })}
                  className="group text-center"
                >
                  <span
                    className={`relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden rounded-lg p-1.5 transition-all ${
                      active ? "ring-2 ring-white ring-offset-2 ring-offset-panel" : "ring-1 ring-line-strong group-hover:ring-neutral-500"
                    }`}
                    style={{ background: p.bg }}
                  >
                    <span className="mb-1 h-1 w-3/4 rounded-full" style={{ background: p.text, opacity: 0.85 }} />
                    <span className="h-1 w-1/2 rounded-full" style={{ background: p.muted, opacity: 0.6 }} />
                  </span>
                  <span className={`mt-1.5 block text-[11px] ${active ? "text-fg" : "text-faint"}`}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Accent">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTheme({ accent: c })}
                className={`relative size-7 rounded-full transition-transform hover:scale-110 ${
                  theme.accent.toLowerCase() === c ? "ring-2 ring-white ring-offset-2 ring-offset-panel" : "ring-1 ring-line-strong"
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
            <label className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-line-strong">
              <span className="absolute inset-0" style={{ background: "conic-gradient(#e5868a,#e6c07b,#7fd4a0,#8fa7d6,#c49fe0,#e5868a)" }} />
              <input type="color" value={theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <span className="ml-1 font-mono text-[11px] text-faint uppercase">{theme.accent}</span>
          </div>
        </Field>
        <Field label="Typography">
          <Segmented
            value={theme.font}
            options={(Object.keys(FONTS) as ThemeFont[]).map((f) => ({
              value: f,
              label: <span style={{ fontFamily: FONTS[f].heading, fontSize: f === "editorial" ? 15 : undefined }}>{FONTS[f].label}</span>,
            }))}
            onChange={(v) => setTheme({ font: v })}
          />
        </Field>
        <Toggle label="Ambient glow" description="A soft light that slowly drifts behind the content." checked={theme.glow} onChange={(v) => setTheme({ glow: v })} />
        <Field label="Logo URL" hint="PNG or SVG with a transparent background works best.">
          <input className="input" placeholder="https://…/logo.svg" value={theme.logoUrl ?? ""} onChange={(e) => setTheme({ logoUrl: e.target.value || undefined })} />
        </Field>
      </Section>

      <Section title="Qualification">
        <Toggle
          label="Lead scoring"
          description="Add points per answer and route leads by their total score."
          checked={settings.scoringEnabled}
          onChange={(v) => setSettings({ scoringEnabled: v })}
        />
        {settings.scoringEnabled && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <Field
              label="Qualified at"
              hint={
                <>
                  Leads scoring <strong className="text-dim">{settings.threshold}+</strong> go to your Qualified ending (max possible: {max}).
                  Logic jumps to a specific ending always win.
                </>
              }
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={Math.max(max, settings.threshold, 1)}
                  value={settings.threshold}
                  onChange={(e) => setSettings({ threshold: Number(e.target.value) })}
                  className="h-1 flex-1 cursor-pointer accent-white"
                />
                <NumberInput value={settings.threshold} onChange={(v) => setSettings({ threshold: v ?? 0 })} className="w-20 text-center" />
              </div>
            </Field>
          </motion.div>
        )}
      </Section>

      <Section title="Booking">
        <Field
          label="Calendar link"
          hint="Your Calendly or Cal.com event link. It's embedded on endings with “Show booking calendar” turned on."
        >
          <div className="relative">
            <input
              className="input pr-20"
              placeholder="https://calendly.com/you/strategy-call"
              value={settings.calendarUrl ?? ""}
              onChange={(e) => setSettings({ calendarUrl: e.target.value.trim() || undefined })}
            />
            {provider && (
              <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md bg-hover px-1.5 py-0.5 text-[10.5px] font-medium text-dim">
                {provider}
              </span>
            )}
          </div>
        </Field>
      </Section>

      <Section title="Behaviour">
        <Toggle label="Progress bar" checked={settings.showProgress} onChange={(v) => setSettings({ showProgress: v })} />
        <Toggle label="Question numbers" checked={settings.showQuestionNumbers} onChange={(v) => setSettings({ showQuestionNumbers: v })} />
      </Section>

      <Section title="Link & sharing">
        <SlugField slug={slug} onSave={onSlugChange} />
        <Field label="Page title" hint="Shown in the browser tab and link previews.">
          <input
            className="input"
            placeholder={schema.welcome.title}
            value={settings.metaTitle ?? ""}
            onChange={(e) => setSettings({ metaTitle: e.target.value || undefined })}
          />
        </Field>
        <Field label="Preview description">
          <input
            className="input"
            placeholder={schema.welcome.description}
            value={settings.metaDescription ?? ""}
            onChange={(e) => setSettings({ metaDescription: e.target.value || undefined })}
          />
        </Field>
      </Section>
    </div>
  );
}

function SlugField({ slug, onSave }: { slug: string; onSave: (s: string) => Promise<string | null> }) {
  const [value, setValue] = useState(slug);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.host), []);
  useEffect(() => setValue(slug), [slug]);

  const save = async () => {
    if (value === slug) return;
    setState("saving");
    const err = await onSave(value);
    setError(err);
    setState(err ? "idle" : "saved");
    if (err) setValue(slug);
    else setTimeout(() => setState("idle"), 1500);
  };

  return (
    <Field label="Public link" hint={error ? <span className="text-bad">{error}</span> : "Changing this breaks links you've already shared."}>
      <div className="flex items-center rounded-lg border border-line bg-ink pl-3 transition-colors focus-within:border-neutral-500 hover:border-line-strong">
        <span className="shrink-0 text-[12px] text-faint">{origin}/f/</span>
        <input
          className="h-9 min-w-0 flex-1 bg-transparent pr-2 text-[13px] text-fg outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <span className="w-7 shrink-0 text-faint">
          {state === "saving" && <Loader2 className="size-3.5 animate-spin" />}
          {state === "saved" && <Check className="size-3.5 text-good" />}
        </span>
      </div>
    </Field>
  );
}
