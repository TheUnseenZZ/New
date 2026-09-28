import type { Template } from './types';

const requested = new Map<string, Promise<void>>();

/**
 * Load a Google Font for a template on demand, so custom templates can use any family
 * without editing index.html. Resolves even if the font fails (canvas falls back to sans-serif).
 */
export function ensureFont(f: Template['font']): Promise<void> {
  const key = `${f.family}|${f.weight}|${f.italic ? 1 : 0}`;
  let p = requested.get(key);
  if (p) return p;
  const axis = f.italic ? `ital,wght@1,${f.weight}` : `wght@${f.weight}`;
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:${axis}&display=block`;
  p = new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    const done = () =>
      document.fonts
        .load(`${f.italic ? 'italic ' : ''}${f.weight} 64px "${f.family}"`)
        .then(() => resolve(), () => resolve());
    link.onload = done;
    link.onerror = () => {
      // Family may not ship that exact weight; fall back to the default style.
      const fallback = document.createElement('link');
      fallback.rel = 'stylesheet';
      fallback.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}&display=block`;
      fallback.onload = fallback.onerror = done;
      document.head.appendChild(fallback);
    };
    document.head.appendChild(link);
  });
  requested.set(key, p);
  return p;
}

export function ensureFonts(templates: Template[]) {
  return Promise.all(templates.map((t) => ensureFont(t.font)));
}
