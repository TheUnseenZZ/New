import type { Theme, ThemeFont, ThemePreset } from "./types";

export interface Palette {
  label: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  dark: boolean;
}

export const PRESETS: Record<ThemePreset, Palette> = {
  onyx: { label: "Onyx", bg: "#0a0a0a", surface: "#141414", text: "#fafafa", muted: "#8f8f8f", border: "#262626", dark: true },
  graphite: { label: "Graphite", bg: "#18181b", surface: "#222226", text: "#f4f4f5", muted: "#9d9da6", border: "#303036", dark: true },
  midnight: { label: "Midnight", bg: "#080b14", surface: "#10151f", text: "#eef1f7", muted: "#8a93a6", border: "#1f2736", dark: true },
  ivory: { label: "Ivory", bg: "#f7f6f2", surface: "#ffffff", text: "#0a0a0a", muted: "#6b6b6b", border: "#e3e1da", dark: false },
};

export const FONTS: Record<ThemeFont, { label: string; heading: string; body: string }> = {
  sans: { label: "Modern", heading: "var(--font-geist-sans)", body: "var(--font-geist-sans)" },
  editorial: { label: "Editorial", heading: "'Instrument Serif', Georgia, serif", body: "var(--font-geist-sans)" },
  mono: { label: "Technical", heading: "var(--font-geist-mono)", body: "var(--font-geist-sans)" },
};

export const ACCENTS = ["#ffffff", "#d4d4d8", "#c8a96a", "#9fb8a0", "#8fa7d6", "#e2a39a", "#0a0a0a"];

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** CSS custom properties consumed by the form runner. */
export function themeVars(theme: Theme): Record<string, string> {
  const p = PRESETS[theme.preset] ?? PRESETS.onyx;
  let accent = /^#[0-9a-f]{3,6}$/i.test(theme.accent) ? theme.accent : p.text;
  // Keep the accent readable against the background.
  if (Math.abs(luminance(accent) - luminance(p.bg)) < 0.08) accent = p.text;
  const onAccent = luminance(accent) > 0.45 ? "#0a0a0a" : "#fafafa";
  const font = FONTS[theme.font] ?? FONTS.sans;
  return {
    "--f-bg": p.bg,
    "--f-surface": p.surface,
    "--f-text": p.text,
    "--f-muted": p.muted,
    "--f-border": p.border,
    "--f-accent": accent,
    "--f-on-accent": onAccent,
    "--f-accent-soft": withAlpha(accent, 0.1),
    "--f-accent-line": withAlpha(accent, 0.35),
    "--f-glow": withAlpha(p.dark ? accent : "#000000", p.dark ? 0.07 : 0.035),
    "--f-heading": font.heading,
    "--f-body": font.body,
  };
}
